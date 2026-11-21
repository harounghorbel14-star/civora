import { readFileSync } from 'node:fs';
import { createLocalJWKSet, createRemoteJWKSet, decodeJwt, jwtVerify, type JSONWebKeySet, type JWTVerifyGetKey } from 'jose';

/** The two Keycloak realms of a cell (P3-A1). */
export type Realm = 'citizens' | 'staff';

/** What the core trusts about a caller, after the access token has been verified. */
export interface VerifiedToken {
  realm: Realm;
  subject: string;
  tenantId: string | null;
  locale: string | null;
}

export interface OidcConfig {
  issuers: Partial<Record<Realm, string>>;
  /** Where to fetch each realm's keys when it differs from the issuer (the issuer is the public URL in tokens;
   *  inside the cell the core may reach Keycloak by its service name). Default: <issuer>/protocol/openid-connect/certs. */
  jwksUrls?: Partial<Record<Realm, string>>;
  audience: string;
  /** Development and tests only: a fixed key set instead of the issuer's JWKS endpoint. */
  localJwks?: JSONWebKeySet;
}

export class TokenError extends Error {}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
// Asymmetric algorithms only: no "none", no HMAC (a shared secret would let any client forge tokens).
const ALGORITHMS = ['RS256', 'PS256', 'ES256'];

/** Reads the OIDC settings; a local key set is refused outside development and tests. */
export function loadOidcConfig(env: NodeJS.ProcessEnv = process.env): OidcConfig {
  const environment = env.CIVORA_ENV ?? 'dev';
  const issuers: Partial<Record<Realm, string>> = {};
  if (env.OIDC_ISSUER_CITIZENS) issuers.citizens = env.OIDC_ISSUER_CITIZENS;
  if (env.OIDC_ISSUER_STAFF) issuers.staff = env.OIDC_ISSUER_STAFF;
  const jwksUrls: Partial<Record<Realm, string>> = {};
  if (env.OIDC_JWKS_URL_CITIZENS) jwksUrls.citizens = env.OIDC_JWKS_URL_CITIZENS;
  if (env.OIDC_JWKS_URL_STAFF) jwksUrls.staff = env.OIDC_JWKS_URL_STAFF;
  for (const realm of Object.keys(jwksUrls) as Realm[]) {
    if (!issuers[realm]) throw new Error(`OIDC_JWKS_URL_${realm.toUpperCase()} is set without its issuer`);
  }
  for (const url of [...Object.values(issuers), ...Object.values(jwksUrls)]) {
    const u = new URL(url as string);
    if (u.protocol !== 'https:' && !['dev', 'test'].includes(environment)) throw new Error('OIDC issuers and key URLs must use https outside dev and test');
  }
  let localJwks: JSONWebKeySet | undefined;
  if (env.OIDC_LOCAL_JWKS_FILE) {
    if (!['dev', 'test'].includes(environment)) throw new Error('OIDC_LOCAL_JWKS_FILE is allowed only in dev and test');
    localJwks = JSON.parse(readFileSync(env.OIDC_LOCAL_JWKS_FILE, 'utf8')) as JSONWebKeySet;
  }
  return { issuers, jwksUrls, audience: env.OIDC_AUDIENCE ?? 'civora-core', localJwks };
}

/**
 * Verifies Keycloak access tokens (doc 06): signature from the realm's keys, issuer, audience, expiry (5-minute
 * tokens; 30 s clock tolerance), token type "Bearer" (an ID token is refused), tenant rules per realm.
 */
export class TokenVerifier {
  private readonly keys = new Map<string, { realm: Realm; getKey: JWTVerifyGetKey }>();

  constructor(private readonly cfg: OidcConfig) {
    for (const [realm, issuer] of Object.entries(cfg.issuers) as [Realm, string][]) {
      const getKey = cfg.localJwks
        ? createLocalJWKSet(cfg.localJwks)
        : createRemoteJWKSet(new URL(cfg.jwksUrls?.[realm] ?? `${issuer}/protocol/openid-connect/certs`), { timeoutDuration: 3000, cooldownDuration: 30_000 });
      this.keys.set(issuer, { realm, getKey });
    }
  }

  get enabled(): boolean {
    return this.keys.size > 0;
  }

  async verify(token: string): Promise<VerifiedToken> {
    let issuer: string | undefined;
    try {
      issuer = decodeJwt(token).iss; // only to choose the key set; nothing is trusted before verification
    } catch {
      throw new TokenError('malformed token');
    }
    const entry = issuer ? this.keys.get(issuer) : undefined;
    if (!entry || !issuer) throw new TokenError('unknown issuer');
    let payload;
    try {
      ({ payload } = await jwtVerify(token, entry.getKey, {
        issuer,
        audience: this.cfg.audience,
        algorithms: ALGORITHMS,
        clockTolerance: 30,
        requiredClaims: ['sub', 'exp', 'iat'],
      }));
    } catch {
      throw new TokenError('invalid token');
    }
    if (payload.typ !== 'Bearer') throw new TokenError('not an access token');
    const tenant = typeof payload.tenant_id === 'string' ? payload.tenant_id : null;
    if (entry.realm === 'staff' && (!tenant || !UUID.test(tenant))) throw new TokenError('staff token without a valid tenant');
    if (entry.realm === 'citizens' && payload.tenant_id !== undefined) throw new TokenError('citizen token with a tenant');
    const locale = typeof payload.locale === 'string' && /^[a-z]{2}(-[A-Z]{2})?$/.test(payload.locale) ? payload.locale : null;
    return { realm: entry.realm, subject: payload.sub as string, tenantId: tenant, locale };
  }
}
