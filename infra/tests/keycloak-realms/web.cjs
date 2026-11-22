'use strict';
/**
 * Phase 3 week 4 (W4-5, P3-T2, P3-AC1): the citizen web app (apps/web, a backend-for-frontend) end to end, in every
 * language of the cell (Arabic, French, English), against the real citizens realm, the core and the simulators:
 * sign-in, preferences applied to the page, sessions, authenticators (Keycloak action, step-up), the customer status
 * page (P3-R2), mandates and "acting on behalf of" (P3-F6), the eID link (P3-API6), sign-out; and the web security
 * checks: cookie attributes, no token in the browser, a new session id at every sign-in, server actions refused from
 * another origin, a strict Content Security Policy.
 * Run by run.sh (WEB_URL, KC_URL, CORE_URL, MAIL_URL, KC_ADMIN_PASSWORD, REPO_DIR, STEP_UP_MAX_AGE_SECONDS, EID_IDS_OUT).
 */
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const lib = require('./lib.cjs');
const { KC, LANG, LOCALES, check, info, stamp, sleep, admin, freshTotp, activationMail, mails, newContext, addAuthenticator, waitFor, core, visible,
  submit, activate, tag, pw, pageLanguage } = lib;

const WEB = process.env.WEB_URL;
const STEP_UP = Number(process.env.STEP_UP_MAX_AGE_SECONDS || 30);
const PACK = { ar: 'ar-TN', fr: 'fr-TN', en: 'en' };
const post = (body) => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const dataset = require(path.join(process.env.REPO_DIR, 'packages', 'synthetic-data', 'dist', 'index.js')).generate({ seed: 7, tenants: 2, casesPerTenant: 10 });
const createdEid = [];

/** The web app's callback registered on the realm's first-party client (deployment setting, like the production URL). */
async function registerWebApp() {
  const c = (await admin('GET', 'civora-citizens/clients?clientId=civora-web'))[0];
  await admin('PUT', `civora-citizens/clients/${c.id}`, { ...c, redirectUris: [...new Set([...c.redirectUris, `${WEB}/auth/callback`])] });
}

async function citizen(browser, lang) {
  const email = `web.${lang}.${tag()}@example.invalid`;
  await core(undefined, '/v1/registrations', post({ email, locale: PACK[lang] }));
  const x = await newContext(browser, lang);
  const act = await activate(x.page, (await activationMail(email)).link);
  await x.context.close();
  return { email, password: act.password, secret: act.secret };
}

/**
 * Keycloak's pages until the browser is back on the web app: password (re-authentication shows only the password), the
 * authenticator app, or the passkey (the context's virtual authenticator), whichever Keycloak asks for.
 */
async function keycloakSignIn(page, who) {
  const until = Date.now() + 25000;
  const done = new Set();
  while (Date.now() < until && page.url().startsWith(KC)) {
    if (!done.has('password') && await visible(page, '#password')) {
      if (await visible(page, '#username')) await page.locator('#username').fill(who.email);
      await page.locator('#password').fill(who.password);
      done.add('password');
      await submit(page);
    } else if (!done.has('otp') && await visible(page, '#otp')) {
      await page.locator('#otp').fill(await freshTotp(who.secret));
      done.add('otp');
      await submit(page);
    } else if (!done.has('passkey') && await visible(page, '#authenticateWebAuthnButton')) {
      done.add('passkey');
      await page.locator('#authenticateWebAuthnButton').click();
    } else {
      await sleep(250);
    }
  }
  return [...done].join('+');
}

/**
 * Keycloak's pages until `selector` shows: an application-initiated action (adding a passkey) first asks for a
 * re-authentication when the sign-in is older than the realm's limit (30 s in this test).
 */
async function keycloakUntil(page, who, selector) {
  const until = Date.now() + 25000;
  const done = new Set();
  while (Date.now() < until && !(await visible(page, selector))) {
    if (!done.has('password') && await visible(page, '#password')) {
      if (await visible(page, '#username')) await page.locator('#username').fill(who.email);
      await page.locator('#password').fill(who.password);
      done.add('password');
      await submit(page);
    } else if (!done.has('otp') && await visible(page, '#otp')) {
      await page.locator('#otp').fill(await freshTotp(who.secret));
      done.add('otp');
      await submit(page);
    } else {
      await sleep(250);
    }
  }
  return { shown: await visible(page, selector), steps: [...done].join('+') || 'none' };
}

