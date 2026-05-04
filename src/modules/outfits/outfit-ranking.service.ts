import type { RankedCandidate, ScoredCandidate } from './outfit-generation.schemas';

export type RankingSelectionPhase = 'diversity_pass' | 'relaxed_fill' | 'preference_promotion';

export type RankingDiversityReason =
  | 'same_top'
  | 'same_bottom'
  | 'same_footwear'
  | 'same_color_signature'
  | 'same_subcategory_signature';

export interface RankingDiversityLimits {
  max_same_top: number;
  max_same_bottom: number;
  max_same_footwear: number;
  max_same_color_signature: number;
  max_same_subcategory_signature: number;
}

export interface RankingOptions extends RankingDiversityLimits {
  limit: number;
  preference_promotion_margin: number;
}

export interface RankingDiversitySignatures {
  top_id: string;
  bottom_id: string;
  footwear_id: string | null;
  color_signature: string;
  subcategory_signature: string;
}

export interface RankingDiversityViolation {
  reason: RankingDiversityReason;
  signature: string;
  current_count: number;
  max_allowed: number;
  message: string;
}

export interface RankingMetadata {
  input_index: number;
  sorted_index: number;
  selection_phase: RankingSelectionPhase;
  diversity_signatures: RankingDiversitySignatures;
  diversity_violations: RankingDiversityViolation[];
}

export type RankedOutfitCandidate<Candidate extends ScoredCandidate = ScoredCandidate> = Candidate &
  RankedCandidate & {
    ranking_metadata: RankingMetadata;
  };

export interface RankingDiversitySkip {
  candidate_id: string;
  input_index: number;
  sorted_index: number;
  score: number;
  reasons: RankingDiversityViolation[];
}

export interface RankOutfitCandidatesInput<Candidate extends ScoredCandidate = ScoredCandidate> {
  candidates: Candidate[];
  options?: Partial<RankingOptions>;
}

export interface RankOutfitCandidatesDiagnostics {
  input_count: number;
  sorted_count: number;
  selected_count: number;
  limit: number;
  selected_from_diversity_pass_count: number;
  selected_from_relaxed_fill_count: number;
  selected_from_preference_promotion_count: number;
  deferred_for_diversity_count: number;
  skipped_for_diversity_count: number;
  preference_promotion_applied: boolean;
  preference_promotion_margin: number;
  preference_promoted_candidate_id: string | null;
  final_ordering_basis: string;
  diversity_limits: RankingDiversityLimits;
}

export interface RankOutfitCandidatesResult<Candidate extends ScoredCandidate = ScoredCandidate> {
  candidates: Array<RankedOutfitCandidate<Candidate>>;
  skipped_for_diversity: RankingDiversitySkip[];
  diagnostics: RankOutfitCandidatesDiagnostics;
}

interface IndexedScoredCandidate<Candidate extends ScoredCandidate> {
  candidate: Candidate;
  inputIndex: number;
}

interface DeferredCandidate<Candidate extends ScoredCandidate> {
  indexedCandidate: IndexedScoredCandidate<Candidate>;
  sortedIndex: number;
  reasons: RankingDiversityViolation[];
}

interface SelectedCandidate<Candidate extends ScoredCandidate> {
  indexedCandidate: IndexedScoredCandidate<Candidate>;
  sortedIndex: number;
  selectionPhase: RankingSelectionPhase;
  signatures: RankingDiversitySignatures;
  violations: RankingDiversityViolation[];
}

interface DiversityCounts {
  topIds: Map<string, number>;
  bottomIds: Map<string, number>;
  footwearIds: Map<string, number>;
  colorSignatures: Map<string, number>;
  subcategorySignatures: Map<string, number>;
}

export const DEFAULT_RANKING_OPTIONS: RankingOptions = {
  limit: 10,
  max_same_top: 2,
  max_same_bottom: 2,
  max_same_footwear: 2,
  max_same_color_signature: 1,
  max_same_subcategory_signature: 2,
  preference_promotion_margin: 12,
};

const FINAL_ORDERING_BASIS =
  'selected_by_greedy_diversity_with_near_quality_preference_promotion_then_ordered_by_score_desc_input_order_tie_breaker';

const normalizeNonNegativeInteger = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.trunc(value));
};

const normalizePositiveInteger = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 1;
  }

  return Math.max(1, Math.trunc(value));
};

