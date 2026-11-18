# Phase 1 Change Record (v1.0 → v2.0)

**Trigger:** the founder issued the *Master Project Directive — Phase 1* on 18 November 2026. It redefines CIVORA as a **global technology & digital infrastructure company with six business divisions**, requires a **20-sector Government catalogue**, a **weighted cross-division opportunity analysis** and **23 deliverables**, and **protects the original 15-phase roadmap**.

## 1. Conflicts found and how they are resolved

Each conflict is surfaced here rather than silently overwritten. Resolutions marked "→ decision" need founder approval ([23-founder-approval-decisions.md](23-founder-approval-decisions.md)).

| ID | Existing document / decision | Conflict with the directive | Proposed resolution |
|---|---|---|---|
| **C1** | Phase 0 Section 19.1 and decision **D8** (approved 18 Nov) re-sequenced the roadmap: AI Guide earlier, health after payments | Directive §13: phases "must not be renamed, removed, reordered, or replaced" | **Restore the original order 0→15 as canonical.** D8 is marked *superseded*. Phase 0 Section 19 is annotated, not deleted, so the reasoning stays traceable. Phases irrelevant to the first product get a lighter first pass (documentation and synthetic prototypes only) so the path to Phase 13 is not blocked → decision **P1-D4** |
| **C2** | Phase 1 v1 exit checklist: "Phase 2 can start in parallel" | Directive §14.7: do not start Phase 2 before Phase 1 approval | Removed. Phase 2 starts only after explicit founder approval of Phase 1 |
| **C3** | Phase 0 positioning: "GovTech platform company" (Sections 1, 2) | Directive §1: global technology & digital infrastructure company, multi-division | **Broadened** in [02-company-strategy.md](02-company-strategy.md). Phase 0 analysis remains valid as the Division A (Government) and Tunisia foundation |
| **C4** | Phase 0 **D5** MVP scope (Government Guide + Workspace + citizen app prototype) and **D2** dual-track with L1 = e-KYC | Directive §7: select the first product through a weighted analysis across all divisions; "do not assume a government super-app" | Scoring ([09](09-opportunity-scoring-matrix.md)) selects **Workspace for Regulated Finance** (complaints & case management, BCT Circular 2022-08). It reuses the same Workspace engine as the Government product. e-KYC is deprioritised: local competitors exist, and the plan is to partner rather than build. D5/D2 are proposed to be superseded → decisions **P1-D3**, **P1-D8** |
| **C5** | Phase 0 Section 18 MVP included the AI Guide (Phase 10 work) | With C1 restored, AI assistant work belongs to Phase 10 | The first-product MVP contains **no Phase 10 AI features**. AI requirements are documented as future requirements ([13](13-mvp-scope-and-specification.md) §13.6) |
| **C6** | Phase 0 integration status labels (NOT STARTED, AUTHORIZATION REQUIRED…) | Directive §6 six-class scheme | **Crosswalk**, not replacement: the Phase 0 register keeps operational statuses and gains a "Directive class (1–6)" column. [06](06-tunisia-government-service-mapping.md) uses the six classes |
| **C7** | Phase 0 business lines L1/L2/L3 | Directive's six divisions | Mapped: L1 → Division D Identity (now *partner/incubate*) and Division B Enterprise (first product); L2 → Division A Government; L3 → international expansion of all divisions ([04](04-business-division-strategy.md)) |
| **C8** | Phase 1 v1 structure (14 numbered documents) | Directive requires 23 named deliverables, no duplicates | **Restructured with `git mv`** (history preserved). See Section 2 |
| **C9** | Phase 0 Section 6 Module I: no CIVORA-branded citizen super-app in Tunisia | Directive Division A lists "citizen service portals" | **Consistent.** Citizen portals remain *white-label* for institutions and for L3 countries, never a competing national app in Tunisia |

## 2. File changes

| v1.0 file | v2.0 location | Change |
|---|---|---|
| 01-product-strategy.md | [supporting/government-product-strategy-v1.md](supporting/government-product-strategy-v1.md) | Moved; retained as the Division A product strategy (personas, JTBD, principles) |
| 02-product-requirements.md | [supporting/government-product-requirements.md](supporting/government-product-requirements.md) | Moved; retained as Division A requirements for Phases 3–6 and 10 |
| 03-information-architecture.md | [15-information-architecture.md](15-information-architecture.md) | Renamed; extended with the 20-sector catalogue IA, first-product IA and per-division structures |
| 04-service-blueprints.md | [14-user-journeys.md](14-user-journeys.md) | Renamed; first-product journeys added; Government blueprints retained |
| 05-design-system.md | [17-design-system-specification.md](17-design-system-specification.md) | Renamed; enterprise components and multi-division rules added |
| 06–13 (brand, UX writing, research kit, charter, proposal pack) | [supporting/](supporting/) | Moved unchanged except relative links; the research kit gained a first-product discovery module |
| 14-phase-1-exit-checklist.md | [supporting/v1-exit-checklist.md](supporting/v1-exit-checklist.md) | Superseded by the acceptance checklist in [README.md](README.md); kept for history |
| — | 01–13, 16, 18–23, `data/*`, `../../design/wireframes/*` | **New** deliverables, structured data and wireframes |

## 3. Phase 0 documents annotated (not rewritten)

| File | Annotation |
|---|---|
| [../phase-0/19-development-roadmap.md](../phase-0/19-development-roadmap.md) | Section 19.1 re-sequencing marked *superseded by directive (C1)* |
| [../phase-0/21-founder-decisions.md](../phase-0/21-founder-decisions.md) | D2, D5, D8 status updated: superseded or proposed-superseded, pending P1 decisions |
| [../phase-0/integration-status-register.md](../phase-0/integration-status-register.md) | Directive class column added (C6) |

## 4. Material changes to numbers

| Item | v1.0 / Phase 0 | v2.0 | Why |
|---|---|---|---|
| First product | Government Guide + Workspace (prototype MVP) | Workspace for Regulated Finance | Weighted scoring + verified regulatory demand (BCT Circular 2022-08) |
| First production revenue | Lean ~M13; Moderate ~M12 | Lean ~M19; Moderate ~M14 (paid design-partner sandbox fees earlier) | Strict roadmap order (C1): production pilots occur in Phase 13 |
| Peak cash need to M36 | Lean 2.28M / Moderate 6.88M / Enterprise 9.93M TND | 2.38M / 6.86M / 9.96M TND | Re-run with revised timing, pricing and implementation fees ([20](20-updated-financial-assumptions.md)) |
