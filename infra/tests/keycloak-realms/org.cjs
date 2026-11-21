'use strict';
/**
 * Phase 3 week 3 (W3-2): an institution's administrator builds branches and teams and invites staff through the
 * core; invitees enrol a security key then a password from the link; their unit role exists at first sign-in;
 * branch supervisors see their teams; refusals for others; step-up; cleanup of accounts never activated.
 * Run by run.sh after account.cjs (STEP_UP_MAX_AGE_SECONDS=30, CORE_DIR and provisioner settings in the environment).
 */
const { chromium } = require('playwright');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const lib = require('./lib.cjs');
const { KC, WS_CB, TENANT, check, info, stamp, claims, sleep, admin, activationMail, newContext, addAuthenticator, authorize, waitFor, codeFrom,
  exchange, core, visible, submit, activate, tag, userByEmail, LANG } = lib;

const STEP_UP = Number(process.env.STEP_UP_MAX_AGE_SECONDS || 30);
const json = (method, body) => ({ method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

async function staffSignIn(browser, email, password, ctx, extra = {}) {
  const x = ctx ?? (await newContext(browser));
  if (!ctx) await addAuthenticator(x.page, 'usb');
  const a = authorize(x.page, 'civora-staff', 'civora-workspace', WS_CB, extra);
  const n = x.captured.length;
  await a.go();
  if (await waitFor(() => visible(x.page, '#password'), 8000)) {
    if (await visible(x.page, '#username')) await x.page.locator('#username').fill(email);
    await x.page.locator('#password').fill(password);
    await submit(x.page);
  }
  if (await waitFor(() => visible(x.page, '#authenticateWebAuthnButton'), 8000)) await x.page.locator('#authenticateWebAuthnButton').click();
  const code = await codeFrom(x.captured, n);
  const tok = code ? (await exchange('civora-staff', 'civora-workspace', code, a.verifier, WS_CB)).body : {};
  return { ctx: x, token: tok.access_token };
}

/** Activates an invitation in a fresh browser with a security key; returns the context and password. */
async function acceptInvitation(browser, email) {
  const x = await newContext(browser);
  await addAuthenticator(x.page, 'usb');
  const mail = await activationMail(email);
  const act = await activate(x.page, mail.link);
  return { ctx: x, password: act.password, subject: mail.subject, seen: act.seen };
}

(async () => {
  await lib.refreshAdmin();
  const browser = await chromium.launch({ args: ['--no-proxy-server'] });
  try {
    stamp('platform operator appoints the institution administrator (realm role tenant-admin)');
    const adminEmail = `tenant.admin.${tag()}@example.invalid`;
    const adminId = await admin('POST', 'civora-staff/users', { username: adminEmail, email: adminEmail, enabled: true, attributes: { tenant_id: [TENANT] } });
    const role = await admin('GET', 'civora-staff/roles/tenant-admin');
    await admin('POST', `civora-staff/users/${adminId}/role-mappings/realm`, [role]);
    await admin('PUT', `civora-staff/users/${adminId}/execute-actions-email?lifespan=3600&client_id=civora-workspace&redirect_uri=${encodeURIComponent(WS_CB)}`,
      ['VERIFY_EMAIL', 'webauthn-register', 'UPDATE_PASSWORD']);
    const adm = await acceptInvitation(browser, adminEmail);
    let s = await staffSignIn(browser, adminEmail, adm.password, adm.ctx);
    let at = s.token;
    check('administrator token: tenant_id and realm role tenant-admin', at && claims(at).tenant_id === TENANT && claims(at).realm_access?.roles?.includes('tenant-admin'));

    stamp('branches and teams (P3-R3)');
    let r = await core(at, '/v1/org/units', json('POST', { kind: 'branch', name: `Tunis ${tag()}` }));
    const branch = r.body?.id;
    check('create a branch: 201', r.status === 201 && !!branch, r.raw);
    r = await core(at, '/v1/org/units', json('POST', { kind: 'team', name: 'Claims', parentId: branch }));
    const claimsTeam = r.body?.id;
    r = await core(at, '/v1/org/units', json('POST', { kind: 'team', name: 'Payments', parentId: branch }));
    const paymentsTeam = r.body?.id;
    check('create two teams in the branch: 201', !!claimsTeam && !!paymentsTeam, r.raw);
    r = await core(at, '/v1/org/units', json('POST', { kind: 'team', name: 'Orphan' }));
    check('a team without its branch: 400', r.status === 400, r.raw);
    r = await core(at, '/v1/org/units', json('POST', { kind: 'team', name: 'Claims', parentId: branch }));
    check('the same team name twice in a branch: 409', r.status === 409, r.raw);

    stamp('invitations: key before password; the unit role exists at the first sign-in');
    const memberEmail = `staff.member.${tag()}@example.invalid`;
    const supEmail = `staff.supervisor.${tag()}@example.invalid`;
    r = await core(at, '/v1/staff/invitations', json('POST', { email: memberEmail, unitId: claimsTeam, role: 'member', locale: 'fr-TN' }));
    check('invite a member of the Claims team (French): 201 with expiry', r.status === 201 && !!r.body.expiresAt, r.raw);
    r = await core(at, '/v1/staff/invitations', json('POST', { email: supEmail, unitId: branch, role: 'supervisor' }));
    check('invite a supervisor of the branch: 201', r.status === 201, r.raw);
    const memberUser = await userByEmail('civora-staff', memberEmail);
    check('invitee account: same institution (tenant_id), no credential before the link',
      memberUser?.attributes?.tenant_id?.[0] === TENANT && (await admin('GET', `civora-staff/users/${memberUser.id}/credentials`)).length === 0);
    const mem = await acceptInvitation(browser, memberEmail);
    check('invitation e-mail in French; key asked before the password', LANG.fr.script.test(mem.subject) && mem.seen.join('>') === 'SECURITY-KEY>PASSWORD', `${mem.subject} ${mem.seen}`);
    const ms = await staffSignIn(browser, memberEmail, mem.password, mem.ctx);
    const memberMe = await core(ms.token, '/v1/me');
    r = await core(ms.token, '/v1/me/memberships');
    check('member: GET /v1/me/memberships shows the Claims team, role member', r.status === 200 && r.body.length === 1 && r.body[0].unitId === claimsTeam && r.body[0].role === 'member', r.raw);
    const sup = await acceptInvitation(browser, supEmail);
    const ss = await staffSignIn(browser, supEmail, sup.password, sup.ctx);
    r = await core(ss.token, `/v1/org/units/${claimsTeam}/members`);
    check('branch supervisor sees the Claims team members (role covers the branch\'s teams)', r.status === 200 && r.body.some((m) => m.personId === memberMe.body.id), r.raw);
    r = await core(ms.token, `/v1/org/units/${claimsTeam}/members`);
    check('a member cannot list the team members: 403', r.status === 403, r.raw);
    r = await core(ms.token, '/v1/org/units', json('POST', { kind: 'branch', name: 'Mine' }));
    check('a member cannot create units: 403', r.status === 403, r.raw);
    r = await core(ms.token, '/v1/staff/invitations', json('POST', { email: `x.${tag()}@example.invalid`, unitId: claimsTeam, role: 'member' }));
    check('a member cannot invite: 403', r.status === 403, r.raw);
    r = await core(at, '/v1/staff/invitations', json('POST', { email: memberEmail, unitId: claimsTeam, role: 'member' }));
    check('inviting an address that already has a staff account: 409', r.status === 409, r.raw);
    const ghost = `y.${tag()}@example.invalid`;
    r = await core(at, '/v1/staff/invitations', json('POST', { email: ghost, unitId: '00000000-0000-4000-8000-000000000000', role: 'member' }));
    const leftover = await userByEmail('civora-staff', ghost);
    check('inviting into a unit that does not exist: 404 (and no account left behind)', r.status === 404 && !leftover, r.raw);
    r = await core(at, `/v1/org/units/${paymentsTeam}/members/${memberMe.body.id}`, json('PUT', { role: 'supervisor' }));
    check('administrator gives the member a supervisor role in Payments: 204', r.status === 204, r.raw);
    r = await core(ms.token, `/v1/org/units/${paymentsTeam}/members`);
    check('...who then sees the Payments members, and still not the Claims members', r.status === 200 && (await core(ms.token, `/v1/org/units/${claimsTeam}/members`)).status === 403);
    r = await core(at, `/v1/org/units/${paymentsTeam}/members/${memberMe.body.id}`, { method: 'DELETE' });
    check('administrator removes that role: 204', r.status === 204, r.raw);

    stamp('step-up on administration');
    const wait = Math.max(0, (claims(at).auth_time + STEP_UP + 2) * 1000 - Date.now());
    info(`waiting ${Math.round(wait / 1000)} s for the administrator's sign-in to become older than the limit`);
    await sleep(wait);
    r = await core(at, '/v1/org/units', json('POST', { kind: 'branch', name: 'Late' }));
    check('administration with an old sign-in: 401 insufficient_user_authentication', r.status === 401, r.raw);
    s = await staffSignIn(browser, adminEmail, adm.password, adm.ctx, { prompt: 'login' });
    r = await core(s.token, '/v1/org/units', json('POST', { kind: 'branch', name: `Sfax ${tag()}` }));
    check('after signing in again: 201', r.status === 201, r.raw);
    r = await core(ms.token, '/v1/org/units');
    check('staff see their institution\'s units (3 created here, among others)', r.status === 200 && [branch, claimsTeam, paymentsTeam].every((id) => r.body.some((u) => u.id === id)), r.raw);

    stamp('cleanup of accounts never activated (R-P3-8)');
    const pendingCitizen = `never.${tag()}@example.invalid`;
    await core(undefined, '/v1/registrations', json('POST', { email: pendingCitizen, locale: 'en' }));
    const pendingStaff = `never.staff.${tag()}@example.invalid`;
    await core(s.token, '/v1/staff/invitations', json('POST', { email: pendingStaff, unitId: claimsTeam, role: 'member' }));
    await waitFor(async () => !!(await userByEmail('civora-citizens', pendingCitizen)), 10000);
    await sleep(1500);
    const run = spawnSync(process.execPath, [path.join(process.env.CORE_DIR, 'dist', 'src', 'tools', 'cleanup-unactivated.js')], {
      env: { ...process.env, CIVORA_ENV: 'test', CLEANUP_CITIZENS_MINUTES: '0', CLEANUP_STAFF_MINUTES: '0' }, encoding: 'utf8',
    });
    info(`cleanup output: ${run.stdout.trim().replace(/\n/g, ' | ')}`);
    check('cleanup removed the never-activated citizen and staff accounts',
      run.status === 0 && !(await userByEmail('civora-citizens', pendingCitizen)) && !(await userByEmail('civora-staff', pendingStaff)), run.stderr);
    check('cleanup kept every activated account (administrator, member, supervisor)',
      !!(await userByEmail('civora-staff', adminEmail)) && !!(await userByEmail('civora-staff', memberEmail)) && !!(await userByEmail('civora-staff', supEmail)));
    for (const x of [adm.ctx, mem.ctx, sup.ctx]) await x.context.close();
  } finally {
    await browser.close();
  }
  stamp(lib.failures() ? `${lib.failures()} check(s) FAILED` : 'all organisation checks passed');
  process.exit(lib.failures() ? 1 : 0);
})().catch((e) => {
  console.error(`  FAIL ${e.stack || e}`);
  process.exit(1);
});
