import { Repository } from 'typeorm';
import { AppDataSource } from '../config/database.js';
import {
  DeliveryIntegration,
  DeliveryTracking,
  DeliveryRating,
  DeliveryProvider,
  DeliveryStatus,
  DeliveryCostHandling,
} from '../models/DeliveryIntegration.js';
import { Order } from '../models/Order.js';
import { FeatureUnavailableError, assertCapabilityEnabled } from '../config/capabilities.js';

const DELIVERY_PARTNER_UNAVAILABLE_MESSAGE =
  'Third-party delivery partner integration is disabled until provider certification, credentials, monitoring, and rollback evidence are recorded.';
const UNSAFE_DELIVERY_TEXT_CONTROLS =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/u;
const MAX_DELIVERY_PROVIDER_ID_LENGTH = 255;
const MAX_DELIVERY_FAILURE_TEXT_LENGTH = 1000;

function deliveryPartnerUnavailable(): never {
  throw new FeatureUnavailableError('delivery_partner', DELIVERY_PARTNER_UNAVAILABLE_MESSAGE);
}

interface DeliveryRepositoryOverrides {
  integrationRepository?: Repository<DeliveryIntegration>;
  trackingRepository?: Repository<DeliveryTracking>;
  ratingRepository?: Repository<DeliveryRating>;
  orderRepository?: Repository<Order>;
}

interface DeliveryServiceOptions {
  enforceCapability?: boolean;
}

export interface DeliveryStats {
  total_deliveries: number;
  successful_deliveries: number;
  cancelled_deliveries: number;
  failed_deliveries: number;
  average_rating: number;
  success_rate: number;
}

export interface DeliveryStatusUpdateDetails {
  delivery_person_name?: string;
  delivery_person_phone?: string;
  picked_up_at?: Date;
  delivered_at?: Date;
  message?: string;
  timestamp?: Date;
}

export interface DeliveryCreationResult {
  success: boolean;
  delivery_partner_id?: string;
  order_id?: string;
  business_id?: string;
  delivery_integration_id?: string;
  estimated_pickup_at?: Date;
  estimated_delivery_at?: Date;
  delivery_fee_cents?: number;
  tracking_url?: string;
  error?: string;
}

export interface DeliveryCancellationResult {
  success: boolean;
  delivery_partner_id?: string;
  order_id?: string;
  business_id?: string;
  delivery_integration_id?: string;
  error?: string;
}

const DELIVERY_STATUS_RANK: Record<DeliveryStatus, number> = {
  pending: 0,
  assigned: 1,
  picked_up: 2,
  en_route: 3,
  delivered: 4,
  cancelled: 99,
  failed: 99,
};

const TERMINAL_DELIVERY_STATUSES = new Set<DeliveryStatus>(['delivered', 'cancelled', 'failed']);
const VALID_DELIVERY_STATUSES = new Set<DeliveryStatus>([
  'pending',
  'assigned',
  'picked_up',
  'en_route',
  'delivered',
  'cancelled',
  'failed',
]);
const VALID_DELIVERY_PROVIDERS = new Set<DeliveryProvider>(['swiggy', 'zomato', 'dunzo']);
const VALID_DELIVERY_COST_HANDLING = new Set<DeliveryCostHandling>(['customer', 'seller']);
const VALID_DELIVERY_SERVICE_TYPES = new Set(['standard', 'express', 'scheduled']);
const DELIVERY_INTEGRATION_ROW_KEYS = new Set([
  'id',
  'business',
  'business_id',
  'provider',
  'is_active',
  'api_key',
  'api_secret',
  'partner_account_id',
  'cost_handling',
  'fixed_delivery_fee_cents',
  'auto_assign_delivery',
  'pickup_instructions',
  'webhook_url',
  'last_delivery_at',
  'total_deliveries',
  'failure_count',
  'last_error',
  'settings',
  'created_at',
  'updated_at',
]);
const DELIVERY_INTEGRATION_OPTION_KEYS = new Set([
  'api_key',
  'api_secret',
  'partner_account_id',
  'cost_handling',
  'fixed_delivery_fee_cents',
  'auto_assign_delivery',
  'pickup_instructions',
]);
const DELIVERY_INTEGRATION_SETTINGS_KEYS = new Set([
  'service_type',
  'packaging_required',
  'insurance_enabled',
]);
const DELIVERY_STATUS_UPDATE_DETAIL_KEYS = new Set([
  'delivery_person_name',
  'delivery_person_phone',
  'picked_up_at',
  'delivered_at',
  'message',
  'timestamp',
]);
const DELIVERY_STATUS_HISTORY_ENTRY_KEYS = new Set([
  'status',
  'timestamp',
  'message',
]);
const DELIVERY_TRACKING_ROW_KEYS = new Set([
  'id',
  'delivery_integration',
  'delivery_integration_id',
  'order',
  'order_id',
  'provider',
  'status',
  'delivery_partner_id',
  'delivery_person_name',
  'delivery_person_phone',
  'estimated_pickup_at',
  'picked_up_at',
  'estimated_delivery_at',
  'delivered_at',
  'delivery_fee_cents',
  'tracking_url',
  'delivery_instructions',
  'cancellation_reason',
  'attempt_count',
  'delivery_otp',
  'status_history',
  'error_message',
  'created_at',
  'updated_at',
]);
const DELIVERY_RATING_DATA_KEYS = new Set([
  'rating',
  'feedback',
  'timeliness_rating',
  'courtesy_rating',
  'packaging_rating',
  'issues',
]);
const DELIVERY_RATING_ROW_KEYS = new Set([
  'id',
  'delivery_tracking',
  'delivery_tracking_id',
  'order',
  'order_id',
  'customer',
  'customer_id',
  'rating',
  'feedback',
  'timeliness_rating',
  'courtesy_rating',
  'packaging_rating',
  'issues',
  'provider',
  'created_at',
]);
const DELIVERY_CREATION_SUCCESS_EVIDENCE_KEYS = [
  'delivery_partner_id',
  'order_id',
  'business_id',
  'delivery_integration_id',
  'estimated_pickup_at',
  'estimated_delivery_at',
  'delivery_fee_cents',
  'tracking_url',
] as const;
const DELIVERY_CANCELLATION_SUCCESS_EVIDENCE_KEYS = [
  'delivery_partner_id',
  'order_id',
  'business_id',
  'delivery_integration_id',
] as const;
const DELIVERY_CREATION_RESPONSE_KEYS = new Set([
  'success',
  'error',
  ...DELIVERY_CREATION_SUCCESS_EVIDENCE_KEYS,
]);
const DELIVERY_CANCELLATION_RESPONSE_KEYS = new Set([
  'success',
  'error',
  ...DELIVERY_CANCELLATION_SUCCESS_EVIDENCE_KEYS,
]);
const DELIVERY_STATS_TRACKING_METRIC_KEYS = new Set(['status']);
const DELIVERY_STATS_RATING_METRIC_KEYS = new Set(['rating']);

export function calculateDeliveryStats(
  trackingRecords: Pick<DeliveryTracking, 'status'>[],
  ratings: Pick<DeliveryRating, 'rating'>[]
): DeliveryStats {
  const normalizedStatuses = trackingRecords.map((tracking, index) => {
    if (!tracking || typeof tracking !== 'object' || Array.isArray(tracking)) {
      throw new Error(`Delivery tracking row ${index + 1} must be an object`);
    }
    const trackingRecord = tracking as unknown as Record<string, unknown>;
    assertNoUnsafeDeliveryFieldNames(`Delivery tracking row ${index + 1}`, trackingRecord);
    const unsupportedTrackingKeys = Object.keys(trackingRecord).filter(
      (key) => !DELIVERY_STATS_TRACKING_METRIC_KEYS.has(key)
    );
    if (unsupportedTrackingKeys.length > 0) {
      throw new Error(
        `Delivery tracking row ${index + 1} include unsupported field(s): ${unsupportedTrackingKeys.sort().join(', ')}`
      );
    }
    return normalizeDeliveryStatus(`Delivery tracking row ${index + 1}`, tracking.status);
  });

  const normalizedRatings = ratings.map((rating, index) => {
    if (!rating || typeof rating !== 'object' || Array.isArray(rating)) {
      throw new Error(`Delivery rating row ${index + 1} must be an object`);
    }
    const ratingRecord = rating as unknown as Record<string, unknown>;
    assertNoUnsafeDeliveryFieldNames(`Delivery rating row ${index + 1}`, ratingRecord);
    const unsupportedRatingKeys = Object.keys(ratingRecord).filter(
      (key) => !DELIVERY_STATS_RATING_METRIC_KEYS.has(key)
    );
    if (unsupportedRatingKeys.length > 0) {
      throw new Error(
        `Delivery rating row ${index + 1} include unsupported field(s): ${unsupportedRatingKeys.sort().join(', ')}`
      );
    }
    return assertRequiredRatingRange(`Delivery rating row ${index + 1}`, rating.rating);
  });

  const totalDeliveries = trackingRecords.length;
  const successfulDeliveries = normalizedStatuses.filter((status) => status === 'delivered').length;
  const cancelledDeliveries = normalizedStatuses.filter((status) => status === 'cancelled').length;
  const failedDeliveries = normalizedStatuses.filter((status) => status === 'failed').length;
  if (normalizedRatings.length > successfulDeliveries) {
    throw new Error('Delivery rating count cannot exceed delivered deliveries');
  }
  const successRate = totalDeliveries > 0 ? (successfulDeliveries / totalDeliveries) * 100 : 0;
  const averageRating =
    ratings.length > 0
      ? normalizedRatings.reduce((sum, rating) => sum + rating, 0) / normalizedRatings.length
      : 0;

  return {
    total_deliveries: totalDeliveries,
    successful_deliveries: successfulDeliveries,
    cancelled_deliveries: cancelledDeliveries,
    failed_deliveries: failedDeliveries,
    average_rating: Math.round(averageRating * 10) / 10,
    success_rate: Math.round(successRate * 10) / 10,
  };
}

function assertRatingRange(label: string, value?: number): void {
  if (value === undefined) return;
  if (!Number.isInteger(value) || value < 1 || value > 5) {
    throw new Error(`${label} must be between 1 and 5`);
  }
}

function assertRequiredRatingRange(label: string, value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 5) {
    throw new Error(`${label} must be between 1 and 5`);
  }
  return value;
}

function assertValidDeliveryDate(label: string, value?: Date): Date | undefined {
  if (value === undefined) return undefined;
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new Error(`${label} must be a valid Date`);
  }
  return value;
}

function hasUnsafeDeliveryTextControls(value: string): boolean {
  return UNSAFE_DELIVERY_TEXT_CONTROLS.test(value);
}

