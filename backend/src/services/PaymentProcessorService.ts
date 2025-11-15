import { Repository, Between, In } from 'typeorm';
import { AppDataSource } from '../config/database.js';
import { Order } from '../models/Order.js';
import { Payment } from '../models/Payment.js';
import { PaymentProcessor, ProcessorType } from '../models/PaymentProcessor.js';
import { StripeService } from './StripeService.js';
import { RazorpayService } from './payment-processors/RazorpayService.js';
import { PhonePeService } from './payment-processors/PhonePeService.js';
import { PaytmService } from './payment-processors/PaytmService.js';
import {
  IPaymentProcessorService,
  PaymentIntentResult,
  WebhookResult,
  RefundResult,
} from './payment-processors/IPaymentProcessorService.js';

/**
 * Payment Processor Service
 * Phase 3: Multiple Payment Processors (US3.1)
 *
 * Orchestrates payment processing across multiple processors
 * Handles:
 * - Processor selection and routing
 * - Automatic fallback to next priority processor
 * - Reconciliation and settlement reports
 * - Cost transparency
 *
 * @example
 * ```typescript
 * const service = new PaymentProcessorService();
 *
 * // Create payment with automatic processor selection
 * const result = await service.createPayment(order, businessId);
 *
 * // Handle webhook (processor auto-detected)
 * await service.handleWebhook('razorpay', rawBody, signature);
 *
 * // Create refund (routed to original processor)
 * await service.createRefund(paymentId, amount, reason);
 * ```
 */
export class PaymentProcessorService {
  private processorRepository: Repository<PaymentProcessor>;
  private paymentRepository: Repository<Payment>;

  // Processor service instances
  private stripeService: StripeService;
  private razorpayService: RazorpayService;
  private phonepeService: PhonePeService;
  private paytmService: PaytmService;

  constructor() {
    this.processorRepository = AppDataSource.getRepository(PaymentProcessor);
    this.paymentRepository = AppDataSource.getRepository(Payment);

    this.stripeService = new StripeService();
    this.razorpayService = new RazorpayService();
    this.phonepeService = new PhonePeService();
    this.paytmService = new PaytmService();
  }

  /**
   * Get processor service instance
   */
  private getProcessorService(processorType: ProcessorType): IPaymentProcessorService {
    switch (processorType) {
      case 'stripe':
        // StripeService doesn't implement interface directly yet
        // We'll wrap it in the next step
        throw new Error('Stripe service needs interface adapter');
      case 'razorpay':
        return this.razorpayService;
      case 'phonepe':
        return this.phonepeService;
      case 'paytm':
        return this.paytmService;
      default:
        throw new Error(`Unsupported processor type: ${processorType}`);
    }
  }

  /**
   * Get active payment processors for a business (sorted by priority)
   */
  async getActiveProcessors(businessId: string): Promise<PaymentProcessor[]> {
    return this.processorRepository.find({
      where: {
        business_id: businessId,
        is_active: true,
        status: 'active',
      },
      order: {
        priority: 'ASC', // Lower number = higher priority
      },
    });
  }

  /**
   * Create payment with automatic processor selection and fallback
   *
   * @param order - Order to create payment for
   * @param businessId - Business ID
   * @param preferredProcessorId - (Optional) Specific processor to use
   * @param options - Payment options
   * @returns Payment intent result
   */
  async createPayment(
    order: Order,
    businessId: string,
    preferredProcessorId?: string,
    options?: {
      description?: string;
      metadata?: Record<string, string>;
      redirectUrl?: string;
      callbackUrl?: string;
    }
  ): Promise<PaymentIntentResult> {
    // Get active processors
    const processors = await this.getActiveProcessors(businessId);

    if (processors.length === 0) {
      throw new Error('No active payment processors configured for this business');
    }

    // If preferred processor specified, move it to front
    if (preferredProcessorId) {
      const preferredIndex = processors.findIndex((p) => p.id === preferredProcessorId);
      if (preferredIndex > 0) {
        const [preferred] = processors.splice(preferredIndex, 1);
        processors.unshift(preferred);
      }
    }

    // Try processors in priority order
    const errors: Array<{ processor: string; error: string }> = [];

    for (const processor of processors) {
      try {
        console.log(
          `Attempting payment with processor: ${processor.processor_type} (priority: ${processor.priority})`
        );

        const service = this.getProcessorService(processor.processor_type);
        const result = await service.createPayment(order, processor, options);

        // Update processor last transaction timestamp
        processor.last_transaction_at = new Date();
        await this.processorRepository.save(processor);

        console.log(
          `Payment created successfully with ${processor.processor_type}: ${result.paymentId}`
        );

        return result;
      } catch (error: any) {
        console.error(
          `Payment failed with ${processor.processor_type}: ${error.message}`
        );

        errors.push({
          processor: processor.processor_type,
          error: error.message,
        });

        // Update processor connection error
        processor.connection_error = error.message;
        await this.processorRepository.save(processor);

        // Continue to next processor
        continue;
      }
    }

    // All processors failed
    const errorMessage = errors
      .map((e) => `${e.processor}: ${e.error}`)
      .join('; ');

    throw new Error(`All payment processors failed: ${errorMessage}`);
  }

