-- Personal persistence for the two meal journeys. The household pantry stays
-- shared; every table below is owned directly by one authenticated user.

create table public.body_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  age_years smallint not null check (age_years between 18 and 120),
  height_centimeters numeric(5, 2) not null
    check (height_centimeters between 120 and 230),
  weight_kilograms numeric(5, 2) not null
    check (weight_kilograms between 35 and 300),
  calculation_sex text not null check (calculation_sex in ('female', 'male')),
  activity_level text not null check (
    activity_level in ('sedentary', 'light', 'moderate', 'active', 'very_active')
  ),
  goal text not null check (goal in ('lose', 'maintain', 'gain')),
  pregnant boolean not null,
  breastfeeding boolean not null
);

create table public.taste_signals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind = 'photo_selected'),
  recipe_id text not null check (length(recipe_id) > 0),
  journey text not null check (journey in ('now', 'week')),
  recorded_at timestamptz not null
);

create table public.meal_satiety (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid()
    references public.profiles(id) on delete cascade,
  recipe_id text not null check (length(recipe_id) > 0),
  level text not null check (level in ('still_hungry', 'satisfied', 'too_full')),
  recorded_at timestamptz not null default now()
);

create table public.onboarding_progress (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  safety_completed boolean not null default false,
  week_preference_completed boolean not null default false,
  photo_taste_completed boolean not null default false,
  body_profile_completed boolean not null default false,
  reminder_completed boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.weekly_meal_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  week_start date not null,
  status text not null check (status in ('draft', 'confirmed')),
  stated_relaxations text[] not null default '{}'
    check (stated_relaxations <@ array['time', 'cuisine']::text[]),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.weekly_meal_plan_entries (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null,
  user_id uuid not null,
  entry_date date not null,
  kind text not null check (kind in ('recipe', 'day_of_decision')),
  recipe_id text,
  planned_meal_time text,
  reason text check (reason in ('no_safe_recipe', 'grocery_need_cap')),
  stated_relaxations text[] not null default '{}'
    check (stated_relaxations <@ array['time', 'cuisine']::text[]),
  portion_servings numeric(3, 2),
  portion_label text,
  portion_disclaimer text,
  constraint weekly_meal_plan_entries_plan_owner_fkey
    foreign key (plan_id, user_id)
    references public.weekly_meal_plans(id, user_id) on delete cascade,
  constraint weekly_meal_plan_entries_plan_date_key unique (plan_id, entry_date),
  constraint weekly_meal_plan_entries_variant_valid check (
    (
      kind = 'recipe'
      and recipe_id is not null and length(recipe_id) > 0
      and planned_meal_time is not null
      and planned_meal_time ~
        '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d+)?[+-]\\d{2}:\\d{2}$'
      and left(planned_meal_time, 10)::date = entry_date
      and reason is null
      and (
        (portion_servings is null and portion_label is null and portion_disclaimer is null)
        or (
          portion_servings between 0.75 and 1.5
          and mod(portion_servings * 4, 1) = 0
          and portion_label is not null
          and portion_disclaimer = 'Estimate only—adjust to your hunger.'
        )
      )
    )
    or (
      kind = 'day_of_decision'
      and recipe_id is null
      and planned_meal_time is null
      and reason is not null
      and stated_relaxations = array[]::text[]
      and portion_servings is null
      and portion_label is null
      and portion_disclaimer is null
    )
  )
);

create table public.plan_linked_grocery_needs (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null,
  user_id uuid not null,
  ingredient_id text not null check (length(ingredient_id) > 0),
  recipe_ids text[] not null check (cardinality(recipe_ids) > 0),
  dates date[] not null check (cardinality(dates) > 0),
  constraint plan_linked_grocery_needs_plan_owner_fkey
    foreign key (plan_id, user_id)
    references public.weekly_meal_plans(id, user_id) on delete cascade,
  constraint plan_linked_grocery_needs_plan_ingredient_key
    unique (plan_id, ingredient_id)
);

create table public.meal_reminder_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  enabled boolean not null,
  lead_minutes smallint not null check (lead_minutes in (0, 10, 15, 30, 60)),
  updated_at timestamptz not null default now()
);

