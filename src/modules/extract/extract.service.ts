import fs from 'fs';
import path from 'path';
import OpenAI from 'openai';
import { env } from '../../config/env';
import { logger } from '../../lib/logger';
import { extractionOutputSchema, type ExtractedItem } from './extract.schemas';

const MAX_EXTRACTED_ITEMS = 5;

const openai = new OpenAI({
  apiKey: env.OPENROUTER_API_KEY,
  baseURL: env.OPENROUTER_BASE_URL,
});

export class ExtractionFailedError extends Error {
  constructor(message = 'Unable to extract wardrobe metadata from image') {
    super(message);
  }
}

export interface ExtractImageInput {
  fileBuffer: Buffer;
  mimeType: string;
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
    throw new ExtractionFailedError('Model response was not valid JSON');
  }
};

const normalizeAndValidate = (raw: unknown): ExtractedItem[] => {
  const candidate =
    typeof raw === 'object' && raw !== null && Array.isArray((raw as { items?: unknown }).items)
      ? {
          items: (raw as { items: unknown[] }).items.slice(0, MAX_EXTRACTED_ITEMS),
        }
      : raw;

  const parsed = extractionOutputSchema.safeParse(candidate);

  if (!parsed.success) {
    throw new ExtractionFailedError(parsed.error.message);
  }

  return parsed.data.items.slice(0, MAX_EXTRACTED_ITEMS);
};

const buildDataUrl = (fileBuffer: Buffer, mimeType: string): string => {
  return `data:${mimeType};base64,${fileBuffer.toString('base64')}`;
};

const elapsedMs = (startedAt: bigint): number => {
  return Math.round(Number(process.hrtime.bigint() - startedAt) / 1_000_000);
};

const createVisionCompletion = async (systemPrompt: string, dataUrl: string) => {
  const startedAt = process.hrtime.bigint();
  logger.info('extraction_vision_started', {
    event: 'extraction_vision_started',
    model: env.EXTRACTION_VISION_MODEL,
  });

  const response = await openai.chat.completions.create({
    model: env.EXTRACTION_VISION_MODEL,
    temperature: 0.1,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Extract supported wardrobe item metadata from this image.',
          },
          {
            type: 'image_url',
            image_url: {
              url: dataUrl,
            },
          },
        ],
      },
    ],
  });

  const content = response.choices[0]?.message?.content;

  if (!content) {
    logger.warn('extraction_vision_empty_response', {
      event: 'extraction_vision_empty_response',
      model: env.EXTRACTION_VISION_MODEL,
      duration_ms: elapsedMs(startedAt),
    });
    throw new ExtractionFailedError('Model returned an empty response');
  }

  logger.info('extraction_vision_completed', {
    event: 'extraction_vision_completed',
    model: env.EXTRACTION_VISION_MODEL,
    duration_ms: elapsedMs(startedAt),
  });

  return content;
};

const createRepairCompletion = async (
  repairPrompt: string,
  originalOutput: string,
  validationError: unknown,
) => {
  const startedAt = process.hrtime.bigint();
  logger.info('extraction_repair_started', {
    event: 'extraction_repair_started',
    model: env.EXTRACTION_NORMALIZATION_MODEL,
  });

  const response = await openai.chat.completions.create({
    model: env.EXTRACTION_NORMALIZATION_MODEL,
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
          invalid_output: originalOutput,
          validation_error: validationError instanceof Error ? validationError.message : String(validationError),
        }),
      },
    ],
  });

  const content = response.choices[0]?.message?.content;

  if (!content) {
    logger.warn('extraction_repair_empty_response', {
      event: 'extraction_repair_empty_response',
      model: env.EXTRACTION_NORMALIZATION_MODEL,
      duration_ms: elapsedMs(startedAt),
    });
    throw new ExtractionFailedError('Repair model returned an empty response');
  }

  logger.info('extraction_repair_completed', {
    event: 'extraction_repair_completed',
    model: env.EXTRACTION_NORMALIZATION_MODEL,
    duration_ms: elapsedMs(startedAt),
  });

  return content;
};

export const extractWardrobeItemsFromImage = async ({
  fileBuffer,
  mimeType,
}: ExtractImageInput): Promise<ExtractedItem[]> => {
  const startedAt = process.hrtime.bigint();
  const dataUrl = buildDataUrl(fileBuffer, mimeType);
  const visionPrompt = loadPrompt('extraction/vision.md');
  const repairPrompt = loadPrompt('extraction/repair.md');

  let originalOutput = '';

  try {
    originalOutput = await createVisionCompletion(visionPrompt, dataUrl);
    const items = normalizeAndValidate(parseJson(originalOutput));
    logger.info('extraction_completed', {
      event: 'extraction_completed',
      item_count: items.length,
      repaired: false,
      mime_type: mimeType,
      size_bytes: fileBuffer.byteLength,
      duration_ms: elapsedMs(startedAt),
    });
    return items;
  } catch (firstError) {
    if (!originalOutput) {
      logger.warn('extraction_failed_before_repair', {
        event: 'extraction_failed_before_repair',
        error: firstError instanceof Error ? firstError.message : String(firstError),
        duration_ms: elapsedMs(startedAt),
      });
      throw new ExtractionFailedError();
    }

    logger.warn('extraction_validation_failed', {
      event: 'extraction_validation_failed',
      error: firstError instanceof Error ? firstError.message : String(firstError),
      repair_attempted: true,
    });

    try {
      const repairedOutput = await createRepairCompletion(repairPrompt, originalOutput, firstError);
      const items = normalizeAndValidate(parseJson(repairedOutput));
      logger.info('extraction_completed', {
        event: 'extraction_completed',
        item_count: items.length,
        repaired: true,
        mime_type: mimeType,
        size_bytes: fileBuffer.byteLength,
        duration_ms: elapsedMs(startedAt),
      });
      return items;
    } catch (repairError) {
      logger.warn('extraction_repair_failed', {
        event: 'extraction_repair_failed',
        error: repairError instanceof Error ? repairError.message : String(repairError),
        duration_ms: elapsedMs(startedAt),
      });
      throw new ExtractionFailedError();
    }
  }
};
