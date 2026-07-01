import { Repository, Between, LessThan, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
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

  private static readonly VALID_COUPON_STATUSES = new Set<CouponStatus>([
    'active',
    'expired',
    'archived',
  ]);
  private static readonly VALID_DISCOUNT_TYPES = new Set<DiscountType>([
    'fixed',
    'percentage',
  ]);
  private static readonly VALID_USAGE_LIMIT_TYPES = new Set<UsageLimitType>([
    'per_customer',
    'per_month',
    'unlimited',
    'total_limit',
  ]);
  private static readonly VALID_APPLICABLE_TO_TYPES = new Set<ApplicableToType>([
    'all_dishes',
    'specific_dishes',
  ]);
  private static readonly VALID_PROMOTION_TYPES = new Set<AutomaticPromotion['type']>([
    'free_delivery',
    'discount',
    'free_item',
  ]);
  private static readonly COUPON_QR_PAYLOAD_KEYS = new Set([
    'type',
    'business_id',
    'code',
    'destination',
  ]);
  private static readonly MAX_COUPON_QR_PAYLOAD_LENGTH = 512;
  private static readonly COUPON_ROW_KEYS = new Set([
    'id',
    'business',
    'business_id',
    'code',
    'name',
    'description',
    'discount_type',
    'discount_value',
    'max_discount_cents',
    'min_order_value_cents',
    'valid_from',
    'valid_until',
    'usage_limit_type',
    'usage_limit_per_customer',
    'usage_limit_per_month',
    'total_usage_limit',
    'total_usage_count',
    'applicable_to',
    'dish_ids',
    'status',
    'is_public',
    'qr_code_data',
    'total_discount_given_cents',
    'total_revenue_generated_cents',
    'created_at',
    'updated_at',
  ]);
  private static readonly COUPON_USAGE_ROW_KEYS = new Set([
    'id',
    'coupon',
    'coupon_id',
    'order',
    'order_id',
    'customer',
    'customer_id',
    'business_id',
    'coupon_code',
    'discount_type',
    'discount_value',
    'discount_amount_cents',
    'order_subtotal_cents',
    'order_total_cents',
    'created_at',
  ]);
  private static readonly PROMOTION_ROW_KEYS = new Set([
    'id',
    'business',
    'business_id',
    'name',
    'description',
    'type',
    'min_order_value_cents',
    'discount_value',
    'discount_type',
    'free_dish_id',
    'valid_from',
    'valid_until',
    'is_active',
    'is_public',
    'total_applications',
    'total_discount_given_cents',
    'created_at',
    'updated_at',
  ]);

  constructor() {
    this.couponRepository = AppDataSource.getRepository(Coupon);
    this.usageRepository = AppDataSource.getRepository(CouponUsage);
    this.promotionRepository = AppDataSource.getRepository(AutomaticPromotion);
    this.orderRepository = AppDataSource.getRepository(Order);
  }

  private static assertNonNegativeSafeInteger(value: unknown, fieldName: string): number {
    const numericValue =
      typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;

    if (typeof numericValue !== 'number' || !Number.isInteger(numericValue)) {
      throw new Error(`${fieldName} must be an integer number of cents`);
    }

    if (!Number.isSafeInteger(numericValue)) {
      throw new Error(`${fieldName} must be a safe integer number of cents`);
    }

    if (numericValue < 0) {
      throw new Error(`${fieldName} must be non-negative`);
    }

    return numericValue;
  }

  private static assertNonNegativeSafeCount(value: unknown, fieldName: string): number {
    const numericValue =
      typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;

    if (typeof numericValue !== 'number' || !Number.isInteger(numericValue)) {
      throw new Error(`${fieldName} must be an integer count`);
    }

    if (!Number.isSafeInteger(numericValue)) {
      throw new Error(`${fieldName} must be a safe integer count`);
    }

    if (numericValue < 0) {
      throw new Error(`${fieldName} must be non-negative`);
    }

    return numericValue;
  }

  private static assertPositiveSafeCount(value: unknown, fieldName: string): number {
    const numericValue = CouponService.assertNonNegativeSafeCount(value, fieldName);
    if (numericValue <= 0) {
      throw new Error(`${fieldName} must be greater than zero`);
    }
    return numericValue;
  }

  private static assertValidCouponStatus(status: unknown, fieldName: string): CouponStatus {
    if (typeof status === 'string' && CouponService.hasUnsafeCouponTextControls(status)) {
      throw new Error(`${fieldName} must not include unsafe control characters`);
    }
    if (
      typeof status !== 'string' ||
      !CouponService.VALID_COUPON_STATUSES.has(status as CouponStatus)
    ) {
      throw new Error(`${fieldName} has an invalid status`);
    }

    return status as CouponStatus;
  }

  private static assertNonEmptyString(value: unknown, fieldName: string): string {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new Error(`${fieldName} must be a non-empty string`);
    }
    if (CouponService.hasUnsafeCouponTextControls(value)) {
      throw new Error(`${fieldName} must not include unsafe control characters`);
    }
    const normalizedValue = value.trim();
    if (CouponService.hasUnsafeCouponTextControls(normalizedValue)) {
      throw new Error(`${fieldName} must not include unsafe control characters`);
    }
    return normalizedValue;
  }

  private static assertSafeOptionalString(value: unknown, fieldName: string): string {
    if (typeof value !== 'string') {
      throw new Error(`${fieldName} must be a string`);
    }
    if (CouponService.hasUnsafeCouponTextControls(value)) {
      throw new Error(`${fieldName} must not include unsafe control characters`);
    }
    const normalizedValue = value.trim();
    if (CouponService.hasUnsafeCouponTextControls(normalizedValue)) {
      throw new Error(`${fieldName} must not include unsafe control characters`);
    }
    return normalizedValue;
  }

  private static hasUnsafeCouponTextControls(value: string): boolean {
    return /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/u.test(value);
  }

  private static assertValidDate(value: unknown, fieldName: string): Date {
    const date = value instanceof Date ? value : new Date(value as any);
    if (Number.isNaN(date.getTime())) {
      throw new Error(`${fieldName} must be a valid Date`);
    }
    return date;
  }

  private static assertValidDiscountType(value: unknown, fieldName: string): DiscountType {
    if (typeof value === 'string' && CouponService.hasUnsafeCouponTextControls(value)) {
      throw new Error(`${fieldName} must not include unsafe control characters`);
    }
    if (
      typeof value !== 'string' ||
      !CouponService.VALID_DISCOUNT_TYPES.has(value as DiscountType)
    ) {
      throw new Error(`${fieldName} has an invalid discount type`);
    }
    return value as DiscountType;
  }

  private static assertValidUsageLimitType(value: unknown, fieldName: string): UsageLimitType {
    if (typeof value === 'string' && CouponService.hasUnsafeCouponTextControls(value)) {
      throw new Error(`${fieldName} must not include unsafe control characters`);
    }
    if (
      typeof value !== 'string' ||
      !CouponService.VALID_USAGE_LIMIT_TYPES.has(value as UsageLimitType)
    ) {
      throw new Error(`${fieldName} has an invalid usage limit type`);
    }
    return value as UsageLimitType;
  }

  private static assertValidApplicableToType(value: unknown, fieldName: string): ApplicableToType {
    if (typeof value === 'string' && CouponService.hasUnsafeCouponTextControls(value)) {
      throw new Error(`${fieldName} must not include unsafe control characters`);
    }
    if (
      typeof value !== 'string' ||
      !CouponService.VALID_APPLICABLE_TO_TYPES.has(value as ApplicableToType)
    ) {
      throw new Error(`${fieldName} has an invalid applicable-to type`);
    }
    return value as ApplicableToType;
  }

  private static assertValidPromotionType(
    value: unknown,
    fieldName: string
  ): AutomaticPromotion['type'] {
    if (typeof value === 'string' && CouponService.hasUnsafeCouponTextControls(value)) {
      throw new Error(`${fieldName} must not include unsafe control characters`);
    }
    if (
      typeof value !== 'string' ||
      !CouponService.VALID_PROMOTION_TYPES.has(value as AutomaticPromotion['type'])
    ) {
      throw new Error(`${fieldName} has an invalid promotion type`);
    }
    return value as AutomaticPromotion['type'];
  }

  private static assertCouponRowIntegrity(
    coupon: Coupon,
    label: string,
    expected?: { businessId?: string; couponId?: string }
  ): void {
    const unsafeKeys = Object.keys(coupon).filter((key) => CouponService.hasUnsafeCouponTextControls(key));
    if (unsafeKeys.length > 0) {
      throw new Error(`${label} field names contain unsafe control characters`);
    }

    const unsupportedKeys = Object.keys(coupon).filter((key) => !CouponService.COUPON_ROW_KEYS.has(key));
    if (unsupportedKeys.length > 0) {
      throw new Error(`${label} include unsupported field(s): ${unsupportedKeys.sort().join(', ')}`);
    }

    if (coupon.id !== undefined) {
      const couponId = CouponService.assertNonEmptyString(coupon.id, `${label} id`);
      if (expected?.couponId && couponId !== expected.couponId) {
        throw new Error(`${label} id must match requested coupon`);
      }
    }

    if (coupon.business_id !== undefined) {
      const businessId = CouponService.assertNonEmptyString(coupon.business_id, `${label} business_id`);
      if (expected?.businessId && businessId !== expected.businessId) {
        throw new Error(`${label} business_id must match requested business`);
      }
    }

    if (coupon.code !== undefined) {
      CouponService.assertNonEmptyString(coupon.code, `${label} code`);
    }
    if (coupon.name !== undefined) {
      CouponService.assertNonEmptyString(coupon.name, `${label} name`);
    }
    if (coupon.description !== undefined && coupon.description !== null) {
      CouponService.assertSafeOptionalString(coupon.description, `${label} description`);
    }
    if (coupon.qr_code_data !== undefined && coupon.qr_code_data !== null) {
      CouponService.assertCouponQrPayload(coupon.qr_code_data, {
        businessId: coupon.business_id,
        code: coupon.code,
      });
    }

    if (coupon.status !== undefined) {
      CouponService.assertValidCouponStatus(coupon.status, `${label} status`);
    }
    if (coupon.discount_type !== undefined) {
      CouponService.assertValidDiscountType(coupon.discount_type, `${label} discount_type`);
    }
    if (coupon.discount_value !== undefined) {
      CouponService.assertNonNegativeSafeInteger(coupon.discount_value, `${label} discount_value`);
    }
    if (coupon.max_discount_cents !== undefined && coupon.max_discount_cents !== null) {
      CouponService.assertNonNegativeSafeInteger(coupon.max_discount_cents, `${label} max_discount_cents`);
    }
    if (coupon.min_order_value_cents !== undefined) {
      CouponService.assertNonNegativeSafeInteger(coupon.min_order_value_cents, `${label} min_order_value_cents`);
    }
    if (coupon.usage_limit_type !== undefined) {
      CouponService.assertValidUsageLimitType(coupon.usage_limit_type, `${label} usage_limit_type`);
    }
    if (coupon.usage_limit_per_customer !== undefined && coupon.usage_limit_per_customer !== null) {
      CouponService.assertNonNegativeSafeCount(coupon.usage_limit_per_customer, `${label} usage_limit_per_customer`);
    }
    if (coupon.usage_limit_per_month !== undefined && coupon.usage_limit_per_month !== null) {
      CouponService.assertNonNegativeSafeCount(coupon.usage_limit_per_month, `${label} usage_limit_per_month`);
    }
    if (coupon.total_usage_limit !== undefined && coupon.total_usage_limit !== null) {
      CouponService.assertNonNegativeSafeCount(coupon.total_usage_limit, `${label} total_usage_limit`);
    }
    if (coupon.total_usage_count !== undefined) {
      CouponService.assertNonNegativeSafeCount(coupon.total_usage_count, `${label} total_usage_count`);
    }
    if (coupon.usage_limit_type === 'total_limit') {
      CouponService.assertPositiveSafeCount(coupon.total_usage_limit, `${label} total_usage_limit`);
    }
    if (coupon.usage_limit_type === 'per_customer') {
      CouponService.assertPositiveSafeCount(
        coupon.usage_limit_per_customer,
        `${label} usage_limit_per_customer`
      );
    }
    if (coupon.usage_limit_type === 'per_month') {
      CouponService.assertPositiveSafeCount(coupon.usage_limit_per_month, `${label} usage_limit_per_month`);
    }
    if (coupon.total_discount_given_cents !== undefined) {
      CouponService.assertNonNegativeSafeInteger(
        coupon.total_discount_given_cents,
        `${label} total_discount_given_cents`
      );
    }
    if (coupon.total_revenue_generated_cents !== undefined) {
      CouponService.assertNonNegativeSafeInteger(
        coupon.total_revenue_generated_cents,
        `${label} total_revenue_generated_cents`
      );
    }
    if (coupon.applicable_to !== undefined) {
      CouponService.assertValidApplicableToType(coupon.applicable_to, `${label} applicable_to`);
    }
    if (coupon.dish_ids !== undefined && !Array.isArray(coupon.dish_ids)) {
      throw new Error(`${label} dish_ids must be an array`);
    }
    if (coupon.is_public !== undefined && typeof coupon.is_public !== 'boolean') {
      throw new Error(`${label} is_public must be a boolean`);
    }

    const hasValidFrom = coupon.valid_from !== undefined && coupon.valid_from !== null;
    const hasValidUntil = coupon.valid_until !== undefined && coupon.valid_until !== null;
    if (hasValidFrom || hasValidUntil) {
      if (!hasValidFrom || !hasValidUntil) {
        throw new Error(`${label} validity period must include both valid_from and valid_until`);
      }
      const validFrom = CouponService.assertValidDate(coupon.valid_from, `${label} valid_from`);
      const validUntil = CouponService.assertValidDate(coupon.valid_until, `${label} valid_until`);
      if (validFrom >= validUntil) {
        throw new Error(`${label} valid_from must be before valid_until`);
      }
    }
  }

  private static assertCouponUsageRowIntegrity(
    usage: CouponUsage,
    label: string,
    expected: {
      couponId: string;
      businessId?: string;
      couponCode?: string;
      discountType?: DiscountType;
      discountValue?: number;
    }
  ): void {
    const unsafeKeys = Object.keys(usage).filter((key) => CouponService.hasUnsafeCouponTextControls(key));
    if (unsafeKeys.length > 0) {
      throw new Error(`${label} field names contain unsafe control characters`);
    }

    const unsupportedKeys = Object.keys(usage).filter(
      (key) => !CouponService.COUPON_USAGE_ROW_KEYS.has(key)
    );
    if (unsupportedKeys.length > 0) {
      throw new Error(`${label} include unsupported field(s): ${unsupportedKeys.sort().join(', ')}`);
    }

    CouponService.assertNonEmptyString(usage.id, `${label} id`);

    const couponId = CouponService.assertNonEmptyString(usage.coupon_id, `${label} coupon_id`);
    if (couponId !== expected.couponId) {
      throw new Error(`${label} coupon_id must match requested coupon`);
    }

    const businessId = CouponService.assertNonEmptyString(usage.business_id, `${label} business_id`);
    if (expected.businessId && businessId !== expected.businessId) {
      throw new Error(`${label} business_id must match coupon business`);
    }

    CouponService.assertNonEmptyString(usage.order_id, `${label} order_id`);
    CouponService.assertNonEmptyString(usage.customer_id, `${label} customer_id`);

    const couponCode = CouponService.assertNonEmptyString(usage.coupon_code, `${label} coupon_code`);
    if (expected.couponCode && couponCode !== expected.couponCode) {
      throw new Error(`${label} coupon_code must match coupon code`);
    }

    const discountType = CouponService.assertValidDiscountType(
      usage.discount_type,
      `${label} discount_type`
    );
    if (expected.discountType && discountType !== expected.discountType) {
      throw new Error(`${label} discount_type must match coupon discount_type`);
    }

    const discountValue = CouponService.assertNonNegativeSafeInteger(
      usage.discount_value,
      `${label} discount_value`
    );
    if (expected.discountValue !== undefined && discountValue !== expected.discountValue) {
      throw new Error(`${label} discount_value must match coupon discount_value`);
    }

    const discountAmountCents = CouponService.assertNonNegativeSafeInteger(
      usage.discount_amount_cents,
      `${label} discount_amount_cents`
    );
    const orderSubtotalCents = CouponService.assertNonNegativeSafeInteger(
      usage.order_subtotal_cents,
      `${label} order_subtotal_cents`
    );
    const orderTotalCents = CouponService.assertNonNegativeSafeInteger(
      usage.order_total_cents,
      `${label} order_total_cents`
    );
    if (discountAmountCents > orderSubtotalCents) {
      throw new Error(`${label} discount_amount_cents must not exceed order_subtotal_cents`);
    }
    if (orderSubtotalCents - discountAmountCents !== orderTotalCents) {
      throw new Error(`${label} order_total_cents must equal subtotal minus discount`);
    }

    CouponService.assertValidDate(usage.created_at, `${label} created_at`);
  }

  private static assertPromotionRowIntegrity(
    promotion: AutomaticPromotion,
    label: string,
    expected?: { businessId?: string; promotionId?: string }
  ): void {
    const unsafeKeys = Object.keys(promotion).filter((key) => CouponService.hasUnsafeCouponTextControls(key));
    if (unsafeKeys.length > 0) {
      throw new Error(`${label} field names contain unsafe control characters`);
    }

    const unsupportedKeys = Object.keys(promotion).filter(
      (key) => !CouponService.PROMOTION_ROW_KEYS.has(key)
    );
    if (unsupportedKeys.length > 0) {
      throw new Error(`${label} include unsupported field(s): ${unsupportedKeys.sort().join(', ')}`);
    }

    if (promotion.id !== undefined) {
      const promotionId = CouponService.assertNonEmptyString(promotion.id, `${label} id`);
      if (expected?.promotionId && promotionId !== expected.promotionId) {
        throw new Error(`${label} id must match requested promotion`);
      }
    }

    if (promotion.business_id !== undefined) {
      const businessId = CouponService.assertNonEmptyString(
        promotion.business_id,
        `${label} business_id`
      );
      if (expected?.businessId && businessId !== expected.businessId) {
        throw new Error(`${label} business_id must match requested business`);
      }
    }

    if (promotion.name !== undefined) {
      CouponService.assertNonEmptyString(promotion.name, `${label} name`);
    }
    if (promotion.description !== undefined && promotion.description !== null) {
      CouponService.assertSafeOptionalString(promotion.description, `${label} description`);
    }
    if (promotion.free_dish_id !== undefined && promotion.free_dish_id !== null) {
      CouponService.assertNonEmptyString(promotion.free_dish_id, `${label} free_dish_id`);
    }

    if (promotion.type !== undefined) {
      CouponService.assertValidPromotionType(promotion.type, `${label} type`);
    }
    if (promotion.min_order_value_cents !== undefined && promotion.min_order_value_cents !== null) {
      CouponService.assertNonNegativeSafeInteger(
        promotion.min_order_value_cents,
        `${label} min_order_value_cents`
      );
    }
    if (promotion.discount_value !== undefined && promotion.discount_value !== null) {
      CouponService.assertNonNegativeSafeInteger(
        promotion.discount_value,
        `${label} discount_value`
      );
    }
    if (promotion.discount_type !== undefined && promotion.discount_type !== null) {
      CouponService.assertValidDiscountType(promotion.discount_type, `${label} discount_type`);
    }
    if (promotion.is_active !== undefined && typeof promotion.is_active !== 'boolean') {
      throw new Error(`${label} is_active must be a boolean`);
    }
    if (promotion.is_public !== undefined && typeof promotion.is_public !== 'boolean') {
      throw new Error(`${label} is_public must be a boolean`);
    }
    if (promotion.total_applications !== undefined) {
      CouponService.assertNonNegativeSafeCount(
        promotion.total_applications,
        `${label} total_applications`
      );
    }
    if (promotion.total_discount_given_cents !== undefined) {
      CouponService.assertNonNegativeSafeInteger(
        promotion.total_discount_given_cents,
        `${label} total_discount_given_cents`
      );
    }

    const hasValidFrom = promotion.valid_from !== undefined && promotion.valid_from !== null;
    const hasValidUntil = promotion.valid_until !== undefined && promotion.valid_until !== null;
    if (hasValidFrom || hasValidUntil) {
      if (!hasValidFrom || !hasValidUntil) {
        throw new Error(`${label} validity period must include both valid_from and valid_until`);
      }
      const validFrom = CouponService.assertValidDate(promotion.valid_from, `${label} valid_from`);
      const validUntil = CouponService.assertValidDate(promotion.valid_until, `${label} valid_until`);
      if (validFrom >= validUntil) {
        throw new Error(`${label} valid_from must be before valid_until`);
      }
    }
  }

  private static buildCouponQrPayload(coupon: Coupon): string {
    const businessId = CouponService.assertNonEmptyString(
      coupon.business_id,
      'Coupon QR business_id'
    );
    const code = CouponService.assertNonEmptyString(coupon.code, 'Coupon QR code');

    return Buffer.from(
      JSON.stringify({
        type: 'coupon_redemption',
        business_id: businessId,
        code,
        destination: `https://menumaker.app/coupon/${encodeURIComponent(code)}`,
      })
    ).toString('base64url');
  }

  private static assertCouponQrPayload(
    encodedPayload: unknown,
    expected: { businessId?: unknown; code?: unknown }
  ): void {
    const normalizedPayload = CouponService.assertNonEmptyString(
      encodedPayload,
      'Coupon QR payload'
    );
    if (normalizedPayload.length > CouponService.MAX_COUPON_QR_PAYLOAD_LENGTH) {
      throw new Error(
        `Coupon QR payload must be at most ${CouponService.MAX_COUPON_QR_PAYLOAD_LENGTH} characters`
      );
    }

    let decoded: unknown;
    try {
      decoded = JSON.parse(Buffer.from(normalizedPayload, 'base64url').toString('utf8'));
    } catch {
      throw new Error('Coupon QR payload must be valid base64url JSON');
    }

    if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded)) {
      throw new Error('Coupon QR payload must be an object');
    }

    const payload = decoded as Record<string, unknown>;
    const payloadKeys = Object.keys(payload);
    const unsafeKeys = payloadKeys.filter((key) => CouponService.hasUnsafeCouponTextControls(key));
    if (unsafeKeys.length > 0) {
      throw new Error('Coupon QR payload field names contain unsafe control characters');
    }

    const unsupportedKeys = payloadKeys.filter(
      (key) => !CouponService.COUPON_QR_PAYLOAD_KEYS.has(key)
    );
    if (unsupportedKeys.length > 0) {
      throw new Error(
        `Coupon QR payload include unsupported field(s): ${unsupportedKeys.sort().join(', ')}`
      );
    }

    const payloadType = CouponService.assertNonEmptyString(
      payload.type,
      'Coupon QR payload type'
    );
    if (payloadType !== 'coupon_redemption') {
      throw new Error('Coupon QR payload type must be coupon_redemption');
    }

    const payloadBusinessId = CouponService.assertNonEmptyString(
      payload.business_id,
      'Coupon QR payload business_id'
    );
    const expectedBusinessId = CouponService.assertNonEmptyString(
      expected.businessId,
      'Coupon QR expected business_id'
    );
    if (payloadBusinessId !== expectedBusinessId) {
      throw new Error('Coupon QR payload business_id must match coupon business_id');
    }

    const payloadCode = CouponService.assertNonEmptyString(payload.code, 'Coupon QR payload code');
    const expectedCode = CouponService.assertNonEmptyString(
      expected.code,
      'Coupon QR expected code'
    );
    if (payloadCode !== expectedCode) {
      throw new Error('Coupon QR payload code must match coupon code');
    }

    const payloadDestination = CouponService.assertNonEmptyString(
      payload.destination,
      'Coupon QR payload destination'
    );
    const expectedDestination = `https://menumaker.app/coupon/${encodeURIComponent(expectedCode)}`;
    if (payloadDestination !== expectedDestination) {
      throw new Error('Coupon QR payload destination must match coupon code');
    }
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
    const normalizedBusinessId = CouponService.assertNonEmptyString(
      businessId,
      'Coupon business_id'
    );
    const normalizedCode = CouponService.assertNonEmptyString(data.code, 'Coupon code').toUpperCase();
    const normalizedName = CouponService.assertNonEmptyString(data.name, 'Coupon name');
    const normalizedDescription =
      data.description === undefined || data.description === null
        ? data.description
        : CouponService.assertSafeOptionalString(data.description, 'Coupon description');

    // Validate coupon code uniqueness
    const existing = await this.couponRepository.findOne({
      where: { code: normalizedCode },
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
      business_id: normalizedBusinessId,
      code: normalizedCode,
      name: normalizedName,
      description: normalizedDescription,
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

    CouponService.assertCouponRowIntegrity(coupon, `Coupon ${normalizedCode}`, {
      businessId: normalizedBusinessId,
    });
    await this.couponRepository.save(coupon);

    coupon.qr_code_data = CouponService.buildCouponQrPayload(coupon);
    CouponService.assertCouponRowIntegrity(coupon, `Coupon ${normalizedCode}`, {
      businessId: normalizedBusinessId,
    });
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
    const normalizedCouponCode = CouponService.assertNonEmptyString(
      couponCode,
      'Coupon code'
    ).toUpperCase();
    const normalizedCustomerId = CouponService.assertNonEmptyString(
      customerId,
      'Coupon customer_id'
    );
    const normalizedBusinessId = CouponService.assertNonEmptyString(
      businessId,
      'Coupon business_id'
    );

    // Find coupon
    const coupon = await this.couponRepository.findOne({
      where: {
        code: normalizedCouponCode,
        business_id: normalizedBusinessId,
      },
    });

    if (!coupon) {
      return { valid: false, error: 'Coupon not found' };
    }
    CouponService.assertCouponRowIntegrity(coupon, `Coupon ${coupon.id || normalizedCouponCode}`, {
      businessId: normalizedBusinessId,
    });

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
    const usageCheckResult = await this.checkUsageLimits(coupon, normalizedCustomerId);
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
      const totalUsageCount = CouponService.assertNonNegativeSafeCount(
        coupon.total_usage_count,
        'Coupon total_usage_count'
      );
      const totalUsageLimit = CouponService.assertNonNegativeSafeCount(
        coupon.total_usage_limit || 0,
        'Coupon total_usage_limit'
      );

      if (totalUsageCount >= totalUsageLimit) {
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
    const normalizedOrderId = CouponService.assertNonEmptyString(orderId, 'Order id');
    const normalizedCouponId = CouponService.assertNonEmptyString(couponId, 'Coupon id');
    const normalizedCustomerId = CouponService.assertNonEmptyString(customerId, 'Coupon customer_id');
    const normalizedBusinessId = CouponService.assertNonEmptyString(businessId, 'Coupon business_id');
    const validatedOrderSubtotalCents = CouponService.assertNonNegativeSafeInteger(
      orderSubtotalCents,
      'Order subtotal cents'
    );
    const validatedDiscountAmountCents = CouponService.assertNonNegativeSafeInteger(
      discountAmountCents,
      'Discount amount cents'
    );

    if (validatedDiscountAmountCents > validatedOrderSubtotalCents) {
      throw new Error('Discount amount cents cannot exceed order subtotal cents');
    }

    const coupon = await this.couponRepository.findOne({
      where: { id: normalizedCouponId },
    });

    if (!coupon) {
      throw new Error('Coupon not found');
    }
    CouponService.assertCouponRowIntegrity(coupon, `Coupon ${coupon.id || couponId}`, {
      businessId: normalizedBusinessId,
      couponId: normalizedCouponId,
    });

    const totalUsageCount = CouponService.assertNonNegativeSafeCount(
      coupon.total_usage_count,
      'Coupon total_usage_count'
    );
    const totalDiscountGivenCents = CouponService.assertNonNegativeSafeInteger(
      coupon.total_discount_given_cents,
      'Coupon total_discount_given_cents'
    );
    const totalRevenueGeneratedCents = CouponService.assertNonNegativeSafeInteger(
      coupon.total_revenue_generated_cents,
      'Coupon total_revenue_generated_cents'
    );

    const existingUsage = await this.usageRepository.findOne({
      where: {
        coupon_id: normalizedCouponId,
        order_id: normalizedOrderId,
        business_id: normalizedBusinessId,
      },
    });
    if (existingUsage) {
      throw new Error('Coupon usage for this order has already been recorded');
    }

    // Create usage record
    const usage = this.usageRepository.create({
      coupon_id: normalizedCouponId,
      order_id: normalizedOrderId,
      customer_id: normalizedCustomerId,
      business_id: normalizedBusinessId,
      coupon_code: coupon.code,
      discount_type: coupon.discount_type,
      discount_value: coupon.discount_value,
      discount_amount_cents: validatedDiscountAmountCents,
      order_subtotal_cents: validatedOrderSubtotalCents,
      order_total_cents: validatedOrderSubtotalCents - validatedDiscountAmountCents,
    });

    await this.usageRepository.save(usage);

    // Update coupon analytics
    coupon.total_usage_count = totalUsageCount + 1;
    coupon.total_discount_given_cents =
      totalDiscountGivenCents + validatedDiscountAmountCents;
    coupon.total_revenue_generated_cents =
      totalRevenueGeneratedCents + validatedOrderSubtotalCents - validatedDiscountAmountCents;

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
    const normalizedBusinessId = CouponService.assertNonEmptyString(
      businessId,
      'Coupon business_id'
    );
    const where: any = { business_id: normalizedBusinessId };

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.is_public !== undefined) {
      where.is_public = filters.is_public;
    }

    const coupons = await this.couponRepository.find({
      where,
      order: { created_at: 'DESC' },
    });
    coupons.forEach((coupon, index) =>
      CouponService.assertCouponRowIntegrity(coupon, `Coupon row ${index + 1}`, {
        businessId: normalizedBusinessId,
      })
    );
    return coupons;
  }

  /**
   * Get public coupons (for menu display)
   */
  async getPublicCoupons(businessId: string): Promise<Coupon[]> {
    const normalizedBusinessId = CouponService.assertNonEmptyString(
      businessId,
      'Coupon business_id'
    );
    const now = new Date();

    const coupons = await this.couponRepository.find({
      where: {
        business_id: normalizedBusinessId,
        is_public: true,
        status: 'active',
        valid_from: LessThanOrEqual(now),
        valid_until: MoreThanOrEqual(now),
      },
      order: { created_at: 'DESC' },
    });
    coupons.forEach((coupon, index) =>
      CouponService.assertCouponRowIntegrity(coupon, `Public coupon row ${index + 1}`, {
        businessId: normalizedBusinessId,
      })
    );
    return coupons;
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
    const normalizedCouponId = CouponService.assertNonEmptyString(couponId, 'Coupon id');
    const coupon = await this.couponRepository.findOne({
      where: { id: normalizedCouponId },
    });

    if (!coupon) {
      throw new Error('Coupon not found');
    }
    CouponService.assertCouponRowIntegrity(coupon, `Coupon ${coupon.id || normalizedCouponId}`, {
      couponId: normalizedCouponId,
    });

    // Update fields
    if (data.name !== undefined)
      coupon.name = CouponService.assertNonEmptyString(data.name, 'Coupon name');
    if (data.description !== undefined)
      coupon.description =
        data.description === null
          ? data.description
          : CouponService.assertSafeOptionalString(data.description, 'Coupon description');
    if (data.min_order_value_cents !== undefined)
      coupon.min_order_value_cents = CouponService.assertNonNegativeSafeInteger(
        data.min_order_value_cents,
        'Coupon min_order_value_cents'
      );
    if (data.valid_until) coupon.valid_until = CouponService.assertValidDate(data.valid_until, 'Coupon valid_until');
    if (data.is_public !== undefined) coupon.is_public = data.is_public;
    if (data.status) coupon.status = CouponService.assertValidCouponStatus(data.status, 'Coupon status');

    CouponService.assertCouponRowIntegrity(coupon, `Coupon ${coupon.id || normalizedCouponId}`, {
      couponId: normalizedCouponId,
    });

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
    const normalizedCouponId = CouponService.assertNonEmptyString(couponId, 'Coupon id');
    const coupon = await this.couponRepository.findOne({
      where: { id: normalizedCouponId },
    });

    if (!coupon) {
      throw new Error('Coupon not found');
    }
    CouponService.assertCouponRowIntegrity(coupon, `Coupon ${coupon.id || normalizedCouponId}`, {
      couponId: normalizedCouponId,
    });

    // Calculate redemption rate
    // (For total_limit type, redemption_rate = usage_count / limit)
    const totalUsageCount = CouponService.assertNonNegativeSafeCount(
      coupon.total_usage_count,
      'Coupon total_usage_count'
    );
    const totalDiscountGivenCents = CouponService.assertNonNegativeSafeInteger(
      coupon.total_discount_given_cents,
      'Coupon total_discount_given_cents'
    );
    const totalRevenueGeneratedCents = CouponService.assertNonNegativeSafeInteger(
      coupon.total_revenue_generated_cents,
      'Coupon total_revenue_generated_cents'
    );

    let redemptionRate = 0;
    if (coupon.usage_limit_type === 'total_limit' && coupon.total_usage_limit) {
      const totalUsageLimit = CouponService.assertNonNegativeSafeCount(
        coupon.total_usage_limit,
        'Coupon total_usage_limit'
      );

      redemptionRate = (totalUsageCount / totalUsageLimit) * 100;
    }

    // Get recent usages only after persisted analytics counters are validated.
    const recentUsages = await this.usageRepository.find({
      where: { coupon_id: normalizedCouponId },
      order: { created_at: 'DESC' },
      take: 10,
    });
    const recentUsageOrderIds = new Set<string>();
    recentUsages.forEach((usage, index) => {
      CouponService.assertCouponUsageRowIntegrity(usage, `Coupon usage row ${index + 1}`, {
        couponId: normalizedCouponId,
        businessId: coupon.business_id,
        couponCode: coupon.code,
        discountType: coupon.discount_type,
        discountValue: coupon.discount_value,
      });
      const orderId = CouponService.assertNonEmptyString(
        usage.order_id,
        `Coupon usage row ${index + 1} order_id`
      );
      if (recentUsageOrderIds.has(orderId)) {
        throw new Error(`Coupon usage row ${index + 1} order_id duplicates an earlier recent usage`);
      }
      recentUsageOrderIds.add(orderId);
    });

    // Calculate average order value
    const avgOrderValue =
      totalUsageCount > 0
        ? totalRevenueGeneratedCents / totalUsageCount / 100
        : 0;

    return {
      coupon,
      total_usages: totalUsageCount,
      total_discount_given: totalDiscountGivenCents / 100,
      total_revenue_generated: totalRevenueGeneratedCents / 100,
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
    const normalizedBusinessId = CouponService.assertNonEmptyString(
      businessId,
      'Coupon business_id'
    );
    const coupons = await this.couponRepository.find({
      where: { business_id: normalizedBusinessId },
    });

    coupons.forEach((coupon, index) =>
      CouponService.assertCouponRowIntegrity(coupon, `Coupon row ${index + 1}`, {
        businessId: normalizedBusinessId,
      })
    );

    const activeCoupons = coupons.filter((c, index) => {
      const status = CouponService.assertValidCouponStatus(
        c.status,
        `Coupon row ${index + 1}`
      );

      return status === 'active';
    }).length;

    const totalRedemptions = coupons.reduce(
      (sum, c, index) =>
        sum +
        CouponService.assertNonNegativeSafeCount(
          c.total_usage_count,
          `Coupon row ${index + 1} total_usage_count`
        ),
      0
    );
    const totalDiscountGiven = coupons.reduce(
      (sum, c, index) =>
        sum +
        CouponService.assertNonNegativeSafeInteger(
          c.total_discount_given_cents,
          `Coupon row ${index + 1} total_discount_given_cents`
        ),
      0
    );
    const totalRevenueGenerated = coupons.reduce(
      (sum, c, index) =>
        sum +
        CouponService.assertNonNegativeSafeInteger(
          c.total_revenue_generated_cents,
          `Coupon row ${index + 1} total_revenue_generated_cents`
        ),
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
    const normalizedBusinessId = CouponService.assertNonEmptyString(
      businessId,
      'Promotion business_id'
    );
    const normalizedName = CouponService.assertNonEmptyString(data.name, 'Promotion name');
    const normalizedDescription =
      data.description === undefined || data.description === null
        ? data.description
        : CouponService.assertSafeOptionalString(data.description, 'Promotion description');
    const normalizedFreeDishId =
      data.free_dish_id === undefined || data.free_dish_id === null
        ? data.free_dish_id
        : CouponService.assertNonEmptyString(data.free_dish_id, 'Promotion free_dish_id');
    const normalizedType = CouponService.assertValidPromotionType(data.type, 'Promotion type');
    const validFrom = CouponService.assertValidDate(data.valid_from, 'Promotion valid_from');
    const validUntil = CouponService.assertValidDate(data.valid_until, 'Promotion valid_until');
    if (validFrom >= validUntil) {
      throw new Error('Promotion valid_from must be before valid_until');
    }

    const promotion = this.promotionRepository.create({
      business_id: normalizedBusinessId,
      name: normalizedName,
      description: normalizedDescription,
      type: normalizedType,
      min_order_value_cents:
        data.min_order_value_cents === undefined
          ? data.min_order_value_cents
          : CouponService.assertNonNegativeSafeInteger(
              data.min_order_value_cents,
              'Promotion min_order_value_cents'
            ),
      discount_value:
        data.discount_value === undefined
          ? data.discount_value
          : CouponService.assertNonNegativeSafeInteger(
              data.discount_value,
              'Promotion discount_value'
            ),
      discount_type:
        data.discount_type === undefined
          ? data.discount_type
          : CouponService.assertValidDiscountType(data.discount_type, 'Promotion discount_type'),
      free_dish_id: normalizedFreeDishId,
      valid_from: validFrom,
      valid_until: validUntil,
      is_public: data.is_public !== false,
      is_active: true,
    });

    CouponService.assertPromotionRowIntegrity(promotion, `Promotion ${normalizedName}`, {
      businessId: normalizedBusinessId,
    });
    await this.promotionRepository.save(promotion);

    return promotion;
  }

  /**
   * Get active automatic promotions
   */
  async getActivePromotions(businessId: string): Promise<AutomaticPromotion[]> {
    const normalizedBusinessId = CouponService.assertNonEmptyString(
      businessId,
      'Promotion business_id'
    );
    const now = new Date();

    const promotions = await this.promotionRepository.find({
      where: {
        business_id: normalizedBusinessId,
        is_active: true,
        valid_from: LessThanOrEqual(now),
        valid_until: MoreThanOrEqual(now),
      },
      order: { created_at: 'DESC' },
    });
    promotions.forEach((promotion, index) =>
      CouponService.assertPromotionRowIntegrity(promotion, `Promotion row ${index + 1}`, {
        businessId: normalizedBusinessId,
      })
    );
    return promotions;
  }

  /**
   * Check applicable automatic promotions
   */
  async checkAutomaticPromotions(
    businessId: string,
    orderValueCents: number
  ): Promise<AutomaticPromotion[]> {
    const normalizedBusinessId = CouponService.assertNonEmptyString(
      businessId,
      'Promotion business_id'
    );
    const validatedOrderValueCents = CouponService.assertNonNegativeSafeInteger(
      orderValueCents,
      'Promotion order value cents'
    );
    const now = new Date();

    const promotions = await this.promotionRepository.find({
      where: {
        business_id: normalizedBusinessId,
        is_active: true,
      },
    });
    promotions.forEach((promotion, index) =>
      CouponService.assertPromotionRowIntegrity(promotion, `Promotion row ${index + 1}`, {
        businessId: normalizedBusinessId,
      })
    );

    // Filter promotions by order value and date
    const applicablePromotions = promotions.filter((promo) => {
      // Check date validity
      if (now < new Date(promo.valid_from) || now > new Date(promo.valid_until)) {
        return false;
      }

      // Check order value threshold
      if (promo.min_order_value_cents && validatedOrderValueCents < promo.min_order_value_cents) {
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
    const normalizedPromotionId = CouponService.assertNonEmptyString(
      promotionId,
      'Promotion id'
    );
    const promotion = await this.promotionRepository.findOne({
      where: { id: normalizedPromotionId },
    });

    if (!promotion) {
      throw new Error('Promotion not found');
    }
    CouponService.assertPromotionRowIntegrity(
      promotion,
      `Promotion ${promotion.id || normalizedPromotionId}`,
      { promotionId: normalizedPromotionId }
    );

    // Update fields
    if (data.name !== undefined)
      promotion.name = CouponService.assertNonEmptyString(data.name, 'Promotion name');
    if (data.description !== undefined)
      promotion.description =
        data.description === null
          ? data.description
          : CouponService.assertSafeOptionalString(data.description, 'Promotion description');
    if (data.min_order_value_cents !== undefined)
      promotion.min_order_value_cents = CouponService.assertNonNegativeSafeInteger(
        data.min_order_value_cents,
        'Promotion min_order_value_cents'
      );
    if (data.valid_until)
      promotion.valid_until = CouponService.assertValidDate(
        data.valid_until,
        'Promotion valid_until'
      );
    if (data.is_active !== undefined) promotion.is_active = data.is_active;
    if (data.is_public !== undefined) promotion.is_public = data.is_public;

    CouponService.assertPromotionRowIntegrity(
      promotion,
      `Promotion ${promotion.id || normalizedPromotionId}`,
      { promotionId: normalizedPromotionId }
    );
    await this.promotionRepository.save(promotion);

    return promotion;
  }
}
