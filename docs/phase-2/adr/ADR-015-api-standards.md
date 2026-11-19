# ADR-015: API standards: REST, OpenAPI contract, versioning, errors, idempotency

| | |
|---|---|
| Status | **Proposed — awaiting founder approval (acceptance criterion O-AC2)** |
| Date | 19 November 2026 |
| Origin | New in Phase 2 |
| Covers | O-API1–3; Phase 0 §8.9 |
| Deciders | Founder (approval); engineering (author) |

## Context

- B2B clients (banks) and our own apps need stable, documented APIs.
- Phase 0 §8.9 set the direction; this ADR fixes the details.

## Decision

- REST/JSON; URL major versioning `/v1`; OpenAPI generated from code, sorted, committed, and **drift-checked in CI**.
- OpenAPI 3.1: the generated 3.0 document is converted to 3.1.0 (JSON Schema 2020-12) and validated against the official 3.1 schema plus house rules (operationId, summary, tag, `/v1` versioning, no 3.0 keywords, no internal endpoints).
- RFC 9457 problem details; `X-Request-Id`; `Accept-Language` / `Content-Language`; cursor pagination; `Idempotency-Key` on creating POSTs; `ETag`/`If-Match` on updates.
- OAuth 2.0: PKCE for apps, client credentials + mTLS for B2B; signed webhooks with replay protection.
- Deprecation via `Deprecation`/`Sunset` headers, ≥ 6 months for B2B.

## Consequences

**Positive**

- Predictable integration for banks; contract changes visible in review.

**Negative / costs**

- Generated contracts depend on annotation discipline.

## Alternatives considered

| Option | Outcome |
|---|---|
| GraphQL | Rejected: harder caching, authorisation and B2B governance |
| Hand-written contract first | Deferred: generation + drift check gives the same review point with less duplication |

## Validation

- Three operations live; e2e tests; drift check caught a real change.
- Contract is OpenAPI 3.1.0 and passes schema validation in CI; the previous 3.0 contract is rejected by the gate (negative test).

## Revisit when

Phase 3 (breaking-change detection when the first business endpoint exists).
