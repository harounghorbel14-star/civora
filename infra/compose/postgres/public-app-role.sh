#!/bin/sh
# Dev only: the application's account on pg-public, for the catalogue (Phase 5, doc phase-5/01). NOBYPASSRLS and owns
# nothing; the public migrations (services/core/migrations-public) grant it what it may do: read the published views,
# change content only through the catalogue's functions.
# Runs at first start (docker-entrypoint-initdb.d) and again from infra/scripts/dev-cell-up.sh, so a pg-public volume
# created before Phase 5 gets the account too. Idempotent; the password comes from .env (PG_PUBLIC_APP_PASSWORD).
set -eu
psql -v ON_ERROR_STOP=1 -v pw="$PG_PUBLIC_APP_PASSWORD" -v db="$POSTGRES_DB" --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<'SQL'
SELECT 'CREATE ROLE civora_core_app' WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'civora_core_app') \gexec
ALTER ROLE civora_core_app LOGIN NOBYPASSRLS PASSWORD :'pw';
REVOKE ALL ON DATABASE :"db" FROM PUBLIC;
GRANT CONNECT ON DATABASE :"db" TO civora_core_app;
SQL