function assertReplayStringUnchanged(
  label: string,
  incomingValue: string | undefined,
  existingValue: string | undefined
): void {
  if (incomingValue === undefined) return;
  if (existingValue !== incomingValue) {
    throw new Error(`${label} cannot be changed by replayed delivery status`);
  }
}

function assertReplayDateUnchanged(
  label: string,
  incomingValue: Date | undefined,
  existingValue: Date | undefined
): void {
  if (incomingValue === undefined) return;
  if (!(existingValue instanceof Date) || existingValue.getTime() !== incomingValue.getTime()) {
    throw new Error(`${label} cannot be changed by replayed delivery status`);
  }
}

function assertNonNegativeIntegerCents(label: string, value?: number): void {
  if (value === undefined) return;
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be a non-negative amount of cents`);
  }
  if (!Number.isInteger(value)) {
    throw new Error(`${label} must be an integer amount of cents`);
  }
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${label} must be a safe integer amount of cents`);
  }
}

function assertNonEmptyString(label: string, value: unknown): string {
  if (typeof value !== 'string') {
    throw new Error(`${label} must be a non-empty string`);
  }
  if (hasUnsafeDeliveryTextControls(value)) {
    throw new Error(`${label} must not include unsafe control characters`);
  }
  if (!value.trim()) {
    throw new Error(`${label} must be a non-empty string`);
  }
  const normalizedValue = value.trim();
  return normalizedValue;
}

function assertBoundedDeliveryProviderId(label: string, value: unknown): string {
  const normalizedValue = assertNonEmptyString(label, value);
  if (normalizedValue.length > MAX_DELIVERY_PROVIDER_ID_LENGTH) {
    throw new Error(
      `${label} must be at most ${MAX_DELIVERY_PROVIDER_ID_LENGTH} characters`
    );
  }
  return normalizedValue;
}

function assertBoundedDeliveryFailureText(label: string, value: unknown): string {
  const normalizedValue = assertNonEmptyString(label, value);
  if (normalizedValue.length > MAX_DELIVERY_FAILURE_TEXT_LENGTH) {
    throw new Error(
      `${label} must be at most ${MAX_DELIVERY_FAILURE_TEXT_LENGTH} characters`
    );
  }
  return normalizedValue;
}

function assertOptionalNonEmptyString(label: string, value?: string): void {
  if (value === undefined) return;
  assertNonEmptyString(label, value);
}

function assertOptionalBoolean(label: string, value: unknown): void {
  if (value === undefined || value === null) return;
  if (typeof value !== 'boolean') {
    throw new Error(`${label} must be a boolean`);
  }
}

function normalizeOptionalString(label: string, value?: string): string | undefined {
  if (value === undefined) return undefined;
  return assertNonEmptyString(label, value);
}

function normalizeOptionalFailureText(label: string, value?: string): string | undefined {
  if (value === undefined) return undefined;
  return assertBoundedDeliveryFailureText(label, value);
}

function normalizeOptionalStringArray(label: string, values?: unknown[]): string[] {
  if (values === undefined) return [];
  if (!Array.isArray(values)) {
    throw new Error(`${label} must be an array of strings`);
  }

  const normalizedValues: string[] = [];
  const seenLabels = new Set<string>();
  values.forEach((value, index) => {
    const normalizedValue = assertNonEmptyString(`${label} item ${index + 1}`, value);
    const dedupeKey = normalizedValue.toLowerCase();
    if (seenLabels.has(dedupeKey)) return;

    seenLabels.add(dedupeKey);
    normalizedValues.push(normalizedValue);
  });

  return normalizedValues;
}

function assertValidDeliveryProvider(label: string, value: unknown): DeliveryProvider {
  if (typeof value !== 'string' || !VALID_DELIVERY_PROVIDERS.has(value as DeliveryProvider)) {
    throw new FeatureUnavailableError('delivery_partner', `${label} is not approved for launch`);
  }
  return value as DeliveryProvider;
}

function assertValidCostHandling(label: string, value?: DeliveryCostHandling): DeliveryCostHandling {
  if (value === undefined) return 'customer';
  if (!VALID_DELIVERY_COST_HANDLING.has(value)) {
    throw new Error(`${label} must be customer or seller`);
  }
  return value;
}

function normalizeDeliveryIntegrationOptions(options: unknown): {
  api_key?: string;
  api_secret?: string;
  partner_account_id?: string;
  cost_handling?: DeliveryCostHandling;
  fixed_delivery_fee_cents?: number;
  auto_assign_delivery?: boolean;
  pickup_instructions?: string;
} {
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    throw new Error('Delivery integration options must be an object');
  }
  const optionRecord = options as Record<string, unknown>;
  assertNoUnsafeDeliveryFieldNames('Delivery integration options', optionRecord);
  const unsupportedKeys = Object.keys(optionRecord).filter(
    (key) => !DELIVERY_INTEGRATION_OPTION_KEYS.has(key)
  );
  if (unsupportedKeys.length > 0) {
    throw new Error(
      `Delivery integration options include unsupported field(s): ${unsupportedKeys.sort().join(', ')}`
    );
  }
  return optionRecord as {
    api_key?: string;
    api_secret?: string;
    partner_account_id?: string;
    cost_handling?: DeliveryCostHandling;
    fixed_delivery_fee_cents?: number;
    auto_assign_delivery?: boolean;
    pickup_instructions?: string;
  };
}

function assertDeliveryProviderResponseEnvelope(
  label: string,
  response: Record<string, unknown>,
  allowedKeys: Set<string>
): void {
  const responseKeys = Object.keys(response);
  if (responseKeys.some((key) => hasUnsafeDeliveryTextControls(key))) {
    throw new Error(`${label} field names must not include unsafe control characters`);
  }
  const unsupportedKeys = responseKeys.filter((key) => !allowedKeys.has(key));
  if (unsupportedKeys.length > 0) {
    throw new Error(`${label} includes unsupported field(s): ${unsupportedKeys.sort().join(', ')}`);
  }
}

function assertDeliveryPersistedRecordObject(
  label: string,
  record: unknown
): asserts record is Record<string, unknown> {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    throw new Error(`${label} must be an object`);
  }
}

function assertDeliveryPersistedRecordEnvelope(
  label: string,
  record: unknown,
  allowedKeys: Set<string>
): asserts record is Record<string, unknown> {
  assertDeliveryPersistedRecordObject(label, record);
  const persistedRecord = record as Record<string, unknown>;
  assertNoUnsafeDeliveryFieldNames(label, persistedRecord);
  const unsupportedKeys = Object.keys(persistedRecord).filter((key) => !allowedKeys.has(key));
  if (unsupportedKeys.length > 0) {
    throw new Error(`${label} include unsupported field(s): ${unsupportedKeys.sort().join(', ')}`);
  }
}

function assertNoUnsafeDeliveryFieldNames(label: string, record: Record<string, unknown>): void {
  if (Object.keys(record).some((key) => hasUnsafeDeliveryTextControls(key))) {
    throw new Error(`${label} field names must not include unsafe control characters`);
  }
}

function assertDeliveryIntegrationSettingsEnvelope(
  label: string,
  settings?: DeliveryIntegration['settings']
): void {
  if (settings === undefined || settings === null) return;
  if (typeof settings !== 'object' || Array.isArray(settings)) {
    throw new Error(`${label} must be an object`);
  }

  const settingsRecord = settings as Record<string, unknown>;
  assertNoUnsafeDeliveryFieldNames(label, settingsRecord);
  const unsupportedKeys = Object.keys(settingsRecord).filter(
    (key) => !DELIVERY_INTEGRATION_SETTINGS_KEYS.has(key)
  );
  if (unsupportedKeys.length > 0) {
    throw new Error(`${label} include unsupported field(s): ${unsupportedKeys.sort().join(', ')}`);
  }

  if (
    settingsRecord.service_type !== undefined &&
    (typeof settingsRecord.service_type !== 'string' ||
      !VALID_DELIVERY_SERVICE_TYPES.has(settingsRecord.service_type))
  ) {
    throw new Error(`${label} service_type must be standard, express, or scheduled`);
  }

  if (
    settingsRecord.packaging_required !== undefined &&
    typeof settingsRecord.packaging_required !== 'boolean'
  ) {
    throw new Error(`${label} packaging_required must be a boolean`);
  }

  if (
    settingsRecord.insurance_enabled !== undefined &&
    typeof settingsRecord.insurance_enabled !== 'boolean'
  ) {
    throw new Error(`${label} insurance_enabled must be a boolean`);
  }
}

function assertIncrementableCounter(label: string, value?: number): number {
  const counter = value ?? 0;
  if (!Number.isSafeInteger(counter) || counter < 0) {
    throw new Error(`${label} must be a non-negative safe integer`);
  }
  if (counter >= Number.MAX_SAFE_INTEGER) {
    throw new Error(`${label} cannot be incremented safely`);
  }
  return counter;
}

function assertNonNegativeSafeIntegerCounter(label: string, value?: number): number {
  const counter = value ?? 0;
  if (!Number.isSafeInteger(counter) || counter < 0) {
    throw new Error(`${label} must be a non-negative safe integer`);
  }
  return counter;
}

function incrementCounter(label: string, value?: number): number {
  return assertIncrementableCounter(label, value) + 1;
}

function isPrivateOrInternalIpv4(hostname: string): boolean {
  const parts = hostname.split('.');
  if (parts.length !== 4) return false;

  const octets = parts.map((part) => {
    if (!/^\d{1,3}$/.test(part)) return Number.NaN;
    return Number(part);
  });
  if (octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
    return false;
  }

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

function isPrivateOrInternalHostname(hostname: string): boolean {
  const normalizedHostname = hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');

  if (
    normalizedHostname === 'localhost' ||
    normalizedHostname.endsWith('.localhost')
  ) {
    return true;
  }

  if (isPrivateOrInternalIpv4(normalizedHostname)) {
    return true;
  }

  const isIpv6Literal = normalizedHostname.includes(':');
  if (
    isIpv6Literal &&
    (normalizedHostname === '::' ||
      normalizedHostname === '::1' ||
      normalizedHostname.startsWith('fc') ||
      normalizedHostname.startsWith('fd') ||
      /^fe[89ab]/u.test(normalizedHostname))
  ) {
    return true;
  }

  return !normalizedHostname.includes('.') && !isIpv6Literal;
}

function assertAbsoluteHttpsUrl(label: string, value?: string): void {
  if (value === undefined) return;
  if (typeof value !== 'string') {
    throw new Error(`${label} must be an absolute HTTPS URL`);
  }
  if (hasUnsafeDeliveryTextControls(value)) {
    throw new Error(`${label} must not include unsafe control characters`);
  }
  if (value.trim().length === 0) {
    throw new Error(`${label} must be an absolute HTTPS URL`);
  }
  const normalizedValue = value.trim();

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(normalizedValue);
  } catch {
    throw new Error(`${label} must be an absolute HTTPS URL`);
  }

  if (parsedUrl.protocol !== 'https:' || !parsedUrl.hostname) {
    throw new Error(`${label} must be an absolute HTTPS URL`);
  }
  if (parsedUrl.username || parsedUrl.password) {
    throw new Error(`${label} must not include embedded credentials`);
  }
  if (isPrivateOrInternalHostname(parsedUrl.hostname)) {
    throw new Error(`${label} must not point to private or internal hosts`);
  }
}

