# 02 — Issuer keys in the HSM and the key ceremony

| | |
|---|---|
| Specification items | P4-A5 "keys in HSM (dev: SoftHSM)", P4-SEC3 "issuer key ceremonies" |
| Built | 27 Nov 2026 (week 1) |
| Code | `packages/credentials/src/pkcs11.ts` (signer); `infra/scripts/issuer-key-ceremony.sh` (ceremony) |
| Tests | `packages/credentials/src/pkcs11.test.ts` (SoftHSM 2.6.1 and OpenSC 0.25 from Ubuntu 24.04; CI installs both and requires the test) |
| Open decision | **Q4-2**: the production HSM (vendor, certification, hosting) and who attends ceremonies. Until then: SoftHSM in dev and test, and this procedure rehearsed with it |

## 1. Design

- Each demo issuer has one ES256 (P-256) key pair, **generated inside the token**, with the private key *sensitive*
  and *never extractable*. The cell stores the public key and the reference to the private key (token label, key id)
  in `wallet.issuer` (doc 01); never the key.
- The service signs through **PKCS#11 using OpenSC's `pkcs11-tool`**. No native module is loaded into the Node
  service (ADR-027: no install scripts), and the same calls work with any PKCS#11 HSM. The service computes the SHA-256
  digest and the token signs it with `CKM_ECDSA` (SoftHSM 2.6 offers no `CKM_ECDSA_SHA256`); PKCS#11 returns `r || s`,
  which is the JWS form.
- The user PIN is never on a command line: `pkcs11-tool --pin env:NAME` reads it from an environment variable that the
  signer names. Inputs and outputs (a digest, a signature, the public key) pass through a private temporary directory.
- The signer checks itself when created: it signs a fresh 32-byte challenge and verifies it with the token's public key.
  A wrong PIN, token or key id therefore fails at start-up, not at the first credential.
- Cost: about 9 ms per signature with SoftHSM (one process per signature). Enough for issuance; a production HSM
  with a long-lived session is a deployment decision (Q4-2).

## 2. Ceremony procedure (P4-SEC3)

Roles: an **operator** who runs the steps and at least one **witness** who checks each step against this list; both are
named in the record. Production adds: the HSM's own administrator authentication (M of N cards, by the vendor's
procedure), a room log, and a video record where the HSM's procedure requires it (Q4-2).

| Step | Done by | Check |
|---|---|---|
| 1. Prepare | operator | the token is the cell's issuer token (label, serial number read back); the key id and `kid` are new; the record directory is empty for this `kid` |
| 2. Generate | `issuer-key-ceremony.sh` | `--keypairgen EC:prime256v1` on the token; the script refuses if an object with that id exists (a ceremony never replaces a key) |
| 3. Attributes | script, then witness | the private key is *sensitive*, *never extractable*, and can sign; otherwise the ceremony stops |
| 4. Public key | script | read from the token, converted to a JWK, P-256 checked, RFC 7638 thumbprint computed |
| 5. Proof | script | a signature over a fresh challenge, verified with the exported public key |
| 6. Record | script, then operator and witness | `<kid>.ceremony.json`: time, token label, serial and module, key label, id and attributes, public JWK, thumbprint, the proof result, operator, witnesses. No PIN, no private material |
| 7. Register | administrator | `wallet.register_issuer()` with the public JWK and token reference from the record; the thumbprint read aloud and compared with the record |
| 8. Archive | operator | the record kept with the cell's configuration history (signed commit); the thumbprint published with the issuer's metadata |

Key rotation is a new ceremony with a new id and `kid`; the old key stays on the token for status-list signing until
every credential it signed has expired. Compromise: suspend the issuer (`wallet.issuer.status`), revoke what it issued
through the status lists signed by the new key, and publish the new key.

## 3. Rehearsal and tests (27 Nov 2026, SoftHSM 2.6.1)

| Check | Result |
|---|---|
| A ceremony on a fresh token: key generated, attributes `sensitive, always sensitive, never extractable, local`, record written with the token serial | passed |
| The same key id again | refused ("an object with id … already exists") |
| No witness named | refused |
| A credential (SD-JWT VC) and a status list signed by the token verify with the **public key from the ceremony record**, through the library's verifier and status reader | passed |
| Wrong PIN, unknown key id, empty PIN variable, a PIN variable name that is not a variable name | refused when the signer is created |
| The PIN does not appear in the record | passed |
