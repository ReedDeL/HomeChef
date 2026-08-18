# HomeChef Weekly Meal Prep Design

**Date:** August 13, 2026

**Status:** Approved for implementation planning

**Release scope:** Post-August 24 feature

## Goal

Give the user one dependable dinner schedule for the next seven days, based on what is in
the pantry, what HomeChef expects the household to receive, and how much time the user
wants to spend cooking each day.

The feature remains a decision engine. HomeChef generates one plan normally containing
three to four cooking sessions and uses leftovers for the remaining dinners. The user
reviews the recommendation and edits exceptions; they do not build a calendar from a
recipe browser.

## Scope

The complete feature includes:

- Dinner only.
- A reusable pattern of daily cooking-time limits and preferred dinner times.
- Recurring-grocery suggestions learned from dated grocery additions.
- Manual grocery entry and grocery-specific photo capture.
- A seven-night plan generated automatically from confirmed and expected ingredients.
- Deliberate larger cooks followed by leftover dinners on busy nights.
- Focused per-night edits and automatic replanning after pantry drift.
- One local reminder before each cooking or reheating start time.

This feature is post-launch. It does not change the August 24 MVP boundary.

## Non-goals

- Shopping lists or automatically proposed purchases.
- Breakfast or lunch planning.
- A browsable meal-planning calendar.
- Drag-and-drop schedule editing.
- Nutrition or macro targets.
- Expiry tracking.
- Roommate schedule-sharing UI.
- Spoonacular recipes in durable weekly plans.
- Receipt OCR, retailer accounts, or grocery-delivery integrations.

## Product principles

### One recommendation, then exceptions

HomeChef produces the week before asking the user to make recipe decisions. The primary
weekly surface is one proposed plan, not multiple schedules or an empty calendar.

### Ingredients have explicit states

The planner never treats an inference as confirmed pantry inventory:

- **Confirmed:** currently in the pantry.
- **Expected:** included in the confirmed weekly forecast but not yet received.
- **Suggested:** inferred from grocery history and awaiting weekly confirmation.

Suggested ingredients may be used to compute an internal provisional draft. The user must
confirm the weekly forecast before the schedule can be approved. Confirming a forecast
moves an ingredient to expected, not confirmed.

### Hard constraints remain hard

Equipment, allergens, and dietary restrictions eliminate recipes. No scheduling,
forecasting, or recovery path may relax them.

### No hidden shopping list

An approved plan uses confirmed pantry ingredients and confirmed expected ingredients.
HomeChef never silently schedules a meal that requires the user to buy something else.

## Core experience

### 1. Confirm the weekly forecast

The weekly flow begins with a short list of suggested incoming groceries. Each suggestion
has an explanation such as `Usually added on Sundays`.

The user can:

- Confirm the forecast.
- Remove or change a suggested item.
- Add an expected item manually.
- Use **Add groceries by photo** for groceries already purchased.

If the user skips the forecast, HomeChef generates the plan from confirmed pantry
ingredients only.

### 2. Review one generated week

HomeChef presents seven dinner entries and a compact summary:

- Number of cooking sessions.
- Number of leftover nights.
- Total active cooking time.
- Which meals rely on expected ingredients.

The default target is four cooks and three leftover nights. The planner may reduce the
number of unique cooks when time or ingredient coverage is thin.

The plan is still a draft until the user selects **Use this plan**. Approval persists the
plan and schedules its reminders.

### 3. Return to tonight

After approval, Home stops asking the normal time-first question when tonight has a plan.
It instead shows:

- Tonight's meal.
- The calculated start time.
- Total cooking or reheating time.
- Whether the cook also produces tomorrow's dinner.
- **Start cooking** as the primary action.

Two quiet secondary actions remain: **View this week** and **Pick something else**.
Choosing another meal does not delete the rest of the approved week.

### Navigation

Before a plan exists, Home exposes one quiet **Plan my week** row near the pantry link.
The weekly flow is a stack route, not a third tab. The feature must not put a persistent
meal-planning choice on every screen.

## Grocery learning

### What creates purchase history

Only explicit grocery events teach recurrence:

- A grocery-specific photo session.
- Manual entry through **Just bought groceries**.

An ordinary pantry photo does not create a purchase event. It may contain items bought
weeks earlier and would corrupt the inferred cadence.

