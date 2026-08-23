import { describe, expect, it } from 'vitest';

import type { WeeklyMealPlan } from '@/contracts/meal-journeys';
import { makeBodyProfile, makeRecipe } from '@/engine/__fixtures__';
import {
  bodyProfilePersistence,
  mealReminderPreferencesPersistence,
  mealSatietyPersistence,
  onboardingProgressPersistence,
  tasteSignalPersistence,
  weeklyPlanPersistence,
} from '@/lib/meal-journey-persistence';

const USER_ID = 'aaaaaaaa-0000-4000-8000-000000000001';
const PLAN_ID = 'a0000000-0000-4000-8000-000000000001';
const DATES = [
  '2026-08-24',
  '2026-08-25',
  '2026-08-26',
  '2026-08-27',
  '2026-08-28',
  '2026-08-29',
  '2026-08-30',
] as const;

function makePlan(recipeId = 'bundled-1'): WeeklyMealPlan {
  return {
    weekStart: DATES[0],
    status: 'draft',
    statedRelaxations: ['time'],
    entries: DATES.map((date) => ({
      kind: 'recipe' as const,
      date,
      recipeId,
      plannedMealTime: `${date}T18:30:00-07:00`,
      statedRelaxations: ['time'] as const,
      portionGuidance: null,
    })),
    groceryNeeds: [
      { ingredientId: 'egg', recipeIds: [recipeId], dates: [DATES[0]] },
      { ingredientId: 'rice', recipeIds: [recipeId], dates: [DATES[1]] },
    ],
  };
}

describe('personal current-state persistence', () => {
  it('constructs a body-profile upsert from only the contract fields', () => {
    const row = bodyProfilePersistence.toUpsert(USER_ID, {
      ...makeBodyProfile(),
      borrowedInstructions: 'must not cross',
    });

    expect(row).toEqual({
      user_id: USER_ID,
      age_years: 32,
      height_centimeters: 168,
      weight_kilograms: 68.5,
      calculation_sex: 'female',
      activity_level: 'moderate',
      goal: 'maintain',
      pregnant: false,
      breastfeeding: false,
    });
  });

  it('deletes only the authenticated current body profile', () => {
    expect(bodyProfilePersistence.toDelete(USER_ID)).toEqual({ user_id: USER_ID });
  });

  it('omits generated timestamps from onboarding and reminder upserts', () => {
    expect(
      onboardingProgressPersistence.toUpsert(USER_ID, {
        safetyCompleted: true,
        weekPreferenceCompleted: false,
        photoTasteCompleted: true,
        bodyProfileCompleted: false,
        reminderCompleted: false,
        updatedAt: 'borrowed-client-time',
      })
    ).toEqual({
      user_id: USER_ID,
      safety_completed: true,
      week_preference_completed: false,
      photo_taste_completed: true,
      body_profile_completed: false,
      reminder_completed: false,
    });

    expect(
      mealReminderPreferencesPersistence.toUpsert(USER_ID, {
        enabled: true,
        leadMinutes: 15,
        updatedAt: 'borrowed-client-time',
      })
    ).toEqual({ user_id: USER_ID, enabled: true, lead_minutes: 15 });
  });
});

describe('append-only signal persistence', () => {
  it('constructs taste inserts without passing arbitrary recipe content', () => {
    expect(
      tasteSignalPersistence.toInsert(USER_ID, {
        kind: 'photo_selected',
        recipeId: 'spoonacular-1',
        journey: 'now',
        recordedAt: '2026-08-23T12:00:00Z',
        ingredients: ['borrowed'],
        instructions: 'borrowed',
      })
    ).toEqual({
      user_id: USER_ID,
      kind: 'photo_selected',
      recipe_id: 'spoonacular-1',
      journey: 'now',
      recorded_at: '2026-08-23T12:00:00Z',
    });
  });

  it('lets the database generate satiety ownership and record fields', () => {
    expect(mealSatietyPersistence.toInsert({ recipeId: 'bundled-1', level: 'satisfied' })).toEqual({
      recipe_id: 'bundled-1',
      level: 'satisfied',
    });
    expect(() =>
      mealSatietyPersistence.toInsert({
        recipeId: 'bundled-1',
        level: 'satisfied',
        userId: USER_ID,
        id: PLAN_ID,
        recordedAt: '2026-08-23T12:00:00Z',
      })
    ).toThrow();
  });

  it('does not expose update or delete operations for append-only records', () => {
    expect(Object.keys(tasteSignalPersistence)).toEqual(['toInsert']);
    expect(Object.keys(mealSatietyPersistence)).toEqual(['toInsert']);
  });
});

