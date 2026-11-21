#!/bin/sh
# Dev only: a separate database and role for Keycloak on pg-core.
# Staging and production give Keycloak its own database cluster (ADR-005).
# The application connects as civora_core_app (Phase 3: NOBYPASSRLS, owns nothing; the migrations grant it what it
# may do), not as the owner civora_core, so row-level security applies in the dev cell as it does in production.
set -eu
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<SQL
CREATE ROLE keycloak LOGIN PASSWORD '${KEYCLOAK_DB_PASSWORD}';
CREATE DATABASE keycloak OWNER keycloak;
REVOKE ALL ON DATABASE civora_core FROM PUBLIC;
CREATE ROLE civora_core_app LOGIN NOBYPASSRLS PASSWORD '${PG_CORE_APP_PASSWORD}';
GRANT CONNECT ON DATABASE civora_core TO civora_core_app;
SQL
