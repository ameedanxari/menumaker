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
import { Order } from './Order.js';
import { User } from './User.js';

export type DeliveryProvider = 'swiggy' | 'zomato' | 'dunzo';
export type DeliveryStatus = 'pending' | 'assigned' | 'picked_up' | 'en_route' | 'delivered' | 'cancelled' | 'failed';
export type DeliveryCostHandling = 'customer' | 'seller';

/**
 * DeliveryIntegration Entity
 * Phase 3 - US3.8: Delivery Partner Integration
 *
 * Stores delivery partner settings for each business
 */
@Entity('delivery_integrations')
export class DeliveryIntegration {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Business, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'business_id' })
  business!: Business;

  @Column({ type: 'uuid', unique: true })
  business_id!: string;

  /**
   * Delivery provider (swiggy, zomato, dunzo)
   */
  @Column({ type: 'varchar', length: 50 })
  provider!: DeliveryProvider;

  /**
   * Is integration active?
   */
  @Column({ type: 'boolean', default: true })
  is_active!: boolean;

  /**
   * API credentials for delivery partner
   */
  @Column({ type: 'text', nullable: true })
  api_key?: string;

  @Column({ type: 'text', nullable: true })
  api_secret?: string;

  /**
   * Partner account ID (e.g., Swiggy merchant ID)
   */
  @Column({ type: 'varchar', length: 255, nullable: true })
  partner_account_id?: string;

  /**
   * Delivery cost handling
   * - customer: Pass delivery fee to customer
   * - seller: Seller absorbs delivery cost
   */
  @Column({ type: 'varchar', length: 20, default: 'customer' })
  cost_handling!: DeliveryCostHandling;

  /**
   * Fixed delivery fee in cents (if applicable)
   */
  @Column({ type: 'integer', nullable: true })
  fixed_delivery_fee_cents?: number;

  /**
   * Auto-assign delivery on order acceptance?
   */
  @Column({ type: 'boolean', default: true })
  auto_assign_delivery!: boolean;

  /**
   * Pickup instructions for delivery partner
   */
  @Column({ type: 'text', nullable: true })
  pickup_instructions?: string;

  /**
   * Webhook URL for delivery status updates
   */
  @Column({ type: 'varchar', length: 500, nullable: true })
  webhook_url?: string;

  /**
   * Last successful delivery timestamp
   */
  @Column({ type: 'timestamp', nullable: true })
  last_delivery_at?: Date;

  /**
   * Total deliveries completed via this integration
   */
  @Column({ type: 'integer', default: 0 })
  total_deliveries!: number;

  /**
   * Delivery failure count
   */
  @Column({ type: 'integer', default: 0 })
  failure_count!: number;

  /**
   * Last error message
   */
  @Column({ type: 'text', nullable: true })
  last_error?: string;

  /**
   * Provider-specific settings
   */
  @Column({ type: 'jsonb', nullable: true })
  settings?: {
    service_type?: 'standard' | 'express' | 'scheduled';
    packaging_required?: boolean;
    insurance_enabled?: boolean;
    [key: string]: any;
  };

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}

/**
 * DeliveryTracking Entity
 * Tracks delivery status for each order
 */
@Entity('delivery_tracking')
@Index(['order_id'])
@Index(['delivery_partner_id'])
export class DeliveryTracking {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => DeliveryIntegration, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'delivery_integration_id' })
  delivery_integration!: DeliveryIntegration;

  @Column({ type: 'uuid' })
  delivery_integration_id!: string;

  @ManyToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order!: Order;

  @Column({ type: 'uuid', unique: true })
  order_id!: string;

  /**
   * Delivery provider
   */
  @Column({ type: 'varchar', length: 50 })
  provider!: DeliveryProvider;

  /**
   * Delivery status
   */
  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status!: DeliveryStatus;

  /**
   * Delivery partner's order/task ID
   */
  @Column({ type: 'varchar', length: 255, nullable: true })
  delivery_partner_id?: string;

  /**
   * Delivery person details
   */
  @Column({ type: 'varchar', length: 255, nullable: true })
  delivery_person_name?: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  delivery_person_phone?: string;

  /**
   * Estimated pickup time
   */
  @Column({ type: 'timestamp', nullable: true })
  estimated_pickup_at?: Date;

  /**
   * Actual pickup time
   */
  @Column({ type: 'timestamp', nullable: true })
  picked_up_at?: Date;

  /**
   * Estimated delivery time
   */
  @Column({ type: 'timestamp', nullable: true })
  estimated_delivery_at?: Date;

  /**
   * Actual delivery time
   */
  @Column({ type: 'timestamp', nullable: true })
  delivered_at?: Date;

  /**
   * Delivery fee in cents
   */
  @Column({ type: 'integer', nullable: true })
  delivery_fee_cents?: number;

  /**
   * Live tracking URL
   */
  @Column({ type: 'varchar', length: 500, nullable: true })
  tracking_url?: string;

  /**
   * Delivery instructions from customer
   */
  @Column({ type: 'text', nullable: true })
  delivery_instructions?: string;

  /**
   * Cancellation reason (if cancelled)
   */
  @Column({ type: 'text', nullable: true })
  cancellation_reason?: string;

  /**
   * Delivery attempt count
   */
  @Column({ type: 'integer', default: 0 })
  attempt_count!: number;

  /**
   * Delivery OTP (for verification)
   */
  @Column({ type: 'varchar', length: 6, nullable: true })
  delivery_otp?: string;

  /**
   * Status history (audit trail)
   */
  @Column({ type: 'jsonb', nullable: true })
  status_history?: Array<{
    status: DeliveryStatus;
    timestamp: Date;
    message?: string;
  }>;

  /**
   * Error message (if failed)
   */
  @Column({ type: 'text', nullable: true })
  error_message?: string;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}

/**
 * DeliveryRating Entity
 * Stores delivery ratings separate from food ratings
 */
@Entity('delivery_ratings')
@Index(['order_id'])
@Index(['delivery_tracking_id'])
export class DeliveryRating {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => DeliveryTracking, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'delivery_tracking_id' })
  delivery_tracking!: DeliveryTracking;

  @Column({ type: 'uuid', unique: true })
  delivery_tracking_id!: string;

  @ManyToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order!: Order;

  @Column({ type: 'uuid' })
  order_id!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'customer_id' })
  customer!: User;

  @Column({ type: 'uuid' })
  customer_id!: string;

  /**
   * Delivery rating (1-5)
   */
  @Column({ type: 'integer' })
  rating!: number;

  /**
   * Delivery feedback (optional)
   */
  @Column({ type: 'varchar', length: 500, nullable: true })
  feedback?: string;

  /**
   * Rating categories
   */
  @Column({ type: 'integer', nullable: true })
  timeliness_rating?: number; // 1-5

  @Column({ type: 'integer', nullable: true })
  courtesy_rating?: number; // 1-5

  @Column({ type: 'integer', nullable: true })
  packaging_rating?: number; // 1-5

  /**
   * Issues flagged
   */
  @Column({ type: 'simple-array', default: '' })
  issues!: string[]; // ['late_delivery', 'damaged_packaging', 'rude_behavior']

  /**
   * Delivery provider
   */
  @Column({ type: 'varchar', length: 50 })
  provider!: DeliveryProvider;

  @CreateDateColumn()
  created_at!: Date;
}
