import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { CreditCard, AlertTriangle, CheckCircle, TrendingUp, Loader2 } from 'lucide-react';

interface CurrentSubscription {
  tier: string;
  status: string;
  isActive: boolean;
  isInTrial: boolean;
  cancelAtPeriodEnd: boolean;
  trialEnd?: string;
  currentPeriodEnd?: string;
}

interface Usage {
  allowed: boolean;
  current: number;
  limit: number;
  isUnlimited: boolean;
}

export function SubscriptionStatusWidget() {
  const navigate = useNavigate();
  const [subscription, setSubscription] = useState<CurrentSubscription | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);

      // Fetch subscription
      try {
        const subResponse = await api.getCurrentSubscription();
        if (subResponse.success) {
          setSubscription(subResponse.data.subscription);
        }
      } catch (_err) {
        // No subscription
      }

      // Fetch usage
      try {
        const usageResponse = await api.getSubscriptionUsage();
        if (usageResponse.success) {
          setUsage(usageResponse.data.usage);
        }
      } catch (_err) {
        // No usage data
      }
    } catch (_err) {
      console.error('Failed to fetch subscription data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="card">
        <div className="flex items-center justify-center h-32">
          <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
        </div>
      </div>
    );
  }

  if (!subscription) {
    return (
      <div className="card">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 mb-1">No Subscription</h3>
            <p className="text-sm text-gray-600 mb-3">
              Subscribe to a plan to start accepting orders.
            </p>
            <button
              onClick={() => navigate('/subscription')}
              className="btn-primary text-sm"
            >
              View Plans
            </button>
          </div>
        </div>
      </div>
    );
  }

  const getTierBadge = () => {
    const badges = {
      free: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Free' },
      starter: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Starter' },
      pro: { bg: 'bg-purple-100', text: 'text-purple-800', label: 'Pro' },
    };
    return badges[subscription.tier as keyof typeof badges] || badges.free;
  };

  const tierBadge = getTierBadge();
  const usagePercentage = usage && !usage.isUnlimited
    ? Math.min((usage.current / usage.limit) * 100, 100)
    : 100;

  const isNearLimit = usage && !usage.isUnlimited && usage.current >= usage.limit * 0.8;
  const isAtLimit = usage && !usage.isUnlimited && !usage.allowed;

  return (
    <div className="card hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate('/subscription')}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${tierBadge.bg}`}>
            <CreditCard className={`w-5 h-5 ${tierBadge.text}`} />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Subscription</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-xs px-2 py-0.5 rounded-full ${tierBadge.bg} ${tierBadge.text}`}>
                {tierBadge.label}
              </span>
              {subscription.isInTrial && (
                <span className="text-xs px-2 py-0.5 bg-green-100 text-green-800 rounded-full">
                  Trial
                </span>
              )}
              {subscription.cancelAtPeriodEnd && (
                <span className="text-xs px-2 py-0.5 bg-orange-100 text-orange-800 rounded-full">
                  Canceling
                </span>
              )}
            </div>
          </div>
        </div>
        {subscription.isActive && !subscription.cancelAtPeriodEnd && (
          <CheckCircle className="w-5 h-5 text-green-600" />
        )}
      </div>

      {/* Usage Bar */}
      {usage && (
        <div className="mb-3">
          <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
            <span>Order Usage This Month</span>
            <span className="font-medium">
              {usage.isUnlimited ? 'Unlimited' : `${usage.current} / ${usage.limit}`}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${
                isAtLimit ? 'bg-red-600' :
                isNearLimit ? 'bg-orange-600' :
                'bg-green-600'
              }`}
              style={{ width: `${usagePercentage}%` }}
            />
          </div>
          {isAtLimit && (
            <p className="text-xs text-red-600 mt-2 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Limit reached - Upgrade to continue
            </p>
          )}
          {isNearLimit && !isAtLimit && (
            <p className="text-xs text-orange-600 mt-2 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Approaching limit - Consider upgrading
            </p>
          )}
        </div>
      )}

      {/* Status Info */}
      <div className="pt-3 border-t border-gray-200">
        {subscription.isInTrial && subscription.trialEnd && (
          <p className="text-xs text-gray-600">
            Trial ends: {new Date(subscription.trialEnd).toLocaleDateString()}
          </p>
        )}
        {subscription.cancelAtPeriodEnd && subscription.currentPeriodEnd && (
          <p className="text-xs text-orange-600">
            Access until: {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
          </p>
        )}
        {!subscription.isInTrial && !subscription.cancelAtPeriodEnd && subscription.currentPeriodEnd && (
          <p className="text-xs text-gray-600">
            Renews: {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
          </p>
        )}
      </div>

      {/* Upgrade CTA for Free Tier */}
      {subscription.tier === 'free' && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate('/subscription');
            }}
            className="btn-primary text-sm w-full flex items-center justify-center gap-2"
          >
            <TrendingUp className="w-4 h-4" />
            Upgrade Plan
          </button>
        </div>
      )}
    </div>
  );
}
