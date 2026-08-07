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
| 3 — App shell & photo pipeline                       | ⏳ Browser beta harness started; photo pipeline outstanding                   |
| 4 — Tier 2 (Spoonacular)                             | ⬜ Not started                                                                |

There is now a browser beta harness in `app/` for web testing. It exercises the
bundled catalog and the pure decision engine, but the full onboarding/photo
pipeline UI is still Milestone 3. Everything below the UI is built and tested.

What exists:

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
npm run web:beta      # static Expo web preview for browser testing

docker build -t homechef-beta .
docker run --rm -p 8081:8081 homechef-beta

pytest tools/                    # catalog pipeline tests
ruff check tools/                # lint
mypy --strict tools/catalog      # types

python -m tools.catalog          # rebuild src/data/*.json from TheMealDB
python -m tools.catalog --limit 20   # quick sample run
```

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
