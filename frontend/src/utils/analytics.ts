/**
 * Analytics and event tracking utilities
 *
 * Supports multiple analytics providers:
 * - Plausible (privacy-friendly)
 * - PostHog (product analytics)
 * - Google Analytics (optional)
 */

export interface AnalyticsEvent {
  name: string;
  properties?: Record<string, any>;
  timestamp?: number;
}

export interface AnalyticsUser {
  id: string;
  email?: string;
  properties?: Record<string, any>;
}

class AnalyticsService {
  private enabled: boolean = true;
  private userId: string | null = null;
  private userProperties: Record<string, any> = {};

  constructor() {
    // Check if analytics is enabled (respect Do Not Track)
    if (typeof navigator !== 'undefined' && navigator.doNotTrack === '1') {
      this.enabled = false;
      console.log('[Analytics] Disabled due to Do Not Track');
    }
  }

  /**
   * Initialize analytics with user
   */
  identify(user: AnalyticsUser) {
    if (!this.enabled) return;

    this.userId = user.id;
    this.userProperties = user.properties || {};

    // Plausible doesn't require explicit user identification
    // PostHog identification
    if (typeof window !== 'undefined' && (window as any).posthog) {
      (window as any).posthog.identify(user.id, {
        email: user.email,
        ...user.properties,
      });
    }

    console.log('[Analytics] User identified:', user.id);
  }

  /**
   * Track custom event
   */
  track(eventName: string, properties?: Record<string, any>) {
    if (!this.enabled) return;

    const event: AnalyticsEvent = {
      name: eventName,
      properties: {
        ...properties,
        userId: this.userId,
        ...this.userProperties,
      },
      timestamp: Date.now(),
    };

    // Plausible
    if (typeof window !== 'undefined' && (window as any).plausible) {
      (window as any).plausible(eventName, { props: properties });
    }

    // PostHog
    if (typeof window !== 'undefined' && (window as any).posthog) {
      (window as any).posthog.capture(eventName, properties);
    }

    // Console log in development
    if (import.meta.env.DEV) {
      console.log('[Analytics] Event tracked:', event);
    }
  }

  /**
   * Track page view
   */
  pageView(path: string, properties?: Record<string, any>) {
    if (!this.enabled) return;

    this.track('pageview', {
      path,
      ...properties,
    });
  }

  /**
   * Reset analytics (on logout)
   */
  reset() {
    if (!this.enabled) return;

    this.userId = null;
    this.userProperties = {};

    // PostHog reset
    if (typeof window !== 'undefined' && (window as any).posthog) {
      (window as any).posthog.reset();
    }

    console.log('[Analytics] Reset');
  }

  /**
   * Set user property
   */
  setUserProperty(key: string, value: any) {
    if (!this.enabled) return;

    this.userProperties[key] = value;

    // PostHog
    if (typeof window !== 'undefined' && (window as any).posthog) {
      (window as any).posthog.people.set({ [key]: value });
    }
  }
}

// Export singleton instance
export const analytics = new AnalyticsService();

/**
 * Predefined event names for consistency
 */
export const AnalyticsEvents = {
  // Authentication
  SIGNUP_STARTED: 'signup_started',
  SIGNUP_COMPLETED: 'signup_completed',
  LOGIN_COMPLETED: 'login_completed',
  LOGOUT: 'logout',

  // Business
  BUSINESS_CREATED: 'business_created',
  BUSINESS_UPDATED: 'business_updated',
  BUSINESS_SETTINGS_CHANGED: 'business_settings_changed',

  // Menu & Dishes
  DISH_CREATED: 'dish_created',
  DISH_UPDATED: 'dish_updated',
  DISH_DELETED: 'dish_deleted',
  DISH_IMAGE_UPLOADED: 'dish_image_uploaded',
  CATEGORY_CREATED: 'category_created',
  MENU_PUBLISHED: 'menu_published',
  MENU_UNPUBLISHED: 'menu_unpublished',
  MENU_SHARED: 'menu_shared',

  // Orders (Customer)
  DISH_ADDED_TO_CART: 'dish_added_to_cart',
  CART_VIEWED: 'cart_viewed',
  CHECKOUT_STARTED: 'checkout_started',
  ORDER_PLACED: 'order_placed',
  ORDER_CANCELLED: 'order_cancelled',

  // Orders (Seller)
  ORDER_VIEWED: 'order_viewed',
  ORDER_STATUS_UPDATED: 'order_status_updated',
  ORDERS_FILTERED: 'orders_filtered',
  ORDERS_SEARCHED: 'orders_searched',

  // Reports
  REPORT_VIEWED: 'report_viewed',
  REPORT_FILTERED: 'report_filtered',
  REPORT_EXPORTED: 'report_exported',

  // Engagement
  DASHBOARD_VIEWED: 'dashboard_viewed',
  HELP_CLICKED: 'help_clicked',
  SUPPORT_CONTACTED: 'support_contacted',

  // Errors
  ERROR_OCCURRED: 'error_occurred',
  API_ERROR: 'api_error',
} as const;

