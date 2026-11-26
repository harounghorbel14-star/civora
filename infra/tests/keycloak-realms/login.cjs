'use strict';
/**
 * Real logins in a real browser against the CIVORA citizens and staff realms (Keycloak 26.8.1), with WebAuthn
 * virtual authenticators, e-mail through a local mail catcher, and the core verifying the tokens Keycloak issues.
 * Journeys run in every locale of the cell (Arabic, French, English); the security checks run once.
 * Synthetic users only, random passwords per run; nothing is stored.
 *
 * Environment: KC_URL, CORE_URL, MAIL_URL, KC_ADMIN_PASSWORD, ARTIFACT_DIR, LOCALES (default "ar,fr,en").
 */
const { chromium } = require('playwright');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const lib = require('./lib.cjs');
const {
  KC, CORE, MAIL, ARTIFACTS, LOCALES, WEB_CB, WS_CB, RP1_CB, RP2_CB, TENANT, TEST_AAGUID, POLICY, LANG, check, info, stamp, b64url, rnd, tag, claims, pw, sleep, median, form, refreshAdmin, admin, credentialTypes, userByEmail, freshTotp, mails, activationMail, newContext, addAuthenticator, authorize, waitFor, codeFrom, exchange, core, visible, submit, shot, pageLanguage, choosePasskey, activate,
 TEST_APP } = lib;

async function citizenJourney(browser, lang) {
  const L = LANG[lang];
  stamp(`citizen journey in ${lang}: registration through the core, activation link, password + TOTP, passkey`);
  const email = `citizen.${lang}.${tag()}@example.invalid`;
  const reg = await core(undefined, '/v1/registrations', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, locale: L.pack }) });
  check(`[${lang}] registration answered 202 {"status":"accepted"}`, reg.status === 202 && reg.body?.status === 'accepted', `${reg.status} ${reg.raw}`);
  const mail = await activationMail(email);
  check(`[${lang}] activation e-mail received, subject in ${lang}`, !!mail?.link && L.script.test(mail.subject), JSON.stringify(mail));
  const user = await userByEmail('civora-citizens', email);
  check(`[${lang}] account created by the core WITHOUT any credential before activation`, !!user && (await credentialTypes('civora-citizens', user.id)).length === 0);
  const { page, context, captured } = await newContext(browser, lang);
  await addAuthenticator(page, 'internal');
  const act = mail?.link ? await activate(page, mail.link) : { seen: [] };
  const lp = await pageLanguage(page);
  check(`[${lang}] activation pages in ${lang} (lang=${lp.lang}, dir=${lp.dir})`, lp.lang === lang && lp.dir === L.dir, JSON.stringify(lp));
  check(`[${lang}] activation asks the second factor BEFORE the password (TOTP > PASSWORD)`, act.seen.join('>') === 'TOTP>PASSWORD', act.seen.join('>'));
  const u2 = await admin('GET', `civora-citizens/users/${user.id}`);
  check(`[${lang}] after activation: password + otp, e-mail verified by the link`, (await credentialTypes('civora-citizens', user.id)).join() === 'otp,password' && u2.emailVerified === true);

  // Login page in the citizen's language; e-mail and password on one page, then the TOTP code.
  let a = authorize(page, 'civora-citizens', TEST_APP, WEB_CB, { ui_locales: lang });
  let n = captured.length;
  await context.clearCookies();
  await a.go();
  const login = await pageLanguage(page);
  check(`[${lang}] login page: lang=${lang}, dir=${L.dir}, realm name and button translated`,
    login.lang === lang && login.dir === L.dir && login.header === L.citizens && L.script.test(login.button) && (lang === 'en' || login.button !== 'Sign In') && !login.title.includes('${'),
    JSON.stringify(login));
  await page.locator('#username').fill(email);
  await page.locator('#password').fill(act.password);
  await submit(page);
  if (await waitFor(() => visible(page, '#otp'), 8000)) {
    await page.locator('#otp').fill(await freshTotp(act.secret));
    await submit(page);
  }
  let code = await codeFrom(captured, n);
  let tok = code ? await exchange('civora-citizens', TEST_APP, code, a.verifier, WEB_CB) : { body: {} };
  if (!check(`[${lang}] login with password + TOTP: tokens issued`, !!tok.body.access_token, JSON.stringify(tok.body))) await shot(page, `citizen-${lang}-login`);
  const me = tok.body.access_token ? await core(tok.body.access_token) : { status: 0, body: {} };
  check(`[${lang}] core accepts the token; preferred locale stored as the pack locale ${L.pack}`, me.status === 200 && me.body.preferredLocale === L.pack, `${me.status} ${me.raw}`);

  // Passkey added from the app, then used alone in a new session.
  a = authorize(page, 'civora-citizens', TEST_APP, WEB_CB, { kc_action: 'webauthn-register-passwordless', ui_locales: lang });
  n = captured.length;
  await a.go();
  if (await waitFor(() => visible(page, '#registerWebAuthn'), 10000)) await page.locator('#registerWebAuthn').click();
  await codeFrom(captured, n);
  check(`[${lang}] passkey added from the app`, (await credentialTypes('civora-citizens', user.id)).includes('webauthn-passwordless'));
  await context.clearCookies();
  a = authorize(page, 'civora-citizens', TEST_APP, WEB_CB, { ui_locales: lang });
  n = captured.length;
  await a.go();
  if (await choosePasskey(page)) await page.locator('#authenticateWebAuthnButton').click();
  code = await codeFrom(captured, n);
  tok = code ? await exchange('civora-citizens', TEST_APP, code, a.verifier, WEB_CB) : { body: {} };
  const me2 = tok.body.access_token ? await core(tok.body.access_token) : { body: {} };
  if (!check(`[${lang}] passkey alone signs in (no username typed first); same person`, me2.body?.id === me.body?.id && !!me.body?.id, `${me2.status}`)) await shot(page, `citizen-${lang}-passkey`);
  return { email, password: act.password, secret: act.secret, userId: user.id, page, context, captured };
}

