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

insert into _journey_schema_results values
  ('private schema usage has the exact direct allowlist', exists (
    select 1
      from pg_namespace namespace_row
     where namespace_row.nspname = 'private'
       and has_schema_privilege('authenticated', 'private', 'USAGE')
       and not has_schema_privilege('anon', 'private', 'USAGE')
       and (
         select count(*) = 1
           from aclexplode(
             coalesce(
               namespace_row.nspacl,
               acldefault('n', namespace_row.nspowner)
             )
           ) acl
           join pg_roles role_row on role_row.oid = acl.grantee
          where role_row.rolname = 'authenticated'
            and acl.privilege_type = 'USAGE'
       )
       and not exists (
         select 1
           from aclexplode(
             coalesce(
               namespace_row.nspacl,
               acldefault('n', namespace_row.nspowner)
             )
           ) acl
           left join pg_roles grantee_role on grantee_role.oid = acl.grantee
          where acl.privilege_type = 'USAGE'
            and (acl.grantee = 0 or grantee_role.rolname = 'anon')
       )
       and not exists (
         select 1
           from aclexplode(
             coalesce(
               namespace_row.nspacl,
               acldefault('n', namespace_row.nspowner)
             )
           ) acl
          where acl.privilege_type = 'USAGE'
            and acl.grantee <> namespace_row.nspowner
            and not exists (
              select 1
                from pg_roles allowed_role
               where allowed_role.oid = acl.grantee
                 and allowed_role.rolname in ('authenticated', 'service_role')
            )
       )
  ));

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

-- Exact catalog shape rejects extra key/INCLUDE columns, predicates, changed
-- order or method, and a renamed index while avoiding formatting assumptions
-- about the complete CREATE INDEX rendering.
insert into _journey_schema_results
select format('%s has exact index %s', table_name, index_name),
       exists (
         select 1
           from pg_index index_row
           join pg_class index_class
             on index_class.oid = index_row.indexrelid
           join pg_am access_method
             on access_method.oid = index_class.relam
          where index_row.indrelid = to_regclass(
                  format('public.%I', expected.table_name)
                )
            and index_class.relname = expected.index_name
            and access_method.amname = 'btree'
            and index_row.indisunique = expected.is_unique
            and index_row.indisvalid
            and index_row.indisready
            and index_row.indnkeyatts = cardinality(expected.expressions)
            and index_row.indnatts = index_row.indnkeyatts
            and index_row.indpred is null
            and index_row.indexprs is null
            and (
              select array_agg(
                       pg_get_indexdef(index_row.indexrelid, key_position, true)
                       order by key_position
                     )
                from generate_series(1, index_row.indnkeyatts)
                  positions(key_position)
            ) = expected.expressions
       )
  from (values
    ('taste_signals', 'taste_signals_user_recorded_at_idx',
     array['user_id', 'recorded_at'], false),
    ('meal_satiety', 'meal_satiety_user_recorded_at_idx',
     array['user_id', 'recorded_at'], false),
    ('weekly_meal_plans', 'weekly_meal_plans_user_week_idx',
     array['user_id', 'week_start'], true),
    ('weekly_meal_plan_entries', 'weekly_meal_plan_entries_user_plan_idx',
     array['user_id', 'plan_id'], false),
    ('weekly_meal_plan_entries', 'weekly_meal_plan_entries_plan_owner_idx',
     array['plan_id', 'user_id'], false),
    ('plan_linked_grocery_needs', 'plan_linked_grocery_needs_user_plan_idx',
     array['user_id', 'plan_id'], false),
    ('plan_linked_grocery_needs', 'plan_linked_grocery_needs_plan_owner_idx',
     array['plan_id', 'user_id'], false)
  ) as expected(table_name, index_name, expressions, is_unique);

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
    ('public.create_weekly_meal_plan(date,text,text[],jsonb,jsonb)')
  ) as expected(signature);

insert into _journey_schema_results values
  ('private payload validator is invoker with exact helper execution access', exists (
    select 1
      from pg_proc p
     where p.oid = to_regprocedure(
             'private.validate_weekly_plan_payload(date,jsonb,jsonb)'
           )
       and not p.prosecdef
       and has_function_privilege('authenticated', p.oid, 'EXECUTE')
       and not has_function_privilege('anon', p.oid, 'EXECUTE')
       and (
         select count(*) = 1
           from aclexplode(
             coalesce(p.proacl, acldefault('f', p.proowner))
           ) acl
           join pg_roles role_row on role_row.oid = acl.grantee
          where role_row.rolname = 'authenticated'
            and acl.privilege_type = 'EXECUTE'
       )
       and not exists (
         select 1
           from aclexplode(
             coalesce(p.proacl, acldefault('f', p.proowner))
           ) acl
           left join pg_roles grantee_role on grantee_role.oid = acl.grantee
          where acl.privilege_type = 'EXECUTE'
            and (acl.grantee = 0 or grantee_role.rolname = 'anon')
       )
       and not exists (
         select 1
           from aclexplode(
             coalesce(p.proacl, acldefault('f', p.proowner))
           ) acl
          where acl.privilege_type = 'EXECUTE'
            and acl.grantee <> p.proowner
            and not exists (
              select 1
                from pg_roles allowed_role
               where allowed_role.oid = acl.grantee
                 and allowed_role.rolname = 'authenticated'
            )
       )
  ));

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
