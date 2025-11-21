import type { Relation } from 'typeorm';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index} from 'typeorm';
import { Business } from './Business.js';
import { PaymentProcessor } from './PaymentProcessor.js';

/**
 * Payout Entity
 * Phase 3: Automated Tiered Payouts (US3.2)
 *
 * Represents a scheduled payout to a seller from a payment processor
 * Includes automatic calculation of fees, subscription deductions, and volume discounts
 */

export type PayoutStatus =
  | 'pending'       // Waiting for payout date
  | 'processing'    // Being processed by payment processor
  | 'completed'     // Successfully paid out
  | 'failed'        // Failed (bank rejected, insufficient balance, etc.)
  | 'held'          // Manually held by seller for reconciliation
  | 'cancelled';    // Cancelled by seller or system

export type PayoutFrequency = 'daily' | 'weekly' | 'monthly';

@Entity('payouts')
@Index(['business_id', 'created_at'])
@Index(['payment_processor_id', 'status'])
@Index(['scheduled_payout_date', 'status'])
export class Payout {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Business, (business) => business.payouts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'business_id' })
  business!: Relation<Business>;

  @Column({ type: 'uuid' })
  business_id!: string;

  /**
   * Payment processor used for this payout
   * Phase 3: Links payout to specific processor (Stripe, Razorpay, etc.)
   */
  @Column({ type: 'uuid', nullable: true })
  payment_processor_id?: string;

  @ManyToOne(() => PaymentProcessor, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'payment_processor_id' })
  payment_processor?: Relation<PaymentProcessor>;

  /**
   * Payout period (date range of included payments)
   */
  @Column({ type: 'date' })
  period_start!: Date;

  @Column({ type: 'date' })
  period_end!: Date;

  /**
   * Scheduled payout date (when payout should be executed)
   * Based on payout frequency (daily, weekly, monthly)
   */
  @Column({ type: 'date' })
  scheduled_payout_date!: Date;

  /**
   * Payout frequency that generated this payout
   */
  @Column({ type: 'varchar', length: 20, nullable: true })
  frequency?: PayoutFrequency;

  // ========== Amount Breakdown ==========

  /**
   * Gross amount from all succeeded payments in period
   */
  @Column({ type: 'integer' })
  gross_amount_cents!: number;

  /**
   * Payment processor fees (Razorpay, PhonePe, etc.)
   * Sum of processor_fee_cents from all included payments
   */
  @Column({ type: 'integer', default: 0 })
  processor_fee_cents!: number;

  /**
   * Platform subscription fee for this period
   * Deducted from Pro/Business tier sellers
   */
  @Column({ type: 'integer', default: 0 })
  subscription_fee_cents!: number;

  /**
   * Platform commission fee (if applicable)
   * @deprecated Use platform_fee_cents for backwards compatibility
   */
  @Column({ type: 'integer', default: 0 })
  platform_fee_cents!: number;

  /**
   * Volume discount applied (0.5% reduction if monthly GMV > Rs. 1L)
   * Positive value = discount amount
   */
  @Column({ type: 'integer', default: 0 })
  volume_discount_cents!: number;

  /**
   * Net amount to be paid out to seller
   * = gross_amount - processor_fee - subscription_fee - platform_fee + volume_discount
   */
  @Column({ type: 'integer' })
  net_amount_cents!: number;

  /**
   * Number of payments included in this payout
   */
  @Column({ type: 'integer', default: 0 })
  payment_count!: number;

  // ========== Status & Processing ==========

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status!: PayoutStatus;

  /**
   * Processor transaction ID (for reconciliation)
   * Examples:
   * - Stripe: po_xxx (payout ID)
   * - Razorpay: payout_xxx
   * - PhonePe: settlement transaction ID
   */
  @Column({ type: 'varchar', length: 255, nullable: true })
  processor_payout_id?: string;

  /**
   * Bank transaction ID (UTR number for Indian banks)
   */
  @Column({ type: 'varchar', length: 255, nullable: true })
  bank_transaction_id?: string;

  /**
   * Failure reason (if status = failed)
   */
  @Column({ type: 'text', nullable: true })
  failure_reason?: string;

  /**
   * Retry count (max 3 retries)
   */
  @Column({ type: 'integer', default: 0 })
  retry_count!: number;

  /**
   * Next retry date (if status = failed and retry_count < 3)
   */
  @Column({ type: 'date', nullable: true })
  next_retry_date?: Date;

  // ========== Reconciliation ==========

  /**
   * Reconciliation status
   * - pending: Not yet reconciled
   * - reconciled: Matched with bank statement
   * - exception: Mismatch found
   */
  @Column({ type: 'varchar', length: 20, default: 'pending' })
  reconciliation_status!: 'pending' | 'reconciled' | 'exception';

  /**
   * Reconciliation details (bank statement data, mismatches, etc.)
   */
  @Column({ type: 'jsonb', nullable: true })
  reconciliation_details?: {
    bank_amount_cents?: number;
    bank_date?: string;
    mismatch_reason?: string;
    reconciled_by?: string;
    reconciled_at?: string;
  };

  // ========== Tax Compliance ==========

  /**
   * Gross amount for tax purposes (before any deductions)
   * Used for GST reporting
   */
  @Column({ type: 'integer', default: 0 })
  taxable_amount_cents!: number;

  /**
   * TDS deducted (if applicable for business entities)
   */
  @Column({ type: 'integer', default: 0 })
  tds_cents!: number;

  // ========== Metadata ==========

  @Column({ type: 'varchar', length: 3, default: 'INR' })
  currency!: string;

  /**
   * Additional metadata
   * - payment_ids: Array of payment IDs included in payout
   * - hold_reason: If manually held
   * - processor_response: Full response from processor
   */
  @Column({ type: 'jsonb', nullable: true })
  metadata?: {
    payment_ids?: string[];
    hold_reason?: string;
    processor_response?: Record<string, any>;
  };

  @Column({ type: 'text', nullable: true })
  notes?: string;

  // ========== Timestamps ==========

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;

  @Column({ type: 'timestamp', nullable: true })
  completed_at?: Date;

  @Column({ type: 'timestamp', nullable: true })
  failed_at?: Date;
}
