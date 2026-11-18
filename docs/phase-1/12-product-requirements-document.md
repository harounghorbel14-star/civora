# 12. Product Requirements Document — CIVORA Workspace, Regulated Finance edition

| | |
|---|---|
| Product | CIVORA Workspace — Regulated Finance (RF) |
| Division | B — Enterprise (shared engine with A — Government) |
| Version | PRD 1.0 (Phase 1). Subject to discovery validation. **P1-D3 conditional**: see the [validation evidence register](validation-evidence-register.md) |
| Roadmap phases | Built across Phases 3, 4, 5, 6; verified in 11; integrated in 12; piloted in 13 ([10](10-first-product-recommendation.md) §10.5) |
| Government requirements | Retained in [supporting/government-product-requirements.md](supporting/government-product-requirements.md) (shared epics: identity, notifications, consent/audit, integrations) |

## 12.1 Product vision

> Every customer complaint or request at a regulated institution is captured once, handled on time by the right person, answered with a clear and reasoned decision, and provable to auditors, the mediator and the regulator, in Arabic or French, with data that never leaves the institution's chosen infrastructure.

## 12.2 Problem statement

Institutions must handle complaints as the first level before mediation, inform customers of deadlines, give written reasons for any rejection, run a dedicated IT solution and report annually to their board (BCT 2022-08) [P][S141][S142].

Hypothesised current state [A — to validate]:
- emails, spreadsheets or generic CRMs
- weak deadline control (23.5% over deadline in 2020 [P][S142])
- no customer-facing status
- manual report compilation
- incomplete files when cases escalate to the mediator

## 12.3 Goals and non-goals

| Goals (MVP) | Non-goals (MVP) |
|---|---|
| ≥ 95% of cases closed within the institution's configured deadlines after 3 months of use | Replacing core banking or CRM |
| Customer can see status at any time without calling | Marketing, upselling or analytics on complaint data for commercial targeting |
| Every rejection carries a written reason drawn from an approved reason code | AI classification or auto-replies (Phase 10 future requirement) |
| Annual board report and regulator statistics generated in < 1 hour | Payments, refunds execution (stay in core systems) |
| Complete, exportable case file for mediator/BCT within minutes | e-KYC / identity verification of customers |

## 12.4 Regulatory traceability (BCT Circular 2022-08)

Only obligations reported in available sources are listed. **Exact deadlines, report formats and any additional obligations must be confirmed from the official JORT/BCT text** (open question Q-01).

| Obligation (as reported) | Product capability | Requirement IDs |
|---|---|---|
| Internal complaint handling as first level before the mediator | Intake, case management, closure before escalation | FR-01…FR-14 |
| Inform customers of procedures, processing deadlines and mediation conditions (branches, electronic platforms, statements) | Customer notices, status page with deadline, mediator information block, printable branch notice | FR-20…FR-24 |
| Reason in writing any partial or total rejection | Mandatory reason code + written explanation; template library | FR-15…FR-18 |
| Dedicated IT solution (Art. 9) | The product itself; audit trail; retention | FR-40…FR-44 |
| Correspondent as interlocutor of the mediator and the BCT | Correspondent role, escalation workspace, case-file export | FR-25…FR-28 |
| Annual report on complaint handling to the board | Report generator and statistics | FR-30…FR-33 |

## 12.5 Functional requirements

### Intake
- **FR-01** Create a case from: agent form (branch/HQ), customer web form, inbound email (email-to-case), phone log.
- **FR-02** Capture customer identification *minimally*: name, customer reference, contact channel. Optional link to account or product identifiers. No ID-card images unless a category requires it.
- **FR-03** Classify by configurable **category → subcategory** taxonomy and product/channel, plus a priority.
- **FR-04** Generate a unique case reference and send an acknowledgement (SMS/email/printed) with the expected response deadline.
- **FR-05** Detect duplicates: same customer, same category, open case.
- **FR-06** Attach documents (PDF/JPEG/PNG; size limits; malware scan).

