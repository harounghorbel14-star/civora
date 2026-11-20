# 11. Legal and Regulatory Analysis

> **Phase 1 note (18 Nov 2026), annotation only.** Several texts below were later read in official or official-copy versions: Law 2004-63, Law 2016-48, Decree-law 2023-17 and BCT Circulars 2022-08, 2025-06, 2026-10 and 2020-11. The article-level results, applicability and counsel questions are in [Phase 1 legal verification matrix](../phase-1/validation/legal-regulatory-verification-matrix.md) and [BCT verification](../phase-1/validation/bct-regulatory-verification.md).
>
> Two points in this section are refined there:
> 1. Law 2004-63 **Art. 52** makes INPDP authorisation mandatory for *every* transfer abroad; adequacy (Art. 51) is an additional condition.
> 2. **Art. 22** imposes nationality, residency and record conditions on processors and their agents.

> **This is not legal advice.** It is a structured issues map for Tunisian counsel. Labels: [V] verified text or official source; [P] press or secondary report; [A] assumption; [U] unknown.

## 11.1 Framework overview (Tunisia)

| Instrument | Subject | Relevance to CIVORA | Status |
|---|---|---|---|
| Constitution (2022) — privacy and personal data protection provision | Fundamental right | Frames all processing | [A] verify article and wording |
| **Organic Law 2004-63** (27 Jul 2004) | Personal data protection; INPDP | Declarations, authorisations (health data, transfers abroad), data-subject rights | In force [P][S33] |
| Draft organic law **095/2025** | GDPR-aligned replacement of 2004-63 | Expected to add DPO duties, breach notification, higher fines, AI/biometric rules | Pending in parliament [P][S34] |
| Council of Europe **Convention 108** | International data protection treaty | Tunisia is a party [A — verify accession date and 108+ status] | [A] |
| **Law 2000-83** (9 Aug 2000) | Electronic exchanges and e-commerce; electronic signature; ANCE | E-signature workflows; certificate use | In force [V][S36]. eIDAS-alignment reform discussed [P][S38] |
| Unique Citizen Identifier framework (2020 decree-law + implementing decree) | IUC register; 11-digit identifier; citizen may see which bodies used it | Do not process IUC without legal basis; design inspiration for access logs | [P][S6][S7] |
| **Organic Laws 22 & 23 of 2024** | Biometric national ID card and passport | Future authentication options; biometric data handling by MoI | Adopted 6 Mar 2024; rollout pending [P][S10][S12] |
| **Decree-law 2020-31**, Decree 2020-777, **Decree 2021-153** | Electronic data exchange between public bodies and with users | Lawful basis and procedures for G2G exchange via the national platform | [P][S9][S26] |
| **Decree-law 2023-17** (11 Mar 2023) | Cybersecurity; ANCS | Periodic security audits; incident handling; labels | In force since 11 Sep 2023 [P][S39] |
| Cloud First policy (2024) + arrêté on **G-Cloud / N-Cloud** labels (Apr 2024) | Public-sector cloud use and hosting labels | Sensitive public data in private cloud or with G-Cloud-labelled host | [P][S42][S43][S44] |
| **Circular 5/2026** (2 Sep 2026) | Security of public digital systems | Exclusive hosting of public sites/platforms at CNI, sectoral public centres or licensed telecom operators | [P][S46][S47] — obtain text |
| **Decree 2022-318** (8 Apr 2022) + arrêtés of 13 Jun 2024 | Telemedicine | MoH authorisation + INPDP; hosting in Tunisia; ≥10-year retention; consent for other physicians' access | [P][S48][S49] |
| **BCT Circular 2025-06** | Electronic customer enrolment (e-KYC) for banks | Defines L1 product requirements | [P][S51] |
| **BCT Circular 2026-10** (rectified 28 Sep 2026) | Payment institutions; remote account opening | L1 market; CIVORA must not hold funds | [P][S52][S53] |
| **Decree 2014-1039** + TUNEPS | Public procurement | Sales channel and rules for B2G | In force; replacement decree drafted (Nov 2025) [P][S54][S56] |
| PPP law (Law 2015-49, as amended) | Public–private partnerships | Possible model for operated platforms | [A] verify current text |
| **Law 2018-20 (Startup Act)** + Decree 2018-840 | Start-up label and incentives | Company formation benefits | In force [V][S58][P][S59] |
| **Decree-law 2022-54** | Cybercrime / information systems offences | Content and data-request exposure; criticised for broad provisions | In force [V][S50] |
| Medical secrecy (Penal Code; professional codes) | Confidentiality | Health module design | [A] verify articles |

## 11.2 Data protection — key analysis

