---
name: homechef-ui
description: Use when building screens, expo-router routes, components, theme styling, design tokens, accessibility, TanStack Query hooks, or Zustand stores in app/ and src/. Covers the token rule, a11y requirements, state-management split, and the never-empty-results rule.
---

# UI layer (app/, src/components/, src/theme/, src/store/, src/lib/queries/)

## Read first

- `docs/04_UIUX_SPEC.md` — screens, tokens, interaction rules
- `src/theme/tokens.ts` — the only source of colors, spacing, type sizes

## Rules

**No hardcoded colors or spacing.** Everything comes from
`src/theme/tokens.ts` via `useTheme`. A literal `#hex` or raw pixel padding is
a review failure.

**Accessibility props on every interactive element** — CI enforces this.
Roles, labels, states; no bare `Pressable` without an accessible name.

**Exports:** named exports everywhere, except expo-router route files in
`app/`, which must default-export.

**State split:** TanStack Query owns server state (`src/lib/queries/`, with
query keys from `keys.ts`). Zustand owns client-only state
(`src/store/kitchen.ts`). Never mirror server data into Zustand.

**Never show an empty results screen.** Relaxation is a code path with tests,
and every soft-constraint relaxation is stated aloud in the UI using the
`Relaxation` data the engine returns — never silently applied.

**Vocabulary in code and copy:** pantry, catalog, bucket, equipment tier,
household, drift. Synonyms are review comments.

**Spoonacular content stays session-scoped:** only `id`/`title`/`imageUrl`
may be cached or persisted; ingredients/instructions render from memory and
are discarded.

## Verify

```sh
npm run lint && npm run typecheck
npx vitest run src/components src/store src/theme   # targeted loop
npm run check                                       # before handoff
```
