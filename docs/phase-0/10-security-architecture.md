# 10. Security Architecture

Security is a product requirement and a release gate, not a phase. "Phase 11" in the roadmap is the *independent verification* milestone. The controls below apply from the first commit.

## 10.1 Data classification

| Tier | Examples | Minimum controls |
|---|---|---|
| **T0 — Special category** | Health data, biometric data, data about minors' health | Separate deployable + cluster + keys; MoH/INPDP authorisation before real data; break-glass with review; field-level encryption; no export; strongest monitoring |
| **T1 — High** | National identifiers, civil status, identity attributes, financial, social-security, KYC evidence, consent/audit records | Field-level encryption; blind indexes; ABAC; access logging visible to subject; MFA for all staff access |
| **T2 — Moderate** | Case metadata, appointments, contact details, notification history | Encryption at rest; RBAC + tenant RLS; logging |
| **T3 — Public** | Procedures, catalogue, Guide corpus | Integrity controls (signing, review workflow) |

## 10.2 Threat model (STRIDE summary; full model in Phase 2)

| Threat | Example | Primary controls |
|---|---|---|
| **Spoofing** | Account takeover via SIM swap; fake officer; impersonated relying party | Passkeys first; SMS only as fallback with risk scoring; officer accounts on hardware keys; mTLS + client certificates for B2B; anti-phishing (verified sender, no links in SMS where possible) |
| **Tampering** | Altered case decision; forged credential; modified procedure content | Signed status events; hash-chained audit; credentials signed by issuer keys in HSM; four-eyes review for Guide corpus changes |
| **Repudiation** | Officer denies an action; citizen disputes consent | Signed consent receipts; per-action audit with actor, purpose, legal basis |
| **Information disclosure** | Insider browsing; IDOR bugs; log leakage; prompt-injection data exfiltration | ABAC with purpose binding; RLS; object-level authorisation tests; no PII in logs; AI has no personal data access in v1; anomaly detection on access patterns |
| **Denial of service** | Peak traffic on deadlines; DDoS | Rate limiting, queue-based intake, autoscaling within cell capacity, upstream DDoS protection from host/telecom operator |
| **Elevation of privilege** | Compromised admin; CI/CD compromise | JIT privileged access with approval; separate admin network; pull-based deploys with signed images; no standing production DB access |

## 10.3 Identity and authentication

- **Assurance mapping** per NIST SP 800-63-4 IAL/AAL and eIDAS LoA (low/substantial/high). Every service declares its required level, and the platform enforces step-up.
- **Citizens:**
  - Passkeys (WebAuthn) by default.
  - TOTP as an alternative.
  - SMS OTP only as fallback, with velocity limits and SIM-swap risk signals where operators provide them [U].
  - National eID (Mobile ID etc.) via broker where authorised.
- **Recovery:** re-proofing at the original assurance level (eID, in-person counter, or KYC flow). **Never** knowledge questions or support-desk resets for T1/T0 services.
- **Officers and admins:** hardware security keys (FIDO2), device posture checks, session max 8h, re-auth for sensitive actions.
- **B2B clients:** OAuth2 client credentials with **mTLS**; per-client scopes and quotas; key rotation ≤ 12 months.
- **Session security:** short-lived access tokens, rotating refresh tokens bound to device, server-side revocation, CSRF protection, SameSite cookies.

## 10.4 Authorisation

- **RBAC** for coarse roles (citizen, agent under mandate, officer, supervisor, auditor, tenant admin, platform operator).
- **ABAC** (OPA/Cedar) for fine-grained decisions on:
  - tenant
  - office/jurisdiction
  - case assignment
  - **purpose of access**
  - legal basis
  - data tier
  - consent state
  - mandate scope
  - time window
- **Purpose binding:** every T0/T1 read declares a purpose code that is logged and shown to the citizen.
- **Mandates:** the agent's effective permissions are the intersection of their own role and the mandate scope.
- **Health break-glass:**
  - Explicit justification.
  - Restricted dataset (emergency summary).
  - Time-boxed.
  - Immediate notification to patient and supervisor.
  - Mandatory review within 72h [A].
- **Policy tests:** every policy bundle ships with unit tests. Policy changes require security review.

## 10.5 Cryptography and key management

- **In transit:** TLS 1.3 (TLS 1.2 minimum with strong suites for legacy partners); HSTS; mTLS service-to-service inside the cell.
- **At rest:**
  - Volume encryption.
  - Database TDE where available.
  - **Field-level AES-256-GCM** for T0/T1 columns with envelope encryption: data keys per tenant, wrapped by keys in OpenBao/Vault, rooted in an HSM.
- **Signing:** credential issuance, document seals and audit-chain anchors use HSM-held keys. Certificates come from TunTrust where national recognition is needed [V][S36].
- **Crypto-agility.** Algorithms are configurable per country pack, with a documented re-keying procedure. Estonia's ROCA incident shows why mass revocation and renewal must be designed in advance [V][S97].
- **Rotation:** data keys yearly or on incident; signing keys per policy; B2B secrets ≤ 12 months.

