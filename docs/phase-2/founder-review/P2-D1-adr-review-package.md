# P2-D1 Founder Review Package — the 29 Architecture Decisions

| | |
|---|---|
| Decision requested | **P2-D1**: approve, approve with conditions, reject or defer each of the 29 Architecture Decision Records (ADRs) |
| Status of all 29 ADRs | **Proposed.** None is approved. Nothing in this package approves anything on your behalf |
| Why it matters | Acceptance criterion **O-AC2** ("all ADRs approved") cannot close without your decision. Phase 2 also cannot be accepted before Phase 1 (P1-D12 still pending) |
| Prepared | 19 November 2026, from the latest pushed commit (`6d5dc0e`) |
| Reading time | About 20 minutes for §1–§3 (the five priority decisions); about 60 minutes for everything |
| Decision form | [P2-D1-decision-form.csv](P2-D1-decision-form.csv): one row per ADR, decision columns empty |


> **Update, 20 Nov 2026.** ADR-030 (Apache APISIX as edge gateway) was added, so there are now 30 ADRs.
> - The six decisions that matter most (ADR-003 with the 3-server condition, ADR-030, ADR-006, ADR-016, ADR-019, ADR-020) and recommendations for P2-D2 to P2-D5 are in decision-ready form in [P2-final-technical-decision-package.md](P2-final-technical-decision-package.md).
> - Nothing has been approved.

## 1. How to use this package

### 1.1 What an ADR is

An Architecture Decision Record is a one-page note that says:
- what we decided about how the platform is built;
- why;
- what else we considered;
- what it costs us.

It exists so that, a year from now, anyone can see why the platform looks the way it does. The full ADRs are in [../adr/](../adr/README.md). This package explains them without technical jargon; §2 is a glossary.

### 1.2 Your four options for each ADR

| Option | Meaning | What happens next |
|---|---|---|
| **Approve** | "Build it this way." | The ADR status becomes *Accepted* with the date |
| **Approve with conditions** | "Yes, but only if…" (for example "only if counsel confirms X") | The condition is written into the ADR; work that depends on the condition waits for it |
| **Reject** | "Not this way." | Engineering writes a replacement proposal showing the impact (§4 of each explanation says what that impact would be) |
| **Defer** | "I need more information." | Your questions are answered in writing; the ADR stays *Proposed* |

You can decide all 29 at once, in groups, or one at a time.

### 1.3 Three groups — where your judgement matters most

| Group | ADRs | What your decision really means |
|---|---|---|
| **A. Already approved in substance by Phase 0** | 001, 002, 004, 005, 011, 012, 013, and most of 003 | You approved the technology stack on 18 Nov 2026 (decision **D7**: TypeScript, PostgreSQL, Keycloak, modular monolith, country cells, Kubernetes/OpenTofu/Argo CD). These ADRs write down *how*. Rejecting one **re-opens D7** |
| **B. Design only — nothing is built until a later phase** | 007 (Phase 7), 009 (Phase 4), 010 and 026 (Phase 10) | Approving fixes the boundaries now; the details are decided again when the phase starts. Cheap to change later |
| **C. New choices that need your judgement** | 003 (the database-operations part), **006**, 015, **016**, 017, 018, **019**, **020**, 021–025, 027, 028, 029 | These were not decided in Phase 0. **003, 006, 016, 019 and 020 are explained in depth in §3** |

### 1.4 How the decisions depend on each other

| If you reject… | …these are also affected |
|---|---|
| 003 (PostgreSQL operations) | 024 (migrations), 029 (backups), 016 (row-level security is part of tenant isolation) |
| 004 (country cells) | 019, 029, 017 — the whole data-residency design rests on cells |
| 006 (Cedar) | 016 (one of its isolation layers), 026 (agents use the same policies) |
| 012 (OpenBao) | 016 (per-tenant keys), 029 (encrypted backups) |
| 013 (Kubernetes etc.) | 019, 027, 029, all of `infra/` |
| 016 (tenancy tiers) | 019 (deployment tiers), commercial pricing tiers (Phase 1 [19](../../phase-1/19-commercial-and-pricing-strategy.md)) |
| 019 (customer-hosted) | 020 (licence of storage software matters only if we ship to customers), Phase 1 Enterprise pricing tier |

## 2. Glossary (plain language)

| Term | Meaning |
|---|---|
| **Cell** | A complete, separate copy of the platform installed in one country (or at one customer). Its data never leaves it |
| **Tenant** | One customer institution (a bank, a leasing company, a ministry) inside a cell |
| **Row-level security (RLS)** | A database feature that hides other tenants' rows even if the application asks for them by mistake |
| **Policy engine** | A component that answers "may this person do this action on this item?" from written rules |
| **Encryption key per tenant** | Each customer's sensitive fields are locked with its own key. Destroying the key makes the data unreadable ("crypto-shredding") |
| **HSM** | Hardware security module: a tamper-resistant device that holds the most important keys |
| **Kubernetes** | Software that runs and restarts our application containers on a group of servers |
| **IaC (infrastructure as code)** | Servers and settings described in files, so an environment can be rebuilt automatically |
| **S3 / object storage** | A standard way to store files (attachments, letters, exports), supported by many products |
| **Backup / PITR** | Copies of the database; point-in-time recovery means restoring to any minute, not just last night |
| **RPO / RTO** | Maximum data loss allowed (RPO ≤ 15 min) and maximum time to recover (RTO ≤ 4 h) for pilots |
| **Air-gapped** | Installed without Internet access, as many banks require on their own premises |
| **SBOM / signed image** | A list of every component inside our software, and a digital seal proving the software came from our build |
| **Open-source licence (Apache-2.0, AGPL-3.0, BSL)** | Rules for using others' software. Apache-2.0 is permissive. AGPL-3.0 can require us to publish source code when we distribute or offer it as a service. BSL restricts some commercial uses |

## 3. The five priority decisions (in depth)

### 3.1 ADR-003 — How we run PostgreSQL databases

**What it means.**
- All data is stored in **PostgreSQL** (already approved in D7).
- Data is split by sensitivity into separate database clusters:
  - public content;
  - core customer and case data;
  - consent and audit records;
  - later, health data.
