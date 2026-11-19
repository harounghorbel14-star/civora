# ADR-008: Transactional outbox + BullMQ; broker abstraction

| | |
|---|---|
| Status | **Proposed — awaiting founder approval (acceptance criterion O-AC2)** |
| Date | 19 November 2026 |
| Origin | Phase 0 §8.12 backlog item 008 (topic unchanged) |
| Covers | O-A4 |
| Deciders | Founder (approval); engineering (author) |

## Context

- Events must not be lost when a transaction commits, and external calls must not run inside user requests (Phase 0 §8.8).
- Redis is already needed for sessions and rate limits.

## Decision

- Each module writes events to an **outbox table in its own schema** in the same transaction.
- A relay publishes to **BullMQ** on Redis (at-least-once); consumers are idempotent; dead-letter queues have an operator view.
- Per-tenant fair queues and concurrency limits.
- The relay talks to a broker interface, so NATS JetStream or Kafka can replace BullMQ when a §8.11 trigger is met.
- Events carry references, not personal payloads.

## Consequences

**Positive**

- No lost events; minimal operations for MVP.

**Negative / costs**

- Redis becomes critical for asynchronous work (HA via Sentinel in staging/prod).
- At-least-once delivery requires idempotent consumers everywhere.

## Alternatives considered

| Option | Outcome |
|---|---|
| Kafka now | Rejected: operations for a small team |
| Direct publish after commit | Rejected: loses events on crash |

## Validation

- Redis 7 with authentication runs in the dev cell (smoke test). Outbox code arrives in Phase 3.

## Revisit when

Measured throughput need (§8.11 trigger 1).
