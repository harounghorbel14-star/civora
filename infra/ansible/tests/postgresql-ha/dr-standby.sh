#!/usr/bin/env bash
# Disaster recovery with a LIVE second site (ADR-029; runbook §8.1), on systemd containers:
#   site A : 2 database servers + backup node (repository 1)
#   site B : backup node (repository 2) + 2 database servers running a Patroni STANDBY CLUSTER that streams from
#            site A through a permanent slot (own etcd: the two servers + the backup node)
#   1. the role builds both sites in one run; site B's leader streams continuously;
#   2. a client writes through site A's primary every 200 ms and logs every acknowledged id;
#   3. site A is destroyed at once (no clean shutdown);
#   4. site B is promoted with ONE command (standby_cluster removed from its dynamic configuration);
#   5. pg-router (rendered from the chart) points at site B; writes succeed;
#   6. measured: acknowledged writes lost (compare dr.sh: restore from repository 2 lost the last 16 s), time to
#      promotion and to writes accepted again;
#   7. the role is re-run for the post-disaster topology; site B archives and backs up to repository 2.
# Needs: docker, Ansible (ANSIBLE_PLAYBOOK), helm, openssl, curl, python3. Synthetic data only.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
repo="$(cd "$here/../../../.." && pwd)"
playbook_bin="${ANSIBLE_PLAYBOOK:-ansible-playbook}"
image=civora-pgha-testnode:noble
haproxy_image="docker.io/library/haproxy@sha256:5d97434a423c2533cfeb42874d45cf6d69a840b60334582dfbfd5008e94c80be"
net=civora-pgha-drs
subnet=172.31.242.0/24
router_ip=172.31.242.30
declare -A ip=([tn-a-db1]=172.31.242.11 [tn-a-db2]=172.31.242.12 [tn-a-bk1]=172.31.242.21 [tn-b-bk2]=172.31.242.22
               [tn-b-db1]=172.31.242.41 [tn-b-db2]=172.31.242.42)
site_a=(tn-a-db1 tn-a-db2 tn-a-bk1)
work="$(mktemp -d)"
start=$(date +%s)
stamp() { echo "[$(( $(date +%s) - start ))s] $*"; }
cleanup() {
  if [[ "${KEEP:-0}" != "1" ]]; then
    for n in "${!ip[@]}" pg-router-drs; do docker rm -f "$n" >/dev/null 2>&1 || true; done
    docker network rm "$net" >/dev/null 2>&1 || true
  fi
  rm -rf "$work"
}
trap cleanup EXIT
fail=0
check() { if out=$(eval "$2" 2>&1); then echo "  ok   $1"; else echo "  FAIL $1"; echo "$out" | tail -15 | sed 's/^/       /'; fail=1; fi; }

if [[ "${SKIP_BUILD:-0}" != "1" ]]; then
  docker build -q ${PROXY_CA:+--secret id=proxy_ca,src=$PROXY_CA} -t "$image" "$here" >/dev/null
fi
for n in "${!ip[@]}" pg-router-drs; do docker rm -f "$n" >/dev/null 2>&1 || true; done
docker network rm "$net" >/dev/null 2>&1 || true
docker network create --subnet "$subnet" "$net" >/dev/null
node_up() {
  docker run -d --name "$1" --hostname "$1" --network "$net" --ip "${ip[$1]}" \
    --privileged --cgroupns=host -v /sys/fs/cgroup:/sys/fs/cgroup:rw "$image" >/dev/null
  waited=0; for _ in $(seq 1 120); do docker exec "$1" systemctl is-system-running 2>/dev/null | grep -qE 'running|degraded' && { waited=1; break; }; sleep 1; done
  [ "$waited" = 1 ] || { echo "  FAIL timed out after 120 s waiting for: docker exec $1 systemctl is-system-running 2>/dev/null | grep -qE 'running|degra"; exit 1; }  # bounded wait
}
for n in "${!ip[@]}"; do node_up "$n"; done
stamp "site A (2 database servers + repository 1) and site B (repository 2 + 2 database servers) up"

