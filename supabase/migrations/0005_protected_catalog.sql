-- ---------------------------------------------------------------------------
-- Protected, rights-first catalog releases.
--
-- Catalog loading is an operational action. Clients receive active-release
-- data only through authenticated RPCs, so a partial load can never surface.
-- ---------------------------------------------------------------------------

create table public.catalog_releases (
  id                    uuid primary key,
  recipe_count          integer not null default 0 check (recipe_count >= 0),
  ingredient_count      integer not null default 0 check (ingredient_count >= 0),
  source_count          integer not null default 0 check (source_count >= 0),
  offline_recipe_count  integer not null default 0 check (
    offline_recipe_count >= 0 and offline_recipe_count <= 100
  ),
  offline_ready         boolean not null default false,
  is_active             boolean not null default false,
  created_at            timestamptz not null default now(),
  activated_at          timestamptz,
  retired_at            timestamptz,
  constraint catalog_releases_active_timestamp check (
    not is_active or activated_at is not null
  )
);

create table public.catalog_release_sources (
  release_id      uuid not null references public.catalog_releases(id) on delete cascade,
  source_id       text not null check (btrim(source_id) <> ''),
  source_version  text not null check (btrim(source_version) <> ''),
  archive_url     text not null check (archive_url ~ '^https://[^/[:space:]]+(/[^[:space:]]*)?$'),
  archive_sha256  text not null check (archive_sha256 ~ '^[0-9a-f]{64}$'),
  license_name    text not null check (btrim(license_name) <> ''),
  license_url     text not null check (license_url ~ '^https://[^/[:space:]]+(/[^[:space:]]*)?$'),
  attribution     text not null check (btrim(attribution) <> ''),
  rights_status   text not null check (rights_status in ('approved', 'quarantine')),
  created_at      timestamptz not null default now(),
  primary key (release_id, source_id),
  unique (release_id, source_id, source_version),
  unique (release_id, source_id, source_version, archive_sha256)
);

create table public.catalog_ingredients (
  release_id       uuid not null references public.catalog_releases(id) on delete cascade,
  ingredient_id    text not null check (btrim(ingredient_id) <> ''),
  display_name     text not null check (btrim(display_name) <> ''),
  allergen_groups  text[] not null default '{}',
  allergen_status  text not null check (allergen_status in ('verified', 'unknown')),
  is_staple        boolean not null default false,
  created_at       timestamptz not null default now(),
  primary key (release_id, ingredient_id),
  constraint catalog_ingredients_allergen_groups_no_nulls check (
    array_position(allergen_groups, null) is null
  )
);

create table public.catalog_recipes (
  release_id            uuid not null references public.catalog_releases(id) on delete cascade,
  recipe_id             text not null check (btrim(recipe_id) <> ''),
  title                 text not null check (btrim(title) <> ''),
  image_url             text,
  cuisine               text,
  total_time_minutes    integer not null check (total_time_minutes > 0),
  equipment_required    text[] not null,
  equipment_status      text not null check (equipment_status in ('verified', 'unknown')),
  allergen_status       text not null check (allergen_status in ('verified', 'unknown')),
  dietary_status        text not null check (dietary_status in ('verified', 'unknown')),
  dietary_tags          text[] not null default '{}',
  instructions          text not null check (btrim(instructions) <> ''),
  is_offline            boolean not null default false,
  created_at            timestamptz not null default now(),
  primary key (release_id, recipe_id),
  constraint catalog_recipes_equipment_vocabulary check (
    equipment_required <@ array[
      'microwave', 'stove', 'oven', 'air_fryer', 'kettle', 'blender',
      'rice_cooker', 'toaster_oven', 'none', 'unclassified'
    ]::text[]
  ),
  constraint catalog_recipes_equipment_present check (cardinality(equipment_required) > 0),
  constraint catalog_recipes_equipment_no_nulls check (
    array_position(equipment_required, null) is null
  ),
  constraint catalog_recipes_equipment_safety check (
    (equipment_status = 'verified' and not ('unclassified' = any(equipment_required)))
    or (equipment_status = 'unknown' and equipment_required = array['unclassified'])
  ),
  constraint catalog_recipes_none_is_exclusive check (
    not ('none' = any(equipment_required)) or cardinality(equipment_required) = 1
  ),
  constraint catalog_recipes_dietary_vocabulary check (
    dietary_tags <@ array[
      'vegetarian', 'vegan', 'gluten_free', 'dairy_free', 'halal', 'kosher',
      'pescatarian', 'keto'
    ]::text[]
  ),
  constraint catalog_recipes_dietary_no_nulls check (
    array_position(dietary_tags, null) is null
  )
);