- Each internal module has its own area (schema) inside a cluster.
- Every table that holds a customer institution's data has row-level security, so one bank can never see another bank's rows, even through a programming mistake.
- **The new part needing your judgement:** in staging, pilot and production, the databases run on **their own dedicated servers**, not inside the Kubernetes cluster:
  - **Patroni** gives automatic failover if a database server dies;
  - **pgBackRest** takes the backups;
  - both are configured automatically by our Ansible scripts.

**Why it is necessary.**
- The database holds everything a bank cares about: complaints, deadlines, the audit trail.
- How we run it decides how safely we can recover from failures and how easily we pass a bank's or the BCT's inspection.
- Phase 0 (§9.9) already named pgBackRest; this ADR keeps it.

**Alternatives considered.**

| Option | Description | Why not chosen |
|---|---|---|
| **A. Dedicated database servers + Patroni + pgBackRest** (proposed) | Classic, widely used setup; database administrators at banks know it | — |
| B. Database inside Kubernetes with an "operator" (CloudNativePG) | Kubernetes manages the database for us | Replaces pgBackRest (named in Phase 0) with another backup tool; its images could not even be downloaded in our build environment; harder to explain to bank DBAs on their premises |
| C. Managed database from the hosting provider | The provider runs it | No such service is confirmed on Tunisian labelled clouds [U — to check in quotes]; impossible on customer premises |
| D. One database per customer institution by default | Maximum separation | Much higher cost and operations for small institutions; offered instead as an option (see ADR-016) |

**Advantages.**
- Proven, boring technology.
- The same model works in our cloud **and** on a bank's premises.
- Backups follow Phase 0.
- Easy to audit.
- No dependency on a Kubernetes add-on.

**Disadvantages.**
- More servers to manage.
- One more Ansible role is needed. **Update 19 Nov 2026:** it has been written and tested on containers in advance (see "Work already done" below).
- Database upgrades are done by us, not automated by an operator.

**Security implications.**
- **Positive:** databases sit in their own network zone, reachable only from the application. Backups use separate keys. The audit cluster can have write-once backups. Row-level security adds a last line of defence for tenant isolation.
- **To watch:** row-level security must be switched on for every table. Forgetting it is a silent risk, so an automatic CI check is planned before the first real table (Phase 3).

**Financial implications.**
- **Servers:** per staging cell, 2 database servers + 1 backup server out of 8 servers in total ([16](../16-infrastructure-plan.md) §16.2). Production needs a second Tunisian site, so roughly double.
- **Prices:** real costs depend on the hosting quotes you are collecting (E-07). No price is assumed here.
- **Engineering:** the role was estimated at 4–6 days; it has now been written (about one engineer-day, as provider-independent preparation). Routine maintenance remains.

**Operational implications.**
- Someone on the team must be comfortable with PostgreSQL operations (failover tests, upgrades, restore drills every month).
- This is normal for a platform that holds regulated data.

**Reversible?** **Partly.**
- The "PostgreSQL, separated by sensitivity, with row-level security" part is hard to change later and is already approved (D7).
- *Where* the database runs (servers vs Kubernetes operator) can be changed later with a planned migration: about 1–2 weeks per environment [A], plus a maintenance window.

**If you reject it.**
- Option B (operator) would be proposed instead: it would also change the backup tool named in Phase 0 and needs reachable images.
- Option C needs a provider that offers it.
- Rejecting the row-level-security part would weaken tenant isolation. A database per tenant (option D) would then be the safe alternative, at higher cost.

**Work already done, pending your decision (19 Nov 2026).**

The Ansible role `postgresql_ha` was written so that staging can be built quickly once a provider is chosen. It was tested on three containers, not on real servers. The test covered:
- a cluster with automatic failover;
- encrypted backups to a separate node;
- a restore drill that verifies data checksums.

Writing it does **not** approve ADR-003. If you reject ADR-003, the role is set aside and the alternative is designed instead. Results: [17](../17-technical-validation-strategy.md) §17.2.

**A choice the testing revealed: two or three database servers per site.**

The platform runs PostgreSQL in "synchronous" mode, so a confirmed save is never lost when a server fails. Testing showed the price of that guarantee with only two database servers. A controlled experiment confirmed it: no automatic takeover for 120 s, then normal recovery once the leader returned. In normal conditions takeover took 29 s with no lost saves.
- if the leader fails while the second server is not yet fully in step (for example, just after a restart), automatic failover is **refused**;
- a human must then choose between waiting and forcing a failover that may lose the last few seconds of saves.

| Option | Data safety | Automatic recovery | Cost |
|---|---|---|---|
| 2 database servers, synchronous (current staging design) | No confirmed save lost | Blocked in the rare case above | Lowest |
| **3 database servers**, synchronous (engineering recommendation for bank production) | No confirmed save lost | Still automatic if one server is unavailable | One more database server per site (in hosting quotes) |
| 2 servers, asynchronous | May lose the last seconds of saves | Always automatic | Lowest |

**Measured on 20 Nov 2026** (test servers in containers, not real hardware):

| Situation | 2 database servers | 3 database servers |
|---|---|---|
| Leader server crashes, normal conditions | Takeover in 23–25 s, no confirmed save lost | Takeover in 36 s, no confirmed save lost |
| Leader crashes while another server is already down or restarting | Writes stop until a person acts. Forcing the takeover lost **all 50 saves** made in that window | Takeover **automatic** (35 s), nothing lost |
| The application during a crash | Keeps running and reconnects by itself, through the new `pg-router` component | Same |

The "two or three servers" choice is therefore about this rare situation. With two servers it costs either downtime or lost saves; with three it costs one more server per site.

You can approve ADR-003 with a condition such as "3 database servers per production site".

- **Also done, within ADR-003 (not a new decision):** a small component, `pg-router`, always sends the application to whichever database server is currently in charge.
- **Also done, within ADR-003 (not a new decision):** the running application uses a database account that cannot bypass the per-institution separation rules.

**Questions you may want answered first.**
- Do the hosting providers you are asking for quotes offer managed PostgreSQL in Tunisia with backups in a second Tunisian site?
- Would your first bank customers want to run the database themselves?

**Engineering recommendation:** approve.

---