async function webSignIn(x, lang, who) {
  await x.page.goto(`${WEB}/${lang}`);
  await x.page.locator('[data-testid=sign-in]').first().click();
  await x.page.waitForURL((u) => u.href.startsWith(KC), { timeout: 10000 }).catch(() => undefined);
  const kcPage = await pageLanguage(x.page).catch(() => ({}));
  await keycloakSignIn(x.page, who);
  const ok = await waitFor(() => visible(x.page, '[data-testid=sign-out]'), 15000);
  return { ok, kcPage };
}

const html = (page) => page.evaluate(() => ({ lang: document.documentElement.lang, dir: document.documentElement.dir, ...document.documentElement.dataset,
  nav: document.querySelector('header nav')?.textContent ?? '' }));
const notice = (page) => page.locator('[data-notice]').first().getAttribute('data-notice').catch(() => null);
const sessionCookie = async (x) => (await x.context.cookies(WEB)).find((c) => /civora_session$/.test(c.name));

async function statusCode(email, before) {
  const until = Date.now() + 15000;
  while (Date.now() < until) {
    const list = await mails(email);
    if (list.length > before) {
      const full = await (await fetch(`${process.env.MAIL_URL}/api/v1/message/${list[0].ID}`)).json();
      return (full.Text.match(/\b(\d{6})\b/) ?? [])[1];
    }
    await sleep(300);
  }
  return null;
}

async function journey(browser, lang, caseIndex) {
  stamp(`[${lang}] citizen journey through the web app`);
  const who = await citizen(browser, lang);
  const x = await newContext(browser, lang);
  const s = await webSignIn(x, lang, who);
  check(`[${lang}] sign-in through the web app: Keycloak page in ${lang}, back signed in`, s.ok && s.kcPage.lang === lang, JSON.stringify(s.kcPage));
  let h = await html(x.page);
  check(`[${lang}] page: lang=${PACK[lang]}, dir=${LANG[lang].dir}, navigation translated`, h.lang === PACK[lang] && h.dir === LANG[lang].dir && LANG[lang].script.test(h.nav), JSON.stringify(h));

  await x.page.goto(`${WEB}/${lang}/profile`);
  await x.page.locator('[data-testid=pref-textSize]').selectOption('large');
  await x.page.locator('[data-testid=pref-highContrast]').check();
  await x.page.locator('[data-testid=pref-save]').click();
  await waitFor(async () => (await notice(x.page)) === 'saved', 10000);
  h = await html(x.page);
  check(`[${lang}] preferences saved through the core and applied to the page (large text, high contrast)`, h.textSize === 'large' && h.contrast === 'high', JSON.stringify(h));

  await x.page.goto(`${WEB}/${lang}/security`);
  const rows = await x.page.locator('[data-testid=sessions] > li').evaluateAll((els) => els.map((e) => e.getAttribute('data-current')));
  const kinds = await x.page.locator('[data-testid=authenticators] > li').evaluateAll((els) => els.map((e) => e.getAttribute('data-kind')));
  check(`[${lang}] security page: this device's session marked; the authenticator app listed, never the password`, rows.includes('yes') && kinds.join() === 'totp', `${rows} ${kinds}`);

  const kase = dataset.cases[caseIndex];
  const contact = dataset.customers.find((c) => c.id === kase.customerId).email;
  const before = (await mails(contact)).length;
  const st = await newContext(browser, lang); // a customer without an account
  await st.page.goto(`${WEB}/${lang}/status`);
  await st.page.locator('[data-testid=status-reference]').fill(`SYN-RC-9-${String(90000 + caseIndex)}`);
  await st.page.locator('[data-testid=status-send]').click();
  const unknownSent = await waitFor(() => visible(st.page, '[data-testid=status-sent]'), 10000);
  await st.page.goto(`${WEB}/${lang}/status`);
  await st.page.locator('[data-testid=status-reference]').fill(kase.reference);
  await st.page.locator('[data-testid=status-send]').click();
  const knownSent = await waitFor(() => visible(st.page, '[data-testid=status-sent]'), 10000);
  check(`[${lang}] status page: an unknown reference and a real one get the same answer`, !!unknownSent && !!knownSent);
  const code = await statusCode(contact, before);
  check(`[${lang}] the one-time code reaches the contact on file only (simulated e-mail, ${lang} text)`, !!code && (await mails(contact)).length === before + 1);
  await st.page.locator('[data-testid=status-code]').fill(code === '000000' ? '000001' : '000000');
  await st.page.locator('[data-testid=status-show]').click();
  const wrong = await waitFor(() => visible(st.page, '[data-testid=status-wrong]'), 10000);
  await st.page.locator('[data-testid=status-code]').fill(code ?? '');
  await st.page.locator('[data-testid=status-show]').click();
  await waitFor(() => visible(st.page, '[data-testid=status-result]'), 10000);
  const result = await st.page.locator('[data-testid=status-result]').textContent().catch(() => '');
  check(`[${lang}] a wrong code is refused; the right one shows the case status in ${lang}`, !!wrong && result.includes(kase.reference) && LANG[lang].script.test(result), result);
  await st.context.close();
  return { x, who };
}

