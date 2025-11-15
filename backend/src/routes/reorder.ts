import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { ReorderService, SaveCartParams } from '../services/ReorderService.js';

/**
 * Re-order Routes (Phase 2.7)
 *
 * Endpoints for customer re-order flow:
 * - Previous orders lookup (by phone)
 * - Quick re-order
 * - Saved carts management
 * - Re-order analytics
 */

interface PreviousOrdersQuery {
  customer_phone: string;
  limit?: string;
}

interface QuickReorderParams {
  order_id: string;
}

interface SaveCartBody {
  customer_phone: string;
  customer_email?: string;
  customer_name?: string;
  cart_name: string;
  cart_items: Array<{
    dish_id: string;
    dish_name: string;
    quantity: number;
    price_cents: number;
  }>;
}

interface LoadCartParams {
  cart_id: string;
}

interface DeleteCartBody {
  customer_phone: string;
}

interface AnalyticsQuery {
  business_id: string;
  days?: string;
}

export default async function reorderRoutes(fastify: FastifyInstance) {
  /**
   * GET /previous-orders
   * Get previous orders for customer (by phone, last 90 days)
   * No auth required (phone-based lookup)
   */
  fastify.get<{ Querystring: PreviousOrdersQuery }>(
    '/previous-orders',
    async (request: FastifyRequest<{ Querystring: PreviousOrdersQuery }>, reply: FastifyReply) => {
      try {
        const { customer_phone, limit } = request.query;

        if (!customer_phone) {
          return reply.status(400).send({ error: 'customer_phone is required' });
        }

        const limitNum = limit ? parseInt(limit, 10) : 10;

        const orders = await ReorderService.getPreviousOrders(customer_phone, limitNum);

        return reply.send({
          success: true,
          data: {
            orders,
            count: orders.length,
          },
        });
      } catch (error: any) {
        console.error('Error fetching previous orders:', error);
        return reply.status(500).send({ error: 'Internal server error' });
      }
    }
  );

  /**
   * POST /quick-reorder/:order_id
   * Quick re-order: Returns cart items from previous order
   * No auth required
   */
  fastify.post<{ Params: QuickReorderParams }>(
    '/quick-reorder/:order_id',
    async (request: FastifyRequest<{ Params: QuickReorderParams }>, reply: FastifyReply) => {
      try {
        const { order_id } = request.params;

        const cartItems = await ReorderService.quickReorder(order_id);

        return reply.send({
          success: true,
          message: 'Order items loaded for re-order',
          data: {
            cart_items: cartItems,
            item_count: cartItems.length,
            total_cents: cartItems.reduce((sum, item) => sum + item.price_cents * item.quantity, 0),
          },
        });
      } catch (error: any) {
        console.error('Error quick re-ordering:', error);

        if (error.message === 'Order not found') {
          return reply.status(404).send({ error: error.message });
        }

        return reply.status(500).send({ error: 'Internal server error' });
      }
    }
  );

  /**
   * POST /saved-cart
   * Save cart preset for customer
   * No auth required (phone-based)
   */
  fastify.post<{ Body: SaveCartBody }>(
    '/saved-cart',
    async (request: FastifyRequest<{ Body: SaveCartBody }>, reply: FastifyReply) => {
      try {
        const { customer_phone, customer_email, customer_name, cart_name, cart_items } = request.body;

        if (!customer_phone || !cart_name || !cart_items || cart_items.length === 0) {
          return reply.status(400).send({
            error: 'customer_phone, cart_name, and cart_items are required',
          });
        }

        const savedCart = await ReorderService.saveCart({
          customer_phone,
          customer_email,
          customer_name,
          cart_name,
          cart_items,
        });

        return reply.send({
          success: true,
          message: 'Cart saved successfully',
          data: {
            id: savedCart.id,
            cart_name: savedCart.cart_name,
            total_cents: savedCart.total_cents,
            item_count: cart_items.length,
            created_at: savedCart.created_at,
          },
        });
      } catch (error: any) {
        console.error('Error saving cart:', error);
        return reply.status(500).send({ error: 'Internal server error' });
      }
    }
  );

  /**
   * GET /saved-carts
   * Get saved carts for customer
   * No auth required (phone-based)
   */
  fastify.get<{ Querystring: { customer_phone: string } }>(
    '/saved-carts',
    async (
      request: FastifyRequest<{ Querystring: { customer_phone: string } }>,
      reply: FastifyReply
    ) => {
      try {
        const { customer_phone } = request.query;

        if (!customer_phone) {
          return reply.status(400).send({ error: 'customer_phone is required' });
        }

        const carts = await ReorderService.getSavedCarts(customer_phone);

        return reply.send({
          success: true,
          data: {
            carts: carts.map((cart) => ({
              id: cart.id,
              cart_name: cart.cart_name,
              total_cents: cart.total_cents,
              times_used: cart.times_used,
              last_used_at: cart.last_used_at,
              created_at: cart.created_at,
            })),
            count: carts.length,
          },
        });
      } catch (error: any) {
        console.error('Error fetching saved carts:', error);
        return reply.status(500).send({ error: 'Internal server error' });
      }
    }
  );

  /**
   * POST /saved-cart/:cart_id/load
   * Load saved cart and return items
   * No auth required
   */
  fastify.post<{ Params: LoadCartParams }>(
    '/saved-cart/:cart_id/load',
    async (request: FastifyRequest<{ Params: LoadCartParams }>, reply: FastifyReply) => {
      try {
        const { cart_id } = request.params;

        const cartItems = await ReorderService.loadSavedCart(cart_id);

        return reply.send({
          success: true,
          message: 'Saved cart loaded',
          data: {
            cart_items: cartItems,
            item_count: cartItems.length,
            total_cents: cartItems.reduce((sum, item) => sum + item.price_cents * item.quantity, 0),
          },
        });
      } catch (error: any) {
        console.error('Error loading saved cart:', error);

        if (error.message === 'Saved cart not found') {
          return reply.status(404).send({ error: error.message });
        }

        return reply.status(500).send({ error: 'Internal server error' });
      }
    }
  );

  /**
   * DELETE /saved-cart/:cart_id
   * Delete saved cart
   * No auth required (phone-based security)
   */
  fastify.delete<{ Params: LoadCartParams; Body: DeleteCartBody }>(
    '/saved-cart/:cart_id',
    async (
      request: FastifyRequest<{ Params: LoadCartParams; Body: DeleteCartBody }>,
      reply: FastifyReply
    ) => {
      try {
        const { cart_id } = request.params;
        const { customer_phone } = request.body;

        if (!customer_phone) {
          return reply.status(400).send({ error: 'customer_phone is required' });
        }

        await ReorderService.deleteSavedCart(cart_id, customer_phone);

        return reply.send({
          success: true,
          message: 'Saved cart deleted',
        });
      } catch (error: any) {
        console.error('Error deleting saved cart:', error);

        if (error.message === 'Saved cart not found or unauthorized') {
          return reply.status(404).send({ error: error.message });
        }

        return reply.status(500).send({ error: 'Internal server error' });
      }
    }
  );

  /**
   * GET /analytics/reorder-rate
   * Get re-order analytics for a business
   * Auth required (business owner or admin)
   */
  fastify.get<{ Querystring: AnalyticsQuery }>(
    '/analytics/reorder-rate',
    {
      preHandler: [fastify.authenticate],
    },
    async (request: FastifyRequest<{ Querystring: AnalyticsQuery }>, reply: FastifyReply) => {
      try {
        const { business_id, days } = request.query;

        if (!business_id) {
          return reply.status(400).send({ error: 'business_id is required' });
        }

        const daysNum = days ? parseInt(days, 10) : 30;

        const analytics = await ReorderService.getReorderAnalytics(business_id, daysNum);

        return reply.send({
          success: true,
          data: {
            period_days: daysNum,
            total_orders: analytics.total_orders,
            repeat_orders: analytics.repeat_orders,
            reorder_rate: Math.round(analytics.reorder_rate * 100), // Convert to percentage
            unique_customers: analytics.unique_customers,
            repeat_customers: analytics.repeat_customers,
            repeat_customer_rate: Math.round(
              (analytics.repeat_customers / analytics.unique_customers) * 100
            ),
          },
        });
      } catch (error: any) {
        console.error('Error fetching re-order analytics:', error);
        return reply.status(500).send({ error: 'Internal server error' });
      }
    }
  );

  /**
   * GET /check-returning-customer
   * Check if customer is returning (has previous orders)
   * No auth required
   */
  fastify.get<{ Querystring: { customer_phone: string; business_id: string } }>(
    '/check-returning-customer',
    async (
      request: FastifyRequest<{ Querystring: { customer_phone: string; business_id: string } }>,
      reply: FastifyReply
    ) => {
      try {
        const { customer_phone, business_id } = request.query;

        if (!customer_phone || !business_id) {
          return reply.status(400).send({ error: 'customer_phone and business_id are required' });
        }

        const isReturning = await ReorderService.isReturningCustomer(customer_phone, business_id);

        return reply.send({
          success: true,
          data: {
            is_returning_customer: isReturning,
          },
        });
      } catch (error: any) {
        console.error('Error checking returning customer:', error);
        return reply.status(500).send({ error: 'Internal server error' });
      }
    }
  );
}
