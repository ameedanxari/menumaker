import { FastifyInstance } from 'fastify';
import { authenticateAdmin, requireSuperAdmin, requireModerator, requireSupportAgent } from '../middleware/adminAuth.js';
import { AdminService } from '../services/AdminService.js';
import { ModerationService } from '../services/ModerationService.js';
import { AnalyticsService } from '../services/AnalyticsService.js';
import { SupportTicketService } from '../services/SupportTicketService.js';
import { FeatureFlagService } from '../services/FeatureFlagService.js';

/**
 * Admin API Routes
 * Phase 3: Admin Backend Platform (US3.10)
 *
 * All routes require admin authentication
 * Role-based access control (RBAC):
 * - super_admin: Full access
 * - moderator: Content moderation, analytics (read-only user mgmt)
 * - support_agent: Support tickets, analytics (read-only user mgmt)
 */

export default async function adminRoutes(fastify: FastifyInstance) {
  // Apply admin authentication to all routes
  fastify.addHook('preHandler', authenticateAdmin);

  // ============================================================================
  // USER MANAGEMENT (Super Admin only)
  // ============================================================================

  /**
   * List all users (with filtering and pagination)
   */
  fastify.get<{
    Querystring: {
      page?: number;
      limit?: number;
      search?: string;
      subscription_tier?: string;
      status?: string;
      signup_date_from?: string;
      signup_date_to?: string;
    };
  }>(
    '/users',
    { preHandler: [requireSupportAgent] }, // Support agents can view users
    async (request, reply) => {
      const { page, limit, search, subscription_tier, status, signup_date_from, signup_date_to } = request.query;

      const result = await AdminService.listUsers({
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
        search,
        subscription_tier,
        status,
        signup_date_from: signup_date_from ? new Date(signup_date_from) : undefined,
        signup_date_to: signup_date_to ? new Date(signup_date_to) : undefined,
      });

      return reply.send(result);
    }
  );

  /**
   * Get user details
   */
  fastify.get<{ Params: { id: string } }>(
    '/users/:id',
    { preHandler: [requireSupportAgent] },
    async (request, reply) => {
      const result = await AdminService.getUserDetails(request.params.id);
      return reply.send(result);
    }
  );

  /**
   * Suspend user
   */
  fastify.post<{
    Params: { id: string };
    Body: { reason: string; duration_days: number };
  }>(
    '/users/:id/suspend',
    { preHandler: [requireSuperAdmin] }, // Only super admin can suspend
    async (request, reply) => {
      const adminUser = (request as any).adminUser;
      const { reason, duration_days } = request.body;

      const result = await AdminService.suspendUser({
        user_id: request.params.id,
        admin_user_id: adminUser.id,
        reason,
        duration_days,
        ip_address: request.ip,
      });

      return reply.send(result);
    }
  );

  /**
   * Unsuspend user
   */
  fastify.post<{ Params: { id: string } }>(
    '/users/:id/unsuspend',
    { preHandler: [requireSuperAdmin] },
    async (request, reply) => {
      const adminUser = (request as any).adminUser;

      const result = await AdminService.unsuspendUser({
        user_id: request.params.id,
        admin_user_id: adminUser.id,
        ip_address: request.ip,
      });

      return reply.send(result);
    }
  );

  /**
   * Ban user (permanent)
   */
  fastify.post<{
    Params: { id: string };
    Body: { reason: string };
  }>(
    '/users/:id/ban',
    { preHandler: [requireSuperAdmin] },
    async (request, reply) => {
      const adminUser = (request as any).adminUser;
      const { reason } = request.body;

      const result = await AdminService.banUser({
        user_id: request.params.id,
        admin_user_id: adminUser.id,
        reason,
        ip_address: request.ip,
      });

      return reply.send(result);
    }
  );

  /**
   * Reset user password
   */
  fastify.post<{
    Params: { id: string };
    Body: { new_password: string };
  }>(
    '/users/:id/reset-password',
    { preHandler: [requireSuperAdmin] },
    async (request, reply) => {
      const adminUser = (request as any).adminUser;
      const { new_password } = request.body;

      const result = await AdminService.resetUserPassword({
        user_id: request.params.id,
        admin_user_id: adminUser.id,
        new_password,
        ip_address: request.ip,
      });

      return reply.send(result);
    }
  );

  /**
   * Get user activity log
   */
  fastify.get<{
    Params: { id: string };
    Querystring: { limit?: number };
  }>(
    '/users/:id/activity',
    { preHandler: [requireSupportAgent] },
    async (request, reply) => {
      const { limit } = request.query;
      const result = await AdminService.getUserActivityLog(request.params.id, limit ? Number(limit) : undefined);
      return reply.send(result);
    }
  );

  // ============================================================================
  // CONTENT MODERATION (Moderators and Super Admin)
  // ============================================================================

  /**
   * Get moderation queue (all pending flags)
   */
  fastify.get<{
    Querystring: {
      page?: number;
      limit?: number;
      flag_type?: string;
      status?: string;
      auto_hidden_only?: boolean;
    };
  }>(
    '/moderation/queue',
    { preHandler: [requireModerator] },
    async (request, reply) => {
      const { page, limit, flag_type, status, auto_hidden_only } = request.query;

      const result = await ModerationService.getModerationQueue({
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
        flag_type,
        status,
        auto_hidden_only,
      });

      return reply.send(result);
    }
  );

  /**
   * Get flags for specific content
   */
  fastify.get<{
    Querystring: { flag_type: string; target_id: string };
  }>(
    '/moderation/flags',
    { preHandler: [requireModerator] },
    async (request, reply) => {
      const { flag_type, target_id } = request.query;
      const result = await ModerationService.getFlagsForContent(flag_type, target_id);
      return reply.send(result);
    }
  );

  /**
   * Approve flag (take action on content)
   */
  fastify.post<{
    Params: { id: string };
    Body: {
      action_taken: 'content_hidden' | 'content_deleted' | 'user_warned' | 'user_suspended' | 'user_banned';
      moderator_notes?: string;
    };
  }>(
    '/moderation/flags/:id/approve',
    { preHandler: [requireModerator] },
    async (request, reply) => {
      const adminUser = (request as any).adminUser;
      const { action_taken, moderator_notes } = request.body;

      const result = await ModerationService.approveFlag({
        flag_id: request.params.id,
        admin_user_id: adminUser.id,
        action_taken,
        moderator_notes,
        ip_address: request.ip,
      });

      return reply.send(result);
    }
  );

  /**
   * Reject flag (no action needed)
   */
  fastify.post<{
    Params: { id: string };
    Body: { moderator_notes?: string; mark_as_false_flag?: boolean };
  }>(
    '/moderation/flags/:id/reject',
    { preHandler: [requireModerator] },
    async (request, reply) => {
      const adminUser = (request as any).adminUser;
      const { moderator_notes, mark_as_false_flag } = request.body;

      const result = await ModerationService.rejectFlag({
        flag_id: request.params.id,
        admin_user_id: adminUser.id,
        moderator_notes,
        mark_as_false_flag,
        ip_address: request.ip,
      });

      return reply.send(result);
    }
  );

  /**
   * Get moderation stats
   */
  fastify.get<{
    Querystring: { days?: number };
  }>(
    '/moderation/stats',
    { preHandler: [requireModerator] },
    async (request, reply) => {
      const { days } = request.query;
      const result = await ModerationService.getModerationStats(days ? Number(days) : undefined);
      return reply.send(result);
    }
  );

  // ============================================================================
  // ANALYTICS (All Admin Roles)
  // ============================================================================

  /**
   * Get dashboard metrics (real-time)
   */
  fastify.get('/analytics/dashboard', { preHandler: [requireSupportAgent] }, async (request, reply) => {
    const result = await AnalyticsService.getDashboardMetrics();
    return reply.send(result);
  });

  /**
   * Get trends (7-day, 30-day, 90-day)
   */
  fastify.get<{
    Querystring: { days?: number };
  }>(
    '/analytics/trends',
    { preHandler: [requireSupportAgent] },
    async (request, reply) => {
      const { days } = request.query;
      const result = await AnalyticsService.getTrends(days ? Number(days) : undefined);
      return reply.send(result);
    }
  );

  /**
   * Get seller statistics
   */
  fastify.get('/analytics/sellers', { preHandler: [requireSupportAgent] }, async (request, reply) => {
    const result = await AnalyticsService.getSellerStats();
    return reply.send(result);
  });

  /**
   * Get order analytics
   */
  fastify.get<{
    Querystring: { days?: number };
  }>(
    '/analytics/orders',
    { preHandler: [requireSupportAgent] },
    async (request, reply) => {
      const { days } = request.query;
      const result = await AnalyticsService.getOrderAnalytics(days ? Number(days) : undefined);
      return reply.send(result);
    }
  );

  /**
   * Get top sellers
   */
  fastify.get<{
    Querystring: { limit?: number; sort_by?: 'gmv' | 'orders' | 'reviews' };
  }>(
    '/analytics/top-sellers',
    { preHandler: [requireSupportAgent] },
    async (request, reply) => {
      const { limit, sort_by } = request.query;
      const result = await AnalyticsService.getTopSellers({
        limit: limit ? Number(limit) : undefined,
        sort_by,
      });
      return reply.send(result);
    }
  );

  /**
   * Export analytics as CSV
   */
  fastify.get<{
    Querystring: {
      type: 'sellers' | 'orders' | 'revenue';
      start_date: string;
      end_date: string;
    };
  }>(
    '/analytics/export',
    { preHandler: [requireSuperAdmin] },
    async (request, reply) => {
      const { type, start_date, end_date } = request.query;

      const csv = await AnalyticsService.exportAnalyticsCSV({
        type,
        start_date: new Date(start_date),
        end_date: new Date(end_date),
      });

      reply.header('Content-Type', 'text/csv');
      reply.header('Content-Disposition', `attachment; filename="${type}-${start_date}-${end_date}.csv"`);
      return reply.send(csv);
    }
  );

  // ============================================================================
  // SUPPORT TICKETS (Support Agents and above)
  // ============================================================================

  /**
   * List all support tickets
   */
  fastify.get<{
    Querystring: {
      page?: number;
      limit?: number;
      status?: string;
      priority?: string;
      assigned_to_id?: string;
      search?: string;
    };
  }>(
    '/tickets',
    { preHandler: [requireSupportAgent] },
    async (request, reply) => {
      const { page, limit, status, priority, assigned_to_id, search } = request.query;

      const result = await SupportTicketService.listTickets({
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
        status,
        priority,
        assigned_to_id,
        search,
      });

      return reply.send(result);
    }
  );

  /**
   * Get ticket details
   */
  fastify.get<{ Params: { id: string } }>(
    '/tickets/:id',
    { preHandler: [requireSupportAgent] },
    async (request, reply) => {
      const result = await SupportTicketService.getTicketDetails(request.params.id);
      return reply.send(result);
    }
  );

  /**
   * Reply to ticket
   */
  fastify.post<{
    Params: { id: string };
    Body: { message: string; internal_note?: boolean };
  }>(
    '/tickets/:id/reply',
    { preHandler: [requireSupportAgent] },
    async (request, reply) => {
      const adminUser = (request as any).adminUser;
      const { message, internal_note } = request.body;

      const result = await SupportTicketService.replyToTicket({
        ticket_id: request.params.id,
        admin_user_id: adminUser.id,
        message,
        internal_note,
        ip_address: request.ip,
      });

      return reply.send(result);
    }
  );

  /**
   * Assign ticket
   */
  fastify.patch<{
    Params: { id: string };
    Body: { assigned_to_id: string };
  }>(
    '/tickets/:id/assign',
    { preHandler: [requireSupportAgent] },
    async (request, reply) => {
      const adminUser = (request as any).adminUser;
      const { assigned_to_id } = request.body;

      const result = await SupportTicketService.assignTicket({
        ticket_id: request.params.id,
        assigned_to_id,
        assigned_by_admin_id: adminUser.id,
        ip_address: request.ip,
      });

      return reply.send(result);
    }
  );

  /**
   * Close ticket
   */
  fastify.post<{ Params: { id: string } }>(
    '/tickets/:id/close',
    { preHandler: [requireSupportAgent] },
    async (request, reply) => {
      const adminUser = (request as any).adminUser;

      const result = await SupportTicketService.closeTicket({
        ticket_id: request.params.id,
        admin_user_id: adminUser.id,
        ip_address: request.ip,
      });

      return reply.send(result);
    }
  );

  /**
   * Get support metrics
   */
  fastify.get<{
    Querystring: { days?: number };
  }>(
    '/tickets/stats',
    { preHandler: [requireSupportAgent] },
    async (request, reply) => {
      const { days } = request.query;
      const result = await SupportTicketService.getSupportMetrics(days ? Number(days) : undefined);
      return reply.send(result);
    }
  );

  // ============================================================================
  // FEATURE FLAGS (Super Admin only)
  // ============================================================================

  /**
   * List all feature flags
   */
  fastify.get<{
    Querystring: { status?: string };
  }>(
    '/feature-flags',
    { preHandler: [requireSuperAdmin] },
    async (request, reply) => {
      const { status } = request.query;
      const result = await FeatureFlagService.listFeatureFlags({ status });
      return reply.send(result);
    }
  );

  /**
   * Get feature flag details
   */
  fastify.get<{ Params: { key: string } }>(
    '/feature-flags/:key',
    { preHandler: [requireSuperAdmin] },
    async (request, reply) => {
      const result = await FeatureFlagService.getFeatureFlagDetails(request.params.key);
      return reply.send(result);
    }
  );

  /**
   * Update feature flag
   */
  fastify.patch<{
    Params: { key: string };
    Body: {
      is_enabled?: boolean;
      rollout_percentage?: number;
      tier_overrides?: Record<string, boolean>;
      whitelisted_user_ids?: string[];
      status?: string;
    };
  }>(
    '/feature-flags/:key',
    { preHandler: [requireSuperAdmin] },
    async (request, reply) => {
      const adminUser = (request as any).adminUser;
      const { is_enabled, rollout_percentage, tier_overrides, whitelisted_user_ids, status } = request.body;

      const result = await FeatureFlagService.updateFeatureFlag({
        flag_key: request.params.key,
        is_enabled,
        rollout_percentage,
        tier_overrides,
        whitelisted_user_ids,
        status,
        admin_user_id: adminUser.id,
        ip_address: request.ip,
      });

      return reply.send(result);
    }
  );

  /**
   * Emergency disable feature
   */
  fastify.post<{
    Params: { key: string };
    Body: { reason: string };
  }>(
    '/feature-flags/:key/emergency-disable',
    { preHandler: [requireSuperAdmin] },
    async (request, reply) => {
      const adminUser = (request as any).adminUser;
      const { reason } = request.body;

      const result = await FeatureFlagService.emergencyDisableFeature({
        flag_key: request.params.key,
        admin_user_id: adminUser.id,
        reason,
        ip_address: request.ip,
      });

      return reply.send(result);
    }
  );

  /**
   * Get feature flag stats
   */
  fastify.get<{ Params: { key: string } }>(
    '/feature-flags/:key/stats',
    { preHandler: [requireSuperAdmin] },
    async (request, reply) => {
      const result = await FeatureFlagService.getFeatureFlagStats(request.params.key);
      return reply.send(result);
    }
  );
}
