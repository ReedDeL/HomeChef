import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { WeeklyMealPlan } from '@/contracts/meal-journeys';
import { makeRecipe } from '@/engine/__fixtures__';

const PLAN_ID = 'a0000000-0000-4000-8000-000000000001';
const USER_ID = 'aaaaaaaa-0000-4000-8000-000000000001';
const { from, rpc } = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(() => {
    throw new Error('Non-transactional parent insert was attempted');
  }),
}));

vi.mock('@/lib/supabase', () => ({ supabase: { from, rpc } }));

import { createWeeklyMealPlan } from '@/lib/queries/preferences';

function makePlan(): WeeklyMealPlan {
  const dates = [
    '2026-08-24',
    '2026-08-25',
    '2026-08-26',
    '2026-08-27',
    '2026-08-28',
    '2026-08-29',
    '2026-08-30',
  ] as const;
  return {
    weekStart: dates[0],
    status: 'draft',
    statedRelaxations: [],
    entries: dates.map((date) => ({
      kind: 'recipe' as const,
      date,
      recipeId: 'bundled-1',
      plannedMealTime: `${date}T18:30:00-07:00`,
      statedRelaxations: [] as const,
      portionGuidance: null,
    })),
    groceryNeeds: [],
  };
}

describe('createWeeklyMealPlan', () => {
  beforeEach(() => {
    from.mockClear();
    rpc.mockReset();
    rpc.mockResolvedValue({ data: PLAN_ID, error: null });
  });

  it('creates the parent and complete children through one transactional RPC', async () => {
    const plan = makePlan();

    await expect(
      createWeeklyMealPlan(USER_ID, plan, [makeRecipe({ id: 'bundled-1', source: 'tier1' })])
    ).resolves.toBe(PLAN_ID);
    expect(from).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledWith(
      'create_weekly_meal_plan',
      expect.objectContaining({
        p_week_start: '2026-08-24',
        p_status: 'draft',
        p_stated_relaxations: [],
        p_entries: expect.arrayContaining([
          expect.objectContaining({
            entry_date: '2026-08-24',
            recipe_id: 'bundled-1',
          }),
        ]),
        p_grocery_needs: [],
      })
    );
  });
});
