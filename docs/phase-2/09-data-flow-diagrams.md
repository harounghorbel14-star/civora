# 9. Data-Flow Diagrams

| | |
|---|---|
| Purpose | Show where data moves, across which trust boundaries, at which tier. These diagrams are the basis of the STRIDE analysis in [08](08-threat-model.md) |
| Notation | Rectangles = processes; cylinders = stores; ovals/rounded = external entities; dashed subgraph borders = trust boundaries **TB1–TB10**. Flow labels give the data and its tier (T0–T3, Phase 0 §10.1). "Ph.N" = built in roadmap phase N |
| Status | Phase 2 design. Only DFD-4, the platform parts of DFD-5, and the dev-cell versions of the stores exist today |

## 9.1 Trust boundaries

| ID | Boundary | Between |
|---|---|---|
| TB1 | Internet ↔ cell edge | Users, B2B clients ↔ ingress/WAF |
| TB2 | Edge ↔ application | Ingress ↔ `civora-core`, Keycloak |
| TB3 | Application ↔ data | `civora-core` ↔ PostgreSQL, Redis, object storage |
| TB4 | Application ↔ keys | `civora-core` ↔ OpenBao / HSM |
| TB5 | Cell ↔ global layer | Argo CD in the cell ↔ Git / registry (pull only) |
| TB6 | Tenant ↔ tenant | Logical boundary inside shared stores (RLS, keys, policies) |
| TB7 | Core ↔ health-bridge | T0 zone (Phase 7) |
| TB8 | Core ↔ AI guide; guide ↔ model | AI zone (Phase 10) |
| TB9 | Adapters ↔ external systems | SSO IdPs, SMS/e-mail gateways, UXP (via member), PSPs |
| TB10 | Developer / CI ↔ repository and registry | Supply chain |

## 9.2 DFD-0: context

```mermaid
flowchart LR
  CUST(["Customer / citizen"])
  STAFF(["Institution staff"])
  B2B(["Institution systems"])
  OPS(["CIVORA operators"])
  EXT(["SSO IdP, SMS/e-mail, UXP, PSP"])
  GLOBAL(["Global layer: Git + registry"])
  subgraph TB1["TB1 cell boundary"]
    P0["CIVORA cell<br/>(all processes and stores)"]
  end
  CUST -- "case reference, OTP, complaint text (T1/T2)" --> P0
  P0 -- "status, decision letter (T1/T2)" --> CUST
  STAFF -- "case work, decisions (T1/T2)" --> P0
  B2B -- "API calls, webhooks (T1/T2)" --> P0
  OPS -. "break-glass reads (T1), audited" .-> P0
  P0 -- "SAML/OIDC, SMS, queries (T1/T2)" --> EXT
  GLOBAL -- "signed images, packs (T3)" --> P0
```

## 9.3 DFD-1: staff sign-in and case handling (Workspace RF, Ph.3–6)

```mermaid
flowchart LR
  STAFF(["Handler (browser)"])
  IDP(["Bank IdP"])
  subgraph TB1["TB1"]
    ING["P1 Ingress / WAF"]
  end
  subgraph TB2["TB2 application zone"]
    BFF["P2 Workspace BFF"]
    KC["P3 Keycloak"]
    CORE["P4 civora-core<br/>cases + policies"]
  end
  subgraph TB3["TB3 data zone"]
    PGC[("D1 pg-core<br/>T1/T2")]
    PGA[("D2 pg-consent-audit<br/>T1")]
    S3[("D3 object storage<br/>T1")]
  end
  subgraph TB4["TB4 keys"]
    BAO["P5 OpenBao transit"]
  end
  STAFF -- "F1 HTTPS login" --> ING --> KC
  KC -- "F2 SAML/OIDC (TB9)" --> IDP
  STAFF -- "F3 session cookie + requests" --> ING --> BFF
  BFF -- "F4 access token (tenant_id, roles, acr)" --> CORE
  CORE -- "F5 SQL with SET LOCAL tenant (T1/T2)" --> PGC
  CORE -- "F6 audit event (T1 metadata)" --> PGA
  CORE -- "F7 encrypted attachment (T1)" --> S3
  CORE -- "F8 wrap/unwrap tenant DEK" --> BAO
```

