import { deleteOutfitForUser, findOwnedClothingItems, insertOutfit, listOutfitsForUser } from './outfits.repository';
import { AppError } from '../../errors/app-error';
import { logger } from '../../lib/logger';
import { generateOutfitCombinations } from './outfit-combination-generator.service';
import { rejectBadOutfitCombinations } from './outfit-combination-rejection.service';
import {
  buildDeterministicCuratorFallback,
  curateOutfitRecommendations,
  OutfitCurationFailedError,
  type CuratedOutfitRecommendation,
} from './outfit-curator.service';
import {
  generateOutfitsResponseSchema,
  outfitGenerationErrorStatusMap,
  type GenerateOutfitsRequestInput,
  type GenerateOutfitsResponse,
  type OutfitGenerationClothingItem,
  type OutfitGenerationErrorCode,
  type OutfitRecommendationItem,
} from './outfit-generation.schemas';
import {
  countBadCombinationRejectionReasons,
  countHardFilterRejectionReasons,
  sampleTrace,
  serializeTraceBadCombinationRejection,
  serializeTraceCandidate,
  serializeTraceHardFilterRejection,
  serializeTraceRankedCandidate,
  serializeTraceScoredCandidate,
  summarizeIntentForTrace,
} from './outfit-generation-trace';
import { applyOutfitHardFilters } from './outfit-hard-filter.service';
import {
  classifyOutfitIntent,
  OutfitIntentClassificationFailedError,
} from './outfit-intent-classifier.service';
import { rankOutfitCandidates } from './outfit-ranking.service';
import { scoreOutfitCandidates } from './outfit-scoring.service';
import { fetchWardrobePoolForGeneration } from './outfit-wardrobe-pool.service';
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

export const deleteOutfit = async (userId: string, outfitId: string) => {
  return deleteOutfitForUser(userId, outfitId);
};

const createOutfitGenerationError = (
  code: OutfitGenerationErrorCode,
  details?: unknown,
): AppError => {
  const config = outfitGenerationErrorStatusMap[code];

  return new AppError(
    config.status,
    code,
    config.message,
    config.exposeDetails ? details : undefined,
  );
};

const getPoolCounts = (pools: {
  tops: OutfitGenerationClothingItem[];
  bottoms: OutfitGenerationClothingItem[];
  footwear: OutfitGenerationClothingItem[];
}) => ({
  tops: pools.tops.length,
  bottoms: pools.bottoms.length,
  footwear: pools.footwear.length,
});

const TRACE_SAMPLE_LIMIT = 5;

const toRecommendationItem = (item: OutfitGenerationClothingItem): OutfitRecommendationItem => ({
  id: item.id,
  name: item.name,
  category: item.category,
  subcategory: item.subcategory,
  color: item.color,
  color_tone: item.color_tone,
  formality: item.formality,
  fit: item.fit,
  image_url: item.image_url,
  notes: item.notes,
  created_at: item.created_at,
  updated_at: item.updated_at,
});

const toGeneratedRecommendation = (recommendation: CuratedOutfitRecommendation) => ({
  candidate_id: recommendation.candidate_id,
  rank: recommendation.rank,
  title: recommendation.title,
  reason: recommendation.reason,
  styling_notes: recommendation.styling_notes,
  outfit: {
    top: toRecommendationItem(recommendation.candidate.top),
    bottom: toRecommendationItem(recommendation.candidate.bottom),
    footwear: recommendation.candidate.footwear
      ? toRecommendationItem(recommendation.candidate.footwear)
      : null,
  },
  score: recommendation.score,
  score_breakdown: recommendation.score_breakdown,
});

