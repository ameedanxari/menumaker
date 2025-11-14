import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useBusinessStore } from '../stores/businessStore';
import { useOrderStore } from '../stores/orderStore';
import { api } from '../services/api';
import { SubscriptionStatusWidget } from '../components/subscription/SubscriptionStatusWidget';
import {
  TrendingUp,
  ShoppingBag,
  DollarSign,
  Clock,
  CheckCircle,
  Loader2,
  ArrowRight,
  BarChart3,
} from 'lucide-react';
import { format } from 'date-fns';

interface DashboardStats {
  totalOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
  pendingOrders: number;
  completedOrders: number;
  revenueByDay: Array<{ date: string; revenue: number; orders: number }>;
}

export default function DashboardPage() {
  const { currentBusiness, fetchBusinesses } = useBusinessStore();
  const { orders, fetchOrders } = useOrderStore();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'all'>('week');

  useEffect(() => {
    fetchBusinesses();
  }, [fetchBusinesses]);

  useEffect(() => {
    if (currentBusiness) {
      fetchOrders(currentBusiness.id);
      fetchStats();
    }
  }, [currentBusiness, period]);

  const fetchStats = async () => {
    if (!currentBusiness) return;

    try {
      setIsLoadingStats(true);
      const response = await api.getDashboardStats(currentBusiness.id, period);

      if (response.success) {
        setStats(response.data.stats);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setIsLoadingStats(false);
    }
  };

  const recentOrders = orders.slice(0, 5);

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

  if (!currentBusiness) {
    return (
      <div className="card">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Welcome to MenuMaker!</h2>
        <p className="text-gray-600 mb-6">
          Get started by creating your business profile to start receiving orders.
        </p>
        <Link to="/business/profile" className="btn-primary inline-block">
          Create Business Profile
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-1">
            Welcome back! Here's what's happening with {currentBusiness.name}
          </p>
        </div>

        {/* Period Selector */}
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value as any)}
          className="input w-auto"
        >
          <option value="today">Today</option>
          <option value="week">This Week</option>
          <option value="month">This Month</option>
          <option value="all">All Time</option>
        </select>
      </div>

      {/* Stats Cards */}
      {isLoadingStats ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
        </div>
      ) : stats ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Total Revenue */}
            <div className="card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Total Revenue</p>
                  <p className="text-2xl font-bold text-gray-900">
                    ${(stats.totalRevenue / 100).toFixed(2)}
                  </p>
                </div>
                <div className="p-3 bg-green-100 rounded-lg">
                  <DollarSign className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </div>

            {/* Total Orders */}
            <div className="card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Total Orders</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalOrders}</p>
                </div>
                <div className="p-3 bg-blue-100 rounded-lg">
                  <ShoppingBag className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </div>

            {/* Average Order Value */}
            <div className="card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Avg. Order Value</p>
                  <p className="text-2xl font-bold text-gray-900">
                    ${(stats.averageOrderValue / 100).toFixed(2)}
                  </p>
                </div>
                <div className="p-3 bg-purple-100 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </div>

            {/* Pending Orders */}
            <div className="card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Pending Orders</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.pendingOrders}</p>
                </div>
                <div className="p-3 bg-yellow-100 rounded-lg">
                  <Clock className="w-6 h-6 text-yellow-600" />
                </div>
              </div>
            </div>
          </div>

          {/* Subscription Status Widget */}
          <SubscriptionStatusWidget />

          {/* Revenue Chart */}
          {stats.revenueByDay.length > 0 && (
            <div className="card">
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Revenue Overview
              </h2>
              <div className="space-y-3">
                {stats.revenueByDay.map((day) => (
                  <div key={day.date} className="flex items-center gap-4">
                    <div className="w-24 text-sm text-gray-600">
                      {format(new Date(day.date), 'MMM dd')}
                    </div>
                    <div className="flex-1">
                      <div className="bg-gray-200 rounded-full h-8 overflow-hidden">
                        <div
                          className="bg-primary-600 h-full flex items-center justify-end px-3"
                          style={{
                            width: `${Math.min(
                              100,
                              (day.revenue / Math.max(...stats.revenueByDay.map((d) => d.revenue))) *
                                100
                            )}%`,
                          }}
                        >
                          <span className="text-sm font-medium text-white">
                            ${(day.revenue / 100).toFixed(0)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="w-20 text-sm text-gray-600 text-right">
                      {day.orders} order{day.orders !== 1 ? 's' : ''}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : null}

      {/* Recent Orders */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Recent Orders</h2>
          <Link
            to="/orders"
            className="text-primary-600 hover:text-primary-700 font-medium inline-flex items-center gap-1"
          >
            View All
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {recentOrders.length === 0 ? (
          <div className="text-center py-12">
            <ShoppingBag className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No orders yet</p>
            <p className="text-sm text-gray-500 mt-2">
              Orders will appear here once customers start placing them
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {recentOrders.map((order) => (
              <div
                key={order.id}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="font-medium text-gray-900">{order.customer_name}</span>
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${getStatusColor(order.order_status)}`}
                    >
                      {order.order_status}
                    </span>
                    <span className="text-xs text-gray-500">
                      {order.delivery_type === 'delivery' ? 'Delivery' : 'Pickup'}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <span>{order.items?.length || 0} items</span>
                    <span>•</span>
                    <span className="font-semibold text-gray-900">
                      ${(order.total_cents / 100).toFixed(2)}
                    </span>
                    <span>•</span>
                    <span>{format(new Date(order.created_at), 'MMM dd, h:mm a')}</span>
                  </div>
                </div>

                <Link
                  to={`/orders`}
                  className="btn-secondary text-sm inline-flex items-center gap-1"
                >
                  View
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link to="/business/profile" className="card hover:shadow-md transition-shadow">
          <h3 className="font-semibold text-gray-900 mb-2">Business Profile</h3>
          <p className="text-sm text-gray-600">
            Update your business information and settings
          </p>
        </Link>

        <Link to="/menu" className="card hover:shadow-md transition-shadow">
          <h3 className="font-semibold text-gray-900 mb-2">Menu Editor</h3>
          <p className="text-sm text-gray-600">Manage your dishes and menus</p>
        </Link>

        <Link to="/reports" className="card hover:shadow-md transition-shadow">
          <h3 className="font-semibold text-gray-900 mb-2">Reports</h3>
          <p className="text-sm text-gray-600">View analytics and export data</p>
        </Link>
      </div>
    </div>
  );
}
