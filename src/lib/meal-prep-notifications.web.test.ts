import { describe, expect, it } from 'vitest';

import {
  getMealPrepReminderPermission,
  requestMealPrepReminderPermission,
  syncMealPrepReminders,
} from '@/lib/meal-prep-notifications.web';

describe('web meal-prep notification fallback', () => {
  it('reports unsupported without asking for browser permission', async () => {
    expect(await getMealPrepReminderPermission()).toBe('unsupported');
    expect(await requestMealPrepReminderPermission()).toBe(false);
  });

  it('does not schedule or throw on the web', async () => {
    await expect(
      syncMealPrepReminders([], { enabled: true, leadMinutes: 60 })
    ).resolves.toBeUndefined();
  });
});
