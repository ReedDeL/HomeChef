# Meal Satiety Check-In Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user privately record whether a completed meal left them still hungry, satisfied, or too full.

**Architecture:** Add an append-only, user-owned `meal_satiety` table protected by table grants and RLS. Keep the allowed three-state domain in a small pure module, have the query layer insert only validated payloads, and add a reusable check-in component that Cook Mode displays after the current verdict step.

**Tech Stack:** Expo Router, React Native, TypeScript strict mode, TanStack Query, Supabase Postgres/RLS, Vitest.

## Global Constraints

- `meal_satiety` is personal: every row joins to `user_id`, never `household_id`.
- Store only the recipe identifier and satiety level; never persist Tier 2 ingredients or instructions.
- Enable RLS in the migration that creates the table and grant authenticated users only `SELECT` and `INSERT`.
- The only allowed levels are `still_hungry`, `satisfied`, and `too_full`; submitted rows are immutable at launch.
- Use named exports outside Expo Router routes, strict TypeScript with no `any`, and no new dependencies.
- Use only `src/theme/tokens.ts` and `useTheme()` for spacing, color, sizing, and elevation.
- Every interactive control must include accessibility role, label, hint, and state where applicable.
- Keep the completion flow skippable: a failed save must preserve the selection and offer retry; Skip always returns home.
- Run `npm run check` and the RLS verification script before handoff when the local Supabase database is available.

---

## File structure

| File | Responsibility |
| --- | --- |
| `supabase/migrations/0005_add_meal_satiety.sql` | Defines the private append-only table, RLS policies, and authenticated grants. |
| `supabase/tests/rls_verification.sql` | Proves the new personal data cannot be read or written by a roommate or anon session. |
| `src/types/supabase-generated.ts` | Generated Supabase row shape for `meal_satiety`, regenerated from the migrated schema. |
| `src/types/database.ts` | Narrows `meal_satiety.level` from generated `string` to the application union. |
| `src/lib/meal-satiety.ts` | Pure level constants, validation, labels, and insert-payload builder. |
| `src/lib/meal-satiety.test.ts` | Node-only tests for the closed level domain and payload builder. |
| `src/lib/queries/preferences.ts` | Inserts a validated satiety record through the existing personal-data query module. |
| `src/components/ui/MealSatietyCheckIn.tsx` | Accessible, reusable three-choice check-in presentation and local selection state. |
| `app/cook/[id].tsx` | Transitions from verdict to check-in, performs the mutation, and returns home. |

### Task 1: Create the private database record

**Files:**

- Create: `supabase/migrations/0005_add_meal_satiety.sql`
- Modify: `supabase/tests/rls_verification.sql`
- Modify: `src/types/supabase-generated.ts`
- Modify: `src/types/database.ts`

**Interfaces:**

- Produces `public.meal_satiety(id, user_id, recipe_id, level, recorded_at)`.
- Produces `MealSatietyLevel = 'still_hungry' | 'satisfied' | 'too_full'` and `MealSatietyRow`.
- RLS permits each authenticated user to select and insert only their own rows; no update or delete policy exists.

- [ ] **Step 1: Extend the RLS verification fixture before creating the migration**

  Add a table-owner seed directly after the existing `meal_feedback` seed:

  ```sql
  insert into public.meal_satiety (user_id, recipe_id, level)
  values ('aaaaaaaa-0000-4000-8000-000000000001', 'tier1-0001', 'satisfied'),
         ('bbbbbbbb-0000-4000-8000-000000000001', 'tier1-0002', 'too_full');
  ```

  Add these assertions in the `as A` block, renumbering later results consistently:

  ```sql
  select count(*) into n from public.meal_satiety;
  results := results || format('8|A sees own satiety only|1|%s', n);

  blocked := false;
  begin
    insert into public.meal_satiety (user_id, recipe_id, level)
    values (user_b, 'tier1-0003', 'still_hungry');
  exception when others then blocked := true;
  end;
  results := results || format('11|A cannot write satiety as B|blocked|%s',
                               case when blocked then 'blocked' else 'ALLOWED' end);
  ```

  Add an assertion in the `as A2` block that `count(*) from public.meal_satiety` is `0`, and one in the `as anon` block that it is `0`.

