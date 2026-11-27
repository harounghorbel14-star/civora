# 16 — Contact details: verified e-mail change, phone number, recovery by e-mail link and SMS

| | |
|---|---|
| Specification items | P3-F1 (SMS fallback: delivery and recovery part; the sign-in part is doc 17) · P3-D5, P3-SEC4 (recovery paths) · P3-SEC1 (ASVS 5.0 L3) · rest of gap **G1** of [doc 11](11-security-verification.md) |
| Founder decisions (27 Nov 2026) | V6.3.7: **verified flow only** (an e-mail address cannot be changed on Keycloak's pages; a change goes through a flow that verifies the new address and tells the old one) · Q3-7: **SMS for citizens and staff**, as a delivery channel and as a fallback factor, recorded as an ASVS L3 deviation (officers keep FIDO2, P3-SEC5) · Q3-4 recovery: national eID (built, doc 12), counter with an ID document (Phase 6), and a new path **SMS + e-mail link**, both needed, to a phone number verified beforehand on the security page |
| ASVS 5.0 | V6.3.7 notice after a change of authentication details · V6.4.x recovery · V6.6.1–V6.6.3 out-of-band codes (deviation D5) |
| Status | Built and tested on 27 Nov 2026 (§7) |

## 1. What the person sees

| On the security page (signed in) | What happens |
|---|---|
| Contact details: the e-mail address and the confirmed phone number | read from Keycloak through the core (`GET /v1/me/contact`) |
| "Change the e-mail address" | needs a recent sign-in (step-up, doc 04); a six-digit code goes to the **new** address in the account's language; typed back (10 minutes, 5 tries), the address changes (the username follows), the **old** address gets "the e-mail address of your account changed to a•••@domain" and the new one a welcome |
| "Add or change the phone number" | needs a recent sign-in; a code by SMS to the new number (international form, +216…); typed back, the number is stored as verified and the account's address is told (only the last two digits) |
| "Remove the phone number" | needs a recent sign-in; the account's address is told |

| On the recovery page (signed out) | What happens |
|---|---|
| "Recover with your e-mail and phone" (R4): the person types the account's address | always the same answer ("if an account uses this address, we sent it an e-mail"); in the background: if the address belongs to a citizen account with a **verified** phone, a link (30 minutes) goes to that address; an account without one gets advice (eID or counter) and no link; an unknown address gets nothing |
| The link opens the web app | the token moves to the server at once (the address bar shows `/{lang}/recover/phone`, no token); the page offers "Send the code by SMS" |
| "Send the code by SMS" | a code to the verified number (at most 3 per link; each new code replaces the last); the page shows the last two digits |
| The code typed back | every way to sign in is removed, every session ends, Keycloak e-mails a set-up link (authenticator app, then password, as after the eID recovery), and the person is told by e-mail **and** by SMS |

The eID recovery (doc 12) stays the first path; the counter (an agent checks an identity document) comes with the
Workspace in Phase 6.

## 2. How the e-mail address is protected

**On Keycloak's side (realm policy, checked by `check-realm-security.py` on the files and on the live realm):**
username and e-mail are editable by administrators only in the declarative user profile; `editUsernameAllowed` is
off; the required action `UPDATE_EMAIL` must not be enabled; the new attributes `phone_number` (E.164) and
`phone_number_verified` are visible and editable by administrators only. Six negative controls per realm prove each rule
is enforced (realm files: citizens and staff).

**What Keycloak does with these settings (probe on 26.8.1, not assumed):**

| Attempt | Result |
|---|---|
| The user changes the e-mail or username through the account API (Keycloak's account pages) | `204`, **nothing changes** (read-only attributes are ignored) |
| The user sets the phone attribute through the account API | `400 error-user-attribute-read-only` |
| The provisioner (admin API) updates the user with the whole representation and a new e-mail | `204`; the username follows the e-mail in the citizens realm (e-mail as username) |
| The same with a partial representation | `400` (the profile requires the e-mail): the core always sends the whole representation |
| A new e-mail already used by another account | `409 User exists with same email` |

**In the core** (`contact-details.ts`, `contact-details.controller.ts`, `KeycloakContactDirectory`):

| Endpoint | Rule |
|---|---|
| `GET /v1/me/contact` | the address and the verified number only |
| `POST /v1/me/contact-changes` `{channel: email\|phone, value}` | step-up; value normalised (lower-case address; number in E.164, spaces and `00` accepted); refused when it is the current one (409); a code is sent to the new value at once (422 if it cannot be delivered: the simulated SMS channel accepts synthetic numbers only); at most 5 changes per account in 24 hours (429); a newer change of the same kind replaces an open one |
| `POST /v1/me/contact-changes/{id}:confirm` `{code}` | the account that started it only; wrong code: 422 with the tries left; then 404; an address used by another account: 409 — checked **after** the code, so nobody learns whether an address has an account without reading its mailbox |
| `DELETE /v1/me/phone` | step-up; 404 when there is none |

Codes and changes are kept as digests and keyed digests of the account (realm and Keycloak user id), in
`iam.contact_change`; the new value is kept only until it is confirmed or replaced (then cleared); rows go after two days.

## 3. Recovery R4 in detail

| Step | Call (public, no token) | Rule |
|---|---|---|
| 1 | `POST /v1/recovery/contact` `{email, locale}` → `202 accepted` | same answer and timing for every address (the work runs in the background); a link at most every 15 minutes per address; at most 3 recoveries per account in 24 hours; a cell-wide brake (2,000 in 10 minutes) |
| 2 | `POST /v1/recovery/contact/{id}:send-code` `{token}` → `201 {phoneEnding, expiresAt}` | the link's token is needed; at most 3 codes per link, 10 minutes each, the newest only |
| 3 | `POST /v1/recovery/contact/{id}:complete` `{token, code}` → `202` | **both** the link's token and the current SMS code; 5 tries in all; single use; then the account is reset exactly as after the eID recovery |

**Why the link first.** No SMS is ever sent to someone who only knows an address (no "SMS pumping" at the cell's
cost, no codes pushed to a phone to confuse its owner), and someone who has taken over the phone number (SIM swap)
cannot even start without the mailbox. Taking over the account needs **both** the mailbox and the phone line, and the
person is then told on both.

The gateway's recovery route (`/v1/recovery/*`, 10 calls per client address in 10 minutes) also covers these calls; a
normal R4 recovery takes 3. Data: `iam.contact_recovery` (keyed digests of the address and the account, the
Keycloak user id and the number only while the attempt is open, digests of the link token and the code; the outcome
kept 90 days); functions only, as for the other recovery tables.

## 4. ASVS 5.0 and deviation D5

| Requirement | Before | Now |
|---|---|---|
| V6.3.7 notify after a change of authentication details | Partial (an e-mail address could be changed on Keycloak's pages without telling the old one) | **Met**: no change on Keycloak's pages; every change through the core tells the old address (e-mail), the account's address (phone added, changed, removed) |
| V6.6.1 (L3: no phone or SMS for authentication) | Met (no SMS factor) | **Met with deviation D5** |
| V6.6.2 codes bound to their request | Met | Met: codes bound to the change and the account, or to the recovery attempt and its link |
| V6.6.3 codes rate limited | Met | Met: 5 tries per code, 3 SMS per link, 5 changes a day, gateway limit |

**D5 (V6.6.1).** An SMS code is one of the **two** proofs of recovery R4 (with the e-mailed link) and, from doc 17, a
fallback sign-in factor for citizens and non-officer staff. ASVS L3 does not allow phone or SMS for authentication.
Reason: founder decision Q3-7 (inclusion: not every person keeps an authenticator app or a passkey; phones are
universal in Tunisia). Controls: the number must be verified first (a code sent to it, typed back by the signed-in
person); recovery needs the mailbox **and** the phone; no SMS before the link is followed; codes are six digits, single
use, 10 minutes, 5 tries; limits per link, account, address and client; notices by e-mail and SMS; officers never use
SMS (P3-SEC5); the SMS provider is not chosen (Q3-1, pilot gate PG-6): simulated only, synthetic numbers only, until
then.

## 5. Limits (recorded)

- Someone holding both the person's mailbox and phone line can recover the account; that is the stated design (two
  independent channels). The notices on both channels and the eID path remain.
- A number cannot be verified for another person: the code goes to the number itself. A person who loses the number
  can remove it once signed in, or use the eID or the counter.
- Staff have the same e-mail and phone screens through the API; their screens come with the Workspace (Phase 6).
  Recovery R4 is for citizens only: staff are re-invited by their institution's administrator (doc 05).

## 6. Code and data

| Where | What |
|---|---|
| `services/core/migrations/1764806400000_iam-contact-details.sql` | `iam.contact_change`, `iam.contact_recovery`; `start_contact_change`, `confirm_contact_change`, `start_contact_recovery`, `contact_recovery_code`, `complete_contact_recovery` (SECURITY DEFINER; the application role has no table grant) |
| `services/core/src/modules/identity-access/contact-details.ts` | the two services, the messages in Arabic, French and English |
| `contact-details.controller.ts`, `keycloak-admin.ts` (`KeycloakContactDirectory`), `iam.repository.ts`, `identity-access.module.ts` | endpoints, the Keycloak side, wiring (`RECOVERY_LINK_ORIGIN`: the web app's origin, https outside dev and test) |
| `infra/keycloak/realms/*.json`, `infra/scripts/check-realm-security.py` | user profile and its rules, 6 negative controls per realm |
| `apps/web/app/[lang]/security/page.tsx`, `app/[lang]/actions.ts` | contact details on the security page (the pending change waits in the server-side session) |
| `apps/web/app/[lang]/recover/*`, `app/recover-link/route.ts`, `lib/session.ts`, `lib/cookies.ts` | recovery R4: the link's attempt in the server store behind an HttpOnly, SameSite=Lax cookie limited to the phone page of that language (30 minutes) |

## 7. Tests and results (27 Nov 2026)

| Level | What | Result |
|---|---|---|
| Unit, core (`contact-details.test.ts`) | e-mail: code to the new address in the account language, a wrong code changes nothing, the change, the old address told with the new one masked, single use; refusals (malformed, current, sixth change, undeliverable, another account); an address in use refused after the code; phone: SMS code, verified, notice with the last two digits, removal; a failing notice never undoes a change; R4: unknown address nothing sent, no verified phone advice only, link then SMS then reset with notices by e-mail and SMS, the link alone and a wrong token refused; link origin settings | 8 tests pass |
| Database as the application role (`identity.e2e.test.ts`) | contact changes: bound to the account, wrong code then right one, single use, a newer change replaces an older one of the same kind only, 5 tries, 5 a day, no table access; R4: the link alone recovers nothing, a code needs the link, the code needs the link, a new code replaces the last, single use, 3 codes per link, 5 tries, advice rows never complete, one open attempt per account, 3 recoveries a day, no table access | pass |
| Realm checker | citizens and staff files: every rule holds; 6 new negative controls rejected in each | pass |
| Against Keycloak 26.8.1, the core and the web app (`run.sh`, part `web`), in ar, fr, en | see the run record below | see below |