| Flow | Data | Tier | Protection |
|---|---|---|---|
| F1–F2 | Credentials stay at the IdP; assertions to Keycloak | T1 | TLS 1.3; SAML signed assertions / OIDC PKCE; MFA by policy |
| F3 | Session cookie (HttpOnly, Secure, SameSite=strict) | T2 | TLS; CSRF tokens |
| F4 | JWT (5 min) | T2 | Signature, audience, issuer checks; tenant from token only |
| F5 | Case rows; T1 columns encrypted | T1/T2 | RLS; least-privilege role; TLS to the database |
| F6 | Actor, action, object reference, purpose, hash | T1 | Append-only role; hash chain |
| F7 | Attachment ciphertext | T1 | Envelope encryption; per-tenant prefix; object lock for evidence |
| F8 | Data-key wrap/unwrap | — | OpenBao policy per tenant key; audit device on |

## 9.4 DFD-2: customer status page with one-time code (Ph.3/6)

```mermaid
flowchart LR
  CUST(["Bank customer (mobile)"])
  SMS(["SMS gateway (TN)"])
  subgraph TB1["TB1"]
    ING["P1 Ingress / WAF<br/>rate limits"]
  end
  subgraph TB2["TB2"]
    STATUS["P6 status page (web)"]
    CORE["P4 civora-core"]
  end
  subgraph TB3["TB3"]
    RED[("D4 Redis<br/>hashed OTP, TTL")]
    PGC[("D1 pg-core")]
  end
  CUST -- "F10 case reference" --> ING --> STATUS --> CORE
  CORE -- "F11 lookup by reference (T2)" --> PGC
  CORE -- "F12 store hashed OTP (T2, 5 min)" --> RED
  CORE -- "F13 OTP to contact on file (T1) — TB9" --> SMS --> CUST
  CUST -- "F14 OTP" --> ING --> STATUS --> CORE
  CORE -- "F15 status, next steps, mediator info (T2)" --> STATUS --> CUST
```

Key properties:
- The response never confirms whether a reference exists before the OTP step (anti-enumeration).
- OTP attempts are limited per reference and per IP.
- SMS volume is limited per tenant (SMS-pumping defence).
- The status view carries no internal notes (FR-26).

## 9.5 DFD-3: regulatory statement and mediator export (Ph.6)

```mermaid
flowchart LR
  CORR(["BCT correspondent (staff)"])
  MED(["Banking mediator"])
  BCT(["BCT (manual upload by the bank)"])
  subgraph TB2["TB2"]
    CORE["P4 civora-core<br/>reporting + export"]
  end
  subgraph TB3["TB3"]
    PROJ[("D5 reporting projections<br/>T2 aggregates")]
    PGC[("D1 pg-core")]
    S3[("D3 object storage")]
    PGA[("D2 audit")]
  end
  CORE -- "F20 events → projections" --> PROJ
  CORR -- "F21 request ROGS760 (MFA)" --> CORE
  CORE -- "F22 aggregates (no personal data)" --> PROJ
  CORE -- "F23 XML file (T2 aggregates)" --> S3 --> CORR
  CORR -. "F24 upload by the bank (outside CIVORA)" .-> BCT
  CORR -- "F25 mediator export request" --> CORE
  CORE -- "F26 case without internal notes (T1)" --> S3
  S3 -- "F27 expiring signed link" --> MED
  CORE -- "F28 audit: who exported what, why" --> PGA
```

## 9.6 DFD-4: release and configuration supply chain (built in Phase 2)

