# WardrobeAI Backend Design Document (Final)

## 1. Overview

This document defines the backend architecture for WardrobeAI with focus on:
- Supabase Auth integration
- Database schema
- Image storage
- Node.js backend structure
- API design
- Security and validation

AI outfit generation is intentionally out of scope here.

---

## 2. Architecture

Frontend (React)
    ↓
Node Backend (API + Business Logic)
    ↓
Supabase
  - Auth
  - Postgres DB
  - Storage

---

## 3. Authentication (Supabase Auth)

### Flow
1. User signs in via Supabase (frontend)
2. Supabase returns JWT
3. Frontend sends JWT to backend
4. Backend verifies token
5. Backend extracts user_id

---

### Middleware Responsibilities

- Read Authorization header
- Verify token using Supabase
- Attach user object to request

Example:
req.user = { id: "uuid" }

---

### Rules

- Never trust user_id from frontend
- Always derive from JWT
- All protected routes require auth middleware

---

## 4. Database Schema

### clothing_items

- id (uuid, PK)
- user_id (uuid, FK → auth.users)
- name (text)
- category (text)
- color (text)
- image_url (text)
- notes (text)
- created_at (timestamp)
- updated_at (timestamp)

---

### outfits

- id (uuid, PK)
- user_id (uuid, FK)
- top_id (uuid)
- bottom_id (uuid)
- footwear_id (uuid, nullable)
- context (text)
- llm_reason (text)
- created_at (timestamp)

---

### Indexing

- index on user_id (both tables)

---

## 5. Row Level Security (Optional but Recommended)

Enable RLS:

ALTER TABLE clothing_items ENABLE ROW LEVEL SECURITY;

Policy:

CREATE POLICY "user owns items"
ON clothing_items
FOR ALL
USING (auth.uid() = user_id);

---

## 6. Image Storage

### Provider
Supabase Storage

### Bucket
wardrobe-images

### Path Structure
/{user_id}/{item_id}.jpg

---

### Upload Flow

1. Client uploads image → backend
2. Backend validates auth
3. Backend generates item_id
4. Upload to Supabase
5. Store public URL in DB

---

### Security

- Only authenticated uploads
- File path scoped by user_id

---

## 7. Backend Project Structure

wardrobe-backend/
  src/
    app.ts
    server.ts

    config/
      env.ts
      supabase.ts

    middleware/
      auth.middleware.ts
      error.middleware.ts

    modules/
      wardrobe/
        wardrobe.controller.ts
        wardrobe.service.ts
        wardrobe.repository.ts

      outfits/
        outfit.controller.ts
        outfit.service.ts
        outfit.repository.ts

      upload/
        upload.controller.ts
        upload.service.ts

    types/
      index.ts

    utils/
      logger.ts

---

## 8. Module Responsibilities

### Wardrobe Module
- Create item
- Fetch items
- Update item
- Delete item

---

### Outfit Module
- Save outfit
- Fetch outfits

---

### Upload Module
- Handle image upload
- Validate file type/size
- Upload to Supabase

---

## 9. API Design

### Wardrobe

POST   /items
GET    /items
PATCH  /items/:id
DELETE /items/:id

---

### Upload

POST /upload

---

### Outfits

POST /outfits
GET  /outfits

---

## 10. Request Flow Example

GET /items:

1. Request with JWT
2. Auth middleware validates token
3. Extract user_id
4. Query DB:
   WHERE user_id = current user
5. Return results

---

## 11. Validation Rules

- All routes require authentication
- Users can only access their own data
- Category must be valid enum
- Image must be uploaded before item creation

---

## 12. Performance Considerations

- Index user_id columns
- Avoid large payloads
- Paginate results (future)
- Use CDN for images (future)

---

## 13. Security Considerations

- JWT verification required
- No direct DB access from frontend
- Validate all inputs
- Enforce ownership checks

---

## 14. Future Enhancements

- Image compression pipeline
- Background processing
- Soft deletes
- Audit logs

---

## 15. Summary

- Supabase handles auth, DB, storage
- Node backend handles API and logic
- Auth is JWT-based via Supabase
- Strict separation of concerns is maintained
