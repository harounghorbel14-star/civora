# 14. Business Model and Government Partnership Strategy

## 14.1 Principles (non-negotiable)

1. **Citizens are never charged** for identity or essential public services.
2. **No sale, rental or monetisation of personal data. No advertising. No health-data monetisation**, including "anonymised" resale.
3. **No claim of government endorsement** without written authorisation. Every external document distinguishes prototype, authorised pilot and official deployment (see [README](README.md)).
4. **Revenue only from legitimate institutional contracts and approved services.**

## 14.2 Revenue lines

| Line | Customer | Revenue model | Indicative pricing [A] | Gross margin [A]* |
|---|---|---|---|---|
| **L1 Trust — platform** | Banks, payment institutions, insurers, telcos, universities, clinics | Monthly subscription per institution (tiered by volume and modules) | 2,000–8,000 TND / month | ~85% |
| **L1 Trust — usage** | Same | Per verification / per signature event | 2–4 TND per KYC event; 0.3–1 TND per authentication or signature [A]. For reference, Estonia's Smart-ID charges €0.10 per transaction [V][S98] | ~55% (third-party vendor fees) |
| **L2 Platform licence** | Ministries, agencies, social funds, municipalities | Annual licence per institution (modules × users/volume), deployed on client's hosting | 60k–250k TND / year per institution | ~90% |
| **L2 Implementation services** | Same, and donor-funded programmes | Fixed-price or time & materials; milestone billing | 150k–1.5M TND per project | ~70% before own delivery staff |
| **L2 Support & maintenance** | Same | % of licence or fixed annual fee; SLA tiers | 18–22% of licence / year | ~80% |
| **L2 Managed operations** | Institutions without capacity | Monthly fee, on CNI or labelled host (hosting passed through) | Case by case | ~40–60% |
| **L3 Country deployments** | Foreign governments, donor programmes | Implementation + licence + support; possibly operator/revenue-share where legal (Saudi model [P][S91]) | US$0.5–3M implementation + 15–25%/yr | ~60–75% |
| **Training & certification** | Civil servants, integrators | Courses, partner certification | Small | ~70% |

\* "Gross margin" here excludes CIVORA's own staff, who are all in operating expenses in the model. Contribution margin after delivery staff is materially lower for services (~35–45% [A]).

**Explicitly not pursued:**
- Fees from citizens.
- Sale of insights derived from citizen data.
- Advertising.
- "Freemium" citizen features that push paid upgrades.
- Transaction fees on mandatory government payments charged to citizens. Payment costs are borne by the institution or as agreed by public policy.

## 14.3 Why this mix

- **L1** has short sales cycles (3–6 months [A]), regulatory pull (BCT 2025-06 / 2026-10 [P][S51][S53]) and recurring revenue. It builds identity-verification depth and Tunisian references. Its ceiling in Tunisia is modest (~1.5–4M TND per year market, Section 3.6).
- **L2** is the core mission and carries larger contract values, but cycles run 6–24 months and payment risk is real [P][S115]. Donor-funded programmes, such as World Bank GovTech (US$100M, closing May 2027) [V][S74] and SECO-funded interoperability [V][S22], reduce payment risk.
- **L3** delivers the venture-scale outcome. It depends on L1/L2 references.

## 14.4 Pricing principles for government

- **Transparent unit pricing** published to clients (per module, per institution, per volume band), so that procurement can compare.
- **No lock-in:**
  - data export in open formats
  - documented APIs
  - escrow of source code for critical deployments
  - transition assistance clause
  - optional transfer of the operating licence to a public operator (e.g. CNI)
- **Outcome-linked components** where measurable, e.g. part of fees tied to SLA attainment or processing-time reduction.
- **Price localisation** by country income level; donor-funded pricing aligned with the programme's cost norms.

## 14.5 Unit economics (indicative, [A])

| Metric | L1 Trust (per client) | L2 Platform (per institution) |
|---|---|---|
| Annual contract value | 54k–72k TND (subscription + usage) | 120k–250k TND licence + 150k–1M one-off |
| Sales cycle | 3–6 months | 6–24 months |
| Customer acquisition cost | ~15k–30k TND | ~60k–150k TND (bids, pilots, travel) |
| Payback | ~4–8 months | 12–24 months (incl. implementation margin) |
| Churn risk | Medium (vendor switching) | Low once deployed; high political-cycle risk before adoption |

## 14.6 Government procurement strategy

**Channels, in order of accessibility:**
1. **Donor-financed programmes** (World Bank, SECO, EU, GIZ, AfDB). These follow donor procurement rules where applicable [P][S55]. Enter as subcontractor or consortium member with a prime (e.g. international integrators already present, local consultancies) [V][S22].
2. **Innovation / start-up procurement routes**, if the 10% start-up measure exists in force [P][S57][U]. Also pilots funded by innovation programmes.
3. **Open tenders on TUNEPS** [P][S54], once CIVORA has references, ISO 27001 and financial standing. Bid as a consortium where turnover thresholds apply.
4. **Framework agreements and direct agreements** under thresholds: low-value pilots (counsel Q8).
5. **PPP / operated-platform models**: long term, only if a legal framework and political sponsorship exist.

**Bid readiness pack (prepare by M9):**
- Company documents.
- Security documentation: architecture, policies, pen-test summary.
- Data-protection documentation: DPIA templates, DPA, records of processing.
- Product documentation and API specs.
- Accessibility statement.
- CVs of key staff.
- References (B2B and pilots).
- Financial statements.
- Anti-bribery policy and code of conduct.

## 14.7 Government partnership model — staged

| Stage | Instrument | Scope | What CIVORA may claim |
|---|---|---|---|
| 0. Independent prototype | None | Synthetic data, CIVORA hosting | "Independent prototype" |
| 1. Exploration | NDA / letter of intent | Requirements workshops; demo on synthetic data in the institution's environment | "In discussions with…" only with the institution's consent; otherwise nothing |
| 2. Authorised pilot | Convention / MoU / small contract; DPIA; INPDP formalities; security audit | Limited users, services, duration (3–6 months); success metrics; exit plan | "Pilot conducted with [institution] under [ref.]" |
| 3. Deployment | Procurement contract | Production scope, SLAs, hosting on client-designated infrastructure | "Operated for/with [institution] under contract" |
| 4. Scale / operate | Framework / multi-institution contract or operator licence | National rollout | As contracted |

## 14.8 Pilot proposal template (to be produced in Phase 1)

1. Problem statement with baseline metrics (e.g. average processing time, repeat visits, call volumes).
2. Scope: services, offices, user groups, duration.
3. Solution: modules, deployment location, integrations (simulated vs authorised).
4. Data protection: roles, lawful bases, DPIA, retention, rights.
5. Security: architecture, audit, incident response.
6. Success metrics and evaluation method (independent if possible).
7. Costs and funding source.
8. Governance: steering committee, change control.
9. Exit and transition: data return, decommissioning.
10. Communication plan (who can say what, when).

## 14.9 Executive presentation & proposal set (Phase 1 deliverables)

Phase 0 does not produce these. They are scheduled for Phase 1 once the founder approves the positioning:
- Government proposal (10–15 pages).
- Executive presentation (12–15 slides).
- Technical documentation pack (architecture, APIs, deployment).
- Security documentation pack.
- Pilot proposal (per target institution).
- Partnership model one-pager for donors and primes.
- Institutional stakeholder map (from Section 5.2, maintained as a living CRM).
