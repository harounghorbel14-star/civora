# 17 — A code by SMS as a fallback sign-in step (P3-F1)

| | |
|---|---|
| Specification items | P3-F1 (SMS fallback) · P3-SEC5 (officers: FIDO2) · P3-SEC1 (ASVS 5.0 L3, deviation D5) |
| Founder decision | Q3-7 (27 Nov 2026): SMS for citizens and staff, as a delivery channel **and** a fallback factor, recorded as an ASVS L3 deviation, through a Keycloak extension using the simulated SMS channel; officers keep FIDO2 only |
| Status | Built and tested on 27 Nov 2026 (§6) |

## 1. What the person sees

| Who | Sign-in |
|---|---|
| Citizen with a passkey | unchanged: the passkey alone |
| Citizen with a password, the authenticator app and a verified phone number (doc 16) | password, then the authenticator app as before; **"Try another way" → "Code by SMS"**: a six-digit code to the verified number, typed on the next page |
| Citizen with a password and a verified number but no authenticator app (for example after removing it on another device) | password, then the SMS code straight away |
| Citizen without a verified number | no SMS: if the option is picked under "Try another way", Keycloak answers "This way to sign in is not available for this account" and nothing is sent |
| Staff member who is not an officer, with a verified number | password, then the security key; "Try another way" → SMS code |
| **Officer** | password and security key only; the SMS option, if picked, is "not available for this account" and nothing is sent (P3-SEC5) |

The page and the SMS are in the person's language (Arabic, French or English). The page offers "Send a new code"
(at most 3 codes per sign-in; each new code replaces the last).

## 2. The extension (`infra/keycloak/extensions/civora-sms`)

A Keycloak authenticator, `civora-sms-otp` (Java 21, built against Keycloak 26.8.1, whose libraries are not bundled):

| Rule | How |
|---|---|
| Who may use it | `phone_number_verified = true` and a well-formed `phone_number` (both editable by administrators only; the core sets them after its own code, doc 16); the account enabled; not a holder of the realm's excluded role (`civora.sms.excludedRole`; staff realm: `officer`; a role that does not exist excludes everyone); a sender configured for the realm |
| The code | six digits from a CSPRNG; only its SHA-256 digest is kept, bound to the sign-in (authentication session and tab); 5 minutes; 5 tries; 3 codes per sign-in |
| Wrong codes | recorded as sign-in errors with `civora_second_factor=sms`, counted by Keycloak's brute-force protection (the account pauses after 5 failures, as for passwords); the core's notice "right password, second step failed" names the code by SMS (doc 15 §7). Keycloak counts only steps of the categories password, otp and recovery codes (observed on 26.8.1), so the step declares the category `otp` |
| Sending | the only sender is the **simulated** one (register entry M-01, class 3): it delivers to the dev and test mail catcher as `sms.<digits>@sms.civora-cell.invalid`, accepts synthetic numbers only (+2160…), and works only when the Keycloak container has `CIVORA_SIMULATED_SMS=allowed`; the realm says which sender to use (`civora.sms.sender`, set by `apply-realm-policy.py --sms-sender simulated`). With no sender configured the step is never offered. A real provider follows Q3-1 (pilot gate PG-6) |
| Texts | theme messages bundled in the JAR (`theme-resources/messages`, ar/fr/en); the page `login-civora-sms.ftl` uses Keycloak's own layout |

**Observed on Keycloak 26.8.1 (probe, not assumed).** "Try another way" lists every step that is not tied to a stored
credential, whoever signs in: the SMS option appears even for an officer or an account without a number. Keycloak itself
then refuses it before the step runs (the step reports "not configured" for that account), with its generic page; the
realms override that page's text in the three languages (`localizationTexts`, "not available for this account"). Texts
bundled in an extension cannot override Keycloak's own messages; realm texts can. A first version put these texts in a
second `localizationTexts` block of the realm file: JSON keeps only one of two equal keys, so they were lost; the realm
checker now refuses a file with a duplicated key and requires the refusal text in the three languages.

