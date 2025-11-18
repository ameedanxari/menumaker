import { jest, describe, beforeEach, it, expect, afterEach } from '@jest/globals';
import Fastify, { FastifyInstance } from 'fastify';
import { cartRoutes } from '../../src/routes/cart.js';
import { AppDataSource } from '../../src/config/database.js';

// Mock dependencies
jest.mock('../../src/config/database.js');
jest.mock('../../src/middleware/auth.js', () => ({
  authenticate: jest.fn().mockImplementation(async (request: any, reply: any) => {
    request.user = { userId: 'test-user-id' };
  }),
}));

describe('Cart Routes', () => {
  let app: FastifyInstance;
  let mockCartRepo: any;

  beforeEach(async () => {
    app = Fastify();

    mockCartRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
    };

    AppDataSource.getRepository = jest.fn().mockReturnValue(mockCartRepo) as any;

    await app.register(cartRoutes, { prefix: '/api/v1/cart' });
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /cart', () => {
    it('should return user saved carts', async () => {
      const mockCarts = [
        {
          id: 'cart-1',
          cart_name: 'My Weekly Order',
          customer_email: 'test-user-id',
          cart_items: JSON.stringify([{ dish_id: 'dish-1', quantity: 2 }]),
          total_cents: 2500,
        },
      ];

      mockCartRepo.find.mockResolvedValue(mockCarts);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/cart',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.carts).toHaveLength(1);
    });
  });

  describe('POST /cart', () => {
    it('should create new saved cart', async () => {
      const mockCart = {
        id: 'cart-1',
        cart_name: 'Weekly Favorites',
        cart_items: JSON.stringify([{ dish_id: 'dish-1', quantity: 3 }]),
        total_cents: 3000,
        customer_email: 'test-user-id',
      };

      mockCartRepo.create.mockReturnValue(mockCart);
      mockCartRepo.save.mockResolvedValue(mockCart);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/cart',
        payload: {
          cart_name: 'Weekly Favorites',
          cart_items: [{ dish_id: 'dish-1', quantity: 3 }],
          total_cents: 3000,
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.cart.cart_name).toBe('Weekly Favorites');
    });

    it('should return 400 for missing required fields', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/cart',
        payload: {
          cart_name: 'Test Cart',
          // Missing cart_items and total_cents
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('GET /cart/:id', () => {
    it('should return cart by ID', async () => {
      const mockCart = {
        id: 'cart-1',
        cart_name: 'My Cart',
        customer_email: 'test-user-id',
        total_cents: 2000,
      };

      mockCartRepo.findOne.mockResolvedValue(mockCart);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/cart/cart-1',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.cart.id).toBe('cart-1');
    });

    it('should return 404 for non-existent cart', async () => {
      mockCartRepo.findOne.mockResolvedValue(null);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/cart/nonexistent',
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('PUT /cart/:id', () => {
    it('should update cart', async () => {
      const mockCart = {
        id: 'cart-1',
        cart_name: 'Old Name',
        customer_email: 'test-user-id',
        cart_items: '[]',
        total_cents: 1000,
      };

      mockCartRepo.findOne.mockResolvedValue(mockCart);
      mockCartRepo.save.mockResolvedValue({ ...mockCart, cart_name: 'Updated Name' });

      const response = await app.inject({
        method: 'PUT',
        url: '/api/v1/cart/cart-1',
        payload: {
          cart_name: 'Updated Name',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });
  });

  describe('DELETE /cart/:id', () => {
    it('should delete cart', async () => {
      const mockCart = {
        id: 'cart-1',
        customer_email: 'test-user-id',
      };

      mockCartRepo.findOne.mockResolvedValue(mockCart);
      mockCartRepo.remove.mockResolvedValue(mockCart);

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/v1/cart/cart-1',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(mockCartRepo.remove).toHaveBeenCalled();
    });

    it('should return 404 for non-existent cart', async () => {
      mockCartRepo.findOne.mockResolvedValue(null);

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/v1/cart/nonexistent',
      });

      expect(response.statusCode).toBe(404);
    });
  });
});
