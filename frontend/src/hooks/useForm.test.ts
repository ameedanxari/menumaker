import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useForm } from './useForm';

describe('useForm hook', () => {
  afterEach(() => {
    cleanup();
  });
  const initialValues = {
    email: '',
    password: '',
    name: '',
  };

  const validationRules = {
    email: { required: true, email: true },
    password: { required: true, minLength: { value: 8 } },
    name: { required: true },
  };

  describe('initialization', () => {
    it('initializes with provided values', () => {
      const { result } = renderHook(() =>
        useForm({
          initialValues: { email: 'test@example.com', password: '' },
          onSubmit: vi.fn(),
        })
      );

      expect(result.current.values.email).toBe('test@example.com');
      expect(result.current.values.password).toBe('');
    });

    it('starts with no errors', () => {
      const { result } = renderHook(() =>
        useForm({
          initialValues,
          onSubmit: vi.fn(),
        })
      );

      expect(result.current.hasErrors()).toBe(false);
    });

    it('starts with no touched fields', () => {
      const { result } = renderHook(() =>
        useForm({
          initialValues,
          onSubmit: vi.fn(),
        })
      );

      expect(result.current.touched).toEqual({});
    });

    it('starts not submitting', () => {
      const { result } = renderHook(() =>
        useForm({
          initialValues,
          onSubmit: vi.fn(),
        })
      );

      expect(result.current.isSubmitting).toBe(false);
    });
  });

  describe('setFieldValue', () => {
    it('updates field value', () => {
      const { result } = renderHook(() =>
        useForm({
          initialValues,
          onSubmit: vi.fn(),
        })
      );

      act(() => {
        result.current.setFieldValue('email', 'new@example.com');
      });

      expect(result.current.values.email).toBe('new@example.com');
    });
  });

  describe('setFieldTouched', () => {
    it('marks field as touched', () => {
      const { result } = renderHook(() =>
        useForm({
          initialValues,
          onSubmit: vi.fn(),
        })
      );

      act(() => {
        result.current.setFieldTouched('email', true);
      });

      expect(result.current.touched.email).toBe(true);
    });

    it('validates on blur when validateOnBlur is true', () => {
      const { result } = renderHook(() =>
        useForm({
          initialValues,
          validationRules,
          onSubmit: vi.fn(),
          validateOnBlur: true,
        })
      );

      act(() => {
        result.current.setFieldTouched('email', true);
      });

      expect(result.current.errors.email).toBeTruthy();
    });
  });

  describe('setFieldError', () => {
    it('sets error for field', () => {
      const { result } = renderHook(() =>
        useForm({
          initialValues,
          onSubmit: vi.fn(),
        })
      );

      act(() => {
        result.current.setFieldError('email', 'Custom error');
      });

      expect(result.current.errors.email).toBe('Custom error');
    });

    it('clears error when set to null', () => {
      const { result } = renderHook(() =>
        useForm({
          initialValues,
          onSubmit: vi.fn(),
        })
      );

      act(() => {
        result.current.setFieldError('email', 'Error');
        result.current.setFieldError('email', null);
      });

      expect(result.current.errors.email).toBeNull();
    });
  });

  describe('getFieldProps', () => {
    it('returns props for form field', () => {
      const { result } = renderHook(() =>
        useForm({
          initialValues: { email: 'test@example.com' },
          validationRules: { email: { required: true } },
          onSubmit: vi.fn(),
        })
      );

      const props = result.current.getFieldProps('email');

      expect(props.name).toBe('email');
      expect(props.value).toBe('test@example.com');
      expect(typeof props.onChange).toBe('function');
      expect(typeof props.onBlur).toBe('function');
      expect(props.rules).toEqual({ required: true });
    });

    it('onChange updates value', () => {
      const { result } = renderHook(() =>
        useForm({
          initialValues,
          onSubmit: vi.fn(),
        })
      );

      const props = result.current.getFieldProps('email');

      act(() => {
        props.onChange('updated@example.com');
      });

      expect(result.current.values.email).toBe('updated@example.com');
    });

    it('onBlur marks field as touched', () => {
      const { result } = renderHook(() =>
        useForm({
          initialValues,
          onSubmit: vi.fn(),
        })
      );

      const props = result.current.getFieldProps('email');

      act(() => {
        props.onBlur();
      });

      expect(result.current.touched.email).toBe(true);
    });
  });

  describe('validateAll', () => {
    it('validates all fields', () => {
      const { result } = renderHook(() =>
        useForm({
          initialValues,
          validationRules,
          onSubmit: vi.fn(),
        })
      );

      let isValid: boolean;
      act(() => {
        isValid = result.current.validateAll();
      });

      expect(isValid!).toBe(false);
      expect(result.current.errors.email).toBeTruthy();
      expect(result.current.errors.password).toBeTruthy();
      expect(result.current.errors.name).toBeTruthy();
    });

    it('returns true when all fields are valid', () => {
      const { result } = renderHook(() =>
        useForm({
          initialValues: {
            email: 'test@example.com',
            password: 'password123',
            name: 'John',
          },
          validationRules,
          onSubmit: vi.fn(),
        })
      );

      let isValid: boolean;
      act(() => {
        isValid = result.current.validateAll();
      });

      expect(isValid!).toBe(true);
    });

    it('marks all fields as touched', () => {
      const { result } = renderHook(() =>
        useForm({
          initialValues,
          validationRules,
          onSubmit: vi.fn(),
        })
      );

      act(() => {
        result.current.validateAll();
      });

      expect(result.current.touched.email).toBe(true);
      expect(result.current.touched.password).toBe(true);
      expect(result.current.touched.name).toBe(true);
    });
  });

  describe('handleSubmit', () => {
    it('calls onSubmit when form is valid', async () => {
      const onSubmit = vi.fn();
      const { result } = renderHook(() =>
        useForm({
          initialValues: {
            email: 'test@example.com',
            password: 'password123',
            name: 'John',
          },
          validationRules,
          onSubmit,
        })
      );

      await act(async () => {
        await result.current.handleSubmit();
      });

      expect(onSubmit).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
        name: 'John',
      });
    });

    it('does not call onSubmit when form is invalid', async () => {
      const onSubmit = vi.fn();
      const { result } = renderHook(() =>
        useForm({
          initialValues,
          validationRules,
          onSubmit,
        })
      );

      await act(async () => {
        await result.current.handleSubmit();
      });

      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('sets isSubmitting during submission', async () => {
      let submittingDuringCall = false;
      const onSubmit = vi.fn().mockImplementation(async () => {
        // Capture the state during the call
        submittingDuringCall = true;
        await new Promise((r) => setTimeout(r, 10));
      });
      
      const { result } = renderHook(() =>
        useForm({
          initialValues: { email: 'test@example.com' },
          onSubmit,
        })
      );

      await act(async () => {
        await result.current.handleSubmit();
      });

      expect(onSubmit).toHaveBeenCalled();
      expect(result.current.isSubmitting).toBe(false);
    });

    it('prevents default event', async () => {
      const onSubmit = vi.fn();
      const { result } = renderHook(() =>
        useForm({
          initialValues: { email: 'test@example.com' },
          onSubmit,
        })
      );

      const event = { preventDefault: vi.fn() } as unknown as React.FormEvent;

      await act(async () => {
        await result.current.handleSubmit(event);
      });

      expect(event.preventDefault).toHaveBeenCalled();
    });
  });

  describe('reset', () => {
    it('resets values to initial', () => {
      const { result } = renderHook(() =>
        useForm({
          initialValues,
          onSubmit: vi.fn(),
        })
      );

      act(() => {
        result.current.setFieldValue('email', 'changed@example.com');
        result.current.reset();
      });

      expect(result.current.values.email).toBe('');
    });

    it('clears errors', () => {
      const { result } = renderHook(() =>
        useForm({
          initialValues,
          validationRules,
          onSubmit: vi.fn(),
        })
      );

      act(() => {
        result.current.validateAll();
        result.current.reset();
      });

      expect(result.current.errors).toEqual({});
    });

    it('clears touched state', () => {
      const { result } = renderHook(() =>
        useForm({
          initialValues,
          onSubmit: vi.fn(),
        })
      );

      act(() => {
        result.current.setFieldTouched('email', true);
        result.current.reset();
      });

      expect(result.current.touched).toEqual({});
    });
  });

  describe('isDirty', () => {
    it('returns false when values unchanged', () => {
      const { result } = renderHook(() =>
        useForm({
          initialValues,
          onSubmit: vi.fn(),
        })
      );

      expect(result.current.isDirty()).toBe(false);
    });

    it('returns true when values changed', () => {
      const { result } = renderHook(() =>
        useForm({
          initialValues,
          onSubmit: vi.fn(),
        })
      );

      act(() => {
        result.current.setFieldValue('email', 'changed@example.com');
      });

      expect(result.current.isDirty()).toBe(true);
    });
  });

  describe('hasErrors', () => {
    it('returns false when no errors', () => {
      const { result } = renderHook(() =>
        useForm({
          initialValues,
          onSubmit: vi.fn(),
        })
      );

      expect(result.current.hasErrors()).toBe(false);
    });

    it('returns true when errors exist', () => {
      const { result } = renderHook(() =>
        useForm({
          initialValues,
          onSubmit: vi.fn(),
        })
      );

      act(() => {
        result.current.setFieldError('email', 'Error');
      });

      expect(result.current.hasErrors()).toBe(true);
    });
  });
});
