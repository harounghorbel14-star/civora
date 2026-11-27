# 05 — Verification with OpenID4VP 1.0 (the verifier API)

| | |
|---|---|
| Specification items | P4-D3 verifier API (the web app's screens: week 5), P4-A1 OpenID4VP, P4-API4 `POST /v1/oid4vp/requests`, `POST /v1/oid4vp/responses`, P4-API5 `POST /v1/verify`, P4-F3 QR presentation, P4-F4 offline verification with a grace policy, P4-F5 revocation at verification, P4-SEC2 replay, P4-SEC4 no personal data in the QR, P4-DB5 presentation log, **P4-AC1**, part of **P4-AC2** |
| Built | 27 Nov 2026 (week 4) |
| Code | `services/core/src/modules/wallet/verification.ts`, `oid4vp.controller.ts`; migration `1765065600000_wallet-presentation.sql`; holder side `PresentationRequests` in `@civora/holder` |
| Tests | `presentation.e2e.test.ts` (application, PostgreSQL as the least-privilege role, issuer and verifier keys in SoftHSM, the holder library as the wallet) |
| Decision applied | **Q4-3** (until a trust framework exists): verifiers are registered in the cell by an administrator, with the credential types and claims each may ask for; their identifiers are OpenID4VP *pre-registered* client identifiers, and the cell publishes them in its verifier registry |

## 1. The flow

```
verifier staff (signed in, institution T)       core                                          wallet (holder library)
 POST /v1/oid4vp/requests {client_id, vct, claims} ─► checks: staff of T; verifier of T; type and
                                                     claims registered for it (Q4-3)
 ◄── authorization_request (QR): openid4vp://?client_id=…&request_uri=…   (no claim names, no personal data)
                                                                              scan; GET registry entry for client_id
                                                     GET request_uri ◄─────── 
                                                     ──► request object, signed in the HSM (oauth-authz-req+jwt):
                                                         DCQL query (type, claim paths), nonce, state,
                                                         response_mode direct_post, response_uri, exp
                                                                              checks signature with the registry key,
                                                                              client, audience, expiry; shows who asks
                                                                              and which claims; the person agrees
                                                     POST /v1/oid4vp/responses ◄ vp_token {credential: [SD-JWT+KB]}, state
                                                     ──► verify (below), log, keep requested claims
 GET /v1/oid4vp/requests/{id} ─► accepted + claims (once) | rejected + reason | pending | expired
```

QR presentation (P4-F3, P4-API5): when the holder's phone shows the presentation as a QR code instead (no network
on the holder's side), the verifier's device scans it and posts it to `POST /v1/verify` with the request id; the same
checks run, and only the staff member who created the request may do so.

## 2. What the verifier checks

| Check | Rejection reason |
|---|---|
| The issuer (`iss`) is an issuer registered and active in this cell; the signing key is its key (`kid`) | `issuer-untrusted`, `signature` |
| SD-JWT VC rules (doc 01): `typ dc+sd-jwt`, ES256, digests and disclosures, processing claims never disclosed | `malformed` |
| The type is the one requested | `wrong-type` |
| `exp` and `nbf` (one minute of skew) | `expired`, `not-yet-valid` |
| Key binding: signed by the credential's `cnf` key, audience = this verifier's client_id, nonce = this request's nonce, fresh, `sd_hash` over exactly what was presented | `key-binding` |
| Status (draft-ietf-oauth-status-list): the issuer's signed list, the index of the credential | `revoked`, `suspended`, `status-unavailable` |
| Every requested claim is disclosed | `missing-claims` |

- **Data minimisation**: only the requested claims are kept; anything else the wallet sent is dropped, never stored.
- **Single use**: a request is answered once (by its `state` or by `/v1/verify`); a second answer is refused and not
  logged twice. Requests live 5 minutes (at most 10).
- **The verified claims** (T1) stay until the verifier's page reads them once, and at most 10 minutes; then erased.
- **Log (DB5)**: result, reason code, type, and the **names** of the claims; never values, never the holder.
- **Offline grace (P4-F4)**: this cell's status lists are read directly; another issuer's list is fetched. When a list
  cannot be read, the last good signed list is used **until its own `exp`** (24 h by default, Q4-4), and the use is
  logged; after that the presentation is rejected (`status-unavailable`). A verifier device with no network uses the
  same rule with the list it last downloaded (the web app's offline mode, week 5).

## 3. What the wallet checks (holder library)

Only `openid4vp://` requests from **registered** verifiers (a client identifier without a prefix; `redirect_uri:` and
other unsigned forms are refused); `request_uri` over https; the request object's signature with the key from the
cell's registry, the client identifier, the audience (`https://self-issued.me/v2`), `response_type vp_token`,
`response_mode direct_post`, an https `response_uri`, a nonce, a state, expiry; one DCQL credential query of format
`dc+sd-jwt` naming its claims. The person sees the verifier's name in their language and the claims asked for; the
presentation carries only those claims, bound to the verifier and nonce.

## 4. Results (27 Nov 2026)

`presentation.e2e.test.ts`, 4 of 4 pass (the whole core suite: 163 of 163):

| Test | Proves |
|---|---|
| AC1 | issue → hold → present (cross-device, direct_post) → verify: the QR has no claim names or personal data; the wallet sees the verifier's name and the two claims asked; the verifier gets exactly those two claims, once; the log holds claim names only, no value; a second answer is refused |
| revoke and AC2 at the verifier | suspended → `rejected: suspended`; reinstated → accepted; revoked → `rejected: revoked`; a presentation made for another verifier → `rejected: key-binding`; fewer claims than asked → `rejected: missing-claims` |
| QR presentation (API5) | another staff member cannot use the request; the one who asked gets the claims; a second scan is refused |
| staff authorisation and request checks | a citizen, staff of another institution, a claim the verifier is not registered for, an unknown verifier: refused; the request object is `application/oauth-authz-req+jwt`; the wallet refuses a request whose signature does not match the registry key, an http `request_uri`, and an unregistered (`redirect_uri:`) client; a response without a state is refused |

Still to come for AC2 as a suite (week 6): expired and tampered credentials through the verifier API (they are
rejected by the same library calls, tested in doc 01), fuzzing of every verifier input (P4-T3), and conformance tests
(P4-T1).
