# 03 — Search and "report an error": the two directory pages that need a server

| | |
|---|---|
| Specification items | P5-D4 search (the page), P5-F4 "report an error" (the form) |
| Built | 27 Nov 2026 (week 3, second part) |
| Code | `apps/web/app/[lang]/services/search/page.tsx`, `apps/web/app/[lang]/services/report/` (page, form, server action), `apps/web/lib/directory.ts` (checks), `apps/web/lib/core.ts` (`publicCoreGet`); the static pages link to both ([02](02-public-pages.md)) |
| Tests | `apps/web/lib/directory.test.ts` (6); a browser run against the built web app and a stand-in core: 23 checks with scripts on and off (§4); the nightly web test checks the status page with scripts off |
| Not yet | the editors' list and handling of the reports (back office); serving under one origin with the static pages (the gateway routes, with the rest of the cell) |

## 1. Why these two are in the web app

The directory's pages are static files with no script ([02](02-public-pages.md)). Search and the error report each need
a server: the first asks the core (`GET /v1/services?q=`, Arabic and French normalised), the second forwards a
message (`POST /v1/feedback/content-errors`). Both live in the citizen web app, which already calls the core and
already has a Content Security Policy with a nonce per page. Under one origin, the gateway sends
`/<lang>/services/search` and `/<lang>/services/report` to the web app and the rest of `/<lang>/services/` to the
static files. Each static page has a search box (a plain GET form, which the pages' `form-action 'self'` allows), and
each current service page links its report form with the service code, version and slug.

## 2. Search (P5-D4)

- A plain GET form, so the page works without scripts; results in the page's language (English falls back to French,
  marked as French), each linking to the static page `/<lang>/services/<slug>/` and showing the last-verified date.
- The query is one value of 2 to 200 characters (a repeated key, an array, is refused). The query is shown back as text
  only. A result whose code or slug does not match the catalogue's patterns is dropped, so it never becomes a link.
- The core unreachable or answering anything but 200: "not available right now". No credentials are sent (public call).

## 3. Report an error (P5-F4)

- Anonymous. The form asks for the message only (5 to 2000 characters) and says not to write a name or contact; the
  web app sends the core the service code, the version and the message, nothing else (checked, §4).
- The version comes from the static page's link; a malformed code or version answers 404. Answers shown: sent; not
  published (404 from the core); too many reports (429, the gateway's limit); not available. The message stays in the
  form when it could not be sent.
- Requests from another site other than plain links are refused by the web app (Phase 3 doc 11, `Sec-Fetch-*`), and
  Next checks the origin of every server action.

## 4. Found and fixed on the way: no form worked without scripts

With scripts off, a form in the web app is a plain POST to its server action. The app sent `Referrer-Policy:
no-referrer`, and with that policy a browser sends `Origin: null` on such a post; Next's check of the origin (against
cross-site request forgery) then refused the action with a 500. So the customer status page (Phase 3) and the new
report form worked only with scripts. The policy is now **`same-origin`**: a URL (with its codes and states during
sign-in) is still never sent to another site, and a post to this site carries its origin. The nightly web test checks
the header and the status page with scripts off (Phase 3 doc 09).

Also: the app's own "not found" page (translated, no inline style). Next's default one carries inline styles, which the
Content Security Policy refuses.

**Known, not fixed**: a "not found" answer from a page of the web app is rendered by Next as an error shell completed
by script, so without scripts it is blank (status 404 all the same). And an address that matches no page at all gets
Next's not-found page built in advance, without the page nonce, whose scripts and styles the policy refuses (reported
to `/csp-report`). Both predate Phase 5; the directory's own pages are static and not affected.

## 5. Results (27 Nov 2026)

| Test | Result |
|---|---|
| Unit (`lib/directory.test.ts`): the query's length and single value; hits with a slug like `../admin` or `javascript:` dropped; the English fallback; the report's code, version and length; the public GET sends no credentials, with the correlation id; the new texts in three languages with the same placeholders | 6 of 6 pass (web 34 of 34) |
| Chromium, the built web app (`next start`) against a stand-in core, scripts **on and off**: search gives the one well-formed result; Arabic page right to left with the query as text; markup in a query shown as text; a one-character query refused; the core down said so; the report page names the version; a report sent; an unpublished version said so and the message kept; a malformed code 404; the core received only code, version and message; no CSP violation on these pages | 23 of 23 |
| The status page with scripts off (Phase 3), same run | the form post answers 200 (500 before the fix) |
