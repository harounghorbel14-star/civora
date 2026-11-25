# 11 — Security verification (Phase 3, week 5): ASVS 5.0 L3, rate limits, negative tests, mandate scopes, languages

| | |
|---|---|
| Specification items | P3-SEC1 ASVS L3 · P3-SEC2 rate limits · P3-T3 negative tests · P3-T4 mandate-scope authorisation tests · P3-AC1 all authentication flows end to end in Arabic, French and English |
| Standard | OWASP Application Security Verification Standard **5.0.0**, requirement list read from the OWASP repository (`5.0/docs_en/OWASP_Application_Security_Verification_Standard_5.0.0_en.csv`, SHA-256 `98c8fe91…cf680`, 345 requirements). ASVS is © OWASP, CC BY-SA 4.0; the subjects below are our own short wording, the identifiers are ASVS's |
| Who assessed | The engineering team (self-assessment against code, configuration and test runs). It is **not** an external verification; the internal security review (P3-AC2, week 6) and an external test before the pilot (pilot gate PG-8) follow |
| Status | Assessment and fixes done on 22 Nov 2026; run results in §9 |

## 1. Scope and result

The identity system of Phase 3 is assessed against **every requirement of levels 1 to 3** in the chapters that cover
it: V6 Authentication, V7 Session Management, V8 Authorization, V9 Self-contained Tokens, V10 OAuth and OIDC, and V3
Web Frontend Security for the citizen web app. That is **153 of ASVS's 345 requirements**. The other chapters (V1
encoding, V2 business logic, V4 API, V5 files, V11 cryptography, V12 TLS, V13 configuration, V14 data protection, V15
secure coding, V16 logging, V17 WebRTC) concern the whole platform and its later modules; they are assessed for the
whole application before the pilot (PG-8), not here.

| Chapter | Requirements (L1–L3) | Met | Met, deviation documented | Partial | Gap | Not applicable |
|---|---|---|---|---|---|---|
| V6 Authentication | 47 | 37 | 2 | 4 | 1 | 3 |
| V7 Session Management | 19 | 16 | 1 | 2 | 0 | 0 |
| V8 Authorization | 13 | 9 | 0 | 3 | 1 | 0 |
| V9 Self-contained Tokens | 7 | 7 | 0 | 0 | 0 | 0 |
| V10 OAuth and OIDC | 36 | 26 | 0 | 1 | 5 | 4 |
| V3 Web Frontend Security | 31 | 26 | 0 | 1 | 1 | 3 |
| **Total** | **153** | **121** | **3** | **11** | **8** | **10** |

**Met (including documented deviations): 124 of 143 applicable requirements (86.7 %)** after week 6 (121 at the end
of week 5). The assessment itself is complete; the identity system does **not yet** meet ASVS L3 in full. The open
items are 8 gaps (G1 in part, G3–G5 in §4) and 11 partial items, each with an owner and a plan. Week 6 closed G2
(account recovery: V6.4.3, V6.4.4), half of G1 (notices: V6.3.7 now partial) and verified V6.8.3 (SAML replay refused). Found and fixed during the assessment (all tested, §9):

| Fixed | ASVS |
|---|---|
| Password deny list: 47,200 common and breached passwords of 12+ characters, case-insensitive (`infra/keycloak/password-deny-list`) | V6.2.4, V6.2.12 |
| Context words refused anywhere in a password (CIVORA, Tunisia, government, citizen, password… in Arabic, French and English; documented list) | V6.1.2, V6.2.11 |
| `notContainsUsername` added to the policy | V6.2 |
| Ending a session needs a recent sign-in; new `DELETE /v1/me/sessions` ends every other session | V7.5.2, V7.4.3 |
| Web app: cross-site requests other than plain links refused (`Sec-Fetch-*`); CSP violation reports to `/csp-report` (origins only, no path or query); HSTS on https | V3.5.8, V3.4.7, V3.4.1 |
| A replayed authorization code also revokes what its first exchange issued: verified (N19) | V10.4.2 |
| Anonymous dynamic client registration refused in both realms: verified (N22) | V10.4.7 |

## 2. Documentation ASVS asks for

### 2.1 Authentication pathways (V6.1.3, V6.3.4)

| Who | Pathway | Factors | Where it is enforced |
|---|---|---|---|
| Citizen | Passkey | Device-bound key with user verification (possession + biometric or PIN) | realm flow `citizens-browser`; checker |
| Citizen | Password + TOTP | Knowledge + possession (deviation D1) | same flow, `citizens-otp` sub-flow |
| Staff, local account | Password + FIDO2 security key | Knowledge + phishing-resistant hardware | `staff-browser`; approved key models only |
| Staff, institution | Institution SSO (OIDC or SAML) + FIDO2 security key | The institution's sign-in + CIVORA's hardware key | first/post broker login flows (doc 07) |
| Anyone | Nothing else | — | direct grants disabled; implicit disabled; anonymous client registration refused; e-mail only for activation links |

