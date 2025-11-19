import { FastifyInstance } from 'fastify';
import { ReportService } from '../services/ReportService.js';
import { authenticate } from '../middleware/auth.js';

export async function reportRoutes(fastify: FastifyInstance): Promise<void> {
  const reportService = new ReportService();

  // GET /reports/orders/export - Export orders to CSV (authenticated, owner only)
  fastify.get('/orders/export', {
    preHandler: authenticate,
  }, async (request, reply) => {
    const { businessId, startDate, endDate, status } = request.query as {
      businessId: string;
      startDate?: string;
      endDate?: string;
      status?: string;
    };

    if (!businessId) {
      reply.status(400).send({
        success: false,
        error: {
          code: 'MISSING_BUSINESS_ID',
          message: 'businessId query parameter is required',
        },
      });
      return;
    }

    const filters = {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      status,
    };

    const csv = await reportService.exportOrdersToCSV(
      businessId,
      request.user!.userId,
      filters
    );

    // Set headers for CSV download
    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', `attachment; filename="orders-${businessId}-${Date.now()}.csv"`);

    reply.send(csv);
  });

  // GET /reports/dashboard - Get dashboard statistics (authenticated, owner only)
  fastify.get('/dashboard', {
    preHandler: authenticate,
  }, async (request, reply) => {
    const { businessId, period } = request.query as {
      businessId: string;
      period?: 'today' | 'week' | 'month' | 'all';
    };

    if (!businessId) {
      reply.status(400).send({
        success: false,
        error: {
          code: 'MISSING_BUSINESS_ID',
          message: 'businessId query parameter is required',
        },
      });
      return;
    }

    const stats = await reportService.getDashboardStats(
      businessId,
      request.user!.userId,
      period || 'week'
    );

    reply.send({
      success: true,
      data: { stats },
    });
  });

  // GET /reports/analytics - Get comprehensive analytics (authenticated, owner only)
  fastify.get('/analytics', {
    preHandler: authenticate,
  }, async (request, reply) => {
    const { businessId, period, startDate, endDate } = request.query as {
      businessId: string;
      period?: 'today' | 'week' | 'month' | 'custom';
      startDate?: string;
      endDate?: string;
    };

    if (!businessId) {
      reply.status(400).send({
        success: false,
        error: {
          code: 'MISSING_BUSINESS_ID',
          message: 'businessId query parameter is required',
        },
      });
      return;
    }

    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    const data = await reportService.getComprehensiveAnalytics(
      businessId,
      request.user!.userId,
      period || 'week',
      start,
      end
    );

    reply.send({
      success: true,
      data,
    });
  });
}
