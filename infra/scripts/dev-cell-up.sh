#!/usr/bin/env bash
# Bring up the local development cell from scratch and verify it (O-D6, O-T3 local variant).
# Usage: infra/scripts/dev-cell-up.sh [--fresh]
#   --fresh  removes the cell's containers and named volumes first (dev data only).
# Prints the elapsed time; the result is recorded in docs/phase-2/17-technical-validation-strategy.md.
set -euo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
cd "$here/compose"
start=$(date +%s)

# 1. Dev-only secrets: random, local, never committed (.env and .generated/ are git-ignored).
if [[ ! -f .env ]]; then
  gen() { head -c 24 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 24; }
  {
    echo "PG_PUBLIC_PASSWORD=$(gen)"
    echo "PG_CORE_PASSWORD=$(gen)"
    echo "PG_AUDIT_PASSWORD=$(gen)"
    echo "KEYCLOAK_DB_PASSWORD=$(gen)"
    echo "KEYCLOAK_ADMIN_PASSWORD=$(gen)"
    echo "REDIS_PASSWORD=$(gen)"
    echo "OPENBAO_DEV_TOKEN=$(gen)"
    echo "GRAFANA_ADMIN_PASSWORD=$(gen)"
    echo "S3_ACCESS_KEY=$(gen)"
    echo "S3_SECRET_KEY=$(gen)"
    echo "SYNTHETIC_USER_PASSWORD=$(gen)"
  } > .env
  chmod 600 .env
fi
set -a; . ./.env; set +a

if [[ "${1:-}" == "--fresh" ]]; then
  docker compose down --volumes --remove-orphans
fi
mkdir -p .generated
cat > .generated/s3.json <<JSON
{"identities":[{"name":"civora-core","credentials":[{"accessKey":"${S3_ACCESS_KEY}","secretKey":"${S3_SECRET_KEY}"}],"actions":["Read","Write","List","Tagging"]}]}
JSON
chmod 600 .generated/s3.json

# 2. Build the application image and start everything; wait for health checks.
#    PROXY_CA=/path/ca.crt passes a TLS-inspecting proxy's CA as a build secret (never stored in the image).
if [[ "${SKIP_BUILD:-0}" != "1" ]]; then
  docker build ${PROXY_CA:+--secret id=proxy_ca,src=$PROXY_CA} -f "$here/../services/core/Dockerfile" -t civora-core:dev "$here/.."
fi
docker compose up -d --wait --wait-timeout 600

# Synthetic staff users get a random password from .env (none is committed).
kc() { docker compose exec -T -e KCPW="$KEYCLOAK_ADMIN_PASSWORD" -e UPW="$SYNTHETIC_USER_PASSWORD" keycloak sh -c "$1"; }
kc '/opt/keycloak/bin/kcadm.sh config credentials --config /tmp/kcadm.config --server http://localhost:8080 --realm master --user dev-admin --password "$KCPW"' >/dev/null
for u in handler.synthetic admin.synthetic; do
  kc "/opt/keycloak/bin/kcadm.sh set-password --config /tmp/kcadm.config -r civora-dev --username $u --new-password \"\$UPW\" --temporary"
done

# 3. Smoke tests.
fail=0
check() { if eval "$2" >/dev/null 2>&1; then echo "  ok   $1"; else echo "  FAIL $1"; fail=1; fi; }
echo "Smoke tests:"
check "core /health database up"            "curl -fsS localhost:3000/health | grep -q '\"database\":\"up\"'"
check "core /v1/meta/locales Arabic RTL"     "curl -fsS -H 'accept-language: ar' localhost:3000/v1/meta/locales | grep -q '\"dir\":\"rtl\"'"
check "base schemas iam/config/audit"        "docker compose exec -T pg-core psql -U civora_core -d civora_core -Atc \"select count(*) from pg_namespace where nspname in ('iam','config','audit')\" | grep -qx 3"
check "keycloak realm civora-dev"            "curl -fsS localhost:8080/realms/civora-dev/.well-known/openid-configuration | grep -q issuer"
check "redis auth required"                  "docker compose exec -T redis redis-cli ping | grep -q NOAUTH"
check "object store rejects anonymous"       "! curl -fsS localhost:8333/"
check "openbao unsealed"                     "curl -fsS localhost:8200/v1/sys/health | grep -q '\"sealed\":false'"
check "grafana requires login"               "test \"\$(curl -s -o /dev/null -w '%{http_code}' localhost:3001/api/dashboards/home)\" = 401"
check "pg-consent-audit separate cluster"    "docker compose exec -T pg-consent-audit psql -U civora_audit -d civora_audit -Atc 'select 1'"
# Tracing: a request carrying a synthetic CIN in its query string must reach Tempo, without the CIN (ADR-011).
curl -fsS -o /dev/null "localhost:3000/v1/meta/locales?cin=99123456" || true
traces_ok() {
  for _ in $(seq 1 30); do
    tid=$(docker compose exec -T observability sh -c 'curl -s "http://127.0.0.1:3200/api/search?tags=service.name%3Dcivora-core%20http.route%3D%2Fv1%2Fmeta%2Flocales&limit=1"' | sed -n 's/.*"traceID":"\([0-9a-f]*\)".*/\1/p')
    if [ -n "$tid" ]; then
      body=$(docker compose exec -T observability sh -c "curl -s http://127.0.0.1:3200/api/traces/$tid")
      echo "$body" | grep -q 'http.route' && ! echo "$body" | grep -q '99123456' && return 0
    fi
    sleep 2
  done
  return 1
}
check "traces reach Tempo, without request data" "traces_ok"

end=$(date +%s)
echo "Dev cell up in $((end - start)) s (fail=$fail)"
exit $fail
