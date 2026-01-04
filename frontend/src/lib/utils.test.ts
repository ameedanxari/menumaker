import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { cn, formatCurrency, formatDate, truncate, debounce, sleep } from './utils';

describe('lib/utils', () => {
  describe('cn (class name merger)', () => {
    it('merges class names', () => {
      expect(cn('foo', 'bar')).toBe('foo bar');
    });

    it('handles conditional classes', () => {
      expect(cn('foo', false && 'bar', 'baz')).toBe('foo baz');
      expect(cn('foo', true && 'bar', 'baz')).toBe('foo bar baz');
    });

    it('handles tailwind conflicts (last wins)', () => {
      expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
      expect(cn('p-4', 'p-8')).toBe('p-8');
    });

    it('handles undefined and null', () => {
      expect(cn('foo', undefined, null, 'bar')).toBe('foo bar');
    });

    it('handles arrays', () => {
      expect(cn(['foo', 'bar'])).toBe('foo bar');
    });

    it('handles objects', () => {
      expect(cn({ foo: true, bar: false, baz: true })).toBe('foo baz');
    });
  });

  describe('formatCurrency', () => {
    it('formats cents to INR currency', () => {
      expect(formatCurrency(10000)).toBe('₹100');
      expect(formatCurrency(12345)).toBe('₹123.45');
    });

    it('handles zero', () => {
      expect(formatCurrency(0)).toBe('₹0');
    });

    it('handles large amounts', () => {
      expect(formatCurrency(1000000)).toBe('₹10,000');
    });

    it('handles small amounts', () => {
      expect(formatCurrency(50)).toBe('₹0.5');
      expect(formatCurrency(1)).toBe('₹0.01');
    });
  });

  describe('formatDate', () => {
    it('formats date string', () => {
      const result = formatDate('2024-01-15T12:00:00Z');
      expect(result).toContain('January');
      expect(result).toContain('2024');
    });

    it('formats Date object', () => {
      const date = new Date(2024, 0, 15, 12, 0, 0);
      const result = formatDate(date);
      expect(result).toContain('January');
      expect(result).toContain('2024');
    });

    it('accepts custom options', () => {
      const result = formatDate('2024-01-15T12:00:00Z', { month: 'short', day: 'numeric' });
      expect(result).toContain('Jan');
    });
  });

  describe('truncate', () => {
    it('truncates long text', () => {
      expect(truncate('Hello World', 8)).toBe('Hello...');
    });

    it('does not truncate short text', () => {
      expect(truncate('Hello', 10)).toBe('Hello');
    });

    it('handles exact length', () => {
      expect(truncate('Hello', 5)).toBe('Hello');
    });

    it('uses custom suffix', () => {
      expect(truncate('Hello World', 8, '…')).toBe('Hello W…');
    });

    it('handles empty string', () => {
      expect(truncate('', 10)).toBe('');
    });
  });

  describe('debounce', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('delays function execution', () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 100);

      debounced();
      expect(fn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('only calls once for rapid calls', () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 100);

      debounced();
      debounced();
      debounced();

      vi.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('passes arguments to function', () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 100);

      debounced('arg1', 'arg2');
      vi.advanceTimersByTime(100);

      expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
    });

    it('uses latest arguments', () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 100);

      debounced('first');
      debounced('second');
      debounced('third');

      vi.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledWith('third');
    });
  });

  describe('sleep', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('resolves after specified time', async () => {
      const promise = sleep(100);
      let resolved = false;

      promise.then(() => {
        resolved = true;
      });

      expect(resolved).toBe(false);
      vi.advanceTimersByTime(100);
      await promise;
      expect(resolved).toBe(true);
    });
  });
});
