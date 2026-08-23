# Wikibooks Cookbook Catalog Implementation Plan

**Goal:** Add a legally attributable Wikibooks source to the owned bundled
catalog without weakening parser testability, equipment safety, or licensing.

**Governing design:** `docs/specs/2026-08-13-wikibooks-catalog-design.md`

## File responsibilities

| Area | Responsibility |
|---|---|
| `wikibooks.py` | MediaWiki title and wikitext retrieval |
| `wikitext.py` | Pure templates, sections, ingredients, and procedure parsing |
| `commons.py` | Commons image resolution and license allowlist |
| Catalog models | Recipe and image attribution |
| Catalog entrypoint | Source selection, assembly, reporting, and collisions |
| Engine recipe type | Optional attribution fields ignored by ranking |
| Recipe screen | Visible per-recipe attribution |
| Fixtures/tests | Network-free parser fixtures and mocked clients |

## Tasks

### 1. MediaWiki client

Enumerate only the Cookbook namespace, follow pagination, batch title requests
within API limits, and send the required project User-Agent. Mock all network
calls in tests.

### 2. Wikitext parser

Keep parsing pure. Resolve supported templates and links in a defined order,
extract ingredient and procedure sections, and reject technique/equipment pages
that resemble recipes. Unknown syntax degrades to a rejected record, not
convincing garbage.

### 3. Ingredient normalization

Parse quantity, unit, and ingredient text only when reliable. Feed ingredient
names through the existing canonical normalization path. Preserve unknown
quantity rather than inventing precision.

### 4. Attribution models

Add source page, author/license metadata, and optional image attribution.
Attribution survives catalog serialization and the engine adapter unchanged.

### 5. Recipe assembly

Use namespaced Wikibooks IDs, require a usable title, ingredients, and
instructions, and retain source attribution. Reject pages that fail the catalog
contract with counted reasons.

### 6. Deduplication

Merge sources with collision checks and normalized-title deduplication.
TheMealDB remains preferred when the same recipe appears in both sources unless
the governing design explicitly selects another rule.

### 7. Build integration

Add Wikibooks behind explicit source selection. Default builds remain
deterministic from committed inputs; live acquisition is a deliberate catalog
maintenance action.

### 8. Commons images

Resolve only files with a positively allowed commercial license. Reject
non-commercial, unknown, or ambiguous licenses. A missing image is preferable
to a copyright risk.

### 9. Equipment coverage gate

Measure how many imported recipes can be safely classified by the existing
equipment pipeline. Unknown remains `unclassified`. Do not ship the source
unless the documented coverage and human spot-check gate passes.

### 10. App attribution

Render recipe-source and image attribution on the recipe screen without
changing ranking or persisting borrowed Spoonacular fields.

### 11. Regenerate and verify

Rebuild the catalog, inspect source counts and rejection reasons, run the Python
and TypeScript contract suites, and review the generated-data diff before
committing.

## Verification

- `ruff format --check tools/`
- `ruff check tools/`
- `mypy --strict tools/catalog`
- `pytest tools/`
- `npm run check`
- manual attribution and 30-recipe equipment spot-check

No task embeds copy-ready source; implementation belongs in the referenced
files and tests.
