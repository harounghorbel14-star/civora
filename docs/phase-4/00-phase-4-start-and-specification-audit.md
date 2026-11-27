# Phase 4 — Digital Documents Wallet: start record and specification audit

| | |
|---|---|
| Started | **27 November 2026**, decision **P4-D0**: the founder's instruction "kamel phase 3 w 4 w 5" (finish Phases 3, 4 and 5), given together with the decisions on V6.3.7, Q3-4, Q3-7 and G5 |
| Dependencies | "Dependencies: P3; P5 (renewal deep-links)" (Phase 0 §19). **P3:** about 97 % on 27 Nov ([Phase 3 progress](../phase-3/01-progress.md)); what remains (the mobile app and its Detox job, G5, the rest of G4, counter-assisted recovery in Phase 6) does not block the wallet's server side; the holder wallet needs the mobile app (see §4). **P5:** the renewal deep-links point at catalogue service codes; Phase 5 follows Phase 4 in the canonical order, so the deep-link mechanism is built here against the code format and completed when the catalogue exists |
| Roadmap | The 15 phases are unchanged (canonical order 0 → 15). Phase 4 keeps its full original scope, deliverables and acceptance criteria (P1-D4) |
| Data | Synthetic credentials only (ADR-025). Demo issuers are simulated; no real registry, ministry or document is used |
| Status | **In progress** — weeks 1–3 built on 27 Nov 2026: credential library and wallet schema ([01](01-wallet-data-model.md)), issuer keys in the HSM and the key ceremony ([02](02-issuer-keys-and-ceremony.md)), OpenID4VCI issuance and status lists ([03](03-oid4vci-issuance.md)), holder library and wallet entries ([04](04-holder-library-and-wallet-entries.md)); week 4: the OpenID4VP verifier API ([05](05-oid4vp-verification.md)); week 5: expiry reminders with renewal links ([06](06-expiry-reminders.md)). Next: the verifier web app (week 5) |

## 1. Original Phase 4 specification (Phase 0 §19, word for word)

| ID | Original text |
|---|---|
| P4-OBJ | Objectives: verifiable credential issuance, holding, presentation and verification (synthetic credentials). |
| P4-D1 | Deliverable: issuer service (demo issuers) |
| P4-D2 | Deliverable: holder wallet in mobile app |
| P4-D3 | Deliverable: verifier web app and API |
| P4-D4 | Deliverable: status lists |
| P4-D5 | Deliverable: expiry reminders |
| P4-A1 | Architecture: OpenID4VCI / OpenID4VP |
| P4-A2 | Architecture: SD-JWT VC |
| P4-A3 | Architecture: W3C VC 2.0 data model |
| P4-A4 | Architecture: ISO mDL support planned (licences) |
| P4-A5 | Architecture: keys in HSM (dev: SoftHSM) |
| P4-F1 | Features: add credential via offer QR |
| P4-F2 | Features: selective disclosure |
| P4-F3 | Features: QR presentation |
| P4-F4 | Features: offline verification with grace policy |
| P4-F5 | Features: revocation |
| P4-F6 | Features: renewal deep-links to official service |
| P4-DB1 | Database: `wallet.issuer` |
| P4-DB2 | Database: `wallet.credential_type` |
| P4-DB3 | Database: `wallet.credential` (encrypted backup metadata) |
| P4-DB4 | Database: `wallet.status_list` |
| P4-DB5 | Database: `wallet.presentation_log` |
| P4-API1 | `POST /v1/issuers/{id}/credential-offers` |
| P4-API2 | `POST /v1/oid4vci/token`, `POST /v1/oid4vci/credential` |
| P4-API3 | `GET /v1/wallet/credentials` |
| P4-API4 | `POST /v1/oid4vp/requests`, `POST /v1/oid4vp/responses` |
| P4-API5 | `POST /v1/verify` |
| P4-API6 | `GET /v1/status-lists/{id}` |
| P4-DEP | Dependencies: P3; P5 (renewal deep-links) |
| P4-SEC1 | Security: holder binding (device keys) |
| P4-SEC2 | Security: replay protection (nonce) |
| P4-SEC3 | Security: issuer key ceremonies |
| P4-SEC4 | Security: no PII in QR beyond disclosed claims |
| P4-T1 | Testing: conformance tests against OpenID4VC test suites where available |
| P4-T2 | Testing: interoperability with at least one external wallet/verifier |
| P4-T3 | Testing: fuzzing of verifier inputs |
| **P4-AC1** | **Acceptance: issue → hold → present → verify → revoke works end-to-end on synthetic credentials** |
| **P4-AC2** | **Acceptance: verifier rejects revoked/expired/tampered credentials 100% in test suite** |
| P4-TIME | Time: 7 weeks |
| P4-RISK | Risks: standards churn (mitigate by following EUDI reference implementations) |
| P4-BUD | Budget: 120–180k TND |

