import { FastifyRequest } from 'fastify';

/**
 * Structured logging utility for consistent log format across the application.
 * Provides context-aware logging with request tracking and error categorization.
 */

export interface LogContext {
  requestId?: string;
  userId?: string;
  businessId?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  duration?: number;
  [key: string]: unknown;
}

export interface ErrorLogContext extends LogContext {
  errorCode?: string;
  errorCategory?: ErrorCategory;
  stackTrace?: string;
  errorDetails?: unknown;
}

export enum ErrorCategory {
  VALIDATION = 'validation',
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  NOT_FOUND = 'not_found',
  DATABASE = 'database',
  EXTERNAL_API = 'external_api',
  FILE_UPLOAD = 'file_upload',
  RATE_LIMIT = 'rate_limit',
  INTERNAL = 'internal',
}

/**
 * Extract request context for logging
 */
export function getRequestContext(request: FastifyRequest): LogContext {
  return {
    requestId: request.id,
    userId: request.user?.userId,
    businessId: (request.query as { businessId?: string })?.businessId,
    method: request.method,
    path: request.url,
  };
}

/**
 * Categorize errors based on status code and error code
 */
export function categorizeError(statusCode: number, errorCode?: string): ErrorCategory {
  if (statusCode === 400) {
    if (errorCode?.includes('VALIDATION')) return ErrorCategory.VALIDATION;
    return ErrorCategory.VALIDATION;
  }

  if (statusCode === 401) return ErrorCategory.AUTHENTICATION;
  if (statusCode === 403) return ErrorCategory.AUTHORIZATION;
  if (statusCode === 404) return ErrorCategory.NOT_FOUND;
  if (statusCode === 429) return ErrorCategory.RATE_LIMIT;

  if (statusCode >= 500) {
    if (errorCode?.includes('DATABASE')) return ErrorCategory.DATABASE;
    if (errorCode?.includes('UPLOAD')) return ErrorCategory.FILE_UPLOAD;
    return ErrorCategory.INTERNAL;
  }

  return ErrorCategory.INTERNAL;
}

/**
 * Log structured error with full context
 */
export function logError(
  logger: FastifyRequest['log'],
  error: Error,
  context: ErrorLogContext
): void {
  const errorCategory = categorizeError(
    context.statusCode || 500,
    context.errorCode
  );

  logger.error({
    msg: error.message,
    error: {
      name: error.name,
      message: error.message,
      code: context.errorCode,
      category: errorCategory,
      stack: context.stackTrace || error.stack,
      details: context.errorDetails,
    },
    request: {
      id: context.requestId,
      method: context.method,
      path: context.path,
      userId: context.userId,
      businessId: context.businessId,
    },
    response: {
      statusCode: context.statusCode,
    },
    timestamp: new Date().toISOString(),
  });
}

/**
 * Log successful request with context
 */
export function logRequest(
  logger: FastifyRequest['log'],
  context: LogContext & { duration: number }
): void {
  // Only log slow requests or errors in production to reduce noise
  const isProduction = process.env.NODE_ENV === 'production';
  const isSlow = context.duration && context.duration > 1000; // >1 second
  const isError = context.statusCode && context.statusCode >= 400;

  if (!isProduction || isSlow || isError) {
    logger.info({
      msg: `${context.method} ${context.path} - ${context.statusCode}`,
      request: {
        id: context.requestId,
        method: context.method,
        path: context.path,
        userId: context.userId,
        businessId: context.businessId,
      },
      response: {
        statusCode: context.statusCode,
        duration: context.duration,
      },
      timestamp: new Date().toISOString(),
      ...(isSlow && { performance: 'slow' }),
    });
  }
}

/**
 * Log database query with timing
 */
export function logDatabaseQuery(
  logger: FastifyRequest['log'],
  query: string,
  duration: number,
  context?: Partial<LogContext>
): void {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const isSlow = duration > 100; // >100ms

  if (isDevelopment || isSlow) {
    logger.debug({
      msg: 'Database query executed',
      database: {
        query: query.substring(0, 200), // Limit query length
        duration,
        slow: isSlow,
      },
      ...context,
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Log security event (failed auth, suspicious activity, etc.)
 */
export function logSecurityEvent(
  logger: FastifyRequest['log'],
  event: string,
  context: LogContext & { severity: 'low' | 'medium' | 'high' | 'critical' }
): void {
  logger.warn({
    msg: `Security event: ${event}`,
    security: {
      event,
      severity: context.severity,
    },
    request: {
      id: context.requestId,
      method: context.method,
      path: context.path,
      userId: context.userId,
    },
    timestamp: new Date().toISOString(),
  });
}

/**
 * Log business metric/analytics event
 */
export function logMetric(
  logger: FastifyRequest['log'],
  metric: string,
  value: number,
  context?: Partial<LogContext>
): void {
  logger.info({
    msg: `Metric: ${metric}`,
    metric: {
      name: metric,
      value,
    },
    ...context,
    timestamp: new Date().toISOString(),
  });
}
