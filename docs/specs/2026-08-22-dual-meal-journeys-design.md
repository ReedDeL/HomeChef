# HomeChef Dual Meal Journeys Governing Design

**Date:** 2026-08-22

**Status:** Approved and governing for implementation

**Release:** 1.0.0 on 2026-08-24

## 1. Authority and supersession

This document is the acceptance contract for the dual meal journeys. Tasks 2–9 in
`docs/superpowers/plans/2026-08-22-dual-meal-journeys.md` must implement this document.
When an older product, technical, UI, weekly-planning, notification, or satiety document
conflicts with this one, this document wins.

In particular, this design supersedes the weekly scope in
`docs/specs/2026-08-13-weekly-meal-prep-design.md` that depended on:

- household-owned grocery events or weekly forecasts;
- learned recurring-grocery history, expected ingredients, or forecast confirmation;
- grocery-specific photo capture or manual grocery-entry flows;
- larger cooks, leftover scheduling, or a reusable per-weekday cooking rhythm;
- calendar-style editing and automatic weekly replanning; or
- a reusable or general-purpose shopping feature.

The shared household pantry remains in scope. A personal weekly plan may read the shared
pantry as an input, but the plan and everything derived only for that plan are personal.
Nothing in this design changes household pantry ownership.

This design also supersedes older scope exclusions only as narrowly as necessary to add a
personal seven-day plan and optional portion estimates. It does not add calorie or macro
tracking, a nutrition dashboard, weight history, roommate planning, or a general list.

## 2. Product decision

Home is a chooser for two distinct decisions:

1. Make a meal now from the saved pantry, optionally refreshing pantry drift with photos.
2. Generate one seven-day plan and the bounded grocery needs created by that plan.

The chooser has exactly two primary journey actions. Both journeys are stack routes; the
weekly journey does not become a persistent navigation tab. The existing navigation may
remain, but no third journey tab is added.

The product remains a decision engine:

- The now journey exposes at most four answers total, not four per bucket.
- The week journey exposes one proposal with exactly seven dated entries.
- Equipment, allergen, and dietary constraints are never relaxed.
- Time and cuisine are the only relaxable inputs, and every relaxation is visible.
- Neither journey ends on an unexplained empty result.

## 3. Frozen user-facing copy

These strings and meanings are part of the cross-platform contract.

| Purpose | Exact copy | Meaning |
|---|---|---|
| Now action | `Make a meal now` | Start the immediate decision journey. |
| Now description | `Use your saved pantry, with an optional photo refresh.` | Photos correct pantry drift but are not required. |
| Week action | `Plan and prep my week` | Start the single-proposal weekly journey. |
| Week description | `Get one seven-day plan and only what that plan needs.` | The output is one bounded plan, not a browser or reusable list. |
| Weekly fallback | `Decide that day` | No safe concrete recipe is committed for that date. |
| Nutrition disclaimer | `Estimate only—adjust to your hunger.` | Portion guidance is non-medical and may be adjusted by the user. |
| Plan confirmation | `Use this plan` | Persist the proposal as the confirmed personal plan. |
| Grocery-needs heading | `What this plan needs` | Every displayed need belongs only to the displayed plan. |

Copy may be translated for localization, but the meaning, safety boundaries, and plan scope
must not change. Tests use the English strings above as the canonical fixture values.

## 4. Ownership and retention

### 4.1 Durable ownership

| Data | Owner key | Retention and access rule |
|---|---|---|
| Pantry inventory | `household_id` | Remains shared with members of the household. |
| Body profile | `user_id` | One current profile; deletion removes it. No history or trend data. |
| Photo taste signals | `user_id` | Append-only positive selections only. |
| Meal satiety | `user_id` | Append-only personal check-ins. |
| Continuous-onboarding progress | `user_id` | One personal progress record. |
| Weekly plans | `user_id` | Personal; another household member cannot read or mutate them. |
| Weekly entries | `user_id` plus plan ID | Personal child rows whose ownership must match the parent. |
| Plan-linked grocery needs | `user_id` plus plan ID | Personal child rows deleted when the parent plan is deleted or replaced. |
| Reminder preferences | `user_id` | One personal preference record. |

