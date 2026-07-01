import { FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/auth.js';
import { POSSyncService } from '../services/POSSyncService.js';
import { POSProvider, SyncStatus } from '../models/POSIntegration.js';
import { Business } from '../models/Business.js';
import { Order } from '../models/Order.js';
import { requireCapability } from '../config/capabilities.js';

const POS_CONNECT_BODY_FIELDS = new Set([
  'business_id',
  'provider',
  'access_token',
  'refresh_token',
  'token_expires_at',
  'location_id',
  'merchant_id',
]);
const POS_DISCONNECT_BODY_FIELDS = new Set(['business_id']);
const POS_CONNECT_QUERY_FIELDS = new Set<string>();
const POS_DISCONNECT_QUERY_FIELDS = new Set<string>();
const POS_INTEGRATION_QUERY_FIELDS = new Set<string>();
const POS_SYNC_BODY_FIELDS = new Set<string>();
const POS_SYNC_QUERY_FIELDS = new Set<string>();
const POS_HISTORY_QUERY_FIELDS = new Set(['limit', 'offset', 'status']);
const POS_STATS_QUERY_FIELDS = new Set<string>();
const VALID_POS_SYNC_STATUSES = new Set<SyncStatus>(['pending', 'syncing', 'success', 'failed', 'retry']);
const LAUNCH_POS_PROVIDER: POSProvider = 'square';
const DEFAULT_POS_HISTORY_LIMIT = 50;
const MAX_POS_HISTORY_LIMIT = 100;
const MAX_POS_ROUTE_ID_CHARS = 255;
const MAX_POS_USER_ID_CHARS = 255;
const MAX_POS_CREDENTIAL_TEXT_CHARS = 2048;
const MAX_POS_PROVIDER_ACCOUNT_ID_CHARS = 255;
const UNSAFE_POS_ROUTE_TEXT_CONTROLS =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/u;

interface NormalizedPosHistoryQuery {
  limit?: number;
  offset?: number;
  status?: SyncStatus;
}

function unsupportedPosRequestFields(body: unknown, allowedFields: Set<string>): string[] {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return [];
  }

  return Object.keys(body as Record<string, unknown>)
    .filter((field) => !allowedFields.has(field))
    .sort();
}

function normalizePosRequestBodyRecord(body: unknown): Record<string, unknown> | null {
  if (body === undefined || body === null) {
    return {};
  }

  if (typeof body !== 'object' || Array.isArray(body)) {
    return null;
  }

  return body as Record<string, unknown>;
}

function normalizeOptionalPosBodyRecord(body: unknown): Record<string, unknown> | null {
  if (body === undefined || body === null) {
    return {};
  }

  if (typeof body !== 'object' || Array.isArray(body)) {
    return null;
  }

  return body as Record<string, unknown>;
}

function normalizePosParamsRecord(params: unknown): Record<string, unknown> {
  if (!params || typeof params !== 'object' || Array.isArray(params)) {
    return {};
  }

  return params as Record<string, unknown>;
}

function normalizeAuthenticatedPosUserId(user: unknown): string | null {
  if (!user || typeof user !== 'object') {
    return null;
  }

  return normalizeRequiredPosString((user as { userId?: unknown; id?: unknown }).userId) ??
    normalizeRequiredPosString((user as { userId?: unknown; id?: unknown }).id);
}

function rejectInvalidAuthenticatedPosUserId(
  reply: { status: (statusCode: number) => { send: (payload: unknown) => unknown } },
  user: unknown
): string | null {
  const userId = normalizeAuthenticatedPosUserId(user);
  if (!userId) {
    reply.status(400).send({
      success: false,
      error: {
        code: 'INVALID_POS_USER',
        message: 'Authenticated POS user ID is required',
      },
    });
    return null;
  }

  if (rejectUnsafePosTextField(reply, 'POS user ID', userId)) {
    return null;
  }

  if (rejectOversizedPosTextField(reply, 'POS user ID', userId, MAX_POS_USER_ID_CHARS)) {
    return null;
  }

  return userId;
}

function normalizeOptionalPosQueryRecord(query: unknown): Record<string, unknown> | null {
  if (query === undefined || query === null) {
    return {};
  }

  if (typeof query !== 'object' || Array.isArray(query)) {
    return null;
  }

  return query as Record<string, unknown>;
}

