import { z } from 'zod';

export const DishCreateSchema = z.object({
  name: z.string().min(1, 'Dish name required').max(255),
  description: z.string().min(50, 'Description must be at least 50 characters').max(500),
  price_cents: z.number().int().min(0, 'Price must be positive'),
  currency: z.string().length(3).default('INR'),
  allergen_tags: z.array(z.string()).default([]),
  image_urls: z.array(z.string().url()).default([]),
  is_available: z.boolean().default(true),
  position: z.number().int().min(0).default(0),
  common_dish_id: z.string().uuid().optional(),
  category_id: z.string().uuid().optional(),
});

export const DishUpdateSchema = DishCreateSchema.partial();

export type DishCreateInput = z.infer<typeof DishCreateSchema>;
export type DishUpdateInput = z.infer<typeof DishUpdateSchema>;
