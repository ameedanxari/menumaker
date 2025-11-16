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
import { Menu } from './Menu.js';
import { OrderItem } from './OrderItem.js';
import { OrderNotification } from './OrderNotification.js';

@Entity('orders')
@Index(['business_id', 'order_status'])
@Index(['created_at'])
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Business, (business) => business.orders, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'business_id' })
  business!: Business;

  @Column({ type: 'uuid' })
  business_id!: string;

  @ManyToOne(() => Menu, (menu) => menu.orders)
  @JoinColumn({ name: 'menu_id' })
  menu!: Menu;

  @Column({ type: 'uuid' })
  menu_id!: string;

  @Column({ type: 'uuid', nullable: true })
  customer_id?: string;

  @Column({ type: 'varchar', length: 255 })
  customer_name!: string;

  @Column({ type: 'varchar', length: 20 })
  customer_phone!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  customer_email?: string;

  @Column({ type: 'varchar' })
  delivery_type!: 'pickup' | 'delivery';

  @Column({ type: 'text', nullable: true })
  delivery_address?: string;

  @Column({ type: 'integer' })
  total_cents!: number;

  @Column({ type: 'integer', default: 0 })
  delivery_fee_cents!: number;

  @Column({ type: 'varchar' })
  payment_method!: string;

  @Column({ type: 'varchar', default: 'unpaid' })
  payment_status!: 'unpaid' | 'paid' | 'failed';

  @Column({ type: 'varchar', default: 'pending' })
  order_status!: 'pending' | 'confirmed' | 'ready' | 'fulfilled' | 'cancelled';

  // Alias for order_status to support legacy code
  get status(): 'pending' | 'confirmed' | 'ready' | 'fulfilled' | 'cancelled' {
    return this.order_status;
  }
  set status(value: 'pending' | 'confirmed' | 'ready' | 'fulfilled' | 'cancelled') {
    this.order_status = value;
  }

  // Alias for total_cents to support legacy code
  get total_amount_cents(): number {
    return this.total_cents;
  }
  set total_amount_cents(value: number) {
    this.total_cents = value;
  }

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ type: 'varchar', length: 3, default: 'INR' })
  currency!: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;

  @Column({ type: 'timestamp', nullable: true })
  fulfilled_at?: Date;

  @Column({ type: 'timestamp', nullable: true })
  anonymized_at?: Date;

  // Relations
  @OneToMany(() => OrderItem, (item) => item.order, { cascade: true })
  items?: OrderItem[];

  @OneToMany(() => OrderNotification, (notification) => notification.order)
  notifications?: OrderNotification[];
}
