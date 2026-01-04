import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { analytics, AnalyticsService, AnalyticsEvents, withEventTracking, errorTracking } from './analytics.ts';

describe('Analytics Utils', () => {
    let mockPosthog: any;
    let mockPlausible: any;

    beforeEach(() => {
        mockPosthog = {
            identify: vi.fn(),
            capture: vi.fn(),
            reset: vi.fn(),
            people: { set: vi.fn() }
        };
        mockPlausible = vi.fn();

        vi.stubGlobal('posthog', mockPosthog);
        vi.stubGlobal('plausible', mockPlausible);

        // We need to access private enabled property or re-instantiate to reset state if needed
        // But since `analytics` is a singleton exported, we test it as is.
        // However, the class checks window object props on call usually.
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.clearAllMocks();
    });

    describe('AnalyticsService', () => {
        it('should identify user', () => {
            const user = { id: '123', email: 'test@example.com', properties: { role: 'admin' } };
            analytics.identify(user);

            expect(mockPosthog.identify).toHaveBeenCalledWith('123', {
                email: 'test@example.com',
                role: 'admin'
            });
        });

        it('should track custom event', () => {
            analytics.track('test_event', { prop: 'value' });

            expect(mockPlausible).toHaveBeenCalledWith('test_event', { props: { prop: 'value' } });
            expect(mockPosthog.capture).toHaveBeenCalledWith('test_event', { prop: 'value' });
        });

        it('should track page view', () => {
            analytics.pageView('/home', { referrer: 'google' });

            expect(mockPlausible).toHaveBeenCalledWith('pageview', { props: { path: '/home', referrer: 'google' } });
            expect(mockPosthog.capture).toHaveBeenCalledWith('pageview', expect.objectContaining({ path: '/home' }));
        });

        it('should reset analytics', () => {
            analytics.reset();
            expect(mockPosthog.reset).toHaveBeenCalled();
        });

        it('should set user property', () => {
            analytics.setUserProperty('plan', 'pro');
            expect(mockPosthog.people.set).toHaveBeenCalledWith({ plan: 'pro' });
        });
    });

    describe('withEventTracking', () => {
        it('should track event and call original function', () => {
            const originalFn = vi.fn().mockReturnValue('result');
            const trackedFn = withEventTracking(originalFn, 'function_called', (arg) => ({ arg }));

            const result = trackedFn('test_arg');

            expect(result).toBe('result');
            expect(originalFn).toHaveBeenCalledWith('test_arg');
            expect(mockPosthog.capture).toHaveBeenCalledWith('function_called', { arg: 'test_arg' });
        });
    });

    describe('errorTracking', () => {
        it('should track error', () => {
            const error = new Error('Test Error');
            errorTracking.track(error, { context: 'test' });

            expect(mockPosthog.capture).toHaveBeenCalledWith(AnalyticsEvents.ERROR_OCCURRED, expect.objectContaining({
                errorMessage: 'Test Error',
                context: 'test'
            }));
        });

        it('should track api error', () => {
            errorTracking.trackApiError('/api/test', 404, 'Not Found');

            expect(mockPosthog.capture).toHaveBeenCalledWith(AnalyticsEvents.API_ERROR, expect.objectContaining({
                endpoint: '/api/test',
                status: 404,
                message: 'Not Found'
            }));
        });
    });
});
