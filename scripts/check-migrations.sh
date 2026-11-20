#!/usr/bin/env bash
# Aplica as migrações + seed num Postgres descartável e roda os testes de banco.
# Uso: npm run db:check            (sobe um Postgres temporário local)
#      DATABASE_URL=... npm run db:check   (usa um Postgres existente e vazio — ex.: CI)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

run_all() {
  local url="$1"
  psql "$url" -q -v ON_ERROR_STOP=1 -f "$ROOT/tests/db/00_supabase_stub.sql"
  psql "$url" -q -v ON_ERROR_STOP=1 -c 'grant select on all tables in schema public to anon, authenticated;' >/dev/null 2>&1 || true
  for f in "$ROOT"/supabase/migrations/*.sql; do
    echo "→ migração $(basename "$f")"
    psql "$url" -q -v ON_ERROR_STOP=1 -f "$f"
  done
  # Supabase concede SELECT às roles por padrão; replicamos para o RLS ser o filtro
  psql "$url" -q -v ON_ERROR_STOP=1 -c 'grant select on all tables in schema public to anon, authenticated;'
  psql "$url" -q -v ON_ERROR_STOP=1 -f "$ROOT/supabase/seed.sql"
  for f in "$ROOT"/tests/db/[1-9]*.sql; do
    echo "→ teste $(basename "$f")"
    psql "$url" -q -v ON_ERROR_STOP=1 -f "$f"
  done
}

if [[ -n "${DATABASE_URL:-}" ]]; then
  run_all "$DATABASE_URL"
  exit 0
fi

PGBIN="$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)"
[[ -x "$PGBIN/initdb" ]] || { echo "Postgres não encontrado; defina DATABASE_URL"; exit 1; }
TMP="$(mktemp -d)"
PORT=55432
AS=()
if [[ "$(id -u)" == "0" ]]; then chown postgres "$TMP"; AS=(runuser -u postgres --); fi
cleanup() { "${AS[@]}" "$PGBIN/pg_ctl" -D "$TMP/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$TMP"; }
trap cleanup EXIT
"${AS[@]}" "$PGBIN/initdb" -D "$TMP/data" -U postgres --auth=trust >/dev/null
"${AS[@]}" "$PGBIN/pg_ctl" -D "$TMP/data" -o "-p $PORT -k $TMP -c listen_addresses=''" -l "$TMP/log" -w start >/dev/null
run_all "postgresql://postgres@/postgres?host=$TMP&port=$PORT"
