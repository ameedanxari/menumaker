import { useNavigate } from 'react-router-dom';
import { AlertTriangle, CreditCard } from 'lucide-react';

export function SubscriptionStatusWidget() {
  const navigate = useNavigate();

  return (
    <div className="card hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate('/subscription')}>
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-amber-100 p-2">
          <CreditCard className="h-5 w-5 text-amber-700" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-900">Billing</h3>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
              Launch gated
            </span>
          </div>
          <p className="mt-2 text-sm text-gray-600">
            Paid subscription plans are disabled in this launch build. Core access does not require an upgrade.
          </p>
          <p className="mt-3 flex items-center gap-1 text-xs text-amber-700">
            <AlertTriangle className="h-3 w-3" />
            No billing API calls or upgrade actions are offered until subscriptions are enabled.
          </p>
        </div>
      </div>
    </div>
  );
}