### 3.2 ADR-006 — The rules engine for "who may do what" (Cedar)

**What it means.**
- Every time someone opens, edits or exports a case, the platform asks a rules engine: *"Is this person allowed to do this, on this item, now?"*
- The rules are written in a small, readable language called **Cedar**, stored with the code, and tested automatically.
- Examples of rules already written and tested:
  - a complaint handler sees only cases of their own bank and their own unit;
  - only the designated BCT correspondent can export a case for the banking mediator;
  - an administrator can change deadline settings only after a second login factor (MFA);
  - CIVORA staff can read a case only in an emergency ("break-glass"), with MFA and a written reason, and never change it;
  - health data can be read only for care purposes with recorded consent.

**Why it is necessary.**
- Banking secrecy and Law 2004-63 require that access is limited and provable.
- If these rules are scattered through the code, nobody can review them, and mistakes go unnoticed.
- Phase 0 said "OPA or Cedar — evaluate both in Phase 2". We did.

**Alternatives considered (all tested on the same 24 situations).**

| Option | Result | Why not chosen |
|---|---|---|
| **A. Cedar** (proposed) | 24/24 correct; rules checked against a typed schema before deployment | — |
| B. OPA (Rego language) | 24/24 correct; about 30× faster | Rules are harder for non-engineers to read; no enforced schema, so mistakes surface later |
| C. Rules hand-written in the application code | Not tested | Hard to review, hard to audit, easy to get wrong |
| D. OpenFGA | Not tested | Built for "relationship" permissions (like file sharing); not needed for our rules |

**Advantages.**
- Rules read almost like plain sentences ("permit … when …", "forbid … unless …"). A compliance officer, a bank's auditor or the BCT can follow them.
- A typo in a rule (for example a wrong field name) is caught before deployment.
- "Forbid" always wins over "permit". That is the safe default for banking secrecy.
- Free, open source (Apache-2.0); runs inside our application, so there is no extra server.

**Disadvantages.**
- Slower than OPA in our setup: about **0.25 ms** per decision instead of 0.008 ms. That is still thousands of times below our 1.5-second response target, so users will not notice.
- Producing "the list of all cases I may see" is less mature in Cedar; we use the database (row-level security and normal queries) for lists instead.

**Security implications.**
- **Positive:** one reviewed place for all access rules; the 24-case test suite runs on every change; break-glass and tenant isolation are explicit and tested.
- **Risk:** a wrong rule could grant too much access. This is mitigated by:
  - the schema check;
  - the test cases;
  - a security review of every rule change;
  - row-level security as a second barrier.

**Financial implications.**
- No licence cost.
- Engineering cost is similar to OPA.
- Easier rules lower the cost of audits and of explaining access control to banks.

**Operational implications.**
- Rules are versioned with the platform.
- A country or customer can *add* restrictions, but cannot remove the platform's "forbid" rules.

**Reversible?** **Yes, easily.**
- The rules are under 100 lines, and the 24 test cases do not depend on the engine.
- Switching to OPA later costs about **3–5 engineer-days** [A] and is proven by re-running the same test cases.

**If you reject it.**
- OPA would be proposed (also free and fully tested in the spike).
- Rejecting both would mean hand-written checks. Engineering advises against that for a product sold on auditability.

**Engineering recommendation:** approve.

---

### 3.3 ADR-016 — How customer institutions are kept apart (multi-tenancy)

**What it means.**
- Many institutions share one installation (a cell). Each institution is a **tenant**.
- By default they share the same servers and databases, but are kept apart by **six layers**:
  1. the tenant comes only from the user's verified login, never from what the browser sends;
  2. the rules engine forbids any cross-tenant access (ADR-006);
  3. the database is told which tenant is working, for each transaction;
  4. row-level security hides other tenants' rows;
  5. each tenant's sensitive fields are encrypted with its own key;
  6. every access is written to the tamper-evident audit trail.
- For institutions that want more separation, three stronger tiers exist **with the same software**:

| Tier | What the customer gets | Who it suits |
|---|---|---|
| **Shared** (default) | Six layers above | Most institutions, all small ones |
| **Dedicated database** | Own database, own keys | Banks that require physical data separation |
| **Dedicated cell** | Whole installation for one bank, run by CIVORA in Tunisia | Large banks; outsourcing or regulator requirements |
| **Customer-hosted cell** | Installed on the bank's own premises (ADR-019) | Banks that cannot outsource |

- When a customer leaves, it receives a complete export with checksums. Its encryption key is then destroyed, so any remaining copies, including in backups, become unreadable.

**Why it is necessary.**
- Banking secrecy (Law 2016-48 Art. 61) means a leak between two banks would be existential for CIVORA.
- At the same time, one installation per small institution would be too expensive to sell at the Phase 1 price hypotheses (Starter 1,500–2,500 TND/month).

**Alternatives considered.**

| Option | Why not chosen |
|---|---|
| A separate database for every customer, always | Highest separation, but cost and operations grow with every customer; small institutions become unprofitable. Kept as a paid tier |
| A separate database "schema" per customer | Every software update must touch every customer separately; the database becomes slow to manage |
| Shared only, no stronger tiers | Would exclude large banks that demand separation |

**Advantages.**
- One codebase for all customer sizes.
- Low cost per small customer.
- Large banks can buy more separation.
- Customer exit and "right to be forgotten" are handled by destroying a key.

**Disadvantages.**
- The shared tier depends on discipline: every new table and every new screen must respect the layers. This is enforced by automatic tests planned for Phase 3.
- Moving a customer from one tier to another needs a tested export/import tool (Phase 6/13).

**Security implications.**
- This is the most security-critical decision in the set.
- Cross-tenant access is threat **T-04** in the threat model. It is rated **High** before controls (likelihood 2 × impact 3 = 6) and **Low** after them.
- The external security review (O-AC3) is asked explicitly whether the shared tier is enough for Tunisian banks, or whether the dedicated database should be the default for banks.

**Financial implications.**
- **Shared tier:** the cheapest to run.
- **Dedicated tiers:** need extra servers and support time, and are meant to be priced higher. Phase 1's Enterprise hypothesis is 8,000–15,000 TND/month as SaaS — *unvalidated, P1-D9*.
- **Engineering:** the isolation layers are part of normal Phase 3 work. Tier-move tooling is later work, roughly **2–3 weeks** [A].

