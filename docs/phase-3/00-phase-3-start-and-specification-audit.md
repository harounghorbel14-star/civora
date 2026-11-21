# Phase 3 — Authentication and Citizen Profiles: start record and specification audit

| | |
|---|---|
| Started | **21 November 2026**, decision **P3-D0**: the founder's instruction "if you finish this go to start phase 3", given together with the approval of Phase 1 (P1-D12) and Phase 2 ([decision record](../phase-2/founder-review/P2-founder-decision-record.md)) |
| Dependency | "Dependencies: P2" (Phase 0 §19). **Met:** Phase 2 approved on 21 Nov 2026 |
| Roadmap | The 15 phases are unchanged. Phase 3 keeps its full original scope, deliverables and acceptance criteria. Overlapping independent activities continue (P1-D4) |
| Data | Synthetic only (ADR-025). The national eID is **simulated** (integration class "simulated", P1-D6); no real identity provider, SMS gateway or citizen data |
| Status | **In progress** — week 1 |

## 1. Original Phase 3 specification (Phase 0 §19, word for word)

| ID | Original text |
|---|---|
| P3-OBJ | Objectives: secure accounts, sessions, assurance levels, mandates, eID brokering (simulated). |
| P3-D1 | Deliverable: citizen and officer authentication |
| P3-D2 | Deliverable: profile |
| P3-D3 | Deliverable: mandates |
| P3-D4 | Deliverable: simulated national-eID adapter |
| P3-D5 | Deliverable: account recovery design |
| P3-A1 | Architecture: Keycloak realms per cell (citizens, staff) |
| P3-A2 | Architecture: OIDC to apps |
| P3-A3 | Architecture: pairwise subject IDs |
| P3-A4 | Architecture: step-up flows |
| P3-F1 | Features: passkeys, TOTP, SMS fallback |
| P3-F2 | Features: device management |
| P3-F3 | Features: language preference |
| P3-F4 | Features: accessibility preferences |
| P3-F5 | Features: mandates (create/accept/revoke, scopes, expiry) |
| P3-F6 | Features: "acting on behalf of" UI |
| P3-DB1 | Database: `iam.person` |
| P3-DB2 | Database: `iam.account` |
| P3-DB3 | Database: `iam.authenticator` (via Keycloak + mirror) |
| P3-DB4 | Database: `iam.identity_claim` |
| P3-DB5 | Database: `iam.mandate` |
| P3-DB6 | Database: `iam.pairwise_id` |
| P3-API1 | OIDC endpoints (Keycloak) |
| P3-API2 | `GET/PATCH /v1/me` |
| P3-API3 | `GET /v1/me/sessions`, `DELETE /v1/me/sessions/{id}` |
| P3-API4 | `GET/POST/DELETE /v1/me/authenticators` |
| P3-API5 | `POST /v1/mandates`, `GET /v1/mandates`, `POST /v1/mandates/{id}:accept`, `POST /v1/mandates/{id}:revoke` |
| P3-API6 | `POST /v1/identity/links` (eID link, simulated) |
| P3-DEP | Dependencies: P2 |
| P3-SEC1 | ASVS L3 for authentication |
| P3-SEC2 | Rate limits |
| P3-SEC3 | Credential-stuffing protection |
| P3-SEC4 | Recovery requires re-proofing |
| P3-SEC5 | Officer accounts require FIDO2 keys |
| P3-T1 | Testing: unit + integration |
| P3-T2 | Testing: auth flow E2E (Playwright, Detox) |
| P3-T3 | Testing: negative tests (session fixation, CSRF, token replay) |
| P3-T4 | Testing: mandate-scope authorisation tests |
| **P3-AC1** | **Acceptance: all auth flows pass E2E in AR/FR/EN** |
| **P3-AC2** | **Acceptance: no high findings in internal security review** |
| **P3-AC3** | **Acceptance: mandate actions logged and visible to principal** |
| P3-TIME | Time: 6 weeks |
| P3-RISK | Risks: SMS reliance; usability of passkeys for elderly users (mitigate: assisted flows) |
| P3-BUD | Budget: 150–220k TND |

