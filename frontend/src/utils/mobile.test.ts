import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import {
    isMobileDevice,
    isIOS,
    isAndroid,
    getViewportWidth,
    getViewportHeight,
    matchesBreakpoint,
    breakpoints,
    generateSrcSet,
    generateSizes,
    lockBodyScroll,
    unlockBodyScroll,
    TouchGestureHandler,
    getSafeAreaInsets,
} from './mobile.ts';

describe('Mobile Utils', () => {
    const originalUserAgent = navigator.userAgent;

    afterEach(() => {
        Object.defineProperty(navigator, 'userAgent', {
            value: originalUserAgent,
            writable: true
        });
    });

    describe('Device Detection', () => {
        it('should detect iPhone as mobile and iOS', () => {
            Object.defineProperty(navigator, 'userAgent', {
                value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
                writable: true
            });
            expect(isMobileDevice()).toBe(true);
            expect(isIOS()).toBe(true);
            expect(isAndroid()).toBe(false);
        });

        it('should detect Android as mobile and Android', () => {
            Object.defineProperty(navigator, 'userAgent', {
                value: 'Mozilla/5.0 (Linux; Android 10; SM-G981B)',
                writable: true
            });
            expect(isMobileDevice()).toBe(true);
            expect(isIOS()).toBe(false);
            expect(isAndroid()).toBe(true);
        });

        it('should detect Desktop as non-mobile', () => {
            Object.defineProperty(navigator, 'userAgent', {
                value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
                writable: true
            });
            // The regEx includes many things, usually desktop chrome is not there
            expect(isMobileDevice()).toBe(false);
            expect(isIOS()).toBe(false);
            expect(isAndroid()).toBe(false);
        });

        it('should detect iPad as iOS', () => {
            Object.defineProperty(navigator, 'userAgent', {
                value: 'Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X)',
                writable: true
            });
            expect(isIOS()).toBe(true);
        });
    });

    describe('Viewport Helpers', () => {
        it('should get viewport dimensions', () => {
            // JSDOM defaults might be set, but we can verify they return numbers
            expect(typeof getViewportWidth()).toBe('number');
            expect(typeof getViewportHeight()).toBe('number');
        });

        it('should check breakpoints correctly', () => {
            // Mock window width
            Object.defineProperty(window, 'innerWidth', {
                writable: true,
                configurable: true,
                value: 500
            });

            // We also need to mock document.documentElement.clientWidth if the function uses Math.max
            Object.defineProperty(document.documentElement, 'clientWidth', {
                writable: true,
                configurable: true,
                value: 500
            });

            expect(matchesBreakpoint('sm')).toBe(false); // 500 < 640

            Object.defineProperty(window, 'innerWidth', { value: 800 });
            Object.defineProperty(document.documentElement, 'clientWidth', { value: 800 });

            expect(matchesBreakpoint('sm')).toBe(true); // 800 >= 640
            expect(matchesBreakpoint('md')).toBe(true); // 800 >= 768
            expect(matchesBreakpoint('lg')).toBe(false); // 800 < 1024
        });

        it('should have correct breakpoint values', () => {
            expect(breakpoints.sm).toBe(640);
            expect(breakpoints.md).toBe(768);
            expect(breakpoints.lg).toBe(1024);
            expect(breakpoints.xl).toBe(1280);
            expect(breakpoints['2xl']).toBe(1536);
        });
    });

    describe('Responsive Images', () => {
        it('should generate srcset correctly', () => {
            const srcset = generateSrcSet('img.jpg', [320, 640, 1024]);
            expect(srcset).toBe('img.jpg?w=320 320w, img.jpg?w=640 640w, img.jpg?w=1024 1024w');
        });

        it('should generate sizes attribute correctly', () => {
            const sizes = generateSizes([
                { maxWidth: '640px', size: '100vw' },
                { maxWidth: '1024px', size: '50vw' }
            ], '33vw');

            expect(sizes).toBe('(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw');
        });

        it('should handle empty breakpoints array', () => {
            const sizes = generateSizes([], '100vw');
            expect(sizes).toBe(', 100vw');
        });
    });

    describe('Body Scroll Lock', () => {
        beforeEach(() => {
            document.body.style.overflow = '';
            document.body.style.paddingRight = '';
        });

        it('should lock body scroll', () => {
            lockBodyScroll();
            expect(document.body.style.overflow).toBe('hidden');
        });

        it('should unlock body scroll', () => {
            lockBodyScroll();
            unlockBodyScroll();
            expect(document.body.style.overflow).toBe('');
            expect(document.body.style.paddingRight).toBe('');
        });
    });

    describe('TouchGestureHandler', () => {
        it('should create handler with callbacks', () => {
            const handler = new TouchGestureHandler();
            const onSwipeLeft = vi.fn();
            const onSwipeRight = vi.fn();
            
            handler.onSwipeLeft = onSwipeLeft;
            handler.onSwipeRight = onSwipeRight;
            
            expect(handler.onSwipeLeft).toBe(onSwipeLeft);
            expect(handler.onSwipeRight).toBe(onSwipeRight);
        });

        it('should detect swipe right', () => {
            const handler = new TouchGestureHandler();
            const onSwipeRight = vi.fn();
            handler.onSwipeRight = onSwipeRight;

            // Simulate touch start
            handler.handleTouchStart({ touches: [{ clientX: 0, clientY: 100 }] } as any);
            
            // Simulate touch end (swipe right)
            handler.handleTouchEnd({ changedTouches: [{ clientX: 100, clientY: 100 }] } as any);

            expect(onSwipeRight).toHaveBeenCalled();
        });

        it('should detect swipe left', () => {
            const handler = new TouchGestureHandler();
            const onSwipeLeft = vi.fn();
            handler.onSwipeLeft = onSwipeLeft;

            handler.handleTouchStart({ touches: [{ clientX: 100, clientY: 100 }] } as any);
            handler.handleTouchEnd({ changedTouches: [{ clientX: 0, clientY: 100 }] } as any);

            expect(onSwipeLeft).toHaveBeenCalled();
        });

        it('should detect swipe down', () => {
            const handler = new TouchGestureHandler();
            const onSwipeDown = vi.fn();
            handler.onSwipeDown = onSwipeDown;

            handler.handleTouchStart({ touches: [{ clientX: 100, clientY: 0 }] } as any);
            handler.handleTouchEnd({ changedTouches: [{ clientX: 100, clientY: 100 }] } as any);

            expect(onSwipeDown).toHaveBeenCalled();
        });

        it('should detect swipe up', () => {
            const handler = new TouchGestureHandler();
            const onSwipeUp = vi.fn();
            handler.onSwipeUp = onSwipeUp;

            handler.handleTouchStart({ touches: [{ clientX: 100, clientY: 100 }] } as any);
            handler.handleTouchEnd({ changedTouches: [{ clientX: 100, clientY: 0 }] } as any);

            expect(onSwipeUp).toHaveBeenCalled();
        });

        it('should not trigger swipe for small movements', () => {
            const handler = new TouchGestureHandler();
            const onSwipeRight = vi.fn();
            handler.onSwipeRight = onSwipeRight;

            handler.handleTouchStart({ touches: [{ clientX: 0, clientY: 100 }] } as any);
            handler.handleTouchEnd({ changedTouches: [{ clientX: 20, clientY: 100 }] } as any);

            expect(onSwipeRight).not.toHaveBeenCalled();
        });

        it('should attach and detach event listeners', () => {
            const handler = new TouchGestureHandler();
            const element = document.createElement('div');
            const addSpy = vi.spyOn(element, 'addEventListener');
            const removeSpy = vi.spyOn(element, 'removeEventListener');

            const cleanup = handler.attach(element);
            expect(addSpy).toHaveBeenCalledTimes(2);

            cleanup();
            expect(removeSpy).toHaveBeenCalledTimes(2);
        });
    });

    describe('Safe Area Insets', () => {
        it('should return default insets when CSS not supported', () => {
            // Mock CSS.supports to return false
            const originalCSS = global.CSS;
            global.CSS = { supports: () => false } as any;
            
            const insets = getSafeAreaInsets();
            expect(insets).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
            
            global.CSS = originalCSS;
        });
    });
});
