import { FastifyRequest, FastifyReply } from 'fastify';
import { logRequest, getRequestContext } from '../utils/logger.js';

/**
 * Request logging middleware that tracks request duration and logs completion.
 * Provides performance monitoring and request tracing capabilities.
 */
export async function requestLogger(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const startTime = Date.now();

  // Add response hook to log when request completes
  reply.addHook('onSend', async (_request: FastifyRequest, _reply: FastifyReply) => {
    const duration = Date.now() - startTime;
    const context = getRequestContext(request);

    logRequest(request.log, {
      ...context,
      statusCode: reply.statusCode,
      duration,
    });
  });
}

/**
 * Hook to add custom request ID if not present.
 * Fastify generates request IDs by default, but this ensures they're always present.
 */
export function ensureRequestId(request: FastifyRequest): void {
  if (!request.id) {
    // Fastify should always generate an ID, but as a fallback:
    request.id = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