Every new Supabase table has RLS enabled in the migration that creates it. Personal rows use
`(select auth.uid()) = user_id`. Plan children carry `user_id` and use a composite foreign
key to the parent `(plan_id, user_id)`, so a child cannot be moved to another owner. Grants
are explicit and limited to required commands.

### 4.2 Session-only and borrowed data

- The continuous-onboarding `shownThisSession` flag exists only in the root client session.
  It is not persisted. An app process restart begins a new session; route changes do not.
- Pantry photos are processed through the existing confirmation boundary and discarded.
  A failed or skipped photo changes neither the pantry nor taste signals.
- Spoonacular ingredients, instructions, equipment, duration, servings, and nutrition are
  session-scoped and discarded.
- The only persistable Spoonacular fields are `id`, `title`, and `imageUrl`. The write
  boundary must construct that exact whitelist; it must not pass through arbitrary input.
- A durable weekly recipe must come from the bundled catalog. A Spoonacular recipe cannot
  become a concrete weekly entry even if it is visible in the now journey.

## 5. Plain-data contracts

The shared contract is represented in TypeScript and generated JSON Schema. The checked-in
JSON fixture is the cross-platform acceptance example. Runtime parsing is closed and rejects
unknown enum values or values outside these bounds.

```ts
type MealJourney = 'now' | 'week';
type BodyGoal = 'lose' | 'maintain' | 'gain';
type ActivityLevel =
  | 'sedentary'
  | 'light'
  | 'moderate'
  | 'active'
  | 'very_active';
type CalculationSex = 'female' | 'male';
type NutritionConfidence = 'high' | 'medium' | 'low' | 'unavailable';
type TasteSignalKind = 'photo_selected';
type WeeklyEntryKind = 'recipe' | 'day_of_decision';
type WeeklyPlanStatus = 'draft' | 'confirmed';
type ReminderLeadMinutes = 0 | 10 | 15 | 30 | 60;
```

### 5.1 Body and taste contracts

```ts
interface BodyProfile {
  ageYears: number; // integer, 18..120
  heightCentimeters: number; // 120..230
  weightKilograms: number; // 35..300
  calculationSex: CalculationSex;
  activityLevel: ActivityLevel;
  goal: BodyGoal;
  pregnant: boolean;
  breastfeeding: boolean;
}

interface TasteSignal {
  kind: 'photo_selected';
  recipeId: string;
  journey: MealJourney;
  recordedAt: string; // ISO timestamp
}

interface PortionGuidance {
  servings: number; // quarter increment, 0.75..1.5
  label: string; // "Start with … serving(s)"
  disclaimer: 'Estimate only—adjust to your hunger.';
}
```

A skipped photo-selection prompt creates no `TasteSignal`. Not selecting a recipe is neutral,
not evidence of dislike. Existing explicit meal feedback remains a separate contract.

### 5.2 Weekly contracts

```ts
interface RecipeWeeklyEntry {
  kind: 'recipe';
  date: string; // ISO local calendar date
  recipeId: string; // bundled catalog ID only
  statedRelaxations: readonly ('time' | 'cuisine')[];
  portionGuidance: PortionGuidance | null;
}

interface DayOfDecisionWeeklyEntry {
  kind: 'day_of_decision';
  date: string; // ISO local calendar date
  reason: 'no_safe_recipe' | 'grocery_need_cap';
}

interface PlanLinkedGroceryNeed {
  ingredientId: string; // canonical ingredient ID
  recipeIds: readonly string[];
  dates: readonly string[];
}

interface WeeklyMealPlan {
  weekStart: string; // ISO local calendar date
  entries: readonly (
    | RecipeWeeklyEntry
    | DayOfDecisionWeeklyEntry
  )[]; // exactly seven consecutive dates
  status: 'draft' | 'confirmed';
  groceryNeeds: readonly PlanLinkedGroceryNeed[]; // zero through 12 unique IDs
  statedRelaxations: readonly ('time' | 'cuisine')[];
}
```

