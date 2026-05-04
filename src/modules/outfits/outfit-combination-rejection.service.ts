import type {
  GeneratedCandidate,
  OutfitGenerationClothingItem,
  OutfitIntent,
} from './outfit-generation.schemas';
import type { ClothingColor, ClothingSubcategory } from '../wardrobe/wardrobe.enums';

export type BadCombinationRejectionReason =
  | 'formal_shoes_with_shorts'
  | 'formal_shoes_with_joggers'
  | 'hoodie_with_formal_shoes'
  | 'formal_top_with_shorts'
  | 'formal_top_with_joggers'
  | 'formal_request_contains_casual_item'
  | 'formal_occasion_contains_casual_item'
  | 'dinner_date_joggers_with_sandals'
  | 'dinner_date_hoodie_with_sandals'
  | 'too_many_non_neutral_colors'
  | 'severe_color_clash';

export interface BadCombinationRejectionDetail {
  reason: BadCombinationRejectionReason;
  message: string;
  item_ids: string[];
  subcategories?: ClothingSubcategory[];
  colors?: ClothingColor[];
}

export interface BadCombinationRejection {
  candidate_id: string;
  top_id: string;
  bottom_id: string;
  footwear_id: string | null;
  reasons: BadCombinationRejectionDetail[];
  message: string;
}

export interface RejectBadOutfitCombinationsInput {
  intent: OutfitIntent;
  candidates: GeneratedCandidate[];
}

export interface RejectBadOutfitCombinationsDiagnostics {
  input_count: number;
  accepted_count: number;
  rejected_count: number;
}

export interface RejectBadOutfitCombinationsResult {
  candidates: GeneratedCandidate[];
  rejected: BadCombinationRejection[];
  diagnostics: RejectBadOutfitCombinationsDiagnostics;
}

const FORMAL_OCCASION_CASUAL_SUBCATEGORIES = [
  'hoodie',
  'tshirt',
  'shorts',
  'joggers',
  'sandals',
] as const satisfies readonly ClothingSubcategory[];

const NEUTRAL_COLORS = [
  'black',
  'white',
  'gray',
  'navy',
  'beige',
  'brown',
] as const satisfies readonly ClothingColor[];

const SEVERE_COLOR_CLASHES = [
  ['red', 'green'],
  ['yellow', 'red'],
  ['yellow', 'green'],
] as const satisfies readonly (readonly [ClothingColor, ClothingColor])[];

const includesColor = (colors: readonly ClothingColor[], color: ClothingColor): boolean => {
  return colors.includes(color);
};

const getItems = (candidate: GeneratedCandidate): OutfitGenerationClothingItem[] => {
  return candidate.footwear
    ? [candidate.top, candidate.bottom, candidate.footwear]
    : [candidate.top, candidate.bottom];
};

const getItemIdsBySubcategory = (
  candidate: GeneratedCandidate,
  subcategories: readonly ClothingSubcategory[],
): string[] => {
  return getItems(candidate)
    .filter((item) => subcategories.includes(item.subcategory))
    .map((item) => item.id);
};

const addReason = (
  reasons: BadCombinationRejectionDetail[],
  detail: BadCombinationRejectionDetail,
): void => {
  reasons.push(detail);
};

const addPairingRejections = (
  candidate: GeneratedCandidate,
  reasons: BadCombinationRejectionDetail[],
): void => {
  const formalShoes =
    candidate.footwear?.subcategory === 'formal_shoes' ? candidate.footwear : null;

  if (formalShoes && candidate.bottom.subcategory === 'shorts') {
    addReason(reasons, {
      reason: 'formal_shoes_with_shorts',
      message: 'Formal shoes with shorts is a clearly mismatched pairing.',
      item_ids: [candidate.bottom.id, formalShoes.id],
      subcategories: ['shorts', 'formal_shoes'],
    });
  }

  if (formalShoes && candidate.bottom.subcategory === 'joggers') {
    addReason(reasons, {
      reason: 'formal_shoes_with_joggers',
      message: 'Formal shoes with joggers is a clearly mismatched pairing.',
      item_ids: [candidate.bottom.id, formalShoes.id],
      subcategories: ['joggers', 'formal_shoes'],
    });
  }

  if (formalShoes && candidate.top.subcategory === 'hoodie') {
    addReason(reasons, {
      reason: 'hoodie_with_formal_shoes',
      message: 'A hoodie with formal shoes is a clearly mismatched pairing.',
      item_ids: [candidate.top.id, formalShoes.id],
      subcategories: ['hoodie', 'formal_shoes'],
    });
  }

  if (candidate.top.formality === 'formal' && candidate.bottom.subcategory === 'shorts') {
    addReason(reasons, {
      reason: 'formal_top_with_shorts',
      message: 'A formal top with shorts mixes incompatible formality extremes.',
      item_ids: [candidate.top.id, candidate.bottom.id],
      subcategories: [candidate.top.subcategory, 'shorts'],
    });
  }

  if (candidate.top.formality === 'formal' && candidate.bottom.subcategory === 'joggers') {
    addReason(reasons, {
      reason: 'formal_top_with_joggers',
      message: 'A formal top with joggers mixes incompatible formality extremes.',
      item_ids: [candidate.top.id, candidate.bottom.id],
      subcategories: [candidate.top.subcategory, 'joggers'],
    });
  }
};

