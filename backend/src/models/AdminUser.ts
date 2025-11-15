import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * AdminUser entity for platform administrators
 * Phase 3: Admin Backend Platform (US3.10)
 *
 * Roles:
 * - super_admin: Full access (user management, moderation, analytics, feature flags, audit logs)
 * - moderator: Content moderation, view analytics, view users (no ban/suspend)
 * - support_agent: Support tickets, view users (no ban/suspend/moderation)
 */
@Entity('admin_users')
@Index(['email'], { unique: true })
@Index(['role'])
export class AdminUser {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email!: string;

  @Column({ type: 'varchar', length: 255 })
  password_hash!: string; // bcrypt hash

  @Column({ type: 'varchar', length: 100, nullable: true })
  full_name?: string;

  @Column({ type: 'varchar', length: 50, default: 'support_agent' })
  role!: string; // 'super_admin' | 'moderator' | 'support_agent'

  @Column({ type: 'boolean', default: false })
  two_factor_enabled!: boolean; // Mandatory for all admin users

  @Column({ type: 'varchar', length: 32, nullable: true })
  two_factor_secret?: string; // TOTP secret (base32 encoded)

  @Column({ type: 'varchar', length: 45, nullable: true })
  last_login_ip?: string;

  @Column({ type: 'timestamp', nullable: true })
  last_login_at?: Date;

  @Column({ type: 'simple-array', nullable: true })
  whitelisted_ips?: string[]; // ['192.168.1.1', '10.0.0.1'] - Optional IP whitelist

  @Column({ type: 'boolean', default: true })
  is_active!: boolean; // Can be deactivated by super_admin

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
