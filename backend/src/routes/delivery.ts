import { FastifyPluginAsync } from 'fastify';
import { DeliveryService } from '../services/DeliveryService.js';
import { authenticate } from '../middleware/auth.js';
import { DeliveryProvider, DeliveryCostHandling, DeliveryTracking } from '../models/DeliveryIntegration.js';
import { Business } from '../models/Business.js';
import { Order } from '../models/Order.js';
import { requireCapability } from '../config/capabilities.js';

const DELIVERY_CONNECT_BODY_FIELDS = new Set([
  'business_id',
  'provider',
  'api_key',
  'api_secret',
  'partner_account_id',
  'cost_handling',
  'fixed_delivery_fee_cents',
  'auto_assign_delivery',
  'pickup_instructions',
]);
const DELIVERY_DISCONNECT_BODY_FIELDS = new Set(['business_id']);
const DELIVERY_CREATE_BODY_FIELDS = new Set<string>();
const DELIVERY_CANCEL_BODY_FIELDS = new Set(['reason']);
const DELIVERY_READ_QUERY_FIELDS = new Set<string>();
const DELIVERY_RATING_BODY_FIELDS = new Set([
  'rating',
  'feedback',
  'timeliness_rating',
  'courtesy_rating',
  'packaging_rating',
  'issues',
]);
const DELIVERY_PROVIDERS_ALLOWED = new Set<DeliveryProvider>(['swiggy', 'zomato', 'dunzo']);
const DELIVERY_COST_HANDLING_ALLOWED = new Set<DeliveryCostHandling>(['customer', 'seller']);
const MAX_DELIVERY_ROUTE_ID_CHARS = 255;
const MAX_DELIVERY_ROUTE_TEXT_CHARS = 500;
const MAX_DELIVERY_USER_ID_CHARS = 500;
const MAX_DELIVERY_CREDENTIAL_TEXT_CHARS = 2048;
const MAX_DELIVERY_PARTNER_ACCOUNT_ID_CHARS = 255;
const UNSAFE_DELIVERY_ROUTE_TEXT_CONTROLS =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/u;

function unsupportedDeliveryRequestFields(body: unknown, allowedFields: Set<string>): string[] {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return [];
  }

  return Object.keys(body as Record<string, unknown>)
    .filter((key) => !allowedFields.has(key))
    .sort();
}

function normalizedDeliveryRequestBodyRecord(body: unknown): Record<string, unknown> | null {
  if (body === undefined || body === null) {
    return {};
  }

  if (typeof body !== 'object' || Array.isArray(body)) {
    return null;
  }

  return body as Record<string, unknown>;
}

function normalizedDeliveryQueryRecord(query: unknown): Record<string, unknown> | null {
  if (query === undefined || query === null) {
    return {};
  }

  if (typeof query !== 'object' || Array.isArray(query)) {
    return null;
  }

  return query as Record<string, unknown>;
}

function normalizedDeliveryParamsRecord(params: unknown): Record<string, unknown> {
  if (!params || typeof params !== 'object' || Array.isArray(params)) {
    return {};
  }

  return params as Record<string, unknown>;
}

function normalizedAuthenticatedDeliveryUserId(user: unknown): string | null {
  if (!user || typeof user !== 'object') {
    return null;
  }

  const userRecord = user as { userId?: unknown; id?: unknown };
  return normalizedRequiredDeliveryString(userRecord.userId) ??
    normalizedRequiredDeliveryString(userRecord.id);
}

function hasUnsafeDeliveryRouteTextControls(value: string): boolean {
  return UNSAFE_DELIVERY_ROUTE_TEXT_CONTROLS.test(value);
}

export function normalizedRequiredDeliveryString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  if (hasUnsafeDeliveryRouteTextControls(value)) {
    return value;
  }

  if (!value.trim()) {
    return null;
  }

  return value.trim();
}

function rejectUnsafeDeliveryTextField(
  reply: { status: (statusCode: number) => { send: (payload: unknown) => unknown } },
  label: string,
  value: string | undefined | null
): boolean {
  if (value === undefined || value === null || !UNSAFE_DELIVERY_ROUTE_TEXT_CONTROLS.test(value)) {
    return false;
  }

  reply.status(400).send({
    success: false,
    error: {
      code: 'INVALID_DELIVERY_TEXT_FIELD',
      message: `${label} must not include unsafe control characters`,
    },
  });
  return true;
}

function rejectOversizedDeliveryTextField(
  reply: { status: (statusCode: number) => { send: (payload: unknown) => unknown } },
  label: string,
  value: string | undefined | null,
  maxChars = MAX_DELIVERY_ROUTE_TEXT_CHARS
): boolean {
  if (value === undefined || value === null || value.length <= maxChars) {
    return false;
  }

  reply.status(400).send({
    success: false,
    error: {
      code: 'INVALID_DELIVERY_TEXT_FIELD',
      message: `${label} must be at most ${maxChars} characters`,
    },
  });
  return true;
}

function rejectUnsafeDeliveryRequestFieldNames(
  reply: { status: (statusCode: number) => { send: (payload: unknown) => unknown } },
  label: string,
  record: Record<string, unknown>
): boolean {
  if (!Object.keys(record).some(hasUnsafeDeliveryRouteTextControls)) {
    return false;
  }

  reply.status(400).send({
    success: false,
    error: {
      code: 'INVALID_DELIVERY_FIELD_NAME',
      message: `${label} field names must not include unsafe control characters`,
    },
  });
  return true;
}

