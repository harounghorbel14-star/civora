# BCT Regulatory Verification — Circular 2022-08 and related rules

| | |
|---|---|
| Purpose | Verify, from the authoritative text, the regulatory basis of the first product (CIVORA Workspace — Regulated Finance) |
| Verified on | 18 November 2026 |
| Evidence item | E-02 in the [validation evidence register](../validation-evidence-register.md) |
| Status | **Text verified [V]. Interpretation not yet confirmed by Tunisian counsel.** This document is research, not a legal opinion |

## 1. Source and integrity

| Item | Finding | Evidence |
|---|---|---|
| Authoritative text | *Circulaire aux banques et aux établissements financiers n°2022-08* of 20 October 2022, "Politiques et mesures de traitement des réclamations de la clientèle", signed by the Governor. Downloaded from the BCT website | [V][S159] |
| Integrity of the copy used in v2.0 | The copy previously cited (S141, hosted by WebManagerCenter) is **byte-identical** to the BCT file. SHA-256 `0e4b9988…f0287810` for both | [V][S141][S159] |
| BCT announcement | BCT press release: published 20 Oct 2022. It names a dedicated structure, varied channels, transparency, a complaints database and "reporting périodique et granulaire à la BCT". Internal handling is the first level before banking mediation | [V][S160] |
| Official Gazette | Reported as published in JORT No. 117 of 1 November 2022 | [P] (search excerpt; JORT copy not retrieved) |
| Amendments | No amending circular was found on the BCT site or in the press up to 18 Nov 2026. Art. 15 itself repeals Art. 5 of Circular 2006-12 | [U]. Counsel to confirm no later amendment |

## 2. Scope (Articles 1–2)

**Who is covered (Art. 1):** banks and financial institutions within the meaning of Law 2016-48, **"à l'exception des établissements de paiement"**. Annex 2 lists the reporting entities as BR + BNR + EL + EF + BA:
- resident banks
- non-resident banks
- leasing companies
- factoring companies
- investment banks

[V][S159]

**Population at end-2025** [V][S165]:

| Category | Count | Covered by 2022-08? |
|---|---|---|
| Resident banks | 22 | Yes |
| Non-resident banks | 7 | Yes |
| Leasing companies | 8 | Yes |
| Factoring companies | 2 | Yes |
| Investment banks | 2 | Yes |
| Payment institutions | 6 at end-2025, plus Walletii by Ooredoo licensed in 2026, so 7 | **No.** They are covered by Circular 2026-10 (and 2020-11 for mobile payment). See §5 |

- **Population covered by 2022-08: 41 institutions.**
- The most relevant buyers are the 22 resident banks plus 10 leasing and factoring companies, i.e. 32.

**What counts as a complaint (Art. 2):** "toute déclaration actant un différend, une insatisfaction ou une contestation" about a product or service the customer has, or wishes to subscribe to.

Explicitly **not** complaints under the circular:
- a service request
- a request for information or advice
- a complaint already referred to the banking mediator
- a matter before the courts or in arbitration
- a dispute already decided, settled amicably or by transaction
- employee/employer disputes
- **domestic mobile payment services**, which are governed by Circular 2020-11

[V][S159]

> **Correction to v2.0/v2.1 documents.** These documents described "banks, financial institutions and payment providers" as subject to Circular 2022-08. That is inaccurate for payment institutions. The product scope is corrected in [product-validation-report.md](product-validation-report.md) §2. The changes are logged in the [change record](../change-record.md) §6.

## 3. Article-by-article obligations and product mapping

FR numbers refer to [12-product-requirements-document.md](../12-product-requirements-document.md). New requirements FR-60 to FR-66 were added in this verification.

