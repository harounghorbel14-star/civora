#!/usr/bin/env bash
# Server-side validation of every Kubernetes manifest against a real k3s API server (no workloads run).
# Used where nested containers cannot run (sandboxes, some CI runners). The full rehearsal is deploy-from-scratch.sh.
# Checks: helm lint; schema + admission (Pod Security "restricted") via kubectl apply --dry-run=server;
#         negative control (a privileged pod must be rejected).
set -euo pipefail
root="$(cd "$(dirname "$0")/../.." && pwd)"
name=civora-k3s-validate
k3s_image=rancher/k3s:v1.33.4-k3s1
docker rm -f "$name" >/dev/null 2>&1 || true
trap 'docker rm -f "$name" >/dev/null 2>&1 || true' EXIT
docker run -d --name "$name" --privileged --tmpfs /run --tmpfs /var/run "$k3s_image" server --disable=traefik --disable=metrics-server >/dev/null
K() { docker exec -i "$name" kubectl "$@"; }
until K get --raw /readyz >/dev/null 2>&1; do sleep 2; done
until K get serviceaccount default -n default >/dev/null 2>&1; do sleep 1; done
ns=civora-validate
K create ns "$ns" >/dev/null
K label ns "$ns" pod-security.kubernetes.io/enforce=restricted pod-security.kubernetes.io/warn=restricted >/dev/null
fail=0
run() { if out=$("$@" 2>&1); then echo "  ok   ${label}"; else echo "  FAIL ${label}"; echo "$out" | sed 's/^/       /'; fail=1; fi; }
echo "Manifest validation (k3s $k3s_image, Pod Security restricted):"
label="helm lint (local, staging)"; run bash -c "helm lint '$root/infra/helm/civora-core' -f '$root/infra/helm/civora-core/values-local.yaml' >/dev/null && helm lint '$root/infra/helm/civora-core' -f '$root/infra/helm/civora-core/values-staging.yaml' >/dev/null"
fake_digest="sha256:$(printf '0%.0s' {1..64})"   # staging/pilot/prod require a digest (ADR-027)
label="chart refuses staging without an image digest"; run bash -c "! helm template x '$root/infra/helm/civora-core' -f '$root/infra/helm/civora-core/values-staging.yaml' >/dev/null 2>&1"
for v in local staging; do
  digest_arg=""
  [[ "$v" != "local" ]] && digest_arg="--set image.digest=$fake_digest"
  label="chart values-$v: server dry-run"
  run bash -c "helm template civora-core '$root/infra/helm/civora-core' --kube-version 1.33.4 -n $ns -f '$root/infra/helm/civora-core/values-$v.yaml' $digest_arg | docker exec -i $name kubectl -n $ns apply --dry-run=server -f - | grep -v Warning"
done
label="infra/k8s/local/pg-core.yaml: server dry-run"; run bash -c "docker exec -i $name kubectl -n $ns apply --dry-run=server -f - < '$root/infra/k8s/local/pg-core.yaml'"
argocd_version=v3.4.13   # keep in step with infra/ansible/roles/argocd_bootstrap/defaults/main.yml
label="Argo CD $argocd_version CRDs installed"
run bash -c "for c in application appproject; do curl -fsSL https://raw.githubusercontent.com/argoproj/argo-cd/$argocd_version/manifests/crds/\$c-crd.yaml | docker exec -i $name kubectl apply --server-side -f - ; done && docker exec $name kubectl create ns argocd"
for f in "$root"/infra/argocd/*.yaml "$root"/infra/argocd/apps/*.yaml; do
  [[ -f "$f" ]] || continue
  label="argocd/$(basename "$f"): server dry-run against the CRD schema"; run bash -c "docker exec -i $name kubectl apply --dry-run=server -f - < '$f'"
done
label="negative control: privileged pod rejected"
run bash -c "! printf 'apiVersion: v1\nkind: Pod\nmetadata: {name: bad}\nspec:\n  containers: [{name: x, image: busybox, securityContext: {privileged: true}}]\n' | docker exec -i $name kubectl -n $ns apply --dry-run=server -f -"
exit $fail
