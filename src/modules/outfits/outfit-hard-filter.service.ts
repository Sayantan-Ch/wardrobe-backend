import type { OutfitGenerationClothingItem, OutfitIntent } from './outfit-generation.schemas';
import {
  isWardrobePoolReady,
  type GenerationWardrobePools,
  type WardrobePoolReadiness,
} from './outfit-wardrobe-pool.service';
import type { ClothingSubcategory } from '../wardrobe/wardrobe.enums';

export type GenerationWardrobeSlot = keyof GenerationWardrobePools;

export type HardFilterRejectionReason =
  | 'excluded_item_id'
  | 'excluded_color'
  | 'excluded_fit'
  | 'excluded_subcategory'
  | 'occasion_inappropriate'
  | 'formality_inappropriate';

export interface HardFilterRejection {
  item_id: string;
  slot: GenerationWardrobeSlot;
  item_name: string | null;
  reasons: HardFilterRejectionReason[];
  message: string;
}

export type HardFilterNoResultReason =
  | 'required_item_missing'
  | 'required_item_unsupported'
  | 'required_item_filtered_out'
  | 'conflicting_required_items';

export interface HardFilterNoResultDiagnostic {
  reason: HardFilterNoResultReason;
  item_ids: string[];
  slot: GenerationWardrobeSlot | null;
  message: string;
  rejected_reasons?: HardFilterRejectionReason[];
}

export interface ApplyOutfitHardFiltersInput {
  intent: OutfitIntent;
  pools: GenerationWardrobePools;
}

export interface ApplyOutfitHardFiltersResult {
  pools: GenerationWardrobePools;
  rejected: HardFilterRejection[];
  no_result_reasons: HardFilterNoResultDiagnostic[];
  constraints_satisfied: boolean;
  readiness: WardrobePoolReadiness;
}

const GENERATION_WARDROBE_SLOTS = ['tops', 'bottoms', 'footwear'] as const satisfies readonly GenerationWardrobeSlot[];

const FORMAL_TOP_REJECTS = ['tshirt', 'hoodie'] as const satisfies readonly ClothingSubcategory[];
const FORMAL_BOTTOM_REJECTS = ['shorts', 'joggers'] as const satisfies readonly ClothingSubcategory[];
const FORMAL_FOOTWEAR_REJECTS = ['sandals'] as const satisfies readonly ClothingSubcategory[];

const OFFICE_BOTTOM_REJECTS = ['shorts', 'joggers'] as const satisfies readonly ClothingSubcategory[];
const OFFICE_FOOTWEAR_REJECTS = ['sandals'] as const satisfies readonly ClothingSubcategory[];

const DINNER_DATE_BOTTOM_REJECTS = ['joggers'] as const satisfies readonly ClothingSubcategory[];
const DINNER_DATE_FOOTWEAR_REJECTS = ['sandals'] as const satisfies readonly ClothingSubcategory[];

const includesSubcategory = (
  subcategories: readonly ClothingSubcategory[],
  subcategory: ClothingSubcategory,
): boolean => subcategories.includes(subcategory);

const getSlotForItem = (item: OutfitGenerationClothingItem): GenerationWardrobeSlot | null => {
  return GENERATION_WARDROBE_SLOTS.includes(item.category) ? item.category : null;
};

const isOccasionInappropriate = (
  intent: OutfitIntent,
  item: OutfitGenerationClothingItem,
): boolean => {
  if (intent.occasion === 'wedding' || intent.occasion === 'interview') {
    if (item.category === 'tops') {
      return includesSubcategory(FORMAL_TOP_REJECTS, item.subcategory);
    }

    if (item.category === 'bottoms') {
      return includesSubcategory(FORMAL_BOTTOM_REJECTS, item.subcategory);
    }

    return includesSubcategory(FORMAL_FOOTWEAR_REJECTS, item.subcategory);
  }

  if (intent.occasion === 'office') {
    if (item.category === 'bottoms') {
      return includesSubcategory(OFFICE_BOTTOM_REJECTS, item.subcategory);
    }

    if (item.category === 'footwear') {
      return includesSubcategory(OFFICE_FOOTWEAR_REJECTS, item.subcategory);
    }
  }

  if (intent.occasion === 'dinner' || intent.occasion === 'date') {
    if (item.category === 'bottoms') {
      return includesSubcategory(DINNER_DATE_BOTTOM_REJECTS, item.subcategory);
    }

    if (item.category === 'footwear') {
      return includesSubcategory(DINNER_DATE_FOOTWEAR_REJECTS, item.subcategory);
    }
  }

  return false;
};

const isFormalityInappropriate = (
  intent: OutfitIntent,
  item: OutfitGenerationClothingItem,
): boolean => {
  if (intent.target_formality !== 'formal') {
    return false;
  }

  if (item.category === 'tops') {
    return includesSubcategory(FORMAL_TOP_REJECTS, item.subcategory);
  }

  if (item.category === 'bottoms') {
    return includesSubcategory(FORMAL_BOTTOM_REJECTS, item.subcategory);
  }

  return includesSubcategory(FORMAL_FOOTWEAR_REJECTS, item.subcategory);
};

const buildRejectionMessage = (item: OutfitGenerationClothingItem, reasons: HardFilterRejectionReason[]): string => {
  return `Rejected ${item.category} item ${item.id}: ${reasons.join(', ')}.`;
};

