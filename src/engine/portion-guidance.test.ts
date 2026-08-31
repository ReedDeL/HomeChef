import { describe, expect, it } from 'vitest';
import type { BodyProfile } from '@/contracts/meal-journeys';
import { makeBodyProfile, makeRecipe } from '@/engine/__fixtures__';
import { getGoalBasedServingBaseline, getPortionGuidance } from '@/engine/portion-guidance';

const nutritionReadyRecipe = makeRecipe({
  baseServings: 4,
  energyKcalPerServing: 500,
  nutritionConfidence: 'high',
});

const eligibleProfile = makeBodyProfile({
  ageYears: 30,
  heightCentimeters: 160,
  weightKilograms: 60,
  calculationSex: 'female',
  activityLevel: 'sedentary',
});

describe('getGoalBasedServingBaseline', () => {
  it.each([
    ['lose', makeBodyProfile({ ageYears: 17, goal: 'lose' }), 0.9],
    ['gain', makeBodyProfile({ heightCentimeters: Number.NaN, goal: 'gain' }), 1.1],
    ['maintain', makeBodyProfile({ weightKilograms: 0, goal: 'maintain' }), 1],
  ] as const)(
    'retains the valid %s goal when another profile field is invalid',
    (_goal, bodyProfile, baseline) => {
      expect(getGoalBasedServingBaseline(bodyProfile)).toBe(baseline);
    }
  );

  it.each([
    ['an absent profile', null],
    ['an unusable goal', { ...makeBodyProfile(), goal: 'unsupported' } as unknown as BodyProfile],
  ])('uses maintain for %s', (_case, bodyProfile) => {
    expect(getGoalBasedServingBaseline(bodyProfile)).toBe(1);
  });
});

