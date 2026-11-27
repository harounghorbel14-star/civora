'use strict';
/**
 * Phase 3 (doc phase-3/17; decision Q3-7, deviation D5): the SMS sign-in step (Keycloak extension civora-keycloak-sms)
 * against the real citizens and staff realms, in Arabic, French and English: offered after the password as an
 * alternative to the authenticator app (citizens) or the security key (staff who are not officers); never for officers;
 * a wrong code refused and announced by the core ("second step failed"); codes replaced on resend; wrong codes counted
 * by the brute-force protection. The phone number is set as verified by the test, as the core does after its own code
 * (that flow is tested in the web part, doc 16).
 * Run by run.sh (KC_URL, CORE_URL, MAIL_URL, KC_ADMIN_PASSWORD).
 */
const crypto = require('node:crypto');
const { chromium } = require('playwright');
const lib = require('./lib.cjs');
const { LANG, LOCALES, TEST_APP, WEB_CB, WS_CB, TENANT, check, stamp, sleep, admin, activationMail, mails, newContext, addAuthenticator, authorize,
  waitFor, codeFrom, exchange, core, visible, submit, activate, tag, pageLanguage, mailMatching, NOTICE, userByEmail } = lib;

const MAIL = process.env.MAIL_URL;
const smsBox = (p) => `sms.${p.replace(/\D/g, '')}@sms.civora-cell.invalid`;
const newPhone = () => `+2160${String(crypto.randomInt(0, 10_000_000)).padStart(7, '0')}`;
const TEXT = {
  ar: { option: /رمز برسالة قصيرة/, invalid: 'الرمز غير صحيح.', unavailable: 'وسيلة الدخول هذه غير متاحة لهذا الحساب', kind: 'الرمز برسالة قصيرة' },
  fr: { option: /Code par SMS/, invalid: 'Le code n’est pas correct.', unavailable: 'Ce moyen de connexion n’est pas disponible pour ce compte', kind: 'code par SMS' },
  en: { option: /Code by SMS/, invalid: 'The code is not right.', unavailable: 'This way to sign in is not available for this account', kind: 'code by SMS' },
};

/** The newest simulated SMS to `phone` after `before` messages: its text and the six-digit code in it. */
async function sms(phone, before, ms = 15000) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    const list = await mails(smsBox(phone));
    if (list.length > before) {
      const text = (await (await fetch(`${MAIL}/api/v1/message/${list[0].ID}`)).json()).Text.trim();
      return { text, code: (text.match(/(\d{6})/) ?? [])[1] };
    }
    await sleep(250);
  }
  return null;
}

async function setVerifiedPhone(realm, id, phone) {
  const u = await admin('GET', `${realm}/users/${id}`);
  await admin('PUT', `${realm}/users/${id}`, { ...u, attributes: { ...(u.attributes ?? {}), phone_number: [phone], phone_number_verified: ['true'] } });
}

const pageText = (page) => page.locator('body').innerText().then((t) => t.replace(/\s+/g, ' ')).catch(() => '');

/** From the second-step page: "Try another way", then the SMS option; true when the SMS page shows. */
async function chooseSms(page, lang) {
  if (!(await waitFor(() => visible(page, '#try-another-way'), 8000))) return { offered: false, options: [] };
  await page.locator('#try-another-way').click();
  await waitFor(() => visible(page, '[role=button]'), 8000);
  const options = await page.locator('[role=button]').allInnerTexts();
  const sms = page.locator('[role=button]', { hasText: TEXT[lang].option }).last();
  if (!(await sms.count())) return { offered: false, options };
  await sms.click();
  await sleep(500);
  return { offered: true, options, page: await visible(page, '#civora-sms-code') };
}

async function citizen(browser, lang) {
  const email = `sms.${lang}.${tag()}@example.invalid`;
  await core(undefined, '/v1/registrations', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, locale: LANG[lang].pack }) });
  const x = await newContext(browser, lang);
  const act = await activate(x.page, (await activationMail(email)).link);
  await x.context.close();
  return { email, password: act.password, secret: act.secret, id: (await userByEmail('civora-citizens', email)).id };
}

async function passwordStep(page, who) {
  await waitFor(() => visible(page, '#password'), 8000);
  if (await visible(page, '#username')) await page.locator('#username').fill(who.email);
  await page.locator('#password').fill(who.password);
  await submit(page);
}

