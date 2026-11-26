import { strict as assert } from 'node:assert';
import { before, describe, it } from 'node:test';
import { exportJWK, generateKeyPair, SignJWT, type JWK } from 'jose';
import { loadOidcConfig, TokenError, TokenVerifier } from './token-verifier';

const ISS = 'https://keycloak.test/realms/civora-citizens';
const STAFF = 'https://keycloak.test/realms/civora-staff';
const TENANT = '5b0c2f1e-8a4d-4c3b-9e2a-1f6d7c8b9a01';

type KeyPair = Awaited<ReturnType<typeof generateKeyPair>>;
type PrivateKey = KeyPair['privateKey'];

describe('access-token verification (doc 06; P3-SEC1, P3-T3 token replay/forgery)', () => {
  let key: PrivateKey;
  let otherKey: PrivateKey;
  let verifier: TokenVerifier;
  const sign = (claims: Record<string, unknown>, opts: { iss?: string; aud?: string; exp?: string | number; k?: PrivateKey; kid?: string } = {}) =>
    new SignJWT({ typ: 'Bearer', ...claims })
      .setProtectedHeader({ alg: 'ES256', kid: opts.kid ?? 'k1' })
      .setIssuer(opts.iss ?? ISS).setAudience(opts.aud ?? 'civora-core').setSubject('user-1')
      .setIssuedAt().setExpirationTime(opts.exp ?? '5m').sign(opts.k ?? key);

  before(async () => {
    const mine = await generateKeyPair('ES256', { extractable: true });
    key = mine.privateKey;
    otherKey = (await generateKeyPair('ES256')).privateKey;
    const jwk: JWK = { ...(await exportJWK(mine.publicKey)), kid: 'k1', alg: 'ES256', use: 'sig' };
    verifier = new TokenVerifier({ issuers: { citizens: ISS, staff: STAFF }, audience: 'civora-core', localJwks: { keys: [jwk] } });
  });

  it('accepts a valid citizen access token', async () => {
    const v = await verifier.verify(await sign({ locale: 'fr-TN' }));
    assert.deepEqual(v, { realm: 'citizens', subject: 'user-1', tenantId: null, locale: 'fr-TN', authTime: null, acr: null, sessionId: null, roles: [], jkt: null, clientId: null });
    // DPoP-bound tokens (RFC 9449): typ DPoP with cnf.jkt; any other combination is refused here, the proof is the guard's.
    const jkt = 'A'.repeat(43);
    const bound = await verifier.verify(await sign({ typ: 'DPoP', cnf: { jkt }, azp: 'civora-web' }));
    assert.deepEqual([bound.jkt, bound.clientId], [jkt, 'civora-web']);
    await assert.rejects(verifier.verify(await sign({ typ: 'DPoP' })), /not an access token/, 'DPoP type without a bound key');
    await assert.rejects(verifier.verify(await sign({ typ: 'Bearer', cnf: { jkt } })), /not an access token/, 'a bound key on a bearer type');
    await assert.rejects(verifier.verify(await sign({ typ: 'DPoP', cnf: { 'x5t#S256': 'abc' } })), /unsupported confirmation/, 'other confirmation methods');
    // Step-up and sessions read auth_time, acr and sid; malformed values are ignored, never trusted.
    const t = Math.floor(Date.now() / 1000) - 10;
    const w = await verifier.verify(await sign({ auth_time: t, acr: '1', sid: 'f3a1c2d4-0000-4000-8000-000000000001' }));
    assert.deepEqual([w.authTime, w.acr, w.sessionId], [t, '1', 'f3a1c2d4-0000-4000-8000-000000000001']);
    const x = await verifier.verify(await sign({ auth_time: 'yesterday', acr: 1, sid: 'x'.repeat(500) }));
    assert.deepEqual([x.authTime, x.acr, x.sessionId], [null, null, null]);
    const y = await verifier.verify(await sign({ realm_access: { roles: ['citizen', 'Bad Role', 42, 'tenant-admin'] } }));
    assert.deepEqual(y.roles, ['citizen', 'tenant-admin'], 'roles: well-formed strings only');
  });
  it('accepts a staff token carrying a tenant, and refuses one without', async () => {
    assert.equal((await verifier.verify(await sign({ tenant_id: TENANT }, { iss: STAFF }))).tenantId, TENANT);
    await assert.rejects(verifier.verify(await sign({}, { iss: STAFF })), TokenError);
  });
  it('refuses a citizen token that claims a tenant', async () => {
    await assert.rejects(verifier.verify(await sign({ tenant_id: TENANT })), TokenError);
  });
  it('refuses expired, wrong-audience, unknown-issuer and other-key tokens', async () => {
    await assert.rejects(verifier.verify(await sign({}, { exp: Math.floor(Date.now() / 1000) - 120 })), TokenError);
    await assert.rejects(verifier.verify(await sign({}, { aud: 'account' })), TokenError);
    await assert.rejects(verifier.verify(await sign({}, { iss: 'https://evil.test/realms/x' })), TokenError);
    await assert.rejects(verifier.verify(await sign({}, { k: otherKey })), TokenError);
  });
  it('refuses an ID token (typ ID) used as an access token', async () => {
    await assert.rejects(verifier.verify(await sign({ typ: 'ID' })), TokenError);
  });
  it('refuses unsigned ("alg":"none") and HMAC tokens', async () => {
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const body = b64({ iss: ISS, aud: 'civora-core', sub: 'x', typ: 'Bearer', iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 300 });
    await assert.rejects(verifier.verify(`${b64({ alg: 'none' })}.${body}.`), TokenError);
    const hs = await new SignJWT({ typ: 'Bearer' }).setProtectedHeader({ alg: 'HS256', kid: 'k1' }).setIssuer(ISS).setAudience('civora-core')
      .setSubject('x').setIssuedAt().setExpirationTime('5m').sign(new TextEncoder().encode('a-secret-anyone-could-guess-0123456789'));
    await assert.rejects(verifier.verify(hs), TokenError);
  });
  it('refuses a tampered payload (signature mismatch)', async () => {
    const [h, p, s] = (await sign({})).split('.');
    const claims = JSON.parse(Buffer.from(p!, 'base64url').toString());
    claims.sub = 'someone-else';
    await assert.rejects(verifier.verify(`${h}.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.${s}`), TokenError);
  });
  it('configuration: local keys and plain-http issuers are refused outside dev/test', () => {
    assert.throws(() => loadOidcConfig({ CIVORA_ENV: 'prod', OIDC_LOCAL_JWKS_FILE: '/tmp/x' }), /only in dev and test/);
    assert.throws(() => loadOidcConfig({ CIVORA_ENV: 'staging', OIDC_ISSUER_CITIZENS: 'http://kc/realms/c' }), /https/);
    assert.equal(loadOidcConfig({ CIVORA_ENV: 'prod', OIDC_ISSUER_CITIZENS: 'https://kc/realms/c' }).audience, 'civora-core');
    // Key URL apart from the issuer (inside the cell): same https rule, and never without its issuer.
    assert.throws(() => loadOidcConfig({ CIVORA_ENV: 'prod', OIDC_ISSUER_CITIZENS: 'https://kc/realms/c', OIDC_JWKS_URL_CITIZENS: 'http://keycloak:8080/c/certs' }), /https/);
    assert.throws(() => loadOidcConfig({ CIVORA_ENV: 'dev', OIDC_JWKS_URL_STAFF: 'http://keycloak:8080/s/certs' }), /without its issuer/);
    assert.equal(loadOidcConfig({ CIVORA_ENV: 'dev', OIDC_ISSUER_STAFF: 'http://localhost:8080/realms/s', OIDC_JWKS_URL_STAFF: 'http://keycloak:8080/s/certs' }).jwksUrls?.staff,
      'http://keycloak:8080/s/certs');
  });
});

