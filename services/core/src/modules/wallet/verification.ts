import { randomBytes } from 'node:crypto';
import { CredentialError, peekJws, signJws, STATUS, statusFromToken, verifyCredential } from '@civora/credentials';
import type { JWK } from 'jose';
import type { Issuance } from './issuance';
import { OAuthError } from './issuance';
import type { IssuerSigners, WalletConfig } from './wallet.config';
import type { WalletRepository } from './wallet.repository';

/**
 * OpenID4VP 1.0 verification for the cell's registered verifiers (P4-D3, P4-API4, P4-API5, P4-F3, P4-F4; doc
 * phase-4/05):
 *
 *   1. staff of the institution that registered a verifier create a request for a credential type and the claims they
 *      need (only types and claims the verifier is registered for, Q4-3); the page shows a QR code holding only the
 *      client_id and a request_uri (P4-SEC4);
 *   2. the wallet fetches the request object, signed with the verifier's key in the HSM (typ oauth-authz-req+jwt), and
 *      checks it with the key from the cell's verifier registry; it holds a DCQL query, a nonce, a state and the
 *      response_uri (response_mode direct_post);
 *   3. the wallet posts vp_token and state; the core verifies each presentation: issuer trusted by the cell, signature,
 *      type, expiry, key binding to this verifier and nonce (single use), status (with an offline grace: a status list
 *      is used until its own exp when the issuer cannot be reached, P4-F4); only the requested claims are kept;
 *   4. the outcome is logged with claim names only (DB5); the claims go to the verifier's page once (P4-API4 result).
 * P4-API5 (`POST /v1/verify`) answers a request with a presentation scanned by the verifier's own device (QR
 * presentation, P4-F3) through the same checks.
 */
export const REQUEST_TYP = 'oauth-authz-req+jwt';
export const CREDENTIAL_QUERY_ID = 'credential';

export interface StaffCaller {
  personId: string;
  tenantId: string | null;
}

const reasonOf = (e: unknown): string => {
  if (e instanceof CredentialError) {
    const map: Record<string, string> = {
      signature: 'signature', alg: 'signature', typ: 'malformed', malformed: 'malformed', disclosure: 'malformed', digest: 'malformed', claims: 'malformed',
      expired: 'expired', 'not-yet-valid': 'not-yet-valid', 'key-binding': 'key-binding', vct: 'wrong-type', status: 'status-unavailable', sd_alg: 'malformed',
    };
    return map[e.code] ?? 'malformed';
  }
  return 'malformed';
};

export class Verification {
  /** Last good status list per URI, for the offline grace (P4-F4). */
  private readonly statusCache = new Map<string, { token: string; exp: number }>();

  constructor(private readonly d: {
    cfg: WalletConfig;
    repo: WalletRepository;
    signers: IssuerSigners;
    issuance: Issuance;
    /** Status lists of issuers outside this cell (none trusted yet); this cell's are read directly. */
    fetchStatus?: (uri: string) => Promise<string>;
    log(entry: Record<string, unknown>): void;
  }) {}

  private url(path: string): string {
    return this.d.cfg.publicUrl + path;
  }

  /** The cell's verifier registry entry (pre-registered client identifiers, OpenID4VP 1.0 §5.9; Q4-3). */
  async verifierMetadata(clientId: string): Promise<Record<string, unknown>> {
    const v = await this.d.repo.verifierByClientId(clientId);
    if (!v || v.status !== 'active') throw new OAuthError(404, 'not_found', 'no such verifier');
    return {
      client_id: v.clientId,
      client_name: v.display,
      jwks: { keys: [{ ...v.requestJwk, kid: v.requestKid, alg: 'ES256', use: 'sig' }] },
      vp_formats_supported: { 'dc+sd-jwt': { 'sd-jwt_alg_values': ['ES256'], 'kb-jwt_alg_values': ['ES256'] } },
      allowed: { vct: v.allowedVct, claims: v.allowedClaims },
    };
  }

