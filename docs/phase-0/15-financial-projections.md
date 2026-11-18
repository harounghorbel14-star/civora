# 15. Financial Projections

> **Every number in this section is a modelling assumption [A] unless labelled otherwise.** No contract, grant or investment exists. Revenue lines are hypotheses to be tested, not forecasts to be promised. The monthly model is in [data/financial-model-monthly.csv](data/financial-model-monthly.csv).

## 15.1 Conventions

- Currency: **TND**, excluding VAT (19% VAT applies to most services [A — confirm]).
- USD conversions at **1 USD = 2.9690 TND**, the BCT rate of 5 Nov 2026 [P][S84].
- Month 1 (M1) = first month after Phase 0 approval *and* initial funding.
- Horizon: 36 months.
- **Opex:** all staff costs.
- **Gross margin:** external direct costs only (third-party vendor fees, client-specific hosting, subcontractors, travel).
- Employer cost = gross salary × **1.25** (employer social contributions, work-accident and training levies, benefits) [A — confirm with accountant].
- Salary increase **8%** at M13 and M25 [A].
- 10% contingency on all non-staff costs [A].
- EBITDA only. Corporate income tax is ignored: start-ups with the label benefit from tax incentives under the Startup Act [P][S59 — confirm scope].

## 15.2 Verified data points versus estimates

| Item | Value used | Basis |
|---|---|---|
| FX USD/TND, EUR/TND | 2.9690 / 3.3420 | **[P]** BCT rate via press [S84] |
| Developer salary benchmarks | Glassdoor: avg ~TND 2,000/month base for software developers in Tunis (range 1–3k), Levels.fyi median total comp ~TND 2,615/month. Senior guides cite 4,500–7,000 | **[P]** [S85][S86]. CIVORA plans *above-median* pay for senior roles (retention against remote foreign employers) [A] |
| G-Cloud label fees (for hosting providers) | 500 TND file + 3,500 TND/yr | **[P]** [S43]/[S45] press. Relevant only if CIVORA itself seeks a label |
| Cybersecurity non-compliance exposure | Up to 100k TND fine (headline) | **[P]** [S40] |
| Reference transaction price (eID auth) | €0.10/transaction (SK ID Solutions, 2022) | **[V]** [S98], an international benchmark, not a Tunisian price |
| All other costs (hosting, tools, legal, audits, certifications, office, travel) | See below | **[A]**. To be replaced with quotes in the first 90 days |

## 15.3 Initial capital requirements (one-off, Year 1)

| Item | Lean | Moderate | Enterprise |
|---|---|---|---|
| Company formation, statutes, Startup Act label application, accounting set-up | 8k | 10k | 30k (incl. holding-structure advice) |
| Legal opinions (data protection, health, procurement, e-signature, BCT) | 15k | 40k | 90k (TN + 2 foreign markets) |
| Trademark clearance & filings (TN, EU, Madrid) | 7k | 25k | 40k |
| Pre-pilot penetration test | 15k | 30k | 60k |
| Brand identity & design system agency | — (in-house) | 15k | 40k |
| ISO 27001 readiness consultancy | — | — | 40k |
| **Subtotal one-off** | **45k** | **120k** | **300k** |
| Equipment (4,500 TND per hire, in Y1) | 36k (8 hires) | 77k (17 hires) | 135k (30 hires) |
| **Total Year-1 one-off + equipment** | **~81k TND** | **~197k TND** | **~435k TND** |

Recurring compliance one-offs:
- **Year 2:** Lean 70k / Moderate 220k / Enterprise 600k. Covers ISO 27001 certification, the ANCS audit and pen tests.
- **Year 3:** 90k / 300k / 900k. Adds ISO 27701, international legal and certifications.

## 15.4 Staffing plans

**Lean (10 people by M36):**

| Role | Start | Gross / month [A] |
|---|---|---|
| Founder/CEO (reduced salary) | M1 | 3,000 |
| CTO / lead architect | M1 | 7,500 |
| Senior full-stack engineer | M1 | 5,500 |
| Full-stack engineer | M2 | 3,500 |
| Product designer (part-time) | M2 | 2,500 |
| AI engineer | M7 | 6,000 |
| Government relations & BD lead | M10 | 5,500 |
| DevSecOps engineer | M10 | 6,000 |
| Full-stack engineer #2 | M16 | 3,500 |
| QA engineer | M19 | 3,000 |

