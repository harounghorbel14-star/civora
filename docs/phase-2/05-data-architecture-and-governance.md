# 5. Data Architecture and Governance

| | |
|---|---|
| Decisions | ADR-003 (PostgreSQL per-tier clusters, schema per module, RLS), ADR-018 (classification, inventory, governance), ADR-022 (identifiers, time, money), ADR-024 (migrations), ADR-020 (object storage), ADR-029 (backup, DR, residency) |
| Original deliverables | **O-D3** data inventory and classification (§5.3 and [data/data-inventory.csv](data/data-inventory.csv)); **O-A3** PostgreSQL clusters; **O-DB1** empty base schemas; **O-DB2** migration tooling |
| Built in Phase 2 | Three PostgreSQL 16 clusters in the dev cell; schemas `iam`, `config`, `audit` (empty, annotated); node-pg-migrate with an up → down → up test against PostgreSQL 16 |
| Unchanged from Phase 0 | Principles §9.1, layout §9.2, field encryption §9.6, audit design §9.7, retention defaults §9.8, backup §9.9, schema governance §9.10 |

## 5.1 Classification (Phase 0 §10.1, unchanged)

| Tier | Examples | Minimum controls |
|---|---|---|
| **T0 — Special category** | Health, biometric data, minors' health | Separate deployable, cluster and keys; MoH/INPDP authorisation before real data; break-glass with review; field encryption; no export; strongest monitoring |
| **T1 — High** | National identifiers, civil status, identity attributes, **financial data**, social security, KYC evidence, consent/audit records | Field encryption; blind indexes; ABAC; access logging visible to the subject; MFA for all staff |
| **T2 — Moderate** | Case metadata, appointments, contact details, notification history | Encryption at rest; RBAC + tenant RLS; logging |
| **T3 — Public** | Procedures, catalogue, Guide corpus, rule-pack texts | Integrity controls (signing, review workflow) |

**Financial data domain (R-3).**
- Complaint content, account references, amounts and banking-secrecy material are **T1**.
- The institution is the **controller** and CIVORA the **processor** [A — counsel B3].
- Financial data never leaves the tenant: no cross-tenant use, no analytics outside the tenant, no AI processing outside the cell.

## 5.2 Physical layout per cell

| Store | Tier | Schemas / contents | Phase 2 state | Isolation |
|---|---|---|---|---|
| `pg-public` | T3 | `catalogue`, Guide corpus, translations, published rule-pack texts | Running (dev cell), empty | Separate credentials; replicable |
| `pg-core` | T1/T2 | `iam`, `config`, `cases`, `appointments`, `wallet`, `payments`, `notifications`, `integrations` | Running; `iam`, `config` created | RLS per tenant; field encryption for T1 columns |
| `pg-consent-audit` | T1 (metadata) | `audit`, `consent` | Running (separate cluster). In the walking skeleton `audit` sits on `pg-core` and **moves before the first audit row is written** (Phase 3) | Append-only roles; hash chain; WORM-style backups |
| `fhir-store` | T0 | FHIR resources (health-bridge only) | Not created (Phase 7) | Separate segment, credentials, keys; no access from core |
| Redis | T2, transient | Sessions, rate limits, queues | Running (password required, AOF) | No T0/T1 payloads; short TTLs |
| Object storage | T1/T2 | Uploads, generated PDFs, exports | Running (SeaweedFS, anonymous access refused) | Per-tenant bucket or prefix; envelope encryption; object lock for evidence |

**Operating model (ADR-003):**
- **dev:** containers.
- **staging, pilot, production:** PostgreSQL 16 on dedicated database nodes with Patroni (high availability) and pgBackRest (backup and PITR), managed by Ansible. This matches Phase 0 §9.9.
- In-cluster database pods are used only for local rehearsal.

## 5.3 Data inventory and classification (O-D3)

**File:** [data/data-inventory.csv](data/data-inventory.csv) (one row per data item).

**Columns:** domain, item, example fields, tier, personal data, special category, store and schema, owning module, role (controller/processor), lawful basis (assumption pending counsel), default retention, protection, phase built.

