# ADR-023: Monorepo and repository structure

| | |
|---|---|
| Status | **Accepted** — approved by the founder on 21 Nov 2026 (decision P2-D1; [decision record](../founder-review/P2-founder-decision-record.md)) |
| Date | 19 November 2026 |
| Origin | New in Phase 2 |
| Covers | O-D4; D11 |
| Deciders | Founder (approval); engineering (author) |

## Context

- The original Phase 2 spec fixes the layout: apps/web, apps/mobile, apps/workspace, services/core, services/guide, services/health-bridge, packages/*.
- D11 (open-source strategy) is pending.

## Decision

- One Git repository with **pnpm workspaces**; one lockfile; exact versions.
- Layout as specified, plus `infra/`, `spikes/`, `scripts/`, `docs/`.
- Repository licence stays **proprietary ("all rights reserved")** until D11 is decided; no component is published as open source before then.

## Consequences

**Positive**

- Atomic changes across packages; shared tooling and CI.

**Negative / costs**

- CI time grows with the repository (filtering by changed paths later).

## Alternatives considered

| Option | Outcome |
|---|---|
| Polyrepo | Rejected: coordination overhead for a small team |

## Validation

- Workspace installs, builds and tests in CI; module-boundary check.

## Revisit when

D11 decision.
