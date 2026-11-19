# Phase 2 Readiness Report — Technical Architecture

| | |
|---|---|
| Date | 19 November 2026 (Phase 2 week 1) |
| Verdict | **IN PROGRESS — NOT READY FOR ACCEPTANCE.** All Phase 2 work that could be done without a hosting provider, an external adviser or founder approvals is complete and verified. Three acceptance criteria remain open (§3) |
| Phase 1 | **Not approved** (P1-D12 pending). Phase 2 cannot be accepted before Phase 1 (acceptance in order, P1-D4). Phase 1 evidence is unchanged and tracked in [../phase-1/validation-evidence-register.md](../phase-1/validation-evidence-register.md) |
| Roadmap | Unchanged: 16 phases (0–15), original names and order. Phase 2 scope kept word for word ([00](00-specification-and-constraint-audit.md) §2) |

## 1. Completed deliverables

| Deliverable | Where | Verified by |
|---|---|---|
| Specification and constraint audit; start decision P2-D0 | [00](00-specification-and-constraint-audit.md) | Review against Phase 0 §19 and Phase 1 registers |
| Architecture documentation (18 documents) | [01](01-architecture-overview.md)–[18](18-coding-standards.md) | Link and diagram QA (§6) |
| 29 ADRs (001–014 = Phase 0 topics unchanged; 015–029 new) | [adr/](adr/README.md) | Topic match with Phase 0 §8.12 |
| STRIDE threat model (52 threats) | [08](08-threat-model.md) | Self-review; **external review pending** |
| Data-flow diagrams (DFD-0 to DFD-8, trust boundaries TB1–TB10) | [09](09-data-flow-diagrams.md) | Diagram QA |
| API standards | [10](10-api-architecture-and-standards.md), ADR-015 | Contract drift check |
| Infrastructure plan | [16](16-infrastructure-plan.md) | IaC validation |
| Technical validation strategy with 19 recorded results | [17](17-technical-validation-strategy.md) | — |
| Traceability matrix | [19](19-traceability-matrix.md) | All 39 original items + R-1–R-5 + 12 mission topics traced |
| Data inventory (43 items) | [data/data-inventory.csv](data/data-inventory.csv) | CSV and counts checked |
| Monorepo + walking skeleton (`civora-core`: `/health`, `/health/ready`, `/v1/meta/locales`, `/metrics`) | `services/core` | 24 tests + migration test pass; image runs non-root |
| Shared packages: i18n/RTL, feature flags, country packs (TN v0 + 3 BCT rule packs), synthetic data | `packages/*` | Unit tests; tamper detection; prod refuses synthetic pack |
| Dev cell (3 PostgreSQL clusters, Redis, S3 store, Keycloak, OpenBao, observability, core) | `infra/compose` | From scratch in **82 s**, 9/9 smoke checks |
| Helm chart, OpenTofu cell, Ansible (OS, RKE2, Argo CD), Argo CD objects | `infra/*` | Server-side validation on Kubernetes 1.33 (9/9); tofu validate/plan + residency negative test; ansible-lint production profile 0 failures |
| CI/CD with security gates; nightly rehearsals | `.github/` | Gates executed locally; Checkov on workflows 36/36 |
| OPA vs Cedar spike → ADR-006 (Cedar) | `spikes/policy-engine` | 24/24 decisions agree across Cedar, OPA-wasm, OPA-REST |

**Security results this week:**
- Trivy fixable HIGH/CRITICAL went from **21 to 0** (dependency upgrades; npm removed from the runtime image).
- gitleaks found no leaks.
- `pnpm audit` found no high or critical issues.
- Server-side validation found and fixed one real defect (NetworkPolicy selector).

## 2. Corrections made during Phase 2 (surfaced, not silent)

| Issue | Fix |
|---|---|
| ADR numbers in early code comments did not match Phase 0's ADR-001–014 topics | Aligned; Phase 0 topics kept; new ADRs numbered from 015 |
| Data-tier labels in early comments reversed Phase 0 §10.1 (T0 is special category, T3 public) | Corrected everywhere, including the policy spike (re-run: 24/24) |
| An in-cluster PostgreSQL operator was first assumed for staging | Replaced by Phase 0's tooling: Patroni + pgBackRest on database nodes |
| Package tests were not actually executed (`node --test dist/` ran one file) | Test globs fixed; all suites now run (24 tests) |
| Keycloak 26 rejected a realm attribute | Removed; realm files are validated by real import (nightly) |
| `@cedar-policy/cedar-wasm@4.14.1` was an empty publish | Pinned 4.14.0; recorded as a supply-chain lesson |

