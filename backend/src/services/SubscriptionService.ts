import Stripe from 'stripe';
import { Between, Repository } from 'typeorm';
import { Subscription, SubscriptionTier, SUBSCRIPTION_TIERS } from '../models/Subscription.js';
import { Business } from '../models/Business.js';
import { Order } from '../models/Order.js';
import { AppDataSource } from '../config/database.js';
import { logMetric } from '../utils/logger.js';
import { assertCapabilityEnabled, getCapability } from '../config/capabilities.js';

interface SubscriptionServiceOptions {
  stripe?: Stripe;
  requireStripe?: boolean;
  enforceCapability?: boolean;
  subscriptionRepository?: Repository<Subscription>;
  businessRepository?: Repository<Business>;
  orderRepository?: Repository<Order>;
}

export interface SubscriptionOrderLimitDecision {
  allowed: boolean;
  current: number;
  limit: number;
  isUnlimited: boolean;
}

export interface SubscriptionWebhookApplyResult {
  applied: boolean;
  reason: 'applied' | 'stale_event';
}

const SUPPORTED_SUBSCRIPTION_STATUSES = new Set([
  'active',
  'canceled',
  'past_due',
  'trialing',
  'incomplete',
]);
const SUPPORTED_SUBSCRIPTION_WEBHOOK_EVENTS = new Set([
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'customer.subscription.trial_will_end',
]);
const SUBSCRIPTION_CREATION_OPTION_KEYS = new Set(['trialDays', 'email']);
const SUBSCRIPTION_CANCELLATION_OPTION_KEYS = new Set(['immediate']);
const SUBSCRIPTION_BUSINESS_ROW_KEYS = new Set([
  'id',
  'owner',
  'owner_id',
  'name',
  'email',
  'slug',
  'logo_url',
  'primary_color',
  'locale',
  'timezone',
  'description',
  'is_published',
  'deleted_at',
  'created_at',
  'updated_at',
  'dishes',
  'dish_categories',
  'menus',
  'orders',
  'payouts',
  'settings',
]);
const STRIPE_CUSTOMER_METADATA_KEYS = new Set(['business_id', 'business_name']);
const STRIPE_SUBSCRIPTION_METADATA_KEYS = new Set(['business_id', 'tier']);
const PERSISTED_SUBSCRIPTION_METADATA_KEYS = new Set([
  'stripe_last_event_created',
  'stripe_last_event_type',
  'trial_will_end_subscription_id',
  'trial_will_end_at',
]);
const PERSISTED_SUBSCRIPTION_ROW_KEYS = new Set([
  'id',
  'business',
  'business_id',
  'tier',
  'status',
  'stripe_customer_id',
  'stripe_subscription_id',
  'stripe_price_id',
  'current_period_start',
  'current_period_end',
  'cancel_at_period_end',
  'canceled_at',
  'trial_start',
  'trial_end',
  'metadata',
  'created_at',
  'updated_at',
]);
const SNAPSHOT_SUBSCRIPTION_WEBHOOK_EVENTS = new Set([
  'customer.subscription.created',
  'customer.subscription.updated',
]);
const DELETED_SUBSCRIPTION_WEBHOOK_EVENTS = new Set([
  'customer.subscription.deleted',
]);
const ENTITLED_SUBSCRIPTION_STATUSES = new Set<Subscription['status']>([
  'active',
  'trialing',
]);
const MAX_STRIPE_PROVIDER_ID_LENGTH = 255;
const MAX_STRIPE_PAYMENT_CLIENT_SECRET_LENGTH = 512;
const MAX_SUBSCRIPTION_PORTAL_URL_LENGTH = 2048;
const SUPPORTED_SUBSCRIPTION_TIERS = new Set<SubscriptionTier>(
  Object.keys(SUBSCRIPTION_TIERS) as SubscriptionTier[]
);
const UNSAFE_SUBSCRIPTION_TEXT_CONTROLS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/u;

function assertSubscriptionFieldNamesAreSafe(label: string, fieldNames: string[]): void {
  if (fieldNames.some((fieldName) => hasUnsafeSubscriptionTextControls(fieldName))) {
    throw new Error(`${label} field names must not include unsafe control characters`);
  }
}

function assertStripeTimestampSeconds(label: string, value: number): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer Stripe timestamp`);
  }
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${label} must be a safe integer Stripe timestamp`);
  }
}

