import { strict as assert } from 'node:assert';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { after, before, describe, it } from 'node:test';
import type { INestApplication } from '@nestjs/common';
import { CredentialError, parse, present, softwareKey, type SoftwareKey, STATUS, statusFromToken, verifyCredential } from '@civora/credentials';
import { decryptBackup, type Fetch, Holder, MemoryCredentialStore, MemoryKeyStore } from '@civora/holder';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { Client } from 'pg';

/**
 * Phase 4 week 2, end to end: OpenID4VCI 1.0 issuance (pre-authorised code, DPoP, key proof) on the real application,
 * PostgreSQL as the least-privilege role, and the issuer key in SoftHSM made by the key ceremony script. The wallet is
 * played by this test with software device keys. Covers P4-API1, P4-API2, P4-API6, P4-F1, P4-SEC1, P4-SEC2, P4-SEC4.
 * Needs TEST_DATABASE_URL and SoftHSM 2 with OpenSC (CI: CIVORA_HSM_TESTS=required).
 */
const adminUrl = process.env.TEST_DATABASE_URL;
const MODULE = ['/usr/lib/softhsm/libsofthsm2.so', '/usr/lib/x86_64-linux-gnu/softhsm/libsofthsm2.so'].find((p) => existsSync(p));
const hsm = !!MODULE && spawnSync('softhsm2-util', ['--version']).status === 0 && spawnSync('pkcs11-tool', ['--help']).status !== null;
const required = process.env.CIVORA_HSM_TESTS === 'required';
const ISS = 'https://keycloak.test/realms/civora-citizens';
const PUBLIC = 'https://wallet.civora-cell.invalid';
const ISSUER = `${PUBLIC}/issuers/demo-civil-registry`;
const VCT = 'urn:civora:tn:synthetic:residence-certificate:1';
const CONFIG = 'residence-certificate-1';
const root = resolve(__dirname, '..', '..', '..', '..');
const repoRoot = resolve(root, '..', '..');
const display = { ar: 'السجل المدني التجريبي', fr: 'État civil de démonstration', en: 'Demo civil registry' };

const skip = !adminUrl ? 'TEST_DATABASE_URL not set' : !hsm && !required ? 'SoftHSM 2 and OpenSC are not installed (CI requires them)' : false;