function assertValidDeliveryStatus(label: string, status: DeliveryStatus): void {
  if (!VALID_DELIVERY_STATUSES.has(status)) {
    throw new Error(`${label} has an invalid status`);
  }
}

function normalizeDeliveryStatus(label: string, status: unknown): DeliveryStatus {
  if (typeof status === 'string' && hasUnsafeDeliveryTextControls(status)) {
    throw new Error(`${label} must not include unsafe control characters`);
  }
  const normalizedStatus = typeof status === 'string' ? status.trim() : status;
  if (
    typeof normalizedStatus !== 'string' ||
    !VALID_DELIVERY_STATUSES.has(normalizedStatus as DeliveryStatus)
  ) {
    throw new Error(`${label} has an invalid status`);
  }
  return normalizedStatus as DeliveryStatus;
}

function normalizeDeliveryStatusUpdateDetails(
  details: DeliveryStatusUpdateDetails | undefined
): DeliveryStatusUpdateDetails {
  if (details === undefined) return {};
  if (!details || typeof details !== 'object' || Array.isArray(details)) {
    throw new Error('Delivery status update details must be an object');
  }
  const detailRecord = details as Record<string, unknown>;
  assertNoUnsafeDeliveryFieldNames('Delivery status update details', detailRecord);
  const unsupportedKeys = Object.keys(detailRecord).filter(
    (key) => !DELIVERY_STATUS_UPDATE_DETAIL_KEYS.has(key)
  );
  if (unsupportedKeys.length > 0) {
    throw new Error(
      `Delivery status update details include unsupported field(s): ${unsupportedKeys.sort().join(', ')}`
    );
  }
  return details;
}

function normalizeDeliveryRatingData(data: {
  rating: number;
  feedback?: string;
  timeliness_rating?: number;
  courtesy_rating?: number;
  packaging_rating?: number;
  issues?: string[];
}): {
  rating: number;
  feedback?: string;
  timeliness_rating?: number;
  courtesy_rating?: number;
  packaging_rating?: number;
  issues?: string[];
} {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Delivery rating data must be an object');
  }
  const dataRecord = data as Record<string, unknown>;
  assertNoUnsafeDeliveryFieldNames('Delivery rating data', dataRecord);
  const unsupportedKeys = Object.keys(dataRecord).filter(
    (key) => !DELIVERY_RATING_DATA_KEYS.has(key)
  );
  if (unsupportedKeys.length > 0) {
    throw new Error(
      `Delivery rating data include unsupported field(s): ${unsupportedKeys.sort().join(', ')}`
    );
  }
  return data;
}

function normalizeDeliveryCancellationResult(result: unknown): DeliveryCancellationResult {
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    throw new Error('Delivery provider cancellation response must be an object');
  }

  const response = result as DeliveryCancellationResult;
  if (typeof response.success !== 'boolean') {
    throw new Error('Delivery provider cancellation response success must be a boolean');
  }
  assertDeliveryProviderResponseEnvelope(
    'Delivery provider cancellation response',
    result as Record<string, unknown>,
    DELIVERY_CANCELLATION_RESPONSE_KEYS
  );

  if (!response.success) {
    const staleEvidenceFields = DELIVERY_CANCELLATION_SUCCESS_EVIDENCE_KEYS
      .filter((field) => response[field] !== undefined);
    if (staleEvidenceFields.length > 0) {
      throw new Error(
        `Delivery provider cancellation failure response cannot include success field(s): ${staleEvidenceFields.join(', ')}`
      );
    }
  }

  const normalizedError = normalizeOptionalFailureText(
    'Delivery provider cancellation response error',
    response.error
  );
  if (response.success && normalizedError !== undefined) {
    throw new Error('Delivery provider cancellation success response error cannot be present');
  }
  if (!response.success && normalizedError === undefined) {
    throw new Error('Delivery provider cancellation failure response must include error');
  }

  return {
    ...response,
    success: response.success,
    error: normalizedError,
  };
}

function normalizeDeliveryCreationResult(result: unknown): DeliveryCreationResult {
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    throw new Error('Delivery provider creation response must be an object');
  }

  const response = result as DeliveryCreationResult;
  if (typeof response.success !== 'boolean') {
    throw new Error('Delivery provider creation response success must be a boolean');
  }
  assertDeliveryProviderResponseEnvelope(
    'Delivery provider creation response',
    result as Record<string, unknown>,
    DELIVERY_CREATION_RESPONSE_KEYS
  );

  if (!response.success) {
    const staleEvidenceFields = DELIVERY_CREATION_SUCCESS_EVIDENCE_KEYS
      .filter((field) => response[field] !== undefined);
    if (staleEvidenceFields.length > 0) {
      throw new Error(
        `Delivery provider creation failure response cannot include success field(s): ${staleEvidenceFields.join(', ')}`
      );
    }
  }

  const normalizedError = normalizeOptionalFailureText(
    'Delivery provider creation response error',
    response.error
  );
  if (response.success && normalizedError !== undefined) {
    throw new Error('Delivery provider creation success response error cannot be present');
  }
  if (!response.success && normalizedError === undefined) {
    throw new Error('Delivery provider creation failure response must include error');
  }

  return {
    ...response,
    error: normalizedError,
  };
}

export function canTransitionDeliveryStatus(
  currentStatus: DeliveryStatus,
  nextStatus: DeliveryStatus
): boolean {
  assertValidDeliveryStatus('Current delivery status', currentStatus);
  assertValidDeliveryStatus('Next delivery status', nextStatus);
  if (currentStatus === nextStatus) return true;
  if (TERMINAL_DELIVERY_STATUSES.has(currentStatus)) return false;
  if (nextStatus === 'cancelled' || nextStatus === 'failed') return true;
  return DELIVERY_STATUS_RANK[nextStatus] > DELIVERY_STATUS_RANK[currentStatus];
}

export function applyDeliveryStatusUpdate(
  tracking: DeliveryTracking,
  status: DeliveryStatus,
  details: DeliveryStatusUpdateDetails = {},
  now: Date = new Date()
): DeliveryTracking {
  const normalizedDetails = normalizeDeliveryStatusUpdateDetails(details);
  const previousStatus = tracking.status;
  const normalizedStatus = normalizeDeliveryStatus('Next delivery status', status);
  if (!canTransitionDeliveryStatus(previousStatus, normalizedStatus)) {
    throw new Error(`Cannot transition delivery status from ${previousStatus} to ${normalizedStatus}`);
  }

  const nextPickedUpAt = normalizedDetails.picked_up_at ?? tracking.picked_up_at;
  const nextDeliveredAt = normalizedDetails.delivered_at ?? tracking.delivered_at;
  const historyTimestamp = normalizedDetails.timestamp ?? now;

  assertValidDeliveryDate('Picked-up timestamp', nextPickedUpAt);
  assertValidDeliveryDate('Delivered timestamp', nextDeliveredAt);
  assertValidDeliveryDate('Status history timestamp', historyTimestamp);

  const nextDeliveryPersonName = normalizeOptionalString(
    'Delivery person name',
    normalizedDetails.delivery_person_name
  );
  const nextDeliveryPersonPhone = normalizeOptionalString(
    'Delivery person phone',
    normalizedDetails.delivery_person_phone
  );
  const nextStatusMessage = normalizeOptionalString(
    'Delivery status message',
    normalizedDetails.message
  );

  if (nextPickedUpAt && nextDeliveredAt && nextDeliveredAt.getTime() < nextPickedUpAt.getTime()) {
    throw new Error('Delivered timestamp must not be before picked-up timestamp');
  }

  if (
    (normalizedStatus === 'picked_up' || normalizedStatus === 'en_route' || normalizedStatus === 'delivered') &&
    !nextPickedUpAt
  ) {
    throw new Error('Picked-up timestamp is required once delivery is picked up');
  }

  if (normalizedStatus === 'delivered' && !nextDeliveredAt) {
    throw new Error('Delivered timestamp is required for delivered status');
  }
  if (normalizedStatus !== 'delivered' && nextDeliveredAt) {
    throw new Error('Delivered timestamp cannot be present before delivered status');
  }

  const history = tracking.status_history || [];
  const lastEntry = history[history.length - 1];
  const isReplay = previousStatus === normalizedStatus && lastEntry?.status === normalizedStatus;

  if (lastEntry?.timestamp && historyTimestamp.getTime() < lastEntry.timestamp.getTime()) {
    throw new Error('Status history timestamp cannot be before previous delivery status');
  }
  if (historyTimestamp.getTime() > now.getTime()) {
    throw new Error('Status history timestamp cannot be after processing time');
  }

  if (
    (normalizedStatus === 'picked_up' || normalizedStatus === 'en_route' || normalizedStatus === 'delivered') &&
    nextPickedUpAt &&
    historyTimestamp.getTime() < nextPickedUpAt.getTime()
  ) {
    throw new Error('Status history timestamp cannot be before picked-up timestamp');
  }

  if (
    normalizedStatus === 'delivered' &&
    nextDeliveredAt &&
    historyTimestamp.getTime() < nextDeliveredAt.getTime()
  ) {
    throw new Error('Status history timestamp cannot be before delivered timestamp');
  }

  if (isReplay) {
    assertReplayStringUnchanged(
      'Delivery person name',
      nextDeliveryPersonName,
      tracking.delivery_person_name
    );
    assertReplayStringUnchanged(
      'Delivery person phone',
      nextDeliveryPersonPhone,
      tracking.delivery_person_phone
    );
    assertReplayStringUnchanged(
      'Delivery status message',
      nextStatusMessage,
      lastEntry.message
    );
    assertReplayDateUnchanged('Picked-up timestamp', normalizedDetails.picked_up_at, tracking.picked_up_at);
    assertReplayDateUnchanged('Delivered timestamp', normalizedDetails.delivered_at, tracking.delivered_at);
    assertReplayDateUnchanged('Status history timestamp', normalizedDetails.timestamp, lastEntry.timestamp);
    return tracking;
  }

  if (nextDeliveryPersonName !== undefined) {
    tracking.delivery_person_name = nextDeliveryPersonName;
  }

  if (nextDeliveryPersonPhone !== undefined) {
    tracking.delivery_person_phone = nextDeliveryPersonPhone;
  }

  if (normalizedDetails.picked_up_at) {
    tracking.picked_up_at = normalizedDetails.picked_up_at;
  }

  if (normalizedDetails.delivered_at) {
    tracking.delivered_at = normalizedDetails.delivered_at;
  }

  tracking.status = normalizedStatus;

  history.push({
    status: normalizedStatus,
    timestamp: historyTimestamp,
    message: nextStatusMessage,
  });
  tracking.status_history = history;

  return tracking;
}

