import Twilio from 'twilio';
import { AppDataSource } from '../config/database.js';
import { OrderNotification } from '../models/OrderNotification.js';
import { Order } from '../models/Order.js';
import { Business } from '../models/Business.js';
import { BusinessSettings } from '../models/BusinessSettings.js';

// Environment variables
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || '';
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || '';
const TWILIO_WHATSAPP_NUMBER = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886';
const WHATSAPP_ENABLED = process.env.WHATSAPP_ENABLED === 'true';

// Initialize Twilio client
let twilioClient: ReturnType<typeof Twilio> | null = null;

if (WHATSAPP_ENABLED && TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
  twilioClient = Twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  console.log('✅ Twilio WhatsApp client initialized');
} else {
  console.warn('⚠️  WhatsApp notifications disabled (missing Twilio credentials)');
}

/**
 * Message Templates
 */
const MESSAGE_TEMPLATES = {
  NEW_ORDER_SELLER: (order: Order, businessName: string): string => {
    const items = order.items
      .map((item) => `${item.dish?.name || 'Item'} × ${item.quantity}`)
      .join(', ');
    const total = `Rs. ${(order.total_amount_cents / 100).toFixed(2)}`;

    return `🔔 *New Order #${order.id.slice(0, 8)}*\n\n` +
      `From: ${order.customer_name}\n` +
      `Phone: ${order.customer_phone}\n\n` +
      `Items: ${items}\n` +
      `Total: ${total}\n\n` +
      `View order: ${process.env.FRONTEND_URL}/dashboard/orders/${order.id}`;
  },

  ORDER_STATUS_CUSTOMER: (order: Order, status: string, businessName: string): string => {
    const statusMessages: Record<string, string> = {
      confirmed: '✅ Your order has been confirmed!',
      preparing: '👨‍🍳 Your order is being prepared',
      ready: '🎉 Your order is ready!',
      out_for_delivery: '🚗 Your order is out for delivery',
      delivered: '✨ Your order has been delivered',
      completed: '✅ Order completed',
    };

    const message = statusMessages[status] || `Order status: ${status}`;

    return `${message}\n\n` +
      `Order #${order.id.slice(0, 8)}\n` +
      `From: ${businessName}\n\n` +
      `Track order: ${process.env.FRONTEND_URL}/orders/${order.id}`;
  },

  PAYMENT_RECEIVED: (order: Order, businessName: string): string => {
    const amount = `Rs. ${(order.total_amount_cents / 100).toFixed(2)}`;

    return `💰 *Payment Received*\n\n` +
      `Order #${order.id.slice(0, 8)}\n` +
      `Amount: ${amount}\n` +
      `Customer: ${order.customer_name}\n\n` +
      `Thank you for using MenuMaker!`;
  },
};

/**
 * WhatsApp Service for sending notifications via Twilio
 */
export class WhatsAppService {
  /**
   * Send WhatsApp message to a phone number
   */
  static async sendMessage(
    to: string,
    message: string,
    orderId?: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!WHATSAPP_ENABLED || !twilioClient) {
      console.warn('WhatsApp disabled, skipping message send');
      return { success: false, error: 'WhatsApp not configured' };
    }

