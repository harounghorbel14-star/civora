# 0. Phase 2 Specification and Constraint Audit

| | |
|---|---|
| Phase | **Phase 2 — Technical Architecture** (original name and position unchanged) |
| Started | 19 November 2026, on the founder's decision **P2-D0** (§1) |
| Phase 1 status | **Not approved** (P1-D12 pending). Phase 1 validation stays open and is tracked separately in [../phase-1/validation-evidence-register.md](../phase-1/validation-evidence-register.md) |
| Purpose of this document | Restate the original Phase 2 specification word for word, list every architectural constraint from Phase 0 and Phase 1, and show that starting Phase 2 respects the roadmap rules |

## 1. Decision to start Phase 2 (P2-D0) and roadmap compliance

| Item | Record |
|---|---|
| Founder instruction (19 Nov 2026) | "I have decided to begin Phase 2 — Technical Architecture. Proceed with Phase 2 while preserving the entire original 15-phase roadmap and all approved requirements." Also: "Keep Phase 1 validation open… Do not claim Phase 1 is formally approved." |
| Approved execution model | **P1-D4: overlapping independent activities.** Phases *start* in order. A phase may start while the previous phase finishes, **if its own Phase 0 §19 dependencies are met**. Phases are *accepted* in order ([roadmap protection matrix](../phase-1/roadmap-protection-matrix.md) §3) |
| Phase 2 dependency (Phase 0 §19) | "P1 IA outputs (partially)". **Met:** [Phase 1 doc 15](../phase-1/15-information-architecture.md) (IA, incl. §15.8–§15.9), PRD 1.1, the shared platform requirements ([18](../phase-1/18-shared-platform-requirements.md)) and NFRs ([12](../phase-1/12-product-requirements-document.md) §12.7) all exist |
| Earlier statements superseded by P2-D0 | "Do not begin Phase 2 … until the founder explicitly approves Phase 1" (Phase 1 directive) and "Phase 2 not before approval" (Phase 0 §20 note). **The founder has now explicitly instructed the start.** Approval of Phase 1 is still pending. These statements are annotated, not deleted |
| Consequences | (1) **Phase 2 cannot be accepted before Phase 1 is accepted** (acceptance in order). (2) Phase 1 evidence (E-01–E-15) keeps being tracked separately. (3) If Phase 1 validation changes the first product (P1-D3), the affected Phase 2 ADRs are re-opened; §4 lists the sensitivity |

## 2. Original Phase 2 specification (Phase 0 §19, unchanged)

Each item gets an ID used in the [traceability matrix](19-traceability-matrix.md).

