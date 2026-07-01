import Fastify, {
  type FastifyInstance,
  type FastifyPluginAsync,
  type FastifyServerOptions,
} from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import type { DataSource } from 'typeorm';
import { errorHandler } from './middleware/errorHandler.js';

export interface AppDependencies {
  orm?: DataSource;
  runtimeRoutes?: FastifyPluginAsync;
}

export interface BuildAppOptions extends FastifyServerOptions {
  registerRuntimeRoutes?: boolean;
}

const errorEnvelopeSchema = {
  type: 'object',
  required: ['error'],
  properties: {
    error: {
      type: 'object',
      required: ['code', 'message', 'request_id'],
      properties: {
        code: { type: 'string' },
        message: { type: 'string' },
        request_id: { type: 'string' },
        details: { type: 'object', additionalProperties: true },
      },
      additionalProperties: false,
    },
  },
  additionalProperties: false,
} as const;

const paginationSchema = {
  type: 'object',
  required: ['limit', 'has_more'],
  properties: {
    limit: { type: 'integer', minimum: 1, maximum: 100 },
    cursor: { type: 'string' },
    next_cursor: { type: 'string' },
    has_more: { type: 'boolean' },
  },
  additionalProperties: false,
} as const;

const resourceSchema = {
  type: 'object',
  required: ['id', 'created_at', 'updated_at'],
  properties: {
    id: { type: 'string' },
    created_at: { type: 'string', format: 'date-time' },
    updated_at: { type: 'string', format: 'date-time' },
  },
  additionalProperties: true,
} as const;

const successEnvelopeSchema = {
  type: 'object',
  required: ['data'],
  properties: {
    data: resourceSchema,
  },
  additionalProperties: false,
} as const;

const listEnvelopeSchema = {
  type: 'object',
  required: ['data', 'pagination'],
  properties: {
    data: { type: 'array', items: resourceSchema },
    pagination: paginationSchema,
  },
  additionalProperties: false,
} as const;

const idParamsSchema = {
  type: 'object',
  required: ['id'],
  properties: { id: { type: 'string', minLength: 1 } },
  additionalProperties: false,
} as const;

const listQuerySchema = {
  type: 'object',
  properties: {
    limit: { type: 'integer', minimum: 1, maximum: 100, default: 25 },
    cursor: { type: 'string' },
  },
  additionalProperties: false,
} as const;

const writeBodySchema = {
  type: 'object',
  minProperties: 1,
  additionalProperties: true,
} as const;

const idempotencyHeadersSchema = {
  type: 'object',
  properties: {
    'idempotency-key': { type: 'string', minLength: 8 },
  },
  additionalProperties: true,
} as const;

const commonResponses = {
  400: errorEnvelopeSchema,
  401: errorEnvelopeSchema,
  403: errorEnvelopeSchema,
  404: errorEnvelopeSchema,
  409: errorEnvelopeSchema,
  422: errorEnvelopeSchema,
  500: errorEnvelopeSchema,
} as const;

interface ContractOperation {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  operationId: string;
  tag: string;
  mutates?: boolean;
  list?: boolean;
  hasId?: boolean;
}