const normalizeOptions = (options: Partial<RankingOptions> = {}): RankingOptions => {
  return {
    limit: normalizeNonNegativeInteger(options.limit ?? DEFAULT_RANKING_OPTIONS.limit),
    max_same_top: normalizePositiveInteger(
      options.max_same_top ?? DEFAULT_RANKING_OPTIONS.max_same_top,
    ),
    max_same_bottom: normalizePositiveInteger(
      options.max_same_bottom ?? DEFAULT_RANKING_OPTIONS.max_same_bottom,
    ),
    max_same_footwear: normalizePositiveInteger(
      options.max_same_footwear ?? DEFAULT_RANKING_OPTIONS.max_same_footwear,
    ),
    max_same_color_signature: normalizePositiveInteger(
      options.max_same_color_signature ?? DEFAULT_RANKING_OPTIONS.max_same_color_signature,
    ),
    max_same_subcategory_signature: normalizePositiveInteger(
      options.max_same_subcategory_signature ??
        DEFAULT_RANKING_OPTIONS.max_same_subcategory_signature,
    ),
    preference_promotion_margin: normalizeNonNegativeInteger(
      options.preference_promotion_margin ?? DEFAULT_RANKING_OPTIONS.preference_promotion_margin,
    ),
  };
};

const getMapCount = (map: Map<string, number>, key: string): number => {
  return map.get(key) ?? 0;
};

const incrementMapCount = (map: Map<string, number>, key: string): void => {
  map.set(key, getMapCount(map, key) + 1);
};

const createDiversityCounts = (): DiversityCounts => ({
  topIds: new Map(),
  bottomIds: new Map(),
  footwearIds: new Map(),
  colorSignatures: new Map(),
  subcategorySignatures: new Map(),
});

const getDiversitySignatures = (candidate: ScoredCandidate): RankingDiversitySignatures => {
  const { top, bottom, footwear } = candidate.candidate;

  return {
    top_id: top.id,
    bottom_id: bottom.id,
    footwear_id: footwear?.id ?? null,
    color_signature: [top.color, bottom.color, footwear?.color ?? 'no_footwear'].join('|'),
    subcategory_signature: [
      top.subcategory,
      bottom.subcategory,
      footwear?.subcategory ?? 'no_footwear',
    ].join('|'),
  };
};

const buildViolation = (
  reason: RankingDiversityReason,
  signature: string,
  currentCount: number,
  maxAllowed: number,
): RankingDiversityViolation => ({
  reason,
  signature,
  current_count: currentCount,
  max_allowed: maxAllowed,
  message: `${reason} diversity limit reached for '${signature}' (${currentCount}/${maxAllowed}).`,
});

const getDiversityViolations = (
  signatures: RankingDiversitySignatures,
  counts: DiversityCounts,
  limits: RankingDiversityLimits,
): RankingDiversityViolation[] => {
  const violations: RankingDiversityViolation[] = [];
  const topCount = getMapCount(counts.topIds, signatures.top_id);
  const bottomCount = getMapCount(counts.bottomIds, signatures.bottom_id);
  const colorSignatureCount = getMapCount(counts.colorSignatures, signatures.color_signature);
  const subcategorySignatureCount = getMapCount(
    counts.subcategorySignatures,
    signatures.subcategory_signature,
  );

  if (topCount >= limits.max_same_top) {
    violations.push(buildViolation('same_top', signatures.top_id, topCount, limits.max_same_top));
  }

  if (bottomCount >= limits.max_same_bottom) {
    violations.push(
      buildViolation('same_bottom', signatures.bottom_id, bottomCount, limits.max_same_bottom),
    );
  }

  if (signatures.footwear_id) {
    const footwearCount = getMapCount(counts.footwearIds, signatures.footwear_id);

    if (footwearCount >= limits.max_same_footwear) {
      violations.push(
        buildViolation(
          'same_footwear',
          signatures.footwear_id,
          footwearCount,
          limits.max_same_footwear,
        ),
      );
    }
  }

  if (colorSignatureCount >= limits.max_same_color_signature) {
    violations.push(
      buildViolation(
        'same_color_signature',
        signatures.color_signature,
        colorSignatureCount,
        limits.max_same_color_signature,
      ),
    );
  }

  if (subcategorySignatureCount >= limits.max_same_subcategory_signature) {
    violations.push(
      buildViolation(
        'same_subcategory_signature',
        signatures.subcategory_signature,
        subcategorySignatureCount,
        limits.max_same_subcategory_signature,
      ),
    );
  }

  return violations;
};

const addCandidateToCounts = (
  signatures: RankingDiversitySignatures,
  counts: DiversityCounts,
): void => {
  incrementMapCount(counts.topIds, signatures.top_id);
  incrementMapCount(counts.bottomIds, signatures.bottom_id);
  incrementMapCount(counts.colorSignatures, signatures.color_signature);
  incrementMapCount(counts.subcategorySignatures, signatures.subcategory_signature);

  if (signatures.footwear_id) {
    incrementMapCount(counts.footwearIds, signatures.footwear_id);
  }
};

