import { useState, useEffect, InputHTMLAttributes } from 'react';
import { ValidationRules, validateField } from '../../utils/validation';

interface FormInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
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
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  containerClassName?: string;
}

/**
 * Reusable form input component with built-in validation
 */
export function FormInput({
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
  leftIcon,
  rightIcon,
  containerClassName = '',
  className = '',
  ...props
}: FormInputProps) {
  const [internalError, setInternalError] = useState<string | null>(null);
  const [isTouched, setIsTouched] = useState(false);

  const error = externalError !== undefined ? externalError : internalError;

  // Validate on change if enabled
  useEffect(() => {
    if (validateOnChange && isTouched && rules) {
      setInternalError(validateField(value, rules));
    }
  }, [value, validateOnChange, isTouched, rules]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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

      {/* Input wrapper */}
      <div className="relative">
        {/* Left icon */}
        {leftIcon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            {leftIcon}
          </div>
        )}

        {/* Input */}
        <input
          id={name}
          name={name}
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
          className={`
            block w-full rounded-md shadow-sm
            ${leftIcon ? 'pl-10' : 'pl-3'}
            ${rightIcon ? 'pr-10' : 'pr-3'}
            py-2
            ${
              error
                ? 'border-red-300 text-red-900 placeholder-red-300 focus:ring-red-500 focus:border-red-500'
                : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
            }
            ${props.disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}
            ${className}
          `}
          aria-invalid={!!error}
          aria-describedby={error ? `${name}-error` : hint ? `${name}-hint` : undefined}
          {...props}
        />

        {/* Right icon */}
        {rightIcon && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            {rightIcon}
          </div>
        )}

        {/* Error icon */}
        {error && !rightIcon && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <svg
              className="h-5 w-5 text-red-500"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        )}
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
