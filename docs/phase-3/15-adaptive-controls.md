# 15 — Adaptive controls and sign-in notices (gaps G3 and G1)

| | |
|---|---|
| Specification items | P3-SEC1 (ASVS 5.0 L3), gap **G3** and part of **G1** of [doc 11](11-security-verification.md), finding **SR-5** of [doc 13](13-security-review-and-readiness.md) |
| ASVS 5.0 | V8.2.4 adaptive controls on new and existing sessions · V6.3.5 notice of suspicious sign-ins · V8.1.3, V8.1.4 the attributes and how they drive decisions, documented (doc 11 §2.3) |
| Status | Built and tested on 26 Nov 2026 (§6) |

## 1. What it does

| When | Signal | Decision | The person sees |
|---|---|---|---|
| A new session starts on a device the person used before | device known | allow | nothing |
| A new session starts on a device or browser not seen before (and the person has used others) | device new | allow, record the device | e-mail "new sign-in to your account", naming the browser and system (for example "Chrome · Linux") and the time, with what to do if it was not them |
| A new session after more than 180 days without any sign-in | long absence | allow | e-mail "sign-in after a long absence" |
| The very first device of an account | no device known | allow, record it | nothing (it is the sign-in right after activation) |
| An existing session is now used from another device | device changed | **refuse** the request (401), **end the session** at Keycloak and in the core, for good | e-mail "we ended a session"; the person signs in again |
| An existing session is now used from another browser family on the same device | browser changed | same as above | same |

A stolen session cookie (web app) or a stolen access token is therefore useless from another browser: the first request
from there ends the session for everyone holding it. The person is told and simply signs in again.

**Why a notice and not an extra challenge for a new device (deviation D4, doc 11 §3).** Every sign-in already needs two
factors at this level (a passkey, or a password and the authenticator app; officers: password and security key). An
extra challenge on a new device would ask for the same factors again. The compensating control is the notice, sent at
once, and the security page, where the person can end every other session (doc 04).

## 2. Signals: strongest available, per client

| Client | Device signal | Strength | Browser |
|---|---|---|---|
| Web app (backend-for-frontend), `civora-web` | a random id in the device cookie (`__Host-civora_device`: HttpOnly, Secure, SameSite=Lax so it comes back from Keycloak, 400 days); the web app forwards only its SHA-256 digest (`civora-device` header) | device-cookie | the browser's User-Agent, forwarded (`civora-user-agent`) |
| Other DPoP clients (the mobile app, when built) | the thumbprint of the app's DPoP key, which never leaves the device | device-key | the request's User-Agent |
| Everything else (staff and test clients today) | the browser family | browser | the request's User-Agent |

The forwarded headers are trusted only from a forwarding client (`CONTEXT_FORWARDING_CLIENTS`, default `civora-web`)
**and** only on a DPoP-bound token: the proof shows the request comes from the web app's server, which alone holds the
session's key (doc 14). A bearer token claiming to be the web app, or any other client, cannot set them.

Browser family: browser and system without versions (Chrome, Edge, Firefox, Safari, Samsung Internet, Opera; Windows,
macOS, Linux, Android, iOS, ChromeOS), so updates do not look like a new browser.

**Not used:** location, address and time of day. CIVORA serves citizens at any hour and from anywhere; there is no
geolocation database in the cell; addresses are used only for rate limits (doc 11 §5). Staff sign-in hours per
institution can be added with the Workspace (Phase 6).

## 3. Data (migration `iam-adaptive-context`)

