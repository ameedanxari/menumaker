import { describe, expect, it, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { api } from './api';

// Mock axios
vi.mock('axios', () => {
  const mockAxiosInstance = {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  };
  return {
    default: {
      create: vi.fn(() => mockAxiosInstance),
    },
  };
});

describe('ApiClient', () => {
  let mockClient: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = (axios.create as any)();
  });

  describe('token management', () => {
    it('sets access token', () => {
      api.setAccessToken('test-token');
      expect(api.getAccessToken()).toBe('test-token');
    });

    it('clears access token', () => {
      api.setAccessToken('test-token');
      api.setAccessToken(null);
      expect(api.getAccessToken()).toBeNull();
    });
  });

  describe('auth endpoints', () => {
    it('calls signup endpoint', async () => {
      mockClient.post.mockResolvedValue({ data: { success: true } });

      await api.signup('test@example.com', 'password123');

      expect(mockClient.post).toHaveBeenCalledWith('/auth/signup', {
        email: 'test@example.com',
        password: 'password123',
      });
    });

    it('calls login endpoint', async () => {
      mockClient.post.mockResolvedValue({ data: { success: true } });

      await api.login('test@example.com', 'password123');

      expect(mockClient.post).toHaveBeenCalledWith('/auth/login', {
        email: 'test@example.com',
        password: 'password123',
      });
    });

    it('calls getCurrentUser endpoint', async () => {
      mockClient.get.mockResolvedValue({ data: { user: { id: '1' } } });

      await api.getCurrentUser();

      expect(mockClient.get).toHaveBeenCalledWith('/auth/me');
    });

    it('calls refreshToken endpoint', async () => {
      mockClient.post.mockResolvedValue({ data: { success: true } });

      await api.refreshToken('refresh-token');

      expect(mockClient.post).toHaveBeenCalledWith('/auth/refresh', {
        refresh_token: 'refresh-token',
      });
    });

    it('calls updateProfile endpoint', async () => {
      mockClient.patch.mockResolvedValue({ data: { success: true } });

      await api.updateProfile({ name: 'John', phone: '1234567890' });

      expect(mockClient.patch).toHaveBeenCalledWith('/auth/profile', {
        name: 'John',
        phone: '1234567890',
      });
    });

    it('calls changePassword endpoint', async () => {
      mockClient.post.mockResolvedValue({ data: { success: true } });

      await api.changePassword('oldpass', 'newpass');

      expect(mockClient.post).toHaveBeenCalledWith('/auth/change-password', {
        current_password: 'oldpass',
        new_password: 'newpass',
      });
    });

    it('calls logout endpoint', async () => {
      mockClient.post.mockResolvedValue({ data: { success: true } });

      await api.logout();

      expect(mockClient.post).toHaveBeenCalledWith('/auth/logout');
    });
  });

  describe('business endpoints', () => {
    it('calls createBusiness endpoint', async () => {
      mockClient.post.mockResolvedValue({ data: { success: true } });

      await api.createBusiness({ name: 'My Business', description: 'Test' });

      expect(mockClient.post).toHaveBeenCalledWith('/businesses', {
        name: 'My Business',
        description: 'Test',
      });
    });

    it('calls getBusinesses endpoint', async () => {
      mockClient.get.mockResolvedValue({ data: { businesses: [] } });

      await api.getBusinesses();

      expect(mockClient.get).toHaveBeenCalledWith('/businesses');
    });

    it('calls getBusinessById endpoint', async () => {
      mockClient.get.mockResolvedValue({ data: { business: {} } });

      await api.getBusinessById('123');

      expect(mockClient.get).toHaveBeenCalledWith('/businesses/123');
    });

    it('calls getBusinessBySlug endpoint', async () => {
      mockClient.get.mockResolvedValue({ data: { business: {} } });

      await api.getBusinessBySlug('my-business');

      expect(mockClient.get).toHaveBeenCalledWith('/businesses/slug/my-business');
    });

    it('calls updateBusiness endpoint', async () => {
      mockClient.put.mockResolvedValue({ data: { success: true } });

      await api.updateBusiness('123', { name: 'Updated Name' });

      expect(mockClient.put).toHaveBeenCalledWith('/businesses/123', {
        name: 'Updated Name',
      });
    });

    it('calls updateBusinessSettings endpoint', async () => {
      mockClient.put.mockResolvedValue({ data: { success: true } });

      await api.updateBusinessSettings('123', { delivery_enabled: true });

      expect(mockClient.put).toHaveBeenCalledWith('/businesses/123/settings', {
        delivery_enabled: true,
      });
    });
  });

  describe('dish endpoints', () => {
    it('calls createDish endpoint', async () => {
      mockClient.post.mockResolvedValue({ data: { success: true } });

      await api.createDish('biz-123', { name: 'Pizza', price_cents: 1000 });

      expect(mockClient.post).toHaveBeenCalledWith('/dishes', {
        business_id: 'biz-123',
        name: 'Pizza',
        price_cents: 1000,
      });
    });

    it('calls getDishes endpoint', async () => {
      mockClient.get.mockResolvedValue({ data: { dishes: [] } });

      await api.getDishes('biz-123');

      expect(mockClient.get).toHaveBeenCalledWith('/dishes?businessId=biz-123');
    });

    it('calls updateDish endpoint', async () => {
      mockClient.put.mockResolvedValue({ data: { success: true } });

      await api.updateDish('dish-123', { name: 'Updated Pizza' });

      expect(mockClient.put).toHaveBeenCalledWith('/dishes/dish-123', {
        name: 'Updated Pizza',
      });
    });

    it('calls deleteDish endpoint', async () => {
      mockClient.delete.mockResolvedValue({ data: { success: true } });

      await api.deleteDish('dish-123');

      expect(mockClient.delete).toHaveBeenCalledWith('/dishes/dish-123');
    });
  });

  describe('menu endpoints', () => {
    it('calls createMenu endpoint', async () => {
      mockClient.post.mockResolvedValue({ data: { success: true } });

      await api.createMenu('biz-123', 'Lunch Menu', 'Our lunch offerings');

      expect(mockClient.post).toHaveBeenCalledWith('/menus', {
        business_id: 'biz-123',
        name: 'Lunch Menu',
        description: 'Our lunch offerings',
      });
    });

    it('calls getMenus endpoint', async () => {
      mockClient.get.mockResolvedValue({ data: { menus: [] } });

      await api.getMenus('biz-123');

      expect(mockClient.get).toHaveBeenCalledWith('/menus?businessId=biz-123');
    });

    it('calls publishMenu endpoint', async () => {
      mockClient.post.mockResolvedValue({ data: { success: true } });

      await api.publishMenu('menu-123');

      expect(mockClient.post).toHaveBeenCalledWith('/menus/menu-123/publish');
    });

    it('calls archiveMenu endpoint', async () => {
      mockClient.post.mockResolvedValue({ data: { success: true } });

      await api.archiveMenu('menu-123');

      expect(mockClient.post).toHaveBeenCalledWith('/menus/menu-123/archive');
    });
  });

  describe('order endpoints', () => {
    it('calls createOrder endpoint', async () => {
      mockClient.post.mockResolvedValue({ data: { success: true } });

      const orderData = {
        business_id: 'biz-123',
        customer_name: 'John',
        customer_phone: '1234567890',
        delivery_type: 'pickup' as const,
        items: [{ dish_id: 'dish-1', quantity: 2 }],
        payment_method: 'cash' as const,
      };

      await api.createOrder(orderData);

      expect(mockClient.post).toHaveBeenCalledWith('/orders', orderData);
    });

    it('calls getOrders endpoint with status filter', async () => {
      mockClient.get.mockResolvedValue({ data: { orders: [] } });

      await api.getOrders('biz-123', 'pending');

      expect(mockClient.get).toHaveBeenCalledWith('/orders?businessId=biz-123&status=pending');
    });

    it('calls updateOrderStatus endpoint', async () => {
      mockClient.put.mockResolvedValue({ data: { success: true } });

      await api.updateOrderStatus('order-123', 'confirmed');

      expect(mockClient.put).toHaveBeenCalledWith('/orders/order-123/status', {
        status: 'confirmed',
      });
    });
  });

  describe('notification endpoints', () => {
    it('calls getNotifications endpoint', async () => {
      mockClient.get.mockResolvedValue({ data: { notifications: [] } });

      await api.getNotifications({ limit: 10, unread_only: true });

      expect(mockClient.get).toHaveBeenCalledWith('/notifications?limit=10&unread_only=true');
    });

    it('calls markNotificationAsRead endpoint', async () => {
      mockClient.patch.mockResolvedValue({ data: { success: true } });

      await api.markNotificationAsRead('notif-123');

      expect(mockClient.patch).toHaveBeenCalledWith('/notifications/notif-123', {
        is_read: true,
      });
    });

    it('calls markAllNotificationsAsRead endpoint', async () => {
      mockClient.post.mockResolvedValue({ data: { success: true } });

      await api.markAllNotificationsAsRead();

      expect(mockClient.post).toHaveBeenCalledWith('/notifications/mark-all-read');
    });
  });

  describe('settings endpoints', () => {
    it('calls getUserSettings endpoint', async () => {
      mockClient.get.mockResolvedValue({ data: { settings: {} } });

      await api.getUserSettings();

      expect(mockClient.get).toHaveBeenCalledWith('/settings');
    });

    it('calls updateUserSettings endpoint', async () => {
      mockClient.patch.mockResolvedValue({ data: { success: true } });

      await api.updateUserSettings({ language: 'en', theme: 'dark' });

      expect(mockClient.patch).toHaveBeenCalledWith('/settings', {
        language: 'en',
        theme: 'dark',
      });
    });
  });

  describe('payment endpoints', () => {
    it('calls createPaymentIntent endpoint', async () => {
      mockClient.post.mockResolvedValue({ data: { clientSecret: 'cs_test' } });

      await api.createPaymentIntent('order-123');

      expect(mockClient.post).toHaveBeenCalledWith('/payments/create-intent', {
        orderId: 'order-123',
      });
    });

    it('calls createRefund endpoint', async () => {
      mockClient.post.mockResolvedValue({ data: { success: true } });

      await api.createRefund('payment-123', { reason: 'requested_by_customer' });

      expect(mockClient.post).toHaveBeenCalledWith('/payments/payment-123/refund', {
        reason: 'requested_by_customer',
      });
    });
  });

  describe('subscription endpoints', () => {
    it('calls getSubscriptionTiers endpoint', async () => {
      mockClient.get.mockResolvedValue({ data: { tiers: [] } });

      await api.getSubscriptionTiers();

      expect(mockClient.get).toHaveBeenCalledWith('/subscriptions/tiers');
    });

    it('calls getCurrentSubscription endpoint', async () => {
      mockClient.get.mockResolvedValue({ data: { subscription: {} } });

      await api.getCurrentSubscription();

      expect(mockClient.get).toHaveBeenCalledWith('/subscriptions/current');
    });

    it('calls createSubscription endpoint', async () => {
      mockClient.post.mockResolvedValue({ data: { success: true } });

      await api.createSubscription('pro', { trialDays: 14 });

      expect(mockClient.post).toHaveBeenCalledWith('/subscriptions/subscribe', {
        tier: 'pro',
        trialDays: 14,
      });
    });

    it('calls cancelSubscription endpoint', async () => {
      mockClient.post.mockResolvedValue({ data: { success: true } });

      await api.cancelSubscription(true);

      expect(mockClient.post).toHaveBeenCalledWith('/subscriptions/cancel', {
        immediate: true,
      });
    });
  });

  describe('generic HTTP methods', () => {
    it('calls get method', async () => {
      mockClient.get.mockResolvedValue({ data: { result: 'test' } });

      const result = await api.get('/custom-endpoint');

      expect(mockClient.get).toHaveBeenCalledWith('/custom-endpoint', undefined);
      expect(result).toEqual({ result: 'test' });
    });

    it('calls post method', async () => {
      mockClient.post.mockResolvedValue({ data: { result: 'test' } });

      const result = await api.post('/custom-endpoint', { data: 'test' });

      expect(mockClient.post).toHaveBeenCalledWith('/custom-endpoint', { data: 'test' }, undefined);
      expect(result).toEqual({ result: 'test' });
    });

    it('calls patch method', async () => {
      mockClient.patch.mockResolvedValue({ data: { result: 'test' } });

      const result = await api.patch('/custom-endpoint', { data: 'test' });

      expect(mockClient.patch).toHaveBeenCalledWith('/custom-endpoint', { data: 'test' }, undefined);
      expect(result).toEqual({ result: 'test' });
    });

    it('calls delete method', async () => {
      mockClient.delete.mockResolvedValue({ data: { result: 'test' } });

      const result = await api.delete('/custom-endpoint');

      expect(mockClient.delete).toHaveBeenCalledWith('/custom-endpoint', undefined);
      expect(result).toEqual({ result: 'test' });
    });
  });
});
