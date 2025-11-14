/**
 * Mobile and responsive utilities
 */

/**
 * Detect if device is mobile
 */
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;

  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

/**
 * Detect if device is iOS
 */
export function isIOS(): boolean {
  if (typeof window === 'undefined') return false;

  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

/**
 * Detect if device is Android
 */
export function isAndroid(): boolean {
  if (typeof window === 'undefined') return false;

  return /Android/.test(navigator.userAgent);
}

/**
 * Get viewport width
 */
export function getViewportWidth(): number {
  return Math.max(
    document.documentElement.clientWidth || 0,
    window.innerWidth || 0
  );
}

/**
 * Get viewport height
 */
export function getViewportHeight(): number {
  return Math.max(
    document.documentElement.clientHeight || 0,
    window.innerHeight || 0
  );
}

/**
 * Check if viewport matches breakpoint
 */
export const breakpoints = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

export function matchesBreakpoint(
  breakpoint: keyof typeof breakpoints
): boolean {
  return getViewportWidth() >= breakpoints[breakpoint];
}

/**
 * Hook to detect viewport size changes
 */
import { useState, useEffect } from 'react';

export function useViewportSize() {
  const [size, setSize] = useState({
    width: typeof window !== 'undefined' ? getViewportWidth() : 0,
    height: typeof window !== 'undefined' ? getViewportHeight() : 0,
  });

  useEffect(() => {
    const handleResize = () => {
      setSize({
        width: getViewportWidth(),
        height: getViewportHeight(),
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return size;
}

/**
 * Hook to detect mobile device
 */
export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(isMobileDevice());

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(isMobileDevice());
    };

    // Re-check on resize (for browser DevTools)
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return isMobile;
}

/**
 * Hook to detect screen orientation
 */
export function useOrientation() {
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>(
    typeof window !== 'undefined' && window.innerWidth > window.innerHeight
      ? 'landscape'
      : 'portrait'
  );

  useEffect(() => {
    const handleOrientationChange = () => {
      setOrientation(
        window.innerWidth > window.innerHeight ? 'landscape' : 'portrait'
      );
    };

    window.addEventListener('resize', handleOrientationChange);
    window.addEventListener('orientationchange', handleOrientationChange);

    return () => {
      window.removeEventListener('resize', handleOrientationChange);
      window.removeEventListener('orientationchange', handleOrientationChange);
    };
  }, []);

  return orientation;
}

/**
 * Hook to detect network status
 */
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

/**
 * Touch gesture utilities
 */
export class TouchGestureHandler {
  private startX: number = 0;
  private startY: number = 0;
  private threshold: number = 50; // minimum distance for swipe

  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;

  handleTouchStart = (e: TouchEvent) => {
    this.startX = e.touches[0].clientX;
    this.startY = e.touches[0].clientY;
  };

  handleTouchEnd = (e: TouchEvent) => {
    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;

    const deltaX = endX - this.startX;
    const deltaY = endY - this.startY;

    // Horizontal swipe
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      if (Math.abs(deltaX) > this.threshold) {
        if (deltaX > 0) {
          this.onSwipeRight?.();
        } else {
          this.onSwipeLeft?.();
        }
      }
    }
    // Vertical swipe
    else {
      if (Math.abs(deltaY) > this.threshold) {
        if (deltaY > 0) {
          this.onSwipeDown?.();
        } else {
          this.onSwipeUp?.();
        }
      }
    }
  };

  attach(element: HTMLElement) {
    element.addEventListener('touchstart', this.handleTouchStart, {
      passive: true,
    });
    element.addEventListener('touchend', this.handleTouchEnd, { passive: true });

    return () => {
      element.removeEventListener('touchstart', this.handleTouchStart);
      element.removeEventListener('touchend', this.handleTouchEnd);
    };
  }
}

/**
 * Prevent body scroll (for modals on mobile)
 */
export function lockBodyScroll() {
  const scrollbarWidth =
    window.innerWidth - document.documentElement.clientWidth;

  document.body.style.overflow = 'hidden';
  document.body.style.paddingRight = `${scrollbarWidth}px`;
}

export function unlockBodyScroll() {
  document.body.style.overflow = '';
  document.body.style.paddingRight = '';
}

/**
 * Safe area insets for iOS notch/home indicator
 */
export function getSafeAreaInsets() {
  if (typeof window === 'undefined' || !CSS.supports('padding-top: env(safe-area-inset-top)')) {
    return { top: 0, right: 0, bottom: 0, left: 0 };
  }

  const computedStyle = getComputedStyle(document.documentElement);

  return {
    top: parseInt(computedStyle.getPropertyValue('--safe-area-inset-top') || '0'),
    right: parseInt(computedStyle.getPropertyValue('--safe-area-inset-right') || '0'),
    bottom: parseInt(computedStyle.getPropertyValue('--safe-area-inset-bottom') || '0'),
    left: parseInt(computedStyle.getPropertyValue('--safe-area-inset-left') || '0'),
  };
}

/**
 * Hook for safe area insets
 */
export function useSafeAreaInsets() {
  const [insets, setInsets] = useState(getSafeAreaInsets());

  useEffect(() => {
    const handleResize = () => {
      setInsets(getSafeAreaInsets());
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return insets;
}

/**
 * Responsive image srcset helper
 */
export function generateSrcSet(baseUrl: string, sizes: number[]): string {
  return sizes
    .map((size) => `${baseUrl}?w=${size} ${size}w`)
    .join(', ');
}

/**
 * Responsive sizes attribute helper
 */
export function generateSizes(
  breakpoints: Array<{ maxWidth: string; size: string }>,
  defaultSize: string
): string {
  const mediaQueries = breakpoints
    .map((bp) => `(max-width: ${bp.maxWidth}) ${bp.size}`)
    .join(', ');

  return `${mediaQueries}, ${defaultSize}`;
}
