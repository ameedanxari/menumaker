import { FastifyInstance } from 'fastify';
import { Between } from 'typeorm';
import { authenticate } from '../middleware/auth.js';
import { TaxReportService } from '../services/TaxReportService.js';
import { Business } from '../models/Business.js';
import { Order } from '../models/Order.js';
import { requireCapability } from '../config/capabilities.js';

const TAX_REPORT_QUERY_FIELDS = new Set(['businessId', 'startDate', 'endDate']);
const TAX_INVOICE_READ_QUERY_FIELDS = new Set<string>();
const TAX_INVOICE_GENERATE_QUERY_FIELDS = new Set<string>();
const TAX_INVOICE_GENERATE_BODY_FIELDS = new Set<string>();
const TAX_INVOICE_LIST_QUERY_FIELDS = new Set(['limit', 'offset', 'startDate', 'endDate']);
const DEFAULT_TAX_INVOICE_LIST_LIMIT = 50;
const MAX_TAX_INVOICE_LIST_LIMIT = 100;
const MAX_TAX_ROUTE_DATE_CHARS = 64;
const MAX_TAX_ROUTE_ID_CHARS = 255;
const MAX_TAX_ROUTE_USER_ID_CHARS = 255;
const UNSAFE_TAX_ROUTE_TEXT_CONTROLS =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/u;

interface NormalizedTaxInvoiceListQuery {
  limit: number;
  offset: number;
  startDate?: string;
  endDate?: string;
}

function unsupportedTaxRequestFields(query: unknown, allowedFields: Set<string>): string[] {
  if (!query || typeof query !== 'object' || Array.isArray(query)) {
    return [];
  }

  return Object.keys(query as Record<string, unknown>)
    .filter((field) => !allowedFields.has(field))
    .sort();
}

function rejectUnsupportedTaxFields(
  reply: { status: (statusCode: number) => { send: (payload: unknown) => unknown } },
  fields: string[]
): boolean {
  if (fields.length === 0) {
    return false;
  }

  reply.status(400).send({
    success: false,
    error: {
      code: 'UNSUPPORTED_TAX_QUERY_FIELD',
      message: `Unsupported tax query field(s): ${fields.join(', ')}`,
    },
  });
  return true;
}

function rejectUnsupportedTaxBodyFields(
  reply: { status: (statusCode: number) => { send: (payload: unknown) => unknown } },
  fields: string[]
): boolean {
  if (fields.length === 0) {
    return false;
  }

  reply.status(400).send({
    success: false,
    error: {
      code: 'UNSUPPORTED_TAX_BODY_FIELD',
      message: `Unsupported tax body field(s): ${fields.join(', ')}`,
    },
  });
  return true;
}

function hasUnsafeTaxRouteTextControls(value: string): boolean {
  return UNSAFE_TAX_ROUTE_TEXT_CONTROLS.test(value);
}