async function signOutChecks(x, lang, who) {
  const kcUser = (await admin('GET', `civora-citizens/users?exact=true&email=${encodeURIComponent(who.email)}`))[0];
  await x.page.goto(`${WEB}/${lang}`);
  await x.page.locator('[data-testid=sign-out]').click();
  await waitFor(async () => (await notice(x.page)) === 'signedOut', 10000);
  const kcSessions = await admin('GET', `civora-citizens/users/${kcUser.id}/sessions`);
  await x.page.goto(`${WEB}/${lang}/security`);
  const backToLogin = x.page.url().startsWith(KC);
  check(`[${lang}] sign-out ends the Keycloak session too; the security page then asks to sign in`, kcSessions.length === 0 && backToLogin, `${kcSessions.length} ${x.page.url().slice(0, 80)}`);
}

(async () => {
  await lib.refreshAdmin();
  await registerWebApp();
  const browser = await chromium.launch({ args: ['--no-proxy-server'] });
  try {
    const signedIn = {};
    for (const [i, lang] of LOCALES.entries()) signedIn[lang] = await journey(browser, lang, i);

    // Ways to sign in, in every language: a passkey through Keycloak's registration; then, once all sign-ins are older
    // than the step-up limit, a removal that asks "confirm it is you" (one wait for all languages).
    const before = {};
    for (const lang of LOCALES) {
      stamp(`[${lang}] authenticators through the web app: a passkey via Keycloak`);
      const { x, who } = signedIn[lang];
      await addAuthenticator(x.page, 'internal');
      await x.page.goto(`${WEB}/${lang}/security`);
      await x.page.locator('[data-testid=add-passkey]').click();
      // Adding a way to sign in needs a recent sign-in (step-up): after the three journeys this one is older than the
      // limit, so the app first asks to confirm it is you, then the addition goes to Keycloak.
      const first = await waitFor(async () => ((await notice(x.page)) === 'stepUp' ? 'stepUp' : x.page.url().startsWith(KC) ? 'keycloak' : null), 10000);
      if (first === 'stepUp') {
        await x.page.locator('[data-testid=step-up]').click();
        await x.page.waitForURL((u) => u.href.startsWith(KC), { timeout: 10000 }).catch(() => undefined);
        await keycloakSignIn(x.page, who);
        await waitFor(async () => (await notice(x.page)) === 'stepUpDone', 15000);
        await x.page.locator('[data-testid=add-passkey]').click();
      }
      await x.page.waitForURL((u) => u.href.startsWith(KC), { timeout: 10000 }).catch(() => undefined);
      if ((await keycloakUntil(x.page, who, '#registerWebAuthn')).shown) {
        const kcLang = (await pageLanguage(x.page)).lang;
        await x.page.locator('#registerWebAuthn').click();
        before[lang] = { kcLang };
      }
      await waitFor(async () => (await notice(x.page)) === 'actionDone', 15000);
      const kinds = await x.page.locator('[data-testid=authenticators] > li').evaluateAll((els) => els.map((e) => e.getAttribute('data-kind')).sort());
      check(`[${lang}] add a passkey (${first === 'stepUp' ? 'after confirming it is you' : 'recent sign-in'}): Keycloak's registration in ${lang}, back on the security page, passkey listed`,
        kinds.join() === 'passkey,totp' && before[lang]?.kcLang === lang, `${kinds} ${before[lang]?.kcLang} ${first} ${x.page.url().slice(0, 120)}`);
      before[lang] = { ...before[lang], cookie: (await sessionCookie(x))?.value };
    }
    info(`waiting ${STEP_UP + 2} s for the sign-ins to become older than the step-up limit`);
    await sleep((STEP_UP + 2) * 1000);
    for (const lang of LOCALES) {
      stamp(`[${lang}] removal needs a recent sign-in (step-up)`);
      const { x, who } = signedIn[lang];
      await x.page.locator('[data-testid=remove-totp]').click();
      await waitFor(async () => (await notice(x.page)) === 'stepUp', 10000);
      const prompt = await x.page.locator('[data-notice]').first().textContent().catch(() => '');
      check(`[${lang}] removing with an old sign-in: "confirm it is you" in ${lang} (the core answered insufficient_user_authentication)`, (await notice(x.page)) === 'stepUp' && LANG[lang].script.test(prompt ?? ''));
      await x.page.locator('[data-testid=step-up]').click();
      await x.page.waitForURL((u) => u.href.startsWith(KC), { timeout: 10000 }).catch(() => undefined);
      const steps = await keycloakSignIn(x.page, who);
      await waitFor(async () => (await notice(x.page)) === 'stepUpDone', 15000);
      check(`[${lang}] re-authentication at Keycloak (${steps}) returns to the security page`, (await notice(x.page)) === 'stepUpDone', x.page.url().slice(0, 160));
      const after = (await sessionCookie(x))?.value;
      await x.page.locator('[data-testid=remove-totp]').click();
      await waitFor(async () => (await notice(x.page)) === 'removed', 10000);
      const kinds = await x.page.locator('[data-testid=authenticators] > li').evaluateAll((els) => els.map((e) => e.getAttribute('data-kind')));
      check(`[${lang}] after re-authentication the removal works; a new session id was issued (no fixation)`, kinds.join() === 'passkey' && !!before[lang].cookie && !!after && before[lang].cookie !== after, `${kinds}`);
    }

    stamp('web security: cookies, tokens, server actions from another origin, Content Security Policy');
    const lang = LOCALES.includes('en') ? 'en' : LOCALES[0];
    const { x } = signedIn[lang];
    const sc = await sessionCookie(x);
    check('session cookie: HttpOnly, SameSite=Strict, Secure, path /, no lifetime (ends with the browser)',
      sc && sc.httpOnly && sc.sameSite === 'Strict' && sc.secure && sc.path === '/' && sc.expires === -1, JSON.stringify({ ...sc, value: undefined }));
    // Cookies the browser sends to the web app (in this test Keycloak is also on localhost, with its own cookies under /realms/).
    const sent = await x.context.cookies([`${WEB}/`, `${WEB}/${lang}/security`, `${WEB}/auth/callback`]);
    const storage = await x.page.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }));
    const page = await x.page.content();
    const jwt = /eyJ[A-Za-z0-9_-]{10,}\./;
    const where = [...sent.filter((c) => jwt.test(c.value)).map((c) => `cookie ${c.name}`), ...(jwt.test(storage) ? ['storage'] : []), ...(jwt.test(page) ? ['page'] : [])];
    check('no token anywhere the web app\'s pages can reach (its cookies, storage, page)', where.length === 0, where.join(', '));
    const res = await fetch(`${WEB}/${lang}/security`, { headers: { cookie: `${sc.name}=${sc.value}` }, redirect: 'manual' });
    const csp = res.headers.get('content-security-policy') ?? '';
    const body = await res.text();
    check('strict Content Security Policy: scripts by nonce only, no inline, no framing; no-referrer',
      /script-src 'self' 'nonce-[^']+' 'strict-dynamic'/.test(csp) && !/unsafe-inline/.test(csp) && /frame-ancestors 'none'/.test(csp) && res.headers.get('referrer-policy') === 'no-referrer', csp);
    const actionField = (body.match(/name="(\$ACTION_ID_[0-9a-f]+)"/) ?? [])[1];
    const form = new FormData();
    if (actionField) form.append(actionField, '');
    form.append('lang', lang);
    const forged = await fetch(`${WEB}/${lang}`, { method: 'POST', body: form, redirect: 'manual', headers: { cookie: `${sc.name}=${sc.value}`, origin: 'http://attacker.invalid' } });
    const still = await fetch(`${WEB}/${lang}/security`, { headers: { cookie: `${sc.name}=${sc.value}` }, redirect: 'manual' });
    check('a server action posted from another origin (CSRF) is refused; the session survives', !!actionField && forged.status >= 400 && still.status === 200, `${actionField} ${forged.status} ${still.status}`);
    for (const l of LOCALES) await signOutChecks(signedIn[l].x, l, signedIn[l].who);

    const opened = [];
    for (const ml of LOCALES) {
      stamp(`[${ml}] mandates and acting on behalf of the principal (P3-F6)`);
      const principal = await citizen(browser, ml);
      const agent = await citizen(browser, ml);
      const p = await newContext(browser, ml);
      const a = await newContext(browser, ml);
      opened.push(p, a);
      await webSignIn(p, ml, principal);
      await webSignIn(a, ml, agent);
      await p.page.goto(`${WEB}/${ml}/mandates`);
      await p.page.locator('[data-scope="cases:read"]').check();
      await p.page.locator('[data-scope="payments:read"]').check();
      await p.page.locator('[data-testid=mandate-submit]').click();
      await waitFor(() => visible(p.page, '[data-testid=mandate-code]'), 10000);
      const mandateId = await p.page.locator('[data-testid=mandate-id]').textContent();
      const code = await p.page.locator('[data-testid=mandate-invitation]').textContent();
      await p.page.reload();
      const shownOnce = !(await visible(p.page, '[data-testid=mandate-code]'));
      check(`[${ml}] the principal gives a mandate: id and one-time code shown once (not in the URL, gone after reload)`, /^[0-9a-f-]{36}$/.test(mandateId ?? '') && /^[A-Za-z0-9_-]{43}$/.test(code ?? '') && shownOnce && !p.page.url().includes(code));
      await a.page.goto(`${WEB}/${ml}/mandates`);
      await a.page.locator('[data-testid=accept-id]').fill(mandateId);
      await a.page.locator('[data-testid=accept-code]').fill(code);
      await a.page.locator('[data-testid=accept-submit]').click();
      await waitFor(async () => (await notice(a.page)) === 'mandateAccepted', 10000);
      await a.page.locator(`[data-mandate="${mandateId}"] [data-testid=act]`).click();
      await waitFor(() => visible(a.page, '[data-testid=acting-banner]'), 10000);
      const banner = await a.page.locator('[data-testid=acting-banner]').textContent();
      check(`[${ml}] the agent accepts and acts on behalf of the principal: banner with the scopes in ${ml}`, LANG[ml].script.test(banner ?? '') && (banner ?? '').includes(mandateId.slice(0, 8)), banner);
      await p.page.goto(`${WEB}/${ml}/mandates`);
      const events = await p.page.locator(`[data-mandate="${mandateId}"] [data-action]`).evaluateAll((els) => els.map((e) => e.getAttribute('data-action')));
      check(`[${ml}] the principal sees it in the mandate's history (created, accepted, acted)`, events.join() === 'created,accepted,acted', String(events));
      await a.page.locator('[data-testid=stop-acting]').click();
      await waitFor(async () => (await notice(a.page)) === 'actingStopped', 10000);
      check(`[${ml}] the agent stops acting: banner gone`, !(await visible(a.page, '[data-testid=acting-banner]')));
      await p.page.locator(`[data-mandate="${mandateId}"] [data-testid=revoke]`).click();
      await waitFor(async () => (await notice(p.page)) === 'mandateRevoked', 10000);
      await a.page.goto(`${WEB}/${ml}/mandates`);
      check(`[${ml}] after the principal revokes, the agent can no longer act`, !(await visible(a.page, `[data-mandate="${mandateId}"] [data-testid=act]`)));
    }

    for (const il of LOCALES) {
      stamp(`[${il}] identity link through the web app and the SIMULATED eID`);
      const owner = await citizen(browser, il);
      const nationalId = `99${String(crypto.randomInt(0, 1_000_000)).padStart(6, '0')}`;
      const eidUser = { username: `eid.web.${tag()}`, password: pw() };
      await admin('POST', 'sim-national-eid/users', { username: eidUser.username, enabled: true, attributes: { national_id: [nationalId], loa: ['substantial'] }, credentials: [{ type: 'password', value: eidUser.password, temporary: false }] });
      createdEid.push(nationalId);
      const e = await newContext(browser, il);
      opened.push(e);
      await webSignIn(e, il, owner);
      await e.page.goto(`${WEB}/${il}/identity`);
      const simulatedNotice = await e.page.locator('.notice-info').first().textContent();
      await e.page.locator('[data-testid=eid-link]').click();
      await waitFor(() => visible(e.page, '#username'), 10000);
      const eidPage = await pageLanguage(e.page);
      await e.page.locator('#username').fill(eidUser.username);
      await e.page.locator('#password').fill(eidUser.password);
      await submit(e.page);
      await waitFor(async () => (await notice(e.page)) === 'eidLinked', 15000);
      const linked = await e.page.locator('[data-testid=identity-state]').getAttribute('data-linked');
      check(`[${il}] the page says the eID is simulated; the simulator in ${il}; back on the app: linked (level substantial)`,
        LANG[il].script.test(simulatedNotice ?? '') && eidPage.lang === il && linked === 'yes', JSON.stringify({ eidPage, linked }));
    }
    for (const ctx of opened) await ctx.context.close();
  } finally {
    await browser.close();
    if (process.env.EID_IDS_OUT && createdEid.length) fs.appendFileSync(process.env.EID_IDS_OUT, createdEid.join('\n') + '\n');
  }
  stamp(lib.failures() ? `${lib.failures()} check(s) FAILED` : 'all web app checks passed');
  process.exit(lib.failures() ? 1 : 0);
})().catch((err) => {
  console.error(`  FAIL ${err.stack || err}`);
  process.exit(1);
});
