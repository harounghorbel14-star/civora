# Product Validation Report — CIVORA Workspace, Regulated Finance

| | |
|---|---|
| Scope | Review of the complete first-product definition against the **verified** regulatory text and internal consistency. Documents reviewed: [10](../10-first-product-recommendation.md), [11](../11-target-customer-profiles.md), [12](../12-product-requirements-document.md), [13](../13-mvp-scope-and-specification.md), [14](../14-user-journeys.md), [15](../15-information-architecture.md), [16](../16-ux-ui-design-strategy.md), [17](../17-design-system-specification.md), [18](../18-shared-platform-requirements.md), [19](../19-commercial-and-pricing-strategy.md), and the six wireframes |
| Reviewed on | 18 November 2026 |
| Decision link | P1-D3 remains **CONDITIONAL**. This report validates the *definition*; it does not validate *demand* (E-01–E-06) |

## 1. Summary of findings

| Area | Verdict | Corrections made |
|---|---|---|
| Regulatory basis | **Verified** in the official BCT text ([BCT verification](bct-regulatory-verification.md)) | Traceability rebuilt article by article (PRD §12.4) |
| Target customer | **Partly inaccurate before this review.** Payment institutions are outside Circular 2022-08 | Scope corrected: primary = banks + leasing/factoring; payment institutions = secondary segment with their own rule pack (§2) |
| Core problem | Obligations verified. **Operational pain unverified**: compliance was due in 2023, so incumbents likely exist | Problem statement rewritten as hypotheses H-R1, H-R6, H-R7 |
| Personas | Consistent with the Art. 4 / Art. 13 roles; two clarifications | ICP and persona notes in [11](../11-target-customer-profiles.md) |
| Functional requirements | Seven gaps against the text | **FR-60–FR-66 added** to the PRD |
| Non-functional requirements | Consistent; legal basis strengthened (Law 2004-63 Art. 18–19, 52; Decree-law 2023-17) | NFR notes added |
| Boundaries | Consistent | Claim rule added: "supports compliance", never "makes compliant" |
| Security, auditability, data protection | Consistent; two additions (sensitive-content flag; no foreign processing of personal data) | §6 |
| Integrations | Consistent; regulator submission is a **file export**, not an integration | §7 |
| Pricing hypotheses | Unchanged; still experimental (P1-D9) | Starter tier target note (§8) |
| Pilot acceptance criteria | Vague in places | Made measurable (§9) |
| Wireframes (6) | **Four inconsistencies found** | Corrected in the SVGs (§10) |
| Reusability across Government and Enterprise | Preserved and strengthened by rule packs as configuration | §11 |

## 2. Target customer (corrected)

| Segment | Regime | Count (end-2025) [V][S165] | Priority | Rule pack |
|---|---|---|---|---|
| Resident banks | BCT 2022-08 | 22 | **Primary** | RP-BCT-2022-08 |
| Leasing and factoring companies | BCT 2022-08 | 10 | **Primary** (Starter/Professional) | RP-BCT-2022-08 |
| Non-resident banks, investment banks | BCT 2022-08 (Annex 2) | 7 + 2 | Opportunistic | RP-BCT-2022-08 |
| Payment institutions | BCT 2026-10 (from ~Dec 2026); 2020-11 for mobile payment | 7 | **Secondary**. No dedicated-IT-solution article, so demand must be proven separately | RP-BCT-2026-10, RP-BCT-2020-11 |
| Banks' mobile-payment services | BCT 2020-11 | Banks offering wallets | Add-on to the bank deployment | RP-BCT-2020-11 |
| Microfinance institutions | Not BCT 2022-08. Ministry of Finance client-protection order of 24 Aug 2016 (cited by the OIF [V][S166]); supervisor not reviewed | — | Later | To define |
| Insurers | CGA Regulation 01/2023 on requests to the CGA (cited by the OIF [V][S166]) | — | Expansion (ICP-4) | To define after reading the text |

