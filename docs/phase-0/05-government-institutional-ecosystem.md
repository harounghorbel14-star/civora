# 5. Government Institutional Ecosystem (Tunisia)

**Ground rule:** this section describes institutions from public information only. **No API or database is assumed to be available.** "Public API" means an API documented publicly for third-party use. None was found for any institution below **[U]**.

Every integration listed is a *potential* integration that requires a written agreement and the applicable INPDP formalities. The consolidated view is in the [Integration Feasibility Matrix](12-integration-feasibility-matrix.md).

## 5.1 Institution profiles

### Presidency of the Government (La Kasbah)
- **Responsibilities:** Steers administrative reform and the national digital transformation programme. The Directorate-General for Reforms runs *Dalil* [P][S27].
- **Existing digital services:** *Dalil*, the national procedures platform (~3,200 procedures inventoried) [P][S27]. Steering of 138 (2025–26) and 192 (2026–30) projects [P][S29][S30].
- **Public APIs:** None found [U].
- **Integration opportunities:** Official procedure content as the knowledge source for CIVORA Guide, subject to licence or permission.
- **Legal requirements:** Content reuse terms. Official status of the content.
- **Data protection:** Procedure content is not personal data.
- **Technical limitations:** Dalil launch not confirmed at research date [P].
- **Partnership opportunities:** Offer the AI assistant as a channel *for* Dalil (white-label); contribute to procedure simplification analytics. **High priority stakeholder.**

### Ministry of Communication Technologies (MinCom)
- **Responsibilities:** Digital economy policy, e-government platforms, Mobile ID, the Startup Act, Cloud First policy, supervision of ANCE and ANCS.
- **Existing digital services:**
  - Mobile ID / *e-Houwiya* [P][S1][S2]
  - *e-Bawaba* [P][S14]
  - *Khadamet* [P][S18]
  - Lead of the UXP interoperability platform [V][S22]
  - Startup Act programme [V][S58]
- **Public APIs:** No public relying-party API for Mobile ID found [U]. UXP membership is for public bodies [V][S22].
- **Integration opportunities:**
  - (a) Relying-party access to Mobile ID for authorised institutions, CIVORA's clients included.
  - (b) Supplying services or components to Khadamet.
  - (c) UXP adapters for member institutions.
- **Legal requirements:** Decree-law 2020-31 and implementing decrees on data exchange [P][S9]; Law 2000-83 (electronic signature) [V][S36].
- **Data protection:** Controller for Mobile ID. Access Now has called for more transparency on Mobile ID's data practices [V][S4].
- **Technical limitations:** Mobile ID adoption is modest (~450k phone-linked IDs, undated) [P][S5].
- **Partnership opportunities:** Startup Act label; innovation programmes; positioning CIVORA as a supplier to the national platforms. **Highest-priority stakeholder.**

### Centre National de l'Informatique (CNI)
- **Responsibilities:** State IT operator: government hosting, shared applications. Reported as the national interoperability operator [P][S5].
- **Existing digital services:** Hosting of public platforms. Exclusive host under Circular 5/2026, together with sectoral centres and licensed telecom operators [P][S46].
- **Public APIs:** N/A.
- **Integration opportunities:** Hosting of CIVORA deployments for public clients; UXP security server operation.
- **Legal requirements:** Hosting circular; ANCS rules.
- **Data protection:** Hosts controller data on behalf of institutions.
- **Technical limitations:** Capacity, procurement and technology-stack constraints [A — to verify in discovery].
- **Partnership opportunities:** CIVORA's platform must be **deployable at CNI** (containers, documented operations). CNI is both a potential partner and a potential competitor.

### ANCE / TunTrust (Agence Nationale de Certification Électronique)
- **Responsibilities:** National root certification authority under Law 2000-83. Issues electronic certificates [V][S36]. Infrastructure provider for Mobile ID [P][S5].
- **Existing digital services:** Electronic certificates for individuals and companies; signature services [P].
- **Public APIs:** Commercial products exist. API catalogue to verify [U].
- **Integration opportunities:** Qualified-equivalent e-signature in CIVORA Trust workflows: B2B contracts, B2G document issuance seals.
- **Legal requirements:** Law 2000-83. Exclusions for documents requiring authentic or notarised form [P][S37]. A possible reform toward eIDAS-style qualified levels is under discussion [P][S38].
- **Data protection:** Certificate data processing.
- **Technical limitations:** Integration specifications to obtain.
- **Partnership opportunities:** **Early commercial partnership (L1).** Probably the most accessible institutional partner.

