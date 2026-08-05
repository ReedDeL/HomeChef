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
| 3 — App shell & photo pipeline                       | ⬜ Not started                                                                |
| 4 — Tier 2 (Spoonacular)                             | ⬜ Not started                                                                |

**There is no UI yet.** `npm start` will fail — `app/` does not exist. That is
Milestone 3. Everything below the UI is built and tested.

What exists:

- `src/engine/` — the decision engine. Pure, synchronous, 136 tests.
- `src/lib/adapters/` — the only code that knows both Postgres and the engine.
- `src/lib/queries/` + `src/hooks/` — Supabase data access and TanStack Query hooks.
- `supabase/migrations/0001_initial_schema.sql` — 6 tables, RLS on every one.
- `tools/catalog/` — Python ETL. 104 tests, mypy strict.
- `src/data/` — **792 recipes, 897 ingredients**, generated and committed.

---

## Setup


## Architecture in one diagram

```
  Supabase Postgres          src/lib/ (I/O)           src/engine/ (PURE)
  ─────────────────          ──────────────           ──────────────────
  inventory ────────┐
  user_preferences ─┼──▶ TanStack Query ──▶ adapters ──┐
  meal_feedback ────┘      (src/hooks/)     (src/lib/   │
                                             adapters/) ├──▶ decide(...)
  src/data/recipes.json ──▶ static import ──────────────┤         │
  (Tier 1, 792, bundled)                                │         ▼
                                                        │   ScoredRecipe[]
  Spoonacular Edge Fn ────▶ fetch (Tier 2, ≤20) ────────┘   (4 buckets)
```

**`src/engine/` is pure.** No React, no I/O, no imports from `src/lib/`. It takes
a `Recipe[]` and cannot tell which tier supplied it. That is what makes the whole
suite run in ~2 seconds with no device, network, or API quota — and it is
enforced by ESLint plus `src/engine/purity.test.ts`, not by convention.

---

## Known gaps

- **Equipment tags are keyword-derived, not verified.** 76 of 792 recipes fell
  back to `none` because the keyword pass could not classify them — and `none`
  is what the microwave-only user sees. Those are unclassified, _not_ confirmed
  microwave-safe. The LLM enrichment pass and the **mandatory 30-recipe human
  spot-check** (Technical Spec §5.2 step 6) are what close this. Do not treat
  the microwave wedge as working until that runs.
- **`dietaryTags` is empty for every recipe, deliberately.** Dietary is a hard
  constraint, so a wrong tag ships a violation to the user. Absent beats wrong.
  A verified pass must populate it before dietary filtering is meaningful.
- **The catalog is 792 recipes, not the ~300 the spec assumed.** TheMealDB grew.
  Client-side ranking is still well under 10 ms, so no architecture changes.
- **`src/types/database.ts` is hand-written** to match the migration. Regenerate
  it with `supabase gen types` once the project exists.
