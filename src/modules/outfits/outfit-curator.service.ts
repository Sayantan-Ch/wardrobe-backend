import fs from 'fs';
import path from 'path';
import OpenAI from 'openai';
import { env } from '../../config/env';
import { AppError } from '../../errors/app-error';
import { logger } from '../../lib/logger';
import {
  curatorOutputSchema,
  type CuratedRecommendation,
  type CuratorOutput,
  type OutfitGenerationClothingItem,
  type OutfitIntent,
  type RankedCandidate,
  type ScoreBreakdown,
} from './outfit-generation.schemas';

const MAX_CANDIDATES_FOR_PROMPT = 20;
const DEFAULT_RECOMMENDATION_LIMIT = 5;
const MAX_RECOMMENDATION_LIMIT = 10;
const MAX_ITEM_NOTES_LENGTH = 160;

const openai = new OpenAI({
  apiKey: env.OPENROUTER_API_KEY,
  baseURL: env.OPENROUTER_BASE_URL,
});

export class OutfitCurationFailedError extends AppError {
  constructor(message = 'Unable to curate outfit recommendations', details?: unknown) {
    super(502, 'curation_failed', message, details);
  }
}

export interface CurateOutfitRecommendationsInput {
  query: string;
  intent: OutfitIntent;
  candidates: RankedCandidate[];
  limit?: number;
}

export interface CuratorPayloadItem {
  id: string;
  name: string | null;
  category: 'tops' | 'bottoms' | 'footwear';
  subcategory: string;
  color: string;
  color_tone: string | null;
  formality: string;
  fit: string | null;
  notes: string | null;
}

export interface CuratorPayloadCandidate {
  id: string;
  rank: number;
  score: number;
  score_breakdown: ScoreBreakdown;
  items: {
    top: CuratorPayloadItem;
    bottom: CuratorPayloadItem;
    footwear: CuratorPayloadItem | null;
  };
  item_ids: string[];
  colors: string[];
  subcategories: string[];
  formalities: string[];
  fits: Array<string | null>;
}

export interface CuratorPayload {
  original_query: string;
  outfit_intent: OutfitIntent;
  desired_recommendation_count: number;
  allowed_candidate_ids: string[];
  ranked_candidates: CuratorPayloadCandidate[];
}

export interface CuratedOutfitRecommendation extends CuratedRecommendation {
  candidate: RankedCandidate['candidate'];
  rank: number;
  score: number;
  score_breakdown: ScoreBreakdown;
}

export interface CurateOutfitRecommendationsDiagnostics {
  input_candidate_count: number;
  prompted_candidate_count: number;
  requested_recommendation_count: number;
  returned_recommendation_count: number;
  repaired: boolean;
}

export interface CurateOutfitRecommendationsResult {
  recommendations: CuratedOutfitRecommendation[];
  diagnostics: CurateOutfitRecommendationsDiagnostics;
}

const loadPrompt = (relativePath: string): string => {
  const candidates = [
    path.resolve(__dirname, '../../prompts', relativePath),
    path.resolve(process.cwd(), 'src/prompts', relativePath),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return fs.readFileSync(candidate, 'utf8');
    }
  }

  throw new Error(`Prompt file not found: ${relativePath}`);
};

const stripCodeFence = (content: string): string => {
  const trimmed = content.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
};

