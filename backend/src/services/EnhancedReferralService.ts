import { createHash } from 'crypto';
import { isIP } from 'net';
import { Repository, MoreThan } from 'typeorm';
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
import { Coupon } from '../models/Coupon.js';
import { Order } from '../models/Order.js';
import { CouponService } from './CouponService.js';
import { NotificationOutbox, NotificationOutboxService } from '../models/NotificationOutbox.js';
import { assertCapabilityEnabled } from '../config/capabilities.js';

export interface ReferralRewardLedgerEntry {
  id: string;
  referral_id: string;
  user_id: string;
  role: 'referrer' | 'referee';
  credit_cents: number;
  coupon_code: string;
  created_at: string;
}

export interface ReferralRewardClaimResult {
  status: 'claimed' | 'already_claimed';
  ledger_entries: ReferralRewardLedgerEntry[];
  coupons: Coupon[];
  notifications: NotificationOutbox[];
}

interface ReferralRewardDependencies {
  couponService?: Pick<CouponService, 'createCoupon'>;
  outboxRepository?: {
    findOne?: (options: unknown) => Promise<NotificationOutbox | null>;
    save: (record: NotificationOutbox) => Promise<NotificationOutbox>;
  };
  now?: () => Date;
}

type RewardNotificationIntent = Parameters<typeof NotificationOutboxService.buildIntent>[0];

interface AffiliateRepositoryOverrides {
  affiliateRepository?: Repository<Affiliate>;
  clickRepository?: Repository<AffiliateClick>;
  payoutRepository?: Repository<AffiliatePayout>;
  userRepository?: Repository<User>;
  enforceCapability?: boolean;
}

interface LeaderboardRepositoryOverrides {
  leaderboardRepository?: Repository<ReferralLeaderboard>;
  referralRepository?: Repository<Referral>;
  userRepository?: Repository<User>;
  now?: () => Date;
  enforceCapability?: boolean;
}

interface ViralServiceOptions {
  enforceCapability?: boolean;
  orderRepository?: Repository<Order>;
}

const VALID_CUSTOMER_REFERRAL_STATUSES = new Set(['link_clicked', 'order_placed', 'reward_claimed']);
const VALID_AFFILIATE_STATUSES = new Set(['pending', 'approved', 'rejected', 'suspended']);
const VALID_AFFILIATE_PAYOUT_STATUSES = new Set(['pending', 'processing', 'paid', 'failed']);
const REFERRAL_LEADERBOARD_ROW_KEYS = new Set([
  'id',
  'user',
  'user_id',
  'month',
  'successful_referrals',
  'rank',
  'prize_amount_cents',
  'prize_paid',
  'prize_paid_at',
  'created_at',
  'updated_at',
]);
const AFFILIATE_ROW_KEYS = new Set([
  'id',
  'user',
  'user_id',
  'affiliate_code',
  'status',
  'affiliate_type',
  'application_message',
  'instagram_handle',
  'instagram_followers',
  'youtube_channel',
  'youtube_subscribers',
  'seller_commission_rate',
  'customer_commission_rate',
  'seller_commission_months',
  'customer_commission_months',
  'min_payout_cents',
  'payout_method',
  'payout_details',
  'total_clicks',
  'total_signups',
  'total_conversions',
  'total_gmv_cents',
  'total_commission_earned_cents',
  'total_commission_paid_cents',
  'pending_commission_cents',
  'approved_by_id',
  'approved_at',
  'rejection_reason',
  'qr_code_data',
  'social_media_templates',
  'created_at',
  'updated_at',
]);
const AFFILIATE_PAYOUT_ROW_KEYS = new Set([
  'id',
  'affiliate',
  'affiliate_id',
  'payout_month',
  'payout_amount_cents',
  'seller_referrals_count',
  'seller_gmv_cents',
  'seller_commission_cents',
  'customer_referrals_count',
  'customer_gmv_cents',
  'customer_commission_cents',
  'status',
  'payout_method',
  'transaction_id',
  'paid_at',
  'failure_reason',
  'created_at',
  'updated_at',
]);
const AFFILIATE_CLICK_ROW_KEYS = new Set([
  'id',
  'affiliate',
  'affiliate_id',
  'ip_address',
  'user_agent',
  'referrer_url',
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'converted',
  'converted_user_id',
  'converted_at',
  'created_at',
  'updated_at',
]);
const AFFILIATE_CLICK_METADATA_KEYS = new Set([
  'ip_address',
  'user_agent',
  'referrer_url',
  'utm_source',
  'utm_medium',
  'utm_campaign',
]);
const AFFILIATE_APPROVAL_CUSTOM_RATE_KEYS = new Set([
  'seller_commission_rate',
  'customer_commission_rate',
]);
const AFFILIATE_APPLICATION_DATA_KEYS = new Set([
  'application_message',
  'instagram_handle',
  'instagram_followers',
  'youtube_channel',
  'youtube_subscribers',
]);
const AFFILIATE_QR_PAYLOAD_KEYS = new Set([
  'type',
  'affiliate_id',
  'code',
  'destination',
]);
const REFERRAL_REWARD_NOTIFICATION_PAYLOAD_KEYS = new Set([
  'referral_id',
  'coupon_code',
  'reward_cents',
]);
const CUSTOMER_REFERRAL_ROW_KEYS = new Set([
  'id',
  'referral_code',
  'business',
  'business_id',
  'referrer',
  'referrer_id',
  'referee',
  'referee_id',
  'referee_order',
  'referee_order_id',
  'status',
  'reward_value_cents',
  'referrer_reward_claimed',
  'referee_reward_claimed',
  'reward_claimed_at',
  'source',
  'clicked_at',
  'order_placed_at',
  'created_at',
  'updated_at',
]);
const VIRAL_BADGE_ROW_KEYS = new Set([
  'id',
  'user',
  'user_id',
  'badge_type',
  'tier',
  'display_name',
  'description',
  'icon_url',
  'referrals_required',
  'referrals_achieved',
  'benefits',
  'awarded_at',
  'created_at',
  'updated_at',
]);
const MAX_REFERRAL_SHARE_CODE_LENGTH = 128;
const MAX_REFERRAL_SHARE_BUSINESS_NAME_LENGTH = 160;
const MAX_AFFILIATE_APPLICATION_MESSAGE_LENGTH = 1000;
const MAX_AFFILIATE_PROFILE_TEXT_LENGTH = 255;
const MAX_AFFILIATE_QR_PAYLOAD_LENGTH = 512;
const MAX_AFFILIATE_PAYOUT_TRANSACTION_ID_LENGTH = 255;
const MAX_AFFILIATE_PAYOUT_FAILURE_REASON_LENGTH = 1000;
const UNSAFE_ENHANCED_REFERRAL_TEXT_CONTROLS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/u;

function asNumber(value: number | string | null | undefined, fallback = 0): number {
  if (value === null || value === undefined) return fallback;
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function assertNonNegativeCents(label: string, value: number): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer amount in cents`);
  }
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${label} must be a safe integer amount in cents`);
  }
}

function asValidatedNonNegativeCents(label: string, value: number | string | null | undefined): number {
  const numeric = asNumber(value, Number.NaN);
  assertNonNegativeCents(label, numeric);
  return numeric;
}

function assertSafeFiniteScaledAmount(label: string, value: number): void {
  if (!Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER) {
    throw new Error(`${label} must be a safe finite amount before rounding`);
  }
}

function asValidatedNonNegativeInteger(label: string, value: number | string | null | undefined): number {
  const numeric = asNumber(value, Number.NaN);
  if (!Number.isInteger(numeric) || numeric < 0) {
    throw new Error(`${label} must be a non-negative integer`);
  }
  return numeric;
}

function asValidatedNonNegativeSafeInteger(label: string, value: number | string | null | undefined): number {
  const numeric = asValidatedNonNegativeInteger(label, value);
  if (!Number.isSafeInteger(numeric)) {
    throw new Error(`${label} must be a safe integer`);
  }
  return numeric;
}

function asValidatedPositiveSafeInteger(label: string, value: number | string | null | undefined): number {
  const numeric = asNumber(value, Number.NaN);
  if (!Number.isInteger(numeric) || numeric <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }
  if (!Number.isSafeInteger(numeric)) {
    throw new Error(`${label} must be a safe integer`);
  }
  return numeric;
}

function assertAffiliatePayoutMethod(label: string, value: unknown): string {
  const normalized = assertNonEmptyString(label, value).toLowerCase();
  if (!['upi', 'bank_transfer', 'paypal'].includes(normalized)) {
    throw new Error(`${label} must be upi, bank_transfer, or paypal`);
  }
  return normalized;
}

function assertNonEmptyString(label: string, value: unknown): string {
  if (typeof value !== 'string') {
    throw new Error(`${label} must be a non-empty string`);
  }
  if (hasUnsafeEnhancedReferralTextControls(value)) {
    throw new Error(`${label} must not include unsafe control characters`);
  }
  if (!value.trim()) {
    throw new Error(`${label} must be a non-empty string`);
  }
  const normalized = value.trim();
  return normalized;
}

function assertBoundedNonEmptyString(label: string, value: unknown, maxLength: number): string {
  const normalized = assertNonEmptyString(label, value);
  if (normalized.length > maxLength) {
    throw new Error(`${label} must be at most ${maxLength} characters`);
  }
  return normalized;
}

function hasUnsafeEnhancedReferralTextControls(value: string): boolean {
  return UNSAFE_ENHANCED_REFERRAL_TEXT_CONTROLS.test(value);
}

function assertEnhancedReferralFieldNamesAreSafe(label: string, fieldNames: string[]): void {
  if (fieldNames.some((fieldName) => hasUnsafeEnhancedReferralTextControls(fieldName))) {
    throw new Error(`${label} field names must not include unsafe control characters`);
  }
}

function assertAffiliateCode(label: string, value: unknown): string {
  const normalized = assertNonEmptyString(label, value);
  if (normalized.length > 50 || !/^[A-Z0-9_]+$/.test(normalized)) {
    throw new Error(`${label} must contain only uppercase letters, numbers, and underscores`);
  }
  return normalized;
}

function assertAffiliateStatus(label: string, value: unknown): string {
  const normalized = assertNonEmptyString(label, value).toLowerCase();
  if (!VALID_AFFILIATE_STATUSES.has(normalized)) {
    throw new Error(`${label} must be pending, approved, rejected, or suspended`);
  }
  return normalized;
}

function assertAffiliatePayoutStatus(label: string, value: unknown): string {
  const normalized = assertNonEmptyString(label, value).toLowerCase();
  if (!VALID_AFFILIATE_PAYOUT_STATUSES.has(normalized)) {
    throw new Error(`${label} must be pending, processing, paid, or failed`);
  }
  return normalized;
}

function assertCustomerReferralStatus(label: string, value: unknown): string {
  const normalized = assertNonEmptyString(label, value).toLowerCase();
  if (!VALID_CUSTOMER_REFERRAL_STATUSES.has(normalized)) {
    throw new Error(`${label} must be link_clicked, order_placed, or reward_claimed`);
  }
  return normalized;
}

function assertAffiliateCommissionType(label: string, value: unknown): 'seller' | 'customer' {
  const normalized = assertNonEmptyString(label, value).toLowerCase();
  if (normalized !== 'seller' && normalized !== 'customer') {
    throw new Error(`${label} must be seller or customer`);
  }
  return normalized;
}

function normalizeOptionalString(label: string, value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') {
    throw new Error(`${label} must be a string`);
  }
  if (hasUnsafeEnhancedReferralTextControls(value)) {
    throw new Error(`${label} must not include unsafe control characters`);
  }
  const normalized = value.trim();
  return normalized || undefined;
}

function normalizeOptionalBoundedString(
  label: string,
  value: unknown,
  maxLength: number
): string | undefined {
  const normalized = normalizeOptionalString(label, value);
  if (normalized === undefined) return undefined;
  if (normalized.length > maxLength) {
    throw new Error(`${label} must be at most ${maxLength} characters`);
  }
  return normalized;
}

function normalizeOptionalIpAddress(label: string, value: unknown): string | undefined {
  const normalized = normalizeOptionalBoundedString(label, value, 45);
  if (normalized === undefined) return undefined;
  if (isIP(normalized) === 0) {
    throw new Error(`${label} must be a valid IPv4 or IPv6 address`);
  }
  return normalized;
}

function normalizeOptionalHttpUrl(
  label: string,
  value: unknown,
  maxLength: number
): string | undefined {
  const normalized = normalizeOptionalBoundedString(label, value, maxLength);
  if (normalized === undefined) return undefined;

  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new Error(`${label} must be an absolute HTTP(S) URL`);
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`${label} must be an absolute HTTP(S) URL`);
  }
  if (parsed.username || parsed.password) {
    throw new Error(`${label} must not include embedded credentials`);
  }

  return normalized;
}

function normalizeAffiliateApplicationData(data: unknown): {
  application_message: string;
  instagram_handle?: string;
  instagram_followers?: number;
  youtube_channel?: string;
  youtube_subscribers?: number;
} {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Affiliate application data must be an object');
  }

  const applicationData = data as Record<string, unknown>;
  const applicationDataKeys = Object.keys(applicationData);
  assertEnhancedReferralFieldNamesAreSafe('Affiliate application data', applicationDataKeys);
  const unsupportedKeys = applicationDataKeys.filter(
    (key) => !AFFILIATE_APPLICATION_DATA_KEYS.has(key)
  );
  if (unsupportedKeys.length > 0) {
    throw new Error(
      `Affiliate application data includes unsupported field(s): ${unsupportedKeys.sort().join(', ')}`
    );
  }

  const applicationMessage = assertBoundedNonEmptyString(
    'Affiliate application message',
    applicationData.application_message,
    MAX_AFFILIATE_APPLICATION_MESSAGE_LENGTH
  );

  return {
    application_message: applicationMessage,
    instagram_handle: normalizeOptionalBoundedString(
      'Affiliate Instagram handle',
      applicationData.instagram_handle,
      MAX_AFFILIATE_PROFILE_TEXT_LENGTH
    ),
    instagram_followers: applicationData.instagram_followers === undefined
      ? undefined
      : asValidatedNonNegativeSafeInteger(
          'Affiliate Instagram followers',
          applicationData.instagram_followers as number | string | null | undefined
        ),
    youtube_channel: normalizeOptionalBoundedString(
      'Affiliate YouTube channel',
      applicationData.youtube_channel,
      MAX_AFFILIATE_PROFILE_TEXT_LENGTH
    ),
    youtube_subscribers: applicationData.youtube_subscribers === undefined
      ? undefined
      : asValidatedNonNegativeSafeInteger(
          'Affiliate YouTube subscribers',
          applicationData.youtube_subscribers as number | string | null | undefined
        ),
  };
}

