import { supabaseServiceRoleClient } from '../../config/supabase';
import type { ClothingCategory } from '../wardrobe/wardrobe.enums';

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

export const insertOutfit = async (payload: OutfitInsert) => {
  const { data, error } = await supabaseServiceRoleClient
    .from('outfits')
    .insert(payload)
    .select('*')
    .single();

  if (error) {
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
    throw new Error(`Failed to verify clothing item ownership: ${error.message}`);
  }

  return (data ?? []) as OwnedClothingItem[];
};