### Case management
- **FR-07** Queues per team, branch and category. Sorting by deadline. Filters and saved views.
- **FR-08** Assignment: manual, round-robin, or rules by category/branch.
- **FR-09** Configurable **deadline/SLA rules** per category (calendar or working days, with holiday calendar). Visual timers; warnings at configurable thresholds; automatic escalation to a supervisor.
- **FR-10** Internal notes and @mentions. Request information from another department or branch as a sub-task with its own deadline.
- **FR-11** Case states (configurable; default):
  - Received
  - In analysis
  - Information requested (customer)
  - Pending internal
  - Decision proposed
  - Decision issued
  - Closed
  - Escalated to mediator
  - Reopened
- **FR-12** Four-eyes approval for selected categories or amounts (configurable).
- **FR-13** Reopen a case within a configurable window; preserve history.
- **FR-14** Bulk actions for supervisors (reassign, change priority) with audit.

### Decisions and communications
- **FR-15** A decision has an outcome (upheld / partially upheld / rejected / not admissible / withdrawn) and a **reason code**.
- **FR-16** **Rejection (partial or total) cannot be issued without a written explanation** of at least *n* characters [A], plus a reason code.
- **FR-17** Response templates per category and outcome, in Arabic and French (English optional), with variables and approval workflow.
- **FR-18** Generate the response letter (PDF) and send by the customer's chosen channel. Store the issued version immutably.
- **FR-19** Customer can reply or provide requested information through the status page; replies attach to the case.

### Customer transparency
- **FR-20** Mobile-first **status page**:
  - reference
  - category
  - current status in plain language
  - deadline
  - next step
  - messages
  - access via reference + one-time code to the registered contact
- **FR-21** Notifications on status changes (SMS/email; templates per language).
- **FR-22** **Mediator information block** shown on decisions and on request: how and when the customer can escalate.
- **FR-23** Printable branch notice and web snippet describing the complaint procedure and deadlines (configurable text).
- **FR-24** Customer satisfaction survey after closure (optional).

### Mediator and regulator liaison
- **FR-25** Correspondent role with an escalation workspace (cases escalated, deadlines, mediator correspondence).
- **FR-26** **One-click case-file export** (PDF + JSON): timeline, documents, decisions, communications, audit extract.
- **FR-27** Record mediator outcomes and link them to the original case.
- **FR-28** Track regulator requests (e.g. BCT information requests) as their own case type.

### Reporting
- **FR-30** Operational dashboard:
  - open cases
  - at-risk / overdue
  - by category, branch, product, channel
  - median and p90 resolution time
- **FR-31** Root-cause view: top categories and reasons, trend over time.
- **FR-32** **Annual board report generator**: structured sections, charts, export to PDF/DOCX. Format to confirm (Q-02).
- **FR-33** Regulator statistics export (CSV/XLSX) in the format required (Q-02).

### Administration and audit
- **FR-40** Tenant administration: users, roles, teams, branches, categories, SLA rules, templates, holidays, languages.
- **FR-41** Role-based access with data scoping:
  - branch staff see their branch's cases
  - HQ teams see their categories
  - the correspondent sees escalated cases
- **FR-42** **Tamper-evident audit log** of all views and changes. Export for auditors.
- **FR-43** Retention policies per case type; legal hold; deletion/anonymisation jobs with evidence.
- **FR-44** Configuration change history.