create table public.catalog_recipe_ingredients (
  release_id    uuid not null,
  recipe_id     text not null,
  position      integer not null check (position > 0),
  ingredient_id text not null,
  quantity      numeric check (quantity is null or quantity > 0),
  unit          text,
  raw_measure   text not null check (btrim(raw_measure) <> ''),
  primary key (release_id, recipe_id, position),
  foreign key (release_id, recipe_id)
    references public.catalog_recipes(release_id, recipe_id) on delete cascade,
  foreign key (release_id, ingredient_id)
    references public.catalog_ingredients(release_id, ingredient_id) on delete restrict
);

create table public.catalog_recipe_sources (
  release_id        uuid not null,
  recipe_id         text not null,
  source_id         text not null,
  source_version    text not null,
  source_recipe_id  text not null check (btrim(source_recipe_id) <> ''),
  archive_sha256    text not null check (archive_sha256 ~ '^[0-9a-f]{64}$'),
  primary key (release_id, recipe_id, source_id, source_version, source_recipe_id),
  foreign key (release_id, recipe_id)
    references public.catalog_recipes(release_id, recipe_id) on delete cascade,
  foreign key (release_id, source_id, source_version, archive_sha256)
    references public.catalog_release_sources(
      release_id, source_id, source_version, archive_sha256
    ) on delete restrict
);

-- The partial unique index is the final guard against two concurrent active
-- releases. The activation helper also takes a transaction-scoped advisory lock
-- so it can retire and promote without a transient uniqueness failure.
create unique index catalog_releases_one_active_idx
  on public.catalog_releases (is_active)
  where is_active;

-- Every foreign key and every candidate predicate has an intentional index.
create index catalog_release_sources_release_id_idx
  on public.catalog_release_sources (release_id);
create index catalog_ingredients_release_id_idx
  on public.catalog_ingredients (release_id);
create index catalog_ingredients_allergen_groups_idx
  on public.catalog_ingredients using gin (allergen_groups);
create index catalog_recipes_release_id_idx
  on public.catalog_recipes (release_id);
create index catalog_recipes_candidate_filter_idx
  on public.catalog_recipes (release_id, total_time_minutes, cuisine, recipe_id);
create index catalog_recipes_equipment_required_idx
  on public.catalog_recipes using gin (equipment_required);
create index catalog_recipes_dietary_tags_idx
  on public.catalog_recipes using gin (dietary_tags);
create index catalog_recipe_ingredients_recipe_id_idx
  on public.catalog_recipe_ingredients (release_id, recipe_id);
create index catalog_recipe_ingredients_ingredient_id_idx
  on public.catalog_recipe_ingredients (release_id, ingredient_id);
create index catalog_recipe_sources_recipe_id_idx
  on public.catalog_recipe_sources (release_id, recipe_id);
create index catalog_recipe_sources_source_id_idx
  on public.catalog_recipe_sources (release_id, source_id, source_version, archive_sha256);

alter table public.catalog_releases enable row level security;
alter table public.catalog_release_sources enable row level security;
alter table public.catalog_ingredients enable row level security;
alter table public.catalog_recipes enable row level security;
alter table public.catalog_recipe_ingredients enable row level security;
alter table public.catalog_recipe_sources enable row level security;

revoke all on table public.catalog_releases from public, anon, authenticated, service_role;
revoke all on table public.catalog_release_sources from public, anon, authenticated, service_role;
revoke all on table public.catalog_ingredients from public, anon, authenticated, service_role;
revoke all on table public.catalog_recipes from public, anon, authenticated, service_role;
revoke all on table public.catalog_recipe_ingredients from public, anon, authenticated, service_role;
revoke all on table public.catalog_recipe_sources from public, anon, authenticated, service_role;

