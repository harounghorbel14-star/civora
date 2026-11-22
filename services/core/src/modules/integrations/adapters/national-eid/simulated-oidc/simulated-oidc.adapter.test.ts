import { strict as assert } from 'node:assert';
import { before, describe, it } from 'node:test';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWK } from 'jose';
import type { IntegrationCall } from '../../../integration-log';
import { EidRejected, EidUnavailable } from '../../../ports/national-eid';
import { loadSimulatedEidConfig, SimulatedOidcEid, type SimulatedEidConfig } from './simulated-oidc.adapter';

/**
 * NationalEid contract, simulated-oidc adapter: the eID's signed answer is accepted only when every check holds.
 * The same cases apply to any later adapter of the port (ADR-028: one contract suite for all modes).
 */
const ISS = 'https://eid.simulator.invalid/realms/sim-national-eid';
const NOW = Date.UTC(2026, 10, 21, 12);
const SYNTHETIC = '99' + '123456';
const cfg: SimulatedEidConfig = {
  issuer: ISS, clientId: 'civora-core-eid', clientSecret: 'test-only', redirectUri: 'https://app.civora-cell.invalid/eid/callback',
  syntheticPattern: /^99[0-9]{6}$/, maxAuthAgeSeconds: 600,
};

type PrivateKey = Awaited<ReturnType<typeof generateKeyPair>>['privateKey'];
let key: PrivateKey;
let otherKey: PrivateKey;
let jwk: JWK;
before(async () => {
  const pair = await generateKeyPair('RS256');
  key = pair.privateKey;
  jwk = await exportJWK(pair.publicKey);
  otherKey = (await generateKeyPair('RS256')).privateKey;
});

interface Case { claims?: Record<string, unknown>; signWith?: 'other'; status?: number; body?: unknown; network?: boolean; iss?: string; aud?: string; exp?: number }
async function idToken(c: Case): Promise<string> {
  const iat = Math.floor(NOW / 1000) - 5;
  return new SignJWT({ typ: 'ID', azp: cfg.clientId, nonce: 'n'.repeat(43), auth_time: iat - 20, loa: 'high', national_id: SYNTHETIC, ...c.claims })
    .setProtectedHeader({ alg: 'RS256', kid: 'k1' }).setIssuer(c.iss ?? ISS).setAudience(c.aud ?? cfg.clientId).setSubject('opaque-subject')
    .setIssuedAt(iat).setExpirationTime(c.exp ?? iat + 300)
    .sign(c.signWith === 'other' ? otherKey : key);
}
async function run(c: Case = {}) {
  const logged: IntegrationCall[] = [];
  const seen: { url: string; body: string }[] = [];
  const token = await idToken(c);
  const fetchFn = (async (url: string, init: RequestInit) => {
    seen.push({ url, body: String(init.body) });
    if (c.network) throw new TypeError('fetch failed');
    return new Response(JSON.stringify(c.body ?? { id_token: token, access_token: 'x' }), { status: c.status ?? 200, headers: { 'content-type': 'application/json' } });
  }) as unknown as typeof fetch;
  const eid = new SimulatedOidcEid(cfg, (l) => logged.push(l), { keys: createLocalJWKSet({ keys: [{ ...jwk, kid: 'k1', alg: 'RS256' }] }), fetch: fetchFn, now: () => NOW });
  const out = eid.complete({ code: 'code-123', codeVerifier: 'v'.repeat(43), nonce: 'n'.repeat(43), correlationId: 'req-1' });
  return { out, logged, seen, eid };
}

