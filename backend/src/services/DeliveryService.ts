import { Repository } from 'typeorm';
import { AppDataSource } from '../config/database.js';
import {
  DeliveryIntegration,
  DeliveryTracking,
  DeliveryRating,
  DeliveryProvider,
  DeliveryStatus,
  DeliveryCostHandling,
} from '../models/DeliveryIntegration.js';
import { Order } from '../models/Order.js';

/**
 * Delivery Service Interface
 * All delivery providers must implement this interface
 */
export interface IDeliveryService {
  provider: DeliveryProvider;

  /**
   * Create delivery request with partner
   */
  createDelivery(order: Order, integration: DeliveryIntegration): Promise<{
    success: boolean;
    delivery_partner_id?: string;
    estimated_pickup_at?: Date;
    estimated_delivery_at?: Date;
    delivery_fee_cents?: number;
    tracking_url?: string;
    error?: string;
  }>;

  /**
   * Cancel delivery
   */
  cancelDelivery(deliveryPartnerId: string, integration: DeliveryIntegration): Promise<{
    success: boolean;
    error?: string;
  }>;

  /**
   * Get delivery status
   */
  getDeliveryStatus(deliveryPartnerId: string, integration: DeliveryIntegration): Promise<{
    status: DeliveryStatus;
    delivery_person_name?: string;
    delivery_person_phone?: string;
    tracking_url?: string;
    estimated_delivery_at?: Date;
  }>;
}

/**
 * Swiggy Delivery Service
 */
export class SwiggyDeliveryService implements IDeliveryService {
  provider: DeliveryProvider = 'swiggy';

