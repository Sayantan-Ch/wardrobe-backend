import { z } from 'zod';
import {
  CLOTHING_CATEGORIES,
  CLOTHING_COLORS,
  CLOTHING_FITS,
  CLOTHING_FORMALITIES,
  CLOTHING_SUBCATEGORIES,
  COLOR_TONES,
  SUBCATEGORY_BY_CATEGORY,
} from '../wardrobe/wardrobe.enums';

const categorySchema = z.enum(CLOTHING_CATEGORIES);
const subcategorySchema = z.enum(CLOTHING_SUBCATEGORIES);

const nullableTrimmedString = z
  .string()
  .trim()
  .min(1)
  .nullable()
  .optional()
  .transform((value) => value ?? null);

export const extractedItemSchema = z
  .object({
    name: nullableTrimmedString,
    category: categorySchema,
    subcategory: subcategorySchema,
    color: z.enum(CLOTHING_COLORS),
    color_tone: z
      .enum(COLOR_TONES)
      .nullable()
      .optional()
      .transform((value) => value ?? null),
    formality: z.enum(CLOTHING_FORMALITIES),
    fit: z
      .enum(CLOTHING_FITS)
      .nullable()
      .optional()
      .transform((value) => value ?? null),
    notes: nullableTrimmedString,
  })
  .superRefine((data, ctx) => {
    const allowedSubcategories = SUBCATEGORY_BY_CATEGORY[data.category];

    if (!allowedSubcategories.includes(data.subcategory as never)) {
      ctx.addIssue({
        code: 'custom',
        path: ['subcategory'],
        message: `subcategory '${data.subcategory}' is not valid for category '${data.category}'`,
      });
    }
  });

export const extractionOutputSchema = z.object({
  items: z.array(extractedItemSchema),
});

export type ExtractedItem = z.infer<typeof extractedItemSchema>;