function normalizeAffiliateClickMetadata(metadata: {
  ip_address?: unknown;
  user_agent?: unknown;
  referrer_url?: unknown;
  utm_source?: unknown;
  utm_medium?: unknown;
  utm_campaign?: unknown;
} | undefined): {
  ip_address?: string;
  user_agent?: string;
  referrer_url?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
} {
  if (metadata === undefined) return {};
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    throw new Error('Affiliate click metadata must be an object');
  }
  const metadataRecord = metadata as Record<string, unknown>;
  const metadataKeys = Object.keys(metadataRecord);
  assertEnhancedReferralFieldNamesAreSafe('Affiliate click metadata', metadataKeys);
  const unsupportedKeys = metadataKeys.filter(
    (key) => !AFFILIATE_CLICK_METADATA_KEYS.has(key)
  );
  if (unsupportedKeys.length > 0) {
    throw new Error(
      `Affiliate click metadata includes unsupported field(s): ${unsupportedKeys.sort().join(', ')}`
    );
  }

  return {
    ip_address: normalizeOptionalIpAddress('Affiliate click IP address', metadataRecord.ip_address),
    user_agent: normalizeOptionalBoundedString('Affiliate click user agent', metadataRecord.user_agent, 1024),
    referrer_url: normalizeOptionalHttpUrl('Affiliate click referrer URL', metadataRecord.referrer_url, 255),
    utm_source: normalizeOptionalBoundedString('Affiliate click UTM source', metadataRecord.utm_source, 100),
    utm_medium: normalizeOptionalBoundedString('Affiliate click UTM medium', metadataRecord.utm_medium, 100),
    utm_campaign: normalizeOptionalBoundedString('Affiliate click UTM campaign', metadataRecord.utm_campaign, 100),
  };
}

function checkedIncrementCount(label: string, value: number | string | null | undefined): number {
  const count = asValidatedNonNegativeSafeInteger(label, value);
  const incremented = count + 1;
  if (!Number.isSafeInteger(incremented)) {
    throw new Error(`${label} must remain a safe integer after increment`);
  }
  return incremented;
}

function assertBoolean(label: string, value: unknown): boolean {
  if (typeof value !== 'boolean') {
    throw new Error(`${label} must be a boolean`);
  }
  return value;
}

function assertCommissionRate(label: string, value: number): void {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error(`${label} must be between 0 and 100`);
  }
}

function asValidatedCommissionRate(label: string, value: number | string | null | undefined): number {
  const numeric = asNumber(value, Number.NaN);
  assertCommissionRate(label, numeric);
  return numeric;
}

function normalizeAffiliateApprovalCustomRates(
  customRates: unknown
): {
  seller_commission_rate?: number;
  customer_commission_rate?: number;
} | undefined {
  if (customRates === undefined || customRates === null) return undefined;
  if (typeof customRates !== 'object' || Array.isArray(customRates)) {
    throw new Error('Affiliate approval custom rates must be an object');
  }

  const customRateRecord = customRates as Record<string, unknown>;
  const customRateKeys = Object.keys(customRateRecord);
  assertEnhancedReferralFieldNamesAreSafe('Affiliate approval custom rates', customRateKeys);
  const unsupportedKeys = customRateKeys.filter(
    (key) => !AFFILIATE_APPROVAL_CUSTOM_RATE_KEYS.has(key)
  );
  if (unsupportedKeys.length > 0) {
    throw new Error(
      `Affiliate approval custom rates include unsupported field(s): ${unsupportedKeys.sort().join(', ')}`
    );
  }

  const normalizedCustomRates = customRateRecord as {
    seller_commission_rate?: number;
    customer_commission_rate?: number;
  };
  if (normalizedCustomRates.seller_commission_rate !== undefined) {
    assertCommissionRate('Seller commission rate', normalizedCustomRates.seller_commission_rate);
  }
  if (normalizedCustomRates.customer_commission_rate !== undefined) {
    assertCommissionRate('Customer commission rate', normalizedCustomRates.customer_commission_rate);
  }
  return normalizedCustomRates;
}

function assertAffiliateQrPayload(
  encodedPayload: string,
  expected: { affiliateId: string; affiliateCode: string }
): void {
  const normalizedPayload = assertNonEmptyString('Affiliate QR payload', encodedPayload);
  if (normalizedPayload.length > MAX_AFFILIATE_QR_PAYLOAD_LENGTH) {
    throw new Error(`Affiliate QR payload must be at most ${MAX_AFFILIATE_QR_PAYLOAD_LENGTH} characters`);
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(Buffer.from(normalizedPayload, 'base64url').toString('utf8'));
  } catch {
    throw new Error('Affiliate QR payload must be valid base64url JSON');
  }

  if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded)) {
    throw new Error('Affiliate QR payload must be an object');
  }

  const payload = decoded as Record<string, unknown>;
  const payloadKeys = Object.keys(payload);
  assertEnhancedReferralFieldNamesAreSafe('Affiliate QR payload', payloadKeys);
  const unsupportedKeys = payloadKeys.filter(
    (key) => !AFFILIATE_QR_PAYLOAD_KEYS.has(key)
  );
  if (unsupportedKeys.length > 0) {
    throw new Error(
      `Affiliate QR payload includes unsupported field(s): ${unsupportedKeys.sort().join(', ')}`
    );
  }

  const payloadType = assertNonEmptyString('Affiliate QR payload type', payload.type);
  if (payloadType !== 'affiliate_referral') {
    throw new Error('Affiliate QR payload type must be affiliate_referral');
  }

  const payloadAffiliateId = assertNonEmptyString('Affiliate QR payload affiliate_id', payload.affiliate_id);
  if (payloadAffiliateId !== expected.affiliateId) {
    throw new Error('Affiliate QR payload affiliate_id must match approved affiliate');
  }

  const payloadCode = assertAffiliateCode('Affiliate QR payload code', payload.code);
  if (payloadCode !== expected.affiliateCode) {
    throw new Error('Affiliate QR payload code must match approved affiliate code');
  }

  const payloadDestination = normalizeOptionalHttpUrl(
    'Affiliate QR payload destination',
    payload.destination,
    255
  );
  if (payloadDestination !== `https://menumaker.app/ref/${expected.affiliateCode}`) {
    throw new Error('Affiliate QR payload destination must match approved affiliate code');
  }
}

export function calculateAffiliateCommissionCents(
  gmvCents: number,
  commissionRatePercent: number
): number {
  assertNonNegativeCents('GMV', gmvCents);
  assertCommissionRate('Commission rate', commissionRatePercent);
  const scaledCommissionAmount = gmvCents * commissionRatePercent;
  assertSafeFiniteScaledAmount('Affiliate commission scaled amount', scaledCommissionAmount);
  const commissionCents = Math.round(scaledCommissionAmount / 100);
  assertNonNegativeCents('Affiliate commission', commissionCents);
  return commissionCents;
}

function checkedAddCents(label: string, leftCents: number, rightCents: number): number {
  const total = leftCents + rightCents;
  assertNonNegativeCents(label, total);
  return total;
}

function assertAffiliateEarnedCommissionWithinGmv(
  affiliateId: string,
  totalGmvCents: number,
  totalCommissionEarnedCents: number
): void {
  if (totalCommissionEarnedCents > totalGmvCents) {
    throw new Error(`Total commission earned for affiliate ${affiliateId} cannot exceed total GMV`);
  }
}

function assertYearMonth(label: string, value: unknown): string {
  const normalized = assertNonEmptyString(label, value);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(normalized)) {
    throw new Error(`${label} must use YYYY-MM format`);
  }
  return normalized;
}

function assertValidDate(label: string, value: unknown): Date {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new Error(`${label} must be a valid Date`);
  }
  return value;
}

function assertRewardClaimReferralRow(
  referral: CustomerReferral,
  requestedReferralId: string
): {
  id: string;
  businessId: string;
  referrerId: string;
  refereeId?: string;
  referralCode: string;
  status: string;
  referrerRewardClaimed: boolean;
  refereeRewardClaimed: boolean;
  rewardValueCents: number;
} {
  assertCustomerReferralRowObject('Customer referral', referral);
  const referralId = assertNonEmptyString('Customer referral id', referral.id);
  assertCustomerReferralRowEnvelope(`Customer referral ${referralId}`, referral);
  if (referralId !== requestedReferralId) {
    throw new Error(`Customer referral ${referralId} id must match requested referral`);
  }

  const businessId = assertNonEmptyString(`Customer referral ${referralId} business_id`, referral.business_id);
  const referrerId = assertNonEmptyString(`Customer referral ${referralId} referrer_id`, referral.referrer_id);
  const referralCode = assertNonEmptyString(`Customer referral ${referralId} referral_code`, referral.referral_code);
  const status = assertCustomerReferralStatus(`Customer referral ${referralId} status`, referral.status);
  const referrerRewardClaimed = assertBoolean(
    `Customer referral ${referralId} referrer_reward_claimed`,
    referral.referrer_reward_claimed
  );
  const refereeRewardClaimed = assertBoolean(
    `Customer referral ${referralId} referee_reward_claimed`,
    referral.referee_reward_claimed
  );
  const rewardValueCents = asValidatedNonNegativeCents(
    `Referral reward value for referral ${referralId}`,
    referral.reward_value_cents
  );
  if (referrerRewardClaimed !== refereeRewardClaimed) {
    throw new Error(`Customer referral ${referralId} reward claim flags must be consistent`);
  }
  if (status === 'reward_claimed' && (!referrerRewardClaimed || !refereeRewardClaimed)) {
    throw new Error(`Customer referral ${referralId} reward flags must both be claimed for reward_claimed status`);
  }
  if (status !== 'reward_claimed' && (referrerRewardClaimed || refereeRewardClaimed)) {
    throw new Error(`Customer referral ${referralId} reward flags cannot be claimed before reward_claimed status`);
  }
  assertCustomerReferralLifecycleEvidence(referral, referralId, status, {
    referrerRewardClaimed,
    refereeRewardClaimed,
  });
  const refereeId =
    referral.referee_id === undefined || referral.referee_id === null
      ? undefined
      : assertNonEmptyString(`Customer referral ${referralId} referee_id`, referral.referee_id);
  if (status === 'order_placed' || status === 'reward_claimed') {
    if (!refereeId) {
      throw new Error(`Customer referral ${referralId} referee_id is required for order_placed status`);
    }
    assertNonEmptyString(
      `Customer referral ${referralId} referee_order_id`,
      referral.referee_order_id
    );
    assertValidDate(`Customer referral ${referralId} order_placed_at`, referral.order_placed_at);
  }

  return {
    id: referralId,
    businessId,
    referrerId,
    refereeId,
    referralCode,
    status,
    referrerRewardClaimed,
    refereeRewardClaimed,
    rewardValueCents,
  };
}

function assertCustomerReferralStatsRow(
  referral: CustomerReferral,
  requestedUserId: string,
  rowNumber: number
): {
  id: string;
  status: string;
  rewardValueCents: number;
} {
  const rowLabel = `Customer referral stats row ${rowNumber}`;
  assertCustomerReferralRowObject(rowLabel, referral);
  const referralId = normalizeOptionalString(`${rowLabel} id`, referral.id) ?? `#${rowNumber}`;
  assertCustomerReferralRowEnvelope(rowLabel, referral);
  const referrerId = assertNonEmptyString(`${rowLabel} referrer_id`, referral.referrer_id);
  if (referrerId !== requestedUserId) {
    throw new Error(`${rowLabel} referrer_id must match requested user for referral ${referralId}`);
  }
  const status = assertCustomerReferralStatus(`Customer referral ${referralId} status`, referral.status);
  const referrerRewardClaimed = referral.referrer_reward_claimed === undefined || referral.referrer_reward_claimed === null
    ? false
    : assertBoolean(`Customer referral ${referralId} referrer_reward_claimed`, referral.referrer_reward_claimed);
  const refereeRewardClaimed = referral.referee_reward_claimed === undefined || referral.referee_reward_claimed === null
    ? false
    : assertBoolean(`Customer referral ${referralId} referee_reward_claimed`, referral.referee_reward_claimed);
  if (referrerRewardClaimed !== refereeRewardClaimed) {
    throw new Error(`Customer referral ${referralId} reward claim flags must be consistent`);
  }
  if (status === 'reward_claimed' && (!referrerRewardClaimed || !refereeRewardClaimed)) {
    throw new Error(`Customer referral ${referralId} reward flags must both be claimed for reward_claimed status`);
  }
  if (status !== 'reward_claimed' && (referrerRewardClaimed || refereeRewardClaimed)) {
    throw new Error(`Customer referral ${referralId} reward flags cannot be claimed before reward_claimed status`);
  }
  assertCustomerReferralLifecycleEvidence(referral, referralId, status, {
    referrerRewardClaimed,
    refereeRewardClaimed,
  });
  if (status === 'order_placed' || status === 'reward_claimed') {
    assertNonEmptyString(`Customer referral ${referralId} referee_id`, referral.referee_id);
    assertNonEmptyString(`Customer referral ${referralId} referee_order_id`, referral.referee_order_id);
    assertValidDate(`Customer referral ${referralId} order_placed_at`, referral.order_placed_at);
  }
  const rewardValueCents = status === 'reward_claimed'
    ? asValidatedNonNegativeCents(
        `Referral reward value for referral ${referralId}`,
        referral.reward_value_cents
      )
    : 0;

  return {
    id: referralId,
    status,
    rewardValueCents,
  };
}

function assertCustomerReferralLifecycleEvidence(
  referral: CustomerReferral,
  referralId: string,
  status: string,
  rewardFlags: {
    referrerRewardClaimed: boolean;
    refereeRewardClaimed: boolean;
  }
): void {
  let createdAt: Date | undefined;
  if (referral.created_at !== undefined && referral.created_at !== null) {
    createdAt = assertValidDate(`Customer referral ${referralId} created_at`, referral.created_at);
  }
  let orderPlacedAt: Date | undefined;
  if (referral.order_placed_at !== undefined && referral.order_placed_at !== null) {
    orderPlacedAt = assertValidDate(`Customer referral ${referralId} order_placed_at`, referral.order_placed_at);
  }
  let rewardClaimedAt: Date | undefined;
  if (referral.reward_claimed_at !== undefined && referral.reward_claimed_at !== null) {
    rewardClaimedAt = assertValidDate(`Customer referral ${referralId} reward_claimed_at`, referral.reward_claimed_at);
  }
  if (createdAt && orderPlacedAt && orderPlacedAt < createdAt) {
    throw new Error(`Customer referral ${referralId} order_placed_at cannot be before created_at`);
  }
  if (createdAt && rewardClaimedAt && rewardClaimedAt < createdAt) {
    throw new Error(`Customer referral ${referralId} reward_claimed_at cannot be before created_at`);
  }
  if (orderPlacedAt && rewardClaimedAt && rewardClaimedAt < orderPlacedAt) {
    throw new Error(`Customer referral ${referralId} reward_claimed_at cannot be before order_placed_at`);
  }
  if (status === 'reward_claimed' && !rewardClaimedAt) {
    throw new Error(`Customer referral ${referralId} reward_claimed_at is required for reward_claimed status`);
  }
  if (status !== 'reward_claimed' && rewardClaimedAt) {
    throw new Error(`Customer referral ${referralId} reward_claimed_at cannot be present before reward_claimed status`);
  }
  if ((rewardFlags.referrerRewardClaimed || rewardFlags.refereeRewardClaimed) && !rewardClaimedAt) {
    throw new Error(`Customer referral ${referralId} reward_claimed_at is required when reward flags are claimed`);
  }
}