### Additive scope (roadmap protection matrix, P1-D4; Workspace — Regulated Finance)

| ID | Additive item |
|---|---|
| P3-R1 | Institution staff SSO (SAML/OIDC) |
| P3-R2 | Customer OTP access to the status page |
| P3-R3 | Branch/team-scoped roles |

## 2. Inherited decisions and constraints (accepted 21 Nov 2026)

| Source | What it requires of Phase 3 |
|---|---|
| ADR-005 | Keycloak as identity broker; passkeys first; SMS OTP only as a fallback, with velocity limits |
| ADR-016 | Tenancy: staff and institution data tenant-scoped with RLS; the tenant always comes from the token, never from input |
| ADR-006 | Cedar for authorisation decisions (mandate scopes, branch/team roles, "acting on behalf of") |
| ADR-015, ADR-022, ADR-024 | API standards (problem+json, idempotency); identifier, time and locale conventions; expand/contract migrations |
| ADR-011, ADR-018 | No personal data in logs; data classification (`iam` = T1) |
| Doc 06 | Assurance levels (AAL2 staff, AAL3 admins and break-glass), 5-minute access tokens, rotated refresh tokens, PKCE S256, no implicit or password grants |
| Phase 2 carried-forward items | CF-1 staging (provider), CF-2 external review, CF-3 branch protection, CF-4 reviewer arrangement, CF-5 release key. None blocks the start of Phase 3. CF-4 matters for merges to sensitive paths |
| Phase 2 backlog for Phase 3 | B6: IDOR suite template and RLS presence test; passkeys and step-up flows; application alerts; WAF proof on staging |

## 3. Open questions that Phase 3 must not assume away

| # | Question | Owner | Until answered |
|---|---|---|---|
| Q3-1 | SMS provider for OTP fallback (Tunisian operator, legal basis, cost) | Founder | Simulated SMS adapter only |
| Q3-2 | National eID: which scheme, and an authorisation to integrate | Founder / authority | Simulated adapter only (P3-D4 is "simulated" by specification) |
| Q3-3 | Mobile app: `apps/mobile` is a placeholder; Detox E2E (P3-T2) needs a mobile app shell | Engineering (plan) | Web E2E first; mobile shell scheduled in week 4 |
| Q3-4 | Identity proofing for account recovery (P3-SEC4): which re-proofing evidence is acceptable | Counsel / founder | Recovery **design** only (P3-D5 is a design deliverable) |

## 4. Plan (6 weeks)

| Week | Work | Proves |
|---|---|---|
| 1 | Data model (P3-DB1–DB6) with RLS and a presence test (B6). Token verification in the core. `GET/PATCH /v1/me` with language and accessibility preferences (P3-F3, F4). Mandate domain and API (P3-F5, API5) with audit events visible to the principal (P3-AC3) | Unit + integration tests, including cross-person isolation in the database |
| 2 | Keycloak realms per cell: citizens and staff (P3-A1). Pairwise subject IDs (P3-A3). Passkeys and TOTP (F1). FIDO2 required for officers (SEC5). Brute-force and credential-stuffing protection (SEC3). Realm conformance extended | Realm import + conformance check; login flows in the dev cell |
| 3 | Sessions and authenticators API (API3, API4; device management F2). Step-up flows (A4). Simulated eID adapter and identity links (D4, API6). Staff SSO broker (R1), branch/team roles (R3) | Integration tests against a real Keycloak |
| 4 | Web E2E with Playwright in AR/FR/EN (T2, AC1). "Acting on behalf of" UI (F6). Mobile shell + Detox plan (Q3-3). Customer OTP status-page access (R2) | E2E in three languages |
| 5 | Negative tests: session fixation, CSRF, token replay (T3). Mandate-scope authorisation tests (T4). ASVS L3 authentication checklist (SEC1). Rate limits at gateway and core (SEC2) | Negative tests fail before fixes and pass after |
| 6 | Account recovery design (D5, SEC4). Internal security review (AC2). Records, traceability, readiness report | Acceptance checklist |

## 5. Started this week

See [01 — Phase 3 progress](01-progress.md).
