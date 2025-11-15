import { FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/auth.js';
import { PaymentProcessorService } from '../services/PaymentProcessorService.js';
import { ProcessorType } from '../models/PaymentProcessor.js';

/**
 * Payment Processor Routes
 * Phase 3: Multiple Payment Processors (US3.1)
 *
 * Endpoints:
 * - GET /payment-processors - List all processors for business
 * - POST /payment-processors/connect - Connect a new processor
 * - POST /payment-processors/:id/disconnect - Disconnect processor
 * - POST /payment-processors/:id/verify - Verify processor credentials
 * - GET /payment-processors/settlement-report - Generate settlement report
 */
export async function paymentProcessorRoutes(fastify: FastifyInstance): Promise<void> {
  const processorService = new PaymentProcessorService();

  /**
   * GET /payment-processors
   * List all payment processors for authenticated user's business
   */
  fastify.get(
    '/',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      try {
        const { businessId } = request.query as { businessId: string };

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
              message: 'You do not have permission to view these processors',
            },
          });
        }

        // Get all processors (active and inactive)
        const processors = await fastify.orm.manager.find('PaymentProcessor', {
          where: { business_id: businessId },
          order: { priority: 'ASC' },
        });

        // Sanitize credentials (don't expose API keys)
        const sanitizedProcessors = processors.map((p: any) => ({
          id: p.id,
          processor_type: p.processor_type,
          status: p.status,
          is_active: p.is_active,
          priority: p.priority,
          settlement_schedule: p.settlement_schedule,
          min_payout_threshold_cents: p.min_payout_threshold_cents,
          fee_percentage: p.fee_percentage,
          fixed_fee_cents: p.fixed_fee_cents,
          last_transaction_at: p.last_transaction_at,
          verified_at: p.verified_at,
          connection_error: p.connection_error,
          metadata: p.metadata,
          created_at: p.created_at,
        }));

        reply.send({
          success: true,
          data: { processors: sanitizedProcessors },
        });
      } catch (error) {
        throw error;
      }
    }
  );

  /**
   * POST /payment-processors/connect
   * Connect a new payment processor or update existing
   */
  fastify.post<{
    Body: {
      businessId: string;
      processorType: ProcessorType;
      credentials: Record<string, string>;
      priority?: number;
      settlement_schedule?: 'daily' | 'weekly' | 'monthly';
      min_payout_threshold_cents?: number;
      fee_percentage?: number;
      fixed_fee_cents?: number;
    };
  }>(
    '/connect',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      try {
        const {
          businessId,
          processorType,
          credentials,
          priority,
          settlement_schedule,
          min_payout_threshold_cents,
          fee_percentage,
          fixed_fee_cents,
        } = request.body;

        // Validate required fields
        if (!businessId || !processorType || !credentials) {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'MISSING_FIELDS',
              message: 'businessId, processorType, and credentials are required',
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
              message: 'You do not have permission to connect processors for this business',
            },
          });
        }

        // Connect processor (verifies credentials)
        const processor = await processorService.connectProcessor(
          businessId,
          processorType,
          credentials,
          {
            priority,
            settlement_schedule,
            min_payout_threshold_cents,
            fee_percentage,
            fixed_fee_cents,
          }
        );

        // Sanitize response
        const sanitized = {
          id: processor.id,
          processor_type: processor.processor_type,
          status: processor.status,
          is_active: processor.is_active,
          priority: processor.priority,
          settlement_schedule: processor.settlement_schedule,
          verified_at: processor.verified_at,
          metadata: processor.metadata,
        };

        reply.send({
          success: true,
          data: { processor: sanitized },
          message: `${processorType} connected successfully`,
        });
      } catch (error: any) {
        if (error.message.includes('Invalid credentials')) {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'INVALID_CREDENTIALS',
              message: error.message,
            },
          });
        }
        throw error;
      }
    }
  );

  /**
   * POST /payment-processors/:id/disconnect
   * Disconnect a payment processor
   */
  fastify.post<{
    Params: { id: string };
  }>(
    '/:id/disconnect',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      try {
        const { id } = request.params;

        // Get processor and verify ownership
        const processor = await fastify.orm.manager.findOne('PaymentProcessor', {
          where: { id },
          relations: ['business'],
        });

        if (!processor) {
          return reply.status(404).send({
            success: false,
            error: {
              code: 'PROCESSOR_NOT_FOUND',
              message: 'Payment processor not found',
            },
          });
        }

        if (processor.business.owner_id !== request.user!.userId) {
          return reply.status(403).send({
            success: false,
            error: {
              code: 'FORBIDDEN',
              message: 'You do not have permission to disconnect this processor',
            },
          });
        }

        // Disconnect
        const updated = await processorService.disconnectProcessor(id);

        reply.send({
          success: true,
          data: { processor: updated },
          message: 'Processor disconnected successfully',
        });
      } catch (error) {
        throw error;
      }
    }
  );

  /**
   * POST /payment-processors/:id/verify
   * Verify processor credentials and connection
   */
  fastify.post<{
    Params: { id: string };
  }>(
    '/:id/verify',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      try {
        const { id } = request.params;

        // Get processor and verify ownership
        const processor = await fastify.orm.manager.findOne('PaymentProcessor', {
          where: { id },
          relations: ['business'],
        });

        if (!processor) {
          return reply.status(404).send({
            success: false,
            error: {
              code: 'PROCESSOR_NOT_FOUND',
              message: 'Payment processor not found',
            },
          });
        }

        if (processor.business.owner_id !== request.user!.userId) {
          return reply.status(403).send({
            success: false,
            error: {
              code: 'FORBIDDEN',
              message: 'You do not have permission to verify this processor',
            },
          });
        }

        // Get processor service and verify credentials
        const service = processorService['getProcessorService'](processor.processor_type);
        const verification = await service.verifyCredentials(processor.credentials);

        if (!verification.isValid) {
          processor.status = 'failed';
          processor.connection_error = verification.error || 'Verification failed';
          await fastify.orm.manager.save(processor);

          return reply.status(400).send({
            success: false,
            error: {
              code: 'VERIFICATION_FAILED',
              message: verification.error || 'Credential verification failed',
            },
          });
        }

        // Update processor
        processor.status = 'active';
        processor.verified_at = new Date();
        processor.connection_error = null;
        processor.metadata = {
          ...processor.metadata,
          ...verification.merchantInfo,
        };
        await fastify.orm.manager.save(processor);

        reply.send({
          success: true,
          data: {
            verified: true,
            merchantInfo: verification.merchantInfo,
          },
          message: 'Processor credentials verified successfully',
        });
      } catch (error) {
        throw error;
      }
    }
  );

  /**
   * GET /payment-processors/settlement-report
   * Generate settlement/reconciliation report
   */
  fastify.get<{
    Querystring: {
      businessId: string;
      startDate: string;
      endDate: string;
      format?: 'json' | 'csv';
    };
  }>(
    '/settlement-report',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      try {
        const { businessId, startDate, endDate, format = 'json' } = request.query;

        if (!businessId || !startDate || !endDate) {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'MISSING_PARAMETERS',
              message: 'businessId, startDate, and endDate are required',
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
              message: 'You do not have permission to view reports for this business',
            },
          });
        }

        // Generate report
        const report = await processorService.generateSettlementReport(
          businessId,
          new Date(startDate),
          new Date(endDate)
        );

        if (format === 'csv') {
          // Convert to CSV
          const csv = this.convertReportToCSV(report);
          reply.header('Content-Type', 'text/csv');
          reply.header(
            'Content-Disposition',
            `attachment; filename="settlement-report-${startDate}-${endDate}.csv"`
          );
          return reply.send(csv);
        }

        reply.send({
          success: true,
          data: { report },
        });
      } catch (error) {
        throw error;
      }
    }
  );

  // Helper to convert report to CSV
  function convertReportToCSV(report: any): string {
    const lines: string[] = [];

    // Header
    lines.push('Payment ID,Order ID,Processor,Amount (₹),Fee (₹),Net (₹),Status,Date,Settled');

    // Payments
    for (const payment of report.payments) {
      lines.push(
        [
          payment.payment_id,
          payment.order_id,
          payment.processor_type,
          (payment.amount_cents / 100).toFixed(2),
          (payment.fee_cents / 100).toFixed(2),
          (payment.net_cents / 100).toFixed(2),
          payment.status,
          payment.created_at.toISOString(),
          payment.settled ? 'Yes' : 'No',
        ].join(',')
      );
    }

    return lines.join('\n');
  }
}
