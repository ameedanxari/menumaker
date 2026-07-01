import { FastifyInstance} from 'fastify';
import { SubscriptionService } from '../services/SubscriptionService.js';
import { authenticate } from '../middleware/auth.js';
import { SubscriptionTier, SUBSCRIPTION_TIERS } from '../models/Subscription.js';
import { logSecurityEvent } from '../utils/logger.js';
import { requireCapability } from '../config/capabilities.js';

export const processedSubscriptionEventIds = new Set<string>();

const UNSAFE_SUBSCRIPTION_ROUTE_TEXT_CONTROLS =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/u;
const MAX_SUBSCRIPTION_BUSINESS_ID_CHARS = 255;
const MAX_SUBSCRIPTION_USER_ID_CHARS = 255;
const MAX_SUBSCRIPTION_CUSTOMER_EMAIL_CHARS = 254;
const MAX_SUBSCRIPTION_PORTAL_RETURN_URL_CHARS = 2048;
const MAX_SUBSCRIPTION_WEBHOOK_SIGNATURE_CHARS = 4096;
const MAX_SUBSCRIPTION_WEBHOOK_EVENT_ID_CHARS = 255;
const MAX_SUBSCRIPTION_WEBHOOK_EVENT_TYPE_CHARS = 255;
const SUPPORTED_SUBSCRIPTION_WEBHOOK_EVENT_TYPES = new Set([
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'customer.subscription.trial_will_end',
]);

function hasUnsafeSubscriptionRouteTextControls(value: string): boolean {
  return UNSAFE_SUBSCRIPTION_ROUTE_TEXT_CONTROLS.test(value);
}

export function normalizeSubscriptionWebhookEventId(eventId: unknown): string {
  if (typeof eventId !== 'string') {
    throw new Error('Stripe subscription webhook event id must be a non-empty string');
  }

  if (hasUnsafeSubscriptionRouteTextControls(eventId)) {
    throw new Error('Stripe subscription webhook event id must not include unsafe control characters');
  }

  const normalizedEventId = eventId.trim();
  if (normalizedEventId.length === 0) {
    throw new Error('Stripe subscription webhook event id must be a non-empty string');
  }

  if (normalizedEventId.length > MAX_SUBSCRIPTION_WEBHOOK_EVENT_ID_CHARS) {
    throw new Error(
      `Stripe subscription webhook event id must be at most ${MAX_SUBSCRIPTION_WEBHOOK_EVENT_ID_CHARS} characters`
    );
  }

  return normalizedEventId;
}

export function normalizeSubscriptionWebhookEventType(eventType: unknown): string {
  if (typeof eventType !== 'string') {
    throw new Error('Stripe subscription webhook event type must be a non-empty string');
  }

  if (hasUnsafeSubscriptionRouteTextControls(eventType)) {
    throw new Error('Stripe subscription webhook event type must not include unsafe control characters');
  }

  const normalizedEventType = eventType.trim();
  if (normalizedEventType.length === 0) {
    throw new Error('Stripe subscription webhook event type must be a non-empty string');
  }

  if (normalizedEventType.length > MAX_SUBSCRIPTION_WEBHOOK_EVENT_TYPE_CHARS) {
    throw new Error(
      `Stripe subscription webhook event type must be at most ${MAX_SUBSCRIPTION_WEBHOOK_EVENT_TYPE_CHARS} characters`
    );
  }
  if (!SUPPORTED_SUBSCRIPTION_WEBHOOK_EVENT_TYPES.has(normalizedEventType)) {
    throw new Error('Stripe subscription webhook event type must be a supported subscription webhook event');
  }

  return normalizedEventType;
}

export function recordSubscriptionEventOnce(eventId: unknown): boolean {
  const normalizedEventId = normalizeSubscriptionWebhookEventId(eventId);
  if (processedSubscriptionEventIds.has(normalizedEventId)) return false;
  processedSubscriptionEventIds.add(normalizedEventId);
  return true;
}

export function releaseSubscriptionEventReceipt(eventId: unknown): void {
  processedSubscriptionEventIds.delete(normalizeSubscriptionWebhookEventId(eventId));
}

