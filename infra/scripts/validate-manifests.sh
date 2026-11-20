#!/usr/bin/env bash
# Server-side validation of every Kubernetes manifest against a real k3s API server (no workloads run).
# Used where nested containers cannot run (sandboxes, some CI runners). The full rehearsal is deploy-from-scratch.sh.
# Checks: helm lint; schema + admission (Pod Security "restricted") via kubectl apply --dry-run=server;
#         image admission policy (registry + digest, ADR-027); negative control (a privileged pod must be rejected).
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
# Pod Security Admission enforces on Pods only; for Deployments, StatefulSets and Jobs it only warns. A dry-run of a
# chart therefore passes even when its pods would be refused at runtime, unless the warnings are checked: they are.
psa_apply() {  # $1 = namespace (labelled enforce+warn=restricted); manifests on stdin
  local out; out=$(docker exec -i "$name" kubectl -n "$1" apply --dry-run=server -f - 2>&1) || { echo "$out"; return 1; }
  if grep -q "would violate PodSecurity" <<<"$out"; then grep "would violate PodSecurity" <<<"$out"; return 1; fi
}
export -f psa_apply; export name
echo "Manifest validation (k3s $k3s_image, Pod Security restricted):"
label="helm lint (local, staging)"; run bash -c "helm lint '$root/infra/helm/civora-core' -f '$root/infra/helm/civora-core/values-local.yaml' >/dev/null && helm lint '$root/infra/helm/civora-core' -f '$root/infra/helm/civora-core/values-staging.yaml' >/dev/null"
fake_digest="sha256:$(printf '0%.0s' {1..64})"   # staging/pilot/prod require a digest (ADR-027)
label="chart refuses staging without an image digest"; run bash -c "! helm template x '$root/infra/helm/civora-core' -f '$root/infra/helm/civora-core/values-staging.yaml' >/dev/null 2>&1"
for v in local staging; do
  digest_arg=""
  [[ "$v" != "local" ]] && digest_arg="--set image.digest=$fake_digest"
  label="chart values-$v: server dry-run"
  run bash -c "helm template civora-core '$root/infra/helm/civora-core' --kube-version 1.33.4 -n $ns -f '$root/infra/helm/civora-core/values-$v.yaml' $digest_arg | psa_apply $ns"
