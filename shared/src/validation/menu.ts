import { z } from 'zod';

const MenuBaseSchema = z.object({
  title: z.string().min(1, 'Menu title required').max(255),
  start_date: z.string().or(z.date()).transform((val) => new Date(val)),
  end_date: z.string().or(z.date()).transform((val) => new Date(val)),
});

export const MenuCreateSchema = MenuBaseSchema.refine(data => data.end_date > data.start_date, {
  message: 'End date must be after start date',
  path: ['end_date'],
});

export const MenuUpdateSchema = MenuBaseSchema.partial();

export const MenuItemSchema = z.object({
  dish_id: z.string().uuid('Invalid dish ID'),
  price_override_cents: z.number().int().min(0).optional(),
  position: z.number().int().min(0).default(0),
  is_available: z.boolean().default(true),
});

export const MenuPublishSchema = z.object({
  items: z.array(MenuItemSchema).min(1, 'Menu must have at least one item'),
});

export type MenuCreateInput = z.infer<typeof MenuCreateSchema>;
export type MenuUpdateInput = z.infer<typeof MenuUpdateSchema>;
export type MenuItemInput = z.infer<typeof MenuItemSchema>;
export type MenuPublishInput = z.infer<typeof MenuPublishSchema>;
