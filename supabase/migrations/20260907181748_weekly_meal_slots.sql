-- Preserve existing saved meals as dinner while allowing distinct daily meal slots.
alter table public.weekly_meal_plan_entries
  add column meal_slot text not null default 'dinner'
    check (meal_slot in ('breakfast', 'lunch', 'dinner'));
alter table public.weekly_meal_plan_entries
  drop constraint weekly_meal_plan_entries_plan_date_key,
  add constraint weekly_meal_plan_entries_plan_date_slot_key unique (plan_id, entry_date, meal_slot);
alter table public.weekly_meal_plan_entries
  drop constraint weekly_meal_plan_entries_reason_check,
  add constraint weekly_meal_plan_entries_reason_check
    check (reason in ('no_safe_recipe', 'grocery_need_cap', 'not_planned'));

alter table public.weekly_meal_plans
  add column day_count smallint not null default 7 check (day_count in (3, 5, 7)),
  add column meal_slots text[] not null default array['dinner']::text[]
    check (meal_slots in (
      array['breakfast'], array['lunch'], array['dinner'],
      array['breakfast','lunch'], array['breakfast','dinner'], array['lunch','dinner'],
      array['breakfast','lunch','dinner']
    )),
  add column limited_variety boolean not null default false;

-- Defaulted final parameters let older dinner-only callers continue to work.
drop function public.create_weekly_meal_plan(date, text, text[], jsonb, jsonb);
drop function public.replace_weekly_plan_children(uuid, jsonb, jsonb);

