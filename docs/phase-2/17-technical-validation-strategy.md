# 17. Technical Validation Strategy

| | |
|---|---|
| Purpose | How each architectural decision is proven, what has already been proven in Phase 2 (with results), and what remains |
| Original items | **O-T1** unit/integration scaffolds in the pipeline, **O-T2** IaC scanning, **O-T3** deploy-from-scratch test |
| Principle | A decision counts as validated only when a repeatable check exists. One-off observations are recorded as such |

## 17.1 Validation levels

| Level | Question | Examples |
|---|---|---|
| V1 Static | Is the artefact well-formed and policy-compliant? | Type checks, lint, `helm lint`, `tofu validate`, `ansible-lint`, Checkov, Cedar strict validation |
| V2 Unit | Does the component behave correctly in isolation? | Locale negotiation, working-day calendar, pack tamper detection, flag locking |
| V3 Integration | Do components work together with real dependencies? | Migrations against PostgreSQL 16; core against a real database; server-side Kubernetes admission |
| V4 Environment | Does a whole environment come up from nothing? | Dev cell from scratch; k3s deploy from scratch; staging rebuild (O-AC1) |
| V5 Operational | Does it hold under load and failure? | Load, soak, failover, restore drills (Phase 6+) |
| V6 Independent | Does an outsider agree? | External threat-model review (O-AC3), ANCS audit, penetration test |

## 17.2 Results recorded in Phase 2 (19 Nov 2026)

| # | Check | Level | Result | Repeatable via |
|---|---|---|---|---|
| R1 | Unit + e2e tests: i18n 6, feature flags 2 suites, country packs 4, synthetic data 3, core 9 (incl. config) | V2/V3 | **All pass** | `pnpm test` (CI `build-test`) |
| R2 | Migrations up → down → up on PostgreSQL 16 | V3 | Pass | CI service container; `TEST_DATABASE_URL` |
| R3 | Core with a real database: `/health` reports `database: up` | V3 | Pass | Dev cell smoke test |
| R4 | Pilot/prod refuses the synthetic TN pack | V3 | Pass (`CIVORA_ENV=prod` exits with an explicit error) | Unit test of the guard + manual check |
| R5 | Module-boundary fitness check catches a planted violation | V1 | Pass (violation detected, then removed) | `pnpm arch:check` |
| R6 | OpenAPI drift check | V1 | Caught a real drift after the Swagger upgrade | `openapi:check` |
| R7 | Dev cell from scratch | V4 | **82 s**, 9/9 smoke checks (database, RTL locales, base schemas, Keycloak realm, Redis auth, object store refuses anonymous, OpenBao unsealed, Grafana login, separate audit cluster) | `infra/scripts/dev-cell-up.sh --fresh`; nightly CI |
| R8 | Kubernetes manifests on a real API server, restricted Pod Security, Argo CD CRDs | V3 | 9/9 checks pass in 16 s, incl. "staging refuses an image without a digest" and "privileged pod rejected" | `infra/scripts/validate-manifests.sh` |
| R9 | Server-side validation found a defect | V3 | Real bug: NetworkPolicy selector missing `matchLabels` (rejected by the API). Fixed. Also guarded against an empty `from` list (which would allow all) | Same |
| R10 | OpenTofu cell: validate, plan, apply (offline) | V1/V3 | Pass; a node outside TN **blocks** the plan (negative test) | CI `iac` |
| R11 | Ansible: syntax check + `ansible-lint` production profile | V1 | 0 failures, 0 warnings | CI `iac` |
| R12 | Checkov | V1 | Dockerfile 31/31; GitHub Actions 36/36; chart findings fixed or accepted (§17.4) | CI `iac` |
| R13 | Container image | V3 | Non-root UID 10001; code not writable; no npm/corepack; **Trivy fixable HIGH/CRITICAL 21 → 0** | CI `image` |
| R14 | SBOM | V1 | CycloneDX, 878 components | CI `image` |
| R15 | Secrets in history | V1 | gitleaks: no leaks | CI `secret-scan` |
| R16 | Policy engines | V3 | Cedar 4.14.0 and OPA 1.4.2 (wasm and REST): **24/24 expected decisions**; Cedar strict schema validation passes; latency in the spike README | CI `policy-engine-spike` |
| R17 | Performance baseline | V5 (baseline only) | `/health` 9,155 req/s p99 12 ms; `/v1/meta/locales` 4,002 req/s p99 24 ms (one process) | [14](14-scalability-and-performance.md) §14.4 |
| R18 | Air-gapped k3s deploy from scratch | V4 | **Not run here** (sandbox cannot run nested containers: `runc ... can't get final child's PID`). Scheduled nightly on GitHub runners | `deploy-from-scratch.sh` |
| R19 | CI workflows on GitHub | V3 | **Observed 19 Nov 2026.** Run 1: five jobs ran, IaC failed on Checkov (default namespace; skip annotations on pod templates). Fixed. **Run 2: all six jobs green**, incl. Trivy gate and SBOM upload. Signing and provenance run only on `main` (not yet observed) | GitHub Actions `ci` |
| R20 | OpenAPI 3.1 contract | V1 | Contract converted to 3.1.0 and valid against the official schema; house rules pass; the previous 3.0 contract is **rejected** by the gate (negative test) | `openapi:check` (CI `build-test`) |
| R21 | Trace privacy | V3 | Unit test of the allow-list; e2e test with synthetic CIN, phone, e-mail and user agent in query and headers: none reaches the exported spans. **Negative control:** with the filter disabled the test fails on `99123456`. Dev cell: traces reach Tempo with only allow-listed attributes | `pnpm test`; dev-cell check 10 |
| R22 | Dev cell with tracing | V4 | From scratch 64 s (image cached), **10/10** smoke checks | `dev-cell-up.sh --fresh` |
| R23 | Image with tracing dependencies | V3 | Trivy fixable HIGH/CRITICAL: **0**; `pnpm audit --prod`: no high/critical | CI `image`, `build-test` |
| R24 | Database tier role `postgresql_ha` | V3/V5 | See §17.2.1 | `infra/ansible/tests/postgresql-ha/run.sh` (nightly CI) |

