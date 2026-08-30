import { describe, expect, it } from 'vitest';

import {
  centimetersToFeetInches,
  formatMeasurement,
  heightToCentimeters,
  isValidBodyMetrics,
  isValidInches,
  kilogramsToWeight,
  parseOptionalMeasurement,
  weightToKilograms,
} from '@/lib/body-profile';

describe('body profile metric helpers', () => {
  it('parses optional positive measurements and treats blank input as absent', () => {
    expect(parseOptionalMeasurement('')).toBeNull();
    expect(parseOptionalMeasurement('  ')).toBeNull();
    expect(parseOptionalMeasurement('68.5')).toBe(68.5);
    expect(parseOptionalMeasurement('-2')).toBeNull();
    expect(parseOptionalMeasurement('not a number')).toBeNull();
  });

  it('converts pounds to kilograms and preserves kilograms', () => {
    expect(weightToKilograms(68.5, 'kg')).toBe(68.5);
    expect(weightToKilograms(150, 'lb')).toBeCloseTo(68.0389, 3);
  });

  it('converts stored kilograms back to the selected weight unit', () => {
    expect(kilogramsToWeight(68.0389, 'kg')).toBeCloseTo(68.0389, 4);
    expect(kilogramsToWeight(68.0389, 'lb')).toBeCloseTo(150, 2);
  });

  it('converts centimeters and feet/inches to the same height', () => {
    expect(heightToCentimeters(168, 'cm')).toBe(168);
    expect(heightToCentimeters(5, 'ft-in', 6)).toBeCloseTo(167.64, 2);
  });

  it('converts centimeters to feet and inches without reinterpreting the draft', () => {
    const converted = centimetersToFeetInches(167.64);
    expect(converted.feet).toBe(5);
    expect(converted.inches).toBeCloseTo(6, 5);
  });

  it('rejects inches at or above twelve', () => {
    expect(isValidInches(11.9)).toBe(true);
    expect(isValidInches(12)).toBe(false);
    expect(isValidInches(13)).toBe(false);
  });

  it('validates optional metrics against the safe contract bounds', () => {
    expect(isValidBodyMetrics({ heightCentimeters: null, weightKilograms: null })).toBe(true);
    expect(isValidBodyMetrics({ heightCentimeters: 168, weightKilograms: 68.5 })).toBe(true);
    expect(isValidBodyMetrics({ heightCentimeters: 119.9, weightKilograms: 68.5 })).toBe(false);
    expect(isValidBodyMetrics({ heightCentimeters: 168, weightKilograms: 300.1 })).toBe(false);
  });

  it('formats optional values for controlled inputs', () => {
    expect(formatMeasurement(null)).toBe('');
    expect(formatMeasurement(68.456)).toBe('68.5');
  });
});
