#!/usr/bin/env bash
# Edge API gateway (ADR-030, Proposed): Apache APISIX 3.19.0 in front of civora-core, tokens from a real Keycloak.
# The routes and plugins are the ones the Ingress Controller will generate from Git (gateway/routes.yaml); here APISIX
# runs data-plane-only from that file, which exercises the same runtime (Nginx + plugins) without etcd.
# Checks (each is an ADR-030 duty):
#   1. a valid access token from Keycloak reaches the API; no token, a forged token and an expired-signature token: 401;
#   2. rate limit per client: the 21st request in the window gets 429;
#   3. request body above 1 MiB: 413, never reaches the application;
#   4. only declared routes are served (unknown path: 404; method not allowed on /health: 404);
#   5. the admin API does not exist on the data plane (port 9180 refuses);
#   6. no version in the Server header; a request id is added for tracing; security headers present;
#   7. credential stuffing: login submissions and token requests limited per client across accounts; Keycloak's admin
#      API not routed; public registration limited per client (Phase 3 doc 03).
# Needs docker, curl, python3. Synthetic data only.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
apisix_image="docker.io/apache/apisix@sha256:9a7e45dc943fbf10ec916d1232bae4cda9302ae28a4696cfb83c2da01d261141" # 3.19.0-debian
keycloak_image="docker.io/keycloak/keycloak@sha256:3f3c5f8e03c614774b4bd9173b88391fefa4153bfc010d8012d59ad825377332" # 26.8.1
curl_image="docker.io/curlimages/curl@sha256:935d9100e9ba842cdb060de42472c7ca90cfe9a7c96e4dacb55e79e560b3ff40" # 8.17.0
core_image="${CORE_IMAGE:-civora-core:dev}"
net=civora-gw-test; work="$(mktemp -d)"; start=$(date +%s)
stamp() { echo "[$(( $(date +%s) - start ))s] $*"; }
remove() { docker rm -f gw-apisix gw-core gw-db gw-keycloak >/dev/null 2>&1 || true; docker network rm "$net" >/dev/null 2>&1 || true; }
cleanup() { [[ "${KEEP:-0}" == 1 ]] || remove; rm -rf "$work"; }
trap cleanup EXIT
fail=0
check() { if out=$( (eval "$2") 2>&1); then echo "  ok   $1"; else echo "  FAIL $1"; echo "$out" | tail -8 | sed 's/^/       /'; fail=1; fi; }
remove; docker network create "$net" >/dev/null
rnd() { head -c 48 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c "$1"; }
db_pw=$(rnd 24); kc_pw=$(rnd 24); client_secret=$(rnd 32)

# Application and its database.
docker run -d --name gw-db --network "$net" -e POSTGRES_PASSWORD="$db_pw" -e POSTGRES_USER=civora_core -e POSTGRES_DB=civora_core postgres:16-alpine >/dev/null
docker run -d --name gw-core --network "$net" -e CIVORA_ENV=dev -e DATABASE_URL="postgres://civora_core:$db_pw@gw-db:5432/civora_core" "$core_image" >/dev/null
# Identity provider (development mode is enough to issue real signed tokens).
docker run -d --name gw-keycloak --network "$net" -e KC_BOOTSTRAP_ADMIN_USERNAME=admin -e KC_BOOTSTRAP_ADMIN_PASSWORD="$kc_pw" \
  -e KC_HOSTNAME=http://gw-keycloak:8080 "$keycloak_image" start-dev >/dev/null
waited=0; for _ in $(seq 1 90); do docker exec gw-keycloak bash -c 'exec 3<>/dev/tcp/127.0.0.1/8080' 2>/dev/null && { waited=1; break; }; sleep 2; done
[ "$waited" = 1 ] || { echo "  FAIL timed out after 180 s waiting for: docker exec gw-keycloak bash -c 'exec 3<>/dev/tcp/127.0.0.1/8080' 2>/dev/null"; exit 1; }  # bounded wait
kcadm() { docker exec gw-keycloak /opt/keycloak/bin/kcadm.sh "$@"; }
for _ in $(seq 1 60); do kcadm config credentials --server http://127.0.0.1:8080 --realm master --user admin --password "$kc_pw" >/dev/null 2>&1 && break; sleep 2; done
kcadm create realms -s realm=civora-test -s enabled=true >/dev/null 2>&1
kcadm create clients -r civora-test -s clientId=b2b-test -s secret="$client_secret" -s serviceAccountsEnabled=true \
  -s publicClient=false -s standardFlowEnabled=false -s directAccessGrantsEnabled=false >/dev/null
