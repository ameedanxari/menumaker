import { AppDataSource } from '../data-source.js';
import { FeatureFlag } from '../models/FeatureFlag.js';
import { AuditLog } from '../models/AuditLog.js';
import { User } from '../models/User.js';

/**
 * FeatureFlagService - Feature Toggles & Gradual Rollouts
 * Phase 3: Admin Backend Platform (US3.10)
 *
 * Handles:
 * - Feature flag management (create, update, delete)
 * - Gradual rollout (percentage-based)
 * - Subscription tier overrides
 * - User whitelisting for beta testing
 * - Emergency kill switch
 */
export class FeatureFlagService {
  private static flagRepo = AppDataSource.getRepository(FeatureFlag);
  private static auditLogRepo = AppDataSource.getRepository(AuditLog);
  private static userRepo = AppDataSource.getRepository(User);

  /**
   * Check if a feature is enabled for a user
   */
  static async isFeatureEnabled(params: {
    flag_key: string;
    user_id?: string;
    subscription_tier?: string;
  }): Promise<boolean> {
    const { flag_key, user_id, subscription_tier } = params;

    const flag = await this.flagRepo.findOne({
      where: { flag_key, status: 'active' },
    });

    if (!flag) {
      return false; // Feature flag not found or archived
    }

    // Global off switch
    if (!flag.is_enabled) {
      return false;
    }

    // Check user whitelist (beta testers)
    if (user_id && flag.whitelisted_user_ids && flag.whitelisted_user_ids.includes(user_id)) {
      return true;
    }

    // Check subscription tier override
    if (subscription_tier && flag.tier_overrides) {
      const tierOverride = flag.tier_overrides[subscription_tier];
      if (tierOverride !== undefined) {
        return tierOverride;
      }
    }

    // Gradual rollout (percentage-based)
    if (flag.rollout_percentage < 100 && user_id) {
      // Use consistent hashing to determine if user is in rollout
      const hash = this.hashUserId(user_id, flag_key);
      const userPercentile = hash % 100;
      return userPercentile < flag.rollout_percentage;
    }

    // Default: enabled if rollout_percentage is 100%
    return flag.rollout_percentage === 100;
  }

