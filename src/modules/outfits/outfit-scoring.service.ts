import type {
  GeneratedCandidate,
  OutfitGenerationClothingItem,
  OutfitIntent,
  OutfitMood,
  OutfitOccasion,
  ScoreBreakdown,
  ScoredCandidate,
} from './outfit-generation.schemas';
import type {
  ClothingColor,
  ClothingFit,
  ClothingFormality,
  ClothingSubcategory,
} from '../wardrobe/wardrobe.enums';

export type ScoreComponent = keyof ScoreBreakdown;
type CandidateSlot = 'top' | 'bottom' | 'footwear';

type SlotSubcategoryPreferences = {
  tops: readonly ClothingSubcategory[];
  bottoms: readonly ClothingSubcategory[];
  footwear: readonly ClothingSubcategory[];
};

export interface ScoreDetail {
  component: ScoreComponent;
  points: number;
  max_points: number;
  reasons: string[];
}

export interface ScoredOutfitCandidate extends ScoredCandidate {
  scoring_metadata: {
    component_details: ScoreDetail[];
    candidate_features: {
      top_id: string;
      bottom_id: string;
      footwear_id: string | null;
      colors: ClothingColor[];
      subcategories: ClothingSubcategory[];
      formalities: ClothingFormality[];
      fits: Array<ClothingFit | null>;
      footwear_complete: boolean;
    };
  };
}

export interface ScoreOutfitCandidatesInput {
  intent: OutfitIntent;
  candidates: GeneratedCandidate[];
}

export interface ScoreOutfitCandidatesDiagnostics {
  input_count: number;
  scored_count: number;
  max_possible_score: number;
}

export interface ScoreOutfitCandidatesResult {
  candidates: ScoredOutfitCandidate[];
  diagnostics: ScoreOutfitCandidatesDiagnostics;
}

export const SCORE_COMPONENT_WEIGHTS: ScoreBreakdown = {
  occasion: 23,
  formality: 20,
  color: 22,
  mood: 12,
  fit: 8,
  preferences: 15,
};

const FORMALITY_VALUE: Record<ClothingFormality, number> = {
  casual: 1,
  smart_casual: 2,
  formal: 3,
};

const NEUTRAL_COLORS = [
  'black',
  'white',
  'gray',
  'navy',
  'beige',
  'brown',
] as const satisfies readonly ClothingColor[];

const STRONG_COLORS = ['red', 'green', 'yellow', 'blue'] as const satisfies readonly ClothingColor[];

const DARK_OR_NEUTRAL_COLORS = [
  'black',
  'gray',
  'navy',
  'brown',
  'white',
  'beige',
] as const satisfies readonly ClothingColor[];

const HIGH_COMPATIBILITY_COLOR_PAIRS = [
  ['navy', 'white'],
  ['navy', 'beige'],
  ['black', 'white'],
  ['gray', 'black'],
  ['blue', 'white'],
  ['brown', 'beige'],
] as const satisfies readonly (readonly [ClothingColor, ClothingColor])[];

const LOW_COMPATIBILITY_COLOR_PAIRS = [
  ['red', 'green'],
  ['yellow', 'red'],
  ['yellow', 'green'],
] as const satisfies readonly (readonly [ClothingColor, ClothingColor])[];

