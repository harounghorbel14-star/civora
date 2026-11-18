# Requests for Quotation — Hosting, Security Audit, Penetration Test, Accessibility Audit (E-07)

| | |
|---|---|
| Purpose | Obtain the **≥ 2 external quotes** that E-07 requires (hosting; pen test / audit). The same comparison sheet also covers the legal, trademark and language-review quotes |
| Evidence item | E-07 (realistic MVP cost; currently 0.60–1.05M TND [A], [13](../13-mvp-scope-and-specification.md) §13.8) |
| Status | **Ready to send. Quotes need the founder.** No supplier has been contacted. **No quotation exists yet** |
| Boundary | The sizing below is an **indicative envelope for pricing only**. The architecture is decided in Phase 2, not here |

## 1. Hosting — request for quotation

### 1.1 Requirements (from PRD 1.1 non-functional requirements and the verified laws)

| Requirement | Value | Basis |
|---|---|---|
| Location | All data and backups in Tunisia; no access from abroad without agreement | Law 2004-63 Art. 50–52; PRD "Data location" |
| Label | **N-Cloud** label (ANCS) required; **G-Cloud** quoted as an option for future public-sector work | Decree-law 2023-17 Art. 12–14 |
| Environments | (a) **Staging** for design-partner sandboxes, from month 1; (b) **pilot cell** for Phase 13, quoted for later activation | Roadmap protection matrix (no production before Phase 13) |
| Indicative staging size | 3 VMs × 4 vCPU / 16 GB; managed PostgreSQL (or a VM) 2 vCPU / 8 GB / 200 GB; object storage 500 GB; private network; VPN for admin access | [A] for pricing |
| Indicative pilot-cell size | 3 VMs × 8 vCPU / 32 GB, or managed Kubernetes; PostgreSQL with HA; 2 TB object storage; WAF and anti-DDoS; load balancer | [A] for pricing |
| Backup and continuity | Daily backups + point-in-time recovery; monthly restore test; **RPO ≤ 15 min, RTO ≤ 4 h** (pilot) | PRD §12.7 |
| Availability | ≥ 99.5% (pilot); quote 99.9% as an option | PRD; Phase 13 criteria |
| Security | Encryption at rest and in transit; ISO 27001 (state scope); access logs available to the customer; incident notice ≤ 24 h | Law 2004-63 Art. 18–19 |
| Contract | Reversibility and data export; deletion certificate; right of audit for CIVORA, its customers and, on request, the BCT; no subcontracting without consent | Law 2016-48 Art. 81; Circular 2025-06 Art. 15 by analogy |
| Staff | Staff conditions under Law 2004-63 Art. 22 for anyone with access to customer data (provider to confirm) | Legal matrix 4.5 |

### 1.2 Candidate providers (labels reported in the press in 2024; check the current status with the ANCS)

| Provider | Reported label | Source |
|---|---|---|
| Next Step IT | N-Cloud (first label, Apr 2024) | [P][S195] |
| Tunisie Telecom | N-Cloud | [P][S195] |
| Ooredoo Tunisie | N-Cloud | [P][S195] |
| Dataxion | N-Cloud | [P][S195] |
| RFC | N-Cloud | [P][S195] |
| Focus Technology Solutions | N-Cloud | [P][S195] |
| 3S | G-Cloud (Jul 2024) | [P][S195] |
| EO Data Center | G-Cloud (Jul 2024) | [P][S195] |

To confirm the current list, write to the ANCS cloud-labelling address given in the 2024 reference document [S195].

### 1.3 Message (FR)

