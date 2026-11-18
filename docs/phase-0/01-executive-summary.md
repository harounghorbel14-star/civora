# 1. Executive Summary

## 1.1 Bottom line

**CIVORA is viable as a company, but not in the form described in the master brief.** A privately owned "national super-app" that holds Tunisians' digital identity, civil records, health records and documents in one place is not feasible in Tunisia in 2026–2028. Three reasons, each verified below:

1. **The Tunisian state is already building that layer itself, and launched most of it in 2026.**
   - A national mobile digital identity (Mobile ID / *e-Houwiya*) has existed since 2022 [P][S1][S2].
   - A government citizen app, *Khadamet*, launched on Android on 31 August 2026 and on iPhone on 11 October 2026. It targets more than 40 services: civil status, social protection, tax and vehicle services, with payments [P][S18][S19][S20].
   - An X-Road-style national interoperability platform (UXP) has been delivered by Cybernetica of Estonia, funded by Switzerland [V][S22][S23]. It is operated nationally, with 86 interconnected services reported by December 2025 [P][S24].
   - The Ministry of Health is rolling out a unique health identifier, a shared medical record and the *Sahetna.tn* patient portal, with nationwide generalisation targeted for the end of 2026 [P][S67][S68][S69].

   A start-up competing head-on with these programmes would be competing with its most likely customer.
2. **The law reserves the core functions to the state and gates the rest behind authorisations.**
   - Legal identity, the unique citizen identifier and the civil registry are state registries [P][S6][S7].
   - Processing health data and transferring personal data abroad require prior authorisation from INPDP under Organic Law 2004-63 [P][S33].
   - Telemedicine data must be hosted in Tunisia [P][S48].
   - Since Circular 5/2026 of 2 September 2026, public websites and platforms must be hosted only at the national IT centre (CNI), sectoral public centres or licensed telecom operators [P][S46].
3. **Trust is the binding constraint, not technology.** Tunisian civil society has contested every recent centralising identity project: the biometric ID card, the unique identifier and Mobile ID [V][S4][S8][S11]. A private company that aggregated citizens' most sensitive data would face regulatory refusal and public opposition.

**Recommended repositioning:**

> **CIVORA builds the secure service-delivery infrastructure that governments and regulated institutions buy, and plugs into sovereign identity and data systems rather than replacing them.**

Concretely, CIVORA is a GovTech platform company (product + implementation). It sells to governments (B2G) and regulated businesses (B2B). It is designed from day one to deploy inside each country's sovereign infrastructure ("global core, country cells"). Tunisia is the reference market, not the revenue ceiling.

## 1.2 What changed between the brief and this report

| Brief assumption | Finding | Implication |
|---|---|---|
| CIVORA provides citizens' digital identity | The state already provides Mobile ID. A biometric ID card is legislated (Organic Laws 22 & 23 of 2024) but its launch keeps slipping [P][S10][S12][S13]. ~450k Mobile IDs are linked to phone numbers per a 2026 ID4Africa playbook (undated figure) [P][S5]. | CIVORA is a **relying party and integration layer** for national eIDs, never an identity issuer. Low Mobile ID adoption is a real problem CIVORA can help solve through enrolment journeys for institutions. |
| CIVORA unifies services in one citizen dashboard | *Khadamet* (gov app) and *e-Bawaba* (gov portal) already do this in Tunisia [P][S14][S18] | In Tunisia, the citizen dashboard is **not** CIVORA's product. It remains a white-label product for other countries and an assisted-channel tool for institutions. |
| CIVORA connects government databases | UXP national interoperability platform exists. Membership is for public bodies. CNI is reported as the national operator [V][S22][P][S5] | CIVORA builds **UXP-compatible adapters and back-office systems for member institutions**. It never builds its own data-exchange backbone. |
| CIVORA holds personal health records | The MoH is deploying a national health ID, shared record and *Sahetna.tn* [P][S67][S68] | Health is a **later, partnership-only** module: clinic-side consent, appointments and telemedicine tooling, plus international white-label. No CIVORA-held national health record. |
| AI assistant answers citizens' questions | Feasible now on **public** procedure content. ~3,200 procedures are being inventoried in the *Dalil* platform [P][S27] | **Strongest near-term wedge.** It uses no personal data, has clear value, and is demonstrable to government. |
| Revenue from B2G contracts | Procurement is slow, and payment delays to start-ups are a documented problem [P][S115]. A World Bank GovTech loan (US$100M, closes May 2027) funds parts of the agenda [V][S74] | Pair B2G with **B2B trust services**: e-KYC and e-signature orchestration for banks and payment institutions, driven by BCT Circulars 2025-06 and 2026-10 [P][S51][S53]. These have shorter sales cycles. |

## 1.3 Recommended strategy in one page

**Three business lines, sequenced:**