### Integrations (MVP set)
- **FR-50** SSO (SAML 2.0 / OIDC) with the institution's identity provider; local accounts with MFA as fallback.
- **FR-51** Email in (IMAP/Graph) and out (SMTP/relay); SMS gateway (Tunisian operators/aggregators).
- **FR-52** Optional read-only lookup in core banking/CRM via a customer-provided API (adapter). No write-back in MVP.
- **FR-53** Public REST API with webhooks for case creation and status changes (customer's own channels such as a mobile app).

## 12.6 Key user stories and acceptance criteria

| ID | Story | Acceptance criteria |
|---|---|---|
| RF-01 | As a **branch manager**, I log a complaint at the counter in under 2 minutes and give the customer a reference | Form completes with ≤ 7 required fields; reference printed or sent by SMS immediately; deadline shown |
| RF-02 | As a **complaints handler**, I see my cases sorted by deadline with clear warnings | Overdue and at-risk cases flagged by icon + text (not colour alone); default sort by remaining time; ≤ 1 s load for 5,000 open cases |
| RF-03 | As a **handler**, I cannot reject without a written reason | Issuing a rejection with an empty explanation or no reason code is blocked with an error message; automated test |
| RF-04 | As a **handler**, I request documents from a branch and the case clock behaves per policy | Sub-task created with its own deadline; configurable whether the main SLA pauses |
| RF-05 | As a **customer**, I check my case status on my phone in Arabic or French | Status page works at 320 px; RTL correct; status, deadline, next step and mediator info visible; WCAG 2.2 AA |
| RF-06 | As the **correspondent**, I export a complete case file for the mediator | Export includes timeline, documents, decisions, communications and audit extract; generated in < 30 s |
| RF-07 | As **head of customer relations**, I produce the annual board report | Report generated from data for a chosen period in < 1 hour including review; exports PDF/DOCX |
| RF-08 | As **compliance officer**, I prove who viewed or changed a case | Audit log shows actor, action, timestamp and fields changed; integrity verification passes |
| RF-09 | As **tenant admin**, I add a category with its SLA and templates without vendor help | Configuration via UI; change logged; effective for new cases immediately |
| RF-10 | As a **supervisor**, I am alerted before deadlines are missed | Alerts at configurable thresholds (e.g. 70%, 90%); escalation on breach; daily digest |

## 12.7 Non-functional requirements

| Area | Requirement |
|---|---|
| Hosting & residency | Deployable on a Tunisian labelled host (G-Cloud/N-Cloud) or customer on-premises. No personal data processed abroad by default (Phase 0 §11.2) |
| Security | OWASP ASVS L2 (L3 for auth and audit); MFA for all staff; SSO; encryption in transit (TLS 1.3) and at rest; field-level encryption for customer identifiers; least-privilege roles; pen test before pilot; ANCS-compliant audit before production |
| Privacy | Processor role (DPA); data minimisation at intake; retention policies; DPIA template for customers; access logs |
| Availability | Pilot ≥ 99.5% monthly (business hours focus); production ≥ 99.9% (SLA tiers) |
| Performance | p95 page load < 1.5 s on office networks; status page < 2.5 s LCP on 3G; queue view < 1 s for 5,000 open cases per tenant |
| Scalability | Up to 500 concurrent agents and 1M cases per tenant without redesign [A] |
| Accessibility | WCAG 2.2 AA (agent console and customer status page) |
| Localisation | Arabic (RTL), French, English UI; templates per language; Western Arabic digits by default; Tunisian holiday calendar |
| Audit integrity | Append-only audit; daily hash-chain anchor (Phase 0 §9.7) |
| Backup & DR | Daily backups + PITR; monthly restore test; RPO ≤ 15 min, RTO ≤ 4 h (pilot) |
| Observability | Metrics, logs and traces without personal data; customer-facing status page for the service |
| Compatibility | Latest two versions of Chrome, Edge, Firefox, Safari; Android 9+ / iOS 15+ browsers for the status page |
| Export / exit | Full data export (JSON/CSV + documents) at any time; documented exit plan |

## 12.8 Dependencies and assumptions

- Discovery confirms demand and willingness to pay (H-R1…H-R4 in the research kit) [A].
- Official text of BCT 2022-08 obtained and reviewed by counsel.
- SMS gateway and email relay agreements (class 3 commercial).
- Labelled hosting provider agreement (class 3).
- Customers accept a SaaS-in-Tunisia or on-prem model.

## 12.9 Release criteria (for Phase 13 pilot)

- All "Must" items in [13](13-mvp-scope-and-specification.md) delivered with automated tests.
- Pen test: no open critical/high findings. ANCS-compliant audit completed.
- WCAG 2.2 AA audit of console and status page passed.
- DPIA template and processor agreement reviewed by counsel.
- 2 design partners validate workflows and reports on synthetic data or properly authorised test data (P1-D5).

## 12.10 Open questions

| ID | Question | Owner | By |
|---|---|---|---|
| Q-01 | Exact deadlines, admissibility rules and other obligations in the official text of BCT 2022-08 and any amendments | Counsel / founder | Day 30 |
| Q-02 | Required format of the annual board report and any regulator statistics | Design partners / BCT guidance | Day 60 |
| Q-03 | Do BCT outsourcing / IT-risk rules require notification or approval when a bank uses a SaaS provider? | Counsel | Day 30 |
| Q-04 | Do insurers (CGA) and telecom operators (INT) have equivalent complaint rules? | Research | Day 60 |
| Q-05 | Which complaint tools do banks already use (incumbents, satisfaction)? | Discovery | Day 60 |
