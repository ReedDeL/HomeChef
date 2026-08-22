# HomeChef

**Stop scrolling. Start cooking.**

HomeChef turns a pantry photo and kitchen constraints into 3-4 meals that fit
the user's time, equipment tier, allergens, dietary needs, and pantry. It is a
decision engine, not a recipe browser.

## Developer documentation

Architecture rules live in [AGENTS.md](AGENTS.md). Start with the
[documentation index](docs/README.md) and the
[owned catalog design](docs/specs/2026-08-22-owned-recipe-catalog-design.md).

## Catalog status

HomeChef is replacing retired recipe-provider integration with a rights-first,
hosted-plus-offline catalog. Approved, checksum-pinned bulk archives will build
protected hosted releases and a curated offline fallback. The app will render
offline results immediately, merge bounded hosted candidates when available, and
retain offline results when the hosted catalog is unavailable.

The committed `src/data/*.json` bundle is transitional, provider-derived, and
non-rebuildable from the retired API. It is not already removed. Its attribution
remains until an approved replacement passes parity. The current artifact has
812 recipes, 897 ingredients, and 76 `unclassified` recipes that are excluded
from results.

## Setup

```bash
npm install
cp .env.example .env
```

Set only `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` in the
client environment. Gemini configuration stays in Supabase secrets and is used
only by photo-to-pantry. See [API keys and environment](docs/06_API_KEYS_AND_ENV.md).

## Commands

```bash
npm test
npm run typecheck
npm run lint
npm run format:check

pytest tools/
ruff check tools/
mypy --strict tools/catalog
```

Catalog tooling is build-time only. Do not run source downloads, release loads,
or activation against a remote target without explicit authorization.

## Architecture

```text
offline catalog -------------------------> client candidates --+
                                                              |
active hosted catalog -- authenticated RPCs -> bounded merge -+-> pure engine
                                                                     |
                                                              3-4 answers/bucket
```

`src/engine/` stays pure: it receives `Recipe[]` and does not know whether a
candidate came from hosted or offline data. Equipment, allergens, and dietary
restrictions are never relaxed; unknown status excludes.

## Known transition gates

- Replacement parity and rights approval are required before removing the
  transitional bundle or its attribution.
- The photo-to-pantry Edge Function should receive a synthetic-image smoke test
  after deployment; never use a real pantry photo for infrastructure checks.
- Catalog tables and release RPCs require RLS and targeted verification before
  client integration.
