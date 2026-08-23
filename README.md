# HomeChef

**Stop scrolling. Start cooking.**

HomeChef turns a photo of your kitchen into a short, confident answer to
"what can I make right now?" — instead of another endless scroll through
recipes you can't cook, don't have the equipment for, or simply don't have
time for tonight.

Point your camera at your pantry, tell us how much time you have, and
HomeChef hands you 3–4 meals you can actually make — not a hundred
options to sort through yourself. Every suggestion respects your
equipment, your allergies, and your dietary needs, no exceptions.

**Launching August 24, 2026.**

**Current development version: 0.1.0.** Until the first public release, use 0.MINOR.PATCH: increment MINOR for material features or behavior changes, and PATCH for small fixes and documentation-only changes. The first launch release is 1.0.0.

### Why people will love it

- **A decision, not a search engine.** We do the filtering so you don't
  have to — a handful of great answers beats an infinite scroll.
- **Built around your actual kitchen.** No stovetop? No blender? HomeChef
  already knows, and it never suggests a dish you can't cook.
- **Safety you can trust.** Allergens and dietary needs are treated as
  hard limits, never a "close enough."
- **Made for real life.** Fifteen minutes before practice or a lazy Sunday
  afternoon — tell HomeChef how much time you have and get answers sized
  to fit.
- **Private by default.** Your pantry and preferences are yours alone,
  even when you share a kitchen with roommates.

---

## Developer documentation

Everything below this line is technical documentation for the engineering
team and contributors. Full specs live in [`docs/`](docs/); architecture
rules live in [`AGENTS.md`](AGENTS.md).

---

## Status: Milestone 1 complete

| Milestone                                            | State                                                                               |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------- |
| **1 — DB-to-Engine binding**                         | ✅ Done                                                                             |
| 2 — Decision engine hardening + equipment enrichment | ⏳ Engine built and tested; LLM enrichment + 30-recipe spot-check outstanding       |
| 3 — App shell & photo pipeline                       | ⏳ Screens, cook mode, and scan built; Edge Function unverified against live Gemini |
| 4 — Spoonacular expansion                            | ⬜ Not started                                                                      |

The browser beta harness is gone. `app/` now holds the real screens from
`docs/04_UIUX_SPEC.md` — onboarding, the time-first home screen, the four
result buckets, recipe detail, cook mode, and the pantry — and the same code
runs on iOS, Android, and the web. On the web it is a responsive workspace:
one column on a phone, a centred multi-column layout on a desktop, driven by
`src/components/ui/responsive-layout.ts`.

What exists:

- `app/` — the screens, as expo-router routes. `(onboarding)/` runs once,
  `(tabs)/` is the app, `recipe/[id]` is the detail view.
- `src/components/ui/` — the component set from the UI/UX spec. `IngredientChip`
  is deliberately the only way to render an ingredient anywhere in the app.
- `src/store/kitchen.ts` — client state (equipment, allergens, diet, pantry),
  persisted locally. **Not** wired to Supabase yet; see Known gaps.
- `src/lib/ingredients/` — free-text ingredient names → canonical ids. Pure, no
  React or Supabase imports, and kept in step with `tools/catalog/normalize.py`
  by a parity test.
- `supabase/functions/analyze-pantry-photo/` — photo → ingredient candidates via
  `gemini-3.6-flash`, structured output validated with Zod. Returns candidates;
  writes nothing.
- `src/engine/` — the decision engine. Pure, synchronous, 144 tests.
- `src/lib/adapters/` — the only code that knows both Postgres and the engine.
- `src/lib/queries/` — Supabase data access. TanStack Query hooks land with
  auth wiring (see Known gaps).
- `supabase/migrations/` — 6 tables, RLS on every one. **Applied to the live
  project**, not just committed.
- `supabase/tests/rls_verification.sql` — 19 assertions run as a real
  `authenticated` session. Two households, three accounts, one roommate.
- `src/types/supabase-generated.ts` — generated from the live schema.
- `tools/catalog/` — Python ETL. 170 tests, mypy strict.
- `tools/catalog/seed/` — 20 hand-curated microwave recipes, merged into the
  catalog at build time. Hand-written data cannot live in `src/data/`, which a
  rebuild overwrites wholesale.
- `src/data/` — **812 recipes, 897 ingredients**, generated and committed.
  736 are servable; 76 are `unclassified` and excluded until enrichment runs.

---

## Setup

`npm install`, copy `.env.example` to `.env`, and supply the public
Supabase URL and anon key. Link the Supabase project, push migrations, and
regenerate `src/types/supabase-generated.ts` when the schema changes.

Third-party keys belong only in Supabase secrets. Catalog tooling is optional
unless rebuilding `src/data/`. Complete setup, RLS verification, local Edge
Function instructions, and secret-handling rules live in
[docs/06_API_KEYS_AND_ENV.md](docs/06_API_KEYS_AND_ENV.md).

For the no-app-store launch, use the exact Cloudflare Pages build settings and
privacy checklist in [docs/07_WEB_LAUNCH.md](docs/07_WEB_LAUNCH.md).

---

## Commands

```bash
npm test              # Vitest — engine, adapters, catalog contract
npm run typecheck     # tsc --noEmit
npm run lint          # eslint
npm run format        # prettier --write
npm run web:beta      # static Expo web export, served at localhost:8081

docker build -t homechef-beta .
docker run --rm -p 8081:8081 homechef-beta

pytest tools/                    # catalog pipeline tests
ruff check tools/                # lint
mypy --strict tools/catalog      # types

python -m tools.catalog          # rebuild src/data/*.json from TheMealDB
python -m tools.catalog --limit 20   # quick sample run
```

