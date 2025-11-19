import { FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/auth.js';
import { AppDataSource } from '../config/database.js';
import { Notification } from '../models/Notification.js';

/**
 * Notification Routes
 *
 * Endpoints for managing user notifications
 */
export async function notificationRoutes(fastify: FastifyInstance): Promise<void> {
  const notificationRepo = AppDataSource.getRepository(Notification);

  /**
   * GET /notifications
   * Get all notifications for authenticated user
   */
  fastify.get('/', {
    preHandler: authenticate,
  }, async (request, reply) => {
    const { limit = 50, offset = 0, unread_only } = request.query as {
      limit?: number;
      offset?: number;
      unread_only?: boolean;
    };

    const where: any = { user_id: request.user!.userId };
    if (unread_only) {
      where.is_read = false;
    }

    const [notifications, total] = await notificationRepo.findAndCount({
      where,
      order: { created_at: 'DESC' },
      take: limit,
      skip: offset,
    });

    reply.send({
      success: true,
      data: {
        notifications,
        total,
        limit,
        offset,
      },
    });
  });

  /**
   * GET /notifications/:id
   * Get notification by ID
   */
  fastify.get<{
    Params: { id: string };
  }>('/:id', {
    preHandler: authenticate,
  }, async (request, reply) => {
    const { id } = request.params;

    const notification = await notificationRepo.findOne({
      where: {
        id,
        user_id: request.user!.userId,
      },
    });

    if (!notification) {
      return reply.status(404).send({
        success: false,
        error: {
          code: 'NOTIFICATION_NOT_FOUND',
          message: 'Notification not found',
        },
      });
    }

    reply.send({
      success: true,
      data: { notification },
    });
  });

  /**
   * PATCH /notifications/:id
   * Mark notification as read
   */
  fastify.patch<{
    Params: { id: string };
  }>('/:id', {
    preHandler: authenticate,
  }, async (request, reply) => {
    const { id } = request.params;
    const { is_read } = request.body as { is_read: boolean };

    const notification = await notificationRepo.findOne({
      where: {
        id,
        user_id: request.user!.userId,
      },
    });

    if (!notification) {
      return reply.status(404).send({
        success: false,
        error: {
          code: 'NOTIFICATION_NOT_FOUND',
          message: 'Notification not found',
        },
      });
    }

    notification.is_read = is_read ?? true;
    await notificationRepo.save(notification);

    reply.send({
      success: true,
      data: { notification },
      message: 'Notification updated successfully',
    });
  });

  /**
   * POST /notifications/mark-all-read
   * Mark all notifications as read
   */
  fastify.post('/mark-all-read', {
    preHandler: authenticate,
  }, async (request, reply) => {
    await notificationRepo.update(
      { user_id: request.user!.userId, is_read: false },
      { is_read: true }
    );

    reply.send({
      success: true,
      message: 'All notifications marked as read',
    });
  });

  /**
   * GET /notifications/unread-count
   * Get count of unread notifications
   */
  fastify.get('/unread-count', {
    preHandler: authenticate,
  }, async (request, reply) => {
    const count = await notificationRepo.count({
      where: {
        user_id: request.user!.userId,
        is_read: false,
      },
    });

    reply.send({
      success: true,
      data: { count },
    });
  });
}
