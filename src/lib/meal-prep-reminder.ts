export const MEAL_PREP_REMINDER_LEAD_MINUTES = [0, 10, 15, 30, 60] as const;

export type MealPrepReminderLeadMinutes = (typeof MEAL_PREP_REMINDER_LEAD_MINUTES)[number];

export interface MealPrepReminderEntry {
  readonly id: string;
  readonly recipeId: string;
  readonly recipeTitle: string;
  readonly totalTimeMinutes: number;
  readonly plannedMealTime: Date;
}

export interface ScheduledMealPrepReminder extends MealPrepReminderEntry {
  readonly notificationTime: Date;
}

export function getMealPrepReminder(
  entry: MealPrepReminderEntry,
  leadMinutes: MealPrepReminderLeadMinutes,
  now: Date
): ScheduledMealPrepReminder | null {
  if (!Number.isFinite(entry.totalTimeMinutes) || entry.totalTimeMinutes <= 0) return null;
  if (Number.isNaN(entry.plannedMealTime.getTime())) return null;

  const notificationTime = new Date(
    entry.plannedMealTime.getTime() - Math.max(entry.totalTimeMinutes, leadMinutes) * 60_000
  );

  if (notificationTime <= now) return null;

  return {
    ...entry,
    notificationTime,
  } satisfies ScheduledMealPrepReminder;
}
