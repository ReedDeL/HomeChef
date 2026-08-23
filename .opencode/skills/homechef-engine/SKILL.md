---
name: homechef-engine
description: Use when working in src/engine/ or on the decision engine — bucket, decide, filter-hard, relax, score-recipe, recipe scoring/ranking, relaxation tests, or anything that turns a Recipe[] plus pantry and preferences into meal answers. Covers purity invariants, hard-constraint rules, and engine test conventions.
---

# HomeChef decision engine (src/engine/)

## Read first

- `docs/01_TECHNICAL_SPEC.md` — decision engine section (buckets, relaxation ladder, §4.2 Tier 2 escalation)
- `src/engine/purity.test.ts` — the enforced definition of "pure"
- `src/engine/__fixtures__.ts` — shared test recipes; extend this instead of inventing inline fixtures

## Invariants to defend

**Purity.** `src/engine/` is PURE: no React, no imports from `src/lib/`, no
Supabase/TanStack/Zustand/Expo imports, no `fetch`, no clock (`Date.now`,
`new Date`), no `Math.random`, no `process.env`. It is a deterministic
function of its arguments. `purity.test.ts` asserts this per-file and ESLint
enforces it in CI — never weaken those checks to fit a change; move the
impurity out to a caller (see how `shouldEscalateTier2` is decided by the
caller, not the engine).

**Tier blindness.** The engine takes a `Recipe[]` and does not know or care
whether entries came from the bundled Tier 1 catalog or a Spoonacular Tier 2
session. No tier fields, no tier branches inside the engine.

**Hard constraints are never relaxed.** Equipment, allergens, and dietary
filters (`filter-hard.ts`) have no bypass path. Only soft constraints (time,
cuisine) relax via `relax.ts`, one step at a time in its fixed order:
time tier → drop cuisine → report Tier 2 escalation → surface
`missing_few` → widen to `missing_some`.

**Relaxation is a first-class code path with tests, not an error state.**
Every concession must be reported (the `Relaxation` data on the result) so
the UI can state it aloud. Silent filter changes are forbidden. Never allow
an empty results screen.

## Conventions

- One concern per file: `bucket.ts`, `decide.ts`, `filter-hard.ts`, `relax.ts`,
  `score-recipe.ts`. Tests sit beside sources as `<name>.test.ts`.
- Constants like `TIME_TIERS` and `TARGET_READY_COUNT` live exported from
  `relax.ts`; reuse them in tests rather than restating magic numbers.
- No comments describing what code says; comments carry spec references and
  reasoning only.

## Verify

```sh
npx vitest run src/engine   # fast loop while iterating
npm run check               # lint + typecheck + tests + format before handoff
```
