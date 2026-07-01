import { describe, expect, it, jest } from '@jest/globals';
import { Subscription } from '../src/models/Subscription';
import {
  SubscriptionService,
  applyStripeSubscriptionDeleted,
  applyStripeSubscriptionSnapshot,
  evaluateSubscriptionOrderLimit,
  getSubscriptionBillingPeriod,
} from '../src/services/SubscriptionService';

function createSubscription(tier: Subscription['tier'], overrides: Partial<Subscription> = {}): Subscription {
  const subscription = new Subscription();
  subscription.id = 'subscription-1';
  subscription.business_id = 'business-1';
  subscription.tier = tier;
  subscription.status = 'active';
  subscription.cancel_at_period_end = false;
  if (tier !== 'free') {
    subscription.stripe_subscription_id = 'sub_123';
    subscription.stripe_price_id = `price_${tier}`;
    subscription.current_period_start = new Date('2026-06-01T00:00:00.000Z');
    subscription.current_period_end = new Date('2026-06-30T23:59:59.999Z');
  }
  Object.assign(subscription, overrides);
  return subscription;
}

function stripeSubscriptionItems(priceId = 'price_starter') {
  return {
    data: [
      {
        price: {
          id: priceId,
        },
      },
    ],
  };
}

function createRepository<T extends Record<string, any>>(rows: T[] = []) {
  return {
    rows,
    create: jest.fn((input: Partial<T>) => input as T),
    save: jest.fn(async (entity: T) => {
      const existingIndex = rows.findIndex((row) => row.id === entity.id);
      if (existingIndex >= 0) rows[existingIndex] = entity;
      else rows.push(entity);
      return entity;
    }),
    findOne: jest.fn(async (options: { where: Record<string, any> }) => {
      const row = rows.find((candidate) =>
        Object.entries(options.where).every(([key, value]) => candidate[key] === value)
      );
      return row ?? null;
    }),
    find: jest.fn(async () => rows),
    count: jest.fn(async () => 0),
  };
}

