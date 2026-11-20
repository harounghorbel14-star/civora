# 1. Executive Summary — Phase 1 (v2.2)

> **Phase 1 completion and validation mission, 18 Nov 2026.**
> - **Decisions recorded:** P1-D4 approved (overlapping independent activities, all dependencies, order, full scope, deliverables and approval gates preserved). P1-D13 approved as an evaluation (KELORA, TELORA, NASAQ; no final name selected).
> - **Primary sources obtained:** the official BCT Circular 2022-08, the payment-institution Circulars 2026-10 and 2020-11, Laws 2004-63 and 2016-48, Decree-law 2023-17, and the BCT 2025 supervision and 2024 mediation reports.
> - **Material corrections:**
>   1. **Payment institutions are outside Circular 2022-08.** They have their own rules.
>   2. The "23.5% over deadline" figure measured **mediators**, not banks, and is withdrawn.
>   3. The compliance deadline was **2023**, so most banks likely already have a tool. The sale is a **replacement**, still to be validated.
>   4. Receivable delays raise the Moderate peak need to **8.68M TND**.
> - **Readiness: NOT READY — VALIDATION ITEMS REMAINING** ([readiness report](phase-1-readiness-report.md)). Phase 2 and coding remain on hold.

> **Founder review, 18 Nov 2026.** The direction is accepted in principle.
> - **Approved:** P1-D1, D2, D5, D6, D8, D10 (with boundaries), D11 (in principle).
> - **Conditional:** P1-D3 (first product), D4 (roadmap: full scope for every phase; **approved later the same day**, see above), D7 (financials: no funding commitment yet), D9 (pricing is experimental).
> - **Phase 1 approval (P1-D12) is pending** until the evidence in [validation-evidence-register.md](validation-evidence-register.md) is documented.
> - **Phase 2 and coding are on hold.**
>
> **What changed in v2.1:**
> 1. The "light pass" idea is withdrawn ([roadmap-protection-matrix.md](roadmap-protection-matrix.md)).
> 2. A realistic MVP cost estimate has been added: 0.58–1.01M TND incremental [A] ([13](13-mvp-scope-and-specification.md) §13.8). *Revised to 0.60–1.05M TND in v2.2.*
> 3. Financials are re-run with full-scope phases. Moderate peak cash need is 7.77M TND under the overlapping model (mode B, approved later as P1-D4) and 8.67M TND if strictly sequential, and is not committed ([20](20-updated-financial-assumptions.md) §20.6).
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
2. **Regulatory pull, verified in the official text** [V][S159] ([verification](validation/bct-regulatory-verification.md)). BCT Circular 2022-08 (20 Oct 2022) applies to banks, leasing, factoring and investment banks, **not payment institutions**. It requires:
   - an acknowledgement with date and reference, and a written answer **within 15 working days**
   - **reasons for every rejection**
   - **a dedicated IT solution (Art. 9)** with central archiving, automatic acknowledgements, deadline alerts and KPIs
   - a correspondent to the mediator and the BCT
   - an annual board report, an internal-control chapter, an internal audit every 3 years
   - an **annual ROGS760 XML statement** to the BCT

   *Correction:* the "23.5% over deadline" figure (2020) measured the banking **mediators'** handling, not banks'. The official mediator series is 21.7% → 17.3% → 11.4% (2022–2024) [V][S166]. No public data exists on banks' own deadline performance [U]. Compliance was due in 2023, so the commercial question is **replacement of existing tools** (hypothesis H-R6, to validate).
3. **Reachable customers** (BCT 2025 supervision report [V][S165]):
   - **29 banks** (22 resident, 7 non-resident)
   - **8 leasing and 2 factoring companies, 2 investment banks**
   - **7 payment institutions** (6 at end-2025, plus Walletii by Ooredoo, 2026), under Circulars 2026-10 and 2020-11

   This is **41 institutions under 2022-08** (32 most relevant). It is a small, concentrated market: Workspace RF funds the shared engine, and the long-term scale comes from Government and other sectors. *(The earlier "16 licensed payment-service providers" press figure [P][S133] is superseded.)*
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

| Scenario | **Approved: overlapping independent activities** (formerly mode B) | Strictly sequential (formerly mode A; not adopted) |
|---|---|---|
| Lean | 2.75M TND (~US$0.93M) | 2.96M TND |
| **Moderate** | **7.77M TND (~US$2.62M)** | 8.67M TND |
| Enterprise | 12.89M TND | 16.28M TND |

- No scenario breaks even within 36 months.
- Within 36 months, funding need is driven mainly by **cost and timing**, not price or volume ([20](20-updated-financial-assumptions.md) §20.6). The combined downside case for Moderate needs 9.44M TND.
- The MVP's own incremental cost is 0.60–1.05M TND [A] (v2.1: 0.58–1.01M; raised for the verified BCT requirements; [13](13-mvp-scope-and-specification.md) §13.8).
- **Pricing is experimental** (P1-D9). The funding staging is a planning range only.
- **v4 validation (18 Nov 2026)** ([20](20-updated-financial-assumptions.md) §20.7):
  - All formulas were verified.
  - Allowing for receivable delays, the peak need is **2.89M / 8.68M / 16.38M TND** (Lean / Moderate / Enterprise).
  - The combined downside of all six required stresses is **3.46M / 11.06M / 22.49M TND**.
  - Every scenario is still burning cash at M36, so funding to break-even is higher.
  - **No quotation and no customer commitment exist.**

## 1.6 What is *not* done and cannot be done at a desk

- Customer discovery (15 institutions) and the user research for the Government track. Package ready: [fi-validation-package.md](validation/fi-validation-package.md).
- Counsel's interpretation of the verified texts (outsourcing Art. 81, processor conditions Art. 22, retention, transfers). Matrix ready: [legal-regulatory-verification-matrix.md](validation/legal-regulatory-verification-matrix.md).
- Trademark clearance of KELORA (strongest desk candidate) or another name: [company-name-evaluation.md](validation/company-name-evaluation.md).
- External quotes, and native legal-language review of Arabic and French texts.
- *Done in this mission:* the official text of BCT Circular 2022-08 was retrieved and analysed article by article.

These items are in the [90-day plan](22-90-day-execution-plan.md) and the [acceptance checklist](README.md#acceptance-checklist).

## 1.7 Decisions needed

There are 12 Phase 1 decisions, listed in [23-founder-approval-decisions.md](23-founder-approval-decisions.md). The most important:
- **P1-D1:** company positioning.
- **P1-D3:** first product.
- **P1-D4:** roadmap restoration with every phase at full scope. **Approved 18 Nov 2026 as overlapping independent activities**; this resolves P1-D4a.
- **P1-D5:** sandbox-only design-partner programme before Phase 13 (approved: synthetic or properly authorised test data).
- **P1-D13:** company name. **Approved 18 Nov 2026 as an evaluation of KELORA, TELORA and NASAQ; no final name selected.**

**Phase 2 and all coding remain on hold until the founder approves Phase 1.** *(Annotated 19 Nov 2026: Phase 2 was started by the founder's explicit decision **P2-D0** under P1-D4. Phase 1 approval (P1-D12) is still pending and Phase 1 evidence is tracked separately. See [../phase-2/00-specification-and-constraint-audit.md](../phase-2/00-specification-and-constraint-audit.md) §1.)*
