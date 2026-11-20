# 15. Observability, Backup and Disaster Recovery

| | |
|---|---|
| Decisions | ADR-011 (self-hosted observability; no personal data in logs), ADR-029 (backup, DR, residency), ADR-003 (PostgreSQL operations) |
| Original item | **O-A6** observability stack |
| Targets | RPO ≤ 15 min, RTO ≤ 4 h (pilot; PRD §12.7, Phase 0 §8.10); two in-country sites in production; monthly restore drill; quarterly DR test (Phase 0 §10.11) |
| Built in Phase 2 | OTel collector + Prometheus + Loki + Tempo + Grafana (`grafana/otel-lgtm` 0.11.0) in the dev cell, login required; `civora-core` exposes Prometheus metrics (`civora_core_*`) and writes structured JSON logs; health and readiness probes |
| Built 19 Nov 2026 | **Tracing** in `civora-core` (OpenTelemetry 3.0: HTTP, Express, NestJS, pg) exported through an attribute allow-list; e2e scrubbing test; dev-cell check that traces reach Tempo without request data. **Backups** as code: role `postgresql_ha` (pgBackRest TLS repository, timers, restore drill) tested on containers |
| Not yet built | Alerting rules; status page; backups on real database nodes (need a provider) |

## 15.1 Observability architecture (per cell, in-country)

```mermaid
flowchart LR
  CORE["civora-core<br/>/metrics, JSON logs, OTLP traces (allow-list)"] --> COL["OTel collector<br/>(scrub + allow-list attributes)"]
  KC["Keycloak metrics/events"] --> COL
  PG["PostgreSQL / Patroni exporters"] --> COL
  K8S["Kubernetes, node exporters"] --> COL
  COL --> PROM[("Prometheus<br/>metrics 13 months")]
  COL --> LOKI[("Loki<br/>logs 30 d hot")]
  COL --> TEMPO[("Tempo<br/>traces 14 d")]
  PROM & LOKI & TEMPO --> GRAF["Grafana<br/>(SSO, RBAC)"]
  PROM --> AM["Alertmanager → on-call"]
  AM --> STATUS["Status page<br/>(public, no internals)"]
```

| Signal | Content rule | Retention [A] |
|---|---|---|
| Metrics | Counters and histograms; labels limited to service, route template, status class, tenant id. **No user ids, no free text** | 13 months |
| Logs | Fixed JSON fields: `ts`, `level`, `service`, `context`, `msg`, `requestId`, `tenantId`. **Never** request bodies, headers, tokens, identifiers or content. The skeleton logger already writes only fixed fields | 30 days hot, 1 year archive (in-country) |
| Traces | Span names from route templates; attribute allow-list in the collector drops everything else | 14 days |
| Audit | **Not** an observability signal. It goes to `pg-consent-audit` (hash chain), never to Loki | ≥ 5 years |

**Personal-data guard.**
- The collector drops unknown attributes, and a scrubber processor masks patterns: CIN, phone, e-mail, IBAN/RIB.
- From Phase 3, a CI test sends synthetic requests containing reserved-range identifiers and asserts that none appears in the logs, traces or metrics captured by a test collector.

## 15.2 Alerts (first set, Phase 3)

| Alert | Condition | Severity |
|---|---|---|
| API availability burn | 1 h burn rate > 14× (99.5% objective) | Page |
| Latency | p95 > 1.5 s for 15 min | Page |
| Readiness | `/health/ready` failing on > 50% of pods for 5 min | Page |
| Database | Replication lag > 30 s; free disk < 15%; WAL archive failing | Page |
| Backup | No successful pgBackRest backup in 26 h; WAL gap > 15 min (RPO at risk) | Page |
| Queue | Oldest job age > 5 min | Ticket → page if > 30 min |
| Security | Policy-deny burst, break-glass use, admin role change, key usage anomaly | Security on-call |
| Certificates | Expiry < 21 days | Ticket |
| Regulatory deadlines | Cases with `due < now + 2 days` and no owner | Tenant notification (product feature, Phase 6) |

## 15.3 Backup (ADR-029; Phase 0 §9.9)

