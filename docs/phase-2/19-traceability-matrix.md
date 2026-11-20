# 19. Traceability Matrix

| | |
|---|---|
| Purpose | Trace every original Phase 2 item (Phase 0 §19, IDs from [00](00-specification-and-constraint-audit.md) §2), every additive roadmap item (R-1 to R-5), every mission topic and every inherited constraint to a deliverable, to its verification, and to a status |
| Status values | **Done** (delivered and verified) · **Done (design)** (decided and documented; built in a later phase by design) · **Partial** (delivered in part; gap stated) · **Open — founder** · **Open — external** · **Blocked** (needs something that does not exist yet) |
| Date | 19 November 2026 |

## 19.1 Original Phase 2 specification

| ID | Original item | Deliverable | Verification | Status |
|---|---|---|---|---|
| O-OBJ | Turn Section 8 into approved ADRs and a working skeleton | 29 ADRs; walking skeleton | ADR index; tests | **Partial**: skeleton done; ADRs proposed, not approved (O-AC2) |
| O-D1 | ADR-001..014 | [adr/](adr/README.md) ADR-001–014, Phase 0 topics unchanged (+ ADR-015–029) | Topic-by-topic match with Phase 0 §8.12 | **Done** (status Proposed) |
| O-D2 | Full STRIDE threat model | [08](08-threat-model.md) (52 threats, 15 elements) + [09](09-data-flow-diagrams.md) | Self-review; external review pending | **Done** (draft v1.0) |
| O-D3 | Data inventory and classification | [05](05-data-architecture-and-governance.md) §5.1–§5.3; [data-inventory.csv](data/data-inventory.csv) (43 items) | CSV parses; tier counts recomputed | **Done** |
| O-D4 | Repository structure (monorepo) | apps/web, apps/mobile, apps/workspace, services/core, services/guide, services/health-bridge, packages/* | `pnpm install`/build/test; ADR-023 | **Done** |
| O-D5 | CI/CD pipeline with security gates | `.github/workflows/ci.yml`, `nightly.yml`; [16](16-infrastructure-plan.md) §16.4 | **Observed on GitHub 19 Nov 2026**: run 1 found a real Checkov defect (fixed); run 2 all six jobs green incl. Trivy gate and SBOM | **Done** (signing/provenance steps run on `main` only — see O-SEC2) |
| O-D6 | IaC for dev/staging cell | `infra/compose` (dev), `infra/tofu`, `infra/ansible` (incl. role `postgresql_ha`), `infra/helm`, `infra/argocd` | Dev cell from scratch (64–131 s, 10/10 checks); tofu validate/plan; ansible-lint; server-side manifest validation; database role integration test on containers | **Partial**: dev done; staging IaC written, database tier container-tested, not applied (no provider); platform-service charts not yet written (chart repositories unreachable from the build environment) |
| O-D7 | Synthetic data generator (TN country pack v0) | `packages/synthetic-data`, `packages/country-packs/tn` | Determinism and pattern tests; pack integrity tests | **Done** |
| O-D8 | Coding standards | [18](18-coding-standards.md) | Fitness check in CI | **Done** |
| O-A1 | Modular monolith skeleton | `services/core` (9 bounded contexts + platform modules) | e2e tests; boundary check | **Done** |
| O-A2 | Keycloak | Dev cell, realm `civora-dev`; [06](06-identity-and-access.md) | Smoke test (OIDC discovery) | **Done** (dev) |
| O-A3 | PostgreSQL clusters | Dev cell: pg-public, pg-core, pg-consent-audit; ADR-003. Staging and production: role `postgresql_ha` (Patroni, etcd, pgBackRest) + `pg-router` chart | Smoke tests; migration test; database suite on systemd containers, 2 and 3 servers (31/31, 35/35 — [17](17-technical-validation-strategy.md) §17.2.1) | **Done** (dev); staging tier container-tested, real hosts need a provider |
| O-A4 | Redis | Dev cell (auth, AOF) | Smoke test (auth required) | **Done** (dev) |
| O-A5 | Object storage | Dev cell SeaweedFS; ADR-020 | Smoke test (anonymous refused) | **Done** (dev) |
| O-A6 | Observability stack | Dev cell OTel + Prometheus + Loki + Tempo + Grafana; core metrics, logs and **traces** (allow-list exporter); [15](15-observability-backup-and-dr.md) | Smoke tests (login required; traces reach Tempo without request data); e2e `/metrics`; e2e trace-scrubbing test with negative control; log-privacy test with negative control (R27) | **Done** |
| O-A7 | OPA/Cedar evaluation spike | `spikes/policy-engine`; ADR-006 | 24/24 decisions agree; CI job | **Done** |
| O-F1 | Health-check endpoints | `GET /health`, `GET /health/ready` | e2e; dev cell; Kubernetes probes | **Done** |
| O-F2 | Feature-flag framework | `packages/feature-flags`; ADR-021 | Unit tests; used by core | **Done** |
| O-F3 | i18n framework with RTL | `packages/i18n`; `/v1/meta/locales`; ADR-014, ADR-022 | 6 unit tests; e2e Arabic → `rtl` | **Done** |
| O-DB1 | Base schemas iam, config, audit (empty) | `services/core/migrations/1763510400000_base-schemas.sql` | Migration test; dev cell smoke test | **Done** |
| O-DB2 | Migration tooling | node-pg-migrate SQL; ADR-024; Helm migration hook | Up/down/up test; server-side validation of the Job | **Done** |
| O-API1 | `GET /health` | core | e2e; contract | **Done** |
| O-API2 | `GET /v1/meta/locales` | core | e2e; contract | **Done** |
| O-API3 | OpenAPI pipeline | `generate-openapi.ts` (→ OpenAPI **3.1.0**); committed contract; drift check; `validate-openapi.mjs` | Drift check caught a real change; 3.1 schema validation + house rules pass; old 3.0 contract rejected (negative test) | **Done** |
| O-DEP | P1 IA outputs (partially) | Phase 1 docs 15, 12, 18 | [00](00-specification-and-constraint-audit.md) §1 | **Done** (dependency met) |
| O-SEC1 | Secrets management | [07](07-security-and-privacy-architecture.md) §7.4; OpenBao dev; `NAME_FILE`; secret volumes | Unit test; gitleaks clean | **Done** (dev/design); OpenBao HA in staging |
| O-SEC2 | Signed builds | cosign keyless + provenance in CI (ADR-027); admission policy for allowed registries + digest pins (`infra/k8s/policies`) | Signing configured; admission policy tested on a Kubernetes 1.33 API server, 10 cases (R28) | **Partial**: signing runs on GitHub `main` only, not yet observed; signature verification at admission before pilot |
| O-SEC3 | SBOM | Syft CycloneDX in CI | Generated locally (878 components) | **Done** |
| O-SEC4 | Branch protection | Settings specified ([07](07-security-and-privacy-architecture.md) §7.7) | — | **Open — founder** (GitHub admin) |
| O-SEC5 | 2-reviewer rule | CODEOWNERS; settings specified | — | **Open — founder** (needs a 2nd engineer or a waiver) |
| O-T1 | Unit/integration scaffolds in the pipeline | 30 tests + migration test; CI `build-test` | Pass locally and on GitHub (run 2) | **Done** |
| O-T2 | IaC scanning | Checkov in CI; `validate-manifests.sh`; tofu; ansible-lint | All pass; findings handled ([17](17-technical-validation-strategy.md) §17.4) | **Done** |
| O-T3 | Deploy-from-scratch test | `dev-cell-up.sh --fresh` (82 s, 9/9); `deploy-from-scratch.sh` (k3s, air-gapped); `staging-rehearsal.sh` (database tier + k3s + `pg-router` + civora-core) | Dev variant passes; k3s variants run on GitHub runners (they cannot run in this sandbox) — results in [17](17-technical-validation-strategy.md) §17.2.2 | **Partial** until the k3s variants are observed green |
| O-AC1 | Staging reproducible from IaC in < 2 h | [16](16-infrastructure-plan.md) §16.7 | — | **Blocked**: no hosting provider (E-07) |
| O-AC2 | All ADRs approved | ADR index | — | **Open — founder** |
| O-AC3 | Threat model reviewed by an external security adviser | [08](08-threat-model.md) §8.8 | — | **Open — external** (adviser not engaged) |
| O-TIME | 6 weeks | Plan in [16](16-infrastructure-plan.md) §16.7 | Week 1 done | **On plan for week 1**; weeks 3–5 depend on E-07 |
| O-RISK | Over-engineering (time-boxed spikes, ADR scope discipline) | Spike time-boxed; design-only ADRs for Phases 4, 7, 10; non-goals respected | §19.4 | **Done** |
| O-BUD | 100–150k TND | [16](16-infrastructure-plan.md) §16.8 | No new amount assumed | **Unchanged** |

## 19.2 Additive roadmap items (P1-D4 roadmap matrix)

| ID | Item | Where | Status |
|---|---|---|---|
| R-1 | ADRs cover financial-institution tenants | ADR-016, ADR-019; [04](04-multi-tenant-architecture.md) §4.5 | **Done (design)** |
| R-2 | ADRs cover on-premises deployability | ADR-019, ADR-013; [13](13-cloud-and-deployment-architecture.md) §13.2; air-gapped rehearsal script | **Done (design)**; rehearsal pending CI |
| R-3 | ADRs cover the financial data domain | ADR-018, ADR-003; [05](05-data-architecture-and-governance.md) §5.1; inventory rows DI-14–DI-22 | **Done** |
| R-4 | Rule packs as versioned configuration (FR-66) | ADR-017; `packages/country-packs` with three BCT rule packs | **Done** |
| R-5 | Tunisian hosting; no foreign processing of personal data | ADR-004, ADR-029, ADR-010; OpenTofu residency precondition (tested) | **Done (design + guard)** |

## 19.3 Mission topics (founder instruction, 19 Nov 2026)

| # | Topic | Documents | ADRs | Built / verified in Phase 2 |
|---|---|---|---|---|
| M-1 | Six business divisions | [02](02-business-divisions-and-capability-map.md) | 001, 016 | Bounded contexts for all shared capabilities |
| M-2 | Global core and country-specific configuration | [03](03-global-core-and-country-configuration.md) | 004, 017, 021, 022 | TN pack v0, rule packs, integrity, flags, i18n |
| M-3 | Multi-tenant architecture | [04](04-multi-tenant-architecture.md) | 016, 003, 012 | Tenant-isolation policy rules proven (spike) |
| M-4 | Database and data governance | [05](05-data-architecture-and-governance.md), [inventory](data/data-inventory.csv) | 003, 018, 022, 024 | 3 clusters, base schemas, migrations |
| M-5 | Identity and access management | [06](06-identity-and-access.md) | 005, 006 | Keycloak realm; Cedar model |
| M-6 | Security and privacy | [07](07-security-and-privacy-architecture.md), [08](08-threat-model.md) | 012, 025, 027 | Hardened image and chart; scans; secrets pattern; image admission policy; log-privacy test |
| M-7 | API architecture and integrations | [10](10-api-architecture-and-standards.md), [11](11-integration-architecture.md) | 015, 028, 008 | 3 operations; contract pipeline; locked adapter flag |
| M-8 | AI and agent infrastructure | [12](12-ai-and-agent-infrastructure.md) | 010, 026 | Design only (non-goal before Phase 10) |
| M-9 | Cloud and deployment architecture | [13](13-cloud-and-deployment-architecture.md), [16](16-infrastructure-plan.md) | 004, 013, 019, 020, 025 | Dev cell; chart; IaC validated |
| M-10 | Scalability and performance | [14](14-scalability-and-performance.md) | 001, 003, 008 | Baseline load test |
| M-11 | Monitoring, backup and DR | [15](15-observability-backup-and-dr.md) | 011, 029 | Observability stack in dev; residency/backup-zone guards |
| M-12 | Technical documentation and diagrams | [01](01-architecture-overview.md) (C4 L1/L2), [09](09-data-flow-diagrams.md) (9 DFDs) and diagrams in 02–15 | — | Mermaid diagrams render (QA) |

Requested outputs: architecture documentation (01–18) · traceability matrix (this file) · ADRs ([adr/](adr/README.md)) · threat model ([08](08-threat-model.md)) · data-flow diagrams ([09](09-data-flow-diagrams.md)) · API standards ([10](10-api-architecture-and-standards.md)) · infrastructure plan ([16](16-infrastructure-plan.md)) · technical validation strategy ([17](17-technical-validation-strategy.md)) · readiness report ([phase-2-readiness-report.md](phase-2-readiness-report.md)). **All present.**

## 19.4 Inherited constraints honoured

| Constraint | How it is honoured | Evidence |
|---|---|---|
| Roadmap unchanged (P1-D4; mission rule 1) | No phase renamed, reordered, merged or removed; Phase 2 items kept word for word | [00](00-specification-and-constraint-audit.md) §2 |
| Phase 1 not claimed approved (rule 5) | Every Phase 2 document states P1-D12 pending; P2-D0 recorded with "no effect on Phase 1 status" | [23 §23.6](../phase-1/23-founder-approval-decisions.md) |
| Phase 1 validation tracked separately (rule 4) | Evidence register unchanged except a note; Phase 2 adds no evidence claims | [register](../phase-1/validation-evidence-register.md) |
| No assumed legal approvals or integrations (rule 6) | Integration register unchanged (0 live); adapters simulated only; production flag locked; synthetic pack refused in pilot/prod | [11](11-integration-architecture.md); tests |
| No application code beyond the original deliverables (rule 7) | Only the skeleton, frameworks, tooling and IaC named in Phase 0 §19; no business endpoints; apps are placeholders | Repository |
| D7 stack | TypeScript, NestJS, PostgreSQL, Keycloak, Kubernetes, OpenTofu, Argo CD; OPA vs Cedar decided by spike | ADR-002/003/005/006/013 |
| D9 hosting | Synthetic-only dev/staging anywhere; pilot/prod only labelled Tunisian or customer premises (country pack + IaC guard) | ADR-004, ADR-025 |
| D10 AI | Location policy; no AI built before Phase 10 | ADR-010, ADR-026 |
| D11 open source pending | Repository stays proprietary | ADR-023; LICENSE |
| Phase 0 data tiers (T0 = special … T3 = public) | Used throughout; earlier comment errors corrected | Commit "align data-tier labels" |
| Phase 0 pgBackRest backup tooling | Kept: Patroni + pgBackRest on database nodes | ADR-003, ADR-029 |
| Phase 1 §18.3 non-goals | No microservices split; no multi-country runtime; no low-code; no AI | ADR-001; [02](02-business-divisions-and-capability-map.md) §2.4 |
| PRD §12.7 NFRs | SLOs, RPO/RTO, residency, accessibility, observability without personal data | [14](14-scalability-and-performance.md), [15](15-observability-backup-and-dr.md) |
| No real personal data in development | Reserved ranges; fitness check; generator | ADR-025; CI |
