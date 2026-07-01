import { AsyncLocalStorage } from 'node:async_hooks';
import crypto from 'node:crypto';

export type TelemetryEnvironment = 'development' | 'test' | 'staging' | 'production';

export interface TelemetryResource {
  serviceName: string;
  serviceVersion: string;
  environment: TelemetryEnvironment | string;
  exporterEndpoint?: string;
}

export interface TraceContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  requestId: string;
  correlationId: string;
}

export interface SpanRecord {
  name: string;
  kind: 'server' | 'client' | 'internal' | 'producer' | 'consumer';
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  attributes: Record<string, string | number | boolean>;
  startedAt: string;
  endedAt?: string;
  status: 'ok' | 'error' | 'unset';
  errorType?: string;
}

export interface MetricRecord {
  name: string;
  value: number;
  attributes: Record<string, string | number | boolean>;
}

export interface TelemetryExporter {
  exportSpan(span: SpanRecord): Promise<void>;
  exportMetric(metric: MetricRecord): Promise<void>;
}

const SENSITIVE_KEYS = [
  'authorization',
  'cookie',
  'set-cookie',
  'token',
  'password',
  'secret',
  'api_key',
  'apikey',
  'stripe',
  'payment',
  'card',
  'email',
  'phone',
  'address',
  'request_body',
  'body',
];

const ROUTE_ID_PATTERN = /\/(?:[0-9a-f]{8,}|[0-9]+|[A-Za-z0-9_-]{12,})(?=\/|$)/g;
const asyncContext = new AsyncLocalStorage<TraceContext>();

let activeResource: TelemetryResource = {
  serviceName: 'menumaker-api',
  serviceVersion: process.env.npm_package_version ?? '0.0.0',
  environment: (process.env.NODE_ENV as TelemetryEnvironment) ?? 'development',
  exporterEndpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
};

let activeExporter: TelemetryExporter | undefined;

export function initializeTelemetry(options: {
  resource?: Partial<TelemetryResource>;
  exporter?: TelemetryExporter;
} = {}): TelemetryResource {
  activeResource = {
    ...activeResource,
    ...options.resource,
    serviceName: options.resource?.serviceName ?? activeResource.serviceName,
    serviceVersion: options.resource?.serviceVersion ?? activeResource.serviceVersion,
    environment: options.resource?.environment ?? activeResource.environment,
  };
  activeExporter = options.exporter;
  return activeResource;
}

export function currentTraceContext(): TraceContext | undefined {
  return asyncContext.getStore();
}

export function runWithTraceContext<T>(
  partialContext: Partial<TraceContext>,
  callback: () => T,
): T {
  const parent = asyncContext.getStore();
  const context: TraceContext = {
    traceId: partialContext.traceId ?? parent?.traceId ?? randomHex(16),
    spanId: partialContext.spanId ?? randomHex(8),
    parentSpanId: partialContext.parentSpanId ?? parent?.spanId,
    requestId: partialContext.requestId ?? parent?.requestId ?? `req-${randomHex(6)}`,
    correlationId: partialContext.correlationId ?? parent?.correlationId ?? partialContext.requestId ?? `corr-${randomHex(6)}`,
  };
  return asyncContext.run(context, callback);
}

export async function withSpan<T>(
  name: string,
  attributes: Record<string, unknown>,
  callback: () => Promise<T> | T,
  kind: SpanRecord['kind'] = 'internal',
): Promise<T> {
  const parent = asyncContext.getStore();
  const spanContext: TraceContext = {
    traceId: parent?.traceId ?? randomHex(16),
    spanId: randomHex(8),
    parentSpanId: parent?.spanId,
    requestId: parent?.requestId ?? `req-${randomHex(6)}`,
    correlationId: parent?.correlationId ?? `corr-${randomHex(6)}`,
  };
  const span: SpanRecord = {
    name,
    kind,
    traceId: spanContext.traceId,
    spanId: spanContext.spanId,
    parentSpanId: spanContext.parentSpanId,
    attributes: sanitizeAttributes({
      ...attributes,
      'service.name': activeResource.serviceName,
      'service.version': activeResource.serviceVersion,
      'deployment.environment': activeResource.environment,
      'request.id': spanContext.requestId,
      'correlation.id': spanContext.correlationId,
    }),
    startedAt: new Date().toISOString(),
    status: 'unset',
  };

  try {
    return await asyncContext.run(spanContext, async () => {
      const result = await callback();
      span.status = 'ok';
      return result;
    });
  } catch (error) {
    span.status = 'error';
    span.errorType = error instanceof Error ? error.name : 'UnknownError';
    throw error;
  } finally {
    span.endedAt = new Date().toISOString();
    await safeExportSpan(span);
  }
}