function assertUniqueCustomerReferralStatsIds(
  referrals: Array<{ id: string }>,
  requestedUserId: string
): void {
  const seenReferralIds = new Set<string>();
  referrals.forEach((referral, index) => {
    const rowLabel = `Customer referral stats row ${index + 1}`;
    if (seenReferralIds.has(referral.id)) {
      throw new Error(`${rowLabel} id must be unique for user ${requestedUserId}`);
    }
    seenReferralIds.add(referral.id);
  });
}

function assertCustomerReferralBadgeEvidenceRow(
  referral: CustomerReferral,
  requestedUserId: string,
  rowNumber: number
): {
  id: string;
  status: string;
  rewardValueCents: number;
} {
  const row = assertCustomerReferralStatsRow(referral, requestedUserId, rowNumber);
  if (row.status !== 'reward_claimed') {
    throw new Error(
      `Viral badge referral row ${rowNumber} status must match reward_claimed query for referral ${row.id}`
    );
  }
  return row;
}

function assertViralBadgeReadRow(
  badge: ViralBadge,
  requestedUserId: string,
  rowNumber: number
): void {
  const rowLabel = `Viral badge row ${rowNumber}`;
  assertViralBadgeRowObject(rowLabel, badge);
  const badgeId = normalizeOptionalString(`${rowLabel} id`, badge.id) ?? `#${rowNumber}`;
  assertViralBadgeRowEnvelope(rowLabel, badge);
  const badgeUserId = assertNonEmptyString(`${rowLabel} user_id`, badge.user_id);
  if (badgeUserId !== requestedUserId) {
    throw new Error(`${rowLabel} user_id must match requested user for badge ${badgeId}`);
  }
  assertNonEmptyString(`${rowLabel} badge_type`, badge.badge_type);
  if (badge.tier !== undefined && badge.tier !== null) {
    asValidatedPositiveSafeInteger(`Tier for viral badge ${badgeId}`, badge.tier);
  }
  if (badge.referrals_required !== undefined && badge.referrals_required !== null) {
    asValidatedNonNegativeSafeInteger(
      `Referrals required for viral badge ${badgeId}`,
      badge.referrals_required
    );
  }
  if (badge.referrals_achieved !== undefined && badge.referrals_achieved !== null) {
    asValidatedNonNegativeSafeInteger(
      `Referrals achieved for viral badge ${badgeId}`,
      badge.referrals_achieved
    );
  }
}

function assertUniqueViralBadgeReadIds(
  badges: ViralBadge[],
  requestedUserId: string
): void {
  const seenBadgeIds = new Set<string>();
  badges.forEach((badge, index) => {
    const rowLabel = `Viral badge row ${index + 1}`;
    const badgeId = normalizeOptionalString(`${rowLabel} id`, badge.id);
    if (!badgeId) {
      return;
    }
    if (seenBadgeIds.has(badgeId)) {
      throw new Error(`${rowLabel} id must be unique for user ${requestedUserId}`);
    }
    seenBadgeIds.add(badgeId);
  });
}

function assertExistingViralBadgeAwardRow(
  badge: ViralBadge,
  expected: { userId: string; badgeType: string }
): void {
  assertViralBadgeRowObject('Existing viral badge', badge);
  const badgeId = normalizeOptionalString('Existing viral badge id', badge.id) ?? expected.badgeType;
  assertViralBadgeRowEnvelope(`Existing viral badge ${badgeId}`, badge);
  const badgeUserId = assertNonEmptyString(`Existing viral badge ${badgeId} user_id`, badge.user_id);
  if (badgeUserId !== expected.userId) {
    throw new Error(`Existing viral badge ${badgeId} user_id must match requested user`);
  }
  const badgeType = assertNonEmptyString(`Existing viral badge ${badgeId} badge_type`, badge.badge_type);
  if (badgeType !== expected.badgeType) {
    throw new Error(`Existing viral badge ${badgeId} badge_type must match requested badge definition`);
  }
  if (badge.tier !== undefined && badge.tier !== null) {
    asValidatedPositiveSafeInteger(`Tier for existing viral badge ${badgeId}`, badge.tier);
  }
  if (badge.referrals_required !== undefined && badge.referrals_required !== null) {
    asValidatedNonNegativeSafeInteger(
      `Referrals required for existing viral badge ${badgeId}`,
      badge.referrals_required
    );
  }
  if (badge.referrals_achieved !== undefined && badge.referrals_achieved !== null) {
    asValidatedNonNegativeSafeInteger(
      `Referrals achieved for existing viral badge ${badgeId}`,
      badge.referrals_achieved
    );
  }
}

function assertCustomerReferralOrderSource(
  order: Order,
  expected: { orderId: string; businessId: string; refereeId: string }
): void {
  const orderId = assertNonEmptyString('Customer referral order id', order.id);
  if (orderId !== expected.orderId) {
    throw new Error('Customer referral order id must match requested order');
  }

  const orderBusinessId = assertNonEmptyString(
    `Customer referral order ${orderId} business_id`,
    order.business_id
  );
  if (orderBusinessId !== expected.businessId) {
    throw new Error('Customer referral order business_id must match referral business_id');
  }

  if (order.business !== undefined && order.business !== null) {
    const relationBusinessId = assertNonEmptyString(
      `Customer referral order ${orderId} business relation id`,
      order.business.id
    );
    if (relationBusinessId !== orderBusinessId) {
      throw new Error('Customer referral order business relation id must match order business_id');
    }
  }

  const orderCustomerId = assertNonEmptyString(
    `Customer referral order ${orderId} customer_id`,
    order.customer_id
  );
  if (orderCustomerId !== expected.refereeId) {
    throw new Error('Customer referral order customer_id must match referral referee_id');
  }
}

function assertUserLookupSourceRow(user: User, requestedUserId: string, label: string): string {
  const persistedUserId = assertNonEmptyString(`${label} id`, user.id);
  if (persistedUserId !== requestedUserId) {
    throw new Error(`${label} id must match requested user`);
  }

  return normalizeOptionalString(`${label} full_name`, user.full_name) ??
    assertNonEmptyString(`${label} email`, user.email);
}

function assertAffiliatePayoutDashboardRow(payout: AffiliatePayout, affiliateId: string, index: number): void {
  const label = `Affiliate payout dashboard row ${index + 1}`;
  assertAffiliatePayoutRowEnvelope(label, payout);
  const payoutId = assertNonEmptyString(`${label} id`, payout.id);
  const persistedAffiliateId = assertNonEmptyString(`${label} affiliate_id`, payout.affiliate_id);
  if (persistedAffiliateId !== affiliateId) {
    throw new Error(`${label} affiliate_id must match dashboard affiliate`);
  }
  assertYearMonth(`${label} payout_month`, payout.payout_month);
  const status = assertAffiliatePayoutStatus(`${label} status`, payout.status);
  const payoutAmountCents = asValidatedNonNegativeCents(
    `Payout amount for affiliate payout ${payoutId}`,
    payout.payout_amount_cents
  );
  asValidatedNonNegativeSafeInteger(`Seller referrals for affiliate payout ${payoutId}`, payout.seller_referrals_count);
  asValidatedNonNegativeCents(`Seller GMV for affiliate payout ${payoutId}`, payout.seller_gmv_cents);
  const sellerCommissionCents = asValidatedNonNegativeCents(
    `Seller commission for affiliate payout ${payoutId}`,
    payout.seller_commission_cents
  );
  asValidatedNonNegativeSafeInteger(`Customer referrals for affiliate payout ${payoutId}`, payout.customer_referrals_count);
  asValidatedNonNegativeCents(`Customer GMV for affiliate payout ${payoutId}`, payout.customer_gmv_cents);
  const customerCommissionCents = asValidatedNonNegativeCents(
    `Customer commission for affiliate payout ${payoutId}`,
    payout.customer_commission_cents
  );
  const expectedPayoutAmountCents = sellerCommissionCents + customerCommissionCents;
  if (!Number.isSafeInteger(expectedPayoutAmountCents)) {
    throw new Error(`Affiliate payout ${payoutId} commission sum must be a safe integer amount in cents`);
  }
  if (payoutAmountCents !== expectedPayoutAmountCents) {
    throw new Error(`Affiliate payout ${payoutId} payout_amount_cents must equal seller plus customer commission`);
  }
  assertAffiliatePayoutMethod(`Payout method for affiliate payout ${payoutId}`, payout.payout_method);
  const createdAt = assertValidDate(`Created timestamp for affiliate payout ${payoutId}`, payout.created_at);
  let updatedAt: Date | undefined;
  if (payout.updated_at !== undefined && payout.updated_at !== null) {
    updatedAt = assertValidDate(`Updated timestamp for affiliate payout ${payoutId}`, payout.updated_at);
  }
  let paidAt: Date | undefined;
  if (payout.paid_at !== undefined && payout.paid_at !== null) {
    paidAt = assertValidDate(`Paid timestamp for affiliate payout ${payoutId}`, payout.paid_at);
  }
  if (payout.failure_reason !== undefined && payout.failure_reason !== null) {
    assertBoundedNonEmptyString(
      `Failure reason for affiliate payout ${payoutId}`,
      payout.failure_reason,
      MAX_AFFILIATE_PAYOUT_FAILURE_REASON_LENGTH
    );
  }
  let transactionId: string | undefined;
  if (payout.transaction_id !== undefined && payout.transaction_id !== null) {
    transactionId = assertBoundedNonEmptyString(
      `Transaction id for affiliate payout ${payoutId}`,
      payout.transaction_id,
      MAX_AFFILIATE_PAYOUT_TRANSACTION_ID_LENGTH
    );
  }
  if (status === 'paid' && (payout.paid_at === undefined || payout.paid_at === null)) {
    throw new Error(`Affiliate payout ${payoutId} paid status requires paid_at evidence`);
  }
  if (status === 'paid' && transactionId === undefined) {
    throw new Error(`Affiliate payout ${payoutId} paid status requires transaction_id evidence`);
  }
  if (status !== 'paid' && payout.paid_at !== undefined && payout.paid_at !== null) {
    throw new Error(`Affiliate payout ${payoutId} paid_at evidence cannot be present before paid status`);
  }
  if (status !== 'paid' && transactionId !== undefined) {
    throw new Error(`Affiliate payout ${payoutId} transaction_id evidence cannot be present before paid status`);
  }
  if (paidAt && paidAt < createdAt) {
    throw new Error(`Affiliate payout ${payoutId} paid_at evidence cannot be before payout creation`);
  }
  if (updatedAt && updatedAt < createdAt) {
    throw new Error(`Affiliate payout ${payoutId} updated_at evidence cannot be before payout creation`);
  }
  if (status === 'paid' && updatedAt && paidAt && updatedAt < paidAt) {
    throw new Error(`Affiliate payout ${payoutId} updated_at evidence cannot be before paid_at`);
  }
  if (status === 'failed' && (payout.failure_reason === undefined || payout.failure_reason === null)) {
    throw new Error(`Affiliate payout ${payoutId} failed status requires failure_reason evidence`);
  }
  if (status !== 'failed' && payout.failure_reason !== undefined && payout.failure_reason !== null) {
    throw new Error(`Affiliate payout ${payoutId} failure_reason evidence cannot be present before failed status`);
  }
}

function assertUniqueAffiliatePayoutDashboardMonths(payouts: AffiliatePayout[], affiliateId: string): void {
  const seenPayoutMonths = new Set<string>();
  payouts.forEach((payout, index) => {
    const rowLabel = `Affiliate payout dashboard row ${index + 1}`;
    const payoutMonth = assertYearMonth(`${rowLabel} payout_month`, payout.payout_month);
    if (seenPayoutMonths.has(payoutMonth)) {
      throw new Error(`${rowLabel} payout_month must be unique for affiliate ${affiliateId}`);
    }
    seenPayoutMonths.add(payoutMonth);
  });
}

function assertUniqueAffiliatePayoutDashboardIds(payouts: AffiliatePayout[], affiliateId: string): void {
  const seenPayoutIds = new Set<string>();
  payouts.forEach((payout, index) => {
    const rowLabel = `Affiliate payout dashboard row ${index + 1}`;
    const payoutId = assertNonEmptyString(`${rowLabel} id`, payout.id);
    if (seenPayoutIds.has(payoutId)) {
      throw new Error(`${rowLabel} id must be unique for affiliate ${affiliateId}`);
    }
    seenPayoutIds.add(payoutId);
  });
}

function assertUniqueAffiliatePayoutDashboardTransactionIds(payouts: AffiliatePayout[], affiliateId: string): void {
  const seenTransactionIds = new Set<string>();
  payouts.forEach((payout, index) => {
    if (payout.status !== 'paid') {
      return;
    }
    const rowLabel = `Affiliate payout dashboard row ${index + 1}`;
    const payoutId = assertNonEmptyString(`${rowLabel} id`, payout.id);
    const transactionId = assertNonEmptyString(
      `Transaction id for affiliate payout ${payoutId}`,
      payout.transaction_id
    );
    if (seenTransactionIds.has(transactionId)) {
      throw new Error(`${rowLabel} transaction_id must be unique for affiliate ${affiliateId}`);
    }
    seenTransactionIds.add(transactionId);
  });
}

function assertAffiliatePayoutRowObject(label: string, payout: AffiliatePayout): void {
  if (!payout || typeof payout !== 'object' || Array.isArray(payout)) {
    throw new Error(`${label} must be an object`);
  }
}

function assertAffiliatePayoutRowEnvelope(label: string, payout: AffiliatePayout): void {
  assertAffiliatePayoutRowObject(label, payout);
  const payoutRecord = payout as unknown as Record<string, unknown>;
  const payoutKeys = Object.keys(payoutRecord);
  assertEnhancedReferralFieldNamesAreSafe(label, payoutKeys);
  const unsupportedKeys = payoutKeys.filter(
    (key) => !AFFILIATE_PAYOUT_ROW_KEYS.has(key) && payoutRecord[key] !== undefined
  );
  if (unsupportedKeys.length > 0) {
    throw new Error(`${label} include unsupported field(s): ${unsupportedKeys.sort().join(', ')}`);
  }
}