### ANCS (Agence Nationale de la Cybersécurité)
- **Responsibilities:** Cybersecurity regulator under Decree-law 2023-17, in force since 11 Sep 2023 [P][S39]:
  - Supervises the security of public and private information systems.
  - Mandatory periodic security audits, reported as at least every 12 months for in-scope bodies [P][S39].
  - Awards N-Cloud / G-Cloud hosting labels [P][S43][S44].
  - Hosts the national CERT function.
- **Existing digital services:** National audit programme [P][S41]; labelling scheme.
- **Public APIs:** N/A.
- **Integration opportunities:** None technical. This is a **compliance relationship.**
- **Legal requirements:** Audit obligations; incident reporting; hosting labels. Fines up to 100k TND reported in the press [P][S40].
- **Data protection:** —
- **Technical limitations:** —
- **Partnership opportunities:** Early informal consultation on CIVORA's security architecture; certified auditors for pre-pilot audit.

### INPDP (Instance Nationale de Protection des Données Personnelles)
- **Responsibilities:** Data protection authority under Organic Law 2004-63 (operational since 2009) [P][S33]:
  - Declarations.
  - Authorisations for sensitive data (incl. health) and cross-border transfers [P][S33].
  - Complaints.
- **Existing digital services:** Declaration procedures [A — verify online filing].
- **Public APIs:** N/A.
- **Integration opportunities:** None technical.
- **Legal requirements:** All CIVORA processing activities, including the prototype if any personal data of real persons is processed (e.g. test users), must be declared. Health processing requires authorisation.
- **Data protection:** INPDP voiced reservations on the biometric ID project [P][S12].
- **Technical limitations:** —
- **Partnership opportunities:** Early "privacy-by-design" presentation. CIVORA's consent and audit tooling can help institutions meet INPDP expectations. **Must be engaged before any pilot.**

### Ministry of Interior
- **Responsibilities:**
  - Civil registry (*Madania* system), linked to the IUC register [P][S5].
  - National ID card and passports.
  - Bulletin n°3 (criminal record extract).
  - Traffic police.
  - Local affairs / municipalities [A — verify current attachment].
- **Existing digital services:**
  - Online birth extract via e-Bawaba, co-signed arrêté of 16 Aug 2022 (Interior, Justice, Communication Technologies) [P][S15].
  - Remote translation of birth extracts (Aug 2026) [P][S16].
  - Online appointments for passport/ID/B3 planned from 2027 [P][S13].
  - Biometric documents pending [P][S12].
- **Public APIs:** None [U]. IUC and civil registry access is legally restricted.
- **Integration opportunities:** Only via UXP and only for authorised public clients. Front-end appointment and status journeys could be supplied *to* the ministry.
- **Legal requirements:**
  - IUC framework (2020) [P][S6][S7].
  - Organic Laws 22 & 23 of 2024 (biometric documents) [P][S10].
  - Civil status law [A].
- **Data protection:** Highest sensitivity. Civil society contestation is documented [V][S8][S11].
- **Technical limitations:** Closed systems; security posture.
- **Partnership opportunities:** Long-term only. **CIVORA must never attempt to access MoI registries outside a formal mandate.**

### Ministry of Health
- **Responsibilities:**
  - Health system.
  - Health digital transformation: national health ID, shared medical record, *Sahetna.tn*, PNDN [P][S67]–[S71].
  - Telemedicine authorisations (Decree 2022-318; arrêtés of June 2024) [P][S48][S49].
- **Existing digital services:**
  - Sahetna.tn (in final audit, Jul 2026) [P][S68]
  - PNDN birth declaration [P][S70]
  - Hospital digitisation [P][S69]
- **Public APIs:** None [U].
- **Integration opportunities:** Telemedicine platform tooling (authorised platforms); clinic-side consent and appointment systems; FHIR-based integration if standards are published [U].
- **Legal requirements:**
  - Telemedicine: MoH prior authorisation **and** INPDP agreement; hosting in Tunisia; ≥10-year retention; patient consent for access by another physician [P][S48].
