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

## Open question found on 20 Nov 2026 (not decided here)

- **Redis licence:**
  - The dev cell image `redis:7-alpine` is Redis 7.4.12. Redis ≥ 7.4 is licensed RSALv2/SSPLv1, which is not open source; Redis 8 adds an AGPLv3 option ([redis.io licences](https://redis.io/legal/licenses/)).
  - **Valkey** (Linux Foundation, BSD-3-Clause) is the fork of the last BSD Redis. It speaks the same protocol, and BullMQ works with it.
  - Customer-hosted cells (ADR-019) redistribute the images, so the licence matters to banks.
  - **Recommendation:** Valkey 9.1 ([final technical decision package](../founder-review/P2-final-technical-decision-package.md) §8).
  - The HA cache built in Phase 2 uses Valkey 9.1.3 pending the founder's answer. Only the image changes if Redis 8 (AGPLv3) is preferred.

## Revisit when

Measured throughput need (§8.11 trigger 1).
