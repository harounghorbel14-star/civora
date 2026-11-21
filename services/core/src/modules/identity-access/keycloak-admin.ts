import { readSecret } from '../../config/app-config';

/**
 * The core's narrow use of Keycloak's admin API in the citizens realm: find a user by e-mail, create a user without
 * any credential, send the activation link. It authenticates as the confidential client civora-core-provisioner,
 * whose service account holds only realm-management manage-users / view-users / query-users (checked by
 * infra/scripts/check-realm-security.py).
 */
export interface ProvisionerConfig {
  /** Keycloak as the core reaches it inside the cell, e.g. http://keycloak:8080. */
  baseUrl: string;
  realm: string;
  clientId: string;
  clientSecret: string;
  /** Where the activation page sends the citizen afterwards (must be a redirect URI of activationClientId). */
  activationRedirectUri: string;
  activationClientId: string;
  activationLifespanSeconds: number;
  /** Minimum time between two activation e-mails to one address. */
  resendIntervalMinutes: number;
}

/** Null when registration is not configured in this cell (the endpoint then answers 503). */
export function loadProvisionerConfig(env: NodeJS.ProcessEnv = process.env): ProvisionerConfig | null {
  const environment = env.CIVORA_ENV ?? 'dev';
  const clientSecret = readSecret(env, 'KEYCLOAK_PROVISIONER_SECRET');
  if (!clientSecret || !env.OIDC_ISSUER_CITIZENS) return null;
  const issuer = new URL(env.OIDC_ISSUER_CITIZENS);
  const baseUrl = env.KEYCLOAK_INTERNAL_URL ?? issuer.origin;
  const realm = env.KEYCLOAK_CITIZENS_REALM ?? issuer.pathname.split('/').filter(Boolean).pop() ?? 'civora-citizens';
  const redirect = env.ACTIVATION_REDIRECT_URI ?? 'https://app.civora-cell.invalid/activated';
  for (const url of [baseUrl, redirect]) {
    if (new URL(url).protocol !== 'https:' && !['dev', 'test'].includes(environment)) throw new Error('Keycloak and activation URLs must use https outside dev and test');
  }
  const lifespan = Number(env.ACTIVATION_LIFESPAN_SECONDS ?? 43200);
  const resend = Number(env.ACTIVATION_RESEND_MINUTES ?? 15);
  if (!Number.isInteger(lifespan) || lifespan < 900 || lifespan > 86400) throw new Error('ACTIVATION_LIFESPAN_SECONDS must be 900..86400');
  if (!Number.isInteger(resend) || resend < 1 || resend > 1440) throw new Error('ACTIVATION_RESEND_MINUTES must be 1..1440');
  return {
    baseUrl, realm, clientSecret, activationRedirectUri: redirect, activationLifespanSeconds: lifespan, resendIntervalMinutes: resend,
    clientId: env.KEYCLOAK_PROVISIONER_CLIENT_ID ?? 'civora-core-provisioner',
    activationClientId: env.ACTIVATION_CLIENT_ID ?? 'civora-web',
  };
}

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
  private token: { value: string; until: number } | null = null;

  constructor(private readonly cfg: ProvisionerConfig, private readonly fetchImpl: typeof fetch = fetch) {}

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

  private async call(method: string, path: string, body?: unknown): Promise<Response> {
    const r = await this.fetchImpl(`${this.cfg.baseUrl}/admin/realms/${encodeURIComponent(this.cfg.realm)}${path}`, {
      method,
      headers: { authorization: `Bearer ${await this.accessToken()}`, 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    if (r.status >= 400) throw new Error(`Keycloak admin ${method} ${path.split('?')[0]}: HTTP ${r.status}`);
    return r;
  }

  async findByEmail(email: string): Promise<DirectoryUser | null> {
    const users = (await (await this.call('GET', `/users?exact=true&briefRepresentation=true&email=${encodeURIComponent(email)}`)).json()) as { id: string }[];
    if (!users[0]) return null;
    const creds = (await (await this.call('GET', `/users/${users[0].id}/credentials`)).json()) as unknown[];
    return { id: users[0].id, hasCredentials: creds.length > 0 };
  }

  async create(email: string, keycloakLocale: string): Promise<string> {
    const r = await this.call('POST', '/users', {
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
    await this.call('PUT', `/users/${userId}/execute-actions-email?${q}`, ACTIVATION_ACTIONS);
  }
}