describe('OpenID4VCI issuance, end to end (Phase 4 week 2)', { skip }, () => {
  let app: INestApplication;
  let base: string;
  let dbName: string;
  let admin: Client;
  let sign: (sub: string) => Promise<string>;
  let issuerJwk: Record<string, string>;

  before(async () => {
    assert.ok(hsm, 'softhsm2 and opensc must be installed when CIVORA_HSM_TESTS=required');
    // The issuer key: a SoftHSM token and the ceremony script (doc phase-4/02).
    const dir = mkdtempSync(join(tmpdir(), 'wallet-e2e-'));
    writeFileSync(join(dir, 'softhsm2.conf'), `directories.tokendir = ${dir}\nobjectstore.backend = file\nlog.level = ERROR\n`);
    const hsmEnv = { ...process.env, SOFTHSM2_CONF: join(dir, 'softhsm2.conf'), CIVORA_HSM_PIN: '31415926', CIVORA_HSM_SO_PIN: '27182818' };
    execFileSync(join(repoRoot, 'infra/scripts/issuer-key-ceremony.sh'), ['--module', MODULE!, '--token-label', 'civora-issuers', '--key-label', 'demo-civil-registry-1',
      '--key-id', '01', '--kid', 'demo-civil-registry-1', '--out', join(dir, 'records'), '--operator', 'Test operator', '--witness', 'Test witness', '--init-token'],
      { env: hsmEnv, stdio: 'pipe' });
    issuerJwk = JSON.parse(readFileSync(join(dir, 'records', 'demo-civil-registry-1.ceremony.json'), 'utf8')).public_jwk;

    dbName = `wallet_e2e_${Date.now()}_${process.pid}`;
    admin = new Client({ connectionString: adminUrl });
    await admin.connect();
    await admin.query(`create database ${dbName}`);
    // One fixed test-only password for every test file: the files run in parallel and share this role, so a
    // password per file would lock the others out mid-run.
    const appPw = 'test-only-civora-core-app';
    try { await admin.query('create role civora_core_app login nobypassrls'); } catch { /* exists */ }
    await admin.query(`alter role civora_core_app login nobypassrls password '${appPw}'`);
    await admin.end();
    const u = new URL(adminUrl as string);
    u.pathname = `/${dbName}`;
    execFileSync(resolve(root, 'node_modules', '.bin', 'node-pg-migrate'),
      ['up', '--migrations-dir', 'migrations', '--migration-file-language', 'sql', '--migrations-table', 'schema_migrations', '--check-order'],
      { cwd: root, env: { ...process.env, DATABASE_URL: u.toString() }, stdio: 'pipe' });
    admin = new Client({ connectionString: u.toString() });
    await admin.connect();
    const issuerId = (await admin.query('select wallet.register_issuer($1,$2,$3,$4,$5,$6,$7) as id',
      ['demo-civil-registry', ISSUER, display, 'demo-civil-registry-1', issuerJwk, 'civora-issuers', '01'])).rows[0].id;
    await admin.query('select wallet.register_credential_type($1,$2,$3,$4,$5,$6,$7,$8)',
      [issuerId, VCT, { ar: 'شهادة إقامة (تجريبية)', fr: 'Certificat de résidence (démonstration)', en: 'Residence certificate (demo)' },
        ['given_name', 'family_name', 'birthdate', 'address', 'address/locality', 'address/country'], ['given_name', 'family_name', 'birthdate', 'address/locality'],
        365, 'residence-certificate', [30, 7]]);
    u.username = 'civora_core_app';
    u.password = appPw;

    const { publicKey, privateKey } = await generateKeyPair('ES256');
    const jwksDir = mkdtempSync(join(tmpdir(), 'jwks-'));
    writeFileSync(join(jwksDir, 'jwks.json'), JSON.stringify({ keys: [{ ...(await exportJWK(publicKey)), kid: 'e2e', alg: 'ES256', use: 'sig' }] }));
    sign = (sub) => new SignJWT({ typ: 'Bearer' }).setProtectedHeader({ alg: 'ES256', kid: 'e2e' })
      .setIssuer(ISS).setAudience('civora-core').setSubject(sub).setIssuedAt().setExpirationTime('5m').sign(privateKey);
    Object.assign(process.env, {
      CIVORA_ENV: 'test', DATABASE_URL: u.toString(), OIDC_ISSUER_CITIZENS: ISS, OIDC_LOCAL_JWKS_FILE: join(jwksDir, 'jwks.json'),
      WALLET_PUBLIC_URL: PUBLIC, WALLET_HSM_MODULE: MODULE, SOFTHSM2_CONF: hsmEnv.SOFTHSM2_CONF, CIVORA_HSM_PIN: hsmEnv.CIVORA_HSM_PIN,
    });
    const { createApp } = await import('../../app.factory');
    app = await createApp({ logger: process.env.E2E_LOG ? undefined : false });
    await app.listen(0, '127.0.0.1');
    base = `http://127.0.0.1:${(app.getHttpServer().address() as { port: number }).port}`;
  });
  after(async () => {
    await app?.close();
    await admin?.end();
    const a = new Client({ connectionString: adminUrl });
    await a.connect();
    await a.query(`drop database if exists ${dbName} with (force)`);
    await a.end();
  });

  const http = async (method: string, path: string, opts: { token?: string; auth?: string; dpop?: string; json?: unknown; form?: Record<string, string> } = {}) => {
    const headers: Record<string, string> = {};
    if (opts.token) headers.authorization = `Bearer ${opts.token}`;
    if (opts.auth) headers.authorization = opts.auth;
    if (opts.dpop) headers.dpop = opts.dpop;
    let body: string | undefined;
    if (opts.json !== undefined) { headers['content-type'] = 'application/json'; body = JSON.stringify(opts.json); }
    if (opts.form) { headers['content-type'] = 'application/x-www-form-urlencoded'; body = new URLSearchParams(opts.form).toString(); }
    const res = await fetch(base + path, { method, headers, body });
    const text = await res.text();
    let parsed: unknown = text;
    try { parsed = JSON.parse(text); } catch { /* not JSON */ }
    return { status: res.status, headers: res.headers, body: parsed as Record<string, any> };
  };
  const dpop = (key: SoftwareKey, htu: string, accessToken?: string, extra: Record<string, unknown> = {}) =>
    new SignJWT({ htm: 'POST', htu, jti: randomUUID(), ...(accessToken ? { ath: createHash('sha256').update(accessToken).digest('base64url') } : {}), ...extra })
      .setProtectedHeader({ alg: 'ES256', typ: 'dpop+jwt', jwk: key.publicJwk as never }).setIssuedAt().sign(key.privateKey);
  const keyProof = (key: SoftwareKey, nonce: string, aud = ISSUER) =>
    new SignJWT({ nonce }).setProtectedHeader({ alg: 'ES256', typ: 'openid4vci-proof+jwt', jwk: key.publicJwk as never }).setAudience(aud).setIssuedAt().sign(key.privateKey);

  const person = `citizen-${randomUUID()}`;
  const offer = async () => {
    const r = await http('POST', `/v1/issuers/demo-civil-registry/credential-offers`, { token: await sign(person), json: { credential_configuration_id: CONFIG } });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    return { code: r.body.credential_offer.grants['urn:ietf:params:oauth:grant-type:pre-authorized_code']['pre-authorized_code'] as string, tx: r.body.tx_code as string, uri: r.body.offer_uri as string };
  };
  const token = async (wallet: SoftwareKey, code: string, tx: string) =>
    http('POST', '/v1/oid4vci/token', { dpop: await dpop(wallet, `${PUBLIC}/v1/oid4vci/token`), form: { grant_type: 'urn:ietf:params:oauth:grant-type:pre-authorized_code', 'pre-authorized_code': code, tx_code: tx } });
  const nonce = async () => (await http('POST', '/v1/oid4vci/nonce')).body.c_nonce as string;
  const credential = async (wallet: SoftwareKey, accessToken: string, proof: string, configId = CONFIG) =>
    http('POST', '/v1/oid4vci/credential', { auth: `DPoP ${accessToken}`, dpop: await dpop(wallet, `${PUBLIC}/v1/oid4vci/credential`, accessToken), json: { credential_configuration_id: configId, proofs: { jwt: [proof] } } });

  it('metadata: issuer (OpenID4VCI) and authorization server (RFC 8414), with the configuration, ES256 proofs and DPoP', async () => {
    const m = await http('GET', '/.well-known/openid-credential-issuer/issuers/demo-civil-registry');
    assert.equal(m.status, 200);
    assert.equal(m.body.credential_issuer, ISSUER);
    assert.equal(m.body.credential_configurations_supported[CONFIG].vct, VCT);
    assert.equal(m.body.credential_configurations_supported[CONFIG].format, 'dc+sd-jwt');
    const as = await http('GET', '/.well-known/oauth-authorization-server/issuers/demo-civil-registry');
    assert.equal(as.body.token_endpoint, `${PUBLIC}/v1/oid4vci/token`);
    assert.deepEqual(as.body.dpop_signing_alg_values_supported, ['ES256']);
    assert.equal((await http('GET', '/.well-known/openid-credential-issuer/issuers/unknown')).status, 404);
  });

  it('issue → hold → verify: offer (no personal data in the QR), DPoP token, key proof; the credential is bound to the device key, signed in the HSM, with a live status', async () => {
    assert.equal((await http('POST', '/v1/issuers/demo-civil-registry/credential-offers', { json: { credential_configuration_id: CONFIG } })).status, 401);
    const o = await offer();
    assert.match(o.tx, /^[0-9]{6}$/);
    assert.ok(o.uri.startsWith('openid-credential-offer://?credential_offer='));
    assert.ok(!decodeURIComponent(o.uri).includes(o.tx), 'the transaction code is not in the QR');
    assert.ok(!/given_name|family_name|birthdate|citizen-/.test(decodeURIComponent(o.uri)), 'no personal data in the QR (P4-SEC4)');
    const wallet = softwareKey();
    const t = await token(wallet, o.code, o.tx);
    assert.equal(t.status, 200, JSON.stringify(t.body));
    assert.equal(t.body.token_type, 'DPoP');
    assert.equal(t.headers.get('cache-control'), 'no-store');
    const device = softwareKey();
    const c = await credential(wallet, t.body.access_token, await keyProof(device, await nonce()));
    assert.equal(c.status, 200, JSON.stringify(c.body));
    const sdJwt = c.body.credentials[0].credential as string;
    const header = JSON.parse(Buffer.from(sdJwt.split('.')[0]!, 'base64url').toString());
    assert.deepEqual([header.typ, header.alg, header.kid], ['dc+sd-jwt', 'ES256', 'demo-civil-registry-1']);
    // The holder presents only the locality, bound to a verifier's nonce; verified with the ceremony record's key.
    const kb = { aud: 'x509_san_dns:verifier.civora-cell.invalid', nonce: randomBytes(16).toString('base64url') };
    const locality = parse(sdJwt).disclosures.filter((d) => /"(address|locality)"/.test(Buffer.from(d, 'base64url').toString()));
    const v = await verifyCredential(await present(sdJwt, locality, device, kb), { issuerKey: async () => issuerJwk as never, keyBinding: kb, acceptedVct: [VCT] });
    assert.equal(typeof (v.claims.address as { locality: string }).locality, 'string');
    assert.equal(v.claims.given_name, undefined, 'not disclosed');
    assert.equal(v.iss, ISSUER);
    // Another device cannot use the credential (cnf is the proof's key, P4-SEC1).
    await assert.rejects(verifyCredential(await present(sdJwt, [], softwareKey(), kb), { issuerKey: async () => issuerJwk as never, keyBinding: kb }));
    // Status: valid now; revoked after the issuer revokes it (a new list version is signed).
    const ref = v.status!.status_list;
    assert.ok(ref.uri.startsWith(`${PUBLIC}/v1/status-lists/`));
    const path = new URL(ref.uri).pathname;
    const s1 = await http('GET', path);
    assert.equal(s1.headers.get('content-type'), 'application/statuslist+jwt');
    assert.equal((await statusFromToken(s1.body as unknown as string, issuerJwk as never, ref.uri, ref.idx)).status, STATUS.VALID);
    const issued = (await admin.query('select id from wallet.issued_credential where status_list_id = $1 and status_idx = $2', [path.split('/').pop(), ref.idx])).rows[0].id;
    await admin.query("select wallet.set_credential_status($1, 'revoked', 'holder-request', 'holder:self')", [issued]);
    for (const bad of ['/v1/status-lists/1abc', '/v1/status-lists/%3Cscript%3E', '/v1/status-lists/99999999999999999999']) {
      assert.equal((await http('GET', bad)).status, 404, `${bad}: only a list number is accepted`);
    }
    assert.equal(s1.headers.get('x-content-type-options'), 'nosniff');
    const s2 = await http('GET', path);
    assert.equal((await statusFromToken(s2.body as unknown as string, issuerJwk as never, ref.uri, ref.idx)).status, STATUS.INVALID);
  });

  it('the token endpoint refuses: no DPoP proof, a wrong transaction code, a used code; five wrong codes lock the offer', async () => {
    const wallet = softwareKey();
    const o = await offer();
    const noProof = await http('POST', '/v1/oid4vci/token', { form: { grant_type: 'urn:ietf:params:oauth:grant-type:pre-authorized_code', 'pre-authorized_code': o.code, tx_code: o.tx } });
    assert.equal(noProof.body.error, 'invalid_dpop_proof');
    const wrong = o.tx === '000000' ? '000001' : '000000';
    assert.equal((await token(wallet, o.code, wrong)).body.error, 'invalid_grant');
    assert.equal((await token(wallet, o.code, o.tx)).status, 200);
    assert.equal((await token(wallet, o.code, o.tx)).body.error, 'invalid_grant', 'a code works once');
    const o2 = await offer();
    for (let i = 0; i < 5; i++) await token(wallet, o2.code, o2.tx === '123456' ? '654321' : '123456');
    assert.equal((await token(wallet, o2.code, o2.tx)).body.error, 'invalid_grant', 'locked after 5 wrong transaction codes, even with the right one');
    const proofForAnotherUrl = await dpop(wallet, `${PUBLIC}/v1/oid4vci/credential`);
    const o3 = await offer();
    const r = await http('POST', '/v1/oid4vci/token', { dpop: proofForAnotherUrl, form: { grant_type: 'urn:ietf:params:oauth:grant-type:pre-authorized_code', 'pre-authorized_code': o3.code, tx_code: o3.tx } });
    assert.equal(r.body.error, 'invalid_dpop_proof');
  });

  it('the credential endpoint refuses: a bearer token, a DPoP proof by another key, a used token, a used or unknown c_nonce, a proof for another issuer, another configuration', async () => {
    const wallet = softwareKey();
    const device = softwareKey();
    const fresh = async () => { const o = await offer(); return (await token(wallet, o.code, o.tx)).body.access_token as string; };
    const at = await fresh();
    const bearer = await http('POST', '/v1/oid4vci/credential', { auth: `Bearer ${at}`, json: { credential_configuration_id: CONFIG, proofs: { jwt: [await keyProof(device, await nonce())] } } });
    assert.equal(bearer.status, 401);
    assert.match(bearer.headers.get('www-authenticate') ?? '', /^DPoP /);
    assert.equal((await credential(softwareKey(), at, await keyProof(device, await nonce()))).body.error, 'invalid_dpop_proof');
    assert.equal((await credential(wallet, at, await keyProof(device, 'never-issued-nonce'))).body.error, 'invalid_nonce');
    assert.equal((await credential(wallet, at, await keyProof(device, await nonce(), 'https://other-issuer.invalid'))).body.error, 'invalid_proof');
    assert.equal((await credential(wallet, at, await keyProof(device, await nonce()), 'other-config-1')).body.error, 'unknown_credential_configuration');
    const n = await nonce();
    assert.equal((await credential(wallet, at, await keyProof(device, n))).status, 200, 'the same token still works after refused requests');
    assert.equal((await credential(wallet, at, await keyProof(device, await nonce()))).body.error, 'invalid_token', 'one credential per token');
    const at2 = await fresh();
    assert.equal((await credential(wallet, at2, await keyProof(device, n))).body.error, 'invalid_nonce', 'a c_nonce works once');
  });

  it('the holder library (P4-D2): accepts the offer, checks and keeps the credential, presents only the chosen claims, backs it up to the cell (P4-API3) and restores it', async () => {
    // The wallet reaches the cell at its public URL; here that URL is mapped to the test server.
    const mapped: Fetch = async (url, init) => {
      const r = await fetch(new URL(url).origin === PUBLIC ? base + url.slice(PUBLIC.length) : url, init as RequestInit);
      return { status: r.status, text: () => r.text() };
    };
    const holder = new Holder({ fetch: mapped, keys: new MemoryKeyStore(), store: new MemoryCredentialStore() });
    const o = await offer();
    const held = await holder.accept(o.uri, o.tx);
    assert.equal(held.vct, VCT);
    assert.equal(held.issuer, ISSUER);
    assert.equal(held.display.en, 'Residence certificate (demo)');
    const all = await holder.claims(held.id);
    assert.equal(typeof all.given_name, 'string');
    assert.equal(typeof all.birthdate, 'string');
    const kb = { aud: 'x509_san_dns:verifier.civora-cell.invalid', nonce: randomBytes(16).toString('base64url') };
    const vp = await holder.present(held.id, ['address/locality'], kb);
    const v = await verifyCredential(vp, { issuerKey: async () => issuerJwk as never, keyBinding: kb, acceptedVct: [VCT] });
    assert.deepEqual(v.claims.address, { locality: (all.address as { locality: string }).locality, country: 'TN' });
    assert.equal(v.claims.given_name, undefined);
    assert.equal(v.claims.birthdate, undefined);
    assert.equal(await holder.status(held.id), STATUS.VALID);
    const o2 = await offer();
    await assert.rejects(holder.accept(o2.uri, o2.tx === '111111' ? '222222' : '111111'), (e: unknown) => e instanceof CredentialError && e.code === 'token');

    // Backup: the cell keeps metadata and a ciphertext it cannot open; only this person sees it.
    const backupKey = randomBytes(32);
    const token = await sign(person);
    const added = await http('POST', '/v1/wallet/credentials', { token, json: await holder.backupEntry(held.id, backupKey) });
    assert.equal(added.status, 201, JSON.stringify(added.body));
    const list = await http('GET', '/v1/wallet/credentials', { token });
    assert.equal(list.body.length, 1);
    assert.equal(list.body[0].vct, VCT);
    const restored = JSON.parse(decryptBackup(backupKey, Buffer.from(list.body[0].backup.ciphertext, 'base64url')));
    assert.equal(restored.sdJwt, held.sdJwt);
    assert.ok(!JSON.stringify(list.body).includes(held.sdJwt.split('~')[0]!), 'the credential is not stored in clear');
    const other = await sign(`citizen-${randomUUID()}`);
    assert.deepEqual((await http('GET', '/v1/wallet/credentials', { token: other })).body, []);
    assert.equal((await http('DELETE', `/v1/wallet/credentials/${added.body.id}`, { token: other })).status, 404);
    assert.equal((await http('POST', '/v1/wallet/credentials', { token, json: { ...added.body, issuer: 'http://insecure.invalid' } })).status, 400);
    assert.equal((await http('POST', '/v1/wallet/credentials', { token, json: { ...added.body, backup: { ciphertext: 'AAAA', key_id: 'x' } } })).status, 400);
    assert.equal((await http('DELETE', `/v1/wallet/credentials/${added.body.id}`, { token })).status, 204);
    assert.deepEqual((await http('GET', '/v1/wallet/credentials', { token })).body, []);
  });
});
