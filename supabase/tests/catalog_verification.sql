-- ---------------------------------------------------------------------------
-- Protected catalog verification.
--
-- Run after every migration against a disposable local Supabase database:
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/catalog_verification.sql
--
-- The script seeds multiple releases as the owner, exercises the public surface as
-- actual `anon` and `authenticated` roles, then rolls every fixture back.
-- ---------------------------------------------------------------------------

begin;

create temp table _catalog_results (
  n         int,
  assertion text,
  expected  text,
  actual    text,
  pass      boolean
);

-- Role-switched assertions write only into this transaction-scoped report.
grant insert on _catalog_results to anon, authenticated, service_role;

insert into public.catalog_releases (
  id,
  recipe_count,
  ingredient_count,
  source_count,
  offline_recipe_count,
  offline_ready
)
values
  ('10000000-0000-4000-8000-000000000001', 108, 4, 1, 100, true),
  ('20000000-0000-4000-8000-000000000001', 1, 1, 1, 1, true);

insert into public.catalog_release_sources (
  release_id,
  source_id,
  source_version,
  archive_url,
  archive_sha256,
  license_name,
  license_url,
  attribution,
  rights_status
)
values
  (
    '10000000-0000-4000-8000-000000000001',
    'test-source',
    '2026.08',
    'https://catalog.test/archive.jsonl',
    repeat('a', 64),
    'CC BY 4.0',
    'https://creativecommons.org/licenses/by/4.0/',
    'Test source attribution',
    'approved'
  ),
  (
    '20000000-0000-4000-8000-000000000001',
    'test-source',
    '2026.09',
    'https://catalog.test/archive-2.jsonl',
    repeat('b', 64),
    'CC BY 4.0',
    'https://creativecommons.org/licenses/by/4.0/',
    'Inactive source attribution',
    'approved'
  );

insert into public.catalog_ingredients (
  release_id,
  ingredient_id,
  display_name,
  allergen_groups,
  allergen_status,
  is_staple
)
values
  ('10000000-0000-4000-8000-000000000001', 'egg', 'Egg', array['egg'], 'verified', false),
  ('10000000-0000-4000-8000-000000000001', 'milk', 'Milk', array['dairy'], 'verified', false),
  ('10000000-0000-4000-8000-000000000001', 'rice', 'Rice', '{}', 'verified', true),
  ('10000000-0000-4000-8000-000000000001', 'salt', 'Salt', '{}', 'verified', true),
  ('20000000-0000-4000-8000-000000000001', 'rice', 'Rice', '{}', 'unknown', true);

insert into public.catalog_recipes (
  release_id,
  recipe_id,
  title,
  cuisine,
  total_time_minutes,
  equipment_required,
  equipment_status,
  allergen_status,
  dietary_status,
  dietary_tags,
  instructions,
  is_offline
)
select
  '10000000-0000-4000-8000-000000000001',
  format('safe-%s', lpad(series::text, 3, '0')),
  format('Safe %s', series),
  'test',
  10,
  array['none'],
  'verified',
  'verified',
  'verified',
  array['vegetarian', 'vegan'],
  'Cook safely.',
  series <= 98
from generate_series(1, 101) as series;

insert into public.catalog_recipes (
  release_id,
  recipe_id,
  title,
  cuisine,
  total_time_minutes,
  equipment_required,
  equipment_status,
  allergen_status,
  dietary_status,
  dietary_tags,
  instructions,
  is_offline
)
values
  (
    '10000000-0000-4000-8000-000000000001',
    'egg-recipe',
    'Egg recipe',
    'test',
    10,
    array['none'],
    'verified',
    'verified',
    'verified',
    array['vegetarian'],
    'Cook egg.',
    true
  ),
  (
    '10000000-0000-4000-8000-000000000001',
    'oven-recipe',
    'Oven recipe',
    'test',
    20,
    array['oven'],
    'verified',
    'verified',
    'verified',
    array['vegetarian'],
    'Bake safely.',
    true
  ),
  (
    '10000000-0000-4000-8000-000000000001',
    'unknown-recipe',
    'Unknown recipe',
    'unknown-equipment-test',
    10,
    array['unclassified'],
    'unknown',
    'verified',
    'verified',
    array['vegetarian'],
    'Unknown equipment.',
    false
  ),
  (
    '10000000-0000-4000-8000-000000000001',
    'excluded-only',
    'Excluded recipe',
    'exclude-test',
    10,
    array['none'],
    'verified',
    'verified',
    'verified',
    array['vegetarian'],
    'Exclude me.',
    false
  ),
  (
    '10000000-0000-4000-8000-000000000001',
    'allergen-group-only',
    'Dairy group recipe',
    'allergen-group-test',
    10,
    array['none'],
    'verified',
    'verified',
    'verified',
    array['vegetarian'],
    'Contains dairy group.',
    false
  ),
  (
    '10000000-0000-4000-8000-000000000001',
    'unknown-allergen-recipe',
    'Unknown allergen recipe',
    'unknown-allergen-test',
    10,
    array['none'],
    'verified',
    'unknown',
    'verified',
    array['vegetarian'],
    'Allergen status unknown.',
    false
  ),
  (
    '10000000-0000-4000-8000-000000000001',
    'unknown-dietary-recipe',
    'Unknown dietary recipe',
    'unknown-dietary-test',
    10,
    array['none'],
    'verified',
    'verified',
    'unknown',
    array['vegetarian'],
    'Dietary status unknown.',
    false
  ),
  (
    '20000000-0000-4000-8000-000000000001',
    'inactive-recipe',
    'Inactive recipe',
    'inactive-only',
    10,
    array['none'],
    'verified',
    'verified',
    'verified',
    array['vegetarian'],
    'Do not leak.',
    true
  );

