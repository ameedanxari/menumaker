import type { Relation } from 'typeorm';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { Business } from './Business.js';
import { Order } from './Order.js';
import { User } from './User.js';

export type ReviewStatus = 'pending' | 'approved' | 'rejected' | 'removed';

/**
 * Review Entity
 * Phase 3 - US3.5: Review & Complaint Workflow
 *
 * Customer reviews for sellers with moderation workflow
 */
@Entity('reviews')
@Index(['business_id', 'status'])
@Index(['order_id'], { unique: true })
@Index(['customer_id', 'business_id', 'created_at'])
export class Review {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // Relations
  @ManyToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order!: Order;

  @Column({ type: 'uuid' })
  order_id!: string;

  @ManyToOne(() => Business, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'business_id' })
  business!: Business;

  @Column({ type: 'uuid' })
  business_id!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'customer_id' })
  customer!: User;

  @Column({ type: 'uuid' })
  customer_id!: string;

  // Review content
  /**
   * Rating from 1 to 5 stars
   */
  @Column({ type: 'integer' })
  rating!: number;

  /**
   * Review text (optional, max 500 chars)
   */
  @Column({ type: 'varchar', length: 500, nullable: true })
  review_text?: string;

  /**
   * Photo URLs (optional, up to 3)
   */
  @Column({ type: 'simple-array', default: '' })
  photo_urls!: string[];

  // Moderation
  /**
   * Review status for moderation
   * - pending: Awaiting seller review (24h window)
   * - approved: Seller approved or 24h passed
   * - rejected: Seller requested removal (requires admin review)
   * - removed: Admin removed (spam/offensive)
   */
  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status!: ReviewStatus;

  /**
   * Is this a complaint? (rating < 3)
   */
  @Column({ type: 'boolean', default: false })
  is_complaint!: boolean;

  /**
   * Complaint resolution status
   * - open: Complaint not resolved
   * - in_progress: Seller and customer communicating
   * - resolved: Issue resolved
   * - escalated: Escalated to admin
   */
  @Column({ type: 'varchar', length: 20, nullable: true })
  complaint_status?: 'open' | 'in_progress' | 'resolved' | 'escalated';

  /**
   * Auto-approve after this time (24h from creation)
   */
  @Column({ type: 'timestamp', nullable: true })
  auto_approve_at?: Date;

  /**
   * When the review was approved
   */
  @Column({ type: 'timestamp', nullable: true })
  approved_at?: Date;

  /**
   * When seller was notified about complaint
   */
  @Column({ type: 'timestamp', nullable: true })
  seller_notified_at?: Date;

  // Seller response
  /**
   * Has seller responded?
   */
  @Column({ type: 'boolean', default: false })
  has_seller_response!: boolean;

  /**
   * Public display
   */
  @Column({ type: 'boolean', default: false })
  is_public!: boolean;

  /**
   * Verified purchase (always true for MenuMaker)
   */
  @Column({ type: 'boolean', default: true })
  is_verified_purchase!: boolean;

  /**
   * Helpful count (for future use)
   */
  @Column({ type: 'integer', default: 0 })
  helpful_count!: number;

  /**
   * Reported as spam/offensive count
   */
  @Column({ type: 'integer', default: 0 })
  report_count!: number;

  /**
   * Customer name (cached for display)
   */
  @Column({ type: 'varchar', length: 255 })
  customer_name!: string;

  /**
   * Metadata for future use
   */
  @Column({ type: 'jsonb', nullable: true })
  metadata?: {
    order_total_cents?: number;
    delivery_time_minutes?: number;
    seller_rejection_reason?: string;
    admin_notes?: string;
    reports?: Array<{
      user_id: string;
      reason?: string;
      reported_at: string;
    }>;
  };

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;

  // Relations
  @OneToMany(() => ReviewResponse, (response) => response.review, { cascade: true })
  responses?: ReviewResponse[];
}

/**
 * ReviewResponse Entity
 * Seller's public response to a review
 */
@Entity('review_responses')
export class ReviewResponse {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Review, (review) => review.responses, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'review_id' })
  review!: Review;

  @Column({ type: 'uuid' })
  review_id!: string;

  @ManyToOne(() => Business, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'business_id' })
  business!: Business;

  @Column({ type: 'uuid' })
  business_id!: string;

  /**
   * Seller's response text (max 500 chars)
   */
  @Column({ type: 'varchar', length: 500 })
  response_text!: string;

  /**
   * Name of person responding (business owner name)
   */
  @Column({ type: 'varchar', length: 255 })
  responder_name!: string;

  /**
   * Is this response visible to public?
   */
  @Column({ type: 'boolean', default: true })
  is_public!: boolean;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
