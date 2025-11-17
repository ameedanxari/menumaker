import { useEffect, useState } from 'react';
import { useBusinessStore } from '../stores/businessStore';
import { useOrderStore } from '../stores/orderStore';
import {
  ShoppingBag,
  Phone,
  Mail,
  MapPin,
  Clock,
  Loader2,
  Filter,
  Search,
} from 'lucide-react';
import { format } from 'date-fns';

export default function OrdersPage() {
  const { currentBusiness } = useBusinessStore();
  const { orders, fetchOrders, updateOrderStatus, isLoading } = useOrderStore();

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (currentBusiness) {
      fetchOrders(currentBusiness.id, statusFilter === 'all' ? undefined : statusFilter);
    }
  }, [currentBusiness, statusFilter, fetchOrders]);

  const handleStatusUpdate = async (orderId: string, newStatus: any) => {
    try {
      setIsUpdating(true);
      await updateOrderStatus(orderId, newStatus);

      // Update selected order if it's the one being updated
      if (selectedOrder?.id === orderId) {
        const updatedOrder = orders.find((o) => o.id === orderId);
        if (updatedOrder) {
          setSelectedOrder(updatedOrder);
        }
      }
    } catch (_error) {
      console.error('Failed to update order status:', _error);
    } finally {
      setIsUpdating(false);
    }
  };

  const filteredOrders = orders.filter((order) => {
    const matchesSearch =
      order.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customer_phone.includes(searchQuery) ||
      order.id.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesSearch;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'confirmed':
        return 'bg-blue-100 text-blue-800';
      case 'ready':
        return 'bg-purple-100 text-purple-800';
      case 'fulfilled':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusActions = (currentStatus: string) => {
    switch (currentStatus) {
      case 'pending':
        return [
          { label: 'Confirm', value: 'confirmed', color: 'btn-primary' },
          { label: 'Cancel', value: 'cancelled', color: 'bg-red-600 hover:bg-red-700 text-white' },
        ];
      case 'confirmed':
        return [
          { label: 'Mark Ready', value: 'ready', color: 'btn-primary' },
          { label: 'Cancel', value: 'cancelled', color: 'bg-red-600 hover:bg-red-700 text-white' },
        ];
      case 'ready':
        return [
          { label: 'Mark Fulfilled', value: 'fulfilled', color: 'bg-green-600 hover:bg-green-700 text-white' },
        ];
      case 'fulfilled':
      case 'cancelled':
        return [];
      default:
        return [];
    }
  };

  if (!currentBusiness) {
    return (
      <div className="card">
        <p className="text-gray-600">
          Please create a business profile first before managing orders.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Orders</h1>
        <p className="text-gray-600 mt-1">Manage and track your customer orders</p>
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by customer name, phone, or order ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-10"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input md:w-48"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="ready">Ready</option>
              <option value="fulfilled">Fulfilled</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      {/* Orders List */}
      {isLoading && orders.length === 0 ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="card text-center py-12">
          <ShoppingBag className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">
            {searchQuery || statusFilter !== 'all' ? 'No orders found matching your filters' : 'No orders yet'}
          </p>
          <p className="text-sm text-gray-500 mt-2">
            {searchQuery || statusFilter !== 'all'
              ? 'Try adjusting your search or filters'
              : 'Orders will appear here once customers start placing them'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => (
            <div key={order.id} className="card hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">{order.customer_name}</h3>
                    <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(order.order_status)}`}>
                      {order.order_status}
                    </span>
                    <span className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded-full">
                      {order.delivery_type === 'delivery' ? 'Delivery' : 'Pickup'}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                    <div className="flex items-center gap-1">
                      <Phone className="w-4 h-4" />
                      {order.customer_phone}
                    </div>
                    {order.customer_email && (
                      <div className="flex items-center gap-1">
                        <Mail className="w-4 h-4" />
                        {order.customer_email}
                      </div>
                    )}
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {format(new Date(order.created_at), 'MMM dd, yyyy h:mm a')}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedOrder(selectedOrder?.id === order.id ? null : order)}
                  className="btn-secondary text-sm"
                >
                  {selectedOrder?.id === order.id ? 'Hide Details' : 'View Details'}
                </button>
              </div>

              {/* Order Summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Order ID</p>
                  <p className="font-mono text-sm text-gray-900">{order.id.slice(0, 8)}...</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Items</p>
                  <p className="font-semibold text-gray-900">{order.items?.length || 0} items</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Total</p>
                  <p className="text-lg font-bold text-gray-900">${(order.total_cents / 100).toFixed(2)}</p>
                </div>
              </div>

              {/* Expanded Details */}
              {selectedOrder?.id === order.id && (
                <div className="border-t border-gray-200 pt-4 space-y-4">
                  {/* Items */}
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-3">Order Items</h4>
                    <div className="space-y-2">
                      {order.items?.map((item) => (
                        <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">{item.dish?.name || 'Unknown Dish'}</p>
                            <p className="text-sm text-gray-600">Quantity: {item.quantity}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-gray-900">
                              ${(item.price_at_purchase_cents / 100).toFixed(2)} each
                            </p>
                            <p className="text-sm text-gray-600">
                              ${((item.price_at_purchase_cents * item.quantity) / 100).toFixed(2)} total
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Delivery Info */}
                  {order.delivery_type === 'delivery' && order.delivery_address && (
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        Delivery Address
                      </h4>
                      <p className="text-gray-700">{order.delivery_address}</p>
                      {order.delivery_fee_cents > 0 && (
                        <p className="text-sm text-gray-600 mt-1">
                          Delivery Fee: ${(order.delivery_fee_cents / 100).toFixed(2)}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Notes */}
                  {order.notes && (
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2">Customer Notes</h4>
                      <p className="text-gray-700 p-3 bg-gray-50 rounded-lg">{order.notes}</p>
                    </div>
                  )}

                  {/* Payment Info */}
                  <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Payment Method</p>
                      <p className="font-medium text-gray-900 capitalize">{order.payment_method}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Payment Status</p>
                      <p className="font-medium text-gray-900 capitalize">{order.payment_status}</p>
                    </div>
                  </div>

                  {/* Status Actions */}
                  {getStatusActions(order.order_status).length > 0 && (
                    <div className="flex gap-3 pt-4 border-t border-gray-200">
                      {getStatusActions(order.order_status).map((action) => (
                        <button
                          key={action.value}
                          onClick={() => handleStatusUpdate(order.id, action.value)}
                          className={`${action.color} px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50`}
                          disabled={isUpdating}
                        >
                          {isUpdating ? 'Updating...' : action.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
