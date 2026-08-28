import { describe, expect, it } from 'vitest';
import type { WeeklyMealPlan } from '@/contracts/meal-journeys';
import {
  derivePlanLinkedGroceryNeeds,
  getPlanGroceryNeedMealNames,
  recomputePlanGroceryNeeds,
  type PlanGroceryEntry,
} from '@/engine/plan-grocery-needs';
import { ingredient, makeRecipe, pantry } from '@/engine/__fixtures__';

describe('derivePlanLinkedGroceryNeeds', () => {
  it('deduplicates canonical ingredients and aggregates stable recipe and date references', () => {
    const entries: PlanGroceryEntry[] = [
      {
        date: '2026-08-26',
        recipe: makeRecipe({
          id: 'recipe-b',
          ingredients: [ingredient('salt'), ingredient('chickpea'), ingredient('chickpea')],
        }),
      },
      {
        date: '2026-08-24',
        recipe: makeRecipe({
          id: 'recipe-a',
          ingredients: [ingredient('chickpea'), ingredient('carrot')],
        }),
      },
      {
        date: '2026-08-24',
        recipe: makeRecipe({
          id: 'recipe-a',
          ingredients: [ingredient('chickpea'), ingredient('carrot')],
        }),
      },
    ];

    expect(derivePlanLinkedGroceryNeeds(entries, pantry('salt'), 12)).toEqual([
      {
        ingredientId: 'carrot',
        recipeIds: ['recipe-a'],
        dates: ['2026-08-24'],
      },
      {
        ingredientId: 'chickpea',
        recipeIds: ['recipe-a', 'recipe-b'],
        dates: ['2026-08-24', '2026-08-26'],
      },
    ]);
  });

  it('reports every missing ingredient on every concrete entry', () => {
    const entries: PlanGroceryEntry[] = [
      {
        date: '2026-08-24',
        recipe: makeRecipe({
          id: 'recipe-a',
          ingredients: [ingredient('lentil'), ingredient('onion'), ingredient('salt')],
        }),
      },
      {
        date: '2026-08-25',
        recipe: makeRecipe({
          id: 'recipe-b',
          ingredients: [ingredient('garlic'), ingredient('onion')],
        }),
      },
    ];

    const needs = derivePlanLinkedGroceryNeeds(entries, pantry('salt'), 12);

    expect(needs.map((need) => need.ingredientId)).toEqual(['garlic', 'lentil', 'onion']);
    expect(needs).toHaveLength(3);
  });

  it('allows exactly the cap and never silently truncates an overflowing union', () => {
    const twelve = Array.from({ length: 12 }, (_, index) => ingredient(`ingredient-${index}`));
    const thirteen = [...twelve, ingredient('ingredient-12')];

    expect(
      derivePlanLinkedGroceryNeeds(
        [{ date: '2026-08-24', recipe: makeRecipe({ ingredients: twelve }) }],
        pantry(),
        12
      )
    ).toHaveLength(12);
    expect(() =>
      derivePlanLinkedGroceryNeeds(
        [{ date: '2026-08-24', recipe: makeRecipe({ ingredients: thirteen }) }],
        pantry(),
        12
      )
    ).toThrow(RangeError);
  });

  it.each([-1, 13, 1.5, Number.NaN])('rejects an invalid grocery limit %s', (limit) => {
    expect(() => derivePlanLinkedGroceryNeeds([], pantry(), limit)).toThrow(RangeError);
  });

  it('supports a zero limit only when the plan has no missing ingredients', () => {
    expect(derivePlanLinkedGroceryNeeds([], pantry(), 0)).toEqual([]);
    expect(() =>
      derivePlanLinkedGroceryNeeds(
        [{ date: '2026-08-24', recipe: makeRecipe({ ingredients: [ingredient('onion')] }) }],
        pantry(),
        0
      )
    ).toThrow(RangeError);
  });
});

describe('weekly-plan grocery presentation and pantry updates', () => {
  it('projects the actual meal names for a grouped ingredient need', () => {
    const recipes = [
      makeRecipe({ id: 'recipe-a', title: 'Lemon rice' }),
      makeRecipe({ id: 'recipe-b', title: 'Chickpea stew' }),
    ];

    expect(
      getPlanGroceryNeedMealNames(
        { ingredientId: 'onion', recipeIds: ['recipe-b', 'recipe-a'], dates: ['2026-08-24'] },
        recipes
      )
    ).toEqual(['Chickpea stew', 'Lemon rice']);
  });

  it('recomputes needs after purchased ingredients enter the pantry while preserving the plan', () => {
    const recipes = [
      makeRecipe({
        id: 'recipe-a',
        ingredients: [ingredient('rice'), ingredient('onion')],
      }),
    ];
    const plan: WeeklyMealPlan = {
      weekStart: '2026-08-24',
      entries: [
        {
          kind: 'recipe',
          date: '2026-08-24',
          recipeId: 'recipe-a',
          plannedMealTime: '2026-08-24T18:30:00-04:00',
          statedRelaxations: [],
          portionGuidance: null,
        },
        ...Array.from({ length: 6 }, (_, index) => ({
          kind: 'day_of_decision' as const,
          date: `2026-08-${String(25 + index).padStart(2, '0')}`,
          reason: 'not_planned' as const,
        })),
      ],
      status: 'confirmed',
      groceryNeeds: [
        { ingredientId: 'onion', recipeIds: ['recipe-a'], dates: ['2026-08-24'] },
        { ingredientId: 'rice', recipeIds: ['recipe-a'], dates: ['2026-08-24'] },
      ],
      statedRelaxations: [],
    };

    const updated = recomputePlanGroceryNeeds(plan, recipes, pantry('rice', 'onion'));
    expect(updated.status).toBe('confirmed');
    expect(updated.entries).toEqual(plan.entries);
    expect(updated.groceryNeeds).toEqual([]);
  });
});
