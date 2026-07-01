import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type ReviewStatus = 'pending' | 'approved' | 'rejected' | 'removal_requested';
export type ReviewComplaintStatus = 'none' | 'open' | 'investigating' | 'resolved' | 'rejected';

@Entity('reviews')
@Index(['business_id'])
@Index(['customer_id'])
@Index(['order_id'])
@Index(['status'])
export class Review {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  business_id!: string;

  @Column({ type: 'uuid' })
  customer_id!: string;

  @Column({ type: 'uuid', nullable: true })
  order_id?: string;

  @Column({ type: 'integer' })
  rating!: number;

  @Column({ type: 'text', nullable: true })
  review_text?: string;

  @Column({ type: 'text', nullable: true })
  comment?: string;

  @Column({ type: 'simple-array', nullable: true })
  photo_urls?: string[];

  @Column({ type: 'varchar', length: 50, default: 'pending' })
  status!: ReviewStatus;

  @Column({ type: 'boolean', default: false })
  is_public!: boolean;

  @Column({ type: 'text', nullable: true })
  seller_response?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  seller_responder_name?: string;

  @Column({ type: 'timestamp', nullable: true })
  seller_responded_at?: Date;

  @Column({ type: 'varchar', length: 50, default: 'none' })
  complaint_status!: ReviewComplaintStatus;

  @Column({ type: 'text', nullable: true })
  complaint_reason?: string;

  @Column({ type: 'integer', default: 0 })
  helpful_count!: number;

  @Column({ type: 'integer', default: 0 })
  report_count!: number;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
