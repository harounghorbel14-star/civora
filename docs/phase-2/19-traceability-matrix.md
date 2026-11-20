# 19. Traceability Matrix

| | |
|---|---|
| Purpose | Trace every original Phase 2 item (Phase 0 §19, IDs from [00](00-specification-and-constraint-audit.md) §2), every additive roadmap item (R-1 to R-5), every mission topic and every inherited constraint to a deliverable, to its verification, and to a status |
| Status values | **Done** (delivered and verified) · **Done (design)** (decided and documented; built in a later phase by design) · **Partial** (delivered in part; gap stated) · **Open — founder** · **Open — external** · **Blocked** (needs something that does not exist yet) |
| Date | 19 November 2026; §19.0 updated 20 November 2026 |

## 19.0 Final acceptance traceability (20 Nov 2026)

Every original Phase 2 item (IDs from [00](00-specification-and-constraint-audit.md) §2) and every additive acceptance item (R-1 to R-5), with what is still needed. The three acceptance criteria O-AC1–O-AC3 are the gates. Each depends on someone outside engineering: a provider, the founder, an adviser. §19.1–§19.4 below are the detailed earlier views (19 Nov 2026), kept for history.

| ID | Required outcome | Deliverable | Status | Test evidence | External dependency | Remaining blocker |
|---|---|---|---|---|---|---|
| O-OBJ | Section 8 turned into approved ADRs and a working skeleton | 30 ADRs; walking skeleton; [ADR register](founder-review/P2-adr-final-review-register.md) | Partial | Skeleton tested (43 tests, nightly rehearsals); ADR register with evidence | Founder approval | O-AC2 |
| O-D1 | ADR-001..014 | adr/ (ADR-001–030) | Done (Proposed) | Topic match with Phase 0 §8.12; register §2 | — | Approval (O-AC2) |
| O-D2 | Full STRIDE threat model | [08](08-threat-model.md), [09](09-data-flow-diagrams.md), [security review package](founder-review/P2-security-review-package.md) | Done (draft v1.0) | 52 threats; internal tests mapped (package §2) | External adviser | O-AC3 |
| O-D3 | Data inventory and classification | [05](05-data-architecture-and-governance.md); data-inventory.csv | Done | CSV parses; tiers recomputed | — | — |
| O-D4 | Monorepo structure | Repository (ADR-023) | Done | Build/test in CI | — | — |
| O-D5 | CI/CD with security gates | ci.yml, nightly.yml | Done | CI and 12 rehearsal jobs observed on GitHub ([17](17-technical-validation-strategy.md) §17.2.3) | — | Signing with the release key after the ceremony (O-SEC2) |
| O-D6 | IaC for dev/staging cell | infra/compose, tofu (staging-tn, pilot-tn), ansible, helm, argocd | Partial | Dev cell; tofu guards (R44); database tier incl. second site (R24, R32, R39); manifests on a real API server | Hosting provider | O-AC1 |
| O-D7 | Synthetic data generator, TN pack v0 | packages/synthetic-data, country-packs/tn | Done | Determinism, integrity tests; second pack as data (R43) | — | Official TN holiday list (Q-12) before pilot |
| O-D8 | Coding standards | [18](18-coding-standards.md) | Done | Fitness check in CI | — | — |
| O-A1 | Modular monolith skeleton | services/core | Done | e2e; boundary check | — | — |
| O-A2 | Keycloak | Dev realm; Operator + 3 instances | Done | HA test (R33, GitHub); realm conformance (R42, defect fixed) | — | — |
| O-A3 | PostgreSQL clusters | Dev cell; role postgresql_ha; pg-router | Done (containers) | 2/3-server suites (R24, GitHub); router defect fixed (R37); DR (R32, R39) | Hosting provider for real hosts | O-AC1 |
| O-A4 | Redis | Dev cell; Valkey HA chart | Done (containers, k3s) | R34; R38 cause found and fixed; chart on Kubernetes (R40, GitHub) | Founder: Valkey (ADR-008 condition) | — |
| O-A5 | Object storage | Dev cell (SeaweedFS); ADR-020 | Done (dev) | Anonymous refused (R7) | Provider S3 or self-hosted (doc 20) | — |
| O-A6 | Observability stack | Dev cell; kube-prometheus-stack, Loki, Tempo apps; 15 alert rules | Done | R21, R27, R35 (promtool), router metrics | — | Application alerts in Phase 3 |
| O-A7 | OPA/Cedar spike | spikes/policy-engine; ADR-006 | Done | 24/24 decisions (R16) | — | — |
| O-F1 | Health-check endpoints | /health, /health/ready | Done | e2e; probes | — | — |
| O-F2 | Feature-flag framework | packages/feature-flags | Done | Unit tests | — | — |
| O-F3 | i18n with RTL | packages/i18n; /v1/meta/locales | Done | Unit + e2e | — | — |
| O-DB1 | Base schemas iam, config, audit | core migrations | Done | Migration test; through pg-router as owner (R24) | — | — |
| O-DB2 | Migration tooling | node-pg-migrate; Helm hook | Done | Up/down/up test | — | — |
| O-API1 | GET /health | core | Done | e2e; contract; through the gateway (R41) | — | — |
| O-API2 | GET /v1/meta/locales | core | Done | e2e; contract; through the gateway with a token (R41) | — | — |
| O-API3 | OpenAPI pipeline | OpenAPI 3.1 contract, drift check, validator | Done | CI check (3 paths, house rules) | — | — |
| O-DEP | P1 IA outputs (partially) | Phase 1 docs 12, 15, 18 | Done | [00](00-specification-and-constraint-audit.md) §1 | — | — |
| O-SEC1 | Secrets management | OpenBao (dev; HA app); secret files | Done | gitleaks; release key not exportable (R36) | — | — |
| O-SEC2 | Signed builds | Keyless signing + provenance on main; signature enforcement; OpenBao signing path | Partial | Admission refuses unsigned (R36, GitHub); OpenBao signer path (R36) | Founder + second person (key ceremony) | Ceremony; first signed release on main |
| O-SEC3 | SBOM | Syft CycloneDX in CI | Done | 878 components (R14) | — | — |
| O-SEC4 | Branch protection | Settings specified ([07](07-security-and-privacy-architecture.md) §7.7) | Open — founder | — | Founder (GitHub admin) | Apply settings (P2-D5) |
| O-SEC5 | 2-reviewer rule | CODEOWNERS; settings | Open — founder | — | Second engineer or written waiver | Founder decision |
| O-T1 | Unit/integration scaffolds in the pipeline | 43 tests in 5 suites; CI build-test | Done | Local and GitHub | — | — |
| O-T2 | IaC scanning | Checkov; manifests; tofu guards; ansible-lint; realm check | Done | All pass in CI ([17](17-technical-validation-strategy.md) §17.4) | — | — |
| O-T3 | Deploy-from-scratch test | dev cell, air-gapped k3s, staging rehearsal | Done | Nightly on GitHub | — | — |
| O-AC1 | Staging cell reproducible from IaC in < 2 h | IaC + [doc 20](20-hosting-provider-assessment.md) (provider path) | **Blocked** | Staging-shaped rehearsal 169 s on runners (evidence, not the criterion) | Hosting provider (E-07) | Contract, then 8–12.5 engineer-days and the timed rebuild |
| O-AC2 | All ADRs approved | [ADR register](founder-review/P2-adr-final-review-register.md); decision form | **Open — founder** | Evidence per ADR (register §2) | Founder | Decision form (30 rows) |
| O-AC3 | Threat model reviewed by an external adviser | [Security review package](founder-review/P2-security-review-package.md) | **Open — external** | Internal tests done (package §2) | Adviser engaged by the founder | Review and findings |
| O-TIME | 6 weeks | [16](16-infrastructure-plan.md) §16.7 | Partial | Provider-independent work complete | Provider | Weeks needing hosts |
| O-RISK | No over-engineering | Time-boxed spikes; design-only ADRs for later phases | Done | §19.4 | — | — |
| O-BUD | 100–150k TND | [16](16-infrastructure-plan.md) §16.8 | Unchanged | No amount invented; prices only from quotes | Quotes | — |
| R-1 | ADRs cover financial-institution tenants | ADR-016, 019, 029; recovery objectives by data class (doc 15 §15.4.1) | Done | R24, R39 | Counsel/adviser on banking secrecy | — |
| R-2 | ADRs cover on-premises deployability | ADR-019, 013; static hosting adapter | Done | Air-gapped k3s (R18, GitHub) | — | — |
| R-3 | ADRs cover the financial data domain | ADR-018, 003; inventory | Done | Inventory rows DI-14–22 | — | — |
| R-4 | Rule packs as versioned configuration | ADR-017; country-packs | Done | Integrity tests; second country (R43) | — | — |
| R-5 | Tunisian hosting; no foreign processing | ADR-004, 029; tofu residency guard; doc 20 | Done (design + guard) | Guard refuses a foreign node (R44) | N-Cloud provider | O-AC1 |