| Line | What it is | Who pays | When |
|---|---|---|---|
| **L1 — Trusted Digital Services (B2B)** | Identity-verification and e-signature orchestration hosted in Tunisia: document capture, liveness via a licensed vendor, TunTrust certificate signing [V][S36], consent and audit. National eID integration happens only where authorised. | Banks, payment institutions, insurers, telcos, private universities, clinics | Paid pilots from ~M10. Revenue from ~M13 |
| **L2 — Public Service Delivery Platform (B2G)** | Modular platform for institutions: services catalogue, case management, appointments, notifications, verifiable documents, consent and audit, plus an AI procedures assistant. Ships with UXP adapters and is deployed on CNI or G-Cloud-labelled hosting. | Ministries, agencies, municipalities. Donor-funded programmes (World Bank, SECO, EU, GIZ) and prime contractors | First services contract hypothesised ~M14–M18 |
| **L3 — International Country Cells** | The same platform packaged per country (language, law, identity standard, catalogue, hosting) and deployed sovereignly | Governments in Francophone / Arabic-speaking markets, often donor-financed | Earliest ~M24–M28 |

**Non-negotiables:**
- Citizens are never charged for essential services.
- CIVORA never sells or monetises personal or health data and carries no advertising.
- CIVORA never claims an official status it does not hold.
- CIVORA never accesses government systems without a signed authorisation.

## 1.4 MVP recommendation (details in Section 18)

Build an **independent prototype on synthetic data**, ~6 months with 6–8 people, that a ministry, a donor or a bank can see working. It covers:

1. AI procedures assistant (Arabic, Tunisian Derja, French, English) grounded only in public official sources, with citations.
2. Services catalogue and case management with appointments and status tracking, including an officer back office.
3. Citizen account using passkeys, plus a *simulated* national-eID adapter.
4. A verifiable-document wallet with QR verification. Credentials are synthetic.
5. Consent receipts and a citizen-visible access log.
6. An integration framework with UXP/X-Road, payment and SMS simulators.

**Excluded from the MVP:** real health records, real payments, real government data, biometric processing, and any claim of official status.

## 1.5 Financial headline (Section 15; all figures are [A] assumptions)

| Scenario | Team at M36 | Revenue Y1 / Y2 / Y3 (TND) | Peak cash need to M36 | Break-even |
|---|---|---|---|---|
| Lean | 10 | 30k / 275k / 0.70M | **2.28M TND (~US$0.77M)** | Not within 36 months. Needs ~2× the M36 revenue run-rate |
| Moderate | 29 | 66k / 1.03M / 2.84M | **6.88M TND (~US$2.32M)** | Not within 36 months. Needs ~1.8× the M36 run-rate |
| Enterprise | 54 | 0.36M / 3.73M / 10.19M | **9.93M TND (~US$3.34M)** | Not within 36 months. Needs ~1.4× the M36 run-rate. Depends on two international deployments |

These figures carry three caveats:
- **Revenue is hypothetical.** No contract exists, and none is assumed to be guaranteed.
- **If no B2G or international contract is won** (B2B only), peak need rises to 2.67M / 8.98M / 18.30M TND, and none of the scenarios is self-sustaining.
- **Realistic break-even for a GovTech company of this kind is Year 4–5.**

Tunisia alone supports a solid national business. Venture-scale outcomes require L3.

**Recommendation:** raise in stages tied to milestones rather than for 36 months at once.
- Pre-seed of ~1.0–1.2M TND (~US$0.34–0.40M), covering 15–18 months of the Lean plan: the MVP plus first paid pilots.
- Seed of ~4–6M TND once one B2G or donor contract and several B2B clients exist.
- Series A for international expansion.

## 1.6 Top risks (Section 17)

1. **The government builds in-house** (already observed) → sell components and services *to* those programmes; do not compete with them.
2. **Long procurement cycles and late payment** → fund the company through L1 B2B revenue and donor-funded subcontracting.
3. **No access to authoritative data** → design every module to work as a front-end and workflow layer with simulated adapters until access is authorised.
4. **Security incident or AI misinformation** → security-by-design, ANCS-compliant audits, citation-only AI with refusal policy.
5. **Trust and political risk** → a public Citizen Data Charter, minimal data retention, transparency reporting, and engagement with INPDP and civil society early.

## 1.7 Decisions required from the founder (full list in Section 21)

1. Approve the repositioning: infrastructure vendor and operator for sovereign systems, not an independent national super-app.
2. Approve the dual-track go-to-market: L1 B2B revenue first, L2 B2G pipeline in parallel.
3. Choose the funding path: staged Lean → Moderate is recommended.
4. Approve the MVP scope and the re-sequenced roadmap: AI assistant and services catalogue first, health later, security continuous.
5. Approve the corporate structure (Tunisian company + Startup Act label) and engagement of Tunisian counsel for the legal questions in Section 11.

**No implementation work will begin until these decisions are recorded.**
