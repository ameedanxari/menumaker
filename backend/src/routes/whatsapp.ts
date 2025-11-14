import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { AppDataSource } from '../config/database.js';
import { BusinessSettings } from '../models/BusinessSettings.js';
import { WhatsAppService } from '../services/WhatsAppService.js';

/**
 * WhatsApp Routes (Phase 2.3)
 *
 * Endpoints for managing WhatsApp notification settings and testing
 */

interface WhatsAppSettingsRequest {
  whatsapp_enabled: boolean;
  whatsapp_phone_number?: string;
  whatsapp_notify_new_order?: boolean;
  whatsapp_notify_order_update?: boolean;
  whatsapp_notify_payment?: boolean;
  whatsapp_customer_notifications?: boolean;
}

interface TestConnectionRequest {
  phone_number: string;
}

export default async function whatsappRoutes(fastify: FastifyInstance) {
  const settingsRepo = AppDataSource.getRepository(BusinessSettings);

  /**
   * GET /whatsapp/settings
   * Get WhatsApp settings for the authenticated business
   */
  fastify.get(
    '/settings',
    {
      preHandler: [fastify.authenticate],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = request.user?.userId;

        if (!userId) {
          return reply.status(401).send({ error: 'Unauthorized' });
        }

        // Get business from user
        const business = await AppDataSource.query(
          `SELECT b.id, b.name FROM businesses b
           JOIN users u ON u.id = b.owner_id
           WHERE u.id = $1 LIMIT 1`,
          [userId]
        );

        if (!business || business.length === 0) {
          return reply.status(404).send({ error: 'Business not found' });
        }

        const businessId = business[0].id;

        // Get settings
        const settings = await settingsRepo.findOne({
          where: { business_id: businessId },
        });

        if (!settings) {
          return reply.status(404).send({ error: 'Settings not found' });
        }

        return reply.send({
          whatsapp_enabled: settings.whatsapp_enabled,
          whatsapp_phone_number: settings.whatsapp_phone_number,
          whatsapp_notify_new_order: settings.whatsapp_notify_new_order,
          whatsapp_notify_order_update: settings.whatsapp_notify_order_update,
          whatsapp_notify_payment: settings.whatsapp_notify_payment,
          whatsapp_customer_notifications: settings.whatsapp_customer_notifications,
        });
      } catch (error: any) {
        console.error('Error fetching WhatsApp settings:', error);
        return reply.status(500).send({ error: 'Internal server error' });
      }
    }
  );

  /**
   * PATCH /whatsapp/settings
   * Update WhatsApp settings for the authenticated business
   */
  fastify.patch<{ Body: WhatsAppSettingsRequest }>(
    '/settings',
    {
      preHandler: [fastify.authenticate],
    },
    async (request: FastifyRequest<{ Body: WhatsAppSettingsRequest }>, reply: FastifyReply) => {
      try {
        const userId = request.user?.userId;
        const body = request.body;

        if (!userId) {
          return reply.status(401).send({ error: 'Unauthorized' });
        }

        // Get business from user
        const business = await AppDataSource.query(
          `SELECT b.id FROM businesses b
           JOIN users u ON u.id = b.owner_id
           WHERE u.id = $1 LIMIT 1`,
          [userId]
        );

        if (!business || business.length === 0) {
          return reply.status(404).send({ error: 'Business not found' });
        }

        const businessId = business[0].id;

        // Validate phone number format if provided
        if (body.whatsapp_phone_number) {
          const phoneRegex = /^\+?[1-9]\d{1,14}$/; // E.164 format
          if (!phoneRegex.test(body.whatsapp_phone_number.replace(/\s/g, ''))) {
            return reply.status(400).send({
              error: 'Invalid phone number format. Use E.164 format (e.g., +14155238886)',
            });
          }
        }

        // Update settings
        await settingsRepo.update(
          { business_id: businessId },
          {
            whatsapp_enabled: body.whatsapp_enabled,
            whatsapp_phone_number: body.whatsapp_phone_number,
            whatsapp_notify_new_order: body.whatsapp_notify_new_order ?? true,
            whatsapp_notify_order_update: body.whatsapp_notify_order_update ?? true,
            whatsapp_notify_payment: body.whatsapp_notify_payment ?? true,
            whatsapp_customer_notifications: body.whatsapp_customer_notifications ?? false,
          }
        );

        const updatedSettings = await settingsRepo.findOne({
          where: { business_id: businessId },
        });

        return reply.send({
          message: 'WhatsApp settings updated successfully',
          settings: {
            whatsapp_enabled: updatedSettings?.whatsapp_enabled,
            whatsapp_phone_number: updatedSettings?.whatsapp_phone_number,
            whatsapp_notify_new_order: updatedSettings?.whatsapp_notify_new_order,
            whatsapp_notify_order_update: updatedSettings?.whatsapp_notify_order_update,
            whatsapp_notify_payment: updatedSettings?.whatsapp_notify_payment,
            whatsapp_customer_notifications: updatedSettings?.whatsapp_customer_notifications,
          },
        });
      } catch (error: any) {
        console.error('Error updating WhatsApp settings:', error);
        return reply.status(500).send({ error: 'Internal server error' });
      }
    }
  );

  /**
   * POST /whatsapp/test
   * Test WhatsApp connection by sending a test message
   */
  fastify.post<{ Body: TestConnectionRequest }>(
    '/test',
    {
      preHandler: [fastify.authenticate],
    },
    async (request: FastifyRequest<{ Body: TestConnectionRequest }>, reply: FastifyReply) => {
      try {
        const userId = request.user?.userId;
        const { phone_number } = request.body;

        if (!userId) {
          return reply.status(401).send({ error: 'Unauthorized' });
        }

        if (!phone_number) {
          return reply.status(400).send({ error: 'Phone number is required' });
        }

        // Test connection
        const result = await WhatsAppService.testConnection(phone_number);

        if (result.success) {
          return reply.send({
            success: true,
            message: 'Test message sent successfully! Check your WhatsApp.',
            message_id: result.messageId,
          });
        } else {
          return reply.status(500).send({
            success: false,
            error: result.error || 'Failed to send test message',
          });
        }
      } catch (error: any) {
        console.error('Error testing WhatsApp connection:', error);
        return reply.status(500).send({ error: 'Internal server error' });
      }
    }
  );

  /**
   * GET /whatsapp/stats
   * Get WhatsApp delivery statistics for the authenticated business
   */
  fastify.get(
    '/stats',
    {
      preHandler: [fastify.authenticate],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = request.user?.userId;

        if (!userId) {
          return reply.status(401).send({ error: 'Unauthorized' });
        }

        // Get business from user
        const business = await AppDataSource.query(
          `SELECT b.id FROM businesses b
           JOIN users u ON u.id = b.owner_id
           WHERE u.id = $1 LIMIT 1`,
          [userId]
        );

        if (!business || business.length === 0) {
          return reply.status(404).send({ error: 'Business not found' });
        }

        const businessId = business[0].id;

        // Get delivery stats
        const stats = await WhatsAppService.getDeliveryStats(businessId);

        return reply.send({
          total_messages: stats.total,
          messages_sent: stats.sent,
          messages_failed: stats.failed,
          delivery_rate: stats.deliveryRate.toFixed(2) + '%',
        });
      } catch (error: any) {
        console.error('Error fetching WhatsApp stats:', error);
        return reply.status(500).send({ error: 'Internal server error' });
      }
    }
  );
}
