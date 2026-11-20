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
| **Validated figures** (external fact, cited) | Facts from sources, used as inputs or anchors | FX 1 USD = 2.969 TND (BCT, 5 Nov 2026) [P S84]; institution counts: 29 banks, 18 FIs incl. 7 payment institutions (official BCT report [V S165]; supersedes the "16 PSPs" press figure [P S133]); developer salary benchmarks [P S85, S86]; help-desk list prices [P S147, S148]. **No CIVORA customer, price or cost has been validated yet** |
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

**Validation check (v4, 18 Nov 2026).** The CAC implied by the model's own cost plan was computed. The allocation is:
- 100% of B2B sales roles
- 50% of solutions engineers
- 25% of customer success
- 50% of marketing and business travel

That allocated cost is divided by the B2B clients reached by M36.

| Scenario | Stated CAC [A] | Implied by the cost plan | Verdict |
|---|---|---|---|
| Lean | 15–25k TND | **≈ 17.8k TND** (4 clients) | Consistent |
| Moderate | 25–40k TND | **≈ 63k TND** (12 clients) | **Stated range too low**: sales staff start ~11 months before the first production client (Phase 13) |
| Enterprise | 40–60k TND | **≈ 64k TND** (23 clients) | Slightly above the range |

- Moderate payback at the implied CAC is about **9 months**: (63k − 21k implementation-fee margin) ÷ 4.8k monthly gross profit per client. That is still acceptable.
- The stated range is superseded by the implied figures until discovery (E-03/E-04) provides real sales-cycle data.

## 20.6 v3 — timing with full-scope phases, and sensitivity analysis (founder review)

> **18 Nov 2026:** the founder approved **overlapping independent activities** (P1-D4), formerly "mode B". The mode B rows below are the **approved baseline**. Mode A rows are kept for reference only. The v4 validation is in §20.7.

**Data:** [data/financial-model-monthly-v3.csv](data/financial-model-monthly-v3.csv).
**Same assumptions as v2**, except all *production* revenue (B2B clients, implementation fees, Government and international) shifts to the Phase 13 start under each execution mode ([roadmap-protection-matrix.md](roadmap-protection-matrix.md) §3). Design-partner fees before Phase 13 are unchanged (P1-D5).

| Scenario | First production client | Revenue Y1 / Y2 / Y3 (TND) | Peak cash need to M36 (TND) | vs v2 |
|---|---|---|---|---|
| Lean — approved (mode B) | ~M27 | 0 / 20,000 / 352,500 | **2.75M** (~US$0.93M) | +16% |
| Lean — mode A (not adopted) | ~M34 | 0 / 20,000 / 68,000 | **2.96M** (~US$1.00M) | +25% |
| **Moderate — approved (mode B)** | ~M18 | 45,000 / 484,000 / 2,190,667 | **7.77M** (~US$2.62M) | +13% |
| Moderate — mode A (not adopted) | ~M23 | 45,000 / 63,000 / 1,405,000 | **8.67M** (~US$2.92M) | +26% |
| Enterprise — approved (mode B) | ~M15 | 80,000 / 1,850,833 / 8,295,667 | **12.89M** (~US$4.34M) | +29% |
| Enterprise — mode A (not adopted) | ~M20 | 80,000 / 660,667 / 4,871,833 | **16.28M** (~US$5.48M) | +64% |

No scenario breaks even within 36 months.

**Sensitivities — Moderate, approved model (mode B) (peak cash need to M36):**

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
3. The **approved overlapping model** (mode B) saves roughly 0.9M TND (Moderate) versus mode A, without removing any phase deliverable.

**Not yet done (E-08 refresh):** re-run with discovery evidence (actual prices, buyer cycles, design-partner conversion) and with external cost quotes (E-07).

## 20.7 v4 — validation of the model, cash view and required sensitivities (18 Nov 2026)

**Data:**
- [data/financial-model-monthly-v4.csv](data/financial-model-monthly-v4.csv): base and combined downside, monthly, per scenario.
- [data/financial-sensitivities-v4.csv](data/financial-sensitivities-v4.csv): all cases.

**Baseline:** v3 under the **approved overlapping execution model** (P1-D4). **No input was changed.**

**Reproducibility and formula checks:**
- Re-running v3 regenerates the v3 CSV identically.
- The v4 base equals v3 mode B exactly for all three scenarios.
- The arithmetic identities hold in all 648 monthly rows of v2, v3 and v4:
  - EBITDA = gross profit − staff − non-staff
  - cumulative cash = running sum of EBITDA
  - gross profit ≤ revenue
- The annual revenue and peak figures quoted in §20.2–§20.6 match the CSVs.

### 20.7.1 What each figure is

| Class | Count / content |
|---|---|
| **Verified external facts** | FX rate (BCT); institution counts (BCT 2025 supervision report [V][S165]); legal deadlines and reporting obligations (BCT 2022-08 [V][S159]) |
| **Quotations received** | **None.** No hosting, audit, pen-test, legal or tooling quote has been obtained (E-07) |
| **Customer commitments** | **None.** No LOI, design-partner agreement, contract or pipeline exists (E-01, E-04) |
| **Estimates [A]** | Every cost line, salary, hiring date, price, client ramp, implementation fee, B2G contract and receivable delay |
| **Potential revenue** | All revenue lines are outputs of assumptions and are **not guaranteed** |

