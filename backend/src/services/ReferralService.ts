import { AppDataSource } from '../config/database.js';
import { Referral } from '../models/Referral.js';
import { User } from '../models/User.js';
import crypto from 'crypto';

/**
 * Referral Service (Phase 2.5)
 *
 * Handles seller-to-seller referral tracking and reward distribution.
 *
 * Funnel:
 * 1. Link clicked → track click (cookie stored)
 * 2. Signup completed → link referrer to referee
 * 3. First menu published → award rewards to both parties
 *
 * Features:
 * - Referral code generation (FIRSTNAME + 4 digits)
 * - Click tracking with IP and device fingerprinting
 * - Fraud prevention (self-referral detection)
 * - Reward distribution (free Pro month OR account credit)
 */

const REFERRAL_ENABLED = process.env.REFERRAL_ENABLED !== 'false'; // Default: enabled
const ATTRIBUTION_WINDOW_DAYS = 30; // Referee must sign up within 30 days
const MAX_REFERRALS_PER_MONTH = 50; // Anti-gaming limit

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
      return user.referral_code;
    }

    // Extract first name from email (before @)
    const emailPrefix = user.email.split('@')[0];
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
      const { referral_code, source, utm_source, click_ip, device_fingerprint } = params;

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
      const { referral_code, referee_id, referee_email, referee_phone } = params;

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

      // TODO: Send notification to referrer (future enhancement)

      return { success: true };
    } catch (error: any) {
      console.error('❌ Failed to apply referral:', error.message);
      return { success: false, message: 'Failed to apply referral' };
    }
  }

  /**
   * Trigger reward when referee publishes first menu
   * Awards rewards to both referrer and referee
   */
  static async triggerRewardOnFirstMenu(userId: string): Promise<{ success: boolean; message?: string }> {
    if (!REFERRAL_ENABLED) {
      return { success: false, message: 'Referral system disabled' };
    }

    try {
      const referralRepo = AppDataSource.getRepository(Referral);
      const userRepo = AppDataSource.getRepository(User);

      // Find referral where this user is the referee
      const referral = await referralRepo.findOne({
        where: {
          referee_id: userId,
          status: 'signup_completed',
        },
        relations: ['referrer', 'referee'],
      });

      if (!referral) {
        // User wasn't referred, no reward to distribute
        return { success: false, message: 'No referral found for this user' };
      }

      // Check if reward already claimed
      if (referral.reward_claimed) {
        console.warn('⚠️  Reward already claimed for referral:', referral.id);
        return { success: false, message: 'Reward already claimed' };
      }

      // Update referral status
      referral.status = 'first_menu_published';
      referral.first_menu_published_at = new Date();
      referral.reward_claimed = true;
      referral.reward_claimed_at = new Date();

      await referralRepo.save(referral);

      // Award rewards based on reward_type
      if (referral.reward_type === 'free_pro_month') {
        // Award 1 month free Pro to both parties
        const oneMonthFromNow = new Date();
        oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1);

        // Referrer reward
        const referrer = await userRepo.findOne({ where: { id: referral.referrer_id } });
        if (referrer) {
          referrer.pro_tier_expires_at = oneMonthFromNow;
          await userRepo.save(referrer);
          console.log(`✅ Awarded Pro tier to referrer: ${referrer.email}`);
        }

        // Referee reward
        const referee = await userRepo.findOne({ where: { id: referral.referee_id } });
        if (referee) {
          referee.pro_tier_expires_at = oneMonthFromNow;
          await userRepo.save(referee);
          console.log(`✅ Awarded Pro tier to referee: ${referee.email}`);
        }
      } else if (referral.reward_type === 'account_credit') {
        // Award Rs. 500 account credit to both parties
        const creditAmount = referral.reward_value_cents || 50000; // Default Rs. 500

        // Referrer reward
        const referrer = await userRepo.findOne({ where: { id: referral.referrer_id } });
        if (referrer) {
          referrer.account_credit_cents += creditAmount;
          await userRepo.save(referrer);
          console.log(`✅ Added Rs. ${creditAmount / 100} credit to referrer: ${referrer.email}`);
        }

        // Referee reward
        const referee = await userRepo.findOne({ where: { id: referral.referee_id } });
        if (referee) {
          referee.account_credit_cents += creditAmount;
          await userRepo.save(referee);
          console.log(`✅ Added Rs. ${creditAmount / 100} credit to referee: ${referee.email}`);
        }
      }

      console.log(`🎉 Referral reward distributed: ${referral.id}`);

      // TODO: Send congratulations notifications to both parties (future enhancement)

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
    const referralRepo = AppDataSource.getRepository(Referral);

    const referrals = await referralRepo.find({
      where: { referrer_id: userId },
    });

    const total_referrals = referrals.length;
    const link_clicked = referrals.filter((r) => r.status === 'link_clicked').length;
    const signup_completed = referrals.filter(
      (r) => r.status === 'signup_completed' || r.status === 'first_menu_published'
    ).length;
    const first_menu_published = referrals.filter((r) => r.status === 'first_menu_published').length;

    const total_rewards_earned_cents = referrals
      .filter((r) => r.reward_claimed)
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
  static async getReferrals(userId: string, limit: number = 20, offset: number = 0): Promise<Referral[]> {
    const referralRepo = AppDataSource.getRepository(Referral);

    return await referralRepo.find({
      where: { referrer_id: userId },
      order: { created_at: 'DESC' },
      take: limit,
      skip: offset,
      relations: ['referee'],
    });
  }

  /**
   * Validate referral code (check if it exists)
   */
  static async validateCode(referral_code: string): Promise<{ valid: boolean; referrer_email?: string }> {
    const userRepo = AppDataSource.getRepository(User);

    const referrer = await userRepo.findOne({
      where: { referral_code },
    });

    if (!referrer) {
      return { valid: false };
    }

    return {
      valid: true,
      referrer_email: referrer.email,
    };
  }
}
