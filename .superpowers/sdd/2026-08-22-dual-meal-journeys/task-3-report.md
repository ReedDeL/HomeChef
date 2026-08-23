# Task 3 Report: Portion and Continuous-Onboarding Policy

## Status

Implemented and verified Task 3 only. The engine now produces optional portion guidance from the
frozen nutrition policy and selects or resolves at most one continuous-onboarding prompt per app
session.

## Implementation

- Added `getPortionGuidance()`, which requires `high` or `medium` nutrition confidence and finite,
  positive per-serving energy before returning guidance.
- Implemented the exact Mifflin–St Jeor sex offsets, five activity factors, three goal adjustments,
  three goal baselines, one-third target-meal conversion, satiety adjustments, quarter-serving
  rounding, and the `0.75..1.5` clamp.
- Kept `baseServings` out of the runtime calculation. It remains recipe metadata for build-time
  whole-recipe normalization only.
- Defensively treats underage or otherwise invalid profiles as energy-ineligible with the maintain
  fallback. Valid pregnant and breastfeeding profiles retain their goal fallback without using the
  energy calculation.
- Returns only `servings`, `label`, and the frozen disclaimer; it exposes no calorie, macro, trend,
  or medical fields. Low/unavailable nutrition or unusable energy returns `null` and does not affect
  recipe eligibility.
- Added `chooseContinuousOnboardingPrompt()`, which enforces safety, week-only preference, photo
  taste, body profile, then reminder priority and consumes no more than one session slot.
- Added `resolveContinuousOnboardingPrompt()`, which closes the active session prompt. Skip returns
  the durable progress object unchanged; answer creates a copy with only the selected completion
  field set to `true`. Neither path creates a taste signal.
- Extended shared engine test builders for body profiles, onboarding progress, and prompt state.
- Extended the purity suite to guarantee both policy modules are scanned and to reject additional
  ambient clock and randomness APIs.

## Public interfaces

```ts
getPortionGuidance(input: PortionGuidanceInput): PortionGuidance | null
chooseContinuousOnboardingPrompt(
  input: ChooseContinuousOnboardingPromptInput
): ContinuousOnboardingPrompt | null
resolveContinuousOnboardingPrompt(
  input: ResolveContinuousOnboardingPromptInput
): ContinuousOnboardingResolution
```

All three interfaces consume and return plain data. They perform no I/O, clock reads, randomness,
React work, or `src/lib/` calls.

## Files

Created:

- `src/engine/portion-guidance.ts`
- `src/engine/portion-guidance.test.ts`
- `src/engine/onboarding-prompt.ts`
- `src/engine/onboarding-prompt.test.ts`
- `.superpowers/sdd/2026-08-22-dual-meal-journeys/task-3-report.md`

Modified:

- `src/engine/__fixtures__.ts`
- `src/engine/purity.test.ts`

## TDD evidence

### Portion RED

Command:

```text
npm test -- src/engine/portion-guidance.test.ts
```

Relevant output:

```text
FAIL src/engine/portion-guidance.test.ts
Error: Cannot find module '@/engine/portion-guidance'
Test Files  1 failed (1)
```

### Portion GREEN

```text
npm test -- src/engine/portion-guidance.test.ts
Test Files  1 passed (1)
Tests  27 passed (27)
```

Self-review added male-offset, neutral missing-satiety, non-finite-profile, and medium-confidence
coverage. The final portion suite contains 31 tests.

### Continuous-onboarding RED

Command:

```text
npm test -- src/engine/onboarding-prompt.test.ts
```

Relevant output:

```text
FAIL src/engine/onboarding-prompt.test.ts
Error: Cannot find module '@/engine/onboarding-prompt'
Test Files  1 failed (1)
```

### Continuous-onboarding GREEN

```text
npm test -- src/engine/onboarding-prompt.test.ts
Test Files  1 passed (1)
Tests  17 passed (17)
```

### Focused policy and purity GREEN

```text
npm test -- src/engine/portion-guidance.test.ts \
  src/engine/onboarding-prompt.test.ts src/engine/purity.test.ts
Test Files  3 passed (3)
Tests  113 passed (113)
```

## Final verification

Command:

```text
npm run check
```

Result:

```text
eslint .                         PASS
tsc --noEmit                    PASS
Test Files  22 passed (22)
Tests       433 passed (433)
prettier --check .              All matched files use Prettier code style!
Exit code 0
```

The first full check stopped at TypeScript because a type-guard result stored separately from the
nullable `input.bodyProfile` property did not preserve narrowing. The implementation now narrows a
local profile value. `npm run typecheck` passed independently, followed by the authoritative fresh
full check above.

## Self-review

- Rechecked every Section 8 constant and formula against the governing design.
- Confirmed low/unavailable confidence and invalid energy suppress only portion guidance.
- Confirmed age 17, missing, and non-finite profiles use the maintain fallback; valid pregnancy and
  breastfeeding profiles never use energy-based guidance.
- Confirmed `baseServings` cannot influence runtime guidance and all output is quarter-rounded and
  clamped.
- Confirmed prompt selection is deterministic, week preference is never selected on the now
  journey, and a consumed session never selects another prompt.
- Confirmed skip preserves durable progress by value and identity, while answer does not mutate its
  input and changes only the active prompt's completion field.
- Confirmed the photo skip path exposes no taste signal and therefore remains neutral.
- Confirmed no shared contracts, design files, dependencies, database schema, UI, secrets, or
  external services changed.
- `git diff --check` passes.

## Concerns

None. The TypeScript narrowing issue found by the first full check is resolved and covered by the
fresh successful check.
