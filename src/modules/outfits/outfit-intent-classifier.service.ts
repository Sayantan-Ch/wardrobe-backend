import fs from 'fs';
import path from 'path';
import OpenAI from 'openai';
import { env } from '../../config/env';
import { logger } from '../../lib/logger';
import { outfitIntentSchema, type OutfitIntent } from './outfit-generation.schemas';

const openai = new OpenAI({
  apiKey: env.OPENROUTER_API_KEY,
  baseURL: env.OPENROUTER_BASE_URL,
});

export class OutfitIntentClassificationFailedError extends Error {
  constructor(message = 'Unable to classify outfit intent') {
    super(message);
  }
}

export interface ClassifyOutfitIntentInput {
  query: string;
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
    throw new OutfitIntentClassificationFailedError('Model response was not valid JSON');
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const normalizeEnumValue = (value: unknown): unknown => {
  if (typeof value !== 'string') {
    return value;
  }

  return value.trim().toLowerCase().replace(/[\s-]+/g, '_');
};

const normalizeIdValue = (value: unknown): unknown => {
  return typeof value === 'string' ? value.trim() : value;
};

const toArray = (value: unknown): unknown[] => {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    return [value];
  }

  return [];
};

const normalizeEnumArray = (value: unknown): unknown[] => {
  return toArray(value).map(normalizeEnumValue);
};

const normalizeIdArray = (value: unknown): unknown[] => {
  return toArray(value).map(normalizeIdValue);
};

const normalizeOutfitIntentOutput = (raw: unknown): unknown => {
  if (!isRecord(raw)) {
    return raw;
  }

  const hardFilters = isRecord(raw.hard_filters) ? raw.hard_filters : {};
  const softPreferences = isRecord(raw.soft_preferences) ? raw.soft_preferences : {};

  return {
    occasion: normalizeEnumValue(raw.occasion),
    target_formality: normalizeEnumValue(raw.target_formality),
    moods: normalizeEnumArray(raw.moods),
    hard_filters: {
      excluded_colors: normalizeEnumArray(hardFilters.excluded_colors),
      excluded_subcategories: normalizeEnumArray(hardFilters.excluded_subcategories),
      excluded_fits: normalizeEnumArray(hardFilters.excluded_fits),
      required_item_ids: normalizeIdArray(hardFilters.required_item_ids),
      excluded_item_ids: normalizeIdArray(hardFilters.excluded_item_ids),
    },
    soft_preferences: {
      preferred_formalities: normalizeEnumArray(softPreferences.preferred_formalities),
      preferred_top_subcategories: normalizeEnumArray(softPreferences.preferred_top_subcategories),
      preferred_bottom_subcategories: normalizeEnumArray(
        softPreferences.preferred_bottom_subcategories,
      ),
      preferred_footwear_subcategories: normalizeEnumArray(
        softPreferences.preferred_footwear_subcategories,
      ),
      preferred_colors: normalizeEnumArray(softPreferences.preferred_colors),
      preferred_top_colors: normalizeEnumArray(softPreferences.preferred_top_colors),
      preferred_bottom_colors: normalizeEnumArray(softPreferences.preferred_bottom_colors),
      preferred_footwear_colors: normalizeEnumArray(softPreferences.preferred_footwear_colors),
      preferred_fits: normalizeEnumArray(softPreferences.preferred_fits),
    },
  };
};

const normalizeAndValidate = (raw: unknown): OutfitIntent => {
  const parsed = outfitIntentSchema.safeParse(normalizeOutfitIntentOutput(raw));

  if (!parsed.success) {
    throw new OutfitIntentClassificationFailedError(parsed.error.message);
  }

  return parsed.data;
};

const elapsedMs = (startedAt: bigint): number => {
  return Math.round(Number(process.hrtime.bigint() - startedAt) / 1_000_000);
};

