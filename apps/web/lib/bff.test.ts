import { strict as assert } from 'node:assert';
import { createHash, generateKeyPairSync } from 'node:crypto';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { before, describe, it } from 'node:test';
import { calculateJwkThumbprint, createLocalJWKSet, decodeProtectedHeader, exportJWK, generateKeyPair, jwtVerify, SignJWT, type JWK } from 'jose';
import { loadConfig, type WebConfig } from './config';
import { pendingCookie, sessionCookie } from './cookies';
import { coreCall, SignedOut, StepUpRequired } from './core';
import { negotiateLang, langOf } from './locales';
import { CATALOGUES, describeScopes, translator } from './messages';
import { NOTICES } from './notices';
import { exchangeCode, OidcError, pkce, pushAuthorization, verifyIdToken } from './oidc';
import { safeReturnTo } from './redirects';
import { type DpopKey, MemorySessionStore, type Tokens } from './session';

// The client's signing key (private_key_jwt) and a session's DPoP key, made for the tests.
const clientPair = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const keyFile = join(mkdtempSync(join(tmpdir(), 'web-key-')), 'client.pem');
writeFileSync(keyFile, clientPair.privateKey.export({ type: 'pkcs8', format: 'pem' }) as string, { mode: 0o600 });
const dpopPair = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const DPOP: DpopKey = { privateJwk: dpopPair.privateKey.export({ format: 'jwk' }) as JWK, publicJwk: dpopPair.publicKey.export({ format: 'jwk' }) as JWK };
const env = { CIVORA_ENV: 'test', APP_ORIGIN: 'http://localhost:3100', OIDC_ISSUER: 'http://localhost:8080/realms/civora-citizens', CORE_URL: 'http://127.0.0.1:3000', OIDC_CLIENT_KEY_FILE: keyFile };
const b64sha256 = (s: string) => createHash('sha256').update(s, 'ascii').digest('base64url');
const cfg: WebConfig = loadConfig(env);
const tokens = (now: number, accessIn = 300): Tokens => ({ accessToken: 'at', refreshToken: 'rt', idToken: 'it', accessExpiresAt: now + accessIn * 1000, refreshExpiresAt: now + 1800_000 });

describe('configuration', () => {
  it('https outside dev and test (http only for localhost in dev and test); an origin, not a URL', () => {
    assert.equal(cfg.clientId, 'civora-web');
    assert.equal(cfg.secureCookies, true, 'localhost is a secure context');
    assert.equal(cfg.hostPrefix, false);
    assert.throws(() => loadConfig({ ...env, CIVORA_ENV: 'prod' }), /https/);
    assert.throws(() => loadConfig({ ...env, APP_ORIGIN: 'http://app.example.invalid' }), /https/);
    assert.throws(() => loadConfig({ ...env, APP_ORIGIN: 'http://localhost:3100/x' }), /origin/);
    const prod = loadConfig({ ...env, CIVORA_ENV: 'prod', APP_ORIGIN: 'https://app.example.invalid', OIDC_ISSUER: 'https://id.example.invalid/realms/civora-citizens' });
    assert.equal(prod.hostPrefix, true);
    const { OIDC_CLIENT_KEY_FILE: _unused, ...noKey } = env;
    assert.throws(() => loadConfig(noKey), /OIDC_CLIENT_KEY_FILE/, 'no client key: refused (fail closed)');
  });
  it('session limits: idle 30 min and absolute 8 h by default; absolute never below idle', () => {
    assert.deepEqual([cfg.sessionIdleSeconds, cfg.sessionMaxSeconds], [1800, 28800]);
    assert.throws(() => loadConfig({ ...env, SESSION_IDLE_SECONDS: '3600', SESSION_MAX_SECONDS: '600' }), /SESSION_MAX_SECONDS/);
  });
});

describe('cookies', () => {
  it('session: HttpOnly, SameSite=Strict, Secure, path /; __Host- on https', () => {
    assert.deepEqual(sessionCookie(cfg), { name: 'civora_session', options: { httpOnly: true, secure: true, sameSite: 'strict', path: '/' } });
    const https = { ...cfg, hostPrefix: true };
    assert.equal(sessionCookie(https).name, '__Host-civora_session');
    assert.deepEqual(pendingCookie(cfg).options, { httpOnly: true, secure: true, sameSite: 'lax', path: '/auth/callback', maxAge: 600 });
  });
});