-- `service_role` is the non-owner loader. It can stage an inactive release but
-- cannot write lifecycle columns; activation remains a separate private call.
grant select, delete,
  insert (id, recipe_count, ingredient_count, source_count, offline_recipe_count, offline_ready),
  update (recipe_count, ingredient_count, source_count, offline_recipe_count, offline_ready)
  on public.catalog_releases to service_role;
grant select, insert, update, delete on public.catalog_release_sources to service_role;
grant select, insert, update, delete on public.catalog_ingredients to service_role;
grant select, insert, update, delete on public.catalog_recipes to service_role;
grant select, insert, update, delete on public.catalog_recipe_ingredients to service_role;
grant select, insert, update, delete on public.catalog_recipe_sources to service_role;

create or replace function private.guard_catalog_release_write()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- The release-table owner and activation-function owner are trusted. The
  -- lookup stays dynamic because managed Supabase ownership can differ locally.
  if exists (
    select 1
      from pg_catalog.pg_class as relation
     where relation.oid = 'public.catalog_releases'::pg_catalog.regclass
       and current_user = pg_catalog.pg_get_userbyid(relation.relowner)
  ) or exists (
    select 1
      from pg_catalog.pg_proc as function
     where function.oid = 'private.activate_catalog_release(uuid)'::pg_catalog.regprocedure
       and current_user = pg_catalog.pg_get_userbyid(function.proowner)
  ) then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  -- Serialize staging with activation so validation cannot race a later commit.
  perform pg_catalog.pg_advisory_xact_lock(734483221);

  if tg_op = 'INSERT' then
    if new.is_active or new.activated_at is not null or new.retired_at is not null then
      raise exception 'catalog releases must be staged inactive';
    end if;
  elsif tg_op = 'UPDATE' then
    if old.is_active or new.is_active
       or new.activated_at is distinct from old.activated_at
       or new.retired_at is distinct from old.retired_at then
      raise exception 'active catalog release lifecycle is private';
    end if;
  elsif old.is_active then
    raise exception 'active catalog releases cannot be deleted';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create or replace function private.guard_catalog_release_owned_write()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  old_release_id uuid;
  new_release_id uuid;
begin
  if exists (
    select 1
      from pg_catalog.pg_class as relation
     where relation.oid = 'public.catalog_releases'::pg_catalog.regclass
       and current_user = pg_catalog.pg_get_userbyid(relation.relowner)
  ) or exists (
    select 1
      from pg_catalog.pg_proc as function
     where function.oid = 'private.activate_catalog_release(uuid)'::pg_catalog.regprocedure
       and current_user = pg_catalog.pg_get_userbyid(function.proowner)
  ) then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  -- Serialize staging with activation so validation cannot race a later commit.
  perform pg_catalog.pg_advisory_xact_lock(734483221);

  if tg_op <> 'INSERT' then
    old_release_id := (pg_catalog.to_jsonb(old) ->> 'release_id')::uuid;
    if exists (
      select 1
        from public.catalog_releases as release
       where release.id = old_release_id
         and release.is_active
    ) then
      raise exception 'active catalog release rows cannot be changed';
    end if;
  end if;

  if tg_op <> 'DELETE' then
    new_release_id := (pg_catalog.to_jsonb(new) ->> 'release_id')::uuid;
    if exists (
      select 1
        from public.catalog_releases as release
       where release.id = new_release_id
         and release.is_active
    ) then
      raise exception 'active catalog release rows cannot be added or moved';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger catalog_releases_write_guard
  before insert or update or delete on public.catalog_releases
  for each row execute function private.guard_catalog_release_write();
create trigger catalog_release_sources_write_guard
  before insert or update or delete on public.catalog_release_sources
  for each row execute function private.guard_catalog_release_owned_write();
create trigger catalog_ingredients_write_guard
  before insert or update or delete on public.catalog_ingredients
  for each row execute function private.guard_catalog_release_owned_write();
create trigger catalog_recipes_write_guard
  before insert or update or delete on public.catalog_recipes
  for each row execute function private.guard_catalog_release_owned_write();
