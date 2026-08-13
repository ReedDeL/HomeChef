# Responsive Web Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the web-only 430px letterbox with a responsive HomeChef workspace that preserves shared UX and functionality while giving desktop screens useful multi-column layouts.

**Architecture:** Add a small pure responsive-layout contract that maps viewport width to mobile/tablet/desktop layout values. Use it in the web shell and shared `Screen` frame, then apply desktop composition styles to Home, Pantry, Results, and Recipe while keeping business logic, routes, actions, and accessibility shared. Existing user changes in the working tree remain intact.

**Tech Stack:** Expo Router, React Native / React Native Web, TypeScript, Vitest, existing token/theme system.

## Global Constraints

- Desktop and mobile share routes, store state, decision-engine behavior, actions, accessibility labels, and functionality.
- Mobile remains a single-column flow with full-width actions and no horizontal overflow.
- Desktop uses a centered workspace capped near 1180px with responsive gutters and multi-column content where specified.
- Onboarding and cook mode remain focused layouts rather than dense dashboards.
- Use existing design tokens; add responsive layout tokens instead of scattered magic numbers.
- Preserve existing unrelated working-tree changes.
- Verify with `npm test`, `npm run typecheck`, `npm run lint`, and web export/build checks.

---

### Task 1: Add the responsive layout contract

**Files:**
- Create: `src/components/ui/responsive-layout.ts`
- Create: `src/components/ui/responsive-layout.test.ts`
- Modify: `src/theme/tokens.ts`

**Interfaces:**
- Produces `getResponsiveLayout(width: number): ResponsiveLayout` for shell and screen composition.
- `ResponsiveLayout` includes `mode: 'mobile' | 'tablet' | 'desktop'`, `isDesktop`, `horizontalPadding`, `contentMaxWidth`, `columnGap`, and `gridColumns`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';

import { getResponsiveLayout } from './responsive-layout';

describe('getResponsiveLayout', () => {
  it('keeps phone widths single-column and edge-to-edge', () => {
    expect(getResponsiveLayout(390)).toMatchObject({
      mode: 'mobile',
      isDesktop: false,
      gridColumns: 1,
    });
  });

  it('uses a fluid tablet layout without enabling desktop composition', () => {
    expect(getResponsiveLayout(760)).toMatchObject({
      mode: 'tablet',
      isDesktop: false,
      gridColumns: 1,
    });
  });

  it('uses a centered multi-column workspace on desktop', () => {
    expect(getResponsiveLayout(1280)).toMatchObject({
      mode: 'desktop',
      isDesktop: true,
      contentMaxWidth: 1180,
      gridColumns: 2,
    });
  });
});
```

- [ ] **Step 2: Run the focused test and verify it fails for the missing contract**

Run: `npm test -- src/components/ui/responsive-layout.test.ts`

Expected: FAIL because `./responsive-layout` does not exist yet.

- [ ] **Step 3: Add layout tokens and the minimal pure implementation**

Add `desktopBreakpoint: 960`, `tabletBreakpoint: 640`, `desktopMaxWidth: 1180`,
`desktopGutter: 32`, and `desktopColumnGap: 24` to `layout` in `src/theme/tokens.ts`.
Implement `getResponsiveLayout` with these boundaries:

```ts
export type ResponsiveMode = 'mobile' | 'tablet' | 'desktop';

