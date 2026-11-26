# 15 — Adaptive controls: device and browser of each session (gap G3)

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
| Against Keycloak, the core and the web app (`run.sh`, part `web`), in ar, fr, en | first device: no notice; a sign-in from a second browser: "new sign-in" e-mail in the person's language naming the browser; a session cookie copied to another browser: refused there, the session ended at Keycloak too (its owner must sign in again), "session ended" e-mail in the person's language; the person's other session goes on; the device cookie's attributes | see the progress log |
