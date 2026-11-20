# Phase 2 — Technical Architecture

| | |
|---|---|
| Status | **In progress (week 1 complete). Not ready for acceptance**: see the [readiness report](phase-2-readiness-report.md) |
| Started | 19 November 2026, by founder decision **P2-D0** under P1-D4 (overlapping execution) |
| Phase 1 | **Not approved** (P1-D12 pending). Phase 2 cannot be accepted before Phase 1 |
| All ADRs | **Proposed — awaiting founder approval** |

## Read in this order

1. [Readiness report](phase-2-readiness-report.md): what is done, what is open, what the founder needs to do.
   - **For decision P2-D1:** [plain-language review of all 29 ADRs](founder-review/P2-D1-adr-review-package.md) and the [decision form](founder-review/P2-D1-decision-form.csv).
2. [00 Specification and constraint audit](00-specification-and-constraint-audit.md): the original Phase 2 scope, word for word, and every inherited constraint.
3. [01 Architecture overview](01-architecture-overview.md): context, containers, principles, document map.
4. [ADR index](adr/README.md): 29 decisions.
5. [19 Traceability matrix](19-traceability-matrix.md): every requirement → deliverable → verification → status.
6. [Database operations runbook](runbooks/database-operations.md) (draft): failover, the manual decision for 2-server sites, backups, restore drills — every command tested on containers.

## Documents

| # | Document |
|---|---|
| 02 | [Business divisions and capability map](02-business-divisions-and-capability-map.md) |
| 03 | [Global core and country configuration](03-global-core-and-country-configuration.md) |
| 04 | [Multi-tenant architecture](04-multi-tenant-architecture.md) |
| 05 | [Data architecture and governance](05-data-architecture-and-governance.md) + [data inventory](data/data-inventory.csv) |
| 06 | [Identity and access](06-identity-and-access.md) |
| 07 | [Security and privacy architecture](07-security-and-privacy-architecture.md) |
| 08 | [Threat model (STRIDE)](08-threat-model.md) |
| 09 | [Data-flow diagrams](09-data-flow-diagrams.md) |
| 10 | [API architecture and standards](10-api-architecture-and-standards.md) |
| 11 | [Integration architecture](11-integration-architecture.md) |
| 12 | [AI and agent infrastructure](12-ai-and-agent-infrastructure.md) |
| 13 | [Cloud and deployment architecture](13-cloud-and-deployment-architecture.md) |
| 14 | [Scalability and performance](14-scalability-and-performance.md) |
| 15 | [Observability, backup and DR](15-observability-backup-and-dr.md) |
| 16 | [Infrastructure plan](16-infrastructure-plan.md) |
| 17 | [Technical validation strategy](17-technical-validation-strategy.md) |
| 18 | [Coding standards](18-coding-standards.md) |

## Code and infrastructure (repository root)

| Path | What |
|---|---|
| `services/core` | Walking skeleton (NestJS modular monolith) |
| `packages/*` | i18n/RTL, feature flags, country packs (TN v0, BCT rule packs), synthetic data |
| `infra/compose` | Local dev cell — `infra/scripts/dev-cell-up.sh --fresh` |
| `infra/helm`, `infra/tofu`, `infra/ansible`, `infra/argocd` | Staging cell as code (provider-agnostic): application and `pg-router` charts, database role, platform services (`infra/argocd/platform`) — `infra/scripts/validate-manifests.sh` |
| `infra/k8s/policies` | Image admission policy (allowed registries, digest pins) |
| `infra/scripts/staging-rehearsal.sh` | Staging-shaped rehearsal: HA database tier + k3s + `pg-router` + civora-core (GitHub runners) |
| `spikes/policy-engine` | OPA vs Cedar spike |
| `.github/workflows` | CI with security gates; nightly rehearsals |

Quick start (Node 22, pnpm 10, Docker):

```bash
pnpm install && pnpm build && pnpm packs:verify && pnpm test
infra/scripts/dev-cell-up.sh --fresh   # whole cell from scratch, synthetic data only
```
