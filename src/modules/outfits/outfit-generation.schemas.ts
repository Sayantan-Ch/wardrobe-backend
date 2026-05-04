import { z } from 'zod';
import {
  CLOTHING_COLORS,
  CLOTHING_FITS,
  CLOTHING_FORMALITIES,
  CLOTHING_SUBCATEGORIES,
  COLOR_TONES,
  SUBCATEGORY_BY_CATEGORY,
} from '../wardrobe/wardrobe.enums';

export const OUTFIT_OCCASIONS = [
  'casual_hangout',
  'office',
  'dinner',
  'date',
  'party',
  'wedding',
  'interview',
  'travel',
  'errand',
  'unknown',
] as const;

export const OUTFIT_MOODS = [
  'relaxed',
  'sharp',
  'minimal',
  'bold',
  'cozy',
  'sporty',
  'elegant',
] as const;

export const OUTFIT_GENERATION_CATEGORIES = ['tops', 'bottoms', 'footwear'] as const;

export const SCORE_COMPONENTS = [
  'occasion',
  'formality',
  'color',
  'mood',
  'fit',
  'preferences',
] as const;

const MAX_MOODS = 3;
const MAX_ENUM_FILTER_VALUES = 10;
const MAX_ITEM_IDS = 20;
const MAX_STYLING_NOTES = 5;

const clothingColorSchema = z.enum(CLOTHING_COLORS);
const clothingFitSchema = z.enum(CLOTHING_FITS);
const clothingFormalitySchema = z.enum(CLOTHING_FORMALITIES);
const clothingSubcategorySchema = z.enum(CLOTHING_SUBCATEGORIES);
const colorToneSchema = z.enum(COLOR_TONES);

const topSubcategorySchema = z.enum(SUBCATEGORY_BY_CATEGORY.tops);
const bottomSubcategorySchema = z.enum(SUBCATEGORY_BY_CATEGORY.bottoms);
const footwearSubcategorySchema = z.enum(SUBCATEGORY_BY_CATEGORY.footwear);

const uniqueCapped = <Value>(values: Value[], max: number): Value[] => {
  return [...new Set(values)].slice(0, max);
};

const arrayWithDefault = <Value>(
  schema: z.ZodType<Value>,
  max: number,
) =>
  z
    .array(schema)
    .optional()
    .default([])
    .transform((values) => uniqueCapped(values, max));

const nullableTrimmedStringSchema = z
  .string()
  .trim()
  .min(1)
  .nullable()
  .optional()
  .transform((value) => value ?? null);

const validateCategorySubcategory = (
  data: { category: 'tops' | 'bottoms' | 'footwear'; subcategory: z.infer<typeof clothingSubcategorySchema> },
  ctx: z.RefinementCtx,
) => {
  const allowedSubcategories = SUBCATEGORY_BY_CATEGORY[data.category];

  if (!allowedSubcategories.includes(data.subcategory as never)) {
    ctx.addIssue({
      code: 'custom',
      path: ['subcategory'],
      message: `subcategory '${data.subcategory}' is not valid for category '${data.category}'`,
    });
  }
};

const fullHardFiltersDefault = {
  excluded_colors: [],
  excluded_subcategories: [],
  excluded_fits: [],
  required_item_ids: [],
  excluded_item_ids: [],
};

const fullSoftPreferencesDefault = {
  preferred_formalities: [],
  preferred_top_subcategories: [],
  preferred_bottom_subcategories: [],
  preferred_footwear_subcategories: [],
  preferred_colors: [],
  preferred_top_colors: [],
  preferred_bottom_colors: [],
  preferred_footwear_colors: [],
  preferred_fits: [],
};

export const generateOutfitsRequestSchema = z.object({
  query: z.string().trim().min(1).max(1_000),
  limit: z.coerce.number().int().positive().max(10).default(5),
});

export const outfitOccasionSchema = z.enum(OUTFIT_OCCASIONS);
export const outfitMoodSchema = z.enum(OUTFIT_MOODS);

export const outfitHardFiltersSchema = z.object({
  excluded_colors: arrayWithDefault(clothingColorSchema, MAX_ENUM_FILTER_VALUES),
  excluded_subcategories: arrayWithDefault(clothingSubcategorySchema, MAX_ENUM_FILTER_VALUES),
  excluded_fits: arrayWithDefault(clothingFitSchema, MAX_ENUM_FILTER_VALUES),
  required_item_ids: arrayWithDefault(z.uuid(), MAX_ITEM_IDS),
  excluded_item_ids: arrayWithDefault(z.uuid(), MAX_ITEM_IDS),
});

