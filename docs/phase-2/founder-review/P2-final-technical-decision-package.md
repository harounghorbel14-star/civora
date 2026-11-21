# Final technical decision package — six decisions and P2-D2 to P2-D5

| | |
|---|---|
| Prepared | 20 November 2026, at the founder's request |
| Status | **Decided 21 Nov 2026:** the founder approved the ADRs as recommended (P2-D1) and Phase 2 ([decision record](P2-founder-decision-record.md)). P2-D2 to P2-D5 remain founder actions. *Original status: "For decision. Nothing in this document is approved."* |
| Relationship to earlier material | This package does not repeat the plain-language explanations in the [P2-D1 review package](P2-D1-adr-review-package.md). It adds what is needed to decide: exact ADR numbers, evidence gathered since, costs, security and operations, and what changes in the plan for each answer |
| Cost convention | No supplier quote exists yet (Phase 1 evidence E-07), so costs are given in **units** (servers, engineer-days, licences), never as invented prices. [A] = engineering estimate |
| Roadmap | The 15-phase roadmap and all acceptance criteria are unchanged. These decisions close part of O-AC2 ("all ADRs approved"); none starts Phase 3 |

## Summary

| # | Decision | ADR | Engineering recommendation | Blocks if undecided |
|---|---|---|---|---|
| 1 | Three database voting members per production site | **ADR-003** (approve with condition) | Approve: 3 per bank production site; 2 acceptable for staging | Production sizing in hosting quotes |
| 2 | Apache APISIX instead of the retired community NGINX ingress | **ADR-030** (new) and the open question in ADR-013 | Approve | Public exposure of staging |
| 3 | Cedar for application authorisation | **ADR-006** | Approve | Phase 3 authorisation module |
| 4 | Tenant isolation strategy | **ADR-016** (with ADR-003, ADR-012) | Approve | Phase 3 data access layer; sales to banks |
| 5 | Customer-hosted deployment | **ADR-019** (with ADR-027) | Approve | Offers to banks that cannot outsource |
| 6 | S3-compatible object storage | **ADR-020** | Approve | Provider choice (object lock in Tunisia) |
| — | Additional finding: Redis licence → Valkey | ADR-008 (open question) | Use Valkey 9.1 (BSD) | HA cache build for staging (§8) |

**How to answer.** For each decision, write one of the following in the decision form:

- approve;
- approve with conditions (for example "ADR-003: 3 database servers per production site");
- reject;
- defer.

A rejection is not a failure: section "If rejected" says what then happens.

---

## 1. Three database voting members per production site — ADR-003

**What exactly is decided.** Each production site runs **3 PostgreSQL servers**. Each one is:

- a Patroni member;
- a voting member of the 3-member etcd quorum that elects the leader.

Synchronous replication to one standby (`synchronous_node_count: 1`) guarantees that a confirmed save is never lost. The backup node is not a voter at a 3-server site. Staging keeps 2 servers plus the backup node, which then carries the third etcd vote. This is a **condition on ADR-003**, not a new ADR.

**Technical justification — measured, 20 Nov 2026** ([17 §17.2.1](../17-technical-validation-strategy.md)):

| Situation | 2 servers | 3 servers |
|---|---|---|
| Leader crash, normal conditions | Takeover 23–25 s, 0 confirmed writes lost | Takeover 36 s, 0 lost |
| Leader crash while another server is down or restarting | **Writes stop** until an operator acts. The operator's way out lost **50 of 50** writes confirmed in the window | **Automatic** takeover in 35 s, nothing lost |
| Planned switchover (patching) | 2 s, but the site runs without a standby during the work | 2 s, still one standby during the work |
| Test suite | 31/31 checks (also green on GitHub runners) | 35/35 checks (also green on GitHub runners) |

**Alternatives.**

| Option | Assessment |
|---|---|
| 2 servers, synchronous (current staging design) | Cheapest. No confirmed save lost, but automatic recovery is refused in the window above; banks would face downtime or a manual choice to lose data |
| 2 servers, asynchronous | Always fails over automatically; may lose the last seconds of confirmed saves (RPO > 0) — contrary to the banking-grade target |
| 3 servers with quorum commit (Patroni 4 `synchronous_mode: quorum`) | Stronger still. The Ubuntu 24.04 packages tested here are Patroni 3.2.2, so this would need newer packages. Revisit at the first upgrade |
| Managed PostgreSQL from the provider | Only if it offers in-country synchronous HA, PITR and a second site; unknown until quotes arrive (E-07) |

