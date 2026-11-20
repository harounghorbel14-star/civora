# 20 — Hosting provider assessment and provider-independent deployment

| | |
|---|---|
| Status | **Research complete on public sources (20 Nov 2026). No provider selected, nothing purchased, no contract signed.** Selection needs quotes (Phase 1 evidence E-07) and the founder's decision |
| Decisions it depends on | D9 (hosting policy, approved in Phase 0); ADR-019 (customer-hosted parity), ADR-029 (backup and second site), ADR-003 (database servers) — the ADRs are **Proposed** |
| Inputs | Phase 1 [quote requests](../phase-1/validation/quote-requests.md) §1 (hosting RFQ, already drafted) and [quote comparison sheet](../phase-1/data/quote-comparison.csv) |

## 20.1 What CIVORA needs from a provider

The architecture brings its own Kubernetes (RKE2), database tier (Patroni, pgBackRest), object storage and observability. So the provider only has to supply plain infrastructure. A managed Kubernetes or managed PostgreSQL service is **not** required. Not depending on one keeps the bank on-premises option (ADR-019) identical to the cloud option.

| Requirement | Why | Hard gate? |
|---|---|---|
| All processing and storage in Tunisia | D9; Law 2004-63 Art. 50–52 | **Yes** |
| Current **N-Cloud** label (ANCS, decree-law 2023-17); G-Cloud as a later option for government-hosted services | Phase 1 RFQ; regulated tenants | **Yes for pilot** (staging may use any Tunisian host under D9) |
| **Two sites** in Tunisia, or a second provider for site B | ADR-029; runbook §8 (second-site repository and standby cluster) | Yes for pilot/production |
| Virtual machines with a private network between them, and a private link between the two sites | Kubernetes, database, backup nodes (§20.4) | Yes |
| ISO/IEC 27001 certificate covering the hosting service | Security assurance for financial-institution tenants | Strongly preferred |
| Data-centre resilience (Uptime Institute Tier certificate, or audited equivalent) | Availability target (PRD) | Preferred |
| Contract: audit right, breach notification, reversibility (data return and deletion), no subcontracting abroad | Law 2004-63; BCT outsourcing expectations (counsel to confirm) | Yes |
| Price | Budget O-BUD (100–150k TND for the phase) | Scored after quotes |

## 20.2 Candidates and public evidence

Sources are listed in §20.7. "Not found" means not found in public sources on 20 Nov 2026; the RFQ asks each provider to confirm it.

**Caution on the label list.** The official list is published by ANCS (www.ancs.tn), which could not be reached from the research environment. Secondary sources disagree about who holds a *current* label in 2026, and labels must be renewed every year. **The founder should confirm each provider's current label certificate before any shortlisting.**

| Provider | Label (evidence) | Data centres and resilience (evidence) | ISO 27001 (evidence) | Cloud offer relevant to CIVORA | Managed Kubernetes / PostgreSQL |
|---|---|---|---|---|---|
| **DataXion** (Poulina Group) | N-Cloud (cited in a 2026 profile and the Sept 2025 ANCS list as reported) | Tunis; **Uptime Institute Tier IV certified (2021)** | ISO 27001:2022; also **PCI DSS v4.0.1** (2026 profile) | IaaS; Veeam Cloud & Service Provider | Not found |
| **Tunisie Telecom** | N-Cloud (July 2024; listed again 2025) | Several sites incl. Carthage; Tier III certification **not confirmed** (an older ITU text says "in progress") | Carthage DC: ISO 27001, **ISO 27701** (privacy) and ISO 9001, re-certified June 2025 (TÜV Rheinland) | IaaS, Virtual Data Centres (with Next Step), backup | Not found |
| **Next Step IT** | First N-Cloud label (5 Apr 2024) | Not found (operates VDC offers with Tunisie Telecom) | ISO 27001 and ISO 9001 (company statement) | Cloud, managed services, outsourcing | Not found |
| **Ooredoo Tunisie** | N-Cloud (July 2024); one 2026 secondary source says no longer listed — **unverified** | Mghira DC described as Tier III by the operator (2017), no certificate found | ISO 27001 from 2016; current validity not confirmed | IaaS (historically with Cloud Temple) | Not found |
| **NEOLedge** | N-Cloud (Sept 2025 list as reported); national cloud-provider prize (Oct 2025) | Not found | Not found | Not found in detail | Not found |
| **Focus Technology Solutions** | N-Cloud (announced 2024) | Not found | Not found | Not found in detail | Not found |
| **RFC (Réseaux Formation et Conseils)** | N-Cloud (renewal reported pending in 2026 — unverified) | Not found | Not found | IaaS/PaaS (reported) | Not found |
| **EO Data Center**, **3S** | **G-Cloud** (11 Jul 2024) | EO: Tunis and Enfidha; described as Tier III (2019 claim; no current certificate found) | Not found | Government cloud (needs connection to the national administration network) | Not found |
| **Orange Tunisie** | No label found | New Sousse DC (May 2025), "Tier III-compliant" (no certificate found); sovereign cloud announced as a future step | Not found | Hosting, backup, DR | Not found |

