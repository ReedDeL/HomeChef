---
name: homechef-engine
description: Use for HomeChef decision-engine work in src/engine/, including buckets, hard filtering, relaxation, ranking, and engine tests.
---

# HomeChef decision engine

Read `docs/01_TECHNICAL_SPEC.md`, the owned catalog design, and nearby engine
tests before editing. `src/engine/` is pure, synchronous, deterministic, and
accepts only `Recipe[]`; it imports no React, `src/lib/`, Supabase, network, or
clock state. It must not know whether a recipe is hosted or offline.

Equipment, allergens, and dietary restrictions never relax. Unknown status
excludes. Soft relaxation is fixed, visible, and tested. Cap results at 3-4 per
bucket and never let the UI reach an empty results screen. Verify with targeted
Vitest during iteration and `npm run check` before handoff.
