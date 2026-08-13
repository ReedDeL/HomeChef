# PostHog Analytics Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (\`- [ ]\`) syntax for tracking.

**Goal:** Initialize PostHog at HomeChef app launch, capture every route view, and expose typed helpers for the approved onboarding, pantry, recipe, cooking, feedback, and settings events.

**Architecture:** PostHogProvider wraps the root layout and reads optional public environment configuration. A pure analytics module owns event names, property types, client wiring, and route normalization. A root bridge installs the PostHog client and emits deduplicated page views; screens call named helpers only.

**Tech Stack:** Expo 57, Expo Router, React Native, TypeScript, Vitest, posthog-react-native.

## Global Constraints

- Public configuration uses only EXPO_PUBLIC_POSTHOG_API_KEY and EXPO_PUBLIC_POSTHOG_HOST.
- Missing configuration must not prevent startup or product actions.
- Never send image bytes/URIs, raw ingredient photos, email addresses, or other personal information.
- Do not enable session replay, error tracking, user identification, flags, experiments, surveys, or backend instrumentation.
- Event names use snake_case; recipe and cook routes normalize to /recipe/:id and /cook/:id.
- Preserve unrelated worktree changes.
- Every behavior change starts with a failing test and ends with fresh verification.

---

### Task 1: Install and configure the SDK

**Files:**
- Modify: package.json and package-lock.json through Expo's installer
- Modify: app.json
- Modify: .env.example

**Interfaces:**
- Produces the posthog-react-native package and public configuration consumed by later tasks.

- [ ] **Step 1: Install compatible packages**

Run:

