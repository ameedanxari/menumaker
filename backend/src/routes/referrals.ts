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

const LEGACY_REFERRAL_LIST_QUERY_FIELDS = new Set(['limit', 'offset', 'status']);
const LEGACY_REFERRAL_TRACK_CLICK_BODY_FIELDS = new Set(['referral_code', 'source', 'utm_source']);
const LEGACY_REFERRAL_VALIDATE_BODY_FIELDS = new Set(['referral_code']);
const MAX_LEGACY_REFERRAL_CODE_LENGTH = 128;
const MAX_LEGACY_REFERRAL_ATTRIBUTION_LENGTH = 100;
const MAX_LEGACY_REFERRAL_USER_ID_LENGTH = 255;
const LEGACY_REFERRAL_STATUSES = new Set([
  'link_clicked',
  'signup_completed',
  'first_menu_published',
  'expired',
]);
const UNSAFE_REFERRAL_ROUTE_TEXT_CONTROLS =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/u;

function normalizeReferralRequestBodyRecord(body: unknown): Record<string, unknown> | null {
  if (body === undefined || body === null) {
    return {};
  }

  if (typeof body !== 'object' || Array.isArray(body)) {
    return null;
  }

  return body as Record<string, unknown>;
}

function normalizeReferralQueryRecord(query: unknown): Record<string, unknown> | null {
  if (query === undefined || query === null) {
    return {};
  }

  if (typeof query !== 'object' || Array.isArray(query)) {
    return null;
  }

  return query as Record<string, unknown>;
}

function normalizeRequiredReferralString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  if (UNSAFE_REFERRAL_ROUTE_TEXT_CONTROLS.test(value)) {
    return value;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function hasUnsafeReferralRouteText(value: string): boolean {
  return UNSAFE_REFERRAL_ROUTE_TEXT_CONTROLS.test(value);
}

function hasOversizedLegacyReferralUserId(value: string): boolean {
  return value.length > MAX_LEGACY_REFERRAL_USER_ID_LENGTH;
}

function getAuthenticatedLegacyReferralUserId(user: unknown): string | null {
  if (!user || typeof user !== 'object') {
    return null;
  }

  const userRecord = user as { userId?: unknown; id?: unknown };
  return (
    normalizeRequiredReferralString(userRecord.userId) ??
    normalizeRequiredReferralString(userRecord.id)
  );
}

function invalidReferralRequestBodyResponse(reply: FastifyReply): unknown {
  return reply.status(400).send({ error: 'Referral request body must be an object' });
}

function normalizeOptionalReferralString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  return normalizeRequiredReferralString(value) ?? undefined;
}

function unsafeReferralRecordFieldNames(record: Record<string, unknown>): string[] {
  return Object.keys(record).filter((field) => hasUnsafeReferralRouteText(field));
}

function unsupportedReferralQueryFields(query: Record<string, unknown>): string[] {
  return Object.keys(query).filter((field) => !LEGACY_REFERRAL_LIST_QUERY_FIELDS.has(field));
}

function unsupportedReferralBodyFields(body: Record<string, unknown>, allowedFields: Set<string>): string[] {
  return Object.keys(body).filter((field) => !allowedFields.has(field)).sort();
}

function normalizeReferralListInteger(
  label: string,
  value: unknown,
  defaultValue: number
): { value: number } | { error: string } {
  if (value === undefined || value === null) {
    return { value: defaultValue };
  }

  const normalized = typeof value === 'string' && /^\d+$/.test(value.trim()) ? Number(value.trim()) : value;
  if (typeof normalized !== 'number' || !Number.isInteger(normalized) || normalized < 0) {
    return { error: `${label} must be a non-negative integer` };
  }

  if (!Number.isSafeInteger(normalized)) {
    return { error: `${label} must be a safe integer` };
  }

  return { value: normalized };
}

