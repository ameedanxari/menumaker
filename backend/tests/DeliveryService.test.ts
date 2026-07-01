import { describe, expect, it, jest } from '@jest/globals';
import { FeatureUnavailableError } from '../src/config/capabilities';
import {
  DeliveryService,
  SwiggyDeliveryService,
  applyDeliveryStatusUpdate,
  calculateDeliveryStats,
  canTransitionDeliveryStatus,
} from '../src/services/DeliveryService';

function createDeliveryRepository<T extends Record<string, any>>(rows: T[] = []) {
  return {
    rows,
    create: jest.fn((input: Partial<T>) => input as T),
    save: jest.fn(async (entity: T) => entity),
    findOne: jest.fn(async (options: { where: Record<string, any> }) => {
      const row = rows.find((candidate) =>
        Object.entries(options.where).every(([key, value]) => candidate[key] === value)
      );
      return row ?? null;
    }),
    find: jest.fn(async (options: { where: Record<string, any> }) =>
      rows.filter((candidate) =>
        Object.entries(options.where).every(([key, value]) => candidate[key] === value)
      )
    ),
    createQueryBuilder: jest.fn(() => ({
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getMany: jest.fn(async () => rows),
    })),
  };
}

describe('DeliveryService disabled-provider boundary', () => {
  it('fails partner adapters with FEATURE_UNAVAILABLE instead of returning stub success', async () => {
    await expect(new SwiggyDeliveryService().createDelivery({} as any, {} as any)).rejects.toMatchObject({
      code: 'FEATURE_UNAVAILABLE',
      capability: 'delivery_partner',
    } satisfies Partial<FeatureUnavailableError>);
  });

  it('does not write integration records while delivery partner capability is disabled', async () => {
    const integrationRepository = createDeliveryRepository();
    const service = new DeliveryService(undefined, {
      integrationRepository: integrationRepository as any,
      trackingRepository: createDeliveryRepository() as any,
      ratingRepository: createDeliveryRepository() as any,
      orderRepository: createDeliveryRepository() as any,
    });

    await expect(
      service.createIntegration('business-1', 'swiggy', { api_key: 'secret' })
    ).rejects.toMatchObject({
      code: 'FEATURE_UNAVAILABLE',
      capability: 'delivery_partner',
    });

    expect(integrationRepository.save).not.toHaveBeenCalled();
  });

  it('rejects invalid fixed delivery fees before replacing an existing integration', async () => {
    const existingIntegration = {
      id: 'integration-1',
      business_id: 'business-1',
      provider: 'swiggy',
      cost_handling: 'customer',
      is_active: true,
    };
    const integrationRepository = createDeliveryRepository<any>([existingIntegration]);
    const service = new DeliveryService(undefined, {
      integrationRepository: integrationRepository as any,
      trackingRepository: createDeliveryRepository() as any,
      ratingRepository: createDeliveryRepository() as any,
      orderRepository: createDeliveryRepository() as any,
    }, { enforceCapability: false });

    await expect(
      service.createIntegration('business-1', 'swiggy', {
        api_key: 'secret',
        fixed_delivery_fee_cents: 12.5,
      })
    ).rejects.toThrow('Fixed delivery fee must be an integer amount of cents');

    expect(existingIntegration.is_active).toBe(true);
    expect(integrationRepository.findOne).not.toHaveBeenCalled();
    expect(integrationRepository.create).not.toHaveBeenCalled();
    expect(integrationRepository.save).not.toHaveBeenCalled();
  });

  it('rejects malformed delivery integration option payloads before replacing an existing integration', async () => {
    const existingIntegration = {
      id: 'integration-1',
      business_id: 'business-1',
      provider: 'swiggy',
      cost_handling: 'customer',
      is_active: true,
    };
    const integrationRepository = createDeliveryRepository<any>([existingIntegration]);
    const service = new DeliveryService(undefined, {
      integrationRepository: integrationRepository as any,
      trackingRepository: createDeliveryRepository() as any,
      ratingRepository: createDeliveryRepository() as any,
      orderRepository: createDeliveryRepository() as any,
    }, { enforceCapability: false });

    await expect(
      service.createIntegration('business-1', 'swiggy', null as any)
    ).rejects.toThrow('Delivery integration options must be an object');

    await expect(
      service.createIntegration('business-1', 'swiggy', [] as any)
    ).rejects.toThrow('Delivery integration options must be an object');

    await expect(
      service.createIntegration('business-1', 'swiggy', {
        api_key: 'delivery-key',
        partner_account_id: 'partner-1',
        unsupported_launch_flag: true,
      } as any)
    ).rejects.toThrow(
      'Delivery integration options include unsupported field(s): unsupported_launch_flag'
    );

    await expect(
      service.createIntegration('business-1', 'swiggy', {
        api_key: 'delivery-key',
        partner_account_id: 'partner-1',
        ['unsupported_launch_flag\uFEFF']: true,
      } as any)
    ).rejects.toThrow(
      'Delivery integration options field names must not include unsafe control characters'
    );

    expect(existingIntegration.is_active).toBe(true);
    expect(integrationRepository.findOne).not.toHaveBeenCalled();
    expect(integrationRepository.create).not.toHaveBeenCalled();
    expect(integrationRepository.save).not.toHaveBeenCalled();
  });

  it('validates delivery partner credentials before replacing an existing integration', async () => {
    const existingIntegration = {
      id: 'integration-1',
      business_id: 'business-1',
      provider: 'swiggy',
      cost_handling: 'customer',
      is_active: true,
    };
    const integrationRepository = createDeliveryRepository<any>([existingIntegration]);
    const service = new DeliveryService(undefined, {
      integrationRepository: integrationRepository as any,
      trackingRepository: createDeliveryRepository() as any,
      ratingRepository: createDeliveryRepository() as any,
      orderRepository: createDeliveryRepository() as any,
    }, { enforceCapability: false });

    await expect(
      service.createIntegration('business-1', 'swiggy', {
        api_key: '   ',
        partner_account_id: 'partner-1',
      })
    ).rejects.toThrow('Delivery integration api_key must be a non-empty string');

    await expect(
      service.createIntegration('business-1', 'swiggy', {
        api_key: 'delivery-key',
        partner_account_id: '   ',
      })
    ).rejects.toThrow('Delivery integration partner_account_id must be a non-empty string');

    await expect(
      service.createIntegration('business-1', 'swiggy', {
        api_key: 'delivery-key',
        partner_account_id: 'partner-1',
        cost_handling: 'platform' as any,
      })
    ).rejects.toThrow('Delivery integration cost_handling must be customer or seller');

    await expect(
      service.createIntegration('business-1', 'shadowfleet' as any, {
        api_key: 'delivery-key',
        partner_account_id: 'partner-1',
      })
    ).rejects.toMatchObject({
      code: 'FEATURE_UNAVAILABLE',
      capability: 'delivery_partner',
    });

    expect(existingIntegration.is_active).toBe(true);
    expect(integrationRepository.findOne).not.toHaveBeenCalled();
    expect(integrationRepository.create).not.toHaveBeenCalled();
    expect(integrationRepository.save).not.toHaveBeenCalled();
  });

  it('normalizes validated delivery credentials before replacing an integration', async () => {
    const existingIntegration = {
      id: 'integration-1',
      business_id: 'business-1',
      provider: 'swiggy',
      cost_handling: 'customer',
      is_active: true,
    };
    const integrationRepository = createDeliveryRepository<any>([existingIntegration]);
    const service = new DeliveryService(undefined, {
      integrationRepository: integrationRepository as any,
      trackingRepository: createDeliveryRepository() as any,
      ratingRepository: createDeliveryRepository() as any,
      orderRepository: createDeliveryRepository() as any,
    }, { enforceCapability: false });

    const created = await service.createIntegration(' business-1 ', 'swiggy', {
      api_key: ' delivery-key ',
      api_secret: ' delivery-secret ',
      partner_account_id: ' partner-1 ',
      cost_handling: 'seller',
      fixed_delivery_fee_cents: 4500,
      auto_assign_delivery: false,
      pickup_instructions: ' Ring the bell ',
    });

    expect(existingIntegration.is_active).toBe(false);
    expect(created).toMatchObject({
      business_id: 'business-1',
      provider: 'swiggy',
      api_key: 'delivery-key',
      api_secret: 'delivery-secret',
      partner_account_id: 'partner-1',
      cost_handling: 'seller',
      fixed_delivery_fee_cents: 4500,
      auto_assign_delivery: false,
      pickup_instructions: 'Ring the bell',
      is_active: true,
    });
  });

  it('omits absent optional delivery integration fields before persistence', async () => {
    const integrationRepository = createDeliveryRepository<any>();
    const service = new DeliveryService(undefined, {
      integrationRepository: integrationRepository as any,
      trackingRepository: createDeliveryRepository() as any,
      ratingRepository: createDeliveryRepository() as any,
      orderRepository: createDeliveryRepository() as any,
    }, { enforceCapability: false });

    const created = await service.createIntegration('business-1', 'swiggy', {
      api_key: 'delivery-key',
      partner_account_id: 'partner-1',
    });

    expect(created).toMatchObject({
      business_id: 'business-1',
      provider: 'swiggy',
      api_key: 'delivery-key',
      partner_account_id: 'partner-1',
      cost_handling: 'customer',
      auto_assign_delivery: true,
      is_active: true,
    });
    expect(created).not.toHaveProperty('api_secret');
    expect(created).not.toHaveProperty('fixed_delivery_fee_cents');
    expect(created).not.toHaveProperty('pickup_instructions');
    expect(integrationRepository.create).toHaveBeenCalledWith(expect.not.objectContaining({
      api_secret: expect.anything(),
      fixed_delivery_fee_cents: expect.anything(),
      pickup_instructions: expect.anything(),
    }));
  });

  it('rejects corrupt existing delivery integration rows before replacement writes', async () => {
    const existingIntegration = {
      id: 'integration-elsewhere',
      business_id: 'business-elsewhere',
      provider: 'swiggy',
      cost_handling: 'customer',
      is_active: true,
    };
    const integrationRepository = createDeliveryRepository<any>([]);
    integrationRepository.findOne = jest.fn(async () => existingIntegration);
    const service = new DeliveryService(undefined, {
      integrationRepository: integrationRepository as any,
      trackingRepository: createDeliveryRepository() as any,
      ratingRepository: createDeliveryRepository() as any,
      orderRepository: createDeliveryRepository() as any,
    }, { enforceCapability: false });

    await expect(
      service.createIntegration('business-1', 'swiggy', {
        api_key: 'delivery-key',
        partner_account_id: 'partner-1',
      })
    ).rejects.toThrow('Persisted delivery integration business_id must match requested business');

    expect(integrationRepository.create).not.toHaveBeenCalled();
    expect(integrationRepository.save).not.toHaveBeenCalled();
    expect(existingIntegration.is_active).toBe(true);
  });

  it.each([
    ['localhost webhook URL', 'https://localhost/delivery-webhook'],
    ['loopback webhook URL', 'https://127.0.0.1/delivery-webhook'],
    ['link-local metadata webhook URL', 'https://169.254.169.254/latest/meta-data'],
    ['RFC1918 webhook URL', 'https://10.0.0.5/delivery-webhook'],
    ['IPv6 loopback webhook URL', 'https://[::1]/delivery-webhook'],
    ['IPv6 private webhook URL', 'https://[fc00::1]/delivery-webhook'],
    ['IPv6 link-local webhook URL', 'https://[fe80::1]/delivery-webhook'],
  ])('rejects persisted delivery integration %s before replacement writes', async (
    _caseName,
    webhookUrl
  ) => {
    const existingIntegration = {
      id: 'integration-1',
      business_id: 'business-1',
      provider: 'swiggy',
      cost_handling: 'customer',
      is_active: true,
      webhook_url: webhookUrl,
    };
    const integrationRepository = createDeliveryRepository<any>([]);
    integrationRepository.findOne = jest.fn(async () => existingIntegration);
    const service = new DeliveryService(undefined, {
      integrationRepository: integrationRepository as any,
      trackingRepository: createDeliveryRepository() as any,
      ratingRepository: createDeliveryRepository() as any,
      orderRepository: createDeliveryRepository() as any,
    }, { enforceCapability: false });

    await expect(
      service.createIntegration('business-1', 'swiggy', {
        api_key: 'delivery-key',
        partner_account_id: 'partner-1',
      })
    ).rejects.toThrow('Persisted delivery integration webhook_url must not point to private or internal hosts');

    expect(integrationRepository.create).not.toHaveBeenCalled();
    expect(integrationRepository.save).not.toHaveBeenCalled();
    expect(existingIntegration.is_active).toBe(true);
  });

  it.each([
    [
      'stale last_error with zero failure_count',
      { failure_count: 0, last_error: 'Previous provider outage' },
      'Persisted delivery integration last_error cannot be present when failure_count is zero',
    ],
    [
      'blank last_error with recorded failures',
      { failure_count: 2, last_error: '   ' },
      'Persisted delivery integration last_error must be a non-empty string',
    ],
    [
      'oversized last_error with recorded failures',
      { failure_count: 2, last_error: `provider-${'x'.repeat(1001)}` },
      'Persisted delivery integration last_error must be at most 1000 characters',
    ],
    [
      'string auto-assignment flag',
      { auto_assign_delivery: 'yes' },
      'Persisted delivery integration auto_assign_delivery must be a boolean',
    ],
    [
      'updated before created chronology',
      {
        created_at: new Date('2026-06-10T12:00:00.000Z'),
        updated_at: new Date('2026-06-10T11:59:59.000Z'),
      },
      'Persisted delivery integration updated_at cannot be before created_at',
    ],
    [
      'last delivery before integration creation chronology',
      {
        created_at: new Date('2026-06-10T12:00:00.000Z'),
        last_delivery_at: new Date('2026-06-10T11:59:59.000Z'),
      },
      'Persisted delivery integration last_delivery_at cannot be before created_at',
    ],
    [
      'updated before last delivery chronology',
      {
        created_at: new Date('2026-06-10T12:00:00.000Z'),
        last_delivery_at: new Date('2026-06-10T12:10:00.000Z'),
        updated_at: new Date('2026-06-10T12:09:59.999Z'),
      },
      'Persisted delivery integration updated_at cannot be before last_delivery_at',
    ],
  ])('rejects corrupt persisted delivery integration failure evidence before read-side rows: %s', async (
    _caseName,
    overrides,
    expectedMessage
  ) => {
    const integrationRow = {
      id: 'integration-1',
      business_id: 'business-1',
      provider: 'swiggy',
      cost_handling: 'customer',
      total_deliveries: 1,
      is_active: true,
      ...overrides,
    };
    const integrationRepository = createDeliveryRepository<any>([integrationRow]);
    const service = new DeliveryService(undefined, {
      integrationRepository: integrationRepository as any,
      trackingRepository: createDeliveryRepository() as any,
      ratingRepository: createDeliveryRepository() as any,
      orderRepository: createDeliveryRepository() as any,
    }, { enforceCapability: false });

    await expect(service.getIntegration('business-1')).rejects.toThrow(expectedMessage);

    expect(integrationRepository.save).not.toHaveBeenCalled();
  });

  it('rejects unsupported persisted delivery integration row fields before read-side trust', async () => {
    const integrationRow = {
      id: 'integration-1',
      business_id: 'business-1',
      provider: 'swiggy',
      cost_handling: 'customer',
      total_deliveries: 1,
      failure_count: 1,
      last_error: 'Previous provider outage',
      is_active: true,
      provider_trace_id: 'trace-1',
    };
    const integrationRepository = createDeliveryRepository<any>([integrationRow]);
    const service = new DeliveryService(undefined, {
      integrationRepository: integrationRepository as any,
      trackingRepository: createDeliveryRepository() as any,
      ratingRepository: createDeliveryRepository() as any,
      orderRepository: createDeliveryRepository() as any,
    }, { enforceCapability: false });

    await expect(service.getIntegration('business-1')).rejects.toThrow(
      'Persisted delivery integration include unsupported field(s): provider_trace_id'
    );

    expect(integrationRepository.save).not.toHaveBeenCalled();
  });

  it('rejects unsafe persisted delivery integration row field names before unsupported-field diagnostics', async () => {
    const integrationRow = {
      id: 'integration-1',
      business_id: 'business-1',
      provider: 'swiggy',
      cost_handling: 'customer',
      total_deliveries: 1,
      failure_count: 1,
      last_error: 'Previous provider outage',
      is_active: true,
      ['provider_trace_id\uFEFF']: 'trace-1',
    };
    const integrationRepository = createDeliveryRepository<any>([integrationRow]);
    const service = new DeliveryService(undefined, {
      integrationRepository: integrationRepository as any,
      trackingRepository: createDeliveryRepository() as any,
      ratingRepository: createDeliveryRepository() as any,
      orderRepository: createDeliveryRepository() as any,
    }, { enforceCapability: false });

    await expect(service.getIntegration('business-1')).rejects.toThrow(
      'Persisted delivery integration field names must not include unsafe control characters'
    );

    expect(integrationRepository.save).not.toHaveBeenCalled();
  });

  it('rejects malformed persisted delivery integration row envelopes before read-side trust', async () => {
    const integrationRepository = {
      ...createDeliveryRepository(),
      findOne: jest.fn(async () => [] as any),
    };
    const service = new DeliveryService(undefined, {
      integrationRepository: integrationRepository as any,
      trackingRepository: createDeliveryRepository() as any,
      ratingRepository: createDeliveryRepository() as any,
      orderRepository: createDeliveryRepository() as any,
    }, { enforceCapability: false });

    await expect(service.getIntegration('business-1')).rejects.toThrow(
      'Persisted delivery integration must be an object'
    );

    expect(integrationRepository.save).not.toHaveBeenCalled();
  });

  it.each([
    [
      'non-object settings',
      { settings: [] },
      'Persisted delivery integration settings must be an object',
    ],
    [
      'unsupported settings field',
      { settings: { service_type: 'express', provider_trace_id: 'trace-1' } },
      'Persisted delivery integration settings include unsupported field(s): provider_trace_id',
    ],
    [
      'unsafe settings field name',
      { settings: { service_type: 'express', ['provider_trace_id\uFEFF']: 'trace-1' } },
      'Persisted delivery integration settings field names must not include unsafe control characters',
    ],
    [
      'invalid service type',
      { settings: { service_type: 'same_hour' } },
      'Persisted delivery integration settings service_type must be standard, express, or scheduled',
    ],
    [
      'non-boolean packaging flag',
      { settings: { packaging_required: 'yes' } },
      'Persisted delivery integration settings packaging_required must be a boolean',
    ],
    [
      'non-boolean insurance flag',
      { settings: { insurance_enabled: 'yes' } },
      'Persisted delivery integration settings insurance_enabled must be a boolean',
    ],
  ])('rejects corrupt persisted delivery integration provider settings before read-side trust: %s', async (
    _caseName,
    overrides,
    expectedMessage
  ) => {
    const integrationRow = {
      id: 'integration-1',
      business_id: 'business-1',
      provider: 'swiggy',
      cost_handling: 'customer',
      total_deliveries: 1,
      failure_count: 1,
      last_error: 'Previous provider outage',
      is_active: true,
      ...overrides,
    };
    const integrationRepository = createDeliveryRepository<any>([integrationRow]);
    const service = new DeliveryService(undefined, {
      integrationRepository: integrationRepository as any,
      trackingRepository: createDeliveryRepository() as any,
      ratingRepository: createDeliveryRepository() as any,
      orderRepository: createDeliveryRepository() as any,
    }, { enforceCapability: false });

    await expect(service.getIntegration('business-1')).rejects.toThrow(expectedMessage);

    expect(integrationRepository.save).not.toHaveBeenCalled();
  });

  it('fails status, cancellation, and rating mutations before repository/provider side effects while disabled', async () => {
    const fakeProvider = {
      provider: 'swiggy' as const,
      createDelivery: jest.fn(),
      cancelDelivery: jest.fn(async () => ({ success: true })),
      getDeliveryStatus: jest.fn(),
    };
    const trackingRepository = createDeliveryRepository<any>([
      {
        id: 'tracking-1',
        order_id: 'order-1',
        provider: 'swiggy',
        delivery_partner_id: 'partner-1',
        delivery_integration: { id: 'integration-1' },
        status: 'delivered',
        status_history: [],
      },
    ]);
    const ratingRepository = createDeliveryRepository();
    const service = new DeliveryService(new Map([['swiggy', fakeProvider]]), {
      integrationRepository: createDeliveryRepository() as any,
      trackingRepository: trackingRepository as any,
      ratingRepository: ratingRepository as any,
      orderRepository: createDeliveryRepository() as any,
    });

    await expect(service.updateDeliveryStatus('tracking-1', 'cancelled')).rejects.toMatchObject({
      code: 'FEATURE_UNAVAILABLE',
      capability: 'delivery_partner',
    });
    await expect(service.cancelDelivery('tracking-1', 'customer request')).rejects.toMatchObject({
      code: 'FEATURE_UNAVAILABLE',
      capability: 'delivery_partner',
    });
    await expect(service.submitDeliveryRating('tracking-1', 'customer-1', { rating: 5 })).rejects.toMatchObject({
      code: 'FEATURE_UNAVAILABLE',
      capability: 'delivery_partner',
    });

    expect(fakeProvider.cancelDelivery).not.toHaveBeenCalled();
    expect(trackingRepository.save).not.toHaveBeenCalled();
    expect(ratingRepository.save).not.toHaveBeenCalled();
  });

  it('fails read operations before repository side effects while disabled', async () => {
    const integrationRepository = createDeliveryRepository();
    const trackingRepository = createDeliveryRepository();
    const ratingRepository = createDeliveryRepository();
    const service = new DeliveryService(undefined, {
      integrationRepository: integrationRepository as any,
      trackingRepository: trackingRepository as any,
      ratingRepository: ratingRepository as any,
      orderRepository: createDeliveryRepository() as any,
    });

    await expect(service.getIntegration('business-1')).rejects.toMatchObject({
      code: 'FEATURE_UNAVAILABLE',
      capability: 'delivery_partner',
    });
    await expect(service.getDeliveryTracking('order-1')).rejects.toMatchObject({
      code: 'FEATURE_UNAVAILABLE',
      capability: 'delivery_partner',
    });
    await expect(service.getDeliveryStats('business-1')).rejects.toMatchObject({
      code: 'FEATURE_UNAVAILABLE',
      capability: 'delivery_partner',
    });

    expect(integrationRepository.findOne).not.toHaveBeenCalled();
    expect(trackingRepository.findOne).not.toHaveBeenCalled();
    expect(trackingRepository.find).not.toHaveBeenCalled();
    expect(ratingRepository.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('rejects blank delivery boundary identifiers before repository/provider side effects', async () => {
    const fakeProvider = {
      provider: 'swiggy' as const,
      createDelivery: jest.fn(),
      cancelDelivery: jest.fn(async () => ({ success: true })),
      getDeliveryStatus: jest.fn(),
    };
    const integrationRepository = createDeliveryRepository<any>([
      { id: 'integration-1', business_id: 'business-1', is_active: true },
    ]);
    const trackingRepository = createDeliveryRepository<any>([
      {
        id: 'tracking-1',
        order_id: 'order-1',
        provider: 'swiggy',
        status: 'delivered',
        delivery_partner_id: 'partner-1',
        picked_up_at: new Date('2026-06-21T00:10:00.000Z'),
        delivered_at: new Date('2026-06-21T00:30:00.000Z'),
        status_history: [
          { status: ' delivered ', timestamp: new Date('2026-06-21T00:30:00.000Z') },
        ],
      },
    ]);
    const ratingRepository = createDeliveryRepository();
    const orderRepository = createDeliveryRepository<any>([
      { id: 'order-1', business_id: 'business-1' },
    ]);
    const service = new DeliveryService(new Map([['swiggy', fakeProvider]]), {
      integrationRepository: integrationRepository as any,
      trackingRepository: trackingRepository as any,
      ratingRepository: ratingRepository as any,
      orderRepository: orderRepository as any,
    }, { enforceCapability: false });

    await expect(service.getIntegration('   '))
      .rejects.toThrow('Delivery business_id must be a non-empty string');
    await expect(service.disconnectIntegration('   '))
      .rejects.toThrow('Delivery business_id must be a non-empty string');
    await expect(service.getDeliveryStats('   '))
      .rejects.toThrow('Delivery business_id must be a non-empty string');
    await expect(service.getDeliveryStats('\uFEFFbusiness-1'))
      .rejects.toThrow('Delivery business_id must not include unsafe control characters');
    await expect(service.createDelivery('   '))
      .rejects.toThrow('Delivery order_id must be a non-empty string');
    await expect(service.getDeliveryTracking('   '))
      .rejects.toThrow('Delivery order_id must be a non-empty string');
    await expect(service.updateDeliveryStatus('   ', 'assigned'))
      .rejects.toThrow('Delivery tracking_id must be a non-empty string');
    await expect(service.cancelDelivery('   ', 'customer request'))
      .rejects.toThrow('Delivery tracking_id must be a non-empty string');
    await expect(service.submitDeliveryRating('   ', 'customer-1', { rating: 5 }))
      .rejects.toThrow('Delivery tracking_id must be a non-empty string');
    await expect(service.submitDeliveryRating('tracking-1', '   ', { rating: 5 }))
      .rejects.toThrow('Delivery rating customer_id must be a non-empty string');

    expect(integrationRepository.findOne).not.toHaveBeenCalled();
    expect(integrationRepository.save).not.toHaveBeenCalled();
    expect(orderRepository.findOne).not.toHaveBeenCalled();
    expect(trackingRepository.findOne).not.toHaveBeenCalled();
    expect(trackingRepository.find).not.toHaveBeenCalled();
    expect(trackingRepository.create).not.toHaveBeenCalled();
    expect(trackingRepository.save).not.toHaveBeenCalled();
    expect(ratingRepository.findOne).not.toHaveBeenCalled();
    expect(ratingRepository.create).not.toHaveBeenCalled();
    expect(ratingRepository.save).not.toHaveBeenCalled();
    expect(ratingRepository.createQueryBuilder).not.toHaveBeenCalled();
    expect(fakeProvider.createDelivery).not.toHaveBeenCalled();
    expect(fakeProvider.cancelDelivery).not.toHaveBeenCalled();
  });

  it('normalizes delivery business identifiers before integration reads, disconnect writes, and stats queries', async () => {
    const integration = {
      id: 'integration-1',
      business_id: 'business-1',
      provider: 'swiggy',
      cost_handling: 'customer',
      is_active: true,
    };
    const integrationRepository = createDeliveryRepository<any>([integration]);
    const trackingRepository = createDeliveryRepository<any>([
      {
        id: 'tracking-1',
        delivery_integration_id: 'integration-1',
        order_id: 'order-1',
        provider: 'swiggy',
        status: ' delivered ',
        delivery_partner_id: 'partner-1',
        picked_up_at: new Date('2026-06-21T00:10:00.000Z'),
        delivered_at: new Date('2026-06-21T00:30:00.000Z'),
      },
    ]);
    const ratingRepository = createDeliveryRepository<any>([
      {
        id: 'rating-1',
        delivery_tracking_id: 'tracking-1',
        order_id: 'order-1',
        customer_id: 'customer-1',
        provider: 'swiggy',
        rating: 5,
      },
    ]);
    const service = new DeliveryService(undefined, {
      integrationRepository: integrationRepository as any,
      trackingRepository: trackingRepository as any,
      ratingRepository: ratingRepository as any,
      orderRepository: createDeliveryRepository() as any,
    }, { enforceCapability: false });

    await expect(service.getIntegration(' business-1 ')).resolves.toEqual(integration);
    await expect(service.getDeliveryStats(' business-1 ')).resolves.toMatchObject({
      total_deliveries: 1,
      successful_deliveries: 1,
      average_rating: 5,
      success_rate: 100,
    });
    await service.disconnectIntegration(' business-1 ');

    expect(integrationRepository.findOne).toHaveBeenNthCalledWith(1, {
      where: { business_id: 'business-1', is_active: true },
    });
    expect(integrationRepository.findOne).toHaveBeenNthCalledWith(2, {
      where: { business_id: 'business-1', is_active: true },
    });
    expect(integrationRepository.findOne).toHaveBeenNthCalledWith(3, {
      where: { business_id: 'business-1', is_active: true },
    });
    expect(integrationRepository.save).toHaveBeenCalledWith(expect.objectContaining({
      business_id: 'business-1',
      is_active: false,
    }));
    expect(trackingRepository.find).toHaveBeenCalledWith({
      where: { delivery_integration_id: 'integration-1' },
    });
  });

  it('does not expose delivery stats for disconnected delivery integrations', async () => {
    const integrationRepository = {
      findOne: jest.fn(async () => null),
    };
    const trackingRepository = createDeliveryRepository<any>([
      {
        id: 'tracking-stale-disconnected',
        delivery_integration_id: 'inactive-integration',
        order_id: 'order-stale',
        provider: 'swiggy',
        status: 'delivered',
        delivery_partner_id: 'partner-stale',
        picked_up_at: new Date('2026-06-21T00:10:00.000Z'),
        delivered_at: new Date('2026-06-21T00:30:00.000Z'),
      },
    ]);
    const ratingRepository = createDeliveryRepository<any>([
      {
        id: 'rating-stale-disconnected',
        delivery_tracking_id: 'tracking-stale-disconnected',
        order_id: 'order-stale',
        customer_id: 'customer-1',
        provider: 'swiggy',
        rating: 5,
      },
    ]);
    const service = new DeliveryService(undefined, {
      integrationRepository: integrationRepository as any,
      trackingRepository: trackingRepository as any,
      ratingRepository: ratingRepository as any,
      orderRepository: createDeliveryRepository() as any,
    }, { enforceCapability: false });

    await expect(service.getDeliveryStats(' business-1 ')).resolves.toEqual({
      total_deliveries: 0,
      successful_deliveries: 0,
      cancelled_deliveries: 0,
      failed_deliveries: 0,
      average_rating: 0,
      success_rate: 0,
    });

    expect(integrationRepository.findOne).toHaveBeenCalledWith({
      where: { business_id: 'business-1', is_active: true },
    });
    expect(trackingRepository.find).not.toHaveBeenCalled();
    expect(ratingRepository.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('rejects corrupt persisted delivery integrations before disconnect writes', async () => {
    const corruptIntegrationRow = {
      id: 'integration-elsewhere',
      business_id: 'business-elsewhere',
      provider: 'swiggy',
      cost_handling: 'customer',
      is_active: true,
    };
    const integrationRepository = createDeliveryRepository<any>([]);
    integrationRepository.findOne = jest.fn(async () => corruptIntegrationRow);
    const service = new DeliveryService(undefined, {
      integrationRepository: integrationRepository as any,
      trackingRepository: createDeliveryRepository() as any,
      ratingRepository: createDeliveryRepository() as any,
      orderRepository: createDeliveryRepository() as any,
    }, { enforceCapability: false });

    await expect(service.disconnectIntegration('business-1')).rejects.toThrow(
      'Persisted delivery integration business_id must match requested business'
    );

    expect(integrationRepository.save).not.toHaveBeenCalled();
  });

  it('rejects cross-business delivery stats integration rows before tracking or rating queries', async () => {
    const corruptIntegrationRow = {
      id: 'integration-elsewhere',
      business_id: 'business-elsewhere',
      provider: 'swiggy',
      cost_handling: 'customer',
      is_active: true,
    };
    const integrationRepository = createDeliveryRepository<any>([]);
    integrationRepository.findOne = jest.fn(async () => corruptIntegrationRow);
    const trackingRepository = createDeliveryRepository<any>([]);
    const ratingRepository = createDeliveryRepository<any>([]);
    const service = new DeliveryService(undefined, {
      integrationRepository: integrationRepository as any,
      trackingRepository: trackingRepository as any,
      ratingRepository: ratingRepository as any,
      orderRepository: createDeliveryRepository() as any,
    }, { enforceCapability: false });

    await expect(service.getDeliveryStats('business-1')).rejects.toThrow(
      'Persisted delivery integration business_id must match requested business'
    );

    expect(trackingRepository.find).not.toHaveBeenCalled();
    expect(ratingRepository.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('rejects stale persisted delivery providers before tracking creation or provider calls', async () => {
    const fakeProvider = {
      provider: 'swiggy' as const,
      createDelivery: jest.fn(),
      cancelDelivery: jest.fn(),
      getDeliveryStatus: jest.fn(),
    };
    const integrationRepository = createDeliveryRepository<any>([
      {
        id: 'integration-1',
        business_id: 'business-1',
        provider: 'shadowfleet',
        cost_handling: 'customer',
        is_active: true,
        total_deliveries: 0,
        failure_count: 0,
      },
    ]);
    const trackingRepository = createDeliveryRepository<any>([]);
    const service = new DeliveryService(new Map([['swiggy', fakeProvider]]), {
      integrationRepository: integrationRepository as any,
      trackingRepository: trackingRepository as any,
      ratingRepository: createDeliveryRepository() as any,
      orderRepository: createDeliveryRepository<any>([
        { id: 'order-1', business_id: 'business-1' },
      ]) as any,
    }, { enforceCapability: false });

    await expect(service.createDelivery('order-1')).rejects.toMatchObject({
      code: 'FEATURE_UNAVAILABLE',
      capability: 'delivery_partner',
      message: 'Persisted delivery provider is not approved for launch',
    });

    expect(trackingRepository.findOne).not.toHaveBeenCalled();
    expect(trackingRepository.create).not.toHaveBeenCalled();
    expect(trackingRepository.save).not.toHaveBeenCalled();
    expect(fakeProvider.createDelivery).not.toHaveBeenCalled();
    expect(integrationRepository.save).not.toHaveBeenCalled();
  });

  it('rejects cross-order delivery rows before integration lookup, tracking creation, or provider calls', async () => {
    const fakeProvider = {
      provider: 'swiggy' as const,
      createDelivery: jest.fn(),
      cancelDelivery: jest.fn(),
      getDeliveryStatus: jest.fn(),
    };
    const integrationRepository = createDeliveryRepository<any>([
      {
        id: 'integration-1',
        business_id: 'business-1',
        provider: 'swiggy',
        cost_handling: 'customer',
        is_active: true,
        total_deliveries: 0,
        failure_count: 0,
      },
    ]);
    const trackingRepository = createDeliveryRepository<any>([]);
    const orderRepository = createDeliveryRepository<any>([]);
    orderRepository.findOne = jest.fn(async () => ({
      id: 'order-elsewhere',
      business_id: 'business-1',
    }));
    const service = new DeliveryService(new Map([['swiggy', fakeProvider]]), {
      integrationRepository: integrationRepository as any,
      trackingRepository: trackingRepository as any,
      ratingRepository: createDeliveryRepository() as any,
      orderRepository: orderRepository as any,
    }, { enforceCapability: false });

    await expect(service.createDelivery('order-1')).rejects.toThrow(
      'Persisted delivery order id must match requested order'
    );

    expect(integrationRepository.findOne).not.toHaveBeenCalled();
    expect(trackingRepository.findOne).not.toHaveBeenCalled();
    expect(trackingRepository.create).not.toHaveBeenCalled();
    expect(trackingRepository.save).not.toHaveBeenCalled();
    expect(fakeProvider.createDelivery).not.toHaveBeenCalled();
    expect(integrationRepository.save).not.toHaveBeenCalled();
  });

  it('rejects corrupt persisted delivery cost handling before stats reads', async () => {
    const integrationRepository = createDeliveryRepository<any>([
      {
        id: 'integration-1',
        business_id: 'business-1',
        provider: 'swiggy',
        cost_handling: 'platform',
        is_active: true,
      },
    ]);
    const trackingRepository = createDeliveryRepository<any>([
      { id: 'tracking-1', delivery_integration_id: 'integration-1', status: 'delivered' },
    ]);
    const ratingRepository = createDeliveryRepository<any>([
      {
        id: 'rating-1',
        delivery_tracking_id: 'tracking-1',
        order_id: 'order-1',
        customer_id: 'customer-1',
        provider: 'swiggy',
        rating: 5,
      },
    ]);
    const service = new DeliveryService(undefined, {
      integrationRepository: integrationRepository as any,
      trackingRepository: trackingRepository as any,
      ratingRepository: ratingRepository as any,
      orderRepository: createDeliveryRepository() as any,
    }, { enforceCapability: false });

    await expect(service.getDeliveryStats('business-1')).rejects.toThrow(
      'Persisted delivery cost_handling must be customer or seller'
    );

    expect(trackingRepository.find).not.toHaveBeenCalled();
    expect(ratingRepository.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('rejects cross-integration delivery tracking rows before returning stats', async () => {
    const integrationRepository = createDeliveryRepository<any>([
      {
        id: 'integration-1',
        business_id: 'business-1',
        provider: 'swiggy',
        cost_handling: 'customer',
        is_active: true,
      },
    ]);
    const corruptTrackingRow = {
      id: 'tracking-1',
      delivery_integration_id: 'integration-2',
      provider: 'swiggy',
      status: 'delivered',
    };
    const trackingRepository = createDeliveryRepository<any>([]);
    trackingRepository.find = jest.fn(async () => [corruptTrackingRow]);
    const ratingRepository = createDeliveryRepository<any>([
      {
        id: 'rating-1',
        delivery_tracking_id: 'tracking-1',
        order_id: 'order-1',
        customer_id: 'customer-1',
        provider: 'swiggy',
        rating: 5,
      },
    ]);
    const service = new DeliveryService(undefined, {
      integrationRepository: integrationRepository as any,
      trackingRepository: trackingRepository as any,
      ratingRepository: ratingRepository as any,
      orderRepository: createDeliveryRepository() as any,
    }, { enforceCapability: false });

    await expect(service.getDeliveryStats('business-1')).rejects.toThrow(
      'Persisted delivery stats tracking row 1 delivery_integration_id must match requested integration'
    );

    expect(ratingRepository.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('rejects unsupported delivery tracking row fields before returning stats', async () => {
    const integrationRepository = createDeliveryRepository<any>([
      {
        id: 'integration-1',
        business_id: 'business-1',
        provider: 'swiggy',
        cost_handling: 'customer',
        is_active: true,
      },
    ]);
    const trackingRepository = createDeliveryRepository<any>([
      {
        id: 'tracking-1',
        delivery_integration_id: 'integration-1',
        order_id: 'order-1',
        provider: 'swiggy',
        status: 'delivered',
        delivered_at: new Date('2026-06-21T00:30:00.000Z'),
        picked_up_at: new Date('2026-06-21T00:10:00.000Z'),
        status_history: [
          { status: 'delivered', timestamp: new Date('2026-06-21T00:30:00.000Z') },
        ],
        provider_trace_id: 'trace-1',
      },
    ]);
    const ratingRepository = createDeliveryRepository<any>([]);
    const service = new DeliveryService(undefined, {
      integrationRepository: integrationRepository as any,
      trackingRepository: trackingRepository as any,
      ratingRepository: ratingRepository as any,
      orderRepository: createDeliveryRepository() as any,
    }, { enforceCapability: false });

    await expect(service.getDeliveryStats('business-1')).rejects.toThrow(
      'Persisted delivery tracking include unsupported field(s): provider_trace_id'
    );

    expect(ratingRepository.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('rejects unsafe delivery tracking row field names before returning stats', async () => {
    const integrationRepository = createDeliveryRepository<any>([
      {
        id: 'integration-1',
        business_id: 'business-1',
        provider: 'swiggy',
        cost_handling: 'customer',
        is_active: true,
      },
    ]);
    const trackingRepository = createDeliveryRepository<any>([
      {
        id: 'tracking-1',
        delivery_integration_id: 'integration-1',
        order_id: 'order-1',
        provider: 'swiggy',
        status: 'delivered',
        delivered_at: new Date('2026-06-21T00:30:00.000Z'),
        picked_up_at: new Date('2026-06-21T00:10:00.000Z'),
        status_history: [
          { status: 'delivered', timestamp: new Date('2026-06-21T00:30:00.000Z') },
        ],
        ['provider_trace_id\uFEFF']: 'trace-1',
      },
    ]);
    const ratingRepository = createDeliveryRepository<any>([]);
    const service = new DeliveryService(undefined, {
      integrationRepository: integrationRepository as any,
      trackingRepository: trackingRepository as any,
      ratingRepository: ratingRepository as any,
      orderRepository: createDeliveryRepository() as any,
    }, { enforceCapability: false });

    await expect(service.getDeliveryStats('business-1')).rejects.toThrow(
      'Persisted delivery tracking field names must not include unsafe control characters'
    );

    expect(ratingRepository.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('rejects malformed delivery tracking row envelopes before returning stats', async () => {
    const integrationRepository = createDeliveryRepository<any>([
      {
        id: 'integration-1',
        business_id: 'business-1',
        provider: 'swiggy',
        cost_handling: 'customer',
        is_active: true,
      },
    ]);
    const trackingRepository = createDeliveryRepository<any>([]);
    trackingRepository.find = jest.fn(async () => [[] as any]);
    const ratingRepository = createDeliveryRepository<any>([]);
    const service = new DeliveryService(undefined, {
      integrationRepository: integrationRepository as any,
      trackingRepository: trackingRepository as any,
      ratingRepository: ratingRepository as any,
      orderRepository: createDeliveryRepository() as any,
    }, { enforceCapability: false });

    await expect(service.getDeliveryStats('business-1')).rejects.toThrow(
      'Persisted delivery stats tracking row 1 must be an object'
    );

    expect(ratingRepository.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('rejects provider-mismatched delivery tracking rows before returning stats', async () => {
    const integrationRepository = createDeliveryRepository<any>([
      {
        id: 'integration-1',
        business_id: 'business-1',
        provider: 'swiggy',
        cost_handling: 'customer',
        is_active: true,
      },
    ]);
    const trackingRepository = createDeliveryRepository<any>([
      {
        id: 'tracking-1',
        delivery_integration_id: 'integration-1',
        provider: 'zomato',
        status: 'delivered',
      },
    ]);
    const service = new DeliveryService(undefined, {
      integrationRepository: integrationRepository as any,
      trackingRepository: trackingRepository as any,
      ratingRepository: createDeliveryRepository() as any,
      orderRepository: createDeliveryRepository() as any,
    }, { enforceCapability: false });

    await expect(service.getDeliveryStats('business-1')).rejects.toThrow(
      'Persisted delivery stats tracking row 1 provider must match requested integration'
    );
  });

  it('rejects malformed delivery tracking chronology before returning stats', async () => {
    const integrationRepository = createDeliveryRepository<any>([
      {
        id: 'integration-1',
        business_id: 'business-1',
        provider: 'swiggy',
        cost_handling: 'customer',
        is_active: true,
      },
    ]);
    const trackingRepository = createDeliveryRepository<any>([
      {
        id: 'tracking-1',
        delivery_integration_id: 'integration-1',
        order_id: 'order-1',
        provider: 'swiggy',
        status: 'delivered',
        delivery_partner_id: 'partner-1',
        picked_up_at: new Date('2026-06-21T00:30:00.000Z'),
        delivered_at: new Date('2026-06-21T00:10:00.000Z'),
      },
    ]);
    const service = new DeliveryService(undefined, {
      integrationRepository: integrationRepository as any,
      trackingRepository: trackingRepository as any,
      ratingRepository: createDeliveryRepository() as any,
      orderRepository: createDeliveryRepository() as any,
    }, { enforceCapability: false });

    await expect(service.getDeliveryStats('business-1')).rejects.toThrow(
      'Persisted delivery tracking delivered_at must not be before picked_up_at'
    );
  });

  it('rejects malformed delivery tracking row timestamps before returning stats', async () => {
    const cases = [
      {
        trackingOverride: { created_at: '2026-06-21T00:00:00.000Z' },
        expectedError: 'Persisted delivery tracking created_at must be a valid Date',
      },
      {
        trackingOverride: {
          created_at: new Date('2026-06-21T00:30:00.000Z'),
          updated_at: new Date('2026-06-21T00:29:59.000Z'),
        },
        expectedError: 'Persisted delivery tracking updated_at cannot be before created_at',
      },
      {
        trackingOverride: {
          created_at: new Date('2026-06-21T00:30:00.000Z'),
          estimated_pickup_at: new Date('2026-06-21T00:29:59.000Z'),
        },
        expectedError: 'Persisted delivery tracking estimated_pickup_at cannot be before created_at',
      },
      {
        trackingOverride: {
          status: 'picked_up',
          created_at: new Date('2026-06-21T00:30:00.000Z'),
          picked_up_at: new Date('2026-06-21T00:29:59.000Z'),
        },
        expectedError: 'Persisted delivery tracking picked_up_at cannot be before created_at',
      },
      {
        trackingOverride: {
          status: 'en_route',
          picked_up_at: new Date('2026-06-21T00:30:00.000Z'),
          delivered_at: new Date('2026-06-21T00:45:00.000Z'),
        },
        expectedError: 'Persisted delivery tracking delivered_at cannot be present before delivered status',
      },
      {
        trackingOverride: {
          created_at: new Date('2026-06-21T00:30:00.000Z'),
          status_history: [
            { status: 'assigned', timestamp: new Date('2026-06-21T00:29:59.000Z') },
          ],
        },
        expectedError: 'Persisted delivery tracking history row 1 timestamp cannot be before created_at',
      },
      {
        trackingOverride: {
          updated_at: new Date('2026-06-21T00:04:59.000Z'),
          status_history: [
            { status: 'assigned', timestamp: new Date('2026-06-21T00:05:00.000Z') },
          ],
        },
        expectedError: 'Persisted delivery tracking updated_at cannot be before latest status_history timestamp',
      },
    ];

    for (const { trackingOverride, expectedError } of cases) {
      const integrationRepository = createDeliveryRepository<any>([
        {
          id: 'integration-1',
          business_id: 'business-1',
          provider: 'swiggy',
          cost_handling: 'customer',
          is_active: true,
        },
      ]);
      const ratingRepository = createDeliveryRepository();
      const trackingRepository = createDeliveryRepository<any>([
        {
          id: 'tracking-1',
          delivery_integration_id: 'integration-1',
          order_id: 'order-1',
          provider: 'swiggy',
          status: 'assigned',
          delivery_partner_id: 'partner-1',
          ...trackingOverride,
        },
      ]);
      const service = new DeliveryService(undefined, {
        integrationRepository: integrationRepository as any,
        trackingRepository: trackingRepository as any,
        ratingRepository: ratingRepository as any,
        orderRepository: createDeliveryRepository() as any,
      }, { enforceCapability: false });

      await expect(service.getDeliveryStats('business-1')).rejects.toThrow(expectedError);
      expect(ratingRepository.createQueryBuilder).not.toHaveBeenCalled();
    }
  });

  it('rejects delivered delivery stats rows missing completion evidence', async () => {
    const integrationRepository = createDeliveryRepository<any>([
      {
        id: 'integration-1',
        business_id: 'business-1',
        provider: 'swiggy',
        cost_handling: 'customer',
        is_active: true,
      },
    ]);
    const trackingRepository = createDeliveryRepository<any>([
      {
        id: 'tracking-1',
        delivery_integration_id: 'integration-1',
        order_id: 'order-1',
        provider: 'swiggy',
        status: 'delivered',
        delivery_partner_id: 'partner-1',
      },
    ]);
    const service = new DeliveryService(undefined, {
      integrationRepository: integrationRepository as any,
      trackingRepository: trackingRepository as any,
      ratingRepository: createDeliveryRepository() as any,
      orderRepository: createDeliveryRepository() as any,
    }, { enforceCapability: false });

    await expect(service.getDeliveryStats('business-1')).rejects.toThrow(
      'Persisted delivery tracking delivered_at is required for delivered status'
    );
  });

  it('rejects cancelled delivery stats rows missing cancellation evidence', async () => {
    const integrationRepository = createDeliveryRepository<any>([
      {
        id: 'integration-1',
        business_id: 'business-1',
        provider: 'swiggy',
        cost_handling: 'customer',
        is_active: true,
      },
    ]);
    const trackingRepository = createDeliveryRepository<any>([
      {
        id: 'tracking-1',
        delivery_integration_id: 'integration-1',
        order_id: 'order-1',
        provider: 'swiggy',
        status: 'cancelled',
        delivery_partner_id: 'partner-1',
      },
    ]);
    const service = new DeliveryService(undefined, {
      integrationRepository: integrationRepository as any,
      trackingRepository: trackingRepository as any,
      ratingRepository: createDeliveryRepository() as any,
      orderRepository: createDeliveryRepository() as any,
    }, { enforceCapability: false });

    await expect(service.getDeliveryStats('business-1')).rejects.toThrow(
      'Persisted delivery tracking cancellation_reason is required for cancelled status'
    );
  });

  it('rejects non-cancelled delivery stats rows with stale cancellation evidence', async () => {
    const integrationRepository = createDeliveryRepository<any>([
      {
        id: 'integration-1',
        business_id: 'business-1',
        provider: 'swiggy',
        cost_handling: 'customer',
        is_active: true,
      },
    ]);
    const trackingRepository = createDeliveryRepository<any>([
      {
        id: 'tracking-1',
        delivery_integration_id: 'integration-1',
        order_id: 'order-1',
        provider: 'swiggy',
        status: 'assigned',
        delivery_partner_id: 'partner-1',
        cancellation_reason: 'customer cancelled previous attempt',
      },
    ]);
    const service = new DeliveryService(undefined, {
      integrationRepository: integrationRepository as any,
      trackingRepository: trackingRepository as any,
      ratingRepository: createDeliveryRepository() as any,
      orderRepository: createDeliveryRepository() as any,
    }, { enforceCapability: false });

    await expect(service.getDeliveryStats('business-1')).rejects.toThrow(
      'Persisted delivery tracking cancellation_reason cannot be present before cancelled status'
    );
  });

  it('rejects failed delivery stats rows missing failure evidence', async () => {
    const integrationRepository = createDeliveryRepository<any>([
      {
        id: 'integration-1',
        business_id: 'business-1',
        provider: 'swiggy',
        cost_handling: 'customer',
        is_active: true,
      },
    ]);
    const trackingRepository = createDeliveryRepository<any>([
      {
        id: 'tracking-1',
        delivery_integration_id: 'integration-1',
        order_id: 'order-1',
        provider: 'swiggy',
        status: 'failed',
      },
    ]);
    const service = new DeliveryService(undefined, {
      integrationRepository: integrationRepository as any,
      trackingRepository: trackingRepository as any,
      ratingRepository: createDeliveryRepository() as any,
      orderRepository: createDeliveryRepository() as any,
    }, { enforceCapability: false });

    await expect(service.getDeliveryStats('business-1')).rejects.toThrow(
      'Persisted delivery tracking error_message is required for failed status'
    );
  });

  it('rejects failed delivery stats rows missing attempt-count evidence', async () => {
    const integrationRepository = createDeliveryRepository<any>([
      {
        id: 'integration-1',
        business_id: 'business-1',
        provider: 'swiggy',
        cost_handling: 'customer',
        is_active: true,
      },
    ]);
    const trackingRepository = createDeliveryRepository<any>([
      {
        id: 'tracking-1',
        delivery_integration_id: 'integration-1',
        order_id: 'order-1',
        provider: 'swiggy',
        status: 'failed',
        error_message: 'Provider rejected delivery creation',
        attempt_count: 0,
      },
    ]);
    const service = new DeliveryService(undefined, {
      integrationRepository: integrationRepository as any,
      trackingRepository: trackingRepository as any,
      ratingRepository: createDeliveryRepository() as any,
      orderRepository: createDeliveryRepository() as any,
    }, { enforceCapability: false });

    await expect(service.getDeliveryStats('business-1')).rejects.toThrow(
      'Persisted delivery tracking attempt_count must be greater than zero for failed status'
    );
  });

  it('rejects non-failed delivery stats rows with stale failure evidence', async () => {
    const integrationRepository = createDeliveryRepository<any>([
      {
        id: 'integration-1',
        business_id: 'business-1',
        provider: 'swiggy',
        cost_handling: 'customer',
        is_active: true,
      },
    ]);
    const trackingRepository = createDeliveryRepository<any>([
      {
        id: 'tracking-1',
        delivery_integration_id: 'integration-1',
        order_id: 'order-1',
        provider: 'swiggy',
        status: 'assigned',
        delivery_partner_id: 'partner-1',
        error_message: 'Previous provider outage',
      },
    ]);
    const service = new DeliveryService(undefined, {
      integrationRepository: integrationRepository as any,
      trackingRepository: trackingRepository as any,
      ratingRepository: createDeliveryRepository() as any,
      orderRepository: createDeliveryRepository() as any,
    }, { enforceCapability: false });

    await expect(service.getDeliveryStats('business-1')).rejects.toThrow(
      'Persisted delivery tracking error_message cannot be present before failed status'
    );
  });

  it('rejects malformed delivery tracking history before returning stats', async () => {
    const integrationRepository = createDeliveryRepository<any>([
      {
        id: 'integration-1',
        business_id: 'business-1',
        provider: 'swiggy',
        cost_handling: 'customer',
        is_active: true,
      },
    ]);
    const trackingRepository = createDeliveryRepository<any>([
      {
        id: 'tracking-1',
        delivery_integration_id: 'integration-1',
        order_id: 'order-1',
        provider: 'swiggy',
        status: 'assigned',
        delivery_partner_id: 'partner-1',
        status_history: [
          { status: 'teleported', timestamp: new Date('2026-06-21T00:00:00.000Z') },
        ],
      },
    ]);
    const service = new DeliveryService(undefined, {
      integrationRepository: integrationRepository as any,
      trackingRepository: trackingRepository as any,
      ratingRepository: createDeliveryRepository() as any,
      orderRepository: createDeliveryRepository() as any,
    }, { enforceCapability: false });

    await expect(service.getDeliveryStats('business-1')).rejects.toThrow(
      'Persisted delivery tracking history row 1 status has an invalid status'
    );
  });

  it('rejects non-monotonic delivery tracking history before returning stats', async () => {
    const integrationRepository = createDeliveryRepository<any>([
      {
        id: 'integration-1',
        business_id: 'business-1',
        provider: 'swiggy',
        cost_handling: 'customer',
        is_active: true,
      },
    ]);
    const trackingRepository = createDeliveryRepository<any>([
      {
        id: 'tracking-1',
        delivery_integration_id: 'integration-1',
        order_id: 'order-1',
        provider: 'swiggy',
        status: 'picked_up',
        delivery_partner_id: 'partner-1',
        attempt_count: 1,
        picked_up_at: new Date('2026-06-21T00:05:00.000Z'),
        status_history: [
          { status: 'assigned', timestamp: new Date('2026-06-21T00:10:00.000Z') },
          { status: 'picked_up', timestamp: new Date('2026-06-21T00:05:00.000Z') },
        ],
      },
    ]);
    const service = new DeliveryService(undefined, {
      integrationRepository: integrationRepository as any,
      trackingRepository: trackingRepository as any,
      ratingRepository: createDeliveryRepository() as any,
      orderRepository: createDeliveryRepository() as any,
    }, { enforceCapability: false });

    await expect(service.getDeliveryStats('business-1')).rejects.toThrow(
      'Persisted delivery tracking history row 2 timestamp cannot be before previous history row'
    );
  });

  it('rejects delivery ratings outside requested tracking rows before returning stats', async () => {
    const integrationRepository = createDeliveryRepository<any>([
      {
        id: 'integration-1',
        business_id: 'business-1',
        provider: 'swiggy',
        cost_handling: 'customer',
        is_active: true,
      },
    ]);
    const trackingRepository = createDeliveryRepository<any>([
      {
        id: 'tracking-1',
        delivery_integration_id: 'integration-1',
        order_id: 'order-1',
        provider: 'swiggy',
        status: 'delivered',
        delivery_partner_id: 'partner-1',
        picked_up_at: new Date('2026-06-21T00:10:00.000Z'),
        delivered_at: new Date('2026-06-21T00:30:00.000Z'),
      },
    ]);
    const ratingRepository = createDeliveryRepository<any>([
      { id: 'rating-1', delivery_tracking_id: 'tracking-elsewhere', rating: 5 },
    ]);
    const service = new DeliveryService(undefined, {
      integrationRepository: integrationRepository as any,
      trackingRepository: trackingRepository as any,
      ratingRepository: ratingRepository as any,
      orderRepository: createDeliveryRepository() as any,
    }, { enforceCapability: false });

    await expect(service.getDeliveryStats('business-1')).rejects.toThrow(
      'Persisted delivery stats rating row 1 delivery_tracking_id must match a requested tracking row'
    );
  });

  it('rejects unsupported delivery rating row fields before returning stats', async () => {
    const integrationRepository = createDeliveryRepository<any>([
      {
        id: 'integration-1',
        business_id: 'business-1',
        provider: 'swiggy',
        cost_handling: 'customer',
        is_active: true,
      },
    ]);
    const trackingRepository = createDeliveryRepository<any>([
      {
        id: 'tracking-1',
        delivery_integration_id: 'integration-1',
        order_id: 'order-1',
        provider: 'swiggy',
        status: 'delivered',
        delivery_partner_id: 'partner-1',
        picked_up_at: new Date('2026-06-21T00:10:00.000Z'),
        delivered_at: new Date('2026-06-21T00:30:00.000Z'),
      },
    ]);
    const ratingRepository = createDeliveryRepository<any>([
      {
        id: 'rating-1',
        delivery_tracking_id: 'tracking-1',
        order_id: 'order-1',
        customer_id: 'customer-1',
        provider: 'swiggy',
        rating: 5,
        provider_trace_id: 'trace-1',
      },
    ]);
    const service = new DeliveryService(undefined, {
      integrationRepository: integrationRepository as any,
      trackingRepository: trackingRepository as any,
      ratingRepository: ratingRepository as any,
      orderRepository: createDeliveryRepository() as any,
    }, { enforceCapability: false });

    await expect(service.getDeliveryStats('business-1')).rejects.toThrow(
      'Persisted delivery stats rating row 1 include unsupported field(s): provider_trace_id'
    );
  });

  it('rejects unsafe delivery rating row field names before returning stats', async () => {
    const integrationRepository = createDeliveryRepository<any>([
      {
        id: 'integration-1',
        business_id: 'business-1',
        provider: 'swiggy',
        cost_handling: 'customer',
        is_active: true,
      },
    ]);
    const trackingRepository = createDeliveryRepository<any>([
      {
        id: 'tracking-1',
        delivery_integration_id: 'integration-1',
        order_id: 'order-1',
        provider: 'swiggy',
        status: 'delivered',
        delivery_partner_id: 'partner-1',
        picked_up_at: new Date('2026-06-21T00:10:00.000Z'),
        delivered_at: new Date('2026-06-21T00:30:00.000Z'),
      },
    ]);
    const ratingRepository = createDeliveryRepository<any>([
      {
        id: 'rating-1',
        delivery_tracking_id: 'tracking-1',
        order_id: 'order-1',
        customer_id: 'customer-1',
        provider: 'swiggy',
        rating: 5,
        ['provider_trace_id\uFEFF']: 'trace-1',
      },
    ]);
    const service = new DeliveryService(undefined, {
      integrationRepository: integrationRepository as any,
      trackingRepository: trackingRepository as any,
      ratingRepository: ratingRepository as any,
      orderRepository: createDeliveryRepository() as any,
    }, { enforceCapability: false });

    await expect(service.getDeliveryStats('business-1')).rejects.toThrow(
      'Persisted delivery stats rating row 1 field names must not include unsafe control characters'
    );
  });

  it('rejects malformed delivery rating row envelopes before returning stats', async () => {
    const integrationRepository = createDeliveryRepository<any>([
      {
        id: 'integration-1',
        business_id: 'business-1',
        provider: 'swiggy',
        cost_handling: 'customer',
        is_active: true,
      },
    ]);
    const trackingRepository = createDeliveryRepository<any>([
      {
        id: 'tracking-1',
        delivery_integration_id: 'integration-1',
        order_id: 'order-1',
        provider: 'swiggy',
        status: 'delivered',
        delivery_partner_id: 'partner-1',
        picked_up_at: new Date('2026-06-21T00:10:00.000Z'),
        delivered_at: new Date('2026-06-21T00:30:00.000Z'),
      },
    ]);
    const ratingRepository = createDeliveryRepository<any>([[] as any]);
    const service = new DeliveryService(undefined, {
      integrationRepository: integrationRepository as any,
      trackingRepository: trackingRepository as any,
      ratingRepository: ratingRepository as any,
      orderRepository: createDeliveryRepository() as any,
    }, { enforceCapability: false });

    await expect(service.getDeliveryStats('business-1')).rejects.toThrow(
      'Persisted delivery stats rating row 1 must be an object'
    );
  });

  it('rejects malformed delivery stats rating evidence before returning stats', async () => {
    const cases = [
      {
        ratingOverrides: { rating: undefined },
        expectedError: 'Persisted delivery stats rating row 1 must be between 1 and 5',
      },
      {
        ratingOverrides: { timeliness_rating: 6 },
        expectedError: 'Persisted delivery stats rating row 1 timeliness_rating must be between 1 and 5',
      },
      {
        ratingOverrides: { courtesy_rating: 0 },
        expectedError: 'Persisted delivery stats rating row 1 courtesy_rating must be between 1 and 5',
      },
      {
        ratingOverrides: { packaging_rating: 4.5 },
        expectedError: 'Persisted delivery stats rating row 1 packaging_rating must be between 1 and 5',
      },
      {
        ratingOverrides: { feedback: '   ' },
        expectedError: 'Persisted delivery stats rating row 1 feedback must be a non-empty string',
      },
      {
        ratingOverrides: { issues: 'cold food' },
        expectedError: 'Persisted delivery stats rating row 1 issues must be an array of strings',
      },
      {
        ratingOverrides: { issues: ['Late arrival', '   '] },
        expectedError: 'Persisted delivery stats rating row 1 issues item 2 must be a non-empty string',
      },
      {
        ratingOverrides: { created_at: new Date('2026-06-21T00:29:59.000Z') },
        expectedError: 'Persisted delivery stats rating row 1 created_at cannot be before delivered_at',
      },
    ];

    for (const { ratingOverrides, expectedError } of cases) {
      const integrationRepository = createDeliveryRepository<any>([
        {
          id: 'integration-1',
          business_id: 'business-1',
          provider: 'swiggy',
          cost_handling: 'customer',
          is_active: true,
        },
      ]);
      const trackingRepository = createDeliveryRepository<any>([
        {
          id: 'tracking-1',
          delivery_integration_id: 'integration-1',
          order_id: 'order-1',
          provider: 'swiggy',
          status: 'delivered',
          delivery_partner_id: 'partner-1',
          picked_up_at: new Date('2026-06-21T00:10:00.000Z'),
          delivered_at: new Date('2026-06-21T00:30:00.000Z'),
        },
      ]);
      const ratingRepository = createDeliveryRepository<any>([
        {
          id: 'rating-1',
          delivery_tracking_id: 'tracking-1',
          order_id: 'order-1',
          customer_id: 'customer-1',
          provider: 'swiggy',
          rating: 5,
          ...ratingOverrides,
        },
      ]);
      const service = new DeliveryService(undefined, {
        integrationRepository: integrationRepository as any,
        trackingRepository: trackingRepository as any,
        ratingRepository: ratingRepository as any,
        orderRepository: createDeliveryRepository() as any,
      }, { enforceCapability: false });

      await expect(service.getDeliveryStats('business-1')).rejects.toThrow(expectedError);
    }
  });

  it('rejects anonymous delivery rating rows before returning stats', async () => {
    const integrationRepository = createDeliveryRepository<any>([
      {
        id: 'integration-1',
        business_id: 'business-1',
        provider: 'swiggy',
        cost_handling: 'customer',
        is_active: true,
      },
    ]);
    const trackingRepository = createDeliveryRepository<any>([
      {
        id: 'tracking-1',
        delivery_integration_id: 'integration-1',
        order_id: 'order-1',
        provider: 'swiggy',
        status: 'delivered',
        delivery_partner_id: 'partner-1',
        picked_up_at: new Date('2026-06-21T00:10:00.000Z'),
        delivered_at: new Date('2026-06-21T00:30:00.000Z'),
      },
    ]);
    const ratingRepository = createDeliveryRepository<any>([
      {
        id: '   ',
        delivery_tracking_id: 'tracking-1',
        order_id: 'order-1',
        customer_id: 'customer-1',
        provider: 'swiggy',
        rating: 5,
      },
    ]);
    const service = new DeliveryService(undefined, {
      integrationRepository: integrationRepository as any,
      trackingRepository: trackingRepository as any,
      ratingRepository: ratingRepository as any,
      orderRepository: createDeliveryRepository() as any,
    }, { enforceCapability: false });

    await expect(service.getDeliveryStats('business-1')).rejects.toThrow(
      'Persisted delivery stats rating row 1 id must be a non-empty string'
    );
  });

  it('rejects provider-mismatched delivery ratings before returning stats', async () => {
    const integrationRepository = createDeliveryRepository<any>([
      {
        id: 'integration-1',
        business_id: 'business-1',
        provider: 'swiggy',
        cost_handling: 'customer',
        is_active: true,
      },
    ]);
    const trackingRepository = createDeliveryRepository<any>([
      {
        id: 'tracking-1',
        delivery_integration_id: 'integration-1',
        order_id: 'order-1',
        provider: 'swiggy',
        status: 'delivered',
        delivery_partner_id: 'partner-1',
        picked_up_at: new Date('2026-06-21T00:10:00.000Z'),
        delivered_at: new Date('2026-06-21T00:30:00.000Z'),
      },
    ]);
    const ratingRepository = createDeliveryRepository<any>([
      {
        id: 'rating-provider-mismatch',
        delivery_tracking_id: 'tracking-1',
        order_id: 'order-1',
        customer_id: 'customer-1',
        provider: 'zomato',
        rating: 5,
      },
    ]);
    const service = new DeliveryService(undefined, {
      integrationRepository: integrationRepository as any,
      trackingRepository: trackingRepository as any,
      ratingRepository: ratingRepository as any,
      orderRepository: createDeliveryRepository() as any,
    }, { enforceCapability: false });

    await expect(service.getDeliveryStats('business-1')).rejects.toThrow(
      'Persisted delivery stats rating row 1 provider must match requested tracking row'
    );
  });

  it('rejects order-mismatched delivery ratings before returning stats', async () => {
    const integrationRepository = createDeliveryRepository<any>([
      {
        id: 'integration-1',
        business_id: 'business-1',
        provider: 'swiggy',
        cost_handling: 'customer',
        is_active: true,
      },
    ]);
    const trackingRepository = createDeliveryRepository<any>([
      {
        id: 'tracking-1',
        delivery_integration_id: 'integration-1',
        order_id: 'order-1',
        provider: 'swiggy',
        status: 'delivered',
        delivery_partner_id: 'partner-1',
        picked_up_at: new Date('2026-06-21T00:10:00.000Z'),
        delivered_at: new Date('2026-06-21T00:30:00.000Z'),
      },
    ]);
    const ratingRepository = createDeliveryRepository<any>([
      {
        id: 'rating-order-mismatch',
        delivery_tracking_id: 'tracking-1',
        order_id: 'order-elsewhere',
        customer_id: 'customer-1',
        provider: 'swiggy',
        rating: 5,
      },
    ]);
    const service = new DeliveryService(undefined, {
      integrationRepository: integrationRepository as any,
      trackingRepository: trackingRepository as any,
      ratingRepository: ratingRepository as any,
      orderRepository: createDeliveryRepository() as any,
    }, { enforceCapability: false });

    await expect(service.getDeliveryStats('business-1')).rejects.toThrow(
      'Persisted delivery stats rating row 1 order_id must match requested tracking row'
    );
  });

  it('rejects ratings for non-delivered tracking rows before returning stats', async () => {
    const integrationRepository = createDeliveryRepository<any>([
      {
        id: 'integration-1',
        business_id: 'business-1',
        provider: 'swiggy',
        cost_handling: 'customer',
        is_active: true,
      },
    ]);
    const trackingRepository = createDeliveryRepository<any>([
      {
        id: 'tracking-1',
        delivery_integration_id: 'integration-1',
        order_id: 'order-1',
        provider: 'swiggy',
        status: 'assigned',
        delivery_partner_id: 'partner-1',
      },
    ]);
    const ratingRepository = createDeliveryRepository<any>([
      {
        id: 'rating-before-delivery',
        delivery_tracking_id: 'tracking-1',
        order_id: 'order-1',
        customer_id: 'customer-1',
        provider: 'swiggy',
        rating: 5,
      },
    ]);
    const service = new DeliveryService(undefined, {
      integrationRepository: integrationRepository as any,
      trackingRepository: trackingRepository as any,
      ratingRepository: ratingRepository as any,
      orderRepository: createDeliveryRepository() as any,
    }, { enforceCapability: false });

    await expect(service.getDeliveryStats('business-1')).rejects.toThrow(
      'Persisted delivery stats rating row 1 delivery_tracking_id must reference a delivered tracking row'
    );
  });

  it('rejects duplicate delivery stats ratings before averaging contaminated rows', async () => {
    const integrationRepository = createDeliveryRepository<any>([
      {
        id: 'integration-1',
        business_id: 'business-1',
        provider: 'swiggy',
        cost_handling: 'customer',
        is_active: true,
      },
    ]);
    const trackingRepository = createDeliveryRepository<any>([
      {
        id: 'tracking-1',
        delivery_integration_id: 'integration-1',
        order_id: 'order-1',
        provider: 'swiggy',
        status: 'delivered',
        delivery_partner_id: 'partner-1',
        picked_up_at: new Date('2026-06-21T00:10:00.000Z'),
        delivered_at: new Date('2026-06-21T00:30:00.000Z'),
      },
    ]);
    const ratingRepository = createDeliveryRepository<any>([
      {
        id: 'rating-1',
        delivery_tracking_id: 'tracking-1',
        order_id: 'order-1',
        customer_id: 'customer-1',
        provider: 'swiggy',
        rating: 5,
      },
      {
        id: 'rating-duplicate',
        delivery_tracking_id: 'tracking-1',
        order_id: 'order-1',
        customer_id: 'customer-1',
        provider: 'swiggy',
        rating: 1,
      },
    ]);
    const service = new DeliveryService(undefined, {
      integrationRepository: integrationRepository as any,
      trackingRepository: trackingRepository as any,
      ratingRepository: ratingRepository as any,
      orderRepository: createDeliveryRepository() as any,
    }, { enforceCapability: false });

    await expect(service.getDeliveryStats('business-1')).rejects.toThrow(
      'Persisted delivery stats rating row 2 delivery_tracking_id must be unique for stats aggregation'
    );
  });

  it('rejects duplicate delivery stats rating ids before averaging distinct tracking rows', async () => {
    const integrationRepository = createDeliveryRepository<any>([
      {
        id: 'integration-1',
        business_id: 'business-1',
        provider: 'swiggy',
        cost_handling: 'customer',
        is_active: true,
      },
    ]);
    const trackingRepository = createDeliveryRepository<any>([
      {
        id: 'tracking-1',
        delivery_integration_id: 'integration-1',
        order_id: 'order-1',
        provider: 'swiggy',
        status: 'delivered',
        delivery_partner_id: 'partner-1',
        picked_up_at: new Date('2026-06-21T00:10:00.000Z'),
        delivered_at: new Date('2026-06-21T00:30:00.000Z'),
      },
      {
        id: 'tracking-2',
        delivery_integration_id: 'integration-1',
        order_id: 'order-2',
        provider: 'swiggy',
        status: 'delivered',
        delivery_partner_id: 'partner-2',
        picked_up_at: new Date('2026-06-21T01:10:00.000Z'),
        delivered_at: new Date('2026-06-21T01:30:00.000Z'),
      },
    ]);
    const ratingRepository = createDeliveryRepository<any>([
      {
        id: 'rating-duplicate',
        delivery_tracking_id: 'tracking-1',
        order_id: 'order-1',
        customer_id: 'customer-1',
        provider: 'swiggy',
        rating: 5,
      },
      {
        id: 'rating-duplicate',
        delivery_tracking_id: 'tracking-2',
        order_id: 'order-2',
        customer_id: 'customer-2',
        provider: 'swiggy',
        rating: 1,
      },
    ]);
    const service = new DeliveryService(undefined, {
      integrationRepository: integrationRepository as any,
      trackingRepository: trackingRepository as any,
      ratingRepository: ratingRepository as any,
      orderRepository: createDeliveryRepository() as any,
    }, { enforceCapability: false });

    await expect(service.getDeliveryStats('business-1')).rejects.toThrow(
      'Persisted delivery stats rating row 2 id must be unique for stats aggregation'
    );
  });

  it('rejects duplicate delivery stats tracking order evidence before aggregation', async () => {
    const integrationRepository = createDeliveryRepository<any>([
      {
        id: 'integration-1',
        business_id: 'business-1',
        provider: 'swiggy',
        cost_handling: 'customer',
        is_active: true,
      },
    ]);
    const trackingRepository = createDeliveryRepository<any>([
      {
        id: 'tracking-1',
        delivery_integration_id: 'integration-1',
        order_id: 'order-1',
        provider: 'swiggy',
        status: 'delivered',
        delivery_partner_id: 'partner-1',
        picked_up_at: new Date('2026-06-21T00:10:00.000Z'),
        delivered_at: new Date('2026-06-21T00:30:00.000Z'),
      },
      {
        id: 'tracking-duplicate',
        delivery_integration_id: 'integration-1',
        order_id: 'order-1',
        provider: 'swiggy',
        status: 'failed',
        error_message: 'provider timeout',
      },
    ]);
    const service = new DeliveryService(undefined, {
      integrationRepository: integrationRepository as any,
      trackingRepository: trackingRepository as any,
      ratingRepository: createDeliveryRepository() as any,
      orderRepository: createDeliveryRepository() as any,
    }, { enforceCapability: false });

    await expect(service.getDeliveryStats('business-1')).rejects.toThrow(
      'Persisted delivery stats tracking row 2 order_id must be unique for stats aggregation'
    );
  });

  it('rejects duplicate delivery stats tracking row ids before aggregation evidence is overwritten', async () => {
    const integrationRepository = createDeliveryRepository<any>([
      {
        id: 'integration-1',
        business_id: 'business-1',
        provider: 'swiggy',
        cost_handling: 'customer',
        is_active: true,
      },
    ]);
    const trackingRepository = createDeliveryRepository<any>([
      {
        id: 'tracking-duplicate',
        delivery_integration_id: 'integration-1',
        order_id: 'order-1',
        provider: 'swiggy',
        status: 'delivered',
        delivery_partner_id: 'partner-1',
        picked_up_at: new Date('2026-06-21T00:10:00.000Z'),
        delivered_at: new Date('2026-06-21T00:30:00.000Z'),
      },
      {
        id: 'tracking-duplicate',
        delivery_integration_id: 'integration-1',
        order_id: 'order-2',
        provider: 'swiggy',
        status: 'failed',
        error_message: 'provider timeout',
        attempt_count: 1,
      },
    ]);
    const service = new DeliveryService(undefined, {
      integrationRepository: integrationRepository as any,
      trackingRepository: trackingRepository as any,
      ratingRepository: createDeliveryRepository() as any,
      orderRepository: createDeliveryRepository() as any,
    }, { enforceCapability: false });

    await expect(service.getDeliveryStats('business-1')).rejects.toThrow(
      'Persisted delivery stats tracking row 2 id must be unique for stats aggregation'
    );
  });

  it('normalizes delivery order ids before order lookup, duplicate checks, and tracking creation', async () => {
    const fakeProvider = {
      provider: 'swiggy' as const,
      createDelivery: jest.fn(async () => ({
        success: true,
        delivery_partner_id: 'partner-1',
      })),
      cancelDelivery: jest.fn(),
      getDeliveryStatus: jest.fn(),
    };
    const integrationRepository = createDeliveryRepository<any>([
      {
        id: 'integration-1',
        business_id: 'business-1',
        provider: 'swiggy',
        is_active: true,
        total_deliveries: 0,
        failure_count: 0,
      },
    ]);
    const trackingRepository = createDeliveryRepository<any>([]);
    const orderRepository = createDeliveryRepository<any>([
      { id: 'order-1', business_id: 'business-1' },
    ]);
    const service = new DeliveryService(new Map([['swiggy', fakeProvider]]), {
      integrationRepository: integrationRepository as any,
      trackingRepository: trackingRepository as any,
      ratingRepository: createDeliveryRepository() as any,
      orderRepository: orderRepository as any,
    }, { enforceCapability: false });

    const tracking = await service.createDelivery(' order-1 ');

    expect(tracking).toMatchObject({
      order_id: 'order-1',
      status: 'assigned',
      delivery_partner_id: 'partner-1',
    });
    expect(orderRepository.findOne).toHaveBeenCalledWith({
      where: { id: 'order-1' },
    });
    expect(trackingRepository.findOne).toHaveBeenCalledWith({
      where: { order_id: 'order-1' },
    });
    expect(trackingRepository.create).toHaveBeenCalledWith(expect.objectContaining({
      order_id: 'order-1',
    }));
    expect(fakeProvider.createDelivery).toHaveBeenCalledTimes(1);
  });

  it('rejects corrupt duplicate delivery tracking rows before the already-created shortcut', async () => {
    const fakeProvider = {
      provider: 'swiggy' as const,
      createDelivery: jest.fn(),
      cancelDelivery: jest.fn(),
      getDeliveryStatus: jest.fn(),
    };
    const integrationRepository = createDeliveryRepository<any>([
      {
        id: 'integration-1',
        business_id: 'business-1',
        provider: 'swiggy',
        is_active: true,
        total_deliveries: 0,
        failure_count: 0,
      },
    ]);
    const trackingRepository = createDeliveryRepository<any>([
      {
        id: 'tracking-corrupt-duplicate',
        delivery_integration_id: 'integration-1',
        order_id: 'order-elsewhere',
        provider: 'swiggy',
        status: 'assigned',
        delivery_partner_id: 'partner-1',
        attempt_count: 1,
      },
    ]);
    const orderRepository = createDeliveryRepository<any>([
      { id: 'order-1', business_id: 'business-1' },
    ]);
    trackingRepository.findOne = jest.fn(async () => trackingRepository.rows[0]);
    const service = new DeliveryService(new Map([['swiggy', fakeProvider]]), {
      integrationRepository: integrationRepository as any,
      trackingRepository: trackingRepository as any,
      ratingRepository: createDeliveryRepository() as any,
      orderRepository: orderRepository as any,
    }, { enforceCapability: false });

    await expect(service.createDelivery('order-1')).rejects.toThrow(
      'Persisted delivery tracking order_id must match requested order'
    );

    expect(trackingRepository.create).not.toHaveBeenCalled();
    expect(trackingRepository.save).not.toHaveBeenCalled();
    expect(fakeProvider.createDelivery).not.toHaveBeenCalled();
    expect(integrationRepository.save).not.toHaveBeenCalled();
  });

  it('normalizes delivery tracking and customer identifiers before tracking reads and rating persistence', async () => {
    const tracking = {
      id: 'tracking-1',
      delivery_integration_id: 'integration-1',
      order_id: 'order-1',
      provider: 'swiggy',
      status: 'delivered',
      delivery_partner_id: 'partner-1',
      attempt_count: 1,
      picked_up_at: new Date('2026-06-20T23:50:00.000Z'),
      delivered_at: new Date('2026-06-21T00:00:00.000Z'),
      order: { id: 'order-1', customer_id: 'customer-1' },
      status_history: [{ status: 'delivered', timestamp: new Date('2026-06-21T00:00:00.000Z') }],
    };
    const trackingRepository = createDeliveryRepository<any>([tracking]);
    const ratingRepository = createDeliveryRepository();
    const service = new DeliveryService(new Map(), {
      integrationRepository: createDeliveryRepository() as any,
      trackingRepository: trackingRepository as any,
      ratingRepository: ratingRepository as any,
      orderRepository: createDeliveryRepository() as any,
    }, { enforceCapability: false });

    await expect(service.getDeliveryTracking(' order-1 ')).resolves.toEqual(tracking);
    await expect(service.updateDeliveryStatus(' tracking-1 ', ' delivered ' as any)).resolves.toMatchObject({
      id: 'tracking-1',
      status: 'delivered',
    });
    const rating = await service.submitDeliveryRating(' tracking-1 ', ' customer-1 ', { rating: 5 });

    expect(trackingRepository.findOne).toHaveBeenNthCalledWith(1, {
      where: { order_id: 'order-1' },
      relations: ['delivery_integration'],
    });
    expect(trackingRepository.findOne).toHaveBeenNthCalledWith(2, {
      where: { id: 'tracking-1' },
    });
    expect(trackingRepository.findOne).toHaveBeenNthCalledWith(3, {
      where: { id: 'tracking-1' },
      relations: ['order'],
    });
    expect(ratingRepository.findOne).toHaveBeenCalledWith({
      where: { delivery_tracking_id: 'tracking-1' },
    });
    expect(ratingRepository.create).toHaveBeenCalledWith(expect.objectContaining({
      delivery_tracking_id: 'tracking-1',
      customer_id: 'customer-1',
    }));
    expect(rating).toMatchObject({
      delivery_tracking_id: 'tracking-1',
      customer_id: 'customer-1',
    });
    expect(tracking.status_history).toEqual([
      { status: 'delivered', timestamp: new Date('2026-06-21T00:00:00.000Z') },
    ]);
  });

  it('rejects corrupt persisted delivery tracking rows before returning read-side tracking data', async () => {
    const trackingRows = [
      {
        id: 'tracking-bad-status',
        delivery_integration_id: 'integration-1',
        order_id: 'order-bad-status',
        provider: 'swiggy',
        status: 'teleported',
        attempt_count: 1,
      },
      {
        id: 'tracking-bad-provider',
        delivery_integration_id: 'integration-1',
        order_id: 'order-bad-provider',
        provider: 'drone',
        status: 'assigned',
        attempt_count: 1,
      },
      {
        id: 'tracking-bad-date-order',
        delivery_integration_id: 'integration-1',
        order_id: 'order-bad-date-order',
        provider: 'swiggy',
        status: 'delivered',
        delivery_partner_id: 'partner-1',
        attempt_count: 1,
        picked_up_at: new Date('2026-06-21T00:30:00.000Z'),
        delivered_at: new Date('2026-06-21T00:10:00.000Z'),
      },
      {
        id: 'tracking-bad-estimated-date-order',
        delivery_integration_id: 'integration-1',
        order_id: 'order-bad-estimated-date-order',
        provider: 'swiggy',
        status: 'assigned',
        delivery_partner_id: 'partner-1',
        attempt_count: 1,
        estimated_pickup_at: new Date('2026-06-21T00:30:00.000Z'),
        estimated_delivery_at: new Date('2026-06-21T00:10:00.000Z'),
      },
      {
        id: 'tracking-pickup-before-created',
        delivery_integration_id: 'integration-1',
        order_id: 'order-pickup-before-created',
        provider: 'swiggy',
        status: 'picked_up',
        delivery_partner_id: 'partner-1',
        attempt_count: 1,
        created_at: new Date('2026-06-21T00:30:00.000Z'),
        picked_up_at: new Date('2026-06-21T00:29:59.000Z'),
      },
      {
        id: 'tracking-updated-before-pickup',
        delivery_integration_id: 'integration-1',
        order_id: 'order-updated-before-pickup',
        provider: 'swiggy',
        status: 'picked_up',
        delivery_partner_id: 'partner-1',
        attempt_count: 1,
        created_at: new Date('2026-06-21T00:00:00.000Z'),
        updated_at: new Date('2026-06-21T00:09:59.000Z'),
        picked_up_at: new Date('2026-06-21T00:10:00.000Z'),
      },
      {
        id: 'tracking-updated-before-delivery',
        delivery_integration_id: 'integration-1',
        order_id: 'order-updated-before-delivery',
        provider: 'swiggy',
        status: 'delivered',
        delivery_partner_id: 'partner-1',
        attempt_count: 1,
        created_at: new Date('2026-06-21T00:00:00.000Z'),
        updated_at: new Date('2026-06-21T00:29:59.000Z'),
        picked_up_at: new Date('2026-06-21T00:10:00.000Z'),
        delivered_at: new Date('2026-06-21T00:30:00.000Z'),
      },
      {
        id: 'tracking-history-before-created',
        delivery_integration_id: 'integration-1',
        order_id: 'order-history-before-created',
        provider: 'swiggy',
        status: 'assigned',
        delivery_partner_id: 'partner-1',
        attempt_count: 1,
        created_at: new Date('2026-06-21T00:30:00.000Z'),
        status_history: [
          { status: 'assigned', timestamp: new Date('2026-06-21T00:29:59.000Z') },
        ],
      },
      {
        id: 'tracking-bad-history',
        delivery_integration_id: 'integration-1',
        order_id: 'order-bad-history',
        provider: 'swiggy',
        status: 'assigned',
        delivery_partner_id: 'partner-1',
        attempt_count: 1,
        status_history: [{ status: 'teleported', timestamp: new Date('2026-06-21T00:00:00.000Z') }],
      },
      {
        id: 'tracking-unsupported-history-field',
        delivery_integration_id: 'integration-1',
        order_id: 'order-unsupported-history-field',
        provider: 'swiggy',
        status: 'assigned',
        delivery_partner_id: 'partner-1',
        attempt_count: 1,
        status_history: [
          {
            status: 'assigned',
            timestamp: new Date('2026-06-21T00:00:00.000Z'),
            provider_trace_id: 'trace-1',
          },
        ],
      },
      {
        id: 'tracking-unsafe-history-field-name',
        delivery_integration_id: 'integration-1',
        order_id: 'order-unsafe-history-field-name',
        provider: 'swiggy',
        status: 'assigned',
        delivery_partner_id: 'partner-1',
        attempt_count: 1,
        status_history: [
          {
            status: 'assigned',
            timestamp: new Date('2026-06-21T00:00:00.000Z'),
            ['provider_trace_id\uFEFF']: 'trace-1',
          },
        ],
      },
      {
        id: 'tracking-non-array-history',
        delivery_integration_id: 'integration-1',
        order_id: 'order-non-array-history',
        provider: 'swiggy',
        status: 'assigned',
        delivery_partner_id: 'partner-1',
        attempt_count: 1,
        status_history: { status: 'assigned', timestamp: new Date('2026-06-21T00:00:00.000Z') },
      },
      {
        id: 'tracking-stale-history-status',
        delivery_integration_id: 'integration-1',
        order_id: 'order-stale-history-status',
        provider: 'swiggy',
        status: 'delivered',
        delivery_partner_id: 'partner-1',
        picked_up_at: new Date('2026-06-21T00:10:00.000Z'),
        delivered_at: new Date('2026-06-21T00:30:00.000Z'),
        attempt_count: 1,
        status_history: [
          { status: 'assigned', timestamp: new Date('2026-06-21T00:00:00.000Z') },
          { status: 'en_route', timestamp: new Date('2026-06-21T00:15:00.000Z') },
        ],
      },
      {
        id: 'tracking-regressed-history-status',
        delivery_integration_id: 'integration-1',
        order_id: 'order-regressed-history-status',
        provider: 'swiggy',
        status: 'delivered',
        delivery_partner_id: 'partner-1',
        picked_up_at: new Date('2026-06-21T00:10:00.000Z'),
        delivered_at: new Date('2026-06-21T00:20:00.000Z'),
        attempt_count: 1,
        status_history: [
          { status: 'assigned', timestamp: new Date('2026-06-21T00:00:00.000Z') },
          { status: 'delivered', timestamp: new Date('2026-06-21T00:20:00.000Z') },
          { status: 'en_route', timestamp: new Date('2026-06-21T00:25:00.000Z') },
        ],
      },
      {
        id: 'tracking-duplicate-history-evidence',
        delivery_integration_id: 'integration-1',
        order_id: 'order-duplicate-history-evidence',
        provider: 'swiggy',
        status: 'assigned',
        delivery_partner_id: 'partner-1',
        attempt_count: 1,
        status_history: [
          { status: 'assigned', timestamp: new Date('2026-06-21T00:00:00.000Z') },
          { status: 'assigned', timestamp: new Date('2026-06-21T00:00:00.000Z') },
        ],
      },
      {
        id: 'tracking-history-before-pickup',
        delivery_integration_id: 'integration-1',
        order_id: 'order-history-before-pickup',
        provider: 'swiggy',
        status: 'picked_up',
        delivery_partner_id: 'partner-1',
        picked_up_at: new Date('2026-06-21T00:10:00.000Z'),
        attempt_count: 1,
        status_history: [
          { status: 'assigned', timestamp: new Date('2026-06-21T00:00:00.000Z') },
          { status: 'picked_up', timestamp: new Date('2026-06-21T00:09:59.000Z') },
        ],
      },
      {
        id: 'tracking-history-before-delivery',
        delivery_integration_id: 'integration-1',
        order_id: 'order-history-before-delivery',
        provider: 'swiggy',
        status: 'delivered',
        delivery_partner_id: 'partner-1',
        picked_up_at: new Date('2026-06-21T00:10:00.000Z'),
        delivered_at: new Date('2026-06-21T00:30:00.000Z'),
        attempt_count: 1,
        status_history: [
          { status: 'assigned', timestamp: new Date('2026-06-21T00:00:00.000Z') },
          { status: 'picked_up', timestamp: new Date('2026-06-21T00:10:00.000Z') },
          { status: 'delivered', timestamp: new Date('2026-06-21T00:29:59.000Z') },
        ],
      },
      {
        id: 'tracking-delivered-missing-completion',
        delivery_integration_id: 'integration-1',
        order_id: 'order-delivered-missing-completion',
        provider: 'swiggy',
        status: 'delivered',
        delivery_partner_id: 'partner-1',
        attempt_count: 1,
      },
      {
        id: 'tracking-en-route-missing-pickup',
        delivery_integration_id: 'integration-1',
        order_id: 'order-en-route-missing-pickup',
        provider: 'swiggy',
        status: 'en_route',
        delivery_partner_id: 'partner-1',
        attempt_count: 1,
      },
      {
        id: 'tracking-assigned-stale-pickup',
        delivery_integration_id: 'integration-1',
        order_id: 'order-assigned-stale-pickup',
        provider: 'swiggy',
        status: 'assigned',
        delivery_partner_id: 'partner-1',
        picked_up_at: new Date('2026-06-21T00:10:00.000Z'),
        attempt_count: 1,
      },
      {
        id: 'tracking-cancelled-missing-reason',
        delivery_integration_id: 'integration-1',
        order_id: 'order-cancelled-missing-reason',
        provider: 'swiggy',
        status: 'cancelled',
        delivery_partner_id: 'partner-1',
        attempt_count: 1,
      },
      {
        id: 'tracking-assigned-missing-provider-id',
        delivery_integration_id: 'integration-1',
        order_id: 'order-assigned-missing-provider-id',
        provider: 'swiggy',
        status: 'assigned',
        attempt_count: 1,
      },
      {
        id: 'tracking-assigned-stale-cancellation',
        delivery_integration_id: 'integration-1',
        order_id: 'order-assigned-stale-cancellation',
        provider: 'swiggy',
        status: 'assigned',
        delivery_partner_id: 'partner-1',
        cancellation_reason: 'customer cancelled previous attempt',
        attempt_count: 1,
      },
      {
        id: 'tracking-failed-missing-error',
        delivery_integration_id: 'integration-1',
        order_id: 'order-failed-missing-error',
        provider: 'swiggy',
        status: 'failed',
        attempt_count: 1,
      },
      {
        id: 'tracking-failed-oversized-error',
        delivery_integration_id: 'integration-1',
        order_id: 'order-failed-oversized-error',
        provider: 'swiggy',
        status: 'failed',
        error_message: `provider-${'x'.repeat(1001)}`,
        attempt_count: 1,
      },
      {
        id: 'tracking-assigned-stale-error',
        delivery_integration_id: 'integration-1',
        order_id: 'order-assigned-stale-error',
        provider: 'swiggy',
        status: 'assigned',
        delivery_partner_id: 'partner-1',
        error_message: 'Previous provider outage',
        attempt_count: 1,
      },
      {
        id: 'tracking-bad-relation',
        delivery_integration_id: 'integration-1',
        order_id: 'order-bad-relation',
        provider: 'swiggy',
        status: 'assigned',
        delivery_partner_id: 'partner-1',
        attempt_count: 1,
        delivery_integration: {
          id: 'integration-2',
          business_id: 'business-1',
          provider: 'swiggy',
          cost_handling: 'customer',
          fixed_delivery_fee_cents: 0,
        },
      },
      {
        id: 'tracking-bad-integration-active-flag',
        delivery_integration_id: 'integration-1',
        order_id: 'order-bad-integration-active-flag',
        provider: 'swiggy',
        status: 'assigned',
        delivery_partner_id: 'partner-1',
        attempt_count: 1,
        delivery_integration: {
          id: 'integration-1',
          business_id: 'business-1',
          provider: 'swiggy',
          cost_handling: 'customer',
          is_active: 'yes',
          fixed_delivery_fee_cents: 0,
        },
      },
      {
        id: 'tracking-missing-integration-business',
        delivery_integration_id: 'integration-1',
        order_id: 'order-missing-integration-business',
        provider: 'swiggy',
        status: 'assigned',
        delivery_partner_id: 'partner-1',
        attempt_count: 1,
        delivery_integration: {
          id: 'integration-1',
          provider: 'swiggy',
          cost_handling: 'customer',
          fixed_delivery_fee_cents: 0,
        },
      },
    ];
    const trackingRepository = createDeliveryRepository<any>(trackingRows);
    const service = new DeliveryService(new Map(), {
      integrationRepository: createDeliveryRepository() as any,
      trackingRepository: trackingRepository as any,
      ratingRepository: createDeliveryRepository() as any,
      orderRepository: createDeliveryRepository() as any,
    }, { enforceCapability: false });

    await expect(service.getDeliveryTracking('order-bad-status'))
      .rejects.toThrow('Persisted delivery tracking status has an invalid status');
    await expect(service.getDeliveryTracking('order-bad-provider'))
      .rejects.toMatchObject({
        code: 'FEATURE_UNAVAILABLE',
        capability: 'delivery_partner',
        message: 'Persisted delivery tracking provider is not approved for launch',
      });
    await expect(service.getDeliveryTracking('order-bad-date-order'))
      .rejects.toThrow('Persisted delivery tracking delivered_at must not be before picked_up_at');
    await expect(service.getDeliveryTracking('order-bad-estimated-date-order'))
      .rejects.toThrow('Persisted delivery tracking estimated_delivery_at must not be before estimated_pickup_at');
    await expect(service.getDeliveryTracking('order-pickup-before-created'))
      .rejects.toThrow('Persisted delivery tracking picked_up_at cannot be before created_at');
    await expect(service.getDeliveryTracking('order-updated-before-pickup'))
      .rejects.toThrow('Persisted delivery tracking updated_at cannot be before picked_up_at');
    await expect(service.getDeliveryTracking('order-updated-before-delivery'))
      .rejects.toThrow('Persisted delivery tracking updated_at cannot be before delivered_at');
    await expect(service.getDeliveryTracking('order-history-before-created'))
      .rejects.toThrow('Persisted delivery tracking history row 1 timestamp cannot be before created_at');
    await expect(service.getDeliveryTracking('order-bad-history'))
      .rejects.toThrow('Persisted delivery tracking history row 1 status has an invalid status');
    await expect(service.getDeliveryTracking('order-unsupported-history-field'))
      .rejects.toThrow(
        'Persisted delivery tracking history row 1 include unsupported field(s): provider_trace_id'
      );
    await expect(service.getDeliveryTracking('order-unsafe-history-field-name'))
      .rejects.toThrow(
        'Persisted delivery tracking history row 1 field names must not include unsafe control characters'
      );
    await expect(service.getDeliveryTracking('order-non-array-history'))
      .rejects.toThrow('Persisted delivery tracking status_history must be an array');
    await expect(service.getDeliveryTracking('order-stale-history-status'))
      .rejects.toThrow('Persisted delivery tracking status_history last row must match current status');
    await expect(service.getDeliveryTracking('order-regressed-history-status'))
      .rejects.toThrow('Persisted delivery tracking history row 3 status cannot transition from delivered to en_route');
    await expect(service.getDeliveryTracking('order-duplicate-history-evidence'))
      .rejects.toThrow('Persisted delivery tracking history row 2 status/timestamp evidence must be unique');
    await expect(service.getDeliveryTracking('order-history-before-pickup'))
      .rejects.toThrow('Persisted delivery tracking history row 2 timestamp cannot be before picked_up_at evidence');
    await expect(service.getDeliveryTracking('order-history-before-delivery'))
      .rejects.toThrow('Persisted delivery tracking history row 3 timestamp cannot be before delivered_at evidence');
    await expect(service.getDeliveryTracking('order-delivered-missing-completion'))
      .rejects.toThrow('Persisted delivery tracking delivered_at is required for delivered status');
    await expect(service.getDeliveryTracking('order-en-route-missing-pickup'))
      .rejects.toThrow('Persisted delivery tracking picked_up_at is required once delivery is picked up');
    await expect(service.getDeliveryTracking('order-assigned-stale-pickup'))
      .rejects.toThrow('Persisted delivery tracking picked_up_at cannot be present before picked_up status');
    await expect(service.getDeliveryTracking('order-cancelled-missing-reason'))
      .rejects.toThrow('Persisted delivery tracking cancellation_reason is required for cancelled status');
    await expect(service.getDeliveryTracking('order-assigned-missing-provider-id'))
      .rejects.toThrow('Persisted delivery tracking delivery_partner_id is required once delivery is assigned');
    await expect(service.getDeliveryTracking('order-assigned-stale-cancellation'))
      .rejects.toThrow('Persisted delivery tracking cancellation_reason cannot be present before cancelled status');
    await expect(service.getDeliveryTracking('order-failed-missing-error'))
      .rejects.toThrow('Persisted delivery tracking error_message is required for failed status');
    await expect(service.getDeliveryTracking('order-failed-oversized-error'))
      .rejects.toThrow('Persisted delivery tracking error_message must be at most 1000 characters');
    await expect(service.getDeliveryTracking('order-assigned-stale-error'))
      .rejects.toThrow('Persisted delivery tracking error_message cannot be present before failed status');
    await expect(service.getDeliveryTracking('order-bad-relation'))
      .rejects.toThrow('Persisted delivery integration relation id must match tracking integration');
    await expect(service.getDeliveryTracking('order-bad-integration-active-flag'))
      .rejects.toThrow('Persisted delivery integration is_active must be a boolean');
    await expect(service.getDeliveryTracking('order-missing-integration-business'))
      .rejects.toThrow('Persisted delivery integration relation business_id must be a non-empty string');
  });

  it('rejects malformed persisted delivery tracking row envelopes before returning read-side tracking data', async () => {
    const trackingRepository = {
      ...createDeliveryRepository(),
      findOne: jest.fn(async () => [] as any),
    };
    const service = new DeliveryService(new Map(), {
      integrationRepository: createDeliveryRepository() as any,
      trackingRepository: trackingRepository as any,
      ratingRepository: createDeliveryRepository() as any,
      orderRepository: createDeliveryRepository() as any,
    }, { enforceCapability: false });

    await expect(service.getDeliveryTracking('order-1')).rejects.toThrow(
      'Persisted delivery tracking must be an object'
    );
  });

  it('rejects tracking id mismatches before saving status updates', async () => {
    const corruptTrackingRow = {
      id: 'tracking-elsewhere',
      delivery_integration_id: 'integration-1',
      order_id: 'order-1',
      provider: 'swiggy',
      status: 'assigned',
      attempt_count: 1,
    };
    const trackingRepository = createDeliveryRepository<any>([]);
    trackingRepository.findOne = jest.fn(async () => corruptTrackingRow);
    const service = new DeliveryService(new Map(), {
      integrationRepository: createDeliveryRepository() as any,
      trackingRepository: trackingRepository as any,
      ratingRepository: createDeliveryRepository() as any,
      orderRepository: createDeliveryRepository() as any,
    }, { enforceCapability: false });

    await expect(service.updateDeliveryStatus('tracking-1', 'picked_up'))
      .rejects.toThrow('Persisted delivery tracking id must match requested tracking');

    expect(trackingRepository.save).not.toHaveBeenCalled();
  });

  it('rejects mismatched cancellation integration relations before provider calls', async () => {
    const fakeProvider = {
      provider: 'swiggy' as const,
      createDelivery: jest.fn(),
      cancelDelivery: jest.fn(async () => ({ success: true })),
      getDeliveryStatus: jest.fn(),
    };
    const trackingRepository = createDeliveryRepository<any>([
      {
        id: 'tracking-1',
        delivery_integration_id: 'integration-1',
        order_id: 'order-1',
        provider: 'swiggy',
        status: 'assigned',
        delivery_partner_id: 'partner-1',
        attempt_count: 1,
        delivery_partner_id: 'partner-1',
        delivery_integration: {
          id: 'integration-2',
          provider: 'swiggy',
          cost_handling: 'customer',
        },
      },
    ]);
    const service = new DeliveryService(new Map([['swiggy', fakeProvider]]), {
      integrationRepository: createDeliveryRepository() as any,
      trackingRepository: trackingRepository as any,
      ratingRepository: createDeliveryRepository() as any,
      orderRepository: createDeliveryRepository() as any,
    }, { enforceCapability: false });

    await expect(service.cancelDelivery('tracking-1', 'customer request'))
      .rejects.toThrow('Persisted delivery integration relation id must match tracking integration');

    expect(fakeProvider.cancelDelivery).not.toHaveBeenCalled();
    expect(trackingRepository.save).not.toHaveBeenCalled();
  });

  it('rejects malformed delivery status updates before tracking reads', async () => {
    const trackingRepository = createDeliveryRepository();
    const service = new DeliveryService(new Map(), {
      integrationRepository: createDeliveryRepository() as any,
      trackingRepository: trackingRepository as any,
      ratingRepository: createDeliveryRepository() as any,
      orderRepository: createDeliveryRepository() as any,
    }, { enforceCapability: false });

    await expect(
      service.updateDeliveryStatus('tracking-1', 'teleported' as any)
    ).rejects.toThrow('Next delivery status has an invalid status');

    await expect(
      service.updateDeliveryStatus('tracking-1', '   ' as any)
    ).rejects.toThrow('Next delivery status has an invalid status');

    await expect(
      service.updateDeliveryStatus('tracking-1', 'picked_up', null as any)
    ).rejects.toThrow('Delivery status update details must be an object');

    await expect(
      service.updateDeliveryStatus('tracking-1', 'picked_up', {
        message: 'Picked up',
        provider_trace_id: 'trace-1',
      } as any)
    ).rejects.toThrow('Delivery status update details include unsupported field(s): provider_trace_id');

    expect(trackingRepository.findOne).not.toHaveBeenCalled();
    expect(trackingRepository.save).not.toHaveBeenCalled();
  });

  it('requires delivery progress timestamps before saving provider status updates', async () => {
    const trackingRepository = createDeliveryRepository<any>([
      {
        id: 'tracking-missing-pickup',
        delivery_integration_id: 'integration-1',
        order_id: 'order-1',
        provider: 'swiggy',
        status: 'assigned',
        delivery_partner_id: 'partner-1',
        attempt_count: 1,
        status_history: [{ status: 'assigned', timestamp: new Date('2026-06-21T00:00:00.000Z') }],
      },
      {
        id: 'tracking-missing-delivery',
        delivery_integration_id: 'integration-1',
        order_id: 'order-2',
        provider: 'swiggy',
        status: 'picked_up',
        delivery_partner_id: 'partner-1',
        picked_up_at: new Date('2026-06-21T00:10:00.000Z'),
        attempt_count: 1,
        status_history: [{ status: 'picked_up', timestamp: new Date('2026-06-21T00:10:00.000Z') }],
      },
      {
        id: 'tracking-premature-delivery-evidence',
        delivery_integration_id: 'integration-1',
        order_id: 'order-3',
        provider: 'swiggy',
        status: 'assigned',
        delivery_partner_id: 'partner-1',
        attempt_count: 1,
        status_history: [{ status: 'assigned', timestamp: new Date('2026-06-21T00:00:00.000Z') }],
      },
    ]);
    const service = new DeliveryService(new Map(), {
      integrationRepository: createDeliveryRepository() as any,
      trackingRepository: trackingRepository as any,
      ratingRepository: createDeliveryRepository() as any,
      orderRepository: createDeliveryRepository() as any,
    }, { enforceCapability: false });

    await expect(
      service.updateDeliveryStatus('tracking-missing-pickup', 'picked_up')
    ).rejects.toThrow('Picked-up timestamp is required once delivery is picked up');

    await expect(
      service.updateDeliveryStatus('tracking-missing-delivery', 'delivered')
    ).rejects.toThrow('Delivered timestamp is required for delivered status');

    await expect(
      service.updateDeliveryStatus('tracking-premature-delivery-evidence', 'en_route', {
        picked_up_at: new Date('2026-06-21T00:10:00.000Z'),
        delivered_at: new Date('2026-06-21T00:30:00.000Z'),
        timestamp: new Date('2026-06-21T00:15:00.000Z'),
      })
    ).rejects.toThrow('Delivered timestamp cannot be present before delivered status');

    expect(trackingRepository.save).not.toHaveBeenCalled();
  });

  it('validates every rating dimension before writing a delivery rating', async () => {
    const service = new DeliveryService(new Map(), {
      integrationRepository: createDeliveryRepository() as any,
      trackingRepository: createDeliveryRepository() as any,
      ratingRepository: createDeliveryRepository() as any,
      orderRepository: createDeliveryRepository() as any,
    }, { enforceCapability: false });

    await expect(
      service.submitDeliveryRating('tracking-1', 'customer-1', {
        rating: 5,
        packaging_rating: 6,
      })
    ).rejects.toThrow('Packaging rating must be between 1 and 5');
  });

  it('rejects malformed rating feedback and issue labels before tracking or rating reads', async () => {
    const trackingRepository = createDeliveryRepository();
    const ratingRepository = createDeliveryRepository();
    const service = new DeliveryService(new Map(), {
      integrationRepository: createDeliveryRepository() as any,
      trackingRepository: trackingRepository as any,
      ratingRepository: ratingRepository as any,
      orderRepository: createDeliveryRepository() as any,
    }, { enforceCapability: false });

    await expect(
      service.submitDeliveryRating('tracking-1', 'customer-1', null as any)
    ).rejects.toThrow('Delivery rating data must be an object');

    await expect(
      service.submitDeliveryRating('tracking-1', 'customer-1', [] as any)
    ).rejects.toThrow('Delivery rating data must be an object');

    await expect(
      service.submitDeliveryRating('tracking-1', 'customer-1', {
        rating: 5,
        feedback: '   ',
      })
    ).rejects.toThrow('Delivery rating feedback must be a non-empty string');

    await expect(
      service.submitDeliveryRating('tracking-1', 'customer-1', {
        rating: 5,
        issues: ['Late arrival', '   '],
      })
    ).rejects.toThrow('Delivery rating issues item 2 must be a non-empty string');

    await expect(
      service.submitDeliveryRating('tracking-1', 'customer-1', {
        rating: 5,
        issues: 'cold food' as any,
      })
    ).rejects.toThrow('Delivery rating issues must be an array of strings');

    await expect(
      service.submitDeliveryRating('tracking-1', 'customer-1', {
        rating: 5,
        provider_trace_id: 'trace-1',
      } as any)
    ).rejects.toThrow('Delivery rating data include unsupported field(s): provider_trace_id');

    await expect(
      service.submitDeliveryRating('tracking-1', 'customer-1', {
        rating: 5,
        ['provider_trace_id\uFEFF']: 'trace-1',
      } as any)
    ).rejects.toThrow('Delivery rating data field names must not include unsafe control characters');

    expect(trackingRepository.findOne).not.toHaveBeenCalled();
    expect(ratingRepository.findOne).not.toHaveBeenCalled();
    expect(ratingRepository.create).not.toHaveBeenCalled();
    expect(ratingRepository.save).not.toHaveBeenCalled();
  });

  it('normalizes rating feedback and issue labels before rating persistence', async () => {
    const trackingRepository = createDeliveryRepository<any>([
      {
        id: 'tracking-1',
        delivery_integration_id: 'integration-1',
        order_id: 'order-1',
        provider: 'swiggy',
        status: 'delivered',
        delivery_partner_id: 'partner-1',
        attempt_count: 1,
        picked_up_at: new Date('2026-06-20T23:50:00.000Z'),
        delivered_at: new Date('2026-06-21T00:00:00.000Z'),
        order: { id: 'order-1', customer_id: 'customer-1' },
      },
    ]);
    const ratingRepository = createDeliveryRepository();
    const service = new DeliveryService(new Map(), {
      integrationRepository: createDeliveryRepository() as any,
      trackingRepository: trackingRepository as any,
      ratingRepository: ratingRepository as any,
      orderRepository: createDeliveryRepository() as any,
    }, { enforceCapability: false });

    const rating = await service.submitDeliveryRating('tracking-1', 'customer-1', {
      rating: 5,
      feedback: ' Great handoff ',
      issues: [' Late arrival ', 'late arrival', ' Cold packaging ', 'COLD PACKAGING'],
    });

    expect(rating).toMatchObject({
      delivery_tracking_id: 'tracking-1',
      customer_id: 'customer-1',
      feedback: 'Great handoff',
      issues: ['Late arrival', 'Cold packaging'],
    });
    expect(ratingRepository.create).toHaveBeenCalledWith(expect.objectContaining({
      feedback: 'Great handoff',
      issues: ['Late arrival', 'Cold packaging'],
    }));
    expect(ratingRepository.save).toHaveBeenCalledWith(expect.objectContaining({
      feedback: 'Great handoff',
      issues: ['Late arrival', 'Cold packaging'],
    }));
  });

  it('omits absent optional rating feedback before rating persistence', async () => {
    const trackingRepository = createDeliveryRepository<any>([
      {
        id: 'tracking-1',
        delivery_integration_id: 'integration-1',
        order_id: 'order-1',
        provider: 'swiggy',
        status: 'delivered',
        delivery_partner_id: 'partner-1',
        attempt_count: 1,
        picked_up_at: new Date('2026-06-20T23:50:00.000Z'),
        delivered_at: new Date('2026-06-21T00:00:00.000Z'),
        order: { id: 'order-1', customer_id: 'customer-1' },
      },
    ]);
    const ratingRepository = createDeliveryRepository();
    const service = new DeliveryService(new Map(), {
      integrationRepository: createDeliveryRepository() as any,
      trackingRepository: trackingRepository as any,
      ratingRepository: ratingRepository as any,
      orderRepository: createDeliveryRepository() as any,
    }, { enforceCapability: false });

    const rating = await service.submitDeliveryRating('tracking-1', 'customer-1', {
      rating: 5,
      issues: [' Late arrival '],
    });

    expect(rating).not.toHaveProperty('feedback');
    expect(rating).toMatchObject({
      delivery_tracking_id: 'tracking-1',
      customer_id: 'customer-1',
      issues: ['Late arrival'],
    });
    expect(ratingRepository.create.mock.calls[0][0]).not.toHaveProperty('feedback');
    expect(ratingRepository.save.mock.calls[0][0]).not.toHaveProperty('feedback');
  });

  it('rejects corrupt delivery rating tracking statuses before rating reads or writes', async () => {
    const trackingRepository = createDeliveryRepository<any>([
      {
        id: 'tracking-corrupt',
        delivery_integration_id: 'integration-1',
        order_id: 'order-1',
        provider: 'swiggy',
        status: 'teleported',
        attempt_count: 1,
      },
    ]);
    const ratingRepository = createDeliveryRepository();
    const service = new DeliveryService(new Map(), {
      integrationRepository: createDeliveryRepository() as any,
      trackingRepository: trackingRepository as any,
      ratingRepository: ratingRepository as any,
      orderRepository: createDeliveryRepository() as any,
    }, { enforceCapability: false });

    await expect(
      service.submitDeliveryRating('tracking-corrupt', 'customer-1', { rating: 5 })
    ).rejects.toThrow('Persisted delivery tracking status has an invalid status');

    expect(ratingRepository.findOne).not.toHaveBeenCalled();
    expect(ratingRepository.create).not.toHaveBeenCalled();
    expect(ratingRepository.save).not.toHaveBeenCalled();
  });

  it('rejects malformed persisted tracking rows before delivery rating reads or writes', async () => {
    const trackingRepository = createDeliveryRepository<any>([
      {
        id: 'tracking-corrupt-provider',
        delivery_integration_id: 'integration-1',
        order_id: 'order-1',
        provider: 'drone',
        status: 'delivered',
        attempt_count: 1,
      },
    ]);
    const ratingRepository = createDeliveryRepository();
    const service = new DeliveryService(new Map(), {
      integrationRepository: createDeliveryRepository() as any,
      trackingRepository: trackingRepository as any,
      ratingRepository: ratingRepository as any,
      orderRepository: createDeliveryRepository() as any,
    }, { enforceCapability: false });

    await expect(
      service.submitDeliveryRating('tracking-corrupt-provider', 'customer-1', { rating: 5 })
    ).rejects.toMatchObject({
      code: 'FEATURE_UNAVAILABLE',
      capability: 'delivery_partner',
      message: 'Persisted delivery tracking provider is not approved for launch',
    });

    expect(ratingRepository.findOne).not.toHaveBeenCalled();
    expect(ratingRepository.create).not.toHaveBeenCalled();
    expect(ratingRepository.save).not.toHaveBeenCalled();
  });

  it('requires delivery rating customer ownership evidence from the tracked order before rating reads or writes', async () => {
    const cases = [
      {
        row: {
          id: 'tracking-missing-order-relation',
          delivery_integration_id: 'integration-1',
          order_id: 'order-1',
          provider: 'swiggy',
          status: 'delivered',
          delivery_partner_id: 'partner-1',
          attempt_count: 1,
          picked_up_at: new Date('2026-06-20T23:50:00.000Z'),
          delivered_at: new Date('2026-06-21T00:00:00.000Z'),
        },
        trackingId: 'tracking-missing-order-relation',
        expectedError: 'Delivery rating order relation is required before accepting customer rating',
      },
      {
        row: {
          id: 'tracking-cross-order-relation',
          delivery_integration_id: 'integration-1',
          order_id: 'order-1',
          provider: 'swiggy',
          status: 'delivered',
          delivery_partner_id: 'partner-1',
          attempt_count: 1,
          picked_up_at: new Date('2026-06-20T23:50:00.000Z'),
          delivered_at: new Date('2026-06-21T00:00:00.000Z'),
          order: { id: 'order-elsewhere', customer_id: 'customer-1' },
        },
        trackingId: 'tracking-cross-order-relation',
        expectedError: 'Delivery rating order relation id must match tracking order_id',
      },
      {
        row: {
          id: 'tracking-cross-customer',
          delivery_integration_id: 'integration-1',
          order_id: 'order-1',
          provider: 'swiggy',
          status: 'delivered',
          delivery_partner_id: 'partner-1',
          attempt_count: 1,
          picked_up_at: new Date('2026-06-20T23:50:00.000Z'),
          delivered_at: new Date('2026-06-21T00:00:00.000Z'),
          order: { id: 'order-1', customer_id: 'customer-owner' },
        },
        trackingId: 'tracking-cross-customer',
        expectedError: 'Delivery rating customer_id must match order customer_id',
      },
    ];

    for (const { row, trackingId, expectedError } of cases) {
      const trackingRepository = createDeliveryRepository<any>([row]);
      const ratingRepository = createDeliveryRepository();
      const service = new DeliveryService(new Map(), {
        integrationRepository: createDeliveryRepository() as any,
        trackingRepository: trackingRepository as any,
        ratingRepository: ratingRepository as any,
        orderRepository: createDeliveryRepository() as any,
      }, { enforceCapability: false });

      await expect(
        service.submitDeliveryRating(trackingId, 'customer-1', { rating: 5 })
      ).rejects.toThrow(expectedError);

      expect(trackingRepository.findOne).toHaveBeenCalledWith({
        where: { id: trackingId },
        relations: ['order'],
      });
      expect(ratingRepository.findOne).not.toHaveBeenCalled();
      expect(ratingRepository.create).not.toHaveBeenCalled();
      expect(ratingRepository.save).not.toHaveBeenCalled();
    }
  });

  it('rejects corrupt duplicate delivery rating rows before the already-rated shortcut', async () => {
    const tracking = {
      id: 'tracking-1',
      delivery_integration_id: 'integration-1',
      order_id: 'order-1',
      provider: 'swiggy',
      status: 'delivered',
      delivery_partner_id: 'partner-1',
      attempt_count: 1,
      picked_up_at: new Date('2026-06-20T23:50:00.000Z'),
      delivered_at: new Date('2026-06-21T00:00:00.000Z'),
      order: { id: 'order-1', customer_id: 'customer-1' },
    };
    const cases = [
      {
        row: [] as any,
        expectedError: 'Persisted delivery rating must be an object',
      },
      {
        row: {
          id: 'rating-extra-provider-field',
          delivery_tracking_id: 'tracking-1',
          order_id: 'order-1',
          customer_id: 'customer-1',
          provider: 'swiggy',
          rating: 5,
          issues: [],
          provider_trace_id: 'trace-1',
        },
        expectedError: 'Persisted delivery rating include unsupported field(s): provider_trace_id',
      },
      {
        row: {
          id: 'rating-unsafe-provider-field',
          delivery_tracking_id: 'tracking-1',
          order_id: 'order-1',
          customer_id: 'customer-1',
          provider: 'swiggy',
          rating: 5,
          issues: [],
          ['provider_trace_id\uFEFF']: 'trace-1',
        },
        expectedError: 'Persisted delivery rating field names must not include unsafe control characters',
      },
      {
        row: {
          id: 'rating-cross-tracking',
          delivery_tracking_id: 'tracking-elsewhere',
          order_id: 'order-1',
          customer_id: 'customer-1',
          provider: 'swiggy',
          rating: 5,
          issues: [],
        },
        expectedError: 'Persisted delivery rating delivery_tracking_id must match requested tracking',
      },
      {
        row: {
          id: 'rating-cross-order',
          delivery_tracking_id: 'tracking-1',
          order_id: 'order-elsewhere',
          customer_id: 'customer-1',
          provider: 'swiggy',
          rating: 5,
          issues: [],
        },
        expectedError: 'Persisted delivery rating order_id must match requested tracking order',
      },
      {
        row: {
          id: 'rating-cross-provider',
          delivery_tracking_id: 'tracking-1',
          order_id: 'order-1',
          customer_id: 'customer-1',
          provider: 'zomato',
          rating: 5,
          issues: [],
        },
        expectedError: 'Persisted delivery rating provider must match requested tracking provider',
      },
      {
        row: {
          id: 'rating-cross-customer',
          delivery_tracking_id: 'tracking-1',
          order_id: 'order-1',
          customer_id: 'customer-elsewhere',
          provider: 'swiggy',
          rating: 5,
          issues: [],
        },
        expectedError: 'Persisted delivery rating customer_id must match requested tracking customer',
      },
      {
        row: {
          id: 'rating-bad-score',
          delivery_tracking_id: 'tracking-1',
          order_id: 'order-1',
          customer_id: 'customer-1',
          provider: 'swiggy',
          rating: 6,
          issues: [],
        },
        expectedError: 'Persisted delivery rating rating must be between 1 and 5',
      },
      {
        row: {
          id: 'rating-before-delivery',
          delivery_tracking_id: 'tracking-1',
          order_id: 'order-1',
          customer_id: 'customer-1',
          provider: 'swiggy',
          rating: 5,
          issues: [],
          created_at: new Date('2026-06-20T23:59:59.000Z'),
        },
        expectedError: 'Persisted delivery rating created_at cannot be before delivered_at',
      },
    ];

    for (const { row, expectedError } of cases) {
      const trackingRepository = createDeliveryRepository<any>([tracking]);
      const ratingRepository = {
        ...createDeliveryRepository(),
        findOne: jest.fn(async () => row),
      };
      const service = new DeliveryService(new Map(), {
        integrationRepository: createDeliveryRepository() as any,
        trackingRepository: trackingRepository as any,
        ratingRepository: ratingRepository as any,
        orderRepository: createDeliveryRepository() as any,
      }, { enforceCapability: false });

      await expect(
        service.submitDeliveryRating('tracking-1', 'customer-1', { rating: 5 })
      ).rejects.toThrow(expectedError);

      expect(ratingRepository.create).not.toHaveBeenCalled();
      expect(ratingRepository.save).not.toHaveBeenCalled();
    }
  });

  it('treats malformed provider success responses as failed delivery attempts', async () => {
    const fakeProvider = {
      provider: 'swiggy' as const,
      createDelivery: jest.fn(async () => ({
        success: true,
        delivery_fee_cents: -50,
      })),
      cancelDelivery: jest.fn(),
      getDeliveryStatus: jest.fn(),
    };
    const integration = {
      id: 'integration-1',
      business_id: 'business-1',
      provider: 'swiggy',
      is_active: true,
      total_deliveries: 0,
      failure_count: 0,
      last_error: null,
    };
    const integrationRepository = createDeliveryRepository<any>([integration]);
    const trackingRepository = createDeliveryRepository<any>([]);
    const service = new DeliveryService(new Map([['swiggy', fakeProvider]]), {
      integrationRepository: integrationRepository as any,
      trackingRepository: trackingRepository as any,
      ratingRepository: createDeliveryRepository() as any,
      orderRepository: createDeliveryRepository<any>([
        {
          id: 'order-1',
          business_id: 'business-1',
        },
      ]) as any,
    }, { enforceCapability: false });

    const tracking = await service.createDelivery('order-1');

    expect(fakeProvider.createDelivery).toHaveBeenCalledTimes(1);
    expect(tracking).toMatchObject({
      status: 'failed',
      attempt_count: 1,
      error_message: 'Delivery provider success response must include delivery_partner_id',
    });
    expect(integrationRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'integration-1',
        total_deliveries: 0,
        failure_count: 1,
        last_error: 'Delivery provider success response must include delivery_partner_id',
      })
    );
    expect(trackingRepository.save).toHaveBeenLastCalledWith(
      expect.objectContaining({
        status: 'failed',
        attempt_count: 1,
      })
    );
  });

  it('treats malformed provider creation response envelopes as failed delivery attempts', async () => {
    const malformedProviderResponses = [
      {
        response: null,
        expectedError: 'Delivery provider creation response must be an object',
      },
      {
        response: [],
        expectedError: 'Delivery provider creation response must be an object',
      },
      {
        response: { success: 'yes' },
        expectedError: 'Delivery provider creation response success must be a boolean',
      },
      {
        response: { success: true, error: 'partner warning' },
        expectedError: 'Delivery provider creation success response error cannot be present',
      },
      {
        response: {
          success: true,
          provider_trace_id: 'trace-1',
        },
        expectedError: 'Delivery provider creation response includes unsupported field(s): provider_trace_id',
      },
      {
        response: {
          success: true,
          '\uFEFFprovider_trace_id': 'trace-1',
        },
        expectedError:
          'Delivery provider creation response field names must not include unsafe control characters',
      },
      {
        response: {
          success: true,
          delivery_partner_id: 'partner-\u00071',
        },
        expectedError:
          'Delivery provider success response delivery_partner_id must not include unsafe control characters',
      },
      {
        response: {
          success: true,
          delivery_partner_id: 'partner-\u202E1',
        },
        expectedError:
          'Delivery provider success response delivery_partner_id must not include unsafe control characters',
      },
      {
        response: {
          success: true,
          delivery_partner_id: '\uFEFFpartner-1',
        },
        expectedError:
          'Delivery provider success response delivery_partner_id must not include unsafe control characters',
      },
      {
        response: {
          success: true,
          delivery_partner_id: 'p'.repeat(256),
        },
        expectedError:
          'Delivery provider success response delivery_partner_id must be at most 255 characters',
      },
      {
        response: {
          success: true,
          delivery_partner_id: 'partner-1',
          order_id: 'o'.repeat(256),
        },
        expectedError:
          'Delivery provider success response order_id must be at most 255 characters',
      },
      {
        response: {
          success: true,
          delivery_partner_id: 'partner-1',
          business_id: 'b'.repeat(256),
        },
        expectedError:
          'Delivery provider success response business_id must be at most 255 characters',
      },
      {
        response: {
          success: true,
          delivery_partner_id: 'partner-1',
          delivery_integration_id: 'i'.repeat(256),
        },
        expectedError:
          'Delivery provider success response delivery_integration_id must be at most 255 characters',
      },
      {
        response: {
          success: true,
          delivery_partner_id: 'partner-1',
          order_id: 'order-elsewhere',
        },
        expectedError: 'Delivery provider success response order_id must match requested order',
      },
      {
        response: {
          success: true,
          delivery_partner_id: 'partner-1',
          business_id: 'business-elsewhere',
        },
        expectedError: 'Delivery provider success response business_id must match requested order business',
      },
      {
        response: {
          success: true,
          delivery_partner_id: 'partner-1',
          delivery_integration_id: 'integration-elsewhere',
        },
        expectedError:
          'Delivery provider success response delivery_integration_id must match active integration',
      },
      {
        response: {
          success: true,
          delivery_partner_id: 'partner-1',
          estimated_pickup_at: new Date('2026-06-21T00:10:00.000Z'),
        },
        expectedError:
          'Delivery provider success response estimates must include both estimated_pickup_at and estimated_delivery_at',
      },
      {
        response: {
          success: true,
          delivery_partner_id: 'partner-1',
          estimated_delivery_at: new Date('2026-06-21T00:30:00.000Z'),
        },
        expectedError:
          'Delivery provider success response estimates must include both estimated_pickup_at and estimated_delivery_at',
      },
      {
        response: { success: false },
        expectedError: 'Delivery provider creation failure response must include error',
      },
      {
        response: { success: false, error: '   ' },
        expectedError: 'Delivery provider creation response error must be a non-empty string',
      },
      {
        response: { success: false, error: `provider-${'x'.repeat(1001)}` },
        expectedError: 'Delivery provider creation response error must be at most 1000 characters',
      },
      {
        response: {
          success: false,
          error: 'partner rejected',
          provider_trace_id: 'trace-1',
        },
        expectedError: 'Delivery provider creation response includes unsupported field(s): provider_trace_id',
      },
      {
        response: {
          success: false,
          error: 'partner rejected',
          delivery_partner_id: 'partner-stale',
        },
        expectedError:
          'Delivery provider creation failure response cannot include success field(s): delivery_partner_id',
      },
      {
        response: {
          success: false,
          error: 'partner rejected',
          delivery_partner_id: 'partner-stale',
          order_id: 'order-1',
          business_id: 'business-1',
          delivery_integration_id: 'integration-1',
          estimated_pickup_at: new Date('2026-06-21T00:10:00.000Z'),
          estimated_delivery_at: new Date('2026-06-21T00:30:00.000Z'),
          delivery_fee_cents: 4500,
          tracking_url: 'https://tracking.example.com/orders/order-1',
        },
        expectedError:
          'Delivery provider creation failure response cannot include success field(s): delivery_partner_id, order_id, business_id, delivery_integration_id, estimated_pickup_at, estimated_delivery_at, delivery_fee_cents, tracking_url',
      },
    ];

    for (const { response, expectedError } of malformedProviderResponses) {
      const fakeProvider = {
        provider: 'swiggy' as const,
        createDelivery: jest.fn(async () => response),
        cancelDelivery: jest.fn(),
        getDeliveryStatus: jest.fn(),
      };
      const integration = {
        id: 'integration-1',
        business_id: 'business-1',
        provider: 'swiggy',
        is_active: true,
        total_deliveries: 0,
        failure_count: 0,
        last_error: null,
      };
      const integrationRepository = createDeliveryRepository<any>([integration]);
      const trackingRepository = createDeliveryRepository<any>([]);
      const service = new DeliveryService(new Map([['swiggy', fakeProvider as any]]), {
        integrationRepository: integrationRepository as any,
        trackingRepository: trackingRepository as any,
        ratingRepository: createDeliveryRepository() as any,
        orderRepository: createDeliveryRepository<any>([
          {
            id: 'order-1',
            business_id: 'business-1',
          },
        ]) as any,
      }, { enforceCapability: false });

      const tracking = await service.createDelivery('order-1');

      expect(fakeProvider.createDelivery).toHaveBeenCalledTimes(1);
      expect(tracking).toMatchObject({
        status: 'failed',
        attempt_count: 1,
        error_message: expectedError,
      });
      expect(integrationRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'integration-1',
          total_deliveries: 0,
          failure_count: 1,
          last_error: expectedError,
        })
      );
      expect(trackingRepository.save).toHaveBeenLastCalledWith(
        expect.objectContaining({
          status: 'failed',
          attempt_count: 1,
          error_message: expectedError,
        })
      );
      expect(tracking.delivery_partner_id).toBeNull();
    }
  });

  it('rejects corrupt integration counters before creating tracking or calling a provider', async () => {
    const fakeProvider = {
      provider: 'swiggy' as const,
      createDelivery: jest.fn(async () => ({
        success: true,
        delivery_partner_id: 'partner-1',
      })),
      cancelDelivery: jest.fn(),
      getDeliveryStatus: jest.fn(),
    };
    const integrationRepository = createDeliveryRepository<any>([{
      id: 'integration-1',
      business_id: 'business-1',
      provider: 'swiggy',
      is_active: true,
      total_deliveries: Number.MAX_SAFE_INTEGER,
      failure_count: 0,
    }]);
    const trackingRepository = createDeliveryRepository<any>([]);
    const service = new DeliveryService(new Map([['swiggy', fakeProvider]]), {
      integrationRepository: integrationRepository as any,
      trackingRepository: trackingRepository as any,
      ratingRepository: createDeliveryRepository() as any,
      orderRepository: createDeliveryRepository<any>([{
        id: 'order-1',
        business_id: 'business-1',
      }]) as any,
    }, { enforceCapability: false });

    await expect(service.createDelivery('order-1')).rejects.toThrow(
      'Delivery integration total_deliveries cannot be incremented safely'
    );

    expect(fakeProvider.createDelivery).not.toHaveBeenCalled();
    expect(trackingRepository.findOne).not.toHaveBeenCalled();
    expect(trackingRepository.create).not.toHaveBeenCalled();
    expect(trackingRepository.save).not.toHaveBeenCalled();
    expect(integrationRepository.save).not.toHaveBeenCalled();
  });

  it('rejects negative failure counters before creating tracking or calling a provider', async () => {
    const fakeProvider = {
      provider: 'swiggy' as const,
      createDelivery: jest.fn(),
      cancelDelivery: jest.fn(),
      getDeliveryStatus: jest.fn(),
    };
    const integrationRepository = createDeliveryRepository<any>([{
      id: 'integration-1',
      business_id: 'business-1',
      provider: 'swiggy',
      is_active: true,
      total_deliveries: 0,
      failure_count: -1,
    }]);
    const trackingRepository = createDeliveryRepository<any>([]);
    const service = new DeliveryService(new Map([['swiggy', fakeProvider]]), {
      integrationRepository: integrationRepository as any,
      trackingRepository: trackingRepository as any,
      ratingRepository: createDeliveryRepository() as any,
      orderRepository: createDeliveryRepository<any>([{
        id: 'order-1',
        business_id: 'business-1',
      }]) as any,
    }, { enforceCapability: false });

    await expect(service.createDelivery('order-1')).rejects.toThrow(
      'Persisted delivery integration failure_count must be a non-negative safe integer'
    );

    expect(fakeProvider.createDelivery).not.toHaveBeenCalled();
    expect(trackingRepository.create).not.toHaveBeenCalled();
    expect(trackingRepository.save).not.toHaveBeenCalled();
    expect(integrationRepository.save).not.toHaveBeenCalled();
  });

  it('initializes and increments delivery counters with safe integer values', async () => {
    const fakeProvider = {
      provider: 'swiggy' as const,
      createDelivery: jest.fn(async () => ({
        success: false,
        error: 'Partner temporarily unavailable',
      })),
      cancelDelivery: jest.fn(),
      getDeliveryStatus: jest.fn(),
    };
    const integration = {
      id: 'integration-1',
      business_id: 'business-1',
      provider: 'swiggy',
      is_active: true,
      total_deliveries: 4,
      failure_count: 2,
    };
    const integrationRepository = createDeliveryRepository<any>([integration]);
    const trackingRepository = createDeliveryRepository<any>([]);
    const service = new DeliveryService(new Map([['swiggy', fakeProvider]]), {
      integrationRepository: integrationRepository as any,
      trackingRepository: trackingRepository as any,
      ratingRepository: createDeliveryRepository() as any,
      orderRepository: createDeliveryRepository<any>([{
        id: 'order-1',
        business_id: 'business-1',
      }]) as any,
    }, { enforceCapability: false });

    const tracking = await service.createDelivery('order-1');

    expect(tracking).toMatchObject({
      status: 'failed',
      attempt_count: 1,
      error_message: 'Partner temporarily unavailable',
    });
    expect(integration).toMatchObject({
      total_deliveries: 4,
      failure_count: 3,
      last_error: 'Partner temporarily unavailable',
    });
  });

  it('rejects unsafe provider delivery fees before marking delivery assigned', async () => {
    const fakeProvider = {
      provider: 'swiggy' as const,
      createDelivery: jest.fn(async () => ({
        success: true,
        delivery_partner_id: 'partner-1',
        delivery_fee_cents: Number.MAX_SAFE_INTEGER + 1,
      })),
      cancelDelivery: jest.fn(),
      getDeliveryStatus: jest.fn(),
    };
    const integration = {
      id: 'integration-1',
      business_id: 'business-1',
      provider: 'swiggy',
      is_active: true,
      total_deliveries: 0,
      failure_count: 0,
      last_error: null,
    };
    const integrationRepository = createDeliveryRepository<any>([integration]);
    const trackingRepository = createDeliveryRepository<any>([]);
    const service = new DeliveryService(new Map([['swiggy', fakeProvider]]), {
      integrationRepository: integrationRepository as any,
      trackingRepository: trackingRepository as any,
      ratingRepository: createDeliveryRepository() as any,
      orderRepository: createDeliveryRepository<any>([
        {
          id: 'order-1',
          business_id: 'business-1',
        },
      ]) as any,
    }, { enforceCapability: false });

    const tracking = await service.createDelivery('order-1');

    expect(tracking).toMatchObject({
      status: 'failed',
      attempt_count: 1,
      error_message:
        'Delivery provider success response delivery_fee_cents must be a safe integer amount of cents',
    });
    expect(integrationRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        total_deliveries: 0,
        failure_count: 1,
        last_error:
          'Delivery provider success response delivery_fee_cents must be a safe integer amount of cents',
      })
    );
  });

  it('rejects invalid provider delivery estimates before marking delivery assigned', async () => {
    const fakeProvider = {
      provider: 'swiggy' as const,
      createDelivery: jest.fn(async () => ({
        success: true,
        delivery_partner_id: 'partner-1',
        estimated_pickup_at: new Date('not-a-pickup-time'),
      })),
      cancelDelivery: jest.fn(),
      getDeliveryStatus: jest.fn(),
    };
    const integration = {
      id: 'integration-1',
      business_id: 'business-1',
      provider: 'swiggy',
      is_active: true,
      total_deliveries: 0,
      failure_count: 0,
      last_error: null,
    };
    const integrationRepository = createDeliveryRepository<any>([integration]);
    const trackingRepository = createDeliveryRepository<any>([]);
    const service = new DeliveryService(new Map([['swiggy', fakeProvider]]), {
      integrationRepository: integrationRepository as any,
      trackingRepository: trackingRepository as any,
      ratingRepository: createDeliveryRepository() as any,
      orderRepository: createDeliveryRepository<any>([
        {
          id: 'order-1',
          business_id: 'business-1',
        },
      ]) as any,
    }, { enforceCapability: false });

    const tracking = await service.createDelivery('order-1');

    expect(tracking).toMatchObject({
      status: 'failed',
      attempt_count: 1,
      error_message: 'Delivery provider success response estimated_pickup_at must be a valid Date',
    });
    expect(tracking.estimated_pickup_at).toBeNull();
    expect(integrationRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        total_deliveries: 0,
        failure_count: 1,
        last_error: 'Delivery provider success response estimated_pickup_at must be a valid Date',
      })
    );
  });

  it('rejects stale provider delivery estimates before marking delivery assigned', async () => {
    const fakeProvider = {
      provider: 'swiggy' as const,
      createDelivery: jest.fn(async () => ({
        success: true,
        delivery_partner_id: 'partner-1',
        estimated_pickup_at: new Date('2026-06-21T00:10:00.000Z'),
        estimated_delivery_at: new Date('2026-06-21T00:30:00.000Z'),
      })),
      cancelDelivery: jest.fn(),
      getDeliveryStatus: jest.fn(),
    };
    const integration = {
      id: 'integration-1',
      business_id: 'business-1',
      provider: 'swiggy',
      is_active: true,
      total_deliveries: 0,
      failure_count: 0,
      last_error: null,
    };
    const integrationRepository = createDeliveryRepository<any>([integration]);
    const trackingRepository = createDeliveryRepository<any>([]);
    const service = new DeliveryService(new Map([['swiggy', fakeProvider]]), {
      integrationRepository: integrationRepository as any,
      trackingRepository: trackingRepository as any,
      ratingRepository: createDeliveryRepository() as any,
      orderRepository: createDeliveryRepository<any>([
        {
          id: 'order-1',
          business_id: 'business-1',
          created_at: new Date('2026-06-21T00:20:00.000Z'),
        },
      ]) as any,
    }, { enforceCapability: false });

    const tracking = await service.createDelivery('order-1');

    expect(fakeProvider.createDelivery).toHaveBeenCalledTimes(1);
    expect(tracking).toMatchObject({
      status: 'failed',
      attempt_count: 1,
      error_message:
        'Delivery provider success response estimated_pickup_at cannot be before order created_at',
    });
    expect(tracking.estimated_pickup_at).toBeNull();
    expect(tracking.estimated_delivery_at).toBeNull();
    expect(integrationRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        total_deliveries: 0,
        failure_count: 1,
        last_error:
          'Delivery provider success response estimated_pickup_at cannot be before order created_at',
      })
    );
    expect(trackingRepository.save).toHaveBeenLastCalledWith(
      expect.objectContaining({
        status: 'failed',
        estimated_pickup_at: null,
        estimated_delivery_at: null,
      })
    );
  });

  it('rejects malformed provider tracking URLs before marking delivery assigned', async () => {
    const fakeProvider = {
      provider: 'swiggy' as const,
      createDelivery: jest.fn(async () => ({
        success: true,
        delivery_partner_id: 'partner-1',
        tracking_url: 'javascript:alert(1)',
      })),
      cancelDelivery: jest.fn(),
      getDeliveryStatus: jest.fn(),
    };
    const integration = {
      id: 'integration-1',
      business_id: 'business-1',
      provider: 'swiggy',
      is_active: true,
      total_deliveries: 0,
      failure_count: 0,
      last_error: null,
    };
    const integrationRepository = createDeliveryRepository<any>([integration]);
    const trackingRepository = createDeliveryRepository<any>([]);
    const service = new DeliveryService(new Map([['swiggy', fakeProvider]]), {
      integrationRepository: integrationRepository as any,
      trackingRepository: trackingRepository as any,
      ratingRepository: createDeliveryRepository() as any,
      orderRepository: createDeliveryRepository<any>([
        {
          id: 'order-1',
          business_id: 'business-1',
        },
      ]) as any,
    }, { enforceCapability: false });

    const tracking = await service.createDelivery('order-1');

    expect(tracking).toMatchObject({
      status: 'failed',
      attempt_count: 1,
      error_message: 'Delivery provider success response tracking_url must be an absolute HTTPS URL',
    });
    expect(tracking.tracking_url).toBeNull();
    expect(integrationRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        total_deliveries: 0,
        failure_count: 1,
        last_error: 'Delivery provider success response tracking_url must be an absolute HTTPS URL',
      })
    );
    expect(trackingRepository.save).toHaveBeenLastCalledWith(
      expect.objectContaining({
        status: 'failed',
      })
    );
    expect(trackingRepository.save.mock.calls.at(-1)?.[0]).toHaveProperty('tracking_url', null);
  });

  it('rejects provider tracking URLs with embedded credentials before marking delivery assigned', async () => {
    const fakeProvider = {
      provider: 'swiggy' as const,
      createDelivery: jest.fn(async () => ({
        success: true,
        delivery_partner_id: 'partner-1',
        tracking_url: 'https://courier:secret@tracking.example.com/orders/order-1',
      })),
      cancelDelivery: jest.fn(),
      getDeliveryStatus: jest.fn(),
    };
    const integration = {
      id: 'integration-1',
      business_id: 'business-1',
      provider: 'swiggy',
      is_active: true,
      total_deliveries: 0,
      failure_count: 0,
      last_error: null,
    };
    const integrationRepository = createDeliveryRepository<any>([integration]);
    const trackingRepository = createDeliveryRepository<any>([]);
    const service = new DeliveryService(new Map([['swiggy', fakeProvider]]), {
      integrationRepository: integrationRepository as any,
      trackingRepository: trackingRepository as any,
      ratingRepository: createDeliveryRepository() as any,
      orderRepository: createDeliveryRepository<any>([
        {
          id: 'order-1',
          business_id: 'business-1',
        },
      ]) as any,
    }, { enforceCapability: false });

    const tracking = await service.createDelivery('order-1');

    expect(tracking).toMatchObject({
      status: 'failed',
      attempt_count: 1,
      error_message: 'Delivery provider success response tracking_url must not include embedded credentials',
    });
    expect(tracking.tracking_url).toBeNull();
    expect(integrationRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        total_deliveries: 0,
        failure_count: 1,
        last_error: 'Delivery provider success response tracking_url must not include embedded credentials',
      })
    );
    expect(trackingRepository.save).toHaveBeenLastCalledWith(
      expect.objectContaining({
        status: 'failed',
      })
    );
    expect(trackingRepository.save.mock.calls.at(-1)?.[0]).toHaveProperty('tracking_url', null);
  });

  it.each([
    ['localhost tracking URL', 'https://localhost/orders/order-1'],
    ['loopback tracking URL', 'https://127.0.0.1/orders/order-1'],
    ['link-local metadata tracking URL', 'https://169.254.169.254/latest/meta-data'],
    ['RFC1918 tracking URL', 'https://192.168.1.10/orders/order-1'],
    ['IPv6 loopback tracking URL', 'https://[::1]/orders/order-1'],
    ['IPv6 private tracking URL', 'https://[fd00::1]/orders/order-1'],
    ['IPv6 link-local tracking URL', 'https://[fe80::1]/orders/order-1'],
  ])('rejects provider %s before marking delivery assigned', async (_caseName, trackingUrl) => {
    const fakeProvider = {
      provider: 'swiggy' as const,
      createDelivery: jest.fn(async () => ({
        success: true,
        delivery_partner_id: 'partner-1',
        tracking_url: trackingUrl,
      })),
      cancelDelivery: jest.fn(),
      getDeliveryStatus: jest.fn(),
    };
    const integration = {
      id: 'integration-1',
      business_id: 'business-1',
      provider: 'swiggy',
      is_active: true,
      total_deliveries: 0,
      failure_count: 0,
      last_error: null,
    };
    const integrationRepository = createDeliveryRepository<any>([integration]);
    const trackingRepository = createDeliveryRepository<any>([]);
    const service = new DeliveryService(new Map([['swiggy', fakeProvider]]), {
      integrationRepository: integrationRepository as any,
      trackingRepository: trackingRepository as any,
      ratingRepository: createDeliveryRepository() as any,
      orderRepository: createDeliveryRepository<any>([
        {
          id: 'order-1',
          business_id: 'business-1',
        },
      ]) as any,
    }, { enforceCapability: false });

    const tracking = await service.createDelivery('order-1');

    expect(tracking).toMatchObject({
      status: 'failed',
      attempt_count: 1,
      error_message: 'Delivery provider success response tracking_url must not point to private or internal hosts',
    });
    expect(tracking.tracking_url).toBeNull();
    expect(integrationRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        total_deliveries: 0,
        failure_count: 1,
        last_error: 'Delivery provider success response tracking_url must not point to private or internal hosts',
      })
    );
    expect(trackingRepository.save).toHaveBeenLastCalledWith(
      expect.objectContaining({
        status: 'failed',
      })
    );
    expect(trackingRepository.save.mock.calls.at(-1)?.[0]).toHaveProperty('tracking_url', null);
  });

  it('rejects provider tracking URLs with unsafe controls before marking delivery assigned', async () => {
    const fakeProvider = {
      provider: 'swiggy' as const,
      createDelivery: jest.fn(async () => ({
        success: true,
        delivery_partner_id: 'partner-1',
        tracking_url: 'https://tracking.example.com/orders/order-1\u200B',
      })),
      cancelDelivery: jest.fn(),
      getDeliveryStatus: jest.fn(),
    };
    const integration = {
      id: 'integration-1',
      business_id: 'business-1',
      provider: 'swiggy',
      is_active: true,
      total_deliveries: 0,
      failure_count: 0,
      last_error: null,
    };
    const integrationRepository = createDeliveryRepository<any>([integration]);
    const trackingRepository = createDeliveryRepository<any>([]);
    const service = new DeliveryService(new Map([['swiggy', fakeProvider]]), {
      integrationRepository: integrationRepository as any,
      trackingRepository: trackingRepository as any,
      ratingRepository: createDeliveryRepository() as any,
      orderRepository: createDeliveryRepository<any>([
        {
          id: 'order-1',
          business_id: 'business-1',
        },
      ]) as any,
    }, { enforceCapability: false });

    const tracking = await service.createDelivery('order-1');

    expect(tracking).toMatchObject({
      status: 'failed',
      attempt_count: 1,
      error_message: 'Delivery provider success response tracking_url must not include unsafe control characters',
    });
    expect(tracking.tracking_url).toBeNull();
    expect(integrationRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        total_deliveries: 0,
        failure_count: 1,
        last_error: 'Delivery provider success response tracking_url must not include unsafe control characters',
      })
    );
    expect(trackingRepository.save).toHaveBeenLastCalledWith(
      expect.objectContaining({
        status: 'failed',
      })
    );
    expect(trackingRepository.save.mock.calls.at(-1)?.[0]).toHaveProperty('tracking_url', null);
  });

  it('rejects provider tracking URLs with edge controls before trimming assignment evidence', async () => {
    const fakeProvider = {
      provider: 'swiggy' as const,
      createDelivery: jest.fn(async () => ({
        success: true,
        delivery_partner_id: 'partner-1',
        tracking_url: '\uFEFFhttps://tracking.example.com/orders/order-1',
      })),
      cancelDelivery: jest.fn(),
      getDeliveryStatus: jest.fn(),
    };
    const integration = {
      id: 'integration-1',
      business_id: 'business-1',
      provider: 'swiggy',
      is_active: true,
      total_deliveries: 0,
      failure_count: 0,
      last_error: null,
    };
    const integrationRepository = createDeliveryRepository<any>([integration]);
    const trackingRepository = createDeliveryRepository<any>([]);
    const service = new DeliveryService(new Map([['swiggy', fakeProvider]]), {
      integrationRepository: integrationRepository as any,
      trackingRepository: trackingRepository as any,
      ratingRepository: createDeliveryRepository() as any,
      orderRepository: createDeliveryRepository<any>([
        {
          id: 'order-1',
          business_id: 'business-1',
        },
      ]) as any,
    }, { enforceCapability: false });

    const tracking = await service.createDelivery('order-1');

    expect(tracking).toMatchObject({
      status: 'failed',
      error_message: 'Delivery provider success response tracking_url must not include unsafe control characters',
    });
    expect(tracking.tracking_url).toBeNull();
  });

  it('normalizes provider success identifiers before marking delivery assigned', async () => {
    const fakeProvider = {
      provider: 'swiggy' as const,
      createDelivery: jest.fn(async () => ({
        success: true,
        delivery_partner_id: ' partner-1 ',
        order_id: ' order-1 ',
        business_id: ' business-1 ',
        delivery_integration_id: ' integration-1 ',
        tracking_url: ' https://tracking.example.com/orders/order-1 ',
        delivery_fee_cents: 4500,
      })),
      cancelDelivery: jest.fn(),
      getDeliveryStatus: jest.fn(),
    };
    const integration = {
      id: 'integration-1',
      business_id: 'business-1',
      provider: 'swiggy',
      is_active: true,
      total_deliveries: 0,
      failure_count: 0,
      last_error: null,
    };
    const integrationRepository = createDeliveryRepository<any>([integration]);
    const trackingRepository = createDeliveryRepository<any>([]);
    const service = new DeliveryService(new Map([['swiggy', fakeProvider]]), {
      integrationRepository: integrationRepository as any,
      trackingRepository: trackingRepository as any,
      ratingRepository: createDeliveryRepository() as any,
      orderRepository: createDeliveryRepository<any>([
        {
          id: 'order-1',
          business_id: 'business-1',
        },
      ]) as any,
    }, { enforceCapability: false });

    const tracking = await service.createDelivery('order-1');

    expect(tracking).toMatchObject({
      status: 'assigned',
      delivery_partner_id: 'partner-1',
      tracking_url: 'https://tracking.example.com/orders/order-1',
      delivery_fee_cents: 4500,
    });
    expect(integrationRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        total_deliveries: 1,
        failure_count: 0,
        last_error: null,
      })
    );
    expect(trackingRepository.save).toHaveBeenLastCalledWith(
      expect.objectContaining({
        status: 'assigned',
        delivery_partner_id: 'partner-1',
        tracking_url: 'https://tracking.example.com/orders/order-1',
      })
    );
  });

  it('rejects cross-linked delivery creation contexts before provider or repository side effects', async () => {
    const cases = [
      {
        trackingOverrides: { order_id: 'order-elsewhere' },
        orderOverrides: {},
        integrationOverrides: {},
        expectedError: 'Delivery creation tracking order_id must match order id',
      },
      {
        trackingOverrides: { delivery_integration_id: 'integration-elsewhere' },
        orderOverrides: {},
        integrationOverrides: {},
        expectedError: 'Delivery creation tracking delivery_integration_id must match integration id',
      },
      {
        trackingOverrides: {},
        orderOverrides: { business_id: 'business-elsewhere' },
        integrationOverrides: {},
        expectedError: 'Delivery creation integration business_id must match order business_id',
      },
      {
        trackingOverrides: { provider: 'zomato' },
        orderOverrides: {},
        integrationOverrides: {},
        expectedError: 'Delivery creation tracking provider must match integration provider',
      },
    ];

    for (const { trackingOverrides, orderOverrides, integrationOverrides, expectedError } of cases) {
      const fakeProvider = {
        provider: 'swiggy' as const,
        createDelivery: jest.fn(async () => ({
          success: true,
          delivery_partner_id: 'partner-1',
        })),
        cancelDelivery: jest.fn(),
        getDeliveryStatus: jest.fn(),
      };
      const integration = {
        id: 'integration-1',
        business_id: 'business-1',
        provider: 'swiggy',
        is_active: true,
        total_deliveries: 0,
        failure_count: 0,
        last_error: null,
        ...integrationOverrides,
      };
      const tracking = {
        id: 'tracking-1',
        delivery_integration_id: 'integration-1',
        order_id: 'order-1',
        provider: 'swiggy',
        status: 'pending',
        attempt_count: 0,
        ...trackingOverrides,
      };
      const order = {
        id: 'order-1',
        business_id: 'business-1',
        ...orderOverrides,
      };
      const integrationRepository = createDeliveryRepository<any>([integration]);
      const trackingRepository = createDeliveryRepository<any>([tracking]);
      const service = new DeliveryService(new Map([['swiggy', fakeProvider]]), {
        integrationRepository: integrationRepository as any,
        trackingRepository: trackingRepository as any,
        ratingRepository: createDeliveryRepository() as any,
        orderRepository: createDeliveryRepository() as any,
      }, { enforceCapability: false });

      await expect(
        (service as any).attemptDeliveryCreation(tracking, order, integration)
      ).rejects.toThrow(expectedError);

      expect(fakeProvider.createDelivery).not.toHaveBeenCalled();
      expect(integrationRepository.save).not.toHaveBeenCalled();
      expect(trackingRepository.save).not.toHaveBeenCalled();
      expect(tracking).toMatchObject({
        status: 'pending',
        attempt_count: 0,
      });
      expect(integration).toMatchObject({
        total_deliveries: 0,
        failure_count: 0,
        last_error: null,
      });
    }
  });

  it('clears stale delivery failure markers when a retried creation succeeds', async () => {
    const estimatedPickupAt = new Date('2026-06-21T10:00:00.000Z');
    const estimatedDeliveryAt = new Date('2026-06-21T10:30:00.000Z');
    const fakeProvider = {
      provider: 'swiggy' as const,
      createDelivery: jest.fn(async () => ({
        success: true,
        delivery_partner_id: 'partner-1',
        estimated_pickup_at: estimatedPickupAt,
        estimated_delivery_at: estimatedDeliveryAt,
        delivery_fee_cents: 4500,
        tracking_url: 'https://tracking.example.com/orders/order-1',
      })),
      cancelDelivery: jest.fn(),
      getDeliveryStatus: jest.fn(),
    };
    const integration = {
      id: 'integration-1',
      business_id: 'business-1',
      provider: 'swiggy',
      is_active: true,
      total_deliveries: 0,
      failure_count: 1,
      last_error: 'Previous provider outage',
    };
    const tracking = {
      id: 'tracking-1',
      delivery_integration_id: 'integration-1',
      order_id: 'order-1',
      provider: 'swiggy',
      status: 'failed',
      attempt_count: 1,
      error_message: 'Previous provider outage',
      cancellation_reason: 'stale cancellation reason',
      status_history: [
        {
          status: 'failed',
          timestamp: new Date('2026-06-21T09:55:00.000Z'),
          message: 'Previous provider outage',
        },
      ],
    };
    const integrationRepository = createDeliveryRepository<any>([integration]);
    const trackingRepository = createDeliveryRepository<any>([tracking]);
    const service = new DeliveryService(new Map([['swiggy', fakeProvider]]), {
      integrationRepository: integrationRepository as any,
      trackingRepository: trackingRepository as any,
      ratingRepository: createDeliveryRepository() as any,
      orderRepository: createDeliveryRepository() as any,
    }, { enforceCapability: false });

    await (service as any).attemptDeliveryCreation(tracking, {
      id: 'order-1',
      business_id: 'business-1',
    }, integration);

    expect(fakeProvider.createDelivery).toHaveBeenCalledTimes(1);
    expect(tracking).toMatchObject({
      status: 'assigned',
      delivery_partner_id: 'partner-1',
      estimated_pickup_at: estimatedPickupAt,
      estimated_delivery_at: estimatedDeliveryAt,
      delivery_fee_cents: 4500,
      tracking_url: 'https://tracking.example.com/orders/order-1',
      error_message: null,
      cancellation_reason: null,
    });
    expect(integration).toMatchObject({
      total_deliveries: 1,
      failure_count: 1,
      last_error: null,
    });
    expect(trackingRepository.save).toHaveBeenLastCalledWith(
      expect.objectContaining({
        status: 'assigned',
        error_message: null,
        cancellation_reason: null,
      })
    );
  });

  it('clears stale delivery assignment evidence when a retried creation fails', async () => {
    const fakeProvider = {
      provider: 'swiggy' as const,
      createDelivery: jest.fn(async () => ({
        success: false,
        error: 'Partner temporarily unavailable',
      })),
      cancelDelivery: jest.fn(),
      getDeliveryStatus: jest.fn(),
    };
    const integration = {
      id: 'integration-1',
      business_id: 'business-1',
      provider: 'swiggy',
      is_active: true,
      total_deliveries: 1,
      failure_count: 0,
      last_error: null,
    };
    const tracking = {
      id: 'tracking-1',
      delivery_integration_id: 'integration-1',
      order_id: 'order-1',
      provider: 'swiggy',
      status: 'assigned',
      delivery_partner_id: 'stale-partner',
      delivery_person_name: 'Stale Rider',
      delivery_person_phone: '+15555550123',
      estimated_pickup_at: new Date('2026-06-21T10:00:00.000Z'),
      picked_up_at: new Date('2026-06-21T10:05:00.000Z'),
      estimated_delivery_at: new Date('2026-06-21T10:30:00.000Z'),
      delivered_at: new Date('2026-06-21T10:25:00.000Z'),
      delivery_fee_cents: 4500,
      tracking_url: 'https://tracking.example.com/orders/order-1',
      cancellation_reason: 'stale cancellation reason',
      delivery_otp: '123456',
      attempt_count: 1,
      status_history: [
        {
          status: 'assigned',
          timestamp: new Date('2026-06-21T09:55:00.000Z'),
          message: 'Delivery assigned successfully',
        },
      ],
    };
    const integrationRepository = createDeliveryRepository<any>([integration]);
    const trackingRepository = createDeliveryRepository<any>([tracking]);
    const service = new DeliveryService(new Map([['swiggy', fakeProvider]]), {
      integrationRepository: integrationRepository as any,
      trackingRepository: trackingRepository as any,
      ratingRepository: createDeliveryRepository() as any,
      orderRepository: createDeliveryRepository() as any,
    }, { enforceCapability: false });

    await (service as any).attemptDeliveryCreation(tracking, {
      id: 'order-1',
      business_id: 'business-1',
    }, integration);

    expect(fakeProvider.createDelivery).toHaveBeenCalledTimes(1);
    expect(tracking).toMatchObject({
      status: 'failed',
      error_message: 'Partner temporarily unavailable',
      delivery_partner_id: null,
      delivery_person_name: null,
      delivery_person_phone: null,
      estimated_pickup_at: null,
      picked_up_at: null,
      estimated_delivery_at: null,
      delivered_at: null,
      delivery_fee_cents: null,
      tracking_url: null,
      cancellation_reason: null,
      delivery_otp: null,
      attempt_count: 2,
    });
    expect(integration).toMatchObject({
      total_deliveries: 1,
      failure_count: 1,
      last_error: 'Partner temporarily unavailable',
    });
    expect(trackingRepository.save).toHaveBeenLastCalledWith(
      expect.objectContaining({
        status: 'failed',
        error_message: 'Partner temporarily unavailable',
        delivery_partner_id: null,
        tracking_url: null,
      })
    );
  });
});

describe('calculateDeliveryStats', () => {
  it('calculates rounded delivery success and rating metrics from recorded rows only', () => {
    expect(
      calculateDeliveryStats(
        [
          { status: 'delivered' },
          { status: 'delivered' },
          { status: 'cancelled' },
          { status: 'failed' },
        ] as any[],
        [{ rating: 5 }, { rating: 4 }] as any[]
      )
    ).toEqual({
      total_deliveries: 4,
      successful_deliveries: 2,
      cancelled_deliveries: 1,
      failed_deliveries: 1,
      average_rating: 4.5,
      success_rate: 50,
    });
  });

  it('aggregates delivery stats from normalized persisted statuses', () => {
    expect(
      calculateDeliveryStats(
        [
          { status: ' delivered ' },
          { status: ' cancelled ' },
          { status: ' failed ' },
        ] as any[],
        [{ rating: 5 }] as any[]
      )
    ).toEqual({
      total_deliveries: 3,
      successful_deliveries: 1,
      cancelled_deliveries: 1,
      failed_deliveries: 1,
      average_rating: 5,
      success_rate: 33.3,
    });
  });

  it('returns explicit zero metrics when no delivery rows exist', () => {
    expect(calculateDeliveryStats([], [])).toEqual({
      total_deliveries: 0,
      successful_deliveries: 0,
      cancelled_deliveries: 0,
      failed_deliveries: 0,
      average_rating: 0,
      success_rate: 0,
    });
  });

  it('rejects impossible delivery rating evidence before returning metrics', () => {
    expect(() =>
      calculateDeliveryStats(
        [{ status: 'delivered' }, { status: 'cancelled' }] as any[],
        [{ rating: 5 }, { rating: 4 }] as any[]
      )
    ).toThrow('Delivery rating count cannot exceed delivered deliveries');

    expect(() =>
      calculateDeliveryStats(
        [] as any[],
        [{ rating: 5 }] as any[]
      )
    ).toThrow('Delivery rating count cannot exceed delivered deliveries');
  });

  it('rejects corrupt persisted delivery statuses before returning metrics', () => {
    expect(() =>
      calculateDeliveryStats(
        [
          { status: 'delivered' },
          { status: 'teleported' },
        ] as any[],
        [{ rating: 5 }] as any[]
      )
    ).toThrow('Delivery tracking row 2 has an invalid status');
  });

  it('rejects corrupt persisted delivery ratings before returning metrics', () => {
    expect(() =>
      calculateDeliveryStats(
        [{ status: 'delivered' }] as any[],
        [
          { rating: 5 },
          { rating: 6 },
        ] as any[]
      )
    ).toThrow('Delivery rating row 2 must be between 1 and 5');

    expect(() =>
      calculateDeliveryStats(
        [{ status: 'delivered' }] as any[],
        [{ rating: undefined }] as any[]
      )
    ).toThrow('Delivery rating row 1 must be between 1 and 5');
  });

  it('rejects malformed delivery metric row envelopes before returning metrics', () => {
    expect(() =>
      calculateDeliveryStats([[]] as any[], [{ rating: 5 }] as any[])
    ).toThrow('Delivery tracking row 1 must be an object');

    expect(() =>
      calculateDeliveryStats([{ status: 'delivered' }] as any[], [[]] as any[])
    ).toThrow('Delivery rating row 1 must be an object');
  });

  it('rejects unsupported or unsafe delivery metric row fields before returning metrics', () => {
    expect(() =>
      calculateDeliveryStats(
        [{ status: 'delivered', provider_trace_id: 'trace-1' }] as any[],
        [{ rating: 5 }] as any[]
      )
    ).toThrow('Delivery tracking row 1 include unsupported field(s): provider_trace_id');

    expect(() =>
      calculateDeliveryStats(
        [{ status: 'delivered' }] as any[],
        [{ rating: 5, provider_trace_id: 'trace-1' }] as any[]
      )
    ).toThrow('Delivery rating row 1 include unsupported field(s): provider_trace_id');

    expect(() =>
      calculateDeliveryStats(
        [{ ['status\uFEFF']: 'delivered' }] as any[],
        [{ rating: 5 }] as any[]
      )
    ).toThrow('Delivery tracking row 1 field names must not include unsafe control characters');
  });
});

describe('delivery status transitions', () => {
  it('allows forward delivery progress and exception transitions to cancelled or failed', () => {
    expect(canTransitionDeliveryStatus('pending', 'assigned')).toBe(true);
    expect(canTransitionDeliveryStatus('assigned', 'picked_up')).toBe(true);
    expect(canTransitionDeliveryStatus('picked_up', 'en_route')).toBe(true);
    expect(canTransitionDeliveryStatus('en_route', 'delivered')).toBe(true);
    expect(canTransitionDeliveryStatus('assigned', 'cancelled')).toBe(true);
    expect(canTransitionDeliveryStatus('en_route', 'failed')).toBe(true);
  });

  it('rejects backward transitions and transitions away from terminal states', () => {
    expect(canTransitionDeliveryStatus('en_route', 'assigned')).toBe(false);
    expect(canTransitionDeliveryStatus('picked_up', 'pending')).toBe(false);
    expect(canTransitionDeliveryStatus('delivered', 'failed')).toBe(false);
    expect(canTransitionDeliveryStatus('cancelled', 'assigned')).toBe(false);
    expect(canTransitionDeliveryStatus('failed', 'en_route')).toBe(false);
  });

  it('rejects malformed delivery status values before transition logic can accept them', () => {
    expect(() => canTransitionDeliveryStatus('assigned', 'teleported' as any))
      .toThrow('Next delivery status has an invalid status');

    expect(() => canTransitionDeliveryStatus('teleported' as any, 'assigned'))
      .toThrow('Current delivery status has an invalid status');
  });

  it('applies status details and records one audit entry for a new status', () => {
    const tracking: any = {
      id: 'tracking-1',
      status: 'assigned',
      status_history: [{ status: 'assigned', timestamp: new Date('2026-06-21T00:00:00.000Z') }],
    };

    applyDeliveryStatusUpdate(
      tracking,
      'picked_up',
      {
        delivery_person_name: 'Rider One',
        delivery_person_phone: '+15551234567',
        picked_up_at: new Date('2026-06-21T00:10:00.000Z'),
        message: 'Picked up from counter',
        timestamp: new Date('2026-06-21T00:10:01.000Z'),
      },
      new Date('2026-06-21T00:10:02.000Z')
    );

    expect(tracking).toMatchObject({
      status: 'picked_up',
      delivery_person_name: 'Rider One',
      delivery_person_phone: '+15551234567',
      picked_up_at: new Date('2026-06-21T00:10:00.000Z'),
    });
    expect(tracking.status_history).toEqual([
      { status: 'assigned', timestamp: new Date('2026-06-21T00:00:00.000Z') },
      {
        status: 'picked_up',
        timestamp: new Date('2026-06-21T00:10:01.000Z'),
        message: 'Picked up from counter',
      },
    ]);
  });

  it('normalizes provider status detail strings before persisting tracking audit state', () => {
    const tracking: any = {
      id: 'tracking-1',
      status: 'assigned',
      status_history: [{ status: 'assigned', timestamp: new Date('2026-06-21T00:00:00.000Z') }],
    };

    applyDeliveryStatusUpdate(
      tracking,
      'picked_up',
      {
        delivery_person_name: ' Rider One ',
        delivery_person_phone: ' +15551234567 ',
        picked_up_at: new Date('2026-06-21T00:10:00.000Z'),
        message: ' Picked up from counter ',
        timestamp: new Date('2026-06-21T00:10:01.000Z'),
      },
      new Date('2026-06-21T00:10:02.000Z')
    );

    expect(tracking.delivery_person_name).toBe('Rider One');
    expect(tracking.delivery_person_phone).toBe('+15551234567');
    expect(tracking.picked_up_at).toEqual(new Date('2026-06-21T00:10:00.000Z'));
    expect(tracking.status_history[1]).toMatchObject({
      status: 'picked_up',
      message: 'Picked up from counter',
    });
  });

  it('rejects blank provider status detail strings before mutating tracking audit state', () => {
    const tracking: any = {
      id: 'tracking-1',
      status: 'assigned',
      delivery_person_name: 'Existing Rider',
      status_history: [{ status: 'assigned', timestamp: new Date('2026-06-21T00:00:00.000Z') }],
    };

    expect(() =>
      applyDeliveryStatusUpdate(tracking, 'picked_up', {
        delivery_person_name: '   ',
        message: 'Picked up',
        timestamp: new Date('2026-06-21T00:10:01.000Z'),
      })
    ).toThrow('Delivery person name must be a non-empty string');

    expect(() =>
      applyDeliveryStatusUpdate(tracking, 'picked_up', {
        delivery_person_phone: '   ',
        message: 'Picked up',
        timestamp: new Date('2026-06-21T00:10:01.000Z'),
      })
    ).toThrow('Delivery person phone must be a non-empty string');

    expect(() =>
      applyDeliveryStatusUpdate(tracking, 'picked_up', {
        message: '   ',
        timestamp: new Date('2026-06-21T00:10:01.000Z'),
      })
    ).toThrow('Delivery status message must be a non-empty string');

    expect(tracking).toEqual({
      id: 'tracking-1',
      status: 'assigned',
      delivery_person_name: 'Existing Rider',
      status_history: [{ status: 'assigned', timestamp: new Date('2026-06-21T00:00:00.000Z') }],
    });
  });

  it('rejects unsafe provider status detail controls before mutating tracking audit state', () => {
    const tracking: any = {
      id: 'tracking-1',
      status: 'assigned',
      delivery_person_name: 'Existing Rider',
      status_history: [{ status: 'assigned', timestamp: new Date('2026-06-21T00:00:00.000Z') }],
    };

    expect(() =>
      applyDeliveryStatusUpdate(tracking, 'picked_up', {
        delivery_person_name: 'Rider\u0000One',
        message: 'Picked up',
        timestamp: new Date('2026-06-21T00:10:01.000Z'),
      })
    ).toThrow('Delivery person name must not include unsafe control characters');

    expect(() =>
      applyDeliveryStatusUpdate(tracking, 'picked_up', {
        delivery_person_name: 'Rider\u202EOne',
        message: 'Picked up',
        timestamp: new Date('2026-06-21T00:10:01.000Z'),
      })
    ).toThrow('Delivery person name must not include unsafe control characters');

    expect(() =>
      applyDeliveryStatusUpdate(tracking, 'picked_up', {
        delivery_person_name: '\uFEFFRider One',
        message: 'Picked up',
        timestamp: new Date('2026-06-21T00:10:01.000Z'),
      })
    ).toThrow('Delivery person name must not include unsafe control characters');

    expect(() =>
      applyDeliveryStatusUpdate(tracking, 'picked_up', {
        delivery_person_phone: '+1555\u00071234567',
        message: 'Picked up',
        timestamp: new Date('2026-06-21T00:10:01.000Z'),
      })
    ).toThrow('Delivery person phone must not include unsafe control characters');

    expect(() =>
      applyDeliveryStatusUpdate(tracking, 'picked_up', {
        delivery_person_phone: '+1555\u200B1234567',
        message: 'Picked up',
        timestamp: new Date('2026-06-21T00:10:01.000Z'),
      })
    ).toThrow('Delivery person phone must not include unsafe control characters');

    expect(() =>
      applyDeliveryStatusUpdate(tracking, 'picked_up', {
        delivery_person_phone: '+15551234567\uFEFF',
        message: 'Picked up',
        timestamp: new Date('2026-06-21T00:10:01.000Z'),
      })
    ).toThrow('Delivery person phone must not include unsafe control characters');

    expect(() =>
      applyDeliveryStatusUpdate(tracking, 'picked_up', {
        message: 'Picked up\u007Ffrom counter',
        timestamp: new Date('2026-06-21T00:10:01.000Z'),
      })
    ).toThrow('Delivery status message must not include unsafe control characters');

    expect(() =>
      applyDeliveryStatusUpdate(tracking, 'picked_up', {
        message: 'Picked up\u2060from counter',
        timestamp: new Date('2026-06-21T00:10:01.000Z'),
      })
    ).toThrow('Delivery status message must not include unsafe control characters');

    expect(() =>
      applyDeliveryStatusUpdate(tracking, 'picked_up', {
        message: '\uFEFFPicked up from counter',
        timestamp: new Date('2026-06-21T00:10:01.000Z'),
      })
    ).toThrow('Delivery status message must not include unsafe control characters');

    expect(tracking).toEqual({
      id: 'tracking-1',
      status: 'assigned',
      delivery_person_name: 'Existing Rider',
      status_history: [{ status: 'assigned', timestamp: new Date('2026-06-21T00:00:00.000Z') }],
    });
  });

  it('rejects malformed provider status detail payloads before mutating delivery status history', () => {
    const tracking: any = {
      id: 'tracking-1',
      status: 'assigned',
      status_history: [{ status: 'assigned', timestamp: new Date('2026-06-21T00:00:00.000Z') }],
    };

    expect(() =>
      applyDeliveryStatusUpdate(tracking, 'picked_up', null as any)
    ).toThrow('Delivery status update details must be an object');

    expect(() =>
      applyDeliveryStatusUpdate(tracking, 'picked_up', [] as any)
    ).toThrow('Delivery status update details must be an object');

    expect(() =>
      applyDeliveryStatusUpdate(tracking, 'picked_up', {
        message: 'Picked up',
        provider_trace_id: 'trace-1',
      } as any)
    ).toThrow('Delivery status update details include unsupported field(s): provider_trace_id');

    expect(() =>
      applyDeliveryStatusUpdate(tracking, 'picked_up', {
        message: 'Picked up',
        ['provider_trace_id\uFEFF']: 'trace-1',
      } as any)
    ).toThrow('Delivery status update details field names must not include unsafe control characters');

    expect(tracking).toEqual({
      id: 'tracking-1',
      status: 'assigned',
      status_history: [{ status: 'assigned', timestamp: new Date('2026-06-21T00:00:00.000Z') }],
    });
  });

  it('does not append duplicate audit entries or mutate details for replayed same-status updates', () => {
    const tracking: any = {
      id: 'tracking-1',
      status: 'en_route',
      delivery_person_name: 'Rider One',
      picked_up_at: new Date('2026-06-21T00:10:00.000Z'),
      status_history: [
        {
          status: 'en_route',
          timestamp: new Date('2026-06-21T00:20:00.000Z'),
          message: 'On the way',
        },
      ],
    };

    applyDeliveryStatusUpdate(tracking, 'en_route', {
      delivery_person_name: 'Rider One',
    });

    expect(tracking.status_history).toHaveLength(1);
    expect(tracking.delivery_person_name).toBe('Rider One');
    expect(tracking.status_history[0].message).toBe('On the way');
  });

  it('rejects conflicting same-status provider replays before mutating delivery details', () => {
    const tracking: any = {
      id: 'tracking-1',
      status: 'picked_up',
      delivery_person_name: 'Rider One',
      picked_up_at: new Date('2026-06-21T00:10:00.000Z'),
      status_history: [
        {
          status: 'picked_up',
          timestamp: new Date('2026-06-21T00:10:01.000Z'),
          message: 'Picked up from counter',
        },
      ],
    };

    expect(() =>
      applyDeliveryStatusUpdate(tracking, 'picked_up', {
        delivery_person_name: 'Rider Two',
        picked_up_at: new Date('2026-06-21T00:12:00.000Z'),
        message: 'Changed pickup detail',
        timestamp: new Date('2026-06-21T00:12:01.000Z'),
      })
    ).toThrow('Delivery person name cannot be changed by replayed delivery status');

    expect(tracking).toEqual({
      id: 'tracking-1',
      status: 'picked_up',
      delivery_person_name: 'Rider One',
      picked_up_at: new Date('2026-06-21T00:10:00.000Z'),
      status_history: [
        {
          status: 'picked_up',
          timestamp: new Date('2026-06-21T00:10:01.000Z'),
          message: 'Picked up from counter',
        },
      ],
    });
  });

  it('rejects malformed provider status updates before mutating delivery status history', () => {
    const tracking: any = {
      id: 'tracking-1',
      status: 'assigned',
      status_history: [{ status: 'assigned', timestamp: new Date('2026-06-21T00:00:00.000Z') }],
    };

    expect(() =>
      applyDeliveryStatusUpdate(tracking, 'teleported' as any, {
        message: 'Provider sent an unknown state',
        timestamp: new Date('2026-06-21T00:05:00.000Z'),
      })
    ).toThrow('Next delivery status has an invalid status');

    expect(tracking).toEqual({
      id: 'tracking-1',
      status: 'assigned',
      status_history: [{ status: 'assigned', timestamp: new Date('2026-06-21T00:00:00.000Z') }],
    });
  });

  it('rejects malformed provider timestamps before mutating delivery status history', () => {
    const tracking: any = {
      id: 'tracking-1',
      status: 'assigned',
      status_history: [{ status: 'assigned', timestamp: new Date('2026-06-21T00:00:00.000Z') }],
    };

    expect(() =>
      applyDeliveryStatusUpdate(tracking, 'picked_up', {
        delivery_person_name: 'Rider One',
        picked_up_at: new Date('not-a-provider-date'),
        message: 'Picked up',
      })
    ).toThrow('Picked-up timestamp must be a valid Date');

    expect(tracking).toEqual({
      id: 'tracking-1',
      status: 'assigned',
      status_history: [{ status: 'assigned', timestamp: new Date('2026-06-21T00:00:00.000Z') }],
    });
  });

  it('rejects impossible pickup and delivery chronology before mutating tracking rows', () => {
    const tracking: any = {
      id: 'tracking-1',
      status: 'picked_up',
      picked_up_at: new Date('2026-06-21T00:20:00.000Z'),
      status_history: [{ status: 'picked_up', timestamp: new Date('2026-06-21T00:20:00.000Z') }],
    };

    expect(() =>
      applyDeliveryStatusUpdate(tracking, 'delivered', {
        delivered_at: new Date('2026-06-21T00:10:00.000Z'),
        timestamp: new Date('2026-06-21T00:30:00.000Z'),
      })
    ).toThrow('Delivered timestamp must not be before picked-up timestamp');

    expect(tracking).toEqual({
      id: 'tracking-1',
      status: 'picked_up',
      picked_up_at: new Date('2026-06-21T00:20:00.000Z'),
      status_history: [{ status: 'picked_up', timestamp: new Date('2026-06-21T00:20:00.000Z') }],
    });
  });

  it('rejects stale provider history timestamps before mutating tracking rows', () => {
    const trackingWithLaterHistory: any = {
      id: 'tracking-1',
      status: 'assigned',
      status_history: [{ status: 'assigned', timestamp: new Date('2026-06-21T00:20:00.000Z') }],
    };

    expect(() =>
      applyDeliveryStatusUpdate(trackingWithLaterHistory, 'cancelled', {
        message: 'Customer cancelled',
        timestamp: new Date('2026-06-21T00:10:00.000Z'),
      })
    ).toThrow('Status history timestamp cannot be before previous delivery status');

    expect(trackingWithLaterHistory).toEqual({
      id: 'tracking-1',
      status: 'assigned',
      status_history: [{ status: 'assigned', timestamp: new Date('2026-06-21T00:20:00.000Z') }],
    });

    const trackingWithFutureHistory: any = {
      id: 'tracking-future-history',
      status: 'assigned',
      status_history: [{ status: 'assigned', timestamp: new Date('2026-06-21T00:00:00.000Z') }],
    };

    expect(() =>
      applyDeliveryStatusUpdate(
        trackingWithFutureHistory,
        'cancelled',
        {
          message: 'Future provider callback',
          timestamp: new Date('2026-06-21T00:30:01.000Z'),
        },
        new Date('2026-06-21T00:30:00.000Z')
      )
    ).toThrow('Status history timestamp cannot be after processing time');

    expect(trackingWithFutureHistory).toEqual({
      id: 'tracking-future-history',
      status: 'assigned',
      status_history: [{ status: 'assigned', timestamp: new Date('2026-06-21T00:00:00.000Z') }],
    });

    const trackingWithPickupEvidence: any = {
      id: 'tracking-2',
      status: 'assigned',
      status_history: [{ status: 'assigned', timestamp: new Date('2026-06-21T00:00:00.000Z') }],
    };

    expect(() =>
      applyDeliveryStatusUpdate(trackingWithPickupEvidence, 'picked_up', {
        picked_up_at: new Date('2026-06-21T00:15:00.000Z'),
        timestamp: new Date('2026-06-21T00:14:59.000Z'),
      })
    ).toThrow('Status history timestamp cannot be before picked-up timestamp');

    expect(trackingWithPickupEvidence).toEqual({
      id: 'tracking-2',
      status: 'assigned',
      status_history: [{ status: 'assigned', timestamp: new Date('2026-06-21T00:00:00.000Z') }],
    });

    const trackingWithDeliveryEvidence: any = {
      id: 'tracking-3',
      status: 'en_route',
      picked_up_at: new Date('2026-06-21T00:10:00.000Z'),
      status_history: [{ status: 'en_route', timestamp: new Date('2026-06-21T00:20:00.000Z') }],
    };

    expect(() =>
      applyDeliveryStatusUpdate(trackingWithDeliveryEvidence, 'delivered', {
        delivered_at: new Date('2026-06-21T00:30:00.000Z'),
        timestamp: new Date('2026-06-21T00:29:59.000Z'),
      })
    ).toThrow('Status history timestamp cannot be before delivered timestamp');

    expect(trackingWithDeliveryEvidence).toEqual({
      id: 'tracking-3',
      status: 'en_route',
      picked_up_at: new Date('2026-06-21T00:10:00.000Z'),
      status_history: [{ status: 'en_route', timestamp: new Date('2026-06-21T00:20:00.000Z') }],
    });
  });

  it('blocks stale provider callbacks after terminal delivery status', async () => {
    const service = new DeliveryService(new Map(), {
      integrationRepository: createDeliveryRepository() as any,
      trackingRepository: createDeliveryRepository<any>([
        {
          id: 'tracking-1',
          delivery_integration_id: 'integration-1',
          order_id: 'order-1',
          provider: 'swiggy',
          status: 'delivered',
          delivery_partner_id: 'partner-1',
          attempt_count: 1,
          picked_up_at: new Date('2026-06-21T00:10:00.000Z'),
          delivered_at: new Date('2026-06-21T00:30:00.000Z'),
          status_history: [
            { status: 'delivered', timestamp: new Date('2026-06-21T00:30:00.000Z') },
          ],
        },
      ]) as any,
      ratingRepository: createDeliveryRepository() as any,
      orderRepository: createDeliveryRepository() as any,
    }, { enforceCapability: false });

    await expect(service.updateDeliveryStatus('tracking-1', 'en_route')).rejects.toThrow(
      'Cannot transition delivery status from delivered to en_route'
    );
  });

  it('blocks cancellation of terminal deliveries before calling the provider', async () => {
    const fakeProvider = {
      provider: 'swiggy' as const,
      createDelivery: jest.fn(),
      cancelDelivery: jest.fn(async () => ({ success: true })),
      getDeliveryStatus: jest.fn(),
    };
    const trackingRepository = createDeliveryRepository<any>([
      {
        id: 'tracking-1',
        delivery_integration_id: 'integration-1',
        order_id: 'order-1',
        provider: 'swiggy',
        delivery_partner_id: 'partner-1',
        delivery_integration: {
          id: 'integration-1',
          business_id: 'business-1',
          provider: 'swiggy',
          cost_handling: 'customer',
        },
        status: 'delivered',
        attempt_count: 1,
        picked_up_at: new Date('2026-06-21T00:10:00.000Z'),
        delivered_at: new Date('2026-06-21T00:30:00.000Z'),
        status_history: [
          { status: 'delivered', timestamp: new Date('2026-06-21T00:30:00.000Z') },
        ],
      },
    ]);
    const service = new DeliveryService(new Map([['swiggy', fakeProvider]]), {
      integrationRepository: createDeliveryRepository() as any,
      trackingRepository: trackingRepository as any,
      ratingRepository: createDeliveryRepository() as any,
      orderRepository: createDeliveryRepository() as any,
    }, { enforceCapability: false });

    await expect(service.cancelDelivery('tracking-1', 'customer request')).rejects.toThrow(
      'Cannot transition delivery status from delivered to cancelled'
    );

    expect(fakeProvider.cancelDelivery).not.toHaveBeenCalled();
    expect(trackingRepository.save).not.toHaveBeenCalled();
  });

  it('rejects cancellation when tracking is missing its integration relation before calling the provider', async () => {
    const fakeProvider = {
      provider: 'swiggy' as const,
      createDelivery: jest.fn(),
      cancelDelivery: jest.fn(async () => ({ success: true })),
      getDeliveryStatus: jest.fn(),
    };
    const trackingRepository = createDeliveryRepository<any>([
      {
        id: 'tracking-missing-integration',
        delivery_integration_id: 'integration-1',
        order_id: 'order-1',
        provider: 'swiggy',
        delivery_partner_id: 'partner-1',
        status: 'assigned',
        attempt_count: 1,
        status_history: [],
      },
    ]);
    const service = new DeliveryService(new Map([['swiggy', fakeProvider]]), {
      integrationRepository: createDeliveryRepository() as any,
      trackingRepository: trackingRepository as any,
      ratingRepository: createDeliveryRepository() as any,
      orderRepository: createDeliveryRepository() as any,
    }, { enforceCapability: false });

    await expect(
      service.cancelDelivery('tracking-missing-integration', 'customer request')
    ).rejects.toThrow('Delivery integration relation is required before cancellation');

    expect(fakeProvider.cancelDelivery).not.toHaveBeenCalled();
    expect(trackingRepository.save).not.toHaveBeenCalled();
  });

  it('rejects malformed provider cancellation responses before tracking mutation', async () => {
    const malformedProviderResponses = [
      {
        response: null,
        expectedError: 'Delivery provider cancellation response must be an object',
      },
      {
        response: { success: 'yes' },
        expectedError: 'Delivery provider cancellation response success must be a boolean',
      },
      {
        response: { success: true, error: 'partner warning' },
        expectedError: 'Delivery provider cancellation success response error cannot be present',
      },
      {
        response: { success: true, provider_trace_id: 'trace-1' },
        expectedError: 'Delivery provider cancellation response includes unsupported field(s): provider_trace_id',
      },
      {
        response: { success: true, 'provider_trace_id\uFEFF': 'trace-1' },
        expectedError:
          'Delivery provider cancellation response field names must not include unsafe control characters',
      },
      {
        response: { success: false },
        expectedError: 'Delivery provider cancellation failure response must include error',
      },
      {
        response: { success: false, error: '   ' },
        expectedError: 'Delivery provider cancellation response error must be a non-empty string',
      },
      {
        response: { success: false, error: `provider-${'x'.repeat(1001)}` },
        expectedError: 'Delivery provider cancellation response error must be at most 1000 characters',
      },
      {
        response: {
          success: false,
          error: 'partner rejected',
          provider_trace_id: 'trace-1',
        },
        expectedError: 'Delivery provider cancellation response includes unsupported field(s): provider_trace_id',
      },
      {
        response: {
          success: false,
          error: 'partner rejected',
          delivery_partner_id: 'partner-1',
        },
        expectedError:
          'Delivery provider cancellation failure response cannot include success field(s): delivery_partner_id',
      },
      {
        response: {
          success: false,
          error: 'partner rejected',
          delivery_partner_id: 'partner-1',
          order_id: 'order-1',
          business_id: 'business-1',
          delivery_integration_id: 'integration-1',
        },
        expectedError:
          'Delivery provider cancellation failure response cannot include success field(s): delivery_partner_id, order_id, business_id, delivery_integration_id',
      },
    ];

    for (const { response, expectedError } of malformedProviderResponses) {
      const fakeProvider = {
        provider: 'swiggy' as const,
        createDelivery: jest.fn(),
        cancelDelivery: jest.fn(async () => response),
        getDeliveryStatus: jest.fn(),
      };
      const trackingRepository = createDeliveryRepository<any>([
        {
          id: 'tracking-1',
          delivery_integration_id: 'integration-1',
          order_id: 'order-1',
          provider: 'swiggy',
          delivery_partner_id: 'partner-1',
          delivery_integration: {
            id: 'integration-1',
            business_id: 'business-1',
            provider: 'swiggy',
            cost_handling: 'customer',
          },
          status: 'assigned',
          attempt_count: 1,
          status_history: [{ status: 'assigned', timestamp: new Date('2026-06-21T00:00:00.000Z') }],
        },
      ]);
      const service = new DeliveryService(new Map([['swiggy', fakeProvider as any]]), {
        integrationRepository: createDeliveryRepository() as any,
        trackingRepository: trackingRepository as any,
        ratingRepository: createDeliveryRepository() as any,
        orderRepository: createDeliveryRepository() as any,
      }, { enforceCapability: false });

      await expect(service.cancelDelivery('tracking-1', 'customer request')).rejects.toThrow(expectedError);

      expect(fakeProvider.cancelDelivery).toHaveBeenCalledWith('partner-1', {
        id: 'integration-1',
        business_id: 'business-1',
        provider: 'swiggy',
        cost_handling: 'customer',
      });
      expect(trackingRepository.save).not.toHaveBeenCalled();
      expect(trackingRepository.rows[0]).toMatchObject({
        status: 'assigned',
        status_history: [{ status: 'assigned', timestamp: new Date('2026-06-21T00:00:00.000Z') }],
      });
      expect(trackingRepository.rows[0].cancellation_reason).toBeUndefined();
    }
  });

  it.each([
    [
      'partner id',
      { delivery_partner_id: 'partner-elsewhere' },
      'Delivery provider cancellation response delivery_partner_id must match requested partner',
    ],
    [
      'order id',
      { order_id: 'order-elsewhere' },
      'Delivery provider cancellation response order_id must match tracking order',
    ],
    [
      'business id',
      { business_id: 'business-elsewhere' },
      'Delivery provider cancellation response business_id must match tracking integration business',
    ],
    [
      'integration id',
      { delivery_integration_id: 'integration-elsewhere' },
      'Delivery provider cancellation response delivery_integration_id must match tracking integration',
    ],
  ])('rejects mismatched provider cancellation %s evidence before tracking mutation', async (
    _caseName,
    responseEvidence,
    expectedError
  ) => {
    const fakeProvider = {
      provider: 'swiggy' as const,
      createDelivery: jest.fn(),
      cancelDelivery: jest.fn(async () => ({
        success: true,
        ...responseEvidence,
      })),
      getDeliveryStatus: jest.fn(),
    };
    const trackingRepository = createDeliveryRepository<any>([
      {
        id: 'tracking-1',
        delivery_integration_id: 'integration-1',
        order_id: 'order-1',
        provider: 'swiggy',
        delivery_partner_id: 'partner-1',
        delivery_integration: {
          id: 'integration-1',
          business_id: 'business-1',
          provider: 'swiggy',
          cost_handling: 'customer',
        },
        status: 'assigned',
        attempt_count: 1,
        status_history: [{ status: 'assigned', timestamp: new Date('2026-06-21T00:00:00.000Z') }],
      },
    ]);
    const service = new DeliveryService(new Map([['swiggy', fakeProvider as any]]), {
      integrationRepository: createDeliveryRepository() as any,
      trackingRepository: trackingRepository as any,
      ratingRepository: createDeliveryRepository() as any,
      orderRepository: createDeliveryRepository() as any,
    }, { enforceCapability: false });

    await expect(service.cancelDelivery('tracking-1', 'customer request')).rejects.toThrow(expectedError);

    expect(fakeProvider.cancelDelivery).toHaveBeenCalledWith('partner-1', {
      id: 'integration-1',
      business_id: 'business-1',
      provider: 'swiggy',
      cost_handling: 'customer',
    });
    expect(trackingRepository.save).not.toHaveBeenCalled();
    expect(trackingRepository.rows[0]).toMatchObject({
      status: 'assigned',
      status_history: [{ status: 'assigned', timestamp: new Date('2026-06-21T00:00:00.000Z') }],
    });
    expect(trackingRepository.rows[0].cancellation_reason).toBeUndefined();
  });

  it.each([
    [
      'partner id',
      'delivery_partner_id',
      'Delivery provider cancellation response delivery_partner_id must be at most 255 characters',
    ],
    [
      'order id',
      'order_id',
      'Delivery provider cancellation response order_id must be at most 255 characters',
    ],
    [
      'business id',
      'business_id',
      'Delivery provider cancellation response business_id must be at most 255 characters',
    ],
    [
      'integration id',
      'delivery_integration_id',
      'Delivery provider cancellation response delivery_integration_id must be at most 255 characters',
    ],
  ])('rejects oversized provider cancellation %s evidence before tracking mutation', async (
    _caseName,
    evidenceField,
    expectedError
  ) => {
    const oversizedValue = 'x'.repeat(256);
    const trackingRow = {
      id: 'tracking-1',
      delivery_integration_id:
        evidenceField === 'delivery_integration_id' ? oversizedValue : 'integration-1',
      order_id: evidenceField === 'order_id' ? oversizedValue : 'order-1',
      provider: 'swiggy',
      delivery_partner_id:
        evidenceField === 'delivery_partner_id' ? oversizedValue : 'partner-1',
      delivery_integration: {
        id: evidenceField === 'delivery_integration_id' ? oversizedValue : 'integration-1',
        business_id: evidenceField === 'business_id' ? oversizedValue : 'business-1',
        provider: 'swiggy',
        cost_handling: 'customer',
      },
      status: 'assigned',
      attempt_count: 1,
      status_history: [{ status: 'assigned', timestamp: new Date('2026-06-21T00:00:00.000Z') }],
    };
    const fakeProvider = {
      provider: 'swiggy' as const,
      createDelivery: jest.fn(),
      cancelDelivery: jest.fn(async () => ({
        success: true,
        [evidenceField]: oversizedValue,
      })),
      getDeliveryStatus: jest.fn(),
    };
    const trackingRepository = createDeliveryRepository<any>([trackingRow]);
    const service = new DeliveryService(new Map([['swiggy', fakeProvider as any]]), {
      integrationRepository: createDeliveryRepository() as any,
      trackingRepository: trackingRepository as any,
      ratingRepository: createDeliveryRepository() as any,
      orderRepository: createDeliveryRepository() as any,
    }, { enforceCapability: false });

    await expect(service.cancelDelivery('tracking-1', 'customer request')).rejects.toThrow(expectedError);

    expect(trackingRepository.save).not.toHaveBeenCalled();
    expect(trackingRepository.rows[0]).toMatchObject({
      status: 'assigned',
      status_history: [{ status: 'assigned', timestamp: new Date('2026-06-21T00:00:00.000Z') }],
    });
    expect(trackingRepository.rows[0].cancellation_reason).toBeUndefined();
  });

  it('rejects blank cancellation reasons before repository or provider side effects', async () => {
    const fakeProvider = {
      provider: 'swiggy' as const,
      createDelivery: jest.fn(),
      cancelDelivery: jest.fn(async () => ({ success: true })),
      getDeliveryStatus: jest.fn(),
    };
    const trackingRepository = createDeliveryRepository<any>([
      {
        id: 'tracking-1',
        delivery_integration_id: 'integration-1',
        order_id: 'order-1',
        provider: 'swiggy',
        delivery_partner_id: 'partner-1',
        delivery_integration: {
          id: 'integration-1',
          business_id: 'business-1',
          provider: 'swiggy',
          cost_handling: 'customer',
        },
        status: 'assigned',
        attempt_count: 1,
        status_history: [],
      },
    ]);
    const service = new DeliveryService(new Map([['swiggy', fakeProvider]]), {
      integrationRepository: createDeliveryRepository() as any,
      trackingRepository: trackingRepository as any,
      ratingRepository: createDeliveryRepository() as any,
      orderRepository: createDeliveryRepository() as any,
    }, { enforceCapability: false });

    await expect(service.cancelDelivery('tracking-1', '   ')).rejects.toThrow(
      'Delivery cancellation reason must be a non-empty string'
    );

    expect(trackingRepository.findOne).not.toHaveBeenCalled();
    expect(fakeProvider.cancelDelivery).not.toHaveBeenCalled();
    expect(trackingRepository.save).not.toHaveBeenCalled();
  });

  it('normalizes cancellation reasons before tracking audit persistence', async () => {
    const fakeProvider = {
      provider: 'swiggy' as const,
      createDelivery: jest.fn(),
      cancelDelivery: jest.fn(async () => ({ success: true })),
      getDeliveryStatus: jest.fn(),
    };
    const trackingRepository = createDeliveryRepository<any>([
      {
        id: 'tracking-1',
        delivery_integration_id: 'integration-1',
        order_id: 'order-1',
        provider: 'swiggy',
        delivery_partner_id: 'partner-1',
        delivery_integration: {
          id: 'integration-1',
          business_id: 'business-1',
          provider: 'swiggy',
          cost_handling: 'customer',
        },
        status: 'assigned',
        attempt_count: 1,
        status_history: [{ status: 'assigned', timestamp: new Date('2026-06-21T00:00:00.000Z') }],
      },
    ]);
    const service = new DeliveryService(new Map([['swiggy', fakeProvider]]), {
      integrationRepository: createDeliveryRepository() as any,
      trackingRepository: trackingRepository as any,
      ratingRepository: createDeliveryRepository() as any,
      orderRepository: createDeliveryRepository() as any,
    }, { enforceCapability: false });

    const tracking = await service.cancelDelivery('tracking-1', ' customer request ');

    expect(tracking.cancellation_reason).toBe('customer request');
    expect(tracking.status_history).toEqual([
      { status: 'assigned', timestamp: new Date('2026-06-21T00:00:00.000Z') },
      expect.objectContaining({
        status: 'cancelled',
        message: 'Cancelled: customer request',
      }),
    ]);
    expect(fakeProvider.cancelDelivery).toHaveBeenCalledWith('partner-1', {
      id: 'integration-1',
      business_id: 'business-1',
      provider: 'swiggy',
      cost_handling: 'customer',
    });
    expect(trackingRepository.save).toHaveBeenCalledWith(expect.objectContaining({
      status: 'cancelled',
      cancellation_reason: 'customer request',
    }));
  });
});
