# 03 — Issuance with OpenID4VCI 1.0 (demo issuers)

| | |
|---|---|
| Specification items | P4-D1 issuer service (demo issuers), P4-A1 OpenID4VCI, P4-API1 `POST /v1/issuers/{id}/credential-offers`, P4-API2 `POST /v1/oid4vci/token` and `/credential`, P4-API6 `GET /v1/status-lists/{id}`, P4-F1 add a credential by offer QR, P4-SEC1 holder binding, P4-SEC2 replay protection, P4-SEC4 no personal data in the QR |
| Built | 27 Nov 2026 (week 2) |
| Code | `services/core/src/modules/wallet/` (`issuance.ts`, `proofs.ts`, `oid4vci.controller.ts`, `wallet.repository.ts`, `wallet.config.ts`, `demo-source.ts`); migration `1764979200000_wallet-issuance.sql` |
| Tests | `issuance.e2e.test.ts`: the application, PostgreSQL (least-privilege role) and the issuer key in SoftHSM made by the ceremony script |
| Profile | OpenID4VCI 1.0 (Final), pre-authorised code flow with a transaction code; HAIP 1.0 where it applies: ES256, DPoP-bound access tokens, key proofs with a server nonce, `dc+sd-jwt` |

## 1. The flow

```
citizen (web app, signed in)        core (issuer)                         wallet app (holder)
 POST /v1/issuers/{slug}/credential-offers ─► offer: pre-authorised code (single use, 10 min)
 ◄── credential_offer + offer_uri (QR) + tx_code (6 digits, shown once, never in the QR)
                                                                 scan QR, type tx_code
                                     POST /v1/oid4vci/token ◄──── code + tx_code + DPoP proof (wallet key)
                                     ──► access token bound to the DPoP key (5 min, one credential)
                                     POST /v1/oid4vci/nonce ◄──── 
                                     ──► c_nonce (single use, 5 min)
                                     POST /v1/oid4vci/credential ◄ DPoP token + proof (ath) + key proof (device key, c_nonce, aud)
                                     ──► SD-JWT VC: cnf = device key, status = random index, signed in the HSM
```

Metadata: `/.well-known/openid-credential-issuer/issuers/{slug}` (credential configurations, display in ar/fr/en,
ES256 key proofs, the nonce endpoint) and `/.well-known/oauth-authorization-server/issuers/{slug}` (the token endpoint,
the pre-authorised grant with anonymous access, DPoP with ES256). The issuer identifier is
`<WALLET_PUBLIC_URL>/issuers/<slug>`; the core refuses to serve an issuer whose registered identifier differs.

## 2. Security decisions

| Topic | Decision |
|---|---|
| What the QR holds (P4-SEC4) | the issuer identifier, the configuration id and the pre-authorised code. No name, no person id, no claim. The transaction code is never in it |
| Codes at rest | only SHA-256 digests of the pre-authorised code, the access token and nonces are stored. The 6-digit transaction code is stored as a digest **salted with the pre-authorised code**, which the cell does not keep: a copy of the database does not reveal it, and cannot be used to redeem the offer |
| Guessing the transaction code | 5 wrong codes kill the offer, even for the right code afterwards; at most 5 open offers per person; an offer lives 10 minutes (the schema allows at most 30) |
| Token theft | the access token is bound to the wallet's DPoP key (RFC 9449): the credential endpoint needs a proof by that key for that request and that token (`ath`), fresh (60 s) and used once. A bearer token is refused with `WWW-Authenticate: DPoP` |
| Holder binding (P4-SEC1) | the credential's `cnf.jwk` is the key of the key proof (`openid4vci-proof+jwt`, ES256, audience = the issuer, fresh `iat`, a `c_nonce` from the nonce endpoint used once). The issuer records the key's RFC 7638 thumbprint, not the key. The DPoP key and the device key may differ (the test uses two) |
| Replay (P4-SEC2) | pre-authorised codes, access tokens, c_nonces and DPoP proof identifiers are each single use, enforced by the database (row locks, unique digests) |
| One credential per token | a token is marked used in the same transaction that records the issuance; refused requests (a bad proof, an unknown nonce) do not use it up |
| Failure after recording | if signing fails after the issuance was recorded, the record is revoked at once (`issued-in-error`), so a status index is never left valid without a credential |
| Claims | from the demo source only (synthetic, derived from the person id and type; Q4-1); never stored by the issuer |
| Status lists (P4-API6) | signed by the issuer key per list version, served as `application/statuslist+jwt`, `exp` 24 h (Q4-4 default, `WALLET_STATUS_LIST_VALIDITY_SECONDS`), `ttl` 5 minutes; cached per version, so a change is visible at the next request |
| Errors | OAuth 2.0 / OpenID4VCI error codes (`invalid_grant`, `invalid_dpop_proof`, `invalid_token`, `invalid_proof`, `invalid_nonce`, `unknown_credential_configuration`), `Cache-Control: no-store`; no detail about whether a code exists |

## 3. Configuration

`WALLET_PUBLIC_URL` (https base URL; without it the wallet endpoints answer 503), `WALLET_HSM_MODULE` (PKCS#11 module),
`WALLET_HSM_PIN_ENV` (name of the PIN variable, default `CIVORA_HSM_PIN`), `WALLET_STATUS_LIST_VALIDITY_SECONDS`.
Issuers and types are registered from the ceremony record (doc 02, step 7).

## 4. Tests (27 Nov 2026)

`issuance.e2e.test.ts`, 4 of 4 pass (with the whole core suite: 158 of 158):

| Test | Checks |
|---|---|
| metadata | issuer and authorization-server metadata; the configuration, `dc+sd-jwt`, ES256, DPoP; an unknown issuer is 404 |
| issue → hold → verify → revoke | an offer needs a signed-in person; the QR has no personal data and no transaction code; DPoP-bound token; credential with `typ dc+sd-jwt`, `kid` of the ceremony; the holder discloses only the locality, bound to a verifier nonce, and the library verifies it with the **public key from the ceremony record**; another device key cannot present it; the status list reads valid, then, after the issuer revokes, invalid |
| token endpoint refusals | no DPoP proof; a DPoP proof made for another URL; a wrong transaction code; a code used twice; five wrong transaction codes lock the offer even for the right code |
| credential endpoint refusals | a bearer token (401, `WWW-Authenticate: DPoP`); a DPoP proof by another key; an unknown c_nonce; a key proof for another issuer; another configuration; a second credential with the same token; a c_nonce used twice |

Interoperability of the credential format with an independent implementation is covered in doc 01 §1; an external
wallet app against these endpoints is week 6 (P4-T2).
