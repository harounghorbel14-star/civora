# 20. Updated Financial Assumptions

> **Baseline:** Phase 0 §15 and [../phase-0/data/financial-model-monthly.csv](../phase-0/data/financial-model-monthly.csv).
>
> **Revision (v2):** [data/financial-model-monthly-v2.csv](data/financial-model-monthly-v2.csv).
>
> All figures are **assumptions [A]**, in TND excluding VAT. **Projected revenue is not guaranteed.** No contract exists.

## 20.0 Founder review (P1-D7, conditional) and classification of every figure

The revised model is a **planning baseline only**. **No funding target is committed** until customer validation (E-01, E-03, E-04) and the financial sensitivity analysis (E-08) are complete; see the [validation evidence register](validation-evidence-register.md).

| Class | What it contains | Examples in this model |
|---|---|---|
| **Validated figures** (external fact, cited) | Facts from sources, used as inputs or anchors | FX 1 USD = 2.969 TND (BCT, 5 Nov 2026) [P S84]; institution counts: 29 banks, 18 FIs, 16 PSPs [P S132, S133]; developer salary benchmarks [P S85, S86]; help-desk list prices [P S147, S148]. **No CIVORA customer, price or cost has been validated yet** |
| **Assumptions** (inputs chosen by CIVORA) | Behavioural and structural inputs | Client ramp; ARPU; implementation fees; churn; gross-margin conventions; salary loading ×1.25; 8% raises; phase durations and execution mode; design-partner fees |
| **Estimated costs** (cost inputs not yet backed by quotes) | Staff plans and overheads; compliance one-offs; MVP cost ([13](13-mvp-scope-and-specification.md) §13.8) | Hosting, audits, pen tests, legal, equipment. All [A] until quotes are obtained (E-07) |
| **Potential revenue** (outputs, never guaranteed) | Revenue lines produced by the assumptions | B2B subscriptions and overage; implementation; Government services and licences; international. **No contract, LOI or pipeline exists** |

## 20.1 What was reviewed and why some inputs changed

The directive says to update only when new evidence or revised assumptions justify it. Costs, staffing, salaries, overheads and compliance one-offs were reviewed and **left unchanged**: no new cost evidence was found. Four revenue-side assumptions changed:

| Assumption | Phase 0 | v2 | Justification |
|---|---|---|---|
| B2B product line | L1 e-KYC (subscription + per-check usage, ~55% usage margin) | **Workspace RF** (subscription + small overage) | First-product decision ([10](10-first-product-recommendation.md)); e-KYC faces local incumbents and global price pressure [P][S135][S137] |
| Timing of first production revenue | Paid pilots M8–M12; B2B clients from ~M12–M13 | **Design-partner fees only before Phase 13**; production clients from ~**M14 (Moderate)**, ~**M19 (Lean)**, ~**M11 (Enterprise)** | Original roadmap order restored (C1): production pilots occur in Phase 13 ([13](13-mvp-scope-and-specification.md) §13.5) |
| ARPU (B2B) | Lean 4.5k, Moderate 6k, Enterprise 7k TND/month | Same totals, split as subscription + overage (Lean 4k + 0.5k; Moderate 5k + 1k; Enterprise 6k + 1k) | Benchmarked against help-desk pricing [P][S147]; to validate |
| Implementation fees | Not modelled for B2B | **20k / 30k / 40k TND per new client** (Lean / Moderate / Enterprise) | Case-management deployments need configuration and training |
| B2G and international timing | As Phase 0 | Shifted later by 2–3 months | Phase 13 sequencing |

**Unchanged:**
- staffing plans (10 / 29 / 54 people by M36)
- salaries and loading (×1.25)
- overheads
- compliance one-offs
- the 8% salary increases
- gross margin conventions (external costs only; all staff in opex)

## 20.2 Results — baseline vs v2

| | Lean (P0) | **Lean v2** | Moderate (P0) | **Moderate v2** | Enterprise (P0) | **Enterprise v2** |
|---|---|---|---|---|---|---|
| Revenue Y1 | 30,000 | **0** | 66,000 | **45,000** | 363,000 | **308,667** |
| Revenue Y2 | 275,000 | **199,500** | 1,027,000 | **1,051,000** | 3,730,000 | **3,354,167** |
| Revenue Y3 | 699,500 | **661,000** | 2,844,000 | **2,825,667** | 10,194,000 | **10,448,167** |
| Gross margin Y3 | 75% | **76%** | 74% | **75%** | 74% | **74%** |
| EBITDA Y1 | −637,485 | **−658,485** | −1,949,075 | **−1,964,075** | −3,432,450 | **−3,468,683** |
| EBITDA Y2 | −865,395 | **−919,220** | −2,439,933 | **−2,417,800** | −3,904,125 | **−4,136,292** |
| EBITDA Y3 | −779,471 | **−799,946** | −2,487,949 | **−2,481,915** | −2,591,722 | **−2,352,822** |
| **Peak cash need to M36** | 2,282,351 | **2,377,651** (+4%) | 6,876,957 | **6,863,790** (≈0%) | 9,928,297 | **9,957,797** (≈0%) |
| ≈ USD | 0.77M | **0.80M** | 2.32M | **2.31M** | 3.34M | **3.35M** |
| Break-even within 36 months? | No | **No** | No | **No** | No | **No** |
| Monthly revenue needed to break even at M36 cost base | ~145k | **~142k** (×1.82 the M36 run-rate) | ~516k | **~511k** (×1.61) | ~1.15M | **~1.14M** (×1.21) |

