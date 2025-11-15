import Razorpay from 'razorpay';
import crypto from 'crypto';
import { Repository } from 'typeorm';
import { AppDataSource } from '../../config/database.js';
import { Order } from '../../models/Order.js';
import { Payment } from '../../models/Payment.js';
import { PaymentProcessor } from '../../models/PaymentProcessor.js';
import {
  IPaymentProcessorService,
  PaymentIntentResult,
  WebhookResult,
  RefundResult,
  CredentialsVerificationResult,
} from './IPaymentProcessorService.js';
import { logMetric } from '../../utils/logger.js';

/**
 * Razorpay Payment Processor Service
 * Phase 3: Multiple Payment Processors (US3.1)
 *
 * Razorpay is a leading Indian payment gateway
 * Fee structure: 2% (can be 1.75% with volume discount)
 * Supports: UPI, cards, netbanking, wallets
 *
 * @see https://razorpay.com/docs/api/
 */
export class RazorpayService implements IPaymentProcessorService {
  private paymentRepository: Repository<Payment>;
  private orderRepository: Repository<Order>;

  constructor() {
    this.paymentRepository = AppDataSource.getRepository(Payment);
    this.orderRepository = AppDataSource.getRepository(Order);
  }

  /**
   * Initialize Razorpay client with credentials
   */
  private getRazorpayClient(processor: PaymentProcessor): Razorpay {
    const { key_id, key_secret } = processor.credentials;

    if (!key_id || !key_secret) {
      throw new Error('Razorpay credentials (key_id, key_secret) are required');
    }

    return new Razorpay({
      key_id,
      key_secret,
    });
  }

  /**
   * Create a Razorpay order (payment intent)
   */
  async createPayment(
    order: Order,
    processor: PaymentProcessor,
    options?: {
      description?: string;
      metadata?: Record<string, string>;
      callbackUrl?: string;
    }
  ): Promise<PaymentIntentResult> {
    try {
      const razorpay = this.getRazorpayClient(processor);

      // Create Razorpay order
      // Note: Razorpay uses smallest currency unit (paise for INR)
      const razorpayOrder = await razorpay.orders.create({
        amount: order.total_cents, // Amount in paise
        currency: order.currency,
        receipt: order.id.slice(0, 40), // Max 40 chars
        notes: {
          order_id: order.id,
          business_id: order.business_id,
          customer_name: order.customer_name,
          customer_phone: order.customer_phone,
          ...options?.metadata,
        },
      });

      // Calculate processor fee
      const processorFee = this.calculateFee(order.total_cents, processor);
      const netAmount = order.total_cents - processorFee;

      // Create payment record in database
      const payment = this.paymentRepository.create({
        order_id: order.id,
        business_id: order.business_id,
        payment_processor_id: processor.id,
        processor_type: 'razorpay',
        processor_payment_id: razorpayOrder.id,
        amount_cents: order.total_cents,
        currency: order.currency,
        status: 'pending',
        processor_fee_cents: processorFee,
        net_amount_cents: netAmount,
        metadata: {
          razorpay_order_id: razorpayOrder.id,
          razorpay_status: razorpayOrder.status,
          ...options?.metadata,
        },
      });

      await this.paymentRepository.save(payment);

      // Update order
      order.payment_status = 'unpaid';
      await this.orderRepository.save(order);

      // Log metric
      if (process.env.NODE_ENV === 'production') {
        logMetric(console as any, 'razorpay_order_created', order.total_cents / 100, {
          businessId: order.business_id,
          orderId: order.id,
        });
      }

      return {
        // Razorpay uses order_id as client identifier for Razorpay Checkout
        clientSecret: razorpayOrder.id,
        paymentId: razorpayOrder.id,
        payment,
        additionalData: {
          key: processor.credentials.key_id, // Publishable key for frontend
          order_id: razorpayOrder.id,
          amount: order.total_cents,
          currency: order.currency,
          name: order.business.name,
          description: options?.description || `Order from ${order.business.name}`,
          prefill: {
            name: order.customer_name,
            contact: order.customer_phone,
          },
          callback_url: options?.callbackUrl,
        },
      };
    } catch (error: any) {
      const customError = new Error(
        `Razorpay order creation failed: ${error.message}`
      ) as Error & {
        statusCode: number;
        code: string;
        details: unknown;
      };
      customError.statusCode = 500;
      customError.code = 'RAZORPAY_ORDER_FAILED';
      customError.details = error;
      throw customError;
    }
  }

