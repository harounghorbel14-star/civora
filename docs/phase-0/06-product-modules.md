# 6. Complete Product Modules

Each module below is assessed for **what CIVORA should build, integrate, or refuse to build**, given Tunisia's reality and international reuse.

- **Data tiers** (defined in Section 10):
  - **T0** special category (health, biometrics)
  - **T1** high (identity, national identifiers, civil status, financial, social security)
  - **T2** moderate (case data, appointments, contact details)
  - **T3** public (procedures, catalogue)
- **Feasibility:** ●●● feasible now (independent of government) · ●●○ feasible with a commercial or partner agreement · ●○○ requires government authorisation / mandate · ○○○ not feasible or should not be pursued.

## Summary

| Module | CIVORA role | Tunisia feasibility | International reuse | MVP? |
|---|---|---|---|---|
| A. Digital Identity | **Relying party + broker + delegation**, never issuer | ●○○ for national eID integration; ●●● for own accounts and passkeys | High (federate with any national eID) | Partial (simulated eID) |
| B. Civil Registry | **Front-end workflows** for authorised registries | ●○○ | Medium | Workflow demo only |
| C. Digital Healthcare | **Consent, access and scheduling bridge** for authorised providers | ●○○ | Medium–high | No (Phase 7 prototype, synthetic) |
| D. Document Wallet | **Verifiable-credential holder + verifier** | ●●○ (private issuers) / ●○○ (state documents) | High (W3C VC, ISO mDL, EUDI-compatible) | Yes (synthetic) |
| E. Financial & Tax | **Payment orchestration via licensed PSPs** | ●●○ | High | Simulated |
| F. Social Security | **Status tracking & notifications** for authorised funds | ●○○ | Medium | Catalogue/Guide only |
| G. Education | **Verifiable diplomas**, enrolment workflows | ●●○ (private institutions) | High | No (Phase 9) |
| H. Vehicles & Transport | **Reminders and Guide**; integration only if mandated | ●○○ | Low–medium | Guide only |
| I. Citizen Command Center | **White-label dashboard**; not CIVORA-branded in Tunisia | ●○○ in Tunisia (Khadamet exists) | High | Prototype |
| J. AI Assistant | **CIVORA Guide**: public-source RAG assistant | ●●● | High | **Yes — lead module** |
| K. Institution Workspace *(new)* | **Case management, appointments, SLAs** | ●●○ | High | **Yes** |
| L. Consent & Trust Center *(new)* | **Consent receipts, access logs, audit** | ●●● | High | **Yes** |

## Module A — Universal Digital Identity

**Brief asked for:** a digital citizen identity, verification, MFA, wallet, e-signatures, identity APIs, recovery, family profiles and birth registration.

**Reality check:**
- Legal identity belongs to the state: CIN, IUC, Mobile ID [P][S1][S6].
- A biometric CIN is legislated but not yet deployed [P][S12][S13].
- No public relying-party API for Mobile ID was found [U].

**CIVORA builds:**
- **CIVORA account** (a service account, *not* a legal identity):
  - Passkeys (WebAuthn/FIDO2) first, TOTP second, SMS OTP only as fallback, because of SIM-swap risk.
  - Device binding and session management.
  - Recovery that requires re-proofing, never a support-desk reset.
- **Identity broker (OIDC)** that federates to national eIDs per country through adapters:
  - Mobile ID (TN) — `AUTHORIZATION REQUIRED`
  - Nafath (SA) and UAE Pass
  - EUDI wallets (EU, via OpenID4VP)
  - Singpass, MOSIP-based IDs (e.g. Morocco, Ethiopia, Philippines)
- **Assurance levels** mapped to NIST SP 800-63-4 / eIDAS LoA. Step-up authentication for sensitive actions.
- **Delegation & mandates:** "family and dependent profiles" re-designed as *legal mandates*:
  - Parent → minor.
  - Guardian → protected adult.
  - Caregiver → elderly person with explicit, time-bound, revocable consent.
  - Every action is logged as "performed by X on behalf of Y".
- **Identity-verification orchestration (L1 / CIVORA Trust):**
  - Document capture and OCR (CIN, passport).
  - Liveness via a licensed vendor.
  - Sanctions/PEP screening via provider.
  - Signed KYC dossier for banks under BCT Circular 2025-06 [P][S51].
  - Hosted in Tunisia.
- **E-signature workflows** using TunTrust certificates where the law recognises them (not for acts requiring authentic/notarised form) [P][S37].