const OCCASION_PROFILES: Record<OutfitOccasion, SlotSubcategoryPreferences> = {
  casual_hangout: {
    tops: ['tshirt', 'polo', 'hoodie', 'sweater'],
    bottoms: ['jeans', 'chinos', 'shorts', 'joggers'],
    footwear: ['sneakers', 'sandals'],
  },
  office: {
    tops: ['shirt', 'polo', 'sweater'],
    bottoms: ['chinos', 'trousers'],
    footwear: ['formal_shoes', 'sneakers'],
  },
  dinner: {
    tops: ['shirt', 'polo', 'sweater'],
    bottoms: ['chinos', 'jeans', 'trousers'],
    footwear: ['sneakers', 'formal_shoes'],
  },
  date: {
    tops: ['shirt', 'polo', 'sweater'],
    bottoms: ['chinos', 'jeans', 'trousers'],
    footwear: ['sneakers', 'formal_shoes'],
  },
  party: {
    tops: ['shirt', 'polo', 'tshirt', 'sweater'],
    bottoms: ['jeans', 'chinos', 'trousers'],
    footwear: ['sneakers', 'formal_shoes'],
  },
  wedding: {
    tops: ['shirt', 'sweater'],
    bottoms: ['trousers', 'chinos'],
    footwear: ['formal_shoes'],
  },
  interview: {
    tops: ['shirt', 'sweater'],
    bottoms: ['trousers', 'chinos'],
    footwear: ['formal_shoes'],
  },
  travel: {
    tops: ['tshirt', 'polo', 'hoodie', 'sweater'],
    bottoms: ['jeans', 'chinos', 'joggers'],
    footwear: ['sneakers', 'sandals'],
  },
  errand: {
    tops: ['tshirt', 'polo', 'hoodie', 'sweater'],
    bottoms: ['jeans', 'shorts', 'joggers', 'chinos'],
    footwear: ['sneakers', 'sandals'],
  },
  unknown: {
    tops: ['shirt', 'polo', 'tshirt', 'sweater'],
    bottoms: ['chinos', 'jeans', 'trousers'],
    footwear: ['sneakers', 'formal_shoes'],
  },
};

const MOOD_PROFILES: Record<
  OutfitMood,
  {
    subcategories: readonly ClothingSubcategory[];
    fits: readonly ClothingFit[];
    colors: readonly ClothingColor[];
    lowColorCount?: boolean;
    higherContrast?: boolean;
  }
> = {
  relaxed: {
    subcategories: ['tshirt', 'polo', 'sweater', 'jeans', 'chinos', 'sneakers'],
    fits: ['regular', 'oversized'],
    colors: ['white', 'gray', 'blue', 'navy', 'beige'],
  },
  sharp: {
    subcategories: ['shirt', 'trousers', 'chinos', 'formal_shoes'],
    fits: ['slim', 'regular'],
    colors: ['black', 'white', 'gray', 'navy'],
  },
  minimal: {
    subcategories: ['shirt', 'tshirt', 'polo', 'chinos', 'trousers', 'sneakers'],
    fits: ['regular', 'slim'],
    colors: NEUTRAL_COLORS,
    lowColorCount: true,
  },
  bold: {
    subcategories: ['tshirt', 'shirt', 'hoodie', 'jeans', 'sneakers'],
    fits: ['slim', 'regular', 'oversized'],
    colors: STRONG_COLORS,
    higherContrast: true,
  },
  cozy: {
    subcategories: ['hoodie', 'sweater', 'joggers', 'jeans', 'sneakers'],
    fits: ['regular', 'oversized'],
    colors: ['gray', 'navy', 'beige', 'brown', 'green'],
  },
  sporty: {
    subcategories: ['tshirt', 'hoodie', 'joggers', 'sneakers'],
    fits: ['regular', 'oversized'],
    colors: ['black', 'white', 'gray', 'blue', 'red'],
  },
  elegant: {
    subcategories: ['shirt', 'sweater', 'trousers', 'formal_shoes'],
    fits: ['slim', 'regular'],
    colors: DARK_OR_NEUTRAL_COLORS,
  },
};

const clamp = (value: number, min: number, max: number): number => {
  return Math.min(max, Math.max(min, value));
};

const roundScore = (value: number): number => {
  return Math.round(value);
};

const includesValue = <Value>(values: readonly Value[], value: Value): boolean => {
  return values.includes(value);
};

const getCandidateItems = (candidate: GeneratedCandidate): OutfitGenerationClothingItem[] => {
  return candidate.footwear
    ? [candidate.top, candidate.bottom, candidate.footwear]
    : [candidate.top, candidate.bottom];
};

const getCandidateColors = (candidate: GeneratedCandidate): ClothingColor[] => {
  return getCandidateItems(candidate).map((item) => item.color);
};

