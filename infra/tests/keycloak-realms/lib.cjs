'use strict';
/**
 * Shared helpers for the CIVORA identity tests (realms, accounts): admin API, synthetic users, TOTP, mail catcher,
 * Chromium contexts with WebAuthn virtual authenticators, authorization code + PKCE, the core's API, checks.
 * Environment: KC_URL, CORE_URL, MAIL_URL, KC_ADMIN_PASSWORD, ARTIFACT_DIR.
 */
const crypto = require('node:crypto');
const path = require('node:path');

const KC = process.env.KC_URL;
const CORE = process.env.CORE_URL;
const MAIL = process.env.MAIL_URL;
const ARTIFACTS = process.env.ARTIFACT_DIR || '.';
const LOCALES = (process.env.LOCALES || 'ar,fr,en').split(',');
const WEB_CB = 'https://app.civora-cell.invalid/callback';
const WS_CB = 'https://workspace.civora-cell.invalid/callback';
const RP1_CB = 'https://services.agency.invalid/callback';
const RP2_CB = 'https://other.agency.invalid/callback';
const TENANT = '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b';
const TEST_AAGUID = '01020304-0506-0708-0102-030405060708'; // Chromium virtual authenticator (test approved list)
const POLICY = path.join(__dirname, '..', '..', 'keycloak', 'apply-realm-policy.py');
const start = Date.now();

// What each locale must look like (Keycloak's own translations; realm names from the realm files).
const LANG = {
  ar: { pack: 'ar-TN', dir: 'rtl', citizens: 'CIVORA — فضاء المواطنين', staff: 'CIVORA — فضاء الأعوان', script: /[؀-ۿ]/ },
  fr: { pack: 'fr-TN', dir: 'ltr', citizens: 'CIVORA — Espace citoyens', staff: 'CIVORA — Espace agents', script: /[a-zà-ÿ]/i },
  en: { pack: 'en', dir: 'ltr', citizens: 'CIVORA — Citizens', staff: 'CIVORA — Staff and officers', script: /[a-z]/i },
};

