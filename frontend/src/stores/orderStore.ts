import { create } from 'zustand';
import { api } from '../services/api';

interface OrderItem {
  id: string;
  dish_id: string;
  quantity: number;
  price_at_purchase_cents: number;
  dish?: {
    name: string;
    image_url?: string;
  };
}

interface Order {
  id: string;
  business_id: string;
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  delivery_type: 'delivery' | 'pickup';
  delivery_address?: string;
  delivery_distance_km?: number;
  delivery_fee_cents: number;
  total_cents: number;
  payment_method: 'cash' | 'card' | 'online';
  payment_status: 'pending' | 'paid' | 'refunded';
  order_status: 'pending' | 'confirmed' | 'ready' | 'fulfilled' | 'cancelled';
  notes?: string;
  items?: OrderItem[];
  fulfilled_at?: string;
  created_at: string;
  updated_at: string;
}

interface OrderState {
  orders: Order[];
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchOrders: (businessId: string, status?: string) => Promise<void>;
  getOrderById: (id: string) => Promise<Order | null>;
  updateOrderStatus: (
    id: string,
    status: 'pending' | 'confirmed' | 'ready' | 'fulfilled' | 'cancelled'
  ) => Promise<void>;
  reset: () => void;
}

export const useOrderStore = create<OrderState>((set, get) => ({
  orders: [],
  isLoading: false,
  error: null,

  fetchOrders: async (businessId: string, status?: string) => {
    try {
      set({ isLoading: true, error: null });
      const response = await api.getOrders(businessId, status);

      if (response.success) {
        set({
          orders: response.data.orders,
          isLoading: false,
        });
      }
    } catch (error: any) {
      set({
        isLoading: false,
        error: error.response?.data?.error?.message || 'Failed to fetch orders',
      });
    }
  },

  getOrderById: async (id: string) => {
    try {
      const response = await api.getOrderById(id);

      if (response.success) {
        return response.data.order;
      }
      return null;
    } catch (error: any) {
      console.error('Failed to fetch order:', error);
      return null;
    }
  },

  updateOrderStatus: async (id: string, status) => {
    try {
      set({ isLoading: true, error: null });
      const response = await api.updateOrderStatus(id, status);

      if (response.success) {
        set((state) => ({
          orders: state.orders.map((order) =>
            order.id === id ? response.data.order : order
          ),
          isLoading: false,
        }));
      }
    } catch (error: any) {
      set({
        isLoading: false,
        error: error.response?.data?.error?.message || 'Failed to update order status',
      });
      throw error;
    }
  },

  reset: () => {
    set({
      orders: [],
      isLoading: false,
      error: null,
    });
  },
}));
