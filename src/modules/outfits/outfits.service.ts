import { findOwnedClothingItems, insertOutfit, listOutfitsForUser } from './outfits.repository';
import type { CreateOutfitInput, OutfitsListQueryInput } from './outfits.schemas';
import type { ClothingCategory } from '../wardrobe/wardrobe.enums';

const getReferencedItemIds = (input: CreateOutfitInput): string[] => {
  const ids = [input.top_id, input.bottom_id];

  if (input.footwear_id) {
    ids.push(input.footwear_id);
  }

  return ids;
};

const EXPECTED_CATEGORY_BY_SLOT: Record<'top_id' | 'bottom_id' | 'footwear_id', ClothingCategory> = {
  top_id: 'tops',
  bottom_id: 'bottoms',
  footwear_id: 'footwear',
};

export const createOutfitForUser = async (userId: string, input: CreateOutfitInput) => {
  const referencedIds = getReferencedItemIds(input);
  const ownedItems = await findOwnedClothingItems(userId, referencedIds);

  const itemById = new Map(ownedItems.map((item) => [item.id, item]));

  const missing = referencedIds.filter((id) => !itemById.has(id));
  if (missing.length > 0) {
    return {
      ok: false as const,
      reason: 'missing' as const,
      missing,
    };
  }

  const categoryMismatch: Array<{
    field: 'top_id' | 'bottom_id' | 'footwear_id';
    item_id: string;
    expected_category: ClothingCategory;
    actual_category: ClothingCategory;
  }> = [];

  const topItem = itemById.get(input.top_id)!;
  if (topItem.category !== EXPECTED_CATEGORY_BY_SLOT.top_id) {
    categoryMismatch.push({
      field: 'top_id',
      item_id: input.top_id,
      expected_category: EXPECTED_CATEGORY_BY_SLOT.top_id,
      actual_category: topItem.category,
    });
  }

  const bottomItem = itemById.get(input.bottom_id)!;
  if (bottomItem.category !== EXPECTED_CATEGORY_BY_SLOT.bottom_id) {
    categoryMismatch.push({
      field: 'bottom_id',
      item_id: input.bottom_id,
      expected_category: EXPECTED_CATEGORY_BY_SLOT.bottom_id,
      actual_category: bottomItem.category,
    });
  }

  if (input.footwear_id) {
    const footwearItem = itemById.get(input.footwear_id)!;
    if (footwearItem.category !== EXPECTED_CATEGORY_BY_SLOT.footwear_id) {
      categoryMismatch.push({
        field: 'footwear_id',
        item_id: input.footwear_id,
        expected_category: EXPECTED_CATEGORY_BY_SLOT.footwear_id,
        actual_category: footwearItem.category,
      });
    }
  }

  if (categoryMismatch.length > 0) {
    return {
      ok: false as const,
      reason: 'category_mismatch' as const,
      category_mismatch: categoryMismatch,
    };
  }

  const outfit = await insertOutfit({
    user_id: userId,
    top_id: input.top_id,
    bottom_id: input.bottom_id,
    footwear_id: input.footwear_id ?? null,
    context: input.context ?? null,
    llm_reason: input.llm_reason ?? null,
  });

  return {
    ok: true as const,
    outfit,
  };
};

export const listOutfits = async (userId: string, query: OutfitsListQueryInput) => {
  return listOutfitsForUser(userId, query.limit);
};
