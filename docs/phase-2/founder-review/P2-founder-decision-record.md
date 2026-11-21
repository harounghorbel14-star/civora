# Phase 2 — founder decision record

| | |
|---|---|
| Date | 21 November 2026 |
| Founder instruction (verbatim) | "Look now do phase1 approved and phase 2 ready and approved and if you finish this go to start phase 3" — preceded on 20 Nov 2026 by "Yes kol chyy mrgl w zada mwaf9 ADR" ("yes, everything is fine, and I also approve the ADRs") |
| Recorded by | Claude, on that instruction. The founder can change any line below; changes are recorded here with their date |

## 1. Decisions

| ID | Decision | Founder decision | Detail |
|---|---|---|---|
| **P2-D1** | The 30 ADRs | **Approved as recommended** in the [ADR final review register](P2-adr-final-review-register.md) | 24 accepted; 6 accepted **with conditions**: ADR-003, 008, 012, 027, 029, 030 (register §3). Recorded per ADR in the [decision form](P2-D1-decision-form.csv) and each ADR's status line |
| **P2-ACC** | Acceptance of Phase 2 — Technical Architecture | **Approved by the founder** | Phase 2 is closed as a phase. The acceptance criteria that are **not met** are not waived silently. They are carried forward as named gates (§2) |
| P1-D12 | Phase 1 approval | **Approved** (recorded in [Phase 1 doc 23](../../phase-1/23-founder-approval-decisions.md) §23.6) | Phase 1 validation evidence still open stays tracked in the [validation evidence register](../../phase-1/validation-evidence-register.md) |
| P3-D0 | Start Phase 3 — Authentication and Citizen Profiles | **Started** on the founder's instruction | [Phase 3 start record](../../phase-3/00-phase-3-start-and-specification-audit.md) |

## 2. Acceptance criteria: what the approval covers, and what stays open

The founder approved the phase. The evidence is unchanged: two original criteria are still not met. They are carried forward, not reported as met.

| Criterion | Status at approval | Carried forward as | Recommended gate |
|---|---|---|---|
| O-AC1 Staging cell reproducible from IaC in < 2 h | **Not met.** No hosting provider; the IaC and a 169 s staging-shaped rehearsal exist (R30) | Carried-forward item **CF-1**: choose a provider (P2-D4), then perform and time the staging rebuild | Before any Phase 3 work needs staging, at the latest before the Phase 11 MVP gate and Phase 13 pilot |
| O-AC2 All ADRs approved | **Met** (P2-D1, 21 Nov 2026) | — | — |
| O-AC3 Threat model reviewed by an external adviser | **Not met.** No adviser engaged; the [security review package](P2-security-review-package.md) is ready | Carried-forward item **CF-2**: engage the adviser (P2-D3) | As early as possible; at the latest before the Phase 13 pilot. Phase 3's own criterion is an **internal** security review, which does not replace it |
| O-SEC4 Branch protection | Not applied | **CF-3**: apply the GitHub settings (P2-D5) | As soon as possible |
| O-SEC5 Two-reviewer rule | One engineer | **CF-4**: P2-D2 arrangement (external reviewer for sensitive paths) or a recorded waiver | Before Phase 3 merges to sensitive paths (`infra/`, migrations, policies, CI) |
| O-SEC2 Signed builds with the release key | Mechanics tested; key not created | **CF-5**: release-key ceremony (two people) | Before the pilot |

## 3. Still the founder's to decide or do (unchanged by this record)

- **P2-D2:** the review rule while there is one engineer.
- **P2-D3:** engage the security adviser.
- **P2-D4:** choose the hosting provider (RFQ, [doc 20](../20-hosting-provider-assessment.md)). Nothing has been purchased or signed.
- **P2-D5:** apply the GitHub settings.

These are actions, not approvals, so approving Phase 2 does not perform them.