const getCandidateSubcategories = (candidate: GeneratedCandidate): ClothingSubcategory[] => {
  return getCandidateItems(candidate).map((item) => item.subcategory);
};

const getCandidateFits = (candidate: GeneratedCandidate): Array<ClothingFit | null> => {
  return getCandidateItems(candidate).map((item) => item.fit);
};

const isColorPair = (
  colorPair: readonly [ClothingColor, ClothingColor],
  left: ClothingColor,
  right: ClothingColor,
): boolean => {
  return (
    (colorPair[0] === left && colorPair[1] === right) ||
    (colorPair[0] === right && colorPair[1] === left)
  );
};

const hasPair = (
  pairs: readonly (readonly [ClothingColor, ClothingColor])[],
  left: ClothingColor,
  right: ClothingColor,
): boolean => {
  return pairs.some((pair) => isColorPair(pair, left, right));
};

const isNeutralColor = (color: ClothingColor): boolean => {
  return includesValue(NEUTRAL_COLORS, color);
};

const isStrongColor = (color: ClothingColor): boolean => {
  return includesValue(STRONG_COLORS, color);
};

const getUniqueCount = <Value>(values: Value[]): number => {
  return new Set(values).size;
};

const scoreOccasion = (intent: OutfitIntent, candidate: GeneratedCandidate): ScoreDetail => {
  const profile = OCCASION_PROFILES[intent.occasion];
  const topScore = profile.tops.includes(candidate.top.subcategory) ? 9 : 3;
  const bottomScore = profile.bottoms.includes(candidate.bottom.subcategory) ? 9 : 3;
  const footwearScore = candidate.footwear
    ? profile.footwear.includes(candidate.footwear.subcategory)
      ? 7
      : 2
    : 0;
  const points = clamp(topScore + bottomScore + footwearScore, 0, SCORE_COMPONENT_WEIGHTS.occasion);
  const reasons = [
    `${candidate.top.subcategory} top scored ${topScore}/9 for ${intent.occasion}.`,
    `${candidate.bottom.subcategory} bottom scored ${bottomScore}/9 for ${intent.occasion}.`,
    candidate.footwear
      ? `${candidate.footwear.subcategory} footwear scored ${footwearScore}/7 for ${intent.occasion}.`
      : 'No footwear was present, so footwear occasion suitability scored 0/7.',
  ];

  return {
    component: 'occasion',
    points,
    max_points: SCORE_COMPONENT_WEIGHTS.occasion,
    reasons,
  };
};

const scoreFormality = (intent: OutfitIntent, candidate: GeneratedCandidate): ScoreDetail => {
  const items = getCandidateItems(candidate);
  const formalities = items.map((item) => item.formality);
  const averageFormality =
    formalities.reduce((sum, formality) => sum + FORMALITY_VALUE[formality], 0) /
    formalities.length;
  const targetFormality = FORMALITY_VALUE[intent.target_formality];
  const distance = Math.abs(averageFormality - targetFormality);
  const uniqueFormalities = new Set(formalities);
  const mixesExtremes = uniqueFormalities.has('casual') && uniqueFormalities.has('formal');
  let baseScore = 0;

  if (distance <= 0.25) {
    baseScore = 20;
  } else if (distance <= 0.75) {
    baseScore = 15;
  } else if (distance <= 1.25) {
    baseScore = 8;
  }

  const extremePenalty = mixesExtremes ? 3 : 0;
  const points = clamp(baseScore - extremePenalty, 0, SCORE_COMPONENT_WEIGHTS.formality);
  const reasons = [
    `Average formality ${averageFormality.toFixed(2)} compared with target ${intent.target_formality}.`,
    `Formality distance ${distance.toFixed(2)} produced a base score of ${baseScore}/20.`,
  ];

  if (mixesExtremes) {
    reasons.push('Mixed casual and formal pieces, so an extremes penalty was applied.');
  }

  return {
    component: 'formality',
    points,
    max_points: SCORE_COMPONENT_WEIGHTS.formality,
    reasons,
  };
};

