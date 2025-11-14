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
}

export const api = new ApiClient();