Images are processed and discarded. The durable event contains canonical ingredient IDs,
the event date, entry source, and quantity or unit when the user confirmed one. Receipt
text and image locations are not retained.

### Recurrence heuristic

The first version uses a deterministic heuristic rather than a model or external service:

1. Consider the four prior calendar weeks in the household's local timezone.
2. Suggest an ingredient after it appears in at least two of those weeks.
3. Estimate its arrival weekday from the median recent purchase weekday.
4. Estimate quantity from the median of known recent quantities.
5. Keep quantity unknown when the observations do not support a reliable estimate.

Manual corrections become new evidence. Rejecting a suggestion excludes it from the
current forecast but does not erase the purchase history. Two consecutive weekly
rejections suppress it until a new grocery event records that ingredient again.

### Arrival and drift

Each expected ingredient has an anticipated arrival date. The planner cannot use it before
that date. A grocery photo or manual confirmation promotes a matching expected item into
the confirmed pantry and records the actual arrival date.

When an expected item is still absent after its anticipated arrival, HomeChef replans only
future meals that depend on it. It explains the replacement and offers an undo or an
**I received it** correction.

## Weekly preferences

The user configures a reusable rhythm once:

- Maximum active cooking minutes for each weekday.
- Preferred dinner time for each weekday.
- Whether that weekday is normally available for cooking.
- Number of diners.
- Reminder lead time: at start, 10, 20, or 30 minutes before start.

The UI may group days with the same values, such as Monday through Thursday. A user can
override any value for one date from the generated plan without changing the reusable
pattern.

The initial default is one diner, a 30-minute limit, a 7:00 PM dinner time, and a 10-minute
reminder lead. Reminders remain disabled until the user explicitly enables them.

## Planner contract

`planWeek()` belongs in `src/engine/` and is pure. Dates in its contract are ISO 8601 local
calendar dates rather than timestamps. Its conceptual inputs are:

```ts
type ISODate = string;

interface PlanWeekInput {
  recipes: Recipe[];
  pantry: IngredientAvailability[];
  expected: ExpectedIngredient[];
  preferences: UserPreferences;
  rhythm: WeeklyCookingRhythm;
  dinerCount: number;
  weekStart: ISODate;
}
```

The output is a deterministic draft with seven entries:

```ts
type MealPlanEntry =
  | CookEntry
  | LeftoverEntry
  | UnavailableEntry
  | DayOfDecisionEntry;

interface WeeklyMealPlan {
  weekStart: ISODate;
  entries: readonly MealPlanEntry[];
  activeMinutes: number;
  appliedRelaxations: readonly WeeklyPlanRelaxation[];
}
```

`UnavailableEntry` means the user explicitly opted out of planning dinner for that date.
`DayOfDecisionEntry` is the last-resort promise that HomeChef will run its normal pantry
decision on that date because the weekly planner could not safely assign a concrete meal.

These are plain-data contracts. The engine imports neither React nor `src/lib/`, performs
no I/O, and does not know whether its inputs came from Zustand or Supabase.

## Catalog requirements

Reliable leftovers require data that the current catalog contract does not contain. Tier 1
recipes must gain build-time fields for:

- Base serving count.
- Structured ingredient quantity and canonical unit where parsing is reliable.
- Whether the recipe can produce next-day leftovers.

The catalog pipeline leaves a quantity unknown rather than inventing precision. A recipe
without a reliable serving count is not eligible to anchor a leftover night.

The initial leftover rule is deliberately narrow: a larger cook may supply the following
night only. Longer storage or freezer planning requires explicit catalog metadata and is
not inferred.

Only bundled Tier 1 recipes are eligible for durable plans. Spoonacular ingredients,
instructions, time, and serving data are borrowed and cannot be persisted. Restricting the
planner to Tier 1 keeps approved plans available offline and prevents a Terms of Use
violation.

## Scheduling behavior

The planner applies these rules in order:

1. Eliminate recipes that violate equipment, allergen, or dietary constraints.
2. Eliminate a recipe from a date when its required ingredients are not available by then.
3. Put larger, leftover-producing meals on higher-time days.
4. Assign their leftovers to the following lower-time or unavailable cooking day.
5. Prefer ingredient reuse without reserving the same limited quantity twice.
6. Apply existing dislike and skip signals when ranking otherwise valid recipes.
7. Prefer three to four distinct cooks while avoiding unnecessary repetition.
8. Minimize active cooking time after the requirements above are satisfied.
9. Use a stable recipe-ID tie-breaker so identical inputs always produce the same plan.

