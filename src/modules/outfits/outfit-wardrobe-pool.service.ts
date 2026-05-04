import { AppError } from '../../errors/app-error';
import { logger } from '../../lib/logger';
import { listGenerationWardrobeItemsForUser } from './outfits.repository';
import {
  outfitGenerationClothingItemSchema,
  type OutfitGenerationClothingItem,
} from './outfit-generation.schemas';

export interface FetchWardrobePoolInput {
  userId: string;
}

export interface GenerationWardrobePools {
  tops: OutfitGenerationClothingItem[];
  bottoms: OutfitGenerationClothingItem[];
  footwear: OutfitGenerationClothingItem[];
}

export type WardrobePoolNotReadyReason =
  | 'missing_tops'
  | 'missing_bottoms'
  | 'missing_tops_and_bottoms';

export interface WardrobePoolReadiness {
  ready: boolean;
  reason: WardrobePoolNotReadyReason | null;
  message: string | null;
}

export interface FetchWardrobePoolResult {
  items: OutfitGenerationClothingItem[];
  pools: GenerationWardrobePools;
  counts: {
    total: number;
    tops: number;
    bottoms: number;
    footwear: number;
  };
  readiness: WardrobePoolReadiness;
}

const getRowItemId = (row: unknown): string | undefined => {
  if (typeof row !== 'object' || row === null || !('id' in row)) {
    return undefined;
  }

  const id = (row as { id?: unknown }).id;
  return typeof id === 'string' ? id : undefined;
};

export const validateGenerationWardrobeRows = (
  rows: unknown[],
  userId: string,
): OutfitGenerationClothingItem[] => {
  return rows.map((row) => {
    const parsed = outfitGenerationClothingItemSchema.safeParse(row);

    if (!parsed.success) {
      logger.error('outfit_generation_pool_invalid_row', {
        event: 'outfit_generation_pool_invalid_row',
        user_id: userId,
        item_id: getRowItemId(row),
        issues: parsed.error.issues,
      });

      throw new AppError(500, 'generation_failed', 'Unable to generate outfits');
    }

    return parsed.data;
  });
};

export const groupGenerationWardrobeItems = (
  items: OutfitGenerationClothingItem[],
): GenerationWardrobePools => {
  const pools: GenerationWardrobePools = {
    tops: [],
    bottoms: [],
    footwear: [],
  };

  for (const item of items) {
    pools[item.category].push(item);
  }

  return pools;
};

export const isWardrobePoolReady = (pools: GenerationWardrobePools): WardrobePoolReadiness => {
  const hasTops = pools.tops.length > 0;
  const hasBottoms = pools.bottoms.length > 0;

  if (!hasTops && !hasBottoms) {
    return {
      ready: false,
      reason: 'missing_tops_and_bottoms',
      message: 'Need at least one top and one bottom to generate outfits.',
    };
  }

  if (!hasTops) {
    return {
      ready: false,
      reason: 'missing_tops',
      message: 'Need at least one top to generate outfits.',
    };
  }

  if (!hasBottoms) {
    return {
      ready: false,
      reason: 'missing_bottoms',
      message: 'Need at least one bottom to generate outfits.',
    };
  }

  return {
    ready: true,
    reason: null,
    message: null,
  };
};

export const fetchWardrobePoolForGeneration = async ({
  userId,
}: FetchWardrobePoolInput): Promise<FetchWardrobePoolResult> => {
  const rows = await listGenerationWardrobeItemsForUser(userId);
  const items = validateGenerationWardrobeRows(rows, userId);
  const pools = groupGenerationWardrobeItems(items);

  return {
    items,
    pools,
    counts: {
      total: items.length,
      tops: pools.tops.length,
      bottoms: pools.bottoms.length,
      footwear: pools.footwear.length,
    },
    readiness: isWardrobePoolReady(pools),
  };
};
