# 12. Integration Feasibility Matrix (Tunisia)

> **Six-class integration status (founder decision P1-D6, approved 18 Nov 2026):**
> 1. Verified official integration
> 2. Authorized partner integration
> 3. Technically possible but not yet authorized
> 4. Independent prototype
> 5. Future opportunity
> 6. Not currently feasible
>
> The "Class" column was added in Phase 1 v2.1. The operational status labels below are retained as a sub-field.

**Status today: every integration is `NOT STARTED`.** CIVORA has no agreement or access with any institution or provider listed below. "Public documentation" refers to publicly available third-party API documentation. **None was found for any government system [U].**

**Feasibility scale:**
- **H** — achievable by commercial agreement within ~3–6 months
- **M** — needs an institutional partner and formal authorisation, ~6–18 months
- **L** — depends on policy decisions or mandates outside CIVORA's control, >18 months or uncertain
- **✕** — do not pursue

**Target status** is what the integration becomes once its prerequisites are met. Earliest timing is an [A] estimate.

## 12.1 Identity, trust and documents

| ID | Integration | Owner | Module | Public docs | Access model | Legal / formal prerequisites | Feasibility | Target status | Earliest [A] | Class (1–6) |
|---|---|---|---|---|---|---|---|---|---|---|
| I-01 | Mobile ID / e-Houwiya authentication (relying party) | MinCom; ANCE/TunTrust PKI [P][S5] | A, L1 | No [U] | Agreement with MinCom/ANCE (model unknown) | Confirm legal basis for private relying parties (counsel Q5); INPDP declarations | **M–L** | AUTHORIZATION REQUIRED | M9–M18 | 3 |
| I-02 | TunTrust certificates & e-signature services | ANCE/TunTrust [V][S36] | A, D, L1 | Commercial products; API docs to obtain [U] | Commercial contract | Law 2000-83 compliance; use-case legal effect mapping | **H** | COMMERCIALLY AVAILABLE | M3–M6 | 3 |
| I-03 | Qualified time-stamping for audit anchors | ANCE/TunTrust [A] | L | To verify [U] | Commercial | — | **H–M** | COMMERCIALLY AVAILABLE | M6 | 3 |
| I-04 | Identity-verification vendor (OCR, liveness, screening) | Private vendor (TBD) | A, L1 | Yes (vendor docs) | Commercial; prefer in-country processing or no-retention mode | INPDP declaration; transfer authorisation if vendor processes abroad | **H** | COMMERCIALLY AVAILABLE | M4–M8 | 3 |
| I-05 | Unique Citizen Identifier (IUC) register | MoI [P][S5] | A | No | Legal mandate only | Specific legal basis; public-body membership | **✕ / L** | DO NOT PURSUE (directly) | — | 6 |
| I-06 | Biometric CIN chip authentication | MoI | A | Not published [U] | Future national scheme | Organic Law 22/2024 implementing rules [P][S10] | **L** | BLOCKED (not launched) | 2027+ | 5 |
| I-07 | Online birth-extract QR verification | MoI / e-Bawaba [P][S15] | B, D | Verification method not documented [U] | Public verification only if an official endpoint exists | Terms of use | **M** | AUTHORIZATION REQUIRED | M6–M12 | 3 |

## 12.2 Interoperability and registries

| ID | Integration | Owner | Module | Public docs | Access model | Legal / formal prerequisites | Feasibility | Target status | Earliest [A] | Class (1–6) |
|---|---|---|---|---|---|---|---|---|---|---|
| X-01 | National interoperability platform (UXP) — as technical provider of a member institution | MinCom; CNI operator [V][S22][P][S5] | K, all | UXP protocol is vendor-documented; national onboarding rules not public [U] | Through the member's security server | Decree-law 2020-31 & decrees [P][S9]; member agreement | **M** | AUTHORIZATION REQUIRED | M12–M18 | 3 |
| X-02 | Civil registry (Madania) status/records via UXP | MoI | B | No | Via authorised member only | MoI service agreement | **L** | AUTHORIZATION REQUIRED | M18+ | 3 |
| X-03 | RNE (company registry) via UXP Phase 2 | RNE [V][S23] | L1 (KYB) | No | Via member / public service | Phase 2 rollout | **M–L** | AUTHORIZATION REQUIRED | M18+ | 3 |
| X-04 | Dalil procedures content | Presidency of Government [P][S27] | J, catalogue | Not published as API/open data [U] | Permission / licence or official partnership | Content reuse terms | **M** | AUTHORIZATION REQUIRED (until then: manual curation from public pages) | M4–M9 | 3 |
| X-05 | Khadamet (supply components or deep-links) | MinCom [P][S18] | I, K | No | Deep-links: none needed; components: contract | Procurement | **M** | NOT STARTED | M9–M18 | 5 |
| X-06 | Open data portal(s) | Government [A — verify portal and licence] | J | To verify [U] | Open licence | Licence terms | **H** if exists | NOT STARTED | M1–M3 | 3 |

## 12.3 Health

| ID | Integration | Owner | Module | Public docs | Access model | Legal / formal prerequisites | Feasibility | Target status | Earliest [A] | Class (1–6) |
|---|---|---|---|---|---|---|---|---|---|---|
| H-01 | National health ID / shared medical record / Sahetna.tn | MoH [P][S67][S68] | C | No | MoH partnership | INPDP authorisation; MoH agreement; hosting in Tunisia | **L** | AUTHORIZATION REQUIRED | M24+ | 5 |
| H-02 | Telemedicine platform authorisation (CIVORA as platform provider) | MoH [P][S48][S49] | C | Arrêté lists dossier requirements [P][S49] | Authorisation per decree | MoH authorisation + INPDP; ≥10-yr retention; hosting in Tunisia | **M** | AUTHORIZATION REQUIRED | M18–M30 | 3 |
| H-03 | Private clinic EHR systems (FHIR or HL7 v2 if available) | Private clinics | C | Vendor-specific [U] | Commercial | Clinic as controller; INPDP authorisation | **M** | NOT STARTED | M18+ | 3 |
| H-04 | PNDN birth declaration events | MoH [P][S70] | B, C | No | MoH agreement | — | **L** | AUTHORIZATION REQUIRED | M24+ | 5 |

