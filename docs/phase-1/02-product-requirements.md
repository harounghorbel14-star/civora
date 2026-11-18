# 2. Product Requirements — MVP

This is the build specification for Phases 3, 4, 5, 6 and 10a.

**Story format:** `ID — As a <role>, I want <capability>, so that <benefit>.`

**Acceptance criteria (AC)** are testable statements. They become automated tests where possible. Unless stated otherwise, every story inherits the **global requirements** in Section 2.13.

## 2.1 Epic GD — CIVORA Guide (AI procedures assistant)

| ID | Story |
|---|---|
| GD-01 | As a citizen, I want to ask a question in Arabic, Derja (Arabic script or Arabizi), French or English, so that I can use my natural language |
| GD-02 | As a citizen, I want every answer to show its official sources and "last verified" date, so that I can trust and check it |
| GD-03 | As a citizen, I want step-by-step guidance with documents, fees, offices and hours, so that I go to the office once |
| GD-04 | As a citizen, I want a link to the official service, so that I complete the procedure in the right place |
| GD-05 | As a citizen, I want the Guide to say clearly when it doesn't know, so that I'm not misled |
| GD-06 | As a citizen, I want to report a wrong answer, so that it gets corrected |
| GD-07 | As a content editor, I want to see low-confidence and reported answers, so that I can fix the corpus |
| GD-08 | As a product owner, I want a release gate based on a golden evaluation set, so that quality never regresses |

**Acceptance criteria:**
- **AC-GD-1:** The language of the answer matches the question's language variety. If the user writes Arabizi, the answer is in Derja using Arabic script, with key terms also shown in French where commonly used (e.g. *مضمون ولادة (extrait de naissance)*).
- **AC-GD-2:** 100% of factual sentences about a procedure are supported by a cited passage (automated citation check). Answers with any unsupported claim are blocked and replaced by a refusal.
- **AC-GD-3:** If retrieval confidence is below threshold, the Guide shows: "I'm not sure. Here is the official source / office contact." It never fabricates.
- **AC-GD-4:** The Guide never outputs an eligibility decision ("you are eligible / not eligible"), legal advice or medical advice. Red-team suite pass rate 100%.
- **AC-GD-5:** A visible notice "AI assistant — independent and unofficial — may make mistakes; check the official source" appears at conversation start and in the footer.
- **AC-GD-6:** If the user types a national ID number, phone number or email, it is redacted *before* any model call. The user sees "We removed personal details; you don't need them here."
- **AC-GD-7:** Golden-set gates: accuracy ≥ 95%, citation precision ≥ 95%, refusal correctness ≥ 90%. Each gate is reported per language.
- **AC-GD-8:** p95 time-to-first-token ≤ 2 s and full answer ≤ 6 s on a simulated 3G profile.
- **AC-GD-9:** Without an account, conversations are deleted after 30 days. Aggregate statistics contain no free text.

## 2.2 Epic CT — Services catalogue

| ID | Story |
|---|---|
| CT-01 | As a citizen, I want to browse and search services by life event and by institution, so that I find what applies to me |
| CT-02 | As a citizen, I want a service page with steps, required documents, fees, processing time, offices and sources, so that I'm prepared |
| CT-03 | As an editor, I want to create a new version of a service and submit it for review, so that changes are controlled |
| CT-04 | As a reviewer, I want to approve or reject a version with comments (four-eyes), so that errors don't go live |
| CT-05 | As a citizen, I want to report outdated information, so that the catalogue stays correct |

**Acceptance criteria:**
- **AC-CT-1:** A version cannot be published without at least one source reference, an effective date, and approval by a second person different from the author.
- **AC-CT-2:** Search tolerates Arabic orthographic variants (alef/hamza forms, ta marbuta/ha, ya/alef maqsura), diacritics and common French/Arabic synonyms (e.g. "CIN" ↔ "بطاقة التعريف").
- **AC-CT-3:** Each service page shows "Last verified: <date>". After 180 days without verification it shows a "may be outdated" warning [A — threshold to confirm].
- **AC-CT-4:** Public service pages are server-rendered. Page weight is < 150 KB excluding fonts, and LCP is < 2.5 s on a mid-range Android over 3G.

## 2.3 Epic ID — Accounts, authentication and identity

| ID | Story |
|---|---|
| ID-01 | As a citizen, I want to create an account with a passkey, so that I don't manage passwords |
| ID-02 | As a citizen without passkey support, I want an authenticator app (TOTP) or SMS fallback, so that I can still sign in |
| ID-03 | As a citizen, I want to link my national digital identity (simulated in MVP), so that I can access higher-assurance services |
| ID-04 | As a citizen, I want to see and revoke my active sessions and devices, so that I control access |
| ID-05 | As an officer, I must sign in with a hardware security key, so that staff accounts resist phishing |
| ID-06 | As a citizen who lost my device, I want a recovery path that re-verifies me, so that nobody can take over my account |