**Year-3 revenue mix, Moderate v2:**

| Line | TND | Notes |
|---|---|---|
| Workspace subscriptions | 620k | — |
| Overage | 124k | — |
| Services | 1.76M | Implementation fees + Government services + international pilot |
| Licences | 325k | — |

## 20.3 Sensitivities (peak cash need, v2)

| Sensitivity | Lean v2 | Moderate v2 | Enterprise v2 |
|---|---|---|---|
| Base | 2.38M | 6.86M | 9.96M |
| **No Government or international revenue** (Workspace RF only, with implementation fees) | 2.67M | 8.66M | 17.36M |

**Interpretation:**
1. **The first-product switch does not materially change funding needs.** Earlier design-partner fees and implementation fees roughly offset later production revenue.
2. **Moderate remains the recommended target trajectory, reached via a Lean pre-seed** (P1-D7 confirms Phase 0 D3).
3. **Superseded by founder review:** the v2 timing assumed light passes for Phases 7–10. That approach is withdrawn (P1-D4: every phase keeps full scope). The revised timing and its cost are in §20.6.
4. Enterprise relies on international deployments for most Year-3 revenue. This is still the riskiest scenario.

## 20.4 Funding requirements (planning ranges — NOT committed; P1-D7)

Staging and milestones from Phase 0 §15.10 are kept as **planning ranges**. Amounts are re-assessed after the evidence gate. With full-scope phases (§20.6), the pre-seed must cover a longer pre-revenue period, so the upper end of the range is more likely.

| Stage | Amount | Milestones to unlock the next stage |
|---|---|---|
| Pre-seed | **1.0–1.2M TND** | Phase 1 approved; ≥ 2 design-partner agreements; Phases 2–6 delivered for the first product; pen test passed |
| Seed | **4–6M TND** | 2–3 production pilots (Phase 13) converted; ≥ 1 public-institution contract or donor commitment; ISO 27001 in progress |
| Series A | **15–25M TND** | ≥ 2M TND ARR; editions beyond banking; first international customer or signed pilot |

## 20.5 Customer acquisition cost assumptions

| Scenario | Implied CAC per B2B customer [A] | Basis |
|---|---|---|
| Lean | ~15–25k TND | Founder-led sales; part-time BD lead from M10; travel and design-partner support |
| Moderate | ~25–40k TND | Dedicated B2B sales from M7; solutions engineers from M13 |
| Enterprise | ~40–60k TND | Larger sales team; regional expansion |

These are consistent with payback of ~5–10 months at the modelled ARPU and margins ([19](19-commercial-and-pricing-strategy.md) §19.4).

## 20.6 v3 — timing with full-scope phases, and sensitivity analysis (founder review)

**Data:** [data/financial-model-monthly-v3.csv](data/financial-model-monthly-v3.csv).
**Same assumptions as v2**, except all *production* revenue (B2B clients, implementation fees, Government and international) shifts to the Phase 13 start under each execution mode ([roadmap-protection-matrix.md](roadmap-protection-matrix.md) §3). Design-partner fees before Phase 13 are unchanged (P1-D5).

| Scenario | First production client | Revenue Y1 / Y2 / Y3 (TND) | Peak cash need to M36 (TND) | vs v2 |
|---|---|---|---|---|
| Lean — mode B | ~M27 | 0 / 20,000 / 352,500 | **2.75M** (~US$0.93M) | +16% |
| Lean — mode A | ~M34 | 0 / 20,000 / 68,000 | **2.96M** (~US$1.00M) | +25% |
| **Moderate — mode B** (recommended) | ~M18 | 45,000 / 484,000 / 2,190,667 | **7.77M** (~US$2.62M) | +13% |
| Moderate — mode A | ~M23 | 45,000 / 63,000 / 1,405,000 | **8.67M** (~US$2.92M) | +26% |
| Enterprise — mode B | ~M15 | 80,000 / 1,850,833 / 8,295,667 | **12.89M** (~US$4.34M) | +29% |
| Enterprise — mode A | ~M20 | 80,000 / 660,667 / 4,871,833 | **16.28M** (~US$5.48M) | +64% |

No scenario breaks even within 36 months.

**Sensitivities — Moderate, mode B (peak cash need to M36):**

| Case | Peak (TND) | Change | Y3 revenue (TND) |
|---|---|---|---|
| Base | 7.77M | — | 2.19M |
| Price −30% | 7.93M | +2% | 2.02M |
| Price +30% | 7.61M | −2% | 2.36M |
| B2B clients −50% | 8.16M | +5% | 1.80M |
| No Government / international revenue | 8.97M | +15% | 0.77M |
| Salaries +20% | 9.01M | +16% | 2.19M |
| **Combined downside** (price −30%, clients −50%, no B2G) | **9.44M** | **+21%** | 0.30M |

**What the sensitivities say:**
1. Within 36 months, **cost and timing drive funding need far more than price or B2B volume**. The roadmap's full scope and the team size dominate.
2. B2B price and volume matter for **break-even after M36** and for valuation. That is why E-04/E-06 (willingness to pay) must be met before committing funding.
3. Choosing **mode B** saves roughly 0.9M TND (Moderate) versus mode A, without removing any phase deliverable.

**Not yet done (E-08 refresh):** re-run with discovery evidence (actual prices, buyer cycles, design-partner conversion) and with external cost quotes (E-07).
