-- Disposable local/CI proof: never run migration tests against a hosted project.
\set ON_ERROR_STOP on
begin;
insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values
('00000000-0000-0000-0000-000000000000', 'cccccccc-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'slots-a@test.invalid', '{}', now(), now()),
('00000000-0000-0000-0000-000000000000', 'cccccccc-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'slots-b@test.invalid', '{}', now(), now());

set local role authenticated;
select set_config('request.jwt.claim.sub', 'cccccccc-0000-4000-8000-000000000001', true);

do $$
declare
  count_days integer;
  slot_mask integer;
  payload jsonb;
  malformed jsonb;
  v_plan_id uuid;
  anchor date := '2030-01-07';
  selected_slots text[];
  stored_count integer;
begin
  foreach count_days in array array[3,5,7] loop
    for slot_mask in 1..7 loop
      select array_agg(slot order by ord) into selected_slots
        from unnest(array['breakfast','lunch','dinner']) with ordinality as s(slot, ord)
       where (slot_mask & (1 << (ord::int - 1))) <> 0;
      select jsonb_agg(jsonb_build_object(
        'entry_date', anchor + day_index,
        'meal_slot', slot,
        'kind', 'day_of_decision',
        'reason', 'no_safe_recipe',
        'stated_relaxations', '[]'::jsonb
      ) order by day_index, ord) into payload
        from generate_series(0, count_days - 1) d(day_index)
        cross join unnest(selected_slots) with ordinality s(slot, ord);
      v_plan_id := public.create_weekly_meal_plan(anchor, 'draft', array[]::text[], payload, '[]', true);
      if not exists (select 1 from public.weekly_meal_plans p where p.id = v_plan_id
          and p.day_count = count_days and p.meal_slots = selected_slots and p.limited_variety) then
        raise exception 'Plan metadata did not round-trip for % days and %', count_days, selected_slots;
      end if;
      select count(*) into stored_count from public.weekly_meal_plan_entries e where e.plan_id = v_plan_id;
      if stored_count <> count_days * cardinality(selected_slots) then
        raise exception 'Meal slot coverage was not persisted';
      end if;

      -- Invalid replacements must leave the old parent and children intact.
      malformed := jsonb_set(payload, '{0,meal_slot}', '"snack"');
      begin
        perform public.replace_weekly_plan_children(v_plan_id, malformed, '[]', false);
        raise exception 'Invalid slot accepted';
      exception when invalid_parameter_value then null;
      end;
      begin
        perform public.replace_weekly_plan_children(v_plan_id, payload - 0, '[]', false);
        raise exception 'Incomplete coverage accepted';
      exception when invalid_parameter_value then null;
      end;
      begin
        perform public.replace_weekly_plan_children(v_plan_id, jsonb_set(payload, '{0,meal_slot}', 'null'), '[]', false);
        raise exception 'Null slot accepted';
      exception when invalid_parameter_value then null;
      end;
      if (select count(*) from public.weekly_meal_plan_entries e where e.plan_id = v_plan_id) <> stored_count
         or not (select limited_variety from public.weekly_meal_plans where id = v_plan_id) then
        raise exception 'Failed replacement changed the saved plan';
      end if;

      begin
        insert into public.weekly_meal_plan_entries
          (plan_id, user_id, entry_date, meal_slot, kind, reason, stated_relaxations)
        values (v_plan_id, 'cccccccc-0000-4000-8000-000000000001', anchor, selected_slots[1],
          'day_of_decision', 'no_safe_recipe', array[]::text[]);
        raise exception 'Duplicate date and slot accepted';
      exception when unique_violation then null;
      end;

      perform set_config('request.jwt.claim.sub', 'cccccccc-0000-4000-8000-000000000002', true);
      if exists (select 1 from public.weekly_meal_plan_entries e where e.plan_id = v_plan_id) then
        raise exception 'Other user can read meal slots';
      end if;
      begin
        perform public.replace_weekly_plan_children(v_plan_id, payload, '[]', false);
        raise exception 'Other user can replace meal slots';
      exception when insufficient_privilege then null;
      end;
      perform set_config('request.jwt.claim.sub', 'cccccccc-0000-4000-8000-000000000001', true);
      perform public.replace_weekly_plan_children(v_plan_id, payload, '[]', false);
      if (select limited_variety from public.weekly_meal_plans where id = v_plan_id) then
        raise exception 'Replacement did not update variety metadata';
      end if;
      anchor := anchor + 7;
    end loop;
  end loop;

  -- Older callers omit meal_slot and the new optional RPC argument.
  select jsonb_agg(jsonb_build_object('entry_date', anchor + n,
    'kind', 'day_of_decision', 'reason', 'no_safe_recipe', 'stated_relaxations', '[]'::jsonb)
    order by n) into payload from generate_series(0,6) d(n);
  v_plan_id := public.create_weekly_meal_plan(anchor, 'confirmed', array[]::text[], payload, '[]');
  if not exists (select 1 from public.weekly_meal_plans where id = v_plan_id
    and day_count = 7 and meal_slots = array['dinner']) then
    raise exception 'Legacy dinner plan did not migrate';
  end if;
  if exists (select 1 from public.weekly_meal_plan_entries e where e.plan_id = v_plan_id and meal_slot <> 'dinner') then
    raise exception 'Legacy meals changed slot';
  end if;
end $$;
rollback;
