import { jest, describe, beforeEach, it, expect } from '@jest/globals';
import { WhatsAppService } from '../src/services/WhatsAppService';

// Mock database
const mockGetRepository = jest.fn();
jest.mock('../src/config/database', () => ({
  AppDataSource: {
    getRepository: mockGetRepository,
  },
}));

describe('WhatsAppService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Configuration Validation', () => {
    it('should handle missing WhatsApp configuration gracefully', async () => {
      const mockOrder = {
        id: 'order-123',
        business_id: 'business-123',
      };

      const mockBusiness = {
        id: 'business-123',
        name: 'Test Restaurant',
        settings: {
          whatsapp_enabled: false,
          whatsapp_notify_new_order: true,
          whatsapp_phone_number: '+919999999999',
        },
      };

      mockGetRepository.mockReturnValue({
        findOne: jest.fn().mockResolvedValue(mockBusiness as any) as any,
      });

      // Should not throw error
      await expect(
        WhatsAppService.notifySellerNewOrder(mockOrder as any)
      ).resolves.not.toThrow();
    });

    it('should skip notification if business not found', async () => {
      const mockOrder = {
        id: 'order-123',
        business_id: 'business-123',
      };

      mockGetRepository.mockReturnValue({
        findOne: jest.fn().mockResolvedValue(null as any),
      });

      await expect(
        WhatsAppService.notifySellerNewOrder(mockOrder as any)
      ).resolves.not.toThrow();
    });

    it('should skip notification if no WhatsApp number configured', async () => {
      const mockOrder = {
        id: 'order-123',
        business_id: 'business-123',
      };

      const mockBusiness = {
        id: 'business-123',
        name: 'Test Restaurant',
        settings: {
          whatsapp_enabled: true,
          whatsapp_notify_new_order: true,
          whatsapp_phone_number: null,
        },
      };

      mockGetRepository.mockReturnValue({
        findOne: jest.fn().mockResolvedValue(mockBusiness as any) as any,
      });

      await expect(
        WhatsAppService.notifySellerNewOrder(mockOrder as any)
      ).resolves.not.toThrow();
    });

    it('should skip notification if settings are null', async () => {
      const mockOrder = {
        id: 'order-123',
        business_id: 'business-123',
      };

      const mockBusiness = {
        id: 'business-123',
        name: 'Test Restaurant',
        settings: null,
      };

      mockGetRepository.mockReturnValue({
        findOne: jest.fn().mockResolvedValue(mockBusiness as any) as any,
      });

      await expect(
        WhatsAppService.notifySellerNewOrder(mockOrder as any)
      ).resolves.not.toThrow();
    });
  });

  describe('Customer Notifications', () => {
    it('should skip customer notification if disabled', async () => {
      const mockOrder = {
        id: 'order-123',
        business_id: 'business-123',
        customer_phone: '+919876543210',
      };

      const mockBusiness = {
        id: 'business-123',
        name: 'Test Restaurant',
        settings: {
          whatsapp_enabled: true,
          whatsapp_customer_notifications: false,
        },
      };

      mockGetRepository.mockReturnValue({
        findOne: jest.fn().mockResolvedValue(mockBusiness as any) as any,
      });

      await expect(
        WhatsAppService.notifyCustomerOrderStatus(mockOrder as any, 'confirmed')
      ).resolves.not.toThrow();
    });

    it('should handle missing customer phone gracefully', async () => {
      const mockOrder = {
        id: 'order-123',
        business_id: 'business-123',
        customer_phone: null,
      };

      const mockBusiness = {
        id: 'business-123',
        name: 'Test Restaurant',
        settings: {
          whatsapp_enabled: true,
          whatsapp_customer_notifications: true,
        },
      };

      mockGetRepository.mockReturnValue({
        findOne: jest.fn().mockResolvedValue(mockBusiness as any) as any,
      });

      await expect(
        WhatsAppService.notifyCustomerOrderStatus(mockOrder as any, 'confirmed')
      ).resolves.not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      const mockOrder = {
        id: 'order-123',
        business_id: 'business-123',
      };

      mockGetRepository.mockReturnValue({
        findOne: jest.fn().mockRejectedValue(new Error('Database error') as any) as any,
      });

      // Should not throw
      await expect(
        WhatsAppService.notifySellerNewOrder(mockOrder as any)
      ).resolves.not.toThrow();
    });

    it('should handle null order gracefully', async () => {
      await expect(
        WhatsAppService.notifySellerNewOrder(null as any)
      ).resolves.not.toThrow();
    });

    it('should handle undefined business_id gracefully', async () => {
      const mockOrder = {
        id: 'order-123',
        business_id: undefined,
      };

      await expect(
        WhatsAppService.notifySellerNewOrder(mockOrder as any)
      ).resolves.not.toThrow();
    });
  });

  describe('Integration Points', () => {
    it('should handle business lookup correctly', async () => {
      const mockOrder = {
        id: 'order-123',
        business_id: 'business-123',
      };

      const findOneMock = jest.fn().mockResolvedValue({
        id: 'business-123',
        name: 'Test Restaurant',
        settings: {
          whatsapp_enabled: false,
        },
      } as any);

      mockGetRepository.mockReturnValue({
        findOne: findOneMock as any,
      });

      await WhatsAppService.notifySellerNewOrder(mockOrder as any);

      expect(mockGetRepository).toHaveBeenCalled();
      expect(findOneMock).toHaveBeenCalledWith({
        where: { id: 'business-123' },
        relations: ['settings'],
      });
    });

    it('should handle concurrent notifications', async () => {
      const mockOrders = Array.from({ length: 5 }, (_, i) => ({
        id: `order-${i}`,
        business_id: 'business-123',
      }));

      const mockBusiness = {
        id: 'business-123',
        name: 'Test Restaurant',
        settings: {
          whatsapp_enabled: false,
        },
      };

      mockGetRepository.mockReturnValue({
        findOne: jest.fn().mockResolvedValue(mockBusiness as any) as any,
      });

      const results = await Promise.all(
        mockOrders.map(order => WhatsAppService.notifySellerNewOrder(order as any))
      );

      expect(results).toHaveLength(5);
    });
  });
});
