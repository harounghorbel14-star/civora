#!/usr/bin/env bash
# Checks and unit-tests the CIVORA alert rules with promtool from the official Prometheus image (pinned by digest).
# The rules are extracted from the PrometheusRule resource, so the tested file is the deployed one.
set -euo pipefail
root="$(cd "$(dirname "$0")/../.." && pwd)"
image="docker.io/prom/prometheus@sha256:fa3302279710be2f21a8301ec17a8b4f2301fd829bd113839b3b6b02b6f191a2"  # v3.15.1
work="$(mktemp -d)"; trap 'rm -rf "$work"' EXIT
python3 -c 'import sys,yaml; d=yaml.safe_load(open(sys.argv[1])); yaml.safe_dump({"groups": d["spec"]["groups"]}, open(sys.argv[2],"w"), sort_keys=False)' \
  "$root/infra/k8s/monitoring/civora-infrastructure-alerts.yaml" "$work/rules.yaml"
cp "$root"/infra/k8s/monitoring/tests/*.test.yaml "$work/"
chmod -R a+rX "$work"
docker run --rm --entrypoint promtool -v "$work:/w:ro" -w /w "$image" check rules rules.yaml
docker run --rm --entrypoint promtool -v "$work:/w:ro" -w /w "$image" test rules $(cd "$work" && ls *.test.yaml)