  async createDelivery(order: Order, integration: DeliveryIntegration): Promise<{
    success: boolean;
    delivery_partner_id?: string;
    estimated_pickup_at?: Date;
    estimated_delivery_at?: Date;
    delivery_fee_cents?: number;
    tracking_url?: string;
    error?: string;
  }> {
    try {
      // Build Swiggy delivery request
      const payload = {
        merchant_id: integration.partner_account_id,
        order_id: order.id,
        pickup_address: {
          // Would get from Business entity
          name: 'Business Name',
          phone: '9876543210',
          address: 'Business Address',
          latitude: 0,
          longitude: 0,
        },
        drop_address: {
          name: order.customer_name,
          phone: order.customer_phone,
          address: order.delivery_address || '',
          instructions: order.delivery_instructions || '',
        },
        package_details: {
          weight_kg: 1.0,
          dimensions: { length: 30, width: 30, height: 15 },
          description: 'Food order',
          value_cents: order.total_price_cents,
        },
        service_type: integration.settings?.service_type || 'standard',
        pickup_instructions: integration.pickup_instructions,
      };

      // Call Swiggy API (stubbed - would use actual Swiggy SDK)
      // const response = await fetch('https://api.swiggy.com/v1/delivery/create', {
      //   method: 'POST',
      //   headers: {
      //     'Authorization': `Bearer ${integration.api_key}`,
      //     'Content-Type': 'application/json',
      //   },
      //   body: JSON.stringify(payload),
      // });

      // Simulate success for demo
      const now = new Date();
      const pickupTime = new Date(now.getTime() + 15 * 60 * 1000); // 15 min
      const deliveryTime = new Date(now.getTime() + 45 * 60 * 1000); // 45 min

      return {
        success: true,
        delivery_partner_id: `SWGY-${Date.now()}`,
        estimated_pickup_at: pickupTime,
        estimated_delivery_at: deliveryTime,
        delivery_fee_cents: integration.fixed_delivery_fee_cents || 4000, // Rs. 40
        tracking_url: `https://swiggy.com/track/SWGY-${Date.now()}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async cancelDelivery(deliveryPartnerId: string, integration: DeliveryIntegration): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      // Call Swiggy cancellation API
      // const response = await fetch(`https://api.swiggy.com/v1/delivery/${deliveryPartnerId}/cancel`, {
      //   method: 'POST',
      //   headers: { 'Authorization': `Bearer ${integration.api_key}` },
      // });

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async getDeliveryStatus(deliveryPartnerId: string, integration: DeliveryIntegration): Promise<{
    status: DeliveryStatus;
    delivery_person_name?: string;
    delivery_person_phone?: string;
    tracking_url?: string;
    estimated_delivery_at?: Date;
  }> {
    // Call Swiggy tracking API
    // const response = await fetch(`https://api.swiggy.com/v1/delivery/${deliveryPartnerId}`, {
    //   headers: { 'Authorization': `Bearer ${integration.api_key}` },
    // });

    // Stubbed response
    return {
      status: 'en_route',
      delivery_person_name: 'Rajesh Kumar',
      delivery_person_phone: '9876543210',
      tracking_url: `https://swiggy.com/track/${deliveryPartnerId}`,
      estimated_delivery_at: new Date(Date.now() + 30 * 60 * 1000),
    };
  }
}

/**
 * Zomato Delivery Service
 */
export class ZomatoDeliveryService implements IDeliveryService {
  provider: DeliveryProvider = 'zomato';

  async createDelivery(order: Order, integration: DeliveryIntegration): Promise<{
    success: boolean;
    delivery_partner_id?: string;
    estimated_pickup_at?: Date;
    estimated_delivery_at?: Date;
    delivery_fee_cents?: number;
    tracking_url?: string;
    error?: string;
  }> {
    try {
      // Stubbed implementation for Zomato
      const now = new Date();
      const pickupTime = new Date(now.getTime() + 20 * 60 * 1000); // 20 min
      const deliveryTime = new Date(now.getTime() + 50 * 60 * 1000); // 50 min

      return {
        success: true,
        delivery_partner_id: `ZMTO-${Date.now()}`,
        estimated_pickup_at: pickupTime,
        estimated_delivery_at: deliveryTime,
        delivery_fee_cents: integration.fixed_delivery_fee_cents || 5000, // Rs. 50
        tracking_url: `https://zomato.com/track/ZMTO-${Date.now()}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async cancelDelivery(deliveryPartnerId: string, integration: DeliveryIntegration): Promise<{
    success: boolean;
    error?: string;
  }> {
    return { success: true };
  }

  async getDeliveryStatus(deliveryPartnerId: string, integration: DeliveryIntegration): Promise<{
    status: DeliveryStatus;
    delivery_person_name?: string;
    delivery_person_phone?: string;
    tracking_url?: string;
    estimated_delivery_at?: Date;
  }> {
    return {
      status: 'picked_up',
      delivery_person_name: 'Amit Singh',
      delivery_person_phone: '9123456789',
      tracking_url: `https://zomato.com/track/${deliveryPartnerId}`,
      estimated_delivery_at: new Date(Date.now() + 25 * 60 * 1000),
    };
  }
}

/**
 * Dunzo Delivery Service
 */
export class DunzoDeliveryService implements IDeliveryService {
  provider: DeliveryProvider = 'dunzo';

  async createDelivery(order: Order, integration: DeliveryIntegration): Promise<{
    success: boolean;
    delivery_partner_id?: string;
    estimated_pickup_at?: Date;
    estimated_delivery_at?: Date;
    delivery_fee_cents?: number;
    tracking_url?: string;
    error?: string;
  }> {
    try {
      // Stubbed implementation for Dunzo
      const now = new Date();
      const pickupTime = new Date(now.getTime() + 10 * 60 * 1000); // 10 min
      const deliveryTime = new Date(now.getTime() + 35 * 60 * 1000); // 35 min

      return {
        success: true,
        delivery_partner_id: `DNZO-${Date.now()}`,
        estimated_pickup_at: pickupTime,
        estimated_delivery_at: deliveryTime,
        delivery_fee_cents: integration.fixed_delivery_fee_cents || 3500, // Rs. 35
        tracking_url: `https://dunzo.com/track/DNZO-${Date.now()}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async cancelDelivery(deliveryPartnerId: string, integration: DeliveryIntegration): Promise<{
    success: boolean;
    error?: string;
  }> {
    return { success: true };
  }

  async getDeliveryStatus(deliveryPartnerId: string, integration: DeliveryIntegration): Promise<{
    status: DeliveryStatus;
    delivery_person_name?: string;
    delivery_person_phone?: string;
    tracking_url?: string;
    estimated_delivery_at?: Date;
  }> {
    return {
      status: 'assigned',
      delivery_person_name: 'Priya Sharma',
      delivery_person_phone: '9988776655',
      tracking_url: `https://dunzo.com/track/${deliveryPartnerId}`,
      estimated_delivery_at: new Date(Date.now() + 20 * 60 * 1000),
    };
  }
}

/**
 * Delivery Service
 * Orchestrates delivery operations with retry logic
 */
export class DeliveryService {
  private integrationRepository: Repository<DeliveryIntegration>;
  private trackingRepository: Repository<DeliveryTracking>;
  private ratingRepository: Repository<DeliveryRating>;
  private orderRepository: Repository<Order>;
  private services: Map<DeliveryProvider, IDeliveryService>;

  constructor() {
    this.integrationRepository = AppDataSource.getRepository(DeliveryIntegration);
    this.trackingRepository = AppDataSource.getRepository(DeliveryTracking);
    this.ratingRepository = AppDataSource.getRepository(DeliveryRating);
    this.orderRepository = AppDataSource.getRepository(Order);

    // Initialize delivery services
    this.services = new Map();
    this.services.set('swiggy', new SwiggyDeliveryService());
    this.services.set('zomato', new ZomatoDeliveryService());
    this.services.set('dunzo', new DunzoDeliveryService());
  }

  /**
   * Get delivery integration for a business
   */
  async getIntegration(businessId: string): Promise<DeliveryIntegration | null> {
    return this.integrationRepository.findOne({
      where: { business_id: businessId, is_active: true },
    });
  }

  /**
   * Create delivery integration
   */
  async createIntegration(
    businessId: string,
    provider: DeliveryProvider,
    options: {
      api_key?: string;
      api_secret?: string;
      partner_account_id?: string;
      cost_handling?: DeliveryCostHandling;
      fixed_delivery_fee_cents?: number;
      auto_assign_delivery?: boolean;
      pickup_instructions?: string;
    }
  ): Promise<DeliveryIntegration> {
    // Deactivate existing integration if any
    const existing = await this.integrationRepository.findOne({
      where: { business_id: businessId },
    });

    if (existing) {
      existing.is_active = false;
      await this.integrationRepository.save(existing);
    }

    // Create new integration
    const integration = this.integrationRepository.create({
      business_id: businessId,
      provider,
      api_key: options.api_key,
      api_secret: options.api_secret,
      partner_account_id: options.partner_account_id,
      cost_handling: options.cost_handling || 'customer',
      fixed_delivery_fee_cents: options.fixed_delivery_fee_cents,
      auto_assign_delivery: options.auto_assign_delivery !== false,
      pickup_instructions: options.pickup_instructions,
      is_active: true,
    });

    await this.integrationRepository.save(integration);

    return integration;
  }

  /**
   * Disconnect delivery integration
   */
  async disconnectIntegration(businessId: string): Promise<void> {
    const integration = await this.integrationRepository.findOne({
      where: { business_id: businessId, is_active: true },
    });

    if (integration) {
      integration.is_active = false;
      await this.integrationRepository.save(integration);
    }
  }

  /**
   * Create delivery for an order
   */
  async createDelivery(orderId: string): Promise<DeliveryTracking> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
    });

    if (!order) {
      throw new Error('Order not found');
    }

    const integration = await this.getIntegration(order.business_id);

    if (!integration) {
      throw new Error('No active delivery integration found');
    }

    // Check if delivery already exists
    const existing = await this.trackingRepository.findOne({
      where: { order_id: orderId },
    });

    if (existing) {
      throw new Error('Delivery already created for this order');
    }

    // Create delivery tracking record
    const tracking = this.trackingRepository.create({
      delivery_integration_id: integration.id,
      order_id: orderId,
      provider: integration.provider,
      status: 'pending',
    });

    await this.trackingRepository.save(tracking);

    // Attempt to create delivery with partner
    await this.attemptDeliveryCreation(tracking, order, integration);

    return tracking;
  }

  /**
   * Attempt to create delivery with partner
   */
  private async attemptDeliveryCreation(
    tracking: DeliveryTracking,
    order: Order,
    integration: DeliveryIntegration
  ): Promise<void> {
    try {
      const service = this.services.get(integration.provider);

      if (!service) {
        throw new Error(`Unsupported delivery provider: ${integration.provider}`);
      }

      // Create delivery request
      const result = await service.createDelivery(order, integration);

      if (result.success) {
        // Success
        tracking.status = 'assigned';
        tracking.delivery_partner_id = result.delivery_partner_id;
        tracking.estimated_pickup_at = result.estimated_pickup_at;
        tracking.estimated_delivery_at = result.estimated_delivery_at;
        tracking.delivery_fee_cents = result.delivery_fee_cents;
        tracking.tracking_url = result.tracking_url;

        // Add to status history
        tracking.status_history = [
          {
            status: 'assigned',
            timestamp: new Date(),
            message: 'Delivery assigned successfully',
          },
        ];

        // Update integration
        integration.last_delivery_at = new Date();
        integration.total_deliveries += 1;
        integration.last_error = null;

        await this.integrationRepository.save(integration);
      } else {
        // Failed
        throw new Error(result.error || 'Delivery creation failed');
      }
    } catch (error) {
      // Handle failure
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      tracking.status = 'failed';
      tracking.error_message = errorMessage;
      tracking.attempt_count += 1;

      // Add to status history
      tracking.status_history = [
        {
          status: 'failed',
          timestamp: new Date(),
          message: errorMessage,
        },
      ];

      // Update integration error count
      integration.failure_count += 1;
      integration.last_error = errorMessage;

      await this.integrationRepository.save(integration);
    }

    await this.trackingRepository.save(tracking);
  }

  /**
   * Update delivery status (called by webhook or polling)
   */
  async updateDeliveryStatus(
    trackingId: string,
    status: DeliveryStatus,
    details?: {
      delivery_person_name?: string;
      delivery_person_phone?: string;
      picked_up_at?: Date;
      delivered_at?: Date;
      message?: string;
    }
  ): Promise<DeliveryTracking> {
    const tracking = await this.trackingRepository.findOne({
      where: { id: trackingId },
    });

    if (!tracking) {
      throw new Error('Delivery tracking not found');
    }

    // Update status
    tracking.status = status;

    if (details?.delivery_person_name) {
      tracking.delivery_person_name = details.delivery_person_name;
    }

    if (details?.delivery_person_phone) {
      tracking.delivery_person_phone = details.delivery_person_phone;
    }

    if (details?.picked_up_at) {
      tracking.picked_up_at = details.picked_up_at;
    }

    if (details?.delivered_at) {
      tracking.delivered_at = details.delivered_at;
    }

    // Add to status history
    const history = tracking.status_history || [];
    history.push({
      status,
      timestamp: new Date(),
      message: details?.message,
    });
    tracking.status_history = history;

    await this.trackingRepository.save(tracking);

    return tracking;
  }

  /**
   * Cancel delivery
   */
  async cancelDelivery(trackingId: string, reason: string): Promise<DeliveryTracking> {
    const tracking = await this.trackingRepository.findOne({
      where: { id: trackingId },
      relations: ['delivery_integration'],
    });

    if (!tracking) {
      throw new Error('Delivery tracking not found');
    }

    if (!tracking.delivery_partner_id) {
      throw new Error('Delivery not yet assigned to partner');
    }

    const service = this.services.get(tracking.provider);

    if (!service) {
      throw new Error(`Unsupported delivery provider: ${tracking.provider}`);
    }

    // Cancel with partner
    const result = await service.cancelDelivery(
      tracking.delivery_partner_id,
      tracking.delivery_integration
    );

    if (result.success) {
      tracking.status = 'cancelled';
      tracking.cancellation_reason = reason;

      // Add to status history
      const history = tracking.status_history || [];
      history.push({
        status: 'cancelled',
        timestamp: new Date(),
        message: `Cancelled: ${reason}`,
      });
      tracking.status_history = history;

      await this.trackingRepository.save(tracking);
    } else {
      throw new Error(result.error || 'Cancellation failed');
    }

    return tracking;
  }

  /**
   * Get delivery tracking for an order
   */
  async getDeliveryTracking(orderId: string): Promise<DeliveryTracking | null> {
    return this.trackingRepository.findOne({
      where: { order_id: orderId },
      relations: ['delivery_integration'],
    });
  }

  /**
   * Submit delivery rating
   */
  async submitDeliveryRating(
    trackingId: string,
    customerId: string,
    data: {
      rating: number;
      feedback?: string;
      timeliness_rating?: number;
      courtesy_rating?: number;
      packaging_rating?: number;
      issues?: string[];
    }
  ): Promise<DeliveryRating> {
    // Validate rating
    if (data.rating < 1 || data.rating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }

    const tracking = await this.trackingRepository.findOne({
      where: { id: trackingId },
    });

    if (!tracking) {
      throw new Error('Delivery tracking not found');
    }

    // Check if delivery is completed
    if (tracking.status !== 'delivered') {
      throw new Error('Can only rate completed deliveries');
    }

    // Check if rating already exists
    const existing = await this.ratingRepository.findOne({
      where: { delivery_tracking_id: trackingId },
    });

    if (existing) {
      throw new Error('Delivery already rated');
    }

    // Create rating
    const rating = this.ratingRepository.create({
      delivery_tracking_id: trackingId,
      order_id: tracking.order_id,
      customer_id: customerId,
      provider: tracking.provider,
      rating: data.rating,
      feedback: data.feedback,
      timeliness_rating: data.timeliness_rating,
      courtesy_rating: data.courtesy_rating,
      packaging_rating: data.packaging_rating,
      issues: data.issues || [],
    });

    await this.ratingRepository.save(rating);

    return rating;
  }

  /**
   * Get delivery statistics for a business
   */
  async getDeliveryStats(businessId: string): Promise<{
    total_deliveries: number;
    successful_deliveries: number;
    cancelled_deliveries: number;
    failed_deliveries: number;
    average_rating: number;
    success_rate: number;
  }> {
    const integration = await this.integrationRepository.findOne({
      where: { business_id: businessId },
    });

    if (!integration) {
      return {
        total_deliveries: 0,
        successful_deliveries: 0,
        cancelled_deliveries: 0,
        failed_deliveries: 0,
        average_rating: 0,
        success_rate: 0,
      };
    }

    const allTracking = await this.trackingRepository.find({
      where: { delivery_integration_id: integration.id },
    });

    const successfulDeliveries = allTracking.filter((t) => t.status === 'delivered').length;
    const cancelledDeliveries = allTracking.filter((t) => t.status === 'cancelled').length;
    const failedDeliveries = allTracking.filter((t) => t.status === 'failed').length;
    const totalDeliveries = allTracking.length;

    const successRate = totalDeliveries > 0 ? (successfulDeliveries / totalDeliveries) * 100 : 0;

    // Get average rating
    const ratings = await this.ratingRepository
      .createQueryBuilder('rating')
      .innerJoin('rating.delivery_tracking', 'tracking')
      .where('tracking.delivery_integration_id = :integrationId', {
        integrationId: integration.id,
      })
      .getMany();

    const averageRating =
      ratings.length > 0
        ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length
        : 0;

    return {
      total_deliveries: totalDeliveries,
      successful_deliveries: successfulDeliveries,
      cancelled_deliveries: cancelledDeliveries,
      failed_deliveries: failedDeliveries,
      average_rating: Math.round(averageRating * 10) / 10,
      success_rate: Math.round(successRate * 10) / 10,
    };
  }
}