const parseJson = (content: string): unknown => {
  try {
    return JSON.parse(stripCodeFence(content));
  } catch {
    throw new OutfitCurationFailedError('Model response was not valid JSON');
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const assertOnlyAllowedKeys = (
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
  pathLabel: string,
): void => {
  const allowed = new Set(allowedKeys);
  const unknownKeys = Object.keys(value).filter((key) => !allowed.has(key));

  if (unknownKeys.length > 0) {
    throw new OutfitCurationFailedError(
      `Curator returned unsupported fields at ${pathLabel}: ${unknownKeys.join(', ')}`,
    );
  }
};

const assertNoInventedCuratorFields = (raw: unknown): void => {
  if (!isRecord(raw)) {
    return;
  }

  assertOnlyAllowedKeys(raw, ['recommendations'], 'root');

  if (!Array.isArray(raw.recommendations)) {
    return;
  }

  raw.recommendations.forEach((recommendation, index) => {
    if (!isRecord(recommendation)) {
      return;
    }

    assertOnlyAllowedKeys(
      recommendation,
      ['candidate_id', 'title', 'reason', 'styling_notes'],
      `recommendations[${index}]`,
    );
  });
};

const elapsedMs = (startedAt: bigint): number => {
  return Math.round(Number(process.hrtime.bigint() - startedAt) / 1_000_000);
};

const normalizeLimit = (limit: number | undefined, availableCount: number): number => {
  const requested = Number.isFinite(limit)
    ? Math.trunc(limit as number)
    : DEFAULT_RECOMMENDATION_LIMIT;

  return Math.min(Math.max(requested, 1), MAX_RECOMMENDATION_LIMIT, availableCount);
};

const truncateNullableText = (value: string | null, maxLength: number): string | null => {
  if (!value) {
    return null;
  }

  return value.length > maxLength ? value.slice(0, maxLength) : value;
};

const summarizeItem = (item: OutfitGenerationClothingItem): CuratorPayloadItem => ({
  id: item.id,
  name: item.name,
  category: item.category,
  subcategory: item.subcategory,
  color: item.color,
  color_tone: item.color_tone,
  formality: item.formality,
  fit: item.fit,
  notes: truncateNullableText(item.notes, MAX_ITEM_NOTES_LENGTH),
});

const uniqueValues = <Value>(values: Value[]): Value[] => {
  return [...new Set(values)];
};

const getPromptCandidates = (candidates: RankedCandidate[]): RankedCandidate[] => {
  return candidates
    .map((candidate, inputIndex) => ({ candidate, inputIndex }))
    .sort((left, right) => {
      const rankDifference = left.candidate.rank - right.candidate.rank;

      if (rankDifference !== 0) {
        return rankDifference;
      }

      return left.inputIndex - right.inputIndex;
    })
    .slice(0, MAX_CANDIDATES_FOR_PROMPT)
    .map(({ candidate }) => candidate);
};

const buildPayloadCandidate = (rankedCandidate: RankedCandidate): CuratorPayloadCandidate => {
  const { candidate, score, score_breakdown, rank } = rankedCandidate;
  const items = candidate.footwear
    ? [candidate.top, candidate.bottom, candidate.footwear]
    : [candidate.top, candidate.bottom];

  return {
    id: candidate.id,
    rank,
    score,
    score_breakdown,
    items: {
      top: summarizeItem(candidate.top),
      bottom: summarizeItem(candidate.bottom),
      footwear: candidate.footwear ? summarizeItem(candidate.footwear) : null,
    },
    item_ids: items.map((item) => item.id),
    colors: uniqueValues(items.map((item) => item.color)),
    subcategories: items.map((item) => item.subcategory),
    formalities: uniqueValues(items.map((item) => item.formality)),
    fits: items.map((item) => item.fit),
  };
};

export const buildCuratorPayload = ({
  query,
  intent,
  candidates,
  limit,
}: CurateOutfitRecommendationsInput): CuratorPayload => {
  const promptCandidates = getPromptCandidates(candidates);
  const desiredRecommendationCount = normalizeLimit(limit, promptCandidates.length);

  return {
    original_query: query,
    outfit_intent: intent,
    desired_recommendation_count: desiredRecommendationCount,
    allowed_candidate_ids: promptCandidates.map((candidate) => candidate.candidate.id),
    ranked_candidates: promptCandidates.map(buildPayloadCandidate),
  };
};

const validateCuratorOutput = (raw: unknown): CuratorOutput => {
  assertNoInventedCuratorFields(raw);

  const parsed = curatorOutputSchema.safeParse(raw);

  if (!parsed.success) {
    throw new OutfitCurationFailedError(parsed.error.message);
  }

  return parsed.data;
};

export const validateAndGroundCuratorOutput = (
  raw: unknown,
  candidates: RankedCandidate[],
  limit: number,
): CuratedOutfitRecommendation[] => {
  const curatorOutput = validateCuratorOutput(raw);
  const candidateById = new Map(candidates.map((candidate) => [candidate.candidate.id, candidate]));
  const seenCandidateIds = new Set<string>();
  const recommendations: CuratedOutfitRecommendation[] = [];

  for (const recommendation of curatorOutput.recommendations) {
    const rankedCandidate = candidateById.get(recommendation.candidate_id);

    if (!rankedCandidate) {
      throw new OutfitCurationFailedError(
        `Curator selected unknown candidate_id '${recommendation.candidate_id}'`,
      );
    }

    if (seenCandidateIds.has(recommendation.candidate_id)) {
      throw new OutfitCurationFailedError(
        `Curator selected duplicate candidate_id '${recommendation.candidate_id}'`,
      );
    }

    seenCandidateIds.add(recommendation.candidate_id);
    recommendations.push({
      ...recommendation,
      candidate: rankedCandidate.candidate,
      rank: rankedCandidate.rank,
      score: rankedCandidate.score,
      score_breakdown: rankedCandidate.score_breakdown,
    });
  }

  if (recommendations.length === 0 && candidates.length > 0 && limit > 0) {
    throw new OutfitCurationFailedError('Curator returned no recommendations');
  }

  return recommendations.slice(0, limit);
};

const createCurationCompletion = async (systemPrompt: string, payload: CuratorPayload) => {
  const startedAt = process.hrtime.bigint();
  logger.info('outfit_curation_started', {
    event: 'outfit_curation_started',
    model: env.OUTFIT_CURATOR_MODEL,
    candidate_count: payload.ranked_candidates.length,
    requested_recommendation_count: payload.desired_recommendation_count,
  });

  const response = await openai.chat.completions.create({
    model: env.OUTFIT_CURATOR_MODEL,
    temperature: 0.2,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: JSON.stringify(payload),
      },
    ],
  });

  const content = response.choices[0]?.message?.content;

  if (!content) {
    logger.warn('outfit_curation_empty_response', {
      event: 'outfit_curation_empty_response',
      model: env.OUTFIT_CURATOR_MODEL,
      duration_ms: elapsedMs(startedAt),
    });
    throw new OutfitCurationFailedError('Model returned an empty response');
  }

  logger.info('outfit_curation_completed', {
    event: 'outfit_curation_completed',
    model: env.OUTFIT_CURATOR_MODEL,
    duration_ms: elapsedMs(startedAt),
  });

  return content;
};

