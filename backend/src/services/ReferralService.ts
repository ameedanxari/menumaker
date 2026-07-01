import { AppDataSource } from '../config/database.js';
import { Referral } from '../models/Referral.js';
import { User } from '../models/User.js';
import { capabilityReadiness, getCapability } from '../config/capabilities.js';
import crypto from 'crypto';

/**
 * Referral Service (Phase 2.5)
 *
 * Handles seller-to-seller referral tracking. Reward distribution is launch-gated
 * by the enhanced_referrals_affiliates capability.
 *
 * Funnel:
 * 1. Link clicked → track click (cookie stored)
 * 2. Signup completed → link referrer to referee
 * 3. First menu published → record qualification only while rewards are disabled
 *
 * Features:
 * - Referral code generation (FIRSTNAME + 4 digits)
 * - Click tracking with IP and device fingerprinting
 * - Fraud prevention (self-referral detection)
 * - Reward distribution remains disabled until enhanced referrals have launch evidence
 */

const REFERRAL_ENABLED = process.env.REFERRAL_ENABLED !== 'false'; // Default: enabled
const ATTRIBUTION_WINDOW_DAYS = 30; // Referee must sign up within 30 days
const MAX_REFERRALS_PER_MONTH = 50; // Anti-gaming limit
const VALID_REFERRAL_STATUSES = new Set([
  'link_clicked',
  'signup_completed',
  'first_menu_published',
  'expired',
]);
const REFERRAL_READ_ROW_KEYS = new Set([
  'id',
  'referral_code',
  'referrer',
  'referrer_id',
  'referee',
  'referee_id',
  'status',
  'referee_email',
  'referee_phone',
  'reward_type',
  'reward_value_cents',
  'reward_claimed',
  'reward_claimed_at',
  'source',
  'utm_source',
  'click_ip',
  'device_fingerprint',
  'clicked_at',
  'signup_completed_at',
  'first_menu_published_at',
  'created_at',
  'updated_at',
]);
const UNSAFE_REFERRAL_TEXT_CONTROLS =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/u;

function enhancedReferralRewardsEnabled(): boolean {
  const definition = getCapability('enhanced_referrals_affiliates');
  return definition ? capabilityReadiness(definition).enabled : false;
}

function assertNonEmptyString(label: string, value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value.trim();
}

function assertSafeReferralString(label: string, value: unknown): string {
  if (typeof value === 'string' && UNSAFE_REFERRAL_TEXT_CONTROLS.test(value)) {
    throw new Error(`${label} contains unsafe control characters`);
  }
  const normalized = assertNonEmptyString(label, value);
  if (UNSAFE_REFERRAL_TEXT_CONTROLS.test(normalized)) {
    throw new Error(`${label} contains unsafe control characters`);
  }
  return normalized;
}

function assertOptionalSafeReferralString(label: string, value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  return assertSafeReferralString(label, value);
}

function assertNonNegativeCents(label: string, value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(numeric) || numeric < 0) {
    throw new Error(`${label} must be a non-negative integer amount in cents`);
  }
  if (!Number.isSafeInteger(numeric)) {
    throw new Error(`${label} must be a safe integer amount in cents`);
  }
  return numeric;
}

function assertNonNegativeSafeInteger(label: string, value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(numeric) || numeric < 0) {
    throw new Error(`${label} must be a non-negative integer`);
  }
  if (!Number.isSafeInteger(numeric)) {
    throw new Error(`${label} must be a safe integer`);
  }
  return numeric;
}

function assertReferralStatus(label: string, value: unknown): string {
  const normalized = assertSafeReferralString(label, value).toLowerCase();
  if (!VALID_REFERRAL_STATUSES.has(normalized)) {
    throw new Error(
      `${label} must be link_clicked, signup_completed, first_menu_published, or expired`
    );
  }
  return normalized;
}

function assertOptionalDate(label: string, value: unknown): void {
  if (value === undefined || value === null) return;
  const parsed = value instanceof Date ? value.getTime() : Date.parse(String(value));
  if (Number.isNaN(parsed)) {
    throw new Error(`${label} must be a valid Date`);
  }
}

