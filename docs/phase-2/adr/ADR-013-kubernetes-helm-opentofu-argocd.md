# ADR-013: Kubernetes (RKE2/k3s), Helm, OpenTofu, Ansible, Argo CD pull deployments

| | |
|---|---|
| Status | **Accepted** — approved by the founder on 21 Nov 2026 (decision P2-D1; [decision record](../founder-review/P2-founder-decision-record.md)) |
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

## Open question found on 19 Nov 2026 (not decided here)

- **The ingress controller named in Phase 0 is no longer maintained.**
  - Phase 0 §8 chose "NGINX ingress (MVP) → APISIX/Kong at pilot".
  - The Kubernetes project retired the community **ingress-nginx** controller in March 2026: no further releases, bug fixes or security updates. Sources: [retirement notice, 11 Nov 2025](https://kubernetes.io/blog/2025/11/11/ingress-nginx-retirement/) and [Steering/SRC statement, 29 Jan 2026](https://www.kubernetes.io/blog/2026/01/29/ingress-nginx-statement/).
  - RKE2 installs its packaged ingress-nginx unless it is disabled. The `rke2` role does not disable it yet.
- **Options for the founder (P2-D1)** — all keep the Phase 0 pilot target:
  - (a) use **APISIX from the MVP**, bringing the Phase 0 pilot choice forward; it also implements the Kubernetes Gateway API;
  - (b) a maintained NGINX-based controller (F5 NGINX Ingress Controller, a different project);
  - (c) a Gateway API implementation (for example Envoy Gateway or Traefik) until APISIX/Kong at pilot.
- **Engineering recommendation: (a).** It avoids one migration, and the public edge then gets the rate limiting and API keys Phase 0 asked for at pilot.
- **Drafted as [ADR-030](ADR-030-api-gateway-apache-apisix.md) (Proposed, 20 Nov 2026)** so it can be approved or rejected like any other decision.
- **Nothing is changed until the founder decides.** Exposing an unpatched controller to the internet would breach Phase 0 §10, so before staging goes public either:
  - this decision is made; or
  - `rke2-ingress-nginx` is disabled and access stays private.

## Revisit when

Provider selection; first staging rebuild (O-AC1).
