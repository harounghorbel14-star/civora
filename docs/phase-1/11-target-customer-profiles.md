# 11. Target Customer Profiles

These profiles are **hypotheses** to validate in the 90-day discovery programme ([supporting/user-research-kit.md](supporting/user-research-kit.md) §8.12). Government-track personas (Amira, Hédi, Yassine, Nour) are retained in [supporting/government-product-strategy-v1.md](supporting/government-product-strategy-v1.md).

## 11.1 Ideal customer profiles (organisations) — first product

| ICP | Who | Size signals | Triggers to buy | Likely objections | Success metric for them |
|---|---|---|---|---|---|
| **ICP-1 Payment provider** | Licensed payment institution or PSP (wallets, acquiring, transfers) | 20–200 staff; 10k–500k customers; fast growth | New licence; BCT inspection; complaint volume growing with users; app-store reviews | "Too early / too small"; price | Complaints answered in deadline; inspection-ready evidence |
| **ICP-2 Mid-size bank** | Resident universal bank outside the largest group | 50–150 branches [A]; dedicated complaints unit | Audit/inspection findings; mediator escalations; digital-channel push; legacy tool end-of-life | Incumbent vendor; IT security review; on-prem demand | % within deadline; time to resolution; fewer mediator cases |
| **ICP-3 Specialised financial institution** | Microfinance/SME bank, leasing, factoring | High volume of simple cases; regional branches | Regulatory reporting burden; manual registers | Budget | Simple compliance reporting |
| **ICP-4 Expansion: insurer / telco / utility** | Insurance company; mobile operator; STEG/SONEDE-type utility | Large customer base | Customer-experience programmes; regulator pressure [A] | Existing CRM | Resolution time; customer satisfaction |
| **ICP-5 Government institution** (Division A) | Social fund, ministry service line, municipality, consulate | Public budget or donor programme | Simplification programme; citizen complaints; donor project | Procurement; hosting rules | Processing time; status enquiries |

## 11.2 Buying roles (ICP-1/2/3)

| Role | Typical title | Cares about | What they need from CIVORA |
|---|---|---|---|
| **Economic buyer** | Deputy CEO / Head of Retail / Head of Compliance | Regulatory risk, reputation, cost | Business case, compliance mapping to BCT 2022-08, references |
| **Champion** | Head of Customer Relations / Complaints Manager | Team workload, deadlines, visibility | Demo with their categories; quick wins |
| **Technical evaluator** | CIO / CISO / IT architect | Security, hosting, integration, vendor risk | Architecture pack, pen-test report, on-prem option, SSO, data-residency statement |
| **Compliance / DPO** | Compliance officer, DPO | Audit trail, retention, INPDP obligations | DPIA template, processor agreement, retention controls |
| **Procurement** | Purchasing | Price, terms, vendor solidity | Clear pricing, SLAs, escrow, exit clauses |

## 11.3 User personas — first product

| Persona | Role | Goals | Frustrations (hypothesised) | Design implications |
|---|---|---|---|---|
| **Sana** (36) — Complaints handler, mid-size bank HQ | Processes 20–40 cases/day | Clear queue; no missed deadlines; quick, compliant replies | Spreadsheets and email threads; chasing branches for documents; rewriting the same letters | Deadline-sorted queue; templates with reason codes; one-click request to branch |
| **Mehdi** (44) — Branch manager | Logs complaints from customers at the counter | Log fast; tell the customer when they'll hear back | No feedback on cases sent to HQ | 2-minute intake form; printed/SMS reference; branch view of status |
| **Rim** (39) — Head of Customer Relations | Owns policy, staffing, reporting | Hit deadlines; spot recurring issues; prepare annual board report | Manual report compilation; no root-cause data | Dashboards by category/branch/product; report generator |
| **Karim** (50) — Correspondent to the banking mediator & BCT | Liaison for escalated cases and regulator requests | Fast, complete case files for the mediator; no surprises | Reconstructing case history from emails | Escalation workspace; complete exportable case file with audit trail |
| **Ines** (31) — Compliance officer / DPO | Checks compliance and data protection | Evidence that rules and retention are applied | Audit questions she can't answer quickly | Immutable audit log; retention policies; access reports |
| **Youssef** (28) — Customer of a payment app | Disputes a failed transfer | Know someone is handling it and when it will be resolved | Silence; repeating the story | Mobile status page in AR/FR; clear next step and deadline; mediator information if unsatisfied |
| **Admin Walid** (34) — IT / tenant administrator | Configures users, SSO, categories | Easy configuration; secure integration | Vendor lock-in; manual user management | SSO/SCIM later; configuration UI; export |

## 11.4 Anti-personas (not designing for)

- Large banks wanting a full CRM replacement. Out of scope: integrate, don't replace.
- Organisations wanting to monetise complaint data for marketing. Contrary to the Charter.
