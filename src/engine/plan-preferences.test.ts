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
    entries: dates.map((date, index) => ({
      kind: 'recipe' as const,
      date,
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
  it('keeps the durable seven-date shape while making a three-day choice explicit', () => {
    const result = applyPlanPreferences(plan(), 3, 'variety', recipes, pantry());
    expect(result.entries.slice(0, 3).every((entry) => entry.kind === 'recipe')).toBe(true);
    expect(result.entries.slice(3)).toEqual(
      dates.slice(3).map((date) => ({ kind: 'day_of_decision', date, reason: 'not_planned' }))
    );
    expect(result.groceryNeeds).toHaveLength(3);
    expect(
      result.groceryNeeds.every((need) => need.dates.every((date) => dates.indexOf(date) < 3))
    ).toBe(true);
  });

  it('uses the first safe meal for deterministic comfortable repeats', () => {
    const result = applyPlanPreferences(plan(), 5, 'repeats', recipes, pantry());
    expect(
      result.entries.slice(0, 5).map((entry) => (entry.kind === 'recipe' ? entry.recipeId : null))
    ).toEqual(Array.from({ length: 5 }, () => 'recipe-1'));
    expect(result.groceryNeeds.map((need) => need.ingredientId)).toEqual(['ingredient-1']);
  });
});
