import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { Business } from './Business.js';

@Entity('business_settings')
export class BusinessSettings {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @OneToOne(() => Business, (business) => business.settings, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'business_id' })
  business!: Business;

  @Column({ type: 'uuid' })
  business_id!: string;

  // Delivery Configuration
  @Column({ type: 'varchar', default: 'flat' })
  delivery_type!: 'flat' | 'distance' | 'free';

  @Column({ type: 'integer', default: 0 })
  delivery_fee_cents!: number;

  @Column({ type: 'integer', nullable: true })
  delivery_base_fee_cents?: number;

  @Column({ type: 'integer', nullable: true })
  delivery_per_km_cents?: number;

  @Column({ type: 'integer', nullable: true })
  min_order_free_delivery_cents?: number;

  @Column({ type: 'varchar', default: 'round' })
  distance_rounding!: 'round' | 'ceil' | 'floor';

  // Payment Configuration
  @Column({ type: 'varchar', default: 'cash' })
  payment_method!: 'cash' | 'bank_transfer' | 'upi' | 'other';

  @Column({ type: 'text', nullable: true })
  payment_instructions?: string;

  @Column({ type: 'varchar', length: 3, default: 'INR' })
  currency!: string;

  // Order Defaults
  @Column({ type: 'boolean', default: false })
  auto_confirm_orders!: boolean;

  @Column({ type: 'boolean', default: true })
  enable_customer_notes!: boolean;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
