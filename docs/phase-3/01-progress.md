# 01 — Phase 3 progress

| Week | Item | Status | Evidence |
|---|---|---|---|
| 1 | Start record, specification audit, plan | Done (21 Nov 2026) | [00](00-phase-3-start-and-specification-audit.md) |
| 1 | Data model `iam.*` with row-level security (P3-DB1–DB6) | **Done** | [02](02-identity-model-and-mandates.md): SQL check as the app role; e2e |
| 1 | Token verification in the core; `GET/PATCH /v1/me` (P3-API2, F3, F4) | **Done** | 8 token tests (forged, expired, wrong audience/issuer, ID token, `none`, HMAC, tampered); e2e |
| 1 | Mandates: domain, API, audit events visible to the principal (P3-F5, API5, AC3) | **Done** | e2e lifecycle; 6 rule tests |
| 1 | GitHub: CI run 35 and nightly run 14 on the week-1 commit | **Green** | Actions, 21 Nov 2026 |
| 2 | Realms per cell: citizens (passkey, or password + TOTP) and staff (password + FIDO2 key) (P3-A1, F1, SEC5) | **Done** (local runs and GitHub nightly run 17: 12/12 jobs green, incl. `identity-realms`; CI 36, 37 green) | [03](03-identity-realms-and-authentication.md) §4: real logins in Chromium with virtual authenticators; the core accepts the Keycloak tokens |
| 2 | Pairwise subject IDs (P3-A3) | **Done** | 03 §4 C8 (fails closed without a salt) |
| 2 | Brute-force and credential-stuffing protection (P3-SEC3) | **Done** (second pass): per-account lockout + per-client gateway limits | 03 §4 E3, gateway 7.x |
| 2 | Realm conformance: profiles, live mode, flow evaluation, post-import policy | **Done** | 03 §3; 6 defects found and fixed (03 §5), incl. a FIDO2 bypass through the built-in `admin-cli` password grant |
| 2 | Dev cell imports the realms; core runs as `civora_core_app` and trusts them | **Done** | `dev-cell-up.sh --fresh`: 14/14 in 168 s; dev-cell token accepted by the dev-cell core (03 §1) |
| 2 | Open findings after the first pass | Superseded by the second pass | R-P3-1, R-P3-3, R-P3-5, R-P3-6 closed (03 §9); R-P3-2, R-P3-4, R-P3-7 open (low/operations); R-P3-8–R-P3-10 new (03 §6) |
| 2+ | **Five open findings closed before approving the identity system** (21 Nov 2026, second pass): account enumeration, first enrolment, FIDO2 attestation / approved keys, credential stuffing, languages | **Done** (local; GitHub run below) | [03 §9](03-identity-realms-and-authentication.md): realms test all checks passed (45 journey checks in ar/fr/en + 26 security checks); gateway 18/18; core 56 tests; dev cell 15/15 in 96 s |
| 2+ | GitHub on the second-pass commit `7acaf7a` | CI run 39 **green**; nightly run 18: **10 of 12 jobs green**, including `identity-realms` (all journeys and security checks, 3 min 17 s) and the gateway (18/18) | Not green: PostgreSQL HA 2 nodes, crash-rejoin step (Phase 2 R45, open, diagnostics added); Valkey on k3s hung at k3s start until cancelled (Phase 2 R46, unbounded waits fixed in all rehearsal scripts) — neither touches identity code |
| 2+ | GitHub on `543ec72` (bounded waits) | CI run 40 **green**; nightly run 19: **11 of 12 green** (`identity-realms`, gateway, PostgreSQL 2 and 3 nodes, Valkey on k3s in 71 s) | Keycloak HA failed after 5 s: a race introduced by the first bounded-wait version (Phase 2 R46); corrected and re-tested locally (Keycloak HA 5/5, gateway 18/18) |
| 2+ | GitHub on `2df93a8` | CI run 41 **green**; nightly run 20 **green, 12 of 12 jobs** (identity realms in three languages, gateway, Keycloak HA, PostgreSQL HA 2 and 3 nodes, DR, Valkey, signatures, dev cell) | Phase 2 R45 kept open as intermittent (failed once in run 18; green in 19 and 20), diagnostics in place |
| 2+ | Citizen registration through the core (`POST /v1/registrations`, one answer for every address, activation link) | **Done** | 03 §9.1, E1 |
| 2+ | Founder decisions raised | Open | Officer security-key models (AAGUIDs + vendor roots) for staging/pilot; mail relay provider for activation e-mails (R-P3-9) |
| 3 | Step-up (A4), sessions (API3), authenticators (API4, F2), authenticator mirror (DB3) | **Done** (local) | [04](04-sessions-authenticators-step-up.md): account checks against the real realms all passed; core 82 tests; dev cell 15/15 |
| 3 | Branch/team roles (R3), staff invitations (no administrator-known passwords), cleanup of accounts never activated (R-P3-8), chart: identity settings, Keycloak egress, cleanup CronJob | **Done** (local) | [05](05-organisation-invitations-cleanup.md): organisation checks against the real realms all passed; 85 tests across the workspace (core 67) |
| 3 | GitHub on `c2b0039` (step-up, sessions, authenticators) | CI run 47 **green**; nightly run 21: `identity-realms` failed once in `[fr]`: a navigation to Keycloak was interrupted by Chromium's error page for the previous redirect | Test-harness race, not identity code: the helper now waits for the page and retries an interrupted navigation (`lib.cjs`); full run afterwards in ar/fr/en: 123 checks, all passed |
| 3 | GitHub on `f36a50c` (branches, teams, invitations, cleanup) | CI run 48 **green**; nightly run 23 **green, 12 of 12 jobs** (identity realms with the organisation checks) | Merged into `main`: PR #6 (`2f06576`) |
| 3 | Simulated national eID (D4), identity links (API6), keyed digests in `iam.identity_claim` (DB4); ADR-028 adapter rules in code; dev cell with the simulator | **Done** (local) | [06](06-simulated-eid-identity-links.md): whole realms run 142 checks, all passed (eID, leak scan of the core database and log); 110 tests across the workspace (core 92); dev cell 16/16. The first run found a defect in the week-3 cleanup (it removed Keycloak service accounts; merged in PR #6, CronJob off by default): fixed, [05 §5](05-organisation-invitations-cleanup.md) |
| 3 | GitHub on `154a477` (simulated eID, identity links, cleanup fix) | CI run 51 **green**; nightly run 24 **green, 12 of 12 jobs** | Merged into `main`: PR #7 (`62acec5`) |
| 3 | Institution staff SSO (R1): OIDC and SAML institutions through Keycloak organisations, create-only first sign-in, security key after every SSO sign-in, tenant hardcoded per provider; realm checker models brokered sign-in; staff session aligned to 8 h | **Done** (local) | [07](07-institution-staff-sso.md): whole realms run 161 checks, all passed (12 SSO checks); 7 new negative controls |
| 3 | GitHub on `acd9075` (institution SSO) | CI run 54 **green**; nightly run 25 **green** | Merged into `main`: PR #8 (`515a0f0`) |
| 4 | Pilot gate for identity, R-P3-14 blocking (PG-1) | **Done** | [08](08-pilot-gate.md) |
| 4 | Citizen web app (backend-for-frontend) in AR/FR/EN; acting on behalf of (F6); customer status page with one-time codes (R2); messaging port (simulated e-mail); web E2E (T2, AC1) | **Done** (local) | [09](09-citizen-web-app.md): whole realms run 199 checks, all passed (38 web app checks); 139 tests (core 99, web 22); gateway 19/19; dev cell 17/17 |
| 4 | Mobile shell + Detox plan (Q3-3) | **Plan done**; the app is built with its emulator job | [10](10-mobile-shell-and-detox-plan.md) |
| 5 | Mandate scopes as Cedar policies (T4); negative tests (T3); ASVS 5.0 L3 assessment of the identity system (SEC1) with fixes (password deny list and context words, session ending with step-up and "end all others", web app resource isolation, CSP reports, HSTS); rate limits on every route (SEC2); every flow in AR/FR/EN (AC1) | **Done** (local) | [11](11-security-verification.md): whole realms run **254 checks, all passed** (22 negative, 58 web app); 154 unit and database tests; gateway 20/20; dev cell 17/17; ASVS: 121 of 143 applicable met |
| 5 | GitHub on `ca766aa` | CI run 63 **green**; nightly run 30 **green** after re-running the Valkey-on-k3s job (a failover-timing race, doc 13 SR-14) | Merged into `main`: PR #10 (`d27c490`) |
| 6 | Account recovery by re-proofing at the simulated eID (D5, SEC4), security notices, simulated SMS channel (F1), pairwise mirror (DB6), quotas (R-P3-15), assisted use (RISK); internal security review (AC2), readiness report, acceptance checklist | **Done** (local) | [12](12-recovery-notices-sms-pairwise.md), [13](13-security-review-and-readiness.md): whole realms run **274 checks, all passed** (recovery in three languages, pairwise mirror verified against Keycloak, SAML replay refused, N23); 170 unit and database tests; gateway 21/21; dev cell 17/17; no open high finding |
| 6 | GitHub on the week-6 commit | CI run 81 **green**; nightly run 34 **green** | Merged into `main`: PR #16 (`1302642`) |
| 6+ | Gap G4 (ASVS L3, SR-4): the web app as a confidential client (`private_key_jwt`), pushed authorization requests required, DPoP-bound access tokens checked by the core with single-use proofs; the mobile client requires PAR and DPoP in the realm | **Done for the web app** (local); the other clients remain (doc 14 §5) | [14](14-sender-constrained-tokens.md): whole realms run **279 checks, all passed** (1084 s; new N24–N27, web app 68 checks through the new sign-in); 177 tests (core 122 with PostgreSQL, web 24) |
| 6+ | GitHub on the G4 commits (head `36e90e8`) | CI runs 96 and 97 **green** (CodeQL check passing after N24 stopped logging the token endpoint's answer); nightly run 38 **green, 12 of 12 jobs** | Merged into `main`: PR #17 (`5194ff8`). On the way: a test placeholder flagged by gitleaks (built at run time now), the dev cell's web-client key (pinned now), a CodeQL finding read from the job log (new CI step) |
| 6+ | Gap G3 (ASVS V8.2.4, SR-5): adaptive controls on the device and browser of every session: a new device or a long absence is notified, a session used from another device or browser is ended at Keycloak and refused, notices in ar/fr/en | **Done** (local) | [15](15-adaptive-controls.md): whole realms run **286 checks, all passed** (1284 s; new: device cookie, new-device e-mail and stolen-cookie checks in three languages); 188 tests (core 131 with PostgreSQL, web 26) |
| 6+ | GitHub on the G3 commits | CI runs 102 and 103 **green** (CodeQL check passing); nightly run 40 **green, 12 of 12 jobs** on the last code commit | Merged into `main`: PR #18 (`8a89e19`) |
| 6+ | Rest of G1 (ASVS V6.3.5, V6.3.7): notices from Keycloak's sign-in events: right password with a failed second step, repeated failures, a sign-in after failures, a way to sign in added or changed; event shapes observed on Keycloak 26.8.1 first | **Done** (local); V6.3.7 keeps one open item (e-mail changes on Keycloak's account pages: decision) | [15 §7](15-adaptive-controls.md): realms run **296 checks** (295 in the full run, E1 fixed and the login part re-run 80/80; new: 9 notice checks in three languages and the lockout notice); 195 tests (core 138 with PostgreSQL, web 26) |
| 6+ | GitHub on the G1 commits | CI and nightly green | Merged into `main`: PR #21 (`58422b0`) |
| 6+ | Founder decisions of 27 Nov (V6.3.7, Q3-7, Q3-4, G5) applied, part 1: the e-mail address and phone number change only through the core after a code to the new one, the old address told (V6.3.7 met); recovery R4 by the e-mailed link **and** an SMS code to the verified number; deviation D5 recorded | **Done** (local) | [16](16-contact-details-and-phone-recovery.md): realms web part **99 checks, all passed** (new: e-mail change, phone, R4 and removal in three languages); 177 tests (core 149 with PostgreSQL, web 28); realm checker with 6 new negative controls per realm; ASVS 127 of 143 met |
| 6+ | GitHub on the part-1 commits (head `1864bd7`) | CI runs 119 and 120 **green**; nightly run 46 **green, 13 of 13 jobs** (the realms run now in two parallel halves: 11.5 and 15 min) | Merged into `main`: PR #22 (`194ab4b`) |
| 6+ | Part 2: a code by SMS as a fallback second step (P3-F1, decision Q3-7, deviation D5): a Keycloak extension (Java 21, built against 26.8.1), for citizens and staff who are not officers; officers never (P3-SEC5); simulated channel only (Q3-1); the cell's Keycloak image with the extension built (`kc.sh build`) | **Done** (local) | [17](17-sms-sign-in-factor.md): realms parts login and SMS **96 checks, all passed** (16 new SMS checks in three languages and for staff and officers); 5 JUnit tests; realm checker with 3 new negative controls and duplicate-key refusal |

## Completion estimate (27 Nov 2026, updated after the contact details, recovery R4 and the SMS sign-in step)

Each of the 43 work items of the specification ([00](00-phase-3-start-and-specification-audit.md); objectives,
dependency, time and budget lines excluded) scored by what is built **and tested**: 0, 25, 50, 75 or 100 %.
**Phase 3: about 97 %** (41.5 of 43). Acceptance criteria: **3 of 3 met** (AC1, AC2 self-review, AC3).
Time: 6 of 6 planned weeks used. Not reached 100 %: the mobile app and its Detox job (A2, T2, T1), G5, the rest of G4 (SEC1), the web app's edge route (SEC2), counter-assisted flows (RISK, Phase 6). The scoring is an engineering estimate, not an acceptance decision.

| Item | Done | What is missing |
|---|---|---|
| P3-D1 citizen and officer authentication | 100% | realm flows, step-up, invitations, institution SSO, and the citizen web app (doc 09); officers use Keycloak's pages, the Workspace screens come in Phase 6 |
| P3-D2 profile | 100% | GET/PATCH /v1/me and the preferences screen in three languages (doc 09) |
| P3-D3 mandates | 100% | domain, API, audit events, screens, acting on behalf (doc 09) |
| P3-D4 simulated eID adapter | 100% | port NationalEid, simulated-oidc adapter, ADR-028 mode rules, simulator realm (doc 06) |
| P3-D5 account recovery design | 100% | recovery paths R1–R3 designed (doc 12 §1), R4 added (doc 16); R1 (re-proofing at the eID) and R4 (e-mailed link and SMS code) built and tested in three languages |
| P3-A1 realms per cell | 100% |  |
| P3-A2 OIDC to apps | 75% | citizen web app as a backend-for-frontend (doc 09); the mobile client comes with the mobile app (doc 10) |
| P3-A3 pairwise subject IDs | 100% |  |
| P3-A4 step-up flows | 100% | RFC 9470 step-up on sensitive actions (doc 04) |
| P3-F1 passkeys, TOTP, SMS fallback | 100% | passkeys and TOTP (doc 03); SMS as a delivery channel (doc 12 §3), for number checks and recovery R4 (doc 16), and as a fallback sign-in step for citizens and staff who are not officers (doc 17; decision Q3-7, deviation D5); the SMS provider is Q3-1 (simulated until then) |
| P3-F2 device management | 100% | list, add (Keycloak action), remove with last-way protection (doc 04) |
| P3-F3 language preference | 100% | stored, validated and applied in the web app (ar/fr/en, right to left) |
| P3-F4 accessibility preferences | 100% | stored, validated and applied in the web app (text size, contrast, motion) |
| P3-F5 mandates | 100% |  |
| P3-F6 'acting on behalf of' UI | 100% | banner, scopes, stop; recorded and visible to the principal (doc 09) |
| P3-DB1 iam.person | 100% |  |
| P3-DB2 iam.account | 100% |  |
| P3-DB3 iam.authenticator (mirror) | 100% | mirror refreshed through iam.sync_authenticators (doc 04) |
| P3-DB4 iam.identity_claim | 100% | keyed digests from the eID adapter; one identity per person (doc 06) |
| P3-DB5 iam.mandate | 100% |  |
| P3-DB6 iam.pairwise_id | 100% | mirror filled by the core, computed as Keycloak does (verified against a real token), shown in GET /v1/me/pairwise (doc 12 §4) |
| P3-API1 OIDC endpoints | 100% |  |
| P3-API2 /v1/me | 100% |  |
| P3-API3 sessions | 100% | doc 04 |
| P3-API4 authenticators | 100% | doc 04 |
| P3-API5 mandates | 100% |  |
| P3-API6 identity links (simulated eID) | 100% | start (step-up), complete, list (doc 06) |
| P3-SEC1 ASVS L3 | 75% | assessment (doc 11), updated after week 6: 124 of 143 applicable L1–L3 requirements met in V3, V6–V10; G2 (recovery) closed, G1 partly; G4 partly closed (doc 14: web app confidential with PAR and DPoP; five V10 rows now partial, no longer gaps); G3 closed (doc 15: adaptive controls, V8.2.4 met with deviation D4); G1 mostly closed (doc 15 §7: sign-in event notices, V6.3.5 met); 126 of 143 met, 1 gap left; then V6.3.7 met (doc 16: e-mail changes only through the core's verified flow) and deviation D5 recorded: 127 of 143 met; open: G4 for the other clients, G5 HSTS preload |
| P3-SEC2 rate limits | 75% | every route reviewed and limited, checked by the gateway test (doc 11 §5); quotas per person and institution (R-P3-15, week 6); open: the web app's edge route (ADR-030, PG-8) |
| P3-SEC3 credential stuffing | 100% |  |
| P3-SEC4 recovery re-proofing | 100% | decision Q3-4 (27 Nov): the national eID (built and tested, doc 12), a counter with an identity document (the Workspace, Phase 6), and the e-mailed link with an SMS code to a verified number (built and tested, doc 16) |
| P3-SEC5 officers require FIDO2 | 100% | approved models: founder decision Q3-5 |
| P3-T1 unit + integration | 75% | 208 tests (core 149 with PostgreSQL, web 28, other packages 31) and the realms integration run (296 checks in the last full run, web part now 99); grows with each feature |
| P3-T2 E2E Playwright, Detox | 75% | Playwright through the web app in three languages (doc 09); Detox planned, needs its emulator job (doc 10) |
| P3-T3 negative tests (session fixation, CSRF, token replay) | 100% | 27 attack checks (N1–N27, doc 11 §6; N24–N27 for PAR, client assertions and DPoP, doc 14) besides the earlier forgery, replay and WebAuthn checks |
| P3-T4 mandate-scope authorisation tests | 100% | Cedar policies with 20 decision cases and 8 negative controls; the core answers permissions from them (doc 11 §7); domain endpoints use the same engine when they arrive |
| P3-AC1 all auth flows E2E in AR/FR/EN | 100% | every flow in each of the three languages (doc 11 §8) |
| P3-AC2 no high findings in internal security review | 100% | self-review done, no open high finding; one high found and fixed before merge (doc 13); external test: PG-8 |
| P3-AC3 mandate actions logged and visible | 100% |  |
| P3-RISK SMS reliance, passkey usability for elderly users | 75% | mitigations designed and mostly built (doc 12 §5): SMS only as a fallback with verified numbers and two-channel recovery (docs 16, 17), password + TOTP, mandates for helpers, eID recovery; counter-assisted flows need the Phase 6 Workspace |
| P3-R1 institution staff SSO | 100% | OIDC and SAML institutions, tenant from configuration, key after SSO, no account linking (doc 07) |
| P3-R2 customer OTP status page | 100% | reference + code to the contact on file, no enumeration, simulated e-mail (SMS: Q3-1) (doc 09) |
| P3-R3 branch/team roles | 100% | units, scoped roles, invitations, admin API (doc 05) |