**Findings:**
- No Tunisian candidate publicly offers managed Kubernetes or managed PostgreSQL. This confirms the decision to bring our own (RKE2 and Patroni), which is portable to any of them and to bank premises.
- No public prices exist for any candidate: price can only be scored from quotes.
- No candidate publishes an infrastructure API with an OpenTofu/Terraform provider. VMs are ordered through a portal or contract, and our "static" hosting adapter (§20.5) is the right integration.

## 20.3 Ranking (provisional, on public evidence; to be re-scored with quotes)

Scoring, 0–5 per criterion × weight. Residency and a current N-Cloud label are pass/fail gates, not scores. Price (weight 20) is **not scored** until quotes arrive. The ranking below therefore covers 80 of the 100 points.

| Criterion (weight) | DataXion | Tunisie Telecom | Next Step IT | Ooredoo Tunisie |
|---|---|---|---|---|
| Security certifications (15) | 5 — ISO 27001:2022 + PCI DSS | 4 — ISO 27001 + 27701 | 3 — ISO 27001 (self-stated) | 2 — 2016 evidence only |
| Availability / resilience (15) | 5 — Tier IV certified | 3 — no Tier certificate found | 2 — not found | 2 — self-declared Tier III |
| Second site in Tunisia (15) | 2 — one site found; second provider likely needed | 5 — several national sites | 3 — via partners | 3 — not confirmed |
| Fit for our stack: VMs + private networking (10) | 4 | 4 | 4 | 3 |
| Backup / DR services (5) — we run our own; provider snapshots are a bonus | 4 — Veeam CSP | 4 | 4 | 3 |
| Regulatory suitability: banks, health, government (10) | 4 — PCI DSS helps with banks | 5 — state operator; ISO 27701 privacy | 3 | 3 |
| International expansion (10) — reach beyond Tunisia | 2 | 2 | 2 | 3 — group present in other countries |
| **Weighted score (of 80)** = Σ(score × weight) ÷ 5 | **60** | **62** | **46** | **42** |

**Provisional order: 1. Tunisie Telecom (62), 2. DataXion (60), 3. Next Step IT (46), 4. Ooredoo Tunisie (42).** The top two are within the uncertainty of public evidence: DataXion leads on certified resilience and certifications; Tunisie Telecom on second-site coverage and regulatory profile. Scores are a reading of public evidence, not of contracts. NEOLedge, Focus and RFC could not be scored: too little public information. They should still receive the RFQ. G-Cloud providers matter only for government-hosted services (Phase 11+).

