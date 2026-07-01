import { jest, describe, beforeEach, it, expect } from '@jest/globals';
import { PayoutExecutionGateway, PayoutService } from '../src/services/PayoutService';
import { AppDataSource } from '../src/config/database';
import { Payout } from '../src/models/Payout';
import { PayoutSchedule } from '../src/models/PayoutSchedule';
import { Payment } from '../src/models/Payment';
import { PaymentProcessor } from '../src/models/PaymentProcessor';
import { Subscription } from '../src/models/Subscription';

jest.mock('../src/config/database');

describe('PayoutService', () => {
  let payoutService: PayoutService;
  let mockPayoutRepository: any;
  let mockScheduleRepository: any;
  let mockPaymentRepository: any;
  let mockProcessorRepository: any;
  let mockSubscriptionRepository: any;

  const validPayout = (overrides: Partial<Payout> = {}): Payout =>
    ({
      id: 'payout-1',
      business_id: 'business-1',
      payment_processor_id: 'processor-1',
      period_start: new Date('2026-06-01T00:00:00.000Z'),
      period_end: new Date('2026-06-30T23:59:59.999Z'),
      scheduled_payout_date: new Date('2026-07-01T00:00:00.000Z'),
      frequency: 'monthly',
      gross_amount_cents: 10000,
      processor_fee_cents: 500,
      subscription_fee_cents: 1000,
      platform_fee_cents: 0,
      volume_discount_cents: 100,
      net_amount_cents: 8600,
      payment_count: 2,
      status: 'pending',
      processor_payout_id: 'processor-payout-1',
      bank_transaction_id: 'bank-transaction-1',
      failure_reason: undefined,
      retry_count: 0,
      next_retry_date: undefined,
      reconciliation_status: 'pending',
      taxable_amount_cents: 10000,
      tds_cents: 0,
      currency: 'INR',
      metadata: { payment_ids: ['payment-1', 'payment-2'] },
      notes: undefined,
      completed_at: undefined,
      failed_at: undefined,
      ...overrides,
    }) as Payout;

  beforeEach(() => {
    jest.clearAllMocks();

    mockPayoutRepository = {
      findAndCount: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
    };
    mockScheduleRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
    };
    mockPaymentRepository = {
      find: jest.fn(),
      update: jest.fn(),
    };
    mockProcessorRepository = {
      findOne: jest.fn(),
    };
    mockSubscriptionRepository = {
      findOne: jest.fn(),
    };

    AppDataSource.getRepository = jest.fn().mockImplementation((entity: any) => {
      const entityName = entity?.name || entity;
      if (entity === Payout || entityName === 'Payout') return mockPayoutRepository;
      if (entity === PayoutSchedule || entityName === 'PayoutSchedule') return mockScheduleRepository;
      if (entity === Payment || entityName === 'Payment') return mockPaymentRepository;
      if (entity === PaymentProcessor || entityName === 'PaymentProcessor') return mockProcessorRepository;
      if (entity === Subscription || entityName === 'Subscription') return mockSubscriptionRepository;
      return mockPayoutRepository;
    }) as any;

    payoutService = new PayoutService();
  });

  describe('getPayoutHistory', () => {
    it('returns validated payout history rows and preserves repository query options', async () => {
      mockPayoutRepository.findAndCount.mockResolvedValue([[validPayout()], 1]);

      const result = await payoutService.getPayoutHistory('business-1', {
        processorId: 'processor-1',
        status: 'pending',
        limit: 10,
        offset: 5,
      });

      expect(result.total).toBe(1);
      expect(result.payouts).toHaveLength(1);
      expect(mockPayoutRepository.findAndCount).toHaveBeenCalledWith({
        where: {
          business_id: 'business-1',
          payment_processor_id: 'processor-1',
          status: 'pending',
        },
        relations: ['payment_processor'],
        order: {
          created_at: 'DESC',
        },
        take: 10,
        skip: 5,
      });
    });

    it('rejects cross-business payout rows before returning history', async () => {
      mockPayoutRepository.findAndCount.mockResolvedValue([
        [validPayout({ business_id: 'business-2' })],
        1,
      ]);

      await expect(payoutService.getPayoutHistory('business-1')).rejects.toThrow(
        'Payout row 1 business_id must match requested business'
      );
    });

    it('rejects internally inconsistent payout totals before returning history', async () => {
      mockPayoutRepository.findAndCount.mockResolvedValue([
        [validPayout({ net_amount_cents: 8700 })],
        1,
      ]);

      await expect(payoutService.getPayoutHistory('business-1')).rejects.toThrow(
        'Payout row 1 net_amount_cents must equal gross minus fees plus volume discount'
      );
    });

    it('rejects corrupt payout metadata before returning history', async () => {
      mockPayoutRepository.findAndCount.mockResolvedValue([
        [validPayout({ metadata: { payment_ids: ['payment-1', '   '] } })],
        1,
      ]);

      await expect(payoutService.getPayoutHistory('business-1')).rejects.toThrow(
        'Payout row 1 metadata.payment_ids[1] must be a non-empty string'
      );
    });

    it('rejects unsupported payout metadata before returning history', async () => {
      mockPayoutRepository.findAndCount.mockResolvedValue([
        [validPayout({ metadata: { payment_ids: ['payment-1'], provider_trace_id: 'trace-123' } as any })],
        1,
      ]);

      await expect(payoutService.getPayoutHistory('business-1')).rejects.toThrow(
        'Payout row 1 metadata include unsupported field(s): provider_trace_id'
      );
    });

    it('rejects unsafe payout metadata field names before aggregating unsupported-key diagnostics', async () => {
      mockPayoutRepository.findAndCount.mockResolvedValue([
        [validPayout({ metadata: { payment_ids: ['payment-1'], ['provider_trace_id\uFEFF']: 'trace-123' } as any })],
        1,
      ]);

      await expect(payoutService.getPayoutHistory('business-1')).rejects.toThrow(
        'Payout row 1 metadata field names contain unsafe control characters'
      );
    });

    it('rejects payout metadata payment evidence that does not match payment_count before returning history', async () => {
      mockPayoutRepository.findAndCount.mockResolvedValue([
        [validPayout({ payment_count: 3, metadata: { payment_ids: ['payment-1', 'payment-2'] } })],
        1,
      ]);

      await expect(payoutService.getPayoutHistory('business-1')).rejects.toThrow(
        'Payout row 1 metadata.payment_ids count must match payment_count'
      );
    });

    it('rejects duplicate payout metadata payment evidence before returning history', async () => {
      mockPayoutRepository.findAndCount.mockResolvedValue([
        [validPayout({ metadata: { payment_ids: ['payment-1', 'payment-1'] } })],
        1,
      ]);

      await expect(payoutService.getPayoutHistory('business-1')).rejects.toThrow(
        'Payout row 1 metadata.payment_ids[1] must be unique'
      );
    });

    it.each([
      ['status', { status: 'teleported' }, 'Payout row 1 status has an invalid status'],
      ['status controls', { status: 'pending\u202E' }, 'Payout row 1 status must not include unsafe control characters'],
      ['frequency', { frequency: 'hourly' }, 'Payout row 1 frequency has an invalid frequency'],
      ['frequency controls', { frequency: '\uFEFFmonthly' }, 'Payout row 1 frequency must not include unsafe control characters'],
      ['currency', { currency: 'inr' }, 'Payout row 1 currency must be a 3-letter uppercase code'],
      [
        'completed processor evidence',
        { status: 'completed', processor_payout_id: undefined, completed_at: new Date('2026-07-01T00:00:00.000Z') },
        'Payout row 1 completed status requires processor_payout_id evidence',
      ],
      [
        'completed processor evidence controls',
        {
          status: 'completed',
          processor_payout_id: '\uFEFFprocessor-payout-1',
          completed_at: new Date('2026-07-01T00:00:00.000Z'),
        },
        'Payout row 1 processor_payout_id must not include unsafe control characters',
      ],
      [
        'completed processor evidence length',
        {
          status: 'completed',
          processor_payout_id: 'p'.repeat(256),
          completed_at: new Date('2026-07-01T00:00:00.000Z'),
        },
        'Payout row 1 processor_payout_id must be at most 255 characters',
      ],
      [
        'bank transaction evidence controls',
        {
          status: 'completed',
          completed_at: new Date('2026-07-01T00:00:00.000Z'),
          bank_transaction_id: 'bank-transaction-1\u200B',
        },
        'Payout row 1 bank_transaction_id must not include unsafe control characters',
      ],
      [
        'bank transaction evidence length',
        {
          status: 'completed',
          completed_at: new Date('2026-07-01T00:00:00.000Z'),
          bank_transaction_id: 'b'.repeat(256),
        },
        'Payout row 1 bank_transaction_id must be at most 255 characters',
      ],
      [
        'completed timestamp evidence',
        { status: 'completed', completed_at: undefined },
        'Payout row 1 completed status requires completed_at evidence',
      ],
      [
        'completed stale failure evidence',
        {
          status: 'completed',
          completed_at: new Date('2026-07-01T00:00:00.000Z'),
          failure_reason: 'Previous timeout',
        },
        'Payout row 1 completed status cannot include failure or retry evidence',
      ],
      [
        'failed reason evidence',
        { status: 'failed', failure_reason: undefined, failed_at: new Date('2026-07-01T00:00:00.000Z') },
        'Payout row 1 failed status requires failure_reason evidence',
      ],
      [
        'failed timestamp evidence',
        { status: 'failed', failure_reason: 'Bank rejected payout', failed_at: undefined },
        'Payout row 1 failed status requires failed_at evidence',
      ],
      [
        'failed reason controls',
        {
          status: 'failed',
          failure_reason: 'Bank rejected\u2060payout',
          failed_at: new Date('2026-07-01T00:00:00.000Z'),
        },
        'Payout row 1 failure_reason must not include unsafe control characters',
      ],
      [
        'failed completion evidence',
        {
          status: 'failed',
          failure_reason: 'Bank rejected payout',
          failed_at: new Date('2026-07-01T00:00:00.000Z'),
          completed_at: new Date('2026-07-01T00:00:00.000Z'),
        },
        'Payout row 1 failed status cannot include completed_at evidence',
      ],
    ])('rejects invalid payout %s before returning history', async (_field, override, expectedError) => {
      mockPayoutRepository.findAndCount.mockResolvedValue([[validPayout(override as Partial<Payout>)], 1]);

      await expect(payoutService.getPayoutHistory('business-1')).rejects.toThrow(expectedError);
    });
  });

  describe('processPendingPayouts', () => {
    it('uses an execution gateway and clears stale failure and retry markers when a retried payout completes', async () => {
      const payoutGateway: PayoutExecutionGateway = {
        executePayout: jest.fn(async () => ({
          processorPayoutId: 'processor-payout-live-1',
          bankTransactionId: 'bank-transaction-live-1',
        })),
      };
      payoutService = new PayoutService(payoutGateway);
      const payout = validPayout({
        id: 'payout-retry-1',
        status: 'pending',
        failure_reason: 'Bank timeout',
        retry_count: 1,
        next_retry_date: new Date('2026-07-02T00:00:00.000Z'),
        failed_at: new Date('2026-07-01T00:00:00.000Z'),
        completed_at: undefined,
      });
      mockPayoutRepository.find.mockResolvedValue([payout]);
      mockPayoutRepository.save.mockImplementation(async (entity: Payout) => entity);
      mockPaymentRepository.update.mockResolvedValue({ affected: 2 });

      await expect(payoutService.processPendingPayouts()).resolves.toBe(1);

      expect(payoutGateway.executePayout).toHaveBeenCalledWith(payout);
      expect(mockPaymentRepository.update).toHaveBeenCalledWith(
        { id: expect.any(Object) },
        {
          settlement_details: {
            payout_id: 'payout-retry-1',
            settled_at: expect.any(String),
            settlement_status: 'settled',
          },
        }
      );
      expect(payout).toMatchObject({
        status: 'completed',
        failure_reason: null,
        failed_at: null,
        next_retry_date: null,
        retry_count: 1,
        reconciliation_status: 'pending',
        processor_payout_id: 'processor-payout-live-1',
        bank_transaction_id: 'bank-transaction-live-1',
      });
      expect(payout.completed_at).toBeInstanceOf(Date);
      expect(mockPayoutRepository.save).toHaveBeenLastCalledWith(expect.objectContaining({
        status: 'completed',
        processor_payout_id: 'processor-payout-live-1',
        bank_transaction_id: 'bank-transaction-live-1',
        failure_reason: null,
        failed_at: null,
        next_retry_date: null,
        retry_count: 1,
      }));
    });

    it('fails closed without claiming payout success when no execution gateway is configured', async () => {
      const payout = validPayout({
        id: 'payout-no-gateway-1',
        status: 'pending',
        processor_payout_id: undefined,
        bank_transaction_id: undefined,
        failure_reason: undefined,
        retry_count: 0,
        next_retry_date: undefined,
        completed_at: undefined,
        failed_at: undefined,
      });
      mockPayoutRepository.find.mockResolvedValue([payout]);
      mockPayoutRepository.save.mockImplementation(async (entity: Payout) => entity);

      await expect(payoutService.processPendingPayouts()).resolves.toBe(0);

      expect(mockPaymentRepository.update).not.toHaveBeenCalled();
      expect(payout).toMatchObject({
        status: 'failed',
        failure_reason: 'Payout processor integration unavailable: no payout execution gateway configured',
        retry_count: 1,
        processor_payout_id: null,
        completed_at: null,
        next_retry_date: null,
      });
      expect(payout.failed_at).toBeInstanceOf(Date);
      expect(mockPayoutRepository.save).toHaveBeenLastCalledWith(expect.objectContaining({
        status: 'failed',
        failure_reason: 'Payout processor integration unavailable: no payout execution gateway configured',
        retry_count: 1,
        processor_payout_id: null,
        completed_at: null,
        next_retry_date: null,
      }));
    });

    it('schedules retryable execution gateway failures without settling payments', async () => {
      const payoutGateway: PayoutExecutionGateway = {
        executePayout: jest.fn(async () => {
          throw new Error('Processor timeout');
        }),
      };
      payoutService = new PayoutService(payoutGateway);
      const payout = validPayout({
        id: 'payout-timeout-1',
        status: 'pending',
        processor_payout_id: undefined,
        failure_reason: undefined,
        retry_count: 0,
        next_retry_date: undefined,
        completed_at: undefined,
        failed_at: undefined,
      });
      mockPayoutRepository.find.mockResolvedValue([payout]);
      mockPayoutRepository.save.mockImplementation(async (entity: Payout) => entity);

      await expect(payoutService.processPendingPayouts()).resolves.toBe(0);

      expect(mockPaymentRepository.update).not.toHaveBeenCalled();
      expect(payout).toMatchObject({
        status: 'pending',
        failure_reason: 'Processor timeout',
        retry_count: 1,
        processor_payout_id: null,
        completed_at: null,
      });
      expect(payout.failed_at).toBeInstanceOf(Date);
      expect(payout.next_retry_date).toBeInstanceOf(Date);
      expect(mockPayoutRepository.save).toHaveBeenLastCalledWith(expect.objectContaining({
        status: 'pending',
        failure_reason: 'Processor timeout',
        retry_count: 1,
        processor_payout_id: null,
        completed_at: null,
        next_retry_date: expect.any(Date),
      }));
    });

    it('rejects unsupported pending payout metadata before provider execution or settlement', async () => {
      const payoutGateway: PayoutExecutionGateway = {
        executePayout: jest.fn(async () => ({
          processorPayoutId: 'processor-payout-live-1',
          bankTransactionId: 'bank-transaction-live-1',
        })),
      };
      payoutService = new PayoutService(payoutGateway);
      const payout = validPayout({
        id: 'payout-unsupported-metadata',
        status: 'pending',
        processor_payout_id: undefined,
        bank_transaction_id: undefined,
        failure_reason: undefined,
        retry_count: 0,
        next_retry_date: undefined,
        completed_at: undefined,
        failed_at: undefined,
        metadata: {
          payment_ids: ['payment-1'],
          provider_trace_id: 'trace-123',
        } as any,
      });
      mockPayoutRepository.find.mockResolvedValue([payout]);

      await expect(payoutService.processPendingPayouts()).resolves.toBe(0);

      expect(payoutGateway.executePayout).not.toHaveBeenCalled();
      expect(mockPaymentRepository.update).not.toHaveBeenCalled();
      expect(mockPayoutRepository.save).not.toHaveBeenCalled();
      expect(payout).toMatchObject({
        status: 'pending',
        processor_payout_id: undefined,
        completed_at: undefined,
        failed_at: undefined,
      });
    });

    it('rejects unsafe pending payout metadata field names before provider execution or settlement', async () => {
      const payoutGateway: PayoutExecutionGateway = {
        executePayout: jest.fn(async () => ({
          processorPayoutId: 'processor-payout-live-1',
          bankTransactionId: 'bank-transaction-live-1',
        })),
      };
      payoutService = new PayoutService(payoutGateway);
      const payout = validPayout({
        id: 'payout-unsafe-metadata',
        status: 'pending',
        processor_payout_id: undefined,
        bank_transaction_id: undefined,
        failure_reason: undefined,
        retry_count: 0,
        next_retry_date: undefined,
        completed_at: undefined,
        failed_at: undefined,
        metadata: {
          payment_ids: ['payment-1'],
          ['provider_trace_id\uFEFF']: 'trace-123',
        } as any,
      });
      mockPayoutRepository.find.mockResolvedValue([payout]);

      await expect(payoutService.processPendingPayouts()).resolves.toBe(0);

      expect(payoutGateway.executePayout).not.toHaveBeenCalled();
      expect(mockPaymentRepository.update).not.toHaveBeenCalled();
      expect(mockPayoutRepository.save).not.toHaveBeenCalled();
      expect(payout).toMatchObject({
        status: 'pending',
        processor_payout_id: undefined,
        completed_at: undefined,
        failed_at: undefined,
      });
    });

    it('rejects unsafe execution gateway evidence before marking payouts completed', async () => {
      const payoutGateway: PayoutExecutionGateway = {
        executePayout: jest.fn(async () => ({
          processorPayoutId: '\uFEFFprocessor-payout-live-1',
          bankTransactionId: 'bank-transaction-live-1',
        })),
      };
      payoutService = new PayoutService(payoutGateway);
      const payout = validPayout({
        id: 'payout-unsafe-provider-evidence',
        status: 'pending',
        processor_payout_id: undefined,
        bank_transaction_id: undefined,
        failure_reason: undefined,
        retry_count: 0,
        next_retry_date: undefined,
        completed_at: undefined,
        failed_at: undefined,
      });
      mockPayoutRepository.find.mockResolvedValue([payout]);
      mockPayoutRepository.save.mockImplementation(async (entity: Payout) => entity);

      await expect(payoutService.processPendingPayouts()).resolves.toBe(0);

      expect(mockPaymentRepository.update).not.toHaveBeenCalled();
      expect(payout).toMatchObject({
        status: 'pending',
        failure_reason: 'Payout processor payout id must not include unsafe control characters',
        retry_count: 1,
        processor_payout_id: null,
        bank_transaction_id: undefined,
        completed_at: null,
      });
      expect(payout.failed_at).toBeInstanceOf(Date);
      expect(payout.next_retry_date).toBeInstanceOf(Date);
      expect(mockPayoutRepository.save).toHaveBeenLastCalledWith(expect.objectContaining({
        status: 'pending',
        failure_reason: 'Payout processor payout id must not include unsafe control characters',
        retry_count: 1,
        processor_payout_id: null,
        completed_at: null,
        next_retry_date: expect.any(Date),
      }));
    });

    it.each([
      [
        'processor payout id',
        { processorPayoutId: 'p'.repeat(256), bankTransactionId: 'bank-transaction-live-1' },
        'Payout processor payout id must be at most 255 characters',
      ],
      [
        'bank transaction id',
        { processorPayoutId: 'processor-payout-live-1', bankTransactionId: 'b'.repeat(256) },
        'Payout bank transaction id must be at most 255 characters',
      ],
    ])('rejects oversized execution gateway %s before marking payouts completed', async (_case, gatewayResult, expectedReason) => {
      const payoutGateway: PayoutExecutionGateway = {
        executePayout: jest.fn(async () => gatewayResult),
      };
      payoutService = new PayoutService(payoutGateway);
      const payout = validPayout({
        id: 'payout-oversized-provider-evidence',
        status: 'pending',
        processor_payout_id: undefined,
        bank_transaction_id: undefined,
        failure_reason: undefined,
        retry_count: 0,
        next_retry_date: undefined,
        completed_at: undefined,
        failed_at: undefined,
      });
      mockPayoutRepository.find.mockResolvedValue([payout]);
      mockPayoutRepository.save.mockImplementation(async (entity: Payout) => entity);

      await expect(payoutService.processPendingPayouts()).resolves.toBe(0);

      expect(mockPaymentRepository.update).not.toHaveBeenCalled();
      expect(payout).toMatchObject({
        status: 'pending',
        failure_reason: expectedReason,
        retry_count: 1,
        processor_payout_id: null,
        bank_transaction_id: undefined,
        completed_at: null,
      });
      expect(payout.failed_at).toBeInstanceOf(Date);
      expect(payout.next_retry_date).toBeInstanceOf(Date);
      expect(mockPayoutRepository.save).toHaveBeenLastCalledWith(expect.objectContaining({
        status: 'pending',
        failure_reason: expectedReason,
        retry_count: 1,
        processor_payout_id: null,
        completed_at: null,
        next_retry_date: expect.any(Date),
      }));
    });

    it('sanitizes unsafe processor failure reasons before saving retry evidence', async () => {
      const payoutGateway: PayoutExecutionGateway = {
        executePayout: jest.fn(async () => {
          throw new Error('\uFEFFProcessor timeout');
        }),
      };
      payoutService = new PayoutService(payoutGateway);
      const payout = validPayout({
        id: 'payout-unsafe-failure-reason',
        status: 'pending',
        processor_payout_id: undefined,
        bank_transaction_id: undefined,
        failure_reason: undefined,
        retry_count: 0,
        next_retry_date: undefined,
        completed_at: undefined,
        failed_at: undefined,
      });
      mockPayoutRepository.find.mockResolvedValue([payout]);
      mockPayoutRepository.save.mockImplementation(async (entity: Payout) => entity);

      await expect(payoutService.processPendingPayouts()).resolves.toBe(0);

      expect(payout).toMatchObject({
        status: 'pending',
        failure_reason: 'Payout processor returned an unsafe error message',
        retry_count: 1,
      });
      expect(mockPayoutRepository.save).toHaveBeenLastCalledWith(expect.objectContaining({
        status: 'pending',
        failure_reason: 'Payout processor returned an unsafe error message',
        retry_count: 1,
      }));
    });
  });

  describe('updateSchedule', () => {
    const validSchedule = (overrides: Partial<PayoutSchedule> = {}): PayoutSchedule =>
      ({
        id: 'schedule-1',
        business_id: 'business-1',
        payment_processor_id: 'processor-1',
        is_active: true,
        frequency: 'weekly',
        weekly_day_of_week: 1,
        monthly_day_of_month: 1,
        min_payout_threshold_cents: 50000,
        max_hold_period_days: 7,
        is_manually_held: false,
        current_balance_cents: 0,
        last_payout_at: new Date('2026-06-01T00:00:00.000Z'),
        next_payout_date: new Date('2026-06-08T00:00:00.000Z'),
        email_notifications_enabled: true,
        notification_email: 'owner@example.com',
        current_month_gmv_cents: 0,
        volume_discount_eligible: false,
        created_at: new Date('2026-05-01T00:00:00.000Z'),
        updated_at: new Date('2026-06-01T00:00:00.000Z'),
        ...overrides,
      }) as PayoutSchedule;

    it('validates and normalizes schedule updates before saving', async () => {
      const schedule = validSchedule();
      mockScheduleRepository.findOne.mockResolvedValue(schedule);
      mockScheduleRepository.save.mockImplementation(async (entity: PayoutSchedule) => entity);

      const result = await payoutService.updateSchedule(' schedule-1 ', {
        frequency: 'monthly',
        min_payout_threshold_cents: 75000,
        max_hold_period_days: 14,
        weekly_day_of_week: 5,
        monthly_day_of_month: 15,
        email_notifications_enabled: false,
        notification_email: ' payouts@example.com ',
      });

      expect(mockScheduleRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'schedule-1' },
      });
      expect(result).toMatchObject({
        frequency: 'monthly',
        min_payout_threshold_cents: 75000,
        max_hold_period_days: 14,
        weekly_day_of_week: 5,
        monthly_day_of_month: 15,
        email_notifications_enabled: false,
        notification_email: 'payouts@example.com',
      });
      expect(result.next_payout_date).toBeInstanceOf(Date);
      expect(mockScheduleRepository.save).toHaveBeenCalledWith(result);
    });

    it.each([
      ['blank schedule id', '   ', { frequency: 'weekly' }, 'Payout schedule id must be a non-empty string'],
      ['invalid frequency', 'schedule-1', { frequency: 'hourly' }, 'Payout schedule frequency has an invalid frequency'],
      ['negative threshold', 'schedule-1', { min_payout_threshold_cents: -1 }, 'Payout schedule minimum threshold must be non-negative'],
      ['zero hold period', 'schedule-1', { max_hold_period_days: 0 }, 'Payout schedule maximum hold period must be positive'],
      ['invalid weekly day', 'schedule-1', { weekly_day_of_week: 7 }, 'Payout schedule weekly day must be between 0 and 6'],
      ['invalid monthly day', 'schedule-1', { monthly_day_of_month: 29 }, 'Payout schedule monthly day must be between 1 and 28'],
      ['non-boolean notification flag', 'schedule-1', { email_notifications_enabled: 'yes' }, 'Payout schedule email notifications flag must be a boolean'],
      ['invalid notification email', 'schedule-1', { notification_email: 'not-an-email' }, 'Payout schedule notification email must be a valid email address'],
      ['unsafe notification email controls', 'schedule-1', { notification_email: '\uFEFFpayouts@example.com' }, 'Payout schedule notification email must not include unsafe control characters'],
    ])('rejects %s before mutating or saving', async (_case, scheduleId, updates, expectedError) => {
      const schedule = validSchedule();
      mockScheduleRepository.findOne.mockResolvedValue(schedule);

      await expect(payoutService.updateSchedule(scheduleId as string, updates as any)).rejects.toThrow(
        expectedError
      );

      expect(schedule).toMatchObject({
        frequency: 'weekly',
        min_payout_threshold_cents: 50000,
        max_hold_period_days: 7,
        weekly_day_of_week: 1,
        monthly_day_of_month: 1,
        email_notifications_enabled: true,
        notification_email: 'owner@example.com',
      });
      expect(mockScheduleRepository.save).not.toHaveBeenCalled();
    });
  });
});
