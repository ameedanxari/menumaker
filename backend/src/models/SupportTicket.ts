import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  JoinColumn,
} from 'typeorm';
import { User } from './User.js';
import { AdminUser } from './AdminUser.js';

/**
 * SupportTicket entity for customer support
 * Phase 3: Admin Backend Platform (US3.10)
 *
 * Status flow: open → pending → resolved → closed
 * SLA: 24-hour first response time
 */
@Entity('support_tickets')
@Index(['user_id', 'status'])
@Index(['assigned_to_id'])
@Index(['status', 'priority'])
@Index(['created_at'])
export class SupportTicket {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @Column({ type: 'uuid' })
  user_id!: string;

  @ManyToOne(() => AdminUser, { nullable: true })
  @JoinColumn({ name: 'assigned_to_id' })
  assigned_to?: AdminUser | null;

  @Column({ type: 'uuid', nullable: true })
  assigned_to_id?: string | null;

  @Column({ type: 'varchar', length: 200 })
  subject!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({ type: 'varchar', length: 50, default: 'open' })
  status!: string; // 'open' | 'pending' | 'resolved' | 'closed'

  @Column({ type: 'varchar', length: 50, default: 'medium' })
  priority!: string; // 'low' | 'medium' | 'high'

  @Column({ type: 'varchar', length: 50, nullable: true })
  category?: string; // 'billing', 'technical', 'account', 'feature_request', 'other'

  @Column({ type: 'jsonb', nullable: true })
  conversation?: Array<{
    from: 'user' | 'admin';
    admin_id?: string;
    message: string;
    timestamp: string;
    attachments?: string[];
  }>; // Conversation history

  @Column({ type: 'text', nullable: true })
  internal_notes?: string; // Admin-only notes (not visible to user)

  @Column({ type: 'simple-array', nullable: true })
  tags?: string[]; // ['refund', 'urgent', 'bug', etc.]

  @Column({ type: 'timestamp', nullable: true })
  first_response_at?: Date; // When admin first responded (SLA tracking)

  @Column({ type: 'timestamp', nullable: true })
  resolved_at?: Date; // When marked as resolved

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
