import { FastifyPluginAsync } from 'fastify';
import { isIP } from 'net';
import { LeaderboardService, AffiliateService, ViralService } from '../services/EnhancedReferralService.js';
import { authenticate } from '../middleware/auth.js';
import { requireCapability } from '../config/capabilities.js';

const CUSTOMER_REFERRAL_CREATE_BODY_FIELDS = new Set(['business_id']);
const LEADERBOARD_QUERY_FIELDS = new Set(['limit']);
const AUTHENTICATED_REFERRAL_READ_QUERY_FIELDS = new Set<string>();
const BADGE_CHECK_BODY_FIELDS = new Set<string>();
const AFFILIATE_TRACKING_BODY_FIELDS = new Set(['utm_source', 'utm_medium', 'utm_campaign']);
const AFFILIATE_TRACKING_QUERY_FIELDS = new Set<string>();
const DEFAULT_LEADERBOARD_LIMIT = 10;
const MAX_LEADERBOARD_LIMIT = 100;
const MIN_AFFILIATE_APPLICATION_MESSAGE_LENGTH = 50;
const MAX_AFFILIATE_APPLICATION_MESSAGE_LENGTH = 1000;
const MAX_AFFILIATE_SOCIAL_PROFILE_LENGTH = 255;
const MAX_AFFILIATE_TRACKING_USER_AGENT_LENGTH = 1024;
const MAX_AFFILIATE_TRACKING_REFERRER_URL_LENGTH = 255;
const MAX_AFFILIATE_TRACKING_UTM_LENGTH = 100;
const MAX_AFFILIATE_TRACKING_CODE_LENGTH = 128;
const MAX_REFERRAL_BUSINESS_ID_LENGTH = 255;
const MAX_REFERRAL_USER_ID_LENGTH = 255;
const MAX_REFERRAL_SHARE_CODE_LENGTH = 128;
const MAX_REFERRAL_SHARE_BUSINESS_NAME_LENGTH = 160;
const MAX_REFERRAL_SHARE_MENU_PREVIEW_URL_LENGTH = 2048;
const UNSAFE_REFERRAL_ROUTE_TEXT_CONTROLS =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/u;

function hasUnsafeReferralRouteTextControls(value: string): boolean {
  return UNSAFE_REFERRAL_ROUTE_TEXT_CONTROLS.test(value);
}

const AFFILIATE_APPLICATION_BODY_FIELDS = new Set([
  'application_message',
  'instagram_handle',
  'instagram_followers',
  'youtube_channel',
  'youtube_subscribers',
]);

const INSTAGRAM_SHARE_BODY_FIELDS = new Set(['referral_code', 'business_name', 'menu_preview_url']);
const WHATSAPP_SHARE_BODY_FIELDS = new Set(['referral_code', 'business_name']);

function unsupportedRequestFields(body: unknown, allowedFields: Set<string>): string[] {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return [];
  }

  return Object.keys(body as Record<string, unknown>)
    .filter((field) => !allowedFields.has(field))
    .sort();
}

function normalizeReferralBodyRecord(body: unknown): Record<string, unknown> | null {
  if (body === undefined || body === null) {
    return {};
  }

  if (typeof body !== 'object' || Array.isArray(body)) {
    return null;
  }

  return body as Record<string, unknown>;
}

function normalizeReferralParamsRecord(params: unknown): Record<string, unknown> {
  if (!params || typeof params !== 'object' || Array.isArray(params)) {
    return {};
  }

  return params as Record<string, unknown>;
}