let failed = 0;
const failures = () => failed;
function check(name, ok, detail) {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${ok || detail === undefined ? '' : `\n       ${String(detail).slice(0, 500)}`}`);
  if (!ok) failed++;
  return ok;
}
const info = (msg) => console.log(`  info ${msg}`);
const stamp = (msg) => console.log(`[${Math.round((Date.now() - start) / 1000)}s] ${msg}`);
const b64url = (buf) => Buffer.from(buf).toString('base64url');
const rnd = (n = 18) => b64url(crypto.randomBytes(n));
const tag = () => crypto.randomBytes(4).toString('hex');
const claims = (jwt) => JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString());
const pw = () => `Synthetic-${rnd(15)}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

async function form(url, body) {
  const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(body) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}

let adminToken;
let adminTokenAt = 0;
async function refreshAdmin() {
  if (Date.now() - adminTokenAt < 40000) return; // master-realm admin tokens live 60 s
  adminToken = (await form(`${KC}/realms/master/protocol/openid-connect/token`, {
    grant_type: 'password', client_id: 'admin-cli', username: 'admin', password: process.env.KC_ADMIN_PASSWORD,
  })).body.access_token;
  if (!adminToken) throw new Error('no admin token');
  adminTokenAt = Date.now();
}
async function admin(method, p, body) {
  await refreshAdmin();
  const r = await fetch(`${KC}/admin/realms/${p}`, { method, headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' }, body: body && JSON.stringify(body) });
  if (r.status >= 300) throw new Error(`admin ${method} ${p}: ${r.status} ${await r.text()}`);
  const loc = r.headers.get('location');
  const text = await r.text();
  return loc ? loc.split('/').pop() : text ? JSON.parse(text) : null;
}
const credentialTypes = async (realm, id) => (await admin('GET', `${realm}/users/${id}/credentials`)).map((c) => c.type).sort();
const userByEmail = async (realm, email) => (await admin('GET', `${realm}/users?exact=true&email=${encodeURIComponent(email)}`))[0];

/** TOTP (RFC 6238, HMAC-SHA1, 6 digits, 30 s), never twice in one time step per secret (the realm refuses replays). */
const lastStep = new Map();
async function freshTotp(secret) {
  while (Math.floor(Date.now() / 30000) <= (lastStep.get(secret) ?? -1)) await sleep(500);
  const step = Math.floor(Date.now() / 30000);
  lastStep.set(secret, step);
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const ch of secret.replace(/[\s=]/g, '').toUpperCase()) bits += alphabet.indexOf(ch).toString(2).padStart(5, '0');
  const key = Buffer.from(bits.match(/.{8}/g).map((b) => parseInt(b, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const h = crypto.createHmac('sha1', key).update(counter).digest();
  const o = h[h.length - 1] & 0xf;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).padStart(6, '0');
}

/** Messages the mail catcher received for an address (newest first). */
async function mails(to) {
  const r = await (await fetch(`${MAIL}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`)).json();
  return r.messages ?? [];
}
async function activationMail(to, ms = 15000) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    const m = (await mails(to))[0];
    if (m) {
      const full = await (await fetch(`${MAIL}/api/v1/message/${m.ID}`)).json();
      return { subject: m.Subject, link: (full.Text.match(/https?:\/\/\S+action-token\S+/) ?? [])[0], count: (await mails(to)).length };
    }
    await sleep(300);
  }
  return null;
}

/**
 * The two e-mails of an account recovery (P3-SEC4) sent after `before` messages: the activation link (from Keycloak)
 * and the recovery notice (from the core). Null for each one that did not arrive within `ms`.
 */
async function recoveryMails(to, before, ms = 20000) {
  const until = Date.now() + ms;
  let list = [];
  while (Date.now() < until) {
    list = await mails(to);
    if (list.length >= before + 2) break;
    await sleep(300);
  }
  const fresh = list.slice(0, Math.max(0, list.length - before));
  const out = { activation: null, notice: null, count: list.length };
  for (const m of fresh) {
    const full = await (await fetch(`${MAIL}/api/v1/message/${m.ID}`)).json();
    const link = (full.Text.match(/https?:\/\/\S+action-token\S+/) ?? [])[0];
    if (link) out.activation = { subject: m.Subject, link };
    else out.notice = { subject: m.Subject, text: full.Text };
  }
  return out;
}

/** A browser context; app callbacks are captured from request events (redirected requests escape route handlers). */
async function newContext(browser, locale = 'en') {
  const context = await browser.newContext({ locale: locale === 'ar' ? 'ar-TN' : locale === 'fr' ? 'fr-TN' : 'en-US' });
  const captured = [];
  const isCallback = (u) => /^https:\/\/[a-z.-]+\.(civora-cell|agency)\.invalid\//.test(u);
  context.on('request', (r) => { if (isCallback(r.url())) captured.push(r.url()); });
  for (const host of ['https://*.civora-cell.invalid/**', 'https://*.agency.invalid/**']) await context.route(host, (route) => route.fulfill({ status: 200, body: 'callback' }));
  const page = await context.newPage();
  page.on('dialog', (d) => d.accept('Synthetic authenticator').catch(() => undefined));
  return { context, page, captured };
}
async function addAuthenticator(page, transport) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('WebAuthn.enable', { enableUI: false });
  await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: { protocol: 'ctap2', transport, hasResidentKey: transport === 'internal', hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true },
  });
}
function authorize(page, realm, client, redirect, extra = {}) {
  const verifier = rnd(32);
  const q = new URLSearchParams({
    client_id: client, redirect_uri: redirect, response_type: 'code', scope: 'openid', state: rnd(), nonce: rnd(),
    code_challenge: b64url(crypto.createHash('sha256').update(verifier).digest()), code_challenge_method: 'S256', ...extra,
  });
  // With single sign-on Keycloak redirects at once to the callback, an .invalid host: that navigation error is expected.
  const target = `${KC}/realms/${realm}/protocol/openid-connect/auth?${q}`;
  const go = async () => {
    // A previous redirect to the app callback (an .invalid host) may still be ending on Chromium's error page; a
    // navigation started meanwhile is "interrupted" (seen on a GitHub runner): wait for the page, then try again.
    for (let attempt = 1; attempt <= 3; attempt++) {
      await page.waitForLoadState('load').catch(() => undefined);
      try {
        await page.goto(target);
        return;
      } catch (e) {
        if (/net::ERR_(NAME_NOT_RESOLVED|TUNNEL_CONNECTION_FAILED|PROXY_CONNECTION_FAILED|ABORTED)/.test(e.message)) return;
        if (!/interrupted by another navigation/.test(e.message) || attempt === 3) throw e;
        await sleep(300);
      }
    }
  };
  return { verifier, go };
}
async function waitFor(fn, ms = 15000) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    const v = await fn();
    if (v) return v;
    await sleep(200);
  }
  return null;
}
async function codeFrom(captured, before, ms = 15000) {
  const url = await waitFor(() => captured.slice(before).find((u) => new URL(u).searchParams.get('code')), ms);
  return url ? new URL(url).searchParams.get('code') : null;
}
async function exchange(realm, client, code, verifier, redirect, secret) {
  return form(`${KC}/realms/${realm}/protocol/openid-connect/token`, {
    grant_type: 'authorization_code', client_id: client, code, code_verifier: verifier, redirect_uri: redirect, ...(secret ? { client_secret: secret } : {}),
  });
}
async function core(token, p = '/v1/me', init = {}) {
  const t0 = Date.now();
  const r = await fetch(`${CORE}${p}`, { ...init, headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(init.headers || {}) } });
  const text = await r.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: r.status, body, raw: text, ms: Date.now() - t0, type: r.headers.get('content-type') };
}
const visible = (page, sel) => page.locator(sel).first().isVisible().catch(() => false);
async function submit(page, sel = '#kc-login, input[type=submit], button[type=submit]') {
  await Promise.all([page.waitForNavigation({ timeout: 15000 }).catch(() => undefined), page.locator(sel).first().click()]);
}
async function shot(page, name) {
  await page.screenshot({ path: path.join(ARTIFACTS, `${name}.png`), fullPage: true }).catch(() => undefined);
}
const pageLanguage = (page) => page.evaluate(() => ({ lang: document.documentElement.lang, dir: document.documentElement.dir || 'ltr',
  header: (document.querySelector('#kc-header-wrapper')?.textContent || '').trim(), button: (document.querySelector('#kc-login')?.textContent || '').trim(),
  title: document.title }));

