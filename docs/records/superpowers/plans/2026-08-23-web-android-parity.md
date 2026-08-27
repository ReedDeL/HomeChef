# Web Android Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the web build render the same single-column phone composition as Android.

**Architecture:** The shared `MobileViewport` owns web letterboxing at the existing mobile viewport token. Screen components retain the same single-column composition on every platform; browser-specific camera, storage, and OAuth implementations are unaffected.

**Tech Stack:** Expo Router, React Native Web, TypeScript, Vitest.

## Global Constraints

- Use only theme tokens for layout values.
- Keep interactive accessibility properties intact.
- Preserve native and browser-specific functional implementations.
- Verify with the project check and a web export.

---

### Task 1: Restore the shared phone composition on web

**Files:**

- Modify: `src/components/MobileViewport.tsx`
- Modify: `app/(tabs)/index.tsx`
- Modify: `app/(tabs)/pantry.tsx`
- Modify: `app/recipe/[id].tsx`
- Modify: `src/components/ui/BucketSection.tsx`
- Modify: `src/components/ui/responsive-layout.test.ts`

**Interfaces:**

- Consumes: `layout.mobileViewportMaxWidth` and existing `Screen`, `RecipeCard`, and pantry components.
- Produces: a platform-invariant, single-column screen composition with a centered web viewport.

- [ ] **Step 1: Write the failing test**

```typescript
it('keeps desktop widths in the single-column phone composition', () => {
  expect(getResponsiveLayout(1280)).toMatchObject({
    mode: 'desktop',
    isDesktop: false,
    gridColumns: 1,
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/ui/responsive-layout.test.ts`

Expected: the desktop expectation fails because the current layout enables two columns.

- [ ] **Step 3: Restore the single-column implementation**

Remove screen-level desktop composition branches and set `MobileViewport` back to the existing tokenized phone-width frame. Retain responsive helpers only if they are still used by a functional layout contract.

- [ ] **Step 4: Run focused test to verify it passes**

Run: `npx vitest run src/components/ui/responsive-layout.test.ts`

Expected: PASS.

- [ ] **Step 5: Verify all platforms and commit**

Run: `npm run check && npm run web:build`

Expected: formatting, lint, typecheck, tests, and static web export pass before the final all-files commit.
