# Meal-Prep Notification Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add opt-in local start-cooking reminders for future weekly meal-prep plans; one-off decisions never schedule them.

**Architecture:** A dependency-free policy module calculates trigger times. A native local-notifications module owns Expo APIs, while a `.web` sibling is a no-op. Zustand persists only preferences and Settings owns opt-in; only the future weekly-plan save flow invokes scheduling.

**Tech Stack:** Expo 57, React Native 0.86, TypeScript 6 strict, Zustand 5, Vitest 3, `expo-notifications`.

## Global Constraints

- `src/engine/` stays pure and unchanged. Notification code belongs in `src/lib/`.
- Do not add server data, remote push, tokens, credentials, Edge Functions, or environment variables.
- Presets are exactly `0`, `10`, `15`, `30`, `60`; default is disabled with `0`.
- Trigger at `plannedMealTime - max(totalTimeMinutes, selectedLeadMinutes)`, only when future.
- Use named exports, strict types, tokens, and accessible interactive controls.
- Native failures cannot block a future meal-prep save. Web does nothing and never asks browser permission.

---

### Task 1: Add Expo support and pure reminder policy

**Files:**
- Modify: `package.json`, `package-lock.json`, `app.json`
- Create: `src/lib/meal-prep-reminder.ts`
- Test: `src/lib/meal-prep-reminder.test.ts`

**Produces:**

```ts
export const MEAL_PREP_REMINDER_LEAD_MINUTES = [0, 10, 15, 30, 60] as const;
export type MealPrepReminderLeadMinutes =
  (typeof MEAL_PREP_REMINDER_LEAD_MINUTES)[number];
export interface MealPrepReminderEntry {
  readonly id: string;
  readonly recipeId: string;
  readonly recipeTitle: string;
  readonly totalTimeMinutes: number;
  readonly plannedMealTime: Date;
}
export function getMealPrepReminder(
  entry: MealPrepReminderEntry, leadMinutes: MealPrepReminderLeadMinutes, now: Date
): (MealPrepReminderEntry & { readonly notificationTime: Date }) | null;
```

**Consumed by:** Task 2 scheduler and Task 3 preference state.

- [ ] **Step 1: Write the failing test**

```ts
const now = new Date('2026-08-13T17:00:00.000Z');
const entry = { id: 'plan-1', recipeId: 'recipe-1', recipeTitle: 'Tomato pasta', totalTimeMinutes: 30, plannedMealTime: new Date('2026-08-13T19:00:00.000Z') };

it('uses the later of cook duration and selected lead time', () => {
  expect(getMealPrepReminder(entry, 10, now)?.notificationTime).toEqual(new Date('2026-08-13T18:30:00.000Z'));
  expect(getMealPrepReminder({ ...entry, totalTimeMinutes: 15 }, 60, now)?.notificationTime).toEqual(new Date('2026-08-13T18:00:00.000Z'));
});

it('excludes elapsed, invalid, and non-positive-duration entries', () => {
  expect(getMealPrepReminder({ ...entry, plannedMealTime: now }, 0, now)).toBeNull();
  expect(getMealPrepReminder({ ...entry, totalTimeMinutes: 0 }, 0, now)).toBeNull();
  expect(getMealPrepReminder({ ...entry, plannedMealTime: new Date('invalid') }, 0, now)).toBeNull();
});
```

- [ ] **Step 2: Verify red**