create trigger catalog_recipe_ingredients_write_guard
  before insert or update or delete on public.catalog_recipe_ingredients
  for each row execute function private.guard_catalog_release_owned_write();
create trigger catalog_recipe_sources_write_guard
  before insert or update or delete on public.catalog_recipe_sources
  for each row execute function private.guard_catalog_release_owned_write();

create or replace function private.activate_catalog_release(target_release_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.catalog_releases%rowtype;
  actual_recipe_count integer;
  actual_ingredient_count integer;
  actual_source_count integer;
  actual_offline_recipe_count integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(734483221);

  select release.* into target
    from public.catalog_releases as release
   where release.id = target_release_id
   for update;

  if not found then
    raise exception 'catalog release % does not exist', target_release_id;
  end if;

  if target.is_active then
    return;
  end if;

  if not target.offline_ready then
    raise exception 'catalog release % is not verified for offline use', target_release_id;
  end if;

  select count(*) into actual_recipe_count
    from public.catalog_recipes as recipe
   where recipe.release_id = target_release_id;
  select count(*) into actual_ingredient_count
    from public.catalog_ingredients as ingredient
   where ingredient.release_id = target_release_id;
  select count(*) into actual_source_count
    from public.catalog_release_sources as source
   where source.release_id = target_release_id;
  select count(*) into actual_offline_recipe_count
    from public.catalog_recipes as recipe
   where recipe.release_id = target_release_id
     and recipe.is_offline;

  if actual_recipe_count = 0 or actual_ingredient_count = 0 or actual_source_count = 0
     or actual_offline_recipe_count = 0 or actual_offline_recipe_count > 100 then
    raise exception 'catalog release % has empty required catalog counts', target_release_id;
  end if;

  if (target.recipe_count, target.ingredient_count, target.source_count, target.offline_recipe_count)
       <> (actual_recipe_count, actual_ingredient_count, actual_source_count,
           actual_offline_recipe_count) then
    raise exception 'catalog release % counts do not match loaded catalog rows', target_release_id;
  end if;

  if exists (
    select 1
      from public.catalog_release_sources as source
     where source.release_id = target_release_id
       and (
         source.rights_status <> 'approved'
         or btrim(source.archive_url) = ''
         or source.archive_url !~ '^https://[^/[:space:]]+(/[^[:space:]]*)?$'
         or source.archive_sha256 !~ '^[0-9a-f]{64}$'
         or btrim(source.license_name) = ''
         or source.license_url !~ '^https://[^/[:space:]]+(/[^[:space:]]*)?$'
         or btrim(source.attribution) = ''
       )
  ) then
    raise exception 'catalog release % has incomplete rights metadata', target_release_id;
  end if;

  if exists (
    select 1
      from public.catalog_recipes as recipe
     where recipe.release_id = target_release_id
       and not exists (
         select 1
           from public.catalog_recipe_ingredients as ingredient
          where ingredient.release_id = recipe.release_id
            and ingredient.recipe_id = recipe.recipe_id
       )
  ) or exists (
    select 1
      from public.catalog_recipes as recipe
     where recipe.release_id = target_release_id
       and not exists (
         select 1
           from public.catalog_recipe_sources as source
          where source.release_id = recipe.release_id
            and source.recipe_id = recipe.recipe_id
       )
  ) or exists (
    select 1
      from public.catalog_release_sources as source
     where source.release_id = target_release_id
       and not exists (
         select 1
           from public.catalog_recipe_sources as recipe_source
          where recipe_source.release_id = source.release_id
            and recipe_source.source_id = source.source_id
            and recipe_source.source_version = source.source_version
       )
  ) then
    raise exception 'catalog release % has incomplete recipe provenance', target_release_id;
  end if;

  if exists (
    select 1
      from public.catalog_recipes as recipe
     where recipe.release_id = target_release_id
       and recipe.is_offline
       and (
         recipe.equipment_status <> 'verified'
         or recipe.allergen_status <> 'verified'
         or recipe.dietary_status <> 'verified'
         or 'unclassified' = any(recipe.equipment_required)
       )
  ) then
    raise exception 'catalog release % has unsafe offline recipes', target_release_id;
  end if;

  if exists (
    select 1
      from public.catalog_recipes as recipe
      join public.catalog_recipe_ingredients as recipe_ingredient
        on recipe_ingredient.release_id = recipe.release_id
       and recipe_ingredient.recipe_id = recipe.recipe_id
      join public.catalog_ingredients as ingredient
        on ingredient.release_id = recipe_ingredient.release_id
       and ingredient.ingredient_id = recipe_ingredient.ingredient_id
     where recipe.release_id = target_release_id
       and recipe.is_offline
       and ingredient.allergen_status <> 'verified'
  ) then
    raise exception 'catalog release % has unsafe offline ingredient metadata', target_release_id;
  end if;

  update public.catalog_releases
     set is_active = false,
         retired_at = coalesce(retired_at, now())
   where is_active;

  update public.catalog_releases
     set is_active = true,
         activated_at = coalesce(activated_at, now()),
         retired_at = null
   where id = target_release_id;
end;
$$;

create or replace function public.catalog_candidates(
  p_pantry_ingredient_ids text[] default '{}',
  p_owned_equipment text[] default '{}',
  p_allergens text[] default '{}',
  p_dietary_restrictions text[] default '{}',
  p_requested_minutes integer default null,
  p_cuisine text default null,
  p_excluded_recipe_ids text[] default '{}',
  p_limit integer default 20
)
returns table (
  recipe_id text,
  title text,
  image_url text,
  cuisine text,
  total_time_minutes integer,
  equipment_required text[],
  equipment_status text,
  allergen_status text,
  dietary_status text,
  dietary_tags text[],
  ingredients jsonb,
  pantry_match_count integer
)
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  return query
  with active_release as (
    select release.id
      from public.catalog_releases as release
     where release.is_active
  )
  select
    recipe.recipe_id,
    recipe.title,
    recipe.image_url,
    recipe.cuisine,
    recipe.total_time_minutes,
    recipe.equipment_required,
    recipe.equipment_status,
    recipe.allergen_status,
    recipe.dietary_status,
    recipe.dietary_tags,
    (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', recipe_ingredient.ingredient_id,
            'quantity', recipe_ingredient.quantity,
            'unit', recipe_ingredient.unit,
            'rawMeasure', recipe_ingredient.raw_measure,
            'allergenGroups', ingredient.allergen_groups,
            'allergenStatus', ingredient.allergen_status
          ) order by recipe_ingredient.position
        ),
        '[]'::jsonb
      )
        from public.catalog_recipe_ingredients as recipe_ingredient
        join public.catalog_ingredients as ingredient
          on ingredient.release_id = recipe_ingredient.release_id
         and ingredient.ingredient_id = recipe_ingredient.ingredient_id
       where recipe_ingredient.release_id = recipe.release_id
         and recipe_ingredient.recipe_id = recipe.recipe_id
    ),
    (
      select count(*)::integer
        from public.catalog_recipe_ingredients as recipe_ingredient
       where recipe_ingredient.release_id = recipe.release_id
         and recipe_ingredient.recipe_id = recipe.recipe_id
         and recipe_ingredient.ingredient_id = any(coalesce(p_pantry_ingredient_ids, '{}'))
    )
    from active_release
    join public.catalog_recipes as recipe on recipe.release_id = active_release.id
   where recipe.equipment_status = 'verified'
     and recipe.allergen_status = 'verified'
     and recipe.dietary_status = 'verified'
     and not ('unclassified' = any(recipe.equipment_required))
     and (
       recipe.equipment_required = array['none']
       or recipe.equipment_required <@ coalesce(p_owned_equipment, '{}')
     )
     and coalesce(p_dietary_restrictions, '{}') <@ recipe.dietary_tags
     and (p_requested_minutes is null or recipe.total_time_minutes <= p_requested_minutes)
     and (p_cuisine is null or recipe.cuisine = p_cuisine)
     and not (recipe.recipe_id = any(coalesce(p_excluded_recipe_ids, '{}')))
     and not exists (
       select 1
         from public.catalog_recipe_ingredients as recipe_ingredient
         join public.catalog_ingredients as ingredient
           on ingredient.release_id = recipe_ingredient.release_id
          and ingredient.ingredient_id = recipe_ingredient.ingredient_id
        where recipe_ingredient.release_id = recipe.release_id
          and recipe_ingredient.recipe_id = recipe.recipe_id
          and (
            ingredient.allergen_status <> 'verified'
            or recipe_ingredient.ingredient_id = any(coalesce(p_allergens, '{}'))
            or ingredient.allergen_groups && coalesce(p_allergens, '{}')
          )
     )
   order by recipe.total_time_minutes, recipe.recipe_id
   limit least(greatest(coalesce(p_limit, 20), 1), 100);
