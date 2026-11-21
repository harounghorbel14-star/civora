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

  async listCredentials(userId: string): Promise<IdpCredential[]> {
    const rows = await this.admin.json<{ id: string; type: string; userLabel?: string; createdDate?: number }[]>(
      'GET', `/users/${encodeURIComponent(userId)}/credentials`);
    return rows.map((c) => ({ id: c.id, type: c.type, label: c.userLabel ?? null, createdAt: c.createdDate ? new Date(c.createdDate) : null }));
  }

  async deleteCredential(userId: string, credentialId: string): Promise<void> {
    await this.admin.call('DELETE', `/users/${encodeURIComponent(userId)}/credentials/${encodeURIComponent(credentialId)}`);
  }
}
