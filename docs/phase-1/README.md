# CIVORA — Phase 1: Product Strategy, Market Validation, Product Architecture & UX/UI

| | |
|---|---|
| **Version** | 2.0, updated to the founder's *Master Project Directive — Phase 1* (18 Nov 2026) |
| **Previous version** | 1.0 (same day). All content preserved and restructured; see [change-record.md](change-record.md) |
| **Status** | **Awaiting founder approval.** Phase 2 and all coding are on hold until approval |
| **Roadmap** | Original 15-phase roadmap unchanged and in original order (Phase 0 D8 re-sequencing superseded) |
| **Evidence labels** | [V] verified · [P] press/secondary · [A] assumption · [U] unverified (as in Phase 0). Sources: [sources.md](sources.md) (S120–S153) + [Phase 0 sources](../phase-0/sources.md) (S1–S119) |

## Required deliverables (directive §12)

| # | Deliverable | File |
|---|---|---|
| 1 | Executive Summary | [01-executive-summary.md](01-executive-summary.md) |
| 2 | Updated CIVORA Company Strategy | [02-company-strategy.md](02-company-strategy.md) |
| 3 | Global Product Portfolio | [03-global-product-portfolio.md](03-global-product-portfolio.md) |
| 4 | Business Division Strategy | [04-business-division-strategy.md](04-business-division-strategy.md) |
| 5 | Government Master Service Catalog — 20 Sectors | [05-government-master-service-catalog.md](05-government-master-service-catalog.md) · data: [government-service-catalog.json](data/government-service-catalog.json) |
| 6 | Tunisia Government Service Mapping | [06-tunisia-government-service-mapping.md](06-tunisia-government-service-mapping.md) |
| 7 | Global Market Opportunity Analysis | [07-global-market-opportunity-analysis.md](07-global-market-opportunity-analysis.md) |
| 8 | Competitor Analysis | [08-competitor-analysis.md](08-competitor-analysis.md) |
| 9 | Product Opportunity Scoring Matrix | [09-opportunity-scoring-matrix.md](09-opportunity-scoring-matrix.md) · data: [opportunity-scoring.csv](data/opportunity-scoring.csv), [weights](data/opportunity-scoring-weights.json) |
| 10 | First Product Recommendation | [10-first-product-recommendation.md](10-first-product-recommendation.md) |
| 11 | Target Customer Profiles | [11-target-customer-profiles.md](11-target-customer-profiles.md) |
| 12 | Product Requirements Document | [12-product-requirements-document.md](12-product-requirements-document.md) |
| 13 | MVP Scope and Specification | [13-mvp-scope-and-specification.md](13-mvp-scope-and-specification.md) |
| 14 | User Journeys | [14-user-journeys.md](14-user-journeys.md) |
| 15 | Information Architecture | [15-information-architecture.md](15-information-architecture.md) |
| 16 | UX/UI Design Strategy (incl. wireframes, mobile & web strategy, accessibility) | [16-ux-ui-design-strategy.md](16-ux-ui-design-strategy.md) · [wireframes](../../design/wireframes/) |
| 17 | Design System Specification | [17-design-system-specification.md](17-design-system-specification.md) · [tokens](../../design/tokens/civora.tokens.json) · [contrast report](../../design/tokens/contrast-report.md) |
| 18 | Shared Platform Requirements | [18-shared-platform-requirements.md](18-shared-platform-requirements.md) |
| 19 | Commercial and Pricing Strategy | [19-commercial-and-pricing-strategy.md](19-commercial-and-pricing-strategy.md) |
| 20 | Updated Financial Assumptions | [20-updated-financial-assumptions.md](20-updated-financial-assumptions.md) · data: [financial-model-monthly-v2.csv](data/financial-model-monthly-v2.csv) |
| 21 | Risks and Regulatory Requirements | [21-risks-and-regulatory-requirements.md](21-risks-and-regulatory-requirements.md) |
| 22 | 90-Day Execution Plan | [22-90-day-execution-plan.md](22-90-day-execution-plan.md) |
| 23 | Founder Approval Decisions | [23-founder-approval-decisions.md](23-founder-approval-decisions.md) |

## Supporting materials (retained from v1.0)

