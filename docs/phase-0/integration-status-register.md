# Integration Status Register

The brief requires a documented list of **completed, incomplete, simulated and blocked** integrations. This register is the single source of truth. It must be updated with every change, and every status change requires evidence: an agreement reference, test report or approval.

**As of 18 November 2026 (updated in Phase 1 v2.0 with the directive's six-class scheme: 1 verified official, 2 authorized partner, 3 technically possible but not authorized, 4 independent prototype, 5 future opportunity, 6 not currently feasible):**

| Category | Count | Items |
|---|---|---|
| Completed (live, authorised) | **0** | — |
| Incomplete (in progress) | **0** | — |
| Simulated / independent prototype | **1** | P-01 Government-track clickable prototype (synthetic data, no real connections) |
| Blocked | **1** | I-06 Biometric CIN chip authentication (national scheme not launched) |
| Do not pursue | **1** | I-05 Direct IUC register access |
| Not started | **33** | All other items below (36 entries in total, incl. 3 first-product integrations and 1 prototype added in Phase 1) |

## Register

Status values:
- `NOT STARTED`
- `SIMULATED` (simulator built, no real connection)
- `IN NEGOTIATION`
- `SANDBOX` (connected to a partner test environment)
- `AUTHORIZED` (live, with agreement)
- `BLOCKED`
- `DO NOT PURSUE`

| ID | Integration | Owner | Current status | Directive class (1–6) | Target status | Agreement ref. | Evidence | Last updated |
|---|---|---|---|---|---|---|---|---|
| I-01 | Mobile ID / e-Houwiya (relying party) | MinCom / ANCE | SIMULATED (generic national-eID simulator with synthetic identities; no real connection; scheme open, Q3-2) | 3 | AUTHORIZED | — | [Phase 3 doc 06](../phase-3/06-simulated-eid-identity-links.md) | 2026-11-21 |
| I-02 | TunTrust certificates & e-signature | ANCE/TunTrust | NOT STARTED | 3 | AUTHORIZED (commercial) | — | — | 2026-11-18 |
| I-03 | Qualified time-stamping | ANCE/TunTrust | NOT STARTED | 3 | AUTHORIZED (commercial) | — | — | 2026-11-18 |
| I-04 | Identity-verification vendor | Private vendor (TBD) | NOT STARTED | 3 | AUTHORIZED (commercial) | — | — | 2026-11-18 |
| I-05 | IUC register | MoI | DO NOT PURSUE | 6 | — | — | Section 12.6 | 2026-11-18 |
| I-06 | Biometric CIN authentication | MoI | BLOCKED (not launched) | 5 | AUTHORIZED (future) | — | [P][S12][S13] | 2026-11-18 |
| I-07 | Birth-extract QR verification | MoI / e-Bawaba | NOT STARTED | 3 | AUTHORIZED | — | — | 2026-11-18 |
| X-01 | UXP (as provider for member institution) | MinCom / CNI | NOT STARTED | 3 | AUTHORIZED | — | — | 2026-11-18 |
| X-02 | Civil registry via UXP | MoI | NOT STARTED | 3 | AUTHORIZED | — | — | 2026-11-18 |
| X-03 | RNE via UXP | RNE | NOT STARTED | 3 | AUTHORIZED | — | — | 2026-11-18 |
| X-04 | Dalil procedures content | Presidency of Government | NOT STARTED | 3 | AUTHORIZED (licence) | — | — | 2026-11-18 |
| X-05 | Khadamet components / deep-links | MinCom | NOT STARTED | 5 | AUTHORIZED (contract) | — | — | 2026-11-18 |
| X-06 | Open data portal | Government | NOT STARTED | 3 | AUTHORIZED (open licence) | — | — | 2026-11-18 |
| H-01 | National health ID / shared record / Sahetna | MoH | NOT STARTED | 5 | AUTHORIZED | — | — | 2026-11-18 |
| H-02 | Telemedicine platform authorisation | MoH | NOT STARTED | 3 | AUTHORIZED | — | — | 2026-11-18 |
| H-03 | Private clinic EHR | Private clinics | NOT STARTED | 3 | AUTHORIZED (contract) | — | — | 2026-11-18 |
| H-04 | PNDN birth declaration events | MoH | NOT STARTED | 5 | AUTHORIZED | — | — | 2026-11-18 |
| S-01 | CNAM reimbursement status | CNAM | NOT STARTED | 3 | AUTHORIZED | — | — | 2026-11-18 |
| S-02 | CNSS contributions/affiliation | CNSS | NOT STARTED | 3 | AUTHORIZED | — | — | 2026-11-18 |
| S-03 | CNRPS pension data | CNRPS | NOT STARTED | 3 | AUTHORIZED | — | — | 2026-11-18 |
| F-01 | Card payments (ClicToPay/SMT) | SMT / bank | NOT STARTED | 3 | AUTHORIZED (commercial) | — | — | 2026-11-18 |
| F-02 | e-Dinar / D17 | La Poste | NOT STARTED | 3 | AUTHORIZED (commercial) | — | — | 2026-11-18 |
| F-03 | Licensed PSPs | Private PSPs | NOT STARTED | 3 | AUTHORIZED (commercial) | — | — | 2026-11-18 |
| F-04 | Tax / fines authoritative data | MoF / MoI | NOT STARTED | 5 | AUTHORIZED | — | — | 2026-11-18 |
| E-01 | Private university diplomas (VC issuance) | Universities | NOT STARTED | 3 | AUTHORIZED (contract) | — | — | 2026-11-18 |
| E-02 | Public education registration/results | Ministries of Education | NOT STARTED | 5 | AUTHORIZED | — | — | 2026-11-18 |
| T-01 | Vehicle/licence/inspection data | ATTT / MoI | NOT STARTED | 5 | AUTHORIZED | — | — | 2026-11-18 |
| M-01 | SMS (A2P) | Operators / aggregators | NOT STARTED | 3 | AUTHORIZED (commercial) | — | — | 2026-11-18 |
| M-02 | Email delivery | Provider | NOT STARTED | 3 | AUTHORIZED (commercial) | — | — | 2026-11-18 |
| M-03 | Push notifications | Apple / Google | NOT STARTED | 3 | AUTHORIZED (commercial) | — | — | 2026-11-18 |
| C-01 | G-Cloud/N-Cloud labelled hosting | Labelled providers | NOT STARTED | 3 | AUTHORIZED (commercial) | — | — | 2026-11-18 |
| C-02 | CNI hosting for public clients | CNI | NOT STARTED | 3 | AUTHORIZED | — | — | 2026-11-18 |
| W-01 | Customer SSO (SAML/OIDC) for Workspace RF | Each customer institution | NOT STARTED | 3 | AUTHORIZED (contract) | — | Phase 1 PRD FR-50 | 2026-11-18 |
| W-02 | Core-banking / CRM read-only lookup adapter | Each customer institution | NOT STARTED | 3 | AUTHORIZED (contract) | — | Phase 1 PRD FR-52 | 2026-11-18 |
| W-03 | e-KYC partner vendors (e.g. Avatar-ID, Kaoun/NGSIGN) | Private vendors | NOT STARTED | 3 | AUTHORIZED (partnership) | — | Phase 1 P1-D8; S135, S136 | 2026-11-18 |
| P-01 | Government-track clickable prototype (synthetic data, simulated adapters) | CIVORA | BUILT (prototype) | 4 | — | — | design/prototype/index.html | 2026-11-18 |

## Change log

| Date | ID | From → To | Evidence | Approved by |
|---|---|---|---|---|
| 2026-11-18 | all | (new) → initial statuses | Phase 0 report | Pending founder review |
| 2026-11-18 | all | Directive class column added; W-01..W-03 and P-01 added | Phase 1 v2.0 (C6) | Pending P1-D6 |
