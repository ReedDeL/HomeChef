import * as Notifications from 'expo-notifications';

import {
  createMealPrepReminderScheduler,
  type LocalNotificationClient,
  type MealPrepReminderSettings,
} from '@/lib/meal-prep-notification-scheduler';
import type { MealPrepReminderEntry } from '@/lib/meal-prep-reminder';
import { getJSON, setJSON } from '@/lib/storage';

const CHANNEL_ID = 'homechef-meal-prep';
const SCHEDULED_IDENTIFIERS_KEY = 'homechef-meal-prep-notification-identifiers';

const client: LocalNotificationClient = {
  async hasPermission(): Promise<boolean> {
    return (await Notifications.getPermissionsAsync()).status === 'granted';
  },
  async ensureChannel(): Promise<void> {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Meal-prep reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: 'default',
    });
  },
  getIdentifiers(): string[] {
    return getJSON<string[]>(SCHEDULED_IDENTIFIERS_KEY) ?? [];
  },
  setIdentifiers(identifiers: string[]): void {
    setJSON(SCHEDULED_IDENTIFIERS_KEY, identifiers);
  },
  cancel(identifier: string): Promise<void> {
    return Notifications.cancelScheduledNotificationAsync(identifier);
  },
  schedule({ title, body, triggerAt }): Promise<string> {
    return Notifications.scheduleNotificationAsync({
      content: { title, body, sound: 'default' },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerAt,
        channelId: CHANNEL_ID,
      },
    });
  },
};

const scheduler = createMealPrepReminderScheduler(client, () => new Date());

export async function requestMealPrepReminderPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.status === 'granted') return true;

  return (await Notifications.requestPermissionsAsync()).status === 'granted';
}

export function clearMealPrepReminders(): Promise<void> {
  return scheduler.clear();
}

export function syncMealPrepReminders(
  entries: readonly MealPrepReminderEntry[],
  settings: MealPrepReminderSettings
): Promise<void> {
  return scheduler.sync(entries, settings);
}

export async function configureMealPrepNotifications(): Promise<void> {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}