const addOccasionAndFormalityRejections = (
  intent: OutfitIntent,
  candidate: GeneratedCandidate,
  reasons: BadCombinationRejectionDetail[],
): void => {
  const casualItemIds = getItemIdsBySubcategory(candidate, FORMAL_OCCASION_CASUAL_SUBCATEGORIES);

  if (casualItemIds.length === 0) {
    return;
  }

  if (intent.target_formality === 'formal') {
    addReason(reasons, {
      reason: 'formal_request_contains_casual_item',
      message: 'A formal request cannot contain clearly casual items.',
      item_ids: casualItemIds,
      subcategories: getItems(candidate)
        .filter((item) => casualItemIds.includes(item.id))
        .map((item) => item.subcategory),
    });
  }

  if (intent.occasion === 'wedding' || intent.occasion === 'interview') {
    addReason(reasons, {
      reason: 'formal_occasion_contains_casual_item',
      message: `${intent.occasion} outfits cannot contain clearly casual items.`,
      item_ids: casualItemIds,
      subcategories: getItems(candidate)
        .filter((item) => casualItemIds.includes(item.id))
        .map((item) => item.subcategory),
    });
  }
};

const addDinnerDateRejections = (
  intent: OutfitIntent,
  candidate: GeneratedCandidate,
  reasons: BadCombinationRejectionDetail[],
): void => {
  if (intent.occasion !== 'dinner' && intent.occasion !== 'date') {
    return;
  }

  const sandals = candidate.footwear?.subcategory === 'sandals' ? candidate.footwear : null;

  if (sandals && candidate.bottom.subcategory === 'joggers') {
    addReason(reasons, {
      reason: 'dinner_date_joggers_with_sandals',
      message: `${intent.occasion} outfits cannot pair joggers with sandals.`,
      item_ids: [candidate.bottom.id, sandals.id],
      subcategories: ['joggers', 'sandals'],
    });
  }

  if (sandals && candidate.top.subcategory === 'hoodie') {
    addReason(reasons, {
      reason: 'dinner_date_hoodie_with_sandals',
      message: `${intent.occasion} outfits cannot pair a hoodie with sandals.`,
      item_ids: [candidate.top.id, sandals.id],
      subcategories: ['hoodie', 'sandals'],
    });
  }
};

const addColorRejections = (
  candidate: GeneratedCandidate,
  reasons: BadCombinationRejectionDetail[],
): void => {
  const colors = getItems(candidate).map((item) => item.color);
  const nonNeutralColors = colors.filter((color) => !includesColor(NEUTRAL_COLORS, color));

  if (nonNeutralColors.length > 3) {
    addReason(reasons, {
      reason: 'too_many_non_neutral_colors',
      message: 'The outfit contains more than three non-neutral colors.',
      item_ids: getItems(candidate)
        .filter((item) => !includesColor(NEUTRAL_COLORS, item.color))
        .map((item) => item.id),
      colors: nonNeutralColors,
    });
  }

  for (const [left, right] of SEVERE_COLOR_CLASHES) {
    if (!colors.includes(left) || !colors.includes(right)) {
      continue;
    }

    addReason(reasons, {
      reason: 'severe_color_clash',
      message: `${left} and ${right} is a severe color clash for v1 generation.`,
      item_ids: getItems(candidate)
        .filter((item) => item.color === left || item.color === right)
        .map((item) => item.id),
      colors: [left, right],
    });
  }
};

const getCandidateRejectionReasons = (
  intent: OutfitIntent,
  candidate: GeneratedCandidate,
): BadCombinationRejectionDetail[] => {
  const reasons: BadCombinationRejectionDetail[] = [];

  addPairingRejections(candidate, reasons);
  addOccasionAndFormalityRejections(intent, candidate, reasons);
  addDinnerDateRejections(intent, candidate, reasons);
  addColorRejections(candidate, reasons);

  return reasons;
};

const buildRejectionMessage = (
  candidate: GeneratedCandidate,
  reasons: BadCombinationRejectionDetail[],
): string => {
  return `Rejected candidate ${candidate.id}: ${reasons.map((reason) => reason.reason).join(', ')}.`;
};

export const rejectBadOutfitCombinations = ({
  intent,
  candidates,
}: RejectBadOutfitCombinationsInput): RejectBadOutfitCombinationsResult => {
  const acceptedCandidates: GeneratedCandidate[] = [];
  const rejected: BadCombinationRejection[] = [];

  for (const candidate of candidates) {
    const reasons = getCandidateRejectionReasons(intent, candidate);

    if (reasons.length === 0) {
      acceptedCandidates.push(candidate);
      continue;
    }

    rejected.push({
      candidate_id: candidate.id,
      top_id: candidate.top.id,
      bottom_id: candidate.bottom.id,
      footwear_id: candidate.footwear?.id ?? null,
      reasons,
      message: buildRejectionMessage(candidate, reasons),
    });
  }

  return {
    candidates: acceptedCandidates,
    rejected,
    diagnostics: {
      input_count: candidates.length,
      accepted_count: acceptedCandidates.length,
      rejected_count: rejected.length,
    },
  };
};
