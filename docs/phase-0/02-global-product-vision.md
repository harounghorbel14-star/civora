# 2. Global Product Vision

## 2.1 Mission

> Make essential public services easier, safer, faster and more accessible, by giving governments and trusted institutions secure, citizen-centred service-delivery infrastructure that respects sovereignty and privacy.

## 2.2 Vision statement (revised)

**CIVORA is the operating layer between citizens and the institutions that serve them.** It does not replace sovereign registries such as identity, civil status or health records. It makes them usable through these components:

- A **service layer**: catalogue, guided applications, case management, appointments, payments orchestration and notifications.
- A **trust layer**: federation with national eIDs, verifiable documents, consent, audit and citizen-visible access logs.
- An **assistance layer**: a multilingual AI guide grounded in official sources, plus assisted channels for people who cannot or will not go digital.
- A **deployment model** that puts each country's data inside that country's infrastructure, under that country's law.

## 2.3 What CIVORA is, and is not

| CIVORA **is** | CIVORA **is not** |
|---|---|
| A platform vendor and operator under contract | An identity issuer or a civil registry |
| A relying party to national digital identity schemes | A replacement for Mobile ID, Nafath, Singpass, EUDI wallets, etc. |
| A builder of back-office and front-office systems for institutions | The owner or controller of citizens' government records |
| An integrator into national interoperability platforms (UXP/X-Road, GovStack-style) | A parallel data-exchange backbone |
| A processor (sub-processor) acting on institutions' instructions | A data broker. CIVORA never sells or monetises personal data |
| Free for citizens on essential services | An advertising business |

## 2.4 Design principles

1. **Sovereignty by architecture.** Each country runs in an isolated *country cell*: own data stores, own keys, own hosting. The "global core" is shared code and product, not shared data (Section 8).
2. **Fetch, don't copy.** Wherever possible CIVORA retrieves authoritative data from the source registry on demand, with consent, rather than storing copies. Copies need a lawful basis, a retention period and a reason.
3. **Once-only and life-events.** Citizens should not supply information the state already holds. Services are organised around life events (birth, schooling, work, illness, retirement, moving abroad), as in Estonia and Singapore [V][S96][S93] and the World Bank's Tunisia GovTech "life events" work [V][S75].
4. **Transparency to the citizen.** Every access to a person's data is logged and visible to that person. This mirrors a provision of Tunisia's own unique-identifier framework, under which citizens may consult which bodies used their identifier [P][S7].
5. **Assisted digital, not digital-only.** 16.9% of Tunisia's population is 60 or older [V][S77]. Even in Singapore, ~8% of seniors 65+ have no Singpass [V][S94]. Every journey must support delegation (family members, caregivers), counter-assisted channels and accessible design (WCAG 2.2 AA).
6. **AI that cites or stays silent.** The assistant explains; it never decides. It answers only from versioned official sources, shows its citations, and refuses rather than guesses.
7. **Security and privacy as product features.** These are not compliance afterthoughts (Section 10).
8. **Modular adoption.** A ministry can buy only case management, a bank only verification, a country the whole stack.

## 2.5 Product family (target state, 5+ years)

| Product | Users | Description | Maturity path |
|---|---|---|---|
| **CIVORA Guide** | Citizens, call-centre agents | AI procedures assistant and services catalogue, multilingual | MVP → pilot first |
| **CIVORA Workspace** | Civil servants | Case management, appointments, document checks, SLA tracking, internal collaboration | MVP → first B2G product |
| **CIVORA Citizen** | Citizens | White-label web and mobile app: dashboard, requests, appointments, notifications, wallet, delegation | Prototype in Tunisia; product for L3 countries |
| **CIVORA Trust** | Institutions, B2B relying parties | Identity-verification orchestration, e-signature workflows, verifiable credentials issuance/verification, consent and audit APIs | First B2B product (L1) |
| **CIVORA Connect** | Integrators | Adapter framework for national interoperability platforms, eID schemes, payment providers, messaging | Built incrementally per integration |
| **CIVORA Health Bridge** | Clinics, health authorities | Consent-based access, appointments, telemedicine scheduling, FHIR integration. Never a national record of its own | Later; partnership-only |
| **CIVORA Country Pack** | Governments | Configuration bundle per country: languages, legal policies, identity profile, catalogue, workflows, hosting profile | Defines L3 |

## 2.6 Ten-year ambition (directional, not a forecast)

- **Years 1–3:** Credible reference deployments in Tunisia: at least one public institution and several regulated businesses. Security certifications (ISO 27001, ANCS audit). One international pilot.
- **Years 4–6:** A recognised regional GovTech platform across North Africa and Francophone/Arabic-speaking markets. Profitable on a recurring-revenue base.
- **Years 7–10:** Selected as a building-block provider in multi-country digital public infrastructure programmes. Countries operate CIVORA cells themselves under licence.

## 2.7 How CIVORA wins against larger vendors

| Advantage | Why it is credible | What must be true |
|---|---|---|
| Arabic (incl. dialects) + French + RTL-native product | Built in Tunisia by native speakers. Few global vendors treat Derja/Arabizi seriously [V][S111] | Invest early in language evaluation and design systems |
| Sovereign deployment by default | Country cells designed for in-country hosting | Architecture discipline from day one |
| Cost of delivery | Tunisian engineering costs [P][S85][S86] versus European integrators | Retain senior talent; avoid becoming a body shop |
| Speed and product focus | Modular platform rather than bespoke projects | Say "no" to one-off customisation |
| Interoperability with open DPI (X-Road/UXP, MOSIP, OpenID, W3C VC) | Governments increasingly adopt open digital public infrastructure [P][S105][S106] | Contribute to and comply with open standards, not compete with them |
