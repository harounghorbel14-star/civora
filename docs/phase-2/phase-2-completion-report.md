# Phase 2 — Technical Architecture: completion report

| | |
|---|---|
| Date | 20 November 2026 |
| **Status** | **APPROVED BY THE FOUNDER on 21 Nov 2026** ([decision record](founder-review/P2-founder-decision-record.md)). *Engineering readiness assessment at approval: NOT READY — EXTERNAL BLOCKERS REMAIN (O-AC1, O-AC3), carried forward as CF-1 and CF-2* |
| Why | The three original acceptance criteria each need someone outside engineering: **O-AC1** a hosting provider (staging from IaC in < 2 h), **O-AC2** the founder's approval of the ADRs, **O-AC3** an external security adviser. Everything that could be done without them is done and tested |
| Approvals | **21 Nov 2026:** Phase 1 approved (P1-D12); all 30 ADRs accepted, 6 with conditions (P2-D1); Phase 2 approved (P2-ACC); Phase 3 started (P3-D0). *20 Nov 2026 text: none recorded* |
| Roadmap | Original 15 phases unchanged; all original Phase 2 objectives, deliverables and acceptance criteria preserved ([00](00-specification-and-constraint-audit.md) §2); overlapping execution model kept (P1-D4) |
| Phase 1 | **Approved** 21 Nov 2026 (P1-D12); open validation evidence stays tracked separately |

## 1. Phase 2 acceptance checklist

| # | Criterion (original text) | Status | What closes it |
|---|---|---|---|
| O-AC1 | Staging cell reproducible from IaC in < 2 h | **Not met — carried forward (CF-1)** | Choose a provider ([20](20-hosting-provider-assessment.md)); then 8–12.5 engineer-days and a timed rebuild. Evidence so far: a staging-shaped cell from nothing to passing smoke tests in 169 s on runners (R30) |
| O-AC2 | All ADRs approved | **Met** (P2-D1, 21 Nov 2026) | Fill the [decision form](founder-review/P2-D1-decision-form.csv) using the [ADR register](founder-review/P2-adr-final-review-register.md) (24 approve, 6 approve with conditions) |
| O-AC3 | Threat model reviewed by an external security adviser | **Not met — carried forward (CF-2)** | Engage an adviser; send the [security review package](founder-review/P2-security-review-package.md) |
| R-1 – R-5 | Additive roadmap acceptance items | **Done** (R-5 with guard; real hosting with the provider) | — |
| Other original items | Objectives, deliverables, architecture, features, database, API, security, testing | 34 done, 4 partial, 3 open (founder), 1 unchanged (budget) | [19](19-traceability-matrix.md) §19.0 |

## 2. Documentation index (final)

| Area | Documents |
|---|---|
| Scope and traceability | [00 audit](00-specification-and-constraint-audit.md) · [19 traceability](19-traceability-matrix.md) (§19.0 final) · [readiness report](phase-2-readiness-report.md) (detailed history) |
| Architecture | [01 overview](01-architecture-overview.md) · [02 divisions](02-business-divisions-and-capability-map.md) (all six) · [03 global core and country configuration](03-global-core-and-country-configuration.md) · [04 multi-tenancy](04-multi-tenant-architecture.md) · [05 data](05-data-architecture-and-governance.md) · [10 API](10-api-architecture-and-standards.md) · [11 integration](11-integration-architecture.md) · [12 AI](12-ai-and-agent-infrastructure.md) · [13 cloud and deployment](13-cloud-and-deployment-architecture.md) · [14 scalability](14-scalability-and-performance.md) |
| Security | [06 identity](06-identity-and-access.md) · [07 security and privacy](07-security-and-privacy-architecture.md) · [08 threat model](08-threat-model.md) · [09 data flows](09-data-flow-diagrams.md) · [security review package](founder-review/P2-security-review-package.md) |
| Operations | [15 observability, backup, DR](15-observability-backup-and-dr.md) (§15.4.1 recovery objectives by data class) · [16 infrastructure plan](16-infrastructure-plan.md) · [20 hosting assessment](20-hosting-provider-assessment.md) · runbooks: [database](runbooks/database-operations.md), [release key](runbooks/release-key-ceremony.md) |
| Quality | [17 validation](17-technical-validation-strategy.md) (R1–R44, GitHub results §17.2.3) · [18 coding standards](18-coding-standards.md) |
| Decisions | [ADR index](adr/README.md) (30) · [ADR final review register](founder-review/P2-adr-final-review-register.md) · [decision form](founder-review/P2-D1-decision-form.csv) · [plain-language review](founder-review/P2-D1-adr-review-package.md) · [final technical decision package](founder-review/P2-final-technical-decision-package.md) |

## 3. ADR register (summary)

30 ADRs, all **Proposed**:
- 21 implemented to the extent Phase 2 needs, and tested;
- 5 partially implemented (the remainder is named later-phase or staging work);
- 4 design-only by design (Phases 4, 7, 10).

**Recommendation:** approve 24. Approve 6 with conditions:
- **ADR-003:** three database servers per regulated site, and a live second site for critical data;
- **ADR-008:** Valkey instead of Redis;
- **ADR-012:** Shamir unseal until an HSM is available;
- **ADR-027:** the release-key revision;
- **ADR-029:** recovery objectives by data class;
- **ADR-030:** APISIX 3.19.0, with a staging proof of the controller and WAF.

Details: [register](founder-review/P2-adr-final-review-register.md).

## 4. Technical test evidence (this session's additions; full list in [17](17-technical-validation-strategy.md))

