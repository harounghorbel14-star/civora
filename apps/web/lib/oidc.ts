import { createHash, randomBytes } from 'node:crypto';
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import type { WebConfig } from './config';
import type { Tokens } from './session';

/**
 * OpenID Connect for the backend-for-frontend: authorization code with PKCE S256, state and nonce; the code is
 * exchanged and the ID token verified on the server; refresh tokens rotate (the realm refuses reuse); sign-out ends
 * the Keycloak session from the server.
 */
export const callbackPath = '/auth/callback';
export const randomToken = (): string => randomBytes(32).toString('base64url');

export function pkce(): { verifier: string; challenge: string } {
  const verifier = randomToken();
  return { verifier, challenge: createHash('sha256').update(verifier).digest('base64url') };
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

export function authorizeUrl(cfg: WebConfig, o: AuthorizeOptions): string {
  const q = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: cfg.appOrigin + callbackPath,
    response_type: 'code',
    scope: 'openid',
    state: o.state,
    nonce: o.nonce,
    code_challenge: o.challenge,
    code_challenge_method: 'S256',
  });
  if (o.uiLocale) q.set('ui_locales', o.uiLocale);
  if (o.reauth) { q.set('prompt', 'login'); q.set('max_age', '0'); }
  if (o.kcAction) q.set('kc_action', o.kcAction);
  return `${cfg.issuer}/protocol/openid-connect/auth?${q}`;
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

async function tokenRequest(cfg: WebConfig, body: Record<string, string>, fetchFn: typeof fetch): Promise<TokenResponse> {
  const res = await fetchFn(`${cfg.issuerInternal}/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: cfg.clientId, ...body }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new OidcError(`token endpoint answered ${res.status}`);
  return (await res.json()) as TokenResponse;
}

export async function exchangeCode(cfg: WebConfig, code: string, verifier: string, fetchFn: typeof fetch = fetch, now = Date.now()): Promise<Tokens> {
  return toTokens(await tokenRequest(cfg, { grant_type: 'authorization_code', code, redirect_uri: cfg.appOrigin + callbackPath, code_verifier: verifier }, fetchFn), now);
}

export async function refreshTokens(cfg: WebConfig, t: Tokens, fetchFn: typeof fetch = fetch, now = Date.now()): Promise<Tokens> {
  return toTokens(await tokenRequest(cfg, { grant_type: 'refresh_token', refresh_token: t.refreshToken }, fetchFn), now, t.idToken);
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
      body: new URLSearchParams({ client_id: cfg.clientId, refresh_token: t.refreshToken }),
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
