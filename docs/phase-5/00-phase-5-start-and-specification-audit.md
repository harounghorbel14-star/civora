# Phase 5 — Government Services Directory: start record and specification audit

| | |
|---|---|
| Started | **27 November 2026**, decision **P5-D0**: the founder's instruction "kamel phase 3 w 4 w 5" (finish Phases 3, 4 and 5) |
| Dependencies | "P2; content team; source permissions (X-04/X-06 in Section 12)" (Phase 0 §19). **P2** done. **Content team**: none yet (founder). **X-04** (Dalil procedures content, Presidency of Government): *authorisation required*; until then the Phase 0 matrix allows **manual curation from public pages**. **X-06** (open data portal): not started |
| Roadmap | The 15 phases are unchanged (canonical order 0 → 15). Phase 5 keeps its full original scope, deliverables and acceptance criteria (P1-D4). Phase 4's renewal deep-links (P4-F6) point at this catalogue's service pages |
| Data | Procedures are public information. Each published fact carries a citation to an official source (a legal text in the official journal, or an official government page), with the date it was last verified. Nothing is published without a source, and no source is invented |
| Status | **In progress** — weeks 1–2 built on 27 Nov 2026: catalogue schema, editorial workflow with four-eyes approval and signed versions, read API, search with Arabic normalisation, error reports ([01](01-catalogue-and-editorial-workflow.md)). Next: public pages (week 3), then curation of the procedures |

## 1. Original Phase 5 specification (Phase 0 §19, word for word)

| ID | Original text |
|---|---|
| P5-OBJ | Objectives: the authoritative-sourced service catalogue that powers Guide, Workspace and Citizen app. |
| P5-D1 | Deliverable: catalogue data model |
| P5-D2 | Deliverable: editorial back office with four-eyes approval |
| P5-D3 | Deliverable: public catalogue pages (SEO) |
| P5-D4 | Deliverable: search |
| P5-D5 | Deliverable: ≥ 60 Tunisian procedures curated with citations |
| P5-A1 | Architecture: `pg-public` cluster |
| P5-A2 | Architecture: static generation for public pages |
| P5-A3 | Architecture: search (Postgres FTS + Arabic normalisation; OpenSearch later) |
| P5-F1 | Features: service pages (steps, documents, fees, offices, hours, sources, last verified) |
| P5-F2 | Features: office locator |
| P5-F3 | Features: change history |
| P5-F4 | Features: "report an error" |
| P5-DB1 | Database: `catalogue.service` |
| P5-DB2 | Database: `catalogue.service_version` |
| P5-DB3 | Database: `catalogue.requirement` |
| P5-DB4 | Database: `catalogue.source_ref` |
| P5-DB5 | Database: `catalogue.office` |
| P5-DB6 | Database: `catalogue.editorial_review` |
| P5-API1 | `GET /v1/services`, `GET /v1/services/{code}`, `GET /v1/services/{code}/versions/{v}` |
| P5-API2 | `GET /v1/offices` |
| P5-API3 | `POST /v1/admin/services`, `PUT /v1/admin/services/{id}/versions/{v}`, `POST /v1/admin/services/{id}/versions/{v}:approve` |
| P5-API4 | `POST /v1/feedback/content-errors` |
| P5-DEP | Dependencies: P2; content team; source permissions (X-04/X-06 in Section 12) |
| P5-SEC1 | Security: editorial RBAC |
| P5-SEC2 | Security: signed content versions |
| P5-SEC3 | Security: integrity monitoring |
| P5-T1 | Testing: content QA checklist |
| P5-T2 | Testing: link checking |
| P5-T3 | Testing: accessibility |
| P5-T4 | Testing: translation review by native legal-language editors |
| **P5-AC1** | **Acceptance: 60 procedures published with 100% citation coverage** |
| **P5-AC2** | **Acceptance: median "last verified" age < 90 days** |
| P5-TIME | Time: 5 weeks (+ continuous curation) |
| P5-RISK | Risks: content accuracy and staleness (mitigate: verification cadence, error reports) |
| P5-BUD | Budget: 80–120k TND (+ ongoing content ~4–8k TND/month [A]) |

## 2. Inherited decisions and constraints

