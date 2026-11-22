'use strict';
/**
 * Phase 3 week 3 (W3-3): identity links through the SIMULATED national eID (P3-D4, P3-API6, P3-DB4), end to end:
 * citizens of the real citizens realm, the core as relying party of the simulator realm (synthetic identities only),
 * Chromium at the simulator's sign-in page. Run by run.sh (STEP_UP_MAX_AGE_SECONDS=30); writes the synthetic national
 * identifiers it created to EID_IDS_OUT so run.sh can check none of them reached the core's database or log.
 */
const crypto = require('node:crypto');
const fs = require('node:fs');
const { chromium } = require('playwright');
const lib = require('./lib.cjs');
const { WEB_CB, LANG, check, info, stamp, claims, sleep, admin, activationMail, newContext, waitFor, core, visible, submit, activate, tag, pw, signIn,
  pageLanguage } = lib;

const SIM = 'sim-national-eid';
const EID_CB = process.env.EID_REDIRECT_URI || 'https://app.civora-cell.invalid/identity/eid/callback';
const STEP_UP = Number(process.env.STEP_UP_MAX_AGE_SECONDS || 30);
const post = (body) => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const created = [];
const syntheticId = () => `99${String(crypto.randomInt(0, 1_000_000)).padStart(6, '0')}`;

/** A synthetic identity at the simulated eID (random password; the simulator accepts only the synthetic range). */
async function eidIdentity(loa) {
  const nationalId = syntheticId();
  const username = `eid.${tag()}`;
  const password = pw();
  await admin('POST', `${SIM}/users`, { username, enabled: true, attributes: { national_id: [nationalId], loa: [loa] }, credentials: [{ type: 'password', value: password, temporary: false }] });
  created.push(nationalId);
  return { username, password, nationalId };
}

/** A citizen registered through the core and activated (password + authenticator app); returns a sign-in function. */
async function citizen(browser) {
  const email = `eid.citizen.${tag()}@example.invalid`;
  await core(undefined, '/v1/registrations', post({ email, locale: 'en' }));
  const act = await activate((await newContext(browser)).page, (await activationMail(email)).link);
  return async () => {
    const ctx = await newContext(browser);
    const t = await signIn(ctx, { realm: 'civora-citizens', client: 'civora-web', cb: WEB_CB, email, password: act.password, secret: act.secret });
    await ctx.context.close();
    return t.access_token;
  };
}

/** Starts a link attempt; the person authenticates at the simulated eID in a fresh browser; returns code and state. */
async function eidRoundTrip(browser, token, who, locale) {
  const start = await core(token, '/v1/identity/links', post(locale ? { locale } : {}));
  if (start.status !== 201) return { start };
  const ctx = await newContext(browser);
  // The eID returns to the app's callback (redirected requests escape route handlers, so read from request events). The
  // web app gets the request too but has no session in this browser, so it never uses this test's code.
  ctx.context.on('request', (r) => { if (r.url().startsWith(EID_CB)) ctx.captured.push(r.url()); });
  await ctx.page.goto(start.body.authorizationUrl).catch(() => undefined);
  await waitFor(() => visible(ctx.page, '#username'), 10000);
  const page = await pageLanguage(ctx.page);
  await ctx.page.locator('#username').fill(who.username);
  await ctx.page.locator('#password').fill(who.password);
  await submit(ctx.page);
  const back = await waitFor(() => ctx.captured.find((u) => u.startsWith(EID_CB)), 15000);
  await ctx.context.close();
  const q = back ? new URL(back).searchParams : new URLSearchParams();
  return { start, page, code: q.get('code'), state: q.get('state') };
}
const complete = (token, id, code, state) => core(token, `/v1/identity/links/${id}:complete`, post({ code, state }));