insert into public.catalog_recipe_ingredients (
  release_id,
  recipe_id,
  position,
  ingredient_id,
  quantity,
  unit,
  raw_measure
)
select
  '10000000-0000-4000-8000-000000000001',
  format('safe-%s', lpad(series::text, 3, '0')),
  1,
  'rice',
  1,
  'cup',
  '1 cup'
from generate_series(1, 101) as series;

insert into public.catalog_recipe_ingredients (
  release_id,
  recipe_id,
  position,
  ingredient_id,
  quantity,
  unit,
  raw_measure
)
values
  ('10000000-0000-4000-8000-000000000001', 'safe-001', 2, 'salt', null, null, 'to taste'),
  ('10000000-0000-4000-8000-000000000001', 'egg-recipe', 1, 'egg', 2, null, '2'),
  ('10000000-0000-4000-8000-000000000001', 'oven-recipe', 1, 'rice', 1, 'cup', '1 cup'),
  ('10000000-0000-4000-8000-000000000001', 'unknown-recipe', 1, 'rice', 1, 'cup', '1 cup'),
  ('10000000-0000-4000-8000-000000000001', 'excluded-only', 1, 'rice', 1, 'cup', '1 cup'),
  ('10000000-0000-4000-8000-000000000001', 'allergen-group-only', 1, 'milk', 1, 'cup', '1 cup'),
  ('10000000-0000-4000-8000-000000000001', 'unknown-allergen-recipe', 1, 'rice', 1, 'cup', '1 cup'),
  ('10000000-0000-4000-8000-000000000001', 'unknown-dietary-recipe', 1, 'rice', 1, 'cup', '1 cup'),
  ('20000000-0000-4000-8000-000000000001', 'inactive-recipe', 1, 'rice', 1, 'cup', '1 cup');

insert into public.catalog_recipe_sources (
  release_id,
  recipe_id,
  source_id,
  source_version,
  source_recipe_id,
  archive_sha256
)
select
  '10000000-0000-4000-8000-000000000001',
  format('safe-%s', lpad(series::text, 3, '0')),
  'test-source',
  '2026.08',
  format('source-safe-%s', lpad(series::text, 3, '0')),
  repeat('a', 64)
from generate_series(1, 101) as series;

insert into public.catalog_recipe_sources (
  release_id,
  recipe_id,
  source_id,
  source_version,
  source_recipe_id,
  archive_sha256
)
values
  ('10000000-0000-4000-8000-000000000001', 'egg-recipe', 'test-source', '2026.08', 'egg', repeat('a', 64)),
  ('10000000-0000-4000-8000-000000000001', 'oven-recipe', 'test-source', '2026.08', 'oven', repeat('a', 64)),
  ('10000000-0000-4000-8000-000000000001', 'unknown-recipe', 'test-source', '2026.08', 'unknown', repeat('a', 64)),
  ('10000000-0000-4000-8000-000000000001', 'excluded-only', 'test-source', '2026.08', 'excluded', repeat('a', 64)),
  ('10000000-0000-4000-8000-000000000001', 'allergen-group-only', 'test-source', '2026.08', 'dairy', repeat('a', 64)),
  ('10000000-0000-4000-8000-000000000001', 'unknown-allergen-recipe', 'test-source', '2026.08', 'unknown-allergen', repeat('a', 64)),
  ('10000000-0000-4000-8000-000000000001', 'unknown-dietary-recipe', 'test-source', '2026.08', 'unknown-dietary', repeat('a', 64)),
  ('20000000-0000-4000-8000-000000000001', 'inactive-recipe', 'test-source', '2026.09', 'inactive', repeat('b', 64));

