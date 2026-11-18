# 12. Product Requirements Document — CIVORA Workspace, Regulated Finance edition

| | |
|---|---|
| Product | CIVORA Workspace — Regulated Finance (RF) |
| Division | B — Enterprise (shared engine with A — Government) |
| Version | PRD 1.1 (Phase 1, 18 Nov 2026): regulatory traceability rebuilt from the **official BCT text**, scope corrected, FR-60–FR-66 added ([validation/product-validation-report.md](validation/product-validation-report.md)). Subject to discovery validation. **P1-D3 conditional**: see the [validation evidence register](validation-evidence-register.md) |
| Roadmap phases | Built across Phases 3, 4, 5, 6; verified in 11; integrated in 12; piloted in 13 ([10](10-first-product-recommendation.md) §10.5) |
| Government requirements | Retained in [supporting/government-product-requirements.md](supporting/government-product-requirements.md) (shared epics: identity, notifications, consent/audit, integrations) |

## 12.1 Product vision

> Every customer complaint or request at a regulated institution is captured once, handled on time by the right person, answered with a clear and reasoned decision, and provable to auditors, the mediator and the regulator, in Arabic or French, with data that never leaves the institution's chosen infrastructure.

## 12.2 Problem statement

**Verified obligations [V][S159]** (banks, leasing, factoring and investment banks; **not** payment institutions, which follow Circular 2026-10 and, for mobile payment, 2020-11):
- acknowledge every complaint with date and reference
- answer in writing within **15 working days** of the acknowledgement
- give reasons for any rejection
- run a **dedicated IT solution** with central archiving, automatic acknowledgements for remote complaints, deadline alerts and KPIs (Art. 9)
- report annually to the board, to the BCT through the internal-control report, and in the annual **ROGS760** XML statement
- have the system audited internally at least every three years

The compliance deadline was mid-2023, so most institutions should already have some tool.

