import { useNotificationStore } from '../../stores/notificationStore';
import { ShoppingBag, Tag, Star, Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

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

interface NotificationItemProps {
  notification: Notification;
  onClose: () => void;
}

export default function NotificationItem({ notification, onClose }: NotificationItemProps) {
  const { markAsRead } = useNotificationStore();
  const navigate = useNavigate();

  const getIcon = () => {
    switch (notification.type) {
      case 'order_update':
        return <ShoppingBag className="w-5 h-5 text-blue-600" />;
      case 'promotion':
        return <Tag className="w-5 h-5 text-green-600" />;
      case 'review':
        return <Star className="w-5 h-5 text-yellow-600" />;
      default:
        return <Bell className="w-5 h-5 text-gray-600" />;
    }
  };

  const handleClick = async () => {
    if (!notification.is_read) {
      await markAsRead(notification.id);
    }

    // Navigate based on notification type
    if (notification.type === 'order_update' && notification.data?.order_id) {
      navigate(`/orders/${notification.data.order_id}`);
      onClose();
    }
  };

  const getRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div
      onClick={handleClick}
      className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
        !notification.is_read ? 'bg-blue-50' : ''
      }`}
    >
      <div className="flex gap-3">
        <div className="flex-shrink-0 mt-1">{getIcon()}</div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm ${!notification.is_read ? 'font-semibold' : 'font-medium'} text-gray-900`}>
            {notification.title}
          </p>
          <p className="text-sm text-gray-600 mt-1">{notification.message}</p>
          <p className="text-xs text-gray-500 mt-2">{getRelativeTime(notification.created_at)}</p>
        </div>
        {!notification.is_read && (
          <div className="flex-shrink-0">
            <div className="w-2 h-2 bg-primary-600 rounded-full"></div>
          </div>
        )}
      </div>
    </div>
  );
}
