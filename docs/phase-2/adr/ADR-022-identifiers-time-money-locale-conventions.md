# ADR-022: Identifiers, time, money and locale conventions

| | |
|---|---|
| Status | **Accepted** — approved by the founder on 21 Nov 2026 (decision P2-D1; [decision record](../founder-review/P2-founder-decision-record.md)) |
| Date | 19 November 2026 |
| Origin | New in Phase 2 |
| Covers | O-F3; Phase 0 §9.1, §9.6 |
| Deciders | Founder (approval); engineering (author) |

## Context

- Deadlines, amounts and identifiers must be exact and consistent across modules and countries.

## Decision

- UUIDv7 primary keys; national identifiers encrypted with a blind index, never keys or URLs.
- Time stored as UTC `timestamptz`; deadlines computed in the pack's time zone and calendar and stored with the rule-pack version.
- Money as integer minor units + ISO 4217 code (TND: 3 decimals).
- Locale codes BCP 47; Western Arabic digits (`latn`) for TN; `Accept-Language` negotiation with fallback.

## Consequences

**Positive**

- No floating-point money; no time-zone drift in deadlines.

**Negative / costs**

- Developers must use shared helpers (review rule).

## Alternatives considered

| Option | Outcome |
|---|---|
| Auto-increment ids | Rejected: enumerable, not mergeable across cells |

## Validation

- Calendar tests; locale negotiation tests; synthetic generator uses millimes-safe amounts and reserved identifiers.

## Revisit when

—
