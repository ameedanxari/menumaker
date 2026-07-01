import Fastify from 'fastify';
import { describe, expect, it, beforeEach } from '@jest/globals';
import {
  isMockChargeEnabled,
  isPaymentTransitionAllowed,
  paymentRoutes,
  processedStripeEventIds,
  recordStripeEventOnce,
} from '../src/routes/payments';

describe('payment webhook security helpers', () => {
  beforeEach(() => processedStripeEventIds.clear());

  it('removes production mock success and requires explicit test flag', async () => {
    expect(isMockChargeEnabled({ NODE_ENV: 'production', ENABLE_FAKE_PAYMENTS: 'true' })).toBe(false);
    expect(isMockChargeEnabled({ NODE_ENV: 'test', ENABLE_FAKE_PAYMENTS: 'true' })).toBe(true);

    const app = Fastify({ logger: false });
    const oldEnv = process.env.ENABLE_FAKE_PAYMENTS;
    process.env.ENABLE_FAKE_PAYMENTS = 'false';
    process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY ?? '<TEST_STRIPE_KEY_PLACEHOLDER>';
    await app.register(paymentRoutes);
    expect(app.hasRoute({ method: 'POST', url: '/mock-charge' })).toBe(false);
    await app.close();
    process.env.ENABLE_FAKE_PAYMENTS = oldEnv;
  });

  it('deduplicates signed event ids before local transition logic repeats', () => {
    expect(recordStripeEventOnce('evt_1')).toBe(true);
    expect(recordStripeEventOnce('evt_1')).toBe(false);
  });

  it('allows only monotonic payment status transitions', () => {
    expect(isPaymentTransitionAllowed('pending', 'succeeded')).toBe(true);
    expect(isPaymentTransitionAllowed('succeeded', 'refunded')).toBe(true);
    expect(isPaymentTransitionAllowed('succeeded', 'pending')).toBe(false);
    expect(isPaymentTransitionAllowed('failed', 'succeeded')).toBe(false);
  });
});
