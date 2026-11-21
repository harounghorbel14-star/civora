# 04 — Sessions, authenticators and step-up (Phase 3, week 3, part 1)

| | |
|---|---|
| Specification items | P3-A4 step-up flows · P3-API3 sessions · P3-API4 authenticators · P3-F2 device management · P3-DB3 authenticator mirror |
| Status | Built and tested against the real Keycloak realms on 21 Nov 2026 (results §4); GitHub results in [01 — Progress](01-progress.md) |

## 1. What was built

| Part | What it does |
|---|---|
| Token | The core now reads `auth_time` (when the person last presented credentials), `acr` (`"1"` credentials presented, `"0"` session reused through single sign-on) and `sid` (Keycloak session). Malformed values are ignored, never trusted |
| Step-up (P3-A4) | `StepUpGuard` / `@RequireStepUp()`, as in **RFC 9470**: a sensitive action needs a sign-in with credentials within `STEP_UP_MAX_AGE_SECONDS` (default 300 s). Otherwise `401` with `WWW-Authenticate: Bearer error="insufficient_user_authentication", max_age=300`; the app signs the person in again (`prompt=login`) and retries |
| `GET /v1/me/sessions` | The person's sessions in their realm: start, last use, address, applications, the current one marked |
| `DELETE /v1/me/sessions/{id}` | Ends one of the person's own sessions; a session of anyone else is `404`. The session's refresh token stops working at once; access tokens already issued expire within 5 minutes (they are verified offline). No step-up: ending a session only ever protects the person |
| `GET /v1/me/authenticators` | Passkeys, security keys, authenticator apps (never the password); refreshes the metadata mirror `iam.authenticator` (P3-DB3) |
| `POST /v1/me/authenticators` | Step-up. Returns the Keycloak action the app adds to its authorization request (`kc_action`): citizens `passkey` → `webauthn-register-passwordless`, `totp` → `CONFIGURE_TOTP`; staff `security-key` → `webauthn-register`. The enrolment ceremony happens at the identity provider, where the credential is created; other kinds: `400` |
| `DELETE /v1/me/authenticators/{id}` | Step-up. Refused with `409` when the account could no longer sign in afterwards (citizens: a passkey, or password + authenticator app; staff: password + security key); unknown or someone else's: `404` |
| Keycloak admin client | One per realm (`civora-core-provisioner`, user management only). The staff realm now has its provisioner too; its secret is regenerated at deployment (`apply-realm-policy.py --provisioner-secret-out`) and given to the core as a file (`KEYCLOAK_STAFF_PROVISIONER_SECRET_FILE`) |
| Mirror | Migration `iam.sync_authenticators(realm, items)`: SECURITY DEFINER, current person's account only, at most 50 items; the application role still cannot write the table |

## 2. Rules

| Action | Token needed | Refused when |
|---|---|---|
| List sessions / authenticators | Valid access token | — |
| End a session | Valid access token | Not one of the person's sessions (`404`) |
| Start adding an authenticator | Step-up | Kind not offered in the realm (`400`) |
| Remove an authenticator | Step-up | Not the person's (`404`); last way to sign in (`409`) |

## 3. Design notes

- **Why step-up checks `acr` as well as `auth_time`:** single sign-on reuse keeps the original sign-in time, so a
  token obtained silently a few seconds after a real sign-in has a recent `auth_time` but `acr = "0"`; it is refused.
- **Session ids** in Keycloak 26.8 are opaque base64url strings (not UUIDs); the API validates that form. This was
  found by the integration test (the first version rejected every real session id with `400`).
- **R-P3-2** (the passkey is offered under "Try another way") is a page-order question, not a credential-order one:
  the first page does not know the user, so moving a credential first changes nothing. It stays a week-4 app topic.

## 4. Test evidence (21 Nov 2026)

Against Keycloak 26.8.1 with both realms, the core as `civora_core_app`, Chromium with virtual authenticators
(`infra/tests/keycloak-realms/account.cjs`, run by `run.sh` after the realm journeys; step-up limit 30 s in the test):

| # | Check | Result |
|---|---|---|
| 1 | Access token after sign-in: `auth_time` now, `acr "1"`, `sid` | ok |
| 2 | Authenticators: the authenticator app listed, never the password; citizen asking for a security key `400`; passkey `201` with `webauthn-register-passwordless`; after the action the passkey is listed | ok |
| 3 | Sessions: two devices listed, only the current one marked, with the application; an officer's session cannot be ended by a citizen (`404`, it stays active); ending the other device's session `204` and its refresh token is refused at once; afterwards one session | ok |
| 4 | Step-up: token from single sign-on reuse has `acr "0"` and is refused with `401 insufficient_user_authentication, max_age`; a sign-in older than the limit is refused; nothing was removed; signing in again (`prompt=login`, passkey) gives `acr "1"` and a new `auth_time`; then removing the authenticator app `204`; removing the passkey, now the last way in, `409`; unknown id `404` | ok |
| 5 | With the authenticator app removed, the password alone no longer signs in (that path needs the second factor) | ok |
| 6 | Officer (fresh sign-in): the security key listed; removing the only key `409`; asking for a passkey `400`; adding a second key `201 webauthn-register` | ok |
| 7 | Mirror `iam.authenticator` filled (metadata only) | ok |

Core: 82 tests (unit: rules for who can still sign in, last-factor refusal, ownership of credentials and sessions,
step-up with SSO reuse / old / future sign-in times; end to end on PostgreSQL: the mirror function only touches the
current person, the application role cannot insert). OpenAPI 13 paths / 16 operations. Dev cell 15/15.
