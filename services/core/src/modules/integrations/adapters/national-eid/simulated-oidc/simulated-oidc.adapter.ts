import { createRemoteJWKSet, errors, jwtVerify, type JWTVerifyGetKey } from 'jose';
import { readSecret } from '../../../../../config/app-config';
import { type AdapterMode, type AdapterRegistration, assertModeAllowed } from '../../../adapter-registry';
import type { IntegrationLogger } from '../../../integration-log';
import { type EidAuthorizationRequest, type EidCompletion, type EidIdentity, type EidLoa, EidRejected, EidUnavailable, type NationalEid } from '../../../ports/national-eid';

/**
 * NationalEid, simulated mode: an OpenID Connect relying party of the SIMULATED national eID (a Keycloak realm with
 * synthetic identities only, infra/keycloak/simulators). The core is a confidential client: authorization code with
 * PKCE S256, a fresh authentication at the eID (prompt=login), and the signed ID token verified here (keys of the eID,
 * issuer, audience, nonce, authentication time, assurance level). The asserted identifier must be in the country
 * pack's synthetic range: a simulated adapter never accepts a real-looking identifier.
 */
export const SIMULATED_EID: AdapterRegistration = { port: 'NationalEid', provider: 'simulated-oidc', registerEntry: 'I-01', integrationClass: 3 };

export interface SimulatedEidConfig {
  /** The simulator's issuer as the browser and the ID token see it. */
  issuer: string;
  /** Where the core reaches the simulator, when not at the issuer's origin (e.g. inside the cell). */
  internalUrl?: string;
  clientId: string;
  clientSecret: string;
  /** The citizen app's callback, registered at the eID. */
  redirectUri: string;
  /** The country pack's synthetic identifier range (CIN 99xxxxxx in Tunisia). */
  syntheticPattern: RegExp;
  /** Authentication at the eID older than this is refused. */
  maxAuthAgeSeconds: number;
}

const LOAS: readonly EidLoa[] = ['substantial', 'high'];
const insecureAllowed = (env: NodeJS.ProcessEnv): boolean => ['dev', 'test'].includes(env.CIVORA_ENV ?? 'dev');

/** Null when no eID is configured in this cell (identity links then answer 503). */
export function loadSimulatedEidConfig(syntheticPattern: string, env: NodeJS.ProcessEnv = process.env): SimulatedEidConfig | null {
  const issuer = env.EID_SIM_ISSUER;
  const clientSecret = readSecret(env, 'EID_SIM_CLIENT_SECRET');
  const redirectUri = env.EID_REDIRECT_URI;
  if (!issuer || !clientSecret || !redirectUri) return null;
  for (const u of [issuer, env.EID_SIM_INTERNAL_URL ?? issuer, redirectUri]) {
    const url = new URL(u);
    const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    // http only in dev and test: for the simulator, and for an app callback on this machine.
    if (url.protocol !== 'https:' && !(insecureAllowed(env) && (u !== redirectUri || local))) throw new Error('eID URLs must use https (the simulator and a localhost app may use http in dev and test only)');
  }
  const maxAuthAgeSeconds = Number(env.EID_MAX_AUTH_AGE_SECONDS ?? 600);
  if (!Number.isInteger(maxAuthAgeSeconds) || maxAuthAgeSeconds < 60 || maxAuthAgeSeconds > 3600) throw new Error('EID_MAX_AUTH_AGE_SECONDS must be 60..3600');
  return {
    issuer: issuer.replace(/\/$/, ''),
    internalUrl: env.EID_SIM_INTERNAL_URL?.replace(/\/$/, ''),
    clientId: env.EID_SIM_CLIENT_ID ?? 'civora-core-eid',
    clientSecret,
    redirectUri,
    syntheticPattern: new RegExp(syntheticPattern),
    maxAuthAgeSeconds,
  };
}

export class SimulatedOidcEid implements NationalEid {
  readonly registration = SIMULATED_EID;
  readonly claimSource = 'eid-simulated' as const;
  readonly mode: AdapterMode;
  private readonly keys: JWTVerifyGetKey;
  private readonly backchannel: string;
  private readonly fetchFn: typeof fetch;
  private readonly now: () => number;

