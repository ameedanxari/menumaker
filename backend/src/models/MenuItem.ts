import type { Relation } from 'typeorm';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index} from 'typeorm';
import { Menu } from './Menu.js';
import { Dish } from './Dish.js';

@Entity('menu_items')
@Index(['menu_id', 'dish_id'], { unique: true })
export class MenuItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Menu, (menu) => menu.menu_items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'menu_id' })
  menu!: Relation<Menu>;

  @Column({ type: 'uuid' })
  menu_id!: string;

  @ManyToOne(() => Dish, (dish) => dish.menu_items)
  @JoinColumn({ name: 'dish_id' })
  dish!: Relation<Dish>;

  @Column({ type: 'uuid' })
  dish_id!: string;

  @Column({ type: 'integer', nullable: true })
  price_override_cents?: number;

  @Column({ type: 'integer', default: 0 })
  position!: number;

  @Column({ type: 'boolean', default: true })
  is_available!: boolean;

  @CreateDateColumn()
  created_at!: Date;
}
