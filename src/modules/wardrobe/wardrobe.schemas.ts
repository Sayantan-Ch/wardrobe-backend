import { z } from 'zod';
import {
  CLOTHING_CATEGORIES,
  CLOTHING_COLORS,
  CLOTHING_FITS,
  CLOTHING_FORMALITIES,
  CLOTHING_SUBCATEGORIES,
  COLOR_TONES,
  SUBCATEGORY_BY_CATEGORY,
} from './wardrobe.enums';

const categorySchema = z.enum(CLOTHING_CATEGORIES);
const subcategorySchema = z.enum(CLOTHING_SUBCATEGORIES);

const enforceCategorySubcategory = (data: { category: z.infer<typeof categorySchema>; subcategory: z.infer<typeof subcategorySchema> }, ctx: z.RefinementCtx) => {
  const allowedSubcategories = SUBCATEGORY_BY_CATEGORY[data.category];

  if (!allowedSubcategories.includes(data.subcategory as never)) {
    ctx.addIssue({
      code: 'custom',
      path: ['subcategory'],
      message: `subcategory '${data.subcategory}' is not valid for category '${data.category}'`,
    });
  }
};

export const createWardrobeItemSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    category: categorySchema,
    subcategory: subcategorySchema,
    color: z.enum(CLOTHING_COLORS),
    color_tone: z.enum(COLOR_TONES).optional(),
    formality: z.enum(CLOTHING_FORMALITIES),
    fit: z.enum(CLOTHING_FITS).optional(),
    image_url: z.url(),
    notes: z.string().trim().min(1).optional(),
  })
  .superRefine(enforceCategorySubcategory);

export const updateWardrobeItemSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    category: categorySchema.optional(),
    subcategory: subcategorySchema.optional(),
    color: z.enum(CLOTHING_COLORS).optional(),
    color_tone: z.enum(COLOR_TONES).nullable().optional(),
    formality: z.enum(CLOTHING_FORMALITIES).optional(),
    fit: z.enum(CLOTHING_FITS).nullable().optional(),
    image_url: z.url().optional(),
    notes: z.string().trim().min(1).nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.category && data.subcategory) {
      enforceCategorySubcategory(
        {
          category: data.category,
          subcategory: data.subcategory,
        },
        ctx,
      );
    }
  });

export const wardrobeListQuerySchema = z.object({
  category: categorySchema.optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

export const wardrobeItemIdParamsSchema = z.object({
  id: z.uuid(),
});

export type CreateWardrobeItemInput = z.infer<typeof createWardrobeItemSchema>;
export type UpdateWardrobeItemInput = z.infer<typeof updateWardrobeItemSchema>;
export type WardrobeListQueryInput = z.infer<typeof wardrobeListQuerySchema>;
