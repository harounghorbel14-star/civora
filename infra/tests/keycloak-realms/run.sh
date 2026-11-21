#!/usr/bin/env bash
# Phase 3 identity (P3-A1, A3, F1, SEC3, SEC5; doc phase-3/03): the citizens and staff realms of a cell, tested for real.
#   1. realm files conform (profile rules, negative controls);
#   2. Keycloak 26.8.1 imports them; the post-import policy runs (e-mail relay, approved security keys, provisioner
#      secret); the LIVE realms conform, approved-key list required;
#   3. journeys in every locale of the cell (Arabic, French, English), in Chromium with WebAuthn virtual authenticators
#      and a local mail catcher: citizen registration through the core, activation link (TOTP before password),
#      password + TOTP login, passkey; officer invitation (security key before password), password + key login;
#   4. security checks: no account enumeration (registration and login answers, timing, locked accounts); accounts
#      without a second factor refused (no enrolment at login); single-use activation links; security keys outside the
#      approved list refused; wrong TOTP, password grant, forged WebAuthn assertion refused; pairwise subjects;
#   5. civora-core (local build, PostgreSQL as the least-privilege role) accepts the Keycloak tokens and maps locales.
# Needs docker, python3, node 22 with the core built (pnpm build) and Playwright with Chromium (NODE_PATH may point
# to it). Synthetic users only, random passwords per run.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
repo="$(cd "$here/../../.." && pwd)"
keycloak_image="docker.io/keycloak/keycloak@sha256:3f3c5f8e03c614774b4bd9173b88391fefa4153bfc010d8012d59ad825377332" # 26.8.1
mail_image="docker.io/axllent/mailpit@sha256:9b3a463be15354c0f0eba91697d80e3e0d8a5623ef0e627cacc836bc17fd5231" # v1.33.0 (2026-10-31)
net=civora-realms-test
work="$(mktemp -d)"; start=$(date +%s); core_pid=""
stamp() { echo "[$(( $(date +%s) - start ))s] $*"; }
remove() { docker rm -f kr-keycloak kr-db kr-mail >/dev/null 2>&1 || true; docker network rm "$net" >/dev/null 2>&1 || true; }
cleanup() { [ -n "$core_pid" ] && kill "$core_pid" 2>/dev/null || true; [[ "${KEEP:-0}" == 1 ]] || remove; rm -rf "$work"; }
trap cleanup EXIT
rnd() { head -c 48 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c "$1"; }
free_port() { python3 -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1",0)); print(s.getsockname()[1])'; }
fail=0
checker="$repo/infra/scripts/check-realm-security.py"

echo "Realm files (Git):"
for spec in "infra/keycloak/realms/civora-citizens.json citizens" "infra/keycloak/realms/civora-staff.json staff" "infra/compose/keycloak/civora-dev-realm.json dev"; do
  set -- $spec
  if out=$(python3 "$checker" "$repo/$1" --profile "$2" --self-test); then
    echo "  ok   $1 ($2 profile; $(grep -c 'control rejected' <<<"$out") negative controls rejected)"
  else echo "$out"; fail=1; fi
done

remove
docker network create "$net" >/dev/null
db_pw=$(rnd 24); app_pw=$(rnd 24); kc_pw=$(rnd 24)
docker run -d --name kr-db -p 127.0.0.1::5432 -e POSTGRES_PASSWORD="$db_pw" -e POSTGRES_USER=civora_core -e POSTGRES_DB=civora_core postgres:16-alpine >/dev/null
docker run -d --name kr-mail --network "$net" -p 127.0.0.1::8025 "$mail_image" >/dev/null
# TEST ONLY trust anchor: the virtual authenticator's attestation certificate stands in for a vendor root.
mkdir -p "$work/truststores" && chmod 755 "$work/truststores"
approved="$repo/infra/keycloak/approved-keys/test-virtual-authenticator.json"
node "$here/attestation-root.cjs" "$work/truststores/test-virtual-authenticator.pem" "$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))[0]["aaguid"])' "$approved")"
chmod 644 "$work"/truststores/*
kc_port=$(free_port)
mkdir -p "$work/import" && cp "$repo"/infra/keycloak/realms/civora-*.json "$work/import/" && chmod 755 "$work/import" && chmod 644 "$work"/import/*
docker run -d --name kr-keycloak --network "$net" -p "127.0.0.1:$kc_port:8080" -e KC_BOOTSTRAP_ADMIN_USERNAME=admin -e KC_BOOTSTRAP_ADMIN_PASSWORD="$kc_pw" \
  -e KC_HOSTNAME="http://localhost:$kc_port" -v "$work/import:/opt/keycloak/data/import:ro" -v "$work/truststores:/opt/keycloak/conf/truststores:ro" \
  "$keycloak_image" start-dev --import-realm >/dev/null
kc="http://localhost:$kc_port"
mail="http://127.0.0.1:$(docker port kr-mail 8025/tcp | head -1 | sed 's/.*://')"

db_port=$(docker port kr-db 5432/tcp | head -1 | sed 's/.*://')
waited=0; for _ in $(seq 1 120); do docker exec kr-db pg_isready -U civora_core >/dev/null 2>&1 && { waited=1; break; }; sleep 1; done
[ "$waited" = 1 ] || { echo "  FAIL timed out after 120 s waiting for: docker exec kr-db pg_isready -U civora_core"; exit 1; }  # bounded wait
sleep 2
admin_url="postgres://civora_core:$db_pw@127.0.0.1:$db_port/civora_core"
(cd "$repo/services/core" && DATABASE_URL="$admin_url" node_modules/.bin/node-pg-migrate up --migrations-dir migrations \
  --migration-file-language sql --migrations-table schema_migrations --check-order >/dev/null)
docker exec kr-db psql -qU civora_core -d civora_core -c "alter role civora_core_app login password '$app_pw'" >/dev/null
stamp "PostgreSQL migrated; application role civora_core_app (NOBYPASSRLS) ready"

for _ in $(seq 1 90); do curl -sf --noproxy '*' "$kc/realms/civora-staff/.well-known/openid-configuration" >/dev/null && break; sleep 2; done
kc_log=$(docker logs kr-keycloak 2>&1) # captured first: grep -q on a pipe would end docker logs early (pipefail)
grep -q "Realm 'civora-citizens' imported" <<<"$kc_log" && grep -q "Realm 'civora-staff' imported" <<<"$kc_log" \
  || { echo "  FAIL realm import"; tail -20 <<<"$kc_log"; exit 1; }
stamp "Keycloak 26.8.1 up; civora-citizens and civora-staff imported"

KC_ADMIN_TOKEN=$(curl -sf --noproxy '*' "$kc/realms/master/protocol/openid-connect/token" -d grant_type=password -d client_id=admin-cli \
  -d username=admin --data-urlencode "password=$kc_pw" | python3 -c 'import json,sys;print(json.load(sys.stdin)["access_token"])')
export KC_ADMIN_TOKEN
echo "Live realms (after import and policy):"
for p in citizens staff; do
  curl -sf --noproxy '*' -X POST -H "Authorization: Bearer $KC_ADMIN_TOKEN" "$kc/admin/realms/civora-$p/partial-export?exportClients=true&exportGroupsAndRoles=true" > "$work/$p.imported.json"
  before=$(python3 "$checker" "$work/$p.imported.json" --profile "$p" --live | grep -c FAIL || true)
  echo "  info civora-$p as imported, before policy: $before rule(s) not met (Keycloak's built-in defaults)"
  extra=(--smtp-host kr-mail --smtp-port 1025)
  [ "$p" = citizens ] && extra+=(--provisioner-secret-out "$work/provisioner.secret")
  [ "$p" = staff ] && extra+=(--provisioner-secret-out "$work/staff-provisioner.secret")
  [ "$p" = staff ] && extra+=(--approved-keys "$approved")
  python3 "$repo/infra/keycloak/apply-realm-policy.py" --server "$kc" --realm "civora-$p" --profile "$p" --export "$work/$p.live.json" "${extra[@]}" | sed 's/^/  /'
  if out=$(python3 "$checker" "$work/$p.live.json" --profile "$p" --live --require-approved-keys --self-test); then
    echo "  ok   live civora-$p conforms ($(grep -c 'control rejected' <<<"$out") negative controls rejected)"
  else echo "$out"; fail=1; fi
done

core_port=$(free_port)
(cd "$repo/services/core" && CIVORA_ENV=test PORT="$core_port" DATABASE_URL="postgres://civora_core_app:$app_pw@127.0.0.1:$db_port/civora_core" \
  OIDC_ISSUER_CITIZENS="$kc/realms/civora-citizens" OIDC_ISSUER_STAFF="$kc/realms/civora-staff" \
  KEYCLOAK_PROVISIONER_SECRET_FILE="$work/provisioner.secret" KEYCLOAK_STAFF_PROVISIONER_SECRET_FILE="$work/staff-provisioner.secret" \
  STEP_UP_MAX_AGE_SECONDS=30 exec node dist/src/main.js) >"$work/core.log" 2>&1 &
core_pid=$!
for _ in $(seq 1 60); do curl -sf --noproxy '*' "http://127.0.0.1:$core_port/health/ready" >/dev/null && break; sleep 1; done
curl -sf --noproxy '*' "http://127.0.0.1:$core_port/health/ready" >/dev/null || { echo "  FAIL core did not start"; tail -20 "$work/core.log"; exit 1; }
stamp "civora-core up (database role civora_core_app; issuers: the two realms; registration through the provisioner client)"
grep -q . "$work/provisioner.secret" && grep -q . "$work/staff-provisioner.secret" || { echo "  FAIL provisioner secrets not written"; exit 1; }

echo "Journeys in ${LOCALES:-ar,fr,en} and security checks, in Chromium with virtual authenticators, and the core:"
mkdir -p "${ARTIFACT_DIR:-$work/artifacts}"
KC_URL="$kc" CORE_URL="http://127.0.0.1:$core_port" MAIL_URL="$mail" KC_ADMIN_PASSWORD="$kc_pw" ARTIFACT_DIR="${ARTIFACT_DIR:-$work/artifacts}" \
  NO_PROXY="localhost,127.0.0.1,${NO_PROXY:-}" no_proxy="localhost,127.0.0.1,${no_proxy:-}" node "$here/login.cjs" || fail=1

echo "Sessions, authenticators and step-up through the core (week 3, step-up limit 30 s in this test):"
KC_URL="$kc" CORE_URL="http://127.0.0.1:$core_port" MAIL_URL="$mail" KC_ADMIN_PASSWORD="$kc_pw" ARTIFACT_DIR="${ARTIFACT_DIR:-$work/artifacts}" \
  STEP_UP_MAX_AGE_SECONDS=30 NO_PROXY="localhost,127.0.0.1,${NO_PROXY:-}" no_proxy="localhost,127.0.0.1,${no_proxy:-}" node "$here/account.cjs" || fail=1
mirrored=$(docker exec kr-db psql -U civora_core -d civora_core -Atc "select count(*) from iam.authenticator")
if [ "${mirrored:-0}" -gt 0 ]; then echo "  ok   authenticator mirror (iam.authenticator) holds $mirrored row(s), metadata only"; else echo "  FAIL authenticator mirror is empty"; fail=1; fi
if grep -qiE '"level":"(error|fatal)"' "$work/core.log"; then echo "  info core logged errors:"; grep -iE '"level":"(error|fatal)"' "$work/core.log" | tail -5 | sed 's/^/       /'; fi
stamp "$([ $fail = 0 ] && echo 'ALL CHECKS PASSED' || echo 'SOME CHECKS FAILED')"
exit $fail