describe('weekly plan persistence', () => {
  it('constructs exact parent and complete child replacement rows', () => {
    const plan = makePlan();
    const bundledCatalog = [
      makeRecipe({ id: 'bundled-1', source: 'tier1', instructions: 'owned instructions' }),
    ];

    expect(weeklyPlanPersistence.toCreation(USER_ID, plan, bundledCatalog)).toMatchObject({
      operation: 'create_weekly_meal_plan',
      parent: {
        week_start: '2026-08-24',
        status: 'draft',
        stated_relaxations: ['time'],
      },
      entries: expect.arrayContaining([
        expect.objectContaining({
          entry_date: '2026-08-24',
          recipe_id: 'bundled-1',
        }),
      ]),
      groceryNeeds: expect.arrayContaining([expect.objectContaining({ ingredient_id: 'egg' })]),
    });

    const replacement = weeklyPlanPersistence.toReplacement(USER_ID, PLAN_ID, plan, bundledCatalog);
    expect(replacement.operation).toBe('replace_weekly_plan_children');
    expect(replacement.deleteExisting).toEqual({ plan_id: PLAN_ID, user_id: USER_ID });
    expect(replacement.entries).toHaveLength(7);
    expect(replacement.entries[0]).toEqual({
      plan_id: PLAN_ID,
      user_id: USER_ID,
      entry_date: '2026-08-24',
      kind: 'recipe',
      recipe_id: 'bundled-1',
      planned_meal_time: '2026-08-24T18:30:00-07:00',
      reason: null,
      stated_relaxations: ['time'],
      portion_servings: null,
      portion_label: null,
      portion_disclaimer: null,
    });
    expect(replacement.groceryNeeds).toEqual([
      {
        plan_id: PLAN_ID,
        user_id: USER_ID,
        ingredient_id: 'egg',
        recipe_ids: ['bundled-1'],
        dates: ['2026-08-24'],
      },
      {
        plan_id: PLAN_ID,
        user_id: USER_ID,
        ingredient_id: 'rice',
        recipe_ids: ['bundled-1'],
        dates: ['2026-08-25'],
      },
    ]);
  });

  it('rejects a durable entry when its recipe is not bundled', () => {
    expect(() =>
      weeklyPlanPersistence.toReplacement(USER_ID, PLAN_ID, makePlan('borrowed-1'), [
        makeRecipe({
          id: 'borrowed-1',
          source: 'tier2',
          title: 'Borrowed title',
          imageUrl: 'https://example.test/borrowed.jpg',
          instructions: 'Borrowed instructions',
        }),
      ])
    ).toThrow('bundled catalog');
  });

  it('rejects a borrowed recipe referenced only by a grocery need', () => {
    const plan = makePlan();
    const borrowedNeedPlan: WeeklyMealPlan = {
      ...plan,
      groceryNeeds: [
        {
          ingredientId: 'egg',
          recipeIds: ['borrowed-need'],
          dates: [DATES[0]],
        },
      ],
    };

    expect(() =>
      weeklyPlanPersistence.toReplacement(USER_ID, PLAN_ID, borrowedNeedPlan, [
        makeRecipe({ id: 'bundled-1', source: 'tier1' }),
        makeRecipe({ id: 'borrowed-need', source: 'tier2' }),
      ])
    ).toThrow('bundled catalog');
  });

  it('rejects a grocery recipe reference absent from concrete plan entries', () => {
    const plan = makePlan();
    const unrelatedBundledNeedPlan: WeeklyMealPlan = {
      ...plan,
      groceryNeeds: [
        {
          ingredientId: 'egg',
          recipeIds: ['bundled-unused'],
          dates: [DATES[0]],
        },
      ],
    };

    expect(() =>
      weeklyPlanPersistence.toReplacement(USER_ID, PLAN_ID, unrelatedBundledNeedPlan, [
        makeRecipe({ id: 'bundled-1', source: 'tier1' }),
        makeRecipe({ id: 'bundled-unused', source: 'tier1' }),
      ])
    ).toThrow('concrete recipe entry');
  });

  it('confirms only the parent status and exposes no child update operation', () => {
    expect(weeklyPlanPersistence.toConfirmation(USER_ID, PLAN_ID)).toEqual({
      filter: { id: PLAN_ID, user_id: USER_ID },
      update: { status: 'confirmed' },
    });
    expect(Object.keys(weeklyPlanPersistence)).toEqual([
      'toCreation',
      'toReplacement',
      'toConfirmation',
    ]);
  });
});