\`\`\`bash
npx expo install posthog-react-native expo-file-system expo-application expo-device expo-localization
\`\`\`

Expected: package.json and package-lock.json gain compatible dependencies.

- [ ] **Step 2: Add the Expo plugin**

Add posthog-react-native/expo to the existing expo.plugins array in app.json, preserving all current plugins.

- [ ] **Step 3: Document public variables**

Add this block to .env.example:

\`\`\`dotenv
EXPO_PUBLIC_POSTHOG_API_KEY=
EXPO_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
\`\`\`

- [ ] **Step 4: Check and commit setup**

Run:

\`\`\`bash
git diff --check -- package.json package-lock.json app.json .env.example
\`\`\`

Then commit only these files:

\`\`\`bash
git add package.json package-lock.json app.json .env.example
git commit -m "chore: configure PostHog SDK"
\`\`\`

---

### Task 2: Add the typed analytics contract and route normalization

**Files:**
- Create: src/lib/analytics.ts
- Create: src/lib/analytics.test.ts

**Interfaces:**
- Produces AnalyticsClient, setAnalyticsClient, normalizeRoute, and all named track helpers.

- [ ] **Step 1: Write failing tests**

Test with a recording client, not native modules:

\`\`\`ts
import { afterEach, describe, expect, it } from 'vitest';
import {
  normalizeRoute,
  setAnalyticsClient,
  trackPageView,
  trackRecipeViewed,
  trackSettingsUpdated,
} from './analytics';

const events: Array<{ name: string; properties?: Record<string, unknown> }> = [];

afterEach(() => {
  events.length = 0;
  setAnalyticsClient(null);
});

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

it('forwards page-view and settings properties unchanged', () => {
  setAnalyticsClient({ capture: (name, properties) => events.push({ name, properties }) });

  trackPageView('/settings');
  trackSettingsUpdated({ setting: 'theme', value: 'dark' });

  expect(events).toEqual([
    { name: 'page_view', properties: { route: '/settings' } },
    { name: 'settings_updated', properties: { setting: 'theme', value: 'dark' } },
  ]);
});
\`\`\`

Also add a table-driven assertion covering each remaining approved event name.

- [ ] **Step 2: Verify the red state**

Run:

\`\`\`bash
npx vitest run src/lib/analytics.test.ts
\`\`\`

Expected: FAIL because src/lib/analytics.ts does not exist.

- [ ] **Step 3: Implement the minimal pure module**

Define:

\`\`\`ts
export type AnalyticsProperties = Record<string, unknown>;

export interface AnalyticsClient {
  capture(event: string, properties?: AnalyticsProperties): void;
}

let analyticsClient: AnalyticsClient | null = null;

export function setAnalyticsClient(client: AnalyticsClient | null): void {
  analyticsClient = client;
}
\`\`\`

Add exact event-specific property types and helpers for page_view, onboarding_completed, pantry scan start/completion/failure, pantry item add/remove, recipe view/dislike, cook start/completion, recipe feedback, and settings updates. Each helper calls one fixed snake_case event name. normalizeRoute removes group segments beginning with (, maps no visible segments to /, and maps the id segment of recipe/cook routes to :id.

- [ ] **Step 4: Verify green**

Run the focused Vitest file again. Expected: all analytics tests pass with no warnings.

- [ ] **Step 5: Commit**

\`\`\`bash
git add src/lib/analytics.ts src/lib/analytics.test.ts
git commit -m "feat: add typed analytics helpers"
\`\`\`

---

### Task 3: Initialize PostHog and capture route views

**Files:**
- Create: src/components/AnalyticsObserver.tsx
- Modify: app/_layout.tsx

**Interfaces:**
- Consumes the Task 2 client boundary and page-view helper.
- Produces launch initialization and one page_view per normalized route.

- [ ] **Step 1: Write a failing duplicate-guard test**

If the observer uses a pure guard, test it before implementation:

\`\`\`ts
it('only reports a route when it changes', () => {
  const guard = createRouteChangeGuard();
  expect(guard('/')).toBe(true);
  expect(guard('/')).toBe(false);
  expect(guard('/recipe/:id')).toBe(true);
});
\`\`\`

Run the focused test and confirm the missing helper causes failure.

- [ ] **Step 2: Implement the observer**

Use usePostHog and useSegments beneath the provider. Install the client in one effect and track the normalized route in another. Use a ref or pure guard to suppress duplicate renders. Clear the global client on unmount.

- [ ] **Step 3: Wrap the current root layout**

Import PostHogProvider and place AnalyticsObserver beneath it while preserving the existing QueryClientProvider, SafeAreaProvider, StatusBar, MobileViewport, OnboardingGate, and Stack.

Use:

\`\`\`tsx
const posthogApiKey = process.env.EXPO_PUBLIC_POSTHOG_API_KEY ?? '';
const posthogHost = process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com';

<PostHogProvider
  apiKey={posthogApiKey}
  options={{ host: posthogHost, disabled: posthogApiKey.length === 0 }}
>
  <AnalyticsObserver />
  <QueryClientProvider client={queryClient}>...</QueryClientProvider>
</PostHogProvider>
\`\`\`

- [ ] **Step 4: Verify**

Run:

\`\`\`bash
npx vitest run src/lib/analytics.test.ts
npm run typecheck
\`\`\`

Expected: both exit 0.

- [ ] **Step 5: Commit**

\`\`\`bash
git add app/_layout.tsx src/components/AnalyticsObserver.tsx
git commit -m "feat: initialize PostHog and track page views"
\`\`\`

---

### Task 4: Instrument onboarding, scan, pantry, recipe, and cook flows

**Files:**
- Modify: app/(onboarding)/staples.tsx
- Modify: app/scan.tsx
- Modify: app/(tabs)/pantry.tsx
- Modify: app/recipe/[id].tsx
- Modify: app/cook/[id].tsx

**Interfaces:**
- Consumes the typed helpers from Task 2.
- Adds events at existing action boundaries without changing product behavior.

- [ ] **Step 1: Instrument onboarding completion**

In staples.tsx, before completeOnboarding and navigation, call:

\`\`\`ts
trackOnboardingCompleted({
  pantry_count: pantry.length,
  equipment_tier: tierId,
  allergen_count: allergens.length,
  dietary_restriction_count: dietary.length,
});
\`\`\`

Read the values from existing Zustand selectors. Do not include ingredient IDs.

- [ ] **Step 2: Instrument scan lifecycle**

In scan.tsx:
- Start tracking at pick(source) with source camera or library.
- On successful analysis, send photo_count, candidate_count, and accepted_count.
- In the analysis catch branch, send photo_count and failure_stage analyze.
- Before confirmed candidates are added, send pantry_item_added with source photo_scan and item_count acceptedCount.
- Never send photo URIs or candidate names.

- [ ] **Step 3: Instrument manual pantry edits**

In pantry.tsx, wrap the existing add/remove callbacks. Each user add/remove sends item_count 1 and source pantry while preserving IngredientChip callback signatures.

- [ ] **Step 4: Instrument recipe milestones**

In recipe/[id].tsx:
- After a valid recipe is loaded, use an effect to send recipe_viewed once with recipe_id and source results.
- Before recordDislike, send recipe_disliked with recipe_id.
- Before opening cook mode, send cook_mode_started with recipe_id and step_count.

- [ ] **Step 5: Instrument cook milestones**

In cook/[id].tsx:
- When either feedback button is selected, send recipe_feedback_submitted with recipe_id and liked.
- Before returning home, send cook_mode_completed with recipe_id, liked, and removed_ingredients count.
- Preserve pantry mutation order and navigation behavior.

- [ ] **Step 6: Verify and commit**

Run:

\`\`\`bash
npx vitest run src/lib/analytics.test.ts
npm run lint
npm run typecheck
\`\`\`

Expected: all exit 0. Commit only the five listed route files:

\`\`\`bash
git add 'app/(onboarding)/staples.tsx' app/scan.tsx 'app/(tabs)/pantry.tsx' 'app/recipe/[id].tsx' 'app/cook/[id].tsx'
git commit -m "feat: track core HomeChef events"
\`\`\`

---

### Task 5: Instrument settings and run full verification

**Files:**
- Modify: app/settings.tsx

- [ ] **Step 1: Add settings events**

Wrap existing setters so they retain the same values and also send settings_updated:

\`\`\`ts
const updateTheme = (value: ThemeMode) => {
  setThemeMode(value);
  trackSettingsUpdated({ setting: 'theme', value });
};
\`\`\`

Apply the same pattern to equipment tier, extra appliance, allergen, dietary restriction, and confirmed reset. Use existing option IDs; never send labels or free-form text.

- [ ] **Step 2: Run full verification**

Run:

\`\`\`bash
npm run lint
npm run typecheck
npm test
npm run format:check
\`\`\`

Expected: every command exits 0. Report exact failures if a native build limitation prevents runtime validation.

- [ ] **Step 3: Verify scope**

Run:

\`\`\`bash
git diff --check HEAD~4..HEAD
git status --short
\`\`\`

Confirm the PostHog commits contain only planned files and unrelated pre-existing changes remain untouched.

- [ ] **Step 4: Commit settings**

\`\`\`bash
git add app/settings.tsx
git commit -m "feat: track settings changes"
\`\`\`

- [ ] **Step 5: Report evidence**

Report exact pass counts and exit codes for lint, typecheck, tests, and format checks. State whether an Expo development build was available; do not claim delivery to PostHog without a configured project key and runtime event verification.