The runtime schema, generated JSON Schema, TypeScript types, Supabase mapper, Expo
presentation, and shared fixture must agree on these domains. SQL may normalize fields into
parent and child tables, but it may not weaken the bounds or ownership.

### 5.3 Spoonacular persistence contract

```ts
interface PersistableSpoonacularRecipe {
  id: string;
  title: string;
  imageUrl: string | null;
}
```

The whitelist output has exactly those three enumerable keys in that order. Invalid input
returns `null`; extra input fields never cross the persistence boundary.

## 6. Now-journey policy

The journey begins from the saved household pantry. A user may run a photo refresh as drift
correction, but the refresh is not a prerequisite for a decision. Returning from photo
capture preserves the mounted now-journey draft.

The engine retains the readiness order `ready`, `missing_few`, `missing_some`,
`grocery_run`. The presentation boundary consumes non-empty buckets in that order and stops
after four scored recipes total. Empty buckets and their headings are absent. There is no
per-bucket allowance that can expand the surface beyond four.

When an exact result is thin, the engine may widen time and then drop cuisine, stating each
concession. It may make a best-effort live expansion only under the existing four Spoonacular
conditions: bundled results are thin, quota use is below 40 points, the device is online,
and the query is not cached. HTTP 402 returns no live recipes and is not shown as an error.
Hard constraints are never widened.

Missing, empty, or unknown recipe-equipment metadata is `unclassified` and fails closed. An
explicit verified `none` remains `none`.

## 7. Weekly planning policy

### 7.1 Inputs and output

`planWeek()` is pure and deterministic. It receives bundled `Recipe[]`, the current pantry,
personal preferences, seven dated daily preferences, positive photo taste signals, and
portion-policy inputs. It has no React, `src/lib/`, I/O, clock, or randomness dependency.
The caller supplies the seven dates.

The output is one draft with exactly seven consecutive dated entries. Each date has either a
bundled concrete recipe or a `day_of_decision` fallback. A confirmed plan is persisted only
after the user invokes `Use this plan`.

### 7.2 Selection algorithm

For each date in ascending order:

1. Eliminate every recipe that fails equipment, allergen, or dietary constraints.
2. Consider exact cuisine and time, widening time through `15`, `30`, `60`, and `120`
   minutes as necessary.
3. If still necessary, drop cuisine and repeat the same time tiers.
4. Rank remaining candidates lexicographically by pantry readiness, existing recipe score,
   selected-photo preference, preference for a recipe not yet used in this plan, and stable
   recipe ID.
5. Before accepting a recipe, derive the union of its missing canonical ingredients with the
   needs already created by the plan.
6. Accept it only when that union contains at most 12 unique ingredients. Otherwise continue
   to another eligible candidate; if none fits the cap, emit `day_of_decision` with reason
   `grocery_need_cap`.
7. If no hard-safe candidate exists, emit `day_of_decision` with reason `no_safe_recipe`.

The photo taste signal is a positive tie-breaker only. It cannot overcome readiness, existing
recipe score, a hard constraint, or the grocery-needs cap. Rotation is preferred before
repetition, and recipe ID makes identical inputs produce identical output.

### 7.3 Plan-linked grocery needs

Grocery needs are derived only from concrete entries:

- Exclude canonical ingredients already in the pantry.
- Deduplicate by canonical ingredient ID.
- Preserve stable ingredient-ID ordering.
- Record every concrete recipe ID and date that needs each ingredient.
- Expose no more than 12 unique needs.
- Do not silently truncate. A concrete candidate that would exceed 12 is not admitted.
- Delete the needs through the plan's cascade when the plan is deleted or replaced.

