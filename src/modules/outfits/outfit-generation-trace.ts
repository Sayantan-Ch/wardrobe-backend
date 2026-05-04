import type { BadCombinationRejection } from './outfit-combination-rejection.service';
import type {
  GeneratedCandidate,
  OutfitGenerationClothingItem,
  OutfitIntent,
  ScoredCandidate,
} from './outfit-generation.schemas';
import type { HardFilterRejection } from './outfit-hard-filter.service';
import type { RankedOutfitCandidate } from './outfit-ranking.service';
import type { ClothingColor, ClothingSubcategory } from '../wardrobe/wardrobe.enums';

const DEFAULT_SAMPLE_LIMIT = 5;

export const serializeTraceItem = (item: OutfitGenerationClothingItem | null) => {
  if (!item) {
    return null;
  }

  return {
    id: item.id,
    name: item.name,
    category: item.category,
    subcategory: item.subcategory,
    color: item.color,
    formality: item.formality,
    fit: item.fit,
  };
};

const getCandidateItems = (candidate: GeneratedCandidate): OutfitGenerationClothingItem[] => {
  return candidate.footwear
    ? [candidate.top, candidate.bottom, candidate.footwear]
    : [candidate.top, candidate.bottom];
};

export const serializeTraceCandidate = (candidate: GeneratedCandidate) => ({
  id: candidate.id,
  top: serializeTraceItem(candidate.top),
  bottom: serializeTraceItem(candidate.bottom),
  footwear: serializeTraceItem(candidate.footwear),
});

const summarizePreferenceMatches = (intent: OutfitIntent, candidate: GeneratedCandidate) => {
  const items = getCandidateItems(candidate);
  const preferredColors = new Set<ClothingColor>(intent.soft_preferences.preferred_colors);
  const preferredTopColors = new Set<ClothingColor>(intent.soft_preferences.preferred_top_colors);
  const preferredBottomColors = new Set<ClothingColor>(
    intent.soft_preferences.preferred_bottom_colors,
  );
  const preferredFootwearColors = new Set<ClothingColor>(
    intent.soft_preferences.preferred_footwear_colors,
  );
  const preferredTopSubcategories = new Set<ClothingSubcategory>(
    intent.soft_preferences.preferred_top_subcategories,
  );
  const preferredBottomSubcategories = new Set<ClothingSubcategory>(
    intent.soft_preferences.preferred_bottom_subcategories,
  );
  const preferredFootwearSubcategories = new Set<ClothingSubcategory>(
    intent.soft_preferences.preferred_footwear_subcategories,
  );
  const preferredFits = new Set(intent.soft_preferences.preferred_fits);

  return {
    preferred_color_item_ids: items
      .filter((item) => preferredColors.has(item.color))
      .map((item) => item.id),
    top_color_matched: preferredTopColors.has(candidate.top.color),
    bottom_color_matched: preferredBottomColors.has(candidate.bottom.color),
    footwear_color_matched: candidate.footwear
      ? preferredFootwearColors.has(candidate.footwear.color)
      : false,
    preferred_fit_item_ids: items
      .filter((item) => item.fit && preferredFits.has(item.fit))
      .map((item) => item.id),
    top_subcategory_matched: preferredTopSubcategories.has(candidate.top.subcategory),
    bottom_subcategory_matched: preferredBottomSubcategories.has(candidate.bottom.subcategory),
    footwear_subcategory_matched: candidate.footwear
      ? preferredFootwearSubcategories.has(candidate.footwear.subcategory)
      : false,
  };
};

export const serializeTraceScoredCandidate = (
  candidate: ScoredCandidate,
  intent: OutfitIntent,
) => ({
  ...serializeTraceCandidate(candidate.candidate),
  score: candidate.score,
  score_breakdown: candidate.score_breakdown,
  preference_matches: summarizePreferenceMatches(intent, candidate.candidate),
});

export const serializeTraceRankedCandidate = <Candidate extends ScoredCandidate>(
  candidate: RankedOutfitCandidate<Candidate>,
  intent: OutfitIntent,
) => ({
  ...serializeTraceScoredCandidate(candidate, intent),
  rank: candidate.rank,
  ranking_metadata: candidate.ranking_metadata,
});

export const summarizeIntentForTrace = (intent: OutfitIntent) => ({
  occasion: intent.occasion,
  target_formality: intent.target_formality,
  moods: intent.moods,
  hard_filters: {
    excluded_colors: intent.hard_filters.excluded_colors,
    excluded_subcategories: intent.hard_filters.excluded_subcategories,
    excluded_fits: intent.hard_filters.excluded_fits,
    required_item_ids: intent.hard_filters.required_item_ids,
    excluded_item_ids: intent.hard_filters.excluded_item_ids,
  },
  soft_preferences: {
    preferred_formalities: intent.soft_preferences.preferred_formalities,
    preferred_top_subcategories: intent.soft_preferences.preferred_top_subcategories,
    preferred_bottom_subcategories: intent.soft_preferences.preferred_bottom_subcategories,
    preferred_footwear_subcategories: intent.soft_preferences.preferred_footwear_subcategories,
    preferred_colors: intent.soft_preferences.preferred_colors,
    preferred_top_colors: intent.soft_preferences.preferred_top_colors,
    preferred_bottom_colors: intent.soft_preferences.preferred_bottom_colors,
    preferred_footwear_colors: intent.soft_preferences.preferred_footwear_colors,
    preferred_fits: intent.soft_preferences.preferred_fits,
  },
});

export const sampleTrace = <Value>(values: Value[], limit = DEFAULT_SAMPLE_LIMIT): Value[] => {
  return values.slice(0, Math.max(0, limit));
};

export const countHardFilterRejectionReasons = (
  rejections: HardFilterRejection[],
): Record<string, number> => {
  const counts: Record<string, number> = {};

  for (const rejection of rejections) {
    for (const reason of rejection.reasons) {
      counts[reason] = (counts[reason] ?? 0) + 1;
    }
  }

  return counts;
};

export const countBadCombinationRejectionReasons = (
  rejections: BadCombinationRejection[],
): Record<string, number> => {
  const counts: Record<string, number> = {};

  for (const rejection of rejections) {
    for (const detail of rejection.reasons) {
      counts[detail.reason] = (counts[detail.reason] ?? 0) + 1;
    }
  }

  return counts;
};

export const serializeTraceHardFilterRejection = (rejection: HardFilterRejection) => ({
  item_id: rejection.item_id,
  slot: rejection.slot,
  item_name: rejection.item_name,
  reasons: rejection.reasons,
});

export const serializeTraceBadCombinationRejection = (rejection: BadCombinationRejection) => ({
  candidate_id: rejection.candidate_id,
  top_id: rejection.top_id,
  bottom_id: rejection.bottom_id,
  footwear_id: rejection.footwear_id,
  reasons: rejection.reasons.map((reason) => ({
    reason: reason.reason,
    item_ids: reason.item_ids,
    subcategories: reason.subcategories,
    colors: reason.colors,
  })),
});
