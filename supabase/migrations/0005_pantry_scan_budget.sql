-- ---------------------------------------------------------------------------
-- Per-user daily budget for Gemini photo scans (analyze-pantry-photo).
--
-- Before this table the Edge Function had no idea who was calling and no
-- memory between calls: anyone holding the public anon key could invoke it
-- in a loop and drain the Gemini quota -- a pure cost attack with no data at
-- stake. The budget lives here rather than in the function process so it
-- survives restarts and is enforced atomically: read-check-write from Deno
-- would race two concurrent requests past any limit.
--
-- The ledger is one row per user per UTC day. It records a COUNT of scans,
-- never image contents -- photos are processed and discarded (§6 retention
-- posture) and nothing about them lands in Postgres.
-- ---------------------------------------------------------------------------

create table private.pantry_scan_usage (
  user_id     uuid        not null references auth.users(id) on delete cascade,
  usage_date  date        not null default (now() at time zone 'utc')::date,
  scan_count  int         not null default 0,
  updated_at  timestamptz not null default now(),

  primary key (user_id, usage_date),
  constraint pantry_scan_usage_count_valid check (scan_count >= 0)
);

-- RLS enabled with zero policies: deny-all for anon and authenticated. This
-- is deliberate -- scan volume per user is nobody else's business and no
-- client feature reads it. The Edge Function reaches it through the SECURITY
-- DEFINER function below, not through table access. The schema-level revokes
-- from 0001 keep the table unreachable over the Data API in any case.
alter table private.pantry_scan_usage enable row level security;


-- Atomically spend one scan from the caller's daily budget.
--
-- Returns true when a scan was granted (row inserted or incremented), false
-- when the caller is anonymous or the day's budget is spent. The single
-- INSERT ... ON CONFLICT ... WHERE statement is the whole trick: when the
-- WHERE clause fails, the DO UPDATE updates zero rows and FOUND is false --
-- no read between write, no race, no gap for concurrent requests.
--
-- SECURITY DEFINER so the definer (postgres), not the caller, needs rights
-- on the table. Caller identity comes from (select auth.uid()) -- the JWT
-- the Edge Function forwards -- never from an argument.
--
-- Not exposed over the API: `private` is outside PostgREST's exposed schemas
-- (config.toml [api].schemas), so despite EXECUTE being granted to
-- service_role below, no HTTP client can reach this function directly.
create or replace function private.claim_pantry_scan(p_daily_limit int)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  today  date := (now() at time zone 'utc')::date;
  caller uuid := (select auth.uid());
begin
  if caller is null then
    return false;
  end if;

  insert into private.pantry_scan_usage as u (user_id, usage_date, scan_count)
  values (caller, today, 1)
  on conflict (user_id, usage_date)
  do update set scan_count = u.scan_count + 1,
                updated_at = now()
  where u.scan_count < p_daily_limit;

  return found;
end;
$$;

revoke execute on function private.claim_pantry_scan(int)
  from public, anon, authenticated;

-- 0001 revoked ALL on schema private from PUBLIC, which strips USAGE from
-- service_role too -- without this grant the Edge Function's call dies with
-- "permission denied for schema private" before the function is even entered.
grant usage on schema private to service_role;
grant execute on function private.claim_pantry_scan(int) to service_role;
