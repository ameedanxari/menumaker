import { Repository, LessThan } from 'typeorm';
import { AppDataSource } from '../config/database.js';
import { POSIntegration, POSSyncLog, POSProvider, SyncStatus } from '../models/POSIntegration.js';
import { Order } from '../models/Order.js';
import { FeatureUnavailableError, assertCapabilityEnabled } from '../config/capabilities.js';

export type POSSyncErrorKind = 'retryable' | 'permanent' | 'rate_limited' | 'feature_unavailable';

export class POSSyncError extends Error {
  constructor(
    message: string,
    readonly kind: POSSyncErrorKind,
    readonly httpStatus?: number,
    readonly retryAfterMs?: number
  ) {
    super(message);
  }
}

export interface POSHttpResponse {
  status: number;
  json(): Promise<any>;
}

export type POSHttpClient = (url: string, init: {
  method: string;
  headers: Record<string, string>;
  body: string;
}) => Promise<POSHttpResponse>;

export interface POSOrderCreationResult {
  success: boolean;
  pos_order_id?: string;
  reference_id?: string;
  location_id?: string;
  metadata?: {
    menumaker_order_id?: string;
    business_id?: string;
  };
  error?: string;
}

interface POSRepositoryOverrides {
  integrationRepository?: Repository<POSIntegration>;
  syncLogRepository?: Repository<POSSyncLog>;
  orderRepository?: Repository<Order>;
}

interface POSSyncServiceOptions {
  enforceCapability?: boolean;
}

const VALID_SYNC_STATUSES = new Set<SyncStatus>(['pending', 'syncing', 'success', 'failed', 'retry']);
const DEFAULT_SYNC_HISTORY_LIMIT = 50;
const MAX_SYNC_HISTORY_LIMIT = 100;
const LAUNCH_POS_PROVIDER: POSProvider = 'square';
const UNSAFE_POS_TEXT_CONTROLS =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/u;
const MAX_POS_PROVIDER_ID_LENGTH = 255;
const MAX_POS_PROVIDER_TOKEN_LENGTH = 2048;
const MAX_POS_PROVIDER_ERROR_MESSAGE_LENGTH = 1000;
const POS_ORDER_CREATION_SUCCESS_EVIDENCE_KEYS = [
  'pos_order_id',
  'reference_id',
  'location_id',
  'metadata',
] as const;
const POS_ORDER_CREATION_RESULT_KEYS = new Set([
  'success',
  'error',
  ...POS_ORDER_CREATION_SUCCESS_EVIDENCE_KEYS,
]);
const POS_PROVIDER_SUCCESS_METADATA_KEYS = new Set([
  'menumaker_order_id',
  'business_id',
]);
const POS_TOKEN_REFRESH_RESULT_KEYS = new Set([
  'access_token',
  'refresh_token',
  'expires_at',
]);
const POS_ORDER_REQUEST_METADATA_KEYS = new Set([
  'source',
  'menumaker_order_id',
  'business_id',
]);
const POS_ORDER_REQUEST_SOURCE = 'MenuMaker';
const POS_SYNC_REQUEST_PAYLOAD_KEYS = new Set([
  'idempotency_key',
  'order',
]);
const POS_SYNC_REQUEST_ORDER_KEYS = new Set([
  'location_id',
  'line_items',
  'customer_id',
  'reference_id',
  'metadata',
]);
const POS_INTEGRATION_OPTION_KEYS = new Set([
  'refresh_token',
  'token_expires_at',
  'location_id',
  'merchant_id',
]);
const POS_INTEGRATION_ROW_KEYS = new Set([
  'id',
  'business',
  'business_id',
  'provider',
  'is_active',
  'access_token',
  'refresh_token',
  'token_expires_at',
  'location_id',
  'merchant_id',
  'auto_sync_orders',
  'sync_customer_info',
  'item_mapping',
  'last_sync_at',
  'error_count',
  'last_error',
  'settings',
  'created_at',
  'updated_at',
]);
const POS_INTEGRATION_SETTINGS_KEYS = new Set([
  'webhook_url',
  'api_version',
  'tax_handling',
]);
const POS_INTEGRATION_TAX_HANDLING_VALUES = new Set(['auto', 'manual']);
const POS_SYNC_LOG_ROW_KEYS = new Set([
  'id',
  'pos_integration',
  'pos_integration_id',
  'order',
  'order_id',
  'status',
  'provider',
  'pos_order_id',
  'retry_count',
  'max_retries',
  'next_retry_at',
  'error_message',
  'http_status',
  'request_payload',
  'response_data',
  'duration_ms',
  'completed_at',
  'created_at',
  'updated_at',
]);

interface NormalizedSyncHistoryOptions {
  limit: number;
  offset: number;
  status?: SyncStatus;
}

const defaultPOSHttpClient: POSHttpClient = async (url, init) => {
  const response = await fetch(url, init);
  return {
    status: response.status,
    json: async () => response.json(),
  };
};

async function readPOSJsonObject(
  response: POSHttpResponse,
  label: string
): Promise<Record<string, unknown>> {
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new POSSyncError(`${label} must be valid JSON`, 'permanent', response.status);
  }

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new POSSyncError(`${label} must be a JSON object`, 'permanent', response.status);
  }

  return data as Record<string, unknown>;
}

function parseDottedIPv4(hostname: string): number[] | null {
  const parts = hostname.split('.');
  if (parts.length !== 4) return null;

  const octets = parts.map((part) => {
    if (!/^\d{1,3}$/.test(part)) return Number.NaN;
    const octet = Number(part);
    return Number.isInteger(octet) && octet >= 0 && octet <= 255 ? octet : Number.NaN;
  });

  return octets.every((octet) => Number.isInteger(octet)) ? octets : null;
}

function isPrivateOrInternalEndpointHost(hostname: string): boolean {
  const normalizedHost = hostname.toLowerCase().replace(/\.$/, '');
  const unbracketedHost = normalizedHost.replace(/^\[(.*)\]$/, '$1');

  if (unbracketedHost === 'localhost' || unbracketedHost.endsWith('.localhost')) {
    return true;
  }

  const ipv4Host = unbracketedHost.startsWith('::ffff:')
    ? unbracketedHost.slice('::ffff:'.length)
    : unbracketedHost;
  const octets = parseDottedIPv4(ipv4Host);
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

  const firstIpv6Group = unbracketedHost.split(':')[0];
  return (
    unbracketedHost === '::1' ||
    firstIpv6Group.startsWith('fc') ||
    firstIpv6Group.startsWith('fd') ||
    firstIpv6Group.toLowerCase() === 'fe80'
  );
}

function providerResponseMessage(data: Record<string, unknown>): string | undefined {
  if (typeof data.message !== 'string') {
    return undefined;
  }
  if (hasUnsafePOSTextControls(data.message)) {
    throw new POSSyncError(
      'POS provider response message must not include unsafe control characters',
      'permanent'
    );
  }
  if (!data.message.trim()) {
    return undefined;
  }
  const normalized = data.message.trim();
  if (normalized.length > MAX_POS_PROVIDER_ERROR_MESSAGE_LENGTH) {
    throw new POSSyncError(
      `POS provider response message must be at most ${MAX_POS_PROVIDER_ERROR_MESSAGE_LENGTH} characters`,
      'permanent'
    );
  }
  return normalized;
}

function assertAbsoluteHttpsEndpointBase(label: string, value: string): string {
  if (typeof value !== 'string') {
    throw new POSSyncError(`${label} must be an absolute HTTPS URL`, 'permanent');
  }
  if (hasUnsafePOSTextControls(value)) {
    throw new POSSyncError(`${label} must not include unsafe control characters`, 'permanent');
  }
  if (value.trim().length === 0) {
    throw new POSSyncError(`${label} must be an absolute HTTPS URL`, 'permanent');
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(value.trim());
  } catch {
    throw new POSSyncError(`${label} must be an absolute HTTPS URL`, 'permanent');
  }

  if (parsedUrl.protocol !== 'https:' || !parsedUrl.hostname) {
    throw new POSSyncError(`${label} must be an absolute HTTPS URL`, 'permanent');
  }
  if (parsedUrl.username || parsedUrl.password) {
    throw new POSSyncError(`${label} must not include embedded credentials`, 'permanent');
  }
  if (isPrivateOrInternalEndpointHost(parsedUrl.hostname)) {
    throw new POSSyncError(`${label} must not use a private or internal host`, 'permanent');
  }
  parsedUrl.pathname = parsedUrl.pathname.replace(/\/+$/, '');
  parsedUrl.search = '';
  parsedUrl.hash = '';
  return parsedUrl.toString().replace(/\/$/, '');
}

function squareOrderObjectFromResponse(
  data: Record<string, unknown>,
  httpStatus: number
): Record<string, unknown> | undefined {
  const order = data.order;
  if (order === undefined || order === null) return undefined;
  if (typeof order !== 'object' || Array.isArray(order)) {
    throw new POSSyncError(
      'Square order response body order must be a JSON object',
      'permanent',
      httpStatus
    );
  }
  return order as Record<string, unknown>;
}

function squareOrderIdFromResponse(data: Record<string, unknown>, httpStatus: number): unknown {
  const order = squareOrderObjectFromResponse(data, httpStatus);
  if (order) {
    if ('id' in order) {
      return order.id;
    }
  }

  if ('id' in data) {
    return data.id;
  }

  return undefined;
}

function squareOrderFieldFromResponse(data: Record<string, unknown>, field: string, httpStatus: number): unknown {
  const order = squareOrderObjectFromResponse(data, httpStatus);
  if (order && field in order) {
    return order[field];
  }

  return data[field];
}

function assertPositiveIntegerQuantity(label: string, value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(numeric) || numeric <= 0) {
    throw new POSSyncError(`${label} must be a positive integer quantity`, 'permanent');
  }
  return numeric;
}

function assertNonNegativeIntegerCents(label: string, value: unknown): number {
  if (value === null || value === undefined) {
    throw new POSSyncError(`${label} is required before POS sync`, 'permanent');
  }
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(numeric) || numeric < 0) {
    throw new POSSyncError(`${label} must be a non-negative integer amount in cents`, 'permanent');
  }
  return numeric;
}

function assertNonNegativeSafeIntegerCount(label: string, value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(numeric) || numeric < 0) {
    throw new POSSyncError(`${label} must be a non-negative integer`, 'permanent');
  }
  if (!Number.isSafeInteger(numeric)) {
    throw new POSSyncError(`${label} must be a safe integer`, 'permanent');
  }
  return numeric;
}