describe('NationalEid contract: simulated-oidc adapter (P3-D4)', () => {
  it('accepts a verified answer; exchanges the code with PKCE as a confidential client', async () => {
    const { out, seen, logged } = await run();
    const id = await out;
    assert.equal(id.nationalId, SYNTHETIC);
    assert.equal(id.loa, 'high');
    assert.equal(id.authenticatedAt.getTime(), (Math.floor(NOW / 1000) - 25) * 1000);
    assert.match(seen[0]!.url, /\/protocol\/openid-connect\/token$/);
    assert.match(seen[0]!.body, /code_verifier=v{43}/);
    assert.equal(logged.length, 1);
    assert.equal(logged[0]!.outcome, 'ok');
  });

  it('the integration log carries no identifier, code or token', async () => {
    const { out, logged } = await run();
    await out;
    const line = JSON.stringify(logged);
    for (const secret of [SYNTHETIC, 'code-123', 'v'.repeat(43), 'n'.repeat(43)]) assert.ok(!line.includes(secret), secret);
    assert.deepEqual(Object.keys(logged[0]!).sort(), ['correlationId', 'latencyMs', 'legalBasisRef', 'mode', 'operation', 'outcome', 'port', 'provider', 'purpose']);
  });

  const refused: [string, Case][] = [
    ['another nonce (answer of another attempt)', { claims: { nonce: 'm'.repeat(43) } }],
    ['another audience', { aud: 'some-other-client' }],
    ['another issuer', { iss: 'https://evil.invalid/realms/sim-national-eid' }],
    ['expired', { exp: Math.floor(NOW / 1000) - 120 }],
    ['signed with a key that is not the eID\'s', { signWith: 'other' }],
    ['an access token instead of an ID token', { claims: { typ: 'Bearer' } }],
    ['issued to another client (azp)', { claims: { azp: 'other' } }],
    ['identifier outside the synthetic range', { claims: { national_id: String(10_000_000 + 2_345_678) } }],
    ['no identifier', { claims: { national_id: undefined } }],
    ['assurance level "low"', { claims: { loa: 'low' } }],
    ['authentication at the eID too old', { claims: { auth_time: Math.floor(NOW / 1000) - 3600 } }],
    ['no authentication time', { claims: { auth_time: undefined } }],
    ['the eID refuses the code (400)', { status: 400, body: { error: 'invalid_grant' } }],
    ['answer without an ID token', { body: { access_token: 'x' } }],
  ];
  for (const [name, c] of refused) {
    it(`refuses: ${name}`, async () => {
      const { out, logged } = await run(c);
      await assert.rejects(out, EidRejected);
      assert.equal(logged[0]!.outcome, 'rejected');
    });
  }

  it('refuses an unsigned token (alg none)', async () => {
    const unsigned = `${Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url')}.${Buffer.from(JSON.stringify({
      iss: ISS, aud: cfg.clientId, nonce: 'n'.repeat(43), auth_time: NOW / 1000, loa: 'high', national_id: SYNTHETIC, exp: NOW / 1000 + 60,
    })).toString('base64url')}.`;
    await assert.rejects((await run({ body: { id_token: unsigned } })).out, EidRejected);
  });

  it('eID down: unavailable (server error or no connection), not a refusal', async () => {
    for (const c of [{ status: 503, body: {} }, { network: true }] as Case[]) {
      const { out, logged } = await run(c);
      await assert.rejects(out, EidUnavailable);
      assert.equal(logged[0]!.outcome, 'unavailable');
    }
  });

  it('authorization URL: fresh authentication, PKCE S256, state and nonce, language', async () => {
    const { eid, out } = await run();
    await out;
    const u = new URL(eid.authorizationUrl({ state: 's'.repeat(43), nonce: 'n'.repeat(43), codeChallenge: 'c'.repeat(43), locale: 'ar' }));
    assert.equal(u.origin + u.pathname, `${ISS}/protocol/openid-connect/auth`);
    for (const [k, v] of Object.entries({ prompt: 'login', code_challenge_method: 'S256', response_type: 'code', state: 's'.repeat(43), ui_locales: 'ar', client_id: cfg.clientId })) {
      assert.equal(u.searchParams.get(k), v, k);
    }
    assert.equal(eid.mode, 'simulated');
  });

  it('configuration: unset means not configured; https outside dev and test; the redirect always https', () => {
    assert.equal(loadSimulatedEidConfig('^99[0-9]{6}$', {}), null);
    const env = { EID_SIM_ISSUER: 'http://localhost:8080/realms/sim-national-eid', EID_SIM_CLIENT_SECRET: 'x', EID_REDIRECT_URI: 'https://app.civora-cell.invalid/cb' };
    assert.equal(loadSimulatedEidConfig('^99[0-9]{6}$', { ...env, CIVORA_ENV: 'test' })!.clientId, 'civora-core-eid');
    assert.throws(() => loadSimulatedEidConfig('^99[0-9]{6}$', { ...env, CIVORA_ENV: 'prod' }), /https/);
    assert.throws(() => loadSimulatedEidConfig('^99[0-9]{6}$', { ...env, CIVORA_ENV: 'test', EID_REDIRECT_URI: 'http://app.invalid/cb' }), /https/);
    assert.equal(loadSimulatedEidConfig('^99[0-9]{6}$', { ...env, CIVORA_ENV: 'test', EID_REDIRECT_URI: 'http://localhost:3100/identity/eid/callback' })!.redirectUri, 'http://localhost:3100/identity/eid/callback');
    assert.throws(() => loadSimulatedEidConfig('^99[0-9]{6}$', { ...env, CIVORA_ENV: 'prod', EID_SIM_ISSUER: 'https://eid.invalid/realms/x', EID_REDIRECT_URI: 'http://localhost:3100/cb' }), /https/);
  });
});