## 10.6 Privacy by design

- **Data minimisation checklist** for every feature: what data, why, lawful basis, retention, who sees it. Blocking review by the DPO for T0/T1.
- **Consent management:**
  - Granular, purpose-specific, revocable.
  - Signed receipts.
  - Consent is not used where another lawful basis applies (e.g. legal obligation of an institution), to avoid "forced consent".
- **Data subject rights:** access, rectification, objection, and deletion where applicable, via self-service + officer workflow, with response-time tracking.
- **DPIA** (privacy impact assessment) for every T0/T1 module before pilot. Shared with the client institution and, where required, INPDP.
- **Records of processing** generated from schema annotations (Section 9.10).
- **No dark patterns, no advertising, no data monetisation.** This is codified in the **Citizen Data Charter** (founder decision, Section 21).

## 10.7 Application and supply-chain security

- **Standard:** OWASP ASVS v5 Level 2 for all modules; Level 3 for identity, consent, health and trust APIs.
- **SDLC gates:**
  - threat modelling per epic
  - peer review (2 reviewers for T0/T1 code)
  - SAST
  - dependency scanning (SCA)
  - secret scanning
  - IaC scanning
  - container scanning
  - DAST on staging
  - SBOM per release
  - signed images
- **Security tests in CI:** authorisation tests per endpoint (IDOR suite), input validation fuzzing on public APIs, and prompt-injection test suites for the Guide.
- **Independent penetration test** before any pilot and at least annually. Additional tests after major changes.
- **Bug bounty / vulnerability disclosure policy** published from the first public demo, with a `security.txt`.

## 10.8 Fraud prevention

- Account opening and recovery:
  - device fingerprinting (privacy-preserving)
  - velocity limits
  - impossible-travel checks
  - disposable email/phone signals
- **Mandate abuse detection:** unusual agent-to-principal ratios; elderly-principal protections (cooling-off period, counter confirmation for high-impact mandates) [A].
- **Payment fraud:** handled primarily by licensed PSPs. CIVORA adds idempotency and reconciliation alerts.
- **Credential fraud:** status lists for revocation; verifier apps always check status online, with an offline grace policy per credential type.

## 10.9 Monitoring, detection, incident response

- Centralised in-cell security monitoring (SIEM, e.g. Wazuh/OpenSearch) with detection rules for:
  - mass access
  - off-hours T0 access
  - policy-denied bursts
  - admin actions
  - key usage anomalies
- **Incident response plan** with severity levels and roles (incident commander, comms, legal/DPO). Notification paths:
  - the client institution (contractual)
  - **ANCS** under Decree-law 2023-17 [P][S39]
  - INPDP where personal data is affected [A — confirm breach-notification duty under current law; the draft law adds explicit breach notification [P][S34]]
  - affected citizens where appropriate
- Tabletop exercises twice a year. Post-incident reviews are published (blameless) internally and summarised in transparency reports.

## 10.10 Compliance and certification roadmap

| Milestone | Target | Notes |
|---|---|---|
| ANCS-compliant security audit by approved auditor | Before first pilot with real data; then ≥ every 12 months | Decree-law 2023-17 [P][S39] |
| Hosting on G-Cloud/N-Cloud-labelled or CNI infrastructure | From first pilot | Cloud First policy; Circular 5/2026 [P][S42][S46] |
| ISO/IEC 27001 certification | Month ~18–24 | Prerequisite for many tenders and B2B |
| ISO/IEC 27701 (privacy) | Month ~24–30 | Supports GDPR-aligned law |
| ISO/IEC 27017/27018 | With 27001 if offering hosted service | Cloud controls |
| SOC 2 Type II | Only if a market requires it (L3) | — |
| Health hosting certification (e.g. France HDS) | Only on entering such a market | Market-specific |
| WCAG 2.2 AA audit | Before each public release | Accessibility is a security-adjacent trust issue |

## 10.11 Disaster recovery and business continuity

- Two in-country sites per production cell. RPO ≤ 15 min / RTO ≤ 4 h for pilot; production targets per SLA.
- Quarterly DR test (failover of one cell), with results documented.
- Degraded-mode operations: offices can continue on paper with later digitisation. Workspace supports "offline capture → sync".
- Continuity of key personnel: no single person holds sole production access or sole knowledge of key ceremonies (M-of-N HSM quorum).

## 10.12 Development data rules

- **Real citizen data is prohibited in dev and staging.** Synthetic data generators per country pack produce realistic names (Arabic/French), addresses and identifiers that are **format-valid but not issuable**, using reserved ranges.
- Production data never leaves its cell for debugging. Support uses in-cell tooling with audited, time-boxed access.
- Demo environments carry a visible "SYNTHETIC DATA — NOT AN OFFICIAL SERVICE" banner.
