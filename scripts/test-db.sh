#!/usr/bin/env bash
# Applies the migration to a throwaway local PostgreSQL and runs the RLS tests.
# Requires PostgreSQL 15+ binaries. pgvector is stubbed if it isn't installed.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BIN="${PG_BIN:-$(dirname "$(command -v initdb 2>/dev/null || ls -d /usr/lib/postgresql/*/bin/initdb | tail -1)")}"
TMP="$(mktemp -d)"
RUNAS=()
if [ "$(id -u)" = "0" ]; then chown -R postgres "$TMP"; RUNAS=(runuser -u postgres --); fi
"${RUNAS[@]}" "$BIN/initdb" -D "$TMP/data" -A trust -U postgres >/dev/null
"${RUNAS[@]}" "$BIN/pg_ctl" -D "$TMP/data" -o "-p 54329 -k $TMP -c listen_addresses=''" -l "$TMP/log" start >/dev/null
trap '"${RUNAS[@]}" "$BIN/pg_ctl" -D "$TMP/data" stop -m fast >/dev/null; rm -rf "$TMP"' EXIT
PSQL=(psql -h "$TMP" -p 54329 -U postgres -d postgres -v ON_ERROR_STOP=1 -q)
"${PSQL[@]}" -f "$ROOT/supabase/tests/stubs.sql"
STUB_VECTOR=0
if ! "${PSQL[@]}" -tAc "select 1 from pg_available_extensions where name='vector'" | grep -q 1; then
  echo "pgvector not installed locally: stubbing the embedding column for this test"
  STUB_VECTOR=1
fi
for MIG in "$ROOT"/supabase/migrations/*.sql; do
  if [ "$STUB_VECTOR" = 1 ]; then
    sed -e 's/^create extension if not exists vector;//' -e 's/vector(1024)/bytea/' "$MIG" > "$TMP/mig.sql"
    "${PSQL[@]}" -f "$TMP/mig.sql"
  else
    "${PSQL[@]}" -f "$MIG"
  fi
done
"${PSQL[@]}" -f "$ROOT/supabase/tests/rls_test.sql" 2>&1 | sed -n 's/.*NOTICE:  //p'
"${PSQL[@]}" -c "grant usage on schema public to anon;"
# Sync layer round trip (src/lib/cloud) against the same database.
(cd "$ROOT" && HEALTHOS_PG_HOST="$TMP" HEALTHOS_PG_PORT=54329 npx vitest run tests/cloud.db.test.ts)
echo "database tests passed"