**Acceptance criteria:**
- **AC-ID-1:** Each service declares a required assurance level, and the platform enforces step-up (e.g. linking the simulated eID) before access.
- **AC-ID-2:** SMS OTP is rate-limited (≤ 5 per hour per number [A]). It is never offered as the *only* factor for actions at substantial assurance.
- **AC-ID-3:** Recovery never relies on knowledge questions or on support staff resetting credentials. It requires eID re-linking, a counter visit (assisted mode) or a verified backup passkey.
- **AC-ID-4:** The simulated eID adapter is visibly labelled "SIMULATED" in UI and logs, and cannot be enabled in a `prod` environment (configuration guard).

## 2.4 Epic MD — Mandates (acting on behalf of someone)

| ID | Story |
|---|---|
| MD-01 | As a parent, I want to act for my minor child within defined scopes, so that I can handle their procedures |
| MD-02 | As an elderly citizen, I want to authorise a relative for specific services and a limited time, so that they can help me |
| MD-03 | As a principal, I want to revoke a mandate at any time (app, counter or phone), so that I stay in control |
| MD-04 | As an agent, I want to switch clearly between "me" and "on behalf of X", so that I don't act in the wrong capacity |
| MD-05 | As a principal, I want every action by my agent to appear in my access log, so that nothing is hidden |

**Acceptance criteria:**
- **AC-MD-1:** A voluntary mandate requires explicit acceptance by both parties. It has scopes (service categories), a start date and an expiry of ≤ 12 months [A], and is renewable.
- **AC-MD-2:** A persistent banner shows "Acting on behalf of <name>" in the agent's UI whenever the mandate context is active. Switching requires an explicit action.
- **AC-MD-3:** The agent's effective permissions are the intersection of the agent's own role and the mandate scopes (policy tests).
- **AC-MD-4:** High-impact mandates (e.g. financial) for principals aged 70+ [A] require confirmation at a counter or by a call-back, as an anti-abuse protection.

## 2.5 Epic RQ — Requests and tracking (citizen side)

| ID | Story |
|---|---|
| RQ-01 | As a citizen, I want to start a request from a service page with a guided form, so that I submit complete information |
| RQ-02 | As a citizen, I want to upload documents with a checklist that shows what's missing, so that my file is complete |
| RQ-03 | As a citizen, I want a timeline of my request's status with the next expected step and date, so that I know what's happening |
| RQ-04 | As a citizen, I want to respond to a correction request, so that my file is not rejected |
| RQ-05 | As a citizen, I want to save a draft and return later, so that I can gather documents |

**Acceptance criteria:**
- **AC-RQ-1:** The form is generated from the service version's schema. Required documents are enforced before submission unless the service allows "submit and complete at counter".
- **AC-RQ-2:** Status changes made in Workspace appear in the citizen timeline within 60 seconds and trigger a notification per the user's channel preferences.
- **AC-RQ-3:** Each status has a plain-language explanation in AR/FR/EN and an expected next step.
- **AC-RQ-4:** Uploads accept PDF/JPEG/PNG up to 10 MB [A]. Files are malware-scanned, and a camera capture with edge detection is available on mobile.

## 2.6 Epic AP — Appointments

| ID | Story |
|---|---|
| AP-01 | As a citizen, I want to choose an office and an available slot, so that I don't queue |
| AP-02 | As a citizen, I want to reschedule or cancel, so that the slot goes to someone else |
| AP-03 | As a supervisor, I want to set capacity per office, service and time block, so that bookings match staffing |
| AP-04 | As a citizen, I want reminders before my appointment with the documents to bring, so that the visit succeeds |

**Acceptance criteria:**
- **AC-AP-1:** Double booking is impossible under concurrent requests (load test with 500 simultaneous bookings on one slot pool).
- **AC-AP-2:** Reminders are sent 48 h and 3 h before [A] and include the document checklist.
- **AC-AP-3:** Slots honour the office calendar (holidays, Ramadan hours via the country pack).

## 2.7 Epic WS — Workspace (officer back office)

| ID | Story |
|---|---|
| WS-01 | As an officer, I want a queue sorted by SLA due date with filters, so that I handle urgent cases first |
| WS-02 | As an officer, I want to see the file with a document checklist and pre-check flags, so that I verify quickly |
| WS-03 | As an officer, I want to approve, reject (with reason code) or request a correction, so that the outcome is clear and consistent |
| WS-04 | As a supervisor, I want to reassign cases and see backlog, throughput and SLA breaches, so that I manage the team |
| WS-05 | As an administrator, I want to configure case types (states, transitions, forms, SLAs) without code, so that new services launch fast |
| WS-06 | As an auditor, I want an immutable history of each case, so that decisions are accountable |

