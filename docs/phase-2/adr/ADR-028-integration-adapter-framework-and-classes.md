# ADR-028: Integration adapter framework and the six integration classes

| | |
|---|---|
| Status | **Proposed — awaiting founder approval (acceptance criterion O-AC2)** |
| Date | 19 November 2026 |
| Origin | New in Phase 2 |
| Covers | P1-D6; Phase 0 §8.7; Phase 1 capability #14 |
| Deciders | Founder (approval); engineering (author) |

## Context

- No integration is live or authorised; the integration register uses six classes (P1-D6).

## Decision

- Every external system sits behind a port (TypeScript interface) with `simulated`, `sandbox` and `production` adapters sharing one contract-test suite.
- `production` mode requires all three: register status `AUTHORIZED` with an agreement reference, the locked platform flag `integrations.production-adapters` on, and a recorded tenant activation.
- Class 3–4 integrations run simulated only; classes 5–6 have no adapters.
- UXP only through a member institution's security server; every call logs purpose, legal basis and outcome, never payloads by default.
- Resilience: timeouts, retries with jitter (idempotent only), circuit breakers, bulkheads, outbox, dead letters.

## Consequences

**Positive**

- Prevents accidental unauthorised integrations; demos stay honest.

**Negative / costs**

- Simulators must be maintained alongside real adapters.

## Alternatives considered

| Option | Outcome |
|---|---|
| Direct client libraries in modules | Rejected: no gate, no testability |

## Validation

- Locked production-adapters flag cannot be overridden by tenants (unit test).

## Revisit when

Phase 12.
