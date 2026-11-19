# 18. Coding Standards

| | |
|---|---|
| Original item | **O-D8** coding standards |
| Applies to | Every change in this repository, by staff, contractors or AI assistants |
| Enforced by | TypeScript compiler settings, CI gates ([16](16-infrastructure-plan.md) §16.4), the fitness check `scripts/check-module-boundaries.mjs`, code review |

## 18.1 Language and compiler

| Rule | Setting |
|---|---|
| TypeScript everywhere (ADR-002) | Node 22 LTS; TypeScript 5.9.x |
| Strict mode | `strict: true`, `noUncheckedIndexedAccess: true` in `tsconfig.base.json` (the NestJS service relaxes only `noUncheckedIndexedAccess` for decorator ergonomics) |
| Targets | ES2023, CommonJS output for services and packages |
| No `any` in exported types | Review rule; `unknown` + narrowing instead |
| Errors | Throw typed errors in domain code; HTTP mapping happens only in the problem-details filter. Never return stack traces |
| Dates and money | ADR-022: `timestamptz` UTC, pack time zone for deadlines; integer minor units + currency code |
| Comments | Explain *why* and cite the source (ADR, FR number, legal article). No commented-out code |

## 18.2 Project structure

| Rule | Detail |
|---|---|
| Monorepo (ADR-023) | pnpm workspaces: `apps/*`, `services/*`, `packages/*`. One lockfile; exact versions |
| Bounded contexts | `services/core/src/modules/<context>/`. Each context exports **only** through `public-api.ts`. Its module file is imported only by `app.module.ts` |
| Platform code | `common/`, `config/`, `country-config/`, `flags/`, `health/`, `meta/`, `metrics/` contain no business rules |
| Shared packages | `packages/*` never import from `services/*` or `apps/*` |
| Configuration | Environment variables validated at start-up (`loadAppConfig`); secrets as `NAME_FILE` |
| Country logic | Never hard-coded. Read from the country pack or rule pack. A literal like `15` (days) or `'Africa/Tunis'` in module code is a review failure |

## 18.3 Data and persistence

1. **One schema per module**; migrations in SQL with node-pg-migrate (ADR-024).
   - Expand/contract: never drop or rename in the same release that stops using the column.
   - Every migration has a down section, used in tests; production never runs down-migrations.
2. **Every table and column** gets a `COMMENT` with `@tier`, `@pii`, `@retention`, `@basis` ([05](05-data-architecture-and-governance.md) §5.3).
3. **Every tenant-scoped table** has `tenant_id uuid not null`, an RLS policy, and `FORCE ROW LEVEL SECURITY`. Indexes lead with `tenant_id`.
4. **UUIDv7** primary keys. No national identifiers as keys.
5. No cross-schema joins in application code. Use the other module's public API or events.

## 18.4 Architecture fitness function

`node scripts/check-module-boundaries.mjs` (run as `pnpm arch:check` in CI). It fails the build when:
1. a module imports another module's internals (anything except `../<other>/public-api`);
2. platform code imports module internals;
3. a shared package imports a service or an app;
4. any source file contains a CIN-like literal outside the synthetic range `99xxxxxx`, or a `+216` number outside `+2160xxxxxxx`.

Phase 2 result: passes on 9 bounded contexts; a planted violation was detected.

## 18.5 API and security definition of done

A change that adds or modifies an endpoint is done only when:
- [ ] the OpenAPI contract is regenerated and the diff is reviewed (ADR-015);
- [ ] authorisation goes through the policy engine, with tests: cross-tenant → 404, wrong role → 403 (IDOR suite);
- [ ] input is validated against a schema; output DTOs contain no fields beyond the contract;
- [ ] mutating POSTs require `Idempotency-Key`; updates use `If-Match`;
- [ ] no personal data appears in logs, metrics, traces, URLs or error messages;
- [ ] T0/T1 reads declare a purpose and write an audit event;
- [ ] user-facing strings exist in AR, FR and EN catalogues; RTL is checked (ADR-014);
- [ ] new personal-data fields are added to the data inventory and reviewed by the DPO (counsel until appointed);
- [ ] tests use synthetic data only, from `packages/synthetic-data` or reserved ranges.

## 18.6 Review rules (O-SEC5)

| Change touches | Reviewers required |
|---|---|
| Anything | **2 approvals** (branch protection), at least one code owner |
| T0/T1 data paths, identity, policies, cryptography | 2 approvals, one with security responsibility (Phase 0 §10.7) |
| Migrations with new personal-data fields | 2 approvals + DPO/counsel |
| Rule packs (regulatory values) | 2 approvals, one from compliance or counsel, with the source reference in the pull request |
| `infra/`, `.github/` | 2 approvals; IaC scan green |

**Current exception:** with one engineer, these rules cannot be met. The founder decides the interim waiver ([readiness report](phase-2-readiness-report.md), decision P2-D2).

## 18.7 Dependencies

| Rule | Why |
|---|---|
| Exact versions; lockfile committed; `--frozen-lockfile` in CI | Reproducible builds (ADR-027) |
| New dependency: check licence (no AGPL in the core runtime without an ADR), maintenance, install scripts, file count/size sanity | Supply chain. Example: `@cedar-policy/cedar-wasm@4.14.1` was an empty publish |
| Prefer versions at least two weeks old, unless the update fixes a vulnerability | Avoid compromised fresh releases |
| Install scripts are blocked by default; allow-list only after review | `pnpm-workspace.yaml` |
| Security overrides (`overrides:`) carry a comment naming the advisory and are removed when upstream fixes it | Traceability |

## 18.8 Git and commits

- Short-lived branches; pull requests to `main`; squash merge; signed commits.
- Commit messages: imperative subject ≤ 72 characters. The body says *why* and references ADR, FR or issue ids.
- No secrets, real personal data, generated build output (`dist/`), local `.env` or `infra/compose/.generated/` in Git (`.gitignore` covers them).

## 18.9 Accessibility and localisation (ADR-014)

- WCAG 2.2 AA is a release gate:
  - automated axe checks in CI for every page;
  - manual keyboard and screen-reader checks for new flows.
- Logical CSS properties only (`margin-inline-start`, not `margin-left`), so RTL works without overrides.
- Numbers use Western Arabic digits (`latn`) in TN; dates use the cell time zone.