The identity link (simulated eID, doc 06) and the customer status page (one-time code to the contact on file, doc 09)
are not sign-ins: the first proves an identity for an existing account, the second shows one case status.

### 2.2 Sessions (V7.1.1–V7.1.3)

| | Citizens | Staff | Why |
|---|---|---|---|
| Inactivity | 15 min (Keycloak); web app 30 min but never beyond the Keycloak session | 30 min | NIST SP 800-63B: AAL2 allows up to 1 h idle, AAL3 15 min; staff use phishing-resistant keys |
| Absolute | 8 h | 8 h (SSO aligned, doc 07) | one working day |
| Concurrent sessions | No limit | No limit | People use several devices; every session is listed to its owner, who can end any or all others |
| Re-authentication | Sensitive actions need a sign-in younger than 5 min (step-up, RFC 9470) | same; administration too | doc 04 |
| Federation | — | Institution SSO is followed by the CIVORA key at every sign-in; disabled at the institution ⇒ no token | doc 07 |

### 2.3 Contextual attributes in decisions (V8.1.3, V8.1.4)

| Attribute | Used for | Threshold | Action |
|---|---|---|---|
| Sign-in time (`auth_time`) | Sensitive actions | older than 5 min | `401 insufficient_user_authentication` with `max_age`: re-authenticate |
| Sign-in method (`acr`) | Sensitive actions | `0` (single sign-on reuse) | same as above |
| Failed sign-ins per account | Lockout | 5 failures | wait, growing to 15 min; never permanent |
| Client address | Rate limits (§5) | per route | `429` |
| Mandate state and scopes | Acting on behalf (Cedar, §7) | active, not expired, scope covers the action | allow; otherwise deny |
| Tenant | Every staff request | the token's tenant | row-level security, Cedar F1 |

Nothing else is used: no location, device posture or time-of-day rules yet (gap G3).

### 2.4 Browser features the web app relies on (V3.1.1)

HTTPS with HSTS, cookies with `SameSite=Strict` and the `__Host-` prefix, Content Security Policy level 3 (nonces,
`strict-dynamic`), `Sec-Fetch-*` metadata, `Cross-Origin-Opener-Policy`. Passkeys need WebAuthn; without it the
password + authenticator app path remains. Pages work without JavaScript (forms and server actions).

## 3. Documented deviations

| | Requirement | Deviation | Rationale and compensating controls |
|---|---|---|---|
| D1 | V6.3.3 (L3: one factor phishing-resistant hardware) | Citizens may sign in with password + TOTP instead of a passkey | Inclusion (P3-RISK): not every citizen has a device with a platform authenticator, and assisted use (relatives, public counters) must remain possible. Controls: passkey offered first; TOTP codes single use; lockout and per-address limits; deny list; sensitive actions need a fresh sign-in; the core sees `acr` and can demand stronger methods per action later; notifications (G1) |
| D2 | V6.5.5 (TOTP lifetime 30 s) | One 30-second step of clock tolerance | Phone clocks drift; RFC 6238 §5.2 recommends allowing one step. Codes are single use, lockout after 5 failures |
| D3 | V7.4.1 (terminated sessions unusable) | Self-contained access tokens stay valid until they expire (5 min) after sign-out or role changes (also V8.3.2) | The web app keeps tokens on the server and deletes them at sign-out, so nobody holding the browser can use them; refresh tokens are revoked at once (N10); 5-minute lifetime; mandates and memberships are read from the database at every request |

Design notes (not deviations): the minimum password length is 12 (ASVS: at least 8, 15 recommended) because every
password account also has a second factor and the deny list; the breached-password set is local, refreshed with each
release, so no hash prefix of a citizen's password ever leaves the country. **SMS and L3:** P3-F1 asks for an SMS
fallback, ASVS L3 (V6.6.1) forbids phone or SMS as an authentication option. Proposal for week 6: SMS is never a
sign-in factor; it is a delivery channel only (status page codes, notifications), simulated until Q3-1.

## 4. Gaps and plan

| | ASVS | Gap | Plan |
|---|---|---|---|
| G1 | V6.3.5, V6.3.7 | No notification of suspicious sign-ins; changes on Keycloak's own pages send no notice | **Partly closed in week 6** ([doc 12 §2](12-recovery-notices-sms-pairwise.md)): notices after recovery and after removing a way to sign in. Open: Keycloak sign-in events (with G3) |
| G2 | V6.4.3, V6.4.4 | No account recovery | **Closed in week 6** ([doc 12 §1](12-recovery-notices-sms-pairwise.md)): re-proofing at the (simulated) eID at the level of the identity link, tested in three languages |
| G3 | V8.2.4 (and part of V8.4.2) | No adaptive controls (new device, location, time) | Design in week 6 (signals → step-up and notification); implementation before the pilot (PG-8) |
| G4 | V10.3.5, V10.4.12–V10.4.14, V10.4.16 | The web app is a public client with PKCE: no pushed authorization requests (PAR), no sender-constrained tokens (DPoP), no `private_key_jwt` | Week 6: the web app as a confidential client with `private_key_jwt`, PAR required, DPoP-bound tokens checked by the core (Keycloak 26 supports all three); the mobile app with its build |
| G5 | V3.7.4 | The production domain is not on the HSTS preload list | Needs the production domain (founder decision); before the pilot (PG-8) |