**Operational implications.**
- Per-tenant keys must be managed (ADR-012).
- Support staff never see customer data except through audited break-glass.

**Reversible?** **The default is hard to reverse; the tiers are easy to adjust.**
- Changing the default from shared to "dedicated database for everyone" later is possible, but needs migrating each customer.
- Adding or removing an optional tier is easy.

**If you reject it.**
- The likely alternative is "a dedicated database per bank by default". It is safer to explain, but costs more per customer and needs more operations work from day one.
- Pricing (Phase 1 §19) would need to be revisited.

**Condition you may want to attach.**
- "Approve, but revisit the default for banks after the external security review and the first bank interviews (E-03)."

**Engineering recommendation:** approve, with that condition if you wish.

---

### 3.4 ADR-019 — Where the platform can be installed, including on a bank's premises

**What it means.** The same software can be delivered four ways:

| Tier | Who runs it | Where | Notes |
|---|---|---|---|
| 1. Shared cell | CIVORA | Labelled Tunisian cloud | Default SaaS |
| 2. Shared cell with dedicated database | CIVORA | Same | ADR-016 tier |
| 3. Dedicated cell | CIVORA | Labelled cloud, for one customer | Customer chooses maintenance windows |
| 4. **Customer-hosted cell** | The customer, or CIVORA under contract | The bank's own data centre, or CNI for government | Delivered as a sealed package that installs **without Internet** |

The tier-4 package contains:
- the software;
- its installation files;
- the Tunisia configuration pack;
- the list of components (SBOM);
- digital signatures and checksums;
- release notes.

The bank can check that nothing was altered before installing it.

**Why it is necessary.**
- Some banks may not be allowed, or may not want, to put customer complaints in an outside cloud.
- The outsourcing notice to the BCT (Law 2016-48 Art. 81) is still being analysed by counsel.
- Government systems may have to run at CNI.
- Without tier 4, those customers are out of reach.
- Phase 1's Enterprise pricing already includes "on-prem/private deployment" (licence hypothesis 100–180k TND/year + 20% support).

**Alternatives considered.**

| Option | Why not chosen |
|---|---|
| SaaS only | Simpler, but may exclude the largest banks and government |
| A separate "on-premises edition" of the software | Two products to maintain; features drift apart |
| Decide later | The software must avoid any Internet dependency from day one, or tier 4 becomes very expensive to add |

**Advantages.**
- Keeps the bank and government markets open, whatever counsel concludes.
- Strong sovereignty story.
- The same artefacts serve every tier.

**Disadvantages.**
- Supporting installations we do not control is harder:
  - customers update at different speeds;
  - problems are harder to diagnose without access.
- Each customer-hosted site needs a support contract and an upgrade policy (for example: "customers must stay within two versions of the latest").

**Security implications.**
- **Positive:** data never leaves the bank. Signed packages let the bank check what it installs.
- **Negative:**
  - security patches depend on the customer applying them;
  - we cannot monitor their installation;
  - the bank's own security level becomes part of the risk.

  Contracts must define patch timelines.

**Financial implications.**
- **Revenue:** a licence plus support model is possible (Phase 1 hypothesis above, unvalidated).
- **Costs:**
  - building the release package and the install and upgrade tooling: about **2–3 engineer-weeks** [A] before the first tier-4 customer;
  - per-customer installation and support time;
  - possibly on-site visits.
- **No cost now.** The design choices (no Internet dependency, air-gap support) are already in place.

**Operational implications.**
- Needs a release discipline: signed bundles, upgrade notes, a supported-versions policy.
- Needs a support process that respects the customer's access rules (for example, screen-sharing sessions instead of direct access).

**Reversible?** **Yes for tiers 3–4 as an offer** — you can stop offering them at any time. **Hard to add later** if the design rules are dropped now.

**If you reject it.**
- The platform is designed as SaaS only. Engineering would then be free to use services that need Internet access.
- If counsel later says banks cannot outsource, re-adding tier 4 would cost much more than keeping it now.

**Condition you may want to attach.**
- "Keep the design rules (no external dependency, air-gap support), but build the tier-4 package only when a customer signs for it."

**Engineering recommendation:** approve, with that condition if you wish.

---

### 3.5 ADR-020 — Where files are stored (object storage)

**What it means.**
- Attachments, generated letters, exports and evidence files are stored through the **S3 standard**. Many products and hosting providers support it, so we are not tied to one supplier.
- Required features:
  - versioning (old versions are kept);
  - **object lock** (a file marked as evidence cannot be deleted or changed until a set date);
  - per-customer separation;
  - encryption with the customer's key.
- **Which product:**
  - on developers' laptops: **SeaweedFS** (Apache-2.0 licence);
  - in staging and production: the hosting provider's S3 service, if it offers object lock in Tunisia; otherwise a storage system we run ourselves, chosen when the provider is known (candidates: Ceph, SeaweedFS, Garage);
  - **MinIO is not chosen.**

**Why MinIO is not chosen.**
- Phase 0 mentioned "MinIO or the host's object store".
- In our build environment the MinIO image could not be downloaded (19 Nov 2026).
- MinIO's community edition is under the **AGPL-3.0** licence. If we ship it inside customer-hosted packages (ADR-019), or modify it, AGPL obligations may apply. Counsel would need to check this, and MinIO's commercial licence costs money.
- Using only the S3 standard keeps this decision cheap to change.

**Alternatives considered.**

| Option | Why not chosen |
|---|---|
| MinIO | Licence questions for distribution; image unavailable in our environment; commercial licence is a cost |
| Store files on a normal disk or inside the database | No versioning or object lock; the database becomes huge; backups slow |
| One specific cloud provider's storage | Ties us to that provider; impossible on customer premises |

**Advantages.**
- No vendor lock-in.
- Licence-safe default.
- Evidence files can be made unalterable.
- Works the same in every deployment tier.

**Disadvantages.**
- Each candidate storage product must be checked for object lock and replication support before production.
- If the provider has no S3 service, we must operate storage ourselves (more servers, more operations).

