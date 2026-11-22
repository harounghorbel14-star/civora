'use strict';
/**
 * Phase 3 week 3 (W3-4): institution staff SSO (P3-R1) against the real staff realm and two SIMULATED institution
 * identity providers (bank A over OpenID Connect, bank B over SAML 2.0; synthetic staff only). The platform operator
 * connects each tenant with infra/keycloak/configure-tenant-sso.py; the live realm is checked again; then real sign-ins
 * in Chromium with virtual security keys. Run by run.sh (KC_URL, CORE_URL, KC_ADMIN_PASSWORD, REPO_DIR, WORK_DIR).
 */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { chromium } = require('playwright');
const lib = require('./lib.cjs');
const { KC, WS_CB, TENANT, check, info, stamp, claims, admin, activationMail, newContext, addAuthenticator, authorize, waitFor, codeFrom, exchange,
  core, visible, submit, activate, tag, pw } = lib;

const REPO = process.env.REPO_DIR;
const WORK = process.env.WORK_DIR;
const TA = '7a2b3c4d-5e6f-4a1b-8c2d-3e4f5a6b7c8d'; // tenant of bank A (synthetic)
const TB = '8b3c4d5e-6f7a-4b2c-9d3e-4f5a6b7c8d9e'; // tenant of bank B (synthetic)
const STAFF = 'civora-staff';

async function py(args, env = {}) {
  await lib.refreshAdmin();
  const r = spawnSync('python3', args, { env: { ...process.env, KC_ADMIN_TOKEN: lib.adminToken(), ...env }, encoding: 'utf8' });
  return { ok: r.status === 0, out: `${r.stdout}${r.stderr}`.trim() };
}
const clientOf = async (realm, clientId) => (await admin('GET', `${realm}/clients?clientId=${clientId}`))[0];

/** The institution side, as each institution would set it up for CIVORA (simulators only). */
async function prepareSimulators() {
  const a = await clientOf('sim-bank-a-idp', 'civora-staff-broker');
  await admin('PUT', `sim-bank-a-idp/clients/${a.id}`, { ...a, redirectUris: [`${KC}/realms/${STAFF}/broker/sim-bank-a/endpoint`] });
  const secret = await admin('POST', `sim-bank-a-idp/clients/${a.id}/client-secret`);
  fs.writeFileSync(path.join(WORK, 'bank-a.secret'), secret?.value ?? (await admin('GET', `sim-bank-a-idp/clients/${a.id}/client-secret`)).value, { mode: 0o600 });
  const b = await clientOf('sim-bank-b-idp', 'civora-staff-sp');
  const acs = `${KC}/realms/${STAFF}/broker/sim-bank-b/endpoint`;
  await admin('PUT', `sim-bank-b-idp/clients/${b.id}`, { ...b, redirectUris: [acs], attributes: { ...b.attributes, saml_assertion_consumer_url_post: acs } });
  const descriptor = await (await fetch(`${KC}/realms/sim-bank-b-idp/protocol/saml/descriptor`)).text();
  const cert = (descriptor.match(/<ds:X509Certificate>([^<]+)<\/ds:X509Certificate>/) ?? [])[1];
  fs.writeFileSync(path.join(WORK, 'bank-b.pem'), `-----BEGIN CERTIFICATE-----\n${cert}\n-----END CERTIFICATE-----\n`);
  return !!cert;
}

async function institutionUser(realm, email, extra = {}) {
  const password = pw();
  const id = await admin('POST', `${realm}/users`, { username: email, email, emailVerified: true, enabled: true, firstName: 'Synthetic', lastName: 'Staff',
    credentials: [{ type: 'password', value: password, temporary: false }], ...extra });
  return { id, email, password };
}

