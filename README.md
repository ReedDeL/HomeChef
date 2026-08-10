# HomeChef

Photo-based meal decision engine. Application42. Launch: **Aug 24, 2026**.

Not a recipe search engine — a **decision engine**. It consumes constraints
(time, equipment, pantry, allergens) and emits 3–4 answers.

Full specs in [`docs/`](docs/). Architecture rules in [`CLAUDE.md`](CLAUDE.md).

---

## Status: Milestone 1 complete

| Milestone                                            | State                                                                         |
| ---------------------------------------------------- | ----------------------------------------------------------------------------- |
| **1 — DB-to-Engine binding**                         | ✅ Done                                                                       |
| 2 — Decision engine hardening + equipment enrichment | ⏳ Engine built and tested; LLM enrichment + 30-recipe spot-check outstanding |
| 3 — App shell & photo pipeline                       | ⏳ Screens built to spec; photo pipeline and cook mode outstanding            |
| 4 — Tier 2 (Spoonacular)                             | ⬜ Not started                                                                |

The browser beta harness is gone. `app/` now holds the real screens from
`docs/04_UIUX_SPEC.md` — onboarding, the time-first home screen, the four
result buckets, recipe detail, and the pantry — and the same code runs on iOS,
Android, and the web. The web build letterboxes that phone layout into a
430pt column rather than stretching it across a monitor, so the browser shows
what the device shows.

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
- `src/engine/` — the decision engine. Pure, synchronous, 136 tests.
- `src/lib/adapters/` — the only code that knows both Postgres and the engine.
- `src/lib/queries/` + `src/hooks/` — Supabase data access and TanStack Query hooks.
- `supabase/migrations/` — 6 tables, RLS on every one. **Applied to the live
  project**, not just committed.
- `supabase/tests/rls_verification.sql` — 19 assertions run as a real
  `authenticated` session. Two households, three accounts, one roommate.
- `src/types/supabase-generated.ts` — generated from the live schema.
- `tools/catalog/` — Python ETL. 128 tests, mypy strict.
- `tools/catalog/seed/` — 20 hand-curated microwave recipes, merged into the
  catalog at build time. Hand-written data cannot live in `src/data/`, which a
  rebuild overwrites wholesale.
- `src/data/` — **812 recipes, 897 ingredients**, generated and committed.
  736 are servable; 76 are `unclassified` and excluded until enrichment runs.

---

## Setup

```bash
npm install
cp .env.example .env      # then fill it in — see below
```

### 1. Supabase project (required)

You need to do this by hand; it cannot be scripted from here.

