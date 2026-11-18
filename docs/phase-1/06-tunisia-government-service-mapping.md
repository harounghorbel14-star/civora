# 6. Tunisia Government Service Mapping

This document maps the 20 sectors ([05](05-government-master-service-catalog.md)) onto Tunisian institutions, the digital services they already run, and CIVORA's integration status. It **builds on Phase 0 research** and does not repeat it:
- institutions: Phase 0 §5
- integrations: Phase 0 §12

New facts gathered in Phase 1 are cited as S120+ in [sources.md](sources.md).

## 6.1 Integration status classes (directive §6)

| Class | Meaning | How CIVORA moves an item up a class |
|---|---|---|
| **1** | Verified official integration | Live in production under a signed agreement, with evidence in the integration register |
| **2** | Authorized partner integration | Agreement signed; sandbox or production access granted |
| **3** | Technically possible but not yet authorized | A documented or commercial path exists; no agreement yet |
| **4** | Independent prototype | Built by CIVORA with synthetic data; no connection to any real system |
| **5** | Future opportunity | Depends on programmes, policies or partners not yet in reach |
| **6** | Not currently feasible | Legally restricted, out of scope, or contrary to CIVORA principles |

**Today:**
- 0 items in class 1
- 0 items in class 2
- 14 in class 3
- 8 in class 4
- 19 in class 5
- 3 in class 6

That is 44 items across 20 sectors. The Phase 0 [integration status register](../phase-0/integration-status-register.md) now carries the same classes (crosswalk C6).

**Why the totals differ from the register:**
- The register lists **36 concrete integrations**: 27 in class 3, 1 in class 4, 7 in class 5, 1 in class 6.
- The **44 sector-level points** here also count capabilities and prototypes per sector. Some integrations appear in more than one sector.

**Evidence labels:**
- **[V]** verified
- **[P]** press or secondary
- **[A]** assumption
- **[U]** unverified, nothing found

## 6.2 What Tunisia already has (do not duplicate)

- **National identity:**
  - Mobile ID / e-Houwiya
  - biometric CIN, legislated but pending
- **Front doors:**
  - e-Bawaba
  - Khadamet
- **Data exchange:** a national interoperability platform (UXP), with mandatory exchange decided in Sept 2025.
- **Procedures:** Dalil.
- **Health:** health ID, shared record and Sahetna.tn.
- **Business registry:** RNE, zero-paper since 1 Jul 2026 [P][S126], with its own AI assistants [P][S127].
- **Utility payments:** STEG and SONEDE e-payment [P][S130][S131].

CIVORA's role is the **back office, service-line workflows, complaints and tracking**, and the **white-label channels** that sit on these foundations. It does not replace them.

## 6.3 Sector-by-sector mapping

### 01. Digital Identity

- **Lead institutions:** Ministry of Communication Technologies (Mobile ID / e-Houwiya); Ministry of Interior (CIN, unique citizen identifier); ANCE / TunTrust (PKI, certificates)
- **Existing digital services:**
  - [P] Mobile ID live since 2022; diaspora e-Houwiya since 2024 — S1, S2 (Phase 0)
  - [P] Biometric CIN/passport legislated (Organic Laws 22 & 23 of 2024); rollout pending — S10, S12, S13 (Phase 0)
  - [P] Mobile ID mandatory for investors' online declarations from 1 Jul 2026 — S76 (Phase 0)

| Integration / capability | Status class |
|---|---|
| Mobile ID relying-party authentication | **3** — Technically possible but not yet authorized |
| TunTrust certificates & e-signature | **3** — Technically possible but not yet authorized |
| Direct unique-identifier (IUC) register access | **6** — Not currently feasible |
| Biometric CIN chip authentication | **5** — Future opportunity |
| CIVORA accounts, passkeys, mandates (simulated eID) | **4** — Independent prototype |

### 02. Civil Services

