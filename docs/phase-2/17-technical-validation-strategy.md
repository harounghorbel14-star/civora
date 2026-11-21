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
| R8 | Kubernetes manifests on a real API server, restricted Pod Security, Argo CD CRDs | V3 | 9/9 checks pass in 16 s, incl. "staging refuses an image without a digest" and "privileged pod rejected". **Correction (20 Nov 2026):** for Deployments and StatefulSets Pod Security only *warns*, and the script discarded the warnings, so chart pod templates were not actually checked against "restricted". Warnings now fail the check, and a control proves it (a non-compliant Deployment fails). civora-core and pg-router pods were since created for real in restricted namespaces on GitHub (R18, R30) | `infra/scripts/validate-manifests.sh` |
| R9 | Server-side validation found a defect | V3 | Real bug: NetworkPolicy selector missing `matchLabels` (rejected by the API). Fixed. Also guarded against an empty `from` list (which would allow all) | Same |
| R10 | OpenTofu cell: validate, plan, apply (offline) | V1/V3 | Pass; a node outside TN **blocks** the plan (negative test) | CI `iac` |
| R11 | Ansible: syntax check + `ansible-lint` production profile | V1 | 0 failures, 0 warnings | CI `iac` |
| R12 | Checkov | V1 | Dockerfile 31/31; GitHub Actions 36/36; chart findings fixed or accepted (§17.4) | CI `iac` |
| R13 | Container image | V3 | Non-root UID 10001; code not writable; no npm/corepack; **Trivy fixable HIGH/CRITICAL 21 → 0** | CI `image` |
| R14 | SBOM | V1 | CycloneDX, 878 components | CI `image` |
| R15 | Secrets in history | V1 | gitleaks: no leaks | CI `secret-scan` |
| R16 | Policy engines | V3 | Cedar 4.14.0 and OPA 1.4.2 (wasm and REST): **24/24 expected decisions**; Cedar strict schema validation passes; latency in the spike README | CI `policy-engine-spike` |
| R17 | Performance baseline | V5 (baseline only) | `/health` 9,155 req/s p99 12 ms; `/v1/meta/locales` 4,002 req/s p99 24 ms (one process) | [14](14-scalability-and-performance.md) §14.4 |
| R18 | Air-gapped k3s deploy from scratch | V4 | Cannot run in this sandbox (nested containers). **First run on GitHub, 20 Nov 2026: from nothing to green in 79 s** — cluster 35 s, database 47 s, civora-core 59 s; 6/6 smoke checks (database up, RTL locale, network policy blocks other namespaces, schemas migrated, 2 non-root read-only replicas, restricted Pod Security) + upgrade with migration hook. Same run: dev cell from scratch 107 s, 10/10 | `deploy-from-scratch.sh`, `dev-cell-up.sh` (nightly workflow run 1) |
| R19 | CI workflows on GitHub | V3 | **Observed 19 Nov 2026.** Run 1: five jobs ran, IaC failed on Checkov (default namespace; skip annotations on pod templates). Fixed. **Run 2: all six jobs green**, incl. Trivy gate and SBOM upload. Run 3 (tracing) green. Runs 4–6 failed: Checkov flagged the database test-node Dockerfile (root/systemd, no health check, by design) — justified inline skips added, and the local check now uses CI's exact command. Signing and provenance run only on `main` (not yet observed) | GitHub Actions `ci` |
| R20 | OpenAPI 3.1 contract | V1 | Contract converted to 3.1.0 and valid against the official schema; house rules pass; the previous 3.0 contract is **rejected** by the gate (negative test) | `openapi:check` (CI `build-test`) |
| R21 | Trace privacy | V3 | Unit test of the allow-list; e2e test with synthetic CIN, phone, e-mail and user agent in query and headers: none reaches the exported spans. **Negative control:** with the filter disabled the test fails on `99123456`. Dev cell: traces reach Tempo with only allow-listed attributes | `pnpm test`; dev-cell check 10 |
| R22 | Dev cell with tracing | V4 | From scratch 64 s (image cached), **10/10** smoke checks | `dev-cell-up.sh --fresh` |
| R23 | Image with tracing dependencies | V3 | Trivy fixable HIGH/CRITICAL: **0**; `pnpm audit --prod`: no high/critical | CI `image`, `build-test` |
| R24 | Database tier role `postgresql_ha` | V3/V5 | See §17.2.1 (2 servers: 31/31; 3 servers: 35/35, 20 Nov 2026). **Also green on GitHub runners** (nightly workflow run 1, both matrix legs). Nightly runs 6–7: the 3-server leg failed one check, a router defect (R37) | `infra/ansible/tests/postgresql-ha/run.sh` (nightly CI, matrix 2/3) |
| R25 | Application path to a moving primary (`pg-router`) | V3/V5 | Migrations as owner and `/health` as the NOBYPASSRLS account through `pg-router`, `verify-full` TLS. Client writing every 100 ms during a leader crash: **no acknowledged write lost**; longest write gap 26.7 s (2 servers) / 39.0 s (3 servers) | `run.sh` (R24) |
| R26 | Application survives database failover | V3 | **Defect found:** civora-core exited on the first failover (unhandled pool `error` event). Fixed; regression test fails without the fix; suite checks the same process stays up through planned and crash failovers | `pnpm test`; `run.sh` |
| R27 | Log privacy | V3 | Canary in query, path, headers, cookies, JSON, malformed JSON and form bodies: never in a log line; all log lines are fixed-field JSON. **Defect found:** 404 responses echoed the full URL with its query string in `title`; fixed (reason phrase). The test failed before the fix (negative control) | `pnpm test` (`log-privacy.e2e.test.ts`) |
| R28 | Image admission policy (ADR-027) | V3 | Built-in ValidatingAdmissionPolicy on a k3s 1.33 API server: pinned image from the cell registry allowed; Docker Hub, tag without digest, look-alike registry prefix, bad init container, unpinned CronJob all **denied**; missing parameters **deny** (fail closed); unlabelled namespaces unaffected. Observed green on GitHub (CI run 10) | `validate-manifests.sh` (CI `iac`) |
| R29 | CI failure propagation | V1 | **Defect found:** steps of the form `script | tee` passed even when the script failed (GitHub's default shell has no `pipefail`). Workflows now set `shell: bash` | `.github/workflows/*.yml` |
| R30 | Staging-shaped rehearsal (database tier + k3s + pg-router + civora-core) | V4 | **Pass on GitHub (run 5, 20 Nov 2026): from nothing to smoke tests in 169 s; application back 44 s after the leader froze, no pod restart.** Runs 1–4 found two defects (§17.2.2) | `staging-rehearsal.sh` (nightly workflow) |
| R31 | Platform services as code (Argo CD) | V3 | cert-manager v1.21.3, External Secrets chart 2.14.0, OpenBao chart 0.30.7: pins checked against upstream release tags (each at least 2 weeks old). OpenBao (3 replicas, Raft, TLS) and External Secrets rendered from the tagged sources with our values, then dry-run on a Kubernetes 1.33 API server with Pod Security warnings treated as failures. **Finding:** the OpenBao chart's default container settings would be refused under "restricted"; fixed in our values, and the default kept as a negative control | `validate-manifests.sh` |
| R32 | Second backup site + full disaster recovery | V4/V5 | Repository 2 at a second site with its own key; WAL archived to both. Site A (2 database servers + repository 1) destroyed abruptly while a client wrote every 200 ms; the role rebuilt the cluster at site B from repository 2: every acknowledged write up to the last archived WAL present, no gaps; **data lost: the last 16 s** (RPO target 15 min); **writes accepted again 85 s after the loss** (RTO target 4 h; real servers add provisioning time). **Finding:** two repositories' backups collided (one backup per stanza at a time) — fixed by serialised first backups, offset schedules and retries. **Green on GitHub** (nightly runs 6 and 7; run 7: 63 of 303 writes lost = the last 16 s, writes accepted again after 70 s) | `dr.sh` (nightly) |
| R33 | Keycloak high availability | V3 | Two Keycloak 26.8.1 nodes cluster through the database; a session issued by node 1 is refreshed on node 2 after node 1 is killed; node 1 rejoins. **Finding:** all nodes need one fixed hostname (token issuer). Operator 26.8.1: the upstream Deployment violates restricted Pod Security — fixed with an Argo CD patch, upstream kept as a negative control. **Green on GitHub** (nightly runs 6 and 7) | `infra/tests/keycloak-ha/run.sh`; `validate-manifests.sh` |
| R34 | Valkey high availability (Sentinel) | V3 | 3 data nodes + 3 Sentinels from the chart's own scripts, non-root, read-only root, password as a file: replica promoted **7 s** after the primary is killed; confirmed write survives; old primary rejoins as replica. **Failed on GitHub runners** (nightly runs 6–7): see R38 | `infra/tests/valkey-ha/run.sh` |
| R35 | Infrastructure alert rules | V3 | 11 rules (database, backup, RPO, disk, workloads, certificates) checked and unit-tested with promtool 3.15.1 (official image), including quiet cases (idle cluster, tmpfs). Database tier exports backup and archive metrics over TLS (checked in the database suite). Application alerts remain Phase 3 (§15.2) | `test-alert-rules.sh` (CI `iac`) |
| R36 | Image signature enforcement | V4 | Sigstore policy-controller + CIVORA release-key policy (ADR-027 proposed revision). Server-side: values meet restricted Pod Security (chart defaults do not — control). **Runtime on GitHub runners (nightly run 7): 7/7 in 56 s** — signed image admitted by digest and by tag (pinned to its digest), unsigned and unknown images refused, unlabelled namespaces unaffected (§17.2.3). **Production signing path (nightly run 12, 9/9):** release key generated in OpenBao transit, export refused (even to root); CI signer token can sign but not export, rotate or reconfigure; image signed through OpenBao admitted | `infra/tests/image-signatures/run.sh` (nightly); [release-key runbook](runbooks/release-key-ceremony.md) |
| R37 | `pg-router` start-up | V3 | **Defect found on GitHub** (nightly runs 6 and 7, 3-server leg): migrations run right after the router started failed with "cannot execute CREATE TABLE in a read-only transaction". HAProxy treats every server as up until its first check fails, so for up to one check interval (2 s) a new router could send clients to a standby, and it reported ready meanwhile. Fixed with `init-state down`: a server gets clients only after a check shows it is the primary. Verified on HAProxy 3.2.25: at start with no reachable primary, the readiness endpoint answered 200 before the fix and answers 503 after it. Applies to every router start (deploys, rescheduling) | chart `pg-router`; `run.sh` (R24) |
| R38 | Valkey failover on GitHub runners | V3 | Runs 6–7: the Sentinels did not promote a replica within 135–155 s. They also answered slowly: each status query took more than a second, and the restarted primary still refused connections 40 s after its start. Its start script asks the Sentinels first, so they were probably not answering. Not reproducible in this sandbox (7 s every time). Changes: the test resolves its six names from `/etc/hosts`, as Kubernetes keeps publishing a crashed pod (headless Service, `publishNotReadyAddresses`); the start scripts give up on a silent Sentinel after 3 s. **Run 8: failover in 6 s on GitHub.** My first hypothesis (slow DNS answers for the stopped container) is **not supported**: the lookup through Docker's resolver measured 0.00 s on GitHub. **The cause of the stall is not established.** Run 8 then exposed a race in the test itself: replicas counted as "connected" while still in their initial sync, so the "confirmed" write was refused (`min-replicas-to-write 1`) — the test now waits for both replicas to be in sync and checks the write is accepted. **Run 9: green on GitHub.** **Root cause found (nightly run 10, non-gating diagnostic, 3 of 3 attempts):** on runners, looking up the stopped primary's name through the C library (as Sentinel does) takes **10 s**; Sentinel resolves synchronously and keeps entering **TILT mode** (logged), which suspends failover. **Cause closed.** On Kubernetes the chart fails over in 7 s (R40, GitHub): cluster DNS answers for a deleted pod's name at once. The chart also bounds the resolver (timeout 1 s, 1 attempt), but a gated test of that bound in the Docker-DNS setting **failed** (nightly run 12: lookups fell to 1 s, TILT still recurred, failover aborted). The bound only reduces the risk, so the job was removed and the reproduction mode kept. **Residual risk, recorded:** Valkey failover depends on a healthy cluster DNS (CoreDNS replicas on RKE2; DNS watched by the monitoring stack) | `infra/tests/valkey-ha/run.sh`; chart `valkey-ha` |
| R39 | Disaster recovery with a live second site | V4/V5 | Patroni standby cluster at site B (own etcd), streaming from site A through a permanent slot over TLS; site A destroyed while a client writes every 200 ms; **promoted with one command**: **0 of 176 acknowledged writes lost**, promotion 4 s, writes back through `pg-router` 10 s after the loss; role re-run for the post-disaster topology; full backup to repository 2. Main-site WAL retention capped (50 GB) and alerted. **GitHub (nightly run 12): 0 of 194 lost, promotion 3 s, writes back 9 s** | `dr-standby.sh` (nightly) |
| R40 | Valkey chart on Kubernetes | V3 | The chart itself on k3s, restricted Pod Security, NetworkPolicy enforced (**GitHub, nightly run 12**): primary pod deleted → replica promoted in **7 s**, confirmed write kept, pod returns as replica, one primary; primary process SIGKILLed → stable in 4 s, write kept; a pod outside the allowed selector cannot connect **even with the password** (allowed client as control) | `infra/tests/valkey-ha/k8s.sh` (nightly) |
| R41 | Edge API gateway (ADR-030) | V3 | APISIX 3.19.0 (3.20/3.21 under two weeks old) in front of civora-core with a real Keycloak (**GitHub, nightly run 12**; 13/13): valid token 200; no token, altered claims, foreign key 401; 20/min then 429; body > 1 MiB 413; undeclared path/method 404; no admin API on the data plane; no version banner; request id; nosniff/no-referrer/HSTS; non-root | `infra/tests/api-gateway/run.sh` (nightly) |
| R42 | Identity realm conformance | V1 | Realm export checked against doc 06 (TLS, brute force, password policy, 5-min tokens, rotated refresh tokens, PKCE S256, no implicit/password grants, no wildcard redirects, no stored passwords) with 7 negative controls. **Defect found:** refresh tokens were not rotated; realm fixed; dev cell imports it (GitHub) | `check-realm-security.py` (CI `iac`) |
| R43 | Second country as configuration | V3 | A synthetic pack `xx` written as JSON only (other weekend, holidays, locales, currency, rule pack) loads through the same verifier and gives different deadlines for the same dates; tampering detected — **no code change** (backlog B4 proven at package level) | `packages/country-packs` tests (CI) |
| R44 | Topology guards and pilot topology | V1 | `staging-tn` and `pilot-tn` (3 database servers, standby cluster at the second site) plan; refused: node outside Tunisia, standby server at the main site, pilot without second-site repository, second-site repository at the main site | `tofu-guards.sh` (CI `iac`) |
| R45 | PostgreSQL HA, 2 database nodes: crash rejoin (observed 21 Nov 2026) | V3 | Nightly run 18 (Phase 3 commit `7acaf7a`, no database change): after the crash failover the frozen former leader did not return to streaming within 180 s, and the runbook's `patronictl reinit` then refused ("No replica among provided members"); every other step green (failovers, no acknowledged write lost, PITR, restore drill), the 3-node variant green in the same run, this step green in runs 12, 13, 14 and 17. Run 19: this job green again (intermittent). **Open, under investigation**: the test now prints the cluster view and the node's Patroni log when this step fails; if the reinit refusal recurs, the runbook (§5) needs the procedure for a member that is not registered as a replica | `infra/ansible/tests/postgresql-ha/run.sh`; runbook `database-operations.md` §5 |
| R46 | Rehearsal scripts waited without limit (observed 21 Nov 2026) | V1 | Nightly run 18: the Valkey-on-k3s job hung for its whole 25-minute limit with no output, in an `until` loop waiting for k3s. **Fixed**: all 21 such loops in the rehearsal scripts are bounded (180 s, or 120 s for one-second loops) and fail with an error; the k3s start prints its log on failure. The first version of the fix re-ran the command once more after the loop, which raced PostgreSQL's restart after initialisation and failed the Keycloak HA job in nightly run 19 after 5 s; it now records success inside the loop and fails only when the limit is reached (Keycloak HA 5/5 and gateway 18/18 locally). In run 19 the Valkey-on-k3s job passed in 71 s | `infra/tests/*`, `infra/scripts/*`, `infra/ansible/tests/*` |

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

**Finding recorded for a decision (confirmed by a controlled experiment):**
- With two database nodes in synchronous mode, Patroni refuses automatic failover while no synchronous standby is designated.
- First seen when a leader was frozen seconds after the other node rejoined (etcd showed `sync_standby: null`). That run also had the `pg_hba` defect above, so it was re-tested separately with `sync-safety-experiment.sh`:
  - the synchronous standby's Patroni was restarted, so no standby was designated;
  - the leader was frozen 6 s later;
  - the standby was **not promoted for 120 s** ("not the healthiest node");
  - after the leader was unfrozen, the cluster recovered by itself with no split-brain (leader plus synchronous standby streaming within 14 s).
- This protects commits, at the cost of automatic recovery during that window.
- Option for production: 3 database nodes per site ([role README](../../infra/ansible/roles/postgresql_ha/README.md); ADR-003; review package §3.1).

**Second round (20 Nov 2026): accounts, encryption, PITR, application path, both topologies.**

| Check | 2 servers + backup node | 3 servers + backup node |
|---|---|---|
| Least privilege: application account `NOSUPERUSER NOBYPASSRLS`, owns nothing; migrator owns the database and the schemas it creates | Pass | Pass |
| Repository unreadable without the cipher passphrase (same command with it: readable — control) | Pass | Pass |
| Point-in-time restore to T: 100 rows written before T present, 100 written after T absent; checksums verified | Pass (2 s) | Pass (3 s) |
| Migrations and `/health` through `pg-router` (configuration rendered from the Helm chart), `verify-full` TLS | Pass | Pass |
| Planned failover (Patroni stopped on the leader) | 2 s | 2 s |
| `patronictl switchover` to the synchronous standby; `patronictl reinit` of a member | Pass | Pass |
| Leader crash: promotion of the synchronous standby | 23–25 s | 36 s |
| Writes through `pg-router` during the crash (client every 100 ms): longest gap; acknowledged writes lost | 26.7 s; **0** | 39.0 s; **0** |
| civora-core process survives both failovers and reports the database up | Pass (after fix R26) | Pass |
| With one standby already down, leader crash → the other standby is promoted **automatically** | Not possible (see finding above) | **Pass, 35 s** |
| Restore drill (latest); second role run changes nothing | Pass | Pass |
| Whole suite | **31/31, 227 s** | **35/35, 339 s** |

Failover time is the Patroni leader lease (`ttl` 30 s) plus up to one loop (`loop_wait` 10 s) plus two router checks (2 s each): 23–40 s is the expected range. Shorter values trade speed against false failovers on a slow network; tune on staging.

**Manual recovery for a 2-server site (R2-10), measured with `sync-safety-experiment.sh`:**

- No synchronous standby designated, 50 rows acknowledged by the leader, leader frozen.
- No automatic promotion for 120 s.
- The operator disabled synchronous mode ([runbook](runbooks/database-operations.md) §4). The standby was promoted **5 s** later.
- **All 50 acknowledged rows were lost**: they had not reached the standby.
- When unfrozen, the old leader rejoined through `pg_rewind` (4 s). Synchronous mode was re-enabled and a synchronous standby designated again (4 s).
- This is the concrete cost a 2-server site accepts each time this path is used. With 3 servers the same fault needs no operator and loses nothing (row above).

### 17.2.2 Staging-shaped rehearsal (R30)

**Setup** (GitHub runner, nested containers; [`staging-rehearsal.sh`](../../infra/scripts/staging-rehearsal.sh)):
- 2 database servers + backup node built from nothing by the `postgresql_ha` role;
- single-node k3s on the same network, with the application image imported (air-gapped);
- `pg-router` and civora-core installed from their Helm charts into a namespace with restricted Pod Security and NetworkPolicy enforced;
- migrations as the database owner; runtime as the NOBYPASSRLS account through `pg-router` with `verify-full` TLS.

**Result, nightly workflow run 5 (20 Nov 2026): pass.**

| Step | Time from nothing |
|---|---|
| Database tier ready (role applied, 10 checks) | 105 s |
| k3s ready, image imported | 142 s |
| `pg-router` ready (primary known) | 147 s |
| civora-core deployed (migrations applied) | 159 s |
| Smoke tests pass (6/6) | **169 s** |

The smoke tests:
- database up through `pg-router`;
- Arabic RTL locale;
- the policy blocks other namespaces;
- schemas owned by the migrator;
- 2 application replicas under restricted Pod Security;
- 2 router replicas.

Then the leader was frozen. The application, observed from inside the cluster, reported the database up again after **44 s**, and **no application pod restarted**. A Helm upgrade with the migration hook passed. Total 225 s.

**How it got there (runs 1–4), each a real finding:**

| Run | What happened | Fix |
|---|---|---|
| 1–2 | The migration Job was refused by `pg-router` on every attempt (2, then 5), although endpoints and DNS were ready | Diagnostic matrix added to the script |
| 3 | Matrix: labelled client → Service accepted; unlabelled → refused (correct); without the policy → accepted. The policy is right, but **a brand-new pod can be refused until network policy is programmed for its IP**. Each Job retry is a new pod that connects within its first second | civora-core `wait-for-database` before migrating (also covers a deploy during a database failover); tested against a real PostgreSQL |
| 4 | Reported green, but the log stopped after the smoke tests: the failover check contains `exit 0`, and the script's `check()` evaluated it without a subshell, so the script ended "successfully" early (**false green**) | `check()` runs in a subshell in all three rehearsal scripts; no earlier check in the other two contained `exit` |
| 5 | Full pass (above) | — |

### 17.2.3 New rehearsals on GitHub runners (R32–R38)

Nightly workflow runs 6 (commit `ab280bd`) and 7 (`7446afe`) and CI run 19 (`7446afe`), 20 Nov 2026:

| Job | Run 6 | Run 7 | Notes |
|---|---|---|---|
| Disaster recovery (R32) | Pass | Pass | Run 7: 63 of 303 acknowledged writes lost (last 16 s); writes accepted again after 70 s |
| Keycloak cluster (R33) | Pass | Pass | Session refreshed on node 2 after node 1 was killed |
| Valkey Sentinel failover (R34) | **Fail** | **Fail** | No promotion within 135–155 s; see R38. Run 8: failover 6 s; one test race, fixed (R38). **Run 9: pass (failover 7 s)** |
| Image signature enforcement (R36) | — (job added in run 7) | **Pass, 7/7, 56 s** | Signed admitted (digest and tag), unsigned and unknown refused, unlabelled namespace unaffected |
| Database suite, 2 servers (R24) | Pass | Pass | |
| Database suite, 3 servers (R24) | **Fail** (1 check) | **Fail** (1 check) | Router start-up defect (R37); every failover, PITR and drill check passed. **Run 8 (with the fix): pass** |
| Staging rehearsal (R30), k3s and dev cell from scratch (R18) | Pass | Pass | |
| CI `iac` — kube-prometheus-stack render (R35) | — | **Fail** | Test harness: the chart places five scrape Services in `kube-system`; my check forced every object into `observability`. Each object now keeps its own namespace (the Argo CD project already allows `kube-system`). **CI run 20 (with the fix): all jobs green**, incl. the full kube-prometheus-stack render under restricted Pod Security |

Run 8 (commit `e198b0f`): every nightly job green except the Valkey test race above.

**Run 12 (commit `5efc9c7`, 20 Nov 2026): all 11 rehearsal jobs green** — database suites (2 and 3 servers), DR from repository 2, **DR with a live second site (0 of 194 lost)**, staging rehearsal, k3s and dev cell from scratch, Keycloak + Valkey, **Valkey chart on Kubernetes**, **API gateway**, **image signatures with the OpenBao-held key**. One experimental job failed: it tested a Valkey resolver bound in a Docker-DNS setting, and disproved it as a full fix (R38); it was removed. CI run 25 green, including the realm conformance check and the OpenTofu guards.

**Run 9 (commit `9a1d8a7`, 20 Nov 2026): all 8 nightly jobs green**, and CI run 21 green:
- Valkey: failover 7 s; the confirmed write survives; the old primary rejoins as a replica.
- 3-server database suite: all checks pass. Crash failover 24 s; longest write gap through `pg-router` 27.0 s; nothing acknowledged was lost. Point-in-time and latest restore drills verified.
- Disaster recovery, Keycloak, image signatures, 2-server suite, staging rehearsal, k3s and dev cell from scratch: green.

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
| npm advisories (moderate): `glob` ≤ 14.0.1, `minimatch` < 11.0.1 | Only through `node-pg-migrate` 8.0.4, whose latest release still pins glob 13 | Accepted, tracked (20 Nov 2026) | Exploitation needs attacker-controlled glob patterns or abort signals; migrations list a fixed, trusted directory. Upgrade when node-pg-migrate moves to a patched glob. `ajv` was upgraded to 8.18.0 (fixed) |

The accepted findings are annotated on the pod templates (`checkov.io/skip*`), so the reasons travel with the manifests.

## 17.5 Validation backlog (owner: engineering; due before the phase named)

| # | Validation | Due |
|---|---|---|
| B1 | First green CI run on GitHub (all six jobs) — **done 19 Nov 2026 (run 2)**. Rehearsals: scheduled runs only start from the default branch, so since 20 Nov 2026 they also run on pushes to working branches that touch what they exercise | Week 2 of Phase 2 |
| B2 | Staging rebuild from IaC < 2 h (O-AC1) | Phase 2 week 5 (needs a provider) |
| B3 | External threat-model review (O-AC3) | Phase 2 week 6 (needs an adviser) |
| B4 | Second synthetic country pack `xx` → no code change needed — **proven at package level 20 Nov 2026 (R43)**; end-to-end with a running cell in Phase 3 | Phase 3 |
| B5 | Trace scrubbing test — **done 19 Nov 2026**; log privacy test — **done 20 Nov 2026** (R27). Per-module extensions as modules are built | Phase 3 (per module) |
| B6 | RLS presence test and IDOR suite templates | Phase 3 |
| B7 | Image signature verification at admission. Registry + digest policy done (R28); signature enforcement with an OpenBao-held, non-exportable key tested on GitHub (R36); remaining: the release-key ceremony (two people) | Before pilot |
| B8 | OpenAPI 3.1 conversion + schema validation — **done 19 Nov 2026**; breaking-change detection when the first business endpoint exists | Phase 3 (breaking changes) |
| B9 | Load, noisy-neighbour, soak, failover tests (§14.5) | Phase 6 |
| B10 | First restore drill and first DR test **on real hosts** — on containers: drills (latest, point in time) and full site-loss DR (R32) done | Before pilot |
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
