import { describe, expect, it } from 'vitest';

import {
  createMealPrepReminderScheduler,
  type LocalNotificationClient,
} from '@/lib/meal-prep-notification-scheduler';

const NOW = new Date('2026-08-13T17:00:00.000Z');
const ENTRY = {
  id: 'plan-1',
  recipeId: 'recipe-1',
  recipeTitle: 'Tomato pasta',
  totalTimeMinutes: 30,
  plannedMealTime: new Date('2026-08-13T19:00:00.000Z'),
};

function createClient(granted: boolean, identifiers: string[]) {
  const calls: string[] = [];
  const client: LocalNotificationClient = {
    hasPermission: async () => granted,
    ensureChannel: async () => void calls.push('channel:homechef-meal-prep'),
    getIdentifiers: () => identifiers,
    setIdentifiers: (next) => {
      identifiers = next;
    },
    cancel: async (identifier) => void calls.push(`cancel:${identifier}`),
    schedule: async ({ title, body, triggerAt }) => {
      calls.push(`schedule:${title}:${body}:${triggerAt.toISOString()}`);
      return 'new-id';
    },
  };

  return { client, calls, identifiers: () => identifiers };
}

describe('createMealPrepReminderScheduler', () => {
  it('replaces previous identifiers with eligible reminders', async () => {
    const fake = createClient(true, ['old-id']);
    const scheduler = createMealPrepReminderScheduler(fake.client, () => NOW);

    await scheduler.sync([ENTRY], { enabled: true, leadMinutes: 0 });

    expect(fake.calls).toEqual([
      'channel:homechef-meal-prep',
      'cancel:old-id',
      'schedule:Time to start cooking:Start Tomato pasta now to eat on time.:2026-08-13T18:30:00.000Z',
    ]);
    expect(fake.identifiers()).toEqual(['new-id']);
  });

  it('clears existing reminders when the setting is disabled', async () => {
    const fake = createClient(false, ['old-id']);
    const scheduler = createMealPrepReminderScheduler(fake.client, () => NOW);

    await scheduler.sync([ENTRY], { enabled: false, leadMinutes: 0 });

    expect(fake.calls).toEqual(['cancel:old-id']);
    expect(fake.identifiers()).toEqual([]);
  });

  it('clears existing identifiers when permission is unavailable', async () => {
    const fake = createClient(false, ['old-id']);
    const scheduler = createMealPrepReminderScheduler(fake.client, () => NOW);

    await scheduler.sync([ENTRY], { enabled: true, leadMinutes: 0 });

    expect(fake.calls).toEqual(['cancel:old-id']);
    expect(fake.identifiers()).toEqual([]);
  });

  it('clears scheduled identifiers when an active plan has no entries', async () => {
    const fake = createClient(true, ['old-id']);
    const scheduler = createMealPrepReminderScheduler(fake.client, () => NOW);

    await scheduler.sync([], { enabled: true, leadMinutes: 0 });

    expect(fake.calls).toEqual(['channel:homechef-meal-prep', 'cancel:old-id']);
    expect(fake.identifiers()).toEqual([]);
  });
});