### 17.2.1 Database tier integration test (R24, 19 Nov 2026)

**Setup:**
- three systemd containers (Ubuntu 24.04): 2 database nodes and 1 backup node;
- Ubuntu archive packages: PostgreSQL 16.15, Patroni 3.2.2, etcd 3.4.30, pgBackRest 2.50;
- a CA, node certificates and secrets generated for the run.

| Check | Result (runs of 19 Nov 2026) |
|---|---|
| Cluster: one leader, one synchronous standby streaming; etcd quorum of 3 over mutual TLS | Pass |
| Write on leader visible on standby; data checksums on; replication over TLS | Pass |
| First full backup in an AES-256 encrypted repository on the backup node; WAL archiving end to end (`pgbackrest check`); backup timers enabled | Pass |
| `pg_hba` rejects everything outside the allowed CIDRs | Pass |
| Planned failover (Patroni stopped on the leader): standby promoted in 1–2 s; no committed row lost; old leader rejoins as streaming standby | Pass |
| Restore drill on the backup node: restore → start → query (1,000 rows) → stop → `pg_checksums --check`; 2 s | Pass |
| Second run of the role changes nothing (idempotent) | Pass |
| **Unplanned failure** (leader frozen with `docker pause`, no clean shutdown) in steady state | Pass: synchronous standby promoted after **29 s** (leader lease 30 s); all 1,100 committed rows present; the frozen node rejoins as streaming standby via `pg_rewind` after it is unfrozen |
| Whole suite (17 checks) | **17/17 pass in 162 s** (final run, 19 Nov 2026) |

**Findings fixed during testing:**
- pgBackRest verifies TLS certificates by host name, not IP, so nodes are now addressed by name and the role manages `/etc/hosts`.
- In `tls-server-auth`, commas separate stanzas, not clients, so the role now writes one line per client.
- Patroni writes absolute `pg_hba`/`pg_ident` paths, which the restore drill must override.
- Patroni reads the local timeline over a replication connection to `127.0.0.1`. Without a `pg_hba` entry for it, a failed leader could not decide on `pg_rewind` and never rejoined. Entry added.

**Finding recorded for a decision:**
- With two database nodes in synchronous mode, Patroni refuses automatic failover while no synchronous standby is designated (observed: a leader frozen seconds after the other node rejoined; etcd showed `sync_standby: null`).
- This protects commits, at the cost of automatic recovery.
- Option for production: 3 database nodes per site ([role README](../../infra/ansible/roles/postgresql_ha/README.md); ADR-003; review package §3.1).

## 17.3 Test strategy by layer (Phase 3 onward)

