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
# Keys added after a developer's .env was created are appended, never overwritten.
for key in PG_CORE_APP_PASSWORD PG_PUBLIC_APP_PASSWORD; do
  grep -q "^$key=" .env || echo "$key=$(head -c 24 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 24)" >> .env
done
set -a; . ./.env; set +a

if [[ "${1:-}" == "--fresh" ]]; then
  docker compose down --volumes --remove-orphans
fi
mkdir -p .generated
cat > .generated/s3.json <<JSON
{"identities":[{"name":"civora-core","credentials":[{"accessKey":"${S3_ACCESS_KEY}","secretKey":"${S3_SECRET_KEY}"}],"actions":["Read","Write","List","Tagging"]}]}
JSON
chmod 600 .generated/s3.json
# Written after Keycloak is up (below); must exist before start so that Docker mounts a file, not a directory.
for f in provisioner.secret staff-provisioner.secret eid-sim-client.secret; do
  [ -f ".generated/$f" ] || install -m 600 /dev/null ".generated/$f"
  chmod 644 ".generated/$f"   # the core runs as UID 10001 and must read it; the dev cell is local only
done
# Key for the keyed digests of national identifiers (identity links): kept while the database is kept.
[ -s .generated/identity-digest.key ] || head -c 32 /dev/urandom | base64 > .generated/identity-digest.key
chmod 644 .generated/identity-digest.key
# The web app's signing key for its client assertions (private_key_jwt; Phase 3 doc 14): dev only, made once; the
# policy below pins its public half on civora-web. A web app run against this cell uses
# OIDC_CLIENT_KEY_FILE=infra/compose/.generated/web-client.pem.
if [ ! -s .generated/web-client.pem ]; then
  openssl ecparam -name prime256v1 -genkey -noout | openssl pkcs8 -topk8 -nocrypt -out .generated/web-client.pem
fi
chmod 600 .generated/web-client.pem
openssl pkey -in .generated/web-client.pem -pubout -outform DER | python3 -c 'import sys, json, base64
d = sys.stdin.buffer.read(); assert len(d) == 91 and d[-65] == 4, "not an uncompressed P-256 public key"
b = lambda x: base64.urlsafe_b64encode(x).rstrip(b"=").decode()
print(json.dumps({"keys": [{"kty": "EC", "crv": "P-256", "x": b(d[-64:-32]), "y": b(d[-32:]), "kid": "civora-web-1", "use": "sig", "alg": "ES256"}]}))' \
  > .generated/web-client.jwks.json

# The CIVORA Keycloak extension (SMS sign-in step, Phase 3 doc 17): the realms' flows use it, so Keycloak needs it.
# Built with Maven and Java 21 (both on GitHub's Ubuntu runners); mounted read-only into /opt/keycloak/providers.
mkdir -p .generated/keycloak-providers
if [[ "${SKIP_BUILD:-0}" != "1" || ! -s .generated/keycloak-providers/civora-keycloak-sms.jar ]]; then
  "$here/keycloak/extensions/civora-sms/build.sh"   # MVN=/path/to/mvn when Maven is not on the PATH
  install -m 644 "$here/keycloak/extensions/civora-sms/target/civora-keycloak-sms-0.1.0.jar" .generated/keycloak-providers/civora-keycloak-sms.jar
fi
chmod 755 .generated/keycloak-providers

# 2. Build the application image and start everything; wait for health checks.
#    PROXY_CA=/path/ca.crt passes a TLS-inspecting proxy's CA as a build secret (never stored in the image).
if [[ "${SKIP_BUILD:-0}" != "1" ]]; then
  docker build ${PROXY_CA:+--secret id=proxy_ca,src=$PROXY_CA} -f "$here/../services/core/Dockerfile" -t civora-core:dev "$here/.."
fi
docker compose up -d --wait --wait-timeout 600
# The catalogue's account on pg-public (Phase 5): made at first start; made here for volumes older than Phase 5.
docker compose exec -T pg-public sh /docker-entrypoint-initdb.d/20-app-role.sh >/dev/null