**1. CIVORA's role.**
- In B2G/B2B deployments, the **institution is the controller** and CIVORA is a **processor** acting on documented instructions. Contracts must say so explicitly, with data processing agreements covering sub-processing, security, assistance with rights requests, return/deletion, and audit rights.
- CIVORA is a **controller** only for its own accounts (CIVORA Guide users with accounts, CIVORA staff, B2B customer contacts).

**2. Declarations and authorisations.**
- Under Law 2004-63, processing generally requires prior declaration to INPDP.
- **Sensitive data (health) and transfers abroad require prior authorisation** [P][S33].
- Counsel must confirm:
  - (a) whether processors file or controllers only
  - (b) the regime for public-sector controllers
  - (c) timelines

**3. Transfers abroad.**
- Any transfer of personal data outside Tunisia needs either an adequacy basis per INPDP's list or INPDP authorisation [P][S33].
- **Architectural consequence:**
  - no foreign SaaS in the personal-data path
  - no foreign LLM API with personal data
  - no foreign support access to production
  - dev/staging hold synthetic data only

**4. Health data.**
- Health processing is restricted, with an INPDP definition of health data (Decision No. 4 of 2018 referenced by DLA Piper [P][S33]).
- Requires INPDP authorisation and, for telemedicine, MoH authorisation [P][S48].

**5. Upcoming law.**
- Design now to GDPR-level standards: DPO, DPIA, breach notification, records of processing, privacy by design.
- The draft law 095/2025 is expected to require these [P][S34]. The same design serves EU expansion.

## 11.3 Identity, signatures, documents

- CIVORA **cannot issue legal identity** or create documents with official legal value. Only competent authorities can.
  - The online birth extract has legal value because an inter-ministerial arrêté (16 Aug 2022) says so and the state issues it [P][S15].
  - CIVORA may only *display, transmit or verify* such documents under authorisation.
- **E-signatures:**
  - Law 2000-83 recognises electronic signatures with certified certificates (ANCE/TunTrust).
  - Authentic or notarised acts are excluded [P][S37].
  - The CIVORA Trust product must map each use case to its legal effect and say so in the UI.
- **IUC:** CIN/IUC processing requires a legal basis. The IUC framework restricts uses [P][S6][S7]. CIVORA should avoid collecting IUC unless a client has an explicit legal basis.
- **Biometrics:** CIVORA should not create or store biometric templates. Vendor-based liveness with no retention is the target model. Confirm with counsel and INPDP.

## 11.4 Interoperability and access to government data

- Access to registries via UXP is governed by the data-exchange decrees [P][S9] and is granted to **public bodies**.
- **A private company has no standalone right of access.** CIVORA acts only as the technical provider of an authorised member institution, under that institution's agreements and logs.
- CIVORA must not "scrape" or automate access to government portals using citizens' credentials. That would breach terms of use, may breach cybercrime rules [V][S50], and destroys trust.

## 11.5 Cybersecurity and hosting

- **Audits:** any CIVORA deployment processing personal data at scale is likely in scope of the periodic audit obligation, reported as at least annual [P][S39].
- **Hosting:**
  - Public platforms → CNI, sectoral public centres or licensed telecom operators (Circular 5/2026) [P][S46].
  - Sensitive public data → private cloud or G-Cloud-labelled host (Cloud First) [P][S42].
  - G-Cloud requires connection to the national integrated government network and the interoperability platform [P][S43].
- **Consequence:** CIVORA must be **deployable on customer-designated infrastructure**. It cannot be offered to the Tunisian public sector as a CIVORA-hosted SaaS. B2B L1 can be CIVORA-hosted at a labelled Tunisian provider.

## 11.6 Payments and finance

- CIVORA must **not** hold or move client funds. Payment flows go through licensed banks, La Poste and payment institutions under contract. Holding funds would require BCT licensing [P][S53].
- **L1 e-KYC.** The bank remains responsible under BCT rules. CIVORA provides technology plus evidence. Circular 2026-10 requires periodic controls and audits of remote-identification technology [P][S52], so CIVORA must expect client audits.
- **FX regulations** affect foreign-currency revenue (L3) and paying foreign vendors (LLM APIs, liveness vendors). Counsel and an accountant must structure this. Startup Act provisions on foreign-currency accounts may help [P][S59].

## 11.7 Public procurement and partnerships