**Costs.**
- **One more database server per production site.** Sized like the others ([13 §13.6](../13-cloud-and-deployment-architecture.md) criterion "≥ 8 vCPU / 32 GB"), with block storage equal to the data set and replication traffic about 1.5 times the 2-server case.
- Staging is unchanged.
- No licence cost (PostgreSQL, Patroni, etcd and pgBackRest are open source).
- Engineering: **none added**. The role already supports 3 servers and is tested.

**Security implications.**
- Same TLS-everywhere and least-privilege design as today.
- One more host to harden and patch.
- Fewer manual interventions in incidents, so less room for an operator error that loses data.

**Operational implications.**
- Patching can be done one server at a time while automatic failover stays available.
- The on-call runbook's "manual decision" section ([runbook §4](../runbooks/database-operations.md)) applies only to 2-server sites.

**Implementation consequences.**

| If approved (with the condition) | If rejected |
|---|---|
| Production inventories use 3 database servers per site. The hosting quote request asks for 3 database VMs per production site. Staging stays at 2. The setting `DB_NODES=3` is already tested nightly | 2 servers everywhere. The runbook's manual procedure, with its data-loss cost, is accepted in writing for each bank. That written acceptance is recommended as part of the contract |

---

## 2. Apache APISIX instead of the retired community NGINX ingress — ADR-030

**What exactly is decided.**
- APISIX becomes the edge gateway and Kubernetes ingress **from the MVP**.
- Its routes are managed by the APISIX Ingress Controller 2.x and synced from Git.
- It runs with a dedicated 3-member etcd built from the upstream image.
- The packaged ingress-nginx in RKE2 is disabled.

This amends Phase 0 §8's "NGINX ingress (MVP) → APISIX/Kong at pilot" by bringing the pilot choice forward. Full text: [ADR-030](../adr/ADR-030-api-gateway-apache-apisix.md).

