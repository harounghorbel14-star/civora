# 4. Business Division Strategy

## 4.1 Summary

| Division | Mission | Primary customers | Stance (next 24 months) | Why |
|---|---|---|---|---|
| **A — Government** | Help public institutions deliver complete, trackable, accessible services | Ministries, agencies, social funds, municipalities, consulates; foreign governments (L3) | **Active pipeline** | Core long-term mission and largest contracts. But B2G cycles are 6–24 months and the state builds front doors itself (Phase 0 §3.3). Revenue arrives after Phase 13 |
| **B — Enterprise** | Give regulated companies compliant, auditable workflows | Banks, financial institutions, payment providers, microfinance; later insurers, telcos, utilities | **Active — first revenue** | Highest-scoring opportunity; verified regulatory pull (BCT 2022-08); same engine as Government |
| **C — Health** | Consent-based, interoperable healthcare workflows | Private clinics, telemedicine operators; later health authorities | **Defer** (Phase 7 synthetic prototype only) | Highest legal barriers (INPDP, MoH authorisation, telemedicine hosting); national programme under way |
| **D — Identity** | Trusted identity, signatures and verification services | Embedded in A/B products; later relying parties | **Incubate / partner** | Needed by every product (auth, mandates, e-signature). Standalone e-KYC is contested locally [P][S135][S136] and globally cheap [P][S137] |
| **E — AI** | Multilingual AI that explains, classifies and extracts, never decides rights | Back offices across divisions | **Incubate** (Phase 10) | Document processing scored #2; assistants crowded. Must follow roadmap order |
| **F — Connect** | Secure integration with national and enterprise systems | Internal first; later integrators and institutions | **Internal capability** | Interoperability backbone is national (UXP); value lies in adapters for our own products |

## 4.2 Division profiles

### A — CIVORA Government

- **Products:**
  - Workspace for public institutions
  - Government Services Directory (20 sectors, [05](05-government-master-service-catalog.md))
  - citizen request tracking and portals (white-label)
  - government communication (complaints, notifications, correspondence)
  - later the AI Guide (Phase 10)
  - public-sector dashboards
- **Tunisia entry:** institutions' back offices and service lines, via donor programmes and Phase 13 pilots (Phase 0 §14.6). Sector 20 (Government Communication: complaints, application tracking) is the natural bridge from the first product.
- **International:** country packs for Maghreb and Francophone/Arabic markets (Phase 0 §13).
- **Key risks:**
  - the state builds in-house (R1)
  - procurement delays (R2)
- **KPIs:**
  - signed pilots
  - processing-time reduction
  - SLA adherence
  - first-time-right rate

### B — CIVORA Enterprise

- **Products:**
  - **Workspace — Regulated Finance** (complaints, customer requests, mediator and regulator liaison, board reporting)
  - next: editions for insurance (claims and complaints), telecom and utilities (customer complaints)
  - later: approvals, compliance case management (e.g. KYC remediation queues) and document management for regulated firms
- **Explicitly not:** general ERP/HR/CRM. That market is saturated by global and local suites, and CIVORA has no advantage there (score #9).
- **Tunisia entry:** payment providers and mid-size banks first, through founder-led sales and a design-partner programme ([19](19-commercial-and-pricing-strategy.md)).
- **International:** most banking supervisors require complaint handling. Arabic/French markets come first [A — verify per country].
- **KPIs:**
  - ARR
  - logos
  - share of complaints resolved within deadline
  - net revenue retention

### C — CIVORA Health

- **Products (future):**
  - consent and access bridge
  - clinic scheduling and patient administration
  - telemedicine platform tooling (with MoH authorisation)
  - FHIR interoperability
- **Gate to activate:**
  - (1) legal opinion on health processing (Phase 0 counsel Q1d/Q9)
  - (2) a clinic or telemedicine partner with an authorisation path
  - (3) platform identity and consent capabilities proven in production
- **Now:** Phase 7 runs as a synthetic-data prototype and design pass only.

### D — CIVORA Identity

- **Products:**
  - accounts and authentication
  - mandates (acting on behalf)
  - e-signature workflows with TunTrust certificates
  - verifiable credentials
  - e-KYC orchestration through partners
- **Strategy:** **build what every product needs, partner for the rest.**
  - Integrate local e-KYC providers (e.g. Avatar-ID, Kaoun/NGSIGN [P][S135][S136]) or global vendors into Workspace review flows, rather than compete on liveness and OCR.
  - Relying-party access to national Mobile ID is pursued only through formal authorisation (class 3 → 2).

### E — CIVORA AI

- **Products (future, Phase 10 onwards):**
  - Arabic/French document processing: classification, extraction, complaint triage
  - multilingual Guide on official content
  - enterprise knowledge assistants
- **Rules:**
  - no eligibility or rights decisions
  - citations required
  - in-country models for personal data (Phase 0 D10)
- **Evidence:** many local and regional players already offer chatbots, such as IyedeX's Derja assistant, Amen Bank's chatbot since 2020 and MAE's assistant [P][S143][S145][S146]. The RNE launched its own AI assistants in Nov 2026 [P][S127]. Differentiation must come from **document-heavy back-office workflows**, not chat.

### F — CIVORA Connect

- **Products:**
  - adapter framework (national interoperability via member security servers, payment providers, messaging, core-banking connectors)
  - API gateway
  - integration monitoring
- **Stance:**
  - internal until at least two divisions depend on it in production
  - never a competitor to the national UXP backbone (Phase 0 §4.3)

## 4.3 Division activation gate (all must be true)

| Gate | Evidence required |
|---|---|
| Demand | ≥ 5 discovery interviews with qualified buyers; ≥ 2 LOIs or paid design-partner agreements |
| Regulatory path | Written legal opinion; data-tier controls defined; authorisation path identified (or none needed) |
| Platform readiness | Required shared capabilities exist or are in the current phase plan |
| Ownership | Named division lead; budget approved by founder |
| Focus | Activation does not create a third concurrent build track |

## 4.4 Future divisions — screening

| Opportunity | Assessment | Decision |
|---|---|---|
| Financial technology (payments, lending) | Requires BCT licensing; CIVORA must not hold funds (Phase 0 §11.6) | **Do not enter**; serve fintechs as Workspace/Identity customers |
| Education technology | Credentials and enrolment workflows fit Identity and Government products | **Fold into D and A** |
| Legal technology | Court systems are state-run; legal information is low-revenue | **Explore later** (directory content only) |
| Logistics | No platform advantage | **No** |
| Smart cities | Municipal workflows and complaints fit Workspace | **Fold into A** |
| Energy & utilities | Customer complaints and service requests fit Workspace (sector 16) | **Fold into B** (edition) |
| Telecommunications | Complaints and KYC fit B and D | **Fold into B/D** |
| Insurance | Claims and complaints fit Workspace | **Fold into B** (first expansion edition) |
| Real estate | Land registries are state-run (sector 12) | **No** |
| Retail & commerce | Saturated SaaS market | **No** |

## 4.5 Crosswalk to Phase 0 business lines

| Phase 0 line | Phase 1 division(s) | Change |
|---|---|---|
| L1 — Trusted Digital Services (B2B e-KYC, e-signature) | D Identity (partner/incubate) + B Enterprise (first product) | First B2B revenue moves from e-KYC to Workspace for Regulated Finance |
| L2 — Public Service Delivery Platform (B2G) | A Government | Unchanged in substance; shares the Workspace engine |
| L3 — International country cells | All divisions | Unchanged |
