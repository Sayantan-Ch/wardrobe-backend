import { z } from 'zod';

export const uploadMetadataSchema = z.object({
  name: z.string().min(1, 'name is required'),
  category: z.string().min(1, 'category is required'),
  color: z.string().trim().min(1).optional(),
  notes: z.string().trim().min(1).optional(),
});

export type UploadMetadata = z.infer<typeof uploadMetadataSchema>;
