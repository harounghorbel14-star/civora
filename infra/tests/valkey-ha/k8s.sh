#!/usr/bin/env bash
# Valkey HA chart (infra/helm/valkey-ha) on a real Kubernetes API (single-node k3s in Docker), ADR-008.
# Closes the open item of R38: the chart's own failover, with cluster DNS and the headless Service, not Docker DNS.
# Namespace with restricted Pod Security; NetworkPolicy enforced (k3s network policy controller).
# Scenarios:
#   A. primary pod deleted (eviction, rolling update, node drain): a replica is promoted; the pod returns as replica;
#   B. primary process killed with SIGKILL (crash; the container restarts in place, DNS record kept): no data loss
#      for a confirmed write, exactly one primary afterwards;
#   C. a client outside the allowed selector cannot reach the cache (NetworkPolicy).
# Needs: docker (privileged), helm. Synthetic data; password generated per run.
set -euo pipefail
root="$(cd "$(dirname "$0")/../../.." && pwd)"
name=civora-valkey-k8s; k3s_image=rancher/k3s:v1.33.4-k3s1; port=16446
ns=cache; rel=vk; work="$(mktemp -d)"; start=$(date +%s)
stamp() { echo "[$(( $(date +%s) - start ))s] $*"; }
cleanup() { [[ "${KEEP:-0}" == 1 ]] || docker rm -f "$name" >/dev/null 2>&1 || true; rm -rf "$work"; }
trap cleanup EXIT
fail=0
check() { if out=$( (eval "$2") 2>&1); then echo "  ok   $1"; else echo "  FAIL $1"; echo "$out" | tail -10 | sed 's/^/       /'; fail=1; fi; }
docker rm -f "$name" >/dev/null 2>&1 || true
docker run -d --name "$name" --privileged --tmpfs /run --tmpfs /var/run -p "127.0.0.1:$port:6443" -e K3S_KUBECONFIG_MODE=644 \
  "$k3s_image" server --disable=traefik --disable=metrics-server --tls-san=127.0.0.1 >/dev/null
kc() { docker exec -i "$name" kubectl "$@"; }
# Bounded waits: if k3s does not come up, fail with its log instead of hanging until the job is killed (nightly run 18
# hung here for the whole 25-minute job limit with no output).
k3s_up() { for _ in $(seq 1 90); do eval "$1" >/dev/null 2>&1 && return 0; sleep 2; done
  echo "  FAIL k3s did not become ready within 180 s ($2)"; docker logs --tail 40 "$name" 2>&1 | sed 's/^/       /'; exit 1; }
k3s_up 'kc get --raw /readyz' "API server"
k3s_up 'kc get nodes -o name | grep -q node' "node registration"
kc wait --for=condition=Ready node --all --timeout=180s >/dev/null
docker exec "$name" cat /etc/rancher/k3s/k3s.yaml | sed "s#https://127.0.0.1:6443#https://127.0.0.1:$port#" > "$work/kubeconfig"
export KUBECONFIG="$work/kubeconfig" NO_PROXY="${NO_PROXY:+$NO_PROXY,}127.0.0.1,localhost" no_proxy="${no_proxy:+$no_proxy,}127.0.0.1,localhost"
stamp "k3s ready"

pw=$(head -c 48 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 32)
for n in "$ns" client other; do kc create namespace "$n" >/dev/null; kc label namespace "$n" pod-security.kubernetes.io/enforce=restricted >/dev/null; done
kc -n "$ns" create secret generic valkey-ha-auth --from-literal=password="$pw" >/dev/null
helm install "$rel" "$root/infra/helm/valkey-ha" -n "$ns" --set storage.size=1Gi \
  --set 'networkPolicy.clients[0].namespace=client' --set 'networkPolicy.clients[0].podSelector.app=cache-client' >/dev/null
kc -n "$ns" rollout status statefulset/"$rel" --timeout=420s >/dev/null || { kc -n "$ns" get pods -o wide; kc -n "$ns" describe pods | tail -40; exit 1; }
stamp "chart installed: 3 data nodes + 3 Sentinels ready (restricted Pod Security)"

# Test clients: one allowed by the NetworkPolicy, one not. Same image, non-root, read-only root.
img=$(helm template "$rel" "$root/infra/helm/valkey-ha" -n "$ns" --kube-version 1.33.4 | sed -n 's/^ *image: "\(.*\)"$/\1/p' | head -1)
for c in client:cache-client other:intruder; do
  kc -n "${c%%:*}" run "${c##*:}" --image="$img" --labels="app=${c##*:}" --restart=Never \
    --overrides='{"spec":{"securityContext":{"runAsNonRoot":true,"runAsUser":10999,"seccompProfile":{"type":"RuntimeDefault"}},"containers":[{"name":"c","image":"'"$img"'","command":["sleep","3600"],"securityContext":{"allowPrivilegeEscalation":false,"readOnlyRootFilesystem":true,"capabilities":{"drop":["ALL"]}}}]}}' >/dev/null