describe('SubscriptionService Stripe boundary', () => {
  it('constructs without Stripe while disabled and fails operations through the capability registry', async () => {
    const originalStripeKey = process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_SECRET_KEY;
    const subscriptionRepository = createRepository<any>();
    const businessRepository = createRepository<any>([
      { id: 'business-1', name: 'Cafe', email: 'owner@example.com' },
    ]);
    const orderRepository = createRepository();
    const stripe = {
      customers: { create: jest.fn() },
      subscriptions: {
        create: jest.fn(),
        cancel: jest.fn(),
        update: jest.fn(),
      },
      billingPortal: {
        sessions: { create: jest.fn() },
      },
    };

    try {
      const service = new SubscriptionService({
        stripe: stripe as any,
        subscriptionRepository: subscriptionRepository as any,
        businessRepository: businessRepository as any,
        orderRepository: orderRepository as any,
      });

      await expect(service.createSubscription('business-1', 'free')).rejects.toMatchObject({
        code: 'FEATURE_UNAVAILABLE',
        capability: 'subscriptions',
      });
      await expect(service.checkOrderLimit('business-1')).rejects.toMatchObject({
        code: 'FEATURE_UNAVAILABLE',
        capability: 'subscriptions',
      });
      await expect(service.createStripeCustomer({ id: 'business-1', name: 'Cafe', email: 'owner@example.com' } as any))
        .rejects.toMatchObject({
          code: 'FEATURE_UNAVAILABLE',
          capability: 'subscriptions',
        });
      await expect(service.cancelSubscription('business-1')).rejects.toMatchObject({
        code: 'FEATURE_UNAVAILABLE',
        capability: 'subscriptions',
      });
      await expect(service.resumeSubscription('business-1')).rejects.toMatchObject({
        code: 'FEATURE_UNAVAILABLE',
        capability: 'subscriptions',
      });
      await expect(service.getSubscription('business-1')).rejects.toMatchObject({
        code: 'FEATURE_UNAVAILABLE',
        capability: 'subscriptions',
      });
      await expect(service.handleSubscriptionWebhook({
        type: 'customer.subscription.updated',
        created: 1780000000,
        data: { object: { id: 'sub_123', status: 'active' } },
      } as any)).rejects.toMatchObject({
        code: 'FEATURE_UNAVAILABLE',
        capability: 'subscriptions',
      });
      await expect(service.createPortalSession('business-1', 'https://example.com/return'))
        .rejects.toMatchObject({
          code: 'FEATURE_UNAVAILABLE',
          capability: 'subscriptions',
        });
      await expect(service.getAllSubscriptions()).rejects.toMatchObject({
        code: 'FEATURE_UNAVAILABLE',
        capability: 'subscriptions',
      });

      expect(businessRepository.findOne).not.toHaveBeenCalled();
      expect(subscriptionRepository.findOne).not.toHaveBeenCalled();
      expect(subscriptionRepository.find).not.toHaveBeenCalled();
      expect(subscriptionRepository.save).not.toHaveBeenCalled();
      expect(orderRepository.count).not.toHaveBeenCalled();
      expect(stripe.customers.create).not.toHaveBeenCalled();
      expect(stripe.subscriptions.create).not.toHaveBeenCalled();
      expect(stripe.subscriptions.cancel).not.toHaveBeenCalled();
      expect(stripe.subscriptions.update).not.toHaveBeenCalled();
      expect(stripe.billingPortal.sessions.create).not.toHaveBeenCalled();
    } finally {
      if (originalStripeKey) process.env.STRIPE_SECRET_KEY = originalStripeKey;
    }
  });

  it('can downgrade/create a free subscription without constructing a Stripe client', async () => {
    const subscriptionRepository = createRepository<any>();
    const businessRepository = createRepository<any>([
      { id: 'business-1', name: 'Cafe', email: 'owner@example.com' },
    ]);
    const service = new SubscriptionService({
      requireStripe: false,
      enforceCapability: false,
      subscriptionRepository: subscriptionRepository as any,
      businessRepository: businessRepository as any,
      orderRepository: createRepository() as any,
    });

    const result = await service.createSubscription('business-1', 'free');

    expect(result).not.toHaveProperty('clientSecret');
    expect(result.subscription).toMatchObject({
      business_id: 'business-1',
      tier: 'free',
      status: 'active',
    });
    expect(subscriptionRepository.save).toHaveBeenCalled();
  });

  it('clears provider lifecycle fields durably when downgrading a paid subscription to free', async () => {
    const subscription = createSubscription('starter', {
      status: 'active',
      stripe_customer_id: 'cus_123',
      stripe_subscription_id: 'sub_123',
      stripe_price_id: 'price_starter',
      current_period_start: new Date('2026-06-01T00:00:00.000Z'),
      current_period_end: new Date('2026-06-30T23:59:59.000Z'),
      cancel_at_period_end: true,
      canceled_at: new Date('2026-06-15T00:00:00.000Z'),
      trial_start: new Date('2026-06-01T00:00:00.000Z'),
      trial_end: new Date('2026-06-14T23:59:59.000Z'),
      metadata: {
        stripe_last_event_created: 1780272000,
        stripe_last_event_type: 'customer.subscription.updated',
      },
    });
    const subscriptionRepository = createRepository<any>([subscription]);
    const businessRepository = createRepository<any>([
      { id: 'business-1', name: 'Cafe', email: 'owner@example.com' },
    ]);
    const stripe = {
      subscriptions: {
        update: jest.fn(async () => ({
          id: 'sub_123',
          status: 'active',
          cancel_at_period_end: true,
        })),
      },
    };
    const service = new SubscriptionService({
      stripe: stripe as any,
      enforceCapability: false,
      subscriptionRepository: subscriptionRepository as any,
      businessRepository: businessRepository as any,
      orderRepository: createRepository() as any,
    });

    const result = await service.createSubscription('business-1', 'free');

    expect(stripe.subscriptions.update).toHaveBeenCalledWith('sub_123', {
      cancel_at_period_end: true,
    });
    expect(result).not.toHaveProperty('clientSecret');
    expect(result.subscription).toMatchObject({
      business_id: 'business-1',
      tier: 'free',
      status: 'active',
      cancel_at_period_end: false,
      stripe_customer_id: 'cus_123',
      stripe_subscription_id: null,
      stripe_price_id: null,
      current_period_start: null,
      current_period_end: null,
      canceled_at: null,
      trial_start: null,
      trial_end: null,
      metadata: null,
    });
    expect(subscriptionRepository.save).toHaveBeenLastCalledWith(expect.objectContaining({
      tier: 'free',
      status: 'active',
      cancel_at_period_end: false,
      stripe_subscription_id: null,
      stripe_price_id: null,
      current_period_start: null,
      current_period_end: null,
      canceled_at: null,
      trial_start: null,
      trial_end: null,
      metadata: null,
    }));
  });

  it('rejects invalid subscription tiers before repository writes or provider calls', async () => {
    const subscriptionRepository = createRepository<any>();
    const businessRepository = createRepository<any>([
      { id: 'business-1', name: 'Cafe', email: 'owner@example.com' },
    ]);
    const stripe = {
      customers: { create: jest.fn() },
      subscriptions: { create: jest.fn() },
    };
    const service = new SubscriptionService({
      stripe: stripe as any,
      enforceCapability: false,
      subscriptionRepository: subscriptionRepository as any,
      businessRepository: businessRepository as any,
      orderRepository: createRepository() as any,
    });

    await expect(
      service.createSubscription('business-1', 'enterprise' as any)
    ).rejects.toThrow('subscription tier has an invalid tier');

    expect(businessRepository.findOne).not.toHaveBeenCalled();
    expect(subscriptionRepository.findOne).not.toHaveBeenCalled();
    expect(subscriptionRepository.create).not.toHaveBeenCalled();
    expect(subscriptionRepository.save).not.toHaveBeenCalled();
    expect(stripe.customers.create).not.toHaveBeenCalled();
    expect(stripe.subscriptions.create).not.toHaveBeenCalled();
  });

  it('rejects malformed subscription trial days before repository reads or provider calls', async () => {
    const subscriptionRepository = createRepository<any>();
    const businessRepository = createRepository<any>([
      { id: 'business-1', name: 'Cafe', email: 'owner@example.com' },
    ]);
    const stripe = {
      customers: { create: jest.fn() },
      subscriptions: { create: jest.fn() },
    };
    const service = new SubscriptionService({
      stripe: stripe as any,
      enforceCapability: false,
      subscriptionRepository: subscriptionRepository as any,
      businessRepository: businessRepository as any,
      orderRepository: createRepository() as any,
    });

    await expect(
      service.createSubscription('business-1', 'starter', { trialDays: 0 })
    ).rejects.toThrow('subscription trialDays must be a positive safe integer between 1 and 365');
    await expect(
      service.createSubscription('business-1', 'starter', { trialDays: 366 })
    ).rejects.toThrow('subscription trialDays must be a positive safe integer between 1 and 365');
    await expect(
      service.createSubscription('business-1', 'starter', { trialDays: 1.5 })
    ).rejects.toThrow('subscription trialDays must be a positive safe integer between 1 and 365');
    await expect(
      service.createSubscription('business-1', 'starter', { trialDays: 'abc' as any })
    ).rejects.toThrow('subscription trialDays must be a positive safe integer between 1 and 365');

    expect(businessRepository.findOne).not.toHaveBeenCalled();
    expect(subscriptionRepository.findOne).not.toHaveBeenCalled();
    expect(subscriptionRepository.create).not.toHaveBeenCalled();
    expect(subscriptionRepository.save).not.toHaveBeenCalled();
    expect(stripe.customers.create).not.toHaveBeenCalled();
    expect(stripe.subscriptions.create).not.toHaveBeenCalled();
  });

  it('rejects malformed subscription creation option payloads before repository reads or provider calls', async () => {
    const subscriptionRepository = createRepository<any>();
    const businessRepository = createRepository<any>([
      { id: 'business-1', name: 'Cafe', email: 'owner@example.com' },
    ]);
    const stripe = {
      customers: { create: jest.fn() },
      subscriptions: { create: jest.fn() },
    };
    const service = new SubscriptionService({
      stripe: stripe as any,
      enforceCapability: false,
      subscriptionRepository: subscriptionRepository as any,
      businessRepository: businessRepository as any,
      orderRepository: createRepository() as any,
    });

    await expect(
      service.createSubscription('business-1', 'starter', null as any)
    ).rejects.toThrow('subscription creation options must be an object');
    await expect(
      service.createSubscription('business-1', 'starter', [] as any)
    ).rejects.toThrow('subscription creation options must be an object');
    await expect(
      service.createSubscription('business-1', 'starter', {
        trialDays: 14,
        providerOverride: 'shadow-stripe',
      } as any)
    ).rejects.toThrow(
      'subscription creation options include unsupported field(s): providerOverride'
    );
    await expect(
      service.createSubscription('business-1', 'starter', {
        trialDays: 14,
        ['providerOverride\uFEFF']: 'shadow-stripe',
      } as any)
    ).rejects.toThrow(
      'subscription creation options field names must not include unsafe control characters'
    );

    expect(businessRepository.findOne).not.toHaveBeenCalled();
    expect(subscriptionRepository.findOne).not.toHaveBeenCalled();
    expect(subscriptionRepository.create).not.toHaveBeenCalled();
    expect(subscriptionRepository.save).not.toHaveBeenCalled();
    expect(stripe.customers.create).not.toHaveBeenCalled();
    expect(stripe.subscriptions.create).not.toHaveBeenCalled();
  });

  it('rejects malformed subscription customer identity before repository or provider side effects', async () => {
    const subscriptionRepository = createRepository<any>();
    const businessRepository = createRepository<any>([
      { id: 'business-1', name: 'Cafe', email: 'owner@example.com' },
    ]);
    const stripe = {
      customers: { create: jest.fn() },
      subscriptions: { create: jest.fn() },
    };
    const service = new SubscriptionService({
      stripe: stripe as any,
      enforceCapability: false,
      subscriptionRepository: subscriptionRepository as any,
      businessRepository: businessRepository as any,
      orderRepository: createRepository() as any,
    });

    await expect(service.createSubscription('   ', 'free')).rejects.toThrow(
      'subscription business_id must be a non-empty string'
    );
    await expect(
      service.createSubscription('business-1', 'starter', { email: 'not-an-email' })
    ).rejects.toThrow('subscription customer email must be a valid email address');
    await expect(
      service.createStripeCustomer({ id: 'business-1', name: '   ', email: 'owner@example.com' } as any)
    ).rejects.toThrow('subscription business name must be a non-empty string');
    await expect(service.createSubscription('business\u0000-1', 'free')).rejects.toThrow(
      'subscription business_id must not include unsafe control characters'
    );
    await expect(service.createSubscription('business\u202E-1', 'free')).rejects.toThrow(
      'subscription business_id must not include unsafe control characters'
    );
    await expect(service.createSubscription('\uFEFFbusiness-1', 'free')).rejects.toThrow(
      'subscription business_id must not include unsafe control characters'
    );
    await expect(service.createSubscription('business-1', '\uFEFFfree' as any)).rejects.toThrow(
      'subscription tier must not include unsafe control characters'
    );
    await expect(
      service.createSubscription('business-1', 'starter', { email: 'billing\u0007@example.com' })
    ).rejects.toThrow('subscription customer email must not include unsafe control characters');
    await expect(
      service.createSubscription('business-1', 'starter', { email: '\uFEFFbilling@example.com' })
    ).rejects.toThrow('subscription customer email must not include unsafe control characters');
    await expect(
      service.createStripeCustomer({ id: 'business-1', name: 'Cafe\u007FBlue', email: 'owner@example.com' } as any)
    ).rejects.toThrow('subscription business name must not include unsafe control characters');
    await expect(
      service.createStripeCustomer({ id: 'business-1', name: 'Cafe Blue\uFEFF', email: 'owner@example.com' } as any)
    ).rejects.toThrow('subscription business name must not include unsafe control characters');
    await expect(
      service.createStripeCustomer({ id: 'business-1', name: 'Cafe', email: 'bad-email' } as any)
    ).rejects.toThrow('subscription business email must be a valid email address');

    expect(businessRepository.findOne).not.toHaveBeenCalled();
    expect(subscriptionRepository.findOne).not.toHaveBeenCalled();
    expect(subscriptionRepository.create).not.toHaveBeenCalled();
    expect(subscriptionRepository.save).not.toHaveBeenCalled();
    expect(stripe.customers.create).not.toHaveBeenCalled();
    expect(stripe.subscriptions.create).not.toHaveBeenCalled();
  });

  it('rejects unsupported subscription business row fields before Stripe customer creation', async () => {
    const subscriptionRepository = createRepository<any>();
    const businessRepository = createRepository<any>();
    const stripe = {
      customers: { create: jest.fn() },
      subscriptions: { create: jest.fn() },
    };
    const service = new SubscriptionService({
      stripe: stripe as any,
      enforceCapability: false,
      subscriptionRepository: subscriptionRepository as any,
      businessRepository: businessRepository as any,
      orderRepository: createRepository() as any,
    });

    await expect(
      service.createStripeCustomer({
        id: 'business-1',
        name: 'Cafe Blue',
        email: 'owner@example.com',
        provider_trace_id: 'trace-123',
      } as any)
    ).rejects.toThrow(
      'subscription business include unsupported field(s): provider_trace_id'
    );
    await expect(
      service.createStripeCustomer({
        id: 'business-1',
        name: 'Cafe Blue',
        email: 'owner@example.com',
        ['provider_trace_id\uFEFF']: 'trace-123',
      } as any)
    ).rejects.toThrow(
      'subscription business field names must not include unsafe control characters'
    );

    expect(stripe.customers.create).not.toHaveBeenCalled();
    expect(stripe.subscriptions.create).not.toHaveBeenCalled();
    expect(subscriptionRepository.save).not.toHaveBeenCalled();
  });

  it('normalizes subscription business and customer identity before Stripe customer metadata', async () => {
    const subscriptionRepository = createRepository<any>();
    const businessRepository = createRepository<any>([
      { id: 'business-1', name: '  Cafe Blue  ', email: ' owner@example.com ' },
    ]);
    const stripe = {
      customers: {
        create: jest.fn(async () => ({ id: 'cus_123' })),
      },
      subscriptions: {
        create: jest.fn(async () => ({
          id: 'sub_123',
          status: 'trialing',
          current_period_start: 1780272000,
          current_period_end: 1782863999,
          trial_start: 1780272000,
          trial_end: 1782863999,
          items: stripeSubscriptionItems(),
          latest_invoice: null,
        })),
      },
    };
    const service = new SubscriptionService({
      stripe: stripe as any,
      enforceCapability: false,
      subscriptionRepository: subscriptionRepository as any,
      businessRepository: businessRepository as any,
      orderRepository: createRepository() as any,
    });

    const result = await service.createSubscription(' business-1 ', 'starter', {
      email: ' billing@example.com ',
      trialDays: '30' as any,
    });

    expect(stripe.customers.create).toHaveBeenCalledWith({
      email: 'billing@example.com',
      name: 'Cafe Blue',
      metadata: {
        business_id: 'business-1',
        business_name: 'Cafe Blue',
      },
    });
    expect(stripe.subscriptions.create).toHaveBeenCalledWith(expect.objectContaining({
      customer: 'cus_123',
      trial_period_days: 30,
      metadata: {
        business_id: 'business-1',
        tier: 'starter',
      },
    }));
    expect(result.subscription).toMatchObject({
      business_id: 'business-1',
      tier: 'starter',
      stripe_customer_id: 'cus_123',
      stripe_subscription_id: 'sub_123',
    });
    expect(result).not.toHaveProperty('clientSecret');
  });

  it('rejects Stripe customer creation responses with contradictory identity evidence before persistence', async () => {
    const cases: Array<{
      responseOverride: Record<string, unknown>;
      expectedError: string;
    }> = [
      {
        responseOverride: { email: 'elsewhere@example.com' },
        expectedError: 'Stripe customer email must match requested subscription customer email',
      },
      {
        responseOverride: { name: 'Elsewhere Cafe' },
        expectedError: 'Stripe customer name must match requested subscription business name',
      },
      {
        responseOverride: { metadata: [] },
        expectedError: 'Stripe customer metadata must be an object',
      },
      {
        responseOverride: {
          metadata: {
            business_id: 'business-1',
            business_name: 'Cafe Blue',
            provider_trace_id: 'trace-123',
          },
        },
        expectedError: 'Stripe customer metadata include unsupported field(s): provider_trace_id',
      },
      {
        responseOverride: {
          metadata: {
            business_id: 'business-1',
            business_name: 'Cafe Blue',
            'provider_trace_id\uFEFF': 'trace-123',
          },
        },
        expectedError: 'Stripe customer metadata field names must not include unsafe control characters',
      },
      {
        responseOverride: { metadata: { business_id: 'business-elsewhere' } },
        expectedError: 'Stripe customer metadata business_id must match requested subscription business_id',
      },
      {
        responseOverride: { metadata: { business_id: 'business-1\u0000' } },
        expectedError: 'Stripe customer metadata business_id must not include unsafe control characters',
      },
      {
        responseOverride: { metadata: { business_id: '\uFEFFbusiness-1' } },
        expectedError: 'Stripe customer metadata business_id must not include unsafe control characters',
      },
      {
        responseOverride: { metadata: { business_name: 'Elsewhere Cafe' } },
        expectedError: 'Stripe customer metadata business_name must match requested subscription business name',
      },
      {
        responseOverride: { metadata: { business_name: 'Cafe\u0007Blue' } },
        expectedError: 'Stripe customer metadata business_name must not include unsafe control characters',
      },
    ];

    for (const { responseOverride, expectedError } of cases) {
      const subscription = createSubscription('free');
      const subscriptionRepository = createRepository<any>([subscription]);
      const businessRepository = createRepository<any>([
        { id: 'business-1', name: 'Cafe Blue', email: 'owner@example.com' },
      ]);
      const stripe = {
        customers: {
          create: jest.fn(async () => ({
            id: 'cus_123',
            ...responseOverride,
          })),
        },
        subscriptions: {
          create: jest.fn(),
        },
      };
      const service = new SubscriptionService({
        stripe: stripe as any,
        enforceCapability: false,
        subscriptionRepository: subscriptionRepository as any,
        businessRepository: businessRepository as any,
        orderRepository: createRepository() as any,
      });

      await expect(
        service.createSubscription('business-1', 'starter', { email: 'billing@example.com' })
      ).rejects.toMatchObject({
        message: `Failed to create Stripe customer: ${expectedError}`,
        statusCode: 500,
        code: 'STRIPE_CUSTOMER_CREATION_FAILED',
      });

      expect(stripe.customers.create).toHaveBeenCalledWith({
        email: 'billing@example.com',
        name: 'Cafe Blue',
        metadata: {
          business_id: 'business-1',
          business_name: 'Cafe Blue',
        },
      });
      expect(stripe.subscriptions.create).not.toHaveBeenCalled();
      expect(subscriptionRepository.save).not.toHaveBeenCalled();
      expect(subscription).toMatchObject({
        tier: 'free',
        status: 'active',
        stripe_customer_id: undefined,
        stripe_subscription_id: undefined,
      });
    }
  });

  it('rejects Stripe trialing creation responses without trial-period evidence before persisting upgrade', async () => {
    const subscription = createSubscription('free', {
      stripe_customer_id: 'cus_123',
    });
    const subscriptionRepository = createRepository<any>([subscription]);
    const businessRepository = createRepository<any>([
      { id: 'business-1', name: 'Cafe Blue', email: 'owner@example.com' },
    ]);
    const stripe = {
      subscriptions: {
        create: jest.fn(async () => ({
          id: 'sub_123',
          status: 'trialing',
          current_period_start: 1780272000,
          current_period_end: 1782863999,
          trial_start: null,
          trial_end: null,
          latest_invoice: null,
        })),
      },
    };
    const service = new SubscriptionService({
      stripe: stripe as any,
      enforceCapability: false,
      subscriptionRepository: subscriptionRepository as any,
      businessRepository: businessRepository as any,
      orderRepository: createRepository() as any,
    });

    await expect(service.createSubscription('business-1', 'starter')).rejects.toMatchObject({
      message: 'Failed to create subscription: Stripe trialing subscription must include trial period',
      statusCode: 500,
      code: 'SUBSCRIPTION_CREATION_FAILED',
    });

    expect(stripe.subscriptions.create).toHaveBeenCalledTimes(1);
    expect(subscriptionRepository.save).not.toHaveBeenCalled();
    expect(subscription).toMatchObject({
      tier: 'free',
      status: 'active',
      stripe_subscription_id: undefined,
      stripe_price_id: undefined,
      current_period_start: undefined,
      current_period_end: undefined,
      trial_start: undefined,
      trial_end: undefined,
    });
  });

  it('rejects Stripe creation responses with missing or mismatched item price evidence before persisting upgrades', async () => {
    const cases: Array<{
      name: string;
      items?: unknown;
      expectedError: string;
    }> = [
      {
        name: 'missing item evidence',
        expectedError: 'Stripe subscription must include item price evidence',
      },
      {
        name: 'mismatched item price',
        items: stripeSubscriptionItems('price_pro'),
        expectedError: 'Stripe subscription item price id must match requested tier',
      },
      {
        name: 'multiple item prices',
        items: {
          data: [
            { price: { id: 'price_starter' } },
            { price: { id: 'price_pro' } },
          ],
        },
        expectedError: 'Stripe subscription must include exactly one item price',
      },
    ];

    for (const { items, expectedError } of cases) {
      const subscription = createSubscription('free', {
        stripe_customer_id: 'cus_123',
      });
      const subscriptionRepository = createRepository<any>([subscription]);
      const businessRepository = createRepository<any>([
        { id: 'business-1', name: 'Cafe Blue', email: 'owner@example.com' },
      ]);
      const stripe = {
        subscriptions: {
          create: jest.fn(async () => ({
            id: 'sub_123',
            status: 'active',
            current_period_start: 1780272000,
            current_period_end: 1782863999,
            trial_start: null,
            trial_end: null,
            ...(items === undefined ? {} : { items }),
            latest_invoice: null,
          })),
        },
      };
      const service = new SubscriptionService({
        stripe: stripe as any,
        enforceCapability: false,
        subscriptionRepository: subscriptionRepository as any,
        businessRepository: businessRepository as any,
        orderRepository: createRepository() as any,
      });

      await expect(service.createSubscription('business-1', 'starter')).rejects.toMatchObject({
        message: `Failed to create subscription: ${expectedError}`,
        statusCode: 500,
        code: 'SUBSCRIPTION_CREATION_FAILED',
      });

      expect(stripe.subscriptions.create).toHaveBeenCalledTimes(1);
      expect(subscriptionRepository.save).not.toHaveBeenCalled();
      expect(subscription).toMatchObject({
        tier: 'free',
        status: 'active',
        stripe_subscription_id: undefined,
        stripe_price_id: undefined,
        current_period_start: undefined,
        current_period_end: undefined,
      });
    }
  });

  it('rejects oversized Stripe subscription and price ids before persisting paid subscription upgrades', async () => {
    const cases: Array<{
      name: string;
      responseOverride: Record<string, unknown>;
      expectedError: string;
    }> = [
      {
        name: 'oversized subscription id',
        responseOverride: { id: `sub_${'x'.repeat(256)}` },
        expectedError: 'Stripe subscription id must be at most 255 characters',
      },
      {
        name: 'oversized item price id',
        responseOverride: { items: stripeSubscriptionItems(`price_${'x'.repeat(256)}`) },
        expectedError: 'Stripe subscription item price id must be at most 255 characters',
      },
    ];

    for (const { responseOverride, expectedError } of cases) {
      const subscription = createSubscription('free', {
        stripe_customer_id: 'cus_123',
      });
      const subscriptionRepository = createRepository<any>([subscription]);
      const businessRepository = createRepository<any>([
        { id: 'business-1', name: 'Cafe Blue', email: 'owner@example.com' },
      ]);
      const stripe = {
        subscriptions: {
          create: jest.fn(async () => ({
            id: 'sub_123',
            status: 'active',
            current_period_start: 1780272000,
            current_period_end: 1782863999,
            trial_start: null,
            trial_end: null,
            items: stripeSubscriptionItems(),
            latest_invoice: null,
            ...responseOverride,
          })),
        },
      };
      const service = new SubscriptionService({
        stripe: stripe as any,
        enforceCapability: false,
        subscriptionRepository: subscriptionRepository as any,
        businessRepository: businessRepository as any,
        orderRepository: createRepository() as any,
      });

      await expect(service.createSubscription('business-1', 'starter')).rejects.toMatchObject({
        message: `Failed to create subscription: ${expectedError}`,
        statusCode: 500,
        code: 'SUBSCRIPTION_CREATION_FAILED',
      });

      expect(stripe.subscriptions.create).toHaveBeenCalledTimes(1);
      expect(subscriptionRepository.save).not.toHaveBeenCalled();
      expect(subscription).toMatchObject({
        tier: 'free',
        status: 'active',
        stripe_customer_id: 'cus_123',
        stripe_subscription_id: undefined,
        stripe_price_id: undefined,
      });
    }
  });

  it('rejects Stripe creation responses with mismatched customer or metadata identity before persisting upgrades', async () => {
    const cases: Array<{
      name: string;
      responseOverride: Record<string, unknown>;
      expectedError: string;
    }> = [
      {
        name: 'string customer id points at another customer',
        responseOverride: { customer: 'cus_elsewhere' },
        expectedError: 'Stripe subscription customer id must match requested Stripe customer id',
      },
      {
        name: 'expanded customer object points at another customer',
        responseOverride: { customer: { id: 'cus_elsewhere' } },
        expectedError: 'Stripe subscription customer id must match requested Stripe customer id',
      },
      {
        name: 'customer has malformed type',
        responseOverride: { customer: 123 },
        expectedError: 'Stripe subscription customer must be a string or object',
      },
      {
        name: 'metadata has malformed type',
        responseOverride: { metadata: [] },
        expectedError: 'Stripe subscription metadata must be an object',
      },
      {
        name: 'metadata includes unsupported provider field',
        responseOverride: { metadata: { business_id: 'business-1', tier: 'starter', provider_trace_id: 'trace-123' } },
        expectedError: 'Stripe subscription metadata include unsupported field(s): provider_trace_id',
      },
      {
        name: 'metadata includes unsafe provider field name',
        responseOverride: { metadata: { business_id: 'business-1', tier: 'starter', 'provider_trace_id\uFEFF': 'trace-123' } },
        expectedError: 'Stripe subscription metadata field names must not include unsafe control characters',
      },
      {
        name: 'metadata business id points at another business',
        responseOverride: { metadata: { business_id: 'business-elsewhere', tier: 'starter' } },
        expectedError: 'Stripe subscription metadata business_id must match requested subscription business_id',
      },
      {
        name: 'metadata tier points at another requested tier',
        responseOverride: { metadata: { business_id: 'business-1', tier: 'pro' } },
        expectedError: 'Stripe subscription metadata tier must match requested subscription tier',
      },
      {
        name: 'metadata tier is unsupported',
        responseOverride: { metadata: { business_id: 'business-1', tier: 'enterprise' } },
        expectedError: 'Stripe subscription metadata tier has an invalid tier',
      },
    ];

    for (const { responseOverride, expectedError } of cases) {
      const subscription = createSubscription('free', {
        stripe_customer_id: 'cus_123',
      });
      const subscriptionRepository = createRepository<any>([subscription]);
      const businessRepository = createRepository<any>([
        { id: 'business-1', name: 'Cafe Blue', email: 'owner@example.com' },
      ]);
      const stripe = {
        subscriptions: {
          create: jest.fn(async () => ({
            id: 'sub_123',
            status: 'active',
            current_period_start: 1780272000,
            current_period_end: 1782863999,
            trial_start: null,
            trial_end: null,
            items: stripeSubscriptionItems(),
            latest_invoice: null,
            ...responseOverride,
          })),
        },
      };
      const service = new SubscriptionService({
        stripe: stripe as any,
        enforceCapability: false,
        subscriptionRepository: subscriptionRepository as any,
        businessRepository: businessRepository as any,
        orderRepository: createRepository() as any,
      });

      await expect(service.createSubscription('business-1', 'starter')).rejects.toMatchObject({
        message: `Failed to create subscription: ${expectedError}`,
        statusCode: 500,
        code: 'SUBSCRIPTION_CREATION_FAILED',
      });

      expect(stripe.subscriptions.create).toHaveBeenCalledTimes(1);
      expect(subscriptionRepository.save).not.toHaveBeenCalled();
      expect(subscription).toMatchObject({
        tier: 'free',
        status: 'active',
        stripe_subscription_id: undefined,
        stripe_price_id: undefined,
        current_period_start: undefined,
        current_period_end: undefined,
      });
    }
  });

  it('omits missing Stripe payment client secrets from paid subscription responses', async () => {
    const subscriptionRepository = createRepository<any>();
    const businessRepository = createRepository<any>([
      { id: 'business-1', name: 'Cafe Blue', email: 'owner@example.com' },
    ]);
    const stripe = {
      customers: {
        create: jest.fn(async () => ({ id: 'cus_123' })),
      },
      subscriptions: {
        create: jest.fn(async () => ({
          id: 'sub_123',
          status: 'active',
          current_period_start: 1780272000,
          current_period_end: 1782863999,
          trial_start: null,
          trial_end: null,
          items: stripeSubscriptionItems(),
          latest_invoice: {
            payment_intent: {
              client_secret: '',
            },
          },
        })),
      },
    };
    const service = new SubscriptionService({
      stripe: stripe as any,
      enforceCapability: false,
      subscriptionRepository: subscriptionRepository as any,
      businessRepository: businessRepository as any,
      orderRepository: createRepository() as any,
    });

    const result = await service.createSubscription('business-1', 'starter');

    expect(result.subscription).toMatchObject({
      business_id: 'business-1',
      tier: 'starter',
      stripe_customer_id: 'cus_123',
      stripe_subscription_id: 'sub_123',
    });
    expect(result).not.toHaveProperty('clientSecret');
  });

  it('rejects malformed Stripe payment client secrets before persisting paid subscription upgrades', async () => {
    const cases: Array<{
      clientSecret: unknown;
      expectedError: string;
    }> = [
      {
        clientSecret: 123,
        expectedError: 'Stripe payment intent client_secret must be a string',
      },
      {
        clientSecret: 'pi_secret_\u0000unsafe',
        expectedError: 'Stripe payment intent client_secret must not include unsafe control characters',
      },
      {
        clientSecret: 'pi_secret_\u202Eunsafe',
        expectedError: 'Stripe payment intent client_secret must not include unsafe control characters',
      },
      {
        clientSecret: '\uFEFFpi_secret_safe',
        expectedError: 'Stripe payment intent client_secret must not include unsafe control characters',
      },
      {
        clientSecret: `pi_secret_${'x'.repeat(513)}`,
        expectedError: 'Stripe payment intent client_secret must be at most 512 characters',
      },
    ];

    for (const { clientSecret, expectedError } of cases) {
      const subscription = createSubscription('free', {
        stripe_customer_id: 'cus_123',
      });
      const subscriptionRepository = createRepository<any>([subscription]);
      const businessRepository = createRepository<any>([
        { id: 'business-1', name: 'Cafe Blue', email: 'owner@example.com' },
      ]);
      const stripe = {
        subscriptions: {
          create: jest.fn(async () => ({
            id: 'sub_123',
            status: 'active',
            current_period_start: 1780272000,
            current_period_end: 1782863999,
            trial_start: null,
            trial_end: null,
            items: stripeSubscriptionItems(),
            latest_invoice: {
              payment_intent: {
                client_secret: clientSecret,
              },
            },
          })),
        },
      };
      const service = new SubscriptionService({
        stripe: stripe as any,
        enforceCapability: false,
        subscriptionRepository: subscriptionRepository as any,
        businessRepository: businessRepository as any,
        orderRepository: createRepository() as any,
      });

      await expect(service.createSubscription('business-1', 'starter')).rejects.toMatchObject({
        message: `Failed to create subscription: ${expectedError}`,
        statusCode: 500,
        code: 'SUBSCRIPTION_CREATION_FAILED',
      });

      expect(stripe.subscriptions.create).toHaveBeenCalledTimes(1);
      expect(subscriptionRepository.save).not.toHaveBeenCalled();
      expect(subscription).toMatchObject({
        tier: 'free',
        status: 'active',
        stripe_customer_id: 'cus_123',
        stripe_subscription_id: undefined,
        stripe_price_id: undefined,
      });
    }
  });

  it('rejects malformed Stripe customer ids before persisting subscription customer references', async () => {
    const subscriptionRepository = createRepository<any>();
    const businessRepository = createRepository<any>([
      { id: 'business-1', name: 'Cafe', email: 'owner@example.com' },
    ]);
    const stripe = {
      customers: {
        create: jest.fn(async () => ({ id: '   ' })),
      },
      subscriptions: {
        create: jest.fn(),
      },
    };
    const service = new SubscriptionService({
      stripe: stripe as any,
      enforceCapability: false,
      subscriptionRepository: subscriptionRepository as any,
      businessRepository: businessRepository as any,
      orderRepository: createRepository() as any,
    });

    await expect(service.createSubscription('business-1', 'starter')).rejects.toMatchObject({
      message: 'Failed to create Stripe customer: Stripe customer id must be a non-empty string',
      statusCode: 500,
      code: 'STRIPE_CUSTOMER_CREATION_FAILED',
    });

    expect(stripe.customers.create).toHaveBeenCalledTimes(1);
    expect(stripe.subscriptions.create).not.toHaveBeenCalled();
    expect(subscriptionRepository.rows).toEqual([
      expect.objectContaining({
        business_id: 'business-1',
        tier: 'free',
        status: 'active',
      }),
    ]);
    expect(subscriptionRepository.rows[0]).not.toHaveProperty('stripe_customer_id');
  });

  it('rejects oversized Stripe customer ids before persisting subscription customer references', async () => {
    const subscriptionRepository = createRepository<any>();
    const businessRepository = createRepository<any>([
      { id: 'business-1', name: 'Cafe', email: 'owner@example.com' },
    ]);
    const stripe = {
      customers: {
        create: jest.fn(async () => ({ id: `cus_${'x'.repeat(256)}` })),
      },
      subscriptions: {
        create: jest.fn(),
      },
    };
    const service = new SubscriptionService({
      stripe: stripe as any,
      enforceCapability: false,
      subscriptionRepository: subscriptionRepository as any,
      businessRepository: businessRepository as any,
      orderRepository: createRepository() as any,
    });

    await expect(service.createSubscription('business-1', 'starter')).rejects.toMatchObject({
      message: 'Failed to create Stripe customer: Stripe customer id must be at most 255 characters',
      statusCode: 500,
      code: 'STRIPE_CUSTOMER_CREATION_FAILED',
    });

    expect(stripe.customers.create).toHaveBeenCalledTimes(1);
    expect(stripe.subscriptions.create).not.toHaveBeenCalled();
    expect(subscriptionRepository.rows).toEqual([
      expect.objectContaining({
        business_id: 'business-1',
        tier: 'free',
        status: 'active',
      }),
    ]);
    expect(subscriptionRepository.rows[0]).not.toHaveProperty('stripe_customer_id');
  });

  it('preserves missing-business domain errors during subscription creation', async () => {
    const subscriptionRepository = createRepository<any>();
    const businessRepository = createRepository<any>();
    const stripe = {
      customers: { create: jest.fn() },
      subscriptions: { create: jest.fn() },
    };
    const service = new SubscriptionService({
      stripe: stripe as any,
      enforceCapability: false,
      subscriptionRepository: subscriptionRepository as any,
      businessRepository: businessRepository as any,
      orderRepository: createRepository() as any,
    });

    await expect(service.createSubscription('business-missing', 'starter')).rejects.toMatchObject({
      message: 'Business not found',
      statusCode: 404,
      code: 'BUSINESS_NOT_FOUND',
    });

    expect(subscriptionRepository.findOne).not.toHaveBeenCalled();
    expect(subscriptionRepository.create).not.toHaveBeenCalled();
    expect(subscriptionRepository.save).not.toHaveBeenCalled();
    expect(stripe.customers.create).not.toHaveBeenCalled();
    expect(stripe.subscriptions.create).not.toHaveBeenCalled();
  });

  it('rejects unsupported persisted business rows before subscription creation side effects', async () => {
    const subscriptionRepository = createRepository<any>();
    const businessRepository = {
      ...createRepository<any>(),
      findOne: jest.fn(async () => ({
        id: 'business-1',
        name: 'Cafe Blue',
        email: 'owner@example.com',
        provider_trace_id: 'trace-123',
      })),
    };
    const stripe = {
      customers: { create: jest.fn() },
      subscriptions: { create: jest.fn() },
    };
    const service = new SubscriptionService({
      stripe: stripe as any,
      enforceCapability: false,
      subscriptionRepository: subscriptionRepository as any,
      businessRepository: businessRepository as any,
      orderRepository: createRepository() as any,
    });

    await expect(service.createSubscription('business-1', 'starter')).rejects.toMatchObject({
      message: 'Failed to create subscription: subscription business include unsupported field(s): provider_trace_id',
      statusCode: 500,
      code: 'SUBSCRIPTION_CREATION_FAILED',
    });

    expect(businessRepository.findOne).toHaveBeenCalledWith({
      where: { id: 'business-1' },
    });
    expect(subscriptionRepository.findOne).not.toHaveBeenCalled();
    expect(subscriptionRepository.create).not.toHaveBeenCalled();
    expect(subscriptionRepository.save).not.toHaveBeenCalled();
    expect(stripe.customers.create).not.toHaveBeenCalled();
    expect(stripe.subscriptions.create).not.toHaveBeenCalled();
  });

  it('rejects cross-business rows before subscription creation side effects', async () => {
    const subscriptionRepository = createRepository<any>();
    const businessRepository = {
      ...createRepository<any>(),
      findOne: jest.fn(async () => ({
        id: 'business-elsewhere',
        name: 'Cafe Elsewhere',
        email: 'owner@example.com',
      })),
    };
    const stripe = {
      customers: { create: jest.fn() },
      subscriptions: { create: jest.fn() },
    };
    const service = new SubscriptionService({
      stripe: stripe as any,
      enforceCapability: false,
      subscriptionRepository: subscriptionRepository as any,
      businessRepository: businessRepository as any,
      orderRepository: createRepository() as any,
    });

    await expect(service.createSubscription('business-1', 'starter')).rejects.toMatchObject({
      message: 'Failed to create subscription: subscription business id must match requested business',
      statusCode: 500,
      code: 'SUBSCRIPTION_CREATION_FAILED',
    });

    expect(businessRepository.findOne).toHaveBeenCalledWith({
      where: { id: 'business-1' },
    });
    expect(subscriptionRepository.findOne).not.toHaveBeenCalled();
    expect(subscriptionRepository.create).not.toHaveBeenCalled();
    expect(subscriptionRepository.save).not.toHaveBeenCalled();
    expect(stripe.customers.create).not.toHaveBeenCalled();
    expect(stripe.subscriptions.create).not.toHaveBeenCalled();
  });

  it('preserves missing-subscription domain errors during cancellation and resume', async () => {
    const subscriptionRepository = createRepository<any>();
    const stripe = {
      subscriptions: {
        cancel: jest.fn(),
        update: jest.fn(),
      },
    };
    const service = new SubscriptionService({
      stripe: stripe as any,
      enforceCapability: false,
      subscriptionRepository: subscriptionRepository as any,
      businessRepository: createRepository() as any,
      orderRepository: createRepository() as any,
    });

    await expect(service.cancelSubscription('business-missing')).rejects.toMatchObject({
      message: 'Subscription not found',
      statusCode: 404,
      code: 'SUBSCRIPTION_NOT_FOUND',
    });
    await expect(service.resumeSubscription('business-missing')).rejects.toMatchObject({
      message: 'Subscription not found',
      statusCode: 404,
      code: 'SUBSCRIPTION_NOT_FOUND',
    });

    expect(subscriptionRepository.save).not.toHaveBeenCalled();
    expect(stripe.subscriptions.cancel).not.toHaveBeenCalled();
    expect(stripe.subscriptions.update).not.toHaveBeenCalled();
  });

  it('rejects malformed subscription cancellation option payloads before repository or provider calls', async () => {
    const subscription = createSubscription('starter', {
      stripe_subscription_id: 'sub_123',
    });
    const subscriptionRepository = createRepository<any>([subscription]);
    const stripe = {
      subscriptions: {
        cancel: jest.fn(),
        update: jest.fn(),
      },
    };
    const service = new SubscriptionService({
      stripe: stripe as any,
      enforceCapability: false,
      subscriptionRepository: subscriptionRepository as any,
      businessRepository: createRepository() as any,
      orderRepository: createRepository() as any,
    });

    await expect(
      service.cancelSubscription('business-1', null as any)
    ).rejects.toThrow('subscription cancellation options must be an object');
    await expect(
      service.cancelSubscription('business-1', [] as any)
    ).rejects.toThrow('subscription cancellation options must be an object');
    await expect(
      service.cancelSubscription('business-1', { immediate: 'yes' } as any)
    ).rejects.toThrow('subscription cancellation immediate must be a boolean');
    await expect(
      service.cancelSubscription('business-1', {
        immediate: true,
        refundMode: 'manual',
      } as any)
    ).rejects.toThrow(
      'subscription cancellation options include unsupported field(s): refundMode'
    );
    await expect(
      service.cancelSubscription('business-1', {
        ['refundMode\uFEFF']: 'manual',
      } as any)
    ).rejects.toThrow(
      'subscription cancellation options field names must not include unsafe control characters'
    );

    expect(subscriptionRepository.findOne).not.toHaveBeenCalled();
    expect(subscriptionRepository.save).not.toHaveBeenCalled();
    expect(stripe.subscriptions.cancel).not.toHaveBeenCalled();
    expect(stripe.subscriptions.update).not.toHaveBeenCalled();
  });

  it('clears pending cancellation flags when persisting terminal cancellation states', async () => {
    const freeSubscription = createSubscription('free', {
      cancel_at_period_end: true,
    });
    const freeSubscriptionRepository = createRepository<any>([freeSubscription]);
    const freeTierService = new SubscriptionService({
      requireStripe: false,
      enforceCapability: false,
      subscriptionRepository: freeSubscriptionRepository as any,
      businessRepository: createRepository() as any,
      orderRepository: createRepository() as any,
    });

    await expect(freeTierService.cancelSubscription('business-1')).resolves.toMatchObject({
      status: 'canceled',
      cancel_at_period_end: false,
      canceled_at: expect.any(Date),
    });
    expect(freeSubscriptionRepository.save).toHaveBeenCalledWith(expect.objectContaining({
      status: 'canceled',
      cancel_at_period_end: false,
      canceled_at: expect.any(Date),
    }));

    const paidSubscription = createSubscription('starter', {
      stripe_subscription_id: ' sub_123 ',
      cancel_at_period_end: true,
    });
    const paidSubscriptionRepository = createRepository<any>([paidSubscription]);
    const stripe = {
      subscriptions: {
        cancel: jest.fn(async () => ({
          id: 'sub_123',
          status: 'canceled',
          cancel_at_period_end: false,
          canceled_at: 1780360000,
        })),
        update: jest.fn(),
      },
    };
    const paidTierService = new SubscriptionService({
      stripe: stripe as any,
      enforceCapability: false,
      subscriptionRepository: paidSubscriptionRepository as any,
      businessRepository: createRepository() as any,
      orderRepository: createRepository() as any,
    });

    await expect(
      paidTierService.cancelSubscription('business-1', { immediate: true })
    ).resolves.toMatchObject({
      status: 'canceled',
      cancel_at_period_end: false,
      canceled_at: new Date(1780360000 * 1000),
    });
    expect(stripe.subscriptions.cancel).toHaveBeenCalledWith('sub_123');
    expect(stripe.subscriptions.update).not.toHaveBeenCalled();
    expect(paidSubscriptionRepository.save).toHaveBeenCalledWith(expect.objectContaining({
      status: 'canceled',
      cancel_at_period_end: false,
      canceled_at: new Date(1780360000 * 1000),
    }));
  });

  it('rejects malformed Stripe cancellation responses before mutating local subscription state', async () => {
    const cases: Array<{
      name: string;
      options?: { immediate?: boolean };
      stripeResponse: unknown;
      expectedError: string;
      expectedMethod: 'cancel' | 'update';
    }> = [
      {
        name: 'immediate non-object',
        options: { immediate: true },
        stripeResponse: null,
        expectedError: 'Stripe subscription cancellation response must be an object',
        expectedMethod: 'cancel',
      },
      {
        name: 'immediate mismatched id',
        options: { immediate: true },
        stripeResponse: {
          id: 'sub_other',
          status: 'canceled',
          cancel_at_period_end: false,
          canceled_at: 1780360000,
        },
        expectedError: 'Stripe subscription cancellation response id must match requested subscription',
        expectedMethod: 'cancel',
      },
      {
        name: 'immediate unsupported status',
        options: { immediate: true },
        stripeResponse: {
          id: 'sub_123',
          status: 'active',
          cancel_at_period_end: false,
          canceled_at: 1780360000,
        },
        expectedError: 'Stripe subscription cancellation response status must be canceled',
        expectedMethod: 'cancel',
      },
      {
        name: 'immediate missing cancellation timestamp',
        options: { immediate: true },
        stripeResponse: {
          id: 'sub_123',
          status: 'canceled',
          cancel_at_period_end: false,
          canceled_at: null,
        },
        expectedError: 'Stripe subscription cancellation response canceled_at is required',
        expectedMethod: 'cancel',
      },
      {
        name: 'immediate customer mismatch',
        options: { immediate: true },
        stripeResponse: {
          id: 'sub_123',
          status: 'canceled',
          cancel_at_period_end: false,
          canceled_at: 1780360000,
          customer: 'cus_elsewhere',
        },
        expectedError: 'Stripe subscription customer id must match persisted subscription stripe_customer_id',
        expectedMethod: 'cancel',
      },
      {
        name: 'scheduled missing flag',
        stripeResponse: {
          id: 'sub_123',
        },
        expectedError: 'Stripe subscription scheduled-cancellation response cancel_at_period_end must be a boolean',
        expectedMethod: 'update',
      },
      {
        name: 'scheduled rejected flag',
        stripeResponse: {
          id: 'sub_123',
          cancel_at_period_end: false,
        },
        expectedError: 'Stripe subscription scheduled-cancellation response cancel_at_period_end must be true',
        expectedMethod: 'update',
      },
      {
        name: 'scheduled terminal status',
        stripeResponse: {
          id: 'sub_123',
          status: 'canceled',
          cancel_at_period_end: true,
          canceled_at: null,
        },
        expectedError: 'Stripe subscription scheduled-cancellation response status cannot be canceled',
        expectedMethod: 'update',
      },
      {
        name: 'scheduled terminal timestamp',
        stripeResponse: {
          id: 'sub_123',
          status: 'active',
          cancel_at_period_end: true,
          canceled_at: 1780360000,
        },
        expectedError: 'Stripe subscription scheduled-cancellation response canceled_at cannot be present',
        expectedMethod: 'update',
      },
      {
        name: 'scheduled metadata business mismatch',
        stripeResponse: {
          id: 'sub_123',
          cancel_at_period_end: true,
          metadata: {
            business_id: 'business-elsewhere',
            tier: 'starter',
          },
        },
        expectedError: 'Stripe subscription metadata business_id must match persisted subscription business_id',
        expectedMethod: 'update',
      },
      {
        name: 'scheduled metadata tier mismatch',
        stripeResponse: {
          id: 'sub_123',
          cancel_at_period_end: true,
          metadata: {
            business_id: 'business-1',
            tier: 'pro',
          },
        },
        expectedError: 'Stripe subscription metadata tier must match persisted subscription tier',
        expectedMethod: 'update',
      },
    ];

    for (const { options, stripeResponse, expectedError, expectedMethod } of cases) {
      const subscription = createSubscription('starter', {
        stripe_customer_id: 'cus_123',
        stripe_subscription_id: ' sub_123 ',
        cancel_at_period_end: false,
      });
      const subscriptionRepository = createRepository<any>([subscription]);
      const stripe = {
        subscriptions: {
          cancel: jest.fn(async () => stripeResponse),
          update: jest.fn(async () => stripeResponse),
        },
      };
      const service = new SubscriptionService({
        stripe: stripe as any,
        enforceCapability: false,
        subscriptionRepository: subscriptionRepository as any,
        businessRepository: createRepository() as any,
        orderRepository: createRepository() as any,
      });

      await expect(service.cancelSubscription('business-1', options)).rejects.toMatchObject({
        message: `Failed to cancel subscription: ${expectedError}`,
        statusCode: 500,
        code: 'SUBSCRIPTION_CANCELLATION_FAILED',
      });

      expect(stripe.subscriptions[expectedMethod]).toHaveBeenCalledTimes(1);
      expect(subscriptionRepository.save).not.toHaveBeenCalled();
      expect(subscription).toMatchObject({
        status: 'active',
        cancel_at_period_end: false,
      });
      expect(subscription.canceled_at).toBeUndefined();
    }
  });

  it('rejects malformed Stripe resume responses before clearing local cancellation state', async () => {
    const cases: Array<{ response: unknown; expectedError: string }> = [
      {
        response: [],
        expectedError: 'Stripe subscription resume response must be an object',
      },
      {
        response: { id: 'sub_other', cancel_at_period_end: false },
        expectedError: 'Stripe subscription resume response id must match requested subscription',
      },
      {
        response: { id: 'sub_123', cancel_at_period_end: 'false' },
        expectedError: 'Stripe subscription resume response cancel_at_period_end must be a boolean',
      },
      {
        response: { id: 'sub_123', cancel_at_period_end: true },
        expectedError: 'Stripe subscription resume response cancel_at_period_end must be false',
      },
      {
        response: { id: 'sub_123', cancel_at_period_end: false, customer: 'cus_elsewhere' },
        expectedError: 'Stripe subscription customer id must match persisted subscription stripe_customer_id',
      },
      {
        response: {
          id: 'sub_123',
          cancel_at_period_end: false,
          metadata: {
            business_id: 'business-1',
            tier: 'pro',
          },
        },
        expectedError: 'Stripe subscription metadata tier must match persisted subscription tier',
      },
    ];

    for (const { response, expectedError } of cases) {
      const subscription = createSubscription('starter', {
        stripe_customer_id: 'cus_123',
        stripe_subscription_id: 'sub_123',
        cancel_at_period_end: true,
        canceled_at: new Date('2026-06-15T00:00:00.000Z'),
      });
      const subscriptionRepository = createRepository<any>([subscription]);
      const stripe = {
        subscriptions: {
          update: jest.fn(async () => response),
        },
      };
      const service = new SubscriptionService({
        stripe: stripe as any,
        enforceCapability: false,
        subscriptionRepository: subscriptionRepository as any,
        businessRepository: createRepository() as any,
        orderRepository: createRepository() as any,
      });

      await expect(service.resumeSubscription('business-1')).rejects.toMatchObject({
        message: `Failed to resume subscription: ${expectedError}`,
        statusCode: 500,
        code: 'SUBSCRIPTION_RESUME_FAILED',
      });

      expect(stripe.subscriptions.update).toHaveBeenCalledWith('sub_123', {
        cancel_at_period_end: false,
      });
      expect(subscriptionRepository.save).not.toHaveBeenCalled();
      expect(subscription).toMatchObject({
        cancel_at_period_end: true,
        canceled_at: new Date('2026-06-15T00:00:00.000Z'),
      });
    }
  });

  it('clears local cancellation timestamps durably when Stripe resumes a subscription', async () => {
    const subscription = createSubscription('starter', {
      stripe_subscription_id: ' sub_123 ',
      cancel_at_period_end: true,
      canceled_at: new Date('2026-06-15T00:00:00.000Z'),
    });
    const subscriptionRepository = createRepository<any>([subscription]);
    const stripe = {
      subscriptions: {
        update: jest.fn(async () => ({
          id: 'sub_123',
          cancel_at_period_end: false,
        })),
      },
    };
    const service = new SubscriptionService({
      stripe: stripe as any,
      enforceCapability: false,
      subscriptionRepository: subscriptionRepository as any,
      businessRepository: createRepository() as any,
      orderRepository: createRepository() as any,
    });

    await expect(service.resumeSubscription('business-1')).resolves.toMatchObject({
      cancel_at_period_end: false,
      canceled_at: null,
    });
    expect(stripe.subscriptions.update).toHaveBeenCalledWith('sub_123', {
      cancel_at_period_end: false,
    });
    expect(subscriptionRepository.save).toHaveBeenCalledWith(expect.objectContaining({
      cancel_at_period_end: false,
      canceled_at: null,
    }));
  });

  it('rejects corrupt persisted subscription rows before reads or provider side effects', async () => {
    const corruptSubscription = createSubscription('starter', {
      status: 'teleported' as any,
      stripe_customer_id: 'cus_123',
      stripe_subscription_id: 'sub_123',
    });
    const subscriptionRepository = createRepository<any>([corruptSubscription]);
    const stripe = {
      subscriptions: {
        create: jest.fn(),
        cancel: jest.fn(),
        update: jest.fn(),
      },
      billingPortal: {
        sessions: { create: jest.fn() },
      },
    };
    const service = new SubscriptionService({
      stripe: stripe as any,
      enforceCapability: false,
      subscriptionRepository: subscriptionRepository as any,
      businessRepository: createRepository([
        { id: 'business-1', name: 'Cafe', email: 'owner@example.com' },
      ]) as any,
      orderRepository: createRepository() as any,
    });

    await expect(service.createSubscription('business-1', 'starter')).rejects.toMatchObject({
      message: 'persisted subscription status has an invalid status',
      statusCode: 500,
      code: 'SUBSCRIPTION_DATA_INVALID',
    });
    await expect(service.getSubscription('business-1')).rejects.toMatchObject({
      message: 'persisted subscription status has an invalid status',
      statusCode: 500,
      code: 'SUBSCRIPTION_DATA_INVALID',
    });
    await expect(service.cancelSubscription('business-1')).rejects.toMatchObject({
      message: 'persisted subscription status has an invalid status',
      statusCode: 500,
      code: 'SUBSCRIPTION_DATA_INVALID',
    });
    await expect(service.resumeSubscription('business-1')).rejects.toMatchObject({
      message: 'persisted subscription status has an invalid status',
      statusCode: 500,
      code: 'SUBSCRIPTION_DATA_INVALID',
    });
    await expect(
      service.createPortalSession('business-1', 'https://app.example.com/billing/return')
    ).rejects.toMatchObject({
      message: 'persisted subscription status has an invalid status',
      statusCode: 500,
      code: 'SUBSCRIPTION_DATA_INVALID',
    });
    await expect(service.getAllSubscriptions()).rejects.toMatchObject({
      message: 'persisted subscription status has an invalid status',
      statusCode: 500,
      code: 'SUBSCRIPTION_DATA_INVALID',
    });

    expect(stripe.subscriptions.create).not.toHaveBeenCalled();
    expect(stripe.subscriptions.cancel).not.toHaveBeenCalled();
    expect(stripe.subscriptions.update).not.toHaveBeenCalled();
    expect(stripe.billingPortal.sessions.create).not.toHaveBeenCalled();
    expect(subscriptionRepository.save).not.toHaveBeenCalled();
  });

  it('rejects malformed persisted subscription envelopes before read-side exposure', async () => {
    const malformedSubscription = [] as any;
    const subscriptionRepository = {
      ...createRepository<any>(),
      findOne: jest.fn(async () => malformedSubscription),
      find: jest.fn(async () => [malformedSubscription]),
    };
    const service = new SubscriptionService({
      requireStripe: false,
      enforceCapability: false,
      subscriptionRepository: subscriptionRepository as any,
      businessRepository: createRepository() as any,
      orderRepository: createRepository() as any,
    });

    await expect(service.getSubscription('business-1')).rejects.toMatchObject({
      message: 'persisted subscription must be an object',
      statusCode: 500,
      code: 'SUBSCRIPTION_DATA_INVALID',
    });
    await expect(service.getAllSubscriptions()).rejects.toMatchObject({
      message: 'persisted subscription admin row 1 must be an object',
      statusCode: 500,
      code: 'SUBSCRIPTION_DATA_INVALID',
    });
  });

  it('rejects persisted subscription rows that do not belong to the requested business', async () => {
    const crossBusinessSubscription = createSubscription('starter', {
      business_id: 'business-2',
    });
    const subscriptionRepository = {
      ...createRepository<any>([crossBusinessSubscription]),
      findOne: jest.fn(async () => crossBusinessSubscription),
    };
    const service = new SubscriptionService({
      requireStripe: false,
      enforceCapability: false,
      subscriptionRepository: subscriptionRepository as any,
      businessRepository: createRepository() as any,
      orderRepository: createRepository() as any,
    });

    await expect(service.getSubscription('business-1')).rejects.toMatchObject({
      message: 'persisted subscription business_id must match requested business',
      statusCode: 500,
      code: 'SUBSCRIPTION_DATA_INVALID',
    });
  });

  it('rejects loaded subscription business relations that do not match the subscription row', async () => {
    const corruptRelationSubscription = createSubscription('starter', {
      business: { id: 'business-2' } as any,
    });
    const subscriptionRepository = createRepository<any>([corruptRelationSubscription]);
    const service = new SubscriptionService({
      requireStripe: false,
      enforceCapability: false,
      subscriptionRepository: subscriptionRepository as any,
      businessRepository: createRepository() as any,
      orderRepository: createRepository() as any,
    });

    await expect(service.getSubscription('business-1')).rejects.toMatchObject({
      message: 'persisted subscription business relation id must match subscription business_id',
      statusCode: 500,
      code: 'SUBSCRIPTION_DATA_INVALID',
    });
  });

  it('rejects missing loaded subscription business relations before read-side exposure', async () => {
    const orphanedRelationSubscription = createSubscription('starter', {
      business: null as any,
    });
    const subscriptionRepository = createRepository<any>([orphanedRelationSubscription]);
    const service = new SubscriptionService({
      requireStripe: false,
      enforceCapability: false,
      subscriptionRepository: subscriptionRepository as any,
      businessRepository: createRepository() as any,
      orderRepository: createRepository() as any,
    });

    await expect(service.getSubscription('business-1')).rejects.toMatchObject({
      message: 'persisted subscription business relation is required when loaded',
      statusCode: 500,
      code: 'SUBSCRIPTION_DATA_INVALID',
    });
  });

  it('rejects corrupt persisted subscription lifecycle fields before read-side exposure', async () => {
    const cases: Array<{
      row: Subscription;
      expectedError: string;
    }> = [
      {
        row: createSubscription('starter', { cancel_at_period_end: 'yes' as any }),
        expectedError: 'persisted subscription cancel_at_period_end must be a boolean',
      },
      {
        row: createSubscription('starter', { created_at: new Date('not-a-date') }),
        expectedError: 'persisted subscription created_at must be a valid Date',
      },
      {
        row: createSubscription('starter', { updated_at: new Date('not-a-date') }),
        expectedError: 'persisted subscription updated_at must be a valid Date',
      },
      {
        row: createSubscription('starter', {
          created_at: new Date('2026-06-02T00:00:00.000Z'),
          updated_at: new Date('2026-06-01T23:59:59.999Z'),
        }),
        expectedError: 'persisted subscription updated_at cannot be before created_at',
      },
      {
        row: createSubscription('starter', {
          created_at: new Date('2026-06-02T00:00:00.000Z'),
          current_period_start: new Date('2026-06-01T00:00:00.000Z'),
          current_period_end: new Date('2026-06-30T23:59:59.999Z'),
        }),
        expectedError: 'persisted subscription current_period_start cannot be before created_at',
      },
      {
        row: createSubscription('starter', { status: 'canceled' }),
        expectedError: 'persisted canceled subscription must include canceled_at',
      },
      {
        row: createSubscription('starter', {
          status: 'canceled',
          created_at: new Date('2026-06-02T00:00:00.000Z'),
          canceled_at: new Date('2026-06-01T23:59:59.999Z'),
        }),
        expectedError: 'persisted subscription canceled_at cannot be before created_at',
      },
      {
        row: createSubscription('starter', {
          status: 'canceled',
          updated_at: new Date('2026-06-14T23:59:59.999Z'),
          canceled_at: new Date('2026-06-15T00:00:00.000Z'),
        }),
        expectedError: 'persisted canceled subscription updated_at cannot be before canceled_at',
      },
      {
        row: createSubscription('starter', {
          status: 'active',
          canceled_at: new Date('2026-06-15T00:00:00.000Z'),
        }),
        expectedError: 'persisted non-canceled subscription cannot include canceled_at',
      },
      {
        row: createSubscription('starter', {
          status: 'active',
          cancel_at_period_end: true,
          canceled_at: new Date('2026-05-31T23:59:59.999Z'),
        }),
        expectedError: 'persisted scheduled subscription canceled_at must fall within current billing period',
      },
      {
        row: createSubscription('starter', {
          status: 'canceled',
          canceled_at: new Date('2026-06-15T00:00:00.000Z'),
          cancel_at_period_end: true,
        }),
        expectedError: 'persisted canceled subscription cannot still be marked cancel_at_period_end',
      },
      {
        row: createSubscription('starter', {
          trial_start: new Date('2026-06-01T00:00:00.000Z'),
        }),
        expectedError: 'persisted subscription trial period must include both trial_start and trial_end',
      },
      {
        row: createSubscription('starter', {
          created_at: new Date('2026-05-31T00:00:00.000Z'),
          updated_at: new Date('2026-05-31T23:59:59.999Z'),
          trial_start: new Date('2026-06-01T00:00:00.000Z'),
          trial_end: new Date('2026-06-14T00:00:00.000Z'),
        }),
        expectedError: 'persisted subscription updated_at cannot be before trial_start',
      },
      {
        row: createSubscription('starter', {
          status: 'trialing',
        }),
        expectedError: 'persisted trialing subscription must include trial period',
      },
      {
        row: createSubscription('free', {
          trial_start: new Date('2026-06-01T00:00:00.000Z'),
          trial_end: new Date('2026-06-14T00:00:00.000Z'),
        }),
        expectedError: 'persisted free subscription cannot include trial period',
      },
      {
        row: createSubscription('starter', {
          metadata: [] as any,
        }),
        expectedError: 'persisted subscription metadata must be an object',
      },
      {
        row: createSubscription('starter', {
          metadata: {
            stripe_last_event_created: 1780000000,
            stripe_last_event_type: 'customer.subscription.updated',
            provider_trace_id: 'trace-123',
          },
        }),
        expectedError: 'persisted subscription metadata include unsupported field(s): provider_trace_id',
      },
      {
        row: createSubscription('starter', {
          metadata: {
            stripe_last_event_created: 1780000000,
            stripe_last_event_type: 'customer.subscription.updated',
            'provider_trace_id\uFEFF': 'trace-123',
          },
        }),
        expectedError: 'persisted subscription metadata field names must not include unsafe control characters',
      },
      {
        row: createSubscription('starter', {
          metadata: { stripe_last_event_created: '1780000000' } as any,
        }),
        expectedError: 'persisted subscription stripe_last_event_created must be a Stripe timestamp',
      },
      {
        row: createSubscription('starter', {
          metadata: { stripe_last_event_created: -1 },
        }),
        expectedError: 'persisted subscription stripe_last_event_created must be a non-negative integer Stripe timestamp',
      },
      {
        row: createSubscription('starter', {
          created_at: new Date('2026-06-02T00:00:00.000Z'),
          current_period_start: new Date('2026-06-02T00:00:00.000Z'),
          current_period_end: new Date('2026-06-30T23:59:59.999Z'),
          metadata: {
            stripe_last_event_created: 1780358399,
            stripe_last_event_type: 'customer.subscription.updated',
          },
        }),
        expectedError: 'persisted subscription stripe_last_event_created cannot be before created_at',
      },
      {
        row: createSubscription('starter', {
          updated_at: new Date('2026-06-01T00:00:00.000Z'),
          metadata: {
            stripe_last_event_created: 1780358401,
            stripe_last_event_type: 'customer.subscription.updated',
          },
        }),
        expectedError: 'persisted subscription updated_at cannot be before stripe_last_event_created',
      },
      {
        row: createSubscription('starter', {
          metadata: { stripe_last_event_type: 'invoice.paid' },
        }),
        expectedError: 'persisted subscription stripe_last_event_type requires stripe_last_event_created',
      },
      {
        row: createSubscription('starter', {
          metadata: {
            stripe_last_event_created: 1780000000,
            stripe_last_event_type: 'invoice.paid',
          },
        }),
        expectedError: 'persisted subscription stripe_last_event_type must be a supported subscription webhook event',
      },
      {
        row: createSubscription('starter', {
          metadata: {
            trial_will_end_subscription_id: 'sub_123',
            trial_will_end_at: 'not-a-date',
          },
        }),
        expectedError: 'persisted subscription trial_will_end_at must be an ISO timestamp string',
      },
      {
        row: createSubscription('starter', {
          metadata: {
            trial_will_end_subscription_id: 'sub_123',
            trial_will_end_at: '2026-06-14 00:00:00',
          },
        }),
        expectedError: 'persisted subscription trial_will_end_at must be an ISO timestamp string',
      },
      {
        row: createSubscription('starter', {
          metadata: {
            trial_will_end_subscription_id: 'sub_123',
            trial_will_end_at: '\uFEFF2026-06-14T00:00:00.000Z',
          },
        }),
        expectedError: 'persisted subscription trial_will_end_at must not include unsafe control characters',
      },
      {
        row: createSubscription('starter', {
          metadata: { trial_will_end_subscription_id: 'sub_123' },
        }),
        expectedError: 'persisted subscription trial_will_end metadata must include both subscription id and timestamp',
      },
      {
        row: createSubscription('starter', {
          metadata: { trial_will_end_at: '2026-06-01T00:00:00.000Z' },
        }),
        expectedError: 'persisted subscription trial_will_end metadata must include both subscription id and timestamp',
      },
      {
        row: createSubscription('starter', {
          trial_start: new Date('2026-06-01T00:00:00.000Z'),
          trial_end: new Date('2026-06-14T00:00:00.000Z'),
          metadata: {
            stripe_last_event_created: 1780000000,
            stripe_last_event_type: 'customer.subscription.updated',
            trial_will_end_subscription_id: 'sub_123',
            trial_will_end_at: '2026-06-14T00:00:00.000Z',
          },
        }),
        expectedError:
          'persisted subscription trial_will_end metadata requires customer.subscription.trial_will_end event evidence',
      },
      {
        row: createSubscription('starter', {
          trial_start: new Date('2026-06-01T00:00:00.000Z'),
          trial_end: new Date('2026-06-14T00:00:00.000Z'),
          metadata: {
            stripe_last_event_created: 1780000000,
            stripe_last_event_type: 'customer.subscription.trial_will_end',
            trial_will_end_subscription_id: 'sub_other',
            trial_will_end_at: '2026-06-14T00:00:00.000Z',
          },
        }),
        expectedError: 'persisted subscription trial_will_end_subscription_id must match stripe_subscription_id',
      },
      {
        row: createSubscription('starter', {
          created_at: new Date('2026-05-29T00:00:00.000Z'),
          trial_start: new Date('2026-06-01T00:00:00.000Z'),
          trial_end: new Date('2026-06-14T00:00:00.000Z'),
          metadata: {
            stripe_last_event_created: 1780000000,
            stripe_last_event_type: 'customer.subscription.trial_will_end',
            trial_will_end_subscription_id: 'sub_123',
            trial_will_end_at: '2026-06-14T00:00:00.000Z',
          },
        }),
        expectedError: 'persisted subscription trial_will_end event cannot be before created_at',
      },
      {
        row: createSubscription('starter', {
          created_at: new Date('2026-05-01T00:00:00.000Z'),
          trial_start: new Date('2026-06-01T00:00:00.000Z'),
          trial_end: new Date('2026-06-14T00:00:00.000Z'),
          metadata: {
            stripe_last_event_created: 1780271999,
            stripe_last_event_type: 'customer.subscription.trial_will_end',
            trial_will_end_subscription_id: 'sub_123',
            trial_will_end_at: '2026-06-14T00:00:00.000Z',
          },
        }),
        expectedError: 'persisted subscription trial_will_end event cannot be before trial_start',
      },
      {
        row: createSubscription('starter', {
          created_at: new Date('2026-05-01T00:00:00.000Z'),
          trial_start: new Date('2026-06-01T00:00:00.000Z'),
          trial_end: new Date('2026-06-14T23:59:59.000Z'),
          metadata: {
            stripe_last_event_created: 1781481600,
            stripe_last_event_type: 'customer.subscription.trial_will_end',
            trial_will_end_subscription_id: 'sub_123',
            trial_will_end_at: '2026-06-14T23:59:59.000Z',
          },
        }),
        expectedError: 'persisted subscription trial_will_end event cannot be after trial_will_end_at',
      },
      {
        row: createSubscription('starter', {
          trial_start: new Date('2026-06-01T00:00:00.000Z'),
          trial_end: new Date('2026-06-14T00:00:00.000Z'),
          metadata: {
            stripe_last_event_created: 1780000000,
            stripe_last_event_type: 'customer.subscription.trial_will_end',
            trial_will_end_subscription_id: 'sub_123',
            trial_will_end_at: '2026-06-13T00:00:00.000Z',
          },
        }),
        expectedError: 'persisted subscription trial_will_end_at must match persisted trial_end',
      },
      {
        row: createSubscription('starter', {
          stripe_subscription_id: '   ',
        }),
        expectedError: 'persisted subscription stripe_subscription_id must be a non-empty string',
      },
      {
        row: createSubscription('free', {
          stripe_subscription_id: 'sub_stale',
        }),
        expectedError: 'persisted free subscription cannot include stripe_subscription_id',
      },
      {
        row: createSubscription('free', {
          stripe_price_id: 'price_stale',
        }),
        expectedError: 'persisted free subscription cannot include stripe_price_id',
      },
      {
        row: createSubscription('free', {
          current_period_start: new Date('2026-06-01T00:00:00.000Z'),
          current_period_end: new Date('2026-06-30T23:59:59.999Z'),
        }),
        expectedError: 'persisted free subscription cannot include Stripe billing period',
      },
      {
        row: createSubscription('starter', {
          stripe_subscription_id: undefined,
        }),
        expectedError: 'persisted paid subscription must include stripe_subscription_id',
      },
      {
        row: createSubscription('starter', {
          stripe_price_id: undefined,
        }),
        expectedError: 'persisted paid subscription must include stripe_price_id',
      },
      {
        row: createSubscription('starter', {
          stripe_price_id: 'price_pro',
        }),
        expectedError: 'persisted paid subscription stripe_price_id must match subscription tier',
      },
      {
        row: createSubscription('starter', {
          current_period_start: undefined,
          current_period_end: undefined,
        }),
        expectedError: 'persisted paid subscription must include Stripe billing period',
      },
    ];

    for (const { row, expectedError } of cases) {
      const subscriptionRepository = createRepository<any>([row]);
      const service = new SubscriptionService({
        requireStripe: false,
        enforceCapability: false,
        subscriptionRepository: subscriptionRepository as any,
        businessRepository: createRepository() as any,
        orderRepository: createRepository() as any,
      });

      await expect(service.getSubscription('business-1')).rejects.toMatchObject({
        message: expectedError,
        statusCode: 500,
        code: 'SUBSCRIPTION_DATA_INVALID',
      });
    }
  });

  it('rejects persisted trial evidence before subscription creation before read-side exposure', async () => {
    const subscriptionRepository = createRepository<any>([
      createSubscription('starter', {
        status: 'trialing',
        created_at: new Date('2026-06-02T00:00:00.000Z'),
        trial_start: new Date('2026-06-01T00:00:00.000Z'),
        trial_end: new Date('2026-06-14T00:00:00.000Z'),
      }),
    ]);
    const service = new SubscriptionService({
      requireStripe: false,
      enforceCapability: false,
      subscriptionRepository: subscriptionRepository as any,
      businessRepository: createRepository() as any,
      orderRepository: createRepository() as any,
    });

    await expect(service.getSubscription('business-1')).rejects.toThrow(
      'persisted subscription trial_start cannot be before created_at'
    );
  });

  it('persists supported Stripe creation statuses instead of collapsing active subscriptions to incomplete', async () => {
    const subscription = createSubscription('free', {
      stripe_customer_id: ' cus_123 ',
    });
    const subscriptionRepository = createRepository<any>([subscription]);
    const businessRepository = createRepository<any>([
      { id: 'business-1', name: 'Cafe', email: 'owner@example.com' },
    ]);
    const stripe = {
      subscriptions: {
        create: jest.fn(async () => ({
          id: 'sub_123',
          status: ' active ',
          current_period_start: 1780272000,
          current_period_end: 1782863999,
          trial_start: null,
          trial_end: null,
          items: stripeSubscriptionItems(),
          latest_invoice: null,
        })),
      },
    };
    const service = new SubscriptionService({
      stripe: stripe as any,
      enforceCapability: false,
      subscriptionRepository: subscriptionRepository as any,
      businessRepository: businessRepository as any,
      orderRepository: createRepository() as any,
    });

    await expect(service.createSubscription('business-1', 'starter')).resolves.toMatchObject({
      subscription: expect.objectContaining({
        tier: 'starter',
        status: 'active',
        stripe_subscription_id: 'sub_123',
      }),
    });

    expect(subscriptionRepository.save).toHaveBeenCalledWith(expect.objectContaining({
      tier: 'starter',
      status: 'active',
      stripe_subscription_id: 'sub_123',
    }));
    expect(stripe.subscriptions.create).toHaveBeenCalledWith(expect.objectContaining({
      customer: 'cus_123',
    }));
  });

  it('rejects unsupported Stripe creation statuses before persisting paid subscription upgrades', async () => {
    const subscription = createSubscription('free', {
      stripe_customer_id: 'cus_123',
    });
    const subscriptionRepository = createRepository<any>([subscription]);
    const businessRepository = createRepository<any>([
      { id: 'business-1', name: 'Cafe', email: 'owner@example.com' },
    ]);
    const stripe = {
      subscriptions: {
        create: jest.fn(async () => ({
          id: 'sub_123',
          status: 'paused',
          current_period_start: 1780272000,
          current_period_end: 1782863999,
          trial_start: null,
          trial_end: null,
          latest_invoice: null,
        })),
      },
    };
    const service = new SubscriptionService({
      stripe: stripe as any,
      enforceCapability: false,
      subscriptionRepository: subscriptionRepository as any,
      businessRepository: businessRepository as any,
      orderRepository: createRepository() as any,
    });

    await expect(service.createSubscription('business-1', 'starter')).rejects.toThrow(
      'Failed to create subscription: Stripe subscription status is not supported'
    );

    expect(stripe.subscriptions.create).toHaveBeenCalledTimes(1);
    expect(subscriptionRepository.save).not.toHaveBeenCalled();
    expect(subscription).toMatchObject({
      tier: 'free',
      status: 'active',
      stripe_subscription_id: undefined,
      current_period_start: undefined,
      current_period_end: undefined,
    });
  });

  it('rejects malformed Stripe subscription ids before persisting paid subscription upgrades', async () => {
    const subscription = createSubscription('free', {
      stripe_customer_id: 'cus_123',
    });
    const subscriptionRepository = createRepository<any>([subscription]);
    const businessRepository = createRepository<any>([
      { id: 'business-1', name: 'Cafe', email: 'owner@example.com' },
    ]);
    const stripe = {
      subscriptions: {
        create: jest.fn(async () => ({
          id: '   ',
          status: 'trialing',
          current_period_start: 1780272000,
          current_period_end: 1782863999,
          trial_start: null,
          trial_end: null,
          latest_invoice: null,
        })),
      },
    };
    const service = new SubscriptionService({
      stripe: stripe as any,
      enforceCapability: false,
      subscriptionRepository: subscriptionRepository as any,
      businessRepository: businessRepository as any,
      orderRepository: createRepository() as any,
    });

    await expect(service.createSubscription('business-1', 'starter')).rejects.toMatchObject({
      message: 'Failed to create subscription: Stripe subscription id must be a non-empty string',
      statusCode: 500,
      code: 'SUBSCRIPTION_CREATION_FAILED',
    });

    expect(stripe.subscriptions.create).toHaveBeenCalledTimes(1);
    expect(subscriptionRepository.save).not.toHaveBeenCalled();
    expect(subscription).toMatchObject({
      tier: 'free',
      status: 'active',
      stripe_subscription_id: undefined,
      stripe_price_id: undefined,
      current_period_start: undefined,
      current_period_end: undefined,
    });
  });

  it('rejects malformed Stripe creation periods before persisting a paid subscription upgrade', async () => {
    const subscription = createSubscription('free', {
      stripe_customer_id: 'cus_123',
    });
    const subscriptionRepository = createRepository<any>([subscription]);
    const businessRepository = createRepository<any>([
      { id: 'business-1', name: 'Cafe', email: 'owner@example.com' },
    ]);
    const stripe = {
      subscriptions: {
        create: jest.fn(async () => ({
          id: 'sub_123',
          status: 'trialing',
          current_period_start: 1782863999,
          current_period_end: 1780272000,
          trial_start: null,
          trial_end: null,
          latest_invoice: null,
        })),
      },
    };
    const service = new SubscriptionService({
      stripe: stripe as any,
      enforceCapability: false,
      subscriptionRepository: subscriptionRepository as any,
      businessRepository: businessRepository as any,
      orderRepository: createRepository() as any,
    });

    await expect(service.createSubscription('business-1', 'starter')).rejects.toThrow(
      'Failed to create subscription: Stripe subscription current_period_start cannot be after current_period_end'
    );

    expect(stripe.subscriptions.create).toHaveBeenCalledTimes(1);
    expect(subscriptionRepository.save).not.toHaveBeenCalled();
    expect(subscription).toMatchObject({
      tier: 'free',
      status: 'active',
      stripe_subscription_id: undefined,
      current_period_start: undefined,
      current_period_end: undefined,
    });
  });

  it('creates a portal session only with validated return and provider URLs', async () => {
    const subscription = createSubscription('starter', {
      stripe_customer_id: ' cus_123 ',
    });
    const subscriptionRepository = createRepository<any>([subscription]);
    const stripe = {
      billingPortal: {
        sessions: {
          create: jest.fn(async () => ({
            url: 'https://billing.stripe.com/session/bps_123',
            customer: 'cus_123',
          })),
        },
      },
    };
    const service = new SubscriptionService({
      stripe: stripe as any,
      enforceCapability: false,
      subscriptionRepository: subscriptionRepository as any,
      businessRepository: createRepository() as any,
      orderRepository: createRepository() as any,
    });

    await expect(
      service.createPortalSession('business-1', ' https://app.example.com/billing/return ')
    ).resolves.toBe('https://billing.stripe.com/session/bps_123');

    expect(stripe.billingPortal.sessions.create).toHaveBeenCalledWith({
      customer: 'cus_123',
      return_url: 'https://app.example.com/billing/return',
    });
  });

  it('rejects Stripe portal sessions with mismatched customer evidence before returning URLs', async () => {
    const cases: Array<{
      sessionCustomer: unknown;
      expectedError: string;
    }> = [
      {
        sessionCustomer: 'cus_elsewhere',
        expectedError: 'Stripe portal session customer id must match persisted subscription stripe_customer_id',
      },
      {
        sessionCustomer: { id: 'cus_elsewhere' },
        expectedError: 'Stripe portal session customer id must match persisted subscription stripe_customer_id',
      },
      {
        sessionCustomer: 123,
        expectedError: 'Stripe portal session customer must be a string or object',
      },
      {
        sessionCustomer: { id: '   ' },
        expectedError: 'Stripe portal session customer id must be a non-empty string',
      },
    ];

    for (const { sessionCustomer, expectedError } of cases) {
      const subscription = createSubscription('starter', {
        stripe_customer_id: 'cus_123',
      });
      const subscriptionRepository = createRepository<any>([subscription]);
      const stripe = {
        billingPortal: {
          sessions: {
            create: jest.fn(async () => ({
              url: 'https://billing.stripe.com/session/bps_123',
              customer: sessionCustomer,
            })),
          },
        },
      };
      const service = new SubscriptionService({
        stripe: stripe as any,
        enforceCapability: false,
        subscriptionRepository: subscriptionRepository as any,
        businessRepository: createRepository() as any,
        orderRepository: createRepository() as any,
      });

      await expect(
        service.createPortalSession('business-1', 'https://app.example.com/billing/return')
      ).rejects.toMatchObject({
        message: `Failed to create portal session: ${expectedError}`,
        statusCode: 500,
        code: 'PORTAL_SESSION_FAILED',
      });

      expect(stripe.billingPortal.sessions.create).toHaveBeenCalledWith({
        customer: 'cus_123',
        return_url: 'https://app.example.com/billing/return',
      });
    }
  });

  it('rejects malformed portal return URLs before repository or provider calls', async () => {
    const subscriptionRepository = createRepository<any>([
      createSubscription('starter', { stripe_customer_id: 'cus_123' }),
    ]);
    const stripe = {
      billingPortal: {
        sessions: { create: jest.fn() },
      },
    };
    const service = new SubscriptionService({
      stripe: stripe as any,
      enforceCapability: false,
      subscriptionRepository: subscriptionRepository as any,
      businessRepository: createRepository() as any,
      orderRepository: createRepository() as any,
    });

    await expect(
      service.createPortalSession('business-1', 'javascript:alert(1)')
    ).rejects.toThrow('subscription portal return_url must be an absolute HTTP(S) URL');

    await expect(
      service.createPortalSession('business-1', '/billing/return')
    ).rejects.toThrow('subscription portal return_url must be an absolute HTTP(S) URL');

    await expect(
      service.createPortalSession('business-1', 'https://seller:secret@app.example.com/billing/return')
    ).rejects.toThrow('subscription portal return_url must not include embedded credentials');

    await expect(
      service.createPortalSession(
        'business-1',
        `https://app.example.com/billing/return/${'x'.repeat(2048)}`
      )
    ).rejects.toThrow('subscription portal return_url must be at most 2048 characters');

    for (const internalReturnUrl of [
      'https://localhost/billing/return',
      'https://billing.localhost/return',
      'https://127.0.0.1/billing/return',
      'https://10.0.0.8/billing/return',
      'https://172.16.0.8/billing/return',
      'https://192.168.1.8/billing/return',
      'https://169.254.169.254/latest/meta-data',
      'https://[::1]/billing/return',
      'https://[fd00::1]/billing/return',
      'https://[fe80::1]/billing/return',
    ]) {
      await expect(
        service.createPortalSession('business-1', internalReturnUrl)
      ).rejects.toThrow('subscription portal return_url must use a public HTTP(S) URL');
    }

    await expect(
      service.createPortalSession('business-1', 'https://app.example.com/billing/return\u0007')
    ).rejects.toThrow('subscription portal return_url must not include unsafe control characters');

    await expect(
      service.createPortalSession('business-1', 'https://app.example.com/billing/return\u200B')
    ).rejects.toThrow('subscription portal return_url must not include unsafe control characters');

    await expect(
      service.createPortalSession('business-1', '\uFEFFhttps://app.example.com/billing/return')
    ).rejects.toThrow('subscription portal return_url must not include unsafe control characters');

    for (const returnUrl of [
      'https://localhost/billing/return',
      'https://seller.localhost/billing/return',
      'https://127.0.0.1/billing/return',
      'https://10.0.0.5/billing/return',
      'https://172.16.0.5/billing/return',
      'https://192.168.1.10/billing/return',
      'https://169.254.169.254/latest/meta-data',
      'https://[::1]/billing/return',
      'https://[fd00::1]/billing/return',
      'https://[fe80::1]/billing/return',
    ]) {
      await expect(
        service.createPortalSession('business-1', returnUrl)
      ).rejects.toThrow('subscription portal return_url must use a public HTTP(S) URL');
    }

    expect(subscriptionRepository.findOne).not.toHaveBeenCalled();
    expect(stripe.billingPortal.sessions.create).not.toHaveBeenCalled();
  });

  it('rejects oversized Stripe portal session URLs before returning them to clients', async () => {
    const subscription = createSubscription('starter', {
      stripe_customer_id: 'cus_123',
    });
    const subscriptionRepository = createRepository<any>([subscription]);
    const stripe = {
      billingPortal: {
        sessions: {
          create: jest.fn(async () => ({
            url: `https://billing.stripe.com/session/${'x'.repeat(2048)}`,
          })),
        },
      },
    };
    const service = new SubscriptionService({
      stripe: stripe as any,
      enforceCapability: false,
      subscriptionRepository: subscriptionRepository as any,
      businessRepository: createRepository() as any,
      orderRepository: createRepository() as any,
    });

    await expect(
      service.createPortalSession('business-1', 'https://app.example.com/billing/return')
    ).rejects.toThrow(
      'Failed to create portal session: Stripe portal session URL must be at most 2048 characters'
    );

    expect(stripe.billingPortal.sessions.create).toHaveBeenCalledWith({
      customer: 'cus_123',
      return_url: 'https://app.example.com/billing/return',
    });
  });

  it('rejects malformed Stripe portal session URLs before returning them to clients', async () => {
    const subscription = createSubscription('starter', {
      stripe_customer_id: 'cus_123',
    });
    const subscriptionRepository = createRepository<any>([subscription]);
    const stripe = {
      billingPortal: {
        sessions: {
          create: jest.fn(async () => ({
            url: 'http://billing.stripe.test/session/bps_123',
          })),
        },
      },
    };
    const service = new SubscriptionService({
      stripe: stripe as any,
      enforceCapability: false,
      subscriptionRepository: subscriptionRepository as any,
      businessRepository: createRepository() as any,
      orderRepository: createRepository() as any,
    });

    await expect(
      service.createPortalSession('business-1', 'http://app.example.com/billing/return')
    ).rejects.toThrow('Failed to create portal session: Stripe portal session URL must be an absolute HTTPS URL');

    expect(stripe.billingPortal.sessions.create).toHaveBeenCalledWith({
      customer: 'cus_123',
      return_url: 'http://app.example.com/billing/return',
    });
  });

  it('rejects Stripe portal session URLs with embedded credentials before returning them to clients', async () => {
    const subscription = createSubscription('starter', {
      stripe_customer_id: 'cus_123',
    });
    const subscriptionRepository = createRepository<any>([subscription]);
    const stripe = {
      billingPortal: {
        sessions: {
          create: jest.fn(async () => ({
            url: 'https://stripe:secret@billing.stripe.com/session/bps_123',
          })),
        },
      },
    };
    const service = new SubscriptionService({
      stripe: stripe as any,
      enforceCapability: false,
      subscriptionRepository: subscriptionRepository as any,
      businessRepository: createRepository() as any,
      orderRepository: createRepository() as any,
    });

    await expect(
      service.createPortalSession('business-1', 'https://app.example.com/billing/return')
    ).rejects.toThrow(
      'Failed to create portal session: Stripe portal session URL must not include embedded credentials'
    );

    expect(stripe.billingPortal.sessions.create).toHaveBeenCalledWith({
      customer: 'cus_123',
      return_url: 'https://app.example.com/billing/return',
    });
  });

  it('rejects Stripe portal session URLs with unsafe controls before returning them to clients', async () => {
    const subscription = createSubscription('starter', {
      stripe_customer_id: 'cus_123',
    });
    const subscriptionRepository = createRepository<any>([subscription]);
    const stripe = {
      billingPortal: {
        sessions: {
          create: jest.fn(async () => ({
            url: 'https://billing.stripe.com/session/bps_123\u0000',
          })),
        },
      },
    };
    const service = new SubscriptionService({
      stripe: stripe as any,
      enforceCapability: false,
      subscriptionRepository: subscriptionRepository as any,
      businessRepository: createRepository() as any,
      orderRepository: createRepository() as any,
    });

    await expect(
      service.createPortalSession('business-1', 'https://app.example.com/billing/return')
    ).rejects.toThrow(
      'Failed to create portal session: Stripe portal session URL must not include unsafe control characters'
    );

    expect(stripe.billingPortal.sessions.create).toHaveBeenCalledWith({
      customer: 'cus_123',
      return_url: 'https://app.example.com/billing/return',
    });
  });

  it('rejects Stripe portal session URLs with invisible Unicode controls before returning them to clients', async () => {
    const subscription = createSubscription('starter', {
      stripe_customer_id: 'cus_123',
    });
    const subscriptionRepository = createRepository<any>([subscription]);
    const stripe = {
      billingPortal: {
        sessions: {
          create: jest.fn(async () => ({
            url: 'https://billing.stripe.com/session/bps_123\u202E',
          })),
        },
      },
    };
    const service = new SubscriptionService({
      stripe: stripe as any,
      enforceCapability: false,
      subscriptionRepository: subscriptionRepository as any,
      businessRepository: createRepository() as any,
      orderRepository: createRepository() as any,
    });

    await expect(
      service.createPortalSession('business-1', 'https://app.example.com/billing/return')
    ).rejects.toThrow(
      'Failed to create portal session: Stripe portal session URL must not include unsafe control characters'
    );

    expect(stripe.billingPortal.sessions.create).toHaveBeenCalledWith({
      customer: 'cus_123',
      return_url: 'https://app.example.com/billing/return',
    });
  });

  it('preserves missing Stripe customer domain errors during portal creation', async () => {
    const subscription = createSubscription('starter');
    const subscriptionRepository = createRepository<any>([subscription]);
    const stripe = {
      billingPortal: {
        sessions: { create: jest.fn() },
      },
    };
    const service = new SubscriptionService({
      stripe: stripe as any,
      enforceCapability: false,
      subscriptionRepository: subscriptionRepository as any,
      businessRepository: createRepository() as any,
      orderRepository: createRepository() as any,
    });

    await expect(
      service.createPortalSession('business-1', 'https://app.example.com/billing/return')
    ).rejects.toMatchObject({
      message: 'No Stripe customer found',
      statusCode: 404,
      code: 'STRIPE_CUSTOMER_NOT_FOUND',
    });

    expect(stripe.billingPortal.sessions.create).not.toHaveBeenCalled();
  });
});