/**
 * Delivery Service Interface
 * All delivery providers must implement this interface
 */
export interface IDeliveryService {
  provider: DeliveryProvider;

  /**
   * Create delivery request with partner
   */
  createDelivery(order: Order, integration: DeliveryIntegration): Promise<DeliveryCreationResult>;

  /**
   * Cancel delivery
   */
  cancelDelivery(deliveryPartnerId: string, integration: DeliveryIntegration): Promise<DeliveryCancellationResult>;

  /**
   * Get delivery status
   */
  getDeliveryStatus(deliveryPartnerId: string, integration: DeliveryIntegration): Promise<{
    status: DeliveryStatus;
    delivery_person_name?: string;
    delivery_person_phone?: string;
    tracking_url?: string;
    estimated_delivery_at?: Date;
  }>;
}

/**
 * Swiggy Delivery Service
 */
export class SwiggyDeliveryService implements IDeliveryService {
  provider: DeliveryProvider = 'swiggy';

  async createDelivery(order: Order, integration: DeliveryIntegration): Promise<DeliveryCreationResult> {
    deliveryPartnerUnavailable();
  }

  async cancelDelivery(
    _deliveryPartnerId: string,
    _integration: DeliveryIntegration
  ): Promise<DeliveryCancellationResult> {
    deliveryPartnerUnavailable();
  }

  async getDeliveryStatus(deliveryPartnerId: string, _integration: DeliveryIntegration): Promise<{
    status: DeliveryStatus;
    delivery_person_name?: string;
    delivery_person_phone?: string;
    tracking_url?: string;
    estimated_delivery_at?: Date;
  }> {
    deliveryPartnerUnavailable();
  }
}

/**
 * Zomato Delivery Service
 */
export class ZomatoDeliveryService implements IDeliveryService {
  provider: DeliveryProvider = 'zomato';

  async createDelivery(order: Order, integration: DeliveryIntegration): Promise<DeliveryCreationResult> {
    deliveryPartnerUnavailable();
  }

  async cancelDelivery(
    _deliveryPartnerId: string,
    _integration: DeliveryIntegration
  ): Promise<DeliveryCancellationResult> {
    deliveryPartnerUnavailable();
  }

  async getDeliveryStatus(deliveryPartnerId: string, _integration: DeliveryIntegration): Promise<{
    status: DeliveryStatus;
    delivery_person_name?: string;
    delivery_person_phone?: string;
    tracking_url?: string;
    estimated_delivery_at?: Date;
  }> {
    deliveryPartnerUnavailable();
  }
}

/**
 * Dunzo Delivery Service
 */
export class DunzoDeliveryService implements IDeliveryService {
  provider: DeliveryProvider = 'dunzo';

  async createDelivery(order: Order, integration: DeliveryIntegration): Promise<DeliveryCreationResult> {
    deliveryPartnerUnavailable();
  }

  async cancelDelivery(
    _deliveryPartnerId: string,
    _integration: DeliveryIntegration
  ): Promise<DeliveryCancellationResult> {
    deliveryPartnerUnavailable();
  }

  async getDeliveryStatus(deliveryPartnerId: string, _integration: DeliveryIntegration): Promise<{
    status: DeliveryStatus;
    delivery_person_name?: string;
    delivery_person_phone?: string;
    tracking_url?: string;
    estimated_delivery_at?: Date;
  }> {
    deliveryPartnerUnavailable();
  }
}

/**
 * Delivery Service
 * Orchestrates delivery operations with retry logic
 */
export class DeliveryService {
  private integrationRepository: Repository<DeliveryIntegration>;
  private trackingRepository: Repository<DeliveryTracking>;
  private ratingRepository: Repository<DeliveryRating>;
  private orderRepository: Repository<Order>;
  private services: Map<DeliveryProvider, IDeliveryService>;
  private readonly enforceCapability: boolean;

  constructor(
    services?: Map<DeliveryProvider, IDeliveryService>,
    repositories?: DeliveryRepositoryOverrides,
    options: DeliveryServiceOptions = {}
  ) {
    this.integrationRepository = repositories?.integrationRepository ?? AppDataSource.getRepository(DeliveryIntegration);
    this.trackingRepository = repositories?.trackingRepository ?? AppDataSource.getRepository(DeliveryTracking);
    this.ratingRepository = repositories?.ratingRepository ?? AppDataSource.getRepository(DeliveryRating);
    this.orderRepository = repositories?.orderRepository ?? AppDataSource.getRepository(Order);
    this.enforceCapability = options.enforceCapability !== false;

    // Initialize delivery services
    this.services = services || new Map();
    if (!services) {
      this.services.set('swiggy', new SwiggyDeliveryService());
      this.services.set('zomato', new ZomatoDeliveryService());
      this.services.set('dunzo', new DunzoDeliveryService());
    }
  }

  /**
   * Get delivery integration for a business
   */
  async getIntegration(businessId: string): Promise<DeliveryIntegration | null> {
    this.assertDeliveryPartnerEnabled();
    const normalizedBusinessId = assertNonEmptyString('Delivery business_id', businessId);
    const integration = await this.integrationRepository.findOne({
      where: { business_id: normalizedBusinessId, is_active: true },
    });
    if (integration) {
      DeliveryService.assertValidPersistedIntegrationForBusiness(
        integration,
        normalizedBusinessId,
        true
      );
    }
    return integration;
  }

  /**
   * Create delivery integration
   */
  async createIntegration(
    businessId: string,
    provider: DeliveryProvider,
    options: {
      api_key?: string;
      api_secret?: string;
      partner_account_id?: string;
      cost_handling?: DeliveryCostHandling;
      fixed_delivery_fee_cents?: number;
      auto_assign_delivery?: boolean;
      pickup_instructions?: string;
    }
  ): Promise<DeliveryIntegration> {
    this.assertDeliveryPartnerEnabled();
    const normalizedOptions = normalizeDeliveryIntegrationOptions(options);
    assertNonNegativeIntegerCents('Fixed delivery fee', normalizedOptions.fixed_delivery_fee_cents);
    const normalizedBusinessId = assertNonEmptyString('Delivery integration business_id', businessId);
    const normalizedProvider = assertValidDeliveryProvider('Delivery provider', provider);
    const normalizedApiKey = assertNonEmptyString('Delivery integration api_key', normalizedOptions.api_key);
    const normalizedApiSecret = normalizeOptionalString(
      'Delivery integration api_secret',
      normalizedOptions.api_secret
    );
    const normalizedPartnerAccountId = assertNonEmptyString(
      'Delivery integration partner_account_id',
      normalizedOptions.partner_account_id
    );
    const normalizedCostHandling = assertValidCostHandling(
      'Delivery integration cost_handling',
      normalizedOptions.cost_handling
    );
    const normalizedPickupInstructions = normalizeOptionalString(
      'Delivery integration pickup_instructions',
      normalizedOptions.pickup_instructions
    );

    // Deactivate existing integration if any
    const existing = await this.integrationRepository.findOne({
      where: { business_id: normalizedBusinessId },
    });

    if (existing) {
      DeliveryService.assertValidPersistedIntegrationForBusiness(
        existing,
        normalizedBusinessId
      );
      existing.is_active = false;
      await this.integrationRepository.save(existing);
    }

    // Create new integration
    const integration = this.integrationRepository.create({
      business_id: normalizedBusinessId,
      provider: normalizedProvider,
      api_key: normalizedApiKey,
      ...(normalizedApiSecret === undefined ? {} : { api_secret: normalizedApiSecret }),
      partner_account_id: normalizedPartnerAccountId,
      cost_handling: normalizedCostHandling,
      ...(normalizedOptions.fixed_delivery_fee_cents === undefined
        ? {}
        : { fixed_delivery_fee_cents: normalizedOptions.fixed_delivery_fee_cents }),
      auto_assign_delivery: normalizedOptions.auto_assign_delivery !== false,
      ...(normalizedPickupInstructions === undefined
        ? {}
        : { pickup_instructions: normalizedPickupInstructions }),
      is_active: true,
    });

    await this.integrationRepository.save(integration);

    return integration;
  }

  /**
   * Disconnect delivery integration
   */
  async disconnectIntegration(businessId: string): Promise<void> {
    this.assertDeliveryPartnerEnabled();
    const normalizedBusinessId = assertNonEmptyString('Delivery business_id', businessId);
    const integration = await this.integrationRepository.findOne({
      where: { business_id: normalizedBusinessId, is_active: true },
    });

    if (integration) {
      DeliveryService.assertValidPersistedIntegrationForBusiness(
        integration,
        normalizedBusinessId,
        true
      );
      integration.is_active = false;
      await this.integrationRepository.save(integration);
    }
  }

  /**
   * Create delivery for an order
   */
  async createDelivery(orderId: string): Promise<DeliveryTracking> {
    this.assertDeliveryPartnerEnabled();
    const normalizedOrderId = assertNonEmptyString('Delivery order_id', orderId);

    const order = await this.orderRepository.findOne({
      where: { id: normalizedOrderId },
    });

    if (!order) {
      throw new Error('Order not found');
    }
    DeliveryService.assertValidPersistedOrderForDelivery(order, normalizedOrderId);

    const integration = await this.getIntegration(order.business_id);

    if (!integration) {
      throw new Error('No active delivery integration found');
    }

    assertIncrementableCounter(
      'Delivery integration total_deliveries',
      integration.total_deliveries
    );
    assertIncrementableCounter(
      'Delivery integration failure_count',
      integration.failure_count
    );

    // Check if delivery already exists
    const existing = await this.trackingRepository.findOne({
      where: { order_id: normalizedOrderId },
    });

    if (existing) {
      DeliveryService.assertValidPersistedTracking(existing, normalizedOrderId);
      throw new Error('Delivery already created for this order');
    }

    // Create delivery tracking record
    const tracking = this.trackingRepository.create({
      delivery_integration_id: integration.id,
      order_id: normalizedOrderId,
      provider: integration.provider,
      status: 'pending',
      attempt_count: 0,
    });

    await this.trackingRepository.save(tracking);

    // Attempt to create delivery with partner
    await this.attemptDeliveryCreation(tracking, order, integration);

    return tracking;
  }

