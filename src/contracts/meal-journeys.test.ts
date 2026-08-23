import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  bodyProfileSchema,
  continuousOnboardingProgressSchema,
  continuousOnboardingPromptStateSchema,
  dualMealJourneysFixtureSchema,
  mealJourneySchema,
  mealReminderPreferencesSchema,
  mealSatietyInputSchema,
  mealSatietyRecordSchema,
  mealJourneysJsonSchema,
  tasteSignalSchema,
  weeklyMealPlanSchema,
} from '@/contracts/meal-journeys';

const validBodyProfile = {
  ageYears: 32,
  heightCentimeters: 168,
  weightKilograms: 68.5,
  calculationSex: 'female',
  activityLevel: 'moderate',
  goal: 'maintain',
  pregnant: false,
  breastfeeding: false,
};

const recipeEntry = {
  kind: 'recipe',
  date: '2026-08-24',
  recipeId: 'recipe-1',
  plannedMealTime: '2026-08-24T18:30:00-07:00',
  statedRelaxations: ['time'],
  portionGuidance: {
    servings: 1.25,
    label: 'Start with 1.25 servings',
    disclaimer: 'Estimate only—adjust to your hunger.',
  },
};

const weeklyEntries = Array.from({ length: 7 }, (_, index) => {
  const date = `2026-08-${String(24 + index).padStart(2, '0')}`;
  return {
    ...recipeEntry,
    date,
    recipeId: `recipe-${index + 1}`,
    plannedMealTime: `${date}T18:30:00-07:00`,
  };
});

const validWeeklyPlan = {
  weekStart: '2026-08-24',
  entries: weeklyEntries,
  status: 'draft',
  groceryNeeds: [
    {
      ingredientId: 'chickpea',
      recipeIds: ['recipe-1'],
      dates: ['2026-08-24'],
    },
  ],
  statedRelaxations: ['time'],
};

describe('closed domains', () => {
  it('accepts only the two meal journeys', () => {
    expect(mealJourneySchema.parse('now')).toBe('now');
    expect(mealJourneySchema.parse('week')).toBe('week');
    expect(mealJourneySchema.safeParse('browse').success).toBe(false);
  });

  it('rejects unknown object fields', () => {
    expect(bodyProfileSchema.safeParse({ ...validBodyProfile, calories: 2_000 }).success).toBe(
      false
    );
  });
});

describe('bodyProfileSchema', () => {
  it('rejects underage and out-of-bounds body fields', () => {
    expect(bodyProfileSchema.safeParse({ ...validBodyProfile, ageYears: 17 }).success).toBe(false);
    expect(
      bodyProfileSchema.safeParse({ ...validBodyProfile, heightCentimeters: 231 }).success
    ).toBe(false);
    expect(bodyProfileSchema.safeParse({ ...validBodyProfile, weightKilograms: 34 }).success).toBe(
      false
    );
  });

  it('accepts adult profiles that require pregnancy or breastfeeding fallback', () => {
    expect(bodyProfileSchema.safeParse({ ...validBodyProfile, pregnant: true }).success).toBe(true);
    expect(bodyProfileSchema.safeParse({ ...validBodyProfile, breastfeeding: true }).success).toBe(
      true
    );
  });
});

describe('personal signal schemas', () => {
  it('parses a selected-photo taste signal', () => {
    expect(
      tasteSignalSchema.parse({
        kind: 'photo_selected',
        recipeId: 'recipe-1',
        journey: 'now',
        recordedAt: '2026-08-23T12:00:00Z',
      })
    ).toEqual({
      kind: 'photo_selected',
      recipeId: 'recipe-1',
      journey: 'now',
      recordedAt: '2026-08-23T12:00:00Z',
    });
  });

  it('keeps the satiety insert and append-only record contracts separate', () => {
    const input = { recipeId: 'recipe-1', level: 'satisfied' };
    expect(mealSatietyInputSchema.parse(input)).toEqual(input);
    expect(
      mealSatietyInputSchema.safeParse({
        ...input,
        id: '6c35893f-df48-4e7c-9914-c2390b51c040',
      }).success
    ).toBe(false);

    expect(
      mealSatietyRecordSchema.parse({
        ...input,
        id: '6c35893f-df48-4e7c-9914-c2390b51c040',
        userId: '9659c59f-0a9e-45d6-a040-5b161d28771e',
        recordedAt: '2026-08-23T12:00:00Z',
      }).userId
    ).toBe('9659c59f-0a9e-45d6-a040-5b161d28771e');
  });
});

