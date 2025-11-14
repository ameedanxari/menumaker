import { useEffect, useState } from 'react';
import { useBusinessStore } from '../stores/businessStore';
import { api } from '../services/api';
import {
  Download,
  Calendar,
  DollarSign,
  ShoppingBag,
  TrendingUp,
  Loader2,
  FileText,
  Filter,
} from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';

interface DashboardStats {
  totalOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
  pendingOrders: number;
  completedOrders: number;
  revenueByDay: Array<{ date: string; revenue: number; orders: number }>;
}

export default function ReportsPage() {
  const { currentBusiness } = useBusinessStore();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Filter states
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'all' | 'custom'>('month');
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    if (currentBusiness) {
      fetchStats();
    }
  }, [currentBusiness, period]);

  useEffect(() => {
    // Update date range when period changes
    const now = new Date();
    switch (period) {
      case 'today':
        setStartDate(format(now, 'yyyy-MM-dd'));
        setEndDate(format(now, 'yyyy-MM-dd'));
        break;
      case 'week':
        setStartDate(format(subDays(now, 7), 'yyyy-MM-dd'));
        setEndDate(format(now, 'yyyy-MM-dd'));
        break;
      case 'month':
        setStartDate(format(startOfMonth(now), 'yyyy-MM-dd'));
        setEndDate(format(endOfMonth(now), 'yyyy-MM-dd'));
        break;
      case 'all':
        setStartDate('');
        setEndDate('');
        break;
    }
  }, [period]);

  const fetchStats = async () => {
    if (!currentBusiness) return;

    try {
      setIsLoadingStats(true);
      const response = await api.getDashboardStats(currentBusiness.id, period === 'custom' ? 'all' : period);

      if (response.success) {
        setStats(response.data.stats);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setIsLoadingStats(false);
    }
  };

  const handleExportCSV = async () => {
    if (!currentBusiness) return;

    try {
      setIsExporting(true);

      const filters: any = {};
      if (period === 'custom' && startDate) {
        filters.startDate = startDate;
      }
      if (period === 'custom' && endDate) {
        filters.endDate = endDate;
      }
      if (statusFilter && statusFilter !== 'all') {
        filters.status = statusFilter;
      }

      const csvBlob = await api.exportOrdersToCSV(currentBusiness.id, filters);

      // Create download link
      const url = window.URL.createObjectURL(csvBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `orders-${currentBusiness.slug}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export orders:', error);
      alert('Failed to export orders. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  if (!currentBusiness) {
    return (
      <div className="card">
        <p className="text-gray-600">
          Please create a business profile first before viewing reports.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Reports & Analytics</h1>
        <p className="text-gray-600 mt-1">
          View your business performance and export data
        </p>
      </div>

      {/* Period Selector */}
      <div className="card mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <label className="label">Time Period</label>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as any)}
              className="input"
            >
              <option value="today">Today</option>
              <option value="week">Last 7 Days</option>
              <option value="month">This Month</option>
              <option value="all">All Time</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>

          {period === 'custom' && (
            <>
              <div className="flex-1">
                <label className="label">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="input"
                />
              </div>
              <div className="flex-1">
                <label className="label">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="input"
                />
              </div>
            </>
          )}

          <div className="flex items-end">
            <button onClick={fetchStats} className="btn-primary inline-flex items-center gap-2">
              <Filter className="w-4 h-4" />
              Apply Filters
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      {isLoadingStats ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
        </div>
      ) : stats ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
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

            {/* Completed Orders */}
            <div className="card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Completed</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.completedOrders}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {stats.totalOrders > 0
                      ? `${((stats.completedOrders / stats.totalOrders) * 100).toFixed(1)}% completion rate`
                      : 'No orders'}
                  </p>
                </div>
                <div className="p-3 bg-green-100 rounded-lg">
                  <ShoppingBag className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </div>
          </div>

          {/* Revenue Chart */}
          {stats.revenueByDay.length > 0 && (
            <div className="card mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Daily Revenue Breakdown
              </h2>
              <div className="space-y-3">
                {stats.revenueByDay.map((day) => (
                  <div key={day.date} className="flex items-center gap-4">
                    <div className="w-32 text-sm text-gray-600">
                      {format(new Date(day.date), 'MMM dd, yyyy')}
                    </div>
                    <div className="flex-1">
                      <div className="bg-gray-200 rounded-full h-10 overflow-hidden">
                        <div
                          className="bg-primary-600 h-full flex items-center justify-end px-4"
                          style={{
                            width: `${Math.min(
                              100,
                              (day.revenue / Math.max(...stats.revenueByDay.map((d) => d.revenue))) *
                                100
                            )}%`,
                            minWidth: '60px',
                          }}
                        >
                          <span className="text-sm font-medium text-white">
                            ${(day.revenue / 100).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="w-28 text-sm text-gray-600 text-right">
                      {day.orders} order{day.orders !== 1 ? 's' : ''}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : null}

      {/* Export Section */}
      <div className="card">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2 flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Export Orders
            </h2>
            <p className="text-sm text-gray-600">
              Download your order data as a CSV file for further analysis
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <label className="label">Order Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="input"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="ready">Ready</option>
                <option value="fulfilled">Fulfilled</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-200">
            <button
              onClick={handleExportCSV}
              disabled={isExporting}
              className="btn-primary inline-flex items-center gap-2"
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Download CSV
                </>
              )}
            </button>
            <p className="text-xs text-gray-500 mt-2">
              The CSV file will include order details, customer information, items, and totals
            </p>
          </div>
        </div>
      </div>

      {/* Help Text */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="font-semibold text-blue-900 mb-2">Tips for Using Reports</h3>
        <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
          <li>Use custom date ranges to analyze specific time periods</li>
          <li>Export CSV files to create custom reports in spreadsheet software</li>
          <li>Monitor your completion rate to track operational efficiency</li>
          <li>Compare revenue across different time periods to identify trends</li>
        </ul>
      </div>
    </div>
  );
}
