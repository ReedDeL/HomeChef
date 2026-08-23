create table meal_satiety (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  recipe_id text not null,
  level text not null check (level in ('still_hungry', 'satisfied', 'too_full')),
  recorded_at timestamptz not null default now()
);

create index meal_satiety_user_recorded_at_idx
  on meal_satiety (user_id, recorded_at desc);

alter table meal_satiety enable row level security;

create policy meal_satiety_read_own on meal_satiety
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy meal_satiety_insert_own on meal_satiety
  for insert to authenticated
  with check (user_id = (select auth.uid()));

grant select, insert on public.meal_satiety to authenticated;
grant select on public.meal_satiety to anon;
