import { FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/auth.js';
import { POSSyncService } from '../services/POSSyncService.js';
import { POSProvider, SyncStatus, POSIntegration } from '../models/POSIntegration.js';
import { Business } from '../models/Business.js';
import { Order } from '../models/Order.js';

/**
 * POS Integration Routes
 * Phase 3 - US3.7: POS System Integration & Order Sync
 *
 * Endpoints:
 * - POST /pos/connect - Connect POS system
 * - POST /pos/disconnect - Disconnect POS system
 * - GET /pos/integration/:businessId - Get integration settings
 * - POST /pos/sync/:orderId - Manually sync order
 * - GET /pos/history/:businessId - Get sync history
 * - GET /pos/stats/:businessId - Get sync statistics
 */
export async function posRoutes(fastify: FastifyInstance): Promise<void> {
  const posSyncService = new POSSyncService();

  /**
   * POST /pos/connect
   * Connect POS system (after OAuth)
   */
  fastify.post<{
    Body: {
      business_id: string;
      provider: POSProvider;
      access_token: string;
      refresh_token?: string;
      token_expires_at?: string;
      location_id?: string;
      merchant_id?: string;
    };
  }>(
    '/connect',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const {
        business_id,
        provider,
        access_token,
        refresh_token,
        token_expires_at,
        location_id,
        merchant_id,
      } = request.body;

      if (!business_id || !provider || !access_token) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'MISSING_PARAMETERS',
            message: 'Business ID, provider, and access token are required',
          },
        });
      }

      // Verify business ownership
      const business = await fastify.orm.manager.findOne(Business, {
        where: { id: business_id },
        select: ['id', 'owner_id'],
      });

      if (!business || business.owner_id !== request.user!.userId) {
        return reply.status(403).send({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'You do not have permission to manage this business',
          },
        });
      }

      const integration = await posSyncService.createIntegration(
        business_id,
        provider,
        access_token,
        {
          refresh_token,
          token_expires_at: token_expires_at ? new Date(token_expires_at) : undefined,
          location_id,
          merchant_id,
        }
      );

      reply.send({
        success: true,
        data: { integration },
        message: `${provider} POS integration connected successfully`,
      });
    }
  );

  /**
   * POST /pos/disconnect
   * Disconnect POS system
   */
  fastify.post<{
    Body: { business_id: string };
  }>(
    '/disconnect',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const { business_id } = request.body;

      if (!business_id) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'MISSING_PARAMETERS',
            message: 'Business ID is required',
          },
        });
      }

      // Verify business ownership
      const business = await fastify.orm.manager.findOne(Business, {
        where: { id: business_id },
        select: ['id', 'owner_id'],
      });

      if (!business || business.owner_id !== request.user!.userId) {
        return reply.status(403).send({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'You do not have permission to manage this business',
          },
        });
      }

      await posSyncService.disconnectIntegration(business_id);

      reply.send({
        success: true,
        message: 'POS integration disconnected successfully',
      });
    }
  );

  /**
   * GET /pos/integration/:businessId
   * Get POS integration settings
   */
  fastify.get<{
    Params: { businessId: string };
  }>(
    '/integration/:businessId',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const { businessId } = request.params;

      // Verify business ownership
      const business = await fastify.orm.manager.findOne(Business, {
        where: { id: businessId },
        select: ['id', 'owner_id'],
      });

      if (!business || business.owner_id !== request.user!.userId) {
        return reply.status(403).send({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'You do not have permission to view this integration',
          },
        });
      }

      const integration = await posSyncService.getIntegration(businessId);

      if (!integration) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'INTEGRATION_NOT_FOUND',
            message: 'No active POS integration found',
          },
        });
      }

      // Don't return sensitive tokens
      const safeIntegration = {
        id: integration.id,
        provider: integration.provider,
        is_active: integration.is_active,
        location_id: integration.location_id,
        merchant_id: integration.merchant_id,
        auto_sync_orders: integration.auto_sync_orders,
        sync_customer_info: integration.sync_customer_info,
        last_sync_at: integration.last_sync_at,
        error_count: integration.error_count,
        last_error: integration.last_error,
        created_at: integration.created_at,
      };

      reply.send({
        success: true,
        data: { integration: safeIntegration },
      });
    }
  );

  /**
   * POST /pos/sync/:orderId
   * Manually trigger order sync to POS
   */
  fastify.post<{
    Params: { orderId: string };
  }>(
    '/sync/:orderId',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      try {
        const { orderId } = request.params;

        // Get order to verify ownership
        const order = await fastify.orm.manager.findOne(Order, {
          where: { id: orderId },
          select: ['id', 'business_id'],
        });

        if (!order) {
          return reply.status(404).send({
            success: false,
            error: {
              code: 'ORDER_NOT_FOUND',
              message: 'Order not found',
            },
          });
        }

        // Verify business ownership
        const business = await fastify.orm.manager.findOne(Business, {
          where: { id: order.business_id },
          select: ['id', 'owner_id'],
        });

        if (!business || business.owner_id !== request.user!.userId) {
          return reply.status(403).send({
            success: false,
            error: {
              code: 'FORBIDDEN',
              message: 'You do not have permission to sync this order',
            },
          });
        }

        const syncLog = await posSyncService.syncOrder(orderId);

        reply.send({
          success: true,
          data: { syncLog },
          message: 'Order sync initiated',
        });
      } catch (error) {
        if (error instanceof Error && error.message.includes('No active POS integration')) {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'NO_POS_INTEGRATION',
              message: error.message,
            },
          });
        }
        throw error;
      }
    }
  );

  /**
   * GET /pos/history/:businessId
   * Get sync history
   */
  fastify.get<{
    Params: { businessId: string };
    Querystring: {
      limit?: number;
      offset?: number;
      status?: SyncStatus;
    };
  }>(
    '/history/:businessId',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const { businessId } = request.params;
      const { limit, offset, status } = request.query;

      // Verify business ownership
      const business = await fastify.orm.manager.findOne(Business, {
        where: { id: businessId },
        select: ['id', 'owner_id'],
      });

      if (!business || business.owner_id !== request.user!.userId) {
        return reply.status(403).send({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'You do not have permission to view this history',
          },
        });
      }

      const { logs, total } = await posSyncService.getSyncHistory(businessId, {
        limit,
        offset,
        status,
      });

      reply.send({
        success: true,
        data: {
          logs,
          total,
          limit: limit || 50,
          offset: offset || 0,
        },
      });
    }
  );

  /**
   * GET /pos/stats/:businessId
   * Get sync statistics
   */
  fastify.get<{
    Params: { businessId: string };
  }>(
    '/stats/:businessId',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const { businessId } = request.params;

      // Verify business ownership
      const business = await fastify.orm.manager.findOne(Business, {
        where: { id: businessId },
        select: ['id', 'owner_id'],
      });

      if (!business || business.owner_id !== request.user!.userId) {
        return reply.status(403).send({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'You do not have permission to view these statistics',
          },
        });
      }

      const stats = await posSyncService.getSyncStats(businessId);

      reply.send({
        success: true,
        data: { stats },
      });
    }
  );
}
