import { create } from 'zustand';
import { api } from '../services/api';

interface Business {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  description?: string;
  address?: string;
  phone?: string;
  email?: string;
  logo_url?: string;
  banner_url?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface BusinessSettings {
  id: string;
  business_id: string;
  delivery_enabled: boolean;
  pickup_enabled: boolean;
  delivery_fee_type: 'flat' | 'distance' | 'free';
  delivery_fee_flat_cents: number;
  delivery_fee_per_km_cents: number;
  delivery_radius_km: number;
  minimum_order_cents: number;
  currency: string;
  timezone: string;
  business_hours?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

interface BusinessState {
  currentBusiness: Business | null;
  businesses: Business[];
  settings: BusinessSettings | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchBusinesses: () => Promise<void>;
  createBusiness: (data: {
    name: string;
    description?: string;
    address?: string;
    phone?: string;
    email?: string;
  }) => Promise<Business>;
  updateBusiness: (
    id: string,
    data: Partial<{
      name: string;
      description: string;
      address: string;
      phone: string;
      email: string;
      logo_url: string;
      banner_url: string;
    }>
  ) => Promise<void>;
  updateSettings: (
    businessId: string,
    settings: Partial<{
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
    }>
  ) => Promise<void>;
  setCurrentBusiness: (business: Business | null) => void;
  reset: () => void;
}

export const useBusinessStore = create<BusinessState>((set, _get) => ({
  currentBusiness: null,
  businesses: [],
  settings: null,
  isLoading: false,
  error: null,

  fetchBusinesses: async () => {
    try {
      set({ isLoading: true, error: null });
      const response = await api.getBusinesses();

      if (response.success) {
        const businesses = response.data.businesses;
        set({
          businesses,
          currentBusiness: businesses.length > 0 ? businesses[0] : null,
          isLoading: false,
        });

        // Fetch settings if we have a current business
        if (businesses.length > 0 && businesses[0].settings) {
          set({ settings: businesses[0].settings });
        }
      }
    } catch (error: any) {
      set({
        isLoading: false,
        error: error.response?.data?.error?.message || 'Failed to fetch businesses',
      });
    }
  },

  createBusiness: async (data) => {
    try {
      set({ isLoading: true, error: null });
      const response = await api.createBusiness(data);

      if (response.success) {
        const newBusiness = response.data.business;
        set((state) => ({
          businesses: [...state.businesses, newBusiness],
          currentBusiness: newBusiness,
          settings: response.data.business.settings || null,
          isLoading: false,
        }));
        return newBusiness;
      }
      throw new Error('Failed to create business');
    } catch (error: any) {
      set({
        isLoading: false,
        error: error.response?.data?.error?.message || 'Failed to create business',
      });
      throw error;
    }
  },

  updateBusiness: async (id, data) => {
    try {
      set({ isLoading: true, error: null });
      const response = await api.updateBusiness(id, data);

      if (response.success) {
        const updatedBusiness = response.data.business;
        set((state) => ({
          businesses: state.businesses.map((b) =>
            b.id === id ? updatedBusiness : b
          ),
          currentBusiness:
            state.currentBusiness?.id === id
              ? updatedBusiness
              : state.currentBusiness,
          isLoading: false,
        }));
      }
    } catch (error: any) {
      set({
        isLoading: false,
        error: error.response?.data?.error?.message || 'Failed to update business',
      });
      throw error;
    }
  },

  updateSettings: async (businessId, settings) => {
    try {
      set({ isLoading: true, error: null });
      const response = await api.updateBusinessSettings(businessId, settings);

      if (response.success) {
        set({
          settings: response.data.settings,
          isLoading: false,
        });
      }
    } catch (error: any) {
      set({
        isLoading: false,
        error: error.response?.data?.error?.message || 'Failed to update settings',
      });
      throw error;
    }
  },

  setCurrentBusiness: (business) => {
    set({ currentBusiness: business });
  },

  reset: () => {
    set({
      currentBusiness: null,
      businesses: [],
      settings: null,
      isLoading: false,
      error: null,
    });
  },
}));
