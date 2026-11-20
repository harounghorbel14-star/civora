# ADR final review register — evidence, risks and recommendation for all 30 ADRs

| | |
|---|---|
| Date | 20 Nov 2026 |
| Status of every ADR | **Proposed — awaiting founder approval.** Nothing in this register approves anything |
| How to decide | Fill the [decision form](P2-D1-decision-form.csv) (one row per ADR: approve / approve-with-conditions / reject / defer). Plain-language explanations of each ADR are in the [review package](P2-D1-adr-review-package.md); the six priority decisions in depth are in the [final technical decision package](P2-final-technical-decision-package.md) |
| Evidence references | R-numbers are rows of [17 — technical validation](../17-technical-validation-strategy.md) §17.2; "GitHub" means observed on GitHub runners, not only locally |

## 1. Summary

| | Count | ADRs |
|---|---|---|
| Implemented to the extent Phase 2 needs, and tested | 21 | 001–006, 008, 011–013, 015–017, 020–025, 027, 029 |
| Implemented partially (the rest is later-phase work the ADR names, or staging proof) | 5 | 014, 018, 019, 028, 030 |
| Design only, by design (later phases) | 4 | 007, 009, 010, 026 |
| Recommendation **approve** | 24 | |
| Recommendation **approve with conditions** | 6 | 003, 008, 012, 027, 029, 030 |
| Recommendation reject or defer | 0 | |

The six conditions are listed in §3. None blocks Phase 3 if approved. Each records a choice the founder should make knowingly.

## 2. Register

**Columns:**
- **Built:** where the decision is implemented.
- **Evidence:** the test rows that prove it (R-numbers, doc 17).
- **Security and operations:** what changes for each.
- **Open risk:** what is still unresolved.
- **Rec.:** my recommendation.