**Security implications.**
- **Positive:**
  - files are encrypted with the customer's key;
  - anonymous access is refused (tested);
  - evidence cannot be altered once locked;
  - download links expire and are logged.
- **Risk:** a misconfigured "public" bucket is a classic cause of data leaks (threat T-21). This is mitigated by refusing anonymous access by default and by automated checks.

**Financial implications.**
- **Provider storage:** priced per gigabyte and month (in the quotes you are collecting).
- **Self-run storage:** extra servers plus operations time.
- **Licences:**
  - SeaweedFS, Ceph and Garage are free;
  - MinIO's commercial licence would be a cost;
  - MinIO under AGPL may be free but carries legal questions.

**Operational implications.**
- Backups and replication of files to the second Tunisian site (ADR-029).
- Lifecycle rules delete files when their retention ends.

**Reversible?** **Yes, easily.**
- The application only speaks the S3 standard.
- Changing the product means copying the files and changing a setting: about **2–5 days** per environment [A], depending on volume.

**If you reject it.**
- If you prefer MinIO, engineering would ask counsel to confirm the AGPL position for customer-hosted packages, or budget a commercial licence.
- If you prefer one provider's storage, customer-hosted cells would still need a separate solution.

**Engineering recommendation:** approve.

## 4. The other 24 ADRs

Each table answers the same eight questions. "[A]" marks an estimate.

### ADR-001 — One main application, with three parts kept separate (Group A)

| Question | Answer |
|---|---|
| What it means | The platform is one main application (`civora-core`) divided internally into modules (cases, notifications, identity…). Three parts run separately because their rules differ: health data (Phase 7), the AI guide (Phase 10), and the signing-key service (Phase 4) |
| Why necessary | A team of 6–8 engineers cannot run dozens of small services. Health and AI have different legal boundaries |
| Alternatives | Many small services ("microservices") from day one; one unstructured application |
| Advantages | Simple to build, test and run; modules can be split out later without rewriting |
| Disadvantages | A fault in one module can affect the whole application; module boundaries need discipline (checked automatically) |
| Security | Health data is physically separate from day one; fewer network connections between services means fewer attack points |
| Financial / operational | Fewer servers and less operations work than microservices |
| Reversible? | Yes. A module can be moved into its own service later (weeks per module [A]) |
| If rejected | Re-opens D7; microservices would add significant cost before any customer exists |

### ADR-002 — One programming language everywhere: TypeScript (Group A)

| Question | Answer |
|---|---|
| What it means | Web, mobile and server code are all written in TypeScript, with strict error checking |
| Why necessary | One language for a small team; shared code for translations and validation |
| Alternatives | Go or Java for the server |
| Advantages | Large local talent pool; one toolset |
| Disadvantages | Heavy calculations need separate workers; newer framework versions (NestJS 12, TypeScript 7) are deliberately not adopted yet |
| Security | Strict typing prevents some classes of bugs; dependency supply chain is watched (ADR-027) |
| Financial / operational | Hiring is easier; one CI pipeline |
| Reversible? | Hard for the main application; easy for new separate services (each would need an ADR) |
| If rejected | Re-opens D7; slows everything down |

### ADR-004 — One installation per country; data never crosses borders (Group A)

| Question | Answer |
|---|---|
| What it means | Each country gets its own complete installation ("cell") with its own data, keys and backups. Cells never talk to each other. Our central systems hold only software and non-personal settings |
| Why necessary | Law 2004-63 Art. 50–52 forbids sending personal data abroad without INPDP authorisation; D9 requires Tunisian hosting for real data |
| Alternatives | One worldwide platform with regions |
| Advantages | Data residency is guaranteed by design; the same model serves dedicated and customer-hosted installations |
| Disadvantages | Each new country is a new installation to operate |
| Security | A breach in one cell does not reach others; no cross-border support access by default |
| Financial / operational | One set of servers per country; justified by law |
| Reversible? | Hard (it is the foundation of the residency design) |
| If rejected | Re-opens D7/D9; the data-residency guarantee would need another basis |

### ADR-005 — Logins handled by Keycloak (Group A)

| Question | Answer |
|---|---|
| What it means | Keycloak (open-source, self-hosted) handles all logins. Bank staff log in with their bank's own system (single sign-on). Customers checking a complaint use the case reference plus a one-time code. Citizens later use passkeys first, SMS codes only as a fallback |
| Why necessary | Banks want their staff to use existing accounts; no foreign login service may hold identities |
| Alternatives | One Keycloak "realm" per customer; other products (Ory) or custom code |
| Advantages | Proven, free, supports bank login standards and modern passkeys |
| Disadvantages | Upgrades need care; we operate it ourselves |
| Security | Multi-factor login enforced; administrators use hardware keys; short-lived tokens |
| Financial / operational | No licence; needs its own database and two servers' worth of capacity in production |
| Reversible? | Moderate (weeks [A]); login standards (OIDC/SAML) limit lock-in |
| If rejected | Re-opens D7; an alternative product must be evaluated |

### ADR-007 — Health-record software chosen later (Phase 7) (Group B)

| Question | Answer |
|---|---|
| What it means | We do not choose the health-record server (Medplum or HAPI FHIR) now. We only fix that health data lives in its own separate service, database and keys |
| Why necessary | Phase 0 put this choice in Phase 7; Health is a deferred division |
| Alternatives | Choose now |
| Advantages | No premature commitment |
| Disadvantages | One health-integration risk stays open until Phase 7 |
| Security | The separation of health data is already respected by everything else |
| Financial / operational | None now |
| Reversible? | Yes (nothing built) |
| If rejected | We would have to choose now, without a health product or partner |

### ADR-008 — Reliable background work (outbox + queues) (Group A)

| Question | Answer |
|---|---|
| What it means | When something happens (a complaint is filed), the "event" is saved in the same database step, then processed in the background (SMS, e-mails, reports). Nothing is lost if a server crashes |
| Why necessary | Acknowledgements and deadline alerts must never be lost; slow outside systems must not slow users down |
| Alternatives | Kafka from day one; sending directly after saving |
| Advantages | No lost events; little to operate |
| Disadvantages | Every background task must be safe to run twice |
| Security | Events carry references, not personal details |
| Financial / operational | Uses Redis we already need |
| Reversible? | Yes (the queue technology can be swapped behind an interface) |
| If rejected | A heavier message system would be proposed, with more operations work |

