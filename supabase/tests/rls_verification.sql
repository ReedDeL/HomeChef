-- ---------------------------------------------------------------------------
-- RLS verification: two households, three accounts.
--
-- Proves the privacy rule in docs/01_TECHNICAL_SPEC.md §3 actually holds on the
-- live database, not just in the migration text:
--
--   inventory  joins to household_id -- roommates SHARE it
--   preferences, allergens, feedback join to user_id -- roommates CANNOT see it
--
-- Run against any environment. The whole script is one transaction ending in
-- ROLLBACK, so it writes nothing and is safe against a live project:
--
--   psql "$DATABASE_URL" -f supabase/tests/rls_verification.sql
--
-- A read-only reviewer proof would not be enough here. RLS is only observable
-- from inside a session that has actually assumed the `authenticated` role with
-- a JWT claim set, which is what the DO block below does.
-- ---------------------------------------------------------------------------

begin;

create temp table _rls_results (
  n         int,
  assertion text,
  expected  text,
  actual    text,
  pass      boolean
);

-- Three users. The on_auth_user_created trigger bootstraps a household, a
-- profile, a membership row and an empty preferences row for each -- so this
-- exercises the signup path at the same time.
insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-0000-4000-8000-000000000001',
   'authenticated', 'authenticated', 'rls-a@test.invalid',  '{"display_name":"A"}',  now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-0000-4000-8000-000000000002',
   'authenticated', 'authenticated', 'rls-a2@test.invalid', '{"display_name":"A2"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'bbbbbbbb-0000-4000-8000-000000000001',
   'authenticated', 'authenticated', 'rls-b@test.invalid',  '{"display_name":"B"}',  now(), now());

-- A2 moves into A's household. This is the roommate case -- the only reason the
-- household/user split exists at all.
update public.household_members
   set household_id = (select household_id from public.profiles where id = 'aaaaaaaa-0000-4000-8000-000000000001')
 where user_id = 'aaaaaaaa-0000-4000-8000-000000000002';

update public.profiles
   set household_id = (select household_id from public.profiles where id = 'aaaaaaaa-0000-4000-8000-000000000001')
 where id = 'aaaaaaaa-0000-4000-8000-000000000002';

-- Seeded as the table owner, which bypasses RLS. Every read below does not.
insert into public.inventory (household_id, ingredient_id, source)
select household_id, x.ingredient_id, 'manual'
  from public.profiles p
  cross join (values ('egg'), ('milk')) as x(ingredient_id)
 where p.id = 'aaaaaaaa-0000-4000-8000-000000000001';

insert into public.inventory (household_id, ingredient_id, source)
select household_id, 'rice', 'manual'
  from public.profiles where id = 'bbbbbbbb-0000-4000-8000-000000000001';

insert into public.meal_feedback (user_id, recipe_id, verdict)
values ('aaaaaaaa-0000-4000-8000-000000000001', 'bundled-0001', 'liked'),
       ('bbbbbbbb-0000-4000-8000-000000000001', 'bundled-0002', 'disliked');

-- An allergen is the highest-stakes private field in the schema. If a roommate
-- can read this row, the privacy model has failed.
update public.user_preferences
   set allergens = array['peanut'], equipment = array['microwave']
 where user_id = 'aaaaaaaa-0000-4000-8000-000000000001';


do $$
declare
  user_a  uuid := 'aaaaaaaa-0000-4000-8000-000000000001';
  user_a2 uuid := 'aaaaaaaa-0000-4000-8000-000000000002';
  user_b  uuid := 'bbbbbbbb-0000-4000-8000-000000000001';
  household_b uuid;
  results text[] := '{}';
  n int;
  blocked boolean;
