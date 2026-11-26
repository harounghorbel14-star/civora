# 14 — Web app at ASVS L3: `private_key_jwt`, pushed authorization requests, DPoP (gap G4)

| | |
|---|---|
| Specification items | P3-SEC1 (ASVS 5.0 L3), gap **G4** of [doc 11](11-security-verification.md), finding **SR-4** of [doc 13](13-security-review-and-readiness.md) |
| Standards applied | RFC 9126 (pushed authorization requests, PAR) · RFC 9449 (DPoP) · RFC 7523 / OIDC Core §9 (`private_key_jwt`) · RFC 7638 (key thumbprint) · ASVS 5.0 V10.3.5, V10.4.12–V10.4.14, V10.4.16 |
| Keycloak | 26.8.1: features `par` and `dpop` are on by default; client attributes `require.pushed.authorization.requests`, `dpop.bound.access.tokens`, authenticator `client-jwt` |
| Status | Built and tested on 26 Nov 2026 (§6). G4 is **partly closed**: done for the citizen web app (the only client built so far) and set in the realm for the mobile app; what remains is in §5 |

## 1. What changed and why

Before: the web app (a backend-for-frontend, doc 09) was a **public** client with code + PKCE and received **bearer**
access tokens. Anyone who obtained one of its tokens (a log line, a memory dump, a mis-routed request) could call the
core with it until it expired.

After:

| Step | Before | After |
|---|---|---|
| Client authentication at the token endpoint | none (public client) | a signed assertion (`private_key_jwt`, ES256, 60 s, single `jti`); the key's public half is pinned in the client (`jwks.string`), never fetched from a URL |
| Authorization request | built in the browser's address bar | **pushed** first by the server (PAR, authenticated); the browser carries only `client_id` and a one-minute `request_uri`. Keycloak refuses a request that was not pushed |
| Access token | bearer | **DPoP-bound**: `token_type` DPoP, `cnf.jkt` = thumbprint of a P-256 key made for the session, kept server-side with it |
| Call to the core | `Authorization: Bearer …` | `Authorization: DPoP …` plus a `DPoP` proof made for this method, this URL and this token, fresh, used once |

## 2. The web app (apps/web)