const createRepairCompletion = async (
  repairPrompt: string,
  payload: CuratorPayload,
  originalOutput: string,
  validationError: unknown,
) => {
  const startedAt = process.hrtime.bigint();
  logger.info('outfit_curation_repair_started', {
    event: 'outfit_curation_repair_started',
    model: env.OUTFIT_CURATOR_REPAIR_MODEL,
  });

  const response = await openai.chat.completions.create({
    model: env.OUTFIT_CURATOR_REPAIR_MODEL,
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: repairPrompt,
      },
      {
        role: 'user',
        content: JSON.stringify({
          curation_input: payload,
          invalid_output: originalOutput,
          validation_error:
            validationError instanceof Error ? validationError.message : String(validationError),
        }),
      },
    ],
  });

  const content = response.choices[0]?.message?.content;

  if (!content) {
    logger.warn('outfit_curation_repair_empty_response', {
      event: 'outfit_curation_repair_empty_response',
      model: env.OUTFIT_CURATOR_REPAIR_MODEL,
      duration_ms: elapsedMs(startedAt),
    });
    throw new OutfitCurationFailedError('Repair model returned an empty response');
  }

  logger.info('outfit_curation_repair_completed', {
    event: 'outfit_curation_repair_completed',
    model: env.OUTFIT_CURATOR_REPAIR_MODEL,
    duration_ms: elapsedMs(startedAt),
  });

  return content;
};

const buildDiagnostics = (
  inputCandidateCount: number,
  payload: CuratorPayload,
  returnedRecommendationCount: number,
  repaired: boolean,
): CurateOutfitRecommendationsDiagnostics => ({
  input_candidate_count: inputCandidateCount,
  prompted_candidate_count: payload.ranked_candidates.length,
  requested_recommendation_count: payload.desired_recommendation_count,
  returned_recommendation_count: returnedRecommendationCount,
  repaired,
});

