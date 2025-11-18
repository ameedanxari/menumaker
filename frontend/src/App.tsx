import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { usePageTracking } from './utils/analytics';
import { SkipToContent } from './utils/accessibility';

// Layouts (eager loaded as they're needed immediately)
import AuthLayout from './components/layouts/AuthLayout';
import DashboardLayout from './components/layouts/DashboardLayout';

// Pages (lazy loaded for code splitting)
const LoginPage = lazy(() => import('./pages/LoginPage'));
const SignupPage = lazy(() => import('./pages/SignupPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const BusinessProfilePage = lazy(() => import('./pages/BusinessProfilePage'));
const MenuEditorPage = lazy(() => import('./pages/MenuEditorPage'));
const OrdersPage = lazy(() => import('./pages/OrdersPage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));
const SubscriptionPage = lazy(() => import('./pages/SubscriptionPage'));
const PublicMenuPage = lazy(() => import('./pages/PublicMenuPage'));

// Phase 3 Pages
const PaymentProcessorsPage = lazy(() => import('./pages/PaymentProcessorsPage'));
const PayoutsPage = lazy(() => import('./pages/PayoutsPage'));
const IntegrationsPage = lazy(() => import('./pages/IntegrationsPage'));
const CouponsPage = lazy(() => import('./pages/CouponsPage'));
const ReferralsPage = lazy(() => import('./pages/ReferralsPage'));

// User Pages
const UserProfilePage = lazy(() => import('./pages/UserProfilePage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const MyOrdersPage = lazy(() => import('./pages/MyOrdersPage'));

// Loading fallback component
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-600">Loading...</p>
      </div>
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function AppContent() {
  // Track page views automatically
  usePageTracking();

  return (
    <>
      <SkipToContent />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Public routes */}
          <Route path="/:businessSlug" element={<PublicMenuPage />} />

          {/* Auth routes */}
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
          </Route>

          {/* Protected dashboard routes */}
          <Route
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/business/profile" element={<BusinessProfilePage />} />
            <Route path="/menu" element={<MenuEditorPage />} />
            <Route path="/orders" element={<OrdersPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/subscription" element={<SubscriptionPage />} />
            {/* Phase 3 Routes */}
            <Route path="/payments" element={<PaymentProcessorsPage />} />
            <Route path="/payouts" element={<PayoutsPage />} />
            <Route path="/integrations" element={<IntegrationsPage />} />
            <Route path="/coupons" element={<CouponsPage />} />
            <Route path="/referrals" element={<ReferralsPage />} />
            {/* User Routes */}
            <Route path="/profile" element={<UserProfilePage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/my-orders" element={<MyOrdersPage />} />
          </Route>

          {/* Redirect root to dashboard or login */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Suspense>
    </>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
