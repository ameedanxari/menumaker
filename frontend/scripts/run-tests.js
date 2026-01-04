import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Explicit test files to avoid glob quirks/hanging runners
const files = [
  'src/utils/validation.test.ts',
  'src/utils/mobile.test.ts',
  'src/utils/analytics.test.ts',
  'src/utils/accessibility.test.ts',
  'src/lib/utils.test.ts',
  'src/hooks/useForm.test.ts',
  'src/services/api.test.ts',
  'src/stores/cartStore.test.ts',
  'src/stores/authStore.test.ts',
  'src/stores/menuStore.test.ts',
  'src/stores/orderStore.test.ts',
  'src/stores/notificationStore.test.ts',
  'src/stores/businessStore.test.ts',
  'src/stores/settingsStore.test.ts',
  'src/pages/OrdersPage.test.tsx',
  'src/pages/SettingsPage.test.tsx',
  'src/components/ui/Button.test.tsx',
  'src/components/ui/Card.test.tsx',
  'src/components/ui/Input.test.tsx',
  'src/components/common/Button.test.tsx',
  'src/components/forms/FormInput.test.tsx',
  'src/components/notifications/NotificationBell.test.tsx',
  'src/components/notifications/NotificationItem.test.tsx',
  'src/components/notifications/NotificationDropdown.test.tsx',
  'src/components/payments/CheckoutForm.test.tsx',
  'src/components/payments/PaymentModal.test.tsx',
];

for (const file of files) {
  const args = ['vitest', 'run', '--pool=forks', '--watch=false', file];
  const res = spawnSync('npx', args, { stdio: 'inherit', cwd: repoRoot });
  if (res.status !== 0) {
    process.exit(res.status ?? 1);
  }
}

process.exit(0);