- [ ] **Step 2: Run the RLS script to confirm the new fixture fails before the table exists**

  Run: `psql "$DATABASE_URL" -f supabase/tests/rls_verification.sql`

  Expected: FAIL with `relation "public.meal_satiety" does not exist`.

- [ ] **Step 3: Add the migration with grants and RLS in the same file**

  Create `supabase/migrations/0005_add_meal_satiety.sql`:

  ```sql
  create table meal_satiety (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references profiles(id) on delete cascade,
    recipe_id text not null,
    level text not null check (level in ('still_hungry', 'satisfied', 'too_full')),
    recorded_at timestamptz not null default now()
  );

  create index meal_satiety_user_recorded_at_idx
    on meal_satiety (user_id, recorded_at desc);

  alter table meal_satiety enable row level security;

  create policy meal_satiety_read_own on meal_satiety
    for select to authenticated
    using (user_id = (select auth.uid()));

  create policy meal_satiety_insert_own on meal_satiety
    for insert to authenticated
    with check (user_id = (select auth.uid()));

  grant select, insert on public.meal_satiety to authenticated;
  ```

  Do not add `UPDATE` or `DELETE` grants or policies.

- [ ] **Step 4: Apply the migration and regenerate database types**

  Run the project’s existing local migration command, then regenerate from that migrated schema:

  ```bash
  npx supabase gen types typescript --local > src/types/supabase-generated.ts
  ```

  Confirm the generated file exposes this shape:

  ```ts
  meal_satiety: {
    Row: {
      id: string
      level: string
      recipe_id: string
      recorded_at: string
      user_id: string
    }
    Insert: {
      id?: string
      level: string
      recipe_id: string
      recorded_at?: string
      user_id: string
    }
    Update: {
      id?: string
      level?: string
      recipe_id?: string
      recorded_at?: string
      user_id?: string
    }
    Relationships: [/* profile foreign-key relationship emitted by the generator */]
  }
  ```

  If the project is linked only to a remote Supabase instance, do not regenerate against it without the user’s explicit authorization. In that case, apply the migration and regenerate types together in the approved deployment environment before client code is merged.

- [ ] **Step 5: Narrow the generated text domain for client code**

  Add below `MealFeedbackRow` in `src/types/database.ts`:

  ```ts
  /** `meal_satiety.level`, per the CHECK in 0005_add_meal_satiety.sql. */
  export type MealSatietyLevel = 'still_hungry' | 'satisfied' | 'too_full';

  export type MealSatietyRow = NarrowColumn<
    Tables<'meal_satiety'>,
    'level',
    MealSatietyLevel
  >;
  ```

- [ ] **Step 6: Verify the privacy contract**

  Run: `psql "$DATABASE_URL" -f supabase/tests/rls_verification.sql`

  Expected: every assertion reports `PASS`, including A’s own satiety read, the cross-user insert rejection, roommate isolation, and anon isolation.

- [ ] **Step 7: Commit the schema boundary**

  ```bash
  git add supabase/migrations/0005_add_meal_satiety.sql \
    supabase/tests/rls_verification.sql \
    src/types/supabase-generated.ts \
    src/types/database.ts
  git commit -m "Add private meal satiety records"
  ```

### Task 2: Define and persist validated satiety data

**Files:**

- Create: `src/lib/meal-satiety.ts`
- Create: `src/lib/meal-satiety.test.ts`
- Modify: `src/lib/queries/preferences.ts`
- Modify: `src/lib/queries/keys.ts`

**Interfaces:**

- Consumes: `MealSatietyLevel` and the generated `meal_satiety` table from Task 1.
- Produces `SATIETY_LEVELS`, `isMealSatietyLevel(value)`, `satietyLabel(level)`, `toMealSatietyInsert(userId, recipeId, level)`, and `recordMealSatiety(userId, recipeId, level)`.