const getColorPairScore = (left: ClothingColor, right: ClothingColor): number => {
  if (left === right) {
    return isNeutralColor(left) ? 5 : 3;
  }

  if (hasPair(HIGH_COMPATIBILITY_COLOR_PAIRS, left, right)) {
    return 6;
  }

  if (hasPair(LOW_COMPATIBILITY_COLOR_PAIRS, left, right)) {
    return 0;
  }

  if (left === 'white' || right === 'white') {
    return 5;
  }

  if (isNeutralColor(left) && isNeutralColor(right)) {
    return 5;
  }

  if (isNeutralColor(left) || isNeutralColor(right)) {
    return 4;
  }

  return 2;
};

const scoreColor = (candidate: GeneratedCandidate): ScoreDetail => {
  const colorPairs: Array<[CandidateSlot, CandidateSlot, ClothingColor, ClothingColor]> = [
    ['top', 'bottom', candidate.top.color, candidate.bottom.color],
  ];

  if (candidate.footwear) {
    colorPairs.push(['top', 'footwear', candidate.top.color, candidate.footwear.color]);
    colorPairs.push(['bottom', 'footwear', candidate.bottom.color, candidate.footwear.color]);
  }

  const pairScores = colorPairs.map(([, , leftColor, rightColor]) =>
    getColorPairScore(leftColor, rightColor),
  );
  const maxPairScore = colorPairs.length * 6;
  const pairScore =
    maxPairScore === 0
      ? 0
      : (pairScores.reduce((sum, score) => sum + score, 0) / maxPairScore) * 20;
  const colors = getCandidateColors(candidate);
  const strongColorCount = colors.filter(isStrongColor).length;
  const strongColorBonus = strongColorCount <= 1 ? 3 : 0;
  const neutralFootwearBonus =
    candidate.footwear && isNeutralColor(candidate.footwear.color) ? 2 : 0;
  const points = roundScore(
    clamp(pairScore + strongColorBonus + neutralFootwearBonus, 0, SCORE_COMPONENT_WEIGHTS.color),
  );
  const reasons = colorPairs.map(([leftSlot, rightSlot, leftColor, rightColor], index) => {
    return `${leftSlot}-${rightSlot} colors ${leftColor} + ${rightColor} scored ${pairScores[index]}/6.`;
  });

  if (strongColorBonus > 0) {
    reasons.push('At most one strong color was present, adding a small harmony bonus.');
  }

  if (neutralFootwearBonus > 0) {
    reasons.push('Footwear color was neutral, adding a small grounding bonus.');
  } else if (!candidate.footwear) {
    reasons.push('No footwear was present, so no footwear color bonus was available.');
  }

  return {
    component: 'color',
    points,
    max_points: SCORE_COMPONENT_WEIGHTS.color,
    reasons,
  };
};

const scoreSingleMood = (mood: OutfitMood, candidate: GeneratedCandidate): number => {
  const profile = MOOD_PROFILES[mood];
  const items = getCandidateItems(candidate);
  const subcategoryHits = items.filter((item) =>
    profile.subcategories.includes(item.subcategory),
  ).length;
  const fitHits = items.filter((item) => item.fit && profile.fits.includes(item.fit)).length;
  const colorHits = items.filter((item) => profile.colors.includes(item.color)).length;
  const colors = getCandidateColors(candidate);
  const lowColorCountBonus = profile.lowColorCount && getUniqueCount(colors) <= 2 ? 2 : 0;
  const contrastBonus =
    profile.higherContrast && colors.some(isStrongColor) && colors.some(isNeutralColor) ? 2 : 0;
  const subcategoryScore = Math.min(6, subcategoryHits * 2);
  const fitScore = Math.min(3, fitHits);
  const colorScore = Math.min(4, colorHits);

  return clamp(
    subcategoryScore + fitScore + colorScore + lowColorCountBonus + contrastBonus,
    0,
    SCORE_COMPONENT_WEIGHTS.mood,
  );
};

