import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Flag, LifeBuoy, ShieldCheck, ToggleLeft, Users } from 'lucide-react';
import { api } from '../services/api';

type AdminSectionState = {
  analytics: unknown | null;
  users: unknown | null;
  moderation: unknown | null;
  tickets: unknown | null;
  featureFlags: unknown | null;
};

function extractList(value: unknown, preferredKeys: string[]): unknown[] {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== 'object') return [];

  const objectValue = value as Record<string, unknown>;
  for (const key of preferredKeys) {
    const direct = objectValue[key];
    if (Array.isArray(direct)) return direct;
  }

  const data = objectValue.data;
  if (data && typeof data === 'object') {
    return extractList(data, preferredKeys);
  }

  return [];
}

function extractCount(value: unknown, preferredKeys: string[], fallbackListKeys: string[]): number {
  if (!value || typeof value !== 'object') return 0;
  const objectValue = value as Record<string, unknown>;

  for (const key of preferredKeys) {
    const direct = objectValue[key];
    if (typeof direct === 'number') return direct;
  }

  const data = objectValue.data;
  if (data && typeof data === 'object') {
    return extractCount(data, preferredKeys, fallbackListKeys);
  }

  return extractList(value, fallbackListKeys).length;
}

function getItemLabel(item: unknown, fallback: string): string {
  if (!item || typeof item !== 'object') return fallback;
  const record = item as Record<string, unknown>;
  const label = record.email ?? record.name ?? record.title ?? record.subject ?? record.flag_type ?? record.key ?? record.id;
  return typeof label === 'string' ? label : fallback;
}

export default function AdminPortalPage() {
  const [state, setState] = useState<AdminSectionState>({
    analytics: null,
    users: null,
    moderation: null,
    tickets: null,
    featureFlags: null,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [accessMessage, setAccessMessage] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function loadAdminPortal() {
      setIsLoading(true);
      setAccessMessage('');

      const requests = await Promise.allSettled([
        api.get('/admin/analytics/dashboard'),
        api.get('/admin/users?limit=5'),
        api.get('/admin/moderation/queue?limit=5&status=pending'),
        api.get('/admin/tickets?limit=5&status=open'),
        api.get('/admin/feature-flags'),
      ]);

      if (!isMounted) return;

      const rejected = requests.find((result) => result.status === 'rejected');
      const status = rejected && rejected.status === 'rejected'
        ? (rejected.reason as { response?: { status?: number } })?.response?.status
        : undefined;

      if (status === 401 || status === 403) {
        setAccessMessage('This portal uses the backend admin APIs and requires an authenticated support, moderator, or super-admin account.');
      }

      setState({
        analytics: requests[0].status === 'fulfilled' ? requests[0].value : null,
        users: requests[1].status === 'fulfilled' ? requests[1].value : null,
        moderation: requests[2].status === 'fulfilled' ? requests[2].value : null,
        tickets: requests[3].status === 'fulfilled' ? requests[3].value : null,
        featureFlags: requests[4].status === 'fulfilled' ? requests[4].value : null,
      });
      setIsLoading(false);
    }

    void loadAdminPortal();

    return () => {
      isMounted = false;
    };
  }, []);

  const cards = useMemo(() => [
    {
      title: 'Users',
      icon: Users,
      count: extractCount(state.users, ['total', 'totalUsers', 'total_users'], ['users']),
      items: extractList(state.users, ['users']).slice(0, 5),
      empty: 'No user records returned.',
    },
    {
      title: 'Moderation Queue',
      icon: Flag,
      count: extractCount(state.moderation, ['total', 'pending', 'pending_count'], ['flags', 'queue']),
      items: extractList(state.moderation, ['flags', 'queue']).slice(0, 5),
      empty: 'No pending moderation items returned.',
    },
    {
      title: 'Support Tickets',
      icon: LifeBuoy,
      count: extractCount(state.tickets, ['total', 'open', 'open_count'], ['tickets']),
      items: extractList(state.tickets, ['tickets']).slice(0, 5),
      empty: 'No open tickets returned.',
    },
    {
      title: 'Feature Flags',
      icon: ToggleLeft,
      count: extractCount(state.featureFlags, ['total', 'totalFlags', 'total_flags'], ['featureFlags', 'flags']),
      items: extractList(state.featureFlags, ['featureFlags', 'flags']).slice(0, 5),
      empty: 'No feature flags returned.',
    },
  ], [state]);

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-8 w-8 text-primary-600" />
          <h1 className="text-3xl font-bold text-gray-900">Admin Portal</h1>
        </div>
        <p className="mt-2 text-gray-600">
          First-party operator surface for the existing admin APIs: user review, moderation, support, analytics, and feature-flag readiness.
        </p>
      </div>

      {accessMessage && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 flex gap-3">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <p>{accessMessage}</p>
        </div>
      )}

      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Platform Analytics</h2>
        {isLoading ? (
          <p className="mt-4 text-sm text-gray-600">Loading admin API evidence...</p>
        ) : state.analytics ? (
          <pre className="mt-4 max-h-72 overflow-auto rounded-lg bg-gray-950 p-4 text-xs text-gray-100">
            {JSON.stringify(state.analytics, null, 2)}
          </pre>
        ) : (
          <p className="mt-4 text-sm text-gray-600">Analytics are unavailable to this session.</p>
        )}
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div key={card.title} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <card.icon className="h-5 w-5 text-primary-600" />
                <h2 className="font-semibold text-gray-900">{card.title}</h2>
              </div>
              <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700">
                {card.count}
              </span>
            </div>
            <div className="mt-4 space-y-2">
              {card.items.length > 0 ? (
                card.items.map((item, index) => (
                  <div key={index} className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700">
                    {getItemLabel(item, `${card.title} item ${index + 1}`)}
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-600">{isLoading ? 'Loading...' : card.empty}</p>
              )}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