  /**
   * Attempt to create delivery with partner
   */
  private async attemptDeliveryCreation(
    tracking: DeliveryTracking,
    order: Order,
    integration: DeliveryIntegration
  ): Promise<void> {
    DeliveryService.assertValidDeliveryCreationContext(tracking, order, integration);

    try {
      const service = this.services.get(integration.provider);

      if (!service) {
        throw new Error(`Unsupported delivery provider: ${integration.provider}`);
      }

      // Create delivery request
      const result = normalizeDeliveryCreationResult(
        await service.createDelivery(order, integration)
      );

      if (result.success) {
        DeliveryService.assertValidDeliveryCreationResult(result, order, integration);

        // Success
        tracking.status = 'assigned';
        tracking.delivery_partner_id = result.delivery_partner_id;
        tracking.estimated_pickup_at = result.estimated_pickup_at;
        tracking.estimated_delivery_at = result.estimated_delivery_at;
        tracking.delivery_fee_cents = result.delivery_fee_cents;
        tracking.tracking_url = result.tracking_url;
        tracking.error_message = null;
        tracking.cancellation_reason = null;

        // Add to status history
        tracking.status_history = [
          {
            status: 'assigned',
            timestamp: new Date(),
            message: 'Delivery assigned successfully',
          },
        ];

        // Update integration
        integration.last_delivery_at = new Date();
        integration.total_deliveries = incrementCounter(
          'Delivery integration total_deliveries',
          integration.total_deliveries
        );
        integration.last_error = null;

        await this.integrationRepository.save(integration);
      } else {
        // Failed
        throw new Error(result.error || 'Delivery creation failed');
      }
    } catch (error) {
      // Handle failure
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      tracking.status = 'failed';
      tracking.error_message = errorMessage;
      tracking.delivery_partner_id = null;
      tracking.delivery_person_name = null;
      tracking.delivery_person_phone = null;
      tracking.estimated_pickup_at = null;
      tracking.picked_up_at = null;
      tracking.estimated_delivery_at = null;
      tracking.delivered_at = null;
      tracking.delivery_fee_cents = null;
      tracking.tracking_url = null;
      tracking.cancellation_reason = null;
      tracking.delivery_otp = null;
      tracking.attempt_count = incrementCounter(
        'Delivery tracking attempt_count',
        tracking.attempt_count
      );

      // Add to status history
      tracking.status_history = [
        {
          status: 'failed',
          timestamp: new Date(),
          message: errorMessage,
        },
      ];

      // Update integration error count
      integration.failure_count = incrementCounter(
        'Delivery integration failure_count',
        integration.failure_count
      );
      integration.last_error = errorMessage;

      await this.integrationRepository.save(integration);
    }

    await this.trackingRepository.save(tracking);
  }

  /**
   * Update delivery status (called by webhook or polling)
   */
  async updateDeliveryStatus(
    trackingId: string,
    status: DeliveryStatus,
    details?: DeliveryStatusUpdateDetails
  ): Promise<DeliveryTracking> {
    this.assertDeliveryPartnerEnabled();
    const normalizedTrackingId = assertNonEmptyString('Delivery tracking_id', trackingId);
    const normalizedStatus = normalizeDeliveryStatus('Next delivery status', status);
    const normalizedDetails = normalizeDeliveryStatusUpdateDetails(details);
    const tracking = await this.trackingRepository.findOne({
      where: { id: normalizedTrackingId },
    });

    if (!tracking) {
      throw new Error('Delivery tracking not found');
    }

    DeliveryService.assertValidPersistedTrackingForRequest(tracking, normalizedTrackingId);
    applyDeliveryStatusUpdate(tracking, normalizedStatus, normalizedDetails);

    await this.trackingRepository.save(tracking);

    return tracking;
  }

  /**
   * Cancel delivery
   */
  async cancelDelivery(trackingId: string, reason: string): Promise<DeliveryTracking> {
    this.assertDeliveryPartnerEnabled();
    const normalizedTrackingId = assertNonEmptyString('Delivery tracking_id', trackingId);
    const normalizedReason = assertNonEmptyString('Delivery cancellation reason', reason);
    const tracking = await this.trackingRepository.findOne({
      where: { id: normalizedTrackingId },
      relations: ['delivery_integration'],
    });

    if (!tracking) {
      throw new Error('Delivery tracking not found');
    }

    DeliveryService.assertValidPersistedTrackingForRequest(tracking, normalizedTrackingId);

    if (!tracking.delivery_partner_id) {
      throw new Error('Delivery not yet assigned to partner');
    }

    if (!canTransitionDeliveryStatus(tracking.status, 'cancelled')) {
      throw new Error(`Cannot transition delivery status from ${tracking.status} to cancelled`);
    }

    if (!tracking.delivery_integration) {
      throw new Error('Delivery integration relation is required before cancellation');
    }
    DeliveryService.assertValidPersistedTrackingIntegrationRelation(tracking);

    const service = this.services.get(tracking.provider);

    if (!service) {
      throw new Error(`Unsupported delivery provider: ${tracking.provider}`);
    }

    // Cancel with partner
    const result = normalizeDeliveryCancellationResult(
      await service.cancelDelivery(
        tracking.delivery_partner_id,
        tracking.delivery_integration
      )
    );

    if (result.success) {
      DeliveryService.assertValidDeliveryCancellationResult(result, tracking);
      applyDeliveryStatusUpdate(tracking, 'cancelled', {
        message: `Cancelled: ${normalizedReason}`,
      });
      tracking.cancellation_reason = normalizedReason;

      await this.trackingRepository.save(tracking);
    } else {
      throw new Error(result.error || 'Cancellation failed');
    }

    return tracking;
  }

  /**
   * Get delivery tracking for an order
   */
  async getDeliveryTracking(orderId: string): Promise<DeliveryTracking | null> {
    this.assertDeliveryPartnerEnabled();
    const normalizedOrderId = assertNonEmptyString('Delivery order_id', orderId);
    const tracking = await this.trackingRepository.findOne({
      where: { order_id: normalizedOrderId },
      relations: ['delivery_integration'],
    });
    if (tracking) {
      DeliveryService.assertValidPersistedTracking(tracking, normalizedOrderId);
      if (tracking.delivery_integration) {
        DeliveryService.assertValidPersistedTrackingIntegrationRelation(tracking);
      }
    }
    return tracking;
  }

  /**
   * Submit delivery rating
   */
  async submitDeliveryRating(
    trackingId: string,
    customerId: string,
    data: {
      rating: number;
      feedback?: string;
      timeliness_rating?: number;
      courtesy_rating?: number;
      packaging_rating?: number;
      issues?: string[];
    }
  ): Promise<DeliveryRating> {
    this.assertDeliveryPartnerEnabled();
    const normalizedTrackingId = assertNonEmptyString('Delivery tracking_id', trackingId);
    const normalizedCustomerId = assertNonEmptyString('Delivery rating customer_id', customerId);
    const normalizedData = normalizeDeliveryRatingData(data);
    // Validate rating
    assertRequiredRatingRange('Rating', normalizedData.rating);
    assertRatingRange('Timeliness rating', normalizedData.timeliness_rating);
    assertRatingRange('Courtesy rating', normalizedData.courtesy_rating);
    assertRatingRange('Packaging rating', normalizedData.packaging_rating);
    const normalizedFeedback = normalizeOptionalString('Delivery rating feedback', normalizedData.feedback);
    const normalizedIssues = normalizeOptionalStringArray('Delivery rating issues', normalizedData.issues);

    const tracking = await this.trackingRepository.findOne({
      where: { id: normalizedTrackingId },
      relations: ['order'],
    });

    if (!tracking) {
      throw new Error('Delivery tracking not found');
    }

    DeliveryService.assertValidPersistedTrackingForRequest(tracking, normalizedTrackingId);

    // Check if delivery is completed
    const trackingStatus = normalizeDeliveryStatus('Delivery rating tracking status', tracking.status);
    if (trackingStatus !== 'delivered') {
      throw new Error('Can only rate completed deliveries');
    }
    DeliveryService.assertDeliveryRatingCustomerMatchesOrder(tracking, normalizedCustomerId);

    // Check if rating already exists
    const existing = await this.ratingRepository.findOne({
      where: { delivery_tracking_id: normalizedTrackingId },
    });

    if (existing) {
      DeliveryService.assertValidPersistedRatingForTracking(existing, tracking);
      throw new Error('Delivery already rated');
    }

    // Create rating
    const rating = this.ratingRepository.create({
      delivery_tracking_id: normalizedTrackingId,
      order_id: tracking.order_id,
      customer_id: normalizedCustomerId,
      provider: tracking.provider,
      rating: normalizedData.rating,
      ...(normalizedFeedback === undefined ? {} : { feedback: normalizedFeedback }),
      timeliness_rating: normalizedData.timeliness_rating,
      courtesy_rating: normalizedData.courtesy_rating,
      packaging_rating: normalizedData.packaging_rating,
      issues: normalizedIssues,
    });

    await this.ratingRepository.save(rating);

    return rating;
  }