export const outfitSoftPreferencesSchema = z.object({
  preferred_formalities: arrayWithDefault(clothingFormalitySchema, MAX_ENUM_FILTER_VALUES),
  preferred_top_subcategories: arrayWithDefault(topSubcategorySchema, MAX_ENUM_FILTER_VALUES),
  preferred_bottom_subcategories: arrayWithDefault(bottomSubcategorySchema, MAX_ENUM_FILTER_VALUES),
  preferred_footwear_subcategories: arrayWithDefault(footwearSubcategorySchema, MAX_ENUM_FILTER_VALUES),
  preferred_colors: arrayWithDefault(clothingColorSchema, MAX_ENUM_FILTER_VALUES),
  preferred_top_colors: arrayWithDefault(clothingColorSchema, MAX_ENUM_FILTER_VALUES),
  preferred_bottom_colors: arrayWithDefault(clothingColorSchema, MAX_ENUM_FILTER_VALUES),
  preferred_footwear_colors: arrayWithDefault(clothingColorSchema, MAX_ENUM_FILTER_VALUES),
  preferred_fits: arrayWithDefault(clothingFitSchema, MAX_ENUM_FILTER_VALUES),
});

export const outfitIntentSchema = z.object({
  occasion: outfitOccasionSchema.default('unknown'),
  target_formality: clothingFormalitySchema,
  moods: arrayWithDefault(outfitMoodSchema, MAX_MOODS),
  hard_filters: outfitHardFiltersSchema.default(fullHardFiltersDefault),
  soft_preferences: outfitSoftPreferencesSchema.default(fullSoftPreferencesDefault),
});

const generationClothingItemShape = {
  id: z.uuid(),
  name: nullableTrimmedStringSchema,
  category: z.enum(OUTFIT_GENERATION_CATEGORIES),
  subcategory: clothingSubcategorySchema,
  color: clothingColorSchema,
  color_tone: colorToneSchema
    .nullable()
    .optional()
    .transform((value) => value ?? null),
  formality: clothingFormalitySchema,
  fit: clothingFitSchema
    .nullable()
    .optional()
    .transform((value) => value ?? null),
  image_url: z.url(),
  notes: nullableTrimmedStringSchema,
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
};

export const outfitGenerationClothingItemSchema = z
  .object({
    ...generationClothingItemShape,
    user_id: z.uuid(),
  })
  .superRefine(validateCategorySubcategory);

export const outfitRecommendationItemSchema = z
  .object(generationClothingItemShape)
  .superRefine(validateCategorySubcategory);

const generatedTopSchema = outfitGenerationClothingItemSchema.refine((item) => item.category === 'tops', {
  message: 'candidate top must have category tops',
});

const generatedBottomSchema = outfitGenerationClothingItemSchema.refine(
  (item) => item.category === 'bottoms',
  {
    message: 'candidate bottom must have category bottoms',
  },
);

const generatedFootwearSchema = outfitGenerationClothingItemSchema.refine(
  (item) => item.category === 'footwear',
  {
    message: 'candidate footwear must have category footwear',
  },
);

const recommendationTopSchema = outfitRecommendationItemSchema.refine((item) => item.category === 'tops', {
  message: 'recommendation top must have category tops',
});

const recommendationBottomSchema = outfitRecommendationItemSchema.refine(
  (item) => item.category === 'bottoms',
  {
    message: 'recommendation bottom must have category bottoms',
  },
);

const recommendationFootwearSchema = outfitRecommendationItemSchema.refine(
  (item) => item.category === 'footwear',
  {
    message: 'recommendation footwear must have category footwear',
  },
);

export const generatedCandidateSchema = z.object({
  id: z.string().trim().min(1),
  top: generatedTopSchema,
  bottom: generatedBottomSchema,
  footwear: generatedFootwearSchema.nullable(),
});

export const scoreBreakdownSchema = z.object({
  occasion: z.number().min(0).max(23),
  formality: z.number().min(0).max(20),
  color: z.number().min(0).max(22),
  mood: z.number().min(0).max(12),
  fit: z.number().min(0).max(8),
  preferences: z.number().min(0).max(15),
});

export const scoredCandidateSchema = z.object({
  candidate: generatedCandidateSchema,
  score: z.number().min(0).max(100),
  score_breakdown: scoreBreakdownSchema,
});

export const rankedCandidateSchema = scoredCandidateSchema.extend({
  rank: z.number().int().positive(),
});

const stylingNotesSchema = z
  .array(z.string().trim().min(1).max(300))
  .max(MAX_STYLING_NOTES)
  .default([]);

