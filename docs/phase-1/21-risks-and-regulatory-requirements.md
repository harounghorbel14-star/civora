# 21. Risks and Regulatory Requirements

This document **extends** the Phase 0 risk register ([../phase-0/17-risk-assessment.md](../phase-0/17-risk-assessment.md), R1–R24) and the legal analysis ([../phase-0/11-legal-regulatory-analysis.md](../phase-0/11-legal-regulatory-analysis.md)). It does not repeat them. **Nothing here is legal advice.**

## 21.1 New and re-rated risks (Phase 1)

Scale: L = likelihood, I = impact, both 1–5. Score = L × I.

| ID | Risk | L | I | Score | Mitigation | Owner |
|---|---|---|---|---|---|---|
| R25 | **Horizontal CRM/help-desk incumbents** (global suites, banking-software modules) win on price or bundling | 4 | 4 | **16** | Regulation-native features; Tunisian hosting; Arabic/French; target segments with weak tooling (payment providers, microfinance); partner with integrators | CEO |
| R26 | **Banks already equipped** after 2022 → low replacement demand | 3 | 4 | 12 | Discovery measures satisfaction; kill/pivot criteria ([10](10-first-product-recommendation.md) §10.7); insurance/telecom editions as fallback | CEO |
| R27 | **Strict roadmap order delays revenue** (first production pilot only in Phase 13) | 4 | 3 | 12 | Light passes for phases not needed by the first product (P1-D4); paid sandbox design partners; staged funding | CTO |
| R28 | **Focus dilution across six divisions** | 3 | 4 | 12 | Division activation gate ([04](04-business-division-strategy.md) §4.3); max one build track + one pipeline track | CEO |
| R29 | **Local e-KYC incumbents** make Identity standalone unattractive | 4 | 2 | 8 | Partner/integrate instead of build (P1-D8) | CEO |
| R30 | **BCT outsourcing / IT-risk rules** restrict SaaS use by banks or impose heavy approval | 3 | 4 | 12 | Counsel question Q13; on-premises licence option; Tunisian labelled hosting | Counsel |
| R31 | **Banking secrecy** limits what a processor may access (support, logs) | 3 | 3 | 9 | In-country support; no vendor access to case content by default; break-glass with customer approval and logging (Phase 0 §8.4) | CISO |
| R32 | **Complaint data misuse risk** (e.g. pressure to reuse data for marketing or benchmarking) | 2 | 4 | 8 | Contract clauses; no cross-tenant analytics; Charter | CEO |
| R33 | **Brand collision in Arabic** (سيفورا = Sephora's Arabic brand) | 4 | 3 | 12 | D12 decision before brand spend; trademark clearance ([supporting/brand-identity.md](supporting/brand-identity.md)) | Founder |
| R1 (re-rated) | State builds in-house what CIVORA offers | 4 | 3 | 12 | (was 20) First product is B2B, which reduces exposure. Government track stays complementary | CEO |
| R2 (re-rated) | Long procurement / late payment | 3 | 4 | 12 | (was 20) B2B first; donor-funded B2G | CEO |

## 21.2 Regulatory requirements by division

| Division | Key instruments (Tunisia) | Requirements for CIVORA | Evidence |
|---|---|---|---|
| **B — Enterprise (first product)** | BCT Circular 2022-08 (complaint handling); Law 2016-48 (banks and financial institutions, incl. Art. 82 basis cited by the circular); Decree 2006-1881 (banking mediator); BCT e-KYC and payment-institution circulars (2025-06, 2026-10); Law 2004-63 (data protection); Decree-law 2023-17 (cybersecurity) | Product must support the reported obligations: first-level handling, customer information, reasoned rejections, dedicated IT system, correspondent, annual board report. Processor agreements; Tunisian hosting or on-prem; security audits; vendor audits by customers | [P][S141][S142]; Phase 0 S39, S51, S53 |
| **A — Government** | Law 2004-63; decree-law 2020-31 and implementing decrees; Circular 5/2026 (hosting); Cloud First / G-Cloud labels; procurement Decree 2014-1039 | As Phase 0 §11; hosting on CNI / sectoral centres / licensed operators; procurement compliance | Phase 0 S9, S42–S46, S54 |
| **C — Health** | Law 2004-63 (health data authorisation by INPDP); Decree 2022-318 + arrêtés of June 2024 (telemedicine); medical secrecy | MoH authorisation + INPDP before real data; hosting in Tunisia; ≥ 10-year retention for telemedicine | Phase 0 S33, S48, S49 |
| **D — Identity** | Law 2000-83 (e-signature, ANCE); IUC framework (2020); Organic Laws 22 & 23 of 2024 (biometric documents); BCT e-KYC rules | No identity issuance; no IUC processing without legal basis; no biometric template retention; relying-party authorisation for Mobile ID | Phase 0 S6, S7, S10, S36, S51 |
| **E — AI** | Tunisia AI strategy 2026–2030 (no binding AI statute identified); EU AI Act for EU markets; Law 2004-63 for personal data in prompts | Citations; no eligibility or rights decisions; transparency notices; in-country models for personal data | Phase 0 S31; Regulation (EU) 2024/1689 |
| **F — Connect** | Decree-law 2020-31 and decrees on data exchange; UXP membership rules | Integrate only via members' security servers; no independent access to registries | Phase 0 S9, S22 |

## 21.3 Data-domain access policies (directive §11)

| Domain | Who may access | Default retention | Special controls |
|---|---|---|---|
| **Financial** (complaints, account references) | Institution staff by role and scope; CIVORA support only via break-glass with customer approval | Per institution policy and banking rules [A — counsel Q15] | Field-level encryption of identifiers; tenant keys; no cross-tenant analytics |
| **Government** | Institution staff; citizen sees own data and access log | Per public-archives rules [A] | Hosting per Circular 5/2026; citizen-visible access log |
| **Identity** | Minimal: system processes; auditors | Per legal basis | Separate keys; no biometric templates |
| **Health** | Treating professionals with consent; break-glass with review | ≥ 10 years for telemedicine | Separate deployable; T0 controls; MoH + INPDP authorisation |

## 21.4 Additional questions for Tunisian counsel (extending Phase 0 §11.10, Q1–Q12)

| # | Question |
|---|---|
| Q13 | Do BCT rules on outsourcing, IT risk or cloud use require banks, financial institutions or payment institutions to notify or obtain approval before using a SaaS provider for complaint handling? Are there hosting-location requirements specific to banking data? |
| Q14 | What is the full text of BCT Circular 2022-08 and any amendments: deadlines, admissibility, report contents, record-keeping? |
| Q15 | What retention periods apply to complaint files and correspondence for banks and financial institutions? |
| Q16 | How does banking secrecy (Law 2016-48) apply to a processor's staff for support and incident handling? |
| Q17 | Do insurers (CGA supervision) and telecom operators (INT regulation) have equivalent complaint-handling obligations? (Expansion editions) |
| Q18 | Can a design-partner programme use anonymised complaint samples? What anonymisation standard does INPDP accept? |

## 21.5 Vendor risk management (directive §11)

Third-party providers in the first product must be in-country or approved, with DPAs and exit plans:
- SMS gateways
- email relay
- hosting provider
- malware scanning
- PDF generation libraries

Future vendors (e-KYC partners, LLM providers) are assessed under the same policy. The Phase 0 rule stands: **no personal data to foreign services without lawful basis and authorisation.**
