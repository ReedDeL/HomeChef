---
name: homechef-edge-function
description: Use for HomeChef Supabase Edge Functions, CORS, Gemini photo-to-pantry, Zod boundaries, and client/secret separation.
---

# HomeChef Edge Functions

Read `docs/06_API_KEYS_AND_ENV.md` and the affected function first. CORS
preflight comes first and error responses include CORS headers. Third-party
secrets stay in Edge Function configuration; only the Supabase URL and anon key
are public. Gemini `gemini-3.6-flash` is used only for photo-to-pantry; model
output is `unknown` until Zod validates it.

Do not add a recipe-provider key, endpoint, proxy, quota guard, or live catalog
fallback. Catalog sources use approved bulk archives and authorized build tools,
not Edge Function calls. Run `npm run typecheck` and exercise changed CORS or
response contracts against a local function before handoff.
