# apps/web — CIVORA citizen web app

| | |
|---|---|
| Built from | **Phase 3** (accounts: sign-in, preferences, security, identity, mandates, status page); **Phase 5** adds the Government Services Directory |
| Stack (D7) | Next.js 16 (App Router) + React 19, TypeScript; `@civora/i18n`; Arabic default, right to left |
| Design | [Phase 3 doc 09](../../docs/phase-3/09-citizen-web-app.md) |

## How it works

A **backend-for-frontend**: the browser holds only an opaque session cookie (`HttpOnly`, `SameSite=Strict`, `Secure`);
the server signs in with Keycloak (code + PKCE), keeps the tokens and calls `civora-core` with them. Mutations are
server actions (POST, origin checked). Every page gets a strict Content Security Policy with a nonce (`proxy.ts`).

| Path | |
|---|---|
| `lib/` | Framework-independent parts, unit tested: configuration, cookies, sessions, OIDC, calls to the core, languages, messages, notices |
| `server/` | Server-only helpers (current session, calls to the core, the page that continues after another site) |
| `app/auth/*` | Sign-in, callback (new session id every time) |
| `app/identity/eid/*` | Return from the (simulated) eID |
| `app/[lang]/*` | Pages and server actions, in `ar`, `fr`, `en` |

## Run it

```sh
pnpm --filter @civora/web build
CIVORA_ENV=dev APP_ORIGIN=http://localhost:3100 OIDC_ISSUER=http://localhost:8080/realms/civora-citizens \
  CORE_URL=http://127.0.0.1:3000 pnpm --filter @civora/web start -- -p 3100
```

`APP_ORIGIN/auth/callback` must be a redirect URI of the realm's `civora-web` client. Settings: `OIDC_INTERNAL_URL`
(Keycloak inside the cell), `OIDC_CLIENT_ID`, `SESSION_IDLE_SECONDS` (default 1800), `SESSION_MAX_SECONDS` (28800),
`SERVER_ACTION_ORIGINS` (behind a reverse proxy), `CSP_FORM_ACTION_EXTRA`.

Sessions live in the process memory: **one replica only** until the shared store of pilot gate PG-7.

## Tests

`pnpm --filter @civora/web test` (unit). End to end in three languages: `infra/tests/keycloak-realms/run.sh`
(part `web`), also in the nightly run.
