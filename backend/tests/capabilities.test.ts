import { describe, expect, it, jest } from '@jest/globals';
import Fastify from 'fastify';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  FeatureUnavailableError,
  assertCapabilityEnabled,
  getCapability,
  publicCapabilityDiscovery,
  requireCapability,
  validateCapabilities,
  capabilityRegistry,
} from '../src/config/capabilities';
import {
  deliveryRoutes,
  normalizedOptionalDeliveryRatingText,
  normalizedRequiredDeliveryString,
} from '../src/routes/delivery';
import {
  enhancedReferralRoutes,
  normalizeOptionalReferralString,
  normalizeRequiredReferralString,
  parseOptionalLeaderboardLimit,
  parseOptionalNonNegativeReferralInteger,
} from '../src/routes/enhancedReferrals';
import ocrRoutes, { normalizeOptionalOcrImageMimeType, normalizeRequiredOcrString } from '../src/routes/ocr';
import { normalizeRequiredPosString, parseOptionalSyncStatus, posRoutes } from '../src/routes/pos';
import referralRoutes from '../src/routes/referrals';
import { normalizeRequiredSubscriptionString, subscriptionRoutes } from '../src/routes/subscriptions';
import {
  normalizeOptionalTaxDateFilter,
  normalizeRequiredTaxString,
  taxReportRoutes,
} from '../src/routes/taxReports';
import { POSSyncService } from '../src/services/POSSyncService';
import { Business } from '../src/models/Business';
import { Dish } from '../src/models/Dish';
import { DishCategory } from '../src/models/DishCategory';
import { Order } from '../src/models/Order';
import { DeliveryTracking } from '../src/models/DeliveryIntegration';
import { DeliveryService } from '../src/services/DeliveryService';
import { AffiliateService, LeaderboardService, ViralService } from '../src/services/EnhancedReferralService';
import { OCRService } from '../src/services/OCRService';
import { ReferralService } from '../src/services/ReferralService';
import { SubscriptionService } from '../src/services/SubscriptionService';
import { TaxReportService } from '../src/services/TaxReportService';
import { AppDataSource } from '../src/config/database';

describe('capability registry', () => {
  function repoFile(pathFromRoot: string): string {
    const fromCurrent = join(process.cwd(), pathFromRoot);
    if (existsSync(fromCurrent)) return fromCurrent;
    return join(process.cwd(), pathFromRoot.replace(/^backend\//, ''));
  }

  it('enables implemented capabilities only when required configuration is present', () => {
    const readiness = assertCapabilityEnabled('identity_auth', {
      JWT_SECRET: 'test-secret',
      AUTH_ENABLED: 'true',
    } as NodeJS.ProcessEnv);

    expect(readiness.enabled).toBe(true);
    expect(() => validateCapabilities({} as NodeJS.ProcessEnv)).toThrow(/identity_auth/);
  });

  it('fails closed for disabled or unknown capabilities', () => {
    for (const capability of [
      'pos_sync',
      'delivery_partner',
      'ocr_import',
      'tax_reporting',
      'subscriptions',
      'enhanced_referrals_affiliates',
    ]) {
      expect(() => assertCapabilityEnabled(capability, {
        POS_SYNC_ENABLED: 'true',
        DELIVERY_PARTNER_ENABLED: 'true',
        OCR_ENABLED: 'true',
        TAX_REPORTING_ENABLED: 'true',
        SUBSCRIPTIONS_ENABLED: 'true',
        ENHANCED_REFERRALS_ENABLED: 'true',
      } as NodeJS.ProcessEnv)).toThrow(FeatureUnavailableError);
    }
    expect(() => assertCapabilityEnabled('does_not_exist')).toThrow(/not registered/);
  });

  it('returns 503 FEATURE_UNAVAILABLE from route middleware instead of falling through', async () => {
    const send = jest.fn();
    const status = jest.fn(() => ({ send }));
    const middleware = requireCapability('pos_sync', {} as NodeJS.ProcessEnv);

    await middleware({} as any, { status } as any);

    expect(status).toHaveBeenCalledWith(503);
    expect(send).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      error: expect.objectContaining({ code: 'FEATURE_UNAVAILABLE', capability: 'pos_sync' }),
    }));
  });

  it('publishes only enabled implemented capabilities for discovery', () => {
    const discovery = publicCapabilityDiscovery({ JWT_SECRET: 'test-secret' } as NodeJS.ProcessEnv);

    expect(discovery.map((item) => item.name)).toContain('identity_auth');
    expect(discovery.map((item) => item.name)).not.toContain('pos_sync');
  });

  it('keeps local development test evidence attached to disabled capability rows', () => {
    expect(getCapability('pos_sync')?.tests).toContain('POSSyncService.test.ts');
    expect(getCapability('delivery_partner')?.tests).toContain('DeliveryService.test.ts');
    expect(getCapability('ocr_import')?.tests).toContain('OCRService.test.ts');
    expect(getCapability('tax_reporting')?.tests).toContain('TaxReportService.test.ts');
    expect(getCapability('subscriptions')?.tests).toContain('subscription-webhook.integration.test.ts');
    expect(getCapability('enhanced_referrals_affiliates')?.tests).toContain('EnhancedReferralService.test.ts');
  });

  it('keeps disabled subscription dependency evidence aligned with the product registry', () => {
    const productRegistrySource = readFileSync(
      repoFile('docs/product/capability-registry.yaml'),
      'utf8'
    );
    const subscriptionsRegistryBlock = productRegistrySource.match(
      /  - name: subscriptions\n(?<block>(?:    .+\n)+)/u
    )?.groups?.block;

    expect(subscriptionsRegistryBlock).toContain(
      'dependencies: [STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET_SUBSCRIPTIONS]'
    );
    expect(getCapability('subscriptions')?.optionalEnv).toEqual([
      'STRIPE_SECRET_KEY',
      'STRIPE_WEBHOOK_SECRET_SUBSCRIPTIONS',
    ]);
  });

  it('gates disabled runtime route groups and keeps them out of the public contract', () => {
    const mainSource = readFileSync(repoFile('backend/src/main.ts'), 'utf8');
    const appSource = readFileSync(repoFile('backend/src/app.ts'), 'utf8');
    const referralServiceSource = readFileSync(repoFile('backend/src/services/ReferralService.ts'), 'utf8');
    const referralRoutesSource = readFileSync(repoFile('backend/src/routes/referrals.ts'), 'utf8');

    expect(mainSource).toContain("registerCapabilityGatedRoutes(fastify, taxReportRoutes, '/api/v1/tax', 'tax_reporting')");
    expect(mainSource).toContain("registerCapabilityGatedRoutes(fastify, posRoutes, '/api/v1/pos', 'pos_sync')");
    expect(mainSource).toContain("registerCapabilityGatedRoutes(fastify, deliveryRoutes, '/api/v1/delivery', 'delivery_partner')");
    expect(mainSource).toContain("registerCapabilityGatedRoutes(fastify, enhancedReferralRoutes, '/api/v1', 'enhanced_referrals_affiliates')");
    expect(mainSource).toContain("registerCapabilityGatedRoutes(fastify, subscriptionRoutes, '/api/v1/subscriptions', 'subscriptions', { bypassPaths: ['/webhook'] })");
    expect(mainSource).toContain("registerCapabilityGatedRoutes(fastify, ocrRoutes, '/api/v1/ocr', 'ocr_import')");

    expect(appSource).not.toMatch(/operationId: '(subscription_tiers|subscription_subscribe|pos_create_integration|delivery_create_integration|ocr_extract_from_image)'/);
    expect(referralServiceSource).toContain("getCapability('enhanced_referrals_affiliates')");
    expect(referralServiceSource).toContain('Referral qualified. Reward credits are disabled for this launch build.');
    expect(referralRoutesSource).toContain('total_rewards_earned_cents: 0');
    expect(referralRoutesSource).toContain('reward_value_cents: 0');
  });

  it('registers disabled route groups without constructing provider-backed services', async () => {
    const originalStripeSecret = process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_SECRET_KEY;

    const fakeFastify = {
      authenticate: jest.fn(),
      get: jest.fn(),
      post: jest.fn(),
    };

    try {
      await subscriptionRoutes(fakeFastify as any);
      await posRoutes(fakeFastify as any);
      await deliveryRoutes(fakeFastify as any);
      await enhancedReferralRoutes(fakeFastify as any);
      await taxReportRoutes(fakeFastify as any);
      await ocrRoutes(fakeFastify as any);
    } finally {
      if (originalStripeSecret === undefined) {
        delete process.env.STRIPE_SECRET_KEY;
      } else {
        process.env.STRIPE_SECRET_KEY = originalStripeSecret;
      }
    }

    const disabledRouteSources = [
      'backend/src/routes/subscriptions.ts',
      'backend/src/routes/pos.ts',
      'backend/src/routes/delivery.ts',
      'backend/src/routes/enhancedReferrals.ts',
      'backend/src/routes/taxReports.ts',
    ].map((pathFromRoot) => readFileSync(repoFile(pathFromRoot), 'utf8'));

    for (const source of disabledRouteSources) {
      expect(source).not.toMatch(/^\s*const\s+\w+Service\s*=\s*new\s+\w+Service\(/m);
    }
  });

  it('returns FEATURE_UNAVAILABLE from direct disabled route-plugin registration before route side effects', async () => {
    const getRepository = jest
      .spyOn(AppDataSource, 'getRepository')
      .mockImplementation(() => {
        throw new Error('disabled route groups should fail before repository initialization');
      });
    const query = jest
      .spyOn(AppDataSource, 'query')
      .mockRejectedValue(new Error('disabled route groups should fail before database queries'));
    const getStats = jest
      .spyOn(OCRService, 'getStats')
      .mockImplementation(() => {
        throw new Error('disabled OCR stats should fail before stats dispatch');
      });
    const cases = [
      {
        capability: 'pos_sync',
        routes: posRoutes,
        request: { method: 'GET' as const, url: '/stats/business-1' },
      },
      {
        capability: 'delivery_partner',
        routes: deliveryRoutes,
        request: { method: 'GET' as const, url: '/stats/business-1' },
      },
      {
        capability: 'tax_reporting',
        routes: taxReportRoutes,
        request: { method: 'GET' as const, url: '/gst-report?businessId=business-1&startDate=2026-06-01&endDate=2026-06-30' },
      },
      {
        capability: 'subscriptions',
        routes: subscriptionRoutes,
        request: { method: 'GET' as const, url: '/tiers' },
      },
      {
        capability: 'enhanced_referrals_affiliates',
        routes: enhancedReferralRoutes,
        request: { method: 'GET' as const, url: '/referrals/leaderboard' },
      },
      {
        capability: 'ocr_import',
        routes: ocrRoutes,
        request: {
          method: 'POST' as const,
          url: '/extract-from-text',
          payload: { menu_text: 'Samosa ₹20' },
        },
      },
      {
        capability: 'ocr_import',
        routes: ocrRoutes,
        request: {
          method: 'POST' as const,
          url: '/bulk-import',
          payload: {
            business_id: 'business-1',
            dishes: [{ name: 'Samosa', price_cents: 2000 }],
          },
        },
      },
      {
        capability: 'ocr_import',
        routes: ocrRoutes,
        request: {
          method: 'GET' as const,
          url: '/stats',
        },
      },
    ];

    try {
      for (const item of cases) {
        const app = Fastify({ logger: false });
        app.decorate('authenticate', async () => undefined);
        app.decorate('orm', {
          manager: {
            findOne: jest.fn(() => {
              throw new Error(`${item.capability} should fail before ORM access`);
            }),
            findAndCount: jest.fn(() => {
              throw new Error(`${item.capability} should fail before ORM access`);
            }),
          },
        });

        try {
          await app.register(item.routes as any);
          const response = await app.inject(item.request);

          expect(response.statusCode).toBe(503);
          expect(response.json()).toMatchObject({
            success: false,
            error: {
              code: 'FEATURE_UNAVAILABLE',
              capability: item.capability,
            },
          });
        } finally {
          await app.close();
        }
      }

      expect(getRepository).not.toHaveBeenCalled();
      expect(query).not.toHaveBeenCalled();
      expect(getStats).not.toHaveBeenCalled();
    } finally {
      getRepository.mockRestore();
      query.mockRestore();
      getStats.mockRestore();
    }
  });

  it('rejects unsafe POS route controls before trimming or status lowercasing can erase edge evidence', () => {
    expect(normalizeRequiredPosString(' business-1 ')).toBe('business-1');
    expect(parseOptionalSyncStatus('POS sync history status', ' Success ')).toBe('success');

    for (const value of ['\uFEFFbusiness-1', 'business-1\uFEFF']) {
      expect(normalizeRequiredPosString(value)).toBe(value);
    }

    for (const status of ['\uFEFFsuccess', 'success\uFEFF']) {
      expect(() => parseOptionalSyncStatus('POS sync history status', status)).toThrow(
        'POS sync history status must not include unsafe control characters'
      );
    }
  });

  it('rejects unsafe delivery route controls before trimming can erase edge evidence', () => {
    expect(normalizedRequiredDeliveryString(' business-1 ')).toBe('business-1');
    expect(normalizedOptionalDeliveryRatingText(' careful handoff ')).toBe('careful handoff');

    for (const value of ['\uFEFFbusiness-1', 'business-1\uFEFF']) {
      expect(normalizedRequiredDeliveryString(value)).toBe(value);
    }

    for (const feedback of ['\uFEFFcareful handoff', 'careful handoff\uFEFF']) {
      expect(normalizedOptionalDeliveryRatingText(feedback)).toBe(feedback);
    }
  });

  it('rejects unsafe OCR route controls before trimming or MIME lowercasing can erase edge evidence', () => {
    expect(normalizeRequiredOcrString(' menu text ')).toBe('menu text');
    expect(normalizeOptionalOcrImageMimeType(' Image/PNG ')).toBe('image/png');
    expect(normalizeOptionalOcrImageMimeType(undefined)).toBe('image/jpeg');

    for (const value of ['\uFEFFmenu text', 'menu text\uFEFF']) {
      expect(normalizeRequiredOcrString(value)).toBe(value);
    }

    for (const mimeType of ['\uFEFFimage/png', 'image/png\uFEFF']) {
      expect(normalizeOptionalOcrImageMimeType(mimeType)).toBeNull();
    }
  });

  it('rejects unsafe tax route controls before trimming can erase edge evidence', () => {
    expect(normalizeRequiredTaxString(' business-1 ')).toBe('business-1');
    expect(normalizeOptionalTaxDateFilter(' 2026-06-01 ')).toBe('2026-06-01');
    expect(normalizeOptionalTaxDateFilter('   ')).toBeUndefined();
    expect(normalizeOptionalTaxDateFilter(undefined)).toBeUndefined();

    for (const value of ['\uFEFFbusiness-1', 'business-1\uFEFF']) {
      expect(normalizeRequiredTaxString(value)).toBe(value);
    }

    for (const date of ['\uFEFF2026-06-01', '2026-06-01\uFEFF']) {
      expect(normalizeOptionalTaxDateFilter(date)).toBe(date);
    }
  });

  it('rejects unsafe subscription route controls before trimming can erase edge evidence', () => {
    expect(normalizeRequiredSubscriptionString(' business-1 ')).toBe('business-1');
    expect(normalizeRequiredSubscriptionString(' starter ')).toBe('starter');
    expect(normalizeRequiredSubscriptionString(' seller@example.com ')).toBe('seller@example.com');
    expect(normalizeRequiredSubscriptionString('   ')).toBeNull();

    for (const value of ['\uFEFFbusiness-1', 'business-1\uFEFF']) {
      expect(normalizeRequiredSubscriptionString(value)).toBe(value);
    }

    for (const tier of ['\uFEFFstarter', 'starter\uFEFF']) {
      expect(normalizeRequiredSubscriptionString(tier)).toBe(tier);
    }

    for (const email of ['\uFEFFseller@example.com', 'seller@example.com\uFEFF']) {
      expect(normalizeRequiredSubscriptionString(email)).toBe(email);
    }

    for (const returnUrl of ['\uFEFFhttps://app.example.com/billing', 'https://app.example.com/billing\uFEFF']) {
      expect(normalizeRequiredSubscriptionString(returnUrl)).toBe(returnUrl);
    }
  });

  it('rejects unsafe enhanced-referral route controls before trimming can erase edge evidence', () => {
    expect(normalizeRequiredReferralString(' user-1 ')).toBe('user-1');
    expect(normalizeOptionalReferralString(' @foodie ')).toBe('@foodie');
    expect(normalizeOptionalReferralString('   ')).toBeUndefined();
    expect(parseOptionalNonNegativeReferralInteger(' 1200 ')).toBe(1200);
    expect(parseOptionalLeaderboardLimit(' 25 ')).toBe(25);

    for (const value of ['\uFEFFuser-1', 'user-1\uFEFF']) {
      expect(normalizeRequiredReferralString(value)).toBe(value);
    }

    for (const socialHandle of ['\uFEFF@foodie', '@foodie\uFEFF']) {
      expect(normalizeOptionalReferralString(socialHandle)).toBe(socialHandle);
    }

    for (const followerCount of ['\uFEFF1200', '1200\uFEFF']) {
      expect(parseOptionalNonNegativeReferralInteger(followerCount)).toBeNull();
    }

    for (const limit of ['\uFEFF25', '25\uFEFF']) {
      expect(() => parseOptionalLeaderboardLimit(limit)).toThrow(
        'Referral leaderboard limit must not include unsafe control characters'
      );
    }
  });

  it('uses TypeORM date ranges for tax invoice list filters', async () => {
    const registeredGetRoutes: Array<{ path: string; handler: Function }> = [];
    const findOne = jest.fn(async () => ({ id: 'business-1', owner_id: 'user-1' }));
    const findAndCount = jest.fn(async () => [[], 0]);
    const fakeFastify = {
      addHook: jest.fn(),
      get: jest.fn((path: string, _options: unknown, handler: Function) => {
        registeredGetRoutes.push({ path, handler });
      }),
      post: jest.fn(),
      orm: {
        manager: {
          findOne,
          findAndCount,
        },
      },
    };
    const sent = jest.fn();
    const reply = {
      status: jest.fn(() => ({ send: sent })),
      send: sent,
    };

    await taxReportRoutes(fakeFastify as any);
    const route = registeredGetRoutes.find((item) => item.path === '/invoices/business/:businessId');
    expect(route).toBeDefined();

    await route!.handler(
      {
        params: { businessId: ' business-1 ' },
        query: {
          limit: 25,
          offset: 5,
          startDate: '2026-06-01T00:00:00.000Z',
          endDate: '2026-06-30T23:59:59.999Z',
        },
        user: { userId: 'user-1' },
      },
      reply
    );

    expect(findAndCount).toHaveBeenCalledWith('TaxInvoice', expect.objectContaining({
      where: expect.objectContaining({
        business_id: 'business-1',
        invoice_date: expect.objectContaining({
          _type: 'between',
          _value: [
            new Date('2026-06-01T00:00:00.000Z'),
            new Date('2026-06-30T23:59:59.999Z'),
          ],
        }),
      }),
      take: 25,
      skip: 5,
    }));
    expect(findAndCount.mock.calls[0][1].where.invoice_date).not.toHaveProperty('$gte');
    expect(findAndCount.mock.calls[0][1].where.invoice_date).not.toHaveProperty('$lte');
    expect(sent).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      data: expect.objectContaining({ total: 0, limit: 25, offset: 5 }),
    }));
  });

  it('rejects blank tax business IDs before ORM or service calls', async () => {
    const registeredGetRoutes: Array<{ path: string; handler: Function }> = [];
    const findOne = jest.fn(async () => {
      throw new Error('business ownership should not be checked for blank tax business IDs');
    });
    const findAndCount = jest.fn(async () => {
      throw new Error('tax invoice list should not be queried for blank business IDs');
    });
    const generateGstReport = jest
      .spyOn(TaxReportService.prototype, 'generateGstReport')
      .mockRejectedValue(new Error('generateGstReport should not be called'));
    const generateProfitAnalysis = jest
      .spyOn(TaxReportService.prototype, 'generateProfitAnalysis')
      .mockRejectedValue(new Error('generateProfitAnalysis should not be called'));
    const fakeFastify = {
      addHook: jest.fn(),
      get: jest.fn((path: string, _options: unknown, handler: Function) => {
        registeredGetRoutes.push({ path, handler });
      }),
      post: jest.fn(),
      orm: {
        manager: {
          findOne,
          findAndCount,
        },
      },
    };

    const expectMissingBusinessId = async (
      path: string,
      request: Record<string, unknown>,
      message: string
    ) => {
      const route = registeredGetRoutes.find((registered) => registered.path === path);
      expect(route).toBeDefined();

      const send = jest.fn();
      const status = jest.fn(() => ({ send }));
      await route!.handler(request, { status });
      expect(status).toHaveBeenCalledWith(400);
      expect(send).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'MISSING_PARAMETERS',
          message,
        },
      });
    };

    try {
      await taxReportRoutes(fakeFastify as any);

      await expectMissingBusinessId(
        '/gst-report',
        {
          user: { userId: 'user-1' },
        },
        'Business ID, start date, and end date are required'
      );
      await expectMissingBusinessId(
        '/profit-analysis',
        {
          query: {},
          user: { userId: 'user-1' },
        },
        'Business ID, start date, and end date are required'
      );
      await expectMissingBusinessId(
        '/gst-report',
        {
          query: {
            businessId: '   ',
            startDate: '2026-06-01T00:00:00.000Z',
            endDate: '2026-06-30T23:59:59.999Z',
          },
          user: { userId: 'user-1' },
        },
        'Business ID, start date, and end date are required'
      );
      await expectMissingBusinessId(
        '/profit-analysis',
        {
          query: {
            businessId: '   ',
            startDate: '2026-06-01T00:00:00.000Z',
            endDate: '2026-06-30T23:59:59.999Z',
          },
          user: { userId: 'user-1' },
        },
        'Business ID, start date, and end date are required'
      );
      await expectMissingBusinessId(
        '/invoices/business/:businessId',
        {
          params: { businessId: '   ' },
          query: { limit: '25' },
          user: { userId: 'user-1' },
        },
        'Business ID is required'
      );
      for (const malformedParams of [undefined, ['business-1']]) {
        await expectMissingBusinessId(
          '/invoices/business/:businessId',
          {
            params: malformedParams,
            query: { limit: '25' },
            user: { userId: 'user-1' },
          },
          'Business ID is required'
        );
      }

      expect(findOne).not.toHaveBeenCalled();
      expect(findAndCount).not.toHaveBeenCalled();
      expect(generateGstReport).not.toHaveBeenCalled();
      expect(generateProfitAnalysis).not.toHaveBeenCalled();
    } finally {
      generateGstReport.mockRestore();
      generateProfitAnalysis.mockRestore();
    }
  });

  it('rejects oversized tax authenticated user IDs before ORM or service calls', async () => {
    const registeredGetRoutes: Array<{ path: string; handler: Function }> = [];
    const registeredPostRoutes: Array<{ path: string; handler: Function }> = [];
    const findOne = jest.fn(async () => {
      throw new Error('tax ownership should not be checked for oversized authenticated user IDs');
    });
    const findAndCount = jest.fn(async () => {
      throw new Error('tax invoice list should not be queried for oversized authenticated user IDs');
    });
    const getInvoiceByOrderId = jest
      .spyOn(TaxReportService.prototype, 'getInvoiceByOrderId')
      .mockRejectedValue(new Error('getInvoiceByOrderId should not be called'));
    const generateTaxInvoice = jest
      .spyOn(TaxReportService.prototype, 'generateTaxInvoice')
      .mockRejectedValue(new Error('generateTaxInvoice should not be called'));
    const generateGstReport = jest
      .spyOn(TaxReportService.prototype, 'generateGstReport')
      .mockRejectedValue(new Error('generateGstReport should not be called'));
    const generateProfitAnalysis = jest
      .spyOn(TaxReportService.prototype, 'generateProfitAnalysis')
      .mockRejectedValue(new Error('generateProfitAnalysis should not be called'));
    const fakeFastify = {
      addHook: jest.fn(),
      get: jest.fn((path: string, _options: unknown, handler: Function) => {
        registeredGetRoutes.push({ path, handler });
      }),
      post: jest.fn((path: string, _options: unknown, handler: Function) => {
        registeredPostRoutes.push({ path, handler });
      }),
      orm: {
        manager: {
          findOne,
          findAndCount,
        },
      },
    };

    try {
      await taxReportRoutes(fakeFastify as any);
      const routeCases = [
        {
          routes: registeredGetRoutes,
          path: '/invoices/:orderId',
          request: {
            params: { orderId: 'order-1' },
            query: {},
            user: { userId: 'u'.repeat(256) },
          },
        },
        {
          routes: registeredPostRoutes,
          path: '/invoices/:orderId/generate',
          request: {
            params: { orderId: 'order-1' },
            query: {},
            body: {},
            user: { userId: 'u'.repeat(256) },
          },
        },
        {
          routes: registeredGetRoutes,
          path: '/gst-report',
          request: {
            query: {
              businessId: 'business-1',
              startDate: '2026-06-01T00:00:00.000Z',
              endDate: '2026-06-30T23:59:59.999Z',
            },
            user: { userId: 'u'.repeat(256) },
          },
        },
        {
          routes: registeredGetRoutes,
          path: '/profit-analysis',
          request: {
            query: {
              businessId: 'business-1',
              startDate: '2026-06-01T00:00:00.000Z',
              endDate: '2026-06-30T23:59:59.999Z',
            },
            user: { userId: 'u'.repeat(256) },
          },
        },
        {
          routes: registeredGetRoutes,
          path: '/invoices/business/:businessId',
          request: {
            params: { businessId: 'business-1' },
            query: {},
            user: { userId: 'u'.repeat(256) },
          },
        },
      ];

      for (const { routes, path, request } of routeCases) {
        const route = routes.find((registered) => registered.path === path);
        expect(route).toBeDefined();

        const send = jest.fn();
        const status = jest.fn(() => ({ send }));
        await route!.handler(request, { status });

        expect(status).toHaveBeenCalledWith(400);
        expect(send).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'INVALID_TAX_TEXT_FIELD',
            message: 'Tax user ID must be at most 255 characters',
          },
        });
      }

      expect(findOne).not.toHaveBeenCalled();
      expect(findAndCount).not.toHaveBeenCalled();
      expect(getInvoiceByOrderId).not.toHaveBeenCalled();
      expect(generateTaxInvoice).not.toHaveBeenCalled();
      expect(generateGstReport).not.toHaveBeenCalled();
      expect(generateProfitAnalysis).not.toHaveBeenCalled();
    } finally {
      getInvoiceByOrderId.mockRestore();
      generateTaxInvoice.mockRestore();
      generateGstReport.mockRestore();
      generateProfitAnalysis.mockRestore();
    }
  });

  it('rejects invalid tax authenticated user IDs before tax request parsing or service calls', async () => {
    const registeredGetRoutes: Array<{ path: string; handler: Function }> = [];
    const registeredPostRoutes: Array<{ path: string; handler: Function }> = [];
    const findOne = jest.fn(async () => {
      throw new Error('tax ownership should not be checked for invalid authenticated user IDs');
    });
    const findAndCount = jest.fn(async () => {
      throw new Error('tax invoice list should not be queried for invalid authenticated user IDs');
    });
    const getInvoiceByOrderId = jest
      .spyOn(TaxReportService.prototype, 'getInvoiceByOrderId')
      .mockRejectedValue(new Error('getInvoiceByOrderId should not be called'));
    const generateTaxInvoice = jest
      .spyOn(TaxReportService.prototype, 'generateTaxInvoice')
      .mockRejectedValue(new Error('generateTaxInvoice should not be called'));
    const generateGstReport = jest
      .spyOn(TaxReportService.prototype, 'generateGstReport')
      .mockRejectedValue(new Error('generateGstReport should not be called'));
    const generateProfitAnalysis = jest
      .spyOn(TaxReportService.prototype, 'generateProfitAnalysis')
      .mockRejectedValue(new Error('generateProfitAnalysis should not be called'));
    const fakeFastify = {
      addHook: jest.fn(),
      get: jest.fn((path: string, _options: unknown, handler: Function) => {
        registeredGetRoutes.push({ path, handler });
      }),
      post: jest.fn((path: string, _options: unknown, handler: Function) => {
        registeredPostRoutes.push({ path, handler });
      }),
      orm: {
        manager: {
          findOne,
          findAndCount,
        },
      },
    };

    try {
      await taxReportRoutes(fakeFastify as any);
      const routeCases = [
        {
          routes: registeredGetRoutes,
          path: '/invoices/:orderId',
          request: {
            params: { orderId: '   ' },
            query: 'includePdfUrl=true',
          },
          expected: {
            code: 'INVALID_TAX_USER',
            message: 'Authenticated tax user ID is required',
          },
        },
        {
          routes: registeredPostRoutes,
          path: '/invoices/:orderId/generate',
          request: {
            params: { orderId: '   ' },
            query: 'includePdfUrl=true',
            body: ['includePdfUrl'],
            user: { userId: 'u'.repeat(256) },
          },
          expected: {
            code: 'INVALID_TAX_TEXT_FIELD',
            message: 'Tax user ID must be at most 255 characters',
          },
        },
        {
          routes: registeredGetRoutes,
          path: '/gst-report',
          request: {
            query: ['businessId=business-1'],
            user: { userId: 'user-\u202E1' },
          },
          expected: {
            code: 'INVALID_TAX_TEXT_FIELD',
            message: 'Tax user ID must not include unsafe control characters',
          },
        },
        {
          routes: registeredGetRoutes,
          path: '/profit-analysis',
          request: {
            query: {
              businessId: 'business-1',
              startDate: 'not-a-date',
              endDate: '2026-06-30T23:59:59.999Z',
            },
            user: { id: '   ' },
          },
          expected: {
            code: 'INVALID_TAX_USER',
            message: 'Authenticated tax user ID is required',
          },
        },
        {
          routes: registeredGetRoutes,
          path: '/invoices/business/:businessId',
          request: {
            params: undefined,
            query: ['limit=25'],
            user: { userId: 'u'.repeat(256) },
          },
          expected: {
            code: 'INVALID_TAX_TEXT_FIELD',
            message: 'Tax user ID must be at most 255 characters',
          },
        },
      ];

      for (const { routes, path, request, expected } of routeCases) {
        const route = routes.find((registered) => registered.path === path);
        expect(route).toBeDefined();

        const send = jest.fn();
        const status = jest.fn(() => ({ send }));
        await route!.handler(request, { status });

        expect(status).toHaveBeenCalledWith(400);
        expect(send).toHaveBeenCalledWith({
          success: false,
          error: expected,
        });
      }

      expect(findOne).not.toHaveBeenCalled();
      expect(findAndCount).not.toHaveBeenCalled();
      expect(getInvoiceByOrderId).not.toHaveBeenCalled();
      expect(generateTaxInvoice).not.toHaveBeenCalled();
      expect(generateGstReport).not.toHaveBeenCalled();
      expect(generateProfitAnalysis).not.toHaveBeenCalled();
    } finally {
      getInvoiceByOrderId.mockRestore();
      generateTaxInvoice.mockRestore();
      generateGstReport.mockRestore();
      generateProfitAnalysis.mockRestore();
    }
  });

  it('rejects blank tax invoice order IDs before ORM or service calls and normalizes valid IDs', async () => {
    const registeredGetRoutes: Array<{ path: string; handler: Function }> = [];
    const registeredPostRoutes: Array<{ path: string; handler: Function }> = [];
    const invoice = { id: 'invoice-1', order_id: 'order-1' };
    const findOne = jest.fn(async (entity: unknown, options: any) => {
      if (entity === Order && options?.select) {
        return { id: 'order-1', business_id: 'business-1', status: 'fulfilled' };
      }
      if (entity === Business) {
        return { id: 'business-1', owner_id: 'user-1' };
      }
      if (entity === Order) {
        return { id: 'order-1', business_id: 'business-1', status: 'fulfilled' };
      }
      throw new Error('unexpected tax invoice ORM entity');
    });
    const getInvoiceByOrderId = jest
      .spyOn(TaxReportService.prototype, 'getInvoiceByOrderId')
      .mockResolvedValue(invoice as any);
    const generateTaxInvoice = jest
      .spyOn(TaxReportService.prototype, 'generateTaxInvoice')
      .mockResolvedValue(invoice as any);
    const fakeFastify = {
      addHook: jest.fn(),
      get: jest.fn((path: string, _options: unknown, handler: Function) => {
        registeredGetRoutes.push({ path, handler });
      }),
      post: jest.fn((path: string, _options: unknown, handler: Function) => {
        registeredPostRoutes.push({ path, handler });
      }),
      orm: {
        manager: {
          findOne,
        },
      },
    };
    const makeReply = () => {
      const send = jest.fn();
      return {
        send,
        status: jest.fn(() => ({ send })),
      };
    };

    try {
      await taxReportRoutes(fakeFastify as any);
      const readRoute = registeredGetRoutes.find((registered) => registered.path === '/invoices/:orderId');
      const generateRoute = registeredPostRoutes.find((registered) => registered.path === '/invoices/:orderId/generate');
      expect(readRoute).toBeDefined();
      expect(generateRoute).toBeDefined();

      for (const malformedQuery of ['includePdfUrl=true', ['includePdfUrl']]) {
        const reply = makeReply();
        await readRoute!.handler(
          {
            params: { orderId: 'order-1' },
            query: malformedQuery,
            user: { userId: 'user-1' },
          },
          reply
        );

        expect(reply.status).toHaveBeenCalledWith(400);
        expect(reply.send).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'INVALID_TAX_INVOICE_QUERY',
            message: 'Tax invoice read query must be an object',
          },
        });
      }

      const unsupportedReadQueryReply = makeReply();
      await readRoute!.handler(
        {
          params: { orderId: 'order-1' },
          query: { include_pdf_url: 'true' },
          user: { userId: 'user-1' },
        },
        unsupportedReadQueryReply
      );
      expect(unsupportedReadQueryReply.status).toHaveBeenCalledWith(400);
      expect(unsupportedReadQueryReply.send).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'UNSUPPORTED_TAX_QUERY_FIELD',
          message: 'Unsupported tax query field(s): include_pdf_url',
        },
      });

      const unsafeReadQueryReply = makeReply();
      await readRoute!.handler(
        {
          params: { orderId: 'order-1' },
          query: { ['include_pdf_url\uFEFF']: 'true' },
          user: { userId: 'user-1' },
        },
        unsafeReadQueryReply
      );
      expect(unsafeReadQueryReply.status).toHaveBeenCalledWith(400);
      expect(unsafeReadQueryReply.send).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_TAX_FIELD_NAME',
          message: 'Tax invoice read query field names must not include unsafe control characters',
        },
      });

      for (const malformedQuery of ['forceRegenerate=true', ['forceRegenerate']]) {
        const reply = makeReply();
        await generateRoute!.handler(
          {
            params: { orderId: 'order-1' },
            query: malformedQuery,
            body: {},
            user: { userId: 'user-1' },
          },
          reply
        );

        expect(reply.status).toHaveBeenCalledWith(400);
        expect(reply.send).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'INVALID_TAX_INVOICE_QUERY',
            message: 'Tax invoice generation query must be an object',
          },
        });
      }

      const unsupportedGenerateQueryReply = makeReply();
      await generateRoute!.handler(
        {
          params: { orderId: 'order-1' },
          query: { force_regenerate: 'true' },
          body: {},
          user: { userId: 'user-1' },
        },
        unsupportedGenerateQueryReply
      );
      expect(unsupportedGenerateQueryReply.status).toHaveBeenCalledWith(400);
      expect(unsupportedGenerateQueryReply.send).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'UNSUPPORTED_TAX_QUERY_FIELD',
          message: 'Unsupported tax query field(s): force_regenerate',
        },
      });

      const unsafeGenerateQueryReply = makeReply();
      await generateRoute!.handler(
        {
          params: { orderId: 'order-1' },
          query: { ['force_regenerate\uFEFF']: 'true' },
          body: {},
          user: { userId: 'user-1' },
        },
        unsafeGenerateQueryReply
      );
      expect(unsafeGenerateQueryReply.status).toHaveBeenCalledWith(400);
      expect(unsafeGenerateQueryReply.send).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_TAX_FIELD_NAME',
          message: 'Tax invoice generation query field names must not include unsafe control characters',
        },
      });

      for (const malformedBody of ['forceRegenerate=true', ['forceRegenerate']]) {
        const reply = makeReply();
        await generateRoute!.handler(
          {
            params: { orderId: 'order-1' },
            body: malformedBody,
            user: { userId: 'user-1' },
          },
          reply
        );

        expect(reply.status).toHaveBeenCalledWith(400);
        expect(reply.send).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'INVALID_TAX_INVOICE_GENERATE_BODY',
            message: 'Tax invoice generation body must be an object',
          },
        });
      }

      const unsupportedGenerateBodyReply = makeReply();
      await generateRoute!.handler(
        {
          params: { orderId: 'order-1' },
          body: { force_regenerate: true },
          user: { userId: 'user-1' },
        },
        unsupportedGenerateBodyReply
      );
      expect(unsupportedGenerateBodyReply.status).toHaveBeenCalledWith(400);
      expect(unsupportedGenerateBodyReply.send).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'UNSUPPORTED_TAX_BODY_FIELD',
          message: 'Unsupported tax body field(s): force_regenerate',
        },
      });

      const unsafeGenerateBodyReply = makeReply();
      await generateRoute!.handler(
        {
          params: { orderId: 'order-1' },
          body: { ['force_regenerate\uFEFF']: true },
          user: { userId: 'user-1' },
        },
        unsafeGenerateBodyReply
      );
      expect(unsafeGenerateBodyReply.status).toHaveBeenCalledWith(400);
      expect(unsafeGenerateBodyReply.send).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_TAX_FIELD_NAME',
          message: 'Tax invoice generation body field names must not include unsafe control characters',
        },
      });

      for (const { route, params } of [
        { route: readRoute!, params: { orderId: '   ' } },
        { route: generateRoute!, params: { orderId: '   ' } },
        { route: readRoute!, params: undefined },
        { route: generateRoute!, params: undefined },
        { route: readRoute!, params: ['order-1'] },
        { route: generateRoute!, params: ['order-1'] },
      ]) {
        const reply = makeReply();
        await route.handler(
          {
            params,
            user: { userId: 'user-1' },
          },
          reply
        );

        expect(reply.status).toHaveBeenCalledWith(400);
        expect(reply.send).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'MISSING_PARAMETERS',
            message: 'Order ID is required',
          },
        });
      }

      for (const { route, params } of [
        { route: readRoute!, params: { orderId: 'order-\u202E1' } },
        { route: generateRoute!, params: { orderId: 'order-\u200B1' } },
      ]) {
        const reply = makeReply();
        await route.handler(
          {
            params,
            user: { userId: 'user-1' },
          },
          reply
        );

        expect(reply.status).toHaveBeenCalledWith(400);
        expect(reply.send).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'INVALID_TAX_TEXT_FIELD',
            message: 'Order ID must not include unsafe control characters',
          },
        });
      }

      for (const route of [readRoute!, generateRoute!]) {
        const reply = makeReply();
        await route.handler(
          {
            params: { orderId: 'o'.repeat(256) },
            user: { userId: 'user-1' },
          },
          reply
        );

        expect(reply.status).toHaveBeenCalledWith(400);
        expect(reply.send).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'INVALID_TAX_TEXT_FIELD',
            message: 'Order ID must be at most 255 characters',
          },
        });
      }

      expect(findOne).not.toHaveBeenCalled();
      expect(getInvoiceByOrderId).not.toHaveBeenCalled();
      expect(generateTaxInvoice).not.toHaveBeenCalled();

      await readRoute!.handler(
        {
          params: { orderId: ' order-1 ' },
          user: { userId: 'user-1' },
        },
        makeReply()
      );
      await generateRoute!.handler(
        {
          params: { orderId: ' order-1 ' },
          user: { userId: 'user-1' },
        },
        makeReply()
      );

      expect(findOne).toHaveBeenCalledWith(Order, expect.objectContaining({
        where: { id: 'order-1' },
      }));
      expect(getInvoiceByOrderId).toHaveBeenCalledWith('order-1');
      expect(generateTaxInvoice).toHaveBeenCalledWith('order-1');
    } finally {
      getInvoiceByOrderId.mockRestore();
      generateTaxInvoice.mockRestore();
    }
  });

  it('rejects invalid tax report route date ranges before ORM or service calls', async () => {
    const registeredGetRoutes: Array<{ path: string; handler: Function }> = [];
    const findOne = jest.fn(async () => {
      throw new Error('business ownership should not be checked for invalid report dates');
    });
    const generateGstReport = jest
      .spyOn(TaxReportService.prototype, 'generateGstReport')
      .mockRejectedValue(new Error('generateGstReport should not be called'));
    const generateProfitAnalysis = jest
      .spyOn(TaxReportService.prototype, 'generateProfitAnalysis')
      .mockRejectedValue(new Error('generateProfitAnalysis should not be called'));
    const fakeFastify = {
      addHook: jest.fn(),
      get: jest.fn((path: string, _options: unknown, handler: Function) => {
        registeredGetRoutes.push({ path, handler });
      }),
      post: jest.fn(),
      orm: {
        manager: {
          findOne,
        },
      },
    };

    try {
      await taxReportRoutes(fakeFastify as any);

      const cases = [
        {
          path: '/gst-report',
          query: {
            businessId: 'business-1',
            startDate: 'not-a-date',
            endDate: '2026-06-30T23:59:59.999Z',
          },
        },
        {
          path: '/profit-analysis',
          query: {
            businessId: 'business-1',
            startDate: '2026-07-01T00:00:00.000Z',
            endDate: '2026-06-30T23:59:59.999Z',
          },
        },
      ];

      for (const item of cases) {
        const route = registeredGetRoutes.find((registered) => registered.path === item.path);
        expect(route).toBeDefined();

        const send = jest.fn();
        const status = jest.fn(() => ({ send }));
        await route!.handler(
          {
            query: item.query,
            user: { userId: 'user-1' },
          },
          { status }
        );

        expect(status).toHaveBeenCalledWith(400);
        expect(send).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'INVALID_DATE_RANGE',
            message: 'Start date and end date must be valid dates, and start date must be before or equal to end date',
          },
        });
      }

      const unsafeCases = [
        {
          path: '/gst-report',
          query: {
            businessId: 'business-\u202E1',
            startDate: '2026-06-01T00:00:00.000Z',
            endDate: '2026-06-30T23:59:59.999Z',
          },
          message: 'Business ID must not include unsafe control characters',
        },
        {
          path: '/profit-analysis',
          query: {
            businessId: 'business-1',
            startDate: '2026-06-01T00:00:00.000Z\u200B',
            endDate: '2026-06-30T23:59:59.999Z',
          },
          message: 'Start date must not include unsafe control characters',
        },
        {
          path: '/gst-report',
          query: {
            businessId: 'business-1',
            startDate: '2026-06-01T00:00:00.000Z',
            endDate: '2026-06-30T23:59:59.999Z\u2060',
          },
          message: 'End date must not include unsafe control characters',
        },
      ];

      for (const item of unsafeCases) {
        const route = registeredGetRoutes.find((registered) => registered.path === item.path);
        expect(route).toBeDefined();

        const send = jest.fn();
        const status = jest.fn(() => ({ send }));
        await route!.handler(
          {
            query: item.query,
            user: { userId: 'user-1' },
          },
          { status }
        );

        expect(status).toHaveBeenCalledWith(400);
        expect(send).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'INVALID_TAX_TEXT_FIELD',
            message: item.message,
          },
        });
      }

      const oversizedDateRoute = registeredGetRoutes.find((registered) => registered.path === '/gst-report');
      expect(oversizedDateRoute).toBeDefined();
      const oversizedDateSend = jest.fn();
      const oversizedDateStatus = jest.fn(() => ({ send: oversizedDateSend }));
      await oversizedDateRoute!.handler(
        {
          query: {
            businessId: 'business-1',
            startDate: '2026-06-01T00:00:00.000Z'.padEnd(65, '0'),
            endDate: '2026-06-30T23:59:59.999Z',
          },
          user: { userId: 'user-1' },
        },
        { status: oversizedDateStatus }
      );

      expect(oversizedDateStatus).toHaveBeenCalledWith(400);
      expect(oversizedDateSend).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_TAX_DATE_FIELD',
          message: 'Start date must be at most 64 characters',
        },
      });

      for (const path of ['/gst-report', '/profit-analysis']) {
        const route = registeredGetRoutes.find((registered) => registered.path === path);
        expect(route).toBeDefined();
        const oversizedBusinessSend = jest.fn();
        const oversizedBusinessStatus = jest.fn(() => ({ send: oversizedBusinessSend }));
        await route!.handler(
          {
            query: {
              businessId: 'b'.repeat(256),
              startDate: '2026-06-01T00:00:00.000Z',
              endDate: '2026-06-30T23:59:59.999Z',
            },
            user: { userId: 'user-1' },
          },
          { status: oversizedBusinessStatus }
        );

        expect(oversizedBusinessStatus).toHaveBeenCalledWith(400);
        expect(oversizedBusinessSend).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'INVALID_TAX_TEXT_FIELD',
            message: 'Business ID must be at most 255 characters',
          },
        });
      }

      expect(findOne).not.toHaveBeenCalled();
      expect(generateGstReport).not.toHaveBeenCalled();
      expect(generateProfitAnalysis).not.toHaveBeenCalled();
    } finally {
      generateGstReport.mockRestore();
      generateProfitAnalysis.mockRestore();
    }
  });

  it('rejects unsupported tax query fields and partial invoice date ranges before ORM or service calls', async () => {
    const registeredGetRoutes: Array<{ path: string; handler: Function }> = [];
    const findOne = jest.fn(async () => {
      throw new Error('business ownership should not be checked for unsupported tax queries');
    });
    const findAndCount = jest.fn(async () => {
      throw new Error('tax invoice list should not be queried for unsupported tax queries');
    });
    const generateGstReport = jest
      .spyOn(TaxReportService.prototype, 'generateGstReport')
      .mockRejectedValue(new Error('generateGstReport should not be called'));
    const generateProfitAnalysis = jest
      .spyOn(TaxReportService.prototype, 'generateProfitAnalysis')
      .mockRejectedValue(new Error('generateProfitAnalysis should not be called'));
    const fakeFastify = {
      addHook: jest.fn(),
      get: jest.fn((path: string, _options: unknown, handler: Function) => {
        registeredGetRoutes.push({ path, handler });
      }),
      post: jest.fn(),
      orm: {
        manager: {
          findOne,
          findAndCount,
        },
      },
    };

    try {
      await taxReportRoutes(fakeFastify as any);

      const unsupportedCases = [
        {
          path: '/gst-report',
          query: {
            businessId: 'business-1',
            startDate: '2026-06-01T00:00:00.000Z',
            endDate: '2026-06-30T23:59:59.999Z',
            format: 'csv',
          },
          field: 'format',
        },
        {
          path: '/profit-analysis',
          query: {
            businessId: 'business-1',
            startDate: '2026-06-01T00:00:00.000Z',
            endDate: '2026-06-30T23:59:59.999Z',
            cash_basis: true,
          },
          field: 'cash_basis',
        },
        {
          path: '/invoices/business/:businessId',
          params: { businessId: 'business-1' },
          query: {
            limit: 25,
            export_format: 'csv',
          },
          field: 'export_format',
        },
      ];

      for (const item of unsupportedCases) {
        const route = registeredGetRoutes.find((registered) => registered.path === item.path);
        expect(route).toBeDefined();

        const send = jest.fn();
        const status = jest.fn(() => ({ send }));
        await route!.handler(
          {
            params: item.params,
            query: item.query,
            user: { userId: 'user-1' },
          },
          { status }
        );

        expect(status).toHaveBeenCalledWith(400);
        expect(send).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'UNSUPPORTED_TAX_QUERY_FIELD',
            message: `Unsupported tax query field(s): ${item.field}`,
          },
        });
      }

      const unsafeFieldNameCases = [
        {
          path: '/gst-report',
          query: {
            businessId: 'business-1',
            startDate: '2026-06-01T00:00:00.000Z',
            endDate: '2026-06-30T23:59:59.999Z',
            ['format\uFEFF']: 'csv',
          },
          message: 'Tax report query field names must not include unsafe control characters',
        },
        {
          path: '/profit-analysis',
          query: {
            businessId: 'business-1',
            startDate: '2026-06-01T00:00:00.000Z',
            endDate: '2026-06-30T23:59:59.999Z',
            ['cash_basis\uFEFF']: true,
          },
          message: 'Tax report query field names must not include unsafe control characters',
        },
        {
          path: '/invoices/business/:businessId',
          params: { businessId: 'business-1' },
          query: {
            limit: 25,
            ['export_format\uFEFF']: 'csv',
          },
          message: 'Tax invoice list query field names must not include unsafe control characters',
        },
      ];

      for (const item of unsafeFieldNameCases) {
        const route = registeredGetRoutes.find((registered) => registered.path === item.path);
        expect(route).toBeDefined();

        const send = jest.fn();
        const status = jest.fn(() => ({ send }));
        await route!.handler(
          {
            params: item.params,
            query: item.query,
            user: { userId: 'user-1' },
          },
          { status }
        );

        expect(status).toHaveBeenCalledWith(400);
        expect(send).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'INVALID_TAX_FIELD_NAME',
            message: item.message,
          },
        });
      }

      for (const { path, query } of [
        { path: '/gst-report', query: 'businessId=business-1' },
        { path: '/profit-analysis', query: ['businessId=business-1'] },
      ]) {
        const route = registeredGetRoutes.find((registered) => registered.path === path);
        expect(route).toBeDefined();

        const send = jest.fn();
        const status = jest.fn(() => ({ send }));
        await route!.handler(
          {
            query,
            user: { userId: 'user-1' },
          },
          { status }
        );

        expect(status).toHaveBeenCalledWith(400);
        expect(send).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'INVALID_TAX_REPORT_QUERY',
            message: 'Tax report query must be an object',
          },
        });
      }

      const invoiceRoute = registeredGetRoutes.find(
        (registered) => registered.path === '/invoices/business/:businessId'
      );
      expect(invoiceRoute).toBeDefined();

      for (const { params, query, message } of [
        {
          params: { businessId: 'business-\u202E1' },
          query: {},
          message: 'Business ID must not include unsafe control characters',
        },
        {
          params: { businessId: 'business-1' },
          query: {
            startDate: '2026-06-01T00:00:00.000Z\u200B',
            endDate: '2026-06-30T23:59:59.999Z',
          },
          message: 'Start date must not include unsafe control characters',
        },
        {
          params: { businessId: 'business-1' },
          query: {
            startDate: '2026-06-01T00:00:00.000Z',
            endDate: '2026-06-30T23:59:59.999Z\u2060',
          },
          message: 'End date must not include unsafe control characters',
        },
      ]) {
        const unsafeTextSend = jest.fn();
        const unsafeTextStatus = jest.fn(() => ({ send: unsafeTextSend }));
        await invoiceRoute!.handler(
          {
            params,
            query,
            user: { userId: 'user-1' },
          },
          { status: unsafeTextStatus }
        );

        expect(unsafeTextStatus).toHaveBeenCalledWith(400);
        expect(unsafeTextSend).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'INVALID_TAX_TEXT_FIELD',
            message,
          },
        });
      }

      for (const query of ['limit=25', ['limit=25']]) {
        const invalidContainerSend = jest.fn();
        const invalidContainerStatus = jest.fn(() => ({ send: invalidContainerSend }));
        await invoiceRoute!.handler(
          {
            params: { businessId: 'business-1' },
            query,
            user: { userId: 'user-1' },
          },
          { status: invalidContainerStatus }
        );

        expect(invalidContainerStatus).toHaveBeenCalledWith(400);
        expect(invalidContainerSend).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'INVALID_TAX_INVOICE_QUERY',
            message: 'Tax invoice list query must be an object',
          },
        });
      }

      const partialDateSend = jest.fn();
      const partialDateStatus = jest.fn(() => ({ send: partialDateSend }));
      await invoiceRoute!.handler(
        {
          params: { businessId: 'business-1' },
          query: {
            startDate: '2026-06-01T00:00:00.000Z',
          },
          user: { userId: 'user-1' },
        },
        { status: partialDateStatus }
      );

      expect(partialDateStatus).toHaveBeenCalledWith(400);
      expect(partialDateSend).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_DATE_RANGE',
          message: 'Start date and end date must be valid dates, and start date must be before or equal to end date',
        },
      });

      const invalidLimitSend = jest.fn();
      const invalidLimitStatus = jest.fn(() => ({ send: invalidLimitSend }));
      await invoiceRoute!.handler(
        {
          params: { businessId: 'business-1' },
          query: {
            limit: '101',
          },
          user: { userId: 'user-1' },
        },
        { status: invalidLimitStatus }
      );

      expect(invalidLimitStatus).toHaveBeenCalledWith(400);
      expect(invalidLimitSend).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_TAX_INVOICE_QUERY',
          message: 'Tax invoice list limit must be between 1 and 100',
        },
      });

      const invalidOffsetSend = jest.fn();
      const invalidOffsetStatus = jest.fn(() => ({ send: invalidOffsetSend }));
      await invoiceRoute!.handler(
        {
          params: { businessId: 'business-1' },
          query: {
            offset: '-1',
          },
          user: { userId: 'user-1' },
        },
        { status: invalidOffsetStatus }
      );

      expect(invalidOffsetStatus).toHaveBeenCalledWith(400);
      expect(invalidOffsetSend).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_TAX_INVOICE_QUERY',
          message: 'Tax invoice list offset must be non-negative',
        },
      });

      for (const { query, message } of [
        {
          query: { limit: '25\uFEFF' },
          message: 'Tax invoice list limit must not include unsafe control characters',
        },
        {
          query: { offset: '10\u200B' },
          message: 'Tax invoice list offset must not include unsafe control characters',
        },
      ]) {
        const unsafePaginationSend = jest.fn();
        const unsafePaginationStatus = jest.fn(() => ({ send: unsafePaginationSend }));
        await invoiceRoute!.handler(
          {
            params: { businessId: 'business-1' },
            query,
            user: { userId: 'user-1' },
          },
          { status: unsafePaginationStatus }
        );

        expect(unsafePaginationStatus).toHaveBeenCalledWith(400);
        expect(unsafePaginationSend).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'INVALID_TAX_INVOICE_QUERY',
            message,
          },
        });
      }

      const oversizedInvoiceDateSend = jest.fn();
      const oversizedInvoiceDateStatus = jest.fn(() => ({ send: oversizedInvoiceDateSend }));
      await invoiceRoute!.handler(
        {
          params: { businessId: 'business-1' },
          query: {
            startDate: '2026-06-01T00:00:00.000Z',
            endDate: '2026-06-30T23:59:59.999Z'.padEnd(65, '9'),
          },
          user: { userId: 'user-1' },
        },
        { status: oversizedInvoiceDateStatus }
      );

      expect(oversizedInvoiceDateStatus).toHaveBeenCalledWith(400);
      expect(oversizedInvoiceDateSend).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_TAX_DATE_FIELD',
          message: 'End date must be at most 64 characters',
        },
      });

      const oversizedInvoiceBusinessSend = jest.fn();
      const oversizedInvoiceBusinessStatus = jest.fn(() => ({ send: oversizedInvoiceBusinessSend }));
      await invoiceRoute!.handler(
        {
          params: { businessId: 'b'.repeat(256) },
          query: {},
          user: { userId: 'user-1' },
        },
        { status: oversizedInvoiceBusinessStatus }
      );

      expect(oversizedInvoiceBusinessStatus).toHaveBeenCalledWith(400);
      expect(oversizedInvoiceBusinessSend).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_TAX_TEXT_FIELD',
          message: 'Business ID must be at most 255 characters',
        },
      });

      expect(findOne).not.toHaveBeenCalled();
      expect(findAndCount).not.toHaveBeenCalled();
      expect(generateGstReport).not.toHaveBeenCalled();
      expect(generateProfitAnalysis).not.toHaveBeenCalled();
    } finally {
      generateGstReport.mockRestore();
      generateProfitAnalysis.mockRestore();
    }
  });

  it('returns normalized numeric pagination metadata from POS sync history route', async () => {
    const registeredGetRoutes: Array<{ path: string; handler: Function }> = [];
    const findOne = jest.fn(async () => ({ id: 'business-1', owner_id: 'user-1' }));
    const getSyncHistory = jest
      .spyOn(POSSyncService.prototype, 'getSyncHistory')
      .mockResolvedValue({ logs: [], total: 0 });
    const fakeFastify = {
      addHook: jest.fn(),
      get: jest.fn((path: string, _options: unknown, handler: Function) => {
        registeredGetRoutes.push({ path, handler });
      }),
      post: jest.fn(),
      orm: {
        manager: {
          findOne,
        },
      },
    };
    const sent = jest.fn();
    const reply = {
      status: jest.fn(() => ({ send: sent })),
      send: sent,
    };

    try {
      await posRoutes(fakeFastify as any);
      const route = registeredGetRoutes.find((item) => item.path === '/history/:businessId');
      expect(route).toBeDefined();

      await route!.handler(
        {
          params: { businessId: 'business-1' },
          query: {
            limit: '25',
            offset: '10',
            status: ' Success ',
          },
          user: { userId: 'user-1' },
        },
        reply
      );

      expect(findOne).toHaveBeenCalledWith(Business, {
        where: { id: 'business-1' },
        select: ['id', 'owner_id'],
      });
      expect(getSyncHistory).toHaveBeenCalledWith('business-1', {
        limit: 25,
        offset: 10,
        status: 'success',
      });
      expect(sent).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.objectContaining({ total: 0, limit: 25, offset: 10 }),
      }));
    } finally {
      getSyncHistory.mockRestore();
    }
  });

  it('rejects unsupported or invalid POS sync history query fields before ORM or service calls', async () => {
    const registeredGetRoutes: Array<{ path: string; handler: Function }> = [];
    const findOne = jest.fn(async () => {
      throw new Error('business ownership should not be checked for invalid POS history query');
    });
    const getSyncHistory = jest
      .spyOn(POSSyncService.prototype, 'getSyncHistory')
      .mockRejectedValue(new Error('getSyncHistory should not be called'));
    const fakeFastify = {
      addHook: jest.fn(),
      get: jest.fn((path: string, _options: unknown, handler: Function) => {
        registeredGetRoutes.push({ path, handler });
      }),
      post: jest.fn(),
      orm: {
        manager: {
          findOne,
        },
      },
    };

    try {
      await posRoutes(fakeFastify as any);
      const route = registeredGetRoutes.find((item) => item.path === '/history/:businessId');
      expect(route).toBeDefined();

      const unsupportedSend = jest.fn();
      await route!.handler(
        {
          params: { businessId: 'business-1' },
          query: {
            limit: '25',
            include_tokens: 'true',
          },
          user: { userId: 'user-1' },
        },
        { status: jest.fn(() => ({ send: unsupportedSend })) }
      );

      expect(unsupportedSend).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'UNSUPPORTED_POS_FIELD',
          message: 'Unsupported POS request field(s): include_tokens',
        },
      });

      const unsafeFieldNameSend = jest.fn();
      const unsafeFieldNameStatus = jest.fn(() => ({ send: unsafeFieldNameSend }));
      await route!.handler(
        {
          params: { businessId: 'business-1' },
          query: {
            ['include_tokens\uFEFF']: 'true',
          },
          user: { userId: 'user-1' },
        },
        { status: unsafeFieldNameStatus }
      );

      expect(unsafeFieldNameStatus).toHaveBeenCalledWith(400);
      expect(unsafeFieldNameSend).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_POS_FIELD_NAME',
          message: 'POS sync history query field names must not include unsafe control characters',
        },
      });

      const invalidLimitSend = jest.fn();
      await route!.handler(
        {
          params: { businessId: 'business-1' },
          query: {
            limit: '101',
          },
          user: { userId: 'user-1' },
        },
        { status: jest.fn(() => ({ send: invalidLimitSend })) }
      );

      expect(invalidLimitSend).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_POS_HISTORY_QUERY',
          message: 'POS sync history limit must be between 1 and 100',
        },
      });

      for (const { query, message } of [
        {
          query: { limit: '25\uFEFF' },
          message: 'POS sync history limit must not include unsafe control characters',
        },
        {
          query: { offset: '10\u200B' },
          message: 'POS sync history offset must not include unsafe control characters',
        },
      ]) {
        const unsafePaginationSend = jest.fn();
        const unsafePaginationStatus = jest.fn(() => ({ send: unsafePaginationSend }));
        await route!.handler(
          {
            params: { businessId: 'business-1' },
            query,
            user: { userId: 'user-1' },
          },
          { status: unsafePaginationStatus }
        );

        expect(unsafePaginationStatus).toHaveBeenCalledWith(400);
        expect(unsafePaginationSend).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'INVALID_POS_HISTORY_QUERY',
            message,
          },
        });
      }

      const invalidStatusSend = jest.fn();
      await route!.handler(
        {
          params: { businessId: 'business-1' },
          query: {
            status: 'teleported',
          },
          user: { userId: 'user-1' },
        },
        { status: jest.fn(() => ({ send: invalidStatusSend })) }
      );

      expect(invalidStatusSend).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_POS_HISTORY_QUERY',
          message: 'POS sync history status has an invalid status',
        },
      });

      for (const malformedQuery of ['limit=25', ['limit=25']]) {
        const malformedSend = jest.fn();
        const malformedStatus = jest.fn(() => ({ send: malformedSend }));
        await route!.handler(
          {
            params: { businessId: 'business-1' },
            query: malformedQuery,
            user: { userId: 'user-1' },
          },
          { status: malformedStatus }
        );

        expect(malformedStatus).toHaveBeenCalledWith(400);
        expect(malformedSend).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'INVALID_POS_HISTORY_QUERY',
            message: 'POS sync history query must be an object',
          },
        });
      }
      expect(findOne).not.toHaveBeenCalled();
      expect(getSyncHistory).not.toHaveBeenCalled();
    } finally {
      getSyncHistory.mockRestore();
    }
  });

  it('rejects invalid POS connect token expiry before ORM or service calls', async () => {
    const registeredPostRoutes: Array<{ path: string; handler: Function }> = [];
    const findOne = jest.fn(async () => {
      throw new Error('business ownership should not be checked for invalid POS token expiry');
    });
    const createIntegration = jest
      .spyOn(POSSyncService.prototype, 'createIntegration')
      .mockRejectedValue(new Error('createIntegration should not be called'));
    const fakeFastify = {
      addHook: jest.fn(),
      get: jest.fn(),
      post: jest.fn((path: string, _options: unknown, handler: Function) => {
        registeredPostRoutes.push({ path, handler });
      }),
      orm: {
        manager: {
          findOne,
        },
      },
    };

    try {
      await posRoutes(fakeFastify as any);
      const route = registeredPostRoutes.find((item) => item.path === '/connect');
      expect(route).toBeDefined();

      const send = jest.fn();
      const status = jest.fn(() => ({ send }));
      await route!.handler(
        {
          body: {
            business_id: 'business-1',
            provider: 'square',
            access_token: 'access-token',
            token_expires_at: 'not-a-date',
          },
          user: { userId: 'user-1' },
        },
        { status }
      );

      expect(status).toHaveBeenCalledWith(400);
      expect(send).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_TOKEN_EXPIRY',
          message: 'Token expiry must be a valid date when provided',
        },
      });

      const expiredSend = jest.fn();
      const expiredStatus = jest.fn(() => ({ send: expiredSend }));
      await route!.handler(
        {
          body: {
            business_id: 'business-1',
            provider: 'square',
            access_token: 'access-token',
            token_expires_at: '2000-01-01T00:00:00.000Z',
          },
          user: { userId: 'user-1' },
        },
        { status: expiredStatus }
      );

      expect(expiredStatus).toHaveBeenCalledWith(400);
      expect(expiredSend).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_TOKEN_EXPIRY',
          message: 'Token expiry must be in the future when provided',
        },
      });
      expect(findOne).not.toHaveBeenCalled();
      expect(createIntegration).not.toHaveBeenCalled();
    } finally {
      createIntegration.mockRestore();
    }
  });

  it('rejects non-string POS connect optional metadata before ORM or service calls', async () => {
    const registeredPostRoutes: Array<{ path: string; handler: Function }> = [];
    const findOne = jest.fn(async () => {
      throw new Error('business ownership should not be checked for invalid POS metadata');
    });
    const createIntegration = jest
      .spyOn(POSSyncService.prototype, 'createIntegration')
      .mockRejectedValue(new Error('createIntegration should not be called for invalid POS metadata'));
    const fakeFastify = {
      addHook: jest.fn(),
      get: jest.fn(),
      post: jest.fn((path: string, _options: unknown, handler: Function) => {
        registeredPostRoutes.push({ path, handler });
      }),
      orm: {
        manager: {
          findOne,
        },
      },
    };

    try {
      await posRoutes(fakeFastify as any);
      const route = registeredPostRoutes.find((item) => item.path === '/connect');
      expect(route).toBeDefined();

      for (const invalidOptionalMetadata of [
        { refresh_token: { token: 'refresh-token' } },
        { token_expires_at: 1798761600000 },
        { location_id: true },
        { merchant_id: ['merchant-1'] },
      ]) {
        const send = jest.fn();
        const status = jest.fn(() => ({ send }));
        await route!.handler(
          {
            body: {
              business_id: 'business-1',
              provider: 'square',
              access_token: 'access-token',
              ...invalidOptionalMetadata,
            },
            user: { userId: 'user-1' },
          },
          { status }
        );

        expect(status).toHaveBeenCalledWith(400);
        expect(send).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'INVALID_POS_CONNECT_METADATA',
            message: 'POS connect optional fields must be strings when provided',
          },
        });
      }

      expect(findOne).not.toHaveBeenCalled();
      expect(createIntegration).not.toHaveBeenCalled();
    } finally {
      createIntegration.mockRestore();
    }
  });

  it('rejects disabled POS connect providers before ORM or service calls and normalizes launch provider', async () => {
    const registeredPostRoutes: Array<{ path: string; handler: Function }> = [];
    const findOne = jest.fn(async () => ({ id: 'business-1', owner_id: 'user-1' }));
    const createIntegration = jest
      .spyOn(POSSyncService.prototype, 'createIntegration')
      .mockResolvedValue({ id: 'integration-1', provider: 'square' } as any);
    const fakeFastify = {
      addHook: jest.fn(),
      get: jest.fn(),
      post: jest.fn((path: string, _options: unknown, handler: Function) => {
        registeredPostRoutes.push({ path, handler });
      }),
      orm: {
        manager: {
          findOne,
        },
      },
    };
    const makeReply = () => {
      const send = jest.fn();
      return {
        send,
        status: jest.fn(() => ({ send })),
      };
    };

    try {
      await posRoutes(fakeFastify as any);
      const route = registeredPostRoutes.find((item) => item.path === '/connect');
      expect(route).toBeDefined();

      const disabledReply = makeReply();
      await route!.handler(
        {
          body: {
            business_id: 'business-1',
            provider: 'dine',
            access_token: 'access-token',
          },
          user: { userId: 'user-1' },
        },
        disabledReply
      );

      expect(disabledReply.status).toHaveBeenCalledWith(503);
      expect(disabledReply.send).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'FEATURE_UNAVAILABLE',
          capability: 'pos_sync',
          message: 'POS provider dine is disabled',
        },
      });
      expect(findOne).not.toHaveBeenCalled();
      expect(createIntegration).not.toHaveBeenCalled();

      const validReply = makeReply();
      await route!.handler(
        {
          body: {
            business_id: ' business-1 ',
            provider: ' SQUARE ',
            access_token: ' access-token ',
            refresh_token: ' refresh-token ',
            token_expires_at: '2099-01-01T00:00:00.000Z',
            location_id: ' location-1 ',
            merchant_id: ' merchant-1 ',
          },
          user: { userId: 'user-1' },
        },
        validReply
      );

      expect(findOne).toHaveBeenCalledWith(Business, {
        where: { id: 'business-1' },
        select: ['id', 'owner_id'],
      });
      expect(createIntegration).toHaveBeenCalledWith(
        'business-1',
        'square',
        'access-token',
        {
          refresh_token: 'refresh-token',
          token_expires_at: new Date('2099-01-01T00:00:00.000Z'),
          location_id: 'location-1',
          merchant_id: 'merchant-1',
        }
      );
      expect(validReply.send).toHaveBeenCalledWith({
        success: true,
        data: { integration: { id: 'integration-1', provider: 'square' } },
        message: 'square POS integration connected successfully',
      });
    } finally {
      createIntegration.mockRestore();
    }
  });

  it('rejects unsupported POS connect and disconnect body fields before ORM or service calls', async () => {
    const registeredPostRoutes: Array<{ path: string; handler: Function }> = [];
    const findOne = jest.fn(async () => {
      throw new Error('business ownership should not be checked for unsupported POS fields');
    });
    const createIntegration = jest
      .spyOn(POSSyncService.prototype, 'createIntegration')
      .mockRejectedValue(new Error('createIntegration should not be called'));
    const disconnectIntegration = jest
      .spyOn(POSSyncService.prototype, 'disconnectIntegration')
      .mockRejectedValue(new Error('disconnectIntegration should not be called'));
    const fakeFastify = {
      addHook: jest.fn(),
      get: jest.fn(),
      post: jest.fn((path: string, _options: unknown, handler: Function) => {
        registeredPostRoutes.push({ path, handler });
      }),
      orm: {
        manager: {
          findOne,
        },
      },
    };

    try {
      await posRoutes(fakeFastify as any);
      const connectRoute = registeredPostRoutes.find((item) => item.path === '/connect');
      const disconnectRoute = registeredPostRoutes.find((item) => item.path === '/disconnect');
      expect(connectRoute).toBeDefined();
      expect(disconnectRoute).toBeDefined();

      const connectSend = jest.fn();
      await connectRoute!.handler(
        {
          body: {
            business_id: 'business-1',
            provider: 'square',
            access_token: 'access-token',
            launch_mode: 'live',
          },
          user: { userId: 'user-1' },
        },
        { status: jest.fn(() => ({ send: connectSend })) }
      );

      expect(connectSend).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'UNSUPPORTED_POS_FIELD',
          message: 'Unsupported POS request field(s): launch_mode',
        },
      });

      const disconnectSend = jest.fn();
      await disconnectRoute!.handler(
        {
          body: {
            business_id: 'business-1',
            force: true,
          },
          user: { userId: 'user-1' },
        },
        { status: jest.fn(() => ({ send: disconnectSend })) }
      );

      expect(disconnectSend).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'UNSUPPORTED_POS_FIELD',
          message: 'Unsupported POS request field(s): force',
        },
      });

      const unsafeConnectFieldNameSend = jest.fn();
      const unsafeConnectFieldNameStatus = jest.fn(() => ({ send: unsafeConnectFieldNameSend }));
      await connectRoute!.handler(
        {
          body: {
            business_id: 'business-1',
            provider: 'square',
            access_token: 'access-token',
            ['launch_mode\uFEFF']: 'live',
          },
          user: { userId: 'user-1' },
        },
        { status: unsafeConnectFieldNameStatus }
      );

      expect(unsafeConnectFieldNameStatus).toHaveBeenCalledWith(400);
      expect(unsafeConnectFieldNameSend).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_POS_FIELD_NAME',
          message: 'POS connect request field names must not include unsafe control characters',
        },
      });

      const unsafeDisconnectFieldNameSend = jest.fn();
      const unsafeDisconnectFieldNameStatus = jest.fn(() => ({ send: unsafeDisconnectFieldNameSend }));
      await disconnectRoute!.handler(
        {
          body: {
            business_id: 'business-1',
            ['force\uFEFF']: true,
          },
          user: { userId: 'user-1' },
        },
        { status: unsafeDisconnectFieldNameStatus }
      );

      expect(unsafeDisconnectFieldNameStatus).toHaveBeenCalledWith(400);
      expect(unsafeDisconnectFieldNameSend).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_POS_FIELD_NAME',
          message: 'POS disconnect request field names must not include unsafe control characters',
        },
      });
      expect(findOne).not.toHaveBeenCalled();
      expect(createIntegration).not.toHaveBeenCalled();
      expect(disconnectIntegration).not.toHaveBeenCalled();
    } finally {
      createIntegration.mockRestore();
      disconnectIntegration.mockRestore();
    }
  });

  it('rejects malformed or unsupported POS connect and disconnect query fields before ORM or service calls', async () => {
    const registeredPostRoutes: Array<{ path: string; handler: Function }> = [];
    const findOne = jest.fn(async () => {
      throw new Error('business ownership should not be checked for invalid POS command queries');
    });
    const createIntegration = jest
      .spyOn(POSSyncService.prototype, 'createIntegration')
      .mockRejectedValue(new Error('createIntegration should not be called for invalid POS command queries'));
    const disconnectIntegration = jest
      .spyOn(POSSyncService.prototype, 'disconnectIntegration')
      .mockRejectedValue(new Error('disconnectIntegration should not be called for invalid POS command queries'));
    const fakeFastify = {
      addHook: jest.fn(),
      get: jest.fn(),
      post: jest.fn((path: string, _options: unknown, handler: Function) => {
        registeredPostRoutes.push({ path, handler });
      }),
      orm: {
        manager: {
          findOne,
        },
      },
    };

    const connectBody = {
      business_id: 'business-1',
      provider: 'square',
      access_token: 'access-token',
    };
    const disconnectBody = {
      business_id: 'business-1',
    };

    try {
      await posRoutes(fakeFastify as any);
      const connectRoute = registeredPostRoutes.find((item) => item.path === '/connect');
      const disconnectRoute = registeredPostRoutes.find((item) => item.path === '/disconnect');
      expect(connectRoute).toBeDefined();
      expect(disconnectRoute).toBeDefined();

      for (const { route, body, query, code, message } of [
        {
          route: connectRoute!,
          body: connectBody,
          query: 'launchMode=live',
          code: 'INVALID_POS_CONNECT_QUERY',
          message: 'POS connect query must be an object',
        },
        {
          route: connectRoute!,
          body: connectBody,
          query: ['launchMode'],
          code: 'INVALID_POS_CONNECT_QUERY',
          message: 'POS connect query must be an object',
        },
        {
          route: disconnectRoute!,
          body: disconnectBody,
          query: 'force=true',
          code: 'INVALID_POS_DISCONNECT_QUERY',
          message: 'POS disconnect query must be an object',
        },
        {
          route: disconnectRoute!,
          body: disconnectBody,
          query: ['force'],
          code: 'INVALID_POS_DISCONNECT_QUERY',
          message: 'POS disconnect query must be an object',
        },
      ]) {
        const malformedSend = jest.fn();
        const malformedStatus = jest.fn(() => ({ send: malformedSend }));
        await route.handler(
          {
            body,
            query,
            user: { userId: 'user-1' },
          },
          { status: malformedStatus }
        );

        expect(malformedStatus).toHaveBeenCalledWith(400);
        expect(malformedSend).toHaveBeenCalledWith({
          success: false,
          error: {
            code,
            message,
          },
        });
      }

      for (const { route, body, query, message } of [
        {
          route: connectRoute!,
          body: connectBody,
          query: { launch_mode: 'live' },
          message: 'Unsupported POS query field(s): launch_mode',
        },
        {
          route: disconnectRoute!,
          body: disconnectBody,
          query: { force: 'true' },
          message: 'Unsupported POS query field(s): force',
        },
      ]) {
        const unsupportedSend = jest.fn();
        const unsupportedStatus = jest.fn(() => ({ send: unsupportedSend }));
        await route.handler(
          {
            body,
            query,
            user: { userId: 'user-1' },
          },
          { status: unsupportedStatus }
        );

        expect(unsupportedStatus).toHaveBeenCalledWith(400);
        expect(unsupportedSend).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'UNSUPPORTED_POS_QUERY_FIELD',
            message,
          },
        });
      }

      for (const { route, body, query, message } of [
        {
          route: connectRoute!,
          body: connectBody,
          query: { ['launch_mode\uFEFF']: 'live' },
          message: 'POS connect query field names must not include unsafe control characters',
        },
        {
          route: disconnectRoute!,
          body: disconnectBody,
          query: { ['force\uFEFF']: 'true' },
          message: 'POS disconnect query field names must not include unsafe control characters',
        },
      ]) {
        const unsafeQueryFieldNameSend = jest.fn();
        const unsafeQueryFieldNameStatus = jest.fn(() => ({ send: unsafeQueryFieldNameSend }));
        await route.handler(
          {
            body,
            query,
            user: { userId: 'user-1' },
          },
          { status: unsafeQueryFieldNameStatus }
        );

        expect(unsafeQueryFieldNameStatus).toHaveBeenCalledWith(400);
        expect(unsafeQueryFieldNameSend).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'INVALID_POS_FIELD_NAME',
            message,
          },
        });
      }

      expect(findOne).not.toHaveBeenCalled();
      expect(createIntegration).not.toHaveBeenCalled();
      expect(disconnectIntegration).not.toHaveBeenCalled();
    } finally {
      createIntegration.mockRestore();
      disconnectIntegration.mockRestore();
    }
  });

  it('rejects blank POS connect and disconnect required fields before ORM or service calls', async () => {
    const registeredPostRoutes: Array<{ path: string; handler: Function }> = [];
    const findOne = jest.fn(async () => {
      throw new Error('business ownership should not be checked for blank POS fields');
    });
    const createIntegration = jest
      .spyOn(POSSyncService.prototype, 'createIntegration')
      .mockRejectedValue(new Error('createIntegration should not be called'));
    const disconnectIntegration = jest
      .spyOn(POSSyncService.prototype, 'disconnectIntegration')
      .mockRejectedValue(new Error('disconnectIntegration should not be called'));
    const fakeFastify = {
      addHook: jest.fn(),
      get: jest.fn(),
      post: jest.fn((path: string, _options: unknown, handler: Function) => {
        registeredPostRoutes.push({ path, handler });
      }),
      orm: {
        manager: {
          findOne,
        },
      },
    };

    try {
      await posRoutes(fakeFastify as any);
      const connectRoute = registeredPostRoutes.find((item) => item.path === '/connect');
      const disconnectRoute = registeredPostRoutes.find((item) => item.path === '/disconnect');
      expect(connectRoute).toBeDefined();
      expect(disconnectRoute).toBeDefined();

      const connectSend = jest.fn();
      const connectStatus = jest.fn(() => ({ send: connectSend }));
      await connectRoute!.handler(
        {
          body: {
            business_id: 'business-1',
            provider: 'square',
            access_token: '   ',
          },
          user: { userId: 'user-1' },
        },
        { status: connectStatus }
      );

      expect(connectStatus).toHaveBeenCalledWith(400);
      expect(connectSend).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'MISSING_PARAMETERS',
          message: 'Business ID, provider, and access token are required',
        },
      });

      const disconnectSend = jest.fn();
      const disconnectStatus = jest.fn(() => ({ send: disconnectSend }));
      await disconnectRoute!.handler(
        {
          body: {
            business_id: '   ',
          },
          user: { userId: 'user-1' },
        },
        { status: disconnectStatus }
      );

      expect(disconnectStatus).toHaveBeenCalledWith(400);
      expect(disconnectSend).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'MISSING_PARAMETERS',
          message: 'Business ID is required',
        },
      });

      const missingConnectBodySend = jest.fn();
      const missingConnectBodyStatus = jest.fn(() => ({ send: missingConnectBodySend }));
      await connectRoute!.handler(
        {
          user: { userId: 'user-1' },
        },
        { status: missingConnectBodyStatus }
      );

      expect(missingConnectBodyStatus).toHaveBeenCalledWith(400);
      expect(missingConnectBodySend).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'MISSING_PARAMETERS',
          message: 'Business ID, provider, and access token are required',
        },
      });

      for (const { route, body } of [
        { route: connectRoute!, body: 'business_id=business-1' },
        { route: connectRoute!, body: ['business-1'] },
        { route: disconnectRoute!, body: 'business_id=business-1' },
        { route: disconnectRoute!, body: ['business-1'] },
      ]) {
        const malformedBodySend = jest.fn();
        const malformedBodyStatus = jest.fn(() => ({ send: malformedBodySend }));
        await route.handler(
          {
            body,
            user: { userId: 'user-1' },
          },
          { status: malformedBodyStatus }
        );

        expect(malformedBodyStatus).toHaveBeenCalledWith(400);
        expect(malformedBodySend).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'INVALID_POS_REQUEST_BODY',
            message: 'POS request body must be an object',
          },
        });
      }

      for (const { route, body, message } of [
        {
          route: connectRoute!,
          body: { business_id: 'business-\u202E1', provider: 'square', access_token: 'token-1' },
          message: 'POS business ID must not include unsafe control characters',
        },
        {
          route: connectRoute!,
          body: { business_id: 'business-1', provider: 'square\u202E', access_token: 'token-1' },
          message: 'POS provider must not include unsafe control characters',
        },
        {
          route: connectRoute!,
          body: { business_id: 'business-1', provider: 'square', access_token: 'token-\u200B1' },
          message: 'POS access token must not include unsafe control characters',
        },
        {
          route: connectRoute!,
          body: {
            business_id: 'business-1',
            provider: 'square',
            access_token: 'token-1',
            location_id: 'location-\u20601',
          },
          message: 'POS location ID must not include unsafe control characters',
        },
        {
          route: disconnectRoute!,
          body: { business_id: 'business-\u200B1' },
          message: 'POS business ID must not include unsafe control characters',
        },
      ]) {
        const unsafeTextSend = jest.fn();
        const unsafeTextStatus = jest.fn(() => ({ send: unsafeTextSend }));
        await route.handler(
          {
            body,
            user: { userId: 'user-1' },
          },
          { status: unsafeTextStatus }
        );

        expect(unsafeTextStatus).toHaveBeenCalledWith(400);
        expect(unsafeTextSend).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'INVALID_POS_TEXT_FIELD',
            message,
          },
        });
      }

      for (const { body, message } of [
        {
          body: {
            business_id: 'b'.repeat(256),
            provider: 'square',
            access_token: 'access-token',
          },
          message: 'POS business ID must be at most 255 characters',
        },
        {
          body: {
            business_id: 'business-1',
            provider: 'square',
            access_token: 'a'.repeat(2049),
          },
          message: 'POS access token must be at most 2048 characters',
        },
        {
          body: {
            business_id: 'business-1',
            provider: 'square',
            access_token: 'access-token',
            refresh_token: 'r'.repeat(2049),
          },
          message: 'POS refresh token must be at most 2048 characters',
        },
        {
          body: {
            business_id: 'business-1',
            provider: 'square',
            access_token: 'access-token',
            location_id: 'l'.repeat(256),
          },
          message: 'POS location ID must be at most 255 characters',
        },
        {
          body: {
            business_id: 'business-1',
            provider: 'square',
            access_token: 'access-token',
            merchant_id: 'm'.repeat(256),
          },
          message: 'POS merchant ID must be at most 255 characters',
        },
      ]) {
        const oversizedTextSend = jest.fn();
        const oversizedTextStatus = jest.fn(() => ({ send: oversizedTextSend }));
        await connectRoute!.handler(
          {
            body,
            user: { userId: 'user-1' },
          },
          { status: oversizedTextStatus }
        );

        expect(oversizedTextStatus).toHaveBeenCalledWith(400);
        expect(oversizedTextSend).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'INVALID_POS_TEXT_FIELD',
            message,
          },
        });
      }

      const oversizedDisconnectSend = jest.fn();
      const oversizedDisconnectStatus = jest.fn(() => ({ send: oversizedDisconnectSend }));
      await disconnectRoute!.handler(
        {
          body: {
            business_id: 'b'.repeat(256),
          },
          user: { userId: 'user-1' },
        },
        { status: oversizedDisconnectStatus }
      );
      expect(oversizedDisconnectStatus).toHaveBeenCalledWith(400);
      expect(oversizedDisconnectSend).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_POS_TEXT_FIELD',
          message: 'POS business ID must be at most 255 characters',
        },
      });

      expect(findOne).not.toHaveBeenCalled();
      expect(createIntegration).not.toHaveBeenCalled();
      expect(disconnectIntegration).not.toHaveBeenCalled();
    } finally {
      createIntegration.mockRestore();
      disconnectIntegration.mockRestore();
    }
  });

  it('rejects blank POS route path IDs before ORM or service calls and normalizes valid IDs', async () => {
    const registeredGetRoutes: Array<{ path: string; handler: Function }> = [];
    const registeredPostRoutes: Array<{ path: string; handler: Function }> = [];
    const findOne = jest.fn(async (_entity: unknown, options: { where: { id: string } }) => {
      if (options.where.id === 'order-1') {
        return { id: 'order-1', business_id: 'business-1' };
      }

      return { id: 'business-1', owner_id: 'user-1' };
    });
    const getIntegration = jest
      .spyOn(POSSyncService.prototype, 'getIntegration')
      .mockResolvedValue({
        id: 'integration-1',
        provider: 'square',
        is_active: true,
      } as any);
    const syncOrder = jest
      .spyOn(POSSyncService.prototype, 'syncOrder')
      .mockResolvedValue({ id: 'sync-log-1' } as any);
    const getSyncHistory = jest
      .spyOn(POSSyncService.prototype, 'getSyncHistory')
      .mockResolvedValue({ logs: [], total: 0 });
    const getSyncStats = jest
      .spyOn(POSSyncService.prototype, 'getSyncStats')
      .mockResolvedValue({ total_syncs: 0 } as any);
    const fakeFastify = {
      addHook: jest.fn(),
      get: jest.fn((path: string, _options: unknown, handler: Function) => {
        registeredGetRoutes.push({ path, handler });
      }),
      post: jest.fn((path: string, _options: unknown, handler: Function) => {
        registeredPostRoutes.push({ path, handler });
      }),
      orm: {
        manager: {
          findOne,
        },
      },
    };
    const makeReply = () => {
      const send = jest.fn();
      return {
        send,
        status: jest.fn(() => ({ send })),
      };
    };

    try {
      await posRoutes(fakeFastify as any);
      const integrationRoute = registeredGetRoutes.find((item) => item.path === '/integration/:businessId');
      const syncRoute = registeredPostRoutes.find((item) => item.path === '/sync/:orderId');
      const historyRoute = registeredGetRoutes.find((item) => item.path === '/history/:businessId');
      const statsRoute = registeredGetRoutes.find((item) => item.path === '/stats/:businessId');
      expect(integrationRoute).toBeDefined();
      expect(syncRoute).toBeDefined();
      expect(historyRoute).toBeDefined();
      expect(statsRoute).toBeDefined();

      for (const malformedQuery of ['includeTokens=true', ['includeTokens']]) {
        const reply = makeReply();
        await integrationRoute!.handler(
          {
            params: { businessId: 'business-1' },
            query: malformedQuery,
            user: { userId: 'user-1' },
          },
          reply
        );
        expect(reply.status).toHaveBeenCalledWith(400);
        expect(reply.send).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'INVALID_POS_INTEGRATION_QUERY',
            message: 'POS integration query must be an object',
          },
        });
      }

      const unsupportedIntegrationQueryReply = makeReply();
      await integrationRoute!.handler(
        {
          params: { businessId: 'business-1' },
          query: { include_tokens: 'true' },
          user: { userId: 'user-1' },
        },
        unsupportedIntegrationQueryReply
      );
      expect(unsupportedIntegrationQueryReply.status).toHaveBeenCalledWith(400);
      expect(unsupportedIntegrationQueryReply.send).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'UNSUPPORTED_POS_QUERY_FIELD',
          message: 'Unsupported POS query field(s): include_tokens',
        },
      });

      const unsafeIntegrationQueryReply = makeReply();
      await integrationRoute!.handler(
        {
          params: { businessId: 'business-1' },
          query: { ['include_tokens\uFEFF']: 'true' },
          user: { userId: 'user-1' },
        },
        unsafeIntegrationQueryReply
      );
      expect(unsafeIntegrationQueryReply.status).toHaveBeenCalledWith(400);
      expect(unsafeIntegrationQueryReply.send).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_POS_FIELD_NAME',
          message: 'POS integration query field names must not include unsafe control characters',
        },
      });

      for (const malformedBody of ['force=true', ['force']]) {
        const reply = makeReply();
        await syncRoute!.handler(
          {
            params: { orderId: 'order-1' },
            body: malformedBody,
            user: { userId: 'user-1' },
          },
          reply
        );
        expect(reply.status).toHaveBeenCalledWith(400);
        expect(reply.send).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'INVALID_POS_SYNC_BODY',
            message: 'POS sync body must be an object',
          },
        });
      }

      const unsupportedSyncBodyReply = makeReply();
      await syncRoute!.handler(
        {
          params: { orderId: 'order-1' },
          body: { force: true },
          user: { userId: 'user-1' },
        },
        unsupportedSyncBodyReply
      );
      expect(unsupportedSyncBodyReply.status).toHaveBeenCalledWith(400);
      expect(unsupportedSyncBodyReply.send).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'UNSUPPORTED_POS_FIELD',
          message: 'Unsupported POS request field(s): force',
        },
      });

      const unsafeSyncBodyReply = makeReply();
      await syncRoute!.handler(
        {
          params: { orderId: 'order-1' },
          body: { ['force\uFEFF']: true },
          user: { userId: 'user-1' },
        },
        unsafeSyncBodyReply
      );
      expect(unsafeSyncBodyReply.status).toHaveBeenCalledWith(400);
      expect(unsafeSyncBodyReply.send).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_POS_FIELD_NAME',
          message: 'POS sync request field names must not include unsafe control characters',
        },
      });

      for (const malformedQuery of ['includeProviderResponse=true', ['includeProviderResponse']]) {
        const reply = makeReply();
        await syncRoute!.handler(
          {
            params: { orderId: 'order-1' },
            query: malformedQuery,
            user: { userId: 'user-1' },
          },
          reply
        );
        expect(reply.status).toHaveBeenCalledWith(400);
        expect(reply.send).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'INVALID_POS_SYNC_QUERY',
            message: 'POS sync query must be an object',
          },
        });
      }

      const unsupportedSyncQueryReply = makeReply();
      await syncRoute!.handler(
        {
          params: { orderId: 'order-1' },
          query: { include_provider_response: 'true' },
          user: { userId: 'user-1' },
        },
        unsupportedSyncQueryReply
      );
      expect(unsupportedSyncQueryReply.status).toHaveBeenCalledWith(400);
      expect(unsupportedSyncQueryReply.send).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'UNSUPPORTED_POS_QUERY_FIELD',
          message: 'Unsupported POS query field(s): include_provider_response',
        },
      });

      const unsafeSyncQueryReply = makeReply();
      await syncRoute!.handler(
        {
          params: { orderId: 'order-1' },
          query: { ['include_provider_response\uFEFF']: 'true' },
          user: { userId: 'user-1' },
        },
        unsafeSyncQueryReply
      );
      expect(unsafeSyncQueryReply.status).toHaveBeenCalledWith(400);
      expect(unsafeSyncQueryReply.send).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_POS_FIELD_NAME',
          message: 'POS sync query field names must not include unsafe control characters',
        },
      });

      for (const malformedQuery of ['includeTokens=true', ['includeTokens']]) {
        const reply = makeReply();
        await statsRoute!.handler(
          {
            params: { businessId: 'business-1' },
            query: malformedQuery,
            user: { userId: 'user-1' },
          },
          reply
        );
        expect(reply.status).toHaveBeenCalledWith(400);
        expect(reply.send).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'INVALID_POS_STATS_QUERY',
            message: 'POS sync stats query must be an object',
          },
        });
      }

      const unsupportedStatsQueryReply = makeReply();
      await statsRoute!.handler(
        {
          params: { businessId: 'business-1' },
          query: { include_tokens: 'true' },
          user: { userId: 'user-1' },
        },
        unsupportedStatsQueryReply
      );
      expect(unsupportedStatsQueryReply.status).toHaveBeenCalledWith(400);
      expect(unsupportedStatsQueryReply.send).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'UNSUPPORTED_POS_QUERY_FIELD',
          message: 'Unsupported POS query field(s): include_tokens',
        },
      });

      const unsafeStatsQueryReply = makeReply();
      await statsRoute!.handler(
        {
          params: { businessId: 'business-1' },
          query: { ['include_tokens\uFEFF']: 'true' },
          user: { userId: 'user-1' },
        },
        unsafeStatsQueryReply
      );
      expect(unsafeStatsQueryReply.status).toHaveBeenCalledWith(400);
      expect(unsafeStatsQueryReply.send).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_POS_FIELD_NAME',
          message: 'POS sync stats query field names must not include unsafe control characters',
        },
      });

      const blankParamRequests = [
        {
          handler: integrationRoute!.handler,
          request: { params: { businessId: '   ' }, user: { userId: 'user-1' } },
          message: 'Business ID is required',
        },
        {
          handler: syncRoute!.handler,
          request: { params: { orderId: '   ' }, user: { userId: 'user-1' } },
          message: 'Order ID is required',
        },
        {
          handler: historyRoute!.handler,
          request: { params: { businessId: '   ' }, query: {}, user: { userId: 'user-1' } },
          message: 'Business ID is required',
        },
        {
          handler: statsRoute!.handler,
          request: { params: { businessId: '   ' }, user: { userId: 'user-1' } },
          message: 'Business ID is required',
        },
      ];

      const malformedParamRequests = [undefined, ['business-1']].flatMap((malformedParams) => [
        {
          handler: integrationRoute!.handler,
          request: { params: malformedParams, user: { userId: 'user-1' } },
          message: 'Business ID is required',
        },
        {
          handler: syncRoute!.handler,
          request: { params: malformedParams, user: { userId: 'user-1' } },
          message: 'Order ID is required',
        },
        {
          handler: historyRoute!.handler,
          request: { params: malformedParams, query: {}, user: { userId: 'user-1' } },
          message: 'Business ID is required',
        },
        {
          handler: statsRoute!.handler,
          request: { params: malformedParams, user: { userId: 'user-1' } },
          message: 'Business ID is required',
        },
      ]);

      for (const { handler, request, message } of [
        ...blankParamRequests,
        ...malformedParamRequests,
      ]) {
        const reply = makeReply();
        await handler(request, reply);
        expect(reply.status).toHaveBeenCalledWith(400);
        expect(reply.send).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'MISSING_PARAMETERS',
            message,
          },
        });
      }

      for (const { handler, request, message } of [
        {
          handler: integrationRoute!.handler,
          request: { params: { businessId: 'business-\u202E1' }, user: { userId: 'user-1' } },
          message: 'POS business ID must not include unsafe control characters',
        },
        {
          handler: syncRoute!.handler,
          request: { params: { orderId: 'order-\u200B1' }, user: { userId: 'user-1' } },
          message: 'POS order ID must not include unsafe control characters',
        },
        {
          handler: historyRoute!.handler,
          request: {
            params: { businessId: 'business-\u20601' },
            query: {},
            user: { userId: 'user-1' },
          },
          message: 'POS business ID must not include unsafe control characters',
        },
        {
          handler: historyRoute!.handler,
          request: {
            params: { businessId: 'business-1' },
            query: { status: 'success\u202E' },
            user: { userId: 'user-1' },
          },
          message: 'POS sync history status must not include unsafe control characters',
        },
        {
          handler: statsRoute!.handler,
          request: { params: { businessId: 'business-\u200B1' }, user: { userId: 'user-1' } },
          message: 'POS business ID must not include unsafe control characters',
        },
      ]) {
        const reply = makeReply();
        await handler(request, reply);
        expect(reply.status).toHaveBeenCalledWith(400);
        expect(reply.send).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'INVALID_POS_TEXT_FIELD',
            message,
          },
        });
      }

      for (const { handler, request, message } of [
        {
          handler: integrationRoute!.handler,
          request: { params: { businessId: 'b'.repeat(256) }, user: { userId: 'user-1' } },
          message: 'POS business ID must be at most 255 characters',
        },
        {
          handler: syncRoute!.handler,
          request: { params: { orderId: 'o'.repeat(256) }, user: { userId: 'user-1' } },
          message: 'POS order ID must be at most 255 characters',
        },
        {
          handler: historyRoute!.handler,
          request: {
            params: { businessId: 'b'.repeat(256) },
            query: {},
            user: { userId: 'user-1' },
          },
          message: 'POS business ID must be at most 255 characters',
        },
        {
          handler: statsRoute!.handler,
          request: { params: { businessId: 'b'.repeat(256) }, user: { userId: 'user-1' } },
          message: 'POS business ID must be at most 255 characters',
        },
      ]) {
        const reply = makeReply();
        await handler(request, reply);
        expect(reply.status).toHaveBeenCalledWith(400);
        expect(reply.send).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'INVALID_POS_TEXT_FIELD',
            message,
          },
        });
      }

      expect(findOne).not.toHaveBeenCalled();
      expect(getIntegration).not.toHaveBeenCalled();
      expect(syncOrder).not.toHaveBeenCalled();
      expect(getSyncHistory).not.toHaveBeenCalled();
      expect(getSyncStats).not.toHaveBeenCalled();

      await integrationRoute!.handler(
        { params: { businessId: ' business-1 ' }, user: { userId: 'user-1' } },
        makeReply()
      );
      await syncRoute!.handler(
        { params: { orderId: ' order-1 ' }, user: { userId: 'user-1' } },
        makeReply()
      );
      await historyRoute!.handler(
        {
          params: { businessId: ' business-1 ' },
          query: { limit: '25' },
          user: { userId: 'user-1' },
        },
        makeReply()
      );
      await statsRoute!.handler(
        { params: { businessId: ' business-1 ' }, user: { userId: 'user-1' } },
        makeReply()
      );

      expect(findOne).toHaveBeenCalledWith(Business, {
        where: { id: 'business-1' },
        select: ['id', 'owner_id'],
      });
      expect(findOne).toHaveBeenCalledWith(Order, {
        where: { id: 'order-1' },
        select: ['id', 'business_id'],
      });
      expect(getIntegration).toHaveBeenCalledWith('business-1');
      expect(syncOrder).toHaveBeenCalledWith('order-1');
      expect(getSyncHistory).toHaveBeenCalledWith('business-1', {
        limit: 25,
        offset: undefined,
        status: undefined,
      });
      expect(getSyncStats).toHaveBeenCalledWith('business-1');
    } finally {
      getIntegration.mockRestore();
      syncOrder.mockRestore();
      getSyncHistory.mockRestore();
      getSyncStats.mockRestore();
    }
  });

  it('rejects oversized POS authenticated user IDs before ORM or service calls', async () => {
    const registeredGetRoutes: Array<{ path: string; handler: Function }> = [];
    const registeredPostRoutes: Array<{ path: string; handler: Function }> = [];
    const findOne = jest.fn(async () => {
      throw new Error('POS ownership should not be checked for oversized authenticated user IDs');
    });
    const createIntegration = jest
      .spyOn(POSSyncService.prototype, 'createIntegration')
      .mockRejectedValue(new Error('createIntegration should not be called for oversized POS user IDs'));
    const disconnectIntegration = jest
      .spyOn(POSSyncService.prototype, 'disconnectIntegration')
      .mockRejectedValue(new Error('disconnectIntegration should not be called for oversized POS user IDs'));
    const getIntegration = jest
      .spyOn(POSSyncService.prototype, 'getIntegration')
      .mockRejectedValue(new Error('getIntegration should not be called for oversized POS user IDs'));
    const syncOrder = jest
      .spyOn(POSSyncService.prototype, 'syncOrder')
      .mockRejectedValue(new Error('syncOrder should not be called for oversized POS user IDs'));
    const getSyncHistory = jest
      .spyOn(POSSyncService.prototype, 'getSyncHistory')
      .mockRejectedValue(new Error('getSyncHistory should not be called for oversized POS user IDs'));
    const getSyncStats = jest
      .spyOn(POSSyncService.prototype, 'getSyncStats')
      .mockRejectedValue(new Error('getSyncStats should not be called for oversized POS user IDs'));
    const fakeFastify = {
      addHook: jest.fn(),
      get: jest.fn((path: string, _options: unknown, handler: Function) => {
        registeredGetRoutes.push({ path, handler });
      }),
      post: jest.fn((path: string, _options: unknown, handler: Function) => {
        registeredPostRoutes.push({ path, handler });
      }),
      orm: {
        manager: {
          findOne,
        },
      },
    };
    const makeReply = () => {
      const send = jest.fn();
      return {
        send,
        status: jest.fn(() => ({ send })),
      };
    };

    try {
      await posRoutes(fakeFastify as any);
      const connectRoute = registeredPostRoutes.find((item) => item.path === '/connect');
      const disconnectRoute = registeredPostRoutes.find((item) => item.path === '/disconnect');
      const integrationRoute = registeredGetRoutes.find((item) => item.path === '/integration/:businessId');
      const syncRoute = registeredPostRoutes.find((item) => item.path === '/sync/:orderId');
      const historyRoute = registeredGetRoutes.find((item) => item.path === '/history/:businessId');
      const statsRoute = registeredGetRoutes.find((item) => item.path === '/stats/:businessId');
      expect(connectRoute).toBeDefined();
      expect(disconnectRoute).toBeDefined();
      expect(integrationRoute).toBeDefined();
      expect(syncRoute).toBeDefined();
      expect(historyRoute).toBeDefined();
      expect(statsRoute).toBeDefined();

      const oversizedUser = { userId: 'u'.repeat(256) };
      for (const { handler, request } of [
        {
          handler: connectRoute!.handler,
          request: {
            body: {
              business_id: 'business-1',
              provider: 'square',
              access_token: 'access-token',
            },
            user: oversizedUser,
          },
        },
        {
          handler: connectRoute!.handler,
          request: {
            body: {
              business_id: 'business-1',
              provider: 'square',
              access_token: 'access-token\u202E',
              token_expires_at: 'not-a-date',
            },
            user: oversizedUser,
          },
        },
        {
          handler: connectRoute!.handler,
          request: {
            body: {
              business_id: 'business-1',
              provider: 'swiggy',
              api_key: 'api-key\u202E',
              partner_account_id: 'partner-account-1',
              cost_handling: 'customer',
              fixed_delivery_fee_cents: '1500\uFEFF',
            },
            user: oversizedUser,
          },
        },
        {
          handler: disconnectRoute!.handler,
          request: { body: { business_id: 'business-1' }, user: oversizedUser },
        },
        {
          handler: integrationRoute!.handler,
          request: { params: { businessId: 'business-1' }, user: oversizedUser },
        },
        {
          handler: syncRoute!.handler,
          request: { params: { orderId: 'order-1' }, user: oversizedUser },
        },
        {
          handler: historyRoute!.handler,
          request: { params: { businessId: 'business-1' }, query: {}, user: oversizedUser },
        },
        {
          handler: statsRoute!.handler,
          request: { params: { businessId: 'business-1' }, user: oversizedUser },
        },
      ]) {
        const reply = makeReply();
        await handler(request, reply);
        expect(reply.status).toHaveBeenCalledWith(400);
        expect(reply.send).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'INVALID_POS_TEXT_FIELD',
            message: 'POS user ID must be at most 255 characters',
          },
        });
      }

      expect(findOne).not.toHaveBeenCalled();
      expect(createIntegration).not.toHaveBeenCalled();
      expect(disconnectIntegration).not.toHaveBeenCalled();
      expect(getIntegration).not.toHaveBeenCalled();
      expect(syncOrder).not.toHaveBeenCalled();
      expect(getSyncHistory).not.toHaveBeenCalled();
      expect(getSyncStats).not.toHaveBeenCalled();
    } finally {
      createIntegration.mockRestore();
      disconnectIntegration.mockRestore();
      getIntegration.mockRestore();
      syncOrder.mockRestore();
      getSyncHistory.mockRestore();
      getSyncStats.mockRestore();
    }
  });

  it('rejects unsupported delivery connect body fields before service calls', async () => {
    const registeredPostRoutes: Array<{ path: string; handler: Function }> = [];
    const createIntegration = jest
      .spyOn(DeliveryService.prototype, 'createIntegration')
      .mockRejectedValue(new Error('createIntegration should not be called'));
    const fakeFastify = {
      addHook: jest.fn(),
      get: jest.fn(),
      post: jest.fn((path: string, _options: unknown, handler: Function) => {
        registeredPostRoutes.push({ path, handler });
      }),
    };

    try {
      await deliveryRoutes(fakeFastify as any);
      const route = registeredPostRoutes.find((item) => item.path === '/connect');
      expect(route).toBeDefined();

      const send = jest.fn();
      const status = jest.fn(() => ({ send }));
      await route!.handler(
        {
          body: {
            business_id: 'business-1',
            provider: 'swiggy',
            api_key: 'api-key',
            api_secret: 'api-secret',
            partner_account_id: 'partner-account-1',
            launch_mode: 'live',
          },
          user: { userId: 'user-1' },
          log: { error: jest.fn() },
        },
        { status }
      );

      expect(status).toHaveBeenCalledWith(400);
      expect(send).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'UNSUPPORTED_DELIVERY_FIELD',
          message: 'Unsupported delivery request field(s): launch_mode',
        },
      });

      const unsafeFieldNameSend = jest.fn();
      const unsafeFieldNameStatus = jest.fn(() => ({ send: unsafeFieldNameSend }));
      await route!.handler(
        {
          body: {
            business_id: 'business-1',
            provider: 'swiggy',
            api_key: 'api-key',
            api_secret: 'api-secret',
            partner_account_id: 'partner-account-1',
            ['launch_mode\uFEFF']: 'live',
          },
          user: { userId: 'user-1' },
          log: { error: jest.fn() },
        },
        { status: unsafeFieldNameStatus }
      );

      expect(unsafeFieldNameStatus).toHaveBeenCalledWith(400);
      expect(unsafeFieldNameSend).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_DELIVERY_FIELD_NAME',
          message: 'Delivery connect request field names must not include unsafe control characters',
        },
      });
      expect(createIntegration).not.toHaveBeenCalled();
    } finally {
      createIntegration.mockRestore();
    }
  });

  it('rejects blank delivery connect required fields before service calls and normalizes valid strings', async () => {
    const registeredPostRoutes: Array<{ path: string; handler: Function }> = [];
    const findOne = jest.fn(async () => ({ id: 'business-1', owner_id: 'user-1' }));
    const createIntegration = jest
      .spyOn(DeliveryService.prototype, 'createIntegration')
      .mockRejectedValue(new Error('createIntegration should not be called for invalid delivery connect input'));
    const fakeFastify = {
      addHook: jest.fn(),
      get: jest.fn(),
      post: jest.fn((path: string, _options: unknown, handler: Function) => {
        registeredPostRoutes.push({ path, handler });
      }),
      orm: {
        manager: {
          findOne,
        },
      },
    };

    try {
      await deliveryRoutes(fakeFastify as any);
      const route = registeredPostRoutes.find((item) => item.path === '/connect');
      expect(route).toBeDefined();

      for (const malformedQuery of ['includeProviderResponse=true', ['includeProviderResponse']]) {
        const send = jest.fn();
        const status = jest.fn(() => ({ send }));
        await route!.handler(
          {
            query: malformedQuery,
            user: { userId: 'user-1' },
            body: {
              business_id: 'business-1',
              provider: 'swiggy',
              api_key: 'api-key',
              partner_account_id: 'partner-account-1',
              cost_handling: 'customer',
            },
            log: { error: jest.fn() },
          },
          { status }
        );

        expect(status).toHaveBeenCalledWith(400);
        expect(send).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'INVALID_DELIVERY_QUERY',
            message: 'Delivery query must be an object',
          },
        });
      }

      const unsupportedQuerySend = jest.fn();
      const unsupportedQueryStatus = jest.fn(() => ({ send: unsupportedQuerySend }));
      await route!.handler(
        {
          query: { provider_health_check: 'true' },
          body: {
            business_id: 'business-1',
            provider: 'swiggy',
            api_key: 'api-key',
            partner_account_id: 'partner-account-1',
            cost_handling: 'customer',
          },
          user: { userId: 'user-1' },
          log: { error: jest.fn() },
        },
        { status: unsupportedQueryStatus }
      );

      expect(unsupportedQueryStatus).toHaveBeenCalledWith(400);
      expect(unsupportedQuerySend).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'UNSUPPORTED_DELIVERY_QUERY_FIELD',
          message: 'Unsupported delivery query field(s): provider_health_check',
        },
      });

      const unsafeQueryFieldNameSend = jest.fn();
      const unsafeQueryFieldNameStatus = jest.fn(() => ({ send: unsafeQueryFieldNameSend }));
      await route!.handler(
        {
          query: { ['provider_health_check\uFEFF']: 'true' },
          body: {
            business_id: 'business-1',
            provider: 'swiggy',
            api_key: 'api-key',
            partner_account_id: 'partner-account-1',
            cost_handling: 'customer',
          },
          user: { userId: 'user-1' },
          log: { error: jest.fn() },
        },
        { status: unsafeQueryFieldNameStatus }
      );

      expect(unsafeQueryFieldNameStatus).toHaveBeenCalledWith(400);
      expect(unsafeQueryFieldNameSend).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_DELIVERY_FIELD_NAME',
          message: 'Delivery query field names must not include unsafe control characters',
        },
      });
      expect(createIntegration).not.toHaveBeenCalled();

      const invalidSend = jest.fn();
      const invalidStatus = jest.fn(() => ({ send: invalidSend }));
      await route!.handler(
        {
          body: {
            business_id: 'business-1',
            provider: 'swiggy',
            api_key: '   ',
            partner_account_id: 'partner-account-1',
            cost_handling: 'customer',
          },
          user: { userId: 'user-1' },
          log: { error: jest.fn() },
        },
        { status: invalidStatus }
      );

      expect(invalidStatus).toHaveBeenCalledWith(400);
      expect(invalidSend).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'MISSING_PARAMETERS',
          message: 'Business ID, provider, API key, partner account ID, and cost handling are required',
        },
      });
      expect(createIntegration).not.toHaveBeenCalled();

      const missingBodySend = jest.fn();
      const missingBodyStatus = jest.fn(() => ({ send: missingBodySend }));
      await route!.handler(
        {
          user: { userId: 'user-1' },
          log: { error: jest.fn() },
        },
        { status: missingBodyStatus }
      );

      expect(missingBodyStatus).toHaveBeenCalledWith(400);
      expect(missingBodySend).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'MISSING_PARAMETERS',
          message: 'Business ID, provider, API key, partner account ID, and cost handling are required',
        },
      });
      expect(createIntegration).not.toHaveBeenCalled();

      for (const malformedBody of ['business_id=business-1', ['business-1']]) {
        const malformedBodySend = jest.fn();
        const malformedBodyStatus = jest.fn(() => ({ send: malformedBodySend }));
        await route!.handler(
          {
            body: malformedBody,
            user: { userId: 'user-1' },
            log: { error: jest.fn() },
          },
          { status: malformedBodyStatus }
        );

        expect(malformedBodyStatus).toHaveBeenCalledWith(400);
        expect(malformedBodySend).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'INVALID_DELIVERY_REQUEST_BODY',
            message: 'Delivery request body must be an object',
          },
        });
      }
      expect(createIntegration).not.toHaveBeenCalled();

      for (const invalidConnectOption of [
        { provider: 'ubereats', cost_handling: 'customer' },
        { provider: 'swiggy', cost_handling: 'platform' },
      ]) {
        const optionSend = jest.fn();
        const optionStatus = jest.fn(() => ({ send: optionSend }));
        await route!.handler(
          {
            body: {
              business_id: 'business-1',
              provider: invalidConnectOption.provider,
              api_key: 'api-key',
              partner_account_id: 'partner-account-1',
              cost_handling: invalidConnectOption.cost_handling,
            },
            user: { userId: 'user-1' },
            log: { error: jest.fn() },
          },
          { status: optionStatus }
        );

        expect(optionStatus).toHaveBeenCalledWith(400);
        expect(optionSend).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'INVALID_DELIVERY_CONNECT_OPTION',
            message: 'Delivery provider and cost handling must be supported launch values',
          },
        });
      }

      for (const invalidOptionalMetadata of [
        { api_secret: { secret: 'api-secret' } },
        { fixed_delivery_fee_cents: '1500' },
        { auto_assign_delivery: 'false' },
        { pickup_instructions: ['Use the back door'] },
      ]) {
        const metadataSend = jest.fn();
        const metadataStatus = jest.fn(() => ({ send: metadataSend }));
        await route!.handler(
          {
            body: {
              business_id: 'business-1',
              provider: 'swiggy',
              api_key: 'api-key',
              partner_account_id: 'partner-account-1',
              cost_handling: 'customer',
              ...invalidOptionalMetadata,
            },
            user: { userId: 'user-1' },
            log: { error: jest.fn() },
          },
          { status: metadataStatus }
        );

        expect(metadataStatus).toHaveBeenCalledWith(400);
        expect(metadataSend).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'INVALID_DELIVERY_CONNECT_METADATA',
            message: 'Delivery connect optional fields must use the documented string, integer, and boolean types',
          },
        });
      }

      const unsafeFeeSend = jest.fn();
      const unsafeFeeStatus = jest.fn(() => ({ send: unsafeFeeSend }));
      await route!.handler(
        {
          body: {
            business_id: 'business-1',
            provider: 'swiggy',
            api_key: 'api-key',
            partner_account_id: 'partner-account-1',
            cost_handling: 'customer',
            fixed_delivery_fee_cents: '1500\uFEFF',
          },
          user: { userId: 'user-1' },
          log: { error: jest.fn() },
        },
        { status: unsafeFeeStatus }
      );

      expect(unsafeFeeStatus).toHaveBeenCalledWith(400);
      expect(unsafeFeeSend).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_DELIVERY_TEXT_FIELD',
          message: 'Delivery fixed delivery fee cents must not include unsafe control characters',
        },
      });

      for (const { body, message } of [
        {
          body: {
            business_id: 'business-\u202E1',
            provider: 'swiggy',
            api_key: 'api-key',
            partner_account_id: 'partner-account-1',
            cost_handling: 'customer',
          },
          message: 'Delivery business ID must not include unsafe control characters',
        },
        {
          body: {
            business_id: 'business-1',
            provider: 'swiggy\u202E',
            api_key: 'api-key',
            partner_account_id: 'partner-account-1',
            cost_handling: 'customer',
          },
          message: 'Delivery provider must not include unsafe control characters',
        },
        {
          body: {
            business_id: 'business-1',
            provider: 'swiggy',
            api_key: 'api-key\u200B',
            partner_account_id: 'partner-account-1',
            cost_handling: 'customer',
          },
          message: 'Delivery API key must not include unsafe control characters',
        },
        {
          body: {
            business_id: 'business-1',
            provider: 'swiggy',
            api_key: 'api-key',
            api_secret: 'api-secret\u2060',
            partner_account_id: 'partner-account-1',
            cost_handling: 'customer',
          },
          message: 'Delivery API secret must not include unsafe control characters',
        },
        {
          body: {
            business_id: 'business-1',
            provider: 'swiggy',
            api_key: 'api-key',
            partner_account_id: 'partner-account-\u20601',
            cost_handling: 'customer',
          },
          message: 'Delivery partner account ID must not include unsafe control characters',
        },
        {
          body: {
            business_id: 'business-1',
            provider: 'swiggy',
            api_key: 'api-key',
            partner_account_id: 'partner-account-1',
            cost_handling: 'customer\u202E',
          },
          message: 'Delivery cost handling must not include unsafe control characters',
        },
        {
          body: {
            business_id: 'business-1',
            provider: 'swiggy',
            api_key: 'api-key',
            partner_account_id: 'partner-account-1',
            cost_handling: 'customer',
            pickup_instructions: 'back door\u202E',
          },
          message: 'Delivery pickup instructions must not include unsafe control characters',
        },
      ]) {
        const unsafeTextSend = jest.fn();
        const unsafeTextStatus = jest.fn(() => ({ send: unsafeTextSend }));
        await route!.handler(
          {
            body,
            user: { userId: 'user-1' },
            log: { error: jest.fn() },
          },
          { status: unsafeTextStatus }
        );

        expect(unsafeTextStatus).toHaveBeenCalledWith(400);
        expect(unsafeTextSend).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'INVALID_DELIVERY_TEXT_FIELD',
            message,
          },
        });
      }

      const oversizedPickupSend = jest.fn();
      const oversizedPickupStatus = jest.fn(() => ({ send: oversizedPickupSend }));
      await route!.handler(
        {
          body: {
            business_id: 'business-1',
            provider: 'swiggy',
            api_key: 'api-key',
            partner_account_id: 'partner-account-1',
            cost_handling: 'customer',
            pickup_instructions: 'P'.repeat(501),
          },
          user: { userId: 'user-1' },
          log: { error: jest.fn() },
        },
        { status: oversizedPickupStatus }
      );

      expect(oversizedPickupStatus).toHaveBeenCalledWith(400);
      expect(oversizedPickupSend).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_DELIVERY_TEXT_FIELD',
          message: 'Delivery pickup instructions must be at most 500 characters',
        },
      });

      for (const { body, message } of [
        {
          body: {
            business_id: 'b'.repeat(256),
            provider: 'swiggy',
            api_key: 'api-key',
            partner_account_id: 'partner-account-1',
            cost_handling: 'customer',
          },
          message: 'Delivery business ID must be at most 255 characters',
        },
        {
          body: {
            business_id: 'business-1',
            provider: 'swiggy',
            api_key: 'k'.repeat(2049),
            partner_account_id: 'partner-account-1',
            cost_handling: 'customer',
          },
          message: 'Delivery API key must be at most 2048 characters',
        },
        {
          body: {
            business_id: 'business-1',
            provider: 'swiggy',
            api_key: 'api-key',
            api_secret: 's'.repeat(2049),
            partner_account_id: 'partner-account-1',
            cost_handling: 'customer',
          },
          message: 'Delivery API secret must be at most 2048 characters',
        },
        {
          body: {
            business_id: 'business-1',
            provider: 'swiggy',
            api_key: 'api-key',
            partner_account_id: 'p'.repeat(256),
            cost_handling: 'customer',
          },
          message: 'Delivery partner account ID must be at most 255 characters',
        },
      ]) {
        const oversizedCredentialSend = jest.fn();
        const oversizedCredentialStatus = jest.fn(() => ({ send: oversizedCredentialSend }));
        await route!.handler(
          {
            body,
            user: { userId: 'user-1' },
            log: { error: jest.fn() },
          },
          { status: oversizedCredentialStatus }
        );

        expect(oversizedCredentialStatus).toHaveBeenCalledWith(400);
        expect(oversizedCredentialSend).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'INVALID_DELIVERY_TEXT_FIELD',
            message,
          },
        });
      }

      expect(createIntegration).not.toHaveBeenCalled();

      createIntegration.mockResolvedValueOnce({
        id: 'delivery-integration-1',
        business_id: 'business-1',
        provider: 'swiggy',
        is_active: true,
        cost_handling: 'customer',
        fixed_delivery_fee_cents: 1500,
        auto_assign_delivery: false,
        pickup_instructions: 'Use the back door',
        created_at: new Date('2026-06-27T16:45:00.000Z'),
      } as any);

      const result = await route!.handler(
        {
          body: {
            business_id: ' business-1 ',
            provider: ' swiggy ',
            api_key: ' api-key ',
            api_secret: ' api-secret ',
            partner_account_id: ' partner-account-1 ',
            cost_handling: ' customer ',
            fixed_delivery_fee_cents: 1500,
            auto_assign_delivery: false,
            pickup_instructions: ' Use the back door ',
          },
          user: { userId: 'user-1' },
          log: { error: jest.fn() },
        },
        { status: jest.fn() }
      );

      expect(findOne).toHaveBeenCalledWith(Business, {
        where: { id: 'business-1' },
        select: ['id', 'owner_id'],
      });
      expect(createIntegration).toHaveBeenCalledWith('business-1', 'swiggy', {
        api_key: 'api-key',
        api_secret: 'api-secret',
        partner_account_id: 'partner-account-1',
        cost_handling: 'customer',
        fixed_delivery_fee_cents: 1500,
        auto_assign_delivery: false,
        pickup_instructions: 'Use the back door',
      });
      expect(result.success).toBe(true);
    } finally {
      createIntegration.mockRestore();
    }
  });

  it('rejects cross-tenant delivery business routes before service calls', async () => {
    const registeredGetRoutes: Array<{ path: string; handler: Function }> = [];
    const registeredPostRoutes: Array<{ path: string; handler: Function }> = [];
    const findOne = jest.fn(async () => ({ id: 'business-1', owner_id: 'owner-1' }));
    const createIntegration = jest
      .spyOn(DeliveryService.prototype, 'createIntegration')
      .mockRejectedValue(new Error('createIntegration should not be called for cross-tenant delivery requests'));
    const disconnectIntegration = jest
      .spyOn(DeliveryService.prototype, 'disconnectIntegration')
      .mockRejectedValue(new Error('disconnectIntegration should not be called for cross-tenant delivery requests'));
    const getIntegration = jest
      .spyOn(DeliveryService.prototype, 'getIntegration')
      .mockRejectedValue(new Error('getIntegration should not be called for cross-tenant delivery requests'));
    const getDeliveryStats = jest
      .spyOn(DeliveryService.prototype, 'getDeliveryStats')
      .mockRejectedValue(new Error('getDeliveryStats should not be called for cross-tenant delivery requests'));
    const fakeFastify = {
      addHook: jest.fn(),
      get: jest.fn((path: string, _options: unknown, handler: Function) => {
        registeredGetRoutes.push({ path, handler });
      }),
      post: jest.fn((path: string, _options: unknown, handler: Function) => {
        registeredPostRoutes.push({ path, handler });
      }),
      orm: {
        manager: {
          findOne,
        },
      },
    };

    try {
      await deliveryRoutes(fakeFastify as any);
      const connectRoute = registeredPostRoutes.find((item) => item.path === '/connect');
      const disconnectRoute = registeredPostRoutes.find((item) => item.path === '/disconnect');
      const integrationRoute = registeredGetRoutes.find((item) => item.path === '/integration/:businessId');
      const statsRoute = registeredGetRoutes.find((item) => item.path === '/stats/:businessId');
      expect(connectRoute).toBeDefined();
      expect(disconnectRoute).toBeDefined();
      expect(integrationRoute).toBeDefined();
      expect(statsRoute).toBeDefined();

      for (const { handler, request, message } of [
        {
          handler: connectRoute!.handler,
          request: {
            body: {
              business_id: ' business-1 ',
              provider: 'swiggy',
              api_key: 'api-key',
              partner_account_id: 'partner-account-1',
              cost_handling: 'customer',
            },
            user: { id: 'user-1' },
          },
          message: 'You do not have permission to manage this business',
        },
        {
          handler: disconnectRoute!.handler,
          request: { body: { business_id: ' business-1 ' }, user: { id: 'user-1' } },
          message: 'You do not have permission to manage this business',
        },
        {
          handler: integrationRoute!.handler,
          request: { params: { businessId: ' business-1 ' }, user: { id: 'user-1' } },
          message: 'You do not have permission to view this integration',
        },
        {
          handler: statsRoute!.handler,
          request: { params: { businessId: ' business-1 ' }, user: { id: 'user-1' } },
          message: 'You do not have permission to view delivery statistics',
        },
      ]) {
        const send = jest.fn();
        const status = jest.fn(() => ({ send }));

        await handler({ ...request, log: { error: jest.fn() } }, { status });

        expect(status).toHaveBeenCalledWith(403);
        expect(send).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message,
          },
        });
      }

      expect(findOne).toHaveBeenCalledTimes(4);
      expect(findOne).toHaveBeenCalledWith(Business, {
        where: { id: 'business-1' },
        select: ['id', 'owner_id'],
      });
      expect(createIntegration).not.toHaveBeenCalled();
      expect(disconnectIntegration).not.toHaveBeenCalled();
      expect(getIntegration).not.toHaveBeenCalled();
      expect(getDeliveryStats).not.toHaveBeenCalled();
    } finally {
      createIntegration.mockRestore();
      disconnectIntegration.mockRestore();
      getIntegration.mockRestore();
      getDeliveryStats.mockRestore();
    }
  });

  it('rejects cross-tenant delivery order routes before service calls', async () => {
    const registeredGetRoutes: Array<{ path: string; handler: Function }> = [];
    const registeredPostRoutes: Array<{ path: string; handler: Function }> = [];
    const findOne = jest.fn(async (entity: unknown, options: any) => {
      if (entity === DeliveryTracking) {
        return { id: options.where.id, order_id: 'order-1' };
      }

      if (entity === Order) {
        return { id: options.where.id, business_id: 'business-1', customer_id: 'customer-elsewhere' };
      }

      if (entity === Business) {
        return { id: options.where.id, owner_id: 'owner-1' };
      }

      throw new Error('Unexpected delivery authorization lookup');
    });
    const createDelivery = jest
      .spyOn(DeliveryService.prototype, 'createDelivery')
      .mockRejectedValue(new Error('createDelivery should not be called for cross-tenant delivery requests'));
    const getDeliveryTracking = jest
      .spyOn(DeliveryService.prototype, 'getDeliveryTracking')
      .mockRejectedValue(new Error('getDeliveryTracking should not be called for cross-tenant delivery requests'));
    const cancelDelivery = jest
      .spyOn(DeliveryService.prototype, 'cancelDelivery')
      .mockRejectedValue(new Error('cancelDelivery should not be called for cross-tenant delivery requests'));
    const fakeFastify = {
      addHook: jest.fn(),
      get: jest.fn((path: string, _options: unknown, handler: Function) => {
        registeredGetRoutes.push({ path, handler });
      }),
      post: jest.fn((path: string, _options: unknown, handler: Function) => {
        registeredPostRoutes.push({ path, handler });
      }),
      orm: {
        manager: {
          findOne,
        },
      },
    };

    try {
      await deliveryRoutes(fakeFastify as any);
      const createRoute = registeredPostRoutes.find((item) => item.path === '/create/:orderId');
      const trackRoute = registeredGetRoutes.find((item) => item.path === '/track/:orderId');
      const cancelRoute = registeredPostRoutes.find((item) => item.path === '/cancel/:trackingId');
      expect(createRoute).toBeDefined();
      expect(trackRoute).toBeDefined();
      expect(cancelRoute).toBeDefined();

      for (const { handler, request, message } of [
        {
          handler: createRoute!.handler,
          request: { params: { orderId: ' order-1 ' }, body: {}, user: { id: 'user-1' } },
          message: 'You do not have permission to create delivery for this order',
        },
        {
          handler: trackRoute!.handler,
          request: { params: { orderId: ' order-1 ' }, user: { id: 'user-1' } },
          message: 'You do not have permission to view this delivery',
        },
        {
          handler: cancelRoute!.handler,
          request: {
            params: { trackingId: ' tracking-1 ' },
            body: { reason: ' Customer cancelled ' },
            user: { id: 'user-1' },
          },
          message: 'You do not have permission to cancel this delivery',
        },
      ]) {
        const send = jest.fn();
        const status = jest.fn(() => ({ send }));

        await handler({ ...request, log: { error: jest.fn() } }, { status });

        expect(status).toHaveBeenCalledWith(403);
        expect(send).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message,
          },
        });
      }

      expect(findOne).toHaveBeenCalledWith(Order, {
        where: { id: 'order-1' },
        select: ['id', 'business_id', 'customer_id'],
      });
      expect(findOne).toHaveBeenCalledWith(DeliveryTracking, {
        where: { id: 'tracking-1' },
        select: ['id', 'order_id'],
      });
      expect(findOne).toHaveBeenCalledWith(Business, {
        where: { id: 'business-1' },
        select: ['id', 'owner_id'],
      });
      expect(createDelivery).not.toHaveBeenCalled();
      expect(getDeliveryTracking).not.toHaveBeenCalled();
      expect(cancelDelivery).not.toHaveBeenCalled();
    } finally {
      createDelivery.mockRestore();
      getDeliveryTracking.mockRestore();
      cancelDelivery.mockRestore();
    }
  });

  it('rejects unsupported delivery lifecycle body fields before service calls', async () => {
    const registeredPostRoutes: Array<{ path: string; handler: Function }> = [];
    const disconnectIntegration = jest
      .spyOn(DeliveryService.prototype, 'disconnectIntegration')
      .mockRejectedValue(new Error('disconnectIntegration should not be called'));
    const cancelDelivery = jest
      .spyOn(DeliveryService.prototype, 'cancelDelivery')
      .mockRejectedValue(new Error('cancelDelivery should not be called'));
    const submitDeliveryRating = jest
      .spyOn(DeliveryService.prototype, 'submitDeliveryRating')
      .mockRejectedValue(new Error('submitDeliveryRating should not be called'));
    const fakeFastify = {
      addHook: jest.fn(),
      get: jest.fn(),
      post: jest.fn((path: string, _options: unknown, handler: Function) => {
        registeredPostRoutes.push({ path, handler });
      }),
    };

    try {
      await deliveryRoutes(fakeFastify as any);
      const disconnectRoute = registeredPostRoutes.find((item) => item.path === '/disconnect');
      const cancelRoute = registeredPostRoutes.find((item) => item.path === '/cancel/:trackingId');
      const ratingRoute = registeredPostRoutes.find((item) => item.path === '/rating/:trackingId');
      expect(disconnectRoute).toBeDefined();
      expect(cancelRoute).toBeDefined();
      expect(ratingRoute).toBeDefined();

      for (const { route, request } of [
        {
          route: disconnectRoute!,
          request: {
            query: 'auditMode=true',
            body: { business_id: 'business-1' },
            user: { userId: 'user-1' },
          },
        },
        {
          route: cancelRoute!,
          request: {
            params: { trackingId: 'tracking-1' },
            query: ['providerCancel'],
            body: { reason: 'Customer cancelled' },
            user: { userId: 'user-1' },
          },
        },
        {
          route: ratingRoute!,
          request: {
            params: { trackingId: 'tracking-1' },
            query: 'includeProviderSurvey=true',
            body: { rating: 5 },
            user: { id: 'customer-1' },
          },
        },
      ]) {
        const send = jest.fn();
        const status = jest.fn(() => ({ send }));
        await route.handler({ ...request, log: { error: jest.fn() } }, { status });

        expect(status).toHaveBeenCalledWith(400);
        expect(send).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'INVALID_DELIVERY_QUERY',
            message: 'Delivery query must be an object',
          },
        });
      }

      for (const { route, request, message } of [
        {
          route: disconnectRoute!,
          request: {
            query: { audit_mode: 'true' },
            body: { business_id: 'business-1' },
            user: { userId: 'user-1' },
          },
          message: 'Unsupported delivery query field(s): audit_mode',
        },
        {
          route: cancelRoute!,
          request: {
            params: { trackingId: 'tracking-1' },
            query: { provider_cancel: 'true' },
            body: { reason: 'Customer cancelled' },
            user: { userId: 'user-1' },
          },
          message: 'Unsupported delivery query field(s): provider_cancel',
        },
        {
          route: ratingRoute!,
          request: {
            params: { trackingId: 'tracking-1' },
            query: { include_provider_survey: 'true' },
            body: { rating: 5 },
            user: { id: 'customer-1' },
          },
          message: 'Unsupported delivery query field(s): include_provider_survey',
        },
      ]) {
        const send = jest.fn();
        const status = jest.fn(() => ({ send }));
        await route.handler({ ...request, log: { error: jest.fn() } }, { status });

        expect(status).toHaveBeenCalledWith(400);
        expect(send).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'UNSUPPORTED_DELIVERY_QUERY_FIELD',
            message,
          },
        });
      }

      for (const { route, request } of [
        {
          route: disconnectRoute!,
          request: {
            query: { ['audit_mode\uFEFF']: 'true' },
            body: { business_id: 'business-1' },
            user: { userId: 'user-1' },
          },
        },
        {
          route: cancelRoute!,
          request: {
            params: { trackingId: 'tracking-1' },
            query: { ['provider_cancel\uFEFF']: 'true' },
            body: { reason: 'Customer cancelled' },
            user: { userId: 'user-1' },
          },
        },
        {
          route: ratingRoute!,
          request: {
            params: { trackingId: 'tracking-1' },
            query: { ['include_provider_survey\uFEFF']: 'true' },
            body: { rating: 5 },
            user: { id: 'customer-1' },
          },
        },
      ]) {
        const unsafeQueryFieldNameSend = jest.fn();
        const unsafeQueryFieldNameStatus = jest.fn(() => ({ send: unsafeQueryFieldNameSend }));
        await route.handler({ ...request, log: { error: jest.fn() } }, { status: unsafeQueryFieldNameStatus });

        expect(unsafeQueryFieldNameStatus).toHaveBeenCalledWith(400);
        expect(unsafeQueryFieldNameSend).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'INVALID_DELIVERY_FIELD_NAME',
            message: 'Delivery query field names must not include unsafe control characters',
          },
        });
      }

      const disconnectSend = jest.fn();
      await disconnectRoute!.handler(
        {
          body: {
            business_id: 'business-1',
            force: true,
          },
          user: { userId: 'user-1' },
        },
        { status: jest.fn(() => ({ send: disconnectSend })) }
      );

      expect(disconnectSend).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'UNSUPPORTED_DELIVERY_FIELD',
          message: 'Unsupported delivery request field(s): force',
        },
      });

      const unsafeDisconnectFieldNameSend = jest.fn();
      const unsafeDisconnectFieldNameStatus = jest.fn(() => ({ send: unsafeDisconnectFieldNameSend }));
      await disconnectRoute!.handler(
        {
          body: {
            business_id: 'business-1',
            ['force\uFEFF']: true,
          },
          user: { userId: 'user-1' },
        },
        { status: unsafeDisconnectFieldNameStatus }
      );

      expect(unsafeDisconnectFieldNameStatus).toHaveBeenCalledWith(400);
      expect(unsafeDisconnectFieldNameSend).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_DELIVERY_FIELD_NAME',
          message: 'Delivery disconnect request field names must not include unsafe control characters',
        },
      });

      const blankDisconnectSend = jest.fn();
      const blankDisconnectStatus = jest.fn(() => ({ send: blankDisconnectSend }));
      await disconnectRoute!.handler(
        {
          body: {
            business_id: '   ',
          },
          user: { userId: 'user-1' },
        },
        { status: blankDisconnectStatus }
      );

      expect(blankDisconnectStatus).toHaveBeenCalledWith(400);
      expect(blankDisconnectSend).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'MISSING_PARAMETERS',
          message: 'Business ID is required',
        },
      });

      const malformedDisconnectBodySend = jest.fn();
      const malformedDisconnectBodyStatus = jest.fn(() => ({ send: malformedDisconnectBodySend }));
      await disconnectRoute!.handler(
        {
          body: ['business-1'],
          user: { userId: 'user-1' },
        },
        { status: malformedDisconnectBodyStatus }
      );

      expect(malformedDisconnectBodyStatus).toHaveBeenCalledWith(400);
      expect(malformedDisconnectBodySend).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_DELIVERY_REQUEST_BODY',
          message: 'Delivery request body must be an object',
        },
      });

      const malformedDisconnectStringSend = jest.fn();
      const malformedDisconnectStringStatus = jest.fn(() => ({ send: malformedDisconnectStringSend }));
      await disconnectRoute!.handler(
        {
          body: 'business_id=business-1',
          user: { userId: 'user-1' },
        },
        { status: malformedDisconnectStringStatus }
      );

      expect(malformedDisconnectStringStatus).toHaveBeenCalledWith(400);
      expect(malformedDisconnectStringSend).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_DELIVERY_REQUEST_BODY',
          message: 'Delivery request body must be an object',
        },
      });

      const unsafeDisconnectSend = jest.fn();
      const unsafeDisconnectStatus = jest.fn(() => ({ send: unsafeDisconnectSend }));
      await disconnectRoute!.handler(
        {
          body: {
            business_id: 'business-\u202E1',
          },
          user: { userId: 'user-1' },
        },
        { status: unsafeDisconnectStatus }
      );

      expect(unsafeDisconnectStatus).toHaveBeenCalledWith(400);
      expect(unsafeDisconnectSend).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_DELIVERY_TEXT_FIELD',
          message: 'Delivery business ID must not include unsafe control characters',
        },
      });

      const oversizedDisconnectSend = jest.fn();
      const oversizedDisconnectStatus = jest.fn(() => ({ send: oversizedDisconnectSend }));
      await disconnectRoute!.handler(
        {
          body: {
            business_id: 'b'.repeat(256),
          },
          user: { userId: 'user-1' },
        },
        { status: oversizedDisconnectStatus }
      );

      expect(oversizedDisconnectStatus).toHaveBeenCalledWith(400);
      expect(oversizedDisconnectSend).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_DELIVERY_TEXT_FIELD',
          message: 'Delivery business ID must be at most 255 characters',
        },
      });

      const cancelSend = jest.fn();
      await cancelRoute!.handler(
        {
          params: { trackingId: 'tracking-1' },
          body: {
            reason: 'Customer cancelled',
            refund: true,
          },
          user: { userId: 'user-1' },
        },
        { status: jest.fn(() => ({ send: cancelSend })) }
      );

      expect(cancelSend).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'UNSUPPORTED_DELIVERY_FIELD',
          message: 'Unsupported delivery request field(s): refund',
        },
      });

      const unsafeCancelFieldNameSend = jest.fn();
      const unsafeCancelFieldNameStatus = jest.fn(() => ({ send: unsafeCancelFieldNameSend }));
      await cancelRoute!.handler(
        {
          params: { trackingId: 'tracking-1' },
          body: {
            reason: 'Customer cancelled',
            ['refund\uFEFF']: true,
          },
          user: { userId: 'user-1' },
        },
        { status: unsafeCancelFieldNameStatus }
      );

      expect(unsafeCancelFieldNameStatus).toHaveBeenCalledWith(400);
      expect(unsafeCancelFieldNameSend).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_DELIVERY_FIELD_NAME',
          message: 'Delivery cancellation request field names must not include unsafe control characters',
        },
      });

      const blankReasonSend = jest.fn();
      await cancelRoute!.handler(
        {
          params: { trackingId: 'tracking-1' },
          body: {
            reason: '   ',
          },
          user: { userId: 'user-1' },
        },
        { status: jest.fn(() => ({ send: blankReasonSend })) }
      );

      expect(blankReasonSend).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_DELIVERY_CANCELLATION_REASON',
          message: 'Delivery cancellation reason must be a non-empty string',
        },
      });

      const missingCancelBodySend = jest.fn();
      const missingCancelBodyStatus = jest.fn(() => ({ send: missingCancelBodySend }));
      await cancelRoute!.handler(
        {
          params: { trackingId: 'tracking-1' },
          user: { userId: 'user-1' },
        },
        { status: missingCancelBodyStatus }
      );

      expect(missingCancelBodyStatus).toHaveBeenCalledWith(400);
      expect(missingCancelBodySend).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_DELIVERY_CANCELLATION_REASON',
          message: 'Delivery cancellation reason must be a non-empty string',
        },
      });

      for (const malformedBody of ['reason=Customer%20cancelled', ['Customer cancelled']]) {
        const malformedCancelBodySend = jest.fn();
        const malformedCancelBodyStatus = jest.fn(() => ({ send: malformedCancelBodySend }));
        await cancelRoute!.handler(
          {
            params: { trackingId: 'tracking-1' },
            body: malformedBody,
            user: { userId: 'user-1' },
          },
          { status: malformedCancelBodyStatus }
        );

        expect(malformedCancelBodyStatus).toHaveBeenCalledWith(400);
        expect(malformedCancelBodySend).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'INVALID_DELIVERY_REQUEST_BODY',
            message: 'Delivery request body must be an object',
          },
        });
      }

      const oversizedCancelReasonSend = jest.fn();
      const oversizedCancelReasonStatus = jest.fn(() => ({ send: oversizedCancelReasonSend }));
      await cancelRoute!.handler(
        {
          params: { trackingId: 'tracking-1' },
          body: {
            reason: 'C'.repeat(501),
          },
          user: { userId: 'user-1' },
        },
        { status: oversizedCancelReasonStatus }
      );

      expect(oversizedCancelReasonStatus).toHaveBeenCalledWith(400);
      expect(oversizedCancelReasonSend).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_DELIVERY_TEXT_FIELD',
          message: 'Delivery cancellation reason must be at most 500 characters',
        },
      });

      const ratingSend = jest.fn();
      await ratingRoute!.handler(
        {
          params: { trackingId: 'tracking-1' },
          body: {
            rating: 5,
            feedback: 'Great delivery',
            driver_tip_cents: 500,
          },
          user: { id: 'customer-1' },
        },
        { status: jest.fn(() => ({ send: ratingSend })) }
      );

      expect(ratingSend).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'UNSUPPORTED_DELIVERY_FIELD',
          message: 'Unsupported delivery request field(s): driver_tip_cents',
        },
      });

      const unsafeRatingFieldNameSend = jest.fn();
      const unsafeRatingFieldNameStatus = jest.fn(() => ({ send: unsafeRatingFieldNameSend }));
      await ratingRoute!.handler(
        {
          params: { trackingId: 'tracking-1' },
          body: {
            rating: 5,
            feedback: 'Great delivery',
            ['driver_tip_cents\uFEFF']: 500,
          },
          user: { id: 'customer-1' },
        },
        { status: unsafeRatingFieldNameStatus }
      );

      expect(unsafeRatingFieldNameStatus).toHaveBeenCalledWith(400);
      expect(unsafeRatingFieldNameSend).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_DELIVERY_FIELD_NAME',
          message: 'Delivery rating request field names must not include unsafe control characters',
        },
      });

      const missingRatingBodySend = jest.fn();
      const missingRatingBodyStatus = jest.fn(() => ({ send: missingRatingBodySend }));
      await ratingRoute!.handler(
        {
          params: { trackingId: 'tracking-1' },
          user: { id: 'customer-1' },
        },
        { status: missingRatingBodyStatus }
      );

      expect(missingRatingBodyStatus).toHaveBeenCalledWith(400);
      expect(missingRatingBodySend).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_DELIVERY_RATING',
          message: 'Delivery rating scores must be safe integers between 1 and 5',
        },
      });

      for (const malformedBody of ['rating=5', [5]]) {
        const malformedRatingBodySend = jest.fn();
        const malformedRatingBodyStatus = jest.fn(() => ({ send: malformedRatingBodySend }));
        await ratingRoute!.handler(
          {
            params: { trackingId: 'tracking-1' },
            body: malformedBody,
            user: { id: 'customer-1' },
          },
          { status: malformedRatingBodyStatus }
        );

        expect(malformedRatingBodyStatus).toHaveBeenCalledWith(400);
        expect(malformedRatingBodySend).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'INVALID_DELIVERY_REQUEST_BODY',
            message: 'Delivery request body must be an object',
          },
        });
      }

      expect(disconnectIntegration).not.toHaveBeenCalled();
      expect(cancelDelivery).not.toHaveBeenCalled();
      expect(submitDeliveryRating).not.toHaveBeenCalled();
    } finally {
      disconnectIntegration.mockRestore();
      cancelDelivery.mockRestore();
      submitDeliveryRating.mockRestore();
    }
  });

  it('rejects oversized delivery authenticated user IDs before service calls', async () => {
    const registeredGetRoutes: Array<{ path: string; handler: Function }> = [];
    const registeredPostRoutes: Array<{ path: string; handler: Function }> = [];
    const createIntegration = jest
      .spyOn(DeliveryService.prototype, 'createIntegration')
      .mockRejectedValue(new Error('createIntegration should not be called for oversized delivery user IDs'));
    const disconnectIntegration = jest
      .spyOn(DeliveryService.prototype, 'disconnectIntegration')
      .mockRejectedValue(new Error('disconnectIntegration should not be called for oversized delivery user IDs'));
    const getIntegration = jest
      .spyOn(DeliveryService.prototype, 'getIntegration')
      .mockRejectedValue(new Error('getIntegration should not be called for oversized delivery user IDs'));
    const createDelivery = jest
      .spyOn(DeliveryService.prototype, 'createDelivery')
      .mockRejectedValue(new Error('createDelivery should not be called for oversized delivery user IDs'));
    const getDeliveryTracking = jest
      .spyOn(DeliveryService.prototype, 'getDeliveryTracking')
      .mockRejectedValue(new Error('getDeliveryTracking should not be called for oversized delivery user IDs'));
    const cancelDelivery = jest
      .spyOn(DeliveryService.prototype, 'cancelDelivery')
      .mockRejectedValue(new Error('cancelDelivery should not be called for oversized delivery user IDs'));
    const submitDeliveryRating = jest
      .spyOn(DeliveryService.prototype, 'submitDeliveryRating')
      .mockRejectedValue(new Error('submitDeliveryRating should not be called for oversized delivery user IDs'));
    const getDeliveryStats = jest
      .spyOn(DeliveryService.prototype, 'getDeliveryStats')
      .mockRejectedValue(new Error('getDeliveryStats should not be called for oversized delivery user IDs'));
    const fakeFastify = {
      addHook: jest.fn(),
      get: jest.fn((path: string, _options: unknown, handler: Function) => {
        registeredGetRoutes.push({ path, handler });
      }),
      post: jest.fn((path: string, _options: unknown, handler: Function) => {
        registeredPostRoutes.push({ path, handler });
      }),
    };

    try {
      await deliveryRoutes(fakeFastify as any);
      const connectRoute = registeredPostRoutes.find((item) => item.path === '/connect');
      const disconnectRoute = registeredPostRoutes.find((item) => item.path === '/disconnect');
      const integrationRoute = registeredGetRoutes.find((item) => item.path === '/integration/:businessId');
      const createRoute = registeredPostRoutes.find((item) => item.path === '/create/:orderId');
      const trackRoute = registeredGetRoutes.find((item) => item.path === '/track/:orderId');
      const cancelRoute = registeredPostRoutes.find((item) => item.path === '/cancel/:trackingId');
      const ratingRoute = registeredPostRoutes.find((item) => item.path === '/rating/:trackingId');
      const statsRoute = registeredGetRoutes.find((item) => item.path === '/stats/:businessId');
      expect(connectRoute).toBeDefined();
      expect(disconnectRoute).toBeDefined();
      expect(integrationRoute).toBeDefined();
      expect(createRoute).toBeDefined();
      expect(trackRoute).toBeDefined();
      expect(cancelRoute).toBeDefined();
      expect(ratingRoute).toBeDefined();
      expect(statsRoute).toBeDefined();

      const oversizedUser = { userId: 'u'.repeat(501) };
      for (const { handler, request, message = 'Delivery user ID must be at most 500 characters' } of [
        {
          handler: connectRoute!.handler,
          request: {
            body: {
              business_id: 'business-1',
              provider: 'swiggy',
              api_key: 'api-key\u202E',
              partner_account_id: 'partner-account-1',
              cost_handling: 'customer',
              fixed_delivery_fee_cents: '1500\uFEFF',
            },
            user: oversizedUser,
          },
        },
        {
          handler: disconnectRoute!.handler,
          request: { body: { business_id: 'business-1' }, user: oversizedUser },
        },
        {
          handler: integrationRoute!.handler,
          request: { params: { businessId: 'business-1' }, user: oversizedUser },
        },
        {
          handler: createRoute!.handler,
          request: { params: { orderId: 'order-1' }, body: {}, user: oversizedUser },
        },
        {
          handler: trackRoute!.handler,
          request: { params: { orderId: 'order-1' }, user: oversizedUser },
        },
        {
          handler: cancelRoute!.handler,
          request: {
            params: { trackingId: 'tracking-1' },
            body: { reason: 'Customer cancelled' },
            user: oversizedUser,
          },
        },
        {
          handler: ratingRoute!.handler,
          request: {
            params: { trackingId: 'tracking-1' },
            body: { rating: '5\uFEFF' },
            user: oversizedUser,
          },
          message: 'Delivery customer ID must be at most 500 characters',
        },
        {
          handler: statsRoute!.handler,
          request: { params: { businessId: 'business-1' }, user: oversizedUser },
        },
      ]) {
        const send = jest.fn();
        const status = jest.fn(() => ({ send }));
        await handler({ ...request, log: { error: jest.fn() } }, { status });

        expect(status).toHaveBeenCalledWith(400);
        expect(send).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'INVALID_DELIVERY_TEXT_FIELD',
            message,
          },
        });
      }

      expect(createIntegration).not.toHaveBeenCalled();
      expect(disconnectIntegration).not.toHaveBeenCalled();
      expect(getIntegration).not.toHaveBeenCalled();
      expect(createDelivery).not.toHaveBeenCalled();
      expect(getDeliveryTracking).not.toHaveBeenCalled();
      expect(cancelDelivery).not.toHaveBeenCalled();
      expect(submitDeliveryRating).not.toHaveBeenCalled();
      expect(getDeliveryStats).not.toHaveBeenCalled();
    } finally {
      createIntegration.mockRestore();
      disconnectIntegration.mockRestore();
      getIntegration.mockRestore();
      createDelivery.mockRestore();
      getDeliveryTracking.mockRestore();
      cancelDelivery.mockRestore();
      submitDeliveryRating.mockRestore();
      getDeliveryStats.mockRestore();
    }
  });

  it('rejects invalid delivery seller auth before route business/order/tracking metadata', async () => {
    const registeredGetRoutes: Array<{ path: string; handler: Function }> = [];
    const registeredPostRoutes: Array<{ path: string; handler: Function }> = [];
    const disconnectIntegration = jest
      .spyOn(DeliveryService.prototype, 'disconnectIntegration')
      .mockRejectedValue(new Error('disconnectIntegration should not be called for invalid delivery auth'));
    const getIntegration = jest
      .spyOn(DeliveryService.prototype, 'getIntegration')
      .mockRejectedValue(new Error('getIntegration should not be called for invalid delivery auth'));
    const createDelivery = jest
      .spyOn(DeliveryService.prototype, 'createDelivery')
      .mockRejectedValue(new Error('createDelivery should not be called for invalid delivery auth'));
    const getDeliveryTracking = jest
      .spyOn(DeliveryService.prototype, 'getDeliveryTracking')
      .mockRejectedValue(new Error('getDeliveryTracking should not be called for invalid delivery auth'));
    const cancelDelivery = jest
      .spyOn(DeliveryService.prototype, 'cancelDelivery')
      .mockRejectedValue(new Error('cancelDelivery should not be called for invalid delivery auth'));
    const getDeliveryStats = jest
      .spyOn(DeliveryService.prototype, 'getDeliveryStats')
      .mockRejectedValue(new Error('getDeliveryStats should not be called for invalid delivery auth'));
    const findOne = jest.fn(async () => {
      throw new Error('delivery authorization lookup should not run for invalid auth');
    });
    const fakeFastify = {
      addHook: jest.fn(),
      get: jest.fn((path: string, _options: unknown, handler: Function) => {
        registeredGetRoutes.push({ path, handler });
      }),
      post: jest.fn((path: string, _options: unknown, handler: Function) => {
        registeredPostRoutes.push({ path, handler });
      }),
      orm: {
        manager: {
          findOne,
        },
      },
    };

    try {
      await deliveryRoutes(fakeFastify as any);
      const disconnectRoute = registeredPostRoutes.find((item) => item.path === '/disconnect');
      const integrationRoute = registeredGetRoutes.find((item) => item.path === '/integration/:businessId');
      const createRoute = registeredPostRoutes.find((item) => item.path === '/create/:orderId');
      const trackRoute = registeredGetRoutes.find((item) => item.path === '/track/:orderId');
      const cancelRoute = registeredPostRoutes.find((item) => item.path === '/cancel/:trackingId');
      const statsRoute = registeredGetRoutes.find((item) => item.path === '/stats/:businessId');
      expect(disconnectRoute).toBeDefined();
      expect(integrationRoute).toBeDefined();
      expect(createRoute).toBeDefined();
      expect(trackRoute).toBeDefined();
      expect(cancelRoute).toBeDefined();
      expect(statsRoute).toBeDefined();

      const oversizedUser = { userId: 'u'.repeat(501) };
      for (const { handler, request } of [
        {
          handler: disconnectRoute!.handler,
          request: {
            body: { business_id: 'business-\u202E1' },
            user: oversizedUser,
          },
        },
        {
          handler: integrationRoute!.handler,
          request: {
            params: { businessId: 'business-\u202E1' },
            user: oversizedUser,
          },
        },
        {
          handler: createRoute!.handler,
          request: {
            params: { orderId: 'order-\u202E1' },
            body: {},
            user: oversizedUser,
          },
        },
        {
          handler: trackRoute!.handler,
          request: {
            params: { orderId: 'order-\u202E1' },
            user: oversizedUser,
          },
        },
        {
          handler: cancelRoute!.handler,
          request: {
            params: { trackingId: 'tracking-1' },
            body: { reason: 'Customer\u202E cancelled' },
            user: oversizedUser,
          },
        },
        {
          handler: statsRoute!.handler,
          request: {
            params: { businessId: 'business-\u202E1' },
            user: oversizedUser,
          },
        },
      ]) {
        const send = jest.fn();
        const status = jest.fn(() => ({ send }));
        await handler({ ...request, log: { error: jest.fn() } }, { status });

        expect(status).toHaveBeenCalledWith(400);
        expect(send).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'INVALID_DELIVERY_TEXT_FIELD',
            message: 'Delivery user ID must be at most 500 characters',
          },
        });
      }

      expect(findOne).not.toHaveBeenCalled();
      expect(disconnectIntegration).not.toHaveBeenCalled();
      expect(getIntegration).not.toHaveBeenCalled();
      expect(createDelivery).not.toHaveBeenCalled();
      expect(getDeliveryTracking).not.toHaveBeenCalled();
      expect(cancelDelivery).not.toHaveBeenCalled();
      expect(getDeliveryStats).not.toHaveBeenCalled();
    } finally {
      disconnectIntegration.mockRestore();
      getIntegration.mockRestore();
      createDelivery.mockRestore();
      getDeliveryTracking.mockRestore();
      cancelDelivery.mockRestore();
      getDeliveryStats.mockRestore();
    }
  });

  it('validates delivery rating route input before service calls and normalizes valid metadata', async () => {
    const registeredPostRoutes: Array<{ path: string; handler: Function }> = [];
    const submitDeliveryRating = jest
      .spyOn(DeliveryService.prototype, 'submitDeliveryRating')
      .mockResolvedValue({
        id: 'rating-1',
        rating: 5,
        feedback: 'Great delivery',
        timeliness_rating: 4,
        courtesy_rating: 5,
        packaging_rating: 4,
        issues: ['Late arrival', 'Cold packaging'],
        provider: 'swiggy',
        created_at: new Date('2026-06-27T17:45:00.000Z'),
      } as any);
    const fakeFastify = {
      addHook: jest.fn(),
      get: jest.fn(),
      post: jest.fn((path: string, _options: unknown, handler: Function) => {
        registeredPostRoutes.push({ path, handler });
      }),
    };
    const makeReply = () => {
      const send = jest.fn();
      return {
        send,
        status: jest.fn(() => ({ send })),
      };
    };

    try {
      await deliveryRoutes(fakeFastify as any);
      const route = registeredPostRoutes.find((item) => item.path === '/rating/:trackingId');
      expect(route).toBeDefined();

      const scoreReply = makeReply();
      await route!.handler(
        {
          params: { trackingId: 'tracking-1' },
          body: {
            rating: 6,
          },
          user: { id: 'customer-1' },
          log: { error: jest.fn() },
        },
        scoreReply
      );

      expect(scoreReply.status).toHaveBeenCalledWith(400);
      expect(scoreReply.send).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_DELIVERY_RATING',
          message: 'Delivery rating scores must be safe integers between 1 and 5',
        },
      });

      const unsafeScoreReply = makeReply();
      await route!.handler(
        {
          params: { trackingId: 'tracking-1' },
          body: {
            rating: '5\uFEFF',
          },
          user: { id: 'customer-1' },
          log: { error: jest.fn() },
        },
        unsafeScoreReply
      );

      expect(unsafeScoreReply.status).toHaveBeenCalledWith(400);
      expect(unsafeScoreReply.send).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_DELIVERY_TEXT_FIELD',
          message: 'Delivery rating score must not include unsafe control characters',
        },
      });

      const feedbackReply = makeReply();
      await route!.handler(
        {
          params: { trackingId: 'tracking-1' },
          body: {
            rating: 5,
            feedback: '   ',
          },
          user: { id: 'customer-1' },
          log: { error: jest.fn() },
        },
        feedbackReply
      );

      expect(feedbackReply.status).toHaveBeenCalledWith(400);
      expect(feedbackReply.send).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_DELIVERY_RATING',
          message: 'Delivery rating feedback must be a non-empty string up to 500 characters',
        },
      });

      const issuesReply = makeReply();
      await route!.handler(
        {
          params: { trackingId: 'tracking-1' },
          body: {
            rating: 5,
            issues: ['Late arrival', '   '],
          },
          user: { id: 'customer-1' },
          log: { error: jest.fn() },
        },
        issuesReply
      );

      expect(issuesReply.status).toHaveBeenCalledWith(400);
      expect(issuesReply.send).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_DELIVERY_RATING',
          message: 'Delivery rating issues must be an array of non-empty strings up to 500 characters',
        },
      });

      const oversizedIssueReply = makeReply();
      await route!.handler(
        {
          params: { trackingId: 'tracking-1' },
          body: {
            rating: 5,
            issues: ['I'.repeat(501)],
          },
          user: { id: 'customer-1' },
          log: { error: jest.fn() },
        },
        oversizedIssueReply
      );

      expect(oversizedIssueReply.status).toHaveBeenCalledWith(400);
      expect(oversizedIssueReply.send).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_DELIVERY_RATING',
          message: 'Delivery rating issues must be an array of non-empty strings up to 500 characters',
        },
      });

      const userReply = makeReply();
      await route!.handler(
        {
          params: { trackingId: 'tracking-1' },
          body: {
            rating: 5,
          },
          user: { id: '   ' },
          log: { error: jest.fn() },
        },
        userReply
      );

      expect(userReply.status).toHaveBeenCalledWith(400);
      expect(userReply.send).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_DELIVERY_RATING_USER',
          message: 'Authenticated customer ID is required',
        },
      });

      const oversizedCustomerReply = makeReply();
      await route!.handler(
        {
          params: { trackingId: 'tracking-1' },
          body: {
            rating: 5,
          },
          user: { id: 'C'.repeat(501) },
          log: { error: jest.fn() },
        },
        oversizedCustomerReply
      );

      expect(oversizedCustomerReply.status).toHaveBeenCalledWith(400);
      expect(oversizedCustomerReply.send).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_DELIVERY_TEXT_FIELD',
          message: 'Delivery customer ID must be at most 500 characters',
        },
      });
      expect(submitDeliveryRating).not.toHaveBeenCalled();

      const validReply = makeReply();
      const response = await route!.handler(
        {
          params: { trackingId: ' tracking-1 ' },
          body: {
            rating: '5',
            feedback: ' Great delivery ',
            timeliness_rating: '4',
            courtesy_rating: 5,
            packaging_rating: 4,
            issues: [' Late arrival ', 'late arrival', ' Cold packaging '],
          },
          user: { userId: ' customer-1 ' },
          log: { error: jest.fn() },
        },
        validReply
      );

      expect(submitDeliveryRating).toHaveBeenCalledWith('tracking-1', 'customer-1', {
        rating: 5,
        feedback: 'Great delivery',
        timeliness_rating: 4,
        courtesy_rating: 5,
        packaging_rating: 4,
        issues: ['Late arrival', 'Cold packaging'],
      });
      expect(response).toMatchObject({
        success: true,
        data: {
          rating: {
            id: 'rating-1',
            rating: 5,
            provider: 'swiggy',
          },
        },
      });

      const canonicalUserIdReply = makeReply();
      await route!.handler(
        {
          params: { trackingId: ' tracking-2 ' },
          body: {
            rating: 4,
          },
          user: { userId: ' customer-2 ', id: 'stale-customer' },
          log: { error: jest.fn() },
        },
        canonicalUserIdReply
      );

      expect(submitDeliveryRating).toHaveBeenLastCalledWith('tracking-2', 'customer-2', {
        rating: 4,
        feedback: undefined,
        timeliness_rating: undefined,
        courtesy_rating: undefined,
        packaging_rating: undefined,
        issues: undefined,
      });
    } finally {
      submitDeliveryRating.mockRestore();
    }
  });

  it('rejects blank delivery route path parameters before service calls and normalizes valid IDs', async () => {
    const registeredGetRoutes: Array<{ path: string; handler: Function }> = [];
    const registeredPostRoutes: Array<{ path: string; handler: Function }> = [];
    const getIntegration = jest
      .spyOn(DeliveryService.prototype, 'getIntegration')
      .mockRejectedValue(new Error('getIntegration should not be called for blank delivery route IDs'));
    const createDelivery = jest
      .spyOn(DeliveryService.prototype, 'createDelivery')
      .mockRejectedValue(new Error('createDelivery should not be called for blank delivery route IDs'));
    const getDeliveryTracking = jest
      .spyOn(DeliveryService.prototype, 'getDeliveryTracking')
      .mockRejectedValue(new Error('getDeliveryTracking should not be called for blank delivery route IDs'));
    const cancelDelivery = jest
      .spyOn(DeliveryService.prototype, 'cancelDelivery')
      .mockRejectedValue(new Error('cancelDelivery should not be called for blank delivery route IDs'));
    const submitDeliveryRating = jest
      .spyOn(DeliveryService.prototype, 'submitDeliveryRating')
      .mockRejectedValue(new Error('submitDeliveryRating should not be called for blank delivery route IDs'));
    const getDeliveryStats = jest
      .spyOn(DeliveryService.prototype, 'getDeliveryStats')
      .mockRejectedValue(new Error('getDeliveryStats should not be called for blank delivery route IDs'));
    const findOne = jest.fn(async (entity: unknown, options: any) => {
      if (entity === Order) {
        return { id: options.where.id, business_id: 'business-1', customer_id: 'customer-1' };
      }

      if (entity === Business) {
        return { id: options.where.id, owner_id: 'user-1' };
      }

      throw new Error('Unexpected delivery route authorization lookup');
    });
    const fakeFastify = {
      addHook: jest.fn(),
      get: jest.fn((path: string, _options: unknown, handler: Function) => {
        registeredGetRoutes.push({ path, handler });
      }),
      post: jest.fn((path: string, _options: unknown, handler: Function) => {
        registeredPostRoutes.push({ path, handler });
      }),
      orm: {
        manager: {
          findOne,
        },
      },
    };

    const expectMissingParameter = async (
      handler: Function,
      request: Record<string, unknown>,
      message: string
    ) => {
      const send = jest.fn();
      const status = jest.fn(() => ({ send }));
      await handler({ ...request, log: { error: jest.fn() } }, { status });
      expect(status).toHaveBeenCalledWith(400);
      expect(send).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'MISSING_PARAMETERS',
          message,
        },
      });
    };

    try {
      await deliveryRoutes(fakeFastify as any);
      const integrationRoute = registeredGetRoutes.find((item) => item.path === '/integration/:businessId');
      const createRoute = registeredPostRoutes.find((item) => item.path === '/create/:orderId');
      const trackRoute = registeredGetRoutes.find((item) => item.path === '/track/:orderId');
      const cancelRoute = registeredPostRoutes.find((item) => item.path === '/cancel/:trackingId');
      const ratingRoute = registeredPostRoutes.find((item) => item.path === '/rating/:trackingId');
      const statsRoute = registeredGetRoutes.find((item) => item.path === '/stats/:businessId');
      expect(integrationRoute).toBeDefined();
      expect(createRoute).toBeDefined();
      expect(trackRoute).toBeDefined();
      expect(cancelRoute).toBeDefined();
      expect(ratingRoute).toBeDefined();
      expect(statsRoute).toBeDefined();

      for (const { route, request } of [
        {
          route: integrationRoute!,
          request: { params: { businessId: 'business-1' }, query: 'includeSecrets=true', user: { userId: 'user-1' } },
        },
        {
          route: trackRoute!,
          request: { params: { orderId: 'order-1' }, query: ['includeOtp'], user: { userId: 'user-1' } },
        },
        {
          route: statsRoute!,
          request: { params: { businessId: 'business-1' }, query: 'includeProviderErrors=true', user: { userId: 'user-1' } },
        },
      ]) {
        const send = jest.fn();
        const status = jest.fn(() => ({ send }));
        await route.handler({ ...request, log: { error: jest.fn() } }, { status });

        expect(status).toHaveBeenCalledWith(400);
        expect(send).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'INVALID_DELIVERY_QUERY',
            message: 'Delivery query must be an object',
          },
        });
      }

      for (const { route, request, message } of [
        {
          route: integrationRoute!,
          request: {
            params: { businessId: 'business-1' },
            query: { include_secrets: 'true' },
            user: { userId: 'user-1' },
          },
          message: 'Unsupported delivery query field(s): include_secrets',
        },
        {
          route: trackRoute!,
          request: {
            params: { orderId: 'order-1' },
            query: { include_otp: 'true' },
            user: { userId: 'user-1' },
          },
          message: 'Unsupported delivery query field(s): include_otp',
        },
        {
          route: statsRoute!,
          request: {
            params: { businessId: 'business-1' },
            query: { include_provider_errors: 'true' },
            user: { userId: 'user-1' },
          },
          message: 'Unsupported delivery query field(s): include_provider_errors',
        },
      ]) {
        const send = jest.fn();
        const status = jest.fn(() => ({ send }));
        await route.handler({ ...request, log: { error: jest.fn() } }, { status });

        expect(status).toHaveBeenCalledWith(400);
        expect(send).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'UNSUPPORTED_DELIVERY_QUERY_FIELD',
            message,
          },
        });
      }

      for (const { route, request } of [
        {
          route: integrationRoute!,
          request: {
            params: { businessId: 'business-1' },
            query: { ['include_secrets\uFEFF']: 'true' },
            user: { userId: 'user-1' },
          },
        },
        {
          route: trackRoute!,
          request: {
            params: { orderId: 'order-1' },
            query: { ['include_otp\uFEFF']: 'true' },
            user: { userId: 'user-1' },
          },
        },
        {
          route: statsRoute!,
          request: {
            params: { businessId: 'business-1' },
            query: { ['include_provider_errors\uFEFF']: 'true' },
            user: { userId: 'user-1' },
          },
        },
      ]) {
        const unsafeQueryFieldNameSend = jest.fn();
        const unsafeQueryFieldNameStatus = jest.fn(() => ({ send: unsafeQueryFieldNameSend }));
        await route.handler({ ...request, log: { error: jest.fn() } }, { status: unsafeQueryFieldNameStatus });

        expect(unsafeQueryFieldNameStatus).toHaveBeenCalledWith(400);
        expect(unsafeQueryFieldNameSend).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'INVALID_DELIVERY_FIELD_NAME',
            message: 'Delivery query field names must not include unsafe control characters',
          },
        });
      }

      for (const malformedQuery of ['includeProvider=true', ['includeProvider']]) {
        const send = jest.fn();
        const status = jest.fn(() => ({ send }));
        await createRoute!.handler(
          {
            params: { orderId: 'order-1' },
            query: malformedQuery,
            body: {},
            user: { userId: 'user-1' },
            log: { error: jest.fn() },
          },
          { status }
        );

        expect(status).toHaveBeenCalledWith(400);
        expect(send).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'INVALID_DELIVERY_QUERY',
            message: 'Delivery query must be an object',
          },
        });
      }

      const unsupportedCreateQuerySend = jest.fn();
      const unsupportedCreateQueryStatus = jest.fn(() => ({ send: unsupportedCreateQuerySend }));
      await createRoute!.handler(
        {
          params: { orderId: 'order-1' },
          query: { include_provider_response: 'true' },
          body: {},
          user: { userId: 'user-1' },
          log: { error: jest.fn() },
        },
        { status: unsupportedCreateQueryStatus }
      );

      expect(unsupportedCreateQueryStatus).toHaveBeenCalledWith(400);
      expect(unsupportedCreateQuerySend).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'UNSUPPORTED_DELIVERY_QUERY_FIELD',
          message: 'Unsupported delivery query field(s): include_provider_response',
        },
      });

      const unsafeCreateQuerySend = jest.fn();
      const unsafeCreateQueryStatus = jest.fn(() => ({ send: unsafeCreateQuerySend }));
      await createRoute!.handler(
        {
          params: { orderId: 'order-1' },
          query: { ['include_provider_response\uFEFF']: 'true' },
          body: {},
          user: { userId: 'user-1' },
          log: { error: jest.fn() },
        },
        { status: unsafeCreateQueryStatus }
      );

      expect(unsafeCreateQueryStatus).toHaveBeenCalledWith(400);
      expect(unsafeCreateQuerySend).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_DELIVERY_FIELD_NAME',
          message: 'Delivery query field names must not include unsafe control characters',
        },
      });

      for (const malformedBody of ['provider=swiggy', ['swiggy']]) {
        const send = jest.fn();
        const status = jest.fn(() => ({ send }));
        await createRoute!.handler(
          {
            params: { orderId: 'order-1' },
            body: malformedBody,
            user: { userId: 'user-1' },
            log: { error: jest.fn() },
          },
          { status }
        );

        expect(status).toHaveBeenCalledWith(400);
        expect(send).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'INVALID_DELIVERY_REQUEST_BODY',
            message: 'Delivery request body must be an object',
          },
        });
      }

      const unsupportedCreateBodySend = jest.fn();
      const unsupportedCreateBodyStatus = jest.fn(() => ({ send: unsupportedCreateBodySend }));
      await createRoute!.handler(
        {
          params: { orderId: 'order-1' },
          body: { provider_override: 'zomato' },
          user: { userId: 'user-1' },
          log: { error: jest.fn() },
        },
        { status: unsupportedCreateBodyStatus }
      );

      expect(unsupportedCreateBodyStatus).toHaveBeenCalledWith(400);
      expect(unsupportedCreateBodySend).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'UNSUPPORTED_DELIVERY_FIELD',
          message: 'Unsupported delivery request field(s): provider_override',
        },
      });

      const unsafeCreateBodySend = jest.fn();
      const unsafeCreateBodyStatus = jest.fn(() => ({ send: unsafeCreateBodySend }));
      await createRoute!.handler(
        {
          params: { orderId: 'order-1' },
          body: { ['provider_override\uFEFF']: 'zomato' },
          user: { userId: 'user-1' },
          log: { error: jest.fn() },
        },
        { status: unsafeCreateBodyStatus }
      );

      expect(unsafeCreateBodyStatus).toHaveBeenCalledWith(400);
      expect(unsafeCreateBodySend).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_DELIVERY_FIELD_NAME',
          message: 'Delivery create request field names must not include unsafe control characters',
        },
      });

      expect(getIntegration).not.toHaveBeenCalled();
      expect(createDelivery).not.toHaveBeenCalled();
      expect(getDeliveryTracking).not.toHaveBeenCalled();
      expect(getDeliveryStats).not.toHaveBeenCalled();

      await expectMissingParameter(
        integrationRoute!.handler,
        { params: { businessId: '   ' }, user: { userId: 'user-1' } },
        'Business ID is required'
      );
      await expectMissingParameter(
        createRoute!.handler,
        { params: { orderId: '   ' }, user: { userId: 'user-1' } },
        'Order ID is required'
      );
      await expectMissingParameter(
        trackRoute!.handler,
        { params: { orderId: '   ' }, user: { userId: 'user-1' } },
        'Order ID is required'
      );
      await expectMissingParameter(
        cancelRoute!.handler,
        {
          params: { trackingId: '   ' },
          body: { reason: 'Customer cancelled' },
          user: { userId: 'user-1' },
        },
        'Tracking ID is required'
      );
      await expectMissingParameter(
        ratingRoute!.handler,
        {
          params: { trackingId: '   ' },
          body: { rating: 5 },
          user: { id: 'customer-1' },
        },
        'Tracking ID is required'
      );
      await expectMissingParameter(
        statsRoute!.handler,
        { params: { businessId: '   ' }, user: { userId: 'user-1' } },
        'Business ID is required'
      );

      for (const malformedParams of [undefined, ['business-1']]) {
        await expectMissingParameter(
          integrationRoute!.handler,
          { params: malformedParams, user: { userId: 'user-1' } },
          'Business ID is required'
        );
        await expectMissingParameter(
          createRoute!.handler,
          { params: malformedParams, user: { userId: 'user-1' } },
          'Order ID is required'
        );
        await expectMissingParameter(
          trackRoute!.handler,
          { params: malformedParams, user: { userId: 'user-1' } },
          'Order ID is required'
        );
        await expectMissingParameter(
          cancelRoute!.handler,
          {
            params: malformedParams,
            body: { reason: 'Customer cancelled' },
            user: { userId: 'user-1' },
          },
          'Tracking ID is required'
        );
        await expectMissingParameter(
          ratingRoute!.handler,
          {
            params: malformedParams,
            body: { rating: 5 },
            user: { id: 'customer-1' },
          },
          'Tracking ID is required'
        );
        await expectMissingParameter(
          statsRoute!.handler,
          { params: malformedParams, user: { userId: 'user-1' } },
          'Business ID is required'
        );
      }

      for (const { handler, request, message } of [
        {
          handler: integrationRoute!.handler,
          request: { params: { businessId: 'business-\u202E1' }, user: { userId: 'user-1' } },
          message: 'Delivery business ID must not include unsafe control characters',
        },
        {
          handler: createRoute!.handler,
          request: { params: { orderId: 'order-\u200B1' }, body: {}, user: { userId: 'user-1' } },
          message: 'Delivery order ID must not include unsafe control characters',
        },
        {
          handler: trackRoute!.handler,
          request: { params: { orderId: 'order-\u20601' }, user: { userId: 'user-1' } },
          message: 'Delivery order ID must not include unsafe control characters',
        },
        {
          handler: cancelRoute!.handler,
          request: {
            params: { trackingId: 'tracking-\u202E1' },
            body: { reason: 'Customer cancelled' },
            user: { userId: 'user-1' },
          },
          message: 'Delivery tracking ID must not include unsafe control characters',
        },
        {
          handler: cancelRoute!.handler,
          request: {
            params: { trackingId: 'tracking-1' },
            body: { reason: 'Customer\u200Bcancelled' },
            user: { userId: 'user-1' },
          },
          message: 'Delivery cancellation reason must not include unsafe control characters',
        },
        {
          handler: ratingRoute!.handler,
          request: {
            params: { trackingId: 'tracking-\u20601' },
            body: { rating: 5 },
            user: { id: 'customer-1' },
          },
          message: 'Delivery tracking ID must not include unsafe control characters',
        },
        {
          handler: ratingRoute!.handler,
          request: {
            params: { trackingId: 'tracking-1' },
            body: { rating: 5, feedback: 'great\u202E' },
            user: { id: 'customer-1' },
          },
          message: 'Delivery rating feedback must not include unsafe control characters',
        },
        {
          handler: ratingRoute!.handler,
          request: {
            params: { trackingId: 'tracking-1' },
            body: { rating: 5, issues: ['late\u200Barrival'] },
            user: { id: 'customer-1' },
          },
          message: 'Delivery rating issue must not include unsafe control characters',
        },
        {
          handler: ratingRoute!.handler,
          request: {
            params: { trackingId: 'tracking-1' },
            body: { rating: 5 },
            user: { id: 'customer-\u202E1' },
          },
          message: 'Delivery customer ID must not include unsafe control characters',
        },
        {
          handler: statsRoute!.handler,
          request: { params: { businessId: 'business-\u200B1' }, user: { userId: 'user-1' } },
          message: 'Delivery business ID must not include unsafe control characters',
        },
      ]) {
        const send = jest.fn();
        const status = jest.fn(() => ({ send }));
        await handler({ ...request, log: { error: jest.fn() } }, { status });

        expect(status).toHaveBeenCalledWith(400);
        expect(send).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'INVALID_DELIVERY_TEXT_FIELD',
            message,
          },
        });
      }

      for (const { handler, request, message } of [
        {
          handler: integrationRoute!.handler,
          request: { params: { businessId: 'b'.repeat(256) }, user: { userId: 'user-1' } },
          message: 'Delivery business ID must be at most 255 characters',
        },
        {
          handler: createRoute!.handler,
          request: { params: { orderId: 'o'.repeat(256) }, body: {}, user: { userId: 'user-1' } },
          message: 'Delivery order ID must be at most 255 characters',
        },
        {
          handler: trackRoute!.handler,
          request: { params: { orderId: 'o'.repeat(256) }, user: { userId: 'user-1' } },
          message: 'Delivery order ID must be at most 255 characters',
        },
        {
          handler: cancelRoute!.handler,
          request: {
            params: { trackingId: 't'.repeat(256) },
            body: { reason: 'Customer cancelled' },
            user: { userId: 'user-1' },
          },
          message: 'Delivery tracking ID must be at most 255 characters',
        },
        {
          handler: ratingRoute!.handler,
          request: {
            params: { trackingId: 't'.repeat(256) },
            body: { rating: 5 },
            user: { id: 'customer-1' },
          },
          message: 'Delivery tracking ID must be at most 255 characters',
        },
        {
          handler: statsRoute!.handler,
          request: { params: { businessId: 'b'.repeat(256) }, user: { userId: 'user-1' } },
          message: 'Delivery business ID must be at most 255 characters',
        },
      ]) {
        const send = jest.fn();
        const status = jest.fn(() => ({ send }));
        await handler({ ...request, log: { error: jest.fn() } }, { status });

        expect(status).toHaveBeenCalledWith(400);
        expect(send).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'INVALID_DELIVERY_TEXT_FIELD',
            message,
          },
        });
      }

      expect(getIntegration).not.toHaveBeenCalled();
      expect(createDelivery).not.toHaveBeenCalled();
      expect(getDeliveryTracking).not.toHaveBeenCalled();
      expect(cancelDelivery).not.toHaveBeenCalled();
      expect(submitDeliveryRating).not.toHaveBeenCalled();
      expect(getDeliveryStats).not.toHaveBeenCalled();

      createDelivery.mockResolvedValueOnce({
        id: 'tracking-1',
        order_id: 'order-1',
        provider: 'swiggy',
        status: 'assigned',
        delivery_partner_id: 'partner-1',
        estimated_pickup_at: new Date('2026-06-27T16:45:00.000Z'),
        estimated_delivery_at: new Date('2026-06-27T17:15:00.000Z'),
        delivery_fee_cents: 1500,
        tracking_url: 'https://tracking.example/delivery/tracking-1',
        created_at: new Date('2026-06-27T16:40:00.000Z'),
      } as any);

      const result = await createRoute!.handler(
        {
          params: { orderId: ' order-1 ' },
          user: { userId: 'user-1' },
          log: { error: jest.fn() },
        },
        { status: jest.fn() }
      );

      expect(createDelivery).toHaveBeenCalledWith('order-1');
      expect(findOne).toHaveBeenCalledWith(Order, {
        where: { id: 'order-1' },
        select: ['id', 'business_id', 'customer_id'],
      });
      expect(findOne).toHaveBeenCalledWith(Business, {
        where: { id: 'business-1' },
        select: ['id', 'owner_id'],
      });
      expect(result.success).toBe(true);
    } finally {
      getIntegration.mockRestore();
      createDelivery.mockRestore();
      getDeliveryTracking.mockRestore();
      cancelDelivery.mockRestore();
      submitDeliveryRating.mockRestore();
      getDeliveryStats.mockRestore();
    }
  });

  it('redacts proof-of-delivery OTPs from delivery tracking route responses', async () => {
    const registeredGetRoutes: Array<{ path: string; handler: Function }> = [];
    const getDeliveryTracking = jest
      .spyOn(DeliveryService.prototype, 'getDeliveryTracking')
      .mockResolvedValue({
        id: 'tracking-1',
        order_id: 'order-1',
        provider: 'dunzo',
        status: 'assigned',
        delivery_partner_id: 'partner-1',
        delivery_person_name: 'Rider One',
        delivery_person_phone: '+15551234567',
        estimated_pickup_at: new Date('2026-06-27T15:00:00.000Z'),
        picked_up_at: null,
        estimated_delivery_at: new Date('2026-06-27T15:30:00.000Z'),
        delivered_at: null,
        delivery_fee_cents: 9900,
        tracking_url: 'https://tracking.example.com/orders/order-1',
        delivery_instructions: 'Leave at counter',
        cancellation_reason: null,
        attempt_count: 1,
        delivery_otp: '123456',
        status_history: [{ status: 'assigned', timestamp: new Date('2026-06-27T14:55:00.000Z') }],
        error_message: null,
        created_at: new Date('2026-06-27T14:55:00.000Z'),
        updated_at: new Date('2026-06-27T14:55:00.000Z'),
      } as any);
    const findOne = jest.fn(async (entity: unknown, options: any) => {
      if (entity === Order) {
        return { id: options.where.id, business_id: 'business-1', customer_id: 'customer-1' };
      }

      if (entity === Business) {
        return { id: options.where.id, owner_id: 'owner-1' };
      }

      throw new Error('Unexpected delivery tracking authorization lookup');
    });
    const fakeFastify = {
      addHook: jest.fn(),
      get: jest.fn((path: string, _options: unknown, handler: Function) => {
        registeredGetRoutes.push({ path, handler });
      }),
      post: jest.fn(),
      orm: {
        manager: {
          findOne,
        },
      },
    };

    try {
      await deliveryRoutes(fakeFastify as any);
      const route = registeredGetRoutes.find((item) => item.path === '/track/:orderId');
      expect(route).toBeDefined();

      const response = await route!.handler(
        {
          params: { orderId: 'order-1' },
          user: { userId: 'customer-1' },
        },
        { status: jest.fn() }
      );

      expect(getDeliveryTracking).toHaveBeenCalledWith('order-1');
      expect(findOne).toHaveBeenCalledWith(Order, {
        where: { id: 'order-1' },
        select: ['id', 'business_id', 'customer_id'],
      });
      expect(findOne).toHaveBeenCalledWith(Business, {
        where: { id: 'business-1' },
        select: ['id', 'owner_id'],
      });
      expect(response).toMatchObject({
        success: true,
        data: {
          tracking: expect.objectContaining({
            id: 'tracking-1',
            order_id: 'order-1',
            status: 'assigned',
          }),
        },
      });
      expect(response.data.tracking).not.toHaveProperty('delivery_otp');
    } finally {
      getDeliveryTracking.mockRestore();
    }
  });

  it('validates enhanced-referral leaderboard query fields before service calls', async () => {
    const registeredGetRoutes: Array<{ path: string; handler: Function }> = [];
    const getTopReferrers = jest
      .spyOn(LeaderboardService.prototype, 'getTopReferrers')
      .mockResolvedValue([]);
    const fakeFastify = {
      addHook: jest.fn(),
      get: jest.fn((path: string, _options: unknown, handler: Function) => {
        registeredGetRoutes.push({ path, handler });
      }),
      post: jest.fn(),
    };

    try {
      await enhancedReferralRoutes(fakeFastify as any);
      const route = registeredGetRoutes.find((item) => item.path === '/referrals/leaderboard');
      expect(route).toBeDefined();

      const validResponse = await route!.handler(
        {
          query: {
            limit: ' 25 ',
          },
          log: { error: jest.fn() },
        },
        { status: jest.fn() }
      );

      expect(getTopReferrers).toHaveBeenCalledWith(25);
      expect(validResponse).toMatchObject({
        success: true,
        data: { leaderboard: [] },
      });

      getTopReferrers.mockClear();
      const malformedSend = jest.fn();
      const malformedStatus = jest.fn(() => ({ send: malformedSend }));
      await route!.handler(
        {
          query: 'limit=25',
          log: { error: jest.fn() },
        },
        { status: malformedStatus }
      );

      expect(malformedStatus).toHaveBeenCalledWith(400);
      expect(malformedSend).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_REFERRAL_LEADERBOARD_QUERY',
          message: 'Referral leaderboard query must be an object',
        },
      });

      const unsupportedSend = jest.fn();
      await route!.handler(
        {
          query: {
            limit: '25',
            include_prize_audit: 'true',
          },
          log: { error: jest.fn() },
        },
        { status: jest.fn(() => ({ send: unsupportedSend })) }
      );

      expect(unsupportedSend).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'UNSUPPORTED_REFERRAL_QUERY_FIELD',
          message: 'Unsupported referral query field(s): include_prize_audit',
        },
      });

      const unsafeFieldNameSend = jest.fn();
      const unsafeFieldNameStatus = jest.fn(() => ({ send: unsafeFieldNameSend }));
      await route!.handler(
        {
          query: {
            limit: '25',
            ['include_prize_audit\uFEFF']: 'true',
          },
          log: { error: jest.fn() },
        },
        { status: unsafeFieldNameStatus }
      );

      expect(unsafeFieldNameStatus).toHaveBeenCalledWith(400);
      expect(unsafeFieldNameSend).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_REFERRAL_FIELD_NAME',
          message: 'Referral leaderboard query field names must not include unsafe control characters',
        },
      });

      const invalidSend = jest.fn();
      await route!.handler(
        {
          query: {
            limit: '101',
          },
          log: { error: jest.fn() },
        },
        { status: jest.fn(() => ({ send: invalidSend })) }
      );

      expect(invalidSend).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_REFERRAL_LEADERBOARD_QUERY',
          message: 'Referral leaderboard limit must be between 1 and 100',
        },
      });
      expect(getTopReferrers).not.toHaveBeenCalled();
    } finally {
      getTopReferrers.mockRestore();
    }
  });

  it('redacts visitor IP addresses from affiliate dashboard recent-click responses', async () => {
    const registeredGetRoutes: Array<{ path: string; handler: Function }> = [];
    const getAffiliateDashboard = jest
      .spyOn(AffiliateService.prototype, 'getAffiliateDashboard')
      .mockResolvedValue({
        affiliate: {
          id: 'affiliate-1',
          affiliate_code: 'BLOGGER',
          status: 'approved',
          affiliate_type: 'influencer',
          qr_code_data: 'qr-code-payload',
          social_media_templates: { instagram: 'Share MenuMaker' },
        },
        stats: {
          total_clicks: 1,
          total_signups: 0,
          total_conversions: 0,
          conversion_rate: 0,
          total_gmv: 0,
          total_commission_earned: 0,
          total_commission_paid: 0,
          pending_commission: 0,
        },
        recent_clicks: [
          {
            id: 'click-1',
            ip_address: '203.0.113.42',
            utm_source: 'newsletter',
            converted: false,
            created_at: new Date('2026-06-27T15:05:00.000Z'),
          },
        ],
        recent_payouts: [],
      } as any);
    const fakeFastify = {
      addHook: jest.fn(),
      get: jest.fn((path: string, _options: unknown, handler: Function) => {
        registeredGetRoutes.push({ path, handler });
      }),
      post: jest.fn(),
    };

    try {
      await enhancedReferralRoutes(fakeFastify as any);
      const route = registeredGetRoutes.find((item) => item.path === '/affiliates/dashboard');
      expect(route).toBeDefined();

      const response = await route!.handler(
        {
          user: { id: 'user-1' },
          log: { error: jest.fn() },
        },
        { status: jest.fn() }
      );

      expect(getAffiliateDashboard).toHaveBeenCalledWith('user-1');
      expect(response).toMatchObject({
        success: true,
        data: {
          affiliate: expect.objectContaining({
            id: 'affiliate-1',
            affiliate_code: 'BLOGGER',
          }),
          recent_clicks: [
            expect.objectContaining({
              id: 'click-1',
              utm_source: 'newsletter',
              converted: false,
            }),
          ],
        },
      });
      expect(response.data.recent_clicks[0]).not.toHaveProperty('ip_address');
    } finally {
      getAffiliateDashboard.mockRestore();
    }
  });

  it('rejects unsupported affiliate application body fields before service calls', async () => {
    const registeredPostRoutes: Array<{ path: string; handler: Function }> = [];
    const applyForAffiliate = jest
      .spyOn(AffiliateService.prototype, 'applyForAffiliate')
      .mockRejectedValue(new Error('applyForAffiliate should not be called'));
    const fakeFastify = {
      addHook: jest.fn(),
      get: jest.fn(),
      post: jest.fn((path: string, _options: unknown, handler: Function) => {
        registeredPostRoutes.push({ path, handler });
      }),
    };

    try {
      await enhancedReferralRoutes(fakeFastify as any);
      const route = registeredPostRoutes.find((item) => item.path === '/affiliates/apply');
      expect(route).toBeDefined();

      const send = jest.fn();
      const status = jest.fn(() => ({ send }));
      await route!.handler(
        {
          body: {
            application_message: 'I write about restaurants and want to promote MenuMaker to local operators.',
            instagram_handle: '@foodie',
            payout_method: 'bank_transfer',
          },
          user: { id: 'user-1' },
          log: { error: jest.fn() },
        },
        { status }
      );

      expect(status).toHaveBeenCalledWith(400);
      expect(send).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'UNSUPPORTED_AFFILIATE_APPLICATION_FIELD',
          message: 'Unsupported affiliate application field(s): payout_method',
        },
      });

      const unsafeFieldNameSend = jest.fn();
      const unsafeFieldNameStatus = jest.fn(() => ({ send: unsafeFieldNameSend }));
      await route!.handler(
        {
          body: {
            application_message: 'I write about restaurants and want to promote MenuMaker to local operators.',
            instagram_handle: '@foodie',
            ['payout_method\uFEFF']: 'bank_transfer',
          },
          user: { id: 'user-1' },
          log: { error: jest.fn() },
        },
        { status: unsafeFieldNameStatus }
      );

      expect(unsafeFieldNameStatus).toHaveBeenCalledWith(400);
      expect(unsafeFieldNameSend).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_REFERRAL_FIELD_NAME',
          message: 'Affiliate application request field names must not include unsafe control characters',
        },
      });
      expect(applyForAffiliate).not.toHaveBeenCalled();
    } finally {
      applyForAffiliate.mockRestore();
    }
  });

  it('validates affiliate application route input before service calls and normalizes valid metadata', async () => {
    const registeredPostRoutes: Array<{ path: string; handler: Function }> = [];
    const applyForAffiliate = jest
      .spyOn(AffiliateService.prototype, 'applyForAffiliate')
      .mockResolvedValue({
        id: 'affiliate-1',
        affiliate_code: 'BLOGGER',
        status: 'pending',
        created_at: new Date('2026-06-27T17:45:00.000Z'),
      } as any);
    const fakeFastify = {
      addHook: jest.fn(),
      get: jest.fn(),
      post: jest.fn((path: string, _options: unknown, handler: Function) => {
        registeredPostRoutes.push({ path, handler });
      }),
    };
    const makeReply = () => {
      const send = jest.fn();
      return {
        send,
        status: jest.fn(() => ({ send })),
      };
    };

    try {
      await enhancedReferralRoutes(fakeFastify as any);
      const route = registeredPostRoutes.find((item) => item.path === '/affiliates/apply');
      expect(route).toBeDefined();

      for (const malformedBody of [undefined]) {
        const malformedBodyReply = makeReply();
        await route!.handler(
          {
            body: malformedBody,
            user: { id: 'user-1' },
            log: { error: jest.fn() },
          },
          malformedBodyReply
        );

        expect(malformedBodyReply.status).toHaveBeenCalledWith(400);
        expect(malformedBodyReply.send).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'INVALID_AFFILIATE_APPLICATION',
            message: 'Affiliate application message is required',
          },
        });
      }

      for (const malformedBody of ['application_message=hello', ['application_message']]) {
        const malformedBodyReply = makeReply();
        await route!.handler(
          {
            body: malformedBody,
            user: { id: 'user-1' },
            log: { error: jest.fn() },
          },
          malformedBodyReply
        );

        expect(malformedBodyReply.status).toHaveBeenCalledWith(400);
        expect(malformedBodyReply.send).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'INVALID_REFERRAL_REQUEST_BODY',
            message: 'Referral request body must be an object',
          },
        });
      }

      const blankMessageReply = makeReply();
      await route!.handler(
        {
          body: {
            application_message: '   ',
            instagram_handle: '@foodie',
          },
          user: { id: 'user-1' },
          log: { error: jest.fn() },
        },
        blankMessageReply
      );

      expect(blankMessageReply.status).toHaveBeenCalledWith(400);
      expect(blankMessageReply.send).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_AFFILIATE_APPLICATION',
          message: 'Affiliate application message is required',
        },
      });

      const socialFieldReply = makeReply();
      await route!.handler(
        {
          body: {
            application_message: 'I write about restaurants and want to promote MenuMaker to local operators.',
            instagram_handle: { handle: '@foodie' },
          },
          user: { id: 'user-1' },
          log: { error: jest.fn() },
        },
        socialFieldReply
      );

      expect(socialFieldReply.status).toHaveBeenCalledWith(400);
      expect(socialFieldReply.send).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_AFFILIATE_APPLICATION',
          message: 'Affiliate social profile fields must be strings when provided',
        },
      });

      const audienceReply = makeReply();
      await route!.handler(
        {
          body: {
            application_message: 'I write about restaurants and want to promote MenuMaker to local operators.',
            instagram_followers: -1,
          },
          user: { id: 'user-1' },
          log: { error: jest.fn() },
        },
        audienceReply
      );

      expect(audienceReply.status).toHaveBeenCalledWith(400);
      expect(audienceReply.send).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_AFFILIATE_APPLICATION',
          message: 'Affiliate social audience counts must be non-negative safe integers',
        },
      });

      const unsafeAudienceReply = makeReply();
      await route!.handler(
        {
          body: {
            application_message: 'I write about restaurants and want to promote MenuMaker to local operators.',
            instagram_followers: '1200\uFEFF',
          },
          user: { id: 'user-1' },
          log: { error: jest.fn() },
        },
        unsafeAudienceReply
      );

      expect(unsafeAudienceReply.status).toHaveBeenCalledWith(400);
      expect(unsafeAudienceReply.send).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_REFERRAL_TEXT_FIELD',
          message: 'Affiliate Instagram followers must not include unsafe control characters',
        },
      });

      for (const { body, message } of [
        {
          body: {
            application_message:
              'I write about restaurants and want to promote MenuMaker to local operators.\u202E',
          },
          message: 'Affiliate application message must not include unsafe control characters',
        },
        {
          body: {
            application_message: 'I write about restaurants and want to promote MenuMaker to local operators.',
            instagram_handle: '@foodie\u200B',
          },
          message: 'Affiliate Instagram handle must not include unsafe control characters',
        },
        {
          body: {
            application_message: 'I write about restaurants and want to promote MenuMaker to local operators.',
            youtube_channel: 'menu-maker\u2060channel',
          },
          message: 'Affiliate YouTube channel must not include unsafe control characters',
        },
      ]) {
        const unsafeReply = makeReply();
        await route!.handler(
          {
            body,
            user: { id: 'user-1' },
            log: { error: jest.fn() },
          },
          unsafeReply
        );

        expect(unsafeReply.status).toHaveBeenCalledWith(400);
        expect(unsafeReply.send).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'INVALID_REFERRAL_TEXT_FIELD',
            message,
          },
        });
      }

      for (const { body, message } of [
        {
          body: {
            application_message: 'I promote local menus.',
          },
          message: 'Affiliate application message must be between 50 and 1000 characters',
        },
        {
          body: {
            application_message: 'I'.repeat(1001),
          },
          message: 'Affiliate application message must be between 50 and 1000 characters',
        },
        {
          body: {
            application_message: 'I write about restaurants and want to promote MenuMaker to local operators.',
            instagram_handle: `@${'foodie'.repeat(52)}`,
          },
          message: 'Affiliate Instagram handle must be at most 255 characters',
        },
        {
          body: {
            application_message: 'I write about restaurants and want to promote MenuMaker to local operators.',
            youtube_channel: 'menu-maker-channel'.repeat(16),
          },
          message: 'Affiliate YouTube channel must be at most 255 characters',
        },
      ]) {
        const boundsReply = makeReply();
        await route!.handler(
          {
            body,
            user: { id: 'user-1' },
            log: { error: jest.fn() },
          },
          boundsReply
        );

        expect(boundsReply.status).toHaveBeenCalledWith(400);
        expect(boundsReply.send).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'INVALID_AFFILIATE_APPLICATION',
            message,
          },
        });
      }

      expect(applyForAffiliate).not.toHaveBeenCalled();

      const validReply = makeReply();
      const response = await route!.handler(
        {
          body: {
            application_message:
              '  I write about restaurants and want to promote MenuMaker to local operators.  ',
            instagram_handle: '  @foodie  ',
            instagram_followers: '1200',
            youtube_channel: '   ',
            youtube_subscribers: 0,
          },
          user: { id: ' user-1 ' },
          log: { error: jest.fn() },
        },
        validReply
      );

      expect(applyForAffiliate).toHaveBeenCalledWith('user-1', {
        application_message: 'I write about restaurants and want to promote MenuMaker to local operators.',
        instagram_handle: '@foodie',
        instagram_followers: 1200,
        youtube_subscribers: 0,
      });
      expect(response).toMatchObject({
        success: true,
        data: {
          affiliate: {
            id: 'affiliate-1',
            affiliate_code: 'BLOGGER',
            status: 'pending',
          },
        },
      });
    } finally {
      applyForAffiliate.mockRestore();
    }
  });

  it('rejects unsupported enhanced-referral body fields before service calls', async () => {
    const registeredPostRoutes: Array<{ path: string; handler: Function }> = [];
    const createCustomerReferral = jest
      .spyOn(ViralService.prototype, 'createCustomerReferral')
      .mockRejectedValue(new Error('createCustomerReferral should not be called'));
    const generateInstagramStoryShare = jest
      .spyOn(ViralService.prototype, 'generateInstagramStoryShare')
      .mockImplementation(() => {
        throw new Error('generateInstagramStoryShare should not be called');
      });
    const generateWhatsAppShare = jest
      .spyOn(ViralService.prototype, 'generateWhatsAppShare')
      .mockImplementation(() => {
        throw new Error('generateWhatsAppShare should not be called');
      });
    const fakeFastify = {
      addHook: jest.fn(),
      get: jest.fn(),
      post: jest.fn((path: string, _options: unknown, handler: Function) => {
        registeredPostRoutes.push({ path, handler });
      }),
    };

    try {
      await enhancedReferralRoutes(fakeFastify as any);
      const createRoute = registeredPostRoutes.find((item) => item.path === '/customers/referrals/create');
      const instagramRoute = registeredPostRoutes.find((item) => item.path === '/referrals/share/instagram');
      const whatsappRoute = registeredPostRoutes.find((item) => item.path === '/referrals/share/whatsapp');
      expect(createRoute).toBeDefined();
      expect(instagramRoute).toBeDefined();
      expect(whatsappRoute).toBeDefined();

      const createSend = jest.fn();
      await createRoute!.handler(
        {
          body: {
            business_id: 'business-1',
            reward_override_cents: 5000,
          },
          user: { id: 'user-1' },
          log: { error: jest.fn() },
        },
        { status: jest.fn(() => ({ send: createSend })) }
      );

      expect(createSend).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'UNSUPPORTED_REFERRAL_FIELD',
          message: 'Unsupported referral request field(s): reward_override_cents',
        },
      });

      const instagramSend = jest.fn();
      await instagramRoute!.handler(
        {
          body: {
            referral_code: 'BLOGGER',
            business_name: 'Cafe One',
            menu_preview_url: 'https://example.com/menu',
            template_override: 'vip',
          },
          user: { id: 'user-1' },
          log: { error: jest.fn() },
        },
        { status: jest.fn(() => ({ send: instagramSend })) }
      );

      expect(instagramSend).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'UNSUPPORTED_REFERRAL_FIELD',
          message: 'Unsupported referral request field(s): template_override',
        },
      });

      const whatsappSend = jest.fn();
      await whatsappRoute!.handler(
        {
          body: {
            referral_code: 'BLOGGER',
            business_name: 'Cafe One',
            force_conversion: true,
          },
          user: { id: 'user-1' },
          log: { error: jest.fn() },
        },
        { status: jest.fn(() => ({ send: whatsappSend })) }
      );

      expect(whatsappSend).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'UNSUPPORTED_REFERRAL_FIELD',
          message: 'Unsupported referral request field(s): force_conversion',
        },
      });

      for (const { route, body, message } of [
        {
          route: createRoute!,
          body: {
            business_id: 'business-1',
            ['reward_override_cents\uFEFF']: 5000,
          },
          message: 'Customer referral request field names must not include unsafe control characters',
        },
        {
          route: instagramRoute!,
          body: {
            referral_code: 'BLOGGER',
            business_name: 'Cafe One',
            menu_preview_url: 'https://example.com/menu',
            ['template_override\uFEFF']: 'vip',
          },
          message: 'Instagram share request field names must not include unsafe control characters',
        },
        {
          route: whatsappRoute!,
          body: {
            referral_code: 'BLOGGER',
            business_name: 'Cafe One',
            ['force_conversion\uFEFF']: true,
          },
          message: 'WhatsApp share request field names must not include unsafe control characters',
        },
      ]) {
        const unsafeFieldNameSend = jest.fn();
        const unsafeFieldNameStatus = jest.fn(() => ({ send: unsafeFieldNameSend }));
        await route.handler(
          {
            body,
            user: { id: 'user-1' },
            log: { error: jest.fn() },
          },
          { status: unsafeFieldNameStatus }
        );

        expect(unsafeFieldNameStatus).toHaveBeenCalledWith(400);
        expect(unsafeFieldNameSend).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'INVALID_REFERRAL_FIELD_NAME',
            message,
          },
        });
      }
      expect(createCustomerReferral).not.toHaveBeenCalled();
      expect(generateInstagramStoryShare).not.toHaveBeenCalled();
      expect(generateWhatsAppShare).not.toHaveBeenCalled();
    } finally {
      createCustomerReferral.mockRestore();
      generateInstagramStoryShare.mockRestore();
      generateWhatsAppShare.mockRestore();
    }
  });

  it('rejects enhanced-referral social share query input before service calls', async () => {
    const registeredPostRoutes: Array<{ path: string; handler: Function }> = [];
    const generateInstagramStoryShare = jest
      .spyOn(ViralService.prototype, 'generateInstagramStoryShare')
      .mockImplementation(() => {
        throw new Error('generateInstagramStoryShare should not be called');
      });
    const generateWhatsAppShare = jest
      .spyOn(ViralService.prototype, 'generateWhatsAppShare')
      .mockImplementation(() => {
        throw new Error('generateWhatsAppShare should not be called');
      });
    const fakeFastify = {
      addHook: jest.fn(),
      get: jest.fn(),
      post: jest.fn((path: string, _options: unknown, handler: Function) => {
        registeredPostRoutes.push({ path, handler });
      }),
    };

    try {
      await enhancedReferralRoutes(fakeFastify as any);
      const instagramRoute = registeredPostRoutes.find((item) => item.path === '/referrals/share/instagram');
      const whatsappRoute = registeredPostRoutes.find((item) => item.path === '/referrals/share/whatsapp');
      expect(instagramRoute).toBeDefined();
      expect(whatsappRoute).toBeDefined();

      for (const { route, query } of [
        { route: instagramRoute!, query: 'template_override=vip' },
        { route: whatsappRoute!, query: ['force_conversion=true'] },
      ]) {
        const send = jest.fn();
        const status = jest.fn(() => ({ send }));
        await route.handler(
          {
            query,
            body: {
              referral_code: 'BLOGGER',
              business_name: 'Cafe One',
            },
            user: { id: 'user-1' },
            log: { error: jest.fn() },
          },
          { status }
        );

        expect(status).toHaveBeenCalledWith(400);
        expect(send).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'INVALID_REFERRAL_QUERY',
            message: 'Referral query must be an object',
          },
        });
      }

      for (const { route, query, message } of [
        {
          route: instagramRoute!,
          query: { template_override: 'vip' },
          message: 'Unsupported referral query field(s): template_override',
        },
        {
          route: whatsappRoute!,
          query: { force_conversion: 'true' },
          message: 'Unsupported referral query field(s): force_conversion',
        },
      ]) {
        const send = jest.fn();
        const status = jest.fn(() => ({ send }));
        await route.handler(
          {
            query,
            body: {
              referral_code: 'BLOGGER',
              business_name: 'Cafe One',
            },
            user: { id: 'user-1' },
            log: { error: jest.fn() },
          },
          { status }
        );

        expect(status).toHaveBeenCalledWith(400);
        expect(send).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'UNSUPPORTED_REFERRAL_QUERY_FIELD',
            message,
          },
        });
      }

      for (const { route, query } of [
        { route: instagramRoute!, query: { ['template_override\uFEFF']: 'vip' } },
        { route: whatsappRoute!, query: { ['force_conversion\uFEFF']: 'true' } },
      ]) {
        const send = jest.fn();
        const status = jest.fn(() => ({ send }));
        await route.handler(
          {
            query,
            body: {
              referral_code: 'BLOGGER',
              business_name: 'Cafe One',
            },
            user: { id: 'user-1' },
            log: { error: jest.fn() },
          },
          { status }
        );

        expect(status).toHaveBeenCalledWith(400);
        expect(send).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'INVALID_REFERRAL_FIELD_NAME',
            message: 'Referral query field names must not include unsafe control characters',
          },
        });
      }

      expect(generateInstagramStoryShare).not.toHaveBeenCalled();
      expect(generateWhatsAppShare).not.toHaveBeenCalled();
    } finally {
      generateInstagramStoryShare.mockRestore();
      generateWhatsAppShare.mockRestore();
    }
  });

  it('rejects invalid enhanced-referral route input before service calls', async () => {
    const registeredPostRoutes: Array<{ path: string; handler: Function }> = [];
    const createCustomerReferral = jest
      .spyOn(ViralService.prototype, 'createCustomerReferral')
      .mockRejectedValue(new Error('createCustomerReferral should not be called'));
    const generateInstagramStoryShare = jest
      .spyOn(ViralService.prototype, 'generateInstagramStoryShare')
      .mockImplementation(() => {
        throw new Error('generateInstagramStoryShare should not be called');
      });
    const generateWhatsAppShare = jest
      .spyOn(ViralService.prototype, 'generateWhatsAppShare')
      .mockImplementation(() => {
        throw new Error('generateWhatsAppShare should not be called');
      });
    const fakeFastify = {
      addHook: jest.fn(),
      get: jest.fn(),
      post: jest.fn((path: string, _options: unknown, handler: Function) => {
        registeredPostRoutes.push({ path, handler });
      }),
    };

    try {
      await enhancedReferralRoutes(fakeFastify as any);
      const createRoute = registeredPostRoutes.find((item) => item.path === '/customers/referrals/create');
      const instagramRoute = registeredPostRoutes.find((item) => item.path === '/referrals/share/instagram');
      const whatsappRoute = registeredPostRoutes.find((item) => item.path === '/referrals/share/whatsapp');
      expect(createRoute).toBeDefined();
      expect(instagramRoute).toBeDefined();
      expect(whatsappRoute).toBeDefined();

      for (const { route, request, expected } of [
        {
          route: instagramRoute!,
          request: {
            body: { referral_code: 'BLOGGER', business_name: 'Cafe One' },
            log: { error: jest.fn() },
          },
          expected: {
            code: 'INVALID_REFERRAL_USER',
            message: 'Authenticated user ID is required',
          },
        },
        {
          route: whatsappRoute!,
          request: {
            body: { referral_code: 'BLOGGER', business_name: 'Cafe One' },
            user: { userId: 'user-\u202E1' },
            log: { error: jest.fn() },
          },
          expected: {
            code: 'INVALID_REFERRAL_TEXT_FIELD',
            message: 'Referral user ID must not include unsafe control characters',
          },
        },
        {
          route: instagramRoute!,
          request: {
            body: { referral_code: 'BLOGGER', business_name: 'Cafe One' },
            user: { id: 'u'.repeat(256) },
            log: { error: jest.fn() },
          },
          expected: {
            code: 'INVALID_REFERRAL_TEXT_FIELD',
            message: 'Referral user ID must be at most 255 characters',
          },
        },
      ]) {
        const send = jest.fn();
        const status = jest.fn(() => ({ send }));
        await route.handler(request, { status });
        expect(status).toHaveBeenCalledWith(400);
        expect(send).toHaveBeenCalledWith({
          success: false,
          error: expected,
        });
      }

      for (const malformedBody of [undefined]) {
        const createMalformedSend = jest.fn();
        const createMalformedStatus = jest.fn(() => ({ send: createMalformedSend }));
        await createRoute!.handler(
          {
            body: malformedBody,
            user: { id: 'user-1' },
            log: { error: jest.fn() },
          },
          { status: createMalformedStatus }
        );

        expect(createMalformedStatus).toHaveBeenCalledWith(400);
        expect(createMalformedSend).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'INVALID_REFERRAL_REQUEST',
            message: 'Business ID is required',
          },
        });
      }

      for (const malformedBody of ['business_id=business-1', ['business_id']]) {
        const createMalformedSend = jest.fn();
        const createMalformedStatus = jest.fn(() => ({ send: createMalformedSend }));
        await createRoute!.handler(
          {
            body: malformedBody,
            user: { id: 'user-1' },
            log: { error: jest.fn() },
          },
          { status: createMalformedStatus }
        );

        expect(createMalformedStatus).toHaveBeenCalledWith(400);
        expect(createMalformedSend).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'INVALID_REFERRAL_REQUEST_BODY',
            message: 'Referral request body must be an object',
          },
        });
      }

      for (const malformedBody of [undefined]) {
        const instagramMalformedSend = jest.fn();
        const instagramMalformedStatus = jest.fn(() => ({ send: instagramMalformedSend }));
        await instagramRoute!.handler(
          {
            body: malformedBody,
            user: { id: 'user-1' },
            log: { error: jest.fn() },
          },
          { status: instagramMalformedStatus }
        );

        expect(instagramMalformedStatus).toHaveBeenCalledWith(400);
        expect(instagramMalformedSend).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'INVALID_REFERRAL_SHARE_REQUEST',
            message: 'Referral code and business name are required',
          },
        });

        const whatsappMalformedSend = jest.fn();
        const whatsappMalformedStatus = jest.fn(() => ({ send: whatsappMalformedSend }));
        await whatsappRoute!.handler(
          {
            body: malformedBody,
            user: { id: 'user-1' },
            log: { error: jest.fn() },
          },
          { status: whatsappMalformedStatus }
        );

        expect(whatsappMalformedStatus).toHaveBeenCalledWith(400);
        expect(whatsappMalformedSend).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'INVALID_REFERRAL_SHARE_REQUEST',
            message: 'Referral code and business name are required',
          },
        });
      }

      for (const malformedBody of ['referral_code=BLOGGER', ['referral_code']]) {
        const instagramMalformedSend = jest.fn();
        const instagramMalformedStatus = jest.fn(() => ({ send: instagramMalformedSend }));
        await instagramRoute!.handler(
          {
            body: malformedBody,
            user: { id: 'user-1' },
            log: { error: jest.fn() },
          },
          { status: instagramMalformedStatus }
        );

        expect(instagramMalformedStatus).toHaveBeenCalledWith(400);
        expect(instagramMalformedSend).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'INVALID_REFERRAL_REQUEST_BODY',
            message: 'Referral request body must be an object',
          },
        });

        const whatsappMalformedSend = jest.fn();
        const whatsappMalformedStatus = jest.fn(() => ({ send: whatsappMalformedSend }));
        await whatsappRoute!.handler(
          {
            body: malformedBody,
            user: { id: 'user-1' },
            log: { error: jest.fn() },
          },
          { status: whatsappMalformedStatus }
        );

        expect(whatsappMalformedStatus).toHaveBeenCalledWith(400);
        expect(whatsappMalformedSend).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'INVALID_REFERRAL_REQUEST_BODY',
            message: 'Referral request body must be an object',
          },
        });
      }

      const createSend = jest.fn();
      const createStatus = jest.fn(() => ({ send: createSend }));
      await createRoute!.handler(
        {
          body: { business_id: '   ' },
          user: { id: 'user-1' },
          log: { error: jest.fn() },
        },
        { status: createStatus }
      );

      expect(createStatus).toHaveBeenCalledWith(400);
      expect(createSend).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_REFERRAL_REQUEST',
          message: 'Business ID is required',
        },
      });

      const unsafeBusinessSend = jest.fn();
      const unsafeBusinessStatus = jest.fn(() => ({ send: unsafeBusinessSend }));
      await createRoute!.handler(
        {
          body: { business_id: 'business-\u202E1' },
          user: { id: 'user-1' },
          log: { error: jest.fn() },
        },
        { status: unsafeBusinessStatus }
      );

      expect(unsafeBusinessStatus).toHaveBeenCalledWith(400);
      expect(unsafeBusinessSend).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_REFERRAL_TEXT_FIELD',
          message: 'Referral business ID must not include unsafe control characters',
        },
      });

      const oversizedBusinessSend = jest.fn();
      const oversizedBusinessStatus = jest.fn(() => ({ send: oversizedBusinessSend }));
      await createRoute!.handler(
        {
          body: { business_id: 'b'.repeat(256) },
          user: { id: 'user-1' },
          log: { error: jest.fn() },
        },
        { status: oversizedBusinessStatus }
      );

      expect(oversizedBusinessStatus).toHaveBeenCalledWith(400);
      expect(oversizedBusinessSend).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_REFERRAL_TEXT_FIELD',
          message: 'Referral business ID must be at most 255 characters',
        },
      });

      const instagramBlankSend = jest.fn();
      const instagramBlankStatus = jest.fn(() => ({ send: instagramBlankSend }));
      await instagramRoute!.handler(
        {
          body: {
            referral_code: '   ',
            business_name: 'Cafe One',
          },
          user: { id: 'user-1' },
          log: { error: jest.fn() },
        },
        { status: instagramBlankStatus }
      );

      expect(instagramBlankStatus).toHaveBeenCalledWith(400);
      expect(instagramBlankSend).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_REFERRAL_SHARE_REQUEST',
          message: 'Referral code and business name are required',
        },
      });

      const instagramUrlSend = jest.fn();
      const instagramUrlStatus = jest.fn(() => ({ send: instagramUrlSend }));
      await instagramRoute!.handler(
        {
          body: {
            referral_code: 'BLOGGER',
            business_name: 'Cafe One',
            menu_preview_url: 'javascript:alert(1)',
          },
          user: { id: 'user-1' },
          log: { error: jest.fn() },
        },
        { status: instagramUrlStatus }
      );

      expect(instagramUrlStatus).toHaveBeenCalledWith(400);
      expect(instagramUrlSend).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_REFERRAL_SHARE_REQUEST',
          message: 'Menu preview URL must be an absolute HTTP(S) URL without embedded credentials and at most 2048 characters',
        },
      });

      for (const { route, body, message } of [
        {
          route: instagramRoute!,
          body: {
            referral_code: 'B'.repeat(129),
            business_name: 'Cafe One',
          },
          message: 'Referral code must be at most 128 characters',
        },
        {
          route: instagramRoute!,
          body: {
            referral_code: 'BLOGGER',
            business_name: 'C'.repeat(161),
          },
          message: 'Referral share business name must be at most 160 characters',
        },
        {
          route: instagramRoute!,
          body: {
            referral_code: 'BLOGGER',
            business_name: 'Cafe One',
            menu_preview_url: 'https://cdn:secret@example.com/menu',
          },
          message: 'Menu preview URL must be an absolute HTTP(S) URL without embedded credentials and at most 2048 characters',
        },
        {
          route: instagramRoute!,
          body: {
            referral_code: 'BLOGGER',
            business_name: 'Cafe One',
            menu_preview_url: `https://example.com/${'m'.repeat(2049)}`,
          },
          message: 'Menu preview URL must be an absolute HTTP(S) URL without embedded credentials and at most 2048 characters',
        },
        {
          route: whatsappRoute!,
          body: {
            referral_code: 'B'.repeat(129),
            business_name: 'Cafe One',
          },
          message: 'Referral code must be at most 128 characters',
        },
        {
          route: whatsappRoute!,
          body: {
            referral_code: 'BLOGGER',
            business_name: 'C'.repeat(161),
          },
          message: 'Referral share business name must be at most 160 characters',
        },
      ]) {
        const boundedShareSend = jest.fn();
        const boundedShareStatus = jest.fn(() => ({ send: boundedShareSend }));
        await route.handler(
          {
            body,
            user: { id: 'user-1' },
            log: { error: jest.fn() },
          },
          { status: boundedShareStatus }
        );

        expect(boundedShareStatus).toHaveBeenCalledWith(400);
        expect(boundedShareSend).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'INVALID_REFERRAL_SHARE_REQUEST',
            message,
          },
        });
      }

      for (const { body, message } of [
        {
          body: {
            referral_code: 'BLOG\u202EGER',
            business_name: 'Cafe One',
          },
          message: 'Referral share code must not include unsafe control characters',
        },
        {
          body: {
            referral_code: 'BLOGGER',
            business_name: 'Cafe\u200B One',
          },
          message: 'Referral share business name must not include unsafe control characters',
        },
        {
          body: {
            referral_code: 'BLOGGER',
            business_name: 'Cafe One',
            menu_preview_url: 'https://example.com/menu\u2060',
          },
          message: 'Referral share menu preview URL must not include unsafe control characters',
        },
      ]) {
        const unsafeShareSend = jest.fn();
        const unsafeShareStatus = jest.fn(() => ({ send: unsafeShareSend }));
        await instagramRoute!.handler(
          {
            body,
            user: { id: 'user-1' },
            log: { error: jest.fn() },
          },
          { status: unsafeShareStatus }
        );

        expect(unsafeShareStatus).toHaveBeenCalledWith(400);
        expect(unsafeShareSend).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'INVALID_REFERRAL_TEXT_FIELD',
            message,
          },
        });
      }

      const whatsappSend = jest.fn();
      const whatsappStatus = jest.fn(() => ({ send: whatsappSend }));
      await whatsappRoute!.handler(
        {
          body: {
            referral_code: 'BLOGGER',
            business_name: '   ',
          },
          user: { id: 'user-1' },
          log: { error: jest.fn() },
        },
        { status: whatsappStatus }
      );

      expect(whatsappStatus).toHaveBeenCalledWith(400);
      expect(whatsappSend).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_REFERRAL_SHARE_REQUEST',
          message: 'Referral code and business name are required',
        },
      });

      const unsafeWhatsappSend = jest.fn();
      const unsafeWhatsappStatus = jest.fn(() => ({ send: unsafeWhatsappSend }));
      await whatsappRoute!.handler(
        {
          body: {
            referral_code: 'BLOGGER',
            business_name: 'Cafe\u202E One',
          },
          user: { id: 'user-1' },
          log: { error: jest.fn() },
        },
        { status: unsafeWhatsappStatus }
      );

      expect(unsafeWhatsappStatus).toHaveBeenCalledWith(400);
      expect(unsafeWhatsappSend).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_REFERRAL_TEXT_FIELD',
          message: 'Referral share business name must not include unsafe control characters',
        },
      });
      expect(createCustomerReferral).not.toHaveBeenCalled();
      expect(generateInstagramStoryShare).not.toHaveBeenCalled();
      expect(generateWhatsAppShare).not.toHaveBeenCalled();
    } finally {
      createCustomerReferral.mockRestore();
      generateInstagramStoryShare.mockRestore();
      generateWhatsAppShare.mockRestore();
    }
  });

  it('rejects blank enhanced-referral user IDs before service calls and normalizes valid IDs', async () => {
    const registeredGetRoutes: Array<{ path: string; handler: Function }> = [];
    const registeredPostRoutes: Array<{ path: string; handler: Function }> = [];
    const createCustomerReferral = jest
      .spyOn(ViralService.prototype, 'createCustomerReferral')
      .mockResolvedValue({
        id: 'referral-1',
        referral_code: 'USER1',
        business_id: 'business-1',
      } as any);
    const getCustomerReferralStats = jest
      .spyOn(ViralService.prototype, 'getCustomerReferralStats')
      .mockResolvedValue({ successful_referrals: 0 } as any);
    const getUserPosition = jest
      .spyOn(LeaderboardService.prototype, 'getUserPosition')
      .mockResolvedValue({ rank: 1 } as any);
    const applyForAffiliate = jest
      .spyOn(AffiliateService.prototype, 'applyForAffiliate')
      .mockResolvedValue({
        id: 'affiliate-1',
        affiliate_code: 'BLOGGER',
        status: 'pending',
        created_at: new Date('2026-06-27T16:00:00.000Z'),
      } as any);
    const getAffiliateDashboard = jest
      .spyOn(AffiliateService.prototype, 'getAffiliateDashboard')
      .mockResolvedValue({
        affiliate: {
          id: 'affiliate-1',
          affiliate_code: 'BLOGGER',
          status: 'approved',
          affiliate_type: 'influencer',
          qr_code_data: 'qr-code-payload',
          social_media_templates: {},
        },
        stats: {},
        recent_clicks: [],
        recent_payouts: [],
      } as any);
    const getUserBadges = jest
      .spyOn(ViralService.prototype, 'getUserBadges')
      .mockResolvedValue([]);
    const checkAndAwardBadges = jest
      .spyOn(ViralService.prototype, 'checkAndAwardBadges')
      .mockResolvedValue([]);
    const fakeFastify = {
      addHook: jest.fn(),
      get: jest.fn((path: string, _options: unknown, handler: Function) => {
        registeredGetRoutes.push({ path, handler });
      }),
      post: jest.fn((path: string, _options: unknown, handler: Function) => {
        registeredPostRoutes.push({ path, handler });
      }),
    };
    const makeReply = () => {
      const send = jest.fn();
      return {
        send,
        status: jest.fn(() => ({ send })),
      };
    };

    try {
      await enhancedReferralRoutes(fakeFastify as any);
      const createRoute = registeredPostRoutes.find((item) => item.path === '/customers/referrals/create');
      const statsRoute = registeredGetRoutes.find((item) => item.path === '/customers/referrals/stats');
      const positionRoute = registeredGetRoutes.find((item) => item.path === '/referrals/leaderboard/me');
      const applyRoute = registeredPostRoutes.find((item) => item.path === '/affiliates/apply');
      const dashboardRoute = registeredGetRoutes.find((item) => item.path === '/affiliates/dashboard');
      const badgesRoute = registeredGetRoutes.find((item) => item.path === '/badges/me');
      const checkBadgesRoute = registeredPostRoutes.find((item) => item.path === '/badges/check');
      expect(createRoute).toBeDefined();
      expect(statsRoute).toBeDefined();
      expect(positionRoute).toBeDefined();
      expect(applyRoute).toBeDefined();
      expect(dashboardRoute).toBeDefined();
      expect(badgesRoute).toBeDefined();
      expect(checkBadgesRoute).toBeDefined();

      for (const { route, query } of [
        { route: statsRoute!, query: 'includeRewards=true' },
        { route: positionRoute!, query: ['includePrize'] },
        { route: applyRoute!, query: 'payoutOverride=manual' },
        { route: dashboardRoute!, query: 'includeIpAddresses=true' },
        { route: badgesRoute!, query: ['includeHidden'] },
      ]) {
        const reply = makeReply();
        await route.handler(
          {
            query,
            body: {
              application_message: 'I write about restaurants and want to promote MenuMaker to local operators.',
            },
            user: { userId: 'user-1' },
            log: { error: jest.fn() },
          },
          reply
        );

        expect(reply.status).toHaveBeenCalledWith(400);
        expect(reply.send).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'INVALID_REFERRAL_QUERY',
            message: 'Referral query must be an object',
          },
        });
      }

      for (const { route, query, message } of [
        {
          route: statsRoute!,
          query: { include_rewards: 'true' },
          message: 'Unsupported referral query field(s): include_rewards',
        },
        {
          route: positionRoute!,
          query: { include_prize_audit: 'true' },
          message: 'Unsupported referral query field(s): include_prize_audit',
        },
        {
          route: applyRoute!,
          query: { payout_override: 'manual' },
          message: 'Unsupported referral query field(s): payout_override',
        },
        {
          route: dashboardRoute!,
          query: { include_ip_addresses: 'true' },
          message: 'Unsupported referral query field(s): include_ip_addresses',
        },
        {
          route: badgesRoute!,
          query: { include_hidden: 'true' },
          message: 'Unsupported referral query field(s): include_hidden',
        },
      ]) {
        const reply = makeReply();
        await route.handler(
          {
            query,
            body: {
              application_message: 'I write about restaurants and want to promote MenuMaker to local operators.',
            },
            user: { userId: 'user-1' },
            log: { error: jest.fn() },
          },
          reply
        );

        expect(reply.status).toHaveBeenCalledWith(400);
        expect(reply.send).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'UNSUPPORTED_REFERRAL_QUERY_FIELD',
            message,
          },
        });
      }

      for (const { route, query } of [
        { route: statsRoute!, query: { ['include_rewards\uFEFF']: 'true' } },
        { route: positionRoute!, query: { ['include_prize_audit\uFEFF']: 'true' } },
        { route: applyRoute!, query: { ['payout_override\uFEFF']: 'manual' } },
        { route: dashboardRoute!, query: { ['include_ip_addresses\uFEFF']: 'true' } },
        { route: badgesRoute!, query: { ['include_hidden\uFEFF']: 'true' } },
      ]) {
        const reply = makeReply();
        await route.handler(
          {
            query,
            body: {
              application_message: 'I write about restaurants and want to promote MenuMaker to local operators.',
            },
            user: { userId: 'user-1' },
            log: { error: jest.fn() },
          },
          reply
        );

        expect(reply.status).toHaveBeenCalledWith(400);
        expect(reply.send).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'INVALID_REFERRAL_FIELD_NAME',
            message: 'Referral query field names must not include unsafe control characters',
          },
        });
      }

      expect(getCustomerReferralStats).not.toHaveBeenCalled();
      expect(getUserPosition).not.toHaveBeenCalled();
      expect(applyForAffiliate).not.toHaveBeenCalled();
      expect(getAffiliateDashboard).not.toHaveBeenCalled();
      expect(getUserBadges).not.toHaveBeenCalled();

      for (const { request, expected } of [
        {
          request: {
            query: 'forceRecheck=true',
            user: { userId: 'user-1' },
            log: { error: jest.fn() },
          },
          expected: {
            code: 'INVALID_REFERRAL_QUERY',
            message: 'Referral query must be an object',
          },
        },
        {
          request: {
            query: ['forceRecheck=true'],
            user: { userId: 'user-1' },
            log: { error: jest.fn() },
          },
          expected: {
            code: 'INVALID_REFERRAL_QUERY',
            message: 'Referral query must be an object',
          },
        },
        {
          request: {
            query: { force_recheck: 'true' },
            user: { userId: 'user-1' },
            log: { error: jest.fn() },
          },
          expected: {
            code: 'UNSUPPORTED_REFERRAL_QUERY_FIELD',
            message: 'Unsupported referral query field(s): force_recheck',
          },
        },
      ]) {
        const reply = makeReply();
        await checkBadgesRoute!.handler(request, reply);
        expect(reply.status).toHaveBeenCalledWith(400);
        expect(reply.send).toHaveBeenCalledWith({
          success: false,
          error: expected,
        });
      }

      for (const { request, expected } of [
        {
          request: {
            body: 'forceRecheck=true',
            user: { userId: 'user-1' },
            log: { error: jest.fn() },
          },
          expected: {
            code: 'INVALID_REFERRAL_REQUEST_BODY',
            message: 'Referral request body must be an object',
          },
        },
        {
          request: {
            body: ['forceRecheck'],
            user: { userId: 'user-1' },
            log: { error: jest.fn() },
          },
          expected: {
            code: 'INVALID_REFERRAL_REQUEST_BODY',
            message: 'Referral request body must be an object',
          },
        },
        {
          request: {
            body: { force_recheck: true },
            user: { userId: 'user-1' },
            log: { error: jest.fn() },
          },
          expected: {
            code: 'UNSUPPORTED_REFERRAL_FIELD',
            message: 'Unsupported referral request field(s): force_recheck',
          },
        },
      ]) {
        const reply = makeReply();
        await checkBadgesRoute!.handler(request, reply);
        expect(reply.status).toHaveBeenCalledWith(400);
        expect(reply.send).toHaveBeenCalledWith({
          success: false,
          error: expected,
        });
      }

      const unsafeBadgeBodyReply = makeReply();
      await checkBadgesRoute!.handler(
        {
          body: { ['force_recheck\uFEFF']: true },
          user: { userId: 'user-1' },
          log: { error: jest.fn() },
        },
        unsafeBadgeBodyReply
      );
      expect(unsafeBadgeBodyReply.status).toHaveBeenCalledWith(400);
      expect(unsafeBadgeBodyReply.send).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_REFERRAL_FIELD_NAME',
          message: 'Badge check request field names must not include unsafe control characters',
        },
      });

      expect(checkAndAwardBadges).not.toHaveBeenCalled();

      for (const { handler, request } of [
        {
          handler: createRoute!.handler,
          request: {
            body: { business_id: 'business-1' },
            user: { userId: '   ' },
            log: { error: jest.fn() },
          },
        },
        {
          handler: statsRoute!.handler,
          request: { user: { userId: '   ' }, log: { error: jest.fn() } },
        },
        {
          handler: positionRoute!.handler,
          request: { user: { userId: '   ' }, log: { error: jest.fn() } },
        },
        {
          handler: applyRoute!.handler,
          request: {
            body: {
              application_message: 'I write about restaurants and want to promote MenuMaker to local operators.',
            },
            user: { userId: '   ' },
            log: { error: jest.fn() },
          },
        },
        {
          handler: dashboardRoute!.handler,
          request: { user: { userId: '   ' }, log: { error: jest.fn() } },
        },
        {
          handler: badgesRoute!.handler,
          request: { user: { userId: '   ' }, log: { error: jest.fn() } },
        },
        {
          handler: checkBadgesRoute!.handler,
          request: { user: { userId: '   ' }, log: { error: jest.fn() } },
        },
      ]) {
        const reply = makeReply();
        await handler(request, reply);
        expect(reply.status).toHaveBeenCalledWith(400);
        expect(reply.send).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'INVALID_REFERRAL_USER',
            message: 'Authenticated user ID is required',
          },
        });
      }

      for (const { handler, request } of [
        {
          handler: createRoute!.handler,
          request: {
            body: { business_id: 'business-1' },
            user: { userId: 'user-\u202E1' },
            log: { error: jest.fn() },
          },
        },
        {
          handler: statsRoute!.handler,
          request: { user: { userId: 'user-\u200B1' }, log: { error: jest.fn() } },
        },
        {
          handler: positionRoute!.handler,
          request: { user: { userId: 'user-\u20601' }, log: { error: jest.fn() } },
        },
        {
          handler: applyRoute!.handler,
          request: {
            body: {
              application_message: 'I write about restaurants and want to promote MenuMaker to local operators.',
            },
            user: { userId: 'user-\u202A1' },
            log: { error: jest.fn() },
          },
        },
        {
          handler: dashboardRoute!.handler,
          request: { user: { userId: 'user-\u202B1' }, log: { error: jest.fn() } },
        },
        {
          handler: badgesRoute!.handler,
          request: { user: { userId: 'user-\u202C1' }, log: { error: jest.fn() } },
        },
        {
          handler: checkBadgesRoute!.handler,
          request: { user: { userId: 'user-\u202D1' }, log: { error: jest.fn() } },
        },
      ]) {
        const reply = makeReply();
        await handler(request, reply);
        expect(reply.status).toHaveBeenCalledWith(400);
        expect(reply.send).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'INVALID_REFERRAL_TEXT_FIELD',
            message: 'Referral user ID must not include unsafe control characters',
          },
        });
      }

      for (const { handler, request } of [
        {
          handler: createRoute!.handler,
          request: {
            body: { business_id: 'business-1' },
            user: { userId: 'u'.repeat(256) },
            log: { error: jest.fn() },
          },
        },
        {
          handler: statsRoute!.handler,
          request: { user: { userId: 'u'.repeat(256) }, log: { error: jest.fn() } },
        },
        {
          handler: positionRoute!.handler,
          request: { user: { userId: 'u'.repeat(256) }, log: { error: jest.fn() } },
        },
        {
          handler: applyRoute!.handler,
          request: {
            body: {
              application_message: 'I write about restaurants and want to promote MenuMaker to local operators.',
            },
            user: { userId: 'u'.repeat(256) },
            log: { error: jest.fn() },
          },
        },
        {
          handler: dashboardRoute!.handler,
          request: { user: { userId: 'u'.repeat(256) }, log: { error: jest.fn() } },
        },
        {
          handler: badgesRoute!.handler,
          request: { user: { userId: 'u'.repeat(256) }, log: { error: jest.fn() } },
        },
        {
          handler: checkBadgesRoute!.handler,
          request: { user: { userId: 'u'.repeat(256) }, log: { error: jest.fn() } },
        },
      ]) {
        const reply = makeReply();
        await handler(request, reply);
        expect(reply.status).toHaveBeenCalledWith(400);
        expect(reply.send).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'INVALID_REFERRAL_TEXT_FIELD',
            message: 'Referral user ID must be at most 255 characters',
          },
        });
      }

      expect(createCustomerReferral).not.toHaveBeenCalled();
      expect(getCustomerReferralStats).not.toHaveBeenCalled();
      expect(getUserPosition).not.toHaveBeenCalled();
      expect(applyForAffiliate).not.toHaveBeenCalled();
      expect(getAffiliateDashboard).not.toHaveBeenCalled();
      expect(getUserBadges).not.toHaveBeenCalled();
      expect(checkAndAwardBadges).not.toHaveBeenCalled();

      await createRoute!.handler({
        body: { business_id: ' business-1 ' },
        user: { userId: ' user-1 ' },
        log: { error: jest.fn() },
      }, makeReply());
      await statsRoute!.handler({ user: { userId: ' user-1 ' }, log: { error: jest.fn() } }, makeReply());
      await positionRoute!.handler({ user: { userId: ' user-1 ' }, log: { error: jest.fn() } }, makeReply());
      await applyRoute!.handler({
        body: {
          application_message: 'I write about restaurants and want to promote MenuMaker to local operators.',
        },
        user: { userId: ' user-1 ' },
        log: { error: jest.fn() },
      }, makeReply());
      await dashboardRoute!.handler({ user: { userId: ' user-1 ' }, log: { error: jest.fn() } }, makeReply());
      await badgesRoute!.handler({ user: { userId: ' user-1 ' }, log: { error: jest.fn() } }, makeReply());
      await checkBadgesRoute!.handler({ user: { userId: ' user-1 ' }, log: { error: jest.fn() } }, makeReply());

      expect(createCustomerReferral).toHaveBeenCalledWith('user-1', 'business-1');
      expect(getCustomerReferralStats).toHaveBeenCalledWith('user-1');
      expect(getUserPosition).toHaveBeenCalledWith('user-1');
      expect(applyForAffiliate).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          application_message: 'I write about restaurants and want to promote MenuMaker to local operators.',
        })
      );
      expect(getAffiliateDashboard).toHaveBeenCalledWith('user-1');
      expect(getUserBadges).toHaveBeenCalledWith('user-1');
      expect(checkAndAwardBadges).toHaveBeenCalledWith('user-1');
    } finally {
      createCustomerReferral.mockRestore();
      getCustomerReferralStats.mockRestore();
      getUserPosition.mockRestore();
      applyForAffiliate.mockRestore();
      getAffiliateDashboard.mockRestore();
      getUserBadges.mockRestore();
      checkAndAwardBadges.mockRestore();
    }
  });

  it('rejects blank affiliate tracking codes before service calls and normalizes valid codes', async () => {
    const registeredPostRoutes: Array<{ path: string; handler: Function }> = [];
    const trackClick = jest
      .spyOn(AffiliateService.prototype, 'trackClick')
      .mockResolvedValue({
        id: 'click-1',
        created_at: new Date('2026-06-27T17:05:00.000Z'),
      } as any);
    const fakeFastify = {
      addHook: jest.fn(),
      get: jest.fn(),
      post: jest.fn((path: string, _options: unknown, handler: Function) => {
        registeredPostRoutes.push({ path, handler });
      }),
    };

    try {
      await enhancedReferralRoutes(fakeFastify as any);
      const route = registeredPostRoutes.find((item) => item.path === '/affiliates/track/:affiliateCode');
      expect(route).toBeDefined();

      for (const params of [{ affiliateCode: '   ' }, undefined, ['BLOGGER']]) {
        const blankSend = jest.fn();
        const blankStatus = jest.fn(() => ({ send: blankSend }));
        await route!.handler(
          {
            params,
            ip: '203.0.113.42',
            headers: {
              'user-agent': 'Mozilla/5.0',
              referer: 'https://example.com/blog',
            },
            log: { error: jest.fn() },
          },
          { status: blankStatus }
        );

        expect(blankStatus).toHaveBeenCalledWith(400);
        expect(blankSend).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'INVALID_AFFILIATE_TRACKING_REQUEST',
            message: 'Affiliate code is required',
          },
        });
      }

      for (const { params, body, message } of [
        {
          params: { affiliateCode: 'BLOG\u202EGER' },
          body: undefined,
          message: 'Affiliate code must not include unsafe control characters',
        },
        {
          params: { affiliateCode: 'BLOGGER' },
          body: { utm_source: 'newsletter\u200B' },
          message: 'Affiliate tracking UTM source must not include unsafe control characters',
        },
        {
          params: { affiliateCode: 'BLOGGER' },
          body: { utm_medium: 'email\u2060' },
          message: 'Affiliate tracking UTM medium must not include unsafe control characters',
        },
        {
          params: { affiliateCode: 'BLOGGER' },
          body: { utm_campaign: 'launch\u202Dweek' },
          message: 'Affiliate tracking UTM campaign must not include unsafe control characters',
        },
      ]) {
        const unsafeSend = jest.fn();
        const unsafeStatus = jest.fn(() => ({ send: unsafeSend }));
        await route!.handler(
          {
            params,
            body,
            ip: '203.0.113.42',
            headers: {
              'user-agent': 'Mozilla/5.0',
              referer: 'https://example.com/blog',
            },
            log: { error: jest.fn() },
          },
          { status: unsafeStatus }
        );

        expect(unsafeStatus).toHaveBeenCalledWith(400);
        expect(unsafeSend).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'INVALID_REFERRAL_TEXT_FIELD',
            message,
          },
        });
      }

      const oversizedCodeSend = jest.fn();
      const oversizedCodeStatus = jest.fn(() => ({ send: oversizedCodeSend }));
      await route!.handler(
        {
          params: { affiliateCode: 'A'.repeat(129) },
          ip: '203.0.113.42',
          headers: {
            'user-agent': 'Mozilla/5.0',
            referer: 'https://example.com/blog',
          },
          log: { error: jest.fn() },
        },
        { status: oversizedCodeStatus }
      );

      expect(oversizedCodeStatus).toHaveBeenCalledWith(400);
      expect(oversizedCodeSend).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_REFERRAL_TEXT_FIELD',
          message: 'Affiliate code must be at most 128 characters',
        },
      });

      for (const { headers, message } of [
        {
          headers: {
            'user-agent': 'Mozilla/5.0\uFEFF',
            referer: 'https://example.com/blog',
          },
          message: 'Affiliate tracking user agent must not include unsafe control characters',
        },
        {
          headers: {
            'user-agent': 'Mozilla/5.0',
            referer: 'https://example.com/blog\u202E',
          },
          message: 'Affiliate tracking referrer URL must not include unsafe control characters',
        },
      ]) {
        const unsafeHeaderSend = jest.fn();
        const unsafeHeaderStatus = jest.fn(() => ({ send: unsafeHeaderSend }));
        await route!.handler(
          {
            params: { affiliateCode: 'BLOGGER' },
            body: undefined,
            ip: '203.0.113.42',
            headers,
            log: { error: jest.fn() },
          },
          { status: unsafeHeaderStatus }
        );

        expect(unsafeHeaderStatus).toHaveBeenCalledWith(400);
        expect(unsafeHeaderSend).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'INVALID_REFERRAL_TEXT_FIELD',
            message,
          },
        });
      }

      for (const { headers, message } of [
        {
          headers: {
            'user-agent': 'M'.repeat(1025),
            referer: 'https://example.com/blog',
          },
          message: 'Affiliate tracking user agent must be at most 1024 characters',
        },
        {
          headers: {
            'user-agent': 'Mozilla/5.0',
            referer: 'https://publisher:secret@example.com/blog',
          },
          message: 'Affiliate tracking referrer URL must be an absolute HTTP(S) URL without embedded credentials and at most 255 characters',
        },
        {
          headers: {
            'user-agent': 'Mozilla/5.0',
            referer: `https://example.com/${'r'.repeat(256)}`,
          },
          message: 'Affiliate tracking referrer URL must be an absolute HTTP(S) URL without embedded credentials and at most 255 characters',
        },
      ]) {
        const invalidHeaderSend = jest.fn();
        const invalidHeaderStatus = jest.fn(() => ({ send: invalidHeaderSend }));
        await route!.handler(
          {
            params: { affiliateCode: 'BLOGGER' },
            body: undefined,
            ip: '203.0.113.42',
            headers,
            log: { error: jest.fn() },
          },
          { status: invalidHeaderStatus }
        );

        expect(invalidHeaderStatus).toHaveBeenCalledWith(400);
        expect(invalidHeaderSend).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'INVALID_AFFILIATE_TRACKING_REQUEST',
            message,
          },
        });
      }

      for (const ip of ['not-an-ip', '203.0.113.42, 198.51.100.25']) {
        const invalidIpSend = jest.fn();
        const invalidIpStatus = jest.fn(() => ({ send: invalidIpSend }));
        await route!.handler(
          {
            params: { affiliateCode: 'BLOGGER' },
            body: undefined,
            ip,
            headers: {
              'user-agent': 'Mozilla/5.0',
              referer: 'https://example.com/blog',
            },
            log: { error: jest.fn() },
          },
          { status: invalidIpStatus }
        );

        expect(invalidIpStatus).toHaveBeenCalledWith(400);
        expect(invalidIpSend).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'INVALID_AFFILIATE_TRACKING_REQUEST',
            message: 'Affiliate tracking IP address must be a valid IPv4 or IPv6 address',
          },
        });
      }

      expect(trackClick).not.toHaveBeenCalled();

      const response = await route!.handler(
        {
          params: { affiliateCode: ' BLOGGER ' },
          body: {
            utm_source: ' newsletter ',
            utm_medium: ' email ',
            utm_campaign: ' launch-week ',
          },
          ip: '203.0.113.42',
          headers: {
            'user-agent': 'Mozilla/5.0',
            referer: 'https://example.com/blog',
          },
          log: { error: jest.fn() },
        },
        { status: jest.fn() }
      );

      expect(trackClick).toHaveBeenCalledWith('BLOGGER', {
        ip_address: '203.0.113.42',
        user_agent: 'Mozilla/5.0',
        referrer_url: 'https://example.com/blog',
        utm_source: 'newsletter',
        utm_medium: 'email',
        utm_campaign: 'launch-week',
      });
      expect(response).toMatchObject({
        success: true,
        data: { click: { id: 'click-1' } },
      });
    } finally {
      trackClick.mockRestore();
    }
  });

  it('rejects malformed affiliate tracking request input before service calls', async () => {
    const registeredPostRoutes: Array<{ path: string; handler: Function }> = [];
    const trackClick = jest
      .spyOn(AffiliateService.prototype, 'trackClick')
      .mockResolvedValue({
        id: 'click-1',
        created_at: new Date('2026-06-27T17:05:00.000Z'),
      } as any);
    const fakeFastify = {
      addHook: jest.fn(),
      get: jest.fn(),
      post: jest.fn((path: string, _options: unknown, handler: Function) => {
        registeredPostRoutes.push({ path, handler });
      }),
    };

    try {
      await enhancedReferralRoutes(fakeFastify as any);
      const route = registeredPostRoutes.find((item) => item.path === '/affiliates/track/:affiliateCode');
      expect(route).toBeDefined();

      for (const query of ['include_ip_address=true', ['include_ip_address=true']]) {
        const send = jest.fn();
        const status = jest.fn(() => ({ send }));
        await route!.handler(
          {
            params: { affiliateCode: 'BLOGGER' },
            query,
            ip: '203.0.113.42',
            headers: {
              'user-agent': 'Mozilla/5.0',
              referer: 'https://example.com/blog',
            },
            log: { error: jest.fn() },
          },
          { status }
        );

        expect(status).toHaveBeenCalledWith(400);
        expect(send).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'INVALID_AFFILIATE_TRACKING_QUERY',
            message: 'Affiliate tracking query must be an object',
          },
        });
      }

      const unsupportedSend = jest.fn();
      const unsupportedStatus = jest.fn(() => ({ send: unsupportedSend }));
      await route!.handler(
        {
          params: { affiliateCode: 'BLOGGER' },
          query: { include_ip_address: 'true' },
          ip: '203.0.113.42',
          headers: {
            'user-agent': 'Mozilla/5.0',
            referer: 'https://example.com/blog',
          },
          log: { error: jest.fn() },
        },
        { status: unsupportedStatus }
      );

      expect(unsupportedStatus).toHaveBeenCalledWith(400);
      expect(unsupportedSend).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'UNSUPPORTED_REFERRAL_QUERY_FIELD',
          message: 'Unsupported referral query field(s): include_ip_address',
        },
      });

      const unsafeQueryFieldNameSend = jest.fn();
      const unsafeQueryFieldNameStatus = jest.fn(() => ({ send: unsafeQueryFieldNameSend }));
      await route!.handler(
        {
          params: { affiliateCode: 'BLOGGER' },
          query: { ['include_ip_address\uFEFF']: 'true' },
          ip: '203.0.113.42',
          headers: {
            'user-agent': 'Mozilla/5.0',
            referer: 'https://example.com/blog',
          },
          log: { error: jest.fn() },
        },
        { status: unsafeQueryFieldNameStatus }
      );

      expect(unsafeQueryFieldNameStatus).toHaveBeenCalledWith(400);
      expect(unsafeQueryFieldNameSend).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_REFERRAL_FIELD_NAME',
          message: 'Affiliate tracking query field names must not include unsafe control characters',
        },
      });

      for (const body of ['utm_source=newsletter', ['utm_source']]) {
        const bodySend = jest.fn();
        const bodyStatus = jest.fn(() => ({ send: bodySend }));
        await route!.handler(
          {
            params: { affiliateCode: 'BLOGGER' },
            body,
            ip: '203.0.113.42',
            headers: {
              'user-agent': 'Mozilla/5.0',
              referer: 'https://example.com/blog',
            },
            log: { error: jest.fn() },
          },
          { status: bodyStatus }
        );

        expect(bodyStatus).toHaveBeenCalledWith(400);
        expect(bodySend).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'INVALID_REFERRAL_REQUEST_BODY',
            message: 'Referral request body must be an object',
          },
        });
      }

      const unsupportedBodySend = jest.fn();
      const unsupportedBodyStatus = jest.fn(() => ({ send: unsupportedBodySend }));
      await route!.handler(
        {
          params: { affiliateCode: 'BLOGGER' },
          body: { ip_address: '203.0.113.42' },
          ip: '203.0.113.42',
          headers: {
            'user-agent': 'Mozilla/5.0',
            referer: 'https://example.com/blog',
          },
          log: { error: jest.fn() },
        },
        { status: unsupportedBodyStatus }
      );

      expect(unsupportedBodyStatus).toHaveBeenCalledWith(400);
      expect(unsupportedBodySend).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'UNSUPPORTED_REFERRAL_FIELD',
          message: 'Unsupported referral request field(s): ip_address',
        },
      });

      const unsafeBodyFieldNameSend = jest.fn();
      const unsafeBodyFieldNameStatus = jest.fn(() => ({ send: unsafeBodyFieldNameSend }));
      await route!.handler(
        {
          params: { affiliateCode: 'BLOGGER' },
          body: { ['ip_address\uFEFF']: '203.0.113.42' },
          ip: '203.0.113.42',
          headers: {
            'user-agent': 'Mozilla/5.0',
            referer: 'https://example.com/blog',
          },
          log: { error: jest.fn() },
        },
        { status: unsafeBodyFieldNameStatus }
      );

      expect(unsafeBodyFieldNameStatus).toHaveBeenCalledWith(400);
      expect(unsafeBodyFieldNameSend).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_REFERRAL_FIELD_NAME',
          message: 'Affiliate tracking request field names must not include unsafe control characters',
        },
      });

      for (const body of [
        { utm_source: { source: 'newsletter' } },
        { utm_medium: 'x'.repeat(101) },
        { utm_campaign: ['launch-week'] },
      ]) {
        const invalidUtmSend = jest.fn();
        const invalidUtmStatus = jest.fn(() => ({ send: invalidUtmSend }));
        await route!.handler(
          {
            params: { affiliateCode: 'BLOGGER' },
            body,
            ip: '203.0.113.42',
            headers: {
              'user-agent': 'Mozilla/5.0',
              referer: 'https://example.com/blog',
            },
            log: { error: jest.fn() },
          },
          { status: invalidUtmStatus }
        );

        expect(invalidUtmStatus).toHaveBeenCalledWith(400);
        expect(invalidUtmSend).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'INVALID_AFFILIATE_TRACKING_REQUEST',
            message: 'Affiliate tracking UTM fields must be strings up to 100 characters',
          },
        });
      }
      expect(trackClick).not.toHaveBeenCalled();
    } finally {
      trackClick.mockRestore();
    }
  });

  it('rejects malformed legacy referral request bodies before service calls and normalizes valid codes', async () => {
    const registeredPostRoutes: Array<{ path: string; handler: Function }> = [];
    const getRepository = jest
      .spyOn(AppDataSource, 'getRepository')
      .mockReturnValue({ findOne: jest.fn() } as any);
    const trackClick = jest
      .spyOn(ReferralService, 'trackClick')
      .mockResolvedValue({ success: true } as any);
    const validateCode = jest
      .spyOn(ReferralService, 'validateCode')
      .mockResolvedValue({ valid: true, referrer_email: 'seller@example.com' } as any);
    const fakeFastify = {
      authenticate: jest.fn(),
      get: jest.fn(),
      post: jest.fn((path: string, handler: Function) => {
        registeredPostRoutes.push({ path, handler });
      }),
    };

    try {
      await referralRoutes(fakeFastify as any);
      const trackRoute = registeredPostRoutes.find((item) => item.path === '/track-click');
      const validateRoute = registeredPostRoutes.find((item) => item.path === '/validate');
      expect(trackRoute).toBeDefined();
      expect(validateRoute).toBeDefined();

      for (const { route, body } of [
        { route: trackRoute!, body: undefined },
        { route: validateRoute!, body: undefined },
      ]) {
        const send = jest.fn();
        const status = jest.fn(() => ({ send }));
        await route.handler(
          {
            body,
            ip: '203.0.113.42',
            headers: { 'user-agent': 'Mozilla/5.0' },
          },
          { status }
        );

        expect(status).toHaveBeenCalledWith(400);
        expect(send).toHaveBeenCalledWith({ error: 'referral_code is required' });
      }

      for (const { route, body } of [
        { route: trackRoute!, body: 'referral_code=REF-CODE' },
        { route: validateRoute!, body: 'referral_code=REF-CODE' },
        { route: trackRoute!, body: ['REF-CODE'] },
        { route: validateRoute!, body: ['REF-CODE'] },
      ]) {
        const send = jest.fn();
        const status = jest.fn(() => ({ send }));
        await route.handler(
          {
            body,
            ip: '203.0.113.42',
            headers: { 'user-agent': 'Mozilla/5.0' },
          },
          { status }
        );

        expect(status).toHaveBeenCalledWith(400);
        expect(send).toHaveBeenCalledWith({ error: 'Referral request body must be an object' });
      }

      expect(trackClick).not.toHaveBeenCalled();
      expect(validateCode).not.toHaveBeenCalled();

      for (const { route, body, error } of [
        {
          route: trackRoute!,
          body: { ['bad\uFEFFfield']: 'REF-CODE', referral_code: 'REF-CODE' },
          error: 'Referral request field names contain unsafe control characters',
        },
        {
          route: validateRoute!,
          body: { ['bad\u202Efield']: 'REF-CODE', referral_code: 'REF-CODE' },
          error: 'Referral request field names contain unsafe control characters',
        },
        {
          route: trackRoute!,
          body: { referral_code: '\uFEFFREF-CODE' },
          error: 'referral_code contains unsafe control characters',
        },
        {
          route: validateRoute!,
          body: { referral_code: 'REF-CODE\uFEFF' },
          error: 'referral_code contains unsafe control characters',
        },
        {
          route: trackRoute!,
          body: { referral_code: 'REF-CODE', source: 'blog\u200Bcampaign' },
          error: 'source contains unsafe control characters',
        },
        {
          route: trackRoute!,
          body: { referral_code: 'REF-CODE', utm_source: 'newsletter\u2060june' },
          error: 'utm_source contains unsafe control characters',
        },
      ]) {
        const send = jest.fn();
        const status = jest.fn(() => ({ send }));
        await route.handler(
          {
            body,
            ip: '203.0.113.42',
            headers: { 'user-agent': 'Mozilla/5.0' },
          },
          { status }
        );

        expect(status).toHaveBeenCalledWith(400);
        expect(send).toHaveBeenCalledWith({ error });
      }

      expect(trackClick).not.toHaveBeenCalled();
      expect(validateCode).not.toHaveBeenCalled();

      for (const { route, body, error } of [
        {
          route: trackRoute!,
          body: { referral_code: 'R'.repeat(129) },
          error: 'referral_code must be at most 128 characters',
        },
        {
          route: validateRoute!,
          body: { referral_code: 'R'.repeat(129) },
          error: 'referral_code must be at most 128 characters',
        },
        {
          route: trackRoute!,
          body: { referral_code: 'REF-CODE', source: 's'.repeat(101) },
          error: 'source must be at most 100 characters',
        },
        {
          route: trackRoute!,
          body: { referral_code: 'REF-CODE', utm_source: 'u'.repeat(101) },
          error: 'utm_source must be at most 100 characters',
        },
      ]) {
        const send = jest.fn();
        const status = jest.fn(() => ({ send }));
        await route.handler(
          {
            body,
            ip: '203.0.113.42',
            headers: { 'user-agent': 'Mozilla/5.0' },
          },
          { status }
        );

        expect(status).toHaveBeenCalledWith(400);
        expect(send).toHaveBeenCalledWith({ error });
      }

      expect(trackClick).not.toHaveBeenCalled();
      expect(validateCode).not.toHaveBeenCalled();

      for (const { route, body, error } of [
        {
          route: trackRoute!,
          body: {
            referral_code: 'REF-CODE',
            reward_override_cents: 5000,
          },
          error: 'Unsupported referral request field(s): reward_override_cents',
        },
        {
          route: validateRoute!,
          body: {
            referral_code: 'REF-CODE',
            force_conversion: true,
          },
          error: 'Unsupported referral request field(s): force_conversion',
        },
      ]) {
        const send = jest.fn();
        const status = jest.fn(() => ({ send }));
        await route.handler(
          {
            body,
            ip: '203.0.113.42',
            headers: { 'user-agent': 'Mozilla/5.0' },
          },
          { status }
        );

        expect(status).toHaveBeenCalledWith(400);
        expect(send).toHaveBeenCalledWith({ error });
      }

      expect(trackClick).not.toHaveBeenCalled();
      expect(validateCode).not.toHaveBeenCalled();

      await trackRoute!.handler(
        {
          body: {
            referral_code: ' REF-CODE ',
            source: ' blog ',
            utm_source: ' newsletter ',
          },
          ip: '203.0.113.42',
          headers: { 'user-agent': 'Mozilla/5.0' },
        },
        { status: jest.fn(), send: jest.fn() }
      );
      const validateSend = jest.fn();
      await validateRoute!.handler(
        {
          body: { referral_code: ' REF-CODE ' },
          ip: '203.0.113.42',
          headers: { 'user-agent': 'Mozilla/5.0' },
        },
        { status: jest.fn(), send: validateSend }
      );

      expect(trackClick).toHaveBeenCalledWith(expect.objectContaining({
        referral_code: 'REF-CODE',
        source: 'blog',
        utm_source: 'newsletter',
        click_ip: '203.0.113.42',
      }));
      expect(validateCode).toHaveBeenCalledWith('REF-CODE');
      expect(validateSend).toHaveBeenCalledWith({
        success: true,
        data: {
          valid: true,
          referrer_email: 'seller@example.com',
        },
      });
    } finally {
      getRepository.mockRestore();
      trackClick.mockRestore();
      validateCode.mockRestore();
    }
  });

  it('validates legacy referral list query fields before service calls and applies status filtering', async () => {
    const registeredGetRoutes: Array<{ path: string; handler: Function }> = [];
    const getRepository = jest
      .spyOn(AppDataSource, 'getRepository')
      .mockReturnValue({ findOne: jest.fn() } as any);
    const getReferrals = jest
      .spyOn(ReferralService, 'getReferrals')
      .mockResolvedValue([]);
    const fakeFastify = {
      authenticate: jest.fn(),
      get: jest.fn((path: string, _options: unknown, handler: Function) => {
        registeredGetRoutes.push({ path, handler });
      }),
      post: jest.fn(),
    };

    try {
      await referralRoutes(fakeFastify as any);
      const route = registeredGetRoutes.find((item) => item.path === '/users/me/referrals');
      expect(route).toBeDefined();

      for (const { query, error } of [
        { query: 'limit=25', error: 'Referral query must be an object' },
        { query: ['limit=25'], error: 'Referral query must be an object' },
        { query: { limit: '10.5' }, error: 'Referral list limit must be a non-negative integer' },
        { query: { offset: '-1' }, error: 'Referral list offset must be a non-negative integer' },
        { query: { status: '\uFEFFfirst_menu_published' }, error: 'Referral list status contains unsafe control characters' },
        { query: { status: 'reward_claimed' }, error: 'Referral list status must be link_clicked, signup_completed, first_menu_published, or expired' },
        { query: { ['bad\uFEFFfield']: 'true' }, error: 'Referral query field names contain unsafe control characters' },
        { query: { limit: '10', include_rewards: 'true' }, error: 'Unsupported referral query field(s): include_rewards' },
      ]) {
        const send = jest.fn();
        const status = jest.fn(() => ({ send }));
        await route!.handler(
          {
            query,
            user: { userId: 'user-1' },
          },
          { status }
        );

        expect(status).toHaveBeenCalledWith(400);
        expect(send).toHaveBeenCalledWith({ error });
      }

      expect(getReferrals).not.toHaveBeenCalled();

      const unsafeUserSend = jest.fn();
      const unsafeUserStatus = jest.fn(() => ({ send: unsafeUserSend }));
      await route!.handler(
        {
          query: {},
          user: { userId: 'user\u202Eone' },
        },
        { status: unsafeUserStatus }
      );

      expect(unsafeUserStatus).toHaveBeenCalledWith(400);
      expect(unsafeUserSend).toHaveBeenCalledWith({
        error: 'Referral user id contains unsafe control characters',
      });
      expect(getReferrals).not.toHaveBeenCalled();

      const oversizedUserSend = jest.fn();
      const oversizedUserStatus = jest.fn(() => ({ send: oversizedUserSend }));
      await route!.handler(
        {
          query: {},
          user: { userId: 'u'.repeat(256) },
        },
        { status: oversizedUserStatus }
      );

      expect(oversizedUserStatus).toHaveBeenCalledWith(400);
      expect(oversizedUserSend).toHaveBeenCalledWith({
        error: 'Referral user id must be 255 characters or fewer',
      });
      expect(getReferrals).not.toHaveBeenCalled();

      const validSend = jest.fn();
      await route!.handler(
        {
          query: {
            limit: ' 10 ',
            offset: ' 20 ',
            status: ' First_Menu_Published ',
          },
          user: { id: ' user-1 ' },
        },
        { status: jest.fn(), send: validSend }
      );

      expect(getReferrals).toHaveBeenCalledWith('user-1', 10, 20, 'first_menu_published');
      expect(validSend).toHaveBeenCalledWith({
        success: true,
        data: [],
        meta: {
          total: 0,
          limit: 10,
          offset: 20,
        },
      });
    } finally {
      getRepository.mockRestore();
      getReferrals.mockRestore();
    }
  });

  it('bounds legacy referral authenticated user ids before repository and stats service calls', async () => {
    const registeredGetRoutes: Array<{ path: string; handler: Function }> = [];
    const findOne = jest.fn();
    const getRepository = jest
      .spyOn(AppDataSource, 'getRepository')
      .mockReturnValue({ findOne } as any);
    const getStats = jest
      .spyOn(ReferralService, 'getStats')
      .mockResolvedValue({
        total_referrals: 0,
        link_clicked: 0,
        signup_completed: 0,
        first_menu_published: 0,
        conversion_rate: 0,
      });
    const fakeFastify = {
      authenticate: jest.fn(),
      get: jest.fn((path: string, _options: unknown, handler: Function) => {
        registeredGetRoutes.push({ path, handler });
      }),
      post: jest.fn(),
    };

    try {
      await referralRoutes(fakeFastify as any);
      const referralCodeRoute = registeredGetRoutes.find((item) => item.path === '/users/me/referral-code');
      const statsRoute = registeredGetRoutes.find((item) => item.path === '/users/me/referrals/stats');
      expect(referralCodeRoute).toBeDefined();
      expect(statsRoute).toBeDefined();

      for (const route of [referralCodeRoute!, statsRoute!]) {
        const send = jest.fn();
        const status = jest.fn(() => ({ send }));
        await route.handler(
          {
            user: { userId: 'u'.repeat(256) },
          },
          { status }
        );

        expect(status).toHaveBeenCalledWith(400);
        expect(send).toHaveBeenCalledWith({
          error: 'Referral user id must be 255 characters or fewer',
        });
      }

      expect(findOne).not.toHaveBeenCalled();
      expect(getStats).not.toHaveBeenCalled();

      findOne.mockResolvedValue({
        id: 'user-1',
        email: 'seller@example.com',
        referral_code: 'REF-CODE',
      });

      const referralCodeSend = jest.fn();
      await referralCodeRoute!.handler(
        {
          user: { id: ' user-1 ' },
        },
        { status: jest.fn(), send: referralCodeSend }
      );

      expect(findOne).toHaveBeenCalledWith({ where: { id: 'user-1' } });
      expect(referralCodeSend).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.objectContaining({ referral_code: 'REF-CODE' }),
      }));

      const statsSend = jest.fn();
      await statsRoute!.handler(
        {
          user: { id: ' user-1 ' },
        },
        { status: jest.fn(), send: statsSend }
      );

      expect(getStats).toHaveBeenCalledWith('user-1');
      expect(statsSend).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.objectContaining({ total_referrals: 0 }),
      }));
    } finally {
      getRepository.mockRestore();
      getStats.mockRestore();
    }
  });

  it('rejects legacy referral persisted row field names with invisible Unicode controls before diagnostics aggregate keys', async () => {
    const find = jest.fn().mockResolvedValue([
      {
        id: 'referral-1',
        referral_code: 'REF-CODE',
        referrer_id: 'user-1',
        status: 'link_clicked',
        reward_value_cents: 0,
        reward_claimed: false,
        created_at: new Date('2026-06-28T00:00:00.000Z'),
        updated_at: new Date('2026-06-28T00:00:00.000Z'),
        ['provider\uFEFFtrace']: 'unsafe',
      },
    ]);
    const getRepository = jest
      .spyOn(AppDataSource, 'getRepository')
      .mockReturnValue({ find } as any);

    try {
      await expect(ReferralService.getReferrals('user-1')).rejects.toThrow(
        'Referral row 1 for referral referral-1 field names contain unsafe control characters'
      );
    } finally {
      getRepository.mockRestore();
    }
  });

  it('rejects malformed OCR image base64 before OCR service calls', async () => {
    const registeredPostRoutes: Array<{ path: string; handler: Function }> = [];
    const extractFromImage = jest
      .spyOn(OCRService, 'extractFromImage')
      .mockRejectedValue(new Error('extractFromImage should not be called'));
    const fakeFastify = {
      addHook: jest.fn(),
      get: jest.fn(),
      post: jest.fn((path: string, _options: unknown, handler: Function) => {
        registeredPostRoutes.push({ path, handler });
      }),
      authenticate: jest.fn(),
    };

    try {
      await ocrRoutes(fakeFastify as any);
      const route = registeredPostRoutes.find((item) => item.path === '/extract-from-image');
      expect(route).toBeDefined();

      const send = jest.fn();
      const status = jest.fn(() => ({ send }));
      await route!.handler(
        {
          body: {
            image: 'not-base64!',
            mime_type: 'image/jpeg',
          },
        },
        { status }
      );

      expect(status).toHaveBeenCalledWith(400);
      expect(send).toHaveBeenCalledWith({ error: 'Image data must be valid base64.' });
      expect(extractFromImage).not.toHaveBeenCalled();

      const unsafeImageSend = jest.fn();
      const unsafeImageStatus = jest.fn(() => ({ send: unsafeImageSend }));
      await route!.handler(
        {
          body: {
            image: `${Buffer.from('image').toString('base64')}\u200B`,
            mime_type: 'image/jpeg',
          },
        },
        { status: unsafeImageStatus }
      );

      expect(unsafeImageStatus).toHaveBeenCalledWith(400);
      expect(unsafeImageSend).toHaveBeenCalledWith({
        error: 'OCR image data must not include unsafe control characters',
      });
      expect(extractFromImage).not.toHaveBeenCalled();

      const oversizedBase64Image = 'A'.repeat(Math.ceil((10 * 1024 * 1024 + 1) / 3) * 4);
      const oversizedImageSend = jest.fn();
      const oversizedImageStatus = jest.fn(() => ({ send: oversizedImageSend }));
      await route!.handler(
        {
          body: {
            image: oversizedBase64Image,
            mime_type: 'image/jpeg',
          },
        },
        { status: oversizedImageStatus }
      );

      expect(oversizedImageStatus).toHaveBeenCalledWith(400);
      expect(oversizedImageSend).toHaveBeenCalledWith({
        error: 'Image too large. Maximum size is 10MB.',
      });
      expect(extractFromImage).not.toHaveBeenCalled();

      const missingImageSend = jest.fn();
      const missingImageStatus = jest.fn(() => ({ send: missingImageSend }));
      await route!.handler(
        {
          body: undefined,
        },
        { status: missingImageStatus }
      );

      expect(missingImageStatus).toHaveBeenCalledWith(400);
      expect(missingImageSend).toHaveBeenCalledWith({ error: 'Image data is required' });

      for (const malformedBody of [['image'], 'image=abc']) {
        const missingImageSend = jest.fn();
        const missingImageStatus = jest.fn(() => ({ send: missingImageSend }));
        await route!.handler(
          {
            body: malformedBody,
          },
          { status: missingImageStatus }
        );

        expect(missingImageStatus).toHaveBeenCalledWith(400);
        expect(missingImageSend).toHaveBeenCalledWith({ error: 'OCR request body must be an object' });
      }
      expect(extractFromImage).not.toHaveBeenCalled();
    } finally {
      extractFromImage.mockRestore();
    }
  });

  it('rejects unsupported OCR image MIME types before capability or service dispatch', async () => {
    const registeredPostRoutes: Array<{ path: string; handler: Function }> = [];
    const extractFromImage = jest
      .spyOn(OCRService, 'extractFromImage')
      .mockRejectedValue(new Error('extractFromImage should not be called'));
    const fakeFastify = {
      addHook: jest.fn(),
      get: jest.fn(),
      post: jest.fn((path: string, _options: unknown, handler: Function) => {
        registeredPostRoutes.push({ path, handler });
      }),
      authenticate: jest.fn(),
    };

    try {
      await ocrRoutes(fakeFastify as any);
      const route = registeredPostRoutes.find((item) => item.path === '/extract-from-image');
      expect(route).toBeDefined();

      const unsupportedCases = ['text/html', '   '];
      for (const mimeType of unsupportedCases) {
        const send = jest.fn();
        const status = jest.fn(() => ({ send }));
        await route!.handler(
          {
            body: {
              image: Buffer.from('image').toString('base64'),
              mime_type: mimeType,
            },
          },
          { status }
        );

        expect(status).toHaveBeenCalledWith(400);
        expect(send).toHaveBeenCalledWith({ error: 'OCR image MIME type is unsupported' });
      }

      const unsafeMimeSend = jest.fn();
      const unsafeMimeStatus = jest.fn(() => ({ send: unsafeMimeSend }));
      await route!.handler(
        {
          body: {
            image: Buffer.from('image').toString('base64'),
            mime_type: 'image/jpeg\u202E',
          },
        },
        { status: unsafeMimeStatus }
      );

      expect(unsafeMimeStatus).toHaveBeenCalledWith(400);
      expect(unsafeMimeSend).toHaveBeenCalledWith({
        error: 'OCR image MIME type must not include unsafe control characters',
      });
      expect(extractFromImage).not.toHaveBeenCalled();
    } finally {
      extractFromImage.mockRestore();
    }
  });

  it('rejects unsupported OCR request body fields before service or persistence work', async () => {
    const registeredPostRoutes: Array<{ path: string; handler: Function }> = [];
    const extractFromImage = jest
      .spyOn(OCRService, 'extractFromImage')
      .mockRejectedValue(new Error('extractFromImage should not be called'));
    const extractFromText = jest
      .spyOn(OCRService, 'extractFromText')
      .mockRejectedValue(new Error('extractFromText should not be called'));
    const fakeFastify = {
      addHook: jest.fn(),
      get: jest.fn(),
      post: jest.fn((path: string, _options: unknown, handler: Function) => {
        registeredPostRoutes.push({ path, handler });
      }),
      authenticate: jest.fn(),
    };

    try {
      await ocrRoutes(fakeFastify as any);
      const imageRoute = registeredPostRoutes.find((item) => item.path === '/extract-from-image');
      const textRoute = registeredPostRoutes.find((item) => item.path === '/extract-from-text');
      const bulkRoute = registeredPostRoutes.find((item) => item.path === '/bulk-import');
      expect(imageRoute).toBeDefined();
      expect(textRoute).toBeDefined();
      expect(bulkRoute).toBeDefined();

      const imageSend = jest.fn();
      await imageRoute!.handler(
        {
          body: {
            image: Buffer.from('image').toString('base64'),
            mime_type: 'image/jpeg',
            provider_mode: 'live',
          },
        },
        { status: jest.fn(() => ({ send: imageSend })) }
      );

      expect(imageSend).toHaveBeenCalledWith({
        error: 'Unsupported OCR request field(s): provider_mode',
      });

      const unsafeImageFieldNameSend = jest.fn();
      const unsafeImageFieldNameStatus = jest.fn(() => ({ send: unsafeImageFieldNameSend }));
      await imageRoute!.handler(
        {
          body: {
            image: Buffer.from('image').toString('base64'),
            mime_type: 'image/jpeg',
            ['provider_mode\uFEFF']: 'live',
          },
        },
        { status: unsafeImageFieldNameStatus }
      );

      expect(unsafeImageFieldNameStatus).toHaveBeenCalledWith(400);
      expect(unsafeImageFieldNameSend).toHaveBeenCalledWith({
        error: 'OCR image request field names must not include unsafe control characters',
      });

      const textSend = jest.fn();
      await textRoute!.handler(
        {
          body: {
            menu_text: 'Samosa ₹20',
            prompt_override: 'extract aggressively',
          },
        },
        { status: jest.fn(() => ({ send: textSend })) }
      );

      expect(textSend).toHaveBeenCalledWith({
        error: 'Unsupported OCR request field(s): prompt_override',
      });

      const unsafeTextFieldNameSend = jest.fn();
      const unsafeTextFieldNameStatus = jest.fn(() => ({ send: unsafeTextFieldNameSend }));
      await textRoute!.handler(
        {
          body: {
            menu_text: 'Samosa ₹20',
            ['prompt_override\uFEFF']: 'extract aggressively',
          },
        },
        { status: unsafeTextFieldNameStatus }
      );

      expect(unsafeTextFieldNameStatus).toHaveBeenCalledWith(400);
      expect(unsafeTextFieldNameSend).toHaveBeenCalledWith({
        error: 'OCR text request field names must not include unsafe control characters',
      });

      const bulkSend = jest.fn();
      await bulkRoute!.handler(
        {
          body: {
            business_id: 'business-1',
            dishes: [{ name: 'Samosa', price_cents: 2000 }],
            create_categories: true,
            publish_immediately: true,
          },
          user: { userId: 'user-1' },
        },
        { status: jest.fn(() => ({ send: bulkSend })) }
      );

      expect(bulkSend).toHaveBeenCalledWith({
        error: 'Unsupported OCR request field(s): publish_immediately',
      });

      const unsafeBulkFieldNameSend = jest.fn();
      const unsafeBulkFieldNameStatus = jest.fn(() => ({ send: unsafeBulkFieldNameSend }));
      await bulkRoute!.handler(
        {
          body: {
            business_id: 'business-1',
            dishes: [{ name: 'Samosa', price_cents: 2000 }],
            create_categories: true,
            ['publish_immediately\uFEFF']: true,
          },
          user: { userId: 'user-1' },
        },
        { status: unsafeBulkFieldNameStatus }
      );

      expect(unsafeBulkFieldNameStatus).toHaveBeenCalledWith(400);
      expect(unsafeBulkFieldNameSend).toHaveBeenCalledWith({
        error: 'OCR bulk import request field names must not include unsafe control characters',
      });
      expect(extractFromImage).not.toHaveBeenCalled();
      expect(extractFromText).not.toHaveBeenCalled();
    } finally {
      extractFromImage.mockRestore();
      extractFromText.mockRestore();
    }
  });

  it('rejects malformed or unsupported OCR command query fields before service or persistence work', async () => {
    const registeredPostRoutes: Array<{ path: string; handler: Function }> = [];
    const extractFromImage = jest
      .spyOn(OCRService, 'extractFromImage')
      .mockRejectedValue(new Error('extractFromImage should not be called for invalid OCR command query input'));
    const extractFromText = jest
      .spyOn(OCRService, 'extractFromText')
      .mockRejectedValue(new Error('extractFromText should not be called for invalid OCR command query input'));
    const getRepository = jest
      .spyOn(AppDataSource, 'getRepository')
      .mockImplementation(() => {
        throw new Error('repositories should not be initialized for invalid OCR command query input');
      });
    const query = jest
      .spyOn(AppDataSource, 'query')
      .mockRejectedValue(new Error('ownership query should not run for invalid OCR command query input'));
    const fakeFastify = {
      addHook: jest.fn(),
      get: jest.fn(),
      post: jest.fn((path: string, _options: unknown, handler: Function) => {
        registeredPostRoutes.push({ path, handler });
      }),
      authenticate: jest.fn(),
    };

    try {
      await ocrRoutes(fakeFastify as any);
      const imageRoute = registeredPostRoutes.find((item) => item.path === '/extract-from-image');
      const textRoute = registeredPostRoutes.find((item) => item.path === '/extract-from-text');
      const bulkRoute = registeredPostRoutes.find((item) => item.path === '/bulk-import');
      expect(imageRoute).toBeDefined();
      expect(textRoute).toBeDefined();
      expect(bulkRoute).toBeDefined();

      for (const { route, query: malformedQuery, body, user } of [
        {
          route: imageRoute!,
          query: 'providerOverride=shadow-ocr',
          body: {
            image: Buffer.from('image').toString('base64'),
            mime_type: 'image/jpeg',
          },
        },
        {
          route: textRoute!,
          query: ['promptOverride'],
          body: {
            menu_text: 'Samosa ₹20',
          },
        },
        {
          route: bulkRoute!,
          query: 'publishImmediately=true',
          body: {
            business_id: 'business-1',
            dishes: [{ name: 'Samosa', price_cents: 2000 }],
          },
          user: { userId: 'user-1' },
        },
      ]) {
        const send = jest.fn();
        const status = jest.fn(() => ({ send }));
        await route.handler(
          {
            query: malformedQuery,
            body,
            user,
          },
          { status }
        );

        expect(status).toHaveBeenCalledWith(400);
        expect(send).toHaveBeenCalledWith({ error: 'OCR query must be an object' });
      }

      for (const { route, query: unsupportedQuery, body, user, message } of [
        {
          route: imageRoute!,
          query: { provider_override: 'shadow-ocr' },
          body: {
            image: Buffer.from('image').toString('base64'),
            mime_type: 'image/jpeg',
          },
          message: 'Unsupported OCR query field(s): provider_override',
        },
        {
          route: textRoute!,
          query: { prompt_override: 'extract aggressively' },
          body: {
            menu_text: 'Samosa ₹20',
          },
          message: 'Unsupported OCR query field(s): prompt_override',
        },
        {
          route: bulkRoute!,
          query: { publish_immediately: 'true' },
          body: {
            business_id: 'business-1',
            dishes: [{ name: 'Samosa', price_cents: 2000 }],
          },
          user: { userId: 'user-1' },
          message: 'Unsupported OCR query field(s): publish_immediately',
        },
      ]) {
        const send = jest.fn();
        const status = jest.fn(() => ({ send }));
        await route.handler(
          {
            query: unsupportedQuery,
            body,
            user,
          },
          { status }
        );

        expect(status).toHaveBeenCalledWith(400);
        expect(send).toHaveBeenCalledWith({ error: message });
      }

      for (const { route, query: unsafeQuery, body, user } of [
        {
          route: imageRoute!,
          query: { ['provider_override\uFEFF']: 'shadow-ocr' },
          body: {
            image: Buffer.from('image').toString('base64'),
            mime_type: 'image/jpeg',
          },
        },
        {
          route: textRoute!,
          query: { ['prompt_override\uFEFF']: 'extract aggressively' },
          body: {
            menu_text: 'Samosa ₹20',
          },
        },
        {
          route: bulkRoute!,
          query: { ['publish_immediately\uFEFF']: 'true' },
          body: {
            business_id: 'business-1',
            dishes: [{ name: 'Samosa', price_cents: 2000 }],
          },
          user: { userId: 'user-1' },
        },
      ]) {
        const send = jest.fn();
        const status = jest.fn(() => ({ send }));
        await route.handler(
          {
            query: unsafeQuery,
            body,
            user,
          },
          { status }
        );

        expect(status).toHaveBeenCalledWith(400);
        expect(send).toHaveBeenCalledWith({
          error: 'OCR query field names must not include unsafe control characters',
        });
      }

      expect(extractFromImage).not.toHaveBeenCalled();
      expect(extractFromText).not.toHaveBeenCalled();
      expect(getRepository).not.toHaveBeenCalled();
      expect(query).not.toHaveBeenCalled();
    } finally {
      extractFromImage.mockRestore();
      extractFromText.mockRestore();
      getRepository.mockRestore();
      query.mockRestore();
    }
  });

  it('rejects blank OCR text before capability or OCR service dispatch', async () => {
    const registeredPostRoutes: Array<{ path: string; handler: Function }> = [];
    const extractFromText = jest
      .spyOn(OCRService, 'extractFromText')
      .mockRejectedValue(new Error('extractFromText should not be called'));
    const fakeFastify = {
      addHook: jest.fn(),
      get: jest.fn(),
      post: jest.fn((path: string, _options: unknown, handler: Function) => {
        registeredPostRoutes.push({ path, handler });
      }),
      authenticate: jest.fn(),
    };

    try {
      await ocrRoutes(fakeFastify as any);
      const textRoute = registeredPostRoutes.find((item) => item.path === '/extract-from-text');
      expect(textRoute).toBeDefined();

      const send = jest.fn();
      const status = jest.fn(() => ({ send }));
      await textRoute!.handler(
        {
          body: {
            menu_text: '   ',
          },
        },
        { status }
      );

      expect(status).toHaveBeenCalledWith(400);
      expect(send).toHaveBeenCalledWith({ error: 'Menu text is required' });

      const unsafeTextSend = jest.fn();
      const unsafeTextStatus = jest.fn(() => ({ send: unsafeTextSend }));
      await textRoute!.handler(
        {
          body: {
            menu_text: 'Samosa\u202E ₹20',
          },
        },
        { status: unsafeTextStatus }
      );

      expect(unsafeTextStatus).toHaveBeenCalledWith(400);
      expect(unsafeTextSend).toHaveBeenCalledWith({
        error: 'OCR menu text must not include unsafe control characters',
      });

      const oversizedUnicodeText = '₹'.repeat(Math.floor((50 * 1024) / 3) + 1);
      expect(oversizedUnicodeText.length).toBeLessThan(50 * 1024);
      const oversizedTextSend = jest.fn();
      const oversizedTextStatus = jest.fn(() => ({ send: oversizedTextSend }));
      await textRoute!.handler(
        {
          body: {
            menu_text: oversizedUnicodeText,
          },
        },
        { status: oversizedTextStatus }
      );

      expect(oversizedTextStatus).toHaveBeenCalledWith(400);
      expect(oversizedTextSend).toHaveBeenCalledWith({
        error: 'Text too long. Maximum length is 50KB.',
      });

      const missingTextSend = jest.fn();
      const missingTextStatus = jest.fn(() => ({ send: missingTextSend }));
      await textRoute!.handler(
        {
          body: undefined,
        },
        { status: missingTextStatus }
      );

      expect(missingTextStatus).toHaveBeenCalledWith(400);
      expect(missingTextSend).toHaveBeenCalledWith({ error: 'Menu text is required' });

      for (const malformedBody of [['menu_text'], 'menu_text=Samosa']) {
        const malformedSend = jest.fn();
        const malformedStatus = jest.fn(() => ({ send: malformedSend }));
        await textRoute!.handler(
          {
            body: malformedBody,
          },
          { status: malformedStatus }
        );

        expect(malformedStatus).toHaveBeenCalledWith(400);
        expect(malformedSend).toHaveBeenCalledWith({ error: 'OCR request body must be an object' });
      }
      expect(extractFromText).not.toHaveBeenCalled();
    } finally {
      extractFromText.mockRestore();
    }
  });

  it('rejects invalid OCR bulk import input before capability or persistence work', async () => {
    const registeredPostRoutes: Array<{ path: string; handler: Function }> = [];
    const getRepository = jest
      .spyOn(AppDataSource, 'getRepository')
      .mockImplementation(() => {
        throw new Error('repositories should not be initialized for invalid OCR bulk import input');
      });
    const query = jest
      .spyOn(AppDataSource, 'query')
      .mockRejectedValue(new Error('ownership query should not run for invalid OCR bulk import input'));
    const fakeFastify = {
      addHook: jest.fn(),
      get: jest.fn(),
      post: jest.fn((path: string, _options: unknown, handler: Function) => {
        registeredPostRoutes.push({ path, handler });
      }),
      authenticate: jest.fn(),
    };

    try {
      await ocrRoutes(fakeFastify as any);
      const bulkRoute = registeredPostRoutes.find((item) => item.path === '/bulk-import');
      expect(bulkRoute).toBeDefined();

      const blankBusinessSend = jest.fn();
      const blankBusinessStatus = jest.fn(() => ({ send: blankBusinessSend }));
      await bulkRoute!.handler(
        {
          body: {
            business_id: '   ',
            dishes: [{ name: 'Samosa', price_cents: 2000 }],
          },
          user: { userId: 'user-1' },
        },
        { status: blankBusinessStatus }
      );

      expect(blankBusinessStatus).toHaveBeenCalledWith(400);
      expect(blankBusinessSend).toHaveBeenCalledWith({
        error: 'business_id and dishes array are required',
      });

      const emptyDishesSend = jest.fn();
      const emptyDishesStatus = jest.fn(() => ({ send: emptyDishesSend }));
      await bulkRoute!.handler(
        {
          body: {
            business_id: 'business-1',
            dishes: [],
          },
          user: { userId: 'user-1' },
        },
        { status: emptyDishesStatus }
      );

      expect(emptyDishesStatus).toHaveBeenCalledWith(400);
      expect(emptyDishesSend).toHaveBeenCalledWith({
        error: 'business_id and dishes array are required',
      });

      const missingBodySend = jest.fn();
      const missingBodyStatus = jest.fn(() => ({ send: missingBodySend }));
      await bulkRoute!.handler(
        {
          body: undefined,
          user: { userId: 'user-1' },
        },
        { status: missingBodyStatus }
      );

      expect(missingBodyStatus).toHaveBeenCalledWith(400);
      expect(missingBodySend).toHaveBeenCalledWith({
        error: 'business_id and dishes array are required',
      });

      for (const malformedBody of [['business_id'], 'business_id=business-1']) {
        const malformedBodySend = jest.fn();
        const malformedBodyStatus = jest.fn(() => ({ send: malformedBodySend }));
        await bulkRoute!.handler(
          {
            body: malformedBody,
            user: { userId: 'user-1' },
          },
          { status: malformedBodyStatus }
        );

        expect(malformedBodyStatus).toHaveBeenCalledWith(400);
        expect(malformedBodySend).toHaveBeenCalledWith({
          error: 'OCR request body must be an object',
        });
      }

      const invalidCreateCategoriesSend = jest.fn();
      const invalidCreateCategoriesStatus = jest.fn(() => ({ send: invalidCreateCategoriesSend }));
      await bulkRoute!.handler(
        {
          body: {
            business_id: 'business-1',
            dishes: [{ name: 'Samosa', price_cents: 2000 }],
            create_categories: 'yes',
          },
          user: { userId: 'user-1' },
        },
        { status: invalidCreateCategoriesStatus }
      );

      expect(invalidCreateCategoriesStatus).toHaveBeenCalledWith(400);
      expect(invalidCreateCategoriesSend).toHaveBeenCalledWith({
        error: 'create_categories must be a boolean when provided',
      });

      const unsafeDishFieldSend = jest.fn();
      const unsafeDishFieldStatus = jest.fn(() => ({ send: unsafeDishFieldSend }));
      await bulkRoute!.handler(
        {
          body: {
            business_id: 'business-1',
            dishes: [
              {
                name: 'Samosa',
                price_cents: 2000,
                ['confidence\uFEFF']: 90,
              },
            ],
          },
          user: { userId: 'user-1' },
        },
        { status: unsafeDishFieldStatus }
      );

      expect(unsafeDishFieldStatus).toHaveBeenCalledWith(400);
      expect(unsafeDishFieldSend).toHaveBeenCalledWith({
        error: 'OCR bulk import dish 1 field names must not include unsafe control characters',
      });

      const unsupportedDishFieldSend = jest.fn();
      const unsupportedDishFieldStatus = jest.fn(() => ({ send: unsupportedDishFieldSend }));
      await bulkRoute!.handler(
        {
          body: {
            business_id: 'business-1',
            dishes: [
              {
                name: 'Samosa',
                price_cents: 2000,
                provider_trace_id: 'trace-1',
              },
            ],
          },
          user: { userId: 'user-1' },
        },
        { status: unsupportedDishFieldStatus }
      );

      expect(unsupportedDishFieldStatus).toHaveBeenCalledWith(400);
      expect(unsupportedDishFieldSend).toHaveBeenCalledWith({
        error: 'OCR bulk import dish 1 include unsupported field(s): provider_trace_id',
      });

      for (const { body, error } of [
        {
          body: {
            business_id: 'business-\u202E1',
            dishes: [{ name: 'Samosa', price_cents: 2000 }],
          },
          error: 'OCR business ID must not include unsafe control characters',
        },
        {
          body: {
            business_id: 'business-1',
            dishes: [{ name: 'Samosa\u200B', price_cents: 2000 }],
          },
          error: 'OCR bulk import dish 1 name must not include unsafe control characters',
        },
        {
          body: {
            business_id: 'business-1',
            dishes: [{ name: 'Samosa', description: 'Crispy\u202E pastry', price_cents: 2000 }],
          },
          error: 'OCR bulk import dish 1 description must not include unsafe control characters',
        },
        {
          body: {
            business_id: 'business-1',
            dishes: [{ name: 'Samosa', category: 'Snacks\u2060', price_cents: 2000 }],
          },
          error: 'OCR bulk import dish 1 category must not include unsafe control characters',
        },
        {
          body: {
            business_id: 'business-1',
            dishes: [{ name: 'Samosa', price_cents: 2000, allergens: ['gluten\u200B'] }],
          },
          error: 'OCR bulk import dish 1 allergen must not include unsafe control characters',
        },
      ]) {
        const unsafeBulkTextSend = jest.fn();
        const unsafeBulkTextStatus = jest.fn(() => ({ send: unsafeBulkTextSend }));
        await bulkRoute!.handler(
          {
            body,
            user: { userId: 'user-1' },
          },
          { status: unsafeBulkTextStatus }
        );

        expect(unsafeBulkTextStatus).toHaveBeenCalledWith(400);
        expect(unsafeBulkTextSend).toHaveBeenCalledWith({ error });
      }

      for (const { body, error } of [
        {
          body: {
            business_id: 'b'.repeat(256),
            dishes: [{ name: 'Samosa', price_cents: 2000 }],
          },
          error: 'OCR business ID must be at most 255 characters',
        },
        {
          body: {
            business_id: 'business-1',
            dishes: [{ name: 'S'.repeat(121), price_cents: 2000 }],
          },
          error: 'OCR bulk import dish 1 name must be at most 120 characters',
        },
        {
          body: {
            business_id: 'business-1',
            dishes: [{ name: 'Samosa', description: 'C'.repeat(1001), price_cents: 2000 }],
          },
          error: 'OCR bulk import dish 1 description must be at most 1000 characters',
        },
        {
          body: {
            business_id: 'business-1',
            dishes: [{ name: 'Samosa', category: 'C'.repeat(121), price_cents: 2000 }],
          },
          error: 'OCR bulk import dish 1 category must be at most 120 characters',
        },
        {
          body: {
            business_id: 'business-1',
            dishes: [{ name: 'Samosa', price_cents: 2000, allergens: ['a'.repeat(121)] }],
          },
          error: 'OCR bulk import dish 1 allergen must be at most 120 characters',
        },
      ]) {
        const oversizedDishTextSend = jest.fn();
        const oversizedDishTextStatus = jest.fn(() => ({ send: oversizedDishTextSend }));
        await bulkRoute!.handler(
          {
            body,
            user: { userId: 'user-1' },
          },
          { status: oversizedDishTextStatus }
        );

        expect(oversizedDishTextStatus).toHaveBeenCalledWith(400);
        expect(oversizedDishTextSend).toHaveBeenCalledWith({ error });
      }

      for (const malformedDishes of [
        [{ name: '   ', price_cents: 2000 }],
        [{ name: 'Samosa', price_cents: 0 }],
        [{ name: 'Samosa', price_cents: 100_000_001 }],
        [{ name: 'Samosa', price_cents: '2000' }],
        [{ name: 'Samosa', price_cents: 2000, category: { name: 'snacks' } }],
        [{ name: 'Samosa', price_cents: 2000, allergens: ['gluten', '   '] }],
        [{ name: 'Samosa', price_cents: 2000, is_vegetarian: 'yes' }],
        [{ name: 'Samosa', price_cents: 2000, confidence: 89.5 }],
        [{ name: 'Samosa', price_cents: 2000, confidence: 101 }],
      ]) {
        const malformedDishSend = jest.fn();
        const malformedDishStatus = jest.fn(() => ({ send: malformedDishSend }));
        await bulkRoute!.handler(
          {
            body: {
              business_id: 'business-1',
              dishes: malformedDishes,
            },
            user: { userId: 'user-1' },
          },
          { status: malformedDishStatus }
        );

        expect(malformedDishStatus).toHaveBeenCalledWith(400);
        expect(malformedDishSend).toHaveBeenCalledWith({
          error: 'business_id and dishes array are required',
        });
      }
      expect(getRepository).not.toHaveBeenCalled();
      expect(query).not.toHaveBeenCalled();
    } finally {
      getRepository.mockRestore();
      query.mockRestore();
    }
  });

  it('persists normalized OCR bulk import gluten-free metadata with imported dishes', async () => {
    const registeredPostRoutes: Array<{ path: string; handler: Function }> = [];
    const ocrCapability = capabilityRegistry.find((capability) => capability.name === 'ocr_import');
    expect(ocrCapability).toBeDefined();
    const originalStatus = ocrCapability!.status;
    const originalOcrEnabled = process.env.OCR_ENABLED;
    const dishCreate = jest.fn((payload: Record<string, unknown>) => ({
      id: 'dish-1',
      ...payload,
    }));
    const dishSave = jest.fn(async (dish: Record<string, unknown>) => dish);
    const businessFindOne = jest.fn(async () => ({ id: 'business-1' }));
    const categoryFindOne = jest.fn(async () => ({ id: 'category-1' }));
    const categoryCreate = jest.fn((payload: Record<string, unknown>) => payload);
    const categorySave = jest.fn(async (category: Record<string, unknown>) => category);
    const getRepository = jest
      .spyOn(AppDataSource, 'getRepository')
      .mockImplementation((entity: any) => {
        if (entity === Dish) {
          return { create: dishCreate, save: dishSave } as any;
        }
        if (entity === Business) {
          return { findOne: businessFindOne } as any;
        }
        if (entity === DishCategory) {
          return { findOne: categoryFindOne, create: categoryCreate, save: categorySave } as any;
        }
        throw new Error('unexpected OCR bulk import repository');
      });
    const query = jest
      .spyOn(AppDataSource, 'query')
      .mockResolvedValue([{ id: 'business-1' }] as any);
    const fakeFastify = {
      addHook: jest.fn(),
      get: jest.fn(),
      post: jest.fn((path: string, _options: unknown, handler: Function) => {
        registeredPostRoutes.push({ path, handler });
      }),
      authenticate: jest.fn(),
    };

    try {
      ocrCapability!.status = 'implemented';
      process.env.OCR_ENABLED = 'true';

      await ocrRoutes(fakeFastify as any);
      const bulkRoute = registeredPostRoutes.find((item) => item.path === '/bulk-import');
      expect(bulkRoute).toBeDefined();

      const send = jest.fn();
      const status = jest.fn(() => ({ send }));
      await bulkRoute!.handler(
        {
          body: {
            business_id: 'business-1',
            dishes: [
              {
                name: 'Samosa',
                description: 'Crispy pastry',
                price_cents: 2000,
                category: 'snacks',
                allergens: ['gluten'],
                is_vegetarian: true,
                is_vegan: false,
                is_gluten_free: true,
                confidence: 92,
              },
            ],
            create_categories: true,
          },
          user: { userId: 'user-1' },
        },
        { send, status }
      );

      expect(status).not.toHaveBeenCalled();
      expect(businessFindOne).toHaveBeenCalledWith({ where: { id: 'business-1' } });
      expect(query).toHaveBeenCalledWith(
        'SELECT id FROM businesses WHERE id = $1 AND owner_id = $2',
        ['business-1', 'user-1']
      );
      expect(dishCreate).toHaveBeenCalledWith(expect.objectContaining({
        business_id: 'business-1',
        name: 'Samosa',
        allergen_tags: ['gluten'],
        metadata: {
          is_vegetarian: true,
          is_vegan: false,
          is_gluten_free: true,
        },
      }));
      expect(dishSave).toHaveBeenCalledWith(expect.objectContaining({
        metadata: expect.objectContaining({ is_gluten_free: true }),
      }));
      expect(send).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          imported_count: 1,
          categories_created: 0,
        }),
      }));
    } finally {
      ocrCapability!.status = originalStatus;
      if (originalOcrEnabled === undefined) {
        delete process.env.OCR_ENABLED;
      } else {
        process.env.OCR_ENABLED = originalOcrEnabled;
      }
      getRepository.mockRestore();
      query.mockRestore();
    }
  });

  it('rejects oversized OCR authenticated user IDs before capability or persistence work', async () => {
    const registeredGetRoutes: Array<{ path: string; handler: Function }> = [];
    const registeredPostRoutes: Array<{ path: string; handler: Function }> = [];
    const extractFromImage = jest
      .spyOn(OCRService, 'extractFromImage')
      .mockRejectedValue(new Error('extractFromImage should not be called for oversized OCR authenticated user IDs'));
    const extractFromText = jest
      .spyOn(OCRService, 'extractFromText')
      .mockRejectedValue(new Error('extractFromText should not be called for oversized OCR authenticated user IDs'));
    const getStats = jest
      .spyOn(OCRService, 'getStats')
      .mockImplementation(() => {
        throw new Error('getStats should not be called for oversized OCR authenticated user IDs');
      });
    const getRepository = jest
      .spyOn(AppDataSource, 'getRepository')
      .mockImplementation(() => {
        throw new Error('repositories should not be initialized for oversized OCR authenticated user IDs');
      });
    const query = jest
      .spyOn(AppDataSource, 'query')
      .mockRejectedValue(new Error('ownership query should not run for oversized OCR authenticated user IDs'));
    const fakeFastify = {
      addHook: jest.fn(),
      get: jest.fn((path: string, _options: unknown, handler: Function) => {
        registeredGetRoutes.push({ path, handler });
      }),
      post: jest.fn((path: string, _options: unknown, handler: Function) => {
        registeredPostRoutes.push({ path, handler });
      }),
      authenticate: jest.fn(),
    };

    try {
      await ocrRoutes(fakeFastify as any);
      const imageRoute = registeredPostRoutes.find((item) => item.path === '/extract-from-image');
      const textRoute = registeredPostRoutes.find((item) => item.path === '/extract-from-text');
      const bulkRoute = registeredPostRoutes.find((item) => item.path === '/bulk-import');
      const statsRoute = registeredGetRoutes.find((item) => item.path === '/stats');
      expect(imageRoute).toBeDefined();
      expect(textRoute).toBeDefined();
      expect(bulkRoute).toBeDefined();
      expect(statsRoute).toBeDefined();

      for (const { handler, request } of [
        {
          handler: imageRoute!.handler,
          request: {
            body: {
              image: Buffer.from('menu image').toString('base64'),
              mime_type: 'image/jpeg',
            },
            user: { userId: 'u'.repeat(256) },
          },
        },
        {
          handler: textRoute!.handler,
          request: {
            body: {
              menu_text: 'Samosa 20',
            },
            user: { userId: 'u'.repeat(256) },
          },
        },
        {
          handler: bulkRoute!.handler,
          request: {
            body: {
              business_id: 'business-1',
              dishes: [{ name: 'Samosa', price_cents: 2000 }],
            },
            user: { userId: 'u'.repeat(256) },
          },
        },
        {
          handler: statsRoute!.handler,
          request: {
            user: { userId: 'u'.repeat(256) },
          },
        },
      ]) {
        const send = jest.fn();
        const status = jest.fn(() => ({ send }));
        await handler({ ...request, log: { error: jest.fn() } }, { status });

        expect(status).toHaveBeenCalledWith(400);
        expect(send).toHaveBeenCalledWith({
          error: 'OCR user ID must be at most 255 characters',
        });
      }
      expect(extractFromImage).not.toHaveBeenCalled();
      expect(extractFromText).not.toHaveBeenCalled();
      expect(getStats).not.toHaveBeenCalled();
      expect(getRepository).not.toHaveBeenCalled();
      expect(query).not.toHaveBeenCalled();
    } finally {
      extractFromImage.mockRestore();
      extractFromText.mockRestore();
      getStats.mockRestore();
      getRepository.mockRestore();
      query.mockRestore();
    }
  });

  it('reuses existing OCR bulk import categories when category creation is disabled', async () => {
    const registeredPostRoutes: Array<{ path: string; handler: Function }> = [];
    const ocrCapability = capabilityRegistry.find((capability) => capability.name === 'ocr_import');
    expect(ocrCapability).toBeDefined();
    const originalStatus = ocrCapability!.status;
    const originalOcrEnabled = process.env.OCR_ENABLED;
    const dishCreate = jest.fn((payload: Record<string, unknown>) => ({
      id: 'dish-1',
      ...payload,
    }));
    const dishSave = jest.fn(async (dish: Record<string, unknown>) => dish);
    const businessFindOne = jest.fn(async () => ({ id: 'business-1' }));
    const categoryFindOne = jest.fn(async () => ({ id: 'category-1' }));
    const categoryCreate = jest.fn((payload: Record<string, unknown>) => payload);
    const categorySave = jest.fn(async (category: Record<string, unknown>) => category);
    const getRepository = jest
      .spyOn(AppDataSource, 'getRepository')
      .mockImplementation((entity: any) => {
        if (entity === Dish) {
          return { create: dishCreate, save: dishSave } as any;
        }
        if (entity === Business) {
          return { findOne: businessFindOne } as any;
        }
        if (entity === DishCategory) {
          return { findOne: categoryFindOne, create: categoryCreate, save: categorySave } as any;
        }
        throw new Error('unexpected OCR bulk import repository');
      });
    const query = jest
      .spyOn(AppDataSource, 'query')
      .mockResolvedValue([{ id: 'business-1' }] as any);
    const fakeFastify = {
      addHook: jest.fn(),
      get: jest.fn(),
      post: jest.fn((path: string, _options: unknown, handler: Function) => {
        registeredPostRoutes.push({ path, handler });
      }),
      authenticate: jest.fn(),
    };

    try {
      ocrCapability!.status = 'implemented';
      process.env.OCR_ENABLED = 'true';

      await ocrRoutes(fakeFastify as any);
      const bulkRoute = registeredPostRoutes.find((item) => item.path === '/bulk-import');
      expect(bulkRoute).toBeDefined();

      const send = jest.fn();
      const status = jest.fn(() => ({ send }));
      await bulkRoute!.handler(
        {
          body: {
            business_id: 'business-1',
            dishes: [
              {
                name: 'Samosa',
                price_cents: 2000,
                category: 'snacks',
                confidence: 92,
              },
            ],
            create_categories: false,
          },
          user: { userId: 'user-1' },
        },
        { send, status }
      );

      expect(status).not.toHaveBeenCalled();
      expect(categoryFindOne).toHaveBeenCalledWith({
        where: {
          business_id: 'business-1',
          name: 'snacks',
        },
      });
      expect(categoryCreate).not.toHaveBeenCalled();
      expect(categorySave).not.toHaveBeenCalled();
      expect(dishCreate).toHaveBeenCalledWith(expect.objectContaining({
        business_id: 'business-1',
        name: 'Samosa',
        category_id: 'category-1',
      }));
      expect(send).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          imported_count: 1,
          categories_created: 0,
        }),
      }));
    } finally {
      ocrCapability!.status = originalStatus;
      if (originalOcrEnabled === undefined) {
        delete process.env.OCR_ENABLED;
      } else {
        process.env.OCR_ENABLED = originalOcrEnabled;
      }
      getRepository.mockRestore();
      query.mockRestore();
    }
  });

  it('rejects malformed or unsupported OCR stats query fields before stats dispatch', async () => {
    const registeredGetRoutes: Array<{ path: string; handler: Function }> = [];
    const getStats = jest
      .spyOn(OCRService, 'getStats')
      .mockImplementation(() => {
        throw new Error('getStats should not be called for invalid OCR stats query input');
      });
    const fakeFastify = {
      addHook: jest.fn(),
      get: jest.fn((path: string, _options: unknown, handler: Function) => {
        registeredGetRoutes.push({ path, handler });
      }),
      post: jest.fn(),
      authenticate: jest.fn(),
    };

    try {
      await ocrRoutes(fakeFastify as any);
      const statsRoute = registeredGetRoutes.find((item) => item.path === '/stats');
      expect(statsRoute).toBeDefined();

      for (const malformedQuery of ['includeProviderHealth=true', ['includeProviderHealth']]) {
        const send = jest.fn();
        const status = jest.fn(() => ({ send }));
        await statsRoute!.handler(
          {
            query: malformedQuery,
          },
          { status }
        );

        expect(status).toHaveBeenCalledWith(400);
        expect(send).toHaveBeenCalledWith({ error: 'OCR stats query must be an object' });
      }

      const unsupportedSend = jest.fn();
      const unsupportedStatus = jest.fn(() => ({ send: unsupportedSend }));
      await statsRoute!.handler(
        {
          query: { include_provider_health: 'true' },
        },
        { status: unsupportedStatus }
      );

      expect(unsupportedStatus).toHaveBeenCalledWith(400);
      expect(unsupportedSend).toHaveBeenCalledWith({
        error: 'Unsupported OCR query field(s): include_provider_health',
      });

      const unsafeStatsQueryFieldNameSend = jest.fn();
      const unsafeStatsQueryFieldNameStatus = jest.fn(() => ({ send: unsafeStatsQueryFieldNameSend }));
      await statsRoute!.handler(
        {
          query: { ['include_provider_health\uFEFF']: 'true' },
        },
        { status: unsafeStatsQueryFieldNameStatus }
      );

      expect(unsafeStatsQueryFieldNameStatus).toHaveBeenCalledWith(400);
      expect(unsafeStatsQueryFieldNameSend).toHaveBeenCalledWith({
        error: 'OCR stats query field names must not include unsafe control characters',
      });
      expect(getStats).not.toHaveBeenCalled();
    } finally {
      getStats.mockRestore();
    }
  });

  it('rejects unsupported subscription route body fields before service calls', async () => {
    const registeredPostRoutes: Array<{ path: string; handler: Function }> = [];
    const registeredGetRoutes: Array<{ path: string; handler: Function }> = [];
    const createSubscription = jest
      .spyOn(SubscriptionService.prototype, 'createSubscription')
      .mockRejectedValue(new Error('createSubscription should not be called'));
    const getSubscription = jest
      .spyOn(SubscriptionService.prototype, 'getSubscription')
      .mockRejectedValue(new Error('getSubscription should not be called'));
    const cancelSubscription = jest
      .spyOn(SubscriptionService.prototype, 'cancelSubscription')
      .mockRejectedValue(new Error('cancelSubscription should not be called'));
    const resumeSubscription = jest
      .spyOn(SubscriptionService.prototype, 'resumeSubscription')
      .mockRejectedValue(new Error('resumeSubscription should not be called'));
    const createPortalSession = jest
      .spyOn(SubscriptionService.prototype, 'createPortalSession')
      .mockRejectedValue(new Error('createPortalSession should not be called'));
    const checkOrderLimit = jest
      .spyOn(SubscriptionService.prototype, 'checkOrderLimit')
      .mockRejectedValue(new Error('checkOrderLimit should not be called'));
    const fakeFastify = {
      get: jest.fn((path: string, _options: unknown, handler: Function) => {
        registeredGetRoutes.push({ path, handler });
      }),
      post: jest.fn((path: string, _options: unknown, handler: Function) => {
        registeredPostRoutes.push({ path, handler });
      }),
    };

    try {
      await subscriptionRoutes(fakeFastify as any);
      const tiersRoute = registeredGetRoutes.find((item) => item.path === '/tiers');
      const currentRoute = registeredGetRoutes.find((item) => item.path === '/current');
      const subscribeRoute = registeredPostRoutes.find((item) => item.path === '/subscribe');
      const cancelRoute = registeredPostRoutes.find((item) => item.path === '/cancel');
      const resumeRoute = registeredPostRoutes.find((item) => item.path === '/resume');
      const portalRoute = registeredGetRoutes.find((item) => item.path === '/portal');
      const usageRoute = registeredGetRoutes.find((item) => item.path === '/usage');
      expect(tiersRoute).toBeDefined();
      expect(currentRoute).toBeDefined();
      expect(subscribeRoute).toBeDefined();
      expect(cancelRoute).toBeDefined();
      expect(resumeRoute).toBeDefined();
      expect(portalRoute).toBeDefined();
      expect(usageRoute).toBeDefined();

      for (const { route, body } of [
        { route: subscribeRoute!, body: ['starter'] },
        { route: cancelRoute!, body: ['immediate'] },
        { route: resumeRoute!, body: ['resume'] },
        { route: subscribeRoute!, body: 'tier=starter' },
        { route: cancelRoute!, body: 'immediate=true' },
        { route: resumeRoute!, body: 'resume=true' },
      ]) {
        const malformedSend = jest.fn();
        const malformedStatus = jest.fn(() => ({ send: malformedSend }));
        await route.handler(
          {
            body,
            user: { businessId: 'business-1', userId: 'user-1' },
          },
          { status: malformedStatus }
        );

        expect(malformedStatus).toHaveBeenCalledWith(400);
        expect(malformedSend).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'INVALID_SUBSCRIPTION_REQUEST_BODY',
            message: 'Subscription request body must be an object',
          },
        });
      }

      for (const { route, malformedQuery } of [
        { route: tiersRoute!, malformedQuery: 'includePrices=true' },
        { route: tiersRoute!, malformedQuery: ['includePrices'] },
        { route: currentRoute!, malformedQuery: 'includeUsage=true' },
        { route: currentRoute!, malformedQuery: ['includeUsage'] },
        { route: subscribeRoute!, malformedQuery: 'launchMode=live' },
        { route: subscribeRoute!, malformedQuery: ['launchMode'] },
        { route: cancelRoute!, malformedQuery: 'refund=true' },
        { route: cancelRoute!, malformedQuery: ['refund'] },
        { route: resumeRoute!, malformedQuery: 'force=true' },
        { route: resumeRoute!, malformedQuery: ['force'] },
        { route: portalRoute!, malformedQuery: 'returnUrl=https://app.example.com/subscriptions' },
        { route: portalRoute!, malformedQuery: ['returnUrl'] },
        { route: usageRoute!, malformedQuery: 'includePlan=true' },
        { route: usageRoute!, malformedQuery: ['includePlan'] },
      ]) {
        const malformedSend = jest.fn();
        const malformedStatus = jest.fn(() => ({ send: malformedSend }));
        await route.handler(
          {
            query: malformedQuery,
            user: { businessId: 'business-1', userId: 'user-1' },
          },
          { status: malformedStatus }
        );

        expect(malformedStatus).toHaveBeenCalledWith(400);
        expect(malformedSend).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'INVALID_SUBSCRIPTION_QUERY',
            message: 'Subscription query must be an object',
          },
        });
      }

      for (const { route, body, query, message } of [
        {
          route: subscribeRoute!,
          body: { tier: 'starter' },
          query: { launchMode: 'live' },
          message: 'Unsupported subscription request field(s): launchMode',
        },
        {
          route: cancelRoute!,
          body: { immediate: true },
          query: { refund: 'true' },
          message: 'Unsupported subscription request field(s): refund',
        },
        {
          route: resumeRoute!,
          body: {},
          query: { force: 'true' },
          message: 'Unsupported subscription request field(s): force',
        },
      ]) {
        const unsupportedCommandQuerySend = jest.fn();
        const unsupportedCommandQueryStatus = jest.fn(() => ({ send: unsupportedCommandQuerySend }));
        await route.handler(
          {
            body,
            query,
            user: { businessId: 'business-1', userId: 'user-1' },
          },
          { status: unsupportedCommandQueryStatus }
        );

        expect(unsupportedCommandQueryStatus).toHaveBeenCalledWith(400);
        expect(unsupportedCommandQuerySend).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'UNSUPPORTED_SUBSCRIPTION_FIELD',
            message,
          },
        });
      }

      const subscribeSend = jest.fn();
      await subscribeRoute!.handler(
        {
          body: {
            tier: 'starter',
            trialDays: 14,
            launchMode: 'live',
          },
          user: { businessId: 'business-1', userId: 'user-1' },
        },
        { status: jest.fn(() => ({ send: subscribeSend })) }
      );

      expect(subscribeSend).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'UNSUPPORTED_SUBSCRIPTION_FIELD',
          message: 'Unsupported subscription request field(s): launchMode',
        },
      });

      const cancelSend = jest.fn();
      await cancelRoute!.handler(
        {
          body: {
            immediate: true,
            refund: true,
          },
          user: { businessId: 'business-1', userId: 'user-1' },
        },
        { status: jest.fn(() => ({ send: cancelSend })) }
      );

      expect(cancelSend).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'UNSUPPORTED_SUBSCRIPTION_FIELD',
          message: 'Unsupported subscription request field(s): refund',
        },
      });

      const resumeSend = jest.fn();
      await resumeRoute!.handler(
        {
          body: {
            immediate: true,
          },
          user: { businessId: 'business-1', userId: 'user-1' },
        },
        { status: jest.fn(() => ({ send: resumeSend })) }
      );

      expect(resumeSend).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'UNSUPPORTED_SUBSCRIPTION_FIELD',
          message: 'Unsupported subscription request field(s): immediate',
        },
      });

      const portalSend = jest.fn();
      await portalRoute!.handler(
        {
          query: {
            returnUrl: 'https://app.example.com/subscriptions',
            launchMode: 'live',
          },
          user: { businessId: 'business-1', userId: 'user-1' },
        },
        { status: jest.fn(() => ({ send: portalSend })) }
      );

      expect(portalSend).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'UNSUPPORTED_SUBSCRIPTION_FIELD',
          message: 'Unsupported subscription request field(s): launchMode',
        },
      });

      for (const { route, query, message } of [
        {
          route: tiersRoute!,
          query: { includePrices: 'true' },
          message: 'Unsupported subscription request field(s): includePrices',
        },
        {
          route: currentRoute!,
          query: { includeUsage: 'true' },
          message: 'Unsupported subscription request field(s): includeUsage',
        },
        {
          route: usageRoute!,
          query: { includePlan: 'true' },
          message: 'Unsupported subscription request field(s): includePlan',
        },
      ]) {
        const unsupportedQuerySend = jest.fn();
        const unsupportedQueryStatus = jest.fn(() => ({ send: unsupportedQuerySend }));
        await route.handler(
          {
            query,
            user: { businessId: 'business-1', userId: 'user-1' },
          },
          { status: unsupportedQueryStatus }
        );

        expect(unsupportedQueryStatus).toHaveBeenCalledWith(400);
        expect(unsupportedQuerySend).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'UNSUPPORTED_SUBSCRIPTION_FIELD',
            message,
          },
        });
      }

      for (const { route, body, query, message } of [
        {
          route: tiersRoute!,
          query: { ['includePrices\uFEFF']: 'true' },
          message: 'Subscription tiers query field names must not include unsafe control characters',
        },
        {
          route: currentRoute!,
          query: { ['includeUsage\uFEFF']: 'true' },
          message: 'Subscription current query field names must not include unsafe control characters',
        },
        {
          route: subscribeRoute!,
          body: { tier: 'starter' },
          query: { ['launchMode\uFEFF']: 'live' },
          message: 'Subscription subscribe query field names must not include unsafe control characters',
        },
        {
          route: subscribeRoute!,
          body: {
            tier: 'starter',
            trialDays: 14,
            ['launchMode\uFEFF']: 'live',
          },
          message: 'Subscription subscribe request field names must not include unsafe control characters',
        },
        {
          route: cancelRoute!,
          body: { immediate: true },
          query: { ['refund\uFEFF']: 'true' },
          message: 'Subscription cancel query field names must not include unsafe control characters',
        },
        {
          route: cancelRoute!,
          body: {
            immediate: true,
            ['refund\uFEFF']: true,
          },
          message: 'Subscription cancel request field names must not include unsafe control characters',
        },
        {
          route: resumeRoute!,
          body: {},
          query: { ['force\uFEFF']: 'true' },
          message: 'Subscription resume query field names must not include unsafe control characters',
        },
        {
          route: resumeRoute!,
          body: { ['immediate\uFEFF']: true },
          message: 'Subscription resume request field names must not include unsafe control characters',
        },
        {
          route: portalRoute!,
          query: {
            returnUrl: 'https://app.example.com/subscriptions',
            ['launchMode\uFEFF']: 'live',
          },
          message: 'Subscription portal query field names must not include unsafe control characters',
        },
        {
          route: usageRoute!,
          query: { ['includePlan\uFEFF']: 'true' },
          message: 'Subscription usage query field names must not include unsafe control characters',
        },
      ]) {
        const unsafeFieldNameSend = jest.fn();
        const unsafeFieldNameStatus = jest.fn(() => ({ send: unsafeFieldNameSend }));
        await route.handler(
          {
            body,
            query,
            user: { businessId: 'business-1', userId: 'user-1' },
          },
          { status: unsafeFieldNameStatus }
        );

        expect(unsafeFieldNameStatus).toHaveBeenCalledWith(400);
        expect(unsafeFieldNameSend).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'INVALID_SUBSCRIPTION_FIELD_NAME',
            message,
          },
        });
      }
      expect(getSubscription).not.toHaveBeenCalled();
      expect(createSubscription).not.toHaveBeenCalled();
      expect(cancelSubscription).not.toHaveBeenCalled();
      expect(resumeSubscription).not.toHaveBeenCalled();
      expect(createPortalSession).not.toHaveBeenCalled();
      expect(checkOrderLimit).not.toHaveBeenCalled();
    } finally {
      getSubscription.mockRestore();
      createSubscription.mockRestore();
      cancelSubscription.mockRestore();
      resumeSubscription.mockRestore();
      createPortalSession.mockRestore();
      checkOrderLimit.mockRestore();
    }
  });

  it('rejects invalid subscription auth identity before billing request metadata', async () => {
    const registeredPostRoutes: Array<{ path: string; handler: Function }> = [];
    const registeredGetRoutes: Array<{ path: string; handler: Function }> = [];
    const getSubscription = jest
      .spyOn(SubscriptionService.prototype, 'getSubscription')
      .mockRejectedValue(new Error('getSubscription should not be called for invalid subscription auth'));
    const createSubscription = jest
      .spyOn(SubscriptionService.prototype, 'createSubscription')
      .mockRejectedValue(new Error('createSubscription should not be called for invalid subscription auth'));
    const cancelSubscription = jest
      .spyOn(SubscriptionService.prototype, 'cancelSubscription')
      .mockRejectedValue(new Error('cancelSubscription should not be called for invalid subscription auth'));
    const resumeSubscription = jest
      .spyOn(SubscriptionService.prototype, 'resumeSubscription')
      .mockRejectedValue(new Error('resumeSubscription should not be called for invalid subscription auth'));
    const createPortalSession = jest
      .spyOn(SubscriptionService.prototype, 'createPortalSession')
      .mockRejectedValue(new Error('createPortalSession should not be called for invalid subscription auth'));
    const checkOrderLimit = jest
      .spyOn(SubscriptionService.prototype, 'checkOrderLimit')
      .mockRejectedValue(new Error('checkOrderLimit should not be called for invalid subscription auth'));
    const fakeFastify = {
      get: jest.fn((path: string, _options: unknown, handler: Function) => {
        registeredGetRoutes.push({ path, handler });
      }),
      post: jest.fn((path: string, _options: unknown, handler: Function) => {
        registeredPostRoutes.push({ path, handler });
      }),
    };

    try {
      await subscriptionRoutes(fakeFastify as any);
      const currentRoute = registeredGetRoutes.find((item) => item.path === '/current');
      const subscribeRoute = registeredPostRoutes.find((item) => item.path === '/subscribe');
      const cancelRoute = registeredPostRoutes.find((item) => item.path === '/cancel');
      const resumeRoute = registeredPostRoutes.find((item) => item.path === '/resume');
      const portalRoute = registeredGetRoutes.find((item) => item.path === '/portal');
      const usageRoute = registeredGetRoutes.find((item) => item.path === '/usage');
      expect(currentRoute).toBeDefined();
      expect(subscribeRoute).toBeDefined();
      expect(cancelRoute).toBeDefined();
      expect(resumeRoute).toBeDefined();
      expect(portalRoute).toBeDefined();
      expect(usageRoute).toBeDefined();

      for (const { route, request, expected } of [
        {
          route: currentRoute!,
          request: {
            query: 'includeUsage=true',
            user: { businessId: 'business-\u202E1', userId: 'user-1' },
          },
          expected: {
            code: 'INVALID_SUBSCRIPTION_TEXT_FIELD',
            message: 'Subscription business ID must not include unsafe control characters',
          },
        },
        {
          route: subscribeRoute!,
          request: {
            body: ['starter'],
            query: { launchMode: 'live' },
            user: { businessId: 'b'.repeat(256), userId: 'user-1' },
          },
          expected: {
            code: 'INVALID_SUBSCRIPTION_TEXT_FIELD',
            message: 'Subscription business ID must be at most 255 characters',
          },
        },
        {
          route: cancelRoute!,
          request: {
            body: { immediate: 'true\uFEFF' },
            query: { refund: 'true' },
            user: { businessId: 'business-1' },
          },
          expected: {
            code: 'NO_USER',
            message: 'User identity is required',
          },
        },
        {
          route: resumeRoute!,
          request: {
            body: ['resume'],
            query: { force: 'true' },
          },
          expected: {
            code: 'NO_BUSINESS',
            message: 'User has no business associated',
          },
        },
        {
          route: portalRoute!,
          request: {
            query: { returnUrl: 'javascript:alert(1)' },
            user: { businessId: 'business-1', userId: 'u'.repeat(256) },
          },
          expected: {
            code: 'INVALID_SUBSCRIPTION_TEXT_FIELD',
            message: 'Subscription user ID must be at most 255 characters',
          },
        },
        {
          route: usageRoute!,
          request: {
            query: 'includePlan=true',
            user: { businessId: 'business-\u200B1', userId: 'user-1' },
          },
          expected: {
            code: 'INVALID_SUBSCRIPTION_TEXT_FIELD',
            message: 'Subscription business ID must not include unsafe control characters',
          },
        },
      ]) {
        const send = jest.fn();
        const status = jest.fn(() => ({ send }));

        await route.handler(request, { status });

        expect(status).toHaveBeenCalledWith(400);
        expect(send).toHaveBeenCalledWith({
          success: false,
          error: expected,
        });
      }

      expect(getSubscription).not.toHaveBeenCalled();
      expect(createSubscription).not.toHaveBeenCalled();
      expect(cancelSubscription).not.toHaveBeenCalled();
      expect(resumeSubscription).not.toHaveBeenCalled();
      expect(createPortalSession).not.toHaveBeenCalled();
      expect(checkOrderLimit).not.toHaveBeenCalled();
    } finally {
      getSubscription.mockRestore();
      createSubscription.mockRestore();
      cancelSubscription.mockRestore();
      resumeSubscription.mockRestore();
      createPortalSession.mockRestore();
      checkOrderLimit.mockRestore();
    }
  });

  it('rejects malformed or unsupported subscription webhook query fields before signature handling', async () => {
    const registeredPostRoutes: Array<{ path: string; handler: Function }> = [];
    const fakeFastify = {
      get: jest.fn(),
      post: jest.fn((path: string, _options: unknown, handler: Function) => {
        registeredPostRoutes.push({ path, handler });
      }),
    };

    await subscriptionRoutes(fakeFastify as any);
    const webhookRoute = registeredPostRoutes.find((item) => item.path === '/webhook');
    expect(webhookRoute).toBeDefined();

    for (const query of ['replay=true', ['replay']]) {
      const send = jest.fn();
      const status = jest.fn(() => ({ send }));
      await webhookRoute!.handler(
        {
          query,
          headers: {},
          body: { id: 'evt_sub_replay_override' },
        },
        { status }
      );

      expect(status).toHaveBeenCalledWith(400);
      expect(send).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_SUBSCRIPTION_QUERY',
          message: 'Subscription query must be an object',
        },
      });
    }

    const unsupportedSend = jest.fn();
    const unsupportedStatus = jest.fn(() => ({ send: unsupportedSend }));
    await webhookRoute!.handler(
      {
        query: { replay: 'true' },
        headers: {},
        body: { id: 'evt_sub_replay_override' },
      },
      { status: unsupportedStatus }
    );

    expect(unsupportedStatus).toHaveBeenCalledWith(400);
    expect(unsupportedSend).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'UNSUPPORTED_SUBSCRIPTION_FIELD',
        message: 'Unsupported subscription request field(s): replay',
      },
    });

    const unsafeFieldNameSend = jest.fn();
    const unsafeFieldNameStatus = jest.fn(() => ({ send: unsafeFieldNameSend }));
    await webhookRoute!.handler(
      {
        query: { ['replay\uFEFF']: 'true' },
        headers: {},
        body: { id: 'evt_sub_replay_override' },
      },
      { status: unsafeFieldNameStatus }
    );

    expect(unsafeFieldNameStatus).toHaveBeenCalledWith(400);
    expect(unsafeFieldNameSend).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'INVALID_SUBSCRIPTION_FIELD_NAME',
        message: 'Subscription webhook query field names must not include unsafe control characters',
      },
    });

    const unsafeSignatureSend = jest.fn();
    const unsafeSignatureStatus = jest.fn(() => ({ send: unsafeSignatureSend }));
    await webhookRoute!.handler(
      {
        query: {},
        headers: { 'stripe-signature': 't=123,v1=abc\uFEFF' },
        rawBody: Buffer.from('{"id":"evt_sub_unsafe_signature"}'),
      },
      { status: unsafeSignatureStatus }
    );

    expect(unsafeSignatureStatus).toHaveBeenCalledWith(400);
    expect(unsafeSignatureSend).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'INVALID_SUBSCRIPTION_TEXT_FIELD',
        message: 'Stripe subscription signature must not include unsafe control characters',
      },
    });

    const oversizedSignatureSend = jest.fn();
    const oversizedSignatureStatus = jest.fn(() => ({ send: oversizedSignatureSend }));
    await webhookRoute!.handler(
      {
        query: {},
        headers: { 'stripe-signature': `t=123,v1=${'a'.repeat(4097)}` },
        rawBody: Buffer.from('{"id":"evt_sub_oversized_signature"}'),
      },
      { status: oversizedSignatureStatus }
    );

    expect(oversizedSignatureStatus).toHaveBeenCalledWith(400);
    expect(oversizedSignatureSend).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'INVALID_SUBSCRIPTION_TEXT_FIELD',
        message: 'Stripe subscription signature must be at most 4096 characters',
      },
    });
  });

  it('rejects invalid subscription route options before service calls', async () => {
    const registeredPostRoutes: Array<{ path: string; handler: Function }> = [];
    const createSubscription = jest
      .spyOn(SubscriptionService.prototype, 'createSubscription')
      .mockRejectedValue(new Error('createSubscription should not be called'));
    const cancelSubscription = jest
      .spyOn(SubscriptionService.prototype, 'cancelSubscription')
      .mockRejectedValue(new Error('cancelSubscription should not be called'));
    const resumeSubscription = jest
      .spyOn(SubscriptionService.prototype, 'resumeSubscription')
      .mockRejectedValue(new Error('resumeSubscription should not be called'));
    const fakeFastify = {
      get: jest.fn(),
      post: jest.fn((path: string, _options: unknown, handler: Function) => {
        registeredPostRoutes.push({ path, handler });
      }),
    };

    try {
      await subscriptionRoutes(fakeFastify as any);
      const subscribeRoute = registeredPostRoutes.find((item) => item.path === '/subscribe');
      const cancelRoute = registeredPostRoutes.find((item) => item.path === '/cancel');
      const resumeRoute = registeredPostRoutes.find((item) => item.path === '/resume');
      expect(subscribeRoute).toBeDefined();
      expect(cancelRoute).toBeDefined();
      expect(resumeRoute).toBeDefined();

      const invalidTrialDaysSend = jest.fn();
      const invalidTrialDaysStatus = jest.fn(() => ({ send: invalidTrialDaysSend }));
      await subscribeRoute!.handler(
        {
          body: {
            tier: 'starter',
            trialDays: 0,
            email: 'seller@example.com',
          },
          user: { businessId: 'business-1', userId: 'user-1' },
        },
        { status: invalidTrialDaysStatus }
      );

      expect(invalidTrialDaysStatus).toHaveBeenCalledWith(400);
      expect(invalidTrialDaysSend).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_TRIAL_DAYS',
          message: 'subscription trialDays must be a positive safe integer between 1 and 365',
        },
      });

      const unsafeTrialDaysSend = jest.fn();
      const unsafeTrialDaysStatus = jest.fn(() => ({ send: unsafeTrialDaysSend }));
      await subscribeRoute!.handler(
        {
          body: {
            tier: 'starter',
            trialDays: '14\uFEFF',
            email: 'seller@example.com',
          },
          user: { businessId: 'business-1', userId: 'user-1' },
        },
        { status: unsafeTrialDaysStatus }
      );

      expect(unsafeTrialDaysStatus).toHaveBeenCalledWith(400);
      expect(unsafeTrialDaysSend).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_SUBSCRIPTION_TEXT_FIELD',
          message: 'Subscription trialDays must not include unsafe control characters',
        },
      });

      const invalidEmailSend = jest.fn();
      const invalidEmailStatus = jest.fn(() => ({ send: invalidEmailSend }));
      await subscribeRoute!.handler(
        {
          body: {
            tier: 'starter',
            trialDays: 14,
            email: '   ',
          },
          user: { businessId: 'business-1', userId: 'user-1' },
        },
        { status: invalidEmailStatus }
      );

      expect(invalidEmailStatus).toHaveBeenCalledWith(400);
      expect(invalidEmailSend).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_EMAIL',
          message: 'subscription customer email must be a valid email address',
        },
      });

      const oversizedEmailSend = jest.fn();
      const oversizedEmailStatus = jest.fn(() => ({ send: oversizedEmailSend }));
      await subscribeRoute!.handler(
        {
          body: {
            tier: 'starter',
            trialDays: 14,
            email: `${'s'.repeat(243)}@example.com`,
          },
          user: { businessId: 'business-1', userId: 'user-1' },
        },
        { status: oversizedEmailStatus }
      );

      expect(oversizedEmailStatus).toHaveBeenCalledWith(400);
      expect(oversizedEmailSend).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_EMAIL',
          message: 'subscription customer email must be a valid email address',
        },
      });

      for (const { body, message } of [
        {
          body: {
            tier: 'starter\u202E',
            trialDays: 14,
            email: 'seller@example.com',
          },
          message: 'Subscription tier must not include unsafe control characters',
        },
        {
          body: {
            tier: 'starter',
            trialDays: 14,
            email: 'seller\u200B@example.com',
          },
          message: 'Subscription customer email must not include unsafe control characters',
        },
      ]) {
        const unsafeTextSend = jest.fn();
        const unsafeTextStatus = jest.fn(() => ({ send: unsafeTextSend }));
        await subscribeRoute!.handler(
          {
            body,
            user: { businessId: 'business-1', userId: 'user-1' },
          },
          { status: unsafeTextStatus }
        );

        expect(unsafeTextStatus).toHaveBeenCalledWith(400);
        expect(unsafeTextSend).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'INVALID_SUBSCRIPTION_TEXT_FIELD',
            message,
          },
        });
      }

      const invalidImmediateSend = jest.fn();
      const invalidImmediateStatus = jest.fn(() => ({ send: invalidImmediateSend }));
      await cancelRoute!.handler(
        {
          body: {
            immediate: 'yes',
          },
          user: { businessId: 'business-1', userId: 'user-1' },
        },
        { status: invalidImmediateStatus }
      );

      expect(invalidImmediateStatus).toHaveBeenCalledWith(400);
      expect(invalidImmediateSend).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_CANCELLATION_OPTION',
          message: 'subscription cancellation immediate must be a boolean',
        },
      });

      const unsafeImmediateSend = jest.fn();
      const unsafeImmediateStatus = jest.fn(() => ({ send: unsafeImmediateSend }));
      await cancelRoute!.handler(
        {
          body: {
            immediate: 'true\uFEFF',
          },
          user: { businessId: 'business-1', userId: 'user-1' },
        },
        { status: unsafeImmediateStatus }
      );

      expect(unsafeImmediateStatus).toHaveBeenCalledWith(400);
      expect(unsafeImmediateSend).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_SUBSCRIPTION_TEXT_FIELD',
          message: 'Subscription cancellation immediate must not include unsafe control characters',
        },
      });

      for (const { route, body } of [
        {
          route: subscribeRoute!,
          body: {
            tier: 'starter',
            trialDays: 14,
            email: 'seller@example.com',
          },
        },
        {
          route: cancelRoute!,
          body: { immediate: false },
        },
        {
          route: resumeRoute!,
          body: {},
        },
      ]) {
        const oversizedUserSend = jest.fn();
        const oversizedUserStatus = jest.fn(() => ({ send: oversizedUserSend }));
        await route.handler(
          {
            body,
            user: { businessId: 'business-1', userId: 'u'.repeat(256) },
          },
          { status: oversizedUserStatus }
        );

        expect(oversizedUserStatus).toHaveBeenCalledWith(400);
        expect(oversizedUserSend).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'INVALID_SUBSCRIPTION_TEXT_FIELD',
            message: 'Subscription user ID must be at most 255 characters',
          },
        });
      }
      expect(createSubscription).not.toHaveBeenCalled();
      expect(cancelSubscription).not.toHaveBeenCalled();
      expect(resumeSubscription).not.toHaveBeenCalled();
    } finally {
      createSubscription.mockRestore();
      cancelSubscription.mockRestore();
      resumeSubscription.mockRestore();
    }
  });

  it('rejects invalid subscription portal return URLs before service calls', async () => {
    const registeredGetRoutes: Array<{ path: string; handler: Function }> = [];
    const createPortalSession = jest
      .spyOn(SubscriptionService.prototype, 'createPortalSession')
      .mockRejectedValue(new Error('createPortalSession should not be called'));
    const fakeFastify = {
      get: jest.fn((path: string, _options: unknown, handler: Function) => {
        registeredGetRoutes.push({ path, handler });
      }),
      post: jest.fn(),
    };

    try {
      await subscriptionRoutes(fakeFastify as any);
      const portalRoute = registeredGetRoutes.find((item) => item.path === '/portal');
      expect(portalRoute).toBeDefined();

      const blankSend = jest.fn();
      const blankStatus = jest.fn(() => ({ send: blankSend }));
      await portalRoute!.handler(
        {
          query: {
            returnUrl: '   ',
          },
          user: { businessId: 'business-1', userId: 'user-1' },
        },
        { status: blankStatus }
      );

      expect(blankStatus).toHaveBeenCalledWith(400);
      expect(blankSend).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'MISSING_RETURN_URL',
          message: 'Return URL is required',
        },
      });

      const invalidSend = jest.fn();
      const invalidStatus = jest.fn(() => ({ send: invalidSend }));
      await portalRoute!.handler(
        {
          query: {
            returnUrl: 'javascript:alert(1)',
          },
          user: { businessId: 'business-1', userId: 'user-1' },
        },
        { status: invalidStatus }
      );

      expect(invalidStatus).toHaveBeenCalledWith(400);
      expect(invalidSend).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_RETURN_URL',
          message: 'Return URL must be an absolute HTTP(S) URL without credentials and at most 2048 characters',
        },
      });

      for (const returnUrl of [
        'https://seller:secret@app.example.com/subscriptions',
        `https://app.example.com/subscriptions?next=${'x'.repeat(2050)}`,
        'https://localhost/subscriptions',
        'https://admin.localhost/subscriptions',
        'https://127.0.0.1/subscriptions',
        'https://10.0.0.5/subscriptions',
        'https://172.16.0.5/subscriptions',
        'https://192.168.1.10/subscriptions',
        'https://169.254.169.254/latest/meta-data',
        'https://[::1]/subscriptions',
        'https://[fd00::1]/subscriptions',
        'https://[fe80::1]/subscriptions',
      ]) {
        const invalidPortalUrlSend = jest.fn();
        const invalidPortalUrlStatus = jest.fn(() => ({ send: invalidPortalUrlSend }));
        await portalRoute!.handler(
          {
            query: {
              returnUrl,
            },
            user: { businessId: 'business-1', userId: 'user-1' },
          },
          { status: invalidPortalUrlStatus }
        );

        expect(invalidPortalUrlStatus).toHaveBeenCalledWith(400);
        expect(invalidPortalUrlSend).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'INVALID_RETURN_URL',
            message: 'Return URL must be an absolute HTTP(S) URL without credentials and at most 2048 characters',
          },
        });
      }

      const unsafeReturnUrlSend = jest.fn();
      const unsafeReturnUrlStatus = jest.fn(() => ({ send: unsafeReturnUrlSend }));
      await portalRoute!.handler(
        {
          query: {
            returnUrl: 'https://app.example.com/subscriptions\u202E',
          },
          user: { businessId: 'business-1', userId: 'user-1' },
        },
        { status: unsafeReturnUrlStatus }
      );

      expect(unsafeReturnUrlStatus).toHaveBeenCalledWith(400);
      expect(unsafeReturnUrlSend).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_SUBSCRIPTION_TEXT_FIELD',
          message: 'Subscription portal return URL must not include unsafe control characters',
        },
      });
      expect(createPortalSession).not.toHaveBeenCalled();
    } finally {
      createPortalSession.mockRestore();
    }
  });

  it('rejects missing or blank subscription business IDs before service calls and normalizes valid auth IDs', async () => {
    const registeredGetRoutes: Array<{ path: string; handler: Function }> = [];
    const registeredPostRoutes: Array<{ path: string; handler: Function }> = [];
    const subscription = {
      id: 'subscription-1',
      tier: 'starter',
      status: 'active',
      current_period_start: new Date('2026-06-01T00:00:00.000Z'),
      current_period_end: new Date('2026-07-01T00:00:00.000Z'),
      cancel_at_period_end: false,
      canceled_at: null,
      trial_end: null,
      isActive: jest.fn(() => true),
      isInTrial: jest.fn(() => false),
      getTierConfig: jest.fn(() => ({
        features: ['menu_items'],
        price: 1999,
        currency: 'usd',
      })),
    };
    const getSubscription = jest
      .spyOn(SubscriptionService.prototype, 'getSubscription')
      .mockResolvedValue(subscription as any);
    const createSubscription = jest
      .spyOn(SubscriptionService.prototype, 'createSubscription')
      .mockResolvedValue({ subscription, clientSecret: 'client-secret' } as any);
    const cancelSubscription = jest
      .spyOn(SubscriptionService.prototype, 'cancelSubscription')
      .mockResolvedValue(subscription as any);
    const resumeSubscription = jest
      .spyOn(SubscriptionService.prototype, 'resumeSubscription')
      .mockResolvedValue(subscription as any);
    const createPortalSession = jest
      .spyOn(SubscriptionService.prototype, 'createPortalSession')
      .mockResolvedValue('https://billing.example.com/session');
    const checkOrderLimit = jest
      .spyOn(SubscriptionService.prototype, 'checkOrderLimit')
      .mockResolvedValue({ canCreateOrder: true } as any);
    const fakeFastify = {
      get: jest.fn((path: string, _options: unknown, handler: Function) => {
        registeredGetRoutes.push({ path, handler });
      }),
      post: jest.fn((path: string, _options: unknown, handler: Function) => {
        registeredPostRoutes.push({ path, handler });
      }),
    };
    const logger = { warn: jest.fn() };
    const makeReply = () => {
      const send = jest.fn();
      return {
        send,
        status: jest.fn(() => ({ send })),
      };
    };

    try {
      await subscriptionRoutes(fakeFastify as any);
      const currentRoute = registeredGetRoutes.find((item) => item.path === '/current');
      const subscribeRoute = registeredPostRoutes.find((item) => item.path === '/subscribe');
      const cancelRoute = registeredPostRoutes.find((item) => item.path === '/cancel');
      const resumeRoute = registeredPostRoutes.find((item) => item.path === '/resume');
      const portalRoute = registeredGetRoutes.find((item) => item.path === '/portal');
      const usageRoute = registeredGetRoutes.find((item) => item.path === '/usage');
      expect(currentRoute).toBeDefined();
      expect(subscribeRoute).toBeDefined();
      expect(cancelRoute).toBeDefined();
      expect(resumeRoute).toBeDefined();
      expect(portalRoute).toBeDefined();
      expect(usageRoute).toBeDefined();

      for (const { handler, request } of [
        {
          handler: currentRoute!.handler,
          request: {},
        },
        {
          handler: subscribeRoute!.handler,
          request: {
            body: { tier: 'starter' },
          },
        },
        {
          handler: cancelRoute!.handler,
          request: {
            body: {},
          },
        },
        {
          handler: resumeRoute!.handler,
          request: {
            body: {},
          },
        },
        {
          handler: portalRoute!.handler,
          request: {
            query: { returnUrl: 'https://app.example.com/subscriptions' },
          },
        },
        {
          handler: usageRoute!.handler,
          request: {},
        },
        {
          handler: currentRoute!.handler,
          request: { user: { businessId: '   ', userId: 'user-1' } },
        },
        {
          handler: subscribeRoute!.handler,
          request: {
            body: { tier: 'starter' },
            user: { businessId: '   ', userId: 'user-1' },
          },
        },
        {
          handler: cancelRoute!.handler,
          request: {
            body: {},
            user: { businessId: '   ', userId: 'user-1' },
          },
        },
        {
          handler: resumeRoute!.handler,
          request: {
            body: {},
            user: { businessId: '   ', userId: 'user-1' },
          },
        },
        {
          handler: portalRoute!.handler,
          request: {
            query: { returnUrl: 'https://app.example.com/subscriptions' },
            user: { businessId: '   ', userId: 'user-1' },
          },
        },
        {
          handler: usageRoute!.handler,
          request: { user: { businessId: '   ', userId: 'user-1' } },
        },
      ]) {
        const reply = makeReply();
        await handler(request, reply);
        expect(reply.status).toHaveBeenCalledWith(400);
        expect(reply.send).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'NO_BUSINESS',
            message: 'User has no business associated',
          },
        });
      }

      for (const { handler, request } of [
        {
          handler: currentRoute!.handler,
          request: { user: { businessId: 'business-\u202E1', userId: 'user-1' } },
        },
        {
          handler: subscribeRoute!.handler,
          request: {
            body: { tier: 'starter' },
            user: { businessId: 'business-\u200B1', userId: 'user-1' },
          },
        },
        {
          handler: cancelRoute!.handler,
          request: {
            body: {},
            user: { businessId: 'business-\u20601', userId: 'user-1' },
          },
        },
        {
          handler: resumeRoute!.handler,
          request: {
            body: {},
            user: { businessId: 'business-\u202E1', userId: 'user-1' },
          },
        },
        {
          handler: portalRoute!.handler,
          request: {
            query: { returnUrl: 'https://app.example.com/subscriptions' },
            user: { businessId: 'business-\u200B1', userId: 'user-1' },
          },
        },
        {
          handler: usageRoute!.handler,
          request: { user: { businessId: 'business-\u20601', userId: 'user-1' } },
        },
      ]) {
        const reply = makeReply();
        await handler(request, reply);
        expect(reply.status).toHaveBeenCalledWith(400);
        expect(reply.send).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'INVALID_SUBSCRIPTION_TEXT_FIELD',
            message: 'Subscription business ID must not include unsafe control characters',
          },
        });
      }

      for (const { handler, request } of [
        {
          handler: currentRoute!.handler,
          request: { user: { businessId: 'b'.repeat(256), userId: 'user-1' } },
        },
        {
          handler: subscribeRoute!.handler,
          request: {
            body: { tier: 'starter' },
            user: { businessId: 'b'.repeat(256), userId: 'user-1' },
          },
        },
        {
          handler: cancelRoute!.handler,
          request: {
            body: {},
            user: { businessId: 'b'.repeat(256), userId: 'user-1' },
          },
        },
        {
          handler: resumeRoute!.handler,
          request: {
            body: {},
            user: { businessId: 'b'.repeat(256), userId: 'user-1' },
          },
        },
        {
          handler: portalRoute!.handler,
          request: {
            query: { returnUrl: 'https://app.example.com/subscriptions' },
            user: { businessId: 'b'.repeat(256), userId: 'user-1' },
          },
        },
        {
          handler: usageRoute!.handler,
          request: { user: { businessId: 'b'.repeat(256), userId: 'user-1' } },
        },
      ]) {
        const reply = makeReply();
        await handler(request, reply);
        expect(reply.status).toHaveBeenCalledWith(400);
        expect(reply.send).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'INVALID_SUBSCRIPTION_TEXT_FIELD',
            message: 'Subscription business ID must be at most 255 characters',
          },
        });
      }

      for (const { handler, request, message } of [
        {
          handler: currentRoute!.handler,
          request: { user: { businessId: 'business-1' } },
          message: 'User identity is required',
        },
        {
          handler: portalRoute!.handler,
          request: {
            query: { returnUrl: 'https://app.example.com/subscriptions' },
            user: { businessId: 'business-1', id: 'user-\u200B1' },
          },
          message: 'Subscription user ID must not include unsafe control characters',
        },
        {
          handler: usageRoute!.handler,
          request: { user: { businessId: 'business-1', userId: 'u'.repeat(256) } },
          message: 'Subscription user ID must be at most 255 characters',
        },
      ]) {
        const reply = makeReply();
        await handler(request, reply);
        expect(reply.status).toHaveBeenCalledWith(400);
        expect(reply.send).toHaveBeenCalledWith({
          success: false,
          error: {
            code: message === 'User identity is required' ? 'NO_USER' : 'INVALID_SUBSCRIPTION_TEXT_FIELD',
            message,
          },
        });
      }

      expect(getSubscription).not.toHaveBeenCalled();
      expect(createSubscription).not.toHaveBeenCalled();
      expect(cancelSubscription).not.toHaveBeenCalled();
      expect(resumeSubscription).not.toHaveBeenCalled();
      expect(createPortalSession).not.toHaveBeenCalled();
      expect(checkOrderLimit).not.toHaveBeenCalled();

      await currentRoute!.handler(
        { user: { businessId: ' business-1 ', userId: 'user-1' } },
        makeReply()
      );
      await subscribeRoute!.handler(
        {
          id: 'request-1',
          log: logger,
          body: { tier: ' starter ', trialDays: 14, email: ' seller@example.com ' },
          user: { businessId: ' business-1 ', id: ' user-1 ' },
        },
        makeReply()
      );
      await cancelRoute!.handler(
        {
          id: 'request-2',
          log: logger,
          body: { immediate: true },
          user: { businessId: ' business-1 ', id: ' user-1 ' },
        },
        makeReply()
      );
      await resumeRoute!.handler(
        {
          id: 'request-3',
          log: logger,
          body: {},
          user: { businessId: ' business-1 ', id: ' user-1 ' },
        },
        makeReply()
      );
      await portalRoute!.handler(
        {
          query: { returnUrl: ' https://app.example.com/subscriptions ' },
          user: { businessId: ' business-1 ', userId: 'user-1' },
        },
        makeReply()
      );
      await usageRoute!.handler(
        { user: { businessId: ' business-1 ', userId: 'user-1' } },
        makeReply()
      );

      expect(getSubscription).toHaveBeenCalledWith('business-1');
      expect(createSubscription).toHaveBeenCalledWith('business-1', 'starter', {
        trialDays: 14,
        email: 'seller@example.com',
      });
      expect(cancelSubscription).toHaveBeenCalledWith('business-1', { immediate: true });
      expect(resumeSubscription).toHaveBeenCalledWith('business-1');
      expect(createPortalSession).toHaveBeenCalledWith(
        'business-1',
        'https://app.example.com/subscriptions'
      );
      expect(checkOrderLimit).toHaveBeenCalledWith('business-1');
      expect(logger.warn).toHaveBeenNthCalledWith(1, expect.objectContaining({
        msg: 'Security event: Subscription created/upgraded: starter',
        request: expect.objectContaining({ id: 'request-1', userId: 'user-1' }),
      }));
      expect(logger.warn).toHaveBeenNthCalledWith(2, expect.objectContaining({
        msg: 'Security event: Subscription canceled: starter',
        request: expect.objectContaining({ id: 'request-2', userId: 'user-1' }),
      }));
      expect(logger.warn).toHaveBeenNthCalledWith(3, expect.objectContaining({
        msg: 'Security event: Subscription resumed: starter',
        request: expect.objectContaining({ id: 'request-3', userId: 'user-1' }),
      }));
    } finally {
      getSubscription.mockRestore();
      createSubscription.mockRestore();
      cancelSubscription.mockRestore();
      resumeSubscription.mockRestore();
      createPortalSession.mockRestore();
      checkOrderLimit.mockRestore();
    }
  });
});