function assertAffiliateRowEnvelope(label: string, affiliate: Affiliate): void {
  if (!affiliate || typeof affiliate !== 'object' || Array.isArray(affiliate)) {
    throw new Error(`${label} must be an object`);
  }

  const affiliateRecord = affiliate as unknown as Record<string, unknown>;
  const affiliateKeys = Object.keys(affiliateRecord);
  assertEnhancedReferralFieldNamesAreSafe(label, affiliateKeys);
  const unsupportedKeys = affiliateKeys.filter(
    (key) => !AFFILIATE_ROW_KEYS.has(key) && affiliateRecord[key] !== undefined
  );
  if (unsupportedKeys.length > 0) {
    throw new Error(`${label} include unsupported field(s): ${unsupportedKeys.sort().join(', ')}`);
  }

  let createdAt: Date | undefined;
  if (affiliate.created_at !== undefined && affiliate.created_at !== null) {
    createdAt = assertValidDate(`${label} created_at`, affiliate.created_at);
  }
  let approvedAt: Date | undefined;
  if (affiliate.approved_at !== undefined && affiliate.approved_at !== null) {
    approvedAt = assertValidDate(`${label} approved_at`, affiliate.approved_at);
  }
  let updatedAt: Date | undefined;
  if (affiliate.updated_at !== undefined && affiliate.updated_at !== null) {
    updatedAt = assertValidDate(`${label} updated_at`, affiliate.updated_at);
  }
  if (createdAt && approvedAt && approvedAt < createdAt) {
    throw new Error(`${label} approved_at cannot be before created_at`);
  }
  if (
    approvedAt &&
    (affiliate.status === 'pending' || affiliate.status === 'rejected')
  ) {
    throw new Error(`${label} approved_at cannot be present before approved or suspended status`);
  }
  if (createdAt && updatedAt && updatedAt < createdAt) {
    throw new Error(`${label} updated_at cannot be before created_at`);
  }
  if (approvedAt && updatedAt && updatedAt < approvedAt) {
    throw new Error(`${label} updated_at cannot be before approved_at`);
  }

  normalizeOptionalBoundedString(
    `${label} application_message`,
    affiliate.application_message,
    MAX_AFFILIATE_APPLICATION_MESSAGE_LENGTH
  );
  normalizeOptionalBoundedString(
    `${label} instagram_handle`,
    affiliate.instagram_handle,
    MAX_AFFILIATE_PROFILE_TEXT_LENGTH
  );
  normalizeOptionalBoundedString(
    `${label} youtube_channel`,
    affiliate.youtube_channel,
    MAX_AFFILIATE_PROFILE_TEXT_LENGTH
  );
}

function assertAffiliateClickRowObject(label: string, click: AffiliateClick): void {
  if (!click || typeof click !== 'object' || Array.isArray(click)) {
    throw new Error(`${label} must be an object`);
  }
}

function assertAffiliateClickRowEnvelope(label: string, click: AffiliateClick): void {
  assertAffiliateClickRowObject(label, click);
  const clickRecord = click as unknown as Record<string, unknown>;
  const clickKeys = Object.keys(clickRecord);
  assertEnhancedReferralFieldNamesAreSafe(label, clickKeys);
  const unsupportedKeys = clickKeys.filter(
    (key) => !AFFILIATE_CLICK_ROW_KEYS.has(key) && clickRecord[key] !== undefined
  );
  if (unsupportedKeys.length > 0) {
    throw new Error(`${label} include unsupported field(s): ${unsupportedKeys.sort().join(', ')}`);
  }
}

function assertCustomerReferralRowEnvelope(label: string, referral: CustomerReferral): void {
  assertCustomerReferralRowObject(label, referral);
  const referralRecord = referral as unknown as Record<string, unknown>;
  const referralKeys = Object.keys(referralRecord);
  assertEnhancedReferralFieldNamesAreSafe(label, referralKeys);
  const unsupportedKeys = referralKeys.filter(
    (key) => !CUSTOMER_REFERRAL_ROW_KEYS.has(key) && referralRecord[key] !== undefined
  );
  if (unsupportedKeys.length > 0) {
    throw new Error(`${label} include unsupported field(s): ${unsupportedKeys.sort().join(', ')}`);
  }

  let createdAt: Date | undefined;
  if (referral.created_at !== undefined && referral.created_at !== null) {
    createdAt = assertValidDate(`${label} created_at`, referral.created_at);
  }
  let updatedAt: Date | undefined;
  if (referral.updated_at !== undefined && referral.updated_at !== null) {
    updatedAt = assertValidDate(`${label} updated_at`, referral.updated_at);
  }
  if (createdAt && updatedAt && updatedAt < createdAt) {
    throw new Error(`${label} updated_at cannot be before created_at`);
  }
}

function assertCustomerReferralRowObject(label: string, referral: CustomerReferral): void {
  if (!referral || typeof referral !== 'object' || Array.isArray(referral)) {
    throw new Error(`${label} must be an object`);
  }
}

function assertViralBadgeRowEnvelope(label: string, badge: ViralBadge): void {
  assertViralBadgeRowObject(label, badge);
  const badgeRecord = badge as unknown as Record<string, unknown>;
  const badgeKeys = Object.keys(badgeRecord);
  assertEnhancedReferralFieldNamesAreSafe(label, badgeKeys);
  const unsupportedKeys = badgeKeys.filter(
    (key) => !VIRAL_BADGE_ROW_KEYS.has(key) && badgeRecord[key] !== undefined
  );
  if (unsupportedKeys.length > 0) {
    throw new Error(`${label} include unsupported field(s): ${unsupportedKeys.sort().join(', ')}`);
  }

  let createdAt: Date | undefined;
  if (badge.created_at !== undefined && badge.created_at !== null) {
    createdAt = assertValidDate(`${label} created_at`, badge.created_at);
  }
  let awardedAt: Date | undefined;
  if (badge.awarded_at !== undefined && badge.awarded_at !== null) {
    awardedAt = assertValidDate(`${label} awarded_at`, badge.awarded_at);
  }
  let updatedAt: Date | undefined;
  if (badge.updated_at !== undefined && badge.updated_at !== null) {
    updatedAt = assertValidDate(`${label} updated_at`, badge.updated_at);
  }
  if (createdAt && awardedAt && awardedAt < createdAt) {
    throw new Error(`${label} awarded_at cannot be before created_at`);
  }
  if (createdAt && updatedAt && updatedAt < createdAt) {
    throw new Error(`${label} updated_at cannot be before created_at`);
  }
}

function assertViralBadgeRowObject(label: string, badge: ViralBadge): void {
  if (!badge || typeof badge !== 'object' || Array.isArray(badge)) {
    throw new Error(`${label} must be an object`);
  }
}

function assertExistingAffiliateMonthlyPayoutRow(
  payout: AffiliatePayout,
  affiliateId: string,
  payoutMonth: string,
  expectedPayoutAmountCents: number
): void {
  assertAffiliatePayoutRowObject('Existing affiliate payout', payout);
  const payoutId = assertNonEmptyString('Existing affiliate payout id', payout.id);
  assertAffiliatePayoutRowEnvelope(`Existing affiliate payout ${payoutId}`, payout);
  const persistedAffiliateId = assertNonEmptyString(
    `Existing affiliate payout ${payoutId} affiliate_id`,
    payout.affiliate_id
  );
  if (persistedAffiliateId !== affiliateId) {
    throw new Error(`Existing affiliate payout ${payoutId} affiliate_id must match payout candidate affiliate`);
  }

  const persistedPayoutMonth = assertYearMonth(
    `Existing affiliate payout ${payoutId} payout_month`,
    payout.payout_month
  );
  if (persistedPayoutMonth !== payoutMonth) {
    throw new Error(`Existing affiliate payout ${payoutId} payout_month must match requested payout month`);
  }

  const status = assertAffiliatePayoutStatus(`Existing affiliate payout ${payoutId} status`, payout.status);
  const payoutAmountCents = asValidatedNonNegativeCents(
    `Existing affiliate payout ${payoutId} payout_amount_cents`,
    payout.payout_amount_cents
  );
  if (payoutAmountCents !== expectedPayoutAmountCents) {
    throw new Error(`Existing affiliate payout ${payoutId} payout_amount_cents must match pending commission`);
  }
  asValidatedNonNegativeSafeInteger(
    `Seller referrals for existing affiliate payout ${payoutId}`,
    payout.seller_referrals_count
  );
  asValidatedNonNegativeCents(
    `Seller GMV for existing affiliate payout ${payoutId}`,
    payout.seller_gmv_cents
  );
  const sellerCommissionCents = asValidatedNonNegativeCents(
    `Seller commission for existing affiliate payout ${payoutId}`,
    payout.seller_commission_cents
  );
  asValidatedNonNegativeSafeInteger(
    `Customer referrals for existing affiliate payout ${payoutId}`,
    payout.customer_referrals_count
  );
  asValidatedNonNegativeCents(
    `Customer GMV for existing affiliate payout ${payoutId}`,
    payout.customer_gmv_cents
  );
  const customerCommissionCents = asValidatedNonNegativeCents(
    `Customer commission for existing affiliate payout ${payoutId}`,
    payout.customer_commission_cents
  );
  const expectedComponentPayoutAmountCents = sellerCommissionCents + customerCommissionCents;
  if (!Number.isSafeInteger(expectedComponentPayoutAmountCents)) {
    throw new Error(`Existing affiliate payout ${payoutId} commission sum must be a safe integer amount in cents`);
  }
  if (payoutAmountCents !== expectedComponentPayoutAmountCents) {
    throw new Error(`Existing affiliate payout ${payoutId} payout_amount_cents must equal seller plus customer commission`);
  }
  assertAffiliatePayoutMethod(`Existing affiliate payout ${payoutId} payout_method`, payout.payout_method);
  const createdAt = assertValidDate(`Existing affiliate payout ${payoutId} created_at`, payout.created_at);
  let updatedAt: Date | undefined;
  if (payout.updated_at !== undefined && payout.updated_at !== null) {
    updatedAt = assertValidDate(`Existing affiliate payout ${payoutId} updated_at`, payout.updated_at);
  }
  let paidAt: Date | undefined;
  if (payout.paid_at !== undefined && payout.paid_at !== null) {
    paidAt = assertValidDate(`Existing affiliate payout ${payoutId} paid_at`, payout.paid_at);
  }
  if (payout.failure_reason !== undefined && payout.failure_reason !== null) {
    assertBoundedNonEmptyString(
      `Existing affiliate payout ${payoutId} failure_reason`,
      payout.failure_reason,
      MAX_AFFILIATE_PAYOUT_FAILURE_REASON_LENGTH
    );
  }
  let transactionId: string | undefined;
  if (payout.transaction_id !== undefined && payout.transaction_id !== null) {
    transactionId = assertBoundedNonEmptyString(
      `Existing affiliate payout ${payoutId} transaction_id`,
      payout.transaction_id,
      MAX_AFFILIATE_PAYOUT_TRANSACTION_ID_LENGTH
    );
  }
  if (status === 'paid' && (payout.paid_at === undefined || payout.paid_at === null)) {
    throw new Error(`Existing affiliate payout ${payoutId} paid status requires paid_at evidence`);
  }
  if (status === 'paid' && transactionId === undefined) {
    throw new Error(`Existing affiliate payout ${payoutId} paid status requires transaction_id evidence`);
  }
  if (status !== 'paid' && payout.paid_at !== undefined && payout.paid_at !== null) {
    throw new Error(`Existing affiliate payout ${payoutId} paid_at evidence cannot be present before paid status`);
  }
  if (status !== 'paid' && transactionId !== undefined) {
    throw new Error(`Existing affiliate payout ${payoutId} transaction_id evidence cannot be present before paid status`);
  }
  if (paidAt && paidAt < createdAt) {
    throw new Error(`Existing affiliate payout ${payoutId} paid_at evidence cannot be before payout creation`);
  }
  if (updatedAt && updatedAt < createdAt) {
    throw new Error(`Existing affiliate payout ${payoutId} updated_at evidence cannot be before payout creation`);
  }
  if (status === 'paid' && updatedAt && paidAt && updatedAt < paidAt) {
    throw new Error(`Existing affiliate payout ${payoutId} updated_at evidence cannot be before paid_at`);
  }
  if (status === 'failed' && (payout.failure_reason === undefined || payout.failure_reason === null)) {
    throw new Error(`Existing affiliate payout ${payoutId} failed status requires failure_reason evidence`);
  }
  if (status !== 'failed' && payout.failure_reason !== undefined && payout.failure_reason !== null) {
    throw new Error(`Existing affiliate payout ${payoutId} failure_reason evidence cannot be present before failed status`);
  }
}

function assertAffiliateClickDashboardRow(click: AffiliateClick, affiliateId: string, index: number): void {
  const label = `Affiliate click dashboard row ${index + 1}`;
  assertAffiliateClickRowEnvelope(label, click);
  const clickId = assertNonEmptyString(`${label} id`, click.id);
  const persistedAffiliateId = assertNonEmptyString(`${label} affiliate_id`, click.affiliate_id);
  if (persistedAffiliateId !== affiliateId) {
    throw new Error(`${label} affiliate_id must match dashboard affiliate`);
  }
  normalizeOptionalIpAddress(`${label} IP address`, click.ip_address);
  normalizeOptionalBoundedString(`${label} user_agent`, click.user_agent, 1024);
  normalizeOptionalHttpUrl(`${label} referrer_url`, click.referrer_url, 255);
  normalizeOptionalBoundedString(`${label} utm_source`, click.utm_source, 100);
  normalizeOptionalBoundedString(`${label} utm_medium`, click.utm_medium, 100);
  normalizeOptionalBoundedString(`${label} utm_campaign`, click.utm_campaign, 100);
  const converted = assertBoolean(`${label} converted`, click.converted);
  if (click.converted_user_id !== undefined && click.converted_user_id !== null) {
    assertNonEmptyString(`${label} converted_user_id`, click.converted_user_id);
  }
  const createdAt = assertValidDate(`${label} created_at`, click.created_at);
  let updatedAt: Date | undefined;
  if (click.updated_at !== undefined && click.updated_at !== null) {
    updatedAt = assertValidDate(`${label} updated_at`, click.updated_at);
  }
  let convertedAt: Date | undefined;
  if (click.converted_at !== undefined && click.converted_at !== null) {
    convertedAt = assertValidDate(`${label} converted_at`, click.converted_at);
  }
  if (updatedAt && updatedAt < createdAt) {
    throw new Error(`${label} updated_at cannot be before click ${clickId} was created`);
  }
  if (converted && !click.converted_user_id) {
    throw new Error(`${label} converted_user_id is required when click ${clickId} is converted`);
  }
  if (converted && !convertedAt) {
    throw new Error(`${label} converted_at is required when click ${clickId} is converted`);
  }
  if (!converted && click.converted_user_id !== undefined && click.converted_user_id !== null) {
    throw new Error(`${label} converted_user_id cannot be present before click ${clickId} is converted`);
  }
  if (!converted && click.converted_at !== undefined && click.converted_at !== null) {
    throw new Error(`${label} converted_at cannot be present before click ${clickId} is converted`);
  }
  if (convertedAt && convertedAt < createdAt) {
    throw new Error(`${label} converted_at cannot be before click ${clickId} was created`);
  }
  if (updatedAt && convertedAt && updatedAt < convertedAt) {
    throw new Error(`${label} updated_at cannot be before click ${clickId} was converted`);
  }
}