- Decree 2014-1039 governs tenders via TUNEPS [P][S54]. A replacement decree is in preparation [P][S56].
- A 2022 press report mentioned a **10% share of public procurement reserved for start-ups**. **This must be verified against the official text before it is used in any plan** [P][S57][U].
- Donor-financed projects may follow the **donor's procurement rules** (e.g. World Bank Procurement Regulations), as Decree 2014-1039 allows [P][S55]. This is a key entry path.
- **Integrity:**
  - zero tolerance for facilitation payments
  - anti-bribery policy
  - conflict-of-interest declarations for any hire coming from the public sector
  - donor sanctions regimes (e.g. World Bank debarment) apply to subcontractors

## 11.8 Claims, branding and official status

- CIVORA must never use state emblems or institutional logos, or names suggesting official status (e.g. ".gov.tn"-like domains, "national"/"officiel"), without written authorisation.
- Every prototype and demo carries "Independent prototype — not an official government service".
- The Guide must say it is unofficial until an institution adopts it, and must link to the official source.
- **Trademark:** clear "CIVORA" in Tunisia (INNORPI), the EU (EUIPO) and via WIPO Madrid **before** brand investment. A trademark search has not been performed [U].

## 11.9 AI-specific considerations

- Tunisia has a national AI strategy for 2026–2030 [P][S31] but no binding AI statute was identified [U].
- **Design to the EU AI Act** (Regulation (EU) 2024/1689) as the strictest reference:
  - **Chatbots** carry transparency obligations (users must know they are interacting with AI).
  - **AI used by public authorities to evaluate eligibility for public benefits is high-risk.** CIVORA Guide must therefore never assess eligibility. It explains published rules only.
- **Liability:** the Guide gives information, not advice.
  - Terms of use, clear disclaimers, citation of sources, a correction workflow, and professional liability insurance.
  - Contracts with institutions define who is responsible for content accuracy: the institution, for the official corpus.

## 11.10 Questions for Tunisian counsel (to commission in the first 30 days)

1. Under Law 2004-63, what declarations or authorisations must CIVORA (as processor) and its clients (as controllers) file for:
   - (a) the Guide with accounts
   - (b) Workspace case management
   - (c) B2B e-KYC
   - (d) consent-based health access
2. Is processing of anonymised queries by a foreign-hosted LLM API a "transfer of personal data"? What anonymisation standard does INPDP accept?
3. What is the current text and scope of Circular 5/2026? Does it apply to platforms operated by private suppliers on behalf of public bodies, and to non-public-facing back-office systems?
4. Is the G-Cloud label mandatory for CIVORA's own hosting provider when serving public clients? What about B2B regulated clients (banks)?
5. Can a private relying party (bank, clinic) lawfully use Mobile ID for authentication today? Through which agreement, and with which institution (MinCom, ANCE)?
6. What legal effect do TunTrust-certificate e-signatures have for:
   - (a) bank account contracts
   - (b) employment attestations
   - (c) university diplomas
   - What reform is planned for Law 2000-83?
7. Does BCT Circular 2025-06 permit fully remote onboarding with vendor-based liveness? What evidence and retention rules apply? Are outsourcing notifications to BCT required?
8. What is the procurement route for an innovative start-up product:
   - (a) the start-up procurement measure — does it exist, and under which text?
   - (b) direct agreements (*marchés négociés*) thresholds
   - (c) donor-procurement rules
   - (d) PPP
9. What are the medical-secrecy implications for a technical intermediary that never views clinical content (encrypted bridge)?
10. What is the optimal corporate structure: Tunisian SA/SARL with Startup Act label versus a foreign holding with a Tunisian subsidiary, considering FX rules, investor requirements and government-contract eligibility?
11. Do Decree-law 2022-54 obligations apply to CIVORA as a "service provider"? Covering:
    - data retention
    - cooperation with authorities
    - how to handle government data requests transparently and lawfully
12. Is the public-sector archives law relevant to case-record retention when CIVORA operates Workspace?

## 11.11 International frameworks (for L3 planning; detail in Section 13)

| Jurisdiction | Key instruments | Notes |
|---|---|---|
| EU | GDPR (EU) 2016/679; eIDAS 2.0 (EU) 2024/1183; NIS2 (EU) 2022/2555; AI Act (EU) 2024/1689 | EUDI wallets due end-2026 [V][S103]; public administrations are in scope of NIS2 in many Member States |
| Egypt | PDPL 151/2020 + executive regulations (2025) | Compliance deadline 1 Nov 2026 [P][S109] |
| Morocco | Law 09-08 (CNDP) | Reform not confirmed [P][S110] |
| Algeria | Law 18-07 (amended, reported 2025) | Verify text [P][S110] |
| Saudi Arabia | PDPL (SDAIA); data localisation; DGA licensing of digital-government operators | Revenue-sharing qualification of 16 firms (2026) [P][S91] |
| UAE | Federal PDPL (Decree-Law 45/2021); UAE Pass | [A] verify |
