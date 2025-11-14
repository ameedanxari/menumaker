/**
 * Form validation utilities with user-friendly error messages
 */

export type ValidationRule = {
  validate: (value: any) => boolean;
  message: string;
};

export type ValidationRules = {
  required?: boolean | string;
  minLength?: { value: number; message?: string };
  maxLength?: { value: number; message?: string };
  min?: { value: number; message?: string };
  max?: { value: number; message?: string };
  pattern?: { value: RegExp; message?: string };
  email?: boolean | string;
  phone?: boolean | string;
  url?: boolean | string;
  custom?: ValidationRule | ValidationRule[];
};

/**
 * Validate a single field value against rules
 */
export function validateField(
  value: any,
  rules: ValidationRules
): string | null {
  // Required check
  if (rules.required) {
    if (
      value === undefined ||
      value === null ||
      value === '' ||
      (Array.isArray(value) && value.length === 0)
    ) {
      return typeof rules.required === 'string'
        ? rules.required
        : 'This field is required';
    }
  }

  // If value is empty and not required, skip other validations
  if (!value && !rules.required) {
    return null;
  }

  // String validations
  if (typeof value === 'string') {
    // Min length
    if (rules.minLength && value.length < rules.minLength.value) {
      return (
        rules.minLength.message ||
        `Must be at least ${rules.minLength.value} characters`
      );
    }

    // Max length
    if (rules.maxLength && value.length > rules.maxLength.value) {
      return (
        rules.maxLength.message ||
        `Must be no more than ${rules.maxLength.value} characters`
      );
    }

    // Email
    if (rules.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        return typeof rules.email === 'string'
          ? rules.email
          : 'Please enter a valid email address';
      }
    }

    // Phone
    if (rules.phone) {
      const phoneRegex = /^\+?[1-9]\d{9,14}$/;
      if (!phoneRegex.test(value.replace(/[\s()-]/g, ''))) {
        return typeof rules.phone === 'string'
          ? rules.phone
          : 'Please enter a valid phone number (e.g., +1234567890)';
      }
    }

    // URL
    if (rules.url) {
      try {
        new URL(value);
      } catch {
        return typeof rules.url === 'string'
          ? rules.url
          : 'Please enter a valid URL';
      }
    }

    // Pattern
    if (rules.pattern && !rules.pattern.value.test(value)) {
      return rules.pattern.message || 'Invalid format';
    }
  }

  // Number validations
  if (typeof value === 'number') {
    // Min
    if (rules.min !== undefined && value < rules.min.value) {
      return rules.min.message || `Must be at least ${rules.min.value}`;
    }

    // Max
    if (rules.max !== undefined && value > rules.max.value) {
      return rules.max.message || `Must be no more than ${rules.max.value}`;
    }
  }

  // Custom validations
  if (rules.custom) {
    const customRules = Array.isArray(rules.custom)
      ? rules.custom
      : [rules.custom];

    for (const rule of customRules) {
      if (!rule.validate(value)) {
        return rule.message;
      }
    }
  }

  return null;
}

/**
 * Validate entire form object
 */
export function validateForm<T extends Record<string, any>>(
  values: T,
  rules: Record<keyof T, ValidationRules>
): Record<keyof T, string | null> {
  const errors: Record<string, string | null> = {};

  for (const field in rules) {
    errors[field] = validateField(values[field], rules[field]);
  }

  return errors as Record<keyof T, string | null>;
}

/**
 * Check if form has any errors
 */
export function hasErrors(
  errors: Record<string, string | null>
): boolean {
  return Object.values(errors).some((error) => error !== null);
}

/**
 * Common validation rules
 */
export const commonRules = {
  email: {
    email: true,
    required: true,
  },

  password: {
    required: true,
    minLength: { value: 8, message: 'Password must be at least 8 characters' },
    custom: {
      validate: (value: string) =>
        /(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(value),
      message:
        'Password must contain uppercase, lowercase, and a number',
    },
  },

  phone: {
    phone: true,
    required: true,
  },

  price: {
    required: true,
    min: { value: 0, message: 'Price must be positive' },
    custom: {
      validate: (value: number) => !isNaN(value),
      message: 'Please enter a valid price',
    },
  },

  url: {
    url: true,
  },

  nonEmpty: {
    required: 'This field cannot be empty',
  },
};

/**
 * Format price for display and validation
 */
export function formatPrice(value: string): string {
  // Remove non-numeric characters except decimal point
  const cleaned = value.replace(/[^\d.]/g, '');

  // Ensure only one decimal point
  const parts = cleaned.split('.');
  if (parts.length > 2) {
    return parts[0] + '.' + parts.slice(1).join('');
  }

  // Limit to 2 decimal places
  if (parts.length === 2) {
    return parts[0] + '.' + parts[1].substring(0, 2);
  }

  return cleaned;
}

/**
 * Format phone number for display
 */
export function formatPhoneNumber(value: string): string {
  // Remove non-numeric characters
  const cleaned = value.replace(/\D/g, '');

  // Format as (XXX) XXX-XXXX for US numbers
  if (cleaned.length === 10) {
    return `(${cleaned.substring(0, 3)}) ${cleaned.substring(
      3,
      6
    )}-${cleaned.substring(6)}`;
  }

  // Format with country code
  if (cleaned.length > 10) {
    return `+${cleaned}`;
  }

  return value;
}
