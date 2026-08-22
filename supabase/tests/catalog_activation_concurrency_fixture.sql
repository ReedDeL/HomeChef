-- Fixture for catalog_activation_concurrency.sh. It intentionally commits one
-- complete inactive release so two independent sessions can race safely.

delete from public.catalog_releases
 where id = 'd0000000-0000-4000-8000-000000000001';

insert into public.catalog_releases (
  id, recipe_count, ingredient_count, source_count, offline_recipe_count, offline_ready
) values (
  'd0000000-0000-4000-8000-000000000001', 1, 1, 1, 1, true
);

insert into public.catalog_release_sources (
  release_id, source_id, source_version, archive_url, archive_sha256,
  license_name, license_url, attribution, rights_status
) values (
  'd0000000-0000-4000-8000-000000000001',
  'concurrency-source',
  '1',
  'https://catalog.test/concurrency.jsonl',
  repeat('d', 64),
  'CC BY 4.0',
  'https://creativecommons.org/licenses/by/4.0/',
  'Concurrency fixture attribution',
  'approved'
);

insert into public.catalog_ingredients (
  release_id, ingredient_id, display_name, allergen_groups, allergen_status, is_staple
) values (
  'd0000000-0000-4000-8000-000000000001', 'rice', 'Rice', '{}', 'verified', true
);

insert into public.catalog_recipes (
  release_id, recipe_id, title, cuisine, total_time_minutes, equipment_required,
  equipment_status, allergen_status, dietary_status, dietary_tags, instructions, is_offline
) values (
  'd0000000-0000-4000-8000-000000000001',
  'concurrency-recipe',
  'Concurrency recipe',
  'test',
  10,
  array['none'],
  'verified',
  'verified',
  'verified',
  array['vegetarian'],
  'Cook safely.',
  true
);

insert into public.catalog_recipe_ingredients (
  release_id, recipe_id, position, ingredient_id, quantity, unit, raw_measure
) values (
  'd0000000-0000-4000-8000-000000000001',
  'concurrency-recipe',
  1,
  'rice',
  1,
  'cup',
  '1 cup'
);

insert into public.catalog_recipe_sources (
  release_id, recipe_id, source_id, source_version, source_recipe_id, archive_sha256
) values (
  'd0000000-0000-4000-8000-000000000001',
  'concurrency-recipe',
  'concurrency-source',
  '1',
  'concurrency-recipe',
  repeat('d', 64)
);
