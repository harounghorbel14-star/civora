#!/usr/bin/env bash
# Experiment (not part of the pass/fail suite): does Patroni refuse to promote a standby that is not the designated
# synchronous standby when the leader fails? Run after `KEEP=1 run.sh` (containers kept, cluster healthy).
#   1. restart Patroni on the synchronous standby, so for a moment no synchronous standby is designated;
#   2. as soon as /sync shows none, freeze the leader;
#   3. observe for 120 s whether the standby is promoted;
#   4. MANUAL_RECOVERY=1 (default): the operator path of the runbook (docs/phase-2/runbooks/database-operations.md
#      §4) — disable synchronous mode while the leader is still down, observe the promotion, count the rows that were
#      acknowledged by the old leader but are missing on the new one, then unfreeze, rejoin and re-enable;
#      MANUAL_RECOVERY=0: unfreeze and observe recovery only.
# Prints a timeline. Reads cluster state over the REST API without certificate verification (local experiment only).
set -euo pipefail
declare -A ip=([tn-t-db1]=172.31.240.11 [tn-t-db2]=172.31.240.12)
cluster() { curl -sk --noproxy '*' --max-time 3 "https://${ip[$1]}:8008/cluster" || true; }
# Tolerant probe: an API that is restarting or frozen returns nothing, which counts as "unknown" (empty).
field() { python3 -c "
import json,sys
try:
    d=json.load(sys.stdin); print(next((m['name'] for m in d['members'] if m['role']=='$1'),''))
except Exception:
    print('')" || true; }
L=$(cluster tn-t-db1 | field leader); S=$(cluster tn-t-db1 | field sync_standby)
[[ -n "$L" && -n "$S" ]] || { echo "cluster not in steady state (leader=$L sync=$S)"; exit 2; }
echo "start: leader=$L sync_standby=$S"
t0=$(date +%s)
sql() { docker exec -u postgres "$1" psql -h /var/run/postgresql -d postgres -qAtc "$2"; }
sql "$L" "create table if not exists r210(id int primary key, at timestamptz default clock_timestamp())"
docker exec "$S" systemctl restart patroni
for _ in $(seq 1 100); do
  [ -z "$(cluster "$L" | field sync_standby)" ] && break
  sleep 0.2
done
# Writes the old leader acknowledges while no synchronous standby is designated (asynchronous for this window).
sql "$L" "insert into r210(id) select g from generate_series(1,50) g on conflict do nothing"
echo "[$(( $(date +%s) - t0 ))s] no synchronous standby designated; 50 rows acknowledged by $L; freezing leader $L"
docker pause "$L" >/dev/null
promoted=no
for i in $(seq 1 120); do
  now=$(cluster "$S" | field leader)
  if [ "$now" = "$S" ]; then promoted=yes; echo "[$(( $(date +%s) - t0 ))s] $S promoted"; break; fi
  sleep 1
done
[ "$promoted" = no ] && echo "[$(( $(date +%s) - t0 ))s] $S NOT promoted within 120 s (leader frozen, standby not designated synchronous)"
docker exec "$S" journalctl -u patroni --no-pager --since "-150s" | grep -E "INFO: (following|no action|promoted|cleared|Lock owner)|healthiest|synchronous" | tail -6 | cut -c1-200
manual=no; lost=n/a
if [[ "${MANUAL_RECOVERY:-1}" == 1 && "$promoted" == no ]]; then
  t1=$(date +%s)
  echo "[$(( t1 - t0 ))s] operator: disable synchronous mode (accepting possible loss of the writes above)"
  docker exec "$S" timeout 30 patronictl -c /etc/patroni/config.yml edit-config --force -s synchronous_mode=false >/dev/null
  for i in $(seq 1 90); do
    [ "$(cluster "$S" | field leader)" = "$S" ] && { manual=yes; echo "[$(( $(date +%s) - t0 ))s] $S promoted $(( $(date +%s) - t1 ))s after the operator action"; break; }
    sleep 1
  done
  if [ "$manual" = yes ]; then
    for i in $(seq 1 30); do [ "$(sql "$S" 'select pg_is_in_recovery()')" = f ] && break; sleep 1; done
    have=$(sql "$S" "select count(*) from r210" 2>/dev/null || echo 0)
    lost=$(( 50 - have ))
    echo "acknowledged by the old leader: 50; present on the new leader: $have; lost: $lost"
  fi
fi
docker unpause "$L" >/dev/null
if [[ "$manual" == yes ]]; then
  for i in $(seq 1 90); do
    st=$(cluster "$S" | python3 -c 'import json,sys;print(" ".join(m["name"]+":"+m["role"]+":"+m["state"] for m in json.load(sys.stdin)["members"]))' 2>/dev/null || true)
    echo "$st" | grep -q "$L:replica:streaming" && { echo "[$(( $(date +%s) - t0 ))s] old leader rejoined: $st"; break; }
    sleep 2
  done
  docker exec "$S" timeout 30 patronictl -c /etc/patroni/config.yml edit-config --force -s synchronous_mode=true >/dev/null
  echo "[$(( $(date +%s) - t0 ))s] operator: synchronous mode re-enabled"
fi
for i in $(seq 1 60); do
  st=$(cluster "$S" | python3 -c 'import json,sys;print(" ".join(m["name"]+":"+m["role"]+":"+m["state"] for m in json.load(sys.stdin)["members"]))' 2>/dev/null || true)
  echo "$st" | grep -q "sync_standby:streaming" && { echo "[$(( $(date +%s) - t0 ))s] recovered: $st"; break; }
  sleep 2
done
echo "result: promoted_without_sync_standby=$promoted manual_recovery_promoted=$manual acknowledged_rows_lost=$lost"
