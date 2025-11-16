import { AppDataSource } from '../config/database.js';
import { Order } from '../models/Order.js';
import { SavedCart } from '../models/SavedCart.js';
import { MoreThan } from 'typeorm';

/**
 * Reorder Service (Phase 2.7)
 *
 * Handles customer re-order flow and saved carts.
 *
 * Features:
 * - Fetch previous orders by phone (last 90 days)
 * - Quick re-order (duplicate previous order)
 * - Save cart presets ("My Weekly Tiffin")
 * - Load saved carts for quick ordering
 * - Analytics tracking (re-order rate)
 */

export interface PreviousOrder {
  id: string;
  business_id: string;
  customer_name: string;
  customer_phone: string;
  total_cents: number;
  items: Array<{
    dish_id: string;
    dish_name: string;
    quantity: number;
    unit_price_cents: number;
  }>;
  created_at: Date;
  status: string;
}

export interface SavedCartItem {
  dish_id: string;
  dish_name: string;
  quantity: number;
  price_cents: number;
}

export interface SaveCartParams {
  customer_phone: string;
  customer_email?: string;
  customer_name?: string;
  cart_name: string;
  cart_items: SavedCartItem[];
}

/**
 * ReorderService
 */
export class ReorderService {
  /**
   * Get previous orders for customer (by phone)
   * Returns orders from last 90 days
   */
  static async getPreviousOrders(
    customer_phone: string,
    limit: number = 10
  ): Promise<PreviousOrder[]> {
    const orderRepo = AppDataSource.getRepository(Order);

    // Calculate 90 days ago
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    // Find orders by phone (last 90 days)
    const orders = await orderRepo.find({
      where: {
        customer_phone,
        created_at: MoreThan(ninetyDaysAgo),
      },
      relations: ['items', 'items.dish'],
      order: { created_at: 'DESC' },
      take: limit,
    });

    // Format response
    const previousOrders: PreviousOrder[] = orders.map((order) => ({
      id: order.id,
      business_id: order.business_id,
      customer_name: order.customer_name,
      customer_phone: order.customer_phone,
      total_cents: order.total_cents,
      items: order.items.map((item) => ({
        dish_id: item.dish_id,
        dish_name: item.dish?.name || item.dish_name,
        quantity: item.quantity,
        unit_price_cents: item.unit_price_cents,
      })),
      created_at: order.created_at,
      status: order.status,
    }));

    return previousOrders;
  }

  /**
   * Quick re-order: Duplicate a previous order
   * Returns cart items for frontend to use
   */
  static async quickReorder(order_id: string): Promise<SavedCartItem[]> {
    const orderRepo = AppDataSource.getRepository(Order);

    const order = await orderRepo.findOne({
      where: { id: order_id },
      relations: ['items', 'items.dish'],
    });

    if (!order) {
      throw new Error('Order not found');
    }

    // Convert order items to cart items
    const cartItems: SavedCartItem[] = order.items.map((item) => ({
      dish_id: item.dish_id,
      dish_name: item.dish?.name || item.dish_name,
      quantity: item.quantity,
      price_cents: item.unit_price_cents,
    }));

    console.log(`🔁 Quick re-order: ${order.id} (${cartItems.length} items)`);

    return cartItems;
  }

  /**
   * Save cart preset for customer
   * E.g., "My Weekly Tiffin", "Family Dinner"
   */
  static async saveCart(params: SaveCartParams): Promise<SavedCart> {
    const savedCartRepo = AppDataSource.getRepository(SavedCart);

    // Calculate total
    const total_cents = params.cart_items.reduce(
      (sum, item) => sum + item.price_cents * item.quantity,
      0
    );

    // Check if cart with same name already exists
    const existing = await savedCartRepo.findOne({
      where: {
        customer_phone: params.customer_phone,
        cart_name: params.cart_name,
      },
    });

    if (existing) {
      // Update existing cart
      existing.cart_items = JSON.stringify(params.cart_items);
      existing.total_cents = total_cents;
      existing.customer_email = params.customer_email;
      existing.customer_name = params.customer_name;

      await savedCartRepo.save(existing);

      console.log(`✏️  Saved cart updated: "${params.cart_name}" (${params.cart_items.length} items)`);

      return existing;
    }

    // Create new saved cart
    const savedCart = savedCartRepo.create({
      customer_phone: params.customer_phone,
      customer_email: params.customer_email,
      customer_name: params.customer_name,
      cart_name: params.cart_name,
      cart_items: JSON.stringify(params.cart_items),
      total_cents,
      times_used: 0,
    });

    await savedCartRepo.save(savedCart);

    console.log(`💾 Saved cart created: "${params.cart_name}" (${params.cart_items.length} items)`);

    return savedCart;
  }

