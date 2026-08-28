import type { WeeklyMealPlan } from '@/contracts/meal-journeys';
import type { Recipe } from '@/engine/types';

import {
  getMealPrepReminder,
  type MealPrepReminderEntry,
  type MealPrepReminderLeadMinutes,
  type ScheduledMealPrepReminder,
} from '@/lib/meal-prep-reminder';

export function toMealPrepReminderEntries(
  plan: WeeklyMealPlan | null,
  catalog: readonly Recipe[]
): MealPrepReminderEntry[] {
  if (plan?.status !== 'confirmed') return [];

  return plan.entries.flatMap((entry) => {
    if (entry.kind !== 'recipe') return [];
    const recipe = catalog.find((candidate) => candidate.id === entry.recipeId);
    return recipe
      ? [
          {
            id: entry.recipeId + ':' + entry.date,
            recipeId: recipe.id,
            recipeTitle: recipe.title,
            totalTimeMinutes: recipe.totalTimeMinutes,
            plannedMealTime: new Date(entry.plannedMealTime),
          },
        ]
      : [];
  });
}

export function getUpcomingMealPrepReminders(
  entries: readonly MealPrepReminderEntry[],
  leadMinutes: MealPrepReminderLeadMinutes,
  now: Date
): ScheduledMealPrepReminder[] {
  return entries
    .map((entry) => getMealPrepReminder(entry, leadMinutes, now))
    .filter((reminder): reminder is ScheduledMealPrepReminder => reminder !== null)
    .sort(
      (left, right) =>
        left.notificationTime.getTime() - right.notificationTime.getTime() ||
        left.id.localeCompare(right.id)
    );
}
