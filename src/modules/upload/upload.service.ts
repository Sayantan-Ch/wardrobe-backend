import { randomUUID } from 'crypto';
import { env } from '../../config/env';
import { supabaseServiceRoleClient } from '../../config/supabase';
import { insertClothingItem } from '../wardrobe/wardrobe.repository';
import type { UploadMetadata } from './upload.schemas';

const DEFAULT_MIME = 'image/jpeg';

const extensionFromMime = (mimeType: string): string => {
  if (mimeType === 'image/png') {
    return 'png';
  }
  if (mimeType === 'image/webp') {
    return 'webp';
  }
  return 'jpg';
};

const buildObjectPath = (userId: string, itemId: string, mimeType: string): string => {
  const extension = extensionFromMime(mimeType);
  return `${userId}/${itemId}.${extension}`;
};

const getPublicUrl = (bucket: string, objectPath: string): string => {
  const { data } = supabaseServiceRoleClient.storage.from(bucket).getPublicUrl(objectPath);
  return data.publicUrl;
};

export interface UploadImageInput {
  userId: string;
  fileBuffer: Buffer;
  originalMimeType?: string;
  metadata: UploadMetadata;
}

export const uploadImageAndCreateItem = async ({
  userId,
  fileBuffer,
  originalMimeType,
  metadata,
}: UploadImageInput) => {
  const itemId = randomUUID();
  const mimeType = originalMimeType ?? DEFAULT_MIME;
  const objectPath = buildObjectPath(userId, itemId, mimeType);

  const { error: uploadError } = await supabaseServiceRoleClient.storage
    .from(env.SUPABASE_STORAGE_BUCKET)
    .upload(objectPath, fileBuffer, {
      contentType: mimeType,
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Failed to upload image: ${uploadError.message}`);
  }

  const imageUrl = getPublicUrl(env.SUPABASE_STORAGE_BUCKET, objectPath);

  try {
    const item = await insertClothingItem({
      id: itemId,
      user_id: userId,
      name: metadata.name,
      category: metadata.category,
      color: metadata.color ?? null,
      image_url: imageUrl,
      notes: metadata.notes ?? null,
    });

    return {
      item,
      storage: {
        bucket: env.SUPABASE_STORAGE_BUCKET,
        objectPath,
        imageUrl,
      },
    };
  } catch (error) {
    await supabaseServiceRoleClient.storage.from(env.SUPABASE_STORAGE_BUCKET).remove([objectPath]);
    throw error;
  }
};