# Test CA and secrets (generated for this run, never committed). Database certificates carry the pg-router names.
inv="$work/inv-a"; mkdir -p "$inv/host_vars" "$inv/group_vars"
openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:P-256 -nodes -days 2 -subj "/CN=civora-test-ca" \
  -keyout "$work/ca.key" -out "$work/ca.crt" 2>/dev/null
chmod 644 "$work/ca.crt"
rnd() { head -c 48 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c "$1"; }
indent() { sed 's/^/  /'; }
app_pw=$(rnd 32)
{
  echo "civora_cell_id: test"
  echo "ansible_connection: community.docker.docker"
  echo "postgresql_ha_app_cidrs: ['$subnet']"
  echo "postgresql_ha_superuser_password: '$(rnd 32)'"
  echo "postgresql_ha_replication_password: '$(rnd 32)'"
  echo "postgresql_ha_rewind_password: '$(rnd 32)'"
  echo "postgresql_ha_restapi_password: '$(rnd 32)'"
  echo "postgresql_ha_repo_cipher_pass: '$(rnd 48)'"
  echo "postgresql_ha_repo2_cipher_pass: '$(rnd 48)'"
  echo "postgresql_ha_databases: [{ name: civora_core, owner: civora_core_migrator, app_user: civora_core_app }]"
  echo "postgresql_ha_role_passwords: { civora_core_migrator: '$(rnd 32)', civora_core_app: '$app_pw' }"
  echo "postgresql_ha_tls_ca: |"; indent < "$work/ca.crt"
} > "$inv/group_vars/all.yml"
host_vars() { # name dir
  local n=$1 sans="DNS:$1,IP:${ip[$1]}"
  [[ "$n" == *db* ]] && sans="$sans,DNS:pg-router,DNS:pg-router.civora-tn.svc,DNS:pg-router.civora-tn.svc.cluster.local"
  openssl req -newkey ec -pkeyopt ec_paramgen_curve:P-256 -nodes -subj "/CN=$n" -keyout "$work/$n.key" -out "$work/$n.csr" 2>/dev/null
  printf 'subjectAltName=%s\nextendedKeyUsage=serverAuth,clientAuth\nkeyUsage=digitalSignature,keyEncipherment\n' "$sans" > "$work/$n.ext"
  openssl x509 -req -in "$work/$n.csr" -CA "$work/ca.crt" -CAkey "$work/ca.key" -CAcreateserial -days 2 -extfile "$work/$n.ext" -out "$work/$n.crt" 2>/dev/null
  { echo "ansible_host: ${ip[$n]}"; echo "ansible_docker_host: $n"
    echo "postgresql_ha_tls_cert: |"; indent < "$work/$n.crt"; echo "postgresql_ha_tls_key: |"; indent < "$work/$n.key"; } > "$2/host_vars/$n.yml"
}
for n in "${!ip[@]}"; do host_vars "$n" "$inv"; done
printf 'db_nodes:\n  hosts:\n    tn-a-db1:\n    tn-a-db2:\nbackup:\n  hosts:\n    tn-a-bk1:\nbackup_dr:\n  hosts:\n    tn-b-bk2:\nstandby_db_nodes:\n  hosts:\n    tn-b-db1:\n    tn-b-db2:\n' > "$inv/hosts.yml"
chmod 600 "$inv/group_vars/all.yml"
export ANSIBLE_ROLES_PATH="$repo/infra/ansible/roles" ANSIBLE_HOST_KEY_CHECKING=False ANSIBLE_STDOUT_CALLBACK=default ANSIBLE_NOCOLOR=1
"$playbook_bin" -i "$inv" "$here/playbook.yml" > "$work/run-a.log" 2>&1 || { tail -60 "$work/run-a.log"; exit 1; }
stamp "role applied: main cluster at site A, standby cluster at site B"

