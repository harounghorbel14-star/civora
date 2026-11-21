# 02 — Identity data model, token verification and mandates (week 1)

| | |
|---|---|
| Implements | P3-DB1–DB6, P3-API2, P3-API5, P3-F3, P3-F4, P3-F5, P3-AC3 (and part of P3-T1, T3, T4) |
| Decisions applied | ADR-001 (module owns schema `iam`), ADR-005, ADR-016 (person from the token only; RLS), ADR-015 (problem+json, `:verb` actions), ADR-024 (SQL migration, expand-only) |
| Code | `services/core/migrations/1763683200000_iam-identity-and-mandates.sql`; `services/core/src/modules/identity-access/` |

## Data model (schema `iam`, tier T1)

| Table | Purpose | Who can read it (row-level security) |
|---|---|---|
| `person` | A natural person; preferences (locale, accessibility). **No name or national identifier** | The person |
| `account` | Login account in the `citizens` or `staff` realm (staff carry a `tenant_id`; citizens never do — check constraint) | The person |
| `authenticator` | Mirror of Keycloak credentials (passkey, security key, TOTP, SMS): metadata only | The person |
| `identity_claim` | Verified claims as keyed digests (Phase 3: simulated eID only) | The person |
| `pairwise_id` | Pairwise subject per relying-party sector | The person |
| `mandate` | Principal → agent, scopes, validity, status | Principal and agent |
| `mandate_event` | Append-only record of every mandate action | Principal and agent |

**Access model:**
- The application connects as `civora_core_app`: `NOBYPASSRLS`, owns nothing. Each request runs in a transaction with `SET LOCAL app.person_id` taken from the verified token. Without it, every table returns nothing (tested).
- The application role can only **read**, and **update its own preferences** (column-level grant).
- Creating, accepting and revoking mandates go through `SECURITY DEFINER` functions. They check the caller, the state, the expiry and the invitation code, and write the event. The application role has no `INSERT`/`UPDATE`/`DELETE` on mandates or events (tested: permission denied).

## Tokens

The core verifies Keycloak access tokens itself:
- **Signature:** checked against the realm's key set.
- **Algorithms:** asymmetric only; `none` and HMAC are refused.
- **Claims:** issuer, audience `civora-core`, expiry with 30 s tolerance, and `typ = Bearer` (an ID token is refused).
- **Tenant rule:** staff tokens must carry a valid tenant; citizen tokens must not.

A local key file is allowed only in `dev`/`test`, and plain-http issuers are refused outside them. Tokens are never logged.

## Mandates

| Rule | Where enforced |
|---|---|
| Scopes `<domain>:<read\|submit\|manage>`, domains cases, documents, appointments, payments, benefits; 1–20; no duplicates | API and database check |
| Identity and mandates can **never** be delegated | API (domain allow-list) |
| Duration ≤ 366 days; expiry in the future; start not in the past | API and database check |
| The agent is never looked up in a directory: the principal gives a **one-time 256-bit invitation code**. Only its SHA-256 digest is stored, and it is cleared on acceptance | Function `iam.accept_mandate` |
| The principal cannot accept their own mandate; a wrong code and an unknown mandate get the same 404 | Function + API |
| Either party can end it: the principal **revokes**, the agent **renounces** | Function `iam.revoke_mandate` |
| "Expired" is derived from the expiry date | API |
| Every action is logged and visible to both parties (P3-AC3) | `iam.mandate_event` + `GET /v1/mandates/{id}/events` |

## Evidence

| Test | Result |
|---|---|
| SQL check as the application role (17 cases: isolation, wrong code, self-acceptance, scope edit refused, cross-person update refused, direct event insert refused, bad scope, over-long mandate, no person) | All as designed |
| Unit tests: token verification (8) and mandate/accessibility rules (6) | 14/14 |
| End to end, real app + PostgreSQL as `civora_core_app` (6 scenarios) | 6/6 |
| Whole suite | 63 tests, 5 suites, all pass; OpenAPI 3.1: 8 paths, 10 operations, house rules pass |