export function normalizeRoute(method: string, url: string): string {
  const path = url.split('?')[0] || '/';
  const normalizedPath = path
    .replace(ROUTE_ID_PATTERN, '/:id')
    .replace(/\/+/g, '/')
    .replace(/\/$/, '') || '/';
  return `${method.toUpperCase()} ${normalizedPath}`;
}

export function telemetryHeaders(context: TraceContext = currentTraceContext() ?? runlessContext()): Record<string, string> {
  return {
    traceparent: `00-${context.traceId}-${context.spanId}-01`,
    'x-request-id': context.requestId,
    'x-correlation-id': context.correlationId,
  };
}

export function sanitizeAttributes(input: Record<string, unknown>): Record<string, string | number | boolean> {
  const output: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(input)) {
    const normalizedKey = key.toLowerCase();
    if (SENSITIVE_KEYS.some((sensitive) => normalizedKey.includes(sensitive))) {
      output[key] = '[REDACTED]';
      continue;
    }
    if (value === undefined || value === null) continue;
    if (typeof value === 'string') {
      output[key] = redactValue(value);
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      output[key] = value;
    } else {
      output[key] = redactValue(JSON.stringify(value));
    }
  }
  return output;
}

export function recordHttpMetric(method: string, route: string, statusCode: number, durationMs: number): MetricRecord {
  const metric: MetricRecord = {
    name: 'http.server.duration',
    value: durationMs,
    attributes: sanitizeAttributes({
      'http.request.method': method.toUpperCase(),
      'http.route': route,
      'http.response.status_code': statusCode,
      'error.type': statusCode >= 500 ? 'server_error' : statusCode >= 400 ? 'client_error' : '',
    }),
  };
  void safeExportMetric(metric);
  return metric;
}

export function recordDomainCounter(
  name: 'order_create' | 'order_correctness_error' | 'payment_webhook' | 'payment_correctness_error' | 'notification_outbox' | 'background_sync',
  attributes: Record<string, unknown>,
  value = 1,
): MetricRecord {
  const metric: MetricRecord = {
    name: `menumaker.${name}.total`,
    value,
    attributes: sanitizeAttributes(attributes),
  };
  void safeExportMetric(metric);
  return metric;
}

export function pinoRedactionPaths(): string[] {
  return [
    'req.headers.authorization',
    'req.headers.cookie',
    'res.headers["set-cookie"]',
    'request.headers.authorization',
    'request.headers.cookie',
    '*.password',
    '*.token',
    '*.secret',
    '*.email',
    '*.phone',
    '*.address',
    '*.payment',
    '*.card',
    '*.request_body',
    '*.body',
  ];
}

async function safeExportSpan(span: SpanRecord): Promise<void> {
  if (!activeExporter) return;
  try {
    await activeExporter.exportSpan(span);
  } catch {
    // Telemetry export must never block Tier 0 state transitions.
  }
}

async function safeExportMetric(metric: MetricRecord): Promise<void> {
  if (!activeExporter) return;
  try {
    await activeExporter.exportMetric(metric);
  } catch {
    // Metrics export is best-effort by design.
  }
}

function redactValue(value: string): string {
  return value
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [REDACTED]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[REDACTED_EMAIL]')
    .replace(/\+?[0-9][0-9 .()-]{7,}[0-9]/g, '[REDACTED_PHONE]')
    .replace(/(sk|pk|rk)_(test|live)_[A-Za-z0-9]+/g, '[REDACTED_KEY]');
}

function randomHex(bytes: number): string {
  return crypto.randomBytes(bytes).toString('hex');
}

function runlessContext(): TraceContext {
  return {
    traceId: randomHex(16),
    spanId: randomHex(8),
    requestId: `req-${randomHex(6)}`,
    correlationId: `corr-${randomHex(6)}`,
  };
}