done
label="infra/k8s/local/pg-core.yaml: server dry-run"; run bash -c "docker exec -i $name kubectl -n $ns apply --dry-run=server -f - < '$root/infra/k8s/local/pg-core.yaml'"
argocd_version=v3.4.13   # keep in step with infra/ansible/roles/argocd_bootstrap/defaults/main.yml
label="Argo CD $argocd_version CRDs installed"
run bash -c "for c in application appproject; do curl -fsSL https://raw.githubusercontent.com/argoproj/argo-cd/$argocd_version/manifests/crds/\$c-crd.yaml | docker exec -i $name kubectl apply --server-side -f - ; done && docker exec $name kubectl create ns argocd"
for f in "$root"/infra/argocd/*.yaml "$root"/infra/argocd/apps/*.yaml; do
  [[ -f "$f" ]] || continue
  label="argocd/$(basename "$f"): server dry-run against the CRD schema"; run bash -c "docker exec -i $name kubectl apply --dry-run=server -f - < '$f'"
done
label="pg-router chart refuses to render without database nodes"; run bash -c "! helm template pg-router '$root/infra/helm/pg-router' >/dev/null 2>&1"
label="pg-router chart (values-staging): lint + server dry-run (restricted)"
run bash -c "helm lint '$root/infra/helm/pg-router' -f '$root/infra/helm/pg-router/values-staging.yaml' >/dev/null && helm template pg-router '$root/infra/helm/pg-router' --kube-version 1.33.4 -n $ns -f '$root/infra/helm/pg-router/values-staging.yaml' | psa_apply $ns"

# Image admission policy (ADR-027): allowed registry + digest, in namespaces labelled civora.tn/image-policy=enforced.
pol_ns=civora-policy-test
digest="sha256:$(printf 'a%.0s' {1..64})"
good="registry.staging.civora.invalid/civora/core@$digest"
export pol_ns name   # used by the helper functions inside "run bash -c"
pod() {  # $1 = main image, $2 = optional init image
  printf 'apiVersion: v1\nkind: Pod\nmetadata: {name: p, namespace: %s}\nspec:\n' "$pol_ns"
  [[ -n "${2:-}" ]] && printf '  initContainers: [{name: i, image: "%s"}]\n' "$2"
  printf '  containers: [{name: c, image: "%s"}]\n' "$1"
}
cronjob() { printf 'apiVersion: batch/v1\nkind: CronJob\nmetadata: {name: cj, namespace: %s}\nspec:\n  schedule: "0 1 * * *"\n  jobTemplate: {spec: {template: {spec: {restartPolicy: Never, containers: [{name: c, image: "%s"}]}}}}\n' "$pol_ns" "$1"; }
dry() { docker exec -i $name kubectl apply --dry-run=server -f - 2>&1; }
label="image policy installed with cell parameters"
run bash -c "docker exec -i $name kubectl apply -f - < '$root/infra/k8s/policies/image-admission.yaml' >/dev/null && docker exec $name kubectl create ns civora-system >/dev/null && docker exec -i $name kubectl apply -f - < '$root/infra/k8s/policies/image-policy-params.example.yaml' >/dev/null && docker exec $name kubectl create ns $pol_ns >/dev/null && docker exec $name kubectl label ns $pol_ns civora.tn/image-policy=enforced >/dev/null"
# Policies take effect asynchronously: wait until a known-bad pod is denied (max 60 s).
for _ in $(seq 1 30); do pod docker.io/library/busybox | dry | grep -q 'denied' && break; sleep 2; done
label="image policy: pinned image from the cell registry allowed"; run bash -c "$(declare -f pod dry); pod '$good' | dry"
label="image policy: chart (staging values, digest) allowed"
run bash -c "helm template civora-core '$root/infra/helm/civora-core' --kube-version 1.33.4 -n $pol_ns -f '$root/infra/helm/civora-core/values-staging.yaml' --set image.digest=$digest -s templates/deployment.yaml | docker exec -i $name kubectl -n $pol_ns apply --dry-run=server -f -"
label="image policy: pg-router (staging values, mirrored by digest) allowed"
run bash -c "helm template pg-router '$root/infra/helm/pg-router' --kube-version 1.33.4 -n $pol_ns -f '$root/infra/helm/pg-router/values-staging.yaml' -s templates/deployment.yaml | docker exec -i $name kubectl -n $pol_ns apply --dry-run=server -f -"
label="image policy: pg-router with default values (Docker Hub) denied"
run bash -c "helm template pg-router '$root/infra/helm/pg-router' --kube-version 1.33.4 -n $pol_ns --set 'servers[0].name=a' --set 'servers[0].address=192.0.2.1' -s templates/deployment.yaml | docker exec -i $name kubectl -n $pol_ns apply --dry-run=server -f - 2>&1 | grep -q 'registry not allowed'"
label="image policy: Docker Hub image denied"; run bash -c "$(declare -f pod dry); pod docker.io/library/busybox@$digest | dry | grep -q 'registry not allowed'"
label="image policy: tag without digest denied"; run bash -c "$(declare -f pod dry); pod registry.staging.civora.invalid/civora/core:1.0.0 | dry | grep -q 'pinned by digest'"
label="image policy: look-alike registry prefix denied"; run bash -c "$(declare -f pod dry); pod registry.staging.civora.invalid.evil.example/civora/core@$digest | dry | grep -q 'registry not allowed'"
label="image policy: bad init container denied"; run bash -c "$(declare -f pod dry); pod '$good' docker.io/library/busybox@$digest | dry | grep -q 'registry not allowed'"
label="image policy: CronJob with unpinned image denied"; run bash -c "$(declare -f cronjob dry); cronjob registry.staging.civora.invalid/civora/core:latest | dry | grep -q 'pinned by digest'"
label="image policy: missing cell parameters deny (fail closed)"
run bash -c "docker exec $name kubectl -n civora-system delete configmap civora-image-policy >/dev/null && sleep 3 && $(declare -f pod dry); pod '$good' | dry | grep -qi 'denied'"
label="image policy: namespaces without the label unaffected"; run bash -c "$(declare -f pod dry); pod docker.io/library/busybox | sed 's/namespace: $pol_ns/namespace: default/' | dry"

# Platform services (infra/argocd/platform): render the pinned chart tags from their Git sources with our values and
# dry-run them under restricted Pod Security. cert-manager's chart is generated at release time (not renderable from
# Git); its Application object is validated with the others below.
up="$(mktemp -d)"
label="platform charts fetched at the pinned tags (OpenBao openbao-0.30.7, External Secrets helm-chart-2.14.0)"
run bash -c "git clone -q --depth 1 --branch openbao-0.30.7 https://github.com/openbao/openbao-helm.git '$up/openbao' \
  && git -c advice.detachedHead=false clone -q --depth 1 --filter=blob:none --sparse --branch helm-chart-2.14.0 https://github.com/external-secrets/external-secrets.git '$up/eso' \
  && git -C '$up/eso' sparse-checkout set deploy/charts/external-secrets \
  && sed -i '/^dependencies:/,/condition:/d' '$up/eso/deploy/charts/external-secrets/Chart.yaml'"   # optional Bitwarden subchart, disabled
for p in openbao external-secrets; do docker exec $name kubectl create ns $p >/dev/null 2>&1; docker exec $name kubectl label ns $p pod-security.kubernetes.io/enforce=restricted pod-security.kubernetes.io/warn=restricted >/dev/null 2>&1; done
label="OpenBao (3 replicas, Raft, TLS): server dry-run under restricted Pod Security"
run bash -c "helm template openbao '$up/openbao/charts/openbao' -n openbao --kube-version 1.33.4 --no-hooks -f '$root/infra/argocd/platform/values/openbao.yaml' | psa_apply openbao"
label="control: OpenBao with the chart's default security settings is rejected by restricted Pod Security"
run bash -c "! helm template openbao '$up/openbao/charts/openbao' -n openbao --kube-version 1.33.4 --no-hooks --set server.ha.enabled=true --set injector.enabled=false | psa_apply openbao"
label="OpenBao rendered as 3-replica StatefulSet with TLS listener and no injector"
run bash -c "helm template openbao '$up/openbao/charts/openbao' -n openbao --kube-version 1.33.4 --no-hooks -f '$root/infra/argocd/platform/values/openbao.yaml' > '$up/openbao.yaml' && grep -q 'replicas: 3' '$up/openbao.yaml' && grep -q 'tls_cert_file' '$up/openbao.yaml' && ! grep -q 'agent-injector' '$up/openbao.yaml'"
label="External Secrets (CRDs, controller, webhook, cert controller): server dry-run under restricted Pod Security"
run bash -c "helm template external-secrets '$up/eso/deploy/charts/external-secrets' -n external-secrets --kube-version 1.33.4 --no-hooks -f '$root/infra/argocd/platform/values/external-secrets.yaml' | psa_apply external-secrets"
for f in "$root"/infra/argocd/platform/*.yaml "$root"/infra/argocd/platform/staging-tn/*.yaml; do
  label="argocd/platform/$(basename "$f"): server dry-run against the CRD schema"; run bash -c "docker exec -i $name kubectl apply --dry-run=server -f - < '$f'"
done
rm -rf "$up"

label="negative control: a Deployment whose pods would violate restricted Pod Security fails the check"
run bash -c "! printf 'apiVersion: apps/v1\nkind: Deployment\nmetadata: {name: bad}\nspec:\n  selector: {matchLabels: {a: b}}\n  template:\n    metadata: {labels: {a: b}}\n    spec:\n      containers: [{name: x, image: busybox}]\n' | psa_apply $ns"
label="negative control: privileged pod rejected"
run bash -c "! printf 'apiVersion: v1\nkind: Pod\nmetadata: {name: bad}\nspec:\n  containers: [{name: x, image: busybox, securityContext: {privileged: true}}]\n' | docker exec -i $name kubectl -n $ns apply --dry-run=server -f -"
exit $fail
