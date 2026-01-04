import { FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/auth.js';
import { AppDataSource } from '../config/database.js';
import { Notification } from '../models/Notification.js';
import { NotificationDevice } from '../models/NotificationDevice.js';

/**
 * Notification Routes
 *
 * Endpoints for managing user notifications
 */
export async function notificationRoutes(fastify: FastifyInstance): Promise<void> {
  const notificationRepo = AppDataSource.getRepository(Notification);
  const deviceRepo = AppDataSource.getRepository(NotificationDevice);

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

  /**
   * POST /notifications/devices
   * Register or update a device token for push notifications
   */
  fastify.post('/devices', {
    preHandler: authenticate,
  }, async (request, reply) => {
    const { device_token, platform, locale, app_version, device_model } = request.body as {
      device_token: string;
      platform: 'ios' | 'android' | 'web';
      locale?: string;
      app_version?: string;
      device_model?: string;
    };

    if (!device_token || !platform) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'INVALID_DEVICE',
          message: 'device_token and platform are required',
        },
      });
    }

    const existing = await deviceRepo.findOne({
      where: { device_token },
    });

    if (existing) {
      existing.user_id = request.user!.userId;
      existing.platform = platform;
      existing.locale = locale;
      existing.app_version = app_version;
      existing.device_model = device_model;
      existing.last_seen_at = new Date();
      await deviceRepo.save(existing);

      return reply.send({
        success: true,
        data: { device: existing },
        message: 'Device updated',
      });
    }

    const device = deviceRepo.create({
      user_id: request.user!.userId,
      device_token,
      platform,
      locale,
      app_version,
      device_model,
      last_seen_at: new Date(),
    });

    await deviceRepo.save(device);

    reply.send({
      success: true,
      data: { device },
      message: 'Device registered',
    });
  });
}