function rejectInvalidAuthenticatedDeliveryUserId(
  reply: { status: (statusCode: number) => { send: (payload: unknown) => unknown } },
  user: unknown
): string | null {
  const userId = normalizedAuthenticatedDeliveryUserId(user);
  if (userId === null) {
    reply.status(400).send({
      success: false,
      error: {
        code: 'INVALID_DELIVERY_USER',
        message: 'Authenticated delivery user ID is required',
      },
    });
    return null;
  }

  if (
    rejectUnsafeDeliveryTextField(reply, 'Delivery user ID', userId) ||
    rejectOversizedDeliveryTextField(reply, 'Delivery user ID', userId, MAX_DELIVERY_USER_ID_CHARS)
  ) {
    return null;
  }

  return userId;
}

function normalizedOptionalDeliveryString(value: unknown): string | undefined | null {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== 'string') {
    return null;
  }

  return normalizedRequiredDeliveryString(value) ?? undefined;
}

function parseOptionalNonNegativeDeliveryInteger(value: unknown): number | undefined | null {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    !Number.isSafeInteger(value) ||
    value < 0
  ) {
    return null;
  }

  return value;
}

function normalizedOptionalDeliveryBoolean(value: unknown): boolean | undefined | null {
  if (value === undefined || value === null) {
    return undefined;
  }

  return typeof value === 'boolean' ? value : null;
}

function parseOptionalDeliveryRatingScore(value: unknown, required = false): number | undefined | null {
  if (value === undefined || value === null || value === '') {
    return required ? null : undefined;
  }

  if (typeof value === 'string' && hasUnsafeDeliveryRouteTextControls(value)) {
    return null;
  }

  const numeric =
    typeof value === 'string' && /^\d+$/.test(value.trim()) ? Number(value.trim()) : value;

  if (
    typeof numeric !== 'number' ||
    !Number.isInteger(numeric) ||
    !Number.isSafeInteger(numeric) ||
    numeric < 1 ||
    numeric > 5
  ) {
    return null;
  }

  return numeric;
}

export function normalizedOptionalDeliveryRatingText(value: unknown): string | undefined | null {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== 'string') {
    return null;
  }

  if (hasUnsafeDeliveryRouteTextControls(value)) {
    return value;
  }

  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= 500 ? normalized : null;
}

function normalizedOptionalDeliveryRatingIssues(value: unknown): string[] | undefined | null {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    return null;
  }

  const normalizedIssues: string[] = [];
  const seenIssues = new Set<string>();
  for (const issue of value) {
    const normalizedIssue = normalizedRequiredDeliveryString(issue);
    if (!normalizedIssue) {
      return null;
    }

    if (
      !hasUnsafeDeliveryRouteTextControls(normalizedIssue) &&
      normalizedIssue.length > MAX_DELIVERY_ROUTE_TEXT_CHARS
    ) {
      return null;
    }

    const dedupeKey = normalizedIssue.toLowerCase();
    if (seenIssues.has(dedupeKey)) {
      continue;
    }

    seenIssues.add(dedupeKey);
    normalizedIssues.push(normalizedIssue);
  }

  return normalizedIssues;
}

function missingDeliveryParameterResponse(
  reply: { status: (statusCode: number) => { send: (payload: unknown) => unknown } },
  message: string
): unknown {
  return reply.status(400).send({
    success: false,
    error: {
      code: 'MISSING_PARAMETERS',
      message,
    },
  });
}

function rejectInvalidDeliveryReadQuery(
  reply: { status: (statusCode: number) => { send: (payload: unknown) => unknown } },
  value: unknown
): boolean {
  const query = normalizedDeliveryQueryRecord(value);

  if (query === null) {
    reply.status(400).send({
      success: false,
      error: {
        code: 'INVALID_DELIVERY_QUERY',
        message: 'Delivery query must be an object',
      },
    });
    return true;
  }

  if (rejectUnsafeDeliveryRequestFieldNames(reply, 'Delivery query', query)) {
    return true;
  }

  const unsupportedFields = unsupportedDeliveryRequestFields(query, DELIVERY_READ_QUERY_FIELDS);
  if (unsupportedFields.length > 0) {
    reply.status(400).send({
      success: false,
      error: {
        code: 'UNSUPPORTED_DELIVERY_QUERY_FIELD',
        message: `Unsupported delivery query field(s): ${unsupportedFields.join(', ')}`,
      },
    });
    return true;
  }

  return false;
}

function invalidDeliveryRequestBodyResponse(
  reply: { status: (statusCode: number) => { send: (payload: unknown) => unknown } }
): unknown {
  return reply.status(400).send({
    success: false,
    error: {
      code: 'INVALID_DELIVERY_REQUEST_BODY',
      message: 'Delivery request body must be an object',
    },
  });
}

