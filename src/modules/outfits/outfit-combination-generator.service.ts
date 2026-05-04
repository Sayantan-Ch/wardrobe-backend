import type {
  GeneratedCandidate,
  OutfitGenerationClothingItem,
  OutfitIntent,
  OutfitSoftPreferences,
} from './outfit-generation.schemas';
import type { GenerationWardrobePools } from './outfit-wardrobe-pool.service';
import type { ClothingColor, ClothingFormality } from '../wardrobe/wardrobe.enums';

export interface CombinationPoolCaps {
  tops: number;
  bottoms: number;
  footwear: number;
}

export interface CombinationPoolDiagnostic {
  input_count: number;
  capped_count: number;
  cap: number;
  capped: boolean;
}

export interface GenerateOutfitCombinationsDiagnostics {
  pools: Record<keyof GenerationWardrobePools, CombinationPoolDiagnostic>;
  candidate_space_before_pool_caps: number;
  generated_count: number;
  footwear_included: boolean;
  footwear_null_variant_included: boolean;
}

export interface GenerateOutfitCombinationsInput {
  intent: OutfitIntent;
  pools: GenerationWardrobePools;
  caps?: Partial<CombinationPoolCaps>;
}

export interface GenerateOutfitCombinationsResult {
  candidates: GeneratedCandidate[];
  capped_pools: GenerationWardrobePools;
  diagnostics: GenerateOutfitCombinationsDiagnostics;
}

interface IndexedItem {
  item: OutfitGenerationClothingItem;
  index: number;
}

export const DEFAULT_COMBINATION_POOL_CAPS: CombinationPoolCaps = {
  tops: 25,
  bottoms: 25,
  footwear: 15,
};

const FORMALITY_RANK: Record<ClothingFormality, number> = {
  casual: 0,
  smart_casual: 1,
  formal: 2,
};

const normalizeCap = (cap: number): number => {
  if (!Number.isFinite(cap)) {
    return 0;
  }

  return Math.max(0, Math.trunc(cap));
};

const getCandidateSpaceCount = (pools: GenerationWardrobePools): number => {
  if (pools.tops.length === 0 || pools.bottoms.length === 0) {
    return 0;
  }

  return pools.tops.length * pools.bottoms.length * Math.max(pools.footwear.length, 1);
};

const getPreferredSubcategories = (
  slot: keyof GenerationWardrobePools,
  preferences: OutfitSoftPreferences,
): string[] => {
  if (slot === 'tops') {
    return preferences.preferred_top_subcategories;
  }

  if (slot === 'bottoms') {
    return preferences.preferred_bottom_subcategories;
  }

  return preferences.preferred_footwear_subcategories;
};

const getSlotPreferredColors = (
  slot: keyof GenerationWardrobePools,
  preferences: OutfitSoftPreferences,
): ClothingColor[] => {
  if (slot === 'tops') {
    return preferences.preferred_top_colors;
  }

  if (slot === 'bottoms') {
    return preferences.preferred_bottom_colors;
  }

  return preferences.preferred_footwear_colors;
};

const getRelevanceScore = (
  intent: OutfitIntent,
  slot: keyof GenerationWardrobePools,
  item: OutfitGenerationClothingItem,
): number => {
  const preferredSubcategories = getPreferredSubcategories(slot, intent.soft_preferences);
  const slotPreferredColors = getSlotPreferredColors(slot, intent.soft_preferences);
  const subcategoryScore = preferredSubcategories.includes(item.subcategory) ? 100 : 0;
  const slotColorScore = slotPreferredColors.includes(item.color) ? 60 : 0;
  const genericColorScore = intent.soft_preferences.preferred_colors.includes(item.color) ? 30 : 0;
  const formalityDistance = Math.abs(
    FORMALITY_RANK[item.formality] - FORMALITY_RANK[intent.target_formality],
  );
  const formalityScore = 2 - formalityDistance;

  return subcategoryScore + slotColorScore + genericColorScore + formalityScore;
};

const capPoolByRelevance = (
  intent: OutfitIntent,
  slot: keyof GenerationWardrobePools,
  items: OutfitGenerationClothingItem[],
  cap: number,
): OutfitGenerationClothingItem[] => {
  return items
    .map((item, index): IndexedItem => ({ item, index }))
    .sort((left, right) => {
      const scoreDifference =
        getRelevanceScore(intent, slot, right.item) - getRelevanceScore(intent, slot, left.item);

      if (scoreDifference !== 0) {
        return scoreDifference;
      }

      return left.index - right.index;
    })
    .slice(0, cap)
    .map(({ item }) => item);
};

const buildPoolDiagnostic = (
  inputCount: number,
  cappedCount: number,
  cap: number,
): CombinationPoolDiagnostic => ({
  input_count: inputCount,
  capped_count: cappedCount,
  cap,
  capped: inputCount > cappedCount,
});

const buildCandidateId = (
  top: OutfitGenerationClothingItem,
  bottom: OutfitGenerationClothingItem,
  footwear: OutfitGenerationClothingItem | null,
): string => {
  return `candidate:${top.id}:${bottom.id}:${footwear?.id ?? 'no_footwear'}`;
};

export const generateOutfitCombinations = ({
  intent,
  pools,
  caps: capOverrides = {},
}: GenerateOutfitCombinationsInput): GenerateOutfitCombinationsResult => {
  const caps: CombinationPoolCaps = {
    tops: normalizeCap(capOverrides.tops ?? DEFAULT_COMBINATION_POOL_CAPS.tops),
    bottoms: normalizeCap(capOverrides.bottoms ?? DEFAULT_COMBINATION_POOL_CAPS.bottoms),
    footwear: normalizeCap(capOverrides.footwear ?? DEFAULT_COMBINATION_POOL_CAPS.footwear),
  };
  const cappedPools: GenerationWardrobePools = {
    tops: capPoolByRelevance(intent, 'tops', pools.tops, caps.tops),
    bottoms: capPoolByRelevance(intent, 'bottoms', pools.bottoms, caps.bottoms),
    footwear: capPoolByRelevance(intent, 'footwear', pools.footwear, caps.footwear),
  };
  const footwearOptions: Array<OutfitGenerationClothingItem | null> =
    cappedPools.footwear.length > 0 ? cappedPools.footwear : [null];
  const candidates: GeneratedCandidate[] = [];

  for (const top of cappedPools.tops) {
    for (const bottom of cappedPools.bottoms) {
      for (const footwear of footwearOptions) {
        candidates.push({
          id: buildCandidateId(top, bottom, footwear),
          top,
          bottom,
          footwear,
        });
      }
    }
  }

  return {
    candidates,
    capped_pools: cappedPools,
    diagnostics: {
      pools: {
        tops: buildPoolDiagnostic(pools.tops.length, cappedPools.tops.length, caps.tops),
        bottoms: buildPoolDiagnostic(pools.bottoms.length, cappedPools.bottoms.length, caps.bottoms),
        footwear: buildPoolDiagnostic(
          pools.footwear.length,
          cappedPools.footwear.length,
          caps.footwear,
        ),
      },
      candidate_space_before_pool_caps: getCandidateSpaceCount(pools),
      generated_count: candidates.length,
      footwear_included: cappedPools.footwear.length > 0,
      footwear_null_variant_included: cappedPools.footwear.length === 0,
    },
  };
};
