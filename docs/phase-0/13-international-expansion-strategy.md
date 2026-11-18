# 13. International Expansion Strategy

## 13.1 Principles

1. **Global core, country cells** (Section 8.4). Code and product are shared; data, keys, hosting, policies and workflows are per country.
2. **No assumption transfers across borders.** Each country gets its own analysis of:
   - legal identity and eID scheme
   - data-protection law and transfer rules
   - hosting and localisation requirements
   - procurement rules
   - languages
   - service catalogue
3. **Tunisian references first.** Enter a second country only with at least one live reference deployment and one certification (ISO 27001 or equivalent).
4. **Partner-led entry.** Use local integrators, donor programmes and open-DPI consortia. Avoid going alone into unfamiliar procurement systems.
5. **Same ethics everywhere.** Never deploy in a context where the platform is likely to be used for unlawful surveillance or discrimination. Human-rights due diligence comes before every bid (Section 13.7).

## 13.2 Market selection criteria

| Criterion | Weight [A] | Why |
|---|---|---|
| Language and cultural fit (Arabic and/or French) | 20% | CIVORA's core differentiator |
| Digital-government gap with funded intent (strategy, budget or donor programme) | 20% | Need + money |
| Procurement accessibility for a foreign SME (donor rules, consortia) | 15% | Ability to win |
| Political and security stability; sanctions exposure | 15% | Delivery and payment risk |
| Data-protection and hosting clarity | 10% | Ability to comply |
| Competitive intensity (incumbent vendors, in-house capacity) | 10% | Win probability |
| Proximity / time zone / travel | 5% | Delivery cost |
| Payment reliability and FX convertibility | 5% | Cash-flow risk |

## 13.3 Candidate markets (initial screening, to be scored in Phase 14 planning)

