# ADR-030: Edge API gateway and Kubernetes ingress — Apache APISIX

| | |
|---|---|
| Status | **Accepted with conditions** — approved by the founder on 21 Nov 2026 (decision P2-D1; [decision record](../founder-review/P2-founder-decision-record.md)). Condition: APISIX 3.19.0 pinned; Ingress Controller + etcd and WAF proven on staging before pilot (register §3.6) |
| Date | 20 November 2026 |
| Origin | New in Phase 2. Amends Phase 0 §8 (technology table, "API gateway" row) **only if approved**; follows the open question recorded in ADR-013 |
| Covers | O-D6, O-AC1, R-2; Phase 0 §8 gateway requirements (rate limiting, mTLS, API keys for B2B, WAF integration) |
| Deciders | Founder (approval); engineering (author) |

## Context

- Phase 0 chose "NGINX ingress (MVP) → APISIX/Kong at pilot".
- The Kubernetes project retired the community **ingress-nginx** controller in March 2026: no further releases, bug fixes or security updates. Sources: [retirement notice, 11 Nov 2025](https://kubernetes.io/blog/2025/11/11/ingress-nginx-retirement/) and [Steering/SRC statement, 29 Jan 2026](https://www.kubernetes.io/blog/2026/01/29/ingress-nginx-statement/).
- The internet-facing edge is the most exposed component of a cell. An unpatched edge would breach Phase 0 §10.
- RKE2 (ADR-013) installs its packaged ingress-nginx unless it is disabled.

## Decision (proposed)

- **Apache APISIX** (Apache-2.0) is the edge API gateway and Kubernetes ingress from the MVP onwards. This brings forward the Phase 0 pilot choice instead of migrating at pilot.
- Routes are managed by the **APISIX Ingress Controller 2.x** from Kubernetes resources, using Gateway API and/or APISIX CRDs, and synced by Argo CD from Git.
- Configuration store: a dedicated 3-member **etcd**, built from the upstream etcd image and not from the Bitnami subchart (Bitnami's free images stopped being maintained in 2025).
  - The etcd-free "standalone API-driven" mode is not used for now: upstream labels it experimental ([ingress controller 2.0 release](https://apisix.apache.org/blog/2025/12/19/apisix-ingress-controller-2-0-release/), [getting started](https://apisix.incubator.apache.org/zh/docs/ingress-controller/getting-started/)).
- The admin API is reachable only from the controller (NetworkPolicy). The admin key comes from OpenBao; the default key is refused.
- RKE2 is configured with `disable: [rke2-ingress-nginx]`.
- Versions are pinned at implementation time. Each pinned release must be at least two weeks old and verified against its upstream tag. The current lines are APISIX 3.21 and Ingress Controller 2.2.0 (tag of 13 Aug 2026).

## Consequences

**Positive**

- A maintained edge from day one.
- Rate limiting, key authentication for B2B clients, mTLS to upstreams and JWT validation are built-in plugins, so the gateway work Phase 0 planned for the pilot is not done twice.

**Negative / costs**

- One more stateful component (etcd, 3 pods per cell), unless the standalone mode matures.
- Engineering effort: 3–5 days [A] (chart values, etcd, policies, admission and Pod Security compliance, tests, runbook).
- WAF integration (Phase 0 requirement) still needs validation: APISIX supports WASM plugins, and an OWASP Core Rule Set engine (Coraza) can run as one. To be proven on staging.
- APISIX has had admin-API vulnerabilities in the past when a default admin key was left in place. Hence: no default key, admin API not exposed, versions patched within the supply-chain policy (ADR-027).

## Alternatives considered

| Option | Outcome |
|---|---|
| Keep community ingress-nginx | **Rejected:** unmaintained since March 2026 |
| F5 NGINX Ingress Controller (open-source edition; a different project) | Viable; closest to Phase 0's "NGINX". Advanced gateway features (rate-limit policies, JWT, WAF) are largely in the commercial NGINX Plus edition. A second migration would still be needed at pilot |
| Envoy Gateway or Traefik (Gateway API) | Viable; maintained. Not Phase 0's pilot choice, so a second decision and possibly a second migration |
| Kong | Phase 0's other pilot candidate; open-source vs enterprise feature split to be re-checked |

## Validation (planned, before the ADR can be marked implemented)

- Chart rendered from pinned upstream sources and dry-run under restricted Pod Security; Checkov.
- Rehearsal on GitHub runners:
  - route to civora-core;
  - rate limit enforced (HTTP 429);
  - admin API unreachable from other namespaces;
  - TLS 1.3 at the edge.
- Image admission policy (ADR-027) passes with images mirrored to the cell registry.

## Revisit when

- The standalone (etcd-free) mode leaves "experimental".
- A WAF requirement cannot be met by plugins.