const scoreMood = (intent: OutfitIntent, candidate: GeneratedCandidate): ScoreDetail => {
  if (intent.moods.length === 0) {
    return {
      component: 'mood',
      points: SCORE_COMPONENT_WEIGHTS.mood,
      max_points: SCORE_COMPONENT_WEIGHTS.mood,
      reasons: ['No mood was requested, so a neutral mood score was assigned.'],
    };
  }

  const moodScores = intent.moods.map((mood) => ({
    mood,
    score: scoreSingleMood(mood, candidate),
  }));
  const points = roundScore(
    moodScores.reduce((sum, moodScore) => sum + moodScore.score, 0) / moodScores.length,
  );

  return {
    component: 'mood',
    points,
    max_points: SCORE_COMPONENT_WEIGHTS.mood,
    reasons: moodScores.map(
      ({ mood, score }) => `${mood} mood scored ${score}/${SCORE_COMPONENT_WEIGHTS.mood}.`,
    ),
  };
};

const scoreFit = (candidate: GeneratedCandidate): ScoreDetail => {
  const topFit = candidate.top.fit;
  const bottomFit = candidate.bottom.fit;
  let points = 5;
  let reason = 'At least one fit was unknown, so a neutral silhouette score was assigned.';

  if (topFit && bottomFit) {
    if (topFit === 'regular' && bottomFit === 'regular') {
      points = 8;
      reason = 'Regular top with regular bottom gives a balanced silhouette.';
    } else if (topFit === 'oversized' && (bottomFit === 'slim' || bottomFit === 'regular')) {
      points = 7;
      reason = 'Oversized top with slim or regular bottom gives a balanced relaxed silhouette.';
    } else if (topFit === 'slim' && bottomFit === 'regular') {
      points = 7;
      reason = 'Slim top with regular bottom gives a clean silhouette.';
    } else if (topFit === 'oversized' && bottomFit === 'oversized') {
      points = 4;
      reason = 'Oversized top with oversized bottom can look less structured.';
    } else if (topFit === 'slim' && bottomFit === 'slim') {
      points = 6;
      reason = 'Slim top with slim bottom is cohesive but less relaxed.';
    } else {
      points = 6;
      reason = `${topFit} top with ${bottomFit} bottom is a workable silhouette.`;
    }
  }

  return {
    component: 'fit',
    points,
    max_points: SCORE_COMPONENT_WEIGHTS.fit,
    reasons: [reason],
  };
};

const includesSubcategory = (
  subcategories: readonly ClothingSubcategory[],
  subcategory: ClothingSubcategory,
): boolean => {
  return subcategories.includes(subcategory);
};

const getPreferredSubcategoryMatches = (
  intent: OutfitIntent,
  candidate: GeneratedCandidate,
): number => {
  let matches = 0;

  if (includesSubcategory(intent.soft_preferences.preferred_top_subcategories, candidate.top.subcategory)) {
    matches += 1;
  }

  if (includesSubcategory(intent.soft_preferences.preferred_bottom_subcategories, candidate.bottom.subcategory)) {
    matches += 1;
  }

  if (
    candidate.footwear &&
    includesSubcategory(intent.soft_preferences.preferred_footwear_subcategories, candidate.footwear.subcategory)
  ) {
    matches += 1;
  }

  return matches;
};

const getPreferredSlotColorMatches = (
  intent: OutfitIntent,
  candidate: GeneratedCandidate,
): number => {
  let matches = 0;

  if (intent.soft_preferences.preferred_top_colors.includes(candidate.top.color)) {
    matches += 1;
  }

  if (intent.soft_preferences.preferred_bottom_colors.includes(candidate.bottom.color)) {
    matches += 1;
  }

  if (
    candidate.footwear &&
    intent.soft_preferences.preferred_footwear_colors.includes(candidate.footwear.color)
  ) {
    matches += 1;
  }

  return matches;
};