**Total market directly covered by 2022-08:** 41 institutions, of which 32 are the most relevant buyers. This is a **small, concentrated market**. A handful of lost deals changes the business case, which supports the earlier conclusion that Workspace RF funds the shared engine but is not, alone, a venture-scale market. The Government division and other regulated sectors carry the long-term scale ([09](../09-opportunity-scoring-matrix.md)). No change to the six-division strategy.

## 3. Core problem — verified vs unverified

| Statement | Status |
|---|---|
| Institutions must run a dedicated IT solution with central archiving, automatic acknowledgements for remote complaints, deadline alerts and KPIs (Art. 9) | **Verified [V]** |
| Responses within 15 working days of acknowledgement; reasons for rejection (Art. 8) | **Verified [V]** |
| Annual board report, internal-control chapter, internal audit every 3 years, annual ROGS760 XML statement (Art. 10–14) | **Verified [V]** |
| The BCT inspects complaint handling | **Verified [V]** in at least one 2025 general mission [S165] |
| Institutions miss deadlines or struggle with reporting | **Unverified [U].** The 23.5% statistic used earlier measured mediator handling, not banks (corrected) |
| Existing tools are inadequate and replaceable | **Unverified [U]**: new hypothesis H-R6 |
| Reporting is a buying trigger | **Unverified [U]**: new hypothesis H-R7 |

## 4. Personas

The persona set in [11](../11-target-customer-profiles.md) §11.3 maps onto the circular's roles:
- Sana and Mehdi: the Art. 4 structure and the branches (Art. 6 channel)
- Rim: owner of the Art. 10 board report and the ROGS760 statement
- Karim: the Art. 13 correspondent
- Ines: Art. 12 audit and data protection
- Walid: tenant administrator

**Clarifications made:**
- **Youssef** is now a **bank customer** disputing a failed transfer in the bank's app (2022-08). A wallet dispute at a payment institution falls under RP-BCT-2020-11 (7 working days).
- **ICP-1** (payment provider) is marked secondary.
- **ICP-3** separates leasing and factoring (2022-08) from microfinance (different regime).

## 5. Functional requirements — gaps closed

| New ID | Requirement | Source |
|---|---|---|
| **FR-60** | Case **type**: complaint ("réclamation") / service request / information-or-advice request. **Out-of-scope reasons** per Art. 2: referred to mediator, in court or arbitration, already settled, employment matter, domestic mobile payment under 2020-11. Regulatory statistics count only in-scope complaints | Art. 2 |
| **FR-61** | **Regulatory deadline ceiling**: for in-scope complaints under RP-BCT-2022-08 the response deadline is computed in **working days from the acknowledgement date** and **cannot be configured above 15**. Shorter internal targets are allowed. A pause for missing customer information must **not** move the regulatory deadline unless counsel confirms otherwise (Q-07). The acknowledgement contains at least the **registration date and reference**, and is **automatic for remote channels** | Art. 8, 9 |
| **FR-62** | **Annex 1 data set**: reference; name or company name; **RNE unique identifier** for legal persons; date of receipt; channel (incl. postal); product/service type; subject and description; **investigations carried out**; **steps taken**; outcome. Retention per the legal period (configurable until counsel answers Q-06) | Art. 9, Annex 1 |
| **FR-63** | **Internal-control chapter** export: description of the complaint system and the controls performed in the period, for the annual report under Circular 2006-19 Art. 52 | Art. 11 |
| **FR-64** | **Internal-audit pack**: sampling of cases, audit-log extract, configuration and template history, deadline statistics, for the audit due at least every 3 years and its approval by the audit committee | Art. 12 |
| **FR-65** | **Regulatory statement dataset and export**: ROGS760 per Annex 3 (complainant type; individuals by gender and age band; channel; subject × number × average response time × outcomes), annual, due DR + 45 days, XML. The institution submits it. RAA10/RAA20 for payment institutions. **Quarterly** mobile-payment complaint statement under 2020-11 Art. 44 | Art. 14, Annexes 2–3; 2026-10 Annex 1 bis; 2020-11 Art. 44 |
| **FR-66** | **Rule packs** as versioned configuration: RP-BCT-2022-08, RP-BCT-2026-10, RP-BCT-2020-11. Each sets definitions, deadline ceilings, mandatory fields, statement formats and customer-information texts. A tenant can run more than one pack (e.g. a bank with a wallet) | Art. 1–2; 2026-10; 2020-11 |

