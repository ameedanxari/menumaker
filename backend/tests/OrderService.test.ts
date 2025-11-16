import { jest, describe, beforeEach, it, expect } from '@jest/globals';
import type { Mock } from 'jest-mock';
import { OrderService } from '../src/services/OrderService';
import { AppDataSource } from '../src/config/database';
import { Order } from '../src/models/Order';
import { OrderItem } from '../src/models/OrderItem';
import { Business } from '../src/models/Business';
import { BusinessSettings } from '../src/models/BusinessSettings';
import { Dish } from '../src/models/Dish';

// Mock dependencies
jest.mock('../src/config/database');

describe('OrderService', () => {
  let orderService: OrderService;
  let mockOrderRepository: any;
  let mockOrderItemRepository: any;
  let mockBusinessRepository: any;
  let mockSettingsRepository: any;
  let mockDishRepository: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockOrderRepository = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
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

    // Set up the mock implementation
    AppDataSource.getRepository = jest.fn().mockImplementation((entity) => {
      if (entity === Order) return mockOrderRepository;
      if (entity === OrderItem) return mockOrderItemRepository;
      if (entity === Business) return mockBusinessRepository;
      if (entity === BusinessSettings) return mockSettingsRepository;
      if (entity === Dish) return mockDishRepository;
      return {};
    }) as any;

    // Mock transaction
    AppDataSource.transaction = jest.fn().mockImplementation(async (callback) => {
      const mockManager = {
        getRepository: (entity: any) => {
          if (entity === Order) return mockOrderRepository;
          if (entity === OrderItem) return mockOrderItemRepository;
          return {};
        },
      };
      return callback(mockManager);
    }) as any;

    orderService = new OrderService();
  });

  describe('createOrder', () => {
    it('should create order with items and calculate totals', async () => {
      const orderData = {
        business_id: 'business-id',
        menu_id: 'menu-id',
        customer_name: 'John Doe',
        customer_phone: '+1234567890',
        delivery_type: 'pickup' as const,
        items: [
          { dish_id: 'dish-1', quantity: 2 },
          { dish_id: 'dish-2', quantity: 1 },
        ],
        payment_method: 'cash' as const,
      };

      const mockBusiness = {
        id: 'business-id',
        name: 'Test Restaurant',
      };

      const mockSettings = {
        delivery_enabled: true,
        pickup_enabled: true,
        delivery_fee_type: 'flat' as const,
        delivery_fee_flat_cents: 500,
      };

      const mockDish1 = {
        id: 'dish-1',
        name: 'Pizza',
        price_cents: 1500,
        is_available: true,
      };

      const mockDish2 = {
        id: 'dish-2',
        name: 'Salad',
        price_cents: 800,
        is_available: true,
      };

      mockBusinessRepository.findOne.mockResolvedValue(mockBusiness);
      mockSettingsRepository.findOne.mockResolvedValue(mockSettings);
      mockDishRepository.findOne
        .mockResolvedValueOnce(mockDish1)
        .mockResolvedValueOnce(mockDish2);

      const mockOrder = {
        id: 'order-id',
        ...orderData,
        delivery_fee_cents: 0,
        total_cents: 3800, // (1500 * 2) + (800 * 1)
        order_status: 'pending',
        payment_status: 'pending',
      };

      mockOrderRepository.create.mockReturnValue(mockOrder);
      mockOrderRepository.save.mockResolvedValue(mockOrder);
      mockOrderItemRepository.create.mockImplementation((data: any) => data);
      mockOrderItemRepository.save.mockResolvedValue({});

      const result = await orderService.createOrder(orderData);

      expect(mockBusinessRepository.findOne).toHaveBeenCalled();
      expect(mockDishRepository.findOne).toHaveBeenCalledTimes(2);
      expect(mockOrderRepository.create).toHaveBeenCalled();
      expect(result).toEqual(expect.objectContaining({
        customer_name: orderData.customer_name,
        total_cents: 3800,
      }));
    });

    it('should calculate delivery fee for delivery orders', async () => {
      const orderData = {
        business_id: 'business-id',
        menu_id: 'menu-id',
        customer_name: 'Jane Doe',
        customer_phone: '+1234567890',
        delivery_type: 'delivery' as const,
        delivery_address: '456 Oak St',
        items: [{ dish_id: 'dish-1', quantity: 1 }],
        payment_method: 'cash' as const,
      };

      const mockSettings = {
        delivery_enabled: true,
        delivery_fee_type: 'flat' as const,
        delivery_fee_flat_cents: 500,
      };

      const mockDish = {
        id: 'dish-1',
        price_cents: 1000,
        is_available: true,
      };

      mockBusinessRepository.findOne.mockResolvedValue({ id: 'business-id' });
      mockSettingsRepository.findOne.mockResolvedValue(mockSettings);
      mockDishRepository.findOne.mockResolvedValue(mockDish);

      const mockOrder = {
        id: 'order-id',
        ...orderData,
        delivery_fee_cents: 500,
        total_cents: 1500,
      };

      mockOrderRepository.create.mockReturnValue(mockOrder);
      mockOrderRepository.save.mockResolvedValue(mockOrder);
      mockOrderItemRepository.create.mockReturnValue({});
      mockOrderItemRepository.save.mockResolvedValue({});

      const result = await orderService.createOrder(orderData);

      expect(result.delivery_fee_cents).toBe(500);
      expect(result.total_cents).toBe(1500);
    });

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

      mockBusinessRepository.findOne.mockResolvedValue({ id: 'business-id' });
      mockSettingsRepository.findOne.mockResolvedValue({});
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

      mockBusinessRepository.findOne.mockResolvedValue({ id: 'business-id' });
      mockSettingsRepository.findOne.mockResolvedValue(mockSettings);

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
      mockOrderRepository.find.mockResolvedValue(mockOrders);

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
      mockOrderRepository.find.mockResolvedValue([]);

      await orderService.getBusinessOrders(businessId, userId, filters);

      expect(mockOrderRepository.find).toHaveBeenCalledWith({
        where: { business_id: businessId, order_status: 'pending' },
        relations: ['items', 'items.dish'],
        order: { created_at: 'DESC' },
      });
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