export function getExactSubscriptionWebhookBody(request: { rawBody?: Buffer; body?: unknown }): Buffer {
  if (Buffer.isBuffer(request.rawBody)) return request.rawBody;
  if (Buffer.isBuffer(request.body)) return request.body;
  throw new Error('Exact raw subscription webhook body is required');
}

const SUBSCRIPTION_SUBSCRIBE_BODY_KEYS = new Set(['tier', 'trialDays', 'email']);
const SUBSCRIPTION_CANCEL_BODY_KEYS = new Set(['immediate']);
const SUBSCRIPTION_RESUME_BODY_KEYS = new Set<string>();
const SUBSCRIPTION_SUBSCRIBE_QUERY_KEYS = new Set<string>();
const SUBSCRIPTION_CANCEL_QUERY_KEYS = new Set<string>();
const SUBSCRIPTION_RESUME_QUERY_KEYS = new Set<string>();
const SUBSCRIPTION_TIERS_QUERY_KEYS = new Set<string>();
const SUBSCRIPTION_PORTAL_QUERY_KEYS = new Set(['returnUrl']);
const SUBSCRIPTION_READ_QUERY_KEYS = new Set<string>();
const SUBSCRIPTION_WEBHOOK_QUERY_KEYS = new Set<string>();
const SUBSCRIPTION_TIERS_ALLOWED = new Set<SubscriptionTier>(['free', 'starter', 'pro']);