function rejectUnsupportedPosFields(
  reply: { status: (statusCode: number) => { send: (payload: unknown) => unknown } },
  fields: string[]
): boolean {
  if (fields.length === 0) {
    return false;
  }

  reply.status(400).send({
    success: false,
    error: {
      code: 'UNSUPPORTED_POS_FIELD',
      message: `Unsupported POS request field(s): ${fields.join(', ')}`,
    },
  });
  return true;
}

function rejectUnsafePosRequestFieldNames(
  reply: { status: (statusCode: number) => { send: (payload: unknown) => unknown } },
  label: string,
  record: Record<string, unknown>
): boolean {
  if (!Object.keys(record).some(hasUnsafePosRouteTextControls)) {
    return false;
  }

  reply.status(400).send({
    success: false,
    error: {
      code: 'INVALID_POS_FIELD_NAME',
      message: `${label} field names must not include unsafe control characters`,
    },
  });
  return true;
}

function rejectMalformedPosBody(
  reply: { status: (statusCode: number) => { send: (payload: unknown) => unknown } },
  body: Record<string, unknown> | null
): body is null {
  if (body !== null) {
    return false;
  }

  reply.status(400).send({
    success: false,
    error: {
      code: 'INVALID_POS_REQUEST_BODY',
      message: 'POS request body must be an object',
    },
  });
  return true;
}

function rejectUnsupportedPosQueryFields(
  reply: { status: (statusCode: number) => { send: (payload: unknown) => unknown } },
  fields: string[]
): boolean {
  if (fields.length === 0) {
    return false;
  }

  reply.status(400).send({
    success: false,
    error: {
      code: 'UNSUPPORTED_POS_QUERY_FIELD',
      message: `Unsupported POS query field(s): ${fields.join(', ')}`,
    },
  });
  return true;
}

function hasUnsafePosRouteTextControls(value: string): boolean {
  return UNSAFE_POS_ROUTE_TEXT_CONTROLS.test(value);
}

export function normalizeRequiredPosString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  if (hasUnsafePosRouteTextControls(value)) {
    return value;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function rejectUnsafePosTextField(
  reply: { status: (statusCode: number) => { send: (payload: unknown) => unknown } },
  label: string,
  value: string | undefined | null
): boolean {
  if (value === undefined || value === null || !UNSAFE_POS_ROUTE_TEXT_CONTROLS.test(value)) {
    return false;
  }

  reply.status(400).send({
    success: false,
    error: {
      code: 'INVALID_POS_TEXT_FIELD',
      message: `${label} must not include unsafe control characters`,
    },
  });
  return true;
}

function rejectOversizedPosTextField(
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
      code: 'INVALID_POS_TEXT_FIELD',
      message: `${label} must be at most ${maxChars} characters`,
    },
  });
  return true;
}

function normalizeOptionalPosString(value: unknown): string | undefined | null {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== 'string') {
    return null;
  }

  return normalizeRequiredPosString(value) ?? undefined;
}

function normalizeLaunchPosProvider(value: unknown): POSProvider | undefined | null {
  const normalized = normalizeRequiredPosString(value);
  if (!normalized) {
    return null;
  }

  const provider = normalized.toLowerCase();
  return provider === LAUNCH_POS_PROVIDER ? LAUNCH_POS_PROVIDER : undefined;
}

function normalizePaginationMetadata(value: unknown, defaultValue: number): number {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }
  return Number(value);
}

function parseOptionalBoundedPositiveInteger(
  label: string,
  value: unknown,
  maxValue: number
): number | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value === 'string' && hasUnsafePosRouteTextControls(value)) {
    throw new Error(`${label} must not include unsafe control characters`);
  }

  const numeric = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;

  if (typeof numeric !== 'number' || !Number.isInteger(numeric)) {
    throw new Error(`${label} must be an integer`);
  }

  if (!Number.isSafeInteger(numeric)) {
    throw new Error(`${label} must be a safe integer`);
  }

  if (numeric <= 0 || numeric > maxValue) {
    throw new Error(`${label} must be between 1 and ${maxValue}`);
  }

  return numeric;
}

