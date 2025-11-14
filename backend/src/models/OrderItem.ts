import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Order } from './Order.js';
import { Dish } from './Dish.js';

@Entity('order_items')
export class OrderItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Order, (order) => order.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order!: Order;

  @Column({ type: 'uuid' })
  order_id!: string;

  @ManyToOne(() => Dish)
  @JoinColumn({ name: 'dish_id' })
  dish!: Dish;

  @Column({ type: 'uuid' })
  dish_id!: string;

  @Column({ type: 'integer' })
  quantity!: number;

  @Column({ type: 'integer' })
  price_at_purchase_cents!: number;

  @CreateDateColumn()
  created_at!: Date;
}
