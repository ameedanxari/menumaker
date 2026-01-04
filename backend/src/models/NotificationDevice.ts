import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export type DevicePlatform = 'ios' | 'android' | 'web';

@Entity('notification_devices')
@Index(['user_id'])
@Index(['device_token'], { unique: true })
export class NotificationDevice {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  user_id!: string;

  @Column({ type: 'varchar', length: 20 })
  platform!: DevicePlatform;

  @Column({ type: 'varchar', length: 255 })
  device_token!: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  locale?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  app_version?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  device_model?: string;

  @Column({ type: 'timestamp', nullable: true })
  last_seen_at?: Date;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
