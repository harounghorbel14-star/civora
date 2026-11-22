'use strict';
/**
 * Phase 3 week 5 (P3-T3): negative tests against the real citizens realm, the core and the web app. Each check is an
 * attack that must fail: session fixation (Keycloak and the web app), code replay, PKCE downgrade and omission,
 * redirect manipulation, implicit flow, refresh-token reuse and use after sign-out, tokens for another audience or of
 * the wrong type, cross-population access, login CSRF, state forgery at the web callback, open redirect, framing,
 * cross-origin calls. Run by run.sh (KC_URL, CORE_URL, MAIL_URL, KC_ADMIN_PASSWORD, WEB_URL).
 */
const crypto = require('node:crypto');
const http = require('node:http');
const { chromium } = require('playwright');
const lib = require('./lib.cjs');
const { KC, WEB_CB, check, info, stamp, claims, sleep, freshTotp, activationMail, newContext, authorize, waitFor, codeFrom, exchange, core, visible, submit,
  activate, tag, form } = lib;

const WEB = process.env.WEB_URL;
const REALM = 'civora-citizens';
const TOKEN = `${KC}/realms/${REALM}/protocol/openid-connect/token`;
const post = (body) => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const b64url = (b) => Buffer.from(b).toString('base64url');

async function citizen(browser) {
  const email = `negative.${tag()}@example.invalid`;
  await core(undefined, '/v1/registrations', post({ email, locale: 'en' }));
  const x = await newContext(browser);
  const act = await activate(x.page, (await activationMail(email)).link);
  await x.context.close();
  return { email, password: act.password, secret: act.secret };
}

async function credentials(page, who) {
  const until = Date.now() + 20000;
  const done = new Set();
  while (Date.now() < until && page.url().startsWith(KC)) {
    if (!done.has('p') && await visible(page, '#password')) {
      if (await visible(page, '#username')) await page.locator('#username').fill(who.email);
      await page.locator('#password').fill(who.password); done.add('p'); await submit(page);
    } else if (!done.has('o') && await visible(page, '#otp')) {
      await page.locator('#otp').fill(await freshTotp(who.secret)); done.add('o'); await submit(page);
    } else await sleep(200);
  }
}

/** A code for civora-web (the redirect is captured, never exchanged here). */
async function codeFor(x, who, extra = {}) {
  const a = authorize(x.page, REALM, 'civora-web', WEB_CB, extra);
  const n = x.captured.length;
  await a.go();
  await credentials(x.page, who);
  return { code: await codeFrom(x.captured, n, 10000), verifier: a.verifier };
}

/** The web app's callback on the realm's first-party client (as web.cjs does; this part can run on its own). */
async function registerWebApp() {
  const c = (await lib.admin('GET', `${REALM}/clients?clientId=civora-web`))[0];
  await lib.admin('PUT', `${REALM}/clients/${c.id}`, { ...c, redirectUris: [...new Set([...c.redirectUris, `${WEB}/auth/callback`])] });
}

