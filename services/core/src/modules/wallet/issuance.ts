import { createHash, randomBytes, randomInt } from 'node:crypto';
import { issueCredential, signStatusList, StatusList, supportedFormat, type SupportedFormat } from '@civora/credentials';
import type { ClaimSource } from './demo-source';
import { ProofError, verifyDpop, verifyKeyProof } from './proofs';
import type { IssuerSigners, WalletConfig } from './wallet.config';
import type { CredentialTypeRow, IssuerRow, WalletRepository } from './wallet.repository';

/**
 * OpenID4VCI 1.0 issuance with a pre-authorised code (P4-D1, P4-API1, P4-API2, P4-F1; doc phase-4/03):
 *
 *   1. a signed-in person asks an issuer for an offer (credential-offers): a single-use pre-authorised code in the
 *      offer (shown as a QR code; no personal data in it, P4-SEC4) and a 6-digit transaction code given separately;
 *   2. the wallet redeems the code and the transaction code at the token endpoint with a DPoP proof: an access token
 *      bound to the wallet's DPoP key (5 minutes, one credential);
 *   3. it gets a c_nonce from the nonce endpoint and signs a key proof with the device key;
 *   4. the credential endpoint checks the DPoP proof, the token and the key proof, records the issuance (random status
 *      index) and returns an SD-JWT VC bound to the device key (cnf), signed in the HSM.
 * Errors follow OAuth 2.0 / OpenID4VCI (error codes, 400 or 401). Only digests of codes, tokens and nonces are stored.
 */
export const PRE_AUTH_GRANT = 'urn:ietf:params:oauth:grant-type:pre-authorized_code';
export const FORMAT: SupportedFormat = supportedFormat('dc+sd-jwt'); // the format registry (P4-A4, doc phase-4/08)

export class OAuthError extends Error {
  constructor(readonly status: 400 | 401 | 403 | 404 | 429, readonly error: string, readonly description: string, readonly dpop = false) {
    super(description);
  }
}

const digest = (label: string, value: string): Buffer => createHash('sha256').update(`${label}\0${value}`, 'utf8').digest();
/** The transaction code's digest is salted with the pre-authorised code, which the cell does not keep (doc 03). */
const txDigest = (code: string, tx: string): Buffer => digest(`tx\0${code}`, tx);

/** credential_configuration_id for a type: urn:civora:tn:synthetic:residence-certificate:1 -> residence-certificate-1. */
export const configurationId = (vct: string): string => {
  const p = vct.split(':');
  return `${p[4]}-${p[5]}`;
};

export interface Deps {
  cfg: WalletConfig;
  repo: WalletRepository;
  signers: IssuerSigners;
  source: ClaimSource;
  log(entry: Record<string, unknown>): void;
}

export class Issuance {
  private readonly statusCache = new Map<string, { version: string; token: string; at: number }>();

  constructor(private readonly d: Deps) {}

  private url(path: string): string {
    return this.d.cfg.publicUrl + path;
  }

  private async issuerOrThrow(slug: string): Promise<IssuerRow> {
    const i = await this.d.repo.issuerBySlug(slug);
    if (!i || i.status !== 'active') throw new OAuthError(404, 'not_found', 'no such issuer');
    if (i.issuerUrl !== this.url(`/issuers/${i.slug}`)) throw new Error(`issuer ${i.slug}: its identifier does not match WALLET_PUBLIC_URL`);
    return i;
  }

  /** Credential Issuer Metadata (OpenID4VCI 1.0 §12.2). */
  async issuerMetadata(slug: string): Promise<Record<string, unknown>> {
    const i = await this.issuerOrThrow(slug);
    const types = await this.d.repo.typesOf(i.id);
    const display = (d: Record<'ar' | 'fr' | 'en', string>) => [{ name: d.ar, locale: 'ar' }, { name: d.fr, locale: 'fr' }, { name: d.en, locale: 'en' }];
    return {
      credential_issuer: i.issuerUrl,
      credential_endpoint: this.url('/v1/oid4vci/credential'),
      nonce_endpoint: this.url('/v1/oid4vci/nonce'),
      display: display(i.display),
      credential_configurations_supported: Object.fromEntries(types.map((t) => [configurationId(t.vct), {
        format: FORMAT,
        vct: t.vct,
        cryptographic_binding_methods_supported: ['jwk'],
        credential_signing_alg_values_supported: ['ES256'],
        proof_types_supported: { jwt: { proof_signing_alg_values_supported: ['ES256'] } },
        credential_metadata: {
          display: display(t.display),
          claims: t.claims.map((c) => ({ path: c.split('/') })),
        },
      }])),
    };
  }

