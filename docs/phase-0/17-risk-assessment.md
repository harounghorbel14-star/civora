# 17. Risk Assessment

Scale: Likelihood (L) and Impact (I) from 1 (low) to 5 (very high); Score = L × I. Scores ≥ 15 are **critical** and reviewed monthly by the founder. This register is the initial version and becomes a living document.

## 17.1 Risk register

| ID | Category | Risk | L | I | Score | Mitigation | Early-warning indicator | Owner |
|---|---|---|---|---|---|---|---|---|
| R1 | Strategic | **State builds in-house what CIVORA offers.** This is already observed: Khadamet, e-Bawaba, Sahetna, UXP [P][S18][S22][S68] | 5 | 4 | **20** | Position as supplier/partner; sell components and back-office (Workspace) and B2B (L1); avoid competing front doors | New government platform announcements overlapping roadmap | CEO |
| R2 | Commercial | **Long procurement cycles / late payment** [P][S115] | 5 | 4 | **20** | L1 recurring revenue; donor-funded contracts; milestone billing; working-capital buffer ≥ 6 months | Pipeline age > 9 months; receivables > 90 days | CEO / Finance |
| R3 | Funding | **Unable to raise sufficient capital** in a difficult macro and VC environment | 4 | 5 | **20** | Staged raises; Lean plan as default; non-dilutive sources; customer-funded pilots | Runway < 9 months | CEO |
| R4 | Access | **No access to authoritative data/APIs**; integrations remain blocked | 5 | 3 | **15** | Value proposition that works without registry access (Guide, Workspace on own data, L1); simulated adapters; partner-led authorisation | No authorised integration by M18 | CTO / Gov relations |
| R5 | Security | **Serious security breach** (e.g. KYC evidence, case data) | 2 | 5 | 10 | Security-by-design (Section 10); audits; pen tests; least privilege; no T0 data until authorised; incident response; cyber insurance | Critical vulnerabilities open > SLA; anomaly alerts | CISO |
| R6 | AI | **Guide gives wrong or outdated procedural information**, causing citizen harm | 3 | 4 | 12 | RAG-only with citations; last-verified dates; refusal thresholds; golden-set gates; human review; correction SLA; disclaimers; liability insurance | Accuracy < 95% on golden set; user error reports | AI lead |
| R7 | Trust / political | **Public or civil-society backlash** over privacy or surveillance, as seen around biometric ID and the unique identifier [V][S8][S11] | 3 | 5 | **15** | Citizen Data Charter; minimal data; no centralisation; transparency reports; early engagement with INPDP and civil society; independent advisory board | Negative press; NGO statements | CEO |
| R8 | Political | **Policy reversals, ministerial turnover, institutional restructuring** | 4 | 3 | 12 | Relationships at technical-director level; donor-anchored projects; multi-institution pipeline | Sponsor change | Gov relations |
| R9 | Legal | **Regulatory change**, e.g. the new data-protection law (095/2025) imposing new duties [P][S34]; hosting circulars [P][S46] | 4 | 3 | 12 | Design to GDPR-level standard now; deployable on client hosting; legal watch | New circulars / laws | DPO / Legal |
| R10 | Legal | **Misrepresentation of official status** by staff, partners or media | 2 | 5 | 10 | Communication policy; approval workflow for external claims; demo banners; partner contract clauses | Media misquotes | CEO |
| R11 | Legal | **Liability for errors** in information, KYC decisions or workflows | 3 | 4 | 12 | Contracts allocate responsibilities (institution controls content and decisions); professional indemnity insurance; audit trails | Claims / complaints | Legal |
| R12 | Talent | **Brain drain / retention**: senior engineers recruited by foreign remote employers | 4 | 4 | **16** | Above-median pay for key roles; equity (ESOP); mission; flexible work; career paths; documentation to reduce key-person dependency | Attrition > 15%/yr | CTO |
| R13 | Key person | **Founder or CTO unavailable** | 2 | 5 | 10 | Shared knowledge; documented decisions (ADRs); board/advisers; key-person insurance later | — | Board |
| R14 | Competition | **Large vendors** (European integrators, identity majors, Gulf champions) out-compete or bundle | 4 | 3 | 12 | Partner rather than fight; focus on language, sovereignty, cost, product modules; open standards | Lost bids reasons | CEO |
| R15 | Adoption | **Low Mobile ID adoption** limits authenticated digital journeys (~450k phone-linked IDs reported [P][S5]) | 4 | 3 | 12 | Assisted enrolment; delegation; multiple authentication paths; Guide needs no login | Share of users completing eID login | Product |
| R16 | Inclusion | **Exclusion of elderly, rural, low-literacy and disabled users** (16.9% aged 60+ [V][S77]) | 3 | 4 | 12 | Assisted mode; mandates; voice; WCAG 2.2 AA; user research with these groups; offline/low-bandwidth modes | Task-completion rates by segment | Design |
| R17 | Technology | **Vendor lock-in** (LLM provider, liveness vendor, hosting) | 3 | 3 | 9 | Model gateway; adapter interfaces; open formats; exit plans per vendor | Price changes; outages | CTO |
| R18 | Technology | **Over-engineering** delays MVP | 3 | 3 | 9 | Modular monolith; strict MVP scope; ADR discipline; time-boxed spikes | Sprint slippage > 20% | CTO |
| R19 | Macro / FX | **TND depreciation and FX controls** raise costs of foreign tools and complicate foreign revenue | 3 | 3 | 9 | Prefer local/open-source tools; FX clauses in foreign contracts; structure advice | FX moves > 10% | Finance |
| R20 | Integrity | **Corruption or conflict-of-interest exposure** in procurement | 2 | 5 | 10 | Anti-bribery policy; training; due diligence on partners/agents; donor sanctions compliance; whistle-blowing channel | Requests for facilitation | CEO |
| R21 | Operations | **Hosting capacity or reliability** at local providers / CNI | 3 | 4 | 12 | Two-site design; tested DR; capacity planning; host SLAs | Incidents at host | SRE |
| R22 | International | **Political instability or sanctions** in target markets (L3) | 3 | 4 | 12 | Market screening (Section 13.2); donor-backed contracts; insurance; human-rights due diligence | Country risk ratings | CEO |
| R23 | Brand | **Trademark conflict** on "CIVORA" (no search done yet [U]) | 3 | 3 | 9 | Clearance search before brand investment | Search results | Legal |
| R24 | Data | **Use of real personal data in development by mistake** | 2 | 4 | 8 | Synthetic data generators; DLP checks; policy and training; environment separation | DLP alerts | CISO |

## 17.2 Heat map (current)

| Impact ↓ / Likelihood → | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| **5** | | R5, R10, R13, R20 | R7 | R3 | |
| **4** | | R24 | R6, R11, R16, R21, R22 | R12 | R1, R2 |
| **3** | | | R17, R18, R19, R23 | R8, R9, R14, R15 | R4 |

## 17.3 Top-5 risk responses (first 90 days)

1. **R1 & R4:**
   - Validate the supplier positioning directly with MinCom, the reforms directorate and donors.
   - Map which components their programmes lack.
2. **R2 & R3:**
   - Run L1 customer discovery to obtain ≥2 paid pilot commitments.
   - Start the pre-seed raise with the Lean plan.
3. **R7:**
   - Publish a draft Citizen Data Charter.
   - Meet INPDP and two civil-society organisations for feedback.
4. **R12:** Define the compensation and ESOP policy before the first hires.
5. **R6:** Build the Guide's golden evaluation set before building the Guide.
