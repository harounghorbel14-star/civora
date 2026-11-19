# ADR-026: AI agent runtime: identities, tool permissions, human approval, evaluation

| | |
|---|---|
| Status | **Proposed — awaiting founder approval (acceptance criterion O-AC2)** |
| Date | 19 November 2026 |
| Origin | New in Phase 2 |
| Covers | Mission topic "AI and agent infrastructure"; D10 |
| Deciders | Founder (approval); engineering (author) |

## Context

- Agents (document triage, drafting) must not decide rights and must be accountable like humans.
- No AI components before Phase 10.

## Decision

- **Design-level decision; nothing built in Phase 2** ([12](../12-ai-and-agent-infrastructure.md)).
- Each agent has its own principal per tenant; actions record `onBehalfOf`.
- Tools are public core APIs authorised by Cedar (`principal is Agent`); read-only by default; writes need explicit policy and human approval.
- No database credentials for AI services; prompt-injection containment; kill-switch flags per tenant and agent.
- Policies forbid agent principals from issuing decisions, deadlines, eligibility or refusals.

## Consequences

**Positive**

- AI fits the existing audit and policy model.

**Negative / costs**

- Human approval steps reduce automation gains (by design).

## Alternatives considered

| Option | Outcome |
|---|---|
| Agents with service-account superpowers | Rejected: unaccountable |

## Validation

- None in Phase 2 (design only).

## Revisit when

Phase 10; P1-D14 decision.