  /**
   * Get delivery statistics for a business
   */
  async getDeliveryStats(businessId: string): Promise<{
    total_deliveries: number;
    successful_deliveries: number;
    cancelled_deliveries: number;
    failed_deliveries: number;
    average_rating: number;
    success_rate: number;
  }> {
    this.assertDeliveryPartnerEnabled();
    const normalizedBusinessId = assertNonEmptyString('Delivery business_id', businessId);
    const integration = await this.integrationRepository.findOne({
      where: { business_id: normalizedBusinessId, is_active: true },
    });

    if (!integration) {
      return {
        total_deliveries: 0,
        successful_deliveries: 0,
        cancelled_deliveries: 0,
        failed_deliveries: 0,
        average_rating: 0,
        success_rate: 0,
      };
    }
    DeliveryService.assertValidPersistedIntegrationForBusiness(
      integration,
      normalizedBusinessId,
      true
    );

    const allTracking = await this.trackingRepository.find({
      where: { delivery_integration_id: integration.id },
    });
    const seenStatsTrackingIds = new Set<string>();
    const seenStatsOrderIds = new Set<string>();
    const statsTrackingRows: Pick<DeliveryTracking, 'status'>[] = [];
    const trackingEvidence = new Map(
      allTracking.map((tracking, index) => {
        const trackingId = DeliveryService.assertValidPersistedStatsTracking(
          tracking,
          integration,
          index + 1,
          seenStatsTrackingIds,
          seenStatsOrderIds
        );
        const normalizedStatus = normalizeDeliveryStatus(
          `Persisted delivery stats tracking row ${index + 1} status`,
          tracking.status
        );
        statsTrackingRows.push({ status: normalizedStatus });
        return [trackingId, {
          order_id: tracking.order_id,
          provider: tracking.provider,
          status: normalizedStatus,
          delivered_at: tracking.delivered_at,
        }] as const;
      })
    );

    // Get average rating
    const ratings = await this.ratingRepository
      .createQueryBuilder('rating')
      .innerJoin('rating.delivery_tracking', 'tracking')
      .where('tracking.delivery_integration_id = :integrationId', {
        integrationId: integration.id,
      })
      .getMany();
    const seenRatingIds = new Set<string>();
    const ratedTrackingIds = new Set<string>();
    ratings.forEach((rating, index) =>
      DeliveryService.assertValidPersistedStatsRating(
        rating,
        trackingEvidence,
        seenRatingIds,
        ratedTrackingIds,
        index + 1
      )
    );

    const statsRatingRows = ratings.map((rating) => ({ rating: rating.rating }));
    return calculateDeliveryStats(statsTrackingRows, statsRatingRows);
  }

  private assertDeliveryPartnerEnabled(): void {
    if (this.enforceCapability) {
      assertCapabilityEnabled('delivery_partner');
    }
  }

  private static assertValidPersistedIntegration(integration: DeliveryIntegration): void {
    assertDeliveryPersistedRecordEnvelope(
      'Persisted delivery integration',
      integration as unknown as Record<string, unknown>,
      DELIVERY_INTEGRATION_ROW_KEYS
    );
    assertValidDeliveryProvider('Persisted delivery provider', integration.provider);
    assertValidCostHandling('Persisted delivery cost_handling', integration.cost_handling);
    assertOptionalBoolean('Persisted delivery integration is_active', integration.is_active);
    assertOptionalBoolean(
      'Persisted delivery integration auto_assign_delivery',
      integration.auto_assign_delivery
    );
    assertOptionalNonEmptyString('Persisted delivery integration api_key', integration.api_key);
    assertOptionalNonEmptyString('Persisted delivery integration api_secret', integration.api_secret);
    assertOptionalNonEmptyString(
      'Persisted delivery integration partner_account_id',
      integration.partner_account_id
    );
    assertOptionalNonEmptyString(
      'Persisted delivery integration pickup_instructions',
      integration.pickup_instructions
    );
    assertAbsoluteHttpsUrl('Persisted delivery integration webhook_url', integration.webhook_url);
    const createdAt = assertValidDeliveryDate(
      'Persisted delivery integration created_at',
      integration.created_at
    );
    const updatedAt = assertValidDeliveryDate(
      'Persisted delivery integration updated_at',
      integration.updated_at
    );
    if (createdAt && updatedAt && updatedAt < createdAt) {
      throw new Error('Persisted delivery integration updated_at cannot be before created_at');
    }
    const lastDeliveryAt = assertValidDeliveryDate(
      'Persisted delivery integration last_delivery_at',
      integration.last_delivery_at
    );
    if (createdAt && lastDeliveryAt && lastDeliveryAt < createdAt) {
      throw new Error('Persisted delivery integration last_delivery_at cannot be before created_at');
    }
    if (updatedAt && lastDeliveryAt && updatedAt < lastDeliveryAt) {
      throw new Error('Persisted delivery integration updated_at cannot be before last_delivery_at');
    }
    assertNonNegativeSafeIntegerCounter(
      'Persisted delivery integration total_deliveries',
      integration.total_deliveries
    );
    const failureCount = assertNonNegativeSafeIntegerCounter(
      'Persisted delivery integration failure_count',
      integration.failure_count
    );
    const lastError = integration.last_error === undefined || integration.last_error === null
      ? undefined
      : assertBoundedDeliveryFailureText('Persisted delivery integration last_error', integration.last_error);
    if (failureCount === 0 && lastError) {
      throw new Error('Persisted delivery integration last_error cannot be present when failure_count is zero');
    }
    assertNonNegativeIntegerCents(
      'Persisted fixed delivery fee',
      integration.fixed_delivery_fee_cents
    );
    assertDeliveryIntegrationSettingsEnvelope(
      'Persisted delivery integration settings',
      integration.settings
    );
  }

  private static assertValidPersistedOrderForDelivery(order: Order, orderId: string): void {
    const persistedOrderId = assertNonEmptyString('Persisted delivery order id', order.id);
    if (persistedOrderId !== orderId) {
      throw new Error('Persisted delivery order id must match requested order');
    }
    assertNonEmptyString('Persisted delivery order business_id', order.business_id);
  }

  private static assertValidPersistedIntegrationForBusiness(
    integration: DeliveryIntegration,
    businessId: string,
    requireActive = false
  ): void {
    DeliveryService.assertValidPersistedIntegration(integration);
    assertNonEmptyString('Persisted delivery integration id', integration.id);
    const persistedBusinessId = assertNonEmptyString(
      'Persisted delivery integration business_id',
      integration.business_id
    );
    if (persistedBusinessId !== businessId) {
      throw new Error('Persisted delivery integration business_id must match requested business');
    }
    if (requireActive && integration.is_active !== true) {
      throw new Error('Persisted delivery integration must be active');
    }
  }