## 5. Rate limits: every endpoint reviewed (P3-SEC2)

Edge limits are per client address (`infra/tests/api-gateway/routes.yaml`, the source of the production routes); they
allow for carrier-grade NAT. Application limits are per person, account, reference or code. A new gateway check fails
if any route is declared without a limit.

| Endpoint | Edge limit (per address) | Application limit | Note |
|---|---|---|---|
| Keycloak sign-in pages (`/realms/*/login-actions/*` POST) | 20 / min | lockout after 5 failures per account, waits up to 15 min | credential stuffing (P3-SEC3) |
| Keycloak token endpoint | 60 / min | refresh rotation, code single use | |
| Other Keycloak public paths (discovery, keys, auth, logout) | 300 / min | — | admin API and console not routed (404) |
| Keycloak static resources | 600 / min (**new**) | — | about 15 per sign-in page |
| `GET /health` | 60 / min (**new**) | — | probes inside the cell reach pods directly |
| `POST /v1/registrations` (public) | 10 / 10 min | e-mails per address bounded by the core | same answer for every address |
| `POST /v1/status-access`, `…:verify` (public) | 20 / 10 min | 3 codes per reference per 15 min; 5 tries per code; 10-min codes | |
| `/v1/*` with a token (all other core endpoints, 27 operations) | 20 / min, token required at the edge | identity links: 5 attempts per person per hour; step-up on sensitive actions | |
| Web app: `/auth/login`, pages, server actions, `/csp-report` | edge route for the web app comes with ADR-030 (PG-8) | **pending sign-ins bounded** (10,000, oldest first; **new**); expired sessions swept; report bodies ≤ 8 KB, ≤ 10 reports per request | |

Findings: (1) the web app's pending sign-ins had no bound: a flood of `/auth/login` could exhaust memory, **fixed** and
unit tested; (2) `/health` and Keycloak's static resources had no edge limit, **fixed**; (3) limits on authenticated
endpoints are per address only, so one person could create many mandates or a tenant administrator many invitations
(e-mails) within 20 requests a minute: **R-P3-15, low**, per-person and per-tenant quotas in week 6; (4) the web app's
own edge limits wait for the edge gateway decision (ADR-030), recorded in PG-8.

## 6. Negative tests (P3-T3)

`infra/tests/keycloak-realms/negative.cjs`, against the real realms, the core and the web app:

| # | Attack | Expected and checked |
|---|---|---|
| N1, N2 | Session fixation at Keycloak and at the web app | planted cookies give nothing; a chosen session id is replaced at sign-in and is not a session |
| N3, N19 | Authorization code replay | the second exchange is refused, and the refresh token of the first exchange is revoked |
| N4, N5 | PKCE missing, wrong, or downgraded to `plain` | refused |
| N6, N7, N16 | Redirect URI tampering, open redirect | unregistered URI never receives the browser; a code bound to its URI; foreign `returnTo` ends on the app |
| N8 | Implicit flow | refused |
| N9, N10 | Refresh token reuse; use after sign-out | refused |
| N11, N12, N13 | ID token as access token; altered claims; citizen token on staff endpoints | 401, 401, 403 |
| N14, N15 | Login CSRF; forged OAuth callback | no code; no session |
| N17 | Framing (clickjacking) | Keycloak same origin only; web app never |
| N18 | CORS from another origin | no grant |
| N20 | Cross-site sub-resource, frame and form-post requests to the web app | 403; a plain link still works |
| N21 | CSP violation reporting | header present; reports accepted; anything else refused |
| N22 | Anonymous dynamic client registration | refused in both realms |

Together with the earlier checks (doc 03: forged WebAuthn assertion, TOTP replay, password grant; doc 09: CSRF on
server actions, new session id at every sign-in, no token in the browser).

## 7. Mandate scopes with Cedar (P3-T4)

The mandate rules are Cedar policies (`packages/policies`, Cedar 4.14.0 as decided in ADR-006): 22 generated policies
(`policies/mandates.cedar`, regenerated and checked in CI) next to the platform policies of the Phase 2 spike, all
validated **strictly** against the schema at load time; the core refuses to start without them (fail closed).

| Rule | Meaning |
|---|---|
| M1 | A person acts on their own records, but not while acting under a mandate |
| M2 | An agent acts on the principal's records only under an **active** mandate whose agent is them, whose principal owns the record, whose scope names the record's domain at a sufficient level (manage ⊇ submit ⊇ read) |
| F3 | Identity and mandates are never delegated (`identity:manage`, `mandates:manage` while acting: forbidden) |
| F1 | Tenants stay apart (platform policies) |

