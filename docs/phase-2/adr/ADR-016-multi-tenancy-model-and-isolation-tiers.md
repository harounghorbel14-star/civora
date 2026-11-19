# ADR-016: Multi-tenancy model and isolation tiers

| | |
|---|---|
| Status | **Proposed — awaiting founder approval (acceptance criterion O-AC2)** |
| Date | 19 November 2026 |
| Origin | New in Phase 2 |
| Covers | R-1; Phase 1 capability #3 |
| Deciders | Founder (approval); engineering (author) |

## Context

- One institution = one tenant, with isolation, per-tenant configuration and keys, and export/exit (Phase 1 §18.1).
- Banks may require physical separation (banking secrecy; outsourcing notice to the BCT).

## Decision

- Tenant = institution; organisational units inside a tenant for scoping.
- Isolation tiers: **shared** (RLS + policies + per-tenant keys), **dedicated DB**, **dedicated cell**, **customer-hosted cell** — same code for all.
- Isolation in depth: tenant from the token only → Cedar `forbid` cross-tenant → `SET LOCAL` + RLS → per-tenant field keys → audit.
- No cross-tenant analytics; support access only via break-glass.
- Tenant exit: full export with checksums, then crypto-shredding.

## Consequences

**Positive**

- One codebase serves small and large institutions.

**Negative / costs**

- Tier moves need tested export/import tooling (Phase 6/13).

## Alternatives considered

| Option | Outcome |
|---|---|
| Database per tenant always | Rejected as default: cost; offered as a tier |
| Schema per tenant | Rejected: migration fan-out, catalogue bloat |

## Validation

- Cross-tenant rules proven in the policy spike (C04, C05, C15). RLS tests start in Phase 3.

## Revisit when

First bank contract negotiation.
