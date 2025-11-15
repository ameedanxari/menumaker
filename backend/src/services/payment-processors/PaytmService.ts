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
 * Paytm Payment Processor Service
 * Phase 3: Multiple Payment Processors (US3.1)
 *
 * Paytm is a popular Indian payment platform
 * Fee structure: 2% + GST (18%) = 2.36% total
 * Supports: UPI, cards, wallets, netbanking
 *
 * @see https://developer.paytm.com/docs/
 */
export class PaytmService implements IPaymentProcessorService {
  private readonly PAYTM_API_URL =
    process.env.PAYTM_API_URL || 'https://securegw.paytm.in';
  private paymentRepository: Repository<Payment>;
  private orderRepository: Repository<Order>;

  constructor() {
    this.paymentRepository = AppDataSource.getRepository(Payment);
    this.orderRepository = AppDataSource.getRepository(Order);
  }

  /**
   * Create a Paytm payment
   * Paytm uses redirect-based flow
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
      const { merchant_id, merchant_key, website } = processor.credentials;

      if (!merchant_id || !merchant_key || !website) {
        throw new Error(
          'Paytm credentials (merchant_id, merchant_key, website) are required'
        );
      }

      // Generate unique order ID
      const paytmOrderId = `MM_${order.id.replace(/-/g, '').slice(0, 20)}`;

      // Prepare payment parameters
      const paytmParams: Record<string, string> = {
        MID: merchant_id,
        WEBSITE: website,
        INDUSTRY_TYPE_ID: processor.credentials.industry_type || 'Retail',
        CHANNEL_ID: 'WEB',
        ORDER_ID: paytmOrderId,
        CUST_ID: order.business_id.slice(0, 64),
        MOBILE_NO: order.customer_phone?.replace(/[^0-9]/g, '').slice(-10) || '',
        EMAIL: order.metadata?.customer_email || '',
        TXN_AMOUNT: (order.total_cents / 100).toFixed(2), // Amount in rupees
        CALLBACK_URL: options?.callbackUrl || `${process.env.BACKEND_URL}/api/v1/payments/paytm/webhook`,
      };

      // Generate checksum
      const checksum = this.generateChecksum(paytmParams, merchant_key);
      paytmParams.CHECKSUMHASH = checksum;

      // For Paytm, we return a payment URL (redirect flow)
      const paymentUrl = `${this.PAYTM_API_URL}/theia/processTransaction`;

      // Calculate processor fee
      const processorFee = this.calculateFee(order.total_cents, processor);
      const netAmount = order.total_cents - processorFee;

      // Create payment record
      const payment = this.paymentRepository.create({
        order_id: order.id,
        business_id: order.business_id,
        payment_processor_id: processor.id,
        processor_type: 'paytm',
        processor_payment_id: paytmOrderId,
        amount_cents: order.total_cents,
        currency: order.currency,
        status: 'pending',
        processor_fee_cents: processorFee,
        net_amount_cents: netAmount,
        metadata: {
          paytm_order_id: paytmOrderId,
          paytm_params: paytmParams,
          ...options?.metadata,
        },
      });

      await this.paymentRepository.save(payment);

      // Update order
      order.payment_status = 'unpaid';
      await this.orderRepository.save(order);

      // Log metric
      if (process.env.NODE_ENV === 'production') {
        logMetric(console as any, 'paytm_payment_created', order.total_cents / 100, {
          businessId: order.business_id,
          orderId: order.id,
        });
      }

      return {
        paymentUrl,
        paymentId: paytmOrderId,
        payment,
        additionalData: {
          paytm_params: paytmParams,
        },
      };
    } catch (error: any) {
      const customError = new Error(
        `Paytm payment creation failed: ${error.message}`
      ) as Error & {
        statusCode: number;
        code: string;
        details: unknown;
      };
      customError.statusCode = 500;
      customError.code = 'PAYTM_PAYMENT_FAILED';
      customError.details = error;
      throw customError;
    }
  }

  /**
   * Handle Paytm webhook (callback)
   */
  async handleWebhook(
    rawBody: Buffer | string,
    signature: string,
    processor: PaymentProcessor
  ): Promise<WebhookResult> {
    const { merchant_key } = processor.credentials;

    if (!merchant_key) {
      throw new Error('Paytm merchant_key is required');
    }

    try {
      // Parse callback params
      const callbackParams =
        typeof rawBody === 'string' ? JSON.parse(rawBody) : JSON.parse(rawBody.toString());

      // Verify checksum
      const receivedChecksum = callbackParams.CHECKSUMHASH;
      delete callbackParams.CHECKSUMHASH;

      const isValid = this.verifyChecksum(callbackParams, merchant_key, receivedChecksum);

      if (!isValid) {
        throw new Error('Invalid Paytm checksum');
      }

      const { ORDERID, TXNID, STATUS, RESPCODE, RESPMSG, TXNAMOUNT } = callbackParams;

      // Find payment
      const payment = await this.paymentRepository.findOne({
        where: { processor_payment_id: ORDERID },
        relations: ['order'],
      });

      if (!payment) {
        console.warn(`Payment not found for Paytm order: ${ORDERID}`);
        return {
          processed: false,
          eventType: 'payment.unknown',
          eventId: TXNID,
        };
      }

      // Update payment
      payment.processor_charge_id = TXNID;
      payment.metadata = {
        ...payment.metadata,
        paytm_txn_id: TXNID,
        paytm_response_code: RESPCODE,
        paytm_response_message: RESPMSG,
      };

      if (STATUS === 'TXN_SUCCESS') {
        payment.status = 'succeeded';
        payment.payment_method = callbackParams.PAYMENTMODE || 'unknown';

        // Update order
        if (payment.order) {
          payment.order.payment_status = 'paid';
          await this.orderRepository.save(payment.order);
        }

        // Log metric
        if (process.env.NODE_ENV === 'production') {
          logMetric(console as any, 'paytm_payment_completed', payment.amount_cents / 100, {
            paymentId: payment.id,
          });
        }
      } else if (STATUS === 'TXN_FAILURE') {
        payment.status = 'failed';
        payment.failure_reason = RESPMSG || 'Transaction failed';

        if (payment.order) {
          payment.order.payment_status = 'failed';
          await this.orderRepository.save(payment.order);
        }
      }

      await this.paymentRepository.save(payment);

      return {
        processed: true,
        eventType: STATUS === 'TXN_SUCCESS' ? 'payment.succeeded' : 'payment.failed',
        eventId: TXNID,
        payment,
      };
    } catch (error: any) {
      const customError = new Error(
        `Paytm webhook processing failed: ${error.message}`
      ) as Error & {
        statusCode: number;
        code: string;
      };
      customError.statusCode = 400;
      customError.code = 'PAYTM_WEBHOOK_FAILED';
      throw customError;
    }
  }

