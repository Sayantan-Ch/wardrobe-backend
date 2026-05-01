export const CLOTHING_CATEGORIES = ['tops', 'bottoms', 'outerwear', 'footwear'] as const;

export const CLOTHING_SUBCATEGORIES = [
  'tshirt',
  'shirt',
  'polo',
  'hoodie',
  'sweater',
  'jeans',
  'chinos',
  'trousers',
  'shorts',
  'joggers',
  'jacket',
  'coat',
  'sneakers',
  'formal_shoes',
  'sandals',
] as const;

export const CLOTHING_COLORS = [
  'black',
  'white',
  'gray',
  'blue',
  'navy',
  'red',
  'green',
  'beige',
  'brown',
  'yellow',
] as const;

export const COLOR_TONES = ['light', 'medium', 'dark', 'neutral'] as const;

export const CLOTHING_FORMALITIES = ['casual', 'smart_casual', 'formal'] as const;

export const CLOTHING_FITS = ['slim', 'regular', 'oversized'] as const;

const TOP_SUBCATEGORIES = ['tshirt', 'shirt', 'polo', 'hoodie', 'sweater'] as const;
const BOTTOM_SUBCATEGORIES = ['jeans', 'chinos', 'trousers', 'shorts', 'joggers'] as const;
const OUTERWEAR_SUBCATEGORIES = ['jacket', 'coat'] as const;
const FOOTWEAR_SUBCATEGORIES = ['sneakers', 'formal_shoes', 'sandals'] as const;

export const SUBCATEGORY_BY_CATEGORY = {
  tops: TOP_SUBCATEGORIES,
  bottoms: BOTTOM_SUBCATEGORIES,
  outerwear: OUTERWEAR_SUBCATEGORIES,
  footwear: FOOTWEAR_SUBCATEGORIES,
} as const;

export type ClothingCategory = (typeof CLOTHING_CATEGORIES)[number];
export type ClothingSubcategory = (typeof CLOTHING_SUBCATEGORIES)[number];
export type ClothingColor = (typeof CLOTHING_COLORS)[number];
export type ColorTone = (typeof COLOR_TONES)[number];
export type ClothingFormality = (typeof CLOTHING_FORMALITIES)[number];
export type ClothingFit = (typeof CLOTHING_FITS)[number];