- [ ] **Step 1: Write the failing pure-domain tests**

  Create `src/lib/meal-satiety.test.ts`:

  ```ts
  import { describe, expect, it } from 'vitest';

  import {
    SATIETY_LEVELS,
    isMealSatietyLevel,
    satietyLabel,
    toMealSatietyInsert,
  } from '@/lib/meal-satiety';

  describe('meal satiety domain', () => {
    it('keeps the supported levels in the UI order', () => {
      expect(SATIETY_LEVELS).toEqual(['still_hungry', 'satisfied', 'too_full']);
    });

    it('accepts only the database CHECK values', () => {
      expect(isMealSatietyLevel('satisfied')).toBe(true);
      expect(isMealSatietyLevel('very_full')).toBe(false);
      expect(isMealSatietyLevel(null)).toBe(false);
    });

    it('builds the exact insert shape without a client timestamp', () => {
      expect(toMealSatietyInsert('user-1', 'recipe-1', 'too_full')).toEqual({
        user_id: 'user-1',
        recipe_id: 'recipe-1',
        level: 'too_full',
      });
    });

    it('uses human-readable labels for each allowed level', () => {
      expect(satietyLabel('still_hungry')).toBe('Still hungry');
      expect(satietyLabel('satisfied')).toBe('Satisfied');
      expect(satietyLabel('too_full')).toBe('Too full');
    });
  });
  ```

- [ ] **Step 2: Run the test to verify it fails**

  Run: `npm test -- src/lib/meal-satiety.test.ts`

  Expected: FAIL because `@/lib/meal-satiety` does not exist.

- [ ] **Step 3: Implement the pure domain module**

  Create `src/lib/meal-satiety.ts`:

  ```ts
  import type { MealSatietyLevel } from '@/types/database';

  export const SATIETY_LEVELS = ['still_hungry', 'satisfied', 'too_full'] as const;

  export function isMealSatietyLevel(value: unknown): value is MealSatietyLevel {
    return typeof value === 'string' && SATIETY_LEVELS.includes(value as MealSatietyLevel);
  }

  export function satietyLabel(level: MealSatietyLevel): string {
    const labels: Record<MealSatietyLevel, string> = {
      still_hungry: 'Still hungry',
      satisfied: 'Satisfied',
      too_full: 'Too full',
    };
    return labels[level];
  }

  export function toMealSatietyInsert(
    userId: string,
    recipeId: string,
    level: MealSatietyLevel
  ): { user_id: string; recipe_id: string; level: MealSatietyLevel } {
    return { user_id: userId, recipe_id: recipeId, level };
  }
  ```

- [ ] **Step 4: Add the Supabase write function and query key**

  Add the import and function to `src/lib/queries/preferences.ts`:

  ```ts
  import { toMealSatietyInsert } from '@/lib/meal-satiety';
  import type { MealSatietyLevel } from '@/types/database';

  export async function recordMealSatiety(
    userId: string,
    recipeId: string,
    level: MealSatietyLevel
  ): Promise<void> {
    const { error } = await supabase
      .from('meal_satiety')
      .insert(toMealSatietyInsert(userId, recipeId, level));

    if (error) throw error;
  }
  ```

  Add `satiety: (userId: string) => ['satiety', userId] as const` to `queryKeys` so a future history query has a stable cache key. Do not create a history query in this change.

- [ ] **Step 5: Run the domain test and type checker**

  Run: `npm test -- src/lib/meal-satiety.test.ts && npm run typecheck`

  Expected: PASS.

- [ ] **Step 6: Commit the typed persistence boundary**

  ```bash
  git add src/lib/meal-satiety.ts src/lib/meal-satiety.test.ts \
    src/lib/queries/preferences.ts src/lib/queries/keys.ts
  git commit -m "Add meal satiety persistence"
  ```

### Task 3: Add the check-in component to Cook Mode

**Files:**

- Create: `src/components/ui/MealSatietyCheckIn.tsx`
- Modify: `app/cook/[id].tsx`

**Interfaces:**

