# ADR-029: Backup, disaster recovery and data residency

| | |
|---|---|
| Status | **Proposed — awaiting founder approval (acceptance criterion O-AC2)** |
| Date | 19 November 2026 |
| Origin | New in Phase 2 |
| Covers | R-5; PRD §12.7 (RPO ≤ 15 min, RTO ≤ 4 h); Phase 0 §9.9, §10.11 |
| Deciders | Founder (approval); engineering (author) |

## Context

- Pilot targets: RPO ≤ 15 min, RTO ≤ 4 h; production with two in-country sites; monthly restore drills.

## Decision

- pgBackRest: weekly full, daily differential, continuous WAL; repository 1 on the site-A backup node, repository 2 at site B; WORM retention for the audit cluster; encryption keys separate from production.
- Object storage versioning + replication; OpenBao Raft snapshots hourly; RKE2 etcd snapshots every 6 h; Git is the source of truth for configuration.
- Daily HSM-signed audit-chain anchors stored off-cluster.
- **Every store, backup, log and trace stays in the cell's country**; the IaC rejects nodes abroad and requires the backup node in a different zone from the database nodes.
- Monthly restore drill, quarterly DR test, nightly deploy-from-scratch; a backup counts only once restored.

## Consequences

**Positive**

- Meets the stated objectives with standard tooling.

**Negative / costs**

- Needs a second in-country site (provider criterion).

## Alternatives considered

| Option | Outcome |
|---|---|
| Snapshots only | Rejected: no PITR within 15 min |

## Validation

- Residency and backup-zone preconditions tested in OpenTofu; etcd snapshot schedule in the RKE2 template.
- Backups tested on systemd containers (role `postgresql_ha`, 19–20 Nov 2026):
  - encrypted repository, unreadable without the passphrase (tested, with a control);
  - WAL archiving;
  - restore drill to the latest point and to a chosen time (rows before T present, rows after T absent);
  - page checksums verified after every restore.
- Not yet done:
  - the second repository at the other site;
  - restoring into a new cluster (DR);
  - drills on real hosts (they need the provider).
- Procedures: [database runbook](../runbooks/database-operations.md).

## Revisit when

Provider selection; first restore drill.