Changes to existing requirements:
- **FR-01:** postal mail added as a channel.
- **FR-03:** default taxonomy mapped to the eight Annex 3 subjects.
- **FR-23:** text block for account statements and contractual documents (Art. 7).
- **FR-32:** the board report format is not prescribed (Art. 10).

## 6. Non-functional, security, auditability and data protection

| Requirement | Legal basis now cited | Status |
|---|---|---|
| Tamper-evident audit log of views and changes; ex-post verification of who accessed what and when | Law 2004-63 **Art. 19**; BCT 2022-08 Art. 12 | Already in PRD (FR-42); legal basis added |
| Access control, encryption, secure backups | Law 2004-63 Art. 18–19 | In NFRs |
| **No processing of personal data by foreign sub-processors** in the MVP (email, SMS, monitoring, AI) unless the INPDP authorises it | Law 2004-63 **Art. 50–52** | **Added** as an NFR constraint |
| **Sensitive-content flag**: restricted visibility and redaction on export when a complaint mentions health, offences or other Art. 13–14 data | Law 2004-63 Art. 13–15, 62–63 | **Added** (part of FR-62 handling rules) |
| Gender and age band captured **only** for the ROGS760 statistic, preferably derived from core banking | Law 2004-63 Art. 11 (necessity) | Added to FR-65 guidance |
| Staff with production-data access meet processor-agent conditions | Law 2004-63 **Art. 22** (counsel to confirm) | Operational control, to confirm |
| Annual security audit; incident notification; CERT membership | Decree-law 2023-17 Art. 6–8, 19–20 | Release criterion (PRD §12.9) |
| BCT and customer audit access to the service | Law 2016-48 Art. 81; Circular 2025-06 Art. 15 by analogy | Contract and operations requirement |

## 7. Integrations

| Integration | Class (P1-D6) | Note |
|---|---|---|
| Customer SSO (SAML/OIDC) | 3: technically possible, per customer | Unchanged |
| Email in/out; SMS via Tunisian aggregator | 3 | Must be hosted in Tunisia or authorised (Art. 52) |
| Core-banking read-only lookup | 3 | Customer-provided API; also a source for gender and age band (FR-65) |
| **BCT reporting (ROGS760, RAA10/RAA20)** | **Not an integration.** CIVORA produces a file that the institution submits through its own BCT channel (SED) | CIVORA has **no access to BCT systems** and must not claim any. XML schema to obtain (Q-09) |
| Banking mediator | None. Case-file export only | Unchanged |

## 8. Pricing hypotheses

Unchanged and still **experimental** (P1-D9). One clarification: the **Starter** tier's target segment ("payment providers, microfinance, small FIs") is now the **secondary** segment. Leasing and factoring companies under 2022-08 are the main Starter candidates. Price testing follows the [validation package](fi-validation-package.md) §8 and [19](../19-commercial-and-pricing-strategy.md) §19.7.

## 9. Pilot acceptance criteria (made measurable)

Applied in the sandbox design-partner trial (before Phase 13) and again in the Phase 13 pilot.

| # | Criterion | Measure | Threshold |
|---|---|---|---|
| A1 | Regulatory deadline engine | Automated test suite over the Tunisian working-day calendar, incl. holidays | 100% of test cases correct; no deadline above 15 working days possible for RP-BCT-2022-08 |
| A2 | Acknowledgement | Every remote-channel complaint receives an automatic acknowledgement with date and reference | 100% in test runs |
| A3 | Reasoned rejections | Rejection without reason code and explanation is impossible | 100% blocked (automated test) |
| A4 | Annex 1 completeness | Mandatory fields present on closed complaints | ≥ 99% in the trial dataset |
| A5 | ROGS760 statement | Generated statement reconciles with the case database | Differences = 0 on synthetic data; partner compliance officer signs off the structure |
| A6 | Usability | Agent SUS (E-10) | ≥ 70 |
| A7 | Intake speed | Branch intake time | Median ≤ 2 minutes (RF-01) |
| A8 | Accessibility | WCAG 2.2 AA audit of console and status page | No open AA failures |
| A9 | Security | Pen test (pilot) | No open critical or high findings |
| A10 | Data rules | Trial uses synthetic or properly authorised test data only (P1-D5) | Zero real customer records; signed data attestation |
| A11 | Exit | Full export of trial data and deletion certificate | Delivered within 10 working days of the trial end |

