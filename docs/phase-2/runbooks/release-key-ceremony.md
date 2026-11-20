# Runbook — release signing key: ceremony, use, rotation, compromise

| | |
|---|---|
| Applies to | The CIVORA release key that signs every production image; cells admit only images signed with it (ADR-027 proposed revision; `infra/k8s/policies/image-signatures.yaml`) |
| Status | **Draft, Phase 2.** The mechanics below are **tested** on GitHub runners by `infra/tests/image-signatures/run.sh`. The key itself does not exist yet: creating it needs **two people** and the founder's decision P2-D2 |
| Decisions it depends on | ADR-027 (supply chain), ADR-007 (secrets: OpenBao). Both **Proposed** |

## 1. Design

| Property | How |
|---|---|
| Where the private key lives | OpenBao **transit** engine, key `civora-release`, type ECDSA P-256. It is generated inside OpenBao with `exportable=false`, so nobody — root included — can read it (tested: export refused) |
| Which OpenBao | A **release** OpenBao, separate from the cells' OpenBao. 3 nodes (Raft). Unseal with Shamir **3 of 5** shares held by named people, or an HSM if a provider offers one |
| Who can sign | Only the release pipeline. GitHub Actions logs in with its OIDC token (JWT auth role bound to repository, branch `main` and workflow `ci.yml`). It receives a **15-minute** token with policy `ci-signer`: sign with `civora-release`, read its public key — nothing else (tested: rotate and reconfigure refused) |
| Who verifies | Every cell. The public key is distributed as Secret `cosign-system/civora-release-key` (External Secrets). policy-controller admits only images signed with it (tested: signed image admitted by digest and by tag; unsigned and unknown images refused) |
| Transparency log | Not used (`--tlog-upload=false`): verification is offline, as banks' on-premises cells require. The signature and SBOM attestations travel with the image in the registry |

Today, CI on `main` signs **keyless** (Sigstore). That proves the GitHub identity, but not CIVORA's release key. After the ceremony, the `image` job switches to `cosign sign --key hashivault://civora-release` after the OpenBao login. This is a two-line change, kept until the key exists.

## 2. The ceremony (once; then at each rotation)

**People:**
- the founder;
- a second person (engineer or adviser), as witness and second share-holder.

**Shares:** five Shamir shares, at least three needed. Holders:
- the founder;
- the second person;
- three sealed envelopes in two different safes (bank safe, office safe).

**Evidence:** a signed record with date, people present, steps and key fingerprint, kept with the security records.

1. Build the release OpenBao from IaC (Argo CD app, same chart and values as the cells' OpenBao, its own namespace or cluster). Initialise it with 5 shares, threshold 3. The root token is used for steps 2–5, then revoked.
2. `bao secrets enable transit`
3. `bao write -f transit/keys/civora-release type=ecdsa-p256 exportable=false` (deletion stays disabled by default).
4. Policy `ci-signer`:

   ```hcl
   path "transit/sign/civora-release"   { capabilities = ["update"] }
   path "transit/sign/civora-release/*" { capabilities = ["update"] }
   path "transit/keys/civora-release"   { capabilities = ["read"] }
   ```

5. JWT auth for GitHub Actions. Role `ci-release`:
   - bound claims: `repository` = this repository; `ref` = `refs/heads/main`; `workflow_ref` = this repository's `ci.yml`;
   - token TTL 15 min;
   - policy `ci-signer`.
6. Revoke the root token (`bao token revoke -self`).
7. Export the **public** key:
   - `cosign public-key --key hashivault://civora-release > civora-release.pub`;
   - record its SHA-256 fingerprint in the evidence;
   - publish it to each cell's OpenBao for External Secrets.
8. Switch CI to the key (§1). The first signed release is verified on staging. Check that an unsigned test image is refused there.

## 3. Rotation (yearly, or when a holder leaves)

1. `bao write -f transit/keys/civora-release/rotate` (needs a privileged token, created with the shares and revoked after use).
2. Publish the new public key **alongside** the old one. The ClusterImagePolicy accepts either during the overlap: two `key` authorities.
3. Re-sign the images still deployed, then remove the old public key from the policy.
4. Rotate the Shamir shares if a holder left (`bao operator rekey`).

## 4. Suspected compromise

1. Disable the JWT role. Revoke all `ci-signer` tokens.
2. Rotate the key (§3) and remove the old public key from every cell **immediately**, not after an overlap.
3. Rebuild and re-sign the current releases from tagged source. Running pods keep running; new pods need the new signatures.
4. Review OpenBao's audit log: every sign request is logged with the token that made it.
5. Incident record. Notify affected tenants if a malicious image could have been admitted.

## 5. What is tested, and where

| Property | Test | Result |
|---|---|---|
| Key generated inside OpenBao; export refused | `infra/tests/image-signatures/run.sh` (nightly) | See [17](../17-technical-validation-strategy.md) R36 |
| Signer token can sign but cannot export, rotate or reconfigure | Same | Same |
| Image signed through OpenBao is admitted; unsigned and unknown refused | Same (k3s + policy-controller + private TLS registry) | Same |
| Shamir unseal and JWT login from GitHub | Not testable without the release OpenBao | At the ceremony |
