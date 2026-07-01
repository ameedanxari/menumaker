import { describe, expect, it, jest } from '@jest/globals';
import {
  DinePOSService,
  IPOSService,
  POSHttpClient,
  POSSyncService,
  POSSyncError,
  SquarePOSService,
  buildPOSOrderPayload,
} from '../src/services/POSSyncService';
import { FeatureUnavailableError } from '../src/config/capabilities';

const order: any = {
  id: 'order-1',
  business_id: 'business-1',
  customer_id: 'customer-1',
  currency: 'INR',
  items: [
    { dish_id: 'dish-1', dish_name: 'Idli', quantity: 2, unit_price_cents: 12000 },
  ],
};

const integration: any = {
  id: 'integration-1',
  business_id: 'business-1',
  provider: 'square',
  access_token: 'access-token',
  refresh_token: 'refresh-token',
  location_id: 'location-1',
  sync_customer_info: true,
  item_mapping: { 'dish-1': 'square-dish-1' },
  settings: { api_version: '2024-01-01' },
};

const completedAt = new Date('2026-06-27T03:00:00.000Z');
const nextRetryAt = new Date('2026-06-27T03:05:00.000Z');

function successfulPOSRequestPayload(overrides: Record<string, any> = {}) {
  return {
    ...buildPOSOrderPayload(order, integration),
    ...overrides,
  };
}

function cloneRow<T extends Record<string, any>>(row: T): T {
  return {
    ...row,
    token_expires_at: row.token_expires_at ? new Date(row.token_expires_at) : row.token_expires_at,
    next_retry_at: row.next_retry_at ? new Date(row.next_retry_at) : row.next_retry_at,
    completed_at: row.completed_at ? new Date(row.completed_at) : row.completed_at,
    created_at: row.created_at ? new Date(row.created_at) : row.created_at,
    updated_at: row.updated_at ? new Date(row.updated_at) : row.updated_at,
  };
}

function createMemoryRepository<T extends Record<string, any>>(initialRows: T[] = []) {
  const rows = initialRows.map((row) => cloneRow(row));
  let nextId = 1;

  const matchesWhere = (row: T, where: Record<string, any>) =>
    Object.entries(where).every(([key, value]) => row[key] === value);

  return {
    rows,
    create(input: Partial<T>) {
      return {
        id: `created-${nextId++}`,
        retry_count: 0,
        max_retries: 12,
        ...input,
      } as T;
    },
    async save(entity: T) {
      const existingIndex = rows.findIndex((row) => row.id === entity.id);
      const saved = cloneRow(entity);
      if (existingIndex >= 0) {
        rows[existingIndex] = saved;
      } else {
        rows.push(saved);
      }
      return cloneRow(saved);
    },
    async findOne(options: { where: Record<string, any> }) {
      const row = rows.find((candidate) => matchesWhere(candidate, options.where))
        ?? (
          options.where.business_id
            ? rows.find((candidate) =>
                candidate.business_id === options.where.business_id &&
                (options.where.is_active === undefined || candidate.is_active === options.where.is_active)
              )
            : undefined
        )
        ?? (
          options.where.id
            ? rows.find((candidate) => candidate.id === options.where.id)
            : undefined
        )
        ?? (
          options.where.business_id && rows.length === 1
            ? rows[0]
            : undefined
        );
      return row ? cloneRow(row) : null;
    },
    async find(options: { where: Record<string, any> }) {
      return rows.filter((candidate) => matchesWhere(candidate, options.where)).map((row) => cloneRow(row));
    },
    async findAndCount(options: { where: Record<string, any> }) {
      const found = rows.filter((candidate) => matchesWhere(candidate, options.where)).map((row) => cloneRow(row));
      return [found, found.length] as [T[], number];
    },
  };
}

function createPOSSyncHarness(options?: {
  service?: Partial<IPOSService>;
  integrationOverrides?: Record<string, any>;
  orders?: Array<Record<string, any>>;
}) {
  const integrationRepository = createMemoryRepository<any>([{
    ...integration,
    is_active: true,
    error_count: 0,
    last_error: null,
    ...options?.integrationOverrides,
  }]);
  const syncLogRepository = createMemoryRepository<any>();
  const orderRepository = createMemoryRepository<any>(options?.orders ?? [order]);
  const service: IPOSService = {
    provider: 'square',
    createOrder: jest.fn(async (orderToSync) => ({
      success: true,
      pos_order_id: `square-${orderToSync.id}`,
    })),
    refreshAccessToken: jest.fn(async () => ({
      access_token: 'fresh-access-token',
      refresh_token: 'fresh-refresh-token',
      expires_at: new Date(Date.now() + 60 * 60 * 1000),
    })),
    ...options?.service,
  };

  const services = new Map([['square', service]]) as Map<any, IPOSService>;
  const posSyncService = new POSSyncService(services, {
    integrationRepository: integrationRepository as any,
    syncLogRepository: syncLogRepository as any,
    orderRepository: orderRepository as any,
  }, { enforceCapability: false });
  (posSyncService as any).integrationRepository = integrationRepository;
  (posSyncService as any).syncLogRepository = syncLogRepository;
  (posSyncService as any).orderRepository = orderRepository;
  (posSyncService as any).services = services;

  return {
    posSyncService,
    service,
    integrationRepository,
    syncLogRepository,
    orderRepository,
  };
}