-- Each fixture isolates one activation invariant. They remain inactive until
-- their individual assertion runs below.
insert into public.catalog_releases (
  id, recipe_count, ingredient_count, source_count, offline_recipe_count, offline_ready
)
values
  ('30000000-0000-4000-8000-000000000001', 0, 0, 0, 0, true),
  ('40000000-0000-4000-8000-000000000001', 2, 1, 1, 1, true),
  ('50000000-0000-4000-8000-000000000001', 1, 1, 1, 1, false),
  ('60000000-0000-4000-8000-000000000001', 1, 1, 1, 1, true),
  ('70000000-0000-4000-8000-000000000001', 1, 1, 1, 1, true),
  ('80000000-0000-4000-8000-000000000001', 1, 1, 1, 1, true),
  ('90000000-0000-4000-8000-000000000001', 1, 1, 1, 1, true),
  ('a0000000-0000-4000-8000-000000000001', 1, 1, 1, 1, true);

insert into public.catalog_release_sources (
  release_id, source_id, source_version, archive_url, archive_sha256,
  license_name, license_url, attribution, rights_status
)
values
  ('40000000-0000-4000-8000-000000000001', 'extra-source', '1', 'https://extra.test/a', repeat('c', 64), 'CC BY 4.0', 'https://creativecommons.org/licenses/by/4.0/', 'Extra attribution', 'approved'),
  ('50000000-0000-4000-8000-000000000001', 'extra-source', '1', 'https://extra.test/b', repeat('c', 64), 'CC BY 4.0', 'https://creativecommons.org/licenses/by/4.0/', 'Extra attribution', 'approved'),
  ('60000000-0000-4000-8000-000000000001', 'extra-source', '1', 'https://extra.test/c', repeat('c', 64), 'CC BY 4.0', 'https://creativecommons.org/licenses/by/4.0/', 'Extra attribution', 'quarantine'),
  ('70000000-0000-4000-8000-000000000001', 'extra-source', '1', 'https://extra.test/d', repeat('c', 64), 'CC BY 4.0', 'https://creativecommons.org/licenses/by/4.0/', 'Extra attribution', 'approved'),
  ('80000000-0000-4000-8000-000000000001', 'extra-source', '1', 'https://extra.test/e', repeat('c', 64), 'CC BY 4.0', 'https://creativecommons.org/licenses/by/4.0/', 'Extra attribution', 'approved'),
  ('90000000-0000-4000-8000-000000000001', 'extra-source', '1', 'https://extra.test/f', repeat('c', 64), 'CC BY 4.0', 'https://creativecommons.org/licenses/by/4.0/', 'Extra attribution', 'approved'),
  ('a0000000-0000-4000-8000-000000000001', 'extra-source', '1', 'https://extra.test/g', repeat('c', 64), 'CC BY 4.0', 'https://creativecommons.org/licenses/by/4.0/', 'Extra attribution', 'approved');

insert into public.catalog_ingredients (
  release_id, ingredient_id, display_name, allergen_groups, allergen_status, is_staple
)
select release.id, 'rice', 'Rice', '{}', 'verified', true
  from public.catalog_releases as release
 where release.id = any(array[
   '40000000-0000-4000-8000-000000000001'::uuid,
   '50000000-0000-4000-8000-000000000001'::uuid,
   '60000000-0000-4000-8000-000000000001'::uuid,
   '70000000-0000-4000-8000-000000000001'::uuid,
   '80000000-0000-4000-8000-000000000001'::uuid,
   '90000000-0000-4000-8000-000000000001'::uuid,
   'a0000000-0000-4000-8000-000000000001'::uuid
 ]);