The implementation should use a bounded deterministic search rather than seven greedy
daily decisions. A small beam search over the roughly 300 bundled recipes can carry the
remaining ingredient ledger and leftover state across days without requiring a service or
database search.

### Ingredient reservations

Known quantities are reserved across all seven entries while the draft is built. An
ingredient with an unknown quantity receives one primary use unless the user confirms that
there is enough for more. Leftover entries consume the reservation made by their original
cook and do not consume ingredients again.

Reservations are tentative. Approving a plan does not remove anything from the pantry.
The existing Cook mode completion flow performs the real pantry deduction, after which the
coordinator checks future entries for drift.

### Weekly relaxation order

If the ideal four-cook plan cannot be built, the planner:

1. Reduces four unique cooks to three, then two.
2. Uses an additional valid leftover night when the catalog metadata permits it.
3. Widens a daily time limit by one tier and states the change in the plan.
4. Places a clearly labeled day-of HomeChef decision on the affected night.

The planner never adds missing groceries, schedules an unconfirmed suggestion, or relaxes
a hard constraint.

## Editing and automatic recovery

Tapping a dinner opens four focused actions:

- Swap this dinner.
- Move it to another day.
- Change this day's available time.
- Mark this date as unavailable for cooking.

Swap shows at most three ranked alternatives. It does not open the full catalog. Moving a
cook moves its dependent leftover entry or asks the user to replace that leftover night.

Automatic replanning is local to the smallest affected portion of the week:

- Pantry drift changes the affected future cook and its dependent leftover only.
- A missed expected ingredient changes only future entries that require it.
- A completed or skipped date is immutable.
- Every automatic replacement states why it occurred and offers undo.

All editing actions use buttons and lists. Dragging may be an enhancement but can never be
the only way to modify a plan.

## Reminders

Reminders use local notifications. No Edge Function, cron job, or third-party notification
service is required.

For a cooking entry:

```text
start time = preferred dinner time - recipe duration
reminder time = start time - reminder lead time
```

For a leftover entry, the recipe duration is replaced with its reheating duration. The
first implementation sends one reminder per concrete dinner. Unavailable and day-of
decision entries do not schedule a cooking reminder until they contain a meal.

Approving, swapping, moving, or replacing a plan entry cancels its stale notification and
schedules a new one. Times are recalculated in the user's current timezone, including
daylight-saving changes.

Notification permission is requested only after the user enables reminders. If permission
is denied, planning remains fully functional and Home always displays the calculated start
time. Settings shows one quiet **Enable reminders** row.

A notification opens tonight's plan entry. Example copy:

> Start in 10 minutes. Lemon chicken tray takes 45 minutes. Start at 6:15 to eat
> at 7:00.

## Architecture

The feature is divided into units with one responsibility each:

- `inferWeeklyIngredients()` converts grocery events into suggested ingredients.
- `planWeek()` converts recipes, availability, and preferences into a seven-entry draft.
- The weekly-plan coordinator loads inputs, requests confirmation, persists approval, and
  triggers reminder scheduling.
- The notification service owns local notification identifiers, cancellation, and
  rescheduling.
- The data layer maps Supabase rows into plain engine inputs and outputs.

TanStack Query owns server state. Temporary draft edits may live in component state or a
focused client store, but the approved plan and grocery history do not belong in Zustand.

## Data model

The exact SQL belongs in the implementation plan. The durable model has these boundaries:

- `grocery_events` is household-owned and records one dated manual or photo addition.
- `grocery_event_items` is household-owned and records canonical ingredients and amounts.
- `weekly_ingredient_forecasts` is household-owned and records one forecast per week.
- `weekly_ingredient_forecast_items` is household-owned and records each ingredient state.
- `meal_schedule_preferences` is user-owned and records diners, reminders, and timezone.
- `meal_schedule_day_preferences` is user-owned and records each weekday's rhythm.
- `meal_plans` is user-owned and records one personal draft or approved plan per week.
- `meal_plan_entries` is user-owned and records the seven dated plan entries.

Child records carry their ownership column as well as their parent foreign key. A composite
foreign key keeps child ownership consistent with the parent while allowing direct,
indexable RLS predicates.

