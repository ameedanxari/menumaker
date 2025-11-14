import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('common_dishes')
@Index(['category', 'active'])
@Index(['popularity_score'])
export class CommonDish {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'varchar', length: 50 })
  category!: string; // 'north_indian', 'south_indian', 'chinese', 'bakery', 'beverages', 'desserts'

  @Column({ type: 'varchar', length: 50, nullable: true })
  subcategory?: string; // 'appetizers', 'mains', 'desserts', 'beverages', 'breads'

  @Column({ type: 'integer', nullable: true })
  min_price_cents?: number;

  @Column({ type: 'integer', nullable: true })
  max_price_cents?: number;

  @Column({ type: 'simple-array', nullable: true })
  default_allergens?: string[];

  @Column({ type: 'simple-array', nullable: true })
  aliases?: string[];

  @Column({ type: 'integer', default: 0 })
  popularity_score!: number; // 0-100

  @Column({ type: 'text', nullable: true })
  image_url?: string;

  @Column({ type: 'simple-array', nullable: true })
  tags?: string[];

  @Column({ type: 'boolean', default: true })
  active!: boolean;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
