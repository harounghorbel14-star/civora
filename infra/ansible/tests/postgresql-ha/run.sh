#!/usr/bin/env bash
# Integration test for roles/postgresql_ha (ADR-003, ADR-029) on systemd containers.
#   DB_NODES=2 (default): 2 database nodes + 1 backup node (etcd quorum: all three)
#   DB_NODES=3          : 3 database nodes + 1 backup node (etcd quorum: the three database nodes)
#   APP_PATH=1 (default): also test the application path: pg-router (HAProxy, rendered from infra/helm/pg-router)
#                         → civora-core migrations and /health over verify-full TLS, and write availability during
#                         a leader crash (needs the civora-core:dev image and helm).
#   SETUP_ONLY=1 KEEP=1 EXPORT_DIR=<dir>: build and check the cluster, write ca.crt and an env file (account passwords,
#                         DB_SERVERS="name=ip ...") to <dir>, keep the containers and stop (used by staging-rehearsal.sh).
# Checks: cluster formation, synchronous TLS replication, least-privilege accounts, encrypted backups, WAL archiving,
# point-in-time recovery, planned and unplanned failover, rejoin (pg_rewind), restore drill, idempotence.
#
# Needs: docker (privileged containers with systemd), Ansible with the community.docker connection plugin
#        (pip install ansible==11.13.0; set ANSIBLE_PLAYBOOK if not on PATH), openssl, curl, python3.
# Synthetic only: every secret and certificate is generated for this run and deleted afterwards.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
repo="$(cd "$here/../../../.." && pwd)"
ansible_dir="$repo/infra/ansible"
playbook_bin="${ANSIBLE_PLAYBOOK:-ansible-playbook}"
db_nodes="${DB_NODES:-2}"
app_path="${APP_PATH:-1}"
image=civora-pgha-testnode:noble
haproxy_image="docker.io/library/haproxy@sha256:5d97434a423c2533cfeb42874d45cf6d69a840b60334582dfbfd5008e94c80be"
net=civora-pgha-test
subnet=172.31.240.0/24
router_ip=172.31.240.30
declare -A ip=([tn-t-db1]=172.31.240.11 [tn-t-db2]=172.31.240.12 [tn-t-bk1]=172.31.240.21)
[[ "$db_nodes" == 3 ]] && ip[tn-t-db3]=172.31.240.13
dbs=$(printf '%s\n' "${!ip[@]}" | grep db | sort | tr '\n' ' ')
work="$(mktemp -d)"
start=$(date +%s)
stamp() { echo "[$(( $(date +%s) - start ))s] $*"; }
extra=(pg-router pgt-core)
cleanup() {
  if [[ "${KEEP:-0}" != "1" ]]; then
    for n in "${!ip[@]}" "${extra[@]}"; do docker rm -f "$n" >/dev/null 2>&1 || true; done
    docker network rm "$net" >/dev/null 2>&1 || true
  fi
  rm -rf "$work"
}
trap cleanup EXIT

# 1. Image and containers
if [[ "${SKIP_BUILD:-0}" != "1" ]]; then
  docker build -q ${PROXY_CA:+--secret id=proxy_ca,src=$PROXY_CA} ${HTTPS_PROXY:+--network host --build-arg HTTPS_PROXY=$HTTPS_PROXY} \
    -t "$image" "$here" >/dev/null
fi
for n in "${!ip[@]}" "${extra[@]}"; do docker rm -f "$n" >/dev/null 2>&1 || true; done
docker network rm "$net" >/dev/null 2>&1 || true
docker network create --subnet "$subnet" "$net" >/dev/null
for n in "${!ip[@]}"; do
  docker run -d --name "$n" --hostname "$n" --network "$net" --ip "${ip[$n]}" \
    --privileged --cgroupns=host -v /sys/fs/cgroup:/sys/fs/cgroup:rw "$image" >/dev/null
done
for n in "${!ip[@]}"; do
  until docker exec "$n" systemctl is-system-running 2>/dev/null | grep -qE 'running|degraded'; do sleep 1; done