**CIVORA does not build:**
- A national ID, a population register or biometric enrolment.
- Birth registration as such. The PNDN and the civil registry own it [P][S70]. CIVORA may build *notification and next-step* journeys around it.

**Data tier:** T1 (identity attributes), T0 if biometrics are processed by a vendor. Prefer a vendor model in which **CIVORA never stores biometric templates**.

## Module B — Civil Registry

**Reality:**
- *Madania* + IUC under the Ministry of Interior [P][S5].
- Online birth extract via e-Bawaba with QR code and legal value [P][S15].
- Remote translation requests since Aug 2026 [P][S16].

**CIVORA builds (as a supplier to authorised registries or for other countries):**
- Request intake for certificates (birth, marriage, death, family record), with required-document checklists from the Guide.
- Appointment booking.
- Application tracking with status events.
- Officer back office (Module K).
- **Document verification** of QR-coded certificates. Verification uses the issuer's official verification endpoint only, if one is published [U].
- Country packs for civil-registration workflows that can interface with OpenCRVS-style systems abroad.

**CIVORA does not build:** the authoritative register or any copy of it.

**Data tier:** T1. **Feasibility in Tunisia:** ●○○ (MoI mandate required).

## Module C — Digital Healthcare

**Reality:**
- The MoH is deploying a national health ID, shared record, *Sahetna.tn* and PNDN, with generalisation targeted for end-2026 [P][S67]–[S71].
- Telemedicine requires MoH authorisation and INPDP agreement, plus hosting in Tunisia [P][S48].

**CIVORA builds (Phase 7 onward, synthetic data until authorised):**
- **Health Bridge:**
  - Consent-based, time-bound access grants (patient → provider).
  - Emergency "break-glass" access with mandatory justification and after-the-fact review.
  - Patient-visible access log.
- **Clinic-side scheduling and telemedicine session management** for *authorised* telemedicine platforms.
- **FHIR R4-based integration layer** (Patient, Encounter, Observation, MedicationRequest, AllergyIntolerance, Immunization, Coverage). Uses an established FHIR server rather than a custom schema (Section 9).
- **Emergency card:** a minimal, patient-controlled emergency dataset (allergies, blood group, emergency contact) shown only with patient opt-in.

**CIVORA does not build:**
- A national health record.
- Any analytics on health data for commercial purposes.
- Any feature that sells or shares health data.

**Data tier:** T0. Separate deployable, separate database and keys (Section 8). **Feasibility:** ●○○.

## Module D — Government Document Wallet

**Design choice:** a **verifiable-credential wallet**, not a "PDF vault".
- A document has digital legal value only if the **issuer** signs it.
- CIVORA's wallet holds issuer-signed credentials (W3C VC 2.0 / SD-JWT VC; ISO/IEC 18013-5 mDL for driving licences) and presents them with selective disclosure.

**Features:**
- Credential storage.
- Presentation via QR / OpenID4VP.
- Verifier app/API.
- Expiry reminders.
- Renewal deep-links to the official service.
- Application tracking.

**Tunisia:**
- State documents can only become credentials if the issuing authority signs them. ●○○
- Private issuers can issue credentials today: universities (diplomas), employers (attestations), banks (account certificates). ●●○

**International:** aligned with EUDI standards. CIVORA acts as **verifier/relying-party tooling** in the EU [V][S103].

**Data tier:** T1. Minimise by storing credentials **on the device** where possible, with encrypted backup.

## Module E — Financial and Tax Services

**CIVORA builds:**
- **Payment orchestration**: payment intents, receipts, reconciliation, refunds workflow.
- Connectors to licensed providers:
  - SMT/ClicToPay (cards)
  - La Poste e-Dinar/D17 (wallet, including unbanked users)
  - Licensed PSPs
  - USSD/operator channels where offered [P][S64][S72]
- Fines and fees display **only** from authoritative sources.
- Tax procedure guidance (Guide).
- Tax declarations only through authorised channels.

**CIVORA does not:**
- Hold funds, issue e-money, or act as a payment institution. Any of these would require BCT licensing [P][S53].
- Show debts or fines it cannot verify at source.

**Data tier:** T1. **Feasibility:** ●●○ (commercial PSP agreements), ●○○ for authoritative fine and tax data.

## Module F — Social Security

**CIVORA builds:**
- Read-only views of contributions, coverage and pension status **from fund APIs if authorised**.
- Reimbursement-status tracking and proactive notifications. This is the documented CNAM pain point [P][S62].
- Request workflows (attestations, claims).
- Pension-simulation links to official simulators [P][S65].

