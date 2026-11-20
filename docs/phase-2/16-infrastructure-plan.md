# 16. Infrastructure Plan

| | |
|---|---|
| Original items | **O-D5** CI/CD with security gates (§16.4); **O-D6** IaC for dev/staging cell (§16.2–§16.3); **O-SEC4/5** branch protection and 2-reviewer rule (§16.5); **O-AC1** staging reproducible from IaC in < 2 h (§16.7); **O-TIME** 6 weeks (§16.7); **O-BUD** 100–150k TND (§16.8) |
| Decisions | ADR-013, ADR-019, ADR-023, ADR-025, ADR-027, ADR-029 |
| Hosting | **Not selected.** Provider quotes are Phase 1 founder action 10 (E-07). Everything below the hosting adapter is provider-agnostic |

## 16.1 Repository layout (O-D4, ADR-023)

| Path | Contents | State |
|---|---|---|
| `apps/web`, `apps/mobile`, `apps/workspace` | Front-end applications | Placeholders with README |
| `services/core` | NestJS modular monolith, migrations, OpenAPI contract, Dockerfile | **Skeleton built** |
| `services/guide`, `services/health-bridge` | Separate deployables | Placeholders (Phases 10, 7) |
| `packages/i18n`, `packages/feature-flags`, `packages/country-packs`, `packages/synthetic-data` | Shared libraries | **Built and tested** |
| `infra/compose` | Local dev cell | **Built; verified** |
| `infra/helm/civora-core` | Application chart | **Built; validated** |
| `infra/k8s/local` | Rehearsal-only manifests | Built |
| `infra/tofu` | Cell module, static hosting adapter, `envs/staging-tn` | **Built; validated offline** |
| `infra/ansible` | OS baseline, RKE2, Argo CD bootstrap | **Built; linted** |
| `infra/argocd` | Project and applications | **Built; validated against CRDs** |
| `infra/scripts` | `dev-cell-up.sh`, `validate-manifests.sh`, `deploy-from-scratch.sh` | Built |
| `spikes/policy-engine` | O-A7 spike | Complete |
| `.github` | CI, nightly rehearsals, Dependabot, CODEOWNERS | Configured |

## 16.2 Cells and environments

See [13](13-cloud-and-deployment-architecture.md) §13.1–§13.3. The staging topology is encoded in `infra/tofu/envs/staging-tn`:
- 3 Kubernetes servers and 2 agents;
- 2 PostgreSQL nodes;
- 1 backup node;
- 3 zones.

Addresses are RFC 5737 placeholders.

## 16.3 Component inventory (pinned versions, 19 Nov 2026)

| Component | Version | Where pinned | Notes |
|---|---|---|---|
| Node.js | 22 LTS (22.23.x) | `.nvmrc`, Dockerfile `node:22-alpine` | CI pins by digest via Dependabot |
| pnpm | 10.28.0 | `packageManager` | Install scripts blocked |
| TypeScript | 5.9.3 | `package.json` | TS 7 not adopted (decorators) |
| NestJS | 11.2.8; Swagger 11.4.8 | `services/core/package.json` | NestJS 12 not adopted yet |
| PostgreSQL | 16 (`postgres:16-alpine` in dev; Ubuntu 24.04 packages on nodes: PostgreSQL 16.15, Patroni 3.2.2, etcd 3.4.30, pgBackRest 2.50) | compose, rehearsal, role `postgresql_ha` | Role tested on containers: 17/17 checks, crash failover 29 s (ADR-003 still Proposed) |
| node-pg-migrate | 8.0.4 | core | ADR-024 |
| Redis | 7 (`redis:7-alpine`) | compose | |
| Keycloak | 26.0 | compose | ADR-005 |
| OpenBao | 2.4.1 | compose (dev mode) | ADR-012 |
| Object storage (dev) | SeaweedFS 3.97 | compose | ADR-020 |
| Observability (dev) | grafana/otel-lgtm 0.11.0 | compose | ADR-011 |
| Kubernetes | RKE2 v1.33.4+rke2r1 (cells); k3s v1.33.4+k3s1 (rehearsal) | Ansible defaults; scripts | ADR-013 |
| Helm | 3.22.1 | CI | |
| OpenTofu | 1.13.9 | CI | No provider yet |
| Ansible | ansible-core 2.18.10; ansible-lint 25.9.2 | CI | No Galaxy collections |
| Argo CD | v3.4.13 | Ansible defaults; validation script | |
| Cedar | 4.14.0 (`@cedar-policy/cedar-wasm`) | spike | ADR-006 |
| OPA (evaluated) | 1.4.2 | spike | Not adopted for application authorisation |
| Scanners | Checkov 3.2.461; Trivy 0.65.0; Syft 1.33.0; gitleaks 8.28.0; CodeQL action v4.39.3 | CI env | ADR-027 |

