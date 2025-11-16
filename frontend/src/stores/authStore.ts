import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '../services/api';

interface User {
  id: string;
  email: string;
  created_at: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Actions
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => void;
  initAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: false,

      login: async (email: string, password: string) => {
        try {
          set({ isLoading: true });
          const response = await api.login(email, password);

          if (response.success) {
            const { user, tokens } = response.data;
            api.setAccessToken(tokens.accessToken);
            set({
              user,
              accessToken: tokens.accessToken,
              isAuthenticated: true,
              isLoading: false,
            });
          }
        } catch (_error) {
          set({ isLoading: false });
          throw error;
        }
      },

      signup: async (email: string, password: string) => {
        try {
          set({ isLoading: true });
          const response = await api.signup(email, password);

          if (response.success) {
            const { user, tokens } = response.data;
            api.setAccessToken(tokens.accessToken);
            set({
              user,
              accessToken: tokens.accessToken,
              isAuthenticated: true,
              isLoading: false,
            });
          }
        } catch (_error) {
          set({ isLoading: false });
          throw error;
        }
      },

      logout: () => {
        api.setAccessToken(null);
        set({
          user: null,
          accessToken: null,
          isAuthenticated: false,
        });
      },

      initAuth: async () => {
        const { accessToken } = get();

        if (accessToken) {
          try {
            api.setAccessToken(accessToken);
            const response = await api.getCurrentUser();

            if (response.success) {
              set({
                user: response.data.user,
                isAuthenticated: true,
              });
            }
          } catch (_error) {
            // Token is invalid, clear auth state
            get().logout();
          }
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
