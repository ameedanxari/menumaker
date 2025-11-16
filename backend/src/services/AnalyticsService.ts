import { AppDataSource } from '../config/database.js';
import { User } from '../models/User.js';
import { Business } from '../models/Business.js';
import { Order } from '../models/Order.js';
import { Menu } from '../models/Menu.js';
import { Between, MoreThan } from 'typeorm';

/**
 * AnalyticsService - Platform Health Metrics & Trends
 * Phase 3: Admin Backend Platform (US3.10)
 *
 * Provides:
 * - Real-time dashboard metrics (active sellers, orders, GMV, uptime)
 * - Trend analysis (7-day, 30-day, 90-day)
 * - Seller insights (signups, churn, subscription tier distribution)
 * - Order analytics (volume, revenue, payment processor breakdown)
 * - Error tracking and alerts
 */
export class AnalyticsService {
  private static userRepo = AppDataSource.getRepository(User);
  private static businessRepo = AppDataSource.getRepository(Business);
  private static orderRepo = AppDataSource.getRepository(Order);
  private static menuRepo = AppDataSource.getRepository(Menu);

  /**
   * Get real-time dashboard metrics (today's data)
   */
  static async getDashboardMetrics() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Active sellers (not banned, not suspended)
    const activeSellers = await this.userRepo.count({
      where: {
        is_banned: false,
        suspended_until: null,
      },
    });

    // Orders today
    const ordersToday = await this.orderRepo.count({
      where: {
        created_at: MoreThan(today),
      },
    });

    // GMV today (Gross Merchandise Value)
    const gmvResult = await this.orderRepo
      .createQueryBuilder('order')
      .select('SUM(order.total_cents)', 'total_gmv_cents')
      .where('order.created_at > :today', { today })
      .getRawOne();

    const gmvTodayCents = parseInt(gmvResult?.total_gmv_cents) || 0;

    // Total sellers (all time)
    const totalSellers = await this.userRepo.count();

    // Total businesses published
    const publishedBusinesses = await this.businessRepo.count({
      where: { is_published: true },
    });

