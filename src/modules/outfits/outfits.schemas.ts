import { z } from 'zod';

export const createOutfitSchema = z.object({
  top_id: z.uuid(),
  bottom_id: z.uuid(),
  footwear_id: z.uuid().nullable().optional(),
  context: z.string().trim().min(1).optional(),
  llm_reason: z.string().trim().min(1).optional(),
});

export const outfitsListQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(50),
});

export type CreateOutfitInput = z.infer<typeof createOutfitSchema>;
export type OutfitsListQueryInput = z.infer<typeof outfitsListQuerySchema>;