### Photo → pantry

Deploy `analyze-pantry-photo` before testing scan. Its request and response
contracts are covered by tests; after deployment, perform one synthetic-image
smoke test against live Gemini and inspect function logs for upstream failures.
Never use a real pantry photo for infrastructure verification.

### Android Docker testing

`docker compose -f compose.android.yml run --rm --build android-build`
runs checks and compiles a debug APK into `build/android-test/`. The optional
emulator profile additionally requires KVM and Docker Desktop WSL integration.

---

## Architecture in one diagram

```
  Supabase Postgres          src/lib/ (I/O)           src/engine/ (PURE)
  ─────────────────          ──────────────           ──────────────────
  inventory ────────┐
  user_preferences ─┼──▶ TanStack Query ──▶ adapters ──┐
  meal_feedback ────┘    (query hooks*)    (src/lib/   │
                                             adapters/) ├──▶ decide(...)
  src/data/recipes.json ──▶ static import ──────────────┤         │
  (bundled catalog, 812)                                │         ▼
                                                        │   ScoredRecipe[]
  Spoonacular Edge Fn ────▶ fetch (optional, ≤20) ────────┘   (4 buckets)
```

\* Query hooks land with auth wiring — see Known gaps.

**`src/engine/` is pure.** No React, no I/O, no imports from `src/lib/`. It takes
a `Recipe[]` and cannot tell which tier supplied it. That is what makes the whole
suite run in ~2 seconds with no device, network, or API quota — and it is
enforced by ESLint plus `src/engine/purity.test.ts`, not by convention.

---

## Known gaps

> Each gap is stated once here and explained where it is enforced. Where a
> bullet names a file, that file is the reference — do not restate its
> reasoning in this list.

- **Singular and plural spellings are separate ids, and recipes use both.**
  Eleven pairs affected (`egg`/`eggs`, `carrot`/`carrots`, …).
  `src/lib/ingredients/resolve.ts` collapses ten on the pantry side so the
  photo pipeline cannot worsen it; the real fix is collapsing plurals during
  catalog normalization and regenerating. Until then recipe coverage is
  overstated. Reasoning: `src/lib/ingredients/normalize.ts` and
  `resolve.test.ts`.
- **Two synonyms point at ids the catalog never mints.** `capsicum` and
  `bell pepper` rewrite to `bell_pepper`, and `beef mince` to `ground_beef`;
  neither exists in `ingredients.json`. The resolver degrades to a flagged
  partial match rather than dead-ending, but the synonym table needs
  retargeting in `tools/catalog/normalize.py`.
- **The photo pipeline has not been run against live Gemini.** The Edge
  Function targets the Interactions API, typechecks under Deno, and its
  response contract is unit-tested, but it has never been deployed or called,
  so the request shape is unverified against the real API. See
  "Photo → pantry" below for the smoke test.
- **Voice and cook-mode keep-awake are deferred post-launch (Aug 22
  decision).** No mic button ships in cook mode and the screen is allowed to
  sleep. Tap-to-listen via `@react-native-voice/voice` and `expo-keep-awake`
  arrive together in the voice release; reasoning: Technical Spec §2.5,
  UI/UX Spec §7.

- **The app does not talk to Supabase yet.** Constraints and the pantry live in
  local storage on the device. The data layer is built and tested
  (`src/lib/queries/`), but nothing produces a `userId`, so none of it is
  reachable from a screen yet. Federated Google sign-in is the unblocking step
  and is in flight — Technical Spec §2.2.1,
  `docs/specs/2026-08-12-google-oauth-android-web-design.md`. The signup
  trigger in `0001` already creates the household, profile, membership, and
  preferences row.
- **Allergen coverage is thin.** Only the allergen groups that exist in
  `src/data/ingredients.json` are offered, so the list is eight items and
  sesame is absent entirely. That is deliberate: an allergen the vocabulary
  cannot detect would tell the user they are protected when they are not. The
  groups themselves are sparse — `dairy` is on 8 ingredients out of 897 — so
  allergen filtering should not be considered trustworthy until the vocabulary
  is enriched.

- **76 of 812 recipes are `unclassified` and shown to nobody.** The keyword
  pass could not classify them, and unknown excludes rather than admits, so a
  full-kitchen user sees 736. That number climbs back as the LLM enrichment
  pass and its **mandatory 30-recipe human spot-check** (Technical Spec §5.2
  step 6) work the backlog. Reasoning: `src/engine/filter-hard.ts` and
  `docs/specs/2026-08-06-microwave-seed-catalog-design.md`.
- **The microwave wedge rests on 20 hand-written recipes.** TheMealDB supplies
  exactly two microwave-only recipes and both are 240-minute fudge, which the
  relaxation ladder tops out below — so a microwave-only user got _zero_ results
  once the `none` fallback stopped propping the number up. `tools/catalog/seed/`
  fills that gap and is load-bearing, not decorative. It is a stopgap sized for
  an honest go/no-go, not a finished catalog.
- **`dietaryTags` is empty for every recipe, deliberately.** Dietary is a hard
  constraint, so a wrong tag ships a violation to the user. Absent beats wrong.
  A verified pass must populate it before dietary filtering is meaningful.
- **The catalog is 812 recipes, not the ~300 the spec assumed** — 792 from
  TheMealDB plus 20 seed. TheMealDB grew. Client-side ranking is still well
  under 10 ms, so no architecture changes.
