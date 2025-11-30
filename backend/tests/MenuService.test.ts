import { jest, describe, beforeEach, it, expect } from '@jest/globals';
import { MenuService } from '../src/services/MenuService';
import { AppDataSource } from '../src/config/database';
import { Menu } from '../src/models/Menu';
import { MenuItem } from '../src/models/MenuItem';
import { Business } from '../src/models/Business';
import { Dish } from '../src/models/Dish';

jest.mock('../src/config/database');

describe('MenuService', () => {
    let menuService: MenuService;
    let mockMenuRepository: any;
    let mockMenuItemRepository: any;
    let mockBusinessRepository: any;
    let mockDishRepository: any;

    beforeEach(() => {
        jest.clearAllMocks();

        mockMenuRepository = {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn(),
            update: jest.fn(),
            remove: jest.fn(),
            delete: jest.fn(),
        };

        mockMenuItemRepository = {
            create: jest.fn(),
            save: jest.fn(),
            delete: jest.fn(),
        };

        mockBusinessRepository = {
            findOne: jest.fn(),
        };

        mockDishRepository = {
            find: jest.fn(),
        };

        AppDataSource.getRepository = jest.fn().mockImplementation((entity) => {
            if (entity === Menu) return mockMenuRepository;
            if (entity === MenuItem) return mockMenuItemRepository;
            if (entity === Business) return mockBusinessRepository;
            if (entity === Dish) return mockDishRepository;
            return {};
        }) as any;

        menuService = new MenuService();
    });

    describe('createMenu', () => {
        it('should create a menu successfully', async () => {
            const businessId = 'business-1';
            const userId = 'user-1';
            const menuData = {
                title: 'Summer Menu',
                start_date: new Date('2024-06-01'),
                end_date: new Date('2024-08-31'),
            };

            mockBusinessRepository.findOne.mockResolvedValue({ id: businessId, owner_id: userId });
            mockMenuRepository.create.mockReturnValue({ ...menuData, business_id: businessId, status: 'draft', version: 0 });
            mockMenuRepository.save.mockResolvedValue({ id: 'menu-1', ...menuData });

            const result = await menuService.createMenu(businessId, userId, menuData);

            expect(result.title).toBe(menuData.title);
            expect(mockMenuRepository.save).toHaveBeenCalled();
        });

        it('should throw error if business not found', async () => {
            mockBusinessRepository.findOne.mockResolvedValue(null);

            await expect(
                menuService.createMenu('business-1', 'user-1', { title: 'Menu' } as any)
            ).rejects.toThrow('Business not found');
        });

        it('should throw error if user is not owner', async () => {
            mockBusinessRepository.findOne.mockResolvedValue({ id: 'business-1', owner_id: 'other-user' });

            await expect(
                menuService.createMenu('business-1', 'user-1', { title: 'Menu' } as any)
            ).rejects.toThrow('You do not have permission');
        });
    });

    describe('getMenuById', () => {
        it('should return menu if found', async () => {
            const mockMenu = { id: 'menu-1', title: 'Menu' };
            mockMenuRepository.findOne.mockResolvedValue(mockMenu);

            const result = await menuService.getMenuById('menu-1');
            expect(result).toEqual(mockMenu);
        });

        it('should throw error if menu not found', async () => {
            mockMenuRepository.findOne.mockResolvedValue(null);
            await expect(menuService.getMenuById('menu-1')).rejects.toThrow('Menu not found');
        });
    });

    describe('getBusinessMenus', () => {
        it('should return menus for business', async () => {
            const mockMenus = [{ id: 'menu-1' }, { id: 'menu-2' }];
            mockMenuRepository.find.mockResolvedValue(mockMenus);

            const result = await menuService.getBusinessMenus('business-1');
            expect(result).toEqual(mockMenus);
        });
    });

    describe('getCurrentMenu', () => {
        it('should return published menu', async () => {
            const mockMenu = { id: 'menu-1', status: 'published' };
            mockMenuRepository.findOne.mockResolvedValue(mockMenu);

            const result = await menuService.getCurrentMenu('business-1');
            expect(result).toEqual(mockMenu);
        });

        it('should return null if no published menu', async () => {
            mockMenuRepository.findOne.mockResolvedValue(null);
            const result = await menuService.getCurrentMenu('business-1');
            expect(result).toBeNull();
        });
    });

    describe('updateMenu', () => {
        it('should update menu details', async () => {
            const mockMenu = { id: 'menu-1', business_id: 'business-1', version: 1 };
            mockMenuRepository.findOne.mockResolvedValue(mockMenu);
            mockBusinessRepository.findOne.mockResolvedValue({ id: 'business-1', owner_id: 'user-1' });
            mockMenuRepository.save.mockImplementation((m: any) => Promise.resolve(m));

            const result = await menuService.updateMenu('menu-1', 'user-1', { title: 'New Title' });

            expect(result.title).toBe('New Title');
            expect(result.version).toBe(2);
        });

        it('should throw error if forbidden', async () => {
            mockMenuRepository.findOne.mockResolvedValue({ id: 'menu-1', business_id: 'business-1' });
            mockBusinessRepository.findOne.mockResolvedValue({ id: 'business-1', owner_id: 'other-user' });

            await expect(
                menuService.updateMenu('menu-1', 'user-1', {})
            ).rejects.toThrow('You do not have permission');
        });
    });

    describe('publishMenu', () => {
        it('should publish menu and archive existing', async () => {
            const menuId = 'menu-1';
            const businessId = 'business-1';
            const userId = 'user-1';
            const publishData = {
                items: [{ dish_id: 'dish-1', price_override_cents: 1000 }]
            };

            const mockMenu = { id: menuId, business_id: businessId, version: 1 };

            mockMenuRepository.findOne.mockResolvedValue(mockMenu);
            mockBusinessRepository.findOne.mockResolvedValue({ id: businessId, owner_id: userId });
            mockDishRepository.find.mockResolvedValue([{ id: 'dish-1', business_id: businessId }]);
            mockMenuItemRepository.create.mockReturnValue({});
            mockMenuItemRepository.save.mockResolvedValue([]);
            mockMenuRepository.save.mockResolvedValue(mockMenu);

            await menuService.publishMenu(menuId, userId, publishData);

            expect(mockMenuRepository.update).toHaveBeenCalledWith(
                { business_id: businessId, status: 'published' },
                { status: 'archived' }
            );
            expect(mockMenuItemRepository.delete).toHaveBeenCalledWith({ menu_id: menuId });
            expect(mockMenuItemRepository.save).toHaveBeenCalled();
            expect(mockMenu.status).toBe('published');
        });

        it('should throw error if dish not found', async () => {
            const mockMenu = { id: 'menu-1', business_id: 'business-1' };
            mockMenuRepository.findOne.mockResolvedValue(mockMenu);
            mockBusinessRepository.findOne.mockResolvedValue({ id: 'business-1', owner_id: 'user-1' });
            mockDishRepository.find.mockResolvedValue([]); // No dishes found

            await expect(
                menuService.publishMenu('menu-1', 'user-1', { items: [{ dish_id: 'dish-1' }] })
            ).rejects.toThrow('One or more dishes not found');
        });
    });

    describe('archiveMenu', () => {
        it('should archive menu', async () => {
            const mockMenu = { id: 'menu-1', business_id: 'business-1', status: 'published' };
            mockMenuRepository.findOne.mockResolvedValue(mockMenu);
            mockBusinessRepository.findOne.mockResolvedValue({ id: 'business-1', owner_id: 'user-1' });
            mockMenuRepository.save.mockImplementation((m: any) => Promise.resolve(m));

            const result = await menuService.archiveMenu('menu-1', 'user-1');
            expect(result.status).toBe('archived');
        });
    });

    describe('deleteMenu', () => {
        it('should delete draft menu', async () => {
            const mockMenu = { id: 'menu-1', business_id: 'business-1', status: 'draft' };
            mockMenuRepository.findOne.mockResolvedValue(mockMenu);
            mockBusinessRepository.findOne.mockResolvedValue({ id: 'business-1', owner_id: 'user-1' });

            await menuService.deleteMenu('menu-1', 'user-1');
            expect(mockMenuRepository.remove).toHaveBeenCalledWith(mockMenu);
        });

        it('should throw error if deleting published menu', async () => {
            const mockMenu = { id: 'menu-1', business_id: 'business-1', status: 'published' };
            mockMenuRepository.findOne.mockResolvedValue(mockMenu);
            mockBusinessRepository.findOne.mockResolvedValue({ id: 'business-1', owner_id: 'user-1' });

            await expect(
                menuService.deleteMenu('menu-1', 'user-1')
            ).rejects.toThrow('Only draft menus can be deleted');
        });
    });
});
