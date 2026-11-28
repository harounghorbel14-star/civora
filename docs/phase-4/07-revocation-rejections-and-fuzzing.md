# 07 — Revocation on request, the rejection suite and fuzzing (P4-F5, P4-AC2, P4-T3, P4-F6)

| | |
|---|---|
| Specification items | P4-F5 revocation (the HTTP routes to ask for it), P4-AC2 "verifier rejects revoked/expired/tampered credentials 100 % in test suite", P4-T3 fuzzing of verifier inputs, P4-F6 renewal deep-links (links to published pages only) |
| Built | 28 Nov 2026 (week 6, first part) |
| Code | `wallet/revocation.controller.ts`; migration `1765411200000_wallet-revocation-requests.sql`; `verification.ts` (issuer bound to its credential types); `packages/credentials/src/jws.ts` (strict base64url); `wallet/reminders.ts` and the catalogue's public API (`ServicePages`) |
| Tests | `presentation.e2e.test.ts` "revocation on request"; `rejections.e2e.test.ts` (3: the matrix, status cases, API fuzzing); `packages/credentials/src/verify.fuzz.test.ts`; `sd-jwt.test.ts` (strict base64url); `reminders.test.ts` (+1); `catalogue.db.test.ts` (published slugs); `wallet.config.test.ts` (2) |

## 1. Revocation on request (P4-F5)

The status of an issued credential still changes only through `wallet.set_credential_status`, which sets the status-list
bit and writes the history. Three definer functions (migration `1765411200000`) decide who may call it, and for which reason.

| Route | Who | What |
|---|---|---|
| `GET /v1/wallet/issued` | the citizen (citizens realm) | the credentials issued to them: type, issuer, status, reason, dates. No claim value (the cell keeps none) |
| `POST /v1/wallet/issued/{id}:revoke` | the citizen, **signed in within the step-up window** (RFC 9470: `auth_time`, `acr`) | revokes for `holder-request` or `lost-device`; another person's credential is "unknown" (404); final (409 the second time) |
| `GET /v1/admin/wallet/issued/{id}` | a credential officer | type, issuer, status, history (`issued`, `suspended`, `reinstated`, `revoked`, with the kind of actor), never the subject |
| `POST /v1/admin/wallet/issued/{id}:suspend` / `:reinstate` / `:revoke` | a credential officer, signed in within the step-up window | suspend for `under-review`, `lost-device` or `data-changed`; reinstate for `review-cleared`; revoke for `holder-request`, `lost-device`, `data-changed` or `issued-in-error`. Any other pairing is 400; reinstating a revoked credential is 409 |

- **Credential officer:** staff realm, role `credential-officer`, and the tenant of the issuing institution
  (`WALLET_OFFICER_TENANT`, a UUID). The variable is required when the wallet is on, outside dev and test. A cell
  without the wallet does not need it (`wallet.config.test.ts`).
- **Holder:** the person comes from the session (the row-level security setting), never from the request.
- **History:** the history holds the officer's person id or the holder's as the actor (accountability). The officer's
  view shows only the actor's kind.

## 2. The rejection suite (P4-AC2)

`rejections.e2e.test.ts` runs against the cell, with PostgreSQL as the least-privilege role and the issuer and verifier
keys in SoftHSM. It also registers two test-only issuers whose keys are software keys. The cell never issues with them.
They are needed to make credentials the cell would never issue: expired, not yet valid, of another type.

Each case is sent through **both routes that decide**:
- the wallet's `direct_post` (`/v1/oid4vp/responses`);
- the verifier device's `POST /v1/verify`.

The two routes give the same outcome for every case.

| Case | `/v1/verify` | `direct_post` |
|---|---|---|
| control: a valid presentation | accepted | accepted |
| expired | expired | expired |
| not yet valid | not-yet-valid | not-yet-valid |
| issuer signature altered | signature | signature |
| payload altered (a claim in clear changed), signature kept | signature | signature |
| a disclosure value changed | malformed | malformed |
| a disclosure that is not in the credential | malformed | malformed |
| issuer signature encoded non-canonically (same bytes) | malformed | malformed |
| key-binding signature encoded non-canonically (same bytes) | malformed | malformed |
| alg none | signature | signature |
| signed by another key under the issuer's kid | signature | signature |
| an issuer key id the cell does not know | signature | signature |
| an issuer the cell does not trust | issuer-untrusted | issuer-untrusted |
| a trusted issuer minting another issuer's type | issuer-untrusted | issuer-untrusted |
| another credential type than asked | wrong-type | wrong-type |
| no key binding | key-binding | key-binding |
| key binding for another verifier | key-binding | key-binding |
| key binding for another nonce (a presentation replayed from another request) | key-binding | key-binding |
| key binding signed by another key than the credential's (cnf) | signature | signature |
| key binding made an hour ago | key-binding | key-binding |
| fewer claims disclosed than asked | missing-claims | missing-claims |
| a status list the cell cannot read | status-unavailable | status-unavailable |
| not a string, empty, too large | malformed | malformed |