describe('getPortionGuidance', () => {
  it.each([
    ['lose', 0.75],
    ['maintain', 1],
    ['gain', 1.25],
  ] as const)('applies the %s energy goal adjustment', (goal, servings) => {
    expect(
      getPortionGuidance({
        recipe: nutritionReadyRecipe,
        bodyProfile: { ...eligibleProfile, goal },
        satietyLevel: 'satisfied',
      })?.servings
    ).toBe(servings);
  });

  it.each([
    ['sedentary', 0.75],
    ['light', 1],
    ['moderate', 1],
    ['active', 1.25],
    ['very_active', 1.25],
  ] as const)('applies the %s activity factor', (activityLevel, servings) => {
    expect(
      getPortionGuidance({
        recipe: { ...nutritionReadyRecipe, energyKcalPerServing: 600 },
        bodyProfile: { ...eligibleProfile, activityLevel, goal: 'maintain' },
        satietyLevel: 'satisfied',
      })?.servings
    ).toBe(servings);
  });

  it('converts one third of target daily energy into servings', () => {
    expect(
      getPortionGuidance({
        recipe: { ...nutritionReadyRecipe, energyKcalPerServing: 400 },
        bodyProfile: { ...eligibleProfile, goal: 'maintain' },
        satietyLevel: 'satisfied',
      })?.servings
    ).toBe(1.25);
  });

  it('applies the male resting-energy offset', () => {
    expect(
      getPortionGuidance({
        recipe: nutritionReadyRecipe,
        bodyProfile: { ...eligibleProfile, calculationSex: 'male', goal: 'maintain' },
        satietyLevel: 'satisfied',
      })?.servings
    ).toBe(1.25);
  });

  it('does not use base servings in the runtime calculation', () => {
    const input = {
      bodyProfile: eligibleProfile,
      satietyLevel: 'satisfied' as const,
    };

    expect(
      getPortionGuidance({
        ...input,
        recipe: { ...nutritionReadyRecipe, baseServings: 1 },
      })
    ).toEqual(
      getPortionGuidance({
        ...input,
        recipe: { ...nutritionReadyRecipe, baseServings: 12 },
      })
    );
  });

  it.each([
    ['still_hungry', 1.25],
    ['satisfied', 1],
    ['too_full', 0.75],
  ] as const)('applies the %s satiety adjustment', (satietyLevel, servings) => {
    expect(
      getPortionGuidance({
        recipe: nutritionReadyRecipe,
        bodyProfile: eligibleProfile,
        satietyLevel,
      })?.servings
    ).toBe(servings);
  });

  it.each([
    ['an underage profile', makeBodyProfile({ ageYears: 17, goal: 'gain' })],
    ['a pregnant profile', makeBodyProfile({ pregnant: true, goal: 'gain' })],
    ['a breastfeeding profile', makeBodyProfile({ breastfeeding: true, goal: 'gain' })],
    ['a missing profile', null],
  ] as const)('uses fallback guidance for %s', (_case, bodyProfile) => {
    expect(
      getPortionGuidance({
        recipe: { ...nutritionReadyRecipe, energyKcalPerServing: 100 },
        bodyProfile,
        satietyLevel: 'satisfied',
      })?.servings
    ).toBe(1);
  });

  it('uses the valid profile goal and satiety level for energy-ineligible guidance', () => {
    expect(
      getPortionGuidance({
        recipe: { ...nutritionReadyRecipe, energyKcalPerServing: 100 },
        bodyProfile: makeBodyProfile({ pregnant: true, goal: 'gain' }),
        satietyLevel: 'still_hungry',
      })?.servings
    ).toBe(1.25);
  });

  it('treats missing satiety history as a neutral adjustment', () => {
    expect(
      getPortionGuidance({
        recipe: nutritionReadyRecipe,
        bodyProfile: eligibleProfile,
        satietyLevel: null,
      })
    ).toEqual(
      getPortionGuidance({
        recipe: nutritionReadyRecipe,
        bodyProfile: eligibleProfile,
        satietyLevel: 'satisfied',
      })
    );
  });

  it('keeps a non-finite body profile energy-ineligible', () => {
    expect(
      getPortionGuidance({
        recipe: { ...nutritionReadyRecipe, energyKcalPerServing: 100 },
        bodyProfile: makeBodyProfile({ heightCentimeters: Number.NaN, goal: 'gain' }),
        satietyLevel: 'satisfied',
      })?.servings
    ).toBe(1);
  });

  it.each(['low', 'unavailable'] as const)(
    'returns null for %s nutrition confidence without removing the recipe',
    (nutritionConfidence) => {
      expect(
        getPortionGuidance({
          recipe: { ...nutritionReadyRecipe, nutritionConfidence },
          bodyProfile: eligibleProfile,
          satietyLevel: 'satisfied',
        })
      ).toBeNull();
    }
  );

  it('allows medium-confidence nutrition to produce guidance', () => {
    expect(
      getPortionGuidance({
        recipe: { ...nutritionReadyRecipe, nutritionConfidence: 'medium' },
        bodyProfile: eligibleProfile,
        satietyLevel: 'satisfied',
      })
    ).toEqual({
      servings: 1,
      label: 'Start with 1 serving',
      disclaimer: 'Estimate only—adjust to your hunger.',
    });
  });

  it.each([null, 0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'returns null for unusable per-serving energy %s',
    (energyKcalPerServing) => {
      expect(
        getPortionGuidance({
          recipe: { ...nutritionReadyRecipe, energyKcalPerServing },
          bodyProfile: eligibleProfile,
          satietyLevel: 'satisfied',
        })
      ).toBeNull();
    }
  );

  it('rounds to a quarter serving and clamps the lower and upper bounds', () => {
    const input = {
      bodyProfile: eligibleProfile,
      satietyLevel: 'satisfied' as const,
    };

    expect(
      getPortionGuidance({
        ...input,
        recipe: { ...nutritionReadyRecipe, energyKcalPerServing: 1_000 },
      })?.servings
    ).toBe(0.75);
    expect(
      getPortionGuidance({
        ...input,
        recipe: { ...nutritionReadyRecipe, energyKcalPerServing: 300 },
      })?.servings
    ).toBe(1.5);
  });

  it('returns only the simple label and disclaimer', () => {
    const guidance = getPortionGuidance({
      recipe: nutritionReadyRecipe,
      bodyProfile: eligibleProfile,
      satietyLevel: 'satisfied',
    });

    expect(guidance).toEqual({
      servings: 1,
      label: 'Start with 1 serving',
      disclaimer: 'Estimate only—adjust to your hunger.',
    });
    expect(Object.keys(guidance ?? {})).toEqual(['servings', 'label', 'disclaimer']);
  });

  it('supports goal-only onboarding when no full body profile is available', () => {
    expect(
      getPortionGuidance({
        recipe: nutritionReadyRecipe,
        bodyProfile: null,
        bodyGoal: 'lose',
        satietyLevel: null,
      })
    ).toMatchObject({ servings: 1, label: 'Start with 1 serving' });
  });

  it('uses optional height and weight without fabricating a full body profile', () => {
    expect(
      getPortionGuidance({
        recipe: nutritionReadyRecipe,
        bodyProfile: null,
        bodyGoal: 'maintain',
        bodyMetrics: { heightCentimeters: 120, weightKilograms: 35 },
        satietyLevel: null,
      })?.servings
    ).toBe(0.75);
    expect(
      getPortionGuidance({
        recipe: nutritionReadyRecipe,
        bodyProfile: null,
        bodyGoal: 'maintain',
        bodyMetrics: { heightCentimeters: 230, weightKilograms: 300 },
        satietyLevel: null,
      })?.servings
    ).toBe(1.25);
  });

  it('ignores incomplete or invalid optional body metrics', () => {
    expect(
      getPortionGuidance({
        recipe: nutritionReadyRecipe,
        bodyProfile: null,
        bodyGoal: 'maintain',
        bodyMetrics: { heightCentimeters: null, weightKilograms: 70 },
        satietyLevel: null,
      })
    ).toEqual(
      getPortionGuidance({
        recipe: nutritionReadyRecipe,
        bodyProfile: null,
        bodyGoal: 'maintain',
        bodyMetrics: null,
        satietyLevel: null,
      })
    );
  });
});