Security leadership (fractional CISO) and DPO/legal are bought as services in overhead.

**Moderate (17 by M12, 25 by M24, 29 by M36):**
- **Core team in the first months:** CEO, CTO, Head of Product, 2 senior full-stack engineers, product designer, DevSecOps, government relations director, security lead, AI engineer, finance/admin, mobile engineer, full-stack engineers, compliance & DPO, QA, B2B sales.
- **Year 2 additions:** solutions engineers, customer success, data/ML engineer, SRE.
- **Year 3 additions:** international BD and support.

**Enterprise (30 by M12, 44 by M24, 54 by M36):** the Moderate team plus:
- a parallel product team
- a health-informatics lead
- an in-house legal counsel
- a bid manager
- two international BD leads
- two country delivery teams from M18 and M26

## 15.5 Monthly operating costs

| | Lean | Moderate | Enterprise |
|---|---|---|---|
| Opex in M1 | 51k TND (~US$17k) | 114k TND (~US$39k) | 190k TND (~US$64k) |
| Average monthly burn, Year 1 | 53k | 162k | 286k |
| Average monthly burn, Year 2 | 72k | 203k | 325k |
| Average monthly burn, Year 3 | 65k | 207k | 216k |
| Opex in M36 | 109k | 383k | 849k |

Non-staff monthly run-rate examples (Year 1 → Year 3, before contingency):

| Line | Lean | Moderate |
|---|---|---|
| Hosting (dev/staging + labelled Tunisian host for pilots) | 2.5k → 7k | 6k → 25k |
| AI/LLM usage & inference | 1k → 2.5k | 3k → 10k |
| Tools & licences | 1.2k → 2.5k | 3.5k → 9k |
| Office / coworking | 1.5k → 3.5k | 6k → 14k |
| Legal & DPO retainer | 2k → 4k | 6k → 12k |
| Fractional CISO (Lean only) | 1.5k → 3k | (in-house) |
| Travel / BD / events | 1k → 3k | 5k → 18k |

## 15.6 Revenue assumptions (hypotheses, not pipeline)

| Driver | Lean | Moderate | Enterprise |
|---|---|---|---|
| Paid B2B pilots | 2 × 15k (M10, M12) | 3 × 20k (M8–M12) | 4 × 25k (M6–M11) |
| B2B clients (L1) | 1 at M13 → 8 at M36 | 1 at M12 → 14 at M36 | 4 at M12 → 30 at M36 |
| B2B revenue per client per month | 3.0k subscription + 1.5k usage | 4.0k + 2.0k | 4.5k + 2.5k |
| B2G / donor services contracts (L2) | 180k (M18–26); 240k (M28–36) | 450k (M14–22); 700k (M20–31); 900k (M28–39) | 0.6M (M10–18); 1.2M (M16–27); 1.5M (M24–35) |
| B2G licences | 1 × 120k/yr from M27 | 3 × 200k/yr (M23, M30, M34) | 6 × 250k/yr (M18–M34) |
| International (L3) | — | Pilot 600k (M28–36) + 150k/yr licence from M33 | 3.0M (M20–31); 4.5M (M28–39); 2 × 600k/yr licences |

## 15.7 Three-year summary

**Lean**

| TND | Year 1 | Year 2 | Year 3 |
|---|---|---|---|
| Revenue | 30,000 | 275,000 | 699,500 |
| Gross profit (GM) | 21,000 (70%) | 199,250 (72%) | 525,625 (75%) |
| Operating expenses | 658,485 | 1,064,645 | 1,305,096 |
| **EBITDA** | **−637,485** | **−865,395** | **−779,471** |
| Cumulative cash need | −637,485 | −1,502,880 | **−2,282,351** |
| Headcount (year end) | 8 | 10 | 10 |

**Moderate**

| TND | Year 1 | Year 2 | Year 3 |
|---|---|---|---|
| Revenue | 66,000 | 1,027,000 | 2,844,000 |
| Gross profit (GM) | 46,500 (70%) | 738,167 (72%) | 2,111,333 (74%) |
| Operating expenses | 1,995,575 | 3,178,100 | 4,599,282 |
| **EBITDA** | **−1,949,075** | **−2,439,933** | **−2,487,949** |
| Cumulative cash need | −1,949,075 | −4,389,008 | **−6,876,957** |
| Headcount (year end) | 17 | 25 | 29 |

