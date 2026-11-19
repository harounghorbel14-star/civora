# ADR-021: Feature flags: OpenFeature with an in-process provider

| | |
|---|---|
| Status | **Proposed — awaiting founder approval (acceptance criterion O-AC2)** |
| Date | 19 November 2026 |
| Origin | New in Phase 2 |
| Covers | O-F2 |
| Deciders | Founder (approval); engineering (author) |

## Context

- Phase 2 must deliver a feature-flag framework (O-F2). An external flag SaaS would move configuration outside the cell.

## Decision

- OpenFeature server SDK with an in-memory provider; defaults from the country pack; tenant overrides via the evaluation context.
- Locked platform prefixes (`platform.`, `integrations.production-adapters`) cannot be overridden by tenants; undeclared or wrong-type overrides are rejected.
- Flags control releases and per-tenant options only — not permissions (policies) and not regulatory values (rule packs).

## Consequences

**Positive**

- Vendor-neutral API; no extra service.

**Negative / costs**

- No UI for flag management until Phase 3 (configuration as code).

## Alternatives considered

| Option | Outcome |
|---|---|
| Flag SaaS | Rejected: residency |
| Unleash/Flagsmith self-hosted | Deferred: unnecessary at this scale |

## Validation

- `packages/feature-flags` tests (defaults, overrides, locking, rejection); core uses it for `meta.locales.english`.

## Revisit when

When non-engineers must toggle flags (Phase 6).
