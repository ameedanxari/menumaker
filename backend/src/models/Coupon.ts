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
import { Order } from './Order.js';
import { User } from './User.js';

export type DiscountType = 'fixed' | 'percentage';
export type UsageLimitType = 'per_customer' | 'per_month' | 'unlimited' | 'total_limit';
export type CouponStatus = 'active' | 'expired' | 'archived';
export type ApplicableToType = 'all_dishes' | 'specific_dishes';

/**
 * Coupon Entity
 * Phase 3 - US3.9: Promotions, Coupons & Discounts
 *
 * Stores discount coupons created by sellers
 */
@Entity('coupons')
@Index(['business_id', 'status'])
@Index(['code'], { unique: true })
export class Coupon {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Business, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'business_id' })
  business!: Business;

  @Column({ type: 'uuid' })
  business_id!: string;

  /**
   * Coupon code (e.g., "FEST10", "SAVE50")
   * Unique across all businesses
   */
  @Column({ type: 'varchar', length: 50, unique: true })
  code!: string;

  /**
   * Display name (e.g., "Festival Sale 10% Off")
   */
  @Column({ type: 'varchar', length: 255 })
  name!: string;

  /**
   * Description (shown to customers)
   */
  @Column({ type: 'text', nullable: true })
  description?: string;

  /**
   * Discount type: fixed amount or percentage
   */
  @Column({ type: 'varchar', length: 20 })
  discount_type!: DiscountType;

  /**
   * Discount value
   * - For fixed: amount in cents (e.g., 5000 = Rs. 50 off)
   * - For percentage: percentage value (e.g., 10 = 10% off)
   */
  @Column({ type: 'integer' })
  discount_value!: number;

  /**
   * Maximum discount in cents (for percentage discounts)
   * E.g., 10% off with max Rs. 100 discount
   */
  @Column({ type: 'integer', nullable: true })
  max_discount_cents?: number;

  /**
   * Minimum order value in cents to apply coupon
   */
  @Column({ type: 'integer', default: 0 })
  min_order_value_cents!: number;

  /**
   * Valid from date
   */
  @Column({ type: 'timestamp' })
  valid_from!: Date;

  /**
   * Valid until date
   */
  @Column({ type: 'timestamp' })
  valid_until!: Date;

  /**
   * Usage limit type
   */
  @Column({ type: 'varchar', length: 20, default: 'unlimited' })
  usage_limit_type!: UsageLimitType;

  /**
   * Usage limit per customer (if usage_limit_type = 'per_customer')
   */
  @Column({ type: 'integer', nullable: true })
  usage_limit_per_customer?: number;

  /**
   * Usage limit per month (if usage_limit_type = 'per_month')
   */
  @Column({ type: 'integer', nullable: true })
  usage_limit_per_month?: number;

  /**
   * Total usage limit (if usage_limit_type = 'total_limit')
   */
  @Column({ type: 'integer', nullable: true })
  total_usage_limit?: number;

  /**
   * Total times used
   */
  @Column({ type: 'integer', default: 0 })
  total_usage_count!: number;

  /**
   * Applicable to
   */
  @Column({ type: 'varchar', length: 20, default: 'all_dishes' })
  applicable_to!: ApplicableToType;

  /**
   * Specific dish IDs (if applicable_to = 'specific_dishes')
   */
  @Column({ type: 'simple-array', default: '' })
  dish_ids!: string[];

  /**
   * Coupon status
   */
  @Column({ type: 'varchar', length: 20, default: 'active' })
  status!: CouponStatus;

  /**
   * Is publicly visible on menu?
   */
  @Column({ type: 'boolean', default: true })
  is_public!: boolean;

  /**
   * QR code data (URL or base64)
   */
  @Column({ type: 'text', nullable: true })
  qr_code_data?: string;

  /**
   * Analytics: total discount given in cents
   */
  @Column({ type: 'bigint', default: 0 })
  total_discount_given_cents!: number;

  /**
   * Analytics: total revenue generated (order value)
   */
  @Column({ type: 'bigint', default: 0 })
  total_revenue_generated_cents!: number;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}

/**
 * CouponUsage Entity
 * Tracks every coupon redemption
 */
@Entity('coupon_usages')
@Index(['coupon_id', 'customer_id'])
@Index(['order_id'])
@Index(['created_at'])
export class CouponUsage {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Coupon, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'coupon_id' })
  coupon!: Coupon;

  @Column({ type: 'uuid' })
  coupon_id!: string;

  @ManyToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order!: Order;

  @Column({ type: 'uuid', unique: true })
  order_id!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'customer_id' })
  customer!: User;

  @Column({ type: 'uuid' })
  customer_id!: string;

  /**
   * Business ID (for analytics)
   */
  @Column({ type: 'uuid' })
  business_id!: string;

  /**
   * Coupon code used
   */
  @Column({ type: 'varchar', length: 50 })
  coupon_code!: string;

  /**
   * Discount type
   */
  @Column({ type: 'varchar', length: 20 })
  discount_type!: DiscountType;

  /**
   * Discount value applied (in cents for fixed, percentage for %)
   */
  @Column({ type: 'integer' })
  discount_value!: number;

  /**
   * Actual discount amount in cents
   */
  @Column({ type: 'integer' })
  discount_amount_cents!: number;

  /**
   * Order subtotal before discount (in cents)
   */
  @Column({ type: 'integer' })
  order_subtotal_cents!: number;

  /**
   * Order total after discount (in cents)
   */
  @Column({ type: 'integer' })
  order_total_cents!: number;

  @CreateDateColumn()
  created_at!: Date;
}

/**
 * AutomaticPromotion Entity
 * Stores automatic promotion rules (e.g., free delivery on orders > Rs. 500)
 */
@Entity('automatic_promotions')
@Index(['business_id', 'is_active'])
export class AutomaticPromotion {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Business, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'business_id' })
  business!: Business;

  @Column({ type: 'uuid' })
  business_id!: string;

  /**
   * Promotion name
   */
  @Column({ type: 'varchar', length: 255 })
  name!: string;

  /**
   * Description
   */
  @Column({ type: 'text', nullable: true })
  description?: string;

  /**
   * Promotion type
   */
  @Column({ type: 'varchar', length: 50 })
  type!: 'free_delivery' | 'discount' | 'free_item';

  /**
   * Trigger condition: order value threshold in cents
   */
  @Column({ type: 'integer', nullable: true })
  min_order_value_cents?: number;

  /**
   * Discount value (for type = 'discount')
   */
  @Column({ type: 'integer', nullable: true })
  discount_value?: number;

  /**
   * Discount type (for type = 'discount')
   */
  @Column({ type: 'varchar', length: 20, nullable: true })
  discount_type?: DiscountType;

  /**
   * Free item dish ID (for type = 'free_item')
   */
  @Column({ type: 'uuid', nullable: true })
  free_dish_id?: string;

  /**
   * Valid from date
   */
  @Column({ type: 'timestamp' })
  valid_from!: Date;

  /**
   * Valid until date
   */
  @Column({ type: 'timestamp' })
  valid_until!: Date;

  /**
   * Is active?
   */
  @Column({ type: 'boolean', default: true })
  is_active!: boolean;

  /**
   * Is publicly visible on menu?
   */
  @Column({ type: 'boolean', default: true })
  is_public!: boolean;

  /**
   * Total times applied
   */
  @Column({ type: 'integer', default: 0 })
  total_applications!: number;

  /**
   * Total discount given in cents
   */
  @Column({ type: 'bigint', default: 0 })
  total_discount_given_cents!: number;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