### ADR-009 — Digital credential standards (Phase 4) (Group B)

| Question | Answer |
|---|---|
| What it means | When we later issue digital documents (credentials), we use international standards (W3C, SD-JWT, OpenID4VC, ISO mDL) |
| Why necessary | To work with any future national or international digital wallet |
| Alternatives | Signed PDFs only |
| Advantages | Interoperability; selective disclosure (show only what is needed) |
| Disadvantages | Standards are still moving |
| Security | Issuer keys held in the HSM; revocation lists |
| Financial / operational | None now |
| Reversible? | Yes (nothing built) |
| If rejected | Choice deferred to Phase 4 |

### ADR-010 — How the AI guide must behave (Phase 10) (Group B)

| Question | Answer |
|---|---|
| What it means | The future AI guide may answer only from official sources and must cite them. Personal data is removed before any AI model sees a question. Foreign AI services may be used only for public content, with the client's approval; anything personal uses models hosted in Tunisia |
| Why necessary | D10 (approved) and the risk of wrong official guidance |
| Alternatives | A free-form chatbot |
| Advantages | Rules fixed before any AI code exists |
| Disadvantages | Tunisian GPU capacity is unknown |
| Security | No personal data abroad; prompt-injection defences required |
| Financial / operational | GPU cost decided in Phase 10 |
| Reversible? | Yes (nothing built) |
| If rejected | Re-opens D10 for AI |

### ADR-011 — Monitoring kept in-country, with no personal data in logs (Group A)

| Question | Answer |
|---|---|
| What it means | Performance and error monitoring tools run inside each cell. Logs never contain names, ID numbers or message content |
| Why necessary | Logs are a common leak path; foreign monitoring services would send data abroad |
| Alternatives | Paid foreign monitoring services |
| Advantages | Residency and privacy by design |
| Disadvantages | We run the monitoring tools ourselves |
| Security | Fewer copies of personal data; alerts for suspicious access |
| Financial / operational | Free software; storage and some operations time |
| Reversible? | Yes |
| If rejected | Re-opens D7; a residency-compliant alternative is needed |

### ADR-012 — Secrets and encryption keys (OpenBao + hardware security module) (Group A)

| Question | Answer |
|---|---|
| What it means | Passwords and keys are kept in OpenBao (an open-source vault). Each customer's sensitive fields are encrypted with its own key, protected by a hardware security module in production. Unlocking the vault needs several people together |
| Why necessary | Phase 0 §10.5; banking secrecy; crypto-shredding at customer exit |
| Alternatives | HashiCorp Vault (changed to a restrictive BSL licence in 2023); cloud key services (not confirmed in Tunisia) |
| Advantages | No secrets in code; per-customer keys; strong control of the most important keys |
| Disadvantages | The vault becomes critical: it must be highly available |
| Security | Central to the design; also removes single-person control of keys (threat T-26) |
| Financial / operational | HSM purchase or rental in production (to include in hosting quotes); key ceremonies |
| Reversible? | Moderate (re-keying effort) |
| If rejected | Re-opens D7; the per-tenant encryption layer of ADR-016 needs another basis |

### ADR-013 — How servers and installations are built and updated (Group A)

| Question | Answer |
|---|---|
| What it means | Applications run on Kubernetes: RKE2, a security-hardened version, for real installations; k3s, a lightweight version, for testing. Servers are described in files (OpenTofu and Ansible). Updates are *pulled* by each installation (Argo CD), so our build system never holds production passwords |
| Why necessary | Must work on Tunisian clouds, CNI and bank premises; safe, repeatable updates |
| Alternatives | Plain servers without Kubernetes; OpenShift (licence cost) |
| Advantages | Same method everywhere; rebuildable from files; Internet-free installation possible |
| Disadvantages | Kubernetes skills needed; not yet run on real servers (no provider) |
| Security | Hardened settings, restricted containers, default-deny network rules (all tested) |
| Financial / operational | Free software; learning curve; servers per hosting quotes |
| Reversible? | Hard after production starts; moderate before |
| If rejected | Re-opens D7; all of `infra/` would be redone |

**New question for you (found 19 Nov 2026, after this package was first written).**

- The "front door" software that Phase 0 chose for the MVP is no longer supported. Phase 0 said "NGINX ingress (MVP) → APISIX/Kong at pilot".
- The Kubernetes project stopped maintaining the community **ingress-nginx** in March 2026: there are no more security fixes.
- Options (details in ADR-013, "Open question"):
  - (a) use **APISIX** from the start, as Phase 0 planned for the pilot anyway;
  - (b) a different, maintained NGINX product;
  - (c) another maintained gateway until the pilot.
- Engineering recommends **(a)**: one migration fewer, and rate limits and API keys from day one.
- Nothing has been changed; this is your decision. You can answer it together with ADR-013 in the form's "conditions or questions" column.

### ADR-014 — Accessibility and Arabic right-to-left as release gates (Group A)

| Question | Answer |
|---|---|
| What it means | No screen is released unless it meets the WCAG 2.2 AA accessibility standard and displays Arabic correctly from right to left |
| Why necessary | Arabic is the default language in Tunisia; older and low-vision users |
| Alternatives | Check accessibility only before launch |
| Advantages | Quality built in; fewer costly fixes later |
| Disadvantages | Slightly slower screen delivery; translation review cost |
| Security | Neutral |
| Financial / operational | Review time per screen; already partly budgeted in Phase 1 (language review E-13) |
| Reversible? | Yes (but fixing later costs more) |
| If rejected | Accessibility becomes a risk at tender time (public procurement often requires it) |

### ADR-015 — Rules for our APIs (how other systems talk to us) (Group C)

