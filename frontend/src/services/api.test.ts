import { describe, expect, it, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { FeatureUnavailableError, api } from './api';
import { sanitizeReferralCodePayload, sanitizeReferralStats } from '../pages/ReferralsPage';
import { sanitizePublicBusinessSettings } from '../pages/PublicMenuPage';

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

    it('normalizes delivery settings before updating business settings', async () => {
      mockClient.put.mockResolvedValue({ data: { success: true } });

      await api.updateBusinessSettings('123', {
        delivery_fee_type: ' distance ',
        delivery_fee_flat_cents: 250,
        delivery_fee_per_km_cents: 125,
        delivery_radius_km: 7.5,
      } as any);

      expect(mockClient.put).toHaveBeenCalledWith('/businesses/123/settings', {
        delivery_fee_type: ' distance ',
        delivery_fee_flat_cents: 250,
        delivery_fee_per_km_cents: 125,
        delivery_radius_km: 7.5,
        delivery_type: 'distance',
        delivery_fee_cents: 250,
        delivery_per_km_cents: 125,
      });
    });

    it('rejects unsafe delivery settings before HTTP dispatch', async () => {
      await expect(api.updateBusinessSettings('123', {
        delivery_fee_type: 'flat\u0001',
      } as any)).rejects.toThrow('Delivery fee type contains unsafe control characters');
      await expect(api.updateBusinessSettings('123', {
        delivery_fee_type: 'flat\u202E',
      } as any)).rejects.toThrow('Delivery fee type contains unsafe control characters');
      await expect(api.updateBusinessSettings('123', {
        delivery_type: '\uFEFFflat',
      } as any)).rejects.toThrow('Delivery type contains unsafe control characters');
      await expect(api.updateBusinessSettings('123', {
        delivery_fee_flat_cents: Number.NaN,
      })).rejects.toThrow('Flat delivery fee must be a non-negative integer');
      await expect(api.updateBusinessSettings('123', {
        delivery_fee_per_km_cents: Number.MAX_SAFE_INTEGER + 1,
      })).rejects.toThrow('Delivery fee per kilometer must be a safe integer');
      await expect(api.updateBusinessSettings('123', {
        delivery_radius_km: Number.POSITIVE_INFINITY,
      })).rejects.toThrow('Delivery radius must be a non-negative finite number');

      expect(mockClient.put).not.toHaveBeenCalledWith(
        expect.stringContaining('/businesses/123/settings'),
        expect.anything()
      );
    });

    it('sanitizes public-menu delivery settings before checkout totals use them', () => {
      expect(sanitizePublicBusinessSettings({
        delivery_enabled: true,
        pickup_enabled: false,
        delivery_fee_type: ' flat ',
        delivery_fee_flat_cents: 299,
        minimum_order_cents: 1200,
        currency: ' usd ',
      } as any)).toEqual({
        delivery_enabled: true,
        pickup_enabled: false,
        delivery_fee_type: 'flat',
        delivery_fee_flat_cents: 299,
        minimum_order_cents: 1200,
        currency: 'USD',
      });

      expect(sanitizePublicBusinessSettings({
        delivery_enabled: true,
        pickup_enabled: true,
        delivery_fee_type: 'flat',
        delivery_fee_flat_cents: -1,
        minimum_order_cents: 0,
        currency: 'USD',
      })).toBeUndefined();
      expect(sanitizePublicBusinessSettings({
        delivery_enabled: true,
        pickup_enabled: true,
        delivery_fee_type: 'flat',
        delivery_fee_flat_cents: 100,
        minimum_order_cents: Number.NaN,
        currency: 'USD',
      })).toBeUndefined();
      expect(sanitizePublicBusinessSettings({
        delivery_enabled: true,
        pickup_enabled: true,
        delivery_fee_type: 'provider',
        delivery_fee_flat_cents: 100,
        minimum_order_cents: 0,
        currency: 'USD',
      } as any)).toBeUndefined();
      expect(sanitizePublicBusinessSettings({
        delivery_enabled: true,
        pickup_enabled: true,
        delivery_fee_type: 'free',
        delivery_fee_flat_cents: 0,
        minimum_order_cents: 0,
        currency: 'U\u0001D',
      })).toEqual({
        delivery_enabled: true,
        pickup_enabled: true,
        delivery_fee_type: 'free',
        delivery_fee_flat_cents: 0,
        minimum_order_cents: 0,
        currency: 'USD',
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

    it('normalizes order payloads before HTTP dispatch', async () => {
      mockClient.post.mockResolvedValue({ data: { success: true } });

      await api.createOrder({
        business_id: ' biz-123 ',
        customer_name: ' John ',
        customer_phone: ' 1234567890 ',
        customer_email: ' john@example.test ',
        delivery_type: ' delivery ' as any,
        delivery_address: ' 123 Main St ',
        delivery_distance_km: 3.5,
        items: [{ dish_id: ' dish-1 ', quantity: 2 }],
        notes: ' Leave at door ',
        payment_method: ' Cash ' as any,
      });

      expect(mockClient.post).toHaveBeenCalledWith('/orders', {
        business_id: 'biz-123',
        customer_name: 'John',
        customer_phone: '1234567890',
        customer_email: 'john@example.test',
        delivery_type: 'delivery',
        delivery_address: '123 Main St',
        delivery_distance_km: 3.5,
        items: [{ dish_id: 'dish-1', quantity: 2 }],
        notes: 'Leave at door',
        payment_method: 'cash',
      });
    });

    it('rejects unsafe order payloads before HTTP dispatch', async () => {
      await expect(api.createOrder({
        business_id: 'biz-123',
        customer_name: '\uFEFFJohn',
        customer_phone: '1234567890',
        delivery_type: 'pickup',
        items: [{ dish_id: 'dish-1', quantity: 1 }],
        payment_method: 'cash',
      })).rejects.toThrow('Customer name contains unsafe control characters');
      await expect(api.createOrder({
        business_id: 'biz\u0001123',
        customer_name: 'John',
        customer_phone: '1234567890',
        delivery_type: 'pickup',
        items: [{ dish_id: 'dish-1', quantity: 1 }],
        payment_method: 'cash',
      })).rejects.toThrow('Business ID contains unsafe control characters');
      await expect(api.createOrder({
        business_id: 'biz-123',
        customer_name: 'John',
        customer_phone: '1234567890',
        delivery_type: 'pickup',
        items: [{ dish_id: 'dish-\u200B1', quantity: 1 }],
        payment_method: 'cash',
      })).rejects.toThrow('Dish ID contains unsafe control characters');
      await expect(api.createOrder({
        business_id: 'biz-123',
        customer_name: 'John',
        customer_phone: '1234567890',
        delivery_type: 'drone' as any,
        items: [{ dish_id: 'dish-1', quantity: 1 }],
        payment_method: 'cash',
      })).rejects.toThrow('Delivery type must be pickup or delivery');
      await expect(api.createOrder({
        business_id: 'biz-123',
        customer_name: 'John',
        customer_phone: '1234567890',
        delivery_type: 'delivery',
        items: [{ dish_id: 'dish-1', quantity: 1 }],
        payment_method: 'cash',
      })).rejects.toThrow('Delivery address is required for delivery orders');
      await expect(api.createOrder({
        business_id: 'biz-123',
        customer_name: 'John',
        customer_phone: '1234567890',
        delivery_type: 'pickup',
        delivery_distance_km: Number.NaN,
        items: [{ dish_id: 'dish-1', quantity: 1 }],
        payment_method: 'cash',
      })).rejects.toThrow('Delivery distance must be a non-negative finite number');
      await expect(api.createOrder({
        business_id: 'biz-123',
        customer_name: 'John',
        customer_phone: '1234567890',
        delivery_type: 'pickup',
        items: [{ dish_id: 'dish-1', quantity: 0 }],
        payment_method: 'cash',
      })).rejects.toThrow('Item quantity must be between 1 and 100');
      await expect(api.createOrder({
        business_id: 'biz-123',
        customer_name: 'John',
        customer_phone: '1234567890',
        delivery_type: 'pickup',
        items: [{ dish_id: 'dish-1', quantity: 1 }],
        payment_method: 'bitcoin' as any,
      })).rejects.toThrow('Payment method must be cash, card, or online');

      expect(mockClient.post).not.toHaveBeenCalledWith('/orders', expect.anything());
    });

    it('calls getOrders endpoint with status filter', async () => {
      mockClient.get.mockResolvedValue({ data: { orders: [] } });

      await api.getOrders(' biz-123 ', ' Pending ');

      expect(mockClient.get).toHaveBeenCalledWith('/orders?businessId=biz-123&status=pending');
    });

    it('rejects unsafe getOrders filters before HTTP dispatch', async () => {
      await expect(api.getOrders('biz\u0001123', 'pending')).rejects.toThrow(
        'Business ID contains unsafe control characters'
      );
      await expect(api.getOrders('biz-123', '\uFEFFpending' as any)).rejects.toThrow(
        'Order status contains unsafe control characters'
      );
      await expect(api.getOrders('biz-123', 'archived')).rejects.toThrow(
        'Order status must be pending, confirmed, ready, fulfilled, or cancelled'
      );

      expect(mockClient.get).not.toHaveBeenCalledWith(expect.stringContaining('/orders?'));
    });

    it('calls updateOrderStatus endpoint', async () => {
      mockClient.put.mockResolvedValue({ data: { success: true } });

      await api.updateOrderStatus(' order-123 ', 'confirmed');

      expect(mockClient.put).toHaveBeenCalledWith('/orders/order-123/status', {
        status: 'confirmed',
      });
    });

    it('rejects unsafe order status updates before HTTP dispatch', async () => {
      await expect(api.updateOrderStatus('order\u0001123', 'confirmed')).rejects.toThrow(
        'Order ID contains unsafe control characters'
      );
      await expect(api.updateOrderStatus('order-123', 'confirmed\uFEFF' as any)).rejects.toThrow(
        'Order status contains unsafe control characters'
      );
      await expect(api.updateOrderStatus('order-123', 'shipped' as any)).rejects.toThrow(
        'Order status must be pending, confirmed, ready, fulfilled, or cancelled'
      );

      expect(mockClient.put).not.toHaveBeenCalledWith(expect.stringContaining('/orders/'), expect.anything());
    });

    it('normalizes customer order history filters before HTTP dispatch', async () => {
      mockClient.get.mockResolvedValue({ data: { orders: [] } });

      await api.getCustomerOrders({ status: ' Ready ', limit: 0, offset: 20 });

      expect(mockClient.get).toHaveBeenCalledWith('/orders/my-orders?status=ready&limit=0&offset=20');
    });

    it('rejects unsafe customer order history filters before HTTP dispatch', async () => {
      await expect(api.getCustomerOrders({ status: 'ready\u0001' })).rejects.toThrow(
        'Order status contains unsafe control characters'
      );
      await expect(api.getCustomerOrders({ status: '\uFEFFready' as any })).rejects.toThrow(
        'Order status contains unsafe control characters'
      );
      await expect(api.getCustomerOrders({ limit: -1 })).rejects.toThrow(
        'Order limit must be a non-negative integer'
      );
      await expect(api.getCustomerOrders({ offset: Number.MAX_SAFE_INTEGER + 1 })).rejects.toThrow(
        'Order offset must be a safe integer'
      );

      expect(mockClient.get).not.toHaveBeenCalledWith(expect.stringContaining('/orders/my-orders'));
    });

    it('normalizes cancellation reason before HTTP dispatch', async () => {
      mockClient.post.mockResolvedValue({ data: { success: true } });

      await api.cancelOrder(' order-123 ', ' Changed plans ');
      await api.cancelOrder('order-456', '   ');

      expect(mockClient.post).toHaveBeenCalledWith('/orders/order-123/cancel', {
        reason: 'Changed plans',
      });
      expect(mockClient.post).toHaveBeenCalledWith('/orders/order-456/cancel', {});
    });

    it('rejects unsafe cancellation payloads before HTTP dispatch', async () => {
      await expect(api.cancelOrder('order\u0001123', 'Changed plans')).rejects.toThrow(
        'Order ID contains unsafe control characters'
      );
      await expect(api.cancelOrder('order-123', 'Changed\u0001plans')).rejects.toThrow(
        'Cancellation reason contains unsafe control characters'
      );
      await expect(api.cancelOrder('order-123', '\uFEFFChanged plans')).rejects.toThrow(
        'Cancellation reason contains unsafe control characters'
      );

      expect(mockClient.post).not.toHaveBeenCalledWith(expect.stringContaining('/cancel'), expect.anything());
    });
  });

  describe('report and analytics endpoints', () => {
    it('normalizes order export filters before HTTP dispatch', async () => {
      mockClient.get.mockResolvedValue({ data: 'csv-data' });

      await api.exportOrdersToCSV(' biz-123 ', {
        startDate: ' 2025-01-01 ',
        endDate: ' 2025-01-31 ',
        status: ' Fulfilled ',
      });
      await api.exportOrders({
        businessId: ' biz-456 ',
        startDate: '2025-02-01',
        endDate: '2025-02-28',
        status: ' Ready ',
      });

      expect(mockClient.get).toHaveBeenCalledWith(
        '/reports/orders/export?businessId=biz-123&startDate=2025-01-01&endDate=2025-01-31&status=fulfilled',
        { responseType: 'blob' }
      );
      expect(mockClient.get).toHaveBeenCalledWith(
        '/reports/orders/export?businessId=biz-456&startDate=2025-02-01&endDate=2025-02-28&status=ready'
      );
    });

    it('rejects unsafe order export filters before HTTP dispatch', async () => {
      await expect(api.exportOrdersToCSV('biz\u0001123')).rejects.toThrow(
        'Business ID contains unsafe control characters'
      );
      await expect(api.exportOrdersToCSV('biz-123', { startDate: '2025-01-01\u0001' })).rejects.toThrow(
        'Start date contains unsafe control characters'
      );
      await expect(api.exportOrdersToCSV('biz-123', { startDate: '\uFEFF2025-01-01' })).rejects.toThrow(
        'Start date contains unsafe control characters'
      );
      await expect(api.exportOrdersToCSV('biz-123', { startDate: 'not-a-date' })).rejects.toThrow(
        'Start date must be a valid date'
      );
      await expect(api.exportOrders({
        businessId: 'biz-123',
        startDate: '2025-02-01',
        endDate: '2025-01-01',
      })).rejects.toThrow('Start date must be before or equal to end date');
      await expect(api.exportOrders({ businessId: 'biz-123', status: 'shipped' })).rejects.toThrow(
        'Order status must be pending, confirmed, ready, fulfilled, or cancelled'
      );

      expect(mockClient.get).not.toHaveBeenCalledWith(expect.stringContaining('/reports/orders/export'));
    });

    it('normalizes dashboard and analytics filters before HTTP dispatch', async () => {
      mockClient.get.mockResolvedValue({ data: { success: true } });

      await api.getDashboardStats(' biz-123 ', ' Week ' as any);
      await api.getComprehensiveAnalytics({
        businessId: ' biz-123 ',
        period: ' Custom ' as any,
        startDate: ' 2025-03-01 ',
        endDate: ' 2025-03-31 ',
      });

      expect(mockClient.get).toHaveBeenCalledWith('/reports/dashboard?businessId=biz-123&period=week');
      expect(mockClient.get).toHaveBeenCalledWith(
        '/reports/analytics?businessId=biz-123&period=custom&startDate=2025-03-01&endDate=2025-03-31'
      );
    });

    it('rejects unsafe dashboard and analytics filters before HTTP dispatch', async () => {
      await expect(api.getDashboardStats('biz-123', 'quarter' as any)).rejects.toThrow(
        'Dashboard period must be today, week, month, or all'
      );
      await expect(api.getDashboardStats('biz-123', 'week\u0001' as any)).rejects.toThrow(
        'Dashboard period contains unsafe control characters'
      );
      await expect(api.getDashboardStats('biz-123', '\uFEFFweek' as any)).rejects.toThrow(
        'Dashboard period contains unsafe control characters'
      );
      await expect(api.getComprehensiveAnalytics({
        businessId: 'biz-123',
        period: 'quarter' as any,
      })).rejects.toThrow('Analytics period must be today, week, month, or custom');
      await expect(api.getComprehensiveAnalytics({
        businessId: 'biz-123',
        period: 'custom\uFEFF' as any,
      })).rejects.toThrow('Analytics period contains unsafe control characters');
      await expect(api.getComprehensiveAnalytics({
        businessId: 'biz-123',
        startDate: '2025-04-30',
        endDate: '2025-04-01',
      })).rejects.toThrow('Start date must be before or equal to end date');

      expect(mockClient.get).not.toHaveBeenCalledWith(expect.stringContaining('/reports/dashboard'));
      expect(mockClient.get).not.toHaveBeenCalledWith(expect.stringContaining('/reports/analytics'));
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

  describe('basic referral endpoints', () => {
    it('uses implemented seller referral-code endpoint instead of disabled enhanced customer referrals', async () => {
      mockClient.get.mockResolvedValue({
        data: {
          success: true,
          data: {
            referral_code: 'ABCD1234',
            referral_link: 'https://app.test/signup?ref=ABCD1234',
          },
        },
      });

      await api.getMyReferralCode();

      expect(mockClient.get).toHaveBeenCalledWith('/referrals/users/me/referral-code');
      expect(mockClient.get).not.toHaveBeenCalledWith('/customers/referrals/stats');
    });

    it('uses implemented seller referral stats and history endpoints', async () => {
      mockClient.get.mockResolvedValue({ data: { success: true, data: {} } });

      await api.getMyReferralStats();
      await api.getMyReferrals({ limit: 10, offset: 20, status: 'first_menu_published' });
      await api.getMyReferrals({ limit: 0, offset: 0, status: ' First_Menu_Published ' });

      expect(mockClient.get).toHaveBeenCalledWith('/referrals/users/me/referrals/stats');
      expect(mockClient.get).toHaveBeenCalledWith(
        '/referrals/users/me/referrals?limit=10&offset=20&status=first_menu_published'
      );
      expect(mockClient.get).toHaveBeenCalledWith(
        '/referrals/users/me/referrals?limit=0&offset=0&status=first_menu_published'
      );
      expect(mockClient.get).not.toHaveBeenCalledWith(expect.stringContaining('/customers/referrals'));
    });

    it('rejects invalid seller referral history filters before HTTP dispatch', async () => {
      await expect(api.getMyReferrals({ limit: -1 })).rejects.toThrow(
        'Referral limit must be a non-negative integer'
      );
      await expect(api.getMyReferrals({ offset: Number.MAX_SAFE_INTEGER + 1 })).rejects.toThrow(
        'Referral offset must be a safe integer'
      );
      await expect(api.getMyReferrals({ status: 'reward_claimed' })).rejects.toThrow(
        'Referral status must be link_clicked, signup_completed, first_menu_published, or expired'
      );
      await expect(api.getMyReferrals({ status: 'first_menu\u0001published' })).rejects.toThrow(
        'Referral status contains unsafe control characters'
      );
      await expect(api.getMyReferrals({ status: 'first_menu\u202Epublished' })).rejects.toThrow(
        'Referral status contains unsafe control characters'
      );
      await expect(api.getMyReferrals({ status: '\uFEFFfirst_menu_published' })).rejects.toThrow(
        'Referral status contains unsafe control characters'
      );

      expect(mockClient.get).not.toHaveBeenCalledWith(expect.stringContaining('/referrals/users/me/referrals'));
    });

    it('sanitizes seller referral page code payloads before display or sharing', () => {
      expect(sanitizeReferralCodePayload({
        referral_code: ' ABCD1234 ',
        referral_link: ' https://app.test/signup?ref=ABCD1234 ',
        share_message: ' Share ABCD1234 ',
      })).toEqual({
        referral_code: 'ABCD1234',
        referral_link: 'https://app.test/signup?ref=ABCD1234',
        share_message: 'Share ABCD1234',
      });

      expect(sanitizeReferralCodePayload({
        referral_code: 'ABCD\u0001',
        referral_link: 'https://app.test/signup?ref=ABCD',
        share_message: 'Share ABCD',
      })).toBeNull();
      expect(sanitizeReferralCodePayload({
        referral_code: 'ABCD1234',
        referral_link: 'https://app.test/signup?ref=ABCD\u200B',
        share_message: 'Share ABCD',
      })).toBeNull();
      expect(sanitizeReferralCodePayload({
        referral_code: 'ABCD1234',
        referral_link: 'javascript:alert(1)',
        share_message: 'Share ABCD',
      })).toBeNull();
      expect(sanitizeReferralCodePayload({
        referral_code: 'ABCD1234',
        referral_link: 'https://app.test/signup?ref=ABCD',
        share_message: 'Share\u0002ABCD',
      })).toBeNull();
    });

    it('sanitizes seller referral stats before display', () => {
      expect(sanitizeReferralStats({
        total_referrals: 3,
        total_clicks: 5,
        total_signups: 2,
        total_published: 1,
        total_rewards_earned_cents: 9999,
        conversion_rate: 0.4,
      })).toEqual({
        total_referrals: 3,
        total_clicks: 5,
        total_signups: 2,
        total_published: 1,
        total_rewards_earned_cents: 0,
        conversion_rate: 0.4,
      });

      expect(sanitizeReferralStats({
        total_referrals: -1,
        total_clicks: 5,
        total_signups: 2,
        total_published: 1,
        total_rewards_earned_cents: 0,
        conversion_rate: 0.4,
      })).toBeNull();
      expect(sanitizeReferralStats({
        total_referrals: 3,
        total_clicks: 5,
        total_signups: Number.NaN,
        total_published: 1,
        total_rewards_earned_cents: 0,
        conversion_rate: 0.4,
      })).toBeNull();
      expect(sanitizeReferralStats({
        total_referrals: 3,
        total_clicks: 5,
        total_signups: 2,
        total_published: 1,
        total_rewards_earned_cents: 0,
        conversion_rate: 1.5,
      })).toBeNull();
      expect(sanitizeReferralStats({
        total_referrals: 3,
        total_clicks: 5,
        total_signups: 4,
        total_published: 1,
        total_rewards_earned_cents: 0,
        conversion_rate: 0.4,
      })).toBeNull();
      expect(sanitizeReferralStats({
        total_referrals: 5,
        total_clicks: 2,
        total_signups: 3,
        total_published: 1,
        total_rewards_earned_cents: 0,
        conversion_rate: 0.4,
      })).toBeNull();
      expect(sanitizeReferralStats({
        total_referrals: 3,
        total_clicks: 5,
        total_signups: 2,
        total_published: 3,
        total_rewards_earned_cents: 0,
        conversion_rate: 0.4,
      })).toBeNull();
      expect(sanitizeReferralStats({
        total_referrals: 3,
        total_clicks: 0,
        total_signups: 0,
        total_published: 0,
        total_rewards_earned_cents: 0,
        conversion_rate: 0.1,
      })).toBeNull();
      expect(sanitizeReferralStats({
        total_referrals: 3,
        total_clicks: 5,
        total_signups: 0,
        total_published: 0,
        total_rewards_earned_cents: 0,
        conversion_rate: 0.1,
      })).toBeNull();
      expect(sanitizeReferralStats({
        total_referrals: 3,
        total_clicks: 5,
        total_signups: 2,
        total_published: 1,
        total_rewards_earned_cents: 0,
        conversion_rate: 0.99,
      })).toBeNull();
    });
  });

  describe('subscription endpoints', () => {
    it('rejects getSubscriptionTiers locally while subscriptions are disabled', async () => {
      await expect(api.getSubscriptionTiers()).rejects.toMatchObject({
        code: 'FEATURE_UNAVAILABLE',
        status: 503,
        capability: 'subscriptions',
      });
      await expect(api.getSubscriptionTiers()).rejects.toBeInstanceOf(FeatureUnavailableError);

      expect(mockClient.get).not.toHaveBeenCalledWith('/subscriptions/tiers');
    });

    it('rejects getCurrentSubscription locally while subscriptions are disabled', async () => {
      await expect(api.getCurrentSubscription()).rejects.toMatchObject({
        code: 'FEATURE_UNAVAILABLE',
        capability: 'subscriptions',
      });

      expect(mockClient.get).not.toHaveBeenCalledWith('/subscriptions/current');
    });

    it('rejects createSubscription locally while subscriptions are disabled', async () => {
      await expect(api.createSubscription('pro', { trialDays: 14 })).rejects.toMatchObject({
        code: 'FEATURE_UNAVAILABLE',
        capability: 'subscriptions',
      });

      expect(mockClient.post).not.toHaveBeenCalledWith('/subscriptions/subscribe', expect.anything());
    });

    it('rejects subscription lifecycle actions locally while subscriptions are disabled', async () => {
      await expect(api.cancelSubscription(true)).rejects.toMatchObject({
        code: 'FEATURE_UNAVAILABLE',
        capability: 'subscriptions',
      });
      await expect(api.resumeSubscription()).rejects.toMatchObject({
        code: 'FEATURE_UNAVAILABLE',
        capability: 'subscriptions',
      });
      await expect(api.getSubscriptionPortal('https://example.test/return')).rejects.toMatchObject({
        code: 'FEATURE_UNAVAILABLE',
        capability: 'subscriptions',
      });
      await expect(api.getSubscriptionUsage()).rejects.toMatchObject({
        code: 'FEATURE_UNAVAILABLE',
        capability: 'subscriptions',
      });

      expect(mockClient.post).not.toHaveBeenCalledWith('/subscriptions/cancel', expect.anything());
      expect(mockClient.post).not.toHaveBeenCalledWith('/subscriptions/resume');
      expect(mockClient.get).not.toHaveBeenCalledWith(expect.stringContaining('/subscriptions/portal'));
      expect(mockClient.get).not.toHaveBeenCalledWith('/subscriptions/usage');
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

    it('calls put method', async () => {
      mockClient.put.mockResolvedValue({ data: { result: 'test' } });

      const result = await api.put('/custom-endpoint', { data: 'test' });

      expect(mockClient.put).toHaveBeenCalledWith('/custom-endpoint', { data: 'test' }, undefined);
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

    it('rejects disabled capability route families before generic direct API calls', async () => {
      await expect(api.get('/subscriptions/current')).rejects.toMatchObject({
        code: 'FEATURE_UNAVAILABLE',
        capability: 'subscriptions',
      });
      await expect(api.post('/ocr/extract-from-text', { menu_text: 'Samosa ₹20' })).rejects.toMatchObject({
        code: 'FEATURE_UNAVAILABLE',
        capability: 'ocr_import',
      });
      await expect(api.patch('/api/v1/tax/invoices/order-1')).rejects.toMatchObject({
        code: 'FEATURE_UNAVAILABLE',
        capability: 'tax_reporting',
      });
      await expect(api.delete('https://example.test/api/v1/delivery/integrations/current')).rejects.toMatchObject({
        code: 'FEATURE_UNAVAILABLE',
        capability: 'delivery_partner',
      });
      await expect(api.post('/pos/integrations', {})).rejects.toMatchObject({
        code: 'FEATURE_UNAVAILABLE',
        capability: 'pos_sync',
      });
      await expect(api.put('/api/v1/subscriptions/current', { tier: 'pro' })).rejects.toMatchObject({
        code: 'FEATURE_UNAVAILABLE',
        capability: 'subscriptions',
      });
      await expect(api.get('/leaderboard/referrals')).rejects.toMatchObject({
        code: 'FEATURE_UNAVAILABLE',
        capability: 'enhanced_referrals_affiliates',
      });
      await expect(api.get('/api/v1/referrals/leaderboard/me')).rejects.toMatchObject({
        code: 'FEATURE_UNAVAILABLE',
        capability: 'enhanced_referrals_affiliates',
      });
      await expect(api.post('/api/v1/affiliates/track/BLOGGER', {})).rejects.toMatchObject({
        code: 'FEATURE_UNAVAILABLE',
        capability: 'enhanced_referrals_affiliates',
      });
      await expect(api.post('/customers/referrals/create', { business_id: 'business-1' })).rejects.toMatchObject({
        code: 'FEATURE_UNAVAILABLE',
        capability: 'enhanced_referrals_affiliates',
      });
      await expect(api.post('/referrals/share/instagram', {
        referral_code: 'ABCD1234',
        business_name: 'Cafe Blue',
      })).rejects.toMatchObject({
        code: 'FEATURE_UNAVAILABLE',
        capability: 'enhanced_referrals_affiliates',
      });
      await expect(api.get('/badges/me')).rejects.toMatchObject({
        code: 'FEATURE_UNAVAILABLE',
        capability: 'enhanced_referrals_affiliates',
      });
      await expect(api.get('/Subscriptions/current')).rejects.toMatchObject({
        code: 'FEATURE_UNAVAILABLE',
        capability: 'subscriptions',
      });
      await expect(api.post('/API/v1/OCR/extract-from-text', { menu_text: 'Samosa ₹20' })).rejects.toMatchObject({
        code: 'FEATURE_UNAVAILABLE',
        capability: 'ocr_import',
      });
      await expect(api.patch('/Api/V1/Tax/invoices/order-1')).rejects.toMatchObject({
        code: 'FEATURE_UNAVAILABLE',
        capability: 'tax_reporting',
      });

      expect(mockClient.get).not.toHaveBeenCalledWith(expect.stringMatching(/^\/subscriptions|^\/leaderboard/), expect.anything());
      expect(mockClient.get).not.toHaveBeenCalledWith(expect.stringContaining('/Subscriptions'), expect.anything());
      expect(mockClient.get).not.toHaveBeenCalledWith(expect.stringMatching(/^\/badges/), expect.anything());
      expect(mockClient.get).not.toHaveBeenCalledWith(expect.stringContaining('/referrals/leaderboard'), expect.anything());
      expect(mockClient.post).not.toHaveBeenCalledWith(expect.stringMatching(/^\/ocr|^\/pos|^\/referrals\/share/), expect.anything(), expect.anything());
      expect(mockClient.post).not.toHaveBeenCalledWith(expect.stringContaining('/OCR'), expect.anything(), expect.anything());
      expect(mockClient.post).not.toHaveBeenCalledWith(expect.stringContaining('/affiliates'), expect.anything(), expect.anything());
      expect(mockClient.post).not.toHaveBeenCalledWith(expect.stringContaining('/customers/referrals'), expect.anything(), expect.anything());
      expect(mockClient.put).not.toHaveBeenCalledWith(expect.stringContaining('/subscriptions'), expect.anything(), expect.anything());
      expect(mockClient.patch).not.toHaveBeenCalledWith(expect.stringContaining('/tax'), expect.anything(), expect.anything());
      expect(mockClient.patch).not.toHaveBeenCalledWith(expect.stringContaining('/Tax'), expect.anything(), expect.anything());
      expect(mockClient.delete).not.toHaveBeenCalledWith(expect.stringContaining('/delivery'), expect.anything());
    });

    it('rejects unsafe generic API route URLs before disabled-route parsing or network dispatch', async () => {
      await expect(api.get('/subscriptions\u200D/current')).rejects.toThrow(
        'API route URL contains unsafe control characters'
      );
      await expect(api.post('/ocr/extract-from-text\u202E', { menu_text: 'Samosa ₹20' })).rejects.toThrow(
        'API route URL contains unsafe control characters'
      );
      await expect(api.put('/api/v1/tax/invoices\uFEFF/order-1', {})).rejects.toThrow(
        'API route URL contains unsafe control characters'
      );

      expect(mockClient.get).not.toHaveBeenCalledWith(expect.stringContaining('/subscriptions'), expect.anything());
      expect(mockClient.post).not.toHaveBeenCalledWith(expect.stringContaining('/ocr'), expect.anything(), expect.anything());
      expect(mockClient.put).not.toHaveBeenCalledWith(expect.stringContaining('/tax'), expect.anything(), expect.anything());
    });

    it('rejects percent-encoded unsafe generic API route paths before disabled-route parsing or network dispatch', async () => {
      await expect(api.get('/subscriptions%E2%80%8D/current')).rejects.toThrow(
        'API route path contains unsafe control characters'
      );
      await expect(api.post('/ocr/extract-from-text%E2%80%AE', { menu_text: 'Samosa ₹20' })).rejects.toThrow(
        'API route path contains unsafe control characters'
      );
      await expect(api.put('/api/v1/tax/invoices%EF%BB%BF/order-1', {})).rejects.toThrow(
        'API route path contains unsafe control characters'
      );

      expect(mockClient.get).not.toHaveBeenCalledWith(expect.stringContaining('/subscriptions'), expect.anything());
      expect(mockClient.post).not.toHaveBeenCalledWith(expect.stringContaining('/ocr'), expect.anything(), expect.anything());
      expect(mockClient.put).not.toHaveBeenCalledWith(expect.stringContaining('/tax'), expect.anything(), expect.anything());
    });

    it('rejects malformed percent-encoded generic API route paths before network dispatch', async () => {
      await expect(api.get('/subscriptions%E2%80%ZZ/current')).rejects.toThrow(
        'API route URL path must be valid percent-encoding'
      );

      expect(mockClient.get).not.toHaveBeenCalledWith(expect.stringContaining('/subscriptions'), expect.anything());
    });

    it('rejects relative generic API route path segments before disabled-route parsing or network dispatch', async () => {
      await expect(api.get('/api/v1/%2e%2e/subscriptions/current')).rejects.toThrow(
        'API route path must not include relative path segments'
      );
      await expect(api.post('/ocr/%2e/extract-from-text', { menu_text: 'Samosa ₹20' })).rejects.toThrow(
        'API route path must not include relative path segments'
      );

      expect(mockClient.get).not.toHaveBeenCalledWith(expect.stringContaining('/subscriptions'), expect.anything());
      expect(mockClient.post).not.toHaveBeenCalledWith(expect.stringContaining('/ocr'), expect.anything(), expect.anything());
    });
  });
});