All timestamps are `timestamptz`; calendar dates are `date`; weekday values have a bounded
check constraint. Status values use text with check constraints. Every foreign key and RLS
predicate column is indexed, including composite user/week and household/week access paths.

### RLS

- Grocery events and forecasts require membership in their `household_id`.
- Schedule preferences, plans, and entries require `(select auth.uid()) = user_id`.
- Update policies use both `using` and `with check` ownership predicates.
- RLS is enabled in the same migration that creates each table.
- Authenticated clients receive only the grants needed for the intended operations.

The household pantry remains shared while allergies, dietary preferences, and schedules
remain personal.

## Data flow

```text
grocery photo/manual entry
  -> canonical grocery event + confirmed pantry update
  -> inferWeeklyIngredients(recent events)
  -> user confirms the weekly forecast
  -> planWeek(catalog, pantry, expected, rhythm, hard constraints)
  -> user approves one draft
  -> persist plan + schedule local reminders
  -> Home renders tonight's plan entry
```

The grocery photo reuses the existing image-processing privacy boundary: compress, analyze,
confirm candidates, and discard the image. A grocery-specific source flag distinguishes
the resulting event from an ordinary pantry scan.

## Recovery behavior

- **Forecast skipped:** plan with confirmed pantry ingredients only.
- **Expected item late:** replace only affected future entries and explain why.
- **Pantry drift:** recompute the affected cook and dependent leftover.
- **Insufficient ingredients:** use a stated day-of decision entry rather than inventing a
  purchase.
- **Offline:** use the bundled catalog, locally available approved plan, cached pantry, and
  saved preferences; queue mutations for later synchronization.
- **Notification permission denied:** keep all plan behavior and show start times in-app.
- **Notification scheduling failure:** show the approved plan and an in-app reminder state;
  notification delivery must never block plan approval.
- **Tier 1 recipe unavailable after an app update:** replace the affected future entry using
  the current bundled catalog and state the change.

## Accessibility

- Every plan entry is a single accessible group with date, meal, duration, and status.
- All edits work without drag gestures.
- Interactive targets remain at least 44 by 44 points.
- Expected and confirmed states use text labels, not color alone.
- Automatic plan changes are announced politely; allergen warnings remain the only
  assertive safety announcement.
- Dynamic Type at 200% reflows the weekly agenda without horizontal scrolling.
- Notification copy includes the meal, start time, duration, and dinner time.

## Testing

### Pure engine

- Expected ingredients are unavailable before their arrival date.
- Hard equipment, allergen, and dietary constraints are never relaxed.
- Daily cooking limits and explicit time relaxations are respected.
- Ingredient reservations never spend a known quantity twice.
- Unknown quantities receive at most one primary use.
- Leftovers originate from a qualifying cook and follow its serving count.
- Stable inputs produce a stable plan.
- Every approved plan has exactly seven entries.
- Relaxation order is fixed and tested.

### Forecasting

- Two of the four prior calendar weeks crosses the recurrence threshold.
- Median weekday and quantity calculations are stable.
- Ordinary pantry photos do not create grocery events.
- Manual corrections affect later forecasts.
- Two consecutive rejections suppress a suggestion until a new grocery event revives it.
- Suggested, expected, confirmed, rejected, and missed states do not collapse together.

### Data and security

- Household members can access their household's grocery events and forecasts.
- Non-members cannot access them.
- A user cannot read or mutate another user's rhythm or meal plan.
- Child ownership cannot be reassigned through an update.
- Every new table has RLS enabled and required foreign-key indexes.

### Notifications

- Approving a plan schedules one reminder for each applicable dinner.
- Swaps and moves cancel stale reminders before scheduling replacements.
- Leftover entries use reheating time.
- Timezone and daylight-saving changes recalculate times correctly.
- Permission denial and scheduling failure do not block plan approval.

### Integration and accessibility

- Grocery photo to confirmed event to expected forecast to approved plan.
- Missed expected ingredient to explained local replacement.
- Pantry removal to affected-entry replan.
- Notification deep link to tonight's plan entry.
- Keyboard, screen-reader, reduced-motion, and 200% Dynamic Type coverage.

## Success criteria

The feature succeeds when a returning user can confirm the week's expected groceries,
approve a complete dinner plan, and leave the app in under two minutes. During the week,
HomeChef should require no interaction until a useful cooking reminder or genuine pantry
drift demands attention.
