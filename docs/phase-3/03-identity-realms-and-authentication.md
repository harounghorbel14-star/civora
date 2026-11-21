# 03 — Identity realms and authentication (Phase 3, week 2)

| | |
|---|---|
| Specification items | P3-A1 realms per cell (citizens, staff) · P3-A3 pairwise subject IDs · P3-F1 passkeys, TOTP (SMS fallback: Q3-1) · P3-SEC3 brute-force and credential-stuffing protection · P3-SEC5 officer accounts require FIDO2 keys · P3-T2 auth-flow E2E (web part) |
| Status | Built and tested on 21 Nov 2026. Locally: all checks passed (three consecutive runs after the S4 fix, §5 D7). GitHub: nightly run 17 **green, 12 of 12 jobs**, including `identity-realms` (realms test 1 min 33 s on a fresh runner) and `dev-cell-from-scratch` with the new realms; CI runs 36 and 37 green (realm profiles checked) |
| Identity provider | Keycloak 26.8.1, pinned by digest (`sha256:3f3c5f8e…7332`), the version Phase 2 validated (ADR-005) |
| Data | Synthetic users only, created per test run with random passwords; nothing is stored |

## 1. What was built

| File | What it is |
|---|---|
| `infra/keycloak/realms/civora-citizens.json` | Citizens realm of a cell: self-registration with e-mail verification, e-mail as username; browser flow **passkey, or password + TOTP**; apps `civora-web` and `civora-mobile` (public, PKCE S256, audience `civora-core`); resource server `civora-core`; relying-party template `rp-example-agency` (disabled) with a **pairwise subject** |
| `infra/keycloak/realms/civora-staff.json` | Staff realm of a cell (institution staff and officers): no self-registration; browser flow **password + FIDO2 security key, always** (user verification required, cross-platform); `tenant_id` declared in the user profile, **visible and editable by administrators only**, validated as a UUID, mapped into the access token of `civora-workspace` |
| Both realms | Password grant refused realm-wide (direct-grant flow = `deny-access-authenticator`; built-in `admin-cli` password grant off); 5-minute access tokens; rotated refresh tokens; brute-force protection (lockout after 5 failures, temporary, up to 15 min); no offline tokens by default; locales ar (default), fr, en; TOTP HmacSHA1 / 6 digits / 30 s (RFC 6238 default, the algorithm every authenticator app supports), replay of a used code refused |
| `infra/keycloak/apply-realm-policy.py` | Post-import policy (standard library only, idempotent). A realm import *adds* to Keycloak's built-in defaults and cannot remove them, so this step removes the default-role grants the profile does not allow, requires PKCE on the built-in public clients and has Keycloak generate the pairwise salts. It then exports the live realm |
| `infra/scripts/check-realm-security.py` | Realm conformance with three profiles (`dev`, `citizens`, `staff`) and a `--live` mode; evaluates the login flows (§3) and runs negative controls |
| `infra/tests/keycloak-realms/run.sh`, `login.cjs` | End-to-end test: file checks → Keycloak import → policy → live checks → real logins in Chromium with WebAuthn virtual authenticators → the core verifies the tokens Keycloak issued (§4). Nightly job `identity-realms` |
| Core | `OIDC_JWKS_URL_CITIZENS` / `OIDC_JWKS_URL_STAFF` (optional): fetch a realm's keys from an address other than the public issuer (inside the cell); https outside dev/test, never without its issuer; 3 new unit assertions |
| Dev cell | Keycloak 26.8.1 (pinned) imports the two realms; `dev-cell-up.sh` applies the policy and checks the live realms; the core now connects as `civora_core_app` (row-level security applies in the dev cell too) and trusts the two realms. Run from scratch on 21 Nov 2026: **14/14 smoke tests in 168 s** (three live realms conform; `/v1/me` answers 401 without a token, not 503); a token issued by the dev cell's Keycloak (issuer `localhost:8080`) was accepted by the dev cell's core, which fetched the keys at `keycloak:8080` (200) |

## 2. Realm design

| | Citizens (`civora-citizens`) | Staff (`civora-staff`) |
|---|---|---|
| Who | Citizens using CIVORA services in one country cell | Staff of the institutions (tenants) of the cell; officers |
| Account creation | Self-registration, e-mail verified | Created by the tenant administrator; no self-registration |
| Login | Passkey (discoverable, user verification required), **or** password + TOTP | Password **and** FIDO2 security key (user verification required) |
| What a password alone gets | Nothing (TOTP or passkey also required) | Nothing (security key also required) |
| Second-factor enrolment | TOTP at first password login; passkey added from the app (application-initiated action) | Security key at first login (required action) |
| Tenant | None: a citizen token with `tenant_id` is refused by the core | `tenant_id` from an admin-only attribute; required and validated by the core |
| Subject seen by third parties | Pairwise per relying party (P3-A3) | Not applicable (no third-party relying parties) |
| Account console | View profile, manage own passkeys/OTP | View profile only (authenticator changes through the tenant administrator, §6 R-P3-3) |
| Default roles | `citizen`, account view/manage | account view |

