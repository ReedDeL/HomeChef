-- ---------------------------------------------------------------------------
-- HomeChef initial schema.
--
-- Data model from docs/01_TECHNICAL_SPEC.md §3. RLS is enabled and every
-- policy is written in this same migration -- not a cleanup task.
--
-- The privacy rule this schema exists to enforce: inventory joins to
-- household_id (shared with roommates); preferences, allergens, and feedback
-- join to user_id (structurally unreachable by household members).
--
-- Recipes are deliberately absent. Tier 1 is bundled JSON versioned with the
-- app; Tier 2 is fetched live and discarded.
-- ---------------------------------------------------------------------------

-- Helper functions live here so they are not exposed through PostgREST.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;


-- ---------- Identity and grouping ----------

create table households (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now()
);

create table profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  household_id  uuid not null references households(id) on delete cascade,
  display_name  text,
  created_at    timestamptz not null default now()
);

-- Authoritative record of membership. profiles.household_id is a denormalized
-- convenience for the client; no RLS policy may read it, because two sources
-- of truth inside a security predicate is how RLS bugs ship.
create table household_members (
  household_id  uuid references households(id) on delete cascade,
  user_id       uuid references profiles(id)   on delete cascade,
  primary key (household_id, user_id)
);


-- ---------- Personal: never shared with roommates ----------

create table user_preferences (
  user_id          uuid primary key references profiles(id) on delete cascade,
  -- Closed enum from docs/01_TECHNICAL_SPEC.md:534, enforced below.
  equipment        text[] not null default '{}',
  -- Canonical ingredient ids from src/data/ingredients.json.
  allergens        text[] not null default '{}',
  dietary          text[] not null default '{}',
  onboarding_done  boolean not null default false,
  updated_at       timestamptz not null default now(),

  constraint user_preferences_equipment_valid check (
    equipment <@ array[
      'microwave','stove','oven','air_fryer','kettle',
      'blender','rice_cooker','toaster_oven','none'
    ]::text[]
  ),
  constraint user_preferences_dietary_valid check (
    dietary <@ array[
      'vegetarian','vegan','gluten_free','dairy_free',
      'halal','kosher','pescatarian','keto'
    ]::text[]
  )
);

-- 'skipped' is a weak negative signal (suppress for a while); 'disliked' is a
-- strong one (suppress similar recipes permanently). Deliberately distinct.
create table meal_feedback (
  user_id     uuid references profiles(id) on delete cascade,
  recipe_id   text not null,
  verdict     text not null check (verdict in ('liked','disliked','skipped')),
  made_on     date,
  created_at  timestamptz not null default now(),
  primary key (user_id, recipe_id)
);


-- ---------- Shared: the household pantry ----------

create table inventory (
  id             uuid primary key default gen_random_uuid(),
  household_id   uuid not null references households(id) on delete cascade,
  -- Canonical id from the bundled ingredient list. Not a DB foreign key: the
  -- vocabulary ships with the app, not in Postgres.
  ingredient_id  text not null,
  quantity       numeric check (quantity is null or quantity >= 0),
  unit           text,
  purchased_on   date,
  source         text not null default 'manual'
                 check (source in ('manual','photo','staple','shopping_list')),
  added_by       uuid references profiles(id) on delete set null,
  updated_at     timestamptz not null default now(),
  -- Aggregate by ingredient TYPE, never by brand. A second carton of milk
  -- increments a quantity; it does not create a second row.
  unique (household_id, ingredient_id)
);


-- ---------- Indexes ----------
-- Every column referenced by an RLS policy is indexed. Without these, each
-- policy check degrades into a sequential scan.

create index inventory_household_idx on inventory (household_id);
create index inventory_added_by_idx on inventory (added_by);
create index profiles_household_idx on profiles (household_id);
create index household_members_user_idx on household_members (user_id);


-- ---------- updated_at maintenance ----------

create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger inventory_touch_updated_at
  before update on inventory
  for each row execute function private.touch_updated_at();

create trigger user_preferences_touch_updated_at
  before update on user_preferences
  for each row execute function private.touch_updated_at();


-- ---------- Membership helper ----------
-- SECURITY DEFINER so it bypasses RLS on household_members. That is what
-- prevents infinite recursion when household_members' own policy needs to ask
-- "is the caller in this household?". The caller's identity is checked
-- explicitly inside the body -- never trust the argument alone.

create or replace function private.is_household_member(target_household_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.household_members hm
    where hm.household_id = target_household_id
      and hm.user_id = (select auth.uid())
  );
$$;

revoke execute on function private.is_household_member(uuid)
  from public, anon, authenticated, service_role;


-- ---------- Row Level Security ----------
-- auth.uid() is wrapped in a scalar subquery throughout so Postgres evaluates
-- it once per statement instead of once per row.

alter table households        enable row level security;
alter table profiles          enable row level security;
alter table household_members enable row level security;
alter table user_preferences  enable row level security;
alter table meal_feedback     enable row level security;
alter table inventory         enable row level security;

-- households: visible to members. Creation happens in the signup trigger,
-- which is SECURITY DEFINER, so no INSERT policy is granted to clients.
-- DELETE is intentionally absent: no client may destroy a household.
-- The same applies to profiles and household_members — their INSERT/DELETE
-- paths are all handled by the SECURITY DEFINER trigger on auth.users, so
-- granting a client policy would widen the surface with no benefit.
create policy households_member_read on households
  for select to authenticated
  using ((select private.is_household_member(id)));

create policy households_member_update on households
  for update to authenticated
  using ((select private.is_household_member(id)))
  with check ((select private.is_household_member(id)));

-- profiles: own row, plus co-members (needed to render "added by").
create policy profiles_read on profiles
  for select to authenticated
  using (
    id = (select auth.uid())
    or (select private.is_household_member(household_id))
  );

create policy profiles_update_own on profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- household_members: a member may see the roster of their own household.
create policy household_members_read on household_members
  for select to authenticated
  using ((select private.is_household_member(household_id)));

-- Personal tables. `for all` with a matching `with check` so a client cannot
-- insert or update a row onto someone else's user_id.
create policy user_preferences_own on user_preferences
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy meal_feedback_own on meal_feedback
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Shared pantry. Split by command so INSERT/UPDATE cannot write a row into a
-- household the caller does not belong to.
create policy inventory_member_read on inventory
  for select to authenticated
  using ((select private.is_household_member(household_id)));

create policy inventory_member_insert on inventory
  for insert to authenticated
  with check ((select private.is_household_member(household_id)));

create policy inventory_member_update on inventory
  for update to authenticated
  using ((select private.is_household_member(household_id)))
  with check ((select private.is_household_member(household_id)));

create policy inventory_member_delete on inventory
  for delete to authenticated
  using ((select private.is_household_member(household_id)));


-- ---------- Signup ----------
-- Every new user gets a household, a profile, a membership row, and an empty
-- preferences row in one transaction. Without this the client would have to
-- bootstrap its own tenant, which no RLS policy can safely allow.

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_household_id uuid;
begin
  insert into public.households (name)
    values ('My Kitchen')
    returning id into new_household_id;

  insert into public.profiles (id, household_id, display_name)
    values (new.id, new_household_id, new.raw_user_meta_data ->> 'display_name');

  insert into public.household_members (household_id, user_id)
    values (new_household_id, new.id);

  insert into public.user_preferences (user_id)
    values (new.id);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();
