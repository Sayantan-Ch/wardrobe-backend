# WardrobeAI Backend Design (Current V2)

This document reflects the **actual implemented backend** and is intended as a working map for engineers/coding agents.

## 1) System Overview

Architecture:
- Frontend (React) handles user interaction and Supabase sign-in.
- Node.js/Express backend handles auth verification, validation, business rules, and data writes.
- Supabase provides Auth, Postgres, and Storage.

Flow:
1. Frontend signs in with Supabase Auth and gets JWT.
2. Frontend sends JWT to backend as `Authorization: Bearer <token>`.
3. Backend verifies JWT via Supabase and derives `req.user` + `req.userRole`.
4. Backend validates payloads (Zod), applies business rules, and writes via service-role client.

---

## 2) Runtime, Entry Points, and Config

Main runtime files:
- `src/server.ts`: process entrypoint, starts Express app.
- `src/app.ts`: middleware wiring + route registration.

Environment loading:
- `src/config/env.ts`: validates env via Zod.
- Required env keys:
  - `NODE_ENV`
  - `PORT`
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `SUPABASE_STORAGE_BUCKET` (default `wardrobe-images`)

Supabase clients:
- `src/config/supabase.ts`
  - `supabaseAnonClient`: token verification (`auth.getUser(token)`).
  - `supabaseServiceRoleClient`: DB/storage reads+writes from backend.

---

## 3) Auth and Authorization

Middleware:
- `src/middleware/auth.middleware.ts`

Behavior:
- `requireAuth`
  - Validates bearer token.
  - Calls `supabaseAnonClient.auth.getUser(token)`.
  - Sets `req.user` and `req.userRole`.
- `requireRole(allowedRoles)`
  - Checks `req.userRole` membership.

Role derivation order:
1. `user.app_metadata.role`
2. `user.user_metadata.role`
3. fallback: `'user'`

Auth test routes:
- `src/routes/auth.routes.ts`
  - `GET /api/auth-test`
  - `GET /api/admin-test` (requires role `admin`)

Security rules used across modules:
- Never trust `user_id` from frontend body/query.
- Always scope DB ops with `req.user.id`.

---

## 4) Database Model (Schema V2)

Migration reference:
- `supabase/migrations/20260501_wardrobe_schema_v2.sql`

Tables:
1. `clothing_items`
- `id uuid pk`
- `user_id uuid fk -> auth.users(id)`
- `name text nullable`
- `category clothing_category not null`
- `subcategory clothing_subcategory not null`
- `color clothing_color not null`
- `color_tone color_tone nullable`
- `formality clothing_formality not null`
- `fit clothing_fit nullable`
- `image_url text not null`
- `notes text nullable`
- `created_at`, `updated_at`

2. `outfits`
- `id uuid pk`
- `user_id uuid fk -> auth.users(id)`
- `top_id uuid fk -> clothing_items(id)`
- `bottom_id uuid fk -> clothing_items(id)`
- `footwear_id uuid nullable fk -> clothing_items(id)`
- `context text nullable`
- `llm_reason text nullable`
- `created_at`

Indexes:
- `clothing_items(user_id)`, `clothing_items(category)`, `clothing_items(subcategory)`
- `outfits(user_id)`

RLS:
- Enabled on both tables.
- Per-user `FOR ALL` policies with `USING` + `WITH CHECK` on `auth.uid() = user_id`.

---

## 5) Enum System and Validation Contract

Canonical enum source (backend):
- `src/modules/wardrobe/wardrobe.enums.ts`

Enums:
- `category`: `tops | bottoms | outerwear | footwear`
- `subcategory`: `tshirt | shirt | polo | hoodie | sweater | jeans | chinos | trousers | shorts | joggers | jacket | coat | sneakers | formal_shoes | sandals`
- `color`: `black | white | gray | blue | navy | red | green | beige | brown | yellow`
- `color_tone`: `light | medium | dark | neutral`
- `formality`: `casual | smart_casual | formal`
- `fit`: `slim | regular | oversized`

Category-subcategory compatibility map is enforced at API validation level:
- `tops -> tshirt, shirt, polo, hoodie, sweater`
- `bottoms -> jeans, chinos, trousers, shorts, joggers`
- `outerwear -> jacket, coat`
- `footwear -> sneakers, formal_shoes, sandals`

---

## 6) Module Map (Where To Look)

