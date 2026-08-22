# HomeChef — UI/UX Specification

## Product rule

HomeChef reduces dinner decisions. A result view presents one useful bucket and
at most 3-4 answers; it never becomes a catalog browser. Every interactive
element is accessible, and colors and spacing come from `src/theme/tokens.ts`.

## Candidate experience

Today the app shows candidates from the transitional bundled catalog immediately
after a time choice. After roadmap Task 4, it will also merge bounded hosted
candidates quietly by stable HomeChef ID before the pure engine calculates the
final bucket. Until that target path lands, there is no hosted merge; the
transitional bundle remains the only candidate source.

Hard constraints are visible and inviolable:

- Equipment tier, allergens, and dietary restrictions are never relaxed.
- Unknown equipment, allergen, or dietary status excludes.
- A time or cuisine relaxation is announced in plain language above results.
- If ready is thin, a compatible missing-ingredient bucket is promoted with an
  explanation. No result view is empty.

## Screens

1. **Onboarding:** record equipment tier, allergens, dietary preferences, and
   a starter pantry. Explain that these safety constraints govern every answer.
2. **Pantry capture:** compress photo(s), show candidate ingredients, flag low
   confidence, and require confirmation before writing the pantry. Corrections
   are the mechanism for limiting pantry drift.
3. **Home:** present time as the primary choice and a quiet pantry link.
4. **Results:** show one bucket, at most 3-4 recipe cards, required equipment,
   missing ingredients, and an accessible explanation for soft relaxation.
5. **Recipe and cook mode:** today resolve recipe detail from the transitional
   bundled catalog. After roadmap Tasks 3-4, resolve bounded detail through the
   protected hosted catalog with the offline catalog as the fallback. If detail
   cannot load, keep the user on useful offline alternatives rather than
   exposing a dead end.
6. **Settings/About:** today show the required transitional attribution. After
   the active-release path in roadmap Tasks 2-3 lands, also show attribution
   returned by that release until approved cutover.

## Attribution and state

The UI does not label recipes by provider or use provider-tier language.
Attribution is a rights requirement. Today it comes from the transitional
bundle's required attribution; after the active-release path lands, it will be
returned by active catalog data in the appropriate About/Settings and recipe
context. Loading and empty states must not imply that the transitional artifact
has already been replaced.

## Accessibility and copy

Interactive controls include role, name, state, and hint when needed. Touch
targets are at least 44 points (64 in cook mode); Dynamic Type reflows to 200%;
state is never color-only. Use concise, plain copy such as “Nothing fits 20 min.
Here’s what works in 30.” Never expose catalog internals, checksums, RPCs, or
network errors to the user.

## Out of scope

Shopping list, barcode scanning, macro tracking, wake-word voice, and
roommate-sharing UI remain out of scope for the August launch.