Run: `npm test -- src/lib/meal-prep-reminder.test.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the minimum calculation**

```ts
const notificationTime = new Date(
  entry.plannedMealTime.getTime() - Math.max(entry.totalTimeMinutes, leadMinutes) * 60_000
);
return notificationTime > now ? { ...entry, notificationTime } : null;
```

Reject non-finite/non-positive duration and invalid dates before this calculation. Use the explicit interface types and no React, Zustand, storage, or Expo import.

- [ ] **Step 4: Verify green and add the Expo dependency**

Run: `npm test -- src/lib/meal-prep-reminder.test.ts`

Expected: PASS.

Run: `npx expo install expo-notifications`

Add `expo-notifications` to `app.json` plugins. Do not configure icon/color unless its supported plugin requires it; Task 2 creates the Android channel at runtime.

- [ ] **Step 5: Commit Task 1**

Run: `git add package.json package-lock.json app.json src/lib/meal-prep-reminder.ts src/lib/meal-prep-reminder.test.ts && git commit -m "Add meal-prep reminder policy"`

### Task 2: Implement local scheduling

**Files:**
- Create: `src/lib/meal-prep-notifications.ts`, `src/lib/meal-prep-notifications.web.ts`
- Test: `src/lib/meal-prep-notifications.test.ts`
- Modify: `app/_layout.tsx`

**Consumes:** Task 1 types and policy.

**Produces:**

```ts
export interface MealPrepReminderSettings {
  readonly enabled: boolean;
  readonly leadMinutes: MealPrepReminderLeadMinutes;
}
export async function requestMealPrepReminderPermission(): Promise<boolean>;
export async function clearMealPrepReminders(): Promise<void>;
export async function syncMealPrepReminders(entries: readonly MealPrepReminderEntry[], settings: MealPrepReminderSettings): Promise<void>;
export async function configureMealPrepNotifications(): Promise<void>;
```

**Consumed by:** Task 3 and future weekly-plan saves. The weekly plan calls sync only after saving an active plan and calls it with `[]` after plan removal/deactivation.

- [ ] **Step 1: Write failing injected-client tests**

```ts
it('replaces prior notification identifiers with eligible entries', async () => {
  const client = createFakeNotificationClient({ granted: true, identifiers: ['old-id'] });
  await createMealPrepReminderScheduler(client, () => now).sync([entry], { enabled: true, leadMinutes: 0 });
  expect(client.calls).toEqual(['channel:homechef-meal-prep', 'cancel:old-id', 'schedule:Tomato pasta:2026-08-13T18:30:00.000Z']);
});

