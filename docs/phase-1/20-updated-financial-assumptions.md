# 20. Updated Financial Assumptions

> **Baseline:** Phase 0 §15 and [../phase-0/data/financial-model-monthly.csv](../phase-0/data/financial-model-monthly.csv).
>
> **Revision (v2):** [data/financial-model-monthly-v2.csv](data/financial-model-monthly-v2.csv).
>
> All figures are **assumptions [A]**, in TND excluding VAT. **Projected revenue is not guaranteed.** No contract exists.

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
3. **The strict roadmap order delays first production revenue** to ~M14 (Moderate) or ~M19 (Lean). The light-pass approach (P1-D4) is what keeps this from slipping further. If phases 7–10 were built at full Phase 0 scope before Phase 13, first production revenue would move to ~M20+ (Moderate) [A].
4. Enterprise relies on international deployments for most Year-3 revenue. This is still the riskiest scenario.

## 20.4 Funding requirements (confirmed)

Staging and milestones are unchanged from Phase 0 §15.10, with milestones adapted to the first product:

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