done
stamp "${#ip[@]} nodes up ($db_nodes database + 1 backup)"

# 2. Test CA, node certificates and secrets — generated for this run, never committed.
#    Database node certificates also carry the router's service names, so clients can use sslmode=verify-full
#    through pg-router (the server certificate presented is the current primary's).
inv="$work/inventory"; mkdir -p "$inv/host_vars" "$inv/group_vars"
openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:P-256 -nodes -days 2 -subj "/CN=civora-test-ca" \
  -keyout "$work/ca.key" -out "$work/ca.crt" 2>/dev/null
rnd() { head -c 48 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c "$1"; }
indent() { sed 's/^/  /'; }
migrator_pw=$(rnd 32); app_pw=$(rnd 32)
{
  echo "civora_cell_id: test"
  echo "ansible_connection: community.docker.docker"
  echo "postgresql_ha_app_cidrs: ['$subnet']"
  echo "postgresql_ha_superuser_password: '$(rnd 32)'"
  echo "postgresql_ha_replication_password: '$(rnd 32)'"
  echo "postgresql_ha_rewind_password: '$(rnd 32)'"
  echo "postgresql_ha_restapi_password: '$(rnd 32)'"
  echo "postgresql_ha_repo_cipher_pass: '$(rnd 48)'"
  echo "postgresql_ha_databases: [{ name: civora_core, owner: civora_core_migrator, app_user: civora_core_app }]"
  echo "postgresql_ha_role_passwords: { civora_core_migrator: '$migrator_pw', civora_core_app: '$app_pw' }"
  echo "postgresql_ha_tls_ca: |"; indent < "$work/ca.crt"
} > "$inv/group_vars/all.yml"
for n in "${!ip[@]}"; do
  sans="DNS:$n,IP:${ip[$n]}"
  [[ "$n" == *db* ]] && sans="$sans,DNS:pg-router,DNS:pg-router.civora-tn.svc,DNS:pg-router.civora-tn.svc.cluster.local"
  openssl req -newkey ec -pkeyopt ec_paramgen_curve:P-256 -nodes -subj "/CN=$n" -keyout "$work/$n.key" -out "$work/$n.csr" 2>/dev/null
  printf 'subjectAltName=%s\nextendedKeyUsage=serverAuth,clientAuth\nkeyUsage=digitalSignature,keyEncipherment\n' "$sans" > "$work/$n.ext"
  openssl x509 -req -in "$work/$n.csr" -CA "$work/ca.crt" -CAkey "$work/ca.key" -CAcreateserial -days 2 \
    -extfile "$work/$n.ext" -out "$work/$n.crt" 2>/dev/null
  {
    echo "ansible_host: ${ip[$n]}"
    echo "ansible_docker_host: $n"
    echo "postgresql_ha_tls_cert: |"; indent < "$work/$n.crt"
    echo "postgresql_ha_tls_key: |"; indent < "$work/$n.key"
  } > "$inv/host_vars/$n.yml"
done
{ echo "db_nodes:"; echo "  hosts:"; for d in $dbs; do echo "    $d:"; done; printf 'backup:\n  hosts:\n    tn-t-bk1:\n'; } > "$inv/hosts.yml"
chmod 600 "$inv/group_vars/all.yml"
stamp "test CA, certificates and secrets generated"

# 3. Apply the role
export ANSIBLE_ROLES_PATH="$ansible_dir/roles" ANSIBLE_HOST_KEY_CHECKING=False ANSIBLE_STDOUT_CALLBACK=default ANSIBLE_NOCOLOR=1
"$playbook_bin" -i "$inv" "$here/playbook.yml" > "$work/run1.log" 2>&1 || { tail -60 "$work/run1.log"; exit 1; }
stamp "role applied (first run)"

