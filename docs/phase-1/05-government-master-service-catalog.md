# 5. CIVORA Government — Master Service Catalog (20 Sectors)

These are **functional categories, not development phases** (directive §4).

Structured source of truth: [data/government-service-catalog.json](data/government-service-catalog.json). This document is generated from that JSON, so both stay consistent.

## 5.1 How the catalog is used

| Use | Mechanism | Roadmap phase |
|---|---|---|
| **Taxonomy** of the Government Services Directory (sector → subcategory → service) | Every service record carries a sector and subcategory code, and optional life-event tags | Phase 5 |
| **Workflow templates** for institutions that digitise a service with CIVORA Workspace | Case types configured per service | Phase 6 onward |
| **Integration planning** | Authoritative integrations only after authorisation | Phase 12 onward |
| **Country packs** | Each country maps its institutions and services onto the same 20 sectors. Sector codes are global; services are country-specific | Phase 15 |

**Global vs country:**
- The 20 sectors and their subcategories are **global**.
- Institutions, services, legal bases, fees and integrations are **country-specific** (directive §5).
- The Tunisia mapping is in [06](06-tunisia-government-service-mapping.md).

## 5.2 Scope rules (apply to every sector)

1. **Directory first.** Every sector gets guidance content in Phase 5, with official sources, dates and deep links.
2. **Workflows only for a contracting institution's own processes** (Phase 6+). CIVORA never processes a service on behalf of the state without a mandate.
3. **Authoritative data only by authorisation** (Phase 12+, class 3 → 2).
4. **Excluded** (founder decision P1-D10, approved with boundaries). CIVORA will not provide:
   - unauthorised **operational policing** functions (sector 10)
   - **emergency dispatch** (sector 10)
   - **electoral administration** (sector 18)
   - **restricted national-register functions** in any sector (identity, civil status, land, health)

   These sectors remain in the catalogue for information and guidance only.
5. **Data tiers** follow Phase 0 Section 10 (T0 health/biometrics … T3 public).

## 5.3 Summary

