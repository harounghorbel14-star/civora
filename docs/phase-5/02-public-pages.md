# 02 — Public pages: static generation from signed content

| | |
|---|---|
| Specification items | P5-D3 public catalogue pages (SEO), P5-A2 static generation for public pages, P5-F1 service pages, P5-F2 office locator (the page; the editors' office API), P5-F3 change history (the pages), P5-SEC3 integrity (checked at every build), P5-T2 link checking (internal links), P5-T3 accessibility (structure) |
| Built | 27 Nov 2026 (week 3, first part) |
| Code | `apps/directory/` (`@civora/directory`: loader and checks `content.ts`, pages `pages.tsx`, site `site.ts`, command `cli.ts`); in the core, `POST /v1/admin/offices` and the office's source on `GET /v1/offices` |
| Tests | `apps/directory/src/site.test.ts` (11: fixtures signed with a software key); `services/core/src/modules/catalogue/catalogue.e2e.test.ts` (2 more: the office API, and the site built from the running core with its SoftHSM signatures) |
| Not yet | serving the site in a cell (the gateway routes `/<lang>/services/` and `/<lang>/offices/` to it) and rebuilding it when an approver publishes; the search page and the "report an error" form (both need a server: the web app, next); external link checking and an automated accessibility audit in a browser (week 4) |

## 1. Why a generator, and not pages in the web app

The citizen web app renders every page on request: its Content Security Policy carries a fresh nonce for each
response (Phase 3 doc 12), which a page built in advance cannot carry. The directory pages are public, the same for
everyone, and change only when an approver publishes. They are therefore generated once as plain HTML files by a small
program that renders React components to static markup (`react-dom/server`, the React version the web app already
uses; no new dependency). The pages carry **no JavaScript**: the policy can be `script-src 'none'`, and a page works the
same with scripts off, on a slow line or in a text browser.

## 2. What a page states, and where it comes from

1. For each published service, the generator reads every published and superseded version's **signed bytes**
   (`GET /v1/services/{code}/versions/{v}/content`) and checks the detached signature with the cell's content key
   (`GET /v1/catalogue/keys`, by `kid`).
2. The page is rendered **from those signed bytes**: title, summary, institution, online service, processing time, the
   steps, documents, conditions and fees (with their amounts), the cited source ids, the office codes, the last-verified
   date and the change note.
3. Only what the signed content cites by reference comes from elsewhere: each source's title, publisher, address, JORT
   reference and reading date (`GET /v1/services/{code}/versions/{v}`), and each office (`GET /v1/offices`).
4. If any version's signature does not verify, its signed content cannot be rendered faithfully, a cited source or
   office is missing, a source is not https, or services are published without a content key, **the run stops and
   writes nothing**; the site already online stays as it was. The command exits 2 and names the service.

Each page shows the SHA-256 digest of the signed bytes and the key id, so anyone can check it against the public API.

## 3. Pages

| Path | Page |
|---|---|
| `/<lang>/services/` | all services by category, with summary and last-verified date |
| `/<lang>/services/<slug>/` | a service (P5-F1): steps (numbered, in order), documents, conditions, fees in TND, where to go (offices with address and hours), numbered sources (official page or legal text with its JORT reference, date read), last verified, version and publication date, translation-review notice, integrity |
| `/<lang>/services/<slug>/history/` | every published version, newest first, with its change note (P5-F3) |
| `/<lang>/services/<slug>/v/<n>/` | an earlier version as it was signed, marked as no longer in force, not indexed, canonical to the current page |
| `/<lang>/offices/` | offices by governorate with address, hours, an OpenStreetMap link (an ordinary link: no map tiles or third-party requests on the page) and the source that lists them (P5-F2) |
| `/sitemap.xml`, `/robots.txt` | indexable pages with their language alternates and last modification |
| `/assets/directory.css` | the one stylesheet (the design tokens of the web app) |

`<lang>` is `ar` (Arabic, right to left), `fr` or `en`. The paths keep `/<lang>/services/<slug>` that the wallet's
renewal links use (Phase 4 doc 06).

## 4. Languages

Arabic and French are required for every procedure; English is optional. An English page of a procedure without its own
English text shows the French text, says so, marks that text as French (`lang="fr-TN"`, WCAG 3.1.2), and is **not
indexed** nor offered to search engines as an alternate; readers can still switch to it. While a version's translation
review is `pending` (P5-T4, needs native legal-language editors, Q5-1), every page of it says that the translation has
not been reviewed and that the official source prevails. French titles, JORT numbers and digests inside Arabic
sentences are isolated (`<bdi>`), so they keep their order.

## 5. Search engines and assistive technology

- One `<h1>` per page, no skipped heading level, header/navigation/main/footer landmarks, a skip link, labelled
  navigation, breadcrumbs, unique ids; citation links have an accessible name ("Source 2") that contains their
  visible number. Checked on every generated page by the tests.
- Logical CSS properties only (one stylesheet for both directions), visible focus, `prefers-reduced-motion` and
  `prefers-contrast` honoured, a print style. Screenshots of Arabic on a 390 px phone and French on a desktop were
  checked by eye on 27 Nov 2026: no horizontal scrolling, no CSP violation in Chromium.
- `canonical`, `hreflang` alternates (`x-default`: Arabic), a `GovernmentService` schema.org block (a data block: it
  cannot close its element, whatever the content), meta description, sitemap.

## 6. Serving

The command writes into a **new** directory and refuses a non-empty one, so a run never edits the site being served:

```
civora-directory --core http://civora-core:3000 --origin https://www.civora-cell.invalid --out /srv/directory/<build id>
```

Next to the pages it writes `_manifest.json` (each file with its SHA-256) and `_headers.json`, the response headers the
static server sends with every file:
`Content-Security-Policy: default-src 'none'; style-src 'self'; img-src 'self'; script-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'`,
`X-Content-Type-Options: nosniff`, a referrer policy, `Cross-Origin-Opener-Policy`, `Cross-Origin-Resource-Policy` and a
permissions policy; HSTS comes from the gateway as for every response (Phase 3 doc 18). The origin is the placeholder
domain until the cell's domain is chosen (G5). Not yet built: the gateway route, and the rebuild triggered by publication.

## 7. Found and fixed on the way

- **Dates one day early in a Tunisian cell.** node-postgres parses an SQL `date` as local midnight; in a process
  running in Africa/Tunis (UTC+1) that is 23:00 the day before in UTC, and every "last verified" and "read on" date
  would have been shown a day early (and P5-AC2 counted from the wrong day). The catalogue's pool now returns dates as
  they are stored (`YYYY-MM-DD`); the end-to-end test runs in Africa/Tunis and fails without the fix.
- **Offices could not be registered through the API** (the database function existed, no route called it), and the
  office list did not say which source lists each office. `POST /v1/admin/offices` (editor of the cell operator) and
  the source on `GET /v1/offices`.

## 8. Results (27 Nov 2026)

| Test | Result |
|---|---|
| Generator, on fixtures signed with a software key: every page in three languages; steps in order, fees in TND, sources numbered by first citation with JORT reference, last verified, the digest of the signed bytes; Arabic right to left; English fallback marked French and not indexed; no script except data blocks, no inline style or handler, https only; markup in the content stays text in the page and in the schema.org block; headings, landmarks, skip link, labelled navigation, unique ids; every internal link and fragment resolves; history newest first, earlier versions marked and canonical to the current one; sitemap and robots; the same input gives the same bytes; offices by governorate; refused, with nothing written: altered content, another key, a missing source or office, no key, content of another version, an http source | 11 of 11 pass |
| End to end (the application, PostgreSQL as the least-privilege role, SoftHSM): offices registered by the operator's editor only, outside Tunisia refused, listed with their source and the exact date in Africa/Tunis; the site built from the running core verifies the HSM signatures of both versions and shows the API's digest | 2 of 2 pass (with the 4 earlier ones) |
| Chromium, the generated pages served with the CSP above: Arabic phone, French desktop, offices, English fallback | no CSP violation, no horizontal overflow |
