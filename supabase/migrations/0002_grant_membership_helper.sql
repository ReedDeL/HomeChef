-- ---------------------------------------------------------------------------
-- Fix: authenticated users could not read ANY household-scoped table.
--
-- The RLS policies on households, profiles, household_members and inventory all
-- call private.is_household_member(). 0001 revoked EXECUTE on that function
-- from `authenticated` in an attempt to keep it off the API surface.
--
-- But an RLS policy expression is evaluated as the *querying* role, not as the
-- policy or table owner. So every one of those policies raised
--
--     42501: permission denied for function is_household_member
--
-- rather than filtering rows -- a hard error on the first query the app makes,
-- not a silent over-permission. Caught by supabase/tests/rls_verification.sql
-- running as a real `authenticated` session; it is invisible to any review that
-- only reads the migration, and invisible to a service-role smoke test.
--
-- Granting EXECUTE widens nothing. The function is SECURITY DEFINER and
-- compares against (select auth.uid()) in its own body, so a caller can only
-- ever learn "am I in this household?" -- never who else is, and never about a
-- household they do not belong to. The original goal is still met by the schema
-- boundary, not the grant: `private` is not in PostgREST's exposed schemas, so
-- the function is not reachable over the API regardless. anon stays revoked.
-- ---------------------------------------------------------------------------

grant usage on schema private to authenticated;

grant execute on function private.is_household_member(uuid) to authenticated;