export const generateOutfitsForUser = async (
  userId: string,
  input: GenerateOutfitsRequestInput,
): Promise<GenerateOutfitsResponse> => {
  try {
    logger.info('outfit_generation_started', {
      event: 'outfit_generation_started',
      user_id: userId,
      query: input.query,
      limit: input.limit,
    });

    const intent = await classifyOutfitIntent({ query: input.query });
    const tracedIntent = summarizeIntentForTrace(intent);

    logger.info('outfit_generation_intent_resolved', {
      event: 'outfit_generation_intent_resolved',
      user_id: userId,
      intent: tracedIntent,
    });

    const wardrobePool = await fetchWardrobePoolForGeneration({ userId });

    logger.info('outfit_generation_pool_ready', {
      event: 'outfit_generation_pool_ready',
      user_id: userId,
      counts: wardrobePool.counts,
      readiness: wardrobePool.readiness,
    });

    if (!wardrobePool.readiness.ready) {
      throw createOutfitGenerationError('not_enough_items', {
        stage: 'wardrobe_pool',
        counts: wardrobePool.counts,
        readiness: wardrobePool.readiness,
      });
    }

    const hardFilterResult = applyOutfitHardFilters({
      intent,
      pools: wardrobePool.pools,
    });

    logger.info('outfit_generation_hard_filter_completed', {
      event: 'outfit_generation_hard_filter_completed',
      user_id: userId,
      pool_counts_before: getPoolCounts(wardrobePool.pools),
      pool_counts_after: getPoolCounts(hardFilterResult.pools),
      rejected_count: hardFilterResult.rejected.length,
      rejection_reason_counts: countHardFilterRejectionReasons(hardFilterResult.rejected),
      constraints_satisfied: hardFilterResult.constraints_satisfied,
      readiness: hardFilterResult.readiness,
    });
    logger.debug('outfit_generation_hard_filter_trace', {
      event: 'outfit_generation_hard_filter_trace',
      user_id: userId,
      sample_rejected_items: sampleTrace(hardFilterResult.rejected, TRACE_SAMPLE_LIMIT).map(
        serializeTraceHardFilterRejection,
      ),
      no_result_reasons: hardFilterResult.no_result_reasons,
    });

    if (!hardFilterResult.constraints_satisfied) {
      throw createOutfitGenerationError('no_valid_outfits', {
        stage: 'hard_filter',
        pool_counts: getPoolCounts(hardFilterResult.pools),
        no_result_reasons: hardFilterResult.no_result_reasons.slice(0, 10),
      });
    }

    if (!hardFilterResult.readiness.ready) {
      throw createOutfitGenerationError('not_enough_items', {
        stage: 'hard_filter',
        pool_counts: getPoolCounts(hardFilterResult.pools),
        readiness: hardFilterResult.readiness,
        rejected_count: hardFilterResult.rejected.length,
      });
    }

    const combinationResult = generateOutfitCombinations({
      intent,
      pools: hardFilterResult.pools,
    });

    logger.info('outfit_generation_combinations_generated', {
      event: 'outfit_generation_combinations_generated',
      user_id: userId,
      pool_counts_before_caps: getPoolCounts(hardFilterResult.pools),
      pool_counts_after_caps: getPoolCounts(combinationResult.capped_pools),
      generated_count: combinationResult.candidates.length,
      diagnostics: combinationResult.diagnostics,
    });
    logger.debug('outfit_generation_combination_trace', {
      event: 'outfit_generation_combination_trace',
      user_id: userId,
      sample_candidates: sampleTrace(combinationResult.candidates, TRACE_SAMPLE_LIMIT).map(
        serializeTraceCandidate,
      ),
    });

    if (combinationResult.candidates.length === 0) {
      throw createOutfitGenerationError('no_valid_outfits', {
        stage: 'combination_generation',
        pool_counts: getPoolCounts(combinationResult.capped_pools),
        generated_count: 0,
      });
    }

    const rejectionResult = rejectBadOutfitCombinations({
      intent,
      candidates: combinationResult.candidates,
    });

    logger.info('outfit_generation_bad_combinations_rejected', {
      event: 'outfit_generation_bad_combinations_rejected',
      user_id: userId,
      diagnostics: rejectionResult.diagnostics,
      rejection_reason_counts: countBadCombinationRejectionReasons(rejectionResult.rejected),
    });
    logger.debug('outfit_generation_bad_combination_trace', {
      event: 'outfit_generation_bad_combination_trace',
      user_id: userId,
      sample_rejected_candidates: sampleTrace(rejectionResult.rejected, TRACE_SAMPLE_LIMIT).map(
        serializeTraceBadCombinationRejection,
      ),
      sample_accepted_candidates: sampleTrace(rejectionResult.candidates, TRACE_SAMPLE_LIMIT).map(
        serializeTraceCandidate,
      ),
    });

    if (rejectionResult.candidates.length === 0) {
      throw createOutfitGenerationError('no_valid_outfits', {
        stage: 'combination_rejection',
        generated_count: combinationResult.candidates.length,
        rejected_count: rejectionResult.rejected.length,
      });
    }

    const scoringResult = scoreOutfitCandidates({
      intent,
      candidates: rejectionResult.candidates,
    });
    const topScoredCandidates = [...scoringResult.candidates]
      .sort((left, right) => right.score - left.score)
      .slice(0, TRACE_SAMPLE_LIMIT);
    const topPreferenceMatchingCandidates = [...scoringResult.candidates]
      .filter((candidate) => candidate.score_breakdown.preferences > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, TRACE_SAMPLE_LIMIT);

    logger.info('outfit_generation_scoring_completed', {
      event: 'outfit_generation_scoring_completed',
      user_id: userId,
      diagnostics: scoringResult.diagnostics,
      top_scores: topScoredCandidates.map((candidate) => ({
        candidate_id: candidate.candidate.id,
        score: candidate.score,
        score_breakdown: candidate.score_breakdown,
      })),
    });
    logger.debug('outfit_generation_scoring_trace', {
      event: 'outfit_generation_scoring_trace',
      user_id: userId,
      top_candidates: topScoredCandidates.map((candidate) =>
        serializeTraceScoredCandidate(candidate, intent),
      ),
      top_preference_matching_candidates: topPreferenceMatchingCandidates.map((candidate) =>
        serializeTraceScoredCandidate(candidate, intent),
      ),
    });

    const rankingResult = rankOutfitCandidates({
      candidates: scoringResult.candidates,
      options: { limit: input.limit },
    });

    logger.info('outfit_generation_ranking_completed', {
      event: 'outfit_generation_ranking_completed',
      user_id: userId,
      diagnostics: rankingResult.diagnostics,
      selected_candidate_ids: rankingResult.candidates.map((candidate) => candidate.candidate.id),
    });
    logger.debug('outfit_generation_ranking_trace', {
      event: 'outfit_generation_ranking_trace',
      user_id: userId,
      final_ranked_candidates: rankingResult.candidates.map((candidate) =>
        serializeTraceRankedCandidate(candidate, intent),
      ),
      sample_skipped_for_diversity: sampleTrace(
        rankingResult.skipped_for_diversity,
        TRACE_SAMPLE_LIMIT,
      ),
    });

    if (rankingResult.candidates.length === 0) {
      throw createOutfitGenerationError('no_valid_outfits', {
        stage: 'ranking',
        scored_count: scoringResult.candidates.length,
        ranked_count: 0,
      });
    }

    let curationFallbackUsed = false;
    let curatedRecommendations: CuratedOutfitRecommendation[];
    let curationDiagnostics: unknown = null;

    try {
      const curationResult = await curateOutfitRecommendations({
        query: input.query,
        intent,
        candidates: rankingResult.candidates,
        limit: input.limit,
      });
      curatedRecommendations = curationResult.recommendations;
      curationDiagnostics = curationResult.diagnostics;
    } catch (error) {
      if (!(error instanceof OutfitCurationFailedError)) {
        throw error;
      }

      logger.warn('outfit_curation_fallback_used', {
        event: 'outfit_curation_fallback_used',
        user_id: userId,
        error: error.message,
      });

      curationFallbackUsed = true;
      curatedRecommendations = buildDeterministicCuratorFallback(
        rankingResult.candidates,
        input.limit,
      );
    }

    logger.info('outfit_generation_curation_completed', {
      event: 'outfit_generation_curation_completed',
      user_id: userId,
      curation_fallback_used: curationFallbackUsed,
      diagnostics: curationDiagnostics,
      recommendations: curatedRecommendations.map((recommendation) => ({
        candidate_id: recommendation.candidate_id,
        rank: recommendation.rank,
        score: recommendation.score,
      })),
    });

    const response = {
      intent,
      recommendations: curatedRecommendations.map(toGeneratedRecommendation),
      debug: {
        generated_count: combinationResult.diagnostics.generated_count,
        rejected_count: hardFilterResult.rejected.length + rejectionResult.rejected.length,
        scored_count: scoringResult.diagnostics.scored_count,
        ranked_count: rankingResult.diagnostics.selected_count,
        curation_fallback_used: curationFallbackUsed,
      },
    };
    const parsedResponse = generateOutfitsResponseSchema.safeParse(response);

    if (!parsedResponse.success) {
      logger.error('outfit_generation_response_invalid', {
        event: 'outfit_generation_response_invalid',
        user_id: userId,
        issues: parsedResponse.error.issues,
      });
      throw createOutfitGenerationError('generation_failed');
    }

    logger.info('outfit_generation_completed', {
      event: 'outfit_generation_completed',
      user_id: userId,
      debug: parsedResponse.data.debug,
      recommendation_count: parsedResponse.data.recommendations.length,
    });

    return parsedResponse.data;
  } catch (error) {
    if (error instanceof OutfitIntentClassificationFailedError) {
      throw createOutfitGenerationError('classification_failed');
    }

    if (error instanceof AppError) {
      throw error;
    }

    logger.error('outfit_generation_failed', {
      event: 'outfit_generation_failed',
      user_id: userId,
      error: error instanceof Error ? error.message : String(error),
    });

    throw createOutfitGenerationError('generation_failed');
  }
};
