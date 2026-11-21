#!/usr/bin/env bash
# Image signature enforcement (ADR-027), end to end on a throw-away k3s cluster:
#   a private registry with TLS (test CA) holds two CIVORA-like images; one is signed with a test release key
#   (cosign, key-based, no public transparency log: works offline), the other is not. The Sigstore policy-controller
#   (chart 0.10.8 rendered from its pinned upstream tag with CIVORA values) and CIVORA's ClusterImagePolicy
#   (infra/k8s/policies/image-signatures.yaml, registry glob adapted to the test registry) are installed.
#   The release key is held by OpenBao (transit engine, not exportable), as in production (runbook
#   release-key-ceremony.md): CI signs through a token whose policy allows signing only; the cluster gets the public key.
#   Expected in an enforced namespace:
#   - signed image admitted, including when referenced by tag (resolved to its digest);
#   - unsigned image refused;
#   - image covered by no policy refused.
# Needs: docker (nested containers: GitHub runners, not this sandbox), helm, cosign 2.x, sudo (to let the host's
# docker trust the test registry), python3. Keys and certificates are generated per run and deleted.
set -euo pipefail
root="$(cd "$(dirname "$0")/../../.." && pwd)"
k3s_image=rancher/k3s:v1.33.4-k3s1
net=civora-sig-test; reg_ip=172.31.243.10; k3s_ip=172.31.243.20; reg="$reg_ip:5000"; port=16445
work="$(mktemp -d)"; start=$(date +%s)
stamp() { echo "[$(( $(date +%s) - start ))s] $*"; }
cleanup() { docker rm -f civora-sig-registry civora-sig-k3s civora-sig-bao >/dev/null 2>&1 || true; docker network rm "$net" >/dev/null 2>&1 || true; sudo rm -rf "/etc/docker/certs.d/$reg"; rm -rf "$work"; }
trap cleanup EXIT
fail=0
check() { if out=$( (eval "$2") 2>&1); then echo "  ok   $1"; else echo "  FAIL $1"; echo "$out" | tail -8 | sed 's/^/       /'; fail=1; fi; }

