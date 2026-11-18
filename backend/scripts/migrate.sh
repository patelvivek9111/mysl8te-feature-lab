#!/usr/bin/env bash
# Apply versioned Prisma migrations. Databases created by the earlier `prisma db push`
# already contain the baseline tables, so they are marked as baselined instead of re-created.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

if [[ -z "${DATABASE_URL:-}" && -f .env ]]; then
  DATABASE_URL="$(sed -nE "s/^(export[[:space:]]+)?DATABASE_URL=[\"']?([^\"']*)[\"']?[[:space:]]*$/\2/p" .env)"
fi
if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is not set (environment or backend/.env)" >&2
  exit 1
fi
export DATABASE_URL

BASELINE="20261018000000_baseline"

# libpq rejects Prisma's `schema` query parameter, so split it out.
read -r psql_url db_schema < <(node -e '
  const url = new URL(process.env.DATABASE_URL);
  const schema = url.searchParams.get("schema") || "public";
  url.searchParams.delete("schema");
  process.stdout.write(`${url.toString()} ${schema}\n`);
')

if ! psql "${psql_url}" -tAc "SELECT 1" >/dev/null; then
  echo "Cannot connect to the database in DATABASE_URL" >&2
  exit 1
fi

has_table() {
  [[ "$(psql "${psql_url}" -tAc "SELECT to_regclass('\"${db_schema}\".\"$1\"') IS NOT NULL")" == "t" ]]
}

if has_table users && ! has_table _prisma_migrations; then
  echo "Existing schema without migration history; marking ${BASELINE} as applied"
  npx prisma migrate resolve --applied "${BASELINE}"
fi

npx prisma migrate deploy

# A baselined database that drifted from the baseline would otherwise go unnoticed.
set +e
npx prisma migrate diff --from-url "${DATABASE_URL}" --to-schema-datamodel prisma/schema.prisma --exit-code >/tmp/prisma-drift.txt 2>&1
drift=$?
set -e
if [[ ${drift} -eq 2 ]]; then
  echo "Database schema differs from prisma/schema.prisma after migrating:" >&2
  grep -v '[│┌└]' /tmp/prisma-drift.txt >&2
  exit 1
elif [[ ${drift} -ne 0 ]]; then
  grep -v '[│┌└]' /tmp/prisma-drift.txt >&2
  exit "${drift}"
fi
echo "Database schema matches prisma/schema.prisma"
