import { describe, expect, it, vi } from 'vitest';
import { MEAL_SLOTS } from '@/contracts/meal-slots';
import type { WeeklyMealPlan } from '@/contracts/meal-journeys';
import { makeRecipe } from '@/engine/__fixtures__';

const { from, rpc } = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ supabase: { from, rpc } }));
import {
  createWeeklyMealPlan,
  replaceWeeklyMealPlanChildren,
  fetchWeeklyMealPlan,
} from '@/lib/queries/preferences';

const userId = 'aaaaaaaa-0000-4000-8000-000000000001';
const planId = 'a0000000-0000-4000-8000-000000000001';
const dates = ['2026-09-07', '2026-09-08', '2026-09-09'];
const plan: WeeklyMealPlan = {
  weekStart: dates[0]!,
  dayCount: 3,
  mealSlots: MEAL_SLOTS,
  limitedVariety: true,
  status: 'confirmed',
  statedRelaxations: [],
  groceryNeeds: [],
  entries: dates.flatMap((date) =>
    MEAL_SLOTS.map((mealSlot) => ({
      kind: 'recipe' as const,
      date,
      mealSlot,
      recipeId: 'r',
      plannedMealTime: `${date}T12:30:00-04:00`,
      statedRelaxations: [],
      portionGuidance: null,
    }))
  ),
};
const catalog = [makeRecipe({ id: 'r' })];

describe('multi-meal persistence round-trip', () => {
  it('preserves every slot and variety metadata through both write RPCs and a shuffled fetch', async () => {
    rpc.mockResolvedValue({ data: planId, error: null });
    await createWeeklyMealPlan(userId, plan, catalog);
    const creation = rpc.mock.calls.at(-1)![1];
    expect(creation.p_limited_variety).toBe(true);
    expect(creation.p_entries.map((e: { meal_slot: string }) => e.meal_slot)).toEqual(
      dates.flatMap(() => MEAL_SLOTS)
    );
    await replaceWeeklyMealPlanChildren(userId, planId, plan, catalog);
    const replacement = rpc.mock.calls.at(-1)![1];
    expect(replacement.p_entries).toEqual(creation.p_entries);
    expect(replacement.p_limited_variety).toBe(true);

    const selected: string[] = [];
    from.mockImplementation((table: string) => {
      const data =
        table === 'weekly_meal_plans'
          ? {
              id: planId,
              user_id: userId,
              week_start: plan.weekStart,
              status: plan.status,
              stated_relaxations: [],
              day_count: 3,
              meal_slots: [...MEAL_SLOTS],
              limited_variety: true,
            }
          : table === 'weekly_meal_plan_entries'
            ? [...creation.p_entries].reverse()
            : [];
      const query = {
        select: (columns: string) => {
          selected.push(columns);
          return query;
        },
        eq: () => query,
        order: () => Promise.resolve({ data, error: null }),
        maybeSingle: () => Promise.resolve({ data, error: null }),
      };
      return query;
    });
    await expect(fetchWeeklyMealPlan(userId, plan.weekStart)).resolves.toEqual(plan);
    expect(selected.some((columns) => columns.includes('meal_slot,'))).toBe(true);
    expect(selected.some((columns) => columns.includes('day_count'))).toBe(true);
  });

  it('propagates a failed replacement instead of reporting a successful save', async () => {
    const error = new Error('connection unavailable');
    rpc.mockResolvedValue({ data: null, error });
    await expect(replaceWeeklyMealPlanChildren(userId, planId, plan, catalog)).rejects.toBe(error);
  });
});
