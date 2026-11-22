# 10 — Mobile app shell and Detox plan (Phase 3, week 4; question Q3-3)

| | |
|---|---|
| Specification items | P3-T2 "auth flow E2E (Playwright, **Detox**)"; question Q3-3 (`apps/mobile` is a placeholder; Detox needs a mobile app) |
| Decision applied | D7 stack: React Native + TypeScript for `apps/mobile`; `@civora/i18n` for locale and right-to-left |
| Status | **Plan and decisions recorded; the native project is not built yet.** Reason below. The web app covers every Phase 3 flow end to end in three languages ([doc 09](09-citizen-web-app.md)) |

## 1. Why the mobile shell is not in this week's code

- **Detox needs an Android emulator or an iOS simulator.** This build environment has neither (no Android SDK, no
  hardware virtualisation, no macOS). A React Native project that cannot be built or run here could not be tested,
  and untested code would only look like progress.
- **React Native brings a large dependency tree into the monorepo.** CI fails on any high or critical advisory in
  production dependencies (`pnpm audit --prod --audit-level high`), and every pin must be a release at least two weeks
  old and verified (ADR-027). Adding it belongs with the CI job that builds and tests it, not before.
- So the shell is built together with its emulator job (§4). Nothing in Phase 3's acceptance depends on mobile
  screens: P3-AC1 asks that all authentication flows pass end to end in Arabic, French and English, and they do in
  the web app (doc 09). P3-T2's Detox half stays open in the progress table until §4 runs.

## 2. Decisions for the mobile app (binding when it is built)

| Topic | Decision | Why |
|---|---|---|
| Sign-in | OAuth 2.0 for native apps (RFC 8252): the **system browser** (Custom Tabs on Android, `ASWebAuthenticationSession` on iOS), authorization code + PKCE S256, never an embedded web view | The person signs in on Keycloak's own pages (passkeys, TOTP, the same protections as the web); the app never sees the password |
| Redirect | A **claimed https** redirect (Android App Links, iOS Universal Links) on the cell's app domain, not a custom scheme | A custom scheme can be claimed by another app (RFC 8252 §8.1) |
| Client | A separate public client `civora-mobile` in the citizens realm: PKCE S256, no password grant, first-party kind, the `civora-core` audience | The realm checker already enforces these rules for public clients |
| Tokens | Access token in memory; refresh token in the platform's secure storage (Keystore / Keychain, hardware-backed where available), rotated on every use (the realm refuses reuse) | No token in plain storage, logs or crash reports |
| Step-up | The same RFC 9470 answer from the core (`401 insufficient_user_authentication`): the app reopens the system browser with `prompt=login` | One rule for web and mobile (doc 04) |
| Languages | `@civora/i18n`: Arabic default, right to left through `I18nManager.forceRTL`; a direction change asks for a restart (a React Native limit) | Same catalogues and rules as the web app |
| Accessibility | Preferences from `GET /v1/me` (text size, contrast, reduced motion) mapped to platform settings; screen-reader labels on every control | P3-F4 |
| Device binding | Optional later: Keycloak's device-bound refresh tokens (DPoP) once its support is stable | Stolen refresh tokens become useless off the device |

## 3. Detox: what it tests, and what it cannot

| Layer | Tool | Covers |
|---|---|---|
| In-app screens (preferences, security, identity, mandates, acting on behalf, status page) | **Detox** on an emulator/simulator | Taps, navigation, right to left in Arabic, notices, error states, the acting banner |
| Sign-in on Keycloak's pages in the system browser | Not Detox: it cannot drive Custom Tabs or `ASWebAuthenticationSession` | Covered by the web E2E on the same Keycloak pages (doc 09, doc 03), and on devices by a UI Automator / XCUITest step around the browser |
| Getting a test session into Detox runs | A **debug-build-only** sign-in hook that completes the system-browser step with a test account, compiled out of release builds (a build check fails if it is present) | Detox runs stay end to end through Keycloak without an embedded web view in the product |

Journeys, in Arabic, French and English: sign-in, preferences applied, sessions (end another device), passkey added,
removal needing a recent sign-in, mandate given and accepted, acting on behalf with its banner, status page with a
one-time code, sign-out (the refresh token is revoked).

## 4. When and where it runs

| Step | Where | Done when |
|---|---|---|
| React Native project in `apps/mobile` with pinned, audited dependencies; the `civora-mobile` client in the citizens realm | Repository | Type check and unit tests in CI; the realm checker accepts the client |
| Android build and Detox journeys | Nightly job on a Linux runner with an Android emulator (hardware virtualisation) | All journeys pass in three languages |
| iOS build and Detox journeys | Weekly job on a macOS runner | All journeys pass in three languages |
| Release-build check | CI | The debug sign-in hook is absent from release builds |

Owner: engineering. This plan answers Q3-3 on the engineering side; the timing of the mobile work against Phase 4
(wallet) is a scheduling choice for the founder, recorded in the progress page.
