import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { ShoppingBag, Loader2, Package, Truck, CheckCircle, XCircle, Clock } from 'lucide-react';

interface Order {
  id: string;
  business_id: string;
  customer_name: string;
  customer_phone: string;
  delivery_type: 'delivery' | 'pickup';
  delivery_address?: string;
  delivery_fee_cents: number;
  total_cents: number;
  payment_method: 'cash' | 'card' | 'online';
  payment_status: 'pending' | 'paid' | 'refunded';
  order_status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'out_for_delivery' | 'delivered' | 'fulfilled' | 'cancelled';
  notes?: string;
  items?: Array<{
    id: string;
    dish_id: string;
    quantity: number;
    price_at_purchase_cents: number;
    dish?: {
      name: string;
      image_url?: string;
    };
  }>;
  estimated_delivery_time?: string;
  created_at: string;
  updated_at: string;
}

export default function MyOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);

  const fetchOrders = async (status?: string) => {
    try {
      setIsLoading(true);
      setError('');
      const response = await api.getCustomerOrders({ status, limit: 50 });

      if (response.success) {
        setOrders(response.data.orders);
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to fetch orders');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders(selectedStatus || undefined);
  }, [selectedStatus]);

  const handleCancelOrder = async (orderId: string) => {
    if (!confirm('Are you sure you want to cancel this order?')) {
      return;
    }

    try {
      setCancellingOrderId(orderId);
      const response = await api.cancelOrder(orderId);

      if (response.success) {
        // Refresh orders
        fetchOrders(selectedStatus || undefined);
      }
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to cancel order');
    } finally {
      setCancellingOrderId(null);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
      case 'confirmed':
      case 'preparing':
        return <Clock className="w-5 h-5 text-blue-600" />;
      case 'ready':
        return <Package className="w-5 h-5 text-orange-600" />;
      case 'out_for_delivery':
        return <Truck className="w-5 h-5 text-purple-600" />;
      case 'delivered':
      case 'fulfilled':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'cancelled':
        return <XCircle className="w-5 h-5 text-red-600" />;
      default:
        return <ShoppingBag className="w-5 h-5 text-gray-600" />;
    }
  };

  const getStatusText = (status: string) => {
    return status.split('_').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
      case 'confirmed':
      case 'preparing':
        return 'bg-blue-100 text-blue-800';
      case 'ready':
        return 'bg-orange-100 text-orange-800';
      case 'out_for_delivery':
        return 'bg-purple-100 text-purple-800';
      case 'delivered':
      case 'fulfilled':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatCurrency = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">My Orders</h1>
        <p className="text-gray-600 mt-1">View and manage your order history</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Status Filter */}
      <div className="mb-6">
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setSelectedStatus('')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              selectedStatus === ''
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All Orders
          </button>
          <button
            onClick={() => setSelectedStatus('pending')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              selectedStatus === 'pending'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Active
          </button>
          <button
            onClick={() => setSelectedStatus('delivered')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              selectedStatus === 'delivered'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Completed
          </button>
          <button
            onClick={() => setSelectedStatus('cancelled')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              selectedStatus === 'cancelled'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Cancelled
          </button>
        </div>
      </div>

      {/* Orders List */}
      {orders.length === 0 ? (
        <div className="card text-center py-12">
          <ShoppingBag className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No orders found</h3>
          <p className="text-gray-600">
            {selectedStatus
              ? `You don't have any ${selectedStatus} orders`
              : "You haven't placed any orders yet"}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <div key={order.id} className="card">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  {getStatusIcon(order.order_status)}
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-gray-900">Order #{order.id.slice(0, 8)}</h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(order.order_status)}`}>
                        {getStatusText(order.order_status)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">{formatDate(order.created_at)}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-gray-900">{formatCurrency(order.total_cents)}</p>
                  <p className="text-sm text-gray-600 capitalize">{order.payment_method}</p>
                </div>
              </div>

              {/* Order Items */}
              {order.items && order.items.length > 0 && (
                <div className="border-t border-gray-200 pt-4 mb-4">
                  <div className="space-y-2">
                    {order.items.map((item) => (
                      <div key={item.id} className="flex justify-between text-sm">
                        <span className="text-gray-700">
                          {item.quantity}x {item.dish?.name || 'Item'}
                        </span>
                        <span className="font-medium text-gray-900">
                          {formatCurrency(item.price_at_purchase_cents * item.quantity)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Delivery Info */}
              <div className="border-t border-gray-200 pt-4 text-sm">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div>
                    <span className="text-gray-600">Delivery Type: </span>
                    <span className="font-medium text-gray-900 capitalize">{order.delivery_type}</span>
                  </div>
                  {order.delivery_type === 'delivery' && order.delivery_address && (
                    <div>
                      <span className="text-gray-600">Address: </span>
                      <span className="font-medium text-gray-900">{order.delivery_address}</span>
                    </div>
                  )}
                  {order.estimated_delivery_time && (
                    <div>
                      <span className="text-gray-600">Estimated Time: </span>
                      <span className="font-medium text-gray-900">
                        {formatDate(order.estimated_delivery_time)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Cancel Button */}
              {['pending', 'confirmed'].includes(order.order_status) && (
                <div className="border-t border-gray-200 pt-4 mt-4">
                  <button
                    onClick={() => handleCancelOrder(order.id)}
                    disabled={cancellingOrderId === order.id}
                    className="btn-outline text-red-600 border-red-600 hover:bg-red-50 inline-flex items-center gap-2"
                  >
                    {cancellingOrderId === order.id ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Cancelling...
                      </>
                    ) : (
                      <>
                        <XCircle className="w-4 h-4" />
                        Cancel Order
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