  /** JWT VC Issuer Metadata (SD-JWT VC draft §5): the issuer's public keys, for holders and verifiers. */
  async jwtVcIssuerMetadata(slug: string): Promise<Record<string, unknown>> {
    const i = await this.issuerOrThrow(slug);
    return { issuer: i.issuerUrl, jwks: { keys: [{ ...i.publicJwk, kid: i.kid, alg: 'ES256', use: 'sig' }] } };
  }

  /** OAuth 2.0 Authorization Server Metadata of the issuer (RFC 8414): the issuer is its own authorization server. */
  async authorizationServerMetadata(slug: string): Promise<Record<string, unknown>> {
    const i = await this.issuerOrThrow(slug);
    return {
      issuer: i.issuerUrl,
      token_endpoint: this.url('/v1/oid4vci/token'),
      grant_types_supported: [PRE_AUTH_GRANT],
      'pre-authorized_grant_anonymous_access_supported': true,
      dpop_signing_alg_values_supported: ['ES256'],
      token_endpoint_auth_methods_supported: ['none'],
      response_types_supported: [],
    };
  }

  /** P4-API1: an offer for the signed-in person. */
  async createOffer(slug: string, configId: string, personId: string): Promise<{ credentialOffer: Record<string, unknown>; offerUri: string; txCode: string; expiresAt: Date }> {
    const i = await this.issuerOrThrow(slug);
    const t = (await this.d.repo.typesOf(i.id)).find((x) => configurationId(x.vct) === configId);
    if (!t) throw new OAuthError(400, 'invalid_request', 'this issuer has no such credential configuration');
    const code = randomBytes(32).toString('base64url');
    const tx = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const r = await this.d.repo.createOffer(t.id, personId, digest('pre-auth', code), txDigest(code, tx), this.d.cfg.offerTtlSeconds);
    if (r === 'too-many') throw new OAuthError(429, 'too_many_offers', 'at most 5 open offers per person');
    const credentialOffer = {
      credential_issuer: i.issuerUrl,
      credential_configuration_ids: [configId],
      grants: { [PRE_AUTH_GRANT]: { 'pre-authorized_code': code, tx_code: { input_mode: 'numeric', length: 6 } } },
    };
    this.d.log({ event: 'wallet.offer.created', issuer: i.slug, configuration: configId, offer: r.offerId });
    return { credentialOffer, offerUri: `openid-credential-offer://?credential_offer=${encodeURIComponent(JSON.stringify(credentialOffer))}`, txCode: tx, expiresAt: r.expiresAt };
  }

  /** P4-API2: token endpoint (pre-authorised code grant; DPoP-bound token). */
  async token(form: Record<string, unknown>, dpopProof: string | undefined): Promise<Record<string, unknown>> {
    if (form.grant_type !== PRE_AUTH_GRANT) throw new OAuthError(400, 'unsupported_grant_type', 'only the pre-authorised code grant is supported');
    const code = form['pre-authorized_code'];
    const tx = form.tx_code;
    if (typeof code !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(code)) throw new OAuthError(400, 'invalid_grant', 'unknown or used code');
    if (typeof tx !== 'string' || !/^[0-9]{6}$/.test(tx)) throw new OAuthError(400, 'invalid_grant', 'a 6-digit transaction code is required');
    let jkt: string;
    try {
      jkt = await verifyDpop({ proof: dpopProof, method: 'POST', url: this.url('/v1/oid4vci/token'), claimJti: (dg, ttl) => this.d.repo.claimProofJti(dg, ttl) });
    } catch (e) {
      if (e instanceof ProofError) throw new OAuthError(400, 'invalid_dpop_proof', e.message);
      throw e;
    }
    const accessToken = randomBytes(32).toString('base64url');
    const r = await this.d.repo.redeemOffer(digest('pre-auth', code), txDigest(code, tx), digest('access-token', accessToken), jkt, this.d.cfg.tokenTtlSeconds);
    if (r.outcome === 'wrong-tx-code') throw new OAuthError(400, 'invalid_grant', 'wrong transaction code');
    if (r.outcome !== 'ok') throw new OAuthError(400, 'invalid_grant', 'unknown, expired, used or locked code');
    return { access_token: accessToken, token_type: 'DPoP', expires_in: this.d.cfg.tokenTtlSeconds };
  }

  /** OpenID4VCI 1.0 §7: a fresh c_nonce. */
  async nonce(): Promise<{ c_nonce: string }> {
    const n = randomBytes(32).toString('base64url');
    await this.d.repo.newNonce(digest('c_nonce', n), 'c_nonce', this.d.cfg.nonceTtlSeconds);
    return { c_nonce: n };
  }

