#!/usr/bin/env bash
# Disaster-recovery rehearsal for roles/postgresql_ha (ADR-029; runbook §8), on systemd containers:
#   site A : 2 database servers + backup node (repository 1)        site B : backup node (repository 2)
#   1. build both sites; WAL is archived to both repositories, each encrypted with its own key;
#   2. a client writes through the primary every 200 ms and logs every acknowledged id;
#   3. site A is destroyed at once (all three containers removed, no clean shutdown);
#   4. at site B, two new database servers are built from repository 2 by the role
#      (postgresql_ha_bootstrap_from_repo=2): restore, replay all archived WAL, promote, replica clone;
#   5. pg-router (rendered from the Helm chart) points at site B; writes through it succeed;
#   6. measured: data lost (acknowledged rows missing) and time from loss to writes accepted again;
#      the target is RPO <= 15 min, RTO <= 4 h (PRD §12.7).
# Needs: docker, Ansible (ANSIBLE_PLAYBOOK), helm, openssl, curl, python3. Synthetic data only.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
repo="$(cd "$here/../../../.." && pwd)"
playbook_bin="${ANSIBLE_PLAYBOOK:-ansible-playbook}"
image=civora-pgha-testnode:noble
haproxy_image="docker.io/library/haproxy@sha256:5d97434a423c2533cfeb42874d45cf6d69a840b60334582dfbfd5008e94c80be"
net=civora-pgha-dr
subnet=172.31.241.0/24
router_ip=172.31.241.30
declare -A ip=([tn-a-db1]=172.31.241.11 [tn-a-db2]=172.31.241.12 [tn-a-bk1]=172.31.241.21 [tn-b-bk2]=172.31.241.22
               [tn-b-db1]=172.31.241.41 [tn-b-db2]=172.31.241.42)
