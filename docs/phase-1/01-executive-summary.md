# 1. Executive Summary — Phase 1 (v2.1)

> **Founder review, 18 Nov 2026.** The direction is accepted in principle.
> - **Approved:** P1-D1, D2, D5, D6, D8, D10 (with boundaries), D11 (in principle).
> - **Conditional:** P1-D3 (first product), D4 (roadmap: full scope for every phase), D7 (financials: no funding commitment yet), D9 (pricing is experimental).
> - **Phase 1 approval (P1-D12) is pending** until the evidence in [validation-evidence-register.md](validation-evidence-register.md) is documented.
> - **Phase 2 and coding are on hold.**
>
> **What changed in v2.1:**
> 1. The "light pass" idea is withdrawn ([roadmap-protection-matrix.md](roadmap-protection-matrix.md)).
> 2. A realistic MVP cost estimate has been added: 0.58–1.01M TND incremental [A] ([13](13-mvp-scope-and-specification.md) §13.8).
> 3. Financials are re-run with full-scope phases. Moderate peak cash need is 7.77M TND in mode B and 8.67M TND in mode A, and is not committed ([20](20-updated-financial-assumptions.md) §20.6).
> 4. The **name investigation found meaningful conflicts**. CIVORA is reportedly a registered trademark of DKSR GmbH for a municipal urban-data platform in the EU, and the Arabic spelling is Sephora's Arabic brand. Renaming is recommended (P1-D13; [supporting/brand-identity.md](supporting/brand-identity.md) §6.7).

## 1.1 What changed in this phase

The founder's Phase 1 directive repositions CIVORA as a **global technology & digital infrastructure company**. It has six business divisions (Government, Enterprise, Health, Identity, AI, Connect) on one shared platform, starting in Tunisia. This update:
- keeps the valid Phase 0 research
- restores the **original 15-phase roadmap order**
- answers the directive's central question: **what CIVORA should build first**

## 1.2 Recommendation in one paragraph

> **Build CIVORA Workspace first, launched as an edition for regulated financial institutions in Tunisia: banks, financial institutions and payment providers. It handles customer complaints and request cases under BCT Circular 2022-08. Then extend the same product to public institutions (Government sector 20: complaints, correspondence, application tracking) and to other regulated industries.**

Why this, and not a government super-app, e-KYC or AI first:

1. **Highest-ranked opportunity in all three weightings** of a 12-opportunity, 15-criterion scoring model ([09](09-opportunity-scoring-matrix.md)):
   - base 66.6
   - cash-flow-first 66.6
   - long-term-value-first 68.0

   The runner-up is Arabic/French document processing at 62.6. The margin is real but modest, which is why the 90-day plan validates it before Phase 2.
2. **Regulatory pull, verified in a primary text.** BCT Circular 2022-08 (20 Oct 2022) requires banks and financial institutions to:
   - run complaint-handling policies, as the first level before the banking mediator
   - **reason every rejection in writing**
   - **put in place a dedicated IT solution (Art. 9)**
   - appoint a correspondent to the mediator and the BCT
   - report annually to the board [P][S141][S142]

   A 2020 mediation report found **23.5% of admissible complaints exceeded regulatory deadlines** [P][S142].
3. **Reachable customers.** At end-2025 Tunisia had:
   - **29 banks** (22 resident, 7 non-resident)
   - **18 financial institutions**, including 6 payment institutions [P][S132]
   - **16 licensed payment-service providers** by March 2026 [P][S133]
4. **Faster money than Government, same engine.** B2B sales cycles are about 3–9 months, versus 6–24 months for B2G [A]. The workflow, documents, audit and notification capabilities are exactly what the Government Workspace needs. Revenue therefore funds the Government track instead of competing with it.
5. **Weak alternatives were deliberately rejected:**
   - **National super-app:** last place (28.6/100). *Khadamet* already exists.
   - **e-KYC first:** local competitors are already live under the BCT 2025 e-KYC circular [P][S135][S136], and global vendors list prices of US$0.30–1.85 per check [P][S137][S138].
   - **Public hospital EHR:** the Ministry of Health's national programme is under way, and regulatory barriers are high.