  /**
   * Hash user ID for consistent rollout determination
   */
  private static hashUserId(userId: string, flagKey: string): number {
    // Simple hash function for consistent user bucketing
    const combined = `${userId}-${flagKey}`;
    let hash = 0;
    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Get all feature flags
   */
  static async listFeatureFlags(params?: { status?: string }) {
    const { status } = params || {};

    const queryBuilder = this.flagRepo.createQueryBuilder('flag');

    if (status) {
      queryBuilder.where('flag.status = :status', { status });
    }

    queryBuilder.orderBy('flag.display_name', 'ASC');

    const flags = await queryBuilder.getMany();
    return { flags };
  }

  /**
   * Get feature flag details
   */
  static async getFeatureFlagDetails(flagKey: string) {
    const flag = await this.flagRepo.findOne({
      where: { flag_key: flagKey },
    });

    if (!flag) {
      throw new Error('Feature flag not found');
    }

    // Calculate how many users are affected by this flag
    // (This is an approximation based on rollout percentage)
    const totalUsers = await this.userRepo.count();
    const estimatedAffectedUsers = Math.round((totalUsers * flag.rollout_percentage) / 100);

    return {
      flag,
      estimated_affected_users: estimatedAffectedUsers,
    };
  }

  /**
   * Create a new feature flag
   */
  static async createFeatureFlag(params: {
    flag_key: string;
    display_name: string;
    description?: string;
    is_enabled?: boolean;
    rollout_percentage?: number;
    tier_overrides?: Record<string, boolean>;
    admin_user_id: string;
    ip_address: string;
  }) {
    const {
      flag_key,
      display_name,
      description,
      is_enabled = false,
      rollout_percentage = 0,
      tier_overrides,
      admin_user_id,
      ip_address,
    } = params;

    // Check if flag already exists
    const existing = await this.flagRepo.findOne({ where: { flag_key } });
    if (existing) {
      throw new Error('Feature flag with this key already exists');
    }

    // Create flag
    const flag = this.flagRepo.create({
      flag_key,
      display_name,
      description,
      is_enabled,
      rollout_percentage,
      tier_overrides,
      status: 'active',
    });

    await this.flagRepo.save(flag);

    // Create audit log
    await this.auditLogRepo.save({
      admin_user_id,
      action: 'create_feature_flag',
      target_type: 'feature_flag',
      target_id: flag.id,
      details: {
        flag_key,
        display_name,
        is_enabled,
        rollout_percentage,
      },
      ip_address,
    });

    return { flag };
  }

  /**
   * Update feature flag
   */
  static async updateFeatureFlag(params: {
    flag_key: string;
    is_enabled?: boolean;
    rollout_percentage?: number;
    tier_overrides?: Record<string, boolean>;
    whitelisted_user_ids?: string[];
    status?: string;
    admin_user_id: string;
    ip_address: string;
  }) {
    const {
      flag_key,
      is_enabled,
      rollout_percentage,
      tier_overrides,
      whitelisted_user_ids,
      status,
      admin_user_id,
      ip_address,
    } = params;

    const flag = await this.flagRepo.findOne({ where: { flag_key } });
    if (!flag) {
      throw new Error('Feature flag not found');
    }

    // Track changes for audit
    const changes: Record<string, any> = {};

    if (is_enabled !== undefined && flag.is_enabled !== is_enabled) {
      changes.is_enabled = { from: flag.is_enabled, to: is_enabled };
      flag.is_enabled = is_enabled;
    }

    if (rollout_percentage !== undefined && flag.rollout_percentage !== rollout_percentage) {
      changes.rollout_percentage = { from: flag.rollout_percentage, to: rollout_percentage };
      flag.rollout_percentage = rollout_percentage;
    }

    if (tier_overrides !== undefined) {
      changes.tier_overrides = { from: flag.tier_overrides, to: tier_overrides };
      flag.tier_overrides = tier_overrides;
    }

    if (whitelisted_user_ids !== undefined) {
      changes.whitelisted_user_ids = { from: flag.whitelisted_user_ids, to: whitelisted_user_ids };
      flag.whitelisted_user_ids = whitelisted_user_ids;
    }

    if (status !== undefined && flag.status !== status) {
      changes.status = { from: flag.status, to: status };
      flag.status = status;
    }

    await this.flagRepo.save(flag);

    // Create audit log
    await this.auditLogRepo.save({
      admin_user_id,
      action: 'update_feature_flag',
      target_type: 'feature_flag',
      target_id: flag.id,
      details: {
        flag_key,
        changes,
      },
      ip_address,
    });

    return { flag };
  }

  /**
   * Emergency kill switch (disable feature immediately)
   */
  static async emergencyDisableFeature(params: {
    flag_key: string;
    admin_user_id: string;
    reason: string;
    ip_address: string;
  }) {
    const { flag_key, admin_user_id, reason, ip_address } = params;

    const flag = await this.flagRepo.findOne({ where: { flag_key } });
    if (!flag) {
      throw new Error('Feature flag not found');
    }

    flag.is_enabled = false;
    flag.rollout_percentage = 0;
    await this.flagRepo.save(flag);

    // Create audit log
    await this.auditLogRepo.save({
      admin_user_id,
      action: 'emergency_disable_feature',
      target_type: 'feature_flag',
      target_id: flag.id,
      details: {
        flag_key,
        reason,
        emergency: true,
      },
      ip_address,
    });

    return { success: true };
  }

  /**
   * Delete feature flag
   */
  static async deleteFeatureFlag(params: { flag_key: string; admin_user_id: string; ip_address: string }) {
    const { flag_key, admin_user_id, ip_address } = params;

    const flag = await this.flagRepo.findOne({ where: { flag_key } });
    if (!flag) {
      throw new Error('Feature flag not found');
    }

    await this.flagRepo.remove(flag);

    // Create audit log
    await this.auditLogRepo.save({
      admin_user_id,
      action: 'delete_feature_flag',
      target_type: 'feature_flag',
      target_id: flag.id,
      details: {
        flag_key,
        display_name: flag.display_name,
      },
      ip_address,
    });

    return { success: true };
  }

  /**
   * Get feature flag usage stats
   */
  static async getFeatureFlagStats(flagKey: string) {
    const flag = await this.flagRepo.findOne({ where: { flag_key: flagKey } });
    if (!flag) {
      throw new Error('Feature flag not found');
    }

    // Calculate affected users
    const totalUsers = await this.userRepo.count();
    const whitelistedCount = flag.whitelisted_user_ids?.length || 0;
    const rolloutCount = Math.round((totalUsers * flag.rollout_percentage) / 100);

    // Estimate total enabled users
    const estimatedEnabledUsers = flag.is_enabled ? whitelistedCount + rolloutCount : 0;

    return {
      flag_key: flagKey,
      is_enabled: flag.is_enabled,
      total_users: totalUsers,
      whitelisted_users: whitelistedCount,
      rollout_users: rolloutCount,
      estimated_enabled_users: estimatedEnabledUsers,
      rollout_percentage: flag.rollout_percentage,
    };
  }
}