**Acceptance criteria:**
- **AC-WS-1:** An officer sees only cases of their tenant, office and assignment scope (ABAC tests, including IDOR attempts).
- **AC-WS-2:** Every transition records actor, timestamp, from/to state, reason code and comment. History cannot be edited.
- **AC-WS-3:** A new case type with ≤ 8 states can be configured and published by an administrator in < 1 hour using the configuration UI (usability test).
- **AC-WS-4:** The queue loads in < 1 s for 10,000 open cases per tenant (performance test).

## 2.8 Epic NT — Notifications

| ID | Story |
|---|---|
| NT-01 | As a citizen, I want to choose SMS, email or push and my language, so that I get messages I understand |
| NT-02 | As an institution, I want message templates per event and language with approval, so that communication is consistent and correct |

**Acceptance criteria:**
- **AC-NT-1:** No message contains sensitive content (diagnoses, ID numbers). It says "Your request X has an update" with a link.
- **AC-NT-2:** SMS contains no clickable links unless the sender ID is verified [A — confirm operator rules]. Every message says how to verify authenticity.
- **AC-NT-3:** Delivery status is tracked. Failures fall back to the next channel per preference.

## 2.9 Epic CN — Consent & Trust Center

| ID | Story |
|---|---|
| CN-01 | As a citizen, I want a list of my consents (purpose, data, recipient, expiry) and to revoke any, so that I control sharing |
| CN-02 | As a citizen, I want an access log of who accessed my data, when and for what purpose, so that I can detect misuse |
| CN-03 | As a citizen, I want to download my data and request corrections, so that my rights are respected |
| CN-04 | As an auditor, I want tamper-evident audit records, so that investigations are reliable |

**Acceptance criteria:**
- **AC-CN-1:** Revoking a consent takes ≤ 2 taps from the list and takes effect immediately for new accesses.
- **AC-CN-2:** Access-log entries show actor type (officer/agent/system), institution, purpose in plain language, data category and date/time.
- **AC-CN-3:** The daily audit-chain anchor verifies (automated job). Any break raises a P1 alert.
- **AC-CN-4:** A data export (JSON + human-readable PDF) is generated in ≤ 24 h [A].

## 2.10 Epic WL — Wallet (verifiable credentials, synthetic in MVP)

| ID | Story |
|---|---|
| WL-01 | As a citizen, I want to receive a credential from an issuer via QR or link, so that it's in my wallet |
| WL-02 | As a citizen, I want to present only the required attributes (selective disclosure), so that I share less |
| WL-03 | As a verifier, I want to scan and check validity and revocation, so that I trust the document |
| WL-04 | As a citizen, I want reminders before a document expires, with a link to the official renewal service, so that I renew on time |

**Acceptance criteria:**
- **AC-WL-1:** The verifier rejects tampered, expired and revoked credentials (100% of test vectors).
- **AC-WL-2:** Every synthetic credential displays "SYNTHETIC — FOR DEMONSTRATION" on the card and in the signed payload type.
- **AC-WL-3:** Presentation shows the user exactly which attributes are shared before confirmation.

## 2.11 Epic IN — Integration framework & simulators

| ID | Story |
|---|---|
| IN-01 | As an engineer, I want each external system behind an adapter interface with simulated/sandbox/production variants, so that we can build before access exists |
| IN-02 | As a platform operator, I want the integration register to control which adapters are enabled per environment, so that nothing unauthorised runs |

**Acceptance criteria:**
- **AC-IN-1:** Production adapters cannot be enabled unless the register entry is `AUTHORIZED` with an agreement reference (two-person approval).
- **AC-IN-2:** Simulators produce realistic latency and failure modes (timeouts, 5xx, partial data) for resilience testing.

## 2.12 Epic PL — Platform UX

| ID | Story |
|---|---|
| PL-01 | As any user, I want to switch language at any time without losing my place, so that I can use the language I'm comfortable with |
| PL-02 | As a screen-reader user, I want every function accessible, so that I can use the service independently |
| PL-03 | As any viewer of a non-production environment, I want a visible "synthetic data — not an official service" banner, so that no one is misled |

## 2.13 Global requirements (apply to every story)

| Area | Requirement |
|---|---|
| Languages | AR (MSA), FR, EN complete. Derja supported in Guide input/output. No hard-coded strings |
| Direction | Full RTL mirroring via CSS logical properties. Directional icons mirror. Numbers, phone numbers, IDs and codes render LTR inside RTL (bidi isolation) |
| Numerals | Western Arabic digits (0–9) by default for Tunisia (country-pack setting) |
| Accessibility | WCAG 2.2 AA: keyboard operable, visible focus, 44 px targets, labels, error identification, no reliance on colour, captions for media, reduced motion |
| Performance | Mobile-first budgets (Section 2.2 AC-CT-4); works on 2 GB RAM Android devices |
| Security | Section 10 of Phase 0 controls; object-level authorisation tests on every endpoint |
| Privacy | Data minimisation review for every new field (DPO sign-off for T0/T1) |
| Honesty | No UI element implies government endorsement. Unofficial and synthetic markings per environment |
| Observability | Every user-visible error has a correlation ID shown to the user ("Reference: …") for support |