# 1. Private registry with TLS; the host's docker trusts it for the push.
openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:P-256 -nodes -days 1 -subj "/CN=civora-sig-test-ca" -keyout "$work/ca.key" -out "$work/ca.crt" 2>/dev/null
openssl req -newkey ec -pkeyopt ec_paramgen_curve:P-256 -nodes -subj "/CN=registry" -keyout "$work/reg.key" -out "$work/reg.csr" 2>/dev/null
printf 'subjectAltName=IP:%s\nextendedKeyUsage=serverAuth\n' "$reg_ip" > "$work/reg.ext"
openssl x509 -req -in "$work/reg.csr" -CA "$work/ca.crt" -CAkey "$work/ca.key" -CAcreateserial -days 1 -extfile "$work/reg.ext" -out "$work/reg.crt" 2>/dev/null
chmod 644 "$work"/*.crt "$work"/*.key
docker network create --subnet 172.31.243.0/24 "$net" >/dev/null
docker run -d --name civora-sig-registry --network "$net" --ip "$reg_ip" -p "127.0.0.1:5000:5000" -v "$work:/certs:ro" \
  -e REGISTRY_HTTP_TLS_CERTIFICATE=/certs/reg.crt -e REGISTRY_HTTP_TLS_KEY=/certs/reg.key registry:2.8.3 >/dev/null
sudo mkdir -p "/etc/docker/certs.d/$reg" && sudo cp "$work/ca.crt" "/etc/docker/certs.d/$reg/ca.crt"
for i in signed unsigned; do
  printf 'FROM alpine:3.20\nRUN echo %s > /civora-test\n' "$i" | docker build -q -t "$reg/civora/$i:1" - >/dev/null
  docker push -q "$reg/civora/$i:1" >/dev/null
done
digest_of() { docker inspect --format '{{index .RepoDigests 0}}' "$reg/civora/$1:1" | cut -d@ -f2; }
signed_ref="$reg/civora/signed@$(digest_of signed)"; unsigned_ref="$reg/civora/unsigned@$(digest_of unsigned)"
stamp "registry up, two images pushed"

# 2. Release key in OpenBao transit (generated inside OpenBao, never exportable). OpenBao runs in dev mode here only.
bao_image="docker.io/openbao/openbao@sha256:597f62847dd382382056a1d6704d50465908c2040038c4611832a23269a67112" # 2.4.1
root_token=$(head -c 24 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 24)
docker run -d --name civora-sig-bao --network "$net" -p 127.0.0.1:8200:8200 --cap-add IPC_LOCK \
  -e BAO_DEV_ROOT_TOKEN_ID="$root_token" -e BAO_DEV_LISTEN_ADDRESS=0.0.0.0:8200 "$bao_image" server -dev >/dev/null
bao() { docker exec -e BAO_ADDR=http://127.0.0.1:8200 -e BAO_TOKEN="${BAO_AS:-$root_token}" civora-sig-bao bao "$@"; }
for _ in $(seq 1 120); do bao status >/dev/null 2>&1 && break; sleep 1; done; bao status >/dev/null 2>&1  # bounded wait: fails instead of hanging
bao secrets enable transit >/dev/null
bao write -f transit/keys/civora-release type=ecdsa-p256 exportable=false >/dev/null
printf 'path "transit/sign/civora-release" { capabilities = ["update"] }\npath "transit/sign/civora-release/*" { capabilities = ["update"] }\npath "transit/keys/civora-release" { capabilities = ["read"] }\n' \
  | docker exec -i -e BAO_ADDR=http://127.0.0.1:8200 -e BAO_TOKEN="$root_token" civora-sig-bao bao policy write ci-signer - >/dev/null
signer_token=$(bao token create -policy=ci-signer -ttl=15m -field=token)
cat /etc/ssl/certs/ca-certificates.crt "$work/ca.crt" > "$work/trust.pem"
export SSL_CERT_FILE="$work/trust.pem" VAULT_ADDR=http://127.0.0.1:8200 VAULT_TOKEN="$signer_token"
cosign public-key --key hashivault://civora-release > "$work/cosign.pub"
cosign sign --yes --key hashivault://civora-release --tlog-upload=false "$signed_ref" >/dev/null 2>&1
check "release key: generated in OpenBao and not exportable (export refused)" "! bao read transit/export/signing-key/civora-release"
check "CI signer token: may sign, may not export, rotate or reconfigure the key" \
  "! BAO_AS=$signer_token bao read transit/export/signing-key/civora-release && ! BAO_AS=$signer_token bao write -f transit/keys/civora-release/rotate && ! BAO_AS=$signer_token bao write transit/keys/civora-release/config deletion_allowed=true"
check "cosign: signed image verifies with the release public key" "cosign verify --key '$work/cosign.pub' --insecure-ignore-tlog=true '$signed_ref'"
check "cosign: unsigned image does not verify" "! cosign verify --key '$work/cosign.pub' --insecure-ignore-tlog=true '$unsigned_ref'"

# 3. k3s trusting the registry CA.
printf 'configs:\n  "%s":\n    tls:\n      ca_file: /etc/civora/registry-ca.crt\n' "$reg" > "$work/registries.yaml"
docker run -d --name civora-sig-k3s --privileged --tmpfs /run --tmpfs /var/run --network "$net" --ip "$k3s_ip" \
  -p "127.0.0.1:$port:6443" -e K3S_KUBECONFIG_MODE=644 -v "$work/registries.yaml:/etc/rancher/k3s/registries.yaml:ro" \
  -v "$work/ca.crt:/etc/civora/registry-ca.crt:ro" "$k3s_image" server --disable=traefik --disable=metrics-server >/dev/null
kc() { docker exec -i civora-sig-k3s kubectl "$@"; }
for _ in $(seq 1 90); do kc get --raw /readyz >/dev/null 2>&1 && break; sleep 2; done; kc get --raw /readyz >/dev/null 2>&1  # bounded wait: fails instead of hanging
for _ in $(seq 1 90); do kc get nodes -o name 2>/dev/null | grep -q node && break; sleep 2; done; kc get nodes -o name 2>/dev/null | grep -q node  # bounded wait: fails instead of hanging
kc wait --for=condition=Ready node --all --timeout=180s >/dev/null
stamp "k3s ready"

# 4. policy-controller from its pinned upstream tag with CIVORA values; CIVORA policy with the test registry glob.
git -c advice.detachedHead=false clone -q --depth 1 --filter=blob:none --sparse --branch policy-controller-0.10.8 https://github.com/sigstore/helm-charts.git "$work/hc"
git -C "$work/hc" sparse-checkout set charts/policy-controller
kc create namespace cosign-system >/dev/null
kc -n cosign-system create configmap cell-registry-ca --from-file=ca.crt=/etc/civora/registry-ca.crt >/dev/null
docker cp "$work/cosign.pub" civora-sig-k3s:/tmp/cosign.pub
kc -n cosign-system create secret generic civora-release-key --from-file=cosign.pub=/tmp/cosign.pub >/dev/null
helm template policy-controller "$work/hc/charts/policy-controller" -n cosign-system --kube-version 1.33.4 --no-hooks \
  -f "$root/infra/argocd/platform/values/policy-controller.yaml" | kc apply -f - >/dev/null
kc -n cosign-system rollout status deploy/policy-controller-webhook --timeout=300s >/dev/null \
  || { kc -n cosign-system get pods -o wide; kc -n cosign-system describe pods | tail -30; exit 1; }
for _ in $(seq 1 30); do kc get crd clusterimagepolicies.policy.sigstore.dev >/dev/null 2>&1 && break; sleep 2; done
sed "s#registry.staging.civora.invalid/\*\*#$reg/**#" "$root/infra/k8s/policies/image-signatures.yaml" | kc apply -f - >/dev/null
kc create namespace sig-test >/dev/null
kc label namespace sig-test policy.sigstore.dev/include=true >/dev/null
stamp "policy-controller and CIVORA policy installed"

# 5. Admission.
run_pod() { kc -n sig-test run "$1" --image="$2" --restart=Never --command -- sleep 1 2>&1; }
echo "Checks (admission in an enforced namespace):"
check "signed image (by digest) is admitted" "for i in \$(seq 1 20); do run_pod p-signed '$signed_ref' | grep -q 'created' && exit 0; sleep 3; done; exit 1"
check "signed image by tag is admitted and pinned to its digest" \
  "run_pod p-tag '$reg/civora/signed:1' | grep -q created && kc -n sig-test get pod p-tag -o jsonpath='{.spec.containers[0].image}' | grep -q '@sha256:'"
check "unsigned image is refused" "out=\$(run_pod p-unsigned '$unsigned_ref'); echo \"\$out\"; echo \"\$out\" | grep -qi 'denied'"
check "image covered by no policy is refused" "out=\$(run_pod p-other docker.io/library/alpine:3.20); echo \"\$out\"; echo \"\$out\" | grep -qi 'denied'"
check "namespaces without the label are not affected" "kc create namespace other >/dev/null && kc -n other run p --image='$unsigned_ref' --restart=Never --command -- sleep 1 | grep -q created"
stamp "done (fail=$fail)"
exit $fail
