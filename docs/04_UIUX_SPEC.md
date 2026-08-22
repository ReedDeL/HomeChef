# HomeChef — UI/UX Specification

## Product rule

HomeChef reduces dinner decisions. A result view presents one useful bucket and
at most 3-4 answers; it never becomes a catalog browser. Every interactive
element is accessible, and colors and spacing come from `src/theme/tokens.ts`.

## Candidate experience

The app shows curated offline candidates immediately after a time choice. When
available, hosted candidates merge quietly by stable HomeChef ID before the
pure engine calculates the final bucket. A hosted error or absence retains the
offline result without a failure screen or provider explanation.

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
5. **Recipe and cook mode:** resolve a detail from cache, hosted catalog, or
   offline catalog. If detail cannot load, keep the user on useful offline
   alternatives rather than exposing a dead end.
6. **Settings/About:** show attribution returned by the active hosted release
   and the required transitional attribution until approved cutover.

## Attribution and state

The UI does not label recipes by provider or use provider-tier language.
Attribution is a rights requirement, displayed in the appropriate About/Settings
and recipe context from active catalog data. The existing transitional bundle's
attribution remains while it ships. Loading and empty states must not imply that
the transitional artifact has already been replaced.

## Accessibility and copy

Interactive controls include role, name, state, and hint when needed. Touch
targets are at least 44 points (64 in cook mode); Dynamic Type reflows to 200%;
state is never color-only. Use concise, plain copy such as “Nothing fits 20 min.
Here’s what works in 30.” Never expose catalog internals, checksums, RPCs, or
network errors to the user.

## Out of scope

Shopping list, barcode scanning, macro tracking, wake-word voice, and
roommate-sharing UI remain out of scope for the August launch.
