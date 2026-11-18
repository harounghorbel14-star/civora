# 19. Commercial and Pricing Strategy

> **Founder review (P1-D9): all prices in this document are EXPERIMENTAL PRICING HYPOTHESES** until tested with prospective institutional customers (evidence E-04, E-06). They must not be quoted to customers as a price list.

All prices are **hypotheses [A]** to test with design partners. Prices exclude VAT. 1 USD = 2.969 TND (BCT, 5 Nov 2026; Phase 0 S84).

## 19.1 Go-to-market for the first product (Workspace — Regulated Finance)

| Stage | Activity | Output | When |
|---|---|---|---|
| 1. Discovery | 15+ interviews with banks, FIs and payment providers (research kit §8.12) | Validated pains, budgets, incumbent map | Days 1–60 (Phase 1) |
| 2. Design-partner programme | 3–5 institutions; **sandbox only** (synthetic data or properly authorised test data; P1-D5 approved); agreement subject to Tunisian counsel review (P1-D11); co-design categories, templates and reports; modest paid evaluation fee, credited against year-1 subscription | 2–3 signed design-partner agreements | From Day 45 (Phase 1) through Phase 12 |
| 3. Security & procurement readiness | Architecture pack, pen-test report, DPIA template, processor agreement, hosting statement | Bid/procurement pack | Phase 11 |
| 4. Pilot | 2–3 production pilots (3 months) | Pilot reports, references | **Phase 13** |
| 5. Scale | Annual contracts; editions for insurers, telcos, utilities | ARR growth | Phase 14 |

**Sales motion:**
- Founder-led for the first 5 customers.
- A regulated-industries account executive is hired once 2 design partners convert, or at Phase 13.

**Channels and partners** [A — to recruit]:
- Compliance and audit consultancies, which advise on BCT inspections.
- Banking-software integrators, for core-banking adapters.
- Hosting providers with G-Cloud/N-Cloud labels.
- Later, regional partners for Maghreb and Francophone Africa.

**Messaging pillars:**
1. "BCT 2022-08-ready complaint handling, out of the box."
2. "Every customer knows where their complaint stands."
3. "Your data stays in Tunisia, or on your premises."
4. "Board report in an hour, not a week."

No claim of BCT endorsement or certification may be made.

## 19.2 Pricing — Workspace RF

| Tier | Target | Included | Price hypothesis |
|---|---|---|---|
| **Starter** | Payment providers, microfinance, small FIs | Up to 10 agent seats · 1 tenant · TN-hosted SaaS · standard reports · email/SMS (SMS at cost) | **1,500–2,500 TND/month** + onboarding 10–15k TND |
| **Professional** | Mid-size banks, insurers, larger FIs | Up to 50 seats · SSO · branch intake · annual report wizard · API & webhooks · priority support | **4,000–7,000 TND/month** + implementation 25–40k TND |
| **Enterprise** | Large banks; on-prem or private cloud | Unlimited seats · on-prem/private deployment · custom adapters · SLA 99.9% · named CSM | **8,000–15,000 TND/month** (SaaS) or **licence 100–180k TND/yr + 20% support** + implementation 50–120k TND |
| Add-ons (later) | — | e-signature of letters; AI classification (Phase 10); e-KYC review queues (partners) | Per add-on |

**Benchmark check:**
- Global help-desk suites list at about US$55–115 per agent per month (Zendesk Suite Team–Professional) [P][S147].
- For a 30-agent complaints team that is roughly 4,900–10,200 TND/month at list price, before local hosting, BCT-specific workflows or Arabic/French templates.
- The Professional tier sits **at or below** this range while adding compliance features and local hosting.
- Cheaper horizontal entry plans exist (~US$15–19 per agent) [P][S148]. CIVORA should not compete on price at the low end.

**Pricing principles:**
- Per-institution tiers rather than pure per-seat pricing, to encourage branch-wide use.
- Transparent price list.
- Multi-year discounts.
- **No price based on customer data volume**, to avoid incentives to collect more.

