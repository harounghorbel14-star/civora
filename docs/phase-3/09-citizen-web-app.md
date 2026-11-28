# 09 — Citizen web app, acting on behalf of, customer status page (Phase 3, week 4)

| | |
|---|---|
| Specification items | P3-T2 auth flow E2E (Playwright half) and P3-AC1 (all auth flows E2E in AR/FR/EN) · P3-F6 "acting on behalf of" UI · P3-R2 customer OTP access to the status page · P3-A2 OIDC to apps · P3-F3/F4 preferences applied in screens |
| Decisions applied | D7 (Next.js + React, TypeScript, `@civora/i18n`), Phase 2 doc 06 §6.5 (tokens held by a backend-for-frontend, HttpOnly SameSite=Strict cookie, CSRF protection, step-up), ADR-014 (Arabic default, right to left), ADR-028 (simulated adapters) |
| Pins | Next.js 16.4.5 (3 Nov 2026), React and React DOM 19.3.1 (14 Oct 2026), `@types/react` / `@types/react-dom` 19.3.0 (9 Sep 2026): all at least two weeks old, versions read from the npm registry; `pnpm audit --prod --audit-level high`: no finding |
| Status | Built and tested end to end on 22 Nov 2026 (results §5); GitHub results in [01 — Progress](01-progress.md) |

## 1. The web app (`apps/web`)

| Part | What it does |
|---|---|
| Backend-for-frontend | The browser never holds a token. Sign-in is an authorization code with PKCE S256, state and nonce, all kept on the server; the server exchanges the code, verifies the ID token (realm keys, issuer, audience, nonce) and keeps the tokens in its session store. The browser gets an opaque 256-bit session id |
| Session cookie | `HttpOnly`, `SameSite=Strict`, `Secure`, path `/`, no lifetime (ends with the browser); `__Host-` prefix on https. Idle 30 min, absolute 8 h, and never beyond the refresh token. **A new session id at every sign-in** (re-authentication too): no session fixation |
| After another site | Coming back from Keycloak or the eID (another site), a tiny page continues on this site, so the next request is started here and carries the Strict cookie |
| Calls to the core | Server-side, with the session's access token, refreshed shortly before it expires (rotation; a refused refresh ends the session). `401 insufficient_user_authentication` becomes "confirm it is you" (re-authentication with `prompt=login`, then repeat); any other `401` signs out |
| Mutations | Next.js server actions only: POST, the Origin must match the host (otherwise refused), the Strict cookie. Every result is a redirect with a notice from an allow-list (no text from the URL); the page, header and banner are re-rendered |
| Sign-out | Ends the Keycloak session from the server (refresh token revoked), removes the session, deletes the cookie |
| Headers | Content Security Policy with a fresh nonce per page: scripts only with the nonce (`strict-dynamic`), no inline script or style, no framing, `base-uri 'none'`, forms only to this site and Keycloak; `Referrer-Policy: same-origin` (codes and states travel in URLs during sign-in: never sent to another site; `no-referrer` until 27 Nov 2026, which broke forms without scripts, Phase 5 doc 03 §4); `nosniff`, `X-Frame-Options: DENY`, `Cross-Origin-Opener-Policy`, `Permissions-Policy`. Week 5 ([doc 11](11-security-verification.md)): HSTS on https; CSP violations reported to `/csp-report` (origins only); requests from another site other than plain links refused (`Sec-Fetch-*`) |
| Languages | `/ar`, `/fr`, `/en`; `/` goes to the visitor's language (Accept-Language, Arabic by default). `lang` and `dir` on the page (Arabic right to left; CSS with logical properties only). All text from three catalogues with the same keys and placeholders (unit test) |
| Preferences (P3-F3, F4) | Language and accessibility saved through the core and applied to the page: text size, high contrast, reduced motion (data attributes read by the stylesheet), simplified language, screen-reader hints |
| Security page | Sessions (this device marked; end any of them), ways to sign in (never the password): add a passkey or an authenticator app through Keycloak's own pages; remove, with "confirm it is you" when the sign-in is old, and the core's refusal to remove the last way to sign in |
| Identity page | Says plainly that the eID is **simulated**; links it through the simulator ([doc 06](06-simulated-eid-identity-links.md)); the attempt id stays in the server session |
| Mandates page | Give a mandate (scopes, end date): its number and one-time code are shown **once** from the server session, never in a URL; accept with number and code; end; each mandate's history |
| Sessions in memory | One replica only for now; a shared store (Valkey) is **pilot gate PG-7** ([doc 08](08-pilot-gate.md)). Pending sign-ins are bounded (10,000, oldest first) and expired sessions swept (week 5) |

## 2. Acting on behalf of (P3-F6)

- `POST /v1/mandates/{id}:act` (core): only the **agent** of an **active, unexpired** mandate; anyone else, or after
  revocation or expiry: `404`. The action is recorded as a mandate event (`acted`), visible to the principal and the
  agent in the mandate's history (P3-AC3). New migration `iam-mandate-acted`.