Tests (`pnpm --filter @civora/policies test`, 13): the spike's 24 platform decisions; 20 mandate decisions; every
mandate action denied without a relation; and **8 negative controls**: each weakened policy set (identity delegated,
inactive mandates, any agent, owner not checked, domain not checked, read covering submit, own rules while acting,
tenant isolation removed) must flip at least one decision, so every rule is shown to be tested. The forbid rules hold
against mistaken permits. In the core, `GET /v1/mandates/{id}/permissions` answers from the same engine; the end-to-end
test checks that the agent of a `cases:read` + `payments:submit` mandate gets exactly those actions, never identity,
that the principal and others get nothing, and that revocation removes everything.

## 8. Every flow in Arabic, French and English (P3-AC1)

| Flow | Where tested | Languages |
|---|---|---|
| Citizen registration, activation (TOTP then password), sign-in, passkey | realms run, journeys | ar, fr, en |
| Officer invitation (key then password), sign-in | realms run, journeys | ar, fr, en |
| Staff invitation through the core: e-mail, activation pages, first sign-in, unit role | organisation checks (**new**) | ar, fr, en |
| Institution SSO first sign-in: CIVORA's key enrolment page | SSO checks (**new**) | ar, fr, en |
| Web app sign-in, preferences, security page, status page, sign-out | web app checks | ar, fr, en |
| Web app: add a passkey, step-up removal, new session id | web app checks (**now in every language**) | ar, fr, en |
| Web app: mandate given, accepted, acting, history, revocation | web app checks (**now in every language**) | ar, fr, en |
| Web app: identity link through the simulated eID | web app checks (**now in every language**) | ar, fr, en |
| eID simulator pages | eID checks | ar, fr, en |

## 9. Test evidence

All on 22 Nov 2026, local runs (GitHub results in [01 — Progress](01-progress.md)):

| Run | Result |
|---|---|
| Realms run (`infra/tests/keycloak-realms/run.sh`): Keycloak 26.8.1 with the deny list mounted, the core as `civora_core_app`, the web app, Chromium with virtual authenticators | **254 checks, all passed** (966 s): realm files 3, live realms 2, journeys and security 72 (new: password policy), sessions, authenticators and step-up 24 (new: "sign out everywhere else", old sign-in refused), organisation 33 (new: an invitation in each language), SSO 22 (new: first sign-in in each language), web app 58 (passkey, step-up, mandates, eID now in each language), negative 22, eID 18 |
| Gateway (`infra/tests/api-gateway/run.sh`) | 20/20 (new: every route limited) |
| Dev cell from scratch (`infra/scripts/dev-cell-up.sh --fresh`) | 17/17 in 134 s; the deny list mounted in Keycloak |
| Unit and database tests (`pnpm test`, PostgreSQL 16) | 154: core 99, web 24 (new: bounded pending sign-ins, session sweep), policies 13, other packages 18 |
| Realm checker | new rules and negative controls: deny list, context words |

Found on the way (test harness, not product defects): adding a passkey after the three language journeys needs
"confirm it is you" first, because the sign-ins are older than the step-up limit (the test now goes through it); a
second device signing in with the authenticator app waits for a new 30-second code (codes are single use), so the
sessions checks re-authenticate the first device with its passkey; Node's `fetch` adds its own `Sec-Fetch-Mode`, so
the resource-isolation check uses raw HTTP requests as a browser would send them.

## Appendix: every requirement in scope

Status key: Met; Met, deviation documented (§3); Partial; Gap (§4); Not applicable.

### V6 Authentication

