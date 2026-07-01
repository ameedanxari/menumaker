import { In } from 'typeorm';
import { AppDataSource } from '../config/database.js';
import { ContentFlag } from '../models/ContentFlag.js';
import { AuditLog } from '../models/AuditLog.js';
import { User } from '../models/User.js';

export interface ModerationContentAdapter {
  hide?(targetId: string, params: { actor: string; reason: string }): Promise<Record<string, unknown>>;
  delete?(targetId: string, params: { actor: string; reason: string }): Promise<Record<string, unknown>>;
  warnUser?(targetId: string, params: { actor: string; reason: string }): Promise<Record<string, unknown>>;
  suspendUser?(targetId: string, params: { actor: string; reason: string }): Promise<Record<string, unknown>>;
  banUser?(targetId: string, params: { actor: string; reason: string }): Promise<Record<string, unknown>>;
}

export interface ModerationActionAuditResult {
  status: string;
  flag_type: string;
  target_id: string;
  action: string;
  actor: string;
  reason: string;
  before: unknown;
  after: unknown;
  applied: boolean;
  occurred_at: string;
}

/**
 * ModerationService - Content Moderation & Safety
 * Phase 3: Content Moderation & Safety (US3.5A)
 *
 * Handles:
 * - Content flagging (reviews, dishes, images, profiles)
 * - Auto-moderation rules (auto-hide after 3 flags)
 * - Moderation queue management
 * - Flag approval/rejection
 * - User warnings and actions
 */
export class ModerationService {
  private static flagRepo = AppDataSource.getRepository(ContentFlag);
  private static auditLogRepo = AppDataSource.getRepository(AuditLog);
  private static userRepo = AppDataSource.getRepository(User);
  private static contentAdapters = new Map<string, ModerationContentAdapter>();

  // Auto-moderation thresholds
  private static readonly AUTO_HIDE_THRESHOLD = 3; // Hide content after 3 flags
  private static readonly AUTO_BAN_THRESHOLD = 5; // Ban user after 5 rejected flags
  private static readonly APPROVAL_ACTIONS = new Set([
    'content_hidden',
    'content_deleted',
    'user_warned',
    'user_suspended',
    'user_banned',
  ]);
  private static readonly ACTION_RESULT_KEYS = new Set(['status', 'before', 'after']);

  static setContentAdapterForTesting(flagType: string, adapter: ModerationContentAdapter | null) {
    if (adapter) {
      this.contentAdapters.set(flagType, adapter);
    } else {
      this.contentAdapters.delete(flagType);
    }
  }