```mermaid
flowchart LR
  DEV(["Developer"])
  subgraph TB10["TB10 supply chain"]
    GH["P20 GitHub repo + PR review"]
    CI["P21 CI: tests, scans, SBOM, sign, provenance"]
    REG[("D20 registry: signed images")]
  end
  subgraph TB5["TB5 cell pulls only"]
    ARGO["P22 Argo CD"]
    K8S["P23 Kubernetes API<br/>(restricted PSA)"]
    CORE["P4 civora-core<br/>verifies pack digest"]
  end
  DEV -- "F30 commits (signed)" --> GH
  GH -- "F31 source" --> CI
  CI -- "F32 image + SBOM + signature" --> REG
  ARGO -- "F33 pull values + chart (T3)" --> GH
  ARGO -- "F34 pull image by digest" --> REG
  ARGO -- "F35 apply manifests" --> K8S --> CORE
```

## 9.7 DFD-5: observability (no personal data)

```mermaid
flowchart LR
  subgraph TB2["TB2"]
    CORE["P4 civora-core"]
    KC["P3 Keycloak"]
  end
  subgraph OBSZ["Observability zone (in cell)"]
    COL["P30 OTel collector<br/>scrub + allow-list"]
    PROM[("D30 Prometheus")]
    LOKI[("D31 Loki")]
    TEMPO[("D32 Tempo")]
    GRAF["P31 Grafana (SSO)"]
  end
  OPS(["Operators"])
  CORE -- "F40 metrics, JSON logs, spans (T2/T3, no PD)" --> COL
  KC -- "F41 metrics, admin events" --> COL
  COL --> PROM & LOKI & TEMPO
  OPS -- "F42 dashboards (MFA)" --> GRAF
  PROM & LOKI & TEMPO --> GRAF
```

## 9.8 DFD-6: backup and recovery

```mermaid
flowchart LR
  subgraph SITEA["Site A (TN)"]
    PG[("PostgreSQL primary")]
    BK1[("pgBackRest repo 1")]
    OS1[("Object storage")]
  end
  subgraph SITEB["Site B (TN)"]
    BK2[("pgBackRest repo 2<br/>WORM for audit")]
    OS2[("Object storage replica")]
  end
  PG -- "F50 WAL + backups (encrypted)" --> BK1
  BK1 -- "F51 async copy (encrypted)" --> BK2
  OS1 -- "F52 replication" --> OS2
  BK2 -- "F53 restore drill (monthly)" --> RESTORE["P50 isolated restore env"]
```

## 9.9 DFD-7: AI guide (Ph.10, design only)

```mermaid
flowchart LR
  USER(["User"])
  subgraph TB8["TB8 AI zone"]
    GUIDE["P60 guide service"]
    REDACT["P61 PII redaction"]
    GW["P62 model gateway"]
    LM["P63 in-country model"]
  end
  CORPUS[("D60 pg-public corpus T3")]
  CORE["P4 civora-core (tools)"]
  FOREIGN(["Foreign API model<br/>(public content only, approved)"])
  USER -- "F60 question" --> GUIDE --> REDACT
  REDACT -- "F61 redacted query" --> GW
  GUIDE -- "F62 retrieval (T3)" --> CORPUS
  GW -- "F63 prompt (no PD)" --> LM
  GW -. "F64 only if no PD + client approval" .-> FOREIGN
  GUIDE -- "F65 tool call as agent principal" --> CORE
```

## 9.10 DFD-8: health bridge (Ph.7, design only)

```mermaid
flowchart LR
  CORE["P4 civora-core"]
  subgraph TB7["TB7 T0 zone"]
    HB["P70 health-bridge"]
    FHIR[("D70 fhir-store T0<br/>consent + grants + short-TTL cache")]
    HK["P71 T0 keys (separate)"]
  end
  SRC(["Authoritative clinical source<br/>(authorised only)"])
  CORE -- "F70 grant check request (references)" --> HB
  HB -- "F71 consent/grant (T0)" --> FHIR
  HB -- "F72 on-demand fetch (T0) — TB9" --> SRC
  HB -- "F73 encrypt/decrypt" --> HK
```

## 9.11 Flow-to-threat cross-reference

Each flow and store above appears in the threat register ([08](08-threat-model.md) §8.5) under its element id: P*, D*, F*, TB*.
