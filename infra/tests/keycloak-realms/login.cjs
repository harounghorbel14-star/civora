'use strict';
/**
 * Phase 3 week 2: real logins in a real browser against the CIVORA citizens and staff realms (Keycloak 26.8.1),
 * with WebAuthn virtual authenticators (Chromium DevTools protocol), and the core verifying the tokens Keycloak
 * issues. Synthetic users only, created through the admin API with random passwords; nothing is stored.
 *
 * Environment: KC_URL, CORE_URL, KC_ADMIN_PASSWORD, ARTIFACT_DIR (screenshots on failure). Needs Playwright.
 */
const { chromium } = require('playwright');
const crypto = require('node:crypto');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const KC = process.env.KC_URL;
const CORE = process.env.CORE_URL;
const ARTIFACTS = process.env.ARTIFACT_DIR || '.';
const WEB_CB = 'https://app.civora-cell.invalid/callback';
const WS_CB = 'https://workspace.civora-cell.invalid/callback';
const RP1_CB = 'https://services.agency.invalid/callback';
const RP2_CB = 'https://other.agency.invalid/callback';
const TENANT = '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b';
const start = Date.now();

let failed = 0;
function check(name, ok, detail) {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${ok || detail === undefined ? '' : `\n       ${String(detail).slice(0, 400)}`}`);
  if (!ok) failed++;
  return ok;
}
const stamp = (msg) => console.log(`[${Math.round((Date.now() - start) / 1000)}s] ${msg}`);
const b64url = (buf) => Buffer.from(buf).toString('base64url');
const rnd = (n = 18) => b64url(crypto.randomBytes(n));
const claims = (jwt) => JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString());
const pw = () => `Synthetic-${rnd(15)}`; // >= 12 characters, random per run

async function form(url, body) {
  const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(body) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}

let adminToken;
let adminTokenAt = 0;
async function refreshAdmin() {
  // Master-realm admin tokens live 60 s: take a new one when it is older than 40 s.
  if (Date.now() - adminTokenAt < 40000) return;
  adminToken = (await form(`${KC}/realms/master/protocol/openid-connect/token`, {
    grant_type: 'password', client_id: 'admin-cli', username: 'admin', password: process.env.KC_ADMIN_PASSWORD,
  })).body.access_token;
  if (!adminToken) throw new Error('no admin token');
  adminTokenAt = Date.now();
}
async function admin(method, p, body) {
  await refreshAdmin();
  const r = await fetch(`${KC}/admin/realms/${p}`, {
    method, headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' }, body: body && JSON.stringify(body),
  });
  if (r.status >= 300) throw new Error(`admin ${method} ${p}: ${r.status} ${await r.text()}`);
  const loc = r.headers.get('location');
  const text = await r.text();
  return loc ? loc.split('/').pop() : text ? JSON.parse(text) : null;
}

async function createUser(realm, username, password, extra = {}) {
  return admin('POST', `${realm}/users`, {
    username, email: username.includes('@') ? username : `${username}@example.invalid`, emailVerified: true, enabled: true, firstName: 'Synthetic', lastName: 'Person',
    credentials: [{ type: 'password', value: password, temporary: false }], ...extra,
  });
}

/** TOTP (RFC 6238): HMAC-SHA1, 6 digits, 30 s; the realm's policy. */
function totp(secretBase32, offset = 0) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const ch of secretBase32.replace(/[\s=]/g, '').toUpperCase()) bits += alphabet.indexOf(ch).toString(2).padStart(5, '0');
  const key = Buffer.from(bits.match(/.{8}/g).map((b) => parseInt(b, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000) + offset));
  const h = crypto.createHmac('sha1', key).update(counter).digest();
  const o = h[h.length - 1] & 0xf;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).padStart(6, '0');
}

/** A TOTP code from a time step not used before: the realm refuses a code used once (replay protection). */
let lastStep = -1;
async function freshTotp(secret) {
  while (Math.floor(Date.now() / 30000) <= lastStep) await new Promise((r) => setTimeout(r, 500));
  lastStep = Math.floor(Date.now() / 30000);
  return totp(secret);
}

/** A browser context whose app callbacks are captured instead of loaded (the apps do not exist in this test). */
async function newContext(browser) {
  const context = await browser.newContext({ locale: 'en-US' });
  const captured = [];
  // Keycloak reaches the callback with a 302, and route handlers do not see redirected requests: the request event
  // does. The .invalid hosts never resolve, so nothing leaves the machine; route() also answers direct navigations.
  const isCallback = (u) => /^https:\/\/[a-z.-]+\.(civora-cell|agency)\.invalid\//.test(u);
  context.on('request', (r) => { if (isCallback(r.url())) captured.push(r.url()); });
  for (const host of ['https://*.civora-cell.invalid/**', 'https://*.agency.invalid/**']) {
    await context.route(host, (route) => route.fulfill({ status: 200, body: 'callback captured' }));
  }
  const page = await context.newPage();
  page.on('dialog', (d) => d.accept('Synthetic authenticator').catch(() => undefined)); // label prompt after enrolment
  return { context, page, captured };
}

/** Adds a WebAuthn virtual authenticator to the page: "internal" is a platform passkey, "usb" a FIDO2 security key. */
async function addAuthenticator(page, transport) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('WebAuthn.enable', { enableUI: false });
  const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: { protocol: 'ctap2', transport, hasResidentKey: transport === 'internal', hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true },
  });
  return { cdp, authenticatorId };
}

function authorize(page, realm, client, redirect, extra = {}) {
  const verifier = rnd(32);
  const q = new URLSearchParams({
    client_id: client, redirect_uri: redirect, response_type: 'code', scope: 'openid', state: rnd(), nonce: rnd(),
    code_challenge: b64url(crypto.createHash('sha256').update(verifier).digest()), code_challenge_method: 'S256', ui_locales: 'en', ...extra,
  });
  // With single sign-on Keycloak answers at once with a redirect to the app callback, an .invalid host that never
  // resolves: that navigation error is expected (the request event has captured the code); anything else is raised.
  const go = () => page.goto(`${KC}/realms/${realm}/protocol/openid-connect/auth?${q}`).catch((e) => {
    if (!/net::ERR_(NAME_NOT_RESOLVED|TUNNEL_CONNECTION_FAILED|PROXY_CONNECTION_FAILED|ABORTED)/.test(e.message)) throw e;
  });
  return { verifier, go };
}

async function waitFor(fn, ms = 15000) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    const v = await fn();
    if (v) return v;
    await new Promise((r) => setTimeout(r, 200));
  }
  return null;
}

async function codeFrom(captured, before, ms) {
  const url = await waitFor(() => captured.slice(before).find((u) => new URL(u).searchParams.get('code')), ms);
  return url ? new URL(url).searchParams.get('code') : null;
}

async function exchange(realm, client, code, verifier, redirect, secret) {
  return form(`${KC}/realms/${realm}/protocol/openid-connect/token`, {
    grant_type: 'authorization_code', client_id: client, code, code_verifier: verifier, redirect_uri: redirect, ...(secret ? { client_secret: secret } : {}),
  });
}

async function core(token, p = '/v1/me') {
  const r = await fetch(`${CORE}${p}`, { headers: token ? { authorization: `Bearer ${token}` } : {} });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}

const visible = (page, sel) => page.locator(sel).first().isVisible().catch(() => false);
async function submit(page) {
  await Promise.all([page.waitForLoadState('domcontentloaded').catch(() => undefined), page.locator('#kc-login, input[type=submit], button[type=submit]').first().click()]);
}

/** On the citizens' credential step, choose password + TOTP when a passkey is offered first. */
async function choosePassword(page) {
  if (await waitFor(() => visible(page, '#password'), 2500)) return;
  if (await visible(page, '#try-another-way')) {
    await page.locator('#try-another-way').click();
    await page.waitForLoadState('domcontentloaded');
    const option = page.locator('[name=authenticationExecution]').filter({ hasText: /password/i }).first();
    if (await option.count()) await option.click();
    else await page.getByText(/password/i).first().click();
  }
  await page.locator('#password').waitFor({ timeout: 10000 });
}

/** On the citizens' credential step, choose the passkey; Keycloak offers the oldest credential first. */
async function choosePasskey(page) {
  const first = await waitFor(async () => (await visible(page, '#authenticateWebAuthnButton')) ? 'passkey' : (await visible(page, '#try-another-way')) ? 'other' : null, 10000);
  if (first === 'other') {
    await page.locator('#try-another-way').click();
    await page.waitForLoadState('domcontentloaded');
    await page.getByText(/passkey/i).first().click();
  }
  await page.locator('#authenticateWebAuthnButton').waitFor({ timeout: 10000 });
  return first;
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(ARTIFACTS, `${name}.png`), fullPage: true }).catch(() => undefined);
}

async function citizens(browser) {
  stamp('citizens realm (civora-citizens): passkeys first, password + TOTP as the alternative');
  // Citizens sign in with their e-mail address: the realm uses it as the username (registrationEmailAsUsername).
  const user = `citizen.synthetic.${rnd(4).toLowerCase().replace(/[^a-z0-9]/g, 'x')}@example.invalid`;
  const password = pw();
  const userId = await createUser('civora-citizens', user, password);
  const { page, context, captured } = await newContext(browser);
  const passkey = await addAuthenticator(page, 'internal');

  // C1. First login: password, then the realm makes the citizen enrol TOTP before any code is issued.
  let a = authorize(page, 'civora-citizens', 'civora-web', WEB_CB);
  let n = captured.length;
  await a.go();
  await page.locator('#username').fill(user);
  await submit(page);
  await choosePassword(page);
  await page.locator('#password').fill(password);
  await submit(page);
  const enrolTotp = await waitFor(() => visible(page, '#totp'), 10000);
  check('C1 first login with a password alone is held at TOTP enrolment (no code before a second factor)', enrolTotp && !(await codeFrom(captured, n, 500)));
  let secret = '';
  if (enrolTotp) {
    if (await visible(page, '#mode-manual')) await page.locator('#mode-manual').click();
    secret = (await page.locator('#kc-totp-secret-key').innerText().catch(() => '')).trim();
    await page.locator('#totp').fill(await freshTotp(secret));
    if (await visible(page, '#userLabel')) await page.locator('#userLabel').fill('Synthetic phone');
    await submit(page);
  }
  let code = await codeFrom(captured, n);
  let tok = code ? await exchange('civora-citizens', 'civora-web', code, a.verifier, WEB_CB) : { body: {} };
  const at1 = tok.body.access_token;
  if (!check('C1 TOTP enrolled, authorization code exchanged with PKCE for tokens', !!at1, JSON.stringify(tok.body))) await shot(page, 'c1');
  if (at1) {
    const c = claims(at1);
    check('C1 access token: typ Bearer, audience civora-core, azp civora-web, no tenant_id, 5-minute lifetime',
      c.typ === 'Bearer' && [].concat(c.aud).includes('civora-core') && c.azp === 'civora-web' && c.tenant_id === undefined && c.exp - c.iat === 300, JSON.stringify(c));
    check('C1 no offline token granted by default (scope has no offline_access)', !String(c.scope).includes('offline_access'), c.scope);
  }
  // C2. The core accepts the real Keycloak token (signature from the realm's JWKS, issuer, audience, type).
  const me1 = at1 ? await core(at1) : { status: 0 };
  check('C2 core: GET /v1/me with the citizen token returns 200, account realm citizens',
    me1.status === 200 && me1.body.accounts?.[0]?.realm === 'citizens', `${me1.status} ${JSON.stringify(me1.body)}`);

  // C3. The citizen adds a passkey from the app (application-initiated action), user verification required.
  a = authorize(page, 'civora-citizens', 'civora-web', WEB_CB, { kc_action: 'webauthn-register-passwordless' });
  n = captured.length;
  await a.go();
  if (await waitFor(() => visible(page, '#registerWebAuthn'), 10000)) await page.locator('#registerWebAuthn').click();
  code = await codeFrom(captured, n);
  const creds = await admin('GET', `civora-citizens/users/${userId}/credentials`);
  const hasPasskey = creds.some((x) => x.type === 'webauthn-passwordless');
  if (!check('C3 passkey registered (credential type webauthn-passwordless stored for the citizen)', hasPasskey && !!code, JSON.stringify(creds.map((x) => x.type)))) await shot(page, 'c3');

  // C4. A new session: the passkey alone signs the citizen in.
  await context.clearCookies();
  a = authorize(page, 'civora-citizens', 'civora-web', WEB_CB);
  n = captured.length;
  await a.go();
  await page.locator('#username').fill(user);
  await submit(page);
  const offered = await choosePasskey(page);
  console.log(`  info C4 credential offered first after passkey enrolment: ${offered === 'passkey' ? 'passkey' : 'password ("Try Another Way" leads to the passkey)'}`);
  await page.locator('#authenticateWebAuthnButton').click();
  code = await codeFrom(captured, n);
  tok = code ? await exchange('civora-citizens', 'civora-web', code, a.verifier, WEB_CB) : { body: {} };
  const at2 = tok.body.access_token;
  if (!check('C4 passkey login in a new session: code issued without password or TOTP', !!at2, JSON.stringify(tok.body))) await shot(page, 'c4');
  const me2 = at2 ? await core(at2) : { status: 0 };
  check('C4 core: same person as the first login (stable subject)', me2.status === 200 && me2.body?.id === me1.body?.id, `${me2.status} ${me2.body?.id} vs ${me1.body?.id}`);

  // C5. Someone with the password but not the second factor gets no code; the right TOTP code then works (C6).
  const other = await newContext(browser);
  a = authorize(other.page, 'civora-citizens', 'civora-web', WEB_CB);
  n = other.captured.length;
  await a.go();
  await other.page.locator('#username').fill(user);
  await submit(other.page);
  await choosePassword(other.page);
  await other.page.locator('#password').fill(password);
  await submit(other.page);
  const otpAsked = await waitFor(() => visible(other.page, '#otp'), 10000);
  if (otpAsked) {
    const wrong = String((Number(totp(secret)) + 500000) % 1000000).padStart(6, '0');
    await other.page.locator('#otp').fill(wrong);
    await submit(other.page);
  }
  // The refusal is the error page with the code field again (waiting for the error avoids typing into the old page).
  const refused = otpAsked && !!(await waitFor(() => visible(other.page, '#otp[aria-invalid=true]'), 8000));
  if (!check('C5 password + wrong TOTP code: login refused, no authorization code', refused && !(await codeFrom(other.captured, n, 1000)))) await shot(other.page, 'c5');
  if (refused && (await visible(other.page, '#otp'))) {
    await other.page.locator('#otp').fill(await freshTotp(secret)); // waits for a new time step if needed
    await submit(other.page);
  }
  code = await codeFrom(other.captured, n);
  tok = code ? await exchange('civora-citizens', 'civora-web', code, a.verifier, WEB_CB) : { body: {} };
  if (!check('C6 password + current TOTP code: login completes (the alternative to passkeys)', !!tok.body.access_token, JSON.stringify(tok.body))) await shot(other.page, 'c6');
  await other.context.close();

  // R-P3-1 (known, recorded in doc 03): the username-first step answers differently for an unknown address, so it
  // reveals whether an address has an account. Reported here so that a change in either direction is noticed.
  {
    const probe = await newContext(browser);
    await authorize(probe.page, 'civora-citizens', 'civora-web', WEB_CB).go();
    await probe.page.locator('#username').fill(`nobody.${rnd(6).toLowerCase().replace(/[^a-z0-9]/g, 'x')}@example.invalid`);
    await submit(probe.page);
    const told = await waitFor(() => visible(probe.page, '#input-error-username, #input-error'), 4000);
    console.log(`  info R-P3-1 username-first step ${told ? 'DOES' : 'does not'} reveal that an address has no account (account enumeration)`);
    await probe.context.close();
  }

  // C7. No password grant, whichever client is used.
  for (const client of ['civora-web', 'admin-cli']) {
    const r = await form(`${KC}/realms/civora-citizens/protocol/openid-connect/token`, { grant_type: 'password', client_id: client, username: user, password });
    check(`C7 password grant refused for client ${client}`, !r.body.access_token, JSON.stringify(r.body));
  }

  // C8. Pairwise subjects (P3-A3): two relying parties see different, stable identifiers; neither sees the internal id.
  const rp1 = (await admin('GET', 'civora-citizens/clients?clientId=rp-example-agency'))[0];
  const rp1Secret = rnd(24);
  await admin('PUT', `civora-citizens/clients/${rp1.id}`, { ...rp1, enabled: true, secret: rp1Secret });
  const rp2Secret = rnd(24);
  await admin('POST', 'civora-citizens/clients', {
    clientId: 'rp-other-agency', enabled: true, publicClient: false, secret: rp2Secret, standardFlowEnabled: true, directAccessGrantsEnabled: false,
    redirectUris: [RP2_CB], attributes: { 'pkce.code.challenge.method': 'S256', 'civora.client-kind': 'relying-party' },
    protocolMappers: [{ name: 'pairwise subject', protocol: 'openid-connect', protocolMapper: 'oidc-sha256-pairwise-sub-mapper', config: {} }],
  });
  const rpLogin = async (client, cb, sec) => {
    const x = authorize(page, 'civora-citizens', client, cb);
    const m = captured.length;
    await x.go(); // single sign-on: the passkey session from C4
    const c = await codeFrom(captured, m);
    const t = c ? await exchange('civora-citizens', client, c, x.verifier, cb, sec) : { body: { error: 'no code' } };
    return { sub: t.body.id_token ? claims(t.body.id_token).sub : null, body: t.body };
  };
  const subs = [(await rpLogin('rp-example-agency', RP1_CB, rp1Secret)).sub, (await rpLogin('rp-example-agency', RP1_CB, rp1Secret)).sub];
  // B was added after the policy ran: Keycloak has no salt for it and refuses to issue its tokens (fails closed).
  const unsalted = await rpLogin('rp-other-agency', RP2_CB, rp2Secret);
  check('C8 pairwise: a relying party added without a salt gets no token (fails closed, no predictable identifier)', !unsalted.sub, JSON.stringify(unsalted.body));
  await refreshAdmin();
  const policy = spawnSync('python3', [path.join(__dirname, '..', '..', 'keycloak', 'apply-realm-policy.py'), '--server', KC, '--realm', 'civora-citizens',
    '--profile', 'citizens', '--export', path.join(os.tmpdir(), `citizens-${process.pid}.json`)], { env: { ...process.env, KC_ADMIN_TOKEN: adminToken }, encoding: 'utf8' });
  check('C8 policy re-run salts the new relying party', policy.status === 0 && /rp-other-agency: pairwise salt generated/.test(policy.stdout), policy.stdout + policy.stderr);
  subs.push((await rpLogin('rp-other-agency', RP2_CB, rp2Secret)).sub);
  check('C8 pairwise: relying party A sees an identifier that is not the internal user id', subs[0] && subs[0] !== userId, `${subs[0]} vs ${userId}`);
  check('C8 pairwise: the same relying party sees the same identifier on every login', subs[0] && subs[0] === subs[1], subs.join(' '));
  check('C8 pairwise: relying party B sees a different identifier (the two cannot link the citizen)', subs[2] && subs[2] !== subs[0] && subs[2] !== userId, subs.join(' '));

  // C9. Brute-force protection (P3-SEC3, per account): after 5 wrong passwords the account is temporarily locked.
  const victim = `citizen.synthetic.bf${rnd(3).toLowerCase().replace(/[^a-z0-9]/g, 'x')}@example.invalid`;
  const victimPw = pw();
  const victimId = await createUser('civora-citizens', victim, victimPw);
  const bf = await newContext(browser);
  let attempts = 0;
  for (let i = 0; i < 5; i++) {
    a = authorize(bf.page, 'civora-citizens', 'civora-web', WEB_CB);
    await a.go();
    await bf.page.locator('#username').fill(victim);
    await submit(bf.page);
    // Once the account is locked Keycloak no longer offers the password step (quick successive failures lock sooner).
    if (!(await waitFor(() => visible(bf.page, '#password'), 4000))) break;
    await bf.page.locator('#password').fill(`Wrong-${rnd(12)}`);
    await submit(bf.page);
    await waitFor(() => visible(bf.page, '[id^=input-error]'), 4000);
    attempts++;
  }
  console.log(`  info C9 wrong passwords accepted for checking before the lock: ${attempts}`);
  const status = await admin('GET', `civora-citizens/attack-detection/brute-force/users/${victimId}`);
  check('C9 brute force: repeated wrong passwords lock the account temporarily (at most 5 tries)', status.disabled === true && attempts <= 5, JSON.stringify(status));
  await bf.context.close();
  await passkey.cdp.detach().catch(() => undefined);
  await context.close();
}

async function staff(browser) {
  stamp('staff realm (civora-staff): password + FIDO2 security key, always');
  const user = `officer.synthetic.${rnd(4).toLowerCase().replace(/[^a-z0-9]/g, 'x')}`;
  const password = pw();
  await createUser('civora-staff', user, password, { attributes: { tenant_id: [TENANT] } });
  const { page, context, captured } = await newContext(browser);
  await addAuthenticator(page, 'usb');

  // S1. First login: the password is not enough; the officer must enrol a security key before any code is issued.
  let a = authorize(page, 'civora-staff', 'civora-workspace', WS_CB);
  let n = captured.length;
  await a.go();
  await page.locator('#username').fill(user);
  await page.locator('#password').fill(password);
  await submit(page);
  const enrol = await waitFor(() => visible(page, '#registerWebAuthn'), 10000);
  check('S1 first login: password accepted, then security-key enrolment required (no code yet)', enrol && !(await codeFrom(captured, n, 500)));
  if (enrol) await page.locator('#registerWebAuthn').click();
  let code = await codeFrom(captured, n);
  let tok = code ? await exchange('civora-staff', 'civora-workspace', code, a.verifier, WS_CB) : { body: {} };
  const at1 = tok.body.access_token;
  if (!check('S1 security key enrolled (user verification required), code exchanged for tokens', !!at1, JSON.stringify(tok.body))) await shot(page, 's1');
  if (at1) {
    const c = claims(at1);
    check('S1 access token: audience civora-core, azp civora-workspace, tenant_id from the admin-only attribute',
      [].concat(c.aud).includes('civora-core') && c.azp === 'civora-workspace' && c.tenant_id === TENANT, JSON.stringify(c));
  }
  const me = at1 ? await core(at1) : { status: 0 };
  check('S2 core: GET /v1/me with the staff token returns 200, account realm staff', me.status === 200 && me.body.accounts?.[0]?.realm === 'staff', `${me.status} ${JSON.stringify(me.body)}`);

  // S3. Every later login: password and the security key.
  await context.clearCookies();
  a = authorize(page, 'civora-staff', 'civora-workspace', WS_CB);
  n = captured.length;
  await a.go();
  await page.locator('#username').fill(user);
  await page.locator('#password').fill(password);
  await submit(page);
  const asked = await waitFor(() => visible(page, '#authenticateWebAuthnButton'), 10000);
  if (asked) await page.locator('#authenticateWebAuthnButton').click();
  code = await codeFrom(captured, n);
  tok = code ? await exchange('civora-staff', 'civora-workspace', code, a.verifier, WS_CB) : { body: {} };
  if (!check('S3 second login: password, then the security key is asked and accepted', asked && !!tok.body.access_token, JSON.stringify(tok.body))) await shot(page, 's3');

  // S4. The password without the officer's key: another authenticator (holding no credential for them) gets nowhere.
  const thief = await newContext(browser);
  await addAuthenticator(thief.page, 'usb');
  a = authorize(thief.page, 'civora-staff', 'civora-workspace', WS_CB);
  n = thief.captured.length;
  await a.go();
  await thief.page.locator('#username').fill(user);
  await thief.page.locator('#password').fill(password);
  await submit(thief.page);
  if (await waitFor(() => visible(thief.page, '#authenticateWebAuthnButton'), 10000)) await thief.page.locator('#authenticateWebAuthnButton').click();
  check('S4 password without the enrolled security key: the browser cannot produce an assertion, no authorization code', !(await codeFrom(thief.captured, n, 8000)));
  // Server side: a forged assertion posted straight to Keycloak's WebAuthn form is rejected. A fresh login, stopped
  // on the security-key page without pressing the button (otherwise the page's own script races the forgery).
  a = authorize(thief.page, 'civora-staff', 'civora-workspace', WS_CB);
  n = thief.captured.length;
  await a.go();
  await thief.page.locator('#username').fill(user);
  await thief.page.locator('#password').fill(password);
  await submit(thief.page);
  await waitFor(() => visible(thief.page, '#authenticateWebAuthnButton'), 10000);
  const forged = await thief.page.evaluate(() => {
    const f = document.getElementById('webauth');
    if (!f) return false;
    const junk = btoa(crypto.getRandomValues(new Uint8Array(64)).join(',')).replace(/=+$/, '');
    for (const name of ['clientDataJSON', 'authenticatorData', 'signature', 'credentialId', 'userHandle']) {
      const el = f.querySelector(`[name=${name}]`);
      if (el) el.value = junk;
    }
    const err = f.querySelector('[name=error]');
    if (err) err.value = '';
    f.submit();
    return true;
  }).catch(() => false);
  check('S4 a forged WebAuthn assertion posted to Keycloak is rejected (no authorization code)', forged && !(await codeFrom(thief.captured, n, 5000)), `form found: ${forged}`);
  await thief.context.close();

  // S5. No password grant: refused for every client, and refused by the realm even for a client misconfigured to allow it.
  for (const client of ['civora-workspace', 'admin-cli']) {
    const r = await form(`${KC}/realms/civora-staff/protocol/openid-connect/token`, { grant_type: 'password', client_id: client, username: user, password });
    check(`S5 password grant refused for client ${client}`, !r.body.access_token, JSON.stringify(r.body));
  }
  await admin('POST', 'civora-staff/clients', { clientId: 'misconfigured-direct', publicClient: true, directAccessGrantsEnabled: true, standardFlowEnabled: false });
  const r = await form(`${KC}/realms/civora-staff/protocol/openid-connect/token`, { grant_type: 'password', client_id: 'misconfigured-direct', username: user, password });
  check('S5 a client misconfigured to allow the password grant is still refused by the realm (deny-direct-grant flow)', !r.body.access_token, JSON.stringify(r.body));
  await context.close();
}

async function coreNegatives() {
  stamp('core: tokens it must refuse');
  await refreshAdmin();
  const r1 = await core(adminToken);
  check('K1 core refuses a token from an untrusted realm (master): 401', r1.status === 401, r1.status);
  const r2 = await core(undefined);
  check('K2 core refuses a request without a token: 401', r2.status === 401, r2.status);
}

(async () => {
  await refreshAdmin();
  const browser = await chromium.launch({ args: ['--no-proxy-server'] }); // nothing leaves the machine
  try {
    await citizens(browser);
    await staff(browser);
    await coreNegatives();
  } finally {
    await browser.close();
  }
  stamp(failed ? `${failed} check(s) FAILED` : 'all checks passed');
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error(`  FAIL ${e.stack || e}`);
  process.exit(1);
});
