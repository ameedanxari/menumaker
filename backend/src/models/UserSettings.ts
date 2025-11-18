import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
  Relation,
} from 'typeorm';
import { User } from './User.js';

/**
 * UserSettings Entity
 *
 * Stores user preferences and settings for iOS app
 */

@Entity('user_settings')
export class UserSettings {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: Relation<User>;

  @Column({ type: 'uuid', unique: true })
  user_id!: string;

  // Language preference
  @Column({ type: 'varchar', length: 10, default: 'en' })
  language!: string; // en, ar, ta, ur, hi

  // Notification preferences
  @Column({ type: 'boolean', default: true })
  notifications_enabled!: boolean;

  @Column({ type: 'boolean', default: true })
  order_notifications!: boolean;

  @Column({ type: 'boolean', default: true })
  promotion_notifications!: boolean;

  @Column({ type: 'boolean', default: true })
  review_notifications!: boolean;

  // App preferences
  @Column({ type: 'boolean', default: false })
  biometric_enabled!: boolean;

  @Column({ type: 'varchar', length: 20, default: 'system' })
  theme!: string; // system, light, dark

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
