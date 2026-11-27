# 01 — Wallet data model (P4-DB1 … P4-DB5) and the credential library

| | |
|---|---|
| Specification items | P4-DB1 `wallet.issuer`, P4-DB2 `wallet.credential_type`, P4-DB3 `wallet.credential` (encrypted backup metadata), P4-DB4 `wallet.status_list`, P4-DB5 `wallet.presentation_log`; P4-A2 (SD-JWT VC), P4-D4 (status lists), P4-T2 (interoperability) |
| Built | 27 Nov 2026 (week 1) |
| Code | `services/core/migrations/1764892800000_wallet-credentials.sql`; `packages/credentials` (SD-JWT, SD-JWT VC, Token Status List, PKCS#11 signer) |
| Tests | `services/core/src/modules/wallet/wallet.db.test.ts` (PostgreSQL, least-privilege role); `packages/credentials/src/*.test.ts` |
| Data | Synthetic only (ADR-025). Demo issuers; credential types under `urn:civora:tn:synthetic:` (the schema refuses any other) |

## 1. The credential library (`@civora/credentials`)

One implementation of the formats, used by the issuer, the verifier and the holder library, so the three cannot
drift apart.

| Module | Standard (revision used) | What it does |
|---|---|---|
| `jws.ts` | RFC 7515, HAIP 1.0 | compact JWS with a `Signer` that never exposes its key (HSM, device key, test key); ES256 only; `none` and HMAC refused |
| `sd-jwt.ts` | RFC 9901 | issuance with digests (`_sd`, `...` in arrays), decoys, sorted digests; holder selection (a nested claim brings its parent's disclosure); key-binding JWT (`kb+jwt`, `aud`, `nonce`, `iat`, `sd_hash`); verification refuses forged or altered signatures, `alg: none`, a wrong `typ`, foreign or repeated disclosures, a claim both in clear and disclosed, a stale or replayed key binding, a changed disclosure set, expiry and not-before (one minute of skew) |
| `sd-jwt-vc.ts` | draft-ietf-oauth-sd-jwt-vc-26 | `typ: dc+sd-jwt`, `vct`, `cnf.jwk`, `status`; `iss`, `nbf`, `exp`, `cnf`, `vct`, `vct#integrity` and `status` can never be selectively disclosable (refused at issuance and at verification); accepted types per verifier |
| `status-list.ts` | draft-ietf-oauth-status-list-21 | bit arrays of 1, 2, 4 or 8 bits per credential; index 0 in the least significant bits of byte 0; ZLIB, base64url; signed `statuslist+jwt` with `sub`, `iat`, `exp`, `ttl`; reading checks the signature, the URI, expiry and the index; decompression bounded (16 MiB) |
| `pkcs11.ts` | PKCS#11 through OpenSC | issuer keys in the HSM (doc 02) |

Interoperability (P4-T2, first part): the OpenWallet Foundation's `@sd-jwt/sd-jwt-vc` 0.24.3 (Apache-2.0, released
3 Nov 2026), used only in tests, plays the external issuer, holder and verifier. CIVORA credentials are presented by the
external holder and accepted by the external verifier, including key binding and CIVORA's status list (a revoked index
is refused there); external credentials are accepted by CIVORA's verifier, with the claims the external holder chose and
no others; a wrong nonce is refused on both sides. An external *wallet* (an app) is the second part of P4-T2 (week 6).

## 2. Tables

| Table | Spec | Tier | Holds | Who may change it |
|---|---|---|---|---|
| `wallet.issuer` | DB1 | T3 (published) | slug, issuer URL, names in ar/fr/en, `kid`, public JWK (P-256 only, never `d`), HSM token label and key id | `wallet.register_issuer()` only; the function copies `kty`, `crv`, `x`, `y` and nothing else from the JWK it is given |
| `wallet.credential_type` | DB2 | T3 | `vct` (synthetic namespace only), names, claim paths, which are selectively disclosable (a subset of the claims), validity, renewal service in the catalogue (P4-F6), reminder days (P4-D5), status bits | `wallet.register_credential_type()`; processing claims (`iss`, `exp`, `cnf`, `vct`, `status`, …) can never be subject claims |
| `wallet.status_list` | DB4 | T3 | bit array (raw; compressed and signed when served, P4-API6), bit width, size, allocated count, version | `wallet.record_issuance()` and `wallet.set_credential_status()` only |
| `wallet.issued_credential` | (issuer side of D1, F5) | T1 | type, subject (a person id), the holder key's RFC 7638 thumbprint (P4-SEC1), status list and index, expiry, status and reason. **No claim values** | functions only; the subject can read their own rows |
| `wallet.issued_credential_event` | (audit) | T1 | issued, suspended, reinstated, revoked; reason; actor (`holder:`, `staff:` or `issuer-system:`) | append-only, through the functions |
| `wallet.credential` | DB3 | T1 | the holder's wallet entries: type, issuer, dates, status reference in clear (to list them, check status and remind before expiry); the credential itself only as an AES-GCM backup encrypted on the device, with the thumbprint of the device key; the cell never holds that key | the person, through row-level security (`app.person_id`) |
| `wallet.verifier` | (Q4-3) | T3 | a pre-registered `client_id` (OpenID4VP 1.0, no prefix: the cell is the registry until a trust framework exists), names, request-signing public key and its HSM reference (the private key is made by the same ceremony as issuer keys, doc 02), credential types and claims it may ask for | `wallet.register_verifier()`; only known types |
| `wallet.presentation_log` | DB5 | T2 | verifier, request, result, reason code, credential types and **claim names** disclosed; never values, never the holder (P4-SEC4) | insert only; no update or delete |

The wallet module refers to people by the id the identity-access module gives them, without a foreign key into `iam`
(ADR-001: no access across module schemas).

## 3. Status indexes and status values

- A new credential gets a **random free index** in its issuer's current list of the type's bit width (random bytes
  from `gen_random_uuid()`), so the index says nothing about issuance order or time (status list draft §12, herd
  privacy). A list is 131 072 entries; a new one starts when it is 90 % allocated. One issuance at a time per list (row
  lock).
- Values: 0 valid, 1 invalid (revoked), 2 suspended. Types use 2 bits by default so that suspension is possible.
- **Revocation is final**: a revoked credential cannot be reinstated or suspended. A suspended one can be reinstated
  (reason `review-cleared`). Every change bumps the list version and writes an event.
- The database's bit layout is the library's: the test reads the bytes written by `wallet.set_credential_status()`
  with `StatusList` and finds the same values.

## 4. Tests (week 1)

| Test | What it proves | Result (27 Nov 2026) |
|---|---|---|
| `wallet.db.test.ts` (PostgreSQL 16, role `civora_core_app`, NOBYPASSRLS) | registration through functions, private key parts dropped, processing claims and non-synthetic types refused; 20 issuances get 20 different, non-sequential indexes; expiry beyond the type's validity and malformed thumbprints refused; direct inserts and updates refused; suspend, reinstate and revoke set the right bits (read back with the library) and revocation stays final; a person sees only their own wallet entries and issued credentials, nobody sees any without a person; the presentation log takes claim names only and cannot be changed | 5 of 5 pass |
| `sd-jwt.test.ts`, `sd-jwt-vc.test.ts` | the RFC's disclosure digest example; issuance, selective disclosure, every refusal listed in §1 | 10 of 10 pass |
| `interop.test.ts` | the four interoperability cases of §1 | 4 of 4 pass |
| `pkcs11.test.ts` | doc 02 | 4 of 4 pass |
