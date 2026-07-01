import { describe, expect, it } from '@jest/globals';
import { assertPublishedContract, createContextRegistry } from '../src/contexts/index';
import { asUTCDateTime, command, correlationId, event, idempotencyKey, type CommandMetadata } from '../src/kernel/contracts';

describe('context integration contracts', () => {
  it('models order to payment to notification as published contracts', () => {
    const registry = createContextRegistry();
    expect(registry.get('ordering')?.reads).toContain('Payment');
    expect(registry.get('paymentsBilling')?.reads).toContain('Order');
    expect(registry.get('notifications')?.reads).toContain('Order');

    const metadata: CommandMetadata = {
      commandId: 'cmd-place-order',
      idempotencyKey: idempotencyKey('place_order:cart-1:user-1'),
      actor: { actorId: 'user-1', roles: ['customer'], purpose: 'customer' },
      requestedAt: asUTCDateTime('2026-06-20T11:00:00Z'),
      correlationId: correlationId('corr-order-payment'),
    };

    const placeOrder = command('ordering', 'ordering.place_order', metadata, { cartId: 'cart-1' });
    const paymentAuthorized = event('paymentsBilling', 'payments.authorized', {
      schemaVersion: 1,
      eventId: 'evt-payment-authorized',
      occurredAt: asUTCDateTime('2026-06-20T11:00:02Z'),
      correlationId: correlationId('corr-order-payment'),
      causationId: placeOrder.metadata.commandId,
      orderingKey: 'order:order-1',
      retention: 'audit',
      replay: { owner: 'paymentsBilling', safe: true },
      payload: { orderId: 'order-1', paymentId: 'payment-1' },
    });

    expect(() => assertPublishedContract(placeOrder)).not.toThrow();
    expect(() => assertPublishedContract(paymentAuthorized)).not.toThrow();
  });
});