## 3. Conformance checking: the flow is evaluated, not pattern-matched

`check-realm-security.py` answers the question that matters: *can someone holding only these credentials complete
the login?* It follows Keycloak's semantics: if a flow has REQUIRED steps, all must pass and ALTERNATIVE steps are
ignored; otherwise one ALTERNATIVE must pass. Conditional sub-flows are assumed skipped (attacker-favourable). An
authenticator the checker does not know is a violation (it must be added before use).

| Profile | Rules (beyond the common ones: TLS, lockout ≤ 5, password policy, 5-min tokens, rotated refresh, no implicit flow, no password grant, PKCE, no wildcard redirects, no passwords in files, **direct-grant flow denies**, **no offline tokens by default**) | Negative controls |
|---|---|---|
| `dev` | No self-registration | 9 |
| `citizens` | Password alone fails; passkey alone succeeds; password + TOTP succeeds; passkeys require user verification; registration requires e-mail verification; no `tenant_id` in citizen tokens; relying parties confidential with pairwise subjects; first-party apps carry the `civora-core` audience; unmanaged user attributes off; `--live`: pairwise salts present | 16 (17 live) |
| `staff` | Login without a security key fails, whatever else is held (password, OTP, passkey, external IdP); password + key succeeds; user verification required; `webauthn-register` enabled; `tenant_id` declared, admin-only, UUID-validated, mapped into tokens; no self-registration | 17 |

The live export also contains Keycloak's built-in clients, flows and default roles, which a file check cannot see.
That is where three of the defects below were found.

## 4. Test evidence (local run, 21 Nov 2026)

`infra/tests/keycloak-realms/run.sh`: Keycloak 26.8.1, PostgreSQL 16, the core from the local build connected as
`civora_core_app`, Chromium (Playwright 1.63.0) with WebAuthn virtual authenticators. **All checks passed**
(about 75 s).

| # | Check | Result |
|---|---|---|
| Files | citizens (16 controls), staff (17), dev (9) | ok |
| Live | as imported, before policy: citizens 3 rules not met, staff 2 (Keycloak defaults); after policy: both conform, 17 controls each | ok |
| C1 | First citizen login with a password is held at TOTP enrolment; no code before a second factor; then code → tokens (PKCE) | ok |
| C1 | Access token: `typ` Bearer, audience `civora-core`, `azp` civora-web, no `tenant_id`, 300 s; no `offline_access` | ok |
| C2 | Core: `GET /v1/me` with the Keycloak token → 200, account realm citizens | ok |
| C3 | Passkey added from the app (`kc_action=webauthn-register-passwordless`), stored as `webauthn-passwordless` | ok |
| C4 | New session: passkey alone signs in; the core sees the same person | ok |
| C5 | Password + wrong TOTP code: refused, no code | ok |
| C6 | Password + current TOTP code: completes (the alternative to passkeys). A replayed code is refused (seen during test development: the code used at enrolment could not be used again) | ok |
| C7 | Password grant refused (civora-web, admin-cli) | ok |
| C8 | Pairwise: relying party A ≠ internal id, stable across logins; relying party B different again; a relying party added without a salt gets **no token** (fails closed); the policy re-run salts it | ok |
| C9 | Brute force: 5 wrong passwords → account temporarily locked | ok |
| S1 | First officer login: password accepted, then security-key enrolment required, no code before; then tokens with `tenant_id` | ok |
| S2 | Core: `GET /v1/me` with the staff token → 200, realm staff | ok |
| S3 | Second login: password, then the key is asked and accepted | ok |
| S4 | Password without the enrolled key: no assertion possible, no code; a **forged assertion** posted to Keycloak is rejected (Keycloak event `different_user_authenticated`) | ok |
| S5 | Password grant refused (civora-workspace, admin-cli), and refused by the realm even for a client misconfigured to allow it (`access_denied` from the deny flow) | ok |
| K1–K2 | Core refuses a token from an untrusted realm (master) and a request without a token: 401 | ok |
| info | R-P3-1: the username-first step reveals that an address has no account (§6) | reported |
| info | After passkey enrolment Keycloak still offers the password first; "Try Another Way" leads to the passkey (§6 R-P3-2) | reported |

## 5. Defects found by these tests, and what was done

