import { type KeycloakEvent, WATCHED_EVENTS } from './signin-events';
import { readSecret } from '../../config/app-config';
import type { Realm } from './token-verifier';

/**
 * The core's narrow use of Keycloak's admin API, per realm, as the confidential client civora-core-provisioner whose
 * service account holds only realm-management manage-users / view-users / query-users (checked by
 * infra/scripts/check-realm-security.py). Citizens realm: registration (find, create without credential, activation
 * link). Both realms: the signed-in person's own sessions and authenticators (the core checks ownership first).
 */
export interface AdminConfig {
  /** Keycloak as the core reaches it inside the cell, e.g. http://keycloak:8080. */
  baseUrl: string;
  realm: string;
  clientId: string;
  clientSecret: string;
}

const SECRET_VAR: Record<Realm, string> = { citizens: 'KEYCLOAK_PROVISIONER_SECRET', staff: 'KEYCLOAK_STAFF_PROVISIONER_SECRET' };
const ISSUER_VAR: Record<Realm, string> = { citizens: 'OIDC_ISSUER_CITIZENS', staff: 'OIDC_ISSUER_STAFF' };
const REALM_VAR: Record<Realm, string> = { citizens: 'KEYCLOAK_CITIZENS_REALM', staff: 'KEYCLOAK_STAFF_REALM' };

const insecureAllowed = (env: NodeJS.ProcessEnv): boolean => ['dev', 'test'].includes(env.CIVORA_ENV ?? 'dev');

/** Null when the realm's provisioner is not configured in this cell (dependent endpoints then answer 503). */
export function loadAdminConfig(realm: Realm, env: NodeJS.ProcessEnv = process.env): AdminConfig | null {
  const clientSecret = readSecret(env, SECRET_VAR[realm]);
  const issuerUrl = env[ISSUER_VAR[realm]];
  if (!clientSecret || !issuerUrl) return null;
  const issuer = new URL(issuerUrl);
  const baseUrl = env.KEYCLOAK_INTERNAL_URL ?? issuer.origin;
  if (new URL(baseUrl).protocol !== 'https:' && !insecureAllowed(env)) throw new Error('Keycloak and activation URLs must use https outside dev and test');
  return {
    baseUrl,
    realm: env[REALM_VAR[realm]] ?? issuer.pathname.split('/').filter(Boolean).pop() ?? `civora-${realm}`,
    clientId: env.KEYCLOAK_PROVISIONER_CLIENT_ID ?? 'civora-core-provisioner',
    clientSecret,
  };
}

export interface ProvisionerConfig extends AdminConfig {
  /** Where the activation page sends the citizen afterwards (must be a redirect URI of activationClientId). */
  activationRedirectUri: string;
  activationClientId: string;
  activationLifespanSeconds: number;
  /** Minimum time between two activation e-mails to one address. */
  resendIntervalMinutes: number;
}

/** Citizen registration settings; null when registration is not configured in this cell (the endpoint answers 503). */
export function loadProvisionerConfig(env: NodeJS.ProcessEnv = process.env): ProvisionerConfig | null {
  const admin = loadAdminConfig('citizens', env);
  if (!admin) return null;
  const redirect = env.ACTIVATION_REDIRECT_URI ?? 'https://app.civora-cell.invalid/activated';
  if (new URL(redirect).protocol !== 'https:' && !insecureAllowed(env)) throw new Error('Keycloak and activation URLs must use https outside dev and test');
  const lifespan = Number(env.ACTIVATION_LIFESPAN_SECONDS ?? 43200);
  const resend = Number(env.ACTIVATION_RESEND_MINUTES ?? 15);
  if (!Number.isInteger(lifespan) || lifespan < 900 || lifespan > 86400) throw new Error('ACTIVATION_LIFESPAN_SECONDS must be 900..86400');
  if (!Number.isInteger(resend) || resend < 1 || resend > 1440) throw new Error('ACTIVATION_RESEND_MINUTES must be 1..1440');
  return {
    ...admin, activationRedirectUri: redirect, activationLifespanSeconds: lifespan, resendIntervalMinutes: resend,
    activationClientId: env.ACTIVATION_CLIENT_ID ?? 'civora-web',
  };
}