function normalizeOptionalSubscriptionRequestRecord(value: unknown): Record<string, unknown> | null {
  if (value === undefined || value === null) {
    return {};
  }

  if (typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function unsupportedRequestFields(body: unknown, allowedKeys: Set<string>): string[] {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return [];
  }

  return Object.keys(body).filter((key) => !allowedKeys.has(key)).sort();
}

function rejectMalformedSubscriptionBody(
  reply: { status: (statusCode: number) => { send: (payload: unknown) => unknown } },
  body: Record<string, unknown> | null
): body is null {
  if (body !== null) {
    return false;
  }

  reply.status(400).send({
    success: false,
    error: {
      code: 'INVALID_SUBSCRIPTION_REQUEST_BODY',
      message: 'Subscription request body must be an object',
    },
  });
  return true;
}

function rejectMalformedSubscriptionQuery(
  reply: { status: (statusCode: number) => { send: (payload: unknown) => unknown } },
  query: Record<string, unknown> | null
): query is null {
  if (query !== null) {
    return false;
  }

  reply.status(400).send({
    success: false,
    error: {
      code: 'INVALID_SUBSCRIPTION_QUERY',
      message: 'Subscription query must be an object',
    },
  });
  return true;
}

function rejectUnsupportedSubscriptionFields(
  reply: { status: (statusCode: number) => { send: (payload: unknown) => unknown } },
  fields: string[]
): boolean {
  if (fields.length === 0) {
    return false;
  }

  reply.status(400).send({
    success: false,
    error: {
      code: 'UNSUPPORTED_SUBSCRIPTION_FIELD',
      message: `Unsupported subscription request field(s): ${fields.join(', ')}`,
    },
  });
  return true;
}

function rejectUnsafeSubscriptionRequestFieldNames(
  reply: { status: (statusCode: number) => { send: (payload: unknown) => unknown } },
  label: string,
  record: Record<string, unknown> | null | undefined
): boolean {
  if (!record || !Object.keys(record).some(hasUnsafeSubscriptionRouteTextControls)) {
    return false;
  }

  reply.status(400).send({
    success: false,
    error: {
      code: 'INVALID_SUBSCRIPTION_FIELD_NAME',
      message: `${label} field names must not include unsafe control characters`,
    },
  });
  return true;
}

export function normalizeRequiredSubscriptionString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  if (hasUnsafeSubscriptionRouteTextControls(value)) {
    return value;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function rejectUnsafeSubscriptionTextField(
  reply: { status: (statusCode: number) => { send: (payload: unknown) => unknown } },
  label: string,
  value: string | undefined | null
): boolean {
  if (value === undefined || value === null || !hasUnsafeSubscriptionRouteTextControls(value)) {
    return false;
  }

  reply.status(400).send({
    success: false,
    error: {
      code: 'INVALID_SUBSCRIPTION_TEXT_FIELD',
      message: `${label} must not include unsafe control characters`,
    },
  });
  return true;
}

function rejectOversizedSubscriptionTextField(
  reply: { status: (statusCode: number) => { send: (payload: unknown) => unknown } },
  label: string,
  value: string | undefined | null,
  maxChars: number
): boolean {
  if (value === undefined || value === null || value.length <= maxChars) {
    return false;
  }

  reply.status(400).send({
    success: false,
    error: {
      code: 'INVALID_SUBSCRIPTION_TEXT_FIELD',
      message: `${label} must be at most ${maxChars} characters`,
    },
  });
  return true;
}

function normalizeAuthenticatedSubscriptionBusinessId(
  request: { user?: { businessId?: unknown } | null }
): string | null {
  return normalizeRequiredSubscriptionString(request.user?.businessId);
}

function normalizeAuthenticatedSubscriptionUserId(
  request: { user?: { userId?: unknown; id?: unknown } | null }
): string | null {
  return (
    normalizeRequiredSubscriptionString(request.user?.userId) ??
    normalizeRequiredSubscriptionString(request.user?.id)
  );
}

function rejectMissingSubscriptionUserId(
  reply: { status: (statusCode: number) => { send: (payload: unknown) => unknown } },
  userId: string | null
): userId is null {
  if (userId !== null) {
    return false;
  }

  reply.status(400).send({
    success: false,
    error: {
      code: 'NO_USER',
      message: 'User identity is required',
    },
  });
  return true;
}

function normalizeAuthenticatedSubscriptionIdentity(
  request: { user?: { businessId?: unknown; userId?: unknown; id?: unknown } | null },
  reply: { status: (statusCode: number) => { send: (payload: unknown) => unknown } }
): { businessId: string; userId: string } | null {
  const businessId = normalizeAuthenticatedSubscriptionBusinessId(request);

  if (!businessId) {
    reply.status(400).send({
      success: false,
      error: {
        code: 'NO_BUSINESS',
        message: 'User has no business associated',
      },
    });
    return null;
  }
  if (
    rejectUnsafeSubscriptionTextField(reply, 'Subscription business ID', businessId) ||
    rejectOversizedSubscriptionTextField(
      reply,
      'Subscription business ID',
      businessId,
      MAX_SUBSCRIPTION_BUSINESS_ID_CHARS
    )
  ) {
    return null;
  }

  const userId = normalizeAuthenticatedSubscriptionUserId(request);
  if (
    rejectMissingSubscriptionUserId(reply, userId) ||
    rejectUnsafeSubscriptionTextField(reply, 'Subscription user ID', userId) ||
    rejectOversizedSubscriptionTextField(
      reply,
      'Subscription user ID',
      userId,
      MAX_SUBSCRIPTION_USER_ID_CHARS
    )
  ) {
    return null;
  }

  return { businessId, userId };
}

function normalizeSubscriptionTier(value: unknown): SubscriptionTier | null {
  const normalized = normalizeRequiredSubscriptionString(value);
  if (!normalized || !SUBSCRIPTION_TIERS_ALLOWED.has(normalized as SubscriptionTier)) {
    return null;
  }

  return normalized as SubscriptionTier;
}

function parseOptionalSubscriptionTrialDays(value: unknown): number | undefined | null {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < 1 ||
    value > 365 ||
    !Number.isSafeInteger(value)
  ) {
    return null;
  }

  return value;
}

function normalizeOptionalSubscriptionEmail(value: unknown): string | undefined | null {
  if (value === undefined || value === null) {
    return undefined;
  }

  const normalized = normalizeRequiredSubscriptionString(value);
  if (
    !normalized ||
    normalized.length > MAX_SUBSCRIPTION_CUSTOMER_EMAIL_CHARS ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)
  ) {
    return null;
  }

  return normalized;
}