| Requirement | Level | Subject (our wording) | Status | Evidence |
|---|---|---|---|---|
| V6.1.1 | L1 | Anti-automation documented | Met | doc 03 §4 E3 (lockout: 5 failures, waits up to 15 min, no permanent lockout, so no malicious lockout) and gateway limits (§5 of this doc) |
| V6.1.2 | L2 | Context-specific word list documented | Met | `infra/keycloak/password-deny-list/context-words.txt` (Arabic, French, English) |
| V6.1.3 | L2 | All authentication pathways documented | Met | §2: passkey; password + TOTP; staff password + security key; institution SSO + security key; nothing else (realm checker evaluates the flows, doc 03 §3) |
| V6.2.1 | L1 | Password length at least 8 (15 recommended) | Met | `length(12)`; see §3 design notes for 12 rather than 15 |
| V6.2.2 | L1 | Users can change their password | Partial | Keycloak action `UPDATE_PASSWORD` exists; the security page does not offer it yet (W6 with recovery) |
| V6.2.3 | L1 | Change needs current and new password | Partial | Keycloak asks for a fresh sign-in (password) when the sign-in is older than its limit, not always the current password (W6) |
| V6.2.4 | L1 | Checked against top passwords | Met | `passwordBlacklist(civora-deny.txt)`: 47,200 entries of 12+ characters from public lists (incl. the NCSC top 100k); realms run check |
| V6.2.5 | L1 | No composition rules | Met | policy has none (length, history, deny list, context words only) |
| V6.2.6 | L1 | Password fields masked | Met | Keycloak pages (`type=password`) |
| V6.2.7 | L1 | Paste and password managers allowed | Met | Keycloak pages; no blocking script |
| V6.2.8 | L1 | Password verified exactly as entered | Met | Keycloak; `maxLength(128)` refuses longer passwords instead of truncating |
| V6.2.9 | L2 | At least 64 characters allowed | Met | `maxLength(128)` |
| V6.2.10 | L2 | No periodic rotation | Met | no `forceExpiredPasswordChange` (checker) |
| V6.2.11 | L2 | Context words refused | Met | `regexPattern` negative look-ahead from the documented list; realms run check (Latin and Arabic words) |
| V6.2.12 | L2 | Checked against breached passwords | Met | same deny list (lists derived from breaches); limit: a local set, not the full breach corpus (§3 design notes) |
| V6.3.1 | L1 | Stuffing and brute-force controls implemented | Met | doc 03 §4 E3, gateway 7.x tests |
| V6.3.2 | L1 | No default accounts | Partial | CIVORA realms have none (checker refuses users in realm files); the master realm bootstrap admin must be replaced at installation: checked in the internal review (W6) |
| V6.3.3 | L2 | MFA; L3: phishing-resistant hardware factor | Met, deviation documented | staff: password + FIDO2 key (met); citizens: passkey (met) or password + TOTP (deviation D1) |
| V6.3.4 | L2 | No undocumented pathways | Met | realm checker: browser, direct grant (disabled), first broker login, post broker login flows evaluated; the `admin-cli` password grant defect closed (doc 03 §5) |
| V6.3.5 | L3 | Notify of suspicious attempts | Gap | G1 |
| V6.3.6 | L3 | E-mail not an authentication factor | Met | no magic links, no e-mail reset (`resetPasswordAllowed=false`); e-mail only carries the one-time activation link |
| V6.3.7 | L3 | Notify after authentication details change | Partial | notices after recovery and after removing a way to sign in (doc 12 §2); not yet for changes on Keycloak's own pages (G1) |
| V6.3.8 | L3 | No user enumeration (incl. registration, recovery) | Met | R-P3-1 tests: same answers and timing for registration and login (doc 03 §9); status page same answer (doc 09) |
| V6.4.1 | L1 | Initial secrets random, short-lived, single use | Met | activation links: Keycloak action tokens, single use (tested), lifetime set by the core |
| V6.4.2 | L1 | No hints or secret questions | Met | none |
| V6.4.3 | L2 | Forgotten password reset keeps MFA | Met | recovery removes every credential and asks for the authenticator app again before a new password; never by e-mail alone (doc 12 §1) |
| V6.4.4 | L2 | Lost factor: re-proofing at enrolment level | Met | re-proofing at the (simulated) eID at least at the level of the identity link, and at least substantial (doc 12 §1); accounts without a link: assisted recovery at a counter (Phase 6) |
| V6.4.5 | L3 | Renewal reminders for expiring mechanisms | Not applicable | no authentication mechanism expires |
| V6.4.6 | L3 | Admin-initiated reset without choosing the password | Met | invitations and resets by e-mailed action link; administrators never know a password (doc 05) |
| V6.5.1 | L2 | OTPs usable once | Met | TOTP replay refused (doc 03 §4); status codes single use (doc 09) |
| V6.5.2 | L2 | Low-entropy lookup secrets hashed | Not applicable | no lookup secrets (no recovery codes); one-time codes are stored as keyed digests |
| V6.5.3 | L2 | OTP and seeds from a CSPRNG | Met | Keycloak `SecureRandom`; status codes `crypto.randomInt` |
| V6.5.4 | L2 | At least 20 bits of entropy | Met | 6 random digits |
| V6.5.5 | L2 | Lifetimes: out-of-band 10 min, TOTP 30 s | Met, deviation documented | status codes 10 min (met); TOTP period 30 s with one step of clock tolerance (deviation D2) |
| V6.5.6 | L3 | Any factor can be revoked | Met | `DELETE /v1/me/authenticators/{id}` with step-up; staff keys by the institution administrator (doc 04) |
| V6.5.7 | L3 | Biometrics only as a secondary factor | Met | biometrics only unlock a device-bound passkey (user verification), never alone |
| V6.5.8 | L3 | TOTP checked against a trusted clock | Met | Keycloak server time (nodes synchronised, Phase 2 platform baseline) |
| V6.6.1 | L2 | PSTN OTP rules; L3: no SMS | Met | no SMS or phone factor exists; the SMS fallback of P3-F1 conflicts with L3 and is decided in W6 (§3, SMS and L3) |
| V6.6.2 | L2 | Out-of-band codes bound to their request | Met | status codes bound to the challenge and the reference (doc 09) |
| V6.6.3 | L2 | Out-of-band codes rate limited | Met | 5 tries per code, 3 codes per reference per 15 min, gateway 20 per 10 min per client |
| V6.6.4 | L3 | Push bombing | Not applicable | no push factor |
| V6.7.1 | L3 | Attestation certificates protected | Met | attestation roots in a read-only truststore from a secret (doc 03 §9.3) |
| V6.7.2 | L3 | Challenge nonce at least 64 bits | Met | WebAuthn challenges generated by Keycloak per ceremony (128-bit random) |
| V6.8.1 | L2 | No spoofing across identity providers | Met | doc 07: create-only first sign-in, no linking by e-mail, usernames namespaced by provider; tests |
| V6.8.2 | L2 | Assertion signatures always validated | Met | checker: OIDC `validateSignature`, SAML signed assertions required (negative controls) |
| V6.8.3 | L2 | SAML assertions used once | Met | a captured SAML response replayed from the same browser or another client gives no session and no code (SSO check, week 6) |
| V6.8.4 | L2 | Strength and recency from the IdP verified | Met | the core checks `auth_time`/`acr` (doc 04); SSO always followed by the CIVORA key (doc 07) |

