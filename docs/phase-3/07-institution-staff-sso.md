# 07 — Institution staff SSO (Phase 3, week 3, part 4)

| | |
|---|---|
| Specification item | P3-R1 institution staff SSO (SAML/OIDC), additive scope (roadmap protection matrix, P1-D4; Workspace — Regulated Finance) |
| Decisions applied | ADR-005 (Keycloak as identity broker; tenants as organisations with per-tenant identity providers; staff SSO via the institution's IdP), ADR-016 (tenant from the token, never from input), P3-SEC5 (officer accounts require FIDO2 keys), Phase 2 doc 06 §6.2 and §6.6 |
| Status | Built and tested against Keycloak 26.8.1 with two simulated institutions (OIDC and SAML) on 21 Nov 2026 (results §5); GitHub results in [01 — Progress](01-progress.md) |

## 1. What was built

| Part | What it does |
|---|---|
| Staff realm (`civora-staff.json`) | Organisations on. The browser flow gains the identity-provider redirector: the Workspace of an institution sends `kc_idp_hint`, and the sign-in goes straight to that institution's identity provider. Two new flows: **`staff-first-broker-login`** creates the account only if no account has that username or e-mail, then adds it to the tenant's organisation; it **never links** to an existing account. **`staff-post-broker-key`** requires the CIVORA security key after every sign-in through an institution |
| `infra/keycloak/configure-tenant-sso.py` | Platform-operator action, idempotent, one call per tenant. Creates the identity provider (OIDC or SAML), its mappers and the tenant's organisation (attribute `tenant_id`, the institution's e-mail domain), and links the provider to it |
| Identity provider settings | Hidden on the shared login page (it would list the institutions). Signatures validated (OIDC: keys from the provider, PKCE S256; SAML: signed responses **and** assertions). The institution's tokens are not stored |
| Mappers | `tenant_id` **hardcoded** to the tenant, sync FORCE: the institution can never assert a tenant, and a changed value is reset at the next sign-in. Username `<provider>.<subject at the institution>`, unique per provider. E-mail and names (SAML attributes) |
| Security key (P3-SEC5) | Enrolled at the first SSO sign-in, approved models only (the realm's attestation policy, doc 03 §9.3). Every later SSO sign-in asks for it. The institution's password alone gets nothing |
| Realm conformance (`check-realm-security.py`) | Now **models brokered sign-in**: through the redirector, a brokered login reaches only an account the provider itself created, unless the first-login flow links accounts; the provider's post-login flow then decides. New rules for every provider of the staff realm: hidden, create-only first login that adds the organisation membership, post-login flow requiring the key, exactly one hardcoded `tenant_id` mapper and no mapper importing `tenant_id`, signatures validated, PKCE for OIDC, OIDC or SAML only, no stored tokens. Seven new negative controls for providers. A static rule also catches flow descriptions longer than Keycloak accepts (found when importing) |
| Staff session limit | Aligned with Phase 0 §10.3: absolute **8 h** (was 10 h in the realm file), idle 30 min; the checker now enforces both (negative control: a 10-hour session) |
| Simulators (`infra/keycloak/simulators/`) | `sim-bank-a-idp` (OIDC) and `sim-bank-b-idp` (SAML 2.0) stand in for institutions' own identity providers, with synthetic staff only; dev and tests only |

## 2. Joiner, mover, leaver (Phase 2 doc 06 §6.6)

| Event | Now | Still open |
|---|---|---|
| Joiner | Account created at the first SSO sign-in (just in time) in the tenant of the provider; the key is enrolled then; unit roles are given by the tenant administrator (doc 05) | SCIM provisioning where an institution offers it |
| Mover | Unit roles changed by the tenant administrator (doc 05) | Roles and units from the institution's groups, mapped per tenant (R-P3-13) |
| Leaver | Disabled at the institution: no new sign-in (tested). Existing CIVORA sessions end at the session limit, or at once when the tenant administrator or the platform operator ends them | Back-channel logout from the institution so that CIVORA sessions end at once (R-P3-14) |

## 3. Design notes

- **Why create-only.** Keycloak's default first-login flow links a brokered identity to an existing account with the
  same e-mail. In a realm shared by several institutions, that would let one institution's identity provider take over
  a local account or another institution's account, and it would also rewrite the tenant through the hardcoded mapper.
  The test tries both and is refused.
- **Why the key after SSO.** P3-SEC5 requires FIDO2 keys for officer accounts. An institution's identity provider
  may use weaker factors. Enrolling the key at the first SSO sign-in relies on the institution's own authentication,
  which is also the recovery path for its staff (Phase 2 doc 06 §6.6). Accounts that already have a key can never be
  reached with the institution's password alone.
- **Why hidden providers.** One login page serves every institution of the cell; listing the providers would publish
  the list of customers. The institution's Workspace address carries the hint.
- **The core is unchanged.** Brokered tokens carry the same `tenant_id` claim; the core's tenant rule (staff token with a
  valid tenant) and row-level security apply as before.