export const deliveryRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook?.('onRequest', requireCapability('delivery_partner'));

  let deliveryService: DeliveryService | null = null;
  const getDeliveryService = (): DeliveryService => {
    deliveryService ??= new DeliveryService();
    return deliveryService;
  };

  const verifyDeliveryBusinessOwnership = async (
    businessId: string,
    userId: string,
    reply: { status: (statusCode: number) => { send: (payload: unknown) => unknown } },
    message: string
  ): Promise<boolean> => {
    const business = await fastify.orm.manager.findOne(Business, {
      where: { id: businessId },
      select: ['id', 'owner_id'],
    });

    if (!business || business.owner_id !== userId) {
      reply.status(403).send({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message,
        },
      });
      return false;
    }

    return true;
  };

  const findDeliveryOrderForAuthorization = async (
    orderId: string,
    reply: { status: (statusCode: number) => { send: (payload: unknown) => unknown } }
  ): Promise<{ id: string; business_id: string; customer_id?: string | null } | null> => {
    const order = await fastify.orm.manager.findOne(Order, {
      where: { id: orderId },
      select: ['id', 'business_id', 'customer_id'],
    });

    if (!order) {
      reply.status(404).send({
        success: false,
        error: {
          code: 'ORDER_NOT_FOUND',
          message: 'Order not found',
        },
      });
      return null;
    }

    return {
      id: order.id,
      business_id: order.business_id,
      customer_id: order.customer_id ?? null,
    };
  };

  const verifyDeliveryOrderAuthorization = async (
    orderId: string,
    userId: string,
    reply: { status: (statusCode: number) => { send: (payload: unknown) => unknown } },
    message: string,
    options: { allowCustomer?: boolean } = {}
  ): Promise<boolean> => {
    const order = await findDeliveryOrderForAuthorization(orderId, reply);
    if (!order) {
      return false;
    }

    const business = await fastify.orm.manager.findOne(Business, {
      where: { id: order.business_id },
      select: ['id', 'owner_id'],
    });

    if (business?.owner_id === userId) {
      return true;
    }

    if (options.allowCustomer && order.customer_id === userId) {
      return true;
    }

    reply.status(403).send({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message,
      },
    });
    return false;
  };

  const verifyDeliveryTrackingSellerAuthorization = async (
    trackingId: string,
    userId: string,
    reply: { status: (statusCode: number) => { send: (payload: unknown) => unknown } }
  ): Promise<boolean> => {
    const tracking = await fastify.orm.manager.findOne(DeliveryTracking, {
      where: { id: trackingId },
      select: ['id', 'order_id'],
    });

    if (!tracking) {
      reply.status(404).send({
        success: false,
        error: {
          code: 'TRACKING_NOT_FOUND',
          message: 'Delivery tracking not found',
        },
      });
      return false;
    }

    return verifyDeliveryOrderAuthorization(
      tracking.order_id,
      userId,
      reply,
      'You do not have permission to cancel this delivery'
    );
  };

  /**
   * Connect delivery provider
   * POST /delivery/connect
   */
  fastify.post(
    '/connect',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Connect delivery provider',
        tags: ['delivery'],
        body: {
          type: 'object',
          required: ['business_id', 'provider', 'api_key', 'partner_account_id', 'cost_handling'],
          properties: {
            business_id: { type: 'string', format: 'uuid' },
            provider: { type: 'string', enum: ['swiggy', 'zomato', 'dunzo'] },
            api_key: { type: 'string' },
            api_secret: { type: 'string' },
            partner_account_id: { type: 'string' },
            cost_handling: { type: 'string', enum: ['customer', 'seller'] },
            fixed_delivery_fee_cents: { type: 'integer', minimum: 0 },
            auto_assign_delivery: { type: 'boolean' },
            pickup_instructions: { type: 'string', maxLength: 500 },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  integration: { type: 'object' },
                },
              },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const authenticatedUserId = rejectInvalidAuthenticatedDeliveryUserId(reply, request.user);
      if (!authenticatedUserId) {
        return;
      }

      if (rejectInvalidDeliveryReadQuery(reply, request.query)) {
        return;
      }

      const body = normalizedDeliveryRequestBodyRecord(request.body);
      if (body === null) {
        return invalidDeliveryRequestBodyResponse(reply);
      }

      const {
        business_id,
        provider,
        api_key,
        api_secret,
        partner_account_id,
        cost_handling,
        fixed_delivery_fee_cents,
        auto_assign_delivery,
        pickup_instructions,
      } = body as {
        business_id: string;
        provider: DeliveryProvider;
        api_key?: string;
        api_secret?: string;
        partner_account_id?: string;
        cost_handling?: DeliveryCostHandling;
        fixed_delivery_fee_cents?: number;
        auto_assign_delivery?: boolean;
        pickup_instructions?: string;
      };
      if (rejectUnsafeDeliveryRequestFieldNames(reply, 'Delivery connect request', body)) {
        return;
      }
      const unsupportedFields = unsupportedDeliveryRequestFields(body, DELIVERY_CONNECT_BODY_FIELDS);
      if (unsupportedFields.length > 0) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'UNSUPPORTED_DELIVERY_FIELD',
            message: `Unsupported delivery request field(s): ${unsupportedFields.join(', ')}`,
          },
        });
      }
      const normalizedBusinessId = normalizedRequiredDeliveryString(business_id);
      const normalizedProvider = normalizedRequiredDeliveryString(provider)?.toLowerCase() as DeliveryProvider | undefined;
      const normalizedApiKey = normalizedRequiredDeliveryString(api_key);
      const normalizedPartnerAccountId = normalizedRequiredDeliveryString(partner_account_id);
      const normalizedCostHandling = normalizedRequiredDeliveryString(cost_handling)?.toLowerCase() as DeliveryCostHandling | undefined;
      const normalizedApiSecret = normalizedOptionalDeliveryString(api_secret);

      if (
        typeof fixed_delivery_fee_cents === 'string' &&
        rejectUnsafeDeliveryTextField(
          reply,
          'Delivery fixed delivery fee cents',
          fixed_delivery_fee_cents
        )
      ) {
        return;
      }

      const normalizedFixedDeliveryFeeCents = parseOptionalNonNegativeDeliveryInteger(fixed_delivery_fee_cents);
      const normalizedAutoAssignDelivery = normalizedOptionalDeliveryBoolean(auto_assign_delivery);
      const normalizedPickupInstructions = normalizedOptionalDeliveryString(pickup_instructions);

      if (
        !normalizedBusinessId ||
        !normalizedProvider ||
        !normalizedApiKey ||
        !normalizedPartnerAccountId ||
        !normalizedCostHandling
      ) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'MISSING_PARAMETERS',
            message: 'Business ID, provider, API key, partner account ID, and cost handling are required',
          },
        });
      }
      if (
        rejectUnsafeDeliveryTextField(reply, 'Delivery business ID', normalizedBusinessId) ||
        rejectUnsafeDeliveryTextField(reply, 'Delivery provider', normalizedRequiredDeliveryString(provider)) ||
        rejectUnsafeDeliveryTextField(reply, 'Delivery API key', normalizedApiKey) ||
        rejectUnsafeDeliveryTextField(reply, 'Delivery API secret', normalizedApiSecret) ||
        rejectUnsafeDeliveryTextField(reply, 'Delivery partner account ID', normalizedPartnerAccountId) ||
        rejectUnsafeDeliveryTextField(reply, 'Delivery cost handling', normalizedRequiredDeliveryString(cost_handling)) ||
        rejectUnsafeDeliveryTextField(reply, 'Delivery pickup instructions', normalizedPickupInstructions)
      ) {
        return;
      }
      if (
        rejectOversizedDeliveryTextField(
          reply,
          'Delivery business ID',
          normalizedBusinessId,
          MAX_DELIVERY_ROUTE_ID_CHARS
        ) ||
        rejectOversizedDeliveryTextField(
          reply,
          'Delivery API key',
          normalizedApiKey,
          MAX_DELIVERY_CREDENTIAL_TEXT_CHARS
        ) ||
        rejectOversizedDeliveryTextField(
          reply,
          'Delivery API secret',
          normalizedApiSecret,
          MAX_DELIVERY_CREDENTIAL_TEXT_CHARS
        ) ||
        rejectOversizedDeliveryTextField(
          reply,
          'Delivery partner account ID',
          normalizedPartnerAccountId,
          MAX_DELIVERY_PARTNER_ACCOUNT_ID_CHARS
        ) ||
        rejectOversizedDeliveryTextField(reply, 'Delivery pickup instructions', normalizedPickupInstructions)
      ) {
        return;
      }
      if (
        !DELIVERY_PROVIDERS_ALLOWED.has(normalizedProvider) ||
        !DELIVERY_COST_HANDLING_ALLOWED.has(normalizedCostHandling)
      ) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'INVALID_DELIVERY_CONNECT_OPTION',
            message: 'Delivery provider and cost handling must be supported launch values',
          },
        });
      }
      if (
        normalizedApiSecret === null ||
        normalizedFixedDeliveryFeeCents === null ||
        normalizedAutoAssignDelivery === null ||
        normalizedPickupInstructions === null
      ) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'INVALID_DELIVERY_CONNECT_METADATA',
            message: 'Delivery connect optional fields must use the documented string, integer, and boolean types',
          },
        });
      }
      if (
        !(await verifyDeliveryBusinessOwnership(
          normalizedBusinessId,
          authenticatedUserId,
          reply,
          'You do not have permission to manage this business'
        ))
      ) {
        return;
      }

      try {
        const integration = await getDeliveryService().createIntegration(normalizedBusinessId, normalizedProvider, {
          api_key: normalizedApiKey,
          api_secret: normalizedApiSecret,
          partner_account_id: normalizedPartnerAccountId,
          cost_handling: normalizedCostHandling,
          fixed_delivery_fee_cents: normalizedFixedDeliveryFeeCents,
          auto_assign_delivery: normalizedAutoAssignDelivery,
          pickup_instructions: normalizedPickupInstructions,
        });

        return {
          success: true,
          data: {
            integration: {
              id: integration.id,
              business_id: integration.business_id,
              provider: integration.provider,
              is_active: integration.is_active,
              cost_handling: integration.cost_handling,
              fixed_delivery_fee_cents: integration.fixed_delivery_fee_cents,
              auto_assign_delivery: integration.auto_assign_delivery,
              pickup_instructions: integration.pickup_instructions,
              created_at: integration.created_at,
            },
          },
          message: `${normalizedProvider} delivery integration connected successfully`,
        };
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({
          success: false,
          error: {
            code: 'DELIVERY_INTEGRATION_ERROR',
            message: error instanceof Error ? error.message : 'Failed to connect delivery integration',
          },
        });
      }
    }
  );

  /**
   * Disconnect delivery integration
   * POST /delivery/disconnect
   */
  fastify.post(
    '/disconnect',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Disconnect delivery integration',
        tags: ['delivery'],
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
      const authenticatedUserId = rejectInvalidAuthenticatedDeliveryUserId(reply, request.user);
      if (!authenticatedUserId) {
        return;
      }

      if (rejectInvalidDeliveryReadQuery(reply, request.query)) {
        return;
      }

      const body = normalizedDeliveryRequestBodyRecord(request.body);
      if (body === null) {
        return invalidDeliveryRequestBodyResponse(reply);
      }

      const { business_id } = body;
      if (rejectUnsafeDeliveryRequestFieldNames(reply, 'Delivery disconnect request', body)) {
        return;
      }
      const unsupportedFields = unsupportedDeliveryRequestFields(body, DELIVERY_DISCONNECT_BODY_FIELDS);
      if (unsupportedFields.length > 0) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'UNSUPPORTED_DELIVERY_FIELD',
            message: `Unsupported delivery request field(s): ${unsupportedFields.join(', ')}`,
          },
        });
      }
      const normalizedBusinessId = normalizedRequiredDeliveryString(business_id);
      if (normalizedBusinessId === null) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'MISSING_PARAMETERS',
            message: 'Business ID is required',
          },
        });
      }
      if (rejectUnsafeDeliveryTextField(reply, 'Delivery business ID', normalizedBusinessId)) {
        return;
      }
      if (
        rejectOversizedDeliveryTextField(
          reply,
          'Delivery business ID',
          normalizedBusinessId,
          MAX_DELIVERY_ROUTE_ID_CHARS
        )
      ) {
        return;
      }
      if (
        !(await verifyDeliveryBusinessOwnership(
          normalizedBusinessId,
          authenticatedUserId,
          reply,
          'You do not have permission to manage this business'
        ))
      ) {
        return;
      }

      try {
        await getDeliveryService().disconnectIntegration(normalizedBusinessId);

        return {
          success: true,
          message: 'Delivery integration disconnected successfully',
        };
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({
          success: false,
          error: {
            code: 'DELIVERY_INTEGRATION_ERROR',
            message: 'Failed to disconnect delivery integration',
          },
        });
      }
    }
  );

  /**
   * Get delivery integration settings
   * GET /delivery/integration/:businessId
   */
  fastify.get(
    '/integration/:businessId',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get delivery integration settings',
        tags: ['delivery'],
        params: {
          type: 'object',
          required: ['businessId'],
          properties: {
            businessId: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
    async (request, reply) => {
      if (rejectInvalidDeliveryReadQuery(reply, request.query)) {
        return;
      }

      const authenticatedUserId = rejectInvalidAuthenticatedDeliveryUserId(reply, request.user);
      if (!authenticatedUserId) {
        return;
      }

      const { businessId } = normalizedDeliveryParamsRecord(request.params);
      const normalizedBusinessId = normalizedRequiredDeliveryString(businessId);
      if (normalizedBusinessId === null) {
        return missingDeliveryParameterResponse(reply, 'Business ID is required');
      }
      if (rejectUnsafeDeliveryTextField(reply, 'Delivery business ID', normalizedBusinessId)) {
        return;
      }
      if (
        rejectOversizedDeliveryTextField(
          reply,
          'Delivery business ID',
          normalizedBusinessId,
          MAX_DELIVERY_ROUTE_ID_CHARS
        )
      ) {
        return;
      }
      if (
        !(await verifyDeliveryBusinessOwnership(
          normalizedBusinessId,
          authenticatedUserId,
          reply,
          'You do not have permission to view this integration'
        ))
      ) {
        return;
      }

      try {
        const integration = await getDeliveryService().getIntegration(normalizedBusinessId);

        if (!integration) {
          return reply.status(404).send({
            success: false,
            error: {
              code: 'INTEGRATION_NOT_FOUND',
              message: 'No active delivery integration found',
            },
          });
        }

        return {
          success: true,
          data: {
            integration: {
              id: integration.id,
              provider: integration.provider,
              is_active: integration.is_active,
              cost_handling: integration.cost_handling,
              fixed_delivery_fee_cents: integration.fixed_delivery_fee_cents,
              auto_assign_delivery: integration.auto_assign_delivery,
              pickup_instructions: integration.pickup_instructions,
              last_delivery_at: integration.last_delivery_at,
              total_deliveries: integration.total_deliveries,
              failure_count: integration.failure_count,
              last_error: integration.last_error,
              created_at: integration.created_at,
            },
          },
        };
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({
          success: false,
          error: {
            code: 'DELIVERY_INTEGRATION_ERROR',
            message: 'Failed to get delivery integration',
          },
        });
      }
    }
  );

  /**
   * Create delivery for an order
   * POST /delivery/create/:orderId
   */
  fastify.post(
    '/create/:orderId',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Create delivery for an order',
        tags: ['delivery'],
        params: {
          type: 'object',
          required: ['orderId'],
          properties: {
            orderId: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
    async (request, reply) => {
      if (rejectInvalidDeliveryReadQuery(reply, request.query)) {
        return;
      }

      const body = normalizedDeliveryRequestBodyRecord(request.body);
      if (body === null) {
        return invalidDeliveryRequestBodyResponse(reply);
      }

      if (rejectUnsafeDeliveryRequestFieldNames(reply, 'Delivery create request', body)) {
        return;
      }
      const unsupportedFields = unsupportedDeliveryRequestFields(body, DELIVERY_CREATE_BODY_FIELDS);
      if (unsupportedFields.length > 0) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'UNSUPPORTED_DELIVERY_FIELD',
            message: `Unsupported delivery request field(s): ${unsupportedFields.join(', ')}`,
          },
        });
      }

      const authenticatedUserId = rejectInvalidAuthenticatedDeliveryUserId(reply, request.user);
      if (!authenticatedUserId) {
        return;
      }

      const { orderId } = normalizedDeliveryParamsRecord(request.params);
      const normalizedOrderId = normalizedRequiredDeliveryString(orderId);
      if (normalizedOrderId === null) {
        return missingDeliveryParameterResponse(reply, 'Order ID is required');
      }
      if (rejectUnsafeDeliveryTextField(reply, 'Delivery order ID', normalizedOrderId)) {
        return;
      }
      if (
        rejectOversizedDeliveryTextField(
          reply,
          'Delivery order ID',
          normalizedOrderId,
          MAX_DELIVERY_ROUTE_ID_CHARS
        )
      ) {
        return;
      }
      if (
        !(await verifyDeliveryOrderAuthorization(
          normalizedOrderId,
          authenticatedUserId,
          reply,
          'You do not have permission to create delivery for this order'
        ))
      ) {
        return;
      }

      try {
        const tracking = await getDeliveryService().createDelivery(normalizedOrderId);

        return {
          success: true,
          data: {
            tracking: {
              id: tracking.id,
              order_id: tracking.order_id,
              provider: tracking.provider,
              status: tracking.status,
              delivery_partner_id: tracking.delivery_partner_id,
              estimated_pickup_at: tracking.estimated_pickup_at,
              estimated_delivery_at: tracking.estimated_delivery_at,
              delivery_fee_cents: tracking.delivery_fee_cents,
              tracking_url: tracking.tracking_url,
              created_at: tracking.created_at,
            },
          },
          message: 'Delivery created successfully',
        };
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({
          success: false,
          error: {
            code: 'DELIVERY_CREATION_ERROR',
            message: error instanceof Error ? error.message : 'Failed to create delivery',
          },
        });
      }
    }
  );

  /**
   * Get delivery tracking for an order
   * GET /delivery/track/:orderId
   */
  fastify.get(
    '/track/:orderId',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get delivery tracking for an order',
        tags: ['delivery'],
        params: {
          type: 'object',
          required: ['orderId'],
          properties: {
            orderId: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
    async (request, reply) => {
      if (rejectInvalidDeliveryReadQuery(reply, request.query)) {
        return;
      }

      const authenticatedUserId = rejectInvalidAuthenticatedDeliveryUserId(reply, request.user);
      if (!authenticatedUserId) {
        return;
      }

      const { orderId } = normalizedDeliveryParamsRecord(request.params);
      const normalizedOrderId = normalizedRequiredDeliveryString(orderId);
      if (normalizedOrderId === null) {
        return missingDeliveryParameterResponse(reply, 'Order ID is required');
      }
      if (rejectUnsafeDeliveryTextField(reply, 'Delivery order ID', normalizedOrderId)) {
        return;
      }
      if (
        rejectOversizedDeliveryTextField(
          reply,
          'Delivery order ID',
          normalizedOrderId,
          MAX_DELIVERY_ROUTE_ID_CHARS
        )
      ) {
        return;
      }
      if (
        !(await verifyDeliveryOrderAuthorization(
          normalizedOrderId,
          authenticatedUserId,
          reply,
          'You do not have permission to view this delivery',
          { allowCustomer: true }
        ))
      ) {
        return;
      }

      try {
        const tracking = await getDeliveryService().getDeliveryTracking(normalizedOrderId);

        if (!tracking) {
          return reply.status(404).send({
            success: false,
            error: {
              code: 'TRACKING_NOT_FOUND',
              message: 'No delivery tracking found for this order',
            },
          });
        }

        return {
          success: true,
          data: {
            tracking: {
              id: tracking.id,
              order_id: tracking.order_id,
              provider: tracking.provider,
              status: tracking.status,
              delivery_partner_id: tracking.delivery_partner_id,
              delivery_person_name: tracking.delivery_person_name,
              delivery_person_phone: tracking.delivery_person_phone,
              estimated_pickup_at: tracking.estimated_pickup_at,
              picked_up_at: tracking.picked_up_at,
              estimated_delivery_at: tracking.estimated_delivery_at,
              delivered_at: tracking.delivered_at,
              delivery_fee_cents: tracking.delivery_fee_cents,
              tracking_url: tracking.tracking_url,
              delivery_instructions: tracking.delivery_instructions,
              cancellation_reason: tracking.cancellation_reason,
              attempt_count: tracking.attempt_count,
              status_history: tracking.status_history,
              error_message: tracking.error_message,
              created_at: tracking.created_at,
              updated_at: tracking.updated_at,
            },
          },
        };
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({
          success: false,
          error: {
            code: 'TRACKING_ERROR',
            message: 'Failed to get delivery tracking',
          },
        });
      }
    }
  );

  /**
   * Cancel delivery
   * POST /delivery/cancel/:trackingId
   */
  fastify.post(
    '/cancel/:trackingId',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Cancel delivery',
        tags: ['delivery'],
        params: {
          type: 'object',
          required: ['trackingId'],
          properties: {
            trackingId: { type: 'string', format: 'uuid' },
          },
        },
        body: {
          type: 'object',
          required: ['reason'],
          properties: {
            reason: { type: 'string', maxLength: 500 },
          },
        },
      },
    },
    async (request, reply) => {
      if (rejectInvalidDeliveryReadQuery(reply, request.query)) {
        return;
      }

      const { trackingId } = normalizedDeliveryParamsRecord(request.params);
      const body = normalizedDeliveryRequestBodyRecord(request.body);
      if (body === null) {
        return invalidDeliveryRequestBodyResponse(reply);
      }

      const { reason } = body;
      if (rejectUnsafeDeliveryRequestFieldNames(reply, 'Delivery cancellation request', body)) {
        return;
      }
      const unsupportedFields = unsupportedDeliveryRequestFields(body, DELIVERY_CANCEL_BODY_FIELDS);
      if (unsupportedFields.length > 0) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'UNSUPPORTED_DELIVERY_FIELD',
            message: `Unsupported delivery request field(s): ${unsupportedFields.join(', ')}`,
          },
        });
      }
      const authenticatedUserId = rejectInvalidAuthenticatedDeliveryUserId(reply, request.user);
      if (!authenticatedUserId) {
        return;
      }
      const normalizedTrackingId = normalizedRequiredDeliveryString(trackingId);
      if (normalizedTrackingId === null) {
        return missingDeliveryParameterResponse(reply, 'Tracking ID is required');
      }
      if (rejectUnsafeDeliveryTextField(reply, 'Delivery tracking ID', normalizedTrackingId)) {
        return;
      }
      if (
        rejectOversizedDeliveryTextField(
          reply,
          'Delivery tracking ID',
          normalizedTrackingId,
          MAX_DELIVERY_ROUTE_ID_CHARS
        )
      ) {
        return;
      }
      const normalizedReason = normalizedRequiredDeliveryString(reason);
      if (normalizedReason === null) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'INVALID_DELIVERY_CANCELLATION_REASON',
            message: 'Delivery cancellation reason must be a non-empty string',
          },
        });
      }
      if (rejectUnsafeDeliveryTextField(reply, 'Delivery cancellation reason', normalizedReason)) {
        return;
      }
      if (
        rejectOversizedDeliveryTextField(
          reply,
          'Delivery cancellation reason',
          normalizedReason
        )
      ) {
        return;
      }
      if (
        !(await verifyDeliveryTrackingSellerAuthorization(normalizedTrackingId, authenticatedUserId, reply))
      ) {
        return;
      }

      try {
        const tracking = await getDeliveryService().cancelDelivery(normalizedTrackingId, normalizedReason);

        return {
          success: true,
          data: {
            tracking: {
              id: tracking.id,
              status: tracking.status,
              cancellation_reason: tracking.cancellation_reason,
              updated_at: tracking.updated_at,
            },
          },
          message: 'Delivery cancelled successfully',
        };
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({
          success: false,
          error: {
            code: 'DELIVERY_CANCELLATION_ERROR',
            message: error instanceof Error ? error.message : 'Failed to cancel delivery',
          },
        });
      }
    }
  );

  /**
   * Submit delivery rating
   * POST /delivery/rating/:trackingId
   */
  fastify.post(
    '/rating/:trackingId',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Submit delivery rating',
        tags: ['delivery'],
        params: {
          type: 'object',
          required: ['trackingId'],
          properties: {
            trackingId: { type: 'string', format: 'uuid' },
          },
        },
        body: {
          type: 'object',
          required: ['rating'],
          properties: {
            rating: { type: 'integer', minimum: 1, maximum: 5 },
            feedback: { type: 'string', maxLength: 500 },
            timeliness_rating: { type: 'integer', minimum: 1, maximum: 5 },
            courtesy_rating: { type: 'integer', minimum: 1, maximum: 5 },
            packaging_rating: { type: 'integer', minimum: 1, maximum: 5 },
            issues: {
              type: 'array',
              items: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      if (rejectInvalidDeliveryReadQuery(reply, request.query)) {
        return;
      }

      const { trackingId } = normalizedDeliveryParamsRecord(request.params);
      const body = normalizedDeliveryRequestBodyRecord(request.body);
      if (body === null) {
        return invalidDeliveryRequestBodyResponse(reply);
      }

      const {
        rating,
        feedback,
        timeliness_rating,
        courtesy_rating,
        packaging_rating,
        issues,
      } = body as {
        rating: number;
        feedback?: string;
        timeliness_rating?: number;
        courtesy_rating?: number;
        packaging_rating?: number;
        issues?: string[];
      };
      if (rejectUnsafeDeliveryRequestFieldNames(reply, 'Delivery rating request', body)) {
        return;
      }
      const unsupportedFields = unsupportedDeliveryRequestFields(body, DELIVERY_RATING_BODY_FIELDS);
      if (unsupportedFields.length > 0) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'UNSUPPORTED_DELIVERY_FIELD',
            message: `Unsupported delivery request field(s): ${unsupportedFields.join(', ')}`,
          },
        });
      }
      const customerId = normalizedAuthenticatedDeliveryUserId(request.user);
      if (customerId === null) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'INVALID_DELIVERY_RATING_USER',
            message: 'Authenticated customer ID is required',
          },
        });
      }
      if (rejectUnsafeDeliveryTextField(reply, 'Delivery customer ID', customerId)) {
        return;
      }
      if (rejectOversizedDeliveryTextField(reply, 'Delivery customer ID', customerId)) {
        return;
      }
      const normalizedTrackingId = normalizedRequiredDeliveryString(trackingId);
      if (normalizedTrackingId === null) {
        return missingDeliveryParameterResponse(reply, 'Tracking ID is required');
      }
      if (rejectUnsafeDeliveryTextField(reply, 'Delivery tracking ID', normalizedTrackingId)) {
        return;
      }
      if (
        rejectOversizedDeliveryTextField(
          reply,
          'Delivery tracking ID',
          normalizedTrackingId,
          MAX_DELIVERY_ROUTE_ID_CHARS
        )
      ) {
        return;
      }

      if (
        (typeof rating === 'string' &&
          rejectUnsafeDeliveryTextField(reply, 'Delivery rating score', rating)) ||
        (typeof timeliness_rating === 'string' &&
          rejectUnsafeDeliveryTextField(reply, 'Delivery timeliness rating', timeliness_rating)) ||
        (typeof courtesy_rating === 'string' &&
          rejectUnsafeDeliveryTextField(reply, 'Delivery courtesy rating', courtesy_rating)) ||
        (typeof packaging_rating === 'string' &&
          rejectUnsafeDeliveryTextField(reply, 'Delivery packaging rating', packaging_rating))
      ) {
        return;
      }

      const normalizedRating = parseOptionalDeliveryRatingScore(rating, true);
      const normalizedTimelinessRating = parseOptionalDeliveryRatingScore(timeliness_rating);
      const normalizedCourtesyRating = parseOptionalDeliveryRatingScore(courtesy_rating);
      const normalizedPackagingRating = parseOptionalDeliveryRatingScore(packaging_rating);
      if (
        normalizedRating === null ||
        normalizedTimelinessRating === null ||
        normalizedCourtesyRating === null ||
        normalizedPackagingRating === null
      ) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'INVALID_DELIVERY_RATING',
            message: 'Delivery rating scores must be safe integers between 1 and 5',
          },
        });
      }

      const normalizedFeedback = normalizedOptionalDeliveryRatingText(feedback);
      if (normalizedFeedback === null) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'INVALID_DELIVERY_RATING',
            message: 'Delivery rating feedback must be a non-empty string up to 500 characters',
          },
        });
      }
      if (rejectUnsafeDeliveryTextField(reply, 'Delivery rating feedback', normalizedFeedback)) {
        return;
      }

      const normalizedIssues = normalizedOptionalDeliveryRatingIssues(issues);
      if (normalizedIssues === null) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'INVALID_DELIVERY_RATING',
            message: 'Delivery rating issues must be an array of non-empty strings up to 500 characters',
          },
        });
      }
      if (normalizedIssues?.some((issue) => rejectUnsafeDeliveryTextField(reply, 'Delivery rating issue', issue))) {
        return;
      }

      try {
        const deliveryRating = await getDeliveryService().submitDeliveryRating(
          normalizedTrackingId,
          customerId,
          {
            rating: normalizedRating,
            feedback: normalizedFeedback,
            timeliness_rating: normalizedTimelinessRating,
            courtesy_rating: normalizedCourtesyRating,
            packaging_rating: normalizedPackagingRating,
            issues: normalizedIssues,
          }
        );

        return {
          success: true,
          data: {
            rating: {
              id: deliveryRating.id,
              rating: deliveryRating.rating,
              feedback: deliveryRating.feedback,
              timeliness_rating: deliveryRating.timeliness_rating,
              courtesy_rating: deliveryRating.courtesy_rating,
              packaging_rating: deliveryRating.packaging_rating,
              issues: deliveryRating.issues,
              provider: deliveryRating.provider,
              created_at: deliveryRating.created_at,
            },
          },
          message: 'Delivery rating submitted successfully',
        };
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({
          success: false,
          error: {
            code: 'DELIVERY_RATING_ERROR',
            message: error instanceof Error ? error.message : 'Failed to submit delivery rating',
          },
        });
      }
    }
  );

  /**
   * Get delivery statistics
   * GET /delivery/stats/:businessId
   */
  fastify.get(
    '/stats/:businessId',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get delivery statistics for a business',
        tags: ['delivery'],
        params: {
          type: 'object',
          required: ['businessId'],
          properties: {
            businessId: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
    async (request, reply) => {
      if (rejectInvalidDeliveryReadQuery(reply, request.query)) {
        return;
      }

      const authenticatedUserId = rejectInvalidAuthenticatedDeliveryUserId(reply, request.user);
      if (!authenticatedUserId) {
        return;
      }

      const { businessId } = normalizedDeliveryParamsRecord(request.params);
      const normalizedBusinessId = normalizedRequiredDeliveryString(businessId);
      if (normalizedBusinessId === null) {
        return missingDeliveryParameterResponse(reply, 'Business ID is required');
      }
      if (rejectUnsafeDeliveryTextField(reply, 'Delivery business ID', normalizedBusinessId)) {
        return;
      }
      if (
        rejectOversizedDeliveryTextField(
          reply,
          'Delivery business ID',
          normalizedBusinessId,
          MAX_DELIVERY_ROUTE_ID_CHARS
        )
      ) {
        return;
      }
      if (
        !(await verifyDeliveryBusinessOwnership(
          normalizedBusinessId,
          authenticatedUserId,
          reply,
          'You do not have permission to view delivery statistics'
        ))
      ) {
        return;
      }

      try {
        const stats = await getDeliveryService().getDeliveryStats(normalizedBusinessId);

        return {
          success: true,
          data: {
            stats,
          },
        };
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({
          success: false,
          error: {
            code: 'DELIVERY_STATS_ERROR',
            message: 'Failed to get delivery statistics',
          },
        });
      }
    }
  );
};
