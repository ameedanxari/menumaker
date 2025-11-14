import { Repository } from 'typeorm';
import { Menu } from '../models/Menu.js';
import { MenuItem } from '../models/MenuItem.js';
import { Business } from '../models/Business.js';
import { Dish } from '../models/Dish.js';
import { AppDataSource } from '../config/database.js';
import { MenuCreateInput, MenuUpdateInput, MenuPublishInput } from '@menumaker/shared';

export class MenuService {
  private menuRepository: Repository<Menu>;
  private menuItemRepository: Repository<MenuItem>;
  private businessRepository: Repository<Business>;
  private dishRepository: Repository<Dish>;

  constructor() {
    this.menuRepository = AppDataSource.getRepository(Menu);
    this.menuItemRepository = AppDataSource.getRepository(MenuItem);
    this.businessRepository = AppDataSource.getRepository(Business);
    this.dishRepository = AppDataSource.getRepository(Dish);
  }

  async createMenu(businessId: string, userId: string, data: MenuCreateInput): Promise<Menu> {
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
      const error = new Error('You do not have permission to create menus for this business') as Error & {
        statusCode: number;
        code: string;
      };
      error.statusCode = 403;
      error.code = 'FORBIDDEN';
      throw error;
    }

    // Create menu
    const menu = this.menuRepository.create({
      business_id: businessId,
      title: data.title,
      start_date: data.start_date,
      end_date: data.end_date,
      status: 'draft',
      version: 0,
    });

    await this.menuRepository.save(menu);

    return menu;
  }

  async getMenuById(menuId: string, includeItems = true): Promise<Menu> {
    const menu = await this.menuRepository.findOne({
      where: { id: menuId },
      relations: includeItems ? ['menu_items', 'menu_items.dish', 'menu_items.dish.category'] : [],
    });

    if (!menu) {
      const error = new Error('Menu not found') as Error & {
        statusCode: number;
        code: string;
      };
      error.statusCode = 404;
      error.code = 'MENU_NOT_FOUND';
      throw error;
    }

    return menu;
  }

  async getBusinessMenus(businessId: string): Promise<Menu[]> {
    const menus = await this.menuRepository.find({
      where: { business_id: businessId },
      order: {
        created_at: 'DESC',
      },
    });

    return menus;
  }

  async getCurrentMenu(businessId: string): Promise<Menu | null> {
    const menu = await this.menuRepository.findOne({
      where: { business_id: businessId, status: 'published' },
      relations: ['menu_items', 'menu_items.dish', 'menu_items.dish.category'],
      order: {
        created_at: 'DESC',
      },
    });

    return menu;
  }

  async updateMenu(menuId: string, userId: string, data: MenuUpdateInput): Promise<Menu> {
    const menu = await this.getMenuById(menuId, false);

    // Verify business ownership
    const business = await this.businessRepository.findOne({
      where: { id: menu.business_id },
    });

    if (!business || business.owner_id !== userId) {
      const error = new Error('You do not have permission to update this menu') as Error & {
        statusCode: number;
        code: string;
      };
      error.statusCode = 403;
      error.code = 'FORBIDDEN';
      throw error;
    }

    // Update menu
    Object.assign(menu, data);
    menu.version += 1;

    await this.menuRepository.save(menu);

    return menu;
  }

  async publishMenu(menuId: string, userId: string, data: MenuPublishInput): Promise<Menu> {
    const menu = await this.getMenuById(menuId, false);

    // Verify business ownership
    const business = await this.businessRepository.findOne({
      where: { id: menu.business_id },
    });

    if (!business || business.owner_id !== userId) {
      const error = new Error('You do not have permission to publish this menu') as Error & {
        statusCode: number;
        code: string;
      };
      error.statusCode = 403;
      error.code = 'FORBIDDEN';
      throw error;
    }

    // Verify all dishes exist and belong to this business
    const dishIds = data.items.map(item => item.dish_id);
    const dishes = await this.dishRepository.find({
      where: dishIds.map(id => ({ id, business_id: menu.business_id })),
    });

    if (dishes.length !== dishIds.length) {
      const error = new Error('One or more dishes not found or do not belong to this business') as Error & {
        statusCode: number;
        code: string;
      };
      error.statusCode = 404;
      error.code = 'DISH_NOT_FOUND';
      throw error;
    }

    // Archive any currently published menu (only one active menu allowed)
    await this.menuRepository.update(
      { business_id: menu.business_id, status: 'published' },
      { status: 'archived' }
    );

    // Delete existing menu items
    await this.menuItemRepository.delete({ menu_id: menuId });

    // Create new menu items
    const menuItems = data.items.map((item, index) =>
      this.menuItemRepository.create({
        menu_id: menuId,
        dish_id: item.dish_id,
        price_override_cents: item.price_override_cents,
        position: item.position ?? index,
        is_available: item.is_available ?? true,
      })
    );

    await this.menuItemRepository.save(menuItems);

    // Publish menu
    menu.status = 'published';
    menu.version += 1;

    await this.menuRepository.save(menu);

    // Return menu with items
    return this.getMenuById(menuId);
  }

  async archiveMenu(menuId: string, userId: string): Promise<Menu> {
    const menu = await this.getMenuById(menuId, false);

    // Verify business ownership
    const business = await this.businessRepository.findOne({
      where: { id: menu.business_id },
    });

    if (!business || business.owner_id !== userId) {
      const error = new Error('You do not have permission to archive this menu') as Error & {
        statusCode: number;
        code: string;
      };
      error.statusCode = 403;
      error.code = 'FORBIDDEN';
      throw error;
    }

    menu.status = 'archived';
    menu.version += 1;

    await this.menuRepository.save(menu);

    return menu;
  }

  async deleteMenu(menuId: string, userId: string): Promise<void> {
    const menu = await this.getMenuById(menuId, false);

    // Verify business ownership
    const business = await this.businessRepository.findOne({
      where: { id: menu.business_id },
    });

    if (!business || business.owner_id !== userId) {
      const error = new Error('You do not have permission to delete this menu') as Error & {
        statusCode: number;
        code: string;
      };
      error.statusCode = 403;
      error.code = 'FORBIDDEN';
      throw error;
    }

    // Can only delete draft menus
    if (menu.status !== 'draft') {
      const error = new Error('Only draft menus can be deleted. Archive published menus instead.') as Error & {
        statusCode: number;
        code: string;
      };
      error.statusCode = 400;
      error.code = 'INVALID_OPERATION';
      throw error;
    }

    await this.menuRepository.remove(menu);
  }
}
