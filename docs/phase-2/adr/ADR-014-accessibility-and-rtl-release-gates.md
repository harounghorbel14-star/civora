# ADR-014: Accessibility (WCAG 2.2 AA) and RTL as release gates

| | |
|---|---|
| Status | **Accepted** — approved by the founder on 21 Nov 2026 (decision P2-D1; [decision record](../founder-review/P2-founder-decision-record.md)) |
| Date | 19 November 2026 |
| Origin | Phase 0 §8.12 backlog item 014 (topic unchanged) |
| Covers | O-F3 |
| Deciders | Founder (approval); engineering (author) |

## Context

- Arabic is the default locale in Tunisia; users include older and low-vision people (Phase 1 personas).

## Decision

- WCAG 2.2 AA and correct RTL rendering are **release gates**: automated axe checks for every page in CI, manual keyboard and screen-reader checks for new flows, RTL snapshots.
- Shared `packages/i18n` provides locale negotiation, direction, `latn` digits, plurals; the API exposes locales with direction.
- Logical CSS properties only.

## Consequences

**Positive**

- Accessibility built in, not retrofitted.

**Negative / costs**

- Slower UI delivery; translation and review cost (Phase 1 language review, E-13).

## Alternatives considered

| Option | Outcome |
|---|---|
| Accessibility audit only before launch | Rejected: expensive late fixes |

## Validation

- `packages/i18n` tests (6); `/v1/meta/locales` returns `rtl` for Arabic (e2e). Phase 1 prototypes passed axe with 0 violations.

## Revisit when

First UI in Phase 3.
