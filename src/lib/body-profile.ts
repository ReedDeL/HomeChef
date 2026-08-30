import type { BodyMetrics } from '@/store/kitchen';

export type WeightUnit = 'kg' | 'lb';
export type HeightUnit = 'cm' | 'ft-in';

export const BODY_METRIC_LIMITS = {
  weightKilograms: { min: 35, max: 300 },
  heightCentimeters: { min: 120, max: 230 },
} as const;

export function parseOptionalMeasurement(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function weightToKilograms(value: number, unit: WeightUnit): number {
  return unit === 'lb' ? value / 2.2046226218 : value;
}

export function kilogramsToWeight(value: number, unit: WeightUnit): number {
  return unit === 'lb' ? value * 2.2046226218 : value;
}

export function heightToCentimeters(value: number, unit: HeightUnit, inches = 0): number {
  return unit === 'ft-in' ? value * 30.48 + inches * 2.54 : value;
}

export function centimetersToFeetInches(value: number): { feet: number; inches: number } {
  const totalInches = value / 2.54;
  const feet = Math.floor(totalInches / 12);
  return { feet, inches: totalInches - feet * 12 };
}

export function isValidInches(inches: number): boolean {
  return Number.isFinite(inches) && inches >= 0 && inches < 12;
}

export function isValidBodyMetrics(metrics: BodyMetrics): boolean {
  const { heightCentimeters, weightKilograms } = metrics;
  return (
    (heightCentimeters === null ||
      (Number.isFinite(heightCentimeters) &&
        heightCentimeters >= BODY_METRIC_LIMITS.heightCentimeters.min &&
        heightCentimeters <= BODY_METRIC_LIMITS.heightCentimeters.max)) &&
    (weightKilograms === null ||
      (Number.isFinite(weightKilograms) &&
        weightKilograms >= BODY_METRIC_LIMITS.weightKilograms.min &&
        weightKilograms <= BODY_METRIC_LIMITS.weightKilograms.max))
  );
}

export function formatMeasurement(value: number | null, decimals = 1): string {
  return value === null ? '' : Number(value.toFixed(decimals)).toString();
}