  private static assertNonEmptyString(value: unknown, fieldName: string): string {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new Error(`${fieldName} must be a non-empty string`);
    }
    if (this.hasUnsafeModerationTextControls(value)) {
      throw new Error(`${fieldName} must not include unsafe control characters`);
    }
    const normalizedValue = value.trim();
    if (this.hasUnsafeModerationTextControls(normalizedValue)) {
      throw new Error(`${fieldName} must not include unsafe control characters`);
    }
    return normalizedValue;
  }

  private static assertSafeOptionalString(value: unknown, fieldName: string): string {
    if (typeof value !== 'string') {
      throw new Error(`${fieldName} must be a string`);
    }
    if (this.hasUnsafeModerationTextControls(value)) {
      throw new Error(`${fieldName} must not include unsafe control characters`);
    }
    const normalizedValue = value.trim();
    if (this.hasUnsafeModerationTextControls(normalizedValue)) {
      throw new Error(`${fieldName} must not include unsafe control characters`);
    }
    return normalizedValue;
  }

  private static hasUnsafeModerationTextControls(value: string): boolean {
    return /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/u.test(value);
  }

  private static assertApprovalAction(value: unknown, fieldName: string): string {
    const action = this.assertNonEmptyString(value, fieldName);
    if (!this.APPROVAL_ACTIONS.has(action)) {
      throw new Error(`${fieldName} must be a supported moderation approval action`);
    }
    return action;
  }

  private static assertPendingFlag(flag: ContentFlag, label: string): void {
    if (flag.status !== 'pending') {
      throw new Error(`${label} status must be pending before review`);
    }
  }

  private static normalizeActionAuditResult(
    rawResult: Record<string, unknown>,
    flagType: string,
    targetId: string,
    action: string,
    context: { actor: string; reason: string },
    applied: boolean
  ): ModerationActionAuditResult {
    if (!rawResult || typeof rawResult !== 'object' || Array.isArray(rawResult)) {
      throw new Error('Moderation action result must be an object');
    }

    const unsafeKeys = Object.keys(rawResult).filter((key) => this.hasUnsafeModerationTextControls(key));
    if (unsafeKeys.length > 0) {
      throw new Error('Moderation action result field names contain unsafe control characters');
    }

    const unsupportedKeys = Object.keys(rawResult).filter((key) => !this.ACTION_RESULT_KEYS.has(key));
    if (unsupportedKeys.length > 0) {
      throw new Error(
        `Moderation action result include unsupported field(s): ${unsupportedKeys.sort().join(', ')}`
      );
    }

    const status = this.assertNonEmptyString(rawResult.status, 'Moderation action result status');
    if (applied) {
      if (!Object.prototype.hasOwnProperty.call(rawResult, 'before')) {
        throw new Error('Moderation action result before must be present');
      }
      if (!Object.prototype.hasOwnProperty.call(rawResult, 'after')) {
        throw new Error('Moderation action result after must be present');
      }
    }

    return {
      status,
      flag_type: flagType,
      target_id: targetId,
      action,
      actor: context.actor,
      reason: context.reason,
      before: applied ? rawResult.before : null,
      after: applied ? rawResult.after : null,
      applied,
      occurred_at: new Date().toISOString(),
    };
  }

  /**
   * Submit a content flag (report offensive content)
   */
  static async submitFlag(params: {
    flag_type: 'review' | 'dish' | 'image' | 'profile' | 'menu';
    target_id: string;
    reason: 'spam' | 'offensive' | 'inappropriate' | 'harassment' | 'fraud' | 'other';
    description?: string;
    reporter_id: string;
  }) {
    const { flag_type, target_id, reason, description, reporter_id } = params;
    const normalizedFlagType = this.assertNonEmptyString(flag_type, 'Moderation flag_type');
    const normalizedTargetId = this.assertNonEmptyString(target_id, 'Moderation target_id');
    const normalizedReason = this.assertNonEmptyString(reason, 'Moderation reason');
    const normalizedDescription =
      description === undefined || description === null
        ? description
        : this.assertSafeOptionalString(description, 'Moderation description');
    const normalizedReporterId = this.assertNonEmptyString(reporter_id, 'Moderation reporter_id');

    // Check if user has already flagged this content
    const existingFlag = await this.flagRepo.findOne({
      where: {
        flag_type: normalizedFlagType,
        target_id: normalizedTargetId,
        reporter_id: normalizedReporterId,
      },
    });

    if (existingFlag) {
      throw new Error('You have already flagged this content');
    }

    // Create flag
    const flag = this.flagRepo.create({
      flag_type: normalizedFlagType,
      target_id: normalizedTargetId,
      reason: normalizedReason,
      description: normalizedDescription,
      reporter_id: normalizedReporterId,
      status: 'pending',
      auto_hidden: false,
    });

    await this.flagRepo.save(flag);

    // Check if threshold reached for auto-hide
    const flagCount = await this.flagRepo.count({
      where: {
        flag_type: normalizedFlagType,
        target_id: normalizedTargetId,
        status: 'pending',
      },
    });

    if (flagCount >= this.AUTO_HIDE_THRESHOLD) {
      await this.flagRepo.update(
        { flag_type: normalizedFlagType, target_id: normalizedTargetId, status: 'pending' },
        { auto_hidden: true }
      );

      await this.executeContentAction(normalizedFlagType, normalizedTargetId, 'content_hidden', {
        actor: 'system:auto-hide',
        reason: `${flagCount} pending flags reached the auto-hide threshold`,
      });
    }

    return { flag, total_flags: flagCount };
  }

  /**
   * Get moderation queue (all pending flags)
   */
  static async getModerationQueue(params: {
    page?: number;
    limit?: number;
    flag_type?: string;
    status?: string;
    auto_hidden_only?: boolean;
  }) {
    const { page = 1, limit = 50, flag_type, status = 'pending', auto_hidden_only } = params;
    const normalizedFlagType =
      flag_type === undefined || flag_type === null
        ? undefined
        : this.assertNonEmptyString(flag_type, 'Moderation flag_type');
    const normalizedStatus =
      status === undefined || status === null
        ? undefined
        : this.assertNonEmptyString(status, 'Moderation status');

    const queryBuilder = this.flagRepo.createQueryBuilder('flag');

    // Filter by flag type
    if (normalizedFlagType) {
      queryBuilder.where('flag.flag_type = :flag_type', { flag_type: normalizedFlagType });
    }

    // Filter by status
    if (normalizedStatus) {
      if (!normalizedFlagType) {
        queryBuilder.where('flag.status = :status', { status: normalizedStatus });
      } else {
        queryBuilder.andWhere('flag.status = :status', { status: normalizedStatus });
      }
    }

    // Filter by auto-hidden only
    if (auto_hidden_only) {
      queryBuilder.andWhere('flag.auto_hidden = true');
    }

    // Join reporter info
    queryBuilder.leftJoinAndSelect('flag.reporter', 'reporter');
    queryBuilder.leftJoinAndSelect('flag.reviewed_by', 'reviewed_by');

    // Pagination
    const offset = (page - 1) * limit;
    queryBuilder.skip(offset).take(limit);

    // Order by created_at DESC (oldest first, most urgent)
    queryBuilder.orderBy('flag.created_at', 'ASC');

    // Execute query
    const [flags, total] = await queryBuilder.getManyAndCount();

    return {
      data: flags,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get flags for a specific content item
   */
  static async getFlagsForContent(flag_type: string, target_id: string) {
    const normalizedFlagType = this.assertNonEmptyString(flag_type, 'Moderation flag_type');
    const normalizedTargetId = this.assertNonEmptyString(target_id, 'Moderation target_id');
    const flags = await this.flagRepo.find({
      where: { flag_type: normalizedFlagType, target_id: normalizedTargetId },
      relations: ['reporter', 'reviewed_by'],
      order: { created_at: 'DESC' },
    });

    const flagCount = flags.length;
    const pendingCount = flags.filter((f) => f.status === 'pending').length;
    const autoHidden = flags.some((f) => f.auto_hidden);

    return {
      flags,
      stats: {
        total_flags: flagCount,
        pending_flags: pendingCount,
        auto_hidden: autoHidden,
      },
    };
  }

  /**
   * Approve flag (remove content, take action)
   */
  static async approveFlag(params: {
    flag_id: string;
    admin_user_id: string;
    action_taken: 'content_hidden' | 'content_deleted' | 'user_warned' | 'user_suspended' | 'user_banned';
    moderator_notes?: string;
    ip_address: string;
  }) {
    const { flag_id, admin_user_id, action_taken, moderator_notes, ip_address } = params;
    const normalizedFlagId = this.assertNonEmptyString(flag_id, 'Moderation flag_id');
    const normalizedAdminUserId = this.assertNonEmptyString(admin_user_id, 'Moderation admin_user_id');
    const normalizedActionTaken = this.assertApprovalAction(action_taken, 'Moderation action_taken');
    const normalizedModeratorNotes =
      moderator_notes === undefined || moderator_notes === null
        ? moderator_notes
        : this.assertSafeOptionalString(moderator_notes, 'Moderation moderator_notes');
    const normalizedIpAddress = this.assertNonEmptyString(ip_address, 'Moderation ip_address');

    const flag = await this.flagRepo.findOne({
      where: { id: normalizedFlagId },
      relations: ['reporter'],
    });

    if (!flag) {
      throw new Error('Flag not found');
    }

    this.assertPendingFlag(flag, `Flag ${flag.id}`);

    const actionResult = await this.executeContentAction(flag.flag_type, flag.target_id, normalizedActionTaken, {
      actor: normalizedAdminUserId,
      reason: normalizedModeratorNotes || flag.reason,
    });

    if (!actionResult.applied) {
      throw new Error(`Moderation action ${normalizedActionTaken} is unavailable for ${flag.flag_type}`);
    }

    // Update flag after the adapter has returned auditable mutation evidence.
    flag.status = 'approved';
    flag.reviewed_by_id = normalizedAdminUserId;
    flag.reviewed_at = new Date();
    flag.action_taken = normalizedActionTaken;
    flag.moderator_notes = normalizedModeratorNotes;
    await this.flagRepo.save(flag);

    // Create audit log
    await this.auditLogRepo.save({
      admin_user_id: normalizedAdminUserId,
      action: 'approve_flag',
      target_type: 'flag',
      target_id: normalizedFlagId,
      details: {
        flag_type: flag.flag_type,
        target_id: flag.target_id,
        reason: flag.reason,
        action_taken: normalizedActionTaken,
        content_mutation: actionResult,
        reporter_email: flag.reporter?.email,
      },
      ip_address: normalizedIpAddress,
    });

    return { success: true, content_mutation: actionResult };
  }

  /**
   * Reject flag (no action needed, content is fine)
   */
  static async rejectFlag(params: {
    flag_id: string;
    admin_user_id: string;
    moderator_notes?: string;
    mark_as_false_flag?: boolean; // If true, warn the reporter
    ip_address: string;
  }) {
    const { flag_id, admin_user_id, moderator_notes, mark_as_false_flag, ip_address } = params;
    const normalizedFlagId = this.assertNonEmptyString(flag_id, 'Moderation flag_id');
    const normalizedAdminUserId = this.assertNonEmptyString(admin_user_id, 'Moderation admin_user_id');
    const normalizedModeratorNotes =
      moderator_notes === undefined || moderator_notes === null
        ? moderator_notes
        : this.assertSafeOptionalString(moderator_notes, 'Moderation moderator_notes');
    const normalizedIpAddress = this.assertNonEmptyString(ip_address, 'Moderation ip_address');

    const flag = await this.flagRepo.findOne({
      where: { id: normalizedFlagId },
      relations: ['reporter'],
    });

    if (!flag) {
      throw new Error('Flag not found');
    }
    this.assertPendingFlag(flag, `Flag ${flag.id}`);

    // Update flag
    flag.status = 'rejected';
    flag.reviewed_by_id = normalizedAdminUserId;
    flag.reviewed_at = new Date();
    flag.action_taken = 'no_action';
    flag.moderator_notes = normalizedModeratorNotes;
    await this.flagRepo.save(flag);

    // If marked as false flag, check if reporter should be warned/banned
    if (mark_as_false_flag) {
      const reporter = flag.reporter;
      if (reporter) {
        const falseFlags = await this.flagRepo.count({
          where: {
            reporter_id: reporter.id,
            status: 'rejected',
          },
        });

        if (falseFlags >= this.AUTO_BAN_THRESHOLD) {
          reporter.is_banned = true;
          reporter.ban_reason = 'Repeated false content flags';
          reporter.banned_at = new Date();
          await this.userRepo.save(reporter);
        }
      }
    }

    // Create audit log
    await this.auditLogRepo.save({
      admin_user_id: normalizedAdminUserId,
      action: 'reject_flag',
      target_type: 'flag',
      target_id: normalizedFlagId,
      details: {
        flag_type: flag.flag_type,
        target_id: flag.target_id,
        reason: flag.reason,
        marked_as_false_flag: mark_as_false_flag,
        reporter_email: flag.reporter?.email,
      },
      ip_address: normalizedIpAddress,
    });

    return { success: true };
  }

  /**
   * Bulk approve/reject flags for a content item
   */
  static async bulkReviewFlags(params: {
    flag_type: string;
    target_id: string;
    admin_user_id: string;
    decision: 'approve' | 'reject';
    action_taken?: string;
    moderator_notes?: string;
    ip_address: string;
  }) {
    const { flag_type, target_id, admin_user_id, decision, action_taken, moderator_notes, ip_address } = params;
    const normalizedFlagType = this.assertNonEmptyString(flag_type, 'Moderation flag_type');
    const normalizedTargetId = this.assertNonEmptyString(target_id, 'Moderation target_id');
    const normalizedAdminUserId = this.assertNonEmptyString(admin_user_id, 'Moderation admin_user_id');
    const normalizedDecision = this.assertNonEmptyString(decision, 'Moderation decision');
    if (!['approve', 'reject'].includes(normalizedDecision)) {
      throw new Error('Moderation decision must be approve or reject');
    }
    const normalizedModeratorNotes =
      moderator_notes === undefined || moderator_notes === null
        ? moderator_notes
        : this.assertSafeOptionalString(moderator_notes, 'Moderation moderator_notes');
    const normalizedIpAddress = this.assertNonEmptyString(ip_address, 'Moderation ip_address');

    const flags = await this.flagRepo.find({
      where: { flag_type: normalizedFlagType, target_id: normalizedTargetId, status: 'pending' },
    });

    if (flags.length === 0) {
      throw new Error('No pending flags found for this content');
    }
    flags.forEach((flag, index) => this.assertPendingFlag(flag, `Bulk moderation flag ${index + 1}`));

    let actionResult: ModerationActionAuditResult | null = null;
    if (normalizedDecision === 'approve') {
      const action = this.assertApprovalAction(action_taken, 'Bulk moderation action_taken');
      actionResult = await this.executeContentAction(normalizedFlagType, normalizedTargetId, action, {
        actor: normalizedAdminUserId,
        reason: normalizedModeratorNotes || 'Bulk moderation approval',
      });
      if (!actionResult.applied) {
        throw new Error(`Moderation action ${action} is unavailable for ${normalizedFlagType}`);
      }
    }

    // Update all flags
    for (const flag of flags) {
      flag.status = normalizedDecision === 'approve' ? 'approved' : 'rejected';
      flag.reviewed_by_id = normalizedAdminUserId;
      flag.reviewed_at = new Date();
      flag.action_taken = normalizedDecision === 'approve' ? actionResult!.action : 'no_action';
      flag.moderator_notes = normalizedModeratorNotes;
      await this.flagRepo.save(flag);
    }

    // Create audit log
    await this.auditLogRepo.save({
      admin_user_id: normalizedAdminUserId,
      action: normalizedDecision === 'approve' ? 'bulk_approve_flags' : 'bulk_reject_flags',
      target_type: normalizedFlagType,
      target_id: normalizedTargetId,
      details: {
        flag_count: flags.length,
        decision: normalizedDecision,
        action_taken: normalizedDecision === 'approve' ? actionResult!.action : 'no_action',
        content_mutation: actionResult,
      },
      ip_address: normalizedIpAddress,
    });

    return { success: true, flags_updated: flags.length, content_mutation: actionResult };
  }

  /**
   * Get moderation stats (for admin dashboard)
   */
  static async getModerationStats(days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Total flags submitted
    const totalFlags = await this.flagRepo.count({
      where: { created_at: { $gte: startDate } as any },
    });

    // Pending flags (backlog)
    const pendingFlags = await this.flagRepo.count({
      where: { status: 'pending' },
    });

    // Auto-hidden content (needs urgent review)
    const autoHiddenFlags = await this.flagRepo.count({
      where: { status: 'pending', auto_hidden: true },
    });

    // Approved flags
    const approvedFlags = await this.flagRepo.count({
      where: {
        status: 'approved',
        reviewed_at: { $gte: startDate } as any,
      },
    });

    // Rejected flags
    const rejectedFlags = await this.flagRepo.count({
      where: {
        status: 'rejected',
        reviewed_at: { $gte: startDate } as any,
      },
    });

    // Average response time (time from flag creation to review)
    const reviewedFlags = await this.flagRepo.find({
      where: {
        status: In(['approved', 'rejected']),
        reviewed_at: { $gte: startDate } as any,
      },
      select: ['created_at', 'reviewed_at'],
    });

    let avgResponseTimeMinutes = 0;
    if (reviewedFlags.length > 0) {
      const totalResponseTime = reviewedFlags.reduce((sum, flag) => {
        const responseTime = flag.reviewed_at!.getTime() - flag.created_at.getTime();
        return sum + responseTime;
      }, 0);
      avgResponseTimeMinutes = totalResponseTime / reviewedFlags.length / 1000 / 60; // Convert to minutes
    }

    return {
      total_flags: totalFlags,
      pending_flags: pendingFlags,
      auto_hidden_flags: autoHiddenFlags,
      approved_flags: approvedFlags,
      rejected_flags: rejectedFlags,
      avg_response_time_minutes: Math.round(avgResponseTimeMinutes),
      avg_response_time_hours: Math.round(avgResponseTimeMinutes / 60 * 10) / 10, // 1 decimal place
    };
  }

  private static async executeContentAction(
    flagType: string,
    targetId: string,
    action: string,
    context: { actor: string; reason: string }
  ): Promise<ModerationActionAuditResult> {
    const normalizedFlagType = this.assertNonEmptyString(flagType, 'Moderation flag_type');
    const normalizedTargetId = this.assertNonEmptyString(targetId, 'Moderation target_id');
    const normalizedAction = this.assertApprovalAction(action, 'Moderation action');
    const normalizedContext = {
      actor: this.assertNonEmptyString(context.actor, 'Moderation action actor'),
      reason: this.assertNonEmptyString(context.reason, 'Moderation action reason'),
    };

    const adapter = this.contentAdapters.get(flagType);
    if (!adapter) {
      return this.normalizeActionAuditResult(
        { status: 'no_adapter_registered' },
        normalizedFlagType,
        normalizedTargetId,
        normalizedAction,
        normalizedContext,
        false
      );
    }

    let rawResult: Record<string, unknown> | null = null;
    if (normalizedAction === 'content_hidden' && adapter.hide) rawResult = await adapter.hide(normalizedTargetId, normalizedContext);
    if (normalizedAction === 'content_deleted' && adapter.delete) rawResult = await adapter.delete(normalizedTargetId, normalizedContext);
    if (normalizedAction === 'user_warned' && adapter.warnUser) rawResult = await adapter.warnUser(normalizedTargetId, normalizedContext);
    if (normalizedAction === 'user_suspended' && adapter.suspendUser) rawResult = await adapter.suspendUser(normalizedTargetId, normalizedContext);
    if (normalizedAction === 'user_banned' && adapter.banUser) rawResult = await adapter.banUser(normalizedTargetId, normalizedContext);

    if (!rawResult) {
      return this.normalizeActionAuditResult(
        { status: 'adapter_action_not_supported' },
        normalizedFlagType,
        normalizedTargetId,
        normalizedAction,
        normalizedContext,
        false
      );
    }

    return this.normalizeActionAuditResult(
      rawResult,
      normalizedFlagType,
      normalizedTargetId,
      normalizedAction,
      normalizedContext,
      true
    );
  }
}
