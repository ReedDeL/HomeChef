import { describe, expect, it } from 'vitest';
import { derivePlanLinkedGroceryNeeds, type PlanGroceryEntry } from '@/engine/plan-grocery-needs';
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
