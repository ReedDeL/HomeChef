# Owned recipe catalog roadmap

**Date:** 2026-08-22
**Status:** Active — source pipeline foundation in place; Wikibooks candidate registered

## Outcome

Replace live recipe-provider dependencies with a rights-first, HomeChef-owned
hosted catalog and curated offline fallback without weakening the pure decision
engine or hard constraints.

The current 812-recipe/897-ingredient provider-derived bundle remains a
transitional, non-rebuildable artifact with its attribution until approved
replacement parity. Its 76 `unclassified` recipes continue to exclude rather
than admit.

## Current implementation state

| Area | State | Evidence and next gate |
|---|---|---|
| Documentation and legacy cleanup | In progress | The owned-catalog design governs new work; provider-era runtime guidance and residue still need removal. |
| Build pipeline | In progress | The rights manifest, checksum boundary, quarantine, deterministic release builder, and protected loader exist. The first source extractor does not. |
| Hosted catalog contract | Repository implementation complete | Protected release tables, RLS, read RPCs, and activation functions exist. No candidate source has been activated. |
| Client integration | Partial | Hosted query hooks exist, but the home decision path still runs from the transitional offline bundle. |
| Transition audit | Not complete | Provider-era commands, names, docs, and data remain until replacement parity is proven. |
| Release verification | Blocked on an approved source | There is no approved external source in the manifest yet. |

## Current source gate

`wikibooks-cookbook` is registered in
`tools/catalog/rights-manifest.json` as a **candidate**, not an approved
release source. The recorded `latest` Wikimedia URL is discovery metadata and
is mutable. Candidate sources deliberately have no SHA-256 and are excluded
from download, ingestion, and release activation.

Promotion requires all of the following:

1. Resolve the discovery URL to an immutable dated Wikimedia dump.
2. Record and independently verify its SHA-256.
3. Stream the Cookbook namespace into the source-neutral JSONL contract.
4. Preserve page-level source and license evidence through normalization.
5. Pass parser, attribution, equipment, allergen, dietary, and parity gates.
6. Change the manifest entry to the release-grade JSONL archive only after
   review.

## Work sequence

1. **Documentation and legacy cleanup.** Establish the canonical design,
   retire provider-era plans/specs, repair links, and update project guidance.
2. **Build pipeline.** Replace provider-shaped ingestion with a source-neutral,
   checksum-verified rights manifest, deterministic normalization,
   quarantine, and explicit ingest/validate/build-offline/load/activate
   boundaries. Do not overwrite the transitional bundle.
3. **Hosted catalog contract.** Add releases, sources, ingredients, recipes,
   and ordered recipe ingredients with RLS; add bounded authenticated candidate,
   detail, and attribution RPCs; update local generated types without contacting
   the live project.
4. **Client integration.** Rename bundled data to offline terminology, render
   offline answers first, merge hosted candidates safely, resolve detail from
   cache/hosted/offline data, and use active attribution data in Settings.
5. **Transition audit.** Remove active provider API semantics and keys, inspect
   the abandoned provider worktree read-only, and document any legal, parity,
   or remote-operation gate that remains.
6. **Release verification.** Run TypeScript, Python, formatting, lint, type,
   migration, security, performance-smoke, link, and residue checks. Confirm
   the full hosted catalog does not enter the Metro bundle.

## Non-negotiable checks

- No recipe-provider API, key, endpoint, quota guard, live fallback, or tier
  semantic remains active.
- Only approved, checksum-pinned sources enter a release.
- A mutable discovery URL can never become release input.
- The engine remains synchronous and pure; it receives `Recipe[]` only.
- Equipment, allergens, and dietary restrictions never relax; unknown status
  excludes.
- The product leads with a few answers, reveals more only on request, and never becomes a recipe
  browser.
- Hosted failure retains offline results. No empty results screen.
- Every catalog table has RLS in the same migration and no direct client writes.
- No remote migration, source download, or Supabase mutation occurs without
  explicit target-specific authorization.

## Completion evidence

The change is ready for handoff when the new catalog path is reproducible from
the approved manifest, release activation is auditable, the hosted-plus-offline
client path keeps hard constraints invariant, attribution is active-release
data, and the transitional bundle's remaining parity or legal gate is stated
plainly.

## Related documents

- [Owned catalog design](../specs/2026-08-22-owned-recipe-catalog-design.md)
- [Wikibooks source design](../specs/2026-08-13-wikibooks-catalog-design.md)
- [Wikibooks implementation plan](2026-08-13-wikibooks-catalog.md)
- [Technical specification](../01_TECHNICAL_SPEC.md)