  constructor(
    private readonly cfg: SimulatedEidConfig,
    private readonly log: IntegrationLogger,
    opts: { keys?: JWTVerifyGetKey; fetch?: typeof fetch; now?: () => number } = {},
  ) {
    // Class 3 (not authorised): simulated only, whatever the cell's flags say.
    this.mode = assertModeAllowed(SIMULATED_EID, 'simulated', { productionAdaptersFlag: false });
    this.backchannel = cfg.internalUrl ? cfg.internalUrl + new URL(cfg.issuer).pathname : cfg.issuer;
    this.keys = opts.keys ?? createRemoteJWKSet(new URL(`${this.backchannel}/protocol/openid-connect/certs`), { timeoutDuration: 5000 });
    this.fetchFn = opts.fetch ?? fetch;
    this.now = opts.now ?? Date.now;
  }

  authorizationUrl(req: EidAuthorizationRequest): string {
    const q = new URLSearchParams({
      client_id: this.cfg.clientId,
      redirect_uri: this.cfg.redirectUri,
      response_type: 'code',
      scope: 'openid',
      state: req.state,
      nonce: req.nonce,
      code_challenge: req.codeChallenge,
      code_challenge_method: 'S256',
      prompt: 'login',
      ...(req.locale ? { ui_locales: req.locale } : {}),
    });
    return `${this.cfg.issuer}/protocol/openid-connect/auth?${q}`;
  }

  async complete(c: EidCompletion): Promise<EidIdentity> {
    const started = this.now();
    let outcome: 'ok' | 'rejected' | 'unavailable' = 'ok';
    try {
      return await this.verify(c);
    } catch (e) {
      const mapped = this.classify(e);
      outcome = mapped instanceof EidUnavailable ? 'unavailable' : 'rejected';
      throw mapped;
    } finally {
      this.log({
        correlationId: c.correlationId, port: SIMULATED_EID.port, provider: SIMULATED_EID.provider, mode: this.mode, operation: 'complete',
        purpose: 'identity-link', legalBasisRef: 'none: simulated eID, synthetic identities only', outcome, latencyMs: this.now() - started,
      });
    }
  }

  private async verify(c: EidCompletion): Promise<EidIdentity> {
    const res = await this.fetchFn(`${this.backchannel}/protocol/openid-connect/token`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        authorization: `Basic ${Buffer.from(`${encodeURIComponent(this.cfg.clientId)}:${encodeURIComponent(this.cfg.clientSecret)}`).toString('base64')}`,
      },
      body: new URLSearchParams({ grant_type: 'authorization_code', code: c.code, redirect_uri: this.cfg.redirectUri, code_verifier: c.codeVerifier }),
      signal: AbortSignal.timeout(10_000),
    });
    if (res.status >= 500) throw new EidUnavailable(`eID token endpoint answered ${res.status}`);
    if (!res.ok) throw new EidRejected(`eID refused the code (${res.status})`);
    const idToken = ((await res.json().catch(() => ({}))) as { id_token?: unknown }).id_token;
    if (typeof idToken !== 'string') throw new EidRejected('eID answer without an ID token');
    const { payload } = await jwtVerify(idToken, this.keys, {
      issuer: this.cfg.issuer,
      audience: this.cfg.clientId,
      algorithms: ['RS256', 'PS256', 'ES256'],
      clockTolerance: 30,
      currentDate: new Date(this.now()),
    });
    if (payload.typ !== undefined && payload.typ !== 'ID') throw new EidRejected('not an ID token');
    if (payload.azp !== undefined && payload.azp !== this.cfg.clientId) throw new EidRejected('ID token issued to another client');
    if (payload.nonce !== c.nonce) throw new EidRejected('nonce does not match this link attempt');
    const authTime = payload.auth_time;
    if (typeof authTime !== 'number' || this.now() / 1000 - authTime > this.cfg.maxAuthAgeSeconds || authTime * 1000 > this.now() + 30_000) {
      throw new EidRejected('authentication at the eID missing or too old');
    }
    const loa = payload.loa;
    if (typeof loa !== 'string' || !LOAS.includes(loa as EidLoa)) throw new EidRejected('no acceptable assurance level');
    const nationalId = payload.national_id;
    if (typeof nationalId !== 'string' || !this.cfg.syntheticPattern.test(nationalId)) {
      throw new EidRejected('identifier outside the synthetic range: the simulated eID accepts synthetic identities only');
    }
    return { nationalId, loa: loa as EidLoa, authenticatedAt: new Date(authTime * 1000) };
  }

  private classify(e: unknown): EidRejected | EidUnavailable {
    if (e instanceof EidRejected || e instanceof EidUnavailable) return e;
    if (e instanceof errors.JWKSTimeout) return new EidUnavailable('eID keys unreachable');
    if (e instanceof errors.JOSEError) return new EidRejected(`ID token refused (${e.code})`);
    return new EidUnavailable('eID unreachable');
  }
}
