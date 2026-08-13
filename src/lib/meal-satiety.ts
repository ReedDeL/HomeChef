import type { MealSatietyLevel } from '@/types/database';

export const SATIETY_LEVELS = ['still_hungry', 'satisfied', 'too_full'] as const;

export function isMealSatietyLevel(value: unknown): value is MealSatietyLevel {
  return typeof value === 'string' && SATIETY_LEVELS.includes(value as MealSatietyLevel);
}

export function satietyLabel(level: MealSatietyLevel): string {
  const labels: Record<MealSatietyLevel, string> = {
    still_hungry: 'Still hungry',
    satisfied: 'Satisfied',
    too_full: 'Too full',
  };
  return labels[level];
}

export function toMealSatietyInsert(
  userId: string,
  recipeId: string,
  level: MealSatietyLevel
): { user_id: string; recipe_id: string; level: MealSatietyLevel } {
  return { user_id: userId, recipe_id: recipeId, level };
}