| ADR | Built (where) | Evidence | Security and operations | Open risk | Rec. |
|---|---|---|---|---|---|
| 001 Modular monolith + separate health-bridge, guide, key service | `services/core` (NestJS modules, boundary rules) | Architecture fitness check in CI (module boundaries) | One deployable to secure and patch; health and AI isolated by process | Boundary discipline must hold as modules grow (fitness check enforces) | Approve |
| 002 TypeScript end-to-end, strict | All packages and services | CI build + typecheck; 7 package suites, core unit/e2e/integration | One language to audit and scan | Node.js supply-chain exposure (mitigated by ADR-027 gates) | Approve |
| 003 PostgreSQL clusters per tier, schema per module, RLS | Role `postgresql_ha` (Patroni, etcd, pgBackRest), `pg-router`, migrations | R24 (2 and 3 servers, GitHub), R25, R26, R37 (router defect fixed), R32, R39 | RLS + NOBYPASSRLS app account (tested); TLS everywhere; verify-ca replication; failover 23–37 s with nothing acknowledged lost | 2-server sites can stall without a sync standby (R2-10) | **Approve with conditions** (§3.1) |
| 004 Country cells, no cross-cell data flows | OpenTofu cell module residency guard | R10; `tofu-guards.sh` (node outside the country refused) | Data residency enforced at plan time | Cross-cell analytics must stay aggregate-only (Phase 9+) | Approve |
| 005 Keycloak broker; passkeys first; SMS OTP fallback | Dev realm; Keycloak Operator + 3-instance resource; HA test | R33 (GitHub); realm conformance (R42) — **found and fixed missing refresh-token rotation** | Brute force, password policy, 5-min tokens, PKCE S256, no implicit/password grants (checked in CI) | Passkey and step-up flows are Phase 3 | Approve |
| 006 Cedar for ABAC (OPA evaluated) | `spikes/policy-engine` | R16: 24/24 decisions agree (Cedar, OPA-wasm, OPA-REST); strict schema validation | Policies reviewable and analysable; in-process (no network hop) | Policy authoring discipline (Phase 3 standard) | Approve |
| 007 FHIR server deferred to Phase 7 | — (design) | — | Health data not processed before Phase 7 | Choice re-opened in Phase 7 | Approve |
| 008 Outbox + BullMQ (Redis) | Valkey HA chart (3 + 3 Sentinels); outbox pattern in standards | R34, R38 (cause found), R40 (chart on Kubernetes: failover 7 s, GitHub) | Queue is rebuildable (not a system of record); password as file; NetworkPolicy (intruder with password refused) | **Redis ≥ 7.4 is not open source**; failover depends on healthy cluster DNS (R38) | **Approve with conditions** (§3.2) |
| 009 Verifiable credentials standards | — (design, Phase 4) | — | — | Standards still moving (EU wallet) | Approve |
| 010 RAG-only assistant, model gateway with location policy | — (design, Phase 10) | — | No personal data to foreign models (location policy) | Model hosting in Tunisia unproven | Approve |
| 011 Self-hosted observability, no personal data in logs | Dev cell stack; kube-prometheus-stack, Loki, Tempo apps; alert rules | R21, R27 (defect fixed), R35 (15 rules, promtool), router metrics | Privacy allow-lists for traces and logs (tested with canaries) | Application alerts are Phase 3 (needs app metrics) | Approve |
| 012 OpenBao + HSM; envelope encryption; per-tenant keys | OpenBao HA app (Raft, TLS); release key in OpenBao transit | R31; R36 (key not exportable, signer-only policy) | Secrets never in Git; keys non-exportable | **HSM availability from Tunisian providers unknown** | **Approve with conditions** (§3.3) |
| 013 Kubernetes (RKE2/k3s), Helm, OpenTofu, Ansible, Argo CD | `infra/*` | R8, R18, R30 (GitHub), R31, `tofu-guards.sh` | Restricted Pod Security everywhere (warnings fail CI); pull-based deploys | Real-host RKE2 hardening untested until a provider exists | Approve |
| 014 Accessibility (WCAG 2.2 AA) and RTL as release gates | i18n/RTL package; locale negotiation | Unit tests; `/v1/meta/locales` e2e | — | UI gates start with the first UI (Phase 3) | Approve |
| 015 API standards (REST, OpenAPI 3.1, errors, idempotency) | Contract + lint gate | R20; gateway test R41 | Problem+JSON without echoed input (R27) | Breaking-change detector needs the first business endpoint | Approve |
| 016 Multi-tenancy tiers | RLS, tenant claim mapper, deployment tiers in cell module | R24 (RLS, NOBYPASSRLS); Cedar tenant rules (R16) | Cross-tenant access blocked in the database even if code errs | IDOR suite is a Phase 3 template (B6) | Approve |
| 017 Country and rule packs as versioned, integrity-checked config | `packages/country-packs` | Tamper detection; **second synthetic country loads and changes deadlines with no code change** (R43) | Signed digests; production refuses synthetic packs | Real TN holiday list still unverified (Q-12) | Approve |
| 018 Data classification and governance | Inventory (`data/data-inventory.csv`), tiers T0–T3 | Synthetic-data fitness check | — | Inventory must be kept current per module (Phase 3) | Approve |
| 019 Deployment tiers incl. customer-hosted | Same IaC for cloud and on-premises; static hosting adapter | R18 (air-gapped k3s); `pilot-tn` environment | No managed-service dependency (doc 20 confirms none available) | Bank on-premises packaging only when a customer signs | Approve |
| 020 S3-compatible object storage | Dev cell object store (refuses anonymous) | R7 | Bucket policies, versioning, object lock planned | Provider S3 vs self-hosted decided with the provider (doc 20) | Approve |
| 021 Feature flags (OpenFeature, in-process) | `packages/feature-flags` | Unit tests | Flags from signed country packs | — | Approve |
| 022 Identifiers, time, money, locale conventions | Packages and pack schema | Unit tests | Synthetic identifiers only (fitness check) | — | Approve |
| 023 Monorepo structure | Repository | CI | One set of gates for all code | — | Approve |
| 024 Migrations: node-pg-migrate, expand/contract | `services/core/migrations` | Migration tests; migrations through `pg-router` as owner (R24) | Migrator separate from runtime account | Expand/contract discipline (Phase 3) | Approve |
| 025 Environments and synthetic data | Dev cell; production refuses synthetic pack | R7, R22 | No real personal data anywhere | — | Approve |
| 026 AI agent runtime | — (design, Phase 10) | — | Human approval for consequential actions | — | Approve |
| 027 Supply-chain security | CI gates (Trivy, SBOM, gitleaks, Checkov), digest admission policy, signature enforcement | R12–R15, R28, R36 (GitHub) | Only signed, pinned images run (tested) | **Release key ceremony needs two people** | **Approve with conditions** (§3.4) |
| 028 Integration adapter framework | Adapter contract design; simulated adapters | Contract tests (Phase 3 template) | No live integration (register: 0 live) | Each real integration needs a legal basis and a DPA | Approve |
| 029 Backup, DR, residency | pgBackRest 2 repositories; standby cluster at site B; OpenTofu second-site guards | R32 (GitHub), R39 (0 acknowledged writes lost), restore drills | Two in-country sites; per-repository keys | First drill on real hosts needs a provider | **Approve with conditions** (§3.5) |
| 030 APISIX edge gateway | Gateway test configuration (routes and plugins) | R41: Keycloak tokens, rate limit, body limit, route allow-list, no admin API, headers | Maintained edge (ingress-nginx retired); admin API absent from data plane | Ingress Controller + etcd deployment and WAF (Coraza) still to prove on staging | **Approve with conditions** (§3.6) |

