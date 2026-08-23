---
name: homechef-python-tools
description: Use when working in tools/ or the catalog pipeline — TheMealDB fetch, normalize, equipment classification, measurements, seed recipes, build_vocabulary, regenerating src/data/recipes.json and src/data/ingredients.json, or any Python change. Covers PEP 8/mypy strict rules and the exact verification commands.
---

# Python tooling (tools/) — build-time catalog pipeline

## Read first

- `docs/02_STYLE_GUIDE.md` — Python standards section
- `pyproject.toml` — source of truth for Ruff, mypy, pytest config
- `tools/catalog/__main__.py` — pipeline entry point and its documented flow

## Rules

**Build-time only.** `tools/` is never a runtime service — no server, no app
imports. It writes committed artifacts (`src/data/*.json`) that the app owns
and bundles.

**Style:** PEP 8 via Ruff, mypy `strict = true`, full type hints on every
function, 4-space indent, line length 100. Ruff families enabled: E, F, I, N,
UP, B, SIM, RUF.

**Pipeline shape:** fetch (TheMealDB) → normalize → equipment classify →
measurements → merge hand-curated seeds (`seed_loader.py`) → build vocabulary
→ write JSON with `sort_keys=True` + trailing newline (keeps the committed
diff readable). One malformed meal is skipped with a warning; it must not fail
a 300-recipe build. Refuse to write an empty catalog.

**Equipment coverage is a backlog, not a statistic:** recipes that fall back
to `unclassified` are excluded from every user's results until enrichment
classifies them. Watch the coverage number the build logs after regeneration.

**Seed recipes pin to existing vocabulary entries** so they stay reachable
from the pantry; the test suite enforces this. New seed ingredients require a
vocabulary entry too (merge order in `__main__.py` exists for this reason).

## Verify

```sh
ruff format --check tools/
ruff check tools/
mypy --strict tools/catalog
pytest tools/

python -m tools.catalog --limit 20   # smoke-run before any full regeneration
```

Regenerated `src/data/*.json` output is committed alongside the code change.
