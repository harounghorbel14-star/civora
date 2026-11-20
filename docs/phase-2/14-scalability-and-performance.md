# 14. Scalability and Performance

| | |
|---|---|
| Decisions | ADR-001 (modular monolith; extraction triggers), ADR-003 (PostgreSQL), ADR-008 (outbox + BullMQ), ADR-016 (tenancy) |
| Targets (PRD §12.7) | API p95 < 1.5 s; status page LCP < 2.5 s on 3G; work queue < 1 s for 5,000 open cases; 500 concurrent agents and 1 M cases per tenant; availability 99.5% pilot / 99.9% production |
| Measured in Phase 2 | Framework baseline of the skeleton (§14.4). Business-load tests start in Phase 6 when the case engine exists |

## 14.1 Scaling model

| Component | Scales by | Limit that triggers the next step |
|---|---|---|
| `civora-core` (stateless) | Horizontal pods. HPA on CPU 70%: 2 → 6 replicas in the chart; raise `maxReplicas` per cell size | p95 objective breached at max replicas → profile; a measured hotspot is a §8.11 trigger for extraction |
| Background work | BullMQ workers as a separate Deployment of the same image (`ROLE=worker`, Phase 3). Per-tenant fair queues | Queue latency SLO (§14.3) |
| PostgreSQL | Vertical first; read replicas (Patroni) for reporting projections; table partitioning by month for events and audit; per-tenant dedicated DB tier for the largest tenants | CPU > 70% sustained or replication lag > 5 s |
| Redis | Single primary + replica (Sentinel) per cell | Memory > 70% → separate cache and queue instances |
| Object storage | Provider capacity; lifecycle rules | — |
| Keycloak | 2+ replicas with a shared database; Infinispan cache | Login p95 > 1 s |
| Cells | One more cell per country or per dedicated tenant (tiers 3–4) | Contract or residency |

**No microservices split before a trigger** (Phase 0 §8.11, Phase 1 §18.3):
1. a measured scaling need;
2. a compliance or hosting boundary;
3. more than about 3 teams contending on one deployable;
4. a different availability tier.

Health (Phase 7) and AI (Phase 10) are already separate because of trigger 2.

## 14.2 Design rules that keep the monolith fast

1. **Every query is tenant-scoped and indexed.**
   - Composite indexes lead with `tenant_id`.
   - Queues are served by indexes on `(tenant_id, status, due_at)`.
   - The 5,000-open-cases queue target is a single index range scan.
2. **Deadlines are computed when a case is written, not when it is read.** `regulatoryDueOn` is stored with the rule-pack version, so a queue sorted by due date needs no calendar arithmetic at read time.
3. **Cursor pagination only.** No `OFFSET`; the page size is capped at 100.
4. **Reporting reads projections.** Monthly and annual statements (ROGS760) come from event-fed projection tables, never from scans of the live case tables during business hours.
5. **No synchronous calls to external systems in user-facing requests.** External calls go through the outbox and adapters with timeouts (ADR-028). The user sees a pending state.
6. **Cache only T3 data and configuration.**
   - Country packs and rule packs are loaded once, verified once, and served from memory.
   - Locale descriptions should be memoised. The baseline shows `GET /v1/meta/locales` at less than half the throughput of `/health`, because `Intl.DisplayNames` is built per request — fix in Phase 3.
7. **Connection pools are bounded.** Each pod holds at most 10 connections; PgBouncer in transaction mode is added once pods × pool size approaches `max_connections`. `SET LOCAL` keeps RLS safe with transaction pooling.

## 14.3 Service-level objectives (per cell)

| Journey / component | SLI | Pilot SLO | Production SLO |
|---|---|---|---|
| API availability | Share of non-5xx responses (excluding `/health`) | 99.5% / 30 days | 99.9% |
| API latency | p95 of `/v1/*` server time | < 1.5 s | < 1.0 s [A] |
| Work queue | p95 time to first page of the agent queue, 5,000 open cases | < 1 s | < 1 s |
| Customer status page | LCP on emulated 3G (Lighthouse) | < 2.5 s | < 2.5 s |
| Background jobs | p95 delay between enqueue and start | < 30 s | < 10 s [A] |
| Notifications | Acknowledgement sent within | 5 min | 1 min [A] |
| Regulatory deadline engine | Cases whose stored due date differs from a recomputation | 0 | 0 |

Error budgets drive release pace. If the 30-day budget is spent, the next sprint prioritises reliability (Phase 11 operations).

## 14.4 Phase 2 baseline (measured 19 Nov 2026)

**Setup:**
- `civora-core` walking skeleton, one Node 22 process, no database configured.
- Sandbox with 4 vCPU (Xeon 2.1 GHz).
- autocannon 8.0.0: 50 connections, 15 s, loopback.

| Endpoint | Throughput (avg) | Latency p50 | p99 | Max |
|---|---|---|---|---|
| `GET /health` | 9,155 req/s | 4 ms | 12 ms | 45 ms |
| `GET /v1/meta/locales` (`Accept-Language: ar`) | 4,002 req/s | 11 ms | 24 ms | 46 ms |

**Interpretation.**
- Framework, middleware and serialisation overhead is small compared with the 1.5 s p95 budget.
- Business performance will depend on database design and queries, which are tested in Phase 6 with the targets above.
- These numbers are a regression baseline, not a capacity claim.

## 14.5 Load-test plan (Phase 6, before pilot)

| Test | Profile | Pass criteria |
|---|---|---|
| Queue under load | 1 M synthetic cases in one tenant (generator in `packages/synthetic-data`), 5,000 open; 500 concurrent agents browsing and updating | Queue p95 < 1 s; API p95 < 1.5 s; no errors |
| Noisy neighbour | Tenant A at 5× normal load; tenant B normal | Tenant B SLOs hold (rate limits and fair queues work) |
| Deadline batch | Year-end statement for a large tenant | Completes inside the maintenance window; no impact on interactive p95 |
| Soak | 8 h at 60% peak | No memory growth > 10%; no connection leaks |
| Failover | Kill a core pod, a PostgreSQL primary, a Redis primary during load | Recovery within RTO; no lost acknowledged writes (outbox) |

Tools: k6 or autocannon scripts in `tests/load/` (Phase 6), run in staging with synthetic data only.

## 14.6 Capacity starting point (staging; adjust after measurement)

| Node role | Count | Size (indicative) [A] |
|---|---|---|
| Kubernetes servers (control plane + workloads) | 3 | 8 vCPU / 32 GB |
| Kubernetes agents | 2 | 8 vCPU / 32 GB |
| PostgreSQL (Patroni primary + replica) | 2 | 8 vCPU / 32 GB, NVMe |
| Backup / pgBackRest repository | 1 | 4 vCPU / 16 GB, capacity ≥ 3× data |

This is the topology encoded in `infra/tofu/envs/staging-tn`. Sizes are assumptions until provider quotes arrive (E-07).
