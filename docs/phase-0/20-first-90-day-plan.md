# 20. First 90-Day Execution Plan

> **Updated by Phase 1 v2.0:** the engineering stream below (Phase 2 ADRs, CI, skeleton) must **not** start before founder approval of Phase 1 (directive §14). The current plan is [../phase-1/22-90-day-execution-plan.md](../phase-1/22-90-day-execution-plan.md).

**Day 0 = founder approval of Phase 0** (decisions D1–D10 in Section 21). Production code begins only after approval and is limited to Phase 2 scaffolding in this window. The 90 days are about **validation, foundations and funding**.

## 20.1 Objectives for Day 90

1. **Validate the repositioning** with the people who would buy, regulate or partner.
2. **Secure legal clarity** on the questions that shape architecture and go-to-market (Section 11.10).
3. **Produce Phase 1 outputs:** research-backed journeys, design system v0, clickable prototype, proposal documents.
4. **Lay technical foundations:** Phase 2 ADRs, threat model, skeleton, CI/CD.
5. **Open the funding and pipeline:** pre-seed process started; first LOIs/paid-pilot commitments.

## 20.2 Workstreams and week-by-week plan

| Week | Company & legal | Discovery & partnerships | Product & UX (P1) | Engineering (P2) | Funding & team |
|---|---|---|---|---|---|
| **1** | Record decisions; engage Tunisian counsel (Q1–Q12); trademark clearance search ("CIVORA") | Build stakeholder CRM from Section 5.2; draft interview guides (citizens, officers, B2B, institutions) | Research plan; recruit participants across ≥ 4 governorates, elderly, diaspora, disability | Hiring/contracting CTO-level lead if not in place; tooling accounts (no personal data) | Pre-seed materials outline; ESOP & pay policy draft |
| **2** | Incorporation path chosen (SA/SARL) + Startup Act label preparation | Outreach: 15 B2B targets (banks, payment institutions, telcos, insurers, universities) | Citizen interviews start (target 30) | ADR drafting (001–005) | Angel/diaspora list; accelerator applications |
| **3** | Company incorporation filed [A — timeline per accountant] | B2B discovery meetings (target 10 by W6); ANCE/TunTrust and La Poste intro meetings | Civil-servant interviews (target 10) | Threat model v0; data classification | First investor conversations (informal) |
| **4** | Draft Citizen Data Charter v0 | Donor meetings: World Bank GovTech team, SECO programme, EU delegation, GIZ (target 4) | Synthesis sprint #1; journey maps v1 | ADRs 006–010; repo + CI skeleton; IaC for dev cell | Hiring: senior full-stack, designer |
| **5** | Security & privacy policies v0 (ISMS scope) | Prime-contractor/integrator meetings (target 3) | Design system tokens & RTL components v0 | Synthetic data generator (TN pack v0) | — |
| **6** | Counsel interim memo (Q1–Q6 priority) | Prepare demo storyboard for public-sector meetings | Clickable prototype v1 (Guide + Workspace + citizen tracking) | Keycloak spike; OPA vs Cedar spike | Pre-seed deck v1 |
| **7** | INPDP informational meeting request | MinCom (digital transformation) & Presidency reforms directorate meetings with prototype | Usability tests round 1 (n ≥ 10) | Guide corpus pipeline design; **golden-set construction begins** (≥ 500 Q) | Investor meetings begin |
| **8** | ANCS informational meeting request | Civil-society consultations on Data Charter (≥ 2 organisations) | Iteration; content model for catalogue finalised | Observability stack in staging; security gates in CI | — |
| **9** | Startup Act label application submitted [A] | Pilot proposal drafts (2 public, 2 B2B) | Usability tests round 2 (n ≥ 10, incl. ≥ 5 aged 60+) | ADRs 011–014; deploy-from-scratch test of staging cell | Hiring: AI engineer (Lean M7 → earlier if funded) |
| **10** | Counsel final memo; update Sections 11–12 | LOI negotiations; vendor shortlist for e-KYC liveness/OCR; labelled hosting quotes | Government proposal + executive presentation drafts | Golden set v1 complete; baseline evaluation of 2–3 candidate models (public content only) | Term-sheet discussions (if any) |
| **11** | Insurance quotes (professional & cyber) | Paid-pilot proposals sent (B2B) | Visual identity v1 (post trademark clearance) | Phase 3 backlog ready; definition of done incl. security & a11y | — |
| **12** | Updated financial model with real quotes | Follow-ups; partnership one-pager for donors/primes | Phase 1 report | Phase 2 exit review | — |
| **13** | **Day-90 review** with founder/advisers | Pipeline review | Hand-off to build | Go/no-go for MVP build | Funding status review |

## 20.3 Day-90 targets (KPIs)

| Area | Target |
|---|---|
| Discovery | ≥ 30 citizen interviews (≥ 6 aged 60+, ≥ 5 diaspora); ≥ 10 civil servants; ≥ 10 B2B organisations; ≥ 4 donors; ≥ 3 primes/integrators; ≥ 2 public institutions |
| Validation | Top-10 pain points with evidence; ≥ 2 public stakeholders confirm the supplier positioning is welcome (or explain why not) |
| Commercial | ≥ 2 B2B paid-pilot commitments **or** ≥ 4 qualified B2B opportunities with budget; ≥ 1 public institution or donor programme LOI/expression of interest |
| Legal | Counsel memo answering Q1–Q12; INPDP and ANCS informational contacts made; trademark cleared or alternative chosen |
| Product | Prototype SUS ≥ 70; design system v0 with RTL; proposal documents drafted |
| Engineering | ADR-001..014 approved; threat model v1; staging cell reproducible; golden set ≥ 500 Q |
| Funding | Pre-seed process active with ≥ 15 investor conversations; Startup Act label filed |
| Team | Core hires made or contracted per scenario |

## 20.4 Day-90 decision gate

| Outcome | Condition | Action |
|---|---|---|
| **Go — MVP build** | Positioning validated; legal blockers manageable; funding ≥ 9 months of Lean runway secured or committed | Start Phase 3/5/10a build (Section 19) |
| **Pivot** | Strong B2B pull but weak public-sector interest (or vice versa) | Re-weight L1/L2 focus; revise MVP scope |
| **Pause** | Legal opinions reveal blocking constraints, or no funding | Re-scope to consulting-funded Guide + Workspace for a single paying client; revisit in 3 months |

## 20.5 What will *not* happen in the first 90 days

- No processing of real citizen personal data (beyond research participants under informed consent).
- No contact with government registries for data access.
- No public launch or use of official names or logos.
- No claim of partnership with any institution before written agreement.
