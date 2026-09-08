import { z } from 'zod';

export const MEAL_SLOTS = ['breakfast', 'lunch', 'dinner'] as const;
export const mealSlotSchema = z.enum(MEAL_SLOTS);
export type MealSlot = z.infer<typeof mealSlotSchema>;
export const MEAL_SLOT_LABELS: Record<MealSlot, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
};
export function mealEntryKey(entry: { date: string; mealSlot: MealSlot }): string {
  return `${entry.date}:${entry.mealSlot}`;
}

/** A plan covers every selected slot on consecutive local dates, in display order. */
export function hasMealSlotCoverage(
  weekStart: string,
  dayCount: number,
  mealSlots: readonly MealSlot[],
  entries: readonly { date: string; mealSlot: MealSlot }[]
): boolean {
  if (
    ![3, 5, 7].includes(dayCount) ||
    mealSlots.length < 1 ||
    mealSlots.length > 3 ||
    new Set(mealSlots).size !== mealSlots.length
  )
    return false;
  const ordered = MEAL_SLOTS.filter((slot) => mealSlots.includes(slot));
  if (ordered.join() !== mealSlots.join() || entries.length !== dayCount * mealSlots.length)
    return false;
  const start = Date.parse(`${weekStart}T00:00:00Z`);
  return (
    Number.isFinite(start) &&
    entries.every(
      (entry, index) =>
        Date.parse(`${entry.date}T00:00:00Z`) ===
          start + Math.floor(index / mealSlots.length) * 86_400_000 &&
        entry.mealSlot === mealSlots[index % mealSlots.length]
    )
  );
}
