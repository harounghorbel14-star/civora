# 13 — Internal security review (P3-AC2), readiness report and acceptance checklist (Phase 3, week 6)

| | |
|---|---|
| Specification items | P3-AC2 "no high findings in internal security review"; the Phase 3 readiness report and acceptance checklist |
| Who reviewed | The engineering team: a **self-review**, not an independent one. An external test of the whole application is pilot gate PG-8 ([doc 08](08-pilot-gate.md)) |
| Inputs | Phase 2 threat model and security architecture; [doc 11](11-security-verification.md) (ASVS 5.0 L1–L3, 153 requirements; negative tests); [doc 12](12-recovery-notices-sms-pairwise.md); the realms, gateway, dev-cell, unit and database test runs |
| Status | Review done on 25 Nov 2026; **no open high finding**; one high finding was found and fixed before it reached `main` (SR-1) |

## 1. Method

1. **Trust boundaries** of the identity system, from the Phase 2 threat model: browser ↔ web app (backend-for-frontend);
   web app ↔ Keycloak; web app ↔ core; core ↔ Keycloak admin API; core ↔ PostgreSQL (row-level security, functions);
   Keycloak ↔ institutions (OIDC, SAML); core ↔ national eID (simulated); core ↔ messaging (simulated e-mail and
   SMS); edge gateway ↔ everything public. STRIDE per boundary.
2. **Code paths read line by line:** token verification, step-up guard, identity guard, account security (sessions,
   authenticators), identity links, recovery, status page, mandates and the Cedar engine, web app sessions, OIDC client,
   proxy (CSP, resource isolation), callbacks and server actions, all `SECURITY DEFINER` functions of the `iam` schema.
3. **Configuration:** realm checker with negative controls (citizens, staff, dev), gateway routes, Kubernetes manifests
   (restricted Pod Security), secrets handling.
4. **Tests as evidence:** every finding below is either fixed with a test that would catch it again, or open with an
   owner, a plan and, where it blocks real users, a pilot gate.
5. **Severity:** *High* — an attacker without the victim's help can take over an account, act as someone else, or read
   another person's or institution's data. *Medium* — needs particular conditions, or weakens a defence in depth, or
   harms availability. *Low* — hardening.

## 2. Findings

| # | Severity | Finding | Status | Evidence / plan |
|---|---|---|---|---|
| SR-1 | **High** | During week 6 a class was inserted between `MeController`'s decorators, so its identity guard attached to the wrong class: `/v1/me` would have run without authentication | **Fixed before any commit** | Caught by the core end-to-end tests (500 instead of 401). New negative check **N23**: every operation the OpenAPI contract marks as needing a token is called without one and must answer 401 (all pass) |
| SR-2 | Medium | Web app: pending sign-ins kept without a bound (memory exhaustion by flooding `/auth/login`) | Fixed (week 5) | Bounded store, oldest first; unit tests |
| SR-3 | Medium | Institutions cannot end CIVORA staff sessions at once when a person leaves (no back-channel logout) | Open, **pilot gate PG-1** | R-P3-14 |
| SR-4 | Medium | Web client: public client with PKCE, no pushed authorization requests, no sender-constrained tokens, no `private_key_jwt` (ASVS L3 V10) | **Partly closed 26 Nov** ([doc 14](14-sender-constrained-tokens.md)): web app confidential with `private_key_jwt`, PAR required, DPoP-bound tokens checked by the core (N24–N27); mobile client requires PAR and DPoP in the realm | Open part (doc 14 §5): Workspace client (Phase 6), the mobile app itself (A2), relying parties and provisioner on `private_key_jwt`, Keycloak's account console, DPoP-aware edge route (ADR-030) |
| SR-5 | Medium | No adaptive controls and no notice of suspicious sign-ins (ASVS V8.2.4, V6.3.5) | Open, G3/G1, PG-8 | Needs Keycloak sign-in events; design in doc 12 §2 |
| SR-6 | Medium | Keycloak's temporary bootstrap administrator: no written procedure to replace it with named administrators who use a second factor | **Procedure written (§3)**; to be checked at each installation | ASVS V6.3.2. The administration console is not routed through the edge (gateway check 7) |
| SR-7 | Medium | Web app sessions live in one process (one replica; a restart signs everyone out) | Open, **PG-7** | Shared store (Valkey) |
| SR-8 | Low | No limit on `/health` and Keycloak's static resources at the edge | Fixed (week 5) | Gateway check 8: every route has a limit |
| SR-9 | Low | Limits on authenticated endpoints only per address (mandates, invitations) | Fixed (week 6) | Quotas in the database (R-P3-15): 30 mandate proposals a day per person, 200 invitations a day per institution; end-to-end test |
| SR-10 | Low | Self-contained access tokens remain valid up to 5 minutes after sign-out | Accepted (deviation D3, doc 11) | The web app discards them; refresh tokens revoked at once |
| SR-11 | Low | No rotation procedure for the identifier digest key | Open, **PG-2** | R-P3-12 |
| SR-12 | Low | Changes made on Keycloak's own pages (adding a passkey, a new password) send no notice | Open, G1 | doc 12 §2 |
| SR-13 | Info | Two moderate advisories in a transitive dependency of the migration tool (`glob`, `minimatch` under `node-pg-migrate`) | Accepted | Used only when migrations run, never on a request path; CI fails on high or critical |
| SR-14 | Info | A Phase 2 failover test (Valkey on k3s) can race when the deleted primary pod returns within Sentinel's down-after time | Open (test robustness, Phase 2) | Seen once in nightly 30; the durability checks passed; re-run green |

