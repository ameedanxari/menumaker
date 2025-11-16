import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useBusinessStore } from '../stores/businessStore';
import {
  Check,
  X,
  Loader2,
  CreditCard,
  AlertCircle,
  TrendingUp,
  Zap,
  Shield,
  ExternalLink,
} from 'lucide-react';

interface SubscriptionTier {
  tier: string;
  name: string;
  price: number;
  currency: string;
  interval: string;
  features: {
    maxOrders: number;
    stripePayments: boolean;
    whatsappNotifications: boolean;
    prioritySupport: boolean;
    analytics: string;
    customDomain: boolean;
  };
  description: string;
}

interface CurrentSubscription {
  id: string;
  tier: string;
  status: string;
  isActive: boolean;
  isInTrial: boolean;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd: boolean;
  trialEnd?: string;
  features: any;
  price: number;
  currency: string;
}

interface Usage {
  allowed: boolean;
  current: number;
  limit: number;
  isUnlimited: boolean;
}

export default function SubscriptionPage() {
  const { currentBusiness } = useBusinessStore();
  const [tiers, setTiers] = useState<SubscriptionTier[]>([]);
  const [currentSubscription, setCurrentSubscription] = useState<CurrentSubscription | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [isSubscribing, setIsSubscribing] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      setError('');

      // Fetch tiers
      const tiersResponse = await api.getSubscriptionTiers();
      if (tiersResponse.success) {
        setTiers(tiersResponse.data.tiers);
      }

      // Fetch current subscription
      try {
        const subResponse = await api.getCurrentSubscription();
        if (subResponse.success) {
          setCurrentSubscription(subResponse.data.subscription);
        }
      } catch (err: any) {
        // No subscription yet
        console.log('No subscription found');
      }

      // Fetch usage
      try {
        const usageResponse = await api.getSubscriptionUsage();
        if (usageResponse.success) {
          setUsage(usageResponse.data.usage);
        }
      } catch (err: any) {
        console.log('Could not fetch usage');
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load subscription data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubscribe = async (tier: string) => {
    if (!currentBusiness) {
      setError('Please create a business profile first');
      return;
    }

    setSelectedTier(tier);
    setIsSubscribing(true);
    setError('');

    try {
      const response = await api.createSubscription(tier as any, {
        email: currentBusiness.email,
      });

      if (response.success) {
        const { subscription, clientSecret } = response.data;

        // If there's a client secret, show payment modal
        if (clientSecret && tier !== 'free') {
          // For paid tiers, we need to create a temporary order for payment
          // In production, you might handle this differently
          setShowPaymentModal(true);
          // Store subscription ID to complete after payment
          setPendingOrderId(subscription.id);
        } else {
          // Free tier or trial - subscription is active immediately
          await fetchData();
          setSelectedTier(null);
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to create subscription');
    } finally {
      setIsSubscribing(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!window.confirm('Are you sure you want to cancel your subscription? You will still have access until the end of your billing period.')) {
      return;
    }

    try {
      setError('');
      const response = await api.cancelSubscription(false); // Cancel at period end
      if (response.success) {
        await fetchData();
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to cancel subscription');
    }
  };

  const handleResumeSubscription = async () => {
    try {
      setError('');
      const response = await api.resumeSubscription();
      if (response.success) {
        await fetchData();
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to resume subscription');
    }
  };

  const handleManageBilling = async () => {
    try {
      setError('');
      const returnUrl = window.location.href;
      const response = await api.getSubscriptionPortal(returnUrl);
      if (response.success) {
        window.location.href = response.data.portalUrl;
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to open billing portal');
    }
  };

  const formatPrice = (price: number, currency: string) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
    }).format(price / 100);
  };

  const getTierBadge = (tier: string) => {
    const badges = {
      free: 'bg-gray-100 text-gray-800',
      starter: 'bg-blue-100 text-blue-800',
      pro: 'bg-purple-100 text-purple-800',
    };
    return badges[tier as keyof typeof badges] || badges.free;
  };

  if (!currentBusiness) {
    return (
      <div className="card">
        <p className="text-gray-600">
          Please create a business profile first before managing subscriptions.
        </p>
      </div>
    );
  }

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
        <h1 className="text-3xl font-bold text-gray-900">Subscription Plans</h1>
        <p className="text-gray-600 mt-1">Choose the plan that fits your business needs</p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Current Subscription Status */}
      {currentSubscription && (
        <div className="card mb-6 bg-gradient-to-r from-primary-50 to-blue-50 border-primary-200">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h3 className="text-lg font-semibold text-gray-900">Current Plan</h3>
                <span className={`text-xs px-2 py-1 rounded-full ${getTierBadge(currentSubscription.tier)}`}>
                  {currentSubscription.tier.toUpperCase()}
                </span>
                {currentSubscription.isInTrial && (
                  <span className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded-full">
                    Free Trial
                  </span>
                )}
                {currentSubscription.cancelAtPeriodEnd && (
                  <span className="text-xs px-2 py-1 bg-orange-100 text-orange-800 rounded-full">
                    Canceling
                  </span>
                )}
              </div>

              <p className="text-sm text-gray-600 mb-4">
                {currentSubscription.tier === 'free'
                  ? 'Free plan with basic features'
                  : `${formatPrice(currentSubscription.price, currentSubscription.currency)}/month`
                }
              </p>

              {usage && (
                <div className="p-3 bg-white rounded-lg mb-4">
                  <p className="text-sm text-gray-600 mb-2">Order Usage This Month</p>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          usage.isUnlimited ? 'bg-green-600' :
                          usage.current >= usage.limit ? 'bg-red-600' :
                          usage.current >= usage.limit * 0.8 ? 'bg-orange-600' :
                          'bg-green-600'
                        }`}
                        style={{
                          width: usage.isUnlimited ? '100%' : `${Math.min((usage.current / usage.limit) * 100, 100)}%`,
                        }}
                      />
                    </div>
                    <span className="text-sm font-medium text-gray-900">
                      {usage.isUnlimited ? 'Unlimited' : `${usage.current} / ${usage.limit}`}
                    </span>
                  </div>
                  {!usage.allowed && !usage.isUnlimited && (
                    <p className="text-xs text-red-600 mt-2">
                      ⚠️ Order limit reached. Upgrade to continue accepting orders.
                    </p>
                  )}
                </div>
              )}

              {currentSubscription.currentPeriodEnd && (
                <p className="text-xs text-gray-500">
                  {currentSubscription.cancelAtPeriodEnd
                    ? `Access until ${new Date(currentSubscription.currentPeriodEnd).toLocaleDateString()}`
                    : `Renews on ${new Date(currentSubscription.currentPeriodEnd).toLocaleDateString()}`
                  }
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              {currentSubscription.tier !== 'free' && (
                <button
                  onClick={handleManageBilling}
                  className="btn-secondary text-sm inline-flex items-center gap-2"
                >
                  <CreditCard className="w-4 h-4" />
                  Manage Billing
                  <ExternalLink className="w-3 h-3" />
                </button>
              )}
              {currentSubscription.cancelAtPeriodEnd ? (
                <button
                  onClick={handleResumeSubscription}
                  className="btn-primary text-sm"
                >
                  Resume Subscription
                </button>
              ) : currentSubscription.tier !== 'free' && (
                <button
                  onClick={handleCancelSubscription}
                  className="text-sm text-red-600 hover:text-red-700"
                >
                  Cancel Subscription
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Pricing Tiers */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {tiers.map((tier) => {
          const isCurrent = currentSubscription?.tier === tier.tier;
          const isUpgrade = currentSubscription &&
            (currentSubscription.tier === 'free' && tier.tier !== 'free') ||
            (currentSubscription.tier === 'starter' && tier.tier === 'pro');

          return (
            <div
              key={tier.tier}
              className={`card relative ${
                tier.tier === 'starter' ? 'border-2 border-primary-500 shadow-lg' : ''
              }`}
            >
              {tier.tier === 'starter' && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-primary-600 text-white text-xs px-3 py-1 rounded-full">
                    Most Popular
                  </span>
                </div>
              )}

              <div className="text-center mb-6">
                <h3 className="text-xl font-bold text-gray-900 mb-2">{tier.name}</h3>
                <div className="mb-4">
                  <span className="text-4xl font-bold text-gray-900">
                    {formatPrice(tier.price, tier.currency)}
                  </span>
                  {tier.price > 0 && (
                    <span className="text-gray-600">/{tier.interval}</span>
                  )}
                </div>
                <p className="text-sm text-gray-600">{tier.description}</p>
              </div>

              <div className="space-y-3 mb-6">
                <Feature
                  included={true}
                  text={
                    tier.features.maxOrders === -1
                      ? 'Unlimited orders'
                      : `${tier.features.maxOrders} orders per month`
                  }
                  icon={tier.tier === 'pro' ? TrendingUp : undefined}
                />
                <Feature
                  included={tier.features.stripePayments}
                  text="Online payments (Stripe)"
                  icon={tier.features.stripePayments ? CreditCard : undefined}
                />
                <Feature
                  included={tier.features.whatsappNotifications}
                  text="WhatsApp notifications"
                />
                <Feature
                  included={tier.features.prioritySupport}
                  text="Priority support"
                  icon={tier.features.prioritySupport ? Zap : undefined}
                />
                <Feature
                  included={true}
                  text={`${tier.features.analytics.charAt(0).toUpperCase() + tier.features.analytics.slice(1)} analytics`}
                />
                <Feature
                  included={tier.features.customDomain}
                  text="Custom domain"
                  icon={tier.features.customDomain ? Shield : undefined}
                />
              </div>

              <button
                onClick={() => handleSubscribe(tier.tier)}
                disabled={isCurrent || isSubscribing}
                className={`w-full py-2 rounded-lg font-medium transition-colors ${
                  isCurrent
                    ? 'bg-gray-200 text-gray-600 cursor-not-allowed'
                    : tier.tier === 'starter'
                    ? 'btn-primary'
                    : 'btn-secondary'
                }`}
              >
                {isSubscribing && selectedTier === tier.tier ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing...
                  </span>
                ) : isCurrent ? (
                  'Current Plan'
                ) : isUpgrade ? (
                  `Upgrade to ${tier.name}`
                ) : tier.tier === 'free' ? (
                  'Downgrade to Free'
                ) : (
                  `Get ${tier.name}`
                )}
              </button>

              {tier.price > 0 && !isCurrent && (
                <p className="text-xs text-center text-gray-500 mt-3">
                  14-day free trial included
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* FAQ or Additional Info */}
      <div className="mt-12 card bg-gray-50">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Frequently Asked Questions</h3>
        <div className="space-y-4">
          <div>
            <h4 className="font-medium text-gray-900 mb-1">Can I change plans anytime?</h4>
            <p className="text-sm text-gray-600">
              Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately.
            </p>
          </div>
          <div>
            <h4 className="font-medium text-gray-900 mb-1">What happens if I reach my order limit?</h4>
            <p className="text-sm text-gray-600">
              You'll need to upgrade to a higher tier to continue accepting orders. Existing orders remain unaffected.
            </p>
          </div>
          <div>
            <h4 className="font-medium text-gray-900 mb-1">Do you offer refunds?</h4>
            <p className="text-sm text-gray-600">
              We offer a 14-day free trial. After that, subscriptions are billed monthly and can be canceled anytime.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

interface FeatureProps {
  included: boolean;
  text: string;
  icon?: any;
}

function Feature({ included, text, icon: Icon }: FeatureProps) {
  return (
    <div className="flex items-center gap-2">
      {included ? (
        <>
          {Icon ? (
            <Icon className="w-5 h-5 text-primary-600 flex-shrink-0" />
          ) : (
            <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
          )}
          <span className="text-sm text-gray-700">{text}</span>
        </>
      ) : (
        <>
          <X className="w-5 h-5 text-gray-400 flex-shrink-0" />
          <span className="text-sm text-gray-400">{text}</span>
        </>
      )}
    </div>
  );
}
