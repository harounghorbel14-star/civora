#!/bin/sh
# Starts one Valkey data node (ADR-008; HA cache and queues). Shared by the Helm chart and infra/tests/valkey-ha.
# The current primary is asked from the Sentinels; when none answers (first start of the whole set), the first node
# in NODES starts as primary and the others replicate it.
# Env: ME (this node's hostname), NODES (all data-node hostnames, first = initial primary), SENTINELS (Sentinel
#      hostnames), VALKEY_PASSWORD_FILE (mounted secret) or VALKEY_PASSWORD, MASTER_NAME (default civora), DATA_DIR (default /data).
set -eu
# The password comes from a mounted secret file (preferred) or the environment (local tests).
if [ -n "${VALKEY_PASSWORD_FILE:-}" ]; then VALKEY_PASSWORD=$(cat "$VALKEY_PASSWORD_FILE"); fi
: "${VALKEY_PASSWORD:?VALKEY_PASSWORD or VALKEY_PASSWORD_FILE is required}"
: "${MASTER_NAME:=civora}" "${DATA_DIR:=/data}"
cli() { valkey-cli --no-auth-warning -a "$VALKEY_PASSWORD" "$@"; }
primary=""
for s in $SENTINELS; do
  p=$(cli -h "$s" -p 26379 sentinel get-master-addr-by-name "$MASTER_NAME" 2>/dev/null | head -1) || true
  if [ -n "$p" ]; then primary=$p; break; fi
done
[ -n "$primary" ] || primary=${NODES%% *}
conf="$DATA_DIR/valkey.conf"
umask 077
cat > "$conf" <<CONF
bind * -::*
port 6379
dir $DATA_DIR
appendonly yes
requirepass $VALKEY_PASSWORD
masterauth $VALKEY_PASSWORD
replica-announce-ip $ME
# Refuse writes on a primary that has lost all its replicas (limits writes lost to an isolated former primary).
min-replicas-to-write 1
min-replicas-max-lag 10
CONF
[ "$primary" = "$ME" ] || echo "replicaof $primary 6379" >> "$conf"
echo "valkey: starting as $( [ "$primary" = "$ME" ] && echo primary || echo "replica of $primary" )"
exec valkey-server "$conf"
