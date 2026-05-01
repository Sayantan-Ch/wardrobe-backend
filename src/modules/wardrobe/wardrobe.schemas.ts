import { z } from 'zod';

export const createWardrobeItemSchema = z.object({
  name: z.string().trim().min(1, 'name is required'),
  category: z.string().trim().min(1, 'category is required'),
  color: z.string().trim().min(1).optional(),
  image_url: z.url().optional(),
  notes: z.string().trim().min(1).optional(),
});

export const updateWardrobeItemSchema = createWardrobeItemSchema.partial();

export const wardrobeListQuerySchema = z.object({
  category: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

export const wardrobeItemIdParamsSchema = z.object({
  id: z.uuid(),
});

export type CreateWardrobeItemInput = z.infer<typeof createWardrobeItemSchema>;
export type UpdateWardrobeItemInput = z.infer<typeof updateWardrobeItemSchema>;
export type WardrobeListQueryInput = z.infer<typeof wardrobeListQuerySchema>;
