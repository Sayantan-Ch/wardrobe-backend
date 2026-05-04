import { randomUUID } from 'crypto';
import { env } from '../../config/env';
import { supabaseServiceRoleClient } from '../../config/supabase';
import { logger } from '../../lib/logger';
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

  logger.info('storage_upload_started', {
    event: 'storage_upload_started',
    user_id: userId,
    item_id: itemId,
    bucket: env.SUPABASE_STORAGE_BUCKET,
    object_path: objectPath,
    mime_type: mimeType,
    size_bytes: fileBuffer.byteLength,
  });

  const { error: uploadError } = await supabaseServiceRoleClient.storage
    .from(env.SUPABASE_STORAGE_BUCKET)
    .upload(objectPath, fileBuffer, {
      contentType: mimeType,
      upsert: false,
    });

  if (uploadError) {
    logger.error('storage_upload_failed', {
      event: 'storage_upload_failed',
      user_id: userId,
      item_id: itemId,
      bucket: env.SUPABASE_STORAGE_BUCKET,
      object_path: objectPath,
      error: uploadError.message,
    });
    throw new Error(`Failed to upload image: ${uploadError.message}`);
  }

  const imageUrl = getPublicUrl(env.SUPABASE_STORAGE_BUCKET, objectPath);
  logger.info('storage_upload_completed', {
    event: 'storage_upload_completed',
    user_id: userId,
    item_id: itemId,
    bucket: env.SUPABASE_STORAGE_BUCKET,
    object_path: objectPath,
  });

  try {
    const item = await insertClothingItem({
      id: itemId,
      user_id: userId,
      name: metadata.name ?? null,
      category: metadata.category,
      subcategory: metadata.subcategory,
      color: metadata.color,
      color_tone: metadata.color_tone ?? null,
      formality: metadata.formality,
      fit: metadata.fit ?? null,
      image_url: imageUrl,
      notes: metadata.notes ?? null,
    });

    logger.info('upload_item_created', {
      event: 'upload_item_created',
      user_id: userId,
      item_id: itemId,
      category: metadata.category,
      subcategory: metadata.subcategory,
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
    logger.error('upload_db_insert_failed', {
      event: 'upload_db_insert_failed',
      user_id: userId,
      item_id: itemId,
      bucket: env.SUPABASE_STORAGE_BUCKET,
      object_path: objectPath,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    const { error: cleanupError } = await supabaseServiceRoleClient.storage
      .from(env.SUPABASE_STORAGE_BUCKET)
      .remove([objectPath]);

    if (cleanupError) {
      logger.error('storage_cleanup_failed', {
        event: 'storage_cleanup_failed',
        user_id: userId,
        item_id: itemId,
        bucket: env.SUPABASE_STORAGE_BUCKET,
        object_path: objectPath,
        error: cleanupError.message,
      });
    } else {
      logger.info('storage_cleanup_completed', {
        event: 'storage_cleanup_completed',
        user_id: userId,
        item_id: itemId,
        bucket: env.SUPABASE_STORAGE_BUCKET,
        object_path: objectPath,
      });
    }

    throw error;
  }
};
