import { Repository, LessThan } from 'typeorm';
import { AppDataSource } from '../config/database.js';
import { POSIntegration, POSSyncLog, POSProvider, SyncStatus } from '../models/POSIntegration.js';
import { Order } from '../models/Order.js';

/**
 * POS Service Interface
 * All POS providers must implement this interface
 */
export interface IPOSService {
  provider: POSProvider;

  /**
   * Create order in POS system
   */
  createOrder(order: Order, integration: POSIntegration): Promise<{
    success: boolean;
    pos_order_id?: string;
    error?: string;
  }>;

  /**
   * Refresh OAuth access token
   */
  refreshAccessToken(integration: POSIntegration): Promise<{
    access_token: string;
    refresh_token?: string;
    expires_at?: Date;
  }>;
}

/**
 * Square POS Service
 */
export class SquarePOSService implements IPOSService {
  provider: POSProvider = 'square';

  async createOrder(order: Order, integration: POSIntegration): Promise<{
    success: boolean;
    pos_order_id?: string;
    error?: string;
  }> {
    try {
      // Build Square order payload
      const lineItems = order.items?.map((item) => ({
        name: item.dish_name,
        quantity: item.quantity.toString(),
        base_price_money: {
          amount: item.unit_price_cents,
          currency: order.currency,
        },
        note: item.special_instructions || undefined,
      })) || [];

      const payload = {
        idempotency_key: order.id, // Use order ID for idempotency
        order: {
          location_id: integration.location_id,
          line_items: lineItems,
          customer_id: integration.sync_customer_info ? order.customer_id : undefined,
          reference_id: order.id,
          metadata: {
            source: 'MenuMaker',
            menumaker_order_id: order.id,
          },
        },
      };

      // Call Square API (stubbed - would use actual Square SDK)
      // const response = await fetch('https://connect.squareup.com/v2/orders', {
      //   method: 'POST',
      //   headers: {
      //     'Authorization': `Bearer ${integration.access_token}`,
      //     'Content-Type': 'application/json',
      //     'Square-Version': '2023-10-18',
      //   },
      //   body: JSON.stringify(payload),
      // });

      // Simulate success for demo
      return {
        success: true,
        pos_order_id: `SQ-${Date.now()}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async refreshAccessToken(integration: POSIntegration): Promise<{
    access_token: string;
    refresh_token?: string;
    expires_at?: Date;
  }> {
    // Implement OAuth token refresh for Square
    // const response = await fetch('https://connect.squareup.com/oauth2/token', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({
    //     client_id: process.env.SQUARE_CLIENT_ID,
    //     client_secret: process.env.SQUARE_CLIENT_SECRET,
    //     grant_type: 'refresh_token',
    //     refresh_token: integration.refresh_token,
    //   }),
    // });

    throw new Error('Token refresh not implemented');
  }
}

/**
 * Dine POS Service (Stubbed)
 */
export class DinePOSService implements IPOSService {
  provider: POSProvider = 'dine';

  async createOrder(order: Order, integration: POSIntegration): Promise<{
    success: boolean;
    pos_order_id?: string;
    error?: string;
  }> {
    // Stub implementation
    return {
      success: true,
      pos_order_id: `DINE-${Date.now()}`,
    };
  }

  async refreshAccessToken(integration: POSIntegration): Promise<{
    access_token: string;
    refresh_token?: string;
    expires_at?: Date;
  }> {
    throw new Error('Token refresh not implemented');
  }
}

/**
 * Zoho POS Service (Stubbed)
 */
export class ZohoPOSService implements IPOSService {
  provider: POSProvider = 'zoho';

  async createOrder(order: Order, integration: POSIntegration): Promise<{
    success: boolean;
    pos_order_id?: string;
    error?: string;
  }> {
    // Stub implementation
    return {
      success: true,
      pos_order_id: `ZOHO-${Date.now()}`,
    };
  }

  async refreshAccessToken(integration: POSIntegration): Promise<{
    access_token: string;
    refresh_token?: string;
    expires_at?: Date;
  }> {
    throw new Error('Token refresh not implemented');
  }
}

/**
 * POS Sync Service
 * Orchestrates POS syncing with retry logic
 */
export class POSSyncService {
  private integrationRepository: Repository<POSIntegration>;
  private syncLogRepository: Repository<POSSyncLog>;
  private orderRepository: Repository<Order>;
  private services: Map<POSProvider, IPOSService>;

  constructor() {
    this.integrationRepository = AppDataSource.getRepository(POSIntegration);
    this.syncLogRepository = AppDataSource.getRepository(POSSyncLog);
    this.orderRepository = AppDataSource.getRepository(Order);

    // Initialize POS services
    this.services = new Map();
    this.services.set('square', new SquarePOSService());
    this.services.set('dine', new DinePOSService());
    this.services.set('zoho', new ZohoPOSService());
  }

  /**
   * Get POS integration for a business
   */
  async getIntegration(businessId: string): Promise<POSIntegration | null> {
    return this.integrationRepository.findOne({
      where: { business_id: businessId, is_active: true },
    });
  }

  /**
   * Create POS integration
   */
  async createIntegration(
    businessId: string,
    provider: POSProvider,
    accessToken: string,
    options?: {
      refresh_token?: string;
      token_expires_at?: Date;
      location_id?: string;
      merchant_id?: string;
    }
  ): Promise<POSIntegration> {
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
      access_token: accessToken,
      refresh_token: options?.refresh_token,
      token_expires_at: options?.token_expires_at,
      location_id: options?.location_id,
      merchant_id: options?.merchant_id,
      is_active: true,
    });

    await this.integrationRepository.save(integration);

    return integration;
  }

  /**
   * Disconnect POS integration
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
   * Sync order to POS
   */
  async syncOrder(orderId: string): Promise<POSSyncLog> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['items'],
    });

    if (!order) {
      throw new Error('Order not found');
    }

    const integration = await this.getIntegration(order.business_id);

    if (!integration) {
      throw new Error('No active POS integration found');
    }

    // Create sync log
    const syncLog = this.syncLogRepository.create({
      pos_integration_id: integration.id,
      order_id: orderId,
      provider: integration.provider,
      status: 'pending',
    });

    await this.syncLogRepository.save(syncLog);

    // Attempt sync
    await this.attemptSync(syncLog, order, integration);

    return syncLog;
  }

  /**
   * Attempt to sync an order
   */
  private async attemptSync(
    syncLog: POSSyncLog,
    order: Order,
    integration: POSIntegration
  ): Promise<void> {
    const startTime = Date.now();

    try {
      syncLog.status = 'syncing';
      await this.syncLogRepository.save(syncLog);

      const service = this.services.get(integration.provider);

      if (!service) {
        throw new Error(`Unsupported POS provider: ${integration.provider}`);
      }

      // Attempt to create order in POS
      const result = await service.createOrder(order, integration);

      if (result.success) {
        // Success
        syncLog.status = 'success';
        syncLog.pos_order_id = result.pos_order_id;
        syncLog.completed_at = new Date();
        syncLog.duration_ms = Date.now() - startTime;

        // Update integration
        integration.last_sync_at = new Date();
        integration.error_count = 0;
        integration.last_error = null;

        await this.integrationRepository.save(integration);
      } else {
        // Failed
        throw new Error(result.error || 'POS sync failed');
      }
    } catch (error) {
      // Handle failure
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      syncLog.status = syncLog.retry_count < syncLog.max_retries ? 'retry' : 'failed';
      syncLog.error_message = errorMessage;
      syncLog.retry_count += 1;
      syncLog.duration_ms = Date.now() - startTime;

      if (syncLog.status === 'retry') {
        // Schedule next retry (5 minutes)
        const nextRetry = new Date();
        nextRetry.setMinutes(nextRetry.getMinutes() + 5);
        syncLog.next_retry_at = nextRetry;
      } else {
        // Max retries reached
        syncLog.completed_at = new Date();
      }

      // Update integration error count
      integration.error_count += 1;
      integration.last_error = errorMessage;

      await this.integrationRepository.save(integration);
    }

    await this.syncLogRepository.save(syncLog);
  }

  /**
   * Process pending retries (called by cron)
   */
  async processPendingRetries(): Promise<number> {
    const now = new Date();

    const pendingRetries = await this.syncLogRepository.find({
      where: {
        status: 'retry',
        next_retry_at: LessThan(now),
      },
      relations: ['pos_integration', 'order'],
    });

    for (const syncLog of pendingRetries) {
      if (syncLog.order && syncLog.pos_integration.is_active) {
        await this.attemptSync(syncLog, syncLog.order, syncLog.pos_integration);
      }
    }

    return pendingRetries.length;
  }

  /**
   * Get sync history for a business
   */
  async getSyncHistory(
    businessId: string,
    options?: {
      limit?: number;
      offset?: number;
      status?: SyncStatus;
    }
  ): Promise<{ logs: POSSyncLog[]; total: number }> {
    const integration = await this.integrationRepository.findOne({
      where: { business_id: businessId },
    });

    if (!integration) {
      return { logs: [], total: 0 };
    }

    const where: any = { pos_integration_id: integration.id };

    if (options?.status) {
      where.status = options.status;
    }

    const [logs, total] = await this.syncLogRepository.findAndCount({
      where,
      order: { created_at: 'DESC' },
      take: options?.limit || 50,
      skip: options?.offset || 0,
    });

    return { logs, total };
  }

  /**
   * Get sync statistics for a business
   */
  async getSyncStats(businessId: string): Promise<{
    total_syncs: number;
    successful_syncs: number;
    failed_syncs: number;
    pending_retries: number;
    success_rate: number;
  }> {
    const integration = await this.integrationRepository.findOne({
      where: { business_id: businessId },
    });

    if (!integration) {
      return {
        total_syncs: 0,
        successful_syncs: 0,
        failed_syncs: 0,
        pending_retries: 0,
        success_rate: 0,
      };
    }

    const allLogs = await this.syncLogRepository.find({
      where: { pos_integration_id: integration.id },
    });

    const successfulSyncs = allLogs.filter((log) => log.status === 'success').length;
    const failedSyncs = allLogs.filter((log) => log.status === 'failed').length;
    const pendingRetries = allLogs.filter((log) => log.status === 'retry').length;
    const totalSyncs = allLogs.length;

    const successRate = totalSyncs > 0 ? (successfulSyncs / totalSyncs) * 100 : 0;

    return {
      total_syncs: totalSyncs,
      successful_syncs: successfulSyncs,
      failed_syncs: failedSyncs,
      pending_retries: pendingRetries,
      success_rate: Math.round(successRate * 10) / 10,
    };
  }
}
