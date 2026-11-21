#!/usr/bin/env bash
# Deploy-from-scratch rehearsal (O-T3) on a throw-away single-node k3s cluster in Docker.
# Measures the time from "nothing exists" to "smoke tests pass" for the parts of the staging cell
# that do not depend on a hosting provider: cluster, database, migrations, application, network policy.
#
# What it does NOT cover (provider not selected, Phase 1 E-07): VM provisioning (OpenTofu provider layer),
# OS hardening (Ansible), DNS/TLS, PostgreSQL on database nodes (Patroni + pgBackRest), OpenBao HA,
# observability stack, backups.
# The staging acceptance criterion (< 2 h) needs those; see docs/phase-2/16-infrastructure-plan.md §16.7.
#
# Usage: infra/scripts/deploy-from-scratch.sh [--keep]
#   Needs: docker (privileged containers), helm >= 3.18. The civora-core:dev image must exist (dev-cell-up.sh builds it).
set -euo pipefail
root="$(cd "$(dirname "$0")/../.." && pwd)"
name=civora-k3s-rehearsal
k3s_image=rancher/k3s:v1.33.4-k3s1
port=16443
work="$(mktemp -d)"
start=$(date +%s)
stamp() { echo "[$(( $(date +%s) - start ))s] $*"; }
cleanup() { if [[ "${KEEP:-0}" != "1" ]]; then docker rm -f "$name" >/dev/null 2>&1 || true; fi; }
[[ "${1:-}" == "--keep" ]] && KEEP=1
trap cleanup EXIT
docker rm -f "$name" >/dev/null 2>&1 || true

# 1. Cluster. Air-gapped by design (as a bank on-premises install would be): the node pulls nothing;
#    every image is pulled once by the host and imported into the node's containerd.
system_images=(rancher/mirrored-pause:3.6 rancher/mirrored-coredns-coredns:1.12.3 rancher/local-path-provisioner:v0.0.31 rancher/mirrored-library-busybox:1.36.1)
app_images=(civora-core:dev postgres:16-alpine)
for i in "${system_images[@]}" postgres:16-alpine "$k3s_image"; do docker image inspect "$i" >/dev/null 2>&1 || docker pull -q "$i" >/dev/null; done
docker save "${system_images[@]}" "${app_images[@]}" -o "$work/images.tar"
stamp "starting k3s ($k3s_image)"
docker run -d --name "$name" --privileged --tmpfs /run --tmpfs /var/run \
  -p "127.0.0.1:$port:6443" -e K3S_KUBECONFIG_MODE=644 -v "$work/images.tar:/var/lib/rancher/k3s/agent/images/civora-images.tar:ro" \
  "$k3s_image" server --disable=traefik --disable=metrics-server --tls-san=127.0.0.1 >/dev/null
kc() { docker exec -i "$name" kubectl "$@"; }
for _ in $(seq 1 90); do kc get --raw /readyz >/dev/null 2>&1 && break; sleep 2; done; kc get --raw /readyz >/dev/null 2>&1  # bounded wait: fails instead of hanging
for _ in $(seq 1 90); do kc get nodes -o name 2>/dev/null | grep -q node && break; sleep 2; done; kc get nodes -o name 2>/dev/null | grep -q node  # bounded wait: fails instead of hanging
kc wait --for=condition=Ready node --all --timeout=180s >/dev/null
docker exec "$name" cat /etc/rancher/k3s/k3s.yaml | sed "s#https://127.0.0.1:6443#https://127.0.0.1:$port#" > "$work/kubeconfig"
export KUBECONFIG="$work/kubeconfig" NO_PROXY="${NO_PROXY:+$NO_PROXY,}127.0.0.1,localhost" no_proxy="${no_proxy:+$no_proxy,}127.0.0.1,localhost"
stamp "cluster ready"

# 2. Images: k3s imports every tarball in agent/images at start-up (air-gap mode).
for _ in $(seq 1 90); do docker exec "$name" ctr -n k8s.io images ls -q 2>/dev/null | grep -q civora-core && break; sleep 2; done; docker exec "$name" ctr -n k8s.io images ls -q 2>/dev/null | grep -q civora-core  # bounded wait: fails instead of hanging
stamp "images imported"