it('does no client work when disabled', async () => {
  const client = createFakeNotificationClient({ granted: false, identifiers: ['old-id'] });
  await createMealPrepReminderScheduler(client, () => now).sync([entry], { enabled: false, leadMinutes: 0 });
  expect(client.calls).toEqual([]);
});
```

Also assert that an empty enabled sync cancels existing identifiers; denied permission clears them; content has only generic copy plus recipe title, never pantry, allergy, dietary, or entry-id data.

- [ ] **Step 2: Verify red**

Run: `npm test -- src/lib/meal-prep-notifications.test.ts`

Expected: FAIL because the scheduler factory does not exist.

- [ ] **Step 3: Implement native and web adapters**

Define a `LocalNotificationClient` with permission status, Android channel creation, identifier read/write, cancellation, and date scheduling. Export `createMealPrepReminderScheduler(client, now)` for the tests. Its sync returns before client work when disabled; on denied permission clears saved identifiers; otherwise creates `homechef-meal-prep`, cancels old IDs, schedules each valid Task 1 result, and saves only returned IDs. Catch each scheduling failure, warn with entry ID, then continue.

Bind the native client to `expo-notifications` and `@/lib/storage`, with content `{ title: 'Time to start cooking', body: \`Start ${entry.recipeTitle} now to eat on time.\` }`. `configureMealPrepNotifications` uses alert, default sound, and no badge foreground behavior. The web module exports the same API, returns false for permission, and never reads browser APIs.

- [ ] **Step 4: Verify green and configure app launch**

Run: `npm test -- src/lib/meal-prep-notifications.test.ts`

Expected: PASS for disabled, replacement, denial, empty-sync, and content tests.

Add a root-layout effect calling `configureMealPrepNotifications()`; catch failure with `console.warn('[notifications] Unable to configure', error)`. It must never request permission or sync reminders.

- [ ] **Step 5: Commit Task 2**

Run: `git add app/_layout.tsx src/lib/meal-prep-notifications.ts src/lib/meal-prep-notifications.web.ts src/lib/meal-prep-notifications.test.ts && git commit -m "Add local meal-prep notifications"`

### Task 3: Persist preferences and add Settings controls

**Files:**
- Modify: `src/store/kitchen.ts`, `src/store/kitchen.test.ts`, `app/settings.tsx`

**Consumes:** Task 1 preset union/constant and Task 2 permission/clear methods.

**Produces:**

```ts
mealPrepRemindersEnabled: boolean;
mealPrepReminderLeadMinutes: MealPrepReminderLeadMinutes;
setMealPrepRemindersEnabled: (enabled: boolean) => void;
setMealPrepReminderLeadMinutes: (minutes: MealPrepReminderLeadMinutes) => void;
```

- [ ] **Step 1: Write failing store tests**

```ts
it('defaults meal-prep reminders to off at cook-start time', () => {
  expect(useKitchenStore.getState().mealPrepRemindersEnabled).toBe(false);
  expect(useKitchenStore.getState().mealPrepReminderLeadMinutes).toBe(0);
});

it('restores notification defaults on reset', () => {
  useKitchenStore.getState().setMealPrepRemindersEnabled(true);
  useKitchenStore.getState().setMealPrepReminderLeadMinutes(30);
  useKitchenStore.getState().reset();
  expect(useKitchenStore.getState().mealPrepRemindersEnabled).toBe(false);
  expect(useKitchenStore.getState().mealPrepReminderLeadMinutes).toBe(0);
});
```

- [ ] **Step 2: Verify red**

Run: `npm test -- src/store/kitchen.test.ts`

Expected: FAIL because notification fields and actions are absent.

- [ ] **Step 3: Implement state and UI**

Add state/actions to `KitchenState`, default false/0, and restore both in `reset`; the lead setter uses only Task 1’s union. Add **Meal-prep reminders** before About in Settings using an accessible `Switch` whose label/hint says it applies only to future weekly meal-prep plans.

On enable, request permission and save true only if granted. On denial, save false, clear reminders, and call `Alert.alert('Reminders are off', 'You can enable notifications for HomeChef in your device settings.')`. On disable, save false first, clear asynchronously, and warn on a clear failure. When enabled, use existing `Chip` controls in an accessible radiogroup labelled `At cook time`, `10 min early`, `15 min early`, `30 min early`, and `60 min early`. Do not gather meal time, recipes, weekdays, or call sync in Settings.

- [ ] **Step 4: Verify green**

Run: `npm test -- src/store/kitchen.test.ts && npm run typecheck`

Expected: PASS with new default/reset tests and no strict type error.

- [ ] **Step 5: Commit Task 3**

Run: `git add app/settings.tsx src/store/kitchen.ts src/store/kitchen.test.ts && git commit -m "Add meal-prep reminder settings"`

### Task 4: Verify complete scope

**Files:** Verify all Task 1–3 paths; no new public API.

- [ ] **Step 1: Run focused tests**

Run: `npm test -- src/lib/meal-prep-reminder.test.ts src/lib/meal-prep-notifications.test.ts src/store/kitchen.test.ts`

Expected: PASS.

- [ ] **Step 2: Run full checks**

Run: `npm run check`

Expected: PASS for lint, strict typecheck, all Vitest tests, and Prettier.

- [ ] **Step 3: Inspect and commit verified task files only**

Run: `git diff --check && git status --short`

Expected: no whitespace error and no unrelated user change in the task commit.

Run: `git add package.json package-lock.json app.json app/_layout.tsx app/settings.tsx src/store/kitchen.ts src/store/kitchen.test.ts src/lib/meal-prep-reminder.ts src/lib/meal-prep-reminder.test.ts src/lib/meal-prep-notifications.ts src/lib/meal-prep-notifications.web.ts src/lib/meal-prep-notifications.test.ts && git commit -m "Complete meal-prep notification foundation"`

## Plan Self-Review

- **Spec coverage:** Tasks 1–3 cover dependency/configuration, policy, permission, local identifier lifecycle, Android/foreground behavior, web no-op, safe content, persisted opt-in, and presets. Task 4 runs all checks.
- **Placeholder scan:** Every task names files, public types, test cases, commands, and commit scope.
- **Type consistency:** Task 1 entries/presets feed Task 2; Task 2 settings accepts Task 3 state when the future weekly plan calls sync.
