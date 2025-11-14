import { FastifyInstance, FastifyRequest } from 'fastify';
import { StripeService } from '../services/StripeService.js';
import { OrderService } from '../services/OrderService.js';
import { authenticate } from '../middleware/auth.js';
import { logSecurityEvent } from '../utils/logger.js';

export async function paymentRoutes(fastify: FastifyInstance): Promise<void> {
  const stripeService = new StripeService();
  const orderService = new OrderService();

  /**
   * POST /payments/create-intent
   * Create a Stripe payment intent for an order
   * Public endpoint (used by customers during checkout)
   */
  fastify.post('/create-intent', async (request, reply) => {
    const { orderId } = request.body as { orderId: string };

    if (!orderId) {
      reply.status(400).send({
        success: false,
        error: {
          code: 'MISSING_ORDER_ID',
          message: 'Order ID is required',
        },
      });
      return;
    }

    try {
      // Get order details
      const order = await orderService.getOrderById(orderId);

      // Check if order already has a successful payment
      const existingPayment = await stripeService.getPaymentByOrderId(orderId);
      if (existingPayment && existingPayment.status === 'succeeded') {
        reply.status(400).send({
          success: false,
          error: {
            code: 'ORDER_ALREADY_PAID',
            message: 'This order has already been paid',
          },
        });
        return;
      }

      // Create payment intent
      const { clientSecret, paymentIntentId, payment } = await stripeService.createPaymentIntent(order, {
        description: `Order from ${order.business.name}`,
        statementDescriptor: order.business.name.slice(0, 22),
        metadata: {
          customer_name: order.customer_name,
          customer_phone: order.customer_phone,
        },
      });

      reply.send({
        success: true,
        data: {
          clientSecret,
          paymentIntentId,
          payment: {
            id: payment.id,
            amount: payment.amount_cents,
            currency: payment.currency,
            status: payment.status,
          },
        },
      });
    } catch (error) {
      throw error;
    }
  });

  /**
   * POST /payments/webhook
   * Handle Stripe webhook events
   * Public endpoint (called by Stripe)
   */
  fastify.post('/webhook', {
    config: {
      // Disable request body parsing for webhook signature verification
      rawBody: true,
    },
  }, async (request, reply) => {
    const signature = request.headers['stripe-signature'];

    if (!signature || typeof signature !== 'string') {
      reply.status(400).send({
        success: false,
        error: {
          code: 'MISSING_SIGNATURE',
          message: 'Stripe signature header is required',
        },
      });
      return;
    }

    try {
      // Get raw body for signature verification
      const rawBody = (request as any).rawBody || request.body;

      // Process webhook
      const { processed, event } = await stripeService.handleWebhook(rawBody, signature);

      // Log webhook processing
      logSecurityEvent(request.log, `Stripe webhook processed: ${event.type}`, {
        requestId: request.id,
        method: request.method,
        path: request.url,
        severity: 'low',
      });

      reply.send({
        success: true,
        data: {
          processed,
          eventType: event.type,
          eventId: event.id,
        },
      });
    } catch (error) {
      throw error;
    }
  });

  /**
   * GET /payments/:id
   * Get payment details
   * Authenticated endpoint (seller only)
   */
  fastify.get('/:id', {
    preHandler: authenticate,
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const payment = await stripeService['paymentRepository'].findOne({
        where: { id },
        relations: ['order', 'business'],
      });

      if (!payment) {
        reply.status(404).send({
          success: false,
          error: {
            code: 'PAYMENT_NOT_FOUND',
            message: 'Payment not found',
          },
        });
        return;
      }

      // Check authorization (user must own the business)
      if (payment.business.owner_id !== request.user!.userId) {
        reply.status(403).send({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'You do not have permission to view this payment',
          },
        });
        return;
      }

      reply.send({
        success: true,
        data: { payment },
      });
    } catch (error) {
      throw error;
    }
  });

  /**
   * POST /payments/:id/refund
   * Create a refund for a payment
   * Authenticated endpoint (seller only)
   */
  fastify.post('/:id/refund', {
    preHandler: authenticate,
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { amount, reason } = request.body as {
      amount?: number;
      reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer';
    };

    try {
      // Get payment to check authorization
      const payment = await stripeService['paymentRepository'].findOne({
        where: { id },
        relations: ['business'],
      });

      if (!payment) {
        reply.status(404).send({
          success: false,
          error: {
            code: 'PAYMENT_NOT_FOUND',
            message: 'Payment not found',
          },
        });
        return;
      }

      // Check authorization (user must own the business)
      if (payment.business.owner_id !== request.user!.userId) {
        reply.status(403).send({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'You do not have permission to refund this payment',
          },
        });
        return;
      }

      // Create refund
      const { refund, payment: updatedPayment } = await stripeService.createRefund(id, {
        amount,
        reason,
      });

      reply.send({
        success: true,
        data: {
          refund: {
            id: refund.id,
            amount: refund.amount,
            status: refund.status,
            reason: refund.reason,
          },
          payment: updatedPayment,
        },
      });
    } catch (error) {
      throw error;
    }
  });

  /**
   * GET /payments/business/:businessId/stats
   * Get payment statistics for a business
   * Authenticated endpoint (seller only)
   */
  fastify.get('/business/:businessId/stats', {
    preHandler: authenticate,
  }, async (request, reply) => {
    const { businessId } = request.params as { businessId: string };
    const { startDate, endDate } = request.query as {
      startDate?: string;
      endDate?: string;
    };

    try {
      // Verify business ownership
      const business = await fastify.orm.manager.findOne('Business', {
        where: { id: businessId },
      });

      if (!business || business.owner_id !== request.user!.userId) {
        reply.status(403).send({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'You do not have permission to view these stats',
          },
        });
        return;
      }

      // Get payment stats
      const stats = await stripeService.getBusinessPaymentStats(
        businessId,
        startDate ? new Date(startDate) : undefined,
        endDate ? new Date(endDate) : undefined
      );

      reply.send({
        success: true,
        data: { stats },
      });
    } catch (error) {
      throw error;
    }
  });
}
