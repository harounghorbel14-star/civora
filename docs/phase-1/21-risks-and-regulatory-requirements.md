# 21. Risks and Regulatory Requirements

This document **extends** the Phase 0 risk register ([../phase-0/17-risk-assessment.md](../phase-0/17-risk-assessment.md), R1–R24) and the legal analysis ([../phase-0/11-legal-regulatory-analysis.md](../phase-0/11-legal-regulatory-analysis.md)). It does not repeat them. **Nothing here is legal advice.**

## 21.1 New and re-rated risks (Phase 1)

Scale: L = likelihood, I = impact, both 1–5. Score = L × I.

| ID | Risk | L | I | Score | Mitigation | Owner |
|---|---|---|---|---|---|---|
| R25 | **Horizontal CRM/help-desk incumbents** (global suites, banking-software modules) win on price or bundling | 4 | 4 | **16** | Regulation-native features; Tunisian hosting; Arabic/French; target segments with weak tooling (leasing/factoring; payment institutions under their own rules); partner with integrators | CEO |
| R26 | **Banks already equipped** after 2022 → low replacement demand. *Re-rated 18 Nov 2026: the official text confirms compliance was due in 2023, so equipped banks are likely* | **4** | 4 | **16** | Discovery measures satisfaction; kill/pivot criteria ([10](10-first-product-recommendation.md) §10.7); insurance/telecom editions as fallback | CEO |
| R27 | **Protected roadmap delays revenue**: every phase keeps full scope (P1-D4), so the first production pilot comes only in Phase 13 (~M18 Moderate under the approved overlapping model; ~M23 if strictly sequential) | 4 | 4 | **16** | Overlapping independent activities (**approved**, P1-D4); paid sandbox design partners (P1-D5); staged funding sized for a longer pre-revenue period ([20](20-updated-financial-assumptions.md) §20.6) | CEO / CTO |
| R28 | **Focus dilution across six divisions** | 3 | 4 | 12 | Division activation gate ([04](04-business-division-strategy.md) §4.3); max one build track + one pipeline track | CEO |
| R29 | **Local e-KYC incumbents** make Identity standalone unattractive | 4 | 2 | 8 | Partner/integrate instead of build (P1-D8) | CEO |
| R30 | **BCT outsourcing / IT-risk rules** restrict SaaS use by banks or impose heavy approval. *Verified: Law 2016-48 Art. 81 requires informing the BCT before signing; one month of silence = acceptance* [V][S167] | 3 | 4 | 12 | Counsel Q13/Q-08; on-premises licence option; Tunisian labelled hosting; BCT access clause in contracts | Counsel |
| R31 | **Banking secrecy** limits what a processor may access (support, logs) | 3 | 3 | 9 | In-country support; no vendor access to case content by default; break-glass with customer approval and logging (Phase 0 §8.4) | CISO |
| R32 | **Complaint data misuse risk** (e.g. pressure to reuse data for marketing or benchmarking) | 2 | 4 | 8 | Contract clauses; no cross-tenant analytics; Charter | CEO |
| R33 | **Name conflicts**: CIVORA is reportedly a registered trademark of DKSR GmbH for a municipal urban-data platform (EU, same field). The Arabic transliteration سيفورا is Sephora's Arabic brand | 4 | 4 | **16** | No branding spend; attorney clearance; rename shortlist (KELORA, TELORA, NASAQ); decision P1-D13 ([supporting/brand-identity.md](supporting/brand-identity.md) §6.7) | Founder |
| R34 | **Score mistaken for demand**: the first product is chosen on desk evidence | 3 | 4 | 12 | Evidence gate E-01–E-07 before confirming P1-D3 or committing funding ([validation-evidence-register.md](validation-evidence-register.md)) | Founder |
| R35 | **Mis-scoped market** *(new, 18 Nov 2026)*: payment institutions were counted as subject to BCT 2022-08 but are excluded (Art. 1). The market under 2022-08 is 41 institutions (32 most relevant) [V][S159][S165] | 4 | 3 | 12 | Scope corrected; separate rule pack for payment institutions; E-01 sample re-balanced; Government and other sectors carry long-term scale | Founder |
| R36 | **Processor conditions** *(new)*: Law 2004-63 Art. 22 requires processors' agents to be Tunisian nationals, resident, with no criminal record [V][S168]. This constrains foreign hires, offshore support and international operations | 3 | 4 | 12 | Counsel opinion; staff-access model; country cells for Phase 15 | Founder + counsel |
| R37 | **Working capital** *(new)*: payment delays add ~0.9M TND (Moderate) to peak funding need; public-sector delays add more ([20](20-updated-financial-assumptions.md) §20.7.4) | 4 | 3 | 12 | Upfront annual billing where possible; implementation fees on signature; capture payment terms in E-03 | CEO |
| R38 | **Over-claiming compliance** *(new)*: marketing that suggests the product "makes institutions compliant" or is "BCT-approved" | 2 | 4 | 8 | Claim rule: "supports compliance with BCT Circular 2022-08"; no BCT logo or endorsement language; legal review of materials | Founder |
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

*Status 18 Nov 2026:* **Q14 is answered from the official text** ([validation/bct-regulatory-verification.md](validation/bct-regulatory-verification.md)). Q13 is partly answered (Law 2016-48 Art. 81). Q17 is partly answered (CGA Regulation 01/2023 exists; text not read). Follow-up questions:
- Q-06 to Q-11 in the BCT verification §8.
- The counsel items in the [legal verification matrix](validation/legal-regulatory-verification-matrix.md), notably Law 2004-63 Art. 22 and 52, Decree-law 2023-17 Art. 6–8, and the public-procurement status of state-owned banks.

## 21.5 Vendor risk management (directive §11)

Third-party providers in the first product must be in-country or approved, with DPAs and exit plans:
- SMS gateways
- email relay
- hosting provider
- malware scanning
- PDF generation libraries

Future vendors (e-KYC partners, LLM providers) are assessed under the same policy. The Phase 0 rule stands: **no personal data to foreign services without lawful basis and authorisation.**
