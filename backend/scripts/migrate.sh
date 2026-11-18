#!/usr/bin/env bash
# Apply versioned Prisma migrations. Databases created by the earlier `prisma db push`
# already contain the baseline tables, so they are marked as baselined instead of re-created.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."
if [[ -z "${DATABASE_URL:-}" && -f .env ]]; then
  DATABASE_URL="$(sed -nE 's/^DATABASE_URL="?([^"]*)"?$/\1/p' .env)"
fi
export DATABASE_URL

BASELINE="20261018000000_baseline"
# libpq rejects Prisma's `schema` query parameter.
psql_url="$(sed -E 's/[?&]schema=[^&]*//; s/\?$//' <<<"${DATABASE_URL}")"

has_table() {
  psql "${psql_url}" -tAc "SELECT to_regclass('public.$1') IS NOT NULL" 2>/dev/null | grep -q t
}

if has_table users && ! has_table _prisma_migrations; then
  echo "Existing schema without migration history; marking ${BASELINE} as applied"
  npx prisma migrate resolve --applied "${BASELINE}"
fi

npx prisma migrate deploy