- **Lead institutions:** Ministry of Interior (civil registry 'Madania', CIN, passports); Municipalities (civil-status offices); Ministry of Foreign Affairs (consulates); Ministry of Justice (civil-status oversight)
- **Existing digital services:**
  - [P] Online birth extract with QR code via e-Bawaba, same legal value as municipal extract — S15 (Phase 0)
  - [P] Remote request for translated birth extract (Aug 2026) — S16 (Phase 0)
  - [P] Online appointments for passport, CIN and B3 announced from 2027 — S13 (Phase 0)

| Integration / capability | Status class |
|---|---|
| Civil registry (Madania) via national interoperability platform for an authorised member | **3** — Technically possible but not yet authorized |
| QR verification of online birth extracts | **3** — Technically possible but not yet authorized |
| Consular appointment & case Workspace | **5** — Future opportunity |
| Citizen request tracking (prototype) | **4** — Independent prototype |

### 03. Tax & Finance

- **Lead institutions:** Ministry of Finance (DGI tax administration, Customs, Treasury); Ministry of Interior (traffic fines); La Poste Tunisienne (e-Dinar/D17); SMT (ClicToPay)
- **Existing digital services:**
  - [P] DGI and Customs connected to the national interoperability platform (86 interconnected services reported) — S24 (Phase 0)
  - [P] DGI online 'patente' platform launched (Aug 2026) — S120
  - [P] Free e-Dinar wallet usable for some administrative fees — S72 (Phase 0)
  - [P] Khadamet app includes tax services — S18 (Phase 0)

| Integration / capability | Status class |
|---|---|
| Authoritative tax / fines data | **5** — Future opportunity |
| Card and wallet payments via licensed providers | **3** — Technically possible but not yet authorized |
| Payment orchestration (simulated) | **4** — Independent prototype |

### 04. Healthcare

- **Lead institutions:** Ministry of Health (national health ID, shared record, Sahetna.tn, PNDN); CNAM (coverage, Labes card); Public hospitals; Private clinics
- **Existing digital services:**
  - [P] Unique health identifier and shared record targeted nationwide by end-2026; Sahetna.tn in final audit — S67, S68, S69 (Phase 0)
  - [P] National birth declaration platform (PNDN) piloted April 2026 — S70 (Phase 0)
  - [P] CNAM Labes card; documented reimbursement delays — S60, S62 (Phase 0)

| Integration / capability | Status class |
|---|---|
| National health record / Sahetna | **5** — Future opportunity |
| Telemedicine platform authorisation | **3** — Technically possible but not yet authorized |
| Private clinic EHR integration | **3** — Technically possible but not yet authorized |
| Consent & break-glass prototype (synthetic) | **5** — Future opportunity |

### 05. Education

- **Lead institutions:** Ministry of Education; Ministry of Higher Education and Scientific Research; Public and private universities
- **Existing digital services:**
  - [P] Online school registration with La Poste card / e-Dinar payment (Aug 2025) — S73 (Phase 0)
  - [P] 'Vie scolaire' portal to follow pupils' schooling remotely (Jul 2026) — S121
  - [P] Education connected to the national interoperability platform — S24 (Phase 0)

| Integration / capability | Status class |
|---|---|
| Ministry enrolment / results data | **5** — Future opportunity |
| Private university verifiable diplomas | **3** — Technically possible but not yet authorized |
| Credential issuance & verification (synthetic) | **4** — Independent prototype |

### 06. Transportation

- **Lead institutions:** Ministry of Transport; ATTT (land transport technical agency); Ministry of Interior (traffic police); Insurers; Public transport operators
- **Existing digital services:**
  - [P] Khadamet road services: infractions, technical inspection — S18 (Phase 0), S122
  - [P] e-Dinar payment of technical inspection fees — S72 (Phase 0)

| Integration / capability | Status class |
|---|---|
| ATTT / traffic data | **5** — Future opportunity |
| Expiry reminders from user-entered or credential data | **4** — Independent prototype |

### 07. Justice

- **Lead institutions:** Ministry of Justice; Courts; Administrative Tribunal; Bar association
- **Existing digital services:**
  - [P] Remote follow-up of civil litigation by file number — S123
  - [P] 'Ishare' civil affairs platform; new criminal and land-justice information systems announced for 2026 — S124
  - [P] Administrative tribunal 100% digital hearing in Gabès — S125

