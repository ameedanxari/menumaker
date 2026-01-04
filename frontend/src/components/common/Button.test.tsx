// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { Button } from './Button';

describe('Common Button component', () => {
  afterEach(() => {
    cleanup();
  });

  describe('rendering', () => {
    it('renders children', () => {
      render(<Button>Click me</Button>);
      expect(screen.getByText('Click me')).toBeDefined();
    });

    it('renders as button element', () => {
      render(<Button>Test</Button>);
      expect(screen.getByRole('button')).toBeDefined();
    });

    it('has type="button" by default', () => {
      render(<Button>Test</Button>);
      expect(screen.getByRole('button')).toHaveProperty('type', 'button');
    });
  });

  describe('variants', () => {
    it('applies primary variant styles by default', () => {
      render(<Button>Primary</Button>);
      const button = screen.getByRole('button');
      expect(button.className).toContain('bg-blue-600');
    });

    it('applies secondary variant styles', () => {
      render(<Button variant="secondary">Secondary</Button>);
      const button = screen.getByRole('button');
      expect(button.className).toContain('bg-gray-600');
    });

    it('applies outline variant styles', () => {
      render(<Button variant="outline">Outline</Button>);
      const button = screen.getByRole('button');
      expect(button.className).toContain('border-2');
    });

    it('applies ghost variant styles', () => {
      render(<Button variant="ghost">Ghost</Button>);
      const button = screen.getByRole('button');
      expect(button.className).toContain('hover:bg-gray-100');
    });

    it('applies danger variant styles', () => {
      render(<Button variant="danger">Danger</Button>);
      const button = screen.getByRole('button');
      expect(button.className).toContain('bg-red-600');
    });
  });

  describe('sizes', () => {
    it('applies medium size by default', () => {
      render(<Button>Medium</Button>);
      const button = screen.getByRole('button');
      expect(button.className).toContain('px-4');
      expect(button.className).toContain('py-2');
    });

    it('applies small size', () => {
      render(<Button size="sm">Small</Button>);
      const button = screen.getByRole('button');
      expect(button.className).toContain('px-3');
      expect(button.className).toContain('py-1.5');
    });

    it('applies large size', () => {
      render(<Button size="lg">Large</Button>);
      const button = screen.getByRole('button');
      expect(button.className).toContain('px-6');
      expect(button.className).toContain('py-3');
    });
  });

  describe('states', () => {
    it('handles disabled state', () => {
      render(<Button disabled>Disabled</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveProperty('disabled', true);
      expect(button.getAttribute('aria-disabled')).toBe('true');
    });

    it('shows loading spinner when loading', () => {
      render(<Button loading>Loading</Button>);
      const button = screen.getByRole('button');
      expect(button.querySelector('svg')).toBeDefined();
      expect(button.getAttribute('aria-busy')).toBe('true');
    });

    it('is disabled when loading', () => {
      render(<Button loading>Loading</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveProperty('disabled', true);
    });
  });

  describe('icons', () => {
    it('renders left icon', () => {
      render(<Button leftIcon={<span data-testid="left-icon">L</span>}>With Icon</Button>);
      expect(screen.getByTestId('left-icon')).toBeDefined();
    });

    it('renders right icon', () => {
      render(<Button rightIcon={<span data-testid="right-icon">R</span>}>With Icon</Button>);
      expect(screen.getByTestId('right-icon')).toBeDefined();
    });

    it('hides left icon when loading', () => {
      render(<Button loading leftIcon={<span data-testid="left-icon">L</span>}>Loading</Button>);
      expect(screen.queryByTestId('left-icon')).toBeNull();
    });
  });

  describe('fullWidth', () => {
    it('applies full width when prop is true', () => {
      render(<Button fullWidth>Full Width</Button>);
      const button = screen.getByRole('button');
      expect(button.className).toContain('w-full');
    });
  });

  describe('events', () => {
    it('calls onClick handler', () => {
      const handleClick = vi.fn();
      render(<Button onClick={handleClick}>Click</Button>);

      fireEvent.click(screen.getByRole('button'));

      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('does not call onClick when disabled', () => {
      const handleClick = vi.fn();
      render(
        <Button onClick={handleClick} disabled>
          Click
        </Button>
      );

      fireEvent.click(screen.getByRole('button'));

      expect(handleClick).not.toHaveBeenCalled();
    });
  });

  describe('custom className', () => {
    it('merges custom className', () => {
      render(<Button className="custom-class">Custom</Button>);
      const button = screen.getByRole('button');
      expect(button.className).toContain('custom-class');
    });
  });

  describe('forwarded props', () => {
    it('forwards type prop', () => {
      render(<Button type="submit">Submit</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveProperty('type', 'submit');
    });

    it('forwards aria attributes', () => {
      render(<Button aria-label="Test button">Test</Button>);
      const button = screen.getByRole('button');
      expect(button.getAttribute('aria-label')).toBe('Test button');
    });
  });
});