begin
  select household_id into household_b from public.profiles where id = user_b;

  ------------------------------------------------------------------ as A -----
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
                     json_build_object('sub', user_a, 'role', 'authenticated')::text, true);

  select count(*) into n from public.households;
  results := results || format('1|A sees only their own household|1|%s', n);

  select count(*) into n from public.profiles;
  results := results || format('2|A sees self plus roommate, not B|2|%s', n);

  select count(*) into n from public.household_members;
  results := results || format('3|A sees own household roster only|2|%s', n);

  select count(*) into n from public.inventory;
  results := results || format('4|A sees own pantry only|2|%s', n);

  select count(*) into n from public.inventory where household_id = household_b;
  results := results || format('5|B pantry invisible to A|0|%s', n);

  select count(*) into n from public.user_preferences;
  results := results || format('6|A sees own preferences only|1|%s', n);

  select count(*) into n from public.meal_feedback;
  results := results || format('7|A sees own feedback only|1|%s', n);

  -- Negative writes. Each runs in its own subtransaction so a policy violation
  -- does not abort the run -- being blocked IS the passing outcome.
  blocked := false;
  begin
    insert into public.inventory (household_id, ingredient_id, source)
    values (household_b, 'saffron', 'manual');
  exception when others then blocked := true;
  end;
  results := results || format('8|A cannot stock B pantry|blocked|%s',
                               case when blocked then 'blocked' else 'ALLOWED' end);

  blocked := false;
  begin
    insert into public.meal_feedback (user_id, recipe_id, verdict)
    values (user_b, 'bundled-0003', 'liked');
  exception when others then blocked := true;
  end;
  results := results || format('9|A cannot write feedback as B|blocked|%s',
                               case when blocked then 'blocked' else 'ALLOWED' end);

  update public.user_preferences set allergens = array['nothing'] where user_id = user_b;
  get diagnostics n = row_count;
  results := results || format('10|A cannot edit B allergens|0|%s', n);

  delete from public.inventory where household_id = household_b;
  get diagnostics n = row_count;
  results := results || format('11|A cannot clear B pantry|0|%s', n);

  -- Positive control: a policy set that denies everything is not a passing
  -- policy set. Assertions 8-11 above only mean something if A can still
  -- write their own household's pantry.
  insert into public.inventory (household_id, ingredient_id, source)
  values ((select household_id from public.profiles where id = user_a), 'flour', 'manual');
  get diagnostics n = row_count;
  results := results || format('12|Positive control: A CAN stock own pantry|1|%s', n);

  ----------------------------------------------------- as A2, the roommate ---
  perform set_config('request.jwt.claims',
                     json_build_object('sub', user_a2, 'role', 'authenticated')::text, true);

  -- Shared: this one is supposed to succeed. A pantry nobody can share is just
  -- as broken as preferences everybody can read. 3, not 2 -- the positive
  -- control above added flour to the same household.
  select count(*) into n from public.inventory;
  results := results || format('13|Roommate SHARES the pantry|3|%s', n);

  select count(*) into n from public.user_preferences;
  results := results || format('14|Roommate sees only own preferences|1|%s', n);

  select count(*) into n from public.user_preferences where 'peanut' = any(allergens);
  results := results || format('15|Roommate cannot read A allergens|0|%s', n);

  select count(*) into n from public.meal_feedback;
  results := results || format('16|Roommate cannot read A feedback|0|%s', n);

  --------------------------------------------------------------- as anon -----
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);

  select count(*) into n from public.inventory;
  results := results || format('17|Anon sees no pantry|0|%s', n);

  select count(*) into n from public.user_preferences;
  results := results || format('18|Anon sees no preferences|0|%s', n);

  select count(*) into n from public.households;
  results := results || format('19|Anon sees no households|0|%s', n);

  perform set_config('role', 'postgres', true);

  insert into _rls_results (n, assertion, expected, actual, pass)
  select split_part(r, '|', 1)::int,
         split_part(r, '|', 2),
         split_part(r, '|', 3),
         split_part(r, '|', 4),
         split_part(r, '|', 3) = split_part(r, '|', 4)
    from unnest(results) as r;
end $$;

-- ----------------------------------------------------- scan budget (0005) ----
-- The Gemini daily-scan budget. Three properties matter: clients cannot read
-- the ledger, the cap actually caps, and each user's budget is their own.
-- Calls run as postgres because EXECUTE belongs to service_role only -- the
-- Edge Function's seat -- but identity still comes from the JWT claims, so
-- what is exercised here is the same code path production takes.

do $$
declare
  user_a        uuid := 'aaaaaaaa-0000-4000-8000-000000000001';
  user_b        uuid := 'bbbbbbbb-0000-4000-8000-000000000001';
  results       text[] := '{}';
  blocked       boolean;
  granted       boolean;
  granted_count int;
  i             int;
begin
  -- Ledger hidden from an authenticated session: `private` carries no USAGE
  -- for anon/authenticated (0001), and RLS on the table denies all anyway.
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
                     json_build_object('sub', user_a, 'role', 'authenticated')::text, true);

  blocked := false;
  begin
    perform count(*) from private.pantry_scan_usage;
  exception when others then blocked := true;
  end;
  results := results || format('20|Scan ledger hidden from clients|blocked|%s',
                               case when blocked then 'blocked' else 'ALLOWED' end);

  -- Spend A's budget against a limit of 2: two grants, then a refusal. The
  -- refusal is the point -- an off-by-one here is the cost attack reopening.
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims',
                     json_build_object('sub', user_a, 'role', 'authenticated')::text, true);

  granted_count := 0;
  for i in 1 .. 3 loop
    granted := private.claim_pantry_scan(2);
    if granted then
      granted_count := granted_count + 1;
    end if;
  end loop;
  results := results || format('21|Budget grants exactly the daily limit|2|%s', granted_count);

  -- B's budget starts fresh regardless of how much A has spent today.
  perform set_config('request.jwt.claims',
                     json_build_object('sub', user_b, 'role', 'authenticated')::text, true);
  results := results || format('22|Roommate budget independent|true|%s',
                               private.claim_pantry_scan(2));

  -- No JWT claims, no identity, no scan. This is the branch that keeps the
  -- function safe even if it were ever called without forwarding auth.
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  results := results || format('23|Anonymous claim refused|false|%s',
                               private.claim_pantry_scan(2));

  insert into _rls_results (n, assertion, expected, actual, pass)
  select split_part(r, '|', 1)::int,
         split_part(r, '|', 2),
         split_part(r, '|', 3),
         split_part(r, '|', 4),
         split_part(r, '|', 3) = split_part(r, '|', 4)
    from unnest(results) as r;
end $$;

select n, assertion, expected, actual,
       case when pass then 'PASS' else 'FAIL' end as result
  from _rls_results
 order by n;

-- The SELECT above is just a report -- a FAIL row does not make psql exit
-- non-zero on its own. Raise so a real regression cannot read as CI green.
do $$
declare
  failed int;
begin
  select count(*) into failed from _rls_results where not pass;
  if failed > 0 then
    raise exception '% of % RLS assertions failed -- see the table above', failed,
      (select count(*) from _rls_results);
  end if;
end $$;

-- Nothing above is kept. Re-runnable as many times as you like.
rollback;
