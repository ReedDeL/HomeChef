# Photo → pantry (MVP)

**Date:** 2026-08-07
**Status:** Implemented — `app/scan.tsx`, `src/lib/pantry-photo.ts`,
`supabase/functions/analyze-pantry-photo/`
**Milestone:** MVP core loop (B2 — "I take a photo of my fridge and it knows
what I have")

## Problem

`docs/01_TECHNICAL_SPEC.md` §5.1 specifies photo → pantry as in-scope for the
Aug 24 MVP. It does not exist. `src/components/BetaDashboard.tsx` — the only
running surface today — is an explicit stopgap: it operates on an in-memory
`Set<string>` of ingredient IDs and its own copy says "Photos, Supabase, and
voice are not wired here yet."

Nothing downstream of a photo exists either:

- No `supabase/functions/` directory — no Edge Function of any kind.
- No auth anywhere in the client. `src/lib/supabase.ts` throws **at import
  time** if `EXPO_PUBLIC_SUPABASE_URL`/`..._ANON_KEY` are unset, which is
  exactly why the beta harness works today — nothing imports it yet.
- `enable_anonymous_sign_ins = false` in `supabase/config.toml`.
- `expo-camera`, `expo-image-picker`, `expo-image-manipulator` are installed
  and unused.

`inventory` is already household-scoped with RLS (migration `0001`), and
`private.handle_new_user()` provisions a household + profile + membership +
empty preferences row on **any** insert into `auth.users`, including an
anonymous one. That existing trigger is what makes "Supabase inventory as
source of truth, no separate durable local pantry" cheap to build now instead
of after real auth ships.

## Goals

1. A user can photograph 1–10 shots of a fridge/pantry and get back detected
   ingredients with confidence scores, per §5.1.
2. Nothing is written to `inventory` until the user confirms it on-screen.
   Confirmed items upsert to Supabase — Supabase is the single source of
   truth; TanStack Query is a cache, never a second durable store.
3. The Gemini key never reaches the client, and the Edge Function rejects
   calls that don't come from our app or site (Technical Constraint, "Protect
   our API key... only allow it to run on our website or app").
4. The write path (client → `inventory` upsert) is behind a feature flag so
   detection can ship and be tested in the web beta before the write path is
   trusted in production.
5. `src/engine/` remains untouched — it already consumes `Recipe[]` and does
   not know where ingredients came from.

## Non-goals

- Real email/password auth. Out of scope here; tracked separately. This
  design uses **anonymous sign-in** to obtain a JWT (see Decisions).
- Manual pantry entry UI beyond what's needed to wire the confirmation sheet
  to the same upsert path. (`AddInventoryItem`/`upsertInventoryItem` already
  exist in `src/lib/queries/inventory.ts` and are reused, not rebuilt.)
- Spoonacular / Tier 2 — unrelated to this pipeline.
- Voice, cook mode, shopping list — unrelated, explicitly out of scope per
  AGENTS.md.
- A distilled on-device model (§2.4 "Phase 3 option") — cloud VLM only.

## Decisions

### 1. Detection is read-only; confirmation and the write are client-side

The Edge Function detects and returns; it never writes to Postgres. This is a
deliberate departure from the literal §5.1 sequence diagram (which shows the
Edge Function upserting before the confirmation sheet renders) because the
same section's prose is unambiguous: *"Never write low-confidence items
silently... the confirmation sheet is what keeps a bad VLM read from
poisoning the pantry."* An Edge Function that already wrote the row before the
user sees the sheet contradicts its own spec. Confirmation must happen before
any write, which means the write can't happen inside the detection call.

```
Camera / picker (≤10 shots)
   ↓  compress 640×640, JPEG q≈0.7 client-side (expo-image-manipulator)
Edge Function: analyze-pantry-photo
   ↓  origin allowlist → verify JWT → per-user quota → payload limits
Gemini 3.6 Flash, structured output (schema in docs/01 §2.4)
   ↓  Zod validate → normalize free text to canonical ingredient IDs
Response: { items: DetectedItem[], unmatched: string[] }
   ↓
Confirmation sheet — local component state only, nothing durable yet
   ↓ user confirms/edits/removes
[PHOTO_PANTRY_WRITE_ENABLED=true ] → upsertInventoryItems() batch, source='photo'
                                       → invalidate queryKeys.inventory(householdId)
[PHOTO_PANTRY_WRITE_ENABLED=false] → session-only state, banner explains it isn't saved
```

No separate local pantry store is introduced. `useInventory(householdId)`
(already in `src/hooks/useHomeChefData.ts`) is the only read path, and it's
already backed by TanStack Query against `inventory`.

### 2. Feature flag

`PHOTO_PANTRY_WRITE_ENABLED` — a plain module-level boolean constant in
`src/lib/featureFlags.ts` (not `EXPO_PUBLIC_*`; it doesn't need to be public
or remote-configurable for MVP, and a compile-time constant is the simplest
thing that lets code review see exactly what ships). Detection, compression,
Gemini call, confirmation sheet, and the whole Edge Function ship and are
fully testable regardless of the flag. Flipping it on is a one-line, one-PR
change once the write path has been exercised against a real Supabase
project.

### 3. Auth: anonymous sign-in, not a new auth system

`supabase-js`'s `auth.signInAnonymously()`, called once at app startup if no
session exists (`src/lib/auth/session.ts`). This is the minimum that
satisfies three separate requirements at once:

- The Edge Function's JWT check needs *some* project-issued token to verify.
- RLS on `inventory` requires `to authenticated` — anonymous Supabase sessions
  are `authenticated`, just with `is_anonymous: true` in the JWT, so the
  existing `inventory_member_insert`/`_update` policies need no change.
- `private.handle_new_user()` already provisions household/profile/membership
  for any `auth.users` insert, so an anonymous user gets a working household
  for free — no bootstrap code to write.

Requires flipping `enable_anonymous_sign_ins = true` in `supabase/config.toml`
and on the hosted project.

**Accepted trade-off:** someone could mint unlimited anonymous users to reset
the per-user photo-scan quota (Decision 4). Two things bound this, neither of
them airtight: Supabase's own `anonymous_users = 30`/hour/IP rate limit
(`config.toml`, already set), and the Origin allowlist (Decision 5), which
together mean the attack needs a script hitting our origin from many IPs, not
a single curl command with a leaked URL. Closing this properly needs real
auth and is out of scope here. Documented so it isn't rediscovered as a
surprise.

### 4. Per-user quota, not global

New table `photo_scan_quota` (migration `0004`), RLS enabled in the same
migration, one row per `user_id`, incremented by a `SECURITY DEFINER`
function `private.consume_photo_scan_quota(max_per_day integer)` keyed on
`(select auth.uid())` — the same pattern `private.is_household_member`
already establishes in `0001`. The Edge Function calls this function (via the
caller's own JWT — no `service_role` involved, consistent with
`docs/06_API_KEYS_AND_ENV.md`'s "we have no use for it in this project") and
returns 429 if it's exhausted. This is what stops a single stolen JWT from
burning through Gemini's free tier alone; the Origin allowlist and JWT check
(Decision 5) are what stop a JWT from being usable outside our app/site at
all.

### 5. Caller verification — four layers

| Layer | Mechanism | Stops |
|---|---|---|
| Key location | `Deno.env.get("GEMINI_API_KEY")`, Supabase secret, never `EXPO_PUBLIC_*` | Key extraction from the app bundle or web build |
| `verify_jwt` | Set for `analyze-pantry-photo` (Supabase per-function config) | Callers with no project-issued token at all |
| `supabase.auth.getUser()` inside the function, built from the caller's `Authorization` header | Forged/expired tokens; yields the real `sub` used for the quota check |
| Origin allowlist | Exact string match against an `ALLOWED_ORIGINS` secret (comma-separated); `Vary: Origin`; **never** `Access-Control-Allow-Origin: *`; native apps send no `Origin` header, which is allowed through but still has to clear the JWT check above | Other websites calling from a browser context |

No layer alone is sufficient — CORS alone is a no-op against `curl`, since
`Origin` is just a header the caller controls. The combination is: you need a
token our project issued (JWT), and if you're a browser you need to be
running on our origin (CORS), and either way you're rate-limited per-user
(quota). This matches `docs/06_API_KEYS_AND_ENV.md` §0's rule precisely — the
Edge Function is the only thing that ever calls Google, and it now also
gatekeeps who may ask it to.

### 6. Payload limits, checked before Gemini is called

- Max 10 images per request (matches §5.1's "1–10 images").
- Max 1.5 MB per image after client-side compression (640×640 target leaves
  generous headroom over this; a request over the cap is a client bug or
  abuse, not a real capture).
- Allowlisted `image/jpeg` only — matches what the client actually produces.
- Violations return 400 before any Gemini call, so a garbage/oversized
  request never costs quota or money.

### 7. Structured output and normalization

The Zod schema mirrors the OpenAPI schema in §2.4 exactly (`name`,
`quantity`, `unit` enum, `confidence`), validated on the Edge Function before
anything is normalized, per §2.4's explicit instruction that "the schema
guarantee is strong but it is not a substitute for a boundary check."

Normalization (`_shared/normalize.ts`, pure, unit-tested, no Deno globals) is
where free-text names become canonical ingredient IDs — exact match first,
then fuzzy match against the bundled vocabulary, then unmatched. §5.1's own
example (scallion / green onion / spring onion must collapse to one ID) is
the acceptance test for this function. Anything left unmatched is returned
in a separate `unmatched` array and shown to the user distinctly on the
confirmation sheet rather than silently dropped or silently invented as a new
ID — inventing one would create exactly the permanent vocabulary duplicate
`docs/specs/2026-08-06-microwave-seed-catalog-design.md` was
careful to avoid on the catalog side.

Items with `confidence < 0.7` are flagged "Not sure about this one" on the
sheet per §5.1/§4 UIUX spec, never silently written — true regardless of the
feature flag, since even flag-off session state shouldn't misrepresent
confidence to the user.

### 8. Vocabulary sync

Deno (the Edge Function runtime) cannot import from `src/data/` at deploy
time. `scripts/sync-vocabulary.mjs` copies `src/data/ingredients.json` to
`supabase/functions/_shared/ingredients.generated.json` verbatim. A vitest
test (`vocabulary-sync.test.ts`) asserts the two files are byte-identical, so
drift is a red CI run rather than a silently stale matcher. This script runs
as part of `npm run check` alongside the existing format check, and must be
re-run whenever `tools/catalog` regenerates `ingredients.json`.

### 9. `src/lib/supabase.ts` becomes lazy

Currently this module throws at **import time** if env vars are missing,
which is exactly why `BetaDashboard` works today — it never imports it.
`app/pantry/photo.tsx` (or anything importing `src/lib/auth/session.ts`) has
to import it. Left as-is, the first `npm run web:beta` without a `.env` white-
screens instead of showing a disabled photo button.

Fix: export `isSupabaseConfigured: boolean`, and defer client construction
behind a lazy getter that throws on first *use*, not on import. The existing
loud-failure behavior for real usage is preserved unchanged; only the module
load moment changes. `PhotoCapture` checks `isSupabaseConfigured` and renders
a disabled button with a reason ("Supabase not configured") instead of
importing something that blows up the whole bundle.

### 10. Google Interactions API — verify before writing

§2.4 specifies Google's **Interactions API** (GA, recommended over the older
endpoint) as the call surface, with the exact request/response shape for
structured output. That wire format is not something to guess at from
memory — a plausible-but-wrong request shape is a silent 400 at demo time,
not a compile error. Before writing `_shared/gemini.ts`, the implementer
verifies the endpoint path, auth header, and `responseSchema` field names
against Google's current documentation. `_shared/gemini.ts` is the *only*
file where the wire format appears, specifically so a correction later stays
contained to one file.

## Architecture

```
supabase/
├── functions/
│   ├── _shared/
│   │   ├── cors.ts                       # origin allowlist, headers on every response
│   │   ├── gemini.ts                     # ONLY place the Interactions API shape appears
│   │   ├── schema.ts                     # OpenAPI schema (sent to Gemini) + Zod mirror
│   │   ├── normalize.ts                  # pure: free text -> canonical ingredient ID
│   │   └── ingredients.generated.json    # synced copy, see Decision 8
│   └── analyze-pantry-photo/
│       └── index.ts                      # orchestration: CORS -> auth -> quota -> limits -> call
└── migrations/
    └── 0004_photo_scan_quota.sql         # table + RLS + SECURITY DEFINER quota fn, one migration

src/
├── lib/
│   ├── featureFlags.ts                   # PHOTO_PANTRY_WRITE_ENABLED
│   ├── auth/session.ts                   # ensureAnonymousSession()
│   ├── photo/
│   │   ├── compress.ts                   # expo-image-manipulator wrapper
│   │   ├── resize-target.ts              # pure: dimensions -> target size (tested)
│   │   └── analyze.ts                    # supabase.functions.invoke('analyze-pantry-photo', ...)
│   └── queries/
│       └── inventory.ts                  # + upsertInventoryItems (batch), reuses existing upsert shape
├── hooks/
│   └── usePantryPhoto.ts                 # detect mutation + confirm/commit mutation
├── components/
│   ├── PhotoCapture.tsx                  # camera/picker entry, disabled state if !isSupabaseConfigured
│   └── DetectionConfirmSheet.tsx         # reuses IngredientChip; low-confidence flagged distinctly
└── app/
    └── pantry/
        └── photo.tsx                     # expo-router route, default export

scripts/
└── sync-vocabulary.mjs                   # src/data/ingredients.json -> _shared copy
```

`src/engine/` is not touched — it already takes `Recipe[]` regardless of
provenance.

## Error handling

- No network at capture time → client shows "Photo capture needs a
  connection" and offers the existing manual-add path; never a hang.
- Gemini call fails or times out → Edge Function returns a typed error the
  client renders as "Couldn't read that photo, try again or add manually" —
  never a raw stack trace, matching the existing `503`-on-missing-key pattern
  in `docs/06_API_KEYS_AND_ENV.md` §3.
- Quota exhausted → 429 with a clear client message; manual add remains fully
  functional (per §2.4's accepted tradeoff: "manual pantry entry is a
  complete fallback").
- Zod validation fails on Gemini's response → treated the same as a Gemini
  failure, logged server-side with no key/payload echoed into the log line
  (`docs/06_API_KEYS_AND_ENV.md`'s "never echo a key into an error response
  or a log line" extended to full payloads on principle).
- Origin/JWT rejected → 403, generic body, no hint about which check failed
  (don't help an attacker enumerate the gate).

## Testing

### Pure functions (vitest)

- `normalize.ts`: exact ID match, display-name match, the scallion/green
  onion/spring onion synonym case, unmatched passthrough, empty input.
- `schema.ts` (Zod mirror): accepts a valid Gemini payload, rejects missing
  fields, rejects out-of-range confidence, rejects an unlisted unit.
- `cors.ts` origin matching: exact allowlist match passes; a suffix/prefix
  variant (`evil-homechef.com`, `homechef.com.evil.com`) is rejected; no
  `Origin` header (native app) passes through to the JWT check.
- `resize-target.ts`: various source dimensions all resolve to ≤640×640.
- `vocabulary-sync.test.ts`: `_shared/ingredients.generated.json` is
  byte-identical to `src/data/ingredients.json`.

### Integration (manual, documented in the spec — no live Gemini calls in CI)

`supabase functions serve --env-file supabase/.env.local`, exercised against
a real (dev-project) `GEMINI_API_KEY` for: a clean fridge photo, a cluttered
one, a non-food photo (expect empty `items`, non-empty rejection reasoning
not surfaced to the user), and a >10-image request (expect 400).

### Client

- `usePantryPhoto`: confirming an item with the flag off updates local
  session state only, no `inventory` mutation fires.
- `usePantryPhoto`: confirming with the flag on calls
  `upsertInventoryItem`/batch and invalidates `queryKeys.inventory`.
- `DetectionConfirmSheet`: items under 0.7 confidence render the "Not sure
  about this one" marker; items at/above do not.
- `PhotoCapture`: renders disabled with a reason when
  `isSupabaseConfigured === false`; the rest of `BetaDashboard` still mounts
  (regression guard for Decision 9).

## Risks

| Risk | Mitigation |
|---|---|
| Anonymous sign-in used to reset per-user quota | Supabase's `anonymous_users` per-IP rate limit + Origin allowlist bound it; real auth closes it properly later (documented, not solved here) |
| Google Interactions API shape misremembered | Verified against live docs before writing `gemini.ts`; wire format isolated to one file (Decision 10) |
| Vocabulary drift between `src/data/` and the Edge Function's copy | `sync-vocabulary.mjs` + byte-identical test in CI |
| Flag-off path looks "done" but silently never persists | Confirmation sheet shows an explicit "not saved yet" banner when the flag is off, so this is visible, not silent |
| `src/lib/supabase.ts` laziness fix regresses the loud-failure guarantee | Test asserts `isSupabaseConfigured === false` still surfaces a clear reason at the point of use |

## Open items

None. Write-path sequencing, flag mechanism, auth approach, quota model, and
caller-verification layers are all decided per the user's explicit direction
in this session.