| # | Defect | Found by | Fix | Now tested by |
|---|---|---|---|---|
| D1 | **FIDO2 bypass**: once an officer had enrolled a key, their password alone obtained a token through Keycloak's built-in `admin-cli` client (password grant; the direct-grant flow asks for no second factor). The core would refuse that token (no `civora-core` audience, no tenant), but the identity provider's guarantee was broken | Live probe on the imported realm (token issued) | Direct-grant flow of both realms (and the dev realm) replaced by a flow that always denies; `admin-cli` password grant off | S5, C7; checker rule; live check |
| D2 | Default roles granted `offline_access` (long-lived offline tokens), `uma_authorization` and, to staff, `manage-account` — an import cannot remove them | Live check | `apply-realm-policy.py` removes them | Live check; C1 scope |
| D3 | Keycloak's built-in `account` client: public, code flow on, no PKCE | Live check | Policy requires PKCE S256 on built-in public clients | Live check |
| D4 | Pairwise mapper without a salt after import and after creation through the admin API; Keycloak then refuses to issue tokens for that relying party ("Salt not available") | Live check, C8 | Policy re-saves the mapper; Keycloak generates a random salt kept in its database (never in Git) | C8 (fails closed, then works); live rule |
| D5 | Security-key enrolment failed for every key ("invalid cert path"): attestation `direct` with no trust anchors configured | S1 | Attestation `none`; restricting officers to approved key models is an open item (R-P3-5) | S1, S3 |
| D6 | Checker treated unknown authenticators as impossible to pass (defender-favourable) | Its own negative control | Unknown authenticators are now a violation | Negative controls |
| D7 | Test defect: the forged-assertion check (S4) raced Keycloak's own page script and failed in 1 of 2 local runs | Repeated local run | The forgery is posted from a fresh security-key page before the button is pressed | 3 consecutive local runs; nightly run 17 |

## 6. Known findings and residual risks

| # | Finding | Severity (internal) | Mitigation / plan |
|---|---|---|---|
| R-P3-1 | **Account enumeration**: the citizens' username-first step says "Invalid username or email" for an unknown address, so anyone can test whether an address has an account. The staff form (username and password together) does not | Medium (privacy) | Week 4: evaluate usernameless passkey sign-in (discoverable credentials) so that the first step no longer takes a username; week 5: rate limit the login endpoints at the gateway (P3-SEC2). Tracked by an `info` line in the test so a change is noticed |
| R-P3-2 | After a citizen enrols a passkey, Keycloak still offers the password first (oldest credential); the passkey is behind "Try Another Way" | Low (usability) | Week 3 authenticators API moves a newly enrolled passkey to first position (Keycloak `moveToFirst`) |
| R-P3-3 | **Enrolment bootstrap**: a REQUIRED second factor that is not yet configured is enrolled at the next password login, so whoever knows an account's password before enrolment enrols first. The same applies if a factor is removed | Medium | Staff cannot remove their key in the account console (policy). Week 3: staff onboarding by a one-time execute-actions link (set password + enrol key), no administrator-known passwords; week 6: recovery design requires re-proofing (P3-SEC4) |
| R-P3-4 | Pairwise salts live only in Keycloak's database: re-importing a realm into an empty Keycloak would generate new salts and change every pairwise identifier | Medium (operations) | A cell's Keycloak is rebuilt by restoring its database, never by re-importing; to be confirmed in the backup scope during the week-6 recovery review |
| R-P3-5 | Officer key models are not restricted (attestation `none`) | Low until pilot | Pilot hardening once the key model is chosen: attestation `direct` with the vendor roots in Keycloak's truststore and an AAGUID allowlist |
| R-P3-6 | Credential stuffing **across** accounts (one password tried on many accounts) is not stopped by per-account lockout | Medium | P3-SEC3 is **partly** met (per-account lockout, C9). Week 5: per-client/IP rate limits at the gateway on login endpoints, plus breached-password screening (evaluation) |
| R-P3-7 | Lockout can be used to lock a citizen out (denial of service) | Low | Temporary lockout (60 s increments, at most 15 min), not permanent; to be reviewed with R-P3-6 |

## 7. Specification status after week 2

| Item | Status | Evidence / remaining |
|---|---|---|
| P3-A1 realms per cell | **Done** (realm templates; dev cell imports them) | §4; staging import comes with the cell deployment |
| P3-A3 pairwise subject IDs | **Done** | C8; R-P3-4 |
| P3-F1 passkeys, TOTP | **Done**; SMS fallback **open** (Q3-1: no provider, simulated adapter later) | C1–C6 |
| P3-SEC5 officers require FIDO2 | **Done** (key required, user verification, forged assertion rejected) | S1–S5; R-P3-5 |
| P3-SEC3 brute force / credential stuffing | **Partial**: per-account lockout done; cross-account stuffing in week 5 | C9; R-P3-6 |
| P3-T2 auth-flow E2E | **Partial**: web flows in English with real WebAuthn; AR/FR and the app UI in week 4; Detox needs the mobile shell (Q3-3) | §4 |

## 8. How to run

```sh
pnpm install && pnpm build                       # the core is started from the local build
infra/tests/keycloak-realms/run.sh               # docker, python3, node 22, Playwright with Chromium
python3 infra/scripts/check-realm-security.py infra/keycloak/realms/civora-staff.json --profile staff --self-test
infra/scripts/dev-cell-up.sh --fresh             # dev cell with the two realms, policy and live checks
```
