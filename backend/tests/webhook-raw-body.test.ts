import { describe, expect, it } from '@jest/globals';
import { getExactWebhookBody } from '../src/routes/payments';
import { getExactSubscriptionWebhookBody } from '../src/routes/subscriptions';

describe('webhook raw body boundaries', () => {
  it('captures exact bytes only for payment/subscription Stripe webhook paths', async () => {
    process.env.DATABASE_URL = process.env.DATABASE_URL ?? 'postgres://test:test@localhost:5432/test';
    process.env.FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:5173';
    const { shouldCaptureRawWebhookBody } = await import('../src/main');
    expect(shouldCaptureRawWebhookBody('/api/v1/payments/webhook')).toBe(true);
    expect(shouldCaptureRawWebhookBody('/api/v1/subscriptions/webhook?x=1')).toBe(true);
    expect(shouldCaptureRawWebhookBody('/api/v1/orders')).toBe(false);
  });

  it('rejects parsed objects so whitespace/key-order mutations cannot be signed accidentally', () => {
    const raw = Buffer.from('{ "id": "evt_1", "object": "event" }\n');
    expect(getExactWebhookBody({ rawBody: raw }).toString()).toBe(raw.toString());
    expect(getExactSubscriptionWebhookBody({ rawBody: raw }).toString()).toBe(raw.toString());
    expect(() => getExactWebhookBody({ body: { id: 'evt_1' } })).toThrow('Exact raw webhook body');
  });

  it('fails staging/production startup without webhook signing secrets', async () => {
    process.env.DATABASE_URL = process.env.DATABASE_URL ?? 'postgres://test:test@localhost:5432/test';
    process.env.FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:5173';
    const { assertWebhookSecretsConfigured } = await import('../src/main');
    expect(() => assertWebhookSecretsConfigured({ NODE_ENV: 'production' })).toThrow('Missing required webhook signing secret');
    expect(() => assertWebhookSecretsConfigured({
      NODE_ENV: 'production',
      STRIPE_WEBHOOK_SECRET: 'whsec_payment',
      STRIPE_WEBHOOK_SECRET_SUBSCRIPTIONS: 'whsec_sub',
    })).not.toThrow();
  });
});
