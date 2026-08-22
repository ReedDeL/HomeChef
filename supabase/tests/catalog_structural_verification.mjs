import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { stdout } from 'node:process';

const root = resolve(import.meta.dirname, '..', '..');
const migration = readFileSync(
  resolve(root, 'supabase/migrations/0005_protected_catalog.sql'),
  'utf8'
);
const generatedTypes = readFileSync(resolve(root, 'src/types/supabase-generated.ts'), 'utf8');

const assertions = [];

function assert(name, condition) {
  assertions.push({ name, condition });
}

const catalogTables = [
  'catalog_releases',
  'catalog_release_sources',
  'catalog_ingredients',
  'catalog_recipes',
  'catalog_recipe_ingredients',
  'catalog_recipe_sources',
];
const publicRpcs = ['catalog_candidates', 'catalog_recipe_detail', 'catalog_attributions'];

function functionBody(schema, name) {
  const start = migration.indexOf(`create or replace function ${schema}.${name}`);
  const end = migration.indexOf('$$;', start);
  return start >= 0 && end >= 0 ? migration.slice(start, end) : '';
}

const loaderGrantBlock = migration.slice(
  migration.indexOf('-- `service_role` is the non-owner loader.'),
  migration.indexOf('create or replace function private.guard_catalog_release_write')
);

for (const table of catalogTables) {
  assert(`${table} is created`, migration.includes(`create table public.${table}`));
  assert(
    `${table} enables RLS`,
    migration.includes(`alter table public.${table} enable row level security`)
  );
  assert(
    `${table} revokes ordinary table access`,
    migration.includes(`revoke all on table public.${table} from public, anon, authenticated`)
  );
  assert(`${table} has generated types`, generatedTypes.includes(`${table}: {`));
}

assert(
  'only one release can be active',
  migration.includes('create unique index catalog_releases_one_active_idx') &&
    migration.includes('where is_active')
);
assert(
  'activation is private and serialized',
  functionBody('private', 'activate_catalog_release').includes(
    'pg_catalog.pg_advisory_xact_lock'
  ) && functionBody('private', 'activate_catalog_release').includes("set search_path = ''")
);
assert(
  'non-owner write guards serialize with activation',
  functionBody('private', 'guard_catalog_release_write').includes(
    'pg_catalog.pg_advisory_xact_lock(734483221)'
  ) &&
    functionBody('private', 'guard_catalog_release_owned_write').includes(
      'pg_catalog.pg_advisory_xact_lock(734483221)'
    )
);
assert(
  'activation validates release readiness and provenance',
  functionBody('private', 'activate_catalog_release').includes('offline_ready') &&
    functionBody('private', 'activate_catalog_release').includes(
      'actual_offline_recipe_count > 100'
    ) &&
    functionBody('private', 'activate_catalog_release').includes(
      'counts do not match loaded catalog rows'
    ) &&
    functionBody('private', 'activate_catalog_release').includes('incomplete rights metadata') &&
    functionBody('private', 'activate_catalog_release').includes('incomplete recipe provenance') &&
    functionBody('private', 'activate_catalog_release').includes(
      'unsafe offline ingredient metadata'
    )
);
assert(
  'provenance checksum is tied to its release source',
  migration.includes('foreign key (release_id, source_id, source_version, archive_sha256)')
);
assert(
  'activation is restricted to the service-role loader',
  migration.includes('revoke all on function private.activate_catalog_release(uuid)') &&
    migration.includes('from public, anon, authenticated, service_role') &&
    migration.includes('revoke execute on all functions in schema private from service_role') &&
    migration.includes(
      'grant execute on function private.activate_catalog_release(uuid) to service_role'
    )
);
assert(
  'service role cannot write release lifecycle columns',
  loaderGrantBlock.includes(
    'insert (id, recipe_count, ingredient_count, source_count, offline_recipe_count, offline_ready)'
  ) &&
    loaderGrantBlock.includes(
      'update (recipe_count, ingredient_count, source_count, offline_recipe_count, offline_ready)'
    ) &&
    !loaderGrantBlock.includes('is_active') &&
    !loaderGrantBlock.includes('activated_at') &&
    !loaderGrantBlock.includes('retired_at')
);
assert(
  'all catalog tables guard active release writes',
  catalogTables.every((table) => migration.includes(`create trigger ${table}_write_guard`)) &&
    functionBody('private', 'guard_catalog_release_write').includes('security invoker') &&
    functionBody('private', 'guard_catalog_release_owned_write').includes('security invoker') &&
    functionBody('private', 'guard_catalog_release_owned_write').includes('release.is_active') &&
    functionBody('private', 'guard_catalog_release_write').includes('pg_catalog.pg_get_userbyid') &&
    functionBody('private', 'guard_catalog_release_write').includes(
      "'private.activate_catalog_release(uuid)'::pg_catalog.regprocedure"
    )
);
assert(
  'catalog arrays and raw measures reject unsafe null or blank values',
  migration.includes('catalog_ingredients_allergen_groups_no_nulls') &&
    migration.includes('catalog_recipes_equipment_no_nulls') &&
    migration.includes('catalog_recipes_dietary_no_nulls') &&
    migration.includes("raw_measure   text not null check (btrim(raw_measure) <> '')")
);
assert(
  'rights URL checks are end anchored',
  migration.includes("archive_url ~ '^https://[^/[:space:]]+(/[^[:space:]]*)?$") &&
    migration.includes("license_url ~ '^https://[^/[:space:]]+(/[^[:space:]]*)?$") &&
    functionBody('private', 'activate_catalog_release').includes(
      "archive_url !~ '^https://[^/[:space:]]+(/[^[:space:]]*)?$"
    )
);
assert(
  'provenance foreign key index covers its checksum column',
  migration.includes(
    'on public.catalog_recipe_sources (release_id, source_id, source_version, archive_sha256)'
  )
);

