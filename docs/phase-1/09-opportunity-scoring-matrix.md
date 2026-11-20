# 9. Product Opportunity Scoring Matrix

**Data:**
- [data/opportunity-scoring.csv](data/opportunity-scoring.csv)
- [data/opportunity-scoring-weights.json](data/opportunity-scoring-weights.json)

## 9.1 Method

- **12 opportunities across all six divisions**, including the deliberately weak "national super-app" as a control.
- Each is scored **1–5** on **15 criteria**: the directive's 14, plus *shared-platform leverage*. Every criterion is oriented so that **5 = better for CIVORA** (e.g. 5 = short sales cycle, low technical difficulty, weak competition).
- **Weighted score = Σ(weight × score) / 5**, on a 0–100 scale.
- **Weights were fixed before scoring.** Two alternative weightings test robustness:
  - **Speed-first:** cash-flow and time-to-revenue heavy.
  - **Mission-first:** long-term revenue, internationalisation, defensibility and platform leverage heavy.
- **Scores are team judgements [A]** informed by the evidence cited in the rationale table. They must be re-scored after the 90-day discovery programme.

| Key | Criterion | Base weight | Speed-first | Mission-first |
|---|---|---|---|---|
| mkt | Market size (serviceable, Tunisia + near markets) | 6 | 4 | 8 |
| dem | Customer demand (evidence of active buying) | 8 | 8 | 7 |
| prob | Customer problem severity | 7 | 6 | 8 |
| comp | Competitor intensity (5 = weak competition) | 5 | 5 | 4 |
| alt | Existing alternatives (5 = poor alternatives) | 4 | 4 | 3 |
| wtp | Willingness to pay | 9 | 10 | 6 |
| cyc | Sales cycle (5 = short) | 7 | 10 | 4 |
| reg | Regulatory feasibility (5 = few barriers) | 9 | 9 | 8 |
| tech | Technical difficulty (5 = low difficulty) | 5 | 5 | 4 |
| cost | MVP cost (5 = low cost) | 4 | 5 | 3 |
| time | Time to first paying customer (5 = fast) | 9 | 12 | 5 |
| rev | Revenue potential (3-5 yrs, recurring) | 8 | 5 | 12 |
| intl | International scalability | 7 | 5 | 10 |
| adv | Competitive advantage / defensibility | 8 | 8 | 10 |
| lev | Shared-platform leverage (reuse across divisions) | 4 | 4 | 8 |


## 9.2 Results

