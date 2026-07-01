import { describe, expect, it } from '@jest/globals';
import {
  initializeTelemetry,
  normalizeRoute,
  pinoRedactionPaths,
  recordDomainCounter,
  recordHttpMetric,
  runWithTraceContext,
  sanitizeAttributes,
  telemetryHeaders,
  withSpan,
  type MetricRecord,
  type SpanRecord,
} from '../src/observability/telemetry';

describe('telemetry foundation', () => {
  it('correlates request, SQL, provider, outbox, and worker spans under one trace', async () => {
    const spans: SpanRecord[] = [];
    initializeTelemetry({
      resource: {
        serviceName: 'menumaker-api',
        serviceVersion: 'test',
        environment: 'test',
      },
      exporter: {
        async exportSpan(span) {
          spans.push(span);
        },
        async exportMetric() {},
      },
    });

    await runWithTraceContext({ traceId: 'a'.repeat(32), spanId: 'b'.repeat(16), requestId: 'req-1', correlationId: 'corr-1' }, async () => {
      await withSpan('POST /api/v1/orders', { 'http.route': '/api/v1/orders', authorization: 'Bearer secret' }, async () => {
        await withSpan('SQL transaction', { 'db.system': 'postgresql', query: 'select * from users where email=test@example.com' }, async () => undefined, 'client');
        await withSpan('Stripe payment intent', { provider: 'stripe', payment_token: 'sk_test_123' }, async () => undefined, 'client');
        await withSpan('outbox publish', { event: 'order.created', address: '123 Test St' }, async () => undefined, 'producer');
        await withSpan('worker dispatch', { worker: 'notification', phone: '+1 555 111 2222' }, async () => undefined, 'consumer');
      }, 'server');
    });

    expect(new Set(spans.map((span) => span.traceId))).toEqual(new Set(['a'.repeat(32)]));
    expect(spans.map((span) => span.name)).toEqual(expect.arrayContaining([
      'POST /api/v1/orders',
      'SQL transaction',
      'Stripe payment intent',
      'outbox publish',
      'worker dispatch',
    ]));
    expect(JSON.stringify(spans)).not.toContain('sk_test_123');
    expect(JSON.stringify(spans)).not.toContain('test@example.com');
    expect(JSON.stringify(spans)).not.toContain('+1 555 111 2222');
  });

  it('bounds route cardinality and emits W3C trace headers', () => {
    const route = normalizeRoute('get', '/api/v1/orders/ord_1234567890abcdef?include=items');
    expect(route).toBe('GET /api/v1/orders/:id');

    const headers = runWithTraceContext({ traceId: 'c'.repeat(32), spanId: 'd'.repeat(16), requestId: 'req-2', correlationId: 'corr-2' }, () => telemetryHeaders());
    expect(headers.traceparent).toBe(`00-${'c'.repeat(32)}-${'d'.repeat(16)}-01`);
    expect(headers['x-request-id']).toBe('req-2');
    expect(headers['x-correlation-id']).toBe('corr-2');
  });

  it('redacts sensitive keys and values before log/export calls', () => {
    expect(sanitizeAttributes({
      authorization: 'Bearer abc.def',
      email: 'customer@example.com',
      phone: '+1 555 999 0000',
      safe: 'order.created',
    })).toEqual({
      authorization: '[REDACTED]',
      email: '[REDACTED]',
      phone: '[REDACTED]',
      safe: 'order.created',
    });
    expect(pinoRedactionPaths()).toEqual(expect.arrayContaining(['req.headers.authorization', '*.password', '*.payment']));
  });

  it('records RED/domain metrics and swallows exporter failures', async () => {
    const metrics: MetricRecord[] = [];
    initializeTelemetry({
      exporter: {
        async exportSpan() {
          throw new Error('xray down');
        },
        async exportMetric(metric) {
          metrics.push(metric);
          throw new Error('cloudwatch down');
        },
      },
    });

    await expect(withSpan('state commit', {}, async () => 'committed')).resolves.toBe('committed');
    const httpMetric = recordHttpMetric('POST', '/api/v1/orders', 201, 42);
    const domainMetric = recordDomainCounter('order_correctness_error', { type: 'duplicate', payment_metadata: 'secret' });
    expect(httpMetric.name).toBe('http.server.duration');
    expect(domainMetric.attributes.payment_metadata).toBe('[REDACTED]');
    expect(metrics.length).toBeGreaterThanOrEqual(1);
  });
});
