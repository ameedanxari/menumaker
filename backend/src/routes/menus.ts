import { FastifyInstance } from 'fastify';
import { MenuService } from '../services/MenuService.js';
import { ReferralService } from '../services/ReferralService.js';
import { validateSchema } from '../utils/validation.js';
import { MenuCreateSchema, MenuUpdateSchema, MenuPublishSchema } from '@menumaker/shared';
import { authenticate, optionalAuth } from '../middleware/auth.js';

export async function menuRoutes(fastify: FastifyInstance): Promise<void> {
  const menuService = new MenuService();

  // POST /menus - Create menu (authenticated)
  fastify.post('/', {
    preHandler: authenticate,
  }, async (request, reply) => {
    const data = validateSchema(MenuCreateSchema, request.body);
    const { businessId } = request.query as { businessId: string };

    if (!businessId) {
      reply.status(400).send({
        success: false,
        error: {
          code: 'MISSING_BUSINESS_ID',
          message: 'businessId query parameter is required',
        },
      });
      return;
    }

    const menu = await menuService.createMenu(businessId, request.user!.userId, {
      ...data,
      start_date: typeof data.start_date === 'string' ? new Date(data.start_date) : data.start_date,
      end_date: typeof data.end_date === 'string' ? new Date(data.end_date) : data.end_date,
    });

    reply.status(201).send({
      success: true,
      data: { menu },
    });
  });

  // GET /menus/:id - Get menu by ID (public)
  fastify.get('/:id', {
    preHandler: optionalAuth,
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const menu = await menuService.getMenuById(id);

    reply.send({
      success: true,
      data: { menu },
    });
  });

  // GET /menus - Get all menus for a business (public)
  fastify.get('/', async (request, reply) => {
    const { businessId } = request.query as { businessId: string };

    if (!businessId) {
      reply.status(400).send({
        success: false,
        error: {
          code: 'MISSING_BUSINESS_ID',
          message: 'businessId query parameter is required',
        },
      });
      return;
    }

    const menus = await menuService.getBusinessMenus(businessId);

    reply.send({
      success: true,
      data: { menus },
    });
  });

  // GET /menus/current - Get current published menu for a business (public)
  fastify.get('/current', async (request, reply) => {
    const { businessId } = request.query as { businessId: string };

    if (!businessId) {
      reply.status(400).send({
        success: false,
        error: {
          code: 'MISSING_BUSINESS_ID',
          message: 'businessId query parameter is required',
        },
      });
      return;
    }

    const menu = await menuService.getCurrentMenu(businessId);

    if (!menu) {
      reply.status(404).send({
        success: false,
        error: {
          code: 'NO_ACTIVE_MENU',
          message: 'This business does not have an active menu',
        },
      });
      return;
    }

    reply.send({
      success: true,
      data: { menu },
    });
  });

  // PUT /menus/:id - Update menu (authenticated, owner only)
  fastify.put('/:id', {
    preHandler: authenticate,
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = validateSchema(MenuUpdateSchema, request.body);

    const menu = await menuService.updateMenu(id, request.user!.userId, {
      ...data,
      start_date: data.start_date ? (typeof data.start_date === 'string' ? new Date(data.start_date) : data.start_date) : undefined,
      end_date: data.end_date ? (typeof data.end_date === 'string' ? new Date(data.end_date) : data.end_date) : undefined,
    });

    reply.send({
      success: true,
      data: { menu },
    });
  });

  // POST /menus/:id/publish - Publish menu (authenticated, owner only)
  fastify.post('/:id/publish', {
    preHandler: authenticate,
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = validateSchema(MenuPublishSchema, request.body);

    const menu = await menuService.publishMenu(id, request.user!.userId, data);

    // Trigger referral reward on first menu published (Phase 2.5)
    ReferralService.triggerRewardOnFirstMenu(request.user!.userId).catch((error) => {
      // Log but don't fail menu publish if reward fails
      console.error('Failed to trigger referral reward:', error);
    });

    reply.send({
      success: true,
      data: { menu },
    });
  });

  // POST /menus/:id/archive - Archive menu (authenticated, owner only)
  fastify.post('/:id/archive', {
    preHandler: authenticate,
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const menu = await menuService.archiveMenu(id, request.user!.userId);

    reply.send({
      success: true,
      data: { menu },
    });
  });

  // DELETE /menus/:id - Delete menu (authenticated, owner only, draft only)
  fastify.delete('/:id', {
    preHandler: authenticate,
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    await menuService.deleteMenu(id, request.user!.userId);

    reply.status(204).send();
  });
}