/**
 * Hook for tracking page views
 */
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export function usePageTracking() {
  const location = useLocation();

  useEffect(() => {
    analytics.pageView(location.pathname + location.search);
  }, [location]);
}

/**
 * Higher-order function to track events on function calls
 */
export function withEventTracking<T extends (...args: any[]) => any>(
  fn: T,
  eventName: string,
  getProperties?: (...args: Parameters<T>) => Record<string, any>
): T {
  return ((...args: Parameters<T>) => {
    const properties = getProperties?.(...args) || {};
    analytics.track(eventName, properties);
    return fn(...args);
  }) as T;
}

/**
 * Performance monitoring
 */
export const performance = {
  /**
   * Mark performance milestone
   */
  mark(name: string) {
    if (typeof window !== 'undefined' && window.performance) {
      window.performance.mark(name);
    }
  },

  /**
   * Measure performance between marks
   */
  measure(name: string, startMark: string, endMark: string) {
    if (typeof window !== 'undefined' && window.performance) {
      try {
        window.performance.measure(name, startMark, endMark);
        const measure = window.performance.getEntriesByName(name)[0];

        if (measure) {
          analytics.track('performance_metric', {
            metric: name,
            duration: measure.duration,
            startMark,
            endMark,
          });

          return measure.duration;
        }
      } catch (error) {
        console.error('[Performance] Measurement error:', error);
      }
    }
    return null;
  },

  /**
   * Track page load performance
   */
  trackPageLoad() {
    if (typeof window === 'undefined' || !window.performance) return;

    window.addEventListener('load', () => {
      setTimeout(() => {
        const perfData = window.performance.timing;
        const pageLoadTime = perfData.loadEventEnd - perfData.navigationStart;
        const connectTime = perfData.responseEnd - perfData.requestStart;
        const renderTime = perfData.domComplete - perfData.domLoading;

        analytics.track('page_performance', {
          pageLoadTime,
          connectTime,
          renderTime,
          domContentLoaded:
            perfData.domContentLoadedEventEnd - perfData.navigationStart,
        });

        // Web Vitals (if available)
        if ((window as any).webVitals) {
          (window as any).webVitals.getCLS((cls: any) => {
            analytics.track('web_vital_cls', { value: cls.value });
          });
          (window as any).webVitals.getFID((fid: any) => {
            analytics.track('web_vital_fid', { value: fid.value });
          });
          (window as any).webVitals.getLCP((lcp: any) => {
            analytics.track('web_vital_lcp', { value: lcp.value });
          });
        }
      }, 0);
    });
  },
};

/**
 * Error tracking
 */
export const errorTracking = {
  /**
   * Track error
   */
  track(error: Error, context?: Record<string, any>) {
    analytics.track(AnalyticsEvents.ERROR_OCCURRED, {
      errorMessage: error.message,
      errorStack: error.stack,
      ...context,
    });

    // Also send to error monitoring service (Sentry, etc.)
    if (typeof window !== 'undefined' && (window as any).Sentry) {
      (window as any).Sentry.captureException(error, { extra: context });
    }
  },

  /**
   * Track API error
   */
  trackApiError(
    endpoint: string,
    status: number,
    message: string,
    context?: Record<string, any>
  ) {
    analytics.track(AnalyticsEvents.API_ERROR, {
      endpoint,
      status,
      message,
      ...context,
    });
  },
};

/**
 * Initialize analytics on app load
 */
export function initializeAnalytics() {
  if (typeof window === 'undefined') return;

  // Track page load performance
  performance.trackPageLoad();

  console.log('[Analytics] Initialized');
}