- **Data protection:** Health data = sensitive; INPDP authorisation [P][S33]; medical secrecy [A — Penal Code, verify].
- **Technical limitations:** National standards (identifiers, terminologies) not publicly documented [U].
- **Partnership opportunities:** Later phase. Start through private clinics or telemedicine operators. Participate in events such as TeleHealth Connect [P][S69].

### Ministry of Finance (DGI, Customs, Treasury)
- **Responsibilities:** Taxation, customs, public payments.
- **Existing digital services:**
  - Tax e-services [A — verify current portals].
  - DGI and Customs connected to the interoperability platform [P][S24].
  - Cybernetica fiscal data-exchange project [V][S114].
- **Public APIs:** None [U].
- **Integration opportunities:** Payment-status and receipt verification for authorised clients; tax-procedure content for the Guide.
- **Legal requirements:** Tax secrecy [A].
- **Data protection:** Financial data — high sensitivity.
- **Technical limitations:** —
- **Partnership opportunities:** Low near-term.

### Ministry of Social Affairs and the social security funds

| Fund | Responsibilities | Existing digital services | APIs | CIVORA opportunity |
|---|---|---|---|---|
| **CNSS** (private-sector social security) | Contributions, benefits, pensions for private-sector workers | Online services for employers (salary declarations, e-payment, certified certificates) and for non-salaried workers via national digital identity (TnsNet); USSD payment via operators [P][S63][S64] | None [U] | Case tracking and notification layer; assisted-channel tooling; Guide content |
| **CNRPS** (public-sector pensions) | Pensions and contributions of public agents | Affiliate payment app; pension simulator (Jan 2026) [P][S65] | None [U] | Same as CNSS |
| **CNAM** (health insurance) | Health coverage, reimbursements, *Labes* smart card | Labes card (insured identity, access to health file) [P][S60][S61]; online services, with documented delays and lack of status visibility [P][S62] | None [U] | **Reimbursement status tracking & notifications** is a clear pain point. Back-office workflow |

- **Legal requirements (all funds):** Social security laws; Law 2004-63; tender procurement.
- **Partnership:** Via Ministry of Social Affairs programmes and donor projects. The World Bank GovTech project covers social protection services [V][S74].

### Ministry of Education / Higher Education
- **Responsibilities:** Schools, universities, exams, diplomas.
- **Existing digital services:**
  - Online school registration (payment via La Poste card / e-Dinar, Aug 2025) [P][S73].
  - Education connected to the interoperability platform [P][S24].
  - World Bank GovTech scope includes education services [V][S74].
- **Public APIs:** None [U].
- **Integration opportunities:** **Verifiable diplomas** (W3C VC) for universities, starting with private universities (B2B); certificate verification for employers.
- **Legal requirements:** Diploma authenticity rules [A].
- **Data protection:** Student data (minors in schools — heightened care).
- **Partnership opportunities:** Private higher-education institutions as early B2B clients; ministry later.

### Ministry of Transport / ATTT (vehicles and driving)
- **Responsibilities:** Driving licences, vehicle registration, technical inspection.
- **Existing digital services:** Road and vehicle services announced in Khadamet [P][S18]; e-Dinar payment for technical inspection fees [P][S72].
- **Public APIs:** None [U].
- **Integration opportunities:** Reminders (expiry) only with authorised data; Guide content.
- **Legal requirements:** —
- **Partnership opportunities:** Low near-term.

### Ministry of Foreign Affairs / Office des Tunisiens à l'Étranger (OTE)
- **Responsibilities:** Consular services; diaspora relations (~1.8M Tunisians abroad) [P][S83].
- **Existing digital services:** e-Houwiya for Tunisians abroad (pilot from Feb 2024) [P][S2]; remote civil-status services [P][S16].
- **Public APIs:** None [U].
- **Integration opportunities:** Consular appointment and case management; diaspora Guide.
- **Partnership opportunities:** **Medium-priority, high-impact niche.** Consulates in Europe face high demand.