**Recommendation (for the founder's decision):**

1. **Send the existing RFQ** ([quote requests §1](../phase-1/validation/quote-requests.md)) to Tunisie Telecom, DataXion and Next Step IT first, and to Ooredoo, NEOLedge, Focus and RFC if their labels are current. Add the topology in §20.4 and the questions in §20.6.
2. **Preferred shape:**
   - **main site:** the best-scoring provider after quotes;
   - **second site** (repository 2 and standby cluster): either the same provider's other site, or Tunisie Telecom, whose several sites make it a natural second-site partner.
   - Two providers remove the single-provider dependency, but cost an inter-site link. The quotes decide.
3. **Staging can start sooner:** D9 allows a synthetic-data staging cell on any Tunisian host. The IaC needs no change (§20.5).

## 20.4 Sizing to quote (from the IaC, not estimated per provider)

| Environment | Main site | Second site | Source |
|---|---|---|---|
| Staging | 3 Kubernetes servers + 2 agents, 2 database, 1 backup | 1 backup (repository 2) | `infra/tofu/envs/staging-tn` |
| Pilot (recommended topology) | 3 Kubernetes servers + 2 agents, **3 database** (ADR-003 condition), 1 backup | 1 backup + **2 database (standby cluster)** | `infra/tofu/envs/pilot-tn` |

Per-VM sizes are in [16](16-infrastructure-plan.md) §16.2. Network:
- private VLAN per site;
- encrypted inter-site link;
- one public address per cell, for the gateway (ADR-030, Proposed).

## 20.5 Deployment automation that does not depend on the provider

Choosing a provider changes **one input**: the list of VMs. Nothing else is redesigned.

| Layer | Provider-specific? | What it does |
|---|---|---|
| Hosting adapter `infra/tofu/modules/hosting-static` | **Only the node list** (name, address, role, country, zone, site) from the provider's hand-over | Same output contract for any provider, a bank's premises, or a future API-driven adapter |
| Cell module `infra/tofu/modules/cell` | No | Guards (residency, quorum, backup zone, second site, standby placement), Ansible inventory. Tested with `infra/scripts/tofu-guards.sh` (2 environments plan; 4 unsafe topologies refused) |
| Ansible `infra/ansible/site.yml` | No | OS hardening, RKE2, database tier with second site |
| Argo CD `infra/argocd` | No | Platform services and the application |
| Rehearsals on GitHub runners | No | The same roles and charts, from nothing, nightly |

**From contract to a staging cell (O-AC1):**
1. The provider hands over the VMs and network.
2. Fill the node list in `envs/staging-tn`.
3. `tofu apply`, which only produces the inventory.
4. `ansible-playbook site.yml`.
5. Bootstrap Argo CD.
6. Run the smoke tests and the timed rebuild.

The remaining effort is 8–12.5 engineer-days ([16](16-infrastructure-plan.md) §16.7).

## 20.6 Questions to add to the RFQ

1. A copy of the current N-Cloud certificate (date and expiry), and of the ISO 27001 certificate with its **scope** and Statement of Applicability.
2. Uptime Institute (or equivalent) certificate per site, and the distance between the two sites.
3. Are any operations or support performed from outside Tunisia? Are there subcontractors, and where?
4. Private network between VMs, an inter-site link (bandwidth, encryption), and IPv6.
5. VM-level snapshots and backup options (not required, but useful), and their location.
6. Audit right, breach notification time, data return and deletion at the end of contract.
7. Prices: monthly per VM size, storage per TB, inter-site link, public IP. Minimum term.

## 20.7 Sources (consulted 20 Nov 2026)

- ANCS list of labelled cloud providers (Sept 2025), as referenced: <https://www.ancs.tn/sites/default/files/2025-10/liste-label-cloud-ANCS-fr-110925.pdf> (not reachable from the research environment; **to be checked directly**)
- Labels N-Cloud/G-Cloud launch: <https://realites.com.tn/fr/tunisie-lancement-des-labels-des-fournisseurs-de-services-dinformatique-en-nuage-n-cloud-et-g-cloud/>
- 3S and EO Data Center G-Cloud (Jul 2024): <https://kapitalis.com/tunisie/2024/07/13/tunisie-3s-et-eo-data-center-recoivent-le-label-g-cloud/>
- Focus N-Cloud: <https://www.leaders.com.tn/article/35962-focus-obtient-le-label-n-cloud-renforcant-ainsi-sa-position-en-tant-que-fournisseur-cloud-de-confiance-en-tunisie>
- Tunisie Telecom N-Cloud (Jul 2024): <https://leconomistemaghrebin.com/2024/07/20/technologies-tunisie-telecom-obtient-label-fournisseur-de-services-informatiques-en-nuage-national-n-cloud>
- Tunisie Telecom Carthage DC ISO 27001/27701/9001 (Jun 2025): <https://www.tuniscope.com/article/407749/tech/telephone/tunisie-telecom-certifie-son-data-center-carthage-492212>
- ITU, Cloud computing (Tier III "in progress" for Carthage): <https://www.itu.int/en/publications/Documents/tsb/2020-Cloud-computing-From-paradigm-to-operation/files/basic-html/page1112.html>
- Ooredoo N-Cloud (Jul 2024): <https://www.leconomistemaghrebin.com/2024/07/17/certification-ncloud-ooredoo-tunisie-premier-operateur-certifie-label-n-cloud/>
- DataXion Tier IV (2021): <https://www.leconomistemaghrebin.com/2021/02/23/dataxion-premier-datacenter-tunisie-certifie-tier-iv/>; ten-year profile (2026): <https://www.leconomistemaghrebin.com/2026/05/13/dataxion-a-dix-annees-une-fierte-pour-lecosysteme-cloud-tunisien/>
- Next Step / Tunisie Telecom VDC (2022): <https://www.webdo.tn/fr/actualite/national/tunisie-telecom-et-next-step-vers-plus-dinnovation-et-dagilite-cloud-aux-entreprises/132345/>
- NEOLedge national prize (Oct 2025): <https://managers.tn/2025/10/23/neoledge-obtient-le-prix-national-du-fournisseur-de-services-de-cloud-computing/>
- Orange Tunisie Sousse DC (May 2025): <https://www.webmanagercenter.com/2025/05/06/545641/orange-tunisie-inaugure-un-nouveau-data-center-a-sousse-pour-repondre-aux-enjeux-numeriques-de-demain/>
- 2026 data-centre overview (secondary, unverified label list): <https://www.novahoster.tn/blog/datacenters-tunisie-hebergement-site-web/>
