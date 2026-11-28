# 08 — The W3C VC 2.0 view, credential formats and the mDL design record; conformance testing (P4-A3, P4-A4, P4-T1)

| | |
|---|---|
| Specification items | P4-A3 W3C VC 2.0 data model; P4-A4 ISO mDL support planned (licences); P4-T1 conformance tests (where available) |
| Built | 28 Nov 2026 (week 6, second part) |
| Code | `packages/credentials/src/vcdm2.ts` (context, mapping), `formats.ts` (format registry); `wallet/contexts.controller.ts` (`GET /v1/contexts/civora-claims-v1.jsonld`); the holder library and the issuer use the registry |
| Tests | `vcdm2.test.ts` (5: the mapping, VCDM rules, refusals, the context, formats); `holder.test.ts` (+1: an issuer offering `mso_mdoc`); `vcdm2-view.test.ts` (every claim of the demo issuers maps); `rejections.e2e.test.ts` (+1: the context served, a cell-issued credential mapped) |

## 1. The W3C Verifiable Credentials Data Model 2.0 view (P4-A3)

**What the cell issues.** SD-JWT VC (`dc+sd-jwt`), as the HAIP profile requires. In that format the claims are plain
JSON without `@context` (doc 00 §2).

**The view.** For systems that consume the W3C data model, the verifier can turn a credential it has verified into a
VCDM 2.0 credential document (`toVcdm2`):
- the same claim names, given their meaning by a JSON-LD context;
- the issuer, the type and the validity.

It is a **data-model view**, not a second secured format:
- it carries no `proof`;
- it is made only after the signature, the key binding and the status were checked;
- it is never handed to a wallet.

### Mapping of the processing claims

