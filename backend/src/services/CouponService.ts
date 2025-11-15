import { Repository, Between, MoreThan, LessThan } from 'typeorm';
import { AppDataSource } from '../config/database.js';
import {
  Coupon,
  CouponUsage,
  AutomaticPromotion,
  DiscountType,
  UsageLimitType,
  CouponStatus,
  ApplicableToType,
} from '../models/Coupon.js';
import { Order } from '../models/Order.js';

/**
 * Coupon Service
 * Handles coupon creation, validation, application, and analytics
 */
export class CouponService {
  private couponRepository: Repository<Coupon>;
  private usageRepository: Repository<CouponUsage>;
  private promotionRepository: Repository<AutomaticPromotion>;
  private orderRepository: Repository<Order>;

  constructor() {
    this.couponRepository = AppDataSource.getRepository(Coupon);
    this.usageRepository = AppDataSource.getRepository(CouponUsage);
    this.promotionRepository = AppDataSource.getRepository(AutomaticPromotion);
    this.orderRepository = AppDataSource.getRepository(Order);
  }

  /**
   * Create coupon
   */
  async createCoupon(
    businessId: string,
    data: {
      code: string;
      name: string;
      description?: string;
      discount_type: DiscountType;
      discount_value: number;
      max_discount_cents?: number;
      min_order_value_cents?: number;
      valid_from: Date;
      valid_until: Date;
      usage_limit_type?: UsageLimitType;
      usage_limit_per_customer?: number;
      usage_limit_per_month?: number;
      total_usage_limit?: number;
      applicable_to?: ApplicableToType;
      dish_ids?: string[];
      is_public?: boolean;
    }
  ): Promise<Coupon> {
    // Validate coupon code uniqueness
    const existing = await this.couponRepository.findOne({
      where: { code: data.code.toUpperCase() },
    });

    if (existing) {
      throw new Error('Coupon code already exists');
    }

    // Validate dates
    if (new Date(data.valid_from) >= new Date(data.valid_until)) {
      throw new Error('Valid from date must be before valid until date');
    }

    // Create coupon
    const coupon = this.couponRepository.create({
      business_id: businessId,
      code: data.code.toUpperCase(),
      name: data.name,
      description: data.description,
      discount_type: data.discount_type,
      discount_value: data.discount_value,
      max_discount_cents: data.max_discount_cents,
      min_order_value_cents: data.min_order_value_cents || 0,
      valid_from: new Date(data.valid_from),
      valid_until: new Date(data.valid_until),
      usage_limit_type: data.usage_limit_type || 'unlimited',
      usage_limit_per_customer: data.usage_limit_per_customer,
      usage_limit_per_month: data.usage_limit_per_month,
      total_usage_limit: data.total_usage_limit,
      applicable_to: data.applicable_to || 'all_dishes',
      dish_ids: data.dish_ids || [],
      is_public: data.is_public !== false,
      status: 'active',
    });

    await this.couponRepository.save(coupon);

    // Generate QR code (stub - would use QR library)
    coupon.qr_code_data = `https://menumaker.app/coupon/${coupon.code}`;
    await this.couponRepository.save(coupon);

    return coupon;
  }

  /**
   * Validate coupon
   */
  async validateCoupon(
    couponCode: string,
    customerId: string,
    businessId: string,
    orderSubtotalCents: number,
    dishIds: string[]
  ): Promise<{
    valid: boolean;
    coupon?: Coupon;
    discount_amount_cents?: number;
    error?: string;
  }> {
    // Find coupon
    const coupon = await this.couponRepository.findOne({
      where: {
        code: couponCode.toUpperCase(),
        business_id: businessId,
      },
    });

    if (!coupon) {
      return { valid: false, error: 'Coupon not found' };
    }

    // Check status
    if (coupon.status !== 'active') {
      return { valid: false, error: 'Coupon is not active' };
    }

    // Check expiration
    const now = new Date();
    if (now < new Date(coupon.valid_from)) {
      return { valid: false, error: 'Coupon is not yet valid' };
    }

    if (now > new Date(coupon.valid_until)) {
      return { valid: false, error: 'Coupon has expired' };
    }

    // Check minimum order value
    if (orderSubtotalCents < coupon.min_order_value_cents) {
      const minValue = (coupon.min_order_value_cents / 100).toFixed(2);
      return {
        valid: false,
        error: `Minimum order value of Rs. ${minValue} required`,
      };
    }

    // Check applicable dishes
    if (coupon.applicable_to === 'specific_dishes') {
      const applicableDishes = coupon.dish_ids;
      const hasApplicableDish = dishIds.some((id) => applicableDishes.includes(id));

      if (!hasApplicableDish) {
        return {
          valid: false,
          error: 'Coupon not applicable to items in cart',
        };
      }
    }

    // Check usage limits
    const usageCheckResult = await this.checkUsageLimits(coupon, customerId);
    if (!usageCheckResult.valid) {
      return { valid: false, error: usageCheckResult.error };
    }

    // Calculate discount
    const discountAmountCents = this.calculateDiscount(
      coupon,
      orderSubtotalCents
    );

    return {
      valid: true,
      coupon,
      discount_amount_cents: discountAmountCents,
    };
  }

