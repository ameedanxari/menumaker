// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import NotificationBell from './NotificationBell';

const mockFetchUnreadCount = vi.fn();
const mockFetchNotifications = vi.fn();

vi.mock('../../stores/notificationStore', () => ({
  useNotificationStore: () => ({
    unreadCount: 5,
    fetchUnreadCount: mockFetchUnreadCount,
    fetchNotifications: mockFetchNotifications,
    notifications: [],
    isLoading: false,
    markAllAsRead: vi.fn(),
  }),
}));

describe('NotificationBell', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('renders bell icon', () => {
    render(<NotificationBell />);
    expect(screen.getByRole('button', { name: /notifications/i })).toBeDefined();
  });

  it('shows unread count badge', () => {
    render(<NotificationBell />);
    expect(screen.getByText('5')).toBeDefined();
  });

  it('fetches unread count on mount', () => {
    render(<NotificationBell />);
    expect(mockFetchUnreadCount).toHaveBeenCalled();
  });

  it('polls for notifications every 30 seconds', () => {
    render(<NotificationBell />);
    
    // Initial call
    expect(mockFetchUnreadCount).toHaveBeenCalledTimes(1);
    
    // Advance 30 seconds
    vi.advanceTimersByTime(30000);
    expect(mockFetchUnreadCount).toHaveBeenCalledTimes(2);
    
    // Advance another 30 seconds
    vi.advanceTimersByTime(30000);
    expect(mockFetchUnreadCount).toHaveBeenCalledTimes(3);
  });

  it('opens dropdown on click', () => {
    render(<NotificationBell />);
    
    fireEvent.click(screen.getByRole('button', { name: /notifications/i }));
    
    expect(mockFetchNotifications).toHaveBeenCalledWith({ limit: 20 });
  });

  it('toggles dropdown on click', () => {
    render(<NotificationBell />);
    const button = screen.getByRole('button', { name: /notifications/i });
    
    // Open
    fireEvent.click(button);
    expect(mockFetchNotifications).toHaveBeenCalled();
    
    // Close
    fireEvent.click(button);
    // Dropdown should be closed (no additional fetch)
    expect(mockFetchNotifications).toHaveBeenCalledTimes(1);
  });
});
