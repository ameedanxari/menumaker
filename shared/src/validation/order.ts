import { z } from 'zod';

export const OrderItemSchema = z.object({
  dish_id: z.string().uuid('Invalid dish ID'),
  quantity: z.number().int().min(1, 'Quantity must be at least 1').max(100, 'Maximum quantity is 100'),
});

export const OrderCreateSchema = z.object({
  menu_id: z.string().uuid('Invalid menu ID'),
  customer_name: z.string().min(1, 'Name required').max(255),
  customer_phone: z.string()
    .regex(/^[+]?[0-9]{1,15}$/, 'Phone must be E.164 format or local (up to 15 digits)'),
  customer_email: z.string().email('Invalid email').optional(),
  delivery_type: z.enum(['pickup', 'delivery'], {
    errorMap: () => ({ message: 'Choose pickup or delivery' })
  }),
  delivery_address: z.string().max(1000).optional(),
  items: z.array(OrderItemSchema).min(1, 'Order must have at least one item').max(50, 'Maximum 50 items per order'),
  notes: z.string().max(500).optional(),
}).refine(
  data => data.delivery_type === 'pickup' || data.delivery_address,
  {
    message: 'Delivery address required for delivery orders',
    path: ['delivery_address']
  }
).refine(
  data => {
    // Check for duplicate dish IDs
    const dishIds = data.items.map(item => item.dish_id);
    const uniqueDishIds = new Set(dishIds);
    return dishIds.length === uniqueDishIds.size;
  },
  {
    message: 'Duplicate dishes found. Please combine quantities for the same dish.',
    path: ['items']
  }
);

export const OrderUpdateSchema = z.object({
  order_status: z.enum(['pending', 'confirmed', 'ready', 'fulfilled', 'cancelled']).optional(),
  payment_status: z.enum(['unpaid', 'paid']).optional(),
  notes: z.string().max(500).optional(),
});

export type OrderCreateInput = z.infer<typeof OrderCreateSchema>;
export type OrderUpdateInput = z.infer<typeof OrderUpdateSchema>;
export type OrderItemInput = z.infer<typeof OrderItemSchema>;