insert into public.catalog_recipes (
  release_id, recipe_id, title, cuisine, total_time_minutes, equipment_required,
  equipment_status, allergen_status, dietary_status, dietary_tags, instructions, is_offline
)
values
  ('40000000-0000-4000-8000-000000000001', 'count-mismatch', 'Count mismatch', 'extra', 10, array['none'], 'verified', 'verified', 'verified', array['vegetarian'], 'Counts mismatch.', true),
  ('50000000-0000-4000-8000-000000000001', 'offline-not-ready', 'Offline not ready', 'extra', 10, array['none'], 'verified', 'verified', 'verified', array['vegetarian'], 'Offline not ready.', true),
  ('60000000-0000-4000-8000-000000000001', 'quarantine-rights', 'Quarantine rights', 'extra', 10, array['none'], 'verified', 'verified', 'verified', array['vegetarian'], 'Quarantine rights.', true),
  ('70000000-0000-4000-8000-000000000001', 'unsafe-equipment', 'Unsafe equipment', 'extra', 10, array['unclassified'], 'unknown', 'verified', 'verified', array['vegetarian'], 'Unsafe equipment.', true),
  ('80000000-0000-4000-8000-000000000001', 'unsafe-allergen', 'Unsafe allergen', 'extra', 10, array['none'], 'verified', 'unknown', 'verified', array['vegetarian'], 'Unsafe allergen.', true),
  ('90000000-0000-4000-8000-000000000001', 'unsafe-dietary', 'Unsafe dietary', 'extra', 10, array['none'], 'verified', 'verified', 'unknown', array['vegetarian'], 'Unsafe dietary.', true),
  ('a0000000-0000-4000-8000-000000000001', 'switch-release', 'Switch release', 'switch', 10, array['none'], 'verified', 'verified', 'verified', array['vegetarian'], 'Switch safely.', true);

insert into public.catalog_recipe_ingredients (
  release_id, recipe_id, position, ingredient_id, quantity, unit, raw_measure
)
select recipe.release_id, recipe.recipe_id, 1, 'rice', 1, 'cup', '1 cup'
  from public.catalog_recipes as recipe
 where recipe.release_id = any(array[
   '40000000-0000-4000-8000-000000000001'::uuid,
   '50000000-0000-4000-8000-000000000001'::uuid,
   '60000000-0000-4000-8000-000000000001'::uuid,
   '70000000-0000-4000-8000-000000000001'::uuid,
   '80000000-0000-4000-8000-000000000001'::uuid,
   '90000000-0000-4000-8000-000000000001'::uuid,
   'a0000000-0000-4000-8000-000000000001'::uuid
 ]);

insert into public.catalog_recipe_sources (
  release_id, recipe_id, source_id, source_version, source_recipe_id, archive_sha256
)
select recipe.release_id, recipe.recipe_id, 'extra-source', '1', recipe.recipe_id, repeat('c', 64)
  from public.catalog_recipes as recipe
 where recipe.release_id = any(array[
   '40000000-0000-4000-8000-000000000001'::uuid,
   '50000000-0000-4000-8000-000000000001'::uuid,
   '60000000-0000-4000-8000-000000000001'::uuid,
   '70000000-0000-4000-8000-000000000001'::uuid,
   '80000000-0000-4000-8000-000000000001'::uuid,
   '90000000-0000-4000-8000-000000000001'::uuid,
   'a0000000-0000-4000-8000-000000000001'::uuid
 ]);

do $$
declare
  blocked boolean;
  n int;
  active_insert_blocked boolean;
  direct_activation_blocked boolean;
  active_mutation_blocked boolean;
  active_deletion_blocked boolean;
  active_child_insert_blocked boolean;
  active_child_update_blocked boolean;
  active_child_deletion_blocked boolean;
  activation_count int;