  /**
   * Handle Razorpay webhook
   *
   * Webhook signature verification:
   * https://razorpay.com/docs/webhooks/validate-verify/#verify-webhooks
   */
  async handleWebhook(
    rawBody: Buffer | string,
    signature: string,
    processor: PaymentProcessor
  ): Promise<WebhookResult> {
    const webhookSecret = processor.credentials.webhook_secret;

    if (!webhookSecret) {
      throw new Error('Razorpay webhook secret is required');
    }

    try {
      // Verify webhook signature
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(rawBody.toString())
        .digest('hex');

      if (signature !== expectedSignature) {
        throw new Error('Invalid webhook signature');
      }

      // Parse event
      const event = JSON.parse(rawBody.toString());
      const eventType = event.event;
      const payload = event.payload.payment.entity;

      let payment: Payment | null = null;

      // Process event based on type
      switch (eventType) {
        case 'payment.authorized':
          // Payment authorized (will be captured automatically or manually)
          payment = await this.handlePaymentAuthorized(payload);
          break;

        case 'payment.captured':
          // Payment captured (funds received)
          payment = await this.handlePaymentCaptured(payload);
          break;

        case 'payment.failed':
          // Payment failed
          payment = await this.handlePaymentFailed(payload);
          break;

        case 'refund.created':
          // Refund created
          payment = await this.handleRefundCreated(event.payload.refund.entity);
          break;

        default:
          console.log(`Unhandled Razorpay event type: ${eventType}`);
      }

      return {
        processed: true,
        eventType,
        eventId: event.payload.payment.entity.id,
        payment: payment || undefined,
      };
    } catch (error: any) {
      const customError = new Error(
        `Razorpay webhook processing failed: ${error.message}`
      ) as Error & {
        statusCode: number;
        code: string;
      };
      customError.statusCode = 400;
      customError.code = 'RAZORPAY_WEBHOOK_FAILED';
      throw customError;
    }
  }

  /**
   * Create a refund
   */
  async createRefund(
    payment: Payment,
    amount: number | undefined,
    processor: PaymentProcessor,
    reason?: string
  ): Promise<RefundResult> {
    try {
      const razorpay = this.getRazorpayClient(processor);

      // Razorpay requires payment ID (not order ID) for refunds
      const razorpayPaymentId = payment.processor_charge_id || payment.processor_payment_id;

      if (!razorpayPaymentId) {
        throw new Error('Razorpay payment ID not found');
      }

      // Create refund
      const refund = await razorpay.payments.refund(razorpayPaymentId, {
        amount: amount || payment.amount_cents, // Full refund if amount not provided
        notes: {
          reason: reason || 'Seller initiated refund',
        },
      });

      // Update payment
      payment.status = amount === payment.amount_cents ? 'refunded' : payment.status;
      payment.refund_details = {
        refund_id: refund.id,
        refund_amount_cents: refund.amount,
        refund_reason: reason,
        refunded_at: new Date().toISOString(),
      };

      await this.paymentRepository.save(payment);

      // Log metric
      if (process.env.NODE_ENV === 'production') {
        logMetric(console as any, 'razorpay_refund_created', refund.amount / 100, {
          paymentId: payment.id,
        });
      }

      return {
        refundId: refund.id,
        amount: refund.amount,
        status: refund.status === 'processed' ? 'succeeded' : 'pending',
        payment,
      };
    } catch (error: any) {
      const customError = new Error(
        `Razorpay refund failed: ${error.message}`
      ) as Error & {
        statusCode: number;
        code: string;
      };
      customError.statusCode = 500;
      customError.code = 'RAZORPAY_REFUND_FAILED';
      throw customError;
    }
  }

  /**
   * Verify Razorpay credentials
   */
  async verifyCredentials(
    credentials: Record<string, string>
  ): Promise<CredentialsVerificationResult> {
    try {
      const { key_id, key_secret } = credentials;

      if (!key_id || !key_secret) {
        return {
          isValid: false,
          error: 'key_id and key_secret are required',
        };
      }

      // Test credentials by fetching a payment (will fail gracefully if invalid)
      const razorpay = new Razorpay({ key_id, key_secret });

      // Try to fetch account/merchant info (if API allows)
      // Razorpay doesn't have a dedicated "verify" endpoint, so we try a simple API call
      await razorpay.payments.all({ count: 1 });

      return {
        isValid: true,
        merchantInfo: {
          merchant_id: key_id,
          verified: true,
        },
      };
    } catch (error: any) {
      return {
        isValid: false,
        error: error.message || 'Invalid credentials',
      };
    }
  }

