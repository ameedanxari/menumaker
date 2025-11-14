import { FastifyInstance } from 'fastify';
import { BusinessService } from '../services/BusinessService.js';
import { validateSchema } from '../utils/validation.js';
import { BusinessCreateSchema, BusinessUpdateSchema, BusinessSettingsSchema } from '@menumaker/shared';
import { authenticate, optionalAuth } from '../middleware/auth.js';

export async function businessRoutes(fastify: FastifyInstance): Promise<void> {
  const businessService = new BusinessService();

  // POST /businesses - Create business (authenticated)
  fastify.post('/', {
    preHandler: authenticate,
  }, async (request, reply) => {
    const data = validateSchema(BusinessCreateSchema, request.body);

    const business = await businessService.createBusiness(request.user!.userId, data);

    reply.status(201).send({
      success: true,
      data: { business },
    });
  });

  // GET /businesses/:id - Get business by ID (public with optional auth)
  fastify.get('/:id', {
    preHandler: optionalAuth,
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const business = await businessService.getBusinessById(id);

    // Don't return owner details in public view
    const { owner, ...businessData } = business;

    reply.send({
      success: true,
      data: { business: businessData },
    });
  });

  // GET /businesses/slug/:slug - Get business by slug (public)
  fastify.get('/slug/:slug', async (request, reply) => {
    const { slug } = request.params as { slug: string };

    const business = await businessService.getBusinessBySlug(slug);

    // Don't return owner details in public view
    const { owner, ...businessData } = business;

    reply.send({
      success: true,
      data: { business: businessData },
    });
  });

  // GET /businesses/me - Get current user's business (authenticated)
  fastify.get('/me', {
    preHandler: authenticate,
  }, async (request, reply) => {
    const business = await businessService.getUserBusiness(request.user!.userId);

    if (!business) {
      reply.status(404).send({
        success: false,
        error: {
          code: 'BUSINESS_NOT_FOUND',
          message: 'You do not have a business profile yet',
        },
      });
      return;
    }

    reply.send({
      success: true,
      data: { business },
    });
  });

  // PUT /businesses/:id - Update business (authenticated, owner only)
  fastify.put('/:id', {
    preHandler: authenticate,
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = validateSchema(BusinessUpdateSchema, request.body);

    const business = await businessService.updateBusiness(id, request.user!.userId, data);

    reply.send({
      success: true,
      data: { business },
    });
  });

  // GET /businesses/:id/settings - Get business settings (authenticated, owner only)
  fastify.get('/:id/settings', {
    preHandler: authenticate,
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    // Verify ownership
    const business = await businessService.getBusinessById(id);
    if (business.owner_id !== request.user!.userId) {
      reply.status(403).send({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to view these settings',
        },
      });
      return;
    }

    const settings = await businessService.getBusinessSettings(id);

    reply.send({
      success: true,
      data: { settings },
    });
  });

  // PUT /businesses/:id/settings - Update business settings (authenticated, owner only)
  fastify.put('/:id/settings', {
    preHandler: authenticate,
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = validateSchema(BusinessSettingsSchema.partial(), request.body);

    const settings = await businessService.updateBusinessSettings(id, request.user!.userId, data);

    reply.send({
      success: true,
      data: { settings },
    });
  });
}
