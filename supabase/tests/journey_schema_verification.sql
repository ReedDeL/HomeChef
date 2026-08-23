-- Structural proof for the personal meal-journey schema. This complements
-- rls_verification.sql: catalog assertions catch an accidentally broad grant,
-- predicate, or FK even when today's data fixtures do not exercise it.
\set ON_ERROR_STOP on

begin;

create temp table _journey_schema_results (
  assertion text,
  pass boolean
);

create temp table _journey_tables (table_name text primary key);
insert into _journey_tables values
  ('body_profiles'),
  ('taste_signals'),
  ('meal_satiety'),
  ('onboarding_progress'),
  ('weekly_meal_plans'),
  ('weekly_meal_plan_entries'),
  ('plan_linked_grocery_needs'),
  ('meal_reminder_preferences');

insert into _journey_schema_results
select format('%s exists with RLS enabled', table_name),
       c.oid is not null and c.relrowsecurity
  from _journey_tables expected
  left join pg_class c
    on c.oid = to_regclass(format('public.%I', expected.table_name));

insert into _journey_schema_results
select format('%s.user_id is present and NOT NULL', expected.table_name),
       count(*) = 1 and bool_and(c.is_nullable = 'NO')
  from _journey_tables expected
  left join information_schema.columns c
    on c.table_schema = 'public'
   and c.table_name = expected.table_name
   and c.column_name = 'user_id'
 group by expected.table_name;

insert into _journey_schema_results
select format('%s.user_id references profiles(id) with cascade', table_name),
       exists (
         select 1
           from pg_constraint constraint_row
          where constraint_row.conrelid = to_regclass(
                  format('public.%I', expected.table_name)
                )
            and constraint_row.contype = 'f'
            and constraint_row.confrelid = to_regclass('public.profiles')
            and constraint_row.confdeltype = 'c'
            and pg_get_constraintdef(constraint_row.oid) =
                'FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE'
       )
  from (values
    ('body_profiles'),
    ('taste_signals'),
    ('meal_satiety'),
    ('onboarding_progress'),
    ('weekly_meal_plans'),
    ('meal_reminder_preferences')
  ) as expected(table_name);

insert into _journey_schema_results
select format('%s has no household_id', expected.table_name),
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
  ('weekly entries have exact composite parent ownership FK with cascade', exists (
    select 1
      from pg_constraint c
     where c.conrelid = to_regclass('public.weekly_meal_plan_entries')
       and c.contype = 'f'
       and c.confrelid = to_regclass('public.weekly_meal_plans')
       and c.confdeltype = 'c'
       and pg_get_constraintdef(c.oid) =
         'FOREIGN KEY (plan_id, user_id) REFERENCES weekly_meal_plans(id, user_id) ON DELETE CASCADE'
  )),
  ('grocery needs have exact composite parent ownership FK with cascade', exists (
    select 1
      from pg_constraint c
     where c.conrelid = to_regclass('public.plan_linked_grocery_needs')
       and c.contype = 'f'
       and c.confrelid = to_regclass('public.weekly_meal_plans')
       and c.confdeltype = 'c'
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
  ));

-- has_table_privilege checks effective privileges, including anything inherited
-- from PUBLIC. The ACL assertion separately proves PUBLIC itself has no entry.
insert into _journey_schema_results
select format('%s effective %s privilege matches contract', table_name, privilege),
       has_table_privilege(
         'authenticated', format('public.%I', table_name), privilege
       ) = (privilege = any(expected_privileges))
       and not has_table_privilege(
         'anon', format('public.%I', table_name), privilege
       )
  from (values
    ('body_profiles', array['SELECT', 'INSERT', 'UPDATE', 'DELETE']),
    ('taste_signals', array['SELECT', 'INSERT']),
    ('meal_satiety', array['SELECT', 'INSERT']),
    ('onboarding_progress', array['SELECT', 'INSERT', 'UPDATE']),
    ('weekly_meal_plans', array['SELECT', 'INSERT', 'UPDATE', 'DELETE']),
    ('weekly_meal_plan_entries', array['SELECT', 'INSERT', 'DELETE']),
    ('plan_linked_grocery_needs', array['SELECT', 'INSERT', 'DELETE']),
    ('meal_reminder_preferences', array['SELECT', 'INSERT', 'UPDATE'])
  ) as expected(table_name, expected_privileges)
  cross join unnest(array[
    'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'
  ]) as verbs(privilege);

insert into _journey_schema_results
select format('%s has no direct PUBLIC table privilege', table_name),
       not exists (
         select 1
           from pg_class c
           cross join lateral aclexplode(
             coalesce(c.relacl, acldefault('r', c.relowner))
           ) acl
          where c.oid = to_regclass(format('public.%I', expected.table_name))
            and acl.grantee = 0
       )
  from _journey_tables expected;