### 20.7.2 Validation by area

| Area | What was checked | Finding | Action |
|---|---|---|---|
| Development costs | Roster vs MVP effort | MVP incremental cost revised to **0.60–1.05M TND** (+8–14 person-weeks for FR-60–FR-66 from the verified BCT text; [13](13-mvp-scope-and-specification.md) §13.8). The roster already funds this inside full-scope phases | CTO review + 2 external quotes (E-07) |
| Staffing and hiring | 10 / 29 / 54 people by M36 | Salaries benchmarked [P][S85][S86]. **New constraint:** Law 2004-63 **Art. 22** (processor agents must be Tunisian nationals, resident, with no criminal record; counsel to confirm). May limit foreign hires with data access. Time-to-hire not modelled | Counsel opinion; recruiting plan |
| Hosting and infrastructure | Hosting lines (e.g. Moderate 6k → 25k TND/month) | Not quoted. Tunisian hosting is required in practice (Art. 50–52 transfers), which narrows the supplier pool | ≥ 2 quotes from labelled Tunisian hosts |
| Legal and compliance | Legal retainer + compliance one-offs (pen tests, ISO, ANCS audit) | Now backed by verified obligations: Decree-law 2023-17 annual audit (if in scope), INPDP filings, BCT audit rights. **Not explicitly budgeted:** trademark clearance and filings for the new name (~10–30k TND [A]); covered by contingency for now | Counsel and attorney quotes |
| Sales and procurement timelines | First production client at the Phase 13 start; B2B cycle 3–9 months [A] | Law 2016-48 **Art. 81** adds **≥ 1 month** (BCT information before signing). State-owned banks may need public tenders (unverified). Tested in "delayed institutional procurement" | E-03 |
| Pricing | Experimental tiers (P1-D9) | Tested at −30% | E-04, E-06 |
| CAC | Implied vs stated | Moderate implied ≈ 63k TND vs 25–40k stated (§20.5) | Replace with E-03 evidence |
| Revenue recognition | Model conventions | See §20.7.3. Conservative, but design-partner fees are booked in the month invoiced rather than over the trial | Accountant review |
| Cash flow | P&L-basis cumulative EBITDA | **Ignored receivable delays.** The new cash view adds 0.1–3.5M TND to the peak need (§20.7.4). VAT, withholding tax and corporate tax are still not modelled | Accountant review; E-03 payment terms |
| Funding requirements | Peak need to M36 | **Every scenario is still burning cash at M36** (peak month = 36). The M36 peak therefore **understates** total funding to break-even, which is not reached within the model horizon | Extend the model beyond M36 after discovery |
| Downside scenarios | Six stresses + combined | §20.7.5 | Refresh after E-01/E-04 |

### 20.7.3 Revenue-recognition conventions used (to confirm with a chartered accountant)

| Revenue line | Recognised | Note |
|---|---|---|
| B2B subscription and overage | Monthly, while the service is provided | — |
| Implementation fees | Over the 2 go-live months after signature | — |
| Design-partner (sandbox) fees | In the month invoiced | Should be spread over the trial; immaterial (45k TND Moderate, 80k TND Enterprise in total) |
| Government services | Straight-line over the contract duration | Milestone billing may differ from recognition |
| Licences | Ratably over 12 months | On-premises licences could be recognised earlier under some standards; ratable is the conservative choice |
| Any revenue | Only after a signed contract | No revenue is ever recognised from pipeline, LOIs or interviews |

### 20.7.4 Cash view with receivable delays [A]

Assumed collection delays:
- **2 months** for B2B subscriptions, overage and implementation (≈ 60 days)
- **4 months** for public-sector services and licences (≈ 120 days)
- **1 month** for design-partner fees

| Scenario (approved execution) | Peak need, P&L basis | **Peak need with receivable delays** | Receivables outstanding at M36 |
|---|---|---|---|
| Lean | 2.75M TND | **2.89M TND** (~US$0.97M) | 0.14M |
| Moderate | 7.77M TND | **8.68M TND** (~US$2.92M) | 0.90M |
| Enterprise | 12.89M TND | **16.38M TND** (~US$5.52M) | 3.49M |

### 20.7.5 Required sensitivities (peak need to M36, P&L basis; change vs base; peak with receivable delays)

Definitions:
- **Price −30%:** B2B subscription, overage, implementation and design-partner fees all 30% lower.
- **Delayed customer acquisition:** B2B client additions 50% slower after the first client.
- **Half the customers:** B2B clients × 0.5, rounded.
- **No government revenue:** no public-sector services or licences in Tunisia or abroad.
- **Increased development costs:** engineering and product salaries +25%, and compliance and tooling one-offs +25%.
- **Delayed institutional procurement:** every institutional contract, B2B production and public sector, starts 6 months later.
- **Combined downside:** all six stresses at once. The v3 combined case is kept for continuity.

