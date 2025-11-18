import { FastifyInstance } from 'fastify';
import { OrderService } from '../services/OrderService.js';
import { validateSchema } from '../utils/validation.js';
import { OrderCreateSchema, OrderUpdateSchema } from '@menumaker/shared';
import { authenticate } from '../middleware/auth.js';
import { checkSubscriptionLimits } from '../middleware/subscriptionTier.js';

export async function orderRoutes(fastify: FastifyInstance): Promise<void> {
  const orderService = new OrderService();

  // POST /orders - Create order (public, no auth required)
  fastify.post('/', {
    preHandler: checkSubscriptionLimits, // Check subscription limits before creating order
  }, async (request, reply) => {
    const data = validateSchema(OrderCreateSchema, request.body);

    const order = await orderService.createOrder(data);

    reply.status(201).send({
      success: true,
      data: { order },
    });
  });

  // GET /orders/:id - Get order by ID (public)
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const order = await orderService.getOrderById(id);

    reply.send({
      success: true,
      data: { order },
    });
  });

  // GET /orders - Get all orders for a business (authenticated, owner only)
  fastify.get('/', {
    preHandler: authenticate,
  }, async (request, reply) => {
    const { businessId, status, startDate, endDate } = request.query as {
      businessId: string;
      status?: string;
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

    const filters = {
      status,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    };

    const orders = await orderService.getBusinessOrders(
      businessId,
      request.user!.userId,
      filters
    );

    reply.send({
      success: true,
      data: { orders },
    });
  });

  // PUT /orders/:id - Update order (authenticated, owner only)
  fastify.put('/:id', {
    preHandler: authenticate,
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = validateSchema(OrderUpdateSchema, request.body);

    const order = await orderService.updateOrder(id, request.user!.userId, data);

    reply.send({
      success: true,
      data: { order },
    });
  });

  // GET /orders/summary - Get order summary/stats (authenticated, owner only)
  fastify.get('/summary', {
    preHandler: authenticate,
  }, async (request, reply) => {
    const { businessId, startDate, endDate } = request.query as {
      businessId: string;
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

    const summary = await orderService.getOrderSummary(
      businessId,
      request.user!.userId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined
    );

    reply.send({
      success: true,
      data: { summary },
    });
  });

  // GET /orders/my-orders - Get customer's order history (authenticated)
  fastify.get('/my-orders', {
    preHandler: authenticate,
  }, async (request, reply) => {
    const { status, limit = 50, offset = 0 } = request.query as {
      status?: string;
      limit?: number;
      offset?: number;
    };

    const orders = await orderService.getCustomerOrders(
      request.user!.userId,
      { status, limit, offset }
    );

    reply.send({
      success: true,
      data: { orders },
    });
  });

  // POST /orders/:id/cancel - Cancel an order (authenticated)
  fastify.post('/:id/cancel', {
    preHandler: authenticate,
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { reason } = request.body as { reason?: string };

    try {
      const order = await orderService.cancelOrder(id, request.user!.userId, reason);

      reply.send({
        success: true,
        data: { order },
        message: 'Order cancelled successfully',
      });
    } catch (error) {
      if (error instanceof Error) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'CANCELLATION_FAILED',
            message: error.message,
          },
        });
      }
      throw error;
    }
  });
}