export function normalizeRequiredReferralString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  if (hasUnsafeReferralRouteTextControls(value)) {
    return value;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export function normalizeOptionalReferralString(value: unknown): string | undefined | null {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value !== 'string') {
    return null;
  }

  if (hasUnsafeReferralRouteTextControls(value)) {
    return value;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeOptionalBoundedReferralString(
  value: unknown,
  maxLength: number
): string | undefined | null {
  const normalized = normalizeOptionalReferralString(value);
  if (normalized === null || normalized === undefined) {
    return normalized;
  }

  return normalized.length <= maxLength ? normalized : null;
}

export function parseOptionalNonNegativeReferralInteger(value: unknown): number | undefined | null {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value === 'string' && hasUnsafeReferralRouteTextControls(value)) {
    return null;
  }

  const numeric =
    typeof value === 'string' && /^\d+$/.test(value.trim()) ? Number(value.trim()) : value;

  if (typeof numeric !== 'number' || !Number.isInteger(numeric) || !Number.isSafeInteger(numeric)) {
    return null;
  }

  return numeric >= 0 ? numeric : null;
}

function getAuthenticatedReferralUserId(user: unknown): string | null {
  if (!user || typeof user !== 'object') {
    return null;
  }

  const userRecord = user as { userId?: unknown; id?: unknown };
  return (
    normalizeRequiredReferralString(userRecord.userId) ??
    normalizeRequiredReferralString(userRecord.id)
  );
}

function rejectMissingReferralUser(
  reply: { status: (statusCode: number) => { send: (payload: unknown) => unknown } }
): unknown {
  return reply.status(400).send({
    success: false,
    error: {
      code: 'INVALID_REFERRAL_USER',
      message: 'Authenticated user ID is required',
    },
  });
}

function rejectInvalidAuthenticatedReferralUserId(
  reply: { status: (statusCode: number) => { send: (payload: unknown) => unknown } },
  user: unknown
): boolean {
  const userId = getAuthenticatedReferralUserId(user);
  if (!userId) {
    rejectMissingReferralUser(reply);
    return true;
  }

  return (
    rejectUnsafeReferralTextField(reply, 'Referral user ID', userId) ||
    rejectOversizedReferralTextField(
      reply,
      'Referral user ID',
      userId,
      MAX_REFERRAL_USER_ID_LENGTH
    )
  );
}

function rejectInvalidReferralRequestBody(
  reply: { status: (statusCode: number) => { send: (payload: unknown) => unknown } }
): unknown {
  return reply.status(400).send({
    success: false,
    error: {
      code: 'INVALID_REFERRAL_REQUEST_BODY',
      message: 'Referral request body must be an object',
    },
  });
}

function rejectUnsafeReferralTextField(
  reply: { status: (statusCode: number) => { send: (payload: unknown) => unknown } },
  label: string,
  value: string | undefined | null
): boolean {
  if (value === undefined || value === null || !UNSAFE_REFERRAL_ROUTE_TEXT_CONTROLS.test(value)) {
    return false;
  }

  reply.status(400).send({
    success: false,
    error: {
      code: 'INVALID_REFERRAL_TEXT_FIELD',
      message: `${label} must not include unsafe control characters`,
    },
  });
  return true;
}

function rejectOversizedReferralTextField(
  reply: { status: (statusCode: number) => { send: (payload: unknown) => unknown } },
  label: string,
  value: string | undefined | null,
  maxLength: number
): boolean {
  if (value === undefined || value === null || value.length <= maxLength) {
    return false;
  }

  reply.status(400).send({
    success: false,
    error: {
      code: 'INVALID_REFERRAL_TEXT_FIELD',
      message: `${label} must be at most ${maxLength} characters`,
    },
  });
  return true;
}

function rejectUnsafeReferralRequestFieldNames(
  reply: { status: (statusCode: number) => { send: (payload: unknown) => unknown } },
  label: string,
  record: Record<string, unknown> | null | undefined
): boolean {
  if (!record || !Object.keys(record).some(hasUnsafeReferralRouteTextControls)) {
    return false;
  }

  reply.status(400).send({
    success: false,
    error: {
      code: 'INVALID_REFERRAL_FIELD_NAME',
      message: `${label} field names must not include unsafe control characters`,
    },
  });
  return true;
}

function rejectInvalidAffiliateApplicationTextBounds(
  reply: { status: (statusCode: number) => { send: (payload: unknown) => unknown } },
  applicationMessage: string,
  instagramHandle: string | undefined,
  youtubeChannel: string | undefined
): boolean {
  if (
    applicationMessage.length < MIN_AFFILIATE_APPLICATION_MESSAGE_LENGTH ||
    applicationMessage.length > MAX_AFFILIATE_APPLICATION_MESSAGE_LENGTH
  ) {
    reply.status(400).send({
      success: false,
      error: {
        code: 'INVALID_AFFILIATE_APPLICATION',
        message: 'Affiliate application message must be between 50 and 1000 characters',
      },
    });
    return true;
  }

  if (
    instagramHandle !== undefined &&
    instagramHandle.length > MAX_AFFILIATE_SOCIAL_PROFILE_LENGTH
  ) {
    reply.status(400).send({
      success: false,
      error: {
        code: 'INVALID_AFFILIATE_APPLICATION',
        message: 'Affiliate Instagram handle must be at most 255 characters',
      },
    });
    return true;
  }

  if (
    youtubeChannel !== undefined &&
    youtubeChannel.length > MAX_AFFILIATE_SOCIAL_PROFILE_LENGTH
  ) {
    reply.status(400).send({
      success: false,
      error: {
        code: 'INVALID_AFFILIATE_APPLICATION',
        message: 'Affiliate YouTube channel must be at most 255 characters',
      },
    });
    return true;
  }

  return false;
}

function rejectInvalidReferralShareTextBounds(
  reply: { status: (statusCode: number) => { send: (payload: unknown) => unknown } },
  referralCode: string,
  businessName: string
): boolean {
  if (referralCode.length > MAX_REFERRAL_SHARE_CODE_LENGTH) {
    reply.status(400).send({
      success: false,
      error: {
        code: 'INVALID_REFERRAL_SHARE_REQUEST',
        message: `Referral code must be at most ${MAX_REFERRAL_SHARE_CODE_LENGTH} characters`,
      },
    });
    return true;
  }

  if (businessName.length > MAX_REFERRAL_SHARE_BUSINESS_NAME_LENGTH) {
    reply.status(400).send({
      success: false,
      error: {
        code: 'INVALID_REFERRAL_SHARE_REQUEST',
        message: `Referral share business name must be at most ${MAX_REFERRAL_SHARE_BUSINESS_NAME_LENGTH} characters`,
      },
    });
    return true;
  }

  return false;
}

function normalizeOptionalReferralHttpUrl(value: unknown): string | undefined | null {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const normalized = normalizeRequiredReferralString(value);
  if (!normalized) {
    return null;
  }

  try {
    const parsedUrl = new URL(normalized);
    if (
      parsedUrl.username ||
      parsedUrl.password ||
      normalized.length > MAX_REFERRAL_SHARE_MENU_PREVIEW_URL_LENGTH
    ) {
      return null;
    }

    return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:' ? normalized : null;
  } catch {
    return null;
  }
}

function isValidAffiliateTrackingReferrerUrl(value: string): boolean {
  if (value.length > MAX_AFFILIATE_TRACKING_REFERRER_URL_LENGTH) {
    return false;
  }

  try {
    const parsedUrl = new URL(value);
    if (parsedUrl.username || parsedUrl.password) {
      return false;
    }

    return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
  } catch {
    return false;
  }
}

function normalizeAffiliateTrackingIpAddress(value: unknown): string | null {
  const normalized = normalizeRequiredReferralString(value);
  if (!normalized || normalized.length > 45 || isIP(normalized) === 0) {
    return null;
  }

  return normalized;
}

function normalizeReferralQueryRecord(value: unknown): Record<string, unknown> | null {
  if (value === undefined || value === null) {
    return {};
  }

  if (typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function rejectInvalidAuthenticatedReferralReadQuery(
  reply: { status: (statusCode: number) => { send: (payload: unknown) => unknown } },
  value: unknown
): boolean {
  const query = normalizeReferralQueryRecord(value);

  if (!query) {
    reply.status(400).send({
      success: false,
      error: {
        code: 'INVALID_REFERRAL_QUERY',
        message: 'Referral query must be an object',
      },
    });
    return true;
  }

  if (rejectUnsafeReferralRequestFieldNames(reply, 'Referral query', query)) {
    return true;
  }

  const unsupportedFields = unsupportedRequestFields(
    query,
    AUTHENTICATED_REFERRAL_READ_QUERY_FIELDS
  );
  if (unsupportedFields.length > 0) {
    reply.status(400).send({
      success: false,
      error: {
        code: 'UNSUPPORTED_REFERRAL_QUERY_FIELD',
        message: `Unsupported referral query field(s): ${unsupportedFields.join(', ')}`,
      },
    });
    return true;
  }

  return false;
}

export function parseOptionalLeaderboardLimit(value: unknown): number {
  if (value === undefined || value === null || value === '') {
    return DEFAULT_LEADERBOARD_LIMIT;
  }

  if (typeof value === 'string' && hasUnsafeReferralRouteTextControls(value)) {
    throw new Error('Referral leaderboard limit must not include unsafe control characters');
  }

  const normalizedValue = typeof value === 'string' ? value.trim() : value;
  const numeric =
    typeof normalizedValue === 'string' && /^\d+$/.test(normalizedValue)
      ? Number(normalizedValue)
      : normalizedValue;
  if (typeof numeric !== 'number' || !Number.isInteger(numeric)) {
    throw new Error('Referral leaderboard limit must be an integer');
  }

  if (!Number.isSafeInteger(numeric)) {
    throw new Error('Referral leaderboard limit must be a safe integer');
  }

  if (numeric < 1 || numeric > MAX_LEADERBOARD_LIMIT) {
    throw new Error(`Referral leaderboard limit must be between 1 and ${MAX_LEADERBOARD_LIMIT}`);
  }

  return numeric;
}

export const enhancedReferralRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook?.('onRequest', requireCapability('enhanced_referrals_affiliates'));

  let leaderboardService: LeaderboardService | null = null;
  let affiliateService: AffiliateService | null = null;
  let viralService: ViralService | null = null;
  const getLeaderboardService = (): LeaderboardService => {
    leaderboardService ??= new LeaderboardService();
    return leaderboardService;
  };
  const getAffiliateService = (): AffiliateService => {
    affiliateService ??= new AffiliateService();
    return affiliateService;
  };
  const getViralService = (): ViralService => {
    viralService ??= new ViralService();
    return viralService;
  };

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
      if (rejectInvalidAuthenticatedReferralReadQuery(reply, request.query)) {
        return;
      }

      if (rejectInvalidAuthenticatedReferralUserId(reply, request.user)) {
        return;
      }

      const body = normalizeReferralBodyRecord(request.body);
      if (body === null) {
        return rejectInvalidReferralRequestBody(reply);
      }

      if (rejectUnsafeReferralRequestFieldNames(reply, 'Customer referral request', body)) {
        return;
      }

      const unsupportedFields = unsupportedRequestFields(body, CUSTOMER_REFERRAL_CREATE_BODY_FIELDS);

      if (unsupportedFields.length > 0) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'UNSUPPORTED_REFERRAL_FIELD',
            message: `Unsupported referral request field(s): ${unsupportedFields.join(', ')}`,
          },
        });
      }

      const businessId = normalizeRequiredReferralString(body.business_id);
      if (!businessId) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'INVALID_REFERRAL_REQUEST',
            message: 'Business ID is required',
          },
        });
      }

      if (rejectUnsafeReferralTextField(reply, 'Referral business ID', businessId)) {
        return;
      }

      if (
        rejectOversizedReferralTextField(
          reply,
          'Referral business ID',
          businessId,
          MAX_REFERRAL_BUSINESS_ID_LENGTH
        )
      ) {
        return;
      }

      const userId = getAuthenticatedReferralUserId(request.user);
      if (!userId) {
        return rejectMissingReferralUser(reply);
      }

      if (rejectUnsafeReferralTextField(reply, 'Referral user ID', userId)) {
        return;
      }
      if (
        rejectOversizedReferralTextField(
          reply,
          'Referral user ID',
          userId,
          MAX_REFERRAL_USER_ID_LENGTH
        )
      ) {
        return;
      }

      try {
        const referral = await getViralService().createCustomerReferral(userId, businessId);

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
      if (rejectInvalidAuthenticatedReferralReadQuery(reply, request.query)) {
        return;
      }

      const userId = getAuthenticatedReferralUserId(request.user);
      if (!userId) {
        return rejectMissingReferralUser(reply);
      }

      if (rejectUnsafeReferralTextField(reply, 'Referral user ID', userId)) {
        return;
      }
      if (
        rejectOversizedReferralTextField(
          reply,
          'Referral user ID',
          userId,
          MAX_REFERRAL_USER_ID_LENGTH
        )
      ) {
        return;
      }

      try {
        const stats = await getViralService().getCustomerReferralStats(userId);

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
      const query = normalizeReferralQueryRecord(request.query);

      if (!query) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'INVALID_REFERRAL_LEADERBOARD_QUERY',
            message: 'Referral leaderboard query must be an object',
          },
        });
      }

      if (rejectUnsafeReferralRequestFieldNames(reply, 'Referral leaderboard query', query)) {
        return;
      }

      const unsupportedFields = unsupportedRequestFields(query, LEADERBOARD_QUERY_FIELDS);

      if (unsupportedFields.length > 0) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'UNSUPPORTED_REFERRAL_QUERY_FIELD',
            message: `Unsupported referral query field(s): ${unsupportedFields.join(', ')}`,
          },
        });
      }

      let limit: number;
      try {
        limit = parseOptionalLeaderboardLimit(query.limit);
      } catch (error) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'INVALID_REFERRAL_LEADERBOARD_QUERY',
            message: error instanceof Error ? error.message : 'Invalid referral leaderboard query',
          },
        });
      }

      try {
        const leaderboard = await getLeaderboardService().getTopReferrers(limit);

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
      if (rejectInvalidAuthenticatedReferralReadQuery(reply, request.query)) {
        return;
      }

      const userId = getAuthenticatedReferralUserId(request.user);
      if (!userId) {
        return rejectMissingReferralUser(reply);
      }

      if (rejectUnsafeReferralTextField(reply, 'Referral user ID', userId)) {
        return;
      }
      if (
        rejectOversizedReferralTextField(
          reply,
          'Referral user ID',
          userId,
          MAX_REFERRAL_USER_ID_LENGTH
        )
      ) {
        return;
      }

      try {
        const position = await getLeaderboardService().getUserPosition(userId);

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
      if (rejectInvalidAuthenticatedReferralReadQuery(reply, request.query)) {
        return;
      }

      const data = normalizeReferralBodyRecord(request.body);
      if (data === null) {
        return rejectInvalidReferralRequestBody(reply);
      }

      if (rejectUnsafeReferralRequestFieldNames(reply, 'Affiliate application request', data)) {
        return;
      }

      const unsupportedFields = unsupportedRequestFields(data, AFFILIATE_APPLICATION_BODY_FIELDS);

      if (unsupportedFields.length > 0) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'UNSUPPORTED_AFFILIATE_APPLICATION_FIELD',
            message: `Unsupported affiliate application field(s): ${unsupportedFields.join(', ')}`,
          },
        });
      }

      const userId = getAuthenticatedReferralUserId(request.user);
      if (!userId) {
        return rejectMissingReferralUser(reply);
      }

      if (rejectUnsafeReferralTextField(reply, 'Referral user ID', userId)) {
        return;
      }
      if (
        rejectOversizedReferralTextField(
          reply,
          'Referral user ID',
          userId,
          MAX_REFERRAL_USER_ID_LENGTH
        )
      ) {
        return;
      }

      const applicationMessage = normalizeRequiredReferralString(data.application_message);
      const instagramHandle = normalizeOptionalReferralString(data.instagram_handle);

      if (
        (typeof data.instagram_followers === 'string' &&
          rejectUnsafeReferralTextField(
            reply,
            'Affiliate Instagram followers',
            data.instagram_followers
          )) ||
        (typeof data.youtube_subscribers === 'string' &&
          rejectUnsafeReferralTextField(
            reply,
            'Affiliate YouTube subscribers',
            data.youtube_subscribers
          ))
      ) {
        return;
      }

      const instagramFollowers = parseOptionalNonNegativeReferralInteger(data.instagram_followers);
      const youtubeChannel = normalizeOptionalReferralString(data.youtube_channel);
      const youtubeSubscribers = parseOptionalNonNegativeReferralInteger(data.youtube_subscribers);

      if (!applicationMessage) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'INVALID_AFFILIATE_APPLICATION',
            message: 'Affiliate application message is required',
          },
        });
      }

      if (instagramHandle === null || youtubeChannel === null) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'INVALID_AFFILIATE_APPLICATION',
            message: 'Affiliate social profile fields must be strings when provided',
          },
        });
      }

      if (
        rejectUnsafeReferralTextField(reply, 'Affiliate application message', applicationMessage) ||
        rejectUnsafeReferralTextField(reply, 'Affiliate Instagram handle', instagramHandle) ||
        rejectUnsafeReferralTextField(reply, 'Affiliate YouTube channel', youtubeChannel)
      ) {
        return;
      }

      if (
        rejectInvalidAffiliateApplicationTextBounds(
          reply,
          applicationMessage,
          instagramHandle,
          youtubeChannel
        )
      ) {
        return;
      }

      if (instagramFollowers === null || youtubeSubscribers === null) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'INVALID_AFFILIATE_APPLICATION',
            message: 'Affiliate social audience counts must be non-negative safe integers',
          },
        });
      }

      const applicationData = {
        application_message: applicationMessage,
        ...(instagramHandle === undefined ? {} : { instagram_handle: instagramHandle }),
        ...(instagramFollowers === undefined ? {} : { instagram_followers: instagramFollowers }),
        ...(youtubeChannel === undefined ? {} : { youtube_channel: youtubeChannel }),
        ...(youtubeSubscribers === undefined ? {} : { youtube_subscribers: youtubeSubscribers }),
      };

      try {
        const affiliate = await getAffiliateService().applyForAffiliate(userId, applicationData);

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
      if (rejectInvalidAuthenticatedReferralReadQuery(reply, request.query)) {
        return;
      }

      const userId = getAuthenticatedReferralUserId(request.user);
      if (!userId) {
        return rejectMissingReferralUser(reply);
      }

      if (rejectUnsafeReferralTextField(reply, 'Referral user ID', userId)) {
        return;
      }
      if (
        rejectOversizedReferralTextField(
          reply,
          'Referral user ID',
          userId,
          MAX_REFERRAL_USER_ID_LENGTH
        )
      ) {
        return;
      }

      try {
        const dashboard = await getAffiliateService().getAffiliateDashboard(userId);

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
      const query = normalizeReferralQueryRecord(request.query);

      if (!query) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'INVALID_AFFILIATE_TRACKING_QUERY',
            message: 'Affiliate tracking query must be an object',
          },
        });
      }

      if (rejectUnsafeReferralRequestFieldNames(reply, 'Affiliate tracking query', query)) {
        return;
      }

      const unsupportedQueryFields = unsupportedRequestFields(query, AFFILIATE_TRACKING_QUERY_FIELDS);

      if (unsupportedQueryFields.length > 0) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'UNSUPPORTED_REFERRAL_QUERY_FIELD',
            message: `Unsupported referral query field(s): ${unsupportedQueryFields.join(', ')}`,
          },
        });
      }

      const body = normalizeReferralBodyRecord(request.body);
      if (body === null) {
        return rejectInvalidReferralRequestBody(reply);
      }

      if (rejectUnsafeReferralRequestFieldNames(reply, 'Affiliate tracking request', body)) {
        return;
      }

      const unsupportedBodyFields = unsupportedRequestFields(body, AFFILIATE_TRACKING_BODY_FIELDS);
      if (unsupportedBodyFields.length > 0) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'UNSUPPORTED_REFERRAL_FIELD',
            message: `Unsupported referral request field(s): ${unsupportedBodyFields.join(', ')}`,
          },
        });
      }

      const { affiliateCode } = normalizeReferralParamsRecord(request.params);
      const normalizedAffiliateCode = normalizeRequiredReferralString(affiliateCode);

      if (!normalizedAffiliateCode) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'INVALID_AFFILIATE_TRACKING_REQUEST',
            message: 'Affiliate code is required',
          },
        });
      }

      if (rejectUnsafeReferralTextField(reply, 'Affiliate code', normalizedAffiliateCode)) {
        return;
      }
      if (
        rejectOversizedReferralTextField(
          reply,
          'Affiliate code',
          normalizedAffiliateCode,
          MAX_AFFILIATE_TRACKING_CODE_LENGTH
        )
      ) {
        return;
      }

      const normalizedUtmSource = normalizeOptionalBoundedReferralString(
        body.utm_source,
        MAX_AFFILIATE_TRACKING_UTM_LENGTH
      );
      const normalizedUtmMedium = normalizeOptionalBoundedReferralString(
        body.utm_medium,
        MAX_AFFILIATE_TRACKING_UTM_LENGTH
      );
      const normalizedUtmCampaign = normalizeOptionalBoundedReferralString(
        body.utm_campaign,
        MAX_AFFILIATE_TRACKING_UTM_LENGTH
      );

      if (
        normalizedUtmSource === null ||
        normalizedUtmMedium === null ||
        normalizedUtmCampaign === null
      ) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'INVALID_AFFILIATE_TRACKING_REQUEST',
            message: 'Affiliate tracking UTM fields must be strings up to 100 characters',
          },
        });
      }

      if (
        rejectUnsafeReferralTextField(reply, 'Affiliate tracking UTM source', normalizedUtmSource) ||
        rejectUnsafeReferralTextField(reply, 'Affiliate tracking UTM medium', normalizedUtmMedium) ||
        rejectUnsafeReferralTextField(reply, 'Affiliate tracking UTM campaign', normalizedUtmCampaign)
      ) {
        return;
      }

      const userAgent = normalizeOptionalReferralString(request.headers['user-agent']);
      const referrerUrl = normalizeOptionalReferralString(request.headers.referer);
      if (userAgent === null || referrerUrl === null) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'INVALID_AFFILIATE_TRACKING_REQUEST',
            message: 'Affiliate tracking headers must be strings when provided',
          },
        });
      }
      if (
        rejectUnsafeReferralTextField(reply, 'Affiliate tracking user agent', userAgent) ||
        rejectUnsafeReferralTextField(reply, 'Affiliate tracking referrer URL', referrerUrl)
      ) {
        return;
      }
      if (
        userAgent !== undefined &&
        userAgent.length > MAX_AFFILIATE_TRACKING_USER_AGENT_LENGTH
      ) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'INVALID_AFFILIATE_TRACKING_REQUEST',
            message: `Affiliate tracking user agent must be at most ${MAX_AFFILIATE_TRACKING_USER_AGENT_LENGTH} characters`,
          },
        });
      }
      if (referrerUrl !== undefined && !isValidAffiliateTrackingReferrerUrl(referrerUrl)) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'INVALID_AFFILIATE_TRACKING_REQUEST',
            message: `Affiliate tracking referrer URL must be an absolute HTTP(S) URL without embedded credentials and at most ${MAX_AFFILIATE_TRACKING_REFERRER_URL_LENGTH} characters`,
          },
        });
      }

      const ipAddress = normalizeAffiliateTrackingIpAddress(request.ip);
      if (!ipAddress) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'INVALID_AFFILIATE_TRACKING_REQUEST',
            message: 'Affiliate tracking IP address must be a valid IPv4 or IPv6 address',
          },
        });
      }

      try {
        const click = await getAffiliateService().trackClick(normalizedAffiliateCode, {
          ip_address: ipAddress,
          user_agent: userAgent,
          referrer_url: referrerUrl,
          ...(normalizedUtmSource === undefined ? {} : { utm_source: normalizedUtmSource }),
          ...(normalizedUtmMedium === undefined ? {} : { utm_medium: normalizedUtmMedium }),
          ...(normalizedUtmCampaign === undefined ? {} : { utm_campaign: normalizedUtmCampaign }),
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
      if (rejectInvalidAuthenticatedReferralReadQuery(reply, request.query)) {
        return;
      }

      if (rejectInvalidAuthenticatedReferralUserId(reply, request.user)) {
        return;
      }

      const body = normalizeReferralBodyRecord(request.body);
      if (body === null) {
        return rejectInvalidReferralRequestBody(reply);
      }

      if (rejectUnsafeReferralRequestFieldNames(reply, 'Instagram share request', body)) {
        return;
      }

      const unsupportedFields = unsupportedRequestFields(body, INSTAGRAM_SHARE_BODY_FIELDS);

      if (unsupportedFields.length > 0) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'UNSUPPORTED_REFERRAL_FIELD',
            message: `Unsupported referral request field(s): ${unsupportedFields.join(', ')}`,
          },
        });
      }

      const referralCode = normalizeRequiredReferralString(body.referral_code);
      const businessName = normalizeRequiredReferralString(body.business_name);
      const menuPreviewUrlText = normalizeOptionalReferralString(body.menu_preview_url);

      if (!referralCode || !businessName) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'INVALID_REFERRAL_SHARE_REQUEST',
            message: 'Referral code and business name are required',
          },
        });
      }

      if (
        rejectUnsafeReferralTextField(reply, 'Referral share code', referralCode) ||
        rejectUnsafeReferralTextField(reply, 'Referral share business name', businessName) ||
        rejectUnsafeReferralTextField(reply, 'Referral share menu preview URL', menuPreviewUrlText)
      ) {
        return;
      }

      if (rejectInvalidReferralShareTextBounds(reply, referralCode, businessName)) {
        return;
      }

      if (menuPreviewUrlText === null) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'INVALID_REFERRAL_SHARE_REQUEST',
            message: 'Menu preview URL must be an absolute HTTP(S) URL without embedded credentials and at most 2048 characters',
          },
        });
      }

      const menuPreviewUrl = normalizeOptionalReferralHttpUrl(menuPreviewUrlText);

      if (menuPreviewUrl === null) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'INVALID_REFERRAL_SHARE_REQUEST',
            message: 'Menu preview URL must be an absolute HTTP(S) URL without embedded credentials and at most 2048 characters',
          },
        });
      }

      try {
        const shareData = getViralService().generateInstagramStoryShare(
          referralCode,
          businessName,
          menuPreviewUrl
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
      if (rejectInvalidAuthenticatedReferralReadQuery(reply, request.query)) {
        return;
      }

      if (rejectInvalidAuthenticatedReferralUserId(reply, request.user)) {
        return;
      }

      const body = normalizeReferralBodyRecord(request.body);
      if (body === null) {
        return rejectInvalidReferralRequestBody(reply);
      }

      if (rejectUnsafeReferralRequestFieldNames(reply, 'WhatsApp share request', body)) {
        return;
      }

      const unsupportedFields = unsupportedRequestFields(body, WHATSAPP_SHARE_BODY_FIELDS);

      if (unsupportedFields.length > 0) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'UNSUPPORTED_REFERRAL_FIELD',
            message: `Unsupported referral request field(s): ${unsupportedFields.join(', ')}`,
          },
        });
      }

      const referralCode = normalizeRequiredReferralString(body.referral_code);
      const businessName = normalizeRequiredReferralString(body.business_name);

      if (!referralCode || !businessName) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'INVALID_REFERRAL_SHARE_REQUEST',
            message: 'Referral code and business name are required',
          },
        });
      }

      if (
        rejectUnsafeReferralTextField(reply, 'Referral share code', referralCode) ||
        rejectUnsafeReferralTextField(reply, 'Referral share business name', businessName)
      ) {
        return;
      }

      if (rejectInvalidReferralShareTextBounds(reply, referralCode, businessName)) {
        return;
      }

      try {
        const shareData = getViralService().generateWhatsAppShare(referralCode, businessName);

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
      if (rejectInvalidAuthenticatedReferralReadQuery(reply, request.query)) {
        return;
      }

      const userId = getAuthenticatedReferralUserId(request.user);
      if (!userId) {
        return rejectMissingReferralUser(reply);
      }

      if (rejectUnsafeReferralTextField(reply, 'Referral user ID', userId)) {
        return;
      }
      if (
        rejectOversizedReferralTextField(
          reply,
          'Referral user ID',
          userId,
          MAX_REFERRAL_USER_ID_LENGTH
        )
      ) {
        return;
      }

      try {
        const badges = await getViralService().getUserBadges(userId);

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
      if (rejectInvalidAuthenticatedReferralReadQuery(reply, request.query)) {
        return;
      }

      const body = normalizeReferralBodyRecord(request.body);
      if (body === null) {
        return rejectInvalidReferralRequestBody(reply);
      }

      if (rejectUnsafeReferralRequestFieldNames(reply, 'Badge check request', body)) {
        return;
      }

      const unsupportedBodyFields = unsupportedRequestFields(body, BADGE_CHECK_BODY_FIELDS);
      if (unsupportedBodyFields.length > 0) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'UNSUPPORTED_REFERRAL_FIELD',
            message: `Unsupported referral request field(s): ${unsupportedBodyFields.join(', ')}`,
          },
        });
      }

      const userId = getAuthenticatedReferralUserId(request.user);
      if (!userId) {
        return rejectMissingReferralUser(reply);
      }

      if (rejectUnsafeReferralTextField(reply, 'Referral user ID', userId)) {
        return;
      }
      if (
        rejectOversizedReferralTextField(
          reply,
          'Referral user ID',
          userId,
          MAX_REFERRAL_USER_ID_LENGTH
        )
      ) {
        return;
      }

      try {
        const newBadges = await getViralService().checkAndAwardBadges(userId);

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