### V7 Session Management

| Requirement | Level | Subject (our wording) | Status | Evidence |
|---|---|---|---|---|
| V7.1.1 | L2 | Timeouts documented and justified | Met | §2: citizens idle 15 min, staff 30 min, both 8 h at most; web app idle 30 min within the realm limits |
| V7.1.2 | L2 | Concurrent sessions documented | Met | §2: no limit; every session listed to its owner and can be ended |
| V7.1.3 | L2 | Federated session controls documented | Met | doc 07 (staff 8 h aligned, key at every SSO sign-in), doc 09 (web app ends the Keycloak session) |
| V7.2.1 | L1 | Session tokens verified by a trusted backend | Met | web app server-side sessions; the core verifies tokens |
| V7.2.2 | L1 | Dynamically generated session tokens | Met | opaque random session id; short-lived JWTs |
| V7.2.3 | L1 | Reference tokens: CSPRNG, 128+ bits | Met | 256-bit random session id (doc 09) |
| V7.2.4 | L1 | New session token at authentication and re-authentication | Met | tested (web app step-up, N2) |
| V7.3.1 | L2 | Inactivity timeout | Met | realm and web app idle limits |
| V7.3.2 | L2 | Absolute session lifetime | Met | 8 h (realm), web app never beyond the refresh token |
| V7.4.1 | L1 | Terminated sessions unusable | Met, deviation documented | web app deletes the session and its tokens; Keycloak revokes the refresh token (N10); self-contained access tokens expire within 5 min (deviation D3) |
| V7.4.2 | L1 | Disabling an account ends its sessions | Partial | Keycloak refuses refreshes for a disabled user; access tokens live up to 5 min; an offboarding test is planned in the internal review |
| V7.4.3 | L2 | Option to end other sessions after a factor change | Partial | `DELETE /v1/me/sessions` ends every other session (new, step-up); the prompt after a change comes with G1 |
| V7.4.4 | L2 | Visible sign-out on authenticated pages | Met | header of every page (doc 09) |
| V7.4.5 | L2 | Administrators can end sessions | Met | Keycloak administration (operators) |
| V7.5.1 | L2 | Re-authentication before changing authentication attributes | Met | step-up on adding and removing authenticators and on identity links; e-mail cannot be changed by users |
| V7.5.2 | L2 | View sessions; end them after re-authentication | Met | sessions API and page; ending needs a recent sign-in (new) |
| V7.5.3 | L3 | Further authentication for highly sensitive operations | Met | RFC 9470 step-up on administration, authenticators, identity links (doc 04) |
| V7.6.1 | L2 | RP/IdP session lifetimes as documented | Met | doc 07 tests (key at every SSO sign-in; disabled at the institution: no token) |
| V7.6.2 | L2 | No session creation without user action | Met | sign-in starts only from the person's action; single sign-on reuse gives acr 0, never counted as a sign-in |

### V8 Authorization

