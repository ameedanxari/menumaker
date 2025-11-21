import type { Relation } from 'typeorm';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  Index,
  JoinColumn,
} from 'typeorm';
import { AdminUser } from './AdminUser.js';

/**
 * AuditLog entity for tracking all admin actions
 * Phase 3: Admin Backend Platform (US3.10)
 *
 * Immutable logs (append-only, cannot be edited or deleted)
 * Retention: 1 year (compliance requirement)
 */
@Entity('audit_logs')
@Index(['admin_user_id', 'created_at'])
@Index(['action'])
@Index(['target_type', 'target_id'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => AdminUser)
  @JoinColumn({ name: 'admin_user_id' })
  admin_user?: AdminUser;

  @Column({ type: 'uuid' })
  admin_user_id!: string;

  @Column({ type: 'varchar', length: 50 })
  action!: string;
  // Examples: 'ban_user', 'suspend_user', 'approve_flag', 'reject_flag',
  //           'toggle_feature_flag', 'close_ticket', 'assign_ticket'

  @Column({ type: 'varchar', length: 50, nullable: true })
  target_type?: string; // 'user', 'flag', 'feature_flag', 'ticket', 'business'

  @Column({ type: 'uuid', nullable: true })
  target_id?: string; // ID of the target entity

  @Column({ type: 'jsonb', nullable: true })
  details?: Record<string, any>;
  // Example: { reason: 'spam', duration: '30 days', previous_status: 'active', new_status: 'suspended' }

  @Column({ type: 'varchar', length: 45 })
  ip_address!: string; // IP address of admin user when action was taken

  @Column({ type: 'varchar', length: 255, nullable: true })
  user_agent?: string; // Browser/client info

  @CreateDateColumn()
  created_at!: Date; // Immutable - cannot be modified after creation
}
