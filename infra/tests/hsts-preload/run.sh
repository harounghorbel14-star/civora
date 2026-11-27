#!/usr/bin/env bash
# HSTS preload readiness (ASVS 5.0 V3.7.4; Phase 3 gap G5, doc 18): the checker against local test servers for the
# placeholder domain, with a good configuration and one negative control per requirement; and the header the web app
# sends. TEST ONLY certificates, made here and thrown away. Standard tools: bash, openssl, python3.
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
repo=$(cd "$here/../../.." && pwd)
checker="$repo/infra/scripts/check-hsts-preload.py"
domain=civora-cell.invalid
work=$(mktemp -d)
pids=()
cleanup() { for p in "${pids[@]:-}"; do [ -n "$p" ] && kill "$p" 2>/dev/null || true; done; rm -rf "$work"; }
trap cleanup EXIT
free_port() { python3 -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1",0)); print(s.getsockname()[1]); s.close()'; }
fail=0

cd "$work"
openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:P-256 -nodes -days 1 -subj "/CN=TEST ONLY hsts-preload CA" \
  -addext "basicConstraints=critical,CA:TRUE" -addext "keyUsage=critical,keyCertSign,cRLSign" -keyout ca.key -out ca.pem 2>/dev/null
cert() {  # name, SAN list
  openssl req -newkey ec -pkeyopt ec_paramgen_curve:P-256 -nodes -subj "/CN=$domain" -keyout "$1.key" -out "$1.csr" 2>/dev/null
  printf 'subjectAltName=%s\nbasicConstraints=CA:FALSE\nkeyUsage=critical,digitalSignature\nextendedKeyUsage=serverAuth\n' "$2" > "$1.ext"
  openssl x509 -req -in "$1.csr" -CA ca.pem -CAkey ca.key -CAcreateserial -days 1 -extfile "$1.ext" -out "$1.pem" 2>/dev/null
}
openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:P-256 -nodes -days 1 -subj "/CN=TEST ONLY other CA" \
  -addext "basicConstraints=critical,CA:TRUE" -addext "keyUsage=critical,keyCertSign,cRLSign" -keyout other-ca.key -out other-ca.pem 2>/dev/null
cert all "DNS:$domain,DNS:www.$domain,DNS:app.$domain,DNS:auth.$domain"
cert noapp "DNS:$domain,DNS:www.$domain,DNS:auth.$domain"
GOOD='max-age=63072000; includeSubDomains; preload'

# scenario EXPECT(pass|fail) NAME REASON [server options] -- [checker options]; a failure must name REASON.
scenario() {
  local expect=$1 name=$2 reason=$3; shift 3
  local sargs=() cargs=()
  while [ $# -gt 0 ] && [ "$1" != -- ]; do sargs+=("$1"); shift; done
  [ "${1:-}" = -- ] && shift
  cargs=("$@")
  local hp; hp=$(free_port); local pp; pp=$(free_port)
  python3 "$here/server.py" --domain "$domain" --cert all.pem --key all.key --https-port "$hp" --http-port "$pp" "${sargs[@]}" > server.log 2>&1 &
  local pid=$!; pids+=("$pid")
  for _ in $(seq 1 50); do grep -q ready server.log 2>/dev/null && break; sleep 0.1; done
  local out rc=0
  out=$(python3 "$checker" --domain "$domain" --ca-file ca.pem --https-port "$hp" --http-port "$pp" \
    --connect "$domain=127.0.0.1" --connect "www.$domain=127.0.0.1" --connect "app.$domain=127.0.0.1" --subdomain www --subdomain app "${cargs[@]}") || rc=$?
  kill "$pid" 2>/dev/null || true; wait "$pid" 2>/dev/null || true
  local got; got=$([ $rc = 0 ] && echo pass || echo fail)
  [ "$got" = fail ] && ! grep FAIL <<<"$out" | grep -qi -- "$reason" && got="fail for another reason"
  if [ "$got" = "$expect" ]; then
    echo "  ok   $name: checker says $got$([ "$got" = fail ] && echo " ($(grep -m1 -i -- "$reason" <<<"$out" | sed 's/^ *FAIL //' | cut -c1-120))")"
  else
    echo "  FAIL $name: expected $expect, got $got"; echo "$out" | sed 's/^/       /'; fail=1
  fi
}

echo "HSTS preload readiness for the placeholder domain $domain (test servers, TEST ONLY CA):"
scenario pass "good: HSTS 2 years + includeSubDomains + preload, HTTP redirects to the same host, subdomains on HTTPS" - --hsts "$GOOD"
scenario pass "good: an HTTPS redirect that carries the header itself" - --hsts "$GOOD" --https-mode redirect-with-hsts
scenario fail "negative: no HSTS header" "no Strict-Transport-Security"
scenario fail "negative: preload missing" "preload missing" --hsts 'max-age=63072000; includeSubDomains'
scenario fail "negative: includeSubDomains missing" "includeSubDomains missing" --hsts 'max-age=63072000; preload'
scenario fail "negative: max-age of one day" "below one year" --hsts 'max-age=86400; includeSubDomains; preload'
scenario fail "negative: an HTTPS redirect without the header" "redirect 301" --hsts "$GOOD" --https-mode redirect-without-hsts
scenario fail "negative: HTTP serves the page instead of redirecting" "same host first" --hsts "$GOOD" --http-mode plain
scenario fail "negative: HTTP redirects to another host first (www)" "same host first" --hsts "$GOOD" --http-mode redirect-other-host
scenario fail "negative: a certificate the client does not trust" "valid certificate" --hsts "$GOOD" -- --ca-file "$work/other-ca.pem"
# A subdomain without a valid certificate: serve the certificate that does not name app.
hp=$(free_port); pp=$(free_port)
python3 "$here/server.py" --domain "$domain" --cert noapp.pem --key noapp.key --https-port "$hp" --http-port "$pp" --hsts "$GOOD" > server.log 2>&1 &
pid=$!; pids+=("$pid"); for _ in $(seq 1 50); do grep -q ready server.log 2>/dev/null && break; sleep 0.1; done
if python3 "$checker" --domain "$domain" --ca-file ca.pem --https-port "$hp" --http-port "$pp" --connect "$domain=127.0.0.1" --connect "app.$domain=127.0.0.1" --subdomain app >/dev/null; then
  echo "  FAIL negative: a subdomain without a valid certificate: expected fail, got pass"; fail=1
else echo "  ok   negative: a subdomain without a valid certificate: checker says fail"; fi
kill "$pid" 2>/dev/null || true

# The header the citizen web app sends on https (apps/web/proxy.ts) qualifies for the list.
header=$(grep -o "strict-transport-security', '[^']*'" "$repo/apps/web/proxy.ts" | sed "s/.*', '//; s/'$//")
if python3 -B -c "import importlib.util,sys; s=importlib.util.spec_from_file_location('c', '$checker'); m=importlib.util.module_from_spec(s); s.loader.exec_module(m); p=m.hsts_problems(sys.argv[1]); print(p) if p else None; sys.exit(1 if p else 0)" "$header"; then
  echo "  ok   the web app's header qualifies for the preload list: $header"
else echo "  FAIL the web app's header does not qualify: $header"; fail=1; fi
[ $fail = 0 ] && echo "ALL CHECKS PASSED" || echo "SOME CHECKS FAILED"
exit $fail
