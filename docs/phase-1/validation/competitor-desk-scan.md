# Competitor Desk Scan — Complaint Management for Tunisian Financial Institutions

| | |
|---|---|
| Date | 18 November 2026 |
| Evidence item | E-05 (competitor validation), desk part. "Met" still requires incumbents identified at ≥ 10 institutions in interviews and ≥ 3 offers or prices |
| Extends | [08](../08-competitor-analysis.md) §8.1 (global help-desk SaaS and generic categories) |
| Labels | All findings are **[P]**: search results, vendor pages, procurement notices. Nothing was confirmed with the vendors or the institutions |

## 1. Most important finding: an active procurement at a target bank

| Item | Detail | Source |
|---|---|---|
| **STB, direct consultation CD 23/2026** | "Acquisition d'une solution ITSM, de supervision du parc IT et de **gestion des réclamations par tickets**". Scope reported to include dashboards and SLA/OLA management. A **postponement notice dated 9 Oct 2026** appears on the STB site, so the current status is unknown | [P][S186] |

**What it means:**
1. **Buying is happening.** A state-owned target bank (FI-06) is procuring complaint handling in 2026, more than three years after the compliance deadline. This **supports H-R6** (existing tooling is being replaced or upgraded).
2. **The competitor set includes ITSM / ticketing suites.** STB bundles complaints with IT service management. Products of that type (ServiceNow, Jira Service Management, GLPI and similar) [A] compete on "tickets + SLAs + dashboards".
3. **The procurement route is a consultation,** with a notice published on the bank's site. This is a data point for E-03 (procurement at state-owned banks, legal matrix 3.2).
4. **Timing risk.** If STB awards the contract before CIVORA has a product, STB is unlikely to switch within the contract term.

**Action for the founder:**
- Ask STB in the interview (wave 3, or bring STB forward to wave 1) about this consultation: scope, why bundled, criteria, timeline. **Do not bid**: CIVORA has no product (Phase 13 not reached).
- Read the consultation documents if they are public; they would show requirements and evaluation criteria.

## 2. Vendor landscape (desk view)

| Category | Names found | Evidence | Relevance to Art. 9 requirements | Threat |
|---|---|---|---|---|
| **ITSM / ticketing suites used for complaints** | Not named in the STB notice [U]; typical products are ServiceNow, Jira Service Management, GLPI [A] | STB CD 23/2026 bundles complaints with ITSM [P][S186] | Tickets, SLAs and dashboards: yes. Annex 1 data, ROGS760, reasoned-rejection controls, customer status in AR: **not native** [A] | **High** at banks that already run ITSM |
| **Banking CRM modules from local integrators** | HLi Tunisie, "CRM Banque" with incident and complaint files and traceability of complaint sources | Vendor brochure (2016) [P][S187] | Complaint files and traceability: yes. BCT 2022-08 specifics: unknown (brochure predates the circular) | Medium–High |
| **Core-banking vendors** | Sopra Banking Software (deployed at Banque de Tunisie and BTK Bank); SAB (CRM for banks presented in Tunisia, 2012); BFI and Vermeg (Tunisian origin, core banking and capital markets) | Press and vendor news [P][S188][S189] | Unknown. Complaint modules are possible; to ask in interviews | Medium (incumbency) |
| **Global CRM via local partners** | Microsoft Dynamics 365 (e.g. Inetum deployment at an insurer, Assurances Maghrebia); Salesforce [A] | Vendor news [P][S190] | Generic case management; configuration effort for BCT rules | Medium |
| **Generic SME CRM / complaint tools** | DUX ERP CRM, APBS CRM, FMSoft Tassaruf (Tunisia); Complaints Manager (international SaaS) | Vendor websites [P][S191] | Generic; no banking-regulation focus found | Low |
| **In-house / bank-specific portals** | Banque Zitouna complaints portal; BNA H24 tracking; Attijari complaint platform; Amen Bank chatbot intake | Public channel scan [P][S183] | Unknown back office | **High** (installed, sunk cost) |
| **Industry portal** | Conseil Bancaire et Financier complaint portal (second level, after the institution) | [P][S185] | Complementary, not an Art. 9 tool for institutions | Low (but a possible partner) |

## 3. Implications for positioning (hypotheses to test in interviews)

| Hypothesis | Test question (FI validation package §3) |
|---|---|
| Banks with ITSM or CRM tools still compile **ROGS760, the board report and the internal-control chapter** by hand | Q10–Q11: hours spent and source system |
| Generic tools do not enforce the **15-working-day ceiling**, **Art. 2 case types** or **reasoned rejections** | Q5–Q9; ask for a walkthrough |
| Leasing, factoring and payment institutions lack ITSM/CRM budgets, so a Starter tier fits | Q15–Q17 and WTP §8 |
| Procurement is bundled with IT tools (as at STB), so the buyer may be the IT department | Buyer framework §6: identify whether the CIO or customer relations owns the budget |

## 4. What this scan does not prove

- No vendor's **price** was found. The E-05 threshold requires ≥ 3 offers or prices.
- No institution's **actual tool** or **satisfaction** is known. Incumbents must be identified at ≥ 10 institutions in interviews.
- The STB consultation's documents, award status and budget were **not** obtained.
