import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  JoinColumn,
  Relation,
} from 'typeorm';
import { User } from './User.js';
import { Dish } from './Dish.js';
import { DishCategory } from './DishCategory.js';
import { Menu } from './Menu.js';
import { Order } from './Order.js';
import { Payout } from './Payout.js';
import { BusinessSettings } from './BusinessSettings.js';

@Entity('businesses')
export class Business {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => User, (user) => user.business, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'owner_id' })
  owner!: Relation<User>;

  @Column({ type: 'uuid' })
  owner_id!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email?: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  slug!: string;

  @Column({ type: 'varchar', length: 2048, nullable: true })
  logo_url?: string;

  @Column({ type: 'varchar', length: 7, default: '#000000' })
  primary_color!: string;

  @Column({ type: 'varchar', length: 3, default: 'en' })
  locale!: string;

  @Column({ type: 'varchar', length: 30, default: 'Asia/Kolkata' })
  timezone!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  // Phase 3: Admin Backend - Moderation Fields
  @Column({ type: 'boolean', default: true })
  is_published!: boolean; // Can be set to false by admin (suspension)

  @Column({ type: 'timestamp', nullable: true })
  deleted_at?: Date; // Soft delete timestamp (when user is banned)

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;

  // Relations
  @OneToMany(() => Dish, (dish) => dish.business, { cascade: true })
  dishes?: Relation<Dish[]>;

  @OneToMany(() => DishCategory, (category) => category.business, { cascade: true })
  dish_categories?: Relation<DishCategory[]>;

  @OneToMany(() => Menu, (menu) => menu.business, { cascade: true })
  menus?: Relation<Menu[]>;

  @OneToMany(() => Order, (order) => order.business)
  orders?: Relation<Order[]>;

  @OneToMany(() => Payout, (payout) => payout.business)
  payouts?: Relation<Payout[]>;

  @OneToOne(() => BusinessSettings, (settings) => settings.business, { cascade: true })
  settings?: Relation<BusinessSettings>;
}
