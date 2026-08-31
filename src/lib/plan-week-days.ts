import type { PlanPrepStyle } from '@/engine/plan-proposal';
import type { DailyPlanPreference } from '@/engine/types';

export function buildWeekDays(style: PlanPrepStyle, anchorDate: Date): DailyPlanPreference[] {
  const start = new Date(anchorDate);
  const day = start.getDay();
  start.setDate(start.getDate() - (day === 0 ? 6 : day - 1));

  return Array.from({ length: 7 }, (_, index) => {
    const dateValue = new Date(start);
    dateValue.setDate(start.getDate() + index);
    const date = [
      dateValue.getFullYear(),
      String(dateValue.getMonth() + 1).padStart(2, '0'),
      String(dateValue.getDate()).padStart(2, '0'),
    ].join('-');
    const offset = -dateValue.getTimezoneOffset();
    const sign = offset >= 0 ? '+' : '-';
    const absolute = Math.abs(offset);
    const zone =
      sign +
      String(Math.floor(absolute / 60)).padStart(2, '0') +
      ':' +
      String(absolute % 60).padStart(2, '0');

    return {
      date,
      selectedLimit: style === 'quick' ? 30 : style === 'batch' ? 120 : 60,
      mealTime: '18:30:00' + zone,
    };
  });
}
