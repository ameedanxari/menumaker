import { FastifyPluginAsync } from 'fastify';
import { LeaderboardService, AffiliateService, ViralService } from '../services/EnhancedReferralService.js';
import { authenticate } from '../middleware/auth.js';

const leaderboardService = new LeaderboardService();
const affiliateService = new AffiliateService();
const viralService = new ViralService();

export const enhancedReferralRoutes: FastifyPluginAsync = async (fastify) => {
  // ========== Customer Referrals ==========

  /**
   * Create customer referral code
   * POST /customers/referrals/create
   */
  fastify.post(
    '/customers/referrals/create',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Create customer referral code',
        tags: ['referrals'],
        body: {
          type: 'object',
          required: ['business_id'],
          properties: {
            business_id: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
    async (request, reply) => {
      const { business_id } = request.body as { business_id: string };
      const userId = (request.user as any).id;

      try {
        const referral = await viralService.createCustomerReferral(userId, business_id);

        return {
          success: true,
          data: {
            referral: {
              id: referral.id,
              referral_code: referral.referral_code,
              business_id: referral.business_id,
              share_url: `https://menumaker.app?ref=${referral.referral_code}`,
            },
          },
          message: 'Customer referral code created successfully',
        };
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({
          success: false,
          error: {
            code: 'REFERRAL_CREATION_ERROR',
            message: error instanceof Error ? error.message : 'Failed to create referral',
          },
        });
      }
    }
  );

  /**
   * Get customer referral stats
   * GET /customers/referrals/stats
   */
  fastify.get(
    '/customers/referrals/stats',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get customer referral statistics',
        tags: ['referrals'],
      },
    },
    async (request, reply) => {
      const userId = (request.user as any).id;

      try {
        const stats = await viralService.getCustomerReferralStats(userId);

        return {
          success: true,
          data: { stats },
        };
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({
          success: false,
          error: {
            code: 'STATS_ERROR',
            message: 'Failed to get referral stats',
          },
        });
      }
    }
  );

  // ========== Leaderboard ==========

  /**
   * Get referral leaderboard (public)
   * GET /referrals/leaderboard
   */
  fastify.get(
    '/referrals/leaderboard',
    {
      schema: {
        description: 'Get top referrers leaderboard',
        tags: ['leaderboard'],
        querystring: {
          type: 'object',
          properties: {
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 10 },
          },
        },
      },
    },
    async (request, reply) => {
      const { limit = 10 } = request.query as { limit?: number };

      try {
        const leaderboard = await leaderboardService.getTopReferrers(limit);

        return {
          success: true,
          data: {
            leaderboard: leaderboard.map((entry) => ({
              rank: entry.rank,
              user: {
                id: entry.user_id,
                name: entry.user?.full_name,
                avatar: entry.user?.profile_photo_url,
              },
              successful_referrals: entry.successful_referrals,
              prize_amount: entry.prize_amount_cents ? entry.prize_amount_cents / 100 : null,
            })),
          },
        };
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({
          success: false,
          error: {
            code: 'LEADERBOARD_ERROR',
            message: 'Failed to get leaderboard',
          },
        });
      }
    }
  );

  /**
   * Get my leaderboard position
   * GET /referrals/leaderboard/me
   */
  fastify.get(
    '/referrals/leaderboard/me',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get my leaderboard position',
        tags: ['leaderboard'],
      },
    },
    async (request, reply) => {
      const userId = (request.user as any).id;

      try {
        const position = await leaderboardService.getUserPosition(userId);

        return {
          success: true,
          data: { position },
        };
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({
          success: false,
          error: {
            code: 'POSITION_ERROR',
            message: 'Failed to get leaderboard position',
          },
        });
      }
    }
  );

  // ========== Affiliate Program ==========

  /**
   * Apply for affiliate program
   * POST /affiliates/apply
   */
  fastify.post(
    '/affiliates/apply',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Apply for affiliate program',
        tags: ['affiliates'],
        body: {
          type: 'object',
          required: ['application_message'],
          properties: {
            application_message: { type: 'string', minLength: 50, maxLength: 1000 },
            instagram_handle: { type: 'string', maxLength: 255 },
            instagram_followers: { type: 'integer', minimum: 0 },
            youtube_channel: { type: 'string', maxLength: 255 },
            youtube_subscribers: { type: 'integer', minimum: 0 },
          },
        },
      },
    },
    async (request, reply) => {
      const userId = (request.user as any).id;
      const data = request.body as any;

      try {
        const affiliate = await affiliateService.applyForAffiliate(userId, data);

        return {
          success: true,
          data: {
            affiliate: {
              id: affiliate.id,
              affiliate_code: affiliate.affiliate_code,
              status: affiliate.status,
              created_at: affiliate.created_at,
            },
          },
          message: 'Affiliate application submitted successfully',
        };
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({
          success: false,
          error: {
            code: 'APPLICATION_ERROR',
            message: error instanceof Error ? error.message : 'Failed to submit application',
          },
        });
      }
    }
  );

  /**
   * Get affiliate dashboard
   * GET /affiliates/dashboard
   */
  fastify.get(
    '/affiliates/dashboard',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get affiliate dashboard data',
        tags: ['affiliates'],
      },
    },
    async (request, reply) => {
      const userId = (request.user as any).id;

      try {
        const dashboard = await affiliateService.getAffiliateDashboard(userId);

        return {
          success: true,
          data: {
            affiliate: {
              id: dashboard.affiliate.id,
              affiliate_code: dashboard.affiliate.affiliate_code,
              status: dashboard.affiliate.status,
              affiliate_type: dashboard.affiliate.affiliate_type,
              qr_code_data: dashboard.affiliate.qr_code_data,
              social_media_templates: dashboard.affiliate.social_media_templates,
            },
            stats: dashboard.stats,
            recent_clicks: dashboard.recent_clicks.map((click) => ({
              id: click.id,
              ip_address: click.ip_address,
              utm_source: click.utm_source,
              converted: click.converted,
              created_at: click.created_at,
            })),
            recent_payouts: dashboard.recent_payouts.map((payout) => ({
              id: payout.id,
              payout_month: payout.payout_month,
              payout_amount: payout.payout_amount_cents / 100,
              status: payout.status,
              paid_at: payout.paid_at,
            })),
          },
        };
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({
          success: false,
          error: {
            code: 'DASHBOARD_ERROR',
            message: error instanceof Error ? error.message : 'Failed to get dashboard',
          },
        });
      }
    }
  );

  /**
   * Track affiliate click
   * POST /affiliates/track/:affiliateCode
   */
  fastify.post(
    '/affiliates/track/:affiliateCode',
    {
      schema: {
        description: 'Track affiliate link click',
        tags: ['affiliates'],
        params: {
          type: 'object',
          required: ['affiliateCode'],
          properties: {
            affiliateCode: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { affiliateCode } = request.params as { affiliateCode: string };

      try {
        const click = await affiliateService.trackClick(affiliateCode, {
          ip_address: request.ip,
          user_agent: request.headers['user-agent'],
          referrer_url: request.headers.referer,
        });

        return {
          success: true,
          data: {
            click: {
              id: click.id,
              created_at: click.created_at,
            },
          },
        };
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({
          success: false,
          error: {
            code: 'TRACK_ERROR',
            message: 'Failed to track click',
          },
        });
      }
    }
  );

  // ========== Social Sharing ==========

  /**
   * Generate Instagram story share
   * POST /referrals/share/instagram
   */
  fastify.post(
    '/referrals/share/instagram',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Generate Instagram story share template',
        tags: ['social'],
        body: {
          type: 'object',
          required: ['referral_code', 'business_name'],
          properties: {
            referral_code: { type: 'string' },
            business_name: { type: 'string' },
            menu_preview_url: { type: 'string', format: 'uri' },
          },
        },
      },
    },
    async (request, reply) => {
      const { referral_code, business_name, menu_preview_url } = request.body as {
        referral_code: string;
        business_name: string;
        menu_preview_url?: string;
      };

      try {
        const shareData = viralService.generateInstagramStoryShare(
          referral_code,
          business_name,
          menu_preview_url
        );

        return {
          success: true,
          data: { share_data: shareData },
          message: 'Instagram story share generated',
        };
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({
          success: false,
          error: {
            code: 'SHARE_ERROR',
            message: 'Failed to generate Instagram share',
          },
        });
      }
    }
  );

  /**
   * Generate WhatsApp share
   * POST /referrals/share/whatsapp
   */
  fastify.post(
    '/referrals/share/whatsapp',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Generate WhatsApp share message',
        tags: ['social'],
        body: {
          type: 'object',
          required: ['referral_code', 'business_name'],
          properties: {
            referral_code: { type: 'string' },
            business_name: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { referral_code, business_name } = request.body as {
        referral_code: string;
        business_name: string;
      };

      try {
        const shareData = viralService.generateWhatsAppShare(referral_code, business_name);

        return {
          success: true,
          data: { share_data: shareData },
          message: 'WhatsApp share message generated',
        };
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({
          success: false,
          error: {
            code: 'SHARE_ERROR',
            message: 'Failed to generate WhatsApp share',
          },
        });
      }
    }
  );

  // ========== Viral Badges ==========

  /**
   * Get my viral badges
   * GET /badges/me
   */
  fastify.get(
    '/badges/me',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get my viral badges',
        tags: ['badges'],
      },
    },
    async (request, reply) => {
      const userId = (request.user as any).id;

      try {
        const badges = await viralService.getUserBadges(userId);

        return {
          success: true,
          data: {
            badges: badges.map((badge) => ({
              id: badge.id,
              badge_type: badge.badge_type,
              tier: badge.tier,
              display_name: badge.display_name,
              description: badge.description,
              icon_url: badge.icon_url,
              referrals_required: badge.referrals_required,
              referrals_achieved: badge.referrals_achieved,
              benefits: badge.benefits,
              awarded_at: badge.awarded_at,
            })),
          },
        };
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({
          success: false,
          error: {
            code: 'BADGES_ERROR',
            message: 'Failed to get badges',
          },
        });
      }
    }
  );

  /**
   * Check and award new badges
   * POST /badges/check
   */
  fastify.post(
    '/badges/check',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Check and award new viral badges',
        tags: ['badges'],
      },
    },
    async (request, reply) => {
      const userId = (request.user as any).id;

      try {
        const newBadges = await viralService.checkAndAwardBadges(userId);

        return {
          success: true,
          data: {
            new_badges: newBadges.map((badge) => ({
              badge_type: badge.badge_type,
              display_name: badge.display_name,
              tier: badge.tier,
              benefits: badge.benefits,
            })),
          },
          message: newBadges.length > 0 ? `Congratulations! You earned ${newBadges.length} new badge(s)!` : 'No new badges yet',
        };
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({
          success: false,
          error: {
            code: 'BADGE_CHECK_ERROR',
            message: 'Failed to check badges',
          },
        });
      }
    }
  );
};
