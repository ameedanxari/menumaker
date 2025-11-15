import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  Index,
  JoinColumn,
} from 'typeorm';
import { User } from './User.js';
import { AdminUser } from './AdminUser.js';

/**
 * ContentFlag entity for reporting offensive/inappropriate content
 * Phase 3: Content Moderation & Safety (US3.5A)
 *
 * Auto-moderation rules:
 * - Auto-hide after 3 flags
 * - Auto-ban user after 5 rejected flags
 */
@Entity('content_flags')
@Index(['target_type', 'target_id'])
@Index(['reporter_id'])
@Index(['status'])
@Index(['created_at'])
export class ContentFlag {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 50 })
  flag_type!: string; // 'review' | 'dish' | 'image' | 'profile' | 'menu'

  @Column({ type: 'uuid' })
  target_id!: string; // ID of flagged content

  @Column({ type: 'varchar', length: 50 })
  reason!: string;
  // 'spam', 'offensive', 'inappropriate', 'harassment', 'fraud', 'other'

  @Column({ type: 'text', nullable: true })
  description?: string; // User-provided explanation

  @ManyToOne(() => User)
  @JoinColumn({ name: 'reporter_id' })
  reporter?: User;

  @Column({ type: 'uuid' })
  reporter_id!: string; // User who flagged the content

  @Column({ type: 'varchar', length: 50, default: 'pending' })
  status!: string; // 'pending' | 'approved' | 'rejected'

  @Column({ type: 'boolean', default: false })
  auto_hidden!: boolean; // True if auto-hidden by threshold (3+ flags)

  @ManyToOne(() => AdminUser, { nullable: true })
  @JoinColumn({ name: 'reviewed_by_id' })
  reviewed_by?: AdminUser | null;

  @Column({ type: 'uuid', nullable: true })
  reviewed_by_id?: string | null;

  @Column({ type: 'timestamp', nullable: true })
  reviewed_at?: Date;

  @Column({ type: 'text', nullable: true })
  moderator_notes?: string; // Internal admin notes

  @Column({ type: 'varchar', length: 50, nullable: true })
  action_taken?: string;
  // 'content_hidden', 'content_deleted', 'user_warned', 'user_suspended', 'user_banned', 'no_action'

  @CreateDateColumn()
  created_at!: Date;
}
