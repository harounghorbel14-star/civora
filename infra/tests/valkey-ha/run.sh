#!/usr/bin/env bash
# Valkey high availability (ADR-008): 3 data nodes + 3 Sentinels started with the SAME scripts the Helm chart uses
# (infra/helm/valkey-ha/files). Runs as a non-root UID with a read-only root filesystem, like the chart.
# Checks:
#   1. one primary with 2 replicas;
#   2. the Sentinels agree on it;
#   3. a write confirmed by a replica (WAIT) reaches the replicas;
#   4. the primary is killed → a replica is promoted;
#   5. writes resume; the confirmed write survives;
#   6. the old primary restarts as a replica of the new one.
# Needs docker, python3. Synthetic data; password generated per run.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
files="$(cd "$here/../../helm/valkey-ha/files" && pwd)"
image="${VALKEY_IMAGE:-docker.io/valkey/valkey@sha256:bf09d58e96d6b4524a15396b65b242bbe18beebbcc15a04d8ee75ddac62fae0b}" # 9.1.3-alpine
net=civora-vk-test
nodes="vk-0 vk-1 vk-2"; sentinels="vs-0 vs-1 vs-2"
start=$(date +%s)
stamp() { echo "[$(( $(date +%s) - start ))s] $*"; }
cleanup() { [[ "${KEEP:-0}" == 1 ]] || { for n in $nodes $sentinels; do docker rm -f "$n" >/dev/null 2>&1 || true; done; docker network rm "$net" >/dev/null 2>&1 || true; }; }
trap cleanup EXIT
fail=0
check() { if out=$(eval "$2" 2>&1); then echo "  ok   $1"; else echo "  FAIL $1"; echo "$out" | tail -10 | sed 's/^/       /'; fail=1; fi; }
pw=$(head -c 48 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 32)
secret_dir=$(mktemp -d); chmod 755 "$secret_dir"; printf '%s' "$pw" > "$secret_dir/password"; chmod 644 "$secret_dir/password"

cleanup
docker network create "$net" >/dev/null
run_node() { # name role(valkey|sentinel)
  local script=start-valkey.sh dir=/data
  [[ "$2" == sentinel ]] && { script=start-sentinel.sh; dir=/sentinel; }
  docker run -d --name "$1" --hostname "$1" --network "$net" --user 10999:10999 --read-only \
    --tmpfs "$dir:uid=10999,gid=10999" -v "$files:/scripts:ro" -v "$secret_dir:/secrets:ro" \
    -e ME="${1/vs-/vk-}" -e SENTINEL_ME="$1" -e NODES="$nodes" -e SENTINELS="$sentinels" -e VALKEY_PASSWORD_FILE=/secrets/password \
    --entrypoint sh "$image" "/scripts/$script" >/dev/null
}
for n in $nodes; do run_node "$n" valkey; done
for s in $sentinels; do run_node "$s" sentinel; done
cli() { docker exec "$1" valkey-cli --no-auth-warning -a "$pw" -p "${3:-6379}" $2; }
info_field() { cli "$1" "info replication" | tr -d '\r' | sed -n "s/^$2://p"; }
master_seen_by() { cli "$1" "sentinel get-master-addr-by-name civora" 26379 | head -1 | tr -d '\r'; }
stamp "3 data nodes and 3 Sentinels started (UID 10999, read-only root)"

echo "Checks:"
check "vk-0 is primary with 2 connected replicas" \
  "for i in \$(seq 1 30); do [ \"\$(info_field vk-0 role)\" = master ] && [ \"\$(info_field vk-0 connected_slaves)\" = 2 ] && exit 0; sleep 1; done; exit 1"
check "all 3 Sentinels agree on the primary and see 2 replicas and 2 other Sentinels" \
  "for i in \$(seq 1 30); do ok=1; for s in $sentinels; do [ \"\$(master_seen_by \$s)\" = vk-0 ] || ok=0; [ \"\$(cli \$s 'sentinel replicas civora' 26379 | grep -c '^name\$')\" = 2 ] || ok=0; [ \"\$(cli \$s 'sentinel sentinels civora' 26379 | grep -c '^name\$')\" = 2 ] || ok=0; done; [ \$ok = 1 ] && exit 0; sleep 2; done; exit 1"
check "a write confirmed by at least one replica (WAIT 1) is readable on the replicas" \
  "cli vk-0 'set synthetic:confirmed before-failover' >/dev/null && [ \"\$(cli vk-0 'wait 1 2000' | tr -d '\r')\" -ge 1 ] && for r in vk-1 vk-2; do for i in \$(seq 1 10); do [ \"\$(cli \$r 'get synthetic:confirmed' | tr -d '\r')\" = before-failover ] && break; sleep 0.5; done; [ \"\$(cli \$r 'get synthetic:confirmed' | tr -d '\r')\" = before-failover ] || exit 1; done"

docker kill vk-0 >/dev/null
t_kill=$(date +%s)
check "after the primary is killed, the Sentinels promote a replica" \
  "for i in \$(seq 1 60); do m=\$(master_seen_by vs-1); [ \"\$m\" = vk-1 -o \"\$m\" = vk-2 ] && [ \"\$(info_field \$m role)\" = master ] && echo \$m > /tmp/civora-vk-new && exit 0; sleep 1; done; exit 1"
failover_s=$(( $(date +%s) - t_kill ))
new=$(master_seen_by vs-1)
check "writes accepted by the new primary ($new) once its remaining replica is attached" \
  "for i in \$(seq 1 30); do cli $new 'set synthetic:after after-failover' 2>&1 | grep -q OK && exit 0; sleep 1; done; exit 1"
check "the confirmed write from before the failover is on the new primary" "[ \"\$(cli $new 'get synthetic:confirmed' | tr -d '\r')\" = before-failover ]"
docker start vk-0 >/dev/null
check "the old primary restarts as a replica of the new one (asks the Sentinels first)" \
  "for i in \$(seq 1 40); do [ \"\$(info_field vk-0 role)\" = slave ] && [ \"\$(info_field vk-0 master_host)\" = $new ] && [ \"\$(info_field vk-0 master_link_status)\" = up ] && exit 0; sleep 1; done; exit 1"
check "the new primary has 2 replicas again" "for i in \$(seq 1 30); do [ \"\$(info_field $new connected_slaves)\" = 2 ] && exit 0; sleep 1; done; exit 1"
stamp "done (fail=$fail; failover ${failover_s}s after the primary was killed)"
exit $fail
