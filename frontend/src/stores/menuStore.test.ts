import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useMenuStore } from './menuStore';
import { api } from '../services/api';

vi.mock('../services/api', () => ({
  api: {
    getDishes: vi.fn(),
    createMenu: vi.fn(),
    publishMenu: vi.fn(),
    getMenus: vi.fn(),
    createDish: vi.fn(),
    updateDish: vi.fn(),
    deleteDish: vi.fn(),
    getDishCategories: vi.fn(),
    createDishCategory: vi.fn(),
    getActiveMenu: vi.fn(),
    archiveMenu: vi.fn(),
    addDishToMenu: vi.fn(),
    removeDishFromMenu: vi.fn(),
    getMenuById: vi.fn(),
  },
}));

const mockedApi = api as unknown as {
  getDishes: ReturnType<typeof vi.fn>;
  createMenu: ReturnType<typeof vi.fn>;
  publishMenu: ReturnType<typeof vi.fn>;
  getMenus: ReturnType<typeof vi.fn>;
  createDish: ReturnType<typeof vi.fn>;
  updateDish: ReturnType<typeof vi.fn>;
  deleteDish: ReturnType<typeof vi.fn>;
  getDishCategories: ReturnType<typeof vi.fn>;
  createDishCategory: ReturnType<typeof vi.fn>;
  getActiveMenu: ReturnType<typeof vi.fn>;
  archiveMenu: ReturnType<typeof vi.fn>;
  addDishToMenu: ReturnType<typeof vi.fn>;
  removeDishFromMenu: ReturnType<typeof vi.fn>;
  getMenuById: ReturnType<typeof vi.fn>;
};

const resetStore = () => {
  useMenuStore.setState({
    dishes: [],
    categories: [],
    menus: [],
    currentMenu: null,
    activeMenu: null,
    isLoading: false,
    error: null,
  });
};

