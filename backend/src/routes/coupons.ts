import { FastifyPluginAsync } from 'fastify';
import { CouponService } from '../services/CouponService.js';
import { authenticate } from '../middleware/auth.js';
import { CouponStatus } from '../models/Coupon.js';

const couponService = new CouponService();

export const couponRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * Create coupon
   * POST /coupons
   */
  fastify.post(
    '/',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Create coupon',
        tags: ['coupons'],
        body: {
          type: 'object',
          required: [
            'business_id',
            'code',
            'name',
            'discount_type',
            'discount_value',
            'valid_from',
            'valid_until',
          ],
          properties: {
            business_id: { type: 'string', format: 'uuid' },
            code: { type: 'string', maxLength: 50 },
            name: { type: 'string', maxLength: 255 },
            description: { type: 'string' },
            discount_type: { type: 'string', enum: ['fixed', 'percentage'] },
            discount_value: { type: 'integer', minimum: 0 },
            max_discount_cents: { type: 'integer', minimum: 0 },
            min_order_value_cents: { type: 'integer', minimum: 0 },
            valid_from: { type: 'string', format: 'date-time' },
            valid_until: { type: 'string', format: 'date-time' },
            usage_limit_type: {
              type: 'string',
              enum: ['per_customer', 'per_month', 'unlimited', 'total_limit'],
            },
            usage_limit_per_customer: { type: 'integer', minimum: 1 },
            usage_limit_per_month: { type: 'integer', minimum: 1 },
            total_usage_limit: { type: 'integer', minimum: 1 },
            applicable_to: { type: 'string', enum: ['all_dishes', 'specific_dishes'] },
            dish_ids: { type: 'array', items: { type: 'string', format: 'uuid' } },
            is_public: { type: 'boolean' },
          },
        },
      },
    },
    async (request, reply) => {
      const data = request.body as any;

      try {
        const coupon = await couponService.createCoupon(data.business_id, data);

        return {
          success: true,
          data: { coupon },
          message: 'Coupon created successfully',
        };
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({
          success: false,
          error: {
            code: 'COUPON_CREATION_ERROR',
            message: error instanceof Error ? error.message : 'Failed to create coupon',
          },
        });
      }
    }
  );

  /**
   * Get business coupons
   * GET /coupons/business/:businessId
   */
  fastify.get(
    '/business/:businessId',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get business coupons',
        tags: ['coupons'],
        params: {
          type: 'object',
          required: ['businessId'],
          properties: {
            businessId: { type: 'string', format: 'uuid' },
          },
        },
        querystring: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['active', 'expired', 'archived'] },
            is_public: { type: 'boolean' },
          },
        },
      },
    },
    async (request, reply) => {
      const { businessId } = request.params as { businessId: string };
      const filters = request.query as { status?: CouponStatus; is_public?: boolean };

      try {
        const coupons = await couponService.getBusinessCoupons(businessId, filters);

        return {
          success: true,
          data: { coupons },
        };
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({
          success: false,
          error: {
            code: 'COUPON_FETCH_ERROR',
            message: 'Failed to get coupons',
          },
        });
      }
    }
  );

  /**
   * Get public coupons (for menu display)
   * GET /coupons/public/:businessId
   */
  fastify.get(
    '/public/:businessId',
    {
      schema: {
        description: 'Get public coupons for menu display',
        tags: ['coupons'],
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
        const coupons = await couponService.getPublicCoupons(businessId);

        return {
          success: true,
          data: { coupons },
        };
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({
          success: false,
          error: {
            code: 'COUPON_FETCH_ERROR',
            message: 'Failed to get public coupons',
          },
        });
      }
    }
  );

  /**
   * Validate coupon
   * POST /coupons/validate
   */
  fastify.post(
    '/validate',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Validate coupon for order',
        tags: ['coupons'],
        body: {
          type: 'object',
          required: ['coupon_code', 'business_id', 'order_subtotal_cents', 'dish_ids'],
          properties: {
            coupon_code: { type: 'string' },
            business_id: { type: 'string', format: 'uuid' },
            order_subtotal_cents: { type: 'integer', minimum: 0 },
            dish_ids: { type: 'array', items: { type: 'string', format: 'uuid' } },
          },
        },
      },
    },
    async (request, reply) => {
      const { coupon_code, business_id, order_subtotal_cents, dish_ids } = request.body as {
        coupon_code: string;
        business_id: string;
        order_subtotal_cents: number;
        dish_ids: string[];
      };

      try {
        const customerId = (request.user as any).id;

        const result = await couponService.validateCoupon(
          coupon_code,
          customerId,
          business_id,
          order_subtotal_cents,
          dish_ids
        );

        if (!result.valid) {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'INVALID_COUPON',
              message: result.error,
            },
          });
        }

        return {
          success: true,
          data: {
            valid: true,
            discount_amount_cents: result.discount_amount_cents,
            discount_amount: (result.discount_amount_cents || 0) / 100,
            coupon: {
              code: result.coupon?.code,
              name: result.coupon?.name,
              description: result.coupon?.description,
            },
          },
          message: 'Coupon is valid',
        };
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({
          success: false,
          error: {
            code: 'COUPON_VALIDATION_ERROR',
            message: 'Failed to validate coupon',
          },
        });
      }
    }
  );

  /**
   * Update coupon
   * PUT /coupons/:id
   */
  fastify.put(
    '/:id',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Update coupon',
        tags: ['coupons'],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        body: {
          type: 'object',
          properties: {
            name: { type: 'string', maxLength: 255 },
            description: { type: 'string' },
            min_order_value_cents: { type: 'integer', minimum: 0 },
            valid_until: { type: 'string', format: 'date-time' },
            is_public: { type: 'boolean' },
            status: { type: 'string', enum: ['active', 'expired', 'archived'] },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const data = request.body as any;

      try {
        const coupon = await couponService.updateCoupon(id, data);

        return {
          success: true,
          data: { coupon },
          message: 'Coupon updated successfully',
        };
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({
          success: false,
          error: {
            code: 'COUPON_UPDATE_ERROR',
            message: error instanceof Error ? error.message : 'Failed to update coupon',
          },
        });
      }
    }
  );

  /**
   * Archive coupon
   * DELETE /coupons/:id
   */
  fastify.delete(
    '/:id',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Archive coupon',
        tags: ['coupons'],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      try {
        await couponService.archiveCoupon(id);

        return {
          success: true,
          message: 'Coupon archived successfully',
        };
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({
          success: false,
          error: {
            code: 'COUPON_ARCHIVE_ERROR',
            message: 'Failed to archive coupon',
          },
        });
      }
    }
  );

  /**
   * Get coupon analytics
   * GET /coupons/:id/analytics
   */
  fastify.get(
    '/:id/analytics',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get coupon analytics',
        tags: ['coupons'],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      try {
        const analytics = await couponService.getCouponAnalytics(id);

        return {
          success: true,
          data: { analytics },
        };
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({
          success: false,
          error: {
            code: 'ANALYTICS_ERROR',
            message: error instanceof Error ? error.message : 'Failed to get analytics',
          },
        });
      }
    }
  );

  /**
   * Get business coupon stats
   * GET /coupons/stats/:businessId
   */
  fastify.get(
    '/stats/:businessId',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get business coupon statistics',
        tags: ['coupons'],
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
        const stats = await couponService.getBusinessCouponStats(businessId);

        return {
          success: true,
          data: { stats },
        };
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({
          success: false,
          error: {
            code: 'STATS_ERROR',
            message: 'Failed to get coupon statistics',
          },
        });
      }
    }
  );

  /**
   * Create automatic promotion
   * POST /promotions
   */
  fastify.post(
    '/promotions',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Create automatic promotion',
        tags: ['promotions'],
        body: {
          type: 'object',
          required: ['business_id', 'name', 'type', 'valid_from', 'valid_until'],
          properties: {
            business_id: { type: 'string', format: 'uuid' },
            name: { type: 'string', maxLength: 255 },
            description: { type: 'string' },
            type: { type: 'string', enum: ['free_delivery', 'discount', 'free_item'] },
            min_order_value_cents: { type: 'integer', minimum: 0 },
            discount_value: { type: 'integer', minimum: 0 },
            discount_type: { type: 'string', enum: ['fixed', 'percentage'] },
            free_dish_id: { type: 'string', format: 'uuid' },
            valid_from: { type: 'string', format: 'date-time' },
            valid_until: { type: 'string', format: 'date-time' },
            is_public: { type: 'boolean' },
          },
        },
      },
    },
    async (request, reply) => {
      const data = request.body as any;

      try {
        const promotion = await couponService.createAutomaticPromotion(data.business_id, data);

        return {
          success: true,
          data: { promotion },
          message: 'Automatic promotion created successfully',
        };
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({
          success: false,
          error: {
            code: 'PROMOTION_CREATION_ERROR',
            message: 'Failed to create promotion',
          },
        });
      }
    }
  );

  /**
   * Get business promotions
   * GET /promotions/business/:businessId
   */
  fastify.get(
    '/promotions/business/:businessId',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get business automatic promotions',
        tags: ['promotions'],
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
        const promotions = await couponService.getActivePromotions(businessId);

        return {
          success: true,
          data: { promotions },
        };
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({
          success: false,
          error: {
            code: 'PROMOTION_FETCH_ERROR',
            message: 'Failed to get promotions',
          },
        });
      }
    }
  );

  /**
   * Check applicable promotions
   * POST /promotions/check
   */
  fastify.post(
    '/promotions/check',
    {
      schema: {
        description: 'Check applicable automatic promotions',
        tags: ['promotions'],
        body: {
          type: 'object',
          required: ['business_id', 'order_value_cents'],
          properties: {
            business_id: { type: 'string', format: 'uuid' },
            order_value_cents: { type: 'integer', minimum: 0 },
          },
        },
      },
    },
    async (request, reply) => {
      const { business_id, order_value_cents } = request.body as {
        business_id: string;
        order_value_cents: number;
      };

      try {
        const promotions = await couponService.checkAutomaticPromotions(
          business_id,
          order_value_cents
        );

        return {
          success: true,
          data: { promotions },
        };
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({
          success: false,
          error: {
            code: 'PROMOTION_CHECK_ERROR',
            message: 'Failed to check promotions',
          },
        });
      }
    }
  );

  /**
   * Update promotion
   * PUT /promotions/:id
   */
  fastify.put(
    '/promotions/:id',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Update automatic promotion',
        tags: ['promotions'],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        body: {
          type: 'object',
          properties: {
            name: { type: 'string', maxLength: 255 },
            description: { type: 'string' },
            min_order_value_cents: { type: 'integer', minimum: 0 },
            valid_until: { type: 'string', format: 'date-time' },
            is_active: { type: 'boolean' },
            is_public: { type: 'boolean' },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const data = request.body as any;

      try {
        const promotion = await couponService.updatePromotion(id, data);

        return {
          success: true,
          data: { promotion },
          message: 'Promotion updated successfully',
        };
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({
          success: false,
          error: {
            code: 'PROMOTION_UPDATE_ERROR',
            message: 'Failed to update promotion',
          },
        });
      }
    }
  );
};