/** Authenticated calls to one realm's admin API (client-credentials token, cached until shortly before expiry). */
export class KeycloakAdmin {
  private token: { value: string; until: number } | null = null;

  constructor(readonly cfg: AdminConfig, private readonly fetchImpl: typeof fetch = fetch) {}

  private async accessToken(): Promise<string> {
    if (this.token && this.token.until > Date.now()) return this.token.value;
    const r = await this.fetchImpl(`${this.cfg.baseUrl}/realms/${encodeURIComponent(this.cfg.realm)}/protocol/openid-connect/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'client_credentials', client_id: this.cfg.clientId, client_secret: this.cfg.clientSecret }),
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) throw new Error(`provisioner token: HTTP ${r.status}`);
    const body = (await r.json()) as { access_token: string; expires_in: number };
    this.token = { value: body.access_token, until: Date.now() + Math.max(10, body.expires_in - 30) * 1000 };
    return body.access_token;
  }

  async call(method: string, path: string, body?: unknown): Promise<Response> {
    const r = await this.fetchImpl(`${this.cfg.baseUrl}/admin/realms/${encodeURIComponent(this.cfg.realm)}${path}`, {
      method,
      headers: { authorization: `Bearer ${await this.accessToken()}`, 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    if (r.status >= 400) throw new Error(`Keycloak admin ${method} ${path.split('?')[0]}: HTTP ${r.status}`);
    return r;
  }

  async json<T>(method: string, path: string, body?: unknown): Promise<T> {
    return (await (await this.call(method, path, body)).json()) as T;
  }
}

// ---------------------------------------------------------------- registration (citizens realm)

export interface DirectoryUser {
  id: string;
  hasCredentials: boolean;
}

/** What the registration service needs from the identity provider (a fake replaces it in unit tests). */
export interface CitizenDirectory {
  findByEmail(email: string): Promise<DirectoryUser | null>;
  create(email: string, keycloakLocale: string): Promise<string>;
  sendActivation(userId: string): Promise<void>;
}

/** First credentials come only from this link: second factor, then password (realm required-action priorities). */
export const ACTIVATION_ACTIONS = ['VERIFY_EMAIL', 'CONFIGURE_TOTP', 'UPDATE_PASSWORD'];

export class KeycloakCitizenDirectory implements CitizenDirectory {
  private readonly admin: KeycloakAdmin;

  constructor(private readonly cfg: ProvisionerConfig, fetchImpl: typeof fetch = fetch) {
    this.admin = new KeycloakAdmin(cfg, fetchImpl);
  }

  async findByEmail(email: string): Promise<DirectoryUser | null> {
    const users = await this.admin.json<{ id: string }[]>('GET', `/users?exact=true&briefRepresentation=true&email=${encodeURIComponent(email)}`);
    if (!users[0]) return null;
    const creds = await this.admin.json<unknown[]>('GET', `/users/${users[0].id}/credentials`);
    return { id: users[0].id, hasCredentials: creds.length > 0 };
  }

  async create(email: string, keycloakLocale: string): Promise<string> {
    const r = await this.admin.call('POST', '/users', {
      username: email, email, enabled: true, emailVerified: false, attributes: { locale: [keycloakLocale] }, requiredActions: [],
    });
    const id = r.headers.get('location')?.split('/').pop();
    if (!id) throw new Error('Keycloak admin POST /users: no location');
    return id;
  }

  async sendActivation(userId: string): Promise<void> {
    const q = new URLSearchParams({
      lifespan: String(this.cfg.activationLifespanSeconds), client_id: this.cfg.activationClientId, redirect_uri: this.cfg.activationRedirectUri,
    });
    await this.admin.call('PUT', `/users/${userId}/execute-actions-email?${q}`, ACTIVATION_ACTIONS);
  }
}

/** After recovery the person enrols again exactly as at activation: second factor first, then a new password. */
export const RECOVERY_ACTIONS = ['CONFIGURE_TOTP', 'UPDATE_PASSWORD'];

/** What account recovery needs from the identity provider (a fake replaces it in unit tests). */
export interface RecoveryDirectory {
  /**
   * Removes every way to sign in, ends every session and e-mails a fresh activation link (the account, its subject and
   * everything attached to it stay). Returns the address and language for the notice; null if the account is gone or
   * disabled (nothing is changed then).
   */
  reset(userId: string): Promise<{ email: string; locale: string | null } | null>;
}

export class KeycloakRecoveryDirectory implements RecoveryDirectory {
  private readonly admin: KeycloakAdmin;

  constructor(private readonly cfg: ProvisionerConfig, fetchImpl: typeof fetch = fetch) {
    this.admin = new KeycloakAdmin(cfg, fetchImpl);
  }

  async reset(userId: string): Promise<{ email: string; locale: string | null } | null> {
    const id = encodeURIComponent(userId);
    let user: { email?: string; enabled?: boolean; attributes?: Record<string, string[]> };
    try {
      user = await this.admin.json('GET', `/users/${id}`);
    } catch (e) {
      if (/HTTP 404/.test(String(e))) return null;
      throw e;
    }
    if (!user.email || user.enabled === false) return null;
    for (const c of await this.admin.json<{ id: string }[]>('GET', `/users/${id}/credentials`)) {
      await this.admin.call('DELETE', `/users/${id}/credentials/${encodeURIComponent(c.id)}`);
    }
    await this.admin.call('POST', `/users/${id}/logout`);
    const q = new URLSearchParams({
      lifespan: String(this.cfg.activationLifespanSeconds), client_id: this.cfg.activationClientId, redirect_uri: this.cfg.activationRedirectUri,
    });
    await this.admin.call('PUT', `/users/${id}/execute-actions-email?${q}`, RECOVERY_ACTIONS);
    return { email: user.email, locale: user.attributes?.locale?.[0] ?? null };
  }
}

// ---------------------------------------------------------------- sessions and authenticators (both realms)

export interface IdpSession {
  id: string;
  ipAddress: string | null;
  startedAt: Date;
  lastAccessAt: Date;
  clients: string[];
}

export interface IdpCredential {
  id: string;
  /** Keycloak credential type: password, otp, webauthn (security key), webauthn-passwordless (passkey). */
  type: string;
  label: string | null;
  createdAt: Date | null;
}

/** A person's own sessions and credentials in one realm (a fake replaces it in unit tests). */
export interface AccountDirectory {
  listSessions(userId: string): Promise<IdpSession[]>;
  deleteSession(sessionId: string): Promise<void>;
  listCredentials(userId: string): Promise<IdpCredential[]>;
  deleteCredential(userId: string, credentialId: string): Promise<void>;
  contact?(userId: string): Promise<{ email: string; locale: string | null } | null>;
  /** Stored sign-in events of the watched types since a time (epoch ms), newest first (needs the view-events role). */
  events?(sinceMs: number, first: number, max: number): Promise<KeycloakEvent[]>;
}

export class KeycloakAccountDirectory implements AccountDirectory {
  constructor(private readonly admin: KeycloakAdmin) {}

  async listSessions(userId: string): Promise<IdpSession[]> {
    const rows = await this.admin.json<{ id: string; ipAddress?: string; start: number; lastAccess: number; clients?: Record<string, string> }[]>(
      'GET', `/users/${encodeURIComponent(userId)}/sessions`);
    return rows.map((s) => ({
      id: s.id, ipAddress: s.ipAddress ?? null, startedAt: new Date(s.start), lastAccessAt: new Date(s.lastAccess), clients: Object.values(s.clients ?? {}),
    }));
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.admin.call('DELETE', `/sessions/${encodeURIComponent(sessionId)}`);
  }

  async events(sinceMs: number, first: number, max: number): Promise<KeycloakEvent[]> {
    const q = new URLSearchParams({ dateFrom: String(Math.max(0, Math.floor(sinceMs))), first: String(first), max: String(max) });
    for (const t of WATCHED_EVENTS) q.append('type', t);
    return this.admin.json<KeycloakEvent[]>('GET', `/events?${q}`);
  }

  async listCredentials(userId: string): Promise<IdpCredential[]> {
    const rows = await this.admin.json<{ id: string; type: string; userLabel?: string; createdDate?: number }[]>(
      'GET', `/users/${encodeURIComponent(userId)}/credentials`);
    return rows.map((c) => ({ id: c.id, type: c.type, label: c.userLabel ?? null, createdAt: c.createdDate ? new Date(c.createdDate) : null }));
  }

  /** Where to send a security notice: the account's e-mail address and language. */
  async contact(userId: string): Promise<{ email: string; locale: string | null } | null> {
    const u = await this.admin.json<{ email?: string; attributes?: Record<string, string[]> }>('GET', `/users/${encodeURIComponent(userId)}`);
    return u.email ? { email: u.email, locale: u.attributes?.locale?.[0] ?? null } : null;
  }

  async deleteCredential(userId: string, credentialId: string): Promise<void> {
    await this.admin.call('DELETE', `/users/${encodeURIComponent(userId)}/credentials/${encodeURIComponent(credentialId)}`);
  }
}

// ---------------------------------------------------------------- staff invitations (staff realm)

/** Invitation link: e-mail verified by the link, security key (approved model), then password. */
export const INVITATION_ACTIONS = ['VERIFY_EMAIL', 'webauthn-register', 'UPDATE_PASSWORD'];

export interface InvitationConfig {
  lifespanSeconds: number;
  redirectUri: string;
  clientId: string;
}

export function loadInvitationConfig(env: NodeJS.ProcessEnv = process.env): InvitationConfig {
  const lifespan = Number(env.STAFF_INVITATION_LIFESPAN_SECONDS ?? 172800);
  if (!Number.isInteger(lifespan) || lifespan < 3600 || lifespan > 604800) throw new Error('STAFF_INVITATION_LIFESPAN_SECONDS must be 3600..604800');
  const redirectUri = env.STAFF_INVITATION_REDIRECT_URI ?? 'https://workspace.civora-cell.invalid/welcome';
  if (new URL(redirectUri).protocol !== 'https:' && !insecureAllowed(env)) throw new Error('Keycloak and activation URLs must use https outside dev and test');
  return { lifespanSeconds: lifespan, redirectUri, clientId: env.STAFF_INVITATION_CLIENT_ID ?? 'civora-workspace' };
}

export interface StaffDirectory {
  /** Whether the address is already used in the staff realm (any institution). */
  exists(email: string): Promise<boolean>;
  create(email: string, tenantId: string, keycloakLocale: string): Promise<string>;
  sendInvitation(userId: string): Promise<void>;
  remove(userId: string): Promise<void>;
}

export class KeycloakStaffDirectory implements StaffDirectory {
  constructor(private readonly admin: KeycloakAdmin, private readonly cfg: InvitationConfig) {}

  async exists(email: string): Promise<boolean> {
    return (await this.admin.json<unknown[]>('GET', `/users?exact=true&briefRepresentation=true&email=${encodeURIComponent(email)}`)).length > 0;
  }

  async create(email: string, tenantId: string, keycloakLocale: string): Promise<string> {
    const r = await this.admin.call('POST', '/users', {
      username: email, email, enabled: true, emailVerified: false, requiredActions: [], attributes: { tenant_id: [tenantId], locale: [keycloakLocale] },
    });
    const id = r.headers.get('location')?.split('/').pop();
    if (!id) throw new Error('Keycloak admin POST /users: no location');
    return id;
  }

  async sendInvitation(userId: string): Promise<void> {
    const q = new URLSearchParams({ lifespan: String(this.cfg.lifespanSeconds), client_id: this.cfg.clientId, redirect_uri: this.cfg.redirectUri });
    await this.admin.call('PUT', `/users/${encodeURIComponent(userId)}/execute-actions-email?${q}`, INVITATION_ACTIONS);
  }

  async remove(userId: string): Promise<void> {
    await this.admin.call('DELETE', `/users/${encodeURIComponent(userId)}`);
  }
}

// ---------------------------------------------------------------- contact details (both realms; doc phase-3/16)

/** The account's contact details in Keycloak: e-mail (also the username) and the phone number with its verification. */
export interface ContactRecord {
  id: string;
  email: string | null;
  locale: string | null;
  phone: string | null;
  phoneVerified: boolean;
  enabled: boolean;
}

/** Keycloak user-profile attributes for the phone (administrators only: people change them through the core). */
export const PHONE_ATTRIBUTE = 'phone_number';
export const PHONE_VERIFIED_ATTRIBUTE = 'phone_number_verified';

/** What contact changes and recovery R4 need from the identity provider (a fake replaces it in unit tests). */
export interface ContactDirectory {
  get(userId: string): Promise<ContactRecord | null>;
  findByEmail(email: string): Promise<ContactRecord | null>;
  /** Sets a confirmed address (verified; the username follows in a realm that uses the address as username). */
  setEmail(userId: string, email: string): Promise<'updated' | 'in-use'>;
  /** Sets a confirmed number (verified), or removes it (null). */
  setPhone(userId: string, phone: string | null): Promise<void>;
}

type UserRepresentation = { id: string; username?: string; email?: string; emailVerified?: boolean; enabled?: boolean; attributes?: Record<string, string[]> };

const record = (u: UserRepresentation): ContactRecord => ({
  id: u.id, email: u.email ?? null, locale: u.attributes?.locale?.[0] ?? null, enabled: u.enabled !== false,
  phone: u.attributes?.[PHONE_ATTRIBUTE]?.[0] ?? null, phoneVerified: u.attributes?.[PHONE_VERIFIED_ATTRIBUTE]?.[0] === 'true',
});

/**
 * Keycloak's admin API needs the whole user representation on update (a partial one is refused when the profile requires
 * the e-mail; observed on 26.8.1): read, change, write back.
 */
export class KeycloakContactDirectory implements ContactDirectory {
  constructor(private readonly admin: KeycloakAdmin) {}

  private async user(userId: string): Promise<UserRepresentation | null> {
    try {
      return await this.admin.json<UserRepresentation>('GET', `/users/${encodeURIComponent(userId)}`);
    } catch (e) {
      if (/HTTP 404/.test(String(e))) return null;
      throw e;
    }
  }

  async get(userId: string): Promise<ContactRecord | null> {
    const u = await this.user(userId);
    return u ? record(u) : null;
  }

  async findByEmail(email: string): Promise<ContactRecord | null> {
    const users = await this.admin.json<UserRepresentation[]>('GET', `/users?exact=true&briefRepresentation=false&email=${encodeURIComponent(email)}`);
    const u = users.find((x) => (x.email ?? '').toLowerCase() === email.toLowerCase());
    return u ? record(u) : null;
  }

  async setEmail(userId: string, email: string): Promise<'updated' | 'in-use'> {
    const u = await this.user(userId);
    if (!u) throw new Error('Keycloak admin GET /users/{id}: HTTP 404');
    // The username is the address in both realms (citizens: e-mail as username; staff: set so at invitation).
    const username = !u.username || u.username === (u.email ?? '').toLowerCase() ? email : u.username;
    try {
      await this.admin.call('PUT', `/users/${encodeURIComponent(userId)}`, { ...u, email, emailVerified: true, username });
    } catch (e) {
      if (/HTTP 409/.test(String(e))) return 'in-use';
      throw e;
    }
    return 'updated';
  }

  async setPhone(userId: string, phone: string | null): Promise<void> {
    const u = await this.user(userId);
    if (!u) throw new Error('Keycloak admin GET /users/{id}: HTTP 404');
    const attributes = { ...(u.attributes ?? {}) };
    delete attributes[PHONE_ATTRIBUTE];
    delete attributes[PHONE_VERIFIED_ATTRIBUTE];
    if (phone) Object.assign(attributes, { [PHONE_ATTRIBUTE]: [phone], [PHONE_VERIFIED_ATTRIBUTE]: ['true'] });
    await this.admin.call('PUT', `/users/${encodeURIComponent(userId)}`, { ...u, attributes });
  }
}
