# HomeChef — Technical Specification

**Company:** Application42
**Product:** HomeChef
**Version:** 1.2 · **Updated:** August 22, 2026

## 1. Product constraints

HomeChef is a photo-based decision engine, not a recipe search engine. It takes
time, equipment tier, pantry, allergens, and dietary restrictions and returns
at most 3-4 answers per bucket. Equipment, allergens, and dietary restrictions
are hard constraints; they never relax. Time and cuisine are soft constraints
and every relaxation is stated in the UI.

The August product includes onboarding, photo-to-pantry, pantry editing,
time-first decisions, recipe detail, cook mode, and feedback. Shopping lists,
barcode scanning, macro tracking, wake-word voice, and roommate-sharing UI are
out of scope.

## 2. Architecture

- Expo Router and React Native render the app; TanStack Query owns server state
  and Zustand owns client-only state.
- Supabase provides Auth, Postgres, RLS, Storage, Edge Functions, protected
  catalog releases, and authenticated catalog RPCs.
- `src/engine/` is pure and synchronous. It accepts `Recipe[]`, has no React,
  I/O, network, Supabase, or `src/lib/` dependency, and is the final
  hard-constraint check.
- Gemini `gemini-3.6-flash` is used only through `analyze-pantry-photo` for
  photo-to-pantry structured output. Use Zod at the boundary and never use
  `gemini-2.0-flash` or `gemini-flash-latest`.

## 3. Recipe catalog

HomeChef uses a rights-first, hosted-plus-offline catalog. Approved,
checksum-pinned bulk archives enter a source-neutral Python build pipeline.
The pipeline validates source rights and provenance, normalizes recipes and
ingredients, quarantines invalid records, deterministically deduplicates, and
builds a curated offline catalog. Python is build-time tooling, never a service.

An operator loads an inactive Supabase release and atomically activates it.
Catalog tables include releases, sources, ingredients, recipes, and ordered
recipe ingredients. Every table enables RLS in its creation migration. Clients
cannot write catalog tables; authenticated RPCs expose bounded candidates,
detail, and active attribution. Candidate requests clamp to 100 and prefilter
hard constraints.

The client renders offline candidates immediately, merges hosted candidates by
stable HomeChef ID when available, and silently retains offline candidates on
failure. No recipe-provider API, key, endpoint, quota, live fallback, or tier
semantic is part of the product.

### Transitional artifact

The existing provider-derived `src/data/*.json` bundle is transitional and
non-rebuildable from the retired API. Its attribution remains until an approved
replacement passes parity. Do not describe it as already removed. The current
artifact contains 812 recipes and 897 ingredients; 76 recipes are
`unclassified` and excluded until safely classified.

### Rights and attribution

Only sources marked `approved` in the rights manifest may enter a release.
The manifest records the version, checksum, license, provenance, and attribution
requirements. Attribution is served from the active release; it is not
hardcoded. Transitional attribution remains through the approved cutover.

## 4. Decision engine

The engine receives plain recipes after hosted/offline merging. It filters hard
constraints first, ranks compatible recipes against the pantry, assigns buckets,
and caps results at 3-4 per bucket. Unknown equipment, allergen, or dietary
status excludes a recipe rather than admitting it.

When the primary bucket is thin, the fixed recovery path expands time, drops
cuisine, promotes a compatible missing-ingredient bucket, then widens missing
ingredients. Every soft relaxation is visible. The engine never relaxes hard
constraints and the app never shows an empty results screen. A hosted failure
is a normal offline-fallback path, not an error surface.

## 5. Photo-to-pantry

The client compresses a pantry photo and sends it to the Edge Function. Gemini
returns structured candidate names, which the app validates and resolves against
the catalog ingredient vocabulary. The user confirms candidates before the
pantry changes. Low-confidence or unresolved candidates are never written
silently; this is how HomeChef limits pantry drift.

## 6. Privacy and security

Only `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` are public.
Secrets are kept in Supabase Edge Function configuration. CORS preflight comes
first and error responses include CORS headers. Pantry inventory belongs to a
household; preferences and allergens belong to a user. RLS is the enforcement
boundary, not client convention.

## 7. Quality gates

- Accessibility props are required on every interactive element; tokens supply
  all color and spacing.
- Source downloads, remote migrations, and hosted activation require explicit,
  target-specific authorization.
- Verification covers rights-manifest checks, deterministic build output,
  migration/RLS behavior, bounded RPC contracts, engine purity, hard constraints,
  output caps, offline fallback, attribution, and link/format checks.

## 8. Related documents

- [Owned catalog design](specs/2026-08-22-owned-recipe-catalog-design.md)
- [Owned catalog roadmap](plans/2026-08-22-owned-recipe-catalog-roadmap.md)
- [UI/UX specification](04_UIUX_SPEC.md)
- [API keys and environment](06_API_KEYS_AND_ENV.md)
