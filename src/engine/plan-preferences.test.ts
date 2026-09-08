import { describe, expect, it } from 'vitest';

import type { WeeklyMealPlan } from '@/contracts/meal-journeys';
import { applyPlanPreferences } from '@/engine/plan-preferences';
import { ingredient, makeRecipe, pantry } from '@/engine/__fixtures__';

const dates = [
  '2026-08-24',
  '2026-08-25',
  '2026-08-26',
  '2026-08-27',
  '2026-08-28',
  '2026-08-29',
  '2026-08-30',
];

function plan(): WeeklyMealPlan {
  return {
    weekStart: dates[0]!,
    dayCount: 7,
    mealSlots: ['dinner'],
    limitedVariety: false,
    entries: dates.map((date, index) => ({
      kind: 'recipe' as const,
      date,
      mealSlot: 'dinner' as const,
      recipeId: 'recipe-' + (index + 1),
      plannedMealTime: date + 'T18:30:00-07:00',
      statedRelaxations: [],
      portionGuidance: null,
    })),
    status: 'draft',
    groceryNeeds: [],
    statedRelaxations: [],
  };
}

const recipes = dates.map((_, index) =>
  makeRecipe({
    id: 'recipe-' + (index + 1),
    ingredients: [ingredient('ingredient-' + (index + 1))],
  })
);

describe('applyPlanPreferences', () => {
  it('trims the plan to the selected number of days and updates grocery needs', () => {
    const result = applyPlanPreferences(plan(), 3, 'variety', recipes, pantry());
    expect(result.dayCount).toBe(3);
    expect(result.entries).toHaveLength(3);
    expect(result.entries.every((entry) => entry.kind === 'recipe')).toBe(true);
    expect(result.groceryNeeds).toHaveLength(3);
    expect(
      result.groceryNeeds.every((need) => need.dates.every((date) => dates.indexOf(date) < 3))
    ).toBe(true);
  });

  it('preserves existing recipes and updates grocery needs for the active days', () => {
    const result = applyPlanPreferences(plan(), 5, 'repeats', recipes, pantry());
    expect(result.dayCount).toBe(5);
    expect(result.entries).toHaveLength(5);
    expect(
      result.entries.map((entry) => (entry.kind === 'recipe' ? entry.recipeId : null))
    ).toEqual(['recipe-1', 'recipe-2', 'recipe-3', 'recipe-4', 'recipe-5']);
    expect(result.groceryNeeds).toHaveLength(5);
  });
});
