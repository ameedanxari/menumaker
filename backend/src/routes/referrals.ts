import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { ReferralService } from '../services/ReferralService.js';
import { AppDataSource } from '../config/database.js';
import { User } from '../models/User.js';

/**
 * Referral Routes (Phase 2.5)
 *
 * Endpoints for seller-to-seller referral system
 */

interface TrackClickRequest {
  referral_code: string;
  source?: string;
  utm_source?: string;
}

interface ValidateCodeRequest {
  referral_code: string;
}

export default async function referralRoutes(fastify: FastifyInstance) {
  const userRepo = AppDataSource.getRepository(User);

  /**
   * GET /users/me/referral-code
   * Get or generate seller's referral code
   */
  fastify.get(
    '/users/me/referral-code',
    {
      preHandler: [fastify.authenticate],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = request.user?.userId;

        if (!userId) {
          return reply.status(401).send({ error: 'Unauthorized' });
        }

        const user = await userRepo.findOne({ where: { id: userId } });

        if (!user) {
          return reply.status(404).send({ error: 'User not found' });
        }

        // Generate code if doesn't exist
        let referralCode = user.referral_code;
        if (!referralCode) {
          referralCode = await ReferralService.generateReferralCode(user);
        }

        // Generate shareable link
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        const referralLink = `${frontendUrl}/signup?ref=${referralCode}`;

        // Pre-filled share message
        const shareMessage = `Hey! I've been using MenuMaker to manage my food business orders. It's super easy - I published my menu in 10 minutes!

You should try it too. Use my code ${referralCode} to sign up:
${referralLink}

Let me know what you think! 😊`;

        return reply.send({
          success: true,
          data: {
            referral_code: referralCode,
            referral_link: referralLink,
            share_message: shareMessage,
          },
        });
      } catch (error: any) {
        console.error('Error fetching referral code:', error);
        return reply.status(500).send({ error: 'Internal server error' });
      }
    }
  );

  /**
   * GET /users/me/referrals/stats
   * Get referral statistics for authenticated user
   */
  fastify.get(
    '/users/me/referrals/stats',
    {
      preHandler: [fastify.authenticate],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = request.user?.userId;

        if (!userId) {
          return reply.status(401).send({ error: 'Unauthorized' });
        }

        const stats = await ReferralService.getStats(userId);

        return reply.send({
          success: true,
          data: {
            total_referrals: stats.total_referrals,
            total_clicks: stats.link_clicked,
            total_signups: stats.signup_completed,
            total_published: stats.first_menu_published,
            total_rewards_earned_cents: stats.total_rewards_earned_cents,
            funnel: {
              link_clicked: stats.link_clicked,
              signup_completed: stats.signup_completed,
              first_menu_published: stats.first_menu_published,
            },
            conversion_rate: stats.conversion_rate,
          },
        });
      } catch (error: any) {
        console.error('Error fetching referral stats:', error);
        return reply.status(500).send({ error: 'Internal server error' });
      }
    }
  );

  /**
   * GET /users/me/referrals
   * List all referrals made by authenticated user
   */
  fastify.get<{
    Querystring: { limit?: string; offset?: string; status?: string };
  }>(
    '/users/me/referrals',
    {
      preHandler: [fastify.authenticate],
    },
    async (request: FastifyRequest<{ Querystring: { limit?: string; offset?: string; status?: string } }>, reply: FastifyReply) => {
      try {
        const userId = request.user?.userId;

        if (!userId) {
          return reply.status(401).send({ error: 'Unauthorized' });
        }

        const limit = parseInt(request.query.limit || '20', 10);
        const offset = parseInt(request.query.offset || '0', 10);

        const referrals = await ReferralService.getReferrals(userId, limit, offset);

        // Format response
        const data = referrals.map((ref) => ({
          id: ref.id,
          referee_name: ref.referee?.email?.split('@')[0] || 'Pending',
          referee_email: ref.referee_email,
          status: ref.status,
          reward_claimed: ref.reward_claimed,
          reward_type: ref.reward_type,
          reward_value_cents: ref.reward_value_cents,
          created_at: ref.created_at,
          signup_completed_at: ref.signup_completed_at,
          first_menu_published_at: ref.first_menu_published_at,
        }));

        return reply.send({
          success: true,
          data,
          meta: {
            total: referrals.length,
            limit,
            offset,
          },
        });
      } catch (error: any) {
        console.error('Error listing referrals:', error);
        return reply.status(500).send({ error: 'Internal server error' });
      }
    }
  );

  /**
   * POST /referrals/track-click
   * Track referral link click (cookie-based, no auth required)
   */
  fastify.post<{ Body: TrackClickRequest }>(
    '/track-click',
    async (request: FastifyRequest<{ Body: TrackClickRequest }>, reply: FastifyReply) => {
      try {
        const { referral_code, source, utm_source } = request.body;

        if (!referral_code) {
          return reply.status(400).send({ error: 'referral_code is required' });
        }

        // Extract IP and user agent for fraud prevention
        const click_ip = request.ip;
        const userAgent = request.headers['user-agent'] || '';

        // Simple device fingerprint (hash of user agent + IP)
        const crypto = await import('crypto');
        const device_fingerprint = crypto
          .createHash('sha256')
          .update(`${userAgent}${click_ip}`)
          .digest('hex')
          .substring(0, 32);

        const result = await ReferralService.trackClick({
          referral_code,
          source,
          utm_source,
          click_ip,
          device_fingerprint,
        });

        if (!result.success) {
          return reply.status(400).send({
            success: false,
            error: result.message || 'Failed to track click',
          });
        }

        return reply.send({
          success: true,
          message: 'Referral click tracked',
        });
      } catch (error: any) {
        console.error('Error tracking referral click:', error);
        return reply.status(500).send({ error: 'Internal server error' });
      }
    }
  );

  /**
   * POST /referrals/validate
   * Validate referral code (check if it exists)
   */
  fastify.post<{ Body: ValidateCodeRequest }>(
    '/validate',
    async (request: FastifyRequest<{ Body: ValidateCodeRequest }>, reply: FastifyReply) => {
      try {
        const { referral_code } = request.body;

        if (!referral_code) {
          return reply.status(400).send({ error: 'referral_code is required' });
        }

        const validation = await ReferralService.validateCode(referral_code);

        if (!validation.valid) {
          return reply.status(404).send({
            success: false,
            error: 'Invalid referral code',
          });
        }

        return reply.send({
          success: true,
          data: {
            valid: true,
            referrer_email: validation.referrer_email,
          },
        });
      } catch (error: any) {
        console.error('Error validating referral code:', error);
        return reply.status(500).send({ error: 'Internal server error' });
      }
    }
  );
}
