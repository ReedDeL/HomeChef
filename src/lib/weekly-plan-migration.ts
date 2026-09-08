import { weeklyMealPlanSchema, type WeeklyMealPlan } from '@/contracts/meal-journeys';

/** Upgrade the old dinner-only snapshot without replacing any saved meal or timestamp. */
export function migrateWeeklyPlan(input: unknown): WeeklyMealPlan | null {
  if (input === null || input === undefined) return null;
  if (typeof input !== 'object' || Array.isArray(input)) return null;
  const plan = input as Record<string, unknown>;
  const alreadyCurrent = weeklyMealPlanSchema.safeParse(plan);
  if (alreadyCurrent.success) return alreadyCurrent.data;
  if (
    'dayCount' in plan ||
    'mealSlots' in plan ||
    !Array.isArray(plan.entries) ||
    plan.entries.length !== 7
  )
    return null;
  const entries = plan.entries.map((entry: unknown) => {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) return entry;
    return { ...entry, mealSlot: 'dinner' };
  });
  const migrated = weeklyMealPlanSchema.safeParse({
    ...plan,
    dayCount: 7,
    mealSlots: ['dinner'],
    limitedVariety: false,
    entries,
  });
  return migrated.success ? migrated.data : null;
}