describe('subscription admin listing filters', () => {
  it('applies only validated subscription admin filters to repository reads', async () => {
    const subscriptionRepository = createRepository<any>([
      createSubscription('starter', { status: 'active' }),
    ]);
    const service = new SubscriptionService({
      requireStripe: false,
      enforceCapability: false,
      subscriptionRepository: subscriptionRepository as any,
      businessRepository: createRepository() as any,
      orderRepository: createRepository() as any,
    });

    await expect(
      service.getAllSubscriptions({ tier: ' starter ' as any, status: ' active ' })
    ).resolves.toHaveLength(1);

    expect(subscriptionRepository.find).toHaveBeenCalledWith({
      where: { tier: 'starter', status: 'active' },
      relations: ['business'],
      order: { created_at: 'DESC' },
    });
  });

  it('rejects malformed subscription admin filters before repository reads', async () => {
    const subscriptionRepository = createRepository<any>();
    const service = new SubscriptionService({
      requireStripe: false,
      enforceCapability: false,
      subscriptionRepository: subscriptionRepository as any,
      businessRepository: createRepository() as any,
      orderRepository: createRepository() as any,
    });

    await expect(
      service.getAllSubscriptions({ tier: 'enterprise' as any })
    ).rejects.toThrow('subscription tier filter has an invalid tier');

    await expect(
      service.getAllSubscriptions({ tier: '\uFEFFfree' as any })
    ).rejects.toThrow('subscription tier filter must not include unsafe control characters');

    await expect(
      service.getAllSubscriptions({ status: 'teleported' })
    ).rejects.toThrow('subscription status filter has an invalid status');

    await expect(
      service.getAllSubscriptions({ status: 'active\uFEFF' })
    ).rejects.toThrow('subscription status filter must not include unsafe control characters');

    await expect(
      service.getAllSubscriptions(null as any)
    ).rejects.toThrow('subscription admin filters must be an object');

    await expect(
      service.getAllSubscriptions([] as any)
    ).rejects.toThrow('subscription admin filters must be an object');

    await expect(
      service.getAllSubscriptions({ business_id: 'business-2' } as any)
    ).rejects.toThrow('subscription admin filter business_id is not supported');

    await expect(
      service.getAllSubscriptions({ ['business_id\uFEFF']: 'business-2' } as any)
    ).rejects.toThrow('subscription admin filters field names must not include unsafe control characters');

    expect(subscriptionRepository.find).not.toHaveBeenCalled();
  });

  it('rejects subscription admin rows that do not match requested filters before exposure', async () => {
    const subscriptionRepository = {
      ...createRepository<any>(),
      find: jest.fn(async () => [
        createSubscription('starter', { status: 'active' }),
        createSubscription('pro', {
          id: 'subscription-2',
          business_id: 'business-2',
          status: 'active',
        }),
      ]),
    };
    const service = new SubscriptionService({
      requireStripe: false,
      enforceCapability: false,
      subscriptionRepository: subscriptionRepository as any,
      businessRepository: createRepository() as any,
      orderRepository: createRepository() as any,
    });

    await expect(
      service.getAllSubscriptions({ tier: 'starter', status: 'active' })
    ).rejects.toMatchObject({
      message: 'persisted subscription admin row 2 tier must match requested filter',
      statusCode: 500,
      code: 'SUBSCRIPTION_DATA_INVALID',
    });
  });

  it('rejects subscription admin rows with mismatched requested status before exposure', async () => {
    const subscriptionRepository = {
      ...createRepository<any>(),
      find: jest.fn(async () => [
        createSubscription('starter', { status: 'past_due' }),
      ]),
    };
    const service = new SubscriptionService({
      requireStripe: false,
      enforceCapability: false,
      subscriptionRepository: subscriptionRepository as any,
      businessRepository: createRepository() as any,
      orderRepository: createRepository() as any,
    });

    await expect(
      service.getAllSubscriptions({ status: 'active' })
    ).rejects.toMatchObject({
      message: 'persisted subscription admin row 1 status must match requested filter',
      statusCode: 500,
      code: 'SUBSCRIPTION_DATA_INVALID',
    });
  });

  it('matches normalized persisted subscription admin tier and status evidence before exposure', async () => {
    const subscriptionRepository = {
      ...createRepository<any>(),
      find: jest.fn(async () => [
        createSubscription('starter', {
          tier: ' starter ' as any,
          status: ' active ' as any,
          stripe_price_id: 'price_starter',
        }),
      ]),
    };
    const service = new SubscriptionService({
      requireStripe: false,
      enforceCapability: false,
      subscriptionRepository: subscriptionRepository as any,
      businessRepository: createRepository() as any,
      orderRepository: createRepository() as any,
    });

    await expect(
      service.getAllSubscriptions({ tier: 'starter', status: 'active' })
    ).resolves.toHaveLength(1);
  });

  it('rejects subscription admin rows with unsupported persisted fields before exposure', async () => {
    const subscriptionRepository = {
      ...createRepository<any>(),
      find: jest.fn(async () => [
        createSubscription('starter', {
          provider_trace_id: 'trace-123',
        } as any),
      ]),
    };
    const service = new SubscriptionService({
      requireStripe: false,
      enforceCapability: false,
      subscriptionRepository: subscriptionRepository as any,
      businessRepository: createRepository() as any,
      orderRepository: createRepository() as any,
    });

    await expect(service.getAllSubscriptions()).rejects.toMatchObject({
      message: 'persisted subscription include unsupported field(s): provider_trace_id',
      statusCode: 500,
      code: 'SUBSCRIPTION_DATA_INVALID',
    });

    subscriptionRepository.find.mockResolvedValueOnce([
      createSubscription('starter', {
        ['provider_trace_id\uFEFF']: 'trace-123',
      } as any),
    ]);

    await expect(service.getAllSubscriptions()).rejects.toMatchObject({
      message: 'persisted subscription field names must not include unsafe control characters',
      statusCode: 500,
      code: 'SUBSCRIPTION_DATA_INVALID',
    });
  });

  it('rejects subscription admin rows with missing loaded business relations before exposure', async () => {
    const subscriptionRepository = {
      ...createRepository<any>(),
      find: jest.fn(async () => [
        createSubscription('starter', {
          business: null as any,
        }),
      ]),
    };
    const service = new SubscriptionService({
      requireStripe: false,
      enforceCapability: false,
      subscriptionRepository: subscriptionRepository as any,
      businessRepository: createRepository() as any,
      orderRepository: createRepository() as any,
    });

    await expect(service.getAllSubscriptions()).rejects.toMatchObject({
      message: 'persisted subscription business relation is required when loaded',
      statusCode: 500,
      code: 'SUBSCRIPTION_DATA_INVALID',
    });
  });

  it('rejects malformed subscription admin row envelopes before uniqueness checks', async () => {
    const subscriptionRepository = {
      ...createRepository<any>(),
      find: jest.fn(async () => [
        createSubscription('free', {
          id: 'subscription-1',
          business_id: 'business-1',
        }),
        [] as any,
      ]),
    };
    const service = new SubscriptionService({
      requireStripe: false,
      enforceCapability: false,
      subscriptionRepository: subscriptionRepository as any,
      businessRepository: createRepository() as any,
      orderRepository: createRepository() as any,
    });

    await expect(service.getAllSubscriptions()).rejects.toMatchObject({
      message: 'persisted subscription admin row 2 must be an object',
      statusCode: 500,
      code: 'SUBSCRIPTION_DATA_INVALID',
    });
  });

  it('rejects duplicate subscription admin business rows before exposure', async () => {
    const subscriptionRepository = {
      ...createRepository<any>(),
      find: jest.fn(async () => [
        createSubscription('starter', {
          id: 'subscription-1',
          business_id: 'business-1',
          status: 'active',
        }),
        createSubscription('pro', {
          id: 'subscription-duplicate',
          business_id: 'business-1',
          status: 'past_due',
        }),
      ]),
    };
    const service = new SubscriptionService({
      requireStripe: false,
      enforceCapability: false,
      subscriptionRepository: subscriptionRepository as any,
      businessRepository: createRepository() as any,
      orderRepository: createRepository() as any,
    });

    await expect(service.getAllSubscriptions()).rejects.toMatchObject({
      message: 'persisted subscription admin row 2 business_id must be unique',
      statusCode: 500,
      code: 'SUBSCRIPTION_DATA_INVALID',
    });
  });

  it('rejects duplicate subscription admin row ids before exposure', async () => {
    const subscriptionRepository = {
      ...createRepository<any>(),
      find: jest.fn(async () => [
        createSubscription('free', {
          id: 'subscription-duplicate',
          business_id: 'business-1',
        }),
        createSubscription('free', {
          id: 'subscription-duplicate',
          business_id: 'business-2',
        }),
      ]),
    };
    const service = new SubscriptionService({
      requireStripe: false,
      enforceCapability: false,
      subscriptionRepository: subscriptionRepository as any,
      businessRepository: createRepository() as any,
      orderRepository: createRepository() as any,
    });

    await expect(service.getAllSubscriptions()).rejects.toMatchObject({
      message: 'persisted subscription admin row 2 id must be unique',
      statusCode: 500,
      code: 'SUBSCRIPTION_DATA_INVALID',
    });
  });

  it('rejects duplicate subscription admin Stripe evidence before exposure', async () => {
    const cases = [
      {
        rows: [
          createSubscription('starter', {
            id: 'subscription-1',
            business_id: 'business-1',
            stripe_customer_id: 'cus_1',
            stripe_subscription_id: ' sub_shared ',
          }),
          createSubscription('pro', {
            id: 'subscription-2',
            business_id: 'business-2',
            stripe_customer_id: 'cus_2',
            stripe_subscription_id: 'sub_shared',
          }),
        ],
        expectedError: 'persisted subscription admin row 2 stripe_subscription_id must be unique',
      },
      {
        rows: [
          createSubscription('starter', {
            id: 'subscription-1',
            business_id: 'business-1',
            stripe_customer_id: ' cus_shared ',
            stripe_subscription_id: 'sub_1',
          }),
          createSubscription('pro', {
            id: 'subscription-2',
            business_id: 'business-2',
            stripe_customer_id: 'cus_shared',
            stripe_subscription_id: 'sub_2',
          }),
        ],
        expectedError: 'persisted subscription admin row 2 stripe_customer_id must be unique',
      },
    ];

    for (const { rows, expectedError } of cases) {
      const subscriptionRepository = {
        ...createRepository<any>(),
        find: jest.fn(async () => rows),
      };
      const service = new SubscriptionService({
        requireStripe: false,
        enforceCapability: false,
        subscriptionRepository: subscriptionRepository as any,
        businessRepository: createRepository() as any,
        orderRepository: createRepository() as any,
      });

      await expect(service.getAllSubscriptions()).rejects.toMatchObject({
        message: expectedError,
        statusCode: 500,
        code: 'SUBSCRIPTION_DATA_INVALID',
      });
    }
  });
});

