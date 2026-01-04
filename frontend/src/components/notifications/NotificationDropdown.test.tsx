import { describe, expect, it, vi } from 'vitest';
import NotificationDropdown from './NotificationDropdown';

const mockMarkAllAsRead = vi.fn();
const mockOnClose = vi.fn();

vi.mock('../../stores/notificationStore', () => ({
  useNotificationStore: () => ({
    notifications: [
      { id: 'n1', user_id: 'u1', type: 'system', title: 'Hello', message: 'World', is_read: false, created_at: new Date().toISOString() },
    ],
    isLoading: false,
    unreadCount: 1,
    markAllAsRead: mockMarkAllAsRead,
  }),
}));

// Helper to find the first element of a given type in a React element tree
const findNodeByType = (node: any, type: any): any | null => {
  if (!node) return null;
  if (node.type === type) return node;
  const children = node.props?.children;
  if (Array.isArray(children)) {
    for (const child of children) {
      const found = findNodeByType(child, type);
      if (found) return found;
    }
  } else if (children) {
    return findNodeByType(children, type);
  }
  return null;
};

describe('NotificationDropdown', () => {
  it('renders unread action and triggers mark all read', async () => {
    const element = NotificationDropdown({ onClose: mockOnClose });
    const button = findNodeByType(element, 'button');
    expect(button).toBeTruthy();

    await button.props.onClick();
    expect(mockMarkAllAsRead).toHaveBeenCalled();
  });
});
