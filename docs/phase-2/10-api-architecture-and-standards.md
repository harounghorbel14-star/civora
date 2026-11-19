# 10. API Architecture and Standards

| | |
|---|---|
| Decision | ADR-015 (API standards); builds on Phase 0 §8.9 |
| Original items | **O-API1** `GET /health`, **O-API2** `GET /v1/meta/locales`, **O-API3** OpenAPI pipeline |
| Built in Phase 2 | Three public operations (`/health`, `/health/ready`, `/v1/meta/locales`); the internal `/metrics`; RFC 9457 errors; request ids; contract generation with a drift check in CI ([services/core/openapi/core.openapi.json](../../services/core/openapi/core.openapi.json)) |

## 10.1 Style

| Topic | Standard | Status |
|---|---|---|
| Protocol | REST over HTTPS, JSON (`application/json`; errors `application/problem+json`) | Applied |
| Contract | OpenAPI is the reviewed contract for every public API. Generated from code annotations, sorted deterministically, committed. **CI fails if the committed contract differs from the generated one** | Applied. The check caught a real change on 19 Nov 2026 (Swagger upgrade) |
| OpenAPI version | **Target 3.1** (Phase 0 §8.9). `@nestjs/swagger` 11 emits **3.0.0**. Phase 3 adds a 3.0 → 3.1 conversion step and a Spectral lint gate | Gap recorded (ADR-015) |
| Versioning | URL major version (`/v1/...`). Additive changes stay in the same version; breaking changes need `/v2` and a deprecation window of at least 6 months for B2B (`Deprecation` and `Sunset` headers, RFC 9745/8594) | Applied to `/v1/meta/locales` |
| Platform endpoints | `/health`, `/health/ready` are unversioned (operational). `/metrics` is internal and excluded from the public contract | Applied |
| Naming | Plural nouns, kebab-case paths, camelCase JSON fields, ISO 8601 timestamps with offset, ISO 4217 currency with integer minor units | Applied |
| Localisation | `Accept-Language` negotiation (RFC 9110); `Content-Language` and `Vary: Accept-Language` on localised responses | Applied |

## 10.2 Requests and responses

| Concern | Rule |
|---|---|
| Identifiers | UUIDv7 in paths; never national identifiers, e-mails or phone numbers in URLs or query strings |
| Pagination | Cursor-based: `?limit=` (max 100) and `?cursor=`; response `{ items, nextCursor }` |
| Filtering and sorting | Explicit allow-listed fields (`?status=open&sort=-createdAt`) |
| Idempotency | `Idempotency-Key` header **required** on POSTs that create resources. Keys are stored per tenant for 24 h; a replay returns the first response; same key with a different body → `422` |
| Concurrency | `ETag` on resources; `If-Match` required on updates to cases and configuration; mismatch → `412` |
| Errors | RFC 9457: `type`, `title`, `status`, `instance`, `requestId`. Validation errors add `errors[]` with JSON pointers. No stack traces or input echo (implemented) |
| Correlation | `X-Request-Id` accepted if well-formed, otherwise generated; returned on every response; propagated to logs, traces and outbound adapter calls (implemented) |
| Rate limiting | Per tenant and per client at the gateway; `429` with `Retry-After`. `RateLimit` headers per the IETF draft once it is stable |
| Caching | `Cache-Control: no-store` by default (implemented). Public T3 content (Directory) may be cached explicitly |
| Large files | Upload via pre-signed, short-lived object-storage URLs scoped to one tenant prefix; the malware scan completes before the file is attached |

## 10.3 Security of APIs

| Client type | Authentication | Authorisation |
|---|---|---|
| First-party apps | OIDC authorisation code + PKCE via a backend-for-frontend | Roles + Cedar policies |
| B2B (bank systems) | OAuth 2.0 client credentials **with mTLS** (certificate-bound tokens, RFC 8705); DPoP later for high-assurance clients | Per-client scopes, tenant fixed by the client registration |
| Webhooks (outbound) | HMAC-SHA-256 signature over timestamp + body; rotating secrets; 5-minute replay window; retries with back-off; dead-letter after 24 h | Per-tenant subscriptions |
| Inbound callbacks (gateways) | mTLS or signature per provider; IP allow-lists only as an extra layer | Adapter-specific |

**Every endpoint gets an authorisation test** (the IDOR suite): another tenant's object → `404`, a wrong role → `403`. These are part of the API definition of done ([18](18-coding-standards.md) §5).

## 10.4 Endpoint families by phase (Phase 0 §19, unchanged)

| Phase | Families |
|---|---|
| **2** | `GET /health`, `GET /health/ready`, `GET /v1/meta/locales` **(built)** |
| 3 | `/v1/auth/*` (via Keycloak), `/v1/me`, `/v1/tenants/{id}/users`, `/v1/otp` |
| 4 | `/v1/documents`, `/v1/credentials`, `/v1/mandates` |
| 5 | `/v1/catalogue/services`, `/v1/catalogue/procedures` |
| 6 | `/v1/cases`, `/v1/cases/{id}/events`, `/v1/cases/{id}/decision`, `/v1/reports/regulatory/{packId}`, `/v1/webhooks` |
| 8 | `/v1/payments/intents` |
| 10 | `/v1/guide/answers` |
| 12 | `/v1/integrations/*` (operator-only) |

## 10.5 Implemented contract (excerpt)

| Operation | Purpose | Response |
|---|---|---|
| `GET /health` | Liveness and dependency health. Always `200` while the process lives; `status` is `degraded` when a configured dependency is down | `{ status, version, environment, countryPack: { id, version, status, digest }, checks: { database, countryPack } }`. No personal data |
| `GET /health/ready` | Readiness; `503` when a configured dependency is down | Same body |
| `GET /v1/meta/locales` | The cell's locales with direction and native names; negotiated locale | `{ default, fallback, negotiated, locales: [{ code, language, region, dir, nameEn, nativeName, numberingSystem }] }` + `Content-Language` |

## 10.6 Contract governance

1. A change to a public API starts with the contract diff in the pull request; reviewers approve the diff.
2. Breaking-change detection (`oasdiff`) is added in Phase 3 when the first business endpoint exists.
3. Client SDKs (TypeScript) are generated from the contract for the apps in this monorepo. External SDKs come only after Phase 12.
4. The contract states it is a synthetic-data skeleton with no production integrations (generator description).
