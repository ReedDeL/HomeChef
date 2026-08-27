import { getJSON, setJSON } from '@/lib/storage';
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

const LOCAL_SATIETY_KEY = 'homechef-local-satiety';

export interface LocalMealSatietyRecord {
  recipeId: string;
  level: MealSatietyLevel;
  recordedAt: string;
}

export function recordLocalMealSatiety(recipeId: string, level: MealSatietyLevel): void {
  const current = getJSON<LocalMealSatietyRecord[]>(LOCAL_SATIETY_KEY) ?? [];
  current.push({ recipeId, level, recordedAt: new Date().toISOString() });
  setJSON(LOCAL_SATIETY_KEY, current);
}

export function getLocalMealSatiety(): LocalMealSatietyRecord[] {
  return getJSON<LocalMealSatietyRecord[]>(LOCAL_SATIETY_KEY) ?? [];
}

export function clearLocalMealSatiety(): void {
  setJSON(LOCAL_SATIETY_KEY, []);
}
