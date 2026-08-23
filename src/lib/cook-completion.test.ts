import { describe, expect, it } from 'vitest';

import {
  cookCompletionReducer,
  INITIAL_COOK_COMPLETION,
  planCookCompletionExit,
} from '@/lib/cook-completion';

describe('cook completion', () => {
  it('uses the latest negative verdict when exiting after revising a positive verdict', () => {
    let completion = cookCompletionReducer(INITIAL_COOK_COMPLETION, {
      type: 'finish_cooking',
    });
    completion = cookCompletionReducer(completion, {
      type: 'select_verdict',
      verdict: 'loved',
    });
    completion = cookCompletionReducer(completion, { type: 'back' });
    completion = cookCompletionReducer(completion, {
      type: 'select_verdict',
      verdict: 'not_great',
    });

    expect(planCookCompletionExit(completion, ['egg', 'salt'])).toEqual({
      pantryIngredientIdsToRemove: [],
    });
  });

  it('removes the recipe ingredients when the final verdict is positive', () => {
    const verdictStep = cookCompletionReducer(INITIAL_COOK_COMPLETION, {
      type: 'finish_cooking',
    });
    const completion = cookCompletionReducer(verdictStep, {
      type: 'select_verdict',
      verdict: 'loved',
    });

    expect(planCookCompletionExit(completion, ['egg', 'salt'])).toEqual({
      pantryIngredientIdsToRemove: ['egg', 'salt'],
    });
  });
});