- Consumes: `SATIETY_LEVELS`, `satietyLabel`, `MealSatietyLevel`, `recordMealSatiety`, and `useMutation`.
- Produces: `MealSatietyCheckIn`, with props `{ recipeTitle, onSave, onSkip, isSaving, errorMessage }`.
- The screen owns navigation and mutation state; the component owns only its selected level.

- [ ] **Step 1: Write the component API and the selection cards**

  Create `src/components/ui/MealSatietyCheckIn.tsx` with this public interface:

  ```ts
  interface MealSatietyCheckInProps {
    recipeTitle: string;
    isSaving: boolean;
    errorMessage: string | null;
    onSave: (level: MealSatietyLevel) => void;
    onSkip: () => void;
  }

  export function MealSatietyCheckIn({
    recipeTitle,
    isSaving,
    errorMessage,
    onSave,
    onSkip,
  }: MealSatietyCheckInProps) {
    // local selected level; render a radiogroup and the three card Pressables
  }
  ```

  Use `Pressable` radio controls with `accessibilityRole="radio"`,
  `accessibilityState={{ selected }}`, labels “Still hungry”, “Satisfied”, and “Too full”, and hints that say the choice records how the meal felt. Use `PrimaryButton` for **Save hunger stat** (disabled without a selection or while saving) and its ghost variant for **Skip**. Display a `Text` error “Couldn’t save your hunger stat. Try again or skip for now.” only when `errorMessage` is non-null.

  The component must use `space`, `radius`, `touchTarget`, and `useTheme`; do not introduce literal colors or spacing values. Give the group `accessibilityRole="radiogroup"` and label it “How full do you feel after this meal?”

- [ ] **Step 2: Wire the cook screen state transition and mutation**

  In `app/cook/[id].tsx`, replace the single `completed` boolean with a completion state that distinguishes the verdict and satiety steps:

  ```ts
  type CompletionStep = 'cooking' | 'verdict' | 'satiety';

  const [completionStep, setCompletionStep] = useState<CompletionStep>('cooking');
  ```

  In the existing verdict handler, preserve current pantry behavior and change the final action to `setCompletionStep('satiety')`. Add:

  ```ts
  const satietyMutation = useMutation({
    mutationFn: async (level: MealSatietyLevel) => {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      if (!data.user) throw new Error('Sign in is required to save a hunger stat.');
      await recordMealSatiety(data.user.id, recipe.id, level);
    },
    onSuccess: () => router.replace('/'),
  });
  ```

  Render `MealSatietyCheckIn` when `completionStep === 'satiety'`, passing `recipe.title`, `satietyMutation.isPending`, an error message only when `satietyMutation.isError`, `satietyMutation.mutate`, and `() => router.replace('/')`. Update `handleBack` so it returns satiety to verdict and verdict to the final cooking step. Keep the final cook-navigation hint accurate: “Opens meal completion survey.”

- [ ] **Step 3: Verify the focused interaction manually**

  Run: `npm run web`

  Verify in the browser:

  1. Completing a recipe and selecting either verdict opens the check-in.
  2. Save is disabled until a radio option is selected.
  3. Each radio option has a visible selected marker and an announced selected state.
  4. Save inserts one row and returns home; Skip returns home without a row.
  5. A simulated Supabase insert failure leaves the chosen option selected, shows the retry copy, and lets Skip exit.
  6. The browser accessibility tree reports a labelled radiogroup, labelled radio buttons, and labelled Save/Skip controls.

- [ ] **Step 4: Run the complete automated validation**

  Run: `npm run check`

  Expected: PASS with ESLint, TypeScript, Vitest, and Prettier all clean.

- [ ] **Step 5: Inspect the final diff and commit only this feature**

  Run: `git diff --check && git diff -- app/cook/[id].tsx src/components/ui/MealSatietyCheckIn.tsx`

  Expected: no whitespace errors; the diff contains the verdict-to-check-in transition, private mutation, and accessible UI only.

  ```bash
  git add app/cook/[id].tsx src/components/ui/MealSatietyCheckIn.tsx
  git commit -m "Add meal satiety check-in"
  ```
