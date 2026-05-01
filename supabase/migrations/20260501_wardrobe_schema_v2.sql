-- Wardrobe schema v2 (breaking): drop/recreate tables + enums

begin;

-- Drop dependent tables first
DROP TABLE IF EXISTS outfits;
DROP TABLE IF EXISTS clothing_items;

-- Drop enums if they already exist
DROP TYPE IF EXISTS clothing_fit;
DROP TYPE IF EXISTS clothing_formality;
DROP TYPE IF EXISTS color_tone;
DROP TYPE IF EXISTS clothing_color;
DROP TYPE IF EXISTS clothing_subcategory;
DROP TYPE IF EXISTS clothing_category;

-- Ensure extension exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enums
CREATE TYPE clothing_category AS ENUM (
  'tops',
  'bottoms',
  'outerwear',
  'footwear'
);

CREATE TYPE clothing_subcategory AS ENUM (
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
  'sandals'
);

CREATE TYPE clothing_color AS ENUM (
  'black',
  'white',
  'gray',
  'blue',
  'navy',
  'red',
  'green',
  'beige',
  'brown',
  'yellow'
);

CREATE TYPE color_tone AS ENUM (
  'light',
  'medium',
  'dark',
  'neutral'
);

CREATE TYPE clothing_formality AS ENUM (
  'casual',
  'smart_casual',
  'formal'
);

CREATE TYPE clothing_fit AS ENUM (
  'slim',
  'regular',
  'oversized'
);

-- Tables
CREATE TABLE clothing_items (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text,
  category clothing_category NOT NULL,
  subcategory clothing_subcategory NOT NULL,
  color clothing_color NOT NULL,
  color_tone color_tone,
  formality clothing_formality NOT NULL,
  fit clothing_fit,
  image_url text NOT NULL,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE INDEX idx_clothing_items_user_id ON clothing_items(user_id);
CREATE INDEX idx_clothing_items_category ON clothing_items(category);
CREATE INDEX idx_clothing_items_subcategory ON clothing_items(subcategory);

CREATE TABLE outfits (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  top_id uuid NOT NULL REFERENCES clothing_items(id),
  bottom_id uuid NOT NULL REFERENCES clothing_items(id),
  footwear_id uuid REFERENCES clothing_items(id),
  context text,
  llm_reason text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE INDEX idx_outfits_user_id ON outfits(user_id);

-- RLS
ALTER TABLE clothing_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE outfits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own clothing items"
ON clothing_items
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage their own outfits"
ON outfits
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

commit;
