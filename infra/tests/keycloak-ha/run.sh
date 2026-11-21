#!/usr/bin/env bash
# Keycloak high availability (ADR-005): two Keycloak 26.8.1 nodes in production mode sharing one PostgreSQL.
# Keycloak 26 forms its Infinispan cluster through the database (jdbc-ping) and persists user sessions there.
# Checks:
#   1. both nodes ready;
#   2. they form one cluster (view of 2);
#   3. a user session created on node 1 is refreshed on node 2 after node 1 is killed;
#   4. node 1 rejoins.
# The Kubernetes form (Keycloak Operator, 3 instances) is in infra/k8s/keycloak; this test proves the clustering
# behaviour the operator relies on. All nodes must share one fixed hostname: otherwise the token issuer follows the
# address of the node that issued it and other nodes reject the token (seen while writing this test). Synthetic realm, user and passwords generated per run. Needs docker, curl, python3.
set -euo pipefail
image="${KEYCLOAK_IMAGE:-docker.io/keycloak/keycloak@sha256:3f3c5f8e03c614774b4bd9173b88391fefa4153bfc010d8012d59ad825377332}" # 26.8.1
pg_image="${PG_IMAGE:-postgres:16-alpine}"
net=civora-kc-test
declare -A ip=([kc-db]=172.31.242.10 [kc1]=172.31.242.11 [kc2]=172.31.242.12)
start=$(date +%s)
stamp() { echo "[$(( $(date +%s) - start ))s] $*"; }
cleanup() { [[ "${KEEP:-0}" == 1 ]] || { for n in "${!ip[@]}"; do docker rm -f "$n" >/dev/null 2>&1 || true; done; docker network rm "$net" >/dev/null 2>&1 || true; }; }
trap cleanup EXIT
fail=0
check() { if out=$(eval "$2" 2>&1); then echo "  ok   $1"; else echo "  FAIL $1"; echo "$out" | tail -10 | sed 's/^/       /'; fail=1; fi; }
rnd() { head -c 48 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c "$1"; }
db_pw=$(rnd 24); admin_pw=$(rnd 24); user_pw=$(rnd 24); client_secret=$(rnd 32)

cleanup
docker network create --subnet 172.31.242.0/24 "$net" >/dev/null
docker run -d --name kc-db --network "$net" --ip "${ip[kc-db]}" -e POSTGRES_DB=keycloak -e POSTGRES_USER=keycloak \
  -e POSTGRES_PASSWORD="$db_pw" "$pg_image" >/dev/null
for _ in $(seq 1 120); do docker exec kc-db pg_isready -U keycloak -d keycloak >/dev/null 2>&1 && break; sleep 1; done; docker exec kc-db pg_isready -U keycloak -d keycloak >/dev/null 2>&1  # bounded wait: fails instead of hanging
kc_up() {
  docker run -d --name "$1" --hostname "$1" --network "$net" --ip "${ip[$1]}" \
    -e KC_DB=postgres -e KC_DB_URL="jdbc:postgresql://kc-db:5432/keycloak" -e KC_DB_USERNAME=keycloak -e KC_DB_PASSWORD="$db_pw" \
    -e KC_HEALTH_ENABLED=true -e KC_HTTP_ENABLED=true -e KC_HOSTNAME=http://auth.ha-test.invalid:8080 \
    -e KC_BOOTSTRAP_ADMIN_USERNAME=admin -e KC_BOOTSTRAP_ADMIN_PASSWORD="$admin_pw" \
    "$image" start >/dev/null
}
ready() { curl -sf --noproxy '*' --max-time 3 "http://${ip[$1]}:9000/health/ready" | grep -q '"status": *"UP"'; }
wait_ready() { for _ in $(seq 1 120); do ready "$1" && return 0; sleep 2; done; docker logs "$1" 2>&1 | tail -20; return 1; }
kc_up kc1; wait_ready kc1   # first node creates the schema alone
kc_up kc2; wait_ready kc2
stamp "two Keycloak nodes ready"

echo "Checks:"
view_of() { docker logs "$1" 2>&1 | grep 'ISPN000094' | tail -1 | grep -oE '\(([0-9]+)\)' | tail -1 | tr -d '()'; }
check "nodes form one cluster through the database (Infinispan view of 2 on both nodes)" \
  "for i in \$(seq 1 30); do [ \"\$(view_of kc1)\" = 2 ] && [ \"\$(view_of kc2)\" = 2 ] && exit 0; sleep 2; done; exit 1"

# Synthetic realm, confidential client (direct grant) and user, created through node 1's admin API.
base1="http://${ip[kc1]}:8080"; base2="http://${ip[kc2]}:8080"
admin_token=$(curl -sf --noproxy '*' "$base1/realms/master/protocol/openid-connect/token" \
  -d grant_type=password -d client_id=admin-cli -d username=admin --data-urlencode "password=$admin_pw" | python3 -c 'import json,sys;print(json.load(sys.stdin)["access_token"])')
api() { curl -sf --noproxy '*' -H "Authorization: Bearer $admin_token" -H 'Content-Type: application/json' "$@"; }
api -X POST "$base1/admin/realms" -d '{"realm":"civora-ha-test","enabled":true}'
api -X POST "$base1/admin/realms/civora-ha-test/clients" -d "{\"clientId\":\"ha-test\",\"secret\":\"$client_secret\",\"publicClient\":false,\"directAccessGrantsEnabled\":true,\"standardFlowEnabled\":false}"
api -X POST "$base1/admin/realms/civora-ha-test/users" -d "{\"username\":\"synthetic.user\",\"enabled\":true,\"email\":\"synthetic.user@example.invalid\",\"emailVerified\":true,\"firstName\":\"Synthetic\",\"lastName\":\"User\",\"credentials\":[{\"type\":\"password\",\"value\":\"$user_pw\",\"temporary\":false}]}"
tokens=$(curl -sf --noproxy '*' "$base1/realms/civora-ha-test/protocol/openid-connect/token" -d grant_type=password -d client_id=ha-test \
  -d "client_secret=$client_secret" -d username=synthetic.user --data-urlencode "password=$user_pw")
refresh=$(python3 -c 'import json,sys;print(json.loads(sys.argv[1])["refresh_token"])' "$tokens")
check "user session created on node 1" "test -n '$refresh'"

docker kill kc1 >/dev/null   # abrupt loss of the node that issued the session
t_kill=$(date +%s)
check "after node 1 is killed, node 2 refreshes the session issued by node 1" \
  "curl -sf --noproxy '*' '$base2/realms/civora-ha-test/protocol/openid-connect/token' -d grant_type=refresh_token -d client_id=ha-test -d 'client_secret=$client_secret' -d 'refresh_token=$refresh' | grep -q access_token"
check "node 2 still serves new logins alone" \
  "curl -sf --noproxy '*' '$base2/realms/civora-ha-test/protocol/openid-connect/token' -d grant_type=password -d client_id=ha-test -d 'client_secret=$client_secret' -d username=synthetic.user --data-urlencode 'password=$user_pw' | grep -q access_token"
docker start kc1 >/dev/null
check "node 1 restarts and rejoins (view of 2 again)" \
  "wait_ready kc1 >/dev/null && for i in \$(seq 1 30); do docker logs kc1 2>&1 | grep 'ISPN000094' | tail -1 | grep -q '(2)' && exit 0; sleep 2; done; exit 1"
stamp "done (fail=$fail; session survived node loss: refresh served by node 2 $(( $(date +%s) - t_kill ))s window incl. rejoin)"
exit $fail
