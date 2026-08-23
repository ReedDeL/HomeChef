-- Structural proof for the personal meal-journey schema. This complements
-- rls_verification.sql: catalog assertions catch an accidentally broad grant
-- or missing FK even when today's data fixtures do not exercise it.
\set ON_ERROR_STOP on

begin;

create temp table _journey_schema_results (
  assertion text,
  pass boolean
);

insert into _journey_schema_results
select format('%s exists with RLS enabled', table_name),
       c.oid is not null and c.relrowsecurity
  from (values
    ('body_profiles'),
    ('taste_signals'),
    ('meal_satiety'),
    ('onboarding_progress'),
    ('weekly_meal_plans'),
    ('weekly_meal_plan_entries'),
    ('plan_linked_grocery_needs'),
    ('meal_reminder_preferences')
  ) as expected(table_name)
  left join pg_class c
    on c.oid = to_regclass(format('public.%I', expected.table_name));

insert into _journey_schema_results
select format('%s is personally owned by user_id', table_name),
       count(*) = 1
  from (values
    ('body_profiles'),
    ('taste_signals'),
    ('meal_satiety'),
    ('onboarding_progress'),
    ('weekly_meal_plans'),
    ('weekly_meal_plan_entries'),
    ('plan_linked_grocery_needs'),
    ('meal_reminder_preferences')
  ) as expected(table_name)
  left join information_schema.columns c
    on c.table_schema = 'public'
   and c.table_name = expected.table_name
   and c.column_name = 'user_id'
 group by expected.table_name;

insert into _journey_schema_results
select format('%s has no household_id', table_name),
       count(c.*) = 0
  from (values
    ('weekly_meal_plans'),
    ('weekly_meal_plan_entries'),
    ('plan_linked_grocery_needs')
  ) as expected(table_name)
  left join information_schema.columns c
    on c.table_schema = 'public'
   and c.table_name = expected.table_name
   and c.column_name = 'household_id'
 group by expected.table_name;

insert into _journey_schema_results values
  ('body_profiles primary key is user_id', exists (
    select 1
      from pg_constraint c
     where c.conrelid = to_regclass('public.body_profiles')
       and c.contype = 'p'
       and pg_get_constraintdef(c.oid) = 'PRIMARY KEY (user_id)'
  )),
  ('weekly entries have composite parent ownership FK with cascade', exists (
    select 1
      from pg_constraint c
     where c.conrelid = to_regclass('public.weekly_meal_plan_entries')
       and c.contype = 'f'
       and pg_get_constraintdef(c.oid) =
         'FOREIGN KEY (plan_id, user_id) REFERENCES weekly_meal_plans(id, user_id) ON DELETE CASCADE'
  )),
  ('grocery needs have composite parent ownership FK with cascade', exists (
    select 1
      from pg_constraint c
     where c.conrelid = to_regclass('public.plan_linked_grocery_needs')
       and c.contype = 'f'
       and pg_get_constraintdef(c.oid) =
         'FOREIGN KEY (plan_id, user_id) REFERENCES weekly_meal_plans(id, user_id) ON DELETE CASCADE'
  )),
  ('inventory source no longer permits shopping_list', exists (
    select 1
      from pg_constraint c
     where c.conrelid = to_regclass('public.inventory')
       and c.contype = 'c'
       and c.conname = 'inventory_source_check'
       and pg_get_constraintdef(c.oid) not like '%shopping_list%'
  ) and not exists (
    select 1 from public.inventory where source = 'shopping_list'
  )),
  ('child replacement RPC is security invoker and authenticated-only', exists (
    select 1
      from pg_proc p
     where p.oid = to_regprocedure(
       'public.replace_weekly_plan_children(uuid,jsonb,jsonb)'
     )
       and not p.prosecdef
       and has_function_privilege(
         'authenticated', p.oid, 'EXECUTE'
       )
       and not has_function_privilege('anon', p.oid, 'EXECUTE')
  ));