describe('menuStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
  });

  it('fetches dishes successfully', async () => {
    mockedApi.getDishes.mockResolvedValue({
      success: true,
      data: { dishes: [{ id: 'd1', name: 'Dish', business_id: 'b1', price_cents: 1000, is_available: true, created_at: '', updated_at: '' }] },
    });

    await useMenuStore.getState().fetchDishes('b1');

    expect(useMenuStore.getState().dishes).toHaveLength(1);
    expect(useMenuStore.getState().isLoading).toBe(false);
  });

  it('sets error when dish fetch fails', async () => {
    mockedApi.getDishes.mockRejectedValue({
      response: { data: { error: { message: 'boom' } } },
    });

    await useMenuStore.getState().fetchDishes('b1');

    expect(useMenuStore.getState().error).toBe('boom');
    expect(useMenuStore.getState().isLoading).toBe(false);
  });

  it('creates a menu and makes it current', async () => {
    mockedApi.createMenu.mockResolvedValue({
      success: true,
      data: { menu: { id: 'm1', business_id: 'b1', name: 'Lunch', status: 'draft', created_at: '', updated_at: '' } },
    });

    await useMenuStore.getState().createMenu('b1', 'Lunch');

    const state = useMenuStore.getState();
    expect(state.menus[0]?.id).toBe('m1');
    expect(state.currentMenu?.name).toBe('Lunch');
  });

  it('reports publish errors and stops loading', async () => {
    mockedApi.publishMenu.mockRejectedValue({
      response: { data: { error: { message: 'publish failed' } } },
    });

    await expect(useMenuStore.getState().publishMenu('m1')).rejects.toBeTruthy();
    expect(useMenuStore.getState().error).toBe('publish failed');
    expect(useMenuStore.getState().isLoading).toBe(false);
  });

  it('creates a dish and adds to store', async () => {
    mockedApi.createDish.mockResolvedValue({
      success: true,
      data: { dish: { id: 'd2', name: 'New Dish', business_id: 'b1', price_cents: 500, is_available: true, created_at: '', updated_at: '' } },
    });

    await useMenuStore.getState().createDish('b1', { name: 'New Dish', price_cents: 500 });

    expect(useMenuStore.getState().dishes).toHaveLength(1);
    expect(useMenuStore.getState().dishes[0]?.name).toBe('New Dish');
  });

  it('updates a dish in store', async () => {
    useMenuStore.setState({
      dishes: [{ id: 'd1', name: 'Old Name', business_id: 'b1', price_cents: 1000, is_available: true, created_at: '', updated_at: '' }],
      categories: [],
      menus: [],
      currentMenu: null,
      activeMenu: null,
      isLoading: false,
      error: null,
    });

    mockedApi.updateDish.mockResolvedValue({
      success: true,
      data: { dish: { id: 'd1', name: 'New Name', business_id: 'b1', price_cents: 1000, is_available: true, created_at: '', updated_at: '' } },
    });

    await useMenuStore.getState().updateDish('d1', { name: 'New Name' });

    expect(useMenuStore.getState().dishes[0]?.name).toBe('New Name');
  });

  it('deletes a dish from store', async () => {
    useMenuStore.setState({
      dishes: [{ id: 'd1', name: 'Dish', business_id: 'b1', price_cents: 1000, is_available: true, created_at: '', updated_at: '' }],
      categories: [],
      menus: [],
      currentMenu: null,
      activeMenu: null,
      isLoading: false,
      error: null,
    });

    mockedApi.deleteDish.mockResolvedValue({ success: true });

    await useMenuStore.getState().deleteDish('d1');

    expect(useMenuStore.getState().dishes).toHaveLength(0);
  });

  it('fetches categories', async () => {
    mockedApi.getDishCategories.mockResolvedValue({
      success: true,
      data: { categories: [{ id: 'c1', business_id: 'b1', name: 'Appetizers', display_order: 1, created_at: '', updated_at: '' }] },
    });

    await useMenuStore.getState().fetchCategories('b1');

    expect(useMenuStore.getState().categories).toHaveLength(1);
  });

  it('creates a category', async () => {
    mockedApi.createDishCategory.mockResolvedValue({
      success: true,
      data: { category: { id: 'c2', business_id: 'b1', name: 'Desserts', display_order: 2, created_at: '', updated_at: '' } },
    });

    await useMenuStore.getState().createCategory('b1', 'Desserts');

    expect(useMenuStore.getState().categories).toHaveLength(1);
    expect(useMenuStore.getState().categories[0]?.name).toBe('Desserts');
  });

  it('fetches menus', async () => {
    mockedApi.getMenus.mockResolvedValue({
      success: true,
      data: { menus: [{ id: 'm1', business_id: 'b1', name: 'Main Menu', status: 'published', created_at: '', updated_at: '' }] },
    });

    await useMenuStore.getState().fetchMenus('b1');

    expect(useMenuStore.getState().menus).toHaveLength(1);
  });

  it('fetches active menu', async () => {
    mockedApi.getActiveMenu.mockResolvedValue({
      success: true,
      data: { menu: { id: 'm1', business_id: 'b1', name: 'Active Menu', status: 'published', created_at: '', updated_at: '' } },
    });

    await useMenuStore.getState().fetchActiveMenu('b1');

    expect(useMenuStore.getState().activeMenu?.name).toBe('Active Menu');
  });

  it('archives a menu', async () => {
    useMenuStore.setState({
      dishes: [],
      categories: [],
      menus: [{ id: 'm1', business_id: 'b1', name: 'Menu', status: 'published', created_at: '', updated_at: '' }],
      currentMenu: { id: 'm1', business_id: 'b1', name: 'Menu', status: 'published', created_at: '', updated_at: '' },
      activeMenu: { id: 'm1', business_id: 'b1', name: 'Menu', status: 'published', created_at: '', updated_at: '' },
      isLoading: false,
      error: null,
    });

    mockedApi.archiveMenu.mockResolvedValue({
      success: true,
      data: { menu: { id: 'm1', business_id: 'b1', name: 'Menu', status: 'archived', created_at: '', updated_at: '' } },
    });

    await useMenuStore.getState().archiveMenu('m1');

    expect(useMenuStore.getState().menus[0]?.status).toBe('archived');
    expect(useMenuStore.getState().activeMenu).toBeNull();
  });

  it('publishes a menu and sets as active', async () => {
    useMenuStore.setState({
      dishes: [],
      categories: [],
      menus: [{ id: 'm1', business_id: 'b1', name: 'Menu', status: 'draft', created_at: '', updated_at: '' }],
      currentMenu: { id: 'm1', business_id: 'b1', name: 'Menu', status: 'draft', created_at: '', updated_at: '' },
      activeMenu: null,
      isLoading: false,
      error: null,
    });

    mockedApi.publishMenu.mockResolvedValue({
      success: true,
      data: { menu: { id: 'm1', business_id: 'b1', name: 'Menu', status: 'published', created_at: '', updated_at: '' } },
    });

    await useMenuStore.getState().publishMenu('m1');

    expect(useMenuStore.getState().menus[0]?.status).toBe('published');
    expect(useMenuStore.getState().activeMenu?.id).toBe('m1');
  });

  it('sets current menu', () => {
    const menu = { id: 'm1', business_id: 'b1', name: 'Menu', status: 'draft' as const, created_at: '', updated_at: '' };
    useMenuStore.getState().setCurrentMenu(menu);
    expect(useMenuStore.getState().currentMenu?.id).toBe('m1');
  });

  it('resets store', () => {
    useMenuStore.setState({
      dishes: [{ id: 'd1', name: 'Dish', business_id: 'b1', price_cents: 1000, is_available: true, created_at: '', updated_at: '' }],
      categories: [{ id: 'c1', business_id: 'b1', name: 'Cat', display_order: 1, created_at: '', updated_at: '' }],
      menus: [{ id: 'm1', business_id: 'b1', name: 'Menu', status: 'draft', created_at: '', updated_at: '' }],
      currentMenu: { id: 'm1', business_id: 'b1', name: 'Menu', status: 'draft', created_at: '', updated_at: '' },
      activeMenu: { id: 'm1', business_id: 'b1', name: 'Menu', status: 'draft', created_at: '', updated_at: '' },
      isLoading: true,
      error: 'some error',
    });

    useMenuStore.getState().reset();

    const state = useMenuStore.getState();
    expect(state.dishes).toHaveLength(0);
    expect(state.categories).toHaveLength(0);
    expect(state.menus).toHaveLength(0);
    expect(state.currentMenu).toBeNull();
    expect(state.activeMenu).toBeNull();
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
  });
});