| File | |
|---|---|
| `lib/oidc.ts` | `clientAssertion` (ES256; `iss` = `sub` = client id, `aud` = issuer, 60 s, random `jti`) · `pushAuthorization` (PAR with the assertion; returns the authorization URL with `client_id` and `request_uri` only) · `newDpopKey`, `dpopProof` (RFC 9449: `typ` `dpop+jwt`, public `jwk` in the header, `htm`, `htu`, `iat`, `jti`, `ath` when a token is sent) · `exchangeCode`, `refreshTokens` (assertion + proof) · `endKeycloakSession` (assertion) |
| `lib/session.ts` | the session keeps its DPoP key pair next to its tokens (server memory, like the tokens; one replica until pilot gate PG-7) |
| `app/auth/callback` | makes the session's DPoP key before the code exchange, so the first token is already bound |
| `lib/core.ts` | every call: `Authorization: DPoP <token>` and a fresh proof; refresh with the same key |
| `lib/config.ts` | `OIDC_CLIENT_KEY_FILE` (required, PKCS#8 PEM from the cell's secret store) and `OIDC_CLIENT_KEY_ID` |

**Inside a cell.** The app reaches Keycloak by its internal URL (`OIDC_INTERNAL_URL`) and signs its token-endpoint
proofs for that URL. Keycloak must then check `htu` against the URL the app used, not the public one: with
`hostname-backchannel-dynamic` on. The Keycloak manifest (`infra/k8s/keycloak/keycloak.yaml`) sets only the public
hostname today, and the test harness uses one URL for both, so this setting and a sign-in through the internal URL are
**to be added and confirmed on the staging cell** before the pilot (recorded with PG-8).

**Key handling.** The client key is generated outside the app (P-256), its private half mounted as a secret, its public
half written into the realm with `apply-realm-policy.py --web-client-jwks FILE`. Rotation: add the new public key to
the client's key set, deploy the app with the new key and `kid`, then remove the old public key. DPoP keys are per
session and die with it.

## 3. The core (services/core)

| File | |
|---|---|
| `token-verifier.ts` | a token with `typ` DPoP must carry `cnf.jkt` (a 43-character thumbprint); a Bearer token must not; any other `cnf` is refused; `azp` is returned as the client |
| `dpop.ts` | `verifyDpopProof`: refuses a header key with private parts; signature with the embedded key (ES256, ES384, PS256, RS256, EdDSA), `typ` `dpop+jwt`; key thumbprint = `cnf.jkt`; `htm` = method; `htu` (query and fragment ignored) = one of the core's public base URLs + path; `iat` within ±60 s; `ath` = SHA-256 of the token; `jti` 8–256 characters and **never seen before** |
| `identity.guard.ts` | a bound token is accepted only with the `DPoP` scheme and a valid proof; a bearer token from a client that must use DPoP (`DPOP_REQUIRED_CLIENTS`, default `civora-web,civora-mobile`) is refused; refusals carry `WWW-Authenticate: DPoP` with the allowed algorithms |
| migration `iam-dpop-jti` | `iam.dpop_jti` (digest of key thumbprint + `jti`, expiry; row-level security on) and `iam.claim_dpop_jti(digest, ttl)`: insert-if-absent, returns false on a replay, sweeps at most 200 expired rows per call. Proofs live 60 s, so rows live 120 s |

`CORE_PUBLIC_URLS` lists the base URLs the core is reached under (the proofs' `htu`); without it (dev, test), the
request's own scheme and host.

## 4. Realm (infra/keycloak)

| Client | Settings | Checked by |
|---|---|---|
| `civora-web` | confidential, `client-jwt`, assertions ES256/PS256/EdDSA, key pinned (`use.jwks.url` false), PAR required, DPoP-bound tokens | `check-realm-security.py` (citizens profile) with 4 negative controls (client secret, public, no PAR, no DPoP); live: the pinned key set must not be empty |
| `civora-mobile` | public (a native app cannot keep a secret), PKCE S256, **PAR required, DPoP-bound tokens** | same checker, 2 negative controls (no PAR, no DPoP) |

The end-to-end harness signs its many test users in through a **test-only** public client `civora-test-app`, a copy of
`civora-web` without the confidential, PAR and DPoP settings, created by `run.sh` after the realm has been checked and
exported (it never appears in a realm file or a conformance check).

## 5. What G4 still leaves open (ASVS rows stay "Partial")

ASVS V10.4.13 says "**always**" with PAR and V10.4.14 "**only**" sender-constrained tokens: one client without them
keeps the row partial. The remaining clients:

| Client | Gap | When |
|---|---|---|
| `civora-workspace` (staff realm) | public, no PAR, bearer tokens | with the Workspace app (Phase 6), built as a backend-for-frontend like the web app: same settings, same tests |
| `civora-mobile` | set in the realm (PAR, DPoP); no app yet, so not exercised end to end; it stays a **public** client (V10.4.16 deviation for a native app, to record when the app is built: a key in the device's secure hardware for DPoP, no client secret) | with the mobile app (A2, doc 10) |
| Relying parties (`rp-example-agency`) | client secret, no PAR, bearer tokens (their tokens are not accepted by the core: no `civora-core` audience) | at relying-party onboarding: `private_key_jwt` with the agency's key, PAR, DPoP |
| `civora-core-provisioner` | client secret (service account the core uses towards Keycloak) | move to `private_key_jwt` with the core's key |
| Keycloak's built-in account console (`account-console`) | Keycloak's own public client, code flow without PAR | decide: turn it off for citizens (the web app already covers security settings) or record a deviation |
| The edge gateway | the `/v1/*` route's token check (APISIX `openid-connect`, `bearer_only`) reads only `Authorization: Bearer`; DPoP requests from outside the cell (the mobile app) need a DPoP-aware check there | with ADR-030 / G5 (edge gateway and domain) and the mobile app. The web app calls the core inside the cell, not through this route |

## 6. Tests and results (26 Nov 2026)

| Level | What | Result |
|---|---|---|
| Unit, core | `dpop.test.ts`: fresh proof accepted once, replay refused; other method, URL, token, too old, from the future; other key; private key in the header, wrong `typ`, garbage; several public base URLs, query ignored; configuration · `token-verifier.test.ts`: DPoP type with `cnf.jkt` accepted (client returned), DPoP type without it, Bearer with `cnf`, unsupported `cnf` refused | 122 of 122 core tests pass |
| End to end, core + PostgreSQL | `identity.e2e.test.ts`: a bound token works only with a fresh proof for this request and key, once; never as a bearer token; replay table as the application role | 18 of 18 |
| Unit, web | `bff.test.ts`: PAR request with assertion, authorization URL carries only `client_id` and `request_uri`; code exchange with assertion and DPoP proof (claims checked); core calls with the DPoP scheme and a proof (`ath`, `htu`, `htm`); missing key file refused at start | 24 of 24 |
| Realm conformance | checker on the realm files and on the live realms, with the new negative controls | pass |
| Against Keycloak 26.8.1 and the core (`infra/tests/keycloak-realms/run.sh`, part `negative`) | **N24** no client assertion → `invalid_client` · **N25** an authorization request not pushed first → `error=invalid_request`, no sign-in page; the same for `civora-mobile`, whose pushed request is accepted (201) · **N26** the web app's sign-in (PAR + assertion + DPoP) gives `token_type` DPoP and `cnf.jkt` = the session key's thumbprint · **N27** that token sent as a bearer token, without a proof, with another key's proof, with a replayed proof or a proof for another URL → 401; with a fresh proof from its key → 200 | see the run record in the progress log |
| Web, end to end in ar/fr/en (part `web`) | every screen of doc 09 through the confidential client, PAR and DPoP | see the run record in the progress log |

## 7. ASVS rows (doc 11)

| Requirement | Before | Now | Why not Met |
|---|---|---|---|
| V10.3.5 resource server requires sender-constrained tokens | Gap | Partial | the core requires DPoP for `civora-web` and `civora-mobile` tokens; staff tokens (`civora-workspace`) are still bearer |
| V10.4.12 `response_mode` restricted per client | Gap | Partial | PAR fixes it for the web and mobile apps; not yet for the workspace client and relying parties |
| V10.4.13 code grant always with PAR | Gap | Partial | §5 |
| V10.4.14 only sender-constrained tokens | Gap | Partial | §5 |
| V10.4.16 confidential clients with `private_key_jwt` or mTLS | Gap | Partial | the web app: yes; relying parties and the provisioner still use secrets; the mobile app cannot be confidential |
