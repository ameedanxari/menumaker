import { Order } from '../../models/Order.js';
import { Payment } from '../../models/Payment.js';
import { PaymentProcessor } from '../../models/PaymentProcessor.js';

/**
 * Interface for all payment processor services
 * Phase 3: Multiple Payment Processors (US3.1)
 *
 * All payment processors (Stripe, Razorpay, PhonePe, Paytm) must implement this interface
 * to ensure consistent behavior and easy integration.
 *
 * @example
 * ```typescript
 * class RazorpayService implements IPaymentProcessorService {
 *   async createPayment(order, processor) { ... }
 *   async handleWebhook(rawBody, signature, processor) { ... }
 *   async createRefund(payment, amount, processor) { ... }
 *   async verifyCredentials(credentials) { ... }
 * }
 * ```
 */

export interface PaymentIntentResult {
  /**
   * Client secret or payment URL for frontend
   * - Stripe: client_secret (used with Stripe.js)
   * - Razorpay: order_id (used with Razorpay Checkout)
   * - PhonePe: payment URL (redirect URL)
   * - Paytm: payment URL (redirect URL)
   */
  clientSecret?: string;
  paymentUrl?: string;

  /**
   * Processor payment ID
   * Used for tracking and webhook correlation
   */
  paymentId: string;

  /**
   * Payment record in database
   */
  payment: Payment;

  /**
   * Additional processor-specific data
   * Can be used by frontend for initialization
   */
  additionalData?: Record<string, any>;
}

export interface WebhookResult {
  /**
   * Was the webhook processed successfully?
   */
  processed: boolean;

  /**
   * Event type (normalized across processors)
   * Examples: 'payment.succeeded', 'payment.failed', 'refund.completed'
   */
  eventType: string;

  /**
   * Unique webhook/event ID from processor
   */
  eventId: string;

  /**
   * Updated payment (if applicable)
   */
  payment?: Payment;
}

export interface RefundResult {
  /**
   * Refund ID from processor
   */
  refundId: string;

  /**
   * Refund amount (in cents)
   */
  amount: number;

  /**
   * Refund status
   */
  status: 'succeeded' | 'pending' | 'failed';

  /**
   * Updated payment record
   */
  payment: Payment;
}

export interface CredentialsVerificationResult {
  /**
   * Are credentials valid?
   */
  isValid: boolean;

  /**
   * Error message (if invalid)
   */
  error?: string;

  /**
   * Merchant/account details (if valid)
   */
  merchantInfo?: {
    merchant_id?: string;
    merchant_name?: string;
    email?: string;
    verified?: boolean;
  };
}

/**
 * Base interface for payment processor services
 */
export interface IPaymentProcessorService {
  /**
   * Create a payment intent/order
   *
   * @param order - Order to create payment for
   * @param processor - Payment processor configuration
   * @param options - Additional options (description, metadata, etc.)
   * @returns Payment intent result with client secret or payment URL
   */
  createPayment(
    order: Order,
    processor: PaymentProcessor,
    options?: {
      description?: string;
      metadata?: Record<string, string>;
      redirectUrl?: string;
      callbackUrl?: string;
    }
  ): Promise<PaymentIntentResult>;

  /**
   * Handle webhook from payment processor
   *
   * @param rawBody - Raw request body (for signature verification)
   * @param signature - Webhook signature header
   * @param processor - Payment processor configuration
   * @returns Webhook processing result
   */
  handleWebhook(
    rawBody: Buffer | string,
    signature: string,
    processor: PaymentProcessor
  ): Promise<WebhookResult>;

  /**
   * Create a refund for a payment
   *
   * @param payment - Payment to refund
   * @param amount - Amount to refund (in cents). If not provided, full refund.
   * @param processor - Payment processor configuration
   * @param reason - Refund reason
   * @returns Refund result
   */
  createRefund(
    payment: Payment,
    amount: number | undefined,
    processor: PaymentProcessor,
    reason?: string
  ): Promise<RefundResult>;

  /**
   * Verify processor credentials are valid
   *
   * @param credentials - Credentials to verify
   * @returns Verification result
   */
  verifyCredentials(
    credentials: Record<string, string>
  ): Promise<CredentialsVerificationResult>;

  /**
   * Get payment status from processor
   *
   * @param paymentId - Processor payment ID
   * @param processor - Payment processor configuration
   * @returns Payment status
   */
  getPaymentStatus(
    paymentId: string,
    processor: PaymentProcessor
  ): Promise<{
    status: 'pending' | 'succeeded' | 'failed' | 'canceled';
    amount: number;
    metadata?: Record<string, any>;
  }>;

  /**
   * Calculate processor fee for a payment
   *
   * @param amountCents - Payment amount (in cents)
   * @param processor - Payment processor configuration
   * @returns Fee amount (in cents)
   */
  calculateFee(amountCents: number, processor: PaymentProcessor): number;
}
