# Wikibooks Cookbook Catalog Implementation Plan

**Date:** 2026-08-13
**Status:** Active candidate — next gate is an immutable dump and extractor

**Goal:** Convert a pinned English Wikibooks dump into attributable,
source-neutral JSONL that can enter the owned catalog only after rights,
quality, and hard-constraint review.

**Governing design:** `docs/specs/2026-08-13-wikibooks-catalog-design.md`

## Acquisition boundary

Wikimedia is a build-time source, never a runtime dependency. The committed
manifest may record the official `latest` dump URL while the source is a
candidate, but release input must use an immutable dated dump with a verified
SHA-256. The raw MediaWiki archive is transformed into neutral JSONL before the
existing catalog pipeline can ingest it.

```text
official dump -> checksum verification -> Cookbook extraction -> neutral JSONL
              -> rights review -> normalization/quarantine -> release build
```

## File responsibilities

| Area | Responsibility |
|---|---|
| `rights-manifest.json` | Candidate state, immutable release archive, checksum, license, and attribution |
| `wikimedia_dump.py` | Streaming MediaWiki XML/BZ2 reading and Cookbook-page extraction |
| `wikitext.py` | Pure templates, sections, ingredients, and procedure parsing |
| Neutral JSONL exporter | Source records with stable IDs and page-level provenance |
| `commons.py` | Optional Commons image metadata and strict license allowlist |
| Catalog pipeline | Validation, normalization, quarantine, deterministic release, and offline subset |
| Engine recipe type | Optional attribution fields ignored by ranking |
| Recipe screen | Visible per-recipe attribution |
| Fixtures/tests | Network-free dump fragments, parser fixtures, and release-boundary tests |

## Tasks

### 1. Promote the source safely

Resolve the candidate's discovery URL to a dated Wikimedia dump. Verify the
publisher metadata, calculate SHA-256 independently, and record the observed
version. Do not mark the source approved and do not download it through the
release pipeline until the output is neutral JSONL.

### 2. Build the dump extractor

Stream the compressed XML without loading the archive into memory. Select only
`Cookbook:` content pages, retain stable page/revision identifiers, canonical
source URLs, revision timestamps, and raw wikitext, and emit counted rejection
reasons. Test with tiny committed XML/BZ2 fixtures; no tests call Wikimedia.

### 3. Parse wikitext

Keep parsing pure. Resolve supported templates and links in a defined order,
extract ingredient and procedure sections, and reject technique/equipment pages
that resemble recipes. Unknown syntax becomes a quarantined record, not
convincing garbage.

### 4. Normalize ingredients

Parse quantity, unit, and ingredient text only when reliable. Feed ingredient
names through the existing canonical normalization path. Preserve unknown
quantity rather than inventing precision.

### 5. Preserve attribution

Carry the source page, revision, license, and modification marker through JSONL,
catalog serialization, hosted release rows, and the offline subset. Image
attribution is separate from recipe-text attribution.

### 6. Assemble recipes

Use namespaced Wikibooks IDs; require a usable title, ingredients, and
instructions; and retain provenance. Reject pages that fail the source-neutral
contract with deterministic, counted reasons.

### 7. Deduplicate without provider preference

Use source IDs plus normalized-title collision reporting. The transitional
provider-derived bundle is a parity benchmark, not the preferred owner of a
duplicate. Any merge rule must preserve the selected record's license and
attribution.

### 8. Integrate the build

Feed only checksum-verified neutral JSONL into `tools/catalog/pipeline.py`.
Default app builds remain deterministic from committed release artifacts.
Acquisition is an explicit maintenance action and cannot happen at runtime.

### 9. Handle Commons images separately

Resolve only files with a positively allowed commercial license and complete
attribution metadata. Reject non-commercial, unknown, ambiguous, or fair-use
media. Missing imagery is acceptable.

### 10. Enforce equipment and safety coverage

Measure how many imported recipes can be safely classified by the existing
equipment, allergen, and dietary pipeline. Unknown remains `unclassified` and
excluded. Define and review the threshold before source approval.

### 11. Integrate attribution in the app

Render recipe-text and image attribution on recipe details and expose
active-release attribution in Settings without changing ranking behavior.

### 12. Build parity and activate

Compare useful-answer coverage against the transitional bundle, inspect source
counts and rejection reasons, run the complete verification suite, and review
the generated-data diff. Activation is a separate, auditable operation after
all gates pass.

## Verification

- immutable dump URL and SHA-256 reviewed independently
- `ruff format --check tools/`
- `ruff check tools/`
- `mypy --strict tools/catalog`
- `pytest tools/`
- `npm run check`
- page-level attribution and share-alike review
- manual 30-recipe equipment/allergen/dietary spot-check
- hosted failure retains a useful offline result set

No task embeds copy-ready implementation. Code belongs in the referenced files
and tests.
