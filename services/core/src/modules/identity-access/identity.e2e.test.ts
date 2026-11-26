import { strict as assert } from 'node:assert';
import { execFileSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
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

    Object.assign(process.env, { CIVORA_ENV: 'test', DATABASE_URL: appDbUrl, OIDC_ISSUER_CITIZENS: ISS, OIDC_LOCAL_JWKS_FILE: join(dir, 'jwks.json'),
      IDENTITY_CLAIM_DIGEST_KEY: randomBytes(32).toString('base64') }); // the key turns the adaptive controls on (doc 15)
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

  it('acting on behalf of (P3-F6): only the agent of an active mandate; recorded and visible to the principal', async () => {
    const pia = await sign('pia');
    const abe = await sign('abe');
    const expiresAt = new Date(Date.now() + 7 * 86_400_000).toISOString();
    const created = await call('/v1/mandates', pia, { method: 'POST', body: { scopes: ['cases:read', 'payments:submit'], expiresAt } });
    assert.equal(created.status, 201);
    const id = created.body.id as string;
    assert.equal((await call(`/v1/mandates/${id}:act`, abe, { method: 'POST' })).status, 404, 'not before the agent accepts');
    assert.equal((await call(`/v1/mandates/${id}:accept`, abe, { method: 'POST', body: { invitationCode: created.body.invitationCode } })).status, 200);
    const acted = await call(`/v1/mandates/${id}:act`, abe, { method: 'POST' });
    assert.equal(acted.status, 200);
    assert.deepEqual(acted.body.scopes, ['cases:read', 'payments:submit']);
    assert.equal(acted.body.mandateId, id);
    assert.equal((await call(`/v1/mandates/${id}:act`, pia, { method: 'POST' })).status, 404, 'the principal cannot act under their own mandate');
    assert.equal((await call(`/v1/mandates/${id}:act`, await sign('eve'), { method: 'POST' })).status, 404, 'nor anyone else');
    const seen = await call(`/v1/mandates/${id}/events`, pia);
    assert.deepEqual(seen.body.map((e: { action: string; actorRole: string }) => `${e.action}:${e.actorRole}`), ['created:principal', 'accepted:agent', 'acted:agent']);
    // Cedar decisions (ADR-006, P3-T4): what the agent may do under this mandate; submit covers read; never identity.
    const allowed = async (who: string) => Object.fromEntries((await call(`/v1/mandates/${id}/permissions`, who)).body.permissions
      .map((p: { action: string; allowed: boolean }) => [p.action, p.allowed]));
    const agentView = await allowed(abe);
    assert.deepEqual(Object.entries(agentView).filter(([, v]) => v).map(([k]) => k).sort(), ['cases:read', 'payments:read', 'payments:submit']);
    assert.equal(agentView['identity:manage'], false);
    assert.equal(Object.values(await allowed(pia)).some(Boolean), false, 'the principal does not act under their own mandate');
    assert.equal((await call(`/v1/mandates/${id}/permissions`, await sign('eve'))).status, 404);
    assert.equal((await call(`/v1/mandates/${id}:revoke`, pia, { method: 'POST' })).status, 200);
    assert.equal((await call(`/v1/mandates/${id}:act`, abe, { method: 'POST' })).status, 404, 'not after the principal revokes');
    assert.equal(Object.values(await allowed(abe)).some(Boolean), false, 'nothing after revocation');
  });

  it('DPoP (RFC 9449): a bound token works only with a fresh proof for this request and key, once; never as a bearer token', async () => {
    const { calculateJwkThumbprint, exportJWK, generateKeyPair, SignJWT: Sign } = await import('jose');
    const { createHash, randomUUID } = await import('node:crypto');
    const key = await generateKeyPair('ES256', { extractable: true });
    const jwk = await exportJWK(key.publicKey);
    const jkt = await calculateJwkThumbprint(jwk, 'sha256');
    const token = await sign('dana', { typ: 'DPoP', cnf: { jkt }, azp: 'civora-web' });
    const proof = (htm: string, path: string, t = token, k = key.privateKey, j = jwk) => new Sign({ htm, htu: `${base}${path}`, jti: randomUUID(),
      ath: createHash('sha256').update(t, 'ascii').digest('base64url') }).setProtectedHeader({ alg: 'ES256', typ: 'dpop+jwt', jwk: j }).setIssuedAt().sign(k);
    const get = async (headers: Record<string, string>) => (await fetch(`${base}/v1/me`, { headers })).status;
    const p1 = await proof('GET', '/v1/me');
    assert.equal(await get({ authorization: `DPoP ${token}`, dpop: p1 }), 200, 'bound token with its proof');
    assert.equal(await get({ authorization: `DPoP ${token}`, dpop: p1 }), 401, 'the same proof again (replay)');
    assert.equal(await get({ authorization: `Bearer ${token}` }), 401, 'a bound token as a bearer token');
    assert.equal(await get({ authorization: `DPoP ${token}` }), 401, 'no proof');
    assert.equal(await get({ authorization: `DPoP ${token}`, dpop: await proof('POST', '/v1/me') }), 401, 'proof for another method');
    assert.equal(await get({ authorization: `DPoP ${token}`, dpop: await proof('GET', '/v1/mandates') }), 401, 'proof for another URL');
    const other = await generateKeyPair('ES256', { extractable: true });
    assert.equal(await get({ authorization: `DPoP ${token}`, dpop: await proof('GET', '/v1/me', token, other.privateKey, await exportJWK(other.publicKey)) }), 401, 'proof from another key');
    const unbound = await sign('dana', { azp: 'civora-web' });
    assert.equal(await get({ authorization: `Bearer ${unbound}` }), 401, 'the web app must use DPoP: its bearer token is refused');
    assert.equal((await fetch(`${base}/v1/me`, { headers: { authorization: `Bearer ${token}` } })).headers.get('www-authenticate')?.startsWith('DPoP'), true);
  });

  it('quota (R-P3-15): at most 30 mandate proposals a day per person; the 31st gets 429', async () => {
    const quinn = await sign('quinn');
    const expiresAt = new Date(Date.now() + 7 * 86400_000).toISOString();
    for (let i = 0; i < 30; i++) {
      const r = await call('/v1/mandates', quinn, { method: 'POST', body: { scopes: ['cases:read'], expiresAt } });
      assert.equal(r.status, 201, `proposal ${i + 1}`);
    }
    assert.equal((await call('/v1/mandates', quinn, { method: 'POST', body: { scopes: ['cases:read'], expiresAt } })).status, 429);
    const other = await sign('rita');
    assert.equal((await call('/v1/mandates', other, { method: 'POST', body: { scopes: ['cases:read'], expiresAt } })).status, 201, 'another person is not affected');
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

  it('adaptive controls (G3): a session now used from another browser is ended and refused; other sessions go on', async () => {
    const chrome = 'Mozilla/5.0 (X11; Linux x86_64) Chrome/131.0.0.0 Safari/537.36';
    const firefox = 'Mozilla/5.0 (Windows NT 10.0; rv:133.0) Gecko/20100101 Firefox/133.0';
    const get = async (t: string, ua: string) => {
      const res = await fetch(`${base}/v1/me`, { headers: { authorization: `Bearer ${t}`, 'user-agent': ua } });
      return { status: res.status, auth: res.headers.get('www-authenticate') ?? '' };
    };
    const t1 = await sign('gina', { sid: 'sid-g1', azp: 'civora-test-app' });
    const t2 = await sign('gina', { sid: 'sid-g2', azp: 'civora-test-app' });
    const first = await get(t1, chrome);
    const again = await get(t1, chrome);
    const stolen = await get(t1, firefox);
    const back = await get(t1, chrome);
    const other = await get(t2, chrome);
    const noSession = await get(await sign('gina'), firefox);
    assert.deepEqual([first.status, again.status, stolen.status, back.status, other.status, noSession.status], [200, 200, 401, 401, 200, 200],
      'same browser: allowed; another browser: refused, and the session stays ended; other sessions and tokens without a session go on');
    assert.match(stolen.auth, /error="invalid_token"/);
  });

  it('database: adaptive controls (G3) as the application role: outcomes, digests only, own rows only, writes through the function', async () => {
    await call('/v1/me', await sign('hugo'));
    const c = new Client({ connectionString: appDbUrl });
    await c.connect();
    const person = (await c.query("select iam.ensure_person('citizens', 'hugo', null, null) as id")).rows[0].id;
    const d = (s: string) => createHash('sha256').update(s).digest();
    const observe = async (session: string, device: string, label = 'Chrome · Linux') => {
      await c.query('begin');
      await c.query("select set_config('app.person_id', $1, true)", [person]);
      const r = (await c.query('select outcome, long_absence from iam.observe_session($1, $2, $3, $4)', [d(session), d(device), 'device-cookie', label])).rows[0];
      await c.query('commit');
      return r.long_absence ? `${r.outcome}+long` : r.outcome;
    };
    const seq = [
      await observe('s1', 'A'), await observe('s1', 'A'), await observe('s2', 'A'), await observe('s3', 'B'),
      await observe('s3', 'C'), await observe('s3', 'B'), await observe('s2', 'A', 'Firefox · Windows'),
    ];
    assert.deepEqual(seq, ['first-device', 'same', 'new-known', 'new-device', 'changed-device', 'ended', 'changed-browser']);
    const au = new URL(adminUrl as string);
    au.pathname = `/${dbName}`;
    const admin = new Client({ connectionString: au.toString() });
    await admin.connect();
    await admin.query("update iam.known_device set last_seen = now() - interval '200 days' where person_id = $1", [person]);
    await admin.end();
    assert.equal(await observe('s4', 'A'), 'new-known+long', 'a sign-in after more than 180 days without any');
    await c.query('begin');
    await c.query("select set_config('app.person_id', $1, true)", [person]);
    const rows = (await c.query('select length(device) as n, label from iam.known_device order by first_seen')).rows;
    await c.query('commit');
    assert.deepEqual(rows.map((r) => r.n), [32, 32]);
    const visibleToNobody = (await c.query('select count(*)::int as n from iam.known_device')).rows[0].n;
    await assert.rejects(c.query('insert into iam.session_context (session, person_id, device, label) values ($1, $2, $1, $3)', [d('x'), person, 'x']), /permission denied/);
    await assert.rejects(c.query('select iam.observe_session($1, $1, $2, $3)', [d('x'), 'device-cookie', 'x']), /no authenticated person/);
    await c.end();
    assert.equal(visibleToNobody, 0, 'without a person set, no row is visible');
  });

  it('database: sign-in events (G1) as the application role: handled once, failures counted, notices at most daily, functions only', async () => {
    const c = new Client({ connectionString: appDbUrl });
    await c.connect();
    const d = (s: string) => createHash('sha256').update(s).digest();
    const seq: string[] = [];
    const kinds = ['failure', 'failure', 'failure', 'failure', 'failure', 'failure', 'success', 'second-factor-failure', 'second-factor-failure',
      'credential-change', 'failure', 'failure', 'failure', 'success'];
    for (const [i, k] of kinds.entries()) {
      const r = (await c.query('select notice, failures from iam.record_signin_event($1, $2, $3, now())', [d(`ev-${i}`), d('account-1'), k])).rows[0];
      seq.push(`${r.notice ?? '-'}:${r.failures}`);
    }
    assert.deepEqual(seq, ['-:1', '-:2', '-:3', '-:4', 'failed-attempts:5', '-:6', 'signed-in-after-failures:6', 'second-factor-failed:1', '-:2',
      'credential-change:0', '-:3', '-:4', '-:5', 'signed-in-after-failures:5'], 'the second time five failures are reached the same day sends nothing');
    const replay = (await c.query('select notice from iam.record_signin_event($1, $2, $3, now())', [d('ev-0'), d('account-1'), 'failure'])).rows[0].notice;
    assert.equal(replay, 'duplicate', 'an event read again (another replica, an overlap) is handled once');
    const old = (await c.query("select notice, failures from iam.record_signin_event($1, $2, 'failure', now() + interval '2 hours')", [d('ev-late'), d('account-1')])).rows[0];
    assert.equal(old.failures, 1, 'failures more than an hour apart start a new window');
    await assert.rejects(c.query('select * from iam.signin_watch'), /permission denied/);
    await assert.rejects(c.query('select * from iam.signin_event_seen'), /permission denied/);
    await assert.rejects(c.query("select iam.record_signin_event($1, $1, 'nonsense', now())", [d('x')]), /invalid sign-in event/);
    await c.end();
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

  it('identity links (P3-API6): single-use attempts, one person per national identity, no identifier stored (as the application role)', async () => {
    const fay = await sign('fay');
    assert.deepEqual((await call('/v1/identity/links', fay)).body, []);
    const c = new Client({ connectionString: appDbUrl });
    await c.connect();
    const person = async (realm: string, subject: string, tenant: string | null = null) =>
      (await c.query('select iam.ensure_person($1, $2, $3, null) as id', [realm, subject, tenant])).rows[0].id as string;
    const as = async <T>(who: string, fn: () => Promise<T>): Promise<T> => {
      await c.query('begin');
      await c.query("select set_config('app.person_id', $1, true)", [who]);
      try { const r = await fn(); await c.query('commit'); return r; } catch (e) { await c.query('rollback'); throw e; }
    };
    const one = async (sql: string, args: unknown[] = []) => (await c.query(sql, args)).rows[0];
    const d = (n: number) => Buffer.alloc(32, n);
    const start = (who: string, state: number) => as(who, async () => (await one('select iam.start_identity_link($1, $2, $3, 600) as id', [d(state), 'n'.repeat(43), 'v'.repeat(43)])).id as string);
    const claim = (who: string, id: string, state: number) => as(who, () => one('select * from iam.claim_identity_link($1, $2)', [id, d(state)]));
    const finish = (who: string, id: string, digest: Buffer | null) => as(who, async () => (await one("select iam.finish_identity_link($1, $2, 'eid-simulated', 'high') as o", [id, digest])).o as string);
    const p1 = await person('citizens', 'fay');
    const p2 = await person('citizens', 'gus');
    const staff = await person('staff', 'hal', '33333333-3333-4333-8333-333333333333');
    const NID = d(200); // a keyed digest as the core computes it; the identifier itself never reaches the database

    const a1 = await start(p1, 1);
    await assert.rejects(claim(p2, a1, 1), /no such open link attempt/, 'someone else cannot claim the attempt');
    await assert.rejects(claim(p1, a1, 9), /no such open link attempt/, 'wrong state');
    assert.deepEqual(await claim(p1, a1, 1), { nonce: 'n'.repeat(43), code_verifier: 'v'.repeat(43) });
    await assert.rejects(claim(p1, a1, 1), /no such open link attempt/, 'single use');
    assert.equal(await finish(p1, a1, NID), 'linked');
    await assert.rejects(finish(p1, a1, NID), /no such claimed link attempt/, 'an outcome is recorded once');

    const a2 = await start(p2, 2);
    await claim(p2, a2, 2);
    assert.equal(await finish(p2, a2, NID), 'linked-elsewhere', 'one national identity, one person');
    const a3 = await start(p1, 3);
    await claim(p1, a3, 3);
    assert.equal(await finish(p1, a3, d(201)), 'other-identity', 'an account keeps the identity it linked');
    const a4 = await start(p1, 4);
    await claim(p1, a4, 4);
    assert.equal(await finish(p1, a4, NID), 'refreshed');
    const a5 = await start(p2, 5);
    await claim(p2, a5, 5);
    assert.equal(await finish(p2, a5, null), 'rejected', 'the eID refused: recorded, nothing linked');

    await assert.rejects(start(staff, 6), /citizens only/);
    await assert.rejects(as(p2, () => one("select iam.start_identity_link($1, $2, $3, 30)", [d(7), 'n'.repeat(43), 'v'.repeat(43)])), /60\.\.900/);
    for (let i = 0; i < 3; i++) await start(p2, 10 + i);
    await assert.rejects(start(p2, 20), /too many identity link attempts/, 'five attempts per hour');
    await assert.rejects(c.query('select count(*) from iam.identity_link_attempt'), /permission denied/);
    await assert.rejects(c.query("insert into iam.identity_claim (person_id, claim_type, value_digest, source, loa) values ($1, 'national-id-link', $2, 'eid-simulated', 'high')", [p2, d(9)]), /permission denied/);
    await c.end();

    const listed = (await call('/v1/identity/links', fay)).body;
    assert.equal(listed.length, 1);
    assert.deepEqual(Object.keys(listed[0]).sort(), ['expiresAt', 'loa', 'source', 'type', 'verifiedAt'], 'never the digest');
    assert.deepEqual([listed[0].type, listed[0].source, listed[0].loa], ['national-id-link', 'eid-simulated', 'high']);
    assert.equal((await call('/v1/identity/links', await sign('gus'))).body.length, 0, 'only your own claims');
  });

  it('identity links: 503 when no eID is configured in the cell; a recent sign-in is required to start', async () => {
    const recent = await sign('ivy', { auth_time: Math.floor(Date.now() / 1000), acr: '1' });
    assert.equal((await call('/v1/identity/links', recent, { method: 'POST', body: {} })).status, 503);
    const old = await sign('ivy', { auth_time: Math.floor(Date.now() / 1000) - 3600, acr: '1' });
    const r = await call('/v1/identity/links', old, { method: 'POST', body: {} });
    assert.equal(r.status, 401);
    assert.match(r.headers.get('www-authenticate') ?? '', /insufficient_user_authentication/);
  });

  it('account recovery (P3-SEC4), database as the application role: single use, matched by digest only, level of the link, 3 per day', async () => {
    const c = new Client({ connectionString: appDbUrl });
    await c.connect();
    const d = (n: number) => Buffer.alloc(32, n);
    const one = async (sql: string, args: unknown[] = []) => (await c.query(sql, args)).rows[0];
    const start = async (state: number) => (await one('select iam.start_recovery($1, $2, $3, 600) as id', [d(state), 'n'.repeat(43), 'v'.repeat(43)])).id as string;
    const claim = (id: string, state: number) => one('select * from iam.claim_recovery($1, $2)', [id, d(state)]);
    const finish = (id: string, digest: Buffer | null, loa: string | null) => one('select * from iam.finish_recovery($1, $2, $3)', [id, digest, loa]);
    const round = async (state: number, digest: Buffer | null, loa: string | null) => { const id = await start(state); await claim(id, state); return finish(id, digest, loa); };
    const NID = d(200); // fay's linked identity (previous test), linked at level "high"

    const r1 = await start(1);
    await assert.rejects(claim(r1, 9), /no such open recovery attempt/, 'wrong state');
    assert.deepEqual(await claim(r1, 1), { nonce: 'n'.repeat(43), code_verifier: 'v'.repeat(43) });
    await assert.rejects(claim(r1, 1), /no such open recovery attempt/, 'single use');
    const won = await finish(r1, NID, 'high');
    assert.deepEqual([won.outcome, won.subject, /^[0-9a-f-]{36}$/.test(won.person_id)], ['recovered', 'fay', true], 'the account to reset: by subject');
    await assert.rejects(finish(r1, NID, 'high'), /no such claimed recovery attempt/, 'an outcome is recorded once');
    assert.equal((await round(2, d(250), 'high')).outcome, 'no-account', 'an identity linked to no account');
    assert.equal((await round(3, NID, 'substantial')).outcome, 'level-too-low', 'below the level of the link (high)');
    const rej = await round(4, null, null);
    assert.deepEqual([rej.outcome, rej.person_id, rej.subject], ['rejected', null, null]);
    assert.equal((await round(5, NID, 'high')).outcome, 'recovered');
    assert.equal((await round(6, NID, 'high')).outcome, 'recovered');
    assert.equal((await round(7, NID, 'high')).outcome, 'limited', 'at most 3 recoveries of one person in 24 hours');
    await assert.rejects(one('select iam.start_recovery($1, $2, $3, 30)', [d(8), 'n'.repeat(43), 'v'.repeat(43)]), /60\.\.900/);
    await assert.rejects(c.query('select count(*) from iam.recovery_attempt'), /permission denied/);
    await c.end();
  });

  it('status page (P3-R2), database as the application role: 3 codes per reference, 5 tries, single use, bound to the reference', async () => {
    const c = new Client({ connectionString: appDbUrl });
    await c.connect();
    const { randomUUID } = await import('node:crypto');
    const ref = Buffer.alloc(32, 1);
    const other = Buffer.alloc(32, 2);
    const code = (n: number) => Buffer.alloc(32, n);
    const create = async (id: string, deliverable = true, r = ref) => (await c.query('select iam.create_status_challenge($1, $2, $3, $4) as s', [id, r, code(9), deliverable])).rows[0].s as boolean;
    const verify = async (id: string, k: number, r = ref) => (await c.query('select iam.verify_status_challenge($1, $2, $3) as ok', [id, r, code(k)])).rows[0].ok as boolean;
    const ids = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
    const sends = [];
    for (const id of ids) sends.push(await create(id));
    assert.deepEqual(sends, [true, true, true, false], 'a fourth code within 15 minutes is not sent');
    assert.equal(await verify(ids[3]!, 9), false, 'a challenge whose code was not sent never verifies');
    assert.equal(await verify(ids[0]!, 9, other), false, 'bound to its reference');
    assert.equal(await verify(ids[0]!, 9), true);
    assert.equal(await verify(ids[0]!, 9), false, 'single use');
    for (let i = 0; i < 5; i++) assert.equal(await verify(ids[1]!, 1), false);
    assert.equal(await verify(ids[1]!, 9), false, 'after 5 wrong tries even the right code fails');
    const unknown = randomUUID();
    assert.equal(await create(unknown, false, other), false, 'unknown reference: a challenge, no code');
    assert.equal(await verify(unknown, 9, other), false);
    await assert.rejects(c.query('select count(*) from iam.status_challenge'), /permission denied/);
    await c.end();
    assert.equal((await call('/v1/status-access', undefined, { method: 'POST', body: { reference: 'SYN-RC-1-00001' } })).status, 503, 'no case directory in this cell: 503');
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
