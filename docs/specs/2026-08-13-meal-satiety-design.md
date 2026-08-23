# Meal satiety check-in design

**Date:** 2026-08-13
**Status:** Approved for implementation — plan at
`docs/plans/2026-08-13-meal-satiety.md`, no code yet

## Purpose

Capture a quick, private signal about whether a completed meal left a user
still hungry, satisfied, or too full. The history will support future personal
tracking without adding a nutrition or macro-tracking feature.

## Scope

After the existing cook-mode verdict is selected, show a separate, optional
satiety check-in. The user may choose one of three levels:

- `still_hungry`
- `satisfied`
- `too_full`

The check-in has a primary **Save** action after a choice is made and a
secondary **Skip** action. Both actions return the user to home. Skipping
creates no record.

The existing verdict screen remains the first completion interaction. The
check-in follows it so each screen asks one focused question and the meal can
still be completed in one tap when the user skips.

## Data model and privacy

Add a `meal_satiety` table with one row for each submitted check-in:

```sql
create table meal_satiety (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  recipe_id text not null,
  level text not null check (level in ('still_hungry', 'satisfied', 'too_full')),
  recorded_at timestamptz not null default now()
);
```

The migration enables RLS immediately. Authenticated users may select and
insert only rows whose `user_id` matches `auth.uid()`. No update or delete
policy is needed for launch, keeping submitted tracking records immutable.

This is personal data: it joins to `user_id`, never `household_id`, and is not
visible to household members. It records only the canonical recipe identifier
and the three-state signal; it does not persist any borrowed Spoonacular recipe
content.

## Client design

Create a reusable `MealSatietyCheckIn` UI component under `src/components/ui/`.
It receives the recipe title and callbacks for save and skip. It owns only the
temporary selected state; its parent owns persistence and navigation.

The component uses three accessible radio-style selection cards, existing
theme tokens, and the existing `PrimaryButton`. Save remains disabled until a
level is selected. Each control exposes an accessible label, hint, and selected
state.

Create a query mutation module that inserts `{ user_id, recipe_id, level }`
into `meal_satiety`. The cook screen obtains the authenticated user before
starting the mutation. A failed insert does not trap the user: the component
shows a concise retryable message and preserves the selection; Skip always
returns home.

## Flow

1. The user finishes cooking and selects the existing positive or negative
   verdict.
2. Pantry removal continues to occur only for the positive verdict, as it does
   today.
3. Cook mode switches to the satiety check-in rather than navigating home.
4. Choosing a level and saving creates the private `meal_satiety` row, then
   navigates home.
5. Skipping creates no satiety row and navigates home.

## Tests

- Unit-test the satiety level type/validation and mutation payload.
- Render-test selection behavior, disabled save state, submit, skip, and the
  retryable failure state.
- Extend the generated Supabase types to include the new table.
- Add SQL verification covering RLS isolation between two users.

## Non-goals

- No macro or nutrition tracking.
- No trend charts, history screen, or recommendation changes in this work.
- No free-text notes or five-point scale.