- The web app keeps the acting context in the server session and shows a banner on every page: who the agent acts for
  (mandate number), what they may do (scopes in the person's language), until when; "stop acting" ends it. Ending the
  mandate also ends the context.
- Enforcement of mandate scopes on domain endpoints arrives with those endpoints (cases, payments: later phases); the
  core checks the mandate again on every use.

## 3. Customer access to the status page (P3-R2)

| Part | What it does |
|---|---|
| `POST /v1/status-access` (public) | Case reference → `202` with a challenge id, **the same answer whether or not the reference exists**. A 6-digit code goes to the **contact on file** only, in the background (the answer time does not tell), at most 3 codes per reference in 15 minutes. Malformed reference: `400` (format only) |
| `POST /v1/status-access/{id}:verify` (public) | Reference + code → the status (reference, institution, status, since); `404` for anything else, never saying why. A code works once, for 10 minutes, with 5 tries; it is bound to its challenge and reference |
| Storage | `iam.status_challenge`: digests only (reference, code bound to the challenge); functions only, no grant on the table (migration `iam-status-access`) |
| Case data | Phase 3 has no case engine (Phase 6): the cases module offers a **synthetic** case directory, generated by `@civora/synthetic-data`, in dev and test only (`SYNTHETIC_CASES=on`); elsewhere the page answers `503` |
| Delivery | New port `MessagingChannel`, adapter `simulated-smtp` (register entry M-02 e-mail, class 3: simulated only): plain SMTP to the cell's mail catcher, synthetic `*.invalid` addresses only, dev and test only, one integration-log line per message without address or code. SMS waits on Q3-1 (PG-6), a real e-mail relay on Q3-6 (PG-4) |
| Gateway | New public route `status-access`, 20 requests per 10 minutes per client address (the generic API route would demand a token) |
| Web page `/[lang]/status` | No account. Two steps in one page; the reference and the result stay in the page (never in a URL); texts and the date in the visitor's language |

## 4. Design notes

- **Why a backend-for-frontend.** Tokens in the browser can be read by any script that runs there; with the BFF an
  injected script cannot steal a token, and the session dies with the cookie (Phase 2 doc 06 §6.5).
- **Why server actions.** They give CSRF protection by origin check and SameSite cookies without a separate token
  scheme, and the pages work as plain forms.
- **Why one-time values never go in URLs.** URLs end up in history, logs and `Referer` headers; mandate codes, status
  results and the eID attempt stay on the server or in the page.

## 5. Test evidence (22 Nov 2026)

`infra/tests/keycloak-realms/web.cjs`, run by `run.sh`: the web app (`next start`) against Keycloak 26.8.1 (citizens
realm and the eID simulator), the core as `civora_core_app`, the mail catcher, Chromium with virtual authenticators.
**38 web app checks, all passed**; the whole realms run (realm journeys, security, account, organisation, SSO, web
app, eID): **199 checks, all passed** (622 s). Gateway 19/19 (new: the status page is public but limited per client);
dev cell from scratch 17/17 (new: the status page answers for a synthetic case).

Found on the way: server actions must re-render the layout, or the language, accessibility and acting banner kept
their old values after an action (fixed: every action revalidates the layout); after a passkey is added, Keycloak's
re-authentication asks for the passkey, not the password (the test follows whatever Keycloak asks); the eID test's
callback capture moved to request events, because the eID now returns to the web app's address.

| # | Check | Result |
|---|---|---|
| 1–7 | In **each** of Arabic, French and English: sign-in through the web app (Keycloak's page in that language), page `lang`/`dir` and navigation translated; preferences saved through the core and applied (large text, high contrast); security page (this device marked, authenticator app listed, never the password); status page: an unknown and a real reference get the same answer, the code reaches the contact on file only, a wrong code is refused, the right one shows the status in that language; sign-out ends the Keycloak session and the security page then asks to sign in | ok |
| 8 | Add a passkey through Keycloak's registration; back on the security page, listed | ok |
| 9 | Remove with an old sign-in: "confirm it is you"; re-authentication at Keycloak returns to the page; the removal then works; **a new session id** was issued | ok |
| 10 | Session cookie attributes; no token in the web app's cookies, storage or page | ok |
| 11 | Content Security Policy (nonce, `strict-dynamic`, no inline, no framing) and the referrer only to this site (`same-origin`) | ok |
| 12 | A server action posted from another origin (CSRF) is refused and the session survives | ok |
| 13 | Mandate given (code shown once, not in the URL, gone after reload), accepted by the agent, acting on behalf with the banner in French, `acted` in the principal's history, stop acting, no acting after revocation | ok |
| 14 | Identity link through the web app: the page says simulated, the simulator in Arabic, back linked (level substantial) | ok |

Unit and database tests: web BFF 22 (configuration, cookies, redirects, sessions, OIDC, calls to the core, catalogues,
notices); core: acting on behalf (agent only, principal and others refused, history, revocation), status page service
(same answer, contact only, single use, bound to reference, 3 codes, no personal data in logs) and its database
functions as the application role.
