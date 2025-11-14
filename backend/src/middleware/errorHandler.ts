import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { logError, getRequestContext, logSecurityEvent } from '../utils/logger.js';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
  details?: unknown;
}

export async function errorHandler(
  error: FastifyError | AppError,
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const statusCode = (error as AppError).statusCode || error.statusCode || 500;
  const code = (error as AppError).code || 'INTERNAL_SERVER_ERROR';

  // Extract request context
  const context = getRequestContext(request);

  // Log error with structured logging
  logError(request.log, error, {
    ...context,
    errorCode: code,
    statusCode,
    stackTrace: error.stack,
    errorDetails: (error as AppError).details,
  });

  // Log security events for authentication/authorization failures
  if (statusCode === 401 || statusCode === 403) {
    logSecurityEvent(request.log, `${statusCode} - ${code}`, {
      ...context,
      severity: statusCode === 403 ? 'high' : 'medium',
    });
  }

  // Log suspicious activity
  if (statusCode === 429) {
    logSecurityEvent(request.log, 'Rate limit exceeded', {
      ...context,
      severity: 'medium',
    });
  }

  // Sanitize error message for production
  const message =
    statusCode >= 500 && process.env.NODE_ENV === 'production'
      ? 'An unexpected error occurred. Please try again later.'
      : error.message || 'An unexpected error occurred';

  reply.status(statusCode).send({
    success: false,
    error: {
      code,
      message,
      requestId: request.id, // Include request ID for support
      ...(process.env.NODE_ENV === 'development' && {
        details: (error as AppError).details,
        stack: error.stack,
      }),
    },
  });
}
