# 13. MVP Scope and Specification — Workspace, Regulated Finance edition

## 13.1 MVP definition

The MVP is the **smallest product a payment provider or mid-size bank would pay to use in production** for complaint and request handling under BCT 2022-08. It is piloted with 2–3 institutions in **Phase 13**.

- Before Phase 13, only a **sandbox design-partner programme** runs: synthetic or anonymised data, no production use (P1-D5).
- The roadmap is unchanged. The MVP is built inside Phases 3–6 and verified in Phase 11 (see Section 13.5).

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

## 13.5 Build plan within the original roadmap (first-product track)

| Phase | MVP deliverables | Indicative duration (Moderate / Lean) [A] |
|---|---|---|
| 2 Technical Architecture | ADRs for Workspace + shared platform; threat model; CI/CD; staging cell | 6 / 9 wks |
| 3 Authentication & Citizen Profiles | Staff SSO + MFA; roles; tenant model; customer OTP access | 6 / 9 wks |
| 4 Digital Documents | Attachments, scanning, letter generation, immutable storage, retention | 5 / 7 wks |
| 5 Government Services Directory | Category & service taxonomy engine (used as complaint categories); AR/FR content model | 3 / 5 wks |
| 6 Civil Registry Workflows | Case/workflow engine, SLA timers, escalations, decisions, templates, dashboards, reports | 10 / 15 wks |
| 7 Healthcare Prototype | Light pass (synthetic design only) | 3 / 3 wks |
| 8 Payments & Financial Services | Light pass | 3 / 3 wks |
| 9 Social Security & Education | Light pass | 3 / 3 wks |
| 10 AI Government Assistant | Light pass: Workspace AI future requirements (13.6) | 3 / 4 wks |
| 11 Security, Testing & Auditing | Pen test; ANCS-compliant audit; WCAG audit; DPIA; DR test | 5 / 6 wks |
| 12 Official Institutional Integrations | Customer-side integrations (SSO, email, SMS; optional core-banking read) | 4 / 6 wks (agreements negotiated from Phase 1 onward) |
| **13 Pilot Deployment in Tunisia** | **2–3 production pilots** (financial institutions); public institution if available | 3–6 months |

**Total to Phase 13 start:** ≈ 51 weeks Moderate (≈ M13–M14) or ≈ 70 weeks Lean (≈ M17–M19) [A].

A *light pass* keeps the phase in sequence but limits its scope in this cycle to documentation and synthetic prototypes. This needs founder decision **P1-D4**.

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