  /** P4-API4: a request for the signed-in staff member's verifier. */
  async createRequest(caller: StaffCaller, clientId: string, vct: string, claims: string[]): Promise<Record<string, unknown>> {
    if (!Array.isArray(claims) || claims.length < 1 || claims.length > 40 || !claims.every((c) => typeof c === 'string' && /^[a-z][a-z0-9_]*(\/[a-z][a-z0-9_]*)?$/.test(c))) {
      throw new OAuthError(400, 'invalid_request', 'claims: 1 to 40 claim paths');
    }
    const nonce = randomBytes(32).toString('base64url');
    const state = randomBytes(32).toString('base64url');
    const r = await this.d.repo.createPresentationRequest(clientId, caller.tenantId, caller.personId, nonce, state, vct, claims, 300);
    if (r === 'forbidden') throw new OAuthError(403, 'access_denied', 'not a verifier of your institution, or a type or claim it is not registered for');
    if (r === 'unknown') throw new OAuthError(404, 'not_found', 'no such verifier');
    const requestUri = this.url(`/v1/oid4vp/requests/${r.requestId}/object`);
    this.d.log({ event: 'wallet.presentation.requested', verifier: clientId, request: r.requestId, claims: claims.length });
    return {
      request_id: r.requestId,
      request_uri: requestUri,
      authorization_request: `openid4vp://?client_id=${encodeURIComponent(clientId)}&request_uri=${encodeURIComponent(requestUri)}`,
      expires_at: r.expiresAt.toISOString(),
    };
  }

  /** The signed request object (OpenID4VP 1.0 §5, request_uri; JAR, RFC 9101). */
  async requestObject(id: string): Promise<string> {
    if (!/^[0-9a-f-]{36}$/.test(id)) throw new OAuthError(404, 'not_found', 'no such request');
    const r = await this.d.repo.openPresentationRequest(id);
    if (!r) throw new OAuthError(404, 'not_found', 'no such request, or it was answered or expired');
    const signer = await this.d.signers.forKey({ tokenLabel: r.hsmTokenLabel, keyId: r.hsmKeyId, kid: r.requestKid, publicJwk: r.requestJwk });
    const now = Math.floor(Date.now() / 1000);
    return signJws(signer, { typ: REQUEST_TYP }, {
      iss: r.clientId, aud: 'https://self-issued.me/v2', client_id: r.clientId, response_type: 'vp_token', response_mode: 'direct_post',
      response_uri: this.url('/v1/oid4vp/responses'), nonce: r.nonce, state: r.state, iat: now, exp: Math.floor(r.expiresAt.getTime() / 1000),
      dcql_query: { credentials: [{ id: CREDENTIAL_QUERY_ID, format: 'dc+sd-jwt', meta: { vct_values: [r.vct] }, claims: r.claims.map((c) => ({ path: c.split('/') })) }] },
    });
  }

  private async issuerKeyFor(header: Record<string, unknown>, payload: Record<string, unknown>): Promise<JWK> {
    const iss = payload.iss;
    const issuer = typeof iss === 'string' ? await this.d.repo.issuerByUrl(iss) : null;
    if (!issuer || issuer.status !== 'active') throw new CredentialError('issuer-untrusted', 'the issuer is not trusted by this cell');
    if (header.kid !== issuer.kid) throw new CredentialError('signature', 'unknown issuer key');
    return issuer.publicJwk;
  }