  private static assertValidPersistedTracking(tracking: DeliveryTracking, orderId: string): void {
    assertDeliveryPersistedRecordEnvelope(
      'Persisted delivery tracking',
      tracking as unknown as Record<string, unknown>,
      DELIVERY_TRACKING_ROW_KEYS
    );
    assertNonEmptyString('Persisted delivery tracking id', tracking.id);
    const persistedOrderId = assertNonEmptyString('Persisted delivery tracking order_id', tracking.order_id);
    if (persistedOrderId !== orderId) {
      throw new Error('Persisted delivery tracking order_id must match requested order');
    }
    assertNonEmptyString('Persisted delivery tracking integration_id', tracking.delivery_integration_id);
    assertValidDeliveryProvider('Persisted delivery tracking provider', tracking.provider);
    const status = normalizeDeliveryStatus('Persisted delivery tracking status', tracking.status);
    const createdAt = assertValidDeliveryDate(
      'Persisted delivery tracking created_at',
      tracking.created_at
    );
    const updatedAt = assertValidDeliveryDate(
      'Persisted delivery tracking updated_at',
      tracking.updated_at
    );
    if (createdAt && updatedAt && updatedAt < createdAt) {
      throw new Error('Persisted delivery tracking updated_at cannot be before created_at');
    }
    assertOptionalNonEmptyString(
      'Persisted delivery tracking delivery_partner_id',
      tracking.delivery_partner_id
    );
    if (
      status !== 'pending' &&
      status !== 'failed' &&
      (tracking.delivery_partner_id === undefined || tracking.delivery_partner_id === null)
    ) {
      throw new Error('Persisted delivery tracking delivery_partner_id is required once delivery is assigned');
    }
    assertOptionalNonEmptyString(
      'Persisted delivery tracking delivery_person_name',
      tracking.delivery_person_name
    );
    assertOptionalNonEmptyString(
      'Persisted delivery tracking delivery_person_phone',
      tracking.delivery_person_phone
    );
    const estimatedPickupAt = assertValidDeliveryDate(
      'Persisted delivery tracking estimated_pickup_at',
      tracking.estimated_pickup_at
    );
    const pickedUpAt = assertValidDeliveryDate(
      'Persisted delivery tracking picked_up_at',
      tracking.picked_up_at
    );
    const estimatedDeliveryAt = assertValidDeliveryDate(
      'Persisted delivery tracking estimated_delivery_at',
      tracking.estimated_delivery_at
    );
    const deliveredAt = assertValidDeliveryDate(
      'Persisted delivery tracking delivered_at',
      tracking.delivered_at
    );
    if (createdAt && estimatedPickupAt && estimatedPickupAt < createdAt) {
      throw new Error('Persisted delivery tracking estimated_pickup_at cannot be before created_at');
    }
    if (createdAt && pickedUpAt && pickedUpAt < createdAt) {
      throw new Error('Persisted delivery tracking picked_up_at cannot be before created_at');
    }
    if (createdAt && estimatedDeliveryAt && estimatedDeliveryAt < createdAt) {
      throw new Error('Persisted delivery tracking estimated_delivery_at cannot be before created_at');
    }
    if (createdAt && deliveredAt && deliveredAt < createdAt) {
      throw new Error('Persisted delivery tracking delivered_at cannot be before created_at');
    }
    if (updatedAt && pickedUpAt && updatedAt < pickedUpAt) {
      throw new Error('Persisted delivery tracking updated_at cannot be before picked_up_at');
    }
    if (updatedAt && deliveredAt && updatedAt < deliveredAt) {
      throw new Error('Persisted delivery tracking updated_at cannot be before delivered_at');
    }
    if (
      estimatedPickupAt &&
      estimatedDeliveryAt &&
      estimatedDeliveryAt < estimatedPickupAt
    ) {
      throw new Error('Persisted delivery tracking estimated_delivery_at must not be before estimated_pickup_at');
    }
    if (status === 'delivered' && (tracking.delivered_at === undefined || tracking.delivered_at === null)) {
      throw new Error('Persisted delivery tracking delivered_at is required for delivered status');
    }
    if (
      status !== 'delivered' &&
      tracking.delivered_at !== undefined &&
      tracking.delivered_at !== null
    ) {
      throw new Error('Persisted delivery tracking delivered_at cannot be present before delivered status');
    }
    if (
      (status === 'picked_up' || status === 'en_route' || status === 'delivered') &&
      (tracking.picked_up_at === undefined || tracking.picked_up_at === null)
    ) {
      throw new Error('Persisted delivery tracking picked_up_at is required once delivery is picked up');
    }
    if (
      DELIVERY_STATUS_RANK[status] < DELIVERY_STATUS_RANK.picked_up &&
      tracking.picked_up_at !== undefined &&
      tracking.picked_up_at !== null
    ) {
      throw new Error('Persisted delivery tracking picked_up_at cannot be present before picked_up status');
    }
    if (
      tracking.picked_up_at &&
      tracking.delivered_at &&
      tracking.delivered_at.getTime() < tracking.picked_up_at.getTime()
    ) {
      throw new Error('Persisted delivery tracking delivered_at must not be before picked_up_at');
    }
    assertNonNegativeIntegerCents(
      'Persisted delivery tracking delivery_fee_cents',
      tracking.delivery_fee_cents
    );
    assertAbsoluteHttpsUrl(
      'Persisted delivery tracking tracking_url',
      tracking.tracking_url
    );
    if (tracking.error_message !== undefined && tracking.error_message !== null) {
      assertBoundedDeliveryFailureText(
        'Persisted delivery tracking error_message',
        tracking.error_message
      );
    }
    if (
      status === 'failed' &&
      (tracking.error_message === undefined || tracking.error_message === null)
    ) {
      throw new Error('Persisted delivery tracking error_message is required for failed status');
    }
    if (
      status !== 'failed' &&
      tracking.error_message !== undefined &&
      tracking.error_message !== null
    ) {
      throw new Error('Persisted delivery tracking error_message cannot be present before failed status');
    }
    assertOptionalNonEmptyString(
      'Persisted delivery tracking cancellation_reason',
      tracking.cancellation_reason
    );
    if (
      status === 'cancelled' &&
      (tracking.cancellation_reason === undefined || tracking.cancellation_reason === null)
    ) {
      throw new Error('Persisted delivery tracking cancellation_reason is required for cancelled status');
    }
    if (
      status !== 'cancelled' &&
      tracking.cancellation_reason !== undefined &&
      tracking.cancellation_reason !== null
    ) {
      throw new Error('Persisted delivery tracking cancellation_reason cannot be present before cancelled status');
    }
    const attemptCount = assertIncrementableCounter(
      'Persisted delivery tracking attempt_count',
      tracking.attempt_count
    );
    if (status === 'failed' && attemptCount === 0) {
      throw new Error('Persisted delivery tracking attempt_count must be greater than zero for failed status');
    }
    const statusHistory = tracking.status_history ?? [];
    if (!Array.isArray(statusHistory)) {
      throw new Error('Persisted delivery tracking status_history must be an array');
    }
    let previousHistoryTimestamp: Date | undefined;
    let lastHistoryStatus: DeliveryStatus | undefined;
    const seenHistoryEvidence = new Set<string>();
    statusHistory.forEach((entry, index) => {
      const historyLabel = `Persisted delivery tracking history row ${index + 1}`;
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        throw new Error(`${historyLabel} must be an object`);
      }
      const historyEntry = entry as Record<string, unknown> & {
        status?: unknown;
        timestamp?: Date;
        message?: string;
      };
      assertNoUnsafeDeliveryFieldNames(historyLabel, historyEntry);
      const unsupportedHistoryKeys = Object.keys(historyEntry).filter(
        (key) => !DELIVERY_STATUS_HISTORY_ENTRY_KEYS.has(key)
      );
      if (unsupportedHistoryKeys.length > 0) {
        throw new Error(
          `${historyLabel} include unsupported field(s): ${unsupportedHistoryKeys.sort().join(', ')}`
        );
      }
      const historyStatus = normalizeDeliveryStatus(`${historyLabel} status`, historyEntry.status);
      assertValidDeliveryDate(
        `${historyLabel} timestamp`,
        historyEntry.timestamp
      );
      const historyTimestamp = historyEntry.timestamp as Date;
      if (
        lastHistoryStatus &&
        !canTransitionDeliveryStatus(lastHistoryStatus, historyStatus)
      ) {
        throw new Error(`${historyLabel} status cannot transition from ${lastHistoryStatus} to ${historyStatus}`);
      }
      const historyEvidenceKey = `${historyStatus}:${historyTimestamp.toISOString()}`;
      if (seenHistoryEvidence.has(historyEvidenceKey)) {
        throw new Error(`${historyLabel} status/timestamp evidence must be unique`);
      }
      seenHistoryEvidence.add(historyEvidenceKey);
      if (createdAt && historyTimestamp < createdAt) {
        throw new Error(`${historyLabel} timestamp cannot be before created_at`);
      }
      if (previousHistoryTimestamp && historyTimestamp < previousHistoryTimestamp) {
        throw new Error(
          `${historyLabel} timestamp cannot be before previous history row`
        );
      }
      previousHistoryTimestamp = historyTimestamp;
      lastHistoryStatus = historyStatus;
      assertOptionalNonEmptyString(
        `${historyLabel} message`,
        historyEntry.message
      );
      if (
        (historyStatus === 'picked_up' || historyStatus === 'en_route' || historyStatus === 'delivered') &&
        tracking.picked_up_at &&
        historyTimestamp < tracking.picked_up_at
      ) {
        throw new Error(
          `${historyLabel} timestamp cannot be before picked_up_at evidence`
        );
      }
      if (historyStatus === 'delivered' && tracking.delivered_at && historyTimestamp < tracking.delivered_at) {
        throw new Error(
          `${historyLabel} timestamp cannot be before delivered_at evidence`
        );
      }
    });
    if (updatedAt && previousHistoryTimestamp && updatedAt < previousHistoryTimestamp) {
      throw new Error('Persisted delivery tracking updated_at cannot be before latest status_history timestamp');
    }
    if (lastHistoryStatus && lastHistoryStatus !== status) {
      throw new Error('Persisted delivery tracking status_history last row must match current status');
    }
  }

  private static assertValidPersistedTrackingForRequest(
    tracking: DeliveryTracking,
    trackingId: string
  ): void {
    assertDeliveryPersistedRecordEnvelope(
      'Persisted delivery tracking',
      tracking,
      DELIVERY_TRACKING_ROW_KEYS
    );
    const persistedTrackingId = assertNonEmptyString('Persisted delivery tracking id', tracking.id);
    if (persistedTrackingId !== trackingId) {
      throw new Error('Persisted delivery tracking id must match requested tracking');
    }
    const persistedOrderId = assertNonEmptyString('Persisted delivery tracking order_id', tracking.order_id);
    DeliveryService.assertValidPersistedTracking(tracking, persistedOrderId);
  }

  private static assertValidPersistedTrackingIntegrationRelation(tracking: DeliveryTracking): void {
    if (!tracking.delivery_integration) {
      throw new Error('Delivery integration relation is required before cancellation');
    }
    DeliveryService.assertValidPersistedIntegration(tracking.delivery_integration);
    const relationId = assertNonEmptyString(
      'Persisted delivery integration relation id',
      tracking.delivery_integration.id
    );
    if (relationId !== tracking.delivery_integration_id) {
      throw new Error('Persisted delivery integration relation id must match tracking integration');
    }
    assertNonEmptyString(
      'Persisted delivery integration relation business_id',
      tracking.delivery_integration.business_id
    );
    if (tracking.delivery_integration.provider !== tracking.provider) {
      throw new Error('Persisted delivery integration relation provider must match tracking provider');
    }
  }

  private static assertValidDeliveryCreationContext(
    tracking: DeliveryTracking,
    order: Order,
    integration: DeliveryIntegration
  ): void {
    const trackingOrderId = assertNonEmptyString(
      'Delivery creation tracking order_id',
      tracking.order_id
    );
    const orderId = assertNonEmptyString('Delivery creation order id', order.id);
    if (trackingOrderId !== orderId) {
      throw new Error('Delivery creation tracking order_id must match order id');
    }

    const trackingIntegrationId = assertNonEmptyString(
      'Delivery creation tracking delivery_integration_id',
      tracking.delivery_integration_id
    );
    const integrationId = assertNonEmptyString('Delivery creation integration id', integration.id);
    if (trackingIntegrationId !== integrationId) {
      throw new Error('Delivery creation tracking delivery_integration_id must match integration id');
    }

    const orderBusinessId = assertNonEmptyString(
      'Delivery creation order business_id',
      order.business_id
    );
    const integrationBusinessId = assertNonEmptyString(
      'Delivery creation integration business_id',
      integration.business_id
    );
    if (orderBusinessId !== integrationBusinessId) {
      throw new Error('Delivery creation integration business_id must match order business_id');
    }

    const trackingProvider = assertValidDeliveryProvider(
      'Delivery creation tracking provider',
      tracking.provider
    );
    const integrationProvider = assertValidDeliveryProvider(
      'Delivery creation integration provider',
      integration.provider
    );
    if (trackingProvider !== integrationProvider) {
      throw new Error('Delivery creation tracking provider must match integration provider');
    }
  }

  private static assertDeliveryRatingCustomerMatchesOrder(
    tracking: DeliveryTracking,
    customerId: string
  ): void {
    if (!tracking.order) {
      throw new Error('Delivery rating order relation is required before accepting customer rating');
    }
    const relationOrderId = assertNonEmptyString('Delivery rating order relation id', tracking.order.id);
    if (relationOrderId !== tracking.order_id) {
      throw new Error('Delivery rating order relation id must match tracking order_id');
    }
    const relationCustomerId = assertNonEmptyString(
      'Delivery rating order relation customer_id',
      tracking.order.customer_id
    );
    if (relationCustomerId !== customerId) {
      throw new Error('Delivery rating customer_id must match order customer_id');
    }
  }

  private static assertValidPersistedStatsTracking(
    tracking: DeliveryTracking,
    integration: DeliveryIntegration,
    rowNumber: number,
    seenTrackingIds: Set<string>,
    seenOrderIds: Set<string>
  ): string {
    const label = `Persisted delivery stats tracking row ${rowNumber}`;
    assertDeliveryPersistedRecordObject(label, tracking);
    const trackingId = assertNonEmptyString(`${label} id`, tracking.id);
    if (seenTrackingIds.has(trackingId)) {
      throw new Error(`${label} id must be unique for stats aggregation`);
    }
    seenTrackingIds.add(trackingId);
    const integrationId = assertNonEmptyString(`${label} delivery_integration_id`, tracking.delivery_integration_id);
    if (integrationId !== integration.id) {
      throw new Error(`${label} delivery_integration_id must match requested integration`);
    }
    if (tracking.provider !== integration.provider) {
      throw new Error(`${label} provider must match requested integration`);
    }
    const orderId = assertNonEmptyString(`${label} order_id`, tracking.order_id);
    if (seenOrderIds.has(orderId)) {
      throw new Error(`${label} order_id must be unique for stats aggregation`);
    }
    seenOrderIds.add(orderId);
    DeliveryService.assertValidPersistedTracking(tracking, orderId);
    assertNonNegativeIntegerCents(`${label} delivery_fee_cents`, tracking.delivery_fee_cents);
    return trackingId;
  }

  private static assertValidPersistedStatsRating(
    rating: DeliveryRating,
    trackingEvidence: Map<string, Pick<DeliveryTracking, 'order_id' | 'provider' | 'status' | 'delivered_at'>>,
    seenRatingIds: Set<string>,
    ratedTrackingIds: Set<string>,
    rowNumber: number
  ): void {
    const label = `Persisted delivery stats rating row ${rowNumber}`;
    assertDeliveryPersistedRecordEnvelope(label, rating as unknown as Record<string, unknown>, DELIVERY_RATING_ROW_KEYS);
    const ratingId = assertNonEmptyString(`${label} id`, rating.id);
    if (seenRatingIds.has(ratingId)) {
      throw new Error(`${label} id must be unique for stats aggregation`);
    }
    seenRatingIds.add(ratingId);
    const trackingId = assertNonEmptyString(`${label} delivery_tracking_id`, rating.delivery_tracking_id);
    if (ratedTrackingIds.has(trackingId)) {
      throw new Error(`${label} delivery_tracking_id must be unique for stats aggregation`);
    }
    ratedTrackingIds.add(trackingId);
    const expectedTracking = trackingEvidence.get(trackingId);
    if (!expectedTracking) {
      throw new Error(`${label} delivery_tracking_id must match a requested tracking row`);
    }
    if (expectedTracking.status !== 'delivered') {
      throw new Error(`${label} delivery_tracking_id must reference a delivered tracking row`);
    }
    const ratingOrderId = assertNonEmptyString(`${label} order_id`, rating.order_id);
    if (ratingOrderId !== expectedTracking.order_id) {
      throw new Error(`${label} order_id must match requested tracking row`);
    }
    assertNonEmptyString(`${label} customer_id`, rating.customer_id);
    const ratingProvider = assertValidDeliveryProvider(`${label} provider`, rating.provider);
    if (ratingProvider !== expectedTracking.provider) {
      throw new Error(`${label} provider must match requested tracking row`);
    }
    const ratingCreatedAt = assertValidDeliveryDate(`${label} created_at`, rating.created_at);
    if (
      ratingCreatedAt &&
      expectedTracking.delivered_at &&
      ratingCreatedAt < expectedTracking.delivered_at
    ) {
      throw new Error(`${label} created_at cannot be before delivered_at`);
    }
    assertRequiredRatingRange(label, rating.rating);
    assertRatingRange(`${label} timeliness_rating`, rating.timeliness_rating);
    assertRatingRange(`${label} courtesy_rating`, rating.courtesy_rating);
    assertRatingRange(`${label} packaging_rating`, rating.packaging_rating);
    assertOptionalNonEmptyString(`${label} feedback`, rating.feedback);
    normalizeOptionalStringArray(`${label} issues`, rating.issues);
  }

  private static assertValidPersistedRatingForTracking(
    rating: DeliveryRating,
    tracking: DeliveryTracking
  ): void {
    const label = 'Persisted delivery rating';
    assertDeliveryPersistedRecordEnvelope(label, rating as unknown as Record<string, unknown>, DELIVERY_RATING_ROW_KEYS);
    assertNonEmptyString(`${label} id`, rating.id);
    const ratingTrackingId = assertNonEmptyString(`${label} delivery_tracking_id`, rating.delivery_tracking_id);
    if (ratingTrackingId !== tracking.id) {
      throw new Error(`${label} delivery_tracking_id must match requested tracking`);
    }
    const ratingOrderId = assertNonEmptyString(`${label} order_id`, rating.order_id);
    if (ratingOrderId !== tracking.order_id) {
      throw new Error(`${label} order_id must match requested tracking order`);
    }
    const ratingCustomerId = assertNonEmptyString(`${label} customer_id`, rating.customer_id);
    const trackingCustomerId = assertNonEmptyString(
      `${label} tracking order customer_id`,
      tracking.order?.customer_id
    );
    if (ratingCustomerId !== trackingCustomerId) {
      throw new Error(`${label} customer_id must match requested tracking customer`);
    }
    const ratingProvider = assertValidDeliveryProvider(`${label} provider`, rating.provider);
    if (ratingProvider !== tracking.provider) {
      throw new Error(`${label} provider must match requested tracking provider`);
    }
    const ratingCreatedAt = assertValidDeliveryDate(`${label} created_at`, rating.created_at);
    if (
      ratingCreatedAt &&
      tracking.delivered_at &&
      ratingCreatedAt < tracking.delivered_at
    ) {
      throw new Error(`${label} created_at cannot be before delivered_at`);
    }
    assertRequiredRatingRange(`${label} rating`, rating.rating);
    assertRatingRange(`${label} timeliness_rating`, rating.timeliness_rating);
    assertRatingRange(`${label} courtesy_rating`, rating.courtesy_rating);
    assertRatingRange(`${label} packaging_rating`, rating.packaging_rating);
    assertOptionalNonEmptyString(`${label} feedback`, rating.feedback);
    normalizeOptionalStringArray(`${label} issues`, rating.issues);
  }

  private static assertValidDeliveryCancellationResult(
    result: DeliveryCancellationResult,
    tracking: DeliveryTracking
  ): void {
    if (result.delivery_partner_id !== undefined) {
      const providerPartnerId = assertBoundedDeliveryProviderId(
        'Delivery provider cancellation response delivery_partner_id',
        result.delivery_partner_id
      );
      const requestedPartnerId = assertNonEmptyString(
        'Delivery cancellation requested delivery_partner_id',
        tracking.delivery_partner_id
      );
      if (providerPartnerId !== requestedPartnerId) {
        throw new Error(
          'Delivery provider cancellation response delivery_partner_id must match requested partner'
        );
      }
      result.delivery_partner_id = providerPartnerId;
    }

    if (result.order_id !== undefined) {
      const providerOrderId = assertBoundedDeliveryProviderId(
        'Delivery provider cancellation response order_id',
        result.order_id
      );
      const trackingOrderId = assertNonEmptyString(
        'Delivery cancellation tracking order_id',
        tracking.order_id
      );
      if (providerOrderId !== trackingOrderId) {
        throw new Error('Delivery provider cancellation response order_id must match tracking order');
      }
      result.order_id = providerOrderId;
    }

    if (result.business_id !== undefined) {
      const providerBusinessId = assertBoundedDeliveryProviderId(
        'Delivery provider cancellation response business_id',
        result.business_id
      );
      const integrationBusinessId = assertNonEmptyString(
        'Delivery cancellation integration business_id',
        tracking.delivery_integration?.business_id
      );
      if (providerBusinessId !== integrationBusinessId) {
        throw new Error(
          'Delivery provider cancellation response business_id must match tracking integration business'
        );
      }
      result.business_id = providerBusinessId;
    }

    if (result.delivery_integration_id !== undefined) {
      const providerIntegrationId = assertBoundedDeliveryProviderId(
        'Delivery provider cancellation response delivery_integration_id',
        result.delivery_integration_id
      );
      const trackingIntegrationId = assertNonEmptyString(
        'Delivery cancellation tracking delivery_integration_id',
        tracking.delivery_integration_id
      );
      if (providerIntegrationId !== trackingIntegrationId) {
        throw new Error(
          'Delivery provider cancellation response delivery_integration_id must match tracking integration'
        );
      }
      result.delivery_integration_id = providerIntegrationId;
    }
  }

  private static assertValidDeliveryCreationResult(
    result: DeliveryCreationResult,
    order: Order,
    integration: DeliveryIntegration
  ): void {
    if (result.delivery_partner_id === undefined) {
      throw new Error('Delivery provider success response must include delivery_partner_id');
    }
    const deliveryPartnerId = assertBoundedDeliveryProviderId(
      'Delivery provider success response delivery_partner_id',
      result.delivery_partner_id
    );
    result.delivery_partner_id = deliveryPartnerId;

    if (result.order_id !== undefined) {
      const providerOrderId = assertBoundedDeliveryProviderId(
        'Delivery provider success response order_id',
        result.order_id
      );
      const requestedOrderId = assertNonEmptyString(
        'Delivery provider success requested order id',
        order.id
      );
      if (providerOrderId !== requestedOrderId) {
        throw new Error('Delivery provider success response order_id must match requested order');
      }
      result.order_id = providerOrderId;
    }

    if (result.business_id !== undefined) {
      const providerBusinessId = assertBoundedDeliveryProviderId(
        'Delivery provider success response business_id',
        result.business_id
      );
      const requestedBusinessId = assertNonEmptyString(
        'Delivery provider success requested order business_id',
        order.business_id
      );
      if (providerBusinessId !== requestedBusinessId) {
        throw new Error('Delivery provider success response business_id must match requested order business');
      }
      result.business_id = providerBusinessId;
    }

    if (result.delivery_integration_id !== undefined) {
      const providerIntegrationId = assertBoundedDeliveryProviderId(
        'Delivery provider success response delivery_integration_id',
        result.delivery_integration_id
      );
      const requestedIntegrationId = assertNonEmptyString(
        'Delivery provider success integration id',
        integration.id
      );
      if (providerIntegrationId !== requestedIntegrationId) {
        throw new Error(
          'Delivery provider success response delivery_integration_id must match active integration'
        );
      }
      result.delivery_integration_id = providerIntegrationId;
    }

    assertNonNegativeIntegerCents(
      'Delivery provider success response delivery_fee_cents',
      result.delivery_fee_cents
    );
    const estimatedPickupAt = assertValidDeliveryDate(
      'Delivery provider success response estimated_pickup_at',
      result.estimated_pickup_at
    );
    const estimatedDeliveryAt = assertValidDeliveryDate(
      'Delivery provider success response estimated_delivery_at',
      result.estimated_delivery_at
    );

    if ((estimatedPickupAt === undefined) !== (estimatedDeliveryAt === undefined)) {
      throw new Error(
        'Delivery provider success response estimates must include both estimated_pickup_at and estimated_delivery_at'
      );
    }

    if (
      estimatedPickupAt &&
      estimatedDeliveryAt &&
      estimatedDeliveryAt.getTime() < estimatedPickupAt.getTime()
    ) {
      throw new Error('Delivery provider success response estimated_delivery_at must not be before estimated_pickup_at');
    }

    const requestedOrderCreatedAt = assertValidDeliveryDate(
      'Delivery provider success requested order created_at',
      order.created_at
    );
    if (
      estimatedPickupAt &&
      requestedOrderCreatedAt &&
      estimatedPickupAt.getTime() < requestedOrderCreatedAt.getTime()
    ) {
      throw new Error('Delivery provider success response estimated_pickup_at cannot be before order created_at');
    }

    assertAbsoluteHttpsUrl(
      'Delivery provider success response tracking_url',
      result.tracking_url
    );
    if (result.tracking_url !== undefined) {
      result.tracking_url = result.tracking_url.trim();
    }
  }
}