describe('continuous onboarding and reminders', () => {
  const updatedAt = '2026-08-23T12:00:00Z';

  it('parses durable onboarding progress separately from session prompt state', () => {
    const progress = {
      safetyCompleted: true,
      weekPreferenceCompleted: false,
      photoTasteCompleted: false,
      bodyProfileCompleted: false,
      reminderCompleted: false,
      updatedAt,
    };
    const prompt = { shownThisSession: true, activePrompt: 'photo_taste' };

    expect(continuousOnboardingProgressSchema.parse(progress)).toEqual(progress);
    expect(continuousOnboardingPromptStateSchema.parse(prompt)).toEqual(prompt);
    expect(
      continuousOnboardingProgressSchema.safeParse({ ...progress, shownThisSession: true }).success
    ).toBe(false);
  });

  it('rejects an active prompt before the session has shown one', () => {
    expect(
      continuousOnboardingPromptStateSchema.safeParse({
        shownThisSession: false,
        activePrompt: 'safety',
      }).success
    ).toBe(false);
  });

  it.each([0, 10, 15, 30, 60])('accepts reminder lead %i', (leadMinutes) => {
    expect(
      mealReminderPreferencesSchema.safeParse({ enabled: true, leadMinutes, updatedAt }).success
    ).toBe(true);
  });

  it.each([-1, 5, 20, 61])('rejects unsupported reminder lead %i', (leadMinutes) => {
    expect(
      mealReminderPreferencesSchema.safeParse({ enabled: true, leadMinutes, updatedAt }).success
    ).toBe(false);
  });
});

describe('weeklyMealPlanSchema', () => {
  it('accepts exactly seven consecutive dated entries', () => {
    expect(weeklyMealPlanSchema.parse(validWeeklyPlan).entries).toHaveLength(7);
    expect(
      weeklyMealPlanSchema.safeParse({ ...validWeeklyPlan, entries: weeklyEntries.slice(0, 6) })
        .success
    ).toBe(false);
    expect(
      weeklyMealPlanSchema.safeParse({
        ...validWeeklyPlan,
        entries: [...weeklyEntries, { ...weeklyEntries[6], date: '2026-08-31' }],
      }).success
    ).toBe(false);
  });

  it('requires a numeric UTC offset and matching local date', () => {
    const withMealTime = (plannedMealTime: string) => ({
      ...validWeeklyPlan,
      entries: [{ ...weeklyEntries[0], plannedMealTime }, ...weeklyEntries.slice(1)],
    });

    expect(weeklyMealPlanSchema.safeParse(withMealTime('2026-08-24T18:30:00Z')).success).toBe(
      false
    );
    expect(weeklyMealPlanSchema.safeParse(withMealTime('2026-08-25T01:30:00-07:00')).success).toBe(
      false
    );
    expect(weeklyMealPlanSchema.safeParse(withMealTime('2026-08-24T18:30:00-07:00')).success).toBe(
      true
    );
  });

  it('rejects more than 12 unique plan-linked grocery needs', () => {
    const groceryNeeds = Array.from({ length: 13 }, (_, index) => ({
      ingredientId: `ingredient-${index}`,
      recipeIds: ['recipe-1'],
      dates: ['2026-08-24'],
    }));
    expect(weeklyMealPlanSchema.safeParse({ ...validWeeklyPlan, groceryNeeds }).success).toBe(
      false
    );
  });

  it('rejects duplicate canonical ingredient IDs in plan-linked needs', () => {
    const groceryNeeds = [
      validWeeklyPlan.groceryNeeds[0],
      {
        ingredientId: 'chickpea',
        recipeIds: ['recipe-2'],
        dates: ['2026-08-25'],
      },
    ];
    expect(weeklyMealPlanSchema.safeParse({ ...validWeeklyPlan, groceryNeeds }).success).toBe(
      false
    );
  });
});

describe('cross-platform artifacts', () => {
  const sharedPath = (relativePath: string) =>
    fileURLToPath(new URL(`../../shared/${relativePath}`, import.meta.url));

  it('parses the shared acceptance fixture', () => {
    const fixture = JSON.parse(
      readFileSync(sharedPath('fixtures/dual-meal-journeys.json'), 'utf8')
    );
    expect(dualMealJourneysFixtureSchema.parse(fixture)).toEqual(fixture);
  });

  it('keeps checked-in JSON Schema generation stable', () => {
    const checkedIn = readFileSync(sharedPath('contracts/meal-journeys.schema.json'), 'utf8');
    expect(JSON.stringify(JSON.parse(checkedIn))).toBe(JSON.stringify(mealJourneysJsonSchema));
  });
});
