#!/usr/bin/env bash
# Postgres LOCAL de desenvolvimento (porta 55433) com as migrações e os planos.
# Uso: bash scripts/dev/db.sh start | stop | reset
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DIR="${GC_DEVDB_DIR:-/tmp/gc-devdb}"
PORT=55433
URL="postgresql://postgres@127.0.0.1:$PORT/postgres"
PGBIN="$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)"
AS=(); [[ "$(id -u)" == "0" ]] && AS=(runuser -u postgres --)

stop() { [[ -d "$DIR/data" ]] && "${AS[@]}" "$PGBIN/pg_ctl" -D "$DIR/data" -m fast stop >/dev/null 2>&1 || true; }
start() {
  local fresh=0
  if [[ ! -d "$DIR/data" ]]; then
    mkdir -p "$DIR"; [[ "$(id -u)" == "0" ]] && chown postgres "$DIR"
    "${AS[@]}" "$PGBIN/initdb" -D "$DIR/data" -U postgres --auth=trust >/dev/null
    fresh=1
  fi
  "${AS[@]}" "$PGBIN/pg_ctl" -D "$DIR/data" -o "-p $PORT -k $DIR -c listen_addresses=127.0.0.1" -l "$DIR/log" -w start >/dev/null || true
  if [[ $fresh == 1 ]]; then
    psql "$URL" -q -f "$ROOT/tests/db/00_supabase_stub.sql"
    for f in "$ROOT"/supabase/migrations/*.sql; do psql "$URL" -q -v ON_ERROR_STOP=1 -f "$f"; done
    psql "$URL" -q -c 'grant select on all tables in schema public to anon, authenticated;'
    psql "$URL" -q -f "$ROOT/supabase/seed.sql"
  fi
  echo "Banco local: $URL"
}
case "${1:-start}" in
  start) start ;;
  stop) stop ;;
  reset) stop; rm -rf "$DIR"; start ;;
esac
