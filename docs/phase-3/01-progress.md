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
| 2+ | Citizen registration through the core (`POST /v1/registrations`, one answer for every address, activation link) | **Done** | 03 §9.1, E1 |
| 2+ | Founder decisions raised | Open | Officer security-key models (AAGUIDs + vendor roots) for staging/pilot; mail relay provider for activation e-mails (R-P3-9) |
| 3 | Sessions and authenticators API, step-up, simulated eID adapter, staff SSO (invitations), branch/team roles, cleanup of unactivated accounts | Next | — |
