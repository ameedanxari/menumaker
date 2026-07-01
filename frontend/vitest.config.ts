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
      all: true,
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/main.tsx',
        'src/**/*.d.ts',
        'src/**/index.ts',
        'src/**/index.tsx',
        '**/*.config.*',
        '**/node_modules/**',
        '**/dist/**',
        // Reviewed non-runtime/generated surfaces only. Route pages, layouts,
        // providers, menus, subscriptions, forms, and payment components remain
        // in coverage so product code cannot disappear behind blanket excludes.
        'src/observability/**/*.test.ts',
        'src/**/*.test.{ts,tsx}',
      ],
      thresholds: {
        statements: 45,
        branches: 35,
        functions: 40,
        lines: 45,
        perFile: true,
        100: false,
      },
    },
  },
});
