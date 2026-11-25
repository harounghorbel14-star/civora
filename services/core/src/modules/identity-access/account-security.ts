import type { AccountDirectory, IdpCredential } from './keycloak-admin';
import type { Realm, VerifiedToken } from './token-verifier';

/**
 * Sessions and authenticators of the signed-in person (P3-API3, P3-API4, P3-F2) and the step-up rule (P3-A4).
 * Keycloak holds the sessions and credentials; the core decides what a person may see and do with their own, and
 * refuses any change that would leave the account unable to sign in.
 */
export type AuthenticatorKind = 'passkey' | 'security-key' | 'totp';

/** Keycloak credential type → what the person sees. The password is not managed here (it is not an authenticator). */
export const KIND_OF: Readonly<Record<string, AuthenticatorKind>> = { 'webauthn-passwordless': 'passkey', webauthn: 'security-key', otp: 'totp' };

/** Kinds each realm offers, and the Keycloak application-initiated action that enrols them (P3-F1, P3-SEC5). */
export const ENROL_ACTION: Readonly<Record<Realm, Partial<Record<AuthenticatorKind, string>>>> = {
  citizens: { passkey: 'webauthn-register-passwordless', totp: 'CONFIGURE_TOTP' },
  staff: { 'security-key': 'webauthn-register' },
};

/** Whether an account holding these credential types can still complete its realm's login (doc 03 §2). */
export function canSignIn(realm: Realm, types: Set<string>): boolean {
  if (realm === 'citizens') return types.has('webauthn-passwordless') || (types.has('password') && types.has('otp'));
  return types.has('password') && types.has('webauthn');
}

export interface AuthenticatorView {
  id: string;
  kind: AuthenticatorKind;
  label: string | null;
  createdAt: string | null;
}

export interface SessionView {
  id: string;
  current: boolean;
  startedAt: string;
  lastAccessAt: string;
  ipAddress: string | null;
  applications: string[];
}

export type RemoveResult = 'removed' | 'not-found' | 'last-way-to-sign-in';

/** Synchronises the metadata mirror iam.authenticator (P3-DB3) for the person's account in a realm. */
export type MirrorSync = (personId: string, realm: Realm, items: AuthenticatorView[]) => Promise<void>;

/** Tells the person that a way to sign in changed (ASVS 5.0 V6.3.7); never fails the action that caused it. */
export type SecurityNotice = (realm: Realm, subject: string, event: { type: 'authenticator-removed'; kind: AuthenticatorKind }) => Promise<void>;

export class AccountSecurity {
  constructor(
    private readonly directories: Partial<Record<Realm, AccountDirectory>>,
    private readonly mirror: MirrorSync,
    private readonly notice: SecurityNotice = async () => undefined,
  ) {}

  configured(realm: Realm): boolean {
    return !!this.directories[realm];
  }

  private dir(realm: Realm): AccountDirectory {
    const d = this.directories[realm];
    if (!d) throw new Error(`no account directory for realm ${realm}`);
    return d;
  }

  async listAuthenticators(personId: string, token: VerifiedToken): Promise<AuthenticatorView[]> {
    const creds = await this.dir(token.realm).listCredentials(token.subject);
    const items = authenticatorViews(creds);
    await this.mirror(personId, token.realm, items);
    return items;
  }

  /** Removes one of the person's authenticators, unless the account could then no longer sign in. */
  async removeAuthenticator(personId: string, token: VerifiedToken, id: string): Promise<RemoveResult> {
    const dir = this.dir(token.realm);
    const creds = await dir.listCredentials(token.subject);
    const target = creds.find((c) => c.id === id && KIND_OF[c.type]);
    if (!target) return 'not-found';
    const remaining = new Set(creds.filter((c) => c.id !== id).map((c) => c.type));
    if (!canSignIn(token.realm, remaining)) return 'last-way-to-sign-in';
    await dir.deleteCredential(token.subject, id);
    await this.mirror(personId, token.realm, authenticatorViews(creds.filter((c) => c.id !== id)));
    await this.notice(token.realm, token.subject, { type: 'authenticator-removed', kind: KIND_OF[target.type]! }).catch(() => undefined);
    return 'removed';
  }

  async listSessions(token: VerifiedToken): Promise<SessionView[]> {
    const sessions = await this.dir(token.realm).listSessions(token.subject);
    return sessions.map((s) => ({
      id: s.id, current: s.id === token.sessionId, startedAt: s.startedAt.toISOString(), lastAccessAt: s.lastAccessAt.toISOString(),
      ipAddress: s.ipAddress, applications: s.clients,
    }));
  }

  /** Ends one of the person's own sessions (a session of someone else is "not found"). */
  async removeSession(token: VerifiedToken, sessionId: string): Promise<'removed' | 'not-found'> {
    const dir = this.dir(token.realm);
    if (!(await dir.listSessions(token.subject)).some((s) => s.id === sessionId)) return 'not-found';
    await dir.deleteSession(sessionId);
    return 'removed';
  }

  /** Ends every session of the person except the one this token belongs to (ASVS 5.0 V7.4.3, V7.5.2). */
  async removeOtherSessions(token: VerifiedToken): Promise<number> {
    if (!token.sessionId) return 0; // without a session id the current session cannot be told apart: end nothing
    const dir = this.dir(token.realm);
    const others = (await dir.listSessions(token.subject)).filter((s) => s.id !== token.sessionId);
    for (const s of others) await dir.deleteSession(s.id);
    return others.length;
  }
}

function authenticatorViews(creds: IdpCredential[]): AuthenticatorView[] {
  return creds.filter((c) => KIND_OF[c.type]).map((c) => ({
    id: c.id, kind: KIND_OF[c.type]!, label: c.label, createdAt: c.createdAt ? c.createdAt.toISOString() : null,
  }));
}

/**
 * Step-up (P3-A4), RFC 9470: a sensitive action needs a sign-in in which credentials were presented (acr not "0",
 * i.e. not a session reused through single sign-on) within the last maxAgeSeconds.
 */
export function recentlyAuthenticated(token: Pick<VerifiedToken, 'authTime' | 'acr'>, maxAgeSeconds: number, nowSeconds = Date.now() / 1000): boolean {
  if (token.authTime === null) return false;
  if (token.acr === '0') return false;
  return nowSeconds - token.authTime <= maxAgeSeconds && token.authTime <= nowSeconds + 30;
}

export function stepUpChallenge(maxAgeSeconds: number): string {
  return `Bearer realm="civora", error="insufficient_user_authentication", error_description="A recent sign-in is required for this action", max_age=${maxAgeSeconds}`;
}

/** STEP_UP_MAX_AGE_SECONDS (default 300 s, 30..3600). */
export function loadStepUpMaxAge(env: NodeJS.ProcessEnv = process.env): number {
  const v = Number(env.STEP_UP_MAX_AGE_SECONDS ?? 300);
  if (!Number.isInteger(v) || v < 30 || v > 3600) throw new Error('STEP_UP_MAX_AGE_SECONDS must be 30..3600');
  return v;
}
