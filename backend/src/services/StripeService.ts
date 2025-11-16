import Stripe from 'stripe';
import { Repository } from 'typeorm';
import { Payment } from '../models/Payment.js';
import { Order } from '../models/Order.js';
import { AppDataSource } from '../config/database.js';
import { logMetric } from '../utils/logger.js';
import { WhatsAppService } from './WhatsAppService.js';

/**
 * Stripe service for handling all payment operations
 * Supports payment intents, webhooks, refunds, and payment status tracking
 */
export class StripeService {
  private stripe: Stripe;
  private paymentRepository: Repository<Payment>;
  private orderRepository: Repository<Order>;

  constructor() {
    // Initialize Stripe with secret key
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

    if (!stripeSecretKey) {
      throw new Error('STRIPE_SECRET_KEY environment variable is required');
    }

    this.stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2024-11-20.acacia' as any, // Latest API version
      typescript: true,
    });

    this.paymentRepository = AppDataSource.getRepository(Payment);
    this.orderRepository = AppDataSource.getRepository(Order);
  }

  /**
   * Create a Stripe payment intent for an order
   */
  async createPaymentIntent(
    order: Order,
    options?: {
      description?: string;
      metadata?: Record<string, string>;
      statementDescriptor?: string;
    }
  ): Promise<{ clientSecret: string; paymentIntentId: string; payment: Payment }> {
    try {
      // Create payment intent with Stripe
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: order.total_cents,
        currency: order.currency.toLowerCase(),
        description: options?.description || `Order #${order.id.slice(0, 8)}`,
        metadata: {
          order_id: order.id,
          business_id: order.business_id,
          ...options?.metadata,
        },
        statement_descriptor: options?.statementDescriptor?.slice(0, 22), // Max 22 chars
        automatic_payment_methods: {
          enabled: true, // Enable all available payment methods
        },
      });

      // Create payment record in database
      const payment = this.paymentRepository.create({
        order_id: order.id,
        business_id: order.business_id,
        stripe_payment_intent_id: paymentIntent.id,
        amount_cents: order.total_cents,
        currency: order.currency,
        status: 'pending',
        metadata: paymentIntent.metadata as Record<string, unknown>,
      });

      await this.paymentRepository.save(payment);

      // Update order to link payment
      order.payment_status = 'unpaid';
      await this.orderRepository.save(order);

      // Log metric
      if (process.env.NODE_ENV === 'production') {
        logMetric(console as any, 'payment_intent_created', order.total_cents / 100, {
          businessId: order.business_id,
          orderId: order.id,
        });
      }

      return {
        clientSecret: paymentIntent.client_secret!,
        paymentIntentId: paymentIntent.id,
        payment,
      };
    } catch (error) {
      const stripeError = error as Stripe.errors.StripeError;
      const customError = new Error(`Stripe payment intent creation failed: ${stripeError.message}`) as Error & {
        statusCode: number;
        code: string;
        details: unknown;
      };
      customError.statusCode = 500;
      customError.code = 'STRIPE_PAYMENT_INTENT_FAILED';
      customError.details = stripeError;
      throw customError;
    }
  }

  /**
   * Handle Stripe webhook events
   */
  async handleWebhook(
    rawBody: Buffer,
    signature: string
  ): Promise<{ processed: boolean; event: Stripe.Event }> {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET environment variable is required');
    }

    try {
      // Verify webhook signature
      const event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        webhookSecret
      );

      // Process event based on type
      switch (event.type) {
        case 'payment_intent.succeeded':
          await this.handlePaymentSucceeded(event.data.object as Stripe.PaymentIntent);
          break;

        case 'payment_intent.payment_failed':
          await this.handlePaymentFailed(event.data.object as Stripe.PaymentIntent);
          break;

        case 'payment_intent.canceled':
          await this.handlePaymentCanceled(event.data.object as Stripe.PaymentIntent);
          break;

        case 'charge.refunded':
          await this.handleChargeRefunded(event.data.object as Stripe.Charge);
          break;

        default:
          console.log(`Unhandled event type: ${event.type}`);
      }

      return { processed: true, event };
    } catch (error) {
      const stripeError = error as Stripe.errors.StripeSignatureVerificationError;
      const customError = new Error(`Webhook verification failed: ${stripeError.message}`) as Error & {
        statusCode: number;
        code: string;
      };
      customError.statusCode = 400;
      customError.code = 'WEBHOOK_VERIFICATION_FAILED';
      throw customError;
    }
  }

  /**
   * Handle successful payment
   */
  private async handlePaymentSucceeded(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    const payment = await this.paymentRepository.findOne({
      where: { stripe_payment_intent_id: paymentIntent.id },
    });

    if (!payment) {
      console.error(`Payment not found for payment intent: ${paymentIntent.id}`);
      return;
    }

    // Update payment status
    payment.status = 'succeeded';
    payment.payment_method = paymentIntent.payment_method_types[0];
    payment.stripe_charge_id = paymentIntent.latest_charge as string;
    await this.paymentRepository.save(payment);

    // Update order status
    const order = await this.orderRepository.findOne({
      where: { id: payment.order_id },
    });

    if (order) {
      order.payment_status = 'paid';
      order.order_status = 'confirmed'; // Auto-confirm on successful payment
      await this.orderRepository.save(order);
    }

    // Log metric
    if (process.env.NODE_ENV === 'production') {
      logMetric(console as any, 'payment_succeeded', payment.amount_cents / 100, {
        businessId: payment.business_id,
        orderId: payment.order_id,
      });
    }

    // Send WhatsApp notification to seller (async, non-blocking)
    if (order) {
      const fullOrder = await this.orderRepository.findOne({
        where: { id: order.id },
        relations: ['items', 'items.dish', 'business'],
      });

      if (fullOrder) {
        WhatsAppService.notifySellerPaymentReceived(fullOrder).catch(error => {
          console.error('Failed to send WhatsApp payment notification:', error);
        });
      }
    }

    console.log(`Payment succeeded: ${paymentIntent.id}`);
  }

  /**
   * Handle failed payment
   */
  private async handlePaymentFailed(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    const payment = await this.paymentRepository.findOne({
      where: { stripe_payment_intent_id: paymentIntent.id },
    });

    if (!payment) {
      console.error(`Payment not found for payment intent: ${paymentIntent.id}`);
      return;
    }

    // Update payment status
    payment.status = 'failed';
    payment.failure_reason = paymentIntent.last_payment_error?.message || 'Payment failed';
    await this.paymentRepository.save(payment);

    console.log(`Payment failed: ${paymentIntent.id}`, paymentIntent.last_payment_error?.message);
  }

  /**
   * Handle canceled payment
   */
  private async handlePaymentCanceled(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    const payment = await this.paymentRepository.findOne({
      where: { stripe_payment_intent_id: paymentIntent.id },
    });

    if (!payment) {
      console.error(`Payment not found for payment intent: ${paymentIntent.id}`);
      return;
    }

    // Update payment status
    payment.status = 'canceled';
    await this.paymentRepository.save(payment);

    console.log(`Payment canceled: ${paymentIntent.id}`);
  }

  /**
   * Handle charge refund
   */
  private async handleChargeRefunded(charge: Stripe.Charge): Promise<void> {
    const payment = await this.paymentRepository.findOne({
      where: { stripe_charge_id: charge.id },
    });

    if (!payment) {
      console.error(`Payment not found for charge: ${charge.id}`);
      return;
    }

    // Update payment status
    payment.status = 'refunded';
    await this.paymentRepository.save(payment);

    // Update order status
    const order = await this.orderRepository.findOne({
      where: { id: payment.order_id },
    });

    if (order) {
      order.payment_status = 'unpaid'; // Reset to unpaid after refund
      order.order_status = 'cancelled';
      await this.orderRepository.save(order);
    }

    console.log(`Charge refunded: ${charge.id}`);
  }

  /**
   * Retrieve payment by order ID
   */
  async getPaymentByOrderId(orderId: string): Promise<Payment | null> {
    return await this.paymentRepository.findOne({
      where: { order_id: orderId },
      order: { created_at: 'DESC' }, // Get latest payment
    });
  }

  /**
   * Retrieve payment intent from Stripe
   */
  async retrievePaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    try {
      return await this.stripe.paymentIntents.retrieve(paymentIntentId);
    } catch (error) {
      const stripeError = error as Stripe.errors.StripeError;
      const customError = new Error(`Failed to retrieve payment intent: ${stripeError.message}`) as Error & {
        statusCode: number;
        code: string;
      };
      customError.statusCode = 500;
      customError.code = 'STRIPE_RETRIEVE_FAILED';
      throw customError;
    }
  }

  /**
   * Create a refund for a payment
   */
  async createRefund(
    paymentId: string,
    options?: {
      amount?: number; // Amount in cents (partial refund)
      reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer';
    }
  ): Promise<{ refund: Stripe.Refund; payment: Payment }> {
    try {
      const payment = await this.paymentRepository.findOne({
        where: { id: paymentId },
      });

      if (!payment) {
        const error = new Error('Payment not found') as Error & {
          statusCode: number;
          code: string;
        };
        error.statusCode = 404;
        error.code = 'PAYMENT_NOT_FOUND';
        throw error;
      }

      if (!payment.stripe_payment_intent_id) {
        const error = new Error('Payment has no Stripe payment intent') as Error & {
          statusCode: number;
          code: string;
        };
        error.statusCode = 400;
        error.code = 'NO_PAYMENT_INTENT';
        throw error;
      }

      // Create refund with Stripe
      const refund = await this.stripe.refunds.create({
        payment_intent: payment.stripe_payment_intent_id,
        amount: options?.amount,
        reason: options?.reason,
      });

      // Update payment status (full or partial refund)
      if (refund.status === 'succeeded') {
        payment.status = refund.amount === payment.amount_cents ? 'refunded' : 'succeeded';
        await this.paymentRepository.save(payment);
      }

      return { refund, payment };
    } catch (error) {
      const stripeError = error as Stripe.errors.StripeError;
      const customError = new Error(`Stripe refund failed: ${stripeError.message}`) as Error & {
        statusCode: number;
        code: string;
        details: unknown;
      };
      customError.statusCode = 500;
      customError.code = 'STRIPE_REFUND_FAILED';
      customError.details = stripeError;
      throw customError;
    }
  }

  /**
   * Get payment statistics for a business
   */
  async getBusinessPaymentStats(
    businessId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    totalPayments: number;
    successfulPayments: number;
    failedPayments: number;
    totalRevenue: number;
    averageOrderValue: number;
  }> {
    const queryBuilder = this.paymentRepository
      .createQueryBuilder('payment')
      .where('payment.business_id = :businessId', { businessId });

    if (startDate) {
      queryBuilder.andWhere('payment.created_at >= :startDate', { startDate });
    }

    if (endDate) {
      queryBuilder.andWhere('payment.created_at <= :endDate', { endDate });
    }

    const payments = await queryBuilder.getMany();

    const totalPayments = payments.length;
    const successfulPayments = payments.filter(p => p.status === 'succeeded').length;
    const failedPayments = payments.filter(p => p.status === 'failed').length;
    const totalRevenue = payments
      .filter(p => p.status === 'succeeded')
      .reduce((sum, p) => sum + p.amount_cents, 0);
    const averageOrderValue = successfulPayments > 0 ? totalRevenue / successfulPayments : 0;

    return {
      totalPayments,
      successfulPayments,
      failedPayments,
      totalRevenue,
      averageOrderValue,
    };
  }
}
