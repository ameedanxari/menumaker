import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Relation,
} from 'typeorm';
import { Order } from './Order.js';
import { Dish } from './Dish.js';

@Entity('order_items')
export class OrderItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Order, (order) => order.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order!: Relation<Order>;

  @Column({ type: 'uuid' })
  order_id!: string;

  @ManyToOne(() => Dish)
  @JoinColumn({ name: 'dish_id' })
  dish!: Relation<Dish>;

  @Column({ type: 'uuid' })
  dish_id!: string;

  @Column({ type: 'integer' })
  quantity!: number;

  @Column({ type: 'integer' })
  price_at_purchase_cents!: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  dish_name?: string;

  @CreateDateColumn()
  created_at!: Date;

  // Aliases for legacy code compatibility
  get price_cents(): number {
    return this.price_at_purchase_cents;
  }
  set price_cents(value: number) {
    this.price_at_purchase_cents = value;
  }

  get unit_price_cents(): number {
    return this.price_at_purchase_cents;
  }
  set unit_price_cents(value: number) {
    this.price_at_purchase_cents = value;
  }
}