| Requirement | Level | Subject (our wording) | Status | Evidence |
|---|---|---|---|---|
| V8.1.1 | L1 | Function- and data-level rules documented | Met | doc 02 (people, accounts, mandates), doc 05 (units, roles), Cedar policies (`packages/policies`) |
| V8.1.2 | L2 | Field-level rules documented | Partial | responses are allow-listed DTOs; a field-level rule table per endpoint is written with the domain endpoints (Phase 5+) |
| V8.1.3 | L3 | Environmental attributes documented | Met | §2.3: sign-in age and method (`auth_time`, `acr`), client address for rate limits; nothing else is used |
| V8.1.4 | L3 | How contextual factors drive decisions documented | Met | §2.3: thresholds and actions (step-up after 5 min, lockout, rate limits) |
| V8.2.1 | L1 | Function-level access by explicit permission | Met | guards and roles; 403 tests (doc 05, N13) |
| V8.2.2 | L1 | Data-level access (no IDOR/BOLA) | Met | row-level security; non-parties get 404 (doc 02, mandates and sessions tests) |
| V8.2.3 | L2 | Field-level access (no BOPLA) | Met | validation pipe whitelists input; PATCH /v1/me accepts preference fields only |
| V8.2.4 | L3 | Adaptive controls (location, device, time) | Gap | G3 |
| V8.3.1 | L1 | Rules enforced in a trusted layer | Met | core only; the web app has no authorization logic |
| V8.3.2 | L3 | Authorization changes apply immediately | Partial | memberships, mandates and units are read at each request; realm roles in tokens lag up to 5 min (§3 D3) |
| V8.3.3 | L3 | Decisions on the originating subject | Met | the core decides from the person's token; it uses its service account only after checking ownership |
| V8.4.1 | L2 | Cross-tenant controls | Met | tenant in row-level security and Cedar F1; tests |
| V8.4.2 | L3 | Administrative interfaces: layered controls | Partial | FIDO2 for staff, step-up on administration, Keycloak administration not exposed publicly (Phase 2); no device posture check (G3) |

### V9 Self-contained Tokens

| Requirement | Level | Subject (our wording) | Status | Evidence |
|---|---|---|---|---|
| V9.1.1 | L1 | Signature verified before use | Met | core token tests (doc 02) |
| V9.1.2 | L1 | Algorithm allow-list, no none | Met | asymmetric only (RS/PS/ES), `none` and HMAC refused (tests) |
| V9.1.3 | L1 | Keys from trusted pre-configured sources | Met | JWKS URL per configured issuer; header keys (`jku`, `x5u`, `jwk`) ignored |
| V9.2.1 | L1 | exp and nbf verified | Met | expired token test |
| V9.2.2 | L2 | Token type checked | Met | `typ` Bearer only; an ID token is refused (N11) |
| V9.2.3 | L2 | Audience checked | Met | `aud` civora-core (wrong audience test) |
| V9.2.4 | L2 | Audience-restricted tokens per audience | Met | access tokens `aud` civora-core; ID tokens `aud` the client |

### V10 OAuth and OIDC

| Requirement | Level | Subject (our wording) | Status | Evidence |
|---|---|---|---|---|
| V10.1.1 | L2 | Tokens only where needed (BFF) | Met | web app backend-for-frontend: no token in the browser (tested) |
| V10.1.2 | L2 | Flow values bound to the user agent and transaction | Met | state, nonce, PKCE verifier in the server session (N15) |
| V10.2.1 | L2 | CSRF protection for the code flow | Met | PKCE S256 and state (N4, N5, N15) |
| V10.2.2 | L2 | Mix-up defence | Met | each client talks to one authorization server (web app: its realm; core: the eID) |
| V10.2.3 | L3 | Only required scopes requested | Met | `openid` only |
| V10.3.1 | L2 | Resource server checks audience | Met | see V9.2.3 |
| V10.3.2 | L2 | Decisions use the token's delegation claims | Met | subject from the token; mandates checked in the database at every use |
| V10.3.3 | L2 | User identified by iss + sub | Met | accounts keyed by realm (issuer) and subject (doc 02) |
| V10.3.4 | L2 | Strength and recency verified | Met | `acr`, `auth_time` (doc 04) |
| V10.3.5 | L3 | Sender-constrained access tokens (DPoP/mTLS) | Gap | G4 |
| V10.4.1 | L1 | Exact redirect URI matching | Met | registered URIs, no wildcards (checker negative control; N6, N7) |
| V10.4.2 | L1 | Codes single use; replay revokes issued tokens | Met | N3, N19 |
| V10.4.3 | L1 | Code lifetime; L3: 1 min | Met | `accessCodeLifespan` 60 s (live realm) |
| V10.4.4 | L1 | Only needed grants; no implicit or password | Met | checker; N8 |
| V10.4.5 | L1 | Refresh token replay mitigated | Met | rotation with reuse detection (N9; reuse also revokes the newest token) |
| V10.4.6 | L2 | PKCE required, plain refused | Met | `pkce.code.challenge.method=S256` (N4, N5) |
| V10.4.7 | L2 | No unsafe dynamic client registration | Met | anonymous registration refused in both realms (N22) |
| V10.4.8 | L2 | Refresh tokens expire absolutely | Met | 8 h session maximum |
| V10.4.9 | L2 | Users can revoke refresh tokens | Met | sessions page and API end sessions and their refresh tokens |
| V10.4.10 | L2 | Confidential clients authenticate on back channels | Met | core, provisioner and broker clients use client authentication |
| V10.4.11 | L2 | Only required scopes assigned to clients | Partial | Keycloak default client scopes kept; review in the internal review (W6) |
| V10.4.12 | L3 | response_mode restricted | Gap | G4 (pushed authorization requests fix it) |
| V10.4.13 | L3 | Code grant always with PAR | Gap | G4 |
| V10.4.14 | L3 | Only sender-constrained access tokens | Gap | G4 |
| V10.4.15 | L3 | authorization_details not tampered | Not applicable | not used |
| V10.4.16 | L3 | Confidential clients with private_key_jwt or mTLS | Gap | G4 |
| V10.5.1 | L2 | ID token replay (nonce) | Met | web app checks the nonce |
| V10.5.2 | L2 | User identified from sub | Met | pairwise `sub` per client (doc 03 C8) |
| V10.5.3 | L2 | Issuer metadata matches the configured issuer | Met | issuer configured, no discovery from untrusted input |
| V10.5.4 | L2 | ID token audience is the client | Met | web app checks `aud` |
| V10.5.5 | L2 | Back-channel logout tokens | Not applicable | not used |
| V10.6.1 | L2 | OP allows no implicit response types | Met | implicit disabled on every client (checker, N8) |
| V10.6.2 | L2 | Forced logout mitigated | Met | Keycloak asks for confirmation without `id_token_hint`; the web app signs out from the server |
| V10.7.1 | L2 | User consent for each client | Met | first-party clients only (marked `civora.client-kind`); third-party clients are not allowed in Phase 3 |
| V10.7.2 | L2 | Clear consent information | Not applicable | no consent screens (first-party only) |
| V10.7.3 | L2 | Review and revoke consents | Not applicable | no consents granted |