-- RLS predicates and cascade joins all need supporting indexes. The duplicate
-- child orderings are intentional: user-first serves policy-filtered reads;
-- plan-first serves parent replacement and ON DELETE CASCADE.
create index taste_signals_user_recorded_at_idx
  on public.taste_signals (user_id, recorded_at desc);
create index meal_satiety_user_recorded_at_idx
  on public.meal_satiety (user_id, recorded_at desc);
create unique index weekly_meal_plans_user_week_idx
  on public.weekly_meal_plans (user_id, week_start);
create index weekly_meal_plan_entries_user_plan_idx
  on public.weekly_meal_plan_entries (user_id, plan_id);
create index weekly_meal_plan_entries_plan_owner_idx
  on public.weekly_meal_plan_entries (plan_id, user_id);
create index plan_linked_grocery_needs_user_plan_idx
  on public.plan_linked_grocery_needs (user_id, plan_id);
create index plan_linked_grocery_needs_plan_owner_idx
  on public.plan_linked_grocery_needs (plan_id, user_id);

create trigger onboarding_progress_touch_updated_at
  before update on public.onboarding_progress
  for each row execute function private.touch_updated_at();
create trigger weekly_meal_plans_touch_updated_at
  before update on public.weekly_meal_plans
  for each row execute function private.touch_updated_at();
create trigger meal_reminder_preferences_touch_updated_at
  before update on public.meal_reminder_preferences
  for each row execute function private.touch_updated_at();

alter table public.body_profiles enable row level security;
alter table public.taste_signals enable row level security;
alter table public.meal_satiety enable row level security;
alter table public.onboarding_progress enable row level security;
alter table public.weekly_meal_plans enable row level security;
alter table public.weekly_meal_plan_entries enable row level security;
alter table public.plan_linked_grocery_needs enable row level security;
alter table public.meal_reminder_preferences enable row level security;

create policy body_profiles_read_own on public.body_profiles
  for select to authenticated using ((select auth.uid()) = user_id);
create policy body_profiles_insert_own on public.body_profiles
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy body_profiles_update_own on public.body_profiles
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy body_profiles_delete_own on public.body_profiles
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy taste_signals_read_own on public.taste_signals
  for select to authenticated using ((select auth.uid()) = user_id);
create policy taste_signals_insert_own on public.taste_signals
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy meal_satiety_read_own on public.meal_satiety
  for select to authenticated using ((select auth.uid()) = user_id);
create policy meal_satiety_insert_own on public.meal_satiety
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy onboarding_progress_read_own on public.onboarding_progress
  for select to authenticated using ((select auth.uid()) = user_id);
create policy onboarding_progress_insert_own on public.onboarding_progress
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy onboarding_progress_update_own on public.onboarding_progress
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy weekly_meal_plans_read_own on public.weekly_meal_plans
  for select to authenticated using ((select auth.uid()) = user_id);
create policy weekly_meal_plans_insert_own on public.weekly_meal_plans
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy weekly_meal_plans_update_own on public.weekly_meal_plans
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy weekly_meal_plans_delete_own on public.weekly_meal_plans
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy weekly_meal_plan_entries_read_own on public.weekly_meal_plan_entries
  for select to authenticated using ((select auth.uid()) = user_id);
create policy weekly_meal_plan_entries_insert_own on public.weekly_meal_plan_entries
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy weekly_meal_plan_entries_delete_own on public.weekly_meal_plan_entries
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy plan_linked_grocery_needs_read_own on public.plan_linked_grocery_needs
  for select to authenticated using ((select auth.uid()) = user_id);
