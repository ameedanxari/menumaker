import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';
const SUBSCRIPTION_CAPABILITY = 'subscriptions';
const SUBSCRIPTION_DISABLED_MESSAGE =
  'Paid subscriptions are disabled in this launch build until Stripe configuration, webhook evidence, support runbooks, and rollback procedures are complete.';
const UNSAFE_API_TEXT_CONTROLS =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/u;
const LEGACY_REFERRAL_STATUSES = new Set([
  'link_clicked',
  'signup_completed',
  'first_menu_published',
  'expired',
]);
const DELIVERY_SETTING_TYPES = new Set(['flat', 'distance', 'free']);
const ORDER_DELIVERY_TYPES = new Set(['pickup', 'delivery']);
const ORDER_PAYMENT_METHODS = new Set(['cash', 'card', 'online']);
const ORDER_STATUSES = new Set(['pending', 'confirmed', 'ready', 'fulfilled', 'cancelled']);
const REPORT_DASHBOARD_PERIODS = new Set(['today', 'week', 'month', 'all']);
const REPORT_ANALYTICS_PERIODS = new Set(['today', 'week', 'month', 'custom']);

const DISABLED_CAPABILITY_ROUTE_GATES = [
  {
    capability: 'pos_sync',
    segments: [['pos']],
    message:
      'POS sync is disabled until provider certification, merchant credentials, monitoring, and rollback evidence are complete.',
  },
  {
    capability: 'delivery_partner',
    segments: [['delivery']],
    message:
      'Third-party delivery partner integration is disabled until provider certification, credentials, monitoring, and rollback evidence are complete.',
  },
  {
    capability: 'ocr_import',
    segments: [['ocr']],
    message:
      'OCR menu import is disabled until provider credentials, privacy review, and launch evidence are complete.',
  },
  {
    capability: 'tax_reporting',
    segments: [['tax']],
    message:
      'Tax reporting is disabled until invoice-numbering policy, tax/legal evidence, and review sign-off are complete.',
  },
  {
    capability: SUBSCRIPTION_CAPABILITY,
    segments: [['subscriptions']],
    message: SUBSCRIPTION_DISABLED_MESSAGE,
  },
  {
    capability: 'enhanced_referrals_affiliates',
    segments: [
      ['affiliate'],
      ['affiliates'],
      ['badges'],
      ['viral'],
      ['leaderboard'],
      ['referrals', 'leaderboard'],
      ['referrals', 'share'],
      ['customers', 'referrals'],
    ],
    message:
      'Enhanced referral campaigns, leaderboards, affiliate flows, and payouts are disabled until launch evidence is complete.',
  },
] as const;

export class FeatureUnavailableError extends Error {
  readonly code = 'FEATURE_UNAVAILABLE';
  readonly status = 503;

  constructor(
    readonly capability: string,
    message: string
  ) {
    super(message);
    this.name = 'FeatureUnavailableError';
  }
}

