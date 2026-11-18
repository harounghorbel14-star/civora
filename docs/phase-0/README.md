# CIVORA — Phase 0: Research, Feasibility & Strategy

| | |
|---|---|
| **Document set** | Phase 0 feasibility and strategy report (20 sections + decision register) |
| **Version** | 0.1 — draft for founder review |
| **Research cut-off** | 18 November 2026 |
| **Status** | **Awaiting founder approval. No product code has been written.** |
| **Classification** | Internal — founder and advisers |

## How to read this report

Start with the [Executive Summary](01-executive-summary.md) and the [Founder Decision Register](21-founder-decisions.md). Everything else supports those two documents.

| # | Section | File |
|---|---|---|
| 1 | Executive summary | [01-executive-summary.md](01-executive-summary.md) |
| 2 | Global product vision | [02-global-product-vision.md](02-global-product-vision.md) |
| 3 | Tunisia market analysis | [03-tunisia-market-analysis.md](03-tunisia-market-analysis.md) |
| 4 | Competitor and reference-platform analysis | [04-competitor-analysis.md](04-competitor-analysis.md) |
| 5 | Government institutional ecosystem (Tunisia) | [05-government-institutional-ecosystem.md](05-government-institutional-ecosystem.md) |
| 6 | Complete product modules | [06-product-modules.md](06-product-modules.md) |
| 7 | Citizen user journeys | [07-citizen-user-journeys.md](07-citizen-user-journeys.md) |
| 8 | Technical architecture | [08-technical-architecture.md](08-technical-architecture.md) |
| 9 | Database architecture | [09-database-architecture.md](09-database-architecture.md) |
| 10 | Security architecture | [10-security-architecture.md](10-security-architecture.md) |
| 11 | Legal and regulatory analysis | [11-legal-regulatory-analysis.md](11-legal-regulatory-analysis.md) |
| 12 | Integration feasibility matrix | [12-integration-feasibility-matrix.md](12-integration-feasibility-matrix.md) |
| 13 | International expansion strategy | [13-international-expansion-strategy.md](13-international-expansion-strategy.md) |
| 14 | Business model and government partnership strategy | [14-business-model.md](14-business-model.md) |
| 15 | Financial projections | [15-financial-projections.md](15-financial-projections.md) |
| 16 | Funding strategy | [16-funding-strategy.md](16-funding-strategy.md) |
| 17 | Risk assessment | [17-risk-assessment.md](17-risk-assessment.md) |
| 18 | MVP recommendation | [18-mvp-recommendation.md](18-mvp-recommendation.md) |
| 19 | Development roadmap (Phases 0–15) | [19-development-roadmap.md](19-development-roadmap.md) |
| 20 | First 90-day execution plan | [20-first-90-day-plan.md](20-first-90-day-plan.md) |
| — | **Founder decision register (prioritised)** | [21-founder-decisions.md](21-founder-decisions.md) |
| — | Integration status register | [integration-status-register.md](integration-status-register.md) |
| — | Sources and bibliography | [sources.md](sources.md) |
| — | Monthly financial model (CSV) | [data/financial-model-monthly.csv](data/financial-model-monthly.csv) |

## Evidence labels used throughout

Every material claim carries one of these labels and, where applicable, a source ID such as `[S18]` that resolves in [sources.md](sources.md).

| Label | Meaning | How to use it |
|---|---|---|
| **[V]** Verified | Official/primary source (government site, law text, official statistics, vendor's own statement about its own contract) | Can be relied upon, subject to legal review |
| **[P]** Press-reported | Reported by reputable media or secondary analysis; no primary document retrieved | Directionally reliable; confirm with the institution before quoting externally |
| **[A]** Assumption | CIVORA team estimate or modelling input | Must be validated; never present as fact |
| **[U]** Unverified | No public evidence found either way | Treat as unknown; do not build on it |

Integration status labels (used in the [feasibility matrix](12-integration-feasibility-matrix.md) and the [status register](integration-status-register.md)): `NOT STARTED`, `SIMULATED`, `COMMERCIALLY AVAILABLE`, `AUTHORIZATION REQUIRED`, `BLOCKED`, `DO NOT PURSUE`.

**Since Phase 1 (P1-D6, approved):** every integration also carries the six-class status:
1. Verified official integration
2. Authorized partner integration
3. Technically possible but not yet authorized
4. Independent prototype
5. Future opportunity
6. Not currently feasible

## Research method and limitations

- Research was performed through web search of official portals, Tunisian and international press, multilateral (World Bank, UN) and vendor sources, current to 18 November 2026.
- Several primary documents could not be retrieved directly (e.g. the ID4Africa 2026 Tunisia country playbook, JORT texts behind portals). Where a fact comes only from a search excerpt or press report it is labelled **[P]**.
- **No legal conclusion in this report is a legal opinion.** Every regulatory point must be confirmed by licensed Tunisian counsel before action. Section 11 lists the specific questions for counsel.
- No government institution has been contacted. **CIVORA has no official relationship, endorsement, authorization, or data access with any government body.** Nothing in this document should be read or presented as implying otherwise.

## Three states CIVORA must never confuse

| State | Definition | What may be claimed |
|---|---|---|
| **Independent prototype** | Built by CIVORA with synthetic data, no access to government systems | "A prototype demonstrating how such services could work." Never use official logos or names in a way that implies endorsement. |
| **Authorized pilot** | Time-boxed deployment under a signed agreement (convention, MoU, contract) with a competent authority, with INPDP formalities completed | "A pilot conducted with [institution] under [agreement ref.]" — only the scope actually authorized. |
| **Officially deployed platform** | Operated under a procurement contract or legal mandate, hosted per national rules, audited, in production | "Operated for [institution] under contract [ref.]" |

Today CIVORA is in **none** of these states. Phase 0 is a paper exercise.