| Area | Result | Where it ran |
|---|---|---|
| Unit, e2e, integration | 43 tests, 5 suites, all pass; module-boundary and synthetic-data fitness; OpenAPI 3.1 contract check | Local + CI |
| Disaster recovery, live second site | **0 of 194 acknowledged writes lost**; promotion 3 s; writes back 9 s after site loss (R39) | GitHub |
| Disaster recovery, repository only | Last 16 s lost; writes back after 70–85 s (R32) | GitHub |
| Database HA (2 and 3 servers) | All checks pass; router start-up defect found and fixed (R37) | GitHub |
| Valkey HA | Chart on Kubernetes: failover 7 s, crash recovery 4 s, NetworkPolicy holds (R40). GitHub-only stall: cause found (TILT mode from slow lookups, R38) | GitHub |
| Keycloak HA | Session survives node loss (R33) | GitHub |
| API gateway (APISIX) | 13/13: token required, rate and body limits, route allow-list, no admin API, headers (R41) | GitHub |
| Image signatures | Only images signed with the OpenBao-held release key are admitted; key not exportable; signer token limited (R36) | GitHub |
| Identity | Realm conformance with negative controls; **refresh-token rotation defect fixed** (R42) | CI |
| Country configuration | Second synthetic country as pure data changes deadlines, no code change (R43) | CI |
| IaC | Staging and pilot topologies plan; 4 unsafe topologies refused (R44); manifests 53/53 on a real API server; Checkov; ansible-lint production | Local + CI |
| Monitoring | 15 alert rules incl. second-site lag and "router sees no primary", unit-tested with promtool (R35) | CI |
| Dependencies | Trivy fixable HIGH/CRITICAL 0; `ajv` upgraded; 2 moderate advisories accepted with reasons (§17.4) | CI |

## 5. Security and disaster-recovery reports

- **Security:** the [security review package](founder-review/P2-security-review-package.md) contains:
  - internal tests done;
  - 8 defects found and fixed by tests;
  - open items split by who can resolve them: engineering, external professional, founder.
- **Disaster recovery:** [15](15-observability-backup-and-dr.md) §15.4 and §15.4.1. Recovery objectives by data class:
  - **critical regulated:** site loss RPO ≤ 5 s, RTO ≤ 30 min;
  - **standard:** ≤ 15 min / ≤ 4 h.

  The procedures are in the [runbook](runbooks/database-operations.md), §8 and §8.1.

## 6. Hosting provider recommendation

From [20](20-hosting-provider-assessment.md). Provisional, on public evidence; price not yet scored, because no candidate publishes prices.

| Rank | Provider | Score (of 80) |
|---|---|---|
| 1 | Tunisie Telecom | 62 |
| 2 | DataXion | 60 |
| 3 | Next Step IT | 46 |
| 4 | Ooredoo Tunisie | 42 |

**Recommendation:**
- Send the existing RFQ to the top three, plus any other provider whose N-Cloud label is current.
- Verify each label on ancs.tn first.
- Prefer the shape "main site + a second site, possibly with a second provider".

No managed Kubernetes or database service is needed. Choosing a provider changes only the node list in the IaC.

## 7. Outstanding founder decisions

| # | Decision | Prepared in |
|---|---|---|
| P2-D1 | Approve, condition, reject or defer each of the 30 ADRs (O-AC2) | [Register](founder-review/P2-adr-final-review-register.md), [decision form](founder-review/P2-D1-decision-form.csv) |
| P2-D2 | Key custody and the release-key ceremony (needs a second person) | [Runbook](runbooks/release-key-ceremony.md) |
| P2-D3 – P2-D5 | As recommended in the [decision package](founder-review/P2-final-technical-decision-package.md) §7; P2-D5 = GitHub branch protection and Actions settings | Same |
| E-07 | Send hosting RFQs; choose a provider; no purchase or contract has been made | [20](20-hosting-provider-assessment.md) |
| O-AC3 | Engage the external security adviser | [Security package](founder-review/P2-security-review-package.md) |
| P1-D12 | Phase 1 approval (separate track) | Phase 1 records |

## 8. Remaining external blockers

| Blocker | Blocks | Owner |
|---|---|---|
| No hosting provider | O-AC1; real-host drills; WAF and gateway-controller proof; pen test | Founder (E-07) |
| No external security adviser | O-AC3 | Founder to engage |
| ADR approvals | O-AC2 | Founder |
| Second person for key custody and reviews | O-SEC2 (release key), O-SEC5 (2-reviewer rule) | Founder |
| Legal questions (banking secrecy, INPDP, BCT outsourcing) | Pilot with real data | Counsel |

## 9. What changed in this session (20 Nov 2026, final pass)

| Change | Evidence |
|---|---|
| Live second site (standby cluster) | 0 acknowledged writes lost on site loss (R39) |
| Valkey: chart tested on Kubernetes; the GitHub-only stall explained (R38, R40). My first DNS explanation was wrong, and so was a later mitigation claim; both are corrected in the records | R38, R40 |
| API gateway behaviour tested (ADR-030) | R41 |
| Production signing path with an OpenBao-held key | R36 |
| Realm conformance; a refresh-token defect found and fixed | R42 |
| Second country as data | R43 |
| Pilot topology and topology guards in CI | R44 |
| Router metrics; second-site and router alerts | 15 rules |
| Hosting assessment and provisional ranking | Doc 20 |
| ADR final review register | 30 rows |
| Security review package | — |
| Final traceability | Doc 19 §19.0 |
| `ajv` upgraded | §17.4 |
