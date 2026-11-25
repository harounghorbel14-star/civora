# 12 — Account recovery, security notices, SMS channel, pairwise mirror, assisted use (Phase 3, week 6)

| | |
|---|---|
| Specification items | P3-D5 account recovery design · P3-SEC4 recovery re-proofing · P3-F1 SMS fallback · P3-DB6 `iam.pairwise_id` · P3-RISK (SMS reliance, passkeys for elderly users) · ASVS gaps G1 (notices) and G2 (recovery) of [doc 11](11-security-verification.md) |
| Decisions applied | ADR-028 (simulated adapters: national eID I-01, e-mail M-02, SMS M-01, class 3, dev and test only); ASVS 5.0 V6.3.6 (e-mail never a factor), V6.4.3–V6.4.4 (recovery keeps the second factor, re-proofing at the enrolment level), V6.3.7 (notices), V6.6.1 (no SMS sign-in at L3) |
| Status | Built and tested on 22 Nov 2026 (results §7) |

## 1. Account recovery (P3-D5 design, P3-SEC4)

**Principle.** Recovery is never weaker than enrolment. An e-mail link alone never recovers an account (it would make
e-mail a single factor). The person proves who they are again; the account keeps its identity, mandates and history;
every old way to sign in stops working.

| Path | For whom | How | Status |
|---|---|---|---|
| R1 Self-service with the national eID | Citizens whose account is linked to their national identity (doc 06) | `/[lang]/recover` (no sign-in) → the (simulated) eID with a fresh authentication → the core matches the eID's answer by keyed digest only → every credential removed, every session ended, a fresh activation link (authenticator app, then password) to the account's e-mail address, and a notice | **Built and tested in ar/fr/en** |
| R2 Assisted, at a counter | Citizens without an eID link | An agent verifies an identity document in person, then sends a new activation link from the Workspace (Phase 6) | Designed; needs the Workspace screens (Phase 6) |
| R3 Staff | Staff and officers | The institution administrator (officers: the platform operator) re-issues an invitation: security key first, then password (doc 05) | Existing invitation flow |

**Rules of R1** (database function `iam.finish_recovery`, migration `iam-account-recovery`):

- The eID's level must be at least the level of the identity link, and at least "substantial" (ASVS V6.4.4).
- At most 3 recoveries of one person in 24 hours; a cell-wide bound on open attempts; the edge limits each client
  address (10 per 10 minutes, new gateway route).
- **The same answer whatever happens after the eID** (no account, level too low, limit reached, recovered): "if this
  identity has an account, we have sent a link to its e-mail address". The work runs in the background, so the answer
  time says nothing either.
- Attempts are single use, bound to a random state (only its digest is stored), expire after 10 minutes; the outcome is
  kept for audit, never the national identifier.
- The web app keeps the attempt in its server store, found again through a `Strict`, path-limited cookie after the
  eID sends the browser back (the attempt id never appears in a URL).

## 2. Security notices (ASVS V6.3.7; gap G1 partly closed)

| Event | Notice | Channel |
|---|---|---|
| Account recovered | "Your account was recovered with your national digital identity on …; old ways to sign in removed, sessions ended; if this was not you, contact support" | e-mail, person's language |
| A way to sign in removed | "On …, this way to sign in was removed: passkey / security key / authenticator app; if this was not you, recover your account" | e-mail, person's language |
| A way to sign in added or the password changed at Keycloak | Not yet | — |

Still open in G1: notices for changes made on Keycloak's own pages (adding a passkey, changing the password) and for
suspicious sign-in attempts (V6.3.5). Both need sign-in events from Keycloak (its e-mail event listener for credential
events, or an event consumer) and are planned with the adaptive controls of G3 (pilot gate PG-8). A failed notice never
fails the action that caused it; it is logged.

## 3. SMS (P3-F1) and the ASVS L3 conflict

The specification asks for an SMS **fallback** (P3-F1); ASVS 5.0 L3, required by P3-SEC1, says phone and SMS must not be
offered as authentication options (V6.6.1). The two cannot both hold. What is built, and the decision asked:

- **Built:** a simulated SMS channel (adapter `simulated-sms`, register entry M-01, class 3): synthetic numbers only
  (`+2160…`, a range no Tunisian number uses), delivered to the dev/test mail catcher, one integration-log line without
  the number or the text. The messaging port routes by address (e-mail or phone). The customer status page can send its
  one-time code **by SMS to the number on file** (the person picks the channel, never types a number).
