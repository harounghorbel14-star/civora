# ADR-013: Kubernetes (RKE2/k3s), Helm, OpenTofu, Ansible, Argo CD pull deployments

| | |
|---|---|
| Status | **Proposed — awaiting founder approval (acceptance criterion O-AC2)** |
| Date | 19 November 2026 |
| Origin | Phase 0 §8.12 backlog item 013 (topic unchanged) |
| Covers | O-D5, O-D6, O-T3, R-2 |
| Deciders | Founder (approval); engineering (author) |

## Context

- Must run on Tunisian labelled clouds, CNI and customer premises; no exotic managed services (Phase 0 §8.1).
- CI must never hold production credentials for cells (Phase 0 §8.2).

## Decision

- **RKE2** (CIS profile, secrets encryption) for staging, pilot, production and customer-hosted cells; **k3s** for local rehearsal and very small edge cells. Both are in Phase 0's "k3s/RKE2".
- Helm chart per application; restricted Pod Security on every namespace; non-root, read-only, no capabilities; default-deny NetworkPolicy; images by digest outside dev.
- OpenTofu for the hosting layer (provider adapter after E-07), Ansible for OS, RKE2 and the Argo CD bootstrap.
- **Argo CD pulls** from Git and the registry. Staging auto-syncs; production syncs manually with two approvals.
- Service mesh (mTLS between services) deferred until a second service runs; TLS to databases from day one.

## Consequences

**Positive**

- Same artefacts for SaaS and on-premises; air-gap path designed.

**Negative / costs**

- Kubernetes operational skills required; RKE2 roles to be run on real hosts.

## Alternatives considered

| Option | Outcome |
|---|---|
| Plain VMs + systemd | Rejected: weaker portability and rollout safety |
| OpenShift | Rejected: licence cost for small cells |

## Validation

- Chart lint + server-side validation on Kubernetes 1.33 under restricted PSA; Argo CD objects validated against v3.4.13 CRDs; OpenTofu validate/plan; ansible-lint production profile; Checkov. Full k3s rehearsal scheduled in nightly CI (could not run in the sandbox).

## Revisit when

Provider selection; first staging rebuild (O-AC1).
