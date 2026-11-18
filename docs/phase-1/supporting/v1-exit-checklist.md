# 14. Phase 1 Exit Checklist

> **Superseded (v2.0):** replaced by the acceptance checklist in [README.md](../README.md). In particular, the line "Phase 2 can start in parallel" is **withdrawn**: Phase 2 starts only after founder approval of Phase 1 (directive §14, conflict C2).


Phase 1 closes when every item is **Met** or explicitly waived by the founder. Status as of 18 November 2026:

| # | Criterion (from Phase 0 roadmap, Phase 1) | Status | Evidence / what remains |
|---|---|---|---|
| 1 | Product strategy (positioning, personas, JTBD, principles, metrics, MVP scope) | ✅ Met (hypotheses) | [01-product-strategy.md](government-product-strategy-v1.md) |
| 2 | MVP requirements with testable acceptance criteria | ✅ Met | [02-product-requirements.md](government-product-requirements.md) — 12 epics |
| 3 | Information architecture and catalogue content model | ✅ Met | [03-information-architecture.md](../15-information-architecture.md) |
| 4 | Service blueprints for 5 journeys | ✅ Met (hypotheses) | [04-service-blueprints.md](../14-user-journeys.md) |
| 5 | Design system v1 (tokens, typography, RTL rules, components, accessibility) | ✅ Met | [05-design-system.md](../17-design-system-specification.md), [tokens](../../../design/tokens/civora.tokens.json) |
| 6 | Design system passes WCAG 2.2 AA contrast in both themes and directions | ✅ Met | 44/44 pairs pass ([contrast report](../../../design/tokens/contrast-report.md)); touch targets ≥ 44 px specified |
| 7 | Prototype passes automated accessibility checks | ✅ Met | axe-core 4.10 (WCAG 2.0/2.1/2.2 A+AA rules): **0 violations** across 21 page states (7 views × AR/FR/EN), 390 px viewport. Manual screen-reader testing still required |
| 8 | Clickable prototype (responsive web/mobile), AR/FR/EN with RTL | ✅ Met | [design/prototype/index.html](../../../design/prototype/index.html). Tests passed: no horizontal overflow at 390 px in any view or language, correct `dir` switching, officer↔citizen loop, PII redaction of 8-digit IDs and emails. Native mobile prototype not built (responsive web used instead) |
| 9 | UX writing guidelines & terminology (AR/FR/EN/Derja) | ✅ Met (review pending, see #16) | [07-ux-writing-and-terminology.md](ux-writing-and-terminology.md) |
| 10 | Proposal pack (government proposal, executive presentation, pilot template, partnership one-pager) | ✅ Met (drafts) | Files 10–13. The slide deck itself is not built |
| 11 | Citizen Data Charter v1 reviewed by counsel and ≥ 2 civil-society organisations | ⏳ Not met | Draft ready: [09-citizen-data-charter.md](citizen-data-charter.md) |
| 12 | Research: ≥ 30 citizens, ≥ 10 civil servants, ≥ 10 B2B interviews | ⏳ Not met — **founder/team action** | Kit ready: [08-user-research-kit.md](user-research-kit.md) |
| 13 | Two usability-test rounds, SUS ≥ 70 | ⏳ Not met — **founder/team action** | Script and SUS ready (Section 8.9–8.10) |
| 14 | Top-10 pain points evidenced | ⏳ Not met | Depends on #12 |
| 15 | Brand: trademark clearance and decision D12 (Arabic-transliteration collision with "Sephora") | ⏳ Not met — **founder decision** | [06-brand-identity.md](brand-identity.md) Section 6.1 |
| 16 | Native legal-language review of Arabic and French texts | ⏳ Not met | Glossary, disclosures, consent forms, Charter, prototype strings |

**Summary:** 10 of 16 criteria met. The 6 open items require fieldwork, external review or founder decisions. None of them can be completed by desk work.

## Can Phase 2 (technical architecture) start before Phase 1 closes?

**Yes, in parallel. This is recommended.** Phase 2 (ADRs, threat model, repository skeleton, CI/CD) does not depend on research outcomes. Research findings feed Phases 3–6, which begin after the Day-90 gate.
