import { useState, useEffect } from 'react';
import { api } from '../services/api';

interface Coupon {
  id: string;
  code: string;
  discount_type: 'fixed' | 'percentage';
  discount_value: number;
  max_discount_cents: number | null;
  min_order_value_cents: number;
  usage_limit_type: 'per_customer' | 'per_month' | 'unlimited' | 'total_limit';
  total_usage_limit: number | null;
  valid_from: string;
  valid_until: string | null;
  is_active: boolean;
  usage_count: number;
  qr_code_data: string | null;
}

export default function CouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    code: '',
    discount_type: 'percentage' as 'fixed' | 'percentage',
    discount_value: 10,
    max_discount_cents: null as number | null,
    min_order_value_cents: 0,
    usage_limit_type: 'unlimited' as 'per_customer' | 'per_month' | 'unlimited' | 'total_limit',
    total_usage_limit: null as number | null,
    valid_until: '',
  });

  useEffect(() => {
    loadCoupons();
  }, []);

  const loadCoupons = async () => {
    try {
      setLoading(true);
      const response = await api.get('/coupons');
      setCoupons(response.data.data.coupons || []);
    } catch (_error) {
      console.error('Failed to load coupons:', _error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await api.post('/coupons', {
        ...formData,
        discount_value:
          formData.discount_type === 'fixed'
            ? formData.discount_value * 100
            : formData.discount_value,
        max_discount_cents:
          formData.max_discount_cents ? formData.max_discount_cents * 100 : null,
      });

      setShowCreateModal(false);
      setFormData({
        code: '',
        discount_type: 'percentage',
        discount_value: 10,
        max_discount_cents: null,
        min_order_value_cents: 0,
        usage_limit_type: 'unlimited',
        total_usage_limit: null,
        valid_until: '',
      });
      loadCoupons();
      alert('Coupon created successfully!');
    } catch (_error) {
      console.error('Failed to create coupon:', _error);
      alert('Failed to create coupon');
    }
  };

  const handleToggleCoupon = async (id: string, isActive: boolean) => {
    try {
      await api.patch(`/coupons/${id}`, {
        is_active: !isActive,
      });
      loadCoupons();
    } catch (_error) {
      console.error('Failed to toggle coupon:', _error);
      alert('Failed to update coupon');
    }
  };

  const handleDeleteCoupon = async (id: string) => {
    if (!confirm('Delete this coupon? This action cannot be undone.')) return;

    try {
      await api.delete(`/coupons/${id}`);
      loadCoupons();
    } catch (_error) {
      console.error('Failed to delete coupon:', _error);
      alert('Failed to delete coupon');
    }
  };

  const formatCurrency = (cents: number) => {
    return `₹${(cents / 100).toFixed(2)}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-neutral-600">Loading coupons...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold text-neutral-900 dark:text-dark-text-primary mb-2">
            Coupons & Promotions
          </h1>
          <p className="text-lg text-neutral-600 dark:text-dark-text-secondary">
            Create and manage discount coupons for your customers
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-6 py-3 bg-primary-500 text-white rounded-md hover:bg-primary-600 transition-colors font-semibold"
        >
          + Create Coupon
        </button>
      </div>

      {coupons.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-dark-background-secondary rounded-lg border border-neutral-200 dark:border-dark-border-default">
          <p className="text-neutral-600 dark:text-dark-text-secondary text-lg mb-4">
            No coupons created yet
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-6 py-3 bg-primary-500 text-white rounded-md hover:bg-primary-600 transition-colors"
          >
            Create Your First Coupon
          </button>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {coupons.map((coupon) => (
            <div
              key={coupon.id}
              className="bg-white dark:bg-dark-background-secondary rounded-lg border border-neutral-200 dark:border-dark-border-default p-6 shadow-sm"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold text-neutral-900 dark:text-dark-text-primary font-mono">
                    {coupon.code}
                  </h3>
                  <p className="text-sm text-neutral-600 dark:text-dark-text-secondary">
                    {coupon.usage_count} times used
                  </p>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-medium ${
                    coupon.is_active
                      ? 'bg-success-100 text-success-800'
                      : 'bg-neutral-100 text-neutral-800'
                  }`}
                >
                  {coupon.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>

              <div className="mb-6 p-4 bg-primary-50 dark:bg-primary-900 rounded-lg">
                <p className="text-2xl font-bold text-primary-600 dark:text-primary-200">
                  {coupon.discount_type === 'percentage'
                    ? `${coupon.discount_value}% OFF`
                    : `${formatCurrency(coupon.discount_value)} OFF`}
                </p>
                {coupon.max_discount_cents && coupon.discount_type === 'percentage' && (
                  <p className="text-xs text-neutral-600 dark:text-dark-text-secondary mt-1">
                    Max {formatCurrency(coupon.max_discount_cents)}
                  </p>
                )}
              </div>

              <div className="space-y-2 text-sm mb-6">
                <div className="flex justify-between">
                  <span className="text-neutral-600 dark:text-dark-text-secondary">Min Order:</span>
                  <span className="font-medium text-neutral-900 dark:text-dark-text-primary">
                    {formatCurrency(coupon.min_order_value_cents)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-600 dark:text-dark-text-secondary">Usage Limit:</span>
                  <span className="font-medium text-neutral-900 dark:text-dark-text-primary capitalize">
                    {coupon.usage_limit_type.replace('_', ' ')}
                    {coupon.total_usage_limit ? ` (${coupon.total_usage_limit})` : ''}
                  </span>
                </div>
                {coupon.valid_until && (
                  <div className="flex justify-between">
                    <span className="text-neutral-600 dark:text-dark-text-secondary">Valid Until:</span>
                    <span className="font-medium text-neutral-900 dark:text-dark-text-primary">
                      {new Date(coupon.valid_until).toLocaleDateString('en-IN')}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => handleToggleCoupon(coupon.id, coupon.is_active)}
                  className="flex-1 px-4 py-2 bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-dark-text-primary rounded-md hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                >
                  {coupon.is_active ? 'Deactivate' : 'Activate'}
                </button>
                <button
                  onClick={() => handleDeleteCoupon(coupon.id)}
                  className="px-4 py-2 bg-error-500 text-white rounded-md hover:bg-error-600 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Coupon Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-dark-background-secondary rounded-lg max-w-2xl w-full p-8 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-neutral-900 dark:text-dark-text-primary mb-6">
              Create New Coupon
            </h2>

            <form onSubmit={handleCreateCoupon} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-neutral-900 dark:text-dark-text-primary mb-2">
                  Coupon Code
                </label>
                <input
                  type="text"
                  required
                  value={formData.code}
                  onChange={(e) =>
                    setFormData({ ...formData, code: e.target.value.toUpperCase() })
                  }
                  className="w-full px-4 py-2 border border-neutral-300 dark:border-dark-border-default rounded-md bg-white dark:bg-dark-background-tertiary text-neutral-900 dark:text-dark-text-primary font-mono"
                  placeholder="FEST10"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-900 dark:text-dark-text-primary mb-2">
                    Discount Type
                  </label>
                  <select
                    value={formData.discount_type}
                    onChange={(e) =>
                      setFormData({ ...formData, discount_type: e.target.value as any })
                    }
                    className="w-full px-4 py-2 border border-neutral-300 dark:border-dark-border-default rounded-md bg-white dark:bg-dark-background-tertiary text-neutral-900 dark:text-dark-text-primary"
                  >
                    <option value="percentage">Percentage</option>
                    <option value="fixed">Fixed Amount</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-900 dark:text-dark-text-primary mb-2">
                    Discount Value
                  </label>
                  <input
                    type="number"
                    required
                    value={formData.discount_value}
                    onChange={(e) =>
                      setFormData({ ...formData, discount_value: parseFloat(e.target.value) })
                    }
                    className="w-full px-4 py-2 border border-neutral-300 dark:border-dark-border-default rounded-md bg-white dark:bg-dark-background-tertiary text-neutral-900 dark:text-dark-text-primary"
                    step="0.01"
                  />
                  <p className="text-xs text-neutral-600 dark:text-dark-text-secondary mt-1">
                    {formData.discount_type === 'percentage' ? '% off' : '₹ off'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-900 dark:text-dark-text-primary mb-2">
                    Min Order Value (₹)
                  </label>
                  <input
                    type="number"
                    value={formData.min_order_value_cents / 100}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        min_order_value_cents: parseFloat(e.target.value || '0') * 100,
                      })
                    }
                    className="w-full px-4 py-2 border border-neutral-300 dark:border-dark-border-default rounded-md bg-white dark:bg-dark-background-tertiary text-neutral-900 dark:text-dark-text-primary"
                    step="0.01"
                  />
                </div>

                {formData.discount_type === 'percentage' && (
                  <div>
                    <label className="block text-sm font-medium text-neutral-900 dark:text-dark-text-primary mb-2">
                      Max Discount (₹)
                    </label>
                    <input
                      type="number"
                      value={formData.max_discount_cents ? formData.max_discount_cents / 100 : ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          max_discount_cents: e.target.value
                            ? parseFloat(e.target.value) * 100
                            : null,
                        })
                      }
                      className="w-full px-4 py-2 border border-neutral-300 dark:border-dark-border-default rounded-md bg-white dark:bg-dark-background-tertiary text-neutral-900 dark:text-dark-text-primary"
                      step="0.01"
                      placeholder="Optional"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-900 dark:text-dark-text-primary mb-2">
                  Usage Limit
                </label>
                <select
                  value={formData.usage_limit_type}
                  onChange={(e) =>
                    setFormData({ ...formData, usage_limit_type: e.target.value as any })
                  }
                  className="w-full px-4 py-2 border border-neutral-300 dark:border-dark-border-default rounded-md bg-white dark:bg-dark-background-tertiary text-neutral-900 dark:text-dark-text-primary"
                >
                  <option value="unlimited">Unlimited</option>
                  <option value="per_customer">Once per customer</option>
                  <option value="per_month">Once per month per customer</option>
                  <option value="total_limit">Total usage limit</option>
                </select>
              </div>

              {formData.usage_limit_type === 'total_limit' && (
                <div>
                  <label className="block text-sm font-medium text-neutral-900 dark:text-dark-text-primary mb-2">
                    Total Usage Limit
                  </label>
                  <input
                    type="number"
                    value={formData.total_usage_limit || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        total_usage_limit: e.target.value ? parseInt(e.target.value) : null,
                      })
                    }
                    className="w-full px-4 py-2 border border-neutral-300 dark:border-dark-border-default rounded-md bg-white dark:bg-dark-background-tertiary text-neutral-900 dark:text-dark-text-primary"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-neutral-900 dark:text-dark-text-primary mb-2">
                  Valid Until (Optional)
                </label>
                <input
                  type="date"
                  value={formData.valid_until}
                  onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
                  className="w-full px-4 py-2 border border-neutral-300 dark:border-dark-border-default rounded-md bg-white dark:bg-dark-background-tertiary text-neutral-900 dark:text-dark-text-primary"
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-6 py-3 bg-neutral-200 dark:bg-neutral-800 text-neutral-900 dark:text-dark-text-primary rounded-md hover:bg-neutral-300 dark:hover:bg-neutral-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-primary-500 text-white rounded-md hover:bg-primary-600 transition-colors font-semibold"
                >
                  Create Coupon
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