done
kc -n client wait --for=condition=Ready pod/cache-client --timeout=120s >/dev/null
kc -n other wait --for=condition=Ready pod/intruder --timeout=120s >/dev/null
host() { echo "$rel-$1.$rel-headless.$ns.svc.cluster.local"; }
cli() { kc -n client exec cache-client -- valkey-cli --no-auth-warning -a "$pw" -h "$1" -p "${3:-6379}" $2 2>&1 | tr -d '\r'; }
sentinel_primary() { cli "$rel-sentinel.$ns.svc.cluster.local" "sentinel get-master-addr-by-name civora" 26379 | head -1; }
role_of() { cli "$(host "$1")" "info replication" | sed -n 's/^role://p'; }
online_replicas() { cli "$(host "$1")" "info replication" | grep -c 'state=online' || true; }
primaries() { local n=0; for i in 0 1 2; do [ "$(role_of $i)" = master ] && n=$((n+1)); done; echo $n; }
idx_of() { echo "$1" | sed -n "s/^$rel-\([0-9]\)\..*/\1/p"; }

echo "Checks:"
check "pod 0 is primary with 2 replicas in sync" "for i in \$(seq 1 60); do [ \"\$(role_of 0)\" = master ] && [ \"\$(online_replicas 0)\" = 2 ] && exit 0; sleep 2; done; exit 1"
check "Sentinels (via the Service) report pod 0 as primary" "for i in \$(seq 1 30); do [ \"\$(sentinel_primary)\" = \"$(host 0)\" ] && exit 0; sleep 2; done; exit 1"
# The intruder even knows the password: only the network policy stops it. The allowed client is the control.
check "NetworkPolicy: allowed client gets PONG (control)" "[ \"\$(cli $(host 0) ping)\" = PONG ]"
check "NetworkPolicy: a pod outside the allowed selector cannot connect, even with the password" \
  "out=\$(kc -n other exec intruder -- timeout 5 valkey-cli --no-auth-warning -a '$pw' -h $(host 0) -p 6379 ping 2>&1 || true); echo \"\$out\"; ! echo \"\$out\" | grep -q PONG"

# A. Primary pod deleted.
check "A: write confirmed by a replica before the deletion (WAIT 1)" \
  "[ \"\$(cli $(host 0) 'set synthetic:a before-delete')\" = OK ] && [ \"\$(cli $(host 0) 'wait 1 2000')\" -ge 1 ]"
t0=$(date +%s); kc -n "$ns" delete pod "$rel-0" --wait=false >/dev/null
check "A: Sentinels promote a replica after the primary pod is deleted" \
  "for i in \$(seq 1 90); do p=\$(sentinel_primary); case \"\$p\" in *-1.*|*-2.*) [ \"\$(role_of \$(idx_of \$p))\" = master ] && exit 0;; esac; sleep 1; done; exit 1"
a_s=$(( $(date +%s) - t0 ))
newA=$(idx_of "$(sentinel_primary)")
check "A: the confirmed write is on the new primary (pod $newA)" "[ \"\$(cli \$(host $newA) 'get synthetic:a')\" = before-delete ]"
check "A: writes accepted by the new primary" "for i in \$(seq 1 30); do [ \"\$(cli \$(host $newA) 'set synthetic:a2 after')\" = OK ] && exit 0; sleep 1; done; exit 1"
check "A: the recreated pod 0 rejoins as a replica; exactly one primary" \
  "kc -n $ns wait --for=condition=Ready pod/$rel-0 --timeout=180s >/dev/null && for i in \$(seq 1 60); do [ \"\$(role_of 0)\" = slave ] && [ \"\$(online_replicas $newA)\" = 2 ] && [ \"\$(primaries)\" = 1 ] && exit 0; sleep 2; done; exit 1"
stamp "A: failover ${a_s}s after the delete"

# B. Primary process killed (SIGKILL from the node; container restarts in place, pod and DNS record stay).
check "B: write confirmed by a replica before the crash (WAIT 1)" \
  "[ \"\$(cli \$(host $newA) 'set synthetic:b before-crash')\" = OK ] && [ \"\$(cli \$(host $newA) 'wait 1 2000')\" -ge 1 ]"
cid=$(kc -n "$ns" get pod "$rel-$newA" -o jsonpath='{.status.containerStatuses[?(@.name=="valkey")].containerID}' | sed 's#containerd://##')
pid=$(docker exec "$name" crictl inspect --output go-template --template '{{.info.pid}}' "$cid")
t1=$(date +%s); docker exec "$name" kill -9 "$pid"
check "B: after the crash there is exactly one primary, recognised by the Sentinels" \
  "sleep 3; for i in \$(seq 1 90); do p=\$(sentinel_primary); j=\$(idx_of \$p); [ -n \"\$j\" ] && [ \"\$(role_of \$j)\" = master ] && [ \"\$(primaries)\" = 1 ] && exit 0; sleep 1; done; exit 1"
b_s=$(( $(date +%s) - t1 ))
newB=$(idx_of "$(sentinel_primary)")
check "B: the confirmed write survived (primary now pod $newB)" "[ \"\$(cli \$(host $newB) 'get synthetic:b')\" = before-crash ]"
check "B: all three data nodes back; 2 replicas in sync" "for i in \$(seq 1 60); do [ \"\$(online_replicas $newB)\" = 2 ] && exit 0; sleep 2; done; exit 1"
restarts=$(kc -n "$ns" get pod "$rel-$newA" -o jsonpath='{.status.containerStatuses[?(@.name=="valkey")].restartCount}')
stamp "B: stable ${b_s}s after the crash (primary pod $newA -> $newB; container restarts: $restarts)"
[[ $fail == 0 ]] || { kc -n "$ns" get pods -o wide; for i in 0 1 2; do echo "--- sentinel $i"; kc -n "$ns" logs "$rel-$i" -c sentinel --tail=20; done; }
stamp "done (fail=$fail; pod deletion: failover ${a_s}s; process crash: stable after ${b_s}s)"
exit $fail
