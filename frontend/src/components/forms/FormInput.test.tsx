// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { FormInput } from './FormInput';

describe('FormInput component', () => {
  afterEach(() => {
    cleanup();
  });

  describe('rendering', () => {
    it('renders input element', () => {
      render(<FormInput name="test" value="" onChange={vi.fn()} />);
      expect(screen.getByRole('textbox')).toBeDefined();
    });

    it('renders with label', () => {
      render(<FormInput name="email" label="Email" value="" onChange={vi.fn()} />);
      expect(screen.getByText('Email')).toBeDefined();
    });

    it('associates label with input', () => {
      render(<FormInput name="email" label="Email" value="" onChange={vi.fn()} />);
      const input = screen.getByRole('textbox');
      const label = screen.getByText('Email');
      expect(label.getAttribute('for')).toBe(input.id);
    });

    it('shows required indicator when required rule is set', () => {
      render(
        <FormInput
          name="email"
          label="Email"
          value=""
          onChange={vi.fn()}
          rules={{ required: true }}
        />
      );
      expect(screen.getByText('*')).toBeDefined();
    });
  });

  describe('hint and errors', () => {
    it('renders hint text', () => {
      render(
        <FormInput
          name="email"
          value=""
          onChange={vi.fn()}
          hint="Enter your email address"
        />
      );
      expect(screen.getByText('Enter your email address')).toBeDefined();
    });

    it('renders error message', () => {
      render(
        <FormInput
          name="email"
          value=""
          onChange={vi.fn()}
          error="Email is required"
        />
      );
      expect(screen.getByText('Email is required')).toBeDefined();
    });

    it('shows error instead of hint when both provided', () => {
      render(
        <FormInput
          name="email"
          value=""
          onChange={vi.fn()}
          hint="Helper"
          error="Error"
        />
      );
      expect(screen.getByText('Error')).toBeDefined();
      expect(screen.queryByText('Helper')).toBeNull();
    });

    it('applies error styles when error is present', () => {
      render(
        <FormInput name="email" value="" onChange={vi.fn()} error="Error" />
      );
      const input = screen.getByRole('textbox');
      expect(input.className).toContain('border-red-300');
    });

    it('sets aria-invalid when error is present', () => {
      render(
        <FormInput name="email" value="" onChange={vi.fn()} error="Error" />
      );
      const input = screen.getByRole('textbox');
      expect(input.getAttribute('aria-invalid')).toBe('true');
    });
  });

  describe('icons', () => {
    it('renders left icon', () => {
      render(
        <FormInput
          name="email"
          value=""
          onChange={vi.fn()}
          leftIcon={<span data-testid="left-icon">L</span>}
        />
      );
      expect(screen.getByTestId('left-icon')).toBeDefined();
    });

    it('renders right icon', () => {
      render(
        <FormInput
          name="email"
          value=""
          onChange={vi.fn()}
          rightIcon={<span data-testid="right-icon">R</span>}
        />
      );
      expect(screen.getByTestId('right-icon')).toBeDefined();
    });

    it('applies padding for left icon', () => {
      render(
        <FormInput
          name="email"
          value=""
          onChange={vi.fn()}
          leftIcon={<span>L</span>}
        />
      );
      const input = screen.getByRole('textbox');
      expect(input.className).toContain('pl-10');
    });
  });

  describe('events', () => {
    it('calls onChange handler with value', () => {
      const handleChange = vi.fn();
      render(<FormInput name="email" value="" onChange={handleChange} />);

      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'test@example.com' } });

      expect(handleChange).toHaveBeenCalledWith('test@example.com');
    });

    it('calls onBlur handler', () => {
      const handleBlur = vi.fn();
      render(<FormInput name="email" value="" onChange={vi.fn()} onBlur={handleBlur} />);

      fireEvent.blur(screen.getByRole('textbox'));

      expect(handleBlur).toHaveBeenCalled();
    });
  });

  describe('validation', () => {
    it('validates on blur when validateOnBlur is true', () => {
      render(
        <FormInput
          name="email"
          value=""
          onChange={vi.fn()}
          rules={{ required: true }}
          validateOnBlur={true}
        />
      );

      fireEvent.blur(screen.getByRole('textbox'));

      expect(screen.getByText('This field is required')).toBeDefined();
    });

    it('does not validate on blur when validateOnBlur is false', () => {
      render(
        <FormInput
          name="email"
          value=""
          onChange={vi.fn()}
          rules={{ required: true }}
          validateOnBlur={false}
        />
      );

      fireEvent.blur(screen.getByRole('textbox'));

      expect(screen.queryByText('This field is required')).toBeNull();
    });
  });

  describe('disabled state', () => {
    it('applies disabled styles', () => {
      render(<FormInput name="email" value="" onChange={vi.fn()} disabled />);
      const input = screen.getByRole('textbox');
      expect(input.className).toContain('bg-gray-100');
      expect(input.className).toContain('cursor-not-allowed');
    });
  });

  describe('custom className', () => {
    it('merges custom className', () => {
      render(
        <FormInput name="email" value="" onChange={vi.fn()} className="custom-class" />
      );
      const input = screen.getByRole('textbox');
      expect(input.className).toContain('custom-class');
    });

    it('merges container className', () => {
      render(
        <FormInput
          name="email"
          value=""
          onChange={vi.fn()}
          containerClassName="container-class"
        />
      );
      const container = screen.getByRole('textbox').closest('.form-group');
      expect(container?.className).toContain('container-class');
    });
  });
});