cluster() { curl -s --noproxy '*' --max-time 3 --cacert "$work/ca.crt" "https://${ip[$1]}:8008/cluster" || true; }
q() { python3 -c "import json,sys
try: m=json.load(sys.stdin)['members']
except Exception: m=[]
$1"; }
leader_of() { for d in "$@"; do l=$(cluster "$d" | q 'print(next((x["name"] for x in m if x["role"]=="leader"),""))'); [ -n "$l" ] && { echo "$l"; return; }; done; }
psql_on() { docker exec -u postgres "$1" psql -h /var/run/postgresql -d "${3:-civora_core}" -qAtc "$2"; }

echo "Checks, normal operation:"
LA=$(leader_of tn-a-db1 tn-a-db2)
check "site A cluster has a leader ($LA) and a synchronous standby" \
  "cluster tn-a-db1 | q 'assert sorted(x[\"role\"] for x in m)==[\"leader\",\"sync_standby\"]'"
check "site B is a standby cluster: a standby leader streaming from site A, and a replica streaming from it" \
  "for i in \$(seq 1 60); do cluster tn-b-db1 | q 'assert sorted(x[\"role\"] for x in m)==[\"replica\",\"standby_leader\"] and all(x[\"state\"]==\"streaming\" for x in m)' 2>/dev/null && exit 0; sleep 2; done; exit 1"
check "site A keeps a permanent replication slot for site B, in use" \
  "test \"\$(psql_on $LA \"select active from pg_replication_slots where slot_name='civora_standby_site'\" postgres)\" = t"
check "replication to site B uses TLS" \
  "test \"\$(psql_on $LA \"select bool_and(s.ssl) from pg_stat_replication r join pg_stat_ssl s using (pid) where r.application_name like 'tn-b-%'\" postgres)\" = t"
check "site B refuses writes before promotion" \
  "! docker exec -u postgres tn-b-db1 psql -h /var/run/postgresql -d civora_core -qAtc 'create table public.should_fail(i int)' 2>/dev/null"

# Continuous writes acknowledged by site A; the client runs at site B so its log survives the loss of site A.
psql_on "$LA" "create table public.dr_marker(id bigserial primary key, at timestamptz default clock_timestamp()); grant insert, select on public.dr_marker to civora_core_app; grant usage on sequence public.dr_marker_id_seq to civora_core_app" >/dev/null
docker cp "$work/ca.crt" tn-b-bk2:/tmp/dr-ca.crt
docker exec -i tn-b-bk2 sh -c 'cat > /tmp/dr-writer.sh' <<LOOP
while true; do
  r=\$(timeout 3 psql "host=$LA dbname=civora_core user=civora_core_app password=$app_pw sslmode=verify-full sslrootcert=/tmp/dr-ca.crt connect_timeout=2" -qAtc 'insert into public.dr_marker default values returning id' 2>/dev/null) \\
    && echo "ok \$(date +%s.%N) \$r" || echo "fail \$(date +%s.%N)"
  sleep 0.2
done >> /tmp/dr-writer.log
LOOP
docker exec -d tn-b-bk2 bash /tmp/dr-writer.sh
sleep 45
lag_bytes=$(psql_on "$LA" "select pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn) from pg_replication_slots where slot_name='civora_standby_site'" postgres)
check "metrics: the collector on site A's primary reports the second site's slot lag" \
  "docker exec $LA systemctl start civora-db-metrics.service && docker exec $LA grep -E '^civora_postgres_standby_site_slot_active 1' /var/lib/prometheus/node-exporter/civora_postgres.prom"

# Disaster: site A disappears at once.
t_loss=$(date +%s.%N)
docker rm -f "${site_a[@]}" >/dev/null
stamp "site A destroyed (no clean shutdown); slot lag just before: ${lag_bytes} bytes"
sleep 2
docker exec tn-b-bk2 pkill -f dr-writer.sh || true
docker exec tn-b-bk2 cat /tmp/dr-writer.log > "$work/writer.log"

# Promotion: one command at site B (runbook §8.1).
docker exec tn-b-db1 patronictl -c /etc/patroni/config.yml edit-config --force -s standby_cluster=null >/dev/null
t_cmd=$(date +%s.%N)
check "site B promoted: a leader and a streaming synchronous standby" \
  "for i in \$(seq 1 90); do cluster tn-b-db1 | q 'assert sorted(x[\"role\"] for x in m)==[\"leader\",\"sync_standby\"] and all(x[\"state\"]==\"streaming\" for x in m if x[\"role\"]!=\"leader\")' 2>/dev/null && exit 0; sleep 1; done; exit 1"
promote_s=$(python3 -c "import time;print(f'{time.time()-$t_cmd:.0f}')")
LB=$(leader_of tn-b-db1 tn-b-db2)
psql_on "$LB" "select id from public.dr_marker order by id" > "$work/restored-ids.txt"
read -r acked lost_rows rpo_ms <<<"$(python3 - "$work/writer.log" "$work/restored-ids.txt" "$t_loss" <<'PY'
import sys
acked = {}
for l in open(sys.argv[1]):
    p = l.split()
    if p[0] == 'ok' and len(p) == 3: acked[int(p[2])] = float(p[1])
restored = {int(x) for x in open(sys.argv[2]) if x.strip()}
lost = [i for i in acked if i not in restored]
newest_lost = max((t for i, t in acked.items() if i not in restored), default=None)
oldest_lost = min((t for i, t in acked.items() if i not in restored), default=None)
window = 0 if newest_lost is None else (float(sys.argv[3]) - oldest_lost) * 1000
print(len(acked), len(lost), f"{window:.0f}")
PY
)"
echo "Checks, after the loss of site A:"
check "acknowledged writes: $acked; lost: $lost_rows (loss window ${rpo_ms} ms before the disaster)" "test $acked -gt 100"
check "loss within the target for critical data (RPO <= 5 s): no acknowledged write older than 5 s missing" "test $rpo_ms -le 5000"

