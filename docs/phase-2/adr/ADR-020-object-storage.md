# ADR-020: Object storage: S3-compatible API

| | |
|---|---|
| Status | **Accepted** — approved by the founder on 21 Nov 2026 (decision P2-D1; [decision record](../founder-review/P2-founder-decision-record.md)) |
| Date | 19 November 2026 |
| Origin | New in Phase 2 |
| Covers | O-A5; Phase 0 §8.2 (S3-compatible) |
| Deciders | Founder (approval); engineering (author) |

## Context

- Phase 0 chose "S3-compatible API (MinIO or the host's object store)".
- The `minio/minio` image could not be pulled in this environment on 19 Nov 2026; MinIO's community edition is AGPL-3.0, which matters for customer-hosted redistribution.

## Decision

- The platform depends only on the **S3 API** (with versioning and object lock).
- Dev cell: **SeaweedFS** (Apache-2.0).
- Staging, pilot and production: the hosting provider's S3-compatible store if it offers object lock in Tunisia; otherwise a self-run store chosen at provider selection (candidates: Ceph RGW, SeaweedFS, Garage).
- Per-tenant buckets or prefixes; envelope encryption with per-tenant keys; object lock for evidence.

## Consequences

**Positive**

- No vendor lock-in; licence-safe default.

**Negative / costs**

- Feature parity (object lock, replication) must be verified per store.

## Alternatives considered

| Option | Outcome |
|---|---|
| MinIO | Not chosen: image unavailable here; AGPL for redistribution |
| Filesystem storage | Rejected: no versioning or lock |

## Validation

- SeaweedFS 3.97 runs in the dev cell; anonymous access is refused (smoke test).

## Revisit when

Provider selection (E-07).