## 3. Acceptance-criteria status

| ID | Criterion (Phase 0 §19) | Status | What closes it |
|---|---|---|---|
| **O-AC1** | Staging cell reproducible from IaC in < 2 h | **BLOCKED** — no hosting provider. Proven so far: dev cell 82 s; manifests valid on a real API server; IaC validates | Founder: obtain hosting quotes and choose a provider (Phase 1 action 10, E-07). Then 15–23 engineer-days of provider-specific IaC ([16](16-infrastructure-plan.md) §16.7) and a timed rebuild |
| **O-AC2** | All ADRs approved | **OPEN — founder** (29 ADRs "Proposed") | Founder decision P2-D1 (§4) |
| **O-AC3** | Threat model reviewed by an external security adviser | **OPEN — external** (no adviser engaged) | Founder decision P2-D3; request text in §7.2 |
| Additive R-1 to R-5 | ADR coverage of FI tenants, on-premises, financial data, rule packs, Tunisian hosting | **MET in design** ([19](19-traceability-matrix.md) §19.2) | — (R-2 rehearsal confirmed when CI runs) |

Partially met original items (details in [19](19-traceability-matrix.md) §19.1):
- **O-D5 / O-SEC2.** First run on GitHub not yet observed.
- **O-D6.** Staging IaC not applied.
- **O-A6.** Application tracing comes in Phase 3.
- **O-API3.** The contract is OpenAPI 3.0; 3.1 comes in Phase 3.
- **O-T3.** The k3s rehearsal could not run in this sandbox.
- **O-SEC4/O-SEC5.** Repository settings are a founder action.

## 4. Unresolved decisions (founder)

| ID | Decision | Options | Recommendation | Needed by |
|---|---|---|---|---|
| **P2-D1** | Approve the 29 ADRs (individually or as a set). **Review package:** [founder-review/P2-D1-adr-review-package.md](founder-review/P2-D1-adr-review-package.md); decision form: [P2-D1-decision-form.csv](founder-review/P2-D1-decision-form.csv) | Approve / approve with changes / reject per ADR | Approve as a set. Read first the ADRs that commit money or exclude options: ADR-003 (DB on VMs with Patroni + pgBackRest), ADR-006 (Cedar), ADR-016 (tenancy tiers), ADR-019 (customer-hosted), ADR-020 (no MinIO) | Week 2 |
| **P2-D2** | Interim exception to the 2-reviewer rule while there is one engineer | (a) time-limited waiver with founder self-review; (b) external reviewer for `infra/`, migrations and policies; (c) pause merges | **(b)** for security-relevant paths + (a) for documentation; end the waiver when engineer #2 joins | Week 2 |
| **P2-D3** | Engage an external security adviser to review the threat model (O-AC3) | Separate engagement / add to the ANCS audit RFQ | Add it as a line item to the ANCS-auditor quote requests already prepared (2–3 days) | Week 2 |
| **P2-D4** | Hosting provider for staging (and later pilot) | Per quotes (E-07) | Choose on the criteria in [13](13-cloud-and-deployment-architecture.md) §13.6; staging may start on any host with synthetic data (D9) if the Tunisian provider is slow to contract | Week 3 |
| **P2-D5** | Apply branch protection and enable GitHub Actions | — | Apply the settings in [07](07-security-and-privacy-architecture.md) §7.7 | Week 2 |
| Carried | D11 open-source strategy; P1-D3 first product (conditional); P1-D12 Phase 1 approval; P1-D14 Workspace AI | — | Unchanged; architecture is robust to the P1-D3 outcomes ([00](00-specification-and-constraint-audit.md) §4) | Per Phase 1 |

Open questions for counsel that affect the architecture (already in the Phase 1 counsel brief):
- **Q-07.** May an information request suspend the deadline? It is encoded as "no".
- **The RP-BCT-2026-10 ceiling.** It is encoded as `null`.
- **The RP-BCT-2020-11 start point.**
- **Outsourcing under Art. 81.** The answer decides whether tier 4 becomes the default for banks.
- **Lawful bases and controller/processor roles.** These are the inventory assumptions.