# Synthetic staff users get a random password from .env (none is committed).
kc() { docker compose exec -T -e KCPW="$KEYCLOAK_ADMIN_PASSWORD" -e UPW="$SYNTHETIC_USER_PASSWORD" keycloak sh -c "$1"; }
kc '/opt/keycloak/bin/kcadm.sh config credentials --config /tmp/kcadm.config --server http://localhost:8080 --realm master --user dev-admin --password "$KCPW"' >/dev/null
for u in handler.synthetic admin.synthetic; do
  kc "/opt/keycloak/bin/kcadm.sh set-password --config /tmp/kcadm.config -r civora-dev --username $u --new-password \"\$UPW\" --temporary"
done

# Realm policy the import cannot express (default roles, PKCE on built-in clients, pairwise salts), then the live
# realms are checked against their profiles (Phase 3 doc 03).
KC_ADMIN_TOKEN=$(curl -fsS localhost:8080/realms/master/protocol/openid-connect/token -d grant_type=password -d client_id=admin-cli \
  -d username=dev-admin --data-urlencode "password=$KEYCLOAK_ADMIN_PASSWORD" | python3 -c 'import json,sys;print(json.load(sys.stdin)["access_token"])')
export KC_ADMIN_TOKEN
for spec in "civora-citizens citizens" "civora-staff staff" "civora-dev dev"; do
  set -- $spec
  extra=(--smtp-host mail --smtp-port 1025)
  [ "$2" = citizens ] && extra+=(--provisioner-secret-out .generated/provisioner.secret --web-client-jwks .generated/web-client.jwks.json --sms-sender simulated)
  [ "$2" = staff ] && extra+=(--provisioner-secret-out .generated/staff-provisioner.secret --sms-sender simulated)
  python3 "$here/keycloak/apply-realm-policy.py" --server http://localhost:8080 --realm "$1" --profile "$2" --export ".generated/$1.live.json" "${extra[@]}" >/dev/null
done
# SIMULATED national eID: a fresh secret for the core's relying-party client (never committed).
eid_client=$(curl -fsS -H "Authorization: Bearer $KC_ADMIN_TOKEN" "localhost:8080/admin/realms/sim-national-eid/clients?clientId=civora-core-eid" \
  | python3 -c 'import json,sys;print(json.load(sys.stdin)[0]["id"])')
curl -fsS -X POST -H "Authorization: Bearer $KC_ADMIN_TOKEN" "localhost:8080/admin/realms/sim-national-eid/clients/$eid_client/client-secret" \
  | python3 -c 'import json,sys;print(json.load(sys.stdin)["value"])' > .generated/eid-sim-client.secret
unset KC_ADMIN_TOKEN
# Staff security keys: no approved models and no vendor roots in the dev cell, so key enrolment fails closed here
# (the realms test supplies a test root and list: infra/tests/keycloak-realms/run.sh).
chmod 644 .generated/provisioner.secret .generated/staff-provisioner.secret .generated/eid-sim-client.secret
docker compose restart core >/dev/null && docker compose up -d --wait --wait-timeout 120 core >/dev/null

# 3. Smoke tests.
fail=0
check() { if ( eval "$2" ) >/dev/null 2>&1; then   # subshell: an "exit" inside a check must not end the script
  echo "  ok   $1"; else echo "  FAIL $1"; fail=1; fi; }