| Integration / capability | Status class |
|---|---|
| Court case-management systems | **5** — Future opportunity |
| Public legal information in Directory | **3** — Technically possible but not yet authorized |

### 08. Business & Commerce

- **Lead institutions:** National Register of Enterprises (RNE); Tunisia Investment Authority (TIA); Ministry of Commerce; Ministry of Industry; DGI
- **Existing digital services:**
  - [P] RNE procedures fully online from 1 Jul 2026 ('zero paper'); AI assistant 'Nourni' launched Nov 2026 — S126, S127
  - [P] Mobile ID mandatory for investor declarations from Jul 2026 — S76 (Phase 0)
  - [P] Ministry of Industry unified digital services platform (Aug 2026) — S128
  - [V] RNE and TIA targeted in UXP Phase 2 — S23 (Phase 0)

| Integration / capability | Status class |
|---|---|
| RNE data via national interoperability platform | **3** — Technically possible but not yet authorized |
| Business-verification (KYB) for regulated clients | **5** — Future opportunity |

### 09. Municipal Services

- **Lead institutions:** Municipalities (≈350 [A]); Ministry of Interior (local affairs) [A]
- **Existing digital services:**
  - [P] Civil-status counters in municipalities; digitisation of municipal services under way — S15 (Phase 0), S129

| Integration / capability | Status class |
|---|---|
| Municipal case management (Workspace) for permits & complaints | **5** — Future opportunity |
| Request tracking & notifications (prototype) | **4** — Independent prototype |

### 10. Public Safety & Security

- **Lead institutions:** Ministry of Interior (National Guard, police); National Civil Protection Office; Emergency medical services
- **Existing digital services:**
  - [U] No public digital service documentation reviewed

| Integration / capability | Status class |
|---|---|
| Emergency dispatch / crime reporting systems | **6** — Not currently feasible |
| Non-emergency information in Directory | **3** — Technically possible but not yet authorized |

### 11. Social Services

- **Lead institutions:** Ministry of Social Affairs; CNSS; CNRPS; CNAM
- **Existing digital services:**
  - [P] CNSS online services for employers and non-salaried workers (TnsNet) — S63, S64 (Phase 0)
  - [P] CNRPS pension simulator (Jan 2026) — S65 (Phase 0)
  - [P] Khadamet social-protection services — S18 (Phase 0)
  - [V] World Bank GovTech project covers social protection services — S74 (Phase 0)

| Integration / capability | Status class |
|---|---|
| Fund status data (CNAM/CNSS/CNRPS) via fund agreement | **3** — Technically possible but not yet authorized |
| Reimbursement tracking with mandates (prototype) | **4** — Independent prototype |

### 12. Housing & Property

- **Lead institutions:** Ministry of State Domains and Land Affairs [A]; Land Registry (Conservation de la propriété foncière) [A]; Topography and Cadastre Office (OTC) [A]; Ministry of Equipment and Housing [A]; Municipalities
- **Existing digital services:**
  - [P] New information system for land/real-estate justice announced for 2026 — S124

| Integration / capability | Status class |
|---|---|
| Land registry / cadastre data | **5** — Future opportunity |

### 13. Immigration & Residency

- **Lead institutions:** Ministry of Interior [A]; Ministry of Employment and Vocational Training [A]; Ministry of Foreign Affairs
- **Existing digital services:**
  - [U] No public digital service documentation reviewed

| Integration / capability | Status class |
|---|---|
| Residency / work-permit systems | **5** — Future opportunity |

### 14. Employment & Labour

- **Lead institutions:** Ministry of Employment and Vocational Training; ANETI (national employment agency) [A]; Labour inspection [A]; CNSS (employer registration)
- **Existing digital services:**
  - [P] CNSS online employer declarations — S63 (Phase 0)

| Integration / capability | Status class |
|---|---|
| Employment-agency systems | **5** — Future opportunity |
| Employer social declarations via CNSS | **5** — Future opportunity |

### 15. Environment & Agriculture

