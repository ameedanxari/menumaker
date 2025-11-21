import type { Relation } from 'typeorm';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Business } from './Business.js';
import { PaymentProcessor } from './PaymentProcessor.js';

/**
 * PayoutSchedule Entity
 * Phase 3: Automated Tiered Payouts (US3.2)
 *
 * Stores payout configuration per business per payment processor
 * Determines when and how payouts are triggered automatically
 */

export type PayoutFrequency = 'daily' | 'weekly' | 'monthly';

@Entity('payout_schedules')
@Index(['business_id', 'payment_processor_id'], { unique: true })
export class PayoutSchedule {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  business_id!: string;

  @ManyToOne(() => Business, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'business_id' })
  business!: Business;

  /**
   * Payment processor for this schedule
   * Each processor can have different payout settings
   */
  @Column({ type: 'uuid' })
  payment_processor_id!: string;

  @ManyToOne(() => PaymentProcessor, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'payment_processor_id' })
  payment_processor!: PaymentProcessor;

  /**
   * Is this schedule active?
   * If false, no automatic payouts will be created
   */
  @Column({ type: 'boolean', default: true })
  is_active!: boolean;

  // ========== Frequency Configuration ==========

  /**
   * Payout frequency
   * - daily: Next business day payout
   * - weekly: Every Monday (or specified day of week)
   * - monthly: On specified day of month (e.g., 1st of month)
   */
  @Column({ type: 'varchar', length: 20, default: 'weekly' })
  frequency!: PayoutFrequency;

  /**
   * Day of week for weekly payouts (0 = Sunday, 1 = Monday, etc.)
   * Default: 1 (Monday)
   */
  @Column({ type: 'integer', default: 1, nullable: true })
  weekly_day_of_week?: number;

  /**
   * Day of month for monthly payouts (1-28)
   * Default: 1 (1st of month)
   * Limited to 1-28 to avoid month-end edge cases
   */
  @Column({ type: 'integer', default: 1, nullable: true })
  monthly_day_of_month?: number;

  // ========== Threshold Configuration ==========

  /**
   * Minimum payout threshold (in cents)
   * Payouts held until balance exceeds this amount
   * Default: Rs. 500 (50000 paise)
   *
   * Example: If threshold is Rs. 500 and balance is Rs. 300,
   * payout is held until balance crosses Rs. 500
   */
  @Column({ type: 'integer', default: 50000 })
  min_payout_threshold_cents!: number;

  /**
   * Maximum hold period (in days)
   * Even if threshold not reached, payout is triggered after this period
   * Default: 7 days
   *
   * Example: If max hold is 7 days and balance is Rs. 300 (below threshold),
   * payout is still triggered on 7th day regardless
   */
  @Column({ type: 'integer', default: 7 })
  max_hold_period_days!: number;

  // ========== Hold Configuration ==========

  /**
   * Is payout manually held by seller?
   * If true, automatic payouts are paused (for reconciliation)
   */
  @Column({ type: 'boolean', default: false })
  is_manually_held!: boolean;

  /**
   * Reason for manual hold
   */
  @Column({ type: 'text', nullable: true })
  hold_reason?: string;

  /**
   * Hold start date (when seller initiated hold)
   */
  @Column({ type: 'timestamp', nullable: true })
  hold_start_date?: Date;

  // ========== Balance Tracking ==========

  /**
   * Current pending balance (in cents)
   * Sum of all succeeded payments not yet included in a payout
   * Updated in real-time as payments succeed
   */
  @Column({ type: 'integer', default: 0 })
  current_balance_cents!: number;

  /**
   * Last payout date
   * Used to determine next payout date
   */
  @Column({ type: 'timestamp', nullable: true })
  last_payout_at?: Date;

  /**
   * Next scheduled payout date
   * Calculated based on frequency and last_payout_at
   */
  @Column({ type: 'date', nullable: true })
  next_payout_date?: Date;

  // ========== Notifications ==========

  /**
   * Email notifications enabled?
   * Sends email when payout is processed, failed, or ready
   */
  @Column({ type: 'boolean', default: true })
  email_notifications_enabled!: boolean;

  /**
   * Notification email (defaults to business owner email)
   */
  @Column({ type: 'varchar', length: 255, nullable: true })
  notification_email?: string;

  // ========== Volume Discount Tracking ==========

  /**
   * Monthly GMV (Gross Merchandise Value) in cents
   * Reset to 0 at the start of each month
   * Used to calculate volume discount (0.5% if GMV > Rs. 1L)
   */
  @Column({ type: 'integer', default: 0 })
  current_month_gmv_cents!: number;

  /**
   * Month for current_month_gmv_cents tracking (YYYY-MM format)
   */
  @Column({ type: 'varchar', length: 7, nullable: true })
  gmv_month?: string; // e.g., "2025-11"

  /**
   * Is volume discount eligible this month?
   * True if current_month_gmv_cents > Rs. 1L (10000000 paise)
   */
  @Column({ type: 'boolean', default: false })
  volume_discount_eligible!: boolean;

  // ========== Metadata ==========

  /**
   * Additional configuration metadata
   */
  @Column({ type: 'jsonb', nullable: true })
  metadata?: {
    timezone?: string; // For scheduling (default: business timezone)
    custom_payout_rules?: Record<string, any>; // Future: custom rules engine
  };

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