  /**
   * Check usage limits
   */
  private async checkUsageLimits(
    coupon: Coupon,
    customerId: string
  ): Promise<{ valid: boolean; error?: string }> {
    // Unlimited usage
    if (coupon.usage_limit_type === 'unlimited') {
      return { valid: true };
    }

    // Total usage limit
    if (coupon.usage_limit_type === 'total_limit') {
      if (coupon.total_usage_count >= (coupon.total_usage_limit || 0)) {
        return { valid: false, error: 'Coupon usage limit reached' };
      }
    }

    // Per customer limit
    if (coupon.usage_limit_type === 'per_customer') {
      const customerUsageCount = await this.usageRepository.count({
        where: {
          coupon_id: coupon.id,
          customer_id: customerId,
        },
      });

      if (customerUsageCount >= (coupon.usage_limit_per_customer || 0)) {
        return {
          valid: false,
          error: 'You have already used this coupon',
        };
      }
    }

    // Per month limit
    if (coupon.usage_limit_type === 'per_month') {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const endOfMonth = new Date(startOfMonth);
      endOfMonth.setMonth(endOfMonth.getMonth() + 1);

      const monthlyUsageCount = await this.usageRepository.count({
        where: {
          coupon_id: coupon.id,
          customer_id: customerId,
          created_at: Between(startOfMonth, endOfMonth),
        },
      });

      if (monthlyUsageCount >= (coupon.usage_limit_per_month || 0)) {
        return {
          valid: false,
          error: 'Monthly usage limit for this coupon reached',
        };
      }
    }

    return { valid: true };
  }

  /**
   * Calculate discount amount
   */
  private calculateDiscount(coupon: Coupon, orderSubtotalCents: number): number {
    let discountCents = 0;

    if (coupon.discount_type === 'fixed') {
      // Fixed discount (e.g., Rs. 50 off)
      discountCents = coupon.discount_value;
    } else if (coupon.discount_type === 'percentage') {
      // Percentage discount (e.g., 10% off)
      discountCents = Math.round((orderSubtotalCents * coupon.discount_value) / 100);

      // Apply max discount cap if specified
      if (coupon.max_discount_cents && discountCents > coupon.max_discount_cents) {
        discountCents = coupon.max_discount_cents;
      }
    }

    // Discount cannot exceed order subtotal
    if (discountCents > orderSubtotalCents) {
      discountCents = orderSubtotalCents;
    }

    return discountCents;
  }

  /**
   * Apply coupon to order (record usage)
   */
  async applyCoupon(
    orderId: string,
    couponId: string,
    customerId: string,
    businessId: string,
    orderSubtotalCents: number,
    discountAmountCents: number
  ): Promise<CouponUsage> {
    const coupon = await this.couponRepository.findOne({
      where: { id: couponId },
    });

    if (!coupon) {
      throw new Error('Coupon not found');
    }

    // Create usage record
    const usage = this.usageRepository.create({
      coupon_id: couponId,
      order_id: orderId,
      customer_id: customerId,
      business_id: businessId,
      coupon_code: coupon.code,
      discount_type: coupon.discount_type,
      discount_value: coupon.discount_value,
      discount_amount_cents: discountAmountCents,
      order_subtotal_cents: orderSubtotalCents,
      order_total_cents: orderSubtotalCents - discountAmountCents,
    });

    await this.usageRepository.save(usage);

    // Update coupon analytics
    coupon.total_usage_count += 1;
    coupon.total_discount_given_cents += discountAmountCents;
    coupon.total_revenue_generated_cents += orderSubtotalCents - discountAmountCents;

    await this.couponRepository.save(coupon);

    return usage;
  }

