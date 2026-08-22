---
name: homechef-ui
description: Use for HomeChef app screens, components, tokens, accessibility, TanStack Query, Zustand, and hosted-plus-offline catalog presentation.
---

# HomeChef UI layer

Read `docs/04_UIUX_SPEC.md`, `src/theme/tokens.ts`, and nearby components.
Use no hardcoded colors or spacing; every interactive element needs accessible
role, label, and state. TanStack Query owns server state and Zustand owns
client-only state.

Render offline catalog results immediately, merge bounded hosted candidates by
stable HomeChef ID, and retain offline results silently on hosted failure. The
pure engine performs the final hard-constraint check. Equipment, allergens, and
dietary restrictions never relax; unknown status excludes. Show at most 3-4
answers per bucket and never create an empty results screen. Attribution comes
from active catalog data while transitional attribution remains present.

Verify with targeted tests, `npm run lint && npm run typecheck`, and `npm run
check` before handoff.