site_a=(tn-a-db1 tn-a-db2 tn-a-bk1)
work="$(mktemp -d)"
start=$(date +%s)
stamp() { echo "[$(( $(date +%s) - start ))s] $*"; }
cleanup() {
  if [[ "${KEEP:-0}" != "1" ]]; then
    for n in "${!ip[@]}" pg-router-dr; do docker rm -f "$n" >/dev/null 2>&1 || true; done
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
for n in "${!ip[@]}" pg-router-dr; do docker rm -f "$n" >/dev/null 2>&1 || true; done
docker network rm "$net" >/dev/null 2>&1 || true
docker network create --subnet "$subnet" "$net" >/dev/null
node_up() {
  docker run -d --name "$1" --hostname "$1" --network "$net" --ip "${ip[$1]}" \
    --privileged --cgroupns=host -v /sys/fs/cgroup:/sys/fs/cgroup:rw "$image" >/dev/null
  waited=0; for _ in $(seq 1 120); do docker exec "$1" systemctl is-system-running 2>/dev/null | grep -qE 'running|degraded' && { waited=1; break; }; sleep 1; done
  [ "$waited" = 1 ] || { echo "  FAIL timed out after 120 s waiting for: docker exec $1 systemctl is-system-running 2>/dev/null | grep -qE 'running|degra"; exit 1; }  # bounded wait
}
for n in "${site_a[@]}" tn-b-bk2; do node_up "$n"; done
stamp "site A (2 database servers + repository 1) and site B (repository 2) up"

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
printf 'db_nodes:\n  hosts:\n    tn-a-db1:\n    tn-a-db2:\nbackup:\n  hosts:\n    tn-a-bk1:\nbackup_dr:\n  hosts:\n    tn-b-bk2:\n' > "$inv/hosts.yml"
chmod 600 "$inv/group_vars/all.yml"
export ANSIBLE_ROLES_PATH="$repo/infra/ansible/roles" ANSIBLE_HOST_KEY_CHECKING=False ANSIBLE_STDOUT_CALLBACK=default ANSIBLE_NOCOLOR=1
"$playbook_bin" -i "$inv" "$here/playbook.yml" > "$work/run-a.log" 2>&1 || { tail -60 "$work/run-a.log"; exit 1; }
stamp "role applied to both sites"

cluster() { curl -s --noproxy '*' --max-time 3 --cacert "$work/ca.crt" "https://${ip[$1]}:8008/cluster" || true; }
q() { python3 -c "import json,sys
try: m=json.load(sys.stdin)['members']
except Exception: m=[]
$1"; }
leader_of() { for d in "$@"; do l=$(cluster "$d" | q 'print(next((x["name"] for x in m if x["role"]=="leader"),""))'); [ -n "$l" ] && { echo "$l"; return; }; done; }
psql_on() { docker exec -u postgres "$1" psql -h /var/run/postgresql -d "${3:-civora_core}" -qAtc "$2"; }
repo_info() { # node repo -> "full backups" count and status code
  docker exec -u pgbackrest "$1" pgbackrest --stanza=civora --repo="$2" info --output=json \
    | python3 -c 'import json,sys;d=json.load(sys.stdin)[0];print(d["status"]["code"], sum(1 for b in d["backup"] if b["type"]=="full"))'
}

echo "Checks, normal operation:"
LA=$(leader_of tn-a-db1 tn-a-db2)
check "site A cluster has a leader ($LA)" "test -n '$LA'"
check "repository 1 (site A) has a full backup" "test \"\$(repo_info tn-a-bk1 1)\" = '0 1'"
check "repository 2 (site B) has a full backup" "test \"\$(repo_info tn-b-bk2 2)\" = '0 1'"
check "repositories use different encryption keys" "test \"\$(docker exec tn-a-bk1 grep ^repo1-cipher-pass /etc/pgbackrest.conf | cut -d= -f2)\" != \"\$(docker exec tn-b-bk2 grep ^repo2-cipher-pass /etc/pgbackrest.conf | cut -d= -f2)\""
check "WAL archived to both repositories (pgbackrest check from the leader)" "docker exec -u postgres $LA pgbackrest --stanza=civora check"

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
sleep 75   # longer than archive_timeout (60 s), so several WAL segments reach both repositories

# Disaster: site A disappears at once.
t_loss=$(date +%s.%N)
docker rm -f "${site_a[@]}" >/dev/null
stamp "site A destroyed (no clean shutdown)"
sleep 2
docker exec tn-b-bk2 pkill -f dr-writer.sh || true
docker exec tn-b-bk2 cat /tmp/dr-writer.log > "$work/writer.log"

# Recovery at site B: two new database servers built from repository 2 by the same role.
for n in tn-b-db1 tn-b-db2; do node_up "$n"; done
invb="$work/inv-b"; mkdir -p "$invb"; cp -r "$inv/group_vars" "$inv/host_vars" "$invb/"
echo "postgresql_ha_bootstrap_from_repo: 2" >> "$invb/group_vars/all.yml"
printf 'db_nodes:\n  hosts:\n    tn-b-db1:\n    tn-b-db2:\nbackup_dr:\n  hosts:\n    tn-b-bk2:\n' > "$invb/hosts.yml"
"$playbook_bin" -i "$invb" "$here/playbook.yml" > "$work/run-b.log" 2>&1 || { tail -60 "$work/run-b.log"; exit 1; }
stamp "site B database servers built from repository 2"

echo "Checks, after disaster recovery at site B:"
LB=$(leader_of tn-b-db1 tn-b-db2)
check "site B cluster has a leader ($LB) and a streaming synchronous standby" \
  "for i in \$(seq 1 60); do cluster tn-b-db1 | q 'assert sorted(x[\"role\"] for x in m)==[\"leader\",\"sync_standby\"] and all(x[\"state\"]==\"streaming\" for x in m if x[\"role\"]!=\"leader\")' 2>/dev/null && exit 0; sleep 2; done; exit 1"
psql_on "$LB" "select id from public.dr_marker order by id" > "$work/restored-ids.txt"
read -r acked lost_rows rpo_s <<<"$(python3 - "$work/writer.log" "$work/restored-ids.txt" "$t_loss" <<'PY'
import sys
acked = {}
for l in open(sys.argv[1]):
    p = l.split()
    if p[0] == 'ok' and len(p) == 3: acked[int(p[2])] = float(p[1])
restored = {int(x) for x in open(sys.argv[2]) if x.strip()}
lost = [i for i in acked if i not in restored]
last_kept = max((t for i, t in acked.items() if i in restored), default=0)
print(len(acked), len(lost), f"{float(sys.argv[3]) - last_kept:.0f}")
PY
)"
check "restored data: acknowledged rows from before the last archived WAL are present ($((acked - lost_rows)) of $acked)" "test $((acked - lost_rows)) -gt 0"
check "data loss bounded by the archive interval: newest restored row written ${rpo_s} s before the loss (target RPO <= 900 s)" "test $rpo_s -le 900"
check "no gap: every acknowledged row up to the newest restored one is present" "python3 - $work/writer.log $work/restored-ids.txt <<'PY'
import sys
acked = sorted(int(l.split()[2]) for l in open(sys.argv[1]) if l.startswith('ok ') and len(l.split()) == 3)
restored = {int(x) for x in open(sys.argv[2]) if x.strip()}
top = max(restored)
missing = [i for i in acked if i <= top and i not in restored]
sys.exit(1 if missing else 0)
PY"

# pg-router points at site B (configuration rendered from the chart); writes through it succeed.
helm template pg-router "$repo/infra/helm/pg-router" --kube-version 1.33.4 -n civora-tn \
  --set servers[0].name=tn-b-db1 --set servers[0].address=${ip[tn-b-db1]} --set servers[1].name=tn-b-db2 --set servers[1].address=${ip[tn-b-db2]} \
  -s templates/configmap.yaml | awk '/haproxy.cfg: \|/{f=1;next} f{sub(/^    /,""); print}' > "$work/haproxy.cfg"
chmod 644 "$work/haproxy.cfg"
docker run -d --name pg-router-dr --network "$net" --network-alias pg-router --ip "$router_ip" -u 10099:10099 --read-only --tmpfs /tmp \
  -v "$work/haproxy.cfg:/usr/local/etc/haproxy/haproxy.cfg:ro" -v "$work/ca.crt:/etc/pg-router/ca.crt:ro" \
  "$haproxy_image" -W -db -f /usr/local/etc/haproxy/haproxy.cfg >/dev/null
check "writes through pg-router (site B) accepted as the application account, verify-full TLS" \
  "for i in \$(seq 1 30); do docker exec tn-b-bk2 psql 'host=pg-router dbname=civora_core user=civora_core_app password=$app_pw sslmode=verify-full sslrootcert=/tmp/dr-ca.crt connect_timeout=2' -qAtc 'insert into public.dr_marker default values returning id' 2>/dev/null | grep -q . && exit 0; sleep 1; done; exit 1"
rto_s=$(python3 -c "import time;print(f'{time.time()-$t_loss:.0f}')")
check "new timeline archived to repository 2 and a new full backup succeeds there" \
  "docker exec -u postgres $LB pgbackrest --stanza=civora check && docker exec -u pgbackrest tn-b-bk2 pgbackrest --stanza=civora --repo=2 backup --type=full"
stamp "done (fail=$fail; acknowledged writes $acked, lost $lost_rows; newest restored row ${rpo_s} s before the loss; writes accepted again ${rto_s} s after the loss)"
exit $fail