export interface ResponsiveLayout {
  mode: ResponsiveMode;
  isDesktop: boolean;
  horizontalPadding: number;
  contentMaxWidth: number | undefined;
  columnGap: number;
  gridColumns: 1 | 2;
}
```

Use mobile padding `space.md`, tablet padding `space.lg`, desktop padding
`layout.desktopGutter`, desktop max width `layout.desktopMaxWidth`, and desktop
column gap `layout.desktopColumnGap`.

- [ ] **Step 4: Run the focused test and verify it passes**

Run: `npm test -- src/components/ui/responsive-layout.test.ts`

Expected: PASS with 3 tests and 0 failures.

- [ ] **Step 5: Commit the isolated contract if Git metadata is writable**

```bash
git add src/theme/tokens.ts src/components/ui/responsive-layout.ts src/components/ui/responsive-layout.test.ts
git commit -m "feat: add responsive layout contract"
```

If `.git` remains read-only, leave the working-tree changes intact and report that commit was skipped.

### Task 2: Make the web shell and shared screen responsive

**Files:**
- Modify: `src/components/MobileViewport.tsx`
- Modify: `src/components/ui/Screen.tsx`

**Interfaces:**
- `MobileViewport` remains the root wrapper used by `app/_layout.tsx`.
- `Screen` keeps its current `header`, `footer`, and `scroll` props.

- [ ] **Step 1: Add shell and screen layout behavior**

Use `useWindowDimensions` and `getResponsiveLayout`. Make the web root fill the
viewport and paint the warm canvas; render an inner workspace with
`maxWidth: layout.desktopMaxWidth`, centered on desktop and full-width on mobile.
Remove the 430px `maxWidth` restriction and keep the native path full-width.

In `Screen`, use the responsive horizontal padding for header/content/footer,
and cap reading content naturally through the workspace rather than introducing
screen-specific fixed widths.

- [ ] **Step 2: Run typecheck and the existing tests**

Run: `npm run typecheck && npm test`

Expected: exit 0 with no type errors and no test failures.

- [ ] **Step 3: Commit the shell changes if Git metadata is writable**

```bash
git add src/components/MobileViewport.tsx src/components/ui/Screen.tsx
git commit -m "feat: make web shell responsive"
```

### Task 3: Add desktop compositions to Home, Pantry, Results, and Recipe

**Files:**
- Modify: `app/(tabs)/index.tsx`
- Modify: `app/(tabs)/pantry.tsx`
- Modify: `src/components/ui/BucketSection.tsx`
- Modify: `src/components/ui/RecipeCard.tsx`
- Modify: `app/recipe/[id].tsx`

**Interfaces:**
- Existing screen callbacks and engine/store data remain unchanged.
- `BucketSection` still enforces `MAX_CARDS_PER_BUCKET = 4`.
- `RecipeCard` still opens the same recipe route and shows the same metadata.

- [ ] **Step 1: Add responsive wrappers without changing behavior**

Use `getResponsiveLayout(useWindowDimensions().width)` in the affected screens.
For Home, keep the existing time prompt/actions intact and group the primary
decision with the pantry link in a desktop two-column surface. For Results,
keep relaxation and bucket ordering intact while applying a two-column card grid
to each visible bucket only when `isDesktop` is true. On mobile, retain the
existing stacked flow.

For Pantry, place owned ingredients and the add/search group side-by-side on
desktop while preserving chip callbacks and the scan button. For Recipe, place
the image/summary/missing-state panel beside ingredients and steps on desktop;
retain the vertical mobile flow and the existing footer CTA.

- [ ] **Step 2: Add desktop-only visual treatment**

Use existing `Card`, `space`, `radius`, palette, and shadow tokens. Add bounded
copy widths, 2-up card gaps, consistent surface padding, and visible pressed/
focus-safe interaction states. Do not add new product copy, navigation, or
feature branches.

- [ ] **Step 3: Run typecheck and lint**

Run: `npm run typecheck && npm run lint`

Expected: exit 0 with no errors.

- [ ] **Step 4: Run the full test suite**

Run: `npm test`

Expected: PASS with 0 failures.

- [ ] **Step 5: Commit the screen compositions if Git metadata is writable**

```bash
git add 'app/(tabs)/index.tsx' 'app/(tabs)/pantry.tsx' src/components/ui/BucketSection.tsx src/components/ui/RecipeCard.tsx 'app/recipe/[id].tsx'
git commit -m "feat: add responsive desktop screen layouts"
```

### Task 4: Verify responsive behavior and polish regressions

**Files:**
- Modify only the files needed to correct verified responsive regressions.
- Do not modify unrelated pre-existing files in the working tree.

- [ ] **Step 1: Build the web export**

Run: `npm run web:build`

Expected: exit 0 and a generated `dist/` export.

- [ ] **Step 2: Run the full project checks**

Run: `npm run check`

Expected: lint, typecheck, tests, and format check all exit 0.

- [ ] **Step 3: Inspect the diff and responsive requirements**

Run: `git diff --check` and `git status --short`.
Confirm the web shell is no longer capped at 430px, mobile styles retain one
column and full-width actions, desktop layouts use two columns where specified,
and all existing user changes remain present.

- [ ] **Step 4: Commit the final responsive polish if Git metadata is writable**

```bash
git add src/theme/tokens.ts src/components/ui/responsive-layout.ts src/components/ui/responsive-layout.test.ts src/components/MobileViewport.tsx src/components/ui/Screen.tsx 'app/(tabs)/index.tsx' 'app/(tabs)/pantry.tsx' src/components/ui/BucketSection.tsx src/components/ui/RecipeCard.tsx 'app/recipe/[id].tsx'
git commit -m "feat: polish responsive HomeChef web layout"
```