  /**
   * Create refund
   */
  async createRefund(
    payment: Payment,
    amount: number | undefined,
    processor: PaymentProcessor,
    reason?: string
  ): Promise<RefundResult> {
    try {
      const { merchant_id, merchant_key } = processor.credentials;

      if (!merchant_id || !merchant_key) {
        throw new Error('Paytm credentials are required');
      }

      const refundAmount = amount || payment.amount_cents;
      const refundId = `REF_${payment.id.replace(/-/g, '').slice(0, 20)}`;

      // Prepare refund params
      const refundParams: Record<string, string> = {
        MID: merchant_id,
        ORDERID: payment.processor_payment_id!,
        TXNID: payment.processor_charge_id!,
        REFID: refundId,
        REFUNDAMOUNT: (refundAmount / 100).toFixed(2),
        TXNTYPE: 'REFUND',
      };

      // Generate checksum
      const checksum = this.generateChecksum(refundParams, merchant_key);
      refundParams.CHECKSUMHASH = checksum;

      // Make refund API call
      const response = await axios.post(
        `${this.PAYTM_API_URL}/refund/apply`,
        refundParams,
        {
          headers: { 'Content-Type': 'application/json' },
        }
      );

      if (response.data.STATUS !== 'TXN_SUCCESS') {
        throw new Error(response.data.RESPMSG || 'Paytm refund failed');
      }

      // Update payment
      payment.status = refundAmount === payment.amount_cents ? 'refunded' : payment.status;
      payment.refund_details = {
        refund_id: refundId,
        refund_amount_cents: refundAmount,
        refund_reason: reason,
        refunded_at: new Date().toISOString(),
      };

      await this.paymentRepository.save(payment);

      // Log metric
      if (process.env.NODE_ENV === 'production') {
        logMetric(console as any, 'paytm_refund_created', refundAmount / 100, {
          paymentId: payment.id,
        });
      }

      return {
        refundId,
        amount: refundAmount,
        status: 'succeeded',
        payment,
      };
    } catch (error: any) {
      const customError = new Error(
        `Paytm refund failed: ${error.message}`
      ) as Error & {
        statusCode: number;
        code: string;
      };
      customError.statusCode = 500;
      customError.code = 'PAYTM_REFUND_FAILED';
      throw customError;
    }
  }