Hypothesised current state [A — to validate in E-01; H-R1, H-R6, H-R7]:
- emails, spreadsheets, generic CRMs or bespoke tools built around 2023
- weak deadline control (**no public data on banks' internal on-time rates** [U]; the earlier "23.5% over deadline" figure measured *mediator* handling and is withdrawn [V][S166])
- no customer-facing status
- manual compilation of the board report and the ROGS760 statement
- incomplete files when cases escalate to the mediator

## 12.3 Goals and non-goals

| Goals (MVP) | Non-goals (MVP) |
|---|---|
| ≥ 95% of cases closed within the institution's configured deadlines after 3 months of use | Replacing core banking or CRM |
| Customer can see status at any time without calling | Marketing, upselling or analytics on complaint data for commercial targeting |
| Every rejection carries a written reason drawn from an approved reason code | AI classification or auto-replies (Phase 10 future requirement) |
| Annual board report and regulator statistics generated in < 1 hour | Payments, refunds execution (stay in core systems) |
| Complete, exportable case file for mediator/BCT within minutes | e-KYC / identity verification of customers |

## 12.4 Regulatory traceability (BCT Circular 2022-08 — verified text)

Verified against the official BCT text [V][S159] on 18 Nov 2026. The article-by-article analysis is in [validation/bct-regulatory-verification.md](validation/bct-regulatory-verification.md). Counsel confirmation of the interpretation is still pending (E-02).

| Article | Obligation | Product capability | Requirement IDs |
|---|---|---|---|
| Art. 1 | Effective, **free** and confidential handling; scope = banks and financial institutions **except payment institutions** | Free for end customers; rule packs per regime | FR-66, NFR security |
| Art. 2 | Definition of complaint; exclusions (service and information requests, mediator, courts, settled disputes, employment, domestic mobile payment) | Case type and out-of-scope reasons | **FR-60** |
| Art. 3–5 | System, dedicated structure, formal procedures for reception, handling and archiving, periodic review | Teams, roles, workflow configuration, retention, configuration history | FR-40–FR-44 |
| Art. 6 | Channels: email, online form, deposit at branches and HQ | Email-to-case, web form, agent form; postal logged | FR-01 |
| Art. 7 | Inform customers (branch posters, electronic platforms, statements, contractual documents) | Notices, status page, mediator block, statement/contract text block | FR-20–FR-24 |
| Art. 8 | Acknowledgement with date and reference; written answer within **15 working days** of acknowledgement; reasoned rejections | Acknowledgement engine; regulatory deadline ceiling; mandatory reasons | FR-04, FR-09, FR-15–FR-18, **FR-61** |
| Art. 9 + Annex 1 | **Dedicated IT solution**: central database by subject and outcome; automatic acknowledgements for remote complaints; deadline alerts; KPIs; retain Annex 1 information for the legal period | The product; Annex 1 data set | FR-03, FR-04, FR-09, FR-30, FR-43, **FR-62** |
| Art. 10 | Annual report to the board | Board report generator | FR-32 |
| Art. 11 | Chapter in the internal-control report to the BCT (Circular 2006-19 Art. 52) | Internal-control chapter export | **FR-63** |
| Art. 12 | Internal audit at least every 3 years; audit committee approval | Audit pack | FR-42, **FR-64** |
| Art. 13 | Correspondent of the BCT and the banking mediator | Correspondent workspace, case-file export, regulator requests | FR-25–FR-28 |
| Art. 14 + Annexes 2–3 | Annual statement **ROGS760**, XML, due DR + 45 days | Regulatory dataset and export | FR-33, **FR-65** |
| Art. 15 | In force on publication; compliance within 6 months | — | — |
| Circular 2026-10 / 2020-11 | Payment institutions; mobile-payment complaints (7 working days; quarterly statement) | Separate rule packs | **FR-65, FR-66** |

## 12.5 Functional requirements

### Intake
- **FR-01** Create a case from: agent form (branch/HQ), customer web form, inbound email (email-to-case), phone log, postal mail (logged by an agent).
- **FR-02** Capture customer identification *minimally*: name, customer reference, contact channel. Optional link to account or product identifiers. No ID-card images unless a category requires it.
- **FR-03** Classify by configurable **category → subcategory** taxonomy and product/channel, plus a priority. The default categories map to the eight BCT Annex 3 subjects (financing, non-card payment, card payment, account operation, international operations, pricing, remote banking, other).
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
- **FR-23** Printable branch notice, web snippet, and a text block for account statements and promotional, pre-contractual and contractual documents, describing the complaint procedure, deadlines and mediation (configurable text; BCT 2022-08 Art. 7).
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
- **FR-32** **Annual board report generator** (BCT 2022-08 Art. 10; format not prescribed): structured sections, charts, export to PDF/DOCX.
- **FR-33** Regulator statistics export. The regulatory statements themselves are specified in FR-65.

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

### Regulatory rule packs and statements (added in PRD 1.1 from the verified BCT text)
- **FR-60** **Case type**: complaint ("réclamation") / service request / information-or-advice request, plus **out-of-scope reasons** per BCT 2022-08 Art. 2 (referred to mediator; in court or arbitration; already settled; employment matter; domestic mobile payment under Circular 2020-11). Regulatory statistics count only in-scope complaints.
- **FR-61** **Regulatory deadline ceiling.** For in-scope complaints under RP-BCT-2022-08:
  - The deadline is computed in **working days from the acknowledgement date**.
  - The deadline **cannot be configured above 15 working days**; shorter internal targets are allowed.
  - A pause for missing customer information does **not** move the regulatory deadline (pending counsel Q-07).
  - The acknowledgement states at least the **registration date and reference**, and is **automatic for remote channels** (Art. 8–9).
- **FR-62** **Annex 1 data set.** Reference; name or company name; **RNE unique identifier** for legal persons; date of receipt; channel; product/service type; subject and description; **investigations carried out**; **steps taken**; outcome. Retention for the legal period, configurable until counsel answers Q-06. A **sensitive-content flag** restricts visibility and redacts exports when free text contains data covered by Law 2004-63 Art. 13–14.
- **FR-63** **Internal-control chapter** export: description of the complaint system and controls performed, for the annual internal-control report (Circular 2006-19 Art. 52; BCT 2022-08 Art. 11).
- **FR-64** **Internal-audit pack**: case sampling, audit-log extract, configuration and template history, deadline statistics (Art. 12).
- **FR-65** **Regulatory statement dataset and export**:
  - ROGS760 per Annex 3: complainant type; individuals by gender and age band (18–25, 26–60, > 60); channel; subject × number received × average response time × outcomes. Annual, DR + 45 days, XML.
  - RAA10 and RAA20 for payment institutions (Circular 2026-10).
  - The quarterly mobile-payment complaint statement (Circular 2020-11 Art. 44).
  - Gender and age band are captured only for this statistic, preferably derived from core banking.
  - The institution submits the files through its own BCT channel. **CIVORA has no access to BCT systems.**
- **FR-66** **Rule packs** as versioned configuration: RP-BCT-2022-08 (15 working days; ROGS760), RP-BCT-2026-10 (payment institutions; RAA10/RAA20), RP-BCT-2020-11 (mobile payment; 7 working days; quarterly). Each pack sets definitions, deadline ceilings, mandatory fields, statement formats and notice texts. A tenant may run several packs.

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
| Data location | **No processing of personal data by foreign sub-processors** (email, SMS, monitoring, AI) unless authorised by the INPDP (Law 2004-63 Art. 50–52) |
| Legal security basis | Access control, ex-post verifiability of access and changes, secure backups are legal obligations (Law 2004-63 Art. 18–19), not options |
| Compatibility | Latest two versions of Chrome, Edge, Firefox, Safari; Android 9+ / iOS 15+ browsers for the status page |
| Export / exit | Full data export (JSON/CSV + documents) at any time; documented exit plan |

## 12.8 Dependencies and assumptions

- Discovery confirms demand and willingness to pay (H-R1…H-R4 in the research kit) [A].
- Official text of BCT 2022-08 **obtained and analysed (18 Nov 2026)**; interpretation still to be reviewed by counsel (Q-06–Q-11).
- SMS gateway and email relay agreements (class 3 commercial).
- Labelled hosting provider agreement (class 3).
- Customers accept a SaaS-in-Tunisia or on-prem model.

## 12.9 Release criteria (for Phase 13 pilot)

- All "Must" items in [13](13-mvp-scope-and-specification.md) delivered with automated tests.
- Pen test: no open critical/high findings. Security audit under Decree-law 2023-17 Art. 6–8 completed (if CIVORA is in scope; counsel to confirm).
- Regulatory deadline, acknowledgement and ROGS760 statement tests pass ([validation/product-validation-report.md](validation/product-validation-report.md) §9, criteria A1–A5).
- WCAG 2.2 AA audit of console and status page passed.
- DPIA template and processor agreement reviewed by counsel.
- 2 design partners validate workflows and reports on synthetic data or properly authorised test data (P1-D5).

## 12.10 Open questions

| ID | Question | Owner | By |
|---|---|---|---|
| Q-01 | Exact deadlines, admissibility rules and other obligations in the official text of BCT 2022-08 and any amendments | Counsel / founder | **Answered from the official text (18 Nov 2026)**: [validation/bct-regulatory-verification.md](validation/bct-regulatory-verification.md). No amendment found [U]; counsel to confirm (Q-10) |
| Q-02 | Required format of the annual board report and any regulator statistics | Design partners / BCT guidance | **Partly answered:** board report format is free (Art. 10); ROGS760 content is fixed by Annex 3 (annual, XML, DR + 45 days). **XML schema still to obtain** (Q-09) |
| Q-03 | Do BCT outsourcing / IT-risk rules require notification or approval when a bank uses a SaaS provider? | Counsel | **Partly answered:** Law 2016-48 Art. 81 requires prior information of the BCT before signing an outsourcing contract (one month of silence = acceptance). Whether SaaS complaint handling is "externalisation", and the content of Circular 2006-01, need counsel (Q-08) |
| Q-04 | Do insurers (CGA) and telecom operators (INT) have equivalent complaint rules? | Research | **Partly answered:** insurance has CGA Regulation 01/2023 (cited by the OIF [V][S166]; text not read). Microfinance has a 2016 client-protection order. Telecoms not researched |
| Q-05 | Which complaint tools do banks already use (incumbents, satisfaction)? | Discovery | Open (E-05) |
| Q-06 | Legal retention period for Annex 1 information | Counsel | Open |
| Q-07 | May the 15-working-day period be suspended while awaiting customer information? | Counsel | Open |
| Q-08 | Is a hosted complaint SaaS an outsourcing under Law 2016-48 Art. 81? What does Circular 2006-01 require? | Counsel | Open |
| Q-09 | Where are the ROGS760 and RAA10/RAA20 XML schemas published, and can a vendor obtain them? | Founder / design partner | Open |
| Q-10 | Any amendment to 2022-08? Entry-into-force date of 2026-10? | Counsel | Open |
| Q-11 | Do non-resident banks and investment banks file ROGS760 in practice? | Design partner | Open |
