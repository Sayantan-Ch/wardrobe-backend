# WardrobeAI Backend V2 Migration Guide (Frontend Handoff)

## 1. What changed in V2
Backend and DB moved to a stricter wardrobe metadata model for better outfit generation.

### Core changes
- `clothing_items` now uses strict enums for category metadata.
- `POST /api/items` and `POST /api/upload` now require new fields.
- Outfit creation now validates semantic slot correctness:
  - `top_id` must be a `tops` item
  - `bottom_id` must be a `bottoms` item
  - `footwear_id` (if sent) must be a `footwear` item
- FK conflict handling is preserved (`DELETE` on referenced items returns `409`).

### DB migration
- SQL migration file: `supabase/migrations/20260501_wardrobe_schema_v2.sql`
- Migration strategy was **drop/recreate** for `clothing_items` and `outfits` (breaking).

---

## 2. Breaking API Contract Changes

## `POST /api/items` (breaking)
Old payloads are no longer accepted.

### Required fields now
- `category`
- `subcategory`
- `color`
- `formality`
- `image_url`

### Optional
- `name`
- `color_tone`
- `fit`
- `notes`

### Example
```json
{
  "name": "Blue Oxford",
  "category": "tops",
  "subcategory": "shirt",
  "color": "blue",
  "color_tone": "medium",
  "formality": "smart_casual",
  "fit": "regular",
  "image_url": "https://...",
  "notes": "office"
}
```

---

## `PATCH /api/items/:id` (expanded)
Allowed update fields:
- `name`
- `category`
- `subcategory`
- `color`
- `color_tone`
- `formality`
- `fit`
- `image_url`
- `notes`

Notes:
- At least one field required.
- `color_tone`, `fit`, `notes` can be set to `null`.

---

## `POST /api/upload` (breaking metadata contract)
Still multipart upload, but metadata now requires structured enums.

### Form-data fields
- `image` (required file)
- `category` (required)
- `subcategory` (required)
- `color` (required)
- `formality` (required)
- `name` (optional)
- `color_tone` (optional)
- `fit` (optional)
- `notes` (optional)

Behavior:
- Backend uploads file to Supabase Storage.
- Path convention: `{user_id}/{item_id}.{ext}`
- Backend creates clothing item row with strict metadata.

---

## `POST /api/outfits` (new semantic validation)
### Existing required IDs
- `top_id`
- `bottom_id`

### Optional
- `footwear_id`
- `context`
- `llm_reason`

### New validation
1. Ownership/existence check (existing behavior)
2. Slot-category check (new):
   - top must be `tops`
   - bottom must be `bottoms`
   - footwear must be `footwear`

If slot/category mismatches, backend returns `400` with `category_mismatch`.

---

## 3. Canonical Enum Values (frontend must use exact values)

## `category`
- `tops`
- `bottoms`
- `outerwear`
- `footwear`

## `subcategory`
- `tshirt`
- `shirt`
- `polo`
- `hoodie`
- `sweater`
- `jeans`
- `chinos`
- `trousers`
- `shorts`
- `joggers`
- `jacket`
- `coat`
- `sneakers`
- `formal_shoes`
- `sandals`

## `color`
- `black`
- `white`
- `gray`
- `blue`
- `navy`
- `red`
- `green`
- `beige`
- `brown`
- `yellow`

## `color_tone`
- `light`
- `medium`
- `dark`
- `neutral`

## `formality`
- `casual`
- `smart_casual`
- `formal`

## `fit`
- `slim`
- `regular`
- `oversized`

---

## 4. Category-Subcategory Compatibility Rules
Frontend should enforce this before submit:

- `tops` -> `tshirt`, `shirt`, `polo`, `hoodie`, `sweater`
- `bottoms` -> `jeans`, `chinos`, `trousers`, `shorts`, `joggers`
- `outerwear` -> `jacket`, `coat`
- `footwear` -> `sneakers`, `formal_shoes`, `sandals`

Invalid combos are rejected with `400`.

---

## 5. Error Shapes to Handle

## Validation failure
```json
{
  "error": "bad_request",
  "message": "Invalid wardrobe item payload",
  "details": [ ... ]
}
```

## Outfit missing/not-owned item IDs
```json
{
  "error": "bad_request",
  "message": "One or more referenced clothing items are missing or not owned by user",
  "missing_item_ids": ["<uuid>"]
}
```

## Outfit slot mismatch
```json
{
  "error": "bad_request",
  "message": "One or more referenced clothing items do not match expected outfit slots",
  "category_mismatch": [
    {
      "field": "top_id",
      "item_id": "<uuid>",
      "expected_category": "tops",
      "actual_category": "bottoms"
    }
  ]
}
```

## Delete conflict (item referenced by outfit)
```json
{
  "error": "conflict",
  "message": "Cannot delete item because it is referenced by one or more outfits"
}
```

---

## 6. Frontend Migration Checklist
- Update item-create form to include required fields:
  - `category`, `subcategory`, `color`, `formality`, `image_url`
- Update upload flow to send required metadata:
  - `category`, `subcategory`, `color`, `formality`
- Switch all dropdown/options to canonical enum values only.
- Add dependent subcategory UI by selected category.
- Add client-side validation for category/subcategory compatibility.
- Ensure outfit builder only allows valid slot item pools:
  - top picker from `tops`
  - bottom picker from `bottoms`
  - footwear picker from `footwear`
- Handle new error payloads (`details`, `missing_item_ids`, `category_mismatch`, `conflict`).

---

## 7. Status
- Backend v2 changes are implemented.
- Live API smoke test passed for:
  - strict item validation
  - upload metadata validation
  - outfit semantic validation
  - conflict-safe deletes
