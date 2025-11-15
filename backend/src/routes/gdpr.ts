import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { GDPRService } from '../services/GDPRService.js';
import { AppDataSource } from '../config/database.js';
import { User } from '../models/User.js';

/**
 * GDPR Routes (Phase 2.6)
 *
 * Endpoints for GDPR compliance:
 * - Cookie consent tracking
 * - Account deletion requests
 * - Legal template management
 */

interface CookieConsentRequest {
  visitor_id: string;
  consent_method: 'accept_all' | 'reject_all' | 'customize';
  analytics?: boolean;
  marketing?: boolean;
  language?: string;
}

interface DeletionRequestBody {
  reason?: string;
}

interface LegalTemplateRequest {
  template_type: 'privacy_policy' | 'terms_conditions' | 'refund_policy' | 'allergen_disclaimer';
  jurisdiction?: string;
  content: string;
  customizations?: Record<string, string>;
}

export default async function gdprRoutes(fastify: FastifyInstance) {
  /**
   * POST /cookie-consent
   * Record cookie consent preferences (no auth required - public)
   */
  fastify.post<{ Body: CookieConsentRequest }>(
    '/cookie-consent',
    async (request: FastifyRequest<{ Body: CookieConsentRequest }>, reply: FastifyReply) => {
      try {
        const { visitor_id, consent_method, analytics, marketing, language } = request.body;

        if (!visitor_id || !consent_method) {
          return reply.status(400).send({ error: 'visitor_id and consent_method are required' });
        }

        const ip_address = request.ip;
        const user_agent = request.headers['user-agent'];

        const consent = await GDPRService.recordCookieConsent({
          visitor_id,
          ip_address,
          user_agent,
          consent_method,
          analytics,
          marketing,
          language,
        });

        return reply.send({
          success: true,
          data: {
            id: consent.id,
            visitor_id: consent.visitor_id,
            consent_method: consent.consent_method,
            essential: consent.essential,
            analytics: consent.analytics,
            marketing: consent.marketing,
            expires_at: consent.expires_at,
          },
        });
      } catch (error: any) {
        console.error('Error recording cookie consent:', error);
        return reply.status(500).send({ error: 'Internal server error' });
      }
    }
  );

  /**
   * GET /cookie-consent/:visitor_id
   * Get cookie consent for visitor (no auth required - public)
   */
  fastify.get<{ Params: { visitor_id: string } }>(
    '/cookie-consent/:visitor_id',
    async (request: FastifyRequest<{ Params: { visitor_id: string } }>, reply: FastifyReply) => {
      try {
        const { visitor_id } = request.params;

        const consent = await GDPRService.getCookieConsent(visitor_id);

        if (!consent) {
          return reply.status(404).send({
            success: false,
            error: 'No valid cookie consent found',
          });
        }

        return reply.send({
          success: true,
          data: {
            id: consent.id,
            visitor_id: consent.visitor_id,
            consent_method: consent.consent_method,
            essential: consent.essential,
            analytics: consent.analytics,
            marketing: consent.marketing,
            expires_at: consent.expires_at,
          },
        });
      } catch (error: any) {
        console.error('Error fetching cookie consent:', error);
        return reply.status(500).send({ error: 'Internal server error' });
      }
    }
  );

  /**
   * POST /deletion-request
   * Request account deletion (auth required)
   */
  fastify.post<{ Body: DeletionRequestBody }>(
    '/deletion-request',
    {
      preHandler: [fastify.authenticate],
    },
    async (request: FastifyRequest<{ Body: DeletionRequestBody }>, reply: FastifyReply) => {
      try {
        const userId = request.user?.userId;

        if (!userId) {
          return reply.status(401).send({ error: 'Unauthorized' });
        }

        const { reason } = request.body;

        const deletionRequest = await GDPRService.requestAccountDeletion({
          user_id: userId,
          reason,
        });

        return reply.send({
          success: true,
          message: 'Account deletion requested. You have 30 days to cancel.',
          data: {
            id: deletionRequest.id,
            status: deletionRequest.status,
            scheduled_deletion_date: deletionRequest.scheduled_deletion_date,
            created_at: deletionRequest.created_at,
          },
        });
      } catch (error: any) {
        console.error('Error requesting account deletion:', error);

        if (error.message === 'Account deletion already requested') {
          return reply.status(400).send({ error: error.message });
        }

        return reply.status(500).send({ error: 'Internal server error' });
      }
    }
  );

  /**
   * DELETE /deletion-request
   * Cancel account deletion request (auth required)
   */
  fastify.delete(
    '/deletion-request',
    {
      preHandler: [fastify.authenticate],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = request.user?.userId;

        if (!userId) {
          return reply.status(401).send({ error: 'Unauthorized' });
        }

        const deletionRequest = await GDPRService.cancelDeletionRequest(userId);

        return reply.send({
          success: true,
          message: 'Account deletion cancelled.',
          data: {
            id: deletionRequest.id,
            status: deletionRequest.status,
            cancelled_at: deletionRequest.cancelled_at,
          },
        });
      } catch (error: any) {
        console.error('Error cancelling deletion request:', error);

        if (error.message === 'No pending deletion request found') {
          return reply.status(404).send({ error: error.message });
        }

        return reply.status(500).send({ error: 'Internal server error' });
      }
    }
  );

  /**
   * GET /deletion-request/status
   * Get deletion request status (auth required)
   */
  fastify.get(
    '/deletion-request/status',
    {
      preHandler: [fastify.authenticate],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = request.user?.userId;

        if (!userId) {
          return reply.status(401).send({ error: 'Unauthorized' });
        }

        const deletionRequest = await GDPRService.getDeletionRequestStatus(userId);

        if (!deletionRequest) {
          return reply.send({
            success: true,
            data: null,
          });
        }

        return reply.send({
          success: true,
          data: {
            id: deletionRequest.id,
            status: deletionRequest.status,
            scheduled_deletion_date: deletionRequest.scheduled_deletion_date,
            cancelled_at: deletionRequest.cancelled_at,
            completed_at: deletionRequest.completed_at,
            created_at: deletionRequest.created_at,
          },
        });
      } catch (error: any) {
        console.error('Error fetching deletion request status:', error);
        return reply.status(500).send({ error: 'Internal server error' });
      }
    }
  );

  /**
   * POST /legal-template
   * Create or update legal template (auth required)
   */
  fastify.post<{ Body: LegalTemplateRequest }>(
    '/legal-template',
    {
      preHandler: [fastify.authenticate],
    },
    async (request: FastifyRequest<{ Body: LegalTemplateRequest }>, reply: FastifyReply) => {
      try {
        const userId = request.user?.userId;

        if (!userId) {
          return reply.status(401).send({ error: 'Unauthorized' });
        }

        // Get user's business
        const userRepo = AppDataSource.getRepository(User);
        const user = await userRepo.findOne({
          where: { id: userId },
          relations: ['business'],
        });

        if (!user || !user.business) {
          return reply.status(404).send({ error: 'Business not found' });
        }

        const { template_type, jurisdiction, content, customizations } = request.body;

        if (!template_type || !content) {
          return reply.status(400).send({ error: 'template_type and content are required' });
        }

        const template = await GDPRService.upsertLegalTemplate({
          business_id: user.business.id,
          template_type,
          jurisdiction,
          content,
          customizations,
        });

        return reply.send({
          success: true,
          data: {
            id: template.id,
            template_type: template.template_type,
            jurisdiction: template.jurisdiction,
            version: template.version,
            is_published: template.is_published,
            created_at: template.created_at,
          },
        });
      } catch (error: any) {
        console.error('Error creating/updating legal template:', error);
        return reply.status(500).send({ error: 'Internal server error' });
      }
    }
  );

  /**
   * POST /legal-template/:id/publish
   * Publish legal template (auth required)
   */
  fastify.post<{ Params: { id: string } }>(
    '/legal-template/:id/publish',
    {
      preHandler: [fastify.authenticate],
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        const { id } = request.params;

        const template = await GDPRService.publishLegalTemplate(id);

        return reply.send({
          success: true,
          message: 'Legal template published',
          data: {
            id: template.id,
            template_type: template.template_type,
            version: template.version,
            is_published: template.is_published,
            published_at: template.published_at,
          },
        });
      } catch (error: any) {
        console.error('Error publishing legal template:', error);

        if (error.message === 'Legal template not found') {
          return reply.status(404).send({ error: error.message });
        }

        return reply.status(500).send({ error: 'Internal server error' });
      }
    }
  );

  /**
   * GET /legal-template/:template_type
   * Get legal template (public - for displaying on menu footer)
   */
  fastify.get<{
    Params: { template_type: string };
    Querystring: { business_id?: string; jurisdiction?: string };
  }>(
    '/legal-template/:template_type',
    async (
      request: FastifyRequest<{
        Params: { template_type: string };
        Querystring: { business_id?: string; jurisdiction?: string };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { template_type } = request.params;
        const { business_id, jurisdiction } = request.query;

        const template = await GDPRService.getLegalTemplate(business_id, template_type, jurisdiction || 'IN');

        if (!template) {
          return reply.status(404).send({
            success: false,
            error: 'Legal template not found',
          });
        }

        // Render template with customizations
        const rendered = GDPRService.renderTemplate(template);

        return reply.send({
          success: true,
          data: {
            id: template.id,
            template_type: template.template_type,
            jurisdiction: template.jurisdiction,
            content: rendered,
            version: template.version,
            published_at: template.published_at,
          },
        });
      } catch (error: any) {
        console.error('Error fetching legal template:', error);
        return reply.status(500).send({ error: 'Internal server error' });
      }
    }
  );
}
