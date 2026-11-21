# ADR-006: Policy engine for ABAC: Cedar (OPA evaluated)

| | |
|---|---|
| Status | **Accepted** — approved by the founder on 21 Nov 2026 (decision P2-D1; [decision record](../founder-review/P2-founder-decision-record.md)) |
| Date | 19 November 2026 |
| Origin | Phase 0 §8.12 backlog item 006 (topic unchanged); decided by the O-A7 spike |
| Covers | O-A7 |
| Deciders | Founder (approval); engineering (author) |

## Context

- Phase 0 left the choice open: "OPA or Cedar for ABAC (evaluate both in Phase 2)".
- Access rules must be readable by compliance staff and auditors, testable, and versioned with country packs.

## Decision

- **Cedar** for application authorisation in `civora-core`, evaluated in-process. Policies and schema are pre-parsed once per pack version.
- Policies are validated in CI in strict mode against the schema; the engine-neutral conformance table (24 cases today) grows with every rule.
- PostgreSQL RLS remains the data-layer guard for tenant isolation.
- OPA is not adopted for application authorisation. Infrastructure policy uses Kubernetes Pod Security Admission and CI scanners; no second policy language in Phase 2.

## Consequences

**Positive**

- Typed schema catches policy errors before deployment; plain-language `permit`/`forbid` suits auditors.
- Both engines met every case, so the choice is reversible (< 100 lines of policy).

**Negative / costs**

- Cedar in Node runs as WebAssembly: about 0.25 ms per decision (OPA wasm about 0.008 ms) — far below budget, but not free.
- List filtering via partial evaluation is less mature than OPA's; SQL and RLS handle it.

## Alternatives considered

| Option | Outcome |
|---|---|
| OPA / Rego | Evaluated: correct and faster in wasm; less readable, no enforced schema |
| OpenFGA | Not evaluated: relationship model, not needed for current rules |
| Hand-rolled checks | Rejected: untestable, scattered |

## Validation

- Spike (19 Nov 2026): Cedar 4.14.0 and OPA 1.4.2 (wasm and REST) returned the expected decision for 24/24 cases; Cedar strict validation passed. See `spikes/policy-engine/README.md`.
- CI job `policy-engine-spike` re-runs the table.

## Revisit when

If partial evaluation for list filtering becomes necessary, or Cedar latency matters at measured load.