end;
$$;

create or replace function public.catalog_recipe_detail(p_recipe_id text)
returns table (
  recipe_id text,
  title text,
  image_url text,
  cuisine text,
  total_time_minutes integer,
  equipment_required text[],
  equipment_status text,
  allergen_status text,
  dietary_status text,
  dietary_tags text[],
  instructions text,
  ingredients jsonb,
  provenance jsonb
)
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  return query
  select
    recipe.recipe_id,
    recipe.title,
    recipe.image_url,
    recipe.cuisine,
    recipe.total_time_minutes,
    recipe.equipment_required,
    recipe.equipment_status,
    recipe.allergen_status,
    recipe.dietary_status,
    recipe.dietary_tags,
    recipe.instructions,
    (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', recipe_ingredient.ingredient_id,
            'quantity', recipe_ingredient.quantity,
            'unit', recipe_ingredient.unit,
            'rawMeasure', recipe_ingredient.raw_measure,
            'allergenGroups', ingredient.allergen_groups,
            'allergenStatus', ingredient.allergen_status
          ) order by recipe_ingredient.position
        ),
        '[]'::jsonb
      )
        from public.catalog_recipe_ingredients as recipe_ingredient
        join public.catalog_ingredients as ingredient
          on ingredient.release_id = recipe_ingredient.release_id
         and ingredient.ingredient_id = recipe_ingredient.ingredient_id
       where recipe_ingredient.release_id = recipe.release_id
         and recipe_ingredient.recipe_id = recipe.recipe_id
    ),
    (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'sourceId', source.source_id,
            'sourceVersion', source.source_version,
            'sourceRecipeId', source.source_recipe_id,
            'archiveSha256', source.archive_sha256
          ) order by source.source_id, source.source_version, source.source_recipe_id
        ),
        '[]'::jsonb
      )
        from public.catalog_recipe_sources as source
       where source.release_id = recipe.release_id
         and source.recipe_id = recipe.recipe_id
    )
    from public.catalog_releases as release
    join public.catalog_recipes as recipe on recipe.release_id = release.id
   where release.is_active
     and recipe.recipe_id = p_recipe_id;
