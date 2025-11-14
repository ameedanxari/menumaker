/**
 * Accessibility utilities for WCAG 2.1 AA compliance
 */

/**
 * Generate unique ID for ARIA attributes
 */
let idCounter = 0;
export function generateId(prefix: string = 'id'): string {
  return `${prefix}-${++idCounter}-${Date.now()}`;
}

/**
 * Focus management utilities
 */
export const focusManagement = {
  /**
   * Trap focus within an element (for modals, dropdowns)
   */
  trapFocus(element: HTMLElement) {
    const focusableElements = element.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstFocusable) {
          lastFocusable?.focus();
          e.preventDefault();
        }
      } else {
        // Tab
        if (document.activeElement === lastFocusable) {
          firstFocusable?.focus();
          e.preventDefault();
        }
      }
    };

    element.addEventListener('keydown', handleTabKey);

    // Return cleanup function
    return () => {
      element.removeEventListener('keydown', handleTabKey);
    };
  },

  /**
   * Focus first focusable element
   */
  focusFirst(element: HTMLElement) {
    const focusable = element.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    focusable?.focus();
  },

  /**
   * Return focus to previous element
   */
  returnFocus(element: HTMLElement) {
    element.focus();
  },
};

/**
 * Keyboard navigation utilities
 */
export const keyboard = {
  /**
   * Check if key is Enter or Space (activation keys)
   */
  isActivationKey(event: KeyboardEvent): boolean {
    return event.key === 'Enter' || event.key === ' ';
  },

  /**
   * Check if key is Escape
   */
  isEscapeKey(event: KeyboardEvent): boolean {
    return event.key === 'Escape' || event.key === 'Esc';
  },

  /**
   * Check if key is Arrow key
   */
  isArrowKey(event: KeyboardEvent): boolean {
    return ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(
      event.key
    );
  },

  /**
   * Handle button-like div/span activation
   */
  handleActivation(
    event: KeyboardEvent,
    callback: () => void,
    preventDefault: boolean = true
  ) {
    if (this.isActivationKey(event)) {
      if (preventDefault) {
        event.preventDefault();
      }
      callback();
    }
  },
};

/**
 * ARIA live region announcer for screen readers
 */
class LiveAnnouncer {
  private liveRegion: HTMLElement | null = null;

  private ensureLiveRegion() {
    if (!this.liveRegion) {
      this.liveRegion = document.createElement('div');
      this.liveRegion.setAttribute('aria-live', 'polite');
      this.liveRegion.setAttribute('aria-atomic', 'true');
      this.liveRegion.className = 'sr-only'; // Screen reader only
      document.body.appendChild(this.liveRegion);
    }
    return this.liveRegion;
  }

  /**
   * Announce message to screen readers
   */
  announce(message: string, priority: 'polite' | 'assertive' = 'polite') {
    const region = this.ensureLiveRegion();
    region.setAttribute('aria-live', priority);

    // Clear previous message
    region.textContent = '';

    // Announce new message after a brief delay
    setTimeout(() => {
      region.textContent = message;
    }, 100);

    // Clear message after announced
    setTimeout(() => {
      region.textContent = '';
    }, 3000);
  }

  /**
   * Clean up live region
   */
  cleanup() {
    if (this.liveRegion) {
      document.body.removeChild(this.liveRegion);
      this.liveRegion = null;
    }
  }
}

export const liveAnnouncer = new LiveAnnouncer();

/**
 * Screen reader only text utility
 */
export function VisuallyHidden({ children }: { children: React.ReactNode }) {
  return (
    <span className="sr-only absolute w-px h-px p-0 -m-px overflow-hidden whitespace-nowrap border-0">
      {children}
    </span>
  );
}

/**
 * Skip navigation link for keyboard users
 */
export function SkipToContent({ targetId = 'main-content' }: { targetId?: string }) {
  const handleSkip = (e: React.MouseEvent) => {
    e.preventDefault();
    const target = document.getElementById(targetId);
    if (target) {
      target.focus();
      target.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <a
      href={`#${targetId}`}
      onClick={handleSkip}
      className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:rounded-md focus:shadow-lg"
    >
      Skip to main content
    </a>
  );
}

/**
 * Color contrast checker (WCAG AA: 4.5:1 for normal text, 3:1 for large text)
 */
export function getContrastRatio(color1: string, color2: string): number {
  const getLuminance = (color: string): number => {
    // Simple RGB luminance calculation
    // This is a simplified version - for production use a proper color library
    const rgb = color.match(/\d+/g);
    if (!rgb) return 0;

    const [r, g, b] = rgb.map((val) => {
      const sRGB = parseInt(val) / 255;
      return sRGB <= 0.03928
        ? sRGB / 12.92
        : Math.pow((sRGB + 0.055) / 1.055, 2.4);
    });

    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };

  const lum1 = getLuminance(color1);
  const lum2 = getLuminance(color2);
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);

  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Check if color contrast meets WCAG AA standards
 */
export function meetsContrastRatio(
  color1: string,
  color2: string,
  isLargeText: boolean = false
): boolean {
  const ratio = getContrastRatio(color1, color2);
  const requiredRatio = isLargeText ? 3 : 4.5;
  return ratio >= requiredRatio;
}

/**
 * Focus visible utility for custom focus indicators
 */
export function useFocusVisible() {
  const [isFocusVisible, setIsFocusVisible] = React.useState(false);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        setIsFocusVisible(true);
      }
    };

    const handleMouseDown = () => {
      setIsFocusVisible(false);
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleMouseDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, []);

  return isFocusVisible;
}

// Add React import for JSX
import React from 'react';