  /** The status list token for a URI: this cell's lists directly; others fetched; the last good one within its exp if unreachable. */
  private async statusToken(uri: string): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    try {
      let token: string | null;
      if (uri.startsWith(this.url('/v1/status-lists/'))) token = await this.d.issuance.statusList(uri.slice(this.url('/v1/status-lists/').length));
      else if (this.d.fetchStatus) token = await this.d.fetchStatus(uri);
      else token = null;
      if (!token) throw new Error('no status list');
      const exp = peekJws(token).payload.exp;
      this.statusCache.set(uri, { token, exp: typeof exp === 'number' ? exp : now + 300 });
      return token;
    } catch {
      const cached = this.statusCache.get(uri);
      if (cached && now <= cached.exp) {
        this.d.log({ event: 'wallet.status.grace', uri, until: cached.exp });
        return cached.token;
      }
      throw new CredentialError('status', 'the status list cannot be read and no valid copy is held');
    }
  }

  /** Checks one presentation for a request; returns the requested claims, or throws with a reason code. */
  private async check(presentation: string, req: { clientId: string; nonce: string; vct: string; claims: string[] }): Promise<{ claims: Record<string, unknown>; names: string[] }> {
    if (typeof presentation !== 'string' || presentation.length > 32_768) throw new CredentialError('malformed', 'presentation too large or not a string');
    const v = await verifyCredential(presentation, {
      issuerKey: (h, p) => this.issuerKeyFor(h, p), keyBinding: { aud: req.clientId, nonce: req.nonce }, acceptedVct: [req.vct],
    });
    if (v.status) {
      const issuer = await this.d.repo.issuerByUrl(v.iss);
      const token = await this.statusToken(v.status.status_list.uri);
      const st = await statusFromToken(token, issuer!.publicJwk, v.status.status_list.uri, v.status.status_list.idx);
      if (st.status === STATUS.INVALID) throw new CredentialError('revoked', 'the credential has been revoked');
      if (st.status === STATUS.SUSPENDED) throw new CredentialError('suspended', 'the credential is suspended');
      if (st.status !== STATUS.VALID) throw new CredentialError('revoked', 'the credential is not valid');
    }
    // Keep exactly the requested claims (data minimisation): anything else the wallet sent is dropped, not stored.
    const out: Record<string, unknown> = {};
    const names: string[] = [];
    for (const path of req.claims) {
      const [top, sub] = path.split('/') as [string, string | undefined];
      const value = sub === undefined ? v.claims[top] : (v.claims[top] as Record<string, unknown> | undefined)?.[sub];
      if (value === undefined) throw new CredentialError('missing-claims', `${path} was not disclosed`);
      if (sub === undefined) out[top] = value;
      else ((out[top] ??= {}) as Record<string, unknown>)[sub] = value;
      names.push(path);
    }
    return { claims: out, names };
  }

  private async decide(requestId: string, req: { clientId: string; nonce: string; vct: string; claims: string[] }, presentation: unknown): Promise<{ result: 'accepted' | 'rejected'; reason?: string }> {
    let outcome: { result: 'accepted' | 'rejected'; reason?: string; claims?: Record<string, unknown>; names?: string[] };
    try {
      const c = await this.check(presentation as string, req);
      outcome = { result: 'accepted', claims: c.claims, names: c.names };
    } catch (e) {
      const code = e instanceof CredentialError && ['revoked', 'suspended', 'missing-claims', 'issuer-untrusted'].includes(e.code) ? e.code : reasonOf(e);
      outcome = { result: 'rejected', reason: code };
    }
    const recorded = await this.d.repo.recordPresentation(requestId, outcome.result, outcome.reason ?? null, [req.vct], outcome.names ?? [], outcome.claims ?? null);
    if (!recorded) throw new OAuthError(400, 'invalid_request', 'the request was already answered or has expired');
    this.d.log({ event: 'wallet.presentation.verified', request: requestId, result: outcome.result, reason: outcome.reason });
    return { result: outcome.result, reason: outcome.reason };
  }

  /** P4-API4: the wallet's direct_post (application/x-www-form-urlencoded: vp_token, state). */
  async response(form: Record<string, unknown>): Promise<Record<string, unknown>> {
    if (typeof form.state !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(form.state)) throw new OAuthError(400, 'invalid_request', 'state is required');
    const req = await this.d.repo.pendingByState(form.state);
    if (!req) throw new OAuthError(400, 'invalid_request', 'unknown, answered or expired request');
    let presentation: unknown;
    try {
      const tok = JSON.parse(String(form.vp_token ?? ''));
      presentation = Array.isArray(tok?.[CREDENTIAL_QUERY_ID]) && tok[CREDENTIAL_QUERY_ID].length === 1 ? tok[CREDENTIAL_QUERY_ID][0] : undefined;
    } catch {
      presentation = undefined;
    }
    await this.decide(req.requestId, req, presentation);
    return {};
  }

  /** P4-API5: a presentation the verifier's own device scanned for one of its requests (QR presentation, P4-F3). */
  async verify(caller: StaffCaller, requestId: string, presentation: unknown): Promise<Record<string, unknown>> {
    const req = await this.d.repo.pendingForStaff(requestId, caller.personId);
    if (!req) throw new OAuthError(404, 'not_found', 'no pending request of yours with this id');
    await this.decide(req.requestId, req, presentation);
    return this.result(caller, requestId);
  }

  /** The verifier's page: pending, expired, accepted (with the claims, once) or rejected (with the reason). */
  async result(caller: StaffCaller, requestId: string): Promise<Record<string, unknown>> {
    if (!/^[0-9a-f-]{36}$/.test(requestId)) throw new OAuthError(404, 'not_found', 'no such request');
    const r = await this.d.repo.readPresentation(requestId, caller.personId);
    if (r.status === 'unknown') throw new OAuthError(404, 'not_found', 'no such request');
    return { status: r.status, ...(r.reason ? { reason: r.reason } : {}), ...(r.disclosed ? { claims: r.disclosed } : {}) };
  }
}
