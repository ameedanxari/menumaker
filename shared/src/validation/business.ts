import { z } from 'zod';

export const BusinessCreateSchema = z.object({
  name: z.string().min(1, 'Business name required').max(255),
  description: z.string().max(1000).optional(),
  logo_url: z.string().url('Invalid logo URL').optional(),
  primary_color: z.string().regex(/^#[0-9A-F]{6}$/i, 'Invalid hex color').default('#000000'),
  locale: z.string().length(2).default('en'),
  timezone: z.string().default('Asia/Kolkata'),
});

export const BusinessUpdateSchema = BusinessCreateSchema.partial();

export const BusinessSettingsSchema = z.object({
  delivery_type: z.enum(['flat', 'distance', 'free']),
  delivery_fee_cents: z.number().int().min(0),
  delivery_base_fee_cents: z.number().int().min(0).optional(),
  delivery_per_km_cents: z.number().int().min(0).optional(),
  min_order_free_delivery_cents: z.number().int().min(0).optional(),
  distance_rounding: z.enum(['round', 'ceil', 'floor']).default('round'),
  payment_method: z.enum(['cash', 'bank_transfer', 'upi', 'other']),
  payment_instructions: z.string().max(1000).optional(),
  currency: z.string().length(3).default('INR'),
  auto_confirm_orders: z.boolean().default(false),
  enable_customer_notes: z.boolean().default(true),
});

export type BusinessCreateInput = z.infer<typeof BusinessCreateSchema>;
export type BusinessUpdateInput = z.infer<typeof BusinessUpdateSchema>;
export type BusinessSettingsInput = z.infer<typeof BusinessSettingsSchema>;