| Table | Holds | Never holds | Kept |
|---|---|---|---|
| `iam.known_device` | person, keyed digest of the device (HMAC-SHA-256 with the cell's digest key, purpose-labelled), strength, browser family, first and last use | a cookie, a key, an address | 400 days after last use; at most 50 per person |
| `iam.session_context` | digest of (realm, Keycloak session id, client), person, device digest, browser family, first and last use, when it was ended | the session id itself | 12 hours after last use (sessions last at most 8) |

Row-level security: the application role reads only the current person's rows and cannot write either table; it calls
`iam.observe_session`, which works on the current person, serialises concurrent first requests of a session
(`INSERT … ON CONFLICT` then `SELECT … FOR UPDATE`), sweeps expired rows a little at each call, and returns the outcome.
The session context is per **client**: one Keycloak session shared by two apps in the same browser has two records,
because each app legitimately sends its own signal.

## 4. Code

| Where | What |
|---|---|
| `services/core/src/modules/identity-access/adaptive-context.ts` | signal resolution, browser family, `AdaptiveControls.check` (allow or deny; notices never delay or fail a request) |
| `identity.guard.ts` | after the token (and DPoP proof) is verified and the person found: a denied check answers 401 `invalid_token` |
| `security-notices.ts` | the three notices in Arabic, French and English, in the account's language, through the messaging port |
| `identity-access.module.ts` | on when the database and the cell's digest key are configured; Keycloak (to end sessions) and the messaging port when configured |
| `apps/web/lib/cookies.ts`, `app/auth/callback`, `lib/core.ts`, `server/context.ts` | the device cookie (set at sign-in when missing), the forwarded headers on every core call |

## 5. Limits (recorded)

- Someone who copies **both** cookies and sets the same User-Agent is not detected by these signals; the session still
  expires (8 hours at most) and every sensitive action needs a recent sign-in (step-up, doc 04).
- Browser-family signals (staff and test clients today) are weak: a different browser of the same family on another
  computer looks the same. The Workspace (Phase 6) will be a backend-for-frontend with the device cookie, like the web app.
- Notices of **failed or partly successful** sign-ins and of a success after several failures (the rest of V6.3.5)
  need Keycloak's sign-in events: still open in G1.

## 6. Tests and results (26 Nov 2026)

| Level | What | Result |
|---|---|---|
| Unit, core (`adaptive-context.test.ts`) | browser families; the web app's forwarded signal trusted only on its DPoP-bound tokens, ignored from bearer tokens and other clients, malformed ids ignored; the mobile app's key as device; no session: nothing checked; decisions: same, new-known and first device quiet, new device and long absence announced, a changed device or browser ended and refused, an ended session stays refused, a failing notice never changes the decision | 7 tests pass |
| Database as the application role (`identity.e2e.test.ts`) | outcomes in order: first-device, same, new-known, new-device, changed-device, ended, changed-browser; long absence after 200 days; digests of 32 bytes only; no row visible without a person; no direct write; no call without a person | pass |
| End to end, core + PostgreSQL | a session used from another browser: 401 `invalid_token`, and it stays refused from the first browser too; another session of the same person and tokens without a session go on | pass; core 131 tests |
| Unit, web | the device cookie's attributes and format; the forwarded headers carry the digest, never the id, and a cleaned User-Agent | 26 tests pass |
| Against Keycloak, the core and the web app (`run.sh`, part `web`), in ar, fr, en | first device: no notice; a sign-in from a second browser: "new sign-in" e-mail in the person's language naming the browser; a session cookie copied to another browser: refused there, the session ended at Keycloak too (its owner must sign in again), "session ended" e-mail in the person's language; the person's other session goes on; the device cookie's attributes | **all passed**: web part 75 checks; whole realms run **286 checks, all passed** (1284 s) |

## 7. Notices from Keycloak's sign-in events (rest of G1, 26 Nov 2026)

ASVS V6.3.5 asks that people be told about suspicious attempts, successful or not; V6.3.7 about changes to their ways of
signing in. Keycloak keeps a short record of sign-in events; the core reads it and writes to the person.

**What Keycloak records (observed on 26.8.1, not assumed).** A probe realm with a password and an authenticator app:

| Attempt | Event | Tells it apart |
|---|---|---|
| Wrong password | `LOGIN_ERROR`, `invalid_user_credentials` | user known, `username` detail, no selected credential |
| Right password, wrong code | `LOGIN_ERROR`, `invalid_user_credentials` | `selected_credential_id` = the authenticator app's credential |
| Success | `LOGIN` | session id |
| A way to sign in added or changed from an app (`kc_action`) | `UPDATE_CREDENTIAL` with `credential_type`, then `LOGIN` with the same `code_id` | the person was signed in |
| A password set through an e-mailed link (activation, recovery) | `UPDATE_CREDENTIAL` only, **no** `LOGIN` | outside any sign-in |
| A credential removed through the admin API (the core's own removal) | none | the core sends its own notice (doc 12 §2) |

**What the core sends** (Arabic, French or English, the account's language):

| Notice | When | At most |
|---|---|---|
| "Right password, second step failed" | a failure on a credential of a second-factor type (authenticator app, security key), or a wrong code in the SMS step, which marks its errors `civora_second_factor=sms` ([doc 17](17-sms-sign-in-factor.md)) | once a day |
| "Failed attempts to sign in" | 5 failures within an hour (the account locks at 5, doc 03) | once a day |
| "Signed in after failed attempts" | a success after 3 or more failures within the hour, with the number | each time |
| "A way to sign in was added or changed" | `UPDATE_CREDENTIAL` inside a sign-in; never for activation or recovery links | each time |
| "A way to sign in was removed" | `REMOVE_CREDENTIAL` (Keycloak's own account pages; the core's removals raise none) | each time |

**How.** The realms store `LOGIN`, `LOGIN_ERROR`, `UPDATE_CREDENTIAL` and `REMOVE_CREDENTIAL` for **one hour** (they
hold addresses; realm checker: stored, 10 minutes to one day, 3 negative controls per realm). The provisioner client
may read them (`view-events`, nothing more). Every 60 s (`SIGNIN_EVENTS_POLL_SECONDS`; `SIGNIN_EVENTS=off` stops it) the
core reads the events since its last round, all pages, with a 2-minute overlap and leaving events younger than 5 s for
the next round (so a change and its sign-in are read together). Each event is recorded once in
`iam.record_signin_event` (whichever core replica reads it), failures are counted per account in a one-hour window,
warnings are limited per day. Accounts are keyed digests of realm and Keycloak user id; the tables keep two hours of
event digests and two days of counters, and the application role can only call the function.

**Limits.** A failed security-key step (staff) counts as a failed attempt; only the authenticator app's failure was
observed as "second step failed". Removals on Keycloak's account pages are handled like the rest but are covered by
unit tests only. **Closed on 27 Nov (V6.3.7):** the e-mail address can no longer be changed on Keycloak's
pages; it changes only through the core's verified flow, which tells the old address ([doc 16](16-contact-details-and-phone-recovery.md)).

| Level | What | Result |
|---|---|---|
| Unit, core (`signin-events.test.ts`) | classification of each event shape above; the watcher reads every page, handles events oldest first, sends each notice once, leaves young events for the next round, re-reads with an overlap without repeating; settings; one round at a time, a failing round survives | 6 tests pass |
| Database as the application role | the exact sequence of outcomes (5th failure warned, 6th not, success after failures with the count, daily limit), an event read twice handled once, a new window after an hour, no table access, invalid input refused | pass; core 138 tests |
| Against Keycloak 26.8.1, the core and the web app (`run.sh`) | lockout after 5 wrong passwords: the owner gets "failed attempts" (Arabic, no language set); in ar, fr, en: right password and wrong code → "second step failed"; a sign-in after failures → the e-mail with the count (4); a passkey added from the web app → "a way to sign in was added"; none at activation | **all passed**: whole run 296 checks (web part 84); the first run failed one older check, E1, because a "way to sign in added" notice for a passkey added earlier arrived inside its 4-second window; E1 now counts only registration mail, and the login part re-run passed 80 of 80 |
