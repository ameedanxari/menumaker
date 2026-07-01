import { Repository, LessThan, IsNull, In, Between } from 'typeorm';
import { AppDataSource } from '../config/database.js';
import { Payout, PayoutStatus, PayoutFrequency } from '../models/Payout.js';
import { PayoutSchedule } from '../models/PayoutSchedule.js';
import { Payment } from '../models/Payment.js';
import { PaymentProcessor } from '../models/PaymentProcessor.js';
import { Subscription } from '../models/Subscription.js';
import { logMetric } from '../utils/logger.js';

export interface PayoutExecutionResult {
  processorPayoutId: string;
  bankTransactionId?: string;
}

export interface PayoutExecutionGateway {
  executePayout(payout: Payout): Promise<PayoutExecutionResult>;
}

class PayoutProcessorUnavailableError extends Error {
  readonly retryable = false;

  constructor(message = 'Payout processor integration unavailable: no payout execution gateway configured') {
    super(message);
    this.name = 'PayoutProcessorUnavailableError';
  }
}

/**
 * PayoutService
 * Phase 3: Automated Tiered Payouts (US3.2)
 *
 * Handles automatic payout scheduling, calculation, and processing
 * Implements:
 * - Scheduled payouts (daily, weekly, monthly)
 * - Volume discounts (0.5% reduction if monthly GMV > Rs. 1L)
 * - Subscription fee deduction
 * - Threshold-based holds
 * - Bank reconciliation
 * - Retry logic for failed payouts
 */
export class PayoutService {
  private payoutRepository: Repository<Payout>;
  private scheduleRepository: Repository<PayoutSchedule>;
  private paymentRepository: Repository<Payment>;
  private processorRepository: Repository<PaymentProcessor>;
  private subscriptionRepository: Repository<Subscription>;
  private payoutExecutionGateway?: PayoutExecutionGateway;

  // Constants
  private static readonly VOLUME_DISCOUNT_THRESHOLD_CENTS = 10000000; // Rs. 1L (100,000 rupees)
  private static readonly VOLUME_DISCOUNT_PERCENTAGE = 0.5; // 0.5% fee reduction
  private static readonly MAX_RETRY_COUNT = 3;
  private static readonly RETRY_DELAY_DAYS = 1;
  private static readonly VALID_PAYOUT_STATUSES = new Set<PayoutStatus>([
    'pending',
    'processing',
    'completed',
    'failed',
    'held',
    'cancelled',
  ]);
  private static readonly VALID_PAYOUT_FREQUENCIES = new Set<PayoutFrequency>([
    'daily',
    'weekly',
    'monthly',
  ]);
  private static readonly VALID_RECONCILIATION_STATUSES = new Set([
    'pending',
    'reconciled',
    'exception',
  ]);
  private static readonly PAYOUT_METADATA_KEYS = new Set(['payment_ids']);
  private static readonly MAX_PAYOUT_PROVIDER_ID_LENGTH = 255;

  constructor(payoutExecutionGateway?: PayoutExecutionGateway) {
    this.payoutRepository = AppDataSource.getRepository(Payout);
    this.scheduleRepository = AppDataSource.getRepository(PayoutSchedule);
    this.paymentRepository = AppDataSource.getRepository(Payment);
    this.processorRepository = AppDataSource.getRepository(PaymentProcessor);
    this.subscriptionRepository = AppDataSource.getRepository(Subscription);
    this.payoutExecutionGateway = payoutExecutionGateway;
  }

