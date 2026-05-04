import { AppError } from '../../errors/app-error';
import { supabaseServiceRoleClient } from '../../config/supabase';
import { logger } from '../../lib/logger';
import type {
  ClothingCategory,
  ClothingColor,
  ClothingFit,
  ClothingFormality,
  ClothingSubcategory,
  ColorTone,
} from './wardrobe.enums';

export interface ClothingItemInsert {
  id?: string;
  user_id: string;
  name: string | null;
  category: ClothingCategory;
  subcategory: ClothingSubcategory;
  color: ClothingColor;
  color_tone: ColorTone | null;
  formality: ClothingFormality;
  fit: ClothingFit | null;
  image_url: string;
  notes: string | null;
}

export interface ClothingItemUpdate {
  name?: string | null;
  category?: ClothingCategory;
  subcategory?: ClothingSubcategory;
  color?: ClothingColor;
  color_tone?: ColorTone | null;
  formality?: ClothingFormality;
  fit?: ClothingFit | null;
  image_url?: string;
  notes?: string | null;
}

export interface ClothingItemListQuery {
  userId: string;
  category?: ClothingCategory;
  limit: number;
}

const isForeignKeyViolation = (code?: string) => code === '23503';

export const insertClothingItem = async (payload: ClothingItemInsert) => {
  const { data, error } = await supabaseServiceRoleClient
    .from('clothing_items')
    .insert(payload)
    .select('*')
    .single();

  if (error) {
    logger.error('supabase_query_failed', {
      event: 'supabase_query_failed',
      operation: 'clothing_items.insert',
      supabase_code: error.code,
      error: error.message,
      user_id: payload.user_id,
      item_id: payload.id,
    });
    throw new Error(`Failed to insert clothing item: ${error.message}`);
  }

  return data;
};

export const listClothingItemsForUser = async ({ userId, category, limit }: ClothingItemListQuery) => {
  let query = supabaseServiceRoleClient
    .from('clothing_items')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (category) {
    query = query.eq('category', category);
  }

  const { data, error } = await query;

  if (error) {
    logger.error('supabase_query_failed', {
      event: 'supabase_query_failed',
      operation: 'clothing_items.list',
      supabase_code: error.code,
      error: error.message,
      user_id: userId,
      category,
      limit,
    });
    throw new Error(`Failed to fetch clothing items: ${error.message}`);
  }

  return data;
};

export const updateClothingItemForUser = async (
  userId: string,
  itemId: string,
  payload: ClothingItemUpdate,
) => {
  const { data, error } = await supabaseServiceRoleClient
    .from('clothing_items')
    .update(payload)
    .eq('user_id', userId)
    .eq('id', itemId)
    .select('*');

  if (error) {
    logger.error('supabase_query_failed', {
      event: 'supabase_query_failed',
      operation: 'clothing_items.update',
      supabase_code: error.code,
      error: error.message,
      user_id: userId,
      item_id: itemId,
    });
    throw new Error(`Failed to update clothing item: ${error.message}`);
  }

  return data[0] ?? null;
};

export const findClothingItemByIdForUser = async (userId: string, itemId: string) => {
  const { data, error } = await supabaseServiceRoleClient
    .from('clothing_items')
    .select('*')
    .eq('user_id', userId)
    .eq('id', itemId)
    .maybeSingle();

  if (error) {
    logger.error('supabase_query_failed', {
      event: 'supabase_query_failed',
      operation: 'clothing_items.find_by_id',
      supabase_code: error.code,
      error: error.message,
      user_id: userId,
      item_id: itemId,
    });
    throw new Error(`Failed to fetch clothing item: ${error.message}`);
  }

  return data;
};

export const deleteClothingItemForUser = async (userId: string, itemId: string) => {
  const { data, error } = await supabaseServiceRoleClient
    .from('clothing_items')
    .delete()
    .eq('user_id', userId)
    .eq('id', itemId)
    .select('id');

  if (error) {
    if (isForeignKeyViolation(error.code)) {
      logger.warn('supabase_conflict', {
        event: 'supabase_conflict',
        operation: 'clothing_items.delete',
        supabase_code: error.code,
        error: error.message,
        user_id: userId,
        item_id: itemId,
      });
      throw new AppError(
        409,
        'conflict',
        'Cannot delete item because it is referenced by one or more outfits',
      );
    }

    logger.error('supabase_query_failed', {
      event: 'supabase_query_failed',
      operation: 'clothing_items.delete',
      supabase_code: error.code,
      error: error.message,
      user_id: userId,
      item_id: itemId,
    });
    throw new Error(`Failed to delete clothing item: ${error.message}`);
  }

  return (data?.length ?? 0) > 0;
};