**Enterprise**

| TND | Year 1 | Year 2 | Year 3 |
|---|---|---|---|
| Revenue | 363,000 | 3,730,000 | 10,194,000 |
| Gross profit (GM) | 256,800 (71%) | 2,695,500 (72%) | 7,520,900 (74%) |
| Operating expenses | 3,689,250 | 6,599,625 | 10,112,622 |
| **EBITDA** | **−3,432,450** | **−3,904,125** | **−2,591,722** |
| Cumulative cash need | −3,432,450 | −7,336,575 | **−9,928,297** |
| Headcount (year end) | 30 | 44 | 54 |

**Revenue mix in Year 3:**

| Scenario | B2B (L1) | B2G services | Licences | Total |
|---|---|---|---|---|
| Lean | 319.5k | 280k | 100k | 699.5k |
| Moderate | 744k | 1.68M (incl. international pilot) | 417k | 2.84M |
| Enterprise | 1.87M | 6.8M (incl. 2 international deployments) | 1.53M | 10.19M |

## 15.8 Break-even analysis

**None of the scenarios reaches EBITDA break-even within 36 months.** Break-even requires the following monthly revenue at the M36 cost base and Y3 gross margin:

| Scenario | Monthly revenue needed | Modelled M36 revenue | Gap |
|---|---|---|---|
| Lean | ~145k TND | 73k | ×2.0 |
| Moderate | ~516k TND | 288k | ×1.8 |
| Enterprise | ~1.15M TND | 810k | ×1.4 |

**Interpretation:**
- GovTech companies typically reach break-even in Year 4–5 because of procurement cycles. This model is consistent with that pattern [A].
- **The Enterprise case is closest to break-even only because it assumes two international deployments.** That is its biggest risk.
- **The Lean case can approach break-even in Year 4** if it reaches ~8–10 B2B clients plus 2 licensed institutions, without adding headcount [A].

## 15.9 Sensitivities (peak cash need to M36)

| Sensitivity | Lean | Moderate | Enterprise |
|---|---|---|---|
| Base case | 2.28M | 6.88M | 9.93M |
| **No B2G or international revenue at all** (B2B only) | 2.67M (+17%) | 8.98M (+31%) | 18.30M (+84%) |
| All revenue slips by 6 months | 2.59M (+13%) | 8.12M (+18%) | 13.87M (+40%) |
| Salaries +20% | 2.67M (+17%) | 8.12M (+18%) | 12.20M (+23%) |

**Reading:**
- Enterprise is highly exposed to timing. Committing to it before B2G/L3 traction would be the most dangerous choice.
- Lean is the most robust.

## 15.10 Funding requirement and recommendation

Raise **in stages tied to evidence**, not for the full 36 months up front:

| Stage | Amount [A] | Covers | Milestones that unlock the next stage |
|---|---|---|---|
| **Pre-seed** | **1.0–1.2M TND (~US$0.34–0.40M)** | Lean plan M1–M15/18 (cumulative burn 0.87M at M15, 1.11M at M18) | MVP live (synthetic); ≥2 paid B2B pilots; ≥1 public-sector or donor LOI; legal opinions done; pen test passed |
| **Seed** | **4–6M TND (~US$1.35–2.0M)** | Moderate trajectory for ~24 months | ≥6 B2B clients; first B2G/donor contract signed; ISO 27001 certified; first authorised pilot completed |
| **Series A** | **15–25M TND (~US$5–8.4M)** | International cells, enterprise team | ≥2 institutional references; ARR ≥ 2M TND; signed international pilot |

## 15.11 Levers that improve the economics

1. **Donor-funded implementation** covering platform build-out (reduces burn, adds references).
2. **Productisation discipline:** limit custom work; sell modules; push configuration into country packs.
3. **Partners deliver, CIVORA licenses.** Train local integrators to implement, which raises margin and reach.
4. **Early L1 revenue** to fund the B2G sales cycle.
5. **Non-dilutive funding** (Section 16) for R&D components such as Derja language resources and accessibility.
