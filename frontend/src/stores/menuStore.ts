import { create } from 'zustand';
import { api } from '../services/api';

interface DishCategory {
  id: string;
  business_id: string;
  name: string;
  display_order: number;
  created_at: string;
  updated_at: string;
}

interface Dish {
  id: string;
  business_id: string;
  name: string;
  description?: string;
  price_cents: number;
  image_url?: string;
  category_id?: string;
  category?: DishCategory;
  is_available: boolean;
  created_at: string;
  updated_at: string;
}

interface MenuItem {
  dish_id: string;
  price_override_cents?: number;
  dish?: Dish;
}

interface Menu {
  id: string;
  business_id: string;
  name: string;
  description?: string;
  status: 'draft' | 'published' | 'archived';
  items?: MenuItem[];
  published_at?: string;
  created_at: string;
  updated_at: string;
}

interface MenuState {
  dishes: Dish[];
  categories: DishCategory[];
  menus: Menu[];
  currentMenu: Menu | null;
  activeMenu: Menu | null;
  isLoading: boolean;
  error: string | null;

  // Dish actions
  fetchDishes: (businessId: string) => Promise<void>;
  createDish: (
    businessId: string,
    data: {
      name: string;
      description?: string;
      price_cents: number;
      image_url?: string;
      category_id?: string;
      is_available?: boolean;
    }
  ) => Promise<void>;
  updateDish: (
    id: string,
    data: Partial<{
      name: string;
      description: string;
      price_cents: number;
      image_url: string;
      category_id: string;
      is_available: boolean;
    }>
  ) => Promise<void>;
  deleteDish: (id: string) => Promise<void>;

  // Category actions
  fetchCategories: (businessId: string) => Promise<void>;
  createCategory: (businessId: string, name: string) => Promise<void>;

  // Menu actions
  fetchMenus: (businessId: string) => Promise<void>;
  fetchActiveMenu: (businessId: string) => Promise<void>;
  createMenu: (businessId: string, name: string, description?: string) => Promise<void>;
  addDishToMenu: (menuId: string, dishId: string, priceOverride?: number) => Promise<void>;
  removeDishFromMenu: (menuId: string, dishId: string) => Promise<void>;
  publishMenu: (menuId: string) => Promise<void>;
  archiveMenu: (menuId: string) => Promise<void>;
  setCurrentMenu: (menu: Menu | null) => void;

  reset: () => void;
}

