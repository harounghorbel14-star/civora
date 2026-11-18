# Integration Status Register

The brief requires a documented list of **completed, incomplete, simulated and blocked** integrations. This register is the single source of truth. It must be updated with every change, and every status change requires evidence: an agreement reference, test report or approval.

**As of 18 November 2026 (end of Phase 0 desk research):**

| Category | Count | Items |
|---|---|---|
| Completed (live, authorised) | **0** | — |
| Incomplete (in progress) | **0** | — |
| Simulated (built as simulator) | **0** | No code exists yet |
| Blocked | **1** | I-06 Biometric CIN chip authentication (national scheme not launched) |
| Do not pursue | **1** | I-05 Direct IUC register access |
| Not started | **30** | All other items below (32 integrations in total) |

## Register

Status values:
- `NOT STARTED`
- `SIMULATED` (simulator built, no real connection)
- `IN NEGOTIATION`
- `SANDBOX` (connected to a partner test environment)
- `AUTHORIZED` (live, with agreement)
- `BLOCKED`
- `DO NOT PURSUE`

| ID | Integration | Owner | Current status | Target status | Agreement ref. | Evidence | Last updated |
|---|---|---|---|---|---|---|---|
| I-01 | Mobile ID / e-Houwiya (relying party) | MinCom / ANCE | NOT STARTED | AUTHORIZED | — | — | 2026-11-18 |
| I-02 | TunTrust certificates & e-signature | ANCE/TunTrust | NOT STARTED | AUTHORIZED (commercial) | — | — | 2026-11-18 |
| I-03 | Qualified time-stamping | ANCE/TunTrust | NOT STARTED | AUTHORIZED (commercial) | — | — | 2026-11-18 |
| I-04 | Identity-verification vendor | Private vendor (TBD) | NOT STARTED | AUTHORIZED (commercial) | — | — | 2026-11-18 |
| I-05 | IUC register | MoI | DO NOT PURSUE | — | — | Section 12.6 | 2026-11-18 |
| I-06 | Biometric CIN authentication | MoI | BLOCKED (not launched) | AUTHORIZED (future) | — | [P][S12][S13] | 2026-11-18 |
| I-07 | Birth-extract QR verification | MoI / e-Bawaba | NOT STARTED | AUTHORIZED | — | — | 2026-11-18 |
| X-01 | UXP (as provider for member institution) | MinCom / CNI | NOT STARTED | AUTHORIZED | — | — | 2026-11-18 |
| X-02 | Civil registry via UXP | MoI | NOT STARTED | AUTHORIZED | — | — | 2026-11-18 |
| X-03 | RNE via UXP | RNE | NOT STARTED | AUTHORIZED | — | — | 2026-11-18 |
| X-04 | Dalil procedures content | Presidency of Government | NOT STARTED | AUTHORIZED (licence) | — | — | 2026-11-18 |
| X-05 | Khadamet components / deep-links | MinCom | NOT STARTED | AUTHORIZED (contract) | — | — | 2026-11-18 |
| X-06 | Open data portal | Government | NOT STARTED | AUTHORIZED (open licence) | — | — | 2026-11-18 |
| H-01 | National health ID / shared record / Sahetna | MoH | NOT STARTED | AUTHORIZED | — | — | 2026-11-18 |
| H-02 | Telemedicine platform authorisation | MoH | NOT STARTED | AUTHORIZED | — | — | 2026-11-18 |
| H-03 | Private clinic EHR | Private clinics | NOT STARTED | AUTHORIZED (contract) | — | — | 2026-11-18 |
| H-04 | PNDN birth declaration events | MoH | NOT STARTED | AUTHORIZED | — | — | 2026-11-18 |
| S-01 | CNAM reimbursement status | CNAM | NOT STARTED | AUTHORIZED | — | — | 2026-11-18 |
| S-02 | CNSS contributions/affiliation | CNSS | NOT STARTED | AUTHORIZED | — | — | 2026-11-18 |
| S-03 | CNRPS pension data | CNRPS | NOT STARTED | AUTHORIZED | — | — | 2026-11-18 |
| F-01 | Card payments (ClicToPay/SMT) | SMT / bank | NOT STARTED | AUTHORIZED (commercial) | — | — | 2026-11-18 |
| F-02 | e-Dinar / D17 | La Poste | NOT STARTED | AUTHORIZED (commercial) | — | — | 2026-11-18 |
| F-03 | Licensed PSPs | Private PSPs | NOT STARTED | AUTHORIZED (commercial) | — | — | 2026-11-18 |
| F-04 | Tax / fines authoritative data | MoF / MoI | NOT STARTED | AUTHORIZED | — | — | 2026-11-18 |
| E-01 | Private university diplomas (VC issuance) | Universities | NOT STARTED | AUTHORIZED (contract) | — | — | 2026-11-18 |
| E-02 | Public education registration/results | Ministries of Education | NOT STARTED | AUTHORIZED | — | — | 2026-11-18 |
| T-01 | Vehicle/licence/inspection data | ATTT / MoI | NOT STARTED | AUTHORIZED | — | — | 2026-11-18 |
| M-01 | SMS (A2P) | Operators / aggregators | NOT STARTED | AUTHORIZED (commercial) | — | — | 2026-11-18 |
| M-02 | Email delivery | Provider | NOT STARTED | AUTHORIZED (commercial) | — | — | 2026-11-18 |
| M-03 | Push notifications | Apple / Google | NOT STARTED | AUTHORIZED (commercial) | — | — | 2026-11-18 |
| C-01 | G-Cloud/N-Cloud labelled hosting | Labelled providers | NOT STARTED | AUTHORIZED (commercial) | — | — | 2026-11-18 |
| C-02 | CNI hosting for public clients | CNI | NOT STARTED | AUTHORIZED | — | — | 2026-11-18 |

## Change log

| Date | ID | From → To | Evidence | Approved by |
|---|---|---|---|---|
| 2026-11-18 | all | (new) → initial statuses | Phase 0 report | Pending founder review |