  /**
   * Handle webhook from any processor
   *
   * @param processorType - Processor type (stripe, razorpay, phonepe, paytm)
   * @param rawBody - Raw request body
   * @param signature - Webhook signature header
   * @param processorId - (Optional) Specific processor ID
   * @returns Webhook result
   */
  async handleWebhook(
    processorType: ProcessorType,
    rawBody: Buffer | string,
    signature: string,
    processorId?: string
  ): Promise<WebhookResult> {
    // Find processor by type (and ID if provided)
    const whereClause: any = {
      processor_type: processorType,
      is_active: true,
    };

    if (processorId) {
      whereClause.id = processorId;
    }

    const processor = await this.processorRepository.findOne({
      where: whereClause,
    });

    if (!processor) {
      throw new Error(
        `No active ${processorType} processor found${processorId ? ` with ID ${processorId}` : ''}`
      );
    }

    // Get processor service and handle webhook
    const service = this.getProcessorService(processorType);
    const result = await service.handleWebhook(rawBody, signature, processor);

    // Update processor last transaction timestamp
    processor.last_transaction_at = new Date();
    processor.connection_error = null; // Clear any previous errors
    processor.verified_at = new Date();
    await this.processorRepository.save(processor);

    return result;
  }

  /**
   * Create refund (routed to original processor)
   *
   * @param paymentId - Payment ID to refund
   * @param amount - Amount to refund (in cents). If not provided, full refund.
   * @param reason - Refund reason
   * @returns Refund result
   */
  async createRefund(
    paymentId: string,
    amount?: number,
    reason?: string
  ): Promise<RefundResult> {
    // Find payment with processor info
    const payment = await this.paymentRepository.findOne({
      where: { id: paymentId },
      relations: ['payment_processor'],
    });

    if (!payment) {
      throw new Error('Payment not found');
    }

    if (!payment.payment_processor) {
      throw new Error('Payment processor not found for this payment');
    }

    if (payment.status !== 'succeeded') {
      throw new Error('Can only refund succeeded payments');
    }

    // Get processor service
    const service = this.getProcessorService(
      payment.payment_processor.processor_type
    );

    // Create refund
    return service.createRefund(payment, amount, payment.payment_processor, reason);
  }

  /**
   * Get payment status from processor
   *
   * @param paymentId - Payment ID
   * @returns Payment status
   */
  async getPaymentStatus(paymentId: string): Promise<{
    status: 'pending' | 'succeeded' | 'failed' | 'canceled';
    amount: number;
    metadata?: Record<string, any>;
  }> {
    const payment = await this.paymentRepository.findOne({
      where: { id: paymentId },
      relations: ['payment_processor'],
    });

    if (!payment || !payment.payment_processor) {
      throw new Error('Payment or processor not found');
    }

    const service = this.getProcessorService(
      payment.payment_processor.processor_type
    );

    return service.getPaymentStatus(
      payment.processor_payment_id!,
      payment.payment_processor
    );
  }

  /**
   * Generate settlement/reconciliation report
   *
   * @param businessId - Business ID
   * @param startDate - Report start date
   * @param endDate - Report end date
   * @returns Settlement report
   */
  async generateSettlementReport(
    businessId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    summary: {
      total_orders: number;
      total_amount_cents: number;
      total_fees_cents: number;
      net_payout_cents: number;
    };
    by_processor: Array<{
      processor_type: string;
      processor_name: string;
      order_count: number;
      gross_amount_cents: number;
      fee_amount_cents: number;
      net_amount_cents: number;
      settlement_schedule: string;
      average_fee_percentage: number;
    }>;
    payments: Array<{
      payment_id: string;
      order_id: string;
      processor_type: string;
      amount_cents: number;
      fee_cents: number;
      net_cents: number;
      status: string;
      created_at: Date;
      settled: boolean;
    }>;
  }> {
    // Get all payments in date range for business
    const payments = await this.paymentRepository.find({
      where: {
        business_id: businessId,
        status: In(['succeeded', 'refunded']),
        created_at: Between(startDate, endDate),
      },
      relations: ['payment_processor', 'order'],
      order: {
        created_at: 'ASC',
      },
    });

    // Calculate summary
    const summary = {
      total_orders: payments.length,
      total_amount_cents: payments.reduce((sum, p) => sum + p.amount_cents, 0),
      total_fees_cents: payments.reduce((sum, p) => sum + p.processor_fee_cents, 0),
      net_payout_cents: payments.reduce((sum, p) => sum + p.net_amount_cents, 0),
    };

    // Group by processor
    const byProcessorMap = new Map<
      string,
      {
        processor_type: string;
        processor_name: string;
        order_count: number;
        gross_amount_cents: number;
        fee_amount_cents: number;
        net_amount_cents: number;
        settlement_schedule: string;
        average_fee_percentage: number;
      }
    >();

    for (const payment of payments) {
      const processorType = payment.processor_type || 'unknown';

      if (!byProcessorMap.has(processorType)) {
        byProcessorMap.set(processorType, {
          processor_type: processorType,
          processor_name: payment.payment_processor?.metadata?.merchant_name || processorType,
          order_count: 0,
          gross_amount_cents: 0,
          fee_amount_cents: 0,
          net_amount_cents: 0,
          settlement_schedule: payment.payment_processor?.settlement_schedule || 'unknown',
          average_fee_percentage: 0,
        });
      }

      const processorStats = byProcessorMap.get(processorType)!;
      processorStats.order_count++;
      processorStats.gross_amount_cents += payment.amount_cents;
      processorStats.fee_amount_cents += payment.processor_fee_cents;
      processorStats.net_amount_cents += payment.net_amount_cents;
    }

    // Calculate average fee percentages
    for (const stats of byProcessorMap.values()) {
      if (stats.gross_amount_cents > 0) {
        stats.average_fee_percentage =
          (stats.fee_amount_cents / stats.gross_amount_cents) * 100;
      }
    }

    const by_processor = Array.from(byProcessorMap.values());

    // Format payment list
    const paymentList = payments.map((p) => ({
      payment_id: p.id,
      order_id: p.order_id,
      processor_type: p.processor_type || 'unknown',
      amount_cents: p.amount_cents,
      fee_cents: p.processor_fee_cents,
      net_cents: p.net_amount_cents,
      status: p.status,
      created_at: p.created_at,
      settled: p.settlement_details?.settlement_status === 'settled',
    }));

    return {
      summary,
      by_processor,
      payments: paymentList,
    };
  }