function dateFromStripeSeconds(label: string, value: number): Date {
  assertStripeTimestampSeconds(label, value);
  const date = new Date(value * 1000);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${label} must be a representable Stripe timestamp`);
  }
  return date;
}

function timestampFromStripeSeconds(label: string, value?: number | null): Date | undefined {
  if (value === null || value === undefined) return undefined;
  return dateFromStripeSeconds(label, value);
}

function assertDateWithinBillingPeriod(
  label: string,
  value: Date,
  billingPeriod: { periodStart: Date; periodEnd: Date }
): void {
  if (value < billingPeriod.periodStart || value > billingPeriod.periodEnd) {
    throw new Error(`${label} must fall within current billing period`);
  }
}

function requireStripeSubscriptionCreationDates(
  stripeSubscription: Pick<Stripe.Subscription, 'trial_start' | 'trial_end'> & {
    current_period_start?: number;
    current_period_end?: number;
  }
): {
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  trialStart?: Date;
  trialEnd?: Date;
} {
  const currentPeriodStart = timestampFromStripeSeconds(
    'Stripe subscription current_period_start',
    stripeSubscription.current_period_start
  );
  const currentPeriodEnd = timestampFromStripeSeconds(
    'Stripe subscription current_period_end',
    stripeSubscription.current_period_end
  );
  if (!currentPeriodStart || !currentPeriodEnd) {
    throw new Error('Stripe subscription billing period must include both current_period_start and current_period_end');
  }
  if (currentPeriodStart > currentPeriodEnd) {
    throw new Error('Stripe subscription current_period_start cannot be after current_period_end');
  }

  const trialStart = timestampFromStripeSeconds('Stripe subscription trial_start', stripeSubscription.trial_start);
  const trialEnd = timestampFromStripeSeconds('Stripe subscription trial_end', stripeSubscription.trial_end);
  if ((trialStart && !trialEnd) || (!trialStart && trialEnd)) {
    throw new Error('Stripe subscription trial period must include both trial_start and trial_end');
  }
  if (trialStart && trialEnd && trialStart > trialEnd) {
    throw new Error('Stripe subscription trial_start cannot be after trial_end');
  }

  return {
    currentPeriodStart,
    currentPeriodEnd,
    trialStart,
    trialEnd,
  };
}

function requireStripeSubscriptionPriceEvidence(
  stripeSubscription: {
    items?: {
      data?: Array<{
        price?: {
          id?: unknown;
        } | null;
      }>;
    } | null;
  },
  expectedPriceId: string
): string {
  if (!stripeSubscription.items || !Array.isArray(stripeSubscription.items.data)) {
    throw new Error('Stripe subscription must include item price evidence');
  }

  if (stripeSubscription.items.data.length !== 1) {
    throw new Error('Stripe subscription must include exactly one item price');
  }

  const stripePriceId = assertStripeProviderId(
    'Stripe subscription item price id',
    stripeSubscription.items.data[0]?.price?.id
  );
  if (stripePriceId !== expectedPriceId) {
    throw new Error('Stripe subscription item price id must match requested tier');
  }

  return stripePriceId;
}

function normalizeStripePaymentClientSecret(stripeSubscription: {
  latest_invoice?: unknown;
}): string | undefined {
  const latestInvoice = stripeSubscription.latest_invoice;
  if (!latestInvoice || typeof latestInvoice !== 'object') return undefined;

  const paymentIntent = (latestInvoice as { payment_intent?: unknown }).payment_intent;
  if (!paymentIntent || typeof paymentIntent !== 'object') return undefined;

  const clientSecret = (paymentIntent as { client_secret?: unknown }).client_secret;
  if (clientSecret === undefined || clientSecret === null) return undefined;
  if (typeof clientSecret !== 'string') {
    throw new Error('Stripe payment intent client_secret must be a string');
  }
  if (hasUnsafeSubscriptionTextControls(clientSecret)) {
    throw new Error('Stripe payment intent client_secret must not include unsafe control characters');
  }
  if (clientSecret.trim().length === 0) return undefined;

  const normalizedClientSecret = assertNonEmptyString('Stripe payment intent client_secret', clientSecret);
  if (normalizedClientSecret.length > MAX_STRIPE_PAYMENT_CLIENT_SECRET_LENGTH) {
    throw new Error(
      `Stripe payment intent client_secret must be at most ${MAX_STRIPE_PAYMENT_CLIENT_SECRET_LENGTH} characters`
    );
  }

  return normalizedClientSecret;
}

function normalizeSubscriptionStatus(status: unknown): Subscription['status'] {
  if (typeof status === 'string' && hasUnsafeSubscriptionTextControls(status)) {
    throw new Error('Stripe subscription status must not include unsafe control characters');
  }
  const normalizedStatus = typeof status === 'string' ? status.trim() : status;
  if (
    typeof normalizedStatus === 'string' &&
    SUPPORTED_SUBSCRIPTION_STATUSES.has(normalizedStatus)
  ) {
    return normalizedStatus as Subscription['status'];
  }
  throw new Error('Stripe subscription status is not supported');
}

function assertSupportedSubscriptionTier(
  tier: unknown,
  label = 'subscription tier filter'
): SubscriptionTier {
  if (typeof tier === 'string' && hasUnsafeSubscriptionTextControls(tier)) {
    throw new Error(`${label} must not include unsafe control characters`);
  }
  const normalizedTier = typeof tier === 'string' ? tier.trim() : tier;
  if (
    typeof normalizedTier !== 'string' ||
    !SUPPORTED_SUBSCRIPTION_TIERS.has(normalizedTier as SubscriptionTier)
  ) {
    throw new Error(`${label} has an invalid tier`);
  }

  return normalizedTier as SubscriptionTier;
}

function assertSupportedSubscriptionStatus(
  status: unknown,
  label = 'subscription status filter'
): Subscription['status'] {
  if (typeof status === 'string' && hasUnsafeSubscriptionTextControls(status)) {
    throw new Error(`${label} must not include unsafe control characters`);
  }
  const normalizedStatus = typeof status === 'string' ? status.trim() : status;
  if (
    typeof normalizedStatus !== 'string' ||
    !SUPPORTED_SUBSCRIPTION_STATUSES.has(normalizedStatus)
  ) {
    throw new Error(`${label} has an invalid status`);
  }

  return normalizedStatus as Subscription['status'];
}

function subscriptionDataIntegrityError(message: string): Error & {
  statusCode: number;
  code: string;
} {
  const error = new Error(message) as Error & {
    statusCode: number;
    code: string;
  };
  error.statusCode = 500;
  error.code = 'SUBSCRIPTION_DATA_INVALID';
  return error;
}

function assertValidDate(label: string, value: unknown): Date {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new Error(`${label} must be a valid Date`);
  }
  return value;
}

function assertOptionalDate(label: string, value: unknown): Date | undefined {
  if (value === undefined || value === null) return undefined;
  return assertValidDate(label, value);
}

function assertOptionalNonEmptyString(label: string, value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  return assertNonEmptyString(label, value);
}

function assertStripeProviderId(label: string, value: unknown): string {
  const normalizedValue = assertNonEmptyString(label, value);
  if (normalizedValue.length > MAX_STRIPE_PROVIDER_ID_LENGTH) {
    throw new Error(`${label} must be at most ${MAX_STRIPE_PROVIDER_ID_LENGTH} characters`);
  }
  return normalizedValue;
}

function assertOptionalStripeProviderId(label: string, value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  return assertStripeProviderId(label, value);
}

function assertIsoTimestampString(label: string, value: unknown): string {
  if (typeof value !== 'string') {
    throw new Error(`${label} must be an ISO timestamp string`);
  }
  if (hasUnsafeSubscriptionTextControls(value)) {
    throw new Error(`${label} must not include unsafe control characters`);
  }
  if (value.trim().length === 0) {
    throw new Error(`${label} must be an ISO timestamp string`);
  }
  const normalizedValue = value.trim();
  const parsedDate = new Date(normalizedValue);
  if (Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString() !== normalizedValue) {
    throw new Error(`${label} must be an ISO timestamp string`);
  }
  return normalizedValue;
}

function assertPersistedSubscriptionMetadata(metadata: Record<string, unknown>): void {
  const metadataKeys = Object.keys(metadata);
  assertSubscriptionFieldNamesAreSafe('persisted subscription metadata', metadataKeys);
  const unsupportedKeys = metadataKeys.filter(
    (key) => !PERSISTED_SUBSCRIPTION_METADATA_KEYS.has(key)
  );
  if (unsupportedKeys.length > 0) {
    throw new Error(
      `persisted subscription metadata include unsupported field(s): ${unsupportedKeys.sort().join(', ')}`
    );
  }

  const stripeLastEventCreated = metadata.stripe_last_event_created;
  if (stripeLastEventCreated !== undefined) {
    if (typeof stripeLastEventCreated !== 'number') {
      throw new Error('persisted subscription stripe_last_event_created must be a Stripe timestamp');
    }
    dateFromStripeSeconds(
      'persisted subscription stripe_last_event_created',
      stripeLastEventCreated
    );
  }

  const stripeLastEventType = metadata.stripe_last_event_type;
  if (stripeLastEventType !== undefined) {
    if (stripeLastEventCreated === undefined) {
      throw new Error('persisted subscription stripe_last_event_type requires stripe_last_event_created');
    }
    if (
      typeof stripeLastEventType !== 'string' ||
      !SUPPORTED_SUBSCRIPTION_WEBHOOK_EVENTS.has(stripeLastEventType)
    ) {
      throw new Error('persisted subscription stripe_last_event_type must be a supported subscription webhook event');
    }
  }

  const trialWillEndSubscriptionId = metadata.trial_will_end_subscription_id;
  const trialWillEndAt = metadata.trial_will_end_at;
  if (
    (trialWillEndSubscriptionId === undefined) !==
    (trialWillEndAt === undefined)
  ) {
    throw new Error('persisted subscription trial_will_end metadata must include both subscription id and timestamp');
  }

  if (trialWillEndSubscriptionId !== undefined) {
    assertStripeProviderId(
      'persisted subscription trial_will_end_subscription_id',
      trialWillEndSubscriptionId
    );
  }

  if (trialWillEndAt !== undefined) {
    assertIsoTimestampString('persisted subscription trial_will_end_at', trialWillEndAt);
  }

  if (
    trialWillEndSubscriptionId !== undefined &&
    stripeLastEventType !== 'customer.subscription.trial_will_end'
  ) {
    throw new Error(
      'persisted subscription trial_will_end metadata requires customer.subscription.trial_will_end event evidence'
    );
  }
}

function validatedPersistedSubscriptionMetadata(
  metadata: unknown
): Record<string, unknown> | undefined {
  if (metadata === undefined || metadata === null) return undefined;
  if (typeof metadata !== 'object' || Array.isArray(metadata)) {
    throw new Error('persisted subscription metadata must be an object');
  }
  const metadataRecord = metadata as Record<string, unknown>;
  assertPersistedSubscriptionMetadata(metadataRecord);
  return metadataRecord;
}

function assertPersistedSubscriptionShape(
  subscription: Subscription,
  expected?: { businessId?: string; stripeSubscriptionId?: string }
): Subscription {
  try {
    if (!subscription || typeof subscription !== 'object' || Array.isArray(subscription)) {
      throw new Error('persisted subscription must be an object');
    }
    const subscriptionRecord = subscription as unknown as Record<string, unknown>;
    assertSubscriptionFieldNamesAreSafe('persisted subscription', Object.keys(subscriptionRecord));
    const unsupportedKeys = Object.keys(subscriptionRecord).filter(
      (key) => !PERSISTED_SUBSCRIPTION_ROW_KEYS.has(key) && subscriptionRecord[key] !== undefined
    );
    if (unsupportedKeys.length > 0) {
      throw new Error(`persisted subscription include unsupported field(s): ${unsupportedKeys.sort().join(', ')}`);
    }

    assertOptionalNonEmptyString('persisted subscription id', subscription.id);
    const businessId = assertNonEmptyString('persisted subscription business_id', subscription.business_id);
    if (expected?.businessId && businessId !== expected.businessId) {
      throw new Error('persisted subscription business_id must match requested business');
    }
    if (Object.prototype.hasOwnProperty.call(subscription, 'business')) {
      if (subscription.business === null) {
        throw new Error('persisted subscription business relation is required when loaded');
      }
      if (subscription.business === undefined) {
        // Class fields and lightweight repository fakes may materialize an
        // omitted relation as an own `undefined` property. Treat that as not
        // loaded; explicit null from a relation load is corrupt evidence.
      } else {
        const relationBusinessId = assertNonEmptyString(
          'persisted subscription business relation id',
          subscription.business.id
        );
        if (relationBusinessId !== businessId) {
          throw new Error('persisted subscription business relation id must match subscription business_id');
        }
      }
    }

    const subscriptionTier = assertSupportedSubscriptionTier(subscription.tier, 'persisted subscription tier');
    const subscriptionStatus = assertSupportedSubscriptionStatus(subscription.status, 'persisted subscription status');
    if (typeof subscription.cancel_at_period_end !== 'boolean') {
      throw new Error('persisted subscription cancel_at_period_end must be a boolean');
    }
    const createdAt = assertOptionalDate('persisted subscription created_at', subscription.created_at);
    const updatedAt = assertOptionalDate('persisted subscription updated_at', subscription.updated_at);
    if (createdAt && updatedAt && updatedAt < createdAt) {
      throw new Error('persisted subscription updated_at cannot be before created_at');
    }

    assertOptionalStripeProviderId(
      'persisted subscription stripe_customer_id',
      subscription.stripe_customer_id
    );
    const stripeSubscriptionId = assertOptionalStripeProviderId(
      'persisted subscription stripe_subscription_id',
      subscription.stripe_subscription_id
    );
    const stripePriceId = assertOptionalStripeProviderId(
      'persisted subscription stripe_price_id',
      subscription.stripe_price_id
    );
    if (expected?.stripeSubscriptionId && stripeSubscriptionId !== expected.stripeSubscriptionId) {
      throw new Error('persisted subscription stripe_subscription_id must match requested Stripe subscription');
    }
    const hasBillingPeriod =
      (subscription.current_period_start !== undefined && subscription.current_period_start !== null) ||
      (subscription.current_period_end !== undefined && subscription.current_period_end !== null);
    if (subscriptionTier === 'free' && stripeSubscriptionId) {
      throw new Error('persisted free subscription cannot include stripe_subscription_id');
    }
    if (subscriptionTier === 'free' && stripePriceId) {
      throw new Error('persisted free subscription cannot include stripe_price_id');
    }
    if (subscriptionTier === 'free' && hasBillingPeriod) {
      throw new Error('persisted free subscription cannot include Stripe billing period');
    }
    if (subscriptionTier !== 'free' && !stripeSubscriptionId) {
      throw new Error('persisted paid subscription must include stripe_subscription_id');
    }
    if (subscriptionTier !== 'free' && !stripePriceId) {
      throw new Error('persisted paid subscription must include stripe_price_id');
    }
    if (subscriptionTier !== 'free') {
      const expectedStripePriceId = assertStripeProviderId(
        'configured subscription tier Stripe price id',
        SUBSCRIPTION_TIERS[subscriptionTier].priceId
      );
      if (stripePriceId !== expectedStripePriceId) {
        throw new Error('persisted paid subscription stripe_price_id must match subscription tier');
      }
    }
    if (subscriptionTier !== 'free' && !hasBillingPeriod) {
      throw new Error('persisted paid subscription must include Stripe billing period');
    }
    const billingPeriod = getSubscriptionBillingPeriod(subscription);

    const canceledAt = assertOptionalDate('persisted subscription canceled_at', subscription.canceled_at);
    if (subscriptionStatus === 'canceled' && !canceledAt) {
      throw new Error('persisted canceled subscription must include canceled_at');
    }
    if (subscriptionStatus !== 'canceled' && canceledAt) {
      if (!subscription.cancel_at_period_end) {
        throw new Error('persisted non-canceled subscription cannot include canceled_at');
      }
      if (!stripeSubscriptionId) {
        throw new Error('persisted scheduled cancellation must include stripe_subscription_id');
      }
      if (!hasBillingPeriod) {
        throw new Error('persisted scheduled cancellation must include Stripe billing period');
      }
      assertDateWithinBillingPeriod(
        'persisted scheduled subscription canceled_at',
        canceledAt,
        billingPeriod
      );
    }
    if (createdAt && canceledAt && canceledAt < createdAt) {
      throw new Error('persisted subscription canceled_at cannot be before created_at');
    }
    if (subscriptionStatus === 'canceled' && updatedAt && canceledAt && updatedAt < canceledAt) {
      throw new Error('persisted canceled subscription updated_at cannot be before canceled_at');
    }
    if (subscriptionStatus === 'canceled' && subscription.cancel_at_period_end) {
      throw new Error('persisted canceled subscription cannot still be marked cancel_at_period_end');
    }
    const trialStart = assertOptionalDate('persisted subscription trial_start', subscription.trial_start);
    const trialEnd = assertOptionalDate('persisted subscription trial_end', subscription.trial_end);
    if ((trialStart && !trialEnd) || (!trialStart && trialEnd)) {
      throw new Error('persisted subscription trial period must include both trial_start and trial_end');
    }
    if (trialStart && trialEnd && trialStart > trialEnd) {
      throw new Error('persisted subscription trial_start cannot be after trial_end');
    }
    if (subscriptionTier === 'free' && (trialStart || trialEnd)) {
      throw new Error('persisted free subscription cannot include trial period');
    }
    if (createdAt && trialStart && trialStart < createdAt) {
      throw new Error('persisted subscription trial_start cannot be before created_at');
    }
    if (createdAt && trialEnd && trialEnd < createdAt) {
      throw new Error('persisted subscription trial_end cannot be before created_at');
    }
    if (updatedAt && trialStart && updatedAt < trialStart) {
      throw new Error('persisted subscription updated_at cannot be before trial_start');
    }
    if (subscriptionStatus === 'trialing' && (!trialStart || !trialEnd)) {
      throw new Error('persisted trialing subscription must include trial period');
    }
    if (createdAt && billingPeriod.periodStart < createdAt) {
      throw new Error('persisted subscription current_period_start cannot be before created_at');
    }
    if (createdAt && billingPeriod.periodEnd < createdAt) {
      throw new Error('persisted subscription current_period_end cannot be before created_at');
    }

    const metadata = validatedPersistedSubscriptionMetadata(subscription.metadata);
    const stripeLastEventCreated = typeof metadata?.stripe_last_event_created === 'number'
      ? dateFromStripeSeconds(
        'persisted subscription stripe_last_event_created',
        metadata.stripe_last_event_created
      )
      : undefined;
    if (
      metadata?.trial_will_end_subscription_id === undefined &&
      createdAt &&
      stripeLastEventCreated &&
      stripeLastEventCreated < createdAt
    ) {
      throw new Error('persisted subscription stripe_last_event_created cannot be before created_at');
    }
    if (updatedAt && stripeLastEventCreated && updatedAt < stripeLastEventCreated) {
      throw new Error('persisted subscription updated_at cannot be before stripe_last_event_created');
    }
    if (metadata?.trial_will_end_subscription_id !== undefined) {
      if (!stripeSubscriptionId || metadata.trial_will_end_subscription_id !== stripeSubscriptionId) {
        throw new Error('persisted subscription trial_will_end_subscription_id must match stripe_subscription_id');
      }
      const trialWillEndAt = new Date(metadata.trial_will_end_at as string);
      if (!trialEnd) {
        throw new Error('persisted subscription trial_will_end_at requires persisted trial_end');
      }
      if (trialEnd && trialWillEndAt.getTime() !== trialEnd.getTime()) {
        throw new Error('persisted subscription trial_will_end_at must match persisted trial_end');
      }
      if (createdAt && stripeLastEventCreated && stripeLastEventCreated < createdAt) {
        throw new Error('persisted subscription trial_will_end event cannot be before created_at');
      }
      if (trialStart && stripeLastEventCreated && stripeLastEventCreated < trialStart) {
        throw new Error('persisted subscription trial_will_end event cannot be before trial_start');
      }
      if (stripeLastEventCreated && stripeLastEventCreated > trialWillEndAt) {
        throw new Error('persisted subscription trial_will_end event cannot be after trial_will_end_at');
      }
    }
  } catch (error) {
    throw subscriptionDataIntegrityError(error instanceof Error ? error.message : 'persisted subscription is invalid');
  }

  return subscription;
}

function assertPersistedSubscriptionAdminRowEnvelope(
  row: unknown,
  label: string
): asserts row is Subscription {
  if (!row || typeof row !== 'object' || Array.isArray(row)) {
    throw subscriptionDataIntegrityError(`${label} must be an object`);
  }
}

function assertPersistedSubscriptionMatchesAdminFilters(
  subscription: Subscription,
  filters: { tier?: SubscriptionTier; status?: Subscription['status'] },
  label: string
): void {
  const subscriptionTier = assertSupportedSubscriptionTier(subscription.tier, `${label} tier`);
  const subscriptionStatus = assertSupportedSubscriptionStatus(subscription.status, `${label} status`);
  if (filters.tier !== undefined && subscriptionTier !== filters.tier) {
    throw subscriptionDataIntegrityError(`${label} tier must match requested filter`);
  }
  if (filters.status !== undefined && subscriptionStatus !== filters.status) {
    throw subscriptionDataIntegrityError(`${label} status must match requested filter`);
  }
}

function assertSubscriptionTrialDays(value: unknown): number {
  if (value === undefined || value === null) return 14;
  const numeric =
    typeof value === 'string' && /^\d+$/.test(value.trim()) ? Number(value.trim()) : value;
  if (
    typeof numeric !== 'number' ||
    !Number.isInteger(numeric) ||
    numeric < 1 ||
    numeric > 365 ||
    !Number.isSafeInteger(numeric)
  ) {
    throw new Error('subscription trialDays must be a positive safe integer between 1 and 365');
  }
  return numeric;
}

function normalizeSubscriptionCreationOptions(options: unknown): {
  trialDays?: unknown;
  email?: unknown;
} {
  if (options === undefined) return {};
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    throw new Error('subscription creation options must be an object');
  }
  const optionRecord = options as Record<string, unknown>;
  assertSubscriptionFieldNamesAreSafe('subscription creation options', Object.keys(optionRecord));
  const unsupportedKeys = Object.keys(optionRecord).filter(
    (key) => !SUBSCRIPTION_CREATION_OPTION_KEYS.has(key)
  );
  if (unsupportedKeys.length > 0) {
    throw new Error(
      `subscription creation options include unsupported field(s): ${unsupportedKeys.sort().join(', ')}`
    );
  }
  return optionRecord as {
    trialDays?: unknown;
    email?: unknown;
  };
}

function normalizeSubscriptionCancellationOptions(options: unknown): {
  immediate?: boolean;
} {
  if (options === undefined) return {};
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    throw new Error('subscription cancellation options must be an object');
  }

  const normalizedOptions = options as Record<string, unknown> & { immediate?: unknown };
  assertSubscriptionFieldNamesAreSafe('subscription cancellation options', Object.keys(normalizedOptions));
  const unsupportedKeys = Object.keys(normalizedOptions).filter(
    (key) => !SUBSCRIPTION_CANCELLATION_OPTION_KEYS.has(key)
  );
  if (unsupportedKeys.length > 0) {
    throw new Error(
      `subscription cancellation options include unsupported field(s): ${unsupportedKeys.sort().join(', ')}`
    );
  }
  if (
    normalizedOptions.immediate !== undefined &&
    typeof normalizedOptions.immediate !== 'boolean'
  ) {
    throw new Error('subscription cancellation immediate must be a boolean');
  }

  return {
    immediate: normalizedOptions.immediate as boolean | undefined,
  };
}

function assertAbsoluteHttpUrl(
  label: string,
  value: unknown,
  options: { requireHttps?: boolean; maxLength?: number } = {}
): string {
  if (typeof value !== 'string') {
    throw new Error(`${label} must be an absolute ${options.requireHttps ? 'HTTPS' : 'HTTP(S)'} URL`);
  }
  if (hasUnsafeSubscriptionTextControls(value)) {
    throw new Error(`${label} must not include unsafe control characters`);
  }
  if (value.trim().length === 0) {
    throw new Error(`${label} must be an absolute ${options.requireHttps ? 'HTTPS' : 'HTTP(S)'} URL`);
  }

  const trimmedValue = value.trim();
  if (options.maxLength !== undefined && trimmedValue.length > options.maxLength) {
    throw new Error(`${label} must be at most ${options.maxLength} characters`);
  }
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(trimmedValue);
  } catch {
    throw new Error(`${label} must be an absolute ${options.requireHttps ? 'HTTPS' : 'HTTP(S)'} URL`);
  }

  const allowedProtocol = options.requireHttps
    ? parsedUrl.protocol === 'https:'
    : parsedUrl.protocol === 'https:' || parsedUrl.protocol === 'http:';

  if (!allowedProtocol || !parsedUrl.hostname) {
    throw new Error(`${label} must be an absolute ${options.requireHttps ? 'HTTPS' : 'HTTP(S)'} URL`);
  }
  if (parsedUrl.username || parsedUrl.password) {
    throw new Error(`${label} must not include embedded credentials`);
  }
  if (isPrivateOrInternalSubscriptionHost(parsedUrl.hostname)) {
    throw new Error(`${label} must use a public ${options.requireHttps ? 'HTTPS' : 'HTTP(S)'} URL`);
  }

  return trimmedValue;
}

function parseSubscriptionIPv4Host(hostname: string): number[] | null {
  const parts = hostname.split('.');
  if (parts.length !== 4) return null;

  const octets = parts.map((part) => {
    if (!/^\d{1,3}$/.test(part)) return Number.NaN;
    const octet = Number(part);
    return Number.isInteger(octet) && octet >= 0 && octet <= 255 ? octet : Number.NaN;
  });

  return octets.every((octet) => Number.isInteger(octet)) ? octets : null;
}

function isPrivateOrInternalSubscriptionHost(hostname: string): boolean {
  const normalizedHost = hostname.toLowerCase().replace(/\.$/, '');
  const unbracketedHost = normalizedHost.replace(/^\[(.*)\]$/, '$1');

  if (unbracketedHost === 'localhost' || unbracketedHost.endsWith('.localhost')) {
    return true;
  }

  const ipv4Host = unbracketedHost.startsWith('::ffff:')
    ? unbracketedHost.slice('::ffff:'.length)
    : unbracketedHost;
  const octets = parseSubscriptionIPv4Host(ipv4Host);
  if (octets) {
    const [first, second] = octets;
    return (
      first === 0 ||
      first === 10 ||
      first === 127 ||
      (first === 100 && second >= 64 && second <= 127) ||
      (first === 169 && second === 254) ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 168)
    );
  }

  if (!unbracketedHost.includes(':')) {
    return false;
  }

  const firstIpv6Group = unbracketedHost.split(':')[0];
  return (
    unbracketedHost === '::' ||
    unbracketedHost === '::1' ||
    firstIpv6Group.startsWith('fc') ||
    firstIpv6Group.startsWith('fd') ||
    /^fe[89ab]/u.test(firstIpv6Group)
  );
}

function hasUnsafeSubscriptionTextControls(value: string): boolean {
  return UNSAFE_SUBSCRIPTION_TEXT_CONTROLS.test(value);
}

function assertNonEmptyString(label: string, value: unknown): string {
  if (typeof value !== 'string') {
    throw new Error(`${label} must be a non-empty string`);
  }
  if (hasUnsafeSubscriptionTextControls(value)) {
    throw new Error(`${label} must not include unsafe control characters`);
  }
  if (value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
  const normalizedValue = value.trim();
  return normalizedValue;
}

function isServiceBoundaryError(error: unknown): error is Error & {
  statusCode: number;
  code: string;
} {
  return (
    error instanceof Error &&
    typeof (error as { statusCode?: unknown }).statusCode === 'number' &&
    typeof (error as { code?: unknown }).code === 'string'
  );
}

function assertValidEmail(label: string, value: unknown): string {
  const normalized = assertNonEmptyString(label, value);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new Error(`${label} must be a valid email address`);
  }
  return normalized;
}

function normalizeOptionalEmail(label: string, value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  return assertValidEmail(label, value);
}

function normalizeStripeCustomerBusiness(business: Business): {
  id: string;
  name: string;
  email: string;
} {
  if (!business || typeof business !== 'object') {
    throw new Error('subscription business must be an object');
  }
  const businessRecord = business as unknown as Record<string, unknown>;
  assertSubscriptionFieldNamesAreSafe('subscription business', Object.keys(businessRecord));
  const unsupportedKeys = Object.keys(businessRecord).filter(
    (key) => !SUBSCRIPTION_BUSINESS_ROW_KEYS.has(key) && businessRecord[key] !== undefined
  );
  if (unsupportedKeys.length > 0) {
    throw new Error(
      `subscription business include unsupported field(s): ${unsupportedKeys.sort().join(', ')}`
    );
  }
  return {
    id: assertNonEmptyString('subscription business id', business.id),
    name: assertNonEmptyString('subscription business name', business.name),
    email: assertValidEmail('subscription business email', business.email),
  };
}

function assertBusinessMatchesSubscriptionRequest(
  business: Business,
  businessId: string
): void {
  const normalizedBusiness = normalizeStripeCustomerBusiness(business);
  if (normalizedBusiness.id !== businessId) {
    throw new Error('subscription business id must match requested business');
  }
}

function assertStripeCustomerCreationIdentity(
  customer: Record<string, unknown>,
  expected: {
    businessId: string;
    businessName: string;
    email: string;
  }
): void {
  if (customer.email !== undefined && customer.email !== null) {
    const customerEmail = assertValidEmail('Stripe customer email', customer.email);
    if (customerEmail !== expected.email) {
      throw new Error('Stripe customer email must match requested subscription customer email');
    }
  }

  if (customer.name !== undefined && customer.name !== null) {
    const customerName = assertNonEmptyString('Stripe customer name', customer.name);
    if (customerName !== expected.businessName) {
      throw new Error('Stripe customer name must match requested subscription business name');
    }
  }

  if (customer.metadata === undefined || customer.metadata === null) return;
  if (typeof customer.metadata !== 'object' || Array.isArray(customer.metadata)) {
    throw new Error('Stripe customer metadata must be an object');
  }

  const metadata = customer.metadata as Record<string, unknown>;
  const metadataKeys = Object.keys(metadata);
  assertSubscriptionFieldNamesAreSafe('Stripe customer metadata', metadataKeys);
  const unsupportedMetadataKeys = metadataKeys.filter(
    (key) => !STRIPE_CUSTOMER_METADATA_KEYS.has(key)
  );
  if (unsupportedMetadataKeys.length > 0) {
    throw new Error(
      `Stripe customer metadata include unsupported field(s): ${unsupportedMetadataKeys.sort().join(', ')}`
    );
  }

  if (metadata.business_id !== undefined) {
    const metadataBusinessId = assertNonEmptyString(
      'Stripe customer metadata business_id',
      metadata.business_id
    );
    if (metadataBusinessId !== expected.businessId) {
      throw new Error('Stripe customer metadata business_id must match requested subscription business_id');
    }
  }

  if (metadata.business_name !== undefined) {
    const metadataBusinessName = assertNonEmptyString(
      'Stripe customer metadata business_name',
      metadata.business_name
    );
    if (metadataBusinessName !== expected.businessName) {
      throw new Error('Stripe customer metadata business_name must match requested subscription business name');
    }
  }
}

function assertStripeLifecycleResponse(
  label: string,
  value: unknown,
  expectedSubscriptionId: string
): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }

  const response = value as Record<string, unknown>;
  const responseSubscriptionId = assertStripeProviderId(`${label} id`, response.id);
  if (responseSubscriptionId !== expectedSubscriptionId) {
    throw new Error(`${label} id must match requested subscription`);
  }

  return response;
}

function assertStripeLifecycleCancellationFlag(
  label: string,
  value: unknown,
  expected: boolean
): void {
  if (typeof value !== 'boolean') {
    throw new Error(`${label} cancel_at_period_end must be a boolean`);
  }
  if (value !== expected) {
    throw new Error(
      `${label} cancel_at_period_end must be ${expected ? 'true' : 'false'}`
    );
  }
}

function assertStripeSnapshotCancellationFlag(value: unknown): boolean {
  if (typeof value !== 'boolean') {
    throw new Error('Stripe subscription cancel_at_period_end must be a boolean');
  }
  return value;
}

function assertStripeImmediateCancellationResponse(
  response: unknown,
  expectedSubscriptionId: string
): Date {
  const normalizedResponse = assertStripeLifecycleResponse(
    'Stripe subscription cancellation response',
    response,
    expectedSubscriptionId
  );
  const responseStatus = normalizeSubscriptionStatus(normalizedResponse.status);
  if (responseStatus !== 'canceled') {
    throw new Error('Stripe subscription cancellation response status must be canceled');
  }
  assertStripeLifecycleCancellationFlag(
    'Stripe subscription cancellation response',
    normalizedResponse.cancel_at_period_end,
    false
  );
  const canceledAt = timestampFromStripeSeconds(
    'Stripe subscription cancellation response canceled_at',
    normalizedResponse.canceled_at as number | null | undefined
  );
  if (!canceledAt) {
    throw new Error('Stripe subscription cancellation response canceled_at is required');
  }
  return canceledAt;
}

function assertStripeScheduledCancellationResponse(
  response: unknown,
  expectedSubscriptionId: string
): void {
  const normalizedResponse = assertStripeLifecycleResponse(
    'Stripe subscription scheduled-cancellation response',
    response,
    expectedSubscriptionId
  );
  assertStripeLifecycleCancellationFlag(
    'Stripe subscription scheduled-cancellation response',
    normalizedResponse.cancel_at_period_end,
    true
  );
  if (normalizedResponse.status !== undefined && normalizedResponse.status !== null) {
    const responseStatus = normalizeSubscriptionStatus(normalizedResponse.status);
    if (responseStatus === 'canceled') {
      throw new Error('Stripe subscription scheduled-cancellation response status cannot be canceled');
    }
  }
  const canceledAt = timestampFromStripeSeconds(
    'Stripe subscription scheduled-cancellation response canceled_at',
    normalizedResponse.canceled_at as number | null | undefined
  );
  if (canceledAt) {
    throw new Error('Stripe subscription scheduled-cancellation response canceled_at cannot be present');
  }
}

function assertStripeResumeResponse(
  response: unknown,
  expectedSubscriptionId: string
): void {
  const normalizedResponse = assertStripeLifecycleResponse(
    'Stripe subscription resume response',
    response,
    expectedSubscriptionId
  );
  assertStripeLifecycleCancellationFlag(
    'Stripe subscription resume response',
    normalizedResponse.cancel_at_period_end,
    false
  );
}

function assertStripePortalSessionCustomerIdentity(
  session: { customer?: unknown },
  expectedCustomerId: string
): void {
  if (session.customer === undefined || session.customer === null) return;

  const sessionCustomerId =
    typeof session.customer === 'string'
      ? assertStripeProviderId('Stripe portal session customer id', session.customer)
      : typeof session.customer === 'object' && !Array.isArray(session.customer)
        ? assertStripeProviderId(
            'Stripe portal session customer id',
            (session.customer as { id?: unknown }).id
          )
        : (() => {
            throw new Error('Stripe portal session customer must be a string or object');
          })();

  if (sessionCustomerId !== expectedCustomerId) {
    throw new Error('Stripe portal session customer id must match persisted subscription stripe_customer_id');
  }
}

function stripeEventCreatedAt(metadata?: unknown): number {
  const value = validatedPersistedSubscriptionMetadata(metadata)?.stripe_last_event_created;
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function shouldApplyStripeEvent(
  localSubscription: Subscription,
  eventCreated: number
): boolean {
  dateFromStripeSeconds('Stripe event created timestamp', eventCreated);
  return eventCreated >= stripeEventCreatedAt(localSubscription.metadata);
}

function updateStripeEventMetadata(
  localSubscription: Subscription,
  eventType: string,
  eventCreated: number
): void {
  assertSupportedStripeWebhookEvent(
    eventType,
    SUPPORTED_SUBSCRIPTION_WEBHOOK_EVENTS,
    'Stripe subscription metadata event type'
  );
  const metadata = validatedPersistedSubscriptionMetadata(localSubscription.metadata) || {};
  localSubscription.metadata = {
    ...metadata,
    stripe_last_event_type: eventType,
    stripe_last_event_created: eventCreated,
  };
}

function clearTrialWillEndMetadata(localSubscription: Subscription): void {
  const metadata = validatedPersistedSubscriptionMetadata(localSubscription.metadata);
  if (
    !metadata ||
    (
      metadata.trial_will_end_subscription_id === undefined &&
      metadata.trial_will_end_at === undefined
    )
  ) {
    return;
  }

  const {
    trial_will_end_subscription_id: _trialWillEndSubscriptionId,
    trial_will_end_at: _trialWillEndAt,
    ...remainingMetadata
  } = metadata;
  localSubscription.metadata = remainingMetadata;
}

function assertSupportedStripeWebhookEvent(
  eventType: unknown,
  allowedEvents: Set<string>,
  label: string
): string {
  if (typeof eventType !== 'string' || !allowedEvents.has(eventType)) {
    throw new Error(`${label} must be a supported subscription webhook event`);
  }
  return eventType;
}

function assertStripeSubscriptionCustomerMatchesLocal(
  localSubscription: Subscription,
  stripeSubscription: { customer?: unknown }
): void {
  if (stripeSubscription.customer === undefined || stripeSubscription.customer === null) return;

  const localStripeCustomerId = assertOptionalStripeProviderId(
    'persisted subscription stripe_customer_id',
    localSubscription.stripe_customer_id
  );
  if (!localStripeCustomerId) return;

  const stripeCustomerId =
    typeof stripeSubscription.customer === 'string'
      ? assertStripeProviderId('Stripe subscription customer id', stripeSubscription.customer)
      : typeof stripeSubscription.customer === 'object' && !Array.isArray(stripeSubscription.customer)
        ? assertStripeProviderId(
            'Stripe subscription customer id',
            (stripeSubscription.customer as { id?: unknown }).id
          )
        : (() => {
            throw new Error('Stripe subscription customer must be a string or object');
          })();

  if (stripeCustomerId !== localStripeCustomerId) {
    throw new Error('Stripe subscription customer id must match persisted subscription stripe_customer_id');
  }
}

function assertStripeSubscriptionMetadataMatchesLocal(
  localSubscription: Subscription,
  stripeSubscription: { metadata?: unknown }
): void {
  if (stripeSubscription.metadata === undefined || stripeSubscription.metadata === null) return;
  if (typeof stripeSubscription.metadata !== 'object' || Array.isArray(stripeSubscription.metadata)) {
    throw new Error('Stripe subscription metadata must be an object');
  }

  const metadata = stripeSubscription.metadata as Record<string, unknown>;
  assertStripeSubscriptionMetadataKeys(metadata);
  if (metadata.business_id !== undefined) {
    const metadataBusinessId = assertNonEmptyString(
      'Stripe subscription metadata business_id',
      metadata.business_id
    );
    const localBusinessId = assertNonEmptyString(
      'persisted subscription business_id',
      localSubscription.business_id
    );
    if (metadataBusinessId !== localBusinessId) {
      throw new Error('Stripe subscription metadata business_id must match persisted subscription business_id');
    }
  }

  if (metadata.tier !== undefined) {
    const metadataTier = assertSupportedSubscriptionTier(
      metadata.tier,
      'Stripe subscription metadata tier'
    );
    if (metadataTier !== localSubscription.tier) {
      throw new Error('Stripe subscription metadata tier must match persisted subscription tier');
    }
  }
}

function assertStripeSubscriptionMetadataKeys(metadata: Record<string, unknown>): void {
  const metadataKeys = Object.keys(metadata);
  assertSubscriptionFieldNamesAreSafe('Stripe subscription metadata', metadataKeys);
  const unsupportedKeys = metadataKeys.filter(
    (key) => !STRIPE_SUBSCRIPTION_METADATA_KEYS.has(key)
  );
  if (unsupportedKeys.length > 0) {
    throw new Error(
      `Stripe subscription metadata include unsupported field(s): ${unsupportedKeys.sort().join(', ')}`
    );
  }
}

function assertStripeSubscriptionIdentityMatchesLocal(
  localSubscription: Subscription,
  stripeSubscription: { customer?: unknown; metadata?: unknown }
): void {
  assertStripeSubscriptionCustomerMatchesLocal(localSubscription, stripeSubscription);
  assertStripeSubscriptionMetadataMatchesLocal(localSubscription, stripeSubscription);
}

function assertStripeSubscriptionPayloadEnvelope(
  label: string,
  value: unknown
): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function assertStripeSubscriptionCreationIdentity(
  stripeSubscription: { customer?: unknown; metadata?: unknown },
  expected: { stripeCustomerId: string; businessId: string; tier: SubscriptionTier }
): void {
  if (stripeSubscription.customer !== undefined && stripeSubscription.customer !== null) {
    const stripeCustomerId =
      typeof stripeSubscription.customer === 'string'
        ? assertStripeProviderId('Stripe subscription customer id', stripeSubscription.customer)
        : typeof stripeSubscription.customer === 'object' && !Array.isArray(stripeSubscription.customer)
          ? assertStripeProviderId(
              'Stripe subscription customer id',
              (stripeSubscription.customer as { id?: unknown }).id
            )
          : (() => {
              throw new Error('Stripe subscription customer must be a string or object');
            })();

    if (stripeCustomerId !== expected.stripeCustomerId) {
      throw new Error('Stripe subscription customer id must match requested Stripe customer id');
    }
  }

  if (stripeSubscription.metadata === undefined || stripeSubscription.metadata === null) return;
  if (typeof stripeSubscription.metadata !== 'object' || Array.isArray(stripeSubscription.metadata)) {
    throw new Error('Stripe subscription metadata must be an object');
  }

  const metadata = stripeSubscription.metadata as Record<string, unknown>;
  assertStripeSubscriptionMetadataKeys(metadata);
  if (metadata.business_id !== undefined) {
    const metadataBusinessId = assertNonEmptyString(
      'Stripe subscription metadata business_id',
      metadata.business_id
    );
    if (metadataBusinessId !== expected.businessId) {
      throw new Error('Stripe subscription metadata business_id must match requested subscription business_id');
    }
  }

  if (metadata.tier !== undefined) {
    const metadataTier = assertSupportedSubscriptionTier(
      metadata.tier,
      'Stripe subscription metadata tier'
    );
    if (metadataTier !== expected.tier) {
      throw new Error('Stripe subscription metadata tier must match requested subscription tier');
    }
  }
}

export function applyStripeSubscriptionSnapshot(
  localSubscription: Subscription,
  stripeSubscription: Pick<
    Stripe.Subscription,
    | 'status'
    | 'cancel_at_period_end'
    | 'canceled_at'
    | 'trial_start'
    | 'trial_end'
    | 'customer'
    | 'metadata'
  > & {
    current_period_start?: number;
    current_period_end?: number;
  },
  eventType: string,
  eventCreated: number
): SubscriptionWebhookApplyResult {
  const normalizedEventType = assertSupportedStripeWebhookEvent(
    eventType,
    SNAPSHOT_SUBSCRIPTION_WEBHOOK_EVENTS,
    'Stripe subscription snapshot event type'
  );
  const normalizedStripeSubscription = assertStripeSubscriptionPayloadEnvelope(
    'Stripe subscription snapshot payload',
    stripeSubscription
  ) as typeof stripeSubscription;
  assertStripeSubscriptionIdentityMatchesLocal(localSubscription, normalizedStripeSubscription);
  if (!shouldApplyStripeEvent(localSubscription, eventCreated)) {
    return { applied: false, reason: 'stale_event' };
  }

  const periodStart = timestampFromStripeSeconds(
    'Stripe subscription current_period_start',
    normalizedStripeSubscription.current_period_start
  );
  const periodEnd = timestampFromStripeSeconds(
    'Stripe subscription current_period_end',
    normalizedStripeSubscription.current_period_end
  );
  if ((periodStart && !periodEnd) || (!periodStart && periodEnd)) {
    throw new Error('Stripe subscription billing period must include both current_period_start and current_period_end');
  }
  if (periodStart && periodEnd && periodStart > periodEnd) {
    throw new Error('Stripe subscription current_period_start cannot be after current_period_end');
  }

  const canceledAt = timestampFromStripeSeconds(
    'Stripe subscription canceled_at',
    normalizedStripeSubscription.canceled_at
  );
  const snapshotHasTrialFields =
    Object.prototype.hasOwnProperty.call(normalizedStripeSubscription, 'trial_start') &&
    Object.prototype.hasOwnProperty.call(normalizedStripeSubscription, 'trial_end');
  const trialStart = timestampFromStripeSeconds('Stripe subscription trial_start', normalizedStripeSubscription.trial_start);
  const trialEnd = timestampFromStripeSeconds('Stripe subscription trial_end', normalizedStripeSubscription.trial_end);
  if ((trialStart && !trialEnd) || (!trialStart && trialEnd)) {
    throw new Error('Stripe subscription trial period must include both trial_start and trial_end');
  }
  if (trialStart && trialEnd && trialStart > trialEnd) {
    throw new Error('Stripe subscription trial_start cannot be after trial_end');
  }

  const subscriptionStatus = normalizeSubscriptionStatus(normalizedStripeSubscription.status);
  if (subscriptionStatus !== 'canceled' && (!periodStart || !periodEnd)) {
    throw new Error('Stripe subscription billing period is required when status is not canceled');
  }
  if (subscriptionStatus === 'trialing' && (!trialStart || !trialEnd)) {
    throw new Error('Stripe trialing subscription must include trial period');
  }
  const cancelAtPeriodEnd = assertStripeSnapshotCancellationFlag(
    normalizedStripeSubscription.cancel_at_period_end
  );
  if (subscriptionStatus === 'canceled') {
    if (!canceledAt) {
      throw new Error('Stripe subscription canceled_at is required when status is canceled');
    }
    if (cancelAtPeriodEnd) {
      throw new Error('Stripe canceled subscription cannot still be marked cancel_at_period_end');
    }
  } else if (canceledAt) {
    if (!cancelAtPeriodEnd) {
      throw new Error('Stripe non-canceled subscription cannot include canceled_at unless cancel_at_period_end is true');
    }
    if (!periodStart || !periodEnd) {
      throw new Error('Stripe scheduled cancellation must include billing period');
    }
    assertDateWithinBillingPeriod(
      'Stripe scheduled subscription canceled_at',
      canceledAt,
      { periodStart, periodEnd }
    );
  }
  const eventCreatedAt = dateFromStripeSeconds('Stripe event created timestamp', eventCreated);
  if (canceledAt && canceledAt > eventCreatedAt) {
    throw new Error('Stripe subscription canceled_at cannot be after event created timestamp');
  }

  localSubscription.status = subscriptionStatus;
  if (periodStart) localSubscription.current_period_start = periodStart;
  if (periodEnd) localSubscription.current_period_end = periodEnd;
  localSubscription.cancel_at_period_end = cancelAtPeriodEnd;

  if (canceledAt) {
    localSubscription.canceled_at = canceledAt;
  } else if (localSubscription.status !== 'canceled') {
    localSubscription.canceled_at = null;
  }

  if (trialStart && trialEnd) {
    localSubscription.trial_start = trialStart;
    localSubscription.trial_end = trialEnd;
  } else if (snapshotHasTrialFields) {
    localSubscription.trial_start = null;
    localSubscription.trial_end = null;
    clearTrialWillEndMetadata(localSubscription);
  }

  updateStripeEventMetadata(localSubscription, normalizedEventType, eventCreated);
  return { applied: true, reason: 'applied' };
}

export function applyStripeSubscriptionDeleted(
  localSubscription: Subscription,
  stripeSubscription: Pick<Stripe.Subscription, 'canceled_at' | 'customer' | 'metadata'>,
  eventType: string,
  eventCreated: number
): SubscriptionWebhookApplyResult {
  const normalizedEventType = assertSupportedStripeWebhookEvent(
    eventType,
    DELETED_SUBSCRIPTION_WEBHOOK_EVENTS,
    'Stripe subscription deletion event type'
  );
  const normalizedStripeSubscription = assertStripeSubscriptionPayloadEnvelope(
    'Stripe subscription deletion payload',
    stripeSubscription
  ) as typeof stripeSubscription;
  assertStripeSubscriptionIdentityMatchesLocal(localSubscription, normalizedStripeSubscription);
  if (!shouldApplyStripeEvent(localSubscription, eventCreated)) {
    return { applied: false, reason: 'stale_event' };
  }

  const eventCreatedAt = dateFromStripeSeconds('Stripe event created timestamp', eventCreated);
  const providerCanceledAt = timestampFromStripeSeconds(
    'Stripe subscription canceled_at',
    normalizedStripeSubscription.canceled_at
  );
  if (providerCanceledAt && providerCanceledAt > eventCreatedAt) {
    throw new Error('Stripe subscription canceled_at cannot be after event created timestamp');
  }

  localSubscription.status = 'canceled';
  localSubscription.cancel_at_period_end = false;
  localSubscription.canceled_at = providerCanceledAt || eventCreatedAt;
  localSubscription.trial_start = null;
  localSubscription.trial_end = null;
  clearTrialWillEndMetadata(localSubscription);
  updateStripeEventMetadata(localSubscription, normalizedEventType, eventCreated);
  return { applied: true, reason: 'applied' };
}

export function getSubscriptionBillingPeriod(
  subscription: Pick<Subscription, 'current_period_start' | 'current_period_end'>,
  now: Date = new Date()
): { periodStart: Date; periodEnd: Date } {
  const hasPeriodStart = subscription.current_period_start !== undefined && subscription.current_period_start !== null;
  const hasPeriodEnd = subscription.current_period_end !== undefined && subscription.current_period_end !== null;

  if (hasPeriodStart || hasPeriodEnd) {
    if (!hasPeriodStart || !hasPeriodEnd) {
      throw new Error('subscription billing period must include both current_period_start and current_period_end');
    }
    if (
      !(subscription.current_period_start instanceof Date) ||
      Number.isNaN(subscription.current_period_start.getTime())
    ) {
      throw new Error('subscription current_period_start must be a valid Date');
    }
    if (
      !(subscription.current_period_end instanceof Date) ||
      Number.isNaN(subscription.current_period_end.getTime())
    ) {
      throw new Error('subscription current_period_end must be a valid Date');
    }
    if (subscription.current_period_start > subscription.current_period_end) {
      throw new Error('subscription current_period_start cannot be after current_period_end');
    }

    return {
      periodStart: subscription.current_period_start,
      periodEnd: subscription.current_period_end,
    };
  }

  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new Error('subscription billing period fallback clock must be a valid Date');
  }

  const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
  const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0) - 1);
  return { periodStart, periodEnd };
}

export function evaluateSubscriptionOrderLimit(
  subscription: Pick<Subscription, 'getMaxOrders'>,
  orderCount: number
): SubscriptionOrderLimitDecision {
  if (!Number.isSafeInteger(orderCount) || orderCount < 0) {
    throw new Error('orderCount must be a non-negative safe integer');
  }

  const limit = subscription.getMaxOrders();
  if (limit !== -1 && (!Number.isSafeInteger(limit) || limit < 0)) {
    throw new Error('subscription order limit must be a non-negative safe integer or -1 for unlimited');
  }

  if (limit === -1) {
    return { allowed: true, current: orderCount, limit: -1, isUnlimited: true };
  }

  return {
    allowed: orderCount < limit,
    current: orderCount,
    limit,
    isUnlimited: false,
  };
}

/**
 * Subscription service for managing Stripe Billing and subscription tiers
 */
export class SubscriptionService {
  private stripe?: Stripe;
  private subscriptionRepository: Repository<Subscription>;
  private businessRepository: Repository<Business>;
  private orderRepository: Repository<Order>;
  private readonly enforceCapability: boolean;

  constructor(options: SubscriptionServiceOptions = {}) {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    this.enforceCapability = options.enforceCapability !== false;
    const capabilityDisabled =
      this.enforceCapability && getCapability('subscriptions')?.status !== 'implemented';

    if (options.stripe) {
      this.stripe = options.stripe;
    } else if (stripeSecretKey) {
      this.stripe = new Stripe(stripeSecretKey, {
        apiVersion: '2024-11-20.acacia' as any,
        typescript: true,
      });
    } else if (options.requireStripe !== false && !capabilityDisabled) {
      throw new Error('STRIPE_SECRET_KEY environment variable is required');
    }

    this.subscriptionRepository = options.subscriptionRepository ?? AppDataSource.getRepository(Subscription);
    this.businessRepository = options.businessRepository ?? AppDataSource.getRepository(Business);
    this.orderRepository = options.orderRepository ?? AppDataSource.getRepository(Order);
  }

  private getStripeClient(): Stripe {
    if (!this.stripe) {
      const error = new Error('Stripe billing is not configured') as Error & {
        statusCode: number;
        code: string;
      };
      error.statusCode = 503;
      error.code = 'STRIPE_NOT_CONFIGURED';
      throw error;
    }
    return this.stripe;
  }

  /**
   * Create a Stripe customer for a business
   */
  async createStripeCustomer(business: Business, email?: string): Promise<string> {
    this.assertSubscriptionsEnabled();
    const normalizedBusiness = normalizeStripeCustomerBusiness(business);
    const normalizedEmail =
      normalizeOptionalEmail('subscription customer email', email) || normalizedBusiness.email;

    try {
      const customer = await this.getStripeClient().customers.create({
        email: normalizedEmail,
        name: normalizedBusiness.name,
        metadata: {
          business_id: normalizedBusiness.id,
          business_name: normalizedBusiness.name,
        },
      });

      assertStripeCustomerCreationIdentity(customer as unknown as Record<string, unknown>, {
        businessId: normalizedBusiness.id,
        businessName: normalizedBusiness.name,
        email: normalizedEmail,
      });
      return assertStripeProviderId('Stripe customer id', customer.id);
    } catch (error) {
      if (isServiceBoundaryError(error)) throw error;
      const stripeError = error as Stripe.errors.StripeError;
      const customError = new Error(`Failed to create Stripe customer: ${stripeError.message}`) as Error & {
        statusCode: number;
        code: string;
      };
      customError.statusCode = 500;
      customError.code = 'STRIPE_CUSTOMER_CREATION_FAILED';
      throw customError;
    }
  }

  /**
   * Create or upgrade a subscription
   */
  async createSubscription(
    businessId: string,
    tier: SubscriptionTier,
    options?: {
      trialDays?: number;
      email?: string;
    }
  ): Promise<{ subscription: Subscription; clientSecret?: string }> {
    this.assertSubscriptionsEnabled();
    const normalizedBusinessId = assertNonEmptyString('subscription business_id', businessId);
    const requestedTier = assertSupportedSubscriptionTier(tier, 'subscription tier');
    const normalizedOptions = normalizeSubscriptionCreationOptions(options);
    const normalizedCustomerEmail = normalizeOptionalEmail('subscription customer email', normalizedOptions.email);
    const requestedTrialDays = assertSubscriptionTrialDays(normalizedOptions.trialDays);
    try {
      // Get business
      const business = await this.businessRepository.findOne({
        where: { id: normalizedBusinessId },
      });

      if (!business) {
        const error = new Error('Business not found') as Error & {
          statusCode: number;
          code: string;
        };
        error.statusCode = 404;
        error.code = 'BUSINESS_NOT_FOUND';
        throw error;
      }
      assertBusinessMatchesSubscriptionRequest(business, normalizedBusinessId);

      // Get or create subscription record
      let subscription = await this.subscriptionRepository.findOne({
        where: { business_id: normalizedBusinessId },
      });

      if (!subscription) {
        subscription = this.subscriptionRepository.create({
          business_id: normalizedBusinessId,
          tier: 'free',
          status: 'active',
          cancel_at_period_end: false,
        });
        await this.subscriptionRepository.save(subscription);
      }
      assertPersistedSubscriptionShape(subscription, { businessId: normalizedBusinessId });

      // If upgrading to free tier, cancel any existing Stripe subscription
      if (requestedTier === 'free') {
        if (subscription.stripe_subscription_id) {
          await this.cancelSubscription(normalizedBusinessId);
        }

        subscription.tier = 'free';
        subscription.status = 'active';
        subscription.cancel_at_period_end = false;
        subscription.stripe_subscription_id = null;
        subscription.stripe_price_id = null;
        subscription.current_period_start = null;
        subscription.current_period_end = null;
        subscription.canceled_at = null;
        subscription.trial_start = null;
        subscription.trial_end = null;
        subscription.metadata = null;

        await this.subscriptionRepository.save(subscription);

        return { subscription };
      }

      // For paid tiers, create Stripe subscription
      const tierConfig = SUBSCRIPTION_TIERS[requestedTier];

      // Create or get Stripe customer
      if (!subscription.stripe_customer_id) {
        const customerId = await this.createStripeCustomer(business, normalizedCustomerEmail);
        subscription.stripe_customer_id = customerId;
        await this.subscriptionRepository.save(subscription);
      }
      const stripeCustomerId = assertStripeProviderId(
        'persisted subscription stripe_customer_id',
        subscription.stripe_customer_id
      );

      // Create Stripe subscription
      const stripeSubscription = await this.getStripeClient().subscriptions.create({
        customer: stripeCustomerId,
        items: [{ price: tierConfig.priceId! }],
        trial_period_days: requestedTrialDays,
        payment_behavior: 'default_incomplete',
        payment_settings: {
          payment_method_types: ['card'],
          save_default_payment_method: 'on_subscription',
        },
        expand: ['latest_invoice.payment_intent'],
        metadata: {
          business_id: normalizedBusinessId,
          tier: requestedTier,
        },
      });

      const lifecycleDates = requireStripeSubscriptionCreationDates(stripeSubscription as any);
      const stripeStatus = normalizeSubscriptionStatus(stripeSubscription.status);
      const stripeSubscriptionId = assertStripeProviderId(
        'Stripe subscription id',
        stripeSubscription.id
      );
      assertStripeSubscriptionCreationIdentity(stripeSubscription as any, {
        stripeCustomerId,
        businessId: normalizedBusinessId,
        tier: requestedTier,
      });
      if (stripeStatus === 'trialing' && (!lifecycleDates.trialStart || !lifecycleDates.trialEnd)) {
        throw new Error('Stripe trialing subscription must include trial period');
      }
      const stripePriceId = requireStripeSubscriptionPriceEvidence(
        stripeSubscription as any,
        tierConfig.priceId!
      );
      const clientSecret = normalizeStripePaymentClientSecret(stripeSubscription as any);

      // Update subscription record
      subscription.tier = requestedTier;
      subscription.status = stripeStatus;
      subscription.stripe_subscription_id = stripeSubscriptionId;
      subscription.stripe_price_id = stripePriceId;
      subscription.current_period_start = lifecycleDates.currentPeriodStart;
      subscription.current_period_end = lifecycleDates.currentPeriodEnd;

      if (lifecycleDates.trialStart && lifecycleDates.trialEnd) {
        subscription.trial_start = lifecycleDates.trialStart;
        subscription.trial_end = lifecycleDates.trialEnd;
      }

      await this.subscriptionRepository.save(subscription);

      // Log metric
      if (process.env.NODE_ENV === 'production') {
        logMetric(console as any, 'subscription_created', tierConfig.price / 100, {
          businessId: normalizedBusinessId,
          tier: requestedTier,
        });
      }

      return clientSecret ? { subscription, clientSecret } : { subscription };
    } catch (error) {
      if (isServiceBoundaryError(error)) throw error;
      const stripeError = error as Stripe.errors.StripeError;
      const customError = new Error(`Failed to create subscription: ${stripeError.message}`) as Error & {
        statusCode: number;
        code: string;
        details: unknown;
      };
      customError.statusCode = 500;
      customError.code = 'SUBSCRIPTION_CREATION_FAILED';
      customError.details = stripeError;
      throw customError;
    }
  }

  /**
   * Cancel a subscription
   */
  async cancelSubscription(
    businessId: string,
    options?: {
      immediate?: boolean; // Cancel immediately vs. at period end
    }
  ): Promise<Subscription> {
    this.assertSubscriptionsEnabled();
    const normalizedBusinessId = assertNonEmptyString('subscription business_id', businessId);
    const normalizedOptions = normalizeSubscriptionCancellationOptions(options);
    try {
      const subscription = await this.subscriptionRepository.findOne({
        where: { business_id: normalizedBusinessId },
      });

      if (!subscription) {
        const error = new Error('Subscription not found') as Error & {
          statusCode: number;
          code: string;
        };
        error.statusCode = 404;
        error.code = 'SUBSCRIPTION_NOT_FOUND';
        throw error;
      }
      assertPersistedSubscriptionShape(subscription, { businessId: normalizedBusinessId });

      if (!subscription.stripe_subscription_id) {
        // Free tier, just mark as canceled
        subscription.status = 'canceled';
        subscription.cancel_at_period_end = false;
        subscription.canceled_at = new Date();
        await this.subscriptionRepository.save(subscription);
        return subscription;
      }
      const stripeSubscriptionId = assertStripeProviderId(
        'persisted subscription stripe_subscription_id',
        subscription.stripe_subscription_id
      );

      // Cancel Stripe subscription
      if (normalizedOptions.immediate) {
        const canceledStripeSubscription = await this.getStripeClient().subscriptions.cancel(stripeSubscriptionId);
        const providerCanceledAt = assertStripeImmediateCancellationResponse(
          canceledStripeSubscription,
          stripeSubscriptionId
        );
        assertStripeSubscriptionIdentityMatchesLocal(subscription, canceledStripeSubscription as any);
        subscription.status = 'canceled';
        subscription.cancel_at_period_end = false;
        subscription.canceled_at = providerCanceledAt;
      } else {
        const updatedStripeSubscription = await this.getStripeClient().subscriptions.update(stripeSubscriptionId, {
          cancel_at_period_end: true,
        });
        assertStripeScheduledCancellationResponse(
          updatedStripeSubscription,
          stripeSubscriptionId
        );
        assertStripeSubscriptionIdentityMatchesLocal(subscription, updatedStripeSubscription as any);
        subscription.cancel_at_period_end = true;
      }

      await this.subscriptionRepository.save(subscription);

      return subscription;
    } catch (error) {
      if (isServiceBoundaryError(error)) throw error;
      const stripeError = error as Stripe.errors.StripeError;
      const customError = new Error(`Failed to cancel subscription: ${stripeError.message}`) as Error & {
        statusCode: number;
        code: string;
      };
      customError.statusCode = 500;
      customError.code = 'SUBSCRIPTION_CANCELLATION_FAILED';
      throw customError;
    }
  }

  /**
   * Resume a canceled subscription
   */
  async resumeSubscription(businessId: string): Promise<Subscription> {
    this.assertSubscriptionsEnabled();
    const normalizedBusinessId = assertNonEmptyString('subscription business_id', businessId);
    try {
      const subscription = await this.subscriptionRepository.findOne({
        where: { business_id: normalizedBusinessId },
      });

      if (!subscription || !subscription.stripe_subscription_id) {
        const error = new Error('Subscription not found') as Error & {
          statusCode: number;
          code: string;
        };
        error.statusCode = 404;
        error.code = 'SUBSCRIPTION_NOT_FOUND';
        throw error;
      }
      assertPersistedSubscriptionShape(subscription, { businessId: normalizedBusinessId });
      const stripeSubscriptionId = assertStripeProviderId(
        'persisted subscription stripe_subscription_id',
        subscription.stripe_subscription_id
      );

      // Resume Stripe subscription
      const updatedStripeSubscription = await this.getStripeClient().subscriptions.update(stripeSubscriptionId, {
        cancel_at_period_end: false,
      });
      assertStripeResumeResponse(updatedStripeSubscription, stripeSubscriptionId);
      assertStripeSubscriptionIdentityMatchesLocal(subscription, updatedStripeSubscription as any);

      subscription.cancel_at_period_end = false;
      subscription.canceled_at = null;

      await this.subscriptionRepository.save(subscription);

      return subscription;
    } catch (error) {
      if (isServiceBoundaryError(error)) throw error;
      const stripeError = error as Stripe.errors.StripeError;
      const customError = new Error(`Failed to resume subscription: ${stripeError.message}`) as Error & {
        statusCode: number;
        code: string;
      };
      customError.statusCode = 500;
      customError.code = 'SUBSCRIPTION_RESUME_FAILED';
      throw customError;
    }
  }

  /**
   * Get subscription by business ID
   */
  async getSubscription(businessId: string): Promise<Subscription | null> {
    this.assertSubscriptionsEnabled();
    const normalizedBusinessId = assertNonEmptyString('subscription business_id', businessId);
    const subscription = await this.subscriptionRepository.findOne({
      where: { business_id: normalizedBusinessId },
      relations: ['business'],
    });

    if (!subscription) return null;
    return assertPersistedSubscriptionShape(subscription, { businessId: normalizedBusinessId });
  }

  /**
   * Handle Stripe subscription webhooks
   */
  async handleSubscriptionWebhook(event: Stripe.Event): Promise<SubscriptionWebhookApplyResult | null> {
    this.assertSubscriptionsEnabled();
    if (!SUPPORTED_SUBSCRIPTION_WEBHOOK_EVENTS.has(event.type)) {
      return null;
    }

    const eventCreated = (() => {
      dateFromStripeSeconds('Stripe event created timestamp', event.created);
      return event.created;
    })();
    const subscription = assertStripeSubscriptionPayloadEnvelope(
      'Stripe subscription webhook payload',
      (event as { data?: { object?: unknown } }).data?.object
    ) as unknown as Stripe.Subscription;
    const normalizedStripeSubscriptionId = assertStripeProviderId(
      'Stripe subscription id',
      subscription.id
    );

    const localSubscription = await this.subscriptionRepository.findOne({
      where: { stripe_subscription_id: normalizedStripeSubscriptionId },
    });

    if (!localSubscription) {
      console.error(`Subscription not found for Stripe subscription: ${normalizedStripeSubscriptionId}`);
      return null;
    }
    assertPersistedSubscriptionShape(localSubscription, { stripeSubscriptionId: normalizedStripeSubscriptionId });
    assertStripeSubscriptionIdentityMatchesLocal(localSubscription, subscription as any);

    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const result = applyStripeSubscriptionSnapshot(
          localSubscription,
          subscription as any,
          event.type,
          eventCreated
        );
        if (result.applied) {
          await this.subscriptionRepository.save(localSubscription);
        }
        return result;
      }

      case 'customer.subscription.deleted': {
        const result = applyStripeSubscriptionDeleted(
          localSubscription,
          subscription,
          event.type,
          eventCreated
        );
        if (result.applied) {
          await this.subscriptionRepository.save(localSubscription);
        }
        return result;
      }

      case 'customer.subscription.trial_will_end':
        if (!shouldApplyStripeEvent(localSubscription, eventCreated)) {
          return { applied: false, reason: 'stale_event' };
        }
        const trialWillEndAt = timestampFromStripeSeconds(
          'Stripe subscription trial_end',
          subscription.trial_end
        );
        if (!trialWillEndAt) {
          throw new Error('Stripe subscription trial_end is required for trial_will_end events');
        }
        const persistedTrialEnd = assertOptionalDate(
          'persisted subscription trial_end',
          localSubscription.trial_end
        );
        if (!persistedTrialEnd) {
          throw new Error('persisted subscription trial_end is required before trial_will_end metadata');
        }
        if (persistedTrialEnd.getTime() !== trialWillEndAt.getTime()) {
          throw new Error('Stripe subscription trial_end must match persisted trial_end before trial_will_end metadata');
        }
        const persistedTrialStart = assertOptionalDate(
          'persisted subscription trial_start',
          localSubscription.trial_start
        );
        const trialWillEndEventCreated = dateFromStripeSeconds(
          'Stripe event created timestamp',
          eventCreated
        );
        if (persistedTrialStart && trialWillEndEventCreated < persistedTrialStart) {
          throw new Error('Stripe subscription trial_will_end event cannot be before persisted trial_start');
        }
        if (trialWillEndEventCreated > trialWillEndAt) {
          throw new Error('Stripe subscription trial_will_end event cannot be after trial_end');
        }
        updateStripeEventMetadata(localSubscription, event.type, eventCreated);
        localSubscription.metadata = {
          ...(localSubscription.metadata || {}),
          trial_will_end_subscription_id: normalizedStripeSubscriptionId,
          trial_will_end_at: trialWillEndAt.toISOString(),
        };
        await this.subscriptionRepository.save(localSubscription);
        return { applied: true, reason: 'applied' };
    }

    return null;
  }

  /**
   * Check if business has reached order limit for current billing period
   */
  async checkOrderLimit(businessId: string): Promise<{
    allowed: boolean;
    current: number;
    limit: number;
    isUnlimited: boolean;
  }> {
    this.assertSubscriptionsEnabled();
    const normalizedBusinessId = assertNonEmptyString('subscription business_id', businessId);
    const subscription = await this.getSubscription(normalizedBusinessId);

    if (!subscription) {
      return { allowed: false, current: 0, limit: 0, isUnlimited: false };
    }

    assertSupportedSubscriptionTier(subscription.tier, 'subscription tier');
    const subscriptionStatus = assertSupportedSubscriptionStatus(subscription.status, 'subscription status');
    if (!ENTITLED_SUBSCRIPTION_STATUSES.has(subscriptionStatus)) {
      return { allowed: false, current: 0, limit: 0, isUnlimited: false };
    }
    const { periodStart, periodEnd } = getSubscriptionBillingPeriod(subscription);

    const orderCount = await this.orderRepository.count({
      where: {
        business_id: normalizedBusinessId,
        created_at: Between(periodStart, periodEnd),
      },
    });

    return evaluateSubscriptionOrderLimit(subscription, orderCount);
  }

  /**
   * Create Stripe Customer Portal session for subscription management
   */
  async createPortalSession(businessId: string, returnUrl: string): Promise<string> {
    this.assertSubscriptionsEnabled();
    const normalizedBusinessId = assertNonEmptyString('subscription business_id', businessId);
    const validatedReturnUrl = assertAbsoluteHttpUrl('subscription portal return_url', returnUrl, {
      maxLength: MAX_SUBSCRIPTION_PORTAL_URL_LENGTH,
    });

    try {
      const subscription = await this.getSubscription(normalizedBusinessId);

      if (!subscription || !subscription.stripe_customer_id) {
        const error = new Error('No Stripe customer found') as Error & {
          statusCode: number;
          code: string;
        };
        error.statusCode = 404;
        error.code = 'STRIPE_CUSTOMER_NOT_FOUND';
        throw error;
      }
      const stripeCustomerId = assertStripeProviderId(
        'persisted subscription stripe_customer_id',
        subscription.stripe_customer_id
      );

      const session = await this.getStripeClient().billingPortal.sessions.create({
        customer: stripeCustomerId,
        return_url: validatedReturnUrl,
      });

      assertStripePortalSessionCustomerIdentity(session as unknown as { customer?: unknown }, stripeCustomerId);
      return assertAbsoluteHttpUrl('Stripe portal session URL', session.url, {
        requireHttps: true,
        maxLength: MAX_SUBSCRIPTION_PORTAL_URL_LENGTH,
      });
    } catch (error) {
      if (isServiceBoundaryError(error)) throw error;
      const stripeError = error as Stripe.errors.StripeError;
      const customError = new Error(`Failed to create portal session: ${stripeError.message}`) as Error & {
        statusCode: number;
        code: string;
      };
      customError.statusCode = 500;
      customError.code = 'PORTAL_SESSION_FAILED';
      throw customError;
    }
  }

  /**
   * Get all subscriptions (admin)
   */
  async getAllSubscriptions(filters?: {
    tier?: SubscriptionTier;
    status?: string;
  }): Promise<Subscription[]> {
    this.assertSubscriptionsEnabled();
    if (filters !== undefined && (!filters || typeof filters !== 'object' || Array.isArray(filters))) {
      throw new Error('subscription admin filters must be an object');
    }
    const filterKeys = Object.keys(filters ?? {});
    assertSubscriptionFieldNamesAreSafe('subscription admin filters', filterKeys);
    for (const filterKey of filterKeys) {
      if (!['tier', 'status'].includes(filterKey)) {
        throw new Error(`subscription admin filter ${filterKey} is not supported`);
      }
    }

    const where: any = {};
    const normalizedFilters: {
      tier?: SubscriptionTier;
      status?: Subscription['status'];
    } = {};
    if (filters?.tier !== undefined) {
      normalizedFilters.tier = assertSupportedSubscriptionTier(filters.tier);
      where.tier = normalizedFilters.tier;
    }
    if (filters?.status !== undefined) {
      normalizedFilters.status = assertSupportedSubscriptionStatus(filters.status);
      where.status = normalizedFilters.status;
    }

    const subscriptions = await this.subscriptionRepository.find({
      where,
      relations: ['business'],
      order: { created_at: 'DESC' },
    });
    const seenSubscriptionIds = new Set<string>();
    const seenBusinessIds = new Set<string>();
    const seenStripeCustomerIds = new Set<string>();
    const seenStripeSubscriptionIds = new Set<string>();
    return subscriptions.map((subscription, index) => {
      const label = `persisted subscription admin row ${index + 1}`;
      assertPersistedSubscriptionAdminRowEnvelope(subscription, label);
      const persistedSubscription = assertPersistedSubscriptionShape(subscription);
      if (persistedSubscription.id) {
        const persistedSubscriptionId = assertNonEmptyString(
          `${label} id`,
          persistedSubscription.id
        );
        if (seenSubscriptionIds.has(persistedSubscriptionId)) {
          throw subscriptionDataIntegrityError(
            `${label} id must be unique`
          );
        }
        seenSubscriptionIds.add(persistedSubscriptionId);
      }
      const persistedBusinessId = assertNonEmptyString(
        `${label} business_id`,
        persistedSubscription.business_id
      );
      if (seenBusinessIds.has(persistedBusinessId)) {
        throw subscriptionDataIntegrityError(
          `${label} business_id must be unique`
        );
      }
      seenBusinessIds.add(persistedBusinessId);
      assertPersistedSubscriptionMatchesAdminFilters(
        persistedSubscription,
        normalizedFilters,
        label
      );
      if (persistedSubscription.stripe_customer_id) {
        const persistedStripeCustomerId = assertStripeProviderId(
          `${label} stripe_customer_id`,
          persistedSubscription.stripe_customer_id
        );
        if (seenStripeCustomerIds.has(persistedStripeCustomerId)) {
          throw subscriptionDataIntegrityError(
            `${label} stripe_customer_id must be unique`
          );
        }
        seenStripeCustomerIds.add(persistedStripeCustomerId);
      }
      if (persistedSubscription.stripe_subscription_id) {
        const persistedStripeSubscriptionId = assertStripeProviderId(
          `${label} stripe_subscription_id`,
          persistedSubscription.stripe_subscription_id
        );
        if (seenStripeSubscriptionIds.has(persistedStripeSubscriptionId)) {
          throw subscriptionDataIntegrityError(
            `${label} stripe_subscription_id must be unique`
          );
        }
        seenStripeSubscriptionIds.add(persistedStripeSubscriptionId);
      }
      return persistedSubscription;
    });
  }

  private assertSubscriptionsEnabled(): void {
    if (this.enforceCapability) {
      assertCapabilityEnabled('subscriptions');
    }
  }
}