| Domain | Items | T0 | T1 | T2 | T3 |
|---|---|---|---|---|---|
| Platform and tenancy | 6 | 0 | 1 | 1 | 4 |
| Identity and access | 7 | 0 | 4 | 3 | 0 |
| Financial (Workspace RF) | 9 | 0 | 6 | 3 | 0 |
| Government | 5 | 0 | 3 | 2 | 0 |
| Health | 2 | 2 | 0 | 0 | 0 |
| Audit and consent | 4 | 0 | 4 | 0 | 0 |
| Communications | 3 | 0 | 0 | 3 | 0 |
| AI | 3 | 0 | 0 | 1 | 2 |
| Operations | 4 | 0 | 0 | 2 | 2 |
| **Total** | **43** | **2** | **18** | **15** | **8** |

**Rules for keeping the inventory true:**
1. **Schema annotations are the source** (Phase 0 §9.10). Every table and column gets a `COMMENT` with `@tier`, `@pii`, `@retention` and `@basis`. The base schemas already carry tier comments.
2. From Phase 3, a CI script reads `pg_description` after migrations and **fails** in either case:
   - a column has no `@tier`;
   - a T0/T1 column is not in the inventory.
   The CSV is then regenerated from the annotations and reviewed.
3. Any new personal-data field needs the DPO's review in the migration pull request (Phase 0 §9.10). Until a DPO is appointed, counsel reviews it.
4. The inventory feeds the INPDP declaration ([Phase 1 draft](../phase-1/validation/inpdp-declaration-draft.md)) and each tenant's record of processing.

## 5.4 Identifiers, encryption and time (ADR-022)

| Item | Rule |
|---|---|
| Primary keys | UUIDv7 (time-ordered; no business meaning) |
| National identifiers (CIN, passport) | AES-256-GCM with the per-tenant data key; HMAC-SHA-256 **blind index** with a cell secret for exact match. Never a primary key, never in logs or URLs |
| Phone, e-mail | Encrypted + blind index (login, recovery, OTP) |
| Money | Integer **minor units** + ISO 4217 code (TND has 3 decimals: millimes). Never floating point |
| Time | Stored as `timestamptz` (UTC). Deadlines are computed in the pack's time zone and calendar, and stored with the rule-pack version used |
| Synthetic data | Reserved ranges only: CIN `99xxxxxx`, phones `+2160xxxxxxx`, e-mail `@synthetic.invalid`. Guarded by the CI fitness check |

## 5.5 Module ownership and access

- **One schema per module**, owned by one migration role.
- The application role has `USAGE` and DML rights only on its schemas; it is not the owner, so **RLS cannot be bypassed**.
- No cross-module joins. Modules read each other through `public-api.ts` or domain events (ADR-001). CI enforces this.
- Reporting reads come from per-tenant projections built from events, not from cross-schema SQL.

## 5.6 Data lifecycle and retention

Retention defaults are those of Phase 0 §9.8. Overrides come from country packs and contracts.

| Stage | Mechanism |
|---|---|
| Collect | Minimum fields (Annex 1 of BCT 2022-08 for complaints); purpose recorded per field group |
| Use | Policy-checked access; purpose in the audit event |
| Share | Only through adapters with a recorded purpose and legal basis; mediator export excludes internal notes (FR-26) |
| Retain | Retention class on each table; legal hold flag on cases |
| Delete | Scheduled purge jobs (BullMQ) with audit events; crypto-shredding when a tenant leaves; backups expire on their own schedule |

## 5.7 Data residency (R-5)

- Every store, backup, log, trace and metric of a cell stays in the cell's country (ADR-029). The OpenTofu cell module **refuses** a node outside the country (precondition, tested).
- Sub-processors that handle personal data must be in Tunisia (PRD §12.7). Messaging gateways in the dev cell are simulated.
- The development and CI environments abroad hold **synthetic data only** (D9). The CI fitness check rejects non-synthetic identifiers in code and fixtures.

## 5.8 Analytics

- Phase 2–6: per-tenant reporting only, computed inside the cell.
- Any later analytics store receives de-identified extracts only (k-anonymity ≥ 10 [A]; Phase 0 §9.10). It needs its own ADR and a DPIA.