function assertUniqueAffiliateClickDashboardIds(clicks: AffiliateClick[], affiliateId: string): void {
  const seenClickIds = new Set<string>();
  clicks.forEach((click, index) => {
    const rowLabel = `Affiliate click dashboard row ${index + 1}`;
    const clickId = assertNonEmptyString(`${rowLabel} id`, click.id);
    if (seenClickIds.has(clickId)) {
      throw new Error(`${rowLabel} id must be unique for affiliate ${affiliateId}`);
    }
    seenClickIds.add(clickId);
  });
}

function assertAffiliateConversionClickRow(
  click: AffiliateClick,
  requestedClickId: string
): { affiliateId: string; converted: boolean; convertedUserId?: string } {
  assertAffiliateClickRowObject('Affiliate conversion click', click);
  const clickId = assertNonEmptyString('Affiliate conversion click id', click.id);
  if (clickId !== requestedClickId) {
    throw new Error('Affiliate conversion click id must match requested click');
  }
  assertAffiliateClickRowEnvelope(`Affiliate conversion click ${clickId}`, click);

  const affiliateId = assertNonEmptyString(`Affiliate conversion click ${clickId} affiliate_id`, click.affiliate_id);
  const converted = assertBoolean(`Affiliate conversion click ${clickId} converted`, click.converted);
  const convertedUserId = click.converted_user_id === undefined || click.converted_user_id === null
    ? undefined
    : assertNonEmptyString(`Affiliate conversion click ${clickId} converted_user_id`, click.converted_user_id);
  const createdAt = assertValidDate(`Affiliate conversion click ${clickId} created_at`, click.created_at);
  let updatedAt: Date | undefined;
  if (click.updated_at !== undefined && click.updated_at !== null) {
    updatedAt = assertValidDate(`Affiliate conversion click ${clickId} updated_at`, click.updated_at);
  }
  let convertedAt: Date | undefined;
  if (click.converted_at !== undefined && click.converted_at !== null) {
    convertedAt = assertValidDate(`Affiliate conversion click ${clickId} converted_at`, click.converted_at);
  }
  if (updatedAt && updatedAt < createdAt) {
    throw new Error(`Affiliate conversion click ${clickId} updated_at cannot be before created_at`);
  }
  if (converted && !convertedUserId) {
    throw new Error(`Affiliate conversion click ${clickId} converted_user_id is required when converted`);
  }
  if (converted && !convertedAt) {
    throw new Error(`Affiliate conversion click ${clickId} converted_at is required when converted`);
  }
  if (!converted && convertedUserId !== undefined) {
    throw new Error(`Affiliate conversion click ${clickId} converted_user_id cannot be present before converted`);
  }
  if (!converted && click.converted_at !== undefined && click.converted_at !== null) {
    throw new Error(`Affiliate conversion click ${clickId} converted_at cannot be present before converted`);
  }
  if (convertedAt && convertedAt < createdAt) {
    throw new Error(`Affiliate conversion click ${clickId} converted_at cannot be before created_at`);
  }
  if (updatedAt && convertedAt && updatedAt < convertedAt) {
    throw new Error(`Affiliate conversion click ${clickId} updated_at cannot be before converted_at`);
  }

  return { affiliateId, converted, convertedUserId };
}

function assertAffiliateConversionRelation(click: AffiliateClick, affiliateId: string): Affiliate {
  const affiliate = click.affiliate;
  if (!affiliate) {
    throw new Error('Affiliate click is missing affiliate relation');
  }

  const relationAffiliateId = assertNonEmptyString('Affiliate conversion click affiliate relation id', affiliate.id);
  assertAffiliateRowEnvelope(`Affiliate conversion relation ${relationAffiliateId}`, affiliate);
  if (relationAffiliateId !== affiliateId) {
    throw new Error('Affiliate conversion click affiliate relation id must match click affiliate_id');
  }
  assertNonEmptyString(
    `Affiliate conversion relation ${relationAffiliateId} user_id`,
    affiliate.user_id
  );

  return affiliate;
}

function assertAffiliateConversionCounters(
  affiliate: Affiliate
): { totalSignups: number; totalConversions: number } {
  const affiliateId = assertNonEmptyString('Affiliate conversion affiliate id', affiliate.id);
  assertAffiliateRowEnvelope(`Affiliate conversion affiliate ${affiliateId}`, affiliate);
  const totalSignups = asValidatedNonNegativeSafeInteger(
    `Total signups for affiliate ${affiliateId}`,
    affiliate.total_signups
  );
  const totalConversions = asValidatedNonNegativeSafeInteger(
    `Total conversions for affiliate ${affiliateId}`,
    affiliate.total_conversions
  );
  if (totalConversions > totalSignups) {
    throw new Error(`Total conversions for affiliate ${affiliateId} cannot exceed total signups`);
  }

  return { totalSignups, totalConversions };
}

function assertAffiliatePayoutCandidateRow(affiliate: Affiliate, index: number): string {
  const label = `Affiliate payout candidate row ${index + 1}`;
  assertAffiliateRowEnvelope(label, affiliate);
  const affiliateId = assertNonEmptyString(`${label} id`, affiliate.id);
  const status = assertAffiliateStatus(`${label} status`, affiliate.status);
  if (status !== 'approved') {
    throw new Error(`${label} status must match approved affiliate query for affiliate ${affiliateId}`);
  }
  return affiliateId;
}

function assertExistingAffiliateApplicationRow(affiliate: Affiliate, userId: string): void {
  const affiliateId = assertNonEmptyString('Existing affiliate application id', affiliate.id);
  assertAffiliateRowEnvelope(`Existing affiliate application ${affiliateId}`, affiliate);
  const persistedUserId = assertNonEmptyString(
    `Existing affiliate application ${affiliateId} user_id`,
    affiliate.user_id
  );
  if (persistedUserId !== userId) {
    throw new Error(`Existing affiliate application ${affiliateId} user_id must match requested user`);
  }
  assertAffiliateCode(
    `Existing affiliate application ${affiliateId} affiliate_code`,
    affiliate.affiliate_code
  );
  assertAffiliateStatus(`Existing affiliate application ${affiliateId} status`, affiliate.status);
}

function assertAffiliateCodeCollisionRow(affiliate: Affiliate, affiliateCode: string): void {
  const affiliateId = assertNonEmptyString('Existing affiliate code owner id', affiliate.id);
  assertAffiliateRowEnvelope(`Existing affiliate code owner ${affiliateId}`, affiliate);
  const persistedAffiliateCode = assertAffiliateCode(
    `Existing affiliate code owner ${affiliateId} affiliate_code`,
    affiliate.affiliate_code
  );
  if (persistedAffiliateCode !== affiliateCode) {
    throw new Error(`Existing affiliate code owner ${affiliateId} affiliate_code must match generated affiliate code`);
  }
  assertNonEmptyString(`Existing affiliate code owner ${affiliateId} user_id`, affiliate.user_id);
  assertAffiliateStatus(`Existing affiliate code owner ${affiliateId} status`, affiliate.status);
}

function assertAffiliateClickSourceRow(
  affiliate: Affiliate,
  requestedAffiliateCode: string
): { affiliateId: string; nextTotalClicks: number } {
  const affiliateId = assertNonEmptyString('Affiliate click source id', affiliate.id);
  assertAffiliateRowEnvelope(`Affiliate click source ${affiliateId}`, affiliate);
  const persistedAffiliateCode = assertAffiliateCode(
    `Affiliate click source ${affiliateId} affiliate_code`,
    affiliate.affiliate_code
  );
  if (persistedAffiliateCode !== requestedAffiliateCode) {
    throw new Error(`Affiliate click source ${affiliateId} affiliate_code must match requested affiliate code`);
  }

  const affiliateStatus = assertAffiliateStatus(`Affiliate ${affiliateId} status`, affiliate.status);
  if (affiliateStatus !== 'approved') {
    throw new Error('Affiliate is not approved');
  }

  return {
    affiliateId,
    nextTotalClicks: checkedIncrementCount(
      `Total clicks for affiliate ${affiliateId}`,
      affiliate.total_clicks
    ),
  };
}

function assertAffiliateCommissionSourceRow(
  affiliate: Affiliate,
  requestedAffiliateId: string
): { affiliateId: string; affiliateStatus: string } {
  const affiliateId = assertNonEmptyString('Affiliate commission source id', affiliate.id);
  assertAffiliateRowEnvelope(`Affiliate commission source ${affiliateId}`, affiliate);
  if (affiliateId !== requestedAffiliateId) {
    throw new Error(`Affiliate commission source ${affiliateId} id must match requested affiliate`);
  }

  return {
    affiliateId,
    affiliateStatus: assertAffiliateStatus(`Affiliate ${affiliateId} status`, affiliate.status),
  };
}

function assertAffiliateDashboardSourceRow(
  affiliate: Affiliate,
  requestedUserId: string
): string {
  const affiliateId = assertNonEmptyString('Affiliate dashboard source id', affiliate.id);
  assertAffiliateRowEnvelope(`Affiliate dashboard source ${affiliateId}`, affiliate);
  assertAffiliateCode(
    `Affiliate dashboard source ${affiliateId} affiliate_code`,
    affiliate.affiliate_code
  );
  assertAffiliateStatus(
    `Affiliate dashboard source ${affiliateId} status`,
    affiliate.status
  );
  const persistedUserId = assertNonEmptyString(
    `Affiliate dashboard source ${affiliateId} user_id`,
    affiliate.user_id
  );
  if (persistedUserId !== requestedUserId) {
    throw new Error(`Affiliate dashboard source ${affiliateId} user_id must match requested user`);
  }
  return affiliateId;
}

function assertReferralLeaderboardRowEnvelope(label: string, entry: ReferralLeaderboard): void {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    throw new Error(`${label} must be an object`);
  }

  const entryRecord = entry as unknown as Record<string, unknown>;
  const entryKeys = Object.keys(entryRecord);
  assertEnhancedReferralFieldNamesAreSafe(label, entryKeys);
  const unsupportedKeys = entryKeys.filter(
    (key) => !REFERRAL_LEADERBOARD_ROW_KEYS.has(key) && entryRecord[key] !== undefined
  );
  if (unsupportedKeys.length > 0) {
    throw new Error(`${label} include unsupported field(s): ${unsupportedKeys.sort().join(', ')}`);
  }
}