function normalizeOptionalCancellationImmediate(value: unknown): boolean | undefined | null {
  if (value === undefined || value === null) {
    return undefined;
  }

  return typeof value === 'boolean' ? value : null;
}

function isValidSubscriptionPortalReturnUrl(value: string): boolean {
  if (value.length > MAX_SUBSCRIPTION_PORTAL_RETURN_URL_CHARS) {
    return false;
  }

  try {
    const parsedUrl = new URL(value);
    if (parsedUrl.username || parsedUrl.password) {
      return false;
    }

    return (
      (parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:') &&
      !isPrivateOrInternalSubscriptionHost(parsedUrl.hostname)
    );
  } catch {
    return false;
  }
}

function parseSubscriptionIPv4Host(hostname: string): number[] | null {
  const parts = hostname.split('.');
  if (parts.length !== 4) return null;

  const octets = parts.map((part) => {
    if (!/^\d{1,3}$/.test(part)) return Number.NaN;
    const octet = Number(part);
    return Number.isInteger(octet) && octet >= 0 && octet <= 255 ? octet : Number.NaN;
  });

  return octets.every((octet) => Number.isInteger(octet)) ? octets : null;
}

function isPrivateOrInternalSubscriptionHost(hostname: string): boolean {
  const normalizedHost = hostname.toLowerCase().replace(/\.$/, '');
  const unbracketedHost = normalizedHost.replace(/^\[(.*)\]$/, '$1');

  if (unbracketedHost === 'localhost' || unbracketedHost.endsWith('.localhost')) {
    return true;
  }

  const ipv4Host = unbracketedHost.startsWith('::ffff:')
    ? unbracketedHost.slice('::ffff:'.length)
    : unbracketedHost;
  const octets = parseSubscriptionIPv4Host(ipv4Host);
  if (octets) {
    const [first, second] = octets;
    return (
      first === 0 ||
      first === 10 ||
      first === 127 ||
      (first === 100 && second >= 64 && second <= 127) ||
      (first === 169 && second === 254) ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 168)
    );
  }

  if (!unbracketedHost.includes(':')) {
    return false;
  }

  const firstIpv6Group = unbracketedHost.split(':')[0];
  return (
    unbracketedHost === '::' ||
    unbracketedHost === '::1' ||
    firstIpv6Group.startsWith('fc') ||
    firstIpv6Group.startsWith('fd') ||
    /^fe[89ab]/u.test(firstIpv6Group)
  );
}

