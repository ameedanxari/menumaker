import { FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/auth.js';
import { AppDataSource } from '../config/database.js';
import { UserSettings } from '../models/UserSettings.js';

/**
 * Settings Routes
 *
 * Endpoints for managing user settings and preferences
 */
export async function settingsRoutes(fastify: FastifyInstance): Promise<void> {
  const settingsRepo = AppDataSource.getRepository(UserSettings);

  /**
   * GET /settings
   * Get user settings
   */
  fastify.get('/', {
    preHandler: authenticate,
  }, async (request, reply) => {
    let settings = await settingsRepo.findOne({
      where: { user_id: request.user!.userId },
    });

    // Create default settings if they don't exist
    if (!settings) {
      settings = settingsRepo.create({
        user_id: request.user!.userId,
      });
      await settingsRepo.save(settings);
    }

    reply.send({
      success: true,
      data: { settings },
    });
  });

  /**
   * PATCH /settings
   * Update user settings
   */
  fastify.patch('/', {
    preHandler: authenticate,
  }, async (request, reply) => {
    const updates = request.body as Partial<{
      language: string;
      notifications_enabled: boolean;
      order_notifications: boolean;
      promotion_notifications: boolean;
      review_notifications: boolean;
      biometric_enabled: boolean;
      theme: string;
    }>;

    let settings = await settingsRepo.findOne({
      where: { user_id: request.user!.userId },
    });

    // Create if doesn't exist
    if (!settings) {
      settings = settingsRepo.create({
        user_id: request.user!.userId,
        ...updates,
      });
    } else {
      // Update existing settings
      Object.assign(settings, updates);
    }

    await settingsRepo.save(settings);

    reply.send({
      success: true,
      data: { settings },
      message: 'Settings updated successfully',
    });
  });
}
