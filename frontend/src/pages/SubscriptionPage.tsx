import { AlertCircle, CreditCard, Shield } from 'lucide-react';
import { useBusinessStore } from '../stores/businessStore';

export default function SubscriptionPage() {
  const { currentBusiness } = useBusinessStore();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Billing</h1>
        <p className="mt-1 text-gray-600">
          Paid subscriptions are launch-gated. The current build does not advertise paid plans, trials, upgrades, or billing portal actions.
        </p>
      </div>

      {!currentBusiness && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
          Create a business profile before billing can be evaluated for a future paid-plan launch.
        </div>
      )}

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
          <div>
            <h2 className="font-semibold">Subscription capability disabled</h2>
            <p className="mt-1 text-sm">
              The backend capability registry marks paid subscriptions as disabled until a launch decision, Stripe configuration evidence, webhook verification, and support runbooks are complete.
            </p>
          </div>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <CreditCard className="h-6 w-6 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">Current access</h2>
          </div>
          <p className="mt-3 text-sm text-gray-600">
            Ordering, menu management, and core seller tools remain available without a paid-plan claim in this build.
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <Shield className="h-6 w-6 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">Before paid launch</h2>
          </div>
          <ul className="mt-3 space-y-2 text-sm text-gray-600">
            <li>Stripe account, products, prices, and webhook secrets must be configured outside placeholders.</li>
            <li>Upgrade, cancellation, resumption, and invoice portal flows must pass end-to-end verification.</li>
            <li>Support and refund runbooks must be linked from the release evidence.</li>
          </ul>
        </div>
      </section>
    </div>
  );
}