function parseOptionalNonNegativeInteger(label: string, value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value === 'string' && hasUnsafePosRouteTextControls(value)) {
    throw new Error(`${label} must not include unsafe control characters`);
  }

  const numeric = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;

  if (typeof numeric !== 'number' || !Number.isInteger(numeric)) {
    throw new Error(`${label} must be an integer`);
  }

  if (!Number.isSafeInteger(numeric)) {
    throw new Error(`${label} must be a safe integer`);
  }

  if (numeric < 0) {
    throw new Error(`${label} must be non-negative`);
  }

  return numeric;
}

export function parseOptionalSyncStatus(label: string, value: unknown): SyncStatus | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${label} has an invalid status`);
  }

  if (hasUnsafePosRouteTextControls(value)) {
    throw new Error(`${label} must not include unsafe control characters`);
  }

  const normalized = value.trim().toLowerCase() as SyncStatus;
  if (!VALID_POS_SYNC_STATUSES.has(normalized)) {
    throw new Error(`${label} has an invalid status`);
  }

  return normalized;
}

function normalizePosHistoryQuery(query: unknown): NormalizedPosHistoryQuery {
  if (query !== undefined && query !== null && (typeof query !== 'object' || Array.isArray(query))) {
    throw new Error('POS sync history query must be an object');
  }

  const queryRecord = (query ?? {}) as Record<string, unknown>;
  return {
    limit: parseOptionalBoundedPositiveInteger(
      'POS sync history limit',
      queryRecord.limit,
      MAX_POS_HISTORY_LIMIT
    ),
    offset: parseOptionalNonNegativeInteger('POS sync history offset', queryRecord.offset),
    status: parseOptionalSyncStatus('POS sync history status', queryRecord.status),
  };
}

function parseOptionalTokenExpiry(value: string | undefined): Date | undefined | null {
  if (value === undefined || value === null || value.trim() === '') {
    return undefined;
  }

  const parsed = new Date(value.trim());
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

/**
 * POS Integration Routes
 * Phase 3 - US3.7: POS System Integration & Order Sync
 *
 * Endpoints:
 * - POST /pos/connect - Connect POS system
 * - POST /pos/disconnect - Disconnect POS system
 * - GET /pos/integration/:businessId - Get integration settings
 * - POST /pos/sync/:orderId - Manually sync order
 * - GET /pos/history/:businessId - Get sync history
 * - GET /pos/stats/:businessId - Get sync statistics
 */
export async function posRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook?.('onRequest', requireCapability('pos_sync'));

  let posSyncService: POSSyncService | null = null;
  const getPosSyncService = (): POSSyncService => {
    posSyncService ??= new POSSyncService();
    return posSyncService;
  };

  /**
   * POST /pos/connect
   * Connect POS system (after OAuth)
   */
  fastify.post<{
    Body: {
      business_id: string;
      provider: POSProvider;
      access_token: string;
      refresh_token?: string;
      token_expires_at?: string;
      location_id?: string;
      merchant_id?: string;
    };
  }>(
    '/connect',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const authenticatedUserId = rejectInvalidAuthenticatedPosUserId(reply, request.user);
      if (!authenticatedUserId) {
        return;
      }

      const body = normalizePosRequestBodyRecord(request.body);
      if (rejectMalformedPosBody(reply, body)) {
        return;
      }

      const query = normalizeOptionalPosQueryRecord(request.query);
      if (query === null) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'INVALID_POS_CONNECT_QUERY',
            message: 'POS connect query must be an object',
          },
        });
      }

      if (rejectUnsafePosRequestFieldNames(reply, 'POS connect query', query)) {
        return;
      }
      const unsupportedQueryFields = unsupportedPosRequestFields(query, POS_CONNECT_QUERY_FIELDS);
      if (rejectUnsupportedPosQueryFields(reply, unsupportedQueryFields)) {
        return;
      }

      const {
        business_id,
        provider,
        access_token,
        refresh_token,
        token_expires_at,
        location_id,
        merchant_id,
      } = body;
      if (rejectUnsafePosRequestFieldNames(reply, 'POS connect request', body)) {
        return;
      }
      const unsupportedFields = unsupportedPosRequestFields(body, POS_CONNECT_BODY_FIELDS);
      if (rejectUnsupportedPosFields(reply, unsupportedFields)) {
        return;
      }

      const normalizedBusinessId = normalizeRequiredPosString(business_id);
      const normalizedProvider = normalizeLaunchPosProvider(provider);
      const normalizedAccessToken = normalizeRequiredPosString(access_token);
      const normalizedRefreshToken = normalizeOptionalPosString(refresh_token);
      const normalizedTokenExpiresAt = normalizeOptionalPosString(token_expires_at);
      const normalizedLocationId = normalizeOptionalPosString(location_id);
      const normalizedMerchantId = normalizeOptionalPosString(merchant_id);

      if (!normalizedBusinessId || normalizedProvider === null || !normalizedAccessToken) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'MISSING_PARAMETERS',
            message: 'Business ID, provider, and access token are required',
          },
        });
      }
      if (
        rejectUnsafePosTextField(reply, 'POS business ID', normalizedBusinessId) ||
        rejectUnsafePosTextField(reply, 'POS provider', normalizeRequiredPosString(provider)) ||
        rejectUnsafePosTextField(reply, 'POS access token', normalizedAccessToken) ||
        rejectUnsafePosTextField(reply, 'POS refresh token', normalizedRefreshToken) ||
        rejectUnsafePosTextField(reply, 'POS token expiry', normalizedTokenExpiresAt) ||
        rejectUnsafePosTextField(reply, 'POS location ID', normalizedLocationId) ||
        rejectUnsafePosTextField(reply, 'POS merchant ID', normalizedMerchantId)
      ) {
        return;
      }
      if (
        rejectOversizedPosTextField(
          reply,
          'POS business ID',
          normalizedBusinessId,
          MAX_POS_ROUTE_ID_CHARS
        ) ||
        rejectOversizedPosTextField(
          reply,
          'POS access token',
          normalizedAccessToken,
          MAX_POS_CREDENTIAL_TEXT_CHARS
        ) ||
        rejectOversizedPosTextField(
          reply,
          'POS refresh token',
          normalizedRefreshToken,
          MAX_POS_CREDENTIAL_TEXT_CHARS
        ) ||
        rejectOversizedPosTextField(
          reply,
          'POS location ID',
          normalizedLocationId,
          MAX_POS_PROVIDER_ACCOUNT_ID_CHARS
        ) ||
        rejectOversizedPosTextField(
          reply,
          'POS merchant ID',
          normalizedMerchantId,
          MAX_POS_PROVIDER_ACCOUNT_ID_CHARS
        )
      ) {
        return;
      }
      if (
        normalizedRefreshToken === null ||
        normalizedTokenExpiresAt === null ||
        normalizedLocationId === null ||
        normalizedMerchantId === null
      ) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'INVALID_POS_CONNECT_METADATA',
            message: 'POS connect optional fields must be strings when provided',
          },
        });
      }

      if (normalizedProvider === undefined) {
        const providerLabel = normalizeRequiredPosString(provider) ?? 'unknown';
        return reply.status(503).send({
          success: false,
          error: {
            code: 'FEATURE_UNAVAILABLE',
            capability: 'pos_sync',
            message: `POS provider ${providerLabel} is disabled`,
          },
        });
      }
      const tokenExpiry = parseOptionalTokenExpiry(normalizedTokenExpiresAt);
      if (tokenExpiry === null) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'INVALID_TOKEN_EXPIRY',
            message: 'Token expiry must be a valid date when provided',
          },
        });
      }
      if (tokenExpiry !== undefined && tokenExpiry.getTime() <= Date.now()) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'INVALID_TOKEN_EXPIRY',
            message: 'Token expiry must be in the future when provided',
          },
        });
      }
      // Verify business ownership
      const business = await fastify.orm.manager.findOne(Business, {
        where: { id: normalizedBusinessId },
        select: ['id', 'owner_id'],
      });

      if (!business || business.owner_id !== authenticatedUserId) {
        return reply.status(403).send({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'You do not have permission to manage this business',
          },
        });
      }

      const integration = await getPosSyncService().createIntegration(
        normalizedBusinessId,
        normalizedProvider,
        normalizedAccessToken,
        {
          refresh_token: normalizedRefreshToken,
          token_expires_at: tokenExpiry,
          location_id: normalizedLocationId,
          merchant_id: normalizedMerchantId,
        }
      );

      reply.send({
        success: true,
        data: { integration },
        message: `${normalizedProvider} POS integration connected successfully`,
      });
    }
  );

  /**
   * POST /pos/disconnect
   * Disconnect POS system
   */
  fastify.post<{
    Body: { business_id: string };
  }>(
    '/disconnect',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const body = normalizePosRequestBodyRecord(request.body);
      if (rejectMalformedPosBody(reply, body)) {
        return;
      }

      const query = normalizeOptionalPosQueryRecord(request.query);
      if (query === null) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'INVALID_POS_DISCONNECT_QUERY',
            message: 'POS disconnect query must be an object',
          },
        });
      }

      if (rejectUnsafePosRequestFieldNames(reply, 'POS disconnect query', query)) {
        return;
      }
      const unsupportedQueryFields = unsupportedPosRequestFields(query, POS_DISCONNECT_QUERY_FIELDS);
      if (rejectUnsupportedPosQueryFields(reply, unsupportedQueryFields)) {
        return;
      }

      const { business_id } = body;
      if (rejectUnsafePosRequestFieldNames(reply, 'POS disconnect request', body)) {
        return;
      }
      const unsupportedFields = unsupportedPosRequestFields(body, POS_DISCONNECT_BODY_FIELDS);
      if (rejectUnsupportedPosFields(reply, unsupportedFields)) {
        return;
      }

      const normalizedBusinessId = normalizeRequiredPosString(business_id);

      if (!normalizedBusinessId) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'MISSING_PARAMETERS',
            message: 'Business ID is required',
          },
        });
      }
      if (rejectUnsafePosTextField(reply, 'POS business ID', normalizedBusinessId)) {
        return;
      }
      if (
        rejectOversizedPosTextField(
          reply,
          'POS business ID',
          normalizedBusinessId,
          MAX_POS_ROUTE_ID_CHARS
        )
      ) {
        return;
      }
      const authenticatedUserId = rejectInvalidAuthenticatedPosUserId(reply, request.user);
      if (!authenticatedUserId) {
        return;
      }

      // Verify business ownership
      const business = await fastify.orm.manager.findOne(Business, {
        where: { id: normalizedBusinessId },
        select: ['id', 'owner_id'],
      });

      if (!business || business.owner_id !== authenticatedUserId) {
        return reply.status(403).send({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'You do not have permission to manage this business',
          },
        });
      }

      await getPosSyncService().disconnectIntegration(normalizedBusinessId);

      reply.send({
        success: true,
        message: 'POS integration disconnected successfully',
      });
    }
  );

  /**
   * GET /pos/integration/:businessId
   * Get POS integration settings
   */
  fastify.get<{
    Params: { businessId: string };
  }>(
    '/integration/:businessId',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const { businessId } = normalizePosParamsRecord(request.params);
      const normalizedBusinessId = normalizeRequiredPosString(businessId);

      if (!normalizedBusinessId) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'MISSING_PARAMETERS',
            message: 'Business ID is required',
          },
        });
      }
      if (rejectUnsafePosTextField(reply, 'POS business ID', normalizedBusinessId)) {
        return;
      }
      if (
        rejectOversizedPosTextField(
          reply,
          'POS business ID',
          normalizedBusinessId,
          MAX_POS_ROUTE_ID_CHARS
        )
      ) {
        return;
      }

      const query = normalizeOptionalPosQueryRecord(request.query);
      if (query === null) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'INVALID_POS_INTEGRATION_QUERY',
            message: 'POS integration query must be an object',
          },
        });
      }

      if (rejectUnsafePosRequestFieldNames(reply, 'POS integration query', query)) {
        return;
      }
      const unsupportedFields = unsupportedPosRequestFields(query, POS_INTEGRATION_QUERY_FIELDS);
      if (rejectUnsupportedPosQueryFields(reply, unsupportedFields)) {
        return;
      }
      const authenticatedUserId = rejectInvalidAuthenticatedPosUserId(reply, request.user);
      if (!authenticatedUserId) {
        return;
      }

      // Verify business ownership
      const business = await fastify.orm.manager.findOne(Business, {
        where: { id: normalizedBusinessId },
        select: ['id', 'owner_id'],
      });

      if (!business || business.owner_id !== authenticatedUserId) {
        return reply.status(403).send({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'You do not have permission to view this integration',
          },
        });
      }

      const integration = await getPosSyncService().getIntegration(normalizedBusinessId);

      if (!integration) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'INTEGRATION_NOT_FOUND',
            message: 'No active POS integration found',
          },
        });
      }

      // Don't return sensitive tokens
      const safeIntegration = {
        id: integration.id,
        provider: integration.provider,
        is_active: integration.is_active,
        location_id: integration.location_id,
        merchant_id: integration.merchant_id,
        auto_sync_orders: integration.auto_sync_orders,
        sync_customer_info: integration.sync_customer_info,
        last_sync_at: integration.last_sync_at,
        error_count: integration.error_count,
        last_error: integration.last_error,
        created_at: integration.created_at,
      };

      reply.send({
        success: true,
        data: { integration: safeIntegration },
      });
    }
  );

  /**
   * POST /pos/sync/:orderId
   * Manually trigger order sync to POS
   */
  fastify.post<{
    Params: { orderId: string };
  }>(
    '/sync/:orderId',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      try {
        const { orderId } = normalizePosParamsRecord(request.params);
        const normalizedOrderId = normalizeRequiredPosString(orderId);

        if (!normalizedOrderId) {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'MISSING_PARAMETERS',
              message: 'Order ID is required',
            },
          });
        }
        if (rejectUnsafePosTextField(reply, 'POS order ID', normalizedOrderId)) {
          return;
        }
        if (
          rejectOversizedPosTextField(
            reply,
            'POS order ID',
            normalizedOrderId,
            MAX_POS_ROUTE_ID_CHARS
          )
        ) {
          return;
        }

        const body = normalizeOptionalPosBodyRecord(request.body);
        if (body === null) {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'INVALID_POS_SYNC_BODY',
              message: 'POS sync body must be an object',
            },
          });
        }

        if (rejectUnsafePosRequestFieldNames(reply, 'POS sync request', body)) {
          return;
        }
        const unsupportedBodyFields = unsupportedPosRequestFields(body, POS_SYNC_BODY_FIELDS);
        if (rejectUnsupportedPosFields(reply, unsupportedBodyFields)) {
          return;
        }

        const query = normalizeOptionalPosQueryRecord(request.query);
        if (query === null) {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'INVALID_POS_SYNC_QUERY',
              message: 'POS sync query must be an object',
            },
          });
        }

        if (rejectUnsafePosRequestFieldNames(reply, 'POS sync query', query)) {
          return;
        }
        const unsupportedQueryFields = unsupportedPosRequestFields(query, POS_SYNC_QUERY_FIELDS);
        if (rejectUnsupportedPosQueryFields(reply, unsupportedQueryFields)) {
          return;
        }
        const authenticatedUserId = rejectInvalidAuthenticatedPosUserId(reply, request.user);
        if (!authenticatedUserId) {
          return;
        }

        // Get order to verify ownership
        const order = await fastify.orm.manager.findOne(Order, {
          where: { id: normalizedOrderId },
          select: ['id', 'business_id'],
        });

        if (!order) {
          return reply.status(404).send({
            success: false,
            error: {
              code: 'ORDER_NOT_FOUND',
              message: 'Order not found',
            },
          });
        }

        // Verify business ownership
        const business = await fastify.orm.manager.findOne(Business, {
          where: { id: order.business_id },
          select: ['id', 'owner_id'],
        });

        if (!business || business.owner_id !== authenticatedUserId) {
          return reply.status(403).send({
            success: false,
            error: {
              code: 'FORBIDDEN',
              message: 'You do not have permission to sync this order',
            },
          });
        }

        const syncLog = await getPosSyncService().syncOrder(normalizedOrderId);

        reply.send({
          success: true,
          data: { syncLog },
          message: 'Order sync initiated',
        });
      } catch (error) {
        if (error instanceof Error && error.message.includes('No active POS integration')) {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'NO_POS_INTEGRATION',
              message: error.message,
            },
          });
        }
        throw error;
      }
    }
  );

  /**
   * GET /pos/history/:businessId
   * Get sync history
   */
  fastify.get<{
    Params: { businessId: string };
    Querystring: {
      limit?: number;
      offset?: number;
      status?: SyncStatus;
    };
  }>(
    '/history/:businessId',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const { businessId } = normalizePosParamsRecord(request.params);
      const normalizedBusinessId = normalizeRequiredPosString(businessId);
      if (!normalizedBusinessId) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'MISSING_PARAMETERS',
            message: 'Business ID is required',
          },
        });
      }
      if (rejectUnsafePosTextField(reply, 'POS business ID', normalizedBusinessId)) {
        return;
      }
      if (
        rejectOversizedPosTextField(
          reply,
          'POS business ID',
          normalizedBusinessId,
          MAX_POS_ROUTE_ID_CHARS
        )
      ) {
        return;
      }

      const query = normalizeOptionalPosQueryRecord(request.query);
      if (query === null) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'INVALID_POS_HISTORY_QUERY',
            message: 'POS sync history query must be an object',
          },
        });
      }

      if (rejectUnsafePosRequestFieldNames(reply, 'POS sync history query', query)) {
        return;
      }
      const unsupportedFields = unsupportedPosRequestFields(query, POS_HISTORY_QUERY_FIELDS);
      if (rejectUnsupportedPosFields(reply, unsupportedFields)) {
        return;
      }
      if (rejectUnsafePosTextField(
        reply,
        'POS sync history status',
        typeof query.status === 'string' ? query.status.trim() : undefined
      )) {
        return;
      }

      let historyQuery: NormalizedPosHistoryQuery;
      try {
        historyQuery = normalizePosHistoryQuery(query);
      } catch (error) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'INVALID_POS_HISTORY_QUERY',
            message: error instanceof Error ? error.message : 'Invalid POS sync history query',
          },
        });
      }
      const authenticatedUserId = rejectInvalidAuthenticatedPosUserId(reply, request.user);
      if (!authenticatedUserId) {
        return;
      }

      // Verify business ownership
      const business = await fastify.orm.manager.findOne(Business, {
        where: { id: normalizedBusinessId },
        select: ['id', 'owner_id'],
      });

      if (!business || business.owner_id !== authenticatedUserId) {
        return reply.status(403).send({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'You do not have permission to view this history',
          },
        });
      }

      const { logs, total } = await getPosSyncService().getSyncHistory(normalizedBusinessId, {
        ...historyQuery,
      });

      reply.send({
        success: true,
        data: {
          logs,
          total,
          limit: normalizePaginationMetadata(historyQuery.limit, DEFAULT_POS_HISTORY_LIMIT),
          offset: normalizePaginationMetadata(historyQuery.offset, 0),
        },
      });
    }
  );

  /**
   * GET /pos/stats/:businessId
   * Get sync statistics
   */
  fastify.get<{
    Params: { businessId: string };
  }>(
    '/stats/:businessId',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const { businessId } = normalizePosParamsRecord(request.params);
      const normalizedBusinessId = normalizeRequiredPosString(businessId);

      if (!normalizedBusinessId) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'MISSING_PARAMETERS',
            message: 'Business ID is required',
          },
        });
      }
      if (rejectUnsafePosTextField(reply, 'POS business ID', normalizedBusinessId)) {
        return;
      }
      if (
        rejectOversizedPosTextField(
          reply,
          'POS business ID',
          normalizedBusinessId,
          MAX_POS_ROUTE_ID_CHARS
        )
      ) {
        return;
      }

      const query = normalizeOptionalPosQueryRecord(request.query);
      if (query === null) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'INVALID_POS_STATS_QUERY',
            message: 'POS sync stats query must be an object',
          },
        });
      }

      if (rejectUnsafePosRequestFieldNames(reply, 'POS sync stats query', query)) {
        return;
      }
      const unsupportedFields = unsupportedPosRequestFields(query, POS_STATS_QUERY_FIELDS);
      if (rejectUnsupportedPosQueryFields(reply, unsupportedFields)) {
        return;
      }
      const authenticatedUserId = rejectInvalidAuthenticatedPosUserId(reply, request.user);
      if (!authenticatedUserId) {
        return;
      }

      // Verify business ownership
      const business = await fastify.orm.manager.findOne(Business, {
        where: { id: normalizedBusinessId },
        select: ['id', 'owner_id'],
      });

      if (!business || business.owner_id !== authenticatedUserId) {
        return reply.status(403).send({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'You do not have permission to view these statistics',
          },
        });
      }

      const stats = await getPosSyncService().getSyncStats(normalizedBusinessId);

      reply.send({
        success: true,
        data: { stats },
      });
    }
  );
}
