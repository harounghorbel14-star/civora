# Phase 2 Readiness Report — Technical Architecture

| | |
|---|---|
| Date | 19 November 2026 (Phase 2 week 1; updated the same day after the P2-D1 review package and further independent work) |
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
| Technical validation strategy with 30 recorded results (R1–R30) | [17](17-technical-validation-strategy.md) | — |
| Traceability matrix | [19](19-traceability-matrix.md) | All 39 original items + R-1–R-5 + 12 mission topics traced |
| Data inventory (43 items) | [data/data-inventory.csv](data/data-inventory.csv) | CSV and counts checked |
| Monorepo + walking skeleton (`civora-core`: `/health`, `/health/ready`, `/v1/meta/locales`, `/metrics`) | `services/core` | 24 tests + migration test pass; image runs non-root |
| Shared packages: i18n/RTL, feature flags, country packs (TN v0 + 3 BCT rule packs), synthetic data | `packages/*` | Unit tests; tamper detection; prod refuses synthetic pack |
| Dev cell (3 PostgreSQL clusters, Redis, S3 store, Keycloak, OpenBao, observability, core) | `infra/compose` | From scratch in **82 s**, 9/9 smoke checks |
| Helm chart, OpenTofu cell, Ansible (OS, RKE2, Argo CD), Argo CD objects | `infra/*` | Server-side validation on Kubernetes 1.33 (9/9); tofu validate/plan + residency negative test; ansible-lint production profile 0 failures |
| CI/CD with security gates; nightly rehearsals | `.github/` | Gates executed locally; Checkov on workflows 36/36; CI runs 20–21 (20 Nov 2026) all jobs green, incl. the kube-prometheus-stack render and promtool alert tests. **Nightly run 9: all 8 rehearsals green** (database 2 and 3 servers, DR, staging, k3s, dev cell, Keycloak + Valkey, image signatures). Details: [17](17-technical-validation-strategy.md) §17.2.3 |
| Database tier: role `postgresql_ha` (Patroni, etcd, pgBackRest, TLS, least-privilege accounts, PITR drill), `pg-router` chart, operations runbook | `infra/ansible/roles/postgresql_ha`, `infra/helm/pg-router`, [runbooks/database-operations.md](runbooks/database-operations.md) | Suite on systemd containers: 2 servers 31/31, 3 servers 35/35 ([17](17-technical-validation-strategy.md) §17.2.1) |
| Image admission policy (allowed registries + digest pins) | `infra/k8s/policies` | 10 cases on a Kubernetes 1.33 API server (R28) |
| Log-privacy test; database-failover resilience in the core service | `services/core` | Both found a real defect before passing (R26, R27) |
| Staging-shaped rehearsal (database tier + k3s + `pg-router` + civora-core) | `infra/scripts/staging-rehearsal.sh` | **Pass on GitHub:** from nothing to smoke tests in 169 s; application back 44 s after the database leader froze, no pod restart ([17](17-technical-validation-strategy.md) §17.2.2) |
| Platform services as code (Argo CD): admission policies, cert-manager, External Secrets, OpenBao | `infra/argocd/platform` | Pinned to upstream tags; OpenBao and External Secrets rendered and dry-run under restricted Pod Security (R31) |
| **Final technical decision package** (six decisions + P2-D2 to P2-D5) and ADR-030 (APISIX, Proposed) | [founder-review/P2-final-technical-decision-package.md](founder-review/P2-final-technical-decision-package.md) | Nothing approved; all 30 ADRs Proposed |
| Second backup site (repository 2) and full disaster recovery | Role `postgresql_ha` (`backup_dr`, `bootstrap_from_repo`); OpenTofu cell (`backup_dr`, site guard); [runbook](runbooks/database-operations.md) §8 | Site-loss rehearsal: 16 s of data lost, writes back after 85 s (R32); green on GitHub (nightly runs 6–7) |
| HA Keycloak (operator, 3 instances) and HA Valkey (3 + 3 Sentinels) | `infra/k8s/keycloak`, `infra/helm/valkey-ha` | Session survives node loss (R33; green on GitHub); Valkey failover 7 s here and on GitHub (nightly run 9, all 8 jobs green) after a test change; the earlier stall on GitHub is unexplained, so the chart's failover is re-tested on real staging (R34, R38) |
| Monitoring stack and infrastructure alerts | `infra/argocd/platform` (kube-prometheus-stack, Loki, Tempo), `infra/k8s/monitoring` | 11 alert rules unit-tested with promtool (R35); database-tier metrics over TLS |
| Image signature enforcement | `infra/k8s/policies/image-signatures.yaml`, policy-controller app | Restricted Pod Security (with control); **runtime test green on GitHub: 7/7 in 56 s** (R36, nightly run 7) |
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
| First GitHub CI run: Checkov failed on default namespaces and on skip annotations placed where Checkov does not read them | Explicit namespaces; skip annotations at resource level; CI green from run 2 |
| Database role: pgBackRest checks certificates by name; `tls-server-auth` syntax; drill config paths; **missing local replication rule blocked `pg_rewind` rejoin after a crash** | All fixed; suite 17/17 |
| CI runs 4–6 failed on Checkov findings in the test-node Dockerfile (I had run a narrower local scan) | Justified inline skips; local scan now uses CI's exact command |
| **civora-core exited on the first database failover** (unhandled connection-pool error), found by the new application-path test (20 Nov 2026) | Handler added; regression test fails without it; the suite now checks the process survives planned and crash failovers |
| **404 error responses echoed the full URL including the query string** — contrary to [07](07-security-and-privacy-architecture.md) §7.3 — found by the new log-privacy test | `title` is now the standard reason phrase; test kept as a gate |
| CI steps written as `script \| tee` could not fail (GitHub's default shell has no `pipefail`) — affected all three nightly jobs | `shell: bash` set for both workflows |
| The nightly rehearsals had never run: scheduled workflows start only from the default branch, and `nightly.yml` is not on `main` yet | Rehearsals now also run on pushes to working branches that touch what they exercise |
| My server-side chart validation (R8) claimed "restricted Pod Security", but Pod Security only warns for Deployments/StatefulSets and the script discarded the warnings | Warnings now fail the check, with a control. It immediately caught the OpenBao chart's non-compliant default (fixed in values). civora-core and pg-router pods have since run for real in restricted namespaces on GitHub |
| A new pod (the migration Job) can be refused for a moment until network policy is programmed for it; every Job retry is a new pod, so migrations failed in the staging rehearsal | civora-core waits for the database before migrating (up to 60 s; tested) |
| **False green in my staging rehearsal script:** a check containing `exit 0` ended the script early with success | Checks run in a subshell in all rehearsal scripts; the rehearsal then passed in full (run 5) |
| Two backup repositories started backups at the same moment; pgBackRest allows one backup per stanza at a time, so one failed (found by the DR rehearsal) | First backups serialised; repository 2 scheduled 2.5 h later; backup units retry |
| Upstream manifests that would be refused under restricted Pod Security: Keycloak Operator Deployment, policy-controller chart defaults (as earlier OpenBao) | Patched through Argo CD / values; each upstream default kept as a negative control in the validation |
| Test pitfalls found in my own checks: a token issuer bound to the node address (Keycloak test without a fixed hostname); `curl | grep -q` failing under `pipefail` on large outputs | Fixed in the tests; the hostname requirement is also in the Keycloak resource |
| **`pg-router` could send clients to a standby just after it started**: HAProxy treats servers as up until their first check fails (found on GitHub, 3-server leg, runs 6–7) | `init-state down`: no client goes to a server before a check shows it is the primary; readiness now waits for that (R37) |
| Valkey failover passed here (7 s) but stalled on GitHub runners. My first explanation (slow DNS answers) was disproved by a measurement on GitHub (0.00 s); the cause is not established. Then a race in my own test: it counted replicas still syncing as ready | Test resolves names as Kubernetes does (stable records): failover 6 s on GitHub. Start scripts no longer wait indefinitely on a silent Sentinel. Test waits for replicas in sync. Open: re-test on real staging (R38) |
| My kube-prometheus-stack check forced every rendered object into one namespace; the chart puts five scrape Services in `kube-system` (CI run 19) | Objects keep their own namespace |
| Applications had no designed path to a *moving* primary (staging values pointed straight at database IPs) | `pg-router` chart (HAProxy asks Patroni which node is primary; TLS verified); recorded as an implementation detail of ADR-003, not a new decision |

## 3. Acceptance-criteria status

| ID | Criterion (Phase 0 §19) | Status | What closes it |
|---|---|---|---|
| **O-AC1** | Staging cell reproducible from IaC in < 2 h | **BLOCKED** — no hosting provider. Remaining provider-specific work: 8–12.5 engineer-days ([16](16-infrastructure-plan.md) §16.7). Proven so far, everything that needs no provider: on GitHub runners, a staging-shaped cell (HA database tier built by the Ansible role + Kubernetes + `pg-router` + civora-core) goes from nothing to passing smoke tests in **169 s** and survives a database leader crash; IaC validates. This is evidence, not the criterion: real hosts, OS hardening, RKE2, DNS/TLS and platform services on hosts are not in it | Founder: obtain hosting quotes and choose a provider (Phase 1 action 10, E-07). Then the provider-specific IaC and a timed rebuild |
| **O-AC2** | All ADRs approved | **OPEN — founder** (29 ADRs "Proposed") | Founder decision P2-D1 (§4) |
| **O-AC3** | Threat model reviewed by an external security adviser | **OPEN — external** (no adviser engaged) | Founder decision P2-D3; request text in §7.2 |
| Additive R-1 to R-5 | ADR coverage of FI tenants, on-premises, financial data, rule packs, Tunisian hosting | **MET in design** ([19](19-traceability-matrix.md) §19.2) | — (R-2 rehearsal confirmed when CI runs) |

Partially met original items (details in [19](19-traceability-matrix.md) §19.1):
- **O-SEC2.** Signing and provenance run only on `main`; not yet observed (needs a merge).
- **O-D6.** Staging IaC written; database tier, `pg-router` and application tested together on GitHub runners; second site and DR rehearsed; not applied to real hosts (no provider). Platform services written as code: cert-manager, External Secrets, OpenBao, Keycloak HA, Valkey HA, monitoring, admission and signature policies. The ingress/gateway waits for ADR-030.
- **O-SEC4/O-SEC5.** Repository settings are a founder action.

Closed on 19 Nov 2026 (second session): **O-D5** (CI observed green on GitHub), **O-A6** (tracing with a privacy allow-list), **O-API3** (OpenAPI 3.1 with schema validation).

Advanced: **O-AC1** remaining work fell from 15–23 to 11.5–17 engineer-days. The database tier (ADR-003/029, still Proposed) is written and tested on containers: 17/17 checks, crash failover 29 s, verified restore drill.

Closed on 20 Nov 2026 (third session): **O-T3** (deploy-from-scratch: dev cell, air-gapped k3s and staging-shaped rehearsal all green on GitHub runners). Advanced:
- the database tier now has 31/31 checks with 2 servers and 35/35 with 3, including PITR and the application path through `pg-router`;
- the image admission policy is in place;
- the log-privacy test is in place;
- the platform services are written as code.

Defects found and fixed are listed in §2.

## 4. Unresolved decisions (founder)

| ID | Decision | Options | Recommendation | Needed by |
|---|---|---|---|---|
| **P2-D1** | Approve the 30 ADRs (individually or as a set; ADR-030 added 20 Nov 2026). **Review package:** [founder-review/P2-D1-adr-review-package.md](founder-review/P2-D1-adr-review-package.md); decision form: [P2-D1-decision-form.csv](founder-review/P2-D1-decision-form.csv) | Approve / approve with changes / reject per ADR | Approve as a set. Read first the ADRs that commit money or exclude options: ADR-003 (DB on VMs with Patroni + pgBackRest), ADR-006 (Cedar), ADR-016 (tenancy tiers), ADR-019 (customer-hosted), ADR-020 (no MinIO) | Week 2 |
| *(within P2-D1)* | ADR-003: 2 or 3 database servers per production site. **Measured 20 Nov 2026:** with 3, a leader crash while one standby is already down still fails over automatically (35 s, nothing lost). With 2, the same situation stops writes until an operator acts, and the operator's way out lost **all 50** writes acknowledged in the window ([17](17-technical-validation-strategy.md) §17.2.1) | 2 (lower cost) / 3 (RPO 0 **and** automatic failover) | 3 for bank production; 2 acceptable for staging | With P2-D1 |
| *(within P2-D1, new)* | **ADR-030** (drafted 20 Nov 2026 from the ADR-013 open question): the MVP ingress controller named in Phase 0 ("NGINX ingress") — the community ingress-nginx was retired upstream in March 2026 and gets no security fixes | (a) APISIX from the MVP (Phase 0's pilot choice, brought forward); (b) a maintained NGINX product; (c) another Gateway API controller until pilot | (a) | Before staging is exposed publicly |
| *(within P2-D1, new)* | ADR-008: Redis ≥ 7.4 is not open source (RSALv2/SSPLv1; Redis 8 adds AGPLv3) — matters for customer-hosted redistribution | Valkey 9.1 (BSD) / Redis 8 (AGPLv3) / keep Redis 7.4 | Valkey | Before the HA cache goes to staging |
| **Decision package** | All of the above plus decisions on ADR-006, ADR-016, ADR-019, ADR-020 and recommendations for P2-D2 to P2-D5, in decision-ready form: [P2-final-technical-decision-package.md](founder-review/P2-final-technical-decision-package.md) | — | — | — |
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
| R2-4 | ~~CI not yet observed running on GitHub~~ **Closed 19 Nov 2026**: run 1 exposed one Checkov defect (fixed); run 2 green | — | — | — |
| R2-5 | Phase 1 outcome changes the first product (P1-D3) | Medium / Medium | Shared-engine design; sensitivity table ([00](00-specification-and-constraint-audit.md) §4) | Founder |
| R2-6 | Counsel concludes SaaS is not possible for banks without BCT approval | Medium / Medium | Tier 4 (customer-hosted) designed and rehearsable air-gapped | Founder / counsel |
| R2-7 | Tunisian GPU capacity unknown (Phase 10) | Medium / Medium | Location policy; decision deferred to Phase 10 | — |
| R2-8 | Fast-moving dependencies (NestJS 12, TypeScript 7, Keycloak) | Medium / Low | Pins, Dependabot, ADR-002 revisit in Phase 3 | Engineering |
| R2-10 | With 2 database servers in synchronous mode, automatic failover is refused while no synchronous standby is designated (measured: 120 s with no promotion; no split-brain). The manual way out loses the writes acknowledged in that window (measured: 50 of 50) | Low / Medium | 3 database servers per production site (tested: automatic, nothing lost), or the manual procedure in the [database runbook](runbooks/database-operations.md) §4 with its data-loss cost accepted in writing | Founder (P2-D1) / engineering |
| R2-11 | The Phase 0 MVP ingress controller (community ingress-nginx) is unmaintained since March 2026 | High (if used) / High | Decision within P2-D1 (**ADR-030**); until then no public exposure | Founder |
| R2-12 | Third-party packaging changes: Bitnami's free images unmaintained since 2025; Redis ≥ 7.4 not open source | Medium / Medium | No Bitnami charts or images used; Valkey recommended (ADR-008 open question); pins verified against upstream tags | Engineering / founder (Valkey) |
| R2-13 | Image signatures depend on a release key that does not exist yet (ceremony needs a second person) | Medium / High | Enforcement built; key ceremony before pilot with M-of-N custody (P2-D2) | Founder / engineering |
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

- Engineering builds the provider adapter and the platform services, and runs the already-tested PostgreSQL role on the real hosts (11.5–18 engineer-days).
- Engineering then runs the timed staging rebuild for O-AC1.

**Phase 2 is not accepted by this report, and Phase 1 remains not approved.**
