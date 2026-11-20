# ADR-007: FHIR server choice — deferred to Phase 7

| | |
|---|---|
| Status | **Proposed — awaiting founder approval (acceptance criterion O-AC2)** |
| Date | 19 November 2026 |
| Origin | Phase 0 §8.12 backlog item 007 (topic unchanged) |
| Covers | R-3 (health domain boundary only) |
| Deciders | Founder (approval); engineering (author) |

## Context

- Phase 0 states the FHIR server (Medplum or HAPI FHIR) is decided in Phase 7.
- Health is a deferred division (Phase 1 §4.1); no real health data before MoH/INPDP authorisation.

## Decision

- **No FHIR server is chosen in Phase 2.** The boundary is fixed now: `services/health-bridge` is a separate deployable with its own cluster (`fhir-store`, T0), keys and network segment; core has no credentials for it.
- Phase 7 evaluates Medplum (TypeScript) and HAPI FHIR (Java) on: FHIR R4 conformance, consent and access-grant support, bridge mode (short-TTL cache), operations on Tunisian hosting, licence, and the language exception it would create (HAPI = Java, needs an ADR-002 exception).

## Consequences

**Positive**

- No premature commitment.
- Boundary and data tier are already respected by the rest of the platform.

**Negative / costs**

- Health-specific integration risk stays open until Phase 7.

## Alternatives considered

| Option | Outcome |
|---|---|
| Decide now | Rejected: Phase 0 placed it in Phase 7; no health product before then |

## Validation

- Placeholder workspace exists; threat model T-48/T-49 covers the boundary.

## Revisit when

Phase 7.