| Case | Lean | Moderate | Enterprise |
|---|---|---|---|
| **Base (approved execution)** | 2.75M · — · 2.89M | **7.77M** · — · 8.68M | 12.89M · — · 16.38M |
| Price −30% | 2.80M · +2% · 2.92M | 8.01M · +3% · 8.87M | 13.57M · +5% · 16.94M |
| Delayed customer acquisition | 2.79M · +1% · 2.90M | 8.02M · +3% · 8.88M | 13.55M · +5% · 16.91M |
| Half the expected customers | 2.83M · +3% · 2.92M | 8.16M · +5% · 8.98M | 13.95M · +8% · 17.25M |
| No government revenue | 2.87M · +4% · 2.92M | 8.97M · +15% · 9.13M | 18.14M · +41% · 18.54M |
| Increased development costs | 3.20M · +16% · 3.34M | 9.18M · +18% · 10.08M | 15.36M · +19% · 18.85M |
| Delayed institutional procurement (+6 months) | 2.94M · +7% · 3.01M | 8.78M · +13% · 9.26M | 16.83M · +31% · 18.82M |
| v3 combined (price −30%, clients −50%, no government) | 2.97M · +8% · 2.98M | 9.48M · +22% · 9.54M | 19.56M · +52% · 19.71M |
| **Combined downside — all six** | **3.46M · +26% · 3.47M** | **11.06M · +42% · 11.08M** | **22.49M · +74% · 22.56M** |

Y3 revenue in the combined downside: Lean 0.01M, Moderate 0.13M, Enterprise 0.37M TND (base: 0.35M / 2.19M / 8.30M).

*Small differences from §20.6 (e.g. Moderate price −30%: 8.01M vs 7.93M) arise because v4 also lowers implementation and design-partner fees, which v3 did not.*

### 20.7.6 Conclusions and funding planning range (NOT committed; P1-D7 stays conditional)

1. **Cost and timing still dominate.** In Moderate, development cost +25% (+18%) and procurement delay (+13%) matter more than price −30% (+3%) or half the customers (+5%).
2. **Government revenue matters most for the larger scenarios.** Without it, Enterprise needs +41% more cash. Enterprise depends on B2G contracts that do not exist.
3. **Working capital is material.** Receivable delays add ~0.9M TND (Moderate) and ~3.5M TND (Enterprise) to the peak need.
4. **Planning range for funding to M36** runs from the base cash-view peak to the combined downside, and **excludes runway after M36**:

   | Scenario | TND | US$ |
   |---|---|---|
   | Lean | 2.9–3.5M | ~1.0–1.2M |
   | Moderate | 8.7–11.1M | ~2.9–3.7M |
   | Enterprise | 16.4–22.6M | ~5.5–7.6M |

   These are **planning ranges, not targets or commitments**. They must be re-run with discovery evidence (E-01, E-03, E-04), external quotes (E-07), counsel answers (Art. 22, Art. 81) and a horizon extended to break-even.
5. **No projected revenue in this model is guaranteed.** There are no customers, no contracts and no quotations.

**Status of E-08:** sensitivity analysis is **complete at desk level**. "Met" still requires the post-discovery refresh, so the status is **Desk evidence only (complete for v4)**.

### 20.7.7 Market-size check: can Workspace RF alone carry the company? (18 Nov 2026)

This check is derived only from existing v4 assumptions: M36 cost base, ARPU and gross margins. **No new input was introduced.**

The Tunisian market under Circular 2022-08 is **41 institutions**, of which 32 are the most relevant buyers. There are also 7 payment institutions under separate rules [V][S165].

| Scenario | M36 monthly opex | Gross profit per Workspace RF client (sub + overage) | **Clients needed to break even on Workspace RF alone** | Share of the 32 relevant institutions |
|---|---|---|---|---|
| Lean | 108,758 TND | 3,675 TND | **≈ 30** | ≈ 94% |
| Moderate | 382,867 TND | 4,800 TND | **≈ 80** | > 100% (2.5× the market) |
| Enterprise | 848,810 TND | 5,650 TND | **≈ 150** | > 100% (4.7× the market) |

**Implications (to weigh at the Day-90 gate):**
1. **Workspace RF in Tunisia cannot alone fund the Moderate or Enterprise plans,** even at 100% market share. At a realistic 25–50% share (8–16 institutions), it covers about **10–20%** of the Moderate M36 cost base.
2. Break-even needs, in combination:
   - Government revenue (Division A)
   - other regulated sectors: insurers, microfinance, telecoms, utilities (Phase 14)
   - international country packs (Phase 15)
   - higher ARPU from Enterprise licences

   This is consistent with the six-division strategy (P1-D1), but it makes the **dependence explicit**.
3. The **Lean plan is the only one whose cost base is within reach of the first product's home market.** That matters for the funding decision (P1-D7) and for P1-D3: the first product is a **wedge and a funder of the shared engine, not the business case on its own**.
4. Recorded as risk **R39** ([21](21-risks-and-regulatory-requirements.md)). This does **not** change any approved decision. It is evidence for the founder's P1-D3 and P1-D7 decisions.