## 4. Open points

| # | Point | Owner |
|---|---|---|
| R-P3-13 (new, low) | Roles and units from the institution's groups (mover) are not mapped; the tenant administrator sets them | Week 4 or Phase 6 (Workspace) |
| R-P3-14 (new, medium) | No back-channel logout from institutions: a leaver's open CIVORA session lasts until the session limit (staff: idle 30 min, at most 8 h) unless ended by the tenant administrator or the operator | **Pilot gate PG-1** ([doc 08](08-pilot-gate.md)): OIDC back-channel logout and SAML single logout per institution, tested, before any pilot |
| — | Real institutions' identity providers (metadata, certificates, domains) come with each tenant's onboarding | Per tenant |

## 5. Test evidence (21 Nov 2026)

`infra/tests/keycloak-realms/sso.cjs`, run by `run.sh` against Keycloak 26.8.1 (staff realm and the two simulators),
Chromium with virtual security keys, the core as `civora_core_app`. The whole run (realm journeys in Arabic, French and
English, security, account, organisation, SSO and eID checks): **161 checks, all passed** (428 s). Dev cell from
scratch with the new staff realm: 16 of 16 smoke checks.

Found on the way: Keycloak refuses flow descriptions over 255 characters at import (now a static checker rule); an
earlier test left a deliberately misconfigured client in the staff realm, which the live check after SSO reported (the
test now removes it); the test containers left anonymous volumes behind (now removed with them).

| # | Check | Result |
|---|---|---|
| 1 | Simulated institutions prepared (redirect URIs, client secret, SAML signing certificate) | ok |
| 2 | `configure-tenant-sso.py`: bank A over OIDC, bank B over SAML; run again for bank A: same provider, two mappers, one organisation per tenant | ok |
| 3 | The live staff realm with both providers conforms, negative controls rejected | ok |
| 4 | The shared staff login page lists no institution | ok |
| 5 | Bank A (OIDC), first sign-in: the institution's page, then key enrolment, then a token with bank A's `tenant_id`; the core accepts it | ok |
| 6 | The account: security key only (no CIVORA password), linked to bank A only, username prefixed by the provider; member of bank A's organisation | ok |
| 7 | Second sign-in: the institution, then a key assertion; the institution's password without the key: no token | ok |
| 8 | Bank B (SAML): key enrolled, token with bank B's `tenant_id`, accepted by the core | ok |
| 9 | Bank B asserts the e-mail of bank A's user: refused, her account unchanged (tenant A, linked to bank A only) | ok |
| 10 | An institution user with the e-mail of a local staff account: refused; the local account is not linked and keeps its tenant | ok |
| 11 | `tenant_id` changed behind the scenes is reset to bank A at the next SSO sign-in | ok |
| 12 | Disabled at the institution: no CIVORA token | ok |
