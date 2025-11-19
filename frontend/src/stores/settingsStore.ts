import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '../services/api';

interface UserSettings {
  id: string;
  user_id: string;
  language: string;
  notifications_enabled: boolean;
  order_notifications: boolean;
  promotion_notifications: boolean;
  review_notifications: boolean;
  biometric_enabled: boolean;
  theme: string;
  created_at: string;
  updated_at: string;
}

interface SettingsState {
  settings: UserSettings | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchSettings: () => Promise<void>;
  updateSettings: (updates: Partial<UserSettings>) => Promise<void>;
  reset: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      settings: null,
      isLoading: false,
      error: null,

      fetchSettings: async () => {
        try {
          set({ isLoading: true, error: null });
          const response = await api.getUserSettings();

          if (response.success) {
            set({
              settings: response.data.settings,
              isLoading: false,
            });
          }
        } catch (error: any) {
          set({
            isLoading: false,
            error: error.response?.data?.error?.message || 'Failed to fetch settings',
          });
        }
      },

      updateSettings: async (updates) => {
        try {
          set({ isLoading: true, error: null });
          const response = await api.updateUserSettings(updates);

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

      reset: () => {
        set({
          settings: null,
          isLoading: false,
          error: null,
        });
      },
    }),
    {
      name: 'settings-storage',
      partialize: (state) => ({
        settings: state.settings,
      }),
    }
  )
);