function assertReadableReferralRow(referral: Referral, requestedUserId: string, index: number): string {
  const label = `Referral row ${index + 1}`;
  const referralId = assertSafeReferralString(`${label} id`, referral.id);
  const unsafeKeys = Object.keys(referral).filter((key) => UNSAFE_REFERRAL_TEXT_CONTROLS.test(key));
  if (unsafeKeys.length > 0) {
    throw new Error(`${label} for referral ${referralId} field names contain unsafe control characters`);
  }
  const unsupportedKeys = Object.keys(referral).filter((key) => !REFERRAL_READ_ROW_KEYS.has(key));
  if (unsupportedKeys.length > 0) {
    throw new Error(
      `${label} for referral ${referralId} include unsupported field(s): ${unsupportedKeys.sort().join(', ')}`
    );
  }
  const referrerId = assertSafeReferralString(`${label} referrer_id`, referral.referrer_id);
  if (referrerId !== requestedUserId) {
    throw new Error(`${label} referrer_id must match requested user for referral ${referralId}`);
  }
  assertReferralStatus(`${label} status for referral ${referralId}`, referral.status);
  assertNonNegativeCents(`Reward value for referral ${referralId}`, referral.reward_value_cents);
  if (typeof referral.reward_claimed !== 'boolean') {
    throw new Error(`${label} reward_claimed for referral ${referralId} must be a boolean`);
  }
  assertOptionalSafeReferralString(`${label} referral_code for referral ${referralId}`, referral.referral_code);
  assertOptionalSafeReferralString(`${label} referee_id for referral ${referralId}`, referral.referee_id);
  assertOptionalSafeReferralString(`${label} referee_email for referral ${referralId}`, referral.referee_email);
  assertOptionalSafeReferralString(`${label} referee_phone for referral ${referralId}`, referral.referee_phone);
  assertOptionalSafeReferralString(`${label} source for referral ${referralId}`, referral.source);
  assertOptionalSafeReferralString(`${label} utm_source for referral ${referralId}`, referral.utm_source);
  assertOptionalSafeReferralString(`${label} click_ip for referral ${referralId}`, referral.click_ip);
  assertOptionalSafeReferralString(`${label} device_fingerprint for referral ${referralId}`, referral.device_fingerprint);
  assertOptionalDate(`${label} clicked_at for referral ${referralId}`, referral.clicked_at);
  assertOptionalDate(`${label} signup_completed_at for referral ${referralId}`, referral.signup_completed_at);
  assertOptionalDate(`${label} first_menu_published_at for referral ${referralId}`, referral.first_menu_published_at);
  assertOptionalDate(`${label} reward_claimed_at for referral ${referralId}`, referral.reward_claimed_at);
  return referralId;
}

function assertUniqueReadableReferralEvidence(referrals: Referral[]): void {
  const referralIds = new Set<string>();
  const completedRefereeIds = new Set<string>();

  referrals.forEach((referral, index) => {
    const label = `Referral row ${index + 1}`;
    const referralId = assertSafeReferralString(`${label} id`, referral.id);
    if (referralIds.has(referralId)) {
      throw new Error(`${label} id duplicates an earlier referral row`);
    }
    referralIds.add(referralId);

    if (
      (referral.status === 'signup_completed' || referral.status === 'first_menu_published') &&
      referral.referee_id
    ) {
      const refereeId = assertSafeReferralString(`${label} referee_id for referral ${referralId}`, referral.referee_id);
      if (completedRefereeIds.has(refereeId)) {
        throw new Error(`${label} referee_id must be unique for completed referral evidence`);
      }
      completedRefereeIds.add(refereeId);
    }
  });
}

export interface ReferralTrackClickParams {
  referral_code: string;
  source?: string; // 'whatsapp', 'instagram', 'email', 'direct_link'
  utm_source?: string;
  click_ip?: string;
  device_fingerprint?: string;
}

export interface ReferralSignupParams {
  referral_code: string;
  referee_id: string;
  referee_email: string;
  referee_phone?: string;
  signup_ip?: string;
}

export interface ReferralStats {
  total_referrals: number;
  link_clicked: number;
  signup_completed: number;
  first_menu_published: number;
  total_rewards_earned_cents: number;
  conversion_rate: number; // signup_completed / link_clicked
}

/**
 * ReferralService
 */