  /**
   * Get coupons for a business
   */
  async getBusinessCoupons(
    businessId: string,
    filters?: {
      status?: CouponStatus;
      is_public?: boolean;
    }
  ): Promise<Coupon[]> {
    const where: any = { business_id: businessId };

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.is_public !== undefined) {
      where.is_public = filters.is_public;
    }

    return this.couponRepository.find({
      where,
      order: { created_at: 'DESC' },
    });
  }

  /**
   * Get public coupons (for menu display)
   */
  async getPublicCoupons(businessId: string): Promise<Coupon[]> {
    const now = new Date();

    return this.couponRepository.find({
      where: {
        business_id: businessId,
        is_public: true,
        status: 'active',
      },
      order: { created_at: 'DESC' },
    });
  }

  /**
   * Update coupon
   */
  async updateCoupon(
    couponId: string,
    data: Partial<{
      name: string;
      description: string;
      min_order_value_cents: number;
      valid_until: Date;
      is_public: boolean;
      status: CouponStatus;
    }>
  ): Promise<Coupon> {
    const coupon = await this.couponRepository.findOne({
      where: { id: couponId },
    });

    if (!coupon) {
      throw new Error('Coupon not found');
    }

    // Update fields
    if (data.name) coupon.name = data.name;
    if (data.description !== undefined) coupon.description = data.description;
    if (data.min_order_value_cents !== undefined)
      coupon.min_order_value_cents = data.min_order_value_cents;
    if (data.valid_until) coupon.valid_until = new Date(data.valid_until);
    if (data.is_public !== undefined) coupon.is_public = data.is_public;
    if (data.status) coupon.status = data.status;

    await this.couponRepository.save(coupon);

    return coupon;
  }

  /**
   * Archive coupon
   */
  async archiveCoupon(couponId: string): Promise<void> {
    await this.updateCoupon(couponId, { status: 'archived' });
  }

  /**
   * Auto-expire coupons (cron job)
   */
  async expireCoupons(): Promise<number> {
    const now = new Date();

    const result = await this.couponRepository.update(
      {
        valid_until: LessThan(now),
        status: 'active',
      },
      { status: 'expired' }
    );

    return result.affected || 0;
  }

  /**
   * Get coupon analytics
   */
  async getCouponAnalytics(couponId: string): Promise<{
    coupon: Coupon;
    total_usages: number;
    total_discount_given: number;
    total_revenue_generated: number;
    redemption_rate: number;
    avg_order_value: number;
    recent_usages: CouponUsage[];
  }> {
    const coupon = await this.couponRepository.findOne({
      where: { id: couponId },
    });

    if (!coupon) {
      throw new Error('Coupon not found');
    }

    // Get recent usages
    const recentUsages = await this.usageRepository.find({
      where: { coupon_id: couponId },
      order: { created_at: 'DESC' },
      take: 10,
    });

    // Calculate redemption rate
    // (For total_limit type, redemption_rate = usage_count / limit)
    let redemptionRate = 0;
    if (coupon.usage_limit_type === 'total_limit' && coupon.total_usage_limit) {
      redemptionRate = (coupon.total_usage_count / coupon.total_usage_limit) * 100;
    }

    // Calculate average order value
    const avgOrderValue =
      coupon.total_usage_count > 0
        ? coupon.total_revenue_generated_cents / coupon.total_usage_count / 100
        : 0;

    return {
      coupon,
      total_usages: coupon.total_usage_count,
      total_discount_given: coupon.total_discount_given_cents / 100,
      total_revenue_generated: coupon.total_revenue_generated_cents / 100,
      redemption_rate: Math.round(redemptionRate * 10) / 10,
      avg_order_value: Math.round(avgOrderValue * 100) / 100,
      recent_usages: recentUsages,
    };
  }

  /**
   * Get business coupon analytics summary
   */
  async getBusinessCouponStats(businessId: string): Promise<{
    total_coupons: number;
    active_coupons: number;
    total_redemptions: number;
    total_discount_given: number;
    total_revenue_generated: number;
  }> {
    const coupons = await this.couponRepository.find({
      where: { business_id: businessId },
    });

    const activeCoupons = coupons.filter((c) => c.status === 'active').length;

    const totalRedemptions = coupons.reduce((sum, c) => sum + c.total_usage_count, 0);
    const totalDiscountGiven = coupons.reduce(
      (sum, c) => sum + Number(c.total_discount_given_cents),
      0
    );
    const totalRevenueGenerated = coupons.reduce(
      (sum, c) => sum + Number(c.total_revenue_generated_cents),
      0
    );

    return {
      total_coupons: coupons.length,
      active_coupons: activeCoupons,
      total_redemptions: totalRedemptions,
      total_discount_given: totalDiscountGiven / 100,
      total_revenue_generated: totalRevenueGenerated / 100,
    };
  }

  /**
   * Create automatic promotion
   */
  async createAutomaticPromotion(
    businessId: string,
    data: {
      name: string;
      description?: string;
      type: 'free_delivery' | 'discount' | 'free_item';
      min_order_value_cents?: number;
      discount_value?: number;
      discount_type?: DiscountType;
      free_dish_id?: string;
      valid_from: Date;
      valid_until: Date;
      is_public?: boolean;
    }
  ): Promise<AutomaticPromotion> {
    const promotion = this.promotionRepository.create({
      business_id: businessId,
      name: data.name,
      description: data.description,
      type: data.type,
      min_order_value_cents: data.min_order_value_cents,
      discount_value: data.discount_value,
      discount_type: data.discount_type,
      free_dish_id: data.free_dish_id,
      valid_from: new Date(data.valid_from),
      valid_until: new Date(data.valid_until),
      is_public: data.is_public !== false,
      is_active: true,
    });

    await this.promotionRepository.save(promotion);

    return promotion;
  }

  /**
   * Get active automatic promotions
   */
  async getActivePromotions(businessId: string): Promise<AutomaticPromotion[]> {
    const now = new Date();

    return this.promotionRepository.find({
      where: {
        business_id: businessId,
        is_active: true,
      },
      order: { created_at: 'DESC' },
    });
  }

  /**
   * Check applicable automatic promotions
   */
  async checkAutomaticPromotions(
    businessId: string,
    orderValueCents: number
  ): Promise<AutomaticPromotion[]> {
    const now = new Date();

    const promotions = await this.promotionRepository.find({
      where: {
        business_id: businessId,
        is_active: true,
      },
    });

    // Filter promotions by order value and date
    const applicablePromotions = promotions.filter((promo) => {
      // Check date validity
      if (now < new Date(promo.valid_from) || now > new Date(promo.valid_until)) {
        return false;
      }

      // Check order value threshold
      if (promo.min_order_value_cents && orderValueCents < promo.min_order_value_cents) {
        return false;
      }

      return true;
    });

    return applicablePromotions;
  }

  /**
   * Update promotion
   */
  async updatePromotion(
    promotionId: string,
    data: Partial<{
      name: string;
      description: string;
      min_order_value_cents: number;
      valid_until: Date;
      is_active: boolean;
      is_public: boolean;
    }>
  ): Promise<AutomaticPromotion> {
    const promotion = await this.promotionRepository.findOne({
      where: { id: promotionId },
    });

    if (!promotion) {
      throw new Error('Promotion not found');
    }

    // Update fields
    if (data.name) promotion.name = data.name;
    if (data.description !== undefined) promotion.description = data.description;
    if (data.min_order_value_cents !== undefined)
      promotion.min_order_value_cents = data.min_order_value_cents;
    if (data.valid_until) promotion.valid_until = new Date(data.valid_until);
    if (data.is_active !== undefined) promotion.is_active = data.is_active;
    if (data.is_public !== undefined) promotion.is_public = data.is_public;

    await this.promotionRepository.save(promotion);

    return promotion;
  }
}