## 16.4 CI/CD pipeline and security gates (O-D5)

File: [.github/workflows/ci.yml](../../.github/workflows/ci.yml). Every third-party action is pinned to a commit SHA. The workflow token is read-only by default.

| Job | Gates | Blocks merge |
|---|---|---|
| `build-test` | Frozen lockfile install; build; **country-pack integrity**; unit + e2e + **migration tests against PostgreSQL 16**; **module-boundary fitness check**; **OpenAPI drift check**; `pnpm audit --prod` (high+) | Yes |
| `secret-scan` | gitleaks over the full history | Yes |
| `codeql` | CodeQL `security-extended` (SAST) | Yes |
| `iac` | `tofu fmt` + `validate` + `plan`; `ansible-playbook --syntax-check` + `ansible-lint` (production profile); **server-side validation on Kubernetes 1.33 with restricted Pod Security and Argo CD CRDs**; Checkov over Kubernetes, Helm, Dockerfile, Terraform, Ansible, GitHub Actions | Yes |
| `policy-engine-spike` | Cedar and OPA must return the expected decision for all 24 cases | Yes |
| `image` | Build; **Trivy** (fixable HIGH/CRITICAL fail); **SBOM** (CycloneDX); on `main`: push to GHCR, **cosign keyless signature**, SBOM attestation, **SLSA provenance** | Yes |

Nightly ([.github/workflows/nightly.yml](../../.github/workflows/nightly.yml)):
- the dev cell from scratch, with smoke tests;
- the air-gapped k3s deploy from scratch, timed.

**Deployment:** pull-based (Argo CD). CI never holds cluster credentials (Phase 0 §8.2).

## 16.5 Security baseline: repository and hosts (O-SEC4, O-SEC5)

**Repository (founder action, GitHub settings).** Branch protection for `main`:
- pull request required;
- **2 approvals** (code owners), stale approvals dismissed;
- the six status checks above;
- signed commits;
- linear history;
- no force push or deletion;
- administrators included.

Details are in [07](07-security-and-privacy-architecture.md) §7.7.
- **The two-reviewer rule cannot be met with one engineer.** Until a second engineer joins, the founder must record a time-limited waiver or use an external reviewer for `infra/`, `migrations/` and policies.

**Hosts (Ansible `base_hardening`).** Applied to every node:
- key-only SSH, no root login, limited authentication tries;
- auditd and chrony enabled;
- hardened kernel parameters;
- automatic security updates (Debian family).

**RKE2 (Kubernetes nodes):**
- CIS profile;
- secrets encryption at rest;
- `protect-kernel-defaults`;
- API audit logs kept 30 days;
- the cluster token comes from OpenBao, never from Git.

## 16.6 Release and promotion

| Step | Control |
|---|---|
| Merge to `main` | 2 approvals + all gates green |
| Build | Signed image by digest; SBOM and provenance attached |
| Staging | A PR updates `image.digest` in `values-staging.yaml` → Argo CD auto-sync → smoke tests |
| Pilot / production | Manual Argo CD sync by an operator **plus** a second approver (change record); maintenance window per tenant tier; migrations are expand-only |
| Rollback | Revert the values commit; previous image digest; no down-migration needed (expand/contract) |
| Customer-hosted (tier 4) | Release bundle: images, chart, pack, SBOMs, signatures, checksums, release notes; the customer verifies signatures before import |