1. Create a project at [supabase.com](https://supabase.com).
2. Copy **Project URL** and the **anon / publishable** key from
   Project Settings → API into `.env`:

   ```
   EXPO_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   ```

3. Apply the schema:

   ```bash
   npx supabase link --project-ref <your-ref>
   npx supabase db push
   ```

4. Regenerate the row types so they match your live database:

   ```bash
   npx supabase gen types typescript --linked > src/types/supabase-generated.ts
   ```

   That file is generated — never edit it. `src/types/database.ts` derives the
   row aliases from it and adds back the two unions (`FeedbackVerdict`,
   `InventorySource`) that a CHECK constraint enforces but the generator can
   only see as `string`.

5. Verify RLS actually holds, with two accounts in two households plus a
   roommate sharing one:

   ```bash
   psql "$DATABASE_URL" -f supabase/tests/rls_verification.sql
   ```

The whole script is one transaction ending in `ROLLBACK`, so it writes
nothing and is safe to run against a live project. CI runs the same script
against a local Supabase stack on every push and pull request. If you want
to re-run it manually against a live project, keep using the same command.
It is the only check that runs as a real `authenticated` session, and it
already caught one total-outage bug that reading the migration did not (see
`0002_grant_membership_helper.sql`).

**Only those two variables may ever be public.** The anon key is safe to ship —
RLS is what protects the data, not the secrecy of that key.

### 2. Third-party API keys (required at Milestone 3)

These live **only** in Supabase secrets and are read **only** inside Edge
Functions. They must never appear in `.env`, the client bundle, or git.

```bash
npx supabase secrets set GEMINI_API_KEY=...        # photo → pantry
npx supabase secrets set SPOONACULAR_API_KEY=...   # Tier 2, Milestone 4
```

See [`docs/06_API_KEYS_AND_ENV.md`](docs/06_API_KEYS_AND_ENV.md).

### 3. Python tooling (only if rebuilding the catalog)

The catalog is already generated and committed, so most work needs none of this.

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
```

> On a machine without `python3-venv`, install into a local target instead:
> `pip3 install --target .pydeps -e ".[dev]"` and prefix commands with
> `PYTHONPATH=.pydeps:.`. `.pydeps/` is gitignored.

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

The Edge Function must be deployed before the scan screen works:

```bash
npx supabase functions deploy analyze-pantry-photo
```

`GEMINI_API_KEY` is already set on the project. The key is read only inside the
function and never reaches the client — see `docs/06_API_KEYS_AND_ENV.md`.

**This has never been called against live Gemini.** Smoke-test it once after
deploying, because the request shape is the one part unit tests cannot cover:

```bash
# A 1x1 JPEG is enough to prove the request shape and schema are accepted.
curl -s -X POST "$EXPO_PUBLIC_SUPABASE_URL/functions/v1/analyze-pantry-photo" \
  -H "Authorization: Bearer $EXPO_PUBLIC_SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"images":["/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q=="]}'
```

A `200` with `{"items":[...]}` (an empty array is fine for a blank image) means
the schema and model string are accepted. A `502` means the Gemini call was
rejected — check the function logs, which carry the upstream error.

### Android Docker testing

The Android test container uses Expo prebuild in a temporary directory, so it
does not leave generated `android/` files in the checkout. It first runs the
unit and TypeScript checks, then compiles a debug APK against Android API 36.

```bash
docker compose -f compose.android.yml run --rm --build android-build
```

The compiled APK is saved as `build/android-test/homechef-debug.apk`. For a
real launch check, Docker must be able to access KVM. On WSL, enable Docker
Desktop's WSL integration first, then run:

```bash
test -e /dev/kvm
docker compose -f compose.android.yml --profile emulator run --rm --build android-emulator
```

That headless smoke test boots an API 36 emulator, installs the debug APK,
launches it, verifies that its process remains running, and writes
`build/android-test/homechef-emulator.png`. If `/dev/kvm` is unavailable, use
the build command above; it still validates the native Android compilation.

---

## Architecture in one diagram

```
  Supabase Postgres          src/lib/ (I/O)           src/engine/ (PURE)
  ─────────────────          ──────────────           ──────────────────
  inventory ────────┐
  user_preferences ─┼──▶ TanStack Query ──▶ adapters ──┐
  meal_feedback ────┘      (src/hooks/)     (src/lib/   │
                                             adapters/) ├──▶ decide(...)
  src/data/recipes.json ──▶ static import ──────────────┤         │
  (Tier 1, 812, bundled)                                │         ▼
                                                        │   ScoredRecipe[]
  Spoonacular Edge Fn ────▶ fetch (Tier 2, ≤20) ────────┘   (4 buckets)
```

**`src/engine/` is pure.** No React, no I/O, no imports from `src/lib/`. It takes
a `Recipe[]` and cannot tell which tier supplied it. That is what makes the whole
suite run in ~2 seconds with no device, network, or API quota — and it is
enforced by ESLint plus `src/engine/purity.test.ts`, not by convention.

---

## Known gaps

- **The vocabulary carries singular and plural spellings as separate ids, and
  recipes use both.** `egg` appears in 121 recipes and `eggs` in 106; `carrot`
  in 1 and `carrots` in 85. A pantry holding one spelling silently fails to
  match every recipe written with the other, which is the exact set-difference
  break `tools/catalog/normalize.py` warns about in its own docstring. Eleven
  pairs are affected. `src/lib/ingredients/resolve.ts` collapses ten of them so
  the photo pipeline cannot make it worse (`clove`/`cloves` is left alone — the
  spice and the garlic unit are different things), but that only fixes the
  pantry side. **The real fix is to collapse plurals during catalog
  normalization and regenerate**, and until then recipe coverage is
  overstated.
- **Two synonyms point at ids the catalog never mints.** `capsicum` and
  `bell pepper` rewrite to `bell_pepper`, and `beef mince` to `ground_beef`;
  neither exists in `ingredients.json`. The resolver degrades to a flagged
  partial match rather than dead-ending, but the synonym table needs
  retargeting in `tools/catalog/normalize.py`.
- **The photo pipeline has not been run against live Gemini.** The Edge
  Function typechecks under Deno and its response contract is unit-tested, but
  it has never been deployed or called, so the request shape is unverified
  against the real API. See "Photo → pantry" below for the smoke test.

- **The app does not talk to Supabase yet.** Constraints and the pantry live in
  local storage on the device. The data layer for the server-backed version is
  built and tested (`src/lib/queries/`, `src/hooks/`), but nothing produces a
  `userId`, so every one of those hooks is inert. Anonymous sign-in was the
  intended way in and is **disabled** on the project — `/auth/v1/settings`
  reports `"anonymous_users": false`. Enabling it in the dashboard (Auth →
  Providers) is the unblocking step; the signup trigger in `0001` already
  creates the household, profile, membership, and preferences row, and every
  RLS policy targets `authenticated`, which anonymous users are.
- **Cook mode and the photo pipeline are not built.** "Start cooking" on the
  recipe screen is deliberately disabled rather than wired to a stub, and the
  first-photo prompt is omitted from the pantry-starter screen for the same
  reason — a dead button on the screen that teaches trust is worse than an
  absent one.
- **Allergen coverage is thin.** Only the allergen groups that exist in
  `src/data/ingredients.json` are offered, so the list is eight items and
  sesame is absent entirely. That is deliberate: an allergen the vocabulary
  cannot detect would tell the user they are protected when they are not. The
  groups themselves are sparse — `dairy` is on 8 ingredients out of 897 — so
  allergen filtering should not be considered trustworthy until the vocabulary
  is enriched.

- **76 of 812 recipes are `unclassified` and shown to nobody.** The keyword pass
  could not classify them. They used to fall back to `none`, which the equipment
  filter treats as always satisfied — so they were served to microwave-only users
  as though confirmed microwave-safe. `unclassified` is now a distinct value that
  never satisfies the filter: unknown excludes, it does not admit. The cost is
  that a full-kitchen user sees 736 recipes rather than 812. That number climbs
  back as the LLM enrichment pass and its **mandatory 30-recipe human spot-check**
  (Technical Spec §5.2 step 6) classify the backlog.
- **The microwave wedge rests on 20 hand-written recipes.** TheMealDB supplies
  exactly two microwave-only recipes and both are 240-minute fudge, which the
  relaxation ladder tops out below — so a microwave-only user got _zero_ results
  once the `none` fallback stopped propping the number up. `tools/catalog/seed/`
  fills that gap and is load-bearing, not decorative. It is a stopgap sized for
  an honest go/no-go, not a finished catalog.
- **`dietaryTags` is empty for every recipe, deliberately.** Dietary is a hard
  constraint, so a wrong tag ships a violation to the user. Absent beats wrong.
  A verified pass must populate it before dietary filtering is meaningful.
- **The catalog is 792 recipes, not the ~300 the spec assumed.** TheMealDB grew.
  Client-side ranking is still well under 10 ms, so no architecture changes.
- **The two-account RLS run is scripted but not yet executed end to end.**
  `supabase/tests/rls_verification.sql` holds 19 assertions and the blocking bug
  it was written to find is fixed and confirmed gone; the seeded run itself
  still needs one `psql -f` pass by a human before the privacy model can be
  called verified. Do not treat roommate privacy as proven until that is green.
