import { describe, expect, it, vi } from 'vitest';
import NotificationItem from './NotificationItem';

const mockMarkAsRead = vi.fn();
const mockNavigate = vi.fn();
const mockOnClose = vi.fn();

vi.mock('../../stores/notificationStore', () => ({
  useNotificationStore: () => ({
    markAsRead: mockMarkAsRead,
  }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

describe('NotificationItem', () => {
  it('marks as read and navigates for order update notifications', async () => {
    const notification = {
      id: 'n1',
      user_id: 'u1',
      type: 'order_update' as const,
      title: 'Order update',
      message: 'Order confirmed',
      is_read: false,
      data: { order_id: 'o1' },
      created_at: new Date().toISOString(),
    };

    const element = NotificationItem({ notification, onClose: mockOnClose });

    // invoke click handler on the rendered div
    await element.props.onClick();

    expect(mockMarkAsRead).toHaveBeenCalledWith('n1');
    expect(mockNavigate).toHaveBeenCalledWith('/orders/o1');
    expect(mockOnClose).toHaveBeenCalled();
  });
});
