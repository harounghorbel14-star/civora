# 18. Shared Platform Requirements

**Purpose:** state *what* the shared platform must provide, *for which product*, and *when*. It does not say *how*: Phase 2 (Technical Architecture) defines the architecture, after Phase 1 approval.

**Directive §9:** "Do not design unnecessary complexity before the first product is validated."

Each capability is classified as:
- **MVP-required:** needed by Workspace RF in Phases 3–6.
- **MVP-minimal:** a simple version now, designed to extend later.
- **Deferred:** a future requirement, built in its roadmap phase.

## 18.1 Capability register

| # | Capability | First product needs | Later consumers | Classification | Minimum requirement now | Deliberately deferred | Roadmap phase |
|---|---|---|---|---|---|---|---|
| 1 | **Authentication** | Staff SSO (SAML/OIDC), MFA, local accounts fallback; customer OTP access to status page | Citizen accounts, passkeys, national eID brokering (Government), relying parties (Identity) | MVP-required | SSO + MFA + OTP; session management; account lifecycle | National eID brokering; passkeys for citizens; wallet auth | 3 (Gov parts 3/12) |
| 2 | **Authorisation** | Roles + data scoping (branch, team, category, escalation) | ABAC with purpose binding, mandates, T0 health policies | MVP-minimal | RBAC + scoped queries + policy tests | Policy engine with purpose binding; mandates | 3, 6 |
| 3 | **Tenant management** | One institution = one tenant; isolation; per-tenant config | Government institutions; multi-institution deployments | MVP-required | Tenant isolation, per-tenant keys, configuration, export/exit | Tenant hierarchies (ministry → offices) | 3 |
| 4 | **Country configuration** | Tunisia pack: languages, holidays, numerals, hosting profile | All countries (Phase 15) | MVP-minimal | Config bundle for TN; no hard-coded country logic | Additional packs; per-country legal policy sets | 2–3 (design), 15 |
| 5 | **Identity & trust services** | Customer contact verification via OTP | Mandates, e-signature (TunTrust), verifiable credentials, e-KYC partners | Deferred (beyond OTP) | OTP verification | Mandates, e-signature, credentials, e-KYC | 3, 4, 12 |
| 6 | **Notifications** | SMS, email, templates AR/FR, delivery tracking | Push, WhatsApp Business (if approved), citizen preferences | MVP-required | SMS + email providers (TN), templates, retries, delivery status | Push, omnichannel preferences | 3–6 |
| 7 | **Document management** | Attachments, malware scan, generated letters (PDF), immutable issued copies, retention | Credentials, wallet, health documents | MVP-required | Object storage (TN), checksums, retention/legal hold | Credential issuance; e-signature | 4 |
| 8 | **Workflow / case engine** | Configurable states, SLA timers, escalations, sub-tasks, decisions, templates | Government case types (20 sectors), insurance/telecom editions | MVP-required (**core**) | Config-driven state machine per case type; SLA calendars; event history | Visual workflow designer; cross-tenant case routing | 6 |
| 9 | **Taxonomy / catalogue** | Complaint categories & subcategories, versioned | Government Directory (20 sectors) | MVP-minimal | Versioned taxonomy with AR/FR labels | Full Directory content model and editorial workflow | 5 |
| 10 | **API management** | Public REST API + webhooks (Should); API keys; rate limits | Partner APIs, Connect products | MVP-minimal | Documented API, keys, rate limiting, webhook signing | Developer portal, API products/billing | 6, 12 |
| 11 | **Audit logging** | Tamper-evident log of views and changes; auditor export | All products | MVP-required | Append-only, hash-chained, exportable | Citizen-facing access log (Government) | 3–6 |
| 12 | **Consent management** | Not needed for B2B case handling (lawful basis: legal obligation / contract) [A — counsel] | Citizen and health products | Deferred | — | Consent receipts, revocation | 3+ (Gov), 7 |
| 13 | **AI orchestration** | None in MVP | Document processing, Guide, triage | Deferred | — | Model gateway with location policy (Phase 0 D10) | 10 |
| 14 | **Integration infrastructure** | Email in/out, SMS gateway, SSO; optional core-banking read adapter | National interoperability (via member), PSPs, eID, e-KYC partners | MVP-minimal | Adapter interface with simulated/sandbox/production modes; integration register classes 1–6 | UXP adapters, payment orchestration | 12 |
| 15 | **Monitoring & observability** | Metrics, logs, traces without personal data; alerting; status page | All | MVP-required | In-country observability; on-call | SIEM integration at scale | 2, 11 |
| 16 | **Security policies** | Encryption, key management, secrets, secure SDLC, backups/DR | All | MVP-required | Per-tenant keys; vault; backups with restore tests; pen test | HSM-based signing (needed with e-signature/credentials) | 2, 11 |
| 17 | **Reporting & analytics** | Dashboards, annual report generator, exports | Government dashboards | MVP-required | Per-tenant reporting; no cross-tenant analytics | Aggregated anonymised benchmarking (only with explicit customer opt-in, never sold) | 6 |
| 18 | **Billing (CIVORA's own)** | Subscription invoicing for customers | All | Outside product (accounting tool) | — | In-product metering if usage pricing grows | 8 (design only) |

## 18.2 Data-domain separation (directive §11)

| Domain | Examples | Policy |
|---|---|---|
| **Financial customer data** (first product) | Complaint content, account references, amounts | Tenant-isolated; institution is controller; field-level encryption for identifiers; no cross-tenant use |
| **Government data** | Citizen requests, civil status | Separate tenants and cells per institution; hosting per Circular 5/2026; Government access policies |
| **Identity data** | Credentials, signatures, verification results | Separate store and keys; no biometric templates (Phase 0 §11.3) |
| **Health data** | Clinical data (future) | Separate deployable, cluster and keys; T0 controls; MoH/INPDP authorisation before real data |

## 18.3 Non-goals for the platform at this stage

- No microservices split before the triggers in Phase 0 §8.11.
- No multi-country runtime before Phase 15. The Tunisia pack is designed to be replaceable.
- No generic low-code builder. Configuration covers states, SLAs, forms, templates and categories only.
- No AI components before Phase 10.

## 18.4 Inputs handed to Phase 2 (after approval)

> Annotated 19 Nov 2026: these inputs were handed to Phase 2 when the founder started it (P2-D0), before Phase 1 approval. They are consumed in [../phase-2/00-specification-and-constraint-audit.md](../phase-2/00-specification-and-constraint-audit.md) §3 and [../phase-2/02-business-divisions-and-capability-map.md](../phase-2/02-business-divisions-and-capability-map.md).

1. The capability register above (scope and timing).
2. NFRs from the PRD ([12](12-product-requirements-document.md) §12.7).
3. Data-domain separation (§18.2).
4. Phase 0 architecture proposals (Phase 0 §8–§10), to be revalidated against the first product.