## 12.4 Social security, finance, education, transport

| ID | Integration | Owner | Module | Public docs | Access model | Legal / formal prerequisites | Feasibility | Target status | Earliest [A] | Class (1–6) |
|---|---|---|---|---|---|---|---|---|---|---|
| S-01 | CNAM reimbursement status | CNAM [P][S62] | F | No | Via fund (UXP or direct) | Fund agreement; INPDP | **M–L** | AUTHORIZATION REQUIRED | M18+ | 3 |
| S-02 | CNSS contributions/affiliation | CNSS [P][S63] | F | No | Via fund | Fund agreement | **M–L** | AUTHORIZATION REQUIRED | M18+ | 3 |
| S-03 | CNRPS pension data | CNRPS [P][S65] | F | No | Via fund | Fund agreement | **L** | AUTHORIZATION REQUIRED | M24+ | 3 |
| F-01 | Card payments (ClicToPay / SMT) | SMT [P] | E | Merchant docs on contract [A] | Merchant agreement via bank | Merchant onboarding | **H** | COMMERCIALLY AVAILABLE | M6–M9 | 3 |
| F-02 | e-Dinar / D17 wallet payments | La Poste [P][S72] | E | To obtain [U] | Merchant agreement | — | **H–M** | COMMERCIALLY AVAILABLE | M6–M12 | 3 |
| F-03 | Licensed PSPs / payment institutions | Private PSPs | E | Usually yes [A] | Commercial | BCT-licensed counterpart | **H** | COMMERCIALLY AVAILABLE | M6 | 3 |
| F-04 | Tax / fines authoritative data | MoF / MoI | E, H | No | Via authorised member | Agreements | **L** | AUTHORIZATION REQUIRED | M24+ | 5 |
| E-01 | Private university diploma issuance (VC) | Private universities | G, D | N/A (CIVORA provides) | Commercial | Institution as issuer; diploma rules [A] | **H** | NOT STARTED | M9–M12 | 3 |
| E-02 | Public school/university registration & results | Ministries of Education [P][S24][S73] | G | No | Ministry agreement | — | **L** | AUTHORIZATION REQUIRED | M24+ | 5 |
| T-01 | Vehicle, licence and inspection data | ATTT / MoI | H | No | Ministry agreement | — | **L** | AUTHORIZATION REQUIRED | M24+ | 5 |

## 12.5 Messaging and infrastructure

| ID | Integration | Owner | Module | Public docs | Access model | Legal / formal prerequisites | Feasibility | Target status | Earliest [A] | Class (1–6) |
|---|---|---|---|---|---|---|---|---|---|---|
| M-01 | SMS (A2P) via operators/aggregators | Tunisie Telecom, Ooredoo, Orange, aggregators | Notifications | Commercial | Contract | Sender ID registration [A] | **H** | COMMERCIALLY AVAILABLE | M3–M6 | 3 |
| M-02 | Email delivery (in-country or compliant provider) | Provider | Notifications | Yes | Contract | No personal data abroad unless authorised | **H** | COMMERCIALLY AVAILABLE | M3 | 3 |
| M-03 | Push notifications (APNs/FCM) | Apple/Google | Notifications | Yes | Developer accounts | Payload minimisation (no personal content) | **H** | COMMERCIALLY AVAILABLE | M3 | 3 |
| C-01 | G-Cloud/N-Cloud labelled hosting | Labelled providers (e.g. 3S, EO Data Center labelled Jul 2024) [P][S45] | All | Commercial | Contract | ANCS label scheme [P][S43] | **H** | COMMERCIALLY AVAILABLE | M4–M6 | 3 |
| C-02 | CNI hosting for public clients | CNI | All | No | Via public client | Circular 5/2026 [P][S46] | **M** | AUTHORIZATION REQUIRED | M12+ | 3 |

## 12.6 Explicitly excluded ("DO NOT PURSUE")

| Practice | Reason |
|---|---|
| Scraping or automating government portals with citizens' credentials | Terms-of-use breach; possible offence under cybercrime rules [V][S50]; security and trust risk |
| Storing citizens' government passwords or Mobile ID PINs | Credential custody risk; violates authentication principles |
| Direct access to IUC, civil registry or police databases without a statutory mandate | Unlawful; contrary to IUC framework [P][S6] |
| Creating or retaining biometric templates | Disproportionate risk; not needed for CIVORA's role |
| Building a CIVORA-owned national health record | Duplicates MoH programme [P][S68]; legally and ethically unjustified |
| Presenting simulated integrations as live | Misrepresentation; violates the execution rules of the brief |

## 12.7 What CIVORA can deliver before any government integration

1. **CIVORA Guide** on public, manually curated official content: H, M1–M6.
2. **Workspace** deployed for a contracting institution on *its own* data (cases created in Workspace, not fetched from registries): H once contracted.
3. **Trust (L1)** with commercial integrations I-02, I-04, F-01..F-03, M-01..M-03 and C-01.
4. **Verifiable diplomas** for private universities (E-01).

Together these form the commercially feasible core for the first 18 months. Everything else is pursued in parallel through partnerships and is shown as `SIMULATED` in demos.
