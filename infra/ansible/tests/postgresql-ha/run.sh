#!/usr/bin/env bash
# Integration test for roles/postgresql_ha on three systemd containers (2 database nodes + 1 backup node).
# Checks: cluster formation, synchronous replication, WAL archiving, first backup, failover and rejoin,
# restore drill with page-checksum verification, and idempotence (second run changes nothing).
#
# Needs: docker (privileged containers with systemd), an Ansible with the community.docker connection plugin
#        (e.g. pip install ansible==11.13.0; set ANSIBLE_PLAYBOOK if not on PATH), openssl.
# Synthetic only: every secret and certificate is generated for this run and deleted afterwards.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
ansible_dir="$(cd "$here/../.." && pwd)"
playbook_bin="${ANSIBLE_PLAYBOOK:-ansible-playbook}"
image=civora-pgha-testnode:noble
net=civora-pgha-test
subnet=172.31.240.0/24
declare -A ip=([tn-t-db1]=172.31.240.11 [tn-t-db2]=172.31.240.12 [tn-t-bk1]=172.31.240.21)
work="$(mktemp -d)"
start=$(date +%s)
stamp() { echo "[$(( $(date +%s) - start ))s] $*"; }
cleanup() {
  if [[ "${KEEP:-0}" != "1" ]]; then
    for n in "${!ip[@]}"; do docker rm -f "$n" >/dev/null 2>&1 || true; done
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
for n in "${!ip[@]}"; do docker rm -f "$n" >/dev/null 2>&1 || true; done
docker network rm "$net" >/dev/null 2>&1 || true
docker network create --subnet "$subnet" "$net" >/dev/null
for n in "${!ip[@]}"; do
  docker run -d --name "$n" --hostname "$n" --network "$net" --ip "${ip[$n]}" \
    --privileged --cgroupns=host -v /sys/fs/cgroup:/sys/fs/cgroup:rw "$image" >/dev/null
done
for n in "${!ip[@]}"; do
  until docker exec "$n" systemctl is-system-running 2>/dev/null | grep -qE 'running|degraded'; do sleep 1; done
done
stamp "3 nodes up"

# 2. Test CA, node certificates (CN = node name, SAN = name + IP) and secrets — generated, never committed
inv="$work/inventory"; mkdir -p "$inv/host_vars" "$inv/group_vars"
openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:P-256 -nodes -days 2 -subj "/CN=civora-test-ca" \
  -keyout "$work/ca.key" -out "$work/ca.crt" 2>/dev/null
rnd() { head -c 48 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c "$1"; }
indent() { sed 's/^/  /'; }
{
  echo "civora_cell_id: test"
  echo "ansible_connection: community.docker.docker"
  echo "postgresql_ha_app_cidrs: ['$subnet']"
  echo "postgresql_ha_superuser_password: '$(rnd 32)'"
  echo "postgresql_ha_replication_password: '$(rnd 32)'"
  echo "postgresql_ha_rewind_password: '$(rnd 32)'"
  echo "postgresql_ha_restapi_password: '$(rnd 32)'"
  echo "postgresql_ha_repo_cipher_pass: '$(rnd 48)'"
  echo "postgresql_ha_tls_ca: |"; indent < "$work/ca.crt"
} > "$inv/group_vars/all.yml"
for n in "${!ip[@]}"; do
  openssl req -newkey ec -pkeyopt ec_paramgen_curve:P-256 -nodes -subj "/CN=$n" -keyout "$work/$n.key" -out "$work/$n.csr" 2>/dev/null
  printf 'subjectAltName=DNS:%s,IP:%s\nextendedKeyUsage=serverAuth,clientAuth\nkeyUsage=digitalSignature,keyEncipherment\n' "$n" "${ip[$n]}" > "$work/$n.ext"
  openssl x509 -req -in "$work/$n.csr" -CA "$work/ca.crt" -CAkey "$work/ca.key" -CAcreateserial -days 2 \
    -extfile "$work/$n.ext" -out "$work/$n.crt" 2>/dev/null
  {
    echo "ansible_host: ${ip[$n]}"
    echo "ansible_docker_host: $n"
    echo "postgresql_ha_tls_cert: |"; indent < "$work/$n.crt"
    echo "postgresql_ha_tls_key: |"; indent < "$work/$n.key"
  } > "$inv/host_vars/$n.yml"
done
printf 'db_nodes:\n  hosts:\n    tn-t-db1:\n    tn-t-db2:\nbackup:\n  hosts:\n    tn-t-bk1:\n' > "$inv/hosts.yml"
stamp "test CA, certificates and secrets generated"

# 3. Apply the role
export ANSIBLE_ROLES_PATH="$ansible_dir/roles" ANSIBLE_HOST_KEY_CHECKING=False ANSIBLE_STDOUT_CALLBACK=default ANSIBLE_NOCOLOR=1
"$playbook_bin" -i "$inv" "$here/playbook.yml" > "$work/run1.log" 2>&1 || { tail -60 "$work/run1.log"; exit 1; }
stamp "role applied (first run)"

fail=0
check() { if out=$(eval "$2" 2>&1); then echo "  ok   $1"; else echo "  FAIL $1"; echo "$out" | tail -15 | sed 's/^/       /'; fail=1; fi; }
pctl() { docker exec -u postgres tn-t-db1 patronictl -c /etc/patroni/config.yml list --format json; }
leader() { pctl | python3 -c 'import json,sys;print([m["Member"] for m in json.load(sys.stdin) if m["Role"]=="Leader"][0])'; }
psql_on() { docker exec -u postgres "$1" psql -h /var/run/postgresql -d postgres -Atc "$2"; }
echo "Checks:"
check "one leader, one synchronous standby streaming" \
  "pctl | python3 -c 'import json,sys;m=json.load(sys.stdin);r=sorted(x[\"Role\"] for x in m);s=[x[\"State\"] for x in m];assert r==[\"Leader\",\"Sync Standby\"],r;assert s.count(\"streaming\")==1 and s.count(\"running\")==1,s'"
L=$(leader); R=$([[ "$L" == tn-t-db1 ]] && echo tn-t-db2 || echo tn-t-db1)
check "write on leader ($L) is visible on replica ($R)" \
  "psql_on $L \"create table drill_marker(id int primary key, note text); insert into drill_marker select g, 'synthetic' from generate_series(1,1000) g\" && sleep 2 && test \"\$(psql_on $R 'select count(*) from drill_marker')\" = 1000"
check "data checksums enabled" "test \"\$(psql_on $L 'show data_checksums')\" = on"
check "replication uses TLS" "psql_on $L \"select count(*) from pg_stat_ssl s join pg_stat_replication r using (pid) where s.ssl\" | grep -qx 1"
check "first full backup in the repository (encrypted)" \
  "docker exec -u pgbackrest tn-t-bk1 pgbackrest --stanza=civora info --output=json | python3 -c 'import json,sys;d=json.load(sys.stdin)[0];assert d[\"status\"][\"code\"]==0;assert any(b[\"type\"]==\"full\" for b in d[\"backup\"]);assert d[\"cipher\"]==\"aes-256-cbc\"'"
check "WAL archiving end to end (pgbackrest check)" "docker exec -u pgbackrest tn-t-bk1 pgbackrest --stanza=civora check"
check "backup timers scheduled" "docker exec tn-t-bk1 systemctl is-enabled pgbackrest-backup-full.timer pgbackrest-backup-diff.timer"
check "application network rejected outside allowed CIDRs" \
  "docker exec tn-t-db1 grep -q 'host all all 0.0.0.0/0 reject' $( echo /var/lib/postgresql/16/patroni/pg_hba.conf )"

# Failover: stop Patroni on the leader; the standby must take over; the old leader must rejoin as standby.
t0=$(date +%s)
docker exec "$L" systemctl stop patroni
# Cluster view from Patroni's REST API (/cluster reads the DCS, so a frozen member cannot block it).
cluster_on() { curl -s --noproxy '*' --max-time 3 --cacert "$work/ca.crt" "https://${ip[$1]}:8008/cluster"; }
leader_on() { cluster_on "$1" | python3 -c 'import json,sys;print(next((m["name"] for m in json.load(sys.stdin)["members"] if m["role"]=="leader"),""))' 2>/dev/null; }
state_of() { cluster_on "$1" | python3 -c 'import json,sys;print(next((m["state"] for m in json.load(sys.stdin)["members"] if m["name"]==sys.argv[1]),""))' "$2" 2>/dev/null; }
check "planned failover (Patroni stopped on $L): $R becomes leader" "for i in \$(seq 1 60); do [ \"\$(leader_on $R)\" = $R ] && exit 0; sleep 2; done; exit 1"
failover_s=$(( $(date +%s) - t0 ))
check "no acknowledged write lost across failover" "test \"\$(psql_on $R 'select count(*) from drill_marker')\" = 1000"
docker exec "$L" systemctl start patroni
check "old leader rejoins as streaming standby" \
  "for i in \$(seq 1 60); do docker exec -u postgres $R patronictl -c /etc/patroni/config.yml list --format json | python3 -c 'import json,sys;m={x[\"Member\"]:x for x in json.load(sys.stdin)};assert m[\"$L\"][\"State\"]==\"streaming\"' 2>/dev/null && exit 0; sleep 2; done; exit 1"

# Unplanned failure: freeze the current leader (no clean shutdown, like a crash or network loss).
# Precondition: steady state. In synchronous mode Patroni only promotes the designated synchronous standby,
# so the test waits until one is designated (right after a rejoin there is none, and failover is refused by design).
L2=$(leader_on "$L"); R2=$([[ "$L2" == tn-t-db1 ]] && echo tn-t-db2 || echo tn-t-db1)
sync_of() { cluster_on "$1" | python3 -c 'import json,sys;print(next((m["name"] for m in json.load(sys.stdin)["members"] if m["role"]=="sync_standby" and m["state"]=="streaming"),""))' 2>/dev/null; }
check "steady state: $R2 is the designated synchronous standby" "for i in \$(seq 1 60); do [ \"\$(sync_of $L2)\" = $R2 ] && exit 0; sleep 2; done; exit 1"
psql_on "$L2" "insert into drill_marker select g, 'before-crash' from generate_series(1001,1100) g" >/dev/null
t1=$(date +%s)
docker pause "$L2" >/dev/null
check "crash: $R2 takes over without the frozen leader" "for i in \$(seq 1 90); do [ \"\$(leader_on $R2)\" = $R2 ] && exit 0; sleep 1; done; exit 1"
crash_s=$(( $(date +%s) - t1 ))
check "crash: synchronously committed rows survive" "test \"\$(psql_on $R2 'select count(*) from drill_marker')\" = 1100"
docker unpause "$L2" >/dev/null
check "crash: frozen node rejoins as streaming standby (pg_rewind)" \
  "for i in \$(seq 1 90); do [ \"\$(state_of $R2 $L2)\" = streaming ] && exit 0; sleep 2; done; exit 1"

# Restore drill on the backup node (new full backup first, so the drill includes the marker table).
docker exec -u pgbackrest tn-t-bk1 pgbackrest --stanza=civora backup --type=full >/dev/null
check "restore drill: restore, start, query, verify checksums" \
  "docker exec -u postgres tn-t-bk1 /usr/local/sbin/civora-restore-drill 'select count(*) from drill_marker' | tee $work/drill.json | grep -q '\"query_result\":\"1100\"'"

# Idempotence
"$playbook_bin" -i "$inv" "$here/playbook.yml" > "$work/run2.log" 2>&1 || { tail -40 "$work/run2.log"; exit 1; }
check "second run changes nothing (idempotent)" "grep -E 'changed=' $work/run2.log | grep -vqE 'changed=[1-9]'"

stamp "done (fail=$fail; planned failover ${failover_s}s; crash failover ${crash_s}s)"
[ -f "$work/drill.json" ] && echo "Drill: $(cat "$work/drill.json")"
exit $fail
