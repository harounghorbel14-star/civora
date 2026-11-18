# 10. First Product Recommendation

> **Founder review (18 Nov 2026) — P1-D3 is CONDITIONAL.** Workspace — Regulated Finance remains the *recommended* first commercial product. The opportunity score is **not** proof of market demand. Confirmation requires:
> - ≥ 15 discovery interviews
> - validated regulatory requirements
> - confirmed buyer and purchasing process
> - willingness-to-pay evidence
> - competitor and pricing validation
> - a realistic MVP cost assessment
>
> Status: [validation-evidence-register.md](validation-evidence-register.md) (E-01…E-07).

## 10.1 Recommendation

> **CIVORA Workspace — Regulated Finance edition**
> A complaints and customer-request case-management platform for Tunisian banks and financial institutions (and, with a separate rule pack, payment institutions). It is built to support institutions in meeting BCT Circular 2022-08 and resolve customer issues on time, with a full audit trail. It is hosted in Tunisia or on the customer's premises, and is Arabic/French native.

It is the first product **of the shared Workspace engine**. The same engine powers the Government Workspace (Division A) and later editions for insurers, telecom operators and utilities.

## 10.2 Why this product (summary of evidence)

| Test | Result | Evidence |
|---|---|---|
| Ranked first in weighted scoring | 66.6 / 100, #1 under all three weightings | [09](09-opportunity-scoring-matrix.md) |
| Verified regulatory requirement | BCT Circular 2022-08 (20 Oct 2022): complaint-handling policies as first level before the mediator; customers informed of procedures, deadlines and mediation; **written reasons for any rejection**; **dedicated IT solution (Art. 9)**; correspondent to mediator/BCT; annual report to the board | [P][S141][S142]. Full official text to be retrieved and archived (90-day plan) |
| Evidence of pain | **Obligation verified** (Art. 8–9, 14 of BCT 2022-08) [V][S159]. **Pain unverified**: the earlier 23.5% figure measured mediators, not banks, and is withdrawn [V][S166]. Compliance was due in 2023, so incumbents are likely | [validation/bct-regulatory-verification.md](validation/bct-regulatory-verification.md) |
| Countable buyers | 41 institutions under 2022-08 (29 banks, 8 leasing, 2 factoring, 2 investment banks); 7 payment institutions under 2026-10/2020-11 | [V][S165] |
| Growing segment | Mobile payments +80.5% in 2025 → more fintech customers and complaints | [P][S134] |
| Buildable with low technical risk | Workflow, documents, notifications, audit — no biometrics, no health data, no government registry access | — |
| Strategic leverage | Builds the exact shared capabilities Government needs (sector 20 complaints/tracking; sectors 09, 11, 16) | [06](06-tunisia-government-service-mapping.md) §6.4 |
| Regulatory feasibility | Customer is controller of its own data; CIVORA is processor; Tunisian hosting or on-premises; BCT outsourcing/IT-risk expectations to confirm with counsel | Phase 0 §11; counsel questions in [21](21-risks-and-regulatory-requirements.md) |

## 10.3 Target market and initial customers

| Segment | Count (evidence) | Why first | Sequence |
|---|---|---|---|
| **Mid-size resident banks** (non-top-5) | Part of 22 resident banks [V][S165] | Art. 9 dedicated IT solution required; budgets; need customer-facing tracking | **Design partners 1–2** |
| **Leasing and factoring companies; SME/micro-project banks** | 8 leasing + 2 factoring; 2 SME/micro-project banks (BTS, BFPME) [V][S165] | Covered by 2022-08; smaller teams; possibly underserved | **Design partner 3**; early customers |
| **Payment institutions** | 7 licensed (6 end-2025 + Walletii 2026) [V][S165] | Fast-growing, likely little legacy tooling, but **not covered by 2022-08**: Circular 2026-10 (from ~Dec 2026) and 2020-11 (mobile payment, 7 working days). Weaker regulatory pull; demand to prove | Validate in discovery; separate rule pack |
| *Microfinance institutions* | Not BCT-licensed; Ministry of Finance client-protection order (2016) [V][S166] | Different regime | Later |
| **Large banks** | Top resident banks | Highest value; slowest; likely incumbent systems | After 2–3 references |
| **Expansion editions** | Insurers [A], telecom operators, utilities (STEG/SONEDE) | Same workflow pattern | Phase 14 |

