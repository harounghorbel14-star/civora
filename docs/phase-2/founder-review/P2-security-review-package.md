# Security review package — for the external adviser (O-AC3) and the founder

| | |
|---|---|
| Date | 20 Nov 2026 |
| Purpose | Everything an independent security adviser needs to review CIVORA's threat model and Phase 2 controls, and a clear split between what engineering has done or can do alone and what needs an external professional or the founder |
| Status | Internal tests listed below have run (results in [17](../17-technical-validation-strategy.md)). **The external review has not happened**: no adviser is engaged yet (Phase 1 action 10, E-07). Nothing here claims an external opinion |

## 1. What to send the adviser

| Item | Where |
|---|---|
| Threat model (STRIDE per element, 52 threats, abuse cases, residual risks, review questions) | [08-threat-model.md](../08-threat-model.md) (§8.8 lists the five questions) |
| Data-flow diagrams | [09-data-flow-diagrams.md](../09-data-flow-diagrams.md) |
| Security, identity, tenancy architecture | [07](../07-security-and-privacy-architecture.md), [06](../06-identity-and-access.md), [04](../04-multi-tenant-architecture.md) |
| Decisions under review | ADR-005, 006, 012, 013, 016, 027, 029, 030 ([register](P2-adr-final-review-register.md)) |
| Evidence of internal tests | §2 below, and [17](../17-technical-validation-strategy.md) §17.2 |
| Repository access | Read-only access to the GitHub repository for the review period (founder grants it) |
| Request text (FR) | Readiness report §7.2; Phase 1 [quote requests](../../phase-1/validation/quote-requests.md) (security auditors: add "threat-model review, 2–3 days") |

## 2. Internal security tests completed (Phase 2)

All ran successfully; "GitHub" means observed on GitHub runners.

| Area | Test | Result | Ref. |
|---|---|---|---|
| Dependencies | Trivy (fixable HIGH/CRITICAL), `pnpm audit --prod` | 21 → **0**; no high/critical | R13, R23 |
| Secrets | gitleaks, full history | No leaks | R15 |
| SBOM | CycloneDX | 878 components | R14 |
| IaC | Checkov (Kubernetes, Helm, Dockerfile, Terraform, Ansible, Actions) | Clean, or accepted with written reasons | R12, §17.4 |
| Kubernetes | Restricted Pod Security on a real API server, **warnings fail** (with negative controls) | All charts compliant; 3 upstream defaults fixed (OpenBao, Keycloak Operator, policy-controller) | R8, R31, R33 |
| Network | NetworkPolicy blocks other namespaces; Valkey refuses a pod outside its selector **even with the password** | Pass (GitHub) | R18, R40 |
| Supply chain | Only cell-registry images pinned by digest (10 cases); **only images signed with the release key** (unsigned and unknown refused); key in OpenBao, not exportable, signer token cannot rotate or export | Pass (GitHub) | R28, R36 |
| Identity | Realm conformance with 7 negative controls | **Found and fixed:** refresh tokens were not rotated | R42 |
| Edge | APISIX: Keycloak token required (no token, altered claims, foreign key → 401), rate limit 429, body limit 413, route allow-list, no admin API, no version banner, security headers | 13/13 | R41 |
| Data | RLS with a `NOBYPASSRLS` application account that owns nothing; migrator separate; data checksums; TLS `verify-full` to the database | Pass (GitHub) | R24, R25 |
| Backups | Repositories AES-256 encrypted, unreadable without the key (negative control); separate keys per site | Pass | R24, R32 |
| Privacy | Canaries in query, path, headers, cookies, bodies never reach logs or traces | **Found and fixed:** 404 echoed the URL | R21, R27 |
| Resilience | Application survives database failover (**found and fixed:** process exited); router never sends writes to a standby (**found and fixed** at start-up); DR with no acknowledged write lost | Pass (GitHub) | R26, R37, R39 |
| Residency | OpenTofu refuses a node outside the country, and unsafe second-site layouts | 4 negative cases refused | R10, R44 |

## 3. Findings: who can resolve them

### 3.1 Resolved internally during Phase 2 (each was a real defect, found by a test)

| Finding | Fix | Ref. |
|---|---|---|
| NetworkPolicy selector without `matchLabels` (rejected by the API) | Fixed; empty `from` guarded | R9 |
| 404 responses echoed the URL with its query string | Reason phrase only | R27 |
| Application crashed on the first database failover | Pool error handled; regression test | R26 |
| Pod Security warnings discarded, so "restricted" was not really checked | Warnings fail; controls added | R8 |
| CI steps could not fail (`script \| tee` without `pipefail`) | `shell: bash` everywhere | R29 |
| Router sent clients to a standby just after starting | `init-state down` | R37 |
| Refresh tokens not rotated (contrary to doc 06) | Realm fixed; check in CI | R42 |
| Sentinel could not fail over when name lookups of a vanished host were slow (TILT mode) | Cause established; on Kubernetes the chart fails over in 7 s (cluster DNS answers at once). A resolver bound in the chart reduces but does not remove the risk (its gated test failed and was removed). Residual: depends on healthy cluster DNS | R38, R40 |

### 3.2 Open, resolvable by engineering (no external party needed)

| Item | Phase | Threat |
|---|---|---|
| IDOR suite template, RLS presence test per table | Phase 3 (B6) | T-04 |
| Passkeys, step-up re-authentication, MFA for configuration | Phase 3 | T-01, T-02 |
| Application security alerts (export spikes, break-glass use) | Phase 3 (needs application metrics) | T-18 |
| WAF (OWASP CRS via Coraza in APISIX) proven on staging | Before pilot (needs staging) | T-35 |
| Planned site switchover rehearsal | Before pilot | — |

### 3.3 Needs an external professional

| Item | Who | Why it cannot be done internally |
|---|---|---|
| **Threat-model review** (O-AC3): the five questions in [08](../08-threat-model.md) §8.8 | Independent security adviser (ANCS-certified preferred) | The acceptance criterion itself requires an external reviewer |
| Penetration test of staging (web, API, Kubernetes, edge) | Pen-test firm | Needs staging (provider) and independence |
| Banking secrecy: RLS + Cedar + per-tenant keys, or dedicated database by default for banks? | Adviser and counsel; BCT expectations | Regulatory interpretation |
| Break-glass design acceptable to a BCT inspection | Adviser and counsel | Same |
| ANCS audit (mandatory audit regime) and N-Cloud host contract terms | ANCS-certified auditor; counsel | Legal and certification |
| Data protection (INPDP authorisation status, transfer rules) | Counsel | Legal |

### 3.4 Needs the founder

| Item | Threat |
|---|---|
| Apply GitHub branch protection and Actions settings (P2-D5) | T-52 |
| Second reviewer, or a recorded waiver until a second engineer exists | T-30 |
| Release-key ceremony with a second person; Shamir share holders | T-26 |
| Hosting provider (E-07), which unblocks staging, the pen test and the WAF proof | T-35 |
| Engage the adviser and send this package | O-AC3 |

## 4. Threat-register changes since version 1.0 (to apply after the adviser's review)

| Threat | Change | Evidence |
|---|---|---|
| T-26 Key custody | Mechanics built and tested (non-exportable key, signer-only policy); custody still pending the ceremony | R36, runbook |
| T-35 DoS at the edge | Gateway rate and body limits tested; volumetric DDoS still depends on the provider | R41, doc 20 |
| Database availability and site loss | Live second site: no acknowledged write lost on site loss in the rehearsal | R39 |
