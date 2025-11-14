import { useState, useEffect, SelectHTMLAttributes } from 'react';
import { ValidationRules, validateField } from '../../utils/validation';

interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface FormSelectProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
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
  options: SelectOption[];
  placeholder?: string;
  containerClassName?: string;
}

/**
 * Reusable form select component with built-in validation
 */
export function FormSelect({
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
  options,
  placeholder = 'Select an option',
  containerClassName = '',
  className = '',
  ...props
}: FormSelectProps) {
  const [internalError, setInternalError] = useState<string | null>(null);
  const [isTouched, setIsTouched] = useState(false);

  const error = externalError !== undefined ? externalError : internalError;

  // Validate on change if enabled
  useEffect(() => {
    if (validateOnChange && isTouched && rules) {
      setInternalError(validateField(value, rules));
    }
  }, [value, validateOnChange, isTouched, rules]);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
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
        <label
          htmlFor={name}
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          {label}
          {rules?.required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      {/* Select wrapper */}
      <div className="relative">
        <select
          id={name}
          name={name}
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
          className={`
            block w-full rounded-md shadow-sm px-3 py-2 pr-10
            appearance-none
            ${
              error
                ? 'border-red-300 text-red-900 focus:ring-red-500 focus:border-red-500'
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
        >
          {/* Placeholder option */}
          <option value="" disabled>
            {placeholder}
          </option>

          {/* Options */}
          {options.map((option) => (
            <option
              key={option.value}
              value={option.value}
              disabled={option.disabled}
            >
              {option.label}
            </option>
          ))}
        </select>

        {/* Dropdown arrow */}
        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
          <svg
            className={`h-5 w-5 ${error ? 'text-red-500' : 'text-gray-400'}`}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      </div>

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