const createClassificationCompletion = async (systemPrompt: string, query: string) => {
  const startedAt = process.hrtime.bigint();
  logger.info('outfit_intent_classification_started', {
    event: 'outfit_intent_classification_started',
    model: env.OUTFIT_INTENT_CLASSIFIER_MODEL,
  });

  const response = await openai.chat.completions.create({
    model: env.OUTFIT_INTENT_CLASSIFIER_MODEL,
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: JSON.stringify({
          query,
        }),
      },
    ],
  });

  const content = response.choices[0]?.message?.content;

  if (!content) {
    logger.warn('outfit_intent_classification_empty_response', {
      event: 'outfit_intent_classification_empty_response',
      model: env.OUTFIT_INTENT_CLASSIFIER_MODEL,
      duration_ms: elapsedMs(startedAt),
    });
    throw new OutfitIntentClassificationFailedError('Model returned an empty response');
  }

  logger.info('outfit_intent_classification_completed', {
    event: 'outfit_intent_classification_completed',
    model: env.OUTFIT_INTENT_CLASSIFIER_MODEL,
    duration_ms: elapsedMs(startedAt),
  });

  return content;
};

const createRepairCompletion = async (
  repairPrompt: string,
  query: string,
  originalOutput: string,
  validationError: unknown,
) => {
  const startedAt = process.hrtime.bigint();
  logger.info('outfit_intent_repair_started', {
    event: 'outfit_intent_repair_started',
    model: env.OUTFIT_INTENT_REPAIR_MODEL,
  });

  const response = await openai.chat.completions.create({
    model: env.OUTFIT_INTENT_REPAIR_MODEL,
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
          original_query: query,
          invalid_output: originalOutput,
          validation_error: validationError instanceof Error ? validationError.message : String(validationError),
        }),
      },
    ],
  });

  const content = response.choices[0]?.message?.content;

  if (!content) {
    logger.warn('outfit_intent_repair_empty_response', {
      event: 'outfit_intent_repair_empty_response',
      model: env.OUTFIT_INTENT_REPAIR_MODEL,
      duration_ms: elapsedMs(startedAt),
    });
    throw new OutfitIntentClassificationFailedError('Repair model returned an empty response');
  }

  logger.info('outfit_intent_repair_completed', {
    event: 'outfit_intent_repair_completed',
    model: env.OUTFIT_INTENT_REPAIR_MODEL,
    duration_ms: elapsedMs(startedAt),
  });

  return content;
};

export const classifyOutfitIntent = async ({
  query,
}: ClassifyOutfitIntentInput): Promise<OutfitIntent> => {
  const startedAt = process.hrtime.bigint();
  const classifierPrompt = loadPrompt('outfits/classifier.md');
  const repairPrompt = loadPrompt('outfits/classifier-repair.md');

  let originalOutput = '';

  try {
    originalOutput = await createClassificationCompletion(classifierPrompt, query);
    const intent = normalizeAndValidate(parseJson(originalOutput));
    logger.info('outfit_intent_classified', {
      event: 'outfit_intent_classified',
      repaired: false,
      duration_ms: elapsedMs(startedAt),
    });
    return intent;
  } catch (firstError) {
    if (!originalOutput) {
      logger.warn('outfit_intent_failed_before_repair', {
        event: 'outfit_intent_failed_before_repair',
        error: firstError instanceof Error ? firstError.message : String(firstError),
        duration_ms: elapsedMs(startedAt),
      });
      throw new OutfitIntentClassificationFailedError();
    }

    logger.warn('outfit_intent_validation_failed', {
      event: 'outfit_intent_validation_failed',
      error: firstError instanceof Error ? firstError.message : String(firstError),
      repair_attempted: true,
    });

    try {
      const repairedOutput = await createRepairCompletion(
        repairPrompt,
        query,
        originalOutput,
        firstError,
      );
      const intent = normalizeAndValidate(parseJson(repairedOutput));
      logger.info('outfit_intent_classified', {
        event: 'outfit_intent_classified',
        repaired: true,
        duration_ms: elapsedMs(startedAt),
      });
      return intent;
    } catch (repairError) {
      logger.warn('outfit_intent_repair_failed', {
        event: 'outfit_intent_repair_failed',
        error: repairError instanceof Error ? repairError.message : String(repairError),
        duration_ms: elapsedMs(startedAt),
      });
      throw new OutfitIntentClassificationFailedError();
    }
  }
};
