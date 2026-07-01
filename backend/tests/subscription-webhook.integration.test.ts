import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import Fastify from 'fastify';
import Stripe from 'stripe';
import {
  getExactSubscriptionWebhookBody,
  normalizeSubscriptionWebhookEventId,
  normalizeSubscriptionWebhookEventType,
  processedSubscriptionEventIds,
  recordSubscriptionEventOnce,
  releaseSubscriptionEventReceipt,
  subscriptionRoutes,
} from '../src/routes/subscriptions';
import { SubscriptionService } from '../src/services/SubscriptionService';

describe('subscription webhook idempotency helpers', () => {
  beforeEach(() => processedSubscriptionEventIds.clear());

  it('deduplicates subscription event ids for retry-safe responses', () => {
    expect(recordSubscriptionEventOnce('evt_sub_1')).toBe(true);
    expect(recordSubscriptionEventOnce('evt_sub_1')).toBe(false);
  });

  it('normalizes subscription event ids before receipt dedupe', () => {
    expect(normalizeSubscriptionWebhookEventId(' evt_sub_trimmed ')).toBe('evt_sub_trimmed');
    expect(recordSubscriptionEventOnce(' evt_sub_trimmed ')).toBe(true);
    expect(recordSubscriptionEventOnce('evt_sub_trimmed')).toBe(false);
    expect(Array.from(processedSubscriptionEventIds)).toEqual(['evt_sub_trimmed']);
  });

  it('rejects unsafe edge controls before trimming webhook event ids into receipt keys', () => {
    for (const eventId of ['\uFEFFevt_sub_edge_control', 'evt_sub_edge_control\uFEFF']) {
      expect(() => normalizeSubscriptionWebhookEventId(eventId)).toThrow(
        'Stripe subscription webhook event id must not include unsafe control characters'
      );
      expect(() => recordSubscriptionEventOnce(eventId)).toThrow(
        'Stripe subscription webhook event id must not include unsafe control characters'
      );
    }

    expect(processedSubscriptionEventIds.has('evt_sub_edge_control')).toBe(false);
    expect(processedSubscriptionEventIds.size).toBe(0);
  });

  it('rejects malformed subscription event ids before mutating receipt state', () => {
    for (const eventId of [undefined, null, '', '   ', 'evt_sub_\u0007bad', 'evt_sub_\u202Ebad']) {
      expect(() => recordSubscriptionEventOnce(eventId)).toThrow(
        typeof eventId === 'string' && eventId.trim().length > 0
          ? 'Stripe subscription webhook event id must not include unsafe control characters'
          : 'Stripe subscription webhook event id must be a non-empty string'
      );
    }

    expect(processedSubscriptionEventIds.size).toBe(0);
  });

  it('rejects oversized subscription event ids before mutating receipt state', () => {
    const oversizedEventId = `evt_sub_${'x'.repeat(256)}`;

    expect(() => normalizeSubscriptionWebhookEventId(oversizedEventId)).toThrow(
      'Stripe subscription webhook event id must be at most 255 characters'
    );
    expect(() => recordSubscriptionEventOnce(oversizedEventId)).toThrow(
      'Stripe subscription webhook event id must be at most 255 characters'
    );
    expect(processedSubscriptionEventIds.size).toBe(0);
  });

  it('normalizes and rejects malformed subscription event types before receipt workflows trust them', () => {
    expect(normalizeSubscriptionWebhookEventType(' customer.subscription.updated ')).toBe(
      'customer.subscription.updated'
    );

    for (const eventType of [undefined, null, '', '   ', 'customer.subscription.updated\uFEFF']) {
      expect(() => normalizeSubscriptionWebhookEventType(eventType)).toThrow(
        typeof eventType === 'string' && eventType.trim().length > 0
          ? 'Stripe subscription webhook event type must not include unsafe control characters'
          : 'Stripe subscription webhook event type must be a non-empty string'
      );
    }

    expect(() => normalizeSubscriptionWebhookEventType(`evt.${'x'.repeat(256)}`)).toThrow(
      'Stripe subscription webhook event type must be at most 255 characters'
    );
    expect(() => normalizeSubscriptionWebhookEventType('invoice.paid')).toThrow(
      'Stripe subscription webhook event type must be a supported subscription webhook event'
    );
    expect(processedSubscriptionEventIds.size).toBe(0);
  });

  it('releases subscription event receipts after handler failures so Stripe retries can process', () => {
    expect(recordSubscriptionEventOnce('evt_sub_retry_after_failure')).toBe(true);
    expect(recordSubscriptionEventOnce('evt_sub_retry_after_failure')).toBe(false);

    releaseSubscriptionEventReceipt('evt_sub_retry_after_failure');

    expect(recordSubscriptionEventOnce('evt_sub_retry_after_failure')).toBe(true);
  });

  it('requires exact raw bytes for subscription signature verification', () => {
    const raw = Buffer.from('{"id":"evt_sub_2","object":"event"}');
    expect(getExactSubscriptionWebhookBody({ rawBody: raw })).toBe(raw);
    expect(() => getExactSubscriptionWebhookBody({ body: { id: 'evt_sub_2' } })).toThrow('Exact raw subscription webhook body');
  });

  it('keeps disabled billing lifecycle routes gated while allowing webhook signature validation', async () => {
    const app = Fastify({ logger: false });
    app.decorate('authenticate', async () => undefined);

    try {
      await app.register(subscriptionRoutes);

      const tiersResponse = await app.inject({ method: 'GET', url: '/tiers' });
      expect(tiersResponse.statusCode).toBe(503);
      expect(tiersResponse.json()).toMatchObject({
        success: false,
        error: {
          code: 'FEATURE_UNAVAILABLE',
          capability: 'subscriptions',
        },
      });

      const webhookResponse = await app.inject({
        method: 'POST',
        url: '/webhook',
        payload: { id: 'evt_sub_missing_signature' },
      });
      expect(webhookResponse.statusCode).toBe(400);
      expect(webhookResponse.json()).toMatchObject({
        success: false,
        error: {
          code: 'MISSING_SIGNATURE',
        },
      });

      const webhookQueryResponse = await app.inject({
        method: 'POST',
        url: '/webhook?replay=true',
        payload: { id: 'evt_sub_replay_override' },
      });
      expect(webhookQueryResponse.statusCode).toBe(400);
      expect(webhookQueryResponse.json()).toMatchObject({
        success: false,
        error: {
          code: 'UNSUPPORTED_SUBSCRIPTION_FIELD',
          message: 'Unsupported subscription request field(s): replay',
        },
      });
    } finally {
      await app.close();
    }
  });

  it('releases subscription webhook receipts when local handling fails so signed retries are not duplicates', async () => {
    const originalStripeKey = process.env.STRIPE_SECRET_KEY;
    const originalWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET_SUBSCRIPTIONS;
    const webhookSecret = 'whsec_subscription_retry_test_secret';
    process.env.STRIPE_SECRET_KEY = 'sk_test_subscription_retry_receipt';
    process.env.STRIPE_WEBHOOK_SECRET_SUBSCRIPTIONS = webhookSecret;

    const app = Fastify({ logger: false });
    app.decorate('authenticate', async () => undefined);
    app.addContentTypeParser(
      'application/octet-stream',
      { parseAs: 'buffer' },
      (_request, body, done) => done(null, body)
    );
    const originalHandler = SubscriptionService.prototype.handleSubscriptionWebhook;
    const handler = jest
      .spyOn(SubscriptionService.prototype, 'handleSubscriptionWebhook')
      .mockRejectedValueOnce(new Error('local transaction failed before commit'))
      .mockResolvedValueOnce(null);

    const signingStripe = new Stripe('sk_test_subscription_retry_receipt', {
      apiVersion: '2024-11-20.acacia' as any,
    });
    const payload = JSON.stringify({
      id: 'evt_sub_retry_route_failure',
      object: 'event',
      type: 'customer.subscription.updated',
      created: 1780000000,
      data: {
        object: {
          id: 'sub_retry_route_failure',
          object: 'subscription',
          status: 'active',
        },
      },
    });
    const signature = signingStripe.webhooks.generateTestHeaderString({
      payload,
      secret: webhookSecret,
    });

    try {
      await app.register(subscriptionRoutes);

      const failedAttempt = await app.inject({
        method: 'POST',
        url: '/webhook',
        headers: {
          'stripe-signature': signature,
          'content-type': 'application/octet-stream',
        },
        payload: Buffer.from(payload),
      });
      expect(failedAttempt.statusCode).toBe(500);
      expect(handler).toHaveBeenCalledTimes(1);

      const retryAttempt = await app.inject({
        method: 'POST',
        url: '/webhook',
        headers: {
          'stripe-signature': signature,
          'content-type': 'application/octet-stream',
        },
        payload: Buffer.from(payload),
      });
      expect(retryAttempt.statusCode).toBe(200);
      expect(retryAttempt.json()).toMatchObject({
        success: true,
        data: {
          processed: true,
          eventId: 'evt_sub_retry_route_failure',
        },
      });
      expect(handler).toHaveBeenCalledTimes(2);

      const duplicateAttempt = await app.inject({
        method: 'POST',
        url: '/webhook',
        headers: {
          'stripe-signature': signature,
          'content-type': 'application/octet-stream',
        },
        payload: Buffer.from(payload),
      });
      expect(duplicateAttempt.statusCode).toBe(200);
      expect(duplicateAttempt.json()).toMatchObject({
        success: true,
        data: {
          processed: false,
          duplicate: true,
          eventId: 'evt_sub_retry_route_failure',
        },
      });
      expect(handler).toHaveBeenCalledTimes(2);
    } finally {
      await app.close();
      SubscriptionService.prototype.handleSubscriptionWebhook = originalHandler;
      handler.mockRestore();
      if (originalStripeKey === undefined) {
        delete process.env.STRIPE_SECRET_KEY;
      } else {
        process.env.STRIPE_SECRET_KEY = originalStripeKey;
      }
      if (originalWebhookSecret === undefined) {
        delete process.env.STRIPE_WEBHOOK_SECRET_SUBSCRIPTIONS;
      } else {
        process.env.STRIPE_WEBHOOK_SECRET_SUBSCRIPTIONS = originalWebhookSecret;
      }
    }
  });

  it('rejects oversized signed subscription webhook event ids before service handling or receipt mutation', async () => {
    const originalStripeKey = process.env.STRIPE_SECRET_KEY;
    const originalWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET_SUBSCRIPTIONS;
    const webhookSecret = 'whsec_subscription_oversized_event_id_test_secret';
    process.env.STRIPE_SECRET_KEY = 'sk_test_subscription_oversized_event_id';
    process.env.STRIPE_WEBHOOK_SECRET_SUBSCRIPTIONS = webhookSecret;

    const app = Fastify({ logger: false });
    app.decorate('authenticate', async () => undefined);
    app.addContentTypeParser(
      'application/octet-stream',
      { parseAs: 'buffer' },
      (_request, body, done) => done(null, body)
    );
    const handler = jest
      .spyOn(SubscriptionService.prototype, 'handleSubscriptionWebhook')
      .mockRejectedValue(new Error('handleSubscriptionWebhook should not be called'));

    const signingStripe = new Stripe('sk_test_subscription_oversized_event_id', {
      apiVersion: '2024-11-20.acacia' as any,
    });
    const oversizedEventId = `evt_sub_${'x'.repeat(256)}`;
    const payload = JSON.stringify({
      id: oversizedEventId,
      object: 'event',
      type: 'customer.subscription.updated',
      created: 1780000000,
      data: {
        object: {
          id: 'sub_oversized_event_id',
          object: 'subscription',
          status: 'active',
        },
      },
    });
    const signature = signingStripe.webhooks.generateTestHeaderString({
      payload,
      secret: webhookSecret,
    });

    try {
      await app.register(subscriptionRoutes);

      const response = await app.inject({
        method: 'POST',
        url: '/webhook',
        headers: {
          'stripe-signature': signature,
          'content-type': 'application/octet-stream',
        },
        payload: Buffer.from(payload),
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({
        success: false,
        error: {
          code: 'INVALID_SUBSCRIPTION_TEXT_FIELD',
          message: 'Stripe subscription webhook event id must be at most 255 characters',
        },
      });
      expect(handler).not.toHaveBeenCalled();
      expect(processedSubscriptionEventIds.size).toBe(0);
    } finally {
      await app.close();
      handler.mockRestore();
      if (originalStripeKey === undefined) {
        delete process.env.STRIPE_SECRET_KEY;
      } else {
        process.env.STRIPE_SECRET_KEY = originalStripeKey;
      }
      if (originalWebhookSecret === undefined) {
        delete process.env.STRIPE_WEBHOOK_SECRET_SUBSCRIPTIONS;
      } else {
        process.env.STRIPE_WEBHOOK_SECRET_SUBSCRIPTIONS = originalWebhookSecret;
      }
    }
  });

  it('rejects malformed signed subscription webhook event types before service handling or receipt mutation', async () => {
    const originalStripeKey = process.env.STRIPE_SECRET_KEY;
    const originalWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET_SUBSCRIPTIONS;
    const webhookSecret = 'whsec_subscription_unsafe_event_type_test_secret';
    process.env.STRIPE_SECRET_KEY = 'sk_test_subscription_unsafe_event_type';
    process.env.STRIPE_WEBHOOK_SECRET_SUBSCRIPTIONS = webhookSecret;

    const app = Fastify({ logger: false });
    app.decorate('authenticate', async () => undefined);
    app.addContentTypeParser(
      'application/octet-stream',
      { parseAs: 'buffer' },
      (_request, body, done) => done(null, body)
    );
    const handler = jest
      .spyOn(SubscriptionService.prototype, 'handleSubscriptionWebhook')
      .mockRejectedValue(new Error('handleSubscriptionWebhook should not be called'));

    const signingStripe = new Stripe('sk_test_subscription_unsafe_event_type', {
      apiVersion: '2024-11-20.acacia' as any,
    });
    const payload = JSON.stringify({
      id: 'evt_sub_unsafe_event_type',
      object: 'event',
      type: 'customer.subscription.updated\uFEFF',
      created: 1780000000,
      data: {
        object: {
          id: 'sub_unsafe_event_type',
          object: 'subscription',
          status: 'active',
        },
      },
    });
    const signature = signingStripe.webhooks.generateTestHeaderString({
      payload,
      secret: webhookSecret,
    });

    try {
      await app.register(subscriptionRoutes);

      const response = await app.inject({
        method: 'POST',
        url: '/webhook',
        headers: {
          'stripe-signature': signature,
          'content-type': 'application/octet-stream',
        },
        payload: Buffer.from(payload),
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({
        success: false,
        error: {
          code: 'INVALID_SUBSCRIPTION_TEXT_FIELD',
          message: 'Stripe subscription webhook event type must not include unsafe control characters',
        },
      });
      expect(handler).not.toHaveBeenCalled();
      expect(processedSubscriptionEventIds.size).toBe(0);
    } finally {
      await app.close();
      handler.mockRestore();
      if (originalStripeKey === undefined) {
        delete process.env.STRIPE_SECRET_KEY;
      } else {
        process.env.STRIPE_SECRET_KEY = originalStripeKey;
      }
      if (originalWebhookSecret === undefined) {
        delete process.env.STRIPE_WEBHOOK_SECRET_SUBSCRIPTIONS;
      } else {
        process.env.STRIPE_WEBHOOK_SECRET_SUBSCRIPTIONS = originalWebhookSecret;
      }
    }
  });

  it('rejects unsupported signed subscription webhook event types before service handling or receipt mutation', async () => {
    const originalStripeKey = process.env.STRIPE_SECRET_KEY;
    const originalWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET_SUBSCRIPTIONS;
    const webhookSecret = 'whsec_subscription_unsupported_event_type_test_secret';
    process.env.STRIPE_SECRET_KEY = 'sk_test_subscription_unsupported_event_type';
    process.env.STRIPE_WEBHOOK_SECRET_SUBSCRIPTIONS = webhookSecret;

    const app = Fastify({ logger: false });
    app.decorate('authenticate', async () => undefined);
    app.addContentTypeParser(
      'application/octet-stream',
      { parseAs: 'buffer' },
      (_request, body, done) => done(null, body)
    );
    const handler = jest
      .spyOn(SubscriptionService.prototype, 'handleSubscriptionWebhook')
      .mockRejectedValue(new Error('handleSubscriptionWebhook should not be called'));

    const signingStripe = new Stripe('sk_test_subscription_unsupported_event_type', {
      apiVersion: '2024-11-20.acacia' as any,
    });
    const payload = JSON.stringify({
      id: 'evt_sub_unsupported_event_type',
      object: 'event',
      type: 'invoice.paid',
      created: 1780000000,
      data: {
        object: {
          id: 'in_unsupported_event_type',
          object: 'invoice',
        },
      },
    });
    const signature = signingStripe.webhooks.generateTestHeaderString({
      payload,
      secret: webhookSecret,
    });

    try {
      await app.register(subscriptionRoutes);

      const response = await app.inject({
        method: 'POST',
        url: '/webhook',
        headers: {
          'stripe-signature': signature,
          'content-type': 'application/octet-stream',
        },
        payload: Buffer.from(payload),
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({
        success: false,
        error: {
          code: 'INVALID_SUBSCRIPTION_TEXT_FIELD',
          message: 'Stripe subscription webhook event type must be a supported subscription webhook event',
        },
      });
      expect(handler).not.toHaveBeenCalled();
      expect(processedSubscriptionEventIds.size).toBe(0);
    } finally {
      await app.close();
      handler.mockRestore();
      if (originalStripeKey === undefined) {
        delete process.env.STRIPE_SECRET_KEY;
      } else {
        process.env.STRIPE_SECRET_KEY = originalStripeKey;
      }
      if (originalWebhookSecret === undefined) {
        delete process.env.STRIPE_WEBHOOK_SECRET_SUBSCRIPTIONS;
      } else {
        process.env.STRIPE_WEBHOOK_SECRET_SUBSCRIPTIONS = originalWebhookSecret;
      }
    }
  });

});