## 3. Conditions recommended

### 3.1 ADR-003: three database servers per production site, and a live second site for critical data

- **Production sites for regulated tenants:** 3 database servers. A failover with one standby down stays automatic and loses nothing (R24). With 2 servers, a manual decision is needed in that window, and it costs data (R2-10).
- **Critical regulated data** (doc 15 §15.4.1): add a 2-server standby cluster at the second site. A site loss then costs no acknowledged write in the rehearsal (R39), instead of the last ~16 s (R32).
- **Cost:** +1 server per main site; +2 servers at the second site where the critical tier is sold.

### 3.2 ADR-008: Valkey instead of Redis

Redis 7.4 and later is not open source (RSALv2/SSPL; Redis 8 adds AGPLv3). Valkey 9.1 (BSD) is protocol-compatible and is what the chart and tests use. Approving ADR-008 with this condition confirms Valkey.

### 3.3 ADR-012: HSM when available; Shamir until then

No Tunisian candidate publicly offers an HSM (doc 20). Until one does, OpenBao is unsealed with Shamir shares (3 of 5) held by named people. Revisit when the provider is chosen.

### 3.4 ADR-027: the proposed revision (release key verified at admission)

Approve the revision: images signed with the CIVORA release key, held in OpenBao (not exportable) and checked by every cell.

The key ceremony needs the founder and a second person ([runbook](../runbooks/release-key-ceremony.md)). Until it happens, CI keeps signing keyless.

### 3.5 ADR-029: recovery objectives by data class

Adopt the objectives in doc 15 §15.4.1:
- **critical regulated:** site loss RPO ≤ 5 s, RTO ≤ 30 min;
- **standard:** ≤ 15 min / ≤ 4 h.

**RPO 0 across sites is not recommended for the MVP:** each commit would wait for the inter-site link, and writes would stop whenever the link fails.

### 3.6 ADR-030: pinned version and staging proof

- Pin APISIX 3.19.0 now. 3.20 and 3.21 are younger than the two-week rule; move up once they qualify.
- Before the pilot, prove two things on staging:
  - the Ingress Controller with its 3-member etcd;
  - the WAF (OWASP Core Rule Set via Coraza).

## 4. What approval changes (and what it does not)

- Approval updates each ADR's status line, the index and the decision form. Only the founder's recorded answers do that; I will not.
- Approval does **not** start Phase 3. It satisfies acceptance criterion O-AC2. O-AC1 (staging from IaC in under 2 h) still needs a provider, and O-AC3 (external threat-model review) an adviser.
