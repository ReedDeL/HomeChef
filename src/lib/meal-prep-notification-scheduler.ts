import {
  getMealPrepReminder,
  type MealPrepReminderEntry,
  type MealPrepReminderLeadMinutes,
} from '@/lib/meal-prep-reminder';

export interface MealPrepReminderSettings {
  readonly enabled: boolean;
  readonly leadMinutes: MealPrepReminderLeadMinutes;
}

export interface LocalNotificationClient {
  hasPermission: () => Promise<boolean>;
  ensureChannel: () => Promise<void>;
  getIdentifiers: () => string[];
  setIdentifiers: (identifiers: string[]) => void;
  cancel: (identifier: string) => Promise<void>;
  schedule: (notification: {
    readonly title: string;
    readonly body: string;
    readonly triggerAt: Date;
  }) => Promise<string>;
}

export interface MealPrepReminderScheduler {
  clear: () => Promise<void>;
  sync: (
    entries: readonly MealPrepReminderEntry[],
    settings: MealPrepReminderSettings
  ) => Promise<void>;
}

const NOTIFICATION_TITLE = 'Time to start cooking';

export function createMealPrepReminderScheduler(
  client: LocalNotificationClient,
  now: () => Date
): MealPrepReminderScheduler {
  async function clear(): Promise<void> {
    const identifiers = client.getIdentifiers();
    await Promise.all(identifiers.map((identifier) => client.cancel(identifier)));
    client.setIdentifiers([]);
  }

  async function sync(
    entries: readonly MealPrepReminderEntry[],
    settings: MealPrepReminderSettings
  ): Promise<void> {
    if (!settings.enabled) {
      await clear();
      return;
    }
    if (!(await client.hasPermission())) {
      await clear();
      return;
    }

    await client.ensureChannel();
    await clear();

    const identifiers: string[] = [];
    for (const entry of entries) {
      const reminder = getMealPrepReminder(entry, settings.leadMinutes, now());
      if (!reminder) continue;

      try {
        identifiers.push(
          await client.schedule({
            title: NOTIFICATION_TITLE,
            body: `Start ${reminder.recipeTitle} now to eat on time.`,
            triggerAt: reminder.notificationTime,
          })
        );
      } catch (error: unknown) {
        console.warn(`[notifications] Unable to schedule meal-prep entry ${entry.id}`, error);
      }
    }

    client.setIdentifiers(identifiers);
  }

  return { clear, sync };
}