- **Lead institutions:** Ministry of Agriculture, Water Resources and Fisheries [A]; Regional Agricultural Development Commissariats (CRDA) [A]; Environmental protection agency (ANPE) [A]; Agricultural investment agency (APIA) [A]
- **Existing digital services:**
  - [U] No public digital service documentation reviewed

| Integration / capability | Status class |
|---|---|
| Agriculture / environment systems | **5** — Future opportunity |

### 16. Energy & Utilities

- **Lead institutions:** STEG (electricity & gas); SONEDE (water); ONAS (sanitation) [A]; Ministry of Industry, Mines and Energy [A]
- **Existing digital services:**
  - [P] STEG online bill payment since 2020 incl. operator USSD — S130
  - [P] SONEDE online payment; card terminals in all districts (2026) — S131

| Integration / capability | Status class |
|---|---|
| Utility billing/complaints systems (commercial agreement with utility) | **3** — Technically possible but not yet authorized |
| Bill payment via licensed providers | **3** — Technically possible but not yet authorized |

### 17. Travel & Tourism

- **Lead institutions:** Ministry of Tourism [A]; National Tourism Office (ONTT) [A]; Ministry of Interior (borders); Ministry of Foreign Affairs
- **Existing digital services:**
  - [U] No public digital service documentation reviewed

| Integration / capability | Status class |
|---|---|
| Border / tourism licensing systems | **5** — Future opportunity |

### 18. Civic & Political Services

- **Lead institutions:** Independent High Authority for Elections (ISIE) [A]; Assembly of the Representatives of the People; Municipalities
- **Existing digital services:**
  - [U] No public digital service documentation reviewed

| Integration / capability | Status class |
|---|---|
| Voter registration / electoral systems | **6** — Not currently feasible |
| Public consultation tooling under mandate | **5** — Future opportunity |

### 19. Animal & Veterinary Services

- **Lead institutions:** Ministry of Agriculture (veterinary services) [A]; CRDA [A]; Veterinary order [A]
- **Existing digital services:**
  - [U] No public digital service documentation reviewed

| Integration / capability | Status class |
|---|---|
| Veterinary systems | **5** — Future opportunity |

### 20. Government Communication

- **Lead institutions:** Presidency of the Government (administrative reform; Dalil); All ministries and agencies; Ministry of Communication Technologies (e-Bawaba, Khadamet notifications)
- **Existing digital services:**
  - [P] Dalil national procedures platform (~3,200 procedures inventoried) — S27 (Phase 0)
  - [P] Khadamet single app (Android Aug 2026; iOS Oct 2026) — S18, S20 (Phase 0)

| Integration / capability | Status class |
|---|---|
| Complaint & request case management (Workspace) for an institution | **5** — Future opportunity |
| Notifications & tracking (prototype) | **4** — Independent prototype |

## 6.4 Where CIVORA can add value in Tunisia (ranked)

| Rank | Opportunity | Sectors | Why | Path |
|---|---|---|---|---|
| 1 | Complaints, correspondence and application tracking for an institution (Workspace) | 20, 11, 16, 09 | Same engine as the first product. Status visibility is a documented pain (Phase 0 §3.4) | Phase 6 capability → Phase 13 pilot with an institution (donor-funded or direct) |
| 2 | Consular / diaspora appointments and cases | 02, 17 | ~1.8M Tunisians abroad (Phase 0 S83). Remote services are expanding | Proposal to MFA after first product is live |
| 3 | Social-fund request and reimbursement tracking with mandates | 11 | Delays and lack of visibility at CNAM (Phase 0 S62) | Fund agreement (class 3 → 2) |
| 4 | Municipal permits & complaints | 09 | Municipal dematerialisation under way [P][S129] | Pilot municipality |
| 5 | Private-university verifiable diplomas | 05 | Commercial path exists | B2B contract (Division D) |

## 6.5 Validation still required

- Institutional attachments marked [A] (e.g. local affairs under Interior, ANETI, CRDA, ANPE, OTC). Check against official organigrams before external use.
- Sectors marked [U] for existing digital services (10, 13, 15, 17, 18, 19). Desk research found no public documentation. Interview institution staff in the 90-day plan.