### V3 Web Frontend Security

| Requirement | Level | Subject (our wording) | Status | Evidence |
|---|---|---|---|---|
| V3.1.1 | L3 | Required browser features documented | Met | §2.4 |
| V3.2.1 | L1 | No rendering in the wrong context | Met | `nosniff`, correct content types |
| V3.2.2 | L1 | Text rendered safely | Met | React escaping; no `dangerouslySetInnerHTML` |
| V3.2.3 | L3 | No DOM clobbering | Met | no globals on `document`; TypeScript strict; nonce-only scripts |
| V3.3.1 | L1 | Secure cookies with __Host-/__Secure- | Met | `Secure`, `__Host-` on https (doc 09) |
| V3.3.2 | L2 | SameSite set by purpose | Met | `Strict` |
| V3.3.3 | L2 | __Host- prefix | Met | on https |
| V3.3.4 | L2 | HttpOnly session cookie | Met | tested |
| V3.3.5 | L3 | Cookie size under 4096 bytes | Met | one opaque id |
| V3.4.1 | L1 | HSTS on every response | Met | web app sends HSTS (2 years, sub-domains, preload) on https (new) |
| V3.4.2 | L1 | CORS fixed or allow-listed | Met | no CORS grants (N18) |
| V3.4.3 | L2 | Content Security Policy | Met | nonce and `strict-dynamic` (tested) |
| V3.4.4 | L2 | nosniff everywhere | Met | next.config |
| V3.4.5 | L2 | Referrer policy | Met | `no-referrer` |
| V3.4.6 | L2 | frame-ancestors | Met | `none` (N17) |
| V3.4.7 | L3 | CSP violation reporting | Met | `report-uri`/`report-to` to `/csp-report`, origins only in the log (N21, new) |
| V3.4.8 | L3 | Cross-Origin-Opener-Policy | Met | `same-origin` |
| V3.5.1 | L1 | Cross-origin requests validated | Met | server actions: origin check and Strict cookie (tested) |
| V3.5.2 | L1 | No reliance on CORS preflight | Not applicable | sensitive functions do not rely on preflight |
| V3.5.3 | L1 | No sensitive actions by safe methods | Met | mutations are POST server actions |
| V3.5.4 | L2 | Separate applications on separate hosts | Met | web app, Keycloak and API on separate hosts (deployment design) |
| V3.5.5 | L2 | postMessage origin checks | Not applicable | not used |
| V3.5.6 | L3 | No JSONP | Met | none |
| V3.5.7 | L3 | No authorized data in scripts | Met | data only in server-rendered pages |
| V3.5.8 | L3 | Sec-Fetch-* resource isolation | Met | cross-site requests other than links refused (N20, new) |
| V3.6.1 | L3 | External assets with SRI | Not applicable | no external assets (`self` only) |
| V3.7.1 | L2 | Supported client technologies only | Met | standard web platform |
| V3.7.2 | L2 | Redirects only to allow-listed hosts | Met | own Keycloak and the configured eID only; foreign `returnTo` refused (N16) |
| V3.7.3 | L3 | Notice before leaving for another site | Met | the only other site is the national eID, announced on the identity page |
| V3.7.4 | L3 | Domain on the HSTS preload list | Gap | G5 |
| V3.7.5 | L3 | Behaviour when browser features are missing | Partial | without WebAuthn the passkey option is unavailable and password + TOTP remains; no explicit warning page yet (W6 with assisted flows) |
