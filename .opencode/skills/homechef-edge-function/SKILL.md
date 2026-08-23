---
name: homechef-edge-function
description: Use when creating or editing Supabase Edge Functions — CORS handling, the analyze-pantry-photo Gemini vision call, Zod structured outputs, API key placement, or anything deciding what may live in the client bundle vs server. Covers model pinning and key-secrecy rules.
---

# Supabase Edge Functions

## Read first

- `docs/06_API_KEYS_AND_ENV.md` — where every key lives
- `supabase/functions/analyze-pantry-photo/index.ts` — existing structure to follow
- `supabase/functions/_shared/cors.ts` — shared CORS helper

## Rules

**CORS preflight comes first**, and CORS headers appear on **error responses
too**, not just successes. Use `_shared/cors.ts`; an error without headers
leaves the web client with an opaque CORS failure instead of the real message.

**Third-party API keys live only in Edge Functions.** Never in the client
bundle, never in `EXPO_PUBLIC_*` variables (everything prefixed `EXPO_PUBLIC_`
ships to every device). Only `EXPO_PUBLIC_SUPABASE_URL` and
`EXPO_PUBLIC_SUPABASE_ANON_KEY` may be public.

**Gemini model pinning.** Pin the exact stable string `gemini-3.6-flash`.
Never emit `gemini-2.0-flash` (shut down) and never `gemini-flash-latest`
(hot-swaps on release and can silently change behavior).

**Structured outputs + Zod.** Parse model responses with a Zod schema; treat
model output as `unknown` at the boundary and narrow — never cast.

## Verify

```sh
npm run typecheck
```

If CORS or response-shape changed, exercise the function against the running
Supabase instance (`supabase functions serve`) from both an allowed origin and
a disallowed one before handoff.
