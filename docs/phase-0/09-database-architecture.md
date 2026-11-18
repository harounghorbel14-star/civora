# 9. Database Architecture

> Logical design for approval. The physical DDL is produced in Phase 2/3 and reviewed by the security lead and DPO.

## 9.1 Principles

1. **Pointer, not copy.** Store references to authoritative records (registry, document number hash, FHIR resource URL) rather than the records themselves, unless a copy has a lawful basis, a purpose and a retention period.
2. **Separate by sensitivity tier.** Different clusters, credentials, keys and backup policies for T0, T1, T2 and T3 data (tiers defined in Section 10).
3. **Internal identifiers are meaningless.** UUIDv7 primary keys. National identifiers (CIN, IUC, passport no.) are never primary keys:
   - They are stored encrypted, with an HMAC "blind index" for exact-match lookup.
   - They are only stored where the service needs them.
4. **Unlinkability across relying parties.** Pairwise pseudonymous subject IDs per institution or relying party.
5. **Tenant isolation.** `tenant_id` on every tenant-scoped row, enforced by PostgreSQL Row-Level Security, plus application checks.
6. **Everything time-bound.** Each table has a retention class. Purge jobs are tested and audited.
7. **Append-only where trust matters.** Audit, consent receipts and status histories are never updated in place.

## 9.2 Physical layout per country cell

| Cluster | Tier | Contents | Notes |
|---|---|---|---|
| `pg-public` | T3 | Service catalogue, procedures, Guide corpus + embeddings (pgvector), translations | No personal data; replicable to edge for performance |
| `pg-core` | T1/T2 | Schemas: `iam`, `cases`, `appointments`, `wallet`, `payments`, `notifications`, `integrations`, `config` | RLS per tenant; field-level encryption for T1 columns |
| `pg-consent-audit` | T1 (metadata) | `consent`, `audit` | Append-only roles; hash chain; WORM-style backups |
| `fhir-store` | T0 | FHIR resources (health-bridge only) | Separate network segment, credentials, keys; no direct access from core |
| `redis` | T2 (transient) | Sessions, rate limits, queues | No T0/T1 payloads; encryption in transit; short TTLs |
| `object-store` | T1/T2 | Uploaded documents, generated PDFs, credential backups (encrypted) | Per-tenant buckets; server-side + envelope encryption; object lock for evidence |

## 9.3 Core entity model — identity, mandates, consent, audit

```mermaid
erDiagram
  TENANT ||--o{ CONSENT : scopes
  PERSON ||--o{ ACCOUNT : has
  ACCOUNT ||--o{ AUTHENTICATOR : uses
  ACCOUNT ||--o{ SESSION : opens
  PERSON ||--o{ IDENTITY_CLAIM : "verified by"
  PERSON ||--o{ MANDATE : "grants (principal)"
  PERSON ||--o{ MANDATE : "holds (agent)"
  PERSON ||--o{ PAIRWISE_ID : "known to RP as"
  PERSON ||--o{ CONSENT : gives
  CONSENT ||--o{ CONSENT_EVENT : "history"
  PERSON ||--o{ ACCESS_LOG_ENTRY : "subject of"
  AUDIT_EVENT }o--|| AUDIT_CHAIN : "chained in"

  PERSON {
    uuid id PK
    text country_code
    text preferred_language
    timestamptz created_at
  }
  ACCOUNT {
    uuid id PK
    uuid person_id FK
    text status
    text assurance_level
  }
  AUTHENTICATOR {
    uuid id PK
    uuid account_id FK
    text type "passkey|totp|sms"
    bytea public_key_or_secret_enc
    timestamptz last_used_at
  }
  IDENTITY_CLAIM {
    uuid id PK
    uuid person_id FK
    text source "national_eid|kyc_vendor|self_asserted"
    text identifier_type
    bytea identifier_enc
    bytea identifier_blind_idx
    text loa
    timestamptz verified_at
    timestamptz expires_at
  }
  MANDATE {
    uuid id PK
    uuid principal_person_id FK
    uuid agent_person_id FK
    text legal_basis "parental|guardianship|voluntary"
    text[] scopes
    timestamptz valid_from
    timestamptz valid_to
    timestamptz revoked_at
  }
  PAIRWISE_ID {
    uuid person_id FK
    text relying_party_id
    text subject_id
  }
  CONSENT {
    uuid id PK
    uuid person_id FK
    uuid tenant_id
    text purpose_code
    text[] data_categories
    text recipient
    timestamptz expires_at
    text status
    jsonb receipt_signed
  }
  CONSENT_EVENT {
    uuid id PK
    uuid consent_id FK
    text event "granted|used|revoked|expired"
    timestamptz at
  }
  ACCESS_LOG_ENTRY {
    uuid id PK
    uuid subject_person_id
    text actor_type
    text actor_ref
    text purpose_code
    text data_category
    text legal_basis_ref
    timestamptz at
  }
  AUDIT_EVENT {
    bigint seq PK
    uuid tenant_id
    text actor
    text action
    text resource
    jsonb context_minimal
    bytea prev_hash
    bytea hash
    timestamptz at
  }
```

## 9.4 Core entity model — catalogue, cases, appointments, wallet, payments

