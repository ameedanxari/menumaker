import type { Relation } from 'typeorm';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * Saved Cart Entity (Phase 2.7 - Re-order Flow)
 *
 * Allows customers to save cart presets for quick re-ordering.
 * E.g., "My Weekly Tiffin", "Family Dinner", etc.
 */

@Entity('saved_carts')
@Index(['customer_phone'])
@Index(['customer_email'])
export class SavedCart {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // Customer identification (phone-based, no auth required)
  @Column({ type: 'varchar', length: 20 })
  customer_phone!: string; // E.164 format recommended

  @Column({ type: 'varchar', length: 255, nullable: true })
  customer_email?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  customer_name?: string;

  // Cart details
  @Column({ type: 'varchar', length: 100 })
  cart_name!: string; // E.g., "My Weekly Tiffin", "Family Dinner"

  /**
   * Cart items (JSON array):
   * [
   *   { "dish_id": "uuid", "dish_name": "Butter Chicken", "quantity": 2, "price_cents": 25000 },
   *   { "dish_id": "uuid", "dish_name": "Naan", "quantity": 4, "price_cents": 2000 }
   * ]
   */
  @Column({ type: 'text' })
  cart_items!: string; // JSON string

  @Column({ type: 'integer' })
  total_cents!: number; // Total price of cart

  @Column({ type: 'integer', default: 0 })
  times_used!: number; // How many times this cart has been reordered

  @Column({ type: 'timestamp', nullable: true })
  last_used_at?: Date;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
