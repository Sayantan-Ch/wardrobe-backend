import {
  deleteClothingItemForUser,
  insertClothingItem,
  listClothingItemsForUser,
  updateClothingItemForUser,
} from './wardrobe.repository';
import type {
  CreateWardrobeItemInput,
  UpdateWardrobeItemInput,
  WardrobeListQueryInput,
} from './wardrobe.schemas';

export const createWardrobeItem = async (userId: string, input: CreateWardrobeItemInput) => {
  return insertClothingItem({
    user_id: userId,
    name: input.name,
    category: input.category,
    color: input.color ?? null,
    image_url: input.image_url ?? null,
    notes: input.notes ?? null,
  });
};

export const listWardrobeItems = async (userId: string, query: WardrobeListQueryInput) => {
  return listClothingItemsForUser({
    userId,
    category: query.category,
    limit: query.limit,
  });
};

export const updateWardrobeItem = async (
  userId: string,
  itemId: string,
  input: UpdateWardrobeItemInput,
) => {
  const updatePayload: {
    name?: string;
    category?: string;
    color?: string | null;
    image_url?: string | null;
    notes?: string | null;
  } = {};

  if (input.name !== undefined) updatePayload.name = input.name;
  if (input.category !== undefined) updatePayload.category = input.category;
  if (input.color !== undefined) updatePayload.color = input.color;
  if (input.image_url !== undefined) updatePayload.image_url = input.image_url;
  if (input.notes !== undefined) updatePayload.notes = input.notes;

  return updateClothingItemForUser(userId, itemId, updatePayload);
};

export const deleteWardrobeItem = async (userId: string, itemId: string) => {
  return deleteClothingItemForUser(userId, itemId);
};
