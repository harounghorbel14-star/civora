# ADR-003: PostgreSQL per-tier clusters, schema per module, row-level security for tenants

| | |
|---|---|
| Status | **Proposed — awaiting founder approval (acceptance criterion O-AC2)** |
| Date | 19 November 2026 |
| Origin | Phase 0 §8.12 backlog item 003 (topic unchanged) |
| Covers | O-A3, O-DB1, R-1, R-3 |
| Deciders | Founder (approval); engineering (author) |

## Context

- Different sensitivity tiers need different credentials, keys and backup policies (Phase 0 §9.1–§9.2).
- Tenants share clusters by default (ADR-016) and need isolation in depth.
- Phase 0 §9.9 names pgBackRest for backups and PITR.

## Decision

- PostgreSQL 16+. Clusters per cell: `pg-public` (T3), `pg-core` (T1/T2), `pg-consent-audit` (T1 metadata), `fhir-store` (T0, Phase 7).
- One schema per module, owned by a migration role. The application role is not the owner and has `NOBYPASSRLS`.
- Every tenant-scoped table: `tenant_id`, RLS policy with `FORCE ROW LEVEL SECURITY`, tenant set per transaction with `SET LOCAL app.tenant_id`.
- Operations: containers in dev. In staging, pilot and production, **dedicated database nodes with Patroni (HA) and pgBackRest (backup, PITR)**, managed by Ansible. No in-cluster database operator.
- Data checksums on (`--data-checksums`); SCRAM authentication.

## Consequences

**Positive**

- Follows Phase 0 tooling; DBAs at banks know this model; works on customer premises.
- RLS gives a last line of defence if application code is wrong.

**Negative / costs**

- VM-based databases need an Ansible role (planned, 4–6 days).
- RLS must be tested on every table; forgetting it is a silent risk (CI check planned).

## Alternatives considered

| Option | Outcome |
|---|---|
| CloudNativePG operator in Kubernetes | Not chosen: would replace pgBackRest (Phase 0) and its images could not be pulled here |
| One database per tenant by default | Rejected for the default: cost and operations; offered as a tier (ADR-016) |
| Managed DBaaS | Not available on known Tunisian labelled hosts [U] |

## Validation

- Dev cell runs three separate clusters with SCRAM and checksums; smoke tests pass.
- Base schemas `iam`, `config`, `audit` created by migration; up/down/up test passes.
- Role `postgresql_ha` (19 Nov 2026), integration test on three systemd containers:
  - Patroni + etcd (mutual TLS) cluster with a synchronous standby;
  - encrypted pgBackRest repository on the backup node, with WAL archiving;
  - planned and unplanned failover with no lost commits, and rejoin via `pg_rewind`;
  - restore drill with page-checksum verification;
  - idempotent re-run.
- Final suite run: 17/17 checks in 162 s; crash failover 29 s; old leader rejoins via `pg_rewind`.
- Finding (confirmed by a controlled experiment): with two database nodes in synchronous mode, Patroni refuses automatic failover when no synchronous standby is designated (for example, right after a restart). The standby was not promoted for 120 s; no split-brain. This protects commits, at the cost of automatic recovery. Option to decide: 3 database nodes per production site.
- Second round (20 Nov 2026), both topologies (2 servers: 31/31 checks; 3 servers: 35/35):
  - least-privilege accounts;
  - point-in-time restore;
  - the application path through `pg-router` with `verify-full` TLS;
  - a client writing during a leader crash lost no acknowledged write;
  - with 3 servers and one standby already down, failover was still automatic (35 s);
  - with 2 servers, the manual way out lost the 50 writes acknowledged in the window.
  - Details: [17 §17.2.1](../17-technical-validation-strategy.md).

## Implementation details added in Phase 2 (within this decision, not new decisions)

- **Application connectivity to a moving primary:** `pg-router` (HAProxy).
  - It asks each node's Patroni REST API `GET /primary` over TLS, verifying the certificate by name, and sends connections only to the node that answers 200.
  - Applications connect to one service name with `sslmode=verify-full`, so database node certificates carry the `pg-router` service names.
  - Chart: `infra/helm/pg-router`.
- **Accounts per database:**
  - an owner used only by migrations;
  - an application account with `NOSUPERUSER NOBYPASSRLS`, which can only connect and create temporary objects; its table rights come from migrations.
  - This keeps row-level security effective for the running service.
- **etcd quorum:**
  - 2 database servers: etcd runs on both database servers plus the backup node (3 members);
  - 3 database servers: etcd runs on the database servers only.
- These follow from the decision above and change nothing in it; they are listed so the founder sees them when deciding P2-D1.

## Revisit when

When the hosting provider is chosen (E-07); before the first table with tenant data (Phase 3).