| Question | Answer |
|---|---|
| What it means | Our APIs follow common standards: version numbers in the address (`/v1/`), a published contract checked automatically, standard error messages, protection against duplicate submissions, signed notifications |
| Why necessary | Banks' IT teams need stable, documented interfaces |
| Alternatives | GraphQL; writing the contract by hand first |
| Advantages | Predictable for customers; contract changes visible in review |
| Disadvantages | Contract quality depends on annotations in the code (now checked automatically: the contract is OpenAPI 3.1 and validated on every build) |
| Security | Strong authentication for bank systems (mutual TLS); every endpoint tested against cross-customer access |
| Financial / operational | Lower integration cost per bank |
| Reversible? | Yes before customers integrate; costly after (customers must change their systems) |
| If rejected | API style would be re-proposed before Phase 3 |

### ADR-017 — Country and regulation settings as checked configuration files (Group C)

| Question | Answer |
|---|---|
| What it means | Everything specific to Tunisia (languages, holidays, currency, ID formats) and to each BCT circular (deadlines, categories, report formats) lives in configuration "packs", not in code. Packs are sealed with checksums; the platform refuses to start if a pack was altered. Unknown values stay empty, never guessed |
| Why necessary | Regulations change; FR-66 requires rule packs; no hard-coded country logic |
| Alternatives | Rules written into the code; settings only in the database |
| Advantages | A new circular means a reviewed configuration change, not a software release; a new country means a new pack |
| Disadvantages | Packs need their own review process (compliance or counsel) |
| Security | A tampered deadline ceiling is detected (tested); test-only packs cannot run in production (tested) |
| Financial / operational | Cheaper regulatory updates |
| Reversible? | Yes |
| If rejected | Regulatory rules would be hard-coded, so every change needs a release |

### ADR-018 — Classifying and inventorying all data (Group C)

| Question | Answer |
|---|---|
| What it means | Every piece of data is labelled by sensitivity (T0 health … T3 public), with its owner, legal basis and retention. The inventory (43 items today) is generated from labels in the database, so it stays true |
| Why necessary | INPDP declarations, records of processing, bank due diligence |
| Alternatives | A spreadsheet maintained by hand |
| Advantages | Always-accurate inventory; supports DPIAs |
| Disadvantages | Every database change must carry labels (checked automatically) |
| Security | You cannot protect what you have not listed |
| Financial / operational | Saves time in audits and declarations |
| Reversible? | Yes |
| If rejected | A manual inventory, which tends to drift out of date |

### ADR-021 — Switching features on and off (feature flags) (Group C)

| Question | Answer |
|---|---|
| What it means | Features can be switched on per installation or per customer without a new release. Some switches (for example "real integrations") are locked and cannot be turned on by customers |
| Why necessary | Required by the original Phase 2 scope (O-F2); safe gradual releases |
| Alternatives | A paid flag service abroad (residency problem); a separate flag server |
| Advantages | No extra service; standard interface |
| Disadvantages | No graphical screen to manage switches yet |
| Security | Locked switches prevent unauthorised integrations (tested) |
| Financial / operational | Free |
| Reversible? | Yes |
| If rejected | A different flag mechanism would be proposed |

### ADR-022 — Conventions for IDs, dates, money and languages (Group C)

| Question | Answer |
|---|---|
| What it means | Internal record numbers are random-looking, never national ID numbers. Dates are stored in universal time; deadlines are computed on the Tunisian calendar. Money is stored in millimes (whole numbers), never decimals. Western digits are used for numbers in Tunisia |
| Why necessary | Exact deadlines and amounts; ID numbers must not leak through web addresses |
| Alternatives | Sequential record numbers (guessable) |
| Advantages | No rounding errors; no time-zone mistakes on deadlines |
| Disadvantages | Developers must use the shared helpers (checked in review) |
| Security | Record numbers cannot be guessed; national IDs are encrypted |
| Financial / operational | None |
| Reversible? | Hard after data exists; easy now |
| If rejected | Conventions would be re-proposed; risk of inconsistent data |

### ADR-023 — One code repository for everything (Group C)

| Question | Answer |
|---|---|
| What it means | All code lives in one repository with the folder structure set by the original Phase 2 specification. The repository stays "all rights reserved" until you decide on open source (D11) |
| Why necessary | Original deliverable O-D4 |
| Alternatives | Separate repositories per application |
| Advantages | One change can update several parts safely; one set of checks |
| Disadvantages | Checks take longer as the code grows |
| Security | One place to apply protections |
| Financial / operational | Less coordination work |
| Reversible? | Yes |
| If rejected | The original specification would need changing (the roadmap rules say not to) |

### ADR-024 — How database changes are made (migrations) (Group C)

| Question | Answer |
|---|---|
| What it means | Database changes are plain SQL files, reviewed by two people, applied automatically before each new version starts. Changes are made in two steps ("expand, then contract") so the previous version keeps working during an update |
| Why necessary | Original deliverable O-DB2; bank DBAs and auditors can read SQL |
| Alternatives | Changes generated by a programming framework (harder to review); a Java tool |
| Advantages | Readable, reviewable, safe during updates |
| Disadvantages | Developers write SQL by hand |
| Security | Every new personal-data field goes through privacy review |
| Financial / operational | No licence |
| Reversible? | Yes (tool can be changed; the SQL stays readable) |
| If rejected | Another tool would be proposed |

### ADR-025 — Test environments use invented data only (Group C)

| Question | Answer |
|---|---|
| What it means | Development and testing use only invented ("synthetic") people and complaints, with ID numbers from reserved ranges that cannot belong to real people. Production refuses the test configuration |
| Why necessary | Phase 0 §10.12; D9 allows development abroad only with synthetic data |
| Alternatives | Masked copies of real data (prohibited: risk of re-identification) |
| Advantages | Safe development anywhere; realistic tests |
| Disadvantages | Invented data may miss some real-world cases |
| Security | Real data cannot end up in test systems (automatic check) |
| Financial / operational | None |
| Reversible? | Not recommended to reverse |
| If rejected | A legal basis for using real data in testing would be needed (unlikely to exist) |

### ADR-026 — Rules for future AI agents (Phase 10) (Group B)

| Question | Answer |
|---|---|
| What it means | Future AI assistants act under their own identity, with only the permissions they need, and can only *suggest*. A human approves anything that changes a case, a deadline or a decision. AI never decides rights |
| Why necessary | Accountability; Division E rules; D10 |
| Alternatives | AI with broad system access |
| Advantages | AI fits into the existing audit and permission model |
| Disadvantages | Human approval limits automation (on purpose) |
| Security | Limits the damage from manipulated AI ("prompt injection") |
| Financial / operational | None now |
| Reversible? | Yes (nothing built) |
| If rejected | Rules would be decided in Phase 10 |

