#!/usr/bin/env bash
# Compiles policies/civora.rego to WebAssembly with the pinned OPA image, and runs `opa check --strict`.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p out
img=openpolicyagent/opa:1.4.2
docker run --rm -v "$PWD/policies:/p:ro" "$img" check --strict /p/civora.rego
docker run --rm --user "$(id -u):$(id -g)" -v "$PWD/policies:/p:ro" -v "$PWD/out:/out" "$img" build -t wasm -e civora/authz/allow -o /out/bundle.tar.gz /p/civora.rego
tar -xzf out/bundle.tar.gz -C out /policy.wasm
echo "built out/policy.wasm"
