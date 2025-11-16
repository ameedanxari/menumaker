import { Repository } from 'typeorm';
import { Dish } from '../models/Dish.js';
import { Business } from '../models/Business.js';
import { DishCategory } from '../models/DishCategory.js';
import { AppDataSource } from '../config/database.js';
import { DishCreateInput, DishUpdateInput } from '@menumaker/shared';

export class DishService {
  private dishRepository: Repository<Dish>;
  private businessRepository: Repository<Business>;
  private categoryRepository: Repository<DishCategory>;

  constructor() {
    this.dishRepository = AppDataSource.getRepository(Dish);
    this.businessRepository = AppDataSource.getRepository(Business);
    this.categoryRepository = AppDataSource.getRepository(DishCategory);
  }

  async createDish(businessId: string, userId: string, data: Omit<DishCreateInput, 'currency' | 'allergen_tags' | 'image_urls' | 'is_available' | 'position'> & { currency?: string; allergen_tags?: string[]; image_urls?: string[]; is_available?: boolean; position?: number }): Promise<Dish> {
    // Verify business ownership
    const business = await this.businessRepository.findOne({
      where: { id: businessId },
    });

    if (!business) {
      const error = new Error('Business not found') as Error & {
        statusCode: number;
        code: string;
      };
      error.statusCode = 404;
      error.code = 'BUSINESS_NOT_FOUND';
      throw error;
    }

    if (business.owner_id !== userId) {
      const error = new Error('You do not have permission to add dishes to this business') as Error & {
        statusCode: number;
        code: string;
      };
      error.statusCode = 403;
      error.code = 'FORBIDDEN';
      throw error;
    }

    // Verify category if provided
    if (data.category_id) {
      const category = await this.categoryRepository.findOne({
        where: { id: data.category_id, business_id: businessId },
      });

      if (!category) {
        const error = new Error('Category not found or does not belong to this business') as Error & {
          statusCode: number;
          code: string;
        };
        error.statusCode = 404;
        error.code = 'CATEGORY_NOT_FOUND';
        throw error;
      }
    }

    // Create dish
    const dish = this.dishRepository.create({
      business_id: businessId,
      ...data,
    });

    await this.dishRepository.save(dish);

    return dish;
  }

  async getDishById(dishId: string): Promise<Dish> {
    const dish = await this.dishRepository.findOne({
      where: { id: dishId },
      relations: ['category', 'common_dish'],
    });

    if (!dish) {
      const error = new Error('Dish not found') as Error & {
        statusCode: number;
        code: string;
      };
      error.statusCode = 404;
      error.code = 'DISH_NOT_FOUND';
      throw error;
    }

    return dish;
  }

  async getBusinessDishes(businessId: string): Promise<Dish[]> {
    const dishes = await this.dishRepository.find({
      where: { business_id: businessId },
      relations: ['category'],
      order: {
        position: 'ASC',
        created_at: 'DESC',
      },
    });

    return dishes;
  }

  async updateDish(dishId: string, userId: string, data: DishUpdateInput): Promise<Dish> {
    const dish = await this.getDishById(dishId);

    // Verify business ownership
    const business = await this.businessRepository.findOne({
      where: { id: dish.business_id },
    });

    if (!business || business.owner_id !== userId) {
      const error = new Error('You do not have permission to update this dish') as Error & {
        statusCode: number;
        code: string;
      };
      error.statusCode = 403;
      error.code = 'FORBIDDEN';
      throw error;
    }

    // Verify category if being updated
    if (data.category_id) {
      const category = await this.categoryRepository.findOne({
        where: { id: data.category_id, business_id: dish.business_id },
      });

      if (!category) {
        const error = new Error('Category not found or does not belong to this business') as Error & {
          statusCode: number;
          code: string;
        };
        error.statusCode = 404;
        error.code = 'CATEGORY_NOT_FOUND';
        throw error;
      }
    }

    // Update dish
    Object.assign(dish, data);

    await this.dishRepository.save(dish);

    return dish;
  }

  async deleteDish(dishId: string, userId: string): Promise<void> {
    const dish = await this.getDishById(dishId);

    // Verify business ownership
    const business = await this.businessRepository.findOne({
      where: { id: dish.business_id },
    });

    if (!business || business.owner_id !== userId) {
      const error = new Error('You do not have permission to delete this dish') as Error & {
        statusCode: number;
        code: string;
      };
      error.statusCode = 403;
      error.code = 'FORBIDDEN';
      throw error;
    }

    await this.dishRepository.remove(dish);
  }

  async createCategory(businessId: string, userId: string, name: string, description?: string): Promise<DishCategory> {
    // Verify business ownership
    const business = await this.businessRepository.findOne({
      where: { id: businessId },
    });

    if (!business || business.owner_id !== userId) {
      const error = new Error('You do not have permission to create categories for this business') as Error & {
        statusCode: number;
        code: string;
      };
      error.statusCode = 403;
      error.code = 'FORBIDDEN';
      throw error;
    }

    // Check for duplicate category name
    const existing = await this.categoryRepository.findOne({
      where: { business_id: businessId, name },
    });

    if (existing) {
      const error = new Error('A category with this name already exists') as Error & {
        statusCode: number;
        code: string;
      };
      error.statusCode = 409;
      error.code = 'CATEGORY_EXISTS';
      throw error;
    }

    // Get next sort order
    const categories = await this.categoryRepository.find({
      where: { business_id: businessId },
      order: { sort_order: 'DESC' },
      take: 1,
    });

    const nextSortOrder = categories.length > 0 ? categories[0].sort_order + 1 : 0;

    const category = this.categoryRepository.create({
      business_id: businessId,
      name,
      description,
      sort_order: nextSortOrder,
    });

    await this.categoryRepository.save(category);

    return category;
  }

  async getBusinessCategories(businessId: string): Promise<DishCategory[]> {
    const categories = await this.categoryRepository.find({
      where: { business_id: businessId },
      order: { sort_order: 'ASC' },
    });

    return categories;
  }
}