  /**
   * Verify Paytm credentials
   */
  async verifyCredentials(
    credentials: Record<string, string>
  ): Promise<CredentialsVerificationResult> {
    try {
      const { merchant_id, merchant_key, website } = credentials;

      if (!merchant_id || !merchant_key || !website) {
        return {
          isValid: false,
          error: 'merchant_id, merchant_key, and website are required',
        };
      }

      // Basic format validation
      if (merchant_id.length < 5 || merchant_key.length < 10) {
        return {
          isValid: false,
          error: 'Invalid credential format',
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
      const { merchant_id, merchant_key } = processor.credentials;

      // Status check params
      const statusParams: Record<string, string> = {
        MID: merchant_id,
        ORDERID: paymentId,
      };

      const checksum = this.generateChecksum(statusParams, merchant_key);
      statusParams.CHECKSUMHASH = checksum;

      const response = await axios.post(
        `${this.PAYTM_API_URL}/order/status`,
        statusParams,
        {
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const { STATUS, TXNAMOUNT } = response.data;

      // Map Paytm status
      let status: 'pending' | 'succeeded' | 'failed' | 'canceled';
      switch (STATUS) {
        case 'TXN_SUCCESS':
          status = 'succeeded';
          break;
        case 'TXN_FAILURE':
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
        amount: Math.round(parseFloat(TXNAMOUNT) * 100), // Convert to cents
        metadata: response.data,
      };
    } catch (error: any) {
      throw new Error(`Failed to fetch Paytm payment status: ${error.message}`);
    }
  }

  /**
   * Calculate Paytm fee
   * 2% + 18% GST = 2.36% total
   */
  calculateFee(amountCents: number, processor: PaymentProcessor): number {
    const feePercentage = processor.fee_percentage || 2.36;
    const fixedFee = processor.fixed_fee_cents || 0;

    return Math.round((amountCents * feePercentage) / 100) + fixedFee;
  }

  // ========== Private Checksum Methods ==========

  private generateChecksum(params: Record<string, string>, merchantKey: string): string {
    // Sort params and create string
    const sortedParams = Object.keys(params)
      .sort()
      .map((key) => `${key}=${params[key]}`)
      .join('&');

    // Generate checksum
    return crypto
      .createHash('sha256')
      .update(sortedParams + merchantKey)
      .digest('hex');
  }

  private verifyChecksum(
    params: Record<string, string>,
    merchantKey: string,
    receivedChecksum: string
  ): boolean {
    const calculatedChecksum = this.generateChecksum(params, merchantKey);
    return calculatedChecksum === receivedChecksum;
  }
}
