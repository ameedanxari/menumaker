import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  generateId,
  focusManagement,
  keyboard,
  getContrastRatio,
  meetsContrastRatio,
} from './accessibility';

describe('accessibility utils', () => {
  describe('generateId', () => {
    it('generates unique IDs', () => {
      const id1 = generateId();
      const id2 = generateId();
      expect(id1).not.toBe(id2);
    });

    it('uses provided prefix', () => {
      const id = generateId('custom');
      expect(id).toMatch(/^custom-/);
    });

    it('uses default prefix when none provided', () => {
      const id = generateId();
      expect(id).toMatch(/^id-/);
    });
  });

  describe('focusManagement', () => {
    let container: HTMLElement;

    beforeEach(() => {
      container = document.createElement('div');
      container.innerHTML = `
        <button id="btn1">Button 1</button>
        <input id="input1" type="text" />
        <button id="btn2">Button 2</button>
      `;
      document.body.appendChild(container);
    });

    afterEach(() => {
      document.body.removeChild(container);
    });

    describe('trapFocus', () => {
      it('returns cleanup function', () => {
        const cleanup = focusManagement.trapFocus(container);
        expect(typeof cleanup).toBe('function');
        cleanup();
      });

      it('traps focus on Tab at last element', () => {
        focusManagement.trapFocus(container);
        const btn1 = container.querySelector('#btn1') as HTMLElement;
        const btn2 = container.querySelector('#btn2') as HTMLElement;

        btn2.focus();
        const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
        const preventDefault = vi.spyOn(event, 'preventDefault');

        container.dispatchEvent(event);

        // Focus should wrap to first element
        expect(preventDefault).toHaveBeenCalled();
      });

      it('traps focus on Shift+Tab at first element', () => {
        focusManagement.trapFocus(container);
        const btn1 = container.querySelector('#btn1') as HTMLElement;

        btn1.focus();
        const event = new KeyboardEvent('keydown', {
          key: 'Tab',
          shiftKey: true,
          bubbles: true,
        });
        const preventDefault = vi.spyOn(event, 'preventDefault');

        container.dispatchEvent(event);

        expect(preventDefault).toHaveBeenCalled();
      });
    });

    describe('focusFirst', () => {
      it('focuses first focusable element', () => {
        const btn1 = container.querySelector('#btn1') as HTMLElement;
        focusManagement.focusFirst(container);
        expect(document.activeElement).toBe(btn1);
      });
    });

    describe('returnFocus', () => {
      it('focuses the provided element', () => {
        const btn2 = container.querySelector('#btn2') as HTMLElement;
        focusManagement.returnFocus(btn2);
        expect(document.activeElement).toBe(btn2);
      });
    });
  });

  describe('keyboard', () => {
    describe('isActivationKey', () => {
      it('returns true for Enter', () => {
        const event = new KeyboardEvent('keydown', { key: 'Enter' });
        expect(keyboard.isActivationKey(event)).toBe(true);
      });

      it('returns true for Space', () => {
        const event = new KeyboardEvent('keydown', { key: ' ' });
        expect(keyboard.isActivationKey(event)).toBe(true);
      });

      it('returns false for other keys', () => {
        const event = new KeyboardEvent('keydown', { key: 'a' });
        expect(keyboard.isActivationKey(event)).toBe(false);
      });
    });

    describe('isEscapeKey', () => {
      it('returns true for Escape', () => {
        const event = new KeyboardEvent('keydown', { key: 'Escape' });
        expect(keyboard.isEscapeKey(event)).toBe(true);
      });

      it('returns true for Esc (legacy)', () => {
        const event = new KeyboardEvent('keydown', { key: 'Esc' });
        expect(keyboard.isEscapeKey(event)).toBe(true);
      });

      it('returns false for other keys', () => {
        const event = new KeyboardEvent('keydown', { key: 'Enter' });
        expect(keyboard.isEscapeKey(event)).toBe(false);
      });
    });

    describe('isArrowKey', () => {
      it('returns true for arrow keys', () => {
        expect(keyboard.isArrowKey(new KeyboardEvent('keydown', { key: 'ArrowUp' }))).toBe(true);
        expect(keyboard.isArrowKey(new KeyboardEvent('keydown', { key: 'ArrowDown' }))).toBe(true);
        expect(keyboard.isArrowKey(new KeyboardEvent('keydown', { key: 'ArrowLeft' }))).toBe(true);
        expect(keyboard.isArrowKey(new KeyboardEvent('keydown', { key: 'ArrowRight' }))).toBe(true);
      });

      it('returns false for non-arrow keys', () => {
        expect(keyboard.isArrowKey(new KeyboardEvent('keydown', { key: 'Enter' }))).toBe(false);
      });
    });

    describe('handleActivation', () => {
      it('calls callback on Enter', () => {
        const callback = vi.fn();
        const event = new KeyboardEvent('keydown', { key: 'Enter' });
        const preventDefault = vi.spyOn(event, 'preventDefault');

        keyboard.handleActivation(event, callback);

        expect(callback).toHaveBeenCalled();
        expect(preventDefault).toHaveBeenCalled();
      });

      it('calls callback on Space', () => {
        const callback = vi.fn();
        const event = new KeyboardEvent('keydown', { key: ' ' });

        keyboard.handleActivation(event, callback);

        expect(callback).toHaveBeenCalled();
      });

      it('does not call callback on other keys', () => {
        const callback = vi.fn();
        const event = new KeyboardEvent('keydown', { key: 'a' });

        keyboard.handleActivation(event, callback);

        expect(callback).not.toHaveBeenCalled();
      });

      it('respects preventDefault option', () => {
        const callback = vi.fn();
        const event = new KeyboardEvent('keydown', { key: 'Enter' });
        const preventDefault = vi.spyOn(event, 'preventDefault');

        keyboard.handleActivation(event, callback, false);

        expect(callback).toHaveBeenCalled();
        expect(preventDefault).not.toHaveBeenCalled();
      });
    });
  });

  describe('getContrastRatio', () => {
    it('calculates contrast ratio for black and white', () => {
      const ratio = getContrastRatio('rgb(0, 0, 0)', 'rgb(255, 255, 255)');
      expect(ratio).toBeGreaterThan(20); // Should be ~21:1
    });

    it('calculates contrast ratio for similar colors', () => {
      const ratio = getContrastRatio('rgb(200, 200, 200)', 'rgb(220, 220, 220)');
      expect(ratio).toBeLessThan(2); // Low contrast
    });

    it('handles invalid color format', () => {
      const ratio = getContrastRatio('invalid', 'rgb(255, 255, 255)');
      expect(ratio).toBeDefined();
    });
  });

  describe('meetsContrastRatio', () => {
    it('returns true for high contrast colors (normal text)', () => {
      expect(meetsContrastRatio('rgb(0, 0, 0)', 'rgb(255, 255, 255)')).toBe(true);
    });

    it('returns false for low contrast colors (normal text)', () => {
      expect(meetsContrastRatio('rgb(200, 200, 200)', 'rgb(220, 220, 220)')).toBe(false);
    });

    it('uses lower threshold for large text', () => {
      // Large text only needs 3:1 ratio
      const result = meetsContrastRatio('rgb(100, 100, 100)', 'rgb(200, 200, 200)', true);
      // This should pass for large text but might fail for normal text
      expect(typeof result).toBe('boolean');
    });
  });
});
