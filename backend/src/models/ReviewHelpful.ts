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
import { Review } from './Review.js';
import { User } from './User.js';

/**
 * ReviewHelpful Entity
 *
 * Tracks which users marked which reviews as helpful
 */

@Entity('review_helpful')
@Index(['user_id', 'review_id'], { unique: true })
export class ReviewHelpful {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: Relation<User>;

  @Column({ type: 'uuid' })
  user_id!: string;

  @ManyToOne(() => Review, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'review_id' })
  review!: Relation<Review>;

  @Column({ type: 'uuid' })
  review_id!: string;

  @CreateDateColumn()
  created_at!: Date;
}