describe('POSSyncService adapters', () => {
  it('builds a mapped idempotent Square order payload', () => {
    const payload = buildPOSOrderPayload(order, integration);

    expect(payload.idempotency_key).toBe('menumaker-order-order-1');
    expect(payload.order.line_items[0]).toMatchObject({
      catalog_object_id: 'square-dish-1',
      quantity: '2',
    });
    expect(payload.order).toMatchObject({
      customer_id: 'customer-1',
    });
  });

  it('normalizes optional POS order payload metadata before provider dispatch', () => {
    const payload = buildPOSOrderPayload({
      ...order,
      currency: ' inr ',
      items: [
        {
          ...order.items[0],
          dish_name: '  Idli Sambar  ',
          special_instructions: '  extra chutney  ',
        },
        {
          dish_id: 'dish-2',
          dish_name: '   ',
          name: '  Plain Dosa  ',
          quantity: 1,
          unit_price_cents: 9000,
        },
        {
          dish_id: 'dish-3',
          dish_name: '   ',
          name: '   ',
          quantity: 1,
          unit_price_cents: 4500,
          special_instructions: '   ',
        },
      ],
    }, {
      ...integration,
      item_mapping: {
        'dish-1': 'square-dish-1',
        'dish-2': 'square-dish-2',
        'dish-3': 'square-dish-3',
      },
    });

    expect(payload.order.line_items).toEqual([
      expect.objectContaining({
        catalog_object_id: 'square-dish-1',
        name: 'Idli Sambar',
        base_price_money: { amount: 12000, currency: 'INR' },
        note: 'extra chutney',
      }),
      expect.objectContaining({
        catalog_object_id: 'square-dish-2',
        name: 'Plain Dosa',
        base_price_money: { amount: 9000, currency: 'INR' },
      }),
      expect.objectContaining({
        catalog_object_id: 'square-dish-3',
        name: 'dish-3',
        base_price_money: { amount: 4500, currency: 'INR' },
      }),
    ]);
    expect(payload.order.line_items[1]).not.toHaveProperty('note');
    expect(payload.order.line_items[2]).not.toHaveProperty('note');
  });

  it('omits absent optional Square order fields before provider dispatch', () => {
    const payload = buildPOSOrderPayload({
      ...order,
      customer_id: '   ',
      items: [
        {
          dish_id: 'dish-1',
          dish_name: 'Idli',
          quantity: 2,
          unit_price_cents: 12000,
          special_instructions: undefined,
        },
      ],
    }, {
      ...integration,
      sync_customer_info: true,
      item_mapping: undefined,
    });

    expect(payload.order).not.toHaveProperty('customer_id');
    expect(payload.order.line_items[0]).toMatchObject({
      name: 'Idli',
      quantity: '2',
      base_price_money: { amount: 12000, currency: 'INR' },
    });
    expect(payload.order.line_items[0]).not.toHaveProperty('catalog_object_id');
    expect(payload.order.line_items[0]).not.toHaveProperty('note');
  });

  it('rejects malformed POS order payload metadata before provider dispatch', () => {
    expect(() => buildPOSOrderPayload(null as any, integration))
      .toThrow('POS order payload must be an object');

    expect(() => buildPOSOrderPayload([] as any, integration))
      .toThrow('POS order payload must be an object');

    expect(() => buildPOSOrderPayload(order, null as any))
      .toThrow('POS integration payload must be an object');

    expect(() => buildPOSOrderPayload(order, [] as any))
      .toThrow('POS integration payload must be an object');

    expect(() => buildPOSOrderPayload({
      ...order,
      id: '   ',
    }, integration)).toThrow('POS order id must be a non-empty string');

    expect(() => buildPOSOrderPayload({
      ...order,
      id: 'order-\u00001',
    }, integration)).toThrow('POS order id must not include unsafe control characters');

    expect(() => buildPOSOrderPayload({
      ...order,
      id: 'order-\u202E1',
    }, integration)).toThrow('POS order id must not include unsafe control characters');

    expect(() => buildPOSOrderPayload({
      ...order,
      id: '\uFEFForder-edge-control',
    }, integration)).toThrow('POS order id must not include unsafe control characters');

    expect(() => buildPOSOrderPayload({
      ...order,
      business_id: '   ',
    }, integration)).toThrow('POS order business_id must be a non-empty string');

    expect(() => buildPOSOrderPayload({
      ...order,
      customer_id: 'customer-\u007F1',
    }, integration)).toThrow('POS order customer_id must not include unsafe control characters');

    expect(() => buildPOSOrderPayload({
      ...order,
      customer_id: 'customer-\u200B1',
    }, integration)).toThrow('POS order customer_id must not include unsafe control characters');

    expect(() => buildPOSOrderPayload({
      ...order,
      customer_id: 'customer-edge-control\uFEFF',
    }, integration)).toThrow('POS order customer_id must not include unsafe control characters');

    expect(() => buildPOSOrderPayload({
      ...order,
      currency: 'INRU',
    }, integration)).toThrow('Order currency must be a three-letter ISO-4217 code');

    expect(() => buildPOSOrderPayload({
      ...order,
      items: [{ ...order.items[0], dish_id: '   ' }],
    }, integration)).toThrow('Dish id for POS order item 1 must be a non-empty string');

    expect(() => buildPOSOrderPayload({
      ...order,
      items: [{ ...order.items[0], dish_name: { text: 'Idli' } }],
    }, integration)).toThrow('Dish name for dish dish-1 must be a string');

    expect(() => buildPOSOrderPayload({
      ...order,
      items: [{ ...order.items[0], dish_name: 'Idli\u0007Sambar' }],
    }, integration)).toThrow('Dish name for dish dish-1 must not include unsafe control characters');

    expect(() => buildPOSOrderPayload({
      ...order,
      items: [{ ...order.items[0], dish_name: 'Idli\u2060Sambar' }],
    }, integration)).toThrow('Dish name for dish dish-1 must not include unsafe control characters');

    expect(() => buildPOSOrderPayload({
      ...order,
      items: [{ ...order.items[0], special_instructions: ['extra chutney'] }],
    }, integration)).toThrow('Special instructions for dish dish-1 must be a string');

    expect(() => buildPOSOrderPayload({
      ...order,
      items: [{ ...order.items[0], special_instructions: 'extra\u0000chutney' }],
    }, integration)).toThrow('Special instructions for dish dish-1 must not include unsafe control characters');

    expect(() => buildPOSOrderPayload({
      ...order,
      items: [{ ...order.items[0], special_instructions: 'extra\u202Echutney' }],
    }, integration)).toThrow('Special instructions for dish dish-1 must not include unsafe control characters');

    expect(() => buildPOSOrderPayload({
      ...order,
      items: [{ ...order.items[0], special_instructions: '\uFEFFextra chutney' }],
    }, integration)).toThrow('Special instructions for dish dish-1 must not include unsafe control characters');
  });

  it('fails permanently when a mapped integration is missing a dish mapping', () => {
    expect(() => buildPOSOrderPayload(order, { ...integration, item_mapping: {} }))
      .toThrow(/No POS item mapping for dish dish-1/);
  });

  it('fails permanently before provider calls when a POS integration is missing a location id', () => {
    expect(() => buildPOSOrderPayload(order, { ...integration, location_id: '   ' }))
      .toThrow('POS integration location_id must be a non-empty string');
  });

  it('rejects cross-business POS payloads before provider dispatch', () => {
    expect(() => buildPOSOrderPayload(order, {
      ...integration,
      business_id: 'business-elsewhere',
    })).toThrow('POS integration business_id must match POS order business_id');

    expect(() => buildPOSOrderPayload(order, {
      ...integration,
      business_id: '   ',
    })).toThrow('POS integration business_id must be a non-empty string');
  });

  it('fails permanently before provider calls when POS order items have invalid money or quantities', () => {
    expect(() => buildPOSOrderPayload({
      ...order,
      items: { ...order.items[0], length: 1 },
    }, integration)).toThrow('POS order items must be an array before POS sync');

    expect(() => buildPOSOrderPayload({ ...order, items: [] }, integration))
      .toThrow('Order must include at least one item before POS sync');

    expect(() => buildPOSOrderPayload({
      ...order,
      items: [null],
    }, integration)).toThrow('POS order item 1 must be an object');

    expect(() => buildPOSOrderPayload({
      ...order,
      items: [['dish-1']],
    }, integration)).toThrow('POS order item 1 must be an object');

    expect(() => buildPOSOrderPayload({
      ...order,
      items: [{ ...order.items[0], quantity: 0 }],
    }, integration)).toThrow('Quantity for dish dish-1 must be a positive integer quantity');

    expect(() => buildPOSOrderPayload({
      ...order,
      items: [{ ...order.items[0], quantity: 1.5 }],
    }, integration)).toThrow('Quantity for dish dish-1 must be a positive integer quantity');

    expect(() => buildPOSOrderPayload({
      ...order,
      items: [{ dish_id: 'dish-1', dish_name: 'Idli', quantity: 1 }],
    }, integration)).toThrow('Unit price for dish dish-1 is required before POS sync');

    expect(() => buildPOSOrderPayload({
      ...order,
      items: [{ ...order.items[0], unit_price_cents: -1 }],
    }, integration)).toThrow('Unit price for dish dish-1 must be a non-negative integer amount in cents');
  });

  it('creates Square orders with provider idempotency and records provider ids', async () => {
    const calls: Array<{ url: string; init: any }> = [];
    const client: POSHttpClient = async (url, init) => {
      calls.push({ url, init });
      return { status: 200, json: async () => ({ order: { id: 'square-order-1' } }) };
    };

    const service = new SquarePOSService(client, 'https://square.test');
    const result = await service.createOrder(order, integration);

    expect(result).toEqual({ success: true, pos_order_id: 'square-order-1' });
    expect(calls[0].url).toBe('https://square.test/v2/orders');
    expect(calls[0].init.headers['Idempotency-Key']).toBe('menumaker-order-order-1');
    expect(calls[0].init.headers.Authorization).toBe('Bearer access-token');
  });

  it('rejects unsafe Square endpoint bases before provider credential dispatch', async () => {
    const client = jest.fn<POSHttpClient>(async () => ({
      status: 200,
      json: async () => ({ order: { id: 'square-order-1' } }),
    }));

    expect(() => new SquarePOSService(client, 'http://square.test')).toThrow(
      'Square endpoint base must be an absolute HTTPS URL'
    );
    expect(() => new SquarePOSService(client, '/square')).toThrow(
      'Square endpoint base must be an absolute HTTPS URL'
    );
    expect(() => new SquarePOSService(client, 'https://client:secret@square.test')).toThrow(
      'Square endpoint base must not include embedded credentials'
    );
    expect(() => new SquarePOSService(client, '\uFEFFhttps://square.test')).toThrow(
      'Square endpoint base must not include unsafe control characters'
    );
    for (const internalEndpoint of [
      'https://localhost',
      'https://square.localhost',
      'https://127.0.0.1',
      'https://10.0.0.5',
      'https://172.20.0.5',
      'https://192.168.1.5',
      'https://169.254.169.254',
      'https://100.64.0.1',
      'https://[::1]',
      'https://[fd00::1]',
      'https://[fe80::1]',
    ]) {
      expect(() => new SquarePOSService(client, internalEndpoint)).toThrow(
        'Square endpoint base must not use a private or internal host'
      );
    }
    expect(client).not.toHaveBeenCalled();
  });

  it('rejects blank Square access tokens before dispatching provider orders', async () => {
    const client = jest.fn<POSHttpClient>(async () => ({
      status: 200,
      json: async () => ({ order: { id: 'square-order-1' } }),
    }));
    const service = new SquarePOSService(client, 'https://square.test');

    await expect(
      service.createOrder(order, { ...integration, access_token: '   ' })
    ).rejects.toMatchObject({
      kind: 'permanent',
      message: 'POS integration access_token must be a non-empty string',
    } satisfies Partial<POSSyncError>);

    expect(client).not.toHaveBeenCalled();
  });

  it('classifies rate limits and token refresh responses as typed sync errors', async () => {
    const client: POSHttpClient = async () => ({ status: 429, json: async () => ({}) });
    const service = new SquarePOSService(client, 'https://square.test');

    await expect(service.createOrder(order, integration)).rejects.toMatchObject({
      kind: 'rate_limited',
      httpStatus: 429,
    } satisfies Partial<POSSyncError>);
    await expect(service.refreshAccessToken(integration)).rejects.toMatchObject({
      kind: 'rate_limited',
      httpStatus: 429,
    } satisfies Partial<POSSyncError>);
  });

  it('rejects unsafe provider response messages before trimming them into sync errors', async () => {
    const client = jest.fn<POSHttpClient>(async () => ({
      status: 400,
      json: async () => ({ message: '\uFEFFSquare rejected order' }),
    }));
    const service = new SquarePOSService(client, 'https://square.test');

    await expect(service.createOrder(order, integration)).rejects.toMatchObject({
      kind: 'permanent',
      message: 'POS provider response message must not include unsafe control characters',
    } satisfies Partial<POSSyncError>);
  });

  it('rejects oversized provider response messages before trimming them into sync errors', async () => {
    const client = jest.fn<POSHttpClient>(async () => ({
      status: 400,
      json: async () => ({ message: `Square rejected order ${'x'.repeat(1001)}` }),
    }));
    const service = new SquarePOSService(client, 'https://square.test');

    await expect(service.createOrder(order, integration)).rejects.toMatchObject({
      kind: 'permanent',
      message: 'POS provider response message must be at most 1000 characters',
    } satisfies Partial<POSSyncError>);
  });

  it('preserves Square rate-limit classification when provider bodies are malformed JSON', async () => {
    const client: POSHttpClient = async () => ({
      status: 429,
      json: async () => {
        throw new SyntaxError('unexpected token');
      },
    });
    const service = new SquarePOSService(client, 'https://square.test');

    await expect(service.createOrder(order, integration)).rejects.toMatchObject({
      kind: 'rate_limited',
      httpStatus: 429,
      message: 'Square rate limit exceeded',
    } satisfies Partial<POSSyncError>);
    await expect(service.refreshAccessToken(integration)).rejects.toMatchObject({
      kind: 'rate_limited',
      httpStatus: 429,
      message: 'Square token refresh rate limited',
    } satisfies Partial<POSSyncError>);
  });

  it('rejects impossible Square HTTP status evidence before classifying provider outcomes', async () => {
    const orderClient: POSHttpClient = async () => ({
      status: 700,
      json: async () => ({ order: { id: 'square-order-1' } }),
    });
    const refreshClient: POSHttpClient = async () => ({
      status: 99,
      json: async () => ({ access_token: 'fresh-access-token' }),
    });

    await expect(
      new SquarePOSService(orderClient, 'https://square.test').createOrder(order, integration)
    ).rejects.toMatchObject({
      kind: 'permanent',
      message: 'Square order response status must be a valid HTTP status',
    } satisfies Partial<POSSyncError>);

    await expect(
      new SquarePOSService(refreshClient, 'https://square.test').refreshAccessToken(integration)
    ).rejects.toMatchObject({
      kind: 'permanent',
      message: 'Square token refresh response status must be a valid HTTP status',
    } satisfies Partial<POSSyncError>);
  });

  it('rejects malformed Square success response bodies before reporting POS sync success', async () => {
    const malformedResponses = [
      {
        response: 'not-an-object',
        expectedError: 'Square order response body must be a JSON object',
      },
      {
        response: { order: {} },
        expectedError: 'POS provider success response must include pos_order_id',
      },
      {
        response: { id: 'square-order-1', order: { id: 123 } },
        expectedError: 'POS provider success response pos_order_id must be a string',
      },
      {
        response: { id: '\uFEFFsquare-order-1' },
        expectedError: 'POS provider success response pos_order_id must not include unsafe control characters',
      },
      {
        response: { order: { id: 'square-order-1\uFEFF' } },
        expectedError: 'POS provider success response pos_order_id must not include unsafe control characters',
      },
      {
        response: { id: 'square-order-1', order: [] },
        expectedError: 'Square order response body order must be a JSON object',
      },
      {
        response: { id: 'square-order-1', order: 'square-order-1' },
        expectedError: 'Square order response body order must be a JSON object',
      },
    ];

    for (const { response, expectedError } of malformedResponses) {
      const client: POSHttpClient = async () => ({
        status: 200,
        json: async () => response,
      });
      const service = new SquarePOSService(client, 'https://square.test');

      await expect(service.createOrder(order, integration)).rejects.toMatchObject({
        kind: 'permanent',
        httpStatus: 200,
        message: expectedError,
      } satisfies Partial<POSSyncError>);
    }
  });

  it('rejects malformed Square token refresh expiry values before returning credentials', async () => {
    const client: POSHttpClient = async () => ({
      status: 200,
      json: async () => ({
        access_token: 'fresh-access-token',
        refresh_token: 'fresh-refresh-token',
        expires_at: 'not-a-date',
      }),
    });
    const service = new SquarePOSService(client, 'https://square.test');

    await expect(service.refreshAccessToken(integration)).rejects.toMatchObject({
      kind: 'permanent',
      message: 'Square token refresh expires_at must be a valid Date',
    } satisfies Partial<POSSyncError>);
  });

  it.each([
    [
      'access token',
      { access_token: 'a'.repeat(2049), refresh_token: 'fresh-refresh-token' },
      'Square token refresh access_token must be at most 2048 characters',
    ],
    [
      'refresh token',
      { access_token: 'fresh-access-token', refresh_token: 'r'.repeat(2049) },
      'Square token refresh refresh_token must be at most 2048 characters',
    ],
  ])('rejects oversized Square token refresh %s before returning credentials', async (
    _caseName,
    tokenOverrides,
    expectedMessage
  ) => {
    const client: POSHttpClient = async () => ({
      status: 200,
      json: async () => ({
        access_token: 'fresh-access-token',
        refresh_token: 'fresh-refresh-token',
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        ...tokenOverrides,
      }),
    });
    const service = new SquarePOSService(client, 'https://square.test');

    await expect(service.refreshAccessToken(integration)).rejects.toMatchObject({
      kind: 'permanent',
      httpStatus: 200,
      message: expectedMessage,
    } satisfies Partial<POSSyncError>);
  });

  it('omits absent optional Square refresh tokens before returning refreshed credentials', async () => {
    const client: POSHttpClient = async () => ({
      status: 200,
      json: async () => ({
        access_token: 'fresh-access-token',
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      }),
    });
    const service = new SquarePOSService(client, 'https://square.test');

    const refreshed = await service.refreshAccessToken(integration);

    expect(refreshed).toMatchObject({
      access_token: 'fresh-access-token',
      expires_at: expect.any(Date),
    });
    expect(refreshed).not.toHaveProperty('refresh_token');
  });

  it('keeps unapproved providers disabled at the adapter boundary', async () => {
    await expect(new DinePOSService().createOrder(order, { ...integration, provider: 'dine' }))
      .rejects.toBeInstanceOf(FeatureUnavailableError);
  });

  it('fails closed before creating a Square integration while POS sync is disabled', async () => {
    const integrationRepository = createMemoryRepository<any>();
    const service = new POSSyncService(new Map(), {
      integrationRepository: integrationRepository as any,
      syncLogRepository: createMemoryRepository<any>() as any,
      orderRepository: createMemoryRepository<any>() as any,
    });

    await expect(
      service.createIntegration('business-1', 'square', 'access-token')
    ).rejects.toMatchObject({
      code: 'FEATURE_UNAVAILABLE',
      capability: 'pos_sync',
    });
    expect(integrationRepository.rows).toHaveLength(0);
  });

  it('validates replacement Square credentials before deactivating an existing integration', async () => {
    const existingIntegration = {
      ...integration,
      is_active: true,
    };
    const integrationRepository = {
      findOne: jest.fn(async () => existingIntegration),
      save: jest.fn(async (entity) => entity),
      create: jest.fn((input) => input),
    };
    const service = new POSSyncService(new Map(), {
      integrationRepository: integrationRepository as any,
      syncLogRepository: createMemoryRepository<any>() as any,
      orderRepository: createMemoryRepository<any>() as any,
    }, { enforceCapability: false });

    await expect(
      service.createIntegration('business-1', 'square', '   ', {
        location_id: 'location-1',
      })
    ).rejects.toMatchObject({
      kind: 'permanent',
      message: 'POS integration access_token must be a non-empty string',
    } satisfies Partial<POSSyncError>);

    await expect(
      service.createIntegration('business-1', 'square', 'access-token', {
        location_id: '   ',
      })
    ).rejects.toMatchObject({
      kind: 'permanent',
      message: 'POS integration location_id must be a non-empty string',
    } satisfies Partial<POSSyncError>);

    await expect(
      service.createIntegration('business-1', 'square', 'access-token', {
        location_id: 'location-1',
        token_expires_at: new Date('not-a-date'),
      })
    ).rejects.toMatchObject({
      kind: 'permanent',
      message: 'POS integration token_expires_at must be a valid Date',
    } satisfies Partial<POSSyncError>);

    expect(integrationRepository.findOne).not.toHaveBeenCalled();
    expect(integrationRepository.create).not.toHaveBeenCalled();
    expect(integrationRepository.save).not.toHaveBeenCalled();
    expect(existingIntegration.is_active).toBe(true);
  });

  it('rejects malformed POS integration option payloads before deactivating an existing integration', async () => {
    const existingIntegration = {
      ...integration,
      is_active: true,
    };
    const integrationRepository = {
      findOne: jest.fn(async () => existingIntegration),
      save: jest.fn(async (entity) => entity),
      create: jest.fn((input) => input),
    };
    const service = new POSSyncService(new Map(), {
      integrationRepository: integrationRepository as any,
      syncLogRepository: createMemoryRepository<any>() as any,
      orderRepository: createMemoryRepository<any>() as any,
    }, { enforceCapability: false });

    await expect(
      service.createIntegration('business-1', 'square', 'access-token', null as any)
    ).rejects.toMatchObject({
      kind: 'permanent',
      message: 'POS integration options must be an object',
    } satisfies Partial<POSSyncError>);

    await expect(
      service.createIntegration('business-1', 'square', 'access-token', [] as any)
    ).rejects.toMatchObject({
      kind: 'permanent',
      message: 'POS integration options must be an object',
    } satisfies Partial<POSSyncError>);

    await expect(
      service.createIntegration('business-1', 'square', 'access-token', {
        location_id: 'location-1',
        provider_trace_id: 'trace-1',
      } as any)
    ).rejects.toMatchObject({
      kind: 'permanent',
      message: 'POS integration options include unsupported field(s): provider_trace_id',
    } satisfies Partial<POSSyncError>);

    await expect(
      service.createIntegration('business-1', 'square', 'access-token', {
        location_id: 'location-1',
        ['provider_trace_id\uFEFF']: 'trace-1',
      } as any)
    ).rejects.toMatchObject({
      kind: 'permanent',
      message: 'POS integration options field names must not include unsafe control characters',
    } satisfies Partial<POSSyncError>);

    expect(integrationRepository.findOne).not.toHaveBeenCalled();
    expect(integrationRepository.create).not.toHaveBeenCalled();
    expect(integrationRepository.save).not.toHaveBeenCalled();
    expect(existingIntegration.is_active).toBe(true);
  });

  it('normalizes validated Square credentials before replacing an integration', async () => {
    const integrationRepository = createMemoryRepository<any>([{
      ...integration,
      is_active: true,
    }]);
    const service = new POSSyncService(new Map(), {
      integrationRepository: integrationRepository as any,
      syncLogRepository: createMemoryRepository<any>() as any,
      orderRepository: createMemoryRepository<any>() as any,
    }, { enforceCapability: false });
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    const created = await service.createIntegration(' business-1 ', 'square', ' access-token-2 ', {
      refresh_token: ' refresh-token-2 ',
      token_expires_at: expiresAt,
      location_id: ' location-2 ',
      merchant_id: ' merchant-2 ',
    });

    expect(integrationRepository.rows[0].is_active).toBe(false);
    expect(created).toMatchObject({
      business_id: 'business-1',
      access_token: 'access-token-2',
      refresh_token: 'refresh-token-2',
      token_expires_at: expiresAt,
      location_id: 'location-2',
      merchant_id: 'merchant-2',
      is_active: true,
    });
  });

  it('rejects corrupt existing POS integration rows before deactivation writes', async () => {
    const existingIntegration = {
      ...integration,
      business_id: 'business-elsewhere',
      is_active: true,
    };
    const integrationRepository = {
      findOne: jest.fn(async () => existingIntegration),
      save: jest.fn(async (entity) => entity),
      create: jest.fn((input) => input),
    };
    const service = new POSSyncService(new Map(), {
      integrationRepository: integrationRepository as any,
      syncLogRepository: createMemoryRepository<any>() as any,
      orderRepository: createMemoryRepository<any>() as any,
    }, { enforceCapability: false });

    await expect(
      service.createIntegration('business-1', 'square', 'access-token', {
        location_id: 'location-1',
      })
    ).rejects.toThrow('Existing POS integration business_id must match requested business');

    expect(integrationRepository.save).not.toHaveBeenCalled();
    expect(integrationRepository.create).not.toHaveBeenCalled();
    expect(existingIntegration.is_active).toBe(true);
  });

  it('fails POS read and disconnect operations before repository access while POS sync is disabled', async () => {
    const integrationRepository = {
      findOne: jest.fn(async () => ({ ...integration, is_active: true })),
      save: jest.fn(async (entity) => entity),
      create: jest.fn((input) => input),
    };
    const syncLogRepository = {
      find: jest.fn(async () => []),
      findAndCount: jest.fn(async () => [[], 0]),
      findOne: jest.fn(async () => null),
      save: jest.fn(async (entity) => entity),
      create: jest.fn((input) => input),
    };
    const service = new POSSyncService(new Map(), {
      integrationRepository: integrationRepository as any,
      syncLogRepository: syncLogRepository as any,
      orderRepository: createMemoryRepository<any>() as any,
    });

    await expect(service.getIntegration('business-1')).rejects.toMatchObject({
      code: 'FEATURE_UNAVAILABLE',
      capability: 'pos_sync',
    });
    await expect(service.disconnectIntegration('business-1')).rejects.toMatchObject({
      code: 'FEATURE_UNAVAILABLE',
      capability: 'pos_sync',
    });
    await expect(service.getSyncHistory('business-1')).rejects.toMatchObject({
      code: 'FEATURE_UNAVAILABLE',
      capability: 'pos_sync',
    });
    await expect(service.getSyncStats('business-1')).rejects.toMatchObject({
      code: 'FEATURE_UNAVAILABLE',
      capability: 'pos_sync',
    });

    expect(integrationRepository.findOne).not.toHaveBeenCalled();
    expect(integrationRepository.save).not.toHaveBeenCalled();
    expect(syncLogRepository.find).not.toHaveBeenCalled();
    expect(syncLogRepository.findAndCount).not.toHaveBeenCalled();
  });

  it('rejects blank POS boundary identifiers before repository reads', async () => {
    const integrationRepository = {
      findOne: jest.fn(async () => ({ ...integration, is_active: true })),
      save: jest.fn(async (entity) => entity),
    };
    const syncLogRepository = {
      find: jest.fn(async () => []),
      findAndCount: jest.fn(async () => [[], 0]),
      findOne: jest.fn(async () => null),
      save: jest.fn(async (entity) => entity),
      create: jest.fn((input) => input),
    };
    const orderRepository = {
      findOne: jest.fn(async () => ({ ...order })),
    };
    const service = new POSSyncService(new Map([['square', {
      provider: 'square',
      createOrder: jest.fn(async () => ({ success: true, pos_order_id: 'square-order-1' })),
      refreshAccessToken: jest.fn(async () => ({ access_token: 'fresh-token' })),
    } as IPOSService]]) as any, {
      integrationRepository: integrationRepository as any,
      syncLogRepository: syncLogRepository as any,
      orderRepository: orderRepository as any,
    }, { enforceCapability: false });

    await expect(service.getIntegration('   '))
      .rejects.toThrow('POS business_id must be a non-empty string');
    await expect(service.disconnectIntegration('   '))
      .rejects.toThrow('POS business_id must be a non-empty string');
    await expect(service.getSyncHistory('   '))
      .rejects.toThrow('POS business_id must be a non-empty string');
    await expect(service.getSyncStats('   '))
      .rejects.toThrow('POS business_id must be a non-empty string');
    await expect(service.syncOrder('   '))
      .rejects.toThrow('POS order_id must be a non-empty string');

    expect(integrationRepository.findOne).not.toHaveBeenCalled();
    expect(integrationRepository.save).not.toHaveBeenCalled();
    expect(syncLogRepository.find).not.toHaveBeenCalled();
    expect(syncLogRepository.findAndCount).not.toHaveBeenCalled();
    expect(syncLogRepository.findOne).not.toHaveBeenCalled();
    expect(syncLogRepository.save).not.toHaveBeenCalled();
    expect(orderRepository.findOne).not.toHaveBeenCalled();
  });

  it('normalizes POS business identifiers before repository lookups and disconnect writes', async () => {
    const savedIntegration = { ...integration, business_id: 'business-1', is_active: true };
    const integrationRepository = {
      findOne: jest.fn(async () => ({ ...savedIntegration })),
      save: jest.fn(async (entity) => entity),
    };
    const service = new POSSyncService(new Map(), {
      integrationRepository: integrationRepository as any,
      syncLogRepository: createMemoryRepository<any>() as any,
      orderRepository: createMemoryRepository<any>() as any,
    }, { enforceCapability: false });

    await expect(service.getIntegration(' business-1 ')).resolves.toMatchObject({
      business_id: 'business-1',
    });
    await service.disconnectIntegration(' business-1 ');

    expect(integrationRepository.findOne).toHaveBeenNthCalledWith(1, {
      where: { business_id: 'business-1', is_active: true },
    });
    expect(integrationRepository.findOne).toHaveBeenNthCalledWith(2, {
      where: { business_id: 'business-1', is_active: true },
    });
    expect(integrationRepository.save).toHaveBeenCalledWith(expect.objectContaining({
      business_id: 'business-1',
      is_active: false,
    }));
  });

  it('rejects corrupt persisted POS integrations before disconnect writes', async () => {
    const corruptIntegrationRow = {
      ...integration,
      id: 'integration-elsewhere',
      business_id: 'business-elsewhere',
      is_active: true,
    };
    const integrationRepository = {
      findOne: jest.fn(async () => ({ ...corruptIntegrationRow })),
      save: jest.fn(async (entity) => entity),
    };
    const service = new POSSyncService(new Map(), {
      integrationRepository: integrationRepository as any,
      syncLogRepository: createMemoryRepository<any>() as any,
      orderRepository: createMemoryRepository<any>() as any,
    }, { enforceCapability: false });

    await expect(service.disconnectIntegration('business-1')).rejects.toThrow(
      'POS integration business_id must match requested business'
    );

    expect(integrationRepository.save).not.toHaveBeenCalled();
  });

  it('rejects malformed persisted POS integration envelopes before read or disconnect writes', async () => {
    const malformedIntegration = [] as any;
    const integrationRepository = {
      findOne: jest.fn(async () => malformedIntegration),
      save: jest.fn(async (entity) => entity),
    };
    const service = new POSSyncService(new Map(), {
      integrationRepository: integrationRepository as any,
      syncLogRepository: createMemoryRepository<any>() as any,
      orderRepository: createMemoryRepository<any>() as any,
    }, { enforceCapability: false });

    await expect(service.getIntegration('business-1'))
      .rejects.toThrow('POS integration must be an object');
    await expect(service.disconnectIntegration('business-1'))
      .rejects.toThrow('POS integration must be an object');

    expect(integrationRepository.save).not.toHaveBeenCalled();
  });

  it.each([
    [
      'missing last_error on positive error_count',
      { error_count: 2, last_error: null },
      'POS integration last_error is required when error_count is positive',
    ],
    [
      'stale last_error on zero error_count',
      { error_count: 0, last_error: 'Previous Square timeout' },
      'POS integration last_error cannot be present when error_count is zero',
    ],
    [
      'oversized last_error on positive error_count',
      { error_count: 2, last_error: `Square rejected order ${'x'.repeat(1001)}` },
      'POS integration last_error must be at most 1000 characters',
    ],
    [
      'unsupported provider metadata field',
      { provider_trace_id: 'trace-1' },
      'POS integration include unsupported field(s): provider_trace_id',
    ],
    [
      'unsafe provider metadata field name',
      { ['provider_trace_id\uFEFF']: 'trace-1' },
      'POS integration field names must not include unsafe control characters',
    ],
    [
      'invalid auto sync flag',
      { auto_sync_orders: 'yes' },
      'POS integration auto_sync_orders must be a boolean',
    ],
    [
      'invalid customer sync flag',
      { sync_customer_info: 'yes' },
      'POS integration sync_customer_info must be a boolean',
    ],
    [
      'malformed item mapping envelope',
      { item_mapping: ['square-dish-1'] },
      'POS integration item_mapping must be an object',
    ],
    [
      'blank item mapping value',
      { item_mapping: { 'dish-1': '   ' } },
      'POS integration item_mapping[dish-1] must be a non-empty string',
    ],
    [
      'invalid last sync timestamp',
      { last_sync_at: new Date('not-a-date') },
      'POS integration last_sync_at must be a valid Date',
    ],
    [
      'last sync before created evidence',
      {
        created_at: new Date('2026-06-27T03:00:00.000Z'),
        last_sync_at: new Date('2026-06-27T02:59:59.000Z'),
      },
      'POS integration last_sync_at cannot be before created_at',
    ],
    [
      'invalid token expiry timestamp',
      { token_expires_at: new Date('not-a-date') },
      'POS integration token_expires_at must be a valid Date',
    ],
    [
      'token expiry before integration creation evidence',
      {
        created_at: new Date('2026-06-27T03:00:00.000Z'),
        token_expires_at: new Date('2026-06-27T02:59:59.000Z'),
      },
      'POS integration token_expires_at cannot be before created_at',
    ],
    [
      'unsupported integration settings field',
      { settings: { api_version: '2024-01-01', provider_trace_id: 'trace-1' } },
      'POS integration settings include unsupported field(s): provider_trace_id',
    ],
    [
      'unsafe integration settings field name',
      { settings: { api_version: '2024-01-01', ['provider_trace_id\uFEFF']: 'trace-1' } },
      'POS integration settings field names must not include unsafe control characters',
    ],
    [
      'unsafe integration API version setting',
      { settings: { api_version: '2024-01-01\u0000' } },
      'POS integration settings.api_version must not include unsafe control characters',
    ],
    [
      'insecure integration webhook URL',
      { settings: { webhook_url: 'http://example.com/pos/webhook' } },
      'POS integration settings.webhook_url must be an absolute HTTPS URL',
    ],
    [
      'unsupported integration tax handling setting',
      { settings: { tax_handling: 'provider' } },
      'POS integration settings.tax_handling must be auto or manual',
    ],
    [
      'invalid created_at evidence',
      { created_at: new Date('not-a-date') },
      'POS integration created_at must be a valid Date',
    ],
    [
      'invalid updated_at evidence',
      { updated_at: new Date('not-a-date') },
      'POS integration updated_at must be a valid Date',
    ],
    [
      'updated before created evidence',
      {
        created_at: new Date('2026-06-27T03:00:00.000Z'),
        updated_at: new Date('2026-06-27T02:59:59.000Z'),
      },
      'POS integration updated_at cannot be before created_at',
    ],
    [
      'updated before last sync evidence',
      {
        created_at: new Date('2026-06-27T03:00:00.000Z'),
        last_sync_at: new Date('2026-06-27T03:05:00.000Z'),
        updated_at: new Date('2026-06-27T03:04:59.000Z'),
      },
      'POS integration updated_at cannot be before last_sync_at',
    ],
  ])('rejects corrupt persisted POS integration error evidence before read-side rows: %s', async (
    _caseName,
    overrides,
    expectedMessage
  ) => {
    const corruptIntegrationRow = {
      ...integration,
      business_id: 'business-1',
      is_active: true,
      ...overrides,
    };
    const integrationRepository = {
      findOne: jest.fn(async () => ({ ...corruptIntegrationRow })),
      save: jest.fn(async (entity) => entity),
    };
    const service = new POSSyncService(new Map(), {
      integrationRepository: integrationRepository as any,
      syncLogRepository: createMemoryRepository<any>() as any,
      orderRepository: createMemoryRepository<any>() as any,
    }, { enforceCapability: false });

    await expect(service.getIntegration('business-1')).rejects.toThrow(expectedMessage);

    expect(integrationRepository.save).not.toHaveBeenCalled();
  });

  it('normalizes and validates POS sync history query options before querying history rows', async () => {
    const integrationRepository = {
      findOne: jest.fn(async () => ({
        id: 'integration-1',
        business_id: 'business-1',
        provider: 'square',
        location_id: 'location-1',
        error_count: 0,
      })),
    };
    const syncLogRepository = {
      findAndCount: jest.fn(async () => [[{
        id: 'log-1',
        pos_integration_id: 'integration-1',
        order_id: 'order-1',
        provider: 'square',
        status: 'success',
        retry_count: 0,
        max_retries: 12,
        pos_order_id: 'square-order-1',
        response_data: { pos_order_id: 'square-order-1' },
        request_payload: successfulPOSRequestPayload(),
        completed_at: completedAt,
      }], 1]),
    };
    const service = new POSSyncService(new Map(), {
      integrationRepository: integrationRepository as any,
      syncLogRepository: syncLogRepository as any,
      orderRepository: createMemoryRepository<any>() as any,
    }, { enforceCapability: false });

    await expect(
      service.getSyncHistory(' business-1 ', {
        limit: '25',
        offset: '10',
        status: ' Success ',
      } as any)
    ).resolves.toEqual({
      logs: [{
        id: 'log-1',
        pos_integration_id: 'integration-1',
        order_id: 'order-1',
        provider: 'square',
        status: 'success',
        retry_count: 0,
        max_retries: 12,
        pos_order_id: 'square-order-1',
        response_data: { pos_order_id: 'square-order-1' },
        request_payload: successfulPOSRequestPayload(),
        completed_at: completedAt,
      }],
      total: 1,
    });

    expect(integrationRepository.findOne).toHaveBeenCalledWith({
      where: { business_id: 'business-1', is_active: true },
    });
    expect(syncLogRepository.findAndCount).toHaveBeenCalledWith({
      where: { pos_integration_id: 'integration-1', status: 'success' },
      order: { created_at: 'DESC' },
      take: 25,
      skip: 10,
    });
  });

  it('rejects malformed POS sync history query options before repository reads', async () => {
    const integrationRepository = {
      findOne: jest.fn(async () => ({ id: 'integration-1', business_id: 'business-1' })),
    };
    const syncLogRepository = {
      findAndCount: jest.fn(async () => [[], 0]),
    };
    const service = new POSSyncService(new Map(), {
      integrationRepository: integrationRepository as any,
      syncLogRepository: syncLogRepository as any,
      orderRepository: createMemoryRepository<any>() as any,
    }, { enforceCapability: false });

    await expect(
      service.getSyncHistory('business-1', { status: 'teleported' } as any)
    ).rejects.toThrow('POS sync history status has an invalid status');

    await expect(
      service.getSyncHistory('business-1', { status: '   ' } as any)
    ).rejects.toThrow('POS sync history status has an invalid status');

    await expect(
      service.getSyncHistory('business-1', { status: '\uFEFFsuccess' } as any)
    ).rejects.toThrow('POS sync history status must not include unsafe control characters');

    await expect(
      service.getSyncHistory('business-1', { limit: Number.MAX_SAFE_INTEGER + 1 } as any)
    ).rejects.toThrow('POS sync history limit must be a safe integer');

    await expect(
      service.getSyncHistory('business-1', { offset: -1 } as any)
    ).rejects.toThrow('POS sync history offset must be non-negative');

    await expect(
      service.getSyncHistory('business-1', null as any)
    ).rejects.toThrow('POS sync history options must be an object');

    await expect(
      service.getSyncHistory('business-1', [] as any)
    ).rejects.toThrow('POS sync history options must be an object');

    await expect(
      service.getSyncHistory('business-1', { order_id: 'order-elsewhere' } as any)
    ).rejects.toThrow('POS sync history option order_id is not supported');

    await expect(
      service.getSyncHistory('business-1', { ['order_id\uFEFF']: 'order-elsewhere' } as any)
    ).rejects.toThrow('POS sync history options field names must not include unsafe control characters');

    expect(integrationRepository.findOne).not.toHaveBeenCalled();
    expect(syncLogRepository.findAndCount).not.toHaveBeenCalled();
  });

  it('rejects corrupt POS sync history rows before returning them', async () => {
    const integrationRepository = {
      findOne: jest.fn(async () => ({
        id: 'integration-1',
        business_id: 'business-1',
        provider: 'square',
        error_count: 0,
      })),
    };
    const syncLogRepository = {
      findAndCount: jest.fn(async () => [[
        {
          id: 'log-1',
          pos_integration_id: 'integration-1',
          order_id: 'order-1',
          provider: 'square',
          status: 'success',
          retry_count: 0,
          max_retries: 12,
          pos_order_id: 'square-order-1',
          completed_at: completedAt,
          provider_trace_id: 'trace-1',
        },
        {
          id: 'log-2',
          pos_integration_id: 'other-integration',
          order_id: 'order-2',
          provider: 'square',
          status: 'retry',
          retry_count: 1,
          max_retries: 12,
          error_message: 'Square rate limit exceeded',
          next_retry_at: nextRetryAt,
        },
      ], 2]),
    };
    const service = new POSSyncService(new Map(), {
      integrationRepository: integrationRepository as any,
      syncLogRepository: syncLogRepository as any,
      orderRepository: createMemoryRepository<any>() as any,
    }, { enforceCapability: false });

    await expect(service.getSyncHistory('business-1'))
      .rejects.toThrow('POS sync history row 1 include unsupported field(s): provider_trace_id');
  });

  it('rejects unsafe POS sync history row field names before returning them', async () => {
    const integrationRepository = {
      findOne: jest.fn(async () => ({
        id: 'integration-1',
        business_id: 'business-1',
        provider: 'square',
        error_count: 0,
      })),
    };
    const syncLogRepository = {
      findAndCount: jest.fn(async () => [[
        {
          id: 'log-1',
          pos_integration_id: 'integration-1',
          order_id: 'order-1',
          provider: 'square',
          status: 'success',
          retry_count: 0,
          max_retries: 12,
          pos_order_id: 'square-order-1',
          completed_at: completedAt,
          ['provider_trace_id\uFEFF']: 'trace-1',
        },
      ], 1]),
    };
    const service = new POSSyncService(new Map(), {
      integrationRepository: integrationRepository as any,
      syncLogRepository: syncLogRepository as any,
      orderRepository: createMemoryRepository<any>() as any,
    }, { enforceCapability: false });

    await expect(service.getSyncHistory('business-1'))
      .rejects.toThrow('POS sync history row 1 field names must not include unsafe control characters');
  });

  it('rejects malformed persisted POS sync log envelopes before history or stats exposure', async () => {
    const malformedSyncLog = [] as any;
    const integrationRepository = {
      findOne: jest.fn(async () => ({
        id: 'integration-1',
        business_id: 'business-1',
        provider: 'square',
        error_count: 0,
      })),
    };
    const syncLogRepository = {
      findAndCount: jest.fn(async () => [[malformedSyncLog], 1]),
      find: jest.fn(async () => [malformedSyncLog]),
    };
    const service = new POSSyncService(new Map(), {
      integrationRepository: integrationRepository as any,
      syncLogRepository: syncLogRepository as any,
      orderRepository: createMemoryRepository<any>() as any,
    }, { enforceCapability: false });

    await expect(service.getSyncHistory('business-1'))
      .rejects.toThrow('POS sync history row 1 must be an object');
    await expect(service.getSyncStats('business-1'))
      .rejects.toThrow('POS sync stats row 1 must be an object');
  });

  it('rejects oversized persisted POS sync error messages before history or stats exposure', async () => {
    const oversizedSyncLog = {
      id: 'log-oversized-error',
      pos_integration_id: 'integration-1',
      order_id: 'order-1',
      provider: 'square',
      status: 'failed',
      retry_count: 1,
      max_retries: 12,
      error_message: `Square rejected order ${'x'.repeat(1001)}`,
      completed_at: completedAt,
    };
    const integrationRepository = {
      findOne: jest.fn(async () => ({
        id: 'integration-1',
        business_id: 'business-1',
        provider: 'square',
        error_count: 0,
      })),
    };
    const syncLogRepository = {
      findAndCount: jest.fn(async () => [[oversizedSyncLog], 1]),
      find: jest.fn(async () => [oversizedSyncLog]),
    };
    const service = new POSSyncService(new Map(), {
      integrationRepository: integrationRepository as any,
      syncLogRepository: syncLogRepository as any,
      orderRepository: createMemoryRepository<any>() as any,
    }, { enforceCapability: false });

    await expect(service.getSyncHistory('business-1'))
      .rejects.toThrow('POS sync history row 1 error_message must be at most 1000 characters');
    await expect(service.getSyncStats('business-1'))
      .rejects.toThrow('POS sync stats row 1 error_message must be at most 1000 characters');
  });

  it.each([
    [
      'missing provider response audit object',
      {
        request_payload: successfulPOSRequestPayload(),
      },
      'POS sync history row 1 response_data must be an object',
    ],
    [
      'mismatched request idempotency key',
      {
        response_data: { pos_order_id: 'square-order-1' },
        request_payload: successfulPOSRequestPayload({
          idempotency_key: 'menumaker-order-order-elsewhere',
        }),
      },
      'POS sync history row 1 request_payload.idempotency_key must match requested order',
    ],
  ])('rejects successful POS sync history rows with %s', async (
    _caseName,
    overrides,
    expectedMessage
  ) => {
    const { posSyncService, syncLogRepository } = createPOSSyncHarness();
    syncLogRepository.rows.push({
      id: 'log-1',
      pos_integration_id: 'integration-1',
      order_id: 'order-1',
      provider: 'square',
      status: 'success',
      pos_order_id: 'square-order-1',
      completed_at: completedAt,
      ...overrides,
    });

    await expect(posSyncService.getSyncHistory('business-1'))
      .rejects.toThrow(expectedMessage);
  });

  it('rejects impossible POS sync history totals before returning paginated metadata', async () => {
    const integrationRepository = {
      findOne: jest.fn(async () => ({
        id: 'integration-1',
        business_id: 'business-1',
        provider: 'square',
        error_count: 0,
      })),
    };
    const syncLogRepository = {
      findAndCount: jest.fn(async () => [[
        {
          id: 'log-1',
          pos_integration_id: 'integration-1',
          order_id: 'order-1',
          provider: 'square',
          status: 'success',
          retry_count: 0,
          max_retries: 12,
          pos_order_id: 'square-order-1',
          completed_at: completedAt,
        },
        {
          id: 'log-2',
          pos_integration_id: 'integration-1',
          order_id: 'order-2',
          provider: 'square',
          status: 'failed',
          retry_count: 1,
          max_retries: 12,
          error_message: 'Square token refresh rejected',
          completed_at: completedAt,
        },
      ], 1]),
    };
    const service = new POSSyncService(new Map(), {
      integrationRepository: integrationRepository as any,
      syncLogRepository: syncLogRepository as any,
      orderRepository: createMemoryRepository<any>() as any,
    }, { enforceCapability: false });

    await expect(service.getSyncHistory('business-1')).rejects.toThrow(
      'POS sync history total must be greater than or equal to returned log count'
    );
  });

  it('rejects disabled-provider POS sync history rows before returning them', async () => {
    const integrationRepository = {
      findOne: jest.fn(async () => ({
        id: 'integration-1',
        business_id: 'business-1',
        provider: 'square',
        error_count: 0,
      })),
    };
    const syncLogRepository = {
      findAndCount: jest.fn(async () => [[{
        id: 'log-1',
        pos_integration_id: 'integration-1',
        order_id: 'order-1',
        provider: 'dine',
        status: 'success',
        retry_count: 0,
        max_retries: 12,
      }], 1]),
    };
    const service = new POSSyncService(new Map(), {
      integrationRepository: integrationRepository as any,
      syncLogRepository: syncLogRepository as any,
      orderRepository: createMemoryRepository<any>() as any,
    }, { enforceCapability: false });

    await expect(service.getSyncHistory('business-1')).rejects.toMatchObject({
      code: 'FEATURE_UNAVAILABLE',
      capability: 'pos_sync',
      message: 'Persisted POS sync log provider is disabled',
    });
  });

  it('fails closed before syncing queued POS work while POS sync is disabled', async () => {
    const { posSyncService, service, syncLogRepository } = createPOSSyncHarness();
    const guardedService = new POSSyncService(new Map([['square', service]]) as any, {
      integrationRepository: (posSyncService as any).integrationRepository,
      syncLogRepository: syncLogRepository as any,
      orderRepository: (posSyncService as any).orderRepository,
    });

    await expect(guardedService.syncOrder('order-1')).rejects.toMatchObject({
      code: 'FEATURE_UNAVAILABLE',
      capability: 'pos_sync',
    });
    expect(service.createOrder).not.toHaveBeenCalled();
    expect(syncLogRepository.rows).toHaveLength(0);
  });

  it('rejects stale persisted unapproved POS providers before creating a sync log', async () => {
    const { posSyncService, service, syncLogRepository } = createPOSSyncHarness({
      integrationOverrides: {
        provider: 'dine',
      },
    });

    await expect(posSyncService.syncOrder('order-1')).rejects.toMatchObject({
      code: 'FEATURE_UNAVAILABLE',
      capability: 'pos_sync',
      message: 'Persisted POS provider is disabled',
    });

    expect(service.createOrder).not.toHaveBeenCalled();
    expect(syncLogRepository.rows).toHaveLength(0);
  });

  it('rejects stale persisted unapproved POS providers before returning read-side rows', async () => {
    const persistedIntegration = {
      ...integration,
      is_active: true,
      error_count: 0,
      provider: 'dine',
    };
    const integrationRepository = {
      findOne: jest.fn(async () => ({ ...persistedIntegration })),
    };
    const syncLogRepository = {
      find: jest.fn(async () => [{ id: 'log-1', status: 'success' }]),
      findAndCount: jest.fn(async () => [[{ id: 'log-1', status: 'success' }], 1]),
    };
    const service = new POSSyncService(new Map(), {
      integrationRepository: integrationRepository as any,
      syncLogRepository: syncLogRepository as any,
      orderRepository: createMemoryRepository<any>() as any,
    }, { enforceCapability: false });

    await expect(service.getIntegration('business-1')).rejects.toMatchObject({
      code: 'FEATURE_UNAVAILABLE',
      capability: 'pos_sync',
      message: 'Persisted POS provider is disabled',
    });
    await expect(service.getSyncHistory('business-1')).rejects.toMatchObject({
      code: 'FEATURE_UNAVAILABLE',
      capability: 'pos_sync',
      message: 'Persisted POS provider is disabled',
    });
    await expect(service.getSyncStats('business-1')).rejects.toMatchObject({
      code: 'FEATURE_UNAVAILABLE',
      capability: 'pos_sync',
      message: 'Persisted POS provider is disabled',
    });

    expect(syncLogRepository.findAndCount).not.toHaveBeenCalled();
    expect(syncLogRepository.find).not.toHaveBeenCalled();
  });

  it('counts only attempted pending retries and skips inactive queue integrations', async () => {
    const activeIntegration = {
      ...integration,
      is_active: true,
      error_count: 0,
    };
    const createOrder = jest.fn(async () => ({
      success: true,
      pos_order_id: 'square-order-1',
    }));
    const syncLogRepository = {
      find: jest.fn(async () => [
        {
          id: 'retry-active',
          pos_integration_id: 'integration-1',
          order_id: 'order-1',
          provider: 'square',
          status: 'retry',
          retry_count: 1,
          max_retries: 12,
          error_message: 'Square rate limit exceeded',
          next_retry_at: nextRetryAt,
          order,
          pos_integration: activeIntegration,
        },
        {
          id: 'retry-inactive',
          pos_integration_id: 'integration-inactive',
          order_id: 'order-1',
          provider: 'square',
          status: 'retry',
          retry_count: 1,
          max_retries: 12,
          error_message: 'Square rate limit exceeded',
          next_retry_at: nextRetryAt,
          order,
          pos_integration: { ...activeIntegration, is_active: false },
        },
      ]),
      findOne: jest.fn(async () => null),
      save: jest.fn(async (entity) => entity),
      create: jest.fn((input) => input),
    };
    const integrationRepository = {
      findOne: jest.fn(async () => activeIntegration),
      save: jest.fn(async (entity) => entity),
    };
    const service = new POSSyncService(new Map([['square', {
      provider: 'square',
      createOrder,
      refreshAccessToken: jest.fn(async () => ({ access_token: 'fresh-token' })),
    } as IPOSService]]) as any, {
      integrationRepository: integrationRepository as any,
      syncLogRepository: syncLogRepository as any,
      orderRepository: createMemoryRepository<any>() as any,
    }, { enforceCapability: false });

    await expect(service.processPendingRetries()).resolves.toBe(1);

    expect(createOrder).toHaveBeenCalledTimes(1);
    expect(syncLogRepository.save).toHaveBeenCalledWith(expect.objectContaining({
      id: 'retry-active',
      status: 'success',
      pos_order_id: 'square-order-1',
    }));
  });

  it('validates all pending retry rows before dispatching any provider retry', async () => {
    const activeIntegration = {
      ...integration,
      is_active: true,
      error_count: 0,
    };
    const createOrder = jest.fn(async () => ({
      success: true,
      pos_order_id: 'square-order-1',
    }));
    const syncLogRepository = {
      find: jest.fn(async () => [
        {
          id: 'retry-active',
          pos_integration_id: 'integration-1',
          order_id: 'order-1',
          provider: 'square',
          status: 'retry',
          retry_count: 1,
          max_retries: 12,
          error_message: 'Square rate limit exceeded',
          next_retry_at: nextRetryAt,
          order,
          pos_integration: activeIntegration,
        },
        {
          id: 'retry-missing-order-later',
          pos_integration_id: 'integration-1',
          order_id: 'order-1',
          provider: 'square',
          status: 'retry',
          retry_count: 1,
          max_retries: 12,
          error_message: 'Square rate limit exceeded',
          next_retry_at: nextRetryAt,
          pos_integration: activeIntegration,
        },
      ]),
      findOne: jest.fn(async () => null),
      save: jest.fn(async (entity) => entity),
      create: jest.fn((input) => input),
    };
    const integrationRepository = {
      findOne: jest.fn(async () => activeIntegration),
      save: jest.fn(async (entity) => entity),
    };
    const service = new POSSyncService(new Map([['square', {
      provider: 'square',
      createOrder,
      refreshAccessToken: jest.fn(async () => ({ access_token: 'fresh-token' })),
    } as IPOSService]]) as any, {
      integrationRepository: integrationRepository as any,
      syncLogRepository: syncLogRepository as any,
      orderRepository: createMemoryRepository<any>() as any,
    }, { enforceCapability: false });

    await expect(service.processPendingRetries()).rejects.toThrow(
      'POS pending retry log retry-missing-order-later is missing order relation'
    );

    expect(createOrder).not.toHaveBeenCalled();
    expect(syncLogRepository.save).not.toHaveBeenCalled();
    expect(integrationRepository.save).not.toHaveBeenCalled();
  });

  it('rejects malformed pending retry row envelopes before provider dispatch', async () => {
    const activeIntegration = {
      ...integration,
      is_active: true,
      error_count: 0,
    };
    const createOrder = jest.fn(async () => ({
      success: true,
      pos_order_id: 'square-order-1',
    }));
    const syncLogRepository = {
      find: jest.fn(async () => [[] as unknown]),
      findOne: jest.fn(async () => null),
      save: jest.fn(async (entity) => entity),
      create: jest.fn((input) => input),
    };
    const integrationRepository = {
      findOne: jest.fn(async () => activeIntegration),
      save: jest.fn(async (entity) => entity),
    };
    const service = new POSSyncService(new Map([['square', {
      provider: 'square',
      createOrder,
      refreshAccessToken: jest.fn(async () => ({ access_token: 'fresh-token' })),
    } as IPOSService]]) as any, {
      integrationRepository: integrationRepository as any,
      syncLogRepository: syncLogRepository as any,
      orderRepository: createMemoryRepository<any>() as any,
    }, { enforceCapability: false });

    await expect(service.processPendingRetries()).rejects.toThrow(
      'POS pending retry row 1 must be an object'
    );

    expect(createOrder).not.toHaveBeenCalled();
    expect(syncLogRepository.save).not.toHaveBeenCalled();
    expect(integrationRepository.save).not.toHaveBeenCalled();
  });

  it('rejects duplicate pending retry log ids before provider dispatch', async () => {
    const activeIntegration = {
      ...integration,
      is_active: true,
      error_count: 0,
    };
    const createOrder = jest.fn(async () => ({
      success: true,
      pos_order_id: 'square-order-1',
    }));
    const syncLogRepository = {
      find: jest.fn(async () => [
        {
          id: 'retry-duplicate',
          pos_integration_id: 'integration-1',
          order_id: 'order-1',
          provider: 'square',
          status: 'retry',
          retry_count: 1,
          max_retries: 12,
          error_message: 'Square rate limit exceeded',
          next_retry_at: nextRetryAt,
          order,
          pos_integration: activeIntegration,
        },
        {
          id: 'retry-duplicate',
          pos_integration_id: 'integration-1',
          order_id: 'order-2',
          provider: 'square',
          status: 'retry',
          retry_count: 1,
          max_retries: 12,
          error_message: 'Square rate limit exceeded',
          next_retry_at: nextRetryAt,
          order: { ...order, id: 'order-2' },
          pos_integration: activeIntegration,
        },
      ]),
      findOne: jest.fn(async () => null),
      save: jest.fn(async (entity) => entity),
      create: jest.fn((input) => input),
    };
    const integrationRepository = {
      findOne: jest.fn(async () => activeIntegration),
      save: jest.fn(async (entity) => entity),
    };
    const service = new POSSyncService(new Map([['square', {
      provider: 'square',
      createOrder,
      refreshAccessToken: jest.fn(async () => ({ access_token: 'fresh-token' })),
    } as IPOSService]]) as any, {
      integrationRepository: integrationRepository as any,
      syncLogRepository: syncLogRepository as any,
      orderRepository: createMemoryRepository<any>() as any,
    }, { enforceCapability: false });

    await expect(service.processPendingRetries()).rejects.toThrow(
      'POS pending retry row 2 id must be unique'
    );

    expect(createOrder).not.toHaveBeenCalled();
    expect(syncLogRepository.save).not.toHaveBeenCalled();
    expect(integrationRepository.save).not.toHaveBeenCalled();
  });

  it('rejects pending retry rows with missing loaded relations before provider dispatch', async () => {
    const cases = [
      {
        row: {
          id: 'retry-missing-order',
          pos_integration_id: 'integration-1',
          order_id: 'order-1',
          provider: 'square',
          status: 'retry',
          retry_count: 1,
          max_retries: 12,
          error_message: 'Square rate limit exceeded',
          next_retry_at: nextRetryAt,
          pos_integration: { ...integration, is_active: true, error_count: 0 },
        },
        expectedError: 'POS pending retry log retry-missing-order is missing order relation',
      },
      {
        row: {
          id: 'retry-missing-integration',
          pos_integration_id: 'integration-1',
          order_id: 'order-1',
          provider: 'square',
          status: 'retry',
          retry_count: 1,
          max_retries: 12,
          error_message: 'Square rate limit exceeded',
          next_retry_at: nextRetryAt,
          order,
        },
        expectedError: 'POS pending retry log retry-missing-integration is missing integration relation',
      },
    ];

    for (const { row, expectedError } of cases) {
      const createOrder = jest.fn(async () => ({
        success: true,
        pos_order_id: 'square-order-1',
      }));
      const syncLogRepository = {
        find: jest.fn(async () => [row]),
        findOne: jest.fn(async () => null),
        save: jest.fn(async (entity) => entity),
        create: jest.fn((input) => input),
      };
      const integrationRepository = {
        findOne: jest.fn(async () => ({ ...integration, is_active: true, error_count: 0 })),
        save: jest.fn(async (entity) => entity),
      };
      const service = new POSSyncService(new Map([['square', {
        provider: 'square',
        createOrder,
        refreshAccessToken: jest.fn(async () => ({ access_token: 'fresh-token' })),
      } as IPOSService]]) as any, {
        integrationRepository: integrationRepository as any,
        syncLogRepository: syncLogRepository as any,
        orderRepository: createMemoryRepository<any>() as any,
      }, { enforceCapability: false });

      await expect(service.processPendingRetries()).rejects.toThrow(expectedError);
      expect(createOrder).not.toHaveBeenCalled();
      expect(syncLogRepository.save).not.toHaveBeenCalled();
      expect(integrationRepository.save).not.toHaveBeenCalled();
    }
  });

  it('rejects corrupt active pending retry relations before counting or provider dispatch', async () => {
    const cases: Array<{
      name: string;
      syncLogOverrides: Record<string, unknown>;
      orderOverride?: Record<string, unknown>;
      integrationOverride?: Record<string, unknown>;
      expectedError: string;
    }> = [
      {
        name: 'cross-order',
        syncLogOverrides: { id: 'retry-cross-order' },
        orderOverride: { id: 'order-elsewhere' },
        expectedError: 'POS pending retry log retry-cross-order order relation id must match sync log order_id',
      },
      {
        name: 'cross-integration',
        syncLogOverrides: {
          id: 'retry-cross-integration',
          pos_integration_id: 'integration-elsewhere',
        },
        expectedError:
          'POS pending retry log retry-cross-integration pos_integration_id must match requested integration',
      },
      {
        name: 'future retry cutoff',
        syncLogOverrides: {
          id: 'retry-future-cutoff',
          next_retry_at: new Date(Date.now() + 60_000),
        },
        expectedError: 'POS pending retry log retry-future-cutoff next_retry_at cannot be after retry cutoff',
      },
    ];

    for (const { syncLogOverrides, orderOverride, integrationOverride, expectedError } of cases) {
      const activeIntegration = {
        ...integration,
        is_active: true,
        error_count: 0,
        ...integrationOverride,
      };
      const relatedOrder = {
        ...order,
        ...orderOverride,
      };
      const createOrder = jest.fn(async () => ({
        success: true,
        pos_order_id: 'square-order-1',
      }));
      const syncLogRepository = {
        find: jest.fn(async () => [
          {
            id: 'retry-active',
            pos_integration_id: 'integration-1',
            order_id: 'order-1',
            provider: 'square',
            status: 'retry',
            retry_count: 1,
            max_retries: 12,
            error_message: 'Square rate limit exceeded',
            next_retry_at: nextRetryAt,
            order: relatedOrder,
            pos_integration: activeIntegration,
            ...syncLogOverrides,
          },
        ]),
        findOne: jest.fn(async () => null),
        save: jest.fn(async (entity) => entity),
        create: jest.fn((input) => input),
      };
      const integrationRepository = {
        findOne: jest.fn(async () => activeIntegration),
        save: jest.fn(async (entity) => entity),
      };
      const service = new POSSyncService(new Map([['square', {
        provider: 'square',
        createOrder,
        refreshAccessToken: jest.fn(async () => ({ access_token: 'fresh-token' })),
      } as IPOSService]]) as any, {
        integrationRepository: integrationRepository as any,
        syncLogRepository: syncLogRepository as any,
        orderRepository: createMemoryRepository<any>() as any,
      }, { enforceCapability: false });

      await expect(service.processPendingRetries()).rejects.toThrow(expectedError);
      expect(createOrder).not.toHaveBeenCalled();
      expect(syncLogRepository.save).not.toHaveBeenCalled();
      expect(integrationRepository.save).not.toHaveBeenCalled();
    }
  });

  it('returns an existing successful sync log on replay instead of creating a second POS order', async () => {
    const { posSyncService, service, syncLogRepository } = createPOSSyncHarness();

    await expect((posSyncService as any).getIntegration('business-1')).resolves.toMatchObject({
      id: 'integration-1',
    });
    const first = await posSyncService.syncOrder('order-1');
    const replay = await posSyncService.syncOrder('order-1');

    expect(first.status).toBe('success');
    expect(replay.id).toBe(first.id);
    expect(replay.pos_order_id).toBe('square-order-1');
    expect(service.createOrder).toHaveBeenCalledTimes(1);
    expect(syncLogRepository.rows.filter((row) => row.order_id === 'order-1')).toHaveLength(1);
  });

  it('rejects corrupt source order rows before POS integration lookup or provider dispatch', async () => {
    const cases = [
      {
        orderRow: { ...order, id: 'order-elsewhere' },
        expectedError: 'POS order id must match requested order',
      },
      {
        orderRow: { ...order, business_id: '   ' },
        expectedError: 'POS order business_id must be a non-empty string',
      },
    ];

    for (const { orderRow, expectedError } of cases) {
      const integrationRepository = {
        findOne: jest.fn(async () => ({ ...integration, is_active: true })),
        save: jest.fn(async (entity) => entity),
      };
      const syncLogRepository = {
        findOne: jest.fn(async () => null),
        create: jest.fn((entity) => entity),
        save: jest.fn(async (entity) => entity),
      };
      const orderRepository = {
        findOne: jest.fn(async () => ({ ...orderRow })),
      };
      const provider = {
        provider: 'square' as const,
        createOrder: jest.fn(async () => ({ success: true, pos_order_id: 'square-order-1' })),
        refreshAccessToken: jest.fn(async () => ({ access_token: 'fresh-token' })),
      };
      const service = new POSSyncService(
        new Map([['square', provider]]),
        {
          integrationRepository: integrationRepository as any,
          syncLogRepository: syncLogRepository as any,
          orderRepository: orderRepository as any,
        },
        { enforceCapability: false }
      );

      await expect(service.syncOrder('order-1')).rejects.toThrow(expectedError);

      expect(integrationRepository.findOne).not.toHaveBeenCalled();
      expect(provider.createOrder).not.toHaveBeenCalled();
      expect(syncLogRepository.findOne).not.toHaveBeenCalled();
      expect(syncLogRepository.create).not.toHaveBeenCalled();
      expect(syncLogRepository.save).not.toHaveBeenCalled();
    }
  });

  it('rejects corrupt completed sync replay rows before treating POS sync as idempotent', async () => {
    const successfulResponseAudit = { pos_order_id: 'square-order-1' };
    const successfulRequestAudit = buildPOSOrderPayload(order, integration);
    const cases = [
      {
        completedSync: {
          id: 'log-cross-order',
          pos_integration_id: 'integration-1',
          order_id: 'order-elsewhere',
          provider: 'square',
          status: 'success',
          retry_count: 0,
          pos_order_id: 'square-order-elsewhere',
          completed_at: completedAt,
        },
        expectedError: 'POS completed sync log order_id must match requested order',
      },
      {
        completedSync: {
          id: 'log-missing-provider-order',
          pos_integration_id: 'integration-1',
          order_id: 'order-1',
          provider: 'square',
          status: 'success',
          retry_count: 0,
          pos_order_id: '   ',
          completed_at: completedAt,
        },
        expectedError: 'POS completed sync log pos_order_id must be a non-empty string',
      },
      {
        completedSync: {
          id: 'log-cross-integration',
          pos_integration_id: 'integration-elsewhere',
          order_id: 'order-1',
          provider: 'square',
          status: 'success',
          retry_count: 0,
          pos_order_id: 'square-order-1',
          completed_at: completedAt,
        },
        expectedError: 'POS completed sync log pos_integration_id must match requested integration',
      },
      {
        completedSync: {
          id: 'log-missing-response-audit',
          pos_integration_id: 'integration-1',
          order_id: 'order-1',
          provider: 'square',
          status: 'success',
          retry_count: 0,
          pos_order_id: 'square-order-1',
          completed_at: completedAt,
        },
        expectedError: 'POS completed sync log response_data must be an object',
      },
      {
        completedSync: {
          id: 'log-blank-response-order',
          pos_integration_id: 'integration-1',
          order_id: 'order-1',
          provider: 'square',
          status: 'success',
          retry_count: 0,
          pos_order_id: 'square-order-1',
          response_data: { pos_order_id: '   ' },
          completed_at: completedAt,
        },
        expectedError: 'POS completed sync log response_data.pos_order_id must be a non-empty string',
      },
      {
        completedSync: {
          id: 'log-mismatched-response-order',
          pos_integration_id: 'integration-1',
          order_id: 'order-1',
          provider: 'square',
          status: 'success',
          retry_count: 0,
          pos_order_id: 'square-order-1',
          response_data: { pos_order_id: 'square-order-elsewhere' },
          completed_at: completedAt,
        },
        expectedError: 'POS completed sync log response_data.pos_order_id must match pos_order_id',
      },
      {
        completedSync: {
          id: 'log-unsupported-response-audit',
          pos_integration_id: 'integration-1',
          order_id: 'order-1',
          provider: 'square',
          status: 'success',
          retry_count: 0,
          pos_order_id: 'square-order-1',
          response_data: {
            pos_order_id: 'square-order-1',
            provider_trace_id: 'trace-1',
          },
          completed_at: completedAt,
        },
        expectedError: 'POS completed sync log response_data include unsupported field(s): provider_trace_id',
      },
      {
        completedSync: {
          id: 'log-unsafe-response-audit-field',
          pos_integration_id: 'integration-1',
          order_id: 'order-1',
          provider: 'square',
          status: 'success',
          retry_count: 0,
          pos_order_id: 'square-order-1',
          response_data: {
            pos_order_id: 'square-order-1',
            ['provider_trace_id\uFEFF']: 'trace-1',
          },
          completed_at: completedAt,
        },
        expectedError: 'POS completed sync log response_data field names must not include unsafe control characters',
      },
      {
        completedSync: {
          id: 'log-mismatched-response-metadata-business',
          pos_integration_id: 'integration-1',
          order_id: 'order-1',
          provider: 'square',
          status: 'success',
          retry_count: 0,
          pos_order_id: 'square-order-1',
          response_data: {
            pos_order_id: 'square-order-1',
            metadata: { business_id: 'business-elsewhere' },
          },
          completed_at: completedAt,
        },
        expectedError:
          'POS completed sync log response_data.metadata.business_id must match requested order business',
      },
      {
        completedSync: {
          id: 'log-unsupported-response-metadata',
          pos_integration_id: 'integration-1',
          order_id: 'order-1',
          provider: 'square',
          status: 'success',
          retry_count: 0,
          pos_order_id: 'square-order-1',
          response_data: {
            pos_order_id: 'square-order-1',
            metadata: {
              menumaker_order_id: 'order-1',
              business_id: 'business-1',
              provider_trace_id: 'trace-1',
            },
          },
          completed_at: completedAt,
        },
        expectedError:
          'POS completed sync log response_data.metadata include unsupported field(s): provider_trace_id',
      },
      {
        completedSync: {
          id: 'log-unsafe-response-metadata-field',
          pos_integration_id: 'integration-1',
          order_id: 'order-1',
          provider: 'square',
          status: 'success',
          retry_count: 0,
          pos_order_id: 'square-order-1',
          response_data: {
            pos_order_id: 'square-order-1',
            metadata: {
              menumaker_order_id: 'order-1',
              business_id: 'business-1',
              ['provider_trace_id\uFEFF']: 'trace-1',
            },
          },
          completed_at: completedAt,
        },
        expectedError:
          'POS completed sync log response_data.metadata field names must not include unsafe control characters',
      },
      {
        completedSync: {
          id: 'log-missing-request-audit',
          pos_integration_id: 'integration-1',
          order_id: 'order-1',
          provider: 'square',
          status: 'success',
          retry_count: 0,
          pos_order_id: 'square-order-1',
          response_data: successfulResponseAudit,
          completed_at: completedAt,
        },
        expectedError: 'POS completed sync log request_payload must be an object',
      },
      {
        completedSync: {
          id: 'log-mismatched-request-idempotency-key',
          pos_integration_id: 'integration-1',
          order_id: 'order-1',
          provider: 'square',
          status: 'success',
          retry_count: 0,
          pos_order_id: 'square-order-1',
          response_data: successfulResponseAudit,
          request_payload: {
            ...successfulRequestAudit,
            idempotency_key: 'menumaker-order-order-elsewhere',
          },
          completed_at: completedAt,
        },
        expectedError: 'POS completed sync log request_payload.idempotency_key must match requested order',
      },
      {
        completedSync: {
          id: 'log-unsupported-request-audit',
          pos_integration_id: 'integration-1',
          order_id: 'order-1',
          provider: 'square',
          status: 'success',
          retry_count: 0,
          pos_order_id: 'square-order-1',
          response_data: successfulResponseAudit,
          request_payload: {
            ...successfulRequestAudit,
            provider_trace_id: 'trace-1',
          },
          completed_at: completedAt,
        },
        expectedError: 'POS completed sync log request_payload include unsupported field(s): provider_trace_id',
      },
      {
        completedSync: {
          id: 'log-unsafe-request-audit-field',
          pos_integration_id: 'integration-1',
          order_id: 'order-1',
          provider: 'square',
          status: 'success',
          retry_count: 0,
          pos_order_id: 'square-order-1',
          response_data: successfulResponseAudit,
          request_payload: {
            ...successfulRequestAudit,
            ['provider_trace_id\uFEFF']: 'trace-1',
          },
          completed_at: completedAt,
        },
        expectedError: 'POS completed sync log request_payload field names must not include unsafe control characters',
      },
      {
        completedSync: {
          id: 'log-missing-request-location',
          pos_integration_id: 'integration-1',
          order_id: 'order-1',
          provider: 'square',
          status: 'success',
          retry_count: 0,
          pos_order_id: 'square-order-1',
          response_data: successfulResponseAudit,
          request_payload: {
            ...successfulRequestAudit,
            order: {
              ...(successfulRequestAudit.order as Record<string, unknown>),
              location_id: '   ',
            },
          },
          completed_at: completedAt,
        },
        expectedError: 'POS completed sync log request_payload.order.location_id must be a non-empty string',
      },
      {
        completedSync: {
          id: 'log-mismatched-request-location',
          pos_integration_id: 'integration-1',
          order_id: 'order-1',
          provider: 'square',
          status: 'success',
          retry_count: 0,
          pos_order_id: 'square-order-1',
          response_data: successfulResponseAudit,
          request_payload: {
            ...successfulRequestAudit,
            order: {
              ...(successfulRequestAudit.order as Record<string, unknown>),
              location_id: 'location-elsewhere',
            },
          },
          completed_at: completedAt,
        },
        expectedError: 'POS completed sync log request_payload.order.location_id must match active integration location',
      },
      {
        completedSync: {
          id: 'log-unsupported-request-order-audit',
          pos_integration_id: 'integration-1',
          order_id: 'order-1',
          provider: 'square',
          status: 'success',
          retry_count: 0,
          pos_order_id: 'square-order-1',
          response_data: successfulResponseAudit,
          request_payload: {
            ...successfulRequestAudit,
            order: {
              ...(successfulRequestAudit.order as Record<string, unknown>),
              provider_trace_id: 'trace-1',
            },
          },
          completed_at: completedAt,
        },
        expectedError: 'POS completed sync log request_payload.order include unsupported field(s): provider_trace_id',
      },
      {
        completedSync: {
          id: 'log-unsafe-request-order-audit-field',
          pos_integration_id: 'integration-1',
          order_id: 'order-1',
          provider: 'square',
          status: 'success',
          retry_count: 0,
          pos_order_id: 'square-order-1',
          response_data: successfulResponseAudit,
          request_payload: {
            ...successfulRequestAudit,
            order: {
              ...(successfulRequestAudit.order as Record<string, unknown>),
              ['provider_trace_id\uFEFF']: 'trace-1',
            },
          },
          completed_at: completedAt,
        },
        expectedError: 'POS completed sync log request_payload.order field names must not include unsafe control characters',
      },
      {
        completedSync: {
          id: 'log-mismatched-request-business',
          pos_integration_id: 'integration-1',
          order_id: 'order-1',
          provider: 'square',
          status: 'success',
          retry_count: 0,
          pos_order_id: 'square-order-1',
          response_data: successfulResponseAudit,
          request_payload: {
            ...successfulRequestAudit,
            order: {
              ...(successfulRequestAudit.order as Record<string, unknown>),
              metadata: {
                ...((successfulRequestAudit.order as Record<string, any>).metadata as Record<string, unknown>),
                business_id: 'business-elsewhere',
              },
            },
          },
          completed_at: completedAt,
        },
        expectedError: 'POS completed sync log request_payload.order.metadata.business_id must match requested order business',
      },
      {
        completedSync: {
          id: 'log-mismatched-request-source',
          pos_integration_id: 'integration-1',
          order_id: 'order-1',
          provider: 'square',
          status: 'success',
          retry_count: 0,
          pos_order_id: 'square-order-1',
          response_data: successfulResponseAudit,
          request_payload: {
            ...successfulRequestAudit,
            order: {
              ...(successfulRequestAudit.order as Record<string, unknown>),
              metadata: {
                ...((successfulRequestAudit.order as Record<string, any>).metadata as Record<string, unknown>),
                source: 'ImportedSystem',
              },
            },
          },
          completed_at: completedAt,
        },
        expectedError: 'POS completed sync log request_payload.order.metadata.source must be MenuMaker',
      },
      {
        completedSync: {
          id: 'log-unsupported-request-metadata',
          pos_integration_id: 'integration-1',
          order_id: 'order-1',
          provider: 'square',
          status: 'success',
          retry_count: 0,
          pos_order_id: 'square-order-1',
          response_data: successfulResponseAudit,
          request_payload: {
            ...successfulRequestAudit,
            order: {
              ...(successfulRequestAudit.order as Record<string, unknown>),
              metadata: {
                ...((successfulRequestAudit.order as Record<string, any>).metadata as Record<string, unknown>),
                provider_trace_id: 'trace-1',
              },
            },
          },
          completed_at: completedAt,
        },
        expectedError:
          'POS completed sync log request_payload.order.metadata include unsupported field(s): provider_trace_id',
      },
      {
        completedSync: {
          id: 'log-unsafe-request-metadata-field',
          pos_integration_id: 'integration-1',
          order_id: 'order-1',
          provider: 'square',
          status: 'success',
          retry_count: 0,
          pos_order_id: 'square-order-1',
          response_data: successfulResponseAudit,
          request_payload: {
            ...successfulRequestAudit,
            order: {
              ...(successfulRequestAudit.order as Record<string, unknown>),
              metadata: {
                ...((successfulRequestAudit.order as Record<string, any>).metadata as Record<string, unknown>),
                ['provider_trace_id\uFEFF']: 'trace-1',
              },
            },
          },
          completed_at: completedAt,
        },
        expectedError:
          'POS completed sync log request_payload.order.metadata field names must not include unsafe control characters',
      },
    ];

    for (const { completedSync, expectedError } of cases) {
      const integrationRepository = createMemoryRepository<any>([{ ...integration, is_active: true }]);
      const syncLogRepository = {
        findOne: jest.fn(async () => ({ ...completedSync })),
        create: jest.fn((entity) => entity),
        save: jest.fn(async (entity) => entity),
      };
      const orderRepository = {
        findOne: jest.fn(async () => ({ ...order })),
      };
      const provider = {
        provider: 'square' as const,
        createOrder: jest.fn(async () => ({ success: true, pos_order_id: 'square-order-1' })),
        refreshAccessToken: jest.fn(async () => ({ access_token: 'fresh-token' })),
      };
      const service = new POSSyncService(
        new Map([['square', provider]]),
        {
          integrationRepository: integrationRepository as any,
          syncLogRepository: syncLogRepository as any,
          orderRepository: orderRepository as any,
        },
        { enforceCapability: false }
      );

      await expect(service.syncOrder('order-1')).rejects.toThrow(expectedError);

      expect(provider.createOrder).not.toHaveBeenCalled();
      expect(syncLogRepository.create).not.toHaveBeenCalled();
      expect(syncLogRepository.save).not.toHaveBeenCalled();
    }
  });

  it('normalizes POS order ids before order lookup and sync-log idempotency checks', async () => {
    const { posSyncService, service, syncLogRepository } = createPOSSyncHarness();

    const syncLog = await posSyncService.syncOrder(' order-1 ');

    expect(syncLog).toMatchObject({
      status: 'success',
      order_id: 'order-1',
      pos_order_id: 'square-order-1',
    });
    expect(service.createOrder).toHaveBeenCalledTimes(1);
    expect(syncLogRepository.rows.filter((row) => row.order_id === 'order-1')).toHaveLength(1);
    expect(syncLogRepository.rows.some((row) => row.order_id === ' order-1 ')).toBe(false);
  });

  it('refreshes an expired token once across concurrent syncs and reuses the fresh credentials', async () => {
    const createOrder = jest.fn(async (_orderToSync, integrationForSync) => ({
      success: true,
      pos_order_id: `square-${integrationForSync.access_token}-${_orderToSync.id}`,
    }));
    const refreshAccessToken = jest.fn(async () => ({
      access_token: 'fresh-access-token',
      refresh_token: 'fresh-refresh-token',
      expires_at: new Date(Date.now() + 60 * 60 * 1000),
    }));
    const { posSyncService, integrationRepository } = createPOSSyncHarness({
      integrationOverrides: {
        access_token: 'expired-access-token',
        refresh_token: 'refresh-token',
        token_expires_at: new Date(Date.now() - 60 * 1000),
      },
      orders: [
        order,
        { ...order, id: 'order-2' },
      ],
      service: {
        createOrder,
        refreshAccessToken,
      },
    });

    const [first, second] = await Promise.all([
      posSyncService.syncOrder('order-1'),
      posSyncService.syncOrder('order-2'),
    ]);

    expect(first.status).toBe('success');
    expect(second.status).toBe('success');
    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(createOrder).toHaveBeenCalledTimes(2);
    expect(createOrder.mock.calls.map(([, integrationForSync]) => integrationForSync.access_token))
      .toEqual(['fresh-access-token', 'fresh-access-token']);
    expect(integrationRepository.rows[0]).toMatchObject({
      access_token: 'fresh-access-token',
      refresh_token: 'fresh-refresh-token',
      error_count: 0,
      last_error: null,
    });
  });

  it('preserves existing refresh tokens when POS token refresh omits token rotation', async () => {
    const createOrder = jest.fn(async (_orderToSync, integrationForSync) => ({
      success: true,
      pos_order_id: `square-${integrationForSync.access_token}-${_orderToSync.id}`,
    }));
    const refreshAccessToken = jest.fn(async () => ({
      access_token: 'fresh-access-token',
      expires_at: new Date(Date.now() + 60 * 60 * 1000),
    }));
    const { posSyncService, integrationRepository } = createPOSSyncHarness({
      integrationOverrides: {
        access_token: 'expired-access-token',
        refresh_token: 'existing-refresh-token',
        token_expires_at: new Date(Date.now() - 60 * 1000),
      },
      service: {
        createOrder,
        refreshAccessToken,
      },
    });

    const syncLog = await posSyncService.syncOrder('order-1');

    expect(syncLog.status).toBe('success');
    expect(createOrder).toHaveBeenCalledWith(expect.any(Object), expect.objectContaining({
      access_token: 'fresh-access-token',
      refresh_token: 'existing-refresh-token',
    }));
    expect(integrationRepository.rows[0]).toMatchObject({
      access_token: 'fresh-access-token',
      refresh_token: 'existing-refresh-token',
      error_count: 0,
      last_error: null,
    });
  });

  it('records retryable provider failures with retry delay and audit fields', async () => {
    const { posSyncService, integrationRepository } = createPOSSyncHarness({
      service: {
        createOrder: jest.fn(async () => {
          throw new POSSyncError('Square rate limit exceeded', 'rate_limited', 429, 1234);
        }),
      },
    });

    const syncLog = await posSyncService.syncOrder('order-1');

    expect(syncLog).toMatchObject({
      status: 'retry',
      retry_count: 1,
      http_status: 429,
      error_message: 'Square rate limit exceeded',
    });
    expect(syncLog.next_retry_at).toBeInstanceOf(Date);
    expect(integrationRepository.rows[0]).toMatchObject({
      error_count: 1,
      last_error: 'Square rate limit exceeded',
    });
  });

  it('clears stale failure markers when a retried POS sync succeeds', async () => {
    const { posSyncService, syncLogRepository } = createPOSSyncHarness({
      service: {
        createOrder: jest.fn(async () => ({
          success: true,
          pos_order_id: ' square-order-recovered ',
        })),
      },
    });
    const retryLog = {
      id: 'retry-with-stale-error',
      pos_integration_id: 'integration-1',
      order_id: order.id,
      provider: 'square',
      status: 'retry',
      retry_count: 1,
      max_retries: 12,
      error_message: 'Previous timeout',
      http_status: 429,
      next_retry_at: new Date('2026-06-27T02:00:00.000Z'),
    };

    await (posSyncService as any).attemptSync(retryLog, order, {
      ...integration,
      is_active: true,
      error_count: 1,
      last_error: 'Previous timeout',
    });

    expect(retryLog).toMatchObject({
      status: 'success',
      pos_order_id: 'square-order-recovered',
      error_message: null,
      http_status: null,
      next_retry_at: null,
      response_data: { pos_order_id: 'square-order-recovered' },
    });
    expect(retryLog.completed_at).toBeInstanceOf(Date);
    expect(syncLogRepository.rows.at(-1)).toMatchObject({
      status: 'success',
      pos_order_id: 'square-order-recovered',
      error_message: null,
      http_status: null,
      next_retry_at: null,
      response_data: { pos_order_id: 'square-order-recovered' },
    });
  });

  it('clears stale success markers when a retried POS sync fails again', async () => {
    const { posSyncService, integrationRepository, syncLogRepository } = createPOSSyncHarness({
      service: {
        createOrder: jest.fn(async () => {
          throw new POSSyncError('Square temporary failure', 'retryable', 503);
        }),
      },
    });
    const retryLog = {
      id: 'retry-with-stale-success',
      pos_integration_id: 'integration-1',
      order_id: order.id,
      provider: 'square',
      status: 'retry',
      retry_count: 1,
      max_retries: 12,
      pos_order_id: 'stale-square-order',
      response_data: { pos_order_id: 'stale-square-order' },
      completed_at: new Date('2026-06-27T01:00:00.000Z'),
    };
    const integrationForAttempt = {
      ...integrationRepository.rows[0],
      error_count: 1,
      last_error: 'Previous timeout',
    };

    await (posSyncService as any).attemptSync(retryLog, order, integrationForAttempt);

    expect(retryLog).toMatchObject({
      status: 'retry',
      retry_count: 2,
      error_message: 'Square temporary failure',
      http_status: 503,
      pos_order_id: null,
      response_data: null,
      completed_at: null,
    });
    expect(retryLog.next_retry_at).toBeInstanceOf(Date);
    expect(syncLogRepository.rows.at(-1)).toMatchObject({
      status: 'retry',
      retry_count: 2,
      error_message: 'Square temporary failure',
      http_status: 503,
      pos_order_id: null,
      response_data: null,
      completed_at: null,
    });
  });

  it('rejects corrupt retry counters before mutating sync state or calling the provider', async () => {
    const { posSyncService, service, integrationRepository, syncLogRepository } = createPOSSyncHarness();
    const syncLog = {
      id: 'log-corrupt-retry',
      pos_integration_id: 'integration-1',
      order_id: order.id,
      provider: 'square',
      status: 'retry',
      retry_count: Number.MAX_SAFE_INTEGER + 1,
      max_retries: 12,
    };
    const integrationForAttempt = {
      ...integrationRepository.rows[0],
    };

    await expect(
      (posSyncService as any).attemptSync(syncLog, order, integrationForAttempt)
    ).rejects.toMatchObject({
      kind: 'permanent',
      message: 'POS sync retry_count for log log-corrupt-retry must be a safe integer',
    } satisfies Partial<POSSyncError>);

    expect(syncLog.status).toBe('retry');
    expect(service.createOrder).not.toHaveBeenCalled();
    expect(syncLogRepository.rows).toHaveLength(0);
    expect(integrationRepository.rows[0].error_count).toBe(0);
  });

  it('rejects corrupt integration error counters before mutating sync state or calling the provider', async () => {
    const { posSyncService, service, integrationRepository, syncLogRepository } = createPOSSyncHarness();
    const syncLog = {
      id: 'log-corrupt-integration',
      pos_integration_id: 'integration-1',
      order_id: order.id,
      provider: 'square',
      status: 'retry',
      retry_count: 1,
      max_retries: 12,
    };
    const integrationForAttempt = {
      ...integrationRepository.rows[0],
      error_count: Number.MAX_SAFE_INTEGER,
    };

    await expect(
      (posSyncService as any).attemptSync(syncLog, order, integrationForAttempt)
    ).rejects.toMatchObject({
      kind: 'permanent',
      message: 'POS integration error_count for integration integration-1 must remain a safe integer after increment',
    } satisfies Partial<POSSyncError>);

    expect(syncLog.status).toBe('retry');
    expect(service.createOrder).not.toHaveBeenCalled();
    expect(syncLogRepository.rows).toHaveLength(0);
    expect(integrationRepository.rows[0].error_count).toBe(0);
  });

  it('rejects retry counts beyond the configured maximum before provider dispatch', async () => {
    const { posSyncService, service, syncLogRepository } = createPOSSyncHarness();
    const syncLog = {
      id: 'log-invalid-budget',
      pos_integration_id: 'integration-1',
      order_id: order.id,
      provider: 'square',
      status: 'retry',
      retry_count: 4,
      max_retries: 3,
    };

    await expect(
      (posSyncService as any).attemptSync(syncLog, order, {
        ...integration,
        error_count: 0,
      })
    ).rejects.toMatchObject({
      kind: 'permanent',
      message: 'POS sync retry_count for log log-invalid-budget cannot exceed max_retries',
    } satisfies Partial<POSSyncError>);

    expect(syncLog.status).toBe('retry');
    expect(service.createOrder).not.toHaveBeenCalled();
    expect(syncLogRepository.rows).toHaveLength(0);
  });

  it('rejects cross-linked POS sync attempt relations before mutating sync state or calling the provider', async () => {
    const cases = [
      {
        syncLogOverrides: { order_id: 'order-elsewhere' },
        orderOverrides: {},
        integrationOverrides: {},
        expectedError: 'POS sync attempt log log-cross-linked order_id must match order relation id',
      },
      {
        syncLogOverrides: { pos_integration_id: 'integration-elsewhere' },
        orderOverrides: {},
        integrationOverrides: {},
        expectedError: 'POS sync attempt log log-cross-linked pos_integration_id must match integration relation id',
      },
      {
        syncLogOverrides: {},
        orderOverrides: { business_id: 'business-elsewhere' },
        integrationOverrides: {},
        expectedError: 'POS sync attempt log log-cross-linked integration business_id must match order business_id',
      },
      {
        syncLogOverrides: { provider: 'square' },
        orderOverrides: {},
        integrationOverrides: { provider: 'dine' },
        expectedError: 'POS sync attempt integration provider is disabled',
      },
    ];

    for (const { syncLogOverrides, orderOverrides, integrationOverrides, expectedError } of cases) {
      const { posSyncService, service, syncLogRepository } = createPOSSyncHarness();
      const syncLog = {
        id: 'log-cross-linked',
        pos_integration_id: 'integration-1',
        order_id: order.id,
        provider: 'square',
        status: 'retry',
        retry_count: 1,
        max_retries: 12,
        ...syncLogOverrides,
      };

      await expect(
        (posSyncService as any).attemptSync(
          syncLog,
          { ...order, ...orderOverrides },
          { ...integration, ...integrationOverrides }
        )
      ).rejects.toThrow(expectedError);

      expect(syncLog.status).toBe('retry');
      expect(service.createOrder).not.toHaveBeenCalled();
      expect(syncLogRepository.rows).toHaveLength(0);
    }
  });

  it('rejects malformed provider success responses before marking POS sync successful', async () => {
    const { posSyncService, integrationRepository } = createPOSSyncHarness({
      service: {
        createOrder: jest.fn(async () => ({
          success: true,
        })),
      },
    });

    const syncLog = await posSyncService.syncOrder('order-1');

    expect(syncLog).toMatchObject({
      status: 'failed',
      retry_count: 1,
      error_message: 'POS provider success response must include pos_order_id',
    });
    expect(syncLog.pos_order_id).toBeNull();
    expect(syncLog.completed_at).toBeInstanceOf(Date);
    expect(integrationRepository.rows[0]).toMatchObject({
      error_count: 1,
      last_error: 'POS provider success response must include pos_order_id',
    });
  });

  it.each([
    {
      name: 'null response',
      providerResult: null,
      expectedError: 'POS provider order creation response must be an object',
    },
    {
      name: 'non-boolean success marker',
      providerResult: { success: 'yes', pos_order_id: 'square-order-1' },
      expectedError: 'POS provider order creation response success must be a boolean',
    },
    {
      name: 'success with provider error',
      providerResult: { success: true, pos_order_id: 'square-order-1', error: 'warning' },
      expectedError: 'POS provider success response error cannot be present',
    },
    {
      name: 'success with unsupported provider trace field',
      providerResult: {
        success: true,
        pos_order_id: 'square-order-1',
        provider_trace_id: 'trace-1',
      },
      expectedError: 'POS provider order creation response include unsupported field(s): provider_trace_id',
    },
    {
      name: 'success with unsafe provider trace field name',
      providerResult: {
        success: true,
        pos_order_id: 'square-order-1',
        '\uFEFFprovider_trace_id': 'trace-1',
      },
      expectedError:
        'POS provider order creation response field names must not include unsafe control characters',
    },
    {
      name: 'non-string success provider order id',
      providerResult: { success: true, pos_order_id: 123 },
      expectedError: 'POS provider success response pos_order_id must be a string',
    },
    {
      name: 'oversized success provider order id',
      providerResult: { success: true, pos_order_id: 'p'.repeat(256) },
      expectedError: 'POS provider success response pos_order_id must be at most 255 characters',
    },
    {
      name: 'success provider order id with unsafe controls',
      providerResult: { success: true, pos_order_id: 'square-order-\u00001' },
      expectedError: 'POS provider success response pos_order_id must not include unsafe control characters',
    },
    {
      name: 'success provider order id with invisible unsafe controls',
      providerResult: { success: true, pos_order_id: 'square-order-\u202E1' },
      expectedError: 'POS provider success response pos_order_id must not include unsafe control characters',
    },
    {
      name: 'success provider order id with edge unsafe controls',
      providerResult: { success: true, pos_order_id: '\uFEFFsquare-order-1' },
      expectedError: 'POS provider success response pos_order_id must not include unsafe control characters',
    },
    {
      name: 'success with mismatched provider reference id',
      providerResult: {
        success: true,
        pos_order_id: 'square-order-1',
        reference_id: 'order-elsewhere',
      },
      expectedError: 'POS provider success response reference_id must match requested order',
    },
    {
      name: 'success with oversized provider reference id',
      providerResult: {
        success: true,
        pos_order_id: 'square-order-1',
        reference_id: 'r'.repeat(256),
      },
      expectedError: 'POS provider success response reference_id must be at most 255 characters',
    },
    {
      name: 'success with mismatched provider location',
      providerResult: {
        success: true,
        pos_order_id: 'square-order-1',
        location_id: 'location-elsewhere',
      },
      expectedError: 'POS provider success response location_id must match active integration location',
    },
    {
      name: 'success with oversized provider location',
      providerResult: {
        success: true,
        pos_order_id: 'square-order-1',
        location_id: 'l'.repeat(256),
      },
      expectedError: 'POS provider success response location_id must be at most 255 characters',
    },
    {
      name: 'success with malformed provider metadata',
      providerResult: {
        success: true,
        pos_order_id: 'square-order-1',
        metadata: [],
      },
      expectedError: 'POS provider success response metadata must be an object',
    },
    {
      name: 'success with mismatched provider metadata order',
      providerResult: {
        success: true,
        pos_order_id: 'square-order-1',
        metadata: { menumaker_order_id: 'order-elsewhere' },
      },
      expectedError: 'POS provider success response metadata.menumaker_order_id must match requested order',
    },
    {
      name: 'success with oversized provider metadata order',
      providerResult: {
        success: true,
        pos_order_id: 'square-order-1',
        metadata: { menumaker_order_id: 'o'.repeat(256) },
      },
      expectedError:
        'POS provider success response metadata.menumaker_order_id must be at most 255 characters',
    },
    {
      name: 'success with mismatched provider metadata business',
      providerResult: {
        success: true,
        pos_order_id: 'square-order-1',
        metadata: { business_id: 'business-elsewhere' },
      },
      expectedError: 'POS provider success response metadata.business_id must match requested order business',
    },
    {
      name: 'success with oversized provider metadata business',
      providerResult: {
        success: true,
        pos_order_id: 'square-order-1',
        metadata: { business_id: 'b'.repeat(256) },
      },
      expectedError: 'POS provider success response metadata.business_id must be at most 255 characters',
    },
    {
      name: 'success provider metadata with unsafe controls',
      providerResult: {
        success: true,
        pos_order_id: 'square-order-1',
        metadata: { menumaker_order_id: 'order-\u00001' },
      },
      expectedError:
        'POS provider success response metadata.menumaker_order_id must not include unsafe control characters',
    },
    {
      name: 'success provider metadata with invisible unsafe controls',
      providerResult: {
        success: true,
        pos_order_id: 'square-order-1',
        metadata: { menumaker_order_id: 'order-\u200B1' },
      },
      expectedError:
        'POS provider success response metadata.menumaker_order_id must not include unsafe control characters',
    },
    {
      name: 'success provider metadata with edge unsafe controls',
      providerResult: {
        success: true,
        pos_order_id: 'square-order-1',
        metadata: { menumaker_order_id: 'order-1\uFEFF' },
      },
      expectedError:
        'POS provider success response metadata.menumaker_order_id must not include unsafe control characters',
    },
    {
      name: 'success provider metadata with unsupported field',
      providerResult: {
        success: true,
        pos_order_id: 'square-order-1',
        metadata: {
          menumaker_order_id: 'order-1',
          business_id: 'business-1',
          provider_trace_id: 'trace-1',
        },
      },
      expectedError: 'POS provider success response metadata include unsupported field(s): provider_trace_id',
    },
    {
      name: 'success provider metadata with unsafe field name',
      providerResult: {
        success: true,
        pos_order_id: 'square-order-1',
        metadata: {
          menumaker_order_id: 'order-1',
          business_id: 'business-1',
          'provider_trace_id\uFEFF': 'trace-1',
        },
      },
      expectedError:
        'POS provider success response metadata field names must not include unsafe control characters',
    },
    {
      name: 'failure without error',
      providerResult: { success: false },
      expectedError: 'POS provider failure response error must be a non-empty string',
    },
    {
      name: 'failure with blank error',
      providerResult: { success: false, error: '   ' },
      expectedError: 'POS provider failure response error must be a non-empty string',
    },
    {
      name: 'failure error with unsafe controls',
      providerResult: { success: false, error: 'rejected\u0007by provider' },
      expectedError: 'POS provider failure response error must not include unsafe control characters',
    },
    {
      name: 'failure error with invisible unsafe controls',
      providerResult: { success: false, error: 'rejected\u2060by provider' },
      expectedError: 'POS provider failure response error must not include unsafe control characters',
    },
    {
      name: 'failure error with edge unsafe controls',
      providerResult: { success: false, error: '\uFEFFrejected by provider' },
      expectedError: 'POS provider failure response error must not include unsafe control characters',
    },
    {
      name: 'failure with unsupported provider trace field',
      providerResult: {
        success: false,
        error: 'rejected',
        provider_trace_id: 'trace-1',
      },
      expectedError: 'POS provider order creation response include unsupported field(s): provider_trace_id',
    },
    {
      name: 'failure with unsafe provider trace field name',
      providerResult: {
        success: false,
        error: 'rejected',
        'provider_trace_id\uFEFF': 'trace-1',
      },
      expectedError:
        'POS provider order creation response field names must not include unsafe control characters',
    },
    {
      name: 'failure with stale provider order id',
      providerResult: { success: false, error: 'rejected', pos_order_id: 'stale-square-order' },
      expectedError: 'POS provider failure response cannot include success field(s): pos_order_id',
    },
    {
      name: 'failure with stale reference id',
      providerResult: { success: false, error: 'rejected', reference_id: 'order-1' },
      expectedError: 'POS provider failure response cannot include success field(s): reference_id',
    },
    {
      name: 'failure with stale location id',
      providerResult: { success: false, error: 'rejected', location_id: 'location-1' },
      expectedError: 'POS provider failure response cannot include success field(s): location_id',
    },
    {
      name: 'failure with stale metadata',
      providerResult: {
        success: false,
        error: 'rejected',
        metadata: { menumaker_order_id: 'order-1', business_id: 'business-1' },
      },
      expectedError: 'POS provider failure response cannot include success field(s): metadata',
    },
    {
      name: 'failure with all stale success evidence',
      providerResult: {
        success: false,
        error: 'rejected',
        pos_order_id: 'stale-square-order',
        reference_id: 'order-1',
        location_id: 'location-1',
        metadata: { menumaker_order_id: 'order-1', business_id: 'business-1' },
      },
      expectedError:
        'POS provider failure response cannot include success field(s): pos_order_id, reference_id, location_id, metadata',
    },
  ])('rejects malformed POS provider creation envelopes: $name', async ({ providerResult, expectedError }) => {
    const { posSyncService, integrationRepository } = createPOSSyncHarness({
      service: {
        createOrder: jest.fn(async () => providerResult as any),
      },
    });

    const syncLog = await posSyncService.syncOrder('order-1');

    expect(syncLog).toMatchObject({
      status: 'failed',
      retry_count: 1,
      error_message: expectedError,
      pos_order_id: null,
      response_data: null,
    });
    expect(syncLog.completed_at).toBeInstanceOf(Date);
    expect(syncLog.next_retry_at).toBeNull();
    expect(integrationRepository.rows[0]).toMatchObject({
      error_count: 1,
      last_error: expectedError,
    });
    expect(integrationRepository.rows[0].last_sync_at).toBeUndefined();
  });

  it('normalizes provider success order ids before sync-log persistence and response audit data', async () => {
    const { posSyncService, syncLogRepository } = createPOSSyncHarness({
      service: {
        createOrder: jest.fn(async () => ({
          success: true,
          pos_order_id: ' square-order-1 ',
          reference_id: ' order-1 ',
          location_id: ' location-1 ',
          metadata: {
            menumaker_order_id: ' order-1 ',
            business_id: ' business-1 ',
          },
        })),
      },
    });

    const syncLog = await posSyncService.syncOrder('order-1');

    expect(syncLog).toMatchObject({
      status: 'success',
      pos_order_id: 'square-order-1',
      response_data: {
        pos_order_id: 'square-order-1',
        reference_id: 'order-1',
        location_id: 'location-1',
        metadata: {
          menumaker_order_id: 'order-1',
          business_id: 'business-1',
        },
      },
    });
    expect(syncLogRepository.rows[0]).toMatchObject({
      status: 'success',
      pos_order_id: 'square-order-1',
      response_data: {
        pos_order_id: 'square-order-1',
        reference_id: 'order-1',
        location_id: 'location-1',
        metadata: {
          menumaker_order_id: 'order-1',
          business_id: 'business-1',
        },
      },
    });
  });

  it('records invalid local order payloads as permanent failed syncs before provider calls', async () => {
    const createOrder = jest.fn();
    const { posSyncService, integrationRepository } = createPOSSyncHarness({
      orders: [{
        ...order,
        items: [{ dish_id: 'dish-1', dish_name: 'Idli', quantity: -1, unit_price_cents: 12000 }],
      }],
      service: {
        createOrder,
      },
    });

    const syncLog = await posSyncService.syncOrder('order-1');

    expect(syncLog).toMatchObject({
      status: 'failed',
      retry_count: 1,
      error_message: 'Quantity for dish dish-1 must be a positive integer quantity',
    });
    expect(createOrder).not.toHaveBeenCalled();
    expect(integrationRepository.rows[0]).toMatchObject({
      error_count: 1,
      last_error: 'Quantity for dish dish-1 must be a positive integer quantity',
    });
  });

  it('fails revoked credentials permanently before writing a provider order', async () => {
    const createOrder = jest.fn();
    const { posSyncService, integrationRepository } = createPOSSyncHarness({
      integrationOverrides: {
        token_expires_at: new Date(Date.now() - 60 * 1000),
      },
      service: {
        createOrder,
        refreshAccessToken: jest.fn(async () => {
          throw new POSSyncError('Square token refresh rejected', 'permanent', 400);
        }),
      },
    });

    const syncLog = await posSyncService.syncOrder('order-1');

    expect(syncLog).toMatchObject({
      status: 'failed',
      retry_count: 1,
      http_status: 400,
      error_message: 'Square token refresh rejected',
    });
    expect(syncLog.completed_at).toBeInstanceOf(Date);
    expect(createOrder).not.toHaveBeenCalled();
    expect(integrationRepository.rows[0]).toMatchObject({
      error_count: 1,
      last_error: 'Square token refresh rejected',
    });
  });

  it('rejects malformed refreshed token expiry before mutating POS credentials', async () => {
    const createOrder = jest.fn();
    const { posSyncService, integrationRepository } = createPOSSyncHarness({
      integrationOverrides: {
        access_token: 'expired-access-token',
        refresh_token: 'refresh-token',
        token_expires_at: new Date(Date.now() - 60 * 1000),
      },
      service: {
        createOrder,
        refreshAccessToken: jest.fn(async () => ({
          access_token: 'fresh-access-token',
          refresh_token: 'fresh-refresh-token',
          expires_at: new Date('not-a-date'),
        })),
      },
    });

    const syncLog = await posSyncService.syncOrder('order-1');

    expect(syncLog).toMatchObject({
      status: 'failed',
      retry_count: 1,
      error_message: 'POS token refresh expires_at must be a valid Date',
    });
    expect(createOrder).not.toHaveBeenCalled();
    expect(integrationRepository.rows[0]).toMatchObject({
      access_token: 'expired-access-token',
      refresh_token: 'refresh-token',
      last_error: 'POS token refresh expires_at must be a valid Date',
    });
  });

  it.each([
    [
      'access token',
      { access_token: 'a'.repeat(2049), refresh_token: 'fresh-refresh-token' },
      'POS token refresh access_token must be at most 2048 characters',
    ],
    [
      'refresh token',
      { access_token: 'fresh-access-token', refresh_token: 'r'.repeat(2049) },
      'POS token refresh refresh_token must be at most 2048 characters',
    ],
  ])('rejects oversized POS token refresh %s before mutating credentials', async (
    _caseName,
    tokenOverrides,
    expectedMessage
  ) => {
    const createOrder = jest.fn();
    const { posSyncService, integrationRepository } = createPOSSyncHarness({
      integrationOverrides: {
        access_token: 'expired-access-token',
        refresh_token: 'refresh-token',
        token_expires_at: new Date(Date.now() - 60 * 1000),
      },
      service: {
        createOrder,
        refreshAccessToken: jest.fn(async () => ({
          access_token: 'fresh-access-token',
          refresh_token: 'fresh-refresh-token',
          expires_at: new Date(Date.now() + 60 * 60 * 1000),
          ...tokenOverrides,
        })),
      },
    });

    const syncLog = await posSyncService.syncOrder('order-1');

    expect(syncLog).toMatchObject({
      status: 'failed',
      retry_count: 1,
      error_message: expectedMessage,
    });
    expect(createOrder).not.toHaveBeenCalled();
    expect(integrationRepository.rows[0]).toMatchObject({
      access_token: 'expired-access-token',
      refresh_token: 'refresh-token',
      last_error: expectedMessage,
    });
  });

  it('rejects contaminated POS token refresh envelopes before mutating credentials', async () => {
    const createOrder = jest.fn();
    const { posSyncService, integrationRepository } = createPOSSyncHarness({
      integrationOverrides: {
        access_token: 'expired-access-token',
        refresh_token: 'refresh-token',
        token_expires_at: new Date(Date.now() - 60 * 1000),
      },
      service: {
        createOrder,
        refreshAccessToken: jest.fn(async () => ({
          access_token: 'fresh-access-token',
          refresh_token: 'fresh-refresh-token',
          expires_at: new Date(Date.now() + 60 * 60 * 1000),
          provider_trace_id: 'trace-1',
        }) as any),
      },
    });

    const syncLog = await posSyncService.syncOrder('order-1');

    expect(syncLog).toMatchObject({
      status: 'failed',
      retry_count: 1,
      error_message: 'POS token refresh response include unsupported field(s): provider_trace_id',
    });
    expect(createOrder).not.toHaveBeenCalled();
    expect(integrationRepository.rows[0]).toMatchObject({
      access_token: 'expired-access-token',
      refresh_token: 'refresh-token',
      last_error: 'POS token refresh response include unsupported field(s): provider_trace_id',
    });
  });

  it('rejects unsafe POS token refresh field names before mutating credentials', async () => {
    const createOrder = jest.fn();
    const { posSyncService, integrationRepository } = createPOSSyncHarness({
      integrationOverrides: {
        access_token: 'expired-access-token',
        refresh_token: 'refresh-token',
        token_expires_at: new Date(Date.now() - 60 * 1000),
      },
      service: {
        createOrder,
        refreshAccessToken: jest.fn(async () => ({
          access_token: 'fresh-access-token',
          refresh_token: 'fresh-refresh-token',
          expires_at: new Date(Date.now() + 60 * 60 * 1000),
          'provider_trace_id\uFEFF': 'trace-1',
        }) as any),
      },
    });

    const syncLog = await posSyncService.syncOrder('order-1');

    expect(syncLog).toMatchObject({
      status: 'failed',
      retry_count: 1,
      error_message: 'POS token refresh response field names must not include unsafe control characters',
    });
    expect(createOrder).not.toHaveBeenCalled();
    expect(integrationRepository.rows[0]).toMatchObject({
      access_token: 'expired-access-token',
      refresh_token: 'refresh-token',
      last_error: 'POS token refresh response field names must not include unsafe control characters',
    });
  });

  it('rejects corrupt persisted token expiry before provider dispatch', async () => {
    const createOrder = jest.fn();
    const { posSyncService, integrationRepository } = createPOSSyncHarness({
      integrationOverrides: {
        token_expires_at: new Date('not-a-date'),
      },
      service: {
        createOrder,
      },
    });

    const syncLog = await posSyncService.syncOrder('order-1');

    expect(syncLog).toMatchObject({
      status: 'failed',
      retry_count: 1,
      error_message: 'POS integration token_expires_at must be a valid Date',
    });
    expect(createOrder).not.toHaveBeenCalled();
    expect(integrationRepository.rows[0]).toMatchObject({
      error_count: 1,
      last_error: 'POS integration token_expires_at must be a valid Date',
    });
  });

  it('rejects corrupt persisted refresh integration rows before provider dispatch', async () => {
    const createOrder = jest.fn();
    const refreshAccessToken = jest.fn(async () => ({
      access_token: 'fresh-access-token',
      refresh_token: 'fresh-refresh-token',
      expires_at: new Date(Date.now() + 60 * 60 * 1000),
    }));
    const { posSyncService, integrationRepository } = createPOSSyncHarness({
      integrationOverrides: {
        access_token: 'expired-access-token',
        refresh_token: 'refresh-token',
        token_expires_at: new Date(Date.now() - 60 * 1000),
      },
      service: {
        createOrder,
        refreshAccessToken,
      },
    });
    const originalFindOne = integrationRepository.findOne.bind(integrationRepository);
    integrationRepository.findOne = jest.fn(async (options: { where: Record<string, any> }) => {
      if (options.where.id === 'integration-1') {
        return {
          ...integrationRepository.rows[0],
          business_id: 'other-business',
        };
      }
      return originalFindOne(options);
    });

    const syncLog = await posSyncService.syncOrder('order-1');

    expect(syncLog).toMatchObject({
      status: 'failed',
      retry_count: 1,
      error_message: 'POS persisted refresh integration business_id must match requested business',
    });
    expect(refreshAccessToken).not.toHaveBeenCalled();
    expect(createOrder).not.toHaveBeenCalled();
    expect(integrationRepository.rows[0]).toMatchObject({
      access_token: 'expired-access-token',
      refresh_token: 'refresh-token',
      last_error: 'POS persisted refresh integration business_id must match requested business',
    });
  });

  it('rejects unsupported persisted refresh integration row fields before provider dispatch', async () => {
    const createOrder = jest.fn();
    const refreshAccessToken = jest.fn(async () => ({
      access_token: 'fresh-access-token',
      refresh_token: 'fresh-refresh-token',
      expires_at: new Date(Date.now() + 60 * 60 * 1000),
    }));
    const { posSyncService, integrationRepository } = createPOSSyncHarness({
      integrationOverrides: {
        access_token: 'expired-access-token',
        refresh_token: 'refresh-token',
        token_expires_at: new Date(Date.now() - 60 * 1000),
      },
      service: {
        createOrder,
        refreshAccessToken,
      },
    });
    const originalFindOne = integrationRepository.findOne.bind(integrationRepository);
    integrationRepository.findOne = jest.fn(async (options: { where: Record<string, any> }) => {
      if (options.where.id === 'integration-1') {
        return {
          ...integrationRepository.rows[0],
          provider_trace_id: 'trace-1',
        };
      }
      return originalFindOne(options);
    });

    const syncLog = await posSyncService.syncOrder('order-1');

    expect(syncLog).toMatchObject({
      status: 'failed',
      retry_count: 1,
      error_message: 'POS persisted refresh integration include unsupported field(s): provider_trace_id',
    });
    expect(refreshAccessToken).not.toHaveBeenCalled();
    expect(createOrder).not.toHaveBeenCalled();
    expect(integrationRepository.rows[0]).toMatchObject({
      access_token: 'expired-access-token',
      refresh_token: 'refresh-token',
      last_error: 'POS persisted refresh integration include unsupported field(s): provider_trace_id',
    });
  });

  it('calculates POS sync stats from validated sync log statuses', async () => {
    const { posSyncService, syncLogRepository } = createPOSSyncHarness();
    syncLogRepository.rows.push(
      {
        id: 'log-1',
        pos_integration_id: 'integration-1',
        order_id: 'order-1',
        provider: 'square',
        status: 'success',
        pos_order_id: 'square-order-1',
        response_data: { pos_order_id: 'square-order-1' },
        request_payload: successfulPOSRequestPayload(),
        completed_at: completedAt,
      },
      {
        id: 'log-2',
        pos_integration_id: 'integration-1',
        order_id: 'order-2',
        provider: 'square',
        status: 'failed',
        retry_count: 1,
        error_message: 'Square token refresh rejected',
        completed_at: completedAt,
      },
      {
        id: 'log-3',
        pos_integration_id: 'integration-1',
        order_id: 'order-3',
        provider: 'square',
        status: 'retry',
        retry_count: 1,
        error_message: 'Square rate limit exceeded',
        next_retry_at: nextRetryAt,
      },
      {
        id: 'log-4',
        pos_integration_id: 'integration-1',
        order_id: 'order-4',
        provider: 'square',
        status: 'pending',
      }
    );

    await expect(posSyncService.getSyncStats('business-1')).resolves.toEqual({
      total_syncs: 4,
      successful_syncs: 1,
      failed_syncs: 1,
      pending_retries: 1,
      success_rate: 25,
    });
  });

  it('rejects duplicate successful POS sync rows for the same order before read-side exposure', async () => {
    const { posSyncService, syncLogRepository } = createPOSSyncHarness();
    syncLogRepository.rows.push(
      {
        id: 'log-success-original',
        pos_integration_id: 'integration-1',
        order_id: 'order-1',
        provider: 'square',
        status: 'success',
        pos_order_id: 'square-order-1',
        response_data: { pos_order_id: 'square-order-1' },
        request_payload: successfulPOSRequestPayload(),
        completed_at: completedAt,
      },
      {
        id: 'log-success-duplicate',
        pos_integration_id: 'integration-1',
        order_id: 'order-1',
        provider: 'square',
        status: 'success',
        pos_order_id: 'square-order-duplicate',
        response_data: { pos_order_id: 'square-order-duplicate' },
        request_payload: successfulPOSRequestPayload(),
        completed_at: completedAt,
      }
    );

    await expect(posSyncService.getSyncHistory('business-1'))
      .rejects.toThrow('POS sync history row 2 order_id must be unique for successful syncs');
    await expect(posSyncService.getSyncStats('business-1'))
      .rejects.toThrow('POS sync stats row 2 order_id must be unique for successful syncs');
  });

  it('rejects duplicate successful POS provider order ids before read-side exposure', async () => {
    const { posSyncService, syncLogRepository } = createPOSSyncHarness();
    const secondOrder = { ...order, id: 'order-2' };
    syncLogRepository.rows.push(
      {
        id: 'log-success-original',
        pos_integration_id: 'integration-1',
        order_id: 'order-1',
        provider: 'square',
        status: 'success',
        pos_order_id: 'square-order-1',
        response_data: { pos_order_id: 'square-order-1' },
        request_payload: successfulPOSRequestPayload(),
        completed_at: completedAt,
      },
      {
        id: 'log-success-provider-duplicate',
        pos_integration_id: 'integration-1',
        order_id: 'order-2',
        provider: 'square',
        status: 'success',
        pos_order_id: 'square-order-1',
        response_data: { pos_order_id: 'square-order-1' },
        request_payload: buildPOSOrderPayload(secondOrder, integration),
        completed_at: completedAt,
      }
    );

    await expect(posSyncService.getSyncHistory('business-1'))
      .rejects.toThrow('POS sync history row 2 pos_order_id must be unique for successful syncs');
    await expect(posSyncService.getSyncStats('business-1'))
      .rejects.toThrow('POS sync stats row 2 pos_order_id must be unique for successful syncs');
  });

  it('rejects duplicate persisted POS sync log ids before history or stats exposure', async () => {
    const { posSyncService, syncLogRepository } = createPOSSyncHarness();
    syncLogRepository.rows.push(
      {
        id: 'log-duplicate-id',
        pos_integration_id: 'integration-1',
        order_id: 'order-1',
        provider: 'square',
        status: 'success',
        pos_order_id: 'square-order-1',
        response_data: { pos_order_id: 'square-order-1' },
        request_payload: successfulPOSRequestPayload(),
        completed_at: completedAt,
      },
      {
        id: 'log-duplicate-id',
        pos_integration_id: 'integration-1',
        order_id: 'order-2',
        provider: 'square',
        status: 'failed',
        retry_count: 1,
        error_message: 'Square token refresh rejected',
        completed_at: completedAt,
      }
    );

    await expect(posSyncService.getSyncHistory('business-1'))
      .rejects.toThrow('POS sync history row 2 id must be unique');
    await expect(posSyncService.getSyncStats('business-1'))
      .rejects.toThrow('POS sync stats row 2 id must be unique');
  });

  it('normalizes POS business ids before calculating sync stats', async () => {
    const integrationRepository = {
      findOne: jest.fn(async () => ({
        id: 'integration-1',
        business_id: 'business-1',
        provider: 'square',
        location_id: 'location-1',
        error_count: 0,
      })),
    };
    const syncLogRepository = {
      find: jest.fn(async () => [
        {
          id: 'log-1',
          pos_integration_id: 'integration-1',
          order_id: 'order-1',
          provider: 'square',
          status: 'success',
          pos_order_id: 'square-order-1',
          response_data: { pos_order_id: 'square-order-1' },
          request_payload: successfulPOSRequestPayload(),
          completed_at: completedAt,
        },
      ]),
    };
    const service = new POSSyncService(new Map(), {
      integrationRepository: integrationRepository as any,
      syncLogRepository: syncLogRepository as any,
      orderRepository: createMemoryRepository<any>() as any,
    }, { enforceCapability: false });

    await expect(service.getSyncStats(' business-1 ')).resolves.toMatchObject({
      total_syncs: 1,
      successful_syncs: 1,
      success_rate: 100,
    });

    expect(integrationRepository.findOne).toHaveBeenCalledWith({
      where: { business_id: 'business-1', is_active: true },
    });
    expect(syncLogRepository.find).toHaveBeenCalledWith({
      where: { pos_integration_id: 'integration-1' },
    });
  });

  it('aggregates POS sync stats from normalized persisted statuses', async () => {
    const { posSyncService, syncLogRepository } = createPOSSyncHarness();
    syncLogRepository.rows.push(
      {
        id: 'log-success',
        pos_integration_id: 'integration-1',
        order_id: 'order-1',
        provider: 'square',
        status: ' Success ',
        pos_order_id: 'square-order-1',
        response_data: { pos_order_id: 'square-order-1' },
        request_payload: successfulPOSRequestPayload(),
        completed_at: completedAt,
      },
      {
        id: 'log-failed',
        pos_integration_id: 'integration-1',
        order_id: 'order-2',
        provider: 'square',
        status: ' FAILED ',
        retry_count: 1,
        error_message: 'Square token refresh rejected',
        completed_at: completedAt,
      },
      {
        id: 'log-retry',
        pos_integration_id: 'integration-1',
        order_id: 'order-3',
        provider: 'square',
        status: ' retry ',
        retry_count: 1,
        error_message: 'Square rate limited',
        http_status: 429,
        next_retry_at: nextRetryAt,
      }
    );

    await expect(posSyncService.getSyncStats('business-1')).resolves.toEqual({
      total_syncs: 3,
      successful_syncs: 1,
      failed_syncs: 1,
      pending_retries: 1,
      success_rate: 33.3,
    });
  });

  it('does not expose sync history or stats for disconnected POS integrations', async () => {
    const integrationRepository = {
      findOne: jest.fn(async () => null),
    };
    const syncLogRepository = {
      find: jest.fn(async () => [
        {
          id: 'stale-log',
          pos_integration_id: 'inactive-integration',
          order_id: 'order-1',
          provider: 'square',
          status: 'success',
        },
      ]),
      findAndCount: jest.fn(async () => [[{
        id: 'stale-log',
        pos_integration_id: 'inactive-integration',
        order_id: 'order-1',
        provider: 'square',
        status: 'success',
      }], 1]),
    };
    const service = new POSSyncService(new Map(), {
      integrationRepository: integrationRepository as any,
      syncLogRepository: syncLogRepository as any,
      orderRepository: createMemoryRepository<any>() as any,
    }, { enforceCapability: false });

    await expect(service.getSyncHistory(' business-1 ')).resolves.toEqual({
      logs: [],
      total: 0,
    });
    await expect(service.getSyncStats(' business-1 ')).resolves.toEqual({
      total_syncs: 0,
      successful_syncs: 0,
      failed_syncs: 0,
      pending_retries: 0,
      success_rate: 0,
    });

    expect(integrationRepository.findOne).toHaveBeenCalledWith({
      where: { business_id: 'business-1', is_active: true },
    });
    expect(syncLogRepository.find).not.toHaveBeenCalled();
    expect(syncLogRepository.findAndCount).not.toHaveBeenCalled();
  });

  it('rejects corrupt persisted POS sync statuses before returning stats', async () => {
    const { posSyncService, syncLogRepository } = createPOSSyncHarness();
    syncLogRepository.rows.push(
      {
        id: 'log-1',
        pos_integration_id: 'integration-1',
        order_id: 'order-1',
        provider: 'square',
        status: 'success',
        pos_order_id: 'square-order-1',
        response_data: { pos_order_id: 'square-order-1' },
        request_payload: successfulPOSRequestPayload(),
        completed_at: completedAt,
      },
      {
        id: 'log-2',
        pos_integration_id: 'integration-1',
        order_id: 'order-2',
        provider: 'square',
        status: 'teleported',
      }
    );

    await expect(posSyncService.getSyncStats('business-1'))
      .rejects.toThrow('POS sync stats row 2 status has an invalid status');
  });

  it('rejects successful POS sync stats rows missing provider order evidence', async () => {
    const { posSyncService, syncLogRepository } = createPOSSyncHarness();
    syncLogRepository.rows.push({
      id: 'log-1',
      pos_integration_id: 'integration-1',
      order_id: 'order-1',
      provider: 'square',
      status: 'success',
    });

    await expect(posSyncService.getSyncStats('business-1'))
      .rejects.toThrow('POS sync stats row 1 pos_order_id must be a non-empty string');
  });

  it.each([
    [
      'missing provider response audit object',
      {},
      'POS sync stats row 1 response_data must be an object',
    ],
    [
      'blank provider response order id',
      { response_data: { pos_order_id: '   ' } },
      'POS sync stats row 1 response_data.pos_order_id must be a non-empty string',
    ],
    [
      'oversized persisted provider order id',
      {
        pos_order_id: 'p'.repeat(256),
        response_data: { pos_order_id: 'p'.repeat(256) },
      },
      'POS sync stats row 1 pos_order_id must be at most 255 characters',
    ],
    [
      'oversized provider response order id',
      { response_data: { pos_order_id: 'p'.repeat(256) } },
      'POS sync stats row 1 response_data.pos_order_id must be at most 255 characters',
    ],
    [
      'mismatched provider response order id',
      { response_data: { pos_order_id: 'square-order-elsewhere' } },
      'POS sync stats row 1 response_data.pos_order_id must match pos_order_id',
    ],
    [
      'unsupported provider response audit field',
      { response_data: { pos_order_id: 'square-order-1', provider_trace_id: 'trace-1' } },
      'POS sync stats row 1 response_data include unsupported field(s): provider_trace_id',
    ],
    [
      'mismatched provider response reference id',
      { response_data: { pos_order_id: 'square-order-1', reference_id: 'order-elsewhere' } },
      'POS sync stats row 1 response_data.reference_id must match requested order',
    ],
    [
      'oversized provider response reference id',
      { response_data: { pos_order_id: 'square-order-1', reference_id: 'r'.repeat(256) } },
      'POS sync stats row 1 response_data.reference_id must be at most 255 characters',
    ],
    [
      'mismatched provider response location id',
      { response_data: { pos_order_id: 'square-order-1', location_id: 'location-elsewhere' } },
      'POS sync stats row 1 response_data.location_id must match active integration location',
    ],
    [
      'oversized provider response location id',
      { response_data: { pos_order_id: 'square-order-1', location_id: 'l'.repeat(256) } },
      'POS sync stats row 1 response_data.location_id must be at most 255 characters',
    ],
    [
      'mismatched provider response metadata order id',
      {
        response_data: {
          pos_order_id: 'square-order-1',
          metadata: { menumaker_order_id: 'order-elsewhere' },
        },
      },
      'POS sync stats row 1 response_data.metadata.menumaker_order_id must match requested order',
    ],
    [
      'oversized provider response metadata order id',
      {
        response_data: {
          pos_order_id: 'square-order-1',
          metadata: { menumaker_order_id: 'o'.repeat(256) },
        },
      },
      'POS sync stats row 1 response_data.metadata.menumaker_order_id must be at most 255 characters',
    ],
    [
      'mismatched provider response metadata business id',
      {
        response_data: {
          pos_order_id: 'square-order-1',
          metadata: { business_id: 'business-elsewhere' },
        },
      },
      'POS sync stats row 1 response_data.metadata.business_id must match requested order business',
    ],
    [
      'oversized provider response metadata business id',
      {
        response_data: {
          pos_order_id: 'square-order-1',
          metadata: { business_id: 'b'.repeat(256) },
        },
      },
      'POS sync stats row 1 response_data.metadata.business_id must be at most 255 characters',
    ],
  ])('rejects successful POS sync stats rows with %s', async (
    _caseName,
    overrides,
    expectedMessage
  ) => {
    const { posSyncService, syncLogRepository } = createPOSSyncHarness();
    syncLogRepository.rows.push({
      id: 'log-1',
      pos_integration_id: 'integration-1',
      order_id: 'order-1',
      provider: 'square',
      status: 'success',
      pos_order_id: 'square-order-1',
      completed_at: completedAt,
      ...overrides,
    });

    await expect(posSyncService.getSyncStats('business-1'))
      .rejects.toThrow(expectedMessage);
  });

  it.each([
    [
      'missing request audit object',
      {},
      'POS sync stats row 1 request_payload must be an object',
    ],
    [
      'mismatched idempotency key',
      { request_payload: successfulPOSRequestPayload({ idempotency_key: 'menumaker-order-order-elsewhere' }) },
      'POS sync stats row 1 request_payload.idempotency_key must match requested order',
    ],
    [
      'unsupported request audit field',
      { request_payload: successfulPOSRequestPayload({ provider_trace_id: 'trace-1' }) },
      'POS sync stats row 1 request_payload include unsupported field(s): provider_trace_id',
    ],
    [
      'mismatched request location',
      {
        request_payload: successfulPOSRequestPayload({
          order: {
            ...successfulPOSRequestPayload().order,
            location_id: 'location-elsewhere',
          },
        }),
      },
      'POS sync stats row 1 request_payload.order.location_id must match active integration location',
    ],
    [
      'unsupported request order audit field',
      {
        request_payload: successfulPOSRequestPayload({
          order: {
            ...successfulPOSRequestPayload().order,
            provider_trace_id: 'trace-1',
          },
        }),
      },
      'POS sync stats row 1 request_payload.order include unsupported field(s): provider_trace_id',
    ],
    [
      'mismatched request business metadata',
      {
        request_payload: successfulPOSRequestPayload({
          order: {
            ...successfulPOSRequestPayload().order,
            metadata: {
              ...successfulPOSRequestPayload().order.metadata,
              business_id: 'business-elsewhere',
            },
          },
        }),
      },
      'POS sync stats row 1 request_payload.order.metadata.business_id must match requested order business',
    ],
    [
      'mismatched request source metadata',
      {
        request_payload: successfulPOSRequestPayload({
          order: {
            ...successfulPOSRequestPayload().order,
            metadata: {
              ...successfulPOSRequestPayload().order.metadata,
              source: 'ImportedSystem',
            },
          },
        }),
      },
      'POS sync stats row 1 request_payload.order.metadata.source must be MenuMaker',
    ],
  ])('rejects successful POS sync stats rows with %s', async (
    _caseName,
    overrides,
    expectedMessage
  ) => {
    const { posSyncService, syncLogRepository } = createPOSSyncHarness();
    syncLogRepository.rows.push({
      id: 'log-1',
      pos_integration_id: 'integration-1',
      order_id: 'order-1',
      provider: 'square',
      status: 'success',
      pos_order_id: 'square-order-1',
      response_data: { pos_order_id: 'square-order-1' },
      completed_at: completedAt,
      ...overrides,
    });

    await expect(posSyncService.getSyncStats('business-1'))
      .rejects.toThrow(expectedMessage);
  });

  it('rejects successful POS sync rows missing completion evidence before read-side exposure', async () => {
    const { posSyncService, syncLogRepository } = createPOSSyncHarness();
    syncLogRepository.rows.push({
      id: 'log-1',
      pos_integration_id: 'integration-1',
      order_id: 'order-1',
      provider: 'square',
      status: 'success',
      pos_order_id: 'square-order-1',
    });

    await expect(posSyncService.getSyncHistory('business-1'))
      .rejects.toThrow('POS sync history row 1 completed_at must be a valid Date');
    await expect(posSyncService.getSyncStats('business-1'))
      .rejects.toThrow('POS sync stats row 1 completed_at must be a valid Date');
  });

  it('rejects POS sync rows with impossible persisted timestamp chronology before read-side exposure', async () => {
    const cases = [
      {
        row: {
          id: 'log-completed-before-created',
          pos_integration_id: 'integration-1',
          order_id: 'order-1',
          provider: 'square',
          status: 'success',
          pos_order_id: 'square-order-1',
          created_at: new Date('2026-06-27T03:00:00.000Z'),
          completed_at: new Date('2026-06-27T02:59:59.000Z'),
        },
        message: 'POS sync history row 1 completed_at cannot be before created_at',
      },
      {
        row: {
          id: 'log-retry-before-created',
          pos_integration_id: 'integration-1',
          order_id: 'order-1',
          provider: 'square',
          status: 'retry',
          error_message: 'Square rate limit exceeded',
          created_at: new Date('2026-06-27T03:00:00.000Z'),
          next_retry_at: new Date('2026-06-27T02:59:59.000Z'),
        },
        message: 'POS sync history row 1 next_retry_at cannot be before created_at',
      },
      {
        row: {
          id: 'log-updated-before-created',
          pos_integration_id: 'integration-1',
          order_id: 'order-1',
          provider: 'square',
          status: 'failed',
          error_message: 'Square token refresh rejected',
          created_at: new Date('2026-06-27T03:00:00.000Z'),
          updated_at: new Date('2026-06-27T02:59:59.000Z'),
          completed_at: new Date('2026-06-27T03:01:00.000Z'),
        },
        message: 'POS sync history row 1 updated_at cannot be before created_at',
      },
      {
        row: {
          id: 'log-updated-before-completed',
          pos_integration_id: 'integration-1',
          order_id: 'order-1',
          provider: 'square',
          status: 'success',
          pos_order_id: 'square-order-1',
          created_at: new Date('2026-06-27T03:00:00.000Z'),
          updated_at: new Date('2026-06-27T03:00:30.000Z'),
          completed_at: new Date('2026-06-27T03:01:00.000Z'),
        },
        message: 'POS sync history row 1 updated_at cannot be before completed_at',
      },
    ];

    for (const { row, message } of cases) {
      const { posSyncService, syncLogRepository } = createPOSSyncHarness();
      syncLogRepository.rows.push(row);

      await expect(posSyncService.getSyncHistory('business-1'))
        .rejects.toThrow(message);
      await expect(posSyncService.getSyncStats('business-1'))
        .rejects.toThrow(message.replace('history', 'stats'));
    }
  });

  it('rejects successful POS sync stats rows with stale retry or failure evidence', async () => {
    const cases = [
      {
        stale: { error_message: 'Previous timeout' },
        message: 'POS sync stats row 1 error_message cannot be present after successful sync',
      },
      {
        stale: { http_status: 429 },
        message: 'POS sync stats row 1 http_status cannot be present after successful sync',
      },
      {
        stale: { next_retry_at: new Date('2026-06-27T02:00:00.000Z') },
        message: 'POS sync stats row 1 next_retry_at cannot be present after successful sync',
      },
    ];

    for (const { stale, message } of cases) {
      const { posSyncService, syncLogRepository } = createPOSSyncHarness();
      syncLogRepository.rows.push({
        id: 'log-1',
        pos_integration_id: 'integration-1',
        order_id: 'order-1',
        provider: 'square',
        status: 'success',
        pos_order_id: 'square-order-1',
        completed_at: completedAt,
        ...stale,
      });

      await expect(posSyncService.getSyncStats('business-1'))
        .rejects.toThrow(message);
    }
  });

  it('rejects failed POS sync rows missing terminal failure evidence before read-side exposure', async () => {
    const cases = [
      {
        row: {
          id: 'log-1',
          pos_integration_id: 'integration-1',
          order_id: 'order-1',
          provider: 'square',
          status: 'failed',
          retry_count: 1,
          completed_at: completedAt,
        },
        message: 'POS sync history row 1 error_message must be a non-empty string',
      },
      {
        row: {
          id: 'log-1',
          pos_integration_id: 'integration-1',
          order_id: 'order-1',
          provider: 'square',
          status: 'failed',
          retry_count: 1,
          error_message: 'Square token refresh rejected',
        },
        message: 'POS sync history row 1 completed_at must be a valid Date',
      },
      {
        row: {
          id: 'log-1',
          pos_integration_id: 'integration-1',
          order_id: 'order-1',
          provider: 'square',
          status: 'failed',
          retry_count: 1,
          error_message: 'Square token refresh rejected',
          completed_at: completedAt,
          pos_order_id: 'stale-square-order',
        },
        message: 'POS sync history row 1 pos_order_id cannot be present after failed sync',
      },
      {
        row: {
          id: 'log-1',
          pos_integration_id: 'integration-1',
          order_id: 'order-1',
          provider: 'square',
          status: 'failed',
          retry_count: 1,
          error_message: 'Square token refresh rejected',
          completed_at: completedAt,
          next_retry_at: nextRetryAt,
        },
        message: 'POS sync history row 1 next_retry_at cannot be present after failed sync',
      },
      {
        row: {
          id: 'log-1',
          pos_integration_id: 'integration-1',
          order_id: 'order-1',
          provider: 'square',
          status: 'failed',
          retry_count: 1,
          error_message: 'Square token refresh rejected',
          completed_at: completedAt,
          response_data: { pos_order_id: 'stale-square-order' },
        },
        message: 'POS sync history row 1 response_data cannot be present after failed sync',
      },
    ];

    for (const { row, message } of cases) {
      const { posSyncService, syncLogRepository } = createPOSSyncHarness();
      syncLogRepository.rows.push(row);

      await expect(posSyncService.getSyncHistory('business-1'))
        .rejects.toThrow(message);
    }
  });

  it('rejects impossible POS sync HTTP status evidence before read-side exposure', async () => {
    const cases = [
      {
        row: {
          id: 'log-1',
          pos_integration_id: 'integration-1',
          order_id: 'order-1',
          provider: 'square',
          status: 'failed',
          retry_count: 1,
          error_message: 'Square token refresh rejected',
          http_status: 99,
          completed_at: completedAt,
        },
        message: 'POS sync history row 1 http_status must be a valid HTTP status',
      },
      {
        row: {
          id: 'log-1',
          pos_integration_id: 'integration-1',
          order_id: 'order-1',
          provider: 'square',
          status: 'retry',
          retry_count: 1,
          error_message: 'Square rate limit exceeded',
          http_status: 600,
          next_retry_at: nextRetryAt,
        },
        message: 'POS sync history row 1 http_status must be a valid HTTP status',
      },
      {
        row: {
          id: 'log-1',
          pos_integration_id: 'integration-1',
          order_id: 'order-1',
          provider: 'square',
          status: 'retry',
          retry_count: 1,
          error_message: 'Square rejected request',
          http_status: 400,
          next_retry_at: nextRetryAt,
        },
        message: 'POS sync history row 1 http_status must be retryable while retrying sync',
      },
    ];

    for (const { row, message } of cases) {
      const { posSyncService, syncLogRepository } = createPOSSyncHarness();
      syncLogRepository.rows.push(row);

      await expect(posSyncService.getSyncHistory('business-1'))
        .rejects.toThrow(message);
    }
  });

  it('rejects retry POS sync rows missing retry evidence before read-side exposure', async () => {
    const cases = [
      {
        row: {
          id: 'log-1',
          pos_integration_id: 'integration-1',
          order_id: 'order-1',
          provider: 'square',
          status: 'retry',
          retry_count: 1,
          next_retry_at: nextRetryAt,
        },
        message: 'POS sync history row 1 error_message must be a non-empty string',
      },
      {
        row: {
          id: 'log-1',
          pos_integration_id: 'integration-1',
          order_id: 'order-1',
          provider: 'square',
          status: 'retry',
          retry_count: 1,
          error_message: 'Square rate limit exceeded',
        },
        message: 'POS sync history row 1 next_retry_at must be a valid Date',
      },
      {
        row: {
          id: 'log-1',
          pos_integration_id: 'integration-1',
          order_id: 'order-1',
          provider: 'square',
          status: 'retry',
          retry_count: 1,
          error_message: 'Square rate limit exceeded',
          next_retry_at: nextRetryAt,
          pos_order_id: 'stale-square-order',
        },
        message: 'POS sync history row 1 pos_order_id cannot be present while retrying sync',
      },
      {
        row: {
          id: 'log-1',
          pos_integration_id: 'integration-1',
          order_id: 'order-1',
          provider: 'square',
          status: 'retry',
          retry_count: 1,
          error_message: 'Square rate limit exceeded',
          next_retry_at: nextRetryAt,
          completed_at: completedAt,
        },
        message: 'POS sync history row 1 completed_at cannot be present while retrying sync',
      },
      {
        row: {
          id: 'log-1',
          pos_integration_id: 'integration-1',
          order_id: 'order-1',
          provider: 'square',
          status: 'retry',
          retry_count: 1,
          error_message: 'Square rate limit exceeded',
          next_retry_at: nextRetryAt,
          response_data: { pos_order_id: 'stale-square-order' },
        },
        message: 'POS sync history row 1 response_data cannot be present while retrying sync',
      },
    ];

    for (const { row, message } of cases) {
      const { posSyncService, syncLogRepository } = createPOSSyncHarness();
      syncLogRepository.rows.push(row);

      await expect(posSyncService.getSyncHistory('business-1'))
        .rejects.toThrow(message);
    }
  });

  it('rejects failed and retry POS sync rows without attempt-count evidence before read-side exposure', async () => {
    const cases = [
      {
        row: {
          id: 'log-failed-without-attempt',
          pos_integration_id: 'integration-1',
          order_id: 'order-1',
          provider: 'square',
          status: 'failed',
          retry_count: 0,
          error_message: 'Square token refresh rejected',
          completed_at: completedAt,
        },
        message: 'POS sync history row 1 retry_count must be greater than zero after failed sync',
      },
      {
        row: {
          id: 'log-retry-without-attempt',
          pos_integration_id: 'integration-1',
          order_id: 'order-1',
          provider: 'square',
          status: 'retry',
          retry_count: 0,
          error_message: 'Square rate limit exceeded',
          next_retry_at: nextRetryAt,
        },
        message: 'POS sync history row 1 retry_count must be greater than zero while retrying sync',
      },
    ];

    for (const { row, message } of cases) {
      const { posSyncService, syncLogRepository } = createPOSSyncHarness();
      syncLogRepository.rows.push(row);

      await expect(posSyncService.getSyncHistory('business-1'))
        .rejects.toThrow(message);
    }
  });

  it('rejects pending POS sync rows with stale terminal or retry evidence', async () => {
    const cases = [
      {
        stale: { pos_order_id: 'stale-square-order' },
        message: 'POS sync stats row 1 pos_order_id cannot be present before terminal sync',
      },
      {
        stale: { error_message: 'Previous timeout' },
        message: 'POS sync stats row 1 error_message cannot be present before sync attempt evidence',
      },
      {
        stale: { http_status: 429 },
        message: 'POS sync stats row 1 http_status cannot be present before sync attempt evidence',
      },
      {
        stale: { next_retry_at: nextRetryAt },
        message: 'POS sync stats row 1 next_retry_at cannot be present before sync attempt evidence',
      },
      {
        stale: { completed_at: completedAt },
        message: 'POS sync stats row 1 completed_at cannot be present before terminal sync',
      },
      {
        stale: { response_data: { pos_order_id: 'stale-square-order' } },
        message: 'POS sync stats row 1 response_data cannot be present before terminal sync',
      },
      {
        stale: { duration_ms: 250 },
        message: 'POS sync stats row 1 duration_ms cannot be present before sync attempt completion',
      },
      {
        stale: { retry_count: 1 },
        message: 'POS sync stats row 1 retry_count cannot be greater than zero before sync attempt evidence',
      },
    ];

    for (const { stale, message } of cases) {
      const { posSyncService, syncLogRepository } = createPOSSyncHarness();
      syncLogRepository.rows.push({
        id: 'log-1',
        pos_integration_id: 'integration-1',
        order_id: 'order-1',
        provider: 'square',
        status: 'pending',
        ...stale,
      });

      await expect(posSyncService.getSyncStats('business-1'))
        .rejects.toThrow(message);
    }
  });

  it('rejects cross-integration POS sync rows before calculating stats', async () => {
    const integrationRepository = {
      findOne: jest.fn(async () => ({
        id: 'integration-1',
        business_id: 'business-1',
        provider: 'square',
        error_count: 0,
      })),
    };
    const syncLogRepository = {
      find: jest.fn(async () => [
        {
          id: 'log-1',
          pos_integration_id: 'integration-2',
          order_id: 'order-1',
          provider: 'square',
          status: 'success',
        },
      ]),
    };
    const service = new POSSyncService(new Map(), {
      integrationRepository: integrationRepository as any,
      syncLogRepository: syncLogRepository as any,
      orderRepository: createMemoryRepository<any>() as any,
    }, { enforceCapability: false });

    await expect(service.getSyncStats('business-1'))
      .rejects.toThrow('POS sync stats row 1 pos_integration_id must match requested integration');
  });

  it('rejects disabled-provider POS sync rows before calculating stats', async () => {
    const integrationRepository = {
      findOne: jest.fn(async () => ({
        id: 'integration-1',
        business_id: 'business-1',
        provider: 'square',
        error_count: 0,
      })),
    };
    const syncLogRepository = {
      find: jest.fn(async () => [
        {
          id: 'log-1',
          pos_integration_id: 'integration-1',
          order_id: 'order-1',
          provider: 'dine',
          status: 'success',
        },
      ]),
    };
    const service = new POSSyncService(new Map(), {
      integrationRepository: integrationRepository as any,
      syncLogRepository: syncLogRepository as any,
      orderRepository: createMemoryRepository<any>() as any,
    }, { enforceCapability: false });

    await expect(service.getSyncStats('business-1')).rejects.toMatchObject({
      code: 'FEATURE_UNAVAILABLE',
      capability: 'pos_sync',
      message: 'Persisted POS sync log provider is disabled',
    });
  });
});
