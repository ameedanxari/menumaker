import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { Business } from './Business.js';
import { Dish } from './Dish.js';

@Entity('dish_categories')
@Index(['business_id', 'name'], { unique: true })
export class DishCategory {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 50 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  /**
   * Translations for category name (Phase 3.3 - i18n)
   * Format: { "hi": "मुख्य व्यंजन", "ta": "முக்கிய உணவுகள்", "ar": "الأطباق الرئيسية" }
   */
  @Column({ type: 'jsonb', nullable: true })
  name_translations?: Record<string, string>;

  /**
   * Translations for category description (Phase 3.3 - i18n)
   * Format: { "hi": "हमारे प्रमुख व्यंजन", "ta": "எங்கள் பிரதான உணவுகள்", "ar": "أطباقنا الرئيسية" }
   */
  @Column({ type: 'jsonb', nullable: true })
  description_translations?: Record<string, string>;

  @Column({ type: 'integer', default: 0 })
  sort_order!: number;

  @ManyToOne(() => Business, (business) => business.dish_categories, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'business_id' })
  business!: Business;

  @Column({ type: 'uuid' })
  business_id!: string;

  @Column({ type: 'boolean', default: false })
  is_default!: boolean;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;

  // Relations
  @OneToMany(() => Dish, (dish) => dish.category)
  dishes?: Dish[];
}
