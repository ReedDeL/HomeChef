# Microwave seed catalog + honest equipment tagging

**Date:** 2026-08-06
**Status:** Implemented 2026-08-06
**Milestone:** 2 (equipment enrichment)

## Problem

Of 792 recipes, **2 are confirmed microwave-only.** The microwave-only user is
the B6 wedge — the use case no competitor addresses and the one the product
pitch leans on.

A further 76 recipes are tagged `equipmentRequired: ["none"]`. That tag was not
earned. `coerce_equipment` falls back to `none` when the keyword pass fails to
classify a recipe, so **"we could not tell" and "needs no equipment" are written
identically.** `filter-hard.ts:20` reads `none` as always satisfied, so all 76
are served to microwave-only users as though verified.

`tools/catalog/equipment.py` documents this fallback as "safe because it cannot
exclude a user." That is backwards. It cannot *exclude* — it wrongly *includes*.

A microwave-only user today is served 78 recipes, 76 of which are unverified and
most of which need a stove. Confidently wrong is worse than thin.

Adding recipes alone does not fix this. 20 good recipes among 76 wrong ones is
still a wrong list. The dataset and the tagging fix are one change.

## Goals

1. 20 hand-curated, genuinely microwave-safe recipes, surviving catalog rebuilds.
2. `unclassified` becomes distinct from `none`, so unverified recipes stop
   masquerading as universally safe.
3. A microwave-only user with a realistic pantry gets a short, correct list.

**Quality bar: stopgap.** Good enough for an honest Aug 9 go/no-go, structured
to grow. Not a claim to be the finished catalog.

## Non-goals

- LLM enrichment of the 76 — tracked separately, this change makes it matter more
- Dietary tags — stays deliberately empty; absent beats wrong
- Recipe images — `imageUrl: null`
- Any UI. `app/` does not exist yet.

## Design

### Data location

`tools/catalog/seed/microwave.json`, merged into `recipes.json` at build time.

`src/data/` stays purely generated output. `python -m tools.catalog` overwrites
`recipes.json` wholesale, so anything hand-written there is destroyed on the
next rebuild — the merge is what makes this durable.

| Decision | Value | Reason |
|---|---|---|
| ID scheme | `hc-mw-01` … `hc-mw-20` | Cannot collide with TheMealDB's numeric IDs; greppable provenance |
| `source` | `"tier1"` | These *are* Tier 1: bundled, offline, owned. No engine change needed |
| Validation | Same Pydantic models as TheMealDB data | Malformed content fails the build, not the user |
| Ingredient IDs | Must already exist in the vocabulary | Otherwise `eggs` is silently created next to `egg` and pantry matching breaks |

The ingredient-ID constraint is the subtle one. `build_vocabulary` derives
`ingredients.json` *from* the recipes, so an invented ID would be quietly
accepted and become a permanent near-duplicate in the shared vocabulary — the
one place the spec says an error propagates everywhere.

### Recipe content

3–6 ingredients, 5–15 minutes, real cooking from pantry staples: mug eggs,
oatmeal, baked potato, steamed vegetables, mug mac and cheese, rice bowls,
poached fish.

Grounded in USDA FSIS guidance (poultry 165 °F, eggs 160 °F, fish 145 °F,
≥3 minutes standing time, cover to heat evenly).

Hard exclusions, enforced by a test rather than by care:

| Never | Why |
|---|---|
| Eggs in shell | Explode during or *after* heating; burns to hand or mouth |
| Raw poultry | Needs verified 165 °F and heats unevenly; we cannot check a thermometer |
| Grapes, hot peppers, high-proof alcohol | Plasma arcing, fire |
| Stuffed anything | Center does not reliably reach temperature |

Raw meat is avoided entirely. That sidesteps the temperature-probe problem
rather than papering over it — an app cannot verify internal temperature, so it
should not write recipes that depend on the user doing so.

Every egg recipe states "beat, or prick the yolk." Anything relying on carryover
states its standing time.

**Provenance.** Recipes are researched from published microwave cooking practice
for factual grounding, then written fresh. Ingredient lists and bare procedures
are not copyrightable; expressive prose is. No source text is copied.

### The `unclassified` change

| File | Change |
|---|---|
| `tools/catalog/models.py` | Add `unclassified` to `Equipment` and `EQUIPMENT_VALUES` |
| `tools/catalog/equipment.py` | `coerce_equipment` empty result → `["unclassified"]`, not `["none"]`; correct the misleading docstring |
| `src/engine/types.ts` | Add `unclassified` to the `EQUIPMENT` const |
| `src/engine/filter-hard.ts` | `unclassified` never satisfies the equipment filter |

`none` keeps its meaning — verified as needing no equipment — and stays always
satisfied.

**Accepted trade-off:** this removes the 76 from *every* user, not just
microwave users. A full-kitchen user goes from 792 usable recipes to 716.

Chosen because it is one line, fully reversible, and consistent with the
project's existing rule for dietary tags: absent beats wrong. The alternative —
showing unknowns only to users who own everything — encodes a guess about what
"unknown" requires as though it were a rule. When enrichment runs, the 76 shrink
toward zero and this stops mattering.

## Testing

### Python (`tools/catalog/tests/`)

- Seed file parses and validates against the Pydantic model
- IDs unique, and disjoint from TheMealDB IDs
- Every ingredient ID exists in the TheMealDB-derived vocabulary
- Every seed recipe requires `microwave`
- No banned ingredient or technique (in-shell egg, raw poultry, grape, hot
  pepper, stuffed)
- `totalTimeMinutes > 0`
- `coerce_equipment` returns `["unclassified"]`, not `["none"]`, for unmatched input

### TypeScript

- `filter-hard`: `unclassified` is not satisfied by any equipment set, including
  the full set
- `filter-hard`: `none` *is* still satisfied by every equipment set
- `catalog.test.ts`: at least 20 recipes require `microwave`
- `catalog.test.ts`: a microwave-only user with a realistic pantry gets ≥1 result
- `relax.test.ts`: microwave-only still never returns empty

### The real acceptance test

`catalog.test.ts:80` — "the real catalog never yields an empty screen",
parameterized over equipment sets — is expected to **fail** partway through this
change, and that failure is informative. If the microwave-only case currently
passes only because the 76 `none` recipes are propping it up, excluding them
breaks it, and the 20 new recipes are what genuinely fix it.

If that test never goes red, the 76 were not actually load-bearing for the
microwave case and this design's premise needs re-examining before proceeding.

**Result: premise confirmed, and worse than predicted.** Measured against the
rebuilt catalog with the seed held out, a microwave-only user with the test
pantry gets **0 results at 15, 30 and 60 minutes** — not a thin list, an empty
screen. The relaxation ladder cannot rescue it: TheMealDB's only two
microwave-only recipes are both 240-minute fudge, and `TIME_TIERS` tops out at
120. With the seed merged the same user gets 10.

So the 76 were not merely padding the microwave case, they were the entire
thing, and every one of them was a guess. The seed is load-bearing; deleting it
returns the microwave-only user to an empty screen. `catalog.test.ts` pins both
halves of that.

## Risks

| Risk | Mitigation |
|---|---|
| A recipe is unsafe or unappetising | Human spot-check before merge; automated ban-list test |
| 20 recipes is too thin for some pantries | Relaxation ladder already guarantees a non-empty result |
| Catalog shrinks to 716 and someone panics | Documented here and in the README; reversible in one line |
| Seed ingredient IDs drift from vocabulary | Build-time validation fails the build |

## Open items

None. Scope, provenance, data location, recipe style, count (20), and the
`unclassified` trade-off are all decided.
