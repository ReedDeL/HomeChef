import type { MealPrepReminderSettings } from '@/lib/meal-prep-notification-scheduler';
import type { MealPrepReminderEntry } from '@/lib/meal-prep-reminder';

/** Browser notifications are deliberately outside the local mobile reminder scope. */
export async function requestMealPrepReminderPermission(): Promise<boolean> {
  return false;
}

export async function clearMealPrepReminders(): Promise<void> {}

export async function syncMealPrepReminders(
  entries: readonly MealPrepReminderEntry[],
  settings: MealPrepReminderSettings
): Promise<void> {
  void entries;
  void settings;
}

export async function configureMealPrepNotifications(): Promise<void> {}
