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
      remove: jest.fn(),
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

    AppDataSource.getRepository = jest.fn().mockImplementation((entity) => {
      if (entity === Dish) return mockDishRepository;
      if (entity === DishCategory) return mockCategoryRepository;
      if (entity === Business) return mockBusinessRepository;
      return {};
    }) as any;

    dishService = new DishService();
  });

  describe('createDish', () => {
    it('should create a new dish with all required fields', async () => {
      const businessId = 'business-id';
      const userId = 'user-id';
      const dishData = {
        name: 'Margherita Pizza',
        description: 'Classic tomato and mozzarella',
        price_cents: 1299,
      };

      const mockBusiness = { id: businessId, owner_id: userId };
      const mockDish = { id: 'dish-id', business_id: businessId, ...dishData };

      mockBusinessRepository.findOne.mockResolvedValue(mockBusiness);
      mockCategoryRepository.findOne.mockResolvedValue(null);
      mockDishRepository.create.mockReturnValue(mockDish);
      mockDishRepository.save.mockResolvedValue(mockDish);

      const result = await dishService.createDish(businessId, userId, dishData);

      expect(result).toEqual(mockDish);
      expect(mockDishRepository.create).toHaveBeenCalledWith({
        business_id: businessId,
        ...dishData,
      });
    });

    it('should throw error if business not found', async () => {
      mockBusinessRepository.findOne.mockResolvedValue(null);

      await expect(
        dishService.createDish('business-id', 'user-id', {
          name: 'Pizza',
          description: 'Delicious pizza',
          price_cents: 1000
        })
      ).rejects.toThrow('Business not found');
    });

    it('should throw error if user does not own business', async () => {
      mockBusinessRepository.findOne.mockResolvedValue({
        id: 'business-id',
        owner_id: 'different-user-id'
      });

      await expect(
        dishService.createDish('business-id', 'user-id', {
          name: 'Pizza',
          description: 'Delicious pizza',
          price_cents: 1000
        })
      ).rejects.toThrow('You do not have permission to add dishes to this business');
    });

    it('should create dish with category', async () => {
      const dishData = {
        name: 'Caesar Salad',
        description: 'Fresh Caesar salad',
        price_cents: 899,
        category_id: 'category-id',
      };

      const mockCategory = {
        id: 'category-id',
        business_id: 'business-id',
        name: 'Salads',
      };

      mockBusinessRepository.findOne.mockResolvedValue({ id: 'business-id', owner_id: 'user-id' });
      mockCategoryRepository.findOne.mockResolvedValue(mockCategory);
      mockDishRepository.create.mockReturnValue({ id: 'dish-id', ...dishData });
      mockDishRepository.save.mockResolvedValue({ id: 'dish-id', ...dishData });

      const result = await dishService.createDish('business-id', 'user-id', dishData);

      expect(result.category_id).toBe('category-id');
    });

    it('should throw error if category not found', async () => {
      const dishData = {
        name: 'Caesar Salad',
        description: 'Fresh Caesar salad',
        price_cents: 899,
        category_id: 'nonexistent-category',
      };

      mockBusinessRepository.findOne.mockResolvedValue({ id: 'business-id', owner_id: 'user-id' });
      mockCategoryRepository.findOne.mockResolvedValue(null);

      await expect(
        dishService.createDish('business-id', 'user-id', dishData)
      ).rejects.toThrow('Category not found or does not belong to this business');
    });
  });

  describe('getBusinessDishes', () => {
    it('should return all dishes for a business', async () => {
      const businessId = 'business-id';
      const mockDishes = [
        { id: 'dish-1', name: 'Pizza', business_id: businessId },
        { id: 'dish-2', name: 'Pasta', business_id: businessId },
      ];

      mockDishRepository.find.mockResolvedValue(mockDishes);

      const result = await dishService.getBusinessDishes(businessId);

      expect(mockDishRepository.find).toHaveBeenCalledWith({
        where: { business_id: businessId },
        relations: ['category'],
        order: { position: 'ASC', created_at: 'DESC' },
      });
      expect(result).toHaveLength(2);
    });

    it('should return empty array if no dishes found', async () => {
      mockDishRepository.find.mockResolvedValue([]);

      const result = await dishService.getBusinessDishes('business-id');

      expect(result).toHaveLength(0);
    });
  });

  describe('getDishById', () => {
    it('should return dish by id', async () => {
      const mockDish = {
        id: 'dish-id',
        name: 'Pizza',
        business_id: 'business-id',
      };

      mockDishRepository.findOne.mockResolvedValue(mockDish);

      const result = await dishService.getDishById('dish-id');

      expect(result).toEqual(mockDish);
      expect(mockDishRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'dish-id' },
        relations: ['category', 'common_dish'],
      });
    });

    it('should throw error if dish not found', async () => {
      mockDishRepository.findOne.mockResolvedValue(null);

      await expect(
        dishService.getDishById('nonexistent-id')
      ).rejects.toThrow('Dish not found');
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
        name: 'Old Pizza',
        price_cents: 1299,
      };

      const mockBusiness = { id: 'business-id', owner_id: userId };

      mockDishRepository.findOne.mockResolvedValue(mockDish);
      mockBusinessRepository.findOne.mockResolvedValue(mockBusiness);
      mockDishRepository.save.mockResolvedValue({ ...mockDish, ...updateData });

      const result = await dishService.updateDish(dishId, userId, updateData);

      expect(result.name).toBe('Updated Pizza');
      expect(result.price_cents).toBe(1499);
    });

    it('should throw error if user does not own dish', async () => {
      const mockDish = {
        id: 'dish-id',
        business_id: 'business-id',
      };

      mockDishRepository.findOne.mockResolvedValue(mockDish);
      mockBusinessRepository.findOne.mockResolvedValue({ id: 'business-id', owner_id: 'different-user-id' });

      await expect(
        dishService.updateDish('dish-id', 'user-id', { name: 'New Name' })
      ).rejects.toThrow('You do not have permission to update this dish');
    });

    it('should update category', async () => {
      const mockDish = {
        id: 'dish-id',
        business_id: 'business-id',
        category_id: 'old-category',
      };

      const mockCategory = {
        id: 'new-category',
        business_id: 'business-id',
      };

      mockDishRepository.findOne.mockResolvedValue(mockDish);
      mockBusinessRepository.findOne.mockResolvedValue({ id: 'business-id', owner_id: 'user-id' });
      mockCategoryRepository.findOne.mockResolvedValue(mockCategory);
      mockDishRepository.save.mockResolvedValue({ ...mockDish, category_id: 'new-category' });

      const result = await dishService.updateDish('dish-id', 'user-id', { category_id: 'new-category' });

      expect(result.category_id).toBe('new-category');
    });
  });

  describe('deleteDish', () => {
    it('should delete a dish', async () => {
      const dishId = 'dish-id';
      const userId = 'user-id';

      const mockDish = {
        id: dishId,
        business_id: 'business-id',
      };

      const mockBusiness = { id: 'business-id', owner_id: userId };

      mockDishRepository.findOne.mockResolvedValue(mockDish);
      mockBusinessRepository.findOne.mockResolvedValue(mockBusiness);
      mockDishRepository.remove.mockResolvedValue(mockDish);

      await dishService.deleteDish(dishId, userId);

      expect(mockDishRepository.remove).toHaveBeenCalledWith(mockDish);
    });

    it('should throw error if dish not found', async () => {
      mockDishRepository.findOne.mockResolvedValue(null);

      await expect(
        dishService.deleteDish('nonexistent-id', 'user-id')
      ).rejects.toThrow('Dish not found');
    });

    it('should throw error if user does not own dish', async () => {
      const mockDish = {
        id: 'dish-id',
        business_id: 'business-id',
      };

      mockDishRepository.findOne.mockResolvedValue(mockDish);
      mockBusinessRepository.findOne.mockResolvedValue({ id: 'business-id', owner_id: 'different-user-id' });

      await expect(
        dishService.deleteDish('dish-id', 'user-id')
      ).rejects.toThrow('You do not have permission to delete this dish');
    });
  });

  describe('createCategory', () => {
    it('should create a new category', async () => {
      const businessId = 'business-id';
      const userId = 'user-id';
      const categoryName = 'Appetizers';

      const mockCategory = {
        id: 'category-id',
        business_id: businessId,
        name: categoryName,
        sort_order: 0,
      };

      mockBusinessRepository.findOne.mockResolvedValue({ id: businessId, owner_id: userId });
      mockCategoryRepository.find.mockResolvedValue([]);
      mockCategoryRepository.create.mockReturnValue(mockCategory);
      mockCategoryRepository.save.mockResolvedValue(mockCategory);

      const result = await dishService.createCategory(businessId, userId, categoryName);

      expect(result.name).toBe(categoryName);
    });

    it('should throw error if user does not own business', async () => {
      mockBusinessRepository.findOne.mockResolvedValue({ id: 'business-id', owner_id: 'different-user-id' });

      await expect(
        dishService.createCategory('business-id', 'user-id', 'Appetizers')
      ).rejects.toThrow();
    });
  });

  describe('getBusinessCategories', () => {
    it('should return all categories ordered by sort_order', async () => {
      const businessId = 'business-id';
      const mockCategories = [
        { id: 'cat-1', name: 'Starters', sort_order: 0 },
        { id: 'cat-2', name: 'Mains', sort_order: 1 },
        { id: 'cat-3', name: 'Desserts', sort_order: 2 },
      ];

      mockCategoryRepository.find.mockResolvedValue(mockCategories);

      const result = await dishService.getBusinessCategories(businessId);

      expect(result).toHaveLength(3);
    });
  });
});
