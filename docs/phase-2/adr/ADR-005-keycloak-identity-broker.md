# ADR-005: Keycloak as identity broker; passkeys first; SMS OTP fallback only

| | |
|---|---|
| Status | **Accepted** — approved by the founder on 21 Nov 2026 (decision P2-D1; [decision record](../founder-review/P2-founder-decision-record.md)) |
| Date | 19 November 2026 |
| Origin | Phase 0 §8.12 backlog item 005 (topic unchanged) |
| Covers | O-A2 |
| Deciders | Founder (approval); engineering (author) |

## Context

- Institutions bring their own IdPs; citizens need passkeys, TOTP and (where authorised) national eID (Phase 0 §10.3).
- No foreign SaaS for identity (sovereignty).

## Decision

- Keycloak (26.x) per cell. **One realm per cell, tenants as organisations** with per-tenant IdP brokering; a separate platform realm for CIVORA operators.
- Staff: SSO via the institution's IdP; MFA by policy; FIDO2 for admins and break-glass (AAL3).
- Citizens: passkeys by default, TOTP, SMS OTP only as fallback with velocity limits; national eID only where authorised.
- Bank customers on the status page: case reference + one-time code to the contact on file.
- Tokens: 5-minute access tokens; rotating refresh tokens; `tenant_id`, `roles`, `acr`, `amr` claims.
- Keycloak gets its own database (own cluster in staging/production).

## Consequences

**Positive**

- Open source, self-hosted, OIDC/SAML brokering, WebAuthn.
- Organisations keep the realm count small.

**Negative / costs**

- Keycloak upgrades and realm migrations need care (strict import validation seen in 26.0).
- Organisation features are newer than realms; to be load-tested in Phase 3.

## Alternatives considered

| Option | Outcome |
|---|---|
| Realm per tenant | Rejected: operational overhead at dozens of tenants |
| Ory / custom | Rejected: more build effort; less brokering out of the box |

## Validation

- Dev cell imports realm `civora-dev` (AR/FR/EN, brute-force protection, PKCE client, tenant claim mapper); discovery endpoint answers.
- Import rejected an unknown attribute, so realm files are validated by real import in nightly CI.

## Revisit when

Phase 3 load test of organisations.
