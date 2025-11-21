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
 * FeatureFlag entity for feature toggles and gradual rollouts
 * Phase 3: Admin Backend Platform (US3.10)
 *
 * Allows enabling/disabling features globally or per subscription tier
 * Supports gradual rollouts (10%, 50%, 100% of users)
 */
@Entity('feature_flags')
@Index(['flag_key'], { unique: true })
@Index(['is_enabled'])
export class FeatureFlag {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  flag_key!: string;
  // Examples: 'whatsapp_automation_enabled', 'ocr_import_enabled',
  //           'marketplace_discovery_enabled', 'referral_leaderboard_enabled'

  @Column({ type: 'varchar', length: 200 })
  display_name!: string; // Human-readable name

  @Column({ type: 'text', nullable: true })
  description?: string; // What this flag controls

  @Column({ type: 'boolean', default: false })
  is_enabled!: boolean; // Global on/off toggle

  @Column({ type: 'integer', default: 100 })
  rollout_percentage!: number; // 0-100: percentage of users to enable for (gradual rollout)

  @Column({ type: 'jsonb', nullable: true })
  tier_overrides?: Record<string, boolean>;
  // Example: { 'free': false, 'pro': true, 'business': true }
  // Allows enabling feature only for specific subscription tiers

  @Column({ type: 'simple-array', nullable: true })
  whitelisted_user_ids?: string[]; // Specific users who have access (beta testing)

  @Column({ type: 'varchar', length: 50, default: 'active' })
  status!: string; // 'active' | 'deprecated' | 'archived'

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;
  // Additional configuration (API rate limits, feature-specific settings)

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