  /**
   * Connect a new payment processor
   *
   * @param businessId - Business ID
   * @param processorType - Processor type
   * @param credentials - Processor credentials
   * @param options - Additional options
   * @returns Created processor
   */
  async connectProcessor(
    businessId: string,
    processorType: ProcessorType,
    credentials: Record<string, string>,
    options?: {
      priority?: number;
      settlement_schedule?: 'daily' | 'weekly' | 'monthly';
      min_payout_threshold_cents?: number;
      fee_percentage?: number;
      fixed_fee_cents?: number;
    }
  ): Promise<PaymentProcessor> {
    // Verify credentials
    const service = this.getProcessorService(processorType);
    const verification = await service.verifyCredentials(credentials);

    if (!verification.isValid) {
      throw new Error(`Invalid credentials: ${verification.error}`);
    }

    // Check if processor already exists
    const existing = await this.processorRepository.findOne({
      where: {
        business_id: businessId,
        processor_type: processorType,
      },
    });

    if (existing) {
      // Update existing processor
      existing.credentials = credentials;
      existing.is_active = true;
      existing.status = 'active';
      existing.verified_at = new Date();
      existing.connection_error = null;
      existing.metadata = {
        ...existing.metadata,
        ...verification.merchantInfo,
      };

      if (options?.priority !== undefined) existing.priority = options.priority;
      if (options?.settlement_schedule)
        existing.settlement_schedule = options.settlement_schedule;
      if (options?.min_payout_threshold_cents !== undefined)
        existing.min_payout_threshold_cents = options.min_payout_threshold_cents;
      if (options?.fee_percentage !== undefined)
        existing.fee_percentage = options.fee_percentage;
      if (options?.fixed_fee_cents !== undefined)
        existing.fixed_fee_cents = options.fixed_fee_cents;

      return this.processorRepository.save(existing);
    }

    // Create new processor
    const processor = this.processorRepository.create({
      business_id: businessId,
      processor_type: processorType,
      status: 'active',
      is_active: true,
      credentials,
      priority: options?.priority || 999,
      settlement_schedule: options?.settlement_schedule || 'weekly',
      min_payout_threshold_cents: options?.min_payout_threshold_cents || 50000,
      fee_percentage: options?.fee_percentage || this.getDefaultFeePercentage(processorType),
      fixed_fee_cents: options?.fixed_fee_cents || 0,
      verified_at: new Date(),
      metadata: verification.merchantInfo,
    });

    return this.processorRepository.save(processor);
  }

  /**
   * Disconnect a payment processor
   *
   * @param processorId - Processor ID to disconnect
   * @returns Updated processor
   */
  async disconnectProcessor(processorId: string): Promise<PaymentProcessor> {
    const processor = await this.processorRepository.findOne({
      where: { id: processorId },
    });

    if (!processor) {
      throw new Error('Processor not found');
    }

    processor.is_active = false;
    processor.status = 'inactive';

    return this.processorRepository.save(processor);
  }

  /**
   * Get default fee percentage for processor
   */
  private getDefaultFeePercentage(processorType: ProcessorType): number {
    switch (processorType) {
      case 'stripe':
        return 2.9;
      case 'razorpay':
        return 2.0;
      case 'phonepe':
        return 1.18; // 1% + 18% GST
      case 'paytm':
        return 2.36; // 2% + 18% GST
      default:
        return 2.0;
    }
  }
}
