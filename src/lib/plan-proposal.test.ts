import { describe, expect, it } from 'vitest';

import { ingredient, makePrefs, makeRecipe, pantry } from '@/engine/__fixtures__';
import {
  createPlanProposal,
  describeIngredientReuse,
  describePlanPrepStyle,
  getRepeatedPlanIngredientIds,
} from '@/engine/plan-proposal';
import { buildWeekDays } from '@/lib/plan-week-days';

const ANCHOR_DATE = new Date('2026-08-26T12:00:00');

describe('createPlanProposal', () => {
  it('uses the variety value supplied by the selection that triggered generation', () => {
    const recipes = [
      makeRecipe({ id: 'a', ingredients: [ingredient('rice')] }),
      makeRecipe({ id: 'b', ingredients: [ingredient('beans')] }),
    ];

    const proposal = createPlanProposal({
      recipes,
      pantry: pantry('rice', 'beans'),
      preferences: makePrefs(),
      days: 3,
      weekDays: buildWeekDays('balanced', ANCHOR_DATE),
      prepStyle: 'balanced',
      variety: 'repeats',
      tasteSignals: [],
      bodyProfile: null,
      bodyGoal: null,
    });

    expect(
      proposal.entries.slice(0, 3).map((entry) => (entry.kind === 'recipe' ? entry.recipeId : null))
    ).toEqual(['a', 'a', 'a']);
  });

  it('uses confirmed selections as positive planning tie-breakers', () => {
    const recipes = [
      makeRecipe({ id: 'a', ingredients: [ingredient('rice')] }),
      makeRecipe({ id: 'z', ingredients: [ingredient('rice')] }),
    ];

    const proposal = createPlanProposal({
      recipes,
      pantry: pantry('rice'),
      preferences: makePrefs(),
      days: 3,
      weekDays: buildWeekDays('balanced', ANCHOR_DATE),
      prepStyle: 'balanced',
      variety: 'variety',
      tasteSignals: [{ recipeId: 'z' }],
      bodyProfile: null,
      bodyGoal: null,
    });

    expect(proposal.entries[0]).toMatchObject({ kind: 'recipe', recipeId: 'z' });
  });

  it('maps the chosen preparation style into every planning day', () => {
    expect(buildWeekDays('quick', ANCHOR_DATE)).toHaveLength(7);
    expect(buildWeekDays('quick', ANCHOR_DATE).every((day) => day.selectedLimit === 30)).toBe(true);
    expect(buildWeekDays('batch', ANCHOR_DATE).every((day) => day.selectedLimit === 120)).toBe(
      true
    );
  });
});

describe('plan proposal explanations', () => {
  it('explains each selected preparation style directly', () => {
    expect(describePlanPrepStyle('quick')).toContain('Mostly quick');
    expect(describePlanPrepStyle('batch')).toContain('Batch prep');
    expect(describePlanPrepStyle('balanced')).toContain('A balanced mix');
  });

  it('finds the most repeated ingredients with stable ordering', () => {
    const recipes = [
      makeRecipe({ id: 'a', ingredients: [ingredient('rice'), ingredient('onion')] }),
      makeRecipe({ id: 'b', ingredients: [ingredient('rice'), ingredient('beans')] }),
      makeRecipe({ id: 'c', ingredients: [ingredient('onion'), ingredient('rice')] }),
    ];
    const proposal = createPlanProposal({
      recipes,
      pantry: pantry('rice', 'onion', 'beans'),
      preferences: makePrefs(),
      days: 3,
      weekDays: buildWeekDays('balanced', ANCHOR_DATE),
      prepStyle: 'balanced',
      variety: 'variety',
      tasteSignals: [],
      bodyProfile: null,
      bodyGoal: null,
    });

    expect(getRepeatedPlanIngredientIds(proposal, recipes)).toEqual(['rice', 'onion']);
    expect(describeIngredientReuse(['Rice', 'Onion'])).toBe(
      'Reduced waste: Rice and Onion repeat across meals.'
    );
    expect(describeIngredientReuse([])).toContain('keeps extra ingredients focused');
  });
});