const createFallbackTitle = (candidate: RankedCandidate): string => {
  const { top, bottom, footwear } = candidate.candidate;
  const footwearLabel = footwear ? ` with ${footwear.subcategory}` : '';
  return `${top.color} ${top.subcategory} and ${bottom.color} ${bottom.subcategory}${footwearLabel}`;
};

const createFallbackReason = (candidate: RankedCandidate): string => {
  const { top, bottom, footwear } = candidate.candidate;
  const outfitPairing = `${top.color} ${top.subcategory} with ${bottom.color} ${bottom.subcategory}`;
  const footwearReason = footwear
    ? ` The ${footwear.color} ${footwear.subcategory} completes the outfit.`
    : '';

  return `This ranked outfit pairs a ${outfitPairing} for a ${candidate.score}/100 backend score.${footwearReason}`;
};

export const buildDeterministicCuratorFallback = (
  candidates: RankedCandidate[],
  limit = DEFAULT_RECOMMENDATION_LIMIT,
): CuratedOutfitRecommendation[] => {
  const promptCandidates = getPromptCandidates(candidates);
  const normalizedLimit = normalizeLimit(limit, promptCandidates.length);

  return promptCandidates.slice(0, normalizedLimit).map((candidate) => ({
    candidate_id: candidate.candidate.id,
    title: createFallbackTitle(candidate),
    reason: createFallbackReason(candidate),
    styling_notes: [],
    candidate: candidate.candidate,
    rank: candidate.rank,
    score: candidate.score,
    score_breakdown: candidate.score_breakdown,
  }));
};

export const curateOutfitRecommendations = async ({
  query,
  intent,
  candidates,
  limit,
}: CurateOutfitRecommendationsInput): Promise<CurateOutfitRecommendationsResult> => {
  const startedAt = process.hrtime.bigint();
  const curatorPrompt = loadPrompt('outfits/curator.md');
  const repairPrompt = loadPrompt('outfits/curator-repair.md');
  const payload = buildCuratorPayload({ query, intent, candidates, limit });

  if (payload.ranked_candidates.length === 0) {
    throw new OutfitCurationFailedError('No ranked candidates were provided for curation');
  }

  const promptCandidates = getPromptCandidates(candidates);
  let originalOutput = '';

  try {
    originalOutput = await createCurationCompletion(curatorPrompt, payload);
    const recommendations = validateAndGroundCuratorOutput(
      parseJson(originalOutput),
      promptCandidates,
      payload.desired_recommendation_count,
    );
    logger.info('outfit_curated', {
      event: 'outfit_curated',
      recommendation_count: recommendations.length,
      repaired: false,
      duration_ms: elapsedMs(startedAt),
    });
    return {
      recommendations,
      diagnostics: buildDiagnostics(candidates.length, payload, recommendations.length, false),
    };
  } catch (firstError) {
    if (!originalOutput) {
      logger.warn('outfit_curation_failed_before_repair', {
        event: 'outfit_curation_failed_before_repair',
        error: firstError instanceof Error ? firstError.message : String(firstError),
        duration_ms: elapsedMs(startedAt),
      });
      throw new OutfitCurationFailedError();
    }

    logger.warn('outfit_curation_validation_failed', {
      event: 'outfit_curation_validation_failed',
      error: firstError instanceof Error ? firstError.message : String(firstError),
      repair_attempted: true,
    });

    try {
      const repairedOutput = await createRepairCompletion(
        repairPrompt,
        payload,
        originalOutput,
        firstError,
      );
      const recommendations = validateAndGroundCuratorOutput(
        parseJson(repairedOutput),
        promptCandidates,
        payload.desired_recommendation_count,
      );
      logger.info('outfit_curated', {
        event: 'outfit_curated',
        recommendation_count: recommendations.length,
        repaired: true,
        duration_ms: elapsedMs(startedAt),
      });
      return {
        recommendations,
        diagnostics: buildDiagnostics(candidates.length, payload, recommendations.length, true),
      };
    } catch (repairError) {
      logger.warn('outfit_curation_repair_failed', {
        event: 'outfit_curation_repair_failed',
        error: repairError instanceof Error ? repairError.message : String(repairError),
        duration_ms: elapsedMs(startedAt),
      });
      throw new OutfitCurationFailedError();
    }
  }
};