Customer profiles are in [11](11-target-customer-profiles.md).

## 10.4 MVP scope (detail in [13](13-mvp-scope-and-specification.md))

1. **Multichannel intake:**
   - branch agent form
   - web form for customers
   - email-to-case
   - phone log
2. **Case management:**
   - categories (configurable taxonomy)
   - assignment and queues
   - **deadline/SLA timers** with escalation
   - internal notes
   - attachments
3. **Reasoned decisions:**
   - reason codes
   - approved response templates (AR/FR)
   - **mandatory written reasons for any full or partial rejection**
4. **Customer status tracking:** reference number, mobile-first status page, SMS/email notifications.
5. **Mediator & regulator liaison:** correspondent workspace, escalation records, exports.
6. **Reporting:**
   - operational dashboard
   - **annual board report** and regulator statistics (format to confirm from the official text)
7. **Administration & audit:**
   - roles
   - categories
   - SLA rules
   - templates
   - tamper-evident audit log
   - retention
8. **Deployment:** Tunisian labelled host or customer on-premises; Arabic/French/English; RTL.

**Not in MVP:**
- AI triage or document processing (Phase 10 future requirements)
- e-KYC
- core-banking write-back
- e-signature (Phase 4 capability, later edition)

## 10.5 Mapping to the original (unchanged) roadmap

Every original phase keeps its **complete** Phase 0 §19 scope (P1-D4). Workspace RF capabilities are **additive** acceptance criteria in:
- Phase 2 (architecture)
- Phase 3 (staff SSO, customer OTP)
- Phase 4 (documents, letters, retention)
- Phase 5 (taxonomy engine)
- Phase 6 (case engine, reasoned decisions, liaison, reports)
- Phase 11 (security, audits)
- Phase 12 (customer-side integrations, e-KYC partners)
- Phase 13 (2–3 production pilots alongside the Government pilot)

Phases 7–10 run at full scope, with no Workspace RF additions. The only exception is optional Workspace AI inside Phase 10, by founder decision.

The phase-by-phase table is in [roadmap-protection-matrix.md](roadmap-protection-matrix.md). The v2.0 "light pass" proposal is withdrawn.

## 10.6 Commercial strategy (detail in [19](19-commercial-and-pricing-strategy.md))

- **Design-partner programme before Phase 13** (approved P1-D5; sandbox only, synthetic data or properly authorised test data):
  - 3–5 institutions
  - modest paid evaluation fees
  - co-design of templates and reports
- **Founder-led sales**, then a regulated-industries sales lead.
- **Partners:** compliance consultancies and audit firms, banking-software integrators.
- **Pricing tiers** (experimental hypotheses, P1-D9): Starter (leasing/factoring, payment institutions) / Professional (mid-size banks) / Enterprise (large banks, on-prem), plus implementation fee.

## 10.7 Kill / pivot criteria (by end of the 90-day plan)

| Signal | Threshold | Action |
|---|---|---|
| Qualified interest | < 3 of 15 institutions confirm budget and timeline | Re-score; consider E2 or Government-first with donor funding |
| Design partners | < 2 signed design-partner agreements | Same |
| Regulatory blocker | Counsel finds outsourcing/hosting barriers that customers cannot accept | Shift to on-prem licence model or reconsider |
| Incumbent lock-in | > 70% of banks interviewed satisfied with an installed tool (H-R6 refuted) | Narrow to leasing/factoring and the payment-institution rule pack; test insurance edition; or revisit P1-D3 |

## 10.8 Long-term expansion from this product

1. Editions for insurers (claims and complaints), telecom operators and utilities.
2. Government Workspace for institutions (sector 20 first; then 09, 11, 16, 02).
3. Add-ons as their roadmap phases arrive:
   - e-KYC review queues (partners)
   - e-signature of responses (Phase 4)
   - AI classification and document extraction (Phase 10)
4. International: banking supervisors in Maghreb and Francophone Africa (country packs).
