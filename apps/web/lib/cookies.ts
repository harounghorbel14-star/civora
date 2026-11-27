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

/**
 * Recovery R4 (doc phase-3/16): the e-mailed link's attempt in this browser. SameSite=Lax because the link is opened
 * from a mail client (a navigation from another site); limited to the page of that language, 30 minutes.
 */
export function recoveryLinkCookie(cfg: WebConfig, lang: string): CookieSpec {
  return { name: `${cfg.hostPrefix ? '__Secure-' : ''}civora_recovery_link`, options: { httpOnly: true, secure: cfg.secureCookies, sameSite: 'lax', path: `/${lang}/recover/phone`, maxAge: 1800 } };
}

/**
 * The device cookie (adaptive controls, doc phase-3/15): a random id that lets the core recognise this browser across
 * sign-ins (a sign-in from a new device sends a notice) and notice a session used from another browser (it is ended).
 * HttpOnly, Secure; SameSite=Lax so it also comes back with the top-level return from Keycloak; 400 days (the browser
 * limit). Only its SHA-256 digest leaves the web app; the core keeps a keyed digest of that.
 */
export function deviceCookie(cfg: WebConfig): CookieSpec {
  return { name: `${cfg.hostPrefix ? '__Host-' : ''}civora_device`, options: { httpOnly: true, secure: cfg.secureCookies, sameSite: 'lax', path: '/', maxAge: 400 * 24 * 3600 } };
}

/** A well-formed device id (32 random bytes, base64url), or null. */
export const validDeviceId = (v: string | undefined): string | null => (v && /^[A-Za-z0-9_-]{43}$/.test(v) ? v : null);