| Wave | Market | Fit rationale | Key risks | Entry approach |
|---|---|---|---|---|
| **Wave 1 (from ~M24)** | **Mauritania** | Arabic + French; DPI gaps; donor-financed projects [A] | Small budgets; capacity | Donor-funded subcontract; Guide + Workspace |
| | **Francophone West Africa** (e.g. Senegal, Côte d'Ivoire, Benin, Togo) | French; active DPI and interoperability programmes. Cybernetica signed to implement interoperability in Côte d'Ivoire [V][S119]. Togo is among MOSIP pilot countries [P][S105] | Competition from European integrators; political volatility in parts of the region | Partner with interoperability/identity primes; supply service layer on top of open DPI |
| **Wave 2 (from ~M36)** | **Morocco** | Arabic + French; advanced identity platform; authorised relying-party model [P][S107][S108] | Strong incumbents; preference for national champions [A] | Component supplier (Guide, Workspace) via Moroccan partner |
| | **Libya** | Arabic; proximity; large needs [A] | High political/security risk; payment risk; sanctions screening | Opportunistic, donor-funded only, strict due diligence |
| | **Jordan, Iraq** | Arabic; donor-funded digital transformation [A] | Competition; security (Iraq) | Consortia |
| **Wave 3 (from ~M48)** | **GCC (Saudi Arabia, UAE)** | Large budgets; Arabic; revenue-sharing operator models (Saudi DGA qualified 16 firms, Feb 2026) [P][S91] | Intense competition (Elm etc.); localisation requirements | Subcontract or partner; specialised components (Derja and Maghrebi Arabic is *not* a GCC advantage) |
| | **Egypt** | Large Arabic market; new PDPL regime [P][S109] | Local champions; FX | Partner-led |
| | **EU (France, Italy, Belgium)** | Diaspora links; EUDI wallet acceptance obligations from 2027 [P][S102] | GDPR/NIS2/AI Act compliance cost; crowded market | **B2B relying-party/verifier tooling** for EUDI, not B2G platforms; possibly via EU subsidiary |

**Excluded by default:** markets under comprehensive sanctions, and contexts with credible evidence that digital-ID systems are used for persecution. These are re-evaluated only with board approval and independent human-rights assessment.

## 13.4 Country entry playbook (8 steps, ~4–9 months before a pilot)

1. **Desk research** (2–4 weeks):
   - eID scheme
   - data-protection law
   - hosting rules
   - procurement code
   - digital strategy
   - donor pipeline
   - incumbents
2. **Legal scan by local counsel:** questions equivalent to Section 11.10.
3. **Partner selection:** local integrator plus, where applicable, a donor-programme prime.
4. **Country pack v0:**
   - languages
   - legal policy set
   - identity profile
   - service catalogue for 10–20 priority services
   - synthetic data generator
5. **Hosting design:** sovereign host, two sites, key custody (HSM) arrangement.
6. **Proof of concept** on synthetic data in the target country's own infrastructure.
7. **Pilot proposal:** scope, success metrics, DPIA, security audit plan, exit/transition plan.
8. **Operating model:** local delivery team, support hours and language, escalation, SLAs.

## 13.5 Country pack readiness checklist

| Area | Item | Owner |
|---|---|---|
| Legal | Data-protection basis per processing; transfer rules; retention; age of majority; mandates/guardianship law | Legal + DPO |
| Identity | eID integration spec; assurance mapping; identifier formats; recovery rules | Identity lead |
| Language | Translations reviewed by native legal-language editor; RTL checks; Guide golden set ≥500 Q | Product + AI |
| Catalogue | Services with steps, fees, documents, offices, sources, effective dates | Content team |
| Payments | Licensed providers; currency; receipts format; refunds law | Payments lead |
| Hosting | Labelled/approved host; network; DR site; HSM | SRE |
| Security | Local incident-reporting authority and timelines; audit obligations | CISO |
| Accessibility | Local standard (if any) + WCAG 2.2 AA | Design |
| Policies | ABAC bundle; consent texts; notices | Security + Legal |

## 13.6 Regulatory landscape (high level)

| Region | Data protection | Identity | Notes |
|---|---|---|---|
| EU | GDPR; Tunisia has **no** EU adequacy decision [A — verify], so EU→Tunisia transfers need safeguards (SCCs) | eIDAS 2.0 / EUDI wallets [V][S103] | NIS2; AI Act; consider EU-located cell for EU clients |
| Maghreb | Tunisia 2004-63 (reform pending); Morocco 09-08; Algeria 18-07 (amended) [P][S110] | National eIDs at varying maturity; MOSIP in Morocco [P][S104] | Localisation common |
| Egypt | PDPL 151/2020 + 2025 regulations [P][S109] | National ID; Digital Egypt [A] | Licensing for cross-border transfers |
| GCC | Saudi PDPL; UAE PDPL [A] | Nafath; UAE Pass | Strong localisation; operator licensing (KSA) [P][S90][S91] |
| Francophone Africa | Many laws modelled on French law / ECOWAS / Malabo convention [A] | Mix of MOSIP and proprietary systems [P][S105] | Donor-driven procurement |

## 13.7 Human-rights and ethics due diligence (before every bid)

- Assess risks of surveillance, discrimination and exclusion, using:
  - the UN Guiding Principles on Business and Human Rights
  - the World Bank ID4D Principles on Identification [A — reference to cite in v1.1]
- Contract clauses:
  - purpose limitation
  - no use for unlawful surveillance
  - audit rights
  - CIVORA's right to suspend in case of abuse
- Publish an annual transparency report covering government data requests and countries served.

## 13.8 International revenue potential (illustrative, [A])

- **Typical engagement:** a country deployment of Guide + Workspace + Citizen white-label for 20–50 services is worth US$0.5–3M in implementation, plus 15–25% annually in licence/support.
- **Years 4–6:** winning 1–2 such engagements per year would add **US$1–6M per year**, which is the step-change Tunisia alone cannot provide (Section 3.6).
- Validation requires a bottom-up pipeline from donor project databases (World Bank, AfDB, EU) during Phase 14 planning.

## 13.9 Corporate and contracting structure for expansion (founder decision)

| Option | Pros | Cons |
|---|---|---|
| Tunisian company exports services directly | Simple; Startup Act benefits [V][S58] | FX repatriation rules; some buyers prefer EU/US counterparties; investor preferences |
| Tunisian opco + foreign holding (e.g. EU) | Investor-friendly; contracting flexibility | Cost; FX/regulatory approvals; transfer pricing |
| Country subsidiaries per major market | Local presence; procurement eligibility | Overhead; only justified with revenue |

**Recommendation:** start with the Tunisian company and Startup Act label. Decide on a holding structure at seed stage with tax and FX counsel (counsel question 10).