begin
  perform set_config('role', 'service_role', true);

  blocked := false;
  begin
    insert into public.catalog_releases (
      id, recipe_count, ingredient_count, source_count, offline_recipe_count, offline_ready, is_active
    ) values (
      'c0000000-0000-4000-8000-000000000001', 1, 1, 1, 1, true, true
    );
  exception when others then blocked := true;
  end;
  active_insert_blocked := blocked;

  blocked := false;
  begin
    update public.catalog_releases
       set is_active = true
     where id = '10000000-0000-4000-8000-000000000001';
  exception when others then blocked := true;
  end;
  direct_activation_blocked := blocked;

  perform private.activate_catalog_release('10000000-0000-4000-8000-000000000001');
  select count(*) into activation_count from public.catalog_releases where is_active;

  blocked := false;
  begin
    update public.catalog_releases
       set recipe_count = 1
     where id = '10000000-0000-4000-8000-000000000001';
  exception when others then blocked := true;
  end;
  active_mutation_blocked := blocked;

  blocked := false;
  begin
    delete from public.catalog_releases
     where id = '10000000-0000-4000-8000-000000000001';
  exception when others then blocked := true;
  end;
  active_deletion_blocked := blocked;

  blocked := false;
  begin
    insert into public.catalog_recipe_ingredients (
      release_id, recipe_id, position, ingredient_id, quantity, unit, raw_measure
    ) values (
      '10000000-0000-4000-8000-000000000001', 'safe-001', 3, 'rice', 1, 'cup', '1 cup'
    );
  exception when others then blocked := true;
  end;
  active_child_insert_blocked := blocked;

  blocked := false;
  begin
    update public.catalog_recipes
       set title = 'Service role mutation'
     where release_id = '10000000-0000-4000-8000-000000000001'
       and recipe_id = 'safe-001';
  exception when others then blocked := true;
  end;
  active_child_update_blocked := blocked;

  blocked := false;
  begin
    delete from public.catalog_recipe_ingredients
     where release_id = '10000000-0000-4000-8000-000000000001'
       and recipe_id = 'safe-001'
       and position = 2;
  exception when others then blocked := true;
  end;
  active_child_deletion_blocked := blocked;

  perform set_config('role', 'postgres', true);

  insert into _catalog_results values
    (99, 'service role cannot insert an already-active release', 'blocked',
     case when active_insert_blocked then 'blocked' else 'ALLOWED' end, active_insert_blocked);
  insert into _catalog_results values
    (100, 'service role cannot set a release active directly', 'blocked',
     case when direct_activation_blocked then 'blocked' else 'ALLOWED' end, direct_activation_blocked);
  insert into _catalog_results values
    (101, 'service role can activate only through the private function', '1',
     activation_count::text, activation_count = 1);
  insert into _catalog_results values
    (102, 'service role cannot mutate an active release', 'blocked',
     case when active_mutation_blocked then 'blocked' else 'ALLOWED' end, active_mutation_blocked);
  insert into _catalog_results values
    (103, 'service role cannot delete an active release', 'blocked',
     case when active_deletion_blocked then 'blocked' else 'ALLOWED' end, active_deletion_blocked);
  insert into _catalog_results values
    (104, 'service role cannot insert into an active release', 'blocked',
     case when active_child_insert_blocked then 'blocked' else 'ALLOWED' end, active_child_insert_blocked);
  insert into _catalog_results values
    (128, 'service role cannot update an active release child row', 'blocked',
     case when active_child_update_blocked then 'blocked' else 'ALLOWED' end, active_child_update_blocked);
  insert into _catalog_results values
    (129, 'service role cannot delete an active release child row', 'blocked',
     case when active_child_deletion_blocked then 'blocked' else 'ALLOWED' end, active_child_deletion_blocked);

  blocked := false;
  begin
    insert into public.catalog_release_sources (
      release_id, source_id, source_version, archive_url, archive_sha256,
      license_name, license_url, attribution, rights_status
    ) values (
      '30000000-0000-4000-8000-000000000001', 'trailing-url', '1',
      'https://catalog.test/archive.jsonl ', repeat('e', 64), 'CC BY 4.0',
      'https://creativecommons.org/licenses/by/4.0/', 'Trailing URL', 'approved'
    );
  exception when others then blocked := true;
  end;
  insert into _catalog_results values
    (105, 'rights URLs reject trailing whitespace', 'blocked',
     case when blocked then 'blocked' else 'ALLOWED' end, blocked);

  blocked := false;
  begin
    insert into public.catalog_ingredients (
      release_id, ingredient_id, display_name, allergen_groups, allergen_status
    ) values (
      '30000000-0000-4000-8000-000000000001', 'null-allergen', 'Null allergen',
      array['dairy', null], 'verified'
    );
  exception when others then blocked := true;
  end;
  insert into _catalog_results values
    (106, 'ingredient allergen arrays reject null elements', 'blocked',
     case when blocked then 'blocked' else 'ALLOWED' end, blocked);

  blocked := false;
  begin
    insert into public.catalog_recipes (
      release_id, recipe_id, title, total_time_minutes, equipment_required,
      equipment_status, allergen_status, dietary_status, dietary_tags, instructions
    ) values (
      '30000000-0000-4000-8000-000000000001', 'null-equipment', 'Null equipment', 10,
      array['none', null], 'verified', 'verified', 'verified', array['vegetarian'], 'Invalid.'
    );
  exception when others then blocked := true;
  end;
  insert into _catalog_results values
    (107, 'recipe equipment arrays reject null elements', 'blocked',
     case when blocked then 'blocked' else 'ALLOWED' end, blocked);

  blocked := false;
  begin
    insert into public.catalog_recipes (
      release_id, recipe_id, title, total_time_minutes, equipment_required,
      equipment_status, allergen_status, dietary_status, dietary_tags, instructions
    ) values (
      '30000000-0000-4000-8000-000000000001', 'null-dietary', 'Null dietary', 10,
      array['none'], 'verified', 'verified', 'verified', array['vegetarian', null], 'Invalid.'
    );
  exception when others then blocked := true;
  end;
  insert into _catalog_results values
    (108, 'recipe dietary arrays reject null elements', 'blocked',
     case when blocked then 'blocked' else 'ALLOWED' end, blocked);

  blocked := false;
  begin
    insert into public.catalog_recipe_ingredients (
      release_id, recipe_id, position, ingredient_id, raw_measure
    ) values (
      '40000000-0000-4000-8000-000000000001', 'count-mismatch', 2, 'rice', '  '
    );
  exception when others then blocked := true;
  end;
  insert into _catalog_results values
    (109, 'raw measures reject blank values', 'blocked',
     case when blocked then 'blocked' else 'ALLOWED' end, blocked);