Checked and found sound (selection): no account enumeration (registration, login, recovery, status page — same answers
and timing); refresh-token rotation with reuse detection; authorization-code replay revokes issued tokens; PKCE
required, `plain` refused; exact redirect URIs; no implicit or password grants; anonymous client registration refused;
ID token checks (issuer, audience, nonce); tokens never in the browser; CSRF on server actions; strict CSP with
nonces; framing refused; cross-site sub-resource requests refused; row-level security as the application role;
`SECURITY DEFINER` functions pin `search_path` and check the current person; national identifiers never stored or
logged (keyed digests only; leak scan of database dump and logs in every realms run); captured SAML responses cannot
be replayed (new check in the SSO part); recovery never by e-mail alone and at the level of the identity link.

**Result for P3-AC2: no open high finding.** Medium findings are either pilot gates (SR-3, SR-7), planned (SR-4,
SR-5) or handled by a procedure (SR-6).

## 3. Procedure: Keycloak's bootstrap administrator (SR-6)

1. The Keycloak Operator creates a **temporary** administrator in the `master` realm at first start (secret
   `keycloak-initial-admin`). Keycloak marks it temporary.
2. Before anything else, the platform operator signs in once (from the operations network; the console is not routed
   through the edge), creates **named** administrator accounts in `master`, each with a FIDO2 security key required
   (required action `webauthn-register`), and gives them the `admin` role.
3. Signs in with a named account and its key, then **deletes** the temporary administrator and the
   `keycloak-initial-admin` secret.
4. Records the change (who, when) in the operations log. The realms run and the conformance checker cover the CIVORA
   realms; the master realm is checked by hand at each installation until the check is automated (PG-8).

## 4. Readiness report

| | |
|---|---|
| Built and tested | Everything in the acceptance checklist (§5) marked 100 %: realms, authentication flows, step-up, sessions and authenticators, profile and preferences, mandates and acting on behalf (Cedar), simulated eID and identity links, institution SSO, staff invitations and units, customer status page, recovery with re-proofing, notices, pairwise mirror, negative tests, ASVS assessment, three languages |
| Not yet built | The mobile app and its Detox tests (A2, T2: doc 10), PAR/DPoP/`private_key_jwt` for the clients other than the web app (G4 remainder, doc 14 §5), adaptive controls (G3), SMS as a sign-in factor (pending Q3-7), counter-assisted recovery (Phase 6 Workspace) |
| Pilot gates open | PG-1 back-channel logout, PG-2 digest key rotation, PG-3 officer key models (Q3-5), PG-4 mail relay (Q3-6), PG-5 national eID (Q3-2), PG-6 SMS provider (Q3-1), PG-7 shared web sessions, PG-8 whole-application ASVS L3 and external test |
| Founder decisions open | Q3-1 SMS provider; Q3-2 national eID scheme; Q3-4 acceptable re-proofing evidence for recovery; Q3-5 officer key models; Q3-6 mail relay; **Q3-7 (new)** SMS fallback versus ASVS L3 |
| Estimate | See [01 — Progress](01-progress.md): about 95 % of the 43 items; acceptance criteria AC1, AC2 and AC3 met |

## 5. Acceptance criteria

| Criterion | Result |
|---|---|
| P3-AC1 All authentication flows end to end in Arabic, French and English | **Met**: every flow, including recovery, in the three languages ([doc 11 §8](11-security-verification.md), doc 12 §7) |
| P3-AC2 No high findings in the internal security review | **Met** (self-review): no open high finding (§2); the external test is PG-8 |
| P3-AC3 Mandate actions logged and visible to the principal | **Met** (week 4) |
