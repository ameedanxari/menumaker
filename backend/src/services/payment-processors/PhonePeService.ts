import crypto from 'crypto';
import axios from 'axios';
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
 * PhonePe Payment Processor Service
 * Phase 3: Multiple Payment Processors (US3.1)
 *
 * PhonePe is a popular Indian payment platform
 * Fee structure: 1% + GST (18%) = 1.18% total
 * Supports: UPI, cards, wallets, netbanking
 *
 * @see https://developer.phonepe.com/v1/docs/payment-gateway
 */
export class PhonePeService implements IPaymentProcessorService {
  private readonly PHONEPE_API_URL =
    process.env.PHONEPE_API_URL || 'https://api.phonepe.com/apis/hermes';
  private paymentRepository: Repository<Payment>;
  private orderRepository: Repository<Order>;

  constructor() {
    this.paymentRepository = AppDataSource.getRepository(Payment);
    this.orderRepository = AppDataSource.getRepository(Order);
  }

  /**
   * Create a PhonePe payment
   * PhonePe uses redirect-based flow
   */
  async createPayment(
    order: Order,
    processor: PaymentProcessor,
    options?: {
      description?: string;
      metadata?: Record<string, string>;
      redirectUrl?: string;
      callbackUrl?: string;
    }
  ): Promise<PaymentIntentResult> {
    try {
      const { merchant_id, salt_key, salt_index } = processor.credentials;

      if (!merchant_id || !salt_key || !salt_index) {
        throw new Error(
          'PhonePe credentials (merchant_id, salt_key, salt_index) are required'
        );
      }

      // Generate unique transaction ID
      const merchantTransactionId = `MM_${order.id.replace(/-/g, '').slice(0, 20)}`;

      // Prepare payment request
      const paymentRequest = {
        merchantId: merchant_id,
        merchantTransactionId,
        merchantUserId: order.business_id.replace(/-/g, '').slice(0, 32),
        amount: order.total_cents, // Amount in paise
        redirectUrl: options?.redirectUrl || `${process.env.FRONTEND_URL}/payment/callback`,
        redirectMode: 'POST',
        callbackUrl: options?.callbackUrl || `${process.env.BACKEND_URL}/api/v1/payments/phonepe/webhook`,
        mobileNumber: order.customer_phone?.replace(/[^0-9]/g, '').slice(-10),
        paymentInstrument: {
          type: 'PAY_PAGE', // PhonePe hosted payment page
        },
      };

      // Encode payload in base64
      const payload = Buffer.from(JSON.stringify(paymentRequest)).toString('base64');

      // Generate X-VERIFY checksum
      const checksumString = `${payload}/pg/v1/pay${salt_key}`;
      const checksum = crypto.createHash('sha256').update(checksumString).digest('hex');
      const xVerify = `${checksum}###${salt_index}`;

      // Make API request
      const response = await axios.post(
        `${this.PHONEPE_API_URL}/pg/v1/pay`,
        {
          request: payload,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-VERIFY': xVerify,
          },
        }
      );

      if (!response.data.success) {
        throw new Error(
          response.data.message || 'PhonePe payment creation failed'
        );
      }

      // Calculate processor fee
      const processorFee = this.calculateFee(order.total_cents, processor);
      const netAmount = order.total_cents - processorFee;

      // Create payment record
      const payment = this.paymentRepository.create({
        order_id: order.id,
        business_id: order.business_id,
        payment_processor_id: processor.id,
        processor_type: 'phonepe',
        processor_payment_id: merchantTransactionId,
        amount_cents: order.total_cents,
        currency: order.currency,
        status: 'pending',
        processor_fee_cents: processorFee,
        net_amount_cents: netAmount,
        metadata: {
          merchant_transaction_id: merchantTransactionId,
          phonepe_transaction_id: response.data.data?.transactionId,
          ...options?.metadata,
        },
      });

      await this.paymentRepository.save(payment);

      // Update order
      order.payment_status = 'unpaid';
      await this.orderRepository.save(order);

      // Log metric
      if (process.env.NODE_ENV === 'production') {
        logMetric(console as any, 'phonepe_payment_created', order.total_cents / 100, {
          businessId: order.business_id,
          orderId: order.id,
        });
      }

      return {
        paymentUrl: response.data.data.instrumentResponse.redirectInfo.url,
        paymentId: merchantTransactionId,
        payment,
        additionalData: {
          merchant_transaction_id: merchantTransactionId,
          transaction_id: response.data.data?.transactionId,
        },
      };
    } catch (error: any) {
      const customError = new Error(
        `PhonePe payment creation failed: ${error.message}`
      ) as Error & {
        statusCode: number;
        code: string;
        details: unknown;
      };
      customError.statusCode = 500;
      customError.code = 'PHONEPE_PAYMENT_FAILED';
      customError.details = error.response?.data || error;
      throw customError;
    }
  }

  /**
   * Handle PhonePe webhook (callback)
   */
  async handleWebhook(
    rawBody: Buffer | string,
    signature: string,
    processor: PaymentProcessor
  ): Promise<WebhookResult> {
    const { salt_key, salt_index } = processor.credentials;

    if (!salt_key || !salt_index) {
      throw new Error('PhonePe salt_key and salt_index are required');
    }

    try {
      // Parse webhook body
      const webhookData = JSON.parse(rawBody.toString());
      const { response: base64Response } = webhookData;

      // Verify checksum
      const checksumString = `${base64Response}${salt_key}`;
      const calculatedChecksum = crypto
        .createHash('sha256')
        .update(checksumString)
        .digest('hex');
      const expectedXVerify = `${calculatedChecksum}###${salt_index}`;

      if (signature !== expectedXVerify) {
        throw new Error('Invalid webhook signature');
      }

      // Decode response
      const decodedResponse = JSON.parse(
        Buffer.from(base64Response, 'base64').toString('utf-8')
      );

      const { merchantTransactionId, transactionId, state, responseCode } =
        decodedResponse.data;

      let payment: Payment | null = null;

      // Find payment by merchant transaction ID
      payment = await this.paymentRepository.findOne({
        where: { processor_payment_id: merchantTransactionId },
        relations: ['order'],
      });

      if (!payment) {
        console.warn(`Payment not found for PhonePe transaction: ${merchantTransactionId}`);
        return {
          processed: false,
          eventType: 'payment.unknown',
          eventId: transactionId,
        };
      }

      // Update payment based on state
      payment.processor_charge_id = transactionId;
      payment.metadata = {
        ...payment.metadata,
        phonepe_transaction_id: transactionId,
        phonepe_response_code: responseCode,
        phonepe_state: state,
      };

      if (state === 'COMPLETED') {
        payment.status = 'succeeded';
        payment.payment_method = decodedResponse.data.paymentInstrument?.type || 'unknown';

        // Update order
        if (payment.order) {
          payment.order.payment_status = 'paid';
          await this.orderRepository.save(payment.order);
        }

        // Log metric
        if (process.env.NODE_ENV === 'production') {
          logMetric(console as any, 'phonepe_payment_completed', payment.amount_cents / 100, {
            paymentId: payment.id,
          });
        }
      } else if (state === 'FAILED') {
        payment.status = 'failed';
        payment.failure_reason = responseCode || 'Payment failed';

        if (payment.order) {
          payment.order.payment_status = 'failed';
          await this.orderRepository.save(payment.order);
        }
      }

      await this.paymentRepository.save(payment);

      return {
        processed: true,
        eventType: state === 'COMPLETED' ? 'payment.succeeded' : 'payment.failed',
        eventId: transactionId,
        payment,
      };
    } catch (error: any) {
      const customError = new Error(
        `PhonePe webhook processing failed: ${error.message}`
      ) as Error & {
        statusCode: number;
        code: string;
      };
      customError.statusCode = 400;
      customError.code = 'PHONEPE_WEBHOOK_FAILED';
      throw customError;
    }
  }

  /**
   * Create refund (PhonePe supports refunds)
   */
  async createRefund(
    payment: Payment,
    amount: number | undefined,
    processor: PaymentProcessor,
    reason?: string
  ): Promise<RefundResult> {
    try {
      const { merchant_id, salt_key, salt_index } = processor.credentials;

      if (!merchant_id || !salt_key || !salt_index) {
        throw new Error('PhonePe credentials are required');
      }

      const refundAmount = amount || payment.amount_cents;
      const merchantRefundId = `REF_${payment.id.replace(/-/g, '').slice(0, 20)}`;

      // Prepare refund request
      const refundRequest = {
        merchantId: merchant_id,
        merchantTransactionId: payment.processor_payment_id,
        originalTransactionId: payment.processor_charge_id,
        amount: refundAmount,
        callbackUrl: `${process.env.BACKEND_URL}/api/v1/payments/phonepe/refund-webhook`,
      };

      // Encode and create checksum
      const payload = Buffer.from(JSON.stringify(refundRequest)).toString('base64');
      const checksumString = `${payload}/pg/v1/refund${salt_key}`;
      const checksum = crypto.createHash('sha256').update(checksumString).digest('hex');
      const xVerify = `${checksum}###${salt_index}`;

      // Make API request
      const response = await axios.post(
        `${this.PHONEPE_API_URL}/pg/v1/refund`,
        { request: payload },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-VERIFY': xVerify,
          },
        }
      );

      if (!response.data.success) {
        throw new Error(response.data.message || 'PhonePe refund failed');
      }

      // Update payment
      payment.status = refundAmount === payment.amount_cents ? 'refunded' : payment.status;
      payment.refund_details = {
        refund_id: merchantRefundId,
        refund_amount_cents: refundAmount,
        refund_reason: reason,
        refunded_at: new Date().toISOString(),
      };

      await this.paymentRepository.save(payment);

      // Log metric
      if (process.env.NODE_ENV === 'production') {
        logMetric(console as any, 'phonepe_refund_created', refundAmount / 100, {
          paymentId: payment.id,
        });
      }

      return {
        refundId: merchantRefundId,
        amount: refundAmount,
        status: 'succeeded',
        payment,
      };
    } catch (error: any) {
      const customError = new Error(
        `PhonePe refund failed: ${error.message}`
      ) as Error & {
        statusCode: number;
        code: string;
      };
      customError.statusCode = 500;
      customError.code = 'PHONEPE_REFUND_FAILED';
      throw customError;
    }
  }

  /**
   * Verify PhonePe credentials
   */
  async verifyCredentials(
    credentials: Record<string, string>
  ): Promise<CredentialsVerificationResult> {
    try {
      const { merchant_id, salt_key, salt_index } = credentials;

      if (!merchant_id || !salt_key || !salt_index) {
        return {
          isValid: false,
          error: 'merchant_id, salt_key, and salt_index are required',
        };
      }

      // PhonePe doesn't have a dedicated verify endpoint
      // We can validate format and structure
      if (merchant_id.length < 5 || salt_key.length < 10) {
        return {
          isValid: false,
          error: 'Invalid merchant_id or salt_key format',
        };
      }

      return {
        isValid: true,
        merchantInfo: {
          merchant_id,
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
   * Get payment status
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
      const { merchant_id, salt_key, salt_index } = processor.credentials;

      // Generate checksum for status check
      const checksumString = `/pg/v1/status/${merchant_id}/${paymentId}${salt_key}`;
      const checksum = crypto.createHash('sha256').update(checksumString).digest('hex');
      const xVerify = `${checksum}###${salt_index}`;

      // Make API request
      const response = await axios.get(
        `${this.PHONEPE_API_URL}/pg/v1/status/${merchant_id}/${paymentId}`,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-VERIFY': xVerify,
          },
        }
      );

      const { state, amount } = response.data.data;

      // Map PhonePe state to our status
      let status: 'pending' | 'succeeded' | 'failed' | 'canceled';
      switch (state) {
        case 'COMPLETED':
          status = 'succeeded';
          break;
        case 'FAILED':
          status = 'failed';
          break;
        case 'PENDING':
          status = 'pending';
          break;
        default:
          status = 'pending';
      }

      return {
        status,
        amount,
        metadata: response.data.data,
      };
    } catch (error: any) {
      throw new Error(`Failed to fetch PhonePe payment status: ${error.message}`);
    }
  }

  /**
   * Calculate PhonePe fee
   * 1% + 18% GST = 1.18% total
   */
  calculateFee(amountCents: number, processor: PaymentProcessor): number {
    const feePercentage = processor.fee_percentage || 1.18;
    const fixedFee = processor.fixed_fee_cents || 0;

    return Math.round((amountCents * feePercentage) / 100) + fixedFee;
  }
}