## 5. Risks

| # | Risk | Likelihood / impact | Mitigation | Owner |
|---|---|---|---|---|
| R2-1 | **No hosting provider** blocks O-AC1 and every later phase that needs staging | High / High | Provider-agnostic IaC done; D9 allows synthetic staging on any host as a stopgap | Founder (E-07) |
| R2-2 | **One engineer**: no second reviewer; key custody concentrated (threat model T-30, T-26, T-52) | High / High | P2-D2 interim reviewer; branch protection; M-of-N ceremonies before pilot; hire (Phase 1 action 11) | Founder |
| R2-3 | Threat model not externally reviewed; ratings may be wrong | Medium / High | P2-D3 | Founder |
| R2-4 | CI not yet observed running on GitHub; workflow defects possible | Medium / Medium | First run in week 2; fix forward | Engineering |
| R2-5 | Phase 1 outcome changes the first product (P1-D3) | Medium / Medium | Shared-engine design; sensitivity table ([00](00-specification-and-constraint-audit.md) §4) | Founder |
| R2-6 | Counsel concludes SaaS is not possible for banks without BCT approval | Medium / Medium | Tier 4 (customer-hosted) designed and rehearsable air-gapped | Founder / counsel |
| R2-7 | Tunisian GPU capacity unknown (Phase 10) | Medium / Medium | Location policy; decision deferred to Phase 10 | — |
| R2-8 | Fast-moving dependencies (NestJS 12, TypeScript 7, Keycloak) | Medium / Low | Pins, Dependabot, ADR-002 revisit in Phase 3 | Engineering |
| R2-9 | Over-engineering for an unvalidated market (O-RISK) | Medium / Medium | Design-only ADRs for later phases; nothing built beyond Phase 0 §19 items | Engineering |

## 6. Quality checks run for this report

| Check | Result |
|---|---|
| Internal links (whole repository, incl. anchors) | **998 checked, 0 broken** |
| Mermaid diagrams in `docs/phase-2` | **21/21 render** (Mermaid 11) |
| No claim that Phase 1 is approved | Searched: every mention says "pending" or "not approved" |
| Roadmap unchanged | No phase renamed, removed, reordered or merged |
| No fabricated evidence | No interviews, quotes, approvals or integrations claimed; integration register unchanged (0 live) |
| Synthetic data only | Fitness check passes; no real identifiers in the repository |

## 7. Founder actions (in order)

### 7.1 This week

1. **Decide P2-D1 to P2-D3** (§4). Record each answer in this report, or tell the engineering lead and it will be recorded.
2. **Apply GitHub settings** (P2-D5):
   - Settings → Actions: allow GitHub Actions.
   - Settings → Branches → add a rule for `main` with the values in [07](07-security-and-privacy-architecture.md) §7.7.
   - Then open a test pull request so the six CI jobs run once.
3. **Send the hosting and security-audit quote requests** already prepared in Phase 1 ([quote-requests.md](../phase-1/validation/quote-requests.md) §1.3, §2.2). Add the threat-model review line from §7.2.

### 7.2 Text to add to the security-auditor request (FR)

> **Objet : revue externe d'un modèle de menaces (2 à 3 jours)**
>
> En complément de notre demande d'audit, nous souhaitons une revue indépendante de notre modèle de menaces STRIDE (52 menaces, 9 diagrammes de flux de données) pour une plateforme SaaS de traitement des réclamations destinée aux établissements financiers tunisiens (données synthétiques uniquement à ce stade). Livrable attendu : constats écrits avec niveau de gravité, et réponses à cinq questions précises (catégories manquantes, cotation, suffisance de l'isolation entre locataires au regard du secret bancaire, procédure « break-glass », prérequis avant un pilote avec données réelles). Merci d'indiquer un prix forfaitaire et un délai.

### 7.3 After a provider is chosen

- Engineering builds the provider adapter, the PostgreSQL role and the platform services (15–23 engineer-days).
- Engineering then runs the timed staging rebuild for O-AC1.

**Phase 2 is not accepted by this report, and Phase 1 remains not approved.**
