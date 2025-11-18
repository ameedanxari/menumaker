import { create } from 'zustand';
import { api } from '../services/api';

interface Notification {
  id: string;
  user_id: string;
  type: 'order_update' | 'promotion' | 'review' | 'system';
  title: string;
  message: string;
  is_read: boolean;
  data?: Record<string, any>;
  created_at: string;
}

interface NotificationState {
  notifications: Notification[];
  total: number;
  unreadCount: number;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchNotifications: (params?: { limit?: number; offset?: number; unread_only?: boolean }) => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  fetchUnreadCount: () => Promise<void>;
  reset: () => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  total: 0,
  unreadCount: 0,
  isLoading: false,
  error: null,

  fetchNotifications: async (params) => {
    try {
      set({ isLoading: true, error: null });
      const response = await api.getNotifications(params);

      if (response.success) {
        set({
          notifications: response.data.notifications,
          total: response.data.total,
          isLoading: false,
        });
      }
    } catch (error: any) {
      set({
        isLoading: false,
        error: error.response?.data?.error?.message || 'Failed to fetch notifications',
      });
    }
  },

  markAsRead: async (id: string) => {
    try {
      const response = await api.markNotificationAsRead(id, true);

      if (response.success) {
        set((state) => ({
          notifications: state.notifications.map((notif) =>
            notif.id === id ? { ...notif, is_read: true } : notif
          ),
          unreadCount: Math.max(0, state.unreadCount - 1),
        }));
      }
    } catch (error: any) {
      console.error('Failed to mark notification as read:', error);
    }
  },

  markAllAsRead: async () => {
    try {
      const response = await api.markAllNotificationsAsRead();

      if (response.success) {
        set((state) => ({
          notifications: state.notifications.map((notif) => ({ ...notif, is_read: true })),
          unreadCount: 0,
        }));
      }
    } catch (error: any) {
      console.error('Failed to mark all notifications as read:', error);
    }
  },

  fetchUnreadCount: async () => {
    try {
      const response = await api.getUnreadNotificationCount();

      if (response.success) {
        set({ unreadCount: response.data.count });
      }
    } catch (error: any) {
      console.error('Failed to fetch unread count:', error);
    }
  },

  reset: () => {
    set({
      notifications: [],
      total: 0,
      unreadCount: 0,
      isLoading: false,
      error: null,
    });
  },
}));