- **Not built:** SMS as a sign-in factor.
- **Founder decision Q3-7 (new):** (a) keep ASVS L3: SMS only as a delivery channel (status codes, notices), never a
  sign-in factor — recommended; or (b) allow SMS as a citizens' second factor under ASVS L2 conditions (validated number,
  stronger methods offered, risk explained), recorded as an L3 deviation. The provider itself is still Q3-1 (PG-6).

## 4. Pairwise subjects mirrored (P3-DB6)

Relying parties (agencies) see a pairwise `sub` per sector (P3-A3). The core now mirrors these in `iam.pairwise_id`:

- It computes the identifier exactly as Keycloak's `oidc-sha256-pairwise-sub-mapper` does: SHA-256 over sector, Keycloak
  user id and salt, as a name-based UUID. **Verified against a real Keycloak token** in the realms test (check C8).
- The salts stay with the operator: `infra/keycloak/apply-realm-policy.py --pairwise-out` writes each relying party's
  sector and salt to a deployment secret (mode 0600) for the core (`PAIRWISE_SECTORS_FILE`). The core's Keycloak
  service account keeps its user-management roles only (it cannot read clients).
- The mirror is filled when the person uses the core (`GET /v1/me`) and shown to them: `GET /v1/me/pairwise` lists which
  services know them under which identifier (database function `iam.mirror_pairwise_id`, current person only).

## 5. Assisted use and passkeys for elderly users (P3-RISK)

| Risk | Mitigation in place | Next |
|---|---|---|
| No phone or device able to hold a passkey | Password + authenticator app path (any phone app; also desktop authenticators) | Hardware tokens that show TOTP codes can be enrolled the same way |
| Relatives or social workers help | Mandates ("acting on behalf of", P3-F6): the helper signs in as themselves, acts within scopes, everything visible to the principal; no password sharing | Counter-issued mandates when the principal cannot use the app (Phase 6, Workspace) |
| Lost phone, lost passkey | Self-service recovery with the eID (R1) | Assisted recovery at a counter (R2, Phase 6) |
| Unfamiliar steps | Plain language, three languages, larger text and high contrast (P3-F4), simplified language option | Usability sessions with older citizens (Phase 1 research kit), before the pilot |
| SMS reliance | SMS is not a sign-in factor (§3) | Q3-7 |

## 6. API and data changes

| | |
|---|---|
| `POST /v1/recovery`, `POST /v1/recovery/{id}:complete` | Public; same answer; gateway route limited to 10 per 10 minutes per address |
| `DELETE /v1/me/sessions` | Ends every other session (week 5) |
| `GET /v1/me/pairwise` | The person's pairwise identifiers per relying party |
| `POST /v1/status-access` | New optional `channel`: `email` (default) or `sms` |
| Migrations | `iam-account-recovery` (attempts, three functions), `iam-pairwise-mirror` (one function) |
| Web app | `/[lang]/recover` page, a link next to "sign in" in the header, completion after the eID return |

## 7. Test evidence

All on 25 Nov 2026, local runs (GitHub results in [01 — Progress](01-progress.md)):

| Run | Result |
|---|---|
| Realms run (`infra/tests/keycloak-realms/run.sh`) | **274 checks, all passed** (1,111 s). New: recovery through the web app in Arabic, French and English (recovery page and eID simulator in the language; the same answer; activation link and notice in the language; no old credential or Keycloak session left; re-activation; signed in again); recovery through the API (an unlinked identity and a lower level than the link: the same answer and nothing sent; wrong state and replay: 404; the real recovery resets the account); the core's pairwise subject equals Keycloak's (C8) and is mirrored (`GET /v1/me/pairwise`); status code by SMS to the number on file; a captured SAML response cannot be replayed; N23, every operation needing a token answers 401 without one |
| Gateway (`infra/tests/api-gateway/run.sh`) | 21/21 (new: recovery is public but limited per address) |
| Dev cell from scratch | 17/17 in 207 s (new migrations applied) |
| Unit and database tests (`pnpm test`, PostgreSQL 16) | 170: core 115 (new: recovery service 9, recovery functions as the application role, removal notices, SMS channel choice, pairwise, quotas), web 24, policies 13, other packages 18 |

Found on the way: a class inserted between a controller's decorators took its authentication guard (`/v1/me` answered
500 instead of 401 in the core end-to-end tests); fixed before any commit, and the new check N23 now calls every
protected operation of the OpenAPI contract without a token ([doc 13](13-security-review-and-readiness.md), SR-1).
