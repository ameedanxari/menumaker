import { useState, useCallback } from 'react';
import {
  ValidationRules,
  validateForm,
  validateField,
  hasErrors as checkHasErrors,
} from '../utils/validation';

interface UseFormOptions<T> {
  initialValues: T;
  validationRules?: Partial<Record<keyof T, ValidationRules>>;
  onSubmit: (values: T) => void | Promise<void>;
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
}

/**
 * Custom hook for form management with validation
 *
 * @example
 * const form = useForm({
 *   initialValues: { email: '', password: '' },
 *   validationRules: {
 *     email: commonRules.email,
 *     password: commonRules.password,
 *   },
 *   onSubmit: async (values) => {
 *     await login(values);
 *   },
 * });
 *
 * <FormInput {...form.getFieldProps('email')} />
 * <button onClick={form.handleSubmit}>Submit</button>
 */
export function useForm<T extends Record<string, any>>({
  initialValues,
  validationRules = {},
  onSubmit,
  validateOnChange = false,
  validateOnBlur = true,
}: UseFormOptions<T>) {
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<Record<keyof T, string | null>>(
    {} as Record<keyof T, string | null>
  );
  const [touched, setTouched] = useState<Record<keyof T, boolean>>(
    {} as Record<keyof T, boolean>
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  /**
   * Set value for a single field
   */
  const setFieldValue = useCallback(
    (field: keyof T, value: any) => {
      setValues((prev) => ({ ...prev, [field]: value }));

      // Validate on change if enabled and field is touched
      if (validateOnChange && touched[field] && validationRules[field]) {
        const rules = validationRules[field]!;
        const error = validateField(value, rules);
        setErrors((prev) => ({ ...prev, [field]: error }));
      }
    },
    [validateOnChange, touched, validationRules]
  );

  /**
   * Set error for a single field
   */
  const setFieldError = useCallback((field: keyof T, error: string | null) => {
    setErrors((prev) => ({ ...prev, [field]: error }));
  }, []);

  /**
   * Mark field as touched
   */
  const setFieldTouched = useCallback(
    (field: keyof T, isTouched: boolean = true) => {
      setTouched((prev) => ({ ...prev, [field]: isTouched }));

      // Validate on blur if enabled
      if (isTouched && validateOnBlur && validationRules[field]) {
        const rules = validationRules[field]!;
        const error = validateField(values[field], rules);
        setErrors((prev) => ({ ...prev, [field]: error }));
      }
    },
    [validateOnBlur, validationRules, values]
  );

  /**
   * Get props for a form field (to spread onto FormInput, etc.)
   */
  const getFieldProps = useCallback(
    (field: keyof T) => ({
      name: field as string,
      value: values[field],
      onChange: (value: any) => setFieldValue(field, value),
      onBlur: () => setFieldTouched(field, true),
      error: touched[field] ? errors[field] : null,
      rules: validationRules[field],
    }),
    [values, errors, touched, validationRules, setFieldValue, setFieldTouched]
  );

  /**
   * Validate all fields
   */
  const validateAll = useCallback(() => {
    if (!validationRules || Object.keys(validationRules).length === 0) {
      return true;
    }

    const newErrors = validateForm(values, validationRules as any);
    setErrors(newErrors);

    // Mark all fields as touched
    const allTouched = Object.keys(values).reduce(
      (acc, key) => ({ ...acc, [key]: true }),
      {} as Record<keyof T, boolean>
    );
    setTouched(allTouched);

    return !checkHasErrors(newErrors);
  }, [values, validationRules]);

  /**
   * Handle form submission
   */
  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();

      // Validate form
      const isValid = validateAll();
      if (!isValid) {
        return;
      }

      // Submit
      setIsSubmitting(true);
      try {
        await onSubmit(values);
      } catch (_error) {
        console.error('Form submission error:', error);
      } finally {
        setIsSubmitting(false);
      }
    },
    [validateAll, onSubmit, values]
  );

  /**
   * Reset form to initial values
   */
  const reset = useCallback(() => {
    setValues(initialValues);
    setErrors({} as Record<keyof T, string | null>);
    setTouched({} as Record<keyof T, boolean>);
    setIsSubmitting(false);
  }, [initialValues]);

  /**
   * Check if form has any errors
   */
  const hasErrors = useCallback(() => {
    return checkHasErrors(errors);
  }, [errors]);

  /**
   * Check if form is dirty (has been modified)
   */
  const isDirty = useCallback(() => {
    return JSON.stringify(values) !== JSON.stringify(initialValues);
  }, [values, initialValues]);

  return {
    // Values
    values,
    setValues,
    setFieldValue,

    // Errors
    errors,
    setErrors,
    setFieldError,
    hasErrors,

    // Touched
    touched,
    setTouched,
    setFieldTouched,

    // Helpers
    getFieldProps,
    validateAll,
    reset,
    isDirty,

    // Submission
    isSubmitting,
    handleSubmit,
  };
}