insert into _journey_schema_results
select format('%s authenticated grants are exactly %s', table_name, expected_grants),
       coalesce(actual.grants, '') = expected_grants
  from (values
    ('body_profiles', 'DELETE,INSERT,SELECT,UPDATE'),
    ('taste_signals', 'INSERT,SELECT'),
    ('meal_satiety', 'INSERT,SELECT'),
    ('onboarding_progress', 'INSERT,SELECT,UPDATE'),
    ('weekly_meal_plans', 'DELETE,INSERT,SELECT,UPDATE'),
    ('weekly_meal_plan_entries', 'DELETE,INSERT,SELECT'),
    ('plan_linked_grocery_needs', 'DELETE,INSERT,SELECT'),
    ('meal_reminder_preferences', 'INSERT,SELECT,UPDATE')
  ) as expected(table_name, expected_grants)
  left join lateral (
    select string_agg(privilege_type, ',' order by privilege_type) as grants
      from information_schema.role_table_grants
     where table_schema = 'public'
       and information_schema.role_table_grants.table_name = expected.table_name
       and grantee = 'authenticated'
  ) actual on true;

insert into _journey_schema_results
select format('%s policies are exactly %s', table_name, expected_commands),
       coalesce(actual.commands, '') = expected_commands
  from (values
    ('body_profiles', 'DELETE,INSERT,SELECT,UPDATE'),
    ('taste_signals', 'INSERT,SELECT'),
    ('meal_satiety', 'INSERT,SELECT'),
    ('onboarding_progress', 'INSERT,SELECT,UPDATE'),
    ('weekly_meal_plans', 'DELETE,INSERT,SELECT,UPDATE'),
    ('weekly_meal_plan_entries', 'DELETE,INSERT,SELECT'),
    ('plan_linked_grocery_needs', 'DELETE,INSERT,SELECT'),
    ('meal_reminder_preferences', 'INSERT,SELECT,UPDATE')
  ) as expected(table_name, expected_commands)
  left join lateral (
    select string_agg(cmd, ',' order by cmd) as commands
      from pg_policies
     where schemaname = 'public'
       and pg_policies.tablename = expected.table_name
       and roles = array['authenticated']::name[]
  ) actual on true;

insert into _journey_schema_results values
  ('all journey policy predicates cache auth.uid through SELECT', (
    select count(*) = 24
       and bool_and(
         position('SELECT auth.uid()' in coalesce(qual, '') || coalesce(with_check, '')) > 0
       )
      from pg_policies
     where schemaname = 'public'
       and tablename in (
         'body_profiles', 'taste_signals', 'meal_satiety', 'onboarding_progress',
         'weekly_meal_plans', 'weekly_meal_plan_entries',
         'plan_linked_grocery_needs', 'meal_reminder_preferences'
       )
  )),
  ('all journey UPDATE policies have USING and WITH CHECK', (
    select count(*) = 4
       and bool_and(qual is not null and with_check is not null)
      from pg_policies
     where schemaname = 'public'
       and tablename in (
         'body_profiles', 'onboarding_progress', 'weekly_meal_plans',
         'meal_reminder_preferences'
       )
       and cmd = 'UPDATE'
  ));

insert into _journey_schema_results
select format('%s exposes no table privilege to anon', table_name),
       not exists (
         select 1
           from information_schema.role_table_grants g
          where g.table_schema = 'public'
            and g.table_name = expected.table_name
            and g.grantee = 'anon'
       )
  from (values
    ('body_profiles'),
    ('taste_signals'),
    ('meal_satiety'),
    ('onboarding_progress'),
    ('weekly_meal_plans'),
    ('weekly_meal_plan_entries'),
    ('plan_linked_grocery_needs'),
    ('meal_reminder_preferences')
  ) as expected(table_name);

insert into _journey_schema_results
select format('%s has its required ownership/access index', table_name),
       to_regclass(format('public.%I', index_name)) is not null
  from (values
    ('taste_signals', 'taste_signals_user_recorded_at_idx'),
    ('meal_satiety', 'meal_satiety_user_recorded_at_idx'),
    ('weekly_meal_plans', 'weekly_meal_plans_user_week_idx'),
    ('weekly_meal_plan_entries', 'weekly_meal_plan_entries_user_plan_idx'),
    ('weekly_meal_plan_entries', 'weekly_meal_plan_entries_plan_owner_idx'),
    ('plan_linked_grocery_needs', 'plan_linked_grocery_needs_user_plan_idx'),
    ('plan_linked_grocery_needs', 'plan_linked_grocery_needs_plan_owner_idx')
  ) as expected(table_name, index_name);

select assertion, case when pass then 'PASS' else 'FAIL' end as result
  from _journey_schema_results
 order by assertion;

do $$
declare
  failed int;
begin
  select count(*) into failed from _journey_schema_results where not pass;
  if failed > 0 then
    raise exception '% of % journey schema assertions failed', failed,
      (select count(*) from _journey_schema_results);
  end if;
end $$;

rollback;