create temp table _expected_policies (
  table_name text,
  command text,
  primary key (table_name, command)
);
insert into _expected_policies values
  ('body_profiles', 'SELECT'), ('body_profiles', 'INSERT'),
  ('body_profiles', 'UPDATE'), ('body_profiles', 'DELETE'),
  ('taste_signals', 'SELECT'), ('taste_signals', 'INSERT'),
  ('meal_satiety', 'SELECT'), ('meal_satiety', 'INSERT'),
  ('onboarding_progress', 'SELECT'), ('onboarding_progress', 'INSERT'),
  ('onboarding_progress', 'UPDATE'),
  ('weekly_meal_plans', 'SELECT'), ('weekly_meal_plans', 'INSERT'),
  ('weekly_meal_plans', 'UPDATE'), ('weekly_meal_plans', 'DELETE'),
  ('weekly_meal_plan_entries', 'SELECT'),
  ('weekly_meal_plan_entries', 'INSERT'),
  ('weekly_meal_plan_entries', 'DELETE'),
  ('plan_linked_grocery_needs', 'SELECT'),
  ('plan_linked_grocery_needs', 'INSERT'),
  ('plan_linked_grocery_needs', 'DELETE'),
  ('meal_reminder_preferences', 'SELECT'),
  ('meal_reminder_preferences', 'INSERT'),
  ('meal_reminder_preferences', 'UPDATE');

insert into _journey_schema_results
select format('%s %s policy has exact predicate placement', table_name, command),
       count(policy_row.*) = 1
       and bool_and(policy_row.roles = array['authenticated']::name[])
       and bool_and(
         case command
           when 'INSERT' then policy_row.qual is null
             and policy_row.with_check like '%SELECT auth.uid()%'
             and policy_row.with_check like '%user_id%'
           when 'UPDATE' then policy_row.qual like '%SELECT auth.uid()%'
             and policy_row.qual like '%user_id%'
             and policy_row.with_check like '%SELECT auth.uid()%'
             and policy_row.with_check like '%user_id%'
           else policy_row.qual like '%SELECT auth.uid()%'
             and policy_row.qual like '%user_id%'
             and policy_row.with_check is null
         end
       )
  from _expected_policies expected
  left join pg_policies policy_row
    on policy_row.schemaname = 'public'
   and policy_row.tablename = expected.table_name
   and policy_row.cmd = expected.command
 group by expected.table_name, expected.command;

insert into _journey_schema_results
select format('%s has no extra journey policies', table_name),
       count(distinct policy_row.cmd) = count(distinct expected.command)
       and bool_and(
         exists (
           select 1
             from _expected_policies exact_policy
            where exact_policy.table_name = journey_table.table_name
              and exact_policy.command = policy_row.cmd
         )
       )
  from _journey_tables journey_table
  left join _expected_policies expected using (table_name)
  left join pg_policies policy_row
    on policy_row.schemaname = 'public'
   and policy_row.tablename = journey_table.table_name
 group by journey_table.table_name;

-- Compare the actual ordered index definition and uniqueness, not an index
-- name that could survive while its columns drift.
insert into _journey_schema_results
select format('%s has index definition %s', table_name, columns),
       exists (
         select 1
           from pg_index index_row
          where index_row.indrelid = to_regclass(
                  format('public.%I', expected.table_name)
                )
            and index_row.indisunique = expected.is_unique
            and pg_get_indexdef(index_row.indexrelid) like
                '% USING btree ' || expected.columns
       )
  from (values
    ('taste_signals', '(user_id, recorded_at DESC)', false),
    ('meal_satiety', '(user_id, recorded_at DESC)', false),
    ('weekly_meal_plans', '(user_id, week_start)', true),
    ('weekly_meal_plan_entries', '(user_id, plan_id)', false),
    ('weekly_meal_plan_entries', '(plan_id, user_id)', false),
    ('plan_linked_grocery_needs', '(user_id, plan_id)', false),
    ('plan_linked_grocery_needs', '(plan_id, user_id)', false)
  ) as expected(table_name, columns, is_unique);

insert into _journey_schema_results
select format('%s is security invoker and authenticated-only', signature),
       exists (
         select 1
           from pg_proc p
          where p.oid = to_regprocedure(signature)
            and not p.prosecdef
            and has_function_privilege('authenticated', p.oid, 'EXECUTE')
            and not has_function_privilege('anon', p.oid, 'EXECUTE')
       )
  from (values
    ('public.replace_weekly_plan_children(uuid,jsonb,jsonb)'),
    ('public.create_weekly_meal_plan(date,text,text[],jsonb,jsonb)'),
    ('private.validate_weekly_plan_payload(date,jsonb,jsonb)')
  ) as expected(signature);

select assertion, case when pass then 'PASS' else 'FAIL' end as result
  from _journey_schema_results
 order by assertion;

do $$
declare
  failed int;
begin
  select count(*) into failed
    from _journey_schema_results
   where pass is not true;
  if failed > 0 then
    raise exception '% of % journey schema assertions failed', failed,
      (select count(*) from _journey_schema_results);
  end if;
end $$;

rollback;
