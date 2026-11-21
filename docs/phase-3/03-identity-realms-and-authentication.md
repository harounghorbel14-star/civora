# 03 — Identity realms and authentication (Phase 3, week 2)

| | |
|---|---|
| Specification items | P3-A1 realms per cell (citizens, staff) · P3-A3 pairwise subject IDs · P3-F1 passkeys, TOTP (SMS fallback: Q3-1) · P3-SEC3 brute-force and credential-stuffing protection · P3-SEC5 officer accounts require FIDO2 keys · P3-T2 auth-flow E2E (web part) · P3-AC1 flows in AR/FR/EN (realm part) |
| Status | Week 2 built and tested on 21 Nov 2026 (nightly run 17 green, 12/12 jobs). **Same day, second pass: the five open findings raised before approving the identity system were closed** (§9): account enumeration, first enrolment, FIDO2 attestation, credential stuffing, languages. Local evidence below. GitHub: CI run 41 and nightly run 20 green (12 of 12 jobs, including `identity-realms` with every journey and security check, and the gateway); details in [01 — Progress](01-progress.md) |
| Identity provider | Keycloak 26.8.1, pinned by digest (`sha256:3f3c5f8e…7332`), the version Phase 2 validated (ADR-005) |
| Data | Synthetic users only, created per test run with random passwords; nothing is stored |

## 1. What was built

| File | What it is |
|---|---|
| `infra/keycloak/realms/civora-citizens.json` | Citizens realm of a cell. **No Keycloak registration page** (accounts are created by the core, §9.1); e-mail as username; browser flow **passkey (no username asked first), or e-mail + password + TOTP on one page**; an account without a second factor is **refused**, never enrolled at login (§9.2); apps `civora-web`, `civora-mobile` (public, PKCE S256, audience `civora-core`); resource server `civora-core`; confidential service client `civora-core-provisioner` (user management only); relying-party template `rp-example-agency` (disabled) with a **pairwise subject**; realm name translated (ar, fr, en) |
| `infra/keycloak/realms/civora-staff.json` | Staff realm (institution staff and officers): no self-registration; browser flow **password + FIDO2 security key, always**; an account without a key is refused; user verification required; **attestation verified** (`direct`) against the vendor roots of the approved models (§9.3); `tenant_id` declared in the user profile, administrators only, UUID-validated, mapped into `civora-workspace` tokens |
| Both realms | Password grant refused realm-wide (deny flow; built-in `admin-cli` password grant off); 5-minute access tokens; rotated refresh tokens; lockout after 5 failures (temporary, up to 15 min); no offline tokens by default; locales ar (default), fr, en; TOTP HmacSHA1 / 6 digits / 30 s, replayed code refused; required-action order: **second factor before password** |
| `infra/keycloak/apply-realm-policy.py` | Post-import policy (idempotent): default roles, PKCE on built-in clients, pairwise salts; and per deployment: e-mail relay (`--smtp-host`), approved security-key models (`--approved-keys`), provisioner secret regenerated into a 0600 file (`--provisioner-secret-out`, never in Git). Exports the live realm |
| `infra/keycloak/approved-keys/test-virtual-authenticator.json` | TESTS ONLY: the Chromium virtual authenticator's model, used by the realms test |
| `infra/scripts/check-realm-security.py` | Realm conformance: profiles `dev`, `citizens`, `staff`; `--live`; `--require-approved-keys`; login flows evaluated per account state (§3) |
| Core: `POST /v1/registrations` | Citizen registration with one answer for every address (§9.1): `RegistrationsController`, `RegistrationService`, `KeycloakCitizenDirectory` (admin API as `civora-core-provisioner`), migration `iam.registration_request` + `iam.registration_permit()` (one activation e-mail per address per 15 min; SHA-256 digest only, kept one day) |
| Core: locales | A Keycloak language in a token (`ar`, `fr`) is stored as the pack locale (`ar-TN`, `fr-TN`); before, `fr` was stored although `PATCH /v1/me` refuses it (§5 D9) |
| Core: `OIDC_JWKS_URL_<REALM>` | Keys fetched inside the cell when the public issuer differs |
| Gateway (`infra/tests/api-gateway/routes.yaml`) | Keycloak's public endpoints through APISIX: login submissions 20/min per client address, token endpoint 60/min, other pages 300/min; **Keycloak's admin API not routed**; `/v1/registrations` public, 10 per 10 min per client address (§9.4) |
| `infra/k8s/keycloak/keycloak.yaml` | Truststore `keycloak-attestation-roots` (vendor roots of the approved key models) |
| `infra/tests/keycloak-realms/` | `run.sh`, `login.cjs`, `attestation-root.cjs`: file checks → import → policy → live checks → journeys in ar, fr and en → security checks (§4). Nightly job `identity-realms` |
| Dev cell | Keycloak 26.8.1 with both realms, policy, live checks; mail catcher (mailpit v1.33.0, pinned) for activation e-mails; core as `civora_core_app`, trusting the realms, registration enabled through the provisioner |

