# Auth Backend TODO

1. Create TypeScript server entrypoints (`src/app.ts`, `src/server.ts`).
2. Add strict env parsing for Supabase and server configuration.
3. Add Supabase clients (anon for token verification, service role for backend operations).
4. Implement JWT auth middleware (Bearer token parsing + Supabase verification).
5. Add protected test route (`GET /api/auth-test`) that returns authenticated user id.
6. Add centralized error handling for auth and validation failures.
7. Add `.env.example` and startup scripts for local development.
8. Typecheck and run the server for manual JWT verification.
