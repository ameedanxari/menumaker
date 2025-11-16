import { FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/auth.js';
import { TaxReportService } from '../services/TaxReportService.js';
import { Business } from '../models/Business.js';
import { Order } from '../models/Order.js';

/**
 * Tax Report Routes
 * Phase 3: Advanced Reporting & Tax Compliance (US3.4)
 *
 * Endpoints:
 * - GET /tax/invoices/:orderId - Get tax invoice for order
 * - POST /tax/invoices/:orderId/generate - Manually generate tax invoice
 * - GET /tax/gst-report - Generate GST report for period
 * - GET /tax/profit-analysis - Generate profit analysis report
 */
export async function taxReportRoutes(fastify: FastifyInstance): Promise<void> {
  const taxReportService = new TaxReportService();

  /**
   * GET /tax/invoices/:orderId
   * Get tax invoice for an order
   */
  fastify.get<{
    Params: { orderId: string };
  }>(
    '/invoices/:orderId',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
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
            message: 'You do not have permission to view this invoice',
          },
        });
      }

      // Get or generate invoice
      let invoice = await taxReportService.getInvoiceByOrderId(orderId);

      if (!invoice && order.status === 'fulfilled') {
        // Auto-generate for fulfilled orders
        invoice = await taxReportService.generateTaxInvoice(orderId);
      }

      if (!invoice) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'INVOICE_NOT_AVAILABLE',
            message: 'Invoice not available. Order must be completed first.',
          },
        });
      }

      reply.send({
        success: true,
        data: { invoice },
      });
    }
  );

  /**
   * POST /tax/invoices/:orderId/generate
   * Manually generate tax invoice for an order
   */
  fastify.post<{
    Params: { orderId: string };
  }>(
    '/invoices/:orderId/generate',
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
              message: 'You do not have permission to generate this invoice',
            },
          });
        }

        // Check order status - need to reload order with status field
        const fullOrder = await fastify.orm.manager.findOne(Order, {
          where: { id: orderId },
        });

        if (fullOrder && fullOrder.status !== 'fulfilled') {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'INVALID_ORDER_STATUS',
              message: 'Tax invoices can only be generated for completed orders',
            },
          });
        }

        // Generate invoice
        const invoice = await taxReportService.generateTaxInvoice(orderId);

        reply.send({
          success: true,
          data: { invoice },
          message: 'Tax invoice generated successfully',
        });
      } catch (error) {
        if (error instanceof Error && error.message.includes('already exists')) {
          return reply.status(409).send({
            success: false,
            error: {
              code: 'INVOICE_ALREADY_EXISTS',
              message: 'Tax invoice already exists for this order',
            },
          });
        }
        throw error;
      }
    }
  );

  /**
   * GET /tax/gst-report
   * Generate GST report for a period
   */
  fastify.get<{
    Querystring: {
      businessId: string;
      startDate: string;
      endDate: string;
    };
  }>(
    '/gst-report',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const { businessId, startDate, endDate } = request.query;

      if (!businessId || !startDate || !endDate) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'MISSING_PARAMETERS',
            message: 'Business ID, start date, and end date are required',
          },
        });
      }

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
            message: 'You do not have permission to view this report',
          },
        });
      }

      // Generate GST report
      const report = await taxReportService.generateGstReport(
        businessId,
        new Date(startDate),
        new Date(endDate)
      );

      reply.send({
        success: true,
        data: {
          period: {
            start: startDate,
            end: endDate,
          },
          report,
        },
      });
    }
  );

  /**
   * GET /tax/profit-analysis
   * Generate profit analysis report for a period
   */
  fastify.get<{
    Querystring: {
      businessId: string;
      startDate: string;
      endDate: string;
    };
  }>(
    '/profit-analysis',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const { businessId, startDate, endDate } = request.query;

      if (!businessId || !startDate || !endDate) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'MISSING_PARAMETERS',
            message: 'Business ID, start date, and end date are required',
          },
        });
      }

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
            message: 'You do not have permission to view this report',
          },
        });
      }

      // Generate profit analysis
      const analysis = await taxReportService.generateProfitAnalysis(
        businessId,
        new Date(startDate),
        new Date(endDate)
      );

      reply.send({
        success: true,
        data: {
          period: {
            start: startDate,
            end: endDate,
          },
          analysis,
        },
      });
    }
  );

  /**
   * GET /tax/invoices/business/:businessId
   * Get all tax invoices for a business
   */
  fastify.get<{
    Params: { businessId: string };
    Querystring: {
      limit?: number;
      offset?: number;
      startDate?: string;
      endDate?: string;
    };
  }>(
    '/invoices/business/:businessId',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const { businessId } = request.params;
      const { limit = 50, offset = 0, startDate, endDate } = request.query;

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
            message: 'You do not have permission to view these invoices',
          },
        });
      }

      // Build query
      const where: any = { business_id: businessId };

      if (startDate && endDate) {
        where.invoice_date = {
          $gte: new Date(startDate),
          $lte: new Date(endDate),
        };
      }

      // Get invoices
      const [invoices, total] = await fastify.orm.manager.findAndCount('TaxInvoice', {
        where,
        order: { invoice_date: 'DESC' },
        take: limit,
        skip: offset,
      });

      reply.send({
        success: true,
        data: {
          invoices,
          total,
          limit,
          offset,
        },
      });
    }
  );
}