## 2. Realm design

| | Citizens (`civora-citizens`) | Staff (`civora-staff`) |
|---|---|---|
| Who | Citizens using CIVORA services in one country cell | Staff of the institutions (tenants) of the cell; officers |
| Account creation | `POST /v1/registrations` (the core): account with **no credential**, activation link by e-mail | Tenant administrator's invitation (week 3 API): account with no credential, invitation link by e-mail |
| First credentials | Only from the link: e-mail verified, **TOTP, then password** | Only from the link: e-mail verified, **security key (approved model), then password** |
| Login | Passkey (discoverable, user verification), or e-mail + password + TOTP on one page | Password and FIDO2 security key (user verification) |
| Account without its second factor | Refused ("not activated yet") | Refused ("no enrolled security key") |
| What a password alone gets | Nothing | Nothing |
| Tenant | None: a citizen token with `tenant_id` is refused by the core | `tenant_id` from an admin-only attribute; required and validated by the core |
| Subject seen by third parties | Pairwise per relying party (P3-A3) | Not applicable |
| Account console | View profile, manage own passkeys/OTP | View profile only |

## 3. Conformance checking: the flow is evaluated per account state

`check-realm-security.py` answers: *can someone holding only these credentials complete the login, against an
account that has these credentials?* Keycloak semantics: REQUIRED steps must all pass (ALTERNATIVE ones are then
ignored), else one ALTERNATIVE must pass; a CONDITIONAL sub-flow runs only when its conditions hold ("user
configured", "sub-flow executed"). A REQUIRED second factor the account does not have counts as **passed** when
Keycloak would enrol it at login (its required action is enabled): whoever is at the login page enrols their own.
This is the first-enrolment weakness, so every account state is checked (password only, password + TOTP, password +
passkey, passkey only, no credential). Unknown authenticators or conditions are violations.

Run on the week-2 realms (from Git), the checker now reports exactly the open findings: a password alone completes
the login of an account holding only a password (both realms) or password + passkey (citizens); the citizens' flow
asks for the username alone first; Keycloak self-registration is on. The new realms pass.

| Profile | Rules (beyond the common ones: TLS, lockout ≤ 5, password policy, 5-min tokens, rotated refresh, no implicit flow, no password grant, PKCE, no wildcard redirects, no passwords in files, direct-grant flow denies, no offline tokens by default) | Negative controls |
|---|---|---|
| `dev` | No self-registration | 9 |
| `citizens` | Password alone fails for every account state; passkey alone and password + TOTP succeed; no username-only step; Keycloak self-registration off; e-mail verification on; service client confidential, service account only, user-management roles only; no `tenant_id` in citizen tokens; pairwise subjects for relying parties; `--live`: pairwise salts present | 22 (23 live) |
| `staff` | No login without a security key for any account state; password + key succeeds; user verification required; attestation verified; `--require-approved-keys`: approved models listed; `tenant_id` admin-only, UUID-validated, in tokens; no self-registration | 20 (21 live) |

## 4. Test evidence (local runs, 21 Nov 2026)

`infra/tests/keycloak-realms/run.sh`: Keycloak 26.8.1, PostgreSQL 16, mailpit v1.33.0, the core from the local build
as `civora_core_app`, Chromium (Playwright 1.63.0) with WebAuthn virtual authenticators. **All checks passed**
(about 170 s): 3 realm files, 2 live realms, 45 journey checks (15 per language) and 26 security checks.

**Journeys, in Arabic, French and English (15 checks each):** registration answered 202; activation e-mail received
with its subject in the language; account created **without any credential**; activation pages in the language
(`lang`, `dir=rtl` for Arabic); **TOTP asked before the password**; after activation: password + OTP, e-mail
verified; login page in the language (realm name, button, no placeholder in the title); password + TOTP login; core
accepts the token and stores the pack locale (`ar-TN`, `fr-TN`, `en`); passkey added from the app; **passkey alone
signs in without typing a username**; officer invitation e-mail in the language; **security key asked before the
password**, approved model accepted; staff login page in the language; password + key → token with `tenant_id`,
core 200, locale stored.

| # | Security check | Result |
|---|---|---|
| E1 | Registration: identical status, body and type for a new, a pending (twice) and an activated address; answers in 2–3 ms (work done after the answer); activated address: no e-mail; pending address asked twice: one e-mail; malformed address: 400 | ok |
| E2 | Login: unknown address vs existing account + wrong password: same status and message; median answer time 114 ms vs 130 ms (Keycloak hashes a dummy password for unknown users) | ok |
| E3 | Account locked after 5 wrong passwords; a locked account answers exactly like an unknown address | ok |
| F1 | Citizen with a password but no second factor (e.g. set by an administrator by mistake): refused, no TOTP enrolment offered, no code | ok |
| F2 | Officer with a password but no key: refused, no key enrolment offered, no code | ok |
| F3 | An activation link works once | ok |
| A1 | Staff realm: attestation `direct`, approved list = the test model | ok |
| A2 | A key whose model is not on the approved list is refused at enrolment; the password step is never reached (Keycloak: "Not acceptable authenticator model (based on the AAGUID)") | ok |
| C5–C6 | Password + wrong TOTP refused; current TOTP completes | ok |
| C7, S5 | Password grant refused in both realms (app clients and `admin-cli`), and by the realm for a client misconfigured to allow it | ok |
| S4 | Officer password without the enrolled key: no code; forged WebAuthn assertion rejected | ok |
| C8 | Pairwise subjects: relying party without a salt gets no token (fails closed); policy salts it; A ≠ internal id, stable, B different | ok |
| K1–K2 | Core refuses a token from an untrusted realm and a request without a token | ok |

**Gateway** (`infra/tests/api-gateway/run.sh`, APISIX 3.19.0 in front of Keycloak and the core, 18/18 ok): login
submissions for 20 **different accounts** from one client passed on, the 21st refused (429); token endpoint: 61st
request in a minute refused; Keycloak admin API and console: 404 at the gateway; discovery served; registration: 10
in 10 minutes, the 11th refused; plus the 13 Phase 2 checks.

**Core:** 56 tests (registration paths with a fake directory: new, pending, activated, rate-limited, identity
provider down without logging the address, answer before work; locale mapping; configuration rules; end to end on
PostgreSQL: `fr` stored as `fr-TN`, registration 503 when not configured, `registration_permit` allows one send and
the application role cannot read the table). Whole suite 74/74; OpenAPI 9 paths / 11 operations; module boundaries pass.

## 5. Defects found by these tests, and what was done

| # | Defect | Found by | Fix | Now tested by |
|---|---|---|---|---|
| D1 | **FIDO2 bypass**: an officer's password alone obtained a token through Keycloak's built-in `admin-cli` (password grant) | Live probe | Deny flow for direct grants in every realm; `admin-cli` password grant off | C7, S5; checker |
| D2 | Default roles granted `offline_access`, `uma_authorization` and, to staff, `manage-account` | Live check | Policy removes them | Live check |
| D3 | Built-in `account` client: public, code flow, no PKCE | Live check | Policy requires PKCE | Live check |
| D4 | Pairwise mapper without a salt (import and admin API): Keycloak refuses tokens | Live check, C8 | Policy has Keycloak generate the salt | C8; live rule |
| D5 | Attestation `direct` without trust anchors rejected every key | S1 | First set to `none` (week 2); now `direct` with vendor roots and an approved list (§9.3) | A1, A2, journeys |
| D6 | Checker treated unknown authenticators as impassable | Negative control | Unknown authenticators are violations | Negative controls |
| D7 | Test race in the forged-assertion check | Repeated run | Deterministic | Nightly 17 |
| D8 | The browser tab title showed the raw placeholder `${civoraRealmName}` (Keycloak resolves it in the page header only) | Arabic page inspection | Plain `displayName` ("CIVORA") for titles and e-mails, translated name in the header | Journey check "no placeholder in the title" |
| D9 | A token locale `fr` was stored as `fr`, a value `PATCH /v1/me` refuses (pack locales are `ar-TN`, `fr-TN`, `en`) | Language work | Mapped onto the pack before storing | Unit + e2e; journeys |
| D10 | Activation without `VERIFY_EMAIL` left the address unverified and Keycloak sent a second verification e-mail at the end | Probe | The link carries `VERIFY_EMAIL`: the link itself proves the address | Journey check "e-mail verified by the link" |
| D11 | Checker over-reported: a missing factor in an ALTERNATIVE step was counted as enrolled at login (Keycloak only enrols REQUIRED steps) | Running the checker on the week-2 realms | Enrolment counted for REQUIRED steps only | Week-2 realms report only real findings |

## 6. Findings and residual risks

| # | Finding | Status |
|---|---|---|
| R-P3-1 | Account enumeration | **Closed** (§9.1): no username-only step, no Keycloak registration page, one registration answer, identical login answers including locked accounts (E1–E3) |
| R-P3-2 | The citizens' login page shows e-mail + password first; the passkey is under "Try another way" | Open, low (usability). Week 3–4: evaluate Keycloak's passkey autofill on the login form; the app can also start directly on the passkey step |
| R-P3-3 | First enrolment | **Closed** (§9.2): no credential before the link; second factor before password; login refuses accounts without their second factor (F1–F3) |
| R-P3-4 | Pairwise salts live only in Keycloak's database | Open (operations): rebuild a cell's Keycloak by restoring its database, never by re-importing; backup scope confirmed in the week-6 recovery review |
| R-P3-5 | Officer key models not restricted | **Closed as a mechanism** (§9.3): attestation verified, approved list enforced (A1, A2); fails closed until the deployment supplies the approved models and their vendor roots — **founder decision: which key models** |
| R-P3-6 | Credential stuffing across accounts | **Closed at the gateway** (§9.4), provided Keycloak's public endpoints are reachable only through the gateway (deployment rule). Breached-password screening: evaluation, week 5 |
| R-P3-7 | Lockout as denial of service | Open, low: temporary lockout only (at most 15 min); the gateway limit also slows mass lockouts |
| R-P3-8 | Registrations that are never activated leave accounts without credentials (they cannot sign in; the link expires after 12 h; asking again re-sends it) | New, low: cleanup of accounts unactivated after 24 h, week 3 |
| R-P3-9 | Activation and invitation e-mails need a mail relay in each cell | New, external: provider choice for staging/pilot (no relay in Git; `--smtp-host` per deployment, relay password from Keycloak's vault) |
| R-P3-10 | An address that is already active receives nothing when registered again (no "you already have an account" e-mail) | New, low (usability): a notification e-mail sent by the core is possible once a relay exists (R-P3-9) |

## 7. Specification status

| Item | Status | Evidence / remaining |
|---|---|---|
| P3-A1 realms per cell | **Done** | §4; staging import with the cell deployment |
| P3-A3 pairwise subject IDs | **Done** | C8; R-P3-4 |
| P3-F1 passkeys, TOTP | **Done**; SMS fallback open (Q3-1) | Journeys, C5–C6 |
| P3-SEC5 officers require FIDO2 | **Done**, approved models enforced (founder chooses the models) | Journeys, A1–A2, F2, S4–S5 |
| P3-SEC3 brute force / credential stuffing | **Done**: per account (lockout) and per client (gateway) | E3, gateway 7.x; R-P3-6 |
| P3-T2 auth-flow E2E | **Partial**: realm flows in ar/fr/en with real WebAuthn and e-mail; app UI in week 4; Detox needs the mobile shell (Q3-3) | §4 |
| P3-AC1 all auth flows E2E in AR/FR/EN | **In progress**: realm flows pass in all three; app screens in week 4 | §4 |

## 8. How to run

```sh
pnpm install && pnpm build                       # the core is started from the local build
infra/tests/keycloak-realms/run.sh               # docker, python3, node 22, Playwright with Chromium; LOCALES=ar,fr,en
infra/tests/api-gateway/run.sh                   # needs the civora-core:dev image
python3 infra/scripts/check-realm-security.py infra/keycloak/realms/civora-staff.json --profile staff --self-test
infra/scripts/dev-cell-up.sh --fresh             # dev cell; activation e-mails at http://localhost:8025
```

## 9. Closing the five open findings (21 Nov 2026, second pass)

### 9.1 Account enumeration (R-P3-1)

- **Login:** the citizens' flow no longer asks for the username alone. The first page takes e-mail and password
  together (or the passkey, which needs no username). Unknown address, wrong password and locked account all answer
  "Invalid username or password" with the same status; timing is equal within noise (E2, E3).
- **Registration:** Keycloak's registration page said "Email already exists"; it is off. `POST /v1/registrations`
  answers `202 {"status":"accepted"}` before anything is looked up, then works in the background: new address →
  account without credentials + activation link; pending address → link sent again; active address → nothing. At most
  one e-mail per address per 15 minutes (database function, digest only) and 10 requests per 10 minutes per client
  address at the gateway (E1, gateway 7).

### 9.2 First enrolment (R-P3-3)

- Accounts are created with **no credential** (citizens by the core, staff by the tenant administrator's invitation).
- First credentials come only from the e-mailed one-time link (12 h): `VERIFY_EMAIL`, then the **second factor**,
  then the **password** — Keycloak orders the steps by realm priority whatever the request says (tested with the
  password listed first). An activation abandoned half-way never leaves a password without a second factor.
- The login flow **refuses** an account without its second factor instead of enrolling one ("Condition – user
  configured" + "Condition – sub-flow executed" + "Deny access"). The checker models this per account state, and
  reports the week-2 realms as failing it.

### 9.3 FIDO2 attestation and approved keys (R-P3-5)

- Staff realm: attestation `direct`; Keycloak verifies the key's attestation certificate against its truststore
  (`conf/truststores`; in Kubernetes the secret `keycloak-attestation-roots`) and accepts only models on the
  approved AAGUID list (`apply-realm-policy.py --approved-keys`).
- Fails closed: with no vendor root, no key can be enrolled ("invalid cert path", D5); with a root but a model off the
  list, the key is refused (A2).
- Test: the Chromium virtual authenticator's attestation certificate plays the vendor root (extracted at run time,
  test only). **Founder action: choose the officer key models**; their AAGUIDs and vendor roots (FIDO Metadata Service)
  then go into the staging and pilot configuration.

### 9.4 Credential stuffing (R-P3-6)

- APISIX limits Keycloak's login submissions (20/min) and token endpoint (60/min) per client address, on top of
  Keycloak's lockout per account; the admin API is not routed. Tested with 20 different accounts from one client.
- Trade-off: carrier-grade NAT puts many citizens behind one address; limits sized for that, to be reviewed with
  pilot traffic. Deployment rule: Keycloak's public endpoints only through the gateway (no other ingress).

### 9.5 Languages

- Every journey runs in Arabic, French and English: pages (`lang`, `dir`), realm names, buttons, activation and
  invitation e-mails, and the locale stored by the core. Two defects found and fixed (D8 title placeholder, D9 locale
  mapping). The UI uses Keycloak's Arabic translation (Modern Standard Arabic, as for official texts); the cell's
  locale is `ar-TN`.
