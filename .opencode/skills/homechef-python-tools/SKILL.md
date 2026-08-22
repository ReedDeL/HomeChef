---
name: homechef-python-tools
description: Use for HomeChef build-time Python catalog tooling, source manifests, archive ingestion, normalization, quarantine, and offline catalog artifacts.
---

# HomeChef Python catalog tooling

Read the owned catalog design, `pyproject.toml`, and the affected tool tests.
Python is build-time tooling only; do not add a service or recipe-provider API.
Only approved checksum-pinned manifest sources may enter a release. Preserve
source-neutral models, provenance, deterministic deduplication, explicit
quarantine reasons, structured measures, and safe equipment fallback.

The current `src/data/*.json` is a transitional provider-derived,
non-rebuildable artifact. Do not overwrite it or claim it is removed. Keep its
attribution until approved replacement parity. Run `ruff format --check tools/`,
`ruff check tools/`, `mypy --strict tools/catalog`, and relevant `pytest tools/`
checks before handoff. Do not download a remote source without explicit approval.
