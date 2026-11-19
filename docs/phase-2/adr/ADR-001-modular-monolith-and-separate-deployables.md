# ADR-001: Modular monolith with separately deployed health-bridge, guide and key service

| | |
|---|---|
| Status | **Proposed — awaiting founder approval (acceptance criterion O-AC2)** |
| Date | 19 November 2026 |
| Origin | Phase 0 §8.12 backlog item 001 (topic unchanged) |
| Covers | O-A1, O-D4 |
| Deciders | Founder (approval); engineering (author) |

## Context

- The MVP team is 6–8 engineers (Phase 0 §8.1). Microservices would add operational load without measured need.
- Health data (T0) and AI have different legal, scaling and failure boundaries (Phase 0 §8.3).
- Phase 1 §18.3 forbids a microservices split before the Phase 0 §8.11 triggers.

## Decision

- `civora-core` is one NestJS deployable with bounded contexts: identity-access, catalogue, cases, appointments, wallet, payments, notifications, consent-audit, integrations, plus platform modules (country-config, flags, health, meta, metrics).
- Rules: one schema per module; no cross-module database access; other modules are used only through `public-api.ts` or domain events.
- Separately deployed: `health-bridge` (Phase 7), `guide` (Phase 10), and a key & signing service in front of the HSM (Phase 4). Phase 2 creates their workspaces only.
- Extracting any other module needs an ADR citing a §8.11 trigger: a measured scaling need, a compliance or hosting boundary, team contention, or a different availability tier.

## Consequences

**Positive**

- One build, one image, simple operations; transactions stay local.
- Boundaries are enforced in CI, so later extraction is a move, not a rewrite.

**Negative / costs**

- A bad module can affect the whole process (memory, event loop); mitigated by limits, HPA and code review.
- Discipline is needed to keep boundaries; the fitness function catches import violations only.

## Alternatives considered

| Option | Outcome |
|---|---|
| Microservices from day one | Rejected: no measured need; team too small |
| Single unstructured monolith | Rejected: extraction later would be a rewrite |

## Validation

- Walking skeleton runs with 9 empty bounded contexts.
- `scripts/check-module-boundaries.mjs` passes and detects a planted violation (CI `build-test`).

## Revisit when

When a §8.11 trigger is measured.