    try {
      // Format phone number for WhatsApp (add whatsapp: prefix)
      const formattedTo = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;

      // Send message via Twilio
      const twilioMessage = await twilioClient.messages.create({
        from: TWILIO_WHATSAPP_NUMBER,
        to: formattedTo,
        body: message,
      });

      console.log(`✅ WhatsApp sent to ${to}: ${twilioMessage.sid}`);

      // Record notification in database
      if (orderId) {
        await this.recordNotification(orderId, to, 'sent', twilioMessage.sid);
      }

      return { success: true, messageId: twilioMessage.sid };
    } catch (error: any) {
      console.error('❌ WhatsApp send failed:', error.message);

      // Record failed notification
      if (orderId) {
        await this.recordNotification(orderId, to, 'failed', undefined, error.message);
      }

      return { success: false, error: error.message };
    }
  }

  /**
   * Send WhatsApp message with retry logic (3 attempts with exponential backoff)
   */
  static async sendMessageWithRetry(
    to: string,
    message: string,
    orderId?: string,
    maxRetries: number = 3
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    let lastError: string = '';

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const result = await this.sendMessage(to, message, orderId);

      if (result.success) {
        return result;
      }

      lastError = result.error || 'Unknown error';

      if (attempt < maxRetries) {
        // Exponential backoff: 2s, 4s, 8s
        const delayMs = Math.pow(2, attempt) * 1000;
        console.log(`⏳ Retrying WhatsApp (attempt ${attempt + 1}/${maxRetries}) in ${delayMs}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    console.error(`❌ WhatsApp failed after ${maxRetries} attempts: ${lastError}`);
    return { success: false, error: lastError };
  }

  /**
   * Notify seller of new order
   */
  static async notifySellerNewOrder(order: Order): Promise<void> {
    try {
      // Load business with settings
      const business = await AppDataSource.getRepository(Business).findOne({
        where: { id: order.business_id },
        relations: ['settings'],
      });

      if (!business || !business.settings) {
        console.log('Business or settings not found, skipping WhatsApp');
        return;
      }

      const settings = business.settings;

      // Check if WhatsApp is enabled and seller wants new order notifications
      if (!settings.whatsapp_enabled || !settings.whatsapp_notify_new_order) {
        console.log('WhatsApp notifications disabled for this business');
        return;
      }

      if (!settings.whatsapp_phone_number) {
        console.log('No WhatsApp number configured for business');
        return;
      }

      // Send notification
      const message = MESSAGE_TEMPLATES.NEW_ORDER_SELLER(order, business.name);
      await this.sendMessageWithRetry(
        settings.whatsapp_phone_number,
        message,
        order.id
      );
    } catch (error: any) {
      console.error('Error sending seller notification:', error.message);
    }
  }

  /**
   * Notify customer of order status change
   */
  static async notifyCustomerOrderStatus(
    order: Order,
    status: string
  ): Promise<void> {
    try {
      // Load business with settings
      const business = await AppDataSource.getRepository(Business).findOne({
        where: { id: order.business_id },
        relations: ['settings'],
      });

      if (!business || !business.settings) {
        console.log('Business or settings not found');
        return;
      }

      const settings = business.settings;

      // Check if customer notifications are enabled
      if (!settings.whatsapp_enabled || !settings.whatsapp_customer_notifications) {
        console.log('Customer WhatsApp notifications disabled');
        return;
      }

      // Check if customer phone is valid
      if (!order.customer_phone) {
        console.log('No customer phone number');
        return;
      }

      // Send notification
      const message = MESSAGE_TEMPLATES.ORDER_STATUS_CUSTOMER(order, status, business.name);
      await this.sendMessageWithRetry(order.customer_phone, message, order.id);
    } catch (error: any) {
      console.error('Error sending customer notification:', error.message);
    }
  }

  /**
   * Notify seller of payment received
   */
  static async notifySellerPaymentReceived(order: Order): Promise<void> {
    try {
      // Load business with settings
      const business = await AppDataSource.getRepository(Business).findOne({
        where: { id: order.business_id },
        relations: ['settings'],
      });

      if (!business || !business.settings) {
        console.log('Business or settings not found');
        return;
      }

      const settings = business.settings;

      // Check if payment notifications are enabled
      if (!settings.whatsapp_enabled || !settings.whatsapp_notify_payment) {
        console.log('Payment WhatsApp notifications disabled');
        return;
      }

      if (!settings.whatsapp_phone_number) {
        console.log('No WhatsApp number configured');
        return;
      }

      // Send notification
      const message = MESSAGE_TEMPLATES.PAYMENT_RECEIVED(order, business.name);
      await this.sendMessageWithRetry(
        settings.whatsapp_phone_number,
        message,
        order.id
      );
    } catch (error: any) {
      console.error('Error sending payment notification:', error.message);
    }
  }

  /**
   * Record notification in database
   */
  private static async recordNotification(
    orderId: string,
    recipient: string,
    status: 'sent' | 'failed',
    messageId?: string,
    errorMessage?: string
  ): Promise<void> {
    try {
      const notificationRepo = AppDataSource.getRepository(OrderNotification);

      const notification = notificationRepo.create({
        order_id: orderId,
        notification_type: 'whatsapp',
        recipient,
        status,
        sent_at: status === 'sent' ? new Date() : undefined,
        error_message: errorMessage,
      });

      await notificationRepo.save(notification);
    } catch (error: any) {
      console.error('Error recording notification:', error.message);
    }
  }

  /**
   * Get WhatsApp delivery stats for a business
   */
  static async getDeliveryStats(businessId: string): Promise<{
    total: number;
    sent: number;
    failed: number;
    deliveryRate: number;
  }> {
    const notificationRepo = AppDataSource.getRepository(OrderNotification);

    const total = await notificationRepo.count({
      where: {
        notification_type: 'whatsapp',
        order: { business_id: businessId },
      },
    });

    const sent = await notificationRepo.count({
      where: {
        notification_type: 'whatsapp',
        status: 'sent',
        order: { business_id: businessId },
      },
    });

    const failed = await notificationRepo.count({
      where: {
        notification_type: 'whatsapp',
        status: 'failed',
        order: { business_id: businessId },
      },
    });

    const deliveryRate = total > 0 ? (sent / total) * 100 : 0;

    return { total, sent, failed, deliveryRate };
  }

  /**
   * Test WhatsApp connection
   */
  static async testConnection(phoneNumber: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    if (!WHATSAPP_ENABLED || !twilioClient) {
      return { success: false, error: 'WhatsApp not configured' };
    }

    try {
      const testMessage = '🧪 *MenuMaker Test Message*\n\nYour WhatsApp integration is working!';
      const result = await this.sendMessage(phoneNumber, testMessage);
      return result;
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}