end $$;

do $$
declare
  active_release uuid;
  n int;
  blocked boolean;
  ordered_ingredients jsonb;
  detail_provenance jsonb;
  candidate_ingredients jsonb;
begin
  select id into active_release from public.catalog_releases where is_active;
  insert into _catalog_results values
    (1, 'activation selects exactly the requested valid release',
     '10000000-0000-4000-8000-000000000001', active_release::text,
     active_release = '10000000-0000-4000-8000-000000000001');

  perform private.activate_catalog_release('10000000-0000-4000-8000-000000000001');
  select count(*) into n from public.catalog_releases where is_active;
  insert into _catalog_results values
    (2, 're-activating the active release is idempotent', '1', n::text, n = 1);

  blocked := false;
  begin
    perform private.activate_catalog_release('b0000000-0000-4000-8000-000000000001');
  exception when others then blocked := true;
  end;
  insert into _catalog_results values
    (3, 'activation rejects a nonexistent release', 'blocked',
     case when blocked then 'blocked' else 'ALLOWED' end, blocked);

  blocked := false;
  begin
    perform private.activate_catalog_release('20000000-0000-4000-8000-000000000001');
  exception when others then blocked := true;
  end;
  insert into _catalog_results values
    (4, 'activation rejects offline recipes with unknown ingredient allergen safety', 'blocked',
     case when blocked then 'blocked' else 'ALLOWED' end, blocked);

  blocked := false;
  begin
    perform private.activate_catalog_release('30000000-0000-4000-8000-000000000001');
  exception when others then blocked := true;
  end;
  insert into _catalog_results values
    (110, 'activation rejects an empty release', 'blocked',
     case when blocked then 'blocked' else 'ALLOWED' end, blocked);

  blocked := false;
  begin
    perform private.activate_catalog_release('40000000-0000-4000-8000-000000000001');
  exception when others then blocked := true;
  end;
  insert into _catalog_results values
    (111, 'activation rejects mismatched release counts', 'blocked',
     case when blocked then 'blocked' else 'ALLOWED' end, blocked);

  blocked := false;
  begin
    perform private.activate_catalog_release('50000000-0000-4000-8000-000000000001');
  exception when others then blocked := true;
  end;
  insert into _catalog_results values
    (112, 'activation requires offline readiness', 'blocked',
     case when blocked then 'blocked' else 'ALLOWED' end, blocked);

  blocked := false;
  begin
    perform private.activate_catalog_release('60000000-0000-4000-8000-000000000001');
  exception when others then blocked := true;
  end;
  insert into _catalog_results values
    (113, 'activation rejects quarantined rights metadata', 'blocked',
     case when blocked then 'blocked' else 'ALLOWED' end, blocked);

  blocked := false;
  begin
    perform private.activate_catalog_release('70000000-0000-4000-8000-000000000001');
  exception when others then blocked := true;
  end;
  insert into _catalog_results values
    (114, 'activation rejects unsafe offline equipment metadata', 'blocked',
     case when blocked then 'blocked' else 'ALLOWED' end, blocked);

  blocked := false;
  begin
    perform private.activate_catalog_release('80000000-0000-4000-8000-000000000001');
  exception when others then blocked := true;
  end;
  insert into _catalog_results values
    (115, 'activation rejects unsafe offline allergen metadata', 'blocked',
     case when blocked then 'blocked' else 'ALLOWED' end, blocked);

  blocked := false;
  begin
    perform private.activate_catalog_release('90000000-0000-4000-8000-000000000001');
  exception when others then blocked := true;
  end;
  insert into _catalog_results values
    (116, 'activation rejects unsafe offline dietary metadata', 'blocked',
     case when blocked then 'blocked' else 'ALLOWED' end, blocked);

  blocked := false;
  begin
    insert into public.catalog_recipe_sources (
      release_id, recipe_id, source_id, source_version, source_recipe_id, archive_sha256
    ) values (
      '10000000-0000-4000-8000-000000000001',
      'safe-001',
      'test-source',
      '2026.08',
      'wrong-checksum',
      repeat('c', 64)
    );
  exception when others then blocked := true;
  end;
  insert into _catalog_results values
    (5, 'recipe provenance checksum must match its pinned release source', 'blocked',
     case when blocked then 'blocked' else 'ALLOWED' end, blocked);

  select count(*) into n
    from pg_class relation
   where relation.relkind = 'r'
     and relation.relname in (
       'catalog_releases', 'catalog_release_sources', 'catalog_ingredients',
       'catalog_recipes', 'catalog_recipe_ingredients', 'catalog_recipe_sources'
     )
     and relation.relrowsecurity;
  insert into _catalog_results values
    (6, 'every catalog table enables RLS', '6', n::text, n = 6);

  select count(*) into n
    from pg_class relation
   where relation.relkind = 'r'
     and relation.relname like 'catalog_%'
     and (
       has_table_privilege('anon', relation.oid, 'select,insert,update,delete')
       or has_table_privilege('authenticated', relation.oid, 'select,insert,update,delete')
     );
  insert into _catalog_results values
    (7, 'ordinary roles have no direct catalog-table privileges', '0', n::text, n = 0);

  -- `anon` inherits PUBLIC privileges, so this detects an unrevoked default
  -- PUBLIC execute grant without depending on a pseudo-role lookup.
  select count(*) into n
    from pg_proc function
   where function.pronamespace = 'public'::regnamespace
     and function.proname in ('catalog_candidates', 'catalog_recipe_detail', 'catalog_attributions')
     and has_function_privilege('authenticated', function.oid, 'execute')
     and not has_function_privilege('anon', function.oid, 'execute');
  insert into _catalog_results values
    (8, 'only authenticated can execute every public catalog RPC', '3', n::text, n = 3);

  select count(*) into n
    from pg_proc function
   where function.pronamespace = 'private'::regnamespace
     and function.proname = 'activate_catalog_release'
     and (
       has_function_privilege('anon', function.oid, 'execute')
       or has_function_privilege('authenticated', function.oid, 'execute')
     );
  insert into _catalog_results values
    (9, 'ordinary roles cannot activate a catalog release', '0', n::text, n = 0);

  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  blocked := false;
  begin
    perform public.catalog_attributions();
  exception when others then blocked := true;
  end;
  insert into _catalog_results values
    (10, 'anon catalog RPC call is rejected', 'blocked',
     case when blocked then 'blocked' else 'ALLOWED' end, blocked);

  perform set_config('role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}',
    true
  );

  select count(*) into n
    from public.catalog_candidates(
      array['rice'], array['none'], array['egg'], array['vegetarian'], 15, 'test', '{}', 1000
    );
  insert into _catalog_results values
    (11, 'candidate RPC excludes allergens, unavailable equipment, and unknown safety metadata',
     '100', n::text, n = 100);

  select count(*) into n
    from public.catalog_candidates('{}', array['none'], '{}', '{}', null, null, '{}', 0);
  insert into _catalog_results values
    (12, 'candidate RPC clamps a nonpositive bound to one row', '1', n::text, n = 1);

  select count(*) into n
    from public.catalog_candidates('{}', array['none'], '{}', '{}', null, null, '{}', 1000);
  insert into _catalog_results values
    (13, 'candidate RPC clamps an excessive bound to one hundred rows', '100', n::text, n = 100);

  select count(*) into n
    from public.catalog_candidates('{}', array['none'], '{}', array['vegan'], null, 'test', '{}', 1000);
  insert into _catalog_results values
    (117, 'candidate RPC requires every requested dietary restriction', '100', n::text, n = 100);

  select count(*) into n
    from public.catalog_candidates('{}', array['none'], '{}', '{}', 5, 'test', '{}', 100);
  insert into _catalog_results values
    (118, 'candidate RPC prefilters requested time', '0', n::text, n = 0);

  select count(*) into n
    from public.catalog_candidates('{}', array['none'], '{}', '{}', null, 'inactive-only', '{}', 100);
  insert into _catalog_results values
    (119, 'candidate RPC cannot return inactive-only cuisine candidates', '0', n::text, n = 0);

  select count(*) into n
    from public.catalog_candidates(
      '{}', array['none'], '{}', '{}', null, 'exclude-test', array['excluded-only'], 100
    );
  insert into _catalog_results values
    (120, 'candidate RPC honors caller-supplied excluded recipe ids', '0', n::text, n = 0);

  select count(*) into n
    from public.catalog_candidates(
      '{}', array['none'], array['dairy'], '{}', null, 'allergen-group-test', '{}', 100
    );
  insert into _catalog_results values
    (121, 'candidate RPC excludes caller allergen-group intersections', '0', n::text, n = 0);

  select count(*) into n
    from public.catalog_candidates('{}', array['none'], '{}', '{}', null, 'unknown-allergen-test', '{}', 100);
  insert into _catalog_results values
    (122, 'candidate RPC excludes unknown recipe allergen status', '0', n::text, n = 0);

  select count(*) into n
    from public.catalog_candidates('{}', array['none'], '{}', '{}', null, 'unknown-dietary-test', '{}', 100);
  insert into _catalog_results values
    (123, 'candidate RPC excludes unknown recipe dietary status', '0', n::text, n = 0);

  select count(*) into n
    from public.catalog_candidates('{}', array['none'], '{}', '{}', null, 'unknown-equipment-test', '{}', 100);
  insert into _catalog_results values
    (127, 'candidate RPC excludes unknown recipe equipment status', '0', n::text, n = 0);

  select ingredients into candidate_ingredients
    from public.catalog_candidates('{}', array['none'], '{}', '{}', null, 'test', '{}', 1);
  insert into _catalog_results values
    (124, 'candidate payload includes explicit safety statuses', 'verified,verified',
     concat(
       (select equipment_status from public.catalog_candidates('{}', array['none'], '{}', '{}', null, 'test', '{}', 1)),
       ',', candidate_ingredients -> 0 ->> 'allergenStatus'
     ),
     (select equipment_status from public.catalog_candidates('{}', array['none'], '{}', '{}', null, 'test', '{}', 1)) = 'verified'
       and candidate_ingredients -> 0 ->> 'allergenStatus' = 'verified');

  select ingredients into ordered_ingredients
    from public.catalog_recipe_detail('safe-001');
  insert into _catalog_results values
    (14, 'detail returns active release ingredients in position order with raw measures',
     'rice,salt',
     concat(ordered_ingredients -> 0 ->> 'id', ',', ordered_ingredients -> 1 ->> 'id'),
     ordered_ingredients -> 0 ->> 'id' = 'rice'
       and ordered_ingredients -> 1 ->> 'id' = 'salt'
       and ordered_ingredients -> 1 ->> 'rawMeasure' = 'to taste');

  select provenance into detail_provenance from public.catalog_recipe_detail('safe-001');
  insert into _catalog_results values
    (125, 'detail returns checksum-pinned provenance and ingredient safety status',
     'test-source,verified',
     concat(detail_provenance -> 0 ->> 'sourceId', ',', ordered_ingredients -> 0 ->> 'allergenStatus'),
     detail_provenance -> 0 ->> 'sourceId' = 'test-source'
       and detail_provenance -> 0 ->> 'archiveSha256' = repeat('a', 64)
       and ordered_ingredients -> 0 ->> 'allergenStatus' = 'verified');

  select count(*) into n from public.catalog_recipe_detail('inactive-recipe');
  insert into _catalog_results values
    (15, 'detail cannot cross the active release boundary', '0', n::text, n = 0);

  select count(*) into n from public.catalog_attributions();
  insert into _catalog_results values
    (16, 'attributions expose only active-release sources', '1', n::text, n = 1);

  perform set_config('role', 'postgres', true);
  perform private.activate_catalog_release('a0000000-0000-4000-8000-000000000001');
  select count(*) into n
    from public.catalog_releases
   where id = '10000000-0000-4000-8000-000000000001'
     and not is_active
     and retired_at is not null;
  insert into _catalog_results values
    (126, 'activation retires the previous active release before switching', '1', n::text, n = 1);

  perform set_config('role', 'postgres', true);
end $$;

select n, assertion, expected, actual,
       case when pass then 'PASS' else 'FAIL' end as result
  from _catalog_results
 order by n;

do $$
declare
  failed int;
begin
  select count(*) into failed from _catalog_results where not pass;
  if failed > 0 then
    raise exception '% catalog assertions failed', failed;
  end if;
end $$;

rollback;