# 3. Namespace, secrets (random, generated here, never written to the repository), database
ns=civora-tn
kc create namespace "$ns" >/dev/null
kc create namespace civora-smoke >/dev/null
kc label namespace "$ns" pod-security.kubernetes.io/enforce=restricted >/dev/null
pw="$(head -c 24 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 24)"
kc -n "$ns" create secret generic pg-core-superuser --from-literal=password="$pw" >/dev/null
kc -n "$ns" create secret generic civora-core-db --from-literal=DATABASE_URL="postgres://civora_core:$pw@pg-core:5432/civora_core" >/dev/null
kc -n "$ns" apply -f - < "$root/infra/k8s/local/pg-core.yaml" >/dev/null
kc -n "$ns" rollout status statefulset/pg-core --timeout=300s >/dev/null || { kc -n "$ns" describe pod pg-core-0 | tail -20; kc -n "$ns" logs pg-core-0 --tail=20; exit 1; }
stamp "database ready"

# 4. Application (migration Job runs as a pre-install hook)
helm upgrade --install civora-core "$root/infra/helm/civora-core" -n "$ns" \
  -f "$root/infra/helm/civora-core/values-local.yaml" --wait --timeout 5m >/dev/null
stamp "civora-core deployed"

# 5. Smoke tests from an allowed namespace and from a denied one (network policy enforcement)
fail=0
probe() { # namespace path
  kc -n "$1" run "probe-$RANDOM" --rm -i --restart=Never --image=postgres:16-alpine --image-pull-policy=IfNotPresent \
    --overrides='{"spec":{"securityContext":{"runAsNonRoot":true,"runAsUser":70,"seccompProfile":{"type":"RuntimeDefault"}},"containers":[{"name":"p","image":"postgres:16-alpine","imagePullPolicy":"IfNotPresent","command":["wget","-qO-","-T","5","http://civora-core.'"$ns"'.svc'"$2"'"],"securityContext":{"allowPrivilegeEscalation":false,"capabilities":{"drop":["ALL"]}}}]}}' 2>/dev/null
}
check() { if ( eval "$2" ) >/dev/null 2>&1; then   # subshell: an "exit" inside a check must not end the script
  echo "  ok   $1"; else echo "  FAIL $1"; fail=1; fi; }
echo "Smoke tests:"
check "health: database up (from allowed namespace)" "probe civora-smoke /health | grep -q '\"database\":\"up\"'"
check "locales: ar-TN is rtl"                        "probe civora-smoke /v1/meta/locales | grep -q '\"dir\":\"rtl\"'"
check "network policy blocks other namespaces"       "! probe default /health"
check "base schemas migrated"                        "kc -n $ns exec pg-core-0 -- psql -U civora_core -d civora_core -Atc \"select count(*) from pg_namespace where nspname in ('iam','config','audit')\" | grep -qx 3"
check "2 replicas ready, non-root, read-only rootfs" "kc -n $ns get deploy civora-core -o jsonpath='{.status.readyReplicas}' | grep -qx 2 && kc -n $ns get deploy civora-core -o jsonpath='{.spec.template.spec.containers[0].securityContext.readOnlyRootFilesystem}' | grep -qx true"
check "restricted pod security admission"           "kc get ns $ns -o jsonpath='{.metadata.labels.pod-security\\.kubernetes\\.io/enforce}' | grep -qx restricted"

# 6. Upgrade path: a second release runs the migration hook again (idempotent) and rolls without downtime
helm upgrade civora-core "$root/infra/helm/civora-core" -n "$ns" -f "$root/infra/helm/civora-core/values-local.yaml" \
  --set podAnnotations.rehearsal=upgrade --wait --timeout 5m >/dev/null && echo "  ok   upgrade with migration hook" || { echo "  FAIL upgrade"; fail=1; }

stamp "done (fail=$fail)"
echo "Deploy-from-scratch rehearsal: $(( $(date +%s) - start )) s"
exit $fail