/** Sign-in through an institution: kc_idp_hint, the institution's page, then CIVORA's security key. */
async function ssoSignIn(ctx, alias, who, { register = false, prompt } = {}) {
  const a = authorize(ctx.page, STAFF, 'civora-workspace', WS_CB, { kc_idp_hint: alias, ...(prompt ? { prompt } : {}) });
  const n = ctx.captured.length;
  await a.go();
  let sawInstitution = false;
  // The institution's page; on re-authentication it already knows the user and shows only the password.
  if (await waitFor(() => visible(ctx.page, '#password'), 8000)) {
    sawInstitution = new URL(ctx.page.url()).pathname.includes(`/realms/sim-bank-`);
    if (await visible(ctx.page, '#username')) await ctx.page.locator('#username').fill(who.email);
    await ctx.page.locator('#password').fill(who.password);
    await submit(ctx.page);
  }
  let keyStep = null;
  const step = await waitFor(async () => (await visible(ctx.page, '#registerWebAuthn')) ? 'register'
    : (await visible(ctx.page, '#authenticateWebAuthnButton')) ? 'authenticate' : null, 10000);
  if (step === 'register' && register) { keyStep = 'register'; await ctx.page.locator('#registerWebAuthn').click(); }
  if (step === 'authenticate') { keyStep = 'authenticate'; await ctx.page.locator('#authenticateWebAuthnButton').click(); }
  const code = await codeFrom(ctx.captured, n, 10000);
  const tok = code ? (await exchange(STAFF, 'civora-workspace', code, a.verifier, WS_CB)).body : {};
  return { token: tok.access_token, keyStep, step, sawInstitution, page: ctx.page.url() };
}