async function staffJourney(browser, lang) {
  const L = LANG[lang];
  stamp(`officer journey in ${lang}: invitation link, security key BEFORE password, login with password + key`);
  const email = `officer.${lang}.${tag()}@example.invalid`;
  // What the tenant administrator's "invite" does (week 3 API): an account with no credential, and the invitation link.
  const id = await admin('POST', 'civora-staff/users', { username: email, email, enabled: true, firstName: 'Synthetic', lastName: 'Officer', attributes: { tenant_id: [TENANT], locale: [lang] } });
  await admin('PUT', `civora-staff/users/${id}/execute-actions-email?lifespan=43200&client_id=civora-workspace&redirect_uri=${encodeURIComponent(WS_CB)}`,
    ['VERIFY_EMAIL', 'webauthn-register', 'UPDATE_PASSWORD']);
  const mail = await activationMail(email);
  check(`[${lang}] invitation e-mail received, subject in ${lang}`, !!mail?.link && L.script.test(mail.subject), JSON.stringify(mail));
  const { page, context, captured } = await newContext(browser, lang);
  await addAuthenticator(page, 'usb');
  const act = mail?.link ? await activate(page, mail.link) : { seen: [] };
  check(`[${lang}] invitation asks the security key BEFORE the password (SECURITY-KEY > PASSWORD); approved model accepted`,
    act.seen.join('>') === 'SECURITY-KEY>PASSWORD' && (await credentialTypes('civora-staff', id)).join() === 'password,webauthn', `${act.seen.join('>')} ${await credentialTypes('civora-staff', id)}`);
  const a = authorize(page, 'civora-staff', 'civora-workspace', WS_CB, { ui_locales: lang });
  const n = captured.length;
  await context.clearCookies();
  await a.go();
  const login = await pageLanguage(page);
  check(`[${lang}] staff login page: lang=${lang}, dir=${L.dir}, realm name translated`, login.lang === lang && login.dir === L.dir && login.header === L.staff, JSON.stringify(login));
  await page.locator('#username').fill(email);
  await page.locator('#password').fill(act.password);
  await submit(page);
  if (await waitFor(() => visible(page, '#authenticateWebAuthnButton'), 10000)) await page.locator('#authenticateWebAuthnButton').click();
  const code = await codeFrom(captured, n);
  const tok = code ? await exchange('civora-staff', 'civora-workspace', code, a.verifier, WS_CB) : { body: {} };
  const me = tok.body.access_token ? await core(tok.body.access_token) : { status: 0, body: {} };
  if (!check(`[${lang}] password + key: token with tenant_id; core 200, realm staff, locale ${L.pack}`,
    !!tok.body.access_token && claims(tok.body.access_token).tenant_id === TENANT && me.status === 200 && me.body.accounts?.[0]?.realm === 'staff' && me.body.preferredLocale === L.pack,
    `${me.status} ${me.raw}`)) await shot(page, `officer-${lang}`);
  await context.close();
  return { email, password: act.password, id };
}

