import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '../services/api';

interface User {
  id: string;
  email: string;
  role?: string;
  created_at: string;
}

export const ADMIN_OPERATOR_ROLES = new Set(['admin', 'super_admin', 'moderator', 'support_agent']);

export function isAdminOperator(user: User | null | undefined): boolean {
  return Boolean(user?.role && ADMIN_OPERATOR_ROLES.has(user.role));
}

interface AuthState {
  user: User | null;
  /** Memory-only access token. Never persisted to browser storage. */
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
          throw _error;
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
          throw _error;
        }
      },

      logout: () => {
        void Promise.resolve(api.logout()).catch(() => undefined);
        api.setAccessToken(null);
        set({
          user: null,
          accessToken: null,
          isAuthenticated: false,
        });
      },

      initAuth: async () => {
        try {
          const response = await api.getCurrentUser();

          if (response.success) {
            set({
              user: response.data.user,
              isAuthenticated: true,
            });
          }
        } catch (_error) {
          api.setAccessToken(null);
          set({ user: null, accessToken: null, isAuthenticated: false });
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
