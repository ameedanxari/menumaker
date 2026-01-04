import { afterEach, vi } from 'vitest';

// Ensure fake timers never leak between tests
afterEach(() => {
  vi.useRealTimers();
});