| Data | Method | Schedule | Copies | Encryption |
|---|---|---|---|---|
| PostgreSQL (`pg-core`, `pg-public`, `pg-consent-audit`, Keycloak DB) | **pgBackRest**: full weekly, differential daily, continuous WAL archiving (PITR) | WAL every ≤ 60 s or 16 MB | Repository 1 on the backup node (site A); repository 2 at the second in-country site | pgBackRest repository encryption; keys separate from production keys |
| `pg-consent-audit` | As above + **WORM-style** retention on repository 2 | Same | Same | Same |
| Object storage | Bucket versioning; object lock on evidence buckets; replication to site B | Continuous | 2 | Envelope encryption (per-tenant keys) |
| OpenBao | Raft snapshots | Hourly | 2 sites | Snapshots encrypted; unseal keys under M-of-N |
| Redis | Not backed up as a system of record (queues are rebuilt from the outbox; sessions expire) | — | — | — |
| Kubernetes state | etcd snapshots (RKE2 `etcd-snapshot-schedule-cron` every 6 h, 28 retained — in the Ansible template) + GitOps (Git is the source of truth) | 6 h | 2 | — |
| Audit-chain anchors | Daily signed chain head stored outside the cluster (and optionally time-stamped by a qualified service) | Daily | 2 | Signed (HSM) |

**Residency.** Both backup sites are in Tunisia. The OpenTofu cell module rejects nodes outside the country and requires the backup node to be in a different zone from every database node (tested).

## 15.4 Recovery objectives and strategy

| Scenario | Strategy | RPO | RTO |
|---|---|---|---|
| Pod or node failure | Kubernetes rescheduling; Patroni automatic failover | 0 (synchronous replica) – 1 min | < 5 min |
| Data corruption or human error | pgBackRest PITR to a point before the event, into a new cluster; tenant-scoped repair by export/import | ≤ 15 min | ≤ 4 h |
| Loss of site A — with a live second site (standby cluster, recommended for regulated tenants) | Promote the standby cluster at site B (one command); router to site B; object-storage replica; Argo CD redeploys from Git | ≤ 5 s (target; measured: **0 acknowledged writes lost**) | ≤ 30 min including the decision (measured technical part: writes back **10 s** after the loss) |
| Loss of site A — repository only at site B | Restore at site B from repository 2 + object-storage replica; Argo CD redeploys from Git; DNS switch | ≤ 15 min (measured: last 16 s lost) | ≤ 4 h (measured: 70–85 s on containers, plus provisioning) |
| Ransomware or compromised credentials | WORM backups, offline unseal keys, rebuild from IaC + restore; key rotation | ≤ 15 min | ≤ 24 h (declared disaster) [A] |
| Tenant asks for its data back (exit) | Tenant export (cases, documents, audit chain + verification tool) | — | Per contract |

### 15.4.1 Recovery objectives by data class

Phase 0 §10.1 classes; the PRD's ≤ 15 min / ≤ 4 h is the floor for every tenant. Critical data gets stronger objectives and the topology needed to meet them. Choosing them for a tenant is part of the commercial offer (deployment tier, ADR-019) and of the founder's decisions on ADR-003 and ADR-029 (both **Proposed**).

| Data class | Examples | Server loss: RPO / RTO | Site loss: RPO / RTO | Corruption or human error | Topology required | Evidence |
|---|---|---|---|---|---|---|
| **Critical regulated** | Complaints and claims of financial institutions under regulatory deadlines (BCT circular 2022-08); health data (T0, special category); data submitted to or for government bodies; the audit chain | **0** / ≤ 1 min (automatic) | **≤ 5 s** / **≤ 30 min** | Point-in-time restore to any second; ≤ 15 min / ≤ 4 h | 3 database servers at the main site; **standby cluster** (2 servers) + repository 2 at the second site; audit database also WORM on repository 2 | 3-server suite (R24): nothing acknowledged lost; standby-site rehearsal (R39): 0 of 176 lost, writes back 10 s after the loss |
| **Standard tenant data** | Other personal and business data (T1–T2) | 0 / ≤ 5 min | ≤ 15 min / ≤ 4 h | ≤ 15 min / ≤ 4 h | 2–3 database servers; repository 2 at the second site | `dr.sh` (R32): last 16 s lost, writes back 70–85 s |
| **Rebuildable** | Queues and cache (Valkey), search indexes, derived reports | Rebuilt | Rebuilt from the transactional outbox and the database | — | No backup; HA for availability only | Valkey failover R34; outbox ADR-008 |

