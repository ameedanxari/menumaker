import { Repository } from 'typeorm';
import { Order } from '../models/Order.js';
import { Business } from '../models/Business.js';
import { AppDataSource } from '../config/database.js';

export class ReportService {
  private orderRepository: Repository<Order>;
  private businessRepository: Repository<Business>;

  constructor() {
    this.orderRepository = AppDataSource.getRepository(Order);
    this.businessRepository = AppDataSource.getRepository(Business);
  }

  async exportOrdersToCSV(
    businessId: string,
    userId: string,
    filters?: {
      startDate?: Date;
      endDate?: Date;
      status?: string;
    }
  ): Promise<string> {
    // Verify business ownership
    const business = await this.businessRepository.findOne({
      where: { id: businessId },
    });

    if (!business || business.owner_id !== userId) {
      const error = new Error('You do not have permission to export orders for this business') as Error & {
        statusCode: number;
        code: string;
      };
      error.statusCode = 403;
      error.code = 'FORBIDDEN';
      throw error;
    }

    // Build query
    const queryBuilder = this.orderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.items', 'items')
      .leftJoinAndSelect('items.dish', 'dish')
      .where('order.business_id = :businessId', { businessId });

    if (filters?.status) {
      queryBuilder.andWhere('order.order_status = :status', { status: filters.status });
    }

    if (filters?.startDate) {
      queryBuilder.andWhere('order.created_at >= :startDate', { startDate: filters.startDate });
    }

    if (filters?.endDate) {
      queryBuilder.andWhere('order.created_at <= :endDate', { endDate: filters.endDate });
    }

    queryBuilder.orderBy('order.created_at', 'DESC');

    const orders = await queryBuilder.getMany();

    // Generate CSV
    const csvRows: string[] = [];

    // Headers
    csvRows.push([
      'Order ID',
      'Date',
      'Customer Name',
      'Customer Phone',
      'Customer Email',
      'Delivery Type',
      'Delivery Address',
      'Dish Name',
      'Quantity',
      'Unit Price',
      'Item Total',
      'Delivery Fee',
      'Order Total',
      'Payment Method',
      'Payment Status',
      'Order Status',
      'Notes',
      'Fulfilled At',
    ].join(','));

    // Data rows
    for (const order of orders) {
      if (!order.items || order.items.length === 0) {
        // Order with no items (edge case)
        csvRows.push([
          order.id,
          order.created_at.toISOString(),
          this.escapeCsvField(order.customer_name),
          this.escapeCsvField(order.customer_phone),
          this.escapeCsvField(order.customer_email || ''),
          order.delivery_type,
          this.escapeCsvField(order.delivery_address || ''),
          '',
          '',
          '',
          '',
          this.formatCurrency(order.delivery_fee_cents),
          this.formatCurrency(order.total_cents),
          order.payment_method,
          order.payment_status,
          order.order_status,
          this.escapeCsvField(order.notes || ''),
          order.fulfilled_at ? order.fulfilled_at.toISOString() : '',
        ].join(','));
      } else {
        // Add row for each item
        order.items.forEach((item, index) => {
          const itemTotal = item.quantity * item.price_at_purchase_cents;

          csvRows.push([
            order.id,
            order.created_at.toISOString(),
            this.escapeCsvField(order.customer_name),
            this.escapeCsvField(order.customer_phone),
            this.escapeCsvField(order.customer_email || ''),
            order.delivery_type,
            this.escapeCsvField(order.delivery_address || ''),
            this.escapeCsvField(item.dish?.name || 'Unknown'),
            item.quantity.toString(),
            this.formatCurrency(item.price_at_purchase_cents),
            this.formatCurrency(itemTotal),
            index === 0 ? this.formatCurrency(order.delivery_fee_cents) : '', // Show delivery fee only once
            index === 0 ? this.formatCurrency(order.total_cents) : '', // Show total only once
            order.payment_method,
            order.payment_status,
            order.order_status,
            this.escapeCsvField(order.notes || ''),
            order.fulfilled_at ? order.fulfilled_at.toISOString() : '',
          ].join(','));
        });
      }
    }

    return csvRows.join('\n');
  }

  private escapeCsvField(field: string): string {
    // Escape quotes and wrap in quotes if contains comma, quote, or newline
    if (field.includes(',') || field.includes('"') || field.includes('\n')) {
      return `"${field.replace(/"/g, '""')}"`;
    }
    return field;
  }

  private formatCurrency(cents: number): string {
    return (cents / 100).toFixed(2);
  }

  async getDashboardStats(
    businessId: string,
    userId: string,
    period: 'today' | 'week' | 'month' | 'all' = 'week'
  ): Promise<{
    totalOrders: number;
    totalRevenue: number;
    averageOrderValue: number;
    pendingOrders: number;
    completedOrders: number;
    revenueByDay: Array<{ date: string; revenue: number; orders: number }>;
  }> {
    // Verify business ownership
    const business = await this.businessRepository.findOne({
      where: { id: businessId },
    });

    if (!business || business.owner_id !== userId) {
      const error = new Error('You do not have permission to view dashboard for this business') as Error & {
        statusCode: number;
        code: string;
      };
      error.statusCode = 403;
      error.code = 'FORBIDDEN';
      throw error;
    }

    // Calculate date range
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(0); // Beginning of time
    }

    const orders = await this.orderRepository.find({
      where: {
        business_id: businessId,
      },
      order: {
        created_at: 'DESC',
      },
    });

    const filteredOrders = orders.filter(
      order => order.created_at >= startDate
    );

    const totalOrders = filteredOrders.length;
    const totalRevenue = filteredOrders.reduce((sum, order) => sum + order.total_cents, 0);
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const pendingOrders = filteredOrders.filter(
      order => ['pending', 'confirmed', 'ready'].includes(order.order_status)
    ).length;
    const completedOrders = filteredOrders.filter(
      order => order.order_status === 'fulfilled'
    ).length;

    // Group by day
    const revenueByDay = this.groupOrdersByDay(filteredOrders);

    return {
      totalOrders,
      totalRevenue,
      averageOrderValue,
      pendingOrders,
      completedOrders,
      revenueByDay,
    };
  }

  private groupOrdersByDay(orders: Order[]): Array<{ date: string; revenue: number; orders: number }> {
    const dayMap = new Map<string, { revenue: number; orders: number }>();

    for (const order of orders) {
      const dateKey = order.created_at.toISOString().split('T')[0];

      if (!dayMap.has(dateKey)) {
        dayMap.set(dateKey, { revenue: 0, orders: 0 });
      }

      const day = dayMap.get(dateKey)!;
      day.revenue += order.total_cents;
      day.orders += 1;
    }

    return Array.from(dayMap.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }
}