export const curatedRecommendationSchema = z.object({
  candidate_id: z.string().trim().min(1),
  title: z.string().trim().min(1).max(120),
  reason: z.string().trim().min(1).max(1_000),
  styling_notes: stylingNotesSchema,
});

export const curatorOutputSchema = z.object({
  recommendations: z.array(curatedRecommendationSchema),
});

export const generatedOutfitRecommendationSchema = z.object({
  candidate_id: z.string().trim().min(1),
  rank: z.number().int().positive(),
  title: z.string().trim().min(1).max(120),
  reason: z.string().trim().min(1).max(1_000),
  styling_notes: stylingNotesSchema,
  outfit: z.object({
    top: recommendationTopSchema,
    bottom: recommendationBottomSchema,
    footwear: recommendationFootwearSchema.nullable(),
  }),
  score: z.number().min(0).max(100),
  score_breakdown: scoreBreakdownSchema,
});

export const generateOutfitsResponseSchema = z.object({
  intent: outfitIntentSchema,
  recommendations: z.array(generatedOutfitRecommendationSchema),
  debug: z
    .object({
      generated_count: z.number().int().nonnegative(),
      rejected_count: z.number().int().nonnegative(),
      scored_count: z.number().int().nonnegative().optional(),
      ranked_count: z.number().int().nonnegative(),
      curation_fallback_used: z.boolean().optional(),
    })
    .optional(),
});

export const outfitGenerationErrorCodeSchema = z.enum([
  'bad_request',
  'classification_failed',
  'invalid_intent',
  'not_enough_items',
  'no_valid_outfits',
  'curation_failed',
  'generation_failed',
]);

export const outfitGenerationErrorResponseSchema = z.object({
  error: outfitGenerationErrorCodeSchema,
  message: z.string().trim().min(1),
  details: z.unknown().optional(),
});

export const outfitGenerationErrorStatusMap = {
  bad_request: {
    status: 400,
    message: 'Invalid outfit generation request',
    exposeDetails: true,
  },
  classification_failed: {
    status: 502,
    message: 'Unable to understand outfit request',
    exposeDetails: false,
  },
  invalid_intent: {
    status: 400,
    message: 'Invalid outfit intent',
    exposeDetails: true,
  },
  not_enough_items: {
    status: 422,
    message: 'Not enough wardrobe items to generate outfits',
    exposeDetails: true,
  },
  no_valid_outfits: {
    status: 422,
    message: 'No valid outfits could be generated from the current wardrobe and request',
    exposeDetails: true,
  },
  curation_failed: {
    status: 502,
    message: 'Unable to curate outfit recommendations',
    exposeDetails: false,
  },
  generation_failed: {
    status: 500,
    message: 'Unable to generate outfits',
    exposeDetails: false,
  },
} as const satisfies Record<
  z.infer<typeof outfitGenerationErrorCodeSchema>,
  {
    status: 400 | 422 | 500 | 502;
    message: string;
    exposeDetails: boolean;
  }
>;

export type GenerateOutfitsRequestInput = z.infer<typeof generateOutfitsRequestSchema>;
export type OutfitOccasion = z.infer<typeof outfitOccasionSchema>;
export type OutfitMood = z.infer<typeof outfitMoodSchema>;
export type OutfitHardFilters = z.infer<typeof outfitHardFiltersSchema>;
export type OutfitSoftPreferences = z.infer<typeof outfitSoftPreferencesSchema>;
export type OutfitIntent = z.infer<typeof outfitIntentSchema>;
export type OutfitGenerationClothingItem = z.infer<typeof outfitGenerationClothingItemSchema>;
export type OutfitRecommendationItem = z.infer<typeof outfitRecommendationItemSchema>;
export type GeneratedCandidate = z.infer<typeof generatedCandidateSchema>;
export type ScoreBreakdown = z.infer<typeof scoreBreakdownSchema>;
export type ScoredCandidate = z.infer<typeof scoredCandidateSchema>;
export type RankedCandidate = z.infer<typeof rankedCandidateSchema>;
export type CuratedRecommendation = z.infer<typeof curatedRecommendationSchema>;
export type CuratorOutput = z.infer<typeof curatorOutputSchema>;
export type GenerateOutfitsResponse = z.infer<typeof generateOutfitsResponseSchema>;
export type OutfitGenerationErrorCode = z.infer<typeof outfitGenerationErrorCodeSchema>;
export type OutfitGenerationErrorResponse = z.infer<typeof outfitGenerationErrorResponseSchema>;
export type OutfitGenerationErrorStatusMap = typeof outfitGenerationErrorStatusMap;
