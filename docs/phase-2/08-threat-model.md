# 8. Threat Model (STRIDE)

| | |
|---|---|
| Original deliverable | **O-D2** "full STRIDE threat model". Acceptance **O-AC3**: "threat model reviewed by an external security adviser" |
| Status | **Draft v1.0, 19 Nov 2026. NOT externally reviewed.** No adviser is engaged yet (founder action) |
| Builds on | Phase 0 §10.2 (STRIDE summary); DFDs in [09](09-data-flow-diagrams.md); controls in [06](06-identity-and-access.md), [07](07-security-and-privacy-architecture.md) |
| Method | STRIDE per element on DFD-0 to DFD-8, plus abuse cases for the first product. Score = **Likelihood (1–3) × Impact (1–3)**: 1–2 Low, 3–4 Medium, 6–9 High. Ratings are the author's judgement before external review |

## 8.1 Scope and assumptions

**In scope:**
- one country cell (TN) with its tenants;
- the global supply chain;
- the first product's flows (Workspace RF);
- the designed Government, health and AI flows (Phases 7, 10, 12).

**Out of scope:**
- physical security of the hosting provider (to be covered by the provider's label and the ANCS audit);
- the security of external systems themselves (IdPs, SMS gateways, UXP).

**Assumptions:**
- **A1.** The hosting provider is N-Cloud/G-Cloud labelled or CNI, and supplies DDoS protection upstream (D9; [13](13-cloud-and-deployment-architecture.md) §13.6).
- **A2.** Institutions run their own IdPs with MFA for staff.
- **A3.** No real personal data exists in any environment before Phase 13 and the legal gates.
- **A4.** At least two engineers exist before pilot (the review rule depends on it).

## 8.2 Assets

| Asset | Tier | Why it matters |
|---|---|---|
| Complaint content, complainant identity, account references | T1 | Banking secrecy (Law 2016-48 Art. 61); personal data (Law 2004-63) |
| Regulatory deadlines and their history | T2 | Regulatory compliance of the tenant (BCT 2022-08); evidence in disputes |
| Audit chain and break-glass records | T1 | Accountability (Law 2004-63 Art. 18–19); proof for the BCT and courts |
| Tenant data keys, HSM keys, cell secrets | — | Loss compromises every T1 field |
| Identity tokens and sessions | T2 | Account takeover |
| Rule packs and country packs | T3 (integrity-critical) | A tampered ceiling silently breaks compliance for every tenant |
| Signed images, CI pipeline, repository | — | Supply-chain compromise reaches every cell |
| Health records (Phase 7) | T0 | Special category |
| AI corpus and prompts (Phase 10) | T3 | Wrong official guidance; prompt injection |

## 8.3 Threat agents

| Agent | Capability | Motivation |
|---|---|---|
| External attacker | Internet access; commodity tools; credential stuffing | Data theft, fraud, extortion |
| Malicious or curious customer | Valid case reference; phone | Enumerate other cases; harass; fraud |
| Malicious insider at a tenant | Valid staff account | Hide complaints or deadline breaches; bulk export |
| Compromised or malicious CIVORA operator | Platform access, possibly break-glass | Data theft; cover-up |
| Other tenant | Valid account in the same cell | Competitor intelligence |
| Supply-chain attacker | Compromised dependency, action or image | Wide-scale access |
| Advanced actor | Targeted attacks; zero-days | Espionage on government or financial data |
| Prompt injector (Phase 10) | Crafted documents or questions | Data exfiltration through AI tools |

## 8.4 STRIDE per element (summary)

| Element | S | T | R | I | D | E |
|---|---|---|---|---|---|---|
| Ingress / WAF (P1) | ● | | | ● | ● | |
| Keycloak (P3) | ● | ● | ● | ● | ● | ● |
| civora-core (P4) | ● | ● | ● | ● | ● | ● |
| Status page + OTP (P6) | ● | | | ● | ● | |
| pg-core (D1) | | ● | | ● | ● | ● |
| Audit store (D2) | | ● | ● | ● | | |
| Object storage (D3) | | ● | | ● | ● | |
| Redis (D4) | ● | ● | | ● | ● | |
| OpenBao / HSM (P5) | ● | ● | ● | ● | ● | ● |
| Supply chain (P20–P23) | ● | ● | ● | | | ● |
| Observability (P30–P31) | | ● | | ● | ● | |
| Backups (DFD-6) | | ● | | ● | ● | |
| Adapters / TB9 | ● | ● | ● | ● | ● | |
| AI guide (TB8) | ● | ● | ● | ● | ● | ● |
| Health bridge (TB7) | ● | ● | ● | ● | ● | ● |

● = at least one threat in the register.

## 8.5 Threat register

Status of controls:
- **B** = built and tested in Phase 2;
- **C** = configured, awaiting first run on GitHub or a host;
- **D** = designed, built in the phase named.

| ID | Element | STRIDE | Threat | L | I | Score | Controls | Status | Residual |
|---|---|---|---|---|---|---|---|---|---|
| T-01 | P3 Keycloak / F1 | S | Credential stuffing against local accounts | 3 | 2 | 6 | SSO-first (no local passwords for tenant staff); brute-force protection and password policy (realm config); MFA by policy | B (realm) / D3 | Low |
| T-02 | F1–F2 | S | Phished staff session (AiTM) | 2 | 3 | 6 | FIDO2 for admins and break-glass (AAL3); short tokens; re-auth for sensitive actions | D3 | Medium |
| T-03 | F4 | S/E | Forged or replayed JWT; algorithm confusion | 1 | 3 | 3 | Signature + `aud`/`iss`/`exp` checks; fixed algorithm list; 5-min tokens; no tokens in URLs | D3 | Low |
| T-04 | P4 | E | **Cross-tenant access** (IDOR, missing tenant filter) | 2 | 3 | 6 | Tenant from token only; Cedar `forbid` cross-tenant (spike C04/C05/C15); RLS with `NOBYPASSRLS` role; per-tenant keys; IDOR suite | B (policy proof) / D3 | Low |
| T-05 | P4 | E | Handler escalates to supervisor actions or exports | 2 | 2 | 4 | Role + unit scoping in policy (C03, C08, C10, C16); server-side checks only | B (policy proof) / D6 | Low |
| T-06 | P4 | T | Tampering with a deadline to hide a breach (backdating acknowledgement, editing due date) | 2 | 3 | 6 | Due date computed by the server from the rule pack and frozen with the pack version; no API to edit it; every change is an event in the hash chain; supervisor-only suspension, if counsel allows (Q-07) | D6 | Low |
| T-07 | Rule packs | T | Tampered or wrong rule pack (e.g. ceiling 15 → 30) | 1 | 3 | 3 | SHA-256 manifest + schema validation; fail closed; digest shown on `/health`; two-person review incl. compliance; tenant overrides only *below* the ceiling | B (integrity) / D3 (review) | Low |
| T-08 | P4 | R | Staff deny actions on cases | 2 | 2 | 4 | Hash-chained audit with actor, purpose, time; daily signed anchor | D3 | Low |
| T-09 | D2 audit | T | Insider or operator deletes or alters audit events | 1 | 3 | 3 | Append-only DB role; separate cluster; hash chain; daily HSM-signed anchor off-cluster; WORM backups | D3 | Low |
| T-10 | P6 status page | I | **Enumeration of case references** | 3 | 2 | 6 | References are non-sequential; no existence oracle before the OTP; rate limits per IP and reference; generic messages | D6 | Low |
| T-11 | P6 / F13 | S | OTP brute force | 2 | 2 | 4 | 6-digit OTP, 5-min TTL, max 5 attempts, hashed in Redis | D3 | Low |
| T-12 | F13 | D | **SMS pumping / toll fraud** via the OTP endpoint | 3 | 2 | 6 | OTP only to the contact on file (never a user-supplied number); per-tenant SMS quotas; anomaly alerts | D3 | Low |
| T-13 | F13 | S | SIM swap leading to a takeover of the status view | 2 | 1 | 2 | Status page exposes T2 only; no actions with financial effect | D6 | Low |
| T-14 | P4 | I | Personal data leaks into logs or traces | 2 | 3 | 6 | Fixed-field logger; no body/header logging; collector allow-list + scrubber; scrubbing test | B (logger) / D3 (test) | Low |
| T-15 | P4 | I | Verbose errors reveal internals | 2 | 1 | 2 | RFC 9457 filter; no stacks; no input echo (e2e test) | B | Low |
| T-16 | P4 | T | Header injection via `X-Request-Id` | 2 | 1 | 2 | Strict pattern; replaced if invalid (e2e test) | B | Low |
| T-17 | P4 | I | Mediator or customer export includes internal notes | 2 | 3 | 6 | Export DTOs exclude notes by construction; test; audit of exports (FR-26) | D6 | Low |
| T-18 | P4 | I | Bulk export by a malicious tenant insider | 2 | 3 | 6 | Export permission separate from read; step-up MFA; volume alerts; audit visible to the tenant's security contact | D6 | Medium |
| T-19 | D1 pg-core | I | Database dump stolen (backup or disk) | 1 | 3 | 3 | Volume encryption; T1 field encryption with per-tenant keys in OpenBao/HSM; encrypted backups with separate keys | D3 | Low |
| T-20 | D1 | E | SQL injection | 1 | 3 | 3 | Parameterised queries only (review rule); least-privilege role; RLS limits blast radius; CodeQL | C / D3 | Low |
| T-21 | D3 object storage | I | Public bucket or guessable object URLs | 2 | 3 | 6 | Anonymous access refused (dev-cell smoke test); pre-signed URLs, short expiry, tenant prefix; object lock | B (dev) / D4 | Low |
| T-22 | D3 | T | Malicious upload (malware, polyglot) | 2 | 2 | 4 | Malware scan before attach; content-type sniffing; served with `Content-Disposition: attachment` | D4 | Low |
| T-23 | D4 Redis | S/I | Unauthenticated Redis access | 2 | 2 | 4 | Password required (smoke test); network policy; TLS in staging; no T0/T1 payloads | B (dev) / D3 | Low |
| T-24 | P5 OpenBao | E | Workload reads another tenant's key | 1 | 3 | 3 | Per-tenant transit keys; OpenBao policies by service identity; audit device | D3 | Low |
| T-25 | P5 | D | OpenBao sealed or unavailable → service outage | 2 | 2 | 4 | HA (Raft, 3 nodes); auto-unseal via HSM; cached wrapped DEKs with short TTL | D3 | Medium |
| T-26 | P5 | I | Unseal or root keys held by one person | 2 | 3 | 6 | M-of-N key shares; key ceremonies recorded; no single person with sole access (Phase 0 §10.11) | D (before pilot) | Medium |
| T-27 | P20–P21 | T/E | Compromised dependency or install script | 2 | 3 | 6 | Exact pins + lockfile integrity; install scripts blocked; `pnpm audit`; Trivy; Dependabot; review of new dependencies | B | Medium |
| T-28 | P21 | T | Compromised GitHub Action | 1 | 3 | 3 | Actions pinned to commit SHAs; read-only token by default; per-job permissions | C | Low |
| T-29 | P21 → D20 | T/S | Unsigned or substituted image deployed | 1 | 3 | 3 | Cosign keyless signature + provenance; deploy by digest (chart enforces outside dev); admission verification | C / D (before pilot) | Low |
| T-30 | P20 | E | A single developer merges malicious code | 2 | 3 | 6 | 2-reviewer rule + code owners + signed commits | C (needs 2 engineers) | **High until a 2nd engineer** |
| T-31 | P20 | I | Secret committed to Git | 2 | 2 | 4 | gitleaks on full history (no leaks found); `.env` ignored; `NAME_FILE` pattern | B | Low |
| T-32 | P22–P23 | E | Privileged pod or container escape | 1 | 3 | 3 | Restricted PSA (privileged pod rejected in test); non-root, read-only FS, no capabilities, seccomp | B | Low |
| T-33 | P23 | I/T | Lateral movement between pods | 2 | 2 | 4 | Default-deny NetworkPolicy; empty allow-list denies all; service-account tokens not mounted | B | Low |
| T-34 | TB5 | T | Malicious change to Argo CD project scope | 1 | 3 | 3 | AppProject restricted to one repo and namespace; no cluster-scoped resources except Namespace; PR review | B (validated) | Low |
| T-35 | P1 ingress | D | Volumetric DDoS around deadlines | 2 | 2 | 4 | Upstream DDoS protection (A1); rate limits; queue-based intake; HPA | D | Medium (depends on provider) |
| T-36 | P4 | D | Noisy tenant exhausts workers or DB | 2 | 2 | 4 | Per-tenant rate limits and fair queues; bounded pools | D3/D6 | Low |
| T-37 | P30–P31 | I | Observability exposes tenant metadata to unauthorised staff | 2 | 2 | 4 | Grafana requires login (smoke test); SSO + RBAC; no PD in signals | B (dev) / D3 | Low |
| T-38 | DFD-6 | T/D | Ransomware encrypts backups | 1 | 3 | 3 | WORM on repo 2; separate credentials; offline unseal shares; restore drills | D | Low |
| T-39 | DFD-6 | I | Backups stored abroad | 1 | 3 | 3 | Residency precondition in the cell module (tested); both sites in TN | B (guard) | Low |
| T-40 | TB9 adapters | S | Fake callback from a gateway or partner | 2 | 2 | 4 | mTLS or signatures; replay window; adapter contract tests | D3/D12 | Low |
| T-41 | TB9 | E | Production adapter enabled without authorisation | 1 | 3 | 3 | Locked flag `integrations.production-adapters` (tested: tenants cannot override); register gate (ADR-028) | B (flag) / D12 | Low |
| T-42 | Break-glass | E/R | Operator abuses break-glass | 1 | 3 | 3 | MFA + justification + read-only (spike C17–C21); tenant notified; 72 h review | B (policy proof) / D3 | Low |
| T-43 | Cell | I | Cross-border support access | 1 | 3 | 3 | Disabled by default; in-country staff; break-glass with customer approval (Phase 0 §8.4) | D | Low |
| T-44 | Synthetic data | I | Real personal data used in dev or CI | 2 | 3 | 6 | Reserved ranges; fitness check fails on real-looking CIN/+216; synthetic pack refused in pilot/prod; demo banner flag | B | Low |
| T-45 | TB8 AI | I/E | Prompt injection triggers tool calls that leak data | 2 | 3 | 6 | Agent principal + Cedar; read-only tools by default; human approval for writes; no DB credentials; injection test suites | D10 | Medium |
| T-46 | TB8 | I | Personal data sent to a foreign model | 2 | 3 | 6 | Redaction before the gateway; location policy from the pack; foreign routes absent from pilot packs | D10 | Low |
| T-47 | TB8 | T | Poisoned corpus gives wrong official guidance | 2 | 2 | 4 | Official sources only; provenance; four-eyes review; citation verification | D5/D10 | Low |
| T-48 | TB7 health | I | Core reads T0 data directly | 1 | 3 | 3 | Separate deployable, cluster, keys, network segment; no core credentials | D7 | Low |
| T-49 | TB7 | E | Break-glass on health data | 1 | 3 | 3 | Emergency summary only; patient and supervisor notified; review within 72 h | D7 | Low |
| T-50 | Global layer | I | Personal data flows to the global layer (telemetry) | 1 | 3 | 3 | Telemetry opt-in, anonymous; no outbound flows from cells except Argo CD pulls | D | Low |
| T-51 | Keycloak (P3) | E | Tenant admin creates a super-admin or alters another tenant's IdP | 1 | 3 | 3 | Organisation-scoped admin; platform realm separate; admin events audited | D3 | Low |
| T-52 | Repo protection | E | Branch protection not applied | 3 | 3 | **9** | Founder must apply settings (§7.7) | **Open (founder action)** | **High** |

## 8.6 Abuse cases for Workspace RF (first product)

| Abuse case | Threats | Key controls |
|---|---|---|
| A bank hides complaints to improve its annual statement | T-06, T-08, T-09 | Cases cannot be deleted, only closed with a reason; statements computed from the immutable event history; auditor role |
| A handler marks a complaint as an "information request" to escape the deadline | T-05, T-06 | Case-type change is an audited event and needs supervisor approval; statement counts reclassifications (FR-60) |
| A customer enumerates other customers' cases | T-10, T-11 | See T-10 |
| A competitor tenant probes another bank's data | T-04 | Isolation in depth ([04](04-multi-tenant-architecture.md) §4.3) |
| An attacker drives SMS cost | T-12 | See T-12 |
| A mediator export leaks internal investigation notes | T-17 | See T-17 |

## 8.7 Highest residual risks (input to the readiness report)

| Rank | ID | Risk | Needed |
|---|---|---|---|
| 1 | T-52 | Repository protection not applied | **Founder**: apply the GitHub settings |
| 2 | T-30 | Single-engineer merges (no second reviewer) | **Founder**: hire, or appoint an external reviewer; record a waiver until then |
| 3 | T-26 | Key custody concentrated in one person | M-of-N ceremony before pilot |
| 4 | T-02, T-18, T-45 | Phishing of staff; insider bulk export; prompt injection | Phase 3/6/10 controls as designed; test before pilot |
| 5 | T-35 | DDoS depends on the provider | Provider selection criterion (E-07) |

## 8.8 External review plan (O-AC3)

| Item | Detail |
|---|---|
| Reviewer profile | Independent adviser with application security and cloud/Kubernetes experience; ANCS certification preferred (the same firm may later do the ANCS audit) |
| Materials | This document, [09](09-data-flow-diagrams.md), [04](04-multi-tenant-architecture.md), [06](06-identity-and-access.md), [07](07-security-and-privacy-architecture.md), ADR-005/006/012/013/016/027, the repository |
| Questions for the reviewer | (1) Are any STRIDE categories missing for the elements in §8.4? (2) Are the likelihood/impact ratings reasonable for Tunisian banks? (3) Is RLS + Cedar + per-tenant keys sufficient for banking-secrecy expectations, or is dedicated-DB the right default for banks? (4) Is the break-glass design acceptable to a BCT inspection? (5) What is missing before a pilot with real data? |
| Output | Written findings with severity; each finding gets an owner and a target phase; this document version 1.1 |
| Request text | Can be added to the Phase 1 quote requests (security auditors, founder action 10) as a separate line item: "threat-model review, 2–3 days" |
