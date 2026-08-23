# Meal-Prep Notification Foundation Plan

**Goal:** Add opt-in local start-cooking reminders for future weekly meal plans;
one-off decisions never schedule them.

**Governing design:** `docs/specs/2026-08-13-meal-prep-notifications-design.md`

## Outputs

| File area | Responsibility |
|---|---|
| `src/lib/meal-prep-reminder.ts` | Pure trigger-time policy and closed presets |
| Native notification module | Permission, schedule, cancel, and identifier lifecycle |
| Web sibling | No-op implementation with no browser permission prompt |
| Kitchen/settings state | Persist opt-in and selected lead time |
| Settings UI | Accessible controls using theme tokens |

## Tasks

1. Install Expo-compatible notification support and add platform configuration.
2. Implement the pure policy for presets `0, 10, 15, 30, 60`.
3. Implement native scheduling and cancellation; make web a no-op.
4. Persist the preference and expose accessible Settings controls.
5. Connect scheduling only when a future weekly plan is saved.

The trigger is
`plannedMealTime - max(totalTimeMinutes, selectedLeadMinutes)` and must be in
the future. Native failures are non-blocking and must not fail a meal-plan save.

## Acceptance criteria

- Default is disabled with lead time `0`.
- One-off Home decisions never schedule notifications.
- Rescheduling cancels identifiers no longer present.
- Notification content contains recipe title and timing only.
- Web never requests notification permission.
- Policy, native adapter boundaries, persisted state, and UI are tested.
- `npm run check` passes.