  /**
   * Get saved carts for customer
   */
  static async getSavedCarts(customer_phone: string): Promise<SavedCart[]> {
    const savedCartRepo = AppDataSource.getRepository(SavedCart);

    const carts = await savedCartRepo.find({
      where: { customer_phone },
      order: { last_used_at: 'DESC' },
    });

    return carts;
  }

  /**
   * Load saved cart and return items
   */
  static async loadSavedCart(cart_id: string): Promise<SavedCartItem[]> {
    const savedCartRepo = AppDataSource.getRepository(SavedCart);

    const cart = await savedCartRepo.findOne({ where: { id: cart_id } });

    if (!cart) {
      throw new Error('Saved cart not found');
    }

    // Update usage stats
    cart.times_used += 1;
    cart.last_used_at = new Date();
    await savedCartRepo.save(cart);

    // Parse and return cart items
    const cartItems: SavedCartItem[] = JSON.parse(cart.cart_items);

    console.log(`🛒 Loaded saved cart: "${cart.cart_name}" (used ${cart.times_used} times)`);

    return cartItems;
  }

  /**
   * Delete saved cart
   */
  static async deleteSavedCart(cart_id: string, customer_phone: string): Promise<void> {
    const savedCartRepo = AppDataSource.getRepository(SavedCart);

    const cart = await savedCartRepo.findOne({
      where: {
        id: cart_id,
        customer_phone, // Security: only delete if phone matches
      },
    });

    if (!cart) {
      throw new Error('Saved cart not found or unauthorized');
    }

    await savedCartRepo.remove(cart);

    console.log(`🗑️  Deleted saved cart: "${cart.cart_name}"`);
  }

  /**
   * Get re-order analytics for a business
   * Calculates % of orders from repeat customers
   */
  static async getReorderAnalytics(business_id: string, days: number = 30): Promise<{
    total_orders: number;
    repeat_orders: number;
    reorder_rate: number;
    unique_customers: number;
    repeat_customers: number;
  }> {
    const orderRepo = AppDataSource.getRepository(Order);

    // Calculate date range
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get all orders for business in date range
    const orders = await orderRepo.find({
      where: {
        business_id,
        created_at: MoreThan(startDate),
      },
      select: ['id', 'customer_phone', 'created_at'],
    });

    const total_orders = orders.length;

    // Group orders by customer phone
    const customerOrders = new Map<string, number>();

    orders.forEach((order) => {
      const phone = order.customer_phone;
      customerOrders.set(phone, (customerOrders.get(phone) || 0) + 1);
    });

    // Count repeat orders (customer has >1 order)
    let repeat_orders = 0;
    customerOrders.forEach((count) => {
      if (count > 1) {
        repeat_orders += count - 1; // Count all orders except first
      }
    });

    const unique_customers = customerOrders.size;
    const repeat_customers = Array.from(customerOrders.values()).filter((count) => count > 1).length;
    const reorder_rate = total_orders > 0 ? repeat_orders / total_orders : 0;

    console.log(
      `📊 Re-order analytics (${days} days): ${reorder_rate.toFixed(2)}% re-order rate`
    );

    return {
      total_orders,
      repeat_orders,
      reorder_rate,
      unique_customers,
      repeat_customers,
    };
  }

  /**
   * Check if customer is a returning customer
   */
  static async isReturningCustomer(customer_phone: string, business_id: string): Promise<boolean> {
    const orderRepo = AppDataSource.getRepository(Order);

    const count = await orderRepo.count({
      where: {
        customer_phone,
        business_id,
      },
    });

    return count > 0;
  }
}