| SD-JWT VC | VCDM 2.0 |
|---|---|
| — | `@context`: `https://www.w3.org/ns/credentials/v2` first, then the cell's `…/v1/contexts/civora-claims-v1.jsonld` |
| `vct` `urn:civora:tn:synthetic:residence-certificate:1` | `type`: `["VerifiableCredential", "ResidenceCertificate"]` |
| `iss` | `issuer` (the issuer's URL) |
| `nbf`, or else `iat` | `validFrom` (dateTimeStamp, UTC) |
| `exp` | `validUntil` |
| the disclosed claims | `credentialSubject` (only what the holder disclosed) |
| `cnf` (the holder key) | not mapped: holder binding stays in the SD-JWT key binding. No `credentialSubject.id` and no credential `id`, which would make presentations linkable |
| `status` (Token Status List) | not mapped. The status is checked before the view is made, and VCDM 2.0's registered status types are W3C mechanisms (Bitstring Status List), not the IETF list |

### Mapping of the subject claims

The CIVORA context, JSON-LD 1.1 with protected terms, maps the claims to schema.org terms:

| Claim | Term |
|---|---|
| `given_name`, `family_name` | `schema:givenName`, `schema:familyName` |
| `given_name_ar`, `family_name_ar` | the same terms, with `@language: ar` |
| `birthdate` | `schema:birthDate` (`xsd:date`) |
| `address` → `locality`, `country` | `schema:address` → `schema:addressLocality`, `schema:addressCountry` (a scoped context) |
| `document_number` | `urn:civora:vocab:documentNumber` (schema.org has no such term) |

**Unmapped claims are refused.** A claim with no term in the context makes the mapping fail. It is not dropped
silently into the base context's "issuer-dependent" vocabulary. A new claim in a credential type therefore needs its
term first. `vcdm2-view.test.ts` checks that every claim the demo issuers can produce is mapped.

**Not checked by JSON-LD processing.** The tests check the context's structure: every term is an absolute IRI or a
compact IRI of a declared prefix. They do not run a JSON-LD processor, because none is a dependency of the project.
Expanding the view with one (for instance in an institution's system) is the check left to integrators.

## 2. Formats: one registry; ISO mdoc (mDL) planned (P4-A4)

`FORMATS` in `packages/credentials/src/formats.ts` is the one place that says which formats this release supports:

| Format | Status | Standard |
|---|---|---|
| `dc+sd-jwt` | supported | SD-JWT VC over SD-JWT (RFC 9901), HAIP 1.0 |
| `mso_mdoc` | **planned** | ISO/IEC 18013-5 (mDL and other mdocs); ISO/IEC 18013-7 for presentation over the internet |

- **The issuer's** metadata format comes from the registry.
- **The holder library** asks the registry about every credential configuration it is offered and every credential
  query it receives:
  - an `mso_mdoc` configuration is refused with "planned, not supported in this release", before anything but the
    issuer's metadata is requested;
  - any other format is "unknown".

### Design record: adding mdoc (not built in Phase 4)

| Part | Design |
|---|---|
| Licence | The texts of ISO/IEC 18013-5 and 18013-7 are sold by ISO. Buying them is a founder decision (no purchase is made by this work). Building against secondary descriptions is not acceptable for a government credential |
| Data | One mdoc document type per credential type. The mDL keeps ISO's `org.iso.18013.5.1.mDL` and its namespace. Other documents get a CIVORA namespace, for instance `tn.civora.residence.1`, with the same claim names as the SD-JWT VC, so one claim source serves both formats |
| Issuer signature | The Mobile Security Object (MSO), signed with COSE_Sign1 (ES256) by a document signer key in the HSM. **A new ceremony is needed**: mdoc verifiers expect an X.509 chain (an issuing authority root, IACA, and document signer certificates), whereas the SD-JWT VC keys of doc 02 are bare keys published as JWKs |
| Holder binding | The device key in the MSO; device authentication over the session transcript (proximity) or the OpenID4VP handover (online) |
| Selective disclosure | Per data element: salted digests in the MSO, as SD-JWT does per claim |
| Status | A status reference in the MSO pointing at the same Token Status List, so one revocation covers both formats |
| Presentation | Online: OpenID4VP 1.0 with a DCQL query of format `mso_mdoc` (`meta.doctype_value`) and the HAIP mdoc rules. In person: ISO/IEC 18013-5 device engagement (QR) and BLE or NFC, which needs the mobile app |
| Software | A CBOR and COSE implementation, chosen when the work starts, under the same dependency rules (a release at least two weeks old, verified, reviewed) |
| Format registry | `mso_mdoc` becomes `supported`, and the issuer, holder and verifier implement it behind the same interfaces. The registry's tests change from "planned" to the new behaviour |

## 3. Conformance tests (P4-T1): assessed, not yet run

The OpenID Foundation's conformance suite is open source (gitlab.com/openid/conformance-suite). Release v5.3.4 of
26 Oct 2026 is the newest at least two weeks old (v5.3.5 is of 24 Nov). Its OpenID4VCI 1.0 issuer plan
(`oid4vci-1_0-issuer-test-plan`, marked alpha and not certifiable; certification uses the HAIP plan) was read on
28 Nov.

**Why it cannot run against the cell as it stands:**
- **Client authentication.** Its modules build on the FAPI 2.0 security-profile server tests. They expect OAuth client
  authentication with wallet (client) attestations: several negative tests are about attestation signatures, expiry,
  audience and keys.
- **Issuance flow.** The cell's issuer uses the pre-authorised code flow with a transaction code and no wallet
  attestation (doc 03, profile).
- **Network.** The suite needs the cell on an https address it can reach.

**What would make a run meaningful:**
1. Decide whether the pilot wallet presents wallet attestations, a HAIP requirement for certification. Implement
   attestation-based client authentication at the token endpoint if so.
2. Run the suite from source in a CI job against a cell behind TLS, with the issuer plan (and later the OpenID4VP
   verifier plan).
3. Record each module's result here.

T1 stays open until such a run. The spec-level checks that exist are not a substitute and are not counted as T1:
- the RFC 9901 digest example (`sd-jwt.test.ts`);
- the independent SD-JWT VC implementation used as issuer, holder and verifier (T2, doc 04);
- the rejection suite (doc 07).
