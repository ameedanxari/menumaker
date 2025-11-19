import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Relation,
} from 'typeorm';
import { User } from './User.js';

/**
 * Notification Entity
 *
 * General notification system for iOS app
 * Supports: order updates, promotions, reviews, system messages
 */

@Entity('notifications')
@Index(['user_id', 'is_read'])
@Index(['created_at'])
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: Relation<User>;

  @Column({ type: 'uuid' })
  user_id!: string;

  @Column({ type: 'varchar', length: 50 })
  type!: 'order_update' | 'promotion' | 'review' | 'system';

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'text' })
  message!: string;

  @Column({ type: 'boolean', default: false })
  is_read!: boolean;

  @Column({ type: 'jsonb', nullable: true })
  data?: Record<string, any>; // Additional data (e.g., order_id, business_id)

  @CreateDateColumn()
  created_at!: Date;
}
