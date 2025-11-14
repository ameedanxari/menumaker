import { useState, useEffect, TextareaHTMLAttributes } from 'react';
import { ValidationRules, validateField } from '../../utils/validation';

interface FormTextareaProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'> {
  label?: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  error?: string | null;
  hint?: string;
  rules?: ValidationRules;
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
  containerClassName?: string;
  showCharCount?: boolean;
  maxLength?: number;
}

/**
 * Reusable form textarea component with built-in validation
 */
export function FormTextarea({
  label,
  name,
  value,
  onChange,
  onBlur,
  error: externalError,
  hint,
  rules,
  validateOnChange = false,
  validateOnBlur = true,
  containerClassName = '',
  className = '',
  showCharCount = false,
  maxLength,
  rows = 4,
  ...props
}: FormTextareaProps) {
  const [internalError, setInternalError] = useState<string | null>(null);
  const [isTouched, setIsTouched] = useState(false);

  const error = externalError !== undefined ? externalError : internalError;
  const charCount = value.length;

  // Validate on change if enabled
  useEffect(() => {
    if (validateOnChange && isTouched && rules) {
      setInternalError(validateField(value, rules));
    }
  }, [value, validateOnChange, isTouched, rules]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
  };

  const handleBlur = () => {
    setIsTouched(true);

    if (validateOnBlur && rules) {
      setInternalError(validateField(value, rules));
    }

    onBlur?.();
  };

  return (
    <div className={`form-group ${containerClassName}`}>
      {/* Label */}
      {label && (
        <div className="flex justify-between items-center mb-1">
          <label
            htmlFor={name}
            className="block text-sm font-medium text-gray-700"
          >
            {label}
            {rules?.required && <span className="text-red-500 ml-1">*</span>}
          </label>

          {/* Character count */}
          {showCharCount && (
            <span className="text-sm text-gray-500">
              {charCount}
              {maxLength && `/${maxLength}`}
            </span>
          )}
        </div>
      )}

      {/* Textarea */}
      <textarea
        id={name}
        name={name}
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        rows={rows}
        maxLength={maxLength}
        className={`
          block w-full rounded-md shadow-sm px-3 py-2
          ${
            error
              ? 'border-red-300 text-red-900 placeholder-red-300 focus:ring-red-500 focus:border-red-500'
              : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
          }
          ${props.disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}
          ${className}
        `}
        aria-invalid={!!error}
        aria-describedby={
          error ? `${name}-error` : hint ? `${name}-hint` : undefined
        }
        {...props}
      />

      {/* Hint text */}
      {hint && !error && (
        <p id={`${name}-hint`} className="mt-1 text-sm text-gray-500">
          {hint}
        </p>
      )}

      {/* Error message */}
      {error && (
        <p id={`${name}-error`} className="mt-1 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
