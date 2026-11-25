import type { WebConfig } from './config';

/**
 * Cookie names and attributes. The session cookie: HttpOnly (no script can read it), SameSite=Strict (never sent on a
 * request started by another site), Secure, path /, no lifetime (ends with the browser; the server limits it too).
 * The pending-login cookie must reach the sign-in callback, a top-level navigation coming back from Keycloak, so it is
 * SameSite=Lax, limited to the callback path, and lives at most 10 minutes.
 */
export interface CookieSpec {
  name: string;
  options: { httpOnly: true; secure: boolean; sameSite: 'strict' | 'lax'; path: string; maxAge?: number };
}

export function sessionCookie(cfg: WebConfig): CookieSpec {
  return { name: `${cfg.hostPrefix ? '__Host-' : ''}civora_session`, options: { httpOnly: true, secure: cfg.secureCookies, sameSite: 'strict', path: '/' } };
}

export function pendingCookie(cfg: WebConfig): CookieSpec {
  // __Host- requires path /, so the pending cookie uses __Secure- on https (path-limited).
  return { name: `${cfg.hostPrefix ? '__Secure-' : ''}civora_login`, options: { httpOnly: true, secure: cfg.secureCookies, sameSite: 'lax', path: '/auth/callback', maxAge: 600 } };
}

/** A recovery attempt in this browser (no session yet); read only by the eID completion route, after the interstitial. */
export function recoveryCookie(cfg: WebConfig): CookieSpec {
  return { name: `${cfg.hostPrefix ? '__Secure-' : ''}civora_recovery`, options: { httpOnly: true, secure: cfg.secureCookies, sameSite: 'strict', path: '/identity/eid/complete', maxAge: 600 } };
}