| Art. | Obligation (key French text quoted) | Deadline / frequency | Product capability | Req. | Finding |
|---|---|---|---|---|---|
| 1 | Minimum requirements and internal-control rules for complaint handling that is "efficace, gratuit et confidentiel" | — | Free for the end customer: the institution pays. Confidentiality controls | NFR security; FR-41, FR-42 | Covered. The status page must never charge or upsell (already a non-goal) |
| 2 | Definition of complaint and exclusions (§2 above) | — | Case **type** (complaint / service request / information request) and **out-of-scope reason**. Only "réclamations" count in regulatory statistics | **FR-60 (new)** | **Gap closed.** v2.0 treated all cases alike |
| 3 | A complaint-handling system ("dispositif") within the customer-protection policy of Circular 2021-05 [S172]: adequate organisation, human and logistic means, formal internal procedures | — | Procedure library, configuration history | FR-40, FR-44 | Covered (institution's own policy; product supports it) |
| 4 | A dedicated **structure** in charge of complaints, sized to the institution, with access to the data it needs, respecting personal-data and professional-secrecy law | — | Teams, roles, data scoping | FR-40, FR-41 | Covered |
| 5 | Formal procedures and internal-control rules for **reception, handling and archiving**, reviewed periodically | Periodic review | Workflow configuration, retention policies, configuration history | FR-09, FR-43, FR-44 | Covered |
| 6 | Channels: at least "une boite de messagerie électronique", "un formulaire en ligne" and "dépôt sur place auprès des agences et du siège social" | — | Email-to-case, web form, agent form at branch/HQ; postal mail logged as "other channel" (Annex 3) | FR-01 | Covered. Postal channel value added to FR-01 |
| 7 | Inform customers about procedures, handling deadlines and mediation: posters in branches, electronic platforms, account statements, and promotional, pre-contractual and contractual documents | Permanent | Printable branch notice, web snippet, text block for statements and contracts | FR-22, FR-23 | Covered. Text block for statements and contracts added to FR-23 |
| 8 | (a) Acknowledgement for every complaint with **at least the registration date and reference number**; (b) answer "par tout moyen laissant une trace écrite" within a time that reflects complexity, which **"ne dépasse pas dans tous les cas quinze (15) jours ouvrables à partir de la date de l'accusé de réception"**; (c) **give reasons for any total or partial rejection** | **≤ 15 working days from acknowledgement** | Acknowledgement with date and reference; deadline engine with a **regulatory ceiling** of 15 working days for complaint-type cases; written-trace channels only; mandatory reasons | FR-04, FR-09, FR-15, FR-16, **FR-61 (new)** | **Gap closed.** v2.0 left deadlines fully configurable and did not enforce the ceiling. The circular has **no clock-stop** for missing customer information, so pausing must not move the regulatory deadline (counsel to confirm) |
| 9 | A **dedicated IT solution** ("solution informatique dédiée") able to: (1) centralise and archive in a database all complaints "ventilées par objets et suites réservées"; (2) **automatically** generate acknowledgements with a reference for every complaint received remotely; (3) alert the Art. 4 structure about deadline overruns; (4) produce key performance indicators. Annex 1 information retained "conformément aux délais légaux" | Permanent; retention per law | Central database with subject and outcome taxonomy; automatic acknowledgement on remote channels; deadline alerts; KPI dashboard; **Annex 1 data set** | FR-03, FR-04, FR-09, FR-30, FR-43, **FR-62 (new)** | **Core regulatory need: verified.** Annex 1 fields not all present in v2.0 (see §4) |
| 10 | Management submits to the board an **annual report** on complaint handling | Annual | Board report generator | FR-32 | Covered. Format not prescribed |
| 11 | The internal-control report sent to the BCT under **Art. 52 of Circular 2006-19** must include a chapter describing the complaint system and the controls performed | At least annual (2006-19 Art. 52) | "Internal-control chapter" draft export | **FR-63 (new)** | **Gap closed** |
| 12 | **Internal audit** of the complaint system **at least every three years**, and whenever needed; the audit committee evaluates and approves the report | ≥ every 3 years | Auditor role, audit pack export (sampling, audit log, configuration history) | FR-42, **FR-64 (new)** | **Gap closed** |
| 13 | A **correspondent** chosen from the complaint structure: interlocutor of the BCT (information on request) and of the banking mediator | On request | Correspondent workspace; case-file export; regulator requests as case type | FR-25–FR-28 | Covered |
| 14 + Annexes 2, 3 | New declaration **ROGS760 "Etat sur les réclamations reçues"** in the general reporting domain of Circular 2017-06 [S171]: **annual**, deadline **DR + 45 days**, **XML** format, content per Annex 3 | **Annual; DR + 45 days; XML** | Regulatory dataset and export in the Annex 3 structure. Institution submits it through its own BCT channel | FR-33, **FR-65 (new)** | **Gap closed at specification level.** The XML schema is not public [U]. It must be obtained from a design partner or the BCT (Q-02) |
| 15 | In force on publication. **Compliance within six months.** Repeals Art. 5 of Circular 2006-12 at the end of that period | Compliance due about **late April – early May 2023** (computed; exact date depends on the publication date) | — | — | **Material commercial finding**: the compliance deadline passed more than three years ago. Institutions should already run some solution. CIVORA sells a **replacement or upgrade**, not first-time compliance (see §6) |

### Annex 3 — content of the annual statement ROGS760 [V][S159]

| Section | Breakdown required |
|---|---|
| I | Complaints by complainant type: individuals, companies, professionals, associations, others |
| II | Individuals by **gender** and **age band**: 18–25, 26–60, over 60 |
| III | By channel: email, online form, deposit at branches/HQ, other channels including postal mail |
| IV | By subject: financing, non-card payment, card payment ("monétique"), account operation, international banking operations, pricing, remote banking services, other services. For each: number received, **average response time**, outcomes (in progress; resolved in the customer's favour) |

**Product consequence:**
- The default category taxonomy maps 1:1 to the Annex 3 subjects. Institutions may refine it into subcategories.
- Gender and age band are captured **only as needed for this statistic**, ideally derived from core banking rather than typed by agents (data minimisation, Law 2004-63 Art. 11).

## 4. Annex 1 — minimum information to retain per complaint [V][S159]

| Annex 1 field | In PRD v1.0? | Action |
|---|---|---|
| Complaint reference number | Yes (FR-04) | — |
| Name, or company name for legal persons | Yes (FR-02) | — |
| **Unique RNE identifier** for legal persons | No | Added (FR-62) |
| Date of receipt | Yes | — |
| Channel of receipt | Yes | Postal channel value added |
| Type of product or service | Yes (FR-03) | Map to Annex 3 subjects |
| Subject and description | Yes | — |
| **Investigations carried out** by the institution | Partly (notes) | Structured field added (FR-62) |
| **Steps taken to resolve the problem** | Partly | Structured field added (FR-62) |
| Outcome ("sort de la réclamation") | Yes (FR-15) | — |

**Retention period:** "conformément aux délais légaux". The circular does not set a number. Counsel must state the applicable legal period (Q-06). Until then, retention stays configurable per institution, with a legal-hold capability (FR-43).

## 5. Payment institutions and mobile payment — different rules

| Text | Who | Complaint obligations | Reporting | Status |
|---|---|---|---|---|
| **Circular 2026-10** (25 Sep 2026), replacing Circular 2018-16 | Payment institutions | Art. 39: clear policies and procedures for receiving and handling complaints, and a **structure** in charge of complaints. Art. 11: the institution must have "un dispositif formalisé de traitement des réclamations" and personal-data protection. Art. 48: the statutory auditors' report on internal control, sent to the BCT one month before the general meeting, must cover "le dispositif de gestion des réclamations de la clientèle" | Annex 1 bis to Circular 2017-06: **RAA10** (complaints by channel) and **RAA20** (complaints by subject, deadlines and outcomes), both **annual, DR + 45 days, XML** | [V] text read (Business News copy of the BCT circular) [S161]. Enters into force **three months after publication** (Art. 51), i.e. around late December 2026 (computed). A rectified version (article numbering only) was reported on 28 Sep 2026 [P][S180] |
| **Circular 2020-11** (18 May 2020) | Banks, payment institutions and the Office National des Postes, for **domestic mobile payment** | Art. 9: formal procedure; publish procedures and contact points; **telephone line**; remote complaints by **online form** with an acknowledgement "coupon". Art. 12: dedicated database with a reference per complaint; **instruction ≤ 7 working days**. Art. 11: periodic evaluation through monitoring and reporting | Art. 44: **quarterly** declaration of mobile-payment complaints (type, number, customers, refunds), **by the end of the month after each quarter** | [V][S162] |
| Circular 2018-16 | Payment institutions | Art. 34: policies, procedures and a structure for complaints | — | [V][S163]. **Repealed** by 2026-10 when 2026-10 enters into force |

**Consequences:**
- The product needs **rule packs**, i.e. configuration rather than separate code:
  - **RP-BCT-2022-08:** banks, leasing, factoring and investment banks. 15 working days; ROGS760 annual.
  - **RP-BCT-2026-10:** payment institutions. Institution-defined deadlines; RAA10/RAA20 annual.
  - **RP-BCT-2020-11:** mobile-payment complaints for banks, payment institutions and La Poste. 7 working days; quarterly report.
- For payment institutions there is **no article requiring a dedicated IT solution** comparable to 2022-08 Art. 9. The regulatory pull is weaker, and their demand must be validated separately (E-01 sample design).

## 6. Market facts verified in official BCT publications

| Fact | Value | Source |
|---|---|---|
| Banks and financial institutions, end-2025 | 47 institutions: 29 banks (22 resident: 17 universal, 2 SME/micro-finance banks, 3 Islamic; 7 non-resident) and 18 financial institutions (8 leasing, 2 factoring, 2 investment banks, 6 payment institutions) | [V][S165] |
| Licensed payment institutions | Viamobile (2021), Zitouna Payment (2021), Enda Tao (2022), Wafacash (2022), Payvago (2023), First Pay (2024), Walletii by Ooredoo (licensed 29 Jan 2026) | [V][S165] |
| Supervisory attention | In 2025 the BCT carried out a general inspection mission at a bank that covered, among other things, "le dispositif de traitement des réclamations de la clientèle". The 2025 report describes Circular 2026-10 as strengthening complaint handling for payment institutions | [V][S165] |
| Banking mediation 2024 | 506 complaints to mediators (+56.2% vs 2023); 76 rejected (15.1%). **42% of the rejections were because the customer had not first exhausted the complaint with the institution** | [V][S166] |
| Mediator deadline performance | Share of mediation files handled **beyond the mediators' regulatory two-month deadline**: 21.7% (2022), 17.3% (2023), 11.4% (2024) | [V][S166] |
| Policy direction | The Observatoire de l'Inclusion Financière is finalising a study of **internal complaint-handling systems** at banks, financial institutions, insurers and microfinance institutions. The study measures the impact of Circular 2022-08, CGA Regulation 01/2023, Regulation 01-2025 and the 2016 microfinance client-protection order. It describes the mediation model as needing "une refonte radicale" | [V][S166] |

> **Correction to v2.0/v2.1 documents.** The figure "23.5% of admissible complaints over deadline (2020 report)" [P][S142] measures **mediator** handling time, not banks' internal handling. The current official series is 21.7% → 17.3% → 11.4% (2022–2024). It must not be used as evidence that banks miss the 15-working-day deadline. **No public figure on banks' internal compliance with Art. 8 was found [U].** That is a discovery question (E-01). Banks' ROGS760 statements are not public.

## 7. Conclusions

| Question from the founder's mission | Answer | Confidence |
|---|---|---|
| Exact applicable obligations | Articles 1–15 and Annexes 1–3 above | **High**: primary text |
| Relevant articles for the product | Art. 2 (definition), 6 (channels), 7 (information), **8 (acknowledgement, 15 working days, reasons)**, **9 (dedicated IT solution)**, 10 (board report), 11 (internal-control chapter), 12 (audit every 3 years), 13 (correspondent), **14 + Annex 3 (ROGS760)** | High |
| Does the product address an actual regulatory need? | **Yes, for banks and the non-payment financial institutions.** Art. 9 explicitly requires a dedicated IT solution with the four functions the product provides. For payment institutions the need is weaker (no IT-solution article) | High for the **existence of the obligation**. **Unverified: willingness to buy** |
| Does it address an operational need? | **Not yet evidenced.** Compliance was due in 2023, so most institutions should already have some tool. Whether those tools are inadequate is unknown [U] | Low. Requires E-01 and E-05 |
| Applicable deadlines and reporting | Response ≤ 15 working days from acknowledgement. Annual board report. Annual internal-control chapter (2006-19 Art. 52). Internal audit ≥ every 3 years. ROGS760 annual, DR + 45 days, XML. Payment institutions: RAA10/RAA20 annual, DR + 45 days, XML (from ~Dec 2026). Mobile payment: 7 working days; quarterly report | High (text). XML schemas unknown |
| Is the product scope legally accurate? | **After the corrections in this verification, yes, at specification level.** Corrections: payment institutions moved to a separate rule pack; complaint/request distinction; enforced 15-day ceiling; Annex 1 and Annex 3 data; internal-control chapter and audit pack. CIVORA must describe the product as **supporting** compliance. The institution remains responsible (Art. 1, Art. 4) | Medium. Counsel confirmation pending |

## 8. Questions for Tunisian counsel or the BCT (added to the counsel brief)

| ID | Question |
|---|---|
| Q-06 | Which legal retention period applies to Annex 1 information ("délais légaux")? |
| Q-07 | May the 15-working-day period be suspended while the institution waits for information from the customer? The text has no suspension clause |
| Q-08 | Is a SaaS complaint platform hosted by a third party an "externalisation" under Law 2016-48 Art. 81, requiring prior notice to the BCT (one-month silence = acceptance)? What does Circular 2006-01 add? (Its text was not retrievable from the BCT site.) |
| Q-09 | Where are the XML schemas for ROGS760 and RAA10/RAA20 published (SED technical specifications)? Can a vendor obtain them, or only reporting institutions? |
| Q-10 | Does any later circular amend 2022-08? Has Circular 2026-10 entered into force, and on what date? |
| Q-11 | Do non-resident banks and investment banks in practice report ROGS760 (Annex 2 lists BNR and BA)? |
