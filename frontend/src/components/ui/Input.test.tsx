// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { Input } from './Input';

describe('Input component', () => {
  afterEach(() => {
    cleanup();
  });
  describe('rendering', () => {
    it('renders input element', () => {
      render(<Input />);
      expect(screen.getByRole('textbox')).toBeDefined();
    });

    it('renders with label', () => {
      render(<Input label="Email" />);
      expect(screen.getByText('Email')).toBeDefined();
    });

    it('associates label with input', () => {
      render(<Input label="Email" />);
      const input = screen.getByRole('textbox');
      const label = screen.getByText('Email');
      expect(label.getAttribute('for')).toBe(input.id);
    });

    it('shows required indicator when required', () => {
      render(<Input label="Email" required />);
      expect(screen.getByText('*')).toBeDefined();
    });
  });

  describe('helper text and errors', () => {
    it('renders helper text', () => {
      render(<Input helperText="Enter your email address" />);
      expect(screen.getByText('Enter your email address')).toBeDefined();
    });

    it('renders error message', () => {
      render(<Input error="Email is required" />);
      expect(screen.getByText('Email is required')).toBeDefined();
    });

    it('shows error instead of helper text when both provided', () => {
      render(<Input helperText="Helper" error="Error" />);
      expect(screen.getByText('Error')).toBeDefined();
      expect(screen.queryByText('Helper')).toBeNull();
    });

    it('applies error styles when error is present', () => {
      render(<Input error="Error" data-testid="input" />);
      const input = screen.getByRole('textbox');
      expect(input.className).toContain('border-error-500');
    });
  });

  describe('icons', () => {
    it('renders left icon', () => {
      render(<Input leftIcon={<span data-testid="left-icon">L</span>} />);
      expect(screen.getByTestId('left-icon')).toBeDefined();
    });

    it('renders right icon', () => {
      render(<Input rightIcon={<span data-testid="right-icon">R</span>} />);
      expect(screen.getByTestId('right-icon')).toBeDefined();
    });

    it('applies padding for left icon', () => {
      render(<Input leftIcon={<span>L</span>} />);
      const input = screen.getByRole('textbox');
      expect(input.className).toContain('pl-10');
    });

    it('applies padding for right icon', () => {
      render(<Input rightIcon={<span>R</span>} />);
      const input = screen.getByRole('textbox');
      expect(input.className).toContain('pr-10');
    });
  });

  describe('fullWidth', () => {
    it('applies full width when prop is true', () => {
      render(<Input fullWidth data-testid="container" />);
      // The container div should have w-full
      const container = screen.getByRole('textbox').parentElement?.parentElement;
      expect(container?.className).toContain('w-full');
    });
  });

  describe('events', () => {
    it('calls onChange handler', () => {
      const handleChange = vi.fn();
      render(<Input onChange={handleChange} />);

      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'test' } });

      expect(handleChange).toHaveBeenCalled();
    });

    it('calls onBlur handler', () => {
      const handleBlur = vi.fn();
      render(<Input onBlur={handleBlur} />);

      fireEvent.blur(screen.getByRole('textbox'));

      expect(handleBlur).toHaveBeenCalled();
    });

    it('calls onFocus handler', () => {
      const handleFocus = vi.fn();
      render(<Input onFocus={handleFocus} />);

      fireEvent.focus(screen.getByRole('textbox'));

      expect(handleFocus).toHaveBeenCalled();
    });
  });

  describe('forwarded props', () => {
    it('forwards type prop', () => {
      render(<Input type="email" />);
      const input = screen.getByRole('textbox');
      expect(input.getAttribute('type')).toBe('email');
    });

    it('forwards placeholder prop', () => {
      render(<Input placeholder="Enter email" />);
      const input = screen.getByRole('textbox');
      expect(input.getAttribute('placeholder')).toBe('Enter email');
    });

    it('forwards disabled prop', () => {
      render(<Input disabled />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveProperty('disabled', true);
    });

    it('forwards value prop', () => {
      render(<Input value="test value" onChange={() => {}} />);
      const input = screen.getByRole('textbox') as HTMLInputElement;
      expect(input.value).toBe('test value');
    });

    it('forwards custom id', () => {
      render(<Input id="custom-id" />);
      const input = screen.getByRole('textbox');
      expect(input.id).toBe('custom-id');
    });
  });

  describe('custom className', () => {
    it('merges custom className', () => {
      render(<Input className="custom-class" />);
      const input = screen.getByRole('textbox');
      expect(input.className).toContain('custom-class');
    });
  });
});
