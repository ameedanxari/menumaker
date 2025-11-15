import { Repository, Between, MoreThan } from 'typeorm';
import { AppDataSource } from '../config/database.js';
import {
  CustomerReferral,
  ReferralLeaderboard,
  Affiliate,
  AffiliateClick,
  AffiliatePayout,
  ViralBadge,
} from '../models/EnhancedReferral.js';
import { User } from '../models/User.js';
import { Referral } from '../models/Referral.js';

/**
 * LeaderboardService
 * Handles monthly referral leaderboard and prizes
 */
export class LeaderboardService {
  private leaderboardRepository: Repository<ReferralLeaderboard>;
  private referralRepository: Repository<Referral>;
  private userRepository: Repository<User>;

  constructor() {
    this.leaderboardRepository = AppDataSource.getRepository(ReferralLeaderboard);
    this.referralRepository = AppDataSource.getRepository(Referral);
    this.userRepository = AppDataSource.getRepository(User);
  }

  /**
   * Update leaderboard for current month
   */
  async updateLeaderboard(userId: string): Promise<void> {
    const currentMonth = this.getCurrentMonth();

    // Count successful referrals this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const successfulReferrals = await this.referralRepository.count({
      where: {
        referrer_id: userId,
        status: 'first_menu_published',
        first_menu_published_at: MoreThan(startOfMonth),
      },
    });

    // Update or create leaderboard entry
    let entry = await this.leaderboardRepository.findOne({
      where: { user_id: userId, month: currentMonth },
    });

    if (entry) {
      entry.successful_referrals = successfulReferrals;
      await this.leaderboardRepository.save(entry);
    } else {
      entry = this.leaderboardRepository.create({
        user_id: userId,
        month: currentMonth,
        successful_referrals: successfulReferrals,
      });
      await this.leaderboardRepository.save(entry);
    }
  }

  /**
   * Get top referrers for current month
   */
  async getTopReferrers(limit: number = 10): Promise<ReferralLeaderboard[]> {
    const currentMonth = this.getCurrentMonth();

    const leaderboard = await this.leaderboardRepository.find({
      where: { month: currentMonth },
      relations: ['user'],
      order: { successful_referrals: 'DESC' },
      take: limit,
    });

    // Assign ranks
    leaderboard.forEach((entry, index) => {
      entry.rank = index + 1;
    });

    return leaderboard;
  }

  /**
   * Get user's leaderboard position
   */
  async getUserPosition(userId: string): Promise<{
    rank: number | null;
    successful_referrals: number;
    total_participants: number;
  }> {
    const currentMonth = this.getCurrentMonth();

    const allEntries = await this.leaderboardRepository.find({
      where: { month: currentMonth },
      order: { successful_referrals: 'DESC' },
    });

    const userEntry = allEntries.find((e) => e.user_id === userId);

    if (!userEntry) {
      return {
        rank: null,
        successful_referrals: 0,
        total_participants: allEntries.length,
      };
    }

    const rank = allEntries.findIndex((e) => e.user_id === userId) + 1;

    return {
      rank,
      successful_referrals: userEntry.successful_referrals,
      total_participants: allEntries.length,
    };
  }

  /**
   * Distribute monthly prizes (cron job)
   */
  async distributePrizes(month: string): Promise<number> {
    const leaderboard = await this.leaderboardRepository.find({
      where: { month },
      order: { successful_referrals: 'DESC' },
      take: 3, // Top 3 winners
    });

    if (leaderboard.length === 0) return 0;

    const prizes = [
      { rank: 1, amount: 500000 }, // Rs. 5,000
      { rank: 2, amount: 300000 }, // Rs. 3,000
      { rank: 3, amount: 200000 }, // Rs. 2,000
    ];

    for (let i = 0; i < leaderboard.length; i++) {
      const entry = leaderboard[i];
      const prize = prizes[i];

      if (!entry.prize_paid) {
        entry.rank = prize.rank;
        entry.prize_amount_cents = prize.amount;
        entry.prize_paid = true;
        entry.prize_paid_at = new Date();

        await this.leaderboardRepository.save(entry);

        // Add account credit to user (stub - would integrate with payment system)
        // await this.addAccountCredit(entry.user_id, prize.amount);
      }
    }

    return leaderboard.length;
  }

  /**
   * Get current month in YYYY-MM format
   */
  private getCurrentMonth(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }
}

/**
 * AffiliateService
 * Handles affiliate program for influencers and bloggers
 */
export class AffiliateService {
  private affiliateRepository: Repository<Affiliate>;
  private clickRepository: Repository<AffiliateClick>;
  private payoutRepository: Repository<AffiliatePayout>;
  private userRepository: Repository<User>;