  /** P4-API2: credential endpoint. */
  async credential(authorization: string | undefined, dpopProof: string | undefined, body: Record<string, unknown>): Promise<Record<string, unknown>> {
    const m = /^DPoP ([A-Za-z0-9_-]{43})$/.exec(authorization ?? '');
    if (!m) throw new OAuthError(401, 'invalid_token', 'a DPoP-bound access token is required', true);
    const accessToken = m[1]!;
    const tokenDigest = digest('access-token', accessToken);
    const grant = await this.d.repo.tokenGrant(tokenDigest);
    if (!grant || !grant.usable) throw new OAuthError(401, 'invalid_token', 'unknown, expired or used access token', true);
    try {
      await verifyDpop({ proof: dpopProof, method: 'POST', url: this.url('/v1/oid4vci/credential'), accessToken, jkt: grant.dpopJkt,
        claimJti: (dg, ttl) => this.d.repo.claimProofJti(dg, ttl) });
    } catch (e) {
      if (e instanceof ProofError) throw new OAuthError(401, 'invalid_dpop_proof', e.message, true);
      throw e;
    }
    const type = await this.d.repo.typeById(grant.credentialTypeId);
    const issuer = type && await this.d.repo.issuerById(type.issuerId);
    if (!type || !issuer || issuer.status !== 'active') throw new OAuthError(400, 'invalid_credential_request', 'the issuer is not active');
    if (body.credential_configuration_id !== configurationId(type.vct)) throw new OAuthError(400, 'unknown_credential_configuration', 'the token was granted for another credential configuration');
    if ('proof' in body) throw new OAuthError(400, 'invalid_credential_request', 'use proofs (OpenID4VCI 1.0)');
    const proofs = (body.proofs as { jwt?: unknown } | undefined)?.jwt;
    if (!Array.isArray(proofs) || proofs.length !== 1 || typeof proofs[0] !== 'string') {
      throw new OAuthError(400, 'invalid_proof', 'exactly one jwt key proof is required (no batch issuance)');
    }
    let holder: Awaited<ReturnType<typeof verifyKeyProof>>;
    try {
      holder = await verifyKeyProof({ proof: proofs[0], issuer: issuer.issuerUrl, useNonce: (n) => this.d.repo.useNonce(digest('c_nonce', n), 'c_nonce') });
    } catch (e) {
      if (e instanceof ProofError) throw new OAuthError(400, e.code, e.message);
      throw e;
    }
    const claims = await this.d.source.claimsFor(grant.subjectPersonId, type.vct, type.claims);
    const exp = Math.floor(Date.now() / 1000) + type.validityDays * 86400;
    const signer = await this.d.signers.forIssuer(issuer);
    const rec = await this.d.repo.issueWithToken(tokenDigest, holder.jkt, new Date(exp * 1000));
    try {
      const issued = await issueCredential(signer, {
        iss: issuer.issuerUrl, vct: type.vct, holderJwk: holder.jwk, exp,
        status: { status_list: { idx: rec.statusIdx, uri: this.url(`/v1/status-lists/${rec.statusListId}`) } },
        claims, selectivelyDisclosable: type.selectivelyDisclosable, decoys: 2,
      });
      this.d.log({ event: 'wallet.credential.issued', issuer: issuer.slug, configuration: configurationId(type.vct), issued: rec.issuedCredentialId });
      return { credentials: [{ credential: issued.sdJwt }] };
    } catch (e) {
      await this.d.repo.revokeIssuedInError(rec.issuedCredentialId).catch(() => undefined);
      throw e;
    }
  }

  /** P4-API6: the signed status list (statuslist+jwt), cached per list version for the list's ttl. */
  async statusList(id: string): Promise<string | null> {
    const s = await this.d.repo.statusList(id);
    if (!s) return null;
    const cached = this.statusCache.get(id);
    const now = Math.floor(Date.now() / 1000);
    if (cached && cached.version === s.version && now - cached.at < this.d.cfg.statusListTtlSeconds) return cached.token;
    const issuer = await this.d.repo.issuerById(s.issuerId);
    if (!issuer) return null;
    const signer = await this.d.signers.forIssuer(issuer);
    const list = new StatusList(s.bits, s.size, s.bitmap);
    const token = await signStatusList(signer, this.url(`/v1/status-lists/${id}`), list,
      { iat: now, exp: now + this.d.cfg.statusListValiditySeconds, ttl: this.d.cfg.statusListTtlSeconds });
    this.statusCache.set(id, { version: s.version, token, at: now });
    return token;
  }
}

export type { CredentialTypeRow };
