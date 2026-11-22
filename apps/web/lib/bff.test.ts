import { strict as assert } from 'node:assert';
import { before, describe, it } from 'node:test';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWK } from 'jose';
import { loadConfig, type WebConfig } from './config';
import { pendingCookie, sessionCookie } from './cookies';
import { coreCall, SignedOut, StepUpRequired } from './core';
import { negotiateLang, langOf } from './locales';
import { CATALOGUES, describeScopes, translator } from './messages';
import { NOTICES } from './notices';
import { authorizeUrl, exchangeCode, OidcError, pkce, verifyIdToken } from './oidc';
import { safeReturnTo } from './redirects';
import { MemorySessionStore, type Tokens } from './session';

const env = { CIVORA_ENV: 'test', APP_ORIGIN: 'http://localhost:3100', OIDC_ISSUER: 'http://localhost:8080/realms/civora-citizens', CORE_URL: 'http://127.0.0.1:3000' };
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
    const a = store.create('sub', tokens(now));
    const b = store.create('sub', tokens(now));
    assert.match(a.id, /^[A-Za-z0-9_-]{43}$/);
    assert.notEqual(a.id, b.id);
    now += 59_000;
    assert.ok(store.get(a.id), 'used within the idle limit');
    now += 61_000;
    assert.equal(store.get(a.id), null, 'idle too long');
    const c = store.create('sub', tokens(now));
    for (let i = 0; i < 6; i++) { now += 55_000; store.get(c.id); }
    assert.equal(store.get(c.id), null, 'absolute limit even when active');
    const d = store.create('sub', { ...tokens(now), refreshExpiresAt: now + 10_000 });
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

  it('authorization URL: code + PKCE S256, state, nonce, language; re-authentication and Keycloak actions', () => {
    const { verifier, challenge } = pkce();
    assert.match(verifier, /^[A-Za-z0-9_-]{43}$/);
    const u = new URL(authorizeUrl(cfg, { state: 's', nonce: 'n', challenge, uiLocale: 'ar', reauth: true, kcAction: 'webauthn-register-passwordless' }));
    assert.equal(u.searchParams.get('redirect_uri'), 'http://localhost:3100/auth/callback');
    assert.equal(u.searchParams.get('code_challenge_method'), 'S256');
    assert.equal(u.searchParams.get('prompt'), 'login');
    assert.equal(u.searchParams.get('max_age'), '0');
    assert.equal(u.searchParams.get('kc_action'), 'webauthn-register-passwordless');
    assert.equal(u.searchParams.get('ui_locales'), 'ar');
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
    const ok = (async (_u: string, init: RequestInit) => { seen = String(init.body); return new Response(JSON.stringify({ access_token: 'a', refresh_token: 'r', id_token: 'i', expires_in: 300, refresh_expires_in: 1800 })); }) as unknown as typeof fetch;
    const t = await exchangeCode(cfg, 'c1', 'v1', ok, 0);
    assert.match(seen, /code=c1/);
    assert.match(seen, /code_verifier=v1/);
    assert.deepEqual([t.accessExpiresAt, t.refreshExpiresAt], [300_000, 1_800_000]);
    const bad = (async () => new Response(JSON.stringify({ access_token: 'a' }))) as unknown as typeof fetch;
    await assert.rejects(exchangeCode(cfg, 'c', 'v', bad), OidcError);
  });
});

describe('calls to the core', () => {
  const reply = (status: number, headers: Record<string, string> = {}, body = '{}') => new Response(body, { status, headers });
  it('refreshes an access token about to expire (rotation), then calls with it', async () => {
    const now = 1_000_000;
    const store = new MemorySessionStore({ idleMs: 600_000, maxMs: 3_600_000, now: () => now });
    const s = store.create('p', tokens(now, 10));
    const calls: string[] = [];
    const f = (async (u: string, init: RequestInit) => {
      calls.push(u);
      if (u.endsWith('/token')) return new Response(JSON.stringify({ access_token: 'at2', refresh_token: 'rt2', expires_in: 300, refresh_expires_in: 1800 }));
      assert.equal((init.headers as Record<string, string>).authorization, 'Bearer at2');
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
    const s = store.create('p', tokens(now));
    const stepUp = (async () => reply(401, { 'www-authenticate': 'Bearer error="insufficient_user_authentication", max_age=300' })) as unknown as typeof fetch;
    await assert.rejects(coreCall(cfg, store, s, '/v1/me/authenticators/x', { method: 'DELETE' }, stepUp, now), StepUpRequired);
    assert.ok(store.get(s.id));
    const refused = (async () => reply(401, { 'www-authenticate': 'Bearer error="invalid_token"' })) as unknown as typeof fetch;
    await assert.rejects(coreCall(cfg, store, s, '/v1/me', {}, refused, now), SignedOut);
    assert.equal(store.get(s.id), null);
    const s2 = store.create('p', tokens(now, 5));
    const noRefresh = (async () => reply(400)) as unknown as typeof fetch;
    await assert.rejects(coreCall(cfg, store, s2, '/v1/me', {}, noRefresh, now), SignedOut);
    assert.equal(store.get(s2.id), null);
  });
});
