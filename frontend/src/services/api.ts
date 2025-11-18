import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

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

  // Generic HTTP methods for direct API access
  async get<T = any>(url: string, config?: any) {
    const response = await this.client.get<T>(url, config);
    return response.data;
  }

  async post<T = any>(url: string, data?: any, config?: any) {
    const response = await this.client.post<T>(url, data, config);
    return response.data;
  }

  async patch<T = any>(url: string, data?: any, config?: any) {
    const response = await this.client.patch<T>(url, data, config);
    return response.data;
  }

  async delete<T = any>(url: string, config?: any) {
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
    delivery_fee_type: 'flat' | 'distance' | 'free';
    delivery_fee_flat_cents: number;
    delivery_fee_per_km_cents: number;
    delivery_radius_km: number;
    minimum_order_cents: number;
    currency: string;
    timezone: string;
    business_hours: Record<string, unknown>;
  }>) {
    const response = await this.client.put(`/businesses/${businessId}/settings`, settings);
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
    const response = await this.client.post('/orders', data);
    return response.data;
  }

  async getOrders(businessId: string, status?: string) {
    const params = new URLSearchParams({ businessId });
    if (status) params.append('status', status);
    const response = await this.client.get(`/orders?${params.toString()}`);
    return response.data;
  }

  async getOrderById(id: string) {
    const response = await this.client.get(`/orders/${id}`);
    return response.data;
  }

  async updateOrderStatus(id: string, status: 'pending' | 'confirmed' | 'ready' | 'fulfilled' | 'cancelled') {
    const response = await this.client.put(`/orders/${id}/status`, { status });
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
    const params = new URLSearchParams({ businessId });
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    if (filters?.status) params.append('status', filters.status);

    const response = await this.client.get(`/reports/orders/export?${params.toString()}`, {
      responseType: 'blob',
    });
    return response.data;
  }

  async getDashboardStats(businessId: string, period?: 'today' | 'week' | 'month' | 'all') {
    const params = new URLSearchParams({ businessId });
    if (period) params.append('period', period);
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

  // Subscription endpoints
  async getSubscriptionTiers() {
    const response = await this.client.get('/subscriptions/tiers');
    return response.data;
  }

  async getCurrentSubscription() {
    const response = await this.client.get('/subscriptions/current');
    return response.data;
  }

  async createSubscription(tier: 'free' | 'starter' | 'pro', options?: {
    trialDays?: number;
    email?: string;
  }) {
    const response = await this.client.post('/subscriptions/subscribe', {
      tier,
      ...options,
    });
    return response.data;
  }

  async cancelSubscription(immediate?: boolean) {
    const response = await this.client.post('/subscriptions/cancel', { immediate });
    return response.data;
  }

  async resumeSubscription() {
    const response = await this.client.post('/subscriptions/resume');
    return response.data;
  }

  async getSubscriptionPortal(returnUrl: string) {
    const response = await this.client.get(`/subscriptions/portal?returnUrl=${encodeURIComponent(returnUrl)}`);
    return response.data;
  }

  async getSubscriptionUsage() {
    const response = await this.client.get('/subscriptions/usage');
    return response.data;
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
    if (params?.status) queryParams.append('status', params.status);
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.offset) queryParams.append('offset', params.offset.toString());

    const response = await this.client.get(`/orders/my-orders?${queryParams.toString()}`);
    return response.data;
  }

  async cancelOrder(orderId: string, reason?: string) {
    const response = await this.client.post(`/orders/${orderId}/cancel`, { reason });
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
}

export const api = new ApiClient();