## 19.3 Government pricing (unchanged from Phase 0 §14)

| Line | Price hypothesis |
|---|---|
| Platform licence | 60k–250k TND per institution per year |
| Implementation | 150k–1.5M TND |
| Support | 18–22% of licence per year |

Donor-funded and co-financed options remain as in Phase 0. Citizens are never charged.

## 19.4 Unit economics — Workspace RF [A]

| Metric | Starter | Professional | Enterprise |
|---|---|---|---|
| Annual recurring revenue per customer | 18–30k TND | 48–84k TND | 96–180k TND |
| Gross margin (external costs only) | ~80% (SMS pass-through excluded) | ~85% | ~85–90% |
| Customer acquisition cost | 8–15k TND | 20–40k TND | 50–100k TND |
| Sales cycle | 2–4 months | 4–9 months | 9–15 months |
| Payback on CAC | ~5–8 months | ~5–8 months | ~7–10 months |
| Implementation margin | ~50% | ~50% | ~50% |
| Assumed annual churn | 15% | 8% | 5% |

**Model blended assumptions** ([20](20-updated-financial-assumptions.md)):

| Scenario | ARPU (TND/month) | Implementation fee (TND) |
|---|---|---|
| Lean | 4,500 | 20,000 |
| Moderate | 6,000 | 30,000 |
| Enterprise | 7,000 | 40,000 |

## 19.5 Commercial targets (Moderate scenario, for planning)

| Milestone | Target | Timing |
|---|---|---|
| Qualified discovery conversations | ≥ 15 | Day 60 |
| Design-partner agreements | ≥ 2 signed (target 3) | Day 90 → M9 |
| Production pilots | 2–3 | Phase 13 (~M17–M18 under the approved overlapping execution model, P1-D4) |
| Paying customers | 6 | ~M27 |
| Paying customers | 12 | ~M36 |
| First public-institution Workspace contract | 1 | ~M20–M28 (donor or direct; after the Phase 13 Government pilot starts) |

*Timing corrected on 18 Nov 2026 to match the v3/v4 baseline under the approved execution model ([20](20-updated-financial-assumptions.md) §20.6–§20.7). The earlier targets (~M14, 6 customers by ~M23, 14 by ~M35) came from v2.0, before full-scope phases were restored. These are **planning targets, not forecasts or commitments**.*

## 19.6 Contract principles

- CIVORA acts as processor under a DPA.
- Data stays in Tunisia, or on customer premises.
- Exit and export clauses.
- Source-code escrow is available for Enterprise.
- SLA credits.
- No use of customer data for any other purpose, including product benchmarking without explicit opt-in.
- Security audits allowed. The BCT's audit expectations on remote-identification technology (Circular 2026-10) indicate customers will audit vendors [P Phase 0 S52].

## 19.7 Pricing experiment plan (to turn hypotheses into evidence)

| Experiment | Method | Sample | Output | Evidence ID |
|---|---|---|---|---|
| Willingness-to-pay ranges | Van Westendorp price-sensitivity questions per tier, asked at the end of discovery interviews | ≥ 8 institutions | Acceptable price range per tier | E-04, E-06 |
| Tier fit | Present 3 tiers; ask which fits and what is missing | ≥ 8 institutions | Tier boundaries (seats, features, hosting) | E-06 |
| Design-partner fee | Offer a paid sandbox programme with the fee credited to year 1; record acceptance or objections | 5 offers | Conversion rate; fee level accepted | E-04 |
| Competitive anchors | Collect current tool costs or competitor quotes | ≥ 3 data points | Price anchors | E-05 |
| On-prem vs SaaS preference | Ask hosting requirement and its budget impact | ≥ 8 institutions | Model mix (SaaS / private / on-prem) | E-03 |

**Decision rule:** prices become "validated" only when ≥ 5 institutions confirm a range and ≥ 2 sign at or near the proposed level.
