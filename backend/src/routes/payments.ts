import { FastifyInstance} from 'fastify';
import { StripeService } from '../services/StripeService.js';
import { OrderService } from '../services/OrderService.js';
import { PaymentProcessorService } from '../services/PaymentProcessorService.js';
import { ProcessorType } from '../models/PaymentProcessor.js';
import { authenticate } from '../middleware/auth.js';
import { logSecurityEvent } from '../utils/logger.js';
import { Business } from '../models/Business.js';

export async function paymentRoutes(fastify: FastifyInstance): Promise<void> {
  const stripeService = new StripeService();
  const orderService = new OrderService();
  const processorService = new PaymentProcessorService(); // Phase 3: Multi-processor support

  /**
   * POST /payments/create-intent-multi (Phase 3 - US3.1)
   * Create payment with automatic processor selection and fallback
   * Public endpoint (used by customers during checkout)
   *
   * Supports: Stripe, Razorpay, PhonePe, Paytm
   */
  fastify.post<{
    Body: {
      orderId: string;
      preferredProcessorId?: string;
    };
  }>('/create-intent-multi', async (request, reply) => {
    const { orderId, preferredProcessorId } = request.body;

    if (!orderId) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'MISSING_ORDER_ID',
          message: 'Order ID is required',
        },
      });
    }

    try {
      // Get order details
      const order = await orderService.getOrderById(orderId);

      // Check if order already has a successful payment
      const existingPayment = await processorService['paymentRepository'].findOne({
        where: { order_id: orderId, status: 'succeeded' },
      });

      if (existingPayment) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'ORDER_ALREADY_PAID',
            message: 'This order has already been paid',
          },
        });
      }

      // Create payment with automatic processor selection and fallback
      const result = await processorService.createPayment(
        order,
        order.business_id,
        preferredProcessorId,
        {
          description: `Order from ${order.business.name}`,
          metadata: {
            customer_name: order.customer_name,
            customer_phone: order.customer_phone,
          },
          redirectUrl: `${process.env.FRONTEND_URL}/payment/callback`,
          callbackUrl: `${process.env.BACKEND_URL}/api/v1/payments/webhook-multi`,
        }
      );

      reply.send({
        success: true,
        data: {
          paymentId: result.payment.id,
          processorType: result.payment.processor_type,
          clientSecret: result.clientSecret,
          paymentUrl: result.paymentUrl,
          amount: result.payment.amount_cents,
          currency: result.payment.currency,
          status: result.payment.status,
          additionalData: result.additionalData,
        },
      });
    } catch (error: any) {
      if (error.message.includes('No active payment processors')) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'NO_PROCESSORS_CONFIGURED',
            message: 'No payment processors are configured for this business. Please contact support.',
          },
        });
      }
      throw error;
    }
  });

  /**
   * POST /payments/webhook-multi (Phase 3 - US3.1)
   * Unified webhook handler for all processors
   * Public endpoint (called by payment processors)
   */
  fastify.post<{
    Querystring: {
      processor?: ProcessorType;
      processorId?: string;
    };
  }>('/webhook-multi', async (request, reply) => {
    const { processor, processorId } = request.query;

    if (!processor) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'MISSING_PROCESSOR',
          message: 'Processor type query parameter is required (?processor=razorpay)',
        },
      });
    }

    try {
      // Get signature header (varies by processor)
      let signature = '';
      switch (processor) {
        case 'stripe':
          signature = request.headers['stripe-signature'] as string;
          break;
        case 'razorpay':
          signature = request.headers['x-razorpay-signature'] as string;
          break;
        case 'phonepe':
          signature = request.headers['x-verify'] as string;
          break;
        case 'paytm':
          signature = request.headers['x-paytm-signature'] as string;
          break;
      }

      if (!signature) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'MISSING_SIGNATURE',
            message: `Webhook signature header is required for ${processor}`,
          },
        });
      }

      // Get raw body
      const rawBody = (request as any).rawBody || request.body;

      // Process webhook
      const result = await processorService.handleWebhook(
        processor,
        rawBody,
        signature,
        processorId
      );

      // Log webhook processing
      logSecurityEvent(request.log, `${processor} webhook processed: ${result.eventType}`, {
        requestId: request.id,
        method: request.method,
        path: request.url,
        severity: 'low',
      });

      reply.send({
        success: true,
        data: {
          processed: result.processed,
          eventType: result.eventType,
          eventId: result.eventId,
        },
      });
    } catch (error: any) {
      if (error.message.includes('Invalid webhook signature')) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'INVALID_SIGNATURE',
            message: 'Webhook signature verification failed',
          },
        });
      }
      throw error;
    }
  });

  /**
   * POST /payments/:id/refund-multi (Phase 3 - US3.1)
   * Create refund (routed to original processor)
   * Authenticated endpoint (seller only)
   */
  fastify.post<{
    Params: { id: string };
    Body: {
      amount?: number;
      reason?: string;
    };
  }>('/:id/refund-multi', {
    preHandler: authenticate,
  }, async (request, reply) => {
    const { id } = request.params;
    const { amount, reason } = request.body;

    try {
      // Get payment to check authorization
      const payment = await processorService['paymentRepository'].findOne({
        where: { id },
        relations: ['business'],
      });

      if (!payment) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'PAYMENT_NOT_FOUND',
            message: 'Payment not found',
          },
        });
      }

      // Check authorization
      if (payment.business.owner_id !== request.user!.userId) {
        return reply.status(403).send({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'You do not have permission to refund this payment',
          },
        });
      }

      // Create refund
      const result = await processorService.createRefund(id, amount, reason);

      reply.send({
        success: true,
        data: {
          refund: {
            id: result.refundId,
            amount: result.amount,
            status: result.status,
          },
          payment: {
            id: result.payment.id,
            status: result.payment.status,
            refund_details: result.payment.refund_details,
          },
        },
      });
    } catch (error: any) {
      if (error.message.includes('Can only refund succeeded payments')) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'INVALID_PAYMENT_STATUS',
            message: error.message,
          },
        });
      }
      throw error;
    }
  });

  // ========== Legacy Stripe Endpoints (Backwards Compatibility) ==========

  /**
   * POST /payments/create-intent
   * Create a Stripe payment intent for an order
   * Public endpoint (used by customers during checkout)
   *
   * @deprecated Use /create-intent-multi for multi-processor support
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

    // Verify business ownership
    const business = await fastify.orm.manager.findOne(Business, {
      where: { id: businessId },
      select: ['id', 'owner_id'],
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
  });
}