export const useMenuStore = create<MenuState>((set, _get) => ({
  dishes: [],
  categories: [],
  menus: [],
  currentMenu: null,
  activeMenu: null,
  isLoading: false,
  error: null,

  fetchDishes: async (businessId: string) => {
    try {
      set({ isLoading: true, error: null });
      const response = await api.getDishes(businessId);

      if (response.success) {
        set({
          dishes: response.data.dishes,
          isLoading: false,
        });
      }
    } catch (error: any) {
      set({
        isLoading: false,
        error: error.response?.data?.error?.message || 'Failed to fetch dishes',
      });
    }
  },

  createDish: async (businessId: string, data) => {
    try {
      set({ isLoading: true, error: null });
      const response = await api.createDish(businessId, data);

      if (response.success) {
        set((state) => ({
          dishes: [...state.dishes, response.data.dish],
          isLoading: false,
        }));
      }
    } catch (error: any) {
      set({
        isLoading: false,
        error: error.response?.data?.error?.message || 'Failed to create dish',
      });
      throw error;
    }
  },

  updateDish: async (id: string, data) => {
    try {
      set({ isLoading: true, error: null });
      const response = await api.updateDish(id, data);

      if (response.success) {
        set((state) => ({
          dishes: state.dishes.map((d) =>
            d.id === id ? response.data.dish : d
          ),
          isLoading: false,
        }));
      }
    } catch (error: any) {
      set({
        isLoading: false,
        error: error.response?.data?.error?.message || 'Failed to update dish',
      });
      throw error;
    }
  },

  deleteDish: async (id: string) => {
    try {
      set({ isLoading: true, error: null });
      await api.deleteDish(id);
      set((state) => ({
        dishes: state.dishes.filter((d) => d.id !== id),
        isLoading: false,
      }));
    } catch (error: any) {
      set({
        isLoading: false,
        error: error.response?.data?.error?.message || 'Failed to delete dish',
      });
      throw error;
    }
  },

  fetchCategories: async (businessId: string) => {
    try {
      const response = await api.getDishCategories(businessId);

      if (response.success) {
        set({ categories: response.data.categories });
      }
    } catch (_error: any) {
      console.error('Failed to fetch categories:', _error);
    }
  },

  createCategory: async (businessId: string, name: string) => {
    const response = await api.createDishCategory(businessId, name);

    if (response.success) {
      set((state) => ({
        categories: [...state.categories, response.data.category],
      }));
    }
  },

  fetchMenus: async (businessId: string) => {
    try {
      set({ isLoading: true, error: null });
      const response = await api.getMenus(businessId);

      if (response.success) {
        set({
          menus: response.data.menus,
          isLoading: false,
        });
      }
    } catch (error: any) {
      set({
        isLoading: false,
        error: error.response?.data?.error?.message || 'Failed to fetch menus',
      });
    }
  },

  fetchActiveMenu: async (businessId: string) => {
    try {
      const response = await api.getActiveMenu(businessId);

      if (response.success) {
        set({ activeMenu: response.data.menu });
      }
    } catch (_error: any) {
      // No active menu is not an error
      set({ activeMenu: null });
    }
  },

  createMenu: async (businessId: string, name: string, description?: string) => {
    try {
      set({ isLoading: true, error: null });
      const response = await api.createMenu(businessId, name, description);

      if (response.success) {
        set((state) => ({
          menus: [...state.menus, response.data.menu],
          currentMenu: response.data.menu,
          isLoading: false,
        }));
      }
    } catch (error: any) {
      set({
        isLoading: false,
        error: error.response?.data?.error?.message || 'Failed to create menu',
      });
      throw error;
    }
  },

  addDishToMenu: async (menuId: string, dishId: string, priceOverride?: number) => {
    const response = await api.addDishToMenu(
      menuId,
      dishId,
      priceOverride ? Math.round(priceOverride * 100) : undefined
    );

    if (response.success) {
      // Refresh current menu
      const menuResponse = await api.getMenuById(menuId);
      if (menuResponse.success) {
        set((state) => ({
          currentMenu: menuResponse.data.menu,
          menus: state.menus.map((m) =>
            m.id === menuId ? menuResponse.data.menu : m
          ),
        }));
      }
    }
  },

  removeDishFromMenu: async (menuId: string, dishId: string) => {
    await api.removeDishFromMenu(menuId, dishId);

    // Refresh current menu
    const menuResponse = await api.getMenuById(menuId);
    if (menuResponse.success) {
      set((state) => ({
        currentMenu: menuResponse.data.menu,
        menus: state.menus.map((m) =>
          m.id === menuId ? menuResponse.data.menu : m
        ),
      }));
    }
  },

  publishMenu: async (menuId: string) => {
    try {
      set({ isLoading: true, error: null });
      const response = await api.publishMenu(menuId);

      if (response.success) {
        set((state) => ({
          menus: state.menus.map((m) =>
            m.id === menuId ? response.data.menu : m
          ),
          currentMenu:
            state.currentMenu?.id === menuId
              ? response.data.menu
              : state.currentMenu,
          activeMenu: response.data.menu,
          isLoading: false,
        }));
      }
    } catch (error: any) {
      set({
        isLoading: false,
        error: error.response?.data?.error?.message || 'Failed to publish menu',
      });
      throw error;
    }
  },

  archiveMenu: async (menuId: string) => {
    try {
      set({ isLoading: true, error: null });
      const response = await api.archiveMenu(menuId);

      if (response.success) {
        set((state) => ({
          menus: state.menus.map((m) =>
            m.id === menuId ? response.data.menu : m
          ),
          currentMenu:
            state.currentMenu?.id === menuId
              ? response.data.menu
              : state.currentMenu,
          activeMenu: null,
          isLoading: false,
        }));
      }
    } catch (error: any) {
      set({
        isLoading: false,
        error: error.response?.data?.error?.message || 'Failed to archive menu',
      });
      throw error;
    }
  },

  setCurrentMenu: (menu: Menu | null) => {
    set({ currentMenu: menu });
  },

  reset: () => {
    set({
      dishes: [],
      categories: [],
      menus: [],
      currentMenu: null,
      activeMenu: null,
      isLoading: false,
      error: null,
    });
  },
}));
