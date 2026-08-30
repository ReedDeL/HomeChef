# Task 4 Report: Seven-Day Planner and Grocery Needs

## Status

Implemented Task 4 only. The pure engine now produces one deterministic seven-entry draft from
seven supplied consecutive local dates and derives a bounded, plan-linked grocery union without
silently truncating missing ingredients.

## Implementation

- Added `planWeek()`, `PlanWeekInput`, `DailyPlanPreference`, and the exact selected-time ladder.
- Validates exactly seven consecutive dates, integer limits from `1..120`, and strict
  `HH:mm:ss±HH:mm` daily meal times before selection. Concrete timestamps are constructed only
  from those supplied values and validated through the shared entry schema.
- Reuses the existing equipment, allergen, dietary, and scoring modules. Disliked, malformed
  zero-ingredient, and Tier 2 recipes are also excluded from durable concrete entries.
- Searches exact cuisine across every permitted time tier before retrying the same tiers without
  cuisine. Greater time and dropped cuisine are stated on each entry and summarized on the plan.
- Ranks lexicographically by pantry bucket, existing score, positive selected-photo signal,
  unused-recipe preference, and stable recipe ID.
- Added `derivePlanLinkedGroceryNeeds()`, which excludes pantry items, deduplicates canonical IDs,
  aggregates unique sorted recipe/date references, and rejects an overflowing union.
- Checks each ranked candidate against the cumulative 12-need union before selection and tries the
  next candidate. It distinguishes `grocery_need_cap` from `no_safe_recipe` without truncation.
- Reuses `getPortionGuidance()`. Low-confidence nutrition retains the concrete meal with null
  guidance.
- Updated the shared fixture to a realizable canonical planner result: seven bundled concrete
  recipes, no relaxations, no missing groceries, and a neutral taste signal outside the catalog.

## Files

Created:

- `src/engine/plan-week.ts`
- `src/engine/plan-week.test.ts`
- `src/engine/plan-grocery-needs.ts`
- `src/engine/plan-grocery-needs.test.ts`
- `.superpowers/sdd/2026-08-22-dual-meal-journeys/task-4-report.md`

Modified:

- `src/engine/types.ts`
- `src/engine/__fixtures__.ts`
- `src/contracts/meal-journeys.test.ts`
- `shared/fixtures/dual-meal-journeys.json`

## TDD Evidence

### Grocery RED

```text
npm test -- src/engine/plan-grocery-needs.test.ts
FAIL src/engine/plan-grocery-needs.test.ts
Error: Cannot find module '@/engine/plan-grocery-needs'
Test Files  1 failed (1)
```

### Grocery GREEN

```text
npm test -- src/engine/plan-grocery-needs.test.ts
Test Files  1 passed (1)
Tests       8 passed (8)
```

### Planner RED

```text
npm test -- src/engine/plan-week.test.ts
FAIL src/engine/plan-week.test.ts
Error: Cannot find module '@/engine/plan-week'
Test Files  1 failed (1)
```

### Planner GREEN

```text
npm test -- src/engine/plan-week.test.ts src/engine/plan-grocery-needs.test.ts
Test Files  2 passed (2)
Tests       41 passed (41)
```

### Focused Policy and Purity GREEN

```text
npm test -- src/engine/plan-week.test.ts src/engine/plan-grocery-needs.test.ts \
  src/engine/filter-hard.test.ts src/engine/purity.test.ts
Test Files  4 passed (4)
Tests       142 passed (142)
```

The first full check passed lint and typecheck, then exposed one fixture-coupled semantic-negative
test: the new valid fixture intentionally has no grocery needs, so conditionally cloning its first
need produced no invalid mutation. The contract test now constructs its own invalid
`day_of_decision` date and duplicate grocery needs. Its focused suite passes 40 tests.

## Final Verification

```text
npm run check
eslint .                         PASS
tsc --noEmit                    PASS
Test Files  24 passed (24)
Tests       493 passed (493)
prettier --check .              All matched files use Prettier code style!
Exit code 0
```

An earlier full check reached the formatting gate after lint, typecheck, and all tests passed, but
found the concurrently created ignored Task 5 brief unformatted. The coordinator mechanically
formatted that unrelated brief; the authoritative fresh full check above then passed with exit 0.

## Self-Review

- Rechecked every Section 7 selection stage and ranking key in order.
- Confirmed every daily input is validated before catalog selection begins.
- Confirmed no equipment, allergen, or dietary constraint changes while time/cuisine relax.
- Confirmed only Tier 1 recipe IDs can appear in the durable output.
- Confirmed the grocery union is recomputed for each tentative candidate and every accepted
  missing canonical ingredient remains represented in the final needs.
- Confirmed positive taste is never an elimination rule or a score override, while absence of a
  signal remains neutral.
- Confirmed the planner and grocery helper contain no I/O, React, `src/lib/`, clock, timezone
  lookup, randomness, mutation of caller data, or `any`.
- Confirmed the returned value parses through the exact shared weekly-plan contract.
- `git diff --check` passes.

## Concerns

None.
