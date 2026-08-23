---
name: homechef-supabase
description: Use when writing or editing Supabase migrations, tables, RLS policies, household/inventory/preferences/allergens schema, storage buckets, database types in src/types/, or anything touching the Postgres schema. Covers the RLS-in-same-migration rule and foreign-key ownership conventions.
---

# Supabase schema, migrations, and RLS

## Read first

- `docs/01_TECHNICAL_SPEC.md` — data model section
- `supabase/migrations/0001_initial_schema.sql` — existing table/policy style
- `supabase/tests/rls_verification.sql` — how RLS is proven

## Rules

**Every table gets RLS, enabled in the same migration that creates it.**
A migration adding a table without `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`
plus its policies is incomplete. Never split them across files.

**Ownership by foreign key:**

- Inventory (pantry items) joins to **`household_id`** — shared per household.
- Preferences and allergens join to **`user_id`** — private per user.
- Roommate privacy is relational and enforced by RLS, not app logic.

**Spoonacular data is borrowed, not owned.** Only `id`, `title`, `imageUrl`
may ever be persisted. Ingredients and instructions are session-scoped —
no column, table, or cache may store them. Enforce with an explicit field
whitelist in code (`src/lib/adapters/`), never by convention.

**No pgvector / hybrid search.** ~320 recipes rank client-side; this decision
is closed.

**Migrations are numbered sequentially** (`0001`, `0002`, …) — next file takes
the next number. Do not edit already-applied migrations; add a new one.

If `src/types/supabase-generated.ts` needs refreshing after a schema change,
regenerate it rather than hand-editing, and keep the generated file's diff
limited to what the migration changed.

## Verify

```sh
npm run typecheck            # generated types still line up with client code
npx vitest run src/lib       # adapters/queries against the new shape
```

For RLS work, extend `supabase/tests/rls_verification.sql` with cases for any
new policy — prove both the allowed and denied paths.
