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
 * Deletion Request Entity (Phase 2.6 - GDPR)
 *
 * Tracks account deletion requests with 30-day grace period.
 * Phase 2: Manual admin execution
 * Phase 3: Automated cron job
 */

@Entity('deletion_requests')
@Index(['user_id'])
@Index(['status'])
@Index(['scheduled_deletion_date'])
export class DeletionRequest {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'uuid' })
  user_id!: string;

  @Column({ type: 'varchar', length: 255 })
  user_email!: string; // Snapshot for audit trail

  /**
   * Status:
   * - pending: Request submitted, waiting for 30-day grace period
   * - cancelled: User cancelled deletion request
   * - completed: Data has been deleted
   * - failed: Deletion failed (manual review required)
   */
  @Column({ type: 'varchar', length: 50, default: 'pending' })
  status!: string;

  @Column({ type: 'text', nullable: true })
  reason?: string; // Optional: why user is deleting account

  // Grace period (30 days)
  @Column({ type: 'timestamp' })
  scheduled_deletion_date!: Date; // created_at + 30 days

  @Column({ type: 'timestamp', nullable: true })
  cancelled_at?: Date;

  @Column({ type: 'timestamp', nullable: true })
  completed_at?: Date;

  @Column({ type: 'uuid', nullable: true })
  admin_user_id?: string; // Admin who executed deletion (Phase 2: manual)

  @Column({ type: 'text', nullable: true })
  admin_notes?: string; // Admin notes for manual deletion

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
