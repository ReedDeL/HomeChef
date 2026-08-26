> **Historical implementation plan.** Cook mode and satiety check-ins are not current MVP requirements. See `../00_PRODUCT_DIRECTION.md`.

# Meal Satiety Check-In Implementation Plan

**Goal:** Let a user privately record whether a completed meal left them
`still_hungry`, `satisfied`, or `too_full`.

**Governing design:** `docs/specs/2026-08-13-meal-satiety-design.md`

## File responsibilities

| File | Responsibility |
|---|---|
| Supabase migration | Append-only personal table, grants, and RLS |
| RLS verification | Prove anon, roommate, and cross-user denial |
| Generated/database types | Expose the row and narrow the closed level domain |
| `src/lib/meal-satiety.ts` | Pure validation, labels, and insert payload |
| Query layer | Insert validated user-owned records |
| `MealSatietyCheckIn.tsx` | Accessible three-choice UI and local selection |
| `app/cook/[id].tsx` | Show check-in after verdict, save, retry, skip, return home |

## Task 1: Private data record

Create `meal_satiety(id, user_id, recipe_id, level, recorded_at)`. Enable RLS
in the same migration. Authenticated users may select and insert only their own
rows; no update or delete policy exists. Grant only the required operations.

Regenerate Supabase types after applying the migration. Never hand-edit a
generated schema shape except through the established narrowing layer.

Acceptance:

- anon cannot read or insert;
- a roommate cannot read or insert for another user;
- ownership cannot be reassigned;
- invalid levels fail at both database and application boundaries.

## Task 2: Pure contract and persistence

Define the closed level tuple, labels, validator, and payload builder without
React or Supabase imports. The query layer accepts only a validated payload and
the authenticated user ID. Store the recipe identifier and level only; Spoonacular
ingredients and instructions never persist.

Tests cover all valid levels, unknown input, payload shape, and query failure.

## Task 3: Cook Mode check-in

After the existing verdict step, show one accessible choice group with the
three levels. Saving is explicit. A failed insert preserves the selection and
offers retry. Skip always returns home. The UI uses theme tokens and meets the
44-point target requirement.

Tests cover selection, save, retry, skip, accessibility labels, and prevention
of duplicate submission.

## Verification

- Run focused pure, component, and query tests.
- Run `npm run check`.
- Run the Supabase RLS verification when the local stack is available.
- Inspect the final diff and generated-type changes before handoff.
