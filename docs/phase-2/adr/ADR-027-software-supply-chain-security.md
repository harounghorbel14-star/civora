# ADR-027: Software supply-chain security

| | |
|---|---|
| Status | **Proposed — awaiting founder approval (acceptance criterion O-AC2)** |
| Date | 19 November 2026 |
| Origin | New in Phase 2 |
| Covers | O-SEC2, O-SEC3, O-T2 |
| Deciders | Founder (approval); engineering (author) |

## Context

- Every cell runs the same images; a compromise in the pipeline reaches all of them (Phase 0 §10.7).

## Decision

- Exact version pins + lockfile integrity; dependency install scripts blocked by default; security overrides documented.
- Third-party CI actions pinned to commit SHAs; read-only workflow token by default.
- Gates: CodeQL, gitleaks (full history), `pnpm audit`, Trivy (fixable HIGH/CRITICAL fail), Checkov.
- CycloneDX SBOM per image; cosign keyless signatures and SBOM attestations; SLSA build provenance.
- Runtime images contain no package managers; code owned by root, run as UID 10001.
- Deploy by digest; signature verification at admission before pilot.

## Consequences

**Positive**

- Verifiable artefacts for customers and auditors (tier-4 bundles).

**Negative / costs**

- Pinned dependencies need active updating (Dependabot, weekly).

## Alternatives considered

| Option | Outcome |
|---|---|
| Floating versions | Rejected |

## Validation

- Trivy fixable HIGH/CRITICAL 21 → 0; SBOM 878 components; gitleaks clean; Checkov Dockerfile 31/31, Actions 36/36. Signing and provenance run on GitHub (`main`).
- Admission (20 Nov 2026):
  - a built-in Kubernetes ValidatingAdmissionPolicy allows only the cell's registries and digest-pinned images (`infra/k8s/policies`);
  - it was tested on a Kubernetes 1.33 API server: 10 cases, including a look-alike registry prefix and fail-closed parameters.
- Signature verification at admission is still to come (before pilot).

## Proposed revision, 20 Nov 2026 (part of the same approval; nothing approved yet)

- **What changes:** admission in cells verifies a **CIVORA release key** (cosign, key-based), not the keyless signature.
- **Why:**
  - Keyless signatures (public Sigstore: Fulcio and Rekor) can only be verified at admission with network access to those foreign services, or with an offline trust root kept up to date.
  - Air-gapped and customer-hosted cells (ADR-019) cannot depend on that.
  - A key-based signature verifies with the public key alone.
- **How:**
  - CI keeps keyless signing and SLSA provenance (traceability to the GitHub build).
  - The release step adds a signature with the CIVORA release key. The private key lives in OpenBao/HSM (ADR-012) and is used under M-of-N; the public key ships in every cell and every customer bundle.
  - Third-party images are mirrored into the cell registry by digest, checked, then signed with the same key.
  - In enforced namespaces, images that match no policy are refused (`no-match-policy: deny`).
- **Built:**
  - `infra/k8s/policies/image-signatures.yaml` (ClusterImagePolicy);
  - Sigstore policy-controller 0.10.8 as a platform app, with values that meet restricted Pod Security (the chart defaults do not: control kept);
  - `infra/tests/image-signatures/run.sh`, which on GitHub runners checks that a signed image is admitted (by digest and by tag), an unsigned image is refused, an image matching no policy is refused, and unlabelled namespaces are unaffected.
- **Still open:** the release-key ceremony (key creation in OpenBao/HSM, custody, rotation); with one engineer this depends on P2-D2.

## Revisit when

Before pilot (admission verification).
