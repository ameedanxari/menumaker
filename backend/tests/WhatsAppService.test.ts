import { jest, describe, beforeEach, it, expect, afterEach } from '@jest/globals';
import { WhatsAppService } from '../src/services/WhatsAppService';

// Mock Twilio
const mockCreate = jest.fn();
const mockTwilio = jest.fn(() => ({
  messages: {
    create: mockCreate,
  },
}));

jest.mock('twilio', () => mockTwilio);

// Mock database
jest.mock('../src/config/database', () => ({
  AppDataSource: {
    getRepository: jest.fn(),
  },
}));

describe('WhatsAppService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset environment variables
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('sendMessage', () => {
    it('should return error when WhatsApp is not configured', async () => {
      process.env.WHATSAPP_ENABLED = 'false';

      const result = await WhatsAppService.sendMessage('+919876543210', 'Test message');

      expect(result.success).toBe(false);
      expect(result.error).toBe('WhatsApp not configured');
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('should format phone number with whatsapp prefix', async () => {
      process.env.WHATSAPP_ENABLED = 'true';
      process.env.TWILIO_ACCOUNT_SID = 'test-sid';
      process.env.TWILIO_AUTH_TOKEN = 'test-token';

      mockCreate.mockResolvedValue({ sid: 'msg-123' } as any);

      const result = await WhatsAppService.sendMessage('+919876543210', 'Test message');

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('msg-123');
    });

    it('should not add whatsapp prefix if already present', async () => {
      process.env.WHATSAPP_ENABLED = 'true';
      process.env.TWILIO_ACCOUNT_SID = 'test-sid';
      process.env.TWILIO_AUTH_TOKEN = 'test-token';

      mockCreate.mockResolvedValue({ sid: 'msg-123' } as any);

      const result = await WhatsAppService.sendMessage('whatsapp:+919876543210', 'Test message');

      expect(result.success).toBe(true);
    });

    it('should handle Twilio API errors', async () => {
      process.env.WHATSAPP_ENABLED = 'true';
      process.env.TWILIO_ACCOUNT_SID = 'test-sid';
      process.env.TWILIO_AUTH_TOKEN = 'test-token';

      mockCreate.mockRejectedValue(new Error('Twilio API error'));

      const result = await WhatsAppService.sendMessage('+919876543210', 'Test message');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Twilio API error');
    });
  });

  describe('sendMessageWithRetry', () => {
    it('should succeed on first attempt', async () => {
      process.env.WHATSAPP_ENABLED = 'true';
      process.env.TWILIO_ACCOUNT_SID = 'test-sid';
      process.env.TWILIO_AUTH_TOKEN = 'test-token';

      mockCreate.mockResolvedValue({ sid: 'msg-123' } as any);

      const result = await WhatsAppService.sendMessageWithRetry('+919876543210', 'Test message');

      expect(result.success).toBe(true);
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and eventually succeed', async () => {
      process.env.WHATSAPP_ENABLED = 'true';
      process.env.TWILIO_ACCOUNT_SID = 'test-sid';
      process.env.TWILIO_AUTH_TOKEN = 'test-token';

      mockCreate
        .mockRejectedValueOnce(new Error('Network error') as any)
        .mockResolvedValueOnce({ sid: 'msg-123' } as any);

      const result = await WhatsAppService.sendMessageWithRetry(
        '+919876543210',
        'Test message',
        undefined,
        3
      );

      expect(result.success).toBe(true);
      expect(mockCreate).toHaveBeenCalledTimes(2);
    });

    it('should return error after max retries', async () => {
      process.env.WHATSAPP_ENABLED = 'true';
      process.env.TWILIO_ACCOUNT_SID = 'test-sid';
      process.env.TWILIO_AUTH_TOKEN = 'test-token';

      mockCreate.mockRejectedValue(new Error('Persistent error') as any);

      const result = await WhatsAppService.sendMessageWithRetry(
        '+919876543210',
        'Test message',
        undefined,
        2
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Persistent error');
      expect(mockCreate).toHaveBeenCalledTimes(2);
    });
  });

  describe('notifySellerNewOrder', () => {
    it('should send notification to seller', async () => {
      process.env.WHATSAPP_ENABLED = 'true';
      process.env.TWILIO_ACCOUNT_SID = 'test-sid';
      process.env.TWILIO_AUTH_TOKEN = 'test-token';

      const mockOrder = {
        id: 'order-123',
        business_id: 'business-123',
        customer_name: 'John Doe',
        customer_phone: '+919876543210',
        total_amount_cents: 50000,
        items: [
          { dish: { name: 'Pizza' }, quantity: 2 },
        ],
      };

      const mockBusiness = {
        id: 'business-123',
        name: 'Test Restaurant',
        settings: {
          whatsapp_enabled: true,
          whatsapp_notify_new_order: true,
          whatsapp_phone_number: '+919999999999',
        },
      };

      const { AppDataSource } = await import('../src/config/database');
      (AppDataSource.getRepository as jest.Mock).mockReturnValue({
        findOne: jest.fn().mockResolvedValue(mockBusiness as any) as any,
      });

      mockCreate.mockResolvedValue({ sid: 'msg-123' } as any);

      await WhatsAppService.notifySellerNewOrder(mockOrder as any);

      expect(mockCreate).toHaveBeenCalled();
    });

    it('should skip if WhatsApp is disabled for business', async () => {
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

      const { AppDataSource } = await import('../src/config/database');
      (AppDataSource.getRepository as jest.Mock).mockReturnValue({
        findOne: jest.fn().mockResolvedValue(mockBusiness as any) as any,
      });

      await WhatsAppService.notifySellerNewOrder(mockOrder as any);

      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('should skip if business not found', async () => {
      const mockOrder = {
        id: 'order-123',
        business_id: 'business-123',
      };

      const { AppDataSource } = await import('../src/config/database');
      (AppDataSource.getRepository as jest.Mock).mockReturnValue({
        findOne: jest.fn().mockResolvedValue(null as any),
      });

      await WhatsAppService.notifySellerNewOrder(mockOrder as any);

      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('should skip if no WhatsApp number configured', async () => {
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

      const { AppDataSource } = await import('../src/config/database');
      (AppDataSource.getRepository as jest.Mock).mockReturnValue({
        findOne: jest.fn().mockResolvedValue(mockBusiness as any) as any,
      });

      await WhatsAppService.notifySellerNewOrder(mockOrder as any);

      expect(mockCreate).not.toHaveBeenCalled();
    });
  });

  describe('notifyCustomerOrderStatus', () => {
    it('should send status update to customer', async () => {
      process.env.WHATSAPP_ENABLED = 'true';
      process.env.TWILIO_ACCOUNT_SID = 'test-sid';
      process.env.TWILIO_AUTH_TOKEN = 'test-token';

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
          whatsapp_customer_notifications: true,
        },
      };

      const { AppDataSource } = await import('../src/config/database');
      (AppDataSource.getRepository as jest.Mock).mockReturnValue({
        findOne: jest.fn().mockResolvedValue(mockBusiness as any) as any,
      });

      mockCreate.mockResolvedValue({ sid: 'msg-123' } as any);

      await WhatsAppService.notifyCustomerOrderStatus(mockOrder as any, 'confirmed');

      expect(mockCreate).toHaveBeenCalled();
    });

    it('should skip if customer notifications disabled', async () => {
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

      const { AppDataSource } = await import('../src/config/database');
      (AppDataSource.getRepository as jest.Mock).mockReturnValue({
        findOne: jest.fn().mockResolvedValue(mockBusiness as any) as any,
      });

      await WhatsAppService.notifyCustomerOrderStatus(mockOrder as any, 'confirmed');

      expect(mockCreate).not.toHaveBeenCalled();
    });
  });

  describe('message templates', () => {
    it('should format new order message correctly', async () => {
      process.env.WHATSAPP_ENABLED = 'true';
      process.env.TWILIO_ACCOUNT_SID = 'test-sid';
      process.env.TWILIO_AUTH_TOKEN = 'test-token';
      process.env.FRONTEND_URL = 'https://menumaker.app';

      const mockOrder = {
        id: 'order-123456789',
        business_id: 'business-123',
        customer_name: 'John Doe',
        customer_phone: '+919876543210',
        total_amount_cents: 50000,
        items: [
          { dish: { name: 'Pizza' }, quantity: 2 },
          { dish: { name: 'Burger' }, quantity: 1 },
        ],
      };

      const mockBusiness = {
        id: 'business-123',
        name: 'Test Restaurant',
        settings: {
          whatsapp_enabled: true,
          whatsapp_notify_new_order: true,
          whatsapp_phone_number: '+919999999999',
        },
      };

      const { AppDataSource } = await import('../src/config/database');
      (AppDataSource.getRepository as jest.Mock).mockReturnValue({
        findOne: jest.fn().mockResolvedValue(mockBusiness as any) as any,
      });

      mockCreate.mockImplementation((params: any) => {
        expect(params.body).toContain('New Order');
        expect(params.body).toContain('John Doe');
        expect(params.body).toContain('Pizza');
        return Promise.resolve({ sid: 'msg-123' });
      });

      await WhatsAppService.notifySellerNewOrder(mockOrder as any);

      expect(mockCreate).toHaveBeenCalled();
    });

    it('should format order status message correctly', async () => {
      process.env.WHATSAPP_ENABLED = 'true';
      process.env.TWILIO_ACCOUNT_SID = 'test-sid';
      process.env.TWILIO_AUTH_TOKEN = 'test-token';

      const mockOrder = {
        id: 'order-123456789',
        business_id: 'business-123',
        customer_phone: '+919876543210',
      };

      const mockBusiness = {
        id: 'business-123',
        name: 'Test Restaurant',
        settings: {
          whatsapp_enabled: true,
          whatsapp_customer_notifications: true,
        },
      };

      const { AppDataSource } = await import('../src/config/database');
      (AppDataSource.getRepository as jest.Mock).mockReturnValue({
        findOne: jest.fn().mockResolvedValue(mockBusiness as any) as any,
      });

      mockCreate.mockImplementation((params: any) => {
        expect(params.body).toContain('confirmed');
        return Promise.resolve({ sid: 'msg-123' });
      });

      await WhatsAppService.notifyCustomerOrderStatus(mockOrder as any, 'confirmed');

      expect(mockCreate).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle database errors gracefully', async () => {
      const mockOrder = {
        id: 'order-123',
        business_id: 'business-123',
      };

      const { AppDataSource } = await import('../src/config/database');
      (AppDataSource.getRepository as jest.Mock).mockReturnValue({
        findOne: jest.fn().mockRejectedValue(new Error('Database error') as any) as any,
      });

      // Should not throw
      await expect(
        WhatsAppService.notifySellerNewOrder(mockOrder as any)
      ).resolves.not.toThrow();
    });

    it('should handle missing settings gracefully', async () => {
      const mockOrder = {
        id: 'order-123',
        business_id: 'business-123',
      };

      const mockBusiness = {
        id: 'business-123',
        name: 'Test Restaurant',
        settings: null,
      };

      const { AppDataSource } = await import('../src/config/database');
      (AppDataSource.getRepository as jest.Mock).mockReturnValue({
        findOne: jest.fn().mockResolvedValue(mockBusiness as any) as any,
      });

      await WhatsAppService.notifySellerNewOrder(mockOrder as any);

      expect(mockCreate).not.toHaveBeenCalled();
    });
  });
});
