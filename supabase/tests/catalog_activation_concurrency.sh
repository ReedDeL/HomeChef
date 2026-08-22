#!/usr/bin/env bash
# Exercises the service-loader/activation interleaving against disposable local
# Supabase. A FIFO keeps the writer transaction open without sleep-based timing.

set -euo pipefail

database_url='postgresql://postgres:postgres@127.0.0.1:54322/postgres'
release_id='d0000000-0000-4000-8000-000000000001'
lock_key='734483221'
test_dir="$(mktemp -d)"
writer_fifo="$test_dir/writer.sql"
writer_log="$test_dir/writer.log"
activation_log="$test_dir/activation.log"
writer_pid=''
activation_pid=''
writer_input_open=false

psql_local() {
  psql -X -v ON_ERROR_STOP=1 "$database_url" "$@"
}

fail() {
  printf 'catalog activation concurrency regression failed: %s\n' "$1" >&2
  exit 1
}

wait_for_lock() {
  local granted="$1"
  local description="$2"
  local attempt
  local observed

  for attempt in $(seq 1 100); do
    observed="$(psql_local -Atqc "
      select exists (
        select 1
          from pg_catalog.pg_locks
         where locktype = 'advisory'
           and classid = 0
           and objid = ${lock_key}
           and objsubid = 1
           and granted = ${granted}
      );")"
    if [[ "$observed" == 't' ]]; then
      return 0
    fi
    sleep 0.1
  done

  fail "timed out waiting for ${description}"
}

cleanup() {
  local status=$?

  set +e
  if [[ "$writer_input_open" == true ]]; then
    exec 3>&-
  fi
  if [[ -n "$writer_pid" ]]; then
    kill "$writer_pid" 2>/dev/null || true
    wait "$writer_pid" 2>/dev/null || true
  fi
  if [[ -n "$activation_pid" ]]; then
    kill "$activation_pid" 2>/dev/null || true
    wait "$activation_pid" 2>/dev/null || true
  fi
  psql_local -q -c "delete from public.catalog_releases where id = '${release_id}';" \
    >/dev/null 2>&1 || true
  rm -rf -- "$test_dir"
  exit "$status"
}
trap cleanup EXIT

psql_local -f supabase/tests/catalog_activation_concurrency_fixture.sql >/dev/null

mkfifo "$writer_fifo"
psql_local <"$writer_fifo" >"$writer_log" 2>&1 &
writer_pid=$!
exec 3>"$writer_fifo"
writer_input_open=true

printf '%s\n' \
  'begin;' \
  'set role service_role;' \
  "update public.catalog_recipes
      set allergen_status = 'unknown'
    where release_id = '${release_id}'
      and recipe_id = 'concurrency-recipe';" \
  "select 'writer-holds-catalog-lock' as marker;" >&3

wait_for_lock true 'the service-role writer advisory lock'

psql_local -c "select private.activate_catalog_release('${release_id}');" \
  >"$activation_log" 2>&1 &
activation_pid=$!

wait_for_lock false 'activation waiting on the writer advisory lock'

printf '%s\n' 'commit;' >&3
exec 3>&-
writer_input_open=false
if ! wait "$writer_pid"; then
  fail 'service-role writer transaction failed'
fi
writer_pid=''

if wait "$activation_pid"; then
  activation_pid=''
  fail 'activation succeeded after the unsafe writer commit'
fi
activation_pid=''

if ! grep -q 'unsafe offline recipes' "$activation_log"; then
  fail 'activation did not reject the committed unsafe offline recipe'
fi

if [[ "$(psql_local -Atqc "
  select is_active
    from public.catalog_releases
   where id = '${release_id}';")" != 'f' ]]; then
  fail 'unsafe release became active'
fi

printf 'PASS catalog activation serializes service-role child writes\n'