function checkedIncrementCount(label: string, value: number): number {
  const incremented = value + 1;
  if (!Number.isSafeInteger(incremented)) {
    throw new POSSyncError(`${label} must remain a safe integer after increment`, 'permanent');
  }
  return incremented;
}

function assertValidDate(label: string, value: Date): Date {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new POSSyncError(`${label} must be a valid Date`, 'permanent');
  }
  return value;
}

function assertFutureDate(label: string, value: Date): Date {
  const date = assertValidDate(label, value);
  if (date.getTime() <= Date.now()) {
    throw new POSSyncError(`${label} must be in the future`, 'permanent');
  }
  return date;
}

function assertNonEmptyString(label: string, value: unknown): string {
  if (typeof value !== 'string') {
    throw new POSSyncError(`${label} must be a non-empty string`, 'permanent');
  }
  if (hasUnsafePOSTextControls(value)) {
    throw new POSSyncError(`${label} must not include unsafe control characters`, 'permanent');
  }
  if (!value.trim()) {
    throw new POSSyncError(`${label} must be a non-empty string`, 'permanent');
  }
  const normalized = value.trim();
  return normalized;
}

function assertPOSProviderErrorMessage(label: string, value: unknown, httpStatus?: number): string {
  if (typeof value !== 'string') {
    throw new POSSyncError(`${label} must be a non-empty string`, 'permanent', httpStatus);
  }
  if (hasUnsafePOSTextControls(value)) {
    throw new POSSyncError(
      `${label} must not include unsafe control characters`,
      'permanent',
      httpStatus
    );
  }
  const normalized = value.trim();
  if (!normalized) {
    throw new POSSyncError(`${label} must be a non-empty string`, 'permanent', httpStatus);
  }
  if (normalized.length > MAX_POS_PROVIDER_ERROR_MESSAGE_LENGTH) {
    throw new POSSyncError(
      `${label} must be at most ${MAX_POS_PROVIDER_ERROR_MESSAGE_LENGTH} characters`,
      'permanent',
      httpStatus
    );
  }
  return normalized;
}

function hasUnsafePOSTextControls(value: string): boolean {
  return UNSAFE_POS_TEXT_CONTROLS.test(value);
}

function assertPOSProviderFieldNamesAreSafe(label: string, fieldNames: string[]): void {
  if (fieldNames.some((fieldName) => hasUnsafePOSTextControls(fieldName))) {
    throw new POSSyncError(`${label} field names must not include unsafe control characters`, 'permanent');
  }
}

function normalizeOptionalPayloadString(label: string, value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') {
    throw new POSSyncError(`${label} must be a string`, 'permanent');
  }

  if (hasUnsafePOSTextControls(value)) {
    throw new POSSyncError(`${label} must not include unsafe control characters`, 'permanent');
  }
  const normalized = value.trim();
  return normalized || undefined;
}

function normalizeOptionalPOSProviderId(
  label: string,
  value: unknown,
  httpStatus?: number
): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') {
    throw new POSSyncError(`${label} must be a string`, 'permanent', httpStatus);
  }
  if (hasUnsafePOSTextControls(value)) {
    throw new POSSyncError(
      `${label} must not include unsafe control characters`,
      'permanent',
      httpStatus
    );
  }
  const normalized = value.trim();
  if (!normalized) return undefined;
  if (normalized.length > MAX_POS_PROVIDER_ID_LENGTH) {
    throw new POSSyncError(
      `${label} must be at most ${MAX_POS_PROVIDER_ID_LENGTH} characters`,
      'permanent',
      httpStatus
    );
  }
  return normalized;
}

function assertPOSProviderId(label: string, value: unknown): string {
  const normalized = assertNonEmptyString(label, value);
  if (normalized.length > MAX_POS_PROVIDER_ID_LENGTH) {
    throw new POSSyncError(
      `${label} must be at most ${MAX_POS_PROVIDER_ID_LENGTH} characters`,
      'permanent'
    );
  }
  return normalized;
}

function assertPOSProviderToken(label: string, value: unknown, httpStatus?: number): string {
  if (typeof value !== 'string') {
    throw new POSSyncError(`${label} must be a non-empty string`, 'permanent', httpStatus);
  }
  if (hasUnsafePOSTextControls(value)) {
    throw new POSSyncError(
      `${label} must not include unsafe control characters`,
      'permanent',
      httpStatus
    );
  }
  const normalized = value.trim();
  if (!normalized) {
    throw new POSSyncError(`${label} must be a non-empty string`, 'permanent', httpStatus);
  }
  if (normalized.length > MAX_POS_PROVIDER_TOKEN_LENGTH) {
    throw new POSSyncError(
      `${label} must be at most ${MAX_POS_PROVIDER_TOKEN_LENGTH} characters`,
      'permanent',
      httpStatus
    );
  }
  return normalized;
}

function normalizeCurrencyCode(value: unknown): string {
  const normalized = normalizeOptionalPayloadString('Order currency', value) ?? 'INR';
  const uppercased = normalized.toUpperCase();
  if (!/^[A-Z]{3}$/.test(uppercased)) {
    throw new POSSyncError('Order currency must be a three-letter ISO-4217 code', 'permanent');
  }
  return uppercased;
}

function assertPlainObject(label: string, value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new POSSyncError(`${label} must be an object`, 'permanent');
  }
  return value as Record<string, unknown>;
}

function assertBoundedPositiveInteger(
  label: string,
  value: unknown,
  defaultValue: number,
  maxValue: number
): number {
  if (value === undefined || value === null) {
    return defaultValue;
  }

  const numeric =
    typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;

  if (typeof numeric !== 'number' || !Number.isInteger(numeric)) {
    throw new Error(`${label} must be an integer`);
  }

  if (!Number.isSafeInteger(numeric)) {
    throw new Error(`${label} must be a safe integer`);
  }

  if (numeric <= 0 || numeric > maxValue) {
    throw new Error(`${label} must be between 1 and ${maxValue}`);
  }

  return numeric;
}

function assertNonNegativeInteger(
  label: string,
  value: unknown,
  defaultValue: number
): number {
  if (value === undefined || value === null) {
    return defaultValue;
  }

  const numeric =
    typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;

  if (typeof numeric !== 'number' || !Number.isInteger(numeric)) {
    throw new Error(`${label} must be an integer`);
  }

  if (!Number.isSafeInteger(numeric)) {
    throw new Error(`${label} must be a safe integer`);
  }

  if (numeric < 0) {
    throw new Error(`${label} must be non-negative`);
  }

  return numeric;
}

function normalizeSyncStatus(label: string, value: unknown): SyncStatus {
  if (typeof value !== 'string') {
    throw new Error(`${label} has an invalid status`);
  }
  if (hasUnsafePOSTextControls(value)) {
    throw new Error(`${label} must not include unsafe control characters`);
  }
  if (!value.trim()) {
    throw new Error(`${label} has an invalid status`);
  }

  const normalized = value.trim().toLowerCase() as SyncStatus;
  if (!VALID_SYNC_STATUSES.has(normalized)) {
    throw new Error(`${label} has an invalid status`);
  }

  return normalized;
}

function assertOptionalNonEmptyString(label: string, value: unknown): void {
  if (value === undefined || value === null) return;
  assertNonEmptyString(label, value);
}

function assertOptionalPOSProviderErrorMessage(label: string, value: unknown): void {
  if (value === undefined || value === null) return;
  assertPOSProviderErrorMessage(label, value);
}

function assertOptionalValidDate(label: string, value: unknown): void {
  if (value === undefined || value === null) return;
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new Error(`${label} must be a valid Date`);
  }
}

function assertOptionalNonNegativeSafeInteger(label: string, value: unknown): void {
  if (value === undefined || value === null) return;
  assertNonNegativeSafeIntegerCount(label, value);
}

function assertOptionalHttpStatus(label: string, value: unknown): number | undefined {
  if (value === undefined || value === null) return undefined;
  const status = assertNonNegativeSafeIntegerCount(label, value);
  if (status < 100 || status > 599) {
    throw new Error(`${label} must be a valid HTTP status`);
  }
  return status;
}

function isRetryablePOSHttpStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function assertPOSHttpStatus(label: string, value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(numeric) || !Number.isSafeInteger(numeric) || numeric < 100 || numeric > 599) {
    throw new POSSyncError(`${label} must be a valid HTTP status`, 'permanent');
  }
  return numeric;
}

function assertNonTerminalSquareResponseStatus(label: string, value: unknown): number {
  const responseStatus = assertPOSHttpStatus(label, value);
  if ((responseStatus >= 100 && responseStatus < 200) || (responseStatus >= 300 && responseStatus < 400)) {
    throw new POSSyncError(`${label} must be a terminal Square response status`, 'permanent');
  }
  return responseStatus;
}

function assertOptionalBoolean(label: string, value: unknown): void {
  if (value === undefined || value === null) return;
  if (typeof value !== 'boolean') {
    throw new Error(`${label} must be a boolean`);
  }
}

function assertOptionalAbsoluteHttpsUrl(label: string, value: unknown): void {
  if (value === undefined || value === null) return;
  const url = assertNonEmptyString(label, value);
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error(`${label} must be an absolute HTTPS URL`);
  }
  if (parsedUrl.protocol !== 'https:' || !parsedUrl.hostname) {
    throw new Error(`${label} must be an absolute HTTPS URL`);
  }
  if (parsedUrl.username || parsedUrl.password) {
    throw new Error(`${label} must not include embedded credentials`);
  }
}

function assertOptionalPOSItemMapping(label: string, value: unknown): void {
  if (value === undefined || value === null) return;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }

  for (const [dishId, posItemId] of Object.entries(value as Record<string, unknown>)) {
    assertNonEmptyString(`${label} dish id`, dishId);
    assertNonEmptyString(`${label}[${dishId}]`, posItemId);
  }
}

function assertOptionalPOSIntegrationSettings(label: string, value: unknown): void {
  if (value === undefined || value === null) return;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }

  const settings = value as Record<string, unknown>;
  assertPOSProviderFieldNamesAreSafe(label, Object.keys(settings));
  const unsupportedKeys = Object.keys(settings).filter(
    (key) => !POS_INTEGRATION_SETTINGS_KEYS.has(key)
  );
  if (unsupportedKeys.length > 0) {
    throw new Error(`${label} include unsupported field(s): ${unsupportedKeys.sort().join(', ')}`);
  }

  assertOptionalAbsoluteHttpsUrl(`${label}.webhook_url`, settings.webhook_url);
  assertOptionalNonEmptyString(`${label}.api_version`, settings.api_version);
  if (
    settings.tax_handling !== undefined &&
    settings.tax_handling !== null &&
    (typeof settings.tax_handling !== 'string' || !POS_INTEGRATION_TAX_HANDLING_VALUES.has(settings.tax_handling))
  ) {
    throw new Error(`${label}.tax_handling must be auto or manual`);
  }
}

