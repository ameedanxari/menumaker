import { useState, useEffect } from 'react';
import { api } from '../services/api';

interface Payout {
  id: string;
  payout_month: string;
  payout_amount_cents: number;
  processor_fees_cents: number;
  subscription_fees_cents: number;
  net_amount_cents: number;
  status: 'pending' | 'processing' | 'paid' | 'failed';
  paid_at: string | null;
  transaction_id: string | null;
  created_at: string;
}

interface PayoutSchedule {
  id: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  minimum_threshold_cents: number;
  maximum_hold_period_days: number;
  auto_payout_enabled: boolean;
}

export default function PayoutsPage() {
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [schedule, setSchedule] = useState<PayoutSchedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({
    frequency: 'weekly',
    minimum_threshold_cents: 50000,
    maximum_hold_period_days: 7,
    auto_payout_enabled: true,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [payoutsRes, scheduleRes] = await Promise.all([
        api.get('/payouts'),
        api.get('/payouts/schedule'),
      ]);

      setPayouts(payoutsRes.data.data.payouts || []);
      setSchedule(scheduleRes.data.data.schedule || null);

      if (scheduleRes.data.data.schedule) {
        setFormData({
          frequency: scheduleRes.data.data.schedule.frequency,
          minimum_threshold_cents: scheduleRes.data.data.schedule.minimum_threshold_cents,
          maximum_hold_period_days: scheduleRes.data.data.schedule.maximum_hold_period_days,
          auto_payout_enabled: scheduleRes.data.data.schedule.auto_payout_enabled,
        });
      }
    } catch (_error) {
      console.error('Failed to load payouts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await api.post('/payouts/schedule', formData);
      setEditMode(false);
      loadData();
      alert('Payout schedule updated successfully');
    } catch (_error) {
      console.error('Failed to update schedule:', error);
      alert('Failed to update payout schedule');
    }
  };

  const formatCurrency = (cents: number) => {
    return `₹${(cents / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-success-100 text-success-800 dark:bg-success-900 dark:text-success-100';
      case 'processing':
        return 'bg-warning-100 text-warning-800 dark:bg-warning-900 dark:text-warning-100';
      case 'failed':
        return 'bg-error-100 text-error-800 dark:bg-error-900 dark:text-error-100';
      default:
        return 'bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-100';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-neutral-600">Loading payouts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-neutral-900 dark:text-dark-text-primary mb-2">
          Payouts
        </h1>
        <p className="text-lg text-neutral-600 dark:text-dark-text-secondary">
          Manage your payout schedule and view payout history
        </p>
      </div>

      {/* Payout Schedule */}
      <div className="bg-white dark:bg-dark-background-secondary rounded-lg border border-neutral-200 dark:border-dark-border-default p-6 mb-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-semibold text-neutral-900 dark:text-dark-text-primary">
            Payout Schedule
          </h2>
          <button
            onClick={() => setEditMode(!editMode)}
            className="px-4 py-2 bg-primary-500 text-white rounded-md hover:bg-primary-600 transition-colors"
          >
            {editMode ? 'Cancel' : 'Edit Schedule'}
          </button>
        </div>

        {editMode ? (
          <form onSubmit={handleUpdateSchedule} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-neutral-900 dark:text-dark-text-primary mb-2">
                Frequency
              </label>
              <select
                value={formData.frequency}
                onChange={(e) => setFormData({ ...formData, frequency: e.target.value as any })}
                className="w-full px-4 py-2 border border-neutral-300 dark:border-dark-border-default rounded-md bg-white dark:bg-dark-background-tertiary text-neutral-900 dark:text-dark-text-primary"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-900 dark:text-dark-text-primary mb-2">
                Minimum Threshold (₹)
              </label>
              <input
                type="number"
                value={formData.minimum_threshold_cents / 100}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    minimum_threshold_cents: parseFloat(e.target.value || '0') * 100,
                  })
                }
                className="w-full px-4 py-2 border border-neutral-300 dark:border-dark-border-default rounded-md bg-white dark:bg-dark-background-tertiary text-neutral-900 dark:text-dark-text-primary"
                step="0.01"
              />
              <p className="text-sm text-neutral-600 dark:text-dark-text-secondary mt-1">
                Hold payout if amount is below this threshold
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-900 dark:text-dark-text-primary mb-2">
                Maximum Hold Period (days)
              </label>
              <input
                type="number"
                value={formData.maximum_hold_period_days}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    maximum_hold_period_days: parseInt(e.target.value || '0'),
                  })
                }
                className="w-full px-4 py-2 border border-neutral-300 dark:border-dark-border-default rounded-md bg-white dark:bg-dark-background-tertiary text-neutral-900 dark:text-dark-text-primary"
              />
              <p className="text-sm text-neutral-600 dark:text-dark-text-secondary mt-1">
                Always payout after this many days, even if below threshold
              </p>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="auto_payout"
                checked={formData.auto_payout_enabled}
                onChange={(e) =>
                  setFormData({ ...formData, auto_payout_enabled: e.target.checked })
                }
                className="w-4 h-4 text-primary-500 border-neutral-300 rounded focus:ring-primary-500"
              />
              <label
                htmlFor="auto_payout"
                className="ml-2 text-sm font-medium text-neutral-900 dark:text-dark-text-primary"
              >
                Enable automatic payouts
              </label>
            </div>

            <button
              type="submit"
              className="w-full px-4 py-3 bg-primary-500 text-white rounded-md hover:bg-primary-600 transition-colors font-semibold"
            >
              Save Schedule
            </button>
          </form>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <p className="text-sm text-neutral-600 dark:text-dark-text-secondary mb-1">Frequency</p>
              <p className="text-lg font-semibold text-neutral-900 dark:text-dark-text-primary capitalize">
                {schedule?.frequency || 'Not Set'}
              </p>
            </div>
            <div>
              <p className="text-sm text-neutral-600 dark:text-dark-text-secondary mb-1">
                Minimum Threshold
              </p>
              <p className="text-lg font-semibold text-neutral-900 dark:text-dark-text-primary">
                {schedule ? formatCurrency(schedule.minimum_threshold_cents) : 'Not Set'}
              </p>
            </div>
            <div>
              <p className="text-sm text-neutral-600 dark:text-dark-text-secondary mb-1">Max Hold Period</p>
              <p className="text-lg font-semibold text-neutral-900 dark:text-dark-text-primary">
                {schedule?.maximum_hold_period_days || 0} days
              </p>
            </div>
            <div>
              <p className="text-sm text-neutral-600 dark:text-dark-text-secondary mb-1">Auto Payout</p>
              <p className="text-lg font-semibold text-neutral-900 dark:text-dark-text-primary">
                {schedule?.auto_payout_enabled ? 'Enabled' : 'Disabled'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Payout History */}
      <div>
        <h2 className="text-2xl font-semibold text-neutral-900 dark:text-dark-text-primary mb-6">
          Payout History
        </h2>

        {payouts.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-dark-background-secondary rounded-lg border border-neutral-200 dark:border-dark-border-default">
            <p className="text-neutral-600 dark:text-dark-text-secondary">
              No payouts yet. Payouts will appear here once processed.
            </p>
          </div>
        ) : (
          <div className="bg-white dark:bg-dark-background-secondary rounded-lg border border-neutral-200 dark:border-dark-border-default overflow-hidden">
            <table className="w-full">
              <thead className="bg-neutral-50 dark:bg-neutral-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-600 dark:text-dark-text-secondary uppercase tracking-wider">
                    Month
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-600 dark:text-dark-text-secondary uppercase tracking-wider">
                    Gross Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-600 dark:text-dark-text-secondary uppercase tracking-wider">
                    Fees
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-600 dark:text-dark-text-secondary uppercase tracking-wider">
                    Net Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-600 dark:text-dark-text-secondary uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-600 dark:text-dark-text-secondary uppercase tracking-wider">
                    Paid Date
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-dark-border-default">
                {payouts.map((payout) => (
                  <tr key={payout.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-neutral-900 dark:text-dark-text-primary">
                      {payout.payout_month}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-600 dark:text-dark-text-secondary">
                      {formatCurrency(payout.payout_amount_cents)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-600 dark:text-dark-text-secondary">
                      {formatCurrency(
                        payout.processor_fees_cents + payout.subscription_fees_cents
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-neutral-900 dark:text-dark-text-primary">
                      {formatCurrency(payout.net_amount_cents)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(payout.status)}`}>
                        {payout.status.charAt(0).toUpperCase() + payout.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-600 dark:text-dark-text-secondary">
                      {payout.paid_at
                        ? new Date(payout.paid_at).toLocaleDateString('en-IN')
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
