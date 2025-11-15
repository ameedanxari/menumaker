import { FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/auth.js';
import { PayoutService } from '../services/PayoutService.js';
import { PayoutFrequency } from '../models/Payout.js';

/**
 * Payout Routes
 * Phase 3: Automated Tiered Payouts (US3.2)
 *
 * Endpoints:
 * - GET /payouts - List payout history
 * - GET /payouts/:id - Get payout details
 * - GET /payouts/schedule - Get payout schedule configuration
 * - PUT /payouts/schedule - Update payout schedule
 * - POST /payouts/schedule/hold - Hold/unhold automatic payouts
 * - POST /payouts/:id/retry - Manually retry failed payout
 */
export async function payoutRoutes(fastify: FastifyInstance): Promise<void> {
  const payoutService = new PayoutService();

  /**
   * GET /payouts
   * Get payout history for authenticated seller
   */
  fastify.get<{
    Querystring: {
      businessId: string;
      processorId?: string;
      startDate?: string;
      endDate?: string;
      status?: string;
      limit?: number;
      offset?: number;
    };
  }>(
    '/',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      try {
        const { businessId, processorId, startDate, endDate, status, limit, offset } = request.query;

        if (!businessId) {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'MISSING_BUSINESS_ID',
              message: 'Business ID is required',
            },
          });
        }

        // Verify business ownership
        const business = await fastify.orm.manager.findOne('Business', {
          where: { id: businessId },
        });

        if (!business || business.owner_id !== request.user!.userId) {
          return reply.status(403).send({
            success: false,
            error: {
              code: 'FORBIDDEN',
              message: 'You do not have permission to view these payouts',
            },
          });
        }

        // Get payout history
        const { payouts, total } = await payoutService.getPayoutHistory(businessId, {
          processorId,
          startDate: startDate ? new Date(startDate) : undefined,
          endDate: endDate ? new Date(endDate) : undefined,
          status: status as any,
          limit,
          offset,
        });

        reply.send({
          success: true,
          data: {
            payouts,
            total,
            limit: limit || 50,
            offset: offset || 0,
          },
        });
      } catch (error) {
        throw error;
      }
    }
  );

  /**
   * GET /payouts/:id
   * Get payout details by ID
   */
  fastify.get<{
    Params: { id: string };
  }>(
    '/:id',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      try {
        const { id } = request.params;

        const payout = await fastify.orm.manager.findOne('Payout', {
          where: { id },
          relations: ['payment_processor', 'business'],
        });

        if (!payout) {
          return reply.status(404).send({
            success: false,
            error: {
              code: 'PAYOUT_NOT_FOUND',
              message: 'Payout not found',
            },
          });
        }

        // Verify business ownership
        if (payout.business.owner_id !== request.user!.userId) {
          return reply.status(403).send({
            success: false,
            error: {
              code: 'FORBIDDEN',
              message: 'You do not have permission to view this payout',
            },
          });
        }

        reply.send({
          success: true,
          data: { payout },
        });
      } catch (error) {
        throw error;
      }
    }
  );

  /**
   * GET /payouts/schedule
   * Get payout schedule configuration
   */
  fastify.get<{
    Querystring: {
      businessId: string;
      processorId: string;
    };
  }>(
    '/schedule',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      try {
        const { businessId, processorId } = request.query;

        if (!businessId || !processorId) {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'MISSING_PARAMETERS',
              message: 'Business ID and Processor ID are required',
            },
          });
        }

        // Verify business ownership
        const business = await fastify.orm.manager.findOne('Business', {
          where: { id: businessId },
        });

        if (!business || business.owner_id !== request.user!.userId) {
          return reply.status(403).send({
            success: false,
            error: {
              code: 'FORBIDDEN',
              message: 'You do not have permission to view this schedule',
            },
          });
        }

        // Get or create schedule
        const schedule = await payoutService.getOrCreateSchedule(businessId, processorId);

        reply.send({
          success: true,
          data: { schedule },
        });
      } catch (error) {
        throw error;
      }
    }
  );

  /**
   * PUT /payouts/schedule
   * Update payout schedule configuration
   */
  fastify.put<{
    Body: {
      scheduleId: string;
      frequency?: PayoutFrequency;
      min_payout_threshold_cents?: number;
      max_hold_period_days?: number;
      weekly_day_of_week?: number;
      monthly_day_of_month?: number;
      email_notifications_enabled?: boolean;
      notification_email?: string;
    };
  }>(
    '/schedule',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      try {
        const { scheduleId, ...updates } = request.body;

        if (!scheduleId) {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'MISSING_SCHEDULE_ID',
              message: 'Schedule ID is required',
            },
          });
        }

        // Get schedule and verify ownership
        const schedule = await fastify.orm.manager.findOne('PayoutSchedule', {
          where: { id: scheduleId },
          relations: ['business'],
        });

        if (!schedule) {
          return reply.status(404).send({
            success: false,
            error: {
              code: 'SCHEDULE_NOT_FOUND',
              message: 'Payout schedule not found',
            },
          });
        }

        if (schedule.business.owner_id !== request.user!.userId) {
          return reply.status(403).send({
            success: false,
            error: {
              code: 'FORBIDDEN',
              message: 'You do not have permission to modify this schedule',
            },
          });
        }

        // Update schedule
        const updatedSchedule = await payoutService.updateSchedule(scheduleId, updates);

        reply.send({
          success: true,
          data: { schedule: updatedSchedule },
          message: 'Payout schedule updated successfully',
        });
      } catch (error) {
        throw error;
      }
    }
  );

  /**
   * POST /payouts/schedule/hold
   * Hold or unhold automatic payouts
   */
  fastify.post<{
    Body: {
      scheduleId: string;
      hold: boolean;
      reason?: string;
    };
  }>(
    '/schedule/hold',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      try {
        const { scheduleId, hold, reason } = request.body;

        if (!scheduleId || typeof hold !== 'boolean') {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'INVALID_PARAMETERS',
              message: 'Schedule ID and hold (boolean) are required',
            },
          });
        }

        // Get schedule and verify ownership
        const schedule = await fastify.orm.manager.findOne('PayoutSchedule', {
          where: { id: scheduleId },
          relations: ['business'],
        });

        if (!schedule) {
          return reply.status(404).send({
            success: false,
            error: {
              code: 'SCHEDULE_NOT_FOUND',
              message: 'Payout schedule not found',
            },
          });
        }

        if (schedule.business.owner_id !== request.user!.userId) {
          return reply.status(403).send({
            success: false,
            error: {
              code: 'FORBIDDEN',
              message: 'You do not have permission to modify this schedule',
            },
          });
        }

        // Toggle hold
        const updatedSchedule = await payoutService.togglePayoutHold(scheduleId, hold, reason);

        reply.send({
          success: true,
          data: { schedule: updatedSchedule },
          message: hold ? 'Payouts held successfully' : 'Payouts resumed',
        });
      } catch (error) {
        throw error;
      }
    }
  );

  /**
   * POST /payouts/:id/retry
   * Manually retry a failed payout
   */
  fastify.post<{
    Params: { id: string };
  }>(
    '/:id/retry',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      try {
        const { id } = request.params;

        const payout = await fastify.orm.manager.findOne('Payout', {
          where: { id },
          relations: ['business'],
        });

        if (!payout) {
          return reply.status(404).send({
            success: false,
            error: {
              code: 'PAYOUT_NOT_FOUND',
              message: 'Payout not found',
            },
          });
        }

        // Verify business ownership
        if (payout.business.owner_id !== request.user!.userId) {
          return reply.status(403).send({
            success: false,
            error: {
              code: 'FORBIDDEN',
              message: 'You do not have permission to retry this payout',
            },
          });
        }

        // Check if payout is failed
        if (payout.status !== 'failed') {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'INVALID_STATUS',
              message: 'Only failed payouts can be retried',
            },
          });
        }

        // Reset status to pending for retry
        payout.status = 'pending';
        payout.next_retry_date = new Date();
        await fastify.orm.manager.save(payout);

        reply.send({
          success: true,
          data: { payout },
          message: 'Payout retry scheduled',
        });
      } catch (error) {
        throw error;
      }
    }
  );
}