echo "Smoke tests:"
check "core /health database up"            "curl -fsS localhost:3000/health | grep -q '\"database\":\"up\"'"
check "core /v1/meta/locales Arabic RTL"     "curl -fsS -H 'accept-language: ar' localhost:3000/v1/meta/locales | grep -q '\"dir\":\"rtl\"'"
check "base schemas iam/config/audit"        "docker compose exec -T pg-core psql -U civora_core -d civora_core -Atc \"select count(*) from pg_namespace where nspname in ('iam','config','audit')\" | grep -qx 3"
check "keycloak realm civora-dev"            "curl -fsS localhost:8080/realms/civora-dev/.well-known/openid-configuration | grep -q issuer"
check "live realm civora-citizens conforms"  "python3 '$here/scripts/check-realm-security.py' .generated/civora-citizens.live.json --profile citizens --live"
check "live realm civora-staff conforms"     "python3 '$here/scripts/check-realm-security.py' .generated/civora-staff.live.json --profile staff --live"
check "live realm civora-dev conforms"       "python3 '$here/scripts/check-realm-security.py' .generated/civora-dev.live.json --profile dev --live"
registration_ok() {
  local email="dev.smoke.$(date +%s).$RANDOM@example.invalid"
  [ "$(curl -s -o /dev/null -w '%{http_code}' -H 'content-type: application/json' \
      -d "{\"email\":\"$email\",\"locale\":\"ar-TN\"}" localhost:3000/v1/registrations)" = 202 ] || return 1
  for _ in $(seq 1 30); do
    curl -fsS "localhost:8025/api/v1/search?query=to:$email" | grep -q '"total":[1-9]' && return 0
    sleep 1
  done
  return 1
}
check "registration answers 202 and the activation e-mail arrives (dev mail catcher)" "registration_ok"
check "core identity configured (/v1/me without a token: 401, not 503)" "test \"\$(curl -s -o /dev/null -w '%{http_code}' localhost:3000/v1/me)\" = 401"
check "SIMULATED national eID realm answers; the core's eID adapter is configured (simulated mode)" \
  "curl -fsS localhost:8080/realms/sim-national-eid/.well-known/openid-configuration | grep -q '\"issuer\":\"http://localhost:8080/realms/sim-national-eid\"' && test -s .generated/eid-sim-client.secret && ! docker compose logs core 2>&1 | grep -qi 'AdapterModeError'"
check "customer status page answers 202 for a synthetic case reference (code to the mail catcher)" \
  "test \"\$(curl -s -o /dev/null -w '%{http_code}' -H 'content-type: application/json' -d '{\"reference\":\"SYN-RC-1-00001\",\"locale\":\"fr-TN\"}' localhost:3000/v1/status-access)\" = 202"
check "redis auth required"                  "docker compose exec -T redis redis-cli ping | grep -q NOAUTH"
check "object store rejects anonymous"       "! curl -fsS localhost:8333/"
check "openbao unsealed"                     "curl -fsS localhost:8200/v1/sys/health | grep -q '\"sealed\":false'"
check "grafana requires login"               "test \"\$(curl -s -o /dev/null -w '%{http_code}' localhost:3001/api/dashboards/home)\" = 401"
# Services directory (Phase 5, doc phase-5/01) on its own cluster, read through the least-privilege account.
check "catalogue: published services answer 200 (from pg-public)" "curl -fsS localhost:3000/v1/services | grep -q '^\['"
check "catalogue schema on pg-public only, migrated on its own table" \
  "docker compose exec -T pg-public psql -U civora_public -d civora_public -Atc \"select count(*) from pg_namespace where nspname = 'catalogue'\" | grep -qx 1 && docker compose exec -T pg-public psql -U civora_public -d civora_public -Atc 'select count(*) > 0 from schema_migrations_public' | grep -qx t && docker compose exec -T pg-core psql -U civora_core -d civora_core -Atc \"select count(*) from pg_namespace where nspname = 'catalogue'\" | grep -qx 0"
app_public() { docker compose exec -T -e PGPASSWORD="$PG_PUBLIC_APP_PASSWORD" pg-public psql -h 127.0.0.1 -U civora_core_app -d civora_public -v ON_ERROR_STOP=1 -Atc "$1"; }
check "catalogue: the application account reads published content, not drafts" \
  "app_public 'select count(*) from catalogue.published_version' && ! app_public 'select 1 from catalogue.service_version limit 1'"
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