## 3. Realm flows

| Realm | Second step (conditional sub-flow, runs when the account has one of its steps) |
|---|---|
| citizens (`citizens-otp`) | authenticator app **or** SMS code (alternatives, app first) |
| staff (`staff-key`) | security key **or** SMS code (alternatives, key first); `civora.sms.excludedRole = officer` |

An account with neither still meets "no second factor: refused" (unchanged). The realm checker models the SMS step and
the excluded role, and now follows Keycloak's rule for "user configured" (every REQUIRED step, or at least one
ALTERNATIVE): new rules — an SMS code alone never completes a sign-in; an officer with a verified number never signs in
without the key; the staff realm must exclude officers when the SMS step is present; the refusal text in ar, fr and en;
negative controls "SMS step offered to officers", "SMS step instead of the password" and "SMS refusal text missing";
a realm file with a duplicated key is refused.

## 4. Deployment

| Where | What |
|---|---|
| Tests and dev cell | the JAR mounted in `/opt/keycloak/providers` (`start-dev` builds it in); `CIVORA_SIMULATED_SMS=allowed`; `--sms-sender simulated` |
| Staging and production | `infra/keycloak/image/Containerfile`: the upstream image by digest, plus the JAR, `kc.sh build` (optimised, as the Operator runs it). The release pipeline builds, signs and pins it in `infra/k8s/keycloak/keycloak.yaml` before the realms with the SMS step are imported there; no sender is configured until Q3-1, so the step stays off |

## 5. ASVS 5.0

Deviation D5 (V6.6.1; doc 11 §3, doc 16 §4): SMS is a fallback second factor for citizens and staff who are not
officers. V6.6.2 (codes bound to their request): bound to the sign-in. V6.6.3 (rate limited): 5 tries per code, 3
codes per sign-in, the realm's brute-force protection. V6.5.5 (lifetime): 5 minutes. V6.3.5: a failed SMS code is
announced like a failed authenticator-app code.

## 6. Tests and results (27 Nov 2026)

| Level | What | Result |
|---|---|---|
| Unit, extension (JUnit 5, `mvn package`) | codes: six digits, varied, only a digest kept, bound to the sign-in, constant-time check; numbers and what the page shows; the simulated channel refuses without permission, real numbers, long texts, an unconfigured realm; eligibility: verified number only, disabled accounts, officers excluded, a missing excluded role excludes everyone, no sender: never offered | 5 tests pass |
| Unit, core | a wrong SMS code is a failed second step (`signin-events.test.ts`) | pass |
| Realm checker | citizens and staff files with the SMS step: every rule holds; 3 new negative controls rejected (citizens 41, staff 42 in all); a file with a duplicated key refused | pass |
| Probe, Keycloak 26.8.1 with the extension | the option under "Try another way" in fr and ar, the page and the SMS in the person's language, wrong code refused, a new code replaces the old, an account with only a number goes straight to SMS, errors marked `civora_second_factor=sms`; ineligible accounts refused by Keycloak, nothing sent; realm texts override the refusal page | as described in §2 |
| Image | `docker build -f infra/keycloak/image/Containerfile .`: the provider in place, `kc.optimized = true` | pass |
| Against Keycloak 26.8.1 with the extension, the core and the simulated SMS channel (`run.sh`, parts `login` and `sms`), in ar, fr, en | live realms conform (citizens 42, staff 43 negative controls); the whole login part unchanged (every earlier sign-in and security check, with the new flows); SMS: the option under "try another way", its page and the SMS in the language, a wrong code refused, a new code replacing the old, the core's "second step failed" e-mail naming the code by SMS; an account with only a number goes straight to SMS; an account without a verified number and an officer get "not available for this account" and no SMS; five wrong codes lock the account; staff who are not officers sign in with password and SMS; officers still with the key | **all passed**: 96 checks, of which 16 in the SMS part (227 s). Found on the way: brute-force counting needs the category `otp`; the duplicated realm key (above) |
