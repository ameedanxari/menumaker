import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useNotificationStore } from './notificationStore';
import { api } from '../services/api';

vi.mock('../services/api', () => ({
  api: {
    getNotifications: vi.fn(),
    markNotificationAsRead: vi.fn(),
    markAllNotificationsAsRead: vi.fn(),
    getUnreadNotificationCount: vi.fn(),
  },
}));

const mockedApi = api as unknown as {
  getNotifications: ReturnType<typeof vi.fn>;
  markNotificationAsRead: ReturnType<typeof vi.fn>;
  markAllNotificationsAsRead: ReturnType<typeof vi.fn>;
  getUnreadNotificationCount: ReturnType<typeof vi.fn>;
};

const resetStore = () => {
  useNotificationStore.setState({
    notifications: [],
    total: 0,
    unreadCount: 0,
    isLoading: false,
    error: null,
  });
};

describe('notificationStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
  });

  it('fetches notifications', async () => {
    mockedApi.getNotifications.mockResolvedValue({
      success: true,
      data: {
        notifications: [{ id: 'n1', user_id: 'u1', type: 'system', title: 'Hello', message: 'World', is_read: false, created_at: '' }],
        total: 1,
      },
    });

    await useNotificationStore.getState().fetchNotifications();

    expect(useNotificationStore.getState().notifications).toHaveLength(1);
    expect(useNotificationStore.getState().total).toBe(1);
    expect(useNotificationStore.getState().isLoading).toBe(false);
  });

  it('marks single notification as read and decrements unread', async () => {
    useNotificationStore.setState({
      notifications: [{ id: 'n1', user_id: 'u1', type: 'system', title: 'Hello', message: 'World', is_read: false, created_at: '' }],
      total: 1,
      unreadCount: 1,
      isLoading: false,
      error: null,
    });
    mockedApi.markNotificationAsRead.mockResolvedValue({ success: true });

    await useNotificationStore.getState().markAsRead('n1');

    expect(useNotificationStore.getState().notifications[0]?.is_read).toBe(true);
    expect(useNotificationStore.getState().unreadCount).toBe(0);
  });

  it('marks all notifications as read', async () => {
    useNotificationStore.setState({
      notifications: [
        { id: 'n1', user_id: 'u1', type: 'system', title: 'Hello', message: 'World', is_read: false, created_at: '' },
        { id: 'n2', user_id: 'u1', type: 'system', title: 'Hi', message: 'Again', is_read: false, created_at: '' },
      ],
      total: 2,
      unreadCount: 2,
      isLoading: false,
      error: null,
    });
    mockedApi.markAllNotificationsAsRead.mockResolvedValue({ success: true });

    await useNotificationStore.getState().markAllAsRead();

    expect(useNotificationStore.getState().notifications.every((n) => n.is_read)).toBe(true);
    expect(useNotificationStore.getState().unreadCount).toBe(0);
  });

  it('updates unread count from server', async () => {
    mockedApi.getUnreadNotificationCount.mockResolvedValue({ success: true, data: { count: 3 } });

    await useNotificationStore.getState().fetchUnreadCount();

    expect(useNotificationStore.getState().unreadCount).toBe(3);
  });
});