(async () => {
  const browser = await chromium.launch({ args: ['--no-proxy-server'] });
  try {
    for (const lang of LOCALES) {
      stamp(`[${lang}] citizen: password, then "try another way" from the authenticator app to a code by SMS`);
      const who = await citizen(browser, lang);
      const phone = newPhone();
      await setVerifiedPhone('civora-citizens', who.id, phone);
      const x = await newContext(browser, lang);
      const a = authorize(x.page, 'civora-citizens', TEST_APP, WEB_CB, { ui_locales: lang });
      const n = x.captured.length;
      await a.go();
      await passwordStep(x.page, who);
      const otpFirst = await waitFor(() => visible(x.page, '#otp'), 8000);
      const before = (await mails(smsBox(phone))).length;
      const chosen = await chooseSms(x.page, lang);
      const smsPage = await pageLanguage(x.page).catch(() => ({}));
      const first = await sms(phone, before);
      const mailBefore = (await mails(who.email)).length;
      await x.page.locator('#civora-sms-code').fill(first?.code === '000000' ? '111111' : '000000');
      await submit(x.page, '#kc-login');
      await sleep(500);
      const refused = (await pageText(x.page)).includes(TEXT[lang].invalid) && (await visible(x.page, '#civora-sms-code'));
      await x.page.locator('#civora-sms-resend').click();
      await sleep(500);
      const second = await sms(phone, before + 1);
      await x.page.locator('#civora-sms-code').fill(first?.code ?? '');
      await submit(x.page, '#kc-login');
      await sleep(500);
      const oldRefused = (await pageText(x.page)).includes(TEXT[lang].invalid);
      await x.page.locator('#civora-sms-code').fill(second?.code ?? '');
      await submit(x.page, '#kc-login');
      const code = await codeFrom(x.captured, n);
      const tokens = code ? (await exchange('civora-citizens', TEST_APP, code, a.verifier, WEB_CB)).body : {};
      check(`[${lang}] the SMS step is offered under "try another way" in ${lang}; its page in ${lang}; the SMS in ${lang} goes to the verified number`,
        otpFirst && chosen.offered && chosen.page && smsPage.lang === lang && !!first?.code && LANG[lang].script.test(first.text) && first.text.length <= 160,
        JSON.stringify({ otpFirst, chosen, smsPage: smsPage.lang, sms: first?.text }));
      check(`[${lang}] a wrong code is refused; "send a new code" replaces the code (the old one no longer works); the new one signs in`,
        refused && !!second?.code && second.code !== first?.code && oldRefused && !!tokens.access_token, JSON.stringify({ refused, resent: !!second, oldRefused, signedIn: !!tokens.access_token }));
      const notice = await mailMatching(who.email, mailBefore, NOTICE[lang].secondStep, 20000);
      check(`[${lang}] the wrong SMS code: the core's "second step failed" e-mail in ${lang}, naming the code by SMS`,
        !!notice && notice.text.includes(TEXT[lang].kind), notice?.subject);
      await x.context.close();

      if (lang === 'en') {
        stamp('[en] citizen without the authenticator app: password + SMS; without a verified number: not available, nothing sent; 5 wrong codes lock the account');
        for (const c of await admin('GET', `civora-citizens/users/${who.id}/credentials`)) if (c.type === 'otp') await admin('DELETE', `civora-citizens/users/${who.id}/credentials/${c.id}`);
        const y = await newContext(browser, 'en');
        const b = authorize(y.page, 'civora-citizens', TEST_APP, WEB_CB, { ui_locales: 'en' });
        const m = y.captured.length;
        const before2 = (await mails(smsBox(phone))).length;
        await b.go();
        await passwordStep(y.page, who);
        const direct = await waitFor(() => visible(y.page, '#civora-sms-code'), 8000);
        const s3 = await sms(phone, before2);
        await y.page.locator('#civora-sms-code').fill(s3?.code ?? '');
        await submit(y.page, '#kc-login');
        const code2 = await codeFrom(y.captured, m);
        check('[en] an account with a password and a verified number only: the SMS step comes at once and signs in', direct && !!code2, JSON.stringify({ direct, code: !!code2 }));
        await y.context.close();

        const none = await citizen(browser, 'en');
        const z = await newContext(browser, 'en');
        await authorize(z.page, 'civora-citizens', TEST_APP, WEB_CB, { ui_locales: 'en' }).go();
        await passwordStep(z.page, none);
        const pick = await chooseSms(z.page, 'en');
        const text = await pageText(z.page);
        check('[en] an account without a verified number that picks SMS: "not available for this account", no code page, no SMS',
          !pick.page && text.includes(TEXT.en.unavailable), JSON.stringify({ pick, text: text.slice(0, 160) }));
        await z.context.close();

        const w = await newContext(browser, 'en');
        await authorize(w.page, 'civora-citizens', TEST_APP, WEB_CB, { ui_locales: 'en' }).go();
        await passwordStep(w.page, who);
        await waitFor(() => visible(w.page, '#civora-sms-code'), 8000);
        for (let i = 0; i < 5; i++) {
          if (!(await visible(w.page, '#civora-sms-code'))) break;
          await w.page.locator('#civora-sms-code').fill(String(100000 + i));
          await submit(w.page, '#kc-login');
          await sleep(400);
        }
        const status = await admin('GET', `civora-citizens/attack-detection/brute-force/users/${who.id}`);
        check('[en] five wrong SMS codes count for the brute-force protection: the account is locked for a while (as after five wrong passwords)',
          status.disabled === true && status.numFailures >= 5, JSON.stringify(status));
        await w.context.close();
      }
    }

    for (const lang of ['en', 'ar']) {
      stamp(`[${lang}] staff: security key, or a code by SMS for staff who are not officers; officers never`);
      const make = async (officer) => {
        const email = `sms.${officer ? 'officer' : 'agent'}.${lang}.${tag()}@example.invalid`;
        const id = await admin('POST', 'civora-staff/users', { username: email, email, enabled: true, firstName: 'Synthetic', lastName: 'Staff', attributes: { tenant_id: [TENANT], locale: [lang] } });
        await admin('PUT', `civora-staff/users/${id}/execute-actions-email?lifespan=43200&client_id=civora-workspace&redirect_uri=${encodeURIComponent(WS_CB)}`,
          ['VERIFY_EMAIL', 'webauthn-register', 'UPDATE_PASSWORD']);
        const x = await newContext(browser, lang);
        await addAuthenticator(x.page, 'usb');
        const act = await activate(x.page, (await activationMail(email)).link);
        if (officer) await admin('POST', `civora-staff/users/${id}/role-mappings/realm`, [await admin('GET', 'civora-staff/roles/officer')]);
        const phone = newPhone();
        await setVerifiedPhone('civora-staff', id, phone);
        return { x, who: { email, password: act.password }, phone };
      };
      const agent = await make(false);
      await agent.x.context.clearCookies();
      const a = authorize(agent.x.page, 'civora-staff', 'civora-workspace', WS_CB, { ui_locales: lang });
      const n = agent.x.captured.length;
      await a.go();
      await passwordStep(agent.x.page, agent.who);
      const keyFirst = await waitFor(() => visible(agent.x.page, '#authenticateWebAuthnButton'), 8000);
      const before = (await mails(smsBox(agent.phone))).length;
      const chosen = await chooseSms(agent.x.page, lang);
      const s = await sms(agent.phone, before);
      if (chosen.page) {
        await agent.x.page.locator('#civora-sms-code').fill(s?.code ?? '');
        await submit(agent.x.page, '#kc-login');
      }
      const code = await codeFrom(agent.x.captured, n);
      check(`[${lang}] staff member who is not an officer: the security key first; "try another way" offers the SMS step in ${lang}; with the code, signed in`,
        keyFirst && chosen.page && !!s?.code && !!code, JSON.stringify({ keyFirst, chosen, sms: !!s, code: !!code }));
      await agent.x.context.close();

      const off = await make(true);
      await off.x.context.clearCookies();
      const o = authorize(off.x.page, 'civora-staff', 'civora-workspace', WS_CB, { ui_locales: lang });
      await o.go();
      await passwordStep(off.x.page, off.who);
      await waitFor(() => visible(off.x.page, '#authenticateWebAuthnButton'), 8000);
      const offBefore = (await mails(smsBox(off.phone))).length;
      const pick = await chooseSms(off.x.page, lang);
      const text = await pageText(off.x.page);
      await sleep(1500);
      const noSms = (await mails(smsBox(off.phone))).length === offBefore;
      const m = off.x.captured.length;
      await o.go();
      await passwordStep(off.x.page, off.who);
      if (await waitFor(() => visible(off.x.page, '#authenticateWebAuthnButton'), 8000)) await off.x.page.locator('#authenticateWebAuthnButton').click();
      const keyCode = await codeFrom(off.x.captured, m);
      check(`[${lang}] an officer with a verified number who picks SMS: "not available for this account" in ${lang}, no SMS sent; the security key still signs in (P3-SEC5)`,
        !pick.page && text.includes(TEXT[lang].unavailable) && noSms && !!keyCode, JSON.stringify({ pick, noSms, key: !!keyCode, text: text.slice(0, 120) }));
      await off.x.context.close();
    }
  } finally {
    await browser.close();
  }
  stamp(lib.failures() ? `${lib.failures()} check(s) FAILED` : 'all SMS sign-in checks passed');
  process.exit(lib.failures() ? 1 : 0);
})().catch((err) => {
  console.error(`  FAIL ${err.stack || err}`);
  process.exit(1);
});
