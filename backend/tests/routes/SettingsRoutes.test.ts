import { jest, describe, beforeEach, it, expect, afterEach } from '@jest/globals';
import Fastify, { FastifyInstance } from 'fastify';
import { settingsRoutes } from '../../src/routes/settings.js';
import { AppDataSource } from '../../src/config/database.js';

// Mock dependencies
jest.mock('../../src/config/database.js');
jest.mock('../../src/middleware/auth.js', () => ({
  authenticate: jest.fn().mockImplementation(async (request: any, reply: any) => {
    request.user = { userId: 'test-user-id' };
  }),
}));

describe('Settings Routes', () => {
  let app: FastifyInstance;
  let mockSettingsRepo: any;

  beforeEach(async () => {
    app = Fastify();

    mockSettingsRepo = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    AppDataSource.getRepository = jest.fn().mockReturnValue(mockSettingsRepo) as any;

    await app.register(settingsRoutes, { prefix: '/api/v1/settings' });
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /settings', () => {
    it('should return user settings', async () => {
      const mockSettings = {
        id: 'settings-1',
        user_id: 'test-user-id',
        language: 'en',
        notifications_enabled: true,
        biometric_enabled: false,
        theme: 'system',
      };

      mockSettingsRepo.findOne.mockResolvedValue(mockSettings);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/settings',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.settings.language).toBe('en');
    });

    it('should create default settings if not exist', async () => {
      const defaultSettings = {
        id: 'settings-1',
        user_id: 'test-user-id',
        language: 'en',
        notifications_enabled: true,
      };

      mockSettingsRepo.findOne.mockResolvedValue(null);
      mockSettingsRepo.create.mockReturnValue(defaultSettings);
      mockSettingsRepo.save.mockResolvedValue(defaultSettings);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/settings',
      });

      expect(response.statusCode).toBe(200);
      expect(mockSettingsRepo.create).toHaveBeenCalled();
      expect(mockSettingsRepo.save).toHaveBeenCalled();
    });
  });

  describe('PATCH /settings', () => {
    it('should update language setting', async () => {
      const mockSettings = {
        id: 'settings-1',
        user_id: 'test-user-id',
        language: 'en',
      };

      mockSettingsRepo.findOne.mockResolvedValue(mockSettings);
      mockSettingsRepo.save.mockResolvedValue({ ...mockSettings, language: 'ar' });

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/v1/settings',
        payload: {
          language: 'ar',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(mockSettingsRepo.save).toHaveBeenCalled();
    });

    it('should update notification preferences', async () => {
      const mockSettings = {
        id: 'settings-1',
        user_id: 'test-user-id',
        notifications_enabled: true,
        order_notifications: true,
        promotion_notifications: true,
      };

      mockSettingsRepo.findOne.mockResolvedValue(mockSettings);
      mockSettingsRepo.save.mockResolvedValue({
        ...mockSettings,
        order_notifications: false,
      });

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/v1/settings',
        payload: {
          order_notifications: false,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });

    it('should update biometric setting', async () => {
      const mockSettings = {
        id: 'settings-1',
        user_id: 'test-user-id',
        biometric_enabled: false,
      };

      mockSettingsRepo.findOne.mockResolvedValue(mockSettings);
      mockSettingsRepo.save.mockResolvedValue({ ...mockSettings, biometric_enabled: true });

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/v1/settings',
        payload: {
          biometric_enabled: true,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });

    it('should create settings if not exist on update', async () => {
      const newSettings = {
        id: 'settings-1',
        user_id: 'test-user-id',
        language: 'hi',
      };

      mockSettingsRepo.findOne.mockResolvedValue(null);
      mockSettingsRepo.create.mockReturnValue(newSettings);
      mockSettingsRepo.save.mockResolvedValue(newSettings);

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/v1/settings',
        payload: {
          language: 'hi',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(mockSettingsRepo.create).toHaveBeenCalled();
    });

    it('should update multiple settings at once', async () => {
      const mockSettings = {
        id: 'settings-1',
        user_id: 'test-user-id',
        language: 'en',
        theme: 'system',
        notifications_enabled: true,
      };

      mockSettingsRepo.findOne.mockResolvedValue(mockSettings);
      mockSettingsRepo.save.mockResolvedValue({
        ...mockSettings,
        language: 'ta',
        theme: 'dark',
        notifications_enabled: false,
      });

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/v1/settings',
        payload: {
          language: 'ta',
          theme: 'dark',
          notifications_enabled: false,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });
  });
});