(async () => {
  await lib.refreshAdmin();
  await registerWebApp();
  const browser = await chromium.launch({ args: ['--no-proxy-server'] });
  try {
    const who = await citizen(browser);

    stamp('session fixation');
    const attacker = await newContext(browser);
    const atk = authorize(attacker.page, REALM, 'civora-web', WEB_CB);
    await atk.go();
    await waitFor(() => visible(attacker.page, '#password'), 8000);
    const planted = await attacker.context.cookies(KC);
    const victim = await newContext(browser);
    await victim.context.addCookies(planted);
    const v = await codeFor(victim, who);
    const vt = v.code ? (await exchange(REALM, 'civora-web', v.code, v.verifier, WEB_CB)).body : {};
    const n = attacker.captured.length;
    const probe = authorize(attacker.page, REALM, 'civora-web', WEB_CB, { prompt: 'none' });
    await probe.go();
    const back = await waitFor(() => attacker.captured.slice(n).find((u) => u.startsWith(WEB_CB)), 8000);
    check('N1 Keycloak: cookies planted before the victim signs in give the attacker nothing (prompt=none: login_required, no code)',
      !!vt.access_token && !!back && /error=login_required/.test(back) && !/[?&]code=/.test(back), back);
    const fixed = 'attacker-chosen-session-id-' + tag();
    const w = await newContext(browser);
    await w.context.addCookies([{ name: 'civora_session', value: fixed, url: WEB }]);
    await w.page.goto(`${WEB}/en`);
    await w.page.locator('[data-testid=sign-in]').first().click();
    await w.page.waitForURL((u) => u.href.startsWith(KC), { timeout: 10000 }).catch(() => undefined);
    await credentials(w.page, who);
    await waitFor(() => visible(w.page, '[data-testid=sign-out]'), 15000);
    const after = (await w.context.cookies(WEB)).find((c) => c.name === 'civora_session')?.value;
    const replay = await fetch(`${WEB}/en/security`, { headers: { cookie: `civora_session=${fixed}` }, redirect: 'manual' });
    check('N2 web app: a session id chosen by the attacker is replaced at sign-in and is not a session', after && after !== fixed && replay.status >= 300 && replay.status < 400 && /\/auth\/login/.test(replay.headers.get('location') ?? ''),
      `${after !== fixed} ${replay.status} ${replay.headers.get('location')}`);

    stamp('authorization code and PKCE');
    const x = await newContext(browser);
    let c = await codeFor(x, who);
    const first = await exchange(REALM, 'civora-web', c.code, c.verifier, WEB_CB);
    const again = await exchange(REALM, 'civora-web', c.code, c.verifier, WEB_CB);
    check('N3 a code works once: the second exchange is refused', first.status === 200 && again.status === 400, `${first.status} ${again.status} ${JSON.stringify(again.body)}`);
    const afterReplay = await form(`${KC}/realms/${REALM}/protocol/openid-connect/token`, { grant_type: 'refresh_token', client_id: 'civora-web', refresh_token: first.body.refresh_token ?? '' });
    check('N19 a replayed code also revokes what the first exchange issued (its refresh token is refused; ASVS V10.4.2)', afterReplay.status === 400, `${afterReplay.status} ${JSON.stringify(afterReplay.body)}`);
    c = await codeFor(x, who);
    const noVerifier = await form(TOKEN, { grant_type: 'authorization_code', client_id: 'civora-web', code: c.code, redirect_uri: WEB_CB });
    c = await codeFor(x, who);
    const wrongVerifier = await exchange(REALM, 'civora-web', c.code, b64url(crypto.randomBytes(32)), WEB_CB);
    check('N4 PKCE: the exchange without the verifier, or with another one, is refused', noVerifier.status === 400 && wrongVerifier.status === 400, `${noVerifier.status} ${wrongVerifier.status}`);
    let m = x.captured.length;
    const plain = authorize(x.page, REALM, 'civora-web', WEB_CB, { code_challenge_method: 'plain', code_challenge: b64url(crypto.randomBytes(32)) });
    await plain.go();
    let u = await waitFor(() => x.captured.slice(m).find((s) => s.startsWith(WEB_CB)), 8000);
    check('N5 PKCE downgrade to "plain" refused (no code)', !u || (!/[?&]code=/.test(u) && /error=/.test(u)), u);
    m = x.captured.length;
    await x.page.goto(`${KC}/realms/${REALM}/protocol/openid-connect/auth?${new URLSearchParams({ client_id: 'civora-web', redirect_uri: 'https://attacker.civora-cell.invalid/steal', response_type: 'code', scope: 'openid', state: 's', code_challenge: b64url(crypto.randomBytes(32)), code_challenge_method: 'S256' })}`).catch(() => undefined);
    await sleep(1000);
    check('N6 an unregistered redirect URI: Keycloak shows an error and never sends the browser there', !x.captured.slice(m).some((s) => s.includes('attacker.')) && /redirect_uri|Invalid parameter/i.test(await x.page.content()));
    c = await codeFor(x, who);
    const otherRedirect = await exchange(REALM, 'civora-web', c.code, c.verifier, 'https://app.civora-cell.invalid/other');
    check('N7 a code exchanged with a different redirect URI is refused', otherRedirect.status === 400, `${otherRedirect.status}`);
    // Implicit-flow answers travel in the URL fragment: read Keycloak's redirect without following it.
    const imp = await fetch(`${KC}/realms/${REALM}/protocol/openid-connect/auth?${new URLSearchParams({ client_id: 'civora-web', redirect_uri: WEB_CB, response_type: 'token', scope: 'openid', state: 's', nonce: 'n' })}`, { redirect: 'manual' });
    u = imp.headers.get('location') ?? '';
    check('N8 implicit flow (tokens in the URL) refused', !/access_token=/.test(u) && (/error=/.test(u) || imp.status === 400), `${imp.status} ${u.slice(0, 160)}`);

    stamp('refresh tokens and token types');
    c = await codeFor(x, who);
    const t1 = (await exchange(REALM, 'civora-web', c.code, c.verifier, WEB_CB)).body;
    const r2 = await form(TOKEN, { grant_type: 'refresh_token', client_id: 'civora-web', refresh_token: t1.refresh_token });
    const reuse = await form(TOKEN, { grant_type: 'refresh_token', client_id: 'civora-web', refresh_token: t1.refresh_token });
    check('N9 refresh tokens rotate; reusing the old one is refused', r2.status === 200 && r2.body.refresh_token !== t1.refresh_token && reuse.status === 400, `${r2.status} ${reuse.status}`);
    const r3 = await form(TOKEN, { grant_type: 'refresh_token', client_id: 'civora-web', refresh_token: r2.body.refresh_token });
    info(`after the reuse attempt, the newest refresh token ${r3.status === 200 ? 'still works (Keycloak refuses only the reused one)' : 'is refused too'}`);
    const latest = r3.status === 200 ? r3.body : r2.body;
    await form(`${KC}/realms/${REALM}/protocol/openid-connect/logout`, { client_id: 'civora-web', refresh_token: latest.refresh_token });
    const afterLogout = await form(TOKEN, { grant_type: 'refresh_token', client_id: 'civora-web', refresh_token: latest.refresh_token });
    check('N10 after sign-out the refresh token is refused (the session is gone)', afterLogout.status === 400, `${afterLogout.status}`);
    c = await codeFor(x, who);
    const t2 = (await exchange(REALM, 'civora-web', c.code, c.verifier, WEB_CB)).body;
    const withId = await core(t2.id_token, '/v1/me');
    check('N11 the ID token presented as an access token: 401', withId.status === 401, withId.raw);
    const forged = t2.access_token.split('.');
    const payload = { ...claims(t2.access_token), aud: 'civora-core', azp: 'another-client', sub: crypto.randomUUID() };
    const tampered = `${forged[0]}.${b64url(JSON.stringify(payload))}.${forged[2]}`;
    check('N12 an access token with changed claims (signature no longer matches): 401', (await core(tampered, '/v1/me')).status === 401);
    const asCitizen = await core(t2.access_token, '/v1/org/units');
    const inviteAsCitizen = await core(t2.access_token, '/v1/staff/invitations', post({ email: `x.${tag()}@example.invalid`, unitId: crypto.randomUUID(), role: 'member' }));
    check('N13 a citizen token on staff endpoints: 403', asCitizen.status === 403 && inviteAsCitizen.status === 403, `${asCitizen.status} ${inviteAsCitizen.status}`);

    stamp('cross-site requests');
    const login = await newContext(browser);
    const la = authorize(login.page, REALM, 'civora-web', WEB_CB);
    await la.go();
    await waitFor(() => visible(login.page, '#password'), 8000);
    const action = await login.page.locator('#kc-form-login').getAttribute('action');
    const csrf = await fetch(action, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', origin: 'https://attacker.civora-cell.invalid' },
      body: new URLSearchParams({ username: who.email, password: who.password }), redirect: 'manual' });
    const loc = csrf.headers.get('location') ?? '';
    check('N14 login CSRF: credentials posted to Keycloak without the browser\'s sign-in session get no code', !/[?&]code=/.test(loc), `${csrf.status} ${loc.slice(0, 120)}`);
    const cb = await fetch(`${WEB}/auth/callback?code=forged&state=${b64url(crypto.randomBytes(32))}`, { redirect: 'manual' });
    const cbBody = await cb.text();
    check('N15 web callback with a forged state and no pending sign-in: no session cookie, back to the start', !/civora_session=[A-Za-z0-9_-]{20,}/.test(cb.headers.get('set-cookie') ?? '') && /signInFailed/.test(cbBody), `${cb.status} ${cb.headers.get('set-cookie')}`);
    const o = await newContext(browser);
    await o.page.goto(`${WEB}/auth/login?returnTo=${encodeURIComponent('https://attacker.civora-cell.invalid/x')}`);
    await credentials(o.page, who);
    await waitFor(() => visible(o.page, '[data-testid=sign-out]'), 15000);
    check('N16 open redirect: a foreign returnTo ends on the app\'s own page', o.page.url().startsWith(`${WEB}/ar`) && !o.captured.some((s) => s.includes('attacker.')), o.page.url());
    const kcHead = await fetch(`${KC}/realms/${REALM}/protocol/openid-connect/auth?${new URLSearchParams({ client_id: 'civora-web', response_type: 'code', scope: 'openid',
      redirect_uri: WEB_CB, state: 's', code_challenge: b64url(crypto.randomBytes(32)), code_challenge_method: 'S256' })}`, { redirect: 'manual' });
    const kcFrames = `${kcHead.headers.get('x-frame-options') ?? ''} ${kcHead.headers.get('content-security-policy') ?? ''}`;
    const webHead = await fetch(`${WEB}/en`);
    check('N17 framing refused: Keycloak pages (same origin only) and the web app (never)',
      /SAMEORIGIN|frame-ancestors 'self'/i.test(kcFrames) && /frame-ancestors 'none'/.test(webHead.headers.get('content-security-policy') ?? '') && webHead.headers.get('x-frame-options') === 'DENY', kcFrames);
    const pre = await fetch(`${process.env.CORE_URL}/v1/me`, { method: 'OPTIONS', headers: { origin: 'https://attacker.civora-cell.invalid', 'access-control-request-method': 'GET', 'access-control-request-headers': 'authorization' } });
    check('N18 the core allows no cross-origin browser calls (no CORS grant to another origin)', !pre.headers.get('access-control-allow-origin'), `${pre.status} ${pre.headers.get('access-control-allow-origin')}`);

    stamp('browser-side isolation, reporting and dynamic client registration (ASVS 5.0 V3.4.7, V3.5.8, V10.4.7)');
    // node:http, not fetch: fetch adds its own Sec-Fetch-Mode, a browser sends exactly one of each.
    const xsite = (mode, dest, method = 'GET') => new Promise((resolve, reject) => {
      const req = http.request(`${WEB}/en/security`, { method, headers: { 'sec-fetch-site': 'cross-site', 'sec-fetch-mode': mode, 'sec-fetch-dest': dest, ...(method === 'POST' ? { 'content-type': 'application/x-www-form-urlencoded', 'content-length': 1 } : {}) } },
        (res) => { res.resume(); resolve({ status: res.statusCode }); });
      req.on('error', reject);
      req.end(method === 'POST' ? 'x' : undefined);
    });
    const asImage = await xsite('no-cors', 'image');
    const asScript = await xsite('no-cors', 'script');
    const asFrame = await xsite('navigate', 'iframe');
    const asPost = await xsite('navigate', 'document', 'POST');
    const asLink = await xsite('navigate', 'document');
    check('N20 another site cannot load app pages as images, scripts, frames or form posts (403); a plain link still works',
      [asImage, asScript, asFrame, asPost].every((r) => r.status === 403) && asLink.status !== 403, [asImage, asScript, asFrame, asPost, asLink].map((r) => r.status).join(' '));
    const cspHeader = webHead.headers.get('content-security-policy') ?? '';
    const report = await fetch(`${WEB}/csp-report`, { method: 'POST', headers: { 'content-type': 'application/csp-report' },
      body: JSON.stringify({ 'csp-report': { 'document-uri': `${WEB}/en/security?code=secret`, 'effective-directive': 'script-src-elem', 'blocked-uri': 'https://attacker.invalid/x.js?token=abc' } }) });
    const notJson = await fetch(`${WEB}/csp-report`, { method: 'POST', headers: { 'content-type': 'text/plain' }, body: 'x' });
    check('N21 the Content Security Policy reports violations to the app (report-uri, report-to); the endpoint takes reports only',
      /report-uri \/csp-report/.test(cspHeader) && /report-to csp/.test(cspHeader) && /csp="\/csp-report"/.test(webHead.headers.get('reporting-endpoints') ?? '')
        && report.status === 204 && notJson.status === 415, `${report.status} ${notJson.status}`);
    const dcr = await fetch(`${KC}/realms/${REALM}/clients-registrations/openid-connect`, { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ client_name: 'attacker app', redirect_uris: ['https://attacker.invalid/cb'] }) });
    const dcrStaff = await fetch(`${KC}/realms/civora-staff/clients-registrations/openid-connect`, { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ client_name: 'attacker app', redirect_uris: ['https://attacker.invalid/cb'] }) });
    check('N22 anonymous dynamic client registration is refused in both realms (no unknown client applications)', [dcr.status, dcrStaff.status].every((st) => st === 401 || st === 403), `${dcr.status} ${dcrStaff.status}`);
    for (const ctx of [attacker, victim, w, x, login, o]) await ctx.context.close();
  } finally {
    await browser.close();
  }
  stamp(lib.failures() ? `${lib.failures()} check(s) FAILED` : 'all negative checks passed');
  process.exit(lib.failures() ? 1 : 0);
})().catch((e) => {
  console.error(`  FAIL ${e.stack || e}`);
  process.exit(1);
});