### ADR-027 — Protecting the software supply chain (Group C)

| Question | Answer |
|---|---|
| What it means | Every outside component is pinned to an exact version and scanned. Every build is scanned for vulnerabilities and secrets, produces a list of components, and is digitally signed. Installations accept only signed software |
| Why necessary | One compromised component would reach every installation; banks and auditors ask for this evidence |
| Alternatives | Floating versions without checks |
| Advantages | Known vulnerabilities went from 21 to 0 this week; verifiable packages for customer-hosted cells |
| Disadvantages | Updates must be applied actively (automated weekly proposals) |
| Security | Core protection against supply-chain attacks |
| Financial / operational | Free tools; some weekly review time |
| Reversible? | Yes, but not advisable |
| If rejected | Higher risk; harder bank due-diligence answers |

### ADR-028 — Connections to outside systems, and the six integration classes (Group C)

| Question | Answer |
|---|---|
| What it means | Every outside system (SSO, SMS, national registries, payments, core banking) is reached through an "adapter" with three modes: simulated, test and real. The real mode works only if the integration register says "authorised" with an agreement reference, a locked platform switch is on, and the customer has activated it |
| Why necessary | No integration is authorised today (register: 0 live); P1-D6 six-class scheme |
| Alternatives | Calling outside systems directly from the code |
| Advantages | No accidental unauthorised connection; honest demos |
| Disadvantages | Simulators must be maintained |
| Security | Prevents unauthorised data flows; every call logged with purpose |
| Financial / operational | Small extra effort per integration |
| Reversible? | Yes |
| If rejected | Integration safety would rely on manual discipline |

### ADR-029 — Backups, disaster recovery and keeping data in Tunisia (Group C)

| Question | Answer |
|---|---|
| What it means | Databases are backed up continuously (pgBackRest) to two Tunisian sites. Audit records get write-once backups. Restore is tested every month and disaster recovery every quarter. The infrastructure files refuse any server outside Tunisia (tested) |
| Why necessary | Pilot targets: at most 15 minutes of data lost and 4 hours to recover (PRD §12.7); residency |
| Alternatives | Nightly snapshots only (cannot meet 15 minutes) |
| Advantages | Meets the targets with standard tools; ransomware-resistant copies |
| Disadvantages | Needs a second Tunisian site |
| Security | Encrypted backups with separate keys; tamper-resistant audit copies |
| Financial / operational | Second-site servers and storage (in hosting quotes); drill time every month |
| Reversible? | Yes (targets can be changed by contract) |
| If rejected | Targets in PRD §12.7 would need revisiting |

## 5. Summary table

| ADR | Plain meaning | Group | Reversible | Engineering recommendation |
|---|---|---|---|---|
| 001 | One main application; health, AI, keys separate | A | Yes (per module) | Approve |
| 002 | TypeScript everywhere | A | Hard | Approve |
| **003** | **PostgreSQL by sensitivity; dedicated DB servers with Patroni + pgBackRest** | A/C | Partly | **Approve** |
| 004 | One installation per country | A | Hard | Approve |
| 005 | Keycloak for logins | A | Moderate | Approve |
| **006** | **Cedar rules engine** | C | Yes, easily | **Approve** |
| 007 | Health server chosen in Phase 7 | B | Yes | Approve |
| 008 | Reliable background work | A | Yes | Approve |
| 009 | Credential standards (Phase 4) | B | Yes | Approve |
| 010 | AI guide behaviour (Phase 10) | B | Yes | Approve |
| 011 | In-country monitoring, no personal data in logs | A | Yes | Approve |
| 012 | OpenBao + HSM; per-customer keys | A | Moderate | Approve |
| 013 | Kubernetes, IaC, pull-based updates | A | Hard after production | Approve |
| 014 | Accessibility and RTL gates | A | Yes | Approve |
| 015 | API rules | C | Costly after customers integrate | Approve |
| **016** | **Shared default with six isolation layers; stronger paid tiers** | C | Default hard, tiers easy | **Approve** (optionally: revisit bank default after security review) |
| 017 | Country and rule packs | C | Yes | Approve |
| 018 | Data classification and inventory | C | Yes | Approve |
| **019** | **Four deployment tiers incl. bank premises** | C | Yes (as offer) | **Approve** (optionally: build tier-4 package only on a signed customer) |
| **020** | **S3 standard; SeaweedFS in dev; not MinIO** | C | Yes, easily | **Approve** |
| 021 | Feature switches | C | Yes | Approve |
| 022 | IDs, dates, money, language conventions | C | Hard after data exists | Approve |
| 023 | One repository | C | Yes | Approve |
| 024 | SQL migrations, expand/contract | C | Yes | Approve |
| 025 | Synthetic data only in testing | C | Not advisable | Approve |
| 026 | AI agent rules (Phase 10) | B | Yes | Approve |
| 027 | Supply-chain protection | C | Not advisable | Approve |
| 028 | Adapters and integration classes | C | Yes | Approve |
| 029 | Backups, DR, residency | C | Yes | Approve |

These are **recommendations from engineering**, not decisions. Every ADR remains *Proposed* until you record your decision.

## 6. How to record your decision

Either:
- **fill in the decision form** ([P2-D1-decision-form.csv](P2-D1-decision-form.csv)): one of `approve`, `approve-with-conditions`, `reject`, `defer`, plus conditions or questions; or
- **reply in writing**, for example: "Approve all except ADR-016 (defer: I want the security adviser's view first) and ADR-019 (approve with condition: build the tier-4 package only when a customer signs)."

After your decision, engineering will:
1. change each ADR's status to *Accepted*, *Accepted with conditions*, *Rejected* or keep it *Proposed*, with the date and your wording;
2. update the [ADR index](../adr/README.md), the [readiness report](../phase-2-readiness-report.md) §3–§4 and the [traceability matrix](../19-traceability-matrix.md);
3. for each rejection, write a replacement proposal with its impact on the other ADRs (§1.4).

**Nothing in the repository will be marked approved until your decision is received.**
