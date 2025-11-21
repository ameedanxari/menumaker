import { jest, describe, beforeEach, it, expect, afterEach } from '@jest/globals';
import Fastify, { FastifyInstance } from 'fastify';
import { notificationRoutes } from '../../src/routes/notifications.js';
import { AppDataSource } from '../../src/config/database.js';
import { generateAccessToken } from '../../src/utils/jwt.js';

// Mock dependencies
jest.mock('../../src/config/database.js');

describe('Notification Routes', () => {
  let app: FastifyInstance;
  let mockNotificationRepo: any;
  let authToken: string;

  beforeEach(async () => {
    // Create fresh Fastify instance
    app = Fastify();

    // Generate auth token for tests
    authToken = generateAccessToken({
      userId: 'test-user-id',
      email: 'test@example.com',
    });

    // Setup mock repository
    mockNotificationRepo = {
      findAndCount: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    };

    AppDataSource.getRepository = jest.fn().mockReturnValue(mockNotificationRepo) as any;

    // Register routes
    await app.register(notificationRoutes, { prefix: '/api/v1/notifications' });
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /notifications', () => {
    it('should return paginated notifications', async () => {
      const mockNotifications = [
        {
          id: 'notif-1',
          user_id: 'test-user-id',
          type: 'order_update',
          title: 'Order Confirmed',
          message: 'Your order has been confirmed',
          is_read: false,
          created_at: new Date(),
        },
        {
          id: 'notif-2',
          user_id: 'test-user-id',
          type: 'promotion',
          title: '20% Off',
          message: 'Get 20% off your next order',
          is_read: true,
          created_at: new Date(),
        },
      ];

      mockNotificationRepo.findAndCount.mockResolvedValue([mockNotifications, 2]);

      const response = await app.inject({
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        method: 'GET',
        url: '/api/v1/notifications',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.notifications).toHaveLength(2);
      expect(body.data.total).toBe(2);
    });

    it('should filter unread notifications', async () => {
      mockNotificationRepo.findAndCount.mockResolvedValue([[], 0]);

      const response = await app.inject({
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        method: 'GET',
        url: '/api/v1/notifications?unread_only=true',
      });

      expect(response.statusCode).toBe(200);
      expect(mockNotificationRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ is_read: false }),
        })
      );
    });
  });

  describe('GET /notifications/:id', () => {
    it('should return notification by ID', async () => {
      const mockNotification = {
        id: 'notif-1',
        user_id: 'test-user-id',
        type: 'order_update',
        title: 'Order Delivered',
        message: 'Your order has been delivered',
        is_read: false,
      };

      mockNotificationRepo.findOne.mockResolvedValue(mockNotification);

      const response = await app.inject({
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        method: 'GET',
        url: '/api/v1/notifications/notif-1',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.notification.id).toBe('notif-1');
    });

    it('should return 404 for non-existent notification', async () => {
      mockNotificationRepo.findOne.mockResolvedValue(null);

      const response = await app.inject({
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        method: 'GET',
        url: '/api/v1/notifications/nonexistent',
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('PATCH /notifications/:id', () => {
    it('should mark notification as read', async () => {
      const mockNotification = {
        id: 'notif-1',
        user_id: 'test-user-id',
        is_read: false,
      };

      mockNotificationRepo.findOne.mockResolvedValue(mockNotification);
      mockNotificationRepo.save.mockResolvedValue({ ...mockNotification, is_read: true });

      const response = await app.inject({
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        method: 'PATCH',
        url: '/api/v1/notifications/notif-1',
        payload: { is_read: true },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(mockNotificationRepo.save).toHaveBeenCalled();
    });
  });

  describe('POST /notifications/mark-all-read', () => {
    it('should mark all notifications as read', async () => {
      mockNotificationRepo.update.mockResolvedValue({ affected: 5 });

      const response = await app.inject({
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        method: 'POST',
        url: '/api/v1/notifications/mark-all-read',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(mockNotificationRepo.update).toHaveBeenCalled();
    });
  });

  describe('GET /notifications/unread-count', () => {
    it('should return count of unread notifications', async () => {
      mockNotificationRepo.count.mockResolvedValue(3);

      const response = await app.inject({
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        method: 'GET',
        url: '/api/v1/notifications/unread-count',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.count).toBe(3);
    });
  });
});