| Source | What it requires of Phase 5 |
|---|---|
| ADR-001 | A bounded context of its own: the `catalogue` module (already a placeholder) and schema |
| ADR-003, P5-A1 | The catalogue is public data on the `pg-public` cluster (dev cell: `pg-public` service), apart from personal data |
| ADR-011, ADR-018 | No personal data in the catalogue; error reports keep no more than what is needed to answer them |
| Phase 3 | Editors and approvers are staff of the cell's operator (staff realm, roles); step-up before approval |
| Phase 4 | Renewal links: `/<lang>/services/<slug>` must resolve to the service page (doc phase-4/06) |
| X-04 | Until the Presidency of Government licenses the Dalil content, procedures are curated by hand from **public official pages and legal texts**, each fact cited; no bulk copying |

## 3. Open questions that Phase 5 must not assume away

| # | Question | Owner | Until answered |
|---|---|---|---|
| Q5-1 | Content team: who curates, who approves (four-eyes), who reviews translations as native legal-language editors (P5-T4) | Founder | Engineering curates with citations; approval and translation review are recorded as **pending human review**; nothing is marked reviewed that was not |
| Q5-2 | X-04 licence for the Dalil content | Founder / Presidency of Government | Manual curation from public pages, facts cited, no bulk reuse |
| Q5-3 | Which offices (P5-F2) to list and from which official source | Founder | Offices only where an official page lists them, cited |

## 4. Plan (5 weeks)

| Week | Work | Proves |
|---|---|---|
| 1 | Catalogue schema (DB1–DB6) on `pg-public` with versions, citations, reviews; signed versions (SEC2); read API (API1, API2) | database tests; signatures verified |
| 2 | Editorial back office API with four-eyes approval and RBAC (D2, API3, SEC1); change history (F3); "report an error" (F4, API4) | approval cannot be done by the author; history kept |
| 3 | Public pages with static generation (D3, A2) in ar/fr/en; search with Arabic normalisation (D4, A3); office locator (F2) | accessibility checks; search tests in Arabic and French |
| 4–5 | Curation of ≥ 60 procedures with citations (D5); link checking (T2); content QA checklist (T1); integrity monitoring (SEC3) | AC1, AC2 |

## 5. Completion estimate (27 Nov 2026, after weeks 1–2)

Each of the 31 work items of §1 (objective, dependency, time, budget and risk lines excluded) scored by what is built
**and tested**: 0, 25, 50, 75 or 100 %. **Phase 5: about 62 %** (19.25 of 31), counted the same way as Phases 3 and 4.
The count flatters the phase: **neither acceptance criterion is met**, and its main deliverable is not started — no
procedure has been curated yet (AC1 needs 60 with 100 % citation coverage; AC2 a median last-verified age under
90 days). An engineering estimate, not an acceptance decision.

| Item | Done | What is missing |
|---|---|---|
| D1 data model | 100% | — |
| D2 editorial back office, four-eyes | 75% | API and rules done; the editors' screens (with the Workspace, Phase 6, or a minimal page) |
| D3 public pages (SEO) | 0% | week 3 |
| D4 search | 75% | API with Arabic normalisation done; the search page (week 3) |
| D5 ≥ 60 procedures with citations | 0% | weeks 4–5; needs official sources read one by one (X-04) and the content team for approval (Q5-1) |
| A1 pg-public | 50% | own schema, migrations and connection; dev-cell and Kubernetes wiring next |
| A2 static generation | 0% | week 3 |
| A3 FTS + Arabic normalisation | 100% | — |
| F1 service pages | 50% | the page's data and API; the page itself week 3 |
| F2 office locator | 50% | data and API; the page and map week 3 |
| F3 change history | 100% | — |
| F4 report an error | 75% | API; the handling screen for editors |
| DB1–DB6 | 100% each | — |
| API1–API4 | 100% each | — |
| SEC1 editorial RBAC | 100% | — |
| SEC2 signed content versions | 100% | — |
| SEC3 integrity monitoring | 50% | anyone can check a page; the scheduled monitor that checks every page is week 4 |
| T1 content QA checklist | 0% | week 4 |
| T2 link checking | 0% | week 4 |
| T3 accessibility | 0% | week 3 (pages) |
| T4 translation review | 0% | needs native legal-language editors (Q5-1); the field records `pending` until then |
| AC1, AC2 | 0% | curation |
