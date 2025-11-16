import { useState, useEffect } from 'react';
import { api } from '../services/api';

interface PaymentProcessor {
  id: string;
  provider: 'stripe' | 'razorpay' | 'phonepe' | 'paytm' | 'manual';
  is_active: boolean;
  display_name: string;
  priority: number;
  fee_percentage: number;
  settlement_frequency: 'daily' | 'weekly' | 'monthly';
  created_at: string;
}

export default function PaymentProcessorsPage() {
  const [processors, setProcessors] = useState<PaymentProcessor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProcessors();
  }, []);

  const loadProcessors = async () => {
    try {
      setLoading(true);
      const response = await api.get('/payment-processors');
      setProcessors(response.data.data.processors || []);
    } catch (_error) {
      console.error('Failed to load payment processors:', _error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnectProcessor = async (provider: string) => {
    try {
      const response = await api.post('/payment-processors/connect', {
        provider,
      });

      if (response.data.data.authorization_url) {
        // Redirect to OAuth flow
        window.location.href = response.data.data.authorization_url;
      } else {
        // Manual setup (show API key form)
        alert('Please enter your API keys in the configuration');
      }
    } catch (_error) {
      console.error('Failed to connect processor:', _error);
      alert('Failed to connect payment processor');
    }
  };

  const handleToggleProcessor = async (processorId: string, isActive: boolean) => {
    try {
      await api.patch(`/payment-processors/${processorId}`, {
        is_active: !isActive,
      });
      loadProcessors();
    } catch (_error) {
      console.error('Failed to toggle processor:', _error);
      alert('Failed to update processor status');
    }
  };

  const handleDisconnect = async (processorId: string) => {
    if (!confirm('Are you sure you want to disconnect this payment processor?')) {
      return;
    }

    try {
      await api.delete(`/payment-processors/${processorId}`);
      loadProcessors();
    } catch (_error) {
      console.error('Failed to disconnect processor:', _error);
      alert('Failed to disconnect processor');
    }
  };

  const availableProviders = [
    {
      id: 'stripe',
      name: 'Stripe',
      description: 'International payments with 2.9% + $0.30 per transaction',
      logo: '💳',
    },
    {
      id: 'razorpay',
      name: 'Razorpay',
      description: 'India-focused with 1.75%-2.36% fee',
      logo: '🇮🇳',
    },
    {
      id: 'phonepe',
      name: 'PhonePe',
      description: 'UPI payments with 1% + GST fee',
      logo: '📱',
    },
    {
      id: 'paytm',
      name: 'Paytm',
      description: 'Digital wallet with 2% + GST fee',
      logo: '💰',
    },
    {
      id: 'manual',
      name: 'Manual/Cash',
      description: 'Accept cash or manual payments (0% fee)',
      logo: '💵',
    },
  ];

  const connectedProviderIds = processors.map((p) => p.provider);
  const unconnectedProviders = availableProviders.filter(
    (p) => !connectedProviderIds.includes(p.id as any)
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-neutral-600">Loading payment processors...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-neutral-900 dark:text-dark-text-primary mb-2">
          Payment Processors
        </h1>
        <p className="text-lg text-neutral-600 dark:text-dark-text-secondary">
          Manage your payment processors and settlement preferences
        </p>
      </div>

      {/* Connected Processors */}
      {processors.length > 0 && (
        <div className="mb-12">
          <h2 className="text-2xl font-semibold text-neutral-900 dark:text-dark-text-primary mb-6">
            Connected Processors
          </h2>
          <div className="grid gap-6 md:grid-cols-2">
            {processors.map((processor) => (
              <div
                key={processor.id}
                className="bg-white dark:bg-dark-background-secondary rounded-lg border border-neutral-200 dark:border-dark-border-default p-6 shadow-sm"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-semibold text-neutral-900 dark:text-dark-text-primary">
                      {processor.display_name}
                    </h3>
                    <p className="text-sm text-neutral-600 dark:text-dark-text-secondary">
                      {processor.provider.charAt(0).toUpperCase() + processor.provider.slice(1)}
                    </p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium ${
                      processor.is_active
                        ? 'bg-success-100 text-success-800 dark:bg-success-900 dark:text-success-100'
                        : 'bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-100'
                    }`}
                  >
                    {processor.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <div className="space-y-2 mb-6 text-sm">
                  <div className="flex justify-between">
                    <span className="text-neutral-600 dark:text-dark-text-secondary">Fee:</span>
                    <span className="font-medium text-neutral-900 dark:text-dark-text-primary">
                      {processor.fee_percentage}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-600 dark:text-dark-text-secondary">Settlement:</span>
                    <span className="font-medium text-neutral-900 dark:text-dark-text-primary capitalize">
                      {processor.settlement_frequency}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-600 dark:text-dark-text-secondary">Priority:</span>
                    <span className="font-medium text-neutral-900 dark:text-dark-text-primary">
                      #{processor.priority}
                    </span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => handleToggleProcessor(processor.id, processor.is_active)}
                    className="flex-1 px-4 py-2 bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-dark-text-primary rounded-md hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                  >
                    {processor.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    onClick={() => handleDisconnect(processor.id)}
                    className="px-4 py-2 bg-error-500 text-white rounded-md hover:bg-error-600 transition-colors"
                  >
                    Disconnect
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Available Processors */}
      {unconnectedProviders.length > 0 && (
        <div>
          <h2 className="text-2xl font-semibold text-neutral-900 dark:text-dark-text-primary mb-6">
            Available Processors
          </h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {unconnectedProviders.map((provider) => (
              <div
                key={provider.id}
                className="bg-white dark:bg-dark-background-secondary rounded-lg border border-neutral-200 dark:border-dark-border-default p-6 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="text-4xl mb-4">{provider.logo}</div>
                <h3 className="text-xl font-semibold text-neutral-900 dark:text-dark-text-primary mb-2">
                  {provider.name}
                </h3>
                <p className="text-sm text-neutral-600 dark:text-dark-text-secondary mb-6">
                  {provider.description}
                </p>
                <button
                  onClick={() => handleConnectProcessor(provider.id)}
                  className="w-full px-4 py-2 bg-primary-500 text-white rounded-md hover:bg-primary-600 transition-colors font-medium"
                >
                  Connect
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {processors.length === 0 && (
        <div className="text-center py-12">
          <p className="text-neutral-600 dark:text-dark-text-secondary mb-4">
            No payment processors connected yet. Connect your first processor to start accepting payments.
          </p>
        </div>
      )}
    </div>
  );
}