| # | Sector | Data tier | Roadmap phases | CIVORA priority |
|---|---|---|---|---|
| 01 | Digital Identity | T1 (T0 if biometrics) | Phase 3, Phase 4, Phase 12 | Platform foundation (needed by first product for staff/customer auth) |
| 02 | Civil Services | T1 | Phase 4, Phase 5, Phase 6, Phase 12 | High for Government track (after first product) |
| 03 | Tax & Finance | T1 | Phase 8, Phase 12 | Low as standalone; payments capability needed later |
| 04 | Healthcare | T0 | Phase 7, Phase 12 | Deferred (regulatory barriers; national programme in place) |
| 05 | Education | T1–T2 (minors: parental mandate) | Phase 9, Phase 4 | Medium (credentials via private universities) |
| 06 | Transportation | T1–T2 | Phase 5, Phase 12, Phase 14 | Low (covered by Khadamet) |
| 07 | Justice | T1 (sensitive) | Phase 5 | Low — information only; no court integrations planned |
| 08 | Business & Commerce | T2 (public register) / T1 (owners' personal data) | Phase 5, Phase 12 | Low–medium |
| 09 | Municipal Services | T2 | Phase 6, Phase 13 | Medium — good pilot candidate after first product |
| 10 | Public Safety & Security | T1 (sensitive) | Phase 5 | Excluded — CIVORA does not build emergency or policing systems |
| 11 | Social Services | T1 | Phase 9, Phase 12 | Medium–high for Government track |
| 12 | Housing & Property | T1 | Phase 5, Phase 6 | Low |
| 13 | Immigration & Residency | T1 | Phase 5 | Low |
| 14 | Employment & Labour | T1–T2 | Phase 5, Phase 9 | Low |
| 15 | Environment & Agriculture | T2 | Phase 5, Phase 6 | Low |
| 16 | Energy & Utilities | T2 | Phase 6, Phase 8 | Medium — complaints management fits first product |
| 17 | Travel & Tourism | T1–T2 | Phase 5 | Low |
| 18 | Civic & Political Services | T1 (politically sensitive) | Phase 5 | Excluded for elections; consultations only on mandate with neutrality safeguards |
| 19 | Animal & Veterinary Services | T2 | Phase 5 | Low |
| 20 | Government Communication | T2 | Phase 6, Phase 13 | High — direct bridge from first product to Government |

## 5.4 Sector detail

### 01. Digital Identity · Identité numérique · الهوية الرقمية

| Subcategory | Services |
|---|---|
| Identity & authentication | Digital identity account; Secure authentication (MFA, passkeys); Identity recovery |
| Trust services | Electronic signatures; Identity wallets / verifiable credentials; Identity verification APIs for authorised relying parties |

- **Users:** Citizens, Residents, Diaspora, Relying-party institutions, Trust service providers
- **Institutional responsibilities:** State identity issuer owns legal identity; trust service providers issue certificates; relying parties consume authentication under authorisation.
- **Implementation requirements:**
  - Data tier: T1 (T0 if biometrics)
  - Identity assurance: Substantial–High
  - Legal prerequisites: Law 2000-83; IUC framework (2020); Law 2004-63; any relying-party agreement with MinCom/ANCE
  - Roadmap phases: Phase 3, Phase 4, Phase 12
  - CIVORA products: Identity: broker, mandates, e-signature workflows
- **CIVORA priority:** Platform foundation (needed by first product for staff/customer auth)

### 02. Civil Services · Services d'état civil et documents d'identité · الخدمات المدنية

| Subcategory | Services |
|---|---|
| Identity documents | National identity cards; Passports |
| Civil status certificates | Birth certificates; Marriage certificates; Divorce certificates; Death certificates; Family records |
| Civil status services | Corrections & annotations; Translation of extracts; Consular civil status |

- **Users:** Citizens, Diaspora, Municipal civil-status officers, Consular staff
- **Institutional responsibilities:** Civil registry authority keeps the authoritative register; municipalities and consulates operate counters; issuing authorities sign documents.
- **Implementation requirements:**
  - Data tier: T1
  - Identity assurance: Substantial
  - Legal prerequisites: Civil-status law; inter-ministerial arrêté of 16 Aug 2022 (online extract); Law 2004-63; MoI mandate
  - Roadmap phases: Phase 4, Phase 5, Phase 6, Phase 12
  - CIVORA products: Government Workspace (counters, consulates), Citizen tracking (white-label)
- **CIVORA priority:** High for Government track (after first product)

### 03. Tax & Finance · Fiscalité et finances · الجباية والمالية

| Subcategory | Services |
|---|---|
| Taxation | Tax declarations; Tax payments; Tax registration |
| Public payments | Government fees; Public bills; Traffic fine payments; Financial receipts |
| Authorised financial services | Payment channels via licensed providers |

- **Users:** Citizens, Businesses, Accountants, Tax officers
- **Institutional responsibilities:** Tax administration assesses and collects; treasury receives; licensed payment providers move funds.
- **Implementation requirements:**
  - Data tier: T1
  - Identity assurance: Substantial
  - Legal prerequisites: Tax secrecy rules [A]; BCT payment regulations; CIVORA never holds funds
  - Roadmap phases: Phase 8, Phase 12
  - CIVORA products: Payments orchestration (shared platform)
- **CIVORA priority:** Low as standalone; payments capability needed later

### 04. Healthcare · Santé · الصحة

| Subcategory | Services |
|---|---|
| Records | Medical records; Laboratory results; Medical imaging; Vaccinations; Prescriptions |
| Access to care | Medical appointments; Hospital services; Telemedicine |
| Coverage | Health insurance (CNAM); Reimbursements |

- **Users:** Patients, Doctors, Hospitals & clinics, Pharmacists, Insurers
- **Institutional responsibilities:** Ministry of Health governs records and telemedicine authorisation; health insurer manages coverage; providers are controllers of clinical data.
- **Implementation requirements:**
  - Data tier: T0
  - Identity assurance: High
  - Legal prerequisites: Law 2004-63 (INPDP authorisation for health data); Decree 2022-318 telemedicine (MoH authorisation, hosting in Tunisia, ≥10-yr retention); medical secrecy
  - Roadmap phases: Phase 7, Phase 12
  - CIVORA products: Health division (deferred): consent bridge, clinic scheduling
- **CIVORA priority:** Deferred (regulatory barriers; national programme in place)

### 05. Education · Éducation · التعليم

| Subcategory | Services |
|---|---|
| Enrolment | School enrolment; University enrolment |
| Results & records | Examination results; Student records; Academic certificates |
| Support | Scholarships; Educational administration |

- **Users:** Students, Parents, Schools & universities, Employers (verification)
- **Institutional responsibilities:** Education ministries own enrolment and results; institutions issue certificates; employers verify.
- **Implementation requirements:**
  - Data tier: T1–T2 (minors: parental mandate)
  - Identity assurance: Low–Substantial
  - Legal prerequisites: Diploma regulations [A]; Law 2004-63 (minors)
  - Roadmap phases: Phase 9, Phase 4
  - CIVORA products: Identity: verifiable credentials, Workspace: scholarship/administrative requests
- **CIVORA priority:** Medium (credentials via private universities)

### 06. Transportation · Transport · النقل

| Subcategory | Services |
|---|---|
| Drivers | Driving licences; Traffic violations |
| Vehicles | Vehicle registration; Vehicle ownership; Vehicle inspections; Insurance information |
| Mobility | Public transportation information |

- **Users:** Drivers, Vehicle owners, Insurers, Transport operators
- **Institutional responsibilities:** Transport agency issues licences and registrations; police enforce; insurers cover; operators run transit.
- **Implementation requirements:**
  - Data tier: T1–T2
  - Identity assurance: Substantial
  - Legal prerequisites: Agreements with ATTT/MoI
  - Roadmap phases: Phase 5, Phase 12, Phase 14
  - CIVORA products: Directory guidance; reminders
- **CIVORA priority:** Low (covered by Khadamet)

### 07. Justice · Justice · العدالة

| Subcategory | Services |
|---|---|
| Courts | Court services; Case tracking; Court appointments |
| Documents | Legal documents; Judicial administrative requests |
| Information | Public legal information |

- **Users:** Citizens, Lawyers, Court clerks, Businesses
- **Institutional responsibilities:** Ministry of Justice and courts own case management; bar and notaries are professional intermediaries.
- **Implementation requirements:**
  - Data tier: T1 (sensitive)
  - Identity assurance: Substantial–High
  - Legal prerequisites: Judicial confidentiality; Law 2004-63
  - Roadmap phases: Phase 5
  - CIVORA products: Directory guidance only
- **CIVORA priority:** Low — information only; no court integrations planned

### 08. Business & Commerce · Entreprises et commerce · الأعمال والتجارة

| Subcategory | Services |
|---|---|
| Registration | Company registration; Commercial registry; Tax registration |
| Authorisations | Business licences; Business permits |
| Lifecycle | Company administration; Commercial compliance |

- **Users:** Entrepreneurs, Companies, Accountants, Investors
- **Institutional responsibilities:** Company registry records legal entities; investment authority handles investor declarations; sector ministries issue licences.
- **Implementation requirements:**
  - Data tier: T2 (public register) / T1 (owners' personal data)
  - Identity assurance: Substantial
  - Legal prerequisites: Registry law; Law 2004-63
  - Roadmap phases: Phase 5, Phase 12
  - CIVORA products: Directory; future KYB in Identity
- **CIVORA priority:** Low–medium

### 09. Municipal Services · Services municipaux · الخدمات البلدية

| Subcategory | Services |
|---|---|
| Administration | Municipal administration; Local licences; Municipal payments |
| Urban | Construction permits; Public infrastructure complaints; Waste management |

- **Users:** Residents, Businesses, Municipal staff
- **Institutional responsibilities:** Municipalities deliver local services under Interior/local-affairs supervision.
- **Implementation requirements:**
  - Data tier: T2
  - Identity assurance: Low–Substantial
  - Legal prerequisites: Local-government law; procurement rules
  - Roadmap phases: Phase 6, Phase 13
  - CIVORA products: Government Workspace (permits, complaints)
- **CIVORA priority:** Medium — good pilot candidate after first product

### 10. Public Safety & Security · Sécurité publique · السلامة والأمن العام

| Subcategory | Services |
|---|---|
| Emergency | Emergency services; Civil protection |
| Reporting | Crime reporting; Incident reporting; Public safety requests |
| Authorised services | Authorised security services |

- **Users:** Citizens, Emergency responders, Police, Civil protection
- **Institutional responsibilities:** Interior ministry, civil protection and emergency medical services operate critical systems under state control.
- **Implementation requirements:**
  - Data tier: T1 (sensitive)
  - Identity assurance: High
  - Legal prerequisites: State security rules; critical-system certification
  - Roadmap phases: Phase 5
  - CIVORA products: Directory information only
- **CIVORA priority:** Excluded — CIVORA does not build emergency or policing systems

### 11. Social Services · Services sociaux · الخدمات الاجتماعية

| Subcategory | Services |
|---|---|
| Social insurance | Social security; Retirement; Pensions |
| Assistance | Social assistance; Family benefits; Unemployment support; Disability-related services |

- **Users:** Insured persons, Retirees, Beneficiaries, Employers, Caregivers
- **Institutional responsibilities:** Social security funds manage contributions and benefits; Ministry of Social Affairs runs assistance programmes.
- **Implementation requirements:**
  - Data tier: T1
  - Identity assurance: Substantial
  - Legal prerequisites: Social-security laws; Law 2004-63; fund agreements
  - Roadmap phases: Phase 9, Phase 12
  - CIVORA products: Government Workspace; status tracking; mandates
- **CIVORA priority:** Medium–high for Government track

### 12. Housing & Property · Logement et propriété · السكن والملكية

| Subcategory | Services |
|---|---|
| Land | Property registration; Property ownership; Land administration |
| Housing | Housing assistance; Social housing applications; Construction-related permits |

- **Users:** Owners, Buyers, Notaries, Developers, Municipalities
- **Institutional responsibilities:** Land registry and cadastre record rights; housing agencies run programmes; municipalities permit construction.
- **Implementation requirements:**
  - Data tier: T1
  - Identity assurance: Substantial–High
  - Legal prerequisites: Land-registration law; notarial rules
  - Roadmap phases: Phase 5, Phase 6
  - CIVORA products: Directory; Workspace for housing applications
- **CIVORA priority:** Low

### 13. Immigration & Residency · Immigration et résidence · الهجرة والإقامة

| Subcategory | Services |
|---|---|
| Residency | Residency applications; Residency renewals; Foreign resident services |
| Entry & work | Visa-related services; Work permits; Immigration administration |

- **Users:** Foreign residents, Employers, Consulates
- **Institutional responsibilities:** Interior ministry issues residence cards; labour ministry approves foreign work contracts; foreign affairs handles visas.
- **Implementation requirements:**
  - Data tier: T1
  - Identity assurance: Substantial
  - Legal prerequisites: Immigration law; Law 2004-63
  - Roadmap phases: Phase 5
  - CIVORA products: Directory guidance
- **CIVORA priority:** Low

### 14. Employment & Labour · Emploi et travail · التشغيل والشغل

| Subcategory | Services |
|---|---|
| Job seekers | Employment services; Job applications; Unemployment services |
| Employers | Employer registration; Employment contracts; Work-related administrative requests |
| Rights | Labour rights information |

- **Users:** Job seekers, Employers, Workers, Labour inspectors
- **Institutional responsibilities:** Employment agency serves job seekers; labour inspection enforces rights; social security registers employers.
- **Implementation requirements:**
  - Data tier: T1–T2
  - Identity assurance: Substantial
  - Legal prerequisites: Labour code; Law 2004-63
  - Roadmap phases: Phase 5, Phase 9
  - CIVORA products: Directory; Workspace for employer requests
- **CIVORA priority:** Low

### 15. Environment & Agriculture · Environnement et agriculture · البيئة والفلاحة

| Subcategory | Services |
|---|---|
| Agriculture | Agricultural administration; Farming licences; Agricultural support; Veterinary and agricultural inspections |
| Environment | Land and water services; Environmental permits; Environmental complaints |

- **Users:** Farmers, Agri-businesses, Environmental agencies, Residents
- **Institutional responsibilities:** Agriculture ministry and regional commissariats administer farming support; environmental agency issues permits and handles complaints.
- **Implementation requirements:**
  - Data tier: T2
  - Identity assurance: Low–Substantial
  - Legal prerequisites: Sector laws
  - Roadmap phases: Phase 5, Phase 6
  - CIVORA products: Directory; Workspace for permits/complaints
- **CIVORA priority:** Low

### 16. Energy & Utilities · Énergie et services publics · الطاقة والمرافق

| Subcategory | Services |
|---|---|
| Services | Electricity; Water; Gas; New service connections; Meter administration |
| Customer | Utility payments; Service complaints |

- **Users:** Households, Businesses, Utility customer-service staff
- **Institutional responsibilities:** State utilities operate networks, billing and customer service.
- **Implementation requirements:**
  - Data tier: T2
  - Identity assurance: Low–Substantial
  - Legal prerequisites: Utility regulations; Law 2004-63
  - Roadmap phases: Phase 6, Phase 8
  - CIVORA products: Workspace (utility complaints) — Enterprise/Government crossover
- **CIVORA priority:** Medium — complaints management fits first product

### 17. Travel & Tourism · Voyage et tourisme · السفر والسياحة

| Subcategory | Services |
|---|---|
| Travel | Travel-related government services; Border-related information; Authorised travel documents; Travel notifications |
| Tourism | Tourism licences; Tourism administration |

- **Users:** Travellers, Diaspora, Tourism operators
- **Institutional responsibilities:** Tourism ministry and office license operators; interior handles borders; foreign affairs issues advisories.
- **Implementation requirements:**
  - Data tier: T1–T2
  - Identity assurance: Low–Substantial
  - Legal prerequisites: Sector laws
  - Roadmap phases: Phase 5
  - CIVORA products: Directory guidance (diaspora)
- **CIVORA priority:** Low

### 18. Civic & Political Services · Services civiques et participation · الخدمات المدنية والمشاركة

| Subcategory | Services |
|---|---|
| Elections | Voter registration where applicable; Election information |
| Participation | Civic participation; Public consultations; Petitions; Citizen participation programmes |

- **Users:** Citizens, Election authority, Parliament, Municipalities
- **Institutional responsibilities:** Independent election authority runs registration and elections; institutions run consultations.
- **Implementation requirements:**
  - Data tier: T1 (politically sensitive)
  - Identity assurance: High
  - Legal prerequisites: Electoral law; strict neutrality
  - Roadmap phases: Phase 5
  - CIVORA products: Directory information only
- **CIVORA priority:** Excluded for elections; consultations only on mandate with neutrality safeguards

### 19. Animal & Veterinary Services · Services vétérinaires et animaux · الخدمات البيطرية

| Subcategory | Services |
|---|---|
| Animals | Animal registration; Vaccination records; Animal movement permits |
| Veterinary | Veterinary certificates; Veterinary appointments; Animal-related administration |

- **Users:** Farmers, Pet owners, Veterinarians, Inspectors
- **Institutional responsibilities:** Veterinary services directorate oversees animal health, certificates and movement permits.
- **Implementation requirements:**
  - Data tier: T2
  - Identity assurance: Low
  - Legal prerequisites: Sector laws
  - Roadmap phases: Phase 5
  - CIVORA products: Directory guidance
- **CIVORA priority:** Low

### 20. Government Communication · Communication gouvernementale · التواصل الحكومي

| Subcategory | Services |
|---|---|
| Inbound | Citizen complaints; Citizen feedback; Administrative correspondence |
| Outbound | Official notifications; Government announcements; Official messaging |
| Tracking | Application tracking |

- **Users:** Citizens, All institutions, Ombudsman-type bodies
- **Institutional responsibilities:** Every institution handles complaints and correspondence; government communication units publish announcements.
- **Implementation requirements:**
  - Data tier: T2
  - Identity assurance: Low–Substantial
  - Legal prerequisites: Law 2004-63; institution's procedures
  - Roadmap phases: Phase 6, Phase 13
  - CIVORA products: Workspace (complaints, correspondence, tracking) — same engine as first product
- **CIVORA priority:** High — direct bridge from first product to Government

## 5.5 Life-event cross-index (for the citizen-facing Directory)

| Life event | Sectors involved |
|---|---|
| Birth of a child | 02 Civil, 04 Health, 11 Social, 05 Education (later) |
| Starting school / university | 05 Education, 11 Social (scholarships), 01 Identity |
| Getting a job | 14 Employment, 11 Social, 03 Tax |
| Starting a business | 08 Business, 03 Tax, 09 Municipal, 01 Identity |
| Buying or building a home | 12 Housing, 09 Municipal, 16 Utilities, 03 Tax |
| Owning a vehicle | 06 Transportation, 03 Tax (fines) |
| Falling ill / caring for a relative | 04 Health, 11 Social, 01 Identity (mandates) |
| Retirement | 11 Social, 03 Tax |
| Living abroad (diaspora) | 02 Civil, 01 Identity, 17 Travel, 13 Immigration |
| Death of a relative | 02 Civil, 11 Social, 12 Property, 03 Tax |
| Making a complaint / following up a request | 20 Government Communication (all sectors) |
