import {
  deleteClothingItemForUser,
  findClothingItemByIdForUser,
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
    name: input.name ?? null,
    category: input.category,
    subcategory: input.subcategory,
    color: input.color,
    color_tone: input.color_tone ?? null,
    formality: input.formality,
    fit: input.fit ?? null,
    image_url: input.image_url,
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

export const getWardrobeItemById = async (userId: string, itemId: string) => {
  return findClothingItemByIdForUser(userId, itemId);
};

export const updateWardrobeItem = async (
  userId: string,
  itemId: string,
  input: UpdateWardrobeItemInput,
) => {
  const updatePayload: {
    name?: string | null;
    category?: CreateWardrobeItemInput['category'];
    subcategory?: CreateWardrobeItemInput['subcategory'];
    color?: CreateWardrobeItemInput['color'];
    color_tone?: CreateWardrobeItemInput['color_tone'] | null;
    formality?: CreateWardrobeItemInput['formality'];
    fit?: CreateWardrobeItemInput['fit'] | null;
    image_url?: string;
    notes?: string | null;
  } = {};

  if (input.name !== undefined) updatePayload.name = input.name;
  if (input.category !== undefined) updatePayload.category = input.category;
  if (input.subcategory !== undefined) updatePayload.subcategory = input.subcategory;
  if (input.color !== undefined) updatePayload.color = input.color;
  if (input.color_tone !== undefined) updatePayload.color_tone = input.color_tone;
  if (input.formality !== undefined) updatePayload.formality = input.formality;
  if (input.fit !== undefined) updatePayload.fit = input.fit;
  if (input.image_url !== undefined) updatePayload.image_url = input.image_url;
  if (input.notes !== undefined) updatePayload.notes = input.notes;

  return updateClothingItemForUser(userId, itemId, updatePayload);
};

export const deleteWardrobeItem = async (userId: string, itemId: string) => {
  return deleteClothingItemForUser(userId, itemId);
};
