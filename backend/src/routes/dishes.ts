import { FastifyInstance } from 'fastify';
import { DishService } from '../services/DishService.js';
import { validateSchema } from '../utils/validation.js';
import { DishCreateSchema, DishUpdateSchema, CategoryCreateSchema } from '@menumaker/shared';
import { authenticate } from '../middleware/auth.js';

export async function dishRoutes(fastify: FastifyInstance): Promise<void> {
  const dishService = new DishService();

  // POST /dishes - Create dish (authenticated)
  fastify.post('/', {
    preHandler: authenticate,
  }, async (request, reply) => {
    const data = validateSchema(DishCreateSchema, request.body);
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

    const dish = await dishService.createDish(businessId, request.user!.userId, data);

    reply.status(201).send({
      success: true,
      data: { dish },
    });
  });

  // GET /dishes/:id - Get dish by ID
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const dish = await dishService.getDishById(id);

    reply.send({
      success: true,
      data: { dish },
    });
  });

  // GET /dishes - Get all dishes for a business
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

    const dishes = await dishService.getBusinessDishes(businessId);

    reply.send({
      success: true,
      data: { dishes },
    });
  });

  // PUT /dishes/:id - Update dish (authenticated, owner only)
  fastify.put('/:id', {
    preHandler: authenticate,
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = validateSchema(DishUpdateSchema, request.body);

    const dish = await dishService.updateDish(id, request.user!.userId, data);

    reply.send({
      success: true,
      data: { dish },
    });
  });

  // DELETE /dishes/:id - Delete dish (authenticated, owner only)
  fastify.delete('/:id', {
    preHandler: authenticate,
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    await dishService.deleteDish(id, request.user!.userId);

    reply.status(204).send();
  });

  // POST /dishes/categories - Create category (authenticated)
  fastify.post('/categories', {
    preHandler: authenticate,
  }, async (request, reply) => {
    // Security: Validate input with Zod schema
    const data = validateSchema(CategoryCreateSchema, request.body);

    const category = await dishService.createCategory(
      data.businessId,
      request.user!.userId,
      data.name,
      data.description
    );

    reply.status(201).send({
      success: true,
      data: { category },
    });
  });

  // GET /dishes/categories - Get all categories for a business
  fastify.get('/categories', async (request, reply) => {
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

    const categories = await dishService.getBusinessCategories(businessId);

    reply.send({
      success: true,
      data: { categories },
    });
  });
}
