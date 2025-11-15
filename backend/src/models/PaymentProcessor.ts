import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Business } from './Business.js';

/**
 * PaymentProcessor Entity
 * Phase 3: Multiple Payment Processors (US3.1)
 *
 * Stores payment processor credentials and configuration per business.
 * Supports: Stripe, Razorpay, PhonePe, Paytm
 *
 * Security:
 * - credentials field encrypted at rest
 * - API keys never exposed in API responses
 */

export type ProcessorType = 'stripe' | 'razorpay' | 'phonepe' | 'paytm';
export type SettlementSchedule = 'daily' | 'weekly' | 'monthly';
export type ProcessorStatus = 'active' | 'inactive' | 'pending_verification' | 'failed';

@Entity('payment_processors')
export class PaymentProcessor {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  business_id!: string;

  @ManyToOne(() => Business, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'business_id' })
  business!: Business;

  /**
   * Processor type
   * 'stripe' | 'razorpay' | 'phonepe' | 'paytm'
   */
  @Column({ type: 'varchar', length: 50 })
  processor_type!: ProcessorType;

  /**
   * Processor status
   */
  @Column({ type: 'varchar', length: 50, default: 'pending_verification' })
  status!: ProcessorStatus;

  /**
   * Priority for automatic routing
   * Higher number = higher priority (1 = highest)
   * If primary processor fails, fallback to next priority
   */
  @Column({ type: 'integer', default: 999 })
  priority!: number;

  /**
   * Is this processor currently active for taking payments?
   * If false, payments won't be routed to this processor
   */
  @Column({ type: 'boolean', default: true })
  is_active!: boolean;

  /**
   * Encrypted credentials (JSON)
   * Structure varies by processor:
   *
   * Stripe: { secret_key, publishable_key, webhook_secret, connected_account_id? }
   * Razorpay: { key_id, key_secret, webhook_secret }
   * PhonePe: { merchant_id, salt_key, salt_index }
   * Paytm: { merchant_id, merchant_key, website, industry_type }
   *
   * CRITICAL: This field must be encrypted at rest using AES-256
   * TODO: Implement field-level encryption in Phase 3.1+
   */
  @Column({ type: 'jsonb' })
  credentials!: Record<string, string>;

  /**
   * Settlement schedule: how often payouts are sent to seller
   * 'daily' = next business day
   * 'weekly' = every Monday
   * 'monthly' = 1st of month
   */
  @Column({ type: 'varchar', length: 20, default: 'weekly' })
  settlement_schedule!: SettlementSchedule;

  /**
   * Minimum payout threshold (in cents)
   * Payouts held until balance exceeds this amount
   * Default: Rs. 500 (50000 paise)
   */
  @Column({ type: 'integer', default: 50000 })
  min_payout_threshold_cents!: number;

  /**
   * Processor fee percentage
   * Stored for display/reporting (actual fees calculated by processor)
   *
   * Typical fees:
   * - Stripe: 2.9% + Rs. 2
   * - Razorpay: 2% (can be 1.75% with volume discount)
   * - PhonePe: 1% + GST
   * - Paytm: 2% + GST
   */
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 2.0 })
  fee_percentage!: number;

  /**
   * Fixed fee per transaction (in cents)
   * Example: Stripe charges Rs. 2 = 200 paise
   */
  @Column({ type: 'integer', default: 0 })
  fixed_fee_cents!: number;

  /**
   * Processor-specific metadata
   * Can store: merchant_name, account_email, verification_status, etc.
   */
  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  /**
   * Last successful transaction timestamp
   * Used for monitoring and alerting
   */
  @Column({ type: 'timestamp', nullable: true })
  last_transaction_at?: Date;

  /**
   * Connection verification timestamp
   * When credentials were last verified as working
   */
  @Column({ type: 'timestamp', nullable: true })
  verified_at?: Date;

  /**
   * Connection error details (if failed)
   */
  @Column({ type: 'text', nullable: true })
  connection_error?: string;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
