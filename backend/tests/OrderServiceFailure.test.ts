import { jest } from '@jest/globals';
import { OrderService } from '../src/services/OrderService';
import { AppDataSource } from '../src/config/database';
import { Menu } from '../src/models/Menu';
import { BusinessSettings } from '../src/models/BusinessSettings';
import { Dish } from '../src/models/Dish';
import { OrderCreateInput } from '@menumaker/shared';

// Mock query runner and repositories
const mockManager = {
  findOne: jest.fn(),
  findByIds: jest.fn(),
};

const mockQueryRunner: any = {
  manager: mockManager,
  connect: jest.fn(),
  startTransaction: jest.fn(),
  commitTransaction: jest.fn(),
  rollbackTransaction: jest.fn(),
  release: jest.fn(),
};

describe('OrderService failure paths', () => {
  let orderService: OrderService;

  const baseInput: OrderCreateInput = {
    menu_id: 'menu-1',
    items: [
      { dish_id: 'dish-1', quantity: 1 },
    ],
    customer_name: 'Test User',
    customer_phone: '1234567890',
    delivery_type: 'pickup',
    payment_method: 'cash',
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    (AppDataSource as any).createQueryRunner = jest.fn(() => mockQueryRunner);
    (AppDataSource as any).getRepository = jest.fn().mockReturnValue({
      findOne: jest.fn(),
      save: jest.fn(),
    });
    orderService = new OrderService();
  });

  it('throws when menu is not found', async () => {
    mockQueryRunner.manager.findOne.mockResolvedValueOnce(null);

    await expect(orderService.createOrder(baseInput)).rejects.toMatchObject({
      code: 'MENU_NOT_FOUND',
      statusCode: 404,
    });
    expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
  });

  it('throws when menu is draft/not published', async () => {
    mockQueryRunner.manager.findOne.mockResolvedValueOnce({
      id: 'menu-1',
      status: 'draft',
    } as Partial<Menu>);

    await expect(orderService.createOrder(baseInput)).rejects.toMatchObject({
      code: 'MENU_NOT_AVAILABLE',
      statusCode: 400,
    });
  });

  it('throws when menu not yet available', async () => {
    const future = new Date(Date.now() + 86400000);
    mockQueryRunner.manager.findOne.mockResolvedValueOnce({
      id: 'menu-1',
      status: 'published',
      start_date: future,
    } as Partial<Menu>);

    await expect(orderService.createOrder(baseInput)).rejects.toMatchObject({
      code: 'MENU_NOT_YET_AVAILABLE',
      statusCode: 400,
    });
  });

  it('throws when menu expired', async () => {
    const past = new Date(Date.now() - 86400000);
    mockQueryRunner.manager.findOne.mockResolvedValueOnce({
      id: 'menu-1',
      status: 'published',
      end_date: past,
    } as Partial<Menu>);

    await expect(orderService.createOrder(baseInput)).rejects.toMatchObject({
      code: 'MENU_EXPIRED',
      statusCode: 400,
    });
  });

  it('throws when business settings missing', async () => {
    mockQueryRunner.manager.findOne
      .mockResolvedValueOnce({ id: 'menu-1', status: 'published', business_id: 'biz-1' } as Partial<Menu>)
      .mockResolvedValueOnce(null); // settings

    await expect(orderService.createOrder(baseInput)).rejects.toMatchObject({
      code: 'SETTINGS_NOT_FOUND',
      statusCode: 404,
    });
  });

  it('throws when dishes missing', async () => {
    mockQueryRunner.manager.findOne
      .mockResolvedValueOnce({ id: 'menu-1', status: 'published', business_id: 'biz-1' } as Partial<Menu>)
      .mockResolvedValueOnce({ id: 'settings-1' } as Partial<BusinessSettings>);
    mockQueryRunner.manager.findByIds.mockResolvedValueOnce([]); // no dishes found

    await expect(orderService.createOrder(baseInput)).rejects.toMatchObject({
      code: 'DISH_NOT_FOUND',
      statusCode: 404,
    });
  });

  it('throws when dishes unavailable', async () => {
    mockQueryRunner.manager.findOne
      .mockResolvedValueOnce({ id: 'menu-1', status: 'published', business_id: 'biz-1' } as Partial<Menu>)
      .mockResolvedValueOnce({ id: 'settings-1' } as Partial<BusinessSettings>);
    mockQueryRunner.manager.findByIds.mockResolvedValueOnce([
      { id: 'dish-1', name: 'Dish 1', price_cents: 1000, is_available: false } as Partial<Dish>,
    ]);

    await expect(orderService.createOrder(baseInput)).rejects.toMatchObject({
      code: 'DISHES_UNAVAILABLE',
      statusCode: 400,
    });
  });

  it('throws when minimum order not met', async () => {
    mockQueryRunner.manager.findOne
      .mockResolvedValueOnce({ id: 'menu-1', status: 'published', business_id: 'biz-1' } as Partial<Menu>)
      .mockResolvedValueOnce({ id: 'settings-1', min_order_value_cents: 5000 } as Partial<BusinessSettings>);
    mockQueryRunner.manager.findByIds.mockResolvedValueOnce([
      { id: 'dish-1', name: 'Dish 1', price_cents: 1000, is_available: true } as Partial<Dish>,
    ]);

    await expect(orderService.createOrder(baseInput)).rejects.toMatchObject({
      code: 'MIN_ORDER_NOT_MET',
      statusCode: 400,
    });
  });
});