create policy plan_linked_grocery_needs_insert_own on public.plan_linked_grocery_needs
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy plan_linked_grocery_needs_delete_own on public.plan_linked_grocery_needs
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy meal_reminder_preferences_read_own on public.meal_reminder_preferences
  for select to authenticated using ((select auth.uid()) = user_id);
create policy meal_reminder_preferences_insert_own on public.meal_reminder_preferences
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy meal_reminder_preferences_update_own on public.meal_reminder_preferences
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on public.body_profiles from anon, authenticated;
revoke all on public.taste_signals from anon, authenticated;
revoke all on public.meal_satiety from anon, authenticated;
revoke all on public.onboarding_progress from anon, authenticated;
revoke all on public.weekly_meal_plans from anon, authenticated;
revoke all on public.weekly_meal_plan_entries from anon, authenticated;
revoke all on public.plan_linked_grocery_needs from anon, authenticated;
revoke all on public.meal_reminder_preferences from anon, authenticated;

grant select, insert, update, delete on public.body_profiles to authenticated;
grant select, insert on public.taste_signals to authenticated;
grant select, insert on public.meal_satiety to authenticated;
grant select, insert, update on public.onboarding_progress to authenticated;
grant select, insert, update, delete on public.weekly_meal_plans to authenticated;
grant select, insert, delete on public.weekly_meal_plan_entries to authenticated;
grant select, insert, delete on public.plan_linked_grocery_needs to authenticated;
grant select, insert, update on public.meal_reminder_preferences to authenticated;

-- PostgREST sends one RPC statement, so deleting both derived snapshots and
-- inserting their complete replacements commits or rolls back as one unit.
-- SECURITY INVOKER intentionally keeps the caller's grants and RLS active.
create function public.replace_weekly_plan_children(
  p_plan_id uuid,
  p_entries jsonb,
  p_grocery_needs jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
begin
  if caller_id is null or not exists (
    select 1
      from public.weekly_meal_plans
     where id = p_plan_id and user_id = caller_id
  ) then
    raise exception 'Weekly plan is not owned by the caller'
      using errcode = '42501';
  end if;

  delete from public.weekly_meal_plan_entries
   where plan_id = p_plan_id and user_id = caller_id;
  delete from public.plan_linked_grocery_needs
   where plan_id = p_plan_id and user_id = caller_id;

  insert into public.weekly_meal_plan_entries (
    plan_id, user_id, entry_date, kind, recipe_id, planned_meal_time, reason,
    stated_relaxations, portion_servings, portion_label, portion_disclaimer
  )
  select p_plan_id, caller_id, replacement.entry_date, replacement.kind,
         replacement.recipe_id, replacement.planned_meal_time, replacement.reason,
         replacement.stated_relaxations, replacement.portion_servings,
         replacement.portion_label, replacement.portion_disclaimer
    from jsonb_to_recordset(p_entries) as replacement (
      entry_date date,
      kind text,
      recipe_id text,
      planned_meal_time text,
      reason text,
      stated_relaxations text[],
      portion_servings numeric,
      portion_label text,
      portion_disclaimer text
    );

  insert into public.plan_linked_grocery_needs (
    plan_id, user_id, ingredient_id, recipe_ids, dates
  )
  select p_plan_id, caller_id, replacement.ingredient_id,
         replacement.recipe_ids, replacement.dates
    from jsonb_to_recordset(p_grocery_needs) as replacement (
      ingredient_id text,
      recipe_ids text[],
      dates date[]
    );
end;
$$;

revoke all on function public.replace_weekly_plan_children(uuid, jsonb, jsonb)
  from public, anon;
grant execute on function public.replace_weekly_plan_children(uuid, jsonb, jsonb)
  to authenticated;

-- A plan-linked grocery need is not a reusable shopping-list row. Normalize
-- historical rows before tightening the pantry source domain.
update public.inventory set source = 'manual' where source = 'shopping_list';
alter table public.inventory drop constraint inventory_source_check;
alter table public.inventory add constraint inventory_source_check
  check (source in ('manual', 'photo', 'staple'));
