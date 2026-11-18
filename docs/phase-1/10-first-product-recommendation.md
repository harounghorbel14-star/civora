# 10. First Product Recommendation

## 10.1 Recommendation

> **CIVORA Workspace — Regulated Finance edition**
> A complaints and customer-request case-management platform for Tunisian banks, financial institutions and payment providers. It is built so that institutions meet BCT Circular 2022-08 and resolve customer issues on time, with a full audit trail. It is hosted in Tunisia or on the customer's premises, and is Arabic/French native.

It is the first product **of the shared Workspace engine**. The same engine powers the Government Workspace (Division A) and later editions for insurers, telecom operators and utilities.

## 10.2 Why this product (summary of evidence)

| Test | Result | Evidence |
|---|---|---|
| Ranked first in weighted scoring | 66.6 / 100, #1 under all three weightings | [09](09-opportunity-scoring-matrix.md) |
| Verified regulatory requirement | BCT Circular 2022-08 (20 Oct 2022): complaint-handling policies as first level before the mediator; customers informed of procedures, deadlines and mediation; **written reasons for any rejection**; **dedicated IT solution (Art. 9)**; correspondent to mediator/BCT; annual report to the board | [P][S141][S142]. Full official text to be retrieved and archived (90-day plan) |
| Evidence of pain | 23.5% of admissible complaints exceeded regulatory deadlines (2020 mediation report; must be refreshed) | [P][S142] |
| Countable buyers | 29 banks, 18 financial institutions (end-2025); 16 licensed payment providers (Mar 2026) | [P][S132][S133] |
| Growing segment | Mobile payments +80.5% in 2025 → more fintech customers and complaints | [P][S134] |
| Buildable with low technical risk | Workflow, documents, notifications, audit — no biometrics, no health data, no government registry access | — |
| Strategic leverage | Builds the exact shared capabilities Government needs (sector 20 complaints/tracking; sectors 09, 11, 16) | [06](06-tunisia-government-service-mapping.md) §6.4 |
| Regulatory feasibility | Customer is controller of its own data; CIVORA is processor; Tunisian hosting or on-premises; BCT outsourcing/IT-risk expectations to confirm with counsel | Phase 0 §11; counsel questions in [21](21-risks-and-regulatory-requirements.md) |

## 10.3 Target market and initial customers

| Segment | Count (evidence) | Why first | Sequence |
|---|---|---|---|
| **Payment providers / payment institutions** | 16 licensed PSPs (Mar 2026) [P][S133]; 6 payment institutions in the BCT 2025 report [P][S132] | New, fast-growing, lean compliance teams, likely no legacy complaint tooling; shorter decisions | **Design partners 1–2** |
| **Mid-size resident banks** (non-top-5) | Part of 22 resident banks [P][S132] | Regulatory requirement; budgets; need customer-facing tracking | **Design partners 2–3** |
| **Specialised banks & financial institutions** (microfinance/SME banks, leasing, factoring) | 2 SME/micro-project banks + 8 leasing + 2 factoring [P][S132] | High-volume simple cases; underserved | Early customers |
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

| Phase | First-product track scope | Ecosystem scope (same phase) |
|---|---|---|
| 2 Technical Architecture | Architecture for Workspace + shared platform | Government & future divisions considered, not built |
| 3 Authentication & Citizen Profiles | Staff auth (SSO, MFA), customer reference access, tenant/roles | Citizen accounts, mandates (Government) |
| 4 Digital Documents | Attachments, response letters, document retention | Credentials/wallet design |
| 5 Government Services Directory | Category & service taxonomy engine (complaint categories) | 20-sector Directory |
| 6 Civil Registry Workflows | **Case/workflow engine, SLAs, decisions** | Civil-registry templates (synthetic) |
| 7 Healthcare Prototype | Light pass: documentation + synthetic prototype only | Health consent bridge (synthetic) |
| 8 Payments & Financial Services | Light pass (subscription billing outside the product) | Payment orchestration design |
| 9 Social Security & Education | Light pass | Status-tracking templates (synthetic) |
| 10 AI Government Assistant | Light pass; AI future requirements for Workspace documented | Guide / document processing design |
| 11 Security, Testing & Auditing | **Full**: pen test, ANCS-compliant audit, DPIA | Same |
| 12 Official Institutional Integrations | Customer-side integrations (email, SMS, SSO, optional core-banking read) | Government integrations by authorisation |
| 13 Pilot Deployment in Tunisia | **First production pilots with 2–3 financial institutions** + one public institution if available | — |

"Light pass" means the phase still happens in order. Its scope for this cycle is limited to documentation and synthetic prototypes, so it does not delay the first product. This needs founder approval (**P1-D4**).

## 10.6 Commercial strategy (detail in [19](19-commercial-and-pricing-strategy.md))

- **Design-partner programme before Phase 13** (sandbox only, synthetic or anonymised data):
  - 3–5 institutions
  - modest paid evaluation fees
  - co-design of templates and reports
- **Founder-led sales**, then a regulated-industries sales lead.
- **Partners:** compliance consultancies and audit firms, banking-software integrators.
- **Pricing tiers:** Starter (payment providers) / Professional (mid-size banks) / Enterprise (large banks, on-prem), plus implementation fee.

## 10.7 Kill / pivot criteria (by end of the 90-day plan)

| Signal | Threshold | Action |
|---|---|---|
| Qualified interest | < 3 of 15 institutions confirm budget and timeline | Re-score; consider E2 or Government-first with donor funding |
| Design partners | < 2 signed design-partner agreements | Same |
| Regulatory blocker | Counsel finds outsourcing/hosting barriers that customers cannot accept | Shift to on-prem licence model or reconsider |
| Incumbent lock-in | > 70% of banks interviewed satisfied with an installed tool | Narrow to payment providers/microfinance; test insurance edition |

## 10.8 Long-term expansion from this product

1. Editions for insurers (claims and complaints), telecom operators and utilities.
2. Government Workspace for institutions (sector 20 first; then 09, 11, 16, 02).
3. Add-ons as their roadmap phases arrive:
   - e-KYC review queues (partners)
   - e-signature of responses (Phase 4)
   - AI classification and document extraction (Phase 10)
4. International: banking supervisors in Maghreb and Francophone Africa (country packs).