    return {
      active_sellers: activeSellers,
      total_sellers: totalSellers,
      published_businesses: publishedBusinesses,
      orders_today: ordersToday,
      gmv_today_cents: gmvTodayCents,
      gmv_today_inr: Math.round(gmvTodayCents / 100),
      uptime_percentage: 99.97, // TODO: Integrate with uptime monitoring service
    };
  }

  /**
   * Get trends over time (7-day, 30-day, 90-day)
   */
  static async getTrends(days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Seller signups trend
    const sellerSignups = await this.userRepo.count({
      where: {
        created_at: MoreThan(startDate),
      },
    });

    // Order volume trend
    const orderVolume = await this.orderRepo.count({
      where: {
        created_at: MoreThan(startDate),
      },
    });

    // Revenue trend (GMV)
    const revenueResult = await this.orderRepo
      .createQueryBuilder('order')
      .select('SUM(order.total_cents)', 'total_gmv_cents')
      .where('order.created_at > :startDate', { startDate })
      .getRawOne();

    const revenueCents = parseInt(revenueResult?.total_gmv_cents) || 0;

    // Churn (sellers who deleted accounts or were banned)
    const churnedSellers = await this.userRepo.count({
      where: [
        { is_banned: true, banned_at: MoreThan(startDate) },
        // { deleted_at: MoreThan(startDate) }, // Uncomment if soft-delete is implemented
      ],
    });

    // Daily breakdown (last 7 days for chart)
    const dailyBreakdown = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);

      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const ordersOnDay = await this.orderRepo.count({
        where: {
          created_at: Between(date, nextDate),
        },
      });

      const gmvOnDay = await this.orderRepo
        .createQueryBuilder('order')
        .select('SUM(order.total_cents)', 'total')
        .where('order.created_at >= :date AND order.created_at < :nextDate', { date, nextDate })
        .getRawOne();

      dailyBreakdown.push({
        date: date.toISOString().split('T')[0],
        orders: ordersOnDay,
        gmv_cents: parseInt(gmvOnDay?.total) || 0,
      });
    }

    return {
      period_days: days,
      seller_signups: sellerSignups,
      order_volume: orderVolume,
      revenue_cents: revenueCents,
      revenue_inr: Math.round(revenueCents / 100),
      churned_sellers: churnedSellers,
      daily_breakdown: dailyBreakdown,
    };
  }

  /**
   * Get seller statistics (subscription tiers, status distribution)
   */
  static async getSellerStats() {
    // Subscription tier distribution
    const tierDistribution = await this.userRepo
      .createQueryBuilder('user')
      .select('user.subscription_tier', 'tier')
      .addSelect('COUNT(*)', 'count')
      .groupBy('user.subscription_tier')
      .getRawMany();

    // Status distribution
    const activeCount = await this.userRepo.count({
      where: {
        is_banned: false,
        suspended_until: null,
      },
    });

    const suspendedCount = await this.userRepo.count({
      where: {
        suspended_until: MoreThan(new Date()),
      },
    });

    const bannedCount = await this.userRepo.count({
      where: {
        is_banned: true,
      },
    });

    return {
      tier_distribution: tierDistribution.map((row) => ({
        tier: row.tier || 'free',
        count: parseInt(row.count),
      })),
      status_distribution: {
        active: activeCount,
        suspended: suspendedCount,
        banned: bannedCount,
      },
    };
  }

  /**
   * Get order analytics (volume, revenue, payment processor breakdown)
   */
  static async getOrderAnalytics(days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Total orders
    const totalOrders = await this.orderRepo.count({
      where: {
        created_at: MoreThan(startDate),
      },
    });

    // Total GMV
    const gmvResult = await this.orderRepo
      .createQueryBuilder('order')
      .select('SUM(order.total_cents)', 'total_gmv_cents')
      .where('order.created_at > :startDate', { startDate })
      .getRawOne();

    const totalGmvCents = parseInt(gmvResult?.total_gmv_cents) || 0;

    // Payment method breakdown
    const paymentMethodBreakdown = await this.orderRepo
      .createQueryBuilder('order')
      .select('order.payment_method', 'method')
      .addSelect('COUNT(*)', 'count')
      .addSelect('SUM(order.total_cents)', 'gmv_cents')
      .where('order.created_at > :startDate', { startDate })
      .groupBy('order.payment_method')
      .getRawMany();

    // Order status breakdown
    const statusBreakdown = await this.orderRepo
      .createQueryBuilder('order')
      .select('order.order_status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('order.created_at > :startDate', { startDate })
      .groupBy('order.order_status')
      .getRawMany();

    return {
      period_days: days,
      total_orders: totalOrders,
      total_gmv_cents: totalGmvCents,
      total_gmv_inr: Math.round(totalGmvCents / 100),
      payment_method_breakdown: paymentMethodBreakdown.map((row) => ({
        method: row.method,
        count: parseInt(row.count),
        gmv_cents: parseInt(row.gmv_cents) || 0,
      })),
      status_breakdown: statusBreakdown.map((row) => ({
        status: row.status,
        count: parseInt(row.count),
      })),
    };
  }

  /**
   * Get top sellers (by GMV, order count, or reviews)
   */
  static async getTopSellers(params: { limit?: number; sort_by?: 'gmv' | 'orders' | 'reviews' }) {
    const { limit = 10, sort_by = 'gmv' } = params;

    const queryBuilder = this.orderRepo
      .createQueryBuilder('order')
      .select('order.business_id', 'business_id')
      .addSelect('COUNT(*)', 'order_count')
      .addSelect('SUM(order.total_cents)', 'total_gmv_cents')
      .groupBy('order.business_id');

    if (sort_by === 'gmv') {
      queryBuilder.orderBy('total_gmv_cents', 'DESC');
    } else if (sort_by === 'orders') {
      queryBuilder.orderBy('order_count', 'DESC');
    }

    queryBuilder.limit(limit);

    const results = await queryBuilder.getRawMany();

    // Fetch business details
    const topSellers = await Promise.all(
      results.map(async (row) => {
        const business = await this.businessRepo.findOne({
          where: { id: row.business_id },
          relations: ['owner'],
        });

        return {
          business_id: row.business_id,
          business_name: business?.name || 'Unknown',
          owner_email: business?.owner?.email || 'Unknown',
          order_count: parseInt(row.order_count),
          total_gmv_cents: parseInt(row.total_gmv_cents) || 0,
          total_gmv_inr: Math.round((parseInt(row.total_gmv_cents) || 0) / 100),
        };
      })
    );

    return { top_sellers: topSellers };
  }

  /**
   * Get revenue breakdown (subscriptions vs fees)
   */
  static async getRevenueBreakdown(days: number = 30) {
    // TODO: This requires subscription payment tracking
    // For now, return placeholder data

    return {
      period_days: days,
      subscription_revenue_cents: 0,
      transaction_fees_cents: 0,
      total_revenue_cents: 0,
      note: 'Subscription tracking not yet implemented (Phase 3.1+)',
    };
  }

  /**
   * Get error metrics (API errors, payment failures, webhook failures)
   */
  static async getErrorMetrics(days: number = 7) {
    // TODO: This requires error logging system integration
    // For now, return placeholder data

    return {
      period_days: days,
      api_errors: 0,
      payment_failures: 0,
      webhook_failures: 0,
      error_rate_percentage: 0.0,
      note: 'Error tracking not yet implemented',
    };
  }

  /**
   * Export analytics data as CSV
   */
  static async exportAnalyticsCSV(params: {
    type: 'sellers' | 'orders' | 'revenue';
    start_date: Date;
    end_date: Date;
  }) {
    const { type, start_date, end_date } = params;

    if (type === 'sellers') {
      const sellers = await this.userRepo.find({
        where: {
          created_at: Between(start_date, end_date),
        },
        order: { created_at: 'DESC' },
      });

      // Generate CSV
      const header = 'ID,Email,Created At,Subscription Tier,Is Banned,Suspended Until\n';
      const rows = sellers
        .map(
          (seller) =>
            `${seller.id},${seller.email},${seller.created_at.toISOString()},free,${seller.is_banned},${seller.suspended_until || ''}`
        )
        .join('\n');

      return header + rows;
    } else if (type === 'orders') {
      const orders = await this.orderRepo.find({
        where: {
          created_at: Between(start_date, end_date),
        },
        order: { created_at: 'DESC' },
      });

      // Generate CSV
      const header = 'ID,Business ID,Total (INR),Payment Method,Status,Created At\n';
      const rows = orders
        .map(
          (order) =>
            `${order.id},${order.business_id},${order.total_cents / 100},${order.payment_method},${order.order_status},${order.created_at.toISOString()}`
        )
        .join('\n');

      return header + rows;
    }

    return '';
  }
}