## 10. Wireframe review (six screens)

| Wireframe | Finding | Correction |
|---|---|---|
| [wf-01 agent queue](../../../design/wireframes/wf-01-agent-queue.svg) | Consistent with the corrected wf-02 and wf-05. Shows no case-type column (FR-60) | No SVG change; the case-type column is noted for the hi-fi design in Phase 4 |
| [wf-02 case decision](../../../design/wireframes/wf-02-case-decision.svg) | **Inconsistent:** a "Cards" case received 11/11 was "overdue by 1 day" on 18/11 (4 working days), but wf-05 sets Cards to 10 working days | Dates moved: received **03/11/2026** (10 working days → 17/11; overdue on 18/11). Timeline and sub-task dates shifted accordingly |
| [wf-03 escalation export](../../../design/wireframes/wf-03-escalation-export.svg) | Consistent with Art. 13 | None |
| [wf-04 dashboard report](../../../design/wireframes/wf-04-dashboard-report.svg) | Note said the report format was unknown; now known (Art. 10 free format; ROGS760 via Art. 14 and Annex 3) | Annotation updated; XML schema still open (Q-02/Q-09) |
| [wf-05 admin categories](../../../design/wireframes/wf-05-admin-categories.svg) | **Contradicted the verified text**: it said "CIVORA does not hard-code regulatory deadlines", but Art. 8 sets a 15-working-day ceiling | Annotation now states that shorter deadlines are configurable and the 15-working-day ceiling cannot be exceeded (FR-61) |
| [wf-06 customer status, FR/AR RTL](../../../design/wireframes/wf-06-customer-status-mobile.svg) | (1) The "information requested" step was dated **14/11/2026, a Saturday**. (2) The customer was asked to reply by 20/11, **after** the bank's own 5-working-day deadline of 18/11 for this Transfers case | Step dated 13/11; customer reply date 17/11 in both the French (LTR) and Arabic (RTL) panels. RTL layout re-rendered and checked: no overflow |
| All Arabic copy | Terms "شكايتك" and "الموفّق المصرفي" (banking mediator) not yet checked against the official Arabic legal terminology | **E-13 native legal-language review** required before hi-fi |

The corrected wireframes were re-rendered in headless Chromium. No text overflows the frame.

## 11. Reusability across the Government and Enterprise divisions

- **The same Workspace engine.** Rule packs are **configuration** (definitions, deadline ceilings, mandatory fields, statement formats, notice texts) on one case engine.
- **A Government rule pack later.** Sector 20 (complaints, correspondence and application tracking; [05](../05-government-master-service-catalog.md)) would use its own pack for public-administration complaint rules, once those texts are verified. No new product is needed.
- **Shared platform capabilities** ([18](../18-shared-platform-requirements.md)) are unchanged: identity, notifications, audit, documents and country configuration. FR-66 follows the existing "country configuration, no hard-coded country logic" principle.
- **No change** to the six divisions, the 20-sector catalogue, its exclusions or the roadmap. All new requirements are **additive acceptance criteria** inside the original Phases 3–6 and 11–13 (P1-D4).

## 12. What remains unvalidated

| Item | Evidence needed | Owner |
|---|---|---|
| Demand, pains, willingness to pay, incumbents | E-01, E-03–E-06 via the [validation package](fi-validation-package.md) | Founder |
| Interpretation of Art. 81 outsourcing, Art. 22 processor conditions, retention period, deadline suspension | Counsel memo (Q-06–Q-11; legal matrix) | Founder + counsel |
| ROGS760 / RAA XML schemas | Design partner or BCT | Founder |
| Agent and customer usability | SUS ≥ 70 (E-10) | Founder/team |
| Arabic and French legal terminology | E-13 | Founder |
