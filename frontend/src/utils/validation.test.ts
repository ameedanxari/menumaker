import { describe, it, expect } from 'vitest';
import {
    validateField,
    validateForm,
    hasErrors,
    formatPrice,
    formatPhoneNumber,
    commonRules,
    ValidationRules
} from './validation.ts';

describe('Validation Utils', () => {
    describe('validateField', () => {
        it('should validate required fields', () => {
            const rule: ValidationRules = { required: true };
            expect(validateField('', rule)).toBe('This field is required');
            expect(validateField(null, rule)).toBe('This field is required');
            expect(validateField(undefined, rule)).toBe('This field is required');
            expect(validateField('value', rule)).toBeNull();
        });

        it('should support custom required messages', () => {
            const rule: ValidationRules = { required: 'Please enter a value' };
            expect(validateField('', rule)).toBe('Please enter a value');
        });

        it('should validate min length', () => {
            const rule: ValidationRules = { minLength: { value: 3 } };
            expect(validateField('ab', rule)).toContain('Must be at least 3 characters');
            expect(validateField('abc', rule)).toBeNull();
        });

        it('should validate max length', () => {
            const rule: ValidationRules = { maxLength: { value: 3 } };
            expect(validateField('abcd', rule)).toContain('Must be no more than 3 characters');
            expect(validateField('abc', rule)).toBeNull();
        });

        it('should validate exact length via pattern', () => {
            // Though not directly built-in, pattern can be used
            const rule: ValidationRules = { pattern: { value: /^.{3}$/, message: 'Must be 3 chars' } };
            expect(validateField('ab', rule)).toBe('Must be 3 chars');
            expect(validateField('abc', rule)).toBeNull();
        });

        it('should validate email format', () => {
            const rule: ValidationRules = { email: true };
            expect(validateField('invalid', rule)).toBe('Please enter a valid email address');
            expect(validateField('test@example.com', rule)).toBeNull();
        });

        it('should validate phone format', () => {
            const rule: ValidationRules = { phone: true };
            expect(validateField('123', rule)).toBe('Please enter a valid phone number (e.g., +1234567890)');
            expect(validateField('+1234567890', rule)).toBeNull();
        });

        it('should validate numeric ranges', () => {
            const rule: ValidationRules = { min: { value: 10 }, max: { value: 20 } };
            expect(validateField(5, rule)).toContain('Must be at least 10');
            expect(validateField(25, rule)).toContain('Must be no more than 20');
            expect(validateField(15, rule)).toBeNull();
        });

        it('should validate custom rules', () => {
            const rule: ValidationRules = {
                custom: {
                    validate: (val: string) => val === 'secret',
                    message: 'Wrong secret'
                }
            };
            expect(validateField('wrong', rule)).toBe('Wrong secret');
            expect(validateField('secret', rule)).toBeNull();
        });
    });

    describe('validateForm', () => {
        it('should validate all fields in a form object', () => {
            const values = { name: '', age: 10 };
            const rules = {
                name: { required: true },
                age: { min: { value: 18, message: 'Must be 18+' } }
            };

            const errors = validateForm(values, rules);
            expect(errors.name).toBe('This field is required');
            expect(errors.age).toBe('Must be 18+');
        });

        it('should return null for valid fields', () => {
            const values = { name: 'John', age: 20 };
            const rules = {
                name: { required: true },
                age: { min: { value: 18 } }
            };

            const errors = validateForm(values, rules);
            expect(errors.name).toBeNull();
            expect(errors.age).toBeNull();
        });
    });

    describe('hasErrors', () => {
        it('should return true if any field has an error', () => {
            expect(hasErrors({ field1: 'Error', field2: null })).toBe(true);
        });

        it('should return false if all fields are valid', () => {
            expect(hasErrors({ field1: null, field2: null })).toBe(false);
        });
    });

    describe('commonRules', () => {
        it('should have predefined rules', () => {
            expect(commonRules.email.required).toBe(true);
            expect(commonRules.password.required).toBe(true);
            expect(commonRules.phone.required).toBe(true);
        });

        it('password rule should match complexity requirements', () => {
            const passwordRule = commonRules.password.custom as any;
            expect(passwordRule.validate('weak')).toBe(false);
            expect(passwordRule.validate('Strong1')).toBe(true);
        });
    });

    describe('formatPrice', () => {
        it('should format price string correctly', () => {
            expect(formatPrice('abc')).toBe('');
            expect(formatPrice('12.345')).toBe('12.34');
            expect(formatPrice('12.')).toBe('12.');
            expect(formatPrice('.5')).toBe('.5');
            expect(formatPrice('100')).toBe('100');
        });
    });

    describe('formatPhoneNumber', () => {
        it('should format US phone numbers', () => {
            expect(formatPhoneNumber('1234567890')).toBe('(123) 456-7890');
        });

        it('should format international numbers with + prefix', () => {
            expect(formatPhoneNumber('12345678901')).toBe('+12345678901');
        });

        it('should leave unknown formats alone', () => {
            expect(formatPhoneNumber('123')).toBe('123');
        });
    });
});
