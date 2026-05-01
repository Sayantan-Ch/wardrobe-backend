# WardrobeAI Backend - Implemented Status (Schema V2)

## 1. Current Scope Completed
The backend now includes:
- TypeScript Express server setup
- Supabase Auth token verification middleware
- Reusable auth and role guards
- Protected auth test endpoints
- Authenticated image upload endpoint
- Supabase Storage upload with programmatic path convention
- Clothing item creation in DB after successful upload
- Full wardrobe item CRUD endpoints (`/api/items`)
- Outfits create/list endpoints (`/api/outfits`)
- Conflict-safe delete handling for outfit-referenced clothing items (`409`)
- Strict enum validation for wardrobe metadata before DB writes
- Outfit slot semantic validation (`top_id`, `bottom_id`, `footwear_id`)
- Supabase migration SQL for schema-v2 drop/recreate

This is ready for frontend integration with the new strict metadata contract.

---

## 2. Tech Stack and Runtime
- Node.js + Express (TypeScript)
- Supabase (`@supabase/supabase-js`)
- Multer (multipart image upload)
- Zod (input/env validation)

Scripts available:
- `npm run dev`
- `npm run typecheck`
- `npm run build`
- `npm run start`

---

## 3. Auth Implementation
### What is implemented
- Reads JWT from `Authorization: Bearer <token>`
- Verifies token with Supabase Auth (`auth.getUser(token)`)
- Attaches authenticated user to request (`req.user`)
- Derives request role (`req.userRole`) from:
  - `app_metadata.role`
  - fallback `user_metadata.role`
  - fallback default: `user`

### Guards
- `requireAuth`: blocks unauthenticated requests with `401`
- `requireRole(['...'])`: blocks unauthorized roles with `403`

### Implemented auth endpoints
1. `GET /api/auth-test`
- Protected by `requireAuth`
- Returns authenticated user info

2. `GET /api/admin-test`
- Protected by `requireAuth` + `requireRole(['admin'])`
- Returns `403` for non-admin users

---

## 4. DB Schema V2 (Implemented + Migration)
### Migration file
- `supabase/migrations/20260501_wardrobe_schema_v2.sql`

### Migration behavior
- Drops `outfits` and `clothing_items`
- Drops and recreates enum types:
  - `clothing_category`
  - `clothing_subcategory`
  - `clothing_color`
  - `color_tone`
  - `clothing_formality`
  - `clothing_fit`
- Recreates `clothing_items` with strict typed columns:
  - required: `category`, `subcategory`, `color`, `formality`, `image_url`
  - optional: `name`, `color_tone`, `fit`, `notes`
- Recreates `outfits`
- Recreates indexes
- Enables RLS and recreates per-user `FOR ALL` policies (`USING` + `WITH CHECK`)

---

## 5. Enum Validation (Backend Strict)
A shared enum source now exists in backend:
- `src/modules/wardrobe/wardrobe.enums.ts`

Used by both item and upload validators:
- category: `tops | bottoms | outerwear | footwear`
- subcategory: `tshirt | shirt | polo | hoodie | sweater | jeans | chinos | trousers | shorts | joggers | jacket | coat | sneakers | formal_shoes | sandals`
- color: `black | white | gray | blue | navy | red | green | beige | brown | yellow`
- color_tone: `light | medium | dark | neutral`
- formality: `casual | smart_casual | formal`
- fit: `slim | regular | oversized`

Also implemented:
- category/subcategory compatibility validation at API level
- strict rejection (`400`) when enum value is invalid

---

## 6. Upload + Storage + DB Flow
### Endpoint
`POST /api/upload`

### Auth
- Requires valid bearer token (`requireAuth`)

### Request format
`multipart/form-data`
- `image` (required): JPEG/PNG/WEBP
- `category` (required enum)
- `subcategory` (required enum)
- `color` (required enum)
- `formality` (required enum)
- `name` (optional)
- `color_tone` (optional enum)
- `fit` (optional enum)
- `notes` (optional)

### File limits
- Max size: 5 MB
- Allowed MIME: `image/jpeg`, `image/png`, `image/webp`

### Programmatic path convention
On upload, backend generates:
- `itemId = UUID`
- `objectPath = {user_id}/{item_id}.{ext}`

### Storage and persistence behavior
1. Upload file to Supabase bucket
2. Get bucket public URL for object
3. Insert row into `clothing_items` with strict v2 metadata

### Failure handling
- If DB insert fails after successful upload, backend attempts storage cleanup (`remove(objectPath)`).

---

## 7. Wardrobe Items CRUD (`/api/items`)
All item routes are protected by `requireAuth` and scoped to current user.

### Endpoints
1. `POST /api/items`
- Required fields: `category`, `subcategory`, `color`, `formality`, `image_url`
- Optional fields: `name`, `color_tone`, `fit`, `notes`
- Enforces category/subcategory compatibility

2. `GET /api/items`
- Current user's items only
- Sorted by `created_at` desc
- Query params:
  - `category` (optional enum)
  - `limit` (optional, default 50, max 100)

3. `PATCH /api/items/:id`
- Updatable fields: `name`, `category`, `subcategory`, `color`, `color_tone`, `formality`, `fit`, `image_url`, `notes`
- At least one field required
- Nullable updates allowed for: `color_tone`, `fit`, `notes`
- Returns `404` if item not found for user

4. `DELETE /api/items/:id`
- Returns `404` if item not found for user
- Returns `409` conflict if item is referenced by outfit

### Conflict response
```json
{
  "error": "conflict",
  "message": "Cannot delete item because it is referenced by one or more outfits"
}
```

---

## 8. Outfits (`/api/outfits`)
All outfit routes are protected by `requireAuth` and scoped to current user.

### Endpoints
1. `POST /api/outfits`
- Required: `top_id`, `bottom_id`
- Optional: `footwear_id`, `context`, `llm_reason`
- Validates UUID format
- Validates ownership/existence of referenced clothing item IDs
- Validates slot semantics:
  - `top_id` must reference category `tops`
  - `bottom_id` must reference category `bottoms`
  - `footwear_id` (if provided) must reference category `footwear`

2. `GET /api/outfits`
- Returns current user's outfits
- Sorted by `created_at` desc
- Query param: `limit` (default 50, max 100)

### Error response: missing/not-owned IDs
```json
{
  "error": "bad_request",
  "message": "One or more referenced clothing items are missing or not owned by user",
  "missing_item_ids": ["<uuid>"]
}
```

### Error response: slot category mismatch
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

---

## 9. Frontend Contract Notes (Breaking Changes)
### `POST /api/items` new minimum payload
```json
{
  "category": "tops",
  "subcategory": "shirt",
  "color": "blue",
  "formality": "smart_casual",
  "image_url": "https://..."
}
```

### `POST /api/upload` metadata now requires
- `category`
- `subcategory`
- `color`
- `formality`

### Important
- Enum values must match canonical backend values exactly.
- Old payloads (`category` + optional `color`) are no longer accepted.

---

## 10. Verification Done
- TypeScript compile check passed:
  - `npm run typecheck`