  constructor() {
    this.affiliateRepository = AppDataSource.getRepository(Affiliate);
    this.clickRepository = AppDataSource.getRepository(AffiliateClick);
    this.payoutRepository = AppDataSource.getRepository(AffiliatePayout);
    this.userRepository = AppDataSource.getRepository(User);
  }

  /**
   * Apply for affiliate program
   */
  async applyForAffiliate(
    userId: string,
    data: {
      application_message: string;
      instagram_handle?: string;
      instagram_followers?: number;
      youtube_channel?: string;
      youtube_subscribers?: number;
    }
  ): Promise<Affiliate> {
    // Check if user already has an affiliate application
    const existing = await this.affiliateRepository.findOne({
      where: { user_id: userId },
    });

    if (existing) {
      throw new Error('Affiliate application already exists');
    }

    // Generate unique affiliate code
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    const affiliateCode = this.generateAffiliateCode(user.full_name || user.email);

    // Create affiliate application
    const affiliate = this.affiliateRepository.create({
      user_id: userId,
      affiliate_code: affiliateCode,
      status: 'pending',
      application_message: data.application_message,
      instagram_handle: data.instagram_handle,
      instagram_followers: data.instagram_followers,
      youtube_channel: data.youtube_channel,
      youtube_subscribers: data.youtube_subscribers,
    });

    await this.affiliateRepository.save(affiliate);

    return affiliate;
  }

  /**
   * Approve affiliate application
   */
  async approveAffiliate(
    affiliateId: string,
    approvedById: string,
    customRates?: {
      seller_commission_rate?: number;
      customer_commission_rate?: number;
    }
  ): Promise<Affiliate> {
    const affiliate = await this.affiliateRepository.findOne({
      where: { id: affiliateId },
    });

    if (!affiliate) throw new Error('Affiliate not found');

    affiliate.status = 'approved';
    affiliate.approved_by_id = approvedById;
    affiliate.approved_at = new Date();

    if (customRates?.seller_commission_rate) {
      affiliate.seller_commission_rate = customRates.seller_commission_rate;
    }

    if (customRates?.customer_commission_rate) {
      affiliate.customer_commission_rate = customRates.customer_commission_rate;
    }

    // Generate QR code and marketing materials (stub)
    affiliate.qr_code_data = `https://menumaker.app/ref/${affiliate.affiliate_code}`;
    affiliate.social_media_templates = [
      'https://cdn.menumaker.app/templates/affiliate-instagram-story.png',
      'https://cdn.menumaker.app/templates/affiliate-post.png',
    ];

    await this.affiliateRepository.save(affiliate);

    return affiliate;
  }

  /**
   * Track affiliate click
   */
  async trackClick(
    affiliateCode: string,
    metadata: {
      ip_address?: string;
      user_agent?: string;
      referrer_url?: string;
      utm_source?: string;
      utm_medium?: string;
      utm_campaign?: string;
    }
  ): Promise<AffiliateClick> {
    const affiliate = await this.affiliateRepository.findOne({
      where: { affiliate_code: affiliateCode },
    });

    if (!affiliate) throw new Error('Affiliate not found');

    // Create click record
    const click = this.clickRepository.create({
      affiliate_id: affiliate.id,
      ip_address: metadata.ip_address,
      user_agent: metadata.user_agent,
      referrer_url: metadata.referrer_url,
      utm_source: metadata.utm_source,
      utm_medium: metadata.utm_medium,
      utm_campaign: metadata.utm_campaign,
    });

    await this.clickRepository.save(click);

    // Update affiliate stats
    affiliate.total_clicks += 1;
    await this.affiliateRepository.save(affiliate);

    return click;
  }

  /**
   * Track affiliate conversion
   */
  async trackConversion(
    clickId: string,
    convertedUserId: string
  ): Promise<void> {
    const click = await this.clickRepository.findOne({
      where: { id: clickId },
      relations: ['affiliate'],
    });

    if (!click) throw new Error('Click not found');

    click.converted = true;
    click.converted_user_id = convertedUserId;
    click.converted_at = new Date();

    await this.clickRepository.save(click);

    // Update affiliate stats
    const affiliate = click.affiliate;
    affiliate.total_signups += 1;
    affiliate.total_conversions += 1;

    await this.affiliateRepository.save(affiliate);
  }

  /**
   * Calculate affiliate commission
   */
  async calculateCommission(
    affiliateId: string,
    gmvCents: number,
    type: 'seller' | 'customer'
  ): Promise<number> {
    const affiliate = await this.affiliateRepository.findOne({
      where: { id: affiliateId },
    });

    if (!affiliate) return 0;

    const rate =
      type === 'seller'
        ? affiliate.seller_commission_rate
        : affiliate.customer_commission_rate;

    const commissionCents = Math.round((gmvCents * rate) / 100);

    // Update affiliate stats
    affiliate.total_gmv_cents += gmvCents;
    affiliate.total_commission_earned_cents += commissionCents;
    affiliate.pending_commission_cents += commissionCents;

    await this.affiliateRepository.save(affiliate);

    return commissionCents;
  }