export class ReferralService {
  /**
   * Generate unique referral code for user
   * Format: FIRSTNAME + 4 random alphanumeric chars
   * Example: "PRIYA2024", "RAJESH5A8B"
   */
  static async generateReferralCode(user: User): Promise<string> {
    if (!REFERRAL_ENABLED) {
      throw new Error('Referral system is disabled');
    }

    // If user already has a code, return it
    if (user.referral_code) {
      return assertSafeReferralString('Existing referral code', user.referral_code);
    }

    // Extract first name from email (before @)
    const email = assertSafeReferralString('Referral user email', user.email);
    const emailPrefix = email.split('@')[0];
    const firstName = emailPrefix.split(/[._-]/)[0].toUpperCase();

    // Generate 4 random alphanumeric characters
    const randomSuffix = crypto.randomBytes(2).toString('hex').toUpperCase();

    let referralCode = `${firstName}${randomSuffix}`;

    // Ensure code is 6-12 characters
    if (referralCode.length > 12) {
      referralCode = referralCode.substring(0, 12);
    }

    // Check uniqueness, retry if collision
    const userRepo = AppDataSource.getRepository(User);
    let attempts = 0;
    while (attempts < 5) {
      const existing = await userRepo.findOne({
        where: { referral_code: referralCode },
      });

      if (!existing) {
        // Unique code found, save to user
        user.referral_code = referralCode;
        await userRepo.save(user);
        return referralCode;
      }

      // Collision, retry with new random suffix
      const newSuffix = crypto.randomBytes(2).toString('hex').toUpperCase();
      referralCode = `${firstName}${newSuffix}`;
      attempts++;
    }

    throw new Error('Failed to generate unique referral code after 5 attempts');
  }

  /**
   * Track referral link click
   * Creates a new referral record with status 'link_clicked'
   */
  static async trackClick(params: ReferralTrackClickParams): Promise<{ success: boolean; message?: string }> {
    if (!REFERRAL_ENABLED) {
      return { success: false, message: 'Referral system disabled' };
    }

    try {
      const referral_code = assertSafeReferralString('Referral click code', params.referral_code);
      const source = assertOptionalSafeReferralString('Referral click source', params.source);
      const utm_source = assertOptionalSafeReferralString('Referral click utm_source', params.utm_source);
      const click_ip = assertOptionalSafeReferralString('Referral click IP', params.click_ip);
      const device_fingerprint = assertOptionalSafeReferralString(
        'Referral click device fingerprint',
        params.device_fingerprint
      );

      // Find referrer by code
      const userRepo = AppDataSource.getRepository(User);
      const referrer = await userRepo.findOne({
        where: { referral_code },
      });

      if (!referrer) {
        return { success: false, message: 'Invalid referral code' };
      }

      // Check if this IP/device already clicked (prevent duplicate tracking)
      const referralRepo = AppDataSource.getRepository(Referral);

      if (click_ip || device_fingerprint) {
        const existingClick = await referralRepo.findOne({
          where: [
            { referrer_id: referrer.id, click_ip },
            { referrer_id: referrer.id, device_fingerprint },
          ].filter((condition) => {
            return (
              (condition.click_ip && click_ip) || (condition.device_fingerprint && device_fingerprint)
            );
          }),
        });

        if (existingClick) {
          // Already tracked this click
          return { success: true, message: 'Click already tracked' };
        }
      }

      // Create new referral record
      const referral = referralRepo.create({
        referral_code,
        referrer_id: referrer.id,
        status: 'link_clicked',
        source,
        utm_source,
        click_ip,
        device_fingerprint,
        clicked_at: new Date(),
      });

      await referralRepo.save(referral);

      console.log(`✅ Referral click tracked: ${referral_code} from ${source || 'direct'}`);

      return { success: true };
    } catch (error: any) {
      console.error('❌ Failed to track referral click:', error.message);
      return { success: false, message: 'Failed to track click' };
    }
  }

