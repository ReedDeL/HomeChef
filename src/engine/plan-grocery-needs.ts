import type { PlanLinkedGroceryNeed } from '@/contracts/meal-journeys';
import type { IngredientId, Recipe } from '@/engine/types';

export interface PlanGroceryEntry {
  date: string;
  recipe: Recipe;
}

interface GroceryReferences {
  recipeIds: Set<string>;
  dates: Set<string>;
}

export function derivePlanLinkedGroceryNeeds(
  entries: readonly PlanGroceryEntry[],
  pantry: ReadonlySet<IngredientId>,
  limit: number
): PlanLinkedGroceryNeed[] {
  if (!Number.isInteger(limit) || limit < 0 || limit > 12) {
    throw new RangeError('Grocery need limit must be an integer from 0 through 12');
  }

  const referencesByIngredient = new Map<IngredientId, GroceryReferences>();

  for (const entry of entries) {
    const missingIngredientIds = new Set(
      entry.recipe.ingredients
        .map((recipeIngredient) => recipeIngredient.id)
        .filter((ingredientId) => !pantry.has(ingredientId))
    );

    for (const ingredientId of missingIngredientIds) {
      const references = referencesByIngredient.get(ingredientId) ?? {
        recipeIds: new Set<string>(),
        dates: new Set<string>(),
      };
      references.recipeIds.add(entry.recipe.id);
      references.dates.add(entry.date);
      referencesByIngredient.set(ingredientId, references);
    }
  }

  if (referencesByIngredient.size > limit) {
    throw new RangeError(`Plan requires more than ${limit} grocery needs`);
  }

  return [...referencesByIngredient.entries()]
    .sort(([left], [right]) => compareIds(left, right))
    .map(([ingredientId, references]) => ({
      ingredientId,
      recipeIds: [...references.recipeIds].sort(compareIds),
      dates: [...references.dates].sort(compareIds),
    }));
}

function compareIds(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