  /**
   * Get affiliate dashboard data
   */
  async getAffiliateDashboard(userId: string): Promise<{
    affiliate: Affiliate;
    stats: {
      total_clicks: number;
      total_signups: number;
      total_conversions: number;
      conversion_rate: number;
      total_gmv: number;
      total_commission_earned: number;
      total_commission_paid: number;
      pending_commission: number;
    };
    recent_clicks: AffiliateClick[];
    recent_payouts: AffiliatePayout[];
  }> {
    const affiliate = await this.affiliateRepository.findOne({
      where: { user_id: userId },
    });

    if (!affiliate) throw new Error('Affiliate not found');

    // Get recent clicks
    const recentClicks = await this.clickRepository.find({
      where: { affiliate_id: affiliate.id },
      order: { created_at: 'DESC' },
      take: 10,
    });

    // Get recent payouts
    const recentPayouts = await this.payoutRepository.find({
      where: { affiliate_id: affiliate.id },
      order: { created_at: 'DESC' },
      take: 10,
    });

    const conversionRate =
      affiliate.total_clicks > 0
        ? (affiliate.total_conversions / affiliate.total_clicks) * 100
        : 0;

    return {
      affiliate,
      stats: {
        total_clicks: affiliate.total_clicks,
        total_signups: affiliate.total_signups,
        total_conversions: affiliate.total_conversions,
        conversion_rate: Math.round(conversionRate * 100) / 100,
        total_gmv: affiliate.total_gmv_cents / 100,
        total_commission_earned: affiliate.total_commission_earned_cents / 100,
        total_commission_paid: affiliate.total_commission_paid_cents / 100,
        pending_commission: affiliate.pending_commission_cents / 100,
      },
      recent_clicks: recentClicks,
      recent_payouts: recentPayouts,
    };
  }

  /**
   * Process monthly payouts (cron job)
   */
  async processMonthlyPayouts(month: string): Promise<number> {
    const affiliates = await this.affiliateRepository.find({
      where: { status: 'approved' },
    });

    let processed = 0;

    for (const affiliate of affiliates) {
      // Check if pending commission exceeds minimum payout
      if (affiliate.pending_commission_cents < affiliate.min_payout_cents) {
        continue;
      }

      // Create payout record
      const payout = this.payoutRepository.create({
        affiliate_id: affiliate.id,
        payout_month: month,
        payout_amount_cents: affiliate.pending_commission_cents,
        status: 'pending',
        payout_method: affiliate.payout_method,
      });

      await this.payoutRepository.save(payout);

      // Update affiliate
      affiliate.pending_commission_cents = 0;
      await this.affiliateRepository.save(affiliate);

      processed++;
    }

    return processed;
  }

  /**
   * Generate unique affiliate code
   */
  private generateAffiliateCode(name: string): string {
    const prefix = name
      .toUpperCase()
      .replace(/[^A-Z]/g, '')
      .substring(0, 10);
    const timestamp = Date.now().toString().slice(-6);
    return `${prefix}_${timestamp}`;
  }
}

/**
 * ViralService
 * Handles customer referrals, social sharing, and viral badges
 */
export class ViralService {
  private customerReferralRepository: Repository<CustomerReferral>;
  private badgeRepository: Repository<ViralBadge>;
  private userRepository: Repository<User>;

  constructor() {
    this.customerReferralRepository = AppDataSource.getRepository(CustomerReferral);
    this.badgeRepository = AppDataSource.getRepository(ViralBadge);
    this.userRepository = AppDataSource.getRepository(User);
  }

  /**
   * Create customer referral code
   */
  async createCustomerReferral(
    userId: string,
    businessId: string
  ): Promise<CustomerReferral> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    const referralCode = this.generateCustomerReferralCode(user.full_name || user.email);

    const referral = this.customerReferralRepository.create({
      business_id: businessId,
      referrer_id: userId,
      referral_code: referralCode,
      status: 'link_clicked',
    });

    await this.customerReferralRepository.save(referral);

