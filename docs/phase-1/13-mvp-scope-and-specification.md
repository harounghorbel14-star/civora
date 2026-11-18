# 13. MVP Scope and Specification — Workspace, Regulated Finance edition

## 13.1 MVP definition

The MVP is the **smallest product a payment provider or mid-size bank would pay to use in production** for complaint and request handling under BCT 2022-08. It is piloted with 2–3 institutions in **Phase 13**.

- Before Phase 13, only a **sandbox design-partner programme** runs: synthetic data or properly authorised test data, no production use (P1-D5, approved).
- The roadmap is unchanged. MVP capabilities are built as **additive scope** inside Phases 2–6 and verified in Phase 11 (see Section 13.5).
- **Status (founder review, 18 Nov 2026):** P1-D3 is *conditional*. This MVP is the recommended first product, subject to the evidence in [validation-evidence-register.md](validation-evidence-register.md).

## 13.2 Feature prioritisation (MoSCoW)

| Priority | Capabilities (requirement IDs from [12](12-product-requirements-document.md)) |
|---|---|
| **Must** | Agent intake form + customer web form (FR-01) · minimal customer data (FR-02) · category taxonomy (FR-03) · reference + acknowledgement with deadline (FR-04) · attachments with malware scan (FR-06) · queues, filters, deadline sort (FR-07) · manual + rule assignment (FR-08) · SLA rules, timers, escalation (FR-09) · internal notes, sub-tasks (FR-10) · configurable states (FR-11) · reason codes + mandatory written rejection reasons (FR-15, FR-16) · AR/FR templates (FR-17) · response letter PDF (FR-18) · customer status page with OTP (FR-20) · SMS/email notifications (FR-21) · mediator information block (FR-22) · correspondent workspace + case-file export (FR-25, FR-26) · operational dashboard (FR-30) · annual report generator v1 (FR-32) · tenant admin (FR-40) · scoped RBAC (FR-41) · tamper-evident audit (FR-42) · retention policies (FR-43) · SSO + MFA (FR-50) · email & SMS (FR-51) · AR/FR/EN UI with RTL · WCAG 2.2 AA |
| **Should** | Email-to-case (FR-01 email) · duplicate detection (FR-05) · four-eyes approval (FR-12) · reopen (FR-13) · customer replies on status page (FR-19) · branch notice generator (FR-23) · root-cause view (FR-31) · regulator statistics export (FR-33) · REST API + webhooks (FR-53) |
| **Could** | Phone-log intake helper · satisfaction survey (FR-24) · bulk actions (FR-14) · read-only core-banking lookup adapter (FR-52) · mediator outcome linking (FR-27) |
| **Won't (MVP)** | AI triage, summarisation or document extraction (→ Phase 10 future requirement) · e-KYC (→ partner integration) · e-signature of letters (→ Phase 4 capability, later edition) · core-banking write-back · native mobile apps · insurance/telecom editions |

## 13.3 MVP specification by module

| Module | Specification summary | Primary personas |
|---|---|---|
| Intake | 3 channels (agent, web, email*); ≤ 7 required fields; category picker with search in AR/FR; deadline computed at creation from SLA rule and holiday calendar | Mehdi, Youssef |
| Queue & case | Deadline-sorted list; at-risk/overdue badges (icon + text); case page with timeline, customer summary (minimum data), documents, notes, sub-tasks, decision panel | Sana |
| Decision | Outcome + reason code + explanation (mandatory for rejections) + template; preview letter; send; immutable issued copy | Sana |
| Customer status | Reference + OTP; plain-language status; deadline; next step; messages; mediator information; AR/FR; no login account required | Youssef |
| Escalation | Mark escalated; correspondent queue; export case file; record mediator correspondence | Karim |
| Reporting | Dashboard; annual report wizard (period → sections → charts → export) | Rim |
| Admin | Users/teams/branches; categories & SLAs; templates (with approval); holidays; retention; SSO | Walid, Ines |
| Audit | Every view and change logged; integrity check; auditor export | Ines |

\* email-to-case is "Should".

## 13.4 Out of scope (explicit)

- Any use of real customer data before Phase 13.
- Hosting outside Tunisia for personal data.
- Selling complaint analytics or benchmarking across customers. Cross-tenant data use is prohibited.
- Any claim of regulatory approval or BCT endorsement.

## 13.5 Build plan within the original roadmap (revised after founder review)

The v2.0 "light pass" approach is **withdrawn** (P1-D4, conditional). Every phase keeps its complete Phase 0 §19 scope. Workspace RF capabilities are **additive acceptance criteria** in Phases 2–6, 11, 12 and 13. Full detail: [roadmap-protection-matrix.md](roadmap-protection-matrix.md).

| Phase | Original scope | Workspace RF additions |
|---|---|---|
| 2 Technical Architecture | Unchanged (Phase 0 §19) | Financial-institution tenants; on-prem deployability; financial data domain |
| 3 Authentication & Citizen Profiles | Unchanged | Staff SSO + MFA; customer OTP access; scoped roles |
| 4 Digital Documents | Unchanged | Attachments, scanning, letters, immutable issued copies, retention |
| 5 Government Services Directory | Unchanged | Taxonomy engine reused for complaint categories |
| 6 Civil Registry Workflows | Unchanged | Complaint case types, reasoned decisions, liaison, export, reports, status page |
| 7–10 | **Unchanged, full scope** | None, except optional Workspace AI inside Phase 10 (founder decision) |
| 11 Security, Testing & Auditing | Unchanged | Tenant-isolation tests; vendor-audit evidence pack |
| 12 Official Institutional Integrations | Unchanged | Customer SSO, email, SMS, optional core-banking read; e-KYC partners |
| **13 Pilot Deployment in Tunisia** | Unchanged (Government pilot) | **2–3 Workspace RF production pilots** |

