import { jest, describe, beforeEach, it, expect } from '@jest/globals';
import type { Mock } from 'jest-mock';
import { DishService } from '../src/services/DishService';
import { AppDataSource } from '../src/config/database';
import { Dish } from '../src/models/Dish';
import { DishCategory } from '../src/models/DishCategory';
import { Business } from '../src/models/Business';

jest.mock('../src/config/database');

describe('DishService', () => {
  let dishService: DishService;
  let mockDishRepository: any;
  let mockCategoryRepository: any;
  let mockBusinessRepository: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockDishRepository = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      delete: jest.fn(),
    };

    mockCategoryRepository = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
    };

    mockBusinessRepository = {
      findOne: jest.fn(),
    };

    // Set up the mock implementation
    AppDataSource.getRepository = jest.fn().mockImplementation((entity) => {
      if (entity === Dish) return mockDishRepository;
      if (entity === DishCategory) return mockCategoryRepository;
      if (entity === Business) return mockBusinessRepository;
      return {};
    }) as any;

    dishService = new DishService();
  });

  describe('createDish', () => {
    it('should create a new dish', async () => {
      const businessId = 'business-id';
      const userId = 'user-id';
      const dishData = {
        name: 'Margherita Pizza',
        description: 'Classic tomato and mozzarella',
        price_cents: 1299,
        is_available: true,
      };

      const mockBusiness = {
        id: businessId,
        owner_id: userId,
      };

      const mockDish = {
        id: 'dish-id',
        business_id: businessId,
        ...dishData,
      };

      mockBusinessRepository.findOne.mockResolvedValue(mockBusiness);
      mockDishRepository.create.mockReturnValue(mockDish);
      mockDishRepository.save.mockResolvedValue(mockDish);

      const result = await dishService.createDish(businessId, userId, dishData);

      expect(mockBusinessRepository.findOne).toHaveBeenCalledWith({
        where: { id: businessId, owner_id: userId },
      });
      expect(mockDishRepository.create).toHaveBeenCalledWith({
        business_id: businessId,
        ...dishData,
      });
      expect(result).toEqual(mockDish);
    });

    it('should throw error if user does not own business', async () => {
      mockBusinessRepository.findOne.mockResolvedValue(null);

      await expect(
        dishService.createDish('business-id', 'user-id', { name: 'Pizza', description: 'Delicious pizza', price_cents: 1000 })
      ).rejects.toThrow('Unauthorized');
    });

    it('should create dish with category', async () => {
      const dishData = {
        name: 'Caesar Salad',
        description: 'Fresh Caesar salad',
        price_cents: 899,
        category_id: 'category-id',
      };

      mockBusinessRepository.findOne.mockResolvedValue({ id: 'business-id', owner_id: 'user-id' });
      mockDishRepository.create.mockReturnValue({ id: 'dish-id', ...dishData });
      mockDishRepository.save.mockResolvedValue({ id: 'dish-id', ...dishData });

      const result = await dishService.createDish('business-id', 'user-id', dishData);

      expect(result.category_id).toBe('category-id');
    });
  });

  describe('getDishByBusiness', () => {
    it('should return all dishes for a business', async () => {
      const businessId = 'business-id';
      const userId = 'user-id';

      const mockDishes = [
        { id: 'dish-1', name: 'Pizza', business_id: businessId },
        { id: 'dish-2', name: 'Pasta', business_id: businessId },
      ];

      mockBusinessRepository.findOne.mockResolvedValue({ id: businessId, owner_id: userId });
      mockDishRepository.find.mockResolvedValue(mockDishes);

      const result = await dishService.getBusinessDishes(businessId);

      expect(mockDishRepository.find).toHaveBeenCalledWith({
        where: { business_id: businessId },
        relations: ['category'],
        order: { created_at: 'DESC' },
      });
      expect(result).toHaveLength(2);
    });
  });

  describe('updateDish', () => {
    it('should update dish details', async () => {
      const dishId = 'dish-id';
      const userId = 'user-id';
      const updateData = {
        name: 'Updated Pizza',
        price_cents: 1499,
      };

      const mockDish = {
        id: dishId,
        business_id: 'business-id',
        business: { owner_id: userId },
        name: 'Old Pizza',
        price_cents: 1299,
      };

      mockDishRepository.findOne.mockResolvedValue(mockDish);
      mockDishRepository.save.mockResolvedValue({
        ...mockDish,
        ...updateData,
      });

      const result = await dishService.updateDish(dishId, userId, updateData);

      expect(result.name).toBe('Updated Pizza');
      expect(result.price_cents).toBe(1499);
    });

    it('should throw error if user does not own dish', async () => {
      const mockDish = {
        id: 'dish-id',
        business: { owner_id: 'different-user-id' },
      };

      mockDishRepository.findOne.mockResolvedValue(mockDish);

      await expect(
        dishService.updateDish('dish-id', 'user-id', { name: 'New Name' })
      ).rejects.toThrow('Unauthorized');
    });
  });

  describe('deleteDish', () => {
    it('should delete a dish', async () => {
      const dishId = 'dish-id';
      const userId = 'user-id';

      const mockDish = {
        id: dishId,
        business: { owner_id: userId },
      };

      mockDishRepository.findOne.mockResolvedValue(mockDish);
      mockDishRepository.delete.mockResolvedValue({ affected: 1 });

      await dishService.deleteDish(dishId, userId);

      expect(mockDishRepository.delete).toHaveBeenCalledWith(dishId);
    });
  });

  describe('createDishCategory', () => {
    it('should create a new category', async () => {
      const businessId = 'business-id';
      const userId = 'user-id';
      const categoryName = 'Appetizers';

      const mockCategory = {
        id: 'category-id',
        business_id: businessId,
        name: categoryName,
        display_order: 0,
      };

      mockBusinessRepository.findOne.mockResolvedValue({ id: businessId, owner_id: userId });
      mockCategoryRepository.create.mockReturnValue(mockCategory);
      mockCategoryRepository.save.mockResolvedValue(mockCategory);

      const result = await dishService.createCategory(businessId, userId, categoryName);

      expect(result.name).toBe(categoryName);
    });
  });

  describe('getCategoriesByBusiness', () => {
    it('should return all categories ordered by display_order', async () => {
      const businessId = 'business-id';
      const userId = 'user-id';

      const mockCategories = [
        { id: 'cat-1', name: 'Starters', display_order: 0 },
        { id: 'cat-2', name: 'Mains', display_order: 1 },
        { id: 'cat-3', name: 'Desserts', display_order: 2 },
      ];

      mockBusinessRepository.findOne.mockResolvedValue({ id: businessId, owner_id: userId });
      mockCategoryRepository.find.mockResolvedValue(mockCategories);

      const result = await dishService.getBusinessCategories(businessId);

      expect(mockCategoryRepository.find).toHaveBeenCalledWith({
        where: { business_id: businessId },
        order: { sort_order: 'ASC' },
      });
      expect(result).toHaveLength(3);
    });
  });
});
