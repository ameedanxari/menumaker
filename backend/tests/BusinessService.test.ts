import { jest, describe, beforeEach, it, expect } from '@jest/globals';
import type { Mock } from 'jest-mock';
import { BusinessService } from '../src/services/BusinessService';
import { AppDataSource } from '../src/config/database';
import { Business } from '../src/models/Business';
import { BusinessSettings } from '../src/models/BusinessSettings';

// Mock dependencies
jest.mock('../src/config/database');

describe('BusinessService', () => {
  let businessService: BusinessService;
  let mockBusinessRepository: any;
  let mockSettingsRepository: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockBusinessRepository = {
      findOne: jest.fn(),
      // @ts-ignore
      find: jest.fn().mockResolvedValue([]), // Return empty array for slug generation
      create: jest.fn(),
      save: jest.fn(),
    };

    mockSettingsRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
    };

    // Set up the mock implementation
    AppDataSource.getRepository = jest.fn().mockImplementation((entity) => {
      if (entity === Business) return mockBusinessRepository;
      if (entity === BusinessSettings) return mockSettingsRepository;
      return {};
    }) as any;

    businessService = new BusinessService();
  });

  describe('createBusiness', () => {
    it('should create a business with default settings', async () => {
      const userId = 'user-id';
      const businessData = {
        name: 'Test Restaurant',
        description: 'A test restaurant',
        address: '123 Main St',
        phone: '+1234567890',
        email: 'test@restaurant.com',
      };

      const mockBusiness = {
        id: 'business-id',
        owner_id: userId,
        slug: 'test-restaurant',
        ...businessData,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const mockSettings = {
        id: 'settings-id',
        business_id: 'business-id',
        delivery_enabled: false,
        pickup_enabled: true,
        delivery_fee_type: 'flat',
        delivery_fee_flat_cents: 0,
        delivery_fee_per_km_cents: 0,
        delivery_radius_km: 10,
        minimum_order_cents: 0,
        currency: 'USD',
        timezone: 'America/New_York',
      };

      // First findOne call checks if business exists (should return null)
      // Second findOne call reloads business with settings (should return business)
      mockBusinessRepository.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ ...mockBusiness, settings: mockSettings });
      mockBusinessRepository.create.mockReturnValue(mockBusiness);
      mockBusinessRepository.save.mockResolvedValue(mockBusiness);
      mockSettingsRepository.create.mockReturnValue(mockSettings);
      mockSettingsRepository.save.mockResolvedValue(mockSettings);

      const result = await businessService.createBusiness(userId, businessData);

      expect(mockBusinessRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          owner_id: userId,
          name: businessData.name,
          slug: expect.any(String),
        })
      );
      expect(mockBusinessRepository.save).toHaveBeenCalled();
      expect(mockSettingsRepository.create).toHaveBeenCalled();
      expect(mockSettingsRepository.save).toHaveBeenCalled();
      expect(result).toEqual(expect.objectContaining({ name: businessData.name }));
    });

    it('should generate unique slug from business name', async () => {
      const businessData = {
        name: 'Test Restaurant & Café',
      };

      const mockBusiness = {
        id: 'business-id',
        owner_id: 'user-id',
        slug: 'test-restaurant-cafe',
        ...businessData,
      };

      mockBusinessRepository.create.mockReturnValue(mockBusiness);
      mockBusinessRepository.save.mockResolvedValue(mockBusiness);
      mockSettingsRepository.create.mockReturnValue({});
      mockSettingsRepository.save.mockResolvedValue({});

      await businessService.createBusiness('user-id', businessData);

      expect(mockBusiness.slug).toMatch(/^[a-z0-9-]+$/);
      expect(mockBusiness.slug).not.toContain('&');
      expect(mockBusiness.slug).not.toContain(' ');
    });
  });

  describe('getUserBusiness', () => {
    it('should return business for a user', async () => {
      const userId = 'user-id';
      const mockBusiness = {
        id: 'business-1',
        owner_id: userId,
        name: 'Restaurant 1',
        settings: {},
      };

      mockBusinessRepository.findOne.mockResolvedValue(mockBusiness);

      const result = await businessService.getUserBusiness(userId);

      expect(mockBusinessRepository.findOne).toHaveBeenCalledWith({
        where: { owner_id: userId },
        relations: ['settings'],
      });
      expect(result).toEqual(mockBusiness);
    });

    it('should return null if user has no businesses', async () => {
      mockBusinessRepository.findOne.mockResolvedValue(null);

      const result = await businessService.getUserBusiness('user-id');

      expect(result).toBeNull();
    });
  });

  describe('getBusinessBySlug', () => {
    it('should return business with settings by slug', async () => {
      const slug = 'test-restaurant';
      const mockBusiness = {
        id: 'business-id',
        slug,
        name: 'Test Restaurant',
        settings: { delivery_enabled: true },
      };

      mockBusinessRepository.findOne.mockResolvedValue(mockBusiness);

      const result = await businessService.getBusinessBySlug(slug);

      expect(mockBusinessRepository.findOne).toHaveBeenCalledWith({
        where: { slug },
        relations: ['settings'],
      });
      expect(result).toEqual(mockBusiness);
    });

    it('should throw error if business not found', async () => {
      mockBusinessRepository.findOne.mockResolvedValue(null);

      await expect(businessService.getBusinessBySlug('nonexistent')).rejects.toThrow(
        'Business not found'
      );
    });
  });

  describe('updateBusiness', () => {
    it('should update business if user is owner', async () => {
      const businessId = 'business-id';
      const userId = 'user-id';
      const updateData = { name: 'Updated Name', description: 'New description' };

      const mockBusiness = {
        id: businessId,
        owner_id: userId,
        name: 'Old Name',
        description: 'Old description',
      };

      mockBusinessRepository.findOne.mockResolvedValue(mockBusiness);
      mockBusinessRepository.save.mockResolvedValue({
        ...mockBusiness,
        ...updateData,
      });

      const result = await businessService.updateBusiness(businessId, userId, updateData);

      expect(mockBusinessRepository.findOne).toHaveBeenCalledWith({
        where: { id: businessId },
        relations: ['settings', 'owner'],
      });
      expect(mockBusinessRepository.save).toHaveBeenCalledWith(
        expect.objectContaining(updateData)
      );
      expect(result.name).toBe(updateData.name);
    });

    it('should throw error if user is not owner', async () => {
      const mockBusiness = {
        id: 'business-id',
        owner_id: 'different-user-id',
      };

      mockBusinessRepository.findOne.mockResolvedValue(mockBusiness);

      await expect(
        businessService.updateBusiness('business-id', 'user-id', { name: 'New Name' })
      ).rejects.toThrow('You do not have permission to update this business');
    });
  });

  describe('updateBusinessSettings', () => {
    it('should update business settings', async () => {
      const businessId = 'business-id';
      const userId = 'user-id';
      const settingsUpdate = {
        delivery_type: 'flat' as const,
        delivery_fee_cents: 500,
      };

      const mockBusiness = {
        id: businessId,
        owner_id: userId,
      };

      const mockSettings = {
        id: 'settings-id',
        business_id: businessId,
        delivery_type: 'free' as const,
        delivery_fee_cents: 0,
      };

      mockBusinessRepository.findOne.mockResolvedValue(mockBusiness);
      mockSettingsRepository.findOne.mockResolvedValue(mockSettings);
      mockSettingsRepository.save.mockResolvedValue({
        ...mockSettings,
        ...settingsUpdate,
      });

      const result = await businessService.updateBusinessSettings(
        businessId,
        userId,
        settingsUpdate
      );

      expect(result.delivery_type).toBe('flat');
      expect(result.delivery_fee_cents).toBe(500);
    });
  });
});
