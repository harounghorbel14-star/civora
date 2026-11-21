# ADR-017: Country packs and rule packs as versioned, integrity-checked configuration

| | |
|---|---|
| Status | **Accepted** — approved by the founder on 21 Nov 2026 (decision P2-D1; [decision record](../founder-review/P2-founder-decision-record.md)) |
| Date | 19 November 2026 |
| Origin | New in Phase 2 |
| Covers | R-4 (FR-66); Phase 1 capability #4 |
| Deciders | Founder (approval); engineering (author) |

## Context

- Regulatory rules (deadlines, statements, categories) differ by regulator and change over time.
- No hard-coded country logic (Phase 1 §18.1 #4).

## Decision

- **Country pack**: locales, numbering, currency, time zone, calendar, identifier formats, hosting rules, legal references, rule-pack list, default flags; JSON Schema (2020-12).
- **Rule pack**: one regulatory text as data (ceilings, start rules, mandatory fields, categories, statements), with source references.
- SHA-256 manifest per pack; services verify digests and schemas at start-up and **fail closed**; the digest is reported on `/health`.
- Pack status gates environments: `synthetic-development-only` packs are refused in pilot and production.
- Tenants activate a pack version; cases freeze the version used. Tenant deadlines may be shorter, never longer, than the ceiling.
- Unverified values are `null`, never guessed (e.g. RP-BCT-2026-10 ceiling).

## Consequences

**Positive**

- Regulatory change = reviewed data change, not a code release.
- Second country = new pack + new cell.

**Negative / costs**

- Packs need their own review process (compliance or counsel).

## Alternatives considered

| Option | Outcome |
|---|---|
| Hard-coded rules | Rejected |
| Database-only configuration | Rejected: no review trail or integrity check |

## Validation

- TN pack v0 with three BCT rule packs loads; tamper detection test; calendar tests; prod refuses the synthetic pack.

## Revisit when

Counsel answers Q-07 and the 2026-10/2020-11 open points.
