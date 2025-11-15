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
import { User } from './User.js';
import { Business } from './Business.js';
import { Order } from './Order.js';

/**
 * CustomerReferral Entity
 * Phase 3 - US3.11: Enhanced Referral & Viral Features
 *
 * Tracks customer-to-customer referrals
 */
@Entity('customer_referrals')
@Index(['referral_code'], { unique: true })
@Index(['referrer_id', 'status'])
@Index(['referee_id'])
export class CustomerReferral {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /**
   * Referral code (e.g., "CUST_RAHUL2024")
   */
  @Column({ type: 'varchar', length: 20, unique: true })
  referral_code!: string;

  /**
   * Business this referral is for
   */
  @ManyToOne(() => Business, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'business_id' })
  business!: Business;

  @Column({ type: 'uuid' })
  business_id!: string;

  /**
   * Referrer (customer who shared the code)
   */
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'referrer_id' })
  referrer!: User;

  @Column({ type: 'uuid' })
  referrer_id!: string;

  /**
   * Referee (customer who used the code)
   */
  @ManyToOne(() => User, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'referee_id' })
  referee?: User;

  @Column({ type: 'uuid', nullable: true })
  referee_id?: string;

  /**
   * Order placed by referee
   */
  @ManyToOne(() => Order, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'referee_order_id' })
  referee_order?: Order;

  @Column({ type: 'uuid', nullable: true })
  referee_order_id?: string;

  /**
   * Status: link_clicked, order_placed, reward_claimed
   */
  @Column({ type: 'varchar', length: 50, default: 'link_clicked' })
  status!: string;

  /**
   * Reward for referrer and referee
   */
  @Column({ type: 'integer', default: 10000 })
  reward_value_cents!: number; // Rs. 100 each (10000 cents)

  @Column({ type: 'boolean', default: false })
  referrer_reward_claimed!: boolean;

  @Column({ type: 'boolean', default: false })
  referee_reward_claimed!: boolean;

  @Column({ type: 'timestamp', nullable: true })
  reward_claimed_at?: Date;

  /**
   * Tracking
   */
  @Column({ type: 'varchar', length: 50, nullable: true })
  source?: string; // 'whatsapp', 'sms', 'instagram', 'direct_link'

  @Column({ type: 'timestamp', nullable: true })
  clicked_at?: Date;

  @Column({ type: 'timestamp', nullable: true })
  order_placed_at?: Date;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}

/**
 * ReferralLeaderboard Entity
 * Tracks monthly referral leaderboard for prizes
 */
@Entity('referral_leaderboard')
@Index(['month', 'successful_referrals'])
@Index(['user_id', 'month'])
export class ReferralLeaderboard {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /**
   * User on leaderboard
   */
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'uuid' })
  user_id!: string;

  /**
   * Month (YYYY-MM format, e.g., "2025-10")
   */
  @Column({ type: 'varchar', length: 7 })
  month!: string;

  /**
   * Successful referrals count (first_menu_published)
   */
  @Column({ type: 'integer', default: 0 })
  successful_referrals!: number;

  /**
   * Leaderboard rank (1 = first place)
   */
  @Column({ type: 'integer', nullable: true })
  rank?: number;

  /**
   * Prize amount in cents
   */
  @Column({ type: 'integer', default: 0 })
  prize_amount_cents!: number;

  /**
   * Prize status
   */
  @Column({ type: 'boolean', default: false })
  prize_paid!: boolean;

  @Column({ type: 'timestamp', nullable: true })
  prize_paid_at?: Date;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}

/**
 * Affiliate Entity
 * Phase 3: Affiliate Program for influencers and food bloggers
 */
@Entity('affiliates')
@Index(['affiliate_code'], { unique: true })
@Index(['user_id'])
@Index(['status'])
export class Affiliate {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /**
   * Affiliate user
   */
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'uuid', unique: true })
  user_id!: string;

  /**
   * Unique affiliate code (e.g., "FOODBLOGGER_PRIYA")
   */
  @Column({ type: 'varchar', length: 50, unique: true })
  affiliate_code!: string;

  /**
   * Status: pending, approved, rejected, suspended
   */
  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status!: string;

  /**
   * Affiliate type: influencer, food_blogger, partner
   */
  @Column({ type: 'varchar', length: 50, default: 'influencer' })
  affiliate_type!: string;

  /**
   * Application details
   */
  @Column({ type: 'text', nullable: true })
  application_message?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  instagram_handle?: string;

  @Column({ type: 'integer', nullable: true })
  instagram_followers?: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  youtube_channel?: string;

  @Column({ type: 'integer', nullable: true })
  youtube_subscribers?: number;

  /**
   * Commission rates
   */
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 5.0 })
  seller_commission_rate!: number; // 5% of GMV from referred sellers

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 2.0 })
  customer_commission_rate!: number; // 2% of GMV from referred customers

  /**
   * Commission duration
   */
  @Column({ type: 'integer', default: 6 })
  seller_commission_months!: number; // 6 months

  @Column({ type: 'integer', default: 3 })
  customer_commission_months!: number; // 3 months

  /**
   * Payout settings
   */
  @Column({ type: 'integer', default: 100000 })
  min_payout_cents!: number; // Rs. 1,000 minimum

  @Column({ type: 'varchar', length: 50, nullable: true })
  payout_method?: string; // 'bank_transfer', 'upi', 'account_credit'

  @Column({ type: 'text', nullable: true })
  payout_details?: string; // Bank account or UPI ID

  /**
   * Analytics
   */
  @Column({ type: 'integer', default: 0 })
  total_clicks!: number;

  @Column({ type: 'integer', default: 0 })
  total_signups!: number;

  @Column({ type: 'integer', default: 0 })
  total_conversions!: number;

  @Column({ type: 'bigint', default: 0 })
  total_gmv_cents!: number;

  @Column({ type: 'bigint', default: 0 })
  total_commission_earned_cents!: number;

  @Column({ type: 'bigint', default: 0 })
  total_commission_paid_cents!: number;

  @Column({ type: 'bigint', default: 0 })
  pending_commission_cents!: number;

  /**
   * Approval details
   */
  @Column({ type: 'uuid', nullable: true })
  approved_by_id?: string;

  @Column({ type: 'timestamp', nullable: true })
  approved_at?: Date;

  @Column({ type: 'text', nullable: true })
  rejection_reason?: string;

  /**
   * Marketing materials
   */
  @Column({ type: 'text', nullable: true })
  qr_code_data?: string;

  @Column({ type: 'simple-array', default: '' })
  social_media_templates!: string[]; // URLs to branded templates

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}

