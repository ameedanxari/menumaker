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
import { User } from './User.js';

/**
 * Referral Entity (Phase 2.5)
 *
 * Tracks seller-to-seller referrals for viral growth.
 * Funnel: link_clicked → signup_completed → first_menu_published → reward
 */

@Entity('referrals')
@Index(['referral_code'], { unique: true })
@Index(['referrer_id', 'status'])
@Index(['referee_id'])
@Index(['created_at'])
export class Referral {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 12, unique: true })
  referral_code!: string; // e.g., "PRIYA2024"

  // Referrer (person who shared the code)
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'referrer_id' })
  referrer!: User;

  @Column({ type: 'uuid' })
  referrer_id!: string;

  // Referee (person who signed up using the code)
  @ManyToOne(() => User, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'referee_id' })
  referee?: User;

  @Column({ type: 'uuid', nullable: true })
  referee_id?: string; // Null until signup completed

  /**
   * Referral status tracking funnel:
   * - link_clicked: User clicked referral link (cookie stored)
   * - signup_completed: User signed up and verified account
   * - first_menu_published: User published their first menu (REWARD TRIGGERED)
   * - expired: Referee didn't complete within 30 days
   */
  @Column({ type: 'varchar', length: 50, default: 'link_clicked' })
  status!: string;

  // Captured at signup (for tracking before user is created)
  @Column({ type: 'varchar', length: 255, nullable: true })
  referee_email?: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  referee_phone?: string;

  /**
   * Reward type:
   * - free_pro_month: 1 month free Pro tier (Rs. 299 value)
   * - account_credit: Rs. 500 account credit
   */
  @Column({ type: 'varchar', length: 50, default: 'free_pro_month' })
  reward_type!: string;

  @Column({ type: 'integer', default: 29900 })
  reward_value_cents!: number; // Rs. 299 for Pro, Rs. 500 for credit (50000)

  @Column({ type: 'boolean', default: false })
  reward_claimed!: boolean; // True when reward applied to both parties

  @Column({ type: 'timestamp', nullable: true })
  reward_claimed_at?: Date;

  // Tracking metadata
  @Column({ type: 'varchar', length: 50, nullable: true })
  source?: string; // 'whatsapp', 'sms', 'email', 'direct_link', 'instagram'

  @Column({ type: 'varchar', length: 100, nullable: true })
  utm_source?: string; // Campaign tracking

  @Column({ type: 'varchar', length: 45, nullable: true })
  click_ip?: string; // For fraud detection (IPv4/IPv6)

  @Column({ type: 'varchar', length: 255, nullable: true })
  device_fingerprint?: string; // Browser fingerprint for self-referral detection

  // Timestamps for funnel tracking
  @Column({ type: 'timestamp', nullable: true })
  clicked_at?: Date; // When link first clicked

  @Column({ type: 'timestamp', nullable: true })
  signup_completed_at?: Date; // When referee verified account

  @Column({ type: 'timestamp', nullable: true })
  first_menu_published_at?: Date; // When referee published first menu

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
