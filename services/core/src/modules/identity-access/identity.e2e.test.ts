import { strict as assert } from 'node:assert';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { after, before, describe, it } from 'node:test';
import type { INestApplication } from '@nestjs/common';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { Client } from 'pg';

/**
 * Phase 3 week 1, end to end: the real application on a real PostgreSQL, connected as the least-privilege role
 * civora_core_app (NOBYPASSRLS, owns nothing), with access tokens signed by a test key the way Keycloak signs them.
 * Covers P3-API2 (/v1/me), P3-F3/F4 (preferences), P3-F5/API5 (mandates), P3-AC3 (actions visible to the principal),
 * P3-T4 (mandate scope and party checks). Runs only when TEST_DATABASE_URL is set (CI; local Postgres).
 */
const adminUrl = process.env.TEST_DATABASE_URL;
const ISS = 'https://keycloak.test/realms/civora-citizens';
const root = resolve(__dirname, '..', '..', '..', '..');

describe('identity and mandates, end to end (Phase 3 week 1)', { skip: !adminUrl && 'TEST_DATABASE_URL not set' }, () => {
  let app: INestApplication;
  let base: string;
  let dbName: string;
  let appDbUrl: string;
  let sign: (sub: string, claims?: Record<string, unknown>) => Promise<string>;

  before(async () => {
    dbName = `iam_e2e_${Date.now()}_${process.pid}`;
    const admin = new Client({ connectionString: adminUrl });
    await admin.connect();
    await admin.query(`create database ${dbName}`);
    const appPw = `e2e-${process.pid}-only`;
    try { await admin.query("create role civora_core_app login nobypassrls"); } catch { /* exists */ }
    await admin.query(`alter role civora_core_app login nobypassrls password '${appPw}'`);
    await admin.end();
    const u = new URL(adminUrl as string);
    u.pathname = `/${dbName}`;
    execFileSync(resolve(root, 'node_modules', '.bin', 'node-pg-migrate'),
      ['up', '--migrations-dir', 'migrations', '--migration-file-language', 'sql', '--migrations-table', 'schema_migrations', '--check-order'],
      { cwd: root, env: { ...process.env, DATABASE_URL: u.toString() }, stdio: 'pipe' });
    u.username = 'civora_core_app';
    u.password = appPw;
    appDbUrl = u.toString();

    const { publicKey, privateKey } = await generateKeyPair('ES256');
    const dir = mkdtempSync(join(tmpdir(), 'jwks-'));
    writeFileSync(join(dir, 'jwks.json'), JSON.stringify({ keys: [{ ...(await exportJWK(publicKey)), kid: 'e2e', alg: 'ES256', use: 'sig' }] }));
    sign = (sub, claims = {}) => new SignJWT({ typ: 'Bearer', ...claims }).setProtectedHeader({ alg: 'ES256', kid: 'e2e' })
      .setIssuer(ISS).setAudience('civora-core').setSubject(sub).setIssuedAt().setExpirationTime('5m').sign(privateKey);

    Object.assign(process.env, { CIVORA_ENV: 'test', DATABASE_URL: appDbUrl, OIDC_ISSUER_CITIZENS: ISS, OIDC_LOCAL_JWKS_FILE: join(dir, 'jwks.json') });
    const { createApp } = await import('../../app.factory');
    app = await createApp({ logger: false });
    await app.listen(0, '127.0.0.1');
    base = `http://127.0.0.1:${(app.getHttpServer().address() as { port: number }).port}`;
  });
  after(async () => {
    await app?.close();
    const admin = new Client({ connectionString: adminUrl });
    await admin.connect();
    await admin.query(`drop database if exists ${dbName} with (force)`);
    await admin.end();
  });

  const call = async (path: string, token?: string, init: { method?: string; body?: unknown } = {}) => {
    const res = await fetch(base + path, {
      method: init.method ?? 'GET',
      headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(init.body !== undefined ? { 'content-type': 'application/json' } : {}) },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
    const text = await res.text();
    return { status: res.status, headers: res.headers, body: text ? JSON.parse(text) : undefined };
  };

  it('without a token: 401 problem+json with WWW-Authenticate', async () => {
    const r = await call('/v1/me');
    assert.equal(r.status, 401);
    assert.match(r.headers.get('www-authenticate') ?? '', /^Bearer realm="civora"/);
    assert.match(r.headers.get('content-type') ?? '', /application\/problem\+json/);
  });
  it('a token from another issuer: 401', async () => {
    const forged = await new SignJWT({ typ: 'Bearer' }).setProtectedHeader({ alg: 'ES256', kid: 'e2e' }).setIssuer('https://evil.test/realms/x')
      .setAudience('civora-core').setSubject('alice').setIssuedAt().setExpirationTime('5m').sign((await generateKeyPair('ES256')).privateKey);
    assert.equal((await call('/v1/me', forged)).status, 401);
  });

  it('first call provisions the person with the token locale; preferences can be changed and are validated', async () => {
    const alice = await sign('alice', { locale: 'fr-TN' });
    const me = await call('/v1/me', alice);
    assert.equal(me.status, 200);
    assert.equal(me.body.preferredLocale, 'fr-TN');
    assert.deepEqual(me.body.accounts, [{ realm: 'citizens', status: 'active', assuranceLevel: 'AAL1' }]);
    assert.equal((await call('/v1/me', alice, { method: 'PATCH', body: { preferredLocale: 'ar-TN', accessibility: { textSize: 'large', highContrast: true } } })).status, 204);
    const again = await call('/v1/me', alice);
    assert.equal(again.body.id, me.body.id);
    assert.equal(again.body.preferredLocale, 'ar-TN');
    assert.deepEqual(again.body.accessibility, { textSize: 'large', highContrast: true });
    const bad = await call('/v1/me', alice, { method: 'PATCH', body: { preferredLocale: 'xx-YY', id: 'someone-else' } });
    assert.equal(bad.status, 400);
    assert.ok(Array.isArray(bad.body.errors) && bad.body.errors.length === 2);
  });

  it('mandate lifecycle: proposed → accepted by the agent with the code → revoked; every action visible to the principal', async () => {
    const alice = await sign('alice');
    const bob = await sign('bob');
    const carol = await sign('carol');
    const expiresAt = new Date(Date.now() + 30 * 86_400_000).toISOString();
    const created = await call('/v1/mandates', alice, { method: 'POST', body: { scopes: ['cases:read', 'payments:submit'], expiresAt } });
    assert.equal(created.status, 201);
    assert.equal(created.body.status, 'proposed');
    assert.equal(created.body.role, 'principal');
    assert.match(created.body.invitationCode, /^[A-Za-z0-9_-]{43}$/);
    const id = created.body.id as string;
    const code = created.body.invitationCode as string;

    assert.deepEqual((await call('/v1/mandates', bob)).body, [], 'the agent sees nothing before accepting');
    assert.equal((await call(`/v1/mandates/${id}:accept`, bob, { method: 'POST', body: { invitationCode: 'A'.repeat(43) } })).status, 404, 'wrong code');
    assert.equal((await call(`/v1/mandates/${id}:accept`, alice, { method: 'POST', body: { invitationCode: code } })).status, 404, 'principal cannot accept');
    const accepted = await call(`/v1/mandates/${id}:accept`, bob, { method: 'POST', body: { invitationCode: code } });
    assert.equal(accepted.status, 200);
    assert.equal(accepted.body.status, 'active');
    assert.equal(accepted.body.role, 'agent');
    assert.equal((await call(`/v1/mandates/${id}:accept`, carol, { method: 'POST', body: { invitationCode: code } })).status, 404, 'code is single-use');

    assert.equal((await call(`/v1/mandates/${id}/events`, carol)).status, 404, 'a third person sees nothing');
    assert.equal((await call(`/v1/mandates/${id}:revoke`, carol, { method: 'POST' })).status, 404, 'a third person cannot revoke');
    const revoked = await call(`/v1/mandates/${id}:revoke`, alice, { method: 'POST' });
    assert.equal(revoked.body.status, 'revoked');
    const events = await call(`/v1/mandates/${id}/events`, alice);
    assert.deepEqual(events.body.map((e: { action: string; actorRole: string }) => `${e.action}/${e.actorRole}`), ['created/principal', 'accepted/agent', 'revoked/principal']);
    assert.equal((await call(`/v1/mandates/${id}/events`, bob)).body.length, 3, 'the agent sees the same record');
  });

  it('refuses delegation of identity or mandates, unknown scopes and over-long mandates', async () => {
    const alice = await sign('alice');
    const r = await call('/v1/mandates', alice, { method: 'POST', body: { scopes: ['mandates:manage', 'cases:read'], expiresAt: new Date(Date.now() + 400 * 86_400_000).toISOString() } });
    assert.equal(r.status, 400);
    assert.ok(r.body.errors.some((e: string) => e.startsWith('scopes[0]')));
    assert.ok(r.body.errors.some((e: string) => e.includes('366')));
  });

  it('database: the application role sees no person without a person set (row-level security)', async () => {
    const c = new Client({ connectionString: appDbUrl });
    await c.connect();
    const { rows } = await c.query('select count(*)::int as n from iam.person');
    await c.end();
    assert.equal(rows[0].n, 0);
  });

  it('a Keycloak language (fr) is stored as the pack locale (fr-TN), so /v1/me returns a locale the API accepts', async () => {
    const r = await call('/v1/me', await sign('dina', { locale: 'fr' }));
    assert.equal(r.status, 200);
    assert.equal(r.body.preferredLocale, 'fr-TN');
  });

  it('registration: 503 when the provisioner is not configured in the cell (no partial behaviour)', async () => {
    const r = await call('/v1/registrations', undefined, { method: 'POST', body: { email: 'someone@example.invalid' } });
    assert.equal(r.status, 503);
  });

  it('database: the authenticator mirror only touches the current person (sync_authenticators, as the application role)', async () => {
    await call('/v1/me', await sign('erin'));
    const c = new Client({ connectionString: appDbUrl });
    await c.connect();
    const person = (await c.query("select iam.ensure_person('citizens', 'erin', null, null) as id")).rows[0].id;
    await c.query('begin');
    await c.query("select set_config('app.person_id', $1, true)", [person]);
    const items = [{ id: 'kc-cred-1', kind: 'passkey', label: 'Phone', createdAt: null }, { id: 'kc-cred-2', kind: 'totp', label: null, createdAt: null }];
    const n1 = (await c.query('select iam.sync_authenticators($1, $2::jsonb) as n', ['citizens', JSON.stringify(items)])).rows[0].n;
    const n2 = (await c.query('select iam.sync_authenticators($1, $2::jsonb) as n', ['citizens', JSON.stringify(items.slice(1))])).rows[0].n;
    const visible = (await c.query('select kind from iam.authenticator')).rows.map((r) => r.kind);
    await c.query('commit');
    await assert.rejects(c.query('insert into iam.authenticator (account_id, kind, keycloak_credential_id) select id, $1, $2 from iam.account limit 1', ['totp', 'x']), /permission denied/);
    await assert.rejects(c.query('select iam.sync_authenticators($1, $2::jsonb)', ['citizens', '[]']), /no authenticated person/);
    await c.end();
    assert.deepEqual([n1, n2, visible], [2, 1, ['totp']]);
  });

  it('database: branches, teams and unit roles per institution (P3-R3), invitations become memberships at first sign-in', async () => {
    const T1 = '11111111-1111-4111-8111-111111111111';
    const T2 = '22222222-2222-4222-8222-222222222222';
    const c = new Client({ connectionString: appDbUrl });
    await c.connect();
    const person = async (subject: string, tenant: string) => (await c.query("select iam.ensure_person('staff', $1, $2, null) as id", [subject, tenant])).rows[0].id;
    const as = async <T>(who: string, tenant: string, admin: boolean, fn: () => Promise<T>): Promise<T> => {
      await c.query('begin');
      await c.query("select set_config('app.person_id', $1, true), set_config('app.tenant_id', $2, true), set_config('app.tenant_admin', $3, true)", [who, tenant, String(admin)]);
      try { const r = await fn(); await c.query('commit'); return r; } catch (e) { await c.query('rollback'); throw e; }
    };
    const one = async (sql: string, args: unknown[] = []) => (await c.query(sql, args)).rows[0];
    const adm1 = await person('adm-1', T1);
    const alice = await person('alice', T1);
    const adm2 = await person('adm-2', T2);
    const bob = await person('bob', T2);
    const branch = await as(adm1, T1, true, async () => (await one("select iam.create_org_unit('branch', 'Tunis branch', null) as id")).id);
    const team = await as(adm1, T1, true, async () => (await one("select iam.create_org_unit('team', 'Claims', $1) as id", [branch])).id);
    const team2 = await as(adm1, T1, true, async () => (await one("select iam.create_org_unit('team', 'Payments', $1) as id", [branch])).id);
    await assert.rejects(as(alice, T1, false, () => one("select iam.create_org_unit('branch', 'Mine', null)")), /tenant administrator only/);
    await assert.rejects(as(adm2, T2, true, () => one("select iam.create_org_unit('team', 'Intruder', $1)", [branch])), /parent must be a branch of this institution/);
    assert.equal(await as(adm2, T2, true, async () => (await one('select count(*)::int as n from iam.org_unit')).n), 0, 'another institution sees none of these units');
    // Invitations: carl invited into the Claims team; dave's invitation was made in T1 but he signs in under T2.
    await as(adm1, T1, true, () => one("select iam.record_staff_invitation('carl', $1, 'member', now() + interval '1 hour')", [team]));
    await as(adm1, T1, true, () => one("select iam.record_staff_invitation('dave', $1, 'member', now() + interval '1 hour')", [team]));
    const carl = await person('carl', T1);
    const dave = await person('dave', T2);
    const carlRoles = await as(carl, T1, false, async () => (await c.query('select org_unit_id, role from iam.membership where person_id = iam.current_person()')).rows);
    assert.deepEqual(carlRoles, [{ org_unit_id: team, role: 'member' }], 'invitation became a membership at the first sign-in');
    assert.equal(await as(dave, T2, false, async () => (await one('select count(*)::int as n from iam.membership where person_id = iam.current_person()')).n), 0,
      'an invitation of one institution is never applied in another');
    // Scoped roles: a branch supervisor covers its teams; a team member does not see the team's members.
    await as(adm1, T1, true, () => one("select iam.grant_membership($1, $2, 'supervisor')", [alice, branch]));
    const seen = await as(alice, T1, false, async () => (await c.query('select person_id from iam.unit_members($1)', [team])).rows.map((r) => r.person_id));
    assert.deepEqual(seen, [carl], 'the branch supervisor sees the team members');
    await as(alice, T1, false, () => one('select count(*) from iam.unit_members($1)', [team2]));
    await assert.rejects(as(carl, T1, false, () => one('select count(*) from iam.unit_members($1)', [team])), /tenant administrator or supervisor only/);
    await assert.rejects(as(adm1, T1, true, () => one("select iam.grant_membership($1, $2, 'member')", [bob, team])), /not a staff member of this institution/);
    assert.equal(await as(adm1, T1, true, async () => (await one('select iam.revoke_membership($1, $2) as ok', [carl, team])).ok), true);
    await assert.rejects(c.query("insert into iam.org_unit (tenant_id, kind, name) values ($1, 'branch', 'direct')", [T1]), /permission denied/);
    await c.end();
  });

  it('database: activation e-mails per address are bounded (registration_permit, as the application role)', async () => {
    const c = new Client({ connectionString: appDbUrl });
    await c.connect();
    const digest = Buffer.alloc(32, 7);
    const permit = async () => (await c.query('select iam.registration_permit($1, make_interval(mins => 15)) as ok', [digest])).rows[0].ok;
    const first = await permit();
    const second = await permit();
    await assert.rejects(c.query('select count(*) from iam.registration_request'), /permission denied/);
    await c.end();
    assert.equal(first, true);
    assert.equal(second, false);
  });
});
