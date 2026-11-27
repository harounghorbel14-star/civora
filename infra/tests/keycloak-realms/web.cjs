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
  submit, activate, tag, pw, pageLanguage, recoveryMails } = lib;

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

/** One attempt on Keycloak's sign-in page from the web app: the password, then (if asked) a code; never completes on purpose. */
async function keycloakAttempt(x, lang, who, password, code) {
  await x.page.goto(`${WEB}/${lang}`);
  await x.page.locator('[data-testid=sign-in]').first().click();
  await x.page.waitForURL((u) => u.href.startsWith(KC), { timeout: 10000 }).catch(() => undefined);
  await waitFor(() => visible(x.page, '#password'), 10000);
  if (await visible(x.page, '#username')) await x.page.locator('#username').fill(who.email);
  await x.page.locator('#password').fill(password);
  await submit(x.page);
  if (code !== undefined && await waitFor(() => visible(x.page, '#otp'), 10000)) {
    await x.page.locator('#otp').fill(code);
    await submit(x.page);
  }
  await sleep(500);
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
/**
 * Headers for a request from Node that is the same browser as context x: its session and device cookies and its
 * User-Agent. The adaptive controls (doc phase-3/15) end a session used from any other browser.
 */
async function asBrowser(x) {
  const cookie = (await x.context.cookies(WEB)).filter((c) => /civora_(session|device)$/.test(c.name)).map((c) => `${c.name}=${c.value}`).join('; ');
  return { cookie, 'user-agent': await x.page.evaluate(() => navigator.userAgent) };
}
const G3_MAIL = lib.NOTICE;
const mailMatching = lib.mailMatching;

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

    stamp('status page code by SMS to the number on file (simulated SMS, register entry M-01; synthetic numbers only)');
    {
      const kase = dataset.cases[LOCALES.length];
      const phone = dataset.customers.find((c) => c.id === kase.customerId).phone;
      const box = `sms.${phone.replace(/\D/g, '')}@sms.civora-cell.invalid`;
      const before = (await mails(box)).length;
      const st = await core(undefined, '/v1/status-access', post({ reference: kase.reference, locale: 'fr-TN', channel: 'sms' }));
      const code = await statusCode(box, before);
      const shown = st.status === 202 && code ? await core(undefined, `/v1/status-access/${st.body.challengeId}:verify`, post({ reference: kase.reference, code })) : { status: 0 };
      const bad = await core(undefined, '/v1/status-access', post({ reference: kase.reference, channel: 'pigeon' }));
      check('the code goes by SMS to the phone on file when asked (simulated), and shows the status; an unknown channel: 400',
        st.status === 202 && !!code && shown.status === 200 && shown.body?.reference === kase.reference && bad.status === 400, `${st.status} ${!!code} ${shown.status} ${bad.status}`);
    }

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
    const dc = (await x.context.cookies(WEB)).find((c) => /civora_device$/.test(c.name));
    check('device cookie (adaptive controls): HttpOnly, SameSite=Lax, Secure, path /, about 400 days, a random id',
      dc && dc.httpOnly && dc.sameSite === 'Lax' && dc.secure && dc.path === '/' && dc.expires > Date.now() / 1000 + 399 * 86400 && /^[A-Za-z0-9_-]{43}$/.test(dc.value), JSON.stringify({ ...dc, value: undefined }));
    const res = await fetch(`${WEB}/${lang}/security`, { headers: await asBrowser(x), redirect: 'manual' });
    const csp = res.headers.get('content-security-policy') ?? '';
    const body = await res.text();
    check('strict Content Security Policy: scripts by nonce only, no inline, no framing; no-referrer',
      /script-src 'self' 'nonce-[^']+' 'strict-dynamic'/.test(csp) && !/unsafe-inline/.test(csp) && /frame-ancestors 'none'/.test(csp) && res.headers.get('referrer-policy') === 'no-referrer', csp);
    const actionField = (body.match(/name="(\$ACTION_ID_[0-9a-f]+)"/) ?? [])[1];
    const form = new FormData();
    if (actionField) form.append(actionField, '');
    form.append('lang', lang);
    const forged = await fetch(`${WEB}/${lang}`, { method: 'POST', body: form, redirect: 'manual', headers: { ...(await asBrowser(x)), origin: 'http://attacker.invalid' } });
    const still = await fetch(`${WEB}/${lang}/security`, { headers: await asBrowser(x), redirect: 'manual' });
    check('a server action posted from another origin (CSRF) is refused; the session survives', !!actionField && forged.status >= 400 && still.status === 200, `${actionField} ${forged.status} ${still.status}`);
    for (const l of LOCALES) await signOutChecks(signedIn[l].x, l, signedIn[l].who);

    const opened = [];
    for (const gl of LOCALES) {
      stamp(`[${gl}] adaptive controls (G3, doc 15): a new device is announced; a session used from another browser is ended`);
      const who = await citizen(browser, gl);
      const A = await newContext(browser, gl);
      const B = await newContext(browser, gl);
      const H = await newContext(browser, gl);
      opened.push(A, B, H);
      await webSignIn(A, gl, who);
      await A.page.goto(`${WEB}/${gl}/security`);
      const base = (await mails(who.email)).length;
      const quietFirst = !(await mailMatching(who.email, 0, G3_MAIL[gl].newDevice, 3000));
      await webSignIn(B, gl, who);
      await B.page.goto(`${WEB}/${gl}/security`);
      const announced = await mailMatching(who.email, base, G3_MAIL[gl].newDevice);
      check(`[${gl}] first device: no notice; a sign-in from a second browser: "new sign-in" e-mail in ${gl}, naming the browser`,
        quietFirst && !!announced && LANG[gl].script.test(announced.subject) && /Chrome · Linux/.test(announced.text), JSON.stringify({ quietFirst, subject: announced?.subject }));
      const stolen = (await B.context.cookies(WEB)).find((c) => /civora_session$/.test(c.name));
      await H.context.addCookies([{ name: stolen.name, value: stolen.value, url: WEB, httpOnly: true, secure: stolen.secure, sameSite: 'Strict' }]);
      const before = (await mails(who.email)).length;
      await H.page.goto(`${WEB}/${gl}/security`);
      const thiefRefused = H.page.url().startsWith(KC) && !(await visible(H.page, '[data-testid=sign-out]'));
      await B.page.goto(`${WEB}/${gl}/security`);
      const ownerAsked = B.page.url().startsWith(KC) && (await visible(B.page, '#username, #password'));
      const ended = await mailMatching(who.email, before, G3_MAIL[gl].ended);
      const kcUser = (await admin('GET', `civora-citizens/users?exact=true&email=${encodeURIComponent(who.email)}`))[0];
      const kcSessions = await admin('GET', `civora-citizens/users/${kcUser.id}/sessions`);
      await A.page.goto(`${WEB}/${gl}/security`);
      const otherGoesOn = await visible(A.page, '[data-testid=sign-out]');
      check(`[${gl}] a session cookie copied to another browser: refused there, the session ended (also at Keycloak: its owner must sign in again), "session ended" e-mail in ${gl}; the other session goes on`,
        thiefRefused && ownerAsked && !!ended && LANG[gl].script.test(ended.subject) && kcSessions.length === 1 && otherGoesOn,
        JSON.stringify({ thiefRefused, ownerAsked, ended: ended?.subject, kcSessions: kcSessions.length, otherGoesOn, h: H.page.url().slice(0, 80) }));

      stamp(`[${gl}] sign-in event notices (G1, doc 15 §7): a failed second step, a sign-in after failures, a way to sign in added`);
      const P = await newContext(browser, gl);
      const Q = await newContext(browser, gl);
      opened.push(P, Q);
      const beforePartial = (await mails(who.email)).length;
      await keycloakAttempt(P, gl, who, who.password, '000000');
      const partial = await mailMatching(who.email, beforePartial, G3_MAIL[gl].secondStep, 20000);
      check(`[${gl}] right password, wrong authenticator code: "second step failed" e-mail in ${gl}, naming the authenticator app`,
        !!partial && LANG[gl].script.test(partial.subject), partial?.subject);
      for (let i = 0; i < 3; i++) { await keycloakAttempt(Q, gl, who, `${who.password}-wrong`); await sleep(1100); }
      const beforeAfter = (await mails(who.email)).length;
      await webSignIn(Q, gl, who);
      const after = await mailMatching(who.email, beforeAfter, G3_MAIL[gl].afterFailures, 20000);
      check(`[${gl}] a sign-in after failed attempts: e-mail in ${gl} with the number of failures (4: the failed second step and 3 wrong passwords)`,
        !!after && LANG[gl].script.test(after.subject) && /4/.test(after.text), JSON.stringify({ subject: after?.subject, text: after?.text?.slice(0, 160) }));
      const journeyUser = signedIn[gl]?.who;
      const added = journeyUser ? await mailMatching(journeyUser.email, 0, G3_MAIL[gl].added, 20000) : null;
      check(`[${gl}] a passkey added from the web app (Keycloak's page, inside a sign-in): "a way to sign in was added" e-mail in ${gl}; none at activation`,
        !!added && LANG[gl].script.test(added.subject) && !(await mailMatching(who.email, 0, G3_MAIL[gl].added, 1000)), added?.subject);
    }

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

      stamp(`[${il}] account recovery through the web app and the SIMULATED eID (P3-SEC4)`);
      const rc = await newContext(browser, il);
      opened.push(rc);
      const before = (await mails(owner.email)).length;
      await rc.page.goto(`${WEB}/${il}`);
      await rc.page.locator('[data-testid=recover-link]').click();
      await waitFor(() => visible(rc.page, '[data-testid=recover-start]'), 10000);
      const recoverPage = await html(rc.page);
      await rc.page.locator('[data-testid=recover-start]').click();
      await waitFor(() => visible(rc.page, '#username'), 10000);
      const eidAgain = await pageLanguage(rc.page);
      await rc.page.locator('#username').fill(eidUser.username);
      await rc.page.locator('#password').fill(eidUser.password);
      await submit(rc.page);
      await waitFor(async () => (await notice(rc.page)) === 'recoveryRequested', 15000);
      const answered = await notice(rc.page);
      const got = await recoveryMails(owner.email, before);
      check(`[${il}] recovery: page and simulator in ${il}; the same answer whether or not an account exists; an activation link and a notice in ${il} reach the account's address`,
        recoverPage.lang === PACK[il] && eidAgain.lang === il && answered === 'recoveryRequested' && !!got.activation?.link && !!got.notice && LANG[il].script.test(got.notice.subject),
        JSON.stringify({ page: recoverPage.lang, eid: eidAgain.lang, answered, notice: got.notice?.subject, activation: !!got.activation }));
      const kcUser = (await admin('GET', `civora-citizens/users?exact=true&email=${encodeURIComponent(owner.email)}`))[0];
      const left = await admin('GET', `civora-citizens/users/${kcUser.id}/credentials`);
      const kcSessions = await admin('GET', `civora-citizens/users/${kcUser.id}/sessions`);
      check(`[${il}] after recovery: no old way to sign in left, every Keycloak session ended`, left.length === 0 && kcSessions.length === 0, `${left.length} ${kcSessions.length}`);
      const again = await newContext(browser, il);
      opened.push(again);
      const act2 = got.activation?.link ? await activate(again.page, got.activation.link) : { seen: [], langs: [] };
      const fresh = await newContext(browser, il);
      opened.push(fresh);
      const back = act2.password ? await webSignIn(fresh, il, { email: owner.email, password: act2.password, secret: act2.secret }) : { ok: false };
      check(`[${il}] the link sets new ways to sign in in ${il} (authenticator app, then password); signed in again through the web app`,
        act2.seen.join('>') === 'TOTP>PASSWORD' && act2.langs.every((l) => l === il) && !!back.ok, JSON.stringify({ seen: act2.seen, langs: act2.langs, ok: back.ok }));
    }
    for (const ctx of opened) await ctx.context.close();

    // Contact details and recovery R4 (decisions of 27 Nov 2026; doc phase-3/16), in every language.
    const CONTACT = {
      ar: { code: /رمز تأكيد عنوانك/, old: /تغيّر عنوان البريد الإلكتروني/, now: /صار عنوان حسابك/, phone: /أُضيف أو غُيّر رقم الهاتف/, removed: /أُزيل رقم الهاتف/, link: /^استعادة حسابك في CIVORA$/, recovered: /تمت استعادة حسابك/ },
      fr: { code: /Code de confirmation/, old: /a changé/, now: /désormais celle/, phone: /numéro de téléphone a été ajouté/, removed: /numéro de téléphone a été retiré/, link: /^Récupération de votre compte/, recovered: /a été récupéré/ },
      en: { code: /Code to confirm/, old: /e-mail address of your CIVORA account changed/, now: /now the address/, phone: /phone number was added/, removed: /phone number was removed/, link: /^Recovering your CIVORA account/, recovered: /was recovered/ },
    };
    const smsBox = (phone) => `sms.${phone.replace(/\D/g, '')}@sms.civora-cell.invalid`;
    const sixDigits = (text) => ((text ?? '').match(/(\d{6})/) ?? [])[1];
    /** Runs a security-page action; if the core asks for a recent sign-in, confirms it is the person and runs it again. */
    async function withStepUp(x, cl, who, act, expect) {
      await act();
      let n = await waitFor(async () => { const v = await notice(x.page); return v && (v === 'stepUp' || expect.includes(v)) ? v : null; }, 15000);
      if (n === 'stepUp') {
        await x.page.locator('[data-testid=step-up]').click();
        await x.page.waitForURL((u) => u.href.startsWith(KC), { timeout: 10000 }).catch(() => undefined);
        await keycloakSignIn(x.page, who);
        await waitFor(async () => (await notice(x.page)) === 'stepUpDone', 15000);
        await act();
        n = await waitFor(async () => { const v = await notice(x.page); return v && expect.includes(v) ? v : null; }, 15000);
      }
      return n;
    }
    const opened2 = [];
    for (const cl of LOCALES) {
      stamp(`[${cl}] contact details (doc 16): the e-mail address changes with a code sent to the new one; the old one is told`);
      let who = await citizen(browser, cl);
      const x = await newContext(browser, cl);
      opened2.push(x);
      await webSignIn(x, cl, who);
      await x.page.goto(`${WEB}/${cl}/security`);
      const shown = (await x.page.locator('[data-testid=contact-email]').textContent())?.trim();
      const moved = `moved.${cl}.${tag()}@example.invalid`;
      const sentNotice = await withStepUp(x, cl, who, async () => {
        await x.page.goto(`${WEB}/${cl}/security`);
        await x.page.locator('[data-testid=contact-new-email]').fill(moved);
        await x.page.locator('[data-testid=contact-change-email]').click();
      }, ['codeSent', 'error', 'invalid']);
      const codeMail = await mailMatching(moved, 0, CONTACT[cl].code);
      const code = sixDigits(codeMail?.text);
      const oldBefore = (await mails(who.email)).length;
      await x.page.locator('[data-testid=contact-code]').fill(code === '000000' ? '111111' : '000000');
      await x.page.locator('[data-testid=contact-code-confirm]').click();
      const wrong = await waitFor(async () => ((await notice(x.page)) === 'wrongCode' ? 'wrongCode' : null), 10000);
      const unchanged = (await lib.userByEmail('civora-citizens', who.email))?.email === who.email;
      await x.page.locator('[data-testid=contact-code]').fill(code ?? '');
      await x.page.locator('[data-testid=contact-code-confirm]').click();
      const changed = await waitFor(async () => ((await notice(x.page)) === 'emailChanged' ? 'emailChanged' : null), 15000);
      const toOld = await mailMatching(who.email, oldBefore, CONTACT[cl].old);
      const toNew = await mailMatching(moved, 0, CONTACT[cl].now);
      const kcUser = await lib.userByEmail('civora-citizens', moved);
      check(`[${cl}] e-mail change: shown on the security page; a code in ${cl} to the NEW address; a wrong code changes nothing; with the code the address (and the username) change; the OLD address is told in ${cl}, with the new one masked; the new one is welcomed`,
        shown === who.email && sentNotice === 'codeSent' && !!code && wrong === 'wrongCode' && unchanged && changed === 'emailChanged' && LANG[cl].script.test(codeMail?.subject ?? '')
          && !!toOld && toOld.text.includes(`${moved[0]}•••@example.invalid`) && !toOld.text.includes(moved) && !!toNew
          && kcUser?.username === moved && kcUser?.emailVerified === true && (x.page.url().endsWith('notice=emailChanged')),
        JSON.stringify({ shown, sentNotice, code: !!code, wrong, unchanged, changed, old: toOld?.subject, now: toNew?.subject, username: kcUser?.username }));
      who = { ...who, email: moved };

      stamp(`[${cl}] contact details: a phone number confirmed with an SMS code`);
      const phone = `+2160${String(crypto.randomInt(0, 10_000_000)).padStart(7, '0')}`;
      const mailBefore = (await mails(moved)).length;
      const phoneSent = await withStepUp(x, cl, who, async () => {
        await x.page.goto(`${WEB}/${cl}/security`);
        await x.page.locator('[data-testid=contact-new-phone]').fill(phone);
        await x.page.locator('[data-testid=contact-change-phone]').click();
      }, ['codeSent', 'error', 'invalid', 'notDeliverable']);
      const sms = await mailMatching(smsBox(phone), 0, /SMS/);
      await x.page.locator('[data-testid=contact-code]').fill(sixDigits(sms?.text) ?? '');
      await x.page.locator('[data-testid=contact-code-confirm]').click();
      const verified = await waitFor(async () => ((await notice(x.page)) === 'phoneVerified' ? 'phoneVerified' : null), 15000);
      const listed = (await x.page.locator('[data-testid=contact-phone]').textContent())?.trim();
      const phoneMail = await mailMatching(moved, mailBefore, CONTACT[cl].phone);
      const attrs = (await admin('GET', `civora-citizens/users/${kcUser.id}`)).attributes ?? {};
      check(`[${cl}] phone: an SMS code (simulated, in ${cl}) to the new number; with it the number is verified, shown, and the account address told (last two digits only)`,
        phoneSent === 'codeSent' && !!sms && LANG[cl].script.test(sms.text) && verified === 'phoneVerified' && listed === phone && !!phoneMail
          && phoneMail.text.includes(phone.slice(-2)) && !phoneMail.text.includes(phone.slice(1))
          && attrs.phone_number?.[0] === phone && attrs.phone_number_verified?.[0] === 'true',
        JSON.stringify({ phoneSent, sms: !!sms, verified, listed, mail: phoneMail?.subject, attrs: Object.keys(attrs) }));

      stamp(`[${cl}] recovery R4 (doc 16): the e-mailed link AND an SMS code; then every way to sign in is reset`);
      const r = await newContext(browser, cl);
      opened2.push(r);
      const nobody = `nobody.${cl}.${tag()}@example.invalid`;
      await r.page.goto(`${WEB}/${cl}/recover`);
      await r.page.locator('[data-testid=recover-contact-email]').fill(nobody);
      await r.page.locator('[data-testid=recover-contact-start]').click();
      const answerUnknown = await waitFor(async () => notice(r.page), 10000);
      const beforeLink = (await mails(moved)).length;
      const smsBefore = (await mails(smsBox(phone))).length;
      await r.page.goto(`${WEB}/${cl}/recover`);
      await r.page.locator('[data-testid=recover-contact-email]').fill(moved);
      await r.page.locator('[data-testid=recover-contact-start]').click();
      const answerKnown = await waitFor(async () => notice(r.page), 10000);
      const linkMail = await mailMatching(moved, beforeLink, CONTACT[cl].link);
      const link = ((linkMail?.text ?? '').match(/https?:\/\/\S+recover-link\S+/) ?? [])[0];
      await sleep(1500);
      const noSmsYet = (await mails(smsBox(phone))).length === smsBefore && (await mails(nobody)).length === 0;
      const attempt = link ? new URL(link).searchParams.get('a') : null;
      if (link) await r.page.goto(link);
      await waitFor(() => visible(r.page, '[data-testid=recover-phone-send]'), 10000);
      const clean = r.page.url() === `${WEB}/${cl}/recover/phone`;
      await r.page.locator('[data-testid=recover-phone-send]').click();
      await waitFor(async () => ((await notice(r.page)) === 'recoveryCodeSent' ? 1 : null), 10000);
      const ending = (await r.page.locator('[data-testid=recover-phone-sent]').textContent().catch(() => '')) ?? '';
      const recSms = await mailMatching(smsBox(phone), smsBefore, /SMS/);
      const recCode = sixDigits(recSms?.text);
      const wrongLink = await core(undefined, `/v1/recovery/contact/${attempt}:complete`, post({ token: 'x'.repeat(43), code: recCode }));
      const credsBefore = (await admin('GET', `civora-citizens/users/${kcUser.id}/credentials`)).length;
      const beforeDone = (await mails(moved)).length;
      await r.page.locator('[data-testid=recover-phone-code]').fill(recCode ?? '');
      await r.page.locator('[data-testid=recover-phone-complete]').click();
      const done = await waitFor(async () => ((await notice(r.page)) === 'recoveryRequested' ? 1 : null), 15000);
      const got = await recoveryMails(moved, beforeDone);
      const recoveredSms = await waitFor(async () => {
        const list = await mails(smsBox(phone));
        if (list.length < smsBefore + 2) return null;
        const text = (await (await fetch(`${process.env.MAIL_URL}/api/v1/message/${list[0].ID}`)).json()).Text;
        return CONTACT[cl].recovered.test(text) ? text : null;
      }, 10000);
      const credsAfter = await admin('GET', `civora-citizens/users/${kcUser.id}/credentials`);
      const kcSessions = await admin('GET', `civora-citizens/users/${kcUser.id}/sessions`);
      check(`[${cl}] recovery R4: the same answer for an unknown address (nothing sent); a link in ${cl} to the account's address and no SMS before it is followed; the link leaves no token in the address bar`,
        answerUnknown === 'recoveryLinkSent' && answerKnown === 'recoveryLinkSent' && !!link && noSmsYet && clean && LANG[cl].script.test(linkMail?.subject ?? ''),
        JSON.stringify({ answerUnknown, answerKnown, link: !!link, noSmsYet, url: r.page.url() }));
      check(`[${cl}] recovery R4: an SMS code in ${cl} to the verified number (its last two digits on the page); the code without the link token: refused (404); with both: every way to sign in removed, every session ended, a set-up link and a notice by e-mail and SMS`,
        !!recCode && ending.includes(phone.slice(-2)) && wrongLink.status === 404 && credsBefore > 0 && !!done && credsAfter.length === 0 && kcSessions.length === 0
          && !!got.activation?.link && CONTACT[cl].recovered.test(got.notice?.subject ?? '') && !!recoveredSms,
        JSON.stringify({ code: !!recCode, ending, wrongLink: wrongLink.status, credsBefore, done, after: credsAfter.length, sessions: kcSessions.length, activation: !!got.activation, notice: got.notice?.subject, sms: !!recoveredSms }));
      const again = await newContext(browser, cl);
      opened2.push(again);
      const act = got.activation?.link ? await activate(again.page, got.activation.link) : {};
      const back = act.password ? await webSignIn(again, cl, { email: moved, password: act.password, secret: act.secret }) : { ok: false };
      who = { email: moved, password: act.password, secret: act.secret };
      let removed = null;
      let removedMail = null;
      if (back.ok) {
        const beforeRemove = (await mails(moved)).length;
        removed = await withStepUp(again, cl, who, async () => {
          await again.page.goto(`${WEB}/${cl}/security`);
          await again.page.locator('[data-testid=contact-remove-phone]').click();
        }, ['phoneRemoved', 'error']);
        removedMail = await mailMatching(moved, beforeRemove, CONTACT[cl].removed);
      }
      const attrsAfter = (await admin('GET', `civora-citizens/users/${kcUser.id}`)).attributes ?? {};
      check(`[${cl}] after R4: new ways to sign in set from the link, signed in again; the phone number removed with a notice in ${cl}`,
        !!back.ok && removed === 'phoneRemoved' && !!removedMail && !attrsAfter.phone_number,
        JSON.stringify({ ok: back.ok, removed, mail: removedMail?.subject, attrs: Object.keys(attrsAfter) }));
    }
    for (const ctx of opened2) await ctx.context.close();
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
