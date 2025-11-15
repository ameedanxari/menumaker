import { useTheme } from '../../providers/ThemeProvider';
import { Button } from './Button';
import { cn } from '../../lib/utils';

/**
 * ThemeToggle Component
 * Phase 3: Design System & Theming (US3.12)
 *
 * A button to toggle between light, dark, and system theme preferences.
 *
 * @example
 * <ThemeToggle />
 * // Or with dropdown variant:
 * <ThemeToggle variant="dropdown" />
 */

export interface ThemeToggleProps {
  /** Visual variant */
  variant?: 'icon' | 'dropdown';
  /** Custom className */
  className?: string;
}

export function ThemeToggle({ variant = 'icon', className }: ThemeToggleProps) {
  const { theme, setTheme, resolvedTheme } = useTheme();

  if (variant === 'icon') {
    const handleToggle = () => {
      // Cycle through: light → dark → system → light
      if (theme === 'light') {
        setTheme('dark');
      } else if (theme === 'dark') {
        setTheme('system');
      } else {
        setTheme('light');
      }
    };

    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={handleToggle}
        className={cn('h-9 w-9 p-0', className)}
        aria-label={`Switch theme (current: ${theme})`}
      >
        {/* Sun icon (light mode) */}
        {resolvedTheme === 'light' && (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2" />
            <path d="M12 20v2" />
            <path d="m4.93 4.93 1.41 1.41" />
            <path d="m17.66 17.66 1.41 1.41" />
            <path d="M2 12h2" />
            <path d="M20 12h2" />
            <path d="m6.34 17.66-1.41 1.41" />
            <path d="m19.07 4.93-1.41 1.41" />
          </svg>
        )}

        {/* Moon icon (dark mode) */}
        {resolvedTheme === 'dark' && (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
          </svg>
        )}
      </Button>
    );
  }

  // Dropdown variant (shows all 3 options)
  return (
    <div className={cn('relative inline-block text-left', className)}>
      <select
        value={theme}
        onChange={(e) => setTheme(e.target.value as 'light' | 'dark' | 'system')}
        className="block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm transition-colors hover:border-neutral-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
      >
        <option value="light">☀️ Light</option>
        <option value="dark">🌙 Dark</option>
        <option value="system">💻 System</option>
      </select>
    </div>
  );
}