const scorePreferences = (intent: OutfitIntent, candidate: GeneratedCandidate): ScoreDetail => {
  const items = getCandidateItems(candidate);
  const preferredColorMatches = items.filter((item) =>
    intent.soft_preferences.preferred_colors.includes(item.color),
  ).length;
  const preferredSlotColorMatches = getPreferredSlotColorMatches(intent, candidate);
  const preferredSubcategoryMatches = getPreferredSubcategoryMatches(intent, candidate);
  const preferredFitMatches = items.filter(
    (item) => item.fit && intent.soft_preferences.preferred_fits.includes(item.fit),
  ).length;
  const colorScore = Math.min(10, preferredColorMatches * 10);
  const slotColorScore = Math.min(12, preferredSlotColorMatches * 12);
  const subcategoryScore = Math.min(4, preferredSubcategoryMatches * 2);
  const fitScore = Math.min(2, preferredFitMatches);
  const points = clamp(
    colorScore + slotColorScore + subcategoryScore + fitScore,
    0,
    SCORE_COMPONENT_WEIGHTS.preferences,
  );
  const reasons = [
    preferredColorMatches > 0
      ? `${preferredColorMatches} item(s) matched generic preferred colors.`
      : 'No items matched generic preferred colors.',
    preferredSlotColorMatches > 0
      ? `${preferredSlotColorMatches} item(s) matched slot-specific preferred colors.`
      : 'No items matched slot-specific preferred colors.',
    preferredSubcategoryMatches > 0
      ? `${preferredSubcategoryMatches} slot subcategory preference(s) matched.`
      : 'No slot subcategory preferences matched.',
    preferredFitMatches > 0
      ? `${preferredFitMatches} item(s) matched preferred fits.`
      : 'No items matched preferred fits.',
  ];

  return {
    component: 'preferences',
    points,
    max_points: SCORE_COMPONENT_WEIGHTS.preferences,
    reasons,
  };
};

const buildScoreBreakdown = (details: ScoreDetail[]): ScoreBreakdown => {
  return {
    occasion: details.find((detail) => detail.component === 'occasion')?.points ?? 0,
    formality: details.find((detail) => detail.component === 'formality')?.points ?? 0,
    color: details.find((detail) => detail.component === 'color')?.points ?? 0,
    mood: details.find((detail) => detail.component === 'mood')?.points ?? 0,
    fit: details.find((detail) => detail.component === 'fit')?.points ?? 0,
    preferences: details.find((detail) => detail.component === 'preferences')?.points ?? 0,
  };
};

const getTotalScore = (breakdown: ScoreBreakdown): number => {
  return clamp(
    breakdown.occasion +
      breakdown.formality +
      breakdown.color +
      breakdown.mood +
      breakdown.fit +
      breakdown.preferences,
    0,
    100,
  );
};

const scoreCandidate = (intent: OutfitIntent, candidate: GeneratedCandidate): ScoredOutfitCandidate => {
  const componentDetails = [
    scoreOccasion(intent, candidate),
    scoreFormality(intent, candidate),
    scoreColor(candidate),
    scoreMood(intent, candidate),
    scoreFit(candidate),
    scorePreferences(intent, candidate),
  ];
  const scoreBreakdown = buildScoreBreakdown(componentDetails);

  return {
    candidate,
    score: getTotalScore(scoreBreakdown),
    score_breakdown: scoreBreakdown,
    scoring_metadata: {
      component_details: componentDetails,
      candidate_features: {
        top_id: candidate.top.id,
        bottom_id: candidate.bottom.id,
        footwear_id: candidate.footwear?.id ?? null,
        colors: getCandidateColors(candidate),
        subcategories: getCandidateSubcategories(candidate),
        formalities: getCandidateItems(candidate).map((item) => item.formality),
        fits: getCandidateFits(candidate),
        footwear_complete: candidate.footwear !== null,
      },
    },
  };
};

export const scoreOutfitCandidates = ({
  intent,
  candidates,
}: ScoreOutfitCandidatesInput): ScoreOutfitCandidatesResult => {
  return {
    candidates: candidates.map((candidate) => scoreCandidate(intent, candidate)),
    diagnostics: {
      input_count: candidates.length,
      scored_count: candidates.length,
      max_possible_score: 100,
    },
  };
};