## 1.3 The company in six divisions (sequencing)

| Division | Stance (next 24 months) | First products |
|---|---|---|
| **B — Enterprise** | **Active (first revenue)** | Workspace — Regulated Finance edition |
| **A — Government** | **Active pipeline** (shared engine; pilots via Phase 13) | Workspace for institutions; citizen request tracking (white-label); 20-sector Directory |
| **D — Identity** | **Incubate / partner** | Accounts, mandates, e-signature workflows inside the platform; integrate local e-KYC vendors rather than build |
| **E — AI** | **Incubate** (Phase 10) | Document processing (scored #2) and the multilingual Guide as future modules |
| **F — Connect** | **Internal capability** | Adapters and API gateway serving other divisions; productise later |
| **C — Health** | **Defer** (Phase 7 synthetic prototype only) | Consent bridge, clinic scheduling (future) |

## 1.4 Government: 20 sectors, mapped to Tunisia

All 20 directive sectors are catalogued, from Digital Identity to Government Communication. Each entry lists subcategories, services, users, institutional responsibilities, implementation requirements and roadmap phase. Sources: [05](05-government-master-service-catalog.md) and [data/government-service-catalog.json](data/government-service-catalog.json).

The Tunisia mapping ([06](06-tunisia-government-service-mapping.md)) classifies **44 integration points** with the six-class scheme:

| Class | Count |
|---|---|
| 1 — Verified official integration | **0** |
| 2 — Authorized partner integration | **0** |
| 3 — Technically possible but not yet authorized | 14 |
| 4 — Independent prototype | 8 |
| 5 — Future opportunity | 19 |
| 6 — Not currently feasible | 3 (direct IUC register access, emergency/policing systems, electoral systems) |

**CIVORA has no official integration today.**

## 1.5 Money (assumptions, not promises — no funding commitment, P1-D7)

The Phase 0 model was re-run, not replaced ([20](20-updated-financial-assumptions.md)). Every original phase now keeps its full scope, so production pilots come in Phase 13. Peak cash need to month 36 (v3):

| Scenario | Mode B (ordered overlap, recommended) | Mode A (strictly sequential) |
|---|---|---|
| Lean | 2.75M TND (~US$0.93M) | 2.96M TND |
| **Moderate** | **7.77M TND (~US$2.62M)** | 8.67M TND |
| Enterprise | 12.89M TND | 16.28M TND |

- No scenario breaks even within 36 months.
- Within 36 months, funding need is driven mainly by **cost and timing**, not price or volume ([20](20-updated-financial-assumptions.md) §20.6). The combined downside case for Moderate needs 9.44M TND.
- The MVP's own incremental cost is 0.58–1.01M TND [A] ([13](13-mvp-scope-and-specification.md) §13.8).
- **Pricing is experimental** (P1-D9). The funding staging is a planning range only.

## 1.6 What is *not* done and cannot be done at a desk

- Customer discovery (≥ 15 financial institutions) and the user research for the Government track.
- Retrieval of the full official text of BCT Circular 2022-08, to confirm deadlines and reporting formats.
- Trademark clearance and the Arabic-name collision with Sephora (D12).
- Native legal-language review of Arabic and French texts.

These items are in the [90-day plan](22-90-day-execution-plan.md) and the [acceptance checklist](README.md#acceptance-checklist).

## 1.7 Decisions needed

There are 12 Phase 1 decisions, listed in [23-founder-approval-decisions.md](23-founder-approval-decisions.md). The most important:
- **P1-D1:** company positioning.
- **P1-D3:** first product.
- **P1-D4:** roadmap restoration with every phase at full scope (conditional; see the roadmap protection matrix), plus the execution-mode choice P1-D4a.
- **P1-D5:** sandbox-only design-partner programme before Phase 13 (approved: synthetic or properly authorised test data).
- **P1-D13:** company name (rename recommended).

**Phase 2 and all coding remain on hold until the founder approves Phase 1.**
