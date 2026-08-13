import type { IngredientId } from '@/engine/types';

export type CompletionStep = 'cooking' | 'verdict' | 'satiety';
export type MealVerdict = 'loved' | 'not_great';

export interface CookCompletionState {
  step: CompletionStep;
  verdict: MealVerdict | null;
}

type CookCompletionAction =
  { type: 'finish_cooking' } | { type: 'select_verdict'; verdict: MealVerdict } | { type: 'back' };

export const INITIAL_COOK_COMPLETION: CookCompletionState = {
  step: 'cooking',
  verdict: null,
};

export function cookCompletionReducer(
  state: CookCompletionState,
  action: CookCompletionAction
): CookCompletionState {
  switch (action.type) {
    case 'finish_cooking':
      return { ...state, step: 'verdict' };
    case 'select_verdict':
      return { step: 'satiety', verdict: action.verdict };
    case 'back':
      if (state.step === 'satiety') return { ...state, step: 'verdict' };
      if (state.step === 'verdict') return { ...state, step: 'cooking' };
      return state;
  }
}

export function planCookCompletionExit(
  state: CookCompletionState,
  recipeIngredientIds: readonly IngredientId[]
): { pantryIngredientIdsToRemove: IngredientId[] } {
  return {
    pantryIngredientIdsToRemove: state.verdict === 'loved' ? [...recipeIngredientIds] : [],
  };
}