**Timing to the Phase 13 start** depends on execution mode (decision P1-D4a):

| Mode | Moderate | Lean |
|---|---|---|
| **B** (ordered, dependency-respecting overlap) | ~M17–M18 | ~M26–M27 |
| **A** (strictly sequential) | ~M22–M23 | ~M33–M34 |

These are [A] estimates from Phase 0 §19 phase durations.

## 13.6 Future requirements captured (not built in MVP)

| Requirement | Division | Roadmap phase |
|---|---|---|
| AI classification of incoming complaints (AR/FR/Derja); suggested category and priority | E | 10 |
| AI extraction from attached documents (statements, receipts) | E | 10 |
| Draft-response suggestions from approved templates, with human approval only | E | 10 |
| e-signature of decision letters (TunTrust) | D | 4 (later edition) / 12 |
| e-KYC review queues with partner vendors | D | 12 |
| Insurance claims, telecom and utility editions | B | 14 |
| Government Workspace for public institutions (sector 20 complaints/tracking) | A | 6 capability → 13/14 |
| Cross-border country packs (Maghreb, Francophone Africa) | All | 15 |

## 13.7 MVP success metrics (pilot)

| Metric | Target |
|---|---|
| Cases closed within deadline | ≥ 95% after month 3 |
| Median handling time | −30% vs baseline |
| "Where is my complaint?" contacts | −40% vs baseline |
| Annual-report preparation time | < 1 hour (from days) |
| Agent SUS score | ≥ 75 |
| Security | No critical/high findings open; zero data incidents |
| Commercial | ≥ 2 pilots convert to paid annual contracts |

## 13.8 Realistic MVP cost assessment (desk estimate; to validate — evidence E-07)

**Scope:** the *incremental* cost of delivering the Workspace RF MVP (Section 13.2 "Must" + "Should"). This excludes the cost of the other full-scope roadmap phases, which the company funds anyway (see the totals at the end).

### Effort (person-weeks) [A]

| Workstream | Person-weeks (low–high) |
|---|---|
| Staff auth, tenants, scoped RBAC, SSO, customer OTP | 10–14 |
| Documents: attachments, scanning, letters, immutable copies, retention | 8–12 |
| Taxonomy / categories | 3–5 |
| Case/workflow engine: SLA timers, escalations, sub-tasks, decisions, templates | 20–30 |
| Customer status page + notifications | 8–12 |
| Escalation workspace + case-file export | 5–8 |
| Dashboard + annual board report | 8–12 |
| Administration console | 8–12 |
| Audit log (hash chain) + retention jobs | 5–8 |
| API & webhooks | 4–6 |
| i18n AR/FR/EN, RTL, accessibility | 6–10 |
| UX/UI design (hi-fi, design-system implementation) | 10–14 |
| QA and test automation | 12–18 |
| DevSecOps: infrastructure, CI/CD, observability, backups/DR | 12–18 |
| Security engineering (threat model, reviews) | 6–10 |
| Product management (~0.5 FTE) | ~24 |
| **Total** | **≈ 150–215 person-weeks ≈ 35–50 person-months** |

### Cost

| Item | Low (TND) | High (TND) | Basis |
|---|---|---|---|
| People: 35–50 person-months × 9,375 TND (7,500 loaded salary + 25% overhead allocation) | 324,000 | 466,000 | Phase 0 salary assumptions [A], benchmarked to [P] S85/S86 |
| Pre-pilot penetration test | 30,000 | 60,000 | Estimate [A] — quotes needed |
| ANCS-compliant security audit | 20,000 | 60,000 | Estimate [A] — quotes needed |
| WCAG 2.2 AA audit | 15,000 | 30,000 | Estimate [A] |
| Hosting: staging + pilot cell on a labelled Tunisian host, 12 months | 60,000 | 150,000 | Estimate [A] — quotes needed |
| SMS/email during trials | 5,000 | 10,000 | Estimate [A] |
| Legal: DPA, design-partner agreement, BCT outsourcing/retention opinion | 30,000 | 60,000 | Estimate [A] |
| Design-partner support and travel | 10,000 | 20,000 | Estimate [A] |
| Third-party tools (malware scanning, PDF, monitoring) | 10,000 | 25,000 | Estimate [A] |
| Subtotal | 504,000 | 881,000 | — |
| Contingency 15% | 76,000 | 132,000 | — |
| **Incremental MVP cost** | **≈ 0.58M** | **≈ 1.01M** | **≈ US$195k–340k** |

### Company spend to reach the Phase 13 start

All phases run at full scope (Moderate model, v3):
- **Mode B:** ≈ 3.4M TND cumulative net spend by M18.
- **Mode A:** ≈ 4.6M TND by M23.

The MVP is a fraction of this. Most of the spend is the protected roadmap (Government, documents, directory, health prototype, payments, social security and education, AI, security, integrations).

**Validation needed:**
- ≥ 2 external quotes each for hosting and for pen test/audit.
- Review of the effort estimate by the CTO or lead engineer once hired.
