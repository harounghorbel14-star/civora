#!/bin/sh
# Starts one Valkey Sentinel (ADR-008). Shared by the Helm chart and infra/tests/valkey-ha.
# Env: SENTINEL_ME (this Sentinel's hostname; default ME), NODES, SENTINELS, VALKEY_PASSWORD, MASTER_NAME,
#      SENTINEL_DIR (writable; default /sentinel), QUORUM (default 2).
set -eu
# The password comes from a mounted secret file (preferred) or the environment (local tests).
if [ -n "${VALKEY_PASSWORD_FILE:-}" ]; then VALKEY_PASSWORD=$(cat "$VALKEY_PASSWORD_FILE"); fi
: "${VALKEY_PASSWORD:?VALKEY_PASSWORD or VALKEY_PASSWORD_FILE is required}"
: "${MASTER_NAME:=civora}" "${SENTINEL_DIR:=/sentinel}" "${QUORUM:=2}" "${SENTINEL_ME:=$ME}"
# Bounded: a Sentinel that does not answer must not stop this node from starting (seen on GitHub runners).
cli() { timeout 3 valkey-cli --no-auth-warning -a "$VALKEY_PASSWORD" "$@"; }
primary=""
for s in $SENTINELS; do
  [ "$s" = "$SENTINEL_ME" ] && continue
  p=$(cli -h "$s" -p 26379 sentinel get-master-addr-by-name "$MASTER_NAME" 2>/dev/null | head -1) || true
  if [ -n "$p" ]; then primary=$p; break; fi
done
[ -n "$primary" ] || primary=${NODES%% *}
# Wait until the primary's name resolves (a pod's DNS record can lag its start).
for _ in $(seq 1 60); do getent hosts "$primary" >/dev/null 2>&1 && break; sleep 1; done
conf="$SENTINEL_DIR/sentinel.conf"
umask 077
cat > "$conf" <<CONF
port 26379
sentinel resolve-hostnames yes
sentinel announce-hostnames yes
sentinel announce-ip $SENTINEL_ME
requirepass $VALKEY_PASSWORD
sentinel sentinel-pass $VALKEY_PASSWORD
sentinel monitor $MASTER_NAME $primary 6379 $QUORUM
sentinel auth-pass $MASTER_NAME $VALKEY_PASSWORD
sentinel down-after-milliseconds $MASTER_NAME 5000
sentinel failover-timeout $MASTER_NAME 60000
sentinel parallel-syncs $MASTER_NAME 1
CONF
echo "sentinel: monitoring $primary"
exec valkey-sentinel "$conf"