for (const rpc of publicRpcs) {
  const definition = functionBody('public', rpc);
  assert(`${rpc} is a security-definer RPC`, definition.includes('security definer'));
  assert(`${rpc} pins an empty search path`, definition.includes("set search_path = ''"));
  assert(
    `${rpc} rejects unauthenticated callers`,
    definition.includes('(select auth.uid()) is null')
  );
  assert(
    `${rpc} revokes public and anon execution`,
    new RegExp(`revoke all on function public\\.${rpc}[\\s\\S]*?from public, anon`).test(migration)
  );
  assert(
    `${rpc} grants execution only to authenticated`,
    new RegExp(`grant execute on function public\\.${rpc}[\\s\\S]*?to authenticated`).test(
      migration
    )
  );
  assert(`${rpc} appears in generated function types`, generatedTypes.includes(`${rpc}: {`));
}

for (const rpc of ['catalog_candidates', 'catalog_recipe_detail']) {
  const definition = functionBody('public', rpc);
  assert(`${rpc} returns equipment safety status`, definition.includes('equipment_status text'));
  assert(
    `${rpc} returns every ingredient allergen status`,
    definition.includes("'allergenStatus'")
  );
}

assert(
  'candidate RPC enforces safety and the 1..100 bound',
  functionBody('public', 'catalog_candidates').includes("recipe.equipment_status = 'verified'") &&
    functionBody('public', 'catalog_candidates').includes("recipe.allergen_status = 'verified'") &&
    functionBody('public', 'catalog_candidates').includes("recipe.dietary_status = 'verified'") &&
    functionBody('public', 'catalog_candidates').includes(
      'least(greatest(coalesce(p_limit, 20), 1), 100)'
    )
);
assert('migration does not add pgvector', !migration.toLowerCase().includes('pgvector'));

const failed = assertions.filter(({ condition }) => !condition);
for (const { name, condition } of assertions) {
  stdout.write(`${condition ? 'PASS' : 'FAIL'} ${name}\n`);
}

if (failed.length > 0) {
  throw new Error(`${failed.length} catalog structural assertions failed`);
}