export function referralLeaderboardMonth(now: Date): string {
  const validNow = assertValidDate('Referral leaderboard clock', now);
  const year = validNow.getUTCFullYear();
  const month = String(validNow.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function startOfReferralLeaderboardMonth(now: Date): Date {
  const validNow = assertValidDate('Referral leaderboard clock', now);
  return new Date(Date.UTC(validNow.getUTCFullYear(), validNow.getUTCMonth(), 1, 0, 0, 0, 0));
}

export function rankReferralLeaderboardEntries<T extends Pick<ReferralLeaderboard, 'user_id' | 'successful_referrals'>>(
  entries: T[]
): Array<T & { rank: number }> {
  const validatedEntries = entries.map((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error(`Referral leaderboard entry row ${index + 1} must be an object`);
    }
    return Object.assign(entry, {
      user_id: assertNonEmptyString('Referral leaderboard entry user_id', entry.user_id),
      successful_referrals: asValidatedNonNegativeSafeInteger(
        `Successful referrals for leaderboard entry ${entry.user_id}`,
        entry.successful_referrals
      ),
    });
  });

  return validatedEntries
    .sort((left, right) => {
      const referralDelta = right.successful_referrals - left.successful_referrals;
      if (referralDelta !== 0) return referralDelta;
      return left.user_id.localeCompare(right.user_id);
    })
    .map((entry, index) => Object.assign(entry, { rank: index + 1 }));
}

function assertReferralLeaderboardRowsMatchMonth(
  entries: Array<Pick<ReferralLeaderboard, 'id' | 'month' | 'user_id'> & { user?: Pick<User, 'id'> | null }>,
  month: string,
  label: string
): void {
  const seenEntryIds = new Set<string>();
  const seenUserIds = new Set<string>();
  entries.forEach((entry, index) => {
    const rowLabel = `${label} row ${index + 1}`;
    assertReferralLeaderboardRowEnvelope(rowLabel, entry as ReferralLeaderboard);
    const entryId = normalizeOptionalString(`${rowLabel} id`, entry.id) ?? `#${index + 1}`;
    if (entryId !== `#${index + 1}`) {
      if (seenEntryIds.has(entryId)) {
        throw new Error(`${rowLabel} id must be unique for leaderboard month`);
      }
      seenEntryIds.add(entryId);
    }
    const entryMonth = assertYearMonth(`${rowLabel} month`, entry.month);
    if (entryMonth !== month) {
      throw new Error(`${rowLabel} month must match requested leaderboard month for entry ${entryId}`);
    }
    const entryUserId = assertNonEmptyString(`${rowLabel} user_id`, entry.user_id);
    if (seenUserIds.has(entryUserId)) {
      throw new Error(`${rowLabel} user_id must be unique for leaderboard month`);
    }
    seenUserIds.add(entryUserId);
    if (entry.user !== undefined && entry.user !== null) {
      const relationUserId = assertNonEmptyString(`${rowLabel} user relation id`, entry.user.id);
      if (relationUserId !== entryUserId) {
        throw new Error(`${rowLabel} user relation id must match leaderboard user_id for entry ${entryId}`);
      }
    }
  });
}

function assertReferralLeaderboardUpdateRow(
  entry: ReferralLeaderboard,
  userId: string,
  month: string
): void {
  const entryId = normalizeOptionalString('Referral leaderboard update row id', entry.id) ?? 'unknown';
  assertReferralLeaderboardRowEnvelope(`Referral leaderboard update row ${entryId}`, entry);
  const persistedUserId = assertNonEmptyString(
    `Referral leaderboard update row ${entryId} user_id`,
    entry.user_id
  );
  if (persistedUserId !== userId) {
    throw new Error(`Referral leaderboard update row ${entryId} user_id must match requested user`);
  }
  const persistedMonth = assertYearMonth(`Referral leaderboard update row ${entryId} month`, entry.month);
  if (persistedMonth !== month) {
    throw new Error(`Referral leaderboard update row ${entryId} month must match requested leaderboard month`);
  }
  asValidatedNonNegativeSafeInteger(
    `Successful referrals for leaderboard update row ${entryId}`,
    entry.successful_referrals
  );
}

function assertReferralLeaderboardPrizeState(
  entry: ReferralLeaderboard,
  expectedPrize: { rank: number; amount: number }
): void {
  const entryId = normalizeOptionalString('Referral leaderboard prize row id', entry.id) ?? entry.user_id;
  assertReferralLeaderboardRowEnvelope(`Referral leaderboard prize row ${entryId}`, entry);
  const prizePaid = assertBoolean(`Referral leaderboard prize row ${entryId} prize_paid`, entry.prize_paid);
  const prizeAmountCents = asValidatedNonNegativeCents(
    `Referral leaderboard prize row ${entryId} prize_amount_cents`,
    entry.prize_amount_cents
  );

  if (prizePaid) {
    if (prizeAmountCents !== expectedPrize.amount) {
      throw new Error(
        `Referral leaderboard prize row ${entryId} prize_amount_cents must match current prize amount`
      );
    }
    assertValidDate(`Referral leaderboard prize row ${entryId} prize_paid_at`, entry.prize_paid_at);
    return;
  }

  if (prizeAmountCents !== 0) {
    throw new Error(
      `Referral leaderboard prize row ${entryId} prize_amount_cents cannot be present before prize payment`
    );
  }
  if (entry.prize_paid_at !== undefined && entry.prize_paid_at !== null) {
    throw new Error(
      `Referral leaderboard prize row ${entryId} prize_paid_at cannot be present before prize payment`
    );
  }
}

export function buildReferralShareLink(referralCode: string): string {
  const normalizedCode = assertNonEmptyString('Referral code', referralCode).toUpperCase();
  if (normalizedCode.length > MAX_REFERRAL_SHARE_CODE_LENGTH) {
    throw new Error(`Referral code must be ${MAX_REFERRAL_SHARE_CODE_LENGTH} characters or less`);
  }
  const params = new URLSearchParams({ ref: normalizedCode });
  return `https://menumaker.app?${params.toString()}`;
}

function assertReferralShareBusinessName(value: unknown): string {
  const normalizedBusinessName = assertNonEmptyString('Referral share business name', value);
  if (normalizedBusinessName.length > MAX_REFERRAL_SHARE_BUSINESS_NAME_LENGTH) {
    throw new Error(
      `Referral share business name must be ${MAX_REFERRAL_SHARE_BUSINESS_NAME_LENGTH} characters or less`
    );
  }
  return normalizedBusinessName;
}

function assertEnhancedReferralsEnabled(enforceCapability: boolean): void {
  if (enforceCapability) {
    assertCapabilityEnabled('enhanced_referrals_affiliates');
  }
}

/**
 * LeaderboardService
 * Handles monthly referral leaderboard and prizes
 */
export class LeaderboardService {
  private leaderboardRepository: Repository<ReferralLeaderboard>;
  private referralRepository: Repository<Referral>;
  private userRepository: Repository<User>;
  private now: () => Date;
  private readonly enforceCapability: boolean;

  constructor(repositories: LeaderboardRepositoryOverrides = {}) {
    this.leaderboardRepository = repositories.leaderboardRepository ?? AppDataSource.getRepository(ReferralLeaderboard);
    this.referralRepository = repositories.referralRepository ?? AppDataSource.getRepository(Referral);
    this.userRepository = repositories.userRepository ?? AppDataSource.getRepository(User);
    this.now = repositories.now ?? (() => new Date());
    this.enforceCapability = repositories.enforceCapability !== false;
  }

  /**
   * Update leaderboard for current month
   */
  async updateLeaderboard(userId: string): Promise<void> {
    assertEnhancedReferralsEnabled(this.enforceCapability);
    const normalizedUserId = assertNonEmptyString('Referral leaderboard user_id', userId);

    const now = this.getCurrentTime();
    const currentMonth = referralLeaderboardMonth(now);

    // Count successful referrals this month
    const startOfMonth = startOfReferralLeaderboardMonth(now);

    const successfulReferrals = await this.referralRepository.count({
      where: {
        referrer_id: normalizedUserId,
        status: 'first_menu_published',
        first_menu_published_at: MoreThan(startOfMonth),
      },
    });
    const validatedSuccessfulReferrals = asValidatedNonNegativeSafeInteger(
      `Successful referrals for user ${normalizedUserId}`,
      successfulReferrals
    );

    // Update or create leaderboard entry
    let entry = await this.leaderboardRepository.findOne({
      where: { user_id: normalizedUserId, month: currentMonth },
    });

    if (entry) {
      assertReferralLeaderboardUpdateRow(entry, normalizedUserId, currentMonth);
      entry.successful_referrals = validatedSuccessfulReferrals;
      await this.leaderboardRepository.save(entry);
    } else {
      entry = this.leaderboardRepository.create({
        user_id: normalizedUserId,
        month: currentMonth,
        successful_referrals: validatedSuccessfulReferrals,
      });
      await this.leaderboardRepository.save(entry);
    }
  }

  /**
   * Get top referrers for current month
   */
  async getTopReferrers(limit: number = 10): Promise<ReferralLeaderboard[]> {
    assertEnhancedReferralsEnabled(this.enforceCapability);

    const currentMonth = this.getCurrentMonth();
    const take = asValidatedPositiveSafeInteger('Leaderboard limit', limit);

    const leaderboard = await this.leaderboardRepository.find({
      where: { month: currentMonth },
      relations: ['user'],
      order: { successful_referrals: 'DESC' },
      take,
    });

    assertReferralLeaderboardRowsMatchMonth(leaderboard, currentMonth, 'Referral leaderboard');
    return rankReferralLeaderboardEntries(leaderboard).slice(0, take);
  }

  /**
   * Get user's leaderboard position
   */
  async getUserPosition(userId: string): Promise<{
    rank: number | null;
    successful_referrals: number;
    total_participants: number;
  }> {
    assertEnhancedReferralsEnabled(this.enforceCapability);
    const normalizedUserId = assertNonEmptyString('Referral leaderboard user_id', userId);

    const currentMonth = this.getCurrentMonth();

    const leaderboard = await this.leaderboardRepository.find({
      where: { month: currentMonth },
      order: { successful_referrals: 'DESC' },
    });
    assertReferralLeaderboardRowsMatchMonth(leaderboard, currentMonth, 'Referral leaderboard');
    const allEntries = rankReferralLeaderboardEntries(leaderboard);

    const userEntry = allEntries.find((e) => e.user_id === normalizedUserId);

    if (!userEntry) {
      return {
        rank: null,
        successful_referrals: 0,
        total_participants: allEntries.length,
      };
    }

    const rank = allEntries.findIndex((e) => e.user_id === normalizedUserId) + 1;

    return {
      rank,
      successful_referrals: userEntry.successful_referrals,
      total_participants: allEntries.length,
    };
  }

  /**
   * Distribute launch-gated campaign prizes when enhanced referrals are enabled (cron job)
   */
  async distributePrizes(month: string): Promise<number> {
    assertEnhancedReferralsEnabled(this.enforceCapability);
    const normalizedMonth = assertYearMonth('Referral leaderboard prize month', month);
    const paidAt = this.getCurrentTime();

    const leaderboardRows = await this.leaderboardRepository.find({
      where: { month: normalizedMonth },
      order: { successful_referrals: 'DESC' },
      take: 3, // Top 3 winners
    });
    assertReferralLeaderboardRowsMatchMonth(leaderboardRows, normalizedMonth, 'Referral leaderboard prize');
    const leaderboard = rankReferralLeaderboardEntries(leaderboardRows).slice(0, 3);

    if (leaderboard.length === 0) return 0;

    const prizes = [
      { rank: 1, amount: 500000 }, // Rs. 5,000
      { rank: 2, amount: 300000 }, // Rs. 3,000
      { rank: 3, amount: 200000 }, // Rs. 2,000
    ];
    let processed = 0;

    for (let i = 0; i < leaderboard.length; i++) {
      const entry = leaderboard[i];
      const prize = prizes[i];
      assertReferralLeaderboardPrizeState(entry, prize);

      if (!entry.prize_paid) {
        entry.rank = prize.rank;
        entry.prize_amount_cents = prize.amount;
        entry.prize_paid = true;
        entry.prize_paid_at = paidAt;

        await this.leaderboardRepository.save(entry);

        entry.prize_paid_at = entry.prize_paid_at || paidAt;
        processed++;
      }
    }

    return processed;
  }

  /**
   * Get current month in YYYY-MM format
   */
  private getCurrentMonth(): string {
    return referralLeaderboardMonth(this.getCurrentTime());
  }

  private getCurrentTime(): Date {
    return assertValidDate('Referral leaderboard clock', this.now());
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
  private readonly enforceCapability: boolean;

  constructor(repositories: AffiliateRepositoryOverrides = {}) {
    this.affiliateRepository = repositories.affiliateRepository ?? AppDataSource.getRepository(Affiliate);
    this.clickRepository = repositories.clickRepository ?? AppDataSource.getRepository(AffiliateClick);
    this.payoutRepository = repositories.payoutRepository ?? AppDataSource.getRepository(AffiliatePayout);
    this.userRepository = repositories.userRepository ?? AppDataSource.getRepository(User);
    this.enforceCapability = repositories.enforceCapability !== false;
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
    assertEnhancedReferralsEnabled(this.enforceCapability);

    const normalizedUserId = assertNonEmptyString('Affiliate application user_id', userId);
    const normalizedApplicationData = normalizeAffiliateApplicationData(data);

    // Check if user already has an affiliate application
    const existing = await this.affiliateRepository.findOne({
      where: { user_id: normalizedUserId },
    });

    if (existing) {
      assertExistingAffiliateApplicationRow(existing, normalizedUserId);
      throw new Error('Affiliate application already exists');
    }

    // Generate unique affiliate code
    const user = await this.userRepository.findOne({ where: { id: normalizedUserId } });
    if (!user) throw new Error('User not found');
    const affiliateCodeSource = assertUserLookupSourceRow(
      user,
      normalizedUserId,
      'Affiliate application user row'
    );

    const affiliateCode = this.generateAffiliateCode(affiliateCodeSource);
    const existingWithCode = await this.affiliateRepository.findOne({
      where: { affiliate_code: affiliateCode },
    });
    if (existingWithCode) {
      assertAffiliateCodeCollisionRow(existingWithCode, affiliateCode);
      throw new Error('Generated affiliate code already exists');
    }

    // Create affiliate application
    const affiliate = this.affiliateRepository.create({
      user_id: normalizedUserId,
      affiliate_code: affiliateCode,
      status: 'pending',
      application_message: normalizedApplicationData.application_message,
      ...(normalizedApplicationData.instagram_handle === undefined
        ? {}
        : { instagram_handle: normalizedApplicationData.instagram_handle }),
      ...(normalizedApplicationData.instagram_followers === undefined
        ? {}
        : { instagram_followers: normalizedApplicationData.instagram_followers }),
      ...(normalizedApplicationData.youtube_channel === undefined
        ? {}
        : { youtube_channel: normalizedApplicationData.youtube_channel }),
      ...(normalizedApplicationData.youtube_subscribers === undefined
        ? {}
        : { youtube_subscribers: normalizedApplicationData.youtube_subscribers }),
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
    assertEnhancedReferralsEnabled(this.enforceCapability);
    const normalizedAffiliateId = assertNonEmptyString('Affiliate id', affiliateId);
    const normalizedApprovedById = assertNonEmptyString('Affiliate approved_by_id', approvedById);
    const normalizedCustomRates = normalizeAffiliateApprovalCustomRates(customRates);

    const affiliate = await this.affiliateRepository.findOne({
      where: { id: normalizedAffiliateId },
    });

    if (!affiliate) throw new Error('Affiliate not found');

    const persistedAffiliateId = assertNonEmptyString('Persisted affiliate id', affiliate.id);
    assertAffiliateRowEnvelope(`Affiliate approval source ${persistedAffiliateId}`, affiliate);
    if (persistedAffiliateId !== normalizedAffiliateId) {
      throw new Error('Persisted affiliate id must match requested affiliate');
    }

    const currentStatus = assertAffiliateStatus(`Affiliate ${affiliate.id} status`, affiliate.status);
    if (currentStatus !== 'pending') {
      throw new Error('Affiliate must be pending before approval');
    }
    const normalizedAffiliateCode = assertAffiliateCode(
      `Affiliate ${persistedAffiliateId} affiliate_code`,
      affiliate.affiliate_code
    );
    const qrPayload = this.buildAffiliateQrPayload(affiliate);
    assertAffiliateQrPayload(qrPayload, {
      affiliateId: persistedAffiliateId,
      affiliateCode: normalizedAffiliateCode,
    });

    affiliate.status = 'approved';
    affiliate.affiliate_code = normalizedAffiliateCode;
    affiliate.approved_by_id = normalizedApprovedById;
    affiliate.approved_at = new Date();
    affiliate.rejection_reason = null;

    if (normalizedCustomRates?.seller_commission_rate !== undefined) {
      affiliate.seller_commission_rate = normalizedCustomRates.seller_commission_rate;
    }

    if (normalizedCustomRates?.customer_commission_rate !== undefined) {
      affiliate.customer_commission_rate = normalizedCustomRates.customer_commission_rate;
    }

    affiliate.qr_code_data = qrPayload;
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
    } = {}
  ): Promise<AffiliateClick> {
    assertEnhancedReferralsEnabled(this.enforceCapability);
    const normalizedAffiliateCode = assertNonEmptyString('Affiliate code', affiliateCode);
    const normalizedMetadata = normalizeAffiliateClickMetadata(metadata);

    const affiliate = await this.affiliateRepository.findOne({
      where: { affiliate_code: normalizedAffiliateCode },
    });

    if (!affiliate) throw new Error('Affiliate not found');
    const { affiliateId, nextTotalClicks } = assertAffiliateClickSourceRow(
      affiliate,
      normalizedAffiliateCode
    );

    // Create click record
    const click = this.clickRepository.create({
      affiliate_id: affiliateId,
      ...(normalizedMetadata.ip_address === undefined ? {} : { ip_address: normalizedMetadata.ip_address }),
      ...(normalizedMetadata.user_agent === undefined ? {} : { user_agent: normalizedMetadata.user_agent }),
      ...(normalizedMetadata.referrer_url === undefined ? {} : { referrer_url: normalizedMetadata.referrer_url }),
      ...(normalizedMetadata.utm_source === undefined ? {} : { utm_source: normalizedMetadata.utm_source }),
      ...(normalizedMetadata.utm_medium === undefined ? {} : { utm_medium: normalizedMetadata.utm_medium }),
      ...(normalizedMetadata.utm_campaign === undefined ? {} : { utm_campaign: normalizedMetadata.utm_campaign }),
    });

    await this.clickRepository.save(click);

    // Update affiliate stats
    affiliate.total_clicks = nextTotalClicks;
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
    assertEnhancedReferralsEnabled(this.enforceCapability);
    const normalizedClickId = assertNonEmptyString('Affiliate click id', clickId);
    const normalizedConvertedUserId = assertNonEmptyString('Affiliate converted_user_id', convertedUserId);

    const click = await this.clickRepository.findOne({
      where: { id: normalizedClickId },
      relations: ['affiliate'],
    });

    if (!click) throw new Error('Click not found');
    const {
      affiliateId,
      converted,
      convertedUserId: persistedConvertedUserId,
    } = assertAffiliateConversionClickRow(click, normalizedClickId);
    const affiliate = assertAffiliateConversionRelation(click, affiliateId);
    const affiliateStatus = assertAffiliateStatus(`Affiliate ${affiliate.id} status`, affiliate.status);
    if (affiliateStatus !== 'approved') {
      throw new Error('Affiliate is not approved');
    }
    const { totalSignups, totalConversions } = assertAffiliateConversionCounters(affiliate);
    if (converted) {
      if (persistedConvertedUserId && persistedConvertedUserId !== normalizedConvertedUserId) {
        throw new Error('Click already converted by a different user');
      }
      return;
    }

    const nextTotalSignups = checkedIncrementCount(
      `Total signups for affiliate ${affiliate.id}`,
      totalSignups
    );
    const nextTotalConversions = checkedIncrementCount(
      `Total conversions for affiliate ${affiliate.id}`,
      totalConversions
    );

    click.converted = true;
    click.converted_user_id = normalizedConvertedUserId;
    click.converted_at = new Date();

    await this.clickRepository.save(click);

    // Update affiliate stats
    affiliate.total_signups = nextTotalSignups;
    affiliate.total_conversions = nextTotalConversions;

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
    assertEnhancedReferralsEnabled(this.enforceCapability);
    const normalizedAffiliateId = assertNonEmptyString('Affiliate commission affiliate_id', affiliateId);
    const commissionType = assertAffiliateCommissionType('Affiliate commission type', type);

    const affiliate = await this.affiliateRepository.findOne({
      where: { id: normalizedAffiliateId },
    });

    if (!affiliate) return 0;
    const { affiliateId: persistedAffiliateId, affiliateStatus } = assertAffiliateCommissionSourceRow(
      affiliate,
      normalizedAffiliateId
    );
    const totalGmvCents = asValidatedNonNegativeCents(
      `Total GMV for affiliate ${persistedAffiliateId}`,
      affiliate.total_gmv_cents
    );
    const totalCommissionEarnedCents = asValidatedNonNegativeCents(
      `Total commission earned for affiliate ${persistedAffiliateId}`,
      affiliate.total_commission_earned_cents
    );
    const totalCommissionPaidCents = asValidatedNonNegativeCents(
      `Total commission paid for affiliate ${persistedAffiliateId}`,
      affiliate.total_commission_paid_cents
    );
    const pendingCommissionCents = asValidatedNonNegativeCents(
      `Pending commission for affiliate ${persistedAffiliateId}`,
      affiliate.pending_commission_cents
    );
    assertAffiliateEarnedCommissionWithinGmv(
      persistedAffiliateId,
      totalGmvCents,
      totalCommissionEarnedCents
    );
    if (totalCommissionPaidCents > totalCommissionEarnedCents) {
      throw new Error(`Total commission paid for affiliate ${persistedAffiliateId} cannot exceed total commission earned`);
    }
    if (pendingCommissionCents > totalCommissionEarnedCents - totalCommissionPaidCents) {
      throw new Error(`Pending commission for affiliate ${persistedAffiliateId} cannot exceed unpaid earned commission`);
    }
    if (affiliateStatus !== 'approved') return 0;

    const rate =
      commissionType === 'seller'
        ? asValidatedCommissionRate(`Seller commission rate for affiliate ${persistedAffiliateId}`, affiliate.seller_commission_rate)
        : asValidatedCommissionRate(`Customer commission rate for affiliate ${persistedAffiliateId}`, affiliate.customer_commission_rate);

    const commissionCents = calculateAffiliateCommissionCents(gmvCents, rate);

    // Update affiliate stats
    affiliate.total_gmv_cents = checkedAddCents(
      `Total GMV for affiliate ${persistedAffiliateId}`,
      totalGmvCents,
      gmvCents
    );
    affiliate.total_commission_earned_cents = checkedAddCents(
      `Total commission earned for affiliate ${persistedAffiliateId}`,
      totalCommissionEarnedCents,
      commissionCents
    );
    affiliate.pending_commission_cents = checkedAddCents(
      `Pending commission for affiliate ${persistedAffiliateId}`,
      pendingCommissionCents,
      commissionCents
    );

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
    assertEnhancedReferralsEnabled(this.enforceCapability);
    const normalizedUserId = assertNonEmptyString('Affiliate dashboard user_id', userId);

    const affiliate = await this.affiliateRepository.findOne({
      where: { user_id: normalizedUserId },
    });

    if (!affiliate) throw new Error('Affiliate not found');
    const affiliateId = assertAffiliateDashboardSourceRow(affiliate, normalizedUserId);

    const totalClicks = asValidatedNonNegativeSafeInteger(
      `Total clicks for affiliate ${affiliateId}`,
      affiliate.total_clicks
    );
    const totalSignups = asValidatedNonNegativeSafeInteger(
      `Total signups for affiliate ${affiliateId}`,
      affiliate.total_signups
    );
    const totalConversions = asValidatedNonNegativeSafeInteger(
      `Total conversions for affiliate ${affiliateId}`,
      affiliate.total_conversions
    );
    if (totalSignups > totalClicks) {
      throw new Error(`Total signups for affiliate ${affiliateId} cannot exceed total clicks`);
    }
    if (totalConversions > totalClicks) {
      throw new Error(`Total conversions for affiliate ${affiliateId} cannot exceed total clicks`);
    }
    if (totalConversions > totalSignups) {
      throw new Error(`Total conversions for affiliate ${affiliateId} cannot exceed total signups`);
    }
    const totalGmvCents = asValidatedNonNegativeCents(`Total GMV for affiliate ${affiliateId}`, affiliate.total_gmv_cents);
    const totalCommissionEarnedCents = asValidatedNonNegativeCents(
      `Total commission earned for affiliate ${affiliateId}`,
      affiliate.total_commission_earned_cents
    );
    const totalCommissionPaidCents = asValidatedNonNegativeCents(
      `Total commission paid for affiliate ${affiliateId}`,
      affiliate.total_commission_paid_cents
    );
    const pendingCommissionCents = asValidatedNonNegativeCents(
      `Pending commission for affiliate ${affiliateId}`,
      affiliate.pending_commission_cents
    );
    assertAffiliateEarnedCommissionWithinGmv(
      affiliateId,
      totalGmvCents,
      totalCommissionEarnedCents
    );
    if (totalCommissionPaidCents > totalCommissionEarnedCents) {
      throw new Error(`Total commission paid for affiliate ${affiliateId} cannot exceed total commission earned`);
    }
    if (pendingCommissionCents > totalCommissionEarnedCents - totalCommissionPaidCents) {
      throw new Error(`Pending commission for affiliate ${affiliateId} cannot exceed unpaid earned commission`);
    }

    // Get recent clicks
    const recentClicks = await this.clickRepository.find({
      where: { affiliate_id: affiliateId },
      order: { created_at: 'DESC' },
      take: 10,
    });
    recentClicks.forEach((click, index) =>
      assertAffiliateClickDashboardRow(click, affiliateId, index)
    );
    assertUniqueAffiliateClickDashboardIds(recentClicks, affiliateId);

    // Get recent payouts
    const recentPayouts = await this.payoutRepository.find({
      where: { affiliate_id: affiliateId },
      order: { created_at: 'DESC' },
      take: 10,
    });
    recentPayouts.forEach((payout, index) =>
      assertAffiliatePayoutDashboardRow(payout, affiliateId, index)
    );
    assertUniqueAffiliatePayoutDashboardIds(recentPayouts, affiliateId);
    assertUniqueAffiliatePayoutDashboardMonths(recentPayouts, affiliateId);
    assertUniqueAffiliatePayoutDashboardTransactionIds(recentPayouts, affiliateId);

    const conversionRate =
      totalClicks > 0
        ? (totalConversions / totalClicks) * 100
        : 0;

    return {
      affiliate,
      stats: {
        total_clicks: totalClicks,
        total_signups: totalSignups,
        total_conversions: totalConversions,
        conversion_rate: Math.round(conversionRate * 100) / 100,
        total_gmv: totalGmvCents / 100,
        total_commission_earned: totalCommissionEarnedCents / 100,
        total_commission_paid: totalCommissionPaidCents / 100,
        pending_commission: pendingCommissionCents / 100,
      },
      recent_clicks: recentClicks,
      recent_payouts: recentPayouts,
    };
  }

  /**
   * Process monthly payouts (cron job)
   */
  async processMonthlyPayouts(month: string): Promise<number> {
    assertEnhancedReferralsEnabled(this.enforceCapability);
    const payoutMonth = assertYearMonth('Affiliate payout month', month);

    const affiliates = await this.affiliateRepository.find({
      where: { status: 'approved' },
    });

    const payoutCandidates = affiliates.map((affiliate, index) => {
      const affiliateId = assertAffiliatePayoutCandidateRow(affiliate, index);
      const pendingCommissionCents = asValidatedNonNegativeCents(
        `Pending commission for affiliate ${affiliateId}`,
        affiliate.pending_commission_cents
      );
      const totalCommissionEarnedCents = asValidatedNonNegativeCents(
        `Total commission earned for affiliate ${affiliateId}`,
        affiliate.total_commission_earned_cents
      );
      const totalCommissionPaidCents = asValidatedNonNegativeCents(
        `Total commission paid for affiliate ${affiliateId}`,
        affiliate.total_commission_paid_cents
      );
      if (totalCommissionPaidCents > totalCommissionEarnedCents) {
        throw new Error(`Total commission paid for affiliate ${affiliateId} cannot exceed total commission earned`);
      }
      if (pendingCommissionCents > totalCommissionEarnedCents - totalCommissionPaidCents) {
        throw new Error(`Pending commission for affiliate ${affiliateId} cannot exceed unpaid earned commission`);
      }
      const minimumPayoutCents = asValidatedNonNegativeCents(
        `Minimum payout for affiliate ${affiliateId}`,
        affiliate.min_payout_cents
      );
      const isEligible = pendingCommissionCents >= minimumPayoutCents && pendingCommissionCents !== 0;
      const payoutMethod = isEligible
        ? assertAffiliatePayoutMethod(`Payout method for affiliate ${affiliateId}`, affiliate.payout_method)
        : undefined;

      return {
        affiliate,
        affiliateId,
        pendingCommissionCents,
        payoutMethod,
        isEligible,
      };
    });

    let processed = 0;

    for (const { affiliate, affiliateId, pendingCommissionCents, payoutMethod, isEligible } of payoutCandidates) {
      if (!isEligible) {
        continue;
      }

      const existingPayout = await this.payoutRepository.findOne({
        where: { affiliate_id: affiliateId, payout_month: payoutMonth },
      });
      if (existingPayout) {
        assertExistingAffiliateMonthlyPayoutRow(
          existingPayout,
          affiliateId,
          payoutMonth,
          pendingCommissionCents
        );
        continue;
      }

      // Create payout record
      const payout = this.payoutRepository.create({
        affiliate_id: affiliateId,
        payout_month: payoutMonth,
        payout_amount_cents: pendingCommissionCents,
        seller_referrals_count: 0,
        seller_gmv_cents: 0,
        seller_commission_cents: pendingCommissionCents,
        customer_referrals_count: 0,
        customer_gmv_cents: 0,
        customer_commission_cents: 0,
        status: 'pending',
        payout_method: payoutMethod!,
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

  private buildAffiliateQrPayload(affiliate: Affiliate): string {
    const affiliateId = assertNonEmptyString('Affiliate QR affiliate_id', affiliate.id);
    const affiliateCode = assertAffiliateCode('Affiliate QR affiliate_code', affiliate.affiliate_code);
    return Buffer.from(JSON.stringify({
      type: 'affiliate_referral',
      affiliate_id: affiliateId,
      code: affiliateCode,
      destination: `https://menumaker.app/ref/${affiliateCode}`,
    })).toString('base64url');
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
  private orderRepository: Repository<Order>;
  private readonly enforceCapability: boolean;
  private static rewardLedger = new Map<string, ReferralRewardLedgerEntry[]>();
  private static rewardLocks = new Map<string, Promise<ReferralRewardClaimResult>>();
  private static rewardDependencies: ReferralRewardDependencies = {};

  constructor(options: ViralServiceOptions = {}) {
    this.customerReferralRepository = AppDataSource.getRepository(CustomerReferral);
    this.badgeRepository = AppDataSource.getRepository(ViralBadge);
    this.userRepository = AppDataSource.getRepository(User);
    this.orderRepository = options.orderRepository || AppDataSource.getRepository(Order);
    this.enforceCapability = options.enforceCapability !== false;
  }

  static setRewardDependenciesForTesting(dependencies: ReferralRewardDependencies) {
    this.rewardDependencies = dependencies;
  }

  static getRewardLedgerForTesting(referralId: string): ReferralRewardLedgerEntry[] {
    return this.rewardLedger.get(referralId) || [];
  }

  /**
   * Create customer referral code
   */
  async createCustomerReferral(
    userId: string,
    businessId: string
  ): Promise<CustomerReferral> {
    assertEnhancedReferralsEnabled(this.enforceCapability);
    const normalizedUserId = assertNonEmptyString('Customer referral user_id', userId);
    const normalizedBusinessId = assertNonEmptyString('Customer referral business_id', businessId);

    const user = await this.userRepository.findOne({ where: { id: normalizedUserId } });
    if (!user) throw new Error('User not found');
    const referralCodeSource = assertUserLookupSourceRow(
      user,
      normalizedUserId,
      'Customer referral user row'
    );

    const referralCode = this.generateCustomerReferralCode(referralCodeSource);

    const referral = this.customerReferralRepository.create({
      business_id: normalizedBusinessId,
      referrer_id: normalizedUserId,
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
    assertEnhancedReferralsEnabled(this.enforceCapability);
    const normalizedReferralCode = assertNonEmptyString('Customer referral code', referralCode);
    const normalizedRefereeId = assertNonEmptyString('Customer referral referee_id', refereeId);
    const normalizedOrderId = assertNonEmptyString('Customer referral order_id', orderId);

    const referral = await this.customerReferralRepository.findOne({
      where: { referral_code: normalizedReferralCode },
    });

    if (!referral) throw new Error('Referral code not found');
    assertCustomerReferralRowObject('Customer referral', referral);
    const persistedReferralId = assertNonEmptyString('Customer referral id', referral.id);
    assertCustomerReferralRowEnvelope(`Customer referral ${persistedReferralId}`, referral);
    const persistedBusinessId = assertNonEmptyString(
      `Customer referral ${persistedReferralId} business_id`,
      referral.business_id
    );
    const persistedReferralCode = assertNonEmptyString(
      `Customer referral ${persistedReferralId} referral_code`,
      referral.referral_code
    );
    if (persistedReferralCode !== normalizedReferralCode) {
      throw new Error(`Customer referral ${persistedReferralId} referral_code must match requested referral code`);
    }
    const referralStatus = assertCustomerReferralStatus(`Customer referral ${persistedReferralId} status`, referral.status);
    const persistedReferrerId = assertNonEmptyString(
      `Customer referral ${persistedReferralId} referrer_id`,
      referral.referrer_id
    );
    if (persistedReferrerId === normalizedRefereeId) {
      throw new Error('Self-referrals cannot be linked to orders');
    }
    const existingRefereeId =
      referral.referee_id === undefined || referral.referee_id === null
        ? undefined
        : assertNonEmptyString(`Customer referral ${persistedReferralId} referee_id`, referral.referee_id);
    const existingOrderId =
      referral.referee_order_id === undefined || referral.referee_order_id === null
        ? undefined
        : assertNonEmptyString(
            `Customer referral ${persistedReferralId} referee_order_id`,
            referral.referee_order_id
          );

    if (referralStatus === 'reward_claimed') {
      throw new Error(`Customer referral ${persistedReferralId} already has claimed rewards`);
    }
    if (referralStatus === 'order_placed') {
      if (existingRefereeId === normalizedRefereeId && existingOrderId === normalizedOrderId) {
        const existingOrder = await this.orderRepository.findOne({ where: { id: normalizedOrderId } });
        if (!existingOrder) throw new Error('Customer referral order not found');
        assertCustomerReferralOrderSource(existingOrder, {
          orderId: normalizedOrderId,
          businessId: persistedBusinessId,
          refereeId: normalizedRefereeId,
        });
        return referral;
      }
      throw new Error(`Customer referral ${persistedReferralId} already has a linked order`);
    }
    if (existingRefereeId !== undefined || existingOrderId !== undefined) {
      throw new Error(`Customer referral ${persistedReferralId} has inconsistent order tracking state`);
    }

    const order = await this.orderRepository.findOne({ where: { id: normalizedOrderId } });
    if (!order) throw new Error('Customer referral order not found');
    assertCustomerReferralOrderSource(order, {
      orderId: normalizedOrderId,
      businessId: persistedBusinessId,
      refereeId: normalizedRefereeId,
    });

    referral.referee_id = normalizedRefereeId;
    referral.referee_order_id = normalizedOrderId;
    referral.status = 'order_placed';
    referral.order_placed_at = new Date();

    await this.customerReferralRepository.save(referral);

    return referral;
  }

  /**
   * Claim referral rewards
   */
  async claimReferralRewards(referralId: string): Promise<ReferralRewardClaimResult> {
    assertEnhancedReferralsEnabled(this.enforceCapability);
    const normalizedReferralId = assertNonEmptyString('Customer referral id', referralId);

    const existingLock = ViralService.rewardLocks.get(normalizedReferralId);
    if (existingLock) return existingLock;

    const claim = (async () => {
      const referral = await this.customerReferralRepository.findOne({
        where: { id: normalizedReferralId },
      });

      if (!referral) throw new Error('Referral not found');
      const validatedReferral = assertRewardClaimReferralRow(referral, normalizedReferralId);
      if (validatedReferral.referrerRewardClaimed && validatedReferral.refereeRewardClaimed) {
        return {
          status: 'already_claimed' as const,
          ledger_entries: ViralService.rewardLedger.get(validatedReferral.id) || [],
          coupons: [],
          notifications: [],
        };
      }
      if (validatedReferral.status !== 'order_placed') {
        throw new Error('Order not placed yet');
      }
      if (!validatedReferral.refereeId) {
        throw new Error('Referral is missing referee');
      }
      if (validatedReferral.refereeId === validatedReferral.referrerId) {
        throw new Error('Self-referrals cannot claim rewards');
      }
      const rewardValueCents = validatedReferral.rewardValueCents;

      const now = assertValidDate('Referral reward clock', ViralService.rewardDependencies.now?.() || new Date());
      const validUntil = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
      const couponService = ViralService.rewardDependencies.couponService || new CouponService();
      const participants = [
        { role: 'referrer' as const, user_id: validatedReferral.referrerId },
        { role: 'referee' as const, user_id: validatedReferral.refereeId },
      ];
      const rewardIntents = participants.map((participant) => {
        const couponCode = this.rewardCouponCode(validatedReferral.referralCode, participant.role);
        return {
          participant,
          couponCode,
          notificationParams: this.rewardNotificationIntent({
            referralId: validatedReferral.id,
            participantUserId: participant.user_id,
            role: participant.role,
            couponCode,
            rewardValueCents,
          }),
        };
      });

      await this.assertReferralRewardNotificationDedupeEvidence(
        rewardIntents.map(({ notificationParams }) => notificationParams)
      );

      const coupons: Coupon[] = [];
      const ledgerEntries: ReferralRewardLedgerEntry[] = [];
      const notifications: NotificationOutbox[] = [];

      for (const { participant, couponCode, notificationParams } of rewardIntents) {
        const coupon = await couponService.createCoupon(validatedReferral.businessId, {
          code: couponCode,
          name: `Referral reward for ${participant.role}`,
          description: `₹${rewardValueCents / 100} referral reward`,
          discount_type: 'fixed',
          discount_value: rewardValueCents,
          valid_from: now,
          valid_until: validUntil,
          usage_limit_type: 'per_customer',
          usage_limit_per_customer: 1,
          total_usage_limit: 1,
          applicable_to: 'all_dishes',
          is_public: false,
        });
        coupons.push(coupon);

        ledgerEntries.push({
          id: this.rewardLedgerId(validatedReferral.id, participant.role, rewardValueCents),
          referral_id: validatedReferral.id,
          user_id: participant.user_id,
          role: participant.role,
          credit_cents: rewardValueCents,
          coupon_code: couponCode,
          created_at: now.toISOString(),
        });

        const notification = await this.enqueueReferralRewardNotification(notificationParams);
        notifications.push(notification);
      }

      referral.referrer_reward_claimed = true;
      referral.referee_reward_claimed = true;
      referral.reward_claimed_at = now;
      referral.status = 'reward_claimed';

      await this.customerReferralRepository.save(referral);
      ViralService.rewardLedger.set(validatedReferral.id, ledgerEntries);

      return {
        status: 'claimed' as const,
        ledger_entries: ledgerEntries,
        coupons,
        notifications,
      };
    })().finally(() => ViralService.rewardLocks.delete(normalizedReferralId));

    ViralService.rewardLocks.set(normalizedReferralId, claim);
    return claim;
  }

  /**
   * Get customer referral stats
   */
  async getCustomerReferralStats(userId: string): Promise<{
    total_referrals: number;
    successful_referrals: number;
    total_rewards_earned: number;
  }> {
    assertEnhancedReferralsEnabled(this.enforceCapability);
    const normalizedUserId = assertNonEmptyString('Customer referral stats user_id', userId);

    const referrals = await this.customerReferralRepository.find({
      where: { referrer_id: normalizedUserId },
    });

    const validatedReferrals = referrals.map((referral, index) =>
      assertCustomerReferralStatsRow(referral, normalizedUserId, index + 1)
    );
    assertUniqueCustomerReferralStatsIds(validatedReferrals, normalizedUserId);

    const successfulReferrals = validatedReferrals.filter(
      (r) => r.status === 'reward_claimed'
    );

    const totalRewards = successfulReferrals.reduce(
      (sum, referral) => sum + referral.rewardValueCents,
      0
    );

    return {
      total_referrals: validatedReferrals.length,
      successful_referrals: successfulReferrals.length,
      total_rewards_earned: totalRewards / 100,
    };
  }

  /**
   * Check and award viral badges
   */
  async checkAndAwardBadges(userId: string): Promise<ViralBadge[]> {
    assertEnhancedReferralsEnabled(this.enforceCapability);
    const normalizedUserId = assertNonEmptyString('Viral badge user_id', userId);

    const referrals = await this.customerReferralRepository.find({
      where: { referrer_id: normalizedUserId, status: 'reward_claimed' },
    });

    const validatedReferrals = referrals.map((referral, index) =>
      assertCustomerReferralBadgeEvidenceRow(referral, normalizedUserId, index + 1)
    );
    assertUniqueCustomerReferralStatsIds(validatedReferrals, normalizedUserId);
    const successfulCount = validatedReferrals.length;

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
          where: { user_id: normalizedUserId, badge_type: definition.type },
        });

        if (existing) {
          assertExistingViralBadgeAwardRow(existing, {
            userId: normalizedUserId,
            badgeType: definition.type,
          });
        } else {
          const badge = this.badgeRepository.create({
            user_id: normalizedUserId,
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
    assertEnhancedReferralsEnabled(this.enforceCapability);
    const normalizedUserId = assertNonEmptyString('Viral badge user_id', userId);

    const badges = await this.badgeRepository.find({
      where: { user_id: normalizedUserId },
      order: { tier: 'DESC' },
    });
    badges.forEach((badge, index) =>
      assertViralBadgeReadRow(badge, normalizedUserId, index + 1)
    );
    assertUniqueViralBadgeReadIds(badges, normalizedUserId);
    return badges;
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
    assertEnhancedReferralsEnabled(this.enforceCapability);
    const normalizedReferralCode = assertNonEmptyString('Referral code', referralCode).toUpperCase();
    const normalizedBusinessName = assertReferralShareBusinessName(businessName);
    const normalizedMenuPreviewUrl = normalizeOptionalHttpUrl(
      'Referral share menu preview URL',
      menuPreviewUrl,
      2048
    );
    const shareLink = buildReferralShareLink(normalizedReferralCode);

    return {
      story_url: `instagram://story-camera`,
      story_template: {
        background_image: normalizedMenuPreviewUrl,
        text: `Join ${normalizedBusinessName} on MenuMaker with referral code ${normalizedReferralCode}. Launch rewards are shown in the app when available.`,
        link: shareLink,
      },
    };
  }

  /**
   * Generate WhatsApp share message
   */
  generateWhatsAppShare(referralCode: string, _businessName: string): {
    message: string;
    share_url: string;
  } {
    assertEnhancedReferralsEnabled(this.enforceCapability);
    const normalizedReferralCode = assertNonEmptyString('Referral code', referralCode).toUpperCase();
    const normalizedBusinessName = assertReferralShareBusinessName(_businessName);
    const shareLink = buildReferralShareLink(normalizedReferralCode);
    const message = `🍽️ I'm using MenuMaker for ${normalizedBusinessName}!\n\nJoin me here: ${shareLink}\n\nUse code: ${normalizedReferralCode}\n\nLaunch rewards are shown in the app when available.`;

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

  private rewardCouponCode(referralCode: string, role: 'referrer' | 'referee'): string {
    const normalizedReferralCode = assertNonEmptyString('Customer referral code', referralCode);
    return `REF-${normalizedReferralCode}-${role === 'referrer' ? 'A' : 'B'}`.toUpperCase().slice(0, 50);
  }

  private rewardLedgerId(referralId: string, role: 'referrer' | 'referee', rewardValueCents: number): string {
    return createHash('sha256').update(`${referralId}:${role}:${rewardValueCents}`).digest('hex');
  }

  private rewardNotificationIntent(params: {
    referralId: string;
    participantUserId: string;
    role: 'referrer' | 'referee';
    couponCode: string;
    rewardValueCents: number;
  }): RewardNotificationIntent {
    return {
      channel: 'email',
      template: 'referral_reward_claimed',
      deduplicationKey: `referral:${params.referralId}:${params.role}:reward`,
      aggregateType: 'customer_referral',
      aggregateId: params.referralId,
      recipientRef: params.participantUserId,
      payload: {
        referral_id: params.referralId,
        coupon_code: params.couponCode,
        reward_cents: params.rewardValueCents,
      },
      audit: { created_by: 'ViralService.claimReferralRewards' },
    };
  }

  private async assertReferralRewardNotificationDedupeEvidence(
    intents: RewardNotificationIntent[]
  ): Promise<void> {
    const outboxRepository = ViralService.rewardDependencies.outboxRepository;
    if (!outboxRepository?.findOne) return;

    for (const intent of intents) {
      const existing = await outboxRepository.findOne({
        where: { deduplication_key: intent.deduplicationKey, channel: intent.channel },
      });
      if (existing) {
        this.assertReferralRewardNotificationMatches(existing, intent);
      }
    }
  }

  private async enqueueReferralRewardNotification(intent: RewardNotificationIntent): Promise<NotificationOutbox> {
    const outboxRepository = ViralService.rewardDependencies.outboxRepository;
    if (!outboxRepository) {
      const built = NotificationOutboxService.buildIntent(intent);
      this.assertReferralRewardNotificationMatches(built, intent);
      return built;
    }

    if (outboxRepository.findOne) {
      const existing = await outboxRepository.findOne({
        where: { deduplication_key: intent.deduplicationKey, channel: intent.channel },
      });
      if (existing) {
        this.assertReferralRewardNotificationMatches(existing, intent);
        return existing;
      }
    }

    const saved = await outboxRepository.save(NotificationOutboxService.buildIntent(intent));
    this.assertReferralRewardNotificationMatches(saved, intent);
    return saved;
  }

  private assertReferralRewardNotificationMatches(
    notification: NotificationOutbox,
    intent: RewardNotificationIntent
  ): void {
    const label = `Referral reward notification ${intent.deduplicationKey}`;
    if (notification.channel !== intent.channel) {
      throw new Error(`${label} channel must match reward intent`);
    }
    if (notification.template !== intent.template) {
      throw new Error(`${label} template must match reward intent`);
    }
    if (notification.deduplication_key !== intent.deduplicationKey) {
      throw new Error(`${label} deduplication_key must match reward intent`);
    }
    if (notification.aggregate_type !== intent.aggregateType) {
      throw new Error(`${label} aggregate_type must match reward intent`);
    }
    if (notification.aggregate_id !== intent.aggregateId) {
      throw new Error(`${label} aggregate_id must match reward intent`);
    }
    if (notification.recipient_ref !== intent.recipientRef) {
      throw new Error(`${label} recipient_ref must match reward participant`);
    }
    if (!notification.payload || typeof notification.payload !== 'object' || Array.isArray(notification.payload)) {
      throw new Error(`${label} payload must be an object`);
    }

    const payload = notification.payload as Record<string, unknown>;
    const payloadKeys = Object.keys(payload);
    assertEnhancedReferralFieldNamesAreSafe(`${label} payload`, payloadKeys);
    const unsupportedPayloadKeys = payloadKeys.filter(
      (key) => !REFERRAL_REWARD_NOTIFICATION_PAYLOAD_KEYS.has(key) && payload[key] !== undefined
    );
    if (unsupportedPayloadKeys.length > 0) {
      throw new Error(
        `${label} payload include unsupported field(s): ${unsupportedPayloadKeys.sort().join(', ')}`
      );
    }

    const intentPayload = intent.payload || {};
    if (payload.referral_id !== intentPayload.referral_id) {
      throw new Error(`${label} payload referral_id must match reward intent`);
    }
    if (payload.coupon_code !== intentPayload.coupon_code) {
      throw new Error(`${label} payload coupon_code must match reward coupon`);
    }
    const rewardCents = asValidatedNonNegativeCents(`${label} payload reward_cents`, payload.reward_cents as any);
    if (rewardCents !== intentPayload.reward_cents) {
      throw new Error(`${label} payload reward_cents must match reward value`);
    }
  }
}