The status cases need a credential of the cell's own issuer, held by the holder library:
- **suspended:** rejected as `suspended`, then accepted again after reinstatement, on each route;
- **revoked:** rejected as `revoked` on each route;
- **another issuer's status list:** a credential of the test issuer that points at the cell issuer's status list is
  rejected, because the list's signature is not its issuer's;
- **an issuer the cell has suspended:** its credentials are refused as `issuer-untrusted` while it is suspended.

**Result: every case that must be refused is refused, through both routes (100 %).** The earlier end-to-end tests
(doc 05) still cover the cross-device flow, a wrong verifier and missing claims through the holder library.

### Two defects found and fixed by the suite

1. **Base64url malleability.** The verifier accepted a second encoding of the same signature, with the unused low bits of
   the last character set. jose's decoder is lenient, and so was `fromB64u`. The bytes were the same and the signature
   still held, so nothing could be forged. But a presentation had more than one valid spelling, which breaks any
   de-duplication or logging by its text. Decoding is now strict (RFC 4648 §5, canonical, no padding) for:
   - every segment of every JWS (the signature too);
   - disclosures;
   - status lists.

   For the issuer signature, the key binding already caught it, because `sd_hash` covers the issuer JWT. For the
   key-binding JWT's own signature, it did not.
2. **An issuer could present another issuer's credential type.** The verifier checked that the issuer is registered and
   active, but not that it issues this type. Each type has one issuer (`wallet.credential_type.issuer_id`, `vct`
   unique). The verifier now refuses (`issuer-untrusted`) a type the presenting issuer does not issue.

## 3. Fuzzing (P4-T3)

| Level | What | Result |
|---|---|---|
| Library (`verify.fuzz.test.ts`) | 3,000 seeded mutations of a valid, key-bound presentation, 27 kinds (characters flipped, deleted, inserted; truncation; disclosures dropped, duplicated, foreign, changed; key binding removed or by another key; `alg none`, `HS256`; `typ`; payload changes; segments swapped; random text; tildes; 40–80 kB inputs; deeply nested JSON; non-canonical encodings) | all refused with a `CredentialError`, each in under 250 ms; also with seeds 1, 7 and 424242 |
| Verifier API (`rejections.e2e.test.ts`) | 160 seeded mutations posted to `/v1/verify`, each for a fresh request | all refused with a known reason (`malformed`, `signature`, `key-binding`, …); no server error; every refusal in the presentation log, without a claim value |
| `direct_post` | broken forms (no state, a malformed state, an unknown state, arrays) | 400 |
| `direct_post` | broken `vp_token` (empty, `null`, `[]`, `{}`, no or two presentations, a number, another query id, 10,000 nested brackets) | the request is answered `rejected: malformed` |

A failure names the seed and the case number. `CIVORA_FUZZ_SEED`, `CIVORA_FUZZ_CASES` and `CIVORA_FUZZ_API_CASES`
replay a run exactly or run it longer.

## 4. Renewal links go to published pages only (P4-F6)

- **Address.** The reminder's link is now the static directory's own page address, `/<lang>/services/<slug>/`, with
  the trailing slash (`paths.service` of `@civora/directory`). The test compares the two.
- **Published pages only.** Before linking, the reminder asks the catalogue, through its public API (`ServicePages`,
  provider `SERVICE_PAGES`), whether a page is published at that slug.
  - A slug that is not published (withdrawn, renamed, never created): the message has no link and tells the person to
    contact the issuer. This is logged as `renewal-page-not-published`, once per slug and pass.
  - The same applies when the catalogue cannot be reached, or when the cell has no catalogue. The reminder still goes.
- **The look-up** (`catalogue.published_version`, as the application role) matches the slug, not the code.

## 5. Not covered here

- **T1:** conformance suites (OpenID Foundation tests for OpenID4VCI/VP) are batch 2.
- **T2:** interoperability with an external wallet app needs one installed against the cell.
- **Verifier web app:** its screens and offline mode are batch 3.