const sortCandidates = <Candidate extends ScoredCandidate>(
  candidates: Candidate[],
): Array<IndexedScoredCandidate<Candidate>> => {
  return candidates
    .map((candidate, inputIndex): IndexedScoredCandidate<Candidate> => ({ candidate, inputIndex }))
    .sort((left, right) => {
      const scoreDifference = right.candidate.score - left.candidate.score;

      if (scoreDifference !== 0) {
        return scoreDifference;
      }

      return left.inputIndex - right.inputIndex;
    });
};

const rankCandidate = <Candidate extends ScoredCandidate>(
  indexedCandidate: IndexedScoredCandidate<Candidate>,
  rank: number,
  sortedIndex: number,
  selectionPhase: RankingSelectionPhase,
  diversitySignatures: RankingDiversitySignatures,
  diversityViolations: RankingDiversityViolation[],
): RankedOutfitCandidate<Candidate> => {
  return {
    ...indexedCandidate.candidate,
    rank,
    ranking_metadata: {
      input_index: indexedCandidate.inputIndex,
      sorted_index: sortedIndex,
      selection_phase: selectionPhase,
      diversity_signatures: diversitySignatures,
      diversity_violations: diversityViolations,
    },
  };
};

const buildSkip = <Candidate extends ScoredCandidate>(
  deferredCandidate: DeferredCandidate<Candidate>,
): RankingDiversitySkip => ({
  candidate_id: deferredCandidate.indexedCandidate.candidate.candidate.id,
  input_index: deferredCandidate.indexedCandidate.inputIndex,
  sorted_index: deferredCandidate.sortedIndex,
  score: deferredCandidate.indexedCandidate.candidate.score,
  reasons: deferredCandidate.reasons,
});

const findSelectedIndex = <Candidate extends ScoredCandidate>(
  selected: Array<SelectedCandidate<Candidate>>,
  candidate: Candidate,
): number => {
  return selected.findIndex(
    (selectedCandidate) => selectedCandidate.indexedCandidate.candidate === candidate,
  );
};

const findDeferredCandidate = <Candidate extends ScoredCandidate>(
  deferredForDiversity: Array<DeferredCandidate<Candidate>>,
  candidate: Candidate,
): DeferredCandidate<Candidate> | undefined => {
  return deferredForDiversity.find(
    (deferredCandidate) => deferredCandidate.indexedCandidate.candidate === candidate,
  );
};

