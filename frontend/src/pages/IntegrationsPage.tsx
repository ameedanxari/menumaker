import { useState } from 'react';
import { AlertTriangle, LockKeyhole } from 'lucide-react';

const posProviders = [
  { id: 'square', name: 'Square POS', logo: '⬛' },
  { id: 'dine', name: 'Dine POS', logo: '🍽️' },
  { id: 'zoho', name: 'Zoho Inventory', logo: '📦' },
];

const deliveryProviders = [
  { id: 'swiggy', name: 'Swiggy', logo: '🛵' },
  { id: 'zomato', name: 'Zomato', logo: '🔴' },
  { id: 'dunzo', name: 'Dunzo', logo: '📦' },
];

function ProviderCard({ provider }: { provider: { id: string; name: string; logo: string } }) {
  return (
    <div className="bg-white dark:bg-dark-background-secondary rounded-lg border border-neutral-200 dark:border-dark-border-default p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-4xl mb-4">{provider.logo}</div>
          <h3 className="text-xl font-semibold text-neutral-900 dark:text-dark-text-primary mb-2">
            {provider.name}
          </h3>
        </div>
        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
          Launch gated
        </span>
      </div>
      <p className="text-sm text-neutral-600 dark:text-dark-text-secondary mb-6">
        Provider connection is disabled until certification, credentials, monitoring, and rollback evidence are recorded.
      </p>
      <button
        disabled
        className="w-full px-4 py-2 bg-neutral-200 text-neutral-600 rounded-md cursor-not-allowed"
        aria-describedby={`${provider.id}-launch-gated`}
      >
        Connection disabled
      </button>
      <p id={`${provider.id}-launch-gated`} className="mt-3 text-xs text-neutral-500">
        No orders, menus, or delivery requests are sent to this provider from the launch build.
      </p>
    </div>
  );
}

export default function IntegrationsPage() {
  const [activeTab, setActiveTab] = useState<'pos' | 'delivery'>('pos');
  const providers = activeTab === 'pos' ? posProviders : deliveryProviders;

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-neutral-900 dark:text-dark-text-primary mb-2">
          Integrations
        </h1>
        <p className="text-lg text-neutral-600 dark:text-dark-text-secondary">
          POS and delivery-provider integrations are visible for roadmap context, but are not available in the current launch scope.
        </p>
      </div>

      <div className="mb-8 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0" />
          <div>
            <h2 className="font-semibold">Launch-gated capability</h2>
            <p className="mt-1 text-sm">
              POS sync and third-party delivery are disabled by the backend capability registry. The UI does not offer connect, disconnect, or sync actions until those capabilities are enabled with evidence.
            </p>
          </div>
        </div>
      </div>

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

      <div className="mb-6 flex items-center gap-2 text-sm font-medium text-neutral-700">
        <LockKeyhole className="h-4 w-4" />
        {activeTab === 'pos' ? 'POS providers disabled' : 'Delivery providers disabled'}
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {providers.map((provider) => (
          <ProviderCard key={provider.id} provider={provider} />
        ))}
      </div>
    </div>
  );
}
