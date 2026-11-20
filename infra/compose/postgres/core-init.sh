#!/bin/sh
# Dev only: a separate database and role for Keycloak on pg-core.
# Staging and production give Keycloak its own database cluster (ADR-005).
set -eu
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<SQL
CREATE ROLE keycloak LOGIN PASSWORD '${KEYCLOAK_DB_PASSWORD}';
CREATE DATABASE keycloak OWNER keycloak;
REVOKE ALL ON DATABASE civora_core FROM PUBLIC;
SQL
