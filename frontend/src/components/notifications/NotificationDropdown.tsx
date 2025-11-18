import { useNotificationStore } from '../../stores/notificationStore';
import NotificationItem from './NotificationItem';
import { Check } from 'lucide-react';

interface NotificationDropdownProps {
  onClose: () => void;
}

export default function NotificationDropdown({ onClose }: NotificationDropdownProps) {
  const { notifications, isLoading, markAllAsRead, unreadCount } = useNotificationStore();

  const handleMarkAllRead = async () => {
    await markAllAsRead();
  };

  return (
    <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Notifications</h3>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
            >
              <Check className="w-4 h-4" />
              Mark all read
            </button>
          )}
        </div>
      </div>

      <div className="max-h-96 overflow-y-auto">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="inline-block w-8 h-8 border-4 border-gray-200 border-t-primary-600 rounded-full animate-spin"></div>
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <p>No notifications</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {notifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onClose={onClose}
              />
            ))}
          </div>
        )}
      </div>

      {notifications.length > 0 && (
        <div className="p-3 border-t border-gray-200 text-center">
          <a
            href="/notifications"
            className="text-sm text-primary-600 hover:text-primary-700 font-medium"
            onClick={onClose}
          >
            View all notifications
          </a>
        </div>
      )}
    </div>
  );
}
