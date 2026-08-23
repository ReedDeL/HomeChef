# ADR: Spoonacular as an optional live expansion

**Date:** August 3, 2026
**Status:** Decided; implementation remains tracked separately.

## Decision

Use a hybrid catalog:

- The bundled catalog is owned, offline, and keeps the engine pure.

- Spoonacular is queried live only when the bundled catalog is thin, the device is online,
  quota use is below 40 points, and no session result is cached.
- Spoonacular is best-effort. HTTP 402 and other quota failures return no additional
  recipes and never become user-visible errors.

## Why not replace the bundled catalog

Spoonacular permits indefinite storage of only recipe ID, title, and image URL.
Ingredients, instructions, nutrition, and derived data may not be persisted.
A Spoonacular-only architecture would make the decision engine network-bound,
remove offline cook mode, and turn vendor quota into a launch dependency.

## Storage contract

The persistence layer must enforce an explicit allowlist:

- `id`
- `title`
- `imageUrl`

Ingredients and instructions are session-scoped and discarded. Equipment
enrichment runs only on owned bundled data.

## Quota contract

The free plan is a narrow shared quota, not a guaranteed production backend.
The product therefore calls Spoonacular only as an optional expansion and always allows
the bundled catalog to stand alone.

## Consequences

- Two recipe data paths exist, but both feed the same pure `Recipe[]` engine.
- Saved Spoonacular meals may retain only the allowed three fields.
- Reopening a Spoonacular recipe may require a live refetch.
- Attribution and vendor-access risk remain part of the UI and risk register.

## Sources

- [Spoonacular Terms of Use](https://spoonacular.com/food-api/terms)
- [Spoonacular API pricing](https://spoonacular.com/food-api/pricing)
- [Spoonacular quotas](https://spoonacular.com/food-api/docs/quotas)