The heading is `What this plan needs`. Needs cannot be checked off into pantry state, reused
across plans, retained as history, or displayed independently as a general list. A replacement
plan derives a new set from its own entries.

## 8. Portion-guidance policy

Portion guidance is optional and never controls whether a recipe is shown or planned. Recipe
nutrition confidence `low` or `unavailable` suppresses only portion guidance; the recipe
remains eligible for both journeys.

For `high` or `medium` confidence, energy-based guidance is eligible only when the user is at
least 18, is not pregnant, and is not breastfeeding. The calculation is:

```text
resting estimate = 10*kg + 6.25*cm - 5*age + sex offset
daily estimate = resting estimate * activity factor + goal adjustment
meal estimate = daily estimate / 3
```

| Input | Frozen value |
|---|---|
| Female sex offset | `-161` |
| Male sex offset | `5` |
| Sedentary activity | `1.2` |
| Light activity | `1.375` |
| Moderate activity | `1.55` |
| Active activity | `1.725` |
| Very active activity | `1.9` |
| Lose adjustment | `-250` kcal/day |
| Maintain adjustment | `0` kcal/day |
| Gain adjustment | `200` kcal/day |

When energy calculation is ineligible, use goal baselines `0.9`, `1.0`, and `1.1` servings
for lose, maintain, and gain respectively. An absent or invalid current profile has no usable
goal and therefore uses the maintain baseline of `1.0`. Apply the most recent satiety
adjustment: `still_hungry=+0.25`, `satisfied=0`, `too_full=-0.25`. Round to the nearest
quarter serving and clamp to `0.75..1.5` servings.

Presentation is the simple label `Start with … serving(s)` followed by
`Estimate only—adjust to your hunger.` It never displays calories, macros, weight trends,
medical advice, or pregnancy-specific advice.

## 9. Continuous-onboarding policy

At most one skippable prompt is shown in an app session. Prompt priority is:

1. safety information;
2. week-critical preference when the active journey is `week`;
3. positive photo taste selection;
4. optional body profile;
5. reminder preference.

Answering a prompt marks only that durable prompt complete. Skipping consumes the one prompt
slot for the current session but does not mark the prompt complete, write a default answer,
or create a negative signal. The same prompt may therefore appear in a future session.

The photo taste prompt shows three bundled recipe photos and records only recipes the user
selects. Closing, skipping, photo load failure, and leaving all photos unselected are neutral.

## 10. Confirmation and reminders

Only concrete recipe entries in a confirmed weekly plan can schedule reminders.
`day_of_decision` entries and drafts never schedule.

Reminder lead presets are exactly:

```text
0 | 10 | 15 | 30 | 60 minutes
```

For each eligible entry:

```text
reminder time = planned meal time - max(recipe duration, selected lead)
```

This means the reminder is never later than the time cooking must begin. Invalid or elapsed
times do not schedule. Times use the device's current timezone and are recalculated after a
timezone change.

Confirmation persists the confirmed plan before attempting best-effort notification sync.
Permission denial or a scheduling failure never reverses confirmation or blocks the plan.
Replacing a confirmed plan cancels saved stale identifiers before scheduling valid
replacements. Disabling reminders clears saved identifiers. Concurrent syncs serialize so an
older sync cannot cancel notifications created by a newer plan.

Local notification APIs remain behind one platform boundary, with web as a safe no-op. No
remote push service, cron job, Edge Function, or third-party notification service is added.

## 11. Failure and fallback contract

| Condition | Required behavior |
|---|---|
| Photo refresh is skipped, fails, or is cancelled | Preserve the prior pantry and record no taste signal. |
| No exact now result | Visibly relax time, then cuisine; keep hard constraints. |
| Spoonacular is unavailable or returns HTTP 402 | Use bundled results without showing an error. |
| No weekly hard-safe candidate | Emit `Decide that day` with reason `no_safe_recipe`. |
| A candidate would exceed 12 needs | Try another candidate, then emit `Decide that day` with reason `grocery_need_cap`. |
| Nutrition is low-confidence or unavailable | Keep the recipe and omit only portion guidance. |
| Body data is absent or energy-ineligible | Use the bounded goal baseline when nutrition confidence permits. |
| Prompt is skipped | Defer it for one session; leave durable progress and signals unchanged. |
| Reminder permission is denied | Confirm the plan and show it without scheduled notifications. |
| Reminder scheduling fails | Keep confirmed state and contain the platform error. |
| Confirmed plan is replaced | Cascade old entries and needs; cancel stale notification identifiers. |

