# WardrobeAI — Final Database Schema & Enums

## 🧱 Overview
This document defines the final PostgreSQL (Supabase) schema for:
- clothing_items
- outfits
- enums used for structured metadata

---

## 🔧 Extensions

```sql
create extension if not exists "uuid-ossp";
```

---

## 🎯 ENUM DEFINITIONS

```sql
create type clothing_category as enum (
  'tops',
  'bottoms',
  'outerwear',
  'footwear'
);

create type clothing_subcategory as enum (
  -- tops
  'tshirt',
  'shirt',
  'polo',
  'hoodie',
  'sweater',

  -- bottoms
  'jeans',
  'chinos',
  'trousers',
  'shorts',
  'joggers',

  -- outerwear
  'jacket',
  'coat',

  -- footwear
  'sneakers',
  'formal_shoes',
  'sandals'
);

create type clothing_color as enum (
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

create type color_tone as enum (
  'light',
  'medium',
  'dark',
  'neutral'
);

create type clothing_formality as enum (
  'casual',
  'smart_casual',
  'formal'
);

create type clothing_fit as enum (
  'slim',
  'regular',
  'oversized'
);
```

---

## 🧱 TABLE: clothing_items

```sql
create table clothing_items (
  id uuid primary key default uuid_generate_v4(),

  user_id uuid not null references auth.users(id) on delete cascade,

  name text,

  category clothing_category not null,
  subcategory clothing_subcategory not null,

  color clothing_color not null,
  color_tone color_tone,

  formality clothing_formality not null,
  fit clothing_fit,

  image_url text not null,
  notes text,

  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create index idx_clothing_items_user_id on clothing_items(user_id);
create index idx_clothing_items_category on clothing_items(category);
create index idx_clothing_items_subcategory on clothing_items(subcategory);
```

---

## 🧱 TABLE: outfits

```sql
create table outfits (
  id uuid primary key default uuid_generate_v4(),

  user_id uuid not null references auth.users(id) on delete cascade,

  top_id uuid not null references clothing_items(id),
  bottom_id uuid not null references clothing_items(id),
  footwear_id uuid references clothing_items(id),

  context text,
  llm_reason text,

  created_at timestamp with time zone default now()
);

create index idx_outfits_user_id on outfits(user_id);
```

---

## 🔐 ROW LEVEL SECURITY (RECOMMENDED)

```sql
alter table clothing_items enable row level security;
alter table outfits enable row level security;

create policy "Users can manage their own clothing items"
on clothing_items
for all
using (auth.uid() = user_id);

create policy "Users can manage their own outfits"
on outfits
for all
using (auth.uid() = user_id);
```

---

## 🖼️ STORAGE DESIGN

- Bucket: wardrobe-images
- Path format:

```
/{user_id}/{item_id}.jpg
```

---

## 🧠 NOTES

- Enums ensure consistent structured data
- Subcategory and formality are critical for outfit generation
- Fit is included for styling nuance (not strict validation)
- RLS ensures user-level data isolation

---

## ✅ Summary

- Strong typed schema using enums
- Supabase Auth integrated via user_id
- Scalable for future AI-driven features
