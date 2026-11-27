# 01 — Catalogue, editorial workflow, signed content and search

| | |
|---|---|
| Specification items | P5-D1 data model, P5-D2 editorial back office with four-eyes approval (API), P5-D4 search, P5-A1 `pg-public`, P5-A3 Postgres FTS with Arabic normalisation, P5-F1 service pages, P5-F2 offices, P5-F3 change history, P5-F4 report an error, P5-DB1…DB6, P5-API1…API4, P5-SEC1 editorial RBAC, P5-SEC2 signed content versions, P5-SEC3 integrity checks (the check; the scheduled monitor is week 4) |
| Built | 27 Nov 2026 (weeks 1–2) |
| Code | `services/core/migrations-public/1765238400000_catalogue.sql` (own migrations, own table `schema_migrations_public`, for the pg-public cluster); `services/core/src/modules/catalogue/` |
| Tests | `catalogue.db.test.ts` (6, PostgreSQL as the least-privilege role); `catalogue.e2e.test.ts` (4: the application, both databases, the content key in SoftHSM); `migrations.integration.test.ts` (public migrations up, down, up) |
| Not yet | the public pages (D3, A2: static generation in the web app, week 3), the office locator page, the curated procedures (D5, weeks 4–5), the dev-cell and Kubernetes wiring of the pg-public migrations and `CATALOGUE_DATABASE_URL` (next) |

## 1. Data model (P5-DB1 … DB6)

| Table | Holds |
|---|---|
| `catalogue.service` (DB1) | code `TN-<area>-<nnn>`, slug (the page address; the wallet's renewal links use it, Phase 4 doc 06), category, the published version |
| `catalogue.service_version` (DB2) | title, summary, institution (ar and fr required, en optional), online link, processing time, change note, **last verified on**, author, approver, digest and **signature**, state `draft → in-review → approved → published → superseded` (or withdrawn), translation review `pending` until a native legal-language editor reviews it (P5-T4; never marked reviewed by engineering) |
| `catalogue.requirement` (DB3) | the steps, documents, conditions and fees of a version (fees with an amount in TND), **each with 1 to 10 sources** |
| `catalogue.source_ref` (DB4) | an official page or a legal text; a legal text must carry its official-journal (JORT) reference; https only; the date it was read |
| `catalogue.office` (DB5) | an office as an official source lists it (the source is required), governorate, address, optional coordinates bounded to Tunisia, hours, last verified |
| `catalogue.editorial_review` (DB6) | append-only log: submitted, approved, changes requested (with the comment), published, withdrawn; who and when |
| `catalogue.content_error_report` (F4) | the version and the message (5–2000 characters). **No name, contact or address** is asked for or kept |

The application role reads published content through two views and the sources and offices tables, and changes
everything else through definer functions. It cannot read drafts from the tables.

## 2. Rules the database enforces

- **100 % citation coverage (P5-AC1)**: a step, document, condition or fee without a source cannot be stored; a draft
  goes to review only if every cited source exists, it has at least one step and a last-verified date not in the future.
- **Four-eyes (P5-D2)**: the approver must be another person than the author — checked on the person, so holding both
  roles does not help. An approved version is immutable; drafts only are editable.
- **Signed versions (P5-SEC2)**: at approval the application builds the version's **canonical content** (the database's
  own function: stable key order, parts sorted), signs it in the HSM with the cell's content key, and the database
  checks that the digest it is given is the digest of that content before storing the approval.
- **Change history (P5-F3)**: publishing a version supersedes the previous one; both stay readable by number.

## 3. Roles (P5-SEC1)

Staff tokens with the realm roles `catalogue-editor` (create, draft, submit, register sources) and `catalogue-approver`
(request changes, approve, publish), and the cell operator's institution (`CATALOGUE_EDITOR_TENANT`; required outside
dev and test). Citizens, staff of other institutions and staff without the role are refused (403); no token, 401.

## 4. Signatures and integrity (P5-SEC2, SEC3)

The signature is a detached JWS (RFC 7515 appendix F) — `header..signature`, ES256, `typ civora-catalogue-content+jws`
— over the canonical content. Anyone can check a page: `GET /v1/services/{code}/versions/{v}/content` gives the exact
signed bytes and the signature, `GET /v1/catalogue/keys` the public key; the page's `integrity.content_digest` is the
SHA-256 of those bytes. The content key is made by the same ceremony as the wallet's keys (Phase 4 doc 02).

## 5. Search (P5-D4, A3)

PostgreSQL full-text search over published services (title, summary, the parts' text), with one normalisation function
for the index and the query: Arabic diacritics and tatweel removed; alef forms, taa marbuta and alef maqsura unified;
the definite article and the prefixes joined to it (ال، لل، وال، بال، كال، فال) stripped at the start of a word; French
accents folded. "الهوية" finds "للهويّة"; "resume" finds "Résumé". OpenSearch remains the later option (P5-A3).

## 6. API (P5-API1 … API4)

| Route | Who |
|---|---|
| `GET /v1/services` (`?category=`, `?q=`), `GET /v1/services/{code}`, `GET /v1/services/{code}/versions`, `GET /v1/services/{code}/versions/{v}`, `GET /v1/services/{code}/versions/{v}/content`, `GET /v1/catalogue/keys` | public |
| `GET /v1/offices` (`?governorate=`) | public |
| `POST /v1/admin/services`, `PUT /v1/admin/services/{id}/versions/{v}`, `POST /v1/admin/services/{id}/versions/{v}:submit` | editor |
| `POST /v1/admin/services/{id}/versions/{v}:approve`, `:request-changes`, `:publish` | approver (not the author) |
| `POST /v1/admin/sources` | editor |
| `POST /v1/feedback/content-errors` | public (the gateway limits requests per client) |

## 7. Results (27 Nov 2026)

| Test | Result |
|---|---|
| Database: sources (a legal text without its JORT reference and an http URL refused); a draft citing an unknown source, a part with no source, a draft with no steps refused; submission locks the draft; the author cannot approve; a digest that is not the content's refused; publication; drafts not readable by the application role; a second version supersedes the first; search in Arabic and French; error reports without personal data, not readable back by the application role | 6 of 6 pass |
| End to end: RBAC (citizen, other institution, no role, no token); editor drafts with a registered source and submits; the author holding the approver role is refused; another approver approves (signature made in SoftHSM); not visible before publication; the page carries steps, documents, fees, sources and last verified, translation review `pending`; the signature verifies with the published key and fails on altered content; a second version with changes requested then approved supersedes the first; history; search in Arabic and French; error report | 4 of 4 pass |
| Migrations: public migrations up, down, up on their own table | pass |