let passkeyExecution;
const setPasskeyExecution = (id) => { passkeyExecution = id; };
/** Citizens' login page offers e-mail + password; the passkey is chosen from "Try another way" (no username asked first). */
async function choosePasskey(page) {
  if (!(await waitFor(() => visible(page, '#try-another-way'), 8000))) return false;
  await Promise.all([page.waitForNavigation(), page.locator('#try-another-way').click()]);
  await Promise.all([page.waitForNavigation(), page.locator(`form:has(input[name=authenticationExecution][value="${passkeyExecution}"])`).evaluate((f) => f.submit())]);
  return !!(await waitFor(() => visible(page, '#authenticateWebAuthnButton'), 8000));
}

/** Follows an activation or invitation link and completes its steps; returns the order in which they were asked. */
async function activate(page, link) {
  await page.goto(link);
  await Promise.all([page.waitForNavigation(), page.locator('a[href*="login-actions"]').first().click()]);
  const seen = [];
  const langs = []; // the language of each Keycloak page on the way
  let secret = null;
  const password = pw();
  for (let i = 0; i < 5; i++) {
    const step = (await visible(page, '#totp')) ? 'TOTP' : (await visible(page, '#registerWebAuthn')) ? 'SECURITY-KEY' : (await visible(page, '#password-new')) ? 'PASSWORD' : null;
    if (!step) break;
    seen.push(step);
    langs.push((await pageLanguage(page).catch(() => ({}))).lang);
    if (step === 'TOTP') {
      if (await visible(page, '#mode-manual')) await page.locator('#mode-manual').click();
      secret = (await page.locator('#kc-totp-secret-key').innerText()).trim();
      await page.locator('#totp').fill(await freshTotp(secret));
      await submit(page, '#saveTOTPBtn, input[type=submit], button[type=submit]');
    } else if (step === 'SECURITY-KEY') {
      await Promise.all([page.waitForNavigation({ timeout: 15000 }).catch(() => undefined), page.locator('#registerWebAuthn').click()]);
    } else {
      await page.locator('#password-new').fill(password);
      await page.locator('#password-confirm').fill(password);
      await submit(page);
    }
    await sleep(300);
  }
  return { seen, secret, password, langs };
}

/** Signs in through the browser; returns the token response. prompt=login forces a fresh sign-in. */
async function signIn(ctx, { realm, client, cb, email, password, secret, passkey = false, extra = {} }) {
  const a = authorize(ctx.page, realm, client, cb, extra);
  const n = ctx.captured.length;
  await a.go();
  if (passkey) {
    if (await choosePasskey(ctx.page)) await ctx.page.locator('#authenticateWebAuthnButton').click();
  } else if (await waitFor(() => visible(ctx.page, '#password'), 5000)) {
    // On re-authentication (prompt=login) Keycloak already knows the user and shows only the password field.
    if (await visible(ctx.page, '#username')) await ctx.page.locator('#username').fill(email);
    await ctx.page.locator('#password').fill(password);
    await submit(ctx.page);
    if (secret && (await waitFor(() => visible(ctx.page, '#otp'), 8000))) { await ctx.page.locator('#otp').fill(await freshTotp(secret)); await submit(ctx.page); }
    if (realm === 'civora-staff' && (await waitFor(() => visible(ctx.page, '#authenticateWebAuthnButton'), 8000))) await ctx.page.locator('#authenticateWebAuthnButton').click();
  }
  const code = await codeFrom(ctx.captured, n);
  return code ? (await exchange(realm, client, code, a.verifier, cb)).body : {};
}

module.exports = {
  signIn,
  KC, CORE, MAIL, ARTIFACTS, LOCALES, WEB_CB, WS_CB, RP1_CB, RP2_CB, TENANT, TEST_AAGUID, POLICY, LANG,
  check, failures, info, stamp, b64url, rnd, tag, claims, pw, sleep, median, form, refreshAdmin, admin, adminToken: () => adminToken,
  credentialTypes, userByEmail, freshTotp, mails, activationMail, newContext, addAuthenticator, authorize, waitFor, codeFrom, exchange,
  core, visible, submit, shot, pageLanguage, setPasskeyExecution, choosePasskey, activate, recoveryMails,
};