## Wardrobe module (`src/modules/wardrobe`)
- `wardrobe.schemas.ts`: create/update/list param validation.
- `wardrobe.repository.ts`: DB queries for `clothing_items`.
- `wardrobe.service.ts`: payload mapping + orchestration.
- `wardrobe.controller.ts`: HTTP handling + status codes.
- `wardrobe.routes.ts`: route registration.

Responsibilities:
- Create/list/update/delete clothing items.
- Enforce strict enum validation and category/subcategory pairing.
- Map FK delete errors to `409 conflict` when item is outfit-referenced.

## Upload module (`src/modules/upload`)
- `upload.middleware.ts`: multer memory upload, mime/type + size checks.
- `upload.schemas.ts`: strict metadata validation.
- `upload.service.ts`: storage upload + DB insert + cleanup on partial failure.
- `upload.controller.ts`: endpoint logic.
- `upload.routes.ts`: route and upload error mapping.

Responsibilities:
- `POST /api/upload` multipart image flow.
- Storage path convention: `{user_id}/{item_id}.{ext}`.
- Insert v2 metadata into `clothing_items` after upload.

## Outfits module (`src/modules/outfits`)
- `outfits.schemas.ts`: create/list validation.
- `outfits.repository.ts`: DB queries and owned-item fetch.
- `outfits.service.ts`: ownership + slot semantic validation.
- `outfits.controller.ts`: response branching for error types.
- `outfits.routes.ts`: route registration.

Responsibilities:
- Create/list outfits.
- Ensure referenced items are owned by current user.
- Enforce slot semantics:
  - `top_id` category must be `tops`
  - `bottom_id` category must be `bottoms`
  - `footwear_id` category must be `footwear`

---

## 7) API Surface (Current)

Base prefix: `/api`

Auth:
- `GET /api/auth-test`
- `GET /api/admin-test`

Upload:
- `POST /api/upload` (multipart form-data)

Wardrobe items:
- `POST /api/items`
- `GET /api/items`
- `PATCH /api/items/:id`
- `DELETE /api/items/:id`

Outfits:
- `POST /api/outfits`
- `GET /api/outfits`

Health:
- `GET /health`

---

## 8) Request/Validation Expectations

## `POST /api/items`
Required:
- `category`, `subcategory`, `color`, `formality`, `image_url`

Optional:
- `name`, `color_tone`, `fit`, `notes`

## `PATCH /api/items/:id`
- Same field set as create, all optional.
- At least one field required.
- `color_tone`, `fit`, `notes` accept `null`.

## `POST /api/upload` (multipart)
Required metadata fields:
- `category`, `subcategory`, `color`, `formality`

Optional metadata fields:
- `name`, `color_tone`, `fit`, `notes`

File rules:
- single field: `image`
- mime: jpeg/png/webp
- size <= 5MB

## `POST /api/outfits`
Required:
- `top_id`, `bottom_id` (UUID)

Optional:
- `footwear_id`, `context`, `llm_reason`

Checks:
1. all referenced item IDs exist and are owned by requesting user
2. slot/category semantic match

---

## 9) Error Handling Model

Global middleware:
- `src/middleware/error.middleware.ts`

App error class:
- `src/errors/app-error.ts`

Conventions:
- Validation failures -> `400 bad_request`
- Missing/invalid auth -> `401 unauthorized`
- Role denied -> `403 forbidden`
- Missing route -> `404 not_found`
- FK conflict on delete referenced clothing item -> `409 conflict`
- Unhandled errors -> `500 internal_server_error`

Outfit create custom failures:
- missing/not-owned items -> `400` with `missing_item_ids`
- slot mismatch -> `400` with `category_mismatch`

---

## 10) Storage Behavior

Bucket:
- controlled by `SUPABASE_STORAGE_BUCKET` (default `wardrobe-images`)

Object naming:
- generated server-side with `randomUUID` item id
- `{user_id}/{item_id}.{ext}` where ext derives from mime

Consistency behavior:
- If storage upload succeeds but DB insert fails, backend attempts object cleanup (`remove`).

---

## 11) Operational Notes for Agents

When changing backend behavior, check these in order:
1. Validation schemas (`*.schemas.ts`)
2. Service orchestration (`*.service.ts`)
3. Repository query shape (`*.repository.ts`)
4. Controller error/status branching (`*.controller.ts`)
5. Route wiring (`*.routes.ts`)
6. Update docs:
   - `implemented_backend.md`
   - `v2_backend_migration.md` (if contract changes affect frontend)

If schema changes are made:
- add/update SQL in `supabase/migrations/`
- keep enum lists aligned across DB and `wardrobe.enums.ts`
- verify with live API smoke tests (auth, items, upload, outfits, conflict path)