describe('subscription order limits', () => {
  it('uses the explicit Stripe billing period when checking order usage', async () => {
    const subscription = createSubscription('starter', {
      current_period_start: new Date('2026-06-01T00:00:00.000Z'),
      current_period_end: new Date('2026-06-30T23:59:59.999Z'),
    });
    const subscriptionRepository = createRepository<any>([subscription]);
    const orderRepository = createRepository<any>();
    orderRepository.count = jest.fn(async () => 100);
    const service = new SubscriptionService({
      requireStripe: false,
      enforceCapability: false,
      subscriptionRepository: subscriptionRepository as any,
      businessRepository: createRepository() as any,
      orderRepository: orderRepository as any,
    });

    await expect(service.checkOrderLimit('business-1')).resolves.toEqual({
      allowed: false,
      current: 100,
      limit: 100,
      isUnlimited: false,
    });

    expect(orderRepository.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        business_id: 'business-1',
        created_at: expect.objectContaining({
          _type: 'between',
        }),
      }),
    });
  });

  it('derives a UTC month window when no billing period has been recorded yet', () => {
    expect(getSubscriptionBillingPeriod({}, new Date('2026-06-21T12:34:00.000Z'))).toEqual({
      periodStart: new Date('2026-06-01T00:00:00.000Z'),
      periodEnd: new Date('2026-06-30T23:59:59.999Z'),
    });
  });

  it('rejects invalid fallback billing clocks before deriving quota windows', () => {
    expect(() =>
      getSubscriptionBillingPeriod({}, new Date('not-a-billing-clock'))
    ).toThrow('subscription billing period fallback clock must be a valid Date');
  });

  it('rejects corrupt persisted billing periods before checking order usage', async () => {
    const subscription = createSubscription('starter', {
      current_period_start: new Date('2026-07-01T00:00:00.000Z'),
      current_period_end: new Date('2026-06-01T00:00:00.000Z'),
    });
    const subscriptionRepository = createRepository<any>([subscription]);
    const orderRepository = createRepository<any>();
    orderRepository.count = jest.fn(async () => 0);
    const service = new SubscriptionService({
      requireStripe: false,
      enforceCapability: false,
      subscriptionRepository: subscriptionRepository as any,
      businessRepository: createRepository() as any,
      orderRepository: orderRepository as any,
    });

    await expect(service.checkOrderLimit('business-1')).rejects.toThrow(
      'subscription current_period_start cannot be after current_period_end'
    );
    expect(orderRepository.count).not.toHaveBeenCalled();
  });

  it('rejects persisted billing periods before subscription creation before checking order usage', async () => {
    const subscription = createSubscription('starter', {
      created_at: new Date('2026-06-02T00:00:00.000Z'),
      current_period_start: new Date('2026-06-01T00:00:00.000Z'),
      current_period_end: new Date('2026-06-30T23:59:59.999Z'),
    });
    const subscriptionRepository = createRepository<any>([subscription]);
    const orderRepository = createRepository<any>();
    orderRepository.count = jest.fn(async () => 0);
    const service = new SubscriptionService({
      requireStripe: false,
      enforceCapability: false,
      subscriptionRepository: subscriptionRepository as any,
      businessRepository: createRepository() as any,
      orderRepository: orderRepository as any,
    });

    await expect(service.checkOrderLimit('business-1')).rejects.toMatchObject({
      message: 'persisted subscription current_period_start cannot be before created_at',
      statusCode: 500,
      code: 'SUBSCRIPTION_DATA_INVALID',
    });
    expect(orderRepository.count).not.toHaveBeenCalled();
  });

  it('rejects corrupt persisted subscription tiers before checking order usage', async () => {
    const subscription = createSubscription('starter', {
      tier: 'enterprise' as any,
      current_period_start: new Date('2026-06-01T00:00:00.000Z'),
      current_period_end: new Date('2026-06-30T23:59:59.999Z'),
    });
    const subscriptionRepository = createRepository<any>([subscription]);
    const orderRepository = createRepository<any>();
    orderRepository.count = jest.fn(async () => 0);
    const service = new SubscriptionService({
      requireStripe: false,
      enforceCapability: false,
      subscriptionRepository: subscriptionRepository as any,
      businessRepository: createRepository() as any,
      orderRepository: orderRepository as any,
    });

    await expect(service.checkOrderLimit('business-1')).rejects.toThrow(
      'subscription tier has an invalid tier'
    );
    expect(orderRepository.count).not.toHaveBeenCalled();
  });

  it('fails closed for non-entitled persisted subscription statuses before checking order usage', async () => {
    const cases: Array<Partial<Subscription>> = [
      {
        status: 'canceled',
        canceled_at: new Date('2026-06-15T00:00:00.000Z'),
      },
      { status: 'past_due' },
      { status: 'incomplete' },
    ];

    for (const overrides of cases) {
      const subscription = createSubscription('starter', overrides);
      const subscriptionRepository = createRepository<any>([subscription]);
      const orderRepository = createRepository<any>();
      orderRepository.count = jest.fn(async () => 25);
      const service = new SubscriptionService({
        requireStripe: false,
        enforceCapability: false,
        subscriptionRepository: subscriptionRepository as any,
        businessRepository: createRepository() as any,
        orderRepository: orderRepository as any,
      });

      await expect(service.checkOrderLimit('business-1')).resolves.toEqual({
        allowed: false,
        current: 0,
        limit: 0,
        isUnlimited: false,
      });
      expect(orderRepository.count).not.toHaveBeenCalled();
    }
  });

  it('rejects partial or invalid persisted billing periods before deriving quota windows', () => {
    expect(() =>
      getSubscriptionBillingPeriod({
        current_period_start: new Date('2026-06-01T00:00:00.000Z'),
      })
    ).toThrow('subscription billing period must include both current_period_start and current_period_end');

    expect(() =>
      getSubscriptionBillingPeriod({
        current_period_start: new Date('not-a-period'),
        current_period_end: new Date('2026-06-30T23:59:59.999Z'),
      })
    ).toThrow('subscription current_period_start must be a valid Date');
  });

  it('keeps unlimited tiers explicit while preserving current usage count', () => {
    const subscription = createSubscription('pro');

    expect(evaluateSubscriptionOrderLimit(subscription, 250)).toEqual({
      allowed: true,
      current: 250,
      limit: -1,
      isUnlimited: true,
    });
  });

  it('rejects impossible usage counts and tier limits before making quota decisions', () => {
    const subscription = createSubscription('starter');

    expect(() => evaluateSubscriptionOrderLimit(subscription, -1)).toThrow(/orderCount/);
    expect(() => evaluateSubscriptionOrderLimit(subscription, 1.5)).toThrow(/orderCount/);
    expect(() =>
      evaluateSubscriptionOrderLimit(subscription, Number.MAX_SAFE_INTEGER + 1)
    ).toThrow('orderCount must be a non-negative safe integer');
    expect(() =>
      evaluateSubscriptionOrderLimit(
        { getMaxOrders: () => -2 },
        0
      )
    ).toThrow(/subscription order limit/);
    expect(() =>
      evaluateSubscriptionOrderLimit(
        { getMaxOrders: () => 10.5 },
        0
      )
    ).toThrow(/subscription order limit/);
    expect(() =>
      evaluateSubscriptionOrderLimit(
        { getMaxOrders: () => Number.MAX_SAFE_INTEGER + 1 },
        0
      )
    ).toThrow('subscription order limit must be a non-negative safe integer or -1 for unlimited');
  });
});

