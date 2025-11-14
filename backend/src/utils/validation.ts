import { ZodSchema, ZodError } from 'zod';

export interface ValidationError {
  field: string;
  message: string;
}

export function validateSchema<T>(schema: ZodSchema<T>, data: unknown): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof ZodError) {
      const errors: ValidationError[] = error.errors.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
      }));

      const validationError = new Error('Validation failed') as Error & {
        statusCode: number;
        code: string;
        details: ValidationError[];
      };
      validationError.statusCode = 422;
      validationError.code = 'VALIDATION_ERROR';
      validationError.details = errors;

      throw validationError;
    }
    throw error;
  }
}