## 16.7 Staging reproducibility (O-AC1) and the 6-week plan (O-TIME)

**Acceptance criterion:** "staging cell reproducible from IaC in < 2 h".

**Can it be met now? No.** A staging cell needs hosts, and no hosting provider is contracted. What has been proven:

| Part of the staging cell | Proven in Phase 2 | Time measured |
|---|---|---|
| Hosts (L0) | OpenTofu cell model validates; residency and quorum guards work | Plan in seconds |
| OS + Kubernetes + Argo CD (L1–L3) | Playbooks lint-clean; not run on hosts | — |
| Application manifests (L5) | Valid on a real Kubernetes 1.33 API server under restricted Pod Security | Validation 16 s |
| Whole application stack (single node) | Dev cell from nothing: 3 PostgreSQL clusters, Redis, S3 store, Keycloak, OpenBao, observability, core + migrations, 9 smoke checks | **82 s** (image pre-built) |
| Air-gapped Kubernetes deploy | **Passes on GitHub runners** (cannot run in this sandbox) | **79 s** from nothing to green |
| Database tier (L2) | Role `postgresql_ha` on systemd containers, 2 and 3 servers: accounts, TLS, backups, PITR, failover, `pg-router` application path (31/31 and 35/35 checks) | Role from nothing ≈ 65–75 s |
| Staging-shaped rehearsal (database tier + k3s + `pg-router` + civora-core) | **Passes on GitHub runners**, including a database leader crash with the application running | **169 s** to smoke tests; 225 s with failover and upgrade |

**Remaining IaC work to meet O-AC1 once a provider is chosen** (estimates [A]):

| Work item | Estimate |
|---|---|
| Hosting adapter for the chosen provider (OpenTofu provider, networks, VMs, volumes, DNS) | 3–5 days |
| ~~Ansible role: PostgreSQL 16 + Patroni + pgBackRest (+ etcd DCS)~~ **Written and container-tested 19 Nov 2026** (role `postgresql_ha`); remaining: first run on real hosts | 0.5–1 day (was 4–6) |
| Platform services via Argo CD: ingress controller (**choice pending — see ADR-013 open question**), cert-manager, External Secrets, OpenBao HA, Keycloak HA, Redis Sentinel, observability stack | 5–7 days |
| ~~Application path to the database primary~~ **`pg-router` chart written and tested 20 Nov 2026** | — |
| Signature verification at admission (Sigstore policy controller or Kyverno); registry + digest policy **done** (built-in admission policy) | 1 day (was 1–2) |
| End-to-end timed rebuild, fixes, runbook | 2–3 days |
| **Total** | **11.5–17 engineer-days** (was 15–23) |

**Six-week plan (O-TIME), started 19 Nov 2026:**

| Week | Work | Depends on |
|---|---|---|
| 1 | Skeleton, dev cell, CI, IaC base, spike, ADR drafts, threat model, documentation (**done**) | — |
| 2 | Founder reviews ADRs; external adviser engaged for the threat model; branch protection applied | Founder; adviser |
| 3–4 | Hosting adapter + PostgreSQL role + platform services (above) | **Provider contract (E-07)** |
| 5 | Timed staging rebuild (< 2 h target), restore drill, fixes | Hosts |
| 6 | Threat-model review findings closed; ADRs approved; readiness report updated; Phase 2 acceptance request (after Phase 1 acceptance) | Founder; adviser; Phase 1 |

## 16.8 Budget (O-BUD)

The Phase 2 budget of **100–150k TND** is unchanged [A]. Phase 2 cash costs still to come:
- staging hosting for about 1 month;
- an external security adviser for the threat-model review;
- part of the ANCS-certified audit preparation.

Quotes are pending (Phase 1 founder actions 10–11). No new amount is assumed here.