export const rankOutfitCandidates = <Candidate extends ScoredCandidate = ScoredCandidate>({
  candidates,
  options: optionOverrides = {},
}: RankOutfitCandidatesInput<Candidate>): RankOutfitCandidatesResult<Candidate> => {
  const options = normalizeOptions(optionOverrides);
  const sortedCandidates = sortCandidates(candidates);
  const counts = createDiversityCounts();
  const selected: Array<SelectedCandidate<Candidate>> = [];
  const deferredForDiversity: Array<DeferredCandidate<Candidate>> = [];
  const relaxedSelected = new Set<Candidate>();

  if (options.limit > 0) {
    for (const [sortedIndex, indexedCandidate] of sortedCandidates.entries()) {
      if (selected.length >= options.limit) {
        break;
      }

      const signatures = getDiversitySignatures(indexedCandidate.candidate);
      const violations = getDiversityViolations(signatures, counts, options);

      if (violations.length > 0) {
        deferredForDiversity.push({
          indexedCandidate,
          sortedIndex,
          reasons: violations,
        });
        continue;
      }

      addCandidateToCounts(signatures, counts);
      selected.push({
        indexedCandidate,
        sortedIndex,
        selectionPhase: 'diversity_pass',
        signatures,
        violations: [],
      });
    }

    for (const deferredCandidate of deferredForDiversity) {
      if (selected.length >= options.limit) {
        break;
      }

      const signatures = getDiversitySignatures(deferredCandidate.indexedCandidate.candidate);

      addCandidateToCounts(signatures, counts);
      selected.push({
        indexedCandidate: deferredCandidate.indexedCandidate,
        sortedIndex: deferredCandidate.sortedIndex,
        selectionPhase: 'relaxed_fill',
        signatures,
        violations: deferredCandidate.reasons,
      });
      relaxedSelected.add(deferredCandidate.indexedCandidate.candidate);
    }
  }

  const topSelected = selected[0]?.indexedCandidate.candidate ?? null;
  let preferencePromotionApplied = false;
  let preferencePromotedCandidateId: string | null = null;

  if (topSelected) {
    const preferencePromotionCandidate = sortedCandidates.find(({ candidate }) => {
      return (
        candidate.score_breakdown.preferences > topSelected.score_breakdown.preferences &&
        topSelected.score - candidate.score <= options.preference_promotion_margin
      );
    });

    if (preferencePromotionCandidate) {
      const existingSelectedIndex = findSelectedIndex(
        selected,
        preferencePromotionCandidate.candidate,
      );
      let promotedSelection: SelectedCandidate<Candidate>;

      if (existingSelectedIndex >= 0) {
        promotedSelection = {
          ...selected[existingSelectedIndex],
          selectionPhase: 'preference_promotion',
        };
        selected.splice(existingSelectedIndex, 1);
      } else {
        const sortedIndex = sortedCandidates.findIndex(
          ({ candidate }) => candidate === preferencePromotionCandidate.candidate,
        );
        const deferredCandidate = findDeferredCandidate(
          deferredForDiversity,
          preferencePromotionCandidate.candidate,
        );

        promotedSelection = {
          indexedCandidate: preferencePromotionCandidate,
          sortedIndex,
          selectionPhase: 'preference_promotion',
          signatures: getDiversitySignatures(preferencePromotionCandidate.candidate),
          violations: deferredCandidate?.reasons ?? [],
        };

        if (selected.length >= options.limit) {
          selected.pop();
        }
      }

      selected.unshift(promotedSelection);
      preferencePromotionApplied = true;
      preferencePromotedCandidateId = preferencePromotionCandidate.candidate.candidate.id;
    }
  }

  const rankedCandidates = [...selected]
    .sort((left, right) => {
      if (
        left.selectionPhase === 'preference_promotion' &&
        right.selectionPhase !== 'preference_promotion'
      ) {
        return -1;
      }

      if (
        right.selectionPhase === 'preference_promotion' &&
        left.selectionPhase !== 'preference_promotion'
      ) {
        return 1;
      }

      return left.sortedIndex - right.sortedIndex;
    })
    .map((selectedCandidate, index) =>
      rankCandidate(
        selectedCandidate.indexedCandidate,
        index + 1,
        selectedCandidate.sortedIndex,
        selectedCandidate.selectionPhase,
        selectedCandidate.signatures,
        selectedCandidate.violations,
      ),
    );
  const selectedCandidateSet = new Set(
    selected.map(({ indexedCandidate }) => indexedCandidate.candidate),
  );
  const skippedForDiversity = deferredForDiversity
    .filter(
      (deferredCandidate) => !relaxedSelected.has(deferredCandidate.indexedCandidate.candidate),
    )
    .filter(
      (deferredCandidate) => !selectedCandidateSet.has(deferredCandidate.indexedCandidate.candidate),
    )
    .map(buildSkip);
  const selectedFromRelaxedFillCount = rankedCandidates.filter(
    (candidate) => candidate.ranking_metadata.selection_phase === 'relaxed_fill',
  ).length;
  const selectedFromPreferencePromotionCount = rankedCandidates.filter(
    (candidate) => candidate.ranking_metadata.selection_phase === 'preference_promotion',
  ).length;

  return {
    candidates: rankedCandidates,
    skipped_for_diversity: skippedForDiversity,
    diagnostics: {
      input_count: candidates.length,
      sorted_count: sortedCandidates.length,
      selected_count: rankedCandidates.length,
      limit: options.limit,
      selected_from_diversity_pass_count:
        rankedCandidates.length -
        selectedFromRelaxedFillCount -
        selectedFromPreferencePromotionCount,
      selected_from_relaxed_fill_count: selectedFromRelaxedFillCount,
      selected_from_preference_promotion_count: selectedFromPreferencePromotionCount,
      deferred_for_diversity_count: deferredForDiversity.length,
      skipped_for_diversity_count: skippedForDiversity.length,
      preference_promotion_applied: preferencePromotionApplied,
      preference_promotion_margin: options.preference_promotion_margin,
      preference_promoted_candidate_id: preferencePromotedCandidateId,
      final_ordering_basis: FINAL_ORDERING_BASIS,
      diversity_limits: {
        max_same_top: options.max_same_top,
        max_same_bottom: options.max_same_bottom,
        max_same_footwear: options.max_same_footwear,
        max_same_color_signature: options.max_same_color_signature,
        max_same_subcategory_signature: options.max_same_subcategory_signature,
      },
    },
  };
};