/** One login submission (e-mail + password on one page); returns the message shown and the time the answer took. */
async function loginAttempt(browser, realm, client, cb, email, password) {
  const { page, context } = await newContext(browser);
  await authorize(page, realm, client, cb, { ui_locales: 'en' }).go();
  await page.locator('#username').fill(email);
  await page.locator('#password').fill(password);
  const t0 = Date.now();
  const [resp] = await Promise.all([page.waitForResponse((r) => r.request().method() === 'POST' && r.url().includes('/login-actions/')), page.locator('#kc-login').click()]);
  const ms = Date.now() - t0;
  await page.waitForLoadState('domcontentloaded');
  const message = (await page.locator('[id^=input-error], .pf-v5-c-alert__title, #kc-error-message').allInnerTexts().catch(() => [])).map((s) => s.trim()).filter(Boolean).sort().join(' | ');
  const out = { status: resp.status(), message, ms, otp: await visible(page, '#otp'), enrol: (await visible(page, '#totp')) || (await visible(page, '#registerWebAuthn')) };
  await context.close();
  return out;
}

async function securityChecks(browser, citizen, officer) {
  stamp('account enumeration (R-P3-1): the answers must not depend on whether an address has an account');
  // E1. Registration: same answer for a new, a pending and an activated address.
  const pending = `pending.${tag()}@example.invalid`;
  const answers = [];
  for (const [what, email] of [['new', `new.${tag()}@example.invalid`], ['pending', pending], ['pending again', pending], ['activated', citizen.email]]) {
    const r = await core(undefined, '/v1/registrations', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, locale: 'en' }) });
    answers.push({ what, status: r.status, body: r.raw, type: r.type, ms: r.ms });
  }
  const same = answers.every((x) => x.status === answers[0].status && x.body === answers[0].body && x.type === answers[0].type);
  check('E1 registration: identical answer (status, body, type) for new, pending and activated addresses', same, JSON.stringify(answers));
  info(`E1 registration answer times (ms): ${answers.map((x) => `${x.what} ${x.ms}`).join(', ')} (work is done after the answer)`);
  await sleep(4000);
  check('E1 activated address: no e-mail sent; pending address asked twice: one e-mail (per-address bound)',
    (await mails(citizen.email)).length === 1 && (await mails(pending)).length === 1, `${(await mails(citizen.email)).length} / ${(await mails(pending)).length}`);
  const resp = await core(undefined, '/v1/registrations', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'not-an-address' }) });
  check('E1 malformed address: 400 (format only, says nothing about accounts)', resp.status === 400, resp.status);

  // E2. Login: unknown address vs existing account with a wrong password (different accounts: no lockout involved).
  const known = [];
  for (let i = 0; i < 4; i++) {
    const e = `known.${tag()}@example.invalid`;
    await admin('POST', 'civora-citizens/users', { username: e, email: e, enabled: true, emailVerified: true, credentials: [{ type: 'password', value: pw(), temporary: false }] });
    known.push(e);
  }
  const unknownTries = [];
  const knownTries = [];
  for (let i = 0; i < 4; i++) {
    unknownTries.push(await loginAttempt(browser, 'civora-citizens', TEST_APP, WEB_CB, `nobody.${tag()}@example.invalid`, pw()));
    knownTries.push(await loginAttempt(browser, 'civora-citizens', TEST_APP, WEB_CB, known[i], pw()));
  }
  const msgs = new Set([...unknownTries, ...knownTries].map((t) => `${t.status}:${t.message}`));
  check('E2 login: unknown address and existing account + wrong password get the same status and message', msgs.size === 1, [...msgs].join(' / '));
  const mu = median(unknownTries.map((t) => t.ms));
  const mk = median(knownTries.map((t) => t.ms));
  info(`E2 login answer times, median of 4 (ms): unknown ${mu}, existing ${mk}`);
  check('E2 login: no usable timing difference (medians within 250 ms; Keycloak hashes a dummy password for unknown users)', Math.abs(mu - mk) <= 250, `${mu} vs ${mk}`);

  // E3. A locked account answers like an unknown one.
  const victim = known[0];
  for (let i = 0; i < 5; i++) { await loginAttempt(browser, 'civora-citizens', TEST_APP, WEB_CB, victim, pw()); await sleep(1100); }
  const vid = (await userByEmail('civora-citizens', victim)).id;
  const locked = (await admin('GET', `civora-citizens/attack-detection/brute-force/users/${vid}`)).disabled === true;
  const lockedTry = await loginAttempt(browser, 'civora-citizens', TEST_APP, WEB_CB, victim, pw());
  const unknownTry = await loginAttempt(browser, 'civora-citizens', TEST_APP, WEB_CB, `nobody.${tag()}@example.invalid`, pw());
  check('E3 brute force: account locked after 5 wrong passwords (C9)', locked);
  check('E3 locked account answers exactly like an unknown address', `${lockedTry.status}:${lockedTry.message}` === `${unknownTry.status}:${unknownTry.message}`,
    `${lockedTry.message} vs ${unknownTry.message}`);

  stamp('first enrolment (R-P3-3): only the activation link gives first credentials; login never enrols a factor');
  // F1/F2. An account that has a password but no second factor (e.g. set by an administrator by mistake) is refused.
  const bare = `bare.${tag()}@example.invalid`;
  const barePw = pw();
  await admin('POST', 'civora-citizens/users', { username: bare, email: bare, enabled: true, emailVerified: true, credentials: [{ type: 'password', value: barePw, temporary: false }] });
  const f1 = await loginAttempt(browser, 'civora-citizens', TEST_APP, WEB_CB, bare, barePw);
  check('F1 citizen with a password but no second factor: refused, no TOTP enrolment offered, no code', !f1.enrol && !f1.otp && /activat|تفعيل|activ/i.test(f1.message), JSON.stringify(f1));
  const bareStaff = `bare.officer.${tag()}@example.invalid`;
  const bareStaffPw = pw();
  await admin('POST', 'civora-staff/users', { username: bareStaff, email: bareStaff, enabled: true, emailVerified: true, attributes: { tenant_id: [TENANT] }, credentials: [{ type: 'password', value: bareStaffPw, temporary: false }] });
  const f2 = await loginAttempt(browser, 'civora-staff', 'civora-workspace', WS_CB, bareStaff, bareStaffPw);
  check('F2 officer with a password but no security key: refused, no key enrolment offered, no code', !f2.enrol && /key|clé|مفتاح/i.test(f2.message), JSON.stringify(f2));
  // F3. An activation link works once.
  const once = `once.${tag()}@example.invalid`;
  await core(undefined, '/v1/registrations', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: once, locale: 'en' }) });
  const onceMail = await activationMail(once);
  const x = await newContext(browser);
  await activate(x.page, onceMail.link);
  await x.page.goto(onceMail.link);
  const reused = (await visible(x.page, 'a[href*="login-actions"]')) || (await visible(x.page, '#totp')) || (await visible(x.page, '#password-new'));
  check('F3 an activation link cannot be used twice', !reused);
  await x.context.close();

  stamp('approved security keys (attestation verified against a trusted root, AAGUID on the approved list)');
  const realm = await admin('GET', 'civora-staff');
  check('A1 staff realm: attestation direct, approved list = test model only', realm.webAuthnPolicyAttestationConveyancePreference === 'direct'
    && JSON.stringify(realm.webAuthnPolicyAcceptableAaguids) === JSON.stringify([TEST_AAGUID]), JSON.stringify(realm.webAuthnPolicyAcceptableAaguids));
  await admin('PUT', 'civora-staff', { ...realm, webAuthnPolicyAcceptableAaguids: ['cb69481e-8ff7-4039-93ec-0a2729a154a8'] });
  const off = `unapproved.${tag()}@example.invalid`;
  const offId = await admin('POST', 'civora-staff/users', { username: off, email: off, enabled: true, attributes: { tenant_id: [TENANT] } });
  await admin('PUT', `civora-staff/users/${offId}/execute-actions-email?lifespan=3600`, ['VERIFY_EMAIL', 'webauthn-register', 'UPDATE_PASSWORD']);
  const offMail = await activationMail(off);
  const y = await newContext(browser);
  await addAuthenticator(y.page, 'usb');
  const offAct = await activate(y.page, offMail.link);
  check('A2 a key whose model is not on the approved list is refused at enrolment (and the password step is never reached)',
    !(await credentialTypes('civora-staff', offId)).includes('webauthn') && !offAct.seen.includes('PASSWORD'), `${offAct.seen.join('>')} ${await credentialTypes('civora-staff', offId)}`);
  await y.context.close();
  await admin('PUT', 'civora-staff', { ...(await admin('GET', 'civora-staff')), webAuthnPolicyAcceptableAaguids: [TEST_AAGUID] });

  stamp('password policy: common and breached passwords, context words (ASVS 5.0 V6.2.4, V6.2.11, V6.2.12)');
  {
    const email = `pw.policy.${tag()}@example.invalid`;
    await core(undefined, '/v1/registrations', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, locale: 'en' }) });
    const p = await newContext(browser);
    await p.page.goto((await activationMail(email)).link);
    await Promise.all([p.page.waitForNavigation(), p.page.locator('a[href*="login-actions"]').first().click()]);
    if (await visible(p.page, '#totp')) {
      if (await visible(p.page, '#mode-manual')) await p.page.locator('#mode-manual').click();
      const secret = (await p.page.locator('#kc-totp-secret-key').innerText()).trim();
      await p.page.locator('#totp').fill(await freshTotp(secret));
      await submit(p.page, '#saveTOTPBtn, input[type=submit], button[type=submit]');
    }
    const attempt = async (candidate) => {
      await waitFor(() => visible(p.page, '#password-new'), 8000);
      await p.page.locator('#password-new').fill(candidate);
      await p.page.locator('#password-confirm').fill(candidate);
      await submit(p.page);
      await sleep(500);
      return (await visible(p.page, '#password-new')) ? 'refused' : 'accepted';
    };
    const common = await attempt('1Q2W3E4R5T6Y'); // on the deny list (case does not matter)
    const breached = await attempt('qwertyuiopasdf');
    const context = await attempt(`My-CIVORA-${rnd(10)}`);
    const arabicContext = await attempt(`${rnd(8)}-تونس-${rnd(4)}`);
    const fine = await attempt(pw());
    check('activation refuses a common password, a breached one and passwords with context words (Latin and Arabic); accepts a random one',
      [common, breached, context, arabicContext].every((x) => x === 'refused') && fine === 'accepted', [common, breached, context, arabicContext, fine].join(' '));
    await p.context.close();
  }

  stamp('other protections');
  // C5/C6 wrong and right TOTP for the activated citizen.
  const w = await newContext(browser);
  const a = authorize(w.page, 'civora-citizens', TEST_APP, WEB_CB);
  let n = w.captured.length;
  await a.go();
  await w.page.locator('#username').fill(citizen.email);
  await w.page.locator('#password').fill(citizen.password);
  await submit(w.page);
  const asked = await waitFor(() => visible(w.page, '#otp'), 8000);
  if (asked) {
    await w.page.locator('#otp').fill(String((Number(await freshTotp(citizen.secret)) + 500000) % 1000000).padStart(6, '0'));
    await submit(w.page);
  }
  const refused = asked && !!(await waitFor(() => visible(w.page, '#otp[aria-invalid=true]'), 8000));
  check('C5 password + wrong TOTP code: refused, no code', refused && !(await codeFrom(w.captured, n, 1000)));
  if (refused) { await w.page.locator('#otp').fill(await freshTotp(citizen.secret)); await submit(w.page); }
  check('C6 password + current TOTP code: completes', !!(await codeFrom(w.captured, n)));
  await w.context.close();

  for (const [realm2, client, email, password] of [['civora-citizens', TEST_APP, citizen.email, citizen.password], ['civora-citizens', 'admin-cli', citizen.email, citizen.password],
    ['civora-staff', 'civora-workspace', officer.email, officer.password], ['civora-staff', 'admin-cli', officer.email, officer.password]]) {
    const r = await form(`${KC}/realms/${realm2}/protocol/openid-connect/token`, { grant_type: 'password', client_id: client, username: email, password });
    check(`C7 password grant refused (${realm2}, client ${client})`, !r.body.access_token, JSON.stringify(r.body));
  }
  const misId = await admin('POST', 'civora-staff/clients', { clientId: `misconfigured-${tag()}`, publicClient: true, directAccessGrantsEnabled: true, standardFlowEnabled: false });
  const mis = (await admin('GET', `civora-staff/clients/${misId}`)).clientId;
  const r = await form(`${KC}/realms/civora-staff/protocol/openid-connect/token`, { grant_type: 'password', client_id: mis, username: officer.email, password: officer.password });
  check('S5 a client misconfigured to allow the password grant is still refused by the realm (deny flow)', !r.body.access_token, JSON.stringify(r.body));
  await admin('DELETE', `civora-staff/clients/${misId}`); // later live conformance checks must see the realm as deployed

  // S4 officer password without the enrolled key; forged assertion posted to Keycloak.
  const thief = await newContext(browser);
  await addAuthenticator(thief.page, 'usb');
  for (let i = 0; i < 2; i++) {
    const t = authorize(thief.page, 'civora-staff', 'civora-workspace', WS_CB);
    n = thief.captured.length;
    await t.go();
    await thief.page.locator('#username').fill(officer.email);
    await thief.page.locator('#password').fill(officer.password);
    await submit(thief.page);
    await waitFor(() => visible(thief.page, '#authenticateWebAuthnButton'), 10000);
    if (i === 0) {
      await thief.page.locator('#authenticateWebAuthnButton').click();
      check('S4 password without the enrolled key: no assertion possible, no code', !(await codeFrom(thief.captured, n, 6000)));
    } else {
      const forged = await thief.page.evaluate(() => {
        const f = document.getElementById('webauth');
        if (!f) return false;
        const junk = btoa(crypto.getRandomValues(new Uint8Array(64)).join(',')).replace(/=+$/, '');
        for (const name of ['clientDataJSON', 'authenticatorData', 'signature', 'credentialId', 'userHandle']) { const el = f.querySelector(`[name=${name}]`); if (el) el.value = junk; }
        f.submit();
        return true;
      }).catch(() => false);
      check('S4 a forged WebAuthn assertion posted to Keycloak is rejected', forged && !(await codeFrom(thief.captured, n, 5000)), `form found: ${forged}`);
    }
  }
  await thief.context.close();

  // C8 pairwise subjects, using the citizen's single sign-on session.
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
    const x2 = authorize(citizen.page, 'civora-citizens', client, cb);
    const m = citizen.captured.length;
    await x2.go();
    const c = await codeFrom(citizen.captured, m);
    const t = c ? await exchange('civora-citizens', client, c, x2.verifier, cb, sec) : { body: { error: 'no code' } };
    return { sub: t.body.id_token ? claims(t.body.id_token).sub : null, body: t.body };
  };
  const subs = [(await rpLogin('rp-example-agency', RP1_CB, rp1Secret)).sub, (await rpLogin('rp-example-agency', RP1_CB, rp1Secret)).sub];
  const unsalted = await rpLogin('rp-other-agency', RP2_CB, rp2Secret);
  check('C8 a relying party added without a salt gets no token (fails closed)', !unsalted.sub, JSON.stringify(unsalted.body));
  await refreshAdmin();
  const pol = spawnSync('python3', [POLICY, '--server', KC, '--realm', 'civora-citizens', '--profile', 'citizens', '--export', path.join(os.tmpdir(), `citizens-${process.pid}.json`)],
    { env: { ...process.env, KC_ADMIN_TOKEN: lib.adminToken() }, encoding: 'utf8' });
  check('C8 policy re-run salts it', pol.status === 0 && /rp-other-agency: pairwise salt generated/.test(pol.stdout), pol.stdout + pol.stderr);
  subs.push((await rpLogin('rp-other-agency', RP2_CB, rp2Secret)).sub);
  check('C8 pairwise: A ≠ internal id, stable for A, different for B', subs[0] && subs[0] !== citizen.userId && subs[0] === subs[1] && subs[2] && subs[2] !== subs[0], subs.join(' '));
  // P3-DB6: the core computes the same pairwise subject as Keycloak (so it can mirror it in iam.pairwise_id).
  {
    const { pairwiseSub, sectorOf } = require(path.join(process.env.REPO_DIR || path.resolve(__dirname, '..', '..', '..'), 'services', 'core', 'dist', 'src', 'modules', 'identity-access', 'pairwise.js'));
    const rp = (await admin('GET', 'civora-citizens/clients?clientId=rp-example-agency'))[0];
    const mapper = (rp.protocolMappers ?? []).find((m) => m.protocolMapper === 'oidc-sha256-pairwise-sub-mapper');
    const sector = sectorOf(mapper?.config?.sectorIdentifierUri || undefined, rp.redirectUris ?? []);
    const computed = mapper && sector ? pairwiseSub(sector, citizen.userId, mapper.config.pairwiseSubAlgorithmSalt) : null;
    check('C8 the core computes the same pairwise subject as Keycloak (sector, user id, salt): the mirror needs no relying party', computed === subs[0], `${computed} ${subs[0]} ${sector}`);
    // The core mirrors it (iam.pairwise_id) and shows the person which service knows them under which identifier.
    const own = await rpLogin(TEST_APP, WEB_CB);
    const mine = own.body?.access_token ? await core(own.body.access_token, '/v1/me/pairwise') : { status: 0, body: [] };
    check('C8 GET /v1/me/pairwise: the core mirrored the relying party\'s identifier for this citizen (iam.pairwise_id)',
      mine.status === 200 && Array.isArray(mine.body) && mine.body.some((r) => r.sector === sector && r.subject === subs[0]), mine.raw ?? JSON.stringify(mine.body));
  }

  await refreshAdmin();
  check('K1 core refuses a token from an untrusted realm (master): 401', (await core(lib.adminToken())).status === 401);
  check('K2 core refuses a request without a token: 401', (await core(undefined)).status === 401);
}

(async () => {
  await refreshAdmin();
  lib.setPasskeyExecution((await admin('GET', 'civora-citizens/authentication/flows/citizens-forms/executions'))
    .find((e) => e.providerId === 'webauthn-authenticator-passwordless').id);
  const browser = await chromium.launch({ args: ['--no-proxy-server'] }); // nothing leaves the machine
  try {
    let citizen;
    let officer;
    for (const lang of LOCALES) {
      const c = await citizenJourney(browser, lang);
      const o = await staffJourney(browser, lang);
      if (lang === 'en' || !citizen) { if (citizen) await citizen.context.close(); citizen = c; officer = o; } else await c.context.close();
    }
    await securityChecks(browser, citizen, officer);
    await citizen.context.close();
  } finally {
    await browser.close();
  }
  stamp(lib.failures() ? `${lib.failures()} check(s) FAILED` : 'all checks passed');
  process.exit(lib.failures() ? 1 : 0);
})().catch((e) => {
  console.error(`  FAIL ${e.stack || e}`);
  process.exit(1);
});