const getItemRejectionReasons = (
  intent: OutfitIntent,
  item: OutfitGenerationClothingItem,
): HardFilterRejectionReason[] => {
  const { hard_filters: hardFilters } = intent;
  const reasons: HardFilterRejectionReason[] = [];

  if (hardFilters.excluded_item_ids.includes(item.id)) {
    reasons.push('excluded_item_id');
  }

  if (hardFilters.excluded_colors.includes(item.color)) {
    reasons.push('excluded_color');
  }

  if (item.fit && hardFilters.excluded_fits.includes(item.fit)) {
    reasons.push('excluded_fit');
  }

  if (hardFilters.excluded_subcategories.includes(item.subcategory)) {
    reasons.push('excluded_subcategory');
  }

  if (isOccasionInappropriate(intent, item)) {
    reasons.push('occasion_inappropriate');
  }

  if (isFormalityInappropriate(intent, item)) {
    reasons.push('formality_inappropriate');
  }

  return reasons;
};

const filterSlotPool = (
  intent: OutfitIntent,
  slot: GenerationWardrobeSlot,
  items: OutfitGenerationClothingItem[],
  rejected: HardFilterRejection[],
): OutfitGenerationClothingItem[] => {
  return items.filter((item) => {
    const reasons = getItemRejectionReasons(intent, item);

    if (reasons.length === 0) {
      return true;
    }

    rejected.push({
      item_id: item.id,
      slot,
      item_name: item.name,
      reasons,
      message: buildRejectionMessage(item, reasons),
    });

    return false;
  });
};

const findItemsById = (pools: GenerationWardrobePools): Map<string, OutfitGenerationClothingItem> => {
  const itemsById = new Map<string, OutfitGenerationClothingItem>();

  for (const slot of GENERATION_WARDROBE_SLOTS) {
    for (const item of pools[slot]) {
      itemsById.set(item.id, item);
    }
  }

  return itemsById;
};

const findRejectionsByItemId = (rejected: HardFilterRejection[]): Map<string, HardFilterRejection> => {
  return new Map(rejected.map((rejection) => [rejection.item_id, rejection]));
};

const addRequiredItemConstraints = (
  intent: OutfitIntent,
  originalPools: GenerationWardrobePools,
  filteredPools: GenerationWardrobePools,
  rejected: HardFilterRejection[],
): HardFilterNoResultDiagnostic[] => {
  const itemsById = findItemsById(originalPools);
  const rejectionsByItemId = findRejectionsByItemId(rejected);
  const requiredBySlot: Record<GenerationWardrobeSlot, OutfitGenerationClothingItem[]> = {
    tops: [],
    bottoms: [],
    footwear: [],
  };
  const noResultReasons: HardFilterNoResultDiagnostic[] = [];
  const requiredItemIds = [...new Set(intent.hard_filters.required_item_ids)];

  for (const itemId of requiredItemIds) {
    const item = itemsById.get(itemId);

    if (!item) {
      noResultReasons.push({
        reason: 'required_item_missing',
        item_ids: [itemId],
        slot: null,
        message: `Required item ${itemId} is not present in the generation wardrobe pools.`,
      });
      continue;
    }

    const slot = getSlotForItem(item);

    if (!slot) {
      noResultReasons.push({
        reason: 'required_item_unsupported',
        item_ids: [itemId],
        slot: null,
        message: `Required item ${itemId} is not in a supported generation slot.`,
      });
      continue;
    }

    const filteredItem = filteredPools[slot].find((candidate) => candidate.id === itemId);

    if (!filteredItem) {
      const rejection = rejectionsByItemId.get(itemId);

      noResultReasons.push({
        reason: 'required_item_filtered_out',
        item_ids: [itemId],
        slot,
        message: `Required item ${itemId} was removed by hard filters.`,
        rejected_reasons: rejection?.reasons,
      });
      filteredPools[slot] = [];
      continue;
    }

    requiredBySlot[slot].push(filteredItem);
  }

  for (const slot of GENERATION_WARDROBE_SLOTS) {
    const requiredItems = requiredBySlot[slot];

    if (requiredItems.length === 0) {
      continue;
    }

    if (requiredItems.length > 1) {
      filteredPools[slot] = [];

      noResultReasons.push({
        reason: 'conflicting_required_items',
        item_ids: requiredItems.map((item) => item.id),
        slot,
        message: `Multiple required items target the ${slot} slot, but v1 generation supports one item per slot.`,
      });
      continue;
    }

    filteredPools[slot] = requiredItems;
  }

  return noResultReasons;
};

export const applyOutfitHardFilters = ({
  intent,
  pools,
}: ApplyOutfitHardFiltersInput): ApplyOutfitHardFiltersResult => {
  const rejected: HardFilterRejection[] = [];
  const filteredPools: GenerationWardrobePools = {
    tops: filterSlotPool(intent, 'tops', pools.tops, rejected),
    bottoms: filterSlotPool(intent, 'bottoms', pools.bottoms, rejected),
    footwear: filterSlotPool(intent, 'footwear', pools.footwear, rejected),
  };

  const noResultReasons = addRequiredItemConstraints(intent, pools, filteredPools, rejected);

  return {
    pools: filteredPools,
    rejected,
    no_result_reasons: noResultReasons,
    constraints_satisfied: noResultReasons.length === 0,
    readiness: isWardrobePoolReady(filteredPools),
  };
};
