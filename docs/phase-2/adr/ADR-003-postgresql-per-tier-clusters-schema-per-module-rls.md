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

## Revisit when

When the hosting provider is chosen (E-07); before the first table with tenant data (Phase 3).