> **Objet :** Demande de devis — hébergement cloud labellisé N-Cloud (environnement de préproduction puis pilote)
>
> Madame, Monsieur,
>
> [Société], jeune entreprise tunisienne qui conçoit un logiciel de gestion des réclamations pour établissements financiers, souhaite recevoir une offre d'hébergement en Tunisie, conformément au cahier des exigences ci-joint (localisation, label N-Cloud, sauvegardes, RPO/RTO, sécurité, réversibilité, droit d'audit).
>
> Nous demandons :
> - un prix mensuel pour l'environnement de **préproduction** (démarrage sous 3 mois) ;
> - un prix indicatif pour la **cellule pilote** (activation estimée dans 17 à 18 mois) ;
> - les options G-Cloud et disponibilité 99,9 % ;
> - vos conditions contractuelles (réversibilité, audit, sous-traitance) ;
> - votre certificat de label et le périmètre de certification ISO 27001.
>
> Merci de préciser les délais de mise à disposition et la durée de validité de l'offre.
>
> Cordialement, [Prénom Nom] — [Coordonnées]

## 2. Security audit and penetration test — request for quotation

### 2.1 Scope

| Item | Scope | Timing | Basis |
|---|---|---|---|
| **Penetration test** before the design-partner sandbox | Web application (agent console), customer status page, REST API; authenticated and unauthenticated; OWASP ASVS level 2 | Before the first sandbox with real users (Phase 3–6 builds) | PRD release criteria; design-partner package S8 |
| **Pre-pilot penetration test** | As above, plus tenant-isolation tests, infrastructure and configuration review | Phase 11 pre-pilot gate | Roadmap Phase 11 |
| **Regulatory security audit** | Audit of the information system by an **ANCS-certified auditor** (if CIVORA is in scope of Decree-law 2023-17 Art. 6–8; counsel C1) | Annual, from operation | Decree-law 2023-17 |
| Optional: "sécurisé" software label | Detailed audit report for the ANCS label | Before Phase 13, if customers require it | Decree-law 2023-17 Art. 10–11 |

**Candidate auditors:**
- Use the **official list of certified auditors** published by the ANCS (formerly ANSI). Certificates are valid for 3 years [P][S197].
- The list could not be read from the research environment. The founder must download it from the ANCS website and choose ≥ 2 firms.

### 2.2 Message (FR)

> **Objet :** Demande de devis — tests d'intrusion et audit de sécurité (application SaaS, Tunisie)
>
> Madame, Monsieur,
>
> Nous souhaitons recevoir une estimation pour :
> 1. un **test d'intrusion** d'une application web et d'une API (console agents, page de suivi client, API REST), en boîte grise, référentiel OWASP ASVS niveau 2 ;
> 2. un test de **pré-production** incluant l'isolation multi-clients et la revue de configuration de l'infrastructure ;
> 3. le cas échéant, l'**audit réglementaire** prévu par le décret-loi n°2023-17 (chef de mission certifié par l'ANCS).
>
> Merci d'indiquer le nombre de jours par prestation, le tarif journalier, les livrables, la certification de vos auditeurs et vos disponibilités. Les prestations ne débuteront pas avant [date à préciser] ; une estimation budgétaire suffit à ce stade.
>
> Cordialement, [Prénom Nom] — [Coordonnées]

## 3. Accessibility audit (WCAG 2.2 AA)

| Scope | Timing | Basis |
|---|---|---|
| Agent console + customer status page (FR/AR, RTL), with screen-reader and keyboard testing by an expert with assistive-technology users | Phase 11 gate | PRD release criteria; MVP cost line 15–30k TND [A] |

Ask the same firms (some security firms also audit accessibility) or a specialised accessibility consultancy, using the same message adapted to the scope.

## 4. Comparison sheet

[../data/quote-comparison.csv](../data/quote-comparison.csv) has one row per quote, across all categories:
- legal (see the [counsel brief](counsel-engagement-brief.md))
- trademark ([attorney brief](trademark-attorney-brief.md))
- language review ([review pack](native-language-review-pack.md))
- hosting
- pen test / audit
- accessibility audit

**When are the quotes "Met"?** E-07 is met when there are **≥ 2 hosting quotes** and **≥ 2 pen-test/audit quotes**, and a CTO or lead engineer has reviewed the MVP effort estimate. The cost model ([20](../20-updated-financial-assumptions.md) §20.7) is then re-run with the quoted values in place of the [A] estimates.