export async function subscriptionRoutes(fastify: FastifyInstance): Promise<void> {
  const requireSubscriptions = requireCapability('subscriptions');
  let subscriptionService: SubscriptionService | null = null;
  const getSubscriptionService = (): SubscriptionService => {
    subscriptionService ??= new SubscriptionService();
    return subscriptionService;
  };

  /**
   * GET /subscriptions/tiers
   * Get available subscription tiers and pricing
   * Public endpoint
   */
  fastify.get('/tiers', {
    preHandler: requireSubscriptions,
  }, async (request, reply) => {
    const query = normalizeOptionalSubscriptionRequestRecord(request.query);
    if (rejectMalformedSubscriptionQuery(reply, query)) {
      return;
    }

    if (rejectUnsafeSubscriptionRequestFieldNames(reply, 'Subscription tiers query', query)) {
      return;
    }

    const unsupportedFields = unsupportedRequestFields(
      query,
      SUBSCRIPTION_TIERS_QUERY_KEYS
    );
    if (rejectUnsupportedSubscriptionFields(reply, unsupportedFields)) {
      return;
    }

    const tiers = Object.entries(SUBSCRIPTION_TIERS).map(([key, config]) => ({
      tier: key,
      name: config.name,
      price: config.price,
      currency: config.currency,
      interval: config.interval,
      features: config.features,
      description: config.description,
    }));

    reply.send({
      success: true,
      data: { tiers },
    });
  });

  /**
   * GET /subscriptions/current
   * Get current subscription for authenticated business
   * Authenticated endpoint
   */
  fastify.get('/current', {
    preHandler: [requireSubscriptions, authenticate],
  }, async (request, reply) => {    // Get business from auth middleware
    const authenticatedIdentity = normalizeAuthenticatedSubscriptionIdentity(request, reply);
    if (!authenticatedIdentity) {
      return;
    }
    const { businessId } = authenticatedIdentity;

    const query = normalizeOptionalSubscriptionRequestRecord(request.query);
    if (rejectMalformedSubscriptionQuery(reply, query)) {
      return;
    }

    if (rejectUnsafeSubscriptionRequestFieldNames(reply, 'Subscription current query', query)) {
      return;
    }

    const unsupportedFields = unsupportedRequestFields(
      query,
      SUBSCRIPTION_READ_QUERY_KEYS
    );
    if (rejectUnsupportedSubscriptionFields(reply, unsupportedFields)) {
      return;
    }

    const subscription = await getSubscriptionService().getSubscription(businessId);

    if (!subscription) {
      reply.status(404).send({
        success: false,
        error: {
          code: 'SUBSCRIPTION_NOT_FOUND',
          message: 'No subscription found for this business',
        },
      });
      return;
    }

    const tierConfig = subscription.getTierConfig();

    reply.send({
      success: true,
      data: {
        subscription: {
          id: subscription.id,
          tier: subscription.tier,
          status: subscription.status,
          isActive: subscription.isActive(),
          isInTrial: subscription.isInTrial(),
          currentPeriodStart: subscription.current_period_start,
          currentPeriodEnd: subscription.current_period_end,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          trialEnd: subscription.trial_end,
          features: tierConfig.features,
          price: tierConfig.price,
          currency: tierConfig.currency,
        },
      },
    });

  });

  /**
   * POST /subscriptions/subscribe
   * Create or upgrade subscription
   * Authenticated endpoint
   */
  fastify.post('/subscribe', {
    preHandler: [requireSubscriptions, authenticate],
  }, async (request, reply) => {
    const authenticatedIdentity = normalizeAuthenticatedSubscriptionIdentity(request, reply);
    if (!authenticatedIdentity) {
      return;
    }
    const { businessId, userId } = authenticatedIdentity;

    const query = normalizeOptionalSubscriptionRequestRecord(request.query);
    if (rejectMalformedSubscriptionQuery(reply, query)) {
      return;
    }

    if (rejectUnsafeSubscriptionRequestFieldNames(reply, 'Subscription subscribe query', query)) {
      return;
    }

    const unsupportedQueryFields = unsupportedRequestFields(
      query,
      SUBSCRIPTION_SUBSCRIBE_QUERY_KEYS
    );
    if (rejectUnsupportedSubscriptionFields(reply, unsupportedQueryFields)) {
      return;
    }

    const body = normalizeOptionalSubscriptionRequestRecord(request.body);
    if (rejectMalformedSubscriptionBody(reply, body)) {
      return;
    }

    if (rejectUnsafeSubscriptionRequestFieldNames(reply, 'Subscription subscribe request', body)) {
      return;
    }

    const unsupportedFields = unsupportedRequestFields(
      body,
      SUBSCRIPTION_SUBSCRIBE_BODY_KEYS
    );
    if (rejectUnsupportedSubscriptionFields(reply, unsupportedFields)) {
      return;
    }

    const { tier, trialDays, email } = body as {
      tier: SubscriptionTier;
      trialDays?: number;
      email?: string;
    };

    const normalizedTierText = normalizeRequiredSubscriptionString(tier);
    if (rejectUnsafeSubscriptionTextField(reply, 'Subscription tier', normalizedTierText)) {
      return;
    }

    const normalizedTier = normalizeSubscriptionTier(tier);
    if (!normalizedTier) {
      reply.status(400).send({
        success: false,
        error: {
          code: 'INVALID_TIER',
          message: 'Invalid subscription tier',
        },
      });
      return;
    }

    if (
      typeof trialDays === 'string' &&
      rejectUnsafeSubscriptionTextField(reply, 'Subscription trialDays', trialDays)
    ) {
      return;
    }
    const normalizedTrialDays = parseOptionalSubscriptionTrialDays(trialDays);
    if (normalizedTrialDays === null) {
      reply.status(400).send({
        success: false,
        error: {
          code: 'INVALID_TRIAL_DAYS',
          message: 'subscription trialDays must be a positive safe integer between 1 and 365',
        },
      });
      return;
    }

    const normalizedEmail = normalizeOptionalSubscriptionEmail(email);
    if (normalizedEmail === null) {
      reply.status(400).send({
        success: false,
        error: {
          code: 'INVALID_EMAIL',
          message: 'subscription customer email must be a valid email address',
        },
      });
      return;
    }
    if (rejectUnsafeSubscriptionTextField(reply, 'Subscription customer email', normalizedEmail)) {
      return;
    }

    const { subscription, clientSecret } = await getSubscriptionService().createSubscription(
      businessId,
      normalizedTier,
      { trialDays: normalizedTrialDays, email: normalizedEmail }
    );

    // Log security event
    logSecurityEvent(request.log, `Subscription created/upgraded: ${normalizedTier}`, {
      requestId: request.id,
      userId,
      businessId,
      tier: normalizedTier,
      severity: 'low',
    });

    reply.send({
      success: true,
      data: {
        subscription: {
          id: subscription.id,
          tier: subscription.tier,
          status: subscription.status,
          currentPeriodStart: subscription.current_period_start,
          currentPeriodEnd: subscription.current_period_end,
          trialEnd: subscription.trial_end,
        },
        clientSecret, // For payment confirmation if needed
      },
    });

  });

  /**
   * POST /subscriptions/cancel
   * Cancel subscription
   * Authenticated endpoint
   */
  fastify.post('/cancel', {
    preHandler: [requireSubscriptions, authenticate],
  }, async (request, reply) => {
    const authenticatedIdentity = normalizeAuthenticatedSubscriptionIdentity(request, reply);
    if (!authenticatedIdentity) {
      return;
    }
    const { businessId, userId } = authenticatedIdentity;

    const query = normalizeOptionalSubscriptionRequestRecord(request.query);
    if (rejectMalformedSubscriptionQuery(reply, query)) {
      return;
    }

    if (rejectUnsafeSubscriptionRequestFieldNames(reply, 'Subscription cancel query', query)) {
      return;
    }

    const unsupportedQueryFields = unsupportedRequestFields(
      query,
      SUBSCRIPTION_CANCEL_QUERY_KEYS
    );
    if (rejectUnsupportedSubscriptionFields(reply, unsupportedQueryFields)) {
      return;
    }

    const body = normalizeOptionalSubscriptionRequestRecord(request.body);
    if (rejectMalformedSubscriptionBody(reply, body)) {
      return;
    }

    if (rejectUnsafeSubscriptionRequestFieldNames(reply, 'Subscription cancel request', body)) {
      return;
    }

    const unsupportedFields = unsupportedRequestFields(
      body,
      SUBSCRIPTION_CANCEL_BODY_KEYS
    );
    if (rejectUnsupportedSubscriptionFields(reply, unsupportedFields)) {
      return;
    }

    const { immediate } = body as { immediate?: boolean };
    if (
      typeof immediate === 'string' &&
      rejectUnsafeSubscriptionTextField(reply, 'Subscription cancellation immediate', immediate)
    ) {
      return;
    }

    const normalizedImmediate = normalizeOptionalCancellationImmediate(immediate);
    if (normalizedImmediate === null) {
      reply.status(400).send({
        success: false,
        error: {
          code: 'INVALID_CANCELLATION_OPTION',
          message: 'subscription cancellation immediate must be a boolean',
        },
      });
      return;
    }

    const subscription = await getSubscriptionService().cancelSubscription(businessId, {
      immediate: normalizedImmediate,
    });

    // Log security event
    logSecurityEvent(request.log, `Subscription canceled: ${subscription.tier}`, {
      requestId: request.id,
      userId,
      businessId,
      immediate: normalizedImmediate,
      severity: 'medium',
    });

    reply.send({
      success: true,
      data: {
        subscription: {
          id: subscription.id,
          tier: subscription.tier,
          status: subscription.status,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          canceledAt: subscription.canceled_at,
        },
      },
    });

  });

  /**
   * POST /subscriptions/resume
   * Resume canceled subscription
   * Authenticated endpoint
   */
  fastify.post('/resume', {
    preHandler: [requireSubscriptions, authenticate],
  }, async (request, reply) => {
    const authenticatedIdentity = normalizeAuthenticatedSubscriptionIdentity(request, reply);
    if (!authenticatedIdentity) {
      return;
    }
    const { businessId, userId } = authenticatedIdentity;

    const query = normalizeOptionalSubscriptionRequestRecord(request.query);
    if (rejectMalformedSubscriptionQuery(reply, query)) {
      return;
    }

    if (rejectUnsafeSubscriptionRequestFieldNames(reply, 'Subscription resume query', query)) {
      return;
    }

    const unsupportedQueryFields = unsupportedRequestFields(
      query,
      SUBSCRIPTION_RESUME_QUERY_KEYS
    );
    if (rejectUnsupportedSubscriptionFields(reply, unsupportedQueryFields)) {
      return;
    }

    const body = normalizeOptionalSubscriptionRequestRecord(request.body);
    if (rejectMalformedSubscriptionBody(reply, body)) {
      return;
    }

    if (rejectUnsafeSubscriptionRequestFieldNames(reply, 'Subscription resume request', body)) {
      return;
    }

    const unsupportedFields = unsupportedRequestFields(
      body,
      SUBSCRIPTION_RESUME_BODY_KEYS
    );
    if (rejectUnsupportedSubscriptionFields(reply, unsupportedFields)) {
      return;
    }

    const subscription = await getSubscriptionService().resumeSubscription(businessId);

    // Log security event
    logSecurityEvent(request.log, `Subscription resumed: ${subscription.tier}`, {
      requestId: request.id,
      userId,
      businessId,
      severity: 'low',
    });

    reply.send({
      success: true,
      data: {
        subscription: {
          id: subscription.id,
          tier: subscription.tier,
          status: subscription.status,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
        },
      },
    });

  });

  /**
   * GET /subscriptions/portal
   * Get Stripe Customer Portal URL for subscription management
   * Authenticated endpoint
   */
  fastify.get('/portal', {
    preHandler: [requireSubscriptions, authenticate],
  }, async (request, reply) => {
    const authenticatedIdentity = normalizeAuthenticatedSubscriptionIdentity(request, reply);
    if (!authenticatedIdentity) {
      return;
    }
    const { businessId } = authenticatedIdentity;

    const query = normalizeOptionalSubscriptionRequestRecord(request.query);
    if (rejectMalformedSubscriptionQuery(reply, query)) {
      return;
    }

    if (rejectUnsafeSubscriptionRequestFieldNames(reply, 'Subscription portal query', query)) {
      return;
    }

    const unsupportedFields = unsupportedRequestFields(
      query,
      SUBSCRIPTION_PORTAL_QUERY_KEYS
    );
    if (rejectUnsupportedSubscriptionFields(reply, unsupportedFields)) {
      return;
    }

    const returnUrl = normalizeRequiredSubscriptionString(
      query.returnUrl
    );

    if (!returnUrl) {
      reply.status(400).send({
        success: false,
        error: {
          code: 'MISSING_RETURN_URL',
          message: 'Return URL is required',
        },
      });
      return;
    }
    if (rejectUnsafeSubscriptionTextField(reply, 'Subscription portal return URL', returnUrl)) {
      return;
    }

    if (!isValidSubscriptionPortalReturnUrl(returnUrl)) {
      reply.status(400).send({
        success: false,
        error: {
          code: 'INVALID_RETURN_URL',
          message: 'Return URL must be an absolute HTTP(S) URL without credentials and at most 2048 characters',
        },
      });
      return;
    }

    const portalUrl = await getSubscriptionService().createPortalSession(businessId, returnUrl);

    reply.send({
      success: true,
      data: { portalUrl },
    });

  });

  /**
   * GET /subscriptions/usage
   * Get current usage vs. limits
   * Authenticated endpoint
   */
  fastify.get('/usage', {
    preHandler: [requireSubscriptions, authenticate],
  }, async (request, reply) => {
    const authenticatedIdentity = normalizeAuthenticatedSubscriptionIdentity(request, reply);
    if (!authenticatedIdentity) {
      return;
    }
    const { businessId } = authenticatedIdentity;

    const query = normalizeOptionalSubscriptionRequestRecord(request.query);
    if (rejectMalformedSubscriptionQuery(reply, query)) {
      return;
    }

    if (rejectUnsafeSubscriptionRequestFieldNames(reply, 'Subscription usage query', query)) {
      return;
    }

    const unsupportedFields = unsupportedRequestFields(
      query,
      SUBSCRIPTION_READ_QUERY_KEYS
    );
    if (rejectUnsupportedSubscriptionFields(reply, unsupportedFields)) {
      return;
    }

    const usage = await getSubscriptionService().checkOrderLimit(businessId);

    reply.send({
      success: true,
      data: { usage },
    });

  });

  /**
   * POST /subscriptions/webhook
   * Handle Stripe subscription webhook events
   * Public endpoint (called by Stripe)
   */
  fastify.post('/webhook', {
    config: {
      rawBody: true,
    },
  }, async (request, reply) => {
    const query = normalizeOptionalSubscriptionRequestRecord(request.query);
    if (rejectMalformedSubscriptionQuery(reply, query)) {
      return;
    }

    if (rejectUnsafeSubscriptionRequestFieldNames(reply, 'Subscription webhook query', query)) {
      return;
    }

    const unsupportedQueryFields = unsupportedRequestFields(
      query,
      SUBSCRIPTION_WEBHOOK_QUERY_KEYS
    );
    if (rejectUnsupportedSubscriptionFields(reply, unsupportedQueryFields)) {
      return;
    }

    const signature = request.headers['stripe-signature'];

    if (!signature || typeof signature !== 'string') {
      reply.status(400).send({
        success: false,
        error: {
          code: 'MISSING_SIGNATURE',
          message: 'Stripe signature header is required',
        },
      });
      return;
    }
    if (
      rejectUnsafeSubscriptionTextField(reply, 'Stripe subscription signature', signature) ||
      rejectOversizedSubscriptionTextField(
        reply,
        'Stripe subscription signature',
        signature,
        MAX_SUBSCRIPTION_WEBHOOK_SIGNATURE_CHARS
      )
    ) {
      return;
    }
    const rawBody = getExactSubscriptionWebhookBody(request as any);

    // Construct and verify webhook event
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET_SUBSCRIPTIONS;
    if (!webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET_SUBSCRIPTIONS not configured');
    }

    const service = getSubscriptionService();
    const stripe = (service as any).stripe;
    const event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);

    let eventId: string;
    try {
      eventId = normalizeSubscriptionWebhookEventId(event.id);
    } catch (error) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'INVALID_SUBSCRIPTION_TEXT_FIELD',
          message:
            error instanceof Error
              ? error.message
              : 'Stripe subscription webhook event id is invalid',
        },
      });
    }

    let eventType: string;
    try {
      eventType = normalizeSubscriptionWebhookEventType(event.type);
    } catch (error) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'INVALID_SUBSCRIPTION_TEXT_FIELD',
          message:
            error instanceof Error
              ? error.message
              : 'Stripe subscription webhook event type is invalid',
        },
      });
    }

    const firstReceipt = recordSubscriptionEventOnce(eventId);
    if (!firstReceipt) {
      return reply.send({
        success: true,
        data: {
          processed: false,
          duplicate: true,
          eventType,
          eventId,
        },
      });
    }

    // Process subscription event
    try {
      await service.handleSubscriptionWebhook({ ...event, type: eventType } as any);
    } catch (error) {
      releaseSubscriptionEventReceipt(eventId);
      throw error;
    }

    // Log webhook processing
    logSecurityEvent(request.log, `Subscription webhook processed: ${eventType}`, {
      requestId: request.id,
      method: request.method,
      path: request.url,
      severity: 'low',
    });

    reply.send({
      success: true,
      data: {
        processed: true,
        eventType,
        eventId,
      },
    });

  });
}
