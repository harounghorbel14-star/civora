# apps/web — CIVORA citizen web app

| | |
|---|---|
| Built from | **Phase 3** (accounts: sign-in, preferences, security, identity, mandates, status page); **Phase 5** adds the Government Services Directory |
| Stack (D7) | Next.js 16 (App Router) + React 19, TypeScript; `@civora/i18n`; Arabic default, right to left |
| Design | [Phase 3 doc 09](../../docs/phase-3/09-citizen-web-app.md) |

## How it works

A **backend-for-frontend**: the browser holds only an opaque session cookie (`HttpOnly`, `SameSite=Strict`, `Secure`);
the server signs in with Keycloak, keeps the tokens and calls `civora-core` with them. Mutations are server actions
(POST, origin checked). Every page gets a strict Content Security Policy with a nonce (`proxy.ts`).

At ASVS 5.0 L3 ([Phase 3 doc 14](../../docs/phase-3/14-sender-constrained-tokens.md)) the server is a **confidential
client**: it authenticates to Keycloak with a signed assertion (`private_key_jwt`, ES256), pushes every authorization
request first (PAR; the browser only carries `client_id` and `request_uri`), uses code + PKCE, and its access tokens are
**DPoP-bound** to a key made for each session: every call to the core carries `Authorization: DPoP <token>` and a fresh
proof for that method and URL. A token copied out of the server is useless without the session's key.

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
  OIDC_CLIENT_KEY_FILE=/run/secrets/civora-web.pem CORE_URL=http://127.0.0.1:3000 pnpm --filter @civora/web start -- -p 3100
```

`APP_ORIGIN/auth/callback` must be a redirect URI of the realm's `civora-web` client, and the client must hold the
public half of the key (`infra/keycloak/apply-realm-policy.py --web-client-jwks FILE`). Settings:

| Variable | |
|---|---|
| `OIDC_CLIENT_KEY_FILE` | **Required.** The client's private key (P-256, PKCS#8 PEM), mounted from the cell's secret store; never in Git |
| `OIDC_CLIENT_KEY_ID` | `kid` of that key in the client's key set (default `civora-web-1`); a new `kid` per rotation |
| `OIDC_INTERNAL_URL` | Keycloak inside the cell |
| `OIDC_CLIENT_ID` | Default `civora-web` |
| `SESSION_IDLE_SECONDS`, `SESSION_MAX_SECONDS` | Defaults 1800 and 28800 |
| `SERVER_ACTION_ORIGINS`, `CSP_FORM_ACTION_EXTRA` | Behind a reverse proxy |

The core must be told the URLs it is reached under (`CORE_PUBLIC_URLS`) so it can check the proofs' `htu`.

Sessions live in the process memory: **one replica only** until the shared store of pilot gate PG-7.

## Tests

`pnpm --filter @civora/web test` (unit). End to end in three languages: `infra/tests/keycloak-realms/run.sh`
(part `web`), also in the nightly run.