end;
$$;

create or replace function public.catalog_attributions()
returns table (
  source_id text,
  source_version text,
  archive_url text,
  archive_sha256 text,
  license_name text,
  license_url text,
  attribution text
)
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  return query
  select
    source.source_id,
    source.source_version,
    source.archive_url,
    source.archive_sha256,
    source.license_name,
    source.license_url,
    source.attribution
    from public.catalog_releases as release
    join public.catalog_release_sources as source on source.release_id = release.id
   where release.is_active
   order by source.source_id, source.source_version;
end;
$$;

revoke all on function private.activate_catalog_release(uuid)
  from public, anon, authenticated, service_role;
revoke all on function private.guard_catalog_release_write()
  from public, anon, authenticated, service_role;
revoke all on function private.guard_catalog_release_owned_write()
  from public, anon, authenticated, service_role;
revoke all on function public.catalog_candidates(text[], text[], text[], text[], integer, text, text[], integer)
  from public, anon;
revoke all on function public.catalog_recipe_detail(text) from public, anon;
revoke all on function public.catalog_attributions() from public, anon;

grant execute on function public.catalog_candidates(text[], text[], text[], text[], integer, text, text[], integer)
  to authenticated;
grant execute on function public.catalog_recipe_detail(text) to authenticated;
grant execute on function public.catalog_attributions() to authenticated;

revoke all on schema private from service_role;
grant usage on schema private to service_role;
revoke execute on all functions in schema private from service_role;
grant execute on function private.activate_catalog_release(uuid) to service_role;
