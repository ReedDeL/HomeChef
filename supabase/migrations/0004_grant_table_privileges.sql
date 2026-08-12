-- ---------------------------------------------------------------------------
-- Fix: every real authenticated user got "permission denied" on their own
-- data, on every table, since the schema was created.
--
-- RLS policies only filter rows a role is already allowed to attempt to
-- touch -- they do nothing without the coarser table-level GRANT underneath
-- them. 0001 enabled RLS and wrote a policy per operation but never issued a
-- single GRANT, because the project was built against the old Supabase
-- default that auto-exposed new public tables to anon/authenticated. That
-- default is gone (see the auto_expose_new_tables note in
-- supabase/config.toml); without it, "no explicit GRANT" means "no access",
-- full stop, regardless of how correct the RLS policy is.
--
-- Invisible to code review because the migration text reads correctly in
-- isolation -- RLS is enabled, policies exist -- and invisible to any smoke
-- test that runs as postgres or service_role, both of which bypass GRANT
-- checks entirely. Only a real `authenticated` session surfaces it, which is
-- exactly what supabase/tests/rls_verification.sql exists to be. It could
-- not have been enforced in CI, though: rls-verification's migrations were
-- never actually applying in that environment until the workflow's
-- --workdir bug was fixed in the same investigation that found this.
-- ---------------------------------------------------------------------------

grant select, update on public.households to authenticated;
grant select, update on public.profiles to authenticated;
grant select on public.household_members to authenticated;
grant select, insert, update, delete on public.user_preferences to authenticated;
grant select, insert, update, delete on public.meal_feedback to authenticated;
grant select, insert, update, delete on public.inventory to authenticated;

-- No policy grants anon anything on any of these tables, so RLS already
-- denies every row -- these three SELECT grants exist only so an anonymous
-- request gets an empty result set instead of a bare permission error, for
-- the tables docs/01_TECHNICAL_SPEC.md and rls_verification.sql commit to
-- that behavior for (households, user_preferences, inventory).
grant select on public.households to anon;
grant select on public.user_preferences to anon;
grant select on public.inventory to anon;
