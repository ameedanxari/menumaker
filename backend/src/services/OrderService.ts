import { Repository } from 'typeorm';
import { Order } from '../models/Order.js';
import { OrderItem } from '../models/OrderItem.js';
import { Business } from '../models/Business.js';
import { BusinessSettings } from '../models/BusinessSettings.js';
import { Menu } from '../models/Menu.js';
import { Dish } from '../models/Dish.js';
import { AppDataSource } from '../config/database.js';
import { OrderCreateInput, OrderUpdateInput } from '@menumaker/shared';
import { WhatsAppService } from './WhatsAppService.js';

const ORDER_STATUSES = new Set(['pending', 'confirmed', 'ready', 'fulfilled', 'cancelled']);
const PAYMENT_STATUSES = new Set(['unpaid', 'paid']);
const UNSAFE_ORDER_TEXT_CONTROLS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
const DEFAULT_CUSTOMER_ORDER_LIMIT = 50;
const MAX_CUSTOMER_ORDER_LIMIT = 100;

type OrderServiceError = Error & {
  statusCode: number;
  code: string;
};

export class OrderService {
  private orderRepository: Repository<Order>;
  private orderItemRepository: Repository<OrderItem>;
  private businessRepository: Repository<Business>;
  private settingsRepository: Repository<BusinessSettings>;
  private menuRepository: Repository<Menu>;
  private dishRepository: Repository<Dish>;

  constructor() {
    this.orderRepository = AppDataSource.getRepository(Order);
    this.orderItemRepository = AppDataSource.getRepository(OrderItem);
    this.businessRepository = AppDataSource.getRepository(Business);
    this.settingsRepository = AppDataSource.getRepository(BusinessSettings);
    this.menuRepository = AppDataSource.getRepository(Menu);
    this.dishRepository = AppDataSource.getRepository(Dish);
  }

  private createValidationError(message: string, code = 'INVALID_ORDER_FILTER'): OrderServiceError {
    const error = new Error(message) as OrderServiceError;
    error.statusCode = 400;
    error.code = code;
    return error;
  }

  private normalizeOrderStatus(label: string, status?: string): string | undefined {
    if (status === undefined || status === null || status === '') return undefined;
    if (typeof status !== 'string') {
      throw this.createValidationError(`${label} must be text`, 'INVALID_ORDER_STATUS');
    }
    const normalized = status.trim();
    if (!normalized) return undefined;
    if (UNSAFE_ORDER_TEXT_CONTROLS.test(normalized)) {
      throw this.createValidationError(`${label} contains unsafe control characters`, 'INVALID_ORDER_STATUS');
    }
    if (!ORDER_STATUSES.has(normalized)) {
      throw this.createValidationError(`Unsupported ${label.toLowerCase()}`, 'INVALID_ORDER_STATUS');
    }
    return normalized;
  }

  private normalizePaymentStatus(status?: string): string | undefined {
    if (status === undefined || status === null || status === '') return undefined;
    if (typeof status !== 'string') {
      throw this.createValidationError('Payment status must be text', 'INVALID_PAYMENT_STATUS');
    }
    const normalized = status.trim();
    if (!normalized) return undefined;
    if (UNSAFE_ORDER_TEXT_CONTROLS.test(normalized)) {
      throw this.createValidationError('Payment status contains unsafe control characters', 'INVALID_PAYMENT_STATUS');
    }
    if (!PAYMENT_STATUSES.has(normalized)) {
      throw this.createValidationError('Unsupported payment status', 'INVALID_PAYMENT_STATUS');
    }
    return normalized;
  }

  private normalizeOptionalOrderText(label: string, value?: string): string | undefined {
    if (value === undefined || value === null || value === '') return undefined;
    if (typeof value !== 'string') {
      throw this.createValidationError(`${label} must be text`, 'INVALID_ORDER_TEXT');
    }
    const normalized = value.trim();
    if (!normalized) return undefined;
    if (normalized.length > 500) {
      throw this.createValidationError(`${label} must be 500 characters or less`, 'INVALID_ORDER_TEXT');
    }
    if (UNSAFE_ORDER_TEXT_CONTROLS.test(normalized)) {
      throw this.createValidationError(`${label} contains unsafe control characters`, 'INVALID_ORDER_TEXT');
    }
    return normalized;
  }

  private assertValidDateRange(startDate?: Date, endDate?: Date): void {
    if (startDate && Number.isNaN(startDate.getTime())) {
      throw this.createValidationError('startDate must be a valid date');
    }
    if (endDate && Number.isNaN(endDate.getTime())) {
      throw this.createValidationError('endDate must be a valid date');
    }
    if (startDate && endDate && startDate > endDate) {
      throw this.createValidationError('startDate must be before or equal to endDate');
    }
  }