| Layer | Required tests | Gate |
|---|---|---|
| Domain logic | Unit tests; property-based tests for calendars and deadlines | CI |
| Module API | Contract tests from the OpenAPI document; **IDOR suite** per endpoint (cross-tenant → 404, wrong role → 403) | CI |
| Persistence | Migration tests; RLS presence test on every tenant table; repository tests against PostgreSQL | CI |
| Policies | Cedar validation + conformance table; one new case per new rule | CI |
| Adapters | Shared contract suite per port, run against `simulated` (CI) and `sandbox` (when authorised) | CI / staging |
| UI | Accessibility (axe, WCAG 2.2 AA), RTL snapshots, keyboard paths (ADR-014) | CI / release |
| Security | DAST on staging; prompt-injection suites (Phase 10); dependency, container and IaC scans | CI / staging |
| Environment | Nightly rebuilds; monthly restore drill; quarterly DR | Ops |

## 17.4 Accepted IaC-scan findings (with reasons)

| Check | Finding | Decision | Reason |
|---|---|---|---|
| CKV_K8S_11 | No CPU limit | Accepted | CPU limits cause throttling (latency SLO). CPU requests + HPA bound usage; memory limits are set |
| CKV_K8S_15 | Pull policy not `Always` | Accepted | Deployment by immutable digest outside dev (enforced by the chart). `IfNotPresent` cannot run a different image |
| CKV_K8S_21 | Default namespace | **Fixed** | Every chart resource sets `metadata.namespace` from the release; CI renders with `-n civora-tn` (finding surfaced by the first GitHub run) |
| CKV_K8S_35 | Secret as environment variable | **Fixed** | Mounted as a file (`DATABASE_URL_FILE`) |
| CKV_K8S_40 | Low UID | **Fixed** | UID/GID 10001 in the image and chart |
| CKV_K8S_43 | Image without digest | **Fixed** for staging/pilot/prod | The chart fails rendering without a digest |
| CKV_K8S_* on `infra/k8s/local` | Rehearsal-only PostgreSQL pod | Excluded from CI scan | Not deployed anywhere except the throw-away rehearsal |

The accepted findings are annotated on the pod templates (`checkov.io/skip*`), so the reasons travel with the manifests.

## 17.5 Validation backlog (owner: engineering; due before the phase named)

| # | Validation | Due |
|---|---|---|
| B1 | First green CI run on GitHub (all six jobs) — **done 19 Nov 2026 (run 2)**; first nightly rehearsals pending (nightly runs only from the default branch) | Week 2 of Phase 2 |
| B2 | Staging rebuild from IaC < 2 h (O-AC1) | Phase 2 week 5 (needs a provider) |
| B3 | External threat-model review (O-AC3) | Phase 2 week 6 (needs an adviser) |
| B4 | Second synthetic country pack `xx` → no code change needed | Phase 3 |
| B5 | Trace scrubbing test with reserved-range identifiers — **done for traces** (unit + e2e + dev-cell check); log scrubbing test still Phase 3 | Phase 3 (logs) |
| B6 | RLS presence test and IDOR suite templates | Phase 3 |
| B7 | Image signature verification at admission | Before pilot |
| B8 | OpenAPI 3.1 conversion + schema validation — **done 19 Nov 2026**; breaking-change detection when the first business endpoint exists | Phase 3 (breaking changes) |
| B9 | Load, noisy-neighbour, soak, failover tests (§14.5) | Phase 6 |
| B10 | First restore drill; first DR test | Before pilot |
| B11 | ANCS-certified audit; penetration test | Before pilot (Phase 11/13) |

## 17.6 Environment limitations met in Phase 2 (recorded, not worked around)

| Limitation | Effect | Mitigation |
|---|---|---|
| The sandbox cannot run nested containers | k3s cannot start pods → R18 not run here | Server-side validation (R8) + nightly CI job |
| OpenTofu and Terraform registries blocked | No provider plugins | The cell module uses no provider; provider work waits for E-07 anyway |
| Ansible Galaxy blocked | No collections | Roles use `ansible.builtin` only (also simpler for air-gapped installs) |
| GitHub container registry blobs blocked | No CloudNativePG images (not chosen anyway) | Decision follows Phase 0 (Patroni + pgBackRest on nodes) |
| `minio/minio` image not pullable | — | SeaweedFS for dev (ADR-020) |
| TLS-inspecting proxy | Builds need its CA | BuildKit secret mount; never baked into images |