helm template pg-router "$repo/infra/helm/pg-router" --kube-version 1.33.4 -n civora-tn \
  --set servers[0].name=tn-b-db1 --set servers[0].address=${ip[tn-b-db1]} --set servers[1].name=tn-b-db2 --set servers[1].address=${ip[tn-b-db2]} \
  -s templates/configmap.yaml | awk '/haproxy.cfg: \|/{f=1;next} f{sub(/^    /,""); print}' > "$work/haproxy.cfg"
chmod 644 "$work/haproxy.cfg"
docker run -d --name pg-router-drs --network "$net" --network-alias pg-router --ip "$router_ip" -u 10099:10099 --read-only --tmpfs /tmp \
  -v "$work/haproxy.cfg:/usr/local/etc/haproxy/haproxy.cfg:ro" -v "$work/ca.crt:/etc/pg-router/ca.crt:ro" \
  "$haproxy_image" -W -db -f /usr/local/etc/haproxy/haproxy.cfg >/dev/null
check "writes through pg-router (site B) accepted as the application account, verify-full TLS" \
  "for i in \$(seq 1 30); do docker exec tn-b-bk2 psql 'host=pg-router dbname=civora_core user=civora_core_app password=$app_pw sslmode=verify-full sslrootcert=/tmp/dr-ca.crt connect_timeout=2' -qAtc 'insert into public.dr_marker default values returning id' 2>/dev/null | grep -q . && exit 0; sleep 1; done; exit 1"
rto_s=$(python3 -c "import time;print(f'{time.time()-$t_loss:.0f}')")
check "site B archives its new timeline to repository 2 (pgbackrest check)" "docker exec -u postgres $LB pgbackrest --stanza=civora check"

# Post-disaster topology: site B becomes the main cluster in the inventory; the role re-points repository 2's backups.
invb="$work/inv-b"; mkdir -p "$invb"; cp -r "$inv/group_vars" "$inv/host_vars" "$invb/"
printf 'db_nodes:\n  hosts:\n    tn-b-db1:\n    tn-b-db2:\nbackup_dr:\n  hosts:\n    tn-b-bk2:\n' > "$invb/hosts.yml"
"$playbook_bin" -i "$invb" "$here/playbook.yml" > "$work/run-b.log" 2>&1 || { tail -60 "$work/run-b.log"; exit 1; }
check "role re-run for the post-disaster topology; a full backup of site B to repository 2 succeeds" \
  "docker exec -u pgbackrest tn-b-bk2 pgbackrest --stanza=civora --repo=2 backup --type=full"
check "nothing changed in the data: every row restored before is still there" \
  "test \"\$(psql_on $LB 'select count(*) from public.dr_marker where id <= $(tail -1 "$work/restored-ids.txt")')\" = \"\$(wc -l < $work/restored-ids.txt | tr -d ' ')\""
stamp "done (fail=$fail; acknowledged writes $acked, lost $lost_rows; promotion ${promote_s} s after the command; writes accepted again ${rto_s} s after the loss)"
exit $fail