describe('subscription webhook lifecycle state', () => {
  it('ignores unsupported subscription webhook events before repository reads', async () => {
    const subscriptionRepository = createRepository<any>([
      createSubscription('starter', { stripe_subscription_id: 'sub_123' }),
    ]);
    const service = new SubscriptionService({
      requireStripe: false,
      enforceCapability: false,
      subscriptionRepository: subscriptionRepository as any,
      businessRepository: createRepository() as any,
      orderRepository: createRepository() as any,
    });

    await expect(
      service.handleSubscriptionWebhook({
        type: 'invoice.paid',
        created: 1780000000,
        data: { object: { id: 'sub_123' } },
      } as any)
    ).resolves.toBeNull();

    expect(subscriptionRepository.findOne).not.toHaveBeenCalled();
    expect(subscriptionRepository.save).not.toHaveBeenCalled();
  });

  it('rejects malformed subscription webhook boundaries before repository reads', async () => {
    const subscriptionRepository = createRepository<any>();
    const service = new SubscriptionService({
      requireStripe: false,
      enforceCapability: false,
      subscriptionRepository: subscriptionRepository as any,
      businessRepository: createRepository() as any,
      orderRepository: createRepository() as any,
    });

    await expect(
      service.handleSubscriptionWebhook({
        type: 'customer.subscription.updated',
        created: -1,
        data: { object: { id: 'sub_123' } },
      } as any)
    ).rejects.toThrow('Stripe event created timestamp must be a non-negative integer Stripe timestamp');

    await expect(
      service.handleSubscriptionWebhook({
        type: 'customer.subscription.updated',
        created: 1780000000,
        data: { object: { id: '   ' } },
      } as any)
    ).rejects.toThrow('Stripe subscription id must be a non-empty string');

    const malformedPayloadEvents = [
      {
        type: 'customer.subscription.updated',
        created: 1780000000,
        data: {},
      },
      {
        type: 'customer.subscription.deleted',
        created: 1780000000,
        data: { object: null },
      },
      {
        type: 'customer.subscription.trial_will_end',
        created: 1780000000,
        data: { object: [] },
      },
    ];

    for (const event of malformedPayloadEvents) {
      await expect(
        service.handleSubscriptionWebhook(event as any)
      ).rejects.toThrow('Stripe subscription webhook payload must be an object');
    }

    expect(subscriptionRepository.findOne).not.toHaveBeenCalled();
    expect(subscriptionRepository.save).not.toHaveBeenCalled();
  });

  it('rejects webhook identity evidence that does not match the persisted subscription row', async () => {
    const scenarios = [
      {
        name: 'customer id mismatch',
        subscription: createSubscription('starter', {
          stripe_subscription_id: 'sub_123',
          stripe_customer_id: 'cus_local',
        }),
        stripeObject: {
          id: 'sub_123',
          customer: 'cus_other',
        },
        expectedError: 'Stripe subscription customer id must match persisted subscription stripe_customer_id',
      },
      {
        name: 'business metadata mismatch',
        subscription: createSubscription('starter', {
          stripe_subscription_id: 'sub_123',
          stripe_customer_id: 'cus_local',
        }),
        stripeObject: {
          id: 'sub_123',
          customer: 'cus_local',
          metadata: {
            business_id: 'business-other',
            tier: 'starter',
          },
        },
        expectedError: 'Stripe subscription metadata business_id must match persisted subscription business_id',
      },
      {
        name: 'tier metadata mismatch',
        subscription: createSubscription('starter', {
          stripe_subscription_id: 'sub_123',
          stripe_customer_id: 'cus_local',
        }),
        stripeObject: {
          id: 'sub_123',
          customer: 'cus_local',
          metadata: {
            business_id: 'business-1',
            tier: 'pro',
          },
        },
        expectedError: 'Stripe subscription metadata tier must match persisted subscription tier',
      },
      {
        name: 'unsupported provider metadata',
        subscription: createSubscription('starter', {
          stripe_subscription_id: 'sub_123',
          stripe_customer_id: 'cus_local',
        }),
        stripeObject: {
          id: 'sub_123',
          customer: 'cus_local',
          metadata: {
            business_id: 'business-1',
            tier: 'starter',
            provider_trace_id: 'trace-123',
          },
        },
        expectedError: 'Stripe subscription metadata include unsupported field(s): provider_trace_id',
      },
    ];

    for (const scenario of scenarios) {
      const subscriptionRepository = createRepository<any>([scenario.subscription]);
      const service = new SubscriptionService({
        requireStripe: false,
        enforceCapability: false,
        subscriptionRepository: subscriptionRepository as any,
        businessRepository: createRepository() as any,
        orderRepository: createRepository() as any,
      });

      await expect(
        service.handleSubscriptionWebhook({
          type: 'customer.subscription.updated',
          created: 1780000000,
          data: {
            object: {
              ...scenario.stripeObject,
              status: 'active',
              cancel_at_period_end: false,
              current_period_start: 1780000000,
              current_period_end: 1782678400,
              trial_start: null,
              trial_end: null,
            },
          },
        } as any)
      ).rejects.toThrow(scenario.expectedError);

      expect(subscriptionRepository.save).not.toHaveBeenCalled();
      expect(scenario.subscription.status).toBe('active');
    }
  });

  it('normalizes webhook subscription identifiers before subscription lookup and trial metadata', async () => {
    const subscription = createSubscription('starter', {
      stripe_subscription_id: 'sub_123',
      status: 'trialing',
      trial_start: new Date('2026-05-18T00:00:00.000Z'),
      trial_end: new Date('2026-06-01T00:00:00.000Z'),
    });
    const subscriptionRepository = createRepository<any>([subscription]);
    const service = new SubscriptionService({
      requireStripe: false,
      enforceCapability: false,
      subscriptionRepository: subscriptionRepository as any,
      businessRepository: createRepository() as any,
      orderRepository: createRepository() as any,
    });

    await expect(
      service.handleSubscriptionWebhook({
        type: 'customer.subscription.trial_will_end',
        created: 1780000000,
        data: {
          object: {
            id: ' sub_123 ',
            trial_end: 1780272000,
          },
        },
      } as any)
    ).resolves.toEqual({ applied: true, reason: 'applied' });

    expect(subscriptionRepository.findOne).toHaveBeenCalledWith({
      where: { stripe_subscription_id: 'sub_123' },
    });
    expect(subscriptionRepository.save).toHaveBeenCalledWith(expect.objectContaining({
      metadata: expect.objectContaining({
        trial_will_end_subscription_id: 'sub_123',
      }),
    }));
  });

  it('rejects trial-ending webhook events without trial_end before metadata persistence', async () => {
    const subscription = createSubscription('starter', {
      stripe_subscription_id: 'sub_123',
    });
    const subscriptionRepository = createRepository<any>([subscription]);
    const service = new SubscriptionService({
      requireStripe: false,
      enforceCapability: false,
      subscriptionRepository: subscriptionRepository as any,
      businessRepository: createRepository() as any,
      orderRepository: createRepository() as any,
    });

    await expect(
      service.handleSubscriptionWebhook({
        type: 'customer.subscription.trial_will_end',
        created: 1780000000,
        data: {
          object: {
            id: 'sub_123',
          },
        },
      } as any)
    ).rejects.toThrow('Stripe subscription trial_end is required for trial_will_end events');

    expect(subscriptionRepository.save).not.toHaveBeenCalled();
    expect(subscription.metadata).toBeUndefined();
  });

  it('rejects corrupt persisted webhook metadata before lifecycle mutation', async () => {
    const subscription = createSubscription('starter', {
      stripe_subscription_id: 'sub_123',
      metadata: {
        stripe_last_event_created: '1780000000',
      } as any,
    });
    const subscriptionRepository = createRepository<any>([subscription]);
    const service = new SubscriptionService({
      requireStripe: false,
      enforceCapability: false,
      subscriptionRepository: subscriptionRepository as any,
      businessRepository: createRepository() as any,
      orderRepository: createRepository() as any,
    });

    await expect(
      service.handleSubscriptionWebhook({
        type: 'customer.subscription.updated',
        created: 1780000001,
        data: {
          object: {
            id: 'sub_123',
            status: 'active',
            cancel_at_period_end: false,
            current_period_start: 1780000000,
            current_period_end: 1782678400,
            trial_start: null,
            trial_end: null,
          },
        },
      } as any)
    ).rejects.toMatchObject({
      message: 'persisted subscription stripe_last_event_created must be a Stripe timestamp',
      statusCode: 500,
      code: 'SUBSCRIPTION_DATA_INVALID',
    });

    expect(subscription.status).toBe('active');
    expect(subscriptionRepository.save).not.toHaveBeenCalled();
  });

  it('applies Stripe subscription snapshots with event-order metadata', () => {
    const subscription = createSubscription('starter', {
      status: 'incomplete',
      canceled_at: new Date('2026-05-15T00:00:00.000Z'),
      trial_start: new Date('2026-05-01T00:00:00.000Z'),
      trial_end: new Date('2026-05-14T00:00:00.000Z'),
      metadata: { stripe_last_event_created: 100 },
    });

    const result = applyStripeSubscriptionSnapshot(
      subscription,
      {
        status: 'active',
        current_period_start: 1780272000,
        current_period_end: 1782863999,
        cancel_at_period_end: true,
        canceled_at: null,
        trial_start: null,
        trial_end: null,
      } as any,
      'customer.subscription.updated',
      101
    );

    expect(result).toEqual({ applied: true, reason: 'applied' });
    expect(subscription).toMatchObject({
      status: 'active',
      cancel_at_period_end: true,
      current_period_start: new Date('2026-06-01T00:00:00.000Z'),
      current_period_end: new Date('2026-06-30T23:59:59.000Z'),
      canceled_at: null,
      trial_start: null,
      trial_end: null,
      metadata: expect.objectContaining({
        stripe_last_event_type: 'customer.subscription.updated',
        stripe_last_event_created: 101,
      }),
    });
  });

  it('clears stale local trial dates when Stripe snapshots report no active trial', () => {
    const subscription = createSubscription('starter', {
      stripe_subscription_id: 'sub_123',
      status: 'trialing',
      trial_start: new Date('2026-05-01T00:00:00.000Z'),
      trial_end: new Date('2026-05-14T00:00:00.000Z'),
      metadata: {
        stripe_last_event_created: 100,
        stripe_last_event_type: 'customer.subscription.trial_will_end',
        trial_will_end_subscription_id: 'sub_123',
        trial_will_end_at: '2026-05-14T00:00:00.000Z',
      },
    });

    const result = applyStripeSubscriptionSnapshot(
      subscription,
      {
        status: 'active',
        current_period_start: 1780272000,
        current_period_end: 1782863999,
        cancel_at_period_end: false,
        canceled_at: null,
        trial_start: null,
        trial_end: null,
      } as any,
      'customer.subscription.updated',
      101
    );

    expect(result).toEqual({ applied: true, reason: 'applied' });
    expect(subscription).toMatchObject({
      status: 'active',
      current_period_start: new Date('2026-06-01T00:00:00.000Z'),
      current_period_end: new Date('2026-06-30T23:59:59.000Z'),
      metadata: expect.objectContaining({
        stripe_last_event_type: 'customer.subscription.updated',
        stripe_last_event_created: 101,
      }),
    });
    expect(subscription.trial_start).toBeNull();
    expect(subscription.trial_end).toBeNull();
    expect(subscription.metadata).not.toHaveProperty('trial_will_end_subscription_id');
    expect(subscription.metadata).not.toHaveProperty('trial_will_end_at');
  });

  it('ignores stale Stripe subscription snapshots without mutating local state', () => {
    const subscription = createSubscription('starter', {
      status: 'active',
      metadata: { stripe_last_event_created: 200 },
    });

    const result = applyStripeSubscriptionSnapshot(
      subscription,
      {
        status: 'past_due',
        current_period_start: 1780272000,
        current_period_end: 1782863999,
        cancel_at_period_end: false,
        canceled_at: null,
        trial_start: null,
        trial_end: null,
      } as any,
      'customer.subscription.updated',
      199
    );

    expect(result).toEqual({ applied: false, reason: 'stale_event' });
    expect(subscription.status).toBe('active');
    expect(subscription.metadata).toEqual({ stripe_last_event_created: 200 });
  });

  it('prevents Stripe snapshot updates at the same timestamp after terminal deletion metadata', () => {
    const subscription = createSubscription('starter', {
      status: 'canceled',
      metadata: {
        stripe_last_event_created: 200,
        stripe_last_event_type: 'customer.subscription.deleted',
      },
    });

    const result = applyStripeSubscriptionSnapshot(
      subscription,
      {
        status: 'active',
        current_period_start: 1780272000,
        current_period_end: 1782863999,
        cancel_at_period_end: false,
        canceled_at: null,
        trial_start: null,
        trial_end: null,
      } as any,
      'customer.subscription.updated',
      200
    );

    expect(result).toEqual({ applied: false, reason: 'stale_event' });
    expect(subscription).toMatchObject({
      status: 'canceled',
      metadata: {
        stripe_last_event_created: 200,
        stripe_last_event_type: 'customer.subscription.deleted',
      },
    });
  });

  it('rejects corrupt local lifecycle metadata before Stripe event ordering or mutation', () => {
    const snapshotSubscription = createSubscription('starter', {
      status: 'active',
      metadata: [] as any,
    });

    expect(() =>
      applyStripeSubscriptionSnapshot(
        snapshotSubscription,
        {
          status: 'past_due',
          current_period_start: 1780272000,
          current_period_end: 1782863999,
          cancel_at_period_end: false,
          canceled_at: null,
          trial_start: null,
          trial_end: null,
        } as any,
        'customer.subscription.updated',
        201
      )
    ).toThrow('persisted subscription metadata must be an object');

    expect(snapshotSubscription).toMatchObject({
      status: 'active',
      metadata: [],
    });

    const deletedSubscription = createSubscription('starter', {
      status: 'active',
      metadata: { stripe_last_event_created: '200' } as any,
    });

    expect(() =>
      applyStripeSubscriptionDeleted(
        deletedSubscription,
        { canceled_at: null } as any,
        'customer.subscription.deleted',
        201
      )
    ).toThrow('persisted subscription stripe_last_event_created must be a Stripe timestamp');

    expect(deletedSubscription).toMatchObject({
      status: 'active',
      metadata: { stripe_last_event_created: '200' },
    });
    expect(deletedSubscription.canceled_at).toBeUndefined();
  });

  it('rejects malformed Stripe webhook subscription payload envelopes before lifecycle mutation', () => {
    const cases: Array<{
      name: string;
      apply: (subscription: any, payload: unknown) => void;
      payload: unknown;
      expectedError: string;
    }> = [
      {
        name: 'snapshot null payload',
        apply: (subscription, payload) => {
          applyStripeSubscriptionSnapshot(
            subscription,
            payload as any,
            'customer.subscription.updated',
            101
          );
        },
        payload: null,
        expectedError: 'Stripe subscription snapshot payload must be an object',
      },
      {
        name: 'snapshot array payload',
        apply: (subscription, payload) => {
          applyStripeSubscriptionSnapshot(
            subscription,
            payload as any,
            'customer.subscription.updated',
            101
          );
        },
        payload: [],
        expectedError: 'Stripe subscription snapshot payload must be an object',
      },
      {
        name: 'deletion scalar payload',
        apply: (subscription, payload) => {
          applyStripeSubscriptionDeleted(
            subscription,
            payload as any,
            'customer.subscription.deleted',
            101
          );
        },
        payload: 'sub_123',
        expectedError: 'Stripe subscription deletion payload must be an object',
      },
      {
        name: 'deletion array payload',
        apply: (subscription, payload) => {
          applyStripeSubscriptionDeleted(
            subscription,
            payload as any,
            'customer.subscription.deleted',
            101
          );
        },
        payload: [],
        expectedError: 'Stripe subscription deletion payload must be an object',
      },
    ];

    for (const { apply, payload, expectedError } of cases) {
      const subscription = createSubscription('starter', {
        stripe_customer_id: 'cus_123',
        status: 'active',
        cancel_at_period_end: false,
        canceled_at: null,
        current_period_start: new Date('2026-06-01T00:00:00.000Z'),
        current_period_end: new Date('2026-06-30T23:59:59.000Z'),
        metadata: { stripe_last_event_created: 100 },
      });

      expect(() => apply(subscription, payload)).toThrow(expectedError);

      expect(subscription).toMatchObject({
        status: 'active',
        cancel_at_period_end: false,
        canceled_at: null,
        current_period_start: new Date('2026-06-01T00:00:00.000Z'),
        current_period_end: new Date('2026-06-30T23:59:59.000Z'),
        metadata: { stripe_last_event_created: 100 },
      });
    }
  });

  it('rejects unsupported Stripe webhook helper event types before lifecycle mutation', () => {
    const snapshotSubscription = createSubscription('starter', {
      status: 'active',
      metadata: { stripe_last_event_created: 100 },
    });

    expect(() =>
      applyStripeSubscriptionSnapshot(
        snapshotSubscription,
        {
          status: 'past_due',
          current_period_start: 1780272000,
          current_period_end: 1782863999,
          cancel_at_period_end: false,
          canceled_at: null,
          trial_start: null,
          trial_end: null,
        } as any,
        'invoice.paid',
        101
      )
    ).toThrow('Stripe subscription snapshot event type must be a supported subscription webhook event');

    expect(snapshotSubscription).toMatchObject({
      status: 'active',
      current_period_start: new Date('2026-06-01T00:00:00.000Z'),
      current_period_end: new Date('2026-06-30T23:59:59.999Z'),
      metadata: { stripe_last_event_created: 100 },
    });

    const deletedSubscription = createSubscription('starter', {
      status: 'active',
      metadata: { stripe_last_event_created: 100 },
    });

    expect(() =>
      applyStripeSubscriptionDeleted(
        deletedSubscription,
        { canceled_at: null } as any,
        'customer.subscription.updated',
        101
      )
    ).toThrow('Stripe subscription deletion event type must be a supported subscription webhook event');

    expect(deletedSubscription).toMatchObject({
      status: 'active',
      cancel_at_period_end: false,
      metadata: { stripe_last_event_created: 100 },
    });
    expect(deletedSubscription.canceled_at).toBeUndefined();
  });

  it('rejects unknown Stripe subscription statuses before mutating local state', () => {
    const subscription = createSubscription('starter', {
      status: 'active',
      metadata: { stripe_last_event_created: 100 },
    });

    expect(() =>
      applyStripeSubscriptionSnapshot(
        subscription,
        {
          status: 'paused',
          current_period_start: 1780272000,
          current_period_end: 1782863999,
          cancel_at_period_end: false,
          canceled_at: null,
          trial_start: null,
          trial_end: null,
        } as any,
        'customer.subscription.updated',
        101
      )
    ).toThrow('Stripe subscription status is not supported');

    expect(subscription).toMatchObject({
      status: 'active',
      current_period_start: new Date('2026-06-01T00:00:00.000Z'),
      current_period_end: new Date('2026-06-30T23:59:59.999Z'),
      metadata: { stripe_last_event_created: 100 },
    });
  });

  it('rejects malformed Stripe cancellation flags before mutating local state', () => {
    const subscription = createSubscription('starter', {
      status: 'active',
      cancel_at_period_end: false,
      current_period_start: new Date('2026-06-01T00:00:00.000Z'),
      current_period_end: new Date('2026-06-30T23:59:59.000Z'),
      metadata: { stripe_last_event_created: 100 },
    });

    expect(() =>
      applyStripeSubscriptionSnapshot(
        subscription,
        {
          status: 'past_due',
          current_period_start: 1780272000,
          current_period_end: 1782863999,
          cancel_at_period_end: 'false' as any,
          canceled_at: null,
          trial_start: null,
          trial_end: null,
        },
        'customer.subscription.updated',
        101
      )
    ).toThrow('Stripe subscription cancel_at_period_end must be a boolean');

    expect(subscription).toMatchObject({
      status: 'active',
      cancel_at_period_end: false,
      current_period_start: new Date('2026-06-01T00:00:00.000Z'),
      current_period_end: new Date('2026-06-30T23:59:59.000Z'),
      metadata: { stripe_last_event_created: 100 },
    });
  });

  it('rejects canceled Stripe snapshots missing terminal cancellation evidence before mutating local state', () => {
    const subscription = createSubscription('starter', {
      status: 'active',
      cancel_at_period_end: false,
      canceled_at: null,
      current_period_start: new Date('2026-06-01T00:00:00.000Z'),
      current_period_end: new Date('2026-06-30T23:59:59.000Z'),
      metadata: { stripe_last_event_created: 100 },
    });

    expect(() =>
      applyStripeSubscriptionSnapshot(
        subscription,
        {
          status: 'canceled',
          current_period_start: 1780272000,
          current_period_end: 1782863999,
          cancel_at_period_end: false,
          canceled_at: null,
          trial_start: null,
          trial_end: null,
        } as any,
        'customer.subscription.updated',
        101
      )
    ).toThrow('Stripe subscription canceled_at is required when status is canceled');

    expect(subscription).toMatchObject({
      status: 'active',
      cancel_at_period_end: false,
      canceled_at: null,
      current_period_start: new Date('2026-06-01T00:00:00.000Z'),
      current_period_end: new Date('2026-06-30T23:59:59.000Z'),
      metadata: { stripe_last_event_created: 100 },
    });
  });

  it('rejects canceled Stripe snapshots that still claim pending cancellation before mutating local state', () => {
    const subscription = createSubscription('starter', {
      status: 'active',
      cancel_at_period_end: false,
      canceled_at: null,
      current_period_start: new Date('2026-06-01T00:00:00.000Z'),
      current_period_end: new Date('2026-06-30T23:59:59.000Z'),
      metadata: { stripe_last_event_created: 100 },
    });

    expect(() =>
      applyStripeSubscriptionSnapshot(
        subscription,
        {
          status: 'canceled',
          current_period_start: 1780272000,
          current_period_end: 1782863999,
          cancel_at_period_end: true,
          canceled_at: 1780360000,
          trial_start: null,
          trial_end: null,
        } as any,
        'customer.subscription.updated',
        101
      )
    ).toThrow('Stripe canceled subscription cannot still be marked cancel_at_period_end');

    expect(subscription).toMatchObject({
      status: 'active',
      cancel_at_period_end: false,
      canceled_at: null,
      current_period_start: new Date('2026-06-01T00:00:00.000Z'),
      current_period_end: new Date('2026-06-30T23:59:59.000Z'),
      metadata: { stripe_last_event_created: 100 },
    });
  });

  it('rejects stale scheduled-cancellation timestamps from Stripe snapshots before mutating local state', () => {
    const subscription = createSubscription('starter', {
      status: 'active',
      cancel_at_period_end: false,
      canceled_at: null,
      current_period_start: new Date('2026-06-01T00:00:00.000Z'),
      current_period_end: new Date('2026-06-30T23:59:59.000Z'),
      metadata: { stripe_last_event_created: 100 },
    });

    expect(() =>
      applyStripeSubscriptionSnapshot(
        subscription,
        {
          status: 'active',
          current_period_start: 1780272000,
          current_period_end: 1782863999,
          cancel_at_period_end: true,
          canceled_at: 1780271999,
          trial_start: null,
          trial_end: null,
        } as any,
        'customer.subscription.updated',
        101
      )
    ).toThrow('Stripe scheduled subscription canceled_at must fall within current billing period');

    expect(subscription).toMatchObject({
      status: 'active',
      cancel_at_period_end: false,
      canceled_at: null,
      current_period_start: new Date('2026-06-01T00:00:00.000Z'),
      current_period_end: new Date('2026-06-30T23:59:59.000Z'),
      metadata: { stripe_last_event_created: 100 },
    });
  });

  it('rejects future-dated Stripe snapshot cancellation timestamps before mutating local state', () => {
    const scenarios = [
      {
        status: 'canceled',
        cancel_at_period_end: false,
      },
      {
        status: 'active',
        cancel_at_period_end: true,
      },
    ];

    for (const scenario of scenarios) {
      const subscription = createSubscription('starter', {
        status: 'active',
        cancel_at_period_end: false,
        canceled_at: null,
        current_period_start: new Date('2026-06-01T00:00:00.000Z'),
        current_period_end: new Date('2026-06-30T23:59:59.000Z'),
        metadata: { stripe_last_event_created: 100 },
      });

      expect(() =>
        applyStripeSubscriptionSnapshot(
          subscription,
          {
            status: scenario.status,
            current_period_start: 1780272000,
            current_period_end: 1782863999,
            cancel_at_period_end: scenario.cancel_at_period_end,
            canceled_at: 1780360001,
            trial_start: null,
            trial_end: null,
          } as any,
          'customer.subscription.updated',
          1780360000
        )
      ).toThrow('Stripe subscription canceled_at cannot be after event created timestamp');

      expect(subscription).toMatchObject({
        status: 'active',
        cancel_at_period_end: false,
        canceled_at: null,
        current_period_start: new Date('2026-06-01T00:00:00.000Z'),
        current_period_end: new Date('2026-06-30T23:59:59.000Z'),
        metadata: { stripe_last_event_created: 100 },
      });
    }
  });

  it('rejects malformed Stripe subscription period timestamps before mutating local state', () => {
    const subscription = createSubscription('starter', {
      status: 'active',
      current_period_start: new Date('2026-06-01T00:00:00.000Z'),
      current_period_end: new Date('2026-06-30T23:59:59.000Z'),
      metadata: { stripe_last_event_created: 100 },
    });

    expect(() =>
      applyStripeSubscriptionSnapshot(
        subscription,
        {
          status: 'past_due',
          cancel_at_period_end: false,
          canceled_at: null,
          trial_start: null,
          trial_end: null,
        } as any,
        'customer.subscription.updated',
        101
      )
    ).toThrow('Stripe subscription billing period is required when status is not canceled');

    expect(subscription).toMatchObject({
      status: 'active',
      current_period_start: new Date('2026-06-01T00:00:00.000Z'),
      current_period_end: new Date('2026-06-30T23:59:59.000Z'),
      metadata: { stripe_last_event_created: 100 },
    });

    expect(() =>
      applyStripeSubscriptionSnapshot(
        subscription,
        {
          status: 'past_due',
          current_period_start: 1782863999,
          current_period_end: 1780272000,
          cancel_at_period_end: false,
          canceled_at: null,
          trial_start: null,
          trial_end: null,
        } as any,
        'customer.subscription.updated',
        101
      )
    ).toThrow('Stripe subscription current_period_start cannot be after current_period_end');

    expect(subscription).toMatchObject({
      status: 'active',
      current_period_start: new Date('2026-06-01T00:00:00.000Z'),
      current_period_end: new Date('2026-06-30T23:59:59.000Z'),
      metadata: { stripe_last_event_created: 100 },
    });

    expect(() =>
      applyStripeSubscriptionSnapshot(
        subscription,
        {
          status: 'past_due',
          current_period_start: Number.MAX_SAFE_INTEGER,
          current_period_end: Number.MAX_SAFE_INTEGER,
          cancel_at_period_end: false,
          canceled_at: null,
          trial_start: null,
          trial_end: null,
        } as any,
        'customer.subscription.updated',
        101
      )
    ).toThrow('Stripe subscription current_period_start must be a representable Stripe timestamp');

    expect(subscription).toMatchObject({
      status: 'active',
      current_period_start: new Date('2026-06-01T00:00:00.000Z'),
      current_period_end: new Date('2026-06-30T23:59:59.000Z'),
      metadata: { stripe_last_event_created: 100 },
    });
  });

  it('rejects partial or inverted Stripe trial periods before mutating local state', () => {
    const subscription = createSubscription('starter', {
      status: 'active',
      trial_start: new Date('2026-06-01T00:00:00.000Z'),
      trial_end: new Date('2026-06-14T00:00:00.000Z'),
      metadata: { stripe_last_event_created: 100 },
    });

    expect(() =>
      applyStripeSubscriptionSnapshot(
        subscription,
        {
          status: 'trialing',
          current_period_start: 1780272000,
          current_period_end: 1782863999,
          cancel_at_period_end: false,
          canceled_at: null,
          trial_start: 1780272000,
          trial_end: null,
        } as any,
        'customer.subscription.updated',
        200
      )
    ).toThrow('Stripe subscription trial period must include both trial_start and trial_end');

    expect(subscription).toMatchObject({
      status: 'active',
      trial_start: new Date('2026-06-01T00:00:00.000Z'),
      trial_end: new Date('2026-06-14T00:00:00.000Z'),
      metadata: { stripe_last_event_created: 100 },
    });

    expect(() =>
      applyStripeSubscriptionSnapshot(
        subscription,
        {
          status: 'trialing',
          current_period_start: 1780272000,
          current_period_end: 1782863999,
          cancel_at_period_end: false,
          canceled_at: null,
          trial_start: 1782863999,
          trial_end: 1780272000,
        } as any,
        'customer.subscription.updated',
        200
      )
    ).toThrow('Stripe subscription trial_start cannot be after trial_end');

    expect(subscription).toMatchObject({
      status: 'active',
      trial_start: new Date('2026-06-01T00:00:00.000Z'),
      trial_end: new Date('2026-06-14T00:00:00.000Z'),
      metadata: { stripe_last_event_created: 100 },
    });
  });

  it('rejects trialing Stripe snapshots missing trial evidence before mutating local state', () => {
    const subscription = createSubscription('starter', {
      status: 'active',
      trial_start: null,
      trial_end: null,
      metadata: { stripe_last_event_created: 100 },
    });

    expect(() =>
      applyStripeSubscriptionSnapshot(
        subscription,
        {
          status: 'trialing',
          current_period_start: 1780272000,
          current_period_end: 1782863999,
          cancel_at_period_end: false,
          canceled_at: null,
          trial_start: null,
          trial_end: null,
        } as any,
        'customer.subscription.updated',
        200
      )
    ).toThrow('Stripe trialing subscription must include trial period');

    expect(subscription).toMatchObject({
      status: 'active',
      trial_start: null,
      trial_end: null,
      metadata: { stripe_last_event_created: 100 },
    });
  });

  it('rejects malformed Stripe event timestamps before lifecycle mutation', () => {
    const subscription = createSubscription('starter', {
      status: 'active',
      metadata: { stripe_last_event_created: 100 },
    });

    expect(() =>
      applyStripeSubscriptionDeleted(
        subscription,
        { canceled_at: null } as any,
        'customer.subscription.deleted',
        -1
      )
    ).toThrow('Stripe event created timestamp must be a non-negative integer Stripe timestamp');

    expect(subscription.status).toBe('active');
    expect(subscription.metadata).toEqual({ stripe_last_event_created: 100 });
    expect(subscription.canceled_at).toBeUndefined();

    expect(() =>
      applyStripeSubscriptionDeleted(
        subscription,
        { canceled_at: null } as any,
        'customer.subscription.deleted',
        Number.MAX_SAFE_INTEGER
      )
    ).toThrow('Stripe event created timestamp must be a representable Stripe timestamp');

    expect(subscription.status).toBe('active');
    expect(subscription.metadata).toEqual({ stripe_last_event_created: 100 });
    expect(subscription.canceled_at).toBeUndefined();
  });

  it('rejects Stripe snapshot identity mismatches before direct lifecycle mutation', () => {
    const cases = [
      {
        evidence: { customer: 'cus_elsewhere' },
        expectedError: 'Stripe subscription customer id must match persisted subscription stripe_customer_id',
      },
      {
        evidence: { metadata: { business_id: 'business-elsewhere' } },
        expectedError: 'Stripe subscription metadata business_id must match persisted subscription business_id',
      },
      {
        evidence: { metadata: { tier: 'pro' } },
        expectedError: 'Stripe subscription metadata tier must match persisted subscription tier',
      },
      {
        evidence: { metadata: { business_id: 'business-1', tier: 'starter', provider_trace_id: 'trace-123' } },
        expectedError: 'Stripe subscription metadata include unsupported field(s): provider_trace_id',
      },
    ];

    for (const { evidence, expectedError } of cases) {
      const subscription = createSubscription('starter', {
        stripe_customer_id: 'cus_123',
        status: 'active',
        cancel_at_period_end: false,
        current_period_start: new Date('2026-06-01T00:00:00.000Z'),
        current_period_end: new Date('2026-06-30T23:59:59.000Z'),
        metadata: { stripe_last_event_created: 100 },
      });

      expect(() =>
        applyStripeSubscriptionSnapshot(
          subscription,
          {
            status: 'past_due',
            current_period_start: 1780272000,
            current_period_end: 1782863999,
            cancel_at_period_end: false,
            canceled_at: null,
            trial_start: null,
            trial_end: null,
            ...evidence,
          } as any,
          'customer.subscription.updated',
          101
        )
      ).toThrow(expectedError);

      expect(subscription).toMatchObject({
        status: 'active',
        cancel_at_period_end: false,
        current_period_start: new Date('2026-06-01T00:00:00.000Z'),
        current_period_end: new Date('2026-06-30T23:59:59.000Z'),
        metadata: { stripe_last_event_created: 100 },
      });
    }
  });

  it('rejects Stripe deletion identity mismatches before direct cancellation mutation', () => {
    const cases = [
      {
        evidence: { customer: 'cus_elsewhere' },
        expectedError: 'Stripe subscription customer id must match persisted subscription stripe_customer_id',
      },
      {
        evidence: { metadata: { business_id: 'business-elsewhere' } },
        expectedError: 'Stripe subscription metadata business_id must match persisted subscription business_id',
      },
      {
        evidence: { metadata: { tier: 'pro' } },
        expectedError: 'Stripe subscription metadata tier must match persisted subscription tier',
      },
      {
        evidence: { metadata: { business_id: 'business-1', tier: 'starter', provider_trace_id: 'trace-123' } },
        expectedError: 'Stripe subscription metadata include unsupported field(s): provider_trace_id',
      },
    ];

    for (const { evidence, expectedError } of cases) {
      const subscription = createSubscription('starter', {
        stripe_customer_id: 'cus_123',
        status: 'active',
        cancel_at_period_end: false,
        canceled_at: null,
        metadata: { stripe_last_event_created: 100 },
      });

      expect(() =>
        applyStripeSubscriptionDeleted(
          subscription,
          {
            canceled_at: 1780360000,
            ...evidence,
          } as any,
          'customer.subscription.deleted',
          1780361111
        )
      ).toThrow(expectedError);

      expect(subscription).toMatchObject({
        status: 'active',
        cancel_at_period_end: false,
        canceled_at: null,
        metadata: { stripe_last_event_created: 100 },
      });
    }
  });

  it('uses Stripe deletion timestamps or the event timestamp for cancellation state', () => {
    const withStripeTimestamp = createSubscription('starter');
    expect(
      applyStripeSubscriptionDeleted(
        withStripeTimestamp,
        { canceled_at: 1780360000 } as any,
        'customer.subscription.deleted',
        1780361111
      )
    ).toEqual({ applied: true, reason: 'applied' });
    expect(withStripeTimestamp.status).toBe('canceled');
    expect(withStripeTimestamp.canceled_at).toEqual(new Date(1780360000 * 1000));

    const withEventTimestamp = createSubscription('starter');
    applyStripeSubscriptionDeleted(
      withEventTimestamp,
      { canceled_at: null } as any,
      'customer.subscription.deleted',
      1780361111
    );
    expect(withEventTimestamp.canceled_at).toEqual(new Date(1780361111 * 1000));
  });

  it('rejects future-dated Stripe deletion cancellation timestamps before mutating local state', () => {
    const subscription = createSubscription('starter', {
      status: 'active',
      cancel_at_period_end: false,
      canceled_at: null,
      trial_start: new Date('2026-06-01T00:00:00.000Z'),
      trial_end: new Date('2026-06-14T23:59:59.000Z'),
      metadata: { stripe_last_event_created: 100 },
    });

    expect(() =>
      applyStripeSubscriptionDeleted(
        subscription,
        { canceled_at: 1780361112 } as any,
        'customer.subscription.deleted',
        1780361111
      )
    ).toThrow('Stripe subscription canceled_at cannot be after event created timestamp');

    expect(subscription).toMatchObject({
      status: 'active',
      cancel_at_period_end: false,
      canceled_at: null,
      trial_start: new Date('2026-06-01T00:00:00.000Z'),
      trial_end: new Date('2026-06-14T23:59:59.000Z'),
      metadata: { stripe_last_event_created: 100 },
    });
  });

  it('clears stale local trial dates when Stripe deletion cancels a subscription', () => {
    const subscription = createSubscription('starter', {
      trial_start: new Date('2026-06-01T00:00:00.000Z'),
      trial_end: new Date('2026-06-14T23:59:59.000Z'),
      metadata: {
        stripe_last_event_created: 100,
        stripe_last_event_type: 'customer.subscription.trial_will_end',
        trial_will_end_subscription_id: 'sub_123',
        trial_will_end_at: '2026-06-14T23:59:59.000Z',
      },
    });

    const result = applyStripeSubscriptionDeleted(
      subscription,
      { canceled_at: null } as any,
      'customer.subscription.deleted',
      1780361111
    );

    expect(result).toEqual({ applied: true, reason: 'applied' });
    expect(subscription).toMatchObject({
      status: 'canceled',
      cancel_at_period_end: false,
      canceled_at: new Date(1780361111 * 1000),
      trial_start: null,
      trial_end: null,
      metadata: expect.objectContaining({
        stripe_last_event_type: 'customer.subscription.deleted',
        stripe_last_event_created: 1780361111,
      }),
    });
    expect(subscription.metadata).not.toHaveProperty('trial_will_end_subscription_id');
    expect(subscription.metadata).not.toHaveProperty('trial_will_end_at');
  });

  it('persists trial-ending webhook metadata and ignores stale repeats', async () => {
    const subscription = createSubscription('starter', {
      stripe_subscription_id: 'sub_123',
      status: 'trialing',
      trial_start: new Date('2026-05-18T00:00:00.000Z'),
      trial_end: new Date('2026-06-01T00:00:00.000Z'),
    });
    const subscriptionRepository = createRepository<any>([subscription]);
    const service = new SubscriptionService({
      requireStripe: false,
      enforceCapability: false,
      subscriptionRepository: subscriptionRepository as any,
      businessRepository: createRepository() as any,
      orderRepository: createRepository() as any,
    });

    await expect(
      service.handleSubscriptionWebhook({
        type: 'customer.subscription.trial_will_end',
        created: 1780000000,
        data: {
          object: {
            id: 'sub_123',
            trial_end: 1780272000,
          },
        },
      } as any)
    ).resolves.toEqual({ applied: true, reason: 'applied' });

    expect(subscriptionRepository.save).toHaveBeenCalledWith(expect.objectContaining({
      metadata: expect.objectContaining({
        stripe_last_event_type: 'customer.subscription.trial_will_end',
        stripe_last_event_created: 1780000000,
        trial_will_end_subscription_id: 'sub_123',
        trial_will_end_at: '2026-06-01T00:00:00.000Z',
      }),
    }));

    await expect(
      service.handleSubscriptionWebhook({
        type: 'customer.subscription.trial_will_end',
        created: 1779999999,
        data: { object: { id: 'sub_123', trial_end: 1780272000 } },
      } as any)
    ).resolves.toEqual({ applied: false, reason: 'stale_event' });
    expect(subscriptionRepository.save).toHaveBeenCalledTimes(1);
  });

  it('ignores same-second non-deletion webhook snapshots after terminal deletion', async () => {
    const subscription = createSubscription('starter', {
      stripe_subscription_id: 'sub_123',
      status: 'active',
      metadata: {
        stripe_last_event_created: 1780000000,
        stripe_last_event_type: 'customer.subscription.deleted',
      },
    });
    const subscriptionRepository = createRepository<any>([subscription]);
    const service = new SubscriptionService({
      requireStripe: false,
      enforceCapability: false,
      subscriptionRepository: subscriptionRepository as any,
      businessRepository: createRepository() as any,
      orderRepository: createRepository() as any,
    });

    await expect(
      service.handleSubscriptionWebhook({
        type: 'customer.subscription.updated',
        created: 1780000000,
        data: {
          object: {
            id: 'sub_123',
            status: 'active',
            current_period_start: 1780272000,
            current_period_end: 1782863999,
            cancel_at_period_end: false,
            canceled_at: null,
            trial_start: null,
            trial_end: null,
          },
        },
      } as any)
    ).resolves.toEqual({ applied: false, reason: 'stale_event' });

    expect(subscriptionRepository.save).not.toHaveBeenCalled();
    expect(subscription.status).toBe('active');
    expect(subscription.metadata).toEqual({
      stripe_last_event_created: 1780000000,
      stripe_last_event_type: 'customer.subscription.deleted',
    });
  });

  it('rejects trial-ending webhooks that do not match persisted local trial evidence', async () => {
    const scenarios = [
      {
        row: createSubscription('starter', {
          id: 'subscription-missing-trial-end',
          stripe_subscription_id: 'sub_missing_trial_end',
          status: 'active',
          trial_start: null,
          trial_end: null,
          metadata: { stripe_last_event_created: 100 },
        }),
        stripeSubscriptionId: 'sub_missing_trial_end',
        expectedError: 'persisted subscription trial_end is required before trial_will_end metadata',
      },
      {
        row: createSubscription('starter', {
          id: 'subscription-stale-trial-end',
          stripe_subscription_id: 'sub_stale_trial_end',
          status: 'trialing',
          trial_start: new Date('2026-05-18T00:00:00.000Z'),
          trial_end: new Date('2026-05-31T00:00:00.000Z'),
          metadata: { stripe_last_event_created: 100 },
        }),
        stripeSubscriptionId: 'sub_stale_trial_end',
        expectedError: 'Stripe subscription trial_end must match persisted trial_end before trial_will_end metadata',
      },
      {
        row: createSubscription('starter', {
          id: 'subscription-event-before-trial-start',
          stripe_subscription_id: 'sub_event_before_trial_start',
          status: 'trialing',
          trial_start: new Date('2026-05-29T00:00:00.000Z'),
          trial_end: new Date('2026-06-01T00:00:00.000Z'),
          metadata: { stripe_last_event_created: 100 },
        }),
        stripeSubscriptionId: 'sub_event_before_trial_start',
        expectedError: 'Stripe subscription trial_will_end event cannot be before persisted trial_start',
      },
      {
        row: createSubscription('starter', {
          id: 'subscription-event-after-trial-end',
          stripe_subscription_id: 'sub_event_after_trial_end',
          status: 'trialing',
          trial_start: new Date('2026-05-18T00:00:00.000Z'),
          trial_end: new Date('2026-06-01T00:00:00.000Z'),
          metadata: { stripe_last_event_created: 100 },
        }),
        stripeSubscriptionId: 'sub_event_after_trial_end',
        eventCreated: 1780272001,
        expectedError: 'Stripe subscription trial_will_end event cannot be after trial_end',
      },
    ];

    for (const scenario of scenarios) {
      const subscriptionRepository = createRepository<any>([scenario.row]);
      const service = new SubscriptionService({
        requireStripe: false,
        enforceCapability: false,
        subscriptionRepository: subscriptionRepository as any,
        businessRepository: createRepository() as any,
        orderRepository: createRepository() as any,
      });

      await expect(
        service.handleSubscriptionWebhook({
          type: 'customer.subscription.trial_will_end',
          created: scenario.eventCreated ?? 1780000000,
          data: {
            object: {
              id: scenario.stripeSubscriptionId,
              trial_end: 1780272000,
            },
          },
        } as any)
      ).rejects.toThrow(scenario.expectedError);

      expect(subscriptionRepository.save).not.toHaveBeenCalled();
      expect(scenario.row.metadata).toEqual({ stripe_last_event_created: 100 });
    }
  });
});