  /**
   * Get payment status from Razorpay
   */
  async getPaymentStatus(
    paymentId: string,
    processor: PaymentProcessor
  ): Promise<{
    status: 'pending' | 'succeeded' | 'failed' | 'canceled';
    amount: number;
    metadata?: Record<string, any>;
  }> {
    try {
      const razorpay = this.getRazorpayClient(processor);
      const razorpayPayment = await razorpay.payments.fetch(paymentId);

      // Map Razorpay status to our status
      let status: 'pending' | 'succeeded' | 'failed' | 'canceled';
      switch (razorpayPayment.status) {
        case 'captured':
        case 'authorized':
          status = 'succeeded';
          break;
        case 'failed':
          status = 'failed';
          break;
        case 'created':
          status = 'pending';
          break;
        default:
          status = 'pending';
      }

      return {
        status,
        amount: razorpayPayment.amount,
        metadata: {
          method: razorpayPayment.method,
          email: razorpayPayment.email,
          contact: razorpayPayment.contact,
        },
      };
    } catch (error: any) {
      throw new Error(`Failed to fetch payment status: ${error.message}`);
    }
  }

  /**
   * Calculate Razorpay fee
   * Default: 2% (can be 1.75% with volume discount)
   */
  calculateFee(amountCents: number, processor: PaymentProcessor): number {
    const feePercentage = processor.fee_percentage || 2.0;
    const fixedFee = processor.fixed_fee_cents || 0;

    return Math.round((amountCents * feePercentage) / 100) + fixedFee;
  }

  // ========== Private Webhook Handlers ==========

  private async handlePaymentAuthorized(payload: any): Promise<Payment | null> {
    const payment = await this.paymentRepository.findOne({
      where: { processor_payment_id: payload.order_id },
    });

    if (!payment) {
      console.warn(`Payment not found for Razorpay order: ${payload.order_id}`);
      return null;
    }

    // Update payment with charge ID
    payment.processor_charge_id = payload.id;
    payment.payment_method = payload.method;
    payment.payment_method_details = {
      card_last4: payload.card?.last4,
      card_network: payload.card?.network,
      upi: payload.vpa,
      wallet: payload.wallet,
    };

    await this.paymentRepository.save(payment);

    return payment;
  }

  private async handlePaymentCaptured(payload: any): Promise<Payment | null> {
    const payment = await this.paymentRepository.findOne({
      where: { processor_payment_id: payload.order_id },
      relations: ['order'],
    });

    if (!payment) {
      console.warn(`Payment not found for Razorpay order: ${payload.order_id}`);
      return null;
    }

    payment.status = 'succeeded';
    payment.processor_charge_id = payload.id;
    payment.payment_method = payload.method;
    payment.payment_method_details = {
      card_last4: payload.card?.last4,
      card_network: payload.card?.network,
      upi: payload.vpa,
      wallet: payload.wallet,
    };

    await this.paymentRepository.save(payment);

    // Update order status
    if (payment.order) {
      payment.order.payment_status = 'paid';
      await this.orderRepository.save(payment.order);
    }

    // Log metric
    if (process.env.NODE_ENV === 'production') {
      logMetric(console as any, 'razorpay_payment_captured', payment.amount_cents / 100, {
        paymentId: payment.id,
      });
    }

    return payment;
  }

  private async handlePaymentFailed(payload: any): Promise<Payment | null> {
    const payment = await this.paymentRepository.findOne({
      where: { processor_payment_id: payload.order_id },
      relations: ['order'],
    });

    if (!payment) {
      console.warn(`Payment not found for Razorpay order: ${payload.order_id}`);
      return null;
    }

    payment.status = 'failed';
    payment.failure_reason = payload.error_description || payload.error_reason;

    await this.paymentRepository.save(payment);

    // Update order status
    if (payment.order) {
      payment.order.payment_status = 'failed';
      await this.orderRepository.save(payment.order);
    }

    return payment;
  }

  private async handleRefundCreated(payload: any): Promise<Payment | null> {
    const payment = await this.paymentRepository.findOne({
      where: { processor_charge_id: payload.payment_id },
    });

    if (!payment) {
      console.warn(`Payment not found for Razorpay payment: ${payload.payment_id}`);
      return null;
    }

    payment.status = payload.amount === payment.amount_cents ? 'refunded' : payment.status;
    payment.refund_details = {
      refund_id: payload.id,
      refund_amount_cents: payload.amount,
      refunded_at: new Date(payload.created_at * 1000).toISOString(),
    };

    await this.paymentRepository.save(payment);

    return payment;
  }
}
