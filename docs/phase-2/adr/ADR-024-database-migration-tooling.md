# ADR-024: Database migration tooling: node-pg-migrate (SQL), expand/contract

| | |
|---|---|
| Status | **Accepted** — approved by the founder on 21 Nov 2026 (decision P2-D1; [decision record](../founder-review/P2-founder-decision-record.md)) |
| Date | 19 November 2026 |
| Origin | New in Phase 2 |
| Covers | O-DB2 |
| Deciders | Founder (approval); engineering (author) |

## Context

- Migrations must be reviewable by DBAs and the DPO, versioned, and safe during rolling deployments.

## Decision

- **node-pg-migrate** with plain SQL files (`-- Up Migration` / `-- Down Migration`), ordered timestamps, `--check-order`.
- Migrations run as a pre-install/pre-upgrade Job (Helm hook) before the new version starts.
- **Expand/contract**: no destructive change in the same release that stops using a column; production never runs down-migrations; down sections are used in tests.
- Two reviewers for every migration; DPO/counsel for new personal-data fields.

## Consequences

**Positive**

- Plain SQL is reviewable by non-TypeScript reviewers (DBAs, auditors).

**Negative / costs**

- No ORM-generated migrations; developers write SQL.

## Alternatives considered

| Option | Outcome |
|---|---|
| Prisma / TypeORM migrations | Rejected: generated SQL harder to review; ORM lock-in |
| Flyway | Rejected: Java dependency |

## Validation

- Base-schema migration: up → down → up test against PostgreSQL 16; migration Job validated server-side; runs in the dev cell.

## Revisit when

—
