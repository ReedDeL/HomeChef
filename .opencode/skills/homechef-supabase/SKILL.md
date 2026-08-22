---
name: homechef-supabase
description: Use for HomeChef Supabase migrations, RLS, catalog releases, catalog RPCs, household data, and database type updates.
---

# HomeChef Supabase catalog and RLS

Read the technical spec, owned catalog design, affected migration, and RLS tests.
Every table enables RLS in its creation migration. Pantry inventory joins to
`household_id`; preferences and allergens join to `user_id`. Clients have no
direct catalog-table writes. Catalog releases, sources, ingredients, recipes,
and ordered recipe ingredients are protected operational data; release load and
activation are not client mutations.

Candidate/detail/attribution RPCs are authenticated and bounded; candidate
requests clamp to 100 and prefilter hard constraints. Unknown status excludes.
Do not apply a remote migration or activate/load a release without explicit,
target-specific authorization. Extend RLS verification for every policy change.
