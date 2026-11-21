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
| 3 | Simulated eID (D4, API6); staff SSO (R1) | Next | — |

## Completion estimate (21 Nov 2026, updated during week 3)

Each of the 43 work items of the specification ([00](00-phase-3-start-and-specification-audit.md); objectives,
dependency, time and budget lines excluded) scored by what is built **and tested**: 0, 25, 50, 75 or 100 %.
**Phase 3: about 66 %** (28.25 of 43). Acceptance criteria: 1 of 3 met (AC3), AC1 half, AC2 not started.
Time: 2 of 6 planned weeks used. The scoring is an engineering estimate, not an acceptance decision.

| Item | Done | What is missing |
|---|---|---|
| P3-D1 citizen and officer authentication | 75% | realm flows, step-up, staff invitations built and tested; app screens and staff SSO missing |
| P3-D2 profile | 75% | GET/PATCH /v1/me; no app screen |
| P3-D3 mandates | 75% | domain, API, audit events; 'acting on behalf of' UI missing |
| P3-D4 simulated eID adapter | 0% | week 3 |
| P3-D5 account recovery design | 0% | week 6 |
| P3-A1 realms per cell | 100% |  |
| P3-A2 OIDC to apps | 50% | clients with PKCE and audience; no app integrated yet |
| P3-A3 pairwise subject IDs | 100% |  |
| P3-A4 step-up flows | 100% | RFC 9470 step-up on sensitive actions (doc 04) |
| P3-F1 passkeys, TOTP, SMS fallback | 75% | SMS fallback waits on Q3-1 |
| P3-F2 device management | 100% | list, add (Keycloak action), remove with last-way protection (doc 04) |
| P3-F3 language preference | 75% | stored and validated; applied in app screens in week 4 |
| P3-F4 accessibility preferences | 75% | stored and validated; applied in app screens in week 4 |
| P3-F5 mandates | 100% |  |
| P3-F6 'acting on behalf of' UI | 0% | week 4 |
| P3-DB1 iam.person | 100% |  |
| P3-DB2 iam.account | 100% |  |
| P3-DB3 iam.authenticator (mirror) | 100% | mirror refreshed through iam.sync_authenticators (doc 04) |
| P3-DB4 iam.identity_claim | 50% | table with RLS; filled by the eID adapter (week 3) |
| P3-DB5 iam.mandate | 100% |  |
| P3-DB6 iam.pairwise_id | 50% | table with RLS; pairwise ids issued by Keycloak, mirror not filled |
| P3-API1 OIDC endpoints | 100% |  |
| P3-API2 /v1/me | 100% |  |
| P3-API3 sessions | 100% | doc 04 |
| P3-API4 authenticators | 100% | doc 04 |
| P3-API5 mandates | 100% |  |
| P3-API6 identity links (simulated eID) | 0% | week 3 |
| P3-SEC1 ASVS L3 | 25% | controls in place; no formal ASVS assessment yet (week 5) |
| P3-SEC2 rate limits | 75% | gateway limits on login, token, registration, API; full endpoint review week 5 |
| P3-SEC3 credential stuffing | 100% |  |
| P3-SEC4 recovery re-proofing | 0% | week 6, depends on Q3-4 |
| P3-SEC5 officers require FIDO2 | 100% | approved models: founder decision Q3-5 |
| P3-T1 unit + integration | 75% | 85 tests (core 67 with PostgreSQL) and the realms integration run (123 checks); grows with each feature |
| P3-T2 E2E Playwright, Detox | 50% | Playwright on realm flows in 3 languages; app screens and Detox (Q3-3) missing |
| P3-T3 negative tests (session fixation, CSRF, token replay) | 50% | token forgery/replay, TOTP replay, forged WebAuthn done; session fixation and CSRF not yet |
| P3-T4 mandate-scope authorisation tests | 75% | party and scope rules tested; enforcement on domain endpoints comes with them |
| P3-AC1 all auth flows E2E in AR/FR/EN | 50% | realm flows pass in all three; sessions, step-up and invitations pass through the core (one language each); eID and app screens not yet |
| P3-AC2 no high findings in internal security review | 0% | review in week 6 |
| P3-AC3 mandate actions logged and visible | 100% |  |
| P3-RISK SMS reliance, passkey usability for elderly users | 25% | password + TOTP alternative exists; assisted flows not designed |
| P3-R1 institution staff SSO | 0% | week 3 |
| P3-R2 customer OTP status page | 0% | week 4 |
| P3-R3 branch/team roles | 100% | units, scoped roles, invitations, admin API (doc 05) |
