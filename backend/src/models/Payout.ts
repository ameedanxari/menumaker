import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Business } from './Business.js';

@Entity('payouts')
@Index(['business_id', 'created_at'])
export class Payout {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Business, (business) => business.payouts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'business_id' })
  business!: Business;

  @Column({ type: 'uuid' })
  business_id!: string;

  @Column({ type: 'date' })
  period_start!: Date;

  @Column({ type: 'date' })
  period_end!: Date;

  @Column({ type: 'integer' })
  gross_amount_cents!: number;

  @Column({ type: 'integer', default: 0 })
  platform_fee_cents!: number;

  @Column({ type: 'integer' })
  net_amount_cents!: number;

  @Column({ type: 'varchar', default: 'pending' })
  status!: 'pending' | 'completed' | 'failed';

  @Column({ type: 'varchar', length: 3, default: 'INR' })
  currency!: string;

  @CreateDateColumn()
  created_at!: Date;

  @Column({ type: 'timestamp', nullable: true })
  completed_at?: Date;

  @Column({ type: 'text', nullable: true })
  notes?: string;
}
