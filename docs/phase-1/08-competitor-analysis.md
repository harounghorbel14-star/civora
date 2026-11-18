# 8. Competitor Analysis (by division)

This extends Phase 0 §4, which covers reference platforms (Absher/Nafath, Estonia, Singapore, EUDI, Morocco) and government vendors. That analysis is **not repeated** here. This section covers the new divisions and the first product.

## 8.1 First product — Workspace for Regulated Finance

| Competitor type | Examples | Strengths | Weaknesses vs CIVORA's wedge | Threat |
|---|---|---|---|---|
| Global help-desk / service SaaS | Zendesk (Suite ~US$55–115/agent/month), Freshdesk (from ~US$15–19), Salesforce Service Cloud, Microsoft Dynamics 365 [P][S147][S148] | Mature, cheap entry tiers, ecosystems | Horizontal: no BCT 2022-08 mediator/BCT correspondent workflow, motivated-decision templates or annual board report out of the box. Data usually hosted abroad (INPDP transfer authorisation needed — Phase 0 §11.2). Limited Arabic RTL depth in agent workflows [A] | **High** |
| Open-source / SME suites | Odoo Helpdesk and similar [A] | Low cost, local integrators | Generic; customisation per bank | Medium |
| Core-banking and banking-software vendors' complaint modules | Vendors already installed in Tunisian banks [U — names to identify in discovery] | Installed base, integration | Often rigid and slow to change; customer-facing tracking weak [A] | **High** (incumbency) |
| Local IT services firms (custom builds) | Tunisian ESNs [A] | Relationships, price | Bespoke, costly to maintain, no product roadmap | Medium |
| In-house tools | Bank IT teams [A] | Control | Maintenance burden | Medium |

**Differentiation hypothesis** (to validate with ≥ 15 institutions):
1. **Regulation-native:** BCT 2022-08 workflows, reasoned decisions, mediator/BCT correspondent liaison, board-report generation.
2. **Hosted in Tunisia or on-premises.**
3. **Arabic/French RTL-native** agent and customer interfaces.
4. **Customer-facing status tracking.**
5. **One platform** that later adds e-KYC review queues, document processing and e-signature.

If discovery shows banks already satisfied, the wedge narrows to leasing/factoring companies and payment institutions (see the risk register, R26). Payment institutions are **outside** BCT 2022-08 (Circular 2026-10 applies), so the regulatory pull there is weaker (verification 18 Nov 2026). A comparison grid against the verified obligations is in [validation/fi-validation-package.md](validation/fi-validation-package.md) §9.

## 8.2 Identity (Division D)

| Competitor | Evidence | Note |
|---|---|---|
| Thinkneo — Avatar-ID (Tunisia) | Deployed at a telecom operator and banks under the 2025 e-KYC circular [P][S135] | Local incumbent → **partner candidate** |
| Kaoun (Flouci) + NGSIGN (Tunisia) | Remote e-KYC plus e-signature partnership for "100% Tunisian" solutions [P][S136] | Local incumbents → **partner candidates** |
| Global KYC vendors | Didit (from ~US$0.30/check), Veriff (~US$0.80–1.89), Sumsub (~US$1.35–1.85) [P][S137][S138]; Shufti and Didit list Tunisian document support [P] | Price pressure; data processed abroad |
| TunTrust (ANCE) | National certification authority (Phase 0 S36) | **Partner** for e-signature |

## 8.3 AI (Division E)

| Competitor | Evidence | Note |
|---|---|---|
| IyedeX — 3amAli (Sfax) | Derja conversational assistant [P][S143] | Chat layer contested |
| MindState AI, Hexastack (Hexabot), Be Bouncy | Agentic / conversational platforms for banks, insurers, SMEs [P][S144] | Chat layer contested |
| Banks' and insurers' own assistants | Amen Bank chatbot since 2020 [P][S145]; MAE insurance assistant [P][S146] | Enterprises build or buy chat already |
| State AI assistants | RNE assistant "Nourni" (Nov 2026) [P][S127] | The state builds its own |
| Global LLM platforms | — | Commodity models; sovereignty concerns |

**Conclusion:** compete on **document-heavy back-office AI inside workflows**, not on chatbots.

## 8.4 Health (Division C)

| Competitor | Evidence | Note |
|---|---|---|
| Ministry of Health national programme (health ID, shared record, Sahetna.tn) | Phase 0 S67–S69 | Public core is taken |
| Online booking / practice platforms | Docteury (2015) [P][S151]; 2026 practice-software guides for Tunis [P][S153]; others [U] | Fragmented SMB market |
| International HIS/EHR vendors | [A] | Hospital market requires references |

## 8.5 Connect (Division F)

| Competitor | Note |
|---|---|
| Cybernetica (UXP national platform) | National backbone (Phase 0 S22) — **never compete**; build adapters through member security servers |
| Global iPaaS (MuleSoft, Boomi, etc.) [A] | Enterprise integration; costly; not sovereign-first |
| Local integrators | Project-based |

## 8.6 Competitive implications

1. **Avoid head-on fights with incumbents** in e-KYC, chat and front doors. Partner or integrate.
2. **Win where regulation creates specific workflows and incumbents are horizontal:** complaints and case management under BCT 2022-08.
3. **Reuse that workflow advantage in Government** (sector 20) and in other regulated industries.
