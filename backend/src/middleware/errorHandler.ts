import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';

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

  request.log.error(error);

  reply.status(statusCode).send({
    success: false,
    error: {
      code,
      message: error.message || 'An unexpected error occurred',
      ...(process.env.NODE_ENV === 'development' && {
        details: (error as AppError).details,
        stack: error.stack,
      }),
    },
  });
}