  private normalizePagination(filters: { limit?: number; offset?: number }): { limit: number; offset: number } {
    const limit = filters.limit ?? DEFAULT_CUSTOMER_ORDER_LIMIT;
    const offset = filters.offset ?? 0;

    if (!Number.isSafeInteger(limit) || limit < 0 || limit > MAX_CUSTOMER_ORDER_LIMIT) {
      throw this.createValidationError(`limit must be a safe integer between 0 and ${MAX_CUSTOMER_ORDER_LIMIT}`);
    }
    if (!Number.isSafeInteger(offset) || offset < 0) {
      throw this.createValidationError('offset must be a non-negative safe integer');
    }

    return { limit, offset };
  }

  private calculateDeliveryFee(settings: BusinessSettings, distance?: number): number {
    if (settings.delivery_type === 'free') {
      return 0;
    }

    if (settings.delivery_type === 'flat') {
      return settings.delivery_fee_cents;
    }

    // Distance-based calculation
    if (settings.delivery_type === 'distance' && distance) {
      const baseFee = settings.delivery_base_fee_cents || 0;
      const perKmFee = settings.delivery_per_km_cents || 0;

      // Apply rounding
      let roundedDistance = distance;
      if (settings.distance_rounding === 'ceil') {
        roundedDistance = Math.ceil(distance);
      } else if (settings.distance_rounding === 'floor') {
        roundedDistance = Math.floor(distance);
      } else {
        roundedDistance = Math.round(distance);
      }

      return baseFee + (roundedDistance * perKmFee);
    }

    return 0;
  }