(async () => {
  await lib.refreshAdmin();
  const browser = await chromium.launch({ args: ['--no-proxy-server'] });
  try {
    stamp('the simulated eID holds synthetic identities only');
    let refused = null;
    await admin('POST', `${SIM}/users`, { username: `eid.real.${tag()}`, enabled: true, attributes: { national_id: [String(10_000_000 + crypto.randomInt(0, 80_000_000))], loa: ['high'] } })
      .catch((e) => { refused = String(e.message); });
    check('simulator refuses an identity outside the synthetic range (99xxxxxx)', /: 400 /.test(refused ?? ''), refused ?? 'accepted');
    const alice = await eidIdentity('high');
    const other = await eidIdentity('substantial');

    stamp('citizen A links an eID identity (simulator pages in Arabic)');
    const signInA = await citizen(browser);
    let tA = await signInA();
    const r1 = await eidRoundTrip(browser, tA, alice, 'ar-TN');
    const url = new URL(r1.start.body?.authorizationUrl ?? 'http://x.invalid');
    check('POST /v1/identity/links (recent sign-in): 201, attempt id, eID URL with prompt=login, PKCE S256, state, nonce',
      r1.start.status === 201 && url.pathname.endsWith(`/realms/${SIM}/protocol/openid-connect/auth`) && url.searchParams.get('prompt') === 'login'
        && url.searchParams.get('code_challenge_method') === 'S256' && !!url.searchParams.get('state') && !!url.searchParams.get('nonce'), r1.start.raw);
    check('the eID page follows the requested language (ar, right to left)', r1.page?.lang === 'ar' && r1.page?.dir === 'rtl' && LANG.ar.script.test(r1.page?.button ?? ''), JSON.stringify(r1.page));
    let r = await complete(tA, r1.start.body.id, r1.code, r1.state);
    check('complete with the code and state: 200 linked, level high', r.status === 200 && r.body.outcome === 'linked' && r.body.loa === 'high', r.raw);
    r = await complete(tA, r1.start.body.id, r1.code, r1.state);
    check('the same attempt again (replay of code and state): 404', r.status === 404, r.raw);
    r = await core(tA, '/v1/identity/links');
    check('GET /v1/identity/links: national-id-link, eid-simulated, high; no identifier in the answer',
      r.status === 200 && r.body.length === 1 && r.body[0].type === 'national-id-link' && r.body[0].source === 'eid-simulated' && r.body[0].loa === 'high'
        && !r.raw.includes(alice.nationalId), r.raw);

    stamp('one national identity, one person (simulator pages in French)');
    const signInB = await citizen(browser);
    const tB = await signInB();
    const r2 = await eidRoundTrip(browser, tB, alice, 'fr-TN');
    check('the eID page follows the requested language (fr)', r2.page?.lang === 'fr', JSON.stringify(r2.page));
    r = await complete(tB, r2.start.body.id, r2.code, r2.state);
    check('citizen B proves the same eID identity: 409, nothing linked to B', r.status === 409 && (await core(tB, '/v1/identity/links')).body.length === 0, r.raw);

    stamp('an account keeps the identity it linked (simulator pages in English)');
    tA = await signInA();
    const r3 = await eidRoundTrip(browser, tA, other, 'en');
    check('the eID page follows the requested language (en)', r3.page?.lang === 'en', JSON.stringify(r3.page));
    r = await complete(tA, r3.start.body.id, r3.code, r3.state);
    check('citizen A proves a different eID identity: 409', r.status === 409, r.raw);

    stamp('state and PKCE bind the eID answer to its attempt');
    tA = await signInA();
    const r4 = await eidRoundTrip(browser, tA, alice);
    r = await complete(tA, r4.start.body.id, r4.code, crypto.randomBytes(32).toString('base64url'));
    check('wrong state: 404 (the attempt is not consumed)', r.status === 404, r.raw);
    const x = await eidRoundTrip(browser, tA, alice);   // attempt X: code issued for X's PKCE challenge
    const y = await core(tA, '/v1/identity/links', post({})); // attempt Y: never went to the eID
    const yState = new URL(y.body.authorizationUrl).searchParams.get('state');
    r = await complete(tA, y.body.id, x.code, yState);
    check('the code of attempt X presented with attempt Y: 422 (eID refuses: PKCE verifier of Y)', r.status === 422, r.raw);
    r = await complete(tA, r4.start.body.id, r4.code, r4.state);
    check('the right state afterwards: 200 refreshed', r.status === 200 && r.body.outcome === 'refreshed', r.raw);
    r = await core(tA, '/v1/identity/links', post({}));
    check('a sixth attempt within the hour: 429', r.status === 429, r.raw);

    stamp('step-up: starting a link needs a recent sign-in');
    const wait = Math.max(0, (claims(tB).auth_time + STEP_UP + 2) * 1000 - Date.now());
    info(`waiting ${Math.round(wait / 1000)} s for citizen B's sign-in to become older than the limit`);
    await sleep(wait);
    r = await core(tB, '/v1/identity/links', post({}));
    check('old sign-in: 401 (insufficient_user_authentication)', r.status === 401, r.raw);
  } finally {
    await browser.close();
    if (process.env.EID_IDS_OUT) fs.appendFileSync(process.env.EID_IDS_OUT, created.join('\n') + '\n');
  }
  stamp(lib.failures() ? `${lib.failures()} check(s) FAILED` : 'all eID link checks passed');
  process.exit(lib.failures() ? 1 : 0);
})().catch((e) => {
  console.error(`  FAIL ${e.stack || e}`);
  if (process.env.EID_IDS_OUT) fs.appendFileSync(process.env.EID_IDS_OUT, created.join('\n') + '\n');
  process.exit(1);
});
