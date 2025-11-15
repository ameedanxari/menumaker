import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Order } from './Order.js';
import { Business } from './Business.js';
import { PaymentProcessor } from './PaymentProcessor.js';

export type PaymentStatus = 'pending' | 'succeeded' | 'failed' | 'canceled' | 'refunded';

/**
 * Payment Entity
 * Supports multiple payment processors (Phase 3 - US3.1)
 *
 * Backwards compatible with existing Stripe-only fields
 */
@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  order_id!: string;

  @ManyToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order!: Order;

  @Column({ type: 'uuid' })
  business_id!: string;

  @ManyToOne(() => Business, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'business_id' })
  business!: Business;

  // ========== Phase 3: Multi-Processor Support ==========

  /**
   * Payment processor ID (reference to PaymentProcessor entity)
   * Links this payment to the processor configuration used
   */
  @Column({ type: 'uuid', nullable: true })
  payment_processor_id?: string;

  @ManyToOne(() => PaymentProcessor, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'payment_processor_id' })
  payment_processor?: PaymentProcessor;

  /**
   * Processor type used for this payment
   * 'stripe' | 'razorpay' | 'phonepe' | 'paytm'
   */
  @Column({ type: 'varchar', length: 50, nullable: true, default: 'stripe' })
  processor_type?: string;

  /**
   * Generic processor payment ID
   * Replaces processor-specific fields (stripe_payment_intent_id, etc.)
   *
   * Examples:
   * - Stripe: pi_xxx (payment intent ID)
   * - Razorpay: pay_xxx (payment ID)
   * - PhonePe: merchantTransactionId
   * - Paytm: ORDER_ID
   */
  @Column({ type: 'varchar', length: 255, nullable: true })
  processor_payment_id?: string;

  /**
   * Generic processor charge/transaction ID
   * Used for refunds and reconciliation
   *
   * Examples:
   * - Stripe: ch_xxx (charge ID)
   * - Razorpay: pay_xxx (same as payment ID)
   * - PhonePe: transactionId
   * - Paytm: TXNID
   */
  @Column({ type: 'varchar', length: 255, nullable: true })
  processor_charge_id?: string;

  /**
   * Processor fee (in cents)
   * Calculated from processor's fee structure
   * Used for net payout calculations
   */
  @Column({ type: 'integer', default: 0 })
  processor_fee_cents!: number;

  /**
   * Net amount after fees (in cents)
   * = amount_cents - processor_fee_cents
   */
  @Column({ type: 'integer', default: 0 })
  net_amount_cents!: number;

  // ========== Legacy Stripe Fields (Backwards Compatibility) ==========

  /**
   * @deprecated Use processor_payment_id instead
   * Kept for backwards compatibility with existing Stripe payments
   */
  @Column({ type: 'varchar', length: 255, nullable: true, unique: true })
  stripe_payment_intent_id?: string;

  /**
   * @deprecated Use processor_charge_id instead
   * Kept for backwards compatibility with existing Stripe payments
   */
  @Column({ type: 'varchar', length: 255, nullable: true })
  stripe_charge_id?: string;

  // ========== Common Payment Fields ==========

  @Column({ type: 'integer' })
  amount_cents!: number;

  @Column({ type: 'varchar', length: 3, default: 'INR' })
  currency!: string;

  @Column({ type: 'varchar', length: 50 })
  status!: PaymentStatus;

  /**
   * Payment method used (card, upi, wallet, netbanking, etc.)
   */
  @Column({ type: 'varchar', length: 50, nullable: true })
  payment_method?: string;

  /**
   * Payment method details (last 4 digits, UPI ID, etc.)
   */
  @Column({ type: 'jsonb', nullable: true })
  payment_method_details?: Record<string, unknown>;

  /**
   * Failure reason (if payment failed)
   */
  @Column({ type: 'text', nullable: true })
  failure_reason?: string;

  /**
   * Refund details (if refunded)
   */
  @Column({ type: 'jsonb', nullable: true })
  refund_details?: {
    refund_id: string;
    refund_amount_cents: number;
    refund_reason?: string;
    refunded_at: string;
  };

  /**
   * Processor-specific metadata
   * Varies by processor; used for debugging and reconciliation
   */
  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;

  /**
   * Settlement/payout details
   * Tracks when this payment was included in a payout
   */
  @Column({ type: 'jsonb', nullable: true })
  settlement_details?: {
    payout_id?: string;
    settled_at?: string;
    settlement_status?: 'pending' | 'settled' | 'failed';
  };

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