**Data tier:** T1. **Feasibility:** ●○○. Before authorisation, CIVORA delivers value through Guide content and as a back-office supplier to the funds.

## Module G — Education

**CIVORA builds:**
- **Verifiable diplomas and transcripts** issued by institutions. Private universities can adopt this now.
- An employer verification portal.
- Enrolment and scholarship application workflows (Module K).
- Exam-result display only from authorised sources.

**Data tier:** T1–T2 (minors require parental mandate). **Feasibility:** ●●○ for private institutions.

## Module H — Vehicles and Transport

**CIVORA builds:**
- Guide content.
- Expiry reminders (licence, registration, insurance, technical inspection) based on **user-entered or credential-sourced** dates.
- Payment deep-links.
- Fines and ownership data only via authorised integration.

**Data tier:** T1–T2. **Feasibility:** ●○○ for authoritative data. Low priority in Tunisia because Khadamet covers road services [P][S18].

## Module I — Citizen Command Center

**Reality:** in Tunisia, *Khadamet* + *e-Bawaba* are the state's unified front door [P][S14][S18].

**CIVORA builds:**
- A **white-label citizen app** (web + React Native) for L3 countries and for institutions that need their own portal. It includes:
  - Identity status
  - Documents
  - Requests
  - Appointments
  - Payments
  - Notifications
  - Expiry alerts
  - Announcements
  - Delegation
- In Tunisia it is positioned as a **demonstrator** and a **component supplier**, for example embeddable request-tracking or appointment widgets for Khadamet, if MinCom is interested. It is not a competing app.

**Data tier:** aggregates T1–T2 by reference.

## Module J — CIVORA AI Assistant ("CIVORA Guide")

**Lead module** because it uses public data, delivers immediate value, and demonstrates capability.

**Capabilities:**
- Explains procedures.
- Finds services.
- Lists required documents, fees, locations and opening hours.
- Explains official notices pasted by the user, with local redaction of personal data before processing.
- Translates official information.
- Guides step by step through official channels and deep-links to the real service.

**Languages:**
- Modern Standard Arabic
- Tunisian Derja in Arabic script and Arabizi (Latin script)
- French
- English
- The architecture is extensible.
- Evaluation must cover Derja specifically: public research shows LLMs remain uneven on Tunisian Arabic [V][S111]; TunBERT shows that dialect-specific resources help [V][S112].

**Rules:**
- Answers only from a curated, versioned corpus of official sources.
- Every answer shows source and "last verified" date.
- It refuses or escalates when unsure.
- It never gives legal advice or determines eligibility, and makes no binding decisions.
- No personal data is needed or stored in v1.
- It is labelled clearly as *independent and unofficial* until an institution adopts it.

**Architecture:** Section 8.6.

**Data tier:** T3 (v1). T2 if conversation history is retained, which is opt-in with short retention.

## Module K — Institution Workspace (recommended addition)

**Why:** the binding constraint in Tunisian e-government is the back office (Section 3.4). Governments buy back-office modernisation.

**Features:**
- Configurable case types per service.
- Intake forms.
- Document checklist verification.
- Assignment and queues.
- SLA timers and escalation.
- Internal notes.
- Appointment scheduling with capacity management.
- Citizen notifications (SMS, email, push, WhatsApp Business where approved).
- Dashboards and audit.
- Multi-office and multi-tenant.

**Data tier:** T1–T2. **Feasibility:** ●●○ (sold to institutions, deployed on their hosting).

## Module L — Consent & Trust Center (recommended addition)

**Features:**
- Consent receipts (purpose, data, recipient, duration, revocation).
- Citizen-visible access log, mirroring the transparency principle in Tunisia's IUC framework [P][S7].
- Tamper-evident audit trail.
- Data-subject request handling (access, rectification) per Law 2004-63 and the coming GDPR-aligned law [P][S34].
- Transparency reports for institutions.

**Data tier:** metadata about T0–T2 access (itself T1). **Feasibility:** ●●● (product), ●○○ (live government data).

## Language, accessibility and inclusion requirements (all modules)

- Full **RTL/LTR** mirroring.
- Arabic numerals and Eastern Arabic numerals as preference.
- Dates in Gregorian (Hijri display optional per country pack).
- **WCAG 2.2 AA**; screen-reader support in Arabic and French.
- Large-text mode; simple-language mode.
- Voice input and output for low-literacy users (later phase).
- **Assisted mode:** a counter agent or family member acts under mandate.
- Low-bandwidth mode and offline-tolerant mobile.
- Diaspora mode: time zones, consulate locations, foreign phone numbers.
