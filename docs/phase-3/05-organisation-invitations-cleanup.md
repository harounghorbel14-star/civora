# 05 — Branches, teams, staff invitations and cleanup (Phase 3, week 3, part 2)

| | |
|---|---|
| Specification items | P3-R3 branch/team-scoped roles · staff onboarding without administrator-known passwords (closes R-P3-3 for staff) · R-P3-8 accounts never activated |
| Status | Built and tested against the real Keycloak realms on 21 Nov 2026 (results §4); GitHub results in [01 — Progress](01-progress.md) |

## 1. What was built

| Part | What it does |
|---|---|
| Data (migration `iam-org-units-invitations`) | `iam.org_unit` (branch, or team inside a branch, per institution), `iam.membership` (role `member` or `supervisor` in a unit), `iam.staff_invitation`. Row-level security by tenant; every change through SECURITY DEFINER functions that check the caller. The transaction carries the tenant and whether the caller administers it (`app.tenant_id`, `app.tenant_admin`), set by the core from the verified token only |
| Scoped roles | `iam.unit_role(person, unit)`: a branch supervisor's role covers the teams of the branch; a team role stays in its team |
| `GET /v1/org/units` | Staff: the branches and teams of their institution only |
| `POST /v1/org/units` | Tenant administrator, step-up: create a branch, or a team inside a branch (`400` otherwise; `409` same name twice) |
| `GET /v1/org/units/{id}/members` | Tenant administrator, or a supervisor of the unit or of its branch (`403` otherwise) |
| `PUT` / `DELETE /v1/org/units/{id}/members/{personId}` | Tenant administrator, step-up: give or remove a unit role; only staff of the same institution (`404` otherwise) |
| `GET /v1/me/memberships` | The staff member's own unit roles |
| `POST /v1/staff/invitations` | Tenant administrator, step-up: creates the staff account **with no credential** in the administrator's institution, records the intended unit role, e-mails the invitation link (48 h): e-mail verified, **security key** (approved model), then **password**. The unit role becomes a membership at the first sign-in; an invitation of one institution is never applied in another. An address that already has a staff account: `409` (without saying which institution); a unit that does not exist: `404` and no account is left behind |
| Token | The core reads realm roles (`realm_access.roles`); `tenant-admin` identifies an institution's administrator (assigned by the platform operator) |
| Cleanup (R-P3-8) | `tools/cleanup-unactivated` (logic in the identity module, behind its public API): removes accounts with an unverified e-mail, **no credential at all**, older than the limit (citizens 24 h, staff 7 days); never an account that has any credential |
| Helm chart | Identity settings for the core (issuers, Keycloak inside the cell, provisioner secrets as files), **network egress to Keycloak** (missing until now: in a real cell the core could not have fetched the token signing keys), and the hourly CronJob for the cleanup (off until a cell configures its provisioners; refuses to render without the secret) |

## 2. Who may do what

| Action | Citizen | Staff member | Unit supervisor | Tenant administrator |
|---|---|---|---|---|
| List units of the institution | — | yes | yes | yes |
| List members of a unit | — | no | their unit, or teams of their branch | yes |
| Create units, set or remove unit roles | — | no | no | yes, with a recent sign-in |
| Invite staff | — | no | no | yes, with a recent sign-in |

## 3. Design notes

- **No administrator ever knows a staff password**: the invitee sets it from the link, after enrolling a security key.
  Together with the login flow that refuses an account without a key (doc 03 §9.2), this closes R-P3-3 for staff.
- **The database decides**: the core only translates the functions' errors (not allowed `403`, not found `404`,
  invalid `400`, duplicate `409`). A defect in a controller cannot grant a role the function refuses.
- **Cleanup runs as a separate job**, one instance at a time (`concurrencyPolicy: Forbid`), not inside every core pod.

## 4. Test evidence (21 Nov 2026)

`infra/tests/keycloak-realms/org.cjs` (run by `run.sh` after the realm journeys and the account checks), against
Keycloak 26.8.1, the core as `civora_core_app`, Chromium with virtual security keys, mail catcher: **all checks
passed**. The whole run (realm journeys in Arabic, French and English, security checks, account checks, these checks):
123 checks, all passed.

| # | Check | Result |
|---|---|---|
| 1 | Platform operator appoints the administrator (role `tenant-admin`), who activates (key, password) and signs in: token with `tenant_id` and the role | ok |
| 2 | Create a branch and two teams `201`; a team without branch `400`; the same team name twice `409` | ok |
| 3 | Invite a member of a team (in French) and a supervisor of the branch `201`; the invitee's account is in the institution and has no credential; French e-mail; key asked before the password | ok |
| 4 | The member's first sign-in: `GET /v1/me/memberships` shows the team, role member | ok |
| 5 | The branch supervisor sees the team's members; the member cannot list members, create units or invite (`403`) | ok |
| 6 | Inviting an address that already has a staff account `409`; inviting into a missing unit `404` and no account left behind | ok |
| 7 | The administrator gives the member a supervisor role in the other team (`204`): they see that team's members and still not their own team's; role removed `204` | ok |
| 8 | Administration with a sign-in older than the step-up limit `401 insufficient_user_authentication`; after signing in again `201` | ok |
| 9 | Cleanup: a never-activated citizen and a never-activated invitee removed; every activated account kept | ok |

Database (end to end as the application role): another institution sees none of the units and cannot attach a team
to them; only the administrator creates units; an invitation becomes a membership at the first sign-in and is never
applied in another institution; branch supervisor sees team members, a team member does not; no role for staff of
another institution; the application role cannot insert units directly. Unit: cleanup removes only unverified,
credential-less, old accounts. Tests: 85 across the workspace (core 67, with PostgreSQL); OpenAPI 18 paths / 23 operations; module boundaries pass; chart lint
and manifest validation pass.

## 5. Defect found afterwards (21 Nov 2026, fixed)

The longer realms run of week 3 part 3 ([doc 06](06-simulated-eid-identity-links.md)) showed that the cleanup also
removed **Keycloak service-account users**: they have no e-mail, no credential and no verified e-mail, so they matched
"never activated". In that run it removed the core's provisioner service accounts in both realms, and every later
admin call of the core failed (`401`). Check 9 above did not see it, because no test needed the provisioner after the
cleanup. This version was merged into `main` with PR #6; no cell runs the CronJob yet (it is off by default).

Fix: the cleanup only considers accounts **with an e-mail address**, never a service account (username prefix
`service-account-`, and the full record's service-account link is checked again before deleting). New checks: unit
test with service accounts and an account without e-mail; realms test: both provisioner service accounts still exist
after the cleanup, and a registration still sends its e-mail afterwards.