| Rank | ID | Opportunity | mkt | dem | prob | comp | alt | wtp | cyc | reg | tech | cost | time | rev | intl | adv | lev | **Score** | Speed-weighted | Mission-weighted |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | B1 | Regulated complaints & case management for financial institutions (BCT 2022-08) | 3 | 3 | 3 | 2 | 2 | 4 | 3 | 4 | 4 | 4 | 3 | 3 | 4 | 3 | 5 | **66.6** | 66.6 (#1) | 68.0 (#1) |
| 2 | E2 | Arabic/French intelligent document processing | 3 | 3 | 4 | 3 | 3 | 3 | 3 | 3 | 2 | 2 | 3 | 3 | 4 | 3 | 5 | **62.6** | 61.8 (#2) | 65.4 (#3) |
| 3 | E1 | Multilingual AI customer-service assistant for regulated enterprises | 3 | 4 | 3 | 2 | 2 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 4 | 2 | 4 | **60.4** | 60.0 (#3) | 61.6 (#4) |
| 4 | A2 | Public-service case & appointment management (Workspace for institutions) | 3 | 3 | 4 | 3 | 3 | 2 | 1 | 3 | 4 | 4 | 1 | 4 | 4 | 3 | 5 | **59.6** | 56.0 (#7) | 65.8 (#2) |
| 5 | D1 | e-KYC & e-signature onboarding orchestration | 2 | 4 | 4 | 2 | 2 | 3 | 3 | 3 | 2 | 3 | 3 | 3 | 3 | 2 | 5 | **59.0** | 59.2 (#4) | 60.4 (#5) |
| 6 | D2 | Verifiable diplomas & credentials | 2 | 2 | 3 | 3 | 3 | 2 | 3 | 4 | 3 | 4 | 3 | 2 | 4 | 3 | 4 | **58.6** | 59.2 (#5) | 59.2 (#7) |
| 7 | A3 | AI procedures assistant for institutions (Guide) | 2 | 2 | 4 | 2 | 3 | 2 | 2 | 4 | 3 | 4 | 2 | 2 | 4 | 4 | 4 | **57.4** | 56.6 (#6) | 60.2 (#6) |
| 8 | C1 | Private clinic & practice management | 3 | 3 | 3 | 2 | 2 | 3 | 4 | 2 | 3 | 3 | 3 | 2 | 3 | 2 | 3 | **54.6** | 55.8 (#8) | 53.4 (#8) |
| 9 | B2 | General ERP / HR / CRM suite for SMEs | 4 | 3 | 2 | 1 | 1 | 2 | 3 | 5 | 1 | 1 | 2 | 3 | 3 | 1 | 2 | **48.6** | 47.2 (#10) | 49.8 (#10) |
| 10 | F1 | Integration / API platform & interoperability adapters | 2 | 2 | 3 | 2 | 2 | 2 | 2 | 3 | 2 | 3 | 2 | 2 | 3 | 2 | 5 | **47.8** | 47.4 (#9) | 50.6 (#9) |
| 11 | C2 | Public hospital information system / EHR | 4 | 2 | 4 | 2 | 2 | 2 | 1 | 1 | 1 | 1 | 1 | 4 | 3 | 1 | 3 | **42.2** | 38.0 (#11) | 48.0 (#11) |
| 12 | A1 | National citizen super-app (Tunisia) | 2 | 1 | 3 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 2 | 2 | 1 | 3 | **28.6** | 26.8 (#12) | 32.4 (#12) |


### Robustness

- **B1 ranks #1 under all three weightings.** Its lead over #2 (Arabic/French document processing, E2) is **4.0 points** on the base weighting. That is meaningful but not decisive, which is why the 90-day plan includes discovery for both B1 and E2.
- **A2** (Government Workspace) rises to **#2 under mission-first weights** but falls to **#7 under speed-first.** It is a great long-term product with slow cash. Because it shares B1's engine, sequencing B1 first captures both.
- **A1** (national super-app) is last under every weighting.

## 9.3 Score rationale (key evidence per opportunity)

| ID | Main drivers up | Main drivers down | Evidence |
|---|---|---|---|
| **B1** Regulated complaints & case management | Regulatory requirement for a dedicated IT system; motivated decisions; mediator/BCT liaison; bank budgets; low tech risk; same engine as Government | Horizontal SaaS incumbents; some banks already equipped; Tunisian market moderate | BCT 2022-08 [P][S141][S142] (official text verified 18 Nov 2026 [V][S159]); 29 banks + 18 FIs [P][S132] (confirmed [V][S165]); 16 PSPs [P][S133] (superseded: 7 payment institutions, outside 2022-08 [V][S165]); Zendesk/Freshdesk pricing [P][S147][S148]. *Scores not changed. The verification strengthens "regulatory requirement" but narrows the addressable market and raises incumbent risk; re-score with discovery evidence (E-01)* |
| **E2** Arabic/French document processing | Paper-heavy back offices; cross-division leverage; niche (Arabic + French, mixed scripts) | Hard to reach high accuracy; MVP cost; belongs to Phase 10 under roadmap | Phase 0 §3.4 pain points; [A] |
| **E1** Multilingual AI assistant (enterprise) | AI demand; Derja niche | Many local entrants; banks already have chatbots | [P][S143][S144][S145][S146] |
| **A2** Government Workspace | Back-office pain; large contracts; donor programmes; leverage | 6–24-month cycles; low willingness to pay; state in-house builds | Phase 0 §3.3–3.4; [P][S24] |
| **D1** e-KYC orchestration | Regulatory pull (BCT 2025-06, 2026-10) | Local incumbents live; global price pressure; liveness tech hard | [P][S135][S136][S137] |
| **D2** Verifiable credentials | Commercial path with private universities | Unproven demand | [A] |
| **A3** AI Guide | Public data; language advantage | State building own assistants; who pays? | [P][S127] |
| **C1** Clinic management | Short SMB cycles | Health-data authorisation; low ARPU; fragmented | [P][S151][S153] |
| **B2** ERP/HR/CRM suite | Big market | Saturated; huge scope; no advantage | [A] |
| **F1** Integration platform | Platform leverage | National backbone exists; low standalone demand | Phase 0 S22–S23 |
| **C2** Public hospital EHR | Large contracts | National MoH programme; highest regulatory barrier; long cycles | Phase 0 S67–S69 |
| **A1** National super-app | — | Khadamet / e-Bawaba exist; legal and trust barriers | Phase 0 S18–S21 |

## 9.4 What would change the ranking

| If discovery shows… | Then… |
|---|---|
| Most banks are satisfied with existing complaint tools **and** payment providers/microfinance are too small to pay | B1 drops below E2 → re-evaluate document processing (Phase 10) or Government-first with donor funding |
| A donor programme commits to fund Workspace deployments in public institutions within 12 months | A2's time-to-revenue improves → consider dual launch (same engine) |
| A local e-KYC incumbent wants a workflow partner | Add D1 as an *integration* inside B1 (no new product) |
