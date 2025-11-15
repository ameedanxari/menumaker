import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  OneToMany,
} from 'typeorm';
import { Business } from './Business.js';
import { OrderNotification } from './OrderNotification.js';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email!: string;

  @Column({ type: 'varchar', length: 500 })
  password_hash!: string;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;

  // Phase 2.5: Referral System Fields
  @Column({ type: 'varchar', length: 12, unique: true, nullable: true })
  referral_code?: string; // Generated on first access (e.g., "PRIYA2024")

  @Column({ type: 'integer', default: 0 })
  account_credit_cents!: number; // Rs. balance for account credit rewards

  @Column({ type: 'timestamp', nullable: true })
  pro_tier_expires_at?: Date; // If gifted Pro via referral, expiration date

  @Column({ type: 'varchar', length: 12, nullable: true })
  referred_by_code?: string; // Track who referred this user

  // Relations
  @OneToOne(() => Business, (business) => business.owner)
  business?: Business;

  @OneToMany(() => OrderNotification, (notification) => notification.user)
  notifications?: OrderNotification[];
}
