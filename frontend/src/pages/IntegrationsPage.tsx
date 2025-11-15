import { useState, useEffect } from 'react';
import { api } from '../services/api';

interface POSIntegration {
  id: string;
  provider: 'square' | 'dine' | 'zoho';
  is_active: boolean;
  auto_sync_orders: boolean;
  last_synced_at: string | null;
}

interface DeliveryIntegration {
  id: string;
  provider: 'swiggy' | 'zomato' | 'dunzo';
  is_active: boolean;
  cost_handling: 'customer' | 'seller';
  fixed_delivery_fee_cents: number | null;
}

export default function IntegrationsPage() {
  const [activeTab, setActiveTab] = useState<'pos' | 'delivery'>('pos');
  const [posIntegrations, setPosIntegrations] = useState<POSIntegration[]>([]);
  const [deliveryIntegrations, setDeliveryIntegrations] = useState<DeliveryIntegration[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadIntegrations();
  }, []);

  const loadIntegrations = async () => {
    try {
      setLoading(true);
      const [posRes, deliveryRes] = await Promise.all([
        api.get('/pos').catch(() => ({ data: { data: { integrations: [] } } })),
        api.get('/delivery').catch(() => ({ data: { data: { integrations: [] } } })),
      ]);

      setPosIntegrations(posRes.data.data.integrations || []);
      setDeliveryIntegrations(deliveryRes.data.data.integrations || []);
    } catch (error) {
      console.error('Failed to load integrations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnectPOS = async (provider: string) => {
    try {
      const response = await api.post('/pos/connect', { provider });

      if (response.data.data.authorization_url) {
        window.location.href = response.data.data.authorization_url;
      } else {
        alert('POS integration configured successfully');
        loadIntegrations();
      }
    } catch (error) {
      console.error('Failed to connect POS:', error);
      alert('Failed to connect POS system');
    }
  };

  const handleConnectDelivery = async (provider: string) => {
    try {
      await api.post('/delivery/connect', {
        provider,
        cost_handling: 'customer',
      });

      alert('Delivery partner connected successfully');
      loadIntegrations();
    } catch (error) {
      console.error('Failed to connect delivery partner:', error);
      alert('Failed to connect delivery partner');
    }
  };

  const handleDisconnectPOS = async (id: string) => {
    if (!confirm('Disconnect this POS integration?')) return;

    try {
      await api.delete(`/pos/${id}`);
      loadIntegrations();
    } catch (error) {
      console.error('Failed to disconnect POS:', error);
      alert('Failed to disconnect POS');
    }
  };

  const handleDisconnectDelivery = async (id: string) => {
    if (!confirm('Disconnect this delivery partner?')) return;

    try {
      await api.delete(`/delivery/${id}`);
      loadIntegrations();
    } catch (error) {
      console.error('Failed to disconnect delivery partner:', error);
      alert('Failed to disconnect delivery partner');
    }
  };

  const posProviders = [
    { id: 'square', name: 'Square POS', logo: '⬛', description: 'Sync orders with Square POS' },
    { id: 'dine', name: 'Dine POS', logo: '🍽️', description: 'Integrate with Dine restaurant POS' },
    { id: 'zoho', name: 'Zoho Inventory', logo: '📦', description: 'Sync with Zoho Inventory system' },
  ];

  const deliveryProviders = [
    { id: 'swiggy', name: 'Swiggy', logo: '🛵', description: 'Enable Swiggy delivery' },
    { id: 'zomato', name: 'Zomato', logo: '🔴', description: 'Enable Zomato delivery' },
    { id: 'dunzo', name: 'Dunzo', logo: '📦', description: 'Quick delivery with Dunzo' },
  ];

  const connectedPOS = posIntegrations.map((p) => p.provider);
  const connectedDelivery = deliveryIntegrations.map((d) => d.provider);

  const availablePOS = posProviders.filter((p) => !connectedPOS.includes(p.id as any));
  const availableDelivery = deliveryProviders.filter((d) => !connectedDelivery.includes(d.id as any));

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-neutral-600">Loading integrations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-neutral-900 dark:text-dark-text-primary mb-2">
          Integrations
        </h1>
        <p className="text-lg text-neutral-600 dark:text-dark-text-secondary">
          Connect with POS systems and delivery partners
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 mb-8 border-b border-neutral-200 dark:border-dark-border-default">
        <button
          onClick={() => setActiveTab('pos')}
          className={`px-6 py-3 font-medium transition-colors ${
            activeTab === 'pos'
              ? 'text-primary-500 border-b-2 border-primary-500'
              : 'text-neutral-600 dark:text-dark-text-secondary hover:text-neutral-900 dark:hover:text-dark-text-primary'
          }`}
        >
          POS Systems
        </button>
        <button
          onClick={() => setActiveTab('delivery')}
          className={`px-6 py-3 font-medium transition-colors ${
            activeTab === 'delivery'
              ? 'text-primary-500 border-b-2 border-primary-500'
              : 'text-neutral-600 dark:text-dark-text-secondary hover:text-neutral-900 dark:hover:text-dark-text-primary'
          }`}
        >
          Delivery Partners
        </button>
      </div>

      {/* POS Tab */}
      {activeTab === 'pos' && (
        <div>
          {posIntegrations.length > 0 && (
            <div className="mb-8">
              <h2 className="text-2xl font-semibold text-neutral-900 dark:text-dark-text-primary mb-6">
                Connected POS Systems
              </h2>
              <div className="grid gap-6 md:grid-cols-2">
                {posIntegrations.map((integration) => (
                  <div
                    key={integration.id}
                    className="bg-white dark:bg-dark-background-secondary rounded-lg border border-neutral-200 dark:border-dark-border-default p-6"
                  >
                    <h3 className="text-xl font-semibold text-neutral-900 dark:text-dark-text-primary mb-4">
                      {integration.provider.charAt(0).toUpperCase() + integration.provider.slice(1)}
                    </h3>
                    <div className="space-y-2 mb-6 text-sm">
                      <div className="flex justify-between">
                        <span className="text-neutral-600 dark:text-dark-text-secondary">Status:</span>
                        <span className={`font-medium ${integration.is_active ? 'text-success-600' : 'text-neutral-600'}`}>
                          {integration.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neutral-600 dark:text-dark-text-secondary">Auto Sync:</span>
                        <span className="font-medium text-neutral-900 dark:text-dark-text-primary">
                          {integration.auto_sync_orders ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                      {integration.last_synced_at && (
                        <div className="flex justify-between">
                          <span className="text-neutral-600 dark:text-dark-text-secondary">Last Synced:</span>
                          <span className="font-medium text-neutral-900 dark:text-dark-text-primary">
                            {new Date(integration.last_synced_at).toLocaleString('en-IN')}
                          </span>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => handleDisconnectPOS(integration.id)}
                      className="w-full px-4 py-2 bg-error-500 text-white rounded-md hover:bg-error-600 transition-colors"
                    >
                      Disconnect
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {availablePOS.length > 0 && (
            <div>
              <h2 className="text-2xl font-semibold text-neutral-900 dark:text-dark-text-primary mb-6">
                Available POS Systems
              </h2>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {availablePOS.map((provider) => (
                  <div
                    key={provider.id}
                    className="bg-white dark:bg-dark-background-secondary rounded-lg border border-neutral-200 dark:border-dark-border-default p-6"
                  >
                    <div className="text-4xl mb-4">{provider.logo}</div>
                    <h3 className="text-xl font-semibold text-neutral-900 dark:text-dark-text-primary mb-2">
                      {provider.name}
                    </h3>
                    <p className="text-sm text-neutral-600 dark:text-dark-text-secondary mb-6">
                      {provider.description}
                    </p>
                    <button
                      onClick={() => handleConnectPOS(provider.id)}
                      className="w-full px-4 py-2 bg-primary-500 text-white rounded-md hover:bg-primary-600 transition-colors"
                    >
                      Connect
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Delivery Tab */}
      {activeTab === 'delivery' && (
        <div>
          {deliveryIntegrations.length > 0 && (
            <div className="mb-8">
              <h2 className="text-2xl font-semibold text-neutral-900 dark:text-dark-text-primary mb-6">
                Connected Delivery Partners
              </h2>
              <div className="grid gap-6 md:grid-cols-2">
                {deliveryIntegrations.map((integration) => (
                  <div
                    key={integration.id}
                    className="bg-white dark:bg-dark-background-secondary rounded-lg border border-neutral-200 dark:border-dark-border-default p-6"
                  >
                    <h3 className="text-xl font-semibold text-neutral-900 dark:text-dark-text-primary mb-4">
                      {integration.provider.charAt(0).toUpperCase() + integration.provider.slice(1)}
                    </h3>
                    <div className="space-y-2 mb-6 text-sm">
                      <div className="flex justify-between">
                        <span className="text-neutral-600 dark:text-dark-text-secondary">Status:</span>
                        <span className={`font-medium ${integration.is_active ? 'text-success-600' : 'text-neutral-600'}`}>
                          {integration.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neutral-600 dark:text-dark-text-secondary">Cost Handling:</span>
                        <span className="font-medium text-neutral-900 dark:text-dark-text-primary capitalize">
                          {integration.cost_handling}
                        </span>
                      </div>
                      {integration.fixed_delivery_fee_cents && (
                        <div className="flex justify-between">
                          <span className="text-neutral-600 dark:text-dark-text-secondary">Delivery Fee:</span>
                          <span className="font-medium text-neutral-900 dark:text-dark-text-primary">
                            ₹{(integration.fixed_delivery_fee_cents / 100).toFixed(2)}
                          </span>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => handleDisconnectDelivery(integration.id)}
                      className="w-full px-4 py-2 bg-error-500 text-white rounded-md hover:bg-error-600 transition-colors"
                    >
                      Disconnect
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {availableDelivery.length > 0 && (
            <div>
              <h2 className="text-2xl font-semibold text-neutral-900 dark:text-dark-text-primary mb-6">
                Available Delivery Partners
              </h2>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {availableDelivery.map((provider) => (
                  <div
                    key={provider.id}
                    className="bg-white dark:bg-dark-background-secondary rounded-lg border border-neutral-200 dark:border-dark-border-default p-6"
                  >
                    <div className="text-4xl mb-4">{provider.logo}</div>
                    <h3 className="text-xl font-semibold text-neutral-900 dark:text-dark-text-primary mb-2">
                      {provider.name}
                    </h3>
                    <p className="text-sm text-neutral-600 dark:text-dark-text-secondary mb-6">
                      {provider.description}
                    </p>
                    <button
                      onClick={() => handleConnectDelivery(provider.id)}
                      className="w-full px-4 py-2 bg-primary-500 text-white rounded-md hover:bg-primary-600 transition-colors"
                    >
                      Connect
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
