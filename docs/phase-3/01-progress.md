# 01 — Phase 3 progress

| Week | Item | Status | Evidence |
|---|---|---|---|
| 1 | Start record, specification audit, plan | Done (21 Nov 2026) | [00](00-phase-3-start-and-specification-audit.md) |
| 1 | Data model `iam.*` with row-level security (P3-DB1–DB6) | **Done** | [02](02-identity-model-and-mandates.md): SQL check as the app role; e2e |
| 1 | Token verification in the core; `GET/PATCH /v1/me` (P3-API2, F3, F4) | **Done** | 8 token tests (forged, expired, wrong audience/issuer, ID token, `none`, HMAC, tampered); e2e |
| 1 | Mandates: domain, API, audit events visible to the principal (P3-F5, API5, AC3) | **Done** | e2e lifecycle; 6 rule tests |
| 1 | GitHub: CI run 35 and nightly run 14 on the week-1 commit | **Green** | Actions, 21 Nov 2026 |
| 2 | Realms per cell: citizens (passkey, or password + TOTP) and staff (password + FIDO2 key) (P3-A1, F1, SEC5) | **Done** (local run 21 Nov 2026; nightly job `identity-realms` added) | [03](03-identity-realms-and-authentication.md) §4: real logins in Chromium with virtual authenticators; the core accepts the Keycloak tokens |
| 2 | Pairwise subject IDs (P3-A3) | **Done** | 03 §4 C8 (fails closed without a salt) |
| 2 | Brute-force and credential-stuffing protection (P3-SEC3) | **Partial**: per-account lockout done; cross-account stuffing in week 5 | 03 §4 C9; R-P3-6 |
| 2 | Realm conformance: profiles, live mode, flow evaluation, post-import policy | **Done** | 03 §3; 6 defects found and fixed (03 §5), incl. a FIDO2 bypass through the built-in `admin-cli` password grant |
| 2 | Dev cell imports the realms; core runs as `civora_core_app` and trusts them | **Done** | `dev-cell-up.sh --fresh`: 14/14 in 168 s; dev-cell token accepted by the dev-cell core (03 §1) |
| 2 | Open findings | Tracked | R-P3-1 account enumeration at the username step; R-P3-2 passkey offered second; R-P3-3 enrolment bootstrap; R-P3-4 salts only in the Keycloak database; R-P3-5 key models not restricted; R-P3-6 cross-account stuffing; R-P3-7 lockout as denial of service |
| 3 | Sessions and authenticators API, step-up, simulated eID adapter, staff SSO, branch/team roles | Next | — |
