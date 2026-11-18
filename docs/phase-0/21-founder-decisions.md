# 21. Founder Decision Register (prioritised)

Decisions **D1–D10 are required to approve Phase 0** and start the 90-day plan. D11–D15 are needed within 30 days of approval. D16–D17 can wait.

Record each decision as: **Approved / Approved with changes / Rejected**, with date and rationale. Rejections of D1–D3 require revising this report before implementation.

## Tier 1 — Required to approve Phase 0

| ID | Decision | Options | Recommendation | Why | If delayed |
|---|---|---|---|---|---|
| **D1** | **Strategic positioning** | (a) Independent national super-app owning citizen identity and records; (b) **infrastructure vendor/operator to sovereign systems** (B2G + B2B); (c) pure consultancy | **(b)** | The state already operates Mobile ID, e-Bawaba, Khadamet, UXP and is rolling out Sahetna (Sections 3.3, 4); the law reserves registries and gates sensitive processing (Section 11); trust constraints (R7) | All downstream work is mis-targeted |
| **D2** | **Go-to-market** | (a) B2G only; (b) B2B only; (c) **dual-track: L1 B2B trust services for revenue + L2 B2G pipeline** | **(c)** | B2G alone starves cash (R2); B2B alone is a small market (Section 3.6) and abandons the mission | Hiring and MVP scope unclear |
| **D3** | **Funding path** | Lean / Moderate / Enterprise (Section 15) | **Staged: Lean via pre-seed (1.0–1.2M TND), Moderate after milestones (seed 4–6M TND)** | Lean is most robust to delays; Enterprise is highly timing-sensitive (+40% cash need on a 6-month slip) | Burn without a plan |
| **D4** | **Corporate structure** | (a) **Tunisian SA/SARL + Startup Act label now; holding decision at seed**; (b) foreign holding now | **(a)** + engage counsel on Q10 | Startup Act benefits [V][S58]; avoid premature complexity | Cannot contract, hire or apply for label |
| **D5** | **MVP scope** | As in Section 18 (Guide + catalogue + Workspace + citizen app + simulated eID + wallet + consent/audit) vs alternatives | **Approve Section 18 scope** | Proves value, buyer interest, feasibility and deployability without needing government data | Build drift |
| **D6** | **Citizen Data Charter** (binding ethics) | Adopt / defer | **Adopt v0 now, publish after civil-society review**; embed in shareholders' agreement and contracts | Trust is the binding constraint; differentiator with governments, donors and civil society | Investors and partners may push conflicting models |
| **D7** | **Technology stack and architecture style** | Section 8.2 recommendations vs alternatives (e.g. Flutter, Java/Spring, microservices) | **Approve:** TypeScript end-to-end (NestJS, Next.js, React Native), PostgreSQL, Keycloak, modular monolith with separate health/AI/key services, country cells | Small team velocity; deployability at CNI/labelled hosts; sovereignty | Phase 2 cannot start |
| **D8** | **Roadmap re-sequencing** | Brief's order vs **recommended order** (Section 19.1) | **Recommended order**: AI Guide and catalogue early; security continuous; health later | Lowest-barrier, highest-value first | MVP delayed by high-barrier modules |
| **D9** | **Hosting policy** | (a) **Synthetic-only dev/staging on any cloud; pilots/production only on CNI or G-Cloud/N-Cloud-labelled Tunisian hosts**; (b) foreign cloud for everything | **(a)** | Circular 5/2026, Cloud First policy, transfer restrictions (Sections 11.2, 11.5) | Risk of non-compliant architecture |
| **D10** | **AI model policy** | (a) **Model gateway; foreign API models allowed only for public content with no personal data and with client approval; in-country models for any personal data**; (b) single foreign provider for all | **(a)** | Law 2004-63 transfer rules; vendor lock-in (R17); sovereignty | Guide architecture undefined |

## Tier 2 — Within 30 days of approval

| ID | Decision | Options | Recommendation |
|---|---|---|---|
| **D11** | **Open-source strategy** | Proprietary / **open-core** / fully open (DPG) | **Open-core:** open-source the adapter framework, catalogue schema, Derja evaluation sets and accessibility kit; keep Workspace/Trust/Guide orchestration commercial. Improves donor eligibility and credibility (Section 4.3) |
| **D12** | **Brand & trademark** | Keep "CIVORA" / rename | Keep provisionally; **clear trademark (TN, EU, Madrid) before visual-identity spend**; define Arabic name/transliteration |
| **D13** | **First pilot targets** (order) | (a) consular/diaspora services; (b) one public service line (attestations) via donor programme; (c) bank/payment-institution L1; (d) private university diplomas | Pursue **(c) and (d)** for fast paid pilots, plus **(a) or (b)** as the flagship public pilot depending on discovery |
| **D14** | **First hires & compensation** | — | Approve pay bands above market median for senior roles, ESOP pool (e.g. 10–15% [A]), and the first 5 hires per scenario |
| **D15** | **Governance** | — | Create an advisory board including an independent privacy/digital-rights expert; adopt anti-bribery and conflict-of-interest policies before any public-sector engagement |

## Tier 3 — Later

| ID | Decision | When | Recommendation |
|---|---|---|---|
| **D16** | International holding / subsidiary structure | At seed | Decide with tax/FX counsel (Section 13.9) |
| **D17** | Healthcare real-data timing | After first authorised pilot | Keep synthetic-only until MoH/INPDP authorisation and a clinical partner exist |

## Approval record

| Decision | Status | Date | Notes |
|---|---|---|---|
| D1 | Pending | | |
| D2 | Pending | | |
| D3 | Pending | | |
| D4 | Pending | | |
| D5 | Pending | | |
| D6 | Pending | | |
| D7 | Pending | | |
| D8 | Pending | | |
| D9 | Pending | | |
| D10 | Pending | | |