## 2. Standards, as they stand on 27 Nov 2026 (checked, not assumed)

| Standard | Status | Use in CIVORA |
|---|---|---|
| OpenID for Verifiable Credential Issuance 1.0 | OpenID Final Specification (approved September 2025) | issuer: credential offer (pre-authorised code with a transaction code), token, nonce and credential endpoints, key proofs |
| OpenID for Verifiable Presentations 1.0 | OpenID Final Specification (July 2025) | verifier: signed request objects, DCQL queries, `direct_post` responses |
| OpenID4VC High Assurance Interoperability Profile (HAIP) 1.0 | OpenID Final Specification (December 2025) | the profile followed where it applies (algorithms, key binding, request signing) |
| Selective Disclosure for JWTs (SD-JWT) | RFC 9901 (November 2025) | the credential format's core: disclosures, key binding JWT |
| SD-JWT-based Verifiable Digital Credentials (SD-JWT VC) | IETF draft, -26 (November 2026) | credential format `dc+sd-jwt`; followed at the revision current when built, recorded per release (standards churn, P4-RISK) |
| Token Status List | IETF draft, -21 (June 2026), in the RFC Editor's queue | status lists for revocation and suspension |
| W3C Verifiable Credentials Data Model v2.0 | W3C Recommendation (2025) | the data model the credential types are mapped to (`@context`-free JSON in SD-JWT VC; the mapping is documented per type) |
| ISO/IEC 18013-5 (mDL) | ISO standard (licence needed for the text) | **planned** (P4-A4): not built in Phase 4; the format abstraction leaves room for `mso_mdoc` |

Sources: openid.net/specs (OpenID4VCI 1.0, OpenID4VP 1.0, HAIP 1.0), rfc-editor.org/rfc/rfc9901, datatracker.ietf.org
(draft-ietf-oauth-sd-jwt-vc, draft-ietf-oauth-status-list), w3.org/TR (VC Data Model 2.0 announcement, 2025).

## 3. Inherited decisions and constraints

| Source | What it requires of Phase 4 |
|---|---|
| ADR-001 | A bounded context of its own (`wallet` schema and module); others use its public API only |
| ADR-011, ADR-018, ADR-025 | No personal data in logs; synthetic data only; credentials are T1 data where they hold personal data |
| ADR-028 | Simulated adapters only in dev and test (demo issuers, SoftHSM) |
| Phase 3 | identity of holders and staff from the realms; step-up before sensitive actions; DPoP-bound tokens from the web app; notices through the messaging port; ASVS L3 assessment method |

## 4. Open questions that Phase 4 must not assume away

