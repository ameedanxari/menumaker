import { describe, expect, it, vi } from 'vitest';
import { ClientErrorReporter, sanitizePayload } from './errorReporter';

const basePayload = {
  platform: 'web' as const,
  release: '1.2.3',
  environment: 'staging' as const,
  operation: 'checkout.submit',
  correlation_id: 'corr-1',
};

describe('client error reporter', () => {
  it('attaches release/environment/operation/correlation and exports sanitized API failures', async () => {
    const send = vi.fn();
    const reporter = new ClientErrorReporter({ send });
    const payload = await reporter.reportApiFailure(503, {
      ...basePayload,
      message: 'failed for customer@example.com',
      metadata: {
        route: '/api/v1/orders',
        authorization: 'Bearer abc.def',
        request_body: { card: '4242424242424242' },
      },
    });

    expect(payload).toMatchObject({
      event: 'api_failure',
      release: '1.2.3',
      environment: 'staging',
      operation: 'checkout.submit',
      correlation_id: 'corr-1',
      error_code: 'http_503',
    });
    expect(JSON.stringify(payload)).not.toContain('customer@example.com');
    expect(JSON.stringify(payload)).not.toContain('Bearer abc.def');
    expect(JSON.stringify(payload)).not.toContain('4242424242424242');
    expect(send).toHaveBeenCalledWith(payload);
  });

  it('rejects sensitive keys and values before exporter calls', () => {
    const sanitized = sanitizePayload({
      ...basePayload,
      event: 'sync_failure',
      error_code: 'offline_conflict',
      message: 'phone +1 555 000 1111 failed',
      metadata: {
        token: 'raw-token',
        nested: {
          email: 'seller@example.com',
          safe_code: 'menu_sync',
        },
      },
    });

    expect(JSON.stringify(sanitized)).not.toContain('raw-token');
    expect(JSON.stringify(sanitized)).not.toContain('seller@example.com');
    expect(JSON.stringify(sanitized)).not.toContain('+1 555 000 1111');
    expect(sanitized.metadata?.nested).toMatchObject({ email: '[REDACTED]', safe_code: 'menu_sync' });
  });

  it('reports fatal boundary failures without request bodies', async () => {
    const send = vi.fn();
    const reporter = new ClientErrorReporter({ send });
    await reporter.reportFatalBoundary(new TypeError('boom sk_test_123'), {
      ...basePayload,
      platform: 'web',
      operation: 'seller.dashboard',
      metadata: { component: 'DashboardPage', body: '{"secret":"x"}' },
    });

    const sent = send.mock.calls[0][0];
    expect(sent.event).toBe('fatal_boundary');
    expect(JSON.stringify(sent)).not.toContain('sk_test_123');
    expect(JSON.stringify(sent)).not.toContain('{"secret":"x"}');
  });
});