  private static assertNonEmptyString(value: unknown, fieldName: string): string {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new Error(`${fieldName} must be a non-empty string`);
    }
    if (PayoutService.hasUnsafePayoutTextControls(value)) {
      throw new Error(`${fieldName} must not include unsafe control characters`);
    }
    const normalizedValue = value.trim();
    if (PayoutService.hasUnsafePayoutTextControls(normalizedValue)) {
      throw new Error(`${fieldName} must not include unsafe control characters`);
    }
    return normalizedValue;
  }

  private static hasUnsafePayoutTextControls(value: string): boolean {
    return /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/u.test(value);
  }

  private static assertOptionalString(value: unknown, fieldName: string): string | undefined {
    if (value === undefined || value === null) return undefined;
    return PayoutService.assertNonEmptyString(value, fieldName);
  }

  private static assertPayoutProviderId(value: unknown, fieldName: string): string {
    const normalizedValue = PayoutService.assertNonEmptyString(value, fieldName);
    if (normalizedValue.length > PayoutService.MAX_PAYOUT_PROVIDER_ID_LENGTH) {
      throw new Error(`${fieldName} must be at most ${PayoutService.MAX_PAYOUT_PROVIDER_ID_LENGTH} characters`);
    }
    return normalizedValue;
  }

  private static assertOptionalPayoutProviderId(value: unknown, fieldName: string): string | undefined {
    if (value === undefined || value === null) return undefined;
    return PayoutService.assertPayoutProviderId(value, fieldName);
  }

  private static assertNonNegativeSafeInteger(value: unknown, fieldName: string): number {
    const numericValue =
      typeof value === 'string' && /^\d+$/.test(value.trim()) ? Number(value.trim()) : value;

    if (typeof numericValue !== 'number' || !Number.isInteger(numericValue)) {
      throw new Error(`${fieldName} must be an integer`);
    }
    if (!Number.isSafeInteger(numericValue)) {
      throw new Error(`${fieldName} must be a safe integer`);
    }
    if (numericValue < 0) {
      throw new Error(`${fieldName} must be non-negative`);
    }
    return numericValue;
  }

  private static assertPositiveSafeInteger(value: unknown, fieldName: string): number {
    const numericValue = PayoutService.assertNonNegativeSafeInteger(value, fieldName);
    if (numericValue <= 0) {
      throw new Error(`${fieldName} must be positive`);
    }
    return numericValue;
  }

  private static assertBoolean(value: unknown, fieldName: string): boolean {
    if (typeof value !== 'boolean') {
      throw new Error(`${fieldName} must be a boolean`);
    }
    return value;
  }

  private static assertDayOfWeek(value: unknown, fieldName: string): number {
    const numericValue = PayoutService.assertNonNegativeSafeInteger(value, fieldName);
    if (numericValue > 6) {
      throw new Error(`${fieldName} must be between 0 and 6`);
    }
    return numericValue;
  }

  private static assertDayOfMonth(value: unknown, fieldName: string): number {
    const numericValue = PayoutService.assertPositiveSafeInteger(value, fieldName);
    if (numericValue > 28) {
      throw new Error(`${fieldName} must be between 1 and 28`);
    }
    return numericValue;
  }

  private static assertOptionalEmail(value: unknown, fieldName: string): string | null | undefined {
    if (value === undefined) return undefined;
    if (value === null) return null;

    const email = PayoutService.assertNonEmptyString(value, fieldName);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error(`${fieldName} must be a valid email address`);
    }
    return email;
  }

  private static assertValidDate(value: unknown, fieldName: string): Date {
    if (value === undefined || value === null) {
      throw new Error(`${fieldName} must be a valid Date`);
    }
    const date = value instanceof Date ? value : new Date(value as any);
    if (Number.isNaN(date.getTime())) {
      throw new Error(`${fieldName} must be a valid Date`);
    }
    return date;
  }

  private static assertOptionalDate(value: unknown, fieldName: string): Date | undefined {
    if (value === undefined || value === null) return undefined;
    return PayoutService.assertValidDate(value, fieldName);
  }

  private static assertValidPayoutStatus(value: unknown, fieldName: string): PayoutStatus {
    if (typeof value === 'string' && PayoutService.hasUnsafePayoutTextControls(value)) {
      throw new Error(`${fieldName} must not include unsafe control characters`);
    }
    if (typeof value !== 'string' || !PayoutService.VALID_PAYOUT_STATUSES.has(value as PayoutStatus)) {
      throw new Error(`${fieldName} has an invalid status`);
    }
    return value as PayoutStatus;
  }

  private static assertValidFrequency(value: unknown, fieldName: string): PayoutFrequency {
    if (typeof value === 'string' && PayoutService.hasUnsafePayoutTextControls(value)) {
      throw new Error(`${fieldName} must not include unsafe control characters`);
    }
    if (typeof value !== 'string' || !PayoutService.VALID_PAYOUT_FREQUENCIES.has(value as PayoutFrequency)) {
      throw new Error(`${fieldName} has an invalid frequency`);
    }
    return value as PayoutFrequency;
  }

  private static isRetryablePayoutError(error: unknown): boolean {
    return !(error instanceof PayoutProcessorUnavailableError);
  }

  private async executeProcessorPayout(payout: Payout): Promise<PayoutExecutionResult> {
    if (!this.payoutExecutionGateway) {
      throw new PayoutProcessorUnavailableError();
    }

    const result = await this.payoutExecutionGateway.executePayout(payout);
    return {
      processorPayoutId: PayoutService.assertPayoutProviderId(
        result?.processorPayoutId,
        'Payout processor payout id'
      ),
      bankTransactionId: PayoutService.assertOptionalPayoutProviderId(
        result?.bankTransactionId,
        'Payout bank transaction id'
      ),
    };
  }

  private static assertReadablePayoutRow(
    payout: Payout,
    label: string,
    expected?: { businessId?: string }
  ): void {
    PayoutService.assertOptionalString(payout.id, `${label} id`);
    const businessId = PayoutService.assertNonEmptyString(payout.business_id, `${label} business_id`);
    if (expected?.businessId && businessId !== expected.businessId) {
      throw new Error(`${label} business_id must match requested business`);
    }
    PayoutService.assertOptionalString(payout.payment_processor_id, `${label} payment_processor_id`);

    const periodStart = PayoutService.assertValidDate(payout.period_start, `${label} period_start`);
    const periodEnd = PayoutService.assertValidDate(payout.period_end, `${label} period_end`);
    if (periodStart > periodEnd) {
      throw new Error(`${label} period_start must be before or equal to period_end`);
    }
    PayoutService.assertValidDate(payout.scheduled_payout_date, `${label} scheduled_payout_date`);
    if (payout.frequency !== undefined && payout.frequency !== null) {
      PayoutService.assertValidFrequency(payout.frequency, `${label} frequency`);
    }

    const grossAmountCents = PayoutService.assertNonNegativeSafeInteger(
      payout.gross_amount_cents,
      `${label} gross_amount_cents`
    );
    const processorFeeCents = PayoutService.assertNonNegativeSafeInteger(
      payout.processor_fee_cents,
      `${label} processor_fee_cents`
    );
    const subscriptionFeeCents = PayoutService.assertNonNegativeSafeInteger(
      payout.subscription_fee_cents,
      `${label} subscription_fee_cents`
    );
    const platformFeeCents = PayoutService.assertNonNegativeSafeInteger(
      payout.platform_fee_cents,
      `${label} platform_fee_cents`
    );
    const volumeDiscountCents = PayoutService.assertNonNegativeSafeInteger(
      payout.volume_discount_cents,
      `${label} volume_discount_cents`
    );
    const netAmountCents = PayoutService.assertNonNegativeSafeInteger(
      payout.net_amount_cents,
      `${label} net_amount_cents`
    );
    const expectedNetAmountCents =
      grossAmountCents - processorFeeCents - subscriptionFeeCents - platformFeeCents + volumeDiscountCents;
    if (netAmountCents !== expectedNetAmountCents) {
      throw new Error(`${label} net_amount_cents must equal gross minus fees plus volume discount`);
    }

    const paymentCount = PayoutService.assertNonNegativeSafeInteger(payout.payment_count, `${label} payment_count`);
    const status = PayoutService.assertValidPayoutStatus(payout.status, `${label} status`);
    const processorPayoutId = PayoutService.assertOptionalPayoutProviderId(
      payout.processor_payout_id,
      `${label} processor_payout_id`
    );
    PayoutService.assertOptionalPayoutProviderId(payout.bank_transaction_id, `${label} bank_transaction_id`);
    const failureReason = PayoutService.assertOptionalString(payout.failure_reason, `${label} failure_reason`);
    PayoutService.assertNonNegativeSafeInteger(payout.retry_count, `${label} retry_count`);
    PayoutService.assertOptionalDate(payout.next_retry_date, `${label} next_retry_date`);

    if (
      payout.reconciliation_status !== undefined &&
      payout.reconciliation_status !== null &&
      !PayoutService.VALID_RECONCILIATION_STATUSES.has(payout.reconciliation_status)
    ) {
      throw new Error(`${label} reconciliation_status has an invalid status`);
    }
    PayoutService.assertNonNegativeSafeInteger(payout.taxable_amount_cents, `${label} taxable_amount_cents`);
    PayoutService.assertNonNegativeSafeInteger(payout.tds_cents, `${label} tds_cents`);
    if (typeof payout.currency !== 'string' || !/^[A-Z]{3}$/.test(payout.currency)) {
      throw new Error(`${label} currency must be a 3-letter uppercase code`);
    }

    if (payout.metadata !== undefined && payout.metadata !== null) {
      if (typeof payout.metadata !== 'object' || Array.isArray(payout.metadata)) {
        throw new Error(`${label} metadata must be an object`);
      }

      const metadataRecord = payout.metadata as Record<string, unknown>;
      const unsafeMetadataKeys = Object.keys(metadataRecord).filter((key) =>
        PayoutService.hasUnsafePayoutTextControls(key)
      );
      if (unsafeMetadataKeys.length > 0) {
        throw new Error(`${label} metadata field names contain unsafe control characters`);
      }

      const unsupportedMetadataKeys = Object.keys(metadataRecord).filter(
        (key) => !PayoutService.PAYOUT_METADATA_KEYS.has(key)
      );
      if (unsupportedMetadataKeys.length > 0) {
        throw new Error(
          `${label} metadata include unsupported field(s): ${unsupportedMetadataKeys.sort().join(', ')}`
        );
      }

      const paymentIds = metadataRecord.payment_ids;
      if (paymentIds !== undefined) {
        if (!Array.isArray(paymentIds)) {
          throw new Error(`${label} metadata.payment_ids must be an array`);
        }
        if (paymentIds.length !== paymentCount) {
          throw new Error(`${label} metadata.payment_ids count must match payment_count`);
        }
        const seenPaymentIds = new Set<string>();
        paymentIds.forEach((paymentId, index) => {
          const normalizedPaymentId = PayoutService.assertNonEmptyString(
            paymentId,
            `${label} metadata.payment_ids[${index}]`
          );
          if (seenPaymentIds.has(normalizedPaymentId)) {
            throw new Error(`${label} metadata.payment_ids[${index}] must be unique`);
          }
          seenPaymentIds.add(normalizedPaymentId);
        });
      }
    }

    PayoutService.assertOptionalString(payout.notes, `${label} notes`);
    const completedAt = PayoutService.assertOptionalDate(payout.completed_at, `${label} completed_at`);
    const failedAt = PayoutService.assertOptionalDate(payout.failed_at, `${label} failed_at`);
    if (status === 'completed') {
      if (!processorPayoutId) {
        throw new Error(`${label} completed status requires processor_payout_id evidence`);
      }
      if (!completedAt) {
        throw new Error(`${label} completed status requires completed_at evidence`);
      }
      if (failureReason || failedAt || payout.next_retry_date) {
        throw new Error(`${label} completed status cannot include failure or retry evidence`);
      }
    }
    if (status === 'failed') {
      if (!failureReason) {
        throw new Error(`${label} failed status requires failure_reason evidence`);
      }
      if (!failedAt) {
        throw new Error(`${label} failed status requires failed_at evidence`);
      }
      if (completedAt) {
        throw new Error(`${label} failed status cannot include completed_at evidence`);
      }
    }
  }

  /**
   * Generate pending payouts based on schedules
   * Called by cron job daily
   *
   * @returns Number of payouts generated
   */
  async generateScheduledPayouts(): Promise<number> {
    console.log('[PayoutService] Generating scheduled payouts...');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get all active schedules due for payout today
    const dueSchedules = await this.scheduleRepository.find({
      where: {
        is_active: true,
        is_manually_held: false,
        next_payout_date: LessThan(today),
      },
      relations: ['business', 'payment_processor'],
    });

    console.log(`[PayoutService] Found ${dueSchedules.length} schedules due for payout`);

    let generatedCount = 0;

    for (const schedule of dueSchedules) {
      try {
        // Check if balance meets threshold
        if (schedule.current_balance_cents < schedule.min_payout_threshold_cents) {
          // Check max hold period
          const holdDays = this.getDaysSinceLastPayout(schedule);
          if (holdDays < schedule.max_hold_period_days) {
            console.log(
              `[PayoutService] Skipping ${schedule.id}: Balance below threshold (${schedule.current_balance_cents} < ${schedule.min_payout_threshold_cents}), hold period ${holdDays}/${schedule.max_hold_period_days} days`
            );
            continue;
          }
        }

        // Generate payout
        const payout = await this.createPayoutForSchedule(schedule);
        if (payout) {
          generatedCount++;
          console.log(`[PayoutService] Generated payout ${payout.id} for schedule ${schedule.id}`);
        }
      } catch (error: any) {
        console.error(`[PayoutService] Failed to generate payout for schedule ${schedule.id}:`, error.message);
      }
    }

    console.log(`[PayoutService] Generated ${generatedCount} payouts`);
    return generatedCount;
  }

  /**
   * Create a payout for a schedule
   */
  private async createPayoutForSchedule(schedule: PayoutSchedule): Promise<Payout | null> {
    // Determine period
    const periodEnd = new Date();
    periodEnd.setHours(23, 59, 59, 999);

    const periodStart = schedule.last_payout_at
      ? new Date(schedule.last_payout_at)
      : new Date(schedule.created_at);
    periodStart.setHours(0, 0, 0, 0);

    // Get unpaid payments in period
    const payments = await this.paymentRepository.find({
      where: {
        business_id: schedule.business_id,
        payment_processor_id: schedule.payment_processor_id,
        status: 'succeeded',
        created_at: Between(periodStart, periodEnd),
        settlement_details: IsNull(), // Not yet included in a payout
      },
      order: {
        created_at: 'ASC',
      },
    });

    if (payments.length === 0) {
      console.log(`[PayoutService] No payments to payout for schedule ${schedule.id}`);
      return null;
    }

    // Calculate amounts
    const grossAmount = payments.reduce((sum, p) => sum + p.amount_cents, 0);
    const processorFees = payments.reduce((sum, p) => sum + p.processor_fee_cents, 0);

    // Get subscription fee for period
    const subscriptionFee = await this.getSubscriptionFeeForPeriod(
      schedule.business_id,
      periodStart,
      periodEnd
    );

    // Calculate volume discount
    const volumeDiscount = await this.calculateVolumeDiscount(
      schedule.business_id,
      schedule.payment_processor_id,
      grossAmount
    );

    // Calculate net amount
    const netAmount = grossAmount - processorFees - subscriptionFee + volumeDiscount;

    // Create payout
    const payout = this.payoutRepository.create({
      business_id: schedule.business_id,
      payment_processor_id: schedule.payment_processor_id,
      period_start: periodStart,
      period_end: periodEnd,
      scheduled_payout_date: this.calculateNextPayoutDate(schedule),
      frequency: schedule.frequency,
      gross_amount_cents: grossAmount,
      processor_fee_cents: processorFees,
      subscription_fee_cents: subscriptionFee,
      volume_discount_cents: volumeDiscount,
      net_amount_cents: netAmount,
      payment_count: payments.length,
      taxable_amount_cents: grossAmount, // For GST reporting
      status: 'pending',
      metadata: {
        payment_ids: payments.map((p) => p.id),
      },
    });

    await this.payoutRepository.save(payout);

    // Update payment settlement details
    for (const payment of payments) {
      payment.settlement_details = {
        payout_id: payout.id,
        settlement_status: 'pending',
      };
    }
    await this.paymentRepository.save(payments);

    // Update schedule
    schedule.current_balance_cents = 0; // Reset balance
    schedule.last_payout_at = new Date();
    schedule.next_payout_date = this.calculateNextPayoutDate(schedule);
    await this.scheduleRepository.save(schedule);

    return payout;
  }

  /**
   * Calculate volume discount
   * 0.5% fee reduction if monthly GMV > Rs. 1L
   */
  private async calculateVolumeDiscount(
    businessId: string,
    processorId: string,
    currentPayoutGross: number
  ): Promise<number> {
    const schedule = await this.scheduleRepository.findOne({
      where: {
        business_id: businessId,
        payment_processor_id: processorId,
      },
    });

    if (!schedule) return 0;

    // Update monthly GMV
    const currentMonth = new Date().toISOString().slice(0, 7); // "2025-11"
    if (schedule.gmv_month !== currentMonth) {
      // Reset for new month
      schedule.current_month_gmv_cents = 0;
      schedule.gmv_month = currentMonth;
      schedule.volume_discount_eligible = false;
    }

    schedule.current_month_gmv_cents += currentPayoutGross;

    // Check if eligible for discount
    if (schedule.current_month_gmv_cents >= PayoutService.VOLUME_DISCOUNT_THRESHOLD_CENTS) {
      schedule.volume_discount_eligible = true;

      // Calculate discount on processor fees
      // 0.5% reduction on gross amount
      const discount = Math.round(
        (currentPayoutGross * PayoutService.VOLUME_DISCOUNT_PERCENTAGE) / 100
      );

      await this.scheduleRepository.save(schedule);
      return discount;
    }

    await this.scheduleRepository.save(schedule);
    return 0;
  }

  /**
   * Get subscription fee for period
   */
  private async getSubscriptionFeeForPeriod(
    businessId: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<number> {
    // Get active subscription in period
    const subscription = await this.subscriptionRepository.findOne({
      where: {
        business_id: businessId,
        status: 'active',
      },
      order: {
        created_at: 'DESC',
      },
    });

    if (!subscription || subscription.tier === 'free') {
      return 0;
    }

    // Calculate prorated fee based on period
    const periodDays = Math.ceil(
      (periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Subscription fees (monthly)
    const monthlyFees: Record<string, number> = {
      free: 0,
      pro: 19900, // Rs. 199/month
      business: 49900, // Rs. 499/month
    };

    const monthlyFee = monthlyFees[subscription.tier] || 0;

    // Prorate based on period days vs 30 days
    const proratedFee = Math.round((monthlyFee * periodDays) / 30);

    return proratedFee;
  }

  /**
   * Calculate next payout date based on frequency
   */
  private calculateNextPayoutDate(schedule: PayoutSchedule): Date {
    const baseDate = schedule.last_payout_at || new Date();
    const nextDate = new Date(baseDate);

    switch (schedule.frequency) {
      case 'daily':
        nextDate.setDate(nextDate.getDate() + 1);
        // Skip weekends (Saturday = 6, Sunday = 0)
        while (nextDate.getDay() === 0 || nextDate.getDay() === 6) {
          nextDate.setDate(nextDate.getDate() + 1);
        }
        break;

      case 'weekly': {
        // Next occurrence of weekly_day_of_week
        const targetDay = schedule.weekly_day_of_week || 1; // Default Monday
        const currentDay = nextDate.getDay();
        const daysUntilTarget = (targetDay - currentDay + 7) % 7 || 7;
        nextDate.setDate(nextDate.getDate() + daysUntilTarget);
        break;
      }

      case 'monthly': {
        // Next occurrence of monthly_day_of_month
        const targetDate = Math.min(schedule.monthly_day_of_month || 1, 28);
        nextDate.setMonth(nextDate.getMonth() + 1);
        nextDate.setDate(targetDate);
        break;
      }
    }

    nextDate.setHours(0, 0, 0, 0);
    return nextDate;
  }

  /**
   * Get days since last payout
   */
  private getDaysSinceLastPayout(schedule: PayoutSchedule): number {
    const lastPayout = schedule.last_payout_at || schedule.created_at;
    const now = new Date();
    const diffMs = now.getTime() - lastPayout.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }

  /**
   * Process pending payouts
   * Called by cron job to execute payouts
   */
  async processPendingPayouts(): Promise<number> {
    console.log('[PayoutService] Processing pending payouts...');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get pending payouts scheduled for today or earlier
    const pendingPayouts = await this.payoutRepository.find({
      where: {
        status: 'pending',
        scheduled_payout_date: LessThan(today),
      },
      relations: ['payment_processor', 'business'],
    });

    console.log(`[PayoutService] Found ${pendingPayouts.length} pending payouts to process`);

    let processedCount = 0;

    for (const payout of pendingPayouts) {
      try {
        if (await this.processPayout(payout)) {
          processedCount++;
        }
      } catch (error: any) {
        console.error(`[PayoutService] Failed to process payout ${payout.id}:`, error.message);
      }
    }

    console.log(`[PayoutService] Processed ${processedCount} payouts`);
    return processedCount;
  }

  /**
   * Process a single payout
   */
  private async processPayout(payout: Payout): Promise<boolean> {
    PayoutService.assertReadablePayoutRow(payout, 'Pending payout row');

    payout.status = 'processing';
    await this.payoutRepository.save(payout);

    try {
      const payoutExecution = await this.executeProcessorPayout(payout);

      payout.status = 'completed';
      payout.processor_payout_id = payoutExecution.processorPayoutId;
      if (payoutExecution.bankTransactionId !== undefined) {
        payout.bank_transaction_id = payoutExecution.bankTransactionId;
      }
      payout.completed_at = new Date();
      payout.failure_reason = null;
      payout.failed_at = null;
      payout.next_retry_date = null;
      payout.reconciliation_status = 'pending'; // Will be reconciled later

      // Update payment settlement status
      const paymentIds = payout.metadata?.payment_ids || [];
      if (paymentIds.length > 0) {
        await this.paymentRepository.update(
          { id: In(paymentIds) },
          {
            settlement_details: {
              payout_id: payout.id,
              settled_at: new Date().toISOString(),
              settlement_status: 'settled',
            },
          }
        );
      }

      await this.payoutRepository.save(payout);

      // Log metric
      if (process.env.NODE_ENV === 'production') {
        logMetric(console as any, 'payout_completed', payout.net_amount_cents / 100, {
          payoutId: payout.id,
          businessId: payout.business_id,
        });
      }

      console.log(`[PayoutService] Successfully processed payout ${payout.id}`);
      return true;
    } catch (error: any) {
      await this.handlePayoutFailure(payout, error.message, {
        retryable: PayoutService.isRetryablePayoutError(error),
      });
      return false;
    }
  }

  /**
   * Handle payout failure with retry logic
   */
  private async handlePayoutFailure(
    payout: Payout,
    reason: string,
    options: { retryable?: boolean } = {}
  ): Promise<void> {
    const retryable = options.retryable ?? true;
    const safeFailureReason =
      typeof reason === 'string' &&
      reason.trim().length > 0 &&
      !PayoutService.hasUnsafePayoutTextControls(reason) &&
      !PayoutService.hasUnsafePayoutTextControls(reason.trim())
        ? reason.trim()
        : 'Payout processor returned an unsafe error message';

    payout.status = 'failed';
    payout.failure_reason = safeFailureReason;
    payout.failed_at = new Date();
    payout.completed_at = null;
    payout.processor_payout_id = null;
    payout.retry_count++;

    if (retryable && payout.retry_count < PayoutService.MAX_RETRY_COUNT) {
      // Schedule retry
      const retryDate = new Date();
      retryDate.setDate(retryDate.getDate() + PayoutService.RETRY_DELAY_DAYS);
      payout.next_retry_date = retryDate;
      payout.status = 'pending'; // Reset to pending for retry

      console.log(
        `[PayoutService] Payout ${payout.id} failed, retry ${payout.retry_count}/${PayoutService.MAX_RETRY_COUNT} scheduled for ${retryDate.toISOString()}`
      );
    } else if (retryable) {
      payout.next_retry_date = null;
      console.error(`[PayoutService] Payout ${payout.id} failed after ${PayoutService.MAX_RETRY_COUNT} retries`);
    } else {
      payout.next_retry_date = null;
      console.error(`[PayoutService] Payout ${payout.id} failed with a non-retryable error: ${reason}`);
    }

    await this.payoutRepository.save(payout);

    // Launch exception: seller payout-failure notification is tracked in
    // docs/product/capability-registry.yaml under notification_outbox before payout SLA launch.
  }

  /**
   * Get payout history for business
   */
  async getPayoutHistory(
    businessId: string,
    options?: {
      processorId?: string;
      startDate?: Date;
      endDate?: Date;
      status?: PayoutStatus;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ payouts: Payout[]; total: number }> {
    const where: any = { business_id: businessId };

    if (options?.processorId) {
      where.payment_processor_id = options.processorId;
    }

    if (options?.status) {
      where.status = options.status;
    }

    if (options?.startDate && options?.endDate) {
      where.created_at = Between(options.startDate, options.endDate);
    }

    const [payouts, total] = await this.payoutRepository.findAndCount({
      where,
      relations: ['payment_processor'],
      order: {
        created_at: 'DESC',
      },
      take: options?.limit || 50,
      skip: options?.offset || 0,
    });

    PayoutService.assertNonNegativeSafeInteger(total, 'Payout history total');
    payouts.forEach((payout, index) =>
      PayoutService.assertReadablePayoutRow(payout, `Payout row ${index + 1}`, { businessId })
    );

    return { payouts, total };
  }

  /**
   * Hold/unhold payout schedule
   */
  async togglePayoutHold(
    scheduleId: string,
    hold: boolean,
    reason?: string
  ): Promise<PayoutSchedule> {
    const schedule = await this.scheduleRepository.findOne({
      where: { id: scheduleId },
    });

    if (!schedule) {
      throw new Error('Payout schedule not found');
    }

    schedule.is_manually_held = hold;
    schedule.hold_reason = hold ? reason : null;
    schedule.hold_start_date = hold ? new Date() : null;

    return this.scheduleRepository.save(schedule);
  }

  /**
   * Update payout schedule configuration
   */
  async updateSchedule(
    scheduleId: string,
    updates: {
      frequency?: PayoutFrequency;
      min_payout_threshold_cents?: number;
      max_hold_period_days?: number;
      weekly_day_of_week?: number;
      monthly_day_of_month?: number;
      email_notifications_enabled?: boolean;
      notification_email?: string;
    }
  ): Promise<PayoutSchedule> {
    const normalizedScheduleId = PayoutService.assertNonEmptyString(scheduleId, 'Payout schedule id');
    if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
      throw new Error('Payout schedule updates must be an object');
    }

    const schedule = await this.scheduleRepository.findOne({
      where: { id: normalizedScheduleId },
    });

    if (!schedule) {
      throw new Error('Payout schedule not found');
    }

    const hasUpdate = (field: keyof typeof updates): boolean =>
      Object.prototype.hasOwnProperty.call(updates, field);

    const normalizedUpdates: Partial<PayoutSchedule> = {};
    if (hasUpdate('frequency')) {
      normalizedUpdates.frequency = PayoutService.assertValidFrequency(
        updates.frequency,
        'Payout schedule frequency'
      );
    }
    if (hasUpdate('min_payout_threshold_cents')) {
      normalizedUpdates.min_payout_threshold_cents = PayoutService.assertNonNegativeSafeInteger(
        updates.min_payout_threshold_cents,
        'Payout schedule minimum threshold'
      );
    }
    if (hasUpdate('max_hold_period_days')) {
      normalizedUpdates.max_hold_period_days = PayoutService.assertPositiveSafeInteger(
        updates.max_hold_period_days,
        'Payout schedule maximum hold period'
      );
    }
    if (hasUpdate('weekly_day_of_week')) {
      normalizedUpdates.weekly_day_of_week = PayoutService.assertDayOfWeek(
        updates.weekly_day_of_week,
        'Payout schedule weekly day'
      );
    }
    if (hasUpdate('monthly_day_of_month')) {
      normalizedUpdates.monthly_day_of_month = PayoutService.assertDayOfMonth(
        updates.monthly_day_of_month,
        'Payout schedule monthly day'
      );
    }
    if (hasUpdate('email_notifications_enabled')) {
      normalizedUpdates.email_notifications_enabled = PayoutService.assertBoolean(
        updates.email_notifications_enabled,
        'Payout schedule email notifications flag'
      );
    }
    if (hasUpdate('notification_email')) {
      normalizedUpdates.notification_email = PayoutService.assertOptionalEmail(
        updates.notification_email,
        'Payout schedule notification email'
      );
    }

    Object.assign(schedule, normalizedUpdates);

    // Recalculate next payout date if cadence changed
    if (
      hasUpdate('frequency') ||
      hasUpdate('weekly_day_of_week') ||
      hasUpdate('monthly_day_of_month')
    ) {
      schedule.next_payout_date = this.calculateNextPayoutDate(schedule);
    }

    return this.scheduleRepository.save(schedule);
  }

  /**
   * Get or create payout schedule for processor
   */
  async getOrCreateSchedule(
    businessId: string,
    processorId: string
  ): Promise<PayoutSchedule> {
    let schedule = await this.scheduleRepository.findOne({
      where: {
        business_id: businessId,
        payment_processor_id: processorId,
      },
    });

    if (!schedule) {
      // Create default schedule
      schedule = this.scheduleRepository.create({
        business_id: businessId,
        payment_processor_id: processorId,
        is_active: true,
        frequency: 'weekly',
        weekly_day_of_week: 1, // Monday
        min_payout_threshold_cents: 50000, // Rs. 500
        max_hold_period_days: 7,
        email_notifications_enabled: true,
        next_payout_date: this.calculateNextPayoutDate({
          frequency: 'weekly',
          weekly_day_of_week: 1,
          last_payout_at: null,
        } as PayoutSchedule),
      });

      schedule = await this.scheduleRepository.save(schedule);
    }

    return schedule;
  }

  /**
   * Update balance when payment succeeds
   */
  async updateBalanceForPayment(paymentId: string): Promise<void> {
    const payment = await this.paymentRepository.findOne({
      where: { id: paymentId },
    });

    if (!payment || payment.status !== 'succeeded' || !payment.payment_processor_id) {
      return;
    }

    const schedule = await this.getOrCreateSchedule(
      payment.business_id,
      payment.payment_processor_id
    );

    // Add to current balance
    schedule.current_balance_cents += payment.net_amount_cents;
    await this.scheduleRepository.save(schedule);
  }
}
