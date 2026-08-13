import { afterEach, describe, expect, it } from 'vitest';

import {
  createRouteChangeGuard,
  normalizeRoute,
  setAnalyticsClient,
  trackCookModeCompleted,
  trackCookModeStarted,
  trackOnboardingCompleted,
  trackPageView,
  trackPantryItemAdded,
  trackPantryItemRemoved,
  trackPantryScanCompleted,
  trackPantryScanFailed,
  trackPantryScanStarted,
  trackRecipeDisliked,
  trackRecipeFeedbackSubmitted,
  trackRecipeViewed,
  trackSettingsUpdated,
} from './analytics';

const events: Array<{ name: string; properties?: Record<string, unknown> }> = [];

afterEach(() => {
  events.length = 0;
  setAnalyticsClient(null);
});

describe('analytics helpers', () => {
  it('captures a typed recipe view event', () => {
    setAnalyticsClient({ capture: (name, properties) => events.push({ name, properties }) });

    trackRecipeViewed({ recipe_id: 'meal-1', source: 'results' });

    expect(events).toEqual([
      { name: 'recipe_viewed', properties: { recipe_id: 'meal-1', source: 'results' } },
    ]);
  });

  it('does nothing when no client is configured', () => {
    trackPageView('/');

    expect(events).toEqual([]);
  });

  it('normalizes grouped and dynamic routes', () => {
    expect(normalizeRoute(['(tabs)'])).toBe('/');
    expect(normalizeRoute(['(onboarding)', 'equipment'])).toBe('/onboarding/equipment');
    expect(normalizeRoute(['recipe', 'meal-1'])).toBe('/recipe/:id');
    expect(normalizeRoute(['cook', 'meal-1'])).toBe('/cook/:id');
  });

  it('only reports a route when it changes', () => {
    const guard = createRouteChangeGuard();

    expect(guard('/')).toBe(true);
    expect(guard('/')).toBe(false);
    expect(guard('/recipe/:id')).toBe(true);
  });

  it('forwards page-view and settings properties unchanged', () => {
    setAnalyticsClient({ capture: (name, properties) => events.push({ name, properties }) });

    trackPageView('/settings');
    trackSettingsUpdated({ setting: 'theme', value: 'dark' });

    expect(events).toEqual([
      { name: 'page_view', properties: { route: '/settings' } },
      { name: 'settings_updated', properties: { setting: 'theme', value: 'dark' } },
    ]);
  });

  it.each([
    ['onboarding_completed', () => trackOnboardingCompleted({ pantry_count: 4, equipment_tier: 'full', allergen_count: 1, dietary_restriction_count: 0 })],
    ['pantry_scan_started', () => trackPantryScanStarted({ source: 'camera' })],
    ['pantry_scan_completed', () => trackPantryScanCompleted({ photo_count: 1, candidate_count: 3, accepted_count: 2 })],
    ['pantry_scan_failed', () => trackPantryScanFailed({ photo_count: 1, failure_stage: 'analyze' })],
    ['pantry_item_added', () => trackPantryItemAdded({ source: 'pantry', item_count: 1 })],
    ['pantry_item_removed', () => trackPantryItemRemoved({ source: 'pantry', item_count: 1 })],
    ['recipe_disliked', () => trackRecipeDisliked({ recipe_id: 'meal-1' })],
    ['cook_mode_started', () => trackCookModeStarted({ recipe_id: 'meal-1', step_count: 4 })],
    ['cook_mode_completed', () => trackCookModeCompleted({ recipe_id: 'meal-1', liked: true, removed_ingredients: 3 })],
    ['recipe_feedback_submitted', () => trackRecipeFeedbackSubmitted({ recipe_id: 'meal-1', liked: true })],
  ])('captures %s with its fixed event name', (expectedName, track) => {
    setAnalyticsClient({ capture: (name, properties) => events.push({ name, properties }) });

    track();

    expect(events).toHaveLength(1);
    expect(events[0]?.name).toBe(expectedName);
  });
});
