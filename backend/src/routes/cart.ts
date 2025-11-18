import { FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/auth.js';
import { AppDataSource } from '../config/database.js';
import { SavedCart } from '../models/SavedCart.js';

/**
 * Cart Routes
 *
 * Endpoints for managing user shopping carts
 */
export async function cartRoutes(fastify: FastifyInstance): Promise<void> {
  const cartRepo = AppDataSource.getRepository(SavedCart);

  /**
   * GET /cart
   * Get user's saved carts
   */
  fastify.get('/', {
    preHandler: authenticate,
  }, async (request, reply) => {
    const user = request.user!;

    // For authenticated users, we can use user_id if we add it to SavedCart model
    // For now, we'll use phone if available
    const carts = await cartRepo.find({
      where: {
        customer_email: user.userId, // Using userId as identifier for now
      },
      order: {
        last_used_at: 'DESC',
        created_at: 'DESC',
      },
    });

    reply.send({
      success: true,
      data: { carts },
    });
  });

  /**
   * POST /cart
   * Create a new saved cart
   */
  fastify.post('/', {
    preHandler: authenticate,
  }, async (request, reply) => {
    const { cart_name, cart_items, total_cents, customer_phone, customer_name } = request.body as {
      cart_name: string;
      cart_items: any[];
      total_cents: number;
      customer_phone?: string;
      customer_name?: string;
    };

    if (!cart_name || !cart_items || total_cents === undefined) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'MISSING_PARAMETERS',
          message: 'Cart name, items, and total are required',
        },
      });
    }

    const cart = cartRepo.create({
      cart_name,
      cart_items: JSON.stringify(cart_items),
      total_cents,
      customer_email: request.user!.userId,
      customer_phone,
      customer_name,
    });

    await cartRepo.save(cart);

    reply.status(201).send({
      success: true,
      data: { cart },
      message: 'Cart saved successfully',
    });
  });

  /**
   * GET /cart/:id
   * Get saved cart by ID
   */
  fastify.get<{
    Params: { id: string };
  }>('/:id', {
    preHandler: authenticate,
  }, async (request, reply) => {
    const { id } = request.params;

    const cart = await cartRepo.findOne({
      where: {
        id,
        customer_email: request.user!.userId,
      },
    });

    if (!cart) {
      return reply.status(404).send({
        success: false,
        error: {
          code: 'CART_NOT_FOUND',
          message: 'Cart not found',
        },
      });
    }

    reply.send({
      success: true,
      data: { cart },
    });
  });

  /**
   * PUT /cart/:id
   * Update saved cart
   */
  fastify.put<{
    Params: { id: string };
  }>('/:id', {
    preHandler: authenticate,
  }, async (request, reply) => {
    const { id } = request.params;
    const { cart_name, cart_items, total_cents } = request.body as {
      cart_name?: string;
      cart_items?: any[];
      total_cents?: number;
    };

    const cart = await cartRepo.findOne({
      where: {
        id,
        customer_email: request.user!.userId,
      },
    });

    if (!cart) {
      return reply.status(404).send({
        success: false,
        error: {
          code: 'CART_NOT_FOUND',
          message: 'Cart not found',
        },
      });
    }

    if (cart_name !== undefined) cart.cart_name = cart_name;
    if (cart_items !== undefined) cart.cart_items = JSON.stringify(cart_items);
    if (total_cents !== undefined) cart.total_cents = total_cents;

    await cartRepo.save(cart);

    reply.send({
      success: true,
      data: { cart },
      message: 'Cart updated successfully',
    });
  });

  /**
   * DELETE /cart/:id
   * Delete saved cart
   */
  fastify.delete<{
    Params: { id: string };
  }>('/:id', {
    preHandler: authenticate,
  }, async (request, reply) => {
    const { id } = request.params;

    const cart = await cartRepo.findOne({
      where: {
        id,
        customer_email: request.user!.userId,
      },
    });

    if (!cart) {
      return reply.status(404).send({
        success: false,
        error: {
          code: 'CART_NOT_FOUND',
          message: 'Cart not found',
        },
      });
    }

    await cartRepo.remove(cart);

    reply.send({
      success: true,
      message: 'Cart deleted successfully',
    });
  });
}
