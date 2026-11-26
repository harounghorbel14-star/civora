import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { createRemoteJWKSet, exportJWK, generateKeyPair, importJWK, importPKCS8, jwtVerify, type JWK, type JWTVerifyGetKey, SignJWT } from 'jose';
import type { WebConfig } from './config';
import type { DpopKey, Tokens } from './session';

/**
 * OpenID Connect for the backend-for-frontend, at ASVS 5.0 level 3 (doc phase-3/14): a confidential client that
 * authenticates with a signed JWT (`private_key_jwt`, V10.4.16); every authorization request pushed to Keycloak first
 * (PAR, V10.4.12–V10.4.13), the browser carrying only a one-minute reference; authorization code with PKCE S256, state
 * and nonce kept on the server; access tokens bound to a key per session (DPoP, V10.3.5, V10.4.14): the core refuses
 * them without a fresh proof from that key, which never leaves this server. Refresh tokens rotate; sign-out ends the
 * Keycloak session from the server.
 */
export const callbackPath = '/auth/callback';
export const randomToken = (): string => randomBytes(32).toString('base64url');
const b64sha256 = (s: string): string => createHash('sha256').update(s, 'ascii').digest('base64url');

export function pkce(): { verifier: string; challenge: string } {
  const verifier = randomToken();
  return { verifier, challenge: b64sha256(verifier) };
}

export interface AuthorizeOptions {
  state: string;
  nonce: string;
  challenge: string;
  /** Keycloak language (ar, fr, en) for its pages. */
  uiLocale?: string;
  /** Re-authentication (step-up): a fresh sign-in with credentials. */
  reauth?: boolean;
  /** A Keycloak application-initiated action, e.g. webauthn-register-passwordless. */
  kcAction?: string;
}

// ---------------------------------------------------------------- client authentication (private_key_jwt)

const ASSERTION_TYPE = 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer';
const clientKeys = new Map<string, ReturnType<typeof importPKCS8>>();

/** A one-minute, single-use JWT signed with this app's key: how the app proves it is the civora-web client. */
export async function clientAssertion(cfg: WebConfig, now = Date.now()): Promise<string> {
  if (!clientKeys.has(cfg.clientKeyPem)) clientKeys.set(cfg.clientKeyPem, importPKCS8(cfg.clientKeyPem, 'ES256'));
  const key = await clientKeys.get(cfg.clientKeyPem)!;
  const iat = Math.floor(now / 1000);
  return new SignJWT({}).setProtectedHeader({ alg: 'ES256', typ: 'JWT', kid: cfg.clientKeyId })
    .setIssuer(cfg.clientId).setSubject(cfg.clientId).setAudience(cfg.issuer).setJti(randomUUID()).setIssuedAt(iat).setExpirationTime(iat + 60)
    .sign(key);
}

async function clientAuth(cfg: WebConfig): Promise<Record<string, string>> {
  return { client_id: cfg.clientId, client_assertion_type: ASSERTION_TYPE, client_assertion: await clientAssertion(cfg) };
}

// ---------------------------------------------------------------- DPoP (RFC 9449)

/** A new key for one session; its tokens are bound to it. Kept as JWK so a shared session store can hold it (PG-7). */
export async function newDpopKey(): Promise<DpopKey> {
  const { publicKey, privateKey } = await generateKeyPair('ES256', { extractable: true });
  return { privateJwk: await exportJWK(privateKey), publicJwk: await exportJWK(publicKey) };
}