  /**
   * Apply referral code on signup
   * Links referee to referrer and updates status to 'signup_completed'
   */
  static async applyReferralOnSignup(params: ReferralSignupParams): Promise<{ success: boolean; message?: string }> {
    if (!REFERRAL_ENABLED) {
      return { success: false, message: 'Referral system disabled' };
    }

    try {
      const referral_code = assertSafeReferralString('Referral signup code', params.referral_code);
      const referee_id = assertSafeReferralString('Referral signup referee_id', params.referee_id);
      const referee_email = assertSafeReferralString('Referral signup referee_email', params.referee_email);
      const referee_phone = assertOptionalSafeReferralString('Referral signup referee_phone', params.referee_phone);
      assertOptionalSafeReferralString('Referral signup IP', params.signup_ip);

      const referralRepo = AppDataSource.getRepository(Referral);
      const userRepo = AppDataSource.getRepository(User);

      // Find referrer
      const referrer = await userRepo.findOne({
        where: { referral_code },
      });

      if (!referrer) {
        return { success: false, message: 'Invalid referral code' };
      }

      // FRAUD PREVENTION: Check for self-referral
      const referee = await userRepo.findOne({ where: { id: referee_id } });
      if (referee && referee.email === referrer.email) {
        console.warn('⚠️  Self-referral blocked:', referee_email);
        return { success: false, message: 'Self-referral not allowed' };
      }

      // Find most recent referral click for this code
      // Priority: match by device fingerprint > IP > most recent
      let referral = await referralRepo
        .createQueryBuilder('referral')
        .where('referral.referrer_id = :referrer_id', { referrer_id: referrer.id })
        .andWhere('referral.status = :status', { status: 'link_clicked' })
        .andWhere('referral.referee_id IS NULL')
        .orderBy('referral.created_at', 'DESC')
        .getOne();

      // If no click record found, create one (direct signup with code)
      if (!referral) {
        referral = referralRepo.create({
          referral_code,
          referrer_id: referrer.id,
          status: 'link_clicked',
          clicked_at: new Date(),
        });
      }

      // Check attribution window (30 days)
      const daysSinceClick =
        (new Date().getTime() - new Date(referral.created_at).getTime()) / (1000 * 60 * 60 * 24);

      if (daysSinceClick > ATTRIBUTION_WINDOW_DAYS) {
        console.warn(`⚠️  Referral expired (${daysSinceClick} days old):`, referral_code);
        referral.status = 'expired';
        await referralRepo.save(referral);
        return { success: false, message: 'Referral link expired (30 day limit)' };
      }

      // FRAUD PREVENTION: Check velocity (max referrals per month)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const recentReferrals = await referralRepo.count({
        where: {
          referrer_id: referrer.id,
          status: 'signup_completed',
        },
      });

      if (recentReferrals >= MAX_REFERRALS_PER_MONTH) {
        console.warn(`⚠️  Velocity limit exceeded for referrer:`, referrer.email);
        return { success: false, message: 'Referral limit reached' };
      }

      // Link referee to referral
      referral.referee_id = referee_id;
      referral.referee_email = referee_email;
      referral.referee_phone = referee_phone;
      referral.status = 'signup_completed';
      referral.signup_completed_at = new Date();

      await referralRepo.save(referral);

      // Update referee's referred_by_code
      if (referee) {
        referee.referred_by_code = referral_code;
        await userRepo.save(referee);
      }

      console.log(`✅ Referral applied: ${referrer.email} → ${referee_email}`);

      // Launch exception: simple-referral notification is tracked in
      // docs/product/capability-registry.yaml under notification_outbox before rewards launch review.