(async () => {
  await lib.refreshAdmin();
  const browser = await chromium.launch({ args: ['--no-proxy-server'] });
  try {
    stamp('platform operator connects two institutions: bank A (OIDC) and bank B (SAML)');
    check('simulated institutions prepared (redirect URIs, client secret, SAML signing certificate)', await prepareSimulators());
    const script = path.join(REPO, 'infra', 'keycloak', 'configure-tenant-sso.py');
    let r = await py([script, '--server', KC, '--tenant-id', TA, '--alias', 'sim-bank-a', '--name', 'Bank A (simulated)', '--domain', 'bank-a.invalid',
      '--protocol', 'oidc', '--issuer', `${KC}/realms/sim-bank-a-idp`, '--internal-url', 'http://localhost:8080', '--client-id', 'civora-staff-broker',
      '--client-secret-file', path.join(WORK, 'bank-a.secret')]);
    check('configure-tenant-sso.py: bank A over OIDC', r.ok, r.out);
    r = await py([script, '--server', KC, '--tenant-id', TB, '--alias', 'sim-bank-b', '--name', 'Bank B (simulated)', '--domain', 'bank-b.invalid',
      '--protocol', 'saml', '--sso-url', `${KC}/realms/sim-bank-b-idp/protocol/saml`, '--idp-entity-id', `${KC}/realms/sim-bank-b-idp`,
      '--signing-cert-file', path.join(WORK, 'bank-b.pem')]);
    check('configure-tenant-sso.py: bank B over SAML', r.ok, r.out);
    r = await py([script, '--server', KC, '--tenant-id', TA, '--alias', 'sim-bank-a', '--name', 'Bank A (simulated)', '--domain', 'bank-a.invalid',
      '--protocol', 'oidc', '--issuer', `${KC}/realms/sim-bank-a-idp`, '--internal-url', 'http://localhost:8080', '--client-id', 'civora-staff-broker',
      '--client-secret-file', path.join(WORK, 'bank-a.secret')]);
    const orgCount = (await admin('GET', `${STAFF}/organizations?briefRepresentation=false`)).filter((o) => [TA, TB].includes(o.attributes?.tenant_id?.[0])).length;
    check('the script is idempotent (bank A again): same provider, 2 mappers, one organisation per tenant',
      r.ok && (await admin('GET', `${STAFF}/identity-provider/instances/sim-bank-a/mappers`)).length === 2 && orgCount === 2, r.out);
    await lib.refreshAdmin();
    const live = await (await fetch(`${KC}/admin/realms/${STAFF}/partial-export?exportClients=true&exportGroupsAndRoles=true`, {
      method: 'POST', headers: { authorization: `Bearer ${lib.adminToken()}` } })).json();
    fs.writeFileSync(path.join(WORK, 'staff.sso.live.json'), JSON.stringify(live));
    r = await py([path.join(REPO, 'infra', 'scripts', 'check-realm-security.py'), path.join(WORK, 'staff.sso.live.json'), '--profile', 'staff', '--live', '--require-approved-keys', '--self-test']);
    check(`live civora-staff with both institutions conforms (${(live.identityProviders ?? []).length} providers; ${(r.out.match(/control rejected/g) ?? []).length} negative controls rejected)`,
      r.ok && (live.identityProviders ?? []).length === 2, r.out.split('\n').filter((l) => /FAIL/.test(l)).join(' | ') || r.out.slice(-300));

    stamp('the shared login page does not list the institutions');
    const look = await newContext(browser);
    const peek = authorize(look.page, STAFF, 'civora-workspace', WS_CB);
    await peek.go();
    await waitFor(() => visible(look.page, '#password'), 8000);
    const html = await look.page.content();
    check('no institution on the staff login page (providers hidden; the app sends kc_idp_hint)', !/sim-bank|Bank A \(simulated\)|Bank B \(simulated\)/.test(html));
    await look.context.close();

    stamp('bank A (OIDC): first sign-in creates the account in tenant A and enrols the security key');
    const alice = await institutionUser('sim-bank-a-idp', `alice.${tag()}@bank-a.invalid`);
    const a1 = await newContext(browser);
    await addAuthenticator(a1.page, 'usb');
    let s = await ssoSignIn(a1, 'sim-bank-a', alice, { register: true });
    const ca = s.token ? claims(s.token) : {};
    check('first SSO sign-in: the institution\'s page, then security-key enrolment, then a token', s.sawInstitution && s.keyStep === 'register' && !!s.token, JSON.stringify(s));
    check('token: tenant_id of bank A (from configuration, not from the institution)', ca.tenant_id === TA, JSON.stringify({ tenant_id: ca.tenant_id }));
    const me = await core(s.token, '/v1/me');
    check('the core accepts the token: staff of tenant A', me.status === 200 && me.body.accounts?.[0]?.realm === 'staff', me.raw);
    const aliceKc = (await admin('GET', `${STAFF}/users?exact=true&email=${encodeURIComponent(alice.email)}`))[0];
    const creds = (await admin('GET', `${STAFF}/users/${aliceKc.id}/credentials`)).map((c) => c.type).sort().join();
    const links = (await admin('GET', `${STAFF}/users/${aliceKc.id}/federated-identity`)).map((l) => l.identityProvider).join();
    check('the account: security key only (no CIVORA password), linked to bank A only, username prefixed by the provider',
      creds === 'webauthn' && links === 'sim-bank-a' && aliceKc.username.startsWith('sim-bank-a.'), `${creds} ${links} ${aliceKc.username}`);
    const orgs = await admin('GET', `${STAFF}/organizations?q=tenant_id:${TA}&exact=true&briefRepresentation=false`);
    const members = orgs[0] ? await admin('GET', `${STAFF}/organizations/${orgs[0].id}/members`) : [];
    check('member of bank A\'s organisation (tenant_id attribute, e-mail domain bank-a.invalid)', members.some((m) => m.id === aliceKc.id), JSON.stringify(orgs.map((o) => o.name)));

    stamp('every later SSO sign-in needs the security key');
    s = await ssoSignIn(a1, 'sim-bank-a', alice, { prompt: 'login' });
    check('second sign-in: the institution, then a security-key assertion, then a token', s.keyStep === 'authenticate' && !!s.token, JSON.stringify(s));
    const thief = await newContext(browser); // the institution's password, but not the key
    s = await ssoSignIn(thief, 'sim-bank-a', alice);
    check('the institution\'s password without the CIVORA key: no token', !s.token && s.step !== 'register', JSON.stringify(s));
    await thief.context.close();

    stamp('bank B (SAML)');
    const bob = await institutionUser('sim-bank-b-idp', `bob.${tag()}@bank-b.invalid`);
    const b1 = await newContext(browser);
    await addAuthenticator(b1.page, 'usb');
    s = await ssoSignIn(b1, 'sim-bank-b', bob, { register: true });
    const cb = s.token ? claims(s.token) : {};
    check('SAML first sign-in: key enrolled; token with tenant_id of bank B', s.keyStep === 'register' && cb.tenant_id === TB, JSON.stringify({ ...s, tenant_id: cb.tenant_id }));
    check('the core accepts the SAML-brokered token', (await core(s.token, '/v1/me')).status === 200);

    stamp('no account takeover across institutions or of local accounts');
    const mallory = await institutionUser('sim-bank-b-idp', `m.${tag()}@bank-b.invalid`);
    await admin('PUT', `sim-bank-b-idp/users/${mallory.id}`, { email: alice.email, emailVerified: true, username: mallory.email });
    const m1 = await newContext(browser);
    await addAuthenticator(m1.page, 'usb');
    s = await ssoSignIn(m1, 'sim-bank-b', mallory, { register: true });
    const aliceAfter = (await admin('GET', `${STAFF}/users/${aliceKc.id}`));
    const aliceLinks = (await admin('GET', `${STAFF}/users/${aliceKc.id}/federated-identity`)).map((l) => l.identityProvider).join();
    check('bank B asserts bank A user\'s e-mail: refused, no token; her account unchanged (tenant A, linked to bank A only)',
      !s.token && aliceAfter.attributes?.tenant_id?.[0] === TA && aliceLinks === 'sim-bank-a', JSON.stringify({ step: s.step, page: s.page.slice(0, 120), aliceLinks }));
    const localEmail = `local.${tag()}@bank-a.invalid`;
    const localId = await admin('POST', `${STAFF}/users`, { username: localEmail, email: localEmail, emailVerified: true, enabled: true, attributes: { tenant_id: [TENANT] } });
    const twin = await institutionUser('sim-bank-a-idp', localEmail);
    const t1 = await newContext(browser);
    await addAuthenticator(t1.page, 'usb');
    s = await ssoSignIn(t1, 'sim-bank-a', twin, { register: true });
    const localLinks = await admin('GET', `${STAFF}/users/${localId}/federated-identity`);
    const localUser = await admin('GET', `${STAFF}/users/${localId}`);
    check('an institution user with the e-mail of a local account: refused; the local account is not linked and keeps its tenant',
      !s.token && localLinks.length === 0 && localUser.attributes?.tenant_id?.[0] === TENANT, JSON.stringify({ step: s.step, links: localLinks.length }));

    stamp('the tenant always comes from the provider configuration (sync FORCE)');
    await admin('PUT', `${STAFF}/users/${aliceKc.id}`, { ...aliceAfter, attributes: { ...aliceAfter.attributes, tenant_id: [TB] } });
    s = await ssoSignIn(a1, 'sim-bank-a', alice, { prompt: 'login' });
    check('tenant_id changed behind the scenes is reset to bank A at the next SSO sign-in', s.token && claims(s.token).tenant_id === TA, JSON.stringify(s));

    stamp('leaver: disabled at the institution');
    await admin('PUT', `sim-bank-a-idp/users/${alice.id}`, { enabled: false });
    const l1 = await newContext(browser);
    await addAuthenticator(l1.page, 'usb');
    s = await ssoSignIn(l1, 'sim-bank-a', alice);
    check('disabled at bank A: no CIVORA token', !s.token, JSON.stringify(s));
    for (const x of [a1, b1, m1, t1, l1]) await x.context.close();
  } finally {
    await browser.close();
  }
  stamp(lib.failures() ? `${lib.failures()} check(s) FAILED` : 'all staff SSO checks passed');
  process.exit(lib.failures() ? 1 : 0);
})().catch((e) => {
  console.error(`  FAIL ${e.stack || e}`);
  process.exit(1);
});
