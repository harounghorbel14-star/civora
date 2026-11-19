# ADR-004: Country-cell deployment model; no cross-cell data flows

| | |
|---|---|
| Status | **Proposed — awaiting founder approval (acceptance criterion O-AC2)** |
| Date | 19 November 2026 |
| Origin | Phase 0 §8.12 backlog item 004 (topic unchanged) |
| Covers | R-5, D9 |
| Deciders | Founder (approval); engineering (author) |

## Context

- Personal data may not be transferred abroad without INPDP authorisation (Law 2004-63 Art. 50–52).
- Pilots and production must run on CNI or labelled Tunisian hosts (D9).

## Decision

- One **cell** per country (and per dedicated or customer-hosted deployment): its own network, databases, keys, secrets, backups and observability.
- Cells never call each other. The global layer holds only code, signed images and non-personal country packs, and cells **pull** from it.
- Cross-border support access is disabled by default; support is in-country or break-glass with customer approval.
- Optional anonymous telemetry is opt-in per cell.

## Consequences

**Positive**

- Residency by construction.
- Same model serves SaaS, dedicated and customer-hosted cells (ADR-019).

**Negative / costs**

- Each new country is a new operational unit.
- No cross-country features (none are required before Phase 15).

## Alternatives considered

| Option | Outcome |
|---|---|
| Multi-region single platform | Rejected: data residency and sovereignty |
| Per-tenant clusters only | Rejected: cost for small tenants |

## Validation

- OpenTofu cell module refuses nodes outside the cell's country (negative test).
- The country pack records the hosting rules; the synthetic pack is refused in pilot/prod.

## Revisit when

Phase 15 (second country).
