import { describe, expect, it, afterEach, jest } from '@jest/globals';
import { AnalyticsService } from '../src/services/AnalyticsService';

describe('AnalyticsService measured observability', () => {
  const originalRepos = {
    userRepo: (AnalyticsService as any).userRepo,
    businessRepo: (AnalyticsService as any).businessRepo,
    orderRepo: (AnalyticsService as any).orderRepo,
    paymentRepo: (AnalyticsService as any).paymentRepo,
  };

  afterEach(() => {
    AnalyticsService.setTelemetryAdapterForTesting(null);
    (AnalyticsService as any).userRepo = originalRepos.userRepo;
    (AnalyticsService as any).businessRepo = originalRepos.businessRepo;
    (AnalyticsService as any).orderRepo = originalRepos.orderRepo;
    (AnalyticsService as any).paymentRepo = originalRepos.paymentRepo;
    jest.restoreAllMocks();
  });

  const rawQuery = (result: { one?: unknown; many?: unknown[] }) => {
    const queryBuilder = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue(result.one),
      getRawMany: jest.fn().mockResolvedValue(result.many ?? []),
    };

    return queryBuilder;
  };

  it('reports explicit unavailability when telemetry is not configured', async () => {
    const result = await AnalyticsService.getErrorMetrics(7);

    expect(result).toMatchObject({
      period_days: 7,
      status: 'unavailable',
      uptime_percentage: null,
      api_errors: null,
      p95_latency_ms: null,
      unavailable_reason: 'telemetry adapter is not configured',
    });
  });

  it('returns adapter-provided metrics without baked-in placeholder uptime', async () => {
    AnalyticsService.setTelemetryAdapterForTesting({
      async getPlatformSnapshot() {
        return {
          status: 'available',
          uptime_percentage: 100,
          api_errors: 1,
          payment_failures: 2,
          webhook_failures: 3,
          error_rate_percentage: 0.01,
          p95_latency_ms: 120,
          collected_at: '2026-06-20T00:00:00.000Z',
        };
      },
    });

    const result = await AnalyticsService.getErrorMetrics(1);

    expect(result).toMatchObject({
      status: 'available',
      uptime_percentage: 100,
      api_errors: 1,
      payment_failures: 2,
      webhook_failures: 3,
    });
  });

  it('fails closed when telemetry adapter metrics are malformed', async () => {
    AnalyticsService.setTelemetryAdapterForTesting({
      async getPlatformSnapshot() {
        return {
          status: 'available',
          uptime_percentage: 101,
          api_errors: -1,
          payment_failures: 2,
          webhook_failures: 3,
          error_rate_percentage: 0.01,
          p95_latency_ms: 120,
          collected_at: '2026-06-20T00:00:00.000Z',
        };
      },
    });

    const result = await AnalyticsService.getErrorMetrics(1);

    expect(result).toMatchObject({
      period_days: 1,
      status: 'unavailable',
      uptime_percentage: null,
      api_errors: null,
      payment_failures: null,
      webhook_failures: null,
      error_rate_percentage: null,
      p95_latency_ms: null,
      collected_at: null,
      unavailable_reason:
        'telemetry adapter returned invalid snapshot: uptime_percentage must be between 0 and 100',
    });
  });

  it('normalizes unavailable telemetry snapshots without laundering stale metrics', async () => {
    AnalyticsService.setTelemetryAdapterForTesting({
      async getPlatformSnapshot() {
        return {
          status: 'unavailable',
          uptime_percentage: 99.97,
          api_errors: 1,
          payment_failures: 2,
          webhook_failures: 3,
          error_rate_percentage: 0.01,
          p95_latency_ms: 120,
          collected_at: '2026-06-20T00:00:00.000Z',
          unavailable_reason: 'telemetry source is stale',
        };
      },
    });

    const result = await AnalyticsService.getErrorMetrics(7);

    expect(result).toEqual({
      period_days: 7,
      status: 'unavailable',
      uptime_percentage: null,
      api_errors: null,
      payment_failures: null,
      webhook_failures: null,
      error_rate_percentage: null,
      p95_latency_ms: null,
      collected_at: null,
      unavailable_reason: 'telemetry source is stale',
    });
  });

  it('fails closed when telemetry unavailable reasons include unsafe controls', async () => {
    AnalyticsService.setTelemetryAdapterForTesting({
      async getPlatformSnapshot() {
        return {
          status: 'unavailable',
          uptime_percentage: null,
          api_errors: null,
          payment_failures: null,
          webhook_failures: null,
          error_rate_percentage: null,
          p95_latency_ms: null,
          collected_at: null,
          unavailable_reason: 'telemetry source is stale\u0000',
        };
      },
    });

    const result = await AnalyticsService.getErrorMetrics(7);

    expect(result).toMatchObject({
      period_days: 7,
      status: 'unavailable',
      uptime_percentage: null,
      api_errors: null,
      unavailable_reason:
        'telemetry adapter returned invalid snapshot: unavailable_reason must not include unsafe control characters',
    });
  });

  it('fails closed when telemetry timestamps include unsafe controls', async () => {
    AnalyticsService.setTelemetryAdapterForTesting({
      async getPlatformSnapshot() {
        return {
          status: 'available',
          uptime_percentage: 99,
          api_errors: 0,
          payment_failures: 0,
          webhook_failures: 0,
          error_rate_percentage: 0,
          p95_latency_ms: 100,
          collected_at: '2026-06-20T00:00:00.000Z\u0000',
        };
      },
    });

    const result = await AnalyticsService.getErrorMetrics(7);

    expect(result).toMatchObject({
      period_days: 7,
      status: 'unavailable',
      collected_at: null,
      unavailable_reason:
        'telemetry adapter returned invalid snapshot: collected_at must not include unsafe control characters',
    });
  });

  it('does not echo unsafe adapter exception text in unavailable reasons', async () => {
    AnalyticsService.setTelemetryAdapterForTesting({
      async getPlatformSnapshot() {
        throw new Error('provider failed\u0000with hidden suffix');
      },
    });

    const result = await AnalyticsService.getErrorMetrics(7);

    expect(result).toMatchObject({
      period_days: 7,
      status: 'unavailable',
      unavailable_reason: 'telemetry adapter returned invalid snapshot: unknown error',
    });
  });

  it('rejects unsupported seller tier aggregate fields before returning seller stats', async () => {
    (AnalyticsService as any).userRepo = {
      createQueryBuilder: jest.fn(() =>
        rawQuery({
          many: [
            {
              tier: 'pro',
              count: '1',
              provider_trace_id: 'trace-123',
            },
          ],
        })
      ),
      count: jest.fn().mockResolvedValue(0),
    };

    await expect(AnalyticsService.getSellerStats()).rejects.toThrow(
      'Seller tier row include unsupported field(s): provider_trace_id'
    );
  });

  it('rejects unsupported top-seller aggregate fields before any business lookup', async () => {
    (AnalyticsService as any).orderRepo = {
      createQueryBuilder: jest.fn(() =>
        rawQuery({
          many: [
            {
              business_id: 'business-1',
              order_count: '3',
              total_gmv_cents: '9900',
            },
            {
              business_id: 'business-2',
              order_count: '1',
              total_gmv_cents: '1200',
              provider_trace_id: 'trace-123',
            },
          ],
        })
      ),
    };
    (AnalyticsService as any).businessRepo = {
      findOne: jest.fn(),
    };

    await expect(AnalyticsService.getTopSellers({ sort_by: 'orders' })).rejects.toThrow(
      'Top seller analytics row include unsupported field(s): provider_trace_id'
    );
    expect((AnalyticsService as any).businessRepo.findOne).not.toHaveBeenCalled();
  });
});
