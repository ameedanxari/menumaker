import { Repository, LessThan, IsNull, In, Between } from 'typeorm';
import { AppDataSource } from '../config/database.js';
import { Payout, PayoutStatus, PayoutFrequency } from '../models/Payout.js';
import { PayoutSchedule } from '../models/PayoutSchedule.js';
import { Payment } from '../models/Payment.js';
import { PaymentProcessor } from '../models/PaymentProcessor.js';
import { Subscription } from '../models/Subscription.js';
import { logMetric } from '../utils/logger.js';

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

  // Constants
  private static readonly VOLUME_DISCOUNT_THRESHOLD_CENTS = 10000000; // Rs. 1L (100,000 rupees)
  private static readonly VOLUME_DISCOUNT_PERCENTAGE = 0.5; // 0.5% fee reduction
  private static readonly MAX_RETRY_COUNT = 3;
  private static readonly RETRY_DELAY_DAYS = 1;

  constructor() {
    this.payoutRepository = AppDataSource.getRepository(Payout);
    this.scheduleRepository = AppDataSource.getRepository(PayoutSchedule);
    this.paymentRepository = AppDataSource.getRepository(Payment);
    this.processorRepository = AppDataSource.getRepository(PaymentProcessor);
    this.subscriptionRepository = AppDataSource.getRepository(Subscription);
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
        await this.processPayout(payout);
        processedCount++;
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
  private async processPayout(payout: Payout): Promise<void> {
    payout.status = 'processing';
    await this.payoutRepository.save(payout);

    try {
      // In production, this would call the processor's payout API
      // For now, we simulate success
      const processorPayoutId = `payout_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

      payout.status = 'completed';
      payout.processor_payout_id = processorPayoutId;
      payout.completed_at = new Date();
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
    } catch (error: any) {
      await this.handlePayoutFailure(payout, error.message);
    }
  }

  /**
   * Handle payout failure with retry logic
   */
  private async handlePayoutFailure(payout: Payout, reason: string): Promise<void> {
    payout.status = 'failed';
    payout.failure_reason = reason;
    payout.failed_at = new Date();
    payout.retry_count++;

    if (payout.retry_count < PayoutService.MAX_RETRY_COUNT) {
      // Schedule retry
      const retryDate = new Date();
      retryDate.setDate(retryDate.getDate() + PayoutService.RETRY_DELAY_DAYS);
      payout.next_retry_date = retryDate;
      payout.status = 'pending'; // Reset to pending for retry

      console.log(
        `[PayoutService] Payout ${payout.id} failed, retry ${payout.retry_count}/${PayoutService.MAX_RETRY_COUNT} scheduled for ${retryDate.toISOString()}`
      );
    } else {
      console.error(`[PayoutService] Payout ${payout.id} failed after ${PayoutService.MAX_RETRY_COUNT} retries`);
    }

    await this.payoutRepository.save(payout);

    // TODO: Send email notification to seller
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
    const schedule = await this.scheduleRepository.findOne({
      where: { id: scheduleId },
    });

    if (!schedule) {
      throw new Error('Payout schedule not found');
    }

    Object.assign(schedule, updates);

    // Recalculate next payout date if frequency changed
    if (updates.frequency) {
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
