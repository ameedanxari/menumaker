import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  OneToMany,
} from 'typeorm';
import { Business } from './Business.js';
import { OrderNotification } from './OrderNotification.js';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email!: string;

  @Column({ type: 'varchar', length: 500 })
  password_hash!: string;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;

  // Relations
  @OneToOne(() => Business, (business) => business.owner)
  business?: Business;

  @OneToMany(() => OrderNotification, (notification) => notification.user)
  notifications?: OrderNotification[];
}