function normalizeOptionalReferralStatus(value: unknown): { value?: string } | { error: string } {
  if (value === undefined || value === null) {
    return {};
  }

  if (typeof value !== 'string' || !value.trim()) {
    return { error: 'Referral list status must be link_clicked, signup_completed, first_menu_published, or expired' };
  }

  if (hasUnsafeReferralRouteText(value)) {
    return { error: 'Referral list status contains unsafe control characters' };
  }

  const normalized = value.trim().toLowerCase();
  if (hasUnsafeReferralRouteText(normalized)) {
    return { error: 'Referral list status contains unsafe control characters' };
  }

  if (!LEGACY_REFERRAL_STATUSES.has(normalized)) {
    return { error: 'Referral list status must be link_clicked, signup_completed, first_menu_published, or expired' };
  }

  return { value: normalized };
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
        const userId = getAuthenticatedLegacyReferralUserId(request.user);

        if (!userId) {
          return reply.status(401).send({ error: 'Unauthorized' });
        }
        if (hasUnsafeReferralRouteText(userId)) {
          return reply.status(400).send({ error: 'Referral user id contains unsafe control characters' });
        }
        if (hasOversizedLegacyReferralUserId(userId)) {
          return reply.status(400).send({ error: 'Referral user id must be 255 characters or fewer' });
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
        if (hasUnsafeReferralRouteText(referralCode)) {
          return reply.status(500).send({ error: 'Referral code contains unsafe control characters' });
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
        const userId = getAuthenticatedLegacyReferralUserId(request.user);

        if (!userId) {
          return reply.status(401).send({ error: 'Unauthorized' });
        }
        if (hasUnsafeReferralRouteText(userId)) {
          return reply.status(400).send({ error: 'Referral user id contains unsafe control characters' });
        }
        if (hasOversizedLegacyReferralUserId(userId)) {
          return reply.status(400).send({ error: 'Referral user id must be 255 characters or fewer' });
        }

        const stats = await ReferralService.getStats(userId);

        return reply.send({
          success: true,
          data: {
            total_referrals: stats.total_referrals,
            total_clicks: stats.link_clicked,
            total_signups: stats.signup_completed,
            total_published: stats.first_menu_published,
            total_rewards_earned_cents: 0,
            rewards_enabled: false,
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
        const userId = getAuthenticatedLegacyReferralUserId(request.user);

        if (!userId) {
          return reply.status(401).send({ error: 'Unauthorized' });
        }
        if (hasUnsafeReferralRouteText(userId)) {
          return reply.status(400).send({ error: 'Referral user id contains unsafe control characters' });
        }
        if (hasOversizedLegacyReferralUserId(userId)) {
          return reply.status(400).send({ error: 'Referral user id must be 255 characters or fewer' });
        }

        const query = normalizeReferralQueryRecord(request.query);
        if (!query) {
          return reply.status(400).send({ error: 'Referral query must be an object' });
        }

        if (unsafeReferralRecordFieldNames(query).length > 0) {
          return reply.status(400).send({
            error: 'Referral query field names contain unsafe control characters',
          });
        }

        const unsupportedFields = unsupportedReferralQueryFields(query);
        if (unsupportedFields.length > 0) {
          return reply.status(400).send({
            error: `Unsupported referral query field(s): ${unsupportedFields.join(', ')}`,
          });
        }

        const limit = normalizeReferralListInteger('Referral list limit', query.limit, 20);
        if ('error' in limit) {
          return reply.status(400).send({ error: limit.error });
        }

        const offset = normalizeReferralListInteger('Referral list offset', query.offset, 0);
        if ('error' in offset) {
          return reply.status(400).send({ error: offset.error });
        }

        const status = normalizeOptionalReferralStatus(query.status);
        if ('error' in status) {
          return reply.status(400).send({ error: status.error });
        }

        const referrals = await ReferralService.getReferrals(userId, limit.value, offset.value, status.value);

        // Format response
        const data = referrals.map((ref) => ({
          id: ref.id,
          referee_name: ref.referee?.email?.split('@')[0] || 'Pending',
          referee_email: ref.referee_email,
          status: ref.status,
          reward_claimed: false,
          reward_type: null,
          reward_value_cents: 0,
          rewards_enabled: false,
          created_at: ref.created_at,
          signup_completed_at: ref.signup_completed_at,
          first_menu_published_at: ref.first_menu_published_at,
        }));

        return reply.send({
          success: true,
          data,
          meta: {
            total: referrals.length,
            limit: limit.value,
            offset: offset.value,
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
        const body = normalizeReferralRequestBodyRecord(request.body);
        if (body === null) {
          return invalidReferralRequestBodyResponse(reply);
        }

        if (unsafeReferralRecordFieldNames(body).length > 0) {
          return reply.status(400).send({
            error: 'Referral request field names contain unsafe control characters',
          });
        }

        const unsupportedFields = unsupportedReferralBodyFields(body, LEGACY_REFERRAL_TRACK_CLICK_BODY_FIELDS);
        if (unsupportedFields.length > 0) {
          return reply.status(400).send({
            error: `Unsupported referral request field(s): ${unsupportedFields.join(', ')}`,
          });
        }

        const referralCode = normalizeRequiredReferralString(body.referral_code);

        if (!referralCode) {
          return reply.status(400).send({ error: 'referral_code is required' });
        }
        if (hasUnsafeReferralRouteText(referralCode)) {
          return reply.status(400).send({ error: 'referral_code contains unsafe control characters' });
        }
        if (referralCode.length > MAX_LEGACY_REFERRAL_CODE_LENGTH) {
          return reply.status(400).send({ error: `referral_code must be at most ${MAX_LEGACY_REFERRAL_CODE_LENGTH} characters` });
        }
        const source = normalizeOptionalReferralString(body.source);
        if (source && hasUnsafeReferralRouteText(source)) {
          return reply.status(400).send({ error: 'source contains unsafe control characters' });
        }
        if (source && source.length > MAX_LEGACY_REFERRAL_ATTRIBUTION_LENGTH) {
          return reply.status(400).send({ error: `source must be at most ${MAX_LEGACY_REFERRAL_ATTRIBUTION_LENGTH} characters` });
        }
        const utmSource = normalizeOptionalReferralString(body.utm_source);
        if (utmSource && hasUnsafeReferralRouteText(utmSource)) {
          return reply.status(400).send({ error: 'utm_source contains unsafe control characters' });
        }
        if (utmSource && utmSource.length > MAX_LEGACY_REFERRAL_ATTRIBUTION_LENGTH) {
          return reply.status(400).send({ error: `utm_source must be at most ${MAX_LEGACY_REFERRAL_ATTRIBUTION_LENGTH} characters` });
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
          referral_code: referralCode,
          source,
          utm_source: utmSource,
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
        const body = normalizeReferralRequestBodyRecord(request.body);
        if (body === null) {
          return invalidReferralRequestBodyResponse(reply);
        }

        if (unsafeReferralRecordFieldNames(body).length > 0) {
          return reply.status(400).send({
            error: 'Referral request field names contain unsafe control characters',
          });
        }

        const unsupportedFields = unsupportedReferralBodyFields(body, LEGACY_REFERRAL_VALIDATE_BODY_FIELDS);
        if (unsupportedFields.length > 0) {
          return reply.status(400).send({
            error: `Unsupported referral request field(s): ${unsupportedFields.join(', ')}`,
          });
        }

        const referralCode = normalizeRequiredReferralString(body.referral_code);

        if (!referralCode) {
          return reply.status(400).send({ error: 'referral_code is required' });
        }
        if (hasUnsafeReferralRouteText(referralCode)) {
          return reply.status(400).send({ error: 'referral_code contains unsafe control characters' });
        }
        if (referralCode.length > MAX_LEGACY_REFERRAL_CODE_LENGTH) {
          return reply.status(400).send({ error: `referral_code must be at most ${MAX_LEGACY_REFERRAL_CODE_LENGTH} characters` });
        }

        const validation = await ReferralService.validateCode(referralCode);

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