stamp "core, database and Keycloak up (realm civora-test, confidential client b2b-test)"

# Gateway: the CIVORA route file, rendered with this run's addresses.
cp "$here/config.yaml" "$work/config.yaml"
sed -e "s#@CORE@#gw-core:3000#g" -e "s#@KEYCLOAK@#gw-keycloak:8080#g" -e "s#@ISSUER@#http://gw-keycloak:8080/realms/civora-test#g" \
    -e "s#@CLIENT_SECRET@#$client_secret#g" "$here/routes.yaml" > "$work/apisix.yaml"
chmod 644 "$work"/*.yaml
docker run -d --name gw-apisix --network "$net" -v "$work/config.yaml:/usr/local/apisix/conf/config.yaml:ro" \
  -v "$work/apisix.yaml:/usr/local/apisix/conf/apisix.yaml:ro" "$apisix_image" >/dev/null
gw() { docker run --rm --network "$net" "$curl_image" -s "$@"; }
for _ in $(seq 1 60); do [ "$(gw -o /dev/null -w '%{http_code}' http://gw-apisix:9080/health)" = 200 ] && break; sleep 2; done
stamp "gateway up"
token() { gw -X POST -d grant_type=client_credentials -d client_id=b2b-test -d "client_secret=$client_secret" \
  http://gw-keycloak:8080/realms/civora-test/protocol/openid-connect/token | python3 -c 'import json,sys; print(json.load(sys.stdin)["access_token"])'; }
tok=$(token)
code() { gw -o /dev/null -w '%{http_code}' "$@"; }

echo "Checks:"
check "1. valid Keycloak access token: API answers 200 through the gateway" "[ \$(code -H 'Authorization: Bearer $tok' http://gw-apisix:9080/v1/meta/locales) = 200 ]"
check "1. no token: 401" "[ \$(code http://gw-apisix:9080/v1/meta/locales) = 401 ]"
forged=$(python3 - "$tok" <<'PY'
import base64, json, sys
h, p, s = sys.argv[1].split('.')
claims = json.loads(base64.urlsafe_b64decode(p + '=' * (-len(p) % 4)))
claims['azp'] = 'someone-else'
print(h + '.' + base64.urlsafe_b64encode(json.dumps(claims).encode()).decode().rstrip('=') + '.' + s)
PY
)
check "1. token with altered claims (signature no longer matches): 401" "[ \$(code -H 'Authorization: Bearer $forged' http://gw-apisix:9080/v1/meta/locales) = 401 ]"
check "1. token signed by another key: 401" "[ \$(code -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.c2lnbmF0dXJl' http://gw-apisix:9080/v1/meta/locales) = 401 ]"
# Rejected requests (401) are not counted: authentication runs before the limit. One request was counted above.
check "2. rate limit per client: 20 requests per minute accepted, the next refused with 429" \
  "n=1; for i in \$(seq 1 25); do c=\$(code -H 'Authorization: Bearer $tok' http://gw-apisix:9080/v1/meta/locales); [ \$c = 429 ] && break; [ \$c = 200 ] || { echo \"request \$i: \$c\"; exit 1; }; n=\$((n+1)); done; echo \"accepted: \$n\"; [ \$n = 20 ] && [ \$c = 429 ]"
check "3. body above 1 MiB: 413 at the gateway (before rate limiting and before the application)" \
  "[ \$(head -c 1100000 /dev/zero | docker run --rm -i --network $net $curl_image -s -o /dev/null -w '%{http_code}' -X POST -H 'Authorization: Bearer $tok' --data-binary @- http://gw-apisix:9080/v1/meta/locales) = 413 ]"
check "4. undeclared path: 404 (no catch-all route to the application)" "[ \$(code http://gw-apisix:9080/internal/anything) = 404 ]"
check "4. undeclared method on /health: 404" "[ \$(code -X DELETE http://gw-apisix:9080/health) = 404 ]"
check "5. no admin API on the data plane (port 9180 refuses)" "! gw --max-time 3 -o /dev/null http://gw-apisix:9180/apisix/admin/routes"
hdrs=$(gw -D - -o /dev/null http://gw-apisix:9080/health | tr -d '\r')
check "6. Server header without version" "echo \"$hdrs\" | grep -i '^server:' | grep -qv '[0-9]'"
check "6. request id added (X-Request-Id)" "echo \"$hdrs\" | grep -qi '^x-request-id: [0-9a-f-]\{20,\}'"
check "6. security headers (nosniff, no referrer, HSTS)" \
  "echo \"$hdrs\" | grep -qi '^x-content-type-options: nosniff' && echo \"$hdrs\" | grep -qi '^referrer-policy: no-referrer' && echo \"$hdrs\" | grep -qi '^strict-transport-security: max-age='"
# 7. Credential stuffing (Phase 3 doc 03, R-P3-6): one client trying a password on many different accounts. Each
#    submission names another account, so Keycloak's per-account lockout never triggers; the gateway limit does.
check "7. login submissions for 20 different accounts from one client are passed on, the 21st gets 429" \
  "n=0; for i in \$(seq 1 25); do c=\$(code -X POST -d \"username=stuffing\$i@example.invalid&password=Leaked-Password-1\" http://gw-apisix:9080/realms/civora-test/login-actions/authenticate); [ \$c = 429 ] && break; n=\$((n+1)); done; echo \"passed on: \$n\"; [ \$n = 20 ] && [ \$c = 429 ]"
check "7. token endpoint limited per client (61st request in a minute: 429)" \
  "n=0; for i in \$(seq 1 65); do c=\$(code -X POST -d grant_type=client_credentials -d client_id=nobody http://gw-apisix:9080/realms/civora-test/protocol/openid-connect/token); [ \$c = 429 ] && break; n=\$((n+1)); done; echo \"passed on: \$n\"; [ \$n = 60 ]"
check "7. Keycloak's admin API and console are not reachable through the gateway (404)" \
  "[ \$(code http://gw-apisix:9080/admin/master/console/) = 404 ] && [ \$(code http://gw-apisix:9080/admin/realms/civora-test/users) = 404 ]"
check "7. Keycloak's public pages are served (discovery 200)" "[ \$(code http://gw-apisix:9080/realms/civora-test/.well-known/openid-configuration) = 200 ]"
reg_body='{"email":"new.citizen@example.invalid"}'
check "7. registration is public but limited per client: 10 requests in 10 minutes, the 11th gets 429" \
  "n=0; for i in \$(seq 1 15); do c=\$(code -X POST -H 'content-type: application/json' --data '$reg_body' http://gw-apisix:9080/v1/registrations); [ \$c = 429 ] && break; [ \$c = 401 ] && { echo 'token demanded'; exit 1; }; n=\$((n+1)); done; echo \"passed on: \$n\"; [ \$n = 10 ]"
status_body='{"reference":"SYN-RC-1-00001"}'
check "7. the customer status page is public but limited per client: 20 requests in 10 minutes, the 21st gets 429" \
  "n=0; for i in \$(seq 1 25); do c=\$(code -X POST -H 'content-type: application/json' --data '$status_body' http://gw-apisix:9080/v1/status-access); [ \$c = 429 ] && break; [ \$c = 401 ] && { echo 'token demanded'; exit 1; }; n=\$((n+1)); done; echo \"passed on: \$n\"; [ \$n = 20 ]"
check "gateway process runs as a non-root user" "[ \"\$(docker exec gw-apisix id -u)\" != 0 ]"
stamp "done (fail=$fail)"
exit $fail