      return { success: true };
    } catch (error: any) {
      console.error('❌ Failed to apply referral:', error.message);
      return { success: false, message: 'Failed to apply referral' };
    }
  }

  /**
   * Record first-menu referral qualification.
   * Reward credits/free-tier grants are disabled until enhanced referrals are enabled.
   */
  static async triggerRewardOnFirstMenu(userId: string): Promise<{ success: boolean; message?: string }> {
    if (!REFERRAL_ENABLED) {
      return { success: false, message: 'Referral system disabled' };
    }

    try {
      const normalizedUserId = assertSafeReferralString('Referral reward user_id', userId);
      const referralRepo = AppDataSource.getRepository(Referral);
      const userRepo = AppDataSource.getRepository(User);

      // Find referral where this user is the referee
      const referral = await referralRepo.findOne({
        where: {
          referee_id: normalizedUserId,
          status: 'signup_completed',
        },
        relations: ['referrer', 'referee'],
      });

      if (!referral) {
        // User wasn't referred, no reward to distribute
        return { success: false, message: 'No referral found for this user' };
      }

      referral.status = 'first_menu_published';
      referral.first_menu_published_at = new Date();
      await referralRepo.save(referral);

      if (!enhancedReferralRewardsEnabled()) {
        return {
          success: true,
          message: 'Referral qualified. Reward credits are disabled for this launch build.',
        };
      }

      // Check if reward already claimed
      if (referral.reward_claimed) {
        console.warn('⚠️  Reward already claimed for referral:', referral.id);
        return { success: false, message: 'Reward already claimed' };
      }

      referral.reward_claimed = true;
      referral.reward_claimed_at = new Date();
      await referralRepo.save(referral);

      // Apply enhanced referral grants based on reward_type. This branch is unreachable while
      // enhanced_referrals_affiliates is disabled in the capability registry.
      if (referral.reward_type === 'free_pro_month') {
        const oneMonthFromNow = new Date();
        oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1);

        // Referrer reward
        const referrer = await userRepo.findOne({ where: { id: referral.referrer_id } });
        if (referrer) {
          referrer.pro_tier_expires_at = oneMonthFromNow;
          await userRepo.save(referrer);
          console.log(`✅ Applied enhanced referral grant to referrer: ${referrer.email}`);
        }

        // Referee reward
        const referee = await userRepo.findOne({ where: { id: referral.referee_id } });
        if (referee) {
          referee.pro_tier_expires_at = oneMonthFromNow;
          await userRepo.save(referee);
          console.log(`✅ Applied enhanced referral grant to referee: ${referee.email}`);
        }
      } else if (referral.reward_type === 'account_credit') {
        const creditAmount = referral.reward_value_cents || 50000; // Future enhanced-referral grant fallback

        // Referrer reward
        const referrer = await userRepo.findOne({ where: { id: referral.referrer_id } });
        if (referrer) {
          referrer.account_credit_cents += creditAmount;
          await userRepo.save(referrer);
          console.log(`✅ Applied enhanced referral grant to referrer: ${referrer.email}`);
        }

        // Referee reward
        const referee = await userRepo.findOne({ where: { id: referral.referee_id } });
        if (referee) {
          referee.account_credit_cents += creditAmount;
          await userRepo.save(referee);
          console.log(`✅ Applied enhanced referral grant to referee: ${referee.email}`);
        }
      }

      console.log(`🎉 Referral reward distributed: ${referral.id}`);

      // Launch exception: reward congratulations notifications are tracked in
      // docs/product/capability-registry.yaml under notification_outbox before rewards launch review.

      return { success: true };
    } catch (error: any) {
      console.error('❌ Failed to trigger referral reward:', error.message);
      return { success: false, message: 'Failed to distribute reward' };
    }
  }

  /**
   * Get referral stats for a user
   */
  static async getStats(userId: string): Promise<ReferralStats> {
    const normalizedUserId = assertSafeReferralString('Referral stats user_id', userId);
    const referralRepo = AppDataSource.getRepository(Referral);

    const referrals = await referralRepo.find({
      where: { referrer_id: normalizedUserId },
    });
    referrals.forEach((referral, index) =>
      assertReadableReferralRow(referral, normalizedUserId, index)
    );
    assertUniqueReadableReferralEvidence(referrals);

    const total_referrals = referrals.length;
    const link_clicked = referrals.filter((r) => r.status === 'link_clicked').length;
    const signup_completed = referrals.filter(
      (r) => r.status === 'signup_completed' || r.status === 'first_menu_published'
    ).length;
    const first_menu_published = referrals.filter((r) => r.status === 'first_menu_published').length;

    const total_rewards_earned_cents = referrals
      .filter((r) => enhancedReferralRewardsEnabled() && r.reward_claimed)
      .reduce((sum, r) => sum + (r.reward_value_cents || 0), 0);

    const conversion_rate = link_clicked > 0 ? signup_completed / link_clicked : 0;

    return {
      total_referrals,
      link_clicked,
      signup_completed,
      first_menu_published,
      total_rewards_earned_cents,
      conversion_rate,
    };
  }

  /**
   * Get all referrals made by a user
   */
  static async getReferrals(userId: string, limit: number = 20, offset: number = 0, status?: string): Promise<Referral[]> {
    const normalizedUserId = assertSafeReferralString('Referral list user_id', userId);
    const normalizedLimit = assertNonNegativeSafeInteger('Referral list limit', limit);
    const normalizedOffset = assertNonNegativeSafeInteger('Referral list offset', offset);
    const normalizedStatus = status === undefined ? undefined : assertReferralStatus('Referral list status', status);
    const referralRepo = AppDataSource.getRepository(Referral);

    const referrals = await referralRepo.find({
      where: {
        referrer_id: normalizedUserId,
        ...(normalizedStatus ? { status: normalizedStatus } : {}),
      },
      order: { created_at: 'DESC' },
      take: normalizedLimit,
      skip: normalizedOffset,
      relations: ['referee'],
    });
    referrals.forEach((referral, index) =>
      assertReadableReferralRow(referral, normalizedUserId, index)
    );
    assertUniqueReadableReferralEvidence(referrals);
    return referrals;
  }

  /**
   * Validate referral code (check if it exists)
   */
  static async validateCode(referral_code: string): Promise<{ valid: boolean; referrer_email?: string }> {
    const normalizedReferralCode = assertSafeReferralString('Referral validation code', referral_code);
    const userRepo = AppDataSource.getRepository(User);

    const referrer = await userRepo.findOne({
      where: { referral_code: normalizedReferralCode },
    });

    if (!referrer) {
      return { valid: false };
    }

    return {
      valid: true,
      referrer_email: assertSafeReferralString('Referral validation referrer email', referrer.email),
    };
  }
}
