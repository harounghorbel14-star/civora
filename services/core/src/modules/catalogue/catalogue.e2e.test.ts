import { strict as assert } from 'node:assert';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { after, before, describe, it } from 'node:test';
import type { INestApplication } from '@nestjs/common';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { Client } from 'pg';
import { verifyContent } from './catalogue.service';

/**
 * Phase 5, end to end: the editorial back office (P5-D2, P5-API3, P5-SEC1) and the public catalogue (P5-API1, P5-API4)
 * on the real application, the core and public databases as the least-privilege role, and the content key in SoftHSM
 * made by the key ceremony script (P5-SEC2). The content here is a test fixture, not a curated procedure.
 * Needs TEST_DATABASE_URL and SoftHSM 2 with OpenSC (CI: CIVORA_HSM_TESTS=required).
 */
const adminUrl = process.env.TEST_DATABASE_URL;
const MODULE = ['/usr/lib/softhsm/libsofthsm2.so', '/usr/lib/x86_64-linux-gnu/softhsm/libsofthsm2.so'].find((p) => existsSync(p));
const hsm = !!MODULE && spawnSync('softhsm2-util', ['--version']).status === 0 && spawnSync('pkcs11-tool', ['--help']).status !== null;
const required = process.env.CIVORA_HSM_TESTS === 'required';
const skip = !adminUrl ? 'TEST_DATABASE_URL not set' : !hsm && !required ? 'SoftHSM 2 and OpenSC are not installed (CI requires them)' : false;
const STAFF = 'https://keycloak.test/realms/civora-staff';
const CITIZENS = 'https://keycloak.test/realms/civora-citizens';
const OPERATOR = randomUUID();
const coreRoot = resolve(__dirname, '..', '..', '..', '..');
const repoRoot = resolve(coreRoot, '..', '..');
const ar = (a: string, f: string) => ({ ar: a, fr: f });