| Material | File |
|---|---|
| Government product strategy (personas, JTBD, principles) | [supporting/government-product-strategy-v1.md](supporting/government-product-strategy-v1.md) |
| Government product requirements (12 epics, acceptance criteria) | [supporting/government-product-requirements.md](supporting/government-product-requirements.md) |
| Brand identity concept + naming finding (D12) | [supporting/brand-identity.md](supporting/brand-identity.md) |
| UX writing & terminology (AR/FR/EN/Derja) | [supporting/ux-writing-and-terminology.md](supporting/ux-writing-and-terminology.md) |
| User research kit (Government track + first-product discovery §8.12) | [supporting/user-research-kit.md](supporting/user-research-kit.md) |
| Citizen Data Charter v1 (EN/FR/AR) | [supporting/citizen-data-charter.md](supporting/citizen-data-charter.md) |
| Government proposal, executive presentation, pilot template, partnership one-pager | [supporting/](supporting/) |
| Clickable Government-track prototype (independent prototype, class 4) | [design/prototype/index.html](../../design/prototype/index.html) · published (private): https://claude.ai/artifact/8mSSc8wUoiG5b2bpg6QQ5Y |
| v1.0 exit checklist (superseded) | [supporting/v1-exit-checklist.md](supporting/v1-exit-checklist.md) |

## Acceptance checklist

Status of the directive §15 final acceptance criteria as of 18 Nov 2026.

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | Global company vision clearly documented | ✅ Met | [02](02-company-strategy.md) |
| 2 | All six business divisions defined | ✅ Met | [04](04-business-division-strategy.md) |
| 3 | The 20 government sectors included | ✅ Met | [05](05-government-master-service-catalog.md), JSON data, IA in [15](15-information-architecture.md) §15.8 |
| 4 | Tunisia's existing digital infrastructure considered | ✅ Met | [06](06-tunisia-government-service-mapping.md) (44 integration points classified) |
| 5 | Global expansion requirements defined | ✅ Met | [07](07-global-market-opportunity-analysis.md) §7.4, [05](05-government-master-service-catalog.md) §5.1, Phase 0 §13 |
| 6 | First product supported by a defensible opportunity analysis | ✅ Met (desk evidence) | [09](09-opportunity-scoring-matrix.md), [10](10-first-product-recommendation.md). **Field validation pending** (90-day plan) |
| 7 | MVP has a clear scope | ✅ Met | [13](13-mvp-scope-and-specification.md) |
| 8 | Customer profiles and user journeys exist | ✅ Met (hypotheses) | [11](11-target-customer-profiles.md), [14](14-user-journeys.md) |
| 9 | UX/UI requirements documented | ✅ Met | [16](16-ux-ui-design-strategy.md), [17](17-design-system-specification.md), 6 wireframes |
| 10 | Financial assumptions reviewed | ✅ Met | [20](20-updated-financial-assumptions.md) |
| 11 | Legal and regulatory risks identified | ✅ Met | [21](21-risks-and-regulatory-requirements.md) (+ Phase 0 §11, §17) |
| 12 | All required documents created and linked | ✅ Met | This index |
| 13 | Original 15-phase roadmap intact | ✅ Met | Phase 0 D8 superseded; Phase 0 §19.1 annotated; phases mapped in [10](10-first-product-recommendation.md) §10.5 and [13](13-mvp-scope-and-specification.md) §13.5 |
| 14 | All major decisions requiring founder approval listed | ✅ Met | [23](23-founder-approval-decisions.md) |

### Validation items still open (cannot be completed at a desk)

| Item | Owner | Plan |
|---|---|---|
| Discovery with ≥ 15 financial institutions; ≥ 2 design-partner agreements | Founder | [22](22-90-day-execution-plan.md) |
| Official BCT 2022-08 text; counsel answers Q1–Q18 | Founder + counsel | [22](22-90-day-execution-plan.md) |
| Government-track user research (≥ 30 citizens, ≥ 10 civil servants) and usability tests | Founder/team | [supporting/user-research-kit.md](supporting/user-research-kit.md) |
| Brand decision D12 and trademark clearance | Founder | [supporting/brand-identity.md](supporting/brand-identity.md) |
| Native AR/FR legal-language review | Founder | — |
| Citizen Data Charter review by counsel and civil society | Founder | — |