| ID | Original text | Where it is delivered |
|---|---|---|
| **O-OBJ** | Objectives: "turn Section 8 into approved ADRs and a working skeleton" | All of Phase 2 |
| **O-D1** | Deliverable: ADR-001..014 | [adr/](adr/) |
| **O-D2** | Deliverable: full STRIDE threat model | [08-threat-model.md](08-threat-model.md) |
| **O-D3** | Deliverable: data inventory and classification | [05](05-data-architecture-and-governance.md) §5.3; [data/data-inventory.csv](data/data-inventory.csv) |
| **O-D4** | Deliverable: repository structure (monorepo: apps/web, apps/mobile, apps/workspace, services/core, services/guide, services/health-bridge, packages/*) | Repository root ([ADR-023](adr/ADR-023-monorepo-and-repository-structure.md)) |
| **O-D5** | Deliverable: CI/CD pipeline with security gates | `.github/workflows/` ([16](16-infrastructure-plan.md) §16.4) |
| **O-D6** | Deliverable: IaC for dev/staging cell | `infra/` ([16](16-infrastructure-plan.md)) |
| **O-D7** | Deliverable: synthetic data generator (TN country pack v0) | `packages/synthetic-data`, `packages/country-packs/tn` |
| **O-D8** | Deliverable: coding standards | [18-coding-standards.md](18-coding-standards.md) |
| **O-A1** | Architecture: modular monolith skeleton | `services/core` |
| **O-A2** | Architecture: Keycloak | Dev cell; [06](06-identity-and-access.md) |
| **O-A3** | Architecture: PostgreSQL clusters | Dev cell; [05](05-data-architecture-and-governance.md) |
| **O-A4** | Architecture: Redis | Dev cell |
| **O-A5** | Architecture: object storage | Dev cell |
| **O-A6** | Architecture: observability stack | Dev cell; [15](15-observability-backup-and-dr.md) |
| **O-A7** | Architecture: OPA/Cedar evaluation spike | `spikes/policy-engine/`; [ADR-006](adr/ADR-006-policy-engine-for-abac.md) |
| **O-F1** | Features: health-check endpoints | `GET /health` |
| **O-F2** | Features: feature-flag framework | `packages/feature-flags` |
| **O-F3** | Features: i18n framework with RTL | `packages/i18n` |
| **O-DB1** | Database changes: base schemas `iam`, `config`, `audit` (empty) | `services/core/migrations` |
| **O-DB2** | Database changes: migration tooling | [ADR-024](adr/ADR-024-database-migration-tooling.md) |
| **O-API1** | API endpoints: `GET /health` | `services/core` |
| **O-API2** | API endpoints: `GET /v1/meta/locales` | `services/core` |
| **O-API3** | API endpoints: OpenAPI pipeline | `services/core/openapi`, CI |
| **O-DEP** | Dependencies: P1 IA outputs (partially) | §1 |
| **O-SEC1** | Security: secrets management | [07](07-security-and-privacy-architecture.md) §7.4; dev cell |
| **O-SEC2** | Security: signed builds | CI ([ADR-027](adr/ADR-027-software-supply-chain-security.md)) |
| **O-SEC3** | Security: SBOM | CI |
| **O-SEC4** | Security: branch protection | [16](16-infrastructure-plan.md) §16.5 (repository settings; **founder action**) |
| **O-SEC5** | Security: 2-reviewer rule | [16](16-infrastructure-plan.md) §16.5 (**founder action**; needs 2 engineers) |
| **O-T1** | Testing: pipeline runs unit/integration test scaffolds | CI + `services/core/test` |
| **O-T2** | Testing: IaC scanning | CI (checkov) |
| **O-T3** | Testing: a deploy-from-scratch test | `infra/scripts/deploy-from-scratch.sh` ([17](17-technical-validation-strategy.md)) |
| **O-AC1** | Acceptance: staging cell reproducible from IaC in < 2 h | [Readiness report](phase-2-readiness-report.md) §3 |
| **O-AC2** | Acceptance: all ADRs approved | **Founder** (ADR status "Proposed") |
| **O-AC3** | Acceptance: threat model reviewed by external security adviser | **External adviser** |
| **O-TIME** | Time: 6 weeks | Plan in [16](16-infrastructure-plan.md) §16.7 |
| **O-RISK** | Risks: over-engineering (time-boxed spikes, ADR scope discipline) | Applied throughout |
| **O-BUD** | Budget: 100–150k TND | Unchanged [A] |

### Additive scope recorded in the roadmap protection matrix (Phase 1, P1-D4)

| ID | Additive acceptance item for Phase 2 | Source |
|---|---|---|
| **R-1** | ADRs cover financial-institution tenants | [Roadmap matrix](../phase-1/roadmap-protection-matrix.md) Phase 2 row |
| **R-2** | ADRs cover on-premises deployability | Same |
| **R-3** | ADRs cover the financial data domain | Same; Phase 1 [18](../phase-1/18-shared-platform-requirements.md) §18.2 |
| **R-4** | Rule packs as versioned configuration (FR-66) | Same; PRD 1.1 |
| **R-5** | Tunisian hosting without foreign processing of personal data (Law 2004-63 Art. 50–52) | Same; PRD §12.7 |

## 3. Architectural constraints inherited from Phase 0 and Phase 1

**None of these is re-decided in Phase 2.** ADRs implement them.

### 3.1 Approved decisions

| Decision | Constraint | Status |
|---|---|---|
| D1 / P1-D1 | Infrastructure vendor and operator to sovereign systems; **six divisions on one shared platform** | Approved |
| D7 | Stack: TypeScript end-to-end (NestJS, Next.js, React Native), PostgreSQL, Keycloak, OPA/Cedar, Kubernetes, OpenTofu, Argo CD ("Stack confirmed for Phase 2 ADRs") | Approved |
| D9 | Hosting: **synthetic-only dev/staging on any cloud**; pilots and production only on CNI or G-Cloud/N-Cloud-labelled Tunisian hosts | Approved |
| D10 | AI: model gateway; foreign API models only for public content without personal data and with client approval; in-country models for any personal data | Approved |
| P1-D2 | Enterprise first; Government active pipeline; Identity via partners; AI Phase 10; Health Phase 7; Connect as shared infrastructure | Approved |
| P1-D4 | Original roadmap; full scope per phase; overlapping independent activities | Approved |
| P1-D5 | Design-partner trials only on synthetic or properly authorised test data; no unauthorised production before Phase 13 | Approved |
| P1-D6 | Six integration classes in all documentation | Approved |
| P1-D8 | Identity: partner for e-KYC, do not build | Approved |
| P1-D10 | Catalogue exclusions: no operational policing, emergency dispatch, electoral administration, restricted national registers | Approved with boundaries |
| P1-D3 | First product Workspace RF | **Conditional**. Phase 2 designs the **shared engine**, so architecture holds if P1-D3 changes (§4) |
| P1-D7, P1-D9 | Financials and prices | Conditional; no architecture impact |
| P1-D14 | Workspace AI inside Phase 10 | Pending; architecture leaves room, builds nothing |
| D11 | Open-source / open-core strategy | **Pending**. Repository licence left as "all rights reserved" until decided ([ADR-023](adr/ADR-023-monorepo-and-repository-structure.md)) |

### 3.2 Non-functional and platform requirements (Phase 1)

| Source | Constraint |
|---|---|
| PRD §12.7 | Hosting and residency; ASVS L2 (L3 for auth and audit); MFA and SSO; TLS 1.3; field-level encryption; availability 99.5% pilot / 99.9% production; p95 < 1.5 s; status page LCP < 2.5 s on 3G; queue < 1 s for 5,000 open cases; 500 concurrent agents and 1M cases per tenant; WCAG 2.2 AA; AR/FR/EN with RTL; daily hash-chain anchor; RPO ≤ 15 min, RTO ≤ 4 h; observability without personal data; **no foreign sub-processors for personal data**; export/exit |
| [18](../phase-1/18-shared-platform-requirements.md) §18.1 | 18 capabilities with timing classes (MVP-required / minimal / deferred) |
| §18.2 | Data-domain separation: financial, government, identity, health |
| **§18.3 non-goals** | **No microservices split before the Phase 0 §8.11 triggers; no multi-country runtime before Phase 15; no generic low-code builder; no AI components before Phase 10** |
| PRD FR-60–FR-66 | Case types, regulatory deadline ceiling, Annex 1 data, statements, **rule packs** |

### 3.3 Legal constraints (verified texts; interpretation pending counsel)

| Text | Architectural consequence |
|---|---|
| Law 2004-63 Art. 18–19 | Access control; ex-post verifiability of who accessed and changed what; secure backups |
| Art. 20, 22, 23 | Processor obligations; conditions for staff with access (counsel B3) → in-cell support model |
| Art. 27, 31 | Consent and information duties (Government and research) |
| **Art. 50–52** | No transfer of personal data abroad without INPDP authorisation → country cells, in-country sub-processors, observability without personal data |
| Law 2016-48 Art. 61, 81 | Banking secrecy; outsourcing notice to the BCT → audit rights, on-premises option |
| Decree-law 2023-17 Art. 6–8, 12–14, 17–20 | Annual audit; labelled clouds for government systems; incident response |
| BCT 2022-08 Art. 8–9, 14 | Deadline engine, audit, Annex 1 data, ROGS760 dataset (Phase 6 build) |

### 3.4 Open items that Phase 2 must not assume away

- **No hosting provider is contracted.** E-07 quotes are pending, so Phase 2 IaC is provider-agnostic: Kubernetes plus Ansible for k3s on VMs.
- **No institutional integration exists.** Integration classes 1–2 = 0. All adapters ship as `simulated` only.
- **No legal approval exists.** INPDP is reported as inactive (Phase 1, R40). There are no real personal data in any environment.
- **No external security adviser is engaged**, so O-AC3 is open.
- **The founder must approve the ADRs** (O-AC2).

## 4. Sensitivity to Phase 1 outcomes

| If Phase 1 evidence shows… | Phase 2 impact |
|---|---|
| P1-D3 confirmed | None |
| P1-D3 revised to document processing (scored #2) | AI work would move closer, but Phase 10 sequencing still applies. Re-open ADR-010 and ADR-026 for the timing of design work only |
| P1-D3 revised to Government-first | None for the platform. The rule packs gain a public-sector pack earlier |
| Banks demand on-premises only (Art. 81 outcome) | ADR-019 already covers customer-hosted cells. The priority of the packaging work rises |
| Counsel: SaaS is not possible without BCT approval | ADR-019 tier 4 (customer-hosted) becomes the default for banks |