## 12. Expo, shared fixtures, and SwiftUI

This repository owns the TypeScript runtime schema, generated JSON Schema, and
`shared/fixtures/dual-meal-journeys.json`. The Expo implementation consumes those artifacts
directly.

There is no Swift target, Swift package, Xcode project, or Swift toolchain in this repository.
SwiftUI implementation is not part of Tasks 1–9. Harshal's SwiftUI work lives in a separate
repository and consumes the checked-in JSON Schema and fixture as a separate fixture consumer.
No document or test in this repository may claim that Swift code was compiled here.

A change to the schema, enum values, frozen copy, reminder formula, safety behavior, or shared
fixture is a cross-platform contract change. Release parity remains blocked until the same
fixture passes in the separate Swift target.

## 13. Acceptance contract

Implementation is accepted only when all of the following are demonstrated by automated tests
or the named platform review:

### Contracts and boundaries

- Runtime schemas reject out-of-domain body fields, invalid enum values, weekly plans without
  exactly seven entries, and plans with more than 12 needs.
- JSON Schema regeneration is stable, and the checked-in fixture parses through the runtime
  schema.
- The visible now decision preserves bucket order, removes empty buckets, and exposes at most
  four recipes total.
- Missing equipment metadata fails closed as `unclassified`.
- Spoonacular persistence emits exactly `id`, `title`, and `imageUrl`.

### Pure policies

- Portion tests cover every activity level and goal, eligibility, pregnancy, breastfeeding,
  absent profiles, satiety adjustment, quarter rounding, clamps, and nutrition suppression.
- Continuous-onboarding tests prove priority, one prompt per session, neutral skip behavior,
  and single-prompt completion.
- Weekly planner tests prove seven stable entries, hard-constraint decoys, stated time/cuisine
  relaxations, positive taste as tie-breaker only, rotation, bundled-only durability, both
  fallback reasons, the 12-need cap, and low-confidence recipe retention.
- `src/engine/` purity tests continue to forbid React, `src/lib/`, I/O, clock, and randomness.

### Persistence and privacy

- RLS tests prove user A, user A2, user B, and anonymous isolation for every personal table.
- Schema tests prove no `household_id` on weekly tables, composite child ownership, required
  indexes, explicit grants, and cascades from plans to entries and needs.
- Persistence mappers admit bundled recipes to plans and prevent borrowed recipe content from
  crossing a write boundary.
- Body-profile deletion leaves no history, and a plan replacement leaves no stale needs.

### Experience and reminders

- Home has exactly the two frozen journey labels and no new persistent journey tab.
- Every interactive element has role, label, hint, and applicable state.
- Weekly entries expose combined date, meal, duration, and status accessibility text.
- The weekly screen uses the frozen grocery heading and confirmation action, and displays no
  more than 12 needs.
- Reminder tests prove all five presets, the `max(duration, lead)` formula, save-before-sync,
  confirmed-only scheduling, stale cancellation, serialized replacement, and non-blocking
  denial/failure behavior.
- Type checking, tests, web build, Python checks, RLS verification, formatting, and
  `git diff --check` pass on the final tree.

### External release gates

- Android notification behavior and timezone changes pass on physical hardware.
- Nutrition and privacy review approves the estimate policy and copy.
- The shared fixture passes in Harshal's separate Swift target.

These external gates do not authorize adding Swift code, medical features, household weekly
state, grocery forecasting, or a general list to this repository.
