'use strict';
/**
 * Phase 3 week 3 (W3-1): the signed-in person's sessions and authenticators through the core, against the real
 * Keycloak realms, and step-up (RFC 9470). Run by run.sh after login.cjs, with STEP_UP_MAX_AGE_SECONDS=30.
 */
const { chromium } = require('playwright');
const lib = require('./lib.cjs');
const { KC, WEB_CB, WS_CB, TENANT, check, info, stamp, claims, sleep, admin, freshTotp, activationMail, newContext, addAuthenticator, authorize,
  waitFor, codeFrom, exchange, core, visible, submit, activate, choosePasskey, credentialTypes, tag, form, signIn } = lib;

const STEP_UP = Number(process.env.STEP_UP_MAX_AGE_SECONDS || 30);
const json = (body) => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

(async () => {
  await lib.refreshAdmin();
  lib.setPasskeyExecution((await admin('GET', 'civora-citizens/authentication/flows/citizens-forms/executions'))
    .find((e) => e.providerId === 'webauthn-authenticator-passwordless').id);
  const browser = await chromium.launch({ args: ['--no-proxy-server'] });
  try {
    stamp('officer: invited, key then password, signed in (a second realm for the ownership checks)');
    const staffEmail = `account.officer.${tag()}@example.invalid`;
    const sid = await admin('POST', 'civora-staff/users', { username: staffEmail, email: staffEmail, enabled: true, firstName: 'Synthetic', lastName: 'Officer', attributes: { tenant_id: [TENANT] } });
    await admin('PUT', `civora-staff/users/${sid}/execute-actions-email?lifespan=3600&client_id=civora-workspace&redirect_uri=${encodeURIComponent(WS_CB)}`, ['VERIFY_EMAIL', 'webauthn-register', 'UPDATE_PASSWORD']);
    const o = await newContext(browser);
    await addAuthenticator(o.page, 'usb');
    const oact = await activate(o.page, (await activationMail(staffEmail)).link);
    const ot = await signIn(o, { realm: 'civora-staff', client: 'civora-workspace', cb: WS_CB, email: staffEmail, password: oact.password });
    const officerSession = ot.access_token ? claims(ot.access_token).sid : null;

    stamp('citizen: tokens carry the sign-in time, acr and session id');
    const email = `account.${tag()}@example.invalid`;
    await core(undefined, '/v1/registrations', json({ email, locale: 'en' }));
    const act = await activate((await newContext(browser)).page, (await activationMail(email)).link);
    const a = await newContext(browser);
    await addAuthenticator(a.page, 'internal');
    const t1 = await signIn(a, { realm: 'civora-citizens', client: 'civora-web', cb: WEB_CB, email, password: act.password, secret: act.secret });
    const c1 = t1.access_token ? claims(t1.access_token) : {};
    check('access token: auth_time (now), acr "1" (credentials presented), sid', Math.abs(c1.auth_time - Date.now() / 1000) < 60 && c1.acr === '1' && !!c1.sid, JSON.stringify({ auth_time: c1.auth_time, acr: c1.acr, sid: c1.sid }));

    stamp('authenticators (P3-API4, F2)');
    let r = await core(t1.access_token, '/v1/me/authenticators');
    check('GET authenticators: the authenticator app, never the password', r.status === 200 && r.body.map((x) => x.kind).join() === 'totp', r.raw);
    r = await core(t1.access_token, '/v1/me/authenticators', json({ kind: 'security-key' }));
    check('POST a kind the realm does not offer (citizen security key): 400', r.status === 400, r.raw);
    r = await core(t1.access_token, '/v1/me/authenticators', json({ kind: 'passkey' }));
    check('POST passkey (fresh sign-in): 201 with the identity-provider action to run', r.status === 201 && r.body.keycloakAction === 'webauthn-register-passwordless', r.raw);
    const aia = authorize(a.page, 'civora-citizens', 'civora-web', WEB_CB, { kc_action: r.body.keycloakAction });
    let n = a.captured.length;
    await aia.go();
    if (await waitFor(() => visible(a.page, '#registerWebAuthn'), 10000)) await a.page.locator('#registerWebAuthn').click();
    await codeFrom(a.captured, n);
    r = await core(t1.access_token, '/v1/me/authenticators');
    check('after the action: the passkey is listed', r.status === 200 && r.body.map((x) => x.kind).sort().join() === 'passkey,totp', r.raw);
    const passkeyId = r.body.find?.((x) => x.kind === 'passkey')?.id;
    const totpId = r.body.find?.((x) => x.kind === 'totp')?.id;

    stamp('sessions (P3-API3)');
    const PASSKEY_AGAIN = { realm: 'civora-citizens', client: 'civora-web', cb: WEB_CB, passkey: true, extra: { prompt: 'login' } };
    const TOTP_DEVICE = { realm: 'civora-citizens', client: 'civora-web', cb: WEB_CB, email, password: act.password, secret: act.secret };
    const b = await newContext(browser); // a second device: password + authenticator app
    let tb = await signIn(b, TOTP_DEVICE);
    // Ending sessions needs a recent sign-in (ASVS 5.0 V7.5.2). The second device waited for a new authenticator-app
    // code (codes are single use), so this device signs in again with its passkey first.
    let ta = await signIn(a, PASSKEY_AGAIN);
    const sidA = ta.access_token ? claims(ta.access_token).sid : null;
    r = await core(ta.access_token, '/v1/me/sessions');
    const mine = Array.isArray(r.body) ? r.body : [];
    check('GET sessions: both devices listed, only this one marked current, with the application',
      r.status === 200 && mine.length === 2 && mine.filter((x) => x.current).map((x) => x.id).join() === sidA && mine.every((x) => x.applications.includes('civora-web')), r.raw);
    r = await core(ta.access_token, `/v1/me/sessions/${officerSession}`, { method: 'DELETE' });
    check('end someone else\'s session (an officer\'s): 404, and it stays active', r.status === 404 && (await core(ot.access_token, '/v1/me/sessions')).body.some?.((x) => x.id === officerSession), r.status);
    r = await core(ta.access_token, '/v1/me/sessions', { method: 'DELETE' });
    let refused = await form(`${KC}/realms/civora-citizens/protocol/openid-connect/token`, { grant_type: 'refresh_token', client_id: 'civora-web', refresh_token: tb.refresh_token });
    let left = await core(ta.access_token, '/v1/me/sessions');
    check('"sign out everywhere else" (DELETE /v1/me/sessions): the other device\'s session ends, its refresh token is refused at once; this one stays',
      r.status === 200 && r.body.ended === 1 && refused.body.error === 'invalid_grant' && left.body.length === 1 && left.body[0].current, `${r.raw} ${left.raw}`);
    tb = await signIn(b, TOTP_DEVICE);
    ta = await signIn(a, PASSKEY_AGAIN);
    r = await core(ta.access_token, `/v1/me/sessions/${claims(tb.access_token).sid}`, { method: 'DELETE' });
    refused = await form(`${KC}/realms/civora-citizens/protocol/openid-connect/token`, { grant_type: 'refresh_token', client_id: 'civora-web', refresh_token: tb.refresh_token });
    check('end one session (the other device\'s): 204; its refresh token is refused at once', r.status === 204 && refused.body.error === 'invalid_grant', `${r.status} ${JSON.stringify(refused.body)}`);
    left = await core(ta.access_token, '/v1/me/sessions');
    check('afterwards only the current session is listed', left.status === 200 && left.body.length === 1 && left.body[0].current, left.raw);

    stamp('step-up (P3-A4, RFC 9470)');
    // Single sign-on reuse: a new token without presenting credentials has acr "0" and does not count as a sign-in.
    const sso = authorize(a.page, 'civora-citizens', 'civora-web', WEB_CB);
    n = a.captured.length;
    await sso.go();
    const t2 = (await exchange('civora-citizens', 'civora-web', await codeFrom(a.captured, n), sso.verifier, WEB_CB)).body;
    check('token from single sign-on reuse: acr "0"', !!t2.access_token && claims(t2.access_token).acr === '0', t2.access_token && claims(t2.access_token).acr);
    const r2 = await fetch(`${process.env.CORE_URL}/v1/me/authenticators/${totpId}`, { method: 'DELETE', headers: { authorization: `Bearer ${t2.access_token}` } });
    check('sensitive action with the reused-session token: 401 insufficient_user_authentication with max_age',
      r2.status === 401 && /error="insufficient_user_authentication".*max_age=\d+/.test(r2.headers.get('www-authenticate') || ''), `${r2.status} ${r2.headers.get('www-authenticate')}`);
    const wait = Math.max(0, (c1.auth_time + STEP_UP + 2) * 1000 - Date.now());
    info(`waiting ${Math.round(wait / 1000)} s for the sign-in to become older than the step-up limit (${STEP_UP} s in this test)`);
    await sleep(wait);
    r = await core(t1.access_token, `/v1/me/authenticators/${totpId}`, { method: 'DELETE' });
    check('sensitive action with a sign-in older than max_age: 401', r.status === 401, r.status);
    r = await core(t1.access_token, '/v1/me/sessions', { method: 'DELETE' });
    check('ending sessions with a sign-in older than max_age: 401 as well (ASVS V7.5.2)', r.status === 401, r.status);
    const uid = (await admin('GET', `civora-citizens/users?exact=true&email=${encodeURIComponent(email)}`))[0].id;
    check('nothing was removed by the refused requests', (await credentialTypes('civora-citizens', uid)).join() === 'otp,password,webauthn-passwordless');
    const t3 = await signIn(a, { realm: 'civora-citizens', client: 'civora-web', cb: WEB_CB, passkey: true, extra: { prompt: 'login' } });
    check('the app signs the person in again (prompt=login, passkey): acr "1", new auth_time',
      !!t3.access_token && claims(t3.access_token).acr === '1' && claims(t3.access_token).auth_time > c1.auth_time);
    r = await core(t3.access_token, `/v1/me/authenticators/${totpId}`, { method: 'DELETE' });
    check('remove the authenticator app after stepping up: 204 (the passkey still signs in)', r.status === 204, `${r.status} ${r.raw}`);
    r = await core(t3.access_token, `/v1/me/authenticators/${passkeyId}`, { method: 'DELETE' });
    check('remove the last way to sign in (the passkey): 409, refused', r.status === 409, `${r.status} ${r.raw}`);
    r = await core(t3.access_token, '/v1/me/authenticators/00000000-0000-4000-8000-000000000000', { method: 'DELETE' });
    check('remove an unknown authenticator: 404', r.status === 404, r.status);
    const c = await newContext(browser);
    const pwOnly = await signIn(c, { realm: 'civora-citizens', client: 'civora-web', cb: WEB_CB, email, password: act.password });
    check('with the authenticator app removed, the password alone is refused (that path needs a second factor)', !pwOnly.access_token);

    stamp('officer: security key management');
    const ot2 = await signIn(o, { realm: 'civora-staff', client: 'civora-workspace', cb: WS_CB, email: staffEmail, password: oact.password, extra: { prompt: 'login' } });
    r = await core(ot2.access_token, '/v1/me/authenticators');
    const keyId = r.body?.[0]?.id;
    check('officer GET authenticators: the security key', r.status === 200 && r.body.map((x) => x.kind).join() === 'security-key', r.raw);
    r = await core(ot2.access_token, `/v1/me/authenticators/${keyId}`, { method: 'DELETE' });
    check('officer removes the only security key (fresh sign-in): 409, refused', r.status === 409, `${r.status} ${r.raw}`);
    r = await core(ot2.access_token, '/v1/me/authenticators', json({ kind: 'passkey' }));
    check('officer asks for a passkey: 400 (staff use security keys)', r.status === 400, r.raw);
    r = await core(ot2.access_token, '/v1/me/authenticators', json({ kind: 'security-key' }));
    check('officer adds a second security key: 201 webauthn-register', r.status === 201 && r.body.keycloakAction === 'webauthn-register', r.raw);
    for (const x of [a, b, c, o]) await x.context.close();
  } finally {
    await browser.close();
  }
  stamp(lib.failures() ? `${lib.failures()} check(s) FAILED` : 'all account checks passed');
  process.exit(lib.failures() ? 1 : 0);
})().catch((e) => {
  console.error(`  FAIL ${e.stack || e}`);
  process.exit(1);
});