**Technical justification.**
- The community ingress-nginx is unmaintained since March 2026 ([notice](https://kubernetes.io/blog/2025/11/11/ingress-nginx-retirement/), [statement](https://www.kubernetes.io/blog/2026/01/29/ingress-nginx-statement/)).
- APISIX is already Phase 0's pilot choice. It is Apache-2.0 licensed and provides the Phase 0 gateway requirements as built-in plugins: rate limiting, API keys for B2B, mTLS to upstreams, JWT.
- One migration fewer.

**Alternatives.** See ADR-030:

- F5 NGINX Ingress Controller (open-source edition);
- Envoy Gateway or Traefik;
- Kong;
- keeping ingress-nginx (rejected).

**Costs.**
- No licence cost.
- Per cell: 2+ gateway pods and 3 small etcd pods.
- Engineering: 3–5 days [A].

**Security implications.**
- Removes an unpatched internet-facing component.
- New duties:
  - the admin API is never exposed, and the default key is refused (APISIX has had admin-API vulnerabilities in the past with default keys);
  - images are mirrored and pinned (ADR-027);
  - WAF (OWASP rules via a WASM plugin) must be proven on staging before pilot.

**Operational implications.**
- One more stateful component (etcd) per cell, until the etcd-free mode leaves "experimental" upstream ([release notes](https://apisix.apache.org/blog/2025/12/19/apisix-ingress-controller-2-0-release/)).
- Gateway skills are needed in operations.

**Implementation consequences.**

| If approved | If rejected |
|---|---|
| Engineering builds the APISIX platform app: pinned chart, etcd from the upstream image (not Bitnami), policies, rehearsal on GitHub runners. RKE2 role gains `disable: [rke2-ingress-nginx]`. Until it is built, **staging is not exposed publicly** | You choose another maintained option from the ADR-030 alternatives. Until then, staging stays private. Keeping ingress-nginx is not offered |

---

## 3. Cedar for application authorisation — ADR-006

**What exactly is decided.**
- Cedar policies, evaluated in-process in `civora-core`, decide "who may do what".
- They are validated in strict mode against a schema in CI.
- PostgreSQL row-level security stays as the data-layer guard.
- OPA is not used for application authorisation.

**Technical justification** (spike in `spikes/policy-engine`, run in CI on every push):

| Criterion | Cedar | OPA (Rego) |
|---|---|---|
| Same 24 expected decisions | 24/24 | 24/24 (wasm and REST) |
| Schema enforced on policies and requests | **Yes** (strict validation) | No built-in schema |
| Readability of rules for auditors | Closer to plain rules; `forbid` always overrides `permit` | General-purpose language |
| Latency, p50 / p99, in-process | 247 / 560 µs | 7.7 / 23.6 µs |

Both engines are far below the 5 ms budget per request, so performance does not decide. Cedar's enforced schema and analysability do.

**Alternatives.**
- OPA/Rego: correct, faster, no schema.
- OpenFGA: a relationship model the current rules do not need.
- Hand-written checks: rejected (untestable).

**Costs.**
- No licence cost (Apache-2.0).
- The engineer must learn Cedar.
- The wasm package is pinned. 4.14.1 was published empty, which shows why pins and checks matter.

**Security implications.**
- Strict schema validation catches policy typos before deployment.
- `forbid` rules (cross-tenant access, break-glass limits) cannot be overridden by a later `permit`.
- Supply chain: one more pinned dependency, already covered by the CI gates.

**Operational implications.**
- Policies ship with country packs and are versioned and integrity-checked (ADR-017).
- Every new rule adds a case to the conformance table.

**Implementation consequences.**

| If approved | If rejected |
|---|---|
| Phase 3 builds the authorisation module on Cedar, pre-parsed per pack version | OPA is the drop-in alternative: the spike shows identical decisions. Phase 3 writes Rego instead, and schema checks must be built by hand |

---

## 4. Tenant isolation strategy — ADR-016 (with ADR-003, ADR-012)

**What exactly is decided.**
- One tenant = one institution.
- Four isolation tiers run the same code:
  - **shared** (row-level security + Cedar + per-tenant encryption keys);
  - **dedicated database**;
  - **dedicated cell**;
  - **customer-hosted cell**.
- Defence in depth, in order:
  1. the tenant is taken from the token only;
  2. Cedar `forbid` blocks cross-tenant access;
  3. `SET LOCAL` tenant context + row-level security;
  4. per-tenant field keys;
  5. audit.
- No cross-tenant analytics; support access only through break-glass.

**Technical justification and evidence.**
- Cross-tenant cases are part of the 24/24 Cedar conformance table.
- The running application connects as a database account that **cannot bypass row-level security** (`NOBYPASSRLS`; tested in the database suite and in the staging-shaped rehearsal).
- **Not yet built:** row-level security policies on business tables and the "every table has RLS" test (backlog B6, Phase 3). The design is ready, but the guarantee exists only once Phase 3 builds it.

**Alternatives.**
- A database per tenant by default: rejected on cost, but offered as a tier.
- A schema per tenant: rejected because of migration fan-out.

**Costs.**
- The shared tier is cheapest.
- Each dedicated tier adds infrastructure:
  - a dedicated database adds 2–3 database servers;
  - a dedicated cell adds a full cell;
  - customer-hosted runs on the customer's hardware.
- Pricing per tier is a commercial decision (Phase 1 pricing work), not taken here.

**Security implications.**
- Bank secrecy: whether the shared tier is acceptable for banks is a **counsel question** (already in the Phase 1 counsel brief). The dedicated tiers exist so that no bank is forced into sharing.
- Per-tenant keys allow crypto-shredding at exit.
- The main residual risk is a missing RLS policy on a new table. The Phase 3 presence test (B6) and the external threat-model review (P2-D3) address it.

**Operational implications.**
- Tier moves (shared → dedicated) go through export/import with checksums.
- Each tier adds monitoring targets.
- Break-glass access is logged and time-boxed (doc 06 §6.4).

**Implementation consequences.**

| If approved | If rejected |
|---|---|
| Phase 3 implements tenant context, RLS policies per table, the RLS presence test and the IDOR test suite (B6) | The likely alternative is a database per tenant for every institution: higher cost per tenant, simpler isolation argument, more migrations to run |

---

## 5. Customer-hosted deployment strategy — ADR-019 (with ADR-027)

**What exactly is decided.**
- Four deployment tiers; the fourth is a **customer-hosted cell**, operated by the bank or by CIVORA under contract.
- It is delivered as an **air-gapped bundle**: images, charts, country pack, SBOMs, signatures, checksums, release notes.
- It has no runtime dependency outside the cell. The bank may bring its own PostgreSQL, identity provider, HSM and object storage through standard interfaces.

**Technical justification and evidence.**
- Some banks may not be allowed to outsource (counsel question Art. 81).
- An air-gapped Kubernetes install from images imported into the node runs green on GitHub runners: **79 s** from nothing, 6/6 smoke checks plus an upgrade.
- The staging-shaped cell (HA database + Kubernetes + application) builds in **169 s** and survives a database leader crash.
- Images are admitted only from the cell's registry and only when pinned by digest (tested).
- Signature verification is being added (§9 of this round).

**Alternatives.**
- SaaS only: may exclude banks.
- A separate on-premises edition: a code fork, rejected.

**Costs.**
- No licence cost to CIVORA.
- The customer provides the hardware (same sizing as a dedicated cell; with decision 1, 3 database servers per site).
- CIVORA cost is mostly people:
  - bundle build pipeline, 3–5 days [A];
  - per-customer installation and support effort, priced per contract.

**Security implications.**
- The customer controls the infrastructure and keys, which is good for secrecy.
- CIVORA must make sure customers can verify what they receive: signed images, SBOMs and checksums.
- Risk: customers who delay updates run known vulnerabilities. A support policy (for example "current and previous release only") belongs in the contract.

**Operational implications.**
- No remote access by default; support works through exported diagnostics without personal data.
- Upgrades follow the same expand/contract migrations as SaaS (ADR-024).

**Implementation consequences.**

| If approved | If rejected |
|---|---|
| Bundle pipeline built before the first customer-hosted pilot; the support policy is drafted with counsel | SaaS and dedicated cells only. Banks that cannot outsource are out of reach until reconsidered |

---

## 6. S3-compatible object storage — ADR-020

**What exactly is decided.**
- The platform depends only on the **S3 API**, with versioning and object lock.
- Development uses SeaweedFS.
- Staging, pilot and production use the provider's S3-compatible store **if it offers object lock in Tunisia**. Otherwise a self-run store is chosen when the provider is selected (Ceph RGW, SeaweedFS or Garage).
- Per-tenant buckets or prefixes; envelope encryption with per-tenant keys; object lock for evidence.

**Technical justification.**
- The S3 API keeps every hosting option open: provider, self-run, or the bank's own storage for customer-hosted cells.
- Object lock is what makes evidence and audit exports tamper-evident.
- The dev cell's store refuses anonymous access (smoke test, also green on GitHub).

**Alternatives.**
- MinIO: not chosen. It is AGPL for redistribution, and its image was unavailable in this environment.
- Filesystem storage: rejected (no versioning or lock).

**Costs.**
- With a provider store: storage and requests per the quote.
- Self-run: 3 or more storage nodes per site, plus operations skills. Ceph is the heaviest to run; Garage and SeaweedFS are lighter.
- No licence cost for the candidates named.

**Security implications.**
- Object lock protects evidence against deletion, including by a compromised administrator.
- Envelope encryption keeps data unreadable without OpenBao keys, even for the storage operator.
- Bucket policies deny anonymous access.

**Operational implications.**
- A self-run store adds a stateful system to patch, monitor and back up.
- A provider store moves that work to the provider; the contract then needs object-lock and residency clauses.

**Implementation consequences.**

| If approved | If rejected |
|---|---|
| Object lock in Tunisia becomes a **must-have** in the hosting quote (P2-D4). The self-run fallback is chosen only if no provider offers it | A specific product would have to be chosen now, without quotes; portability for customer-hosted cells drops |

---

## 7. Recommendations for P2-D2 to P2-D5

These are the open founder decisions from the [readiness report](../phase-2-readiness-report.md) §4. None is recorded as decided.

### P2-D2 — Review rule while there is one engineer

**Recommendation:** option **(b)** for security-relevant paths, plus a **time-limited (a)** for everything else.

- (b) applies to `infra/`, `services/*/migrations/`, policies, CI workflows and the database role. An **external reviewer** approves each change, under a short paid engagement or as part of the security adviser's scope (P2-D3).
- (a) applies to documentation and application code without security impact. The founder self-reviews under a written waiver that **expires when engineer #2 joins**, or after 90 days, whichever comes first.
- **Why now:**
  - This week's work found two errors that a second reviewer would likely have caught: a check that claimed Pod Security validation it did not perform, and a test script that could report success after skipping checks.
  - Both were found and fixed, but they show the value of a second pair of eyes on infrastructure.
- **Cost:** a few reviewer-days per month [A] until the second hire.

### P2-D3 — External security adviser for the threat-model review (O-AC3)

**Recommendation:** add the threat-model review as a **line item** to the ANCS-certified auditor quote requests already prepared.

- The French request text is ready in the readiness report §7.2.
- Extend the scope with what was built this week:
  - tenant isolation (row-level security + Cedar + `NOBYPASSRLS`);
  - `pg-router` and database TLS;
  - the image admission and signature policies;
  - the disaster-recovery design;
  - the decision 2 gateway.
- **Expected effort** on the adviser side: 2–3 days [A].
- **Cost:** per quote, from the Phase 2 budget (100–150k TND, unchanged [A]).

### P2-D4 — Hosting provider for staging (and later pilot)

**Recommendation:** choose on the [13 §13.6](../13-cloud-and-deployment-architecture.md) criteria, adding the must-haves this week's work made concrete:

| Must-have | Why |
|---|---|
| 3 database VMs per production site in separate failure domains (decision 1) | Automatic failover with nothing lost |
| A second Tunisian site reachable over a private link, for the second backup repository and the disaster-recovery cluster | RPO ≤ 15 min, RTO ≤ 4 h (PRD §12.7) |
| S3-compatible storage **with object lock in Tunisia** (decision 6), or capacity to run it | Evidence integrity |
| HSM service or rack space (ADR-012) | Production signing keys |
| Label (N-Cloud/G-Cloud or CNI) for pilot and production | Circular 5/2026 |

- Interim: Phase 0 decision **D9** (hosting policy, approved 18 Nov 2026) already allows staging with **synthetic data** on any host while the labelled provider is contracted.
- The full O-AC1 rebuild ("staging from IaC in < 2 h") still needs this decision. After it, 11.5–17 engineer-days of provider-specific work remain ([16](../16-infrastructure-plan.md) §16.7).

### P2-D5 — GitHub settings (branch protection, Actions)

**Recommendation:** apply the settings in [07 §7.7](../07-security-and-privacy-architecture.md), with these updates:

- **Required status checks:** the six CI jobs: `build-test`, `secret-scan`, `codeql`, `iac`, `policy-engine-spike`, `image`.
- **Merge the working branch into `main` through a pull request** once you are ready. This also:
  - starts the **scheduled** nightly rehearsals (scheduled runs only start from the default branch);
  - runs image **signing and provenance** for the first time (O-SEC2 is not yet observed);
  - lets the push trigger for working branches be narrowed afterwards.
- **Two approvals** (O-SEC5): with one engineer this needs the P2-D2 arrangement.

---

## 8. Additional finding requiring a decision — Redis licence (ADR-008)

- Phase 0 and ADR-008 chose **Redis** (with BullMQ).
- The dev cell runs `redis:7-alpine`, which is currently **Redis 7.4.12**.
- Redis 7.4 and later are licensed RSALv2/SSPLv1 (not open source). Redis 8 adds an AGPLv3 option. **Valkey** is the Linux Foundation fork of the last BSD-licensed Redis, still under BSD-3-Clause ([redis.io licences](https://redis.io/legal/licenses/), [InfoQ](https://www.infoq.com/news/2025/05/redis-agpl-license)).
- For SaaS this is mostly a policy question. For **customer-hosted cells (decision 5)** CIVORA redistributes the images, and banks' legal teams generally prefer OSI-approved licences.
- **Recommendation:** use **Valkey 9.1** (BSD-3-Clause; same protocol; BullMQ works with it). Nothing in the application changes.
- **The HA cache built this round uses Valkey 9.1.3, pending your confirmation.** If you prefer Redis 8 under AGPLv3, only the image changes.

Also noted, with no decision needed: Bitnami's free container images stopped being maintained in 2025 ([Broadcom](https://community.broadcom.com/tanzu/blogs/beltran-rueda-borrego/2025/08/18/how-to-prepare-for-the-bitnami-changes-coming-soon), [Docker](https://www.docker.com/blog/broadcoms-new-bitnami-restrictions-migrate-easily-with-docker/)). The platform therefore uses no Bitnami charts or images; upstream images are used instead.

Also noted, for your awareness with ADR-027 (no separate decision needed beyond approving ADR-027):

- Image signatures will be checked at admission against a **CIVORA release key**. The keyless public-Sigstore signature cannot be verified offline in air-gapped or bank-hosted cells.
- The key must be created and held under two-person control (a key ceremony). That depends on the reviewer arrangement in P2-D2.
- Details: ADR-027, "Proposed revision, 20 Nov 2026".