  async createOrder(data: OrderCreateInput, userId?: string): Promise<Order> {
    // Use transaction for atomicity
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Verify menu exists and is published
      const menu = await queryRunner.manager.findOne(Menu, {
        where: { id: data.menu_id },
        relations: ['business'],
      });

      if (!menu) {
        const error = new Error('Menu not found') as Error & {
          statusCode: number;
          code: string;
        };
        error.statusCode = 404;
        error.code = 'MENU_NOT_FOUND';
        throw error;
      }

      if (menu.status !== 'published') {
        const error = new Error('This menu is not currently available for ordering') as Error & {
          statusCode: number;
          code: string;
        };
        error.statusCode = 400;
        error.code = 'MENU_NOT_AVAILABLE';
        throw error;
      }

      // Validate menu date range
      const now = new Date();
      if (menu.start_date && new Date(menu.start_date) > now) {
        const error = new Error('This menu is not yet available') as Error & {
          statusCode: number;
          code: string;
        };
        error.statusCode = 400;
        error.code = 'MENU_NOT_YET_AVAILABLE';
        throw error;
      }

      if (menu.end_date && new Date(menu.end_date) < now) {
        const error = new Error('This menu is no longer available') as Error & {
          statusCode: number;
          code: string;
        };
        error.statusCode = 400;
        error.code = 'MENU_EXPIRED';
        throw error;
      }

      // Get business settings for delivery fee calculation and payment method
      const settings = await queryRunner.manager.findOne(BusinessSettings, {
        where: { business_id: menu.business_id },
      });

      if (!settings) {
        const error = new Error('Business settings not found') as Error & {
          statusCode: number;
          code: string;
        };
        error.statusCode = 404;
        error.code = 'SETTINGS_NOT_FOUND';
        throw error;
      }

      // Check if business is accepting orders (based on operating hours or settings)
      // Note: This is a simple check. In production, you'd check operating hours
      // Payment method validation is handled elsewhere

      // Verify all dishes exist and are available
      const dishIds = data.items.map(item => item.dish_id);
      const dishes = await queryRunner.manager.findByIds(Dish, dishIds);

      if (dishes.length !== dishIds.length) {
        const error = new Error('One or more dishes not found') as Error & {
          statusCode: number;
          code: string;
        };
        error.statusCode = 404;
        error.code = 'DISH_NOT_FOUND';
        throw error;
      }

      // Check if all dishes are available
      const unavailableDishes = dishes.filter(dish => !dish.is_available);
      if (unavailableDishes.length > 0) {
        const dishNames = unavailableDishes.map(d => d.name).join(', ');
        const error = new Error(`The following dishes are currently unavailable: ${dishNames}`) as Error & {
          statusCode: number;
          code: string;
          details?: { unavailableDishes: Array<{ id: string; name: string }> };
        };
        error.statusCode = 400;
        error.code = 'DISHES_UNAVAILABLE';
        error.details = { unavailableDishes: unavailableDishes.map(d => ({ id: d.id, name: d.name })) };
        throw error;
      }

      // Create dish map for price lookup
      const dishMap = new Map(dishes.map(d => [d.id, d]));

      // Calculate order total
      let itemsTotal = 0;
      const orderItems: Partial<OrderItem>[] = [];

      for (const item of data.items) {
        const dish = dishMap.get(item.dish_id);
        if (!dish) continue;

        const itemPrice = dish.price_cents * item.quantity;
        itemsTotal += itemPrice;

        orderItems.push({
          dish_id: item.dish_id,
          quantity: item.quantity,
          price_at_purchase_cents: dish.price_cents,
        });
      }

      // Check minimum order value
      if (settings.min_order_value_cents && itemsTotal < settings.min_order_value_cents) {
        const error = new Error(
          `Minimum order value not met. Minimum: ₹${settings.min_order_value_cents / 100}, Current: ₹${itemsTotal / 100}`
        ) as Error & {
          statusCode: number;
          code: string;
        };
        error.statusCode = 400;
        error.code = 'MIN_ORDER_NOT_MET';
        throw error;
      }

      // Calculate delivery fee (simplified - no distance calculation in MVP)
      let deliveryFee = data.delivery_type === 'delivery'
        ? this.calculateDeliveryFee(settings)
        : 0;

      // Apply free delivery if minimum order amount met
      if (
        settings.min_order_free_delivery_cents &&
        itemsTotal >= settings.min_order_free_delivery_cents &&
        data.delivery_type === 'delivery'
      ) {
        deliveryFee = 0; // Free delivery applied
      }

      const totalCents = itemsTotal + deliveryFee;

      // Create order
      const order = queryRunner.manager.create(Order, {
        business_id: menu.business_id,
        menu_id: data.menu_id,
        customer_name: data.customer_name,
        customer_phone: data.customer_phone,
        customer_email: data.customer_email,
        delivery_type: data.delivery_type,
        delivery_address: data.delivery_address,
        total_cents: totalCents,
        delivery_fee_cents: deliveryFee,
        payment_method: settings.payment_method,
        payment_status: 'unpaid',
        order_status: 'pending',
        notes: data.notes,
        currency: settings.currency,
        customer_id: userId,
      });

      await queryRunner.manager.save(order);

      // Create order items
      const items = orderItems.map(item =>
        queryRunner.manager.create(OrderItem, {
          order_id: order.id,
          ...item,
        })
      );

      await queryRunner.manager.save(items);

      // Commit transaction
      await queryRunner.commitTransaction();

      // Reload order with items
      const createdOrder = await this.getOrderById(order.id);

      // Send WhatsApp notification to seller (async, non-blocking)
      WhatsAppService.notifySellerNewOrder(createdOrder).catch(error => {
        console.error('Failed to send WhatsApp notification:', error);
        // Don't throw - notification failure shouldn't fail order creation
      });

      return createdOrder;
    } catch (error) {
      // Rollback transaction on error
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      // Release query runner
      await queryRunner.release();
    }
  }

  async getOrderById(orderId: string): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['items', 'items.dish', 'business', 'menu'],
    });

    if (!order) {
      const error = new Error('Order not found') as Error & {
        statusCode: number;
        code: string;
      };
      error.statusCode = 404;
      error.code = 'ORDER_NOT_FOUND';
      throw error;
    }

    return order;
  }

  async getBusinessOrders(
    businessId: string,
    userId: string,
    filters?: {
      status?: string;
      startDate?: Date;
      endDate?: Date;
    }
  ): Promise<Order[]> {
    const normalizedStatus = this.normalizeOrderStatus('Order status', filters?.status);
    this.assertValidDateRange(filters?.startDate, filters?.endDate);

    // Verify business ownership
    const business = await this.businessRepository.findOne({
      where: { id: businessId },
    });

    if (!business || business.owner_id !== userId) {
      const error = new Error('You do not have permission to view orders for this business') as Error & {
        statusCode: number;
        code: string;
      };
      error.statusCode = 403;
      error.code = 'FORBIDDEN';
      throw error;
    }

    const queryBuilder = this.orderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.items', 'items')
      .leftJoinAndSelect('items.dish', 'dish')
      .where('order.business_id = :businessId', { businessId });

    if (normalizedStatus) {
      queryBuilder.andWhere('order.order_status = :status', { status: normalizedStatus });
    }

    if (filters?.startDate) {
      queryBuilder.andWhere('order.created_at >= :startDate', { startDate: filters.startDate });
    }

    if (filters?.endDate) {
      queryBuilder.andWhere('order.created_at <= :endDate', { endDate: filters.endDate });
    }

    queryBuilder.orderBy('order.created_at', 'DESC');

    const orders = await queryBuilder.getMany();

    return orders;
  }

  async updateOrder(orderId: string, userId: string, data: OrderUpdateInput): Promise<Order> {
    const order = await this.getOrderById(orderId);
    const normalizedOrderStatus = this.normalizeOrderStatus('Order status', data.order_status);
    const normalizedPaymentStatus = this.normalizePaymentStatus(data.payment_status);
    const normalizedNotes = this.normalizeOptionalOrderText('Order notes', data.notes);

    // Verify business ownership
    const business = await this.businessRepository.findOne({
      where: { id: order.business_id },
    });

    if (!business || business.owner_id !== userId) {
      const error = new Error('You do not have permission to update this order') as Error & {
        statusCode: number;
        code: string;
      };
      error.statusCode = 403;
      error.code = 'FORBIDDEN';
      throw error;
    }

    // Update order
    if (normalizedOrderStatus) {
      order.order_status = normalizedOrderStatus as Order['order_status'];

      // Set fulfilled_at timestamp when order is fulfilled
      if (normalizedOrderStatus === 'fulfilled' && !order.fulfilled_at) {
        order.fulfilled_at = new Date();
      }
    }

    if (normalizedPaymentStatus) {
      order.payment_status = normalizedPaymentStatus as Order['payment_status'];
    }

    if (data.notes !== undefined) {
      order.notes = normalizedNotes;
    }

    await this.orderRepository.save(order);

    return order;
  }

  async getOrderSummary(
    businessId: string,
    userId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    totalOrders: number;
    totalSales: number;
    averageOrderValue: number;
    ordersByStatus: Record<string, number>;
  }> {
    this.assertValidDateRange(startDate, endDate);

    // Verify business ownership
    const business = await this.businessRepository.findOne({
      where: { id: businessId },
    });

    if (!business || business.owner_id !== userId) {
      const error = new Error('You do not have permission to view reports for this business') as Error & {
        statusCode: number;
        code: string;
      };
      error.statusCode = 403;
      error.code = 'FORBIDDEN';
      throw error;
    }

    const queryBuilder = this.orderRepository
      .createQueryBuilder('order')
      .where('order.business_id = :businessId', { businessId });

    if (startDate) {
      queryBuilder.andWhere('order.created_at >= :startDate', { startDate });
    }

    if (endDate) {
      queryBuilder.andWhere('order.created_at <= :endDate', { endDate });
    }

    const orders = await queryBuilder.getMany();

    const totalOrders = orders.length;
    const totalSales = orders.reduce((sum, order) => sum + order.total_cents, 0);
    const averageOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;

    const ordersByStatus = orders.reduce((acc, order) => {
      acc[order.order_status] = (acc[order.order_status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalOrders,
      totalSales,
      averageOrderValue,
      ordersByStatus,
    };
  }

  async getCustomerOrders(
    userId: string,
    filters: {
      status?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<Order[]> {
    const normalizedStatus = this.normalizeOrderStatus('Order status', filters.status);
    const pagination = this.normalizePagination(filters);

    const queryBuilder = this.orderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.items', 'items')
      .leftJoinAndSelect('order.business', 'business')
      .where('order.customer_id = :userId', { userId });

    if (normalizedStatus) {
      queryBuilder.andWhere('order.order_status = :status', { status: normalizedStatus });
    }

    queryBuilder
      .orderBy('order.created_at', 'DESC')
      .take(pagination.limit)
      .skip(pagination.offset);

    return queryBuilder.getMany();
  }

  async cancelOrder(orderId: string, userId: string, reason?: string): Promise<Order> {
    const normalizedReason = this.normalizeOptionalOrderText('Cancellation reason', reason);

    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['business'],
    });

    if (!order) {
      const error = new Error('Order not found') as Error & {
        statusCode: number;
        code: string;
      };
      error.statusCode = 404;
      error.code = 'ORDER_NOT_FOUND';
      throw error;
    }

    // Verify the user owns this order
    if (order.customer_id !== userId) {
      const error = new Error('You do not have permission to cancel this order') as Error & {
        statusCode: number;
        code: string;
      };
      error.statusCode = 403;
      error.code = 'FORBIDDEN';
      throw error;
    }

    // Only allow cancellation if order is pending or confirmed
    if (!['pending', 'confirmed'].includes(order.order_status)) {
      const error = new Error('Order cannot be cancelled at this stage') as Error & {
        statusCode: number;
        code: string;
      };
      error.statusCode = 400;
      error.code = 'CANNOT_CANCEL';
      throw error;
    }

    // Update order status to cancelled
    order.order_status = 'cancelled';
    if (normalizedReason) {
      order.notes = (order.notes ? order.notes + '\n' : '') + `Cancellation reason: ${normalizedReason}`;
    }

    await this.orderRepository.save(order);

    return order;
  }
}
