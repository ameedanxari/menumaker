import { AppDataSource } from '../data-source.js';
import { ContentFlag } from '../models/ContentFlag.js';
import { AuditLog } from '../models/AuditLog.js';
import { User } from '../models/User.js';

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

  // Auto-moderation thresholds
  private static readonly AUTO_HIDE_THRESHOLD = 3; // Hide content after 3 flags
  private static readonly AUTO_BAN_THRESHOLD = 5; // Ban user after 5 rejected flags

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

    // Check if user has already flagged this content
    const existingFlag = await this.flagRepo.findOne({
      where: {
        flag_type,
        target_id,
        reporter_id,
      },
    });

    if (existingFlag) {
      throw new Error('You have already flagged this content');
    }

    // Create flag
    const flag = this.flagRepo.create({
      flag_type,
      target_id,
      reason,
      description,
      reporter_id,
      status: 'pending',
      auto_hidden: false,
    });

    await this.flagRepo.save(flag);

    // Check if threshold reached for auto-hide
    const flagCount = await this.flagRepo.count({
      where: {
        flag_type,
        target_id,
        status: 'pending',
      },
    });

    if (flagCount >= this.AUTO_HIDE_THRESHOLD) {
      // Auto-hide content
      await this.flagRepo.update(
        { flag_type, target_id, status: 'pending' },
        { auto_hidden: true }
      );

      // TODO: Actually hide the content (depends on content type)
      // For example, if flag_type === 'review':
      //   await reviewRepo.update({ id: target_id }, { is_visible: false });
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

    const queryBuilder = this.flagRepo.createQueryBuilder('flag');

    // Filter by flag type
    if (flag_type) {
      queryBuilder.where('flag.flag_type = :flag_type', { flag_type });
    }

    // Filter by status
    if (status) {
      if (!flag_type) {
        queryBuilder.where('flag.status = :status', { status });
      } else {
        queryBuilder.andWhere('flag.status = :status', { status });
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
    const flags = await this.flagRepo.find({
      where: { flag_type, target_id },
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

    const flag = await this.flagRepo.findOne({
      where: { id: flag_id },
      relations: ['reporter'],
    });

    if (!flag) {
      throw new Error('Flag not found');
    }

    // Update flag
    flag.status = 'approved';
    flag.reviewed_by_id = admin_user_id;
    flag.reviewed_at = new Date();
    flag.action_taken = action_taken;
    flag.moderator_notes = moderator_notes;
    await this.flagRepo.save(flag);

    // TODO: Execute action based on action_taken
    // For example:
    // if (action_taken === 'content_deleted') {
    //   if (flag.flag_type === 'review') {
    //     await reviewRepo.delete({ id: flag.target_id });
    //   }
    // }

    // Create audit log
    await this.auditLogRepo.save({
      admin_user_id,
      action: 'approve_flag',
      target_type: 'flag',
      target_id: flag_id,
      details: {
        flag_type: flag.flag_type,
        target_id: flag.target_id,
        reason: flag.reason,
        action_taken,
        reporter_email: flag.reporter?.email,
      },
      ip_address,
    });

    return { success: true };
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

    const flag = await this.flagRepo.findOne({
      where: { id: flag_id },
      relations: ['reporter'],
    });

    if (!flag) {
      throw new Error('Flag not found');
    }

    // Update flag
    flag.status = 'rejected';
    flag.reviewed_by_id = admin_user_id;
    flag.reviewed_at = new Date();
    flag.action_taken = 'no_action';
    flag.moderator_notes = moderator_notes;
    await this.flagRepo.save(flag);

    // If marked as false flag, check if reporter should be warned/banned
    if (mark_as_false_flag) {
      const reporter = flag.reporter;
      if (reporter) {
        // Count how many false flags this user has submitted
        const falseFlags = await this.flagRepo.count({
          where: {
            reporter_id: reporter.id,
            status: 'rejected',
            // This is a simplification; in production, track false flags separately
          },
        });

        // TODO: Warn or ban reporter if too many false flags
        // if (falseFlags >= this.AUTO_BAN_THRESHOLD) {
        //   await AdminService.banUser({ user_id: reporter.id, reason: 'Too many false flags', ... });
        // }
      }
    }

    // Create audit log
    await this.auditLogRepo.save({
      admin_user_id,
      action: 'reject_flag',
      target_type: 'flag',
      target_id: flag_id,
      details: {
        flag_type: flag.flag_type,
        target_id: flag.target_id,
        reason: flag.reason,
        marked_as_false_flag: mark_as_false_flag,
        reporter_email: flag.reporter?.email,
      },
      ip_address,
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

    const flags = await this.flagRepo.find({
      where: { flag_type, target_id, status: 'pending' },
    });

    if (flags.length === 0) {
      throw new Error('No pending flags found for this content');
    }

    // Update all flags
    for (const flag of flags) {
      flag.status = decision === 'approve' ? 'approved' : 'rejected';
      flag.reviewed_by_id = admin_user_id;
      flag.reviewed_at = new Date();
      flag.action_taken = decision === 'approve' ? action_taken : 'no_action';
      flag.moderator_notes = moderator_notes;
      await this.flagRepo.save(flag);
    }

    // Create audit log
    await this.auditLogRepo.save({
      admin_user_id,
      action: decision === 'approve' ? 'bulk_approve_flags' : 'bulk_reject_flags',
      target_type: flag_type,
      target_id,
      details: {
        flag_count: flags.length,
        decision,
        action_taken,
      },
      ip_address,
    });

    return { success: true, flags_updated: flags.length };
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
}
