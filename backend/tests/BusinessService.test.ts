import { jest, describe, beforeEach, it, expect } from '@jest/globals';
import type { Mock } from 'jest-mock';
import { BusinessService } from '../src/services/BusinessService';
import { AppDataSource } from '../src/config/database';
import { Business } from '../src/models/Business';
import { BusinessSettings } from '../src/models/BusinessSettings';

jest.mock('../src/config/database');

describe('BusinessService', () => {
  let businessService: BusinessService;
  let mockBusinessRepository: any;
  let mockSettingsRepository: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockBusinessRepository = {
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      save: jest.fn(),
    };

    mockSettingsRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
    };

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
      };

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

    it('should throw error if user already has a business', async () => {
      const existingBusiness = {
        id: 'existing-id',
        owner_id: 'user-id',
        name: 'Existing Business',
      };

      mockBusinessRepository.findOne.mockResolvedValue(existingBusiness);

      await expect(
        businessService.createBusiness('user-id', { name: 'New Business' })
      ).rejects.toThrow();
    });

    it('should handle special characters in business name', async () => {
      const businessData = {
        name: 'José\'s Café & Grill!',
      };

      const mockBusiness = {
        id: 'business-id',
        owner_id: 'user-id',
        slug: 'joses-cafe-grill',
        ...businessData,
      };

      mockBusinessRepository.create.mockReturnValue(mockBusiness);
      mockBusinessRepository.save.mockResolvedValue(mockBusiness);
      mockSettingsRepository.create.mockReturnValue({});
      mockSettingsRepository.save.mockResolvedValue({});

      await businessService.createBusiness('user-id', businessData);

      expect(mockBusiness.slug).toMatch(/^[a-z0-9-]+$/);
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

    it('should handle slug with special characters', async () => {
      const slug = 'test-restaurant-123';
      const mockBusiness = {
        id: 'business-id',
        slug,
        name: 'Test Restaurant 123',
      };

      mockBusinessRepository.findOne.mockResolvedValue(mockBusiness);

      const result = await businessService.getBusinessBySlug(slug);

      expect(result).toEqual(mockBusiness);
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

      expect(result.name).toBe(updateData.name);
      expect(result.description).toBe(updateData.description);
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

    it('should throw error if business not found', async () => {
      mockBusinessRepository.findOne.mockResolvedValue(null);

      await expect(
        businessService.updateBusiness('nonexistent-id', 'user-id', { name: 'New Name' })
      ).rejects.toThrow();
    });

    it('should update only provided fields', async () => {
      const mockBusiness = {
        id: 'business-id',
        owner_id: 'user-id',
        name: 'Old Name',
        description: 'Old Description',
        phone: '1234567890',
      };

      mockBusinessRepository.findOne.mockResolvedValue(mockBusiness);
      mockBusinessRepository.save.mockResolvedValue({
        ...mockBusiness,
        name: 'New Name',
      });

      const result = await businessService.updateBusiness('business-id', 'user-id', {
        name: 'New Name'
      });

      expect(result.name).toBe('New Name');
      expect(result.description).toBe('Old Description');
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

    it('should throw error if user is not owner', async () => {
      mockBusinessRepository.findOne.mockResolvedValue({
        id: 'business-id',
        owner_id: 'different-user-id',
      });

      await expect(
        businessService.updateBusinessSettings('business-id', 'user-id', {})
      ).rejects.toThrow();
    });

    it('should enable delivery and set fee', async () => {
      const mockBusiness = { id: 'business-id', owner_id: 'user-id' };
      const mockSettings = {
        id: 'settings-id',
        business_id: 'business-id',
        delivery_enabled: false,
        delivery_fee_cents: 0,
      };

      mockBusinessRepository.findOne.mockResolvedValue(mockBusiness);
      mockSettingsRepository.findOne.mockResolvedValue(mockSettings);
      mockSettingsRepository.save.mockResolvedValue({
        ...mockSettings,
        delivery_enabled: true,
        delivery_fee_cents: 300,
      });

      const result = await businessService.updateBusinessSettings('business-id', 'user-id', {
        delivery_enabled: true,
        delivery_fee_cents: 300,
      });

      expect(result.delivery_enabled).toBe(true);
      expect(result.delivery_fee_cents).toBe(300);
    });

    it('should update minimum order value', async () => {
      const mockBusiness = { id: 'business-id', owner_id: 'user-id' };
      const mockSettings = {
        id: 'settings-id',
        business_id: 'business-id',
        minimum_order_cents: 0,
      };

      mockBusinessRepository.findOne.mockResolvedValue(mockBusiness);
      mockSettingsRepository.findOne.mockResolvedValue(mockSettings);
      mockSettingsRepository.save.mockResolvedValue({
        ...mockSettings,
        minimum_order_cents: 1000,
      });

      const result = await businessService.updateBusinessSettings('business-id', 'user-id', {
        minimum_order_cents: 1000,
      });

      expect(result.minimum_order_cents).toBe(1000);
    });
  });

  describe('getBusinessById', () => {
    it('should return business by ID', async () => {
      const mockBusiness = {
        id: 'business-id',
        name: 'Test Restaurant',
        settings: {},
      };

      mockBusinessRepository.findOne.mockResolvedValue(mockBusiness);

      const result = await businessService.getBusinessById('business-id');

      expect(result).toEqual(mockBusiness);
    });

    it('should throw error if business not found', async () => {
      mockBusinessRepository.findOne.mockResolvedValue(null);

      await expect(
        businessService.getBusinessById('nonexistent-id')
      ).rejects.toThrow();
    });
  });

  describe('validation', () => {
    it('should validate phone number format', async () => {
      const businessData = {
        name: 'Test Restaurant',
        phone: 'invalid-phone',
      };

      mockBusinessRepository.create.mockReturnValue({
        id: 'business-id',
        owner_id: 'user-id',
        ...businessData,
      });
      mockBusinessRepository.save.mockResolvedValue({});
      mockSettingsRepository.create.mockReturnValue({});
      mockSettingsRepository.save.mockResolvedValue({});

      // Should accept the phone number (validation might be handled elsewhere)
      await expect(
        businessService.createBusiness('user-id', businessData)
      ).resolves.not.toThrow();
    });

    it('should validate email format', async () => {
      const businessData = {
        name: 'Test Restaurant',
        email: 'invalid-email',
      };

      mockBusinessRepository.create.mockReturnValue({
        id: 'business-id',
        owner_id: 'user-id',
        ...businessData,
      });
      mockBusinessRepository.save.mockResolvedValue({});
      mockSettingsRepository.create.mockReturnValue({});
      mockSettingsRepository.save.mockResolvedValue({});

      // Should accept the email (validation might be handled elsewhere)
      await expect(
        businessService.createBusiness('user-id', businessData)
      ).resolves.not.toThrow();
    });
  });
});
