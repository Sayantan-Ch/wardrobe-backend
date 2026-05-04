import { supabaseServiceRoleClient } from '../../config/supabase';
import { logger } from '../../lib/logger';
import type { ClothingCategory } from '../wardrobe/wardrobe.enums';

const GENERATION_WARDROBE_CATEGORIES = ['tops', 'bottoms', 'footwear'] as const;

const GENERATION_WARDROBE_SELECT_COLUMNS = [
  'id',
  'user_id',
  'name',
  'category',
  'subcategory',
  'color',
  'color_tone',
  'formality',
  'fit',
  'image_url',
  'notes',
  'created_at',
  'updated_at',
].join(', ');

export interface OutfitInsert {
  user_id: string;
  top_id: string;
  bottom_id: string;
  footwear_id: string | null;
  context: string | null;
  llm_reason: string | null;
}

export interface OwnedClothingItem {
  id: string;
  category: ClothingCategory;
}

export type GenerationWardrobeCategory = (typeof GENERATION_WARDROBE_CATEGORIES)[number];

export const insertOutfit = async (payload: OutfitInsert) => {
  const { data, error } = await supabaseServiceRoleClient
    .from('outfits')
    .insert(payload)
    .select('*')
    .single();

  if (error) {
    logger.error('supabase_query_failed', {
      event: 'supabase_query_failed',
      operation: 'outfits.insert',
      supabase_code: error.code,
      error: error.message,
      user_id: payload.user_id,
    });
    throw new Error(`Failed to insert outfit: ${error.message}`);
  }

  return data;
};

export const listOutfitsForUser = async (userId: string, limit: number) => {
  const { data, error } = await supabaseServiceRoleClient
    .from('outfits')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    logger.error('supabase_query_failed', {
      event: 'supabase_query_failed',
      operation: 'outfits.list',
      supabase_code: error.code,
      error: error.message,
      user_id: userId,
      limit,
    });
    throw new Error(`Failed to list outfits: ${error.message}`);
  }

  return data;
};

export const findOwnedClothingItems = async (userId: string, itemIds: string[]) => {
  const uniqueIds = [...new Set(itemIds)];

  const { data, error } = await supabaseServiceRoleClient
    .from('clothing_items')
    .select('id, category')
    .eq('user_id', userId)
    .in('id', uniqueIds);

  if (error) {
    logger.error('supabase_query_failed', {
      event: 'supabase_query_failed',
      operation: 'clothing_items.verify_ownership',
      supabase_code: error.code,
      error: error.message,
      user_id: userId,
      item_count: uniqueIds.length,
    });
    throw new Error(`Failed to verify clothing item ownership: ${error.message}`);
  }

  return (data ?? []) as OwnedClothingItem[];
};

export const listGenerationWardrobeItemsForUser = async (userId: string): Promise<unknown[]> => {
  const { data, error } = await supabaseServiceRoleClient
    .from('clothing_items')
    .select(GENERATION_WARDROBE_SELECT_COLUMNS)
    .eq('user_id', userId)
    .in('category', [...GENERATION_WARDROBE_CATEGORIES])
    .order('created_at', { ascending: false });

  if (error) {
    logger.error('supabase_query_failed', {
      event: 'supabase_query_failed',
      operation: 'clothing_items.list_generation_pool',
      supabase_code: error.code,
      error: error.message,
      user_id: userId,
    });
    throw new Error(`Failed to fetch wardrobe generation pool: ${error.message}`);
  }

  return data ?? [];
};

export const deleteOutfitForUser = async (userId: string, outfitId: string): Promise<boolean> => {
  const { error, count } = await supabaseServiceRoleClient
    .from('outfits')
    .delete({ count: 'exact' })
    .eq('id', outfitId)
    .eq('user_id', userId);

  if (error) {
    logger.error('supabase_query_failed', {
      event: 'supabase_query_failed',
      operation: 'outfits.delete',
      supabase_code: error.code,
      error: error.message,
      user_id: userId,
      outfit_id: outfitId,
    });
    throw new Error(`Failed to delete outfit: ${error.message}`);
  }

  return (count ?? 0) > 0;
};