describe('redirects after sign-in: never to another site', () => {
  for (const bad of ['https://evil.invalid', '//evil.invalid', '/\\evil.invalid', '/ar/../../x', 'javascript:alert(1)', '/de/profile', '/ar/profile?x=<y>']) {
    it(`refuses ${bad}`, () => assert.equal(safeReturnTo(bad, 'fr'), '/fr'));
  }
  it('accepts paths of this app', () => {
    assert.equal(safeReturnTo('/ar/security?confirmed=1'), '/ar/security?confirmed=1');
    assert.equal(safeReturnTo('/en'), '/en');
  });
});

describe('languages', () => {
  it('Accept-Language against the cell (Arabic by default); pack locales map back to the URL language', () => {
    assert.equal(negotiateLang('fr-FR,fr;q=0.9,en;q=0.5'), 'fr');
    assert.equal(negotiateLang('de-DE'), 'ar');
    assert.equal(negotiateLang(undefined), 'ar');
    assert.equal(langOf('fr-TN'), 'fr');
    assert.equal(langOf('xx'), null);
  });
  it('the three catalogues have the same keys and placeholders', () => {
    const keys = (c: object) => Object.keys(c).sort();
    assert.deepEqual(keys(CATALOGUES.fr), keys(CATALOGUES.en));
    assert.deepEqual(keys(CATALOGUES.ar), keys(CATALOGUES.en));
    const ph = (v: unknown) => [...String(v).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join();
    for (const k of Object.keys(CATALOGUES.en)) {
      assert.equal(ph(CATALOGUES.ar[k]), ph(CATALOGUES.en[k]), `ar ${k}`);
      assert.equal(ph(CATALOGUES.fr[k]), ph(CATALOGUES.en[k]), `fr ${k}`);
    }
  });
  it('every notice of the allow-list has its text in all three languages', () => {
    for (const [name, n] of Object.entries(NOTICES)) for (const lang of ['ar', 'fr', 'en'] as const) assert.ok(CATALOGUES[lang][n.key], `${lang} ${name}`);
  });
  it('scopes in the person\'s language', () => {
    assert.equal(describeScopes(translator('en'), ['cases:read', 'payments:submit']), 'view cases, submit payments');
    assert.equal(describeScopes(translator('ar'), ['cases:read', 'payments:submit']), 'الاطلاع على الملفات، تقديم المدفوعات');
    assert.equal(translator('ar').dir, 'rtl');
  });
});

describe('server-side sessions', () => {
  it('random 256-bit ids; a new id per sign-in; idle and absolute limits; refresh-token expiry ends it', () => {
    let now = 1_000_000;
    const store = new MemorySessionStore({ idleMs: 60_000, maxMs: 300_000, now: () => now });
    const a = store.create('sub', tokens(now), DPOP);
    const b = store.create('sub', tokens(now), DPOP);
    assert.match(a.id, /^[A-Za-z0-9_-]{43}$/);
    assert.notEqual(a.id, b.id);
    now += 59_000;
    assert.ok(store.get(a.id), 'used within the idle limit');
    now += 61_000;
    assert.equal(store.get(a.id), null, 'idle too long');
    const c = store.create('sub', tokens(now), DPOP);
    for (let i = 0; i < 6; i++) { now += 55_000; store.get(c.id); }
    assert.equal(store.get(c.id), null, 'absolute limit even when active');
    const d = store.create('sub', { ...tokens(now), refreshExpiresAt: now + 10_000 }, DPOP);
    now += 11_000;
    assert.equal(store.get(d.id), null, 'refresh token expired');
    assert.equal(store.get(undefined), null);
  });
  it('pending sign-ins are single use and expire after 10 minutes', () => {
    let now = 0;
    const store = new MemorySessionStore({ idleMs: 60_000, maxMs: 300_000, now: () => now });
    const id = store.putPending({ state: 's', nonce: 'n', verifier: 'v', returnTo: '/ar' });
    assert.equal(store.takePending(id)?.state, 's');
    assert.equal(store.takePending(id), null, 'single use');
    const id2 = store.putPending({ state: 's', nonce: 'n', verifier: 'v', returnTo: '/ar' });
    now += 601_000;
    assert.equal(store.takePending(id2), null, 'expired');
  });
  it('pending sign-ins are bounded: under a flood the oldest go first (memory cannot be exhausted)', () => {
    const store = new MemorySessionStore({ idleMs: 60_000, maxMs: 300_000, maxPending: 3 });
    const ids = Array.from({ length: 5 }, (_, i) => store.putPending({ state: `s${i}`, nonce: 'n', verifier: 'v', returnTo: '/ar' }));
    assert.equal(store.pendingSize, 3);
    assert.equal(store.takePending(ids[0]), null);
    assert.equal(store.takePending(ids[1]), null);
    assert.equal(store.takePending(ids[4])?.state, 's4');
  });
  it('sessions past their absolute limit are swept when new ones are created', () => {
    let now = 0;
    const store = new MemorySessionStore({ idleMs: 60_000, maxMs: 300_000, now: () => now });
    const t: Tokens = { accessToken: 'a', refreshToken: 'r', idToken: 'i', accessExpiresAt: 1e12, refreshExpiresAt: 1e12 };
    store.create('old', t, DPOP);
    now += 301_000;
    store.create('new', t, DPOP);
    assert.equal(store.size, 1);
  });
});

describe('OpenID Connect', () => {
  let key: Awaited<ReturnType<typeof generateKeyPair>>['privateKey'];
  let jwk: JWK;
  before(async () => {
    const pair = await generateKeyPair('RS256');
    key = pair.privateKey;
    jwk = { ...(await exportJWK(pair.publicKey)), kid: 'k', alg: 'RS256' };
  });
  const idToken = (claims: Record<string, unknown>, aud = 'civora-web') => new SignJWT({ typ: 'ID', nonce: 'n1', ...claims }).setProtectedHeader({ alg: 'RS256', kid: 'k' })
    .setIssuer(cfg.issuer).setAudience(aud).setSubject('person-1').setIssuedAt().setExpirationTime('5m').sign(key);

  it('pushed authorization (PAR): the request goes from the server with a signed client assertion; the browser gets only the reference', async () => {
    const { verifier, challenge } = pkce();
    assert.match(verifier, /^[A-Za-z0-9_-]{43}$/);
    let url = '';
    let form = new URLSearchParams();
    const par = (async (u: string, init: RequestInit) => {
      url = u; form = new URLSearchParams(String(init.body));
      return new Response(JSON.stringify({ request_uri: 'urn:ietf:params:oauth:request_uri:abc', expires_in: 60 }), { status: 201 });
    }) as unknown as typeof fetch;
    const to = new URL(await pushAuthorization(cfg, { state: 's', nonce: 'n', challenge, uiLocale: 'ar', reauth: true, kcAction: 'webauthn-register-passwordless' }, par));
    assert.equal(url, 'http://localhost:8080/realms/civora-citizens/protocol/openid-connect/ext/par/request');
    assert.equal(form.get('redirect_uri'), 'http://localhost:3100/auth/callback');
    assert.equal(form.get('code_challenge_method'), 'S256');
    assert.equal(form.get('prompt'), 'login');
    assert.equal(form.get('max_age'), '0');
    assert.equal(form.get('kc_action'), 'webauthn-register-passwordless');
    assert.equal(form.get('ui_locales'), 'ar');
    assert.equal(form.get('client_assertion_type'), 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer');
    const { payload } = await jwtVerify(form.get('client_assertion')!, clientPair.publicKey, { issuer: 'civora-web', audience: cfg.issuer, algorithms: ['ES256'] });
    assert.equal(payload.sub, 'civora-web');
    assert.ok(typeof payload.jti === 'string' && (payload.exp as number) - (payload.iat as number) <= 60, 'one-minute, single-use assertion');
    assert.deepEqual([...to.searchParams.keys()].sort(), ['client_id', 'request_uri'], 'nothing but the reference in the browser URL');
    const refused = (async () => new Response('{}', { status: 400 })) as unknown as typeof fetch;
    await assert.rejects(pushAuthorization(cfg, { state: 's', nonce: 'n', challenge }, refused), OidcError);
  });
  it('ID token: verified keys, issuer, audience, nonce', async () => {
    const keys = createLocalJWKSet({ keys: [jwk] });
    assert.equal(await verifyIdToken(cfg, await idToken({}), 'n1', keys), 'person-1');
    await assert.rejects(verifyIdToken(cfg, await idToken({ nonce: 'other' }), 'n1', keys), OidcError);
    await assert.rejects(verifyIdToken(cfg, await idToken({}, 'another-client'), 'n1', keys));
    await assert.rejects(verifyIdToken(cfg, await idToken({ typ: 'Bearer' }), 'n1', keys), OidcError);
  });
  it('code exchange: the code and verifier go to the token endpoint from the server; incomplete answers are refused', async () => {
    let seen = '';
    let proof = '';
    const ok = (async (_u: string, init: RequestInit) => {
      seen = String(init.body); proof = (init.headers as Record<string, string>).dpop;
      return new Response(JSON.stringify({ access_token: 'a', refresh_token: 'r', id_token: 'i', expires_in: 300, refresh_expires_in: 1800 }));
    }) as unknown as typeof fetch;
    const t = await exchangeCode(cfg, 'c1', 'v1', DPOP, ok, 0);
    assert.match(seen, /code=c1/);
    assert.match(seen, /code_verifier=v1/);
    assert.match(seen, /client_assertion=/, 'the client authenticates (private_key_jwt)');
    const h = decodeProtectedHeader(proof);
    assert.equal(h.typ, 'dpop+jwt');
    assert.equal(await calculateJwkThumbprint(h.jwk as JWK), await calculateJwkThumbprint(DPOP.publicJwk), 'the proof names the session key');
    const { payload } = await jwtVerify(proof, dpopPair.publicKey);
    assert.deepEqual([payload.htm, payload.htu], ['POST', 'http://localhost:8080/realms/civora-citizens/protocol/openid-connect/token']);
    assert.deepEqual([t.accessExpiresAt, t.refreshExpiresAt], [300_000, 1_800_000]);
    const bad = (async () => new Response(JSON.stringify({ access_token: 'a' }))) as unknown as typeof fetch;
    await assert.rejects(exchangeCode(cfg, 'c', 'v', DPOP, bad), OidcError);
  });
});

describe('calls to the core', () => {
  const reply = (status: number, headers: Record<string, string> = {}, body = '{}') => new Response(body, { status, headers });
  it('refreshes an access token about to expire (rotation), then calls with it', async () => {
    const now = 1_000_000;
    const store = new MemorySessionStore({ idleMs: 600_000, maxMs: 3_600_000, now: () => now });
    const s = store.create('p', tokens(now, 10), DPOP);
    const calls: string[] = [];
    const f = (async (u: string, init: RequestInit) => {
      calls.push(u);
      if (u.endsWith('/token')) return new Response(JSON.stringify({ access_token: 'at2', refresh_token: 'rt2', expires_in: 300, refresh_expires_in: 1800 }));
      const headers = init.headers as Record<string, string>;
      assert.equal(headers.authorization, 'DPoP at2', 'the bound token, with the DPoP scheme');
      const { payload } = await jwtVerify(headers.dpop, dpopPair.publicKey, { typ: 'dpop+jwt' });
      assert.deepEqual([payload.htm, payload.htu, payload.ath], ['GET', 'http://127.0.0.1:3000/v1/me', b64sha256('at2')], 'a proof for this call and this token');
      return reply(200, {}, '{"id":"p"}');
    }) as unknown as typeof fetch;
    const r = await coreCall(cfg, store, s, '/v1/me', {}, f, now);
    assert.deepEqual(r, { status: 200, body: { id: 'p' } });
    assert.equal(store.get(s.id)?.tokens.refreshToken, 'rt2');
    assert.equal(store.get(s.id)?.tokens.idToken, 'it', 'the ID token is kept for sign-out');
    assert.equal(calls.length, 2);
  });
  it('step-up (insufficient_user_authentication) keeps the session; any other 401 or a refused refresh signs out', async () => {
    const now = 1_000_000;
    const store = new MemorySessionStore({ idleMs: 600_000, maxMs: 3_600_000, now: () => now });
    const s = store.create('p', tokens(now), DPOP);
    const stepUp = (async () => reply(401, { 'www-authenticate': 'Bearer error="insufficient_user_authentication", max_age=300' })) as unknown as typeof fetch;
    await assert.rejects(coreCall(cfg, store, s, '/v1/me/authenticators/x', { method: 'DELETE' }, stepUp, now), StepUpRequired);
    assert.ok(store.get(s.id));
    const refused = (async () => reply(401, { 'www-authenticate': 'Bearer error="invalid_token"' })) as unknown as typeof fetch;
    await assert.rejects(coreCall(cfg, store, s, '/v1/me', {}, refused, now), SignedOut);
    assert.equal(store.get(s.id), null);
    const s2 = store.create('p', tokens(now, 5), DPOP);
    const noRefresh = (async () => reply(400)) as unknown as typeof fetch;
    await assert.rejects(coreCall(cfg, store, s2, '/v1/me', {}, noRefresh, now), SignedOut);
    assert.equal(store.get(s2.id), null);
  });
});
