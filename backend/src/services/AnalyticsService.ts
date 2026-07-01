import { AppDataSource } from '../config/database.js';
import { User } from '../models/User.js';
import { Business } from '../models/Business.js';
import { Order } from '../models/Order.js';
import { Menu } from '../models/Menu.js';
import { Payment } from '../models/Payment.js';
import { Between, MoreThan } from 'typeorm';

export interface PlatformTelemetrySnapshot {
  status: 'available' | 'unavailable';
  uptime_percentage: number | null;
  api_errors: number | null;
  payment_failures: number | null;
  webhook_failures: number | null;
  error_rate_percentage: number | null;
  p95_latency_ms?: number | null;
  collected_at: string | null;
  unavailable_reason?: string;
}

export interface AnalyticsTelemetryAdapter {
  getPlatformSnapshot(params: { since: Date; until: Date }): Promise<PlatformTelemetrySnapshot>;
}

type NumericTelemetryField =
  | 'uptime_percentage'
  | 'api_errors'
  | 'payment_failures'
  | 'webhook_failures'
  | 'error_rate_percentage'
  | 'p95_latency_ms';

const DASHBOARD_GMV_ROW_KEYS = new Set(['total_gmv_cents']);
const TREND_REVENUE_ROW_KEYS = new Set(['total_gmv_cents']);
const DAILY_GMV_ROW_KEYS = new Set(['total']);
const SELLER_TIER_ROW_KEYS = new Set(['tier', 'count']);
const ORDER_PAYMENT_METHOD_ROW_KEYS = new Set(['method', 'count', 'gmv_cents']);
const ORDER_STATUS_ROW_KEYS = new Set(['status', 'count']);
const TOP_SELLER_ROW_KEYS = new Set(['business_id', 'order_count', 'total_gmv_cents']);
const REVENUE_BREAKDOWN_ROW_KEYS = new Set([
  'subscription_revenue_cents',
  'transaction_fees_cents',
]);

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
  private static paymentRepo = AppDataSource.getRepository(Payment);
  private static telemetryAdapter: AnalyticsTelemetryAdapter | null = null;

  static setTelemetryAdapterForTesting(adapter: AnalyticsTelemetryAdapter | null) {
    this.telemetryAdapter = adapter;
  }

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
    this.assertAnalyticsRowKeys(gmvResult, 'Dashboard GMV row', DASHBOARD_GMV_ROW_KEYS);

    const gmvTodayCents = parseInt(gmvResult?.total_gmv_cents) || 0;

    // Total sellers (all time)
    const totalSellers = await this.userRepo.count();

    // Total businesses published
    const publishedBusinesses = await this.businessRepo.count({
      where: { is_published: true },
    });

    const platformObservability = await this.getPlatformObservability(1);

    return {
      active_sellers: activeSellers,
      total_sellers: totalSellers,
      published_businesses: publishedBusinesses,
      orders_today: ordersToday,
      gmv_today_cents: gmvTodayCents,
      gmv_today_inr: Math.round(gmvTodayCents / 100),
      platform_observability: platformObservability,
      uptime_percentage: platformObservability.uptime_percentage,
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
    this.assertAnalyticsRowKeys(revenueResult, 'Trend revenue row', TREND_REVENUE_ROW_KEYS);

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
      this.assertAnalyticsRowKeys(gmvOnDay, 'Daily GMV row', DAILY_GMV_ROW_KEYS);

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
      tier_distribution: tierDistribution.map((row) => {
        this.assertAnalyticsRowKeys(row, 'Seller tier row', SELLER_TIER_ROW_KEYS);
        return {
          tier: row.tier || 'free',
          count: parseInt(row.count),
        };
      }),
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
    this.assertAnalyticsRowKeys(gmvResult, 'Order GMV row', TREND_REVENUE_ROW_KEYS);

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
      payment_method_breakdown: paymentMethodBreakdown.map((row) => {
        this.assertAnalyticsRowKeys(row, 'Payment method analytics row', ORDER_PAYMENT_METHOD_ROW_KEYS);
        return {
          method: row.method,
          count: parseInt(row.count),
          gmv_cents: parseInt(row.gmv_cents) || 0,
        };
      }),
      status_breakdown: statusBreakdown.map((row) => {
        this.assertAnalyticsRowKeys(row, 'Order status analytics row', ORDER_STATUS_ROW_KEYS);
        return {
          status: row.status,
          count: parseInt(row.count),
        };
      }),
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

    const validatedResults = results.map((row) => {
      this.assertAnalyticsRowKeys(row, 'Top seller analytics row', TOP_SELLER_ROW_KEYS);
      return row;
    });

    // Fetch business details
    const topSellers = await Promise.all(
      validatedResults.map(async (row) => {
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
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const paymentRevenue = await this.paymentRepo
      .createQueryBuilder('payment')
      .select(
        "SUM(CASE WHEN payment.metadata ->> 'revenue_type' = 'subscription' THEN payment.amount_cents ELSE 0 END)",
        'subscription_revenue_cents'
      )
      .addSelect('SUM(payment.processor_fee_cents)', 'transaction_fees_cents')
      .where('payment.created_at > :startDate', { startDate })
      .andWhere('payment.status = :status', { status: 'succeeded' })
      .getRawOne();
    this.assertAnalyticsRowKeys(paymentRevenue, 'Revenue breakdown row', REVENUE_BREAKDOWN_ROW_KEYS);

    const subscriptionRevenueCents = parseInt(paymentRevenue?.subscription_revenue_cents) || 0;
    const transactionFeesCents = parseInt(paymentRevenue?.transaction_fees_cents) || 0;

    return {
      period_days: days,
      subscription_revenue_cents: subscriptionRevenueCents,
      transaction_fees_cents: transactionFeesCents,
      total_revenue_cents: subscriptionRevenueCents + transactionFeesCents,
      source: 'payments',
      measured_at: new Date().toISOString(),
    };
  }

  /**
   * Get error metrics (API errors, payment failures, webhook failures)
   */
  static async getErrorMetrics(days: number = 7) {
    return this.getPlatformObservability(days);
  }

  private static async getPlatformObservability(days: number): Promise<PlatformTelemetrySnapshot & { period_days: number }> {
    const until = new Date();
    const since = new Date();
    since.setDate(since.getDate() - days);

    if (!this.telemetryAdapter) {
      return {
        period_days: days,
        status: 'unavailable',
        uptime_percentage: null,
        api_errors: null,
        payment_failures: null,
        webhook_failures: null,
        error_rate_percentage: null,
        p95_latency_ms: null,
        collected_at: null,
        unavailable_reason: 'telemetry adapter is not configured',
      };
    }

    let snapshot: PlatformTelemetrySnapshot;
    try {
      snapshot = await this.telemetryAdapter.getPlatformSnapshot({ since, until });
      snapshot = this.normalizePlatformTelemetrySnapshot(snapshot);
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : 'unknown error';
      const safeMessage = this.hasUnsafeAnalyticsTextControls(rawMessage)
        ? 'unknown error'
        : rawMessage;
      return this.unavailablePlatformTelemetry(
        days,
        `telemetry adapter returned invalid snapshot: ${safeMessage}`
      );
    }

    return {
      period_days: days,
      ...snapshot,
    };
  }

  private static unavailablePlatformTelemetry(
    days: number,
    unavailableReason: string
  ): PlatformTelemetrySnapshot & { period_days: number } {
    const safeUnavailableReason = this.normalizeUnavailableReason(unavailableReason);
    return {
      period_days: days,
      status: 'unavailable',
      uptime_percentage: null,
      api_errors: null,
      payment_failures: null,
      webhook_failures: null,
      error_rate_percentage: null,
      p95_latency_ms: null,
      collected_at: null,
      unavailable_reason: safeUnavailableReason,
    };
  }

  private static normalizePlatformTelemetrySnapshot(
    snapshot: PlatformTelemetrySnapshot
  ): PlatformTelemetrySnapshot {
    if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
      throw new Error('snapshot must be an object');
    }
    if (snapshot.status !== 'available' && snapshot.status !== 'unavailable') {
      throw new Error('status must be available or unavailable');
    }

    if (snapshot.status === 'unavailable') {
      const unavailableReason = this.normalizeTelemetryText(
        snapshot.unavailable_reason,
        'unavailable_reason'
      );

      return {
        status: 'unavailable',
        uptime_percentage: null,
        api_errors: null,
        payment_failures: null,
        webhook_failures: null,
        error_rate_percentage: null,
        p95_latency_ms: null,
        collected_at: null,
        unavailable_reason: unavailableReason,
      };
    }

    const collectedAt = this.normalizeTelemetryTimestamp(snapshot.collected_at);

    return {
      status: 'available',
      uptime_percentage: this.normalizeTelemetryNumber(
        'uptime_percentage',
        snapshot.uptime_percentage,
        { integer: false, min: 0, max: 100 }
      ),
      api_errors: this.normalizeTelemetryNumber('api_errors', snapshot.api_errors, { integer: true, min: 0 }),
      payment_failures: this.normalizeTelemetryNumber(
        'payment_failures',
        snapshot.payment_failures,
        { integer: true, min: 0 }
      ),
      webhook_failures: this.normalizeTelemetryNumber(
        'webhook_failures',
        snapshot.webhook_failures,
        { integer: true, min: 0 }
      ),
      error_rate_percentage: this.normalizeTelemetryNumber(
        'error_rate_percentage',
        snapshot.error_rate_percentage,
        { integer: false, min: 0, max: 100 }
      ),
      p95_latency_ms: snapshot.p95_latency_ms === undefined
        ? null
        : this.normalizeTelemetryNumber('p95_latency_ms', snapshot.p95_latency_ms, { integer: false, min: 0 }),
      collected_at: collectedAt,
    };
  }

  private static normalizeTelemetryTimestamp(value: unknown): string {
    if (typeof value !== 'string' || !value.trim()) {
      throw new Error('collected_at must be a valid timestamp');
    }
    const timestamp = value.trim();
    if (this.hasUnsafeAnalyticsTextControls(timestamp)) {
      throw new Error('collected_at must not include unsafe control characters');
    }
    if (Number.isNaN(Date.parse(timestamp))) {
      throw new Error('collected_at must be a valid timestamp');
    }
    return timestamp;
  }

  private static normalizeTelemetryText(value: unknown, fieldName: string): string {
    if (typeof value !== 'string' || !value.trim()) {
      throw new Error(`${fieldName} is required when telemetry is unavailable`);
    }
    const normalizedValue = value.trim();
    if (this.hasUnsafeAnalyticsTextControls(normalizedValue)) {
      throw new Error(`${fieldName} must not include unsafe control characters`);
    }
    return normalizedValue;
  }

  private static normalizeUnavailableReason(value: string): string {
    try {
      return this.normalizeTelemetryText(value, 'unavailable_reason');
    } catch {
      return 'telemetry unavailable';
    }
  }

  private static hasUnsafeAnalyticsTextControls(value: string): boolean {
    return /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/u.test(value);
  }

  private static normalizeTelemetryNumber(
    fieldName: NumericTelemetryField,
    value: unknown,
    options: { integer: boolean; min: number; max?: number }
  ): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(`${fieldName} must be a finite number`);
    }
    if (options.integer && !Number.isInteger(value)) {
      throw new Error(`${fieldName} must be an integer`);
    }
    if (value < options.min || (options.max !== undefined && value > options.max)) {
      throw new Error(
        options.max === undefined
          ? `${fieldName} must be greater than or equal to ${options.min}`
          : `${fieldName} must be between ${options.min} and ${options.max}`
      );
    }
    return value;
  }

  private static assertAnalyticsRowKeys<T extends Record<string, unknown>>(
    row: T | null | undefined,
    label: string,
    allowedKeys: Set<string>
  ): T | Record<string, never> {
    if (row === null || row === undefined) {
      return {};
    }
    if (typeof row !== 'object' || Array.isArray(row)) {
      throw new Error(`${label} must be an object`);
    }
    const unsupportedKeys = Object.keys(row).filter((key) => !allowedKeys.has(key));
    if (unsupportedKeys.length > 0) {
      throw new Error(`${label} include unsupported field(s): ${unsupportedKeys.sort().join(', ')}`);
    }
    return row;
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
