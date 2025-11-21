import type { Relation } from 'typeorm';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index} from 'typeorm';
import { Business } from './Business.js';
import { MenuItem } from './MenuItem.js';
import { Order } from './Order.js';

@Entity('menus')
@Index(['business_id', 'status'])
export class Menu {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Business, (business) => business.menus, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'business_id' })
  business!: Relation<Business>;

  @Column({ type: 'uuid' })
  business_id!: string;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'date' })
  start_date!: Date;

  @Column({ type: 'date' })
  end_date!: Date;

  @Column({ type: 'varchar', default: 'draft' })
  status!: 'draft' | 'published' | 'archived';

  @Column({ type: 'integer', default: 0 })
  version!: number;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;

  // Relations
  @OneToMany(() => MenuItem, (item) => item.menu, { cascade: true })
  menu_items?: Relation<MenuItem[]>;

  @OneToMany(() => Order, (order) => order.menu)
  orders?: Relation<Order[]>;
}
