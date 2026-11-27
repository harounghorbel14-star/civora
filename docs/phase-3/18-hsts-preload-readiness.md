# 18 — HSTS preload: ready, waiting for the production domain (gap G5)

| | |
|---|---|
| Specification items | P3-SEC1 (ASVS 5.0 L3), gap **G5** of [doc 11](11-security-verification.md) |
| ASVS 5.0 | V3.7.4 — the application's top-level domain is on the browsers' HSTS preload list |
| Founder decision (27 Nov 2026) | **Use a placeholder**: everything is prepared and tested with the placeholder domain `civora-cell.invalid`; G5 stays open until the production domain is chosen and listed |
| Status | Prepared and tested on 27 Nov 2026 (§4); **G5 open** |

## 1. Why it cannot be closed yet

Being on the preload list means every browser uses HTTPS for the domain and **all** its subdomains before any request is
made. Only the domain's owner can submit it (hstspreload.org), and only a real, registered domain can be checked by the
list. The production domain is a founder decision not yet taken; the repository uses `civora-cell.invalid` (a reserved
name that can never be registered or submitted). Removal from the list takes months, so the domain must be one that
will serve HTTPS on every subdomain for good.

## 2. What is ready

| Part | State |
|---|---|
| Citizen web app (`apps/web/proxy.ts`) | sends `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` on every https response (unchanged; V3.4.1) |
| Edge gateway (ADR-030; `infra/tests/api-gateway/routes.yaml`, from which the production ApisixGlobalRule is generated) | **now** the same header on every response (it had one year and no `preload`); the gateway test checks the exact value |
| Checker (`infra/scripts/check-hsts-preload.py`, standard library only) | checks a domain against the list's four requirements: a valid certificate; HTTP redirected to HTTPS on the same host first; every named subdomain over HTTPS with a valid certificate; on the base domain, the header with max-age at least one year, `includeSubDomains` and `preload`, also on an HTTPS redirect. It runs against the real domain (port 443/80, public DNS) or a test server (`--connect`, ports) |
| Test (`infra/tests/hsts-preload/run.sh`) | the checker against local test servers for the placeholder domain, with a throw-away test CA: 2 good configurations and 9 negative controls, each of which must fail for its own reason; and the web app's header |

## 3. Steps once the domain is chosen (owner: founder; then operations)

1. Set the domain (deployment settings: web app `APP_ORIGIN`, Keycloak hostname, gateway hosts, certificates).
2. Serve HTTPS on the apex and **every** subdomain in use (www, app, auth, api, workspace, …), with HTTP redirecting to
   HTTPS on the same host first.
3. Run `python3 infra/scripts/check-hsts-preload.py --domain <domain> --subdomain www --subdomain app …` from outside
   the cell: every line `ok`.
4. The domain's owner submits it at hstspreload.org (a human step; it cannot be done from the repository).
5. When the domain appears in Chromium's list (`transport_security_state_static.json`), V3.7.4 is met and G5 closes.
   This is a pilot-gate item (PG-8).

## 4. Tests and results (27 Nov 2026)

| Level | What | Result |
|---|---|---|
| `infra/tests/hsts-preload/run.sh` | good: two-year header with sub-domains and preload, HTTP redirected to the same host, www and app on HTTPS; an HTTPS redirect carrying the header; negative: no header, `preload` missing, `includeSubDomains` missing, max-age of one day, an HTTPS redirect without the header, HTTP serving the page, HTTP redirecting to another host first, a certificate from an untrusted CA, a subdomain whose certificate does not name it; the web app's header | **all passed** (2 good, 9 negative controls, 1 header check) |
| Gateway test (`infra/tests/api-gateway/run.sh`, nightly) | the exact header on gateway responses | runs in the nightly workflow |
