import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Business } from './Business.js';
import { CommonDish } from './CommonDish.js';
import { DishCategory } from './DishCategory.js';
import { MenuItem } from './MenuItem.js';
import { OrderItem } from './OrderItem.js';

@Entity('dishes')
export class Dish {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Business, (business) => business.dishes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'business_id' })
  business!: Business;

  @Column({ type: 'uuid' })
  business_id!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'text' })
  description!: string;

  /**
   * Translations for dish name (Phase 3.3 - i18n)
   * Format: { "hi": "पनीर बटर मसाला", "ta": "பனீர் பட்டர் மசாலா", "ar": "بانير بتر ماسالا" }
   */
  @Column({ type: 'jsonb', nullable: true })
  name_translations?: Record<string, string>;

  /**
   * Translations for dish description (Phase 3.3 - i18n)
   * Format: { "hi": "स्वादिष्ट पनीर करी", "ta": "சுவையான பனீர் கறி", "ar": "كاري لذيذ" }
   */
  @Column({ type: 'jsonb', nullable: true })
  description_translations?: Record<string, string>;

  @Column({ type: 'integer' })
  price_cents!: number;

  @Column({ type: 'varchar', length: 3, default: 'INR' })
  currency!: string;

  @Column({ type: 'simple-array', default: '' })
  allergen_tags!: string[];

  @Column({ type: 'simple-array', default: '' })
  image_urls!: string[];

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @Column({ type: 'boolean', default: true })
  is_available!: boolean;

  @Column({ type: 'integer', default: 0 })
  position!: number;

  // Reference to common dish template
  @ManyToOne(() => CommonDish, { nullable: true })
  @JoinColumn({ name: 'common_dish_id' })
  common_dish?: CommonDish;

  @Column({ type: 'uuid', nullable: true })
  common_dish_id?: string;

  // Reference to user-defined category
  @ManyToOne(() => DishCategory, (category) => category.dishes, { nullable: true })
  @JoinColumn({ name: 'category_id' })
  category?: DishCategory;

  @Column({ type: 'uuid', nullable: true })
  category_id?: string;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;

  // Relations
  @OneToMany(() => MenuItem, (item) => item.dish, { cascade: true })
  menu_items?: MenuItem[];

  @OneToMany(() => OrderItem, (item) => item.dish)
  order_items?: OrderItem[];
}
