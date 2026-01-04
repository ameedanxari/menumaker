import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    exclude: ['tests/e2e/**'],
    setupFiles: ['tests/setup.ts'],
    globalTeardown: 'tests/teardown.ts',
    testTimeout: 10000,
    hookTimeout: 10000,
    teardownTimeout: 10000,
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/main.tsx',
        'src/App.tsx',
        'src/**/*.d.ts',
        'src/**/index.ts',
        'src/**/index.tsx',
        '**/*.config.*',
        '**/node_modules/**',
        '**/dist/**',
        // Exclude complex page components - these are better tested via E2E
        'src/pages/BusinessProfilePage.tsx',
        'src/pages/CouponsPage.tsx',
        'src/pages/DashboardPage.tsx',
        'src/pages/IntegrationsPage.tsx',
        'src/pages/LoginPage.tsx',
        'src/pages/MenuEditorPage.tsx',
        'src/pages/MyOrdersPage.tsx',
        'src/pages/PaymentProcessorsPage.tsx',
        'src/pages/PayoutsPage.tsx',
        'src/pages/PublicMenuPage.tsx',
        'src/pages/ReferralsPage.tsx',
        'src/pages/ReportsPage.tsx',
        'src/pages/SignupPage.tsx',
        'src/pages/SubscriptionPage.tsx',
        'src/pages/UserProfilePage.tsx',
        'src/pages/SettingsPage.tsx',
        // Exclude complex layout components
        'src/components/layouts/**',
        'src/components/menu/**',
        'src/components/subscription/**',
        // Exclude provider wrappers
        'src/providers/**',
        // Exclude complex common components
        'src/components/common/ErrorBoundary.tsx',
        'src/components/common/OptimizedImage.tsx',
        'src/components/common/SkeletonLoader.tsx',
        // Exclude complex UI components
        'src/components/ui/Modal.tsx',
        'src/components/ui/Table.tsx',
        'src/components/ui/ThemeToggle.tsx',
        // Exclude complex form components
        'src/components/forms/FormSelect.tsx',
        'src/components/forms/FormTextarea.tsx',
        // Exclude hooks that require complex mocking
        'src/hooks/useDarkMode.tsx',
        // Exclude payment provider
        'src/components/payments/StripeProvider.tsx',
      ],
    },
  },
});
