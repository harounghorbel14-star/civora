# 04 — Integrity monitoring, freshness and the handling of error reports

| | |
|---|---|
| Specification items | P5-SEC3 integrity monitoring (the scheduled monitor), P5-AC2 "median last verified age < 90 days" (measured and alerted), P5-F4 "report an error" (the editors' side) |
| Built | 28 Nov 2026 (week 4, first part) |
| Code | `services/core/src/modules/catalogue/integrity.ts` (monitor, gauges), `content-signature.ts`; `migrations-public/1765324800000_content_error_handling.sql`; `CatalogueReportsController`; alert rules `infra/k8s/monitoring/civora-infrastructure-alerts.yaml` (group `civora-services-directory`) |
| Tests | `integrity.test.ts` (3); `catalogue.db.test.ts` (+1: reports); `catalogue.e2e.test.ts` (+2: reports, and the monitor with the HSM key and a row changed in the database); `infra/k8s/monitoring/tests/civora-directory-alerts.test.yaml` (promtool) |
| Not yet | the editors' screens for reports (with the back office, D2); a notification to editors when a report arrives |

## 1. Integrity monitor (P5-SEC3)

Every `CATALOGUE_INTEGRITY_SECONDS` (default 3600; 0 turns it off; first run 30 s after start) each core replica:

1. rebuilds the canonical content of every published and superseded version from the rows as they are now
   (`catalogue.canonical_content`, the same function that was signed at approval);
2. checks that its SHA-256 is the digest fixed at approval — a row changed outside the editorial workflow (directly in
   the database, a faulty restore, a migration bug) no longer matches;
3. when the cell has its content key, checks the stored signature with it (the digest matching but the signature not
   would mean the stored signature was replaced).

A failing version is logged (code, version, reason: `digest`, `signature` or `missing`; never the content) and counted.
The static site generator makes the same checks at every build and writes nothing when one fails ([02 §2](02-public-pages.md)),
so a tampered version never reaches a public page; the monitor finds it even when no build runs.

| Gauge | Meaning |
|---|---|
| `civora_catalogue_integrity_failures` | versions that no longer match their approval |
| `civora_catalogue_integrity_versions_checked`, `…_signatures_checked` | the last run's scope (signatures 0 when the cell has no key) |
| `civora_catalogue_integrity_last_run_timestamp_seconds` | end of the last completed run |
| `civora_catalogue_published_services` | published services |
| `civora_catalogue_last_verified_median_age_days` | median age of "last verified" (P5-AC2) |
| `civora_catalogue_stale_services` | published services last verified more than 90 days ago |

## 2. Alerts

| Alert | When | Severity |
|---|---|---|
| `CivoraCatalogueIntegrityFailure` | any failure | page |
| `CivoraCatalogueIntegrityNotRunning` | no completed run for 3 hours | ticket |
| `CivoraCatalogueVerificationOverdue` | median last-verified age ≥ 90 days for an hour (P5-AC2) | ticket |
| `CivoraCatalogueStaleServices` | a published service last verified more than 90 days ago, for a day | ticket |

## 3. Runbook: an integrity failure

1. Read the monitor's log lines (`context: catalogue-integrity`): which service, which version, which reason.
2. Do **not** publish or rebuild the site: the generator refuses anyway, and the site online stays as it was.
3. Compare the version's rows with the last backup (Phase 2 runbook, point-in-time restore into a scratch cluster) and
   find who changed them (database audit). Restore the rows from the backup, or withdraw the version.
4. The alert clears at the next run once every version matches its approval again; record the incident.

`reason: signature` with a matching digest means the stored signature itself was changed: treat it as a compromise
of the database, and check the content key's ceremony record (Phase 4 doc 02).

## 4. Runbook: freshness (P5-AC2)

Editors re-verify each procedure against its official sources, then publish a new version with a new "last verified"
date; the median falls as they do. `CivoraCatalogueStaleServices` names no service: the editors' list of the oldest
ones is the catalogue's own data (`last_verified_on` in each page and in `GET /v1/services`).

## 5. Error reports, the editors' side (P5-F4)

- `GET /v1/admin/content-errors?status=open|accepted|rejected`: newest first, at most 200: the code, version, message,
  status, dates and the editor's note. Nothing in a report identifies the reader.
- `POST /v1/admin/content-errors/{id}:accept` or `:reject`, with an optional note (3 to 1000 characters); once only
  (a decided report answers 409), with who and when.
- For the cell operator's editors only (role `catalogue-editor`, the operator's institution: P5-SEC1). The application
  role still cannot read the table; two definer functions are its only way in (public migration `1765324800000`).
- A report must now name a version that was published (published or superseded); any number was accepted before.

## 6. Results (28 Nov 2026)

| Test | Result |
|---|---|
| Monitor on a stand-in repository: content as approved passes; changed content (`digest`), a missing version, a signature by another key fail; one log line per failure without content; median and stale count; gauges; without a key, digests still checked and no signature claimed | 3 of 3 pass |
| Database: a report on a version never published refused; list; decide once (409 the second time), only accepted or rejected, an unknown report | pass |
| End to end (SoftHSM): reports listed and decided by the operator's editor only (citizen, other institution, no token refused), note length, 409, 404; the monitor verifies both signed versions in the HSM key, finds the fee changed directly in the database (`digest`), `/metrics` shows it, and clears once restored | pass (catalogue 21 of 21; core 185+ of all) |
| promtool: integrity failure pages at once and two replicas give one alert; the monitor not running after 3 h; freshness after an hour at ≥ 90 days; stale services after a day | pass |