**What "≤ 5 s" means.** The second site receives WAL continuously, as it is written. What it can lose is what had not yet crossed the link at the instant of the loss. That was nothing in the rehearsal, at five writes per second on a fast network. Two things degrade it:
- a slow or broken link between the sites;
- a burst of writes larger than the link can carry.

Both are visible: alerts fire when the second site disconnects for 5 min, or is more than 256 MB behind (§15.2, R35). **RPO 0 across sites** needs every commit acknowledged by the second site. That costs one inter-site round trip on each commit, and stops writes when the link fails. It is technically possible: a stretched cluster with a third-site witness. It is not recommended for the MVP. If a tenant contractually requires it, the founder decides, together with the cost.

**What "≤ 30 min" includes.** Measured technical time is 10 s:
- 4 s to promote;
- then the router points at site B.

The rest is the decision that site A is lost, and fencing it so it cannot return as a second primary ([runbook](runbooks/database-operations.md) §8.1). Both are human steps and should be practised in the quarterly DR drill.

## 15.5 Drills and evidence

| Drill | Frequency | Evidence kept | Pass criteria |
|---|---|---|---|
| Restore drill (Phase 0 §9.9) | **Monthly** | Restore log, checksums, row counts, smoke-test output, time taken | Restore + smoke test within RTO; checksums match |
| DR failover (one cell) | **Quarterly** | Timeline, gaps, actions | RPO/RTO met |
| Audit-chain verification | Weekly, automated | Verifier output | No break; anchors match |
| Deploy from scratch (O-T3) | Nightly (CI) and before each release | Timed job summary | Smoke tests pass; time trend recorded |

"A backup is only verified once restored" (Phase 0 §9.9). The first restore drill is a gate for the first pilot.

## 15.6 Phase 2 status of this design

| Element | Status |
|---|---|
| Observability stack | Running in the dev cell; Grafana requires login (smoke test) |
| Application metrics and logs | Built and tested (`/metrics` exposed; e2e test) |
| Tracing in the application | **Built and tested** (allow-list exporter; e2e scrubbing test; spans reach Tempo in the dev cell) |
| Backups | **Role written and tested on systemd containers**: encrypted repository (unreadable without the passphrase — tested), WAL archiving, weekly full + daily differential timers, restore drill with checksum verification, **point-in-time restore**, **repository 2 at a second site** with its own key (tested 20 Nov 2026). Real database nodes need a hosting provider |
| Disaster recovery (loss of site A) | **Rehearsed on containers, two ways** (nightly on GitHub): (1) new cluster built at site B from repository 2 by the role: data lost = last 16 s, writes back after 70–85 s (R32); (2) **live second site**: standby cluster promoted with one command: **0 of 176 acknowledged writes lost**, promotion 4 s, writes back 10 s after the loss (R39). [Runbook](runbooks/database-operations.md) §8 and §8.1 |
| Monitoring stack | kube-prometheus-stack, Loki and Tempo as Argo CD apps with pinned chart versions. The in-cluster node exporter is disabled because it needs privileged pods; host metrics come from the node exporter installed by Ansible over TLS. Infrastructure alerts from §15.2 written and unit-tested (R35); application alerts remain Phase 3 |
| Database failover as the application sees it | Through `pg-router`: no acknowledged write lost; longest write gap 26.7 s (2 servers) / 39.0 s (3 servers); application process survives (R25, R26) |
| etcd snapshots | In the RKE2 configuration template |
| Drills | Restore-drill script in the role (`civora-restore-drill`, latest or point in time); site-loss DR rehearsal (`dr.sh`); procedures in the [database runbook](runbooks/database-operations.md); first drills on real hosts after provider selection |
