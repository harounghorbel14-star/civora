# Role `postgresql_ha` — PostgreSQL 16 with automatic failover and verified backups

Implements **ADR-003** (PostgreSQL on dedicated database nodes, Patroni + pgBackRest) and **ADR-029** (backups, restore drills, residency). Both ADRs are still **Proposed**; this role is provider-independent preparation for the staging criterion O-AC1.

## What it builds

| Node group | Components |
|---|---|
| `db_nodes` (2+) | PostgreSQL 16 managed by **Patroni** (leader election, synchronous replication, `pg_rewind`), **etcd** member, pgBackRest TLS server |
| `backup` (1) | etcd member (third vote for quorum), **pgBackRest repository** (AES-256 encrypted, zstd), weekly full + daily differential timers, **restore-drill script** |

Security properties:
- Every connection between nodes uses **mutual TLS** with per-node certificates from the cell CA: etcd peer and client, Patroni → etcd, Patroni REST API, PostgreSQL replication, pgBackRest.
- No SSH trust between servers (pgBackRest TLS-server mode).
- `pg_hba`: replication and admin only from the database nodes; applications only from `postgresql_ha_app_cidrs`, over TLS with SCRAM; everything else is rejected.
- Data checksums are on; synchronous mode means an acknowledged commit survives the loss of the leader.
- All packages come from the Ubuntu 24.04 archive, so an air-gapped site (tier 4) can install from a local mirror.

## Required inputs (from OpenBao at run time — never committed)

| Variable | Content |
|---|---|
| `postgresql_ha_superuser_password`, `postgresql_ha_replication_password`, `postgresql_ha_rewind_password`, `postgresql_ha_restapi_password` | ≥ 16 characters each |
| `postgresql_ha_repo_cipher_pass` | ≥ 32 characters (backup encryption key; store it also in the offline key escrow, M-of-N) |
| `postgresql_ha_tls_ca`, `postgresql_ha_tls_cert`, `postgresql_ha_tls_key` | PEM; certificate CN = inventory host name, SAN = host name + IP, usages serverAuth + clientAuth |
| `postgresql_ha_app_cidrs` | Kubernetes node CIDRs allowed to reach PostgreSQL |
| `civora_cell_id` | From the OpenTofu inventory |

The role refuses to run if a secret or certificate is missing or too short.

## Synchronous mode: no lost commits, at a price (found in testing, 19 Nov 2026)

With `postgresql_ha_synchronous_mode: true`, Patroni promotes a standby **only if it is the designated synchronous standby**. That is what guarantees that an acknowledged commit is never lost.

What testing showed (`tests/postgresql-ha/sync-safety-experiment.sh`, 19 Nov 2026):
- Patroni on the synchronous standby was restarted, so for a moment no synchronous standby was designated.
- The leader was frozen 6 s later. The standby was **not promoted for 120 s**, as designed.
- After the leader was unfrozen, the cluster recovered by itself, with no split-brain.
- An operator can still force a failover (`patronictl failover`), accepting possible loss of the last commits.
- In steady state (a synchronous standby designated), the same crash leads to automatic promotion in 29 s with no lost commits.

Consequences for production:

| Option | Effect | Cost |
|---|---|---|
| 2 database nodes, synchronous mode (staging default) | RPO 0 for commits; automatic failover blocked while the standby is down or not yet in sync | Lowest |
| **3 database nodes**, synchronous mode (`synchronous_node_count: 1`) | RPO 0, and failover still possible when one standby is unavailable | One more database server per site |
| 2 nodes, asynchronous | Failover always possible; may lose the last seconds of commits (bounded by `maximum_lag_on_failover`) | Lowest; weaker RPO |

The choice is recorded as an open point for ADR-003 (founder decision P2-D1). Production cells for banks should use 3 database nodes.

## Operations

| Task | Command (backup node unless stated) |
|---|---|
| Cluster status | `patronictl -c /etc/patroni/config.yml list` (database node, as `postgres`) |
| Backup status | `sudo -u pgbackrest pgbackrest --stanza=civora info` |
| Manual backup | `sudo systemctl start pgbackrest-backup@full.service` |
| **Restore drill** (monthly, ADR-029) | `sudo -u postgres /usr/local/sbin/civora-restore-drill 'select count(*) from <table>'` → JSON line with backup label, query result, checksum verification and duration. Keep the output as drill evidence |

## Tested

`infra/ansible/tests/postgresql-ha/run.sh` runs the role on three systemd containers and checks:
- cluster formation;
- synchronous TLS replication;
- encrypted backups and WAL archiving;
- a planned failover and an unplanned one (frozen leader), with no lost commits and the old leader rejoining via `pg_rewind`;
- the restore drill with checksum verification;
- idempotence.

It runs nightly in CI ([.github/workflows/nightly.yml](../../../../.github/workflows/nightly.yml)). Results are in [docs/phase-2/17-technical-validation-strategy.md](../../../../docs/phase-2/17-technical-validation-strategy.md).
