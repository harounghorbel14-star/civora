# ADR-025: Environments and synthetic data

| | |
|---|---|
| Status | **Accepted** — approved by the founder on 21 Nov 2026 (decision P2-D1; [decision record](../founder-review/P2-founder-decision-record.md)) |
| Date | 19 November 2026 |
| Origin | New in Phase 2 |
| Covers | O-D7; D9; Phase 0 §10.12 |
| Deciders | Founder (approval); engineering (author) |

## Context

- Real personal data is prohibited in dev and staging (Phase 0 §10.12); D9 allows dev/staging on any cloud only with synthetic data.

## Decision

- Environments: dev, ci, staging (synthetic only); pilot and production (real data, Tunisian hosting).
- Synthetic data from `packages/synthetic-data`: deterministic (seeded), Arabic/French names, reserved ranges (CIN `99xxxxxx`, phones `+2160xxxxxxx`, e-mail `.invalid`), deadlines from rule packs.
- Guards: the synthetic pack is refused in pilot/prod; the CI fitness check rejects real-looking identifiers; the demo banner flag is on in synthetic packs.
- Production data never leaves its cell for debugging.

## Consequences

**Positive**

- Safe to develop anywhere; realistic tests.

**Negative / costs**

- Synthetic data may miss real-world edge cases (validated in authorised pilots only).

## Alternatives considered

| Option | Outcome |
|---|---|
| Masked production copies | Rejected: re-identification risk; prohibited |

## Validation

- Generator produces 3 tenants, 600 customers, 600 cases; determinism and pattern tests; prod refusal tested.

## Revisit when

Phase 13 (pilot data handling).
