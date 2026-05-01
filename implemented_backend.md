# WardrobeAI Backend - Implemented Status

## 1. Current Scope Completed
The backend currently includes:
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

This is now ready for frontend integration for auth, upload, wardrobe item management, and outfit save/list flows.

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

## 4. Upload + Storage + DB Flow
### Endpoint
`POST /api/upload`

### Auth
- Requires valid bearer token (`requireAuth`)

### Request format
`multipart/form-data`
- `image` (required): JPEG/PNG/WEBP
- `name` (required)
- `category` (required)
- `color` (optional)
- `notes` (optional)

### File limits
- Max size: 5 MB
- Allowed MIME: `image/jpeg`, `image/png`, `image/webp`

### Programmatic path convention (implemented)
On upload, backend generates:
- `itemId = UUID`
- `objectPath = {user_id}/{item_id}.{ext}`
  - extension is derived from MIME type (`jpg`, `png`, `webp`)

### Storage and persistence behavior
1. Upload file to Supabase bucket (default env: `wardrobe-images`)
2. Get bucket public URL for object
3. Insert row into `clothing_items` with:
- `id = itemId`
- `user_id = req.user.id`
- `name`, `category`, `color`, `notes`
- `image_url = public URL`

### Failure handling
- If DB insert fails after successful upload, backend attempts storage cleanup (`remove(objectPath)`) to avoid orphan files.

---

## 5. Wardrobe Items CRUD (`/api/items`)
All item routes are protected by `requireAuth` and strictly scoped to the current authenticated user (`req.user.id`).

### Endpoints
1. `POST /api/items`
- Creates a clothing item metadata record (without upload)
- Required fields: `name`, `category`
- Optional: `color`, `image_url`, `notes`

2. `GET /api/items`
- Returns current user's items only
- Sorted by `created_at` descending
- Supports query params:
  - `category` (optional exact filter)
  - `limit` (optional, default 50, max 100)

3. `PATCH /api/items/:id`
- Updates allowed fields: `name`, `category`, `color`, `image_url`, `notes`
- Requires at least one field
- Returns `404` if item not found for that user

4. `DELETE /api/items/:id`
- Deletes only the current user's matching item
- Returns `404` if item not found for that user
- If the item is referenced by one or more outfits, now returns `409`:
```json
{
  "error": "conflict",
  "message": "Cannot delete item because it is referenced by one or more outfits"
}
```

### Ownership and security
- No `user_id` accepted from request body
- DB operations always enforce `where user_id = req.user.id`

---

## 6. Outfits (`/api/outfits`)
All outfit routes are protected by `requireAuth` and scoped to current user.

### Endpoints
1. `POST /api/outfits`
- Required: `top_id`, `bottom_id`
- Optional: `footwear_id`, `context`, `llm_reason`
- Validates UUID format for all item IDs
- Validates ownership/existence: all referenced clothing item IDs must belong to current user
- On success creates outfit row in `outfits`

2. `GET /api/outfits`
- Returns current user's outfits only
- Sorted by `created_at` descending
- Supports query param:
  - `limit` (optional, default 50, max 100)

### Ownership/existence validation behavior
- If referenced item IDs are valid UUIDs but not owned/missing, returns `400` with `missing_item_ids`

---

## 7. Response Shapes (for frontend)
### `GET /api/auth-test` success
```json
{
  "message": "Authenticated request",
  "user": {
    "id": "<uuid>",
    "email": "<email|null>",
    "role": "user|admin|..."
  }
}
```

### `GET /api/admin-test` non-admin
```json
{
  "error": "forbidden",
  "message": "Insufficient role permissions"
}
```

### `POST /api/upload` success
```json
{
  "message": "Image uploaded and wardrobe item created",
  "item": {
    "id": "<uuid>",
    "user_id": "<uuid>",
    "name": "Blue Tee",
    "category": "top",
    "color": "blue",
    "image_url": "https://...",
    "notes": "...",
    "created_at": "...",
    "updated_at": "..."
  },
  "storage": {
    "bucket": "wardrobe-images",
    "objectPath": "<user_id>/<item_id>.jpg",
    "imageUrl": "https://..."
  }
}
```

### `POST /api/items` success
```json
{
  "item": {
    "id": "<uuid>",
    "user_id": "<uuid>",
    "name": "Olive Shirt",
    "category": "top",
    "color": "olive",
    "image_url": null,
    "notes": "weekday",
    "created_at": "...",
    "updated_at": "..."
  }
}
```

### `GET /api/items` success
```json
{
  "items": [
    {
      "id": "<uuid>",
      "user_id": "<uuid>",
      "name": "Olive Shirt",
      "category": "top",
      "color": "olive",
      "image_url": null,
      "notes": "weekday",
      "created_at": "...",
      "updated_at": "..."
    }
  ]
}
```

### `POST /api/outfits` success
```json
{
  "outfit": {
    "id": "<uuid>",
    "user_id": "<uuid>",
    "top_id": "<uuid>",
    "bottom_id": "<uuid>",
    "footwear_id": null,
    "context": "office",
    "llm_reason": null,
    "created_at": "..."
  }
}
```

### `GET /api/outfits` success
```json
{
  "outfits": [
    {
      "id": "<uuid>",
      "user_id": "<uuid>",
      "top_id": "<uuid>",
      "bottom_id": "<uuid>",
      "footwear_id": null,
      "context": "office",
      "llm_reason": null,
      "created_at": "..."
    }
  ]
}
```

### `POST /api/outfits` missing ownership/items
```json
{
  "error": "bad_request",
  "message": "One or more referenced clothing items are missing or not owned by user",
  "missing_item_ids": ["<uuid>", "<uuid>"]
}
```

### Standard error examples
```json
{
  "error": "unauthorized",
  "message": "Missing or invalid Authorization header"
}
```

```json
{
  "error": "unauthorized",
  "message": "Invalid or expired token"
}
```

```json
{
  "error": "bad_request",
  "message": "image file is required"
}
```

```json
{
  "error": "not_found",
  "message": "Item not found"
}
```

---

## 8. Required Env Vars
Backend currently expects:
- `NODE_ENV`
- `PORT`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET` (default: `wardrobe-images`)

---

## 9. What Frontend Can Integrate Now
1. Supabase login on frontend to get access token
2. Send token in `Authorization` header for protected backend routes
3. Use `/api/auth-test` to validate session wiring
4. Use `/api/upload` to upload clothing image + metadata and receive persisted clothing item with storage URL
5. Use `/api/items` CRUD for wardrobe listing and metadata edits/deletes
6. Use `/api/outfits` to save and list outfits composed from owned clothing item IDs
7. Handle `409 conflict` when deleting items that are in use by outfits

---

## 10. Verification Completed
The following live smoke checks were run against the local backend with a real Supabase token:
- Auth test endpoint: pass (`200`)
- Admin test endpoint for non-admin token: pass (`403`)
- Items create/list/update/delete flow: pass (`201`, `200`, `200`, `200`)
- Outfits create/list flow: pass (`201`, `200`)
- Outfits ownership validation with valid-but-missing item IDs: pass (`400` + `missing_item_ids`)
- Delete conflict mapping for outfit-referenced items: pass (`409` + `error: conflict`)

---

## 11. Not Yet Implemented (Upcoming)
- Pagination/filter/search enhancements beyond basic `limit/category`
- Consistent module-level error code taxonomy across all repository errors
- Automated test suite (`vitest`/`supertest`)