export const contractOperations: ContractOperation[] = [
  { method: 'POST', path: '/api/v1/auth/signup', operationId: 'auth_signup', tag: 'auth', mutates: true },
  { method: 'POST', path: '/api/v1/auth/login', operationId: 'auth_login', tag: 'auth', mutates: true },
  { method: 'GET', path: '/api/v1/auth/me', operationId: 'auth_get_me', tag: 'auth' },
  { method: 'PATCH', path: '/api/v1/auth/profile', operationId: 'auth_update_profile', tag: 'auth', mutates: true },
  { method: 'POST', path: '/api/v1/auth/logout', operationId: 'auth_logout', tag: 'auth', mutates: true },
  { method: 'GET', path: '/api/v1/businesses', operationId: 'business_list', tag: 'businesses', list: true },
  { method: 'POST', path: '/api/v1/businesses', operationId: 'business_create', tag: 'businesses', mutates: true },
  { method: 'GET', path: '/api/v1/businesses/:id', operationId: 'business_get', tag: 'businesses', hasId: true },
  { method: 'PUT', path: '/api/v1/businesses/:id', operationId: 'business_update', tag: 'businesses', hasId: true, mutates: true },
  { method: 'GET', path: '/api/v1/dishes', operationId: 'dish_list', tag: 'dishes', list: true },
  { method: 'POST', path: '/api/v1/dishes', operationId: 'dish_create', tag: 'dishes', mutates: true },
  { method: 'GET', path: '/api/v1/dishes/:id', operationId: 'dish_get', tag: 'dishes', hasId: true },
  { method: 'PUT', path: '/api/v1/dishes/:id', operationId: 'dish_update', tag: 'dishes', hasId: true, mutates: true },
  { method: 'GET', path: '/api/v1/menus', operationId: 'menu_list', tag: 'menus', list: true },
  { method: 'POST', path: '/api/v1/menus', operationId: 'menu_create', tag: 'menus', mutates: true },
  { method: 'POST', path: '/api/v1/menus/:id/publish', operationId: 'menu_publish', tag: 'menus', hasId: true, mutates: true },
  { method: 'GET', path: '/api/v1/orders', operationId: 'order_list', tag: 'orders', list: true },
  { method: 'POST', path: '/api/v1/orders', operationId: 'order_create', tag: 'orders', mutates: true },
  { method: 'PUT', path: '/api/v1/orders/:id', operationId: 'order_update', tag: 'orders', hasId: true, mutates: true },
  { method: 'POST', path: '/api/v1/orders/:id/cancel', operationId: 'order_cancel', tag: 'orders', hasId: true, mutates: true },
  { method: 'POST', path: '/api/v1/payments/create-intent', operationId: 'payment_create_intent', tag: 'payments', mutates: true },
  { method: 'POST', path: '/api/v1/payments/webhook', operationId: 'payment_webhook', tag: 'payments', mutates: true },
  { method: 'POST', path: '/api/v1/payments/:id/refund', operationId: 'payment_refund', tag: 'payments', hasId: true, mutates: true },
  { method: 'GET', path: '/api/v1/payouts', operationId: 'payout_list', tag: 'payouts', list: true },
  { method: 'POST', path: '/api/v1/coupons', operationId: 'coupon_create', tag: 'coupons', mutates: true },
  { method: 'GET', path: '/api/v1/coupons', operationId: 'coupon_list', tag: 'coupons', list: true },
  { method: 'GET', path: '/api/v1/marketplace/search', operationId: 'marketplace_search', tag: 'marketplace', list: true },
  { method: 'GET', path: '/api/v1/marketplace/sellers/:id', operationId: 'marketplace_get_seller', tag: 'marketplace', hasId: true },
  { method: 'POST', path: '/api/v1/reviews', operationId: 'review_create', tag: 'reviews', mutates: true },
  { method: 'GET', path: '/api/v1/reviews/business/:id', operationId: 'review_list_for_business', tag: 'reviews', hasId: true, list: true },
  { method: 'GET', path: '/api/v1/referrals/code', operationId: 'referral_get_code', tag: 'referrals' },
  { method: 'POST', path: '/api/v1/referrals/validate', operationId: 'referral_validate', tag: 'referrals', mutates: true },
  { method: 'GET', path: '/api/v1/notifications', operationId: 'notification_list', tag: 'notifications', list: true },
  { method: 'POST', path: '/api/v1/notifications/devices', operationId: 'notification_register_device', tag: 'notifications', mutates: true },
  { method: 'GET', path: '/api/v1/settings', operationId: 'settings_get', tag: 'settings' },
  { method: 'PATCH', path: '/api/v1/settings', operationId: 'settings_update', tag: 'settings', mutates: true },
  { method: 'GET', path: '/api/v1/admin/users', operationId: 'admin_user_list', tag: 'admin', list: true },
  { method: 'POST', path: '/api/v1/gdpr/deletion-requests', operationId: 'gdpr_create_deletion_request', tag: 'gdpr', mutates: true },
  { method: 'POST', path: '/api/v1/media/upload', operationId: 'media_upload', tag: 'media', mutates: true },
  { method: 'GET', path: '/api/v1/reports/dashboard', operationId: 'report_dashboard', tag: 'reports' },
];

function schemaFor(operation: ContractOperation) {
  return {
    operationId: operation.operationId,
    tags: [operation.tag],
    summary: `${operation.method} ${operation.path}`,
    description: 'Contract-first MenuMaker operation. Runtime handlers adapt domain services behind this transport schema.',
    ...(operation.hasId && { params: idParamsSchema }),
    ...(operation.list && { querystring: listQuerySchema }),
    ...(operation.mutates && {
      headers: idempotencyHeadersSchema,
      body: writeBodySchema,
    }),
    response: {
      200: operation.list ? listEnvelopeSchema : successEnvelopeSchema,
      201: successEnvelopeSchema,
      204: { type: 'null' },
      ...commonResponses,
    },
  };
}

function registerContractRoutes(app: FastifyInstance) {
  for (const operation of contractOperations) {
    app.route({
      method: operation.method,
      url: operation.path,
      schema: schemaFor(operation),
      handler: async (request, reply) => {
        reply.code(operation.method === 'POST' ? 201 : 200);
        if (operation.list) {
          return {
            data: [],
            pagination: { limit: 25, has_more: false },
          };
        }
        return {
          data: {
            id: String((request.params as { id?: string } | undefined)?.id ?? operation.operationId),
            created_at: new Date(0).toISOString(),
            updated_at: new Date(0).toISOString(),
          },
        };
      },
    });
  }
}

export async function buildApp(
  dependencies: AppDependencies = {},
  options: BuildAppOptions = {},
): Promise<FastifyInstance> {
  const app = Fastify({
    logger: options.logger ?? false,
    genReqId: options.genReqId,
  });

  if (dependencies.orm) {
    app.decorate('orm', dependencies.orm);
  }

  await app.register(cors, {
    origin: process.env.FRONTEND_URL || true,
    credentials: true,
  });
  await app.register(helmet);
  await app.register(rateLimit, { max: 100, timeWindow: '15 minutes' });
  await app.register(multipart, { limits: { fileSize: 5 * 1024 * 1024, files: 10 } });
  await app.register(swagger, {
    openapi: {
      openapi: '3.1.0',
      info: {
        title: 'MenuMaker API',
        version: '1.0.0',
        description: 'Canonical contract for MenuMaker /api/v1 generated clients.',
      },
      servers: [{ url: '/api/v1', description: 'Version-one API root' }],
      tags: [...new Set(contractOperations.map((operation) => operation.tag))]
        .sort()
        .map((name) => ({ name })),
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
          idempotencyKey: {
            type: 'apiKey',
            in: 'header',
            name: 'Idempotency-Key',
          },
        },
      },
    },
  });
  await app.register(swaggerUi, { routePrefix: '/api/docs' });

  if (options.registerRuntimeRoutes && dependencies.runtimeRoutes) {
    await app.register(dependencies.runtimeRoutes);
  } else {
    registerContractRoutes(app);
  }

  app.setErrorHandler(errorHandler);
  await app.ready();
  return app;
}
