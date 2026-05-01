import { insertOutfit, listOutfitsForUser, findOwnedClothingItemIds } from './outfits.repository';
import type { CreateOutfitInput, OutfitsListQueryInput } from './outfits.schemas';

const getReferencedItemIds = (input: CreateOutfitInput): string[] => {
  const ids = [input.top_id, input.bottom_id];

  if (input.footwear_id) {
    ids.push(input.footwear_id);
  }

  return ids;
};

export const createOutfitForUser = async (userId: string, input: CreateOutfitInput) => {
  const referencedIds = getReferencedItemIds(input);
  const ownedIds = await findOwnedClothingItemIds(userId, referencedIds);

  const missing = referencedIds.filter((id) => !ownedIds.has(id));
  if (missing.length > 0) {
    return {
      ok: false as const,
      missing,
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