fail=0
check() { if out=$(eval "$2" 2>&1); then echo "  ok   $1"; else echo "  FAIL $1"; echo "$out" | tail -15 | sed 's/^/       /'; fail=1; fi; }
psql_on() { docker exec -u postgres "$1" psql -h /var/run/postgresql -d "${3:-postgres}" -Atc "$2"; }
# Cluster view from Patroni's REST API (/cluster reads the DCS, so a frozen member cannot block it).
cluster_on() { curl -s --noproxy '*' --max-time 3 --cacert "$work/ca.crt" "https://${ip[$1]}:8008/cluster" || true; }
q() { python3 -c "import json,sys
try: m=json.load(sys.stdin)['members']
except Exception: m=[]
$1"; }
leader_on() { cluster_on "$1" | q 'print(next((x["name"] for x in m if x["role"]=="leader"),""))'; }
sync_on() { cluster_on "$1" | q 'print(next((x["name"] for x in m if x["role"]=="sync_standby" and x["state"]=="streaming"),""))'; }
state_of() { cluster_on "$1" | q "print(next((x['state'] for x in m if x['name']=='$2'),''))"; }
any_view() { for d in $dbs; do v=$(cluster_on "$d"); [ -n "$v" ] && { echo "$v"; return; }; done; }
current_leader() { any_view | q 'print(next((x["name"] for x in m if x["role"]=="leader"),""))'; }
wait_leader_not() { for _ in $(seq 1 90); do l=$(current_leader); [ -n "$l" ] && [ "$l" != "$1" ] && { echo "$l"; return 0; }; sleep 1; done; return 1; }
# The application must survive database failovers (no process restart) and report the database up again.
app_alive() {
  [[ "$app_path" == 1 ]] || return 0
  [ "$(docker inspect -f '{{.State.Running}} {{.RestartCount}}' pgt-core 2>/dev/null)" = "true 0" ] || { docker logs pgt-core 2>&1 | grep -m3 -E "Error|error" ; return 1; }
  for _ in $(seq 1 30); do docker exec pgt-core wget -qO- http://127.0.0.1:3000/health 2>/dev/null | grep -q '"database":"up"' && return 0; sleep 1; done
  return 1
}
wait_steady() { for _ in $(seq 1 60); do l=$(current_leader); [ -n "$l" ] && [ -n "$(sync_on "$l")" ] && return 0; sleep 2; done; return 1; }

echo "Checks:"
expect_roles=$([[ "$db_nodes" == 3 ]] && echo '["leader","replica","sync_standby"]' || echo '["leader","sync_standby"]')
check "one leader, one synchronous standby, every standby streaming over TLS" \
  "wait_steady && any_view | q 'r=sorted(x[\"role\"] for x in m); assert r==$expect_roles, r; assert all(x[\"state\"]==\"streaming\" for x in m if x[\"role\"]!=\"leader\"), m'"
L=$(current_leader)
check "replication connections use TLS" "test \"\$(psql_on $L \"select count(*) from pg_stat_ssl s join pg_stat_replication r using (pid) where s.ssl\")\" = $((db_nodes - 1))"
check "write on leader ($L) visible on every standby" \
  "psql_on $L \"create table drill_marker(id int primary key, note text); insert into drill_marker select g, 'synthetic' from generate_series(1,1000) g\" && sleep 2 && for d in $dbs; do test \"\$(psql_on \$d 'select count(*) from drill_marker')\" = 1000 || exit 1; done"
check "data checksums enabled" "test \"\$(psql_on $L 'show data_checksums')\" = on"
check "least privilege: app account cannot bypass RLS, owns nothing, is no superuser; migrator owns the database" \
  "test \"\$(psql_on $L \"select rolsuper||','||rolbypassrls||','||rolcreatedb||','||rolcreaterole from pg_roles where rolname='civora_core_app'\")\" = 'false,false,false,false' && test \"\$(psql_on $L \"select pg_get_userbyid(datdba) from pg_database where datname='civora_core'\")\" = civora_core_migrator"
check "first full backup in an AES-256 encrypted repository" \
  "docker exec -u pgbackrest tn-t-bk1 pgbackrest --stanza=civora info --output=json | python3 -c 'import json,sys;d=json.load(sys.stdin)[0];assert d[\"status\"][\"code\"]==0;assert any(b[\"type\"]==\"full\" for b in d[\"backup\"]);assert d[\"cipher\"]==\"aes-256-cbc\"'"
# Without the cipher passphrase the repository must be unreadable; the same command with it must succeed (control).
info_status() {  # $1 = keep | strip (the repo1-cipher-pass line)
  local filter='^$'; [[ "$1" == strip ]] && filter='^repo1-cipher-pass'
  docker exec -u pgbackrest tn-t-bk1 sh -c "grep -v '$filter' /etc/pgbackrest.conf > /tmp/info-test.conf; pgbackrest --config=/tmp/info-test.conf --stanza=civora info --output=json; rm -f /tmp/info-test.conf" 2>/dev/null \
    | python3 -c 'import json,sys
try: print(json.load(sys.stdin)[0]["status"]["code"])
except Exception: print("unreadable")'
}
check "repository unreadable without the cipher passphrase (control with it: readable)" \
  "test \"\$(info_status keep)\" = 0 && test \"\$(info_status strip)\" != 0"
check "WAL archiving end to end (pgbackrest check)" "docker exec -u pgbackrest tn-t-bk1 pgbackrest --stanza=civora check"
check "backup timers scheduled" "docker exec tn-t-bk1 systemctl is-enabled pgbackrest-backup-full.timer pgbackrest-backup-diff.timer"
metrics_of() { curl -sf --noproxy '*' --max-time 5 --cacert "$work/ca.crt" "https://${ip[$1]}:9100/metrics"; }
check "node exporter over TLS (certificate verified): backup metrics on the repository node, archiving metrics on the primary" \
  "for i in \$(seq 1 40); do b=\$(metrics_of tn-t-bk1 || true); p=\$(metrics_of $L || true); grep -q 'civora_pgbackrest_last_backup_timestamp_seconds{repo=\"1\",type=\"full\"} [1-9]' <<<\"\$b\" && grep -q '^civora_postgres_is_primary 1' <<<\"\$p\" && grep -q '^civora_postgres_last_archived_timestamp_seconds [1-9]' <<<\"\$p\" && exit 0; sleep 3; done; exit 1"   # no pipe into grep -q: with pipefail, curl's SIGPIPE would fail a match
check "node exporter refuses plain HTTP" "! curl -sf --noproxy '*' --max-time 3 http://${ip[tn-t-bk1]}:9100/metrics"
check "pg_hba rejects everything outside the allowed CIDRs" "docker exec $L grep -q 'host all all 0.0.0.0/0 reject' /var/lib/postgresql/16/patroni/pg_hba.conf"

if [[ "${SETUP_ONLY:-0}" == 1 ]]; then
  [[ "${KEEP:-0}" == 1 && -n "${EXPORT_DIR:-}" ]] || { echo "SETUP_ONLY needs KEEP=1 and EXPORT_DIR"; exit 2; }
  mkdir -p "$EXPORT_DIR"; cp "$work/ca.crt" "$EXPORT_DIR/ca.crt"
  servers=""; for d in $dbs; do servers="$servers $d=${ip[$d]}"; done
  printf "MIGRATOR_PW='%s'\nAPP_PW='%s'\nDB_SERVERS='%s'\n" "$migrator_pw" "$app_pw" "${servers# }" > "$EXPORT_DIR/env"
  chmod 600 "$EXPORT_DIR/env"
  stamp "setup only: cluster kept, CA and account passwords exported (fail=$fail)"
  exit $fail
fi

# Point-in-time recovery: rows A before T, rows B after T; restoring to T must contain A and not B.
psql_on "$L" "insert into drill_marker select g, 'pitr-a' from generate_series(2001,2100) g; select pg_switch_wal()" >/dev/null
sleep 2; T=$(psql_on "$L" "select now()"); sleep 2
psql_on "$L" "insert into drill_marker select g, 'pitr-b' from generate_series(2101,2200) g; select pg_switch_wal()" >/dev/null
docker exec -u pgbackrest tn-t-bk1 pgbackrest --stanza=civora check >/dev/null
check "point-in-time restore to T: rows before T present, rows after T absent" \
  "docker exec -u postgres -e CIVORA_DRILL_TARGET_TIME=\"$T\" tn-t-bk1 /usr/local/sbin/civora-restore-drill \"select count(*) filter (where note='pitr-a') || '/' || count(*) filter (where note='pitr-b') from drill_marker\" | tee $work/pitr.json | grep -q '\"query_result\":\"100/0\"'"

# Application path: pg-router (config rendered from the Helm chart) → civora-core over verify-full TLS.
gap_s=n/a
if [[ "$app_path" == 1 ]]; then
  set_args=(); i=0
  for d in $dbs; do set_args+=(--set "servers[$i].name=$d" --set "servers[$i].address=${ip[$d]}"); i=$((i+1)); done
  helm template pg-router "$repo/infra/helm/pg-router" --kube-version 1.33.4 -n civora-tn "${set_args[@]}" -s templates/configmap.yaml \
    | awk '/haproxy.cfg: \|/{f=1;next} f{sub(/^    /,""); print}' > "$work/haproxy.cfg"
  chmod 644 "$work/ca.crt" "$work/haproxy.cfg"
  docker run -d --name pg-router --network "$net" --ip "$router_ip" -u 10099:10099 --read-only --tmpfs /tmp \
    -v "$work/haproxy.cfg:/usr/local/etc/haproxy/haproxy.cfg:ro" -v "$work/ca.crt:/etc/pg-router/ca.crt:ro" \
    "$haproxy_image" -W -db -f /usr/local/etc/haproxy/haproxy.cfg >/dev/null
  check "pg-router ready (a primary is known)" "for i in \$(seq 1 30); do curl -sf --noproxy '*' http://$router_ip:8404/healthz >/dev/null && exit 0; sleep 1; done; exit 1"
  url() { echo "postgres://$1:$2@pg-router:5432/civora_core?sslmode=verify-full&sslrootcert=/etc/civora-db-ca/ca.crt&connect_timeout=3"; }
  check "migrations through the router as the owner (verify-full TLS)" \
    "docker run --rm --network $net -v $work/ca.crt:/etc/civora-db-ca/ca.crt:ro -e DATABASE_URL='$(url civora_core_migrator "$migrator_pw")' civora-core:dev node node_modules/node-pg-migrate/bin/node-pg-migrate.js up --migrations-dir migrations --migration-file-language sql --migrations-table schema_migrations --check-order"
  docker run -d --name pgt-core --network "$net" --read-only --tmpfs /tmp -v "$work/ca.crt:/etc/civora-db-ca/ca.crt:ro" \
    -e CIVORA_ENV=dev -e COUNTRY_PACK=tn -e DATABASE_URL="$(url civora_core_app "$app_pw")" civora-core:dev >/dev/null
  check "civora-core /health: database up, connected as the least-privilege account" \
    "for i in \$(seq 1 30); do docker exec pgt-core wget -qO- http://127.0.0.1:3000/health 2>/dev/null | grep -q '\"database\":\"up\"' && exit 0; sleep 1; done; exit 1"
  check "base schemas created by the migrator, owned by it" \
    "test \"\$(psql_on $L \"select string_agg(nspname||':'||pg_get_userbyid(nspowner), ',' order by nspname) from pg_namespace where nspname in ('audit','config','iam')\" civora_core)\" = 'audit:civora_core_migrator,config:civora_core_migrator,iam:civora_core_migrator'"
fi

# Planned failover: stop Patroni on the leader; another node must take over; the old leader must rejoin.
t0=$(date +%s)
docker exec "$L" systemctl stop patroni
check "planned failover: a standby becomes leader" "N=\$(wait_leader_not $L) && echo \$N > $work/newleader"
failover_s=$(( $(date +%s) - t0 ))
check "no acknowledged write lost across planned failover" "test \"\$(psql_on \$(cat $work/newleader) 'select count(*) from drill_marker')\" = 1200"
docker exec "$L" systemctl start patroni
check "old leader rejoins as streaming standby" "for i in \$(seq 1 60); do [ \"\$(state_of \$(cat $work/newleader) $L)\" = streaming ] && exit 0; sleep 2; done; exit 1"
[[ "$app_path" == 1 ]] && check "civora-core survived the planned failover (same process; database up through pg-router)" "app_alive"

# Planned switchover with the operator command (runbook §3): leadership moves to the synchronous standby.
check "switchover (patronictl): steady state first" "wait_steady"
Lw=$(current_leader); Sw=$(sync_on "$Lw")
check "switchover (patronictl): $Sw becomes leader, $Lw streams from it" \
  "docker exec $Sw timeout 60 patronictl -c /etc/patroni/config.yml switchover civora-test --leader $Lw --candidate $Sw --force >/dev/null && for i in \$(seq 1 60); do [ \"\$(leader_on $Sw)\" = $Sw ] && [ \"\$(state_of $Sw $Lw)\" = streaming ] && exit 0; sleep 1; done; exit 1"

# Unplanned failure in steady state: freeze the leader (no clean shutdown). If the app path runs, a client writes
# through the router every 100 ms; afterwards every acknowledged write must exist and the write gap is measured.
check "steady state before the crash test (synchronous standby designated)" "wait_steady"
L2=$(current_leader); S2=$(sync_on "$L2")
if [[ "$app_path" == 1 ]]; then
  # A client on the backup node writes through pg-router as the least-privilege account every 100 ms and logs
  # each acknowledged id. Every statement is bounded (connect_timeout, timeout 5).
  psql_on "$L2" "create table public.avail(id bigserial primary key, at timestamptz default clock_timestamp()); grant insert, select on public.avail to civora_core_app; grant usage on sequence public.avail_id_seq to civora_core_app" civora_core >/dev/null
  docker cp "$work/ca.crt" tn-t-bk1:/tmp/router-ca.crt
  docker exec -i tn-t-bk1 sh -c 'cat > /tmp/avail-loop.sh' <<LOOP
while true; do
  r=\$(timeout 5 psql "host=pg-router dbname=civora_core user=civora_core_app password=$app_pw sslmode=verify-full sslrootcert=/tmp/router-ca.crt connect_timeout=2" -qAtc 'insert into public.avail default values returning id' 2>/dev/null) \\
    && echo "ok \$(date +%s.%N) \$r" || echo "fail \$(date +%s.%N)"
  sleep 0.1
done >> /tmp/avail.log
LOOP
  docker exec -d tn-t-bk1 bash /tmp/avail-loop.sh
  sleep 5
fi
psql_on "$L2" "insert into drill_marker select g, 'before-crash' from generate_series(1201,1300) g" >/dev/null
t1=$(date +%s)
docker pause "$L2" >/dev/null
check "crash: synchronous standby ($S2) takes over from the frozen leader ($L2)" \
  "for i in \$(seq 1 90); do [ \"\$(leader_on $S2)\" = $S2 ] && exit 0; sleep 1; done; exit 1"
crash_s=$(( $(date +%s) - t1 ))
check "crash: synchronously committed rows survive" "test \"\$(psql_on $S2 'select count(*) from drill_marker')\" = 1300"
if [[ "$app_path" == 1 ]]; then
  check "router follows the new primary (writes through pg-router succeed again)" \
    "for i in \$(seq 1 60); do docker exec tn-t-bk1 tail -3 /tmp/avail.log | grep -q '^ok ' && exit 0; sleep 1; done; exit 1"
  sleep 3
  docker exec tn-t-bk1 pkill -f avail-loop.sh || true
  docker exec tn-t-bk1 cat /tmp/avail.log > "$work/avail.log"
  psql_on "$S2" "select id from public.avail" civora_core > "$work/avail-ids.txt"
  check "no acknowledged write lost through the crash (every id the client saw committed is on the new primary)" \
    "python3 - $work/avail.log $work/avail-ids.txt <<'PY'
import sys
acked = {l.split()[2] for l in open(sys.argv[1]) if l.startswith('ok ') and len(l.split()) == 3}
stored = {l.strip() for l in open(sys.argv[2]) if l.strip()}
missing = acked - stored
print(f'acknowledged={len(acked)} stored={len(stored)} missing={len(missing)}')
sys.exit(1 if missing or not acked else 0)
PY"
  gap_s=$(python3 -c "import sys
t=[float(l.split()[1]) for l in open('$work/avail.log') if l.startswith('ok ')]
print(f'{max(b-a for a,b in zip(t,t[1:])):.1f}')")
  fails=$(grep -c '^fail ' "$work/avail.log" || true)
fi
docker unpause "$L2" >/dev/null
check "crash: frozen node rejoins as streaming standby (pg_rewind)" \
  "for i in \$(seq 1 90); do [ \"\$(state_of $S2 $L2)\" = streaming ] && exit 0; sleep 2; done; exit 1"
[[ "$app_path" == 1 ]] && check "civora-core survived the crash failover (same process; database up through pg-router)" "app_alive"

# Rebuild a standby from the leader (runbook §5, when pg_rewind cannot repair a node).
check "reinit (patronictl): $L2 rebuilt from the leader and streaming again" \
  "docker exec $S2 timeout 120 patronictl -c /etc/patroni/config.yml reinit civora-test $L2 --force --wait >/dev/null && for i in \$(seq 1 60); do [ \"\$(state_of $S2 $L2)\" = streaming ] && exit 0; sleep 2; done; exit 1"

# 3-node topology: with one standby down, automatic failover must remain available (the other standby is designated).
if [[ "$db_nodes" == 3 ]]; then
  check "3 nodes: steady state" "wait_steady"
  L3=$(current_leader); S3=$(sync_on "$L3"); O3=$(printf '%s\n' $dbs | grep -vx "$L3" | grep -vx "$S3")
  docker exec "$S3" systemctl stop patroni
  check "3 nodes: with $S3 down, $O3 becomes the synchronous standby" "for i in \$(seq 1 60); do [ \"\$(sync_on $L3)\" = $O3 ] && exit 0; sleep 1; done; exit 1"
  docker pause "$L3" >/dev/null
  t3=$(date +%s)
  check "3 nodes: leader crash while one standby is down → $O3 promoted automatically" \
    "for i in \$(seq 1 90); do [ \"\$(leader_on $O3)\" = $O3 ] && exit 0; sleep 1; done; exit 1"
  crash3_s=$(( $(date +%s) - t3 ))
  docker unpause "$L3" >/dev/null; docker exec "$S3" systemctl start patroni
  check "3 nodes: cluster heals (all standbys streaming)" \
    "for i in \$(seq 1 90); do v=\$(cluster_on $O3); echo \"\$v\" | q 'assert sum(1 for x in m if x[\"role\"]!=\"leader\" and x[\"state\"]==\"streaming\")==2' 2>/dev/null && exit 0; sleep 2; done; exit 1"
fi

# Restore drill (latest), after a fresh full backup.
docker exec -u pgbackrest tn-t-bk1 pgbackrest --stanza=civora backup --type=full >/dev/null
check "restore drill: restore, start, query, verify checksums" \
  "docker exec -u postgres tn-t-bk1 /usr/local/sbin/civora-restore-drill 'select count(*) from drill_marker' | tee $work/drill.json | grep -q '\"query_result\":\"1300\"'"

# Idempotence
"$playbook_bin" -i "$inv" "$here/playbook.yml" > "$work/run2.log" 2>&1 || { tail -40 "$work/run2.log"; exit 1; }
check "second run changes nothing (idempotent)" "grep -E 'changed=' $work/run2.log | grep -vqE 'changed=[1-9]'"

summary="planned failover ${failover_s}s; crash failover ${crash_s}s; longest write gap through pg-router ${gap_s}s (${fails:-0} failed attempts)"
[[ "$db_nodes" == 3 ]] && summary="$summary; 3-node crash with one standby down ${crash3_s:-?}s"
stamp "done (fail=$fail; $summary)"
[ -f "$work/pitr.json" ] && echo "PITR drill: $(cat "$work/pitr.json")"
[ -f "$work/drill.json" ] && echo "Drill: $(cat "$work/drill.json")"
exit $fail