create or replace function private.validate_weekly_plan_payload(
  p_week_start date,
  p_entries jsonb,
  p_grocery_needs jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  entry jsonb;
  need jsonb;
  value jsonb;
  entry_date date;
  entry_kind text;
  recipe_id text;
  planned_meal_time text;
  reason text;
  portion_servings numeric;
  portion_label text;
  portion_disclaimer text;
  stated_relaxations text[];
  entry_dates date[] := array[]::date[];
  concrete_recipe_ids text[] := array[]::text[];
  ingredient_ids text[] := array[]::text[];
  expected_offset int;
  slot text;
  selected_slots text[];
  entry_keys text[] := array[]::text[];
  selected_day_count int;
  entry_position int := 0;
begin
  if p_week_start is null
     or jsonb_typeof(p_entries) is distinct from 'array'
     or jsonb_typeof(p_grocery_needs) is distinct from 'array' then
    raise exception 'Weekly plan payloads must be JSON arrays'
      using errcode = '22023';
  end if;

  if jsonb_array_length(p_entries) not between 3 and 21 then
    raise exception 'Weekly plan requires between three and twenty-one meal entries'
      using errcode = '22023';
  end if;

  if jsonb_array_length(p_grocery_needs) > 12 then
    raise exception 'Weekly plan permits at most twelve grocery needs'
      using errcode = '22023';
  end if;

  select array_agg(distinct coalesce(item ->> 'meal_slot', 'dinner'))
    into selected_slots from jsonb_array_elements(p_entries) as items(item);
  if not selected_slots <@ array['breakfast', 'lunch', 'dinner']::text[] then
    raise exception 'Invalid meal slot' using errcode = '22023';
  end if;
  select array_agg(slots.slot_name order by array_position(array['breakfast','lunch','dinner'], slots.slot_name))
    into selected_slots from unnest(selected_slots) as slots(slot_name);
  select count(distinct item ->> 'entry_date') into selected_day_count
    from jsonb_array_elements(p_entries) as items(item);
  if selected_day_count not in (3, 5, 7)
     or jsonb_array_length(p_entries) <> selected_day_count * cardinality(selected_slots) then
    raise exception 'Plan must cover three, five, or seven dates and every selected slot'
      using errcode = '22023';
  end if;

  for entry in select item from jsonb_array_elements(p_entries) as items(item)
  loop
    if jsonb_typeof(entry) is distinct from 'object'
       or jsonb_typeof(entry -> 'entry_date') is distinct from 'string'
       or (entry ? 'meal_slot' and jsonb_typeof(entry -> 'meal_slot') is distinct from 'string')
       or jsonb_typeof(entry -> 'kind') is distinct from 'string'
       or jsonb_typeof(entry -> 'stated_relaxations') is distinct from 'array'
       or exists (
         select 1
           from jsonb_array_elements(entry -> 'stated_relaxations') as elements(element)
          where jsonb_typeof(element) <> 'string'
       ) then
      raise exception 'Weekly entry has malformed fields'
        using errcode = '22023';
    end if;

    entry_date := (entry ->> 'entry_date')::date;
    entry_kind := entry ->> 'kind';
    slot := coalesce(entry ->> 'meal_slot', 'dinner');
    if entry_date is distinct from p_week_start + (entry_position / cardinality(selected_slots))
       or slot is distinct from selected_slots[(entry_position % cardinality(selected_slots)) + 1]
       or (entry_date::text || ':' || slot) = any(entry_keys) then
      raise exception 'Weekly entries must cover each date and slot once in date and meal order'
        using errcode = '22023';
    end if;
    entry_position := entry_position + 1;
    entry_keys := array_append(entry_keys, entry_date::text || ':' || slot);
    entry_dates := array_append(entry_dates, entry_date);

    select coalesce(array_agg(relaxation), array[]::text[])
      into stated_relaxations
      from jsonb_array_elements_text(entry -> 'stated_relaxations')
        as relaxations(relaxation);
    if not stated_relaxations <@ array['time', 'cuisine']::text[] then
      raise exception 'Weekly entry has an invalid relaxation'
        using errcode = '22023';
    end if;

    recipe_id := entry ->> 'recipe_id';
    planned_meal_time := entry ->> 'planned_meal_time';
    reason := entry ->> 'reason';
    portion_label := entry ->> 'portion_label';
    portion_disclaimer := entry ->> 'portion_disclaimer';
    portion_servings := case
      when entry ->> 'portion_servings' is null then null
      else (entry ->> 'portion_servings')::numeric
    end;

    if entry_kind = 'recipe' then
      if jsonb_typeof(entry -> 'recipe_id') is distinct from 'string'
         or length(recipe_id) = 0
         or jsonb_typeof(entry -> 'planned_meal_time') is distinct from 'string'
         or planned_meal_time !~
           '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}([.][0-9]+)?[+-][0-9]{2}:[0-9]{2}$'
         or left(planned_meal_time, 10)::date <> entry_date
         or reason is not null then
        raise exception 'Concrete weekly entry has invalid recipe fields'
          using errcode = '22023';
      end if;

      if portion_servings is null and portion_label is null and portion_disclaimer is null then
        null;
      elsif jsonb_typeof(entry -> 'portion_servings') is distinct from 'number'
         or jsonb_typeof(entry -> 'portion_label') is distinct from 'string'
         or jsonb_typeof(entry -> 'portion_disclaimer') is distinct from 'string'
         or portion_servings not between 0.75 and 1.5
         or mod(portion_servings * 4, 1) <> 0
         or portion_label !~ '^Start with .+ servings?$'
         or portion_disclaimer <> 'Estimate only—adjust to your hunger.' then
        raise exception 'Concrete weekly entry has invalid portion guidance'
          using errcode = '22023';
      end if;

      concrete_recipe_ids := array_append(concrete_recipe_ids, recipe_id);
    elsif entry_kind = 'day_of_decision' then
      if recipe_id is not null
         or planned_meal_time is not null
         or jsonb_typeof(entry -> 'reason') is distinct from 'string'
         or reason not in ('no_safe_recipe', 'grocery_need_cap', 'not_planned')
         or cardinality(stated_relaxations) <> 0
         or portion_servings is not null
         or portion_label is not null
         or portion_disclaimer is not null then
        raise exception 'Day-of-decision entry has invalid fields'
          using errcode = '22023';
      end if;
    else
      raise exception 'Weekly entry has an invalid kind'
        using errcode = '22023';
    end if;
  end loop;

  for expected_offset in 0 .. selected_day_count - 1 loop
    if not ((p_week_start + expected_offset) = any(entry_dates)) then
      raise exception 'Weekly entries must match consecutive plan dates'
        using errcode = '22023';
    end if;
  end loop;

  for need in select item from jsonb_array_elements(p_grocery_needs) as needs(item)
  loop
    if jsonb_typeof(need) is distinct from 'object'
       or jsonb_typeof(need -> 'ingredient_id') is distinct from 'string'
       or length(need ->> 'ingredient_id') = 0
       or jsonb_typeof(need -> 'recipe_ids') is distinct from 'array'
       or jsonb_typeof(need -> 'dates') is distinct from 'array'
       or jsonb_array_length(need -> 'recipe_ids') = 0
       or jsonb_array_length(need -> 'dates') = 0 then
      raise exception 'Grocery need has malformed fields'
        using errcode = '22023';
    end if;

    if (need ->> 'ingredient_id') = any(ingredient_ids) then
      raise exception 'Grocery ingredient ids must be unique'
        using errcode = '22023';
    end if;
    ingredient_ids := array_append(ingredient_ids, need ->> 'ingredient_id');

    for value in select item from jsonb_array_elements(need -> 'recipe_ids') as refs(item)
    loop
      if jsonb_typeof(value) <> 'string'
         or not ((value #>> '{}') = any(concrete_recipe_ids)) then
        raise exception 'Grocery recipe ids must reference concrete plan entries'
          using errcode = '22023';
      end if;
    end loop;

    for value in select item from jsonb_array_elements(need -> 'dates') as refs(item)
    loop
      if jsonb_typeof(value) <> 'string'
         or not (((value #>> '{}')::date) = any(entry_dates)) then
        raise exception 'Grocery dates must reference plan entry dates'
          using errcode = '22023';
      end if;
    end loop;
  end loop;
end;
$$;

revoke all on function private.validate_weekly_plan_payload(date, jsonb, jsonb)
  from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.validate_weekly_plan_payload(date, jsonb, jsonb)
  to authenticated;


create or replace function public.replace_weekly_plan_children(
  p_plan_id uuid,
  p_entries jsonb,
  p_grocery_needs jsonb,
  p_limited_variety boolean default false
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  parent_week_start date;
begin
  select week_start
    into parent_week_start
    from public.weekly_meal_plans
   where id = p_plan_id and user_id = caller_id
   for update;

  if caller_id is null or parent_week_start is null then
    raise exception 'Weekly plan is not owned by the caller'
      using errcode = '42501';
  end if;

  perform private.validate_weekly_plan_payload(
    parent_week_start, p_entries, p_grocery_needs
  );

  update public.weekly_meal_plans
     set day_count = (select count(distinct item ->> 'entry_date') from jsonb_array_elements(p_entries) items(item)),
         meal_slots = (select array_agg(slot order by array_position(array['breakfast','lunch','dinner'], slot))
           from (select distinct coalesce(item ->> 'meal_slot', 'dinner') slot from jsonb_array_elements(p_entries) items(item)) slots),
         limited_variety = coalesce(p_limited_variety, false),
         stated_relaxations = array(select distinct value from jsonb_array_elements(p_entries) items(item),
           jsonb_array_elements_text(item -> 'stated_relaxations') values_list(value) order by value)
   where id = p_plan_id and user_id = caller_id;

  delete from public.weekly_meal_plan_entries
   where plan_id = p_plan_id and user_id = caller_id;
  delete from public.plan_linked_grocery_needs
   where plan_id = p_plan_id and user_id = caller_id;

  insert into public.weekly_meal_plan_entries (
    plan_id, user_id, entry_date, meal_slot, kind, recipe_id, planned_meal_time, reason,
    stated_relaxations, portion_servings, portion_label, portion_disclaimer
  )
  select p_plan_id, caller_id, replacement.entry_date, coalesce(replacement.meal_slot, 'dinner'), replacement.kind,
         replacement.recipe_id, replacement.planned_meal_time, replacement.reason,
         replacement.stated_relaxations, replacement.portion_servings,
         replacement.portion_label, replacement.portion_disclaimer
    from jsonb_to_recordset(p_entries) as replacement (
      entry_date date,
      meal_slot text,
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

revoke all on function public.replace_weekly_plan_children(uuid, jsonb, jsonb, boolean)
  from public, anon;
grant execute on function public.replace_weekly_plan_children(uuid, jsonb, jsonb, boolean)
  to authenticated;


create or replace function public.create_weekly_meal_plan(
  p_week_start date,
  p_status text,
  p_stated_relaxations text[],
  p_entries jsonb,
  p_grocery_needs jsonb,
  p_limited_variety boolean default false
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  new_plan_id uuid;
begin
  if caller_id is null then
    raise exception 'Weekly plan requires an authenticated caller'
      using errcode = '42501';
  end if;

  perform private.validate_weekly_plan_payload(
    p_week_start, p_entries, p_grocery_needs
  );

  insert into public.weekly_meal_plans (
    user_id, week_start, status, stated_relaxations
  ) values (
    caller_id, p_week_start, p_status, p_stated_relaxations
  )
  returning id into new_plan_id;

  perform public.replace_weekly_plan_children(
    new_plan_id, p_entries, p_grocery_needs, p_limited_variety
  );

  return new_plan_id;
end;
$$;

revoke all on function public.create_weekly_meal_plan(date, text, text[], jsonb, jsonb, boolean)
  from public, anon;
grant execute on function public.create_weekly_meal_plan(date, text, text[], jsonb, jsonb, boolean)
  to authenticated;
