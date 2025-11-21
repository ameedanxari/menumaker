import { jest, describe, beforeEach, it, expect } from '@jest/globals';
import { CouponService } from '../src/services/CouponService';
import { AppDataSource } from '../src/config/database';
import { Coupon, CouponUsage, DiscountType, UsageLimitType } from '../src/models/Coupon';

// Mock dependencies
jest.mock('../src/config/database');

describe('CouponService', () => {
  let couponService: CouponService;
  let mockCouponRepository: any;
  let mockUsageRepository: any;
  let mockPromotionRepository: any;
  let mockOrderRepository: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockCouponRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      update: jest.fn(),
    };

    mockUsageRepository = {
      count: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
    };

    mockPromotionRepository = {
      find: jest.fn(),
    };

    mockOrderRepository = {
      find: jest.fn(),
    };

    AppDataSource.getRepository = jest.fn().mockImplementation((entity: any) => {
      const entityName = entity?.name || entity;
      if (entity === Coupon || entityName === 'Coupon') return mockCouponRepository;
      if (entity === CouponUsage || entityName === 'CouponUsage') return mockUsageRepository;
      if (entityName === 'AutomaticPromotion') return mockPromotionRepository;
      if (entityName === 'Order') return mockOrderRepository;
      return mockCouponRepository; // Default to coupon repository for unknown entities
    }) as any;

    couponService = new CouponService();
  });

  describe('createCoupon', () => {
    it('should create a percentage discount coupon successfully', async () => {
      const businessId = 'business-123';
      const couponData = {
        code: 'save20',
        name: '20% Off',
        discount_type: 'percentage' as DiscountType,
        discount_value: 20,
        valid_from: new Date('2024-01-01'),
        valid_until: new Date('2024-12-31'),
      };

      mockCouponRepository.findOne.mockResolvedValue(null);
      mockCouponRepository.create.mockImplementation((data) => ({ ...data, id: 'coupon-123' }));
      mockCouponRepository.save.mockImplementation((data) => Promise.resolve(data));

      const result = await couponService.createCoupon(businessId, couponData);

      expect(mockCouponRepository.findOne).toHaveBeenCalledWith({
        where: { code: 'SAVE20' },
      });
      expect(result.code).toBe('SAVE20');
      expect(result.status).toBe('active');
      expect(result.qr_code_data).toBe('https://menumaker.app/coupon/SAVE20');
    });

    it('should throw error if coupon code already exists', async () => {
      const businessId = 'business-123';
      const couponData = {
        code: 'EXISTING',
        name: 'Existing Coupon',
        discount_type: 'percentage' as DiscountType,
        discount_value: 10,
        valid_from: new Date('2024-01-01'),
        valid_until: new Date('2024-12-31'),
      };

      mockCouponRepository.findOne.mockResolvedValue({ id: 'existing' });

      await expect(couponService.createCoupon(businessId, couponData)).rejects.toThrow(
        'Coupon code already exists'
      );
    });

    it('should throw error if valid_from is after valid_until', async () => {
      const businessId = 'business-123';
      const couponData = {
        code: 'INVALID',
        name: 'Invalid Dates',
        discount_type: 'percentage' as DiscountType,
        discount_value: 10,
        valid_from: new Date('2024-12-31'),
        valid_until: new Date('2024-01-01'),
      };

      mockCouponRepository.findOne.mockResolvedValue(null);

      await expect(couponService.createCoupon(businessId, couponData)).rejects.toThrow(
        'Valid from date must be before valid until date'
      );
    });

    it('should normalize coupon code to uppercase', async () => {
      const businessId = 'business-123';
      const couponData = {
        code: 'lowercase',
        name: 'Test',
        discount_type: 'percentage' as DiscountType,
        discount_value: 10,
        valid_from: new Date('2024-01-01'),
        valid_until: new Date('2024-12-31'),
      };

      mockCouponRepository.findOne.mockResolvedValue(null);
      mockCouponRepository.create.mockImplementation((data) => data);
      mockCouponRepository.save.mockImplementation((data) => Promise.resolve(data));

      await couponService.createCoupon(businessId, couponData);

      expect(mockCouponRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'LOWERCASE',
        })
      );
    });

    it('should set default values for optional fields', async () => {
      const businessId = 'business-123';
      const couponData = {
        code: 'MINIMAL',
        name: 'Minimal',
        discount_type: 'percentage' as DiscountType,
        discount_value: 10,
        valid_from: new Date('2024-01-01'),
        valid_until: new Date('2024-12-31'),
      };

      mockCouponRepository.findOne.mockResolvedValue(null);
      mockCouponRepository.create.mockImplementation((data) => data);
      mockCouponRepository.save.mockImplementation((data) => Promise.resolve(data));

      await couponService.createCoupon(businessId, couponData);

      expect(mockCouponRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          min_order_value_cents: 0,
          usage_limit_type: 'unlimited',
          applicable_to: 'all_dishes',
          dish_ids: [],
          is_public: true,
          status: 'active',
        })
      );
    });
  });

  describe('validateCoupon', () => {
    it('should validate a valid coupon successfully', async () => {
      const couponCode = 'VALID20';
      const customerId = 'customer-123';
      const businessId = 'business-123';
      const orderSubtotal = 2000;
      const dishIds = ['dish-1', 'dish-2'];

      const validStart = new Date();
      validStart.setDate(validStart.getDate() - 1); // Yesterday
      const validEnd = new Date();
      validEnd.setFullYear(validEnd.getFullYear() + 1); // Next year

      const mockCoupon = {
        id: 'coupon-123',
        code: 'VALID20',
        business_id: businessId,
        discount_type: 'percentage' as DiscountType,
        discount_value: 20,
        min_order_value_cents: 1000,
        valid_from: validStart,
        valid_until: validEnd,
        status: 'active',
        usage_limit_type: 'unlimited' as UsageLimitType,
        applicable_to: 'all_dishes' as any,
      };

      mockCouponRepository.findOne.mockResolvedValue(mockCoupon);

      const result = await couponService.validateCoupon(
        couponCode,
        customerId,
        businessId,
        orderSubtotal,
        dishIds
      );

      expect(result.valid).toBe(true);
      expect(result.coupon).toEqual(mockCoupon);
      expect(result.discount_amount_cents).toBeDefined();
    });

    it('should return error if coupon not found', async () => {
      mockCouponRepository.findOne.mockResolvedValue(null);

      const result = await couponService.validateCoupon(
        'NONEXISTENT',
        'customer-123',
        'business-123',
        1000,
        []
      );

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Coupon not found');
    });

    it('should return error if coupon is not active', async () => {
      const validStart = new Date();
      validStart.setDate(validStart.getDate() - 1); // Yesterday
      const validEnd = new Date();
      validEnd.setFullYear(validEnd.getFullYear() + 1); // Next year

      const mockCoupon = {
        id: 'coupon-123',
        code: 'INACTIVE',
        status: 'inactive',
        valid_from: validStart,
        valid_until: validEnd,
      };

      mockCouponRepository.findOne.mockResolvedValue(mockCoupon);

      const result = await couponService.validateCoupon(
        'INACTIVE',
        'customer-123',
        'business-123',
        1000,
        []
      );

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Coupon is not active');
    });

    it('should return error if coupon not yet valid', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 10);

      const mockCoupon = {
        id: 'coupon-123',
        code: 'FUTURE',
        status: 'active',
        valid_from: futureDate,
        valid_until: new Date('2024-12-31'),
      };

      mockCouponRepository.findOne.mockResolvedValue(mockCoupon);

      const result = await couponService.validateCoupon(
        'FUTURE',
        'customer-123',
        'business-123',
        1000,
        []
      );

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Coupon is not yet valid');
    });

    it('should return error if coupon has expired', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 10);

      const mockCoupon = {
        id: 'coupon-123',
        code: 'EXPIRED',
        status: 'active',
        valid_from: new Date('2024-01-01'),
        valid_until: pastDate,
      };

      mockCouponRepository.findOne.mockResolvedValue(mockCoupon);

      const result = await couponService.validateCoupon(
        'EXPIRED',
        'customer-123',
        'business-123',
        1000,
        []
      );

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Coupon has expired');
    });

    it('should return error if order below minimum value', async () => {
      const validStart = new Date();
      validStart.setDate(validStart.getDate() - 1); // Yesterday
      const validEnd = new Date();
      validEnd.setFullYear(validEnd.getFullYear() + 1); // Next year

      const mockCoupon = {
        id: 'coupon-123',
        code: 'MINORDER',
        status: 'active',
        min_order_value_cents: 5000,
        valid_from: validStart,
        valid_until: validEnd,
      };

      mockCouponRepository.findOne.mockResolvedValue(mockCoupon);

      const result = await couponService.validateCoupon(
        'MINORDER',
        'customer-123',
        'business-123',
        3000,
        []
      );

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Minimum order value');
    });

    it('should return error if coupon not applicable to cart items', async () => {
      const validStart = new Date();
      validStart.setDate(validStart.getDate() - 1); // Yesterday
      const validEnd = new Date();
      validEnd.setFullYear(validEnd.getFullYear() + 1); // Next year

      const mockCoupon = {
        id: 'coupon-123',
        code: 'PIZZA20',
        status: 'active',
        min_order_value_cents: 0,
        valid_from: validStart,
        valid_until: validEnd,
        applicable_to: 'specific_dishes',
        dish_ids: ['dish-pizza-1', 'dish-pizza-2'],
        usage_limit_type: 'unlimited' as UsageLimitType,
      };

      mockCouponRepository.findOne.mockResolvedValue(mockCoupon);

      const result = await couponService.validateCoupon(
        'PIZZA20',
        'customer-123',
        'business-123',
        2000,
        ['dish-burger-1', 'dish-salad-1'] // No pizza dishes
      );

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Coupon not applicable to items in cart');
    });

    it('should validate when applicable dishes are in cart', async () => {
      const validStart = new Date();
      validStart.setDate(validStart.getDate() - 1); // Yesterday
      const validEnd = new Date();
      validEnd.setFullYear(validEnd.getFullYear() + 1); // Next year

      const mockCoupon = {
        id: 'coupon-123',
        code: 'PIZZA20',
        status: 'active',
        min_order_value_cents: 0,
        valid_from: validStart,
        valid_until: validEnd,
        applicable_to: 'specific_dishes',
        dish_ids: ['dish-pizza-1', 'dish-pizza-2'],
        usage_limit_type: 'unlimited' as UsageLimitType,
        discount_type: 'percentage' as DiscountType,
        discount_value: 20,
      };

      mockCouponRepository.findOne.mockResolvedValue(mockCoupon);

      const result = await couponService.validateCoupon(
        'PIZZA20',
        'customer-123',
        'business-123',
        2000,
        ['dish-pizza-1', 'dish-burger-1'] // Contains pizza dish
      );

      expect(result.valid).toBe(true);
    });

    it('should check per customer usage limit', async () => {
      const validStart = new Date();
      validStart.setDate(validStart.getDate() - 1); // Yesterday
      const validEnd = new Date();
      validEnd.setFullYear(validEnd.getFullYear() + 1); // Next year

      const mockCoupon = {
        id: 'coupon-123',
        code: 'LIMITED',
        status: 'active',
        min_order_value_cents: 0,
        valid_from: validStart,
        valid_until: validEnd,
        usage_limit_type: 'per_customer' as UsageLimitType,
        usage_limit_per_customer: 3,
        applicable_to: 'all_dishes' as any,
      };

      mockCouponRepository.findOne.mockResolvedValue(mockCoupon);
      mockUsageRepository.count.mockResolvedValue(3); // Already used 3 times

      const result = await couponService.validateCoupon(
        'LIMITED',
        'customer-123',
        'business-123',
        1000,
        []
      );

      expect(result.valid).toBe(false);
      expect(result.error).toBe('You have already used this coupon');
    });

    it('should check total usage limit', async () => {
      const validStart = new Date();
      validStart.setDate(validStart.getDate() - 1); // Yesterday
      const validEnd = new Date();
      validEnd.setFullYear(validEnd.getFullYear() + 1); // Next year

      const mockCoupon = {
        id: 'coupon-123',
        code: 'TOTALLIMIT',
        status: 'active',
        min_order_value_cents: 0,
        valid_from: validStart,
        valid_until: validEnd,
        usage_limit_type: 'total_limit' as UsageLimitType,
        total_usage_limit: 100,
        total_usage_count: 100, // Limit reached
        applicable_to: 'all_dishes' as any,
      };

      mockCouponRepository.findOne.mockResolvedValue(mockCoupon);

      const result = await couponService.validateCoupon(
        'TOTALLIMIT',
        'customer-123',
        'business-123',
        1000,
        []
      );

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Coupon usage limit reached');
    });
  });

  describe('getBusinessCoupons', () => {
    it('should get all coupons for a business', async () => {
      const mockCoupons = [
        { id: 'coupon-1', code: 'CODE1' },
        { id: 'coupon-2', code: 'CODE2' },
      ];

      mockCouponRepository.find.mockResolvedValue(mockCoupons);

      const result = await couponService.getBusinessCoupons('business-123');

      expect(result).toEqual(mockCoupons);
      expect(mockCouponRepository.find).toHaveBeenCalledWith({
        where: { business_id: 'business-123' },
        order: { created_at: 'DESC' },
      });
    });
  });

  describe('getPublicCoupons', () => {
    it('should get public active coupons', async () => {
      const mockCoupons = [
        { id: 'coupon-1', code: 'PUBLIC1', is_public: true, status: 'active' },
      ];

      mockCouponRepository.find.mockResolvedValue(mockCoupons);

      const result = await couponService.getPublicCoupons('business-123');

      expect(result).toEqual(mockCoupons);
    });
  });

  describe('archiveCoupon', () => {
    it('should archive a coupon', async () => {
      const mockCoupon = {
        id: 'coupon-123',
        status: 'active',
      };

      mockCouponRepository.findOne.mockResolvedValue(mockCoupon);
      mockCouponRepository.save.mockImplementation((data) => Promise.resolve(data));

      await couponService.archiveCoupon('coupon-123');

      expect(mockCouponRepository.save).toHaveBeenCalled();
    });
  });

  describe('expireCoupons', () => {
    it('should expire coupons past their validity date', async () => {
      mockCouponRepository.update.mockResolvedValue({ affected: 2 });

      const result = await couponService.expireCoupons();

      expect(result).toBe(2);
      expect(mockCouponRepository.update).toHaveBeenCalled();
    });

    it('should return 0 if no expired coupons', async () => {
      mockCouponRepository.update.mockResolvedValue({ affected: 0 });

      const result = await couponService.expireCoupons();

      expect(result).toBe(0);
    });
  });

  describe('getCouponAnalytics', () => {
    it('should return coupon analytics', async () => {
      const mockCoupon = {
        id: 'coupon-123',
        total_usage_count: 50,
        total_discount_given_cents: 1000000, // 10000 in dollars
        total_revenue_generated_cents: 5000000, // 50000 in dollars
      };

      const mockUsages = [
        { used_at: new Date('2025-01-15'), discount_amount_cents: 500 },
        { used_at: new Date('2025-01-20'), discount_amount_cents: 300 },
      ];

      mockCouponRepository.findOne.mockResolvedValue(mockCoupon);
      mockUsageRepository.find.mockResolvedValue(mockUsages);

      const result = await couponService.getCouponAnalytics('coupon-123');

      expect(result.total_usages).toBe(50);
      expect(result.total_discount_given).toBe(10000); // Converted from cents to dollars
      expect(result.total_revenue_generated).toBe(50000); // Converted from cents to dollars
      expect(result.avg_order_value).toBe(1000); // 50000 / 50
    });

    it('should throw error if coupon not found', async () => {
      mockCouponRepository.findOne.mockResolvedValue(null);

      await expect(couponService.getCouponAnalytics('nonexistent')).rejects.toThrow(
        'Coupon not found'
      );
    });
  });

  describe('getBusinessCouponStats', () => {
    it('should return business-wide coupon statistics', async () => {
      const mockCoupons = [
        {
          id: 'coupon-1',
          status: 'active',
          total_usage_count: 100,
          total_revenue_impact_cents: 50000,
        },
        {
          id: 'coupon-2',
          status: 'active',
          total_usage_count: 50,
          total_revenue_impact_cents: 25000,
        },
      ];

      mockCouponRepository.find.mockResolvedValue(mockCoupons);
      mockUsageRepository.count.mockResolvedValue(150);

      const result = await couponService.getBusinessCouponStats('business-123');

      expect(result.total_coupons).toBe(2);
      expect(result.total_redemptions).toBe(150);
    });
  });

  describe('applyCoupon', () => {
    it('should apply coupon and record usage', async () => {
      const validStart = new Date();
      validStart.setDate(validStart.getDate() - 1);
      const validEnd = new Date();
      validEnd.setFullYear(validEnd.getFullYear() + 1);

      const mockCoupon = {
        id: 'coupon-123',
        code: 'SAVE20',
        status: 'active',
        min_order_value_cents: 0,
        valid_from: validStart,
        valid_until: validEnd,
        usage_limit_type: 'unlimited' as UsageLimitType,
        applicable_to: 'all_dishes',
        discount_type: 'percentage' as DiscountType,
        discount_value: 20,
        total_usage_count: 0,
        total_revenue_impact_cents: 0,
      };

      mockCouponRepository.findOne.mockResolvedValue(mockCoupon);
      mockUsageRepository.create.mockImplementation((data) => data);
      mockUsageRepository.save.mockImplementation((data) => Promise.resolve(data));
      mockCouponRepository.save.mockImplementation((data) => Promise.resolve(data));

      await couponService.applyCoupon('order-123', 'coupon-123', 'customer-123', 'business-123', 10000, 2000);

      expect(mockUsageRepository.save).toHaveBeenCalled();
      expect(mockCouponRepository.save).toHaveBeenCalled();
    });
  });

  describe('updateCoupon', () => {
    it('should update coupon details', async () => {
      const mockCoupon = {
        id: 'coupon-123',
        code: 'SAVE20',
        name: 'Old Name',
      };

      mockCouponRepository.findOne.mockResolvedValue(mockCoupon);
      mockCouponRepository.save.mockImplementation((data) => Promise.resolve(data));

      const result = await couponService.updateCoupon('coupon-123', {
        name: 'New Name',
      });

      expect(result.name).toBe('New Name');
    });

    it('should throw error if coupon not found', async () => {
      mockCouponRepository.findOne.mockResolvedValue(null);

      await expect(
        couponService.updateCoupon('nonexistent', { name: 'New' })
      ).rejects.toThrow('Coupon not found');
    });
  });
});