function assertLaunchPOSProvider(provider: unknown, message: string): POSProvider {
  if (provider !== LAUNCH_POS_PROVIDER) {
    throw new FeatureUnavailableError('pos_sync', message);
  }

  return LAUNCH_POS_PROVIDER;
}

function normalizePOSIntegrationOptions(options: unknown): {
  refresh_token?: string;
  token_expires_at?: Date;
  location_id?: string;
  merchant_id?: string;
} {
  if (options === undefined) return {};
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    throw new POSSyncError('POS integration options must be an object', 'permanent');
  }
  const optionRecord = options as Record<string, unknown>;
  assertPOSProviderFieldNamesAreSafe('POS integration options', Object.keys(optionRecord));
  const unsupportedKeys = Object.keys(optionRecord).filter(
    (key) => !POS_INTEGRATION_OPTION_KEYS.has(key)
  );
  if (unsupportedKeys.length > 0) {
    throw new POSSyncError(
      `POS integration options include unsupported field(s): ${unsupportedKeys.sort().join(', ')}`,
      'permanent'
    );
  }
  return options as {
    refresh_token?: string;
    token_expires_at?: Date;
    location_id?: string;
    merchant_id?: string;
  };
}

function normalizeSyncHistoryOptions(options?: {
  limit?: number;
  offset?: number;
  status?: SyncStatus;
}): NormalizedSyncHistoryOptions {
	  if (options !== undefined && (!options || typeof options !== 'object' || Array.isArray(options))) {
	    throw new Error('POS sync history options must be an object');
	  }
	  assertPOSProviderFieldNamesAreSafe('POS sync history options', Object.keys(options ?? {}));
	  for (const optionKey of Object.keys(options ?? {})) {
	    if (!['limit', 'offset', 'status'].includes(optionKey)) {
	      throw new Error(`POS sync history option ${optionKey} is not supported`);
	    }
	  }

	  return {
    limit: assertBoundedPositiveInteger(
      'POS sync history limit',
      options?.limit,
      DEFAULT_SYNC_HISTORY_LIMIT,
      MAX_SYNC_HISTORY_LIMIT
    ),
    offset: assertNonNegativeInteger(
      'POS sync history offset',
      options?.offset,
      0
    ),
    status:
      options?.status === undefined
        ? undefined
        : normalizeSyncStatus('POS sync history status', options.status),
  };
}

/**
 * POS Service Interface
 * All POS providers must implement this interface
 */
export interface IPOSService {
  provider: POSProvider;

  /**
   * Create order in POS system
   */
  createOrder(order: Order, integration: POSIntegration): Promise<POSOrderCreationResult>;

  /**
   * Refresh OAuth access token
   */
  refreshAccessToken(integration: POSIntegration): Promise<{
    access_token: string;
    refresh_token?: string;
    expires_at?: Date;
  }>;
}

export function buildPOSOrderPayload(order: Order, integration: POSIntegration) {
  assertPlainObject('POS order payload', order);
  assertPlainObject('POS integration payload', integration);
  const orderId = assertNonEmptyString('POS order id', order.id);
  const businessId = assertNonEmptyString('POS order business_id', order.business_id);
  const integrationBusinessId = assertNonEmptyString(
    'POS integration business_id',
    integration.business_id
  );
  if (integrationBusinessId !== businessId) {
    throw new POSSyncError(
      'POS integration business_id must match POS order business_id',
      'permanent'
    );
  }
  if (!Array.isArray(order.items)) {
    throw new POSSyncError('POS order items must be an array before POS sync', 'permanent');
  }
  if (!order.items.length) {
    throw new POSSyncError('Order must include at least one item before POS sync', 'permanent');
  }
  const locationId = assertNonEmptyString('POS integration location_id', integration.location_id);
  const currency = normalizeCurrencyCode(order.currency);

  const lineItems = order.items.map((item: any, index) => {
    const orderItem = assertPlainObject(`POS order item ${index + 1}`, item);
    const dishId = assertNonEmptyString(`Dish id for POS order item ${index + 1}`, orderItem.dish_id);
    const mappedId = integration.item_mapping?.[dishId];
    if (integration.item_mapping && !mappedId) {
      throw new POSSyncError(`No POS item mapping for dish ${dishId}`, 'permanent');
    }
    const quantity = assertPositiveIntegerQuantity(`Quantity for dish ${dishId}`, orderItem.quantity);
    const amount = assertNonNegativeIntegerCents(
      `Unit price for dish ${dishId}`,
      orderItem.unit_price_cents ?? orderItem.price_cents
    );
    const name =
      normalizeOptionalPayloadString(`Dish name for dish ${dishId}`, orderItem.dish_name) ??
      normalizeOptionalPayloadString(`Item name for dish ${dishId}`, orderItem.name) ??
      dishId;
    const note = normalizeOptionalPayloadString(
      `Special instructions for dish ${dishId}`,
      orderItem.special_instructions
    );
    return {
      ...(mappedId === undefined ? {} : { catalog_object_id: mappedId }),
      name,
      quantity: String(quantity),
      base_price_money: {
        amount,
        currency,
      },
      ...(note === undefined ? {} : { note }),
    };
  });
  const customerId = integration.sync_customer_info
    ? normalizeOptionalPayloadString('POS order customer_id', order.customer_id)
    : undefined;

  return {
    idempotency_key: `menumaker-order-${orderId}`,
    order: {
      location_id: locationId,
      line_items: lineItems,
      ...(customerId === undefined ? {} : { customer_id: customerId }),
      reference_id: orderId,
      metadata: {
        source: 'MenuMaker',
        menumaker_order_id: orderId,
        business_id: businessId,
      },
    },
  };
}

/**
 * Square POS Service
 */
export class SquarePOSService implements IPOSService {
  provider: POSProvider = 'square';
  private readonly endpointBase: string;

  constructor(
    private readonly httpClient: POSHttpClient = defaultPOSHttpClient,
    endpointBase: string = process.env.SQUARE_API_BASE_URL || 'https://connect.squareup.com'
  ) {
    this.endpointBase = assertAbsoluteHttpsEndpointBase('Square endpoint base', endpointBase);
  }

  async createOrder(order: Order, integration: POSIntegration): Promise<POSOrderCreationResult> {
    try {
      const payload = buildPOSOrderPayload(order, integration);
      const accessToken = assertPOSProviderToken('POS integration access_token', integration.access_token);
      const response = await this.httpClient(`${this.endpointBase}/v2/orders`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Square-Version': integration.settings?.api_version || '2023-10-18',
          'Idempotency-Key': payload.idempotency_key,
        },
        body: JSON.stringify(payload),
      });
      const responseStatus = assertNonTerminalSquareResponseStatus('Square order response status', response.status);
      if (responseStatus === 429) {
        throw new POSSyncError('Square rate limit exceeded', 'rate_limited', 429, 5 * 60 * 1000);
      }
      if (responseStatus >= 500) {
        throw new POSSyncError('Square temporary failure', 'retryable', responseStatus);
      }

      const data = await readPOSJsonObject(response, 'Square order response body');
      if (responseStatus >= 400) {
        throw new POSSyncError(providerResponseMessage(data) || 'Square rejected order', 'permanent', responseStatus);
      }

