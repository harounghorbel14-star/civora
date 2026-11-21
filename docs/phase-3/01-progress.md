# 01 — Phase 3 progress

| Week | Item | Status | Evidence |
|---|---|---|---|
| 1 | Start record, specification audit, plan | Done (21 Nov 2026) | [00](00-phase-3-start-and-specification-audit.md) |
| 1 | Data model `iam.*` with row-level security (P3-DB1–DB6) | **Done** | [02](02-identity-model-and-mandates.md): SQL check as the app role; e2e |
| 1 | Token verification in the core; `GET/PATCH /v1/me` (P3-API2, F3, F4) | **Done** | 8 token tests (forged, expired, wrong audience/issuer, ID token, `none`, HMAC, tampered); e2e |
| 1 | Mandates: domain, API, audit events visible to the principal (P3-F5, API5, AC3) | **Done** | e2e lifecycle; 6 rule tests |
| 2 | Keycloak realms per cell (citizens, staff), pairwise subjects, passkeys/TOTP, FIDO2 for officers | Next | — |