export function normalizeRequiredTaxString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  if (hasUnsafeTaxRouteTextControls(value)) {
    return value;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export function normalizeOptionalTaxDateFilter(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  const rawValue = String(value);
  if (hasUnsafeTaxRouteTextControls(rawValue)) {
    return rawValue;
  }

  const normalized = rawValue.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function rejectUnsafeTaxTextField(
  reply: { status: (statusCode: number) => { send: (payload: unknown) => unknown } },
  label: string,
  value: string | undefined
): boolean {
  if (value === undefined || !UNSAFE_TAX_ROUTE_TEXT_CONTROLS.test(value)) {
    return false;
  }

  reply.status(400).send({
    success: false,
    error: {
      code: 'INVALID_TAX_TEXT_FIELD',
      message: `${label} must not include unsafe control characters`,
    },
  });
  return true;
}

function rejectOversizedTaxDateField(
  reply: { status: (statusCode: number) => { send: (payload: unknown) => unknown } },
  label: string,
  value: string | undefined
): boolean {
  if (value === undefined || value.length <= MAX_TAX_ROUTE_DATE_CHARS) {
    return false;
  }

  reply.status(400).send({
    success: false,
    error: {
      code: 'INVALID_TAX_DATE_FIELD',
      message: `${label} must be at most ${MAX_TAX_ROUTE_DATE_CHARS} characters`,
    },
  });
  return true;
}

function rejectOversizedTaxTextField(
  reply: { status: (statusCode: number) => { send: (payload: unknown) => unknown } },
  label: string,
  value: string | undefined,
  maxLength: number
): boolean {
  if (value === undefined || value.length <= maxLength) {
    return false;
  }

  reply.status(400).send({
    success: false,
    error: {
      code: 'INVALID_TAX_TEXT_FIELD',
      message: `${label} must be at most ${maxLength} characters`,
    },
  });
  return true;
}

function rejectUnsafeTaxRequestFieldNames(
  reply: { status: (statusCode: number) => { send: (payload: unknown) => unknown } },
  label: string,
  record: Record<string, unknown> | null | undefined
): boolean {
  if (!record || !Object.keys(record).some(hasUnsafeTaxRouteTextControls)) {
    return false;
  }

  reply.status(400).send({
    success: false,
    error: {
      code: 'INVALID_TAX_FIELD_NAME',
      message: `${label} field names must not include unsafe control characters`,
    },
  });
  return true;
}

function normalizeTaxQueryRecord(query: unknown): Record<string, unknown> | null {
  if (!query || typeof query !== 'object' || Array.isArray(query)) {
    return null;
  }

  return query as Record<string, unknown>;
}

function normalizeOptionalTaxQueryRecord(query: unknown): Record<string, unknown> | null {
  if (query === undefined || query === null) {
    return {};
  }

  if (typeof query !== 'object' || Array.isArray(query)) {
    return null;
  }

  return query as Record<string, unknown>;
}

function normalizeOptionalTaxBodyRecord(body: unknown): Record<string, unknown> | null {
  if (body === undefined || body === null) {
    return {};
  }

  if (typeof body !== 'object' || Array.isArray(body)) {
    return null;
  }

  return body as Record<string, unknown>;
}

function normalizeTaxParamsRecord(params: unknown): Record<string, unknown> {
  if (!params || typeof params !== 'object' || Array.isArray(params)) {
    return {};
  }

  return params as Record<string, unknown>;
}

function normalizeAuthenticatedTaxUserId(user: unknown): string | null {
  if (!user || typeof user !== 'object') {
    return null;
  }

  return normalizeRequiredTaxString((user as { userId?: unknown; id?: unknown }).userId) ??
    normalizeRequiredTaxString((user as { userId?: unknown; id?: unknown }).id);
}

function rejectInvalidAuthenticatedTaxUserId(
  reply: { status: (statusCode: number) => { send: (payload: unknown) => unknown } },
  user: unknown
): string | null {
  const userId = normalizeAuthenticatedTaxUserId(user);
  if (!userId) {
    reply.status(400).send({
      success: false,
      error: {
        code: 'INVALID_TAX_USER',
        message: 'Authenticated tax user ID is required',
      },
    });
    return null;
  }

  if (rejectUnsafeTaxTextField(reply, 'Tax user ID', userId)) {
    return null;
  }

  if (rejectOversizedTaxTextField(reply, 'Tax user ID', userId, MAX_TAX_ROUTE_USER_ID_CHARS)) {
    return null;
  }

  return userId;
}

function missingTaxParameterResponse(
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

function invalidTaxReportQueryResponse(
  reply: { status: (statusCode: number) => { send: (payload: unknown) => unknown } }
): unknown {
  return reply.status(400).send({
    success: false,
    error: {
      code: 'INVALID_TAX_REPORT_QUERY',
      message: 'Tax report query must be an object',
    },
  });
}

function parseTaxReportPeriod(
  startDate: string,
  endDate: string
): { start: Date; end: Date } | null {
  const start = new Date(startDate.trim());
  const end = new Date(endDate.trim());

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return null;
  }
  if (start.getTime() > end.getTime()) {
    return null;
  }

  return { start, end };
}

function parseBoundedPositiveInteger(
  label: string,
  value: unknown,
  defaultValue: number,
  maxValue: number
): number {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }
  if (typeof value === 'string' && hasUnsafeTaxRouteTextControls(value)) {
    throw new Error(`${label} must not include unsafe control characters`);
  }

  const numeric = typeof value === 'string' && /^-?\d+$/.test(value) ? Number(value) : value;

  if (typeof numeric !== 'number' || !Number.isInteger(numeric)) {
    throw new Error(`${label} must be an integer`);
  }

  if (!Number.isSafeInteger(numeric)) {
    throw new Error(`${label} must be a safe integer`);
  }

  if (numeric < 1 || numeric > maxValue) {
    throw new Error(`${label} must be between 1 and ${maxValue}`);
  }

  return numeric;
}

function parseNonNegativeInteger(
  label: string,
  value: unknown,
  defaultValue: number
): number {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }
  if (typeof value === 'string' && hasUnsafeTaxRouteTextControls(value)) {
    throw new Error(`${label} must not include unsafe control characters`);
  }

  const numeric = typeof value === 'string' && /^-?\d+$/.test(value) ? Number(value) : value;

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

function normalizeTaxInvoiceListQuery(query: unknown): NormalizedTaxInvoiceListQuery {
  if (query !== undefined && query !== null && (typeof query !== 'object' || Array.isArray(query))) {
    throw new Error('Tax invoice list query must be an object');
  }

  const queryRecord = (query ?? {}) as Record<string, unknown>;
  return {
    limit: parseBoundedPositiveInteger(
      'Tax invoice list limit',
      queryRecord.limit,
      DEFAULT_TAX_INVOICE_LIST_LIMIT,
      MAX_TAX_INVOICE_LIST_LIMIT
    ),
    offset: parseNonNegativeInteger('Tax invoice list offset', queryRecord.offset, 0),
    startDate: normalizeOptionalTaxDateFilter(queryRecord.startDate),
    endDate: normalizeOptionalTaxDateFilter(queryRecord.endDate),
  };
}

/**
 * Tax Report Routes
 * Phase 3: Advanced Reporting & Tax Compliance (US3.4)
 *
 * Endpoints:
 * - GET /tax/invoices/:orderId - Get tax invoice for order
 * - POST /tax/invoices/:orderId/generate - Manually generate tax invoice
 * - GET /tax/gst-report - Generate GST report for period
 * - GET /tax/profit-analysis - Generate profit analysis report
 */
export async function taxReportRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook?.('onRequest', requireCapability('tax_reporting'));

  let taxReportService: TaxReportService | null = null;
  const getTaxReportService = (): TaxReportService => {
    taxReportService ??= new TaxReportService();
    return taxReportService;
  };

  /**
   * GET /tax/invoices/:orderId
   * Get tax invoice for an order
   */
  fastify.get<{
    Params: { orderId: string };
  }>(
    '/invoices/:orderId',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const authenticatedUserId = rejectInvalidAuthenticatedTaxUserId(reply, request.user);
      if (!authenticatedUserId) {
        return;
      }

      const { orderId } = normalizeTaxParamsRecord(request.params);
      const normalizedOrderId = normalizeRequiredTaxString(orderId);
      if (!normalizedOrderId) {
        return missingTaxParameterResponse(reply, 'Order ID is required');
      }
      if (rejectUnsafeTaxTextField(reply, 'Order ID', normalizedOrderId)) {
        return;
      }
      if (rejectOversizedTaxTextField(reply, 'Order ID', normalizedOrderId, MAX_TAX_ROUTE_ID_CHARS)) {
        return;
      }

      const query = normalizeOptionalTaxQueryRecord(request.query);
      if (query === null) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'INVALID_TAX_INVOICE_QUERY',
            message: 'Tax invoice read query must be an object',
          },
        });
      }

      if (rejectUnsafeTaxRequestFieldNames(reply, 'Tax invoice read query', query)) {
        return;
      }

      const unsupportedFields = unsupportedTaxRequestFields(query, TAX_INVOICE_READ_QUERY_FIELDS);
      if (rejectUnsupportedTaxFields(reply, unsupportedFields)) {
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
            message: 'You do not have permission to view this invoice',
          },
        });
      }

      // Get or generate invoice
      let invoice = await getTaxReportService().getInvoiceByOrderId(normalizedOrderId);

      if (!invoice && order.status === 'fulfilled') {
        // Auto-generate for fulfilled orders
        invoice = await getTaxReportService().generateTaxInvoice(normalizedOrderId);
      }

      if (!invoice) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'INVOICE_NOT_AVAILABLE',
            message: 'Invoice not available. Order must be completed first.',
          },
        });
      }

      reply.send({
        success: true,
        data: { invoice },
      });
    }
  );

  /**
   * POST /tax/invoices/:orderId/generate
   * Manually generate tax invoice for an order
   */
  fastify.post<{
    Params: { orderId: string };
  }>(
    '/invoices/:orderId/generate',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const authenticatedUserId = rejectInvalidAuthenticatedTaxUserId(reply, request.user);
      if (!authenticatedUserId) {
        return;
      }

      try {
        const query = normalizeOptionalTaxQueryRecord(request.query);
        if (query === null) {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'INVALID_TAX_INVOICE_QUERY',
              message: 'Tax invoice generation query must be an object',
            },
          });
        }

        if (rejectUnsafeTaxRequestFieldNames(reply, 'Tax invoice generation query', query)) {
          return;
        }

        const unsupportedQueryFields = unsupportedTaxRequestFields(query, TAX_INVOICE_GENERATE_QUERY_FIELDS);
        if (rejectUnsupportedTaxFields(reply, unsupportedQueryFields)) {
          return;
        }

        const { orderId } = normalizeTaxParamsRecord(request.params);
        const normalizedOrderId = normalizeRequiredTaxString(orderId);
        if (!normalizedOrderId) {
          return missingTaxParameterResponse(reply, 'Order ID is required');
        }
        if (rejectUnsafeTaxTextField(reply, 'Order ID', normalizedOrderId)) {
          return;
        }
        if (rejectOversizedTaxTextField(reply, 'Order ID', normalizedOrderId, MAX_TAX_ROUTE_ID_CHARS)) {
          return;
        }

        const body = normalizeOptionalTaxBodyRecord(request.body);
        if (body === null) {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'INVALID_TAX_INVOICE_GENERATE_BODY',
              message: 'Tax invoice generation body must be an object',
            },
          });
        }

        if (rejectUnsafeTaxRequestFieldNames(reply, 'Tax invoice generation body', body)) {
          return;
        }

        const unsupportedFields = unsupportedTaxRequestFields(body, TAX_INVOICE_GENERATE_BODY_FIELDS);
        if (rejectUnsupportedTaxBodyFields(reply, unsupportedFields)) {
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
              message: 'You do not have permission to generate this invoice',
            },
          });
        }

        // Check order status - need to reload order with status field
        const fullOrder = await fastify.orm.manager.findOne(Order, {
          where: { id: normalizedOrderId },
        });

        if (fullOrder && fullOrder.status !== 'fulfilled') {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'INVALID_ORDER_STATUS',
              message: 'Tax invoices can only be generated for completed orders',
            },
          });
        }

        // Generate invoice
        const invoice = await getTaxReportService().generateTaxInvoice(normalizedOrderId);

        reply.send({
          success: true,
          data: { invoice },
          message: 'Tax invoice generated successfully',
        });
      } catch (error) {
        if (error instanceof Error && error.message.includes('already exists')) {
          return reply.status(409).send({
            success: false,
            error: {
              code: 'INVOICE_ALREADY_EXISTS',
              message: 'Tax invoice already exists for this order',
            },
          });
        }
        throw error;
      }
    }
  );

  /**
   * GET /tax/gst-report
   * Generate GST report for a period
   */
  fastify.get<{
    Querystring: {
      businessId: string;
      startDate: string;
      endDate: string;
    };
  }>(
    '/gst-report',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const authenticatedUserId = rejectInvalidAuthenticatedTaxUserId(reply, request.user);
      if (!authenticatedUserId) {
        return;
      }

      const query = normalizeTaxQueryRecord(request.query);
      if (query === null && request.query !== undefined && request.query !== null) {
        return invalidTaxReportQueryResponse(reply);
      }

      if (rejectUnsafeTaxRequestFieldNames(reply, 'Tax report query', query)) {
        return;
      }

      const unsupportedFields = unsupportedTaxRequestFields(query, TAX_REPORT_QUERY_FIELDS);
      if (rejectUnsupportedTaxFields(reply, unsupportedFields)) {
        return;
      }
      if (!query) {
        return missingTaxParameterResponse(reply, 'Business ID, start date, and end date are required');
      }

      const { businessId, startDate, endDate } = query;
      const normalizedBusinessId = normalizeRequiredTaxString(businessId);
      const normalizedStartDate = normalizeRequiredTaxString(startDate);
      const normalizedEndDate = normalizeRequiredTaxString(endDate);
      if (!normalizedBusinessId || !normalizedStartDate || !normalizedEndDate) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'MISSING_PARAMETERS',
            message: 'Business ID, start date, and end date are required',
          },
        });
      }
      if (
        rejectUnsafeTaxTextField(reply, 'Business ID', normalizedBusinessId) ||
        rejectUnsafeTaxTextField(reply, 'Start date', normalizedStartDate) ||
        rejectUnsafeTaxTextField(reply, 'End date', normalizedEndDate)
      ) {
        return;
      }
      if (rejectOversizedTaxTextField(reply, 'Business ID', normalizedBusinessId, MAX_TAX_ROUTE_ID_CHARS)) {
        return;
      }
      if (
        rejectOversizedTaxDateField(reply, 'Start date', normalizedStartDate) ||
        rejectOversizedTaxDateField(reply, 'End date', normalizedEndDate)
      ) {
        return;
      }
      const reportPeriod = parseTaxReportPeriod(normalizedStartDate, normalizedEndDate);
      if (!reportPeriod) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'INVALID_DATE_RANGE',
            message: 'Start date and end date must be valid dates, and start date must be before or equal to end date',
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
            message: 'You do not have permission to view this report',
          },
        });
      }

      // Generate GST report
      const report = await getTaxReportService().generateGstReport(
        normalizedBusinessId,
        reportPeriod.start,
        reportPeriod.end
      );

      reply.send({
        success: true,
        data: {
          period: {
            start: normalizedStartDate,
            end: normalizedEndDate,
          },
          report,
        },
      });
    }
  );

  /**
   * GET /tax/profit-analysis
   * Generate profit analysis report for a period
   */
  fastify.get<{
    Querystring: {
      businessId: string;
      startDate: string;
      endDate: string;
    };
  }>(
    '/profit-analysis',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const authenticatedUserId = rejectInvalidAuthenticatedTaxUserId(reply, request.user);
      if (!authenticatedUserId) {
        return;
      }

      const query = normalizeTaxQueryRecord(request.query);
      if (query === null && request.query !== undefined && request.query !== null) {
        return invalidTaxReportQueryResponse(reply);
      }

      if (rejectUnsafeTaxRequestFieldNames(reply, 'Tax report query', query)) {
        return;
      }

      const unsupportedFields = unsupportedTaxRequestFields(query, TAX_REPORT_QUERY_FIELDS);
      if (rejectUnsupportedTaxFields(reply, unsupportedFields)) {
        return;
      }
      if (!query) {
        return missingTaxParameterResponse(reply, 'Business ID, start date, and end date are required');
      }

      const { businessId, startDate, endDate } = query;
      const normalizedBusinessId = normalizeRequiredTaxString(businessId);
      const normalizedStartDate = normalizeRequiredTaxString(startDate);
      const normalizedEndDate = normalizeRequiredTaxString(endDate);
      if (!normalizedBusinessId || !normalizedStartDate || !normalizedEndDate) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'MISSING_PARAMETERS',
            message: 'Business ID, start date, and end date are required',
          },
        });
      }
      if (
        rejectUnsafeTaxTextField(reply, 'Business ID', normalizedBusinessId) ||
        rejectUnsafeTaxTextField(reply, 'Start date', normalizedStartDate) ||
        rejectUnsafeTaxTextField(reply, 'End date', normalizedEndDate)
      ) {
        return;
      }
      if (rejectOversizedTaxTextField(reply, 'Business ID', normalizedBusinessId, MAX_TAX_ROUTE_ID_CHARS)) {
        return;
      }
      if (
        rejectOversizedTaxDateField(reply, 'Start date', normalizedStartDate) ||
        rejectOversizedTaxDateField(reply, 'End date', normalizedEndDate)
      ) {
        return;
      }
      const reportPeriod = parseTaxReportPeriod(normalizedStartDate, normalizedEndDate);
      if (!reportPeriod) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'INVALID_DATE_RANGE',
            message: 'Start date and end date must be valid dates, and start date must be before or equal to end date',
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
            message: 'You do not have permission to view this report',
          },
        });
      }

      // Generate profit analysis
      const analysis = await getTaxReportService().generateProfitAnalysis(
        normalizedBusinessId,
        reportPeriod.start,
        reportPeriod.end
      );

      reply.send({
        success: true,
        data: {
          period: {
            start: normalizedStartDate,
            end: normalizedEndDate,
          },
          analysis,
        },
      });
    }
  );

  /**
   * GET /tax/invoices/business/:businessId
   * Get all tax invoices for a business
   */
  fastify.get<{
    Params: { businessId: string };
    Querystring: {
      limit?: number;
      offset?: number;
      startDate?: string;
      endDate?: string;
    };
  }>(
    '/invoices/business/:businessId',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const authenticatedUserId = rejectInvalidAuthenticatedTaxUserId(reply, request.user);
      if (!authenticatedUserId) {
        return;
      }

      const { businessId } = normalizeTaxParamsRecord(request.params);
      const query = normalizeOptionalTaxQueryRecord(request.query);
      if (query === null) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'INVALID_TAX_INVOICE_QUERY',
            message: 'Tax invoice list query must be an object',
          },
        });
      }

      if (rejectUnsafeTaxRequestFieldNames(reply, 'Tax invoice list query', query)) {
        return;
      }

      const unsupportedFields = unsupportedTaxRequestFields(query, TAX_INVOICE_LIST_QUERY_FIELDS);
      if (rejectUnsupportedTaxFields(reply, unsupportedFields)) {
        return;
      }

      let invoiceQuery: NormalizedTaxInvoiceListQuery;
      try {
        invoiceQuery = normalizeTaxInvoiceListQuery(query);
      } catch (error) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'INVALID_TAX_INVOICE_QUERY',
            message: error instanceof Error ? error.message : 'Invalid tax invoice query',
          },
        });
      }

      const { limit, offset, startDate, endDate } = invoiceQuery;
      const normalizedBusinessId = normalizeRequiredTaxString(businessId);
      const hasStartDate = startDate !== undefined;
      const hasEndDate = endDate !== undefined;
      if (!normalizedBusinessId) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'MISSING_PARAMETERS',
            message: 'Business ID is required',
          },
        });
      }
      if (
        rejectUnsafeTaxTextField(reply, 'Business ID', normalizedBusinessId) ||
        rejectUnsafeTaxTextField(reply, 'Start date', startDate) ||
        rejectUnsafeTaxTextField(reply, 'End date', endDate)
      ) {
        return;
      }
      if (rejectOversizedTaxTextField(reply, 'Business ID', normalizedBusinessId, MAX_TAX_ROUTE_ID_CHARS)) {
        return;
      }
      if (
        rejectOversizedTaxDateField(reply, 'Start date', startDate) ||
        rejectOversizedTaxDateField(reply, 'End date', endDate)
      ) {
        return;
      }
      const invoicePeriod = hasStartDate || hasEndDate
        ? hasStartDate && hasEndDate
          ? parseTaxReportPeriod(startDate, endDate)
          : null
        : undefined;

      if (invoicePeriod === null) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'INVALID_DATE_RANGE',
            message: 'Start date and end date must be valid dates, and start date must be before or equal to end date',
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
            message: 'You do not have permission to view these invoices',
          },
        });
      }

      // Build query
      const where: any = { business_id: normalizedBusinessId };

      if (invoicePeriod) {
        where.invoice_date = Between(invoicePeriod.start, invoicePeriod.end);
      }

      // Get invoices
      const [invoices, total] = await fastify.orm.manager.findAndCount('TaxInvoice', {
        where,
        order: { invoice_date: 'DESC' },
        take: limit,
        skip: offset,
      });

      reply.send({
        success: true,
        data: {
          invoices,
          total,
          limit,
          offset,
        },
      });
    }
  );
}