    return referral;
  }

  /**
   * Track customer referral order
   */
  async trackReferralOrder(
    referralCode: string,
    refereeId: string,
    orderId: string
  ): Promise<CustomerReferral> {
    const referral = await this.customerReferralRepository.findOne({
      where: { referral_code: referralCode },
    });

    if (!referral) throw new Error('Referral code not found');

    referral.referee_id = refereeId;
    referral.referee_order_id = orderId;
    referral.status = 'order_placed';
    referral.order_placed_at = new Date();

    await this.customerReferralRepository.save(referral);

    return referral;
  }

  /**
   * Claim referral rewards
   */
  async claimReferralRewards(referralId: string): Promise<void> {
    const referral = await this.customerReferralRepository.findOne({
      where: { id: referralId },
    });

    if (!referral) throw new Error('Referral not found');
    if (referral.status !== 'order_placed') {
      throw new Error('Order not placed yet');
    }

    // Mark rewards as claimed
    referral.referrer_reward_claimed = true;
    referral.referee_reward_claimed = true;
    referral.reward_claimed_at = new Date();
    referral.status = 'reward_claimed';

    await this.customerReferralRepository.save(referral);

    // Award discount coupons to both users (stub - integrate with coupon system)
    // await this.createRewardCoupon(referral.referrer_id, referral.reward_value_cents);
    // await this.createRewardCoupon(referral.referee_id!, referral.reward_value_cents);
  }

  /**
   * Get customer referral stats
   */
  async getCustomerReferralStats(userId: string): Promise<{
    total_referrals: number;
    successful_referrals: number;
    total_rewards_earned: number;
  }> {
    const referrals = await this.customerReferralRepository.find({
      where: { referrer_id: userId },
    });

    const successfulReferrals = referrals.filter(
      (r) => r.status === 'reward_claimed'
    ).length;

    const totalRewards = successfulReferrals * 10000; // Rs. 100 per referral

    return {
      total_referrals: referrals.length,
      successful_referrals: successfulReferrals,
      total_rewards_earned: totalRewards / 100,
    };
  }

  /**
   * Check and award viral badges
   */
  async checkAndAwardBadges(userId: string): Promise<ViralBadge[]> {
    const referrals = await this.customerReferralRepository.find({
      where: { referrer_id: userId, status: 'reward_claimed' },
    });

    const successfulCount = referrals.length;

    const badgeDefinitions = [
      {
        type: 'superstar',
        tier: 1,
        display_name: 'Superstar Seller',
        required: 10,
        benefits: ['priority_support', 'advanced_analytics'],
      },
      {
        type: 'mega_influencer',
        tier: 2,
        display_name: 'Mega Influencer',
        required: 50,
        benefits: ['priority_support', 'advanced_analytics', 'custom_branding'],
      },
      {
        type: 'viral_king',
        tier: 3,
        display_name: 'Viral King',
        required: 100,
        benefits: ['priority_support', 'advanced_analytics', 'custom_branding', 'personal_account_manager'],
      },
    ];

    const awardedBadges: ViralBadge[] = [];

    for (const definition of badgeDefinitions) {
      if (successfulCount >= definition.required) {
        // Check if badge already exists
        const existing = await this.badgeRepository.findOne({
          where: { user_id: userId, badge_type: definition.type },
        });

        if (!existing) {
          const badge = this.badgeRepository.create({
            user_id: userId,
            badge_type: definition.type,
            tier: definition.tier,
            display_name: definition.display_name,
            referrals_required: definition.required,
            referrals_achieved: successfulCount,
            benefits: definition.benefits,
            awarded_at: new Date(),
          });

          await this.badgeRepository.save(badge);
          awardedBadges.push(badge);
        }
      }
    }

    return awardedBadges;
  }

  /**
   * Get user's viral badges
   */
  async getUserBadges(userId: string): Promise<ViralBadge[]> {
    return this.badgeRepository.find({
      where: { user_id: userId },
      order: { tier: 'DESC' },
    });
  }

  /**
   * Generate Instagram story share data
   */
  generateInstagramStoryShare(
    referralCode: string,
    businessName: string,
    menuPreviewUrl?: string
  ): {
    story_url: string;
    story_template: {
      background_image?: string;
      text: string;
      link: string;
    };
  } {
    const shareLink = `https://menumaker.app?ref=${referralCode}`;

    return {
      story_url: `instagram://story-camera`,
      story_template: {
        background_image: menuPreviewUrl,
        text: `Join me on MenuMaker! Use code ${referralCode} for Rs. 100 off 🎉`,
        link: shareLink,
      },
    };
  }

  /**
   * Generate WhatsApp share message
   */
  generateWhatsAppShare(referralCode: string, businessName: string): {
    message: string;
    share_url: string;
  } {
    const shareLink = `https://menumaker.app?ref=${referralCode}`;
    const message = `🍽️ I'm using MenuMaker for my food business!\n\nJoin me and get Rs. 500 off: ${shareLink}\n\nUse code: ${referralCode}`;

    const encodedMessage = encodeURIComponent(message);
    const shareUrl = `https://wa.me/?text=${encodedMessage}`;

    return {
      message,
      share_url: shareUrl,
    };
  }

  /**
   * Generate customer referral code
   */
  private generateCustomerReferralCode(name: string): string {
    const prefix = name
      .toUpperCase()
      .replace(/[^A-Z]/g, '')
      .substring(0, 6);
    const timestamp = Date.now().toString().slice(-6);
    return `CUST_${prefix}${timestamp}`;
  }
}
