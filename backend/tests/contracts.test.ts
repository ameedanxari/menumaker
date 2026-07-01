import { describe, expect, it } from '@jest/globals';
import {
  asUTCDateTime,
  command,
  correlationId,
  event,
  idempotencyKey,
  money,
  type CommandMetadata,
} from '../src/kernel/contracts';

const metadata: CommandMetadata = {
  commandId: 'cmd-1',
  idempotencyKey: idempotencyKey('place_order:cart-1:user-1'),
  actor: { actorId: 'user-1', roles: ['customer'], purpose: 'customer' },
  requestedAt: asUTCDateTime('2026-06-20T11:00:00Z'),
  correlationId: correlationId('corr-1'),
};

describe('kernel contracts', () => {
  it('uses integer minor-unit money', () => {
    expect(money(1299, 'USD')).toEqual({ amountMinor: 1299, currency: 'USD' });
    expect(() => money(12.99, 'USD')).toThrow('integer minor units');
  });

  it('creates owned command envelopes', () => {
    const envelope = command('ordering', 'ordering.place_order', metadata, { cartId: 'cart-1' });
    expect(envelope.owner).toBe('ordering');
    expect(envelope.metadata.idempotencyKey).toBe('place_order:cart-1:user-1');
  });

  it('creates replayable domain event envelopes', () => {
    const envelope = event('paymentsBilling', 'payments.authorized', {
      schemaVersion: 1,
      eventId: 'evt-1',
      occurredAt: asUTCDateTime('2026-06-20T11:00:01Z'),
      correlationId: correlationId('corr-1'),
      causationId: 'cmd-1',
      orderingKey: 'payment:pay-1',
      retention: 'audit',
      replay: { owner: 'paymentsBilling', safe: true },
      payload: { paymentId: 'pay-1' },
    });
    expect(envelope.replay.owner).toBe('paymentsBilling');
    expect(envelope.orderingKey).toBe('payment:pay-1');
  });
});