| # | Question | Owner | Until answered |
|---|---|---|---|
| Q4-1 | Which real issuers and credential types (a ministry's identity card, a driving licence, a diploma…) and under which agreements | Founder / authorities | Demo issuers with synthetic credential types only |
| Q4-2 | Production HSM (vendor, certification, where it is hosted) and who attends key ceremonies | Founder | SoftHSM in dev and test; the ceremony procedure is written and rehearsed with SoftHSM |
| Q4-3 | Trust framework for verifiers (who may ask for what; registration, certificates) | Founder / counsel | Verifiers registered in the cell by an administrator; their request objects signed with keys the cell knows |
| Q4-4 | Offline verification grace period (how long a cached status list may be used) | Founder / counsel | A conservative default (24 h), configurable |
| Q4-5 | The mobile app (P3-A2/T2 still open): the holder wallet lives in it | Engineering | The holder is built as a library used by the mobile app and by the tests; the app's screens follow with the mobile job |

## 5. Plan (7 weeks)

| Week | Work | Proves |
|---|---|---|
| 1 | SD-JWT (RFC 9901) and Token Status List in a package of their own; `wallet` schema (DB1–DB5) with RLS; demo issuers and credential types; issuer keys through PKCS#11 on SoftHSM, key ceremony procedure | unit tests, interop with an independent SD-JWT implementation, database tests |
| 2 | Issuer (D1, A1): credential offers (API1, F1 QR), token and credential endpoints (API2) with key proofs and nonces (SEC1, SEC2) | issuance end to end against the realms |
| 3 | Holder library (D2): offers, proofs, storage, selective disclosure (F2), presentations with key binding; encrypted backup metadata (DB3, API3) | holder ↔ issuer tests |
| 4 | Verifier API (D3, API4, API5): signed request objects, DCQL, `direct_post`, verification with status (D4, API6, F5), offline grace policy (F4), presentation log (DB5) | the acceptance suite: issue → hold → present → verify → revoke (AC1) |
| 5 | Verifier web app (D3, F3 QR presentation); expiry reminders (D5) with renewal deep-links (F6) | web E2E in AR/FR/EN |
| 6 | Negative suite and fuzzing of verifier inputs (T3, AC2); conformance tests where available (T1); interop with an external wallet or verifier (T2) | 100 % rejection of revoked, expired and tampered credentials |
| 7 | Security review (SEC1–SEC4), records, traceability, readiness report | acceptance checklist |

## 6. Completion estimate (27 Nov 2026, after weeks 1–4 and the reminders of week 5)

Each of the 36 work items of §1 (objective, dependency, time, budget and risk lines excluded) scored by what is built
**and tested**: 0, 25, 50, 75 or 100 %. **Phase 4: about 81 %** (29.25 of 36). Acceptance: **AC1 met** (issue → hold →
present → verify → revoke end to end through the verifier API, doc 05); AC2 partly (revoked, suspended, wrong
verifier, missing claims rejected through the API; expired and tampered rejected by the library; the full suite with
fuzzing is week 6). An engineering estimate, not an acceptance decision.

| Item | Done | What is missing |
|---|---|---|
| D1 issuer service | 100% | — (demo issuers only, Q4-1) |
| D2 holder wallet in the mobile app | 50% | the library is built and tested against the issuer and verifier; the app's screens wait on the mobile app (Q4-5) |
| D3 verifier web app and API | 50% | API done (doc 05); the web app's screens are week 5 |
| D4 status lists | 100% | — |
| D5 expiry reminders | 100% | e-mail reminders at each threshold, in the person's language (doc 06); a push notice comes with the mobile app |
| A1 OpenID4VCI / OpenID4VP | 100% | — (pre-authorised code; direct_post; pre-registered verifiers, Q4-3) |
| A2 SD-JWT VC | 100% | — |
| A3 W3C VC 2.0 data model | 25% | the mapping per type is to be written (week 7) |
| A4 ISO mDL planned | 50% | planned in §2; the format abstraction to be shown in the design record |
| A5 keys in HSM (SoftHSM) | 100% | — (production HSM: Q4-2) |
| F1 offer QR | 75% | offer URI built and parsed; the QR image on the web page with the mobile app |
| F2 selective disclosure | 100% | — |
| F3 QR presentation | 75% | `POST /v1/verify` and the holder's presentation for a QR; the QR images in the apps |
| F4 offline verification with grace | 75% | server grace until the list's `exp`; the verifier web app's offline mode (week 5) |
| F5 revocation | 75% | issuer revocation, status lists, rejection at the verifier; an HTTP route for holders and staff to ask for it (week 5) |
| F6 renewal deep-links | 50% | links to the renewal service's page are sent (doc 06); the pages are Phase 5's catalogue |
| DB1–DB5 | 100% each | — |
| API1–API6 | 100% each | — |
| SEC1 holder binding | 100% | — |
| SEC2 replay protection | 100% | codes, tokens, c_nonces, DPoP proofs, presentation nonces and states: each single use |
| SEC3 key ceremonies | 75% | procedure written and rehearsed with SoftHSM; production ceremony needs Q4-2 |
| SEC4 no personal data in QR | 100% | offer and presentation QR codes checked by tests |
| T1 conformance tests | 0% | week 6 |
| T2 interoperability | 50% | an independent SD-JWT VC implementation as issuer, holder and verifier; an external wallet app week 6 |
| T3 fuzzing of verifier inputs | 0% | week 6 |
| AC1 end to end | 100% | — |
| AC2 100 % rejection | 75% | the full suite and fuzzing against the verifier API (week 6) |
