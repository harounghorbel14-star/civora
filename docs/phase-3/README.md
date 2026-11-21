# Phase 3 — Authentication and Citizen Profiles

| | |
|---|---|
| Status | **In progress** (started 21 Nov 2026, decision P3-D0) |
| Dependency | Phase 2 approved by the founder on 21 Nov 2026 ([decision record](../phase-2/founder-review/P2-founder-decision-record.md)) |
| Scope | Original Phase 0 §19 scope, unchanged, plus the additive items of the roadmap protection matrix |

1. [00 — Start record and specification audit](00-phase-3-start-and-specification-audit.md): the original specification word for word, inherited constraints, open questions, 6-week plan.
2. [01 — Progress](01-progress.md): what is built and tested, week by week.
3. [02 — Identity data model, token verification and mandates](02-identity-model-and-mandates.md) (week 1).
4. [03 — Identity realms and authentication](03-identity-realms-and-authentication.md) (week 2): citizens and staff realms, passkeys, TOTP, FIDO2 for officers with approved key models, pairwise subjects, registration without account enumeration, first enrolment only by e-mailed link, login rate limits, tests in Arabic, French and English; defects found; findings.
5. [04 — Sessions, authenticators and step-up](04-sessions-authenticators-step-up.md) (week 3): RFC 9470 step-up, `/v1/me/sessions`, `/v1/me/authenticators`, authenticator mirror.
6. [05 — Branches, teams, staff invitations and cleanup](05-organisation-invitations-cleanup.md) (week 3): unit-scoped roles, invitations, cleanup of accounts never activated, chart identity settings.
7. [06 — Simulated national eID and identity links](06-simulated-eid-identity-links.md) (week 3): adapter framework rules (ADR-028), the `NationalEid` port and its simulated adapter, `POST /v1/identity/links`, keyed digests only.
8. [07 — Institution staff SSO](07-institution-staff-sso.md) (week 3): OIDC and SAML institutions through Keycloak organisations, create-only first sign-in, security key after SSO, realm checker for brokered sign-in.