class ApiClient {
  private client: AxiosInstance;
  private accessToken: string | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add auth token
    this.client.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        if (this.accessToken) {
          config.headers.Authorization = `Bearer ${this.accessToken}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          // Token expired, clear auth state
          this.setAccessToken(null);
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  setAccessToken(token: string | null) {
    this.accessToken = token;
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  private rejectDisabledCapability(capability: string, message: string): never {
    throw new FeatureUnavailableError(capability, message);
  }

  private normalizeApiPath(url: string): string {
    const pathSource = url.split(/[?#]/u)[0] ?? '';
    const absoluteUrlMatch = pathSource.match(/^[a-z][a-z\d+.-]*:\/\/[^/]*(\/.*)?$/iu);
    const protocolRelativeUrlMatch = pathSource.match(/^\/\/[^/]*(\/.*)?$/u);
    const path = absoluteUrlMatch?.[1] ?? protocolRelativeUrlMatch?.[1] ?? pathSource;

    return this.decodeApiPath(path).replace(/^\/api\/v\d+/i, '') || '/';
  }

  private decodeApiPath(path: string): string {
    try {
      return decodeURIComponent(path);
    } catch {
      throw new Error('API route URL path must be valid percent-encoding');
    }
  }

  private assertRouteCapabilityAvailable(url: string) {
    this.assertSafeApiText('API route URL', url);
    const path = this.normalizeApiPath(url);
    this.assertSafeApiText('API route path', path);
    const pathSegments = path
      .split('/')
      .filter(Boolean)
      .map((segment) => segment.toLowerCase());
    this.assertNoRelativeApiPathSegments(pathSegments);
    const gate = DISABLED_CAPABILITY_ROUTE_GATES.find(({ segments }) =>
      segments.some((candidate) =>
        candidate.every((segment, index) => pathSegments[index] === segment)
      )
    );

    if (gate) {
      this.rejectDisabledCapability(gate.capability, gate.message);
    }
  }

  private assertNonNegativeSafeInteger(label: string, value: unknown): number {
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
      throw new Error(`${label} must be a non-negative integer`);
    }
    if (!Number.isSafeInteger(value)) {
      throw new Error(`${label} must be a safe integer`);
    }
    return value;
  }

  private assertSafeApiText(label: string, value: string) {
    if (UNSAFE_API_TEXT_CONTROLS.test(value)) {
      throw new Error(`${label} contains unsafe control characters`);
    }
  }

  private assertNoRelativeApiPathSegments(pathSegments: string[]) {
    if (pathSegments.some((segment) => segment === '.' || segment === '..')) {
      throw new Error('API route path must not include relative path segments');
    }
  }

  private normalizeLegacyReferralStatus(value: string): string {
    this.assertSafeApiText('Referral status', value);
    const normalized = value.trim().toLowerCase();
    if (!normalized) {
      throw new Error('Referral status must be link_clicked, signup_completed, first_menu_published, or expired');
    }
    if (!LEGACY_REFERRAL_STATUSES.has(normalized)) {
      throw new Error('Referral status must be link_clicked, signup_completed, first_menu_published, or expired');
    }
    return normalized;
  }

  private normalizeBusinessSettingsPayload(settings: Record<string, unknown>): Record<string, unknown> {
    const normalized = { ...settings };

    if (settings.delivery_fee_type !== undefined) {
      if (typeof settings.delivery_fee_type !== 'string') {
        throw new Error('Delivery fee type must be flat, distance, or free');
      }
      this.assertSafeApiText('Delivery fee type', settings.delivery_fee_type);
      const deliveryType = settings.delivery_fee_type.trim().toLowerCase();
      if (!DELIVERY_SETTING_TYPES.has(deliveryType)) {
        throw new Error('Delivery fee type must be flat, distance, or free');
      }
      normalized.delivery_type = deliveryType;
    }

    if (settings.delivery_type !== undefined) {
      if (typeof settings.delivery_type !== 'string') {
        throw new Error('Delivery type must be flat, distance, or free');
      }
      this.assertSafeApiText('Delivery type', settings.delivery_type);
      const deliveryType = settings.delivery_type.trim().toLowerCase();
      if (!DELIVERY_SETTING_TYPES.has(deliveryType)) {
        throw new Error('Delivery type must be flat, distance, or free');
      }
      normalized.delivery_type = deliveryType;
    }

    if (settings.delivery_fee_flat_cents !== undefined) {
      normalized.delivery_fee_cents = this.assertNonNegativeSafeInteger(
        'Flat delivery fee',
        settings.delivery_fee_flat_cents
      );
    }

    if (settings.delivery_fee_cents !== undefined) {
      normalized.delivery_fee_cents = this.assertNonNegativeSafeInteger(
        'Delivery fee',
        settings.delivery_fee_cents
      );
    }

    if (settings.delivery_fee_per_km_cents !== undefined) {
      normalized.delivery_per_km_cents = this.assertNonNegativeSafeInteger(
        'Delivery fee per kilometer',
        settings.delivery_fee_per_km_cents
      );
    }

    if (settings.delivery_per_km_cents !== undefined) {
      normalized.delivery_per_km_cents = this.assertNonNegativeSafeInteger(
        'Delivery fee per kilometer',
        settings.delivery_per_km_cents
      );
    }

    if (settings.delivery_radius_km !== undefined) {
      if (
        typeof settings.delivery_radius_km !== 'number' ||
        !Number.isFinite(settings.delivery_radius_km) ||
        settings.delivery_radius_km < 0
      ) {
        throw new Error('Delivery radius must be a non-negative finite number');
      }
    }

    return normalized;
  }

  private normalizeRequiredOrderText(label: string, value: unknown, maxLength: number): string {
    if (typeof value !== 'string') {
      throw new Error(`${label} is required`);
    }
    this.assertSafeApiText(label, value);
    const normalized = value.trim();
    if (!normalized) {
      throw new Error(`${label} is required`);
    }
    if (normalized.length > maxLength) {
      throw new Error(`${label} must be ${maxLength} characters or less`);
    }
    return normalized;
  }

  private normalizeOptionalOrderText(label: string, value: unknown, maxLength: number): string | undefined {
    if (value === undefined || value === null || value === '') return undefined;
    if (typeof value !== 'string') {
      throw new Error(`${label} must be text`);
    }
    this.assertSafeApiText(label, value);
    const normalized = value.trim();
    if (!normalized) return undefined;
    if (normalized.length > maxLength) {
      throw new Error(`${label} must be ${maxLength} characters or less`);
    }
    return normalized;
  }

  private normalizeOrderPayload(data: {
    business_id: string;
    customer_name: string;
    customer_phone: string;
    customer_email?: string;
    delivery_type: 'delivery' | 'pickup';
    delivery_address?: string;
    delivery_distance_km?: number;
    items: Array<{ dish_id: string; quantity: number }>;
    notes?: string;
    payment_method: 'cash' | 'card' | 'online';
  }) {
    const business_id = this.normalizeRequiredOrderText('Business ID', data.business_id, 255);
    const customer_name = this.normalizeRequiredOrderText('Customer name', data.customer_name, 255);
    const customer_phone = this.normalizeRequiredOrderText('Customer phone', data.customer_phone, 40);
    const customer_email = this.normalizeOptionalOrderText('Customer email', data.customer_email, 320);
    const notes = this.normalizeOptionalOrderText('Order notes', data.notes, 500);

    const delivery_type = this.normalizeRequiredOrderText('Delivery type', data.delivery_type, 20).toLowerCase();
    if (!ORDER_DELIVERY_TYPES.has(delivery_type)) {
      throw new Error('Delivery type must be pickup or delivery');
    }

    const delivery_address = this.normalizeOptionalOrderText('Delivery address', data.delivery_address, 1000);
    if (delivery_type === 'delivery' && !delivery_address) {
      throw new Error('Delivery address is required for delivery orders');
    }

    if (data.delivery_distance_km !== undefined) {
      if (
        typeof data.delivery_distance_km !== 'number' ||
        !Number.isFinite(data.delivery_distance_km) ||
        data.delivery_distance_km < 0
      ) {
        throw new Error('Delivery distance must be a non-negative finite number');
      }
    }

    const payment_method = this.normalizeRequiredOrderText('Payment method', data.payment_method, 20).toLowerCase();
    if (!ORDER_PAYMENT_METHODS.has(payment_method)) {
      throw new Error('Payment method must be cash, card, or online');
    }

    if (!Array.isArray(data.items) || data.items.length === 0 || data.items.length > 50) {
      throw new Error('Order must include between 1 and 50 items');
    }

    const items = data.items.map((item) => ({
      dish_id: this.normalizeRequiredOrderText('Dish ID', item.dish_id, 255),
      quantity: this.assertNonNegativeSafeInteger('Item quantity', item.quantity),
    }));

    if (items.some((item) => item.quantity < 1 || item.quantity > 100)) {
      throw new Error('Item quantity must be between 1 and 100');
    }

    return {
      business_id,
      customer_name,
      customer_phone,
      ...(customer_email === undefined ? {} : { customer_email }),
      delivery_type,
      ...(delivery_address === undefined ? {} : { delivery_address }),
      ...(data.delivery_distance_km === undefined ? {} : { delivery_distance_km: data.delivery_distance_km }),
      items,
      ...(notes === undefined ? {} : { notes }),
      payment_method,
    };
  }

  private normalizeOrderId(label: string, value: unknown): string {
    return this.normalizeRequiredOrderText(label, value, 255);
  }

  private normalizeOrderStatus(value: unknown): 'pending' | 'confirmed' | 'ready' | 'fulfilled' | 'cancelled' {
    const normalized = this.normalizeRequiredOrderText('Order status', value, 40).toLowerCase();
    if (!ORDER_STATUSES.has(normalized)) {
      throw new Error('Order status must be pending, confirmed, ready, fulfilled, or cancelled');
    }
    return normalized as 'pending' | 'confirmed' | 'ready' | 'fulfilled' | 'cancelled';
  }

  private normalizeReportDate(label: string, value: unknown): string | undefined {
    if (value === undefined || value === null || value === '') return undefined;
    if (typeof value !== 'string') {
      throw new Error(`${label} must be text`);
    }
    this.assertSafeApiText(label, value);
    const normalized = value.trim();
    if (!normalized) return undefined;
    if (Number.isNaN(Date.parse(normalized))) {
      throw new Error(`${label} must be a valid date`);
    }
    return normalized;
  }

  private normalizeReportDateRange(params: { startDate?: unknown; endDate?: unknown }) {
    const startDate = this.normalizeReportDate('Start date', params.startDate);
    const endDate = this.normalizeReportDate('End date', params.endDate);

    if (startDate && endDate && Date.parse(startDate) > Date.parse(endDate)) {
      throw new Error('Start date must be before or equal to end date');
    }

    return { startDate, endDate };
  }

  private normalizeDashboardPeriod(period: unknown): string | undefined {
    if (period === undefined || period === null || period === '') return undefined;
    if (typeof period !== 'string') {
      throw new Error('Dashboard period must be text');
    }
    this.assertSafeApiText('Dashboard period', period);
    const normalized = period.trim().toLowerCase();
    if (!REPORT_DASHBOARD_PERIODS.has(normalized)) {
      throw new Error('Dashboard period must be today, week, month, or all');
    }
    return normalized;
  }

  private normalizeAnalyticsPeriod(period: unknown): string | undefined {
    if (period === undefined || period === null || period === '') return undefined;
    if (typeof period !== 'string') {
      throw new Error('Analytics period must be text');
    }
    this.assertSafeApiText('Analytics period', period);
    const normalized = period.trim().toLowerCase();
    if (!REPORT_ANALYTICS_PERIODS.has(normalized)) {
      throw new Error('Analytics period must be today, week, month, or custom');
    }
    return normalized;
  }

  // Generic HTTP methods for direct API access
  async get<T = any>(url: string, config?: any) {
    this.assertRouteCapabilityAvailable(url);
    const response = await this.client.get<T>(url, config);
    return response.data;
  }

  async post<T = any>(url: string, data?: any, config?: any) {
    this.assertRouteCapabilityAvailable(url);
    const response = await this.client.post<T>(url, data, config);
    return response.data;
  }

  async put<T = any>(url: string, data?: any, config?: any) {
    this.assertRouteCapabilityAvailable(url);
    const response = await this.client.put<T>(url, data, config);
    return response.data;
  }

  async patch<T = any>(url: string, data?: any, config?: any) {
    this.assertRouteCapabilityAvailable(url);
    const response = await this.client.patch<T>(url, data, config);
    return response.data;
  }

  async delete<T = any>(url: string, config?: any) {
    this.assertRouteCapabilityAvailable(url);
    const response = await this.client.delete<T>(url, config);
    return response.data;
  }

  // Auth endpoints
  async signup(email: string, password: string) {
    const response = await this.client.post('/auth/signup', { email, password });
    return response.data;
  }

  async login(email: string, password: string) {
    const response = await this.client.post('/auth/login', { email, password });
    return response.data;
  }

  async getCurrentUser() {
    const response = await this.client.get('/auth/me');
    return response.data;
  }

  async refreshToken(refreshToken: string) {
    const response = await this.client.post('/auth/refresh', { refresh_token: refreshToken });
    return response.data;
  }

  async updateProfile(data: { name?: string; phone?: string; address?: string }) {
    const response = await this.client.patch('/auth/profile', data);
    return response.data;
  }

  async changePassword(currentPassword: string, newPassword: string) {
    const response = await this.client.post('/auth/change-password', {
      current_password: currentPassword,
      new_password: newPassword,
    });
    return response.data;
  }

  async updateProfilePhoto(photoUrl: string) {
    const response = await this.client.post('/auth/photo', { photo_url: photoUrl });
    return response.data;
  }

  async forgotPassword(email: string) {
    const response = await this.client.post('/auth/forgot-password', { email });
    return response.data;
  }

  async logout() {
    const response = await this.client.post('/auth/logout');
    return response.data;
  }

  // Business endpoints
  async createBusiness(data: {
    name: string;
    description?: string;
    address?: string;
    phone?: string;
    email?: string;
  }) {
    const response = await this.client.post('/businesses', data);
    return response.data;
  }

  async getBusinesses() {
    const response = await this.client.get('/businesses');
    return response.data;
  }

  async getBusinessById(id: string) {
    const response = await this.client.get(`/businesses/${id}`);
    return response.data;
  }

  async getBusinessBySlug(slug: string) {
    const response = await this.client.get(`/businesses/slug/${slug}`);
    return response.data;
  }

  async updateBusiness(id: string, data: Partial<{
    name: string;
    description: string;
    address: string;
    phone: string;
    email: string;
    logo_url: string;
    banner_url: string;
  }>) {
    const response = await this.client.put(`/businesses/${id}`, data);
    return response.data;
  }

  async updateBusinessSettings(businessId: string, settings: Partial<{
    delivery_enabled: boolean;
    pickup_enabled: boolean;
    delivery_type: 'flat' | 'distance' | 'free';
    delivery_fee_type: 'flat' | 'distance' | 'free';
    delivery_fee_cents: number;
    delivery_fee_flat_cents: number;
    delivery_per_km_cents: number;
    delivery_fee_per_km_cents: number;
    delivery_radius_km: number;
    minimum_order_cents: number;
    currency: string;
    timezone: string;
    business_hours: Record<string, unknown>;
  }>) {
    const response = await this.client.put(
      `/businesses/${businessId}/settings`,
      this.normalizeBusinessSettingsPayload(settings as Record<string, unknown>)
    );
    return response.data;
  }

  // Dish endpoints
  async createDish(businessId: string, data: {
    name: string;
    description?: string;
    price_cents: number;
    image_url?: string;
    category_id?: string;
    is_available?: boolean;
  }) {
    const response = await this.client.post('/dishes', {
      business_id: businessId,
      ...data,
    });
    return response.data;
  }

  async getDishes(businessId: string) {
    const response = await this.client.get(`/dishes?businessId=${businessId}`);
    return response.data;
  }

  async updateDish(id: string, data: Partial<{
    name: string;
    description: string;
    price_cents: number;
    image_url: string;
    category_id: string;
    is_available: boolean;
  }>) {
    const response = await this.client.put(`/dishes/${id}`, data);
    return response.data;
  }

  async deleteDish(id: string) {
    const response = await this.client.delete(`/dishes/${id}`);
    return response.data;
  }

  async createDishCategory(businessId: string, name: string, displayOrder?: number) {
    const response = await this.client.post('/dishes/categories', {
      business_id: businessId,
      name,
      display_order: displayOrder,
    });
    return response.data;
  }

  async getDishCategories(businessId: string) {
    const response = await this.client.get(`/dishes/categories?businessId=${businessId}`);
    return response.data;
  }

  // Menu endpoints
  async createMenu(businessId: string, name: string, description?: string) {
    const response = await this.client.post('/menus', {
      business_id: businessId,
      name,
      description,
    });
    return response.data;
  }

  async getMenus(businessId: string) {
    const response = await this.client.get(`/menus?businessId=${businessId}`);
    return response.data;
  }

  async getMenuById(id: string) {
    const response = await this.client.get(`/menus/${id}`);
    return response.data;
  }

  async addDishToMenu(menuId: string, dishId: string, priceOverrideCents?: number) {
    const response = await this.client.post(`/menus/${menuId}/items`, {
      dish_id: dishId,
      price_override_cents: priceOverrideCents,
    });
    return response.data;
  }

  async removeDishFromMenu(menuId: string, dishId: string) {
    const response = await this.client.delete(`/menus/${menuId}/items/${dishId}`);
    return response.data;
  }

  async publishMenu(menuId: string) {
    const response = await this.client.post(`/menus/${menuId}/publish`);
    return response.data;
  }

  async archiveMenu(menuId: string) {
    const response = await this.client.post(`/menus/${menuId}/archive`);
    return response.data;
  }

  async getActiveMenu(businessId: string) {
    const response = await this.client.get(`/menus/active?businessId=${businessId}`);
    return response.data;
  }

  // Order endpoints (public)
  async createOrder(data: {
    business_id: string;
    customer_name: string;
    customer_phone: string;
    customer_email?: string;
    delivery_type: 'delivery' | 'pickup';
    delivery_address?: string;
    delivery_distance_km?: number;
    items: Array<{ dish_id: string; quantity: number }>;
    notes?: string;
    payment_method: 'cash' | 'card' | 'online';
  }) {
    const response = await this.client.post('/orders', this.normalizeOrderPayload(data));
    return response.data;
  }

  async getOrders(businessId: string, status?: string) {
    const params = new URLSearchParams({ businessId: this.normalizeOrderId('Business ID', businessId) });
    if (status) params.append('status', this.normalizeOrderStatus(status));
    const response = await this.client.get(`/orders?${params.toString()}`);
    return response.data;
  }

  async getOrderById(id: string) {
    const response = await this.client.get(`/orders/${encodeURIComponent(this.normalizeOrderId('Order ID', id))}`);
    return response.data;
  }

  async updateOrderStatus(id: string, status: 'pending' | 'confirmed' | 'ready' | 'fulfilled' | 'cancelled') {
    const response = await this.client.put(
      `/orders/${encodeURIComponent(this.normalizeOrderId('Order ID', id))}/status`,
      { status: this.normalizeOrderStatus(status) }
    );
    return response.data;
  }

  // Media endpoints
  async uploadImage(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    const response = await this.client.post('/media/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  async uploadMultipleImages(files: File[]) {
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));
    const response = await this.client.post('/media/upload-multiple', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  async deleteImage(url: string) {
    const response = await this.client.delete('/media', { data: { url } });
    return response.data;
  }

  // Report endpoints
  async exportOrdersToCSV(businessId: string, filters?: {
    startDate?: string;
    endDate?: string;
    status?: string;
  }) {
    const dateRange = this.normalizeReportDateRange(filters ?? {});
    const params = new URLSearchParams({ businessId: this.normalizeOrderId('Business ID', businessId) });
    if (dateRange.startDate) params.append('startDate', dateRange.startDate);
    if (dateRange.endDate) params.append('endDate', dateRange.endDate);
    if (filters?.status) params.append('status', this.normalizeOrderStatus(filters.status));

    const response = await this.client.get(`/reports/orders/export?${params.toString()}`, {
      responseType: 'blob',
    });
    return response.data;
  }

  async getDashboardStats(businessId: string, period?: 'today' | 'week' | 'month' | 'all') {
    const params = new URLSearchParams({ businessId: this.normalizeOrderId('Business ID', businessId) });
    const normalizedPeriod = this.normalizeDashboardPeriod(period);
    if (normalizedPeriod) params.append('period', normalizedPeriod);
    const response = await this.client.get(`/reports/dashboard?${params.toString()}`);
    return response.data;
  }

  // Payment endpoints
  async createPaymentIntent(orderId: string) {
    const response = await this.client.post('/payments/create-intent', { orderId });
    return response.data;
  }

  async getPaymentById(paymentId: string) {
    const response = await this.client.get(`/payments/${paymentId}`);
    return response.data;
  }

  async createRefund(paymentId: string, options?: {
    amount?: number;
    reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer';
  }) {
    const response = await this.client.post(`/payments/${paymentId}/refund`, options);
    return response.data;
  }

  async getBusinessPaymentStats(businessId: string, filters?: {
    startDate?: string;
    endDate?: string;
  }) {
    const params = new URLSearchParams();
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    const response = await this.client.get(
      `/payments/business/${businessId}/stats?${params.toString()}`
    );
    return response.data;
  }

  // Basic seller referral endpoints. Enhanced customer campaigns, leaderboards,
  // affiliate payouts, and viral rewards remain disabled by the capability registry.
  async getMyReferralCode() {
    const response = await this.client.get('/referrals/users/me/referral-code');
    return response.data;
  }

  async getMyReferralStats() {
    const response = await this.client.get('/referrals/users/me/referrals/stats');
    return response.data;
  }

  async getMyReferrals(params?: { limit?: number; offset?: number; status?: string }) {
    const queryParams = new URLSearchParams();
    if (params?.limit !== undefined) {
      queryParams.append('limit', this.assertNonNegativeSafeInteger('Referral limit', params.limit).toString());
    }
    if (params?.offset !== undefined) {
      queryParams.append('offset', this.assertNonNegativeSafeInteger('Referral offset', params.offset).toString());
    }
    if (params?.status !== undefined) {
      queryParams.append('status', this.normalizeLegacyReferralStatus(params.status));
    }
    const suffix = queryParams.toString();
    const response = await this.client.get(`/referrals/users/me/referrals${suffix ? `?${suffix}` : ''}`);
    return response.data;
  }

  // Subscription endpoints
  async getSubscriptionTiers() {
    return this.rejectDisabledCapability(SUBSCRIPTION_CAPABILITY, SUBSCRIPTION_DISABLED_MESSAGE);
  }

  async getCurrentSubscription() {
    return this.rejectDisabledCapability(SUBSCRIPTION_CAPABILITY, SUBSCRIPTION_DISABLED_MESSAGE);
  }

  async createSubscription(_tier: 'free' | 'starter' | 'pro', _options?: {
    trialDays?: number;
    email?: string;
  }) {
    return this.rejectDisabledCapability(SUBSCRIPTION_CAPABILITY, SUBSCRIPTION_DISABLED_MESSAGE);
  }

  async cancelSubscription(_immediate?: boolean) {
    return this.rejectDisabledCapability(SUBSCRIPTION_CAPABILITY, SUBSCRIPTION_DISABLED_MESSAGE);
  }

  async resumeSubscription() {
    return this.rejectDisabledCapability(SUBSCRIPTION_CAPABILITY, SUBSCRIPTION_DISABLED_MESSAGE);
  }

  async getSubscriptionPortal(_returnUrl: string) {
    return this.rejectDisabledCapability(SUBSCRIPTION_CAPABILITY, SUBSCRIPTION_DISABLED_MESSAGE);
  }

  async getSubscriptionUsage() {
    return this.rejectDisabledCapability(SUBSCRIPTION_CAPABILITY, SUBSCRIPTION_DISABLED_MESSAGE);
  }

  // Notification endpoints
  async getNotifications(params?: { limit?: number; offset?: number; unread_only?: boolean }) {
    const queryParams = new URLSearchParams();
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.offset) queryParams.append('offset', params.offset.toString());
    if (params?.unread_only) queryParams.append('unread_only', 'true');

    const response = await this.client.get(`/notifications?${queryParams.toString()}`);
    return response.data;
  }

  async getNotificationById(id: string) {
    const response = await this.client.get(`/notifications/${id}`);
    return response.data;
  }

  async markNotificationAsRead(id: string, isRead: boolean = true) {
    const response = await this.client.patch(`/notifications/${id}`, { is_read: isRead });
    return response.data;
  }

  async markAllNotificationsAsRead() {
    const response = await this.client.post('/notifications/mark-all-read');
    return response.data;
  }

  async getUnreadNotificationCount() {
    const response = await this.client.get('/notifications/unread-count');
    return response.data;
  }

  // Cart (Saved Carts) endpoints
  async getSavedCarts() {
    const response = await this.client.get('/cart');
    return response.data;
  }

  async createSavedCart(data: {
    cart_name: string;
    cart_items: any[];
    total_cents: number;
    customer_phone?: string;
    customer_name?: string;
  }) {
    const response = await this.client.post('/cart', data);
    return response.data;
  }

  async getSavedCartById(id: string) {
    const response = await this.client.get(`/cart/${id}`);
    return response.data;
  }

  async updateSavedCart(id: string, data: {
    cart_name?: string;
    cart_items?: any[];
    total_cents?: number;
  }) {
    const response = await this.client.put(`/cart/${id}`, data);
    return response.data;
  }

  async deleteSavedCart(id: string) {
    const response = await this.client.delete(`/cart/${id}`);
    return response.data;
  }

  // User Settings endpoints
  async getUserSettings() {
    const response = await this.client.get('/settings');
    return response.data;
  }

  async updateUserSettings(settings: {
    language?: string;
    notifications_enabled?: boolean;
    order_notifications?: boolean;
    promotion_notifications?: boolean;
    review_notifications?: boolean;
    biometric_enabled?: boolean;
    theme?: string;
  }) {
    const response = await this.client.patch('/settings', settings);
    return response.data;
  }

  // Customer Order endpoints
  async getCustomerOrders(params?: { status?: string; limit?: number; offset?: number }) {
    const queryParams = new URLSearchParams();
    if (params?.status) queryParams.append('status', this.normalizeOrderStatus(params.status));
    if (params?.limit !== undefined) {
      queryParams.append('limit', this.assertNonNegativeSafeInteger('Order limit', params.limit).toString());
    }
    if (params?.offset !== undefined) {
      queryParams.append('offset', this.assertNonNegativeSafeInteger('Order offset', params.offset).toString());
    }

    const response = await this.client.get(`/orders/my-orders?${queryParams.toString()}`);
    return response.data;
  }

  async cancelOrder(orderId: string, reason?: string) {
    const normalizedReason = this.normalizeOptionalOrderText('Cancellation reason', reason, 500);
    const response = await this.client.post(
      `/orders/${encodeURIComponent(this.normalizeOrderId('Order ID', orderId))}/cancel`,
      normalizedReason === undefined ? {} : { reason: normalizedReason }
    );
    return response.data;
  }

  // Review interaction endpoints
  async markReviewAsHelpful(reviewId: string) {
    const response = await this.client.post(`/reviews/${reviewId}/helpful`);
    return response.data;
  }

  async removeReviewHelpful(reviewId: string) {
    const response = await this.client.delete(`/reviews/${reviewId}/helpful`);
    return response.data;
  }

  async reportReview(reviewId: string, reason?: string) {
    const response = await this.client.post(`/reviews/${reviewId}/report`, { reason });
    return response.data;
  }

  // Analytics endpoints
  async getComprehensiveAnalytics(params: {
    businessId: string;
    period?: 'today' | 'week' | 'month' | 'custom';
    startDate?: string;
    endDate?: string;
  }) {
    const dateRange = this.normalizeReportDateRange(params);
    const period = this.normalizeAnalyticsPeriod(params.period);
    const queryParams = new URLSearchParams();
    queryParams.append('businessId', this.normalizeOrderId('Business ID', params.businessId));
    if (period) queryParams.append('period', period);
    if (dateRange.startDate) queryParams.append('startDate', dateRange.startDate);
    if (dateRange.endDate) queryParams.append('endDate', dateRange.endDate);

    const response = await this.client.get(`/reports/analytics?${queryParams.toString()}`);
    return response.data;
  }

  async exportOrders(params: {
    businessId: string;
    startDate?: string;
    endDate?: string;
    status?: string;
  }) {
    const dateRange = this.normalizeReportDateRange(params);
    const queryParams = new URLSearchParams();
    queryParams.append('businessId', this.normalizeOrderId('Business ID', params.businessId));
    if (dateRange.startDate) queryParams.append('startDate', dateRange.startDate);
    if (dateRange.endDate) queryParams.append('endDate', dateRange.endDate);
    if (params.status) queryParams.append('status', this.normalizeOrderStatus(params.status));

    const response = await this.client.get(`/reports/orders/export?${queryParams.toString()}`);
    return response.data;
  }
}

export const api = new ApiClient();
