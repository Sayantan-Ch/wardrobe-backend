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

export const uploadMetadataSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    category: categorySchema,
    subcategory: subcategorySchema,
    color: z.enum(CLOTHING_COLORS),
    color_tone: z.enum(COLOR_TONES).optional(),
    formality: z.enum(CLOTHING_FORMALITIES),
    fit: z.enum(CLOTHING_FITS).optional(),
    notes: z.string().trim().min(1).optional(),
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

export type UploadMetadata = z.infer<typeof uploadMetadataSchema>;