**Count:**
- Done: 34.
- Partial: 4 (O-OBJ, O-D6, O-SEC2, O-TIME).
- Blocked: 1 (O-AC1).
- Open — founder: 3 (O-AC2, O-SEC4, O-SEC5).
- Open — external: 1 (O-AC3).
- Unchanged: 1 (O-BUD).

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
| O-A2 | Keycloak | Dev cell, realm `civora-dev`; [06](06-identity-and-access.md). Staging: Keycloak Operator 26.8.1 + 3 clustered instances (`infra/k8s/keycloak`) | Smoke test (OIDC discovery); HA test: session survives node loss (R33); operator under restricted Pod Security (patched, with control) | **Done** (dev); staging HA written and tested |
| O-A3 | PostgreSQL clusters | Dev cell: pg-public, pg-core, pg-consent-audit; ADR-003. Staging and production: role `postgresql_ha` (Patroni, etcd, pgBackRest) + `pg-router` chart | Smoke tests; migration test; database suite on systemd containers, 2 and 3 servers (31/31, 35/35 — [17](17-technical-validation-strategy.md) §17.2.1) | **Done** (dev); staging tier container-tested, real hosts need a provider |
| O-A4 | Redis | Dev cell (auth, AOF). Staging: Valkey HA chart (3 data nodes + 3 Sentinels) — Valkey pending the founder's licence answer | Smoke test (auth required); failover test 7 s (R34) | **Done** (dev); staging HA written and tested |
| O-A5 | Object storage | Dev cell SeaweedFS; ADR-020 | Smoke test (anonymous refused) | **Done** (dev) |
| O-A6 | Observability stack | Dev cell OTel + Prometheus + Loki + Tempo + Grafana; core metrics, logs and **traces** (allow-list exporter); [15](15-observability-backup-and-dr.md) | Smoke tests (login required; traces reach Tempo without request data); e2e `/metrics`; e2e trace-scrubbing test with negative control; log-privacy test with negative control (R27) | **Done** (dev); staging stack as Argo CD apps + infrastructure alerts unit-tested (R35) |
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
| O-T3 | Deploy-from-scratch test | `dev-cell-up.sh --fresh` (82 s, 9/9); `deploy-from-scratch.sh` (k3s, air-gapped); `staging-rehearsal.sh` (database tier + k3s + `pg-router` + civora-core) | All three pass on GitHub runners (20 Nov 2026): dev cell 107 s (10/10); air-gapped k3s 79 s (6/6 + upgrade); staging-shaped rehearsal 169 s to smoke tests, database failover survived without pod restart ([17](17-technical-validation-strategy.md) R18, §17.2.2) | **Done** for everything that needs no provider; the real-host run is O-AC1 |
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