### La Poste Tunisienne
- **Responsibilities:** Postal, financial and payment services.
- **Existing digital services:** Free *e-Dinar* wallet for every citizen (Jul 2025); D17 app; QR payments; administrative-fee payments on some platforms [P][S72].
- **Public APIs:** Merchant integration [A — verify terms].
- **Integration opportunities:** **Payment channel for fees** in CIVORA deployments (commercial agreement).
- **Partnership opportunities:** Strong. La Poste reaches unbanked and elderly citizens; it also distributes pensions.

### Banque Centrale de Tunisie (BCT)
- **Responsibilities:** Monetary authority; regulates banks and payment institutions.
- **Relevant rules:**
  - Circular 2025-06 (electronic customer enrolment / e-KYC for banks) [P][S51].
  - Circular 2026-10 (payment institutions; remote account opening; audits of remote-identification technology) [P][S52][S53].
- **Integration opportunities:** None directly. **This regulation creates the L1 market.**
- **Partnership:** Regulatory dialogue; any CIVORA service holding funds would require licensing. **CIVORA must not hold funds.**

### HAICOP / TUNEPS (public procurement)
- **Responsibilities:** Public procurement oversight. TUNEPS e-procurement platform under Decree 2014-1039 [P][S54].
- **Notes:**
  - Reform of the procurement framework under way (draft decree, Nov 2025) [P][S56].
  - A 2022 press report described a measure dedicating **10% of public procurement to start-ups**. **Not verified against an official text** [P][S57][U].
- **Partnership:** Register on TUNEPS; monitor tenders; consider the "innovative purchasing" route if confirmed.

### RNE (National Register of Enterprises) and TIA (Tunisia Investment Authority)
- Targeted in UXP Phase 2 for business-facing services [V][S23].
- Mobile ID is mandatory for investors' online declarations from July 2026 [P][S76].
- **Relevance:** B2B onboarding (KYB) and investor journeys. Low near-term.

## 5.2 Stakeholder map

| Stakeholder | Influence | Interest in CIVORA's offer | Engagement stance |
|---|---|---|---|
| MinCom (digital transformation leadership) | Very high | Medium–high (capacity, components) | **Engage first.** Present as supplier/partner; seek feedback and Startup Act label |
| Presidency of Government (reforms / Dalil) | Very high | High (Guide on Dalil) | Engage early with the AI assistant demo |
| CNI | High | Medium (hosting, operations) | Technical partnership; deployability proof |
| INPDP | High (veto on sensitive processing) | Medium | Engage before any pilot; privacy-by-design briefing |
| ANCS | High (audits, labels) | Low–medium | Consult on security architecture; plan audit |
| ANCE / TunTrust | Medium | High (commercial signatures) | **Commercial partnership for L1** |
| Ministry of Health | High | Medium (capacity) | Later; via clinics/telemedicine |
| Social funds (CNAM/CNSS/CNRPS) | Medium | High (status tracking) | Via Ministry of Social Affairs and donor programmes |
| MoI | Very high | Low (closed systems) | Do not prioritise; respect boundaries |
| BCT | High (finance sector) | Indirect | Regulatory dialogue for L1 |
| La Poste | Medium | High (payments, reach) | Commercial partnership |
| Donors (World Bank, SECO, EU, GIZ) | High (funding) | High (implementation capacity) | Engage early; position for subcontracts |
| Prime contractors (Cybernetica, PwC Tunisia, integrators) | Medium | Medium–high | Teaming agreements |
| Civil society (Access Now, local NGOs) | Medium (public trust) | High (privacy) | **Proactive transparency**; invite review of the Citizen Data Charter |
| Banks / payment institutions / telcos | Medium | High (BCT compliance) | **L1 customer discovery in first 90 days** |
| Citizens (residents, diaspora, elderly) | Indirect | High | User research in every phase |

## 5.3 Recommended engagement sequence

1. **Weeks 1–6:**
   - L1 discovery with 10–15 banks, payment institutions and telcos.
   - Informal meetings with ANCE/TunTrust and La Poste.
   - Donor teams: the World Bank GovTech task team, SECO and the EU delegation.
2. **Weeks 4–10:**
   - MinCom and the Presidency (reforms directorate) with a clickable prototype of the Guide and Workspace.
   - INPDP and ANCS informational meetings.
3. **Months 4–9:**
   - Pilot proposals: one public institution (case management + Guide) and one or two B2B pilots.
4. **Never:** Approach any registry operator for data access without a sponsoring institution and a defined lawful basis.