```mermaid
erDiagram
  SERVICE ||--o{ SERVICE_VERSION : versions
  SERVICE_VERSION ||--o{ REQUIREMENT : requires
  SERVICE_VERSION ||--o{ SOURCE_REF : "cited from"
  SERVICE_VERSION ||--o{ CASE : instantiates
  CASE ||--o{ CASE_EVENT : "status history"
  CASE ||--o{ CASE_DOCUMENT : attaches
  CASE ||--o{ TASK : "work items"
  CASE ||--o| APPOINTMENT : "may book"
  OFFICE ||--o{ SLOT : offers
  SLOT ||--o| APPOINTMENT : "booked as"
  CASE ||--o{ PAYMENT_INTENT : "may require"
  PAYMENT_INTENT ||--o{ PAYMENT_EVENT : history
  PERSON ||--o{ CREDENTIAL : holds
  CREDENTIAL }o--|| ISSUER : "issued by"
  ISSUER ||--o{ STATUS_LIST : publishes

  SERVICE {
    uuid id PK
    text code
    uuid tenant_id
    text owner_institution
  }
  SERVICE_VERSION {
    uuid id PK
    uuid service_id FK
    jsonb title_i18n
    jsonb steps_i18n
    numeric fee
    text currency
    date effective_from
    date last_verified
    text verified_by
  }
  SOURCE_REF {
    uuid id PK
    text url
    text publisher
    date retrieved_at
    text checksum
  }
  CASE {
    uuid id PK
    uuid tenant_id
    uuid service_version_id FK
    uuid applicant_person_id
    uuid acting_agent_id
    text status
    timestamptz sla_due_at
    text external_ref
  }
  CASE_EVENT {
    uuid id PK
    uuid case_id FK
    text from_status
    text to_status
    text actor_ref
    text reason_code
    timestamptz at
  }
  CASE_DOCUMENT {
    uuid id PK
    uuid case_id FK
    text object_key
    text doc_type
    text sha256
    text verification_status
  }
  APPOINTMENT {
    uuid id PK
    uuid slot_id FK
    uuid case_id FK
    text status
  }
  PAYMENT_INTENT {
    uuid id PK
    uuid case_id FK
    numeric amount
    text currency
    text provider
    text provider_ref
    text status
    text idempotency_key
  }
  CREDENTIAL {
    uuid id PK
    uuid holder_person_id
    text format "vc+sd-jwt|mdoc|w3c-vc"
    text type
    bytea payload_enc
    timestamptz valid_until
    text status_list_ref
  }
```

## 9.5 Health data (T0)

- Stored only in the **FHIR store** behind health-bridge, using standard FHIR R4 resources: Patient, Practitioner, Organization, Encounter, Condition, Observation, DiagnosticReport, ImagingStudy (references only; images stay in the source PACS), MedicationRequest, MedicationStatement, AllergyIntolerance, Immunization, Coverage, Consent, AuditEvent, Provenance.
- Terminologies per country pack: ICD-10/ICD-11, LOINC, ATC. SNOMED CT requires a licence (country membership) [U for Tunisia].
- In "bridge" mode (preferred), the FHIR store holds **only consent, access-grant and cache records with short TTL**. Clinical data is fetched from the authoritative source on demand.
- Retention follows national medical-record rules. Telemedicine data must be kept ≥10 years in Tunisia [P][S48], which applies when CIVORA operates an *authorised* telemedicine platform.

## 9.6 Identifiers and field-level encryption

| Data | Storage | Lookup |
|---|---|---|
| National ID numbers (CIN, IUC, passport) | AES-256-GCM, per-tenant data key (envelope, KMS) | HMAC-SHA-256 blind index with a cell-specific secret |
| Phone, email | Encrypted | Blind index for login/recovery |
| Names, date of birth | Encrypted for T1 contexts; plaintext only in display caches with short TTL | Not searchable except by authorised officers via exact match |
| Documents (uploads) | Object storage, envelope-encrypted, per-tenant buckets | By case reference |
| Biometrics | **Not stored by CIVORA.** Liveness/face-match results only (score, vendor reference, timestamp) | — |

## 9.7 Audit and access log design

- **Two layers:**
  - `audit_event`: system-wide, security-oriented, hash-chained.
  - `access_log_entry`: citizen-facing ("who accessed my data, when, why").
- Hash chain: `hash = SHA-256(prev_hash || canonical(event))`. The chain head is **anchored daily**: signed by the HSM and stored off-cluster, optionally timestamped by a qualified time-stamping service.
- Partitioned by month; write-only DB role for the application; read via a dedicated audit service.
- Audit records contain references and purpose codes, **never payload contents**.

## 9.8 Retention schedule (defaults; overridden by country pack and contracts)

| Data class | Default retention | Basis |
|---|---|---|
| Guide conversations (no account) | 30 days, then aggregated statistics only | Minimisation [A] |
| Guide conversations (opt-in history) | Until user deletes, max 12 months | Consent |
| Cases & case events | Per institution's archival rules (typically years) | Contract / public archives law [A — verify] |
| Uploaded documents | Until case closure + institution-defined period | Contract |
| KYC evidence (B2B) | As required by BCT / AML rules for the client bank | Client's legal obligation [P][S51] |
| Consent receipts & history | Life of consent + 5 years [A] | Accountability |
| Audit events | ≥ 5 years [A]; longer if regulator requires | Security / accountability |
| Sessions, OTPs | Minutes to days | Security |
| Telemedicine records | ≥ 10 years | Decree 2022-318 [P][S48] |

## 9.9 Backup, recovery and integrity

- pgBackRest full weekly, differential daily, WAL continuous. Encrypted with keys separate from production keys. Second in-country site.
- **Monthly restore drill** into an isolated environment, with checksum comparison and an application smoke test. Results recorded in the integration/ops register. A backup is only "verified" once restored.
- Object storage versioning; object lock on evidence buckets.

## 9.10 Schema governance

- Migrations are versioned, forward-only and reviewed by two engineers, plus the DPO for any new personal-data field.
- A **data inventory** is generated from schema annotations (`@pii`, `@tier`, `@retention`). It feeds INPDP declarations and Records of Processing Activities (RoPA).
- Analytics never run against production personal data. Aggregated, de-identified extracts (k-anonymity ≥ 10 [A]) go into a separate analytics store only when needed.
