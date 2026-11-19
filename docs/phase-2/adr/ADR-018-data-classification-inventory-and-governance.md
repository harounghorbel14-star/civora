# ADR-018: Data classification, inventory and governance

| | |
|---|---|
| Status | **Proposed — awaiting founder approval (acceptance criterion O-AC2)** |
| Date | 19 November 2026 |
| Origin | New in Phase 2 |
| Covers | O-D3, R-3 |
| Deciders | Founder (approval); engineering (author) |

## Context

- Phase 0 §10.1 defines tiers T0–T3; §9.10 requires an inventory generated from schema annotations.
- The financial data domain needs explicit treatment (R-3).

## Decision

- Tiers as in Phase 0 §10.1 (T0 special category … T3 public); financial customer data is **T1**.
- Every table and column carries `@tier`, `@pii`, `@retention`, `@basis` comments; from Phase 3 CI fails on missing annotations and regenerates the inventory.
- The inventory (43 items in Phase 2) feeds INPDP declarations and tenants' records of processing.
- New personal-data fields need DPO (or counsel) review in the pull request.
- Synthetic data only outside pilot and production; reserved identifier ranges enforced in CI.

## Consequences

**Positive**

- Inventory stays true to the schema.

**Negative / costs**

- Annotation discipline required on every migration.

## Alternatives considered

| Option | Outcome |
|---|---|
| Manual spreadsheet only | Rejected: drifts from reality |

## Validation

- `docs/phase-2/data/data-inventory.csv` (43 rows); base schemas annotated; fitness check guards synthetic identifiers.

## Revisit when

Counsel opinion on lawful bases (Phase 1 counsel brief).