/** A proof for one request: method, URL (no query), time, a fresh id, and the access token it goes with. */
export async function dpopProof(key: DpopKey, htm: string, htu: string, accessToken?: string): Promise<string> {
  const k = await importJWK(key.privateJwk as JWK, 'ES256');
  return new SignJWT({ htm, htu: htu.split(/[?#]/)[0], jti: randomUUID(), ...(accessToken ? { ath: b64sha256(accessToken) } : {}) })
    .setProtectedHeader({ alg: 'ES256', typ: 'dpop+jwt', jwk: key.publicJwk as JWK })
    .setIssuedAt()
    .sign(k);
}

// ---------------------------------------------------------------- authorization (PAR)

function authorizationParams(cfg: WebConfig, o: AuthorizeOptions): Record<string, string> {
  return {
    response_type: 'code',
    redirect_uri: cfg.appOrigin + callbackPath,
    scope: 'openid',
    state: o.state,
    nonce: o.nonce,
    code_challenge: o.challenge,
    code_challenge_method: 'S256',
    ...(o.uiLocale ? { ui_locales: o.uiLocale } : {}),
    ...(o.reauth ? { prompt: 'login', max_age: '0' } : {}),
    ...(o.kcAction ? { kc_action: o.kcAction } : {}),
  };
}

/**
 * Pushes the authorization request to Keycloak (authenticated), and returns where to send the browser: the
 * authorization endpoint with only the client id and the request reference (valid one minute, single use).
 */
export async function pushAuthorization(cfg: WebConfig, o: AuthorizeOptions, fetchFn: typeof fetch = fetch): Promise<string> {
  const res = await fetchFn(`${cfg.issuerInternal}/protocol/openid-connect/ext/par/request`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ ...authorizationParams(cfg, o), ...(await clientAuth(cfg)) }),
    signal: AbortSignal.timeout(10_000),
  });
  if (res.status !== 201) throw new OidcError(`pushed authorization request answered ${res.status}`);
  const b = (await res.json()) as { request_uri?: unknown };
  if (typeof b.request_uri !== 'string' || !b.request_uri.startsWith('urn:ietf:params:oauth:request_uri:')) throw new OidcError('no request_uri');
  return `${cfg.issuer}/protocol/openid-connect/auth?${new URLSearchParams({ client_id: cfg.clientId, request_uri: b.request_uri })}`;
}

export class OidcError extends Error {}

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  id_token?: string;
  expires_in?: number;
  refresh_expires_in?: number;
}

function toTokens(r: TokenResponse, now: number, previousIdToken?: string): Tokens {
  if (!r.access_token || !r.refresh_token || typeof r.expires_in !== 'number') throw new OidcError('incomplete token response');
  return {
    accessToken: r.access_token,
    refreshToken: r.refresh_token,
    idToken: r.id_token ?? previousIdToken ?? '',
    accessExpiresAt: now + r.expires_in * 1000,
    // Keycloak sends 0 for offline tokens; this client never gets those (default roles exclude offline_access).
    refreshExpiresAt: now + (r.refresh_expires_in && r.refresh_expires_in > 0 ? r.refresh_expires_in : r.expires_in) * 1000,
  };
}

async function tokenRequest(cfg: WebConfig, body: Record<string, string>, dpop: DpopKey, fetchFn: typeof fetch): Promise<TokenResponse> {
  const url = `${cfg.issuerInternal}/protocol/openid-connect/token`;
  const res = await fetchFn(url, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', dpop: await dpopProof(dpop, 'POST', url) },
    body: new URLSearchParams({ ...(await clientAuth(cfg)), ...body }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new OidcError(`token endpoint answered ${res.status}`);
  return (await res.json()) as TokenResponse;
}

export async function exchangeCode(cfg: WebConfig, code: string, verifier: string, dpop: DpopKey, fetchFn: typeof fetch = fetch, now = Date.now()): Promise<Tokens> {
  return toTokens(await tokenRequest(cfg, { grant_type: 'authorization_code', code, redirect_uri: cfg.appOrigin + callbackPath, code_verifier: verifier }, dpop, fetchFn), now);
}

export async function refreshTokens(cfg: WebConfig, t: Tokens, dpop: DpopKey, fetchFn: typeof fetch = fetch, now = Date.now()): Promise<Tokens> {
  return toTokens(await tokenRequest(cfg, { grant_type: 'refresh_token', refresh_token: t.refreshToken }, dpop, fetchFn), now, t.idToken);
}

let jwks: JWTVerifyGetKey | undefined;
/** Verifies the ID token of a sign-in: realm keys, issuer, audience (this client), nonce. Returns the subject. */
export async function verifyIdToken(cfg: WebConfig, idToken: string, nonce: string, keys?: JWTVerifyGetKey): Promise<string> {
  jwks ??= createRemoteJWKSet(new URL(`${cfg.issuerInternal}/protocol/openid-connect/certs`), { timeoutDuration: 5000 });
  const { payload } = await jwtVerify(idToken, keys ?? jwks, { issuer: cfg.issuer, audience: cfg.clientId, algorithms: ['RS256', 'PS256', 'ES256'], clockTolerance: 30 });
  if (payload.nonce !== nonce) throw new OidcError('nonce does not match this sign-in');
  if (payload.typ !== undefined && payload.typ !== 'ID') throw new OidcError('not an ID token');
  if (typeof payload.sub !== 'string') throw new OidcError('no subject');
  return payload.sub;
}

/** Ends the Keycloak session (and its refresh token) from the server; failures are ignored (the local session ends anyway). */
export async function endKeycloakSession(cfg: WebConfig, t: Tokens, fetchFn: typeof fetch = fetch): Promise<boolean> {
  try {
    const res = await fetchFn(`${cfg.issuerInternal}/protocol/openid-connect/logout`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ ...(await clientAuth(cfg)), refresh_token: t.refreshToken }),
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
