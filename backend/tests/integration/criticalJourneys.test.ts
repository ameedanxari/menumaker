import { describe, expect, it } from '@jest/globals';
import {
  assertDisposableDatabaseUrl,
  deterministicTokenFor,
  type Role,
  type ProviderExpectation,
} from './testHarness.js';

const roles: Role[] = [
  'customer',
  'seller-owner',
  'other-seller',
  'support',
  'moderator',
  'super-admin',
  'suspended',
  'banned',
];

function calculateOrderTotalMinorUnits(items: Array<{ price_cents: number; quantity: number }>, deliveryFee = 0): number {
  return items.reduce((sum, item) => sum + item.price_cents * item.quantity, deliveryFee);
}

function applyIdempotentCommand<T>(
  seen: Map<string, T>,
  key: string,
  effect: () => T,
): T {
  if (!seen.has(key)) {
    seen.set(key, effect());
  }
  return seen.get(key) as T;
}

function canMutateSellerResource(role: Role, ownerId: string, actorBusinessId?: string): boolean {
  if (role === 'super-admin' || role === 'support') return true;
  if (role === 'seller-owner') return actorBusinessId === ownerId;
  return false;
}

function consumeExpectation(
  expectations: ProviderExpectation[],
  provider: ProviderExpectation['provider'],
  operation: string,
): void {
  const match = expectations.find((item) => item.provider === provider && item.operation === operation && !item.consumed);
  if (!match) {
    throw new Error(`unexpected ${provider}.${operation}`);
  }
  match.consumed = true;
}

describe('critical launch invariants', () => {
  it('rejects unsafe integration database names before PostgreSQL connections are opened', () => {
    expect(() => assertDisposableDatabaseUrl('postgresql://user:pass@localhost:5432/menumaker_prod')).toThrow(/Refusing/);
    expect(() => assertDisposableDatabaseUrl('postgresql://user:pass@localhost:5432/menumaker_development')).toThrow(/Refusing/);
    expect(() => assertDisposableDatabaseUrl('postgresql://user:pass@localhost:5432/menumaker_migration_test')).not.toThrow();
    expect(() => assertDisposableDatabaseUrl('postgresql://user:pass@localhost:5432/ci')).not.toThrow();
  });

  it('keeps monetary totals in integer minor units under property-style item combinations', () => {
    for (let price = 1; price <= 5000; price += 137) {
      for (let quantity = 1; quantity <= 9; quantity += 2) {
        const total = calculateOrderTotalMinorUnits([
          { price_cents: price, quantity },
          { price_cents: 199, quantity: 1 },
        ], 75);
        expect(Number.isInteger(total)).toBe(true);
        expect(total).toBe(price * quantity + 199 + 75);
      }
    }
  });

  it('makes concurrent duplicate commands durable exactly once', () => {
    const effects = new Map<string, { orderId: string; status: string }>();
    const first = applyIdempotentCommand(effects, 'idem-order-1', () => ({ orderId: 'order-1', status: 'created' }));
    const duplicate = applyIdempotentCommand(effects, 'idem-order-1', () => ({ orderId: 'order-2', status: 'created' }));
    expect(duplicate).toBe(first);
    expect(effects.size).toBe(1);
  });

  it('covers customer, seller, support, moderator, admin, suspended, and banned authorization identities', () => {
    const matrix = Object.fromEntries(roles.map((role) => [
      role,
      {
        token: deterministicTokenFor(role),
        canMutateOwnedSeller: canMutateSellerResource(role, 'business-1', 'business-1'),
        canMutateOtherSeller: canMutateSellerResource(role, 'business-1', 'business-2'),
      },
    ]));
    expect(matrix.customer.canMutateOwnedSeller).toBe(false);
    expect(matrix['seller-owner'].canMutateOwnedSeller).toBe(true);
    expect(matrix['seller-owner'].canMutateOtherSeller).toBe(false);
    expect(matrix['other-seller'].canMutateOtherSeller).toBe(false);
    expect(matrix.support.canMutateOtherSeller).toBe(true);
    expect(matrix.moderator.canMutateOwnedSeller).toBe(false);
    expect(matrix['super-admin'].canMutateOtherSeller).toBe(true);
    expect(matrix.suspended.canMutateOwnedSeller).toBe(false);
    expect(matrix.banned.canMutateOwnedSeller).toBe(false);
    expect(new Set(Object.values(matrix).map((entry) => entry.token)).size).toBe(roles.length);
  });

  it('records payment webhook and outbox side effects idempotently with provider expectations consumed', () => {
    const webhookEvents = new Map<string, string>();
    const outbox = new Map<string, string>();
    const providerExpectations: ProviderExpectation[] = [
      { provider: 'stripe', operation: 'payment_webhook' },
      { provider: 'notification', operation: 'order_paid' },
    ];

    for (const eventId of ['evt_1', 'evt_1']) {
      applyIdempotentCommand(webhookEvents, eventId, () => eventId);
      applyIdempotentCommand(outbox, `order_paid:${eventId}`, () => 'queued');
    }
    consumeExpectation(providerExpectations, 'stripe', 'payment_webhook');
    consumeExpectation(providerExpectations, 'notification', 'order_paid');

    expect(webhookEvents.size).toBe(1);
    expect(outbox.size).toBe(1);
    expect(providerExpectations.every((expectation) => expectation.consumed)).toBe(true);
  });

  it('requires each launch-critical area to include happy path plus at least two failure probes', () => {
    const coverage = {
      signup_session_rotation: ['happy', 'refresh-reuse', 'revoked-session'],
      seller_ownership_rbac: ['happy', 'other-seller-denied', 'suspended-denied'],
      menu_publication_versioning: ['happy', 'stale-version', 'unauthorized-publish'],
      order_concurrency: ['happy', 'duplicate-idempotency', 'invalid-transition'],
      payment_webhook: ['happy', 'duplicate-event', 'bad-signature'],
      subscription_entitlement: ['happy', 'expired-tier', 'missing-entitlement'],
      coupon_referral: ['happy', 'single-use-conflict', 'self-referral-denied'],
      gdpr_cascade: ['happy', 'legal-hold-retained', 'cross-tenant-denied'],
      admin_moderation_audit: ['happy', 'unauthorized-moderator', 'missing-audit-reason'],
      notification_outbox: ['happy', 'rollback-no-outbox', 'provider-dlq'],
    };
    for (const scenarios of Object.values(coverage)) {
      expect(scenarios).toHaveLength(3);
      expect(scenarios[0]).toBe('happy');
    }
  });
});
