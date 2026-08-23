import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ANALYTICS_EVENTS,
  identifyAuthenticatedUser,
  isAnalyticsConfigured,
  isApprovedAnalyticsEvent,
  resetAnalyticsIdentity,
  setAnalyticsClient,
  trackConstraintRelaxed,
  trackCookModeCompleted,
  trackCookModeStarted,
  trackOnboardingCompleted,
  trackPantryFilterSubmitted,
  trackRecipeOpened,
  trackRecommendationsShown,
  trackVisionScanFailed,
  trackVisionScanSucceeded,
  type AnalyticsClient,
  type AnalyticsEventName,
} from './analytics';

const events: Array<{ name: AnalyticsEventName; properties?: Record<string, unknown> }> = [];
const identify = vi.fn<(userId: string) => void>();
const reset = vi.fn<() => void>();

const recordingClient: AnalyticsClient = {
  capture: (name, properties) => events.push({ name, properties }),
  identify,
  reset,
};

afterEach(() => {
  events.length = 0;
  identify.mockClear();
  reset.mockClear();
  setAnalyticsClient(null);
});

describe('analytics helpers', () => {
  it('defines exactly the approved product events', () => {
    expect(Object.values(ANALYTICS_EVENTS)).toEqual([
      'onboarding_completed',
      'pantry_filter_submitted',
      'recommendations_shown',
      'recipe_opened',
      'cook_mode_started',
      'cook_mode_completed',
      'constraint_relaxed',
      'vision_scan_succeeded',
      'vision_scan_failed',
    ]);

    expect(isApprovedAnalyticsEvent('recipe_opened')).toBe(true);
    expect(isApprovedAnalyticsEvent('page_view')).toBe(false);
  });

  it('does nothing when no client is configured', () => {
    trackOnboardingCompleted();
    identifyAuthenticatedUser('user-1');
    resetAnalyticsIdentity();

    expect(events).toEqual([]);
    expect(identify).not.toHaveBeenCalled();
    expect(reset).not.toHaveBeenCalled();
  });

  it('requires a non-empty API key before enabling the SDK', () => {
    expect(isAnalyticsConfigured('')).toBe(false);
    expect(isAnalyticsConfigured('  ')).toBe(false);
    expect(isAnalyticsConfigured('phc_test_key')).toBe(true);
  });

  it.each([
    ['onboarding_completed', () => trackOnboardingCompleted()],
    ['pantry_filter_submitted', () => trackPantryFilterSubmitted({ time_limit_minutes: 30 })],
    ['recommendations_shown', () => trackRecommendationsShown({ recommendation_count: 4 })],
    ['recipe_opened', () => trackRecipeOpened({ recipe_id: 'meal-1' })],
    ['cook_mode_started', () => trackCookModeStarted({ recipe_id: 'meal-1', step_count: 4 })],
    ['cook_mode_completed', () => trackCookModeCompleted({ recipe_id: 'meal-1' })],
    ['constraint_relaxed', () => trackConstraintRelaxed({ constraint: 'time_widened' })],
    [
      'vision_scan_succeeded',
      () => trackVisionScanSucceeded({ photo_count: 1, candidate_count: 3, accepted_count: 2 }),
    ],
    [
      'vision_scan_failed',
      () => trackVisionScanFailed({ photo_count: 1, failure_stage: 'analyze' }),
    ],
  ] satisfies ReadonlyArray<[AnalyticsEventName, () => void]>)(
    'captures %s with its fixed event name',
    (expectedName, track) => {
      setAnalyticsClient(recordingClient);

      track();

      expect(events).toHaveLength(1);
      expect(events[0]?.name).toBe(expectedName);
    }
  );

  it('forwards the stable user ID without person properties and resets on logout', () => {
    setAnalyticsClient(recordingClient);

    identifyAuthenticatedUser('user-1');
    identifyAuthenticatedUser('  ');
    resetAnalyticsIdentity();

    expect(identify).toHaveBeenCalledOnce();
    expect(identify).toHaveBeenCalledWith('user-1');
    expect(reset).toHaveBeenCalledOnce();
  });

  it('contains client failures', () => {
    setAnalyticsClient({
      capture: () => {
        throw new Error('offline');
      },
      identify: () => {
        throw new Error('offline');
      },
      reset: () => {
        throw new Error('offline');
      },
    });

    expect(() => trackOnboardingCompleted()).not.toThrow();
    expect(() => identifyAuthenticatedUser('user-1')).not.toThrow();
    expect(() => resetAnalyticsIdentity()).not.toThrow();
  });
});