      const rawPosOrderId = squareOrderIdFromResponse(data, responseStatus);
      if (typeof rawPosOrderId === 'string' && hasUnsafePOSTextControls(rawPosOrderId)) {
        throw new POSSyncError(
          'POS provider success response pos_order_id must not include unsafe control characters',
          'permanent',
          responseStatus
        );
      }
      const posOrderId = normalizeOptionalPOSProviderId(
        'POS provider success response pos_order_id',
        rawPosOrderId,
        responseStatus
      );
      if (!posOrderId) {
        throw new POSSyncError('POS provider success response must include pos_order_id', 'permanent', responseStatus);
      }
      return {
        success: true,
        pos_order_id: posOrderId,
        reference_id: normalizeOptionalPOSProviderId(
          'Square order response reference_id',
          squareOrderFieldFromResponse(data, 'reference_id', responseStatus),
          responseStatus
        ),
        location_id: normalizeOptionalPOSProviderId(
          'Square order response location_id',
          squareOrderFieldFromResponse(data, 'location_id', responseStatus),
          responseStatus
        ),
        metadata: squareOrderFieldFromResponse(data, 'metadata', responseStatus) as POSOrderCreationResult['metadata'],
      };
    } catch (error) {
      if (error instanceof POSSyncError) {
        throw error;
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async refreshAccessToken(integration: POSIntegration): Promise<{
    access_token: string;
    refresh_token?: string;
    expires_at?: Date;
  }> {
    if (!integration.refresh_token) {
      throw new POSSyncError('Square refresh token is missing', 'permanent');
    }
    const response = await this.httpClient(`${this.endpointBase}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.SQUARE_CLIENT_ID || 'test-square-client',
        client_secret: process.env.SQUARE_CLIENT_SECRET || 'test-square-secret',
        grant_type: 'refresh_token',
        refresh_token: integration.refresh_token,
      }),
    });
    const responseStatus = assertNonTerminalSquareResponseStatus('Square token refresh response status', response.status);
    if (responseStatus === 429) {
      throw new POSSyncError('Square token refresh rate limited', 'rate_limited', 429, 5 * 60 * 1000);
    }
    if (responseStatus >= 500) {
      throw new POSSyncError('Square token refresh temporarily failed', 'retryable', responseStatus);
    }
    const data = await readPOSJsonObject(response, 'Square token refresh response body');
    if (responseStatus >= 400 || !data?.access_token) {
      throw new POSSyncError(providerResponseMessage(data) || 'Square token refresh rejected', 'permanent', responseStatus);
    }
    const expiresAt = data.expires_at !== undefined
      ? assertFutureDate(
        'Square token refresh expires_at',
        new Date(assertNonEmptyString('Square token refresh expires_at', data.expires_at))
      )
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    return {
      access_token: assertPOSProviderToken(
        'Square token refresh access_token',
        data.access_token,
        responseStatus
      ),
      ...(data.refresh_token === undefined
        ? {}
        : {
            refresh_token: assertPOSProviderToken(
              'Square token refresh refresh_token',
              data.refresh_token,
              responseStatus
            ),
          }),
      expires_at: expiresAt,
    };
  }
}

/**
 * Dine POS Service
 */
export class DinePOSService implements IPOSService {
  provider: POSProvider = 'dine';

  async createOrder(_order: Order, _integration: POSIntegration): Promise<POSOrderCreationResult> {
    throw new FeatureUnavailableError('pos_sync', 'Dine POS is not approved for launch');
  }

  async refreshAccessToken(_integration: POSIntegration): Promise<{
    access_token: string;
    refresh_token?: string;
    expires_at?: Date;
  }> {
    throw new FeatureUnavailableError('pos_sync', 'Dine POS token refresh is unavailable');
  }
}

/**
 * Zoho POS Service
 */
export class ZohoPOSService implements IPOSService {
  provider: POSProvider = 'zoho';

  async createOrder(_order: Order, _integration: POSIntegration): Promise<POSOrderCreationResult> {
    throw new FeatureUnavailableError('pos_sync', 'Zoho POS is not approved for launch');
  }

  async refreshAccessToken(_integration: POSIntegration): Promise<{
    access_token: string;
    refresh_token?: string;
    expires_at?: Date;
  }> {
    throw new FeatureUnavailableError('pos_sync', 'Zoho POS token refresh is unavailable');
  }
}

/**
 * POS Sync Service
 * Orchestrates POS syncing with retry logic
 */
export class POSSyncService {
  private integrationRepository: Repository<POSIntegration>;
  private syncLogRepository: Repository<POSSyncLog>;
  private orderRepository: Repository<Order>;
  private services: Map<POSProvider, IPOSService>;
  private readonly enforceCapability: boolean;
  private static refreshLocks = new Map<string, Promise<void>>();

  constructor(
    services?: Map<POSProvider, IPOSService>,
    repositories?: POSRepositoryOverrides,
    options: POSSyncServiceOptions = {}
  ) {
    this.integrationRepository = repositories?.integrationRepository ?? AppDataSource.getRepository(POSIntegration);
    this.syncLogRepository = repositories?.syncLogRepository ?? AppDataSource.getRepository(POSSyncLog);
    this.orderRepository = repositories?.orderRepository ?? AppDataSource.getRepository(Order);
    this.enforceCapability = options.enforceCapability !== false;

    // Initialize POS services
    this.services = services || new Map();
    if (!services) {
      this.services.set('square', new SquarePOSService());
      this.services.set('dine', new DinePOSService());
      this.services.set('zoho', new ZohoPOSService());
    }
  }

  /**
   * Get POS integration for a business
   */
  async getIntegration(businessId: string): Promise<POSIntegration | null> {
    this.assertPosSyncEnabled();
    const normalizedBusinessId = assertNonEmptyString('POS business_id', businessId);
    const integration = await this.integrationRepository.findOne({
      where: { business_id: normalizedBusinessId, is_active: true },
    });
    if (integration) {
      POSSyncService.assertValidPersistedIntegration(
        integration,
        normalizedBusinessId,
        'POS integration',
        { requireActive: true, validateTokenExpiry: true }
      );
    }
    return integration;
  }

  /**
   * Create POS integration
   */
  async createIntegration(
    businessId: string,
    provider: POSProvider,
    accessToken: string,
    options?: {
      refresh_token?: string;
      token_expires_at?: Date;
      location_id?: string;
      merchant_id?: string;
    }
  ): Promise<POSIntegration> {
    this.assertPosSyncEnabled();
    const approvedProvider = assertLaunchPOSProvider(provider, `POS provider ${provider} is disabled`);

    const normalizedBusinessId = assertNonEmptyString('POS integration business_id', businessId);
    const normalizedAccessToken = assertPOSProviderToken('POS integration access_token', accessToken);
    const normalizedOptions = normalizePOSIntegrationOptions(options);
    const normalizedLocationId = assertNonEmptyString(
      'POS integration location_id',
      normalizedOptions.location_id
    );
    const normalizedRefreshToken = normalizedOptions.refresh_token === undefined
      ? undefined
      : assertPOSProviderToken('POS integration refresh_token', normalizedOptions.refresh_token);
    const normalizedMerchantId = normalizedOptions.merchant_id === undefined
      ? undefined
      : assertNonEmptyString('POS integration merchant_id', normalizedOptions.merchant_id);
    const normalizedTokenExpiresAt = normalizedOptions.token_expires_at === undefined
      ? undefined
      : assertFutureDate('POS integration token_expires_at', normalizedOptions.token_expires_at);

    // Deactivate existing integration if any
    const existing = await this.integrationRepository.findOne({
      where: { business_id: normalizedBusinessId },
    });

    if (existing) {
      POSSyncService.assertValidPersistedIntegration(
        existing,
        normalizedBusinessId,
        'Existing POS integration'
      );
      existing.is_active = false;
      await this.integrationRepository.save(existing);
    }

    // Create new integration
    const integration = this.integrationRepository.create({
      business_id: normalizedBusinessId,
      provider: approvedProvider,
      access_token: normalizedAccessToken,
      refresh_token: normalizedRefreshToken,
      token_expires_at: normalizedTokenExpiresAt,
      location_id: normalizedLocationId,
      merchant_id: normalizedMerchantId,
      is_active: true,
    });

    await this.integrationRepository.save(integration);

    return integration;
  }

  /**
   * Disconnect POS integration
   */
  async disconnectIntegration(businessId: string): Promise<void> {
    this.assertPosSyncEnabled();
    const normalizedBusinessId = assertNonEmptyString('POS business_id', businessId);
    const integration = await this.integrationRepository.findOne({
      where: { business_id: normalizedBusinessId, is_active: true },
    });

    if (integration) {
      POSSyncService.assertValidPersistedIntegration(
        integration,
        normalizedBusinessId,
        'POS integration',
        { requireActive: true }
      );
      integration.is_active = false;
      await this.integrationRepository.save(integration);
    }
  }

  /**
   * Sync order to POS
   */
  async syncOrder(orderId: string): Promise<POSSyncLog> {
    this.assertPosSyncEnabled();
    const normalizedOrderId = assertNonEmptyString('POS order_id', orderId);
    const order = await this.orderRepository.findOne({
      where: { id: normalizedOrderId },
      relations: ['items'],
    });

    if (!order) {
      throw new Error('Order not found');
    }

    const persistedOrderId = assertNonEmptyString('POS order id', order.id);
    if (persistedOrderId !== normalizedOrderId) {
      throw new Error('POS order id must match requested order');
    }
    const orderBusinessId = assertNonEmptyString('POS order business_id', order.business_id);

    const integration = await this.integrationRepository.findOne({
      where: { business_id: orderBusinessId, is_active: true },
    });

    if (!integration) {
      throw new Error('No active POS integration found');
    }
    POSSyncService.assertValidPersistedIntegration(
      integration,
      orderBusinessId,
      'POS integration',
      { requireActive: true }
    );

    const approvedProvider = assertLaunchPOSProvider(
      integration.provider,
      'Persisted POS provider is disabled'
    );

    const completedSync = await this.syncLogRepository.findOne({
      where: {
        pos_integration_id: integration.id,
        order_id: normalizedOrderId,
        status: 'success',
      },
    });

    if (completedSync) {
      POSSyncService.assertValidPersistedSyncLog(
        completedSync,
        integration.id,
        'POS completed sync log'
      );
      if (completedSync.order_id !== normalizedOrderId) {
        throw new Error('POS completed sync log order_id must match requested order');
      }
      if (completedSync.status !== 'success') {
        throw new Error('POS completed sync log status must match successful replay query');
      }
      assertNonEmptyString('POS completed sync log pos_order_id', completedSync.pos_order_id);
      POSSyncService.assertSuccessfulSyncResponseAudit(
        completedSync,
        'POS completed sync log',
        {
          orderId: normalizedOrderId,
          businessId: orderBusinessId,
          locationId: integration.location_id,
        }
      );
      POSSyncService.assertSuccessfulSyncRequestAudit(completedSync, order, integration, 'POS completed sync log');
      return completedSync;
    }

    // Create sync log
    const syncLog = this.syncLogRepository.create({
      pos_integration_id: integration.id,
      order_id: normalizedOrderId,
      provider: approvedProvider,
      status: 'pending',
    });

    await this.syncLogRepository.save(syncLog);

    // Attempt sync
    await this.attemptSync(syncLog, order, integration);

    return syncLog;
  }

  /**
   * Attempt to sync an order
   */
  private async attemptSync(
    syncLog: POSSyncLog,
    order: Order,
    integration: POSIntegration
  ): Promise<void> {
    const startTime = Date.now();
    POSSyncService.assertValidAttemptContext(syncLog, order, integration);
    const retryCount = assertNonNegativeSafeIntegerCount(
      `POS sync retry_count for log ${syncLog.id}`,
      syncLog.retry_count ?? 0
    );
    const maxRetries = assertNonNegativeSafeIntegerCount(
      `POS sync max_retries for log ${syncLog.id}`,
      syncLog.max_retries ?? 12
    );
    if (retryCount > maxRetries) {
      throw new POSSyncError(
        `POS sync retry_count for log ${syncLog.id} cannot exceed max_retries`,
        'permanent'
      );
    }
    const integrationErrorCount = assertNonNegativeSafeIntegerCount(
      `POS integration error_count for integration ${integration.id}`,
      integration.error_count ?? 0
    );
    const nextRetryCount = checkedIncrementCount(
      `POS sync retry_count for log ${syncLog.id}`,
      retryCount
    );
    const nextIntegrationErrorCount = checkedIncrementCount(
      `POS integration error_count for integration ${integration.id}`,
      integrationErrorCount
    );

    try {
      const approvedProvider = assertLaunchPOSProvider(
        integration.provider,
        'Persisted POS provider is disabled'
      );
      syncLog.status = 'syncing';
      await this.syncLogRepository.save(syncLog);

      const service = this.services.get(approvedProvider);

      if (!service) {
        throw new POSSyncError(`Unsupported POS provider: ${approvedProvider}`, 'feature_unavailable');
      }

      await this.refreshIfExpired(integration, service);

      const requestPayload = buildPOSOrderPayload(order, integration);

      // Attempt to create order in POS
      const result = POSSyncService.normalizeOrderCreationResult(
        await service.createOrder(order, integration)
      );

      if (result.success) {
        POSSyncService.assertProviderSuccessEvidence(result, order, integration);
        // Success
        syncLog.status = 'success';
        syncLog.pos_order_id = result.pos_order_id;
        syncLog.request_payload = requestPayload;
        syncLog.response_data = POSSyncService.buildSuccessfulSyncResponseAudit(result);
        syncLog.completed_at = new Date();
        syncLog.error_message = null;
        syncLog.http_status = null;
        syncLog.next_retry_at = null;
        syncLog.duration_ms = Date.now() - startTime;

        // Update integration
        integration.last_sync_at = new Date();
        integration.error_count = 0;
        integration.last_error = null;

        await this.integrationRepository.save(integration);
      } else {
        // Failed
        throw new Error(result.error || 'POS sync failed');
      }
    } catch (error) {
      // Handle failure
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const typed = error instanceof POSSyncError
        ? error
        : error instanceof FeatureUnavailableError
          ? new POSSyncError(error.message, 'feature_unavailable', 503)
          : undefined;
      const retryable = typed ? ['retryable', 'rate_limited'].includes(typed.kind) : true;

      syncLog.status = retryable && retryCount < maxRetries ? 'retry' : 'failed';
      syncLog.error_message = errorMessage;
      syncLog.http_status = typed?.httpStatus;
      syncLog.retry_count = nextRetryCount;
      syncLog.duration_ms = Date.now() - startTime;
      syncLog.pos_order_id = null;
      syncLog.response_data = null;

      if (syncLog.status === 'retry') {
        syncLog.next_retry_at = new Date(Date.now() + (typed?.retryAfterMs || 5 * 60 * 1000));
        syncLog.completed_at = null;
      } else {
        syncLog.next_retry_at = null;
        syncLog.completed_at = new Date();
      }

      // Update integration error count
      integration.error_count = nextIntegrationErrorCount;
      integration.last_error = errorMessage;

      await this.integrationRepository.save(integration);
    }

    await this.syncLogRepository.save(syncLog);
  }

  private async refreshIfExpired(integration: POSIntegration, service: IPOSService): Promise<void> {
    const expiresAt = integration.token_expires_at === undefined || integration.token_expires_at === null
      ? undefined
      : assertValidDate('POS integration token_expires_at', integration.token_expires_at).getTime();
    if (expiresAt === undefined || expiresAt > Date.now() + 60_000) {
      return;
    }

    const existing = POSSyncService.refreshLocks.get(integration.id);
    if (existing) {
      await existing;
      const refreshedIntegration = await this.integrationRepository.findOne({
        where: { id: integration.id },
      });
      if (refreshedIntegration) {
        POSSyncService.assertValidPersistedRefreshIntegration(
          refreshedIntegration,
          integration.business_id,
          'POS refreshed integration'
        );
        integration.access_token = refreshedIntegration.access_token;
        integration.refresh_token = refreshedIntegration.refresh_token;
        integration.token_expires_at = refreshedIntegration.token_expires_at;
      }
      return;
    }

    const refresh = (async () => {
      const latest = await this.integrationRepository.findOne({
        where: { id: integration.id },
      });
      if (latest) {
        POSSyncService.assertValidPersistedRefreshIntegration(
          latest,
          integration.business_id,
          'POS persisted refresh integration'
        );
      }
      const latestExpiresAt = latest?.token_expires_at === undefined || latest.token_expires_at === null
        ? undefined
        : assertValidDate('POS persisted token_expires_at', latest.token_expires_at).getTime();
      if (latestExpiresAt !== undefined && latestExpiresAt > Date.now() + 60_000) {
        integration.access_token = latest.access_token;
        integration.refresh_token = latest.refresh_token;
        integration.token_expires_at = latest.token_expires_at;
        return;
      }

      const refreshTarget = latest ?? integration;
      const refreshed = await service.refreshAccessToken(refreshTarget);
      POSSyncService.assertValidTokenRefreshResult(refreshed);
      integration.access_token = refreshed.access_token;
      integration.refresh_token = refreshed.refresh_token || integration.refresh_token;
      integration.token_expires_at = refreshed.expires_at || integration.token_expires_at;
      await this.integrationRepository.save(integration);
    })().finally(() => POSSyncService.refreshLocks.delete(integration.id));

    POSSyncService.refreshLocks.set(integration.id, refresh);
    await refresh;
  }

  private static normalizeOrderCreationResult(result: unknown): POSOrderCreationResult {
    const payload = assertPlainObject('POS provider order creation response', result);

    if (typeof payload.success !== 'boolean') {
      throw new POSSyncError(
        'POS provider order creation response success must be a boolean',
        'permanent'
      );
    }
    const payloadKeys = Object.keys(payload);
    assertPOSProviderFieldNamesAreSafe('POS provider order creation response', payloadKeys);
    const unsupportedKeys = payloadKeys.filter(
      (key) => !POS_ORDER_CREATION_RESULT_KEYS.has(key)
    );
    if (unsupportedKeys.length > 0) {
      throw new POSSyncError(
        `POS provider order creation response include unsupported field(s): ${unsupportedKeys.sort().join(', ')}`,
        'permanent'
      );
    }

    if (payload.success) {
      const error = normalizeOptionalPayloadString(
        'POS provider success response error',
        payload.error
      );
      if (error) {
        throw new POSSyncError(
          'POS provider success response error cannot be present',
          'permanent'
        );
      }

      const normalizedPosOrderId = normalizeOptionalPOSProviderId(
        'POS provider success response pos_order_id',
        payload.pos_order_id
      );
      if (!normalizedPosOrderId) {
        throw new POSSyncError(
          'POS provider success response must include pos_order_id',
          'permanent'
        );
      }

      return {
        success: true,
        pos_order_id: normalizedPosOrderId,
        ...POSSyncService.normalizedProviderSuccessEcho(payload),
      };
    }

    const staleSuccessFields = POS_ORDER_CREATION_SUCCESS_EVIDENCE_KEYS
      .filter((field) => payload[field] !== undefined && payload[field] !== null);
    if (staleSuccessFields.length > 0) {
      throw new POSSyncError(
        `POS provider failure response cannot include success field(s): ${staleSuccessFields.join(', ')}`,
        'permanent'
      );
    }

    return {
      success: false,
      error: assertPOSProviderErrorMessage('POS provider failure response error', payload.error),
    };
  }

  private static normalizedProviderSuccessEcho(
    payload: Record<string, unknown>
  ): Pick<POSOrderCreationResult, 'reference_id' | 'location_id' | 'metadata'> {
    const referenceId = normalizeOptionalPOSProviderId(
      'POS provider success response reference_id',
      payload.reference_id
    );
    const locationId = normalizeOptionalPOSProviderId(
      'POS provider success response location_id',
      payload.location_id
    );

    let metadata: POSOrderCreationResult['metadata'];
    if (payload.metadata !== undefined && payload.metadata !== null) {
      const responseMetadata = assertPlainObject(
        'POS provider success response metadata',
        payload.metadata
      );
      const metadataKeys = Object.keys(responseMetadata);
      assertPOSProviderFieldNamesAreSafe('POS provider success response metadata', metadataKeys);
      const unsupportedMetadataKeys = metadataKeys.filter(
        (key) => !POS_PROVIDER_SUCCESS_METADATA_KEYS.has(key)
      );
      if (unsupportedMetadataKeys.length > 0) {
        throw new POSSyncError(
          `POS provider success response metadata include unsupported field(s): ${unsupportedMetadataKeys.sort().join(', ')}`,
          'permanent'
        );
      }
      const metadataOrderId = normalizeOptionalPOSProviderId(
        'POS provider success response metadata.menumaker_order_id',
        responseMetadata.menumaker_order_id
      );
      const metadataBusinessId = normalizeOptionalPOSProviderId(
        'POS provider success response metadata.business_id',
        responseMetadata.business_id
      );

      metadata = {
        ...(metadataOrderId === undefined ? {} : { menumaker_order_id: metadataOrderId }),
        ...(metadataBusinessId === undefined ? {} : { business_id: metadataBusinessId }),
      };
      if (!Object.keys(metadata).length) {
        metadata = undefined;
      }
    }

    return {
      ...(referenceId === undefined ? {} : { reference_id: referenceId }),
      ...(locationId === undefined ? {} : { location_id: locationId }),
      ...(metadata === undefined ? {} : { metadata }),
    };
  }

  private static assertProviderSuccessEvidence(
    result: POSOrderCreationResult,
    order: Order,
    integration: POSIntegration
  ): void {
    const orderId = assertNonEmptyString('POS provider success requested order id', order.id);
    const orderBusinessId = assertNonEmptyString(
      'POS provider success requested order business_id',
      order.business_id
    );
    const integrationLocationId = assertNonEmptyString(
      'POS provider success integration location_id',
      integration.location_id
    );

    if (result.reference_id !== undefined && result.reference_id !== orderId) {
      throw new POSSyncError(
        'POS provider success response reference_id must match requested order',
        'permanent'
      );
    }
    if (result.location_id !== undefined && result.location_id !== integrationLocationId) {
      throw new POSSyncError(
        'POS provider success response location_id must match active integration location',
        'permanent'
      );
    }
    if (result.metadata?.menumaker_order_id !== undefined && result.metadata.menumaker_order_id !== orderId) {
      throw new POSSyncError(
        'POS provider success response metadata.menumaker_order_id must match requested order',
        'permanent'
      );
    }
    if (result.metadata?.business_id !== undefined && result.metadata.business_id !== orderBusinessId) {
      throw new POSSyncError(
        'POS provider success response metadata.business_id must match requested order business',
        'permanent'
      );
    }
  }

  private static buildSuccessfulSyncResponseAudit(
    result: POSOrderCreationResult
  ): Record<string, unknown> {
    const posOrderId = assertPOSProviderId(
      'POS provider success response pos_order_id',
      result.pos_order_id
    );

    return {
      pos_order_id: posOrderId,
      ...(result.reference_id === undefined ? {} : { reference_id: result.reference_id }),
      ...(result.location_id === undefined ? {} : { location_id: result.location_id }),
      ...(result.metadata === undefined ? {} : { metadata: result.metadata }),
    };
  }

  private static assertValidTokenRefreshResult(result: unknown): asserts result is {
    access_token: string;
    refresh_token?: string;
    expires_at?: Date;
  } {
    const payload = assertPlainObject('POS token refresh response', result);
    const payloadKeys = Object.keys(payload);
    assertPOSProviderFieldNamesAreSafe('POS token refresh response', payloadKeys);
    const unsupportedKeys = payloadKeys.filter(
      (key) => !POS_TOKEN_REFRESH_RESULT_KEYS.has(key)
    );
    if (unsupportedKeys.length > 0) {
      throw new POSSyncError(
        `POS token refresh response include unsupported field(s): ${unsupportedKeys.sort().join(', ')}`,
        'permanent'
      );
    }

    assertPOSProviderToken('POS token refresh access_token', payload.access_token);
    if (payload.refresh_token !== undefined) {
      assertPOSProviderToken('POS token refresh refresh_token', payload.refresh_token);
    }
    if (payload.expires_at !== undefined) {
      assertFutureDate('POS token refresh expires_at', payload.expires_at as Date);
    }
  }

  private static assertValidPersistedIntegration(
    integration: POSIntegration,
    businessId: string,
    label: string,
    options: {
      requireActive?: boolean;
      requireLaunchCredentials?: boolean;
      validateTokenExpiry?: boolean;
    } = {}
  ): void {
    if (!integration || typeof integration !== 'object' || Array.isArray(integration)) {
      throw new Error(`${label} must be an object`);
    }
    const integrationRecord = integration as unknown as Record<string, unknown>;
    assertPOSProviderFieldNamesAreSafe(label, Object.keys(integrationRecord));
    const unsupportedKeys = Object.keys(integrationRecord).filter(
      (key) => !POS_INTEGRATION_ROW_KEYS.has(key) && integrationRecord[key] !== undefined
    );
    if (unsupportedKeys.length > 0) {
      throw new Error(`${label} include unsupported field(s): ${unsupportedKeys.sort().join(', ')}`);
    }
    assertNonEmptyString(`${label} id`, integration.id);
    const persistedBusinessId = assertNonEmptyString(`${label} business_id`, integration.business_id);
    if (persistedBusinessId !== businessId) {
      throw new Error(`${label} business_id must match requested business`);
    }
    assertLaunchPOSProvider(integration.provider, 'Persisted POS provider is disabled');
    if (options.requireActive && integration.is_active !== true) {
      throw new Error(`${label} must be active`);
    }
    assertOptionalBoolean(`${label} auto_sync_orders`, integration.auto_sync_orders);
    assertOptionalBoolean(`${label} sync_customer_info`, integration.sync_customer_info);
    assertOptionalPOSItemMapping(`${label} item_mapping`, integration.item_mapping);
    assertOptionalValidDate(`${label} last_sync_at`, integration.last_sync_at);
    assertOptionalPOSIntegrationSettings(`${label} settings`, integration.settings);
    const errorCount = assertNonNegativeSafeIntegerCount(
      `${label} error_count`,
      integration.error_count ?? 0
    );
    const lastError = integration.last_error === undefined || integration.last_error === null
      ? undefined
      : assertPOSProviderErrorMessage(`${label} last_error`, integration.last_error);
    if (errorCount > 0 && !lastError) {
      throw new Error(`${label} last_error is required when error_count is positive`);
    }
    if (errorCount === 0 && lastError) {
      throw new Error(`${label} last_error cannot be present when error_count is zero`);
    }
    assertOptionalValidDate(`${label} created_at`, integration.created_at);
    assertOptionalValidDate(`${label} updated_at`, integration.updated_at);
    if (
      integration.created_at instanceof Date &&
      integration.updated_at instanceof Date &&
      integration.updated_at < integration.created_at
    ) {
      throw new Error(`${label} updated_at cannot be before created_at`);
    }
    if (
      integration.created_at instanceof Date &&
      integration.last_sync_at instanceof Date &&
      integration.last_sync_at < integration.created_at
    ) {
      throw new Error(`${label} last_sync_at cannot be before created_at`);
    }
    if (
      integration.last_sync_at instanceof Date &&
      integration.updated_at instanceof Date &&
      integration.updated_at < integration.last_sync_at
    ) {
      throw new Error(`${label} updated_at cannot be before last_sync_at`);
    }
    if (
      (options.requireLaunchCredentials || options.validateTokenExpiry) &&
      integration.token_expires_at !== undefined &&
      integration.token_expires_at !== null
    ) {
      assertValidDate(`${label} token_expires_at`, integration.token_expires_at);
    }
    if (
      integration.created_at instanceof Date &&
      integration.token_expires_at instanceof Date &&
      integration.token_expires_at < integration.created_at
    ) {
      throw new Error(`${label} token_expires_at cannot be before created_at`);
    }
    if (options.requireLaunchCredentials) {
      if (integration.refresh_token !== undefined && integration.refresh_token !== null) {
        assertPOSProviderToken(`${label} refresh_token`, integration.refresh_token);
      }
      if (integration.merchant_id !== undefined && integration.merchant_id !== null) {
        assertNonEmptyString(`${label} merchant_id`, integration.merchant_id);
      }
      assertPOSProviderToken(`${label} access_token`, integration.access_token);
      assertNonEmptyString(`${label} location_id`, integration.location_id);
    }
  }

  private static assertValidPersistedRefreshIntegration(
    integration: POSIntegration,
    businessId: string,
    label: string
  ): void {
    try {
      POSSyncService.assertValidPersistedIntegration(
        integration,
        businessId,
        label,
        { requireActive: true, requireLaunchCredentials: true }
      );
    } catch (error) {
      throw new POSSyncError(
        error instanceof Error ? error.message : `${label} is invalid`,
        'permanent'
      );
    }
  }

  private static assertValidPersistedSyncLog(
    log: POSSyncLog,
    integrationId: string,
    label: string
  ): void {
    if (!log || typeof log !== 'object' || Array.isArray(log)) {
      throw new Error(`${label} must be an object`);
    }
    const logRecord = log as unknown as Record<string, unknown>;
    assertPOSProviderFieldNamesAreSafe(label, Object.keys(logRecord));
    const unsupportedKeys = Object.keys(logRecord).filter(
      (key) => !POS_SYNC_LOG_ROW_KEYS.has(key) && logRecord[key] !== undefined
    );
    if (unsupportedKeys.length > 0) {
      throw new Error(`${label} include unsupported field(s): ${unsupportedKeys.sort().join(', ')}`);
    }
    assertNonEmptyString(`${label} id`, log.id);
    const persistedIntegrationId = assertNonEmptyString(
      `${label} pos_integration_id`,
      log.pos_integration_id
    );
    if (persistedIntegrationId !== integrationId) {
      throw new Error(`${label} pos_integration_id must match requested integration`);
    }

    const status = normalizeSyncStatus(`${label} status`, log.status);
    assertLaunchPOSProvider(log.provider, 'Persisted POS sync log provider is disabled');
    assertNonEmptyString(`${label} order_id`, log.order_id);

    const retryCount = assertNonNegativeSafeIntegerCount(
      `${label} retry_count`,
      log.retry_count ?? 0
    );
    const maxRetries = assertNonNegativeSafeIntegerCount(
      `${label} max_retries`,
      log.max_retries ?? 12
    );
    if (retryCount > maxRetries) {
      throw new Error(`${label} retry_count cannot exceed max_retries`);
    }

    if (log.pos_order_id !== undefined && log.pos_order_id !== null) {
      assertPOSProviderId(`${label} pos_order_id`, log.pos_order_id);
    }
    assertOptionalPOSProviderErrorMessage(`${label} error_message`, log.error_message);
    const httpStatus = assertOptionalHttpStatus(`${label} http_status`, log.http_status);
    assertOptionalNonNegativeSafeInteger(`${label} duration_ms`, log.duration_ms);
    assertOptionalValidDate(`${label} next_retry_at`, log.next_retry_at);
    assertOptionalValidDate(`${label} completed_at`, log.completed_at);
    assertOptionalValidDate(`${label} created_at`, log.created_at);
    assertOptionalValidDate(`${label} updated_at`, log.updated_at);
    if (log.created_at instanceof Date) {
      if (log.completed_at instanceof Date && log.completed_at < log.created_at) {
        throw new Error(`${label} completed_at cannot be before created_at`);
      }
      if (log.next_retry_at instanceof Date && log.next_retry_at < log.created_at) {
        throw new Error(`${label} next_retry_at cannot be before created_at`);
      }
      if (log.updated_at instanceof Date && log.updated_at < log.created_at) {
        throw new Error(`${label} updated_at cannot be before created_at`);
      }
    }
    if (
      log.completed_at instanceof Date &&
      log.updated_at instanceof Date &&
      log.updated_at < log.completed_at
    ) {
      throw new Error(`${label} updated_at cannot be before completed_at`);
    }
    if (status === 'success') {
      assertPOSProviderId(`${label} pos_order_id`, log.pos_order_id);
      assertValidDate(`${label} completed_at`, log.completed_at as Date);
      if (log.error_message !== undefined && log.error_message !== null) {
        throw new Error(`${label} error_message cannot be present after successful sync`);
      }
      if (log.http_status !== undefined && log.http_status !== null) {
        throw new Error(`${label} http_status cannot be present after successful sync`);
      }
      if (log.next_retry_at !== undefined && log.next_retry_at !== null) {
        throw new Error(`${label} next_retry_at cannot be present after successful sync`);
      }
    } else if (status === 'failed') {
      if (retryCount === 0) {
        throw new Error(`${label} retry_count must be greater than zero after failed sync`);
      }
      assertPOSProviderErrorMessage(`${label} error_message`, log.error_message);
      assertValidDate(`${label} completed_at`, log.completed_at as Date);
      if (log.pos_order_id !== undefined && log.pos_order_id !== null) {
        throw new Error(`${label} pos_order_id cannot be present after failed sync`);
      }
      if (log.next_retry_at !== undefined && log.next_retry_at !== null) {
        throw new Error(`${label} next_retry_at cannot be present after failed sync`);
      }
      if (log.response_data !== undefined && log.response_data !== null) {
        throw new Error(`${label} response_data cannot be present after failed sync`);
      }
    } else if (status === 'retry') {
      if (retryCount === 0) {
        throw new Error(`${label} retry_count must be greater than zero while retrying sync`);
      }
      assertPOSProviderErrorMessage(`${label} error_message`, log.error_message);
      assertValidDate(`${label} next_retry_at`, log.next_retry_at as Date);
      if (httpStatus !== undefined && !isRetryablePOSHttpStatus(httpStatus)) {
        throw new Error(`${label} http_status must be retryable while retrying sync`);
      }
      if (log.pos_order_id !== undefined && log.pos_order_id !== null) {
        throw new Error(`${label} pos_order_id cannot be present while retrying sync`);
      }
      if (log.completed_at !== undefined && log.completed_at !== null) {
        throw new Error(`${label} completed_at cannot be present while retrying sync`);
      }
      if (log.response_data !== undefined && log.response_data !== null) {
        throw new Error(`${label} response_data cannot be present while retrying sync`);
      }
    } else {
      if (log.pos_order_id !== undefined && log.pos_order_id !== null) {
        throw new Error(`${label} pos_order_id cannot be present before terminal sync`);
      }
      if (log.error_message !== undefined && log.error_message !== null) {
        throw new Error(`${label} error_message cannot be present before sync attempt evidence`);
      }
      if (log.http_status !== undefined && log.http_status !== null) {
        throw new Error(`${label} http_status cannot be present before sync attempt evidence`);
      }
      if (log.next_retry_at !== undefined && log.next_retry_at !== null) {
        throw new Error(`${label} next_retry_at cannot be present before sync attempt evidence`);
      }
      if (log.completed_at !== undefined && log.completed_at !== null) {
        throw new Error(`${label} completed_at cannot be present before terminal sync`);
      }
      if (log.response_data !== undefined && log.response_data !== null) {
        throw new Error(`${label} response_data cannot be present before terminal sync`);
      }
      if (log.duration_ms !== undefined && log.duration_ms !== null) {
        throw new Error(`${label} duration_ms cannot be present before sync attempt completion`);
      }
      if (status === 'pending' && retryCount > 0) {
        throw new Error(`${label} retry_count cannot be greater than zero before sync attempt evidence`);
      }
    }
  }

  private static assertUniqueSuccessfulSyncOrders(
    logs: POSSyncLog[],
    labelPrefix: string
  ): void {
    const seenSuccessfulOrderIds = new Set<string>();
    const seenSuccessfulPosOrderIds = new Set<string>();
    logs.forEach((log, index) => {
      if (normalizeSyncStatus(`${labelPrefix} row ${index + 1} status`, log.status) !== 'success') {
        return;
      }

      const orderId = assertNonEmptyString(`${labelPrefix} row ${index + 1} order_id`, log.order_id);
      if (seenSuccessfulOrderIds.has(orderId)) {
        throw new Error(`${labelPrefix} row ${index + 1} order_id must be unique for successful syncs`);
      }
      seenSuccessfulOrderIds.add(orderId);

      const posOrderId = assertNonEmptyString(`${labelPrefix} row ${index + 1} pos_order_id`, log.pos_order_id);
      if (seenSuccessfulPosOrderIds.has(posOrderId)) {
        throw new Error(`${labelPrefix} row ${index + 1} pos_order_id must be unique for successful syncs`);
      }
      seenSuccessfulPosOrderIds.add(posOrderId);
    });
  }

  private static assertUniqueSyncLogIds(
    logs: POSSyncLog[],
    labelPrefix: string
  ): void {
    const seenSyncLogIds = new Set<string>();
    logs.forEach((log, index) => {
      if (!log || typeof log !== 'object' || Array.isArray(log)) {
        throw new Error(`${labelPrefix} row ${index + 1} must be an object`);
      }
      const logId = assertNonEmptyString(`${labelPrefix} row ${index + 1} id`, log.id);
      if (seenSyncLogIds.has(logId)) {
        throw new Error(`${labelPrefix} row ${index + 1} id must be unique`);
      }
      seenSyncLogIds.add(logId);
    });
  }

  private static assertValidPendingRetryRelations(
    log: POSSyncLog,
    order: Order,
    integration: POSIntegration,
    retryCutoff?: Date
  ): void {
    const logId = assertNonEmptyString('POS pending retry log id', log.id);
    const label = `POS pending retry log ${logId}`;
    const orderId = assertNonEmptyString(`${label} order relation id`, order.id);
    const orderBusinessId = assertNonEmptyString(`${label} order relation business_id`, order.business_id);
    const logOrderId = assertNonEmptyString(`${label} order_id`, log.order_id);

    if (orderId !== logOrderId) {
      throw new Error(`${label} order relation id must match sync log order_id`);
    }

    POSSyncService.assertValidPersistedIntegration(
      integration,
      orderBusinessId,
      `${label} integration`,
      { requireActive: true }
    );
    POSSyncService.assertValidPersistedSyncLog(log, integration.id, label);

    if (log.provider !== integration.provider) {
      throw new Error(`${label} provider must match integration provider`);
    }
    if (
      retryCutoff &&
      log.next_retry_at instanceof Date &&
      log.next_retry_at > retryCutoff
    ) {
      throw new Error(`${label} next_retry_at cannot be after retry cutoff`);
    }
  }

  private static assertPendingRetryRelationLoaded(
    log: POSSyncLog
  ): { order: Order; integration: POSIntegration } {
    const logId = assertNonEmptyString('POS pending retry log id', log.id);
    if (!log.order) {
      throw new Error(`POS pending retry log ${logId} is missing order relation`);
    }
    if (!log.pos_integration) {
      throw new Error(`POS pending retry log ${logId} is missing integration relation`);
    }

    return {
      order: log.order,
      integration: log.pos_integration,
    };
  }

  private static assertValidAttemptContext(
    log: POSSyncLog,
    order: Order,
    integration: POSIntegration
  ): void {
    const logId = assertNonEmptyString('POS sync attempt log id', log.id);
    const label = `POS sync attempt log ${logId}`;
    const logOrderId = assertNonEmptyString(`${label} order_id`, log.order_id);
    const orderId = assertNonEmptyString(`${label} order relation id`, order.id);
    if (logOrderId !== orderId) {
      throw new Error(`${label} order_id must match order relation id`);
    }

    const integrationId = assertNonEmptyString(`${label} integration id`, integration.id);
    const logIntegrationId = assertNonEmptyString(`${label} pos_integration_id`, log.pos_integration_id);
    if (logIntegrationId !== integrationId) {
      throw new Error(`${label} pos_integration_id must match integration relation id`);
    }

    const orderBusinessId = assertNonEmptyString(`${label} order business_id`, order.business_id);
    const integrationBusinessId = assertNonEmptyString(`${label} integration business_id`, integration.business_id);
    if (orderBusinessId !== integrationBusinessId) {
      throw new Error(`${label} integration business_id must match order business_id`);
    }

    const logProvider = assertLaunchPOSProvider(log.provider, 'POS sync attempt log provider is disabled');
    const integrationProvider = assertLaunchPOSProvider(
      integration.provider,
      'POS sync attempt integration provider is disabled'
    );
    if (logProvider !== integrationProvider) {
      throw new Error(`${label} provider must match integration provider`);
    }
  }

  private static assertSuccessfulSyncResponseAudit(
    log: POSSyncLog,
    label: string,
    context: {
      orderId?: unknown;
      businessId?: unknown;
      locationId?: unknown;
    } = {}
  ): void {
    const posOrderId = assertPOSProviderId(`${label} pos_order_id`, log.pos_order_id);
    const responseData = assertPlainObject(`${label} response_data`, log.response_data);
    assertPOSProviderFieldNamesAreSafe(`${label} response_data`, Object.keys(responseData));
    const unsupportedResponseKeys = Object.keys(responseData).filter(
      (key) => !POS_ORDER_CREATION_SUCCESS_EVIDENCE_KEYS.includes(key as typeof POS_ORDER_CREATION_SUCCESS_EVIDENCE_KEYS[number])
    );
    if (unsupportedResponseKeys.length > 0) {
      throw new Error(`${label} response_data include unsupported field(s): ${unsupportedResponseKeys.sort().join(', ')}`);
    }
    const responsePosOrderId = assertPOSProviderId(
      `${label} response_data.pos_order_id`,
      responseData.pos_order_id
    );
    if (responsePosOrderId !== posOrderId) {
      throw new Error(`${label} response_data.pos_order_id must match pos_order_id`);
    }

    const expectedOrderId = context.orderId === undefined
      ? assertNonEmptyString(`${label} order_id`, log.order_id)
      : assertNonEmptyString(`${label} expected order_id`, context.orderId);
    const expectedBusinessId = context.businessId === undefined
      ? undefined
      : assertNonEmptyString(`${label} expected business_id`, context.businessId);
    const expectedLocationId = context.locationId === undefined
      ? undefined
      : assertNonEmptyString(`${label} expected location_id`, context.locationId);

    const responseReferenceId = normalizeOptionalPOSProviderId(
      `${label} response_data.reference_id`,
      responseData.reference_id
    );
    if (responseReferenceId !== undefined && responseReferenceId !== expectedOrderId) {
      throw new Error(`${label} response_data.reference_id must match requested order`);
    }

    const responseLocationId = normalizeOptionalPOSProviderId(
      `${label} response_data.location_id`,
      responseData.location_id
    );
    if (
      responseLocationId !== undefined &&
      expectedLocationId !== undefined &&
      responseLocationId !== expectedLocationId
    ) {
      throw new Error(`${label} response_data.location_id must match active integration location`);
    }

    if (responseData.metadata !== undefined && responseData.metadata !== null) {
      const responseMetadata = assertPlainObject(
        `${label} response_data.metadata`,
        responseData.metadata
      );
      assertPOSProviderFieldNamesAreSafe(`${label} response_data.metadata`, Object.keys(responseMetadata));
      const unsupportedMetadataKeys = Object.keys(responseMetadata).filter(
        (key) => !POS_PROVIDER_SUCCESS_METADATA_KEYS.has(key)
      );
      if (unsupportedMetadataKeys.length > 0) {
        throw new Error(
          `${label} response_data.metadata include unsupported field(s): ${unsupportedMetadataKeys.sort().join(', ')}`
        );
      }
      const metadataOrderId = normalizeOptionalPOSProviderId(
        `${label} response_data.metadata.menumaker_order_id`,
        responseMetadata.menumaker_order_id
      );
      if (metadataOrderId !== undefined && metadataOrderId !== expectedOrderId) {
        throw new Error(`${label} response_data.metadata.menumaker_order_id must match requested order`);
      }

      const metadataBusinessId = normalizeOptionalPOSProviderId(
        `${label} response_data.metadata.business_id`,
        responseMetadata.business_id
      );
      if (
        metadataBusinessId !== undefined &&
        expectedBusinessId !== undefined &&
        metadataBusinessId !== expectedBusinessId
      ) {
        throw new Error(`${label} response_data.metadata.business_id must match requested order business`);
      }
    }
  }

  private static assertSuccessfulSyncRequestAudit(
    log: POSSyncLog,
    order: Order,
    integration: POSIntegration,
    label: string
  ): void {
    const orderId = assertNonEmptyString(`${label} order_id`, log.order_id);
    const requestedOrderId = assertNonEmptyString(`${label} requested order id`, order.id);
    if (orderId !== requestedOrderId) {
      throw new Error(`${label} order_id must match requested order`);
    }

    const orderBusinessId = assertNonEmptyString(`${label} requested order business_id`, order.business_id);
    POSSyncService.assertSuccessfulSyncRequestPayloadAudit(
      log,
      requestedOrderId,
      orderBusinessId,
      integration,
      label
    );
  }

  private static assertSuccessfulSyncRequestPayloadAudit(
    log: POSSyncLog,
    requestedOrderId: string,
    orderBusinessId: string,
    integration: POSIntegration,
    label: string
  ): void {
    const integrationLocationId = assertNonEmptyString(
      `${label} integration location_id`,
      integration.location_id
    );
    const requestPayload = assertPlainObject(`${label} request_payload`, log.request_payload);
    assertPOSProviderFieldNamesAreSafe(`${label} request_payload`, Object.keys(requestPayload));
    const unsupportedPayloadKeys = Object.keys(requestPayload).filter(
      (key) => !POS_SYNC_REQUEST_PAYLOAD_KEYS.has(key)
    );
    if (unsupportedPayloadKeys.length > 0) {
      throw new Error(`${label} request_payload include unsupported field(s): ${unsupportedPayloadKeys.sort().join(', ')}`);
    }
    const requestIdempotencyKey = assertNonEmptyString(
      `${label} request_payload.idempotency_key`,
      requestPayload.idempotency_key
    );
    if (requestIdempotencyKey !== `menumaker-order-${requestedOrderId}`) {
      throw new Error(`${label} request_payload.idempotency_key must match requested order`);
    }

    const requestOrder = assertPlainObject(`${label} request_payload.order`, requestPayload.order);
    assertPOSProviderFieldNamesAreSafe(`${label} request_payload.order`, Object.keys(requestOrder));
    const unsupportedOrderKeys = Object.keys(requestOrder).filter(
      (key) => !POS_SYNC_REQUEST_ORDER_KEYS.has(key)
    );
    if (unsupportedOrderKeys.length > 0) {
      throw new Error(`${label} request_payload.order include unsupported field(s): ${unsupportedOrderKeys.sort().join(', ')}`);
    }
    const requestLocationId = assertNonEmptyString(
      `${label} request_payload.order.location_id`,
      requestOrder.location_id
    );
    if (requestLocationId !== integrationLocationId) {
      throw new Error(`${label} request_payload.order.location_id must match active integration location`);
    }

    const requestReferenceId = assertNonEmptyString(
      `${label} request_payload.order.reference_id`,
      requestOrder.reference_id
    );
    if (requestReferenceId !== requestedOrderId) {
      throw new Error(`${label} request_payload.order.reference_id must match requested order`);
    }

    const requestMetadata = assertPlainObject(
      `${label} request_payload.order.metadata`,
      requestOrder.metadata
    );
    assertPOSProviderFieldNamesAreSafe(`${label} request_payload.order.metadata`, Object.keys(requestMetadata));
    const unsupportedMetadataKeys = Object.keys(requestMetadata).filter(
      (key) => !POS_ORDER_REQUEST_METADATA_KEYS.has(key)
    );
    if (unsupportedMetadataKeys.length > 0) {
      throw new Error(
        `${label} request_payload.order.metadata include unsupported field(s): ${unsupportedMetadataKeys.sort().join(', ')}`
      );
    }
    const metadataSource = assertNonEmptyString(
      `${label} request_payload.order.metadata.source`,
      requestMetadata.source
    );
    if (metadataSource !== POS_ORDER_REQUEST_SOURCE) {
      throw new Error(`${label} request_payload.order.metadata.source must be ${POS_ORDER_REQUEST_SOURCE}`);
    }

    const metadataOrderId = assertNonEmptyString(
      `${label} request_payload.order.metadata.menumaker_order_id`,
      requestMetadata.menumaker_order_id
    );
    if (metadataOrderId !== requestedOrderId) {
      throw new Error(`${label} request_payload.order.metadata.menumaker_order_id must match requested order`);
    }

    const metadataBusinessId = assertNonEmptyString(
      `${label} request_payload.order.metadata.business_id`,
      requestMetadata.business_id
    );
    if (metadataBusinessId !== orderBusinessId) {
      throw new Error(`${label} request_payload.order.metadata.business_id must match requested order business`);
    }
  }

  private static assertSuccessfulSyncAuditEvidence(
    log: POSSyncLog,
    integration: POSIntegration,
    label: string
  ): void {
    if (normalizeSyncStatus(`${label} status`, log.status) !== 'success') {
      return;
    }

    POSSyncService.assertSuccessfulSyncResponseAudit(log, label, {
      orderId: log.order_id,
      businessId: integration.business_id,
      locationId: integration.location_id,
    });

    const logOrderId = assertNonEmptyString(`${label} order_id`, log.order_id);
    const integrationBusinessId = assertNonEmptyString(
      `${label} integration business_id`,
      integration.business_id
    );
    POSSyncService.assertSuccessfulSyncRequestPayloadAudit(
      log,
      logOrderId,
      integrationBusinessId,
      integration,
      label
    );
  }

  /**
   * Process pending retries (called by cron)
   */
  async processPendingRetries(): Promise<number> {
    this.assertPosSyncEnabled();
    const now = new Date();

    const pendingRetries = await this.syncLogRepository.find({
      where: {
        status: 'retry',
        next_retry_at: LessThan(now),
      },
      relations: ['pos_integration', 'order'],
    });
    POSSyncService.assertUniqueSyncLogIds(pendingRetries, 'POS pending retry');

    const retryAttempts: Array<{
      syncLog: POSSyncLog;
      order: Order;
      integration: POSIntegration;
    }> = [];

    for (const syncLog of pendingRetries) {
      const { order, integration } = POSSyncService.assertPendingRetryRelationLoaded(syncLog);
      if (integration.is_active) {
        POSSyncService.assertValidPendingRetryRelations(
          syncLog,
          order,
          integration,
          now
        );
        retryAttempts.push({ syncLog, order, integration });
      }
    }

    let attemptedRetries = 0;
    for (const { syncLog, order, integration } of retryAttempts) {
      attemptedRetries += 1;
      await this.attemptSync(syncLog, order, integration);
    }

    return attemptedRetries;
  }

  private assertPosSyncEnabled(): void {
    if (this.enforceCapability) {
      assertCapabilityEnabled('pos_sync');
    }
  }

  /**
   * Get sync history for a business
   */
  async getSyncHistory(
    businessId: string,
    options?: {
      limit?: number;
      offset?: number;
      status?: SyncStatus;
    }
  ): Promise<{ logs: POSSyncLog[]; total: number }> {
    this.assertPosSyncEnabled();
    const normalizedBusinessId = assertNonEmptyString('POS business_id', businessId);
    const normalizedOptions = normalizeSyncHistoryOptions(options);

    const integration = await this.integrationRepository.findOne({
      where: { business_id: normalizedBusinessId, is_active: true },
    });

    if (!integration) {
      return { logs: [], total: 0 };
    }

    POSSyncService.assertValidPersistedIntegration(
      integration,
      normalizedBusinessId,
      'POS integration'
    );

    const where: any = { pos_integration_id: integration.id };

    if (normalizedOptions.status) {
      where.status = normalizedOptions.status;
    }

    const [logs, total] = await this.syncLogRepository.findAndCount({
      where,
      order: { created_at: 'DESC' },
      take: normalizedOptions.limit,
      skip: normalizedOptions.offset,
    });

    const normalizedTotal = assertNonNegativeSafeIntegerCount('POS sync history total', total);
    if (normalizedTotal < logs.length) {
      throw new Error('POS sync history total must be greater than or equal to returned log count');
    }
    logs.forEach((log, index) => {
      const label = `POS sync history row ${index + 1}`;
      POSSyncService.assertValidPersistedSyncLog(
        log,
        integration.id,
        label
      );
      POSSyncService.assertSuccessfulSyncAuditEvidence(log, integration, label);
    });
    POSSyncService.assertUniqueSyncLogIds(logs, 'POS sync history');
    POSSyncService.assertUniqueSuccessfulSyncOrders(logs, 'POS sync history');

    return { logs, total: normalizedTotal };
  }

  /**
   * Get sync statistics for a business
   */
  async getSyncStats(businessId: string): Promise<{
    total_syncs: number;
    successful_syncs: number;
    failed_syncs: number;
    pending_retries: number;
    success_rate: number;
  }> {
    this.assertPosSyncEnabled();
    const normalizedBusinessId = assertNonEmptyString('POS business_id', businessId);
    const integration = await this.integrationRepository.findOne({
      where: { business_id: normalizedBusinessId, is_active: true },
    });

    if (!integration) {
      return {
        total_syncs: 0,
        successful_syncs: 0,
        failed_syncs: 0,
        pending_retries: 0,
        success_rate: 0,
      };
    }

    POSSyncService.assertValidPersistedIntegration(
      integration,
      normalizedBusinessId,
      'POS integration'
    );

    const allLogs = await this.syncLogRepository.find({
      where: { pos_integration_id: integration.id },
    });

    allLogs.forEach((log, index) => {
      const label = `POS sync stats row ${index + 1}`;
      POSSyncService.assertValidPersistedSyncLog(
        log,
        integration.id,
        label
      );
      POSSyncService.assertSuccessfulSyncAuditEvidence(log, integration, label);
    });
    POSSyncService.assertUniqueSyncLogIds(allLogs, 'POS sync stats');
    POSSyncService.assertUniqueSuccessfulSyncOrders(allLogs, 'POS sync stats');

    const normalizedStatuses = allLogs.map((log, index) =>
      normalizeSyncStatus(`POS sync stats row ${index + 1} status`, log.status)
    );
    const successfulSyncs = normalizedStatuses.filter((status) => status === 'success').length;
    const failedSyncs = normalizedStatuses.filter((status) => status === 'failed').length;
    const pendingRetries = normalizedStatuses.filter((status) => status === 'retry').length;
    const totalSyncs = allLogs.length;

    const successRate = totalSyncs > 0 ? (successfulSyncs / totalSyncs) * 100 : 0;

    return {
      total_syncs: totalSyncs,
      successful_syncs: successfulSyncs,
      failed_syncs: failedSyncs,
      pending_retries: pendingRetries,
      success_rate: Math.round(successRate * 10) / 10,
    };
  }
}
