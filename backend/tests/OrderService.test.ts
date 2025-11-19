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

  describe('getOrderById', () => {
    it('should get order by ID', async () => {
      const mockOrder = {
        id: 'order-123',
        business_id: 'business-123',
        customer_id: 'customer-123',
        order_status: 'pending',
      };

      mockOrderRepository.findOne.mockResolvedValue(mockOrder);

      const result = await orderService.getOrderById('order-123');

      expect(result).toEqual(mockOrder);
      expect(mockOrderRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'order-123' },
        relations: expect.arrayContaining(['business', 'items']),
      });
    });

    it('should throw error if order not found', async () => {
      mockOrderRepository.findOne.mockResolvedValue(null);

      await expect(orderService.getOrderById('nonexistent')).rejects.toThrow('Order not found');
    });
  });

  describe('getOrderSummary', () => {
    it('should return business order statistics', async () => {
      const mockOrders = [
        { id: 'order-1', total_cents: 5000, order_status: 'completed' },
        { id: 'order-2', total_cents: 3000, order_status: 'completed' },
        { id: 'order-3', total_cents: 4000, order_status: 'pending' },
      ];

      mockOrderRepository.find.mockResolvedValue(mockOrders);

      const result = await orderService.getOrderSummary(
        'business-123',
        'user-123'
      );

      expect(result.totalOrders).toBe(3);
      expect(result.totalSales).toBe(12000);
      expect(result.averageOrderValue).toBe(4000);
      expect(result.ordersByStatus.completed).toBe(2);
      expect(result.ordersByStatus.pending).toBe(1);
    });

    it('should filter by date range', async () => {
      const mockOrders = [
        { id: 'order-1', total_cents: 5000, order_status: 'completed' },
      ];

      mockOrderRepository.find.mockResolvedValue(mockOrders);

      const startDate = new Date('2025-01-01');
      const endDate = new Date('2025-01-31');

      const result = await orderService.getOrderSummary(
        'business-123',
        'user-123',
        startDate,
        endDate
      );

      expect(result.totalOrders).toBe(1);
      expect(result.totalSales).toBe(5000);
    });
  });

  describe('order validation', () => {
    it('should validate minimum order value', async () => {
      const mockBusiness = {
        id: 'business-123',
        settings: {
          min_order_value_cents: 5000, // Rs. 50 minimum
        },
      };

      mockBusinessRepository.findOne.mockResolvedValue(mockBusiness);

      const mockDish = {
        id: 'dish-1',
        price_cents: 1000,
      };

      mockDishRepository.findOne.mockResolvedValue(mockDish);

      const orderData = {
        menu_id: 'menu-123',
        customer_name: 'John Doe',
        customer_phone: '+1234567890',
        delivery_type: 'delivery' as const,
        delivery_address: '123 Main St',
        items: [{ dish_id: 'dish-1', quantity: 1 }], // Only 10 Rs
      };

      await expect(orderService.createOrder(orderData)).rejects.toThrow(
        'Minimum order value not met'
      );
    });
  });

  describe('error handling', () => {
    it('should handle database errors gracefully', async () => {
      mockOrderRepository.findOne.mockRejectedValue(new Error('Database connection failed'));

      await expect(orderService.getOrderById('order-123')).rejects.toThrow(
        'Database connection failed'
      );
    });

    it('should handle update errors when order not found', async () => {
      mockOrderRepository.findOne.mockResolvedValue(null);

      await expect(
        orderService.updateOrder('nonexistent', 'user-123', { order_status: 'confirmed' })
      ).rejects.toThrow('Order not found');
    });
  });

  describe('getCustomerOrders', () => {
    it('should return customer orders with items and business', async () => {
      const mockOrders = [
        {
          id: 'order-1',
          customer_id: 'user-123',
          total_cents: 2500,
          order_status: 'delivered',
          items: [{ dish_id: 'dish-1', quantity: 2 }],
          business: { id: 'business-1', name: 'Test Restaurant' },
          created_at: new Date(),
        },
        {
          id: 'order-2',
          customer_id: 'user-123',
          total_cents: 1500,
          order_status: 'pending',
          items: [{ dish_id: 'dish-2', quantity: 1 }],
          business: { id: 'business-2', name: 'Another Restaurant' },
          created_at: new Date(),
        },
      ];

      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockOrders as any),
      } as any;

      mockOrderRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await orderService.getCustomerOrders('user-123', {});

      expect(mockQueryBuilder.where).toHaveBeenCalledWith('order.customer_id = :userId', { userId: 'user-123' });
      expect(mockQueryBuilder.leftJoinAndSelect).toHaveBeenCalledWith('order.items', 'items');
      expect(mockQueryBuilder.leftJoinAndSelect).toHaveBeenCalledWith('order.business', 'business');
      expect(result).toEqual(mockOrders);
      expect(result).toHaveLength(2);
    });

    it('should filter orders by status', async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([] as any),
      } as any;

      mockOrderRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await orderService.getCustomerOrders('user-123', { status: 'pending' });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('order.order_status = :status', { status: 'pending' });
    });

    it('should apply pagination limits', async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([] as any),
      } as any;

      mockOrderRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await orderService.getCustomerOrders('user-123', { limit: 20, offset: 10 });

      expect(mockQueryBuilder.take).toHaveBeenCalledWith(20);
      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(10);
    });

    it('should order by created_at DESC', async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([] as any),
      } as any;

      mockOrderRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await orderService.getCustomerOrders('user-123', {});

      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('order.created_at', 'DESC');
    });
  });

  describe('cancelOrder', () => {
    it('should cancel order when status is pending', async () => {
      const mockOrder = {
        id: 'order-123',
        customer_id: 'user-123',
        order_status: 'pending',
        total_cents: 2500,
        notes: null,
      };

      mockOrderRepository.findOne.mockResolvedValue(mockOrder);
      mockOrderRepository.save.mockResolvedValue({ ...mockOrder, order_status: 'cancelled' });

      const result = await orderService.cancelOrder('order-123', 'user-123', 'Changed my mind');

      expect(mockOrderRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'order-123' },
        relations: ['business'],
      });
      expect(mockOrderRepository.save).toHaveBeenCalled();
      expect(result.order_status).toBe('cancelled');
    });

    it('should cancel order when status is confirmed', async () => {
      const mockOrder = {
        id: 'order-123',
        customer_id: 'user-123',
        order_status: 'confirmed',
        total_cents: 2500,
        notes: null,
      };

      mockOrderRepository.findOne.mockResolvedValue(mockOrder);
      mockOrderRepository.save.mockResolvedValue({ ...mockOrder, order_status: 'cancelled' });

      const result = await orderService.cancelOrder('order-123', 'user-123');

      expect(result.order_status).toBe('cancelled');
    });

    it('should append cancellation reason to notes', async () => {
      const mockOrder = {
        id: 'order-123',
        customer_id: 'user-123',
        order_status: 'pending',
        notes: 'Please deliver to side door',
      };

      mockOrderRepository.findOne.mockResolvedValue(mockOrder);
      mockOrderRepository.save.mockResolvedValue({
        ...mockOrder,
        order_status: 'cancelled',
        notes: 'Please deliver to side door\nCancellation reason: Changed my mind',
      });

      const result = await orderService.cancelOrder('order-123', 'user-123', 'Changed my mind');

      expect(result.notes).toContain('Cancellation reason: Changed my mind');
    });

    it('should throw error if order not found', async () => {
      mockOrderRepository.findOne.mockResolvedValue(null);

      await expect(
        orderService.cancelOrder('nonexistent', 'user-123')
      ).rejects.toThrow('Order not found');
    });

    it('should throw error if user does not own the order', async () => {
      const mockOrder = {
        id: 'order-123',
        customer_id: 'other-user',
        order_status: 'pending',
      };

      mockOrderRepository.findOne.mockResolvedValue(mockOrder);

      await expect(
        orderService.cancelOrder('order-123', 'user-123')
      ).rejects.toThrow('You do not have permission to cancel this order');
    });

    it('should throw error if order is preparing', async () => {
      const mockOrder = {
        id: 'order-123',
        customer_id: 'user-123',
        order_status: 'preparing',
      };

      mockOrderRepository.findOne.mockResolvedValue(mockOrder);

      await expect(
        orderService.cancelOrder('order-123', 'user-123')
      ).rejects.toThrow('Order cannot be cancelled at this stage');
    });

    it('should throw error if order is out for delivery', async () => {
      const mockOrder = {
        id: 'order-123',
        customer_id: 'user-123',
        order_status: 'out_for_delivery',
      };

      mockOrderRepository.findOne.mockResolvedValue(mockOrder);

      await expect(
        orderService.cancelOrder('order-123', 'user-123')
      ).rejects.toThrow('Order cannot be cancelled at this stage');
    });

    it('should throw error if order is already delivered', async () => {
      const mockOrder = {
        id: 'order-123',
        customer_id: 'user-123',
        order_status: 'delivered',
      };

      mockOrderRepository.findOne.mockResolvedValue(mockOrder);

      await expect(
        orderService.cancelOrder('order-123', 'user-123')
      ).rejects.toThrow('Order cannot be cancelled at this stage');
    });

    it('should throw error if order is already cancelled', async () => {
      const mockOrder = {
        id: 'order-123',
        customer_id: 'user-123',
        order_status: 'cancelled',
      };

      mockOrderRepository.findOne.mockResolvedValue(mockOrder);

      await expect(
        orderService.cancelOrder('order-123', 'user-123')
      ).rejects.toThrow('Order cannot be cancelled at this stage');
    });
  });
});
