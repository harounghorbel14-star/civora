# 18. MVP Recommendation

## 18.1 What the MVP must prove

The MVP is an **independent prototype on synthetic data**. Its purpose is to answer, with evidence, four questions:

1. **Value:** Do citizens and civil servants find the Guide and Workspace clearly better than today's channels? Measured by usability tests and task-completion rates.
2. **Buyer interest:** Will a public institution, a donor programme and a regulated business commit to a pilot? Measured by LOIs and paid pilot agreements.
3. **Feasibility:** Can CIVORA deliver a secure, multilingual, RTL-native, deployable platform at the required quality? Measured by pen test, accessibility audit and Guide evaluation scores.
4. **Deployability:** Can the platform be installed on a Tunisian labelled host or CNI-like environment from documentation alone?

It does **not** need to prove national scale, real integrations or revenue at scale.

## 18.2 Scope — IN

| # | Capability | Acceptance criteria (summary) |
|---|---|---|
| 1 | **CIVORA Guide v1** (AI procedures assistant) | ≥ 60 priority procedures curated from official public sources with citations and last-verified dates. Languages: MSA, Derja (Arabic script + Arabizi), French, English. Golden-set accuracy ≥ 95% and citation precision ≥ 95%. Refusal correctness ≥ 90%. p95 latency ≤ 6 s on 3G. Clear "unofficial" labelling |
| 2 | **Services catalogue** | Versioned service model (steps, documents, fees, offices, sources, effective dates). Search in AR/FR/EN. Editorial workflow with four-eyes approval |
| 3 | **Workspace v1** (case management + appointments) | Configurable case types (≥ 3 demo services, e.g. civil-status certificate request, consular appointment, attestation request). Queues, assignment, SLA timers, document checklist, request-for-correction loop, appointment slots with capacity, officer dashboard |
| 4 | **Citizen app v1** (web + mobile) | Account with passkeys and TOTP; request submission and tracking; appointments; notifications; delegation (mandates) for 2 scenarios (parent→minor, voluntary caregiver). RTL/LTR; WCAG 2.2 AA audited |
| 5 | **Identity broker with simulated national eID** | Keycloak broker; simulated "national eID" adapter clearly marked SIMULATED; assurance levels and step-up demonstrated |
| 6 | **Wallet v1** (synthetic credentials) | Issue and verify 2 credential types (e.g. synthetic diploma, synthetic attestation) using SD-JWT VC / W3C VC; QR presentation; verifier web page; revocation via status list |
| 7 | **Consent & access log** | Signed consent receipts; citizen-visible access log; hash-chained audit with daily anchor |
| 8 | **Integration framework** | Adapter interfaces + simulators: UXP/X-Road-style registry query, status feed, payment provider, SMS/email. Integration register drives enable/disable |
| 9 | **Ops baseline** | CI/CD with security gates; IaC; deployment to a staging cell; backups with one restore drill; observability dashboards |

## 18.3 Scope — OUT (explicitly)

| Excluded | Why | When |
|---|---|---|
| Real government data or integrations | Requires authorisation (Section 12) | Phase 12 |
| Real health records | T0; MoH/INPDP authorisation required | Phase 7 prototype (synthetic) → authorised pilot later |
| Real payments | Requires PSP merchant agreements | Phase 8 |
| B2B e-KYC with real identities | Requires vendor + client + INPDP | L1 pilot track (parallel, M8–M12) |
| Biometric processing | Not needed for MVP | L1 via vendor, no retention |
| Native citizen "super-app" branding for Tunisia | Khadamet exists; avoid confusion | Not planned for Tunisia |
| Voice interface | Nice-to-have | After pilot feedback |

## 18.4 Team and timeline

| Option | Team | Duration | Cost to MVP [A] |
|---|---|---|---|
| **Moderate staffing** (recommended if seed-funded) | 6–8 builders: CTO, 2 senior full-stack, full-stack, mobile, AI engineer, designer, DevSecOps, plus security lead and product head | **~6 months** | ~0.92M TND cumulative company spend at M6 |
| **Lean staffing** (pre-seed default) | 5 builders by M2, AI engineer from M7 (or earlier if funds allow) | **~9 months** | ~0.45M TND cumulative company spend at M9 |

**Milestones (Moderate; Lean ×1.5):**

| Month | Milestone |
|---|---|
| M1 | ADRs approved; threat model; design system v0 (RTL); repo, CI/CD, IaC skeleton; synthetic data generator |
| M2 | Catalogue + editorial workflow; Guide corpus pipeline; golden set v1 (≥ 500 Q across languages) |
| M3 | Guide alpha (internal eval); citizen accounts (passkeys); identity broker with simulated eID |
| M4 | Workspace alpha (3 case types); appointments; notifications (simulated channels) |
| M5 | Wallet v1; consent receipts; access log; mandates; mobile app beta |
| M6 | Usability tests (n ≥ 20, incl. ≥ 5 aged 60+ and ≥ 3 diaspora); WCAG audit; external pen test; deployment-from-docs test on a labelled host; demo package |

## 18.5 MVP success metrics (exit criteria)

| Area | Metric | Target |
|---|---|---|
| Users | Task completion on core journeys (find procedure, submit request, track, book) | ≥ 85% unassisted; ≥ 95% assisted |
| Users | System Usability Scale (SUS) | ≥ 75 |
| Guide | Golden-set accuracy / citation precision / refusal correctness | ≥ 95% / ≥ 95% / ≥ 90% |
| Security | External pen test | No open critical/high findings |
| Accessibility | WCAG 2.2 AA audit | No blocking issues |
| Deployability | Fresh install from documentation by a third party | ≤ 2 days |
| Market | Letters of intent | ≥ 1 public institution or donor programme; ≥ 2 B2B paid pilots agreed |

## 18.6 Alternatives considered and rejected

| Alternative | Why rejected |
|---|---|
| "Super-app first" citizen dashboard for Tunisia | Duplicates Khadamet/e-Bawaba; no data access; confuses citizens; antagonises the likely customer |
| Health-first MVP | Highest legal barriers (T0, MoH + INPDP authorisation, hosting in Tunisia [P][S48]); the MoH is already deploying a national record [P][S68] |
| B2B e-KYC only | Faster revenue but small Tunisian market (~1.5–4M TND/yr [A]); loses the mission and B2G positioning. Kept as a parallel line, not the MVP core |
| Pure consulting/services company | Fast cash but no scalable asset; competes with established integrators |
| Building own identity or interoperability layer | Duplicates national UXP and Mobile ID; contradicts open-DPI trend (Section 4.3) |
