import { FastifyPluginAsync } from 'fastify';
import { DeliveryService } from '../services/DeliveryService.js';
import { authenticate } from '../middleware/auth.js';
import { DeliveryProvider, DeliveryCostHandling } from '../models/DeliveryIntegration.js';

const deliveryService = new DeliveryService();

export const deliveryRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * Connect delivery provider
   * POST /delivery/connect
   */
  fastify.post(
    '/connect',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Connect delivery provider',
        tags: ['delivery'],
        body: {
          type: 'object',
          required: ['business_id', 'provider'],
          properties: {
            business_id: { type: 'string', format: 'uuid' },
            provider: { type: 'string', enum: ['swiggy', 'zomato', 'dunzo'] },
            api_key: { type: 'string' },
            api_secret: { type: 'string' },
            partner_account_id: { type: 'string' },
            cost_handling: { type: 'string', enum: ['customer', 'seller'] },
            fixed_delivery_fee_cents: { type: 'integer', minimum: 0 },
            auto_assign_delivery: { type: 'boolean' },
            pickup_instructions: { type: 'string', maxLength: 500 },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  integration: { type: 'object' },
                },
              },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const {
        business_id,
        provider,
        api_key,
        api_secret,
        partner_account_id,
        cost_handling,
        fixed_delivery_fee_cents,
        auto_assign_delivery,
        pickup_instructions,
      } = request.body as {
        business_id: string;
        provider: DeliveryProvider;
        api_key?: string;
        api_secret?: string;
        partner_account_id?: string;
        cost_handling?: DeliveryCostHandling;
        fixed_delivery_fee_cents?: number;
        auto_assign_delivery?: boolean;
        pickup_instructions?: string;
      };

      try {
        const integration = await deliveryService.createIntegration(business_id, provider, {
          api_key,
          api_secret,
          partner_account_id,
          cost_handling,
          fixed_delivery_fee_cents,
          auto_assign_delivery,
          pickup_instructions,
        });

        return {
          success: true,
          data: {
            integration: {
              id: integration.id,
              business_id: integration.business_id,
              provider: integration.provider,
              is_active: integration.is_active,
              cost_handling: integration.cost_handling,
              fixed_delivery_fee_cents: integration.fixed_delivery_fee_cents,
              auto_assign_delivery: integration.auto_assign_delivery,
              pickup_instructions: integration.pickup_instructions,
              created_at: integration.created_at,
            },
          },
          message: `${provider} delivery integration connected successfully`,
        };
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({
          success: false,
          error: {
            code: 'DELIVERY_INTEGRATION_ERROR',
            message: error instanceof Error ? error.message : 'Failed to connect delivery integration',
          },
        });
      }
    }
  );

  /**
   * Disconnect delivery integration
   * POST /delivery/disconnect
   */
  fastify.post(
    '/disconnect',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Disconnect delivery integration',
        tags: ['delivery'],
        body: {
          type: 'object',
          required: ['business_id'],
          properties: {
            business_id: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
    async (request, reply) => {
      const { business_id } = request.body as { business_id: string };

      try {
        await deliveryService.disconnectIntegration(business_id);

        return {
          success: true,
          message: 'Delivery integration disconnected successfully',
        };
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({
          success: false,
          error: {
            code: 'DELIVERY_INTEGRATION_ERROR',
            message: 'Failed to disconnect delivery integration',
          },
        });
      }
    }
  );

  /**
   * Get delivery integration settings
   * GET /delivery/integration/:businessId
   */
  fastify.get(
    '/integration/:businessId',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get delivery integration settings',
        tags: ['delivery'],
        params: {
          type: 'object',
          required: ['businessId'],
          properties: {
            businessId: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
    async (request, reply) => {
      const { businessId } = request.params as { businessId: string };

      try {
        const integration = await deliveryService.getIntegration(businessId);

        if (!integration) {
          return reply.status(404).send({
            success: false,
            error: {
              code: 'INTEGRATION_NOT_FOUND',
              message: 'No active delivery integration found',
            },
          });
        }

        return {
          success: true,
          data: {
            integration: {
              id: integration.id,
              provider: integration.provider,
              is_active: integration.is_active,
              cost_handling: integration.cost_handling,
              fixed_delivery_fee_cents: integration.fixed_delivery_fee_cents,
              auto_assign_delivery: integration.auto_assign_delivery,
              pickup_instructions: integration.pickup_instructions,
              last_delivery_at: integration.last_delivery_at,
              total_deliveries: integration.total_deliveries,
              failure_count: integration.failure_count,
              last_error: integration.last_error,
              created_at: integration.created_at,
            },
          },
        };
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({
          success: false,
          error: {
            code: 'DELIVERY_INTEGRATION_ERROR',
            message: 'Failed to get delivery integration',
          },
        });
      }
    }
  );

  /**
   * Create delivery for an order
   * POST /delivery/create/:orderId
   */
  fastify.post(
    '/create/:orderId',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Create delivery for an order',
        tags: ['delivery'],
        params: {
          type: 'object',
          required: ['orderId'],
          properties: {
            orderId: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
    async (request, reply) => {
      const { orderId } = request.params as { orderId: string };

      try {
        const tracking = await deliveryService.createDelivery(orderId);

        return {
          success: true,
          data: {
            tracking: {
              id: tracking.id,
              order_id: tracking.order_id,
              provider: tracking.provider,
              status: tracking.status,
              delivery_partner_id: tracking.delivery_partner_id,
              estimated_pickup_at: tracking.estimated_pickup_at,
              estimated_delivery_at: tracking.estimated_delivery_at,
              delivery_fee_cents: tracking.delivery_fee_cents,
              tracking_url: tracking.tracking_url,
              created_at: tracking.created_at,
            },
          },
          message: 'Delivery created successfully',
        };
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({
          success: false,
          error: {
            code: 'DELIVERY_CREATION_ERROR',
            message: error instanceof Error ? error.message : 'Failed to create delivery',
          },
        });
      }
    }
  );

  /**
   * Get delivery tracking for an order
   * GET /delivery/track/:orderId
   */
  fastify.get(
    '/track/:orderId',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get delivery tracking for an order',
        tags: ['delivery'],
        params: {
          type: 'object',
          required: ['orderId'],
          properties: {
            orderId: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
    async (request, reply) => {
      const { orderId } = request.params as { orderId: string };

      try {
        const tracking = await deliveryService.getDeliveryTracking(orderId);

        if (!tracking) {
          return reply.status(404).send({
            success: false,
            error: {
              code: 'TRACKING_NOT_FOUND',
              message: 'No delivery tracking found for this order',
            },
          });
        }

        return {
          success: true,
          data: {
            tracking: {
              id: tracking.id,
              order_id: tracking.order_id,
              provider: tracking.provider,
              status: tracking.status,
              delivery_partner_id: tracking.delivery_partner_id,
              delivery_person_name: tracking.delivery_person_name,
              delivery_person_phone: tracking.delivery_person_phone,
              estimated_pickup_at: tracking.estimated_pickup_at,
              picked_up_at: tracking.picked_up_at,
              estimated_delivery_at: tracking.estimated_delivery_at,
              delivered_at: tracking.delivered_at,
              delivery_fee_cents: tracking.delivery_fee_cents,
              tracking_url: tracking.tracking_url,
              delivery_instructions: tracking.delivery_instructions,
              cancellation_reason: tracking.cancellation_reason,
              attempt_count: tracking.attempt_count,
              delivery_otp: tracking.delivery_otp,
              status_history: tracking.status_history,
              error_message: tracking.error_message,
              created_at: tracking.created_at,
              updated_at: tracking.updated_at,
            },
          },
        };
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({
          success: false,
          error: {
            code: 'TRACKING_ERROR',
            message: 'Failed to get delivery tracking',
          },
        });
      }
    }
  );

  /**
   * Cancel delivery
   * POST /delivery/cancel/:trackingId
   */
  fastify.post(
    '/cancel/:trackingId',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Cancel delivery',
        tags: ['delivery'],
        params: {
          type: 'object',
          required: ['trackingId'],
          properties: {
            trackingId: { type: 'string', format: 'uuid' },
          },
        },
        body: {
          type: 'object',
          required: ['reason'],
          properties: {
            reason: { type: 'string', maxLength: 500 },
          },
        },
      },
    },
    async (request, reply) => {
      const { trackingId } = request.params as { trackingId: string };
      const { reason } = request.body as { reason: string };

      try {
        const tracking = await deliveryService.cancelDelivery(trackingId, reason);

        return {
          success: true,
          data: {
            tracking: {
              id: tracking.id,
              status: tracking.status,
              cancellation_reason: tracking.cancellation_reason,
              updated_at: tracking.updated_at,
            },
          },
          message: 'Delivery cancelled successfully',
        };
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({
          success: false,
          error: {
            code: 'DELIVERY_CANCELLATION_ERROR',
            message: error instanceof Error ? error.message : 'Failed to cancel delivery',
          },
        });
      }
    }
  );

  /**
   * Submit delivery rating
   * POST /delivery/rating/:trackingId
   */
  fastify.post(
    '/rating/:trackingId',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Submit delivery rating',
        tags: ['delivery'],
        params: {
          type: 'object',
          required: ['trackingId'],
          properties: {
            trackingId: { type: 'string', format: 'uuid' },
          },
        },
        body: {
          type: 'object',
          required: ['rating'],
          properties: {
            rating: { type: 'integer', minimum: 1, maximum: 5 },
            feedback: { type: 'string', maxLength: 500 },
            timeliness_rating: { type: 'integer', minimum: 1, maximum: 5 },
            courtesy_rating: { type: 'integer', minimum: 1, maximum: 5 },
            packaging_rating: { type: 'integer', minimum: 1, maximum: 5 },
            issues: {
              type: 'array',
              items: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { trackingId } = request.params as { trackingId: string };
      const {
        rating,
        feedback,
        timeliness_rating,
        courtesy_rating,
        packaging_rating,
        issues,
      } = request.body as {
        rating: number;
        feedback?: string;
        timeliness_rating?: number;
        courtesy_rating?: number;
        packaging_rating?: number;
        issues?: string[];
      };

      try {
        // Get customer ID from authenticated user
        const customerId = (request.user as any).id;

        const deliveryRating = await deliveryService.submitDeliveryRating(
          trackingId,
          customerId,
          {
            rating,
            feedback,
            timeliness_rating,
            courtesy_rating,
            packaging_rating,
            issues,
          }
        );

        return {
          success: true,
          data: {
            rating: {
              id: deliveryRating.id,
              rating: deliveryRating.rating,
              feedback: deliveryRating.feedback,
              timeliness_rating: deliveryRating.timeliness_rating,
              courtesy_rating: deliveryRating.courtesy_rating,
              packaging_rating: deliveryRating.packaging_rating,
              issues: deliveryRating.issues,
              provider: deliveryRating.provider,
              created_at: deliveryRating.created_at,
            },
          },
          message: 'Delivery rating submitted successfully',
        };
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({
          success: false,
          error: {
            code: 'DELIVERY_RATING_ERROR',
            message: error instanceof Error ? error.message : 'Failed to submit delivery rating',
          },
        });
      }
    }
  );

  /**
   * Get delivery statistics
   * GET /delivery/stats/:businessId
   */
  fastify.get(
    '/stats/:businessId',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get delivery statistics for a business',
        tags: ['delivery'],
        params: {
          type: 'object',
          required: ['businessId'],
          properties: {
            businessId: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
    async (request, reply) => {
      const { businessId } = request.params as { businessId: string };

      try {
        const stats = await deliveryService.getDeliveryStats(businessId);

        return {
          success: true,
          data: {
            stats,
          },
        };
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({
          success: false,
          error: {
            code: 'DELIVERY_STATS_ERROR',
            message: 'Failed to get delivery statistics',
          },
        });
      }
    }
  );
};
