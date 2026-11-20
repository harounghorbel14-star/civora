#!/usr/bin/env bash
# OpenTofu cells (offline; no provider needed): both example environments validate and plan, and the cell module's
# guards refuse unsafe topologies (negative tests). Each negative case is a copy of the pilot environment with one
# change; the plan must fail with the expected message.
set -euo pipefail
root="$(cd "$(dirname "$0")/../.." && pwd)"
work="$(mktemp -d)"; trap 'rm -rf "$work"' EXIT
fail=0
for env in staging-tn pilot-tn; do
  if (cd "$root/infra/tofu/envs/$env" && tofu init -backend=false -input=false >/dev/null && tofu validate >/dev/null && tofu plan -input=false >/dev/null); then
    echo "  ok   $env: validate + plan"; else echo "  FAIL $env: validate + plan"; fail=1; fi
done
negative() { # label, sed expression applied to pilot-tn, expected message fragment
  local d="$work/$(echo "$1" | tr -c 'a-z0-9' '-')"; mkdir -p "$d"
  sed -e "s#\"../../modules/#\"$root/infra/tofu/modules/#" -e "$2" "$root/infra/tofu/envs/pilot-tn/main.tf" > "$d/main.tf"
  out=$(cd "$d" && tofu init -backend=false -input=false >/dev/null && tofu plan -input=false -no-color 2>&1 || true)
  if tr -s ' \n' ' ' <<<"$out" | grep -qF "$3"; then echo "  ok   refused: $1"; else echo "  FAIL not refused: $1"; echo "$out" | tail -5; fail=1; fi
}
negative "a node outside Tunisia (data residency)" 's/name = "tn-pil-a2", address = "198.51.100.22", role = "agent", country = "TN"/name = "tn-pil-a2", address = "198.51.100.22", role = "agent", country = "FR"/' "outside the cell's country"
negative "standby database server at the main site" 's/role = "db_standby", country = "TN", zone = "b", site = "second"/role = "db_standby", country = "TN", zone = "b"/' "at the backup_dr site"
negative "pilot without a second-site repository" '/role = "backup_dr"/d' "Pilot and production cells need one backup_dr node"
negative "second-site repository at the main site" 's/role = "backup_dr", country = "TN", zone = "a", site = "second"/role = "backup_dr", country = "TN", zone = "e"/' "at a site different from every database and backup node"
exit $fail
