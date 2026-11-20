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

## Revisit when

Before pilot (admission verification).
