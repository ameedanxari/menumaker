import { describe, it, expect } from '@jest/globals';
import { z } from 'zod';
import { slugify, generateUniqueSlug } from '../src/utils/slug';
import { validateSchema } from '../src/utils/validation';

describe('Utils', () => {
    describe('slugify', () => {
        it('should convert text to lowercase', () => {
            expect(slugify('Hello World')).toBe('hello-world');
        });

        it('should replace spaces with hyphens', () => {
            expect(slugify('hello world')).toBe('hello-world');
        });

        it('should remove special characters', () => {
            expect(slugify('hello@world!')).toBe('helloworld');
        });

        it('should collapse multiple hyphens', () => {
            expect(slugify('hello   world')).toBe('hello-world');
        });

        it('should remove leading and trailing hyphens', () => {
            expect(slugify('-hello world-')).toBe('hello-world');
        });

        it('should handle empty string', () => {
            expect(slugify('')).toBe('');
        });

        it('should handle numbers', () => {
            expect(slugify('Item 123')).toBe('item-123');
        });
    });

    describe('generateUniqueSlug', () => {
        it('should return base slug if not in existing slugs', () => {
            expect(generateUniqueSlug('test', ['other'])).toBe('test');
        });

        it('should append number if slug exists', () => {
            expect(generateUniqueSlug('test', ['test'])).toBe('test-1');
        });

        it('should increment number until unique', () => {
            expect(generateUniqueSlug('test', ['test', 'test-1'])).toBe('test-2');
        });

        it('should handle complex base slugs', () => {
            expect(generateUniqueSlug('My Cafe', ['my-cafe'])).toBe('my-cafe-1');
        });
    });

    describe('validateSchema', () => {
        const schema = z.object({
            name: z.string().min(3),
            age: z.number().min(18),
            email: z.string().email().optional(),
        });

        it('should return parsed data for valid input', () => {
            const input = { name: 'John', age: 25, email: 'john@example.com' };
            const result = validateSchema(schema, input);
            expect(result).toEqual(input);
        });

        it('should throw validation error for invalid input', () => {
            const input = { name: 'Jo', age: 10 };
            try {
                validateSchema(schema, input);
            } catch (error: any) {
                expect(error.code).toBe('VALIDATION_ERROR');
                expect(error.statusCode).toBe(422);
                expect(error.details).toHaveLength(2);
                expect(error.details[0].field).toBe('name');
                expect(error.details[1].field).toBe('age');
            }
        });

        it('should rethrow non-Zod errors', () => {
            const badSchema = {
                parse: () => { throw new Error('Random error'); }
            } as any;

            expect(() => validateSchema(badSchema, {})).toThrow('Random error');
        });
    });
});
