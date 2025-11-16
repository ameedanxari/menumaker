import { useState, useEffect } from 'react';

/**
 * Custom hook for managing dark mode state
 *
 * Features:
 * - Persists preference to localStorage
 * - Respects system preference on first load
 * - Syncs across browser tabs
 * - Applies 'dark' class to document element
 *
 * @returns {object} { darkMode, toggleDarkMode, setDarkMode }
 *
 * @example
 * ```tsx
 * function App() {
 *   const { darkMode, toggleDarkMode } = useDarkMode();
 *
 *   return (
 *     <button onClick={toggleDarkMode}>
 *       {darkMode ? '☀️ Light Mode' : '🌙 Dark Mode'}
 *     </button>
 *   );
 * }
 * ```
 */
export function useDarkMode() {
  // Check system preference or localStorage
  const getInitialMode = (): boolean => {
    // Check localStorage first
    const savedMode = localStorage.getItem('theme');
    if (savedMode) {
      return savedMode === 'dark';
    }

    // Fall back to system preference
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  };

  const [darkMode, setDarkMode] = useState<boolean>(getInitialMode);

  // Apply dark mode class to document
  useEffect(() => {
    const root = document.documentElement;

    if (darkMode) {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  // Listen for system preference changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = (e: MediaQueryListEvent) => {
      // Only update if user hasn't manually set a preference
      if (!localStorage.getItem('theme')) {
        setDarkMode(e.matches);
      }
    };

    // Modern browsers
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
    // Legacy browsers
    else if (mediaQuery.addListener) {
      mediaQuery.addListener(handleChange);
      return () => mediaQuery.removeListener(handleChange);
    }
  }, []);

  // Sync across browser tabs
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'theme') {
        setDarkMode(e.newValue === 'dark');
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const toggleDarkMode = () => {
    setDarkMode((prev) => !prev);
  };

  return {
    darkMode,
    setDarkMode,
    toggleDarkMode,
  };
}

/**
 * Dark mode toggle component
 *
 * @example
 * ```tsx
 * import { DarkModeToggle } from './components/DarkModeToggle';
 *
 * function Header() {
 *   return (
 *     <header>
 *       <DarkModeToggle />
 *     </header>
 *   );
 * }
 * ```
 */
export function DarkModeToggleButton() {
  const { darkMode, toggleDarkMode } = useDarkMode();

  return (
    <button
      onClick={toggleDarkMode}
      className="p-2 rounded-md hover:bg-neutral-100 dark:hover:bg-dark-background-tertiary transition-colors"
      aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {darkMode ? (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5 text-neutral-600 dark:text-dark-text-primary"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          {/* Sun Icon */}
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
          />
        </svg>
      ) : (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5 text-neutral-600 dark:text-dark-text-primary"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          {/* Moon Icon */}
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
          />
        </svg>
      )}
    </button>
  );
}

export default useDarkMode;
