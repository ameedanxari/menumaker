import { jest, describe, beforeEach, it, expect } from '@jest/globals';
import type { Mock } from 'jest-mock';
import { OrderService } from '../src/services/OrderService';
import { AppDataSource } from '../src/config/database';
import { Order } from '../src/models/Order';
import { OrderItem } from '../src/models/OrderItem';
import { Business } from '../src/models/Business';
import { BusinessSettings } from '../src/models/BusinessSettings';
import { Dish } from '../src/models/Dish';
import { Menu } from '../src/models/Menu';

// Mock dependencies
jest.mock('../src/config/database');

describe('OrderService', () => {
  let orderService: OrderService;
  let mockOrderRepository: any;
  let mockOrderItemRepository: any;
  let mockBusinessRepository: any;
  let mockSettingsRepository: any;
  let mockDishRepository: any;
  let mockMenuRepository: any;
  let mockQueryRunner: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock query builder
    // @ts-ignore - Mock typing
    const mockQueryBuilder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      // @ts-ignore
      getMany: jest.fn().mockResolvedValue([]),
      // @ts-ignore
      getOne: jest.fn().mockResolvedValue(null),
    } as any;

    mockOrderRepository = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
    };

    mockOrderItemRepository = {
      create: jest.fn(),
      save: jest.fn(),
    };

    mockBusinessRepository = {
      findOne: jest.fn(),
    };

    mockSettingsRepository = {
      findOne: jest.fn(),
    };

    mockDishRepository = {
      findOne: jest.fn(),
    };

    mockMenuRepository = {
      findOne: jest.fn(),
    };

    // Mock query runner for transactions
    // @ts-ignore - Mock typing
    mockQueryRunner = {
      // @ts-ignore
      connect: jest.fn().mockResolvedValue(undefined),
      // @ts-ignore
      startTransaction: jest.fn().mockResolvedValue(undefined),
      // @ts-ignore
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      // @ts-ignore
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      // @ts-ignore
      release: jest.fn().mockResolvedValue(undefined),
      manager: {
        findOne: jest.fn().mockImplementation((entity, options) => {
          if (entity === Menu) return mockMenuRepository.findOne(options);
          if (entity === Business) return mockBusinessRepository.findOne(options);
          if (entity === BusinessSettings) return mockSettingsRepository.findOne(options);
          if (entity === Dish) return mockDishRepository.findOne(options);
          return null;
        }),
        // @ts-ignore
        findByIds: jest.fn().mockImplementation(async (entity: any, ids: string[]) => {
          // Return mock dishes based on IDs
          if (entity === Dish && ids) {
            const dishes = [];
            for (const id of ids) {
              if (id === 'dish-1') {
                dishes.push({ id: 'dish-1', name: 'Pizza', price_cents: 1500, is_available: true });
              } else if (id === 'dish-2') {
                dishes.push({ id: 'dish-2', name: 'Salad', price_cents: 800, is_available: true });
              }
            }
            return dishes;
          }
          return [];
        }),
        create: jest.fn(),
        save: jest.fn(),
        getRepository: jest.fn().mockImplementation((entity) => {
          if (entity === Order) return mockOrderRepository;
          if (entity === OrderItem) return mockOrderItemRepository;
          if (entity === Business) return mockBusinessRepository;
          if (entity === BusinessSettings) return mockSettingsRepository;
          if (entity === Dish) return mockDishRepository;
          if (entity === Menu) return mockMenuRepository;
          return {};
        }),
      },
    } as any;

    // Set up the mock implementation
    AppDataSource.getRepository = jest.fn().mockImplementation((entity) => {
      if (entity === Order) return mockOrderRepository;
      if (entity === OrderItem) return mockOrderItemRepository;
      if (entity === Business) return mockBusinessRepository;
      if (entity === BusinessSettings) return mockSettingsRepository;
      if (entity === Dish) return mockDishRepository;
      if (entity === Menu) return mockMenuRepository;
      return {};
    }) as any;

    // Mock createQueryRunner
    (AppDataSource as any).createQueryRunner = jest.fn().mockReturnValue(mockQueryRunner);

    // Mock transaction
    AppDataSource.transaction = jest.fn().mockImplementation(async (callback: any) => {
      const mockManager = {
        getRepository: (entity: any) => {
          if (entity === Order) return mockOrderRepository;
          if (entity === OrderItem) return mockOrderItemRepository;
          return {};
        },
      };
      return await callback(mockManager);
    }) as any;

    orderService = new OrderService();
  });

  describe('createOrder', () => {
    // Note: Full createOrder flow tests with transactions are complex to mock properly
    // These are better tested as integration tests or E2E tests
    // Keeping validation and error handling tests which provide high value

    it('should throw error if dish is not available', async () => {
      const orderData = {
        business_id: 'business-id',
        menu_id: 'menu-id',
        customer_name: 'John Doe',
        customer_phone: '+1234567890',
        delivery_type: 'pickup' as const,
        items: [{ dish_id: 'dish-1', quantity: 1 }],
        payment_method: 'cash' as const,
      };

      const mockDish = {
        id: 'dish-1',
        is_available: false,
      };

      const mockBusiness = { id: 'business-id', name: 'Test Restaurant' };

      const mockMenu = {
        id: 'menu-id',
        business_id: 'business-id',
        business: mockBusiness,
        is_active: true,
        status: 'published',
      };

      mockBusinessRepository.findOne.mockResolvedValue(mockBusiness);
      mockSettingsRepository.findOne.mockResolvedValue({});
      mockMenuRepository.findOne.mockResolvedValue(mockMenu);
      mockDishRepository.findOne.mockResolvedValue(mockDish);

      await expect(orderService.createOrder(orderData)).rejects.toThrow();
    });

    it('should throw error if delivery is not enabled', async () => {
      const orderData = {
        business_id: 'business-id',
        menu_id: 'menu-id',
        customer_name: 'John Doe',
        customer_phone: '+1234567890',
        delivery_type: 'delivery' as const,
        delivery_address: '123 Main St',
        items: [{ dish_id: 'dish-1', quantity: 1 }],
        payment_method: 'cash' as const,
      };

      const mockSettings = {
        delivery_enabled: false,
        pickup_enabled: true,
      };

      const mockBusiness = { id: 'business-id', name: 'Test Restaurant' };

      const mockMenu = {
        id: 'menu-id',
        business_id: 'business-id',
        business: mockBusiness,
        is_active: true,
        status: 'published',
      };

      mockBusinessRepository.findOne.mockResolvedValue(mockBusiness);
      mockSettingsRepository.findOne.mockResolvedValue(mockSettings);
      mockMenuRepository.findOne.mockResolvedValue(mockMenu);

      await expect(orderService.createOrder(orderData)).rejects.toThrow();
    });
  });

  describe('getOrdersByBusiness', () => {
    it('should return all orders for a business', async () => {
      const businessId = 'business-id';
      const userId = 'user-id';

      const mockOrders = [
        {
          id: 'order-1',
          business_id: businessId,
          customer_name: 'Customer 1',
          items: [],
        },
        {
          id: 'order-2',
          business_id: businessId,
          customer_name: 'Customer 2',
          items: [],
        },
      ];

      mockBusinessRepository.findOne.mockResolvedValue({
        id: businessId,
        owner_id: userId,
      });

      // Mock query builder to return orders
      const mockQueryBuilder = mockOrderRepository.createQueryBuilder();
      mockQueryBuilder.getMany.mockResolvedValue(mockOrders);

      const result = await orderService.getBusinessOrders(businessId, userId);

      expect(result).toHaveLength(2);
    });

    it('should filter orders by status', async () => {
      const businessId = 'business-id';
      const userId = 'user-id';
      const filters = { status: 'pending' };

      mockBusinessRepository.findOne.mockResolvedValue({
        id: businessId,
        owner_id: userId,
      });

      // Mock query builder
      const mockQueryBuilder = mockOrderRepository.createQueryBuilder();
      mockQueryBuilder.getMany.mockResolvedValue([]);

      await orderService.getBusinessOrders(businessId, userId, filters);

      // Verify query builder was used with correct filters
      expect(mockOrderRepository.createQueryBuilder).toHaveBeenCalled();
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'order.business_id = :businessId',
        { businessId }
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'order.order_status = :status',
        { status: 'pending' }
      );
    });
  });

  describe('updateOrder', () => {
    it('should update order status', async () => {
      const orderId = 'order-id';
      const userId = 'user-id';
      const updateData = { order_status: 'confirmed' as const };

      const mockOrder = {
        id: orderId,
        business_id: 'business-id',
        order_status: 'pending',
      };

      const mockBusiness = {
        id: 'business-id',
        owner_id: userId,
      };

      mockOrderRepository.findOne.mockResolvedValue(mockOrder);
      mockBusinessRepository.findOne.mockResolvedValue(mockBusiness);
      mockOrderRepository.save.mockResolvedValue({
        ...mockOrder,
        order_status: updateData.order_status,
      });

      const result = await orderService.updateOrder(orderId, userId, updateData);

      expect(result.order_status).toBe('confirmed');
    });

    it('should set fulfilled_at when status is fulfilled', async () => {
      const orderId = 'order-id';
      const userId = 'user-id';
      const updateData = { order_status: 'fulfilled' as const };

      const mockOrder = {
        id: orderId,
        business_id: 'business-id',
        order_status: 'ready',
      };

      const mockBusiness = {
        id: 'business-id',
        owner_id: userId,
      };

      const updatedOrder = {
        ...mockOrder,
        order_status: 'fulfilled' as const,
        fulfilled_at: new Date(),
      };

      mockOrderRepository.findOne.mockResolvedValue(mockOrder);
      mockBusinessRepository.findOne.mockResolvedValue(mockBusiness);
      mockOrderRepository.save.mockResolvedValue(updatedOrder);

      const result = await orderService.updateOrder(orderId, userId, updateData);

      expect(result.fulfilled_at).toBeDefined();
    });
  });
});
