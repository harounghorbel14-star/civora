# 04 — Holder library and wallet entries (P4-D2, P4-API3, P4-DB3)

| | |
|---|---|
| Specification items | P4-D2 holder wallet in the mobile app (its library), P4-F1 add a credential by offer QR, P4-F2 selective disclosure, P4-API3 `GET /v1/wallet/credentials`, P4-DB3 encrypted backup metadata, P4-SEC1 holder binding (device keys) |
| Built | 27 Nov 2026 (week 3) |
| Code | `packages/holder` (`@civora/holder`); `services/core/src/modules/wallet/wallet-entries.controller.ts`; `disclosuresOf` in `@civora/credentials` |
| Tests | `packages/holder/src/holder.test.ts` (3); `issuance.e2e.test.ts` "the holder library …" (the library against the running issuer and the wallet API) |
| Not yet | the app's screens: the holder lives in the mobile app, which waits on the Phase 3 mobile job (Q4-5). The library is the part the app will call |

## 1. The library

| Function | What it does | Refuses |
|---|---|---|
| `parseOffer` | reads `openid-credential-offer://?credential_offer=…` (by value) | `credential_offer_uri` (by reference: not needed by CIVORA issuers, and a fetch to a URL from a QR is an SSRF risk on some platforms), non-https issuers, other grants, empty configurations, malformed or over-long offers |
| `Holder.accept(offer, txCode)` | issuer metadata, authorization-server metadata, a DPoP-bound token (a fresh DPoP key per issuance), a c_nonce, a key proof by a **new device key for each credential**, then checks the credential **before keeping it**: the issuer's signature with keys from its JWT VC issuer metadata (`/.well-known/jwt-vc-issuer/…`), the type asked for, the issuer, and that `cnf` is the new device key | any mismatch: the device key is deleted and nothing is kept |
| `Holder.claims(id)` | every claim, opened on the device, for the person to read | |
| `Holder.present(id, paths, {aud, nonce})` | only the chosen claims (`disclosuresOf` finds each disclosure's path in the credential itself; a nested claim brings its parent's disclosure), with a key-binding JWT signed by the device key | an expired credential |
| `Holder.status(id)` | reads the credential's status list, checks its signature with the issuer's key | |
| `Holder.backupEntry(id, key)` | the entry for P4-API3: metadata in clear, the credential encrypted with AES-256-GCM (additional data `civora-wallet-backup-v1`), the key's identifier | a key that is not 32 bytes |
| `decryptBackup` | opens a backup with the right key | a wrong key, any altered byte |

The key store and the credential store are interfaces: the app supplies the platform's secure hardware (keys that
cannot leave the device) and encrypted storage; tests use the in-memory ones. **One device key per credential**: two
credentials of the same person cannot be linked through their `cnf` keys.

## 2. Wallet entries (P4-API3, P4-DB3)

`GET /v1/wallet/credentials`, `POST /v1/wallet/credentials`, `DELETE /v1/wallet/credentials/{id}`, for the signed-in
person only (row-level security, doc 01). An entry holds the type, issuer, dates and status reference in clear (to list
it, check its status and remind before expiry, P4-D5), and optionally the backup ciphertext with its key identifier.
The cell cannot open the backup. Limits: 200 entries per person; ciphertext 29 bytes to 64 KiB; https issuers and status
URIs only.

The backup key: generated on the device and kept by the person's recovery path (Q4-5, with the mobile app; for example
wrapped by a passkey-derived key or written down as a recovery code). Its identifier is a SHA-256 digest under a fixed
label, so it reveals nothing about the key.

## 3. Results (27 Nov 2026)

| Test | Result |
|---|---|
| Offer parsing (7 refusals), well-known URIs, backup encryption (fresh IV, wrong key, altered byte, key size, key id) | 3 of 3 pass |
| Library against the running issuer: accept with the transaction code; type, issuer and display names kept; all claims readable on the device; a presentation of the locality only verifies at the library's verifier with no other claim; status valid; a wrong transaction code fails with nothing kept | pass |
| Wallet API: entry stored and listed; the backup opens with the device key and gives back the same credential; the credential is not stored in clear; another person sees nothing and cannot delete; an http issuer or a too-short ciphertext is refused; delete works | pass |
| Credential library: `disclosuresOf` finds every disclosure's path, and selection of a nested claim brings its parent | pass (19 of 19 in the package) |