/**
 * AffiliateClick Entity
 * Tracks affiliate link clicks for analytics
 */
@Entity('affiliate_clicks')
@Index(['affiliate_id', 'created_at'])
@Index(['ip_address'])
export class AffiliateClick {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Affiliate, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'affiliate_id' })
  affiliate!: Affiliate;

  @Column({ type: 'uuid' })
  affiliate_id!: string;

  /**
   * Tracking
   */
  @Column({ type: 'varchar', length: 45, nullable: true })
  ip_address?: string;

  @Column({ type: 'text', nullable: true })
  user_agent?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  referrer_url?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  utm_source?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  utm_medium?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  utm_campaign?: string;

  /**
   * Conversion tracking
   */
  @Column({ type: 'boolean', default: false })
  converted!: boolean; // Did this click result in a signup?

  @Column({ type: 'uuid', nullable: true })
  converted_user_id?: string;

  @Column({ type: 'timestamp', nullable: true })
  converted_at?: Date;

  @CreateDateColumn()
  created_at!: Date;
}

/**
 * AffiliatePayout Entity
 * Tracks affiliate commission payouts
 */
@Entity('affiliate_payouts')
@Index(['affiliate_id', 'status'])
@Index(['payout_month'])
export class AffiliatePayout {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Affiliate, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'affiliate_id' })
  affiliate!: Affiliate;

  @Column({ type: 'uuid' })
  affiliate_id!: string;

  /**
   * Payout period (YYYY-MM format)
   */
  @Column({ type: 'varchar', length: 7 })
  payout_month!: string;

  /**
   * Payout amount in cents
   */
  @Column({ type: 'bigint' })
  payout_amount_cents!: number;

  /**
   * Commission details
   */
  @Column({ type: 'integer', default: 0 })
  seller_referrals_count!: number;

  @Column({ type: 'bigint', default: 0 })
  seller_gmv_cents!: number;

  @Column({ type: 'bigint', default: 0 })
  seller_commission_cents!: number;

  @Column({ type: 'integer', default: 0 })
  customer_referrals_count!: number;

  @Column({ type: 'bigint', default: 0 })
  customer_gmv_cents!: number;

  @Column({ type: 'bigint', default: 0 })
  customer_commission_cents!: number;

  /**
   * Payout status
   */
  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status!: string; // pending, processing, paid, failed

  @Column({ type: 'varchar', length: 50, nullable: true })
  payout_method?: string; // bank_transfer, upi, account_credit

  @Column({ type: 'varchar', length: 255, nullable: true })
  transaction_id?: string;

  @Column({ type: 'timestamp', nullable: true })
  paid_at?: Date;

  /**
   * Failure details
   */
  @Column({ type: 'text', nullable: true })
  failure_reason?: string;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}

/**
 * ViralBadge Entity
 * Tracks viral achievement badges for sellers
 */
@Entity('viral_badges')
@Index(['user_id', 'badge_type'])
export class ViralBadge {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'uuid' })
  user_id!: string;

  /**
   * Badge type
   */
  @Column({ type: 'varchar', length: 50 })
  badge_type!: string; // 'superstar' (10+ referrals), 'mega_influencer' (50+), 'viral_king' (100+)

  /**
   * Badge tier (higher is better)
   */
  @Column({ type: 'integer', default: 1 })
  tier!: number;

  /**
   * Display name
   */
  @Column({ type: 'varchar', length: 100 })
  display_name!: string; // "Superstar Seller"

  /**
   * Description
   */
  @Column({ type: 'text', nullable: true })
  description?: string;

  /**
   * Badge icon URL
   */
  @Column({ type: 'varchar', length: 500, nullable: true })
  icon_url?: string;

  /**
   * Requirements met
   */
  @Column({ type: 'integer' })
  referrals_required!: number; // e.g., 10 for Superstar

  @Column({ type: 'integer' })
  referrals_achieved!: number;

  /**
   * Unlocked benefits
   */
  @Column({ type: 'simple-array', default: '' })
  benefits!: string[]; // ['priority_support', 'advanced_analytics', 'custom_domain']

  @Column({ type: 'timestamp', nullable: true })
  awarded_at?: Date;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
