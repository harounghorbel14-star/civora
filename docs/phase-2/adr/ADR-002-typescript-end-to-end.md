# ADR-002: TypeScript end-to-end, strict mode

| | |
|---|---|
| Status | **Accepted** — approved by the founder on 21 Nov 2026 (decision P2-D1; [decision record](../founder-review/P2-founder-decision-record.md)) |
| Date | 19 November 2026 |
| Origin | Phase 0 §8.12 backlog item 002 (topic unchanged) |
| Covers | D7 |
| Deciders | Founder (approval); engineering (author) |

## Context

- One language across web (Next.js), mobile (React Native) and backend (NestJS) suits a small team and allows shared validation and i18n code (Phase 0 §8.2).
- D7 confirmed the stack for Phase 2 ADRs.

## Decision

- Node.js 22 LTS; TypeScript 5.9 with `strict` and `noUncheckedIndexedAccess`.
- NestJS 11 for services; shared libraries in `packages/*`.
- TypeScript 7 and NestJS 12 exist but are not adopted yet: legacy decorators and ecosystem readiness. Re-evaluate in Phase 3.
- CPU-heavy work (OCR, ML) goes to separate workers or vendors, not the event loop.

## Consequences

**Positive**

- Shared code (i18n, flags, packs) across apps and services, proven in Phase 2.
- Large local talent pool.

**Negative / costs**

- Single-threaded runtime: CPU-bound work must be offloaded.
- Decorator-based NestJS ties us to TypeScript's legacy decorators until NestJS moves.

## Alternatives considered

| Option | Outcome |
|---|---|
| Go or Java backend | Rejected: second language for a small team |
| TypeScript 7 now | Deferred: decorator compatibility |

## Validation

- All packages and the core build with `strict` settings; 24 tests pass.

## Revisit when

Phase 3 (TypeScript 7 / NestJS 12 readiness).
