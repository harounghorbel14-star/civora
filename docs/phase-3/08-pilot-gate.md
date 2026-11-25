# 08 — Pilot gate: identity requirements that must be closed before any pilot

| | |
|---|---|
| Purpose | One list of what the identity work leaves open that **blocks a pilot** (real users, real institutions). An item leaves this list only with test evidence, or with a recorded founder decision |
| Recorded | 22 Nov 2026, on the founder's instruction to keep R-P3-14 among the requirements to close before the pilot |
| Scope | Identity and authentication (Phase 3). Phase 2 carry-forwards (CF-1 staging cell, CF-2 external review, CF-3 to CF-5) keep their own records in the [Phase 2 decision record](../phase-2/founder-review/P2-founder-decision-record.md) and gate the pilot as well |

## Blocking items

| # | Item | Why it blocks | Closed when | Owner | Status |
|---|---|---|---|---|---|
| **PG-1** | **R-P3-14: institution back-channel logout** ([doc 07](07-institution-staff-sso.md)) | When an institution disables a leaver, an open CIVORA session lasts until the session limit (idle 30 min, at most 8 h). Unacceptable for bank or government staff with real data | Each SSO institution ends CIVORA sessions at once: OIDC back-channel logout and SAML single logout configured per institution by `configure-tenant-sso.py`, checked by the realm checker, and a test showing that disabling a user at a simulated institution (both protocols) ends the CIVORA session and refresh token within a stated time | Engineering | **Open** |
| PG-2 | R-P3-12: rotation of the key for identifier digests ([doc 06](06-simulated-eid-identity-links.md)) | Without a procedure, a leaked or expiring key cannot be replaced without breaking identity links | A written and tested re-keying procedure (or re-link campaign) | Engineering | Open |
| PG-3 | Q3-5: approved officer security-key models and their vendor attestation roots ([doc 03 §9.3](03-identity-realms-and-authentication.md)) | Key enrolment fails closed until set: no officer can enrol | Founder decision; the staging/pilot list loaded by `apply-realm-policy.py --approved-keys`; the live check with `--require-approved-keys` passes | Founder (procurement) | Open |
| PG-4 | Q3-6 / R-P3-9: mail relay for activation and invitation e-mails | No relay, no activation: citizens and invited staff cannot get their first credential | Provider chosen; relay set per cell (`--smtp-host`, password in Keycloak's vault); a registration e-mail received in staging | Founder (provider) | Open |
| PG-5 | Q3-2: national eID scheme and authorisation | Without it only the simulator exists (register entry I-01, class 3); a pilot must not present simulated identity proofing as real | Either an authorisation and a production adapter (class 1 or 2), or the pilot explicitly runs without eID links | Founder / authority | Open |
| PG-6 | Q3-1: SMS provider (fallback, and customer codes for the status page if SMS is chosen) | P3-F1 lists SMS as a fallback; R2 codes need a channel to the customer | Provider and legal basis chosen, or the pilot runs with e-mail codes only, recorded as a decision | Founder | Open |
| PG-7 | Web app sessions in a shared store ([doc 09](09-citizen-web-app.md)) | The citizen web app keeps its sessions in process memory: one replica only; a restart signs everyone out | Sessions in the cell's Valkey (encrypted at rest, same limits), tested with two replicas and a restart | Engineering | Open |
| PG-8 | ASVS L3 for the whole application before real users ([doc 11](11-security-verification.md)) | The week-5 assessment covers identity only (153 requirements; 121 of 143 applicable met) and is a self-assessment. Open there: adaptive controls (G3), the production domain on the HSTS preload list (G5), edge limits for the web app (ADR-030) | Gaps G1–G5 of doc 11 closed or accepted by the founder; the remaining ASVS chapters assessed for the whole application; an external test with no open high finding | Engineering; founder (domain, external tester) | Open |

## Rules

- Nothing on this list is closed by changing the text: each closure links the commit and the test run that prove it.
- New items are added as they are found (for example, from the week-5 negative tests and the week-6 security review, P3-AC2).
- The Phase 3 readiness report (week 6) restates this list; the pilot cannot start while any blocking item is open.
