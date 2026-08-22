# HomeChef — Collaboration Blueprint

## Working agreement

Use focused branches and small, reviewable commits. Read the governing design
before implementation, preserve unrelated worktree changes, and state any
assumption that changes scope. The Definition of Done is evidence, not a promise.

## Catalog work

The [owned catalog design](specs/2026-08-22-owned-recipe-catalog-design.md) and
[roadmap](plans/2026-08-22-owned-recipe-catalog-roadmap.md) govern catalog work.
The work proceeds in this order: documentation, source-neutral build pipeline,
protected catalog schema/RPCs, hosted-plus-offline client integration, transition
audit, and end-to-end verification.

No contributor may introduce a recipe-provider API, key, endpoint, quota guard,
live fallback, or provider tier. A source enters a release only after rights
approval and checksum verification. Remote source download, Supabase migration,
release load, or activation needs explicit target-specific authorization.

## Definition of Done

- The implementation matches its governing spec and preserves the words pantry,
  catalog, bucket, equipment tier, household, and drift.
- Tests are added before production behavior changes and pass at handoff.
- Hard constraints remain invariant; unknown equipment, allergen, and dietary
  status excludes.
- The product returns no more than 3-4 answers per bucket and never presents an
  empty results screen.
- Every table enables RLS in the creation migration; catalog clients have no
  direct writes and RPC limits are tested.
- Attribution, rights manifest, provenance, and transitional status are reviewed
  with the release path.
- The diff is inspected, formatting and links pass, and the handoff distinguishes
  completed checks from unavailable external verification.

## Review questions

1. Does the change preserve the pure `Recipe[]` decision-engine boundary?
2. Can a hosted failure safely leave the user with offline candidates?
3. Is source approval, checksum, provenance, and attribution enforced rather
   than described by convention?
4. Is the transitional 812-recipe/897-ingredient artifact still represented
   honestly, including its 76 excluded `unclassified` recipes?
5. Did the change avoid unnecessary dependencies, schema expansion, or remote
   mutation?