describe('services directory, end to end (Phase 5)', { skip }, () => {
  let app: INestApplication;
  let base: string;
  const dbs: string[] = [];
  let sign: (sub: string, staff?: { tenant: string; roles: string[] }) => Promise<string>;

  const migrate = async (dir: string, table: string): Promise<string> => {
    const name = `cat_e2e_${dir.replace(/\W/g, '')}_${Date.now()}_${process.pid}`;
    const a = new Client({ connectionString: adminUrl });
    await a.connect();
    await a.query(`create database ${name}`);
    try { await a.query('create role civora_core_app login nobypassrls'); } catch { /* exists */ }
    await a.query("alter role civora_core_app login nobypassrls password 'test-only-civora-core-app'");
    await a.end();
    dbs.push(name);
    const u = new URL(adminUrl as string);
    u.pathname = `/${name}`;
    execFileSync(resolve(coreRoot, 'node_modules', '.bin', 'node-pg-migrate'),
      ['up', '--migrations-dir', dir, '--migration-file-language', 'sql', '--migrations-table', table, '--check-order'],
      { cwd: coreRoot, env: { ...process.env, DATABASE_URL: u.toString() }, stdio: 'pipe' });
    u.username = 'civora_core_app';
    u.password = 'test-only-civora-core-app';
    return u.toString();
  };

  before(async () => {
    assert.ok(hsm, 'softhsm2 and opensc must be installed when CIVORA_HSM_TESTS=required');
    const dir = mkdtempSync(join(tmpdir(), 'catalogue-e2e-'));
    writeFileSync(join(dir, 'softhsm2.conf'), `directories.tokendir = ${dir}\nobjectstore.backend = file\nlog.level = ERROR\n`);
    const hsmEnv = { ...process.env, SOFTHSM2_CONF: join(dir, 'softhsm2.conf'), CIVORA_HSM_PIN: '57721566', CIVORA_HSM_SO_PIN: '69314718' };
    execFileSync(join(repoRoot, 'infra/scripts/issuer-key-ceremony.sh'), ['--module', MODULE!, '--token-label', 'civora-content', '--key-label', 'catalogue-content-1',
      '--key-id', '0c', '--kid', 'catalogue-content-1', '--out', join(dir, 'records'), '--operator', 'Test operator', '--witness', 'Test witness', '--init-token'],
      { env: hsmEnv, stdio: 'pipe' });
    const core = await migrate('migrations', 'schema_migrations');
    const pub = await migrate('migrations-public', 'schema_migrations_public');
    const { publicKey, privateKey } = await generateKeyPair('ES256');
    const jwks = mkdtempSync(join(tmpdir(), 'jwks-'));
    writeFileSync(join(jwks, 'jwks.json'), JSON.stringify({ keys: [{ ...(await exportJWK(publicKey)), kid: 'e2e', alg: 'ES256', use: 'sig' }] }));
    sign = (sub, staff) => new SignJWT({ typ: 'Bearer', ...(staff ? { tenant_id: staff.tenant, realm_access: { roles: staff.roles } } : {}) })
      .setProtectedHeader({ alg: 'ES256', kid: 'e2e' }).setIssuer(staff ? STAFF : CITIZENS).setAudience('civora-core').setSubject(sub)
      .setIssuedAt().setExpirationTime('5m').sign(privateKey);
    Object.assign(process.env, {
      CIVORA_ENV: 'test', DATABASE_URL: core, CATALOGUE_DATABASE_URL: pub, OIDC_ISSUER_STAFF: STAFF, OIDC_ISSUER_CITIZENS: CITIZENS, OIDC_LOCAL_JWKS_FILE: join(jwks, 'jwks.json'),
      CATALOGUE_HSM_MODULE: MODULE, CATALOGUE_SIGNING_TOKEN: 'civora-content', CATALOGUE_SIGNING_KEY_ID: '0c', CATALOGUE_SIGNING_KID: 'catalogue-content-1',
      CATALOGUE_EDITOR_TENANT: OPERATOR, SOFTHSM2_CONF: hsmEnv.SOFTHSM2_CONF, CIVORA_HSM_PIN: hsmEnv.CIVORA_HSM_PIN,
    });
    const { createApp } = await import('../../app.factory');
    app = await createApp({ logger: process.env.E2E_LOG ? undefined : false });
    await app.listen(0, '127.0.0.1');
    base = `http://127.0.0.1:${(app.getHttpServer().address() as { port: number }).port}`;
  });
  after(async () => {
    await app?.close();
    const a = new Client({ connectionString: adminUrl });
    await a.connect();
    for (const d of dbs) await a.query(`drop database if exists ${d} with (force)`);
    await a.end();
  });

  const http = async (method: string, path: string, token?: string, json?: unknown) => {
    const r = await fetch(base + path, { method, headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(json !== undefined ? { 'content-type': 'application/json' } : {}) },
      body: json !== undefined ? JSON.stringify(json) : undefined });
    const t = await r.text();
    let body: any = t;
    try { body = JSON.parse(t); } catch { /* text */ }
    return { status: r.status, body };
  };
  const editorSub = `staff-${randomUUID()}`;
  const approverSub = `staff-${randomUUID()}`;
  const editor = () => sign(editorSub, { tenant: OPERATOR, roles: ['catalogue-editor'] });
  const approver = () => sign(approverSub, { tenant: OPERATOR, roles: ['catalogue-approver', 'catalogue-editor'] });
  let serviceId: string;
  let sourceId: string;
  const draft = (note = 'first version') => ({
    title: ar('مضمون ولادة (اختبار)', 'Extrait de naissance (test)'), summary: ar('ملخص للهويّة', 'Résumé de démonstration'), institution: ar('بلدية', 'Municipalité'),
    change_note: note, last_verified_on: new Date().toISOString().slice(0, 10),
    requirements: [
      { kind: 'step', position: 1, text: ar('تقديم الطلب', 'Déposer la demande'), source_ids: [sourceId] },
      { kind: 'document', position: 1, text: ar('بطاقة التعريف', 'Carte d\'identité'), source_ids: [sourceId] },
      { kind: 'fee', position: 1, text: ar('معلوم', 'Frais'), amount_tnd: 2, source_ids: [sourceId] },
    ],
  });

  it('RBAC (P5-SEC1): citizens, staff of another institution and staff without the role are refused', async () => {
    const body = { code: 'TN-TST-002', slug: 'test-extract', category: 'civil-status', draft: {} };
    assert.equal((await http('POST', '/v1/admin/services', await sign(`citizen-${randomUUID()}`), body)).status, 403);
    assert.equal((await http('POST', '/v1/admin/services', await sign(`staff-${randomUUID()}`, { tenant: randomUUID(), roles: ['catalogue-editor'] }), body)).status, 403);
    assert.equal((await http('POST', '/v1/admin/services', await sign(`staff-${randomUUID()}`, { tenant: OPERATOR, roles: [] }), body)).status, 403);
    assert.equal((await http('POST', '/v1/admin/services', undefined, body)).status, 401);
  });

  it('editor drafts with a cited source and submits; the author cannot approve; another approver signs in the HSM; published (P5-D2, SEC2)', async () => {
    const s = await http('POST', '/v1/admin/sources', await editor(), { kind: 'official-page', title: 'Test source page', publisher: 'Test publisher', url: 'https://example.invalid/catalogue-e2e', language: 'fr', accessed_on: new Date().toISOString().slice(0, 10) });
    assert.equal(s.status, 201, JSON.stringify(s.body));
    sourceId = s.body.id;
    const c = await http('POST', '/v1/admin/services', await editor(), { code: 'TN-TST-002', slug: 'test-extract', category: 'civil-status', draft: draft() });
    assert.equal(c.status, 201, JSON.stringify(c.body));
    serviceId = c.body.id;
    assert.equal((await http('POST', `/v1/admin/services/${serviceId}/versions/1:submit`, await editor())).status, 200);
    // The editor holding the approver role too would still be the author: four-eyes is enforced on the person.
    const selfApprove = await http('POST', `/v1/admin/services/${serviceId}/versions/1:approve`, await sign(editorSub, { tenant: OPERATOR, roles: ['catalogue-approver'] }));
    assert.equal(selfApprove.status, 403, JSON.stringify(selfApprove.body));
    const a = await http('POST', `/v1/admin/services/${serviceId}/versions/1:approve`, await approver());
    assert.equal(a.status, 200, JSON.stringify(a.body));
    assert.match(a.body.signature, /^[A-Za-z0-9_-]+\.\.[A-Za-z0-9_-]+$/);
    assert.equal((await http('GET', '/v1/services/TN-TST-002')).status, 404, 'approved is not yet published');
    assert.equal((await http('POST', `/v1/admin/services/${serviceId}/versions/1:publish`, await approver())).status, 200);
  });

  it('the public page carries steps, documents, fees, sources, last verified; its signature verifies with the published key (P5-F1, SEC3)', async () => {
    const p = await http('GET', '/v1/services/test-extract');
    assert.equal(p.status, 200);
    assert.equal(p.body.code, 'TN-TST-002');
    assert.equal(p.body.steps.length, 1);
    assert.equal(p.body.fees[0].amount_tnd, 2);
    assert.equal(p.body.sources[0].url, 'https://example.invalid/catalogue-e2e');
    assert.equal(p.body.translation_review, 'pending', 'no review is claimed that was not done');
    const signed = await http('GET', '/v1/services/TN-TST-002/versions/1/content');
    const keys = await http('GET', '/v1/catalogue/keys');
    assert.equal(await verifyContent(signed.body.content, signed.body.signature, keys.body.keys[0]), true);
    assert.equal(createHash('sha256').update(signed.body.content, 'utf8').digest('base64url'), p.body.integrity.content_digest);
    assert.equal(await verifyContent(signed.body.content.replace('"amount_tnd": 2', '"amount_tnd": 20'), signed.body.signature, keys.body.keys[0]), false, 'altered content fails');
  });

  it('a second version supersedes the first; history kept (P5-F3); search finds it in Arabic and French; error reports (P5-F4)', async () => {
    assert.equal((await http('PUT', `/v1/admin/services/${serviceId}/versions/2`, await editor(), draft('fee confirmed'))).status, 200);
    await http('POST', `/v1/admin/services/${serviceId}/versions/2:submit`, await editor());
    assert.equal((await http('POST', `/v1/admin/services/${serviceId}/versions/2:request-changes`, await approver(), { comment: 'add the legal text' })).status, 200);
    await http('POST', `/v1/admin/services/${serviceId}/versions/2:submit`, await editor());
    await http('POST', `/v1/admin/services/${serviceId}/versions/2:approve`, await approver());
    await http('POST', `/v1/admin/services/${serviceId}/versions/2:publish`, await approver());
    const h = await http('GET', '/v1/services/TN-TST-002/versions');
    assert.deepEqual(h.body.map((v: { version: number; state: string }) => [v.version, v.state]), [[2, 'published'], [1, 'superseded']]);
    assert.equal((await http('GET', '/v1/services/TN-TST-002/versions/1')).body.state, 'superseded');
    assert.deepEqual((await http('GET', `/v1/services?q=${encodeURIComponent('الهوية')}`)).body.map((s: { code: string }) => s.code), ['TN-TST-002']);
    assert.deepEqual((await http('GET', '/v1/services?q=resume')).body.map((s: { code: string }) => s.code), ['TN-TST-002']);
    assert.equal((await http('POST', '/v1/feedback/content-errors', undefined, { service_code: 'TN-TST-002', version: 2, message: 'Le montant indiqué semble ancien.' })).status, 201);
    assert.equal((await http('POST', '/v1/feedback/content-errors', undefined, { service_code: 'TN-NOPE-1', version: 1, message: 'no such service here' })).status, 404);
  });
});
